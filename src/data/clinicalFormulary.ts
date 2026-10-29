// Clinical Formulary combining Belgian SAM v2 / CNK packages, Farmastatus availability,
// UZ Gent Hospital Magistral (!CODE) formulations, RIZIV Chapter IV & Pediatric Oncology Convention rules,
// and Kinderformularium / PedMed / UZ Gent PHO SCT Dosing Guidelines.

export type DosingBasis = 'mg_per_kg_day' | 'mg_per_m2_day' | 'mg_per_m2_dose' | 'fixed_tier';

export interface FormularyFormulation {
  id: string;
  label: string;
  type: 'commercial_sam' | 'hospital_magistral' | 'clinical_trial_imp';
  cnkOrCode: string; // Belgian 7-digit CNK or UZ Gent !CODE or Trial IMP ID
  snomedCode: string;
  form: 'oral_liquid' | 'tablet' | 'capsule' | 'iv_solution' | 'mouthwash';
  concentrationMgPerMl?: number; // For liquids
  strengthMg?: number; // For solid units
  packageSizeLabel: string;
  packageTotalMg: number;
  farmastatus: 'available' | 'shortage_warning' | 'unavailable_belgium' | 'hospital_compounded' | 'trial_sponsor_stock';
  farmastatusNote: string;
  reimbursementCategory: 'riziv_cat_a' | 'riziv_cat_b' | 'riziv_chapter_iv' | 'oncology_convention_only' | 'hospital_magistral_tmf' | 'study_sponsor_free';
  reimbursementTitle: string;
  reimbursementDetails: string;
  pharmacistExpertTip?: string;
  magistralRecipeSummary?: string;
  storageAndShelfLife?: string;
}

export interface FormularyMedication {
  id: string;
  genericName: string;
  brandExamples: string[];
  indicationTag: string;
  atcCode: string;
  searchKeywords: string[];
  guidelineSource: string;
  dosingBasis: DosingBasis;
  defaultDosePerUnit: number; // e.g., mg/kg/day or mg/m2/dose
  doseUnitLabel: string; // 'mg/kg/day' | 'mg/m²/day' | 'mg/m²/dose'
  defaultFrequencyPerDay: number;
  frequencyLabel: string;
  maxSingleDoseMg?: number; // Hard ceiling (e.g. Vincristine 2.0 mg)
  maxDailyDoseMg?: number;
  hardCapWarning?: string;
  studyLockProtocol?: string; // e.g. 'HEM-iSmart'
  studyLockMessage?: string;
  rizivChapterIvParagraph?: string; // e.g. '§4460100 (Bijlage A)'
  supportsTaperingSchedule?: boolean;
  renalAdjustmentRule?: {
    crCl50to25: string;
    crCl25to10: string;
    crClBelow10: string;
  };
  caregiverAdministrationRules: string[];
  foodDrugInteractions: Array<{
    foodOrHabit: string;
    severity: 'red_contraindicated' | 'amber_caution' | 'green_recommended';
    explanation: string;
  }>;
  formulations: FormularyFormulation[];
}

