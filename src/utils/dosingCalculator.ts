import { FormularyFormulation, FormularyMedication } from '../data/clinicalFormulary';
import { PediatricPatient } from '../data/pediatricPatients';

export interface TaperingStep {
  phase: string;
  shortLabel: string;
  daysLabel: string;
  startDay: number;
  endDay: number;
  everyOtherDay?: boolean;
  dailyDoseMg: number;
  morningDoseMg: number;
  morningVolumeMl?: number;
  notes: string;
}

export interface DeterministicDoseResult {
  bsaM2: number;
  rawDailyDoseMg: number;
  rawSingleDoseMg: number;
  clampedSingleDoseMg: number;
  clampedDailyDoseMg: number;
  isHardCapped: boolean;
  hardCapMessage: string | null;
  renalAdjustedFrequencyPerDay: number;
  renalAdjustedDailyDoseMg: number;
  isRenalAdjusted: boolean;
  renalAdjustmentMessage: string | null;
  targetSingleVolumeMl: number | null;
  targetDailyVolumeMl: number | null;
  enteredVolumeMl: number | null;
  isTenFoldVolumeError: boolean;
  volumeDiscrepancyRatio: number | null;
  volumeGuardrailMessage: string | null;
  unitsPerAdministration: number | null; // For tablets/capsules
  totalCourseMg: number;
  totalCourseMl: number | null;
  packagesRequired: number;
  studyLockActive: boolean;
  studyLockAlert: string | null;
  conventionRestrictionActive: boolean;
  conventionAlert: string | null;
  rizivChapterIvActive: boolean;
  taperingSchedule: TaperingStep[];
}

/**
 * Mosteller Body Surface Area formula:
 * BSA (m²) = sqrt((heightCm * weightKg) / 3600)
 */
export function calculateMostellerBsa(weightKg: number, heightCm: number): number {
  if (weightKg <= 0 || heightCm <= 0) return 0;
  const bsa = Math.sqrt((heightCm * weightKg) / 3600);
  return Math.round(bsa * 100) / 100;
}

