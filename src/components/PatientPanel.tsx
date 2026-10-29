import React from 'react';
import { AlertTriangle, Check, ChevronDown, Droplets, Lock, Utensils, X } from 'lucide-react';
import { MedicationHistoryEntry, PediatricPatient } from '../data/pediatricPatients';
import { calculateMostellerBsa } from '../utils/dosingCalculator';

type VitalsUpdate = Partial<Pick<PediatricPatient, 'weightKg' | 'heightCm' | 'ageYears' | 'crClMlMin'>>;

interface PatientPanelProps {
  patients: PediatricPatient[];
  selectedPatient: PediatricPatient;
  onSelectPatient: (patientId: string) => void;
  onUpdateVitals: (patientId: string, updates: VitalsUpdate) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const initials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');

const hasAllergy = (p: PediatricPatient) => !p.allergies.some((a) => /none/i.test(a));

const VitalField: React.FC<{
  label: string;
  unit: string;
  value: number;
  step: number;
  min: number;
  max: number;
  warn?: string;
  onChange: (raw: string) => void;
}> = ({ label, unit, value, step, min, max, warn, onChange }) => (
  <label className={`block rounded-lg border px-3 py-2 ${warn ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}>
    <span className="text-[11px] text-slate-500">{label}</span>
    <span className="flex items-baseline gap-1">
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-0 text-base font-semibold text-slate-900 bg-transparent focus:outline-none"
      />
      <span className="text-xs text-slate-400 whitespace-nowrap">{unit}</span>
    </span>
    {warn && <span className="text-[11px] text-amber-800">{warn}</span>}
  </label>
);

// Trial, allergy and swallowing facts as plain sentences — shared by the patient card and the dose step
export const PatientSafetyFacts: React.FC<{ patient: PediatricPatient; compact?: boolean }> = ({
  patient: p,
  compact,
}) => {
  const Item = compact ? 'div' : 'li';
  const itemClass = compact
    ? 'flex gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed'
    : 'flex gap-2.5';
  return (
    <>
      {p.activeStudyId ? (
        <Item className={`${itemClass} ${compact ? '!border-purple-200 !bg-purple-50/60' : ''}`}>
          <Lock className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
          <span>
            Enrolled in <strong>{p.activeStudyId}</strong> — sponsor supplies {p.studySponsorDrugs?.join(', ')};
            commercial prescribing is locked.
          </span>
        </Item>
      ) : null}
      <Item className={`${itemClass} ${compact && hasAllergy(p) ? '!border-rose-200 !bg-rose-50/60' : ''}`}>
        <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${hasAllergy(p) ? 'text-rose-600' : 'text-slate-400'}`} />
        <span>
          {hasAllergy(p) ? (
            <>
              Allergic to <strong>{p.allergies.join(', ')}</strong>
            </>
          ) : (
            'No known allergies'
          )}
        </span>
      </Item>
      <Item className={itemClass}>
        <Utensils className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <span className="text-slate-700">{p.swallowingNote}</span>
      </Item>
    </>
  );
};

const monthYear = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });

const MedicationRow: React.FC<{ med: MedicationHistoryEntry }> = ({ med }) => (
  <li className="py-2 first:pt-0 last:pb-0">
    <div className="flex items-start justify-between gap-2">
      <span className="font-medium text-slate-900">{med.name}</span>
      {med.status === 'prn' && (
        <span className="shrink-0 px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-semibold text-slate-600">
          As needed
        </span>
      )}
    </div>
    <div className="text-slate-600">{med.regimen}</div>
    <div className="text-[11px] text-slate-400">
      {med.indication} ·{' '}
      {med.status === 'stopped' && med.endDate
        ? `${monthYear(med.startDate)} – ${monthYear(med.endDate)}`
        : `since ${monthYear(med.startDate)}`}
    </div>
    {med.note && <div className="mt-0.5 text-[11px] text-amber-800">{med.note}</div>}
  </li>
);

// Medication history list; past entries explain allergies and avoidances, so their notes stay visible
export const MedicationList: React.FC<{ meds: MedicationHistoryEntry[]; emptyText: string }> = ({ meds, emptyText }) => (
  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed">
    {meds.length === 0 ? (
      <div className="text-slate-500">{emptyText}</div>
    ) : (
      <ul className="divide-y divide-slate-100">
        {meds.map((m) => (
          <MedicationRow key={m.name} med={m} />
        ))}
      </ul>
    )}
  </div>
);