export const CLINICAL_FORMULARY: FormularyMedication[] = [
  {
    id: 'med-prednisolone',
    genericName: 'Prednisolone / Methylprednisolone',
    brandExamples: ['!PREDNI (UZ Gent Magistral)', 'Prednisolone EG', 'Medrol'],
    indicationTag: 'ALL Induction / GvHD Prophylaxis & Steroid Tapering',
    atcCode: 'H02AB06',
    searchKeywords: ['prednisolone', 'prednisone', 'medrol', '!predni', 'corticosteroid', 'steroid', 'all', 'gvhd', 'tapering'],
    guidelineSource: 'UZ Gent PHO / Interfant-21 & ALLTogether1 Corticosteroid Guideline',
    dosingBasis: 'mg_per_kg_day',
    defaultDosePerUnit: 0.25, // Default to low-dose tapering/physiological step (e.g. 0.25 mg/kg/day = 3 mg for 12 kg toddler -> 0.3 mL on 10 mg/mL) or 2 mg/kg/day induction
    doseUnitLabel: 'mg/kg/day',
    defaultFrequencyPerDay: 1,
    frequencyLabel: '1x daily (Morning with food)',
    maxDailyDoseMg: 80,
    supportsTaperingSchedule: true,
    caregiverAdministrationRules: [
      'Always use the purple EnFit oral syringe with the press-in bottle adapter.',
      'DOUBLE-CHECK DECIMAL POINT: 0.3 mL is three small ticks on a 1 mL low-dead-space syringe — NEVER draw 3.0 mL (10x overdose!).',
      'Give in the morning with breakfast or milk/apple purée to protect the stomach and mask the bitter aftertaste.',
      'Never stop abruptly after >10 days of therapy; strictly follow the printed step-down tapering calendar.',
    ],
    foodDrugInteractions: [
      {
        foodOrHabit: 'Apple purée / Chocolate pudding / Ora-Sweet',
        severity: 'green_recommended',
        explanation: 'Safe and strongly recommended by pediatric oncology nurses to mask severe steroid bitterness.',
      },
      {
        foodOrHabit: 'Empty stomach (fasting administration)',
        severity: 'amber_caution',
        explanation: 'Increases gastric irritation and gastritis risk; pair with morning meal or Omeprazole prophylaxis.',
      },
    ],
    formulations: [
      {
        id: 'form-predni-10mgml',
        label: 'Prednisolone Concentrated Oral Solution 10 mg/mL (30 mL)',
        type: 'hospital_magistral',
        cnkOrCode: '!PREDNI-10',
        snomedCode: '763158003',
        form: 'oral_liquid',
        concentrationMgPerMl: 10,
        packageSizeLabel: '30 mL amber glass bottle + EnFit adapter',
        packageTotalMg: 300,
        farmastatus: 'hospital_compounded',
        farmastatusNote: 'Compounded in Hospital / Community Pharmacy (High-concentration 10 mg/mL — 10x syringe volume alert active).',
        reimbursementCategory: 'hospital_magistral_tmf',
        reimbursementTitle: 'RIZIV Magistral TMF Reimbursement',
        reimbursementDetails: 'Reimbursed as compounded magistral preparation when prescribed with explicit concentration and Posology.',
        pharmacistExpertTip: 'CRITICAL 10x VOLUME HAZARD: For doses < 5 mg (0.5 mL), supply a 1.0 mL graduated EnFit syringe and highlight the 0.3 mL mark with dosing tape.',
        magistralRecipeSummary: 'Prednisoloni natrii phosphas eq. 10 mg/mL in buffered cherry/syrup vehicle.',
        storageAndShelfLife: 'Store at room temperature (15–25°C). Shelf life: 2 months after opening.',
      },
      {
        id: 'form-predni-5mgml-uzg',
        label: '!PREDNI Prednisolone Siroop 5 mg/mL (UZ Gent EPD Tekstbouwsteen)',
        type: 'hospital_magistral',
        cnkOrCode: '!PREDNI',
        snomedCode: '763158003',
        form: 'oral_liquid',
        concentrationMgPerMl: 5,
        packageSizeLabel: '100 mL bottle (500 mg total)',
        packageTotalMg: 500,
        farmastatus: 'hospital_compounded',
        farmastatusNote: 'Standard UZ Gent PHO Tekstbouwsteen (!PREDNI) — compounded by community or hospital pharmacist.',
        reimbursementCategory: 'hospital_magistral_tmf',
        reimbursementTitle: 'UZ Gent !PREDNI Magistral Formula',
        reimbursementDetails: 'Standardized hospital-to-community pharmacy magistral recipe (!PREDNI 5 mg/mL).',
        magistralRecipeSummary: 'Prednisolon 500 mg, Sirupus simplex / Ora-Blend ad 100 mL (5 mg/mL).',
        storageAndShelfLife: 'Store below 25°C, protect from light. Discard 60 days after compounding.',
      },
      {
        id: 'form-medrol-4mg-tab',
        label: 'Medrol (Methylprednisolone) 4 mg Scored Tablets (30x)',
        type: 'commercial_sam',
        cnkOrCode: '0055913',
        snomedCode: '372586001',
        form: 'tablet',
        strengthMg: 4,
        packageSizeLabel: '30 tablets × 4 mg (CNK 0055913)',
        packageTotalMg: 120,
        farmastatus: 'available',
        farmastatusNote: 'In stock across Belgian wholesalers (SAM v2 active).',
        reimbursementCategory: 'riziv_cat_b',
        reimbursementTitle: 'RIZIV Category B (Standard Recip-e)',
        reimbursementDetails: 'Directly reimbursed via Recip-e without prior advisor authorization.',
        pharmacistExpertTip: 'Tablets are extremely bitter when crushed. Mix crushed tablet immediately into 1 teaspoon of cold apple purée or Nutella.',
      },
    ],
  },
  {
    id: 'med-posaconazole',
    genericName: 'Posaconazole (Noxafil)',
    brandExamples: ['Noxafil 100 mg Maagsapresistente Tabletten', 'Noxafil 40 mg/mL Orale Suspensie'],
    indicationTag: 'Invasive Mould / Aspergillus Prophylaxis (HSCT / AML / GvHD)',
    atcCode: 'J02AC04',
    searchKeywords: ['posaconazole', 'noxafil', 'antifungal', 'aspergillus', 'schimmel', 'chapter iv', 'bijlage a', 'convention'],
    guidelineSource: 'UZ Gent PHO SCT Prophylaxis & Belgian Pediatric Oncology Convention / RIZIV §4460100',
    dosingBasis: 'mg_per_kg_day',
    defaultDosePerUnit: 8.33, // ~200 mg/day for a 24 kg child (or 4-6 mg/kg/dose)
    doseUnitLabel: 'mg/kg/day',
    defaultFrequencyPerDay: 1,
    frequencyLabel: '1x daily (Tablets) or 3x daily with fatty meal (Suspension)',
    maxDailyDoseMg: 300,
    rizivChapterIvParagraph: 'Chapter IV §4460100 (Bijlage A — Posaconazole)',
    caregiverAdministrationRules: [
      'Oral suspension (40 mg/mL) MUST be given during or immediately after a full meal or nutritional supplement to ensure absorption.',
      'Gastro-resistant 100 mg tablets achieve superior and more reliable plasma levels (target > 0.7 mg/L prophylaxis).',
      'Per UZ Gent Pediatric Clinical Pharmacy PK protocol: when children cannot swallow whole 100 mg tablets, crushed gastro-resistant tablets mixed in soft food still reach therapeutic trough levels reliably compared to suspension.',
    ],
    foodDrugInteractions: [
      {
        foodOrHabit: 'Grapefruit juice & Seville oranges',
        severity: 'red_contraindicated',
        explanation: 'Potent CYP3A4 conflict — unpredictable azole & Vincristine/calcineurin inhibitor toxicity!',
      },
      {
        foodOrHabit: 'Full meal / High-fat yogurt (especially with Suspension)',
        severity: 'green_recommended',
        explanation: 'Increases oral Posaconazole suspension bioavailability up to 4-fold.',
      },
      {
        foodOrHabit: 'Proton Pump Inhibitors (Omeprazole) with Oral Suspension',
        severity: 'amber_caution',
        explanation: 'Gastric acid suppression reduces absorption of Noxafil ORAL SUSPENSION by ~32%. Prefer 100 mg Tablets if co-prescribing Omeprazole!',
      },
    ],
    formulations: [
      {
        id: 'form-posa-40mgml-susp',
        label: 'Noxafil 40 mg/mL Oral Suspension (105 mL)',
        type: 'commercial_sam',
        cnkOrCode: '2349181',
        snomedCode: '421398003',
        form: 'oral_liquid',
        concentrationMgPerMl: 40,
        packageSizeLabel: '105 mL bottle (4,200 mg total • CNK 2349181)',
        packageTotalMg: 4200,
        farmastatus: 'available',
        farmastatusNote: 'Available via SAM v2 — WARNING: Restricted outpatient reimbursement!',
        reimbursementCategory: 'oncology_convention_only',
        reimbursementTitle: 'RESTRICTED: Belgian Pediatric Oncology Convention ONLY',
        reimbursementDetails:
          'Noxafil 40 mg/mL Oral Suspension is NOT reimbursed under standard RIZIV Chapter IV for outpatient community dispensing! Only covered via the Belgian Pediatric Oncology Convention (National Tumor Board application). Otherwise parent faces ~€650 out-of-pocket cost.',
        pharmacistExpertTip:
          'SWITCH ALERT: Unless approved by the National Pediatric Oncology Convention, switch to Posaconazole 100 mg gastro-resistant tablets (reimbursed via RIZIV Chapter IV §4460100 Bijlage A). Clinical PK studies confirm crushed 100 mg tablets achieve target plasma levels in children.',
      },
      {
        id: 'form-posa-100mg-tab',
        label: 'Posaconazole (Noxafil / Generic) 100 mg Gastro-Resistant Tablets (24x)',
        type: 'commercial_sam',
        cnkOrCode: '3184926',
        snomedCode: '421398003',
        form: 'tablet',
        strengthMg: 100,
        packageSizeLabel: '24 tablets × 100 mg (CNK 3184926)',
        packageTotalMg: 2400,
        farmastatus: 'available',
        farmastatusNote: 'Available in community & hospital pharmacies (SAM v2 active).',
        reimbursementCategory: 'riziv_chapter_iv',
        reimbursementTitle: 'RIZIV Chapter IV §4460100 (Bijlage A Eligible)',
        reimbursementDetails:
          'Standard RIZIV Chapter IV reimbursement for Invasive Fungal Infection prophylaxis in HSCT/GvHD/AML patients. Auto-generates Bijlage A form for advising physician.',
        pharmacistExpertTip:
          'EXPERT PK TIP (UZ Gent PHO): Although summary of product characteristics states "do not crush", pediatric TDM data show crushed 100 mg tablets mixed in apple purée achieve reliable therapeutic trough levels (>0.7 mg/L) and are unaffected by Omeprazole co-medication.',
      },
    ],
  },
  {
    id: 'med-ruxolitinib',
    genericName: 'Ruxolitinib (Jakavi)',
    brandExamples: ['Jakavi 5 mg Tablets (IMP Study Stock)', 'Jakavi 10 mg Tablets'],
    indicationTag: 'JAK1/2 Targeted Therapy (HEM-iSmart Trial) / Steroid-Refractory GvHD',
    atcCode: 'L01EJ01',
    searchKeywords: ['ruxolitinib', 'jakavi', 'hem-ismart', 'trial', 'study', 'jak', 'gvhd', 'leukemia'],
    guidelineSource: 'HEM-iSmart Clinical Trial Protocol v4.2 / Pediatric GvHD Guideline',
    dosingBasis: 'mg_per_m2_day',
    defaultDosePerUnit: 10, // ~10 mg/m²/day divided BID (e.g. 5 mg BID for ~0.9 m² child)
    doseUnitLabel: 'mg/m²/day',
    defaultFrequencyPerDay: 2,
    frequencyLabel: '2x daily (every 12 hours)',
    maxDailyDoseMg: 20,
    studyLockProtocol: 'HEM-iSmart',
    studyLockMessage:
      'CLINICAL TRIAL SOURCING LOCK (HEM-iSmart): Ruxolitinib is supplied free of charge by the trial sponsor via the UZ Gent Clinical Trial Pharmacy (IMP stock). Commercial Recip-e e-prescription is BLOCKED to prevent €3,200+ billing to patient/RIZIV and protocol violation.',
    caregiverAdministrationRules: [
      'Dispensed exclusively by the UZ Gent Hospital Clinical Trial Pharmacy in study-labeled bottles.',
      'For children unable to swallow tablets: disperse 5 mg tablet in 10 mL of tap water for 10 minutes and administer immediately via oral syringe.',
      'Return all empty blisters/bottles and unused tablets at the next study visit for IMP accountability.',
    ],
    foodDrugInteractions: [
      {
        foodOrHabit: 'Strong CYP3A4 Inhibitors (Posaconazole / Voriconazole)',
        severity: 'amber_caution',
        explanation: 'Concomitant Posaconazole increases Ruxolitinib AUC — monitor blood counts and consider 50% dose reduction per protocol.',
      },
      {
        foodOrHabit: 'Grapefruit juice',
        severity: 'red_contraindicated',
        explanation: 'Inhibits CYP3A4 metabolism of Ruxolitinib, increasing myelosuppression risk.',
      },
    ],
    formulations: [
      {
        id: 'form-ruxo-imp-5mg',
        label: 'Ruxolitinib (Jakavi) 5 mg Tablets — HEM-iSmart IMP Hospital Trial Stock',
        type: 'clinical_trial_imp',
        cnkOrCode: 'IMP-HEMISMRT-RUX5',
        snomedCode: '703779005',
        form: 'tablet',
        strengthMg: 5,
        packageSizeLabel: '56 tablets × 5 mg (Sponsor IMP Lot #HEM-2026-B)',
        packageTotalMg: 280,
        farmastatus: 'trial_sponsor_stock',
        farmastatusNote: 'Reserved in UZ Gent Clinical Trial Pharmacy (0€ patient cost). Commercial Recip-e blocked.',
        reimbursementCategory: 'study_sponsor_free',
        reimbursementTitle: 'HEM-iSmart Sponsor Provided (Free IMP)',
        reimbursementDetails: '100% funded by study sponsor. Must be routed to Hospital Trial Pharmacy (Task owner: org-uz-gent-pharmacy).',
        pharmacistExpertTip: 'Verify patient study ID on IMP label and log accountability in IWRS before dispensing.',
      },
      {
        id: 'form-ruxo-comm-5mg',
        label: 'Jakavi 5 mg Tablets (Commercial SAM Package — CNK 2948107)',
        type: 'commercial_sam',
        cnkOrCode: '2948107',
        snomedCode: '703779005',
        form: 'tablet',
        strengthMg: 5,
        packageSizeLabel: '56 tablets × 5 mg (CNK 2948107)',
        packageTotalMg: 280,
        farmastatus: 'available',
        farmastatusNote: 'Commercial specialty package — BLOCKED when patient is enrolled in HEM-iSmart.',
        reimbursementCategory: 'riziv_chapter_iv',
        reimbursementTitle: 'Commercial Specialty (Blocked during Active Trial)',
        reimbursementDetails: 'Commercial prescribing is locked by Pharmacist Sourcing Guardrail while patient is active in HEM-iSmart.',
      },
    ],
  },
  {
    id: 'med-vincristine',
    genericName: 'Vincristine Sulfate',
    brandExamples: ['Vincristine Teva 1 mg/mL IV', 'Oncovin'],
    indicationTag: 'ALL / Hodgkin Lymphoma / Wilms Tumor (Hard 2.0 mg Ceiling Guardrail)',
    atcCode: 'L01CA02',
    searchKeywords: ['vincristine', 'oncovin', 'ceiling', 'max dose', '2mg', 'neurotoxicity', 'hodgkin', 'oepa'],
    guidelineSource: 'EuroNet-PHL-C2 / ALLTogether1 & ISMP High-Alert Vinca Alkaloid Standard',
    dosingBasis: 'mg_per_m2_dose',
    defaultDosePerUnit: 1.5, // 1.5 mg/m² single dose -> for BSA > 1.33 m², raw dose exceeds 2.0 mg and MUST be capped at 2.0 mg!
    doseUnitLabel: 'mg/m²/dose',
    defaultFrequencyPerDay: 1,
    frequencyLabel: 'Single Weekly IV Bolus / Minibag (Day 1, 8, 15)',
    maxSingleDoseMg: 2.0,
    maxDailyDoseMg: 2.0,
    hardCapWarning:
      'HARD CEILING ACTIVE (MAX 2.0 mg): Raw BSA calculation exceeds the international pediatric oncology maximum single dose of 2.00 mg. Dose has been deterministically clamped to 2.00 mg to prevent severe peripheral/autonomic neurotoxicity.',
    caregiverAdministrationRules: [
      'FOR INTRAVENOUS USE ONLY (Fatal if given intrathecally — prepared exclusively in 50 mL NaCl 0.9% minibag by Hospital Oncology Pharmacy).',
      'Report any jaw pain, constipation, ptosis (drooping eyelid), or foot-drop/tripping immediately to the oncology team.',
      'Prophylactic Macrogol (Movicol) is recommended to prevent Vincristine-induced paralytic ileus/constipation.',
    ],
    foodDrugInteractions: [
      {
        foodOrHabit: 'Azole Antifungals (Posaconazole / Itraconazole / Voriconazole)',
        severity: 'red_contraindicated',
        explanation: 'Azoles inhibit CYP3A4 & P-gp clearance of Vincristine, precipitating severe neurotoxicity and paralytic ileus. Hold azole 24–48h around Vincristine!',
      },
      {
        foodOrHabit: 'Grapefruit juice',
        severity: 'red_contraindicated',
        explanation: 'CYP3A4 inhibition increases Vincristine exposure and neurotoxicity.',
      },
    ],
    formulations: [
      {
        id: 'form-vincristine-minibag',
        label: 'Vincristine Sulfate 1 mg/mL IV (Compounded in 50 mL 0.9% NaCl Minibag)',
        type: 'hospital_magistral',
        cnkOrCode: '0089417',
        snomedCode: '387126006',
        form: 'iv_solution',
        concentrationMgPerMl: 1,
        packageSizeLabel: '2 mL vial (2.0 mg max) diluted in 50 mL minibag',
        packageTotalMg: 2,
        farmastatus: 'available',
        farmastatusNote: 'Prepared in UZ Gent Cytostatics Cleanroom (ISMP Minibag Standard).',
        reimbursementCategory: 'riziv_cat_a',
        reimbursementTitle: 'RIZIV Category A (100% Oncology Coverage)',
        reimbursementDetails: 'Full hospital oncology coverage.',
        pharmacistExpertTip: 'Enforce 2.00 mg maximum single dose cap regardless of BSA > 1.33 m². Check concomitant azole antifungal pause.',
      },
    ],
  },
  {
    id: 'med-aciclovir',
    genericName: 'Aciclovir (Zovirax)',
    brandExamples: ['Zovirax 80 mg/mL Oral Suspension', 'Aciclovir Sandoz 200 mg / 800 mg Tablets'],
    indicationTag: 'HSV / VZV Viral Prophylaxis Post-HSCT & Leukemia (Renal CrCl Guardrail)',
    atcCode: 'J05AB01',
    searchKeywords: ['aciclovir', 'acyclovir', 'zovirax', 'herpes', 'vzv', 'viral', 'sct', 'prophylaxis', 'renal'],
    guidelineSource: 'UZ Gent PHO SCT Prophylaxis Guideline (<40 kg: 3×250 mg/m²; ≥40 kg: 2×250 mg/m²) + Kinderformularium',
    dosingBasis: 'mg_per_m2_day',
    defaultDosePerUnit: 750, // 3 x 250 mg/m²/day = 750 mg/m²/day (<40 kg) or 2 x 250 mg/m²/day (≥40 kg)
    doseUnitLabel: 'mg/m²/day',
    defaultFrequencyPerDay: 3,
    frequencyLabel: '3x daily (<40 kg: 3 × 250 mg/m²) or 2x daily (≥40 kg: 2 × 250 mg/m²)',
    maxDailyDoseMg: 1600,
    renalAdjustmentRule: {
      crCl50to25: 'CrCl 25–50 mL/min/1.73m²: Extend interval to every 12 hours (2x daily, reduce daily dose by 33%).',
      crCl25to10: 'CrCl 10–25 mL/min/1.73m²: Extend interval to every 24 hours (1x daily, reduce daily dose by 66%).',
      crClBelow10: 'CrCl < 10 mL/min/1.73m²: Reduce single dose by 50% and give every 24 hours.',
    },
    caregiverAdministrationRules: [
      'Shake Zovirax 80 mg/mL oral suspension well before drawing up with the oral syringe.',
      'Ensure abundant fluid intake throughout the day to prevent aciclovir crystal formation in the kidneys.',
      'Can be taken with or without food.',
    ],
    foodDrugInteractions: [
      {
        foodOrHabit: 'Adequate hydration (water / clear fluids)',
        severity: 'green_recommended',
        explanation: 'Essential to prevent renal tubular precipitation, especially in patients receiving ciclosporin/tacrolimus.',
      },
    ],
    formulations: [
      {
        id: 'form-aciclovir-80mgml',
        label: 'Zovirax Forte Oral Suspension 400 mg/5 mL (80 mg/mL • 100 mL)',
        type: 'commercial_sam',
        cnkOrCode: '1192483',
        snomedCode: '372729009',
        form: 'oral_liquid',
        concentrationMgPerMl: 80,
        packageSizeLabel: '100 mL bottle (8,000 mg total • CNK 1192483)',
        packageTotalMg: 8000,
        farmastatus: 'available',
        farmastatusNote: 'Available via SAM v2 (Banana/orange flavor — contains sorbitol).',
        reimbursementCategory: 'riziv_cat_b',
        reimbursementTitle: 'RIZIV Category B (Standard Recip-e)',
        reimbursementDetails: 'Reimbursed across Belgian community pharmacies.',
        pharmacistExpertTip: 'Check sorbitol load if patient has post-SCT GI graft-versus-host disease or diarrhea.',
      },
      {
        id: 'form-aciclovir-200mg-tab',
        label: 'Aciclovir EG 200 mg Dispersible/Scored Tablets (25x)',
        type: 'commercial_sam',
        cnkOrCode: '1482918',
        snomedCode: '372729009',
        form: 'tablet',
        strengthMg: 200,
        packageSizeLabel: '25 tablets × 200 mg (CNK 1482918)',
        packageTotalMg: 5000,
        farmastatus: 'available',
        farmastatusNote: 'Available in community pharmacies.',
        reimbursementCategory: 'riziv_cat_b',
        reimbursementTitle: 'RIZIV Category B',
        reimbursementDetails: 'Standard Recip-e outpatient reimbursement.',
        pharmacistExpertTip: 'Tablets may be dispersed in 50 mL water or crushed in apple purée for older children.',
      },
    ],
  },
  {
    id: 'med-mercaptopurine',
    genericName: '6-Mercaptopurine (6-MP)',
    brandExamples: ['!PURI Mercaptopurine Suspensie 10 mg/mL (UZ Gent)', 'Xaluprine 20 mg/mL', 'Puri-Nethol 50 mg'],
    indicationTag: 'ALL Maintenance Oral Chemotherapy (Cytostatic Handling & Dairy Rule)',
    atcCode: 'L01BB02',
    searchKeywords: ['mercaptopurine', '6-mp', '!puri', 'xaluprine', 'puri-nethol', 'cytostatic', 'maintenance', 'all'],
    guidelineSource: 'UZ Gent EPD !PURI Tekstbouwsteen & orale_cytostatica_toedienen.pdf',
    dosingBasis: 'mg_per_m2_day',
    defaultDosePerUnit: 50, // 50 mg/m²/day once daily in the evening (titrated to WBC/ANC & TPMT/NUDT15)
    doseUnitLabel: 'mg/m²/day',
    defaultFrequencyPerDay: 1,
    frequencyLabel: '1x daily in the evening (Check TPMT/NUDT15 & ANC count)',
    maxDailyDoseMg: 150,
    caregiverAdministrationRules: [
      'ORAL CYTOSTATIC SAFETY (UZ Gent folder): Wear disposable nitrile gloves when drawing up suspension or handling tablets.',
      'Wash hands thoroughly before and after administration; never pregnant caregivers should handle crushed/liquid cytostatics.',
      'Do NOT administer simultaneously with high-xanthine oxidase raw dairy; keep administration timing consistent every evening.',
    ],
    foodDrugInteractions: [
      {
        foodOrHabit: 'Cow milk / Dairy products (Xanthine Oxidase)',
        severity: 'amber_caution',
        explanation: 'Bovine milk contains xanthine oxidase which can degrade oral 6-MP in the gut. Separate by 1 hour before or 2 hours after large milk intake, or maintain strictly consistent habits.',
      },
      {
        foodOrHabit: 'Allopurinol',
        severity: 'red_contraindicated',
        explanation: 'Blocks xanthine oxidase metabolism of 6-MP — causes life-threatening pancytopenia unless 6-MP dose is reduced by 75%!',
      },
    ],
    formulations: [
      {
        id: 'form-puri-uzg-10mgml',
        label: '!PURI Mercaptopurine Suspensie 10 mg/mL (UZ Gent EPD Tekstbouwsteen)',
        type: 'hospital_magistral',
        cnkOrCode: '!PURI',
        snomedCode: '387498007',
        form: 'oral_liquid',
        concentrationMgPerMl: 10,
        packageSizeLabel: '100 mL amber bottle (1,000 mg total • !PURI)',
        packageTotalMg: 1000,
        farmastatus: 'hospital_compounded',
        farmastatusNote: 'Compounded in UZ Gent Hospital Pharmacy cleanroom (!PURI 10 mg/mL — vs commercial Xaluprine 20 mg/mL).',
        reimbursementCategory: 'hospital_magistral_tmf',
        reimbursementTitle: 'UZ Gent !PURI Oncology Magistral',
        reimbursementDetails: 'Prepared in hospital pharmacy cytostatic laminar airflow cabinet; avoids commercial Xaluprine supply delays.',
        pharmacistExpertTip: 'CONCENTRATION ALERT: !PURI is 10 mg/mL whereas commercial Xaluprine is 20 mg/mL! Always verify mg AND mL when transitioning patients.',
        magistralRecipeSummary: 'Mercaptopurinum 1.0 g, Ora-Plus 50 mL, Ora-Sweet ad 100 mL (10 mg/mL).',
        storageAndShelfLife: 'Store at room temperature (<25°C). Shelf life: 35 days. Cytostatic disposal container required.',
      },
      {
        id: 'form-xaluprine-20mgml',
        label: 'Xaluprine 20 mg/mL Oral Suspension (100 mL • CNK 3019486)',
        type: 'commercial_sam',
        cnkOrCode: '3019486',
        snomedCode: '387498007',
        form: 'oral_liquid',
        concentrationMgPerMl: 20,
        packageSizeLabel: '100 mL bottle (2,000 mg total • CNK 3019486)',
        packageTotalMg: 2000,
        farmastatus: 'shortage_warning',
        farmastatusNote: 'Farmastatus: Intermittent distributor delay in Belgium — consider !PURI 10 mg/mL hospital magistral.',
        reimbursementCategory: 'riziv_chapter_iv',
        reimbursementTitle: 'RIZIV Chapter IV Specialty',
        reimbursementDetails: 'Requires Chapter IV authorization for pediatric ALL.',
      },
    ],
  },
  {
    id: 'med-omeprazole',
    genericName: 'Omeprazole',
    brandExamples: ['!OMEPED Omeprazole Suspensie 2 mg/mL TMF', 'Losec MUPS 10 mg / 20 mg'],
    indicationTag: 'Gastric Protection during High-Dose Steroids & Post-HSCT (!OMEPED TMF)',
    atcCode: 'A02BC01',
    searchKeywords: ['omeprazole', '!omeped', 'losec', 'stomach', 'maagbeschermer', 'tmf', 'steroid'],
    guidelineSource: 'UZ Gent PHO SCT Prophylaxis (<10 kg: 2×5 mg; 10–20 kg: 2×10 mg; >20 kg: 2×20 mg) & TMF !OMEPED',
    dosingBasis: 'mg_per_kg_day',
    defaultDosePerUnit: 1.0, // ~1 mg/kg/day divided BID
    doseUnitLabel: 'mg/kg/day',
    defaultFrequencyPerDay: 2,
    frequencyLabel: '2x daily (Morning & Evening 30 min before meals)',
    maxDailyDoseMg: 40,
    caregiverAdministrationRules: [
      'For !OMEPED 2 mg/mL TMF suspension: keep refrigerated (2–8°C) and shake well before each dose.',
      'For Losec MUPS tablets: may be dispersed in non-carbonated water or slightly acidic apple juice/yogurt, but micro-pellets MUST NOT be chewed or crushed!',
    ],
    foodDrugInteractions: [
      {
        foodOrHabit: 'Acidic fruit juice / Apple purée (for MUPS pellets)',
        severity: 'green_recommended',
        explanation: 'Protects the enteric coating of MUPS microgranules during administration.',
      },
      {
        foodOrHabit: 'Milk or carbonated water (for dispersing MUPS)',
        severity: 'red_contraindicated',
        explanation: 'Alkaline milk dissolves the enteric coating of MUPS pellets prematurely, causing stomach acid to destroy Omeprazole.',
      },
    ],
    formulations: [
      {
        id: 'form-omeped-2mgml',
        label: '!OMEPED Omeprazole Suspensie voor Kinderen 2 mg/mL TMF (100 mL)',
        type: 'hospital_magistral',
        cnkOrCode: '!OMEPED',
        snomedCode: '387137007',
        form: 'oral_liquid',
        concentrationMgPerMl: 2,
        packageSizeLabel: '100 mL bottle (200 mg total • TMF !OMEPED)',
        packageTotalMg: 200,
        farmastatus: 'hospital_compounded',
        farmastatusNote: 'Official Belgian Therapeutisch Magistraal Formularium (TMF) pediatric suspension (!OMEPED).',
        reimbursementCategory: 'hospital_magistral_tmf',
        reimbursementTitle: 'RIZIV Official TMF Preparation (100% Reimbursed)',
        reimbursementDetails: 'Reimbursed in any Belgian community pharmacy when prescribed as "Omeprazole suspensie voor kinderen 2 mg/mL TMF".',
        magistralRecipeSummary: 'Omeprazolum 200 mg, Natrii hydrogenocarbonas 8.4 g, Aqua conservans, Menthae pip. aetheroleum ad 100 mL.',
        storageAndShelfLife: 'Store in refrigerator (2–8°C). Shelf life: 4 weeks after compounding.',
      },
      {
        id: 'form-losec-mups-10mg',
        label: 'Losec MUPS 10 mg Dispersible Enteric Tablets (28x • CNK 1528496)',
        type: 'commercial_sam',
        cnkOrCode: '1528496',
        snomedCode: '387137007',
        form: 'tablet',
        strengthMg: 10,
        packageSizeLabel: '28 tablets × 10 mg',
        packageTotalMg: 280,
        farmastatus: 'shortage_warning',
        farmastatusNote: 'Farmastatus: Losec MUPS 10 mg frequently in temporary shortage in Belgium — switch to !OMEPED 2 mg/mL TMF.',
        reimbursementCategory: 'riziv_cat_b',
        reimbursementTitle: 'RIZIV Category B',
        reimbursementDetails: 'Standard reimbursement when in stock.',
      },
    ],
  },
  {
    id: 'med-cotrimoxazole',
    genericName: 'Cotrimoxazole (Sulfamethoxazole + Trimethoprim / Eusaprim)',
    brandExamples: ['Eusaprim Pediatric Suspension 200/40 mg per 5 mL', 'Bactrim Forte 800/160 mg'],
    indicationTag: 'Pneumocystis jirovecii (PJP) Prophylaxis (Intermittent 2–3 Days/Week Schedule)',
    atcCode: 'J01EE01',
    searchKeywords: ['cotrimoxazole', 'bactrim', 'eusaprim', 'smz-tmp', 'trimethoprim', 'pjp', 'pcp', 'weekend'],
    guidelineSource: 'UZ Gent PHO SCT Prophylaxis (5 mg/kg/day TMP in 2 doses on 2 or 3 days/week — max 320 mg TMP/day)',
    dosingBasis: 'mg_per_kg_day',
    defaultDosePerUnit: 5, // 5 mg/kg/day Trimethoprim component (25 mg/kg/day SMZ) divided BID on Sat/Sun (or Mon/Wed/Fri)
    doseUnitLabel: 'mg/kg/day (TMP component)',
    defaultFrequencyPerDay: 2,
    frequencyLabel: '2x daily ONLY on Saturday & Sunday (or Mon/Wed/Fri — PJP Prophylaxis)',
    maxDailyDoseMg: 320, // 320 mg TMP (= 2 Forte tablets/day)
    caregiverAdministrationRules: [
      'INTERMITTENT SCHEDULE ALERT: Give ONLY on the scheduled days (e.g., Saturday & Sunday) — do NOT give every day unless explicitly instructed for acute infection!',
      'Doses are calculated on the Trimethoprim (TMP) component (8 mg TMP + 40 mg SMZ per 1 mL of Eusaprim suspension).',
      'Give with food or milk to minimize nausea.',
    ],
    foodDrugInteractions: [
      {
        foodOrHabit: 'High-Timeline Methotrexate (HD-MTX)',
        severity: 'red_contraindicated',
        explanation: 'HOLD Cotrimoxazole during High-Dose Methotrexate courses — antifolate synergy and decreased renal MTX clearance cause severe mucositis & myelosuppression.',
      },
    ],
    formulations: [
      {
        id: 'form-eusaprim-susp',
        label: 'Eusaprim Pediatric Suspension 40 mg SMZ + 8 mg TMP / mL (100 mL)',
        type: 'commercial_sam',
        cnkOrCode: '0041822',
        snomedCode: '387179001',
        form: 'oral_liquid',
        concentrationMgPerMl: 8, // Expressed in mg TMP/mL to match 5 mg/kg/day TMP dosing
        packageSizeLabel: '100 mL bottle (800 mg TMP / 4,000 mg SMZ • CNK 0041822)',
        packageTotalMg: 800,
        farmastatus: 'available',
        farmastatusNote: 'Available in Belgian pharmacies (SAM v2 active). Concentration: 8 mg TMP / mL.',
        reimbursementCategory: 'riziv_cat_b',
        reimbursementTitle: 'RIZIV Category B (Standard Recip-e)',
        reimbursementDetails: 'Directly reimbursed.',
        pharmacistExpertTip: 'Clearly highlight "SATURDAY & SUNDAY ONLY" on the pharmacy dispensing label to prevent daily overdosing.',
      },
    ],
  },
];