export function calculateDeterministicDose(params: {
  patient: PediatricPatient;
  medication: FormularyMedication;
  formulation: FormularyFormulation;
  dosePerUnit: number;
  frequencyPerDay: number;
  durationDays: number;
  overrideVolumeMl?: number | null;
  customTrialLocks?: Record<string, boolean>;
}): DeterministicDoseResult {
  const {
    patient,
    medication,
    formulation,
    dosePerUnit,
    frequencyPerDay,
    durationDays,
    overrideVolumeMl,
    customTrialLocks,
  } = params;

  const bsaM2 = calculateMostellerBsa(patient.weightKg, patient.heightCm);
  const safeFreq = Math.max(1, frequencyPerDay);

  // 1. Raw dose calculation based on Weight (kg) or BSA (m²)
  let rawDailyDoseMg = 0;
  let rawSingleDoseMg = 0;

  if (medication.dosingBasis === 'mg_per_kg_day') {
    rawDailyDoseMg = dosePerUnit * patient.weightKg;
    rawSingleDoseMg = rawDailyDoseMg / safeFreq;
  } else if (medication.dosingBasis === 'mg_per_m2_day') {
    rawDailyDoseMg = dosePerUnit * bsaM2;
    rawSingleDoseMg = rawDailyDoseMg / safeFreq;
  } else if (medication.dosingBasis === 'mg_per_m2_dose') {
    rawSingleDoseMg = dosePerUnit * bsaM2;
    rawDailyDoseMg = rawSingleDoseMg * safeFreq;
  } else {
    rawDailyDoseMg = dosePerUnit;
    rawSingleDoseMg = rawDailyDoseMg / safeFreq;
  }

  rawDailyDoseMg = Math.round(rawDailyDoseMg * 100) / 100;
  rawSingleDoseMg = Math.round(rawSingleDoseMg * 100) / 100;

  // 2. Hard Ceiling Guardrail (e.g. Vincristine 2.0 mg single-dose cap)
  let clampedSingleDoseMg = rawSingleDoseMg;
  let clampedDailyDoseMg = rawDailyDoseMg;
  let isHardCapped = false;
  let hardCapMessage: string | null = null;

  if (medication.maxSingleDoseMg && clampedSingleDoseMg > medication.maxSingleDoseMg) {
    clampedSingleDoseMg = medication.maxSingleDoseMg;
    clampedDailyDoseMg = Math.round(clampedSingleDoseMg * safeFreq * 100) / 100;
    isHardCapped = true;
    hardCapMessage =
      medication.hardCapWarning ||
      `HARD CEILING ACTIVE: Raw single dose (${rawSingleDoseMg.toFixed(2)} mg) exceeds protocol ceiling of ${medication.maxSingleDoseMg.toFixed(2)} mg. Clamped to ${clampedSingleDoseMg.toFixed(2)} mg.`;
  }

  if (medication.maxDailyDoseMg && clampedDailyDoseMg > medication.maxDailyDoseMg) {
    clampedDailyDoseMg = medication.maxDailyDoseMg;
    clampedSingleDoseMg = Math.round((clampedDailyDoseMg / safeFreq) * 100) / 100;
    isHardCapped = true;
    if (!hardCapMessage) {
      hardCapMessage = `DAILY CEILING ACTIVE: Raw daily dose (${rawDailyDoseMg.toFixed(1)} mg/day) exceeds maximum daily ceiling (${medication.maxDailyDoseMg} mg/day). Clamped to ${clampedDailyDoseMg.toFixed(1)} mg/day.`;
    }
  }

  // 3. Renal Function (CrCl) Interval & Dose Adaptation
  let renalAdjustedFrequencyPerDay = safeFreq;
  let renalAdjustedDailyDoseMg = clampedDailyDoseMg;
  let isRenalAdjusted = false;
  let renalAdjustmentMessage: string | null = null;

  if (medication.renalAdjustmentRule && patient.crClMlMin <= 50) {
    isRenalAdjusted = true;
    if (patient.crClMlMin >= 25) {
      renalAdjustedFrequencyPerDay = Math.min(safeFreq, 2); // q12h
      renalAdjustedDailyDoseMg = Math.round(clampedSingleDoseMg * renalAdjustedFrequencyPerDay * 100) / 100;
      renalAdjustmentMessage = `RENAL GUARDRAIL (CrCl ${patient.crClMlMin} mL/min): ${medication.renalAdjustmentRule.crCl50to25}`;
    } else if (patient.crClMlMin >= 10) {
      renalAdjustedFrequencyPerDay = 1; // q24h
      renalAdjustedDailyDoseMg = Math.round(clampedSingleDoseMg * 100) / 100;
      renalAdjustmentMessage = `RENAL GUARDRAIL (CrCl ${patient.crClMlMin} mL/min): ${medication.renalAdjustmentRule.crCl25to10}`;
    } else {
      renalAdjustedFrequencyPerDay = 1;
      clampedSingleDoseMg = Math.round(clampedSingleDoseMg * 0.5 * 100) / 100;
      renalAdjustedDailyDoseMg = clampedSingleDoseMg;
      renalAdjustmentMessage = `SEVERE RENAL GUARDRAIL (CrCl ${patient.crClMlMin} mL/min): ${medication.renalAdjustmentRule.crClBelow10}`;
    }
  }

  // 4. Liquid Volume (mL) & 10x Oral Syringe Volume Guardrail
  let targetSingleVolumeMl: number | null = null;
  let targetDailyVolumeMl: number | null = null;
  let enteredVolumeMl: number | null = null;
  let isTenFoldVolumeError = false;
  let volumeDiscrepancyRatio: number | null = null;
  let volumeGuardrailMessage: string | null = null;
  let unitsPerAdministration: number | null = null;

  if (formulation.concentrationMgPerMl && formulation.concentrationMgPerMl > 0) {
    targetSingleVolumeMl = Math.round((clampedSingleDoseMg / formulation.concentrationMgPerMl) * 100) / 100;
    targetDailyVolumeMl = Math.round((renalAdjustedDailyDoseMg / formulation.concentrationMgPerMl) * 100) / 100;
    enteredVolumeMl =
      overrideVolumeMl !== undefined && overrideVolumeMl !== null ? overrideVolumeMl : targetSingleVolumeMl;

    if (targetSingleVolumeMl > 0 && enteredVolumeMl !== null) {
      const ratio = enteredVolumeMl / targetSingleVolumeMl;
      volumeDiscrepancyRatio = Math.round(ratio * 100) / 100;
      if (ratio >= 2.0 || ratio <= 0.5) {
        isTenFoldVolumeError = true;
        const enteredMg = Math.round(enteredVolumeMl * formulation.concentrationMgPerMl * 100) / 100;
        volumeGuardrailMessage = `CRITICAL ${volumeDiscrepancyRatio}x SYRINGE VOLUME OVERDOSE DETECTED: Entered volume is ${enteredVolumeMl.toFixed(2)} mL (= ${enteredMg} mg on ${formulation.concentrationMgPerMl} mg/mL solution), whereas the deterministic dose for ${patient.shortName} (${patient.weightKg} kg) is ${clampedSingleDoseMg.toFixed(2)} mg = ${targetSingleVolumeMl.toFixed(2)} mL!`;
      }
    }
  } else if (formulation.strengthMg && formulation.strengthMg > 0) {
    unitsPerAdministration = Math.round((clampedSingleDoseMg / formulation.strengthMg) * 100) / 100;
  }

  // 5. Total course quantity & package calculation
  const totalCourseMg = Math.round(renalAdjustedDailyDoseMg * durationDays * 100) / 100;
  const totalCourseMl =
    targetDailyVolumeMl !== null ? Math.round(targetDailyVolumeMl * durationDays * 100) / 100 : null;
  const packagesRequired =
    formulation.packageTotalMg > 0 ? Math.max(1, Math.ceil(totalCourseMg / formulation.packageTotalMg)) : 1;

  // 6. Clinical Trial Medication Lock (e.g. HEM-iSmart + Ruxolitinib commercial package)
  const lockKey = `${patient.id}:${medication.id}`;
  const isLockedByPharmacistToggle =
    customTrialLocks && lockKey in customTrialLocks
      ? customTrialLocks[lockKey]
      : Boolean(
          patient.activeStudyId &&
            medication.studyLockProtocol &&
            patient.activeStudyId === medication.studyLockProtocol
        );

  const studyLockActive =
    isLockedByPharmacistToggle && formulation.type === 'commercial_sam';
  const studyLockAlert = studyLockActive
    ? medication.studyLockMessage ||
      `Active Clinical Trial Lock (${patient.activeStudyId}): Commercial Recip-e e-prescription is blocked. Switch to Sponsor IMP Hospital Trial Stock.`
    : null;

  // 7. Belgian Pediatric Oncology Convention vs RIZIV Chapter IV check
  const conventionRestrictionActive =
    formulation.reimbursementCategory === 'oncology_convention_only';
  const conventionAlert = conventionRestrictionActive
    ? `${formulation.reimbursementDetails} ${formulation.pharmacistExpertTip || ''}`
    : null;

  const rizivChapterIvActive = formulation.reimbursementCategory === 'riziv_chapter_iv';

  // 8. Corticosteroid Tapering Schedule Generator (if applicable)
  const taperingSchedule: TaperingStep[] = [];
  if (medication.supportsTaperingSchedule) {
    const conc = formulation.concentrationMgPerMl || 10;
    const baseDaily = renalAdjustedDailyDoseMg;
    const step2 = Math.round(baseDaily * 0.5 * 100) / 100;
    const step3 = Math.round(baseDaily * 0.25 * 100) / 100;
    const step4 = Math.round(baseDaily * 0.25 * 100) / 100;

    taperingSchedule.push(
      {
        phase: 'Phase 1 • Full Therapeutic Dose',
        shortLabel: 'Full dose',
        daysLabel: 'Days 1 – 7',
        startDay: 1,
        endDay: 7,
        dailyDoseMg: baseDaily,
        morningDoseMg: baseDaily,
        morningVolumeMl: Math.round((baseDaily / conc) * 100) / 100,
        notes: 'Give full dose every morning with breakfast + gastric protection (!OMEPED).',
      },
      {
        phase: 'Phase 2 • 50% Step-Down',
        shortLabel: '50% dose',
        daysLabel: 'Days 8 – 12',
        startDay: 8,
        endDay: 12,
        dailyDoseMg: step2,
        morningDoseMg: step2,
        morningVolumeMl: Math.round((step2 / conc) * 100) / 100,
        notes: 'Reduce morning syringe volume by 50%. Monitor for lethargy or joint ache.',
      },
      {
        phase: 'Phase 3 • 25% Physiological Dose',
        shortLabel: '25% dose',
        daysLabel: 'Days 13 – 17',
        startDay: 13,
        endDay: 17,
        dailyDoseMg: step3,
        morningDoseMg: step3,
        morningVolumeMl: Math.round((step3 / conc) * 100) / 100,
        notes: 'Quarter dose every morning to allow adrenal axis recovery.',
      },
      {
        phase: 'Phase 4 • Alternate-Day Discontinuation',
        shortLabel: 'Every other day',
        daysLabel: 'Days 18 – 21',
        startDay: 18,
        endDay: 21,
        everyOtherDay: true,
        dailyDoseMg: step4,
        morningDoseMg: step4,
        morningVolumeMl: Math.round((step4 / conc) * 100) / 100,
        notes: 'Give ONLY on alternate mornings (Day 18 & Day 20), then stop on Day 22.',
      }
    );
  }

  return {
    bsaM2,
    rawDailyDoseMg,
    rawSingleDoseMg,
    clampedSingleDoseMg,
    clampedDailyDoseMg,
    isHardCapped,
    hardCapMessage,
    renalAdjustedFrequencyPerDay,
    renalAdjustedDailyDoseMg,
    isRenalAdjusted,
    renalAdjustmentMessage,
    targetSingleVolumeMl,
    targetDailyVolumeMl,
    enteredVolumeMl,
    isTenFoldVolumeError,
    volumeDiscrepancyRatio,
    volumeGuardrailMessage,
    unitsPerAdministration,
    totalCourseMg,
    totalCourseMl,
    packagesRequired,
    studyLockActive,
    studyLockAlert,
    conventionRestrictionActive,
    conventionAlert,
    rizivChapterIvActive,
    taperingSchedule,
  };
}
