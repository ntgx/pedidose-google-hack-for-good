export interface PediatricPatient {
  id: string;
  pseudoSsin: string;
  displayName: string;
  shortName: string;
  ageYears: number;
  sex: 'F' | 'M';
  weightKg: number;
  heightCm: number;
  crClMlMin: number; // Creatinine clearance / eGFR (mL/min/1.73m²)
  diagnosis: string;
  ward: string;
  protocol: string;
  activeStudyId: string | null;
  studyTitle?: string;
  studySponsorDrugs?: string[];
  swallowingStatus: 'liquid_only' | 'crushed_or_liquid' | 'can_swallow_tablets';
  swallowingNote: string;
  allergies: string[];
  rizivConventionEligible: boolean;
}

export const INITIAL_PEDIATRIC_PATIENTS: PediatricPatient[] = [
  {
    id: 'pat-1001',
    pseudoSsin: 'urn:be:fgov:ehealth:pseudo:v1:pat-1001-jane-doe',
    displayName: 'Jane Doe (7y • ALL Maintenance & Post-SCT)',
    shortName: 'Jane Doe',
    ageYears: 7,
    sex: 'F',
    weightKg: 24.0,
    heightCm: 122.0,
    crClMlMin: 95,
    diagnosis: 'Relapsed B-ALL (Post Allogeneic HSCT Day +42)',
    ward: 'UZ Gent — Kinderhemato-oncologie (PHO 5K12)',
    protocol: 'ALLTogether1 / HEM-iSmart Subprotocol B',
    activeStudyId: 'HEM-iSmart',
    studyTitle: 'HEM-iSmart: Molecularly Stratified Targeted Therapy in Relapsed Pediatric Leukemia',
    studySponsorDrugs: ['ruxolitinib', 'venetoclax'],
    swallowingStatus: 'crushed_or_liquid',
    swallowingNote: 'Cannot swallow whole large tablets; accepts oral syringe suspensions or crushed tablets in apple purée.',
    allergies: ['Amoxicillin (maculopapular rash)'],
    rizivConventionEligible: true,
  },
  {
    id: 'pat-1002',
    pseudoSsin: 'urn:be:fgov:ehealth:pseudo:v1:pat-1002-marc-willems',
    displayName: 'Marc Willems (2y • Infant ALL Induction)',
    shortName: 'Marc Willems',
    ageYears: 2,
    sex: 'M',
    weightKg: 12.0,
    heightCm: 86.0,
    crClMlMin: 88,
    diagnosis: 'KMT2A-rearranged Infant Acute Lymphoblastic Leukemia',
    ward: 'UZ Gent — Dagziekenhuis PHO',
    protocol: 'Interfant-21 Induction / Corticosteroid Tapering',
    activeStudyId: null,
    swallowingStatus: 'liquid_only',
    swallowingNote: 'Toddler (2y) — strictly oral liquid / magistral suspension via Purple EnFit oral syringe with bottle adapter.',
    allergies: ['None known (NKDA)'],
    rizivConventionEligible: true,
  },
  {
    id: 'pat-1003',
    pseudoSsin: 'urn:be:fgov:ehealth:pseudo:v1:pat-1003-elena-vandenberg',
    displayName: 'Elena Vandenberg (15y • Adolescent Hodgkin / Vincristine Cap)',
    shortName: 'Elena Vandenberg',
    ageYears: 15,
    sex: 'F',
    weightKg: 60.0,
    heightCm: 166.0,
    crClMlMin: 42, // Mild-to-moderate renal impairment post-cisplatin/ifosfamide to demonstrate renal dosing guardrails
    diagnosis: 'Classic Hodgkin Lymphoma Stage IIIB (EuroNet-PHL-C2)',
    ward: 'UZ Gent — Kinderhemato-oncologie',
    protocol: 'OEPA / DECOP (Vincristine + Prednisone + Antiviral Prophylaxis)',
    activeStudyId: null,
    swallowingStatus: 'can_swallow_tablets',
    swallowingNote: 'Swallows tablets; severe steroid dysgeusia — requires taste masking advice.',
    allergies: ['Trimethoprim-Sulfamethoxazole (GI intolerance)'],
    rizivConventionEligible: true,
  },
];
