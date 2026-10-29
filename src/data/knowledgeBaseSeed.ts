// Caregiver Education Guides (derived from UZ Gent PHO reference PDFs)
// and Self-Learning Pharmacist-Moderated Knowledge Base

export interface CaregiverEducationGuide {
  id: string;
  title: string;
  dutchSubtitle: string;
  sourcePdf: string;
  category: 'liquid_syringe' | 'capsules_tablets' | 'oral_cytostatics' | 'general_safety';
  steps: string[];
  criticalWarnings: string[];
}

export interface CommunityTipEntry {
  id: string;
  medicationId: string;
  medicationName: string;
  submittedByRole: 'Parent / Caregiver' | 'Pediatric Oncology Nurse' | 'Clinical Pharmacist';
  authorDisplay: string;
  tipTitle: string;
  tipText: string;
  aiSafetyScreening: {
    trafficLight: 'green' | 'amber' | 'red';
    badgeText: string;
    pharmacokineticAnalysis: string;
  };
  moderationStatus: 'approved_gold_standard' | 'pending_pharmacist_review' | 'rejected_unsafe';
  submittedByCurrentUser?: boolean; // set for tips submitted in this session, so the submitter can track them
  verifiedByPharmacist?: string;
  upvotes: number;
  createdAt: string;
}

export const UZ_GENT_EDUCATION_GUIDES: CaregiverEducationGuide[] = [
  {
    id: 'guide-liquid-syringe',
    title: 'Administering Oral Liquid Medications via Syringe',
    dutchSubtitle: 'Toedienen van vloeibare medicijnen met een doseerspuitje (UZ Gent KHO)',
    sourcePdf: 'toedienen_van_vloebare_medicijnen.pdf',
    category: 'liquid_syringe',
    steps: [
      'Wash your hands with soap and water and prepare a clean surface.',
      'Shake the medication bottle gently for 10 seconds (unless label says do not shake).',
      'Press the plastic bottle adapter firmly into the neck of the bottle (leave it in place after use).',
      'Push the oral syringe plunger all the way down, then twist/push the tip into the bottle adapter.',
      'Turn the bottle + syringe upside down together. Slowly pull the plunger past your target mark, then push back up to expel any air bubbles until the black ring aligns with your exact mL mark.',
      'Turn the bottle upright FIRST before removing the syringe.',
      'Place the syringe tip gently against the inside of your child’s cheek (buccal pouch) — never squirt directly into the back of the throat.',
      'Wash the oral syringe in warm soapy water, rinse, pull the plunger out, and let air dry.',
    ],
    criticalWarnings: [
      'DECIMAL POINT SAFETY: 0.3 mL is less than half of a 1 mL syringe — NEVER confuse 0.3 mL with 3.0 mL!',
      'Read the dose at the TOP edge of the black rubber plunger ring (closest to the syringe tip).',
    ],
  },
  {
    id: 'guide-oral-cytostatics',
    title: 'Safe Home Handling of Oral Chemotherapy (Cytostatics)',
    dutchSubtitle: 'Orale cytostatica veilig toedienen thuis (UZ Gent KHO)',
    sourcePdf: 'orale_cytostatica_toedienen.pdf',
    category: 'oral_cytostatics',
    steps: [
      'Put on disposable nitrile gloves before touching oral chemotherapy tablets or liquid suspensions (e.g., !PURI Mercaptopurine, Methotrexate, Temozolomide).',
      'Prepare the dose on a wipeable tray or disposable paper mat away from kitchen food prep areas.',
      'If tablets must be dispersed, use the closed-syringe dispersion method in 5–10 mL water rather than open crushing in air.',
      'After giving the medication, place used gloves and tissues in the yellow hazardous waste bag.',
      'For 48 hours after chemotherapy administration, close the toilet lid and flush twice; wear gloves when changing diapers.',
    ],
    criticalWarnings: [
      'Pregnant or breastfeeding family members should NOT handle crushed or liquid oral cytostatics.',
      'If liquid chemotherapy spills on skin, wash immediately with water and soap for 5 minutes.',
    ],
  },
  {
    id: 'guide-capsules-tablets',
    title: 'Opening Capsules, Crushing Tablets & Taste Masking',
    dutchSubtitle: 'Toediening van capsules en tabletten bij kinderen (UZ Gent KHO)',
    sourcePdf: 'toediening_capsulles.pdf & educatie_mantelzorger_medicatie.pdf',
    sourcePdfShort: 'toediening_capsulles.pdf',
    category: 'capsules_tablets',
    steps: [
      'Always check the PediDose formulation card BEFORE crushing any tablet or opening a capsule.',
      'Mix bitter crushed medications into ONE small teaspoon (5 mL) of cold apple purée, chocolate pudding, or Nutella — never mix into a full bowl or full baby bottle (if the child does not finish, the received dose is unknown!).',
      'Have a cold drink or popsicle ready immediately before and after bitter medications (cold numbs taste buds).',
    ],
    criticalWarnings: [
      'Losec MUPS (Omeprazole): tablet may be dispersed in water or apple juice, but the tiny micro-pellets inside must NEVER be chewed or crushed.',
      'Posaconazole 100 mg gastro-resistant tablets: per UZ Gent Pediatric Oncology PK guidance, may be crushed in apple purée when child cannot swallow whole, achieving superior plasma troughs over suspension.',
    ],
  } as CaregiverEducationGuide & { sourcePdfShort?: string },
];

