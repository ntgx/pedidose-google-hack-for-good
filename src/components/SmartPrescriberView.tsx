import React, { useState } from 'react';
import {
  Search,
  AlertOctagon,
  ShieldAlert,
  FileCheck2,
  Send,
  Lock,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Info,
  FileText,
  X,
  CalendarClock,
  Pill,
  Droplet,
  Syringe,
} from 'lucide-react';
import {
  CLINICAL_FORMULARY,
  FormularyFormulation,
  FormularyMedication,
} from '../data/clinicalFormulary';
import { PediatricPatient } from '../data/pediatricPatients';
import { calculateDeterministicDose, DeterministicDoseResult } from '../utils/dosingCalculator';
import { ClinicalRole, FhirServiceRequest } from '../api/uhmepClient';
import { SyringeVisualizer } from './SyringeVisualizer';
import { DosingBasisPanel } from './DosingBasisPanel';
import { DoseCeilingChart } from './DoseCeilingChart';
import { TaperingChart } from './TaperingChart';
import { Alert, Badge, Button, Tone } from './ui';

interface SmartPrescriberViewProps {
  activeRole: ClinicalRole;
  patient: PediatricPatient;
  selectedMedication: FormularyMedication;
  selectedFormulation: FormularyFormulation;
  dosePerUnit: number;
  frequencyPerDay: number;
  durationDays: number;
  overrideVolumeMl: number | null;
  customTrialLocks: Record<string, boolean>;
  step: number;
  onStepChange: (step: number) => void;
  onSelectMedication: (med: FormularyMedication) => void;
  onSelectFormulation: (form: FormularyFormulation) => void;
  onChangeDosePerUnit: (val: number) => void;
  onChangeFrequencyPerDay: (val: number) => void;
  onChangeDurationDays: (val: number) => void;
  onChangeOverrideVolumeMl: (val: number | null) => void;
  onSubmitPrescription: (
    payload: Partial<FhirServiceRequest>,
    autoApproveAsSupervisor: boolean
  ) => Promise<void>;
  isSubmitting: boolean;
  onNavigateToCaregiverCompanion?: () => void;
  onUpdateVitals: (
    patientId: string,
    updates: Partial<Pick<PediatricPatient, 'weightKg' | 'heightCm' | 'ageYears' | 'crClMlMin'>>
  ) => void;
}

const formulationTypeTone = (form: FormularyFormulation): Tone =>
  form.type === 'hospital_magistral' ? 'success' : form.type === 'clinical_trial_imp' ? 'trial' : 'info';

// Plain-language supply status for a formulation
const supplyLabel = (form: FormularyFormulation): { tone: Tone; label: string } =>
  form.farmastatus === 'hospital_compounded'
    ? { tone: 'success', label: 'Made by the hospital pharmacy' }
    : form.farmastatus === 'trial_sponsor_stock'
    ? { tone: 'trial', label: 'Free from the trial sponsor' }
    : form.farmastatus === 'shortage_warning'
    ? { tone: 'warning', label: 'Supply delays reported (Farmastatus)' }
    : { tone: 'success', label: 'In stock (SAM v2)' };

const reimbursementTextClass = (form: FormularyFormulation) =>
  form.reimbursementCategory === 'oncology_convention_only'
    ? 'text-rose-700 font-medium'
    : form.reimbursementCategory === 'riziv_chapter_iv'
    ? 'text-amber-800'
    : 'text-slate-800';

// Short form + strength so options can be compared at a glance
const formSummary = (form: FormularyFormulation): { kind: string; strength: string } => {
  const perMl = form.concentrationMgPerMl ? `${form.concentrationMgPerMl} mg/mL` : '';
  switch (form.form) {
    case 'tablet':
      return { kind: 'Tablet', strength: `${form.strengthMg} mg` };
    case 'capsule':
      return { kind: 'Capsule', strength: `${form.strengthMg} mg` };
    case 'iv_solution':
      return { kind: 'IV', strength: perMl };
    case 'mouthwash':
      return { kind: 'Mouthwash', strength: perMl };
    default:
      return { kind: 'Liquid', strength: perMl };
  }
};

const formIcon = (form: FormularyFormulation) =>
  form.form === 'tablet' || form.form === 'capsule' ? Pill : form.form === 'iv_solution' ? Syringe : Droplet;

// Icon + form-kind chip, shared by the medication and formulation steps
const FormChip: React.FC<{ form: FormularyFormulation }> = ({ form }) => {
  const FormIcon = formIcon(form);
  const summary = formSummary(form);
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-[11px] font-medium text-slate-700">
      <FormIcon className="w-3 h-3" />
      {summary.kind}
    </span>
  );
};

const CODE_PREFIX: Record<FormularyFormulation['type'], { prefix: string; title: string }> = {
  hospital_magistral: { prefix: 'Hospital', title: 'UZ Gent hospital magistral code (made by the hospital pharmacy)' },
  commercial_sam: { prefix: 'CNK', title: 'Belgian CNK package code (SAM v2)' },
  clinical_trial_imp: { prefix: 'Trial', title: 'Clinical trial investigational product ID' },
};