export interface BenchmarkPreset {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  patientId: string;
  medicationId: string;
  formulationId: string;
  dosePerUnit: number;
  durationDays: number;
  overrideVolumeMl?: number; // To demonstrate 10x oral syringe error guardrail (e.g. 3.0 mL vs 0.3 mL)
  clinicalHighlight: string;
}

export const UC2_BENCHMARK_PRESETS: BenchmarkPreset[] = [
  {
    id: 'case-1-hem-ismart',
    badge: 'Case 1 • Trial Lock',
    title: 'HEM-iSmart Trial Drug (Ruxolitinib)',
    subtitle: 'Blocks commercial Recip-e & routes IMP to UZ Gent Trial Pharmacy',
    patientId: 'pat-1001',
    medicationId: 'med-ruxolitinib',
    formulationId: 'form-ruxo-comm-5mg',
    dosePerUnit: 10,
    durationDays: 28,
    clinicalHighlight:
      'Jane Doe (7y) is enrolled in HEM-iSmart. Selecting commercial Jakavi triggers a hard Trial Sourcing Lock preventing €3,200+ improper billing and switches to Sponsor IMP stock.',
  },
  {
    id: 'case-2-posaconazole',
    badge: 'Case 2 • RIZIV vs Convention + PK',
    title: 'Posaconazole Suspension vs. Crushed 100 mg Tablet',
    subtitle: 'Belgian Oncology Convention alert + Crushed Tablet PK & Bijlage A',
    patientId: 'pat-1001',
    medicationId: 'med-posaconazole',
    formulationId: 'form-posa-40mgml-susp',
    dosePerUnit: 8.33,
    durationDays: 28,
    clinicalHighlight:
      'Flags that Noxafil 40 mg/mL Suspension is ONLY reimbursed via the Belgian Pediatric Oncology Convention, recommends switching to 100 mg Gastro-Resistant Tablets (crushed in apple purée per UZ Gent PK data), and auto-fills RIZIV Chapter IV §4460100 Bijlage A.',
  },
  {
    id: 'case-3-prednisolone-10x',
    badge: 'Case 3 • 10x Syringe Guard',
    title: 'Prednisolone 10 mg/mL — 3.0 mL vs 0.3 mL Overdose Trap',
    subtitle: 'Detects 10-fold liquid volume error + SVG Syringe & Tapering Calendar',
    patientId: 'pat-1002',
    medicationId: 'med-prednisolone',
    formulationId: 'form-predni-10mgml',
    dosePerUnit: 0.25, // 0.25 mg/kg/day * 12 kg = 3.0 mg -> 0.3 mL on 10 mg/mL solution!
    durationDays: 21,
    overrideVolumeMl: 3.0, // Simulates assistant typing 3.0 mL instead of 0.3 mL!
    clinicalHighlight:
      'Marc Willems (2y, 12 kg) needs 3.0 mg Prednisolone/day. On a 10 mg/mL solution, the assistant enters 3.0 mL (30 mg = 10x overdose!) instead of 0.3 mL. PediDose catches the 10-fold error and renders the exact 0.3 mL oral syringe plunger.',
  },
  {
    id: 'case-4-vincristine-cap',
    badge: 'Case 4 • 2.0 mg Hard Cap',
    title: 'Vincristine 1.5 mg/m² on 1.66 m² Adolescent',
    subtitle: 'Clamps raw 2.49 mg BSA calculation to 2.00 mg hard ceiling',
    patientId: 'pat-1003',
    medicationId: 'med-vincristine',
    formulationId: 'form-vincristine-minibag',
    dosePerUnit: 1.5,
    durationDays: 1,
    clinicalHighlight:
      'Elena Vandenberg (15y, 60 kg, 166 cm → BSA 1.66 m²) calculated at 1.5 mg/m² yields 2.49 mg. PediDose deterministically clamps the dose at the 2.00 mg neurotoxicity ceiling.',
  },
  {
    id: 'case-5-aciclovir-renal',
    badge: 'Case 5 • Renal & !Magistral',
    title: 'Aciclovir Post-SCT Prophylaxis with CrCl 42 mL/min',
    subtitle: 'UZ Gent PHO weight-tier + Renal CrCl interval adaptation',
    patientId: 'pat-1003',
    medicationId: 'med-aciclovir',
    formulationId: 'form-aciclovir-80mgml',
    dosePerUnit: 500, // >= 40 kg: 2 x 250 mg/m2 = 500 mg/m2/day
    durationDays: 30,
    clinicalHighlight:
      'Demonstrates UZ Gent PHO SCT weight-tier rule (<40 kg vs ≥40 kg) combined with automatic renal interval adjustment for Elena’s reduced CrCl (42 mL/min/1.73m²).',
  },
];