// Header trigger + popover card: the single home for patient context, vitals and switching
export const PatientPanel: React.FC<PatientPanelProps> = ({
  patients,
  selectedPatient: p,
  onSelectPatient,
  onUpdateVitals,
  open,
  onOpenChange,
}) => {
  const bsa = calculateMostellerBsa(p.weightKg, p.heightCm);
  const renalWarn = p.crClMlMin <= 50;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className={`flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-lg text-left cursor-pointer transition-colors ${
          open ? 'bg-slate-800' : 'hover:bg-slate-800'
        }`}
        title="Patient details, vitals & switch patient"
      >
        <span className="w-8 h-8 shrink-0 rounded-full bg-slate-700 text-slate-100 text-xs font-semibold flex items-center justify-center">
          {initials(p.shortName)}
        </span>
        <span className="leading-tight min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-medium text-white">
            <span className="truncate max-w-[7rem] sm:max-w-none">{p.shortName}</span>
            {p.activeStudyId && <Lock className="w-3 h-3 text-purple-300 shrink-0" aria-label="Trial lock" />}
            {hasAllergy(p) && <AlertTriangle className="w-3 h-3 text-rose-300 shrink-0" aria-label="Allergy" />}
            {renalWarn && <Droplets className="w-3 h-3 text-amber-300 shrink-0" aria-label="Reduced renal function" />}
          </span>
          <span className="block text-[11px] text-slate-400 whitespace-nowrap">
            {p.ageYears}y · {p.weightKg} kg · BSA {bsa.toFixed(2)}
          </span>
        </span>
        <ChevronDown className={`hidden sm:block w-3.5 h-3.5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-950/30 sm:bg-transparent" onClick={() => onOpenChange(false)} />
          <div className="fixed inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:mt-2 sm:w-[26rem] sm:max-h-[calc(100vh-5rem)] sm:rounded-xl z-50 overflow-y-auto bg-white text-slate-900 shadow-xl border border-slate-200">
            {/* Identity */}
            <div className="p-4 flex items-start gap-3 border-b border-slate-100">
              <span className="w-10 h-10 shrink-0 rounded-full bg-indigo-100 text-indigo-800 text-sm font-semibold flex items-center justify-center">
                {initials(p.shortName)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">
                  {p.shortName} <span className="font-normal text-slate-500">· {p.ageYears}y · {p.sex}</span>
                </div>
                <div className="text-sm text-slate-600">{p.diagnosis}</div>
                <div className="text-xs text-slate-400 mt-0.5">{p.ward}</div>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Vitals drive every dose calculation */}
            <div className="p-4 border-b border-slate-100">
              <div className="text-xs font-medium text-slate-500 mb-2">Vitals · used for all dose calculations</div>
              <div className="grid grid-cols-2 gap-2">
                <VitalField
                  label="Weight"
                  unit="kg"
                  value={p.weightKg}
                  step={0.5}
                  min={2}
                  max={120}
                  onChange={(v) => onUpdateVitals(p.id, { weightKg: Math.max(1, parseFloat(v) || 1) })}
                />
                <VitalField
                  label="Height"
                  unit="cm"
                  value={p.heightCm}
                  step={1}
                  min={40}
                  max={210}
                  onChange={(v) => onUpdateVitals(p.id, { heightCm: Math.max(30, parseFloat(v) || 30) })}
                />
                <VitalField
                  label="Creatinine clearance"
                  unit="mL/min"
                  value={p.crClMlMin}
                  step={1}
                  min={5}
                  max={160}
                  warn={renalWarn ? 'Renal dose adjustments apply (≤ 50)' : undefined}
                  onChange={(v) => onUpdateVitals(p.id, { crClMlMin: Math.max(5, parseInt(v, 10) || 5) })}
                />
                <div
                  className="rounded-lg bg-slate-900 text-white px-3 py-2"
                  title="Mosteller: BSA (m²) = √((height cm × weight kg) / 3600)"
                >
                  <span className="text-[11px] text-slate-400">Body surface area</span>
                  <div className="text-base font-semibold font-mono text-teal-300">{bsa.toFixed(2)} m²</div>
                  <span className="text-[11px] text-slate-400">Mosteller, auto</span>
                </div>
              </div>
            </div>

            {/* Safety-relevant facts as plain sentences */}
            <ul className="p-4 space-y-2.5 text-sm border-b border-slate-100">
              <PatientSafetyFacts patient={p} />
              <li className="text-xs text-slate-500 pl-6.5">
                Protocol: {p.protocol}
                <div className="font-mono break-all mt-0.5" title="eHealth pseudonymised SSIN">
                  {p.pseudoSsin}
                </div>
              </li>
            </ul>

            {/* Switch patient */}
            <div className="p-2">
              <div className="px-2 pt-1 pb-1.5 text-xs font-medium text-slate-500">Switch patient</div>
              {patients.map((other) => {
                const isCurrent = other.id === p.id;
                return (
                  <button
                    key={other.id}
                    type="button"
                    onClick={() => {
                      onSelectPatient(other.id);
                      onOpenChange(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left cursor-pointer ${
                      isCurrent ? 'bg-indigo-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="w-7 h-7 shrink-0 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold flex items-center justify-center">
                      {initials(other.shortName)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium">
                        {other.shortName} <span className="font-normal text-slate-500">· {other.ageYears}y</span>
                      </span>
                      <span className="block text-xs text-slate-500 truncate">{other.diagnosis}</span>
                    </span>
                    {isCurrent && <Check className="w-4 h-4 text-indigo-600" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