export const INITIAL_COMMUNITY_TIPS: CommunityTipEntry[] = [
  {
    id: 'tip-posa-crushed-pk',
    medicationId: 'med-posaconazole',
    medicationName: 'Posaconazole (Noxafil 100 mg Tablet)',
    submittedByRole: 'Clinical Pharmacist',
    authorDisplay: 'Apr. S. Vanacker (UZ Gent Pediatric Oncology Pharmacy)',
    tipTitle: 'Crushed 100 mg Gastro-Resistant Tablet in Apple Purée Beats Oral Suspension PK',
    tipText:
      'For children (15–30 kg) who cannot swallow the 100 mg Noxafil tablet whole and do not have Belgian Oncology Convention reimbursement for the 40 mg/mL suspension: crushing the 100 mg tablet into 1 tsp of apple purée reliably reaches target trough levels (>0.7 mg/L) even when co-prescribed with Omeprazole.',
    aiSafetyScreening: {
      trafficLight: 'green',
      badgeText: 'GREEN • Validated PK Evidence & RIZIV Chapter IV Compliant',
      pharmacokineticAnalysis:
        'Verified against pediatric TDM literature (Tragiannidis et al. / UZ Gent PHO protocol). Unlike oral suspension (which loses 32% bioavailability with PPIs), the solid dispersion polymer matrix in the 100 mg tablet retains high absorption when crushed.',
    },
    moderationStatus: 'approved_gold_standard',
    verifiedByPharmacist: 'Prof. Apr. De Cock — Gold Standard Clinical Rule',
    upvotes: 48,
    createdAt: '2026-10-15',
  },
  {
    id: 'tip-predni-popsicle',
    medicationId: 'med-prednisolone',
    medicationName: 'Prednisolone / Medrol (!PREDNI)',
    submittedByRole: 'Parent / Caregiver',
    authorDisplay: 'Mother of Lucas (4y, ALL Maintenance)',
    tipTitle: 'Ice Popsicle 60 Seconds Before + 1 tsp Nutella / Cold Apple Purée',
    tipText:
      'Prednisolone liquid (!PREDNI) and crushed Medrol have an intense metallic-bitter aftertaste. Letting our son suck on a fruit water-ice popsicle for 1 minute before the syringe numbs his tongue, followed immediately by a small spoon of chocolate pudding.',
    aiSafetyScreening: {
      trafficLight: 'green',
      badgeText: 'GREEN • Safe Taste-Masking Technique',
      pharmacokineticAnalysis:
        'No pharmacokinetic interaction between Prednisolone/Methylprednisolone and cold fruit ice or small fat/carbohydrate vehicles. Improves gastric tolerance.',
    },
    moderationStatus: 'approved_gold_standard',
    verifiedByPharmacist: 'Apr. S. Vanacker (Approved for Caregiver Companion)',
    upvotes: 63,
    createdAt: '2026-10-18',
  },
  {
    id: 'tip-6mp-milk-separation',
    medicationId: 'med-mercaptopurine',
    medicationName: '6-Mercaptopurine (!PURI 10 mg/mL)',
    submittedByRole: 'Pediatric Oncology Nurse',
    authorDisplay: 'Verpleegkundig Specialist KHO (UZ Gent)',
    tipTitle: 'Evening Bedtime Routine & Xanthine Oxidase Dairy Separation',
    tipText:
      'Give !PURI Mercaptopurine suspension in the evening with water or diluted apple juice at least 1 hour after the evening glass of cow milk so xanthine oxidase in milk does not degrade the dose.',
    aiSafetyScreening: {
      trafficLight: 'green',
      badgeText: 'GREEN • Protects 6-MP Bioavailability',
      pharmacokineticAnalysis:
        'Bovine milk contains high levels of xanthine oxidase which oxidizes 6-MP to inactive 6-thiouric acid in the GI tract. Separating from large milk volumes preserves systemic 6-TGN levels.',
    },
    moderationStatus: 'approved_gold_standard',
    verifiedByPharmacist: 'Apr. S. Vanacker (Approved for Caregiver Companion)',
    upvotes: 39,
    createdAt: '2026-10-21',
  },
  {
    id: 'tip-pending-grapefruit-posa',
    medicationId: 'med-posaconazole',
    medicationName: 'Posaconazole (Noxafil)',
    submittedByRole: 'Parent / Caregiver',
    authorDisplay: 'Caregiver Submission #409 (Pending Moderation)',
    tipTitle: 'Mixing Noxafil suspension into fresh pink grapefruit juice to hide the taste?',
    tipText:
      'Can we mix the afternoon dose of Noxafil suspension into half a glass of pink grapefruit juice because our daughter likes the sour citrus flavor?',
    aiSafetyScreening: {
      trafficLight: 'red',
      badgeText: 'RED DANGER • Severe CYP3A4 / P-gp Interaction (Vincristine & Calcineurin Toxicity)',
      pharmacokineticAnalysis:
        'AI Safety Gate BLOCKED auto-publication: Grapefruit juice irreversibly inhibits intestinal CYP3A4 and P-gp. In pediatric oncology patients receiving Vincristine, Tacrolimus, Ciclosporin, or Ruxolitinib, grapefruit causes severe neurotoxicity and nephrotoxicity. Recommend orange/apple purée instead.',
    },
    moderationStatus: 'pending_pharmacist_review',
    upvotes: 0,
    createdAt: '2026-10-29',
  },
  {
    id: 'tip-pending-omeprazole-milk',
    medicationId: 'med-omeprazole',
    medicationName: 'Omeprazole (Losec MUPS / !OMEPED)',
    submittedByRole: 'Parent / Caregiver',
    authorDisplay: 'Caregiver Submission #412 (Pending Moderation)',
    tipTitle: 'Dissolving Losec MUPS 10 mg tablet in warm milk bottle',
    tipText:
      'We dissolved the Losec MUPS 10 mg tablet in warm milk in his morning bottle so he drinks it easily.',
    aiSafetyScreening: {
      trafficLight: 'amber',
      badgeText: 'AMBER CAUTION • Enteric Coating Degradation in Alkaline Milk',
      pharmacokineticAnalysis:
        'AI Safety Gate FLAGGED: Losec MUPS micro-pellets have an enteric coating that dissolves at pH > 6.0 (warm milk has pH ~6.7). Dissolving MUPS in milk strips the protective coating so gastric acid destroys the Omeprazole. Use slightly acidic apple juice/water, or switch to !OMEPED 2 mg/mL TMF suspension.',
    },
    moderationStatus: 'pending_pharmacist_review',
    upvotes: 1,
    createdAt: '2026-10-29',
  },
];
