export interface MedicationHistoryEntry {
  name: string;
  regimen: string; // Dose, route and frequency as written on the chart
  indication: string;
  status: 'active' | 'prn' | 'stopped';
  startDate: string; // ISO date
  endDate?: string;
  note?: string; // Why it was stopped, or what to watch for when adding new drugs
}

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
  medications: MedicationHistoryEntry[];
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
    medications: [
      {
        name: 'Ciclosporin (Neoral 100 mg/mL oral solution)',
        regimen: '75 mg (0.75 mL) PO twice daily',
        indication: 'GVHD prophylaxis post-HSCT',
        status: 'active',
        startDate: '2026-09-16',
        note: 'CYP3A4 substrate — azoles (posaconazole) and ruxolitinib exposure interact; recheck trough after any change.',
      },
      {
        name: 'Fluconazole (40 mg/mL oral suspension)',
        regimen: '150 mg (3.75 mL) PO once daily',
        indication: 'Antifungal prophylaxis',
        status: 'active',
        startDate: '2026-09-17',
        note: 'Planned switch to posaconazole for mould cover.',
      },
      {
        name: 'Cotrimoxazole (Eusaprim oral suspension)',
        regimen: 'TMP 70 mg PO twice daily, Saturday & Sunday only',
        indication: 'PJP prophylaxis',
        status: 'active',
        startDate: '2026-10-15',
      },
      {
        name: 'Ursodeoxycholic acid',
        regimen: '240 mg PO twice daily',
        indication: 'VOD/SOS prophylaxis',
        status: 'active',
        startDate: '2026-09-10',
      },
      {
        name: 'Paracetamol (Dafalgan Pediatrie 30 mg/mL)',
        regimen: '360 mg (12 mL) PO every 6 h as needed',
        indication: 'Pain / fever',
        status: 'prn',
        startDate: '2026-08-10',
      },
      {
        name: 'Amoxicillin oral suspension',
        regimen: '400 mg PO three times daily',
        indication: 'Otitis media',
        status: 'stopped',
        startDate: '2025-03-04',
        endDate: '2025-03-06',
        note: 'Stopped after maculopapular rash — recorded as allergy.',
      },
    ],
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
    medications: [
      {
        name: 'Cotrimoxazole (Eusaprim oral suspension)',
        regimen: 'TMP 30 mg PO twice daily, Saturday & Sunday only',
        indication: 'PJP prophylaxis',
        status: 'active',
        startDate: '2026-09-29',
      },
      {
        name: 'Fluconazole (40 mg/mL oral suspension)',
        regimen: '72 mg (1.8 mL) PO once daily',
        indication: 'Antifungal prophylaxis',
        status: 'active',
        startDate: '2026-09-29',
        note: 'Chosen over posaconazole/itraconazole because vincristine is given during induction.',
      },
      {
        name: 'Omeprazole (Losec MUPS 10 mg)',
        regimen: '10 mg dispersed in water PO once daily',
        indication: 'Gastric protection on corticosteroids',
        status: 'active',
        startDate: '2026-09-29',
      },
      {
        name: 'Paracetamol (Dafalgan Pediatrie 30 mg/mL)',
        regimen: '180 mg (6 mL) PO every 6 h as needed',
        indication: 'Pain / fever',
        status: 'prn',
        startDate: '2026-09-29',
      },
      {
        name: 'Dexamethasone 1 mg/mL oral solution',
        regimen: '1.6 mg PO twice daily',
        indication: 'Induction corticosteroid',
        status: 'stopped',
        startDate: '2026-09-29',
        endDate: '2026-10-27',
        note: 'Induction course completed — prednisolone taper follows.',
      },
      {
        name: 'Ibuprofen (Nurofen 20 mg/mL suspension)',
        regimen: '120 mg PO every 8 h as needed',
        indication: 'Pain / fever',
        status: 'stopped',
        startDate: '2026-09-30',
        endDate: '2026-10-02',
        note: 'Cancelled — avoid NSAIDs while platelets < 50 ×10⁹/L.',
      },
    ],
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
    medications: [
      {
        name: 'Prednisone',
        regimen: '40 mg – 30 mg – 30 mg PO (100 mg/day), days 1–15 of cycle',
        indication: 'OEPA chemotherapy backbone',
        status: 'active',
        startDate: '2026-10-20',
        endDate: '2026-11-03',
      },
      {
        name: 'Atovaquone (Wellvone 750 mg/5 mL suspension)',
        regimen: '1500 mg (10 mL) PO once daily with food',
        indication: 'PJP prophylaxis (cotrimoxazole not tolerated)',
        status: 'active',
        startDate: '2026-09-05',
      },
      {
        name: 'Omeprazole 20 mg capsule',
        regimen: '20 mg PO once daily',
        indication: 'Gastric protection on corticosteroids',
        status: 'active',
        startDate: '2026-08-20',
      },
      {
        name: 'Ondansetron 8 mg orodispersible tablet',
        regimen: '8 mg PO every 8 h as needed',
        indication: 'Chemotherapy-induced nausea',
        status: 'prn',
        startDate: '2026-08-20',
      },
      {
        name: 'Cotrimoxazole 960 mg tablet',
        regimen: '960 mg PO twice daily, Saturday & Sunday only',
        indication: 'PJP prophylaxis',
        status: 'stopped',
        startDate: '2026-08-20',
        endDate: '2026-09-04',
        note: 'Stopped for GI intolerance — replaced by atovaquone.',
      },
      {
        name: 'Naproxen 250 mg tablet',
        regimen: '250 mg PO twice daily as needed',
        indication: 'Bone pain',
        status: 'stopped',
        startDate: '2026-08-20',
        endDate: '2026-09-12',
        note: 'Stopped when CrCl fell to 42 mL/min — avoid NSAIDs.',
      },
    ],
    rizivConventionEligible: true,
  },
];