// Whether a solid form suits this child's swallowing ability
const swallowingFit = (form: FormularyFormulation, patient: PediatricPatient, firstName: string) => {
  if (form.form !== 'tablet' && form.form !== 'capsule') return null;
  if (patient.swallowingStatus === 'liquid_only')
    return { tone: 'warning' as const, text: `${firstName} can only take liquids` };
  if (patient.swallowingStatus === 'crushed_or_liquid')
    return { tone: 'neutral' as const, text: `${firstName} will need it crushed or dispersed` };
  return null;
};

const freqWords = (n: number) =>
  n === 1 ? 'once a day' : n === 2 ? 'twice a day' : `${n} times a day`;

export const SmartPrescriberView: React.FC<SmartPrescriberViewProps> = ({
  activeRole,
  patient,
  selectedMedication,
  selectedFormulation,
  dosePerUnit,
  frequencyPerDay,
  durationDays,
  overrideVolumeMl,
  customTrialLocks,
  step,
  onStepChange,
  onSelectMedication,
  onSelectFormulation,
  onChangeDosePerUnit,
  onChangeFrequencyPerDay,
  onChangeDurationDays,
  onChangeOverrideVolumeMl,
  onSubmitPrescription,
  isSubmitting,
  onNavigateToCaregiverCompanion,
  onUpdateVitals,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showBijlageAModal, setShowBijlageAModal] = useState(false);
  const [bijlageSigned, setBijlageSigned] = useState(true);
  const [clinicalNote, setClinicalNote] = useState('');

  // Filter formulary by substance, brand, indication, or !CODE
  const filteredMedications = CLINICAL_FORMULARY.filter((med) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      med.genericName.toLowerCase().includes(q) ||
      med.indicationTag.toLowerCase().includes(q) ||
      med.atcCode.toLowerCase().includes(q) ||
      med.brandExamples.some((b) => b.toLowerCase().includes(q)) ||
      med.searchKeywords.some((k) => k.toLowerCase().includes(q)) ||
      med.formulations.some((f) => f.cnkOrCode.toLowerCase().includes(q))
    );
  });

  // Deterministic dosing calculation
  const calc: DeterministicDoseResult = calculateDeterministicDose({
    patient,
    medication: selectedMedication,
    formulation: selectedFormulation,
    dosePerUnit,
    frequencyPerDay,
    durationDays,
    overrideVolumeMl,
    customTrialLocks,
  });

  // Build Posology & Patient Instruction string for FHIR ServiceRequest
  const volumeDisplay =
    calc.targetSingleVolumeMl !== null
      ? `${(calc.enteredVolumeMl ?? calc.targetSingleVolumeMl).toFixed(2)} mL (${calc.clampedSingleDoseMg.toFixed(1)} mg)`
      : `${calc.clampedSingleDoseMg.toFixed(1)} mg${
          calc.unitsPerAdministration ? ` (${calc.unitsPerAdministration} unit/tab)` : ''
        }`;

  const posologySummary = `${selectedMedication.genericName} — ${selectedFormulation.label}: ${volumeDisplay} per administration, ${calc.renalAdjustedFrequencyPerDay}x/day (${calc.renalAdjustedDailyDoseMg.toFixed(1)} mg/day total) for ${durationDays} days. Total course: ${calc.totalCourseMg.toFixed(0)} mg (${calc.packagesRequired}x package ${selectedFormulation.cnkOrCode}).`;

  const canSubmit = !calc.studyLockActive && !calc.isTenFoldVolumeError;

  const handleCreateFhirOrder = async (autoApprove: boolean) => {
    const requesterRef =
      activeRole === 'supervisor'
        ? {
            reference: 'PractitionerRole/pr-role-supervisor-oncology',
            display: 'Prof. Dr. Janssens (Pediatric Oncology Supervisor)',
          }
        : {
            reference: 'PractitionerRole/pr-role-assistant-pediatrics',
            display: 'Dr. Peeters (Pediatric Oncology Assistant)',
          };

    const fhirPayload: Partial<FhirServiceRequest> = {
      status: 'draft',
      intent: 'order',
      priority: calc.isHardCapped || calc.isRenalAdjusted ? 'urgent' : 'routine',
      category: [
        {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '16076005',
              display: 'Prescription',
            },
          ],
          text:
            selectedFormulation.type === 'hospital_magistral'
              ? 'Hospital Magistral / TMF Compounding Order'
              : selectedFormulation.type === 'clinical_trial_imp'
              ? `Clinical Trial IMP Order (${patient.activeStudyId})`
              : 'Ambulatory e-Prescription (UHMEP / Recip-e)',
        },
      ],
      code: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: selectedFormulation.snomedCode,
            display: `${selectedMedication.genericName} — ${selectedFormulation.label}`,
          },
          {
            system: 'https://www.ehealth.fgov.be/standards/fhir/medication/NamingSystem/cnk-codes',
            code: selectedFormulation.cnkOrCode,
            display: selectedFormulation.label,
          },
        ],
        text: `${selectedMedication.genericName} (${selectedFormulation.cnkOrCode}) — ${calc.clampedSingleDoseMg} mg (${
          calc.targetSingleVolumeMl ? `${calc.targetSingleVolumeMl} mL` : `${calc.unitsPerAdministration || 1} unit`
        }) ${calc.renalAdjustedFrequencyPerDay}x/day`,
      },
      subject: {
        identifier: {
          system: 'urn:be:fgov:ehealth:pseudo:v1',
          value: patient.pseudoSsin,
        },
        display: `${patient.shortName} (${patient.ageYears}y, ${patient.weightKg} kg, BSA ${calc.bsaM2} m²)`,
      },
      requester: requesterRef,
      performer: [
        {
          reference: 'Organization/org-uz-gent-pharmacy',
          display: 'UZ Gent Pediatric Clinical & Trial Pharmacy',
        },
      ],
      reasonCode: [
        {
          text: `${selectedMedication.indicationTag} — ${patient.diagnosis}`,
        },
      ],
      patientInstruction: `${posologySummary} Caregiver Rule: ${
        selectedMedication.caregiverAdministrationRules[0] || ''
      }`,
      note: [
        {
          authorString: requesterRef.display,
          text:
            clinicalNote.trim() ||
            `Deterministic PediDose Calculation: Weight ${patient.weightKg} kg, Height ${patient.heightCm} cm, Mosteller BSA ${calc.bsaM2} m², CrCl ${patient.crClMlMin} mL/min. ${
              calc.isHardCapped ? '[2.0 mg Hard Ceiling Applied] ' : ''
            }${calc.isRenalAdjusted ? '[Renal CrCl Interval Adapted] ' : ''}${
              calc.rizivChapterIvActive && bijlageSigned ? '[RIZIV Chapter IV Bijlage A Attached]' : ''
            }`,
        },
      ],
    };

    await onSubmitPrescription(fhirPayload, autoApprove);
    setClinicalNote('');
  };

  const impForm = selectedMedication.formulations.find((f) => f.type === 'clinical_trial_imp');
  const tabForm = selectedMedication.formulations.find(
    (f) => f.reimbursementCategory === 'riziv_chapter_iv'
  );
  const isLiquid = calc.targetSingleVolumeMl !== null && !!selectedFormulation.concentrationMgPerMl;
  // Same 5% tolerance as the syringe: any larger gap between drawn-up and calculated volume blocks saving
  const volumeMismatch =
    isLiquid &&
    calc.enteredVolumeMl !== null &&
    calc.targetSingleVolumeMl! > 0 &&
    Math.abs(calc.enteredVolumeMl / calc.targetSingleVolumeMl! - 1) > 0.05;
  const firstName = patient.shortName.split(' ')[0];

  // Syringe → dose: work backwards from the volume per dose to the protocol dose rate
  const setDoseFromVolume = (volumeMl: number) => {
    const conc = selectedFormulation.concentrationMgPerMl;
    if (!conc) return;
    const mgPerDose = volumeMl * conc;
    const basis = selectedMedication.dosingBasis;
    const rate =
      basis === 'mg_per_kg_day'
        ? (mgPerDose * frequencyPerDay) / patient.weightKg
        : basis === 'mg_per_m2_day'
        ? (mgPerDose * frequencyPerDay) / calc.bsaM2
        : basis === 'mg_per_m2_dose'
        ? mgPerDose / calc.bsaM2
        : mgPerDose * frequencyPerDay;
    onChangeDosePerUnit(Math.max(0.001, Math.round(rate * 1000) / 1000));
    onChangeOverrideVolumeMl(null);
  };

  // How far the chosen dose rate is from the medication's usual dose (guards against slips when dragging)
  const protocolRatio =
    selectedMedication.defaultDosePerUnit > 0 ? dosePerUnit / selectedMedication.defaultDosePerUnit : 0;

  // Show the arithmetic so the prescriber can see exactly how the measurement becomes a dose
  const perDoseSuffix =
    frequencyPerDay > 1
      ? ` ÷ ${frequencyPerDay} doses = ${calc.rawSingleDoseMg.toFixed(2)} mg per dose`
      : '';
  const doseFormula =
    selectedMedication.dosingBasis === 'mg_per_kg_day'
      ? `${dosePerUnit} ${selectedMedication.doseUnitLabel} × ${patient.weightKg} kg = ${calc.rawDailyDoseMg.toFixed(1)} mg a day${perDoseSuffix}`
      : selectedMedication.dosingBasis === 'mg_per_m2_day'
      ? `${dosePerUnit} ${selectedMedication.doseUnitLabel} × ${calc.bsaM2.toFixed(2)} m² = ${calc.rawDailyDoseMg.toFixed(1)} mg a day${perDoseSuffix}`
      : selectedMedication.dosingBasis === 'mg_per_m2_dose'
      ? `${dosePerUnit} ${selectedMedication.doseUnitLabel} × ${calc.bsaM2.toFixed(2)} m² = ${calc.rawSingleDoseMg.toFixed(2)} mg per dose`
      : `Fixed dose: ${dosePerUnit} mg a day${perDoseSuffix}`;

  const doseAmount = isLiquid
    ? `${calc.targetSingleVolumeMl!.toFixed(2)} mL`
    : `${calc.unitsPerAdministration || 1} × ${selectedFormulation.strengthMg} mg unit`;

  // Things that stop the prescription from being saved, with the step that fixes them
  const blockers: Array<{ text: string; step: number }> = [];
  if (calc.studyLockActive)
    blockers.push({
      text: `${firstName} is in the ${patient.activeStudyId} trial, so the commercial pack can't be prescribed. Choose the sponsor-supplied stock.`,
      step: 1,
    });
  if (volumeMismatch)
    blockers.push({
      text: 'The volume on the syringe doesn’t match the calculated dose. Fix the syringe or change the dose.',
      step: 2,
    });

  const goTo = (s: number) => {
    onStepChange(s);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const steps = [
    { label: 'Medication', summary: selectedMedication.genericName },
    { label: 'Formulation', summary: calc.studyLockActive ? 'Blocked by trial' : calc.conventionRestrictionActive ? 'Not reimbursed' : selectedFormulation.label, warn: calc.studyLockActive || calc.conventionRestrictionActive },
    { label: 'Dose & safety', summary: volumeMismatch ? 'Syringe volume wrong' : `${doseAmount} ${freqWords(calc.renalAdjustedFrequencyPerDay)}`, warn: volumeMismatch },
    { label: 'Review & save', summary: blockers.length ? `${blockers.length} issue(s) to fix` : 'Ready' },
  ];

  return (
    // Two columns: the patient facts pinned on the left on every step, the stepper on the right
    <div className="grid grid-cols-1 lg:grid-cols-[22rem_minmax(0,1fr)] gap-5 items-start">
      <aside className="lg:sticky lg:top-20">
        <DosingBasisPanel
          patient={patient}
          medication={selectedMedication}
          bsaM2={calc.bsaM2}
          onUpdateVitals={onUpdateVitals}
        />
      </aside>

      <div className="bg-white rounded-xl border border-slate-200 min-w-0">
        {/* Stepper — every step stays reachable because a selection always exists */}
        <ol className="grid grid-cols-2 md:grid-cols-4 border-b border-slate-100">
          {steps.map((s, i) => {
            const isActive = i === step;
            const isDone = i < step;
            return (
              <li key={s.label}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  className={`w-full h-full text-left px-4 py-3 flex items-start gap-2.5 border-b-2 transition-colors cursor-pointer ${
                    isActive ? 'border-indigo-600 bg-indigo-50/40' : 'border-transparent hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`mt-0.5 w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : isDone
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-sm font-medium ${isActive ? 'text-slate-900' : 'text-slate-600'}`}>
                      {s.label}
                    </span>
                    <span className={`flex items-center gap-1 text-xs truncate ${s.warn ? 'text-rose-700' : 'text-slate-400'}`}>
                      {s.warn && <AlertOctagon className="w-3 h-3 shrink-0" />}
                      <span className="truncate">{s.summary}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="p-4 sm:p-6">
          {/* STEP 1 — Medication */}
          {step === 0 && (
            <div className="space-y-4">
              <StepHeading
                title="Which medication?"
                hint="Search by drug, brand, indication, ATC code or hospital magistral code (codes starting with !)."
              />
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. prednisolone, Noxafil, !PURI, stem cell transplant…"
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {filteredMedications.length === 0 && (
                <p className="text-sm text-slate-500">No medication matches “{searchQuery}”.</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredMedications.map((med) => {
                  const isSelected = med.id === selectedMedication.id;
                  return (
                    <button
                      key={med.id}
                      type="button"
                      onClick={() => {
                        onSelectMedication(med);
                        goTo(1);
                      }}
                      className={`text-left p-3.5 rounded-lg border transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-slate-900">{med.genericName}</span>
                        {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                      </div>
                      <div className="text-sm text-slate-600 mt-0.5">{med.indicationTag}</div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {med.formulations.map((form) => (
                          <span key={form.id} className="inline-flex items-center gap-1">
                            <FormChip form={form} />
                            <span className="text-[11px] text-slate-500">{formSummary(form).strength}</span>
                          </span>
                        ))}
                        <span className="ml-auto text-[11px] text-slate-400">
                          ATC <span className="font-mono">{med.atcCode}</span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2 — Formulation (supply & reimbursement checks live here) */}
          {step === 1 && (
            <div className="space-y-4">
              <StepHeading
                title={`Which form of ${selectedMedication.genericName}?`}
                hint="Options differ in strength, supply source and who pays. Pick the one that suits the patient and is covered."
              />

              <div className="space-y-2.5">
                {selectedMedication.formulations.map((form) => {
                  const isSelected = form.id === selectedFormulation.id;
                  const supply = supplyLabel(form);
                  const summary = formSummary(form);
                  const code = CODE_PREFIX[form.type];
                  const fit = swallowingFit(form, patient, firstName);
                  return (
                    <div
                      key={form.id}
                      onClick={() => onSelectFormulation(form)}
                      className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-teal-500 ring-1 ring-teal-500 bg-teal-50/40'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 w-4 h-4 shrink-0 rounded-full border-2 ${
                            isSelected ? 'border-teal-600 bg-teal-600 ring-2 ring-inset ring-white' : 'border-slate-300'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          {/* Form + strength is what separates the options; the full product name follows */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <FormChip form={form} />
                              <span className="text-base font-semibold text-slate-900">{summary.strength}</span>
                            </div>
                            <Badge tone={formulationTypeTone(form)} title={code.title}>
                              <span className="font-sans opacity-70">{code.prefix}</span>
                              <span className="font-mono">{form.cnkOrCode}</span>
                            </Badge>
                          </div>
                          <div className="text-sm text-slate-600 mt-0.5">{form.label}</div>

                          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                            <span className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${supply.tone === 'warning' ? 'bg-amber-500' : supply.tone === 'trial' ? 'bg-purple-500' : 'bg-emerald-500'}`} />
                              <span className={supply.tone === 'warning' ? 'text-amber-800' : 'text-slate-700'}>{supply.label}</span>
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="text-slate-500">Paid by</span>
                              <span className={reimbursementTextClass(form)}>{form.reimbursementTitle}</span>
                            </span>
                          </div>
                          {fit && (
                            <div className={`mt-1.5 text-xs flex items-center gap-1.5 ${fit.tone === 'warning' ? 'text-amber-800' : 'text-slate-600'}`}>
                              <Info className="w-3.5 h-3.5 shrink-0" />
                              {fit.text}
                            </div>
                          )}

                          {isSelected && !calc.conventionRestrictionActive && (
                            <div className="mt-3 space-y-2">
                              {form.pharmacistExpertTip && (
                                <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-950 leading-relaxed">
                                  <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
                                  <div>
                                    <span className="font-semibold">Pharmacist’s note: </span>
                                    {form.pharmacistExpertTip}
                                  </div>
                                </div>
                              )}
                              <p className="text-xs text-slate-600 leading-relaxed">
                                <span className="text-slate-500">Coverage: </span>
                                {form.reimbursementDetails}
                              </p>
                              {form.magistralRecipeSummary && (
                                <details className="text-xs text-slate-600" onClick={(e) => e.stopPropagation()}>
                                  <summary className="cursor-pointer select-none text-slate-500 hover:text-slate-800">
                                    Pharmacy recipe & storage
                                  </summary>
                                  <div className="mt-1.5 p-2.5 rounded-md bg-white border border-slate-200">
                                    <div className="font-mono text-slate-700">{form.magistralRecipeSummary}</div>
                                    {form.storageAndShelfLife && (
                                      <div className="text-slate-500 mt-1">Storage: {form.storageAndShelfLife}</div>
                                    )}
                                  </div>
                                </details>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {calc.studyLockActive && (
                <Alert
                  tone="trial"
                  icon={Lock}
                  title={`Not allowed: ${firstName} is in the ${patient.activeStudyId} trial`}
                  details={calc.studyLockAlert}
                  action={
                    impForm && (
                      <Button variant="primary" onClick={() => onSelectFormulation(impForm)}>
                        Use free trial stock ({impForm.cnkOrCode})
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    )
                  }
                >
                  The trial sponsor supplies this drug for free. Prescribing the commercial pack would be billed
                  wrongly, so it’s blocked.
                </Alert>
              )}

              {calc.conventionRestrictionActive && (
                <Alert
                  tone="danger"
                  icon={AlertOctagon}
                  title={`Not reimbursed for ${firstName} without special approval`}
                  details={calc.conventionAlert}
                  action={
                    tabForm && (
                      <Button
                        variant="primary"
                        onClick={() => {
                          onSelectFormulation(tabForm);
                          setShowBijlageAModal(true);
                        }}
                      >
                        Switch to the reimbursed tablets & open the Chapter IV form
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    )
                  }
                >
                  This form is only covered through the Belgian Pediatric Oncology Convention. Without that
                  approval the family pays out of pocket.
                  {tabForm && <> The reimbursed alternative is <strong>{tabForm.label}</strong>.</>}
                </Alert>
              )}

              {calc.rizivChapterIvActive && !calc.studyLockActive && (
                <Alert
                  tone="warning"
                  icon={FileText}
                  title="Needs a Chapter IV reimbursement request"
                  action={
                    <Button onClick={() => setShowBijlageAModal(true)}>
                      <FileText className="w-3.5 h-3.5" />
                      Open the pre-filled form (Bijlage A)
                    </Button>
                  }
                >
                  RIZIV only reimburses this after the prescriber submits the Bijlage A form. We’ve filled it in
                  from the patient record.
                </Alert>
              )}
            </div>
          )}

          {/* STEP 3 — Dose & safety checks */}
          {step === 2 && (
            <div className="space-y-4">
              <StepHeading
                title="Set the dose"
                hint={<>Enter the dose from the treatment protocol. Guideline: {selectedMedication.guidelineSource}</>}
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <NumberField
                  label="Dose"
                  hint="per the protocol"
                  unit={selectedMedication.doseUnitLabel}
                  value={dosePerUnit}
                  step={0.05}
                  min={0.05}
                  onChange={(v) => onChangeDosePerUnit(Math.max(0.05, parseFloat(v) || 0.05))}
                />
                <NumberField
                  label="Doses per day"
                  hint={
                    calc.renalAdjustedFrequencyPerDay !== frequencyPerDay
                      ? `reduced to ${calc.renalAdjustedFrequencyPerDay} for kidney function`
                      : 'how often it’s given'
                  }
                  hintWarn={calc.renalAdjustedFrequencyPerDay !== frequencyPerDay}
                  value={frequencyPerDay}
                  step={1}
                  min={1}
                  max={6}
                  onChange={(v) => onChangeFrequencyPerDay(Math.max(1, parseInt(v, 10) || 1))}
                />
                <NumberField
                  label="Duration"
                  hint="length of the course"
                  unit="days"
                  value={durationDays}
                  step={1}
                  min={1}
                  max={180}
                  onChange={(v) => onChangeDurationDays(Math.max(1, parseInt(v, 10) || 1))}
                />
              </div>

              <div className="rounded-lg bg-slate-900 text-white p-4">
                <div className="mb-2 text-xs font-mono text-slate-400">{doseFormula}</div>
                <div className="text-lg">
                  Give <span className="font-mono font-semibold text-teal-300">{doseAmount}</span>{' '}
                  <span className="text-slate-300">({calc.clampedSingleDoseMg.toFixed(2)} mg)</span>{' '}
                  {freqWords(calc.renalAdjustedFrequencyPerDay)} for {durationDays} days
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Calculated with fixed clinical rules from {firstName}’s measurements — not AI-generated.
                </div>
                <dl className="mt-3 pt-3 border-t border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <dt className="text-slate-400">Before safety limits</dt>
                    <dd className={`font-mono ${calc.isHardCapped ? 'line-through text-rose-400' : ''}`}>
                      {calc.rawSingleDoseMg.toFixed(2)} mg per dose
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Total per day</dt>
                    <dd className="font-mono">{calc.renalAdjustedDailyDoseMg.toFixed(1)} mg</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Strength</dt>
                    <dd className="font-mono">
                      {selectedFormulation.concentrationMgPerMl
                        ? `${selectedFormulation.concentrationMgPerMl} mg per mL`
                        : `${selectedFormulation.strengthMg} mg per unit`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Whole course</dt>
                    <dd className="font-mono">
                      {calc.totalCourseMg.toFixed(0)} mg
                      {calc.totalCourseMl ? ` (${calc.totalCourseMl.toFixed(1)} mL)` : ''} ·{' '}
                      {calc.packagesRequired} pack{calc.packagesRequired === 1 ? '' : 's'}
                    </dd>
                  </div>
                </dl>
              </div>

              <DoseCeilingChart
                patient={patient}
                medication={selectedMedication}
                formulation={selectedFormulation}
                dosePerUnit={dosePerUnit}
                frequencyPerDay={frequencyPerDay}
              />

              {isLiquid && calc.isTenFoldVolumeError && calc.enteredVolumeMl !== null && (
                <Alert
                  tone="danger"
                  icon={AlertOctagon}
                  title={`Stop: the syringe volume is ${(calc.volumeDiscrepancyRatio ?? 1) >= 1 ? `${calc.volumeDiscrepancyRatio}× too high` : 'far too low'}`}
                  details={calc.volumeGuardrailMessage}
                >
                  {calc.enteredVolumeMl.toFixed(2)} mL was entered, which is{' '}
                  {(calc.enteredVolumeMl * selectedFormulation.concentrationMgPerMl!).toFixed(1)} mg. The correct
                  dose for {firstName} is <strong>{calc.targetSingleVolumeMl!.toFixed(2)} mL</strong> (
                  {calc.clampedSingleDoseMg.toFixed(1)} mg). This usually means a misplaced decimal point.
                </Alert>
              )}

              {calc.isHardCapped && (
                <Alert
                  tone="warning"
                  icon={ShieldAlert}
                  title={`Dose lowered to the ${calc.clampedSingleDoseMg.toFixed(2)} mg safety maximum`}
                  details={calc.hardCapMessage}
                >
                  The protocol calculation gave {calc.rawSingleDoseMg.toFixed(2)} mg, which is above the maximum
                  allowed per dose. The safe maximum is used instead.
                </Alert>
              )}

              {calc.isRenalAdjusted && (
                <Alert
                  tone="info"
                  icon={Info}
                  title="Dosing adjusted for reduced kidney function"
                  details={calc.renalAdjustmentMessage}
                >
                  {firstName}’s creatinine clearance is {patient.crClMlMin} mL/min (50 or below), so the dose is
                  given {freqWords(calc.renalAdjustedFrequencyPerDay)} instead of {freqWords(frequencyPerDay)}.
                </Alert>
              )}

              {isLiquid && (
                <SyringeVisualizer
                  key={`${selectedFormulation.id}:${patient.id}`}
                  targetVolumeMl={calc.targetSingleVolumeMl!}
                  enteredVolumeMl={calc.enteredVolumeMl ?? calc.targetSingleVolumeMl!}
                  concentrationMgPerMl={selectedFormulation.concentrationMgPerMl!}
                  medicationName={selectedMedication.genericName}
                  doseRateLabel={`= ${dosePerUnit} ${selectedMedication.doseUnitLabel}`}
                  onSetDoseVolume={setDoseFromVolume}
                  onChangeEnteredVolume={(val) => onChangeOverrideVolumeMl(val)}
                />
              )}

              {protocolRatio >= 5 && (
                <Alert
                  tone="warning"
                  icon={ShieldAlert}
                  title={`This is ${Math.round(protocolRatio)}× the usual dose — double-check`}
                  action={
                    <Button onClick={() => onChangeDosePerUnit(selectedMedication.defaultDosePerUnit)}>
                      Reset to usual dose ({selectedMedication.defaultDosePerUnit} {selectedMedication.doseUnitLabel})
                    </Button>
                  }
                >
                  {dosePerUnit} {selectedMedication.doseUnitLabel} is far above the usual{' '}
                  {selectedMedication.defaultDosePerUnit} {selectedMedication.doseUnitLabel}. That can be right (e.g. an
                  induction course), but it’s also what a decimal-point slip looks like.
                </Alert>
              )}
              {protocolRatio > 0 && protocolRatio <= 0.2 && (
                <Alert
                  tone="warning"
                  icon={ShieldAlert}
                  title="Much lower than the usual dose — double-check"
                  action={
                    <Button onClick={() => onChangeDosePerUnit(selectedMedication.defaultDosePerUnit)}>
                      Reset to usual dose ({selectedMedication.defaultDosePerUnit} {selectedMedication.doseUnitLabel})
                    </Button>
                  }
                >
                  {dosePerUnit} {selectedMedication.doseUnitLabel} is less than a fifth of the usual{' '}
                  {selectedMedication.defaultDosePerUnit} {selectedMedication.doseUnitLabel}.
                </Alert>
              )}

              {calc.taperingSchedule.length > 0 && (
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
                      <CalendarClock className="w-4 h-4 text-indigo-600" />
                      Steroid step-down plan
                    </span>
                    {onNavigateToCaregiverCompanion && (
                      <button
                        type="button"
                        onClick={onNavigateToCaregiverCompanion}
                        className="text-xs font-medium text-indigo-700 hover:underline cursor-pointer"
                      >
                        Open printable calendar for parents →
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-2">
                    Steroids must be reduced gradually, not stopped suddenly. One bar per morning:
                  </p>
                  <TaperingChart schedule={calc.taperingSchedule} />
                </div>
              )}
            </div>
          )}

          {/* STEP 4 — Review & save */}
          {step === 3 && (
            <div className="space-y-4">
              <StepHeading
                title="Review and save"
                hint={
                  activeRole === 'supervisor'
                    ? 'As supervisor you can save and co-sign in one go.'
                    : 'This is saved as a draft. A supervisor must co-sign it before the pharmacy can dispense.'
                }
              />

              {blockers.length > 0 && (
                <Alert tone="danger" icon={AlertOctagon} title="Fix before saving">
                  <ul className="space-y-1 mt-1">
                    {blockers.map((b) => (
                      <li key={b.text} className="flex flex-wrap items-baseline gap-x-2">
                        <span>{b.text}</span>
                        <button
                          type="button"
                          onClick={() => goTo(b.step)}
                          className="font-medium underline cursor-pointer"
                        >
                          Go to {steps[b.step].label.toLowerCase()}
                        </button>
                      </li>
                    ))}
                  </ul>
                </Alert>
              )}

              <dl className="rounded-lg border border-slate-200 divide-y divide-slate-100 text-sm">
                {[
                  ['Patient', `${patient.shortName} · ${patient.ageYears}y · ${patient.weightKg} kg`, null],
                  ['Medication', selectedMedication.genericName, 0],
                  ['Formulation', `${selectedFormulation.label} (${selectedFormulation.cnkOrCode})`, 1],
                  [
                    'Dose',
                    volumeMismatch
                      ? `${calc.enteredVolumeMl!.toFixed(2)} mL entered — should be ${calc.targetSingleVolumeMl!.toFixed(2)} mL`
                      : `${doseAmount} (${calc.clampedSingleDoseMg.toFixed(1)} mg) ${freqWords(calc.renalAdjustedFrequencyPerDay)}`,
                    2,
                  ],
                  ['Duration', `${durationDays} days · ${calc.totalCourseMg.toFixed(0)} mg in total · ${calc.packagesRequired} pack${calc.packagesRequired === 1 ? '' : 's'}`, 2],
                  ['Paid by', selectedFormulation.reimbursementTitle + (calc.rizivChapterIvActive && bijlageSigned ? ' · Bijlage A attached' : ''), 1],
                  ['Sent to', 'UZ Gent Pediatric Clinical & Trial Pharmacy', null],
                ].map(([label, value, editStep]) => (
                  <div key={label as string} className="flex gap-3 px-4 py-2.5">
                    <dt className="w-28 shrink-0 text-slate-500">{label}</dt>
                    <dd className="flex-1 text-slate-900">{value}</dd>
                    {editStep !== null && (
                      <button
                        type="button"
                        onClick={() => goTo(editStep as number)}
                        className="text-xs text-indigo-700 hover:underline cursor-pointer"
                      >
                        Change
                      </button>
                    )}
                  </div>
                ))}
              </dl>

              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer select-none">Instruction text sent with the prescription</summary>
                <div className="mt-1.5 p-2.5 rounded-lg bg-slate-50 font-mono text-slate-700">{posologySummary}</div>
              </details>

              <label className="block">
                <span className="text-sm text-slate-700">Note for the supervisor and pharmacist (optional)</span>
                <textarea
                  rows={2}
                  value={clinicalNote}
                  onChange={(e) => setClinicalNote(e.target.value)}
                  placeholder="e.g. crush the tablet in apple purée as per the PHO protocol"
                  className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </label>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  variant={activeRole === 'supervisor' ? 'secondary' : 'primary'}
                  size="md"
                  disabled={!canSubmit || volumeMismatch || isSubmitting}
                  onClick={() => handleCreateFhirOrder(false)}
                  title="Creates a FHIR ServiceRequest (draft) and a linked pharmacy Task"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? 'Saving…' : 'Save as draft'}
                </Button>
                {activeRole === 'supervisor' && (
                  <Button
                    variant="primary"
                    size="md"
                    disabled={!canSubmit || volumeMismatch || isSubmitting}
                    onClick={() => handleCreateFhirOrder(true)}
                    title="Creates the ServiceRequest, then co-signs it ($approve)"
                  >
                    <FileCheck2 className="w-4 h-4" />
                    Save & co-sign
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Step navigation */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-slate-100">
          {step > 0 ? (
            <Button variant="ghost" size="md" onClick={() => goTo(step - 1)}>
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          ) : (
            <span />
          )}
          {step < steps.length - 1 && (
            <Button variant="primary" size="md" onClick={() => goTo(step + 1)}>
              Next: {steps[step + 1].label}
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* RIZIV Chapter IV Bijlage A Modal (Posaconazole §4460100) */}
      {showBijlageAModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge tone="warning">
                  RIZIV / INAMI Chapter IV · {selectedMedication.rizivChapterIvParagraph || '§4460100'}
                </Badge>
                <h3 className="text-lg font-semibold text-slate-900 mt-2">Reimbursement request (Bijlage A)</h3>
                <p className="text-sm text-slate-500">
                  “Aanvraag om Machtiging tot Vergoeding” for posaconazole — pre-filled from the patient record.
                  Check it, then attach it to the prescription.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBijlageAModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-lg">
              <div>
                <div className="text-xs text-slate-500">Patient (pseudonymised ID)</div>
                <div className="font-medium text-slate-900">{patient.shortName}</div>
                <div className="font-mono text-xs text-slate-600 break-all">{patient.pseudoSsin}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Prescribing specialist</div>
                <div className="font-medium text-slate-900">Prof. Dr. Janssens</div>
                <div className="text-xs text-slate-600">RIZIV 1-98765-43-210 · UZ Gent Kinderhemato-oncologie</div>
              </div>
              <div className="sm:col-span-2 pt-3 border-t border-slate-200">
                <div className="text-xs text-slate-500">What the form states (§4460100 criteria)</div>
                <ul className="mt-1 space-y-1 text-sm text-slate-800 list-disc list-inside">
                  <li>
                    <strong>Why:</strong> prevention of invasive fungal infection (Aspergillus / Candida) in a high-risk
                    hemato-oncology patient ({patient.diagnosis}).
                  </li>
                  <li>
                    <strong>Product:</strong> {selectedFormulation.label} (CNK{' '}
                    <code className="font-mono">{selectedFormulation.cnkOrCode}</code>)
                  </li>
                  <li>
                    <strong>Dose and duration:</strong> {calc.renalAdjustedDailyDoseMg.toFixed(0)} mg a day for{' '}
                    {durationDays} days ({calc.packagesRequired} pack{calc.packagesRequired === 1 ? '' : 's'}).
                  </li>
                  <li>
                    <strong>Pediatric note:</strong> 100 mg tablets crushed in apple purée, as per the UZ Gent PHO
                    drug-level protocol (target trough above 0.7 mg/L).
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bijlageSigned}
                  onChange={(e) => setBijlageSigned(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                Attach the signed form to this prescription
              </label>
              <Button variant="primary" size="md" onClick={() => setShowBijlageAModal(false)}>
                <CheckCircle2 className="w-4 h-4" />
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StepHeading: React.FC<{ title: string; hint?: React.ReactNode }> = ({ title, hint }) => (
  <div>
    <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
    {hint && <p className="text-sm text-slate-500 mt-0.5">{hint}</p>}
  </div>
);

const NumberField: React.FC<{
  label: string;
  hint?: string;
  hintWarn?: boolean;
  unit?: string;
  value: number;
  step: number;
  min: number;
  max?: number;
  onChange: (raw: string) => void;
}> = ({ label, hint, hintWarn, unit, value, step, min, max, onChange }) => (
  <label className="block">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    <div className="mt-1 flex items-center rounded-lg border border-slate-300 focus-within:ring-2 focus-within:ring-indigo-500 bg-white">
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm font-semibold font-mono bg-transparent focus:outline-none"
      />
      {unit && <span className="pr-3 text-xs text-slate-500 whitespace-nowrap">{unit}</span>}
    </div>
    {hint && <span className={`text-xs ${hintWarn ? 'text-sky-700' : 'text-slate-400'}`}>{hint}</span>}
  </label>
);
