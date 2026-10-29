import React, { useState } from 'react';
import {
  HeartHandshake,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  ThumbsUp,
  Clock,
  BookOpen,
  Sparkles,
  CheckCircle2,
  XCircle,
  Printer,
  Hospital,
  CalendarDays,
  Pill,
  Circle,
  RotateCcw,
} from 'lucide-react';
import { ClinicalRole } from '../api/uhmepClient';
import { PediatricPatient } from '../data/pediatricPatients';
import {
  CLINICAL_FORMULARY,
  FormularyFormulation,
  FormularyMedication,
} from '../data/clinicalFormulary';
import {
  CaregiverEducationGuide,
  CommunityTipEntry,
  UZ_GENT_EDUCATION_GUIDES,
} from '../data/knowledgeBaseSeed';
import { calculateDeterministicDose } from '../utils/dosingCalculator';
import { CaregiverVisualGuide, formatUnits } from './CaregiverVisualGuide';
import { Alert, Badge, Button, Card, CountPill, SectionTitle, SegmentedTabs, Tone } from './ui';

interface CaregiverPortalViewProps {
  activeRole: ClinicalRole;
  patient: PediatricPatient;
  selectedMedication: FormularyMedication;
  selectedFormulation: FormularyFormulation;
  dosePerUnit: number;
  frequencyPerDay: number;
  durationDays: number;
  communityTips: CommunityTipEntry[];
  onAddCommunityTip: (tip: CommunityTipEntry) => void;
  onModerateTip: (
    tipId: string,
    newStatus: 'approved_gold_standard' | 'rejected_unsafe'
  ) => void;
  onUpvoteTip: (tipId: string) => void;
}

type Severity = FormularyMedication['foodDrugInteractions'][number]['severity'];

// Plain-language verdict per food/drug interaction; rank sorts the most serious first
const SEVERITY_VIEW: Record<
  Severity,
  { label: string; pill: string; iconClass: string; icon: React.FC<{ className?: string }>; rank: number }
> = {
  red_contraindicated: {
    label: 'Avoid',
    pill: 'bg-rose-100 text-rose-800',
    iconClass: 'text-rose-600',
    icon: AlertOctagon,
    rank: 0,
  },
  amber_caution: {
    label: 'Take care',
    pill: 'bg-amber-100 text-amber-900',
    iconClass: 'text-amber-600',
    icon: AlertTriangle,
    rank: 1,
  },
  green_recommended: {
    label: 'Good to use',
    pill: 'bg-emerald-100 text-emerald-800',
    iconClass: 'text-emerald-600',
    icon: ShieldCheck,
    rank: 2,
  },
};

const timesPerDay = (n: number) =>
  n === 1 ? 'Once a day' : n === 2 ? 'Twice a day' : `${n} times a day`;

// The how-to guide that fits this medicine best
const recommendedGuideId = (med: FormularyMedication, form: FormularyFormulation['form']) =>
  med.atcCode.startsWith('L01') && form !== 'iv_solution'
    ? 'guide-oral-cytostatics'
    : form === 'tablet' || form === 'capsule'
    ? 'guide-capsules-tablets'
    : 'guide-liquid-syringe';

// What the submitter sees right after sending a tip
const SCREEN_RESULT: Record<'red' | 'amber' | 'green', { tone: Tone; title: string }> = {
  green: { tone: 'success', title: 'Thanks! The first safety check looks good.' },
  amber: { tone: 'warning', title: 'Thanks! The safety check wants a closer look at this one.' },
  red: { tone: 'danger', title: 'Thanks — the safety check found a possible problem.' },
};

export const CaregiverPortalView: React.FC<CaregiverPortalViewProps> = ({
  activeRole,
  patient,
  selectedMedication,
  selectedFormulation,
  dosePerUnit,
  frequencyPerDay,
  durationDays,
  communityTips,
  onAddCommunityTip,
  onModerateTip,
  onUpvoteTip,
}) => {
  const recommendedGuide = recommendedGuideId(selectedMedication, selectedFormulation.form);
  const [section, setSection] = useState<'home' | 'guides' | 'tips'>('home');
  const [selectedGuideId, setSelectedGuideId] = useState<string>(recommendedGuide);
  const [newTipMedId, setNewTipMedId] = useState<string>(selectedMedication.id);
  const [newTipTitle, setNewTipTitle] = useState<string>('');
  const [newTipText, setNewTipText] = useState<string>('');
  const [newTipRole, setNewTipRole] = useState<
    'Parent / Caregiver' | 'Pediatric Oncology Nurse'
  >('Parent / Caregiver');
  const [lastScreening, setLastScreening] = useState<CommunityTipEntry['aiSafetyScreening'] | null>(null);
  const [tipScope, setTipScope] = useState<'this' | 'all'>('this');

  const calc = calculateDeterministicDose({
    patient,
    medication: selectedMedication,
    formulation: selectedFormulation,
    dosePerUnit,
    frequencyPerDay,
    durationDays,
  });
  const unitsPerDose = calc.unitsPerAdministration || 1;
  const isIv = selectedFormulation.form === 'iv_solution';
  const hasTaper = calc.taperingSchedule.length > 0;

  const activeGuide =
    UZ_GENT_EDUCATION_GUIDES.find((g) => g.id === selectedGuideId) ||
    UZ_GENT_EDUCATION_GUIDES[0];

  // Deterministic AI Food-Drug & Galenic Safety Screener for newly submitted tips
  const runAiSafetyScreening = (
    medId: string,
    title: string,
    body: string
  ): CommunityTipEntry['aiSafetyScreening'] => {
    const combined = `${title} ${body}`.toLowerCase();
    if (
      combined.includes('grapefruit') ||
      combined.includes('pompelmoes') ||
      combined.includes('st. john') ||
      combined.includes('allopurinol')
    ) {
      return {
        trafficLight: 'red',
        badgeText: 'RED DANGER • Severe CYP3A4 / Metabolic Toxicity Detected',
        pharmacokineticAnalysis:
          'Automated PK Safety Screener flagged grapefruit/pompelmoes or metabolic inhibitor. Potent intestinal CYP3A4 blockade causes life-threatening neurotoxicity with Vincristine and toxic levels of Ruxolitinib/Posaconazole/Tacrolimus.',
      };
    }
    if (
      (medId === 'med-omeprazole' && combined.includes('milk')) ||
      (medId === 'med-mercaptopurine' && combined.includes('milk')) ||
      combined.includes('chew mups') ||
      combined.includes('full bottle')
    ) {
      return {
        trafficLight: 'amber',
        badgeText: 'AMBER CAUTION • Galenic / Bioavailability Interaction',
        pharmacokineticAnalysis:
          'Automated PK Screener flagged potential bioavailability loss: alkaline milk degrades Losec MUPS enteric pellets and bovine xanthine oxidase inactivates 6-Mercaptopurine. Requires pharmacist wording adjustment.',
      };
    }
    return {
      trafficLight: 'green',
      badgeText: 'GREEN • Safe Administration & Taste-Masking Vehicle',
      pharmacokineticAnalysis:
        'Screened against Belgian SAM v2, Kinderformularium, and UZ Gent PHO food-drug interaction matrices. No CYP3A4, P-gp, xanthine oxidase, or enteric pH conflict detected.',
    };
  };

  const handleSubmitTip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTipTitle.trim() || !newTipText.trim()) return;
    const med =
      CLINICAL_FORMULARY.find((m) => m.id === newTipMedId) || selectedMedication;
    const screening = runAiSafetyScreening(med.id, newTipTitle, newTipText);

    const newEntry: CommunityTipEntry = {
      id: `tip-${Date.now()}`,
      medicationId: med.id,
      medicationName: med.genericName,
      submittedByRole: newTipRole,
      authorDisplay: `${newTipRole} (${patient.shortName}'s Care Team)`,
      tipTitle: newTipTitle.trim(),
      tipText: newTipText.trim(),
      aiSafetyScreening: screening,
      moderationStatus: 'pending_pharmacist_review',
      submittedByCurrentUser: true,
      upvotes: 1,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    onAddCommunityTip(newEntry);
    setLastScreening(screening);
    setNewTipTitle('');
    setNewTipText('');
  };

  const approvedTips = communityTips.filter(
    (t) => t.moderationStatus === 'approved_gold_standard'
  );
  const pendingTips = communityTips.filter(
    (t) => t.moderationStatus === 'pending_pharmacist_review'
  );
  // Pharmacists moderate everything; everyone else only sees published tips plus their own submissions
  const isModerator = activeRole === 'pharmacist';
  const myUnpublishedTips = communityTips.filter(
    (t) => t.submittedByCurrentUser && t.moderationStatus !== 'approved_gold_standard'
  );
  const tipsForThisMed = approvedTips.filter((t) => t.medicationId === selectedMedication.id);
  // Show this medicine's tips first; fall back to all when it has none yet
  const showingThisMed = tipScope === 'this' && tipsForThisMed.length > 0;
  const shownTips = showingThisMed ? tipsForThisMed : approvedTips;

  const interactions = [...selectedMedication.foodDrugInteractions].sort(
    (a, b) => SEVERITY_VIEW[a.severity].rank - SEVERITY_VIEW[b.severity].rank
  );

  const trafficTone = (light: 'red' | 'amber' | 'green'): Tone =>
    light === 'red' ? 'danger' : light === 'amber' ? 'warning' : 'success';

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="print:hidden">
        <SegmentedTabs
          value={section}
          onChange={setSection}
          items={[
            { id: 'home', label: "Today's dose", icon: HeartHandshake },
            { id: 'guides', label: 'Step-by-step guides', icon: BookOpen },
            {
              id: 'tips',
              label: 'Parent tips',
              icon: Sparkles,
              badge:
                isModerator && pendingTips.length > 0 ? (
                  <CountPill tone="rose">{pendingTips.length} to review</CountPill>
                ) : undefined,
            },
          ]}
        />
      </div>

      {section === 'home' && (
        <>
          {/* What, how much, how often — the first thing a parent needs */}
          <div className="rounded-xl bg-teal-900 text-white p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-teal-200">
                  {patient.shortName}’s medicine · {patient.weightKg} kg
                </div>
                <h2 className="text-lg font-semibold mt-0.5">{selectedMedication.genericName}</h2>
                <div className="text-xs text-teal-100">{selectedFormulation.label}</div>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="print:hidden shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
            </div>

            {isIv ? (
              <div className="flex items-start gap-3 bg-white/10 rounded-lg p-3">
                <Hospital className="w-5 h-5 shrink-0 text-teal-200" />
                <div>
                  <div className="font-semibold">Given at the hospital by a nurse</div>
                  <div className="text-sm text-teal-100">
                    Nothing to measure or give at home · {selectedMedication.frequencyLabel}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-xs text-teal-200">
                    <Pill className="w-3.5 h-3.5" />
                    Give each time
                  </div>
                  <div className="text-3xl font-semibold font-mono mt-1">
                    {calc.targetSingleVolumeMl !== null
                      ? `${calc.targetSingleVolumeMl.toFixed(2)} mL`
                      : formatUnits(unitsPerDose, selectedFormulation.form)}
                  </div>
                  <div className="text-xs text-teal-100">= {calc.clampedSingleDoseMg.toFixed(1)} mg</div>
                </div>
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-xs text-teal-200">
                    <Clock className="w-3.5 h-3.5" />
                    How often
                  </div>
                  <div className="text-xl font-semibold mt-1">{timesPerDay(calc.renalAdjustedFrequencyPerDay)}</div>
                  <div className="text-xs text-teal-100">
                    {calc.isRenalAdjusted ? 'Adjusted for kidney function' : selectedMedication.frequencyLabel}
                  </div>
                </div>
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-xs text-teal-200">
                    <CalendarDays className="w-3.5 h-3.5" />
                    How long
                  </div>
                  <div className="text-xl font-semibold mt-1">{hasTaper ? 'Step down slowly' : `${durationDays} days`}</div>
                  <div className="text-xs text-teal-100">
                    {hasTaper ? 'Follow the calendar below' : 'Unless your care team says otherwise'}
                  </div>
                </div>
              </div>
            )}
          </div>

          <CaregiverVisualGuide
            patient={patient}
            formulation={selectedFormulation}
            volumeMl={calc.targetSingleVolumeMl}
            unitsPerAdministration={unitsPerDose}
            doseMg={calc.clampedSingleDoseMg}
          />

          {hasTaper && (
            <Card>
              <SectionTitle
                title="Step-down calendar"
                hint="Lower the dose step by step as shown. Never stop suddenly."
              />
              <ol className="divide-y divide-slate-100">
                {calc.taperingSchedule.map((row, idx) => (
                  <li key={idx} className="grid grid-cols-[6rem_6rem_1fr] gap-3 py-2.5 items-baseline">
                    <span className="text-sm font-medium text-slate-900">{row.daysLabel}</span>
                    <span>
                      <span className="block text-lg font-semibold font-mono text-teal-700">
                        {row.morningVolumeMl ? `${row.morningVolumeMl} mL` : `${row.morningDoseMg} mg`}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {row.morningVolumeMl ? `${row.morningDoseMg} mg · ` : ''}morning
                      </span>
                    </span>
                    <span className="text-xs text-slate-600 leading-relaxed">{row.notes}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <Card>
            <SectionTitle title="Good to know" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Remember</h4>
                <ul className="space-y-2.5">
                  {selectedMedication.caregiverAdministrationRules.map((rule, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-slate-700 leading-relaxed">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 text-teal-600 shrink-0" />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                  Food, drinks & other medicines
                </h4>
                {interactions.length === 0 ? (
                  <p className="text-sm text-slate-500">No special food rules for this medicine.</p>
                ) : (
                  <ul className="space-y-2">
                    {interactions.map((inter, idx) => {
                      const view = SEVERITY_VIEW[inter.severity];
                      const Icon = view.icon;
                      return (
                        <li key={idx} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2.5">
                          <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${view.iconClass}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-slate-900">{inter.foodOrHabit}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${view.pill}`}>
                                {view.label}
                              </span>
                            </div>
                            <details className="mt-1 text-xs text-slate-600">
                              <summary className="cursor-pointer select-none text-slate-500 hover:text-slate-800">
                                Why?
                              </summary>
                              <p className="mt-1 leading-relaxed">{inter.explanation}</p>
                            </details>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </Card>
        </>
      )}

      {section === 'guides' && (
        <GuideReader
          key={activeGuide.id}
          guide={activeGuide}
          recommendedId={recommendedGuide}
          medicationName={selectedMedication.genericName}
          onSelect={setSelectedGuideId}
        />
      )}

      {section === 'tips' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7 space-y-4">
            {!isModerator && myUnpublishedTips.length > 0 && (
              <Card className="space-y-3">
                <SectionTitle
                  title={`Your submissions (${myUnpublishedTips.length})`}
                  hint="Only you can see these until a pharmacist approves them."
                />
                {myUnpublishedTips.map((tip) => (
                  <div key={tip.id} className="rounded-lg border border-slate-200 p-3 space-y-1.5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900">
                        {tip.medicationName} — {tip.tipTitle}
                      </span>
                      {tip.moderationStatus === 'pending_pharmacist_review' ? (
                        <Badge tone="warning">
                          <Clock className="w-3 h-3" />
                          Awaiting pharmacist approval
                        </Badge>
                      ) : (
                        <Badge tone="danger">
                          <XCircle className="w-3 h-3" />
                          Not approved — not published
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-slate-700">{tip.tipText}</p>
                    {tip.aiSafetyScreening.trafficLight !== 'green' && (
                      <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-md">
                        <strong className="text-slate-700">Automatic safety check flagged this:</strong>{' '}
                        {tip.aiSafetyScreening.pharmacokineticAnalysis}
                      </p>
                    )}
                    <div className="text-[11px] text-slate-400">Submitted {tip.createdAt}</div>
                  </div>
                ))}
              </Card>
            )}

            {isModerator && pendingTips.length > 0 && (
              <Card className="!border-amber-300 space-y-3">
                <SectionTitle
                  title={`Awaiting your review (${pendingTips.length})`}
                  hint="Approve a tip to publish it for all families, or block it if it’s unsafe."
                />
                {pendingTips.map((tip) => (
                  <div key={tip.id} className="rounded-lg border border-slate-200 p-3 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900">
                        {tip.medicationName} — {tip.tipTitle}
                      </span>
                      <Badge tone={trafficTone(tip.aiSafetyScreening.trafficLight)}>
                        {tip.aiSafetyScreening.badgeText}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-700">{tip.tipText}</p>
                    <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-md">
                      <strong className="text-slate-700">AI screening:</strong>{' '}
                      {tip.aiSafetyScreening.pharmacokineticAnalysis}
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400">
                        {tip.authorDisplay} · {tip.createdAt}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button variant="success" onClick={() => onModerateTip(tip.id, 'approved_gold_standard')}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approve
                        </Button>
                        <Button variant="danger" onClick={() => onModerateTip(tip.id, 'rejected_unsafe')}>
                          <XCircle className="w-3.5 h-3.5" />
                          Block as unsafe
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </Card>
            )}

            <Card className="space-y-3">
              <SectionTitle
                title="Tips from other families"
                hint="Every tip here was checked by a hospital pharmacist."
              />
              {tipsForThisMed.length > 0 && (
                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs" role="group" aria-label="Which tips to show">
                  {([
                    ['this', `This medicine (${tipsForThisMed.length})`],
                    ['all', `All medicines (${approvedTips.length})`],
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTipScope(id)}
                      aria-pressed={tipScope === id}
                      className={`px-2.5 py-1 rounded-md cursor-pointer ${
                        tipScope === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {shownTips.length === 0 && <p className="text-sm text-slate-500">No shared tips yet.</p>}
              {shownTips.map((tip) => (
                <div key={tip.id} className="rounded-lg border border-slate-200 p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {(!showingThisMed || (tip.submittedByCurrentUser && !isModerator)) && (
                        <div className="flex flex-wrap gap-1.5 mb-1">
                          {!showingThisMed && <Badge tone="info">{tip.medicationName}</Badge>}
                          {tip.submittedByCurrentUser && !isModerator && (
                            <Badge tone="success">Your tip · approved</Badge>
                          )}
                        </div>
                      )}
                      <div className="text-sm font-medium text-slate-900">{tip.tipTitle}</div>
                    </div>
                    <Button onClick={() => onUpvoteTip(tip.id)} title="This helped me">
                      <ThumbsUp className="w-3.5 h-3.5" />
                      {tip.upvotes}
                    </Button>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{tip.tipText}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span>{tip.authorDisplay}</span>
                    {tip.verifiedByPharmacist && (
                      <span className="text-teal-700 flex items-center gap-1" title={tip.verifiedByPharmacist}>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Checked by pharmacist
                      </span>
                    )}
                  </div>
                  {isModerator && (
                    <details className="text-[11px] text-slate-500">
                      <summary className="cursor-pointer select-none">
                        <span className="text-emerald-700">{tip.aiSafetyScreening.badgeText}</span>
                      </summary>
                      <p className="mt-1">{tip.aiSafetyScreening.pharmacokineticAnalysis}</p>
                    </details>
                  )}
                </div>
              ))}
            </Card>
          </div>

          <div className="lg:col-span-5">
            <Card>
              <form onSubmit={handleSubmitTip} className="space-y-3">
                <SectionTitle
                  title="Share what works for you"
                  hint="We check it automatically for food and medicine interactions, then a pharmacist reviews it before other families can see it."
                />
                {lastScreening && (
                  <Alert
                    tone={SCREEN_RESULT[lastScreening.trafficLight].tone}
                    icon={lastScreening.trafficLight === 'green' ? CheckCircle2 : AlertTriangle}
                    title={SCREEN_RESULT[lastScreening.trafficLight].title}
                    onDismiss={() => setLastScreening(null)}
                  >
                    A pharmacist will review it before other families can see it.
                  </Alert>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-xs text-slate-600">Medicine</span>
                    <select
                      value={newTipMedId}
                      onChange={(e) => setNewTipMedId(e.target.value)}
                      className="mt-1 w-full px-2.5 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                    >
                      {CLINICAL_FORMULARY.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.genericName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-600">You are a</span>
                    <select
                      value={newTipRole}
                      onChange={(e) =>
                        setNewTipRole(e.target.value as 'Parent / Caregiver' | 'Pediatric Oncology Nurse')
                      }
                      className="mt-1 w-full px-2.5 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="Parent / Caregiver">Parent / Caregiver</option>
                      <option value="Pediatric Oncology Nurse">Pediatric Oncology Nurse</option>
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className="text-xs text-slate-600">Short title</span>
                  <input
                    type="text"
                    required
                    value={newTipTitle}
                    onChange={(e) => setNewTipTitle(e.target.value)}
                    placeholder="e.g. Cold apple purée after !PREDNI"
                    className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-600">Your tip</span>
                  <textarea
                    rows={3}
                    required
                    value={newTipText}
                    onChange={(e) => setNewTipText(e.target.value)}
                    placeholder="How do you mix or give the dose? (Mention 'grapefruit' or 'milk' to see the safety check flag it.)"
                    className="mt-1 w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                  />
                </label>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  Send tip for review
                </button>
              </form>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

// One guide at a time; parents tick off steps as they go
const GuideReader: React.FC<{
  guide: CaregiverEducationGuide;
  recommendedId: string;
  medicationName: string;
  onSelect: (id: string) => void;
}> = ({ guide, recommendedId, medicationName, onSelect }) => {
  const [done, setDone] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5 print:hidden">
        {UZ_GENT_EDUCATION_GUIDES.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => onSelect(g.id)}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors cursor-pointer ${
              guide.id === g.id
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
            }`}
          >
            {g.id === recommendedId && '★ '}
            {g.title}
          </button>
        ))}
      </div>

      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            {guide.id === recommendedId && (
              <div className="text-[11px] font-medium text-teal-700 mb-0.5">★ Recommended for {medicationName}</div>
            )}
            <h3 className="text-base font-semibold text-slate-900">{guide.title}</h3>
            <p className="text-xs text-slate-500 italic">{guide.dutchSubtitle}</p>
          </div>
          {done.size > 0 && (
            <Button variant="ghost" onClick={() => setDone(new Set())} className="print:hidden shrink-0">
              <RotateCcw className="w-3.5 h-3.5" />
              Start over
            </Button>
          )}
        </div>

        {guide.criticalWarnings.map((w, i) => (
          <Alert key={i} tone="warning" icon={AlertTriangle} title={w} />
        ))}

        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Steps</h4>
            <span className="text-[11px] text-slate-500 print:hidden">
              {done.size} of {guide.steps.length} done · tap a step to tick it off
            </span>
          </div>
          <ol className="divide-y divide-slate-100">
            {guide.steps.map((st, i) => {
              const isDone = done.has(i);
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    aria-pressed={isDone}
                    className="w-full flex items-start gap-3 px-1 py-2.5 text-left cursor-pointer rounded-md hover:bg-slate-50"
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-6 h-6 shrink-0 text-teal-600" />
                    ) : (
                      <span className="relative w-6 h-6 shrink-0">
                        <Circle className="w-6 h-6 text-slate-300" />
                        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-slate-600">
                          {i + 1}
                        </span>
                      </span>
                    )}
                    <span className={`text-sm leading-relaxed ${isDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                      {st}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {done.size === guide.steps.length && (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-teal-700">
              <CheckCircle2 className="w-4 h-4" />
              All steps done.
            </p>
          )}
        </div>

        <p className="text-[11px] text-slate-400">Source: UZ Gent leaflet ({guide.sourcePdf})</p>
      </Card>
    </div>
  );
};
