/**
 * E-2 canonical document taxonomy.
 *
 * Each entry is a stable, content-defined doc-type. The audit operation maps
 * a classified PDF (by `doc_type_id`) into the proof slots it can fill.
 *
 * Identifying signals are layered:
 *   - filename_regex     — cheapest filter; runs in Tier-0
 *   - keyword_phrases    — substring matching against extracted text
 *   - header_regex       — first-page header patterns
 *   - structural_hints   — coarse layout hints used as tie-breakers
 *
 * Foreign-language equivalents are included for the doc-types that vary
 * across treaty countries (Tapu vs Title Deed, K-bis vs Articles, etc.).
 *
 * Cost target: identifying_signals are designed so >90% of well-named PDFs
 * are classified by Tier-0 (regex+keyword) WITHOUT any LLM call.
 */

import type { DocType } from './types';

// ───────────────────────────────────────────────────────────────────────────
// IDENTITY — passport, visa, I-94, EAD, prior approvals
// ───────────────────────────────────────────────────────────────────────────

const IDENTITY: DocType[] = [
  {
    id: 'passport_bio',
    name: 'Passport biographic page (machine-readable)',
    category: 'identity',
    definition:
      "The biographic data page of a modern ICAO-9303 biometric passport. Distinguished from stamped-pages spread by presence of the two-line ICAO MRZ band at page bottom (highest single signal, near-deterministic) and biographic field block. Layout is ICAO-fixed across treaty countries — only color/emblem differs.",
    identifying_signals: {
      filename_regex: [
        /passport(?!.*full)|pasaport|reisepass|pasaporte|passeport|passaporto|paszport/i,
        /bio.*page|biographic|data.?page|page.?2/i,
      ],
      keyword_phrases: [
        // ICAO biographic field labels per E2_STRUCTURAL_VARIANTS Variant 1.
        'Type/Type',
        'Code of issuing State',
        'Passport No',
        'Passport Number',
        'Surname',
        'Given Names',
        'Nationality',
        'Date of birth',
        'Place of birth',
        'Sex',
        'Date of issue',
        'Date of expiry',
        'Authority',
        // MRZ pattern (two lines starting with P<).
        'P<',
        '<<',
      ],
      structural_hints: [
        'MRZ at bottom (two lines starting with P<)',
        'photo at top-left or top-right',
        'ICAO booklet aspect ratio (~125x88 mm, 1.42:1)',
        'biometric chip icon (gold/silver rectangle)',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Pasaport' },
      de: { native_name: 'Reisepass' },
      fr: { native_name: 'Passeport' },
      it: { native_name: 'Passaporto' },
      ja: { native_name: '旅券 / パスポート' },
      ko: { native_name: '여권' },
      es: { native_name: 'Pasaporte' },
    },
    fills_proof_slots: ['E1.principal_passport', 'E1.foreign_owner_passports', 'DEP.dependent_passports'],
    extractor_skill: 'passport',
    adequacy_criteria: [
      'Validity ≥ 6 months beyond intended stay',
      'MRZ legible and matches printed data',
      'Biographic field block fully visible',
    ],
    primary_authority: '8 CFR 214.2(e)(3); 22 CFR 41.104',
    pii_strip: ['passport_number', 'dob'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'passport_full',
    name: 'Passport stamped/used pages (entry-exit history)',
    category: 'identity',
    definition:
      'Scan of one or more interior passport pages bearing entry/exit stamps, visa foils, and admission stickers. Used to corroborate travel-history claim (renewals, prior status). Distinguished from biographic page by absence of MRZ + biographic field block, and by collage of dated stamps.',
    identifying_signals: {
      filename_regex: [
        /passport.*full|full.*passport|passport.*all|passport.*stamp|visa.?pages|travel.*history|entry.*exit|used.?pages|stamped.?pages/i,
      ],
      keyword_phrases: [
        // Stamp + admission-record vocabulary per E2_STRUCTURAL_VARIANTS Variant 2.
        'Admitted',
        'Departure',
        'CBP',
        'Customs and Border Protection',
        'Port of Entry',
        'Class of Admission',
        'Admit Until',
        'D/S',
        // Visa-foil indicators.
        'Visa',
        'Visa Type',
        'Visa Class',
      ],
      structural_hints: [
        'multiple distinct stamp shapes (rectangular + circular)',
        'absence of MRZ + biographic block',
        'date-stamp density (multiple dates in disparate orientations)',
        'visa-foil rectangle mid-page',
      ],
    },
    fills_proof_slots: ['APP.prior_visas_and_status'],
    extractor_skill: 'passport',
    adequacy_criteria: [
      'All used pages scanned (or relevant entry-exit period)',
      'Stamps legible (date + port + class)',
    ],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'visa_stamp',
    name: 'Consular visa foil (U.S. visa stamp)',
    category: 'identity',
    definition:
      'Full-page sticker affixed inside the passport by a US consulate, bearing photo, MRZ, and class-of-admission. Distinguished from passport biographic page by US-DOS layout (not ICAO booklet) and from I-797 by photo + MRZ on US-format sticker. In E-2 renewal filings the prior E-2 visa is the canonical Tab C exhibit.',
    identifying_signals: {
      // Bare `\bvisa\b` (letter-bounded) covers "Visa issued <date>.jpeg"
      // exports without false-matching "Visage" or "Vista". The strong
      // patterns above stay first so they win on score-equal ties.
      filename_regex: [
        /visa.*stamp|us.*visa|nonimmigrant.*visa|consular.*foil|e.?2.*visa/i,
        /(?<![a-z])visa(?![a-z])/i,
      ],
      keyword_phrases: [
        'UNITED STATES OF AMERICA',
        'NONIMMIGRANT VISA',
        'Department of State',
        'Visa Type/Class',
        'Annotation',
        // Issuing-post field per E2_STRUCTURAL_VARIANTS Variant 1.
        'Issuing Post',
        'Issuing Post Name',
        // Visa class codes commonly seen.
        'E2',
        'E1',
        'L1A',
        'L1B',
        'B1',
        'B2',
        'B1/B2',
        'F1',
        'H1B',
        'O1',
        // Control / visa numbers.
        'Control Number',
        'Visa Number',
      ],
      structural_hints: [
        'green-tinted foil',
        'embossed US emblem',
        'photo top-left + MRZ at bottom',
        'US-format sticker (not ICAO booklet shape)',
      ],
    },
    fills_proof_slots: ['APP.prior_visas_and_status', 'E1.principal_passport'],
    extractor_skill: 'visa-stamp',
    adequacy_criteria: [
      'Foil is U.S.-issued (DOS-formatted)',
      'Visa class and validity dates legible',
      'Issuing post identified',
    ],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'i94',
    name: 'CBP I-94 web printout (post-2013 electronic record)',
    category: 'identity',
    definition:
      'Single-page printout from i94.cbp.dhs.gov of the most recent arrival record. Dominant variant for nearly every modern filing. Distinguished from legacy paper card by web-printout aesthetic (HTML-table rendering), single-arrival fields, and absence of perforation.',
    identifying_signals: {
      filename_regex: [
        /i.?94|i94|arrival.*departure|cbp.*arrival|travel.*history/i,
      ],
      keyword_phrases: [
        // Web-printout specifics per E2_STRUCTURAL_VARIANTS Variant 1.
        'Admission (I-94) Number',
        'Admission Number',
        'Admit Until',
        'Admit Until Date',
        'Class of Admission',
        'Date of Entry',
        'i94.cbp.dhs.gov',
        'Most Recent Arrival',
        'Travel History',
        // Header signals.
        'U.S. Customs and Border Protection',
        'Customs and Border Protection',
        // Two-letter visa class codes (commonly seen).
        'E2',
        'E-2',
        'B2',
        'B-2',
        'F1',
        'F-1',
        'H1B',
        'H-1B',
        'L1A',
        'L-1A',
      ],
    },
    fills_proof_slots: ['APP.prior_visas_and_status'],
    extractor_skill: 'i94',
    adequacy_criteria: [
      'Printout from i94.cbp.dhs.gov',
      'Admission Number (11 digits) visible',
      'Class of Admission and Admit Until present',
    ],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'i94_paper_card',
    name: 'CBP I-94 legacy paper card / I-797A tear-off',
    category: 'identity',
    definition:
      'Physical white card with stapled corners (pre-2013) or the I-94 tear-off section at the bottom of an I-797A. Rare in current filings but appears in long-history renewals. Distinguished from web printout by image-heavy scan, handwritten port-of-entry / admit-until annotations, and card aspect ratio.',
    identifying_signals: {
      filename_regex: [
        /i.?94.?card|paper.?i.?94|legacy.?i.?94|tear.?off|i.?94.?stub|i797a.*i94/i,
      ],
      keyword_phrases: [
        // Paper-card vocabulary per E2_STRUCTURAL_VARIANTS Variant 2.
        'Arrival/Departure Record',
        'Departure Number',
        'Admission Number',
        'I-94 Number',
        // Pre-printed card fields commonly visible.
        'Family Name',
        'First (Given) Name',
        'Country of Citizenship',
        'Date of Birth',
      ],
      structural_hints: [
        'card-shape scan with perforation marks',
        'handwriting in admit-until / port-of-entry zones',
        'stapled-corner artifact in scan',
        'green/white card stock',
      ],
    },
    fills_proof_slots: ['APP.prior_visas_and_status'],
    extractor_skill: 'i94',
    adequacy_criteria: [
      'Card or tear-off image legible',
      'Admit-until annotation visible',
      'Port-of-entry stamp present',
    ],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'ead',
    name: 'Employment Authorization Document (EAD card, Form I-766)',
    category: 'identity',
    definition:
      'USCIS-issued plastic EAD card with photo, name, USCIS#, category code (A05, C09, E-2, E-2-S), and expiration. Distinguished from visa stamp and I-797 by card aspect ratio (~85x54 mm) and two-sided scan (front + back). Common when spouse or dependent has work authorization.',
    identifying_signals: {
      filename_regex: [
        /ead(?![a-z])|i.?766|employment.*authorization|work.*permit|calisma.*izni/i,
      ],
      keyword_phrases: [
        'EMPLOYMENT AUTHORIZATION',
        'Employment Authorization Document',
        'EAD',
        'I-766',
        'Form I-766',
        // Category code field per E2_STRUCTURAL_VARIANTS Variant 3.
        'Category',
        'A05',
        'C09',
        'E-2',
        'E-2-S',
        'C26',
        // USCIS-card identifiers.
        'USCIS#',
        'USCIS Number',
        'Card #',
        'Card Number',
        // Issuing authority emblem.
        'U.S. Citizenship and Immigration Services',
        'Department of Homeland Security',
      ],
      structural_hints: [
        'card aspect ratio (~85x54 mm)',
        'two-sided scan (front photo + back signature/machine-band)',
        'laminated-card reflections',
      ],
    },
    fills_proof_slots: ['APP.prior_visas_and_status'],
    extractor_skill: null,
    adequacy_criteria: [
      'Card not expired',
      'Photo + USCIS# + category code visible',
      'Both sides scanned (front + back)',
    ],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'prior_approval_notice',
    name: 'USCIS I-797 approval / receipt notice (or SEVIS I-20)',
    category: 'identity',
    definition:
      'Single-page or two-page USCIS-issued notice confirming receipt or approval of a petition (I-797A/B/C). Distinguished from visa stamp and EAD by government letterhead format (not photo / not foil), tabular date block, and "Notice Type" classifier. For E-2 COS / change-of-status this is the operative status proof. Includes SEVIS I-20 for F-1 routing.',
    identifying_signals: {
      // I-20 (F-1 SEVIS) covered here for filename-only routing — coarse
      // status_doc bucket is correct; richer per-form extraction can
      // split later.
      filename_regex: [
        /i.?797|approval.*notice|receipt.*notice|i.?20\b|notice.*of.*action/i,
      ],
      keyword_phrases: [
        'Form I-797',
        'I-797A',
        'I-797B',
        'I-797C',
        'NOTICE OF ACTION',
        'Notice Type',
        'Notice Type: Approval',
        'Notice Type: Receipt',
        'Receipt Number',
        'Receipt Date',
        'Priority Date',
        'Form I-20',
        'SEVIS',
        'Certificate of Eligibility',
        // Service-center prefix patterns per E2_STRUCTURAL_VARIANTS Variant 2.
        'EAC',
        'WAC',
        'MSC',
        'LIN',
        'SRC',
        'IOE',
        'NBC',
        // DHS letterhead.
        'Department of Homeland Security',
        'U.S. Citizenship and Immigration Services',
      ],
      structural_hints: [
        'DHS seal top-left',
        'tabular date block (Received / Priority / Notice / Page)',
        'tear-off I-94 perforation strip on I-797A bottom',
        'barcode on first page',
      ],
    },
    fills_proof_slots: ['APP.prior_visas_and_status'],
    extractor_skill: null,
    adequacy_criteria: [
      'Receipt number present (3-letter prefix + 10 digits)',
      'Approval not superseded by later denial',
      '"Notice of Action" header visible',
    ],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'cbp_admission_stamp',
    name: 'CBP admission stamp page (passport interior)',
    category: 'identity',
    definition:
      'Passport interior page bearing CBP admission ink stamps with handwritten class + admit-until annotations. Same form as passport_full but the operative fact is admission class + admit-until — when filed under status_doc, the firm is treating it as evidence of US status (not just travel history). Distinguished from visa stamp by no foil/sticker and presence of handwriting.',
    identifying_signals: {
      filename_regex: [
        /admission.*stamp|cbp.*stamp|entry.*stamp|port.*of.*entry|admit.*until/i,
      ],
      keyword_phrases: [
        'Admitted',
        'Admit Until',
        'Class of Admission',
        'D/S',
        'CBP',
        'Customs and Border Protection',
        'Port of Entry',
      ],
      structural_hints: [
        'CBP rectangular ink stamp (date + port + class)',
        'handwritten "D/S" or "MM-DD-YYYY" overlaid',
        'no printed sticker geometry (vs visa foil)',
      ],
    },
    fills_proof_slots: ['APP.prior_visas_and_status'],
    extractor_skill: 'passport',
    adequacy_criteria: [
      'CBP stamp legible (date + port + class)',
      'Handwritten admit-until annotation visible',
    ],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'naturalization_certificate',
    name: 'Naturalization certificate',
    category: 'identity',
    definition: 'Certificate evidencing naturalization to the treaty country. Required when nationality_path = naturalization_residency.',
    identifying_signals: {
      filename_regex: [/naturali[sz]ation|vatandaşlık/i],
      keyword_phrases: ['Certificate of Naturalization', 'Vatandaşlık Belgesi', 'Einbürgerungsurkunde'],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Vatandaşlık Belgesi / Türk Vatandaşlığı Karar Belgesi' },
      de: { native_name: 'Einbürgerungsurkunde' },
    },
    fills_proof_slots: ['E1.principal_nationality_path'],
    extractor_skill: 'government-doc',
    adequacy_criteria: ['Issuance date present', 'Certified translation if non-English'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'cbi_certificate',
    name: 'Citizenship-by-investment certificate',
    category: 'identity',
    definition: 'Certificate evidencing nationality acquired through a citizenship-by-investment program. Triggers AMIGOS Act §7 three-year domicile requirement.',
    identifying_signals: {
      filename_regex: [/cbi|citizenship.*investment|grenada|st.*kitts|dominica|antigua|vanuatu|malta/i],
      keyword_phrases: ['Citizenship by Investment', 'Investment Programme', 'Grant of Citizenship'],
    },
    fills_proof_slots: ['E1.principal_nationality_path'],
    extractor_skill: 'government-doc',
    adequacy_criteria: ['Issuance date present', 'Treaty-country relationship verified — AMIGOS pack required'],
    primary_authority: 'AMIGOS Act §7',
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'photo_2x2',
    name: '2x2 visa photograph',
    category: 'identity',
    definition: 'Visa-compliant 2x2 inch photograph (51x51mm), white background, taken within 6 months.',
    identifying_signals: {
      // Word-boundaries on `photo` so "Photoshop", "photography",
      // "screenshot" etc. don't false-match. The 2x2 / passport-photo
      // patterns stay loose because they're already specific.
      filename_regex: [/\b(photo|fotograf|foto)\b/i, /2x2|passport.*photo/i],
      structural_hints: ['square aspect ratio', 'white/off-white background'],
    },
    fills_proof_slots: ['APP.photographs'],
    extractor_skill: 'image-photo',
    adequacy_criteria: ['Square 2x2 inches', 'White background', '≤6 months old', 'Face fully visible, neutral expression'],
    typical_aps: 4,
    filing_bound: 'always',
  },
  {
    id: 'national_id_card',
    name: 'National ID / state ID card',
    category: 'identity',
    definition:
      "Government-issued identity card — national ID in most jurisdictions, state ID in the US. Card-shaped scan (front + back, ~85x54 mm); photo; holder name; DOB; ID number; issue + expiry; issuing-country emblem. Some national IDs carry MRZ; most do not.",
    identifying_signals: {
      filename_regex: [
        /national.?id|state.?id|nufus.*cuzdan|tc.*kimlik|kimlik.*kart|personalausweis|carte.*identite|carta.*identita|dni(?![a-z])|cni(?![a-z])/i,
      ],
      keyword_phrases: [
        'National Identity Card',
        'National ID',
        'State ID',
        'State Identification Card',
        'Identity Card',
        // Jurisdictional variants per E2_STRUCTURAL_VARIANTS Variant 1.
        'Türkiye Cumhuriyeti',
        'T.C. Kimlik',
        'T.C. Kimlik Kartı',
        'Nüfus Cüzdanı',
        'Personalausweis',
        'Bundesrepublik Deutschland',
        "Carte Nationale d'Identité",
        'République Française',
        "Carta d'Identità",
        'DNI',
        'Documento Nacional de Identidad',
        // Common card fields.
        'ID Number',
        'Identity No',
        'Date of Birth',
        'Issued',
        'Expires',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'T.C. Kimlik Kartı / Nüfus Cüzdanı' },
      de: { native_name: 'Personalausweis' },
      fr: { native_name: "Carte Nationale d'Identité" },
      it: { native_name: "Carta d'Identità" },
      es: { native_name: 'DNI (Documento Nacional de Identidad)' },
    },
    fills_proof_slots: ['E1.principal_nationality_path'],
    extractor_skill: 'government-doc',
    adequacy_criteria: [
      'Government-issued (not privately printed)',
      'Photo + holder identification visible',
      'Currently valid (not expired)',
      'Two-sided scan preferred',
    ],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'drivers_license',
    name: "Driver's license",
    category: 'identity',
    definition:
      "Card-shaped driver's license with photo, name, address, DOB, license number, license class (A/B/C/M), issue + expiry. Distinguished from national_id by address field and license-class field; commonly used as KYC corroboration on bank documents and as US-residency context proof.",
    identifying_signals: {
      filename_regex: [
        /drivers.?license|driver.?license|driving.?license|driving.?permit|surucu.*belge|fuhrerschein|permis.*conduire|patente.*guida/i,
      ],
      keyword_phrases: [
        "Driver's License",
        'Driver License',
        'Driving License',
        'Driving Permit',
        // Jurisdictional analogs per E2_STRUCTURAL_VARIANTS Variant 2.
        'Sürücü Belgesi',
        'Führerschein',
        'Permis de Conduire',
        'Patente di Guida',
        'Permiso de Conducir',
        // Distinctive license-class field.
        'License Class',
        'Class A',
        'Class B',
        'Class C',
        'Class M',
        'Categoria',
        // Common fields.
        'License Number',
        'DLN',
        'Issued',
        'Expires',
        'Date of Issue',
        'Date of Expiry',
        'Address',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Sürücü Belgesi' },
      de: { native_name: 'Führerschein' },
      fr: { native_name: 'Permis de Conduire' },
      it: { native_name: 'Patente di Guida' },
    },
    fills_proof_slots: ['APP.prior_visas_and_status'],
    extractor_skill: 'government-doc',
    adequacy_criteria: [
      'Government-issued',
      'Photo + license number + class visible',
      'Currently valid',
    ],
    typical_aps: 3,
    filing_bound: 'optional',
  },
  {
    id: 'residency_immigrant_id',
    name: 'Residency / immigrant ID card',
    category: 'identity',
    definition:
      "Residency permit card from a foreign jurisdiction or US permanent-resident card (Green Card, Form I-551). Establishes status without being a passport. Distinguished from national_id and driver's license by status / category code field and immigration-authority emblem (USCIS or foreign equivalent).",
    identifying_signals: {
      filename_regex: [
        /green.?card|i.?551|permanent.?resident|residency.?card|residence.?permit|ikamet.?izni|aufenthaltstitel|titre.*sejour|permesso.*soggiorno/i,
      ],
      keyword_phrases: [
        'Permanent Resident',
        'Permanent Resident Card',
        'Green Card',
        'I-551',
        'Resident Alien',
        // Jurisdictional analogs per E2_STRUCTURAL_VARIANTS Variant 3.
        'İkamet İzni',
        'İkamet Tezkeresi',
        'Aufenthaltstitel',
        'Aufenthaltserlaubnis',
        'Titre de Séjour',
        'Permesso di Soggiorno',
        // Status / category code field.
        'Category',
        'Class',
        'IR1',
        'IR5',
        'CR1',
        'EB-1',
        'EB-2',
        'EB-5',
        // Immigration-authority emblems.
        'USCIS',
        'United States Citizenship and Immigration Services',
        'Department of Homeland Security',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'İkamet İzni / İkamet Tezkeresi' },
      de: { native_name: 'Aufenthaltstitel' },
      fr: { native_name: 'Titre de Séjour' },
      it: { native_name: 'Permesso di Soggiorno' },
    },
    fills_proof_slots: ['APP.prior_visas_and_status'],
    extractor_skill: 'government-doc',
    adequacy_criteria: [
      'Immigration-authority emblem present',
      'Status / category code visible',
      'Currently valid',
    ],
    typical_aps: 5,
    filing_bound: 'optional',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// VITAL RECORDS — birth, marriage, death, adoption, divorce
// ───────────────────────────────────────────────────────────────────────────

const VITAL_RECORDS: DocType[] = [
  {
    id: 'birth_certificate',
    name: 'Birth certificate',
    category: 'vital_record',
    definition:
      'Civil-registry record of a birth event — government-issued long-form certificate. Single registrant subject (child); parent block (mother + father); civil-registry letterhead with seal; registration number; registrar signature.',
    identifying_signals: {
      filename_regex: [
        /birth.*cert|birth.*record|dogum.*belge|geburtsurkunde|naissance|nascita|certidao.*nascimento|出生|出生证明/i,
      ],
      keyword_phrases: [
        'Certificate of Birth',
        'Birth Certificate',
        'Birth Record',
        'Doğum Belgesi',
        'Geburtsurkunde',
        'Acte de Naissance',
        'Certificato di Nascita',
        'Mother',
        'Father',
        "Mother's Name",
        "Father's Name",
        'Anne',
        'Baba',
        'Anne Adı',
        'Baba Adı',
        'Place of Birth',
        'Doğum Yeri',
        'Date of Birth',
        'Civil Registry',
        'Vital Records',
        'Registration Number',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Doğum Belgesi / Nüfus Kayıt Örneği' },
      de: { native_name: 'Geburtsurkunde' },
      fr: { native_name: 'Acte de Naissance' },
      it: { native_name: 'Certificato di Nascita' },
      ja: { native_name: '出生証明書' },
    },
    fills_proof_slots: ['E1.principal_nationality_path', 'DEP.child_birth_certificates'],
    extractor_skill: 'government-doc',
    adequacy_criteria: [
      'Long-form (full) certificate, not abbreviated',
      'Both parents named',
      'Civil-registry seal present',
      'Certified translation if non-English',
    ],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'marriage_certificate',
    name: 'Marriage certificate',
    category: 'vital_record',
    definition:
      'Civil-registry record of a marriage event. Two-spouse subject blocks; date + place of marriage; officiant; registration number; registrar signature. Not religious-only.',
    identifying_signals: {
      filename_regex: [
        /marriage.*cert|marriage.*record|evlilik|nikah|heiratsurkunde|eheurkunde|mariage|matrimonio|certidao.*casamento|婚姻/i,
      ],
      keyword_phrases: [
        'Certificate of Marriage',
        'Marriage Certificate',
        'Evlilik Cüzdanı',
        'Evlilik Belgesi',
        'Nikah Cüzdanı',
        'Heiratsurkunde',
        'Eheurkunde',
        'Acte de Mariage',
        'Bride',
        'Groom',
        'Spouse',
        'Husband',
        'Wife',
        'Eş',
        'Damat',
        'Gelin',
        'Date of Marriage',
        'Place of Marriage',
        'Officiant',
        'Civil Registry',
        'Vital Records',
        'Registration Number',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Evlilik Cüzdanı / Evlenme Kayıt Örneği' },
      de: { native_name: 'Heiratsurkunde' },
      fr: { native_name: 'Acte de Mariage' },
      ja: { native_name: '婚姻届受理証明書' },
    },
    fills_proof_slots: ['E1.principal_nationality_path', 'DEP.marriage_certificate'],
    extractor_skill: 'government-doc',
    adequacy_criteria: [
      'Government-issued (civil, not religious-only)',
      'Both spouses named',
      'Civil-registry seal present',
      'Translation if non-English',
    ],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'divorce_decree',
    name: 'Divorce decree / dissolution',
    category: 'vital_record',
    definition:
      'Court order dissolving a marriage. Less common in E-2 but appears when a prior marriage affects derivative-status arguments or name changes. Distinguished from marriage/birth by court letterhead (not civil-registry), case number, and decree language.',
    identifying_signals: {
      filename_regex: [
        /divorce|dissolution|decree.*divorce|bosanma|bosanma.*karari|scheidung|scheidungsurteil|jugement.*divorce/i,
      ],
      keyword_phrases: [
        'Decree of Divorce',
        'Dissolution of Marriage',
        'Divorce Decree',
        'Final Decree',
        'Boşanma',
        'Boşanma Kararı',
        'Scheidung',
        'Scheidungsurteil',
        'Jugement de Divorce',
        'Court of',
        'Family Court',
        'Aile Mahkemesi',
        'Case Number',
        'Case No.',
        'Esas No',
        'Karar No',
        'Petitioner',
        'Respondent',
        'Plaintiff',
        'Defendant',
        'It is hereby decreed',
        'Ordered, Adjudged, and Decreed',
        'Effective Date',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Boşanma Kararı / Aile Mahkemesi Kararı' },
      de: { native_name: 'Scheidungsurteil' },
      fr: { native_name: 'Jugement de Divorce' },
    },
    fills_proof_slots: ['E1.principal_nationality_path', 'DEP.marriage_certificate'],
    extractor_skill: 'government-doc',
    adequacy_criteria: [
      'Court letterhead with case number',
      'Final / non-interlocutory',
      'Judge signature + seal',
      'Certified translation if non-English',
    ],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'death_certificate',
    name: 'Death certificate',
    category: 'vital_record',
    definition:
      'Civil-registry record of a death event. Rare but appears in inheritance source-of-funds chain (decedent of estate from which capital flowed) and dependent-status when relevant. Distinguished from birth/marriage by decedent subject and death-event vocabulary.',
    identifying_signals: {
      filename_regex: [
        /death.*cert|death.*record|olum.*belge|vefat.*belge|sterbeurkunde|acte.*deces|certidao.*obito/i,
      ],
      keyword_phrases: [
        'Certificate of Death',
        'Death Certificate',
        'Death Record',
        'Ölüm Belgesi',
        'Vefat Belgesi',
        'Sterbeurkunde',
        'Acte de Décès',
        'Decedent',
        'Deceased',
        'Müteveffa',
        'Vefat',
        'Date of Death',
        'Place of Death',
        'Cause of Death',
        'Pronounced Dead',
        'Civil Registry',
        'Vital Records',
        'Registration Number',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Ölüm Belgesi / Vefat Belgesi' },
      de: { native_name: 'Sterbeurkunde' },
      fr: { native_name: 'Acte de Décès' },
    },
    fills_proof_slots: ['E2.SOF.origin_evidence', 'DEP.marriage_certificate'],
    extractor_skill: 'government-doc',
    adequacy_criteria: [
      'Civil-registry letterhead with seal',
      'Decedent identified',
      'Date + place of death stated',
      'Certified translation if non-English',
    ],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'nufus_kayit_ornegi',
    name: 'Turkish family registry (Nüfus Kayıt Örneği)',
    category: 'vital_record',
    definition:
      'Turkish family registry record (Nüfus Kayıt Örneği) — official document from Nüfus Müdürlüğü listing the head of household, spouse, and children with DOB, nationality, and family member registration numbers. Establishes multiple family relationships in a single document for E-2 dependent applications.',
    identifying_signals: {
      filename_regex: [
        // ı (U+0131, dotless-i) does not fold to ASCII i, so match kay.t
        /nufus.*kay.t.*orn|nufus.*ornek|aile.*kay.t/i,
        /vukuatli.*nufus|nufus.*muduru/i,
      ],
      keyword_phrases: [
        'Nüfus Kayıt Örneği',
        'Nüfus Müdürlüğü',
        'Vukuatlı Nüfus',
        'Aile Kayıt',
        'T.C. Kimlik No',
        'Anne Adı',
        'Baba Adı',
        'Eş Adı',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Nüfus Kayıt Örneği' },
    },
    // Covers both child (birth) and spousal (marriage) relationship proof in one doc.
    fills_proof_slots: [
      'E1.principal_nationality_path',
      'DEP.child_birth_certificates',
      'DEP.marriage_certificate',
    ],
    extractor_skill: null,
    adequacy_criteria: [
      'Issued by Nüfus Müdürlüğü (government, not notarial)',
      'Recent (issued within 6 months of filing)',
      'Certified English translation attached for non-English filings',
    ],
    primary_authority: '8 CFR 214.2(e)(4)(i) (definition of accompanying spouse + child); 22 CFR 41.51(b)(1)(iv) (E-2 dependent eligibility)',
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'adoption_decree',
    name: 'Adoption decree',
    category: 'vital_record',
    definition: 'Court order or official decree of adoption.',
    identifying_signals: {
      filename_regex: [/adoption|evlatlık/i],
      keyword_phrases: ['Decree of Adoption', 'Order of Adoption'],
    },
    fills_proof_slots: ['DEP.child_birth_certificates'],
    extractor_skill: 'government-doc',
    adequacy_criteria: ['Final (not interlocutory)', 'Adoption completed before child turned 16'],
    typical_aps: 5,
    filing_bound: 'optional',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// CORPORATE FORMATION & GOVERNANCE
// ───────────────────────────────────────────────────────────────────────────

const CORPORATE: DocType[] = [
  {
    id: 'articles_of_organization',
    name: 'Articles of Organization (LLC)',
    category: 'corporate_formation',
    definition:
      'State-filed charter establishing an LLC. Carries the state filing stamp, document/charter number, registered-agent block, and effective date. Foreign-corporate equivalents (Esas Sözleşme, Articles of Association) live here too.',
    identifying_signals: {
      filename_regex: [
        /articles.*organization|articles.*org|aoo|certificate.*of.*formation|esas.*sozlesme/i,
      ],
      keyword_phrases: [
        'Articles of Organization',
        'Certificate of Formation',
        'Limited Liability Company',
        'organized under the laws of',
        // State filing stamp / charter-number signals per
        // E2_STRUCTURAL_VARIANTS formation_doc Variant 1.
        'FILED',
        'Filing Number',
        'Document Number',
        'Charter Number',
        'Registered Agent',
        'Organizer',
        'Effective Date',
        // Foreign analogs.
        'Esas Sözleşme',
        'Articles of Association',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Esas Sözleşme / Şirket Ana Sözleşmesi' },
      de: { native_name: 'Gesellschaftsvertrag' },
      fr: { native_name: 'Statuts de la Société' },
    },
    fills_proof_slots: ['E3.business_formation'],
    extractor_skill: 'corporate-formation',
    adequacy_criteria: [
      'State-stamped (filed)',
      'Registered agent listed',
      'EIN application reflects same entity name',
    ],
    primary_authority: '8 CFR 214.2(e)(13)',
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'articles_of_incorporation',
    name: 'Articles of Incorporation (Corporation)',
    category: 'corporate_formation',
    definition:
      'State-filed charter establishing a corporation. Same structural pattern as Articles of Organization but with authorized-shares schedule and incorporator signature instead of organizer.',
    identifying_signals: {
      filename_regex: [
        /articles.*incorporation|articles.*inc|certificate.*of.*incorporation/i,
      ],
      keyword_phrases: [
        'Articles of Incorporation',
        'Certificate of Incorporation',
        'authorized to issue',
        'incorporated under the laws of',
        // State filing-stamp signals.
        'FILED',
        'Filing Number',
        'Document Number',
        'Charter Number',
        'Registered Agent',
        'Incorporator',
        'Effective Date',
        // Authorized-shares schedule (distinguishes Corp from LLC).
        'Authorized Shares',
        'Common Stock',
        'Preferred Stock',
        'Par Value',
      ],
    },
    fills_proof_slots: ['E3.business_formation'],
    extractor_skill: 'corporate-formation',
    adequacy_criteria: [
      'State-stamped (filed)',
      'Authorized shares stated',
      'Registered agent listed',
    ],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'articles_amendment',
    name: 'Articles amendment / restatement / certificate of conversion',
    category: 'corporate_formation',
    definition:
      'Subsequent state-filed instrument modifying the original Articles or Operating Agreement — name change, address change, conversion of entity type, member admission. Cross-references the original filing date / charter number; required when entity has evolved between formation and E-2 filing.',
    identifying_signals: {
      filename_regex: [
        /articles.*amendment|certificate.*amendment|restated.*articles|certificate.*conversion|articles.*restated|name.*change.*articles/i,
      ],
      keyword_phrases: [
        'Articles of Amendment',
        'Certificate of Amendment',
        'Restated Articles',
        'Restated Certificate',
        'Certificate of Conversion',
        'Amended and Restated',
        // Cross-reference indicators per E2_STRUCTURAL_VARIANTS Variant 4.
        'originally filed',
        'original filing date',
        'amends the',
        'restates the',
        'conversion from',
        'conversion to',
        // Common amendment subjects.
        'Name Change',
        'Address Change',
        'Member Admission',
        'Entity Type Conversion',
        // State filing stamp on amendment specifically.
        'FILED',
      ],
    },
    fills_proof_slots: ['E3.business_formation', 'E1.entity_treaty_ownership'],
    extractor_skill: 'corporate-formation',
    adequacy_criteria: [
      'State-stamped on the amendment filing specifically',
      'Cross-references original Articles charter number',
      'Effective date precedes E-2 filing',
    ],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'operating_agreement',
    name: 'LLC Operating Agreement',
    category: 'corporate_formation',
    definition:
      "Internal governance contract for an LLC. Multi-page (typically 20-80 pages with exhibits); contains recitals, definitions, member schedule (Exhibit A), capital-contributions schedule (Exhibit B), governance articles, and signature page. Internal document — no government seal; state filing not required.",
    identifying_signals: {
      filename_regex: [
        /operating.*agreement|llc.*agreement|members.*agreement|shareholders.*agreement/i,
      ],
      keyword_phrases: [
        'Operating Agreement',
        'Members Agreement',
        "Shareholders' Agreement",
        'Membership Interest',
        'Manager-Managed',
        'Member-Managed',
        // Schedule-pattern signals per E2_STRUCTURAL_VARIANTS Variant 3.
        'Exhibit A',
        'Exhibit B',
        'Schedule of Members',
        'Capital Contributions',
        'Capital Account',
        'Distributions',
        'Voting Rights',
        // Recital / definition headings.
        'RECITALS',
        'WHEREAS',
        'DEFINITIONS',
      ],
    },
    fills_proof_slots: [
      'E1.entity_treaty_ownership',
      'E3.business_formation',
      'E5.develop_direct.appointing_resolution',
    ],
    extractor_skill: 'contract',
    adequacy_criteria: [
      'Signed by all members',
      'Membership percentages total 100%',
      'Effective date precedes filing',
      'Schedule of members / capital contributions attached',
    ],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'bylaws',
    name: 'Corporate Bylaws',
    category: 'corporate_formation',
    definition:
      "Internal governance document for a corporation. Sets board structure, officer roles, share class rights, meeting procedures, voting. Multi-page (typically 20-60); section-numbered articles; signed by incorporator or initial board.",
    identifying_signals: {
      filename_regex: [/bylaws|by.law/i],
      keyword_phrases: [
        'BYLAWS',
        'By-Laws',
        'Board of Directors',
        'Officers',
        // Section-numbered article signals.
        'ARTICLE I',
        'ARTICLE II',
        'ARTICLE III',
        // Officer roles.
        'President',
        'Secretary',
        'Treasurer',
        'Chief Executive Officer',
        // Meeting + voting language.
        'Annual Meeting',
        'Special Meeting',
        'Quorum',
        'Voting Rights',
      ],
    },
    fills_proof_slots: ['E3.business_formation', 'E5.develop_direct.appointing_resolution'],
    extractor_skill: 'corporate-formation',
    adequacy_criteria: [
      'Adopted (signed by incorporator or initial board)',
      'Effective date precedes filing',
      'Section-numbered articles complete',
    ],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'ss4_form',
    name: 'IRS Form SS-4 (Application for Employer Identification Number)',
    category: 'corporate_formation',
    definition: 'Completed IRS Form SS-4 — application submitted to obtain the EIN. Pairs with the CP575 EIN assignment letter to evidence company registration.',
    identifying_signals: {
      filename_regex: [/ss[-_\s]?4|application.*ein/i],
      keyword_phrases: ['Form SS-4', 'Application for Employer Identification Number', 'SS-4'],
    },
    fills_proof_slots: ['E3.business_formation', 'E3.tax_compliance'],
    extractor_skill: 'corporate-formation',
    adequacy_criteria: ['EIN visible on form', 'Entity name matches formation documents'],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'membership_certificate',
    name: 'Membership / share certificate (single-holder)',
    category: 'corporate_formation',
    definition:
      "Single-page formal certificate naming one owner, the number of shares/units they hold, and a certificate number. Distinguished from cap_table by single-holder focus, ornamental layout, certificate number, and non-tabular format. Common-law uses physical certificates; civil-law uses ledger entries.",
    identifying_signals: {
      filename_regex: [
        /membership.*cert|share.*cert|stock.*cert|unit.*cert|hisse.*senedi|hisse.*sertifika/i,
      ],
      keyword_phrases: [
        'Membership Certificate',
        'Share Certificate',
        'Stock Certificate',
        'Unit Certificate',
        'Membership Units',
        'Hisse Senedi',
        'Hisse Sertifikası',
        // Ornamental + single-holder signals per E2_STRUCTURAL_VARIANTS Variant 2.
        'This certifies that',
        'is the owner of',
        'is the registered holder of',
        // Class column (single-holder context).
        'Class A',
        'Class B',
        'Common',
        'Preferred',
        // Certificate number prominent.
        'Certificate Number',
        'Certificate No.',
        // Two-officer signatures.
        'President',
        'Secretary',
        'Treasurer',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Hisse Senedi / Hisse Sertifikası' },
    },
    fills_proof_slots: ['E1.entity_treaty_ownership'],
    extractor_skill: 'corporate-formation',
    adequacy_criteria: [
      'Issued to treaty national',
      'Units/shares stated',
      'Certificate number prominent',
      'Signed by authorized officer (typically two-officer signature)',
    ],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'ein_cp575',
    name: 'IRS EIN assignment letter (CP-575) or 147C verification',
    category: 'tax_registration',
    definition:
      'IRS-issued letter assigning the Employer Identification Number to the entity (CP-575 for newly issued, 147-C for replacement verification). Single-page IRS letter with left-margin EIN block, entity name + address, brief paragraph and filing-requirements list. Foreign tax-ID certificates take a comparable single-page form.',
    identifying_signals: {
      filename_regex: [
        /cp.?575|147c|ein.*letter|ein.*assignment|tax.?id.*letter|irs.*letter/i,
      ],
      keyword_phrases: [
        'Employer Identification Number',
        'CP 575',
        'CP-575',
        '147C',
        '147-C',
        // IRS letterhead signals per E2_STRUCTURAL_VARIANTS Variant 2.
        'INTERNAL REVENUE SERVICE',
        'Department of the Treasury',
        // Signer.
        'Director, Accounts Management',
        // EIN body language.
        'assigned to you',
        'identifying number',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Vergi Kimlik Numarası Tasdiknamesi' },
    },
    fills_proof_slots: ['E3.business_formation', 'E3.tax_compliance'],
    extractor_skill: 'corporate-formation',
    adequacy_criteria: ['EIN matches entity name on Articles', 'IRS letterhead'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'certificate_of_good_standing',
    name: 'Certificate of Good Standing / Existence',
    category: 'corporate_formation',
    definition:
      'Single-page state-issued certificate confirming entity is validly existing and current on annual reports / franchise tax. Carries state seal + Secretary of State signature + recent issue date. Civil-law equivalents (Faaliyet Belgesi) follow the same single-page certificate pattern.',
    identifying_signals: {
      filename_regex: [
        /good.*standing|cogs|status.*certificate|certificate.*existence|faaliyet.*belge/i,
      ],
      keyword_phrases: [
        'Certificate of Good Standing',
        'Certificate of Existence',
        'Certificate of Status',
        'in good standing',
        'validly existing',
        'duly organized',
        'currently authorized',
        // State seal / Secretary signature signals.
        'Secretary of State',
        'State Seal',
        'AS OF',
        // Foreign analog.
        'Faaliyet Belgesi',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Faaliyet Belgesi / Sicil Tasdiknamesi' },
    },
    fills_proof_slots: ['E3.business_formation'],
    extractor_skill: 'corporate-formation',
    adequacy_criteria: [
      'Issued ≤ 6 months before filing (preferably ≤ 90 days)',
      'State seal / signature present',
      'Recent ISO date in body',
    ],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'member_resolution',
    name: 'Member resolution / Written consent',
    category: 'corporate_governance',
    definition: 'Written consent or resolution of members — typically appointing the principal as Managing Director.',
    identifying_signals: {
      filename_regex: [/member.*resolution|written.*consent|resolution/i],
      keyword_phrases: ['RESOLVED', 'Action by Written Consent', 'undersigned member'],
    },
    fills_proof_slots: ['E1.entity_treaty_ownership', 'E5.develop_direct.appointing_resolution'],
    extractor_skill: 'contract',
    adequacy_criteria: ['Signed by required members under operating agreement', 'Effective date precedes filing'],
    typical_aps: 4,
    filing_bound: 'always',
  },
  {
    id: 'board_minutes',
    name: 'Board meeting minutes',
    category: 'corporate_governance',
    definition: 'Minutes of a meeting of the board of directors.',
    identifying_signals: {
      filename_regex: [/board.*minutes|minutes.*meeting/i],
      keyword_phrases: ['MINUTES OF', 'Board of Directors', 'Resolved that'],
    },
    fills_proof_slots: ['E5.develop_direct.appointing_resolution'],
    extractor_skill: 'contract',
    adequacy_criteria: ['Signed by secretary or chair', 'Quorum confirmed in minutes'],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'organizational_chart',
    name: 'Organizational chart',
    category: 'corporate_governance',
    definition: 'Org chart showing positions, reporting lines, and (for E-2) ownership percentages.',
    identifying_signals: {
      filename_regex: [/org.*chart|organi[sz]ational.*chart|organizat[ie]on/i],
      keyword_phrases: ['Organizational Chart', 'Org Chart'],
    },
    fills_proof_slots: ['E1.entity_treaty_ownership', 'E5.develop_direct.org_chart', 'E5.executive_supervisory_authority'],
    extractor_skill: null,
    adequacy_criteria: ['Principal at top with control authority shown', 'Ownership percentages sum to 100%'],
    typical_aps: 3,
    filing_bound: 'always',
  },
  {
    id: 'cap_table',
    name: 'Capitalization table / member schedule',
    category: 'corporate_governance',
    definition:
      'Spreadsheet-style summary listing every owner, share/unit count, percent, and class. Distinguished from membership_certificate by tabular aggregate-summary format and references to multiple owners. Drives the treaty-national ≥ 50% ownership gate.',
    identifying_signals: {
      filename_regex: [
        /cap.*table|capitali[sz]ation|members.*list|members.*schedule|shareholders.*list|hissedar.*liste|ortak.*liste/i,
      ],
      keyword_phrases: [
        'Cap Table',
        'Capitalization Table',
        'Members List',
        'Member Schedule',
        'Schedule of Members',
        'Shareholders List',
        'Hissedar Listesi',
        'Ortak Listesi',
        // Tabular structure per E2_STRUCTURAL_VARIANTS Variant 1.
        'Owner',
        'Units',
        'Shares',
        'Membership Interest',
        'Percentage',
        'Ownership %',
        // Class column.
        'Class',
        'Class A',
        'Class B',
        'Common',
        'Preferred',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Hissedar Listesi / Ortaklık Yapısı' },
    },
    fills_proof_slots: ['E1.entity_treaty_ownership'],
    extractor_skill: null,
    adequacy_criteria: [
      'Sums to 100% (or near it)',
      'Treaty-national ownership ≥ 50%',
      'Class column present (common / preferred / Class A / Class B)',
      'Officer signature or initials',
    ],
    typical_aps: 3,
    filing_bound: 'always',
  },
  {
    id: 'mita',
    name: 'Membership-interest transfer / assignment instrument',
    category: 'ownership_transfer',
    definition:
      "Bilateral instrument transferring shares/units from a prior owner to the current one — common for buy-in or buy-out scenarios. The Akalan firm's Tab D.5 / Tab C.5 / Tab E.3.a is canonically this document. Distinguished from cap_table and membership_certificate by bilateral parties, consideration recital, effective-date clause, and transfer-of-interest language.",
    identifying_signals: {
      filename_regex: [
        /mita(?![a-z])|membership.*interest.*transfer|interest.*transfer.*agreement|transfer.*agreement|assignment.*agreement|hisse.*devir|bill.*of.*sale.*membership/i,
      ],
      keyword_phrases: [
        'Membership Interest Transfer',
        'Membership Interest Transfer Agreement',
        'MITA',
        'Assignment of Interest',
        'Assignment Agreement',
        'Bill of Sale',
        'Hisse Devir Sözleşmesi',
        // Bilateral signals per E2_STRUCTURAL_VARIANTS Variant 3.
        'Assignor',
        'Assignee',
        'Transferor',
        'Transferee',
        // Consideration + effective-date clauses.
        'Consideration',
        'Effective Date',
        'Closing Date',
        'Transfer of Interest',
        'transfers, assigns, and conveys',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Hisse Devir Sözleşmesi / Pay Devir' },
    },
    fills_proof_slots: ['E1.entity_treaty_ownership', 'E2.investment_amount_proof', 'E2.at_risk_evidence'],
    extractor_skill: 'contract',
    adequacy_criteria: [
      'Signed by assignor and assignee (bilateral signature blocks)',
      'Consideration stated and reconciles to wire',
      'Effective-date clause explicit',
      'Interest description (units / percent / class) precise',
    ],
    typical_aps: 4,
    filing_bound: 'always',
  },
  {
    id: 'stock_subscription',
    name: 'Stock subscription agreement',
    category: 'ownership_transfer',
    definition: 'Agreement subscribing for newly issued shares in a corporation.',
    identifying_signals: {
      filename_regex: [/stock.*subscription|subscription.*agreement/i],
      keyword_phrases: ['Subscription Agreement', 'subscribe for', 'shares of common stock'],
    },
    fills_proof_slots: ['E1.entity_treaty_ownership', 'E2.investment_amount_proof'],
    extractor_skill: 'contract',
    adequacy_criteria: ['Signed by subscriber and corporate officer', 'Number of shares and price stated'],
    typical_aps: 4,
    filing_bound: 'always',
  },
  {
    id: 'bill_of_sale',
    name: 'Bill of sale (asset purchase)',
    category: 'ownership_transfer',
    definition: 'Bill of sale transferring assets — equipment, inventory, business assets.',
    identifying_signals: {
      filename_regex: [/bill.*sale|asset.*purchase/i],
      keyword_phrases: ['Bill of Sale', 'BUYER', 'SELLER', 'Asset Purchase Agreement'],
    },
    fills_proof_slots: ['E2.investment_amount_proof', 'E2.at_risk_evidence'],
    extractor_skill: 'contract',
    adequacy_criteria: ['Signed by buyer and seller', 'Consideration stated and reconciles to wire'],
    typical_aps: 4,
    filing_bound: 'always',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// FOREIGN CORPORATE REGISTRIES
// ───────────────────────────────────────────────────────────────────────────

const FOREIGN_REGISTRIES: DocType[] = [
  {
    id: 'foreign_corporate_registry_kbis',
    name: 'K-bis extract (France)',
    category: 'foreign_corporate_registry',
    definition: 'French commercial registry extract from RCS (Registre du Commerce et des Sociétés).',
    identifying_signals: {
      filename_regex: [/k.?bis|kbis/i],
      keyword_phrases: ['Extrait Kbis', 'Registre du Commerce', 'SIREN', 'Greffe du Tribunal'],
    },
    foreign_language_equivalents: { fr: { native_name: 'Extrait Kbis' } },
    fills_proof_slots: ['E3.foreign_corporate_registry'],
    extractor_skill: 'foreign-corporate',
    adequacy_criteria: ['Issued ≤ 6 months', 'Certified translation'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'foreign_corporate_registry_handelsregister',
    name: 'Handelsregister extract (Germany/Austria)',
    category: 'foreign_corporate_registry',
    definition: 'German/Austrian commercial registry extract.',
    identifying_signals: {
      filename_regex: [/handelsregister|hra|hrb/i],
      keyword_phrases: ['Handelsregister', 'Amtsgericht', 'HRB', 'HRA'],
    },
    foreign_language_equivalents: { de: { native_name: 'Handelsregisterauszug' } },
    fills_proof_slots: ['E3.foreign_corporate_registry'],
    extractor_skill: 'foreign-corporate',
    adequacy_criteria: ['Current excerpt (Aktueller Abdruck)', 'Translation'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'foreign_corporate_registry_visura',
    name: 'Visura camerale (Italy)',
    category: 'foreign_corporate_registry',
    definition: 'Italian Chamber of Commerce extract.',
    identifying_signals: {
      filename_regex: [/visura|camerale/i],
      keyword_phrases: ['Visura', 'Camera di Commercio', 'Registro delle Imprese'],
    },
    foreign_language_equivalents: { it: { native_name: 'Visura Camerale' } },
    fills_proof_slots: ['E3.foreign_corporate_registry'],
    extractor_skill: 'foreign-corporate',
    adequacy_criteria: ['Issued ≤ 6 months', 'Translation'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'foreign_corporate_registry_companies_house',
    name: 'Companies House extract (UK)',
    category: 'foreign_corporate_registry',
    definition: 'UK Companies House registry extract.',
    identifying_signals: {
      filename_regex: [/companies.*house|ch.*extract/i],
      keyword_phrases: ['Companies House', 'Company number'],
    },
    fills_proof_slots: ['E3.foreign_corporate_registry'],
    extractor_skill: 'foreign-corporate',
    adequacy_criteria: ['Current snapshot', 'Active status'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'foreign_corporate_registry_ticaret_sicil_gazetesi',
    name: 'Ticaret Sicil Gazetesi (Turkey)',
    category: 'foreign_corporate_registry',
    definition: 'Turkish Trade Registry Gazette publication.',
    identifying_signals: {
      filename_regex: [/ticaret.*sicil|tsg|sicil.*gazete/i],
      keyword_phrases: ['Türkiye Ticaret Sicili Gazetesi', 'Sicil No'],
    },
    foreign_language_equivalents: { tr: { native_name: 'Türkiye Ticaret Sicili Gazetesi' } },
    fills_proof_slots: ['E3.foreign_corporate_registry'],
    extractor_skill: 'foreign-corporate',
    adequacy_criteria: ['Most recent gazette entry', 'Translation'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'foreign_corporate_registry_other',
    name: 'Foreign corporate registry (other jurisdiction)',
    category: 'foreign_corporate_registry',
    definition: 'Official corporate registry extract from any jurisdiction not separately listed.',
    identifying_signals: {
      filename_regex: [/registry|registro|registre/i],
      keyword_phrases: ['Commercial Registry', 'Trade Registry', 'Business Registry'],
    },
    fills_proof_slots: ['E3.foreign_corporate_registry'],
    extractor_skill: 'foreign-corporate',
    adequacy_criteria: ['Government-issued', 'Translation'],
    typical_aps: 4,
    filing_bound: 'always',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// TAX RETURNS & TAX REGISTRATION
// ───────────────────────────────────────────────────────────────────────────

const TAX: DocType[] = [
  {
    id: 'tax_return_1120',
    name: 'Corporate income tax return — Form 1120 (C-Corp)',
    category: 'tax_return',
    definition:
      'Federal C-corporation income tax return. Multi-page government form; entity name + EIN block; Schedule L balance-sheet schedule; reconciliation of book-to-tax (Schedule M). Distinguished from personal returns by entity-suffix filer and Schedule L asset/liability table.',
    identifying_signals: {
      filename_regex: [
        /1120(?!s)|form.*1120(?!s)|corporate.*tax.*return|corp.*return/i,
      ],
      keyword_phrases: [
        'Form 1120',
        'U.S. Corporation Income Tax Return',
        // Schedule signals per E2_STRUCTURAL_VARIANTS Variant 2.
        'Schedule L',
        'Balance Sheets per Books',
        'Schedule M-1',
        'Schedule M-2',
        'Schedule M-3',
        // Officer-signature signals.
        'Officer Signature',
        'Title',
        'Total Assets',
        'Total Liabilities',
        // OMB number indicator.
        'OMB No. 1545',
        // Department of Treasury letterhead.
        'Department of the Treasury',
        'Internal Revenue Service',
      ],
    },
    fills_proof_slots: ['E3.tax_compliance', 'E4.financial_capacity'],
    extractor_skill: 'tax-return',
    adequacy_criteria: [
      'As-filed copy with preparer signature or e-file confirmation',
      'Schedule L balance-sheet table present',
      'EIN matches entity name on Articles',
      'Officer signature with title',
    ],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'tax_return_1120s',
    name: 'Corporate income tax return — Form 1120-S (S-Corp)',
    category: 'tax_return',
    definition:
      'Federal S-corporation income tax return. Same structural pattern as 1120 with K-1 attachments distributing income to shareholders. Pass-through indication.',
    identifying_signals: {
      filename_regex: [
        /1120.?s|form.*1120s|s.?corp.*return|s.?corporation/i,
      ],
      keyword_phrases: [
        'Form 1120-S',
        'Form 1120S',
        'Income Tax Return for an S Corporation',
        // Schedule + K-1 signals.
        'Schedule L',
        'Schedule K-1 (Form 1120-S)',
        "Shareholder's Share",
        'Pro Rata Share',
        // Department of Treasury letterhead.
        'Department of the Treasury',
        'Internal Revenue Service',
      ],
    },
    fills_proof_slots: ['E3.tax_compliance', 'E4.financial_capacity'],
    extractor_skill: 'tax-return',
    adequacy_criteria: [
      'As-filed copy',
      'K-1s attached for each shareholder',
      'Schedule L balance-sheet table present',
    ],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'tax_return_1065',
    name: 'Pass-through entity return — Form 1065 (Partnership / multi-member LLC)',
    category: 'tax_return',
    definition:
      'Federal partnership / multi-member LLC return. Form 1065 main return + per-partner K-1 attachments; partner capital reconciliation; balance-sheet schedule. Distinguished from 1120 by K-1 schedules per partner and partner ownership-percent column.',
    identifying_signals: {
      filename_regex: [
        /1065|form.*1065|partnership.*return|partnership.*tax|llc.*return/i,
      ],
      keyword_phrases: [
        'Form 1065',
        'Return of Partnership Income',
        // K-1 signals per E2_STRUCTURAL_VARIANTS Variant 3.
        'Schedule K-1 (Form 1065)',
        "Partner's Share",
        'Pro Rata Share',
        'Pass-through',
        'Partner Capital',
        // Partner ownership-percent column.
        'Profit %',
        'Loss %',
        'Capital %',
        // Department of Treasury letterhead.
        'Department of the Treasury',
        'Internal Revenue Service',
      ],
    },
    fills_proof_slots: ['E3.tax_compliance', 'E4.financial_capacity'],
    extractor_skill: 'tax-return',
    adequacy_criteria: [
      'As-filed copy',
      'K-1s attached for each partner',
      'Partner ownership percentages reconcile to cap table',
    ],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'tax_return_schedule_c',
    name: 'IRS Schedule C (sole proprietor)',
    category: 'tax_return',
    definition: 'Sole-proprietor business income reported on personal Form 1040.',
    identifying_signals: {
      filename_regex: [/schedule.?c|sched.?c/i],
      keyword_phrases: ['Schedule C', 'Profit or Loss From Business'],
    },
    fills_proof_slots: ['E3.tax_compliance', 'E4.financial_capacity'],
    extractor_skill: 'tax-return',
    adequacy_criteria: ['Attached to filed 1040'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'tax_return_1040',
    name: 'Personal income tax return — Form 1040',
    category: 'tax_return',
    definition:
      "U.S. personal income tax return — supports salary-origin and rental-origin SOF. Distinguished from corporate/pass-through returns by single-name (or two-name) filer block, filing-status checkbox row, SSN, wage line item, and absence of Schedule L. Multi-page (2-15) with Schedules A/B/C/D/E.",
    identifying_signals: {
      filename_regex: [
        /1040(?!.s)|form.*1040(?!.s)|personal.*tax.*return|individual.*tax.*return/i,
      ],
      keyword_phrases: [
        'Form 1040',
        'U.S. Individual Income Tax Return',
        // Filing-status + wage-line signals per E2_STRUCTURAL_VARIANTS Variant 1.
        'Filing Status',
        'Single',
        'Married Filing Jointly',
        'Married Filing Separately',
        'Head of Household',
        'Wages, salaries, tips',
        'Adjusted Gross Income',
        'Taxable Income',
        // Schedule indicators.
        'Schedule A',
        'Schedule B',
        'Schedule D',
        'Schedule E',
        // Department of Treasury letterhead.
        'Department of the Treasury',
        'Internal Revenue Service',
      ],
    },
    fills_proof_slots: ['E2.SOF.origin_evidence'],
    extractor_skill: 'tax-return',
    adequacy_criteria: [
      'As-filed copy',
      'Schedules attached as relevant',
      'Filer is one or two individuals (not entity)',
      'Wage line and AGI computed',
    ],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'tax_return_foreign',
    name: 'Foreign tax return (treaty country)',
    category: 'tax_return',
    definition: 'Treaty-country personal or business tax return.',
    identifying_signals: {
      filename_regex: [/tax.*return|gelir.*beyan|steuererklärung|déclaration.*revenu/i],
      keyword_phrases: ['Gelir Vergisi Beyannamesi', 'Steuererklärung', 'Déclaration de revenus'],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Gelir Vergisi Beyannamesi' },
      de: { native_name: 'Einkommensteuererklärung' },
    },
    fills_proof_slots: ['E2.SOF.origin_evidence', 'E2.SOF.crypto_chain'],
    extractor_skill: 'tax-return',
    adequacy_criteria: ['Filed/stamped by tax authority', 'Translation'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'vergi_levhasi',
    name: 'Vergi Levhası (Turkish tax registration)',
    category: 'tax_registration',
    definition: 'Turkish tax board — annual tax registration evidencing taxpayer identity and business.',
    identifying_signals: {
      filename_regex: [/vergi.*levha|levha/i],
      keyword_phrases: ['Vergi Levhası', 'Vergi Kimlik No'],
    },
    foreign_language_equivalents: { tr: { native_name: 'Vergi Levhası' } },
    fills_proof_slots: ['E3.tax_compliance'],
    extractor_skill: 'government-doc',
    adequacy_criteria: ['Current year', 'Translation'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'sales_tax_permit',
    name: 'Sales tax permit / seller\'s permit',
    category: 'tax_registration',
    definition: 'State sales-tax registration certificate.',
    identifying_signals: {
      filename_regex: [/sales.*tax|seller.*permit|reseller/i],
      keyword_phrases: ['Sales Tax Permit', 'Seller\'s Permit', 'Sales and Use Tax'],
    },
    fills_proof_slots: ['E3.tax_compliance'],
    extractor_skill: 'government-doc',
    adequacy_criteria: ['Current (not expired)'],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'employer_registration',
    name: 'State employer registration',
    category: 'tax_registration',
    definition: 'State unemployment insurance / payroll tax registration.',
    identifying_signals: {
      filename_regex: [/employer.*registration|sui|unemployment.*insurance/i],
      keyword_phrases: ['Employer Account Number', 'State Unemployment'],
    },
    fills_proof_slots: ['E3.tax_compliance'],
    extractor_skill: 'government-doc',
    adequacy_criteria: ['Current account active'],
    typical_aps: 4,
    filing_bound: 'optional',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// FINANCIAL — bank statements, wires, statements, FX
// ───────────────────────────────────────────────────────────────────────────

const FINANCIAL: DocType[] = [
  {
    id: 'bank_statement_personal',
    name: 'Personal bank statement',
    category: 'bank_statement',
    definition:
      'Periodic statement for a consumer account (checking / savings / current) held by an individual or joint holders. Distinguished from business statements by single-/dual-name account holder and consumer-fee transaction patterns.',
    identifying_signals: {
      // ASCII-folded forms catch French "Relevé Bancaire" via the fold()
      // step in classify-fallback.ts (NFD strip). Bank brand names cover
      // the ubiquitous US clients whose attorneys export statements with
      // filenames like "BofA_2025-03.pdf" or "Chase_eStmt.pdf" that
      // carry no "bank" or "statement" token.
      filename_regex: [
        /bank.*statement|hesap.*ekstre|kontoauszug|releve.*bancaire|releve.*compte|extracto/i,
        // Letter-only boundaries so "BofA_2025-03.pdf" hits despite the
        // underscore — `\b` would treat _ as a word char and fail.
        /(?<![a-z])(estatement|estmt|stmt|account.*statement|checking|savings)(?![a-z])/i,
        /(?<![a-z])(bofa|chase|citibank|citi|wells.*fargo|capital.*one|jpmorgan|usaa|truist|pnc|us\s*bank)(?![a-z])/i,
      ],
      keyword_phrases: [
        'Statement Period',
        'Beginning Balance',
        'Ending Balance',
        'Account Number',
        'Available Balance',
        'Bank of America',
        'JPMorgan Chase',
        'Chase',
        'Citibank',
        'Wells Fargo',
        'Capital One',
        'Account Statement',
        'Account Activity',
        // Consumer-pattern descriptors — distinguish personal from business
        // when the account-holder line is ambiguous. Per E2_STRUCTURAL_VARIANTS.md
        // bank_statement Variant 1: consumer fee/descriptor signature.
        'POS Purchase',
        'Debit Card',
        'ATM Withdrawal',
        'Direct Deposit',
        'Recurring Payment',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Hesap Ekstresi' },
      de: { native_name: 'Kontoauszug' },
      fr: { native_name: 'Relevé Bancaire / Relevé de Compte' },
      es: { native_name: 'Extracto Bancario' },
    },
    fills_proof_slots: ['E2.SOF.intermediate_holding', 'E2.SOF.gift_documentation'],
    extractor_skill: 'financial-statement',
    adequacy_criteria: ['Bank-issued (not screenshot)', 'Account holder name visible'],
    pii_strip: ['account_number', 'home_address'],
    typical_aps: 4,
    filing_bound: 'always',
  },
  {
    id: 'bank_statement_business',
    name: 'Business bank statement',
    category: 'bank_statement',
    definition:
      'Periodic statement for a company operating account (LLC, Inc., AŞ, Ltd. Şti., GmbH, S.A.). Account holder carries a legal-entity suffix; transactions skew toward payroll-provider deposits, merchant-services credits, and commercial-line items.',
    identifying_signals: {
      // Same brand-name pattern as the personal statement, but with the
      // entity / business-checking signals layered on top so a brand-only
      // filename ("Chase_03_2025.pdf") still classifies generically as
      // bank_statement and the aggregator can decide personal vs business
      // via the account name on the page.
      filename_regex: [
        /business.*bank|business.*statement|business.*checking|sirket.*hesap|operating.*account/i,
        /(?<![a-z])(bofa|chase|citibank|citi|wells.*fargo|capital.*one|jpmorgan|usaa|truist|pnc|us\s*bank)(?![a-z]).*business/i,
        // Entity-suffix in filename ("MyCompany LLC Statement.pdf").
        /\b(llc|l\.l\.c\.|inc|inc\.|corp|corp\.|ltd|gmbh|sarl|s\.a\.|a\.s\.|a\.ş\.)\b.*statement/i,
      ],
      keyword_phrases: [
        'Business Checking',
        'Business Account',
        'EIN',
        'Business Savings',
        'Operating Account',
        'Business Maintenance Fee',
        // Entity suffixes that surface in the account-holder block.
        'LLC',
        'Inc.',
        'Corp.',
        'GmbH',
        'SARL',
        'S.A.',
        'Ltd.',
        // Payroll-provider descriptors — strongest single signal that the
        // account is a US business operating account.
        'Gusto',
        'ADP',
        'Paychex',
        'QuickBooks Payroll',
        // Merchant-services deposit identifiers.
        'Merchant Services',
        'STRIPE',
        'SQUARE',
        'TST*',
      ],
    },
    fills_proof_slots: ['E3.operating_evidence', 'E2.SOF.us_deployment'],
    extractor_skill: 'financial-statement',
    adequacy_criteria: ['Bank-issued', 'Entity name matches Articles'],
    pii_strip: ['account_number'],
    typical_aps: 4,
    filing_bound: 'always',
  },
  {
    id: 'bank_statement_fx_multicurrency',
    name: 'Multi-currency / FX bank statement',
    category: 'bank_statement',
    definition:
      'Statement covering an account that holds balances in two or more currencies, with per-currency sub-ledgers and FX-conversion entries cross-referencing between blocks. Common in Tab E.1/E.2 when funds originated in one currency and converted to USD before deployment.',
    identifying_signals: {
      filename_regex: [
        /fx.*account|multi.?currency|foreign.?currency|doviz.*hesap|usd.*try|eur.*usd|usd.*tl/i,
      ],
      keyword_phrases: [
        'FX Rate',
        'Conversion Rate',
        'Converted At',
        'Foreign Currency',
        'Multi-Currency',
        'Döviz Hesabı',
        'Devisenkonto',
        // Per-currency segmented sub-ledgers — multiple ISO codes co-occurring
        // is the single strongest signal for this variant.
        'USD',
        'EUR',
        'TRY',
        'GBP',
        'CAD',
        'CHF',
        // Footer summary table headers.
        'Balance per Currency',
        'USD Equivalent',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Döviz Hesabı Ekstresi' },
      de: { native_name: 'Devisenkonto-Auszug' },
      fr: { native_name: 'Relevé Multi-devises' },
    },
    fills_proof_slots: ['E2.SOF.intermediate_holding', 'E2.SOF.us_deployment'],
    extractor_skill: 'financial-statement',
    adequacy_criteria: [
      'Bank-issued',
      'Per-currency opening/closing balances reconcile',
      'FX-rate column present where conversion occurred',
    ],
    pii_strip: ['account_number'],
    typical_aps: 4,
    filing_bound: 'always',
  },
  {
    id: 'bank_statement_brokerage',
    name: 'Brokerage / investment account statement',
    category: 'bank_statement',
    definition:
      'Securities-brokerage account statement showing positions (cash, equities, fixed income, mutual funds) and activity (trades, dividends, withdrawals). Appears in Tab E.1 when the source of funds is liquidation of an investment portfolio.',
    identifying_signals: {
      filename_regex: [
        /brokerage|investment.*account|portfolio.*statement|securities.*statement|ira|401\s*k|yatirim.*hesap/i,
        // US-broker brand names commonly export "Schwab_2024-Q4.pdf" or
        // "Fidelity_Apr2025.pdf" with no "brokerage" token.
        /(?<![a-z])(fidelity|schwab|vanguard|merrill|etrade|tdameritrade|robinhood|interactive\s*brokers|ibkr)(?![a-z])/i,
      ],
      keyword_phrases: [
        'Portfolio Summary',
        'Asset Allocation',
        'Holdings',
        'Market Value',
        'Cost Basis',
        'Unrealized Gain',
        'Unrealized Loss',
        'Trade Confirmation',
        'CUSIP',
        'ISIN',
        'Ticker',
        'Bought',
        'Sold',
        'Reinvested',
        'Dividend',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Yatırım Hesabı Ekstresi' },
    },
    // Source-origin slot — brokerage liquidation funds the deployment.
    fills_proof_slots: ['E2.SOF.origin_evidence', 'E2.SOF.intermediate_holding'],
    extractor_skill: 'financial-statement',
    adequacy_criteria: [
      'Brokerage-issued (not screenshot)',
      'Holdings table with position-level detail',
      'Trade activity reconciles with realized proceeds claimed as SOF',
    ],
    pii_strip: ['account_number'],
    typical_aps: 4,
    filing_bound: 'always',
  },
  {
    id: 'wire_swift_mt103',
    name: 'International wire confirmation (SWIFT MT103, with FX leg)',
    category: 'wire_or_receipt',
    definition:
      'SWIFT/SEPA-mediated international wire receipt showing origin currency, FX rate, and USD-leg detail. Distinguished from domestic wires by SWIFT MT103 field codes and BIC pair (cross-border). Single page (occasionally 2); receipt-style layout.',
    identifying_signals: {
      filename_regex: [
        /mt.?103|swift|sepa|international.*wire|cross.?border|havale.*uluslararasi/i,
      ],
      keyword_phrases: [
        'MT103',
        'SWIFT',
        'SEPA',
        // SWIFT MT103 field-code regex per E2_STRUCTURAL_VARIANTS Variant 1.
        ':20:',
        ':50K:',
        ':50:',
        ':59:',
        ':70:',
        ':71A:',
        ':32A:',
        ':33B:',
        // Sender/beneficiary block labels.
        'Ordering Customer',
        'Beneficiary Customer',
        'Beneficiary Bank',
        'Intermediary Bank',
        // BIC + IBAN signals (cross-border markers).
        'BIC',
        'SWIFT Code',
        'IBAN',
        // FX leg signals.
        'FX Rate',
        'Conversion Rate',
        'Value Date',
        'Exchange Rate',
      ],
    },
    fills_proof_slots: ['E2.investment_amount_proof', 'E2.at_risk_evidence', 'E2.SOF.us_deployment'],
    extractor_skill: 'wire-confirmation',
    adequacy_criteria: [
      'Originator and beneficiary clearly stated',
      'Amount and date present',
      'BIC / SWIFT codes for both sides',
      'FX rate present when conversion occurred',
    ],
    pii_strip: ['account_number'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'wire_confirmation',
    name: 'Domestic USD wire / ACH confirmation',
    category: 'wire_or_receipt',
    definition:
      'US-domestic wire (Fedwire) or ACH credit confirmation, single currency, no FX. Distinguished from international wires by ABA 9-digit routing number (instead of BIC) and absence of SWIFT field codes.',
    identifying_signals: {
      filename_regex: [
        /wire.*confirm|wire.*receipt|fedwire|ach.*confirm|domestic.*transfer|usd.*wire|wire.?usd/i,
      ],
      keyword_phrases: [
        'Wire Transfer',
        'Confirmation Number',
        // Fedwire / ACH-specific signals per E2_STRUCTURAL_VARIANTS Variant 2.
        'Fedwire',
        'Fedwire Reference',
        'ACH',
        'ACH Credit',
        'ACH Debit',
        'IMAD',
        'OMAD',
        // ABA routing (vs BIC).
        'Routing Number',
        'ABA',
        'Routing Transit Number',
        // Single USD framing (no FX).
        'USD',
        'United States Dollars',
      ],
    },
    fills_proof_slots: ['E2.investment_amount_proof', 'E2.SOF.us_deployment'],
    extractor_skill: 'wire-confirmation',
    adequacy_criteria: [
      'Bank letterhead or e-banking PDF',
      'Originator/beneficiary visible',
      'ABA routing number present (not BIC)',
      'Single USD amount (no FX rate)',
    ],
    pii_strip: ['account_number'],
    typical_aps: 4,
    filing_bound: 'always',
  },
  {
    id: 'bank_receipt',
    name: 'Bank receipt / dekont',
    category: 'wire_or_receipt',
    definition: 'Bank-issued receipt for deposit, withdrawal, or transfer (e.g., Turkish "dekont").',
    identifying_signals: {
      // `gelis` matches Turkish "geliş" after NFD fold (incoming
      // wire/transfer); `havale` is the generic Turkish word for transfer.
      filename_regex: [/dekont|bank.*receipt|fis|gelis|havale|eft/i],
      keyword_phrases: ['Dekont', 'Hesap Hareketi', 'Banka Şubesi', 'Geliş', 'Havale', 'EFT'],
    },
    foreign_language_equivalents: { tr: { native_name: 'Dekont' } },
    fills_proof_slots: ['E2.investment_amount_proof', 'E2.SOF.us_deployment'],
    extractor_skill: 'bank-receipt',
    adequacy_criteria: ['Bank stamp/letterhead', 'Translation if non-English'],
    typical_aps: 4,
    filing_bound: 'always',
  },
  {
    id: 'cancelled_check',
    name: 'Check image / counter-deposit slip',
    category: 'wire_or_receipt',
    definition:
      'Scanned check (front + endorsement back) or branch-counter deposit slip with teller-stamp. Image-heavy with handwritten payee/amount fields, signature, and MICR line at bottom. Distinguished from wires by handwriting present and absence of SWIFT/ABA codes.',
    identifying_signals: {
      filename_regex: [
        /check(?![a-z])|cheque|cancelled.*check|deposit.*slip|teller.*receipt/i,
      ],
      keyword_phrases: [
        'Pay to the order of',
        'Pay To',
        'Order of',
        // MICR + endorsement signals per E2_STRUCTURAL_VARIANTS Variant 3.
        'MICR',
        'Endorsement',
        'Endorsed',
        'Deposit Only',
        // Counter / teller signals.
        'Deposit Slip',
        'Teller',
        'Counter Deposit',
        'Branch',
        // Drawer/payee labels.
        'Drawer',
        'Drawee',
        'Payee',
      ],
    },
    fills_proof_slots: ['E2.investment_amount_proof', 'E2.SOF.us_deployment'],
    extractor_skill: 'bank-receipt',
    adequacy_criteria: [
      'Front and back (endorsement) visible',
      'Bank clearing stamp',
      'MICR line at bottom',
    ],
    pii_strip: ['account_number', 'routing'],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'inter_account_transfer',
    name: 'Inter-account transfer / book entry',
    category: 'wire_or_receipt',
    definition:
      'Same-bank, same-holder (or holder-to-related-party) internal transfer confirmation. Often used to bridge personal account → business account funding events. Distinguished from wires by same bank both sides, no SWIFT/ABA codes, and "Book transfer" / "Internal transfer" label.',
    identifying_signals: {
      filename_regex: [
        /book.?transfer|internal.?transfer|virman|account.?transfer|inter.?account|same.?bank/i,
      ],
      keyword_phrases: [
        'Book Transfer',
        'Internal Transfer',
        'Account Transfer',
        'Same-Bank',
        'Inter-Account',
        // Foreign analog.
        'Virman',
        'Hesaplar Arası Transfer',
        // From/to account masked indicators.
        'From Account',
        'To Account',
        'Source Account',
        'Destination Account',
        'Transfer Reference',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Virman / Hesaplar Arası Transfer' },
    },
    fills_proof_slots: ['E2.investment_amount_proof', 'E2.SOF.us_deployment', 'E2.at_risk_evidence'],
    extractor_skill: 'bank-receipt',
    adequacy_criteria: [
      'Same bank logo on both sides',
      "Internal / Book / Virman label present",
      'Absence of SWIFT/ABA (distinguishes from external wires)',
      'Short receipt (< 1 page typical)',
    ],
    pii_strip: ['account_number'],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'fx_conversion_receipt',
    name: 'FX conversion receipt',
    category: 'currency_conversion',
    definition: 'Bank or money-service receipt for currency conversion in the SOF chain.',
    identifying_signals: {
      filename_regex: [/fx|currency.*conversion|exchange.*receipt/i],
      keyword_phrases: ['Exchange Rate', 'Foreign Exchange', 'Converted'],
    },
    fills_proof_slots: ['E2.investment_amount_proof', 'E2.SOF.us_deployment'],
    extractor_skill: 'bank-receipt',
    adequacy_criteria: ['Bank-issued', 'Rate and date present'],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'balance_sheet',
    name: 'Balance sheet (point-in-time)',
    category: 'financial_statement',
    definition:
      "Statement of financial position — assets, liabilities, equity AT a specific date (not period-range). Distinguished by as-of-date framing and the A = L + E reconciling identity. US-GAAP and IFRS labels differ; structure is universal.",
    identifying_signals: {
      filename_regex: [
        /balance.*sheet|bilanco|statement.*of.*position|statement.*of.*financial.*position/i,
      ],
      keyword_phrases: [
        'Balance Sheet',
        'Statement of Financial Position',
        'Statement of Position',
        'Bilanço',
        // As-of-date framing per E2_STRUCTURAL_VARIANTS Variant 1.
        'As of',
        'As at',
        // Three-section body.
        'Assets',
        'Current Assets',
        'Non-Current Assets',
        'Total Assets',
        'Liabilities',
        'Current Liabilities',
        'Non-Current Liabilities',
        'Total Liabilities',
        'Equity',
        "Stockholders' Equity",
        "Shareholders' Equity",
        'Total Equity',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Bilanço' },
      de: { native_name: 'Bilanz' },
      fr: { native_name: 'Bilan' },
    },
    fills_proof_slots: ['E2.investment_amount_proof', 'E4.financial_capacity'],
    extractor_skill: 'financial-statement',
    adequacy_criteria: [
      'As-of date present (single date, not range)',
      'Assets = Liabilities + Equity reconciles',
      'CPA letter strengthens self-prepared',
    ],
    typical_aps: 3,
    filing_bound: 'always',
  },
  {
    id: 'profit_loss_statement',
    name: 'Profit & Loss / income statement (period)',
    category: 'financial_statement',
    definition:
      'Income statement — revenue, COGS, gross profit, operating expenses, operating income, net income FOR a reporting period (period-range, not point-in-time). Distinguished from balance_sheet by period range framing and revenue→net-income flow.',
    identifying_signals: {
      filename_regex: [
        /p.?n.?l|profit.*loss|income.*statement|gelir.*tablo|kar.*zarar|compte.*resultat|gewinn.*verlust/i,
      ],
      keyword_phrases: [
        'Profit and Loss',
        'Profit & Loss',
        'P&L',
        'Income Statement',
        'Statement of Operations',
        'Statement of Comprehensive Income',
        'Gelir Tablosu',
        'Kar/Zarar',
        // Revenue → Net Income flow per E2_STRUCTURAL_VARIANTS Variant 2.
        'Revenue',
        'Sales',
        'Net Sales',
        'Cost of Goods Sold',
        'COGS',
        'Gross Profit',
        'Operating Expenses',
        'OpEx',
        'Operating Income',
        'EBITDA',
        'Net Income',
        'Net Profit',
        'Net Loss',
        // Period-range framing.
        'For the period',
        'For the year ended',
        'Year-to-date',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Gelir Tablosu / Kar-Zarar Tablosu' },
      de: { native_name: 'Gewinn- und Verlustrechnung' },
      fr: { native_name: 'Compte de Résultat' },
    },
    fills_proof_slots: ['E4.financial_capacity'],
    extractor_skill: 'financial-statement',
    adequacy_criteria: [
      'Period range stated (not single date)',
      'Revenue → Net Income flow reconciles',
      'CPA letter strengthens',
    ],
    typical_aps: 3,
    filing_bound: 'always',
  },
  {
    id: 'cash_flow_statement',
    name: 'Cash-flow statement (period)',
    category: 'financial_statement',
    definition:
      'Statement of cash flows from operating, investing, and financing activities for a reporting period. Three-section body with beginning + ending cash reconciliation. Used in renewals to evidence operating-cash conversion and runway.',
    identifying_signals: {
      filename_regex: [
        /cash.*flow|nakit.*akim|kapitalflussrechnung|tableau.*flux/i,
      ],
      keyword_phrases: [
        'Cash Flow',
        'Statement of Cash Flows',
        'Nakit Akımı',
        'Nakit Akım Tablosu',
        // Three-activity sectioning per E2_STRUCTURAL_VARIANTS Variant 3.
        'Operating Activities',
        'Investing Activities',
        'Financing Activities',
        'Cash from Operations',
        'Cash from Investing',
        'Cash from Financing',
        // Reconciliation framing.
        'Beginning Cash',
        'Ending Cash',
        'Net Change in Cash',
        'Cash and Cash Equivalents',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Nakit Akım Tablosu' },
      de: { native_name: 'Kapitalflussrechnung' },
      fr: { native_name: 'Tableau des Flux de Trésorerie' },
    },
    fills_proof_slots: ['E4.financial_capacity'],
    extractor_skill: 'financial-statement',
    adequacy_criteria: [
      'Period range stated',
      'Three-activity sectioning (Operating / Investing / Financing)',
      'Beginning + ending cash reconciliation',
    ],
    typical_aps: 3,
    filing_bound: 'optional',
  },
  {
    id: 'audited_financial_statement',
    name: 'Combined / audited financial-statement package',
    category: 'financial_statement',
    definition:
      "Combined package including balance sheet, P&L, cash flow, notes to financial statements, and (often) auditor's opinion bound together. The audited form is the highest-APS variant in this family. Typically 15-60 pages cover-to-cover.",
    identifying_signals: {
      filename_regex: [
        /audit|audited.*financial|annual.*report|combined.*financial|mali.*tablolar|jahresabschluss/i,
      ],
      keyword_phrases: [
        "Independent Auditor's Report",
        'Auditor\'s Report',
        'Audit Opinion',
        'Unqualified Opinion',
        'GAAP',
        'IFRS',
        // Combined-package signals per E2_STRUCTURAL_VARIANTS Variant 4.
        'Notes to Financial Statements',
        'Notes to the Financial Statements',
        'Combined Financial Statements',
        'Annual Report',
        'Mali Tablolar',
        'Jahresabschluss',
        // Audit firm letterhead indicators.
        'Big Four',
        'PwC',
        'Deloitte',
        'EY',
        'Ernst & Young',
        'KPMG',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Bağımsız Denetim Raporu / Mali Tablolar Paketi' },
      de: { native_name: 'Jahresabschluss mit Bestätigungsvermerk' },
    },
    fills_proof_slots: ['E4.financial_capacity', 'E2.investment_amount_proof'],
    extractor_skill: 'financial-statement',
    adequacy_criteria: [
      'Auditor letter present (if claimed audited)',
      'Multiple statement types bound together',
      'Notes to financial statements section',
      'Unqualified opinion preferred',
      "Auditor's license verifiable",
    ],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'cpa_letter',
    name: 'CPA verification letter',
    category: 'financial_statement',
    definition: 'Letter from licensed CPA verifying financial figures, capitalization, or tax compliance.',
    identifying_signals: {
      filename_regex: [/cpa.*letter|cpa.*verif/i],
      keyword_phrases: ['Certified Public Accountant', 'CPA License', 'verify'],
    },
    fills_proof_slots: ['E2.proportionality_substantiality', 'E4.financial_capacity'],
    extractor_skill: null,
    adequacy_criteria: ['CPA name and license # present', 'Specific to facts being verified'],
    typical_aps: 4,
    filing_bound: 'always',
  },
  {
    id: 'investment_portfolio_statement',
    name: 'Investment portfolio statement',
    category: 'financial_statement',
    definition: 'Brokerage statement showing securities holdings — supports loan-collateral schedule.',
    identifying_signals: {
      filename_regex: [/portfolio|brokerage|investment.*statement/i],
      keyword_phrases: ['Portfolio', 'Holdings', 'Brokerage Account'],
    },
    fills_proof_slots: ['E2.SOF.loan_collateral'],
    extractor_skill: 'financial-statement',
    adequacy_criteria: ['Brokerage-issued', 'Holdings sufficient to secure loan'],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'collateral_schedule',
    name: 'Loan collateral schedule',
    category: 'financial_statement',
    definition: 'Schedule of non-business assets pledged as loan collateral.',
    identifying_signals: {
      filename_regex: [/collateral.*schedule|security.*agreement/i],
      keyword_phrases: ['Collateral', 'Security Agreement', 'Pledged Assets'],
    },
    fills_proof_slots: ['E2.SOF.loan_collateral'],
    extractor_skill: 'contract',
    adequacy_criteria: ['Lists specific non-business assets', 'Excludes the new U.S. enterprise'],
    typical_aps: 3,
    filing_bound: 'always',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// REAL ESTATE & LEASES
// ───────────────────────────────────────────────────────────────────────────

const REAL_ESTATE: DocType[] = [
  {
    id: 'title_deed_us',
    name: 'Land-registry title certificate (U.S. recorded deed)',
    category: 'real_estate',
    definition:
      'Recorded U.S. real-estate title deed (warranty deed, grant deed, quitclaim). Government-issued; carries county recorder stamp + parcel/registry block + grantor/grantee block + acquisition date and price. Distinguished from encumbrance extract by transfer-of-title framing (not lien snapshot).',
    identifying_signals: {
      filename_regex: [
        /(?<![a-z])deed(?![a-z])|warranty.*deed|grant.*deed|quitclaim|title.*deed|recorded.*deed/i,
      ],
      keyword_phrases: [
        'Warranty Deed',
        'Grant Deed',
        'Quitclaim Deed',
        'Recorded',
        'Recorder of Deeds',
        // Parcel / registry block signals per E2_STRUCTURAL_VARIANTS Variant 1.
        'Parcel Number',
        'Parcel ID',
        'Assessor Parcel',
        'APN',
        'Lot',
        'Block',
        // Grantor/grantee + consideration.
        'Grantor',
        'Grantee',
        'Consideration',
        'Conveyed',
        'Convey',
      ],
    },
    fills_proof_slots: ['E2.SOF.origin_evidence', 'E3.business_premises', 'E2.SOF.loan_collateral'],
    extractor_skill: 'real-estate-purchase',
    adequacy_criteria: [
      'County recorder stamp',
      'Parcel ID / APN visible',
      'Grantor/grantee match SOF chain',
      'Acquisition date + consideration stated',
    ],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'tapu_senedi',
    name: 'Land-registry title certificate (Tapu Senedi / foreign analog)',
    category: 'real_estate',
    definition:
      'Turkish Land Registry title deed (Tapu Senedi) and analogous foreign-jurisdiction registry instruments (Grundbuch, Cadastre extract). Distinguished from US deed by jurisdictional registry letterhead + parcel codes (pafta/ada/parsel).',
    identifying_signals: {
      filename_regex: [
        /tapu|tapu.?sicil|pafta.*parsel|grundbuch|cadastre|registro.*civil/i,
      ],
      keyword_phrases: [
        'Tapu Senedi',
        'Tapu Sicil',
        'Tapu Müdürlüğü',
        // Turkish parcel-code structure per E2_STRUCTURAL_VARIANTS Variant 1.
        'Pafta',
        'Ada',
        'Parsel',
        'Ada/Parsel',
        'İl',
        'İlçe',
        'Mahalle',
        // Foreign analogs.
        'Grundbuch',
        'Cadastre',
        'Registro de la Propiedad',
        // Owner / acquisition signals.
        'Malik',
        'Sahip',
        'Edinme Tarihi',
        'Edinme Sebebi',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Tapu Senedi' },
      de: { native_name: 'Grundbuchauszug' },
      fr: { native_name: 'Extrait Cadastral' },
    },
    fills_proof_slots: ['E2.SOF.origin_evidence', 'E2.SOF.loan_collateral'],
    extractor_skill: 'real-estate-purchase',
    adequacy_criteria: [
      'Certified translation',
      'Holding period > 12 months supports SOF',
      'Parcel codes (pafta/ada/parsel) visible',
    ],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'property_encumbrance_extract',
    name: 'Property-registry extract / encumbrance certificate',
    category: 'real_estate',
    definition:
      'Registry-issued summary of current encumbrances, liens, mortgages, and easements — separate from the underlying title. Distinguished from title_deed by lien framing (not transfer) and current-state snapshot. Universal — every land registry has an analog.',
    identifying_signals: {
      filename_regex: [
        /encumbrance|lien.*search|takyidat|registry.*extract|grundbuch.*auszug|extrait.*cadastral/i,
      ],
      keyword_phrases: [
        'Encumbrance',
        'Encumbrances',
        'Lien',
        'Lien Search',
        'Mortgage',
        'Easement',
        'Takyidat',
        'İpotek',
        'Şerh',
        // Registry framing.
        'Registry Extract',
        'Status of Title',
        'Issued',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Takyidat Belgesi / İpotek Şerh' },
      de: { native_name: 'Grundbuchauszug (Belastungen)' },
    },
    fills_proof_slots: ['E2.SOF.origin_evidence', 'E3.business_premises'],
    extractor_skill: 'real-estate-purchase',
    adequacy_criteria: [
      'Registry letterhead + seal',
      'Encumbrance / lien list (or "no encumbrances" stated)',
      'Issue date prominent',
    ],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'sale_contract',
    name: 'Real-estate or business sale contract',
    category: 'real_estate',
    definition: 'Sale contract evidencing disposition of an asset whose proceeds funded the investment.',
    identifying_signals: {
      filename_regex: [/sale.*contract|purchase.*agreement|satış.*sözleşme/i],
      keyword_phrases: ['Purchase and Sale Agreement', 'Buyer', 'Seller', 'Closing Date'],
    },
    fills_proof_slots: ['E2.SOF.origin_evidence'],
    extractor_skill: 'contract',
    adequacy_criteria: ['Signed by all parties', 'Consideration matches buyer wire and bank deposit'],
    typical_aps: 4,
    filing_bound: 'always',
  },
  {
    id: 'lease_commercial',
    name: 'Commercial lease (premises)',
    category: 'real_estate',
    definition:
      'Landlord-tenant lease for the Petitioner-entity\'s business premises. Distinguished from residential lease by entity tenant, CAM/NNN charge schedules, square-footage line, and "permitted use" clause referencing commercial activity. Typical 20-80 pages with riders + exhibits.',
    identifying_signals: {
      filename_regex: [
        /commercial.*lease|retail.*lease|office.*lease|premises.*lease|lease.*agreement|kira.*sozlesme|isyeri.*kira|bail.*commercial|contrat.*bail|gewerbemietvertrag/i,
      ],
      keyword_phrases: [
        'Commercial Lease',
        'Lease Agreement',
        'Retail Lease',
        'Office Lease',
        'Landlord',
        'Tenant',
        'Premises',
        'Bail Commercial',
        'İşyeri Kira Sözleşmesi',
        'Gewerbemietvertrag',
        // CAM/NNN/triple-net schedules per E2_STRUCTURAL_VARIANTS Variant 1.
        'CAM',
        'Common Area Maintenance',
        'NNN',
        'Triple Net',
        'Operating Expenses',
        'Real Estate Taxes',
        // Square-footage line.
        'Square Footage',
        'Square Feet',
        'Sq. Ft.',
        'Rentable Area',
        // Permitted use + entity-tenant signals.
        'Permitted Use',
        'Use Clause',
        'shall use the Premises',
        'LLC',
        'Inc.',
        'Corp.',
        // Lease-economics signals.
        'Base Rent',
        'Annual Rent',
        'Lease Term',
        'Renewal Option',
        'Security Deposit',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'İşyeri Kira Sözleşmesi / Ticari Kira' },
      de: { native_name: 'Gewerbemietvertrag' },
      fr: { native_name: 'Bail Commercial' },
    },
    fills_proof_slots: ['E2.at_risk_evidence', 'E2.in_process_walsh_pollard', 'E3.business_premises'],
    extractor_skill: 'contract',
    adequacy_criteria: [
      'Executed by both parties',
      'Tenant block contains entity legal name',
      'Permitted-use clause references commercial activity',
      'Term ≥ 12 months preferred',
      'Premises address matches Articles',
    ],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'lease_residential',
    name: 'Residential lease',
    category: 'real_estate',
    definition:
      "Residential tenancy agreement. Two distinct sub-uses in E-2: (a) Beneficiary's housing (lifestyle / AMIGOS-domicile proof) or (b) the Beneficiary as landlord, where rental income is the source-of-funds. Distinguished from commercial lease by natural-person tenant, no CAM/NNN, and 'Residential' / 'Apartment' / 'Single-Family' vocabulary.",
    identifying_signals: {
      filename_regex: [
        /residential.*lease|apartment.*lease|tenancy|rental.*agreement|kira.*konut|konut.*kira|bail.*habitation|bail.*location|mietvertrag(?!.*gewerbe)/i,
      ],
      keyword_phrases: [
        'Residential Lease',
        'Tenancy Agreement',
        'Rental Agreement',
        'Tenant',
        'Premises',
        'Mietvertrag',
        // Residential-specific vocabulary per E2_STRUCTURAL_VARIANTS Variant 2.
        'Apartment',
        'Single-Family',
        'Konut',
        'Habitation',
        // Lease-economics signals (residential).
        'Monthly Rent',
        'Security Deposit',
        'Pet Deposit',
        'Utilities',
        'Furnished',
        'Unfurnished',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Konut Kira Sözleşmesi' },
      de: { native_name: 'Mietvertrag (Wohnung)' },
      fr: { native_name: "Bail d'Habitation" },
    },
    fills_proof_slots: ['E1.cbi_amigos_domicile'],
    extractor_skill: 'contract',
    adequacy_criteria: [
      'Executed',
      'Tenant is a natural person (not an entity)',
      'Address in relevant jurisdiction',
    ],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'real_estate_purchase_closing',
    name: 'Real-estate purchase / closing instrument',
    category: 'real_estate',
    definition:
      'Purchase agreement + closing statement when the Petitioner buys (rather than leases) its premises. Distinguished from leases by buyer/seller (not landlord/tenant) and presence of a closing statement (HUD-1 / ALTA settlement statement, or jurisdictional analog). Routes to the realEstatePurchase rich extractor.',
    identifying_signals: {
      filename_regex: [
        /purchase.*agreement|real.estate.*purchase|closing.*statement|settlement.*statement|hud.?1|alta.*statement|gayrimenkul.*satis|kaufvertrag.*immobilie/i,
      ],
      keyword_phrases: [
        'Real Estate Purchase Agreement',
        'Purchase Agreement',
        'Sale and Purchase Agreement',
        'Closing Statement',
        'Settlement Statement',
        // Specific closing-statement formats per E2_STRUCTURAL_VARIANTS Variant 3.
        'HUD-1',
        'ALTA Settlement Statement',
        'CDF',
        'Closing Disclosure',
        // Buyer / seller (not landlord/tenant) + petitioner-entity buyer.
        'Buyer',
        'Seller',
        'Purchaser',
        'Vendor',
        'Closing Date',
        // Cross-reference to deed.
        'Deed',
        'Title',
        'Title Insurance',
        'Title Company',
        'Earnest Money',
        // Foreign analogs.
        'Gayrimenkul Satış',
        'Tapu Devir',
        'Kaufvertrag Immobilie',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Gayrimenkul Satış Sözleşmesi / Tapu Devir' },
      de: { native_name: 'Immobilienkaufvertrag' },
      fr: { native_name: "Acte de Vente Immobilière" },
    },
    fills_proof_slots: ['E2.SOF.us_deployment', 'E2.at_risk_evidence', 'E3.business_premises'],
    extractor_skill: 'real-estate-purchase',
    adequacy_criteria: [
      'Buyer block names Petitioner-entity (or Beneficiary if SOF property)',
      'Closing-statement line-item table present',
      'Cross-reference to a recorded deed instrument',
      'Closing date stated',
    ],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'utility_bill_business',
    name: 'Business utility bill',
    category: 'real_estate',
    definition: 'Utility bill for commercial premises evidencing real and operating presence.',
    identifying_signals: {
      filename_regex: [/utility|electric.*bill|gas.*bill|water.*bill/i],
      keyword_phrases: ['Account Number', 'Service Address', 'kWh', 'Therms'],
    },
    fills_proof_slots: ['E3.business_premises'],
    extractor_skill: null,
    adequacy_criteria: ['Service address matches lease', 'Account in entity name'],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'photo_premises',
    name: 'Premises photographs',
    category: 'photographs',
    definition: 'Interior/exterior photos of business premises.',
    identifying_signals: {
      filename_regex: [/premises|exterior|interior|store.*photo|şube.*foto/i],
      structural_hints: ['JPEG-from-camera EXIF preferred'],
    },
    fills_proof_slots: ['E3.business_premises'],
    extractor_skill: 'image-photo',
    adequacy_criteria: ['Date captured (EXIF)', 'Address signage visible'],
    typical_aps: 3,
    filing_bound: 'optional',
  },
  {
    id: 'photo_buildout',
    name: 'Build-out progression photos',
    category: 'photographs',
    definition: 'Time-stamped photos showing construction/build-out progression.',
    identifying_signals: {
      filename_regex: [/buildout|construction|renovation/i],
      structural_hints: ['date stamps preferred'],
    },
    fills_proof_slots: ['E2.in_process_walsh_pollard', 'E2.at_risk_evidence'],
    extractor_skill: 'image-photo',
    adequacy_criteria: ['Sequence shows progression over time', 'Address verifiable'],
    typical_aps: 3,
    filing_bound: 'optional',
  },
  {
    id: 'internal_memo_worksheet',
    name: 'Internal memo / worksheet (firm-internal artifact)',
    category: 'attorney_work_product',
    definition:
      'Firm-internal memos, source-of-funds memos, proportionality worksheets, intake notes. Lives in the working folder (_Working-Drafts/, _Exhibit-Index/, _00-Intake/) and is NOT filed but used for case preparation. Distinguished from filed work product by underscore-prefix folder location and "Draft"/"Internal"/"Working" labels.',
    identifying_signals: {
      filename_regex: [
        /memo|worksheet|internal|draft|sof.*memo|source.*of.*funds.*memo|proportionality|intake.*notes|case.*notes/i,
      ],
      keyword_phrases: [
        'Memo',
        'Memorandum',
        'Worksheet',
        'Internal',
        'Working Draft',
        'Draft',
        'Source-of-Funds Memo',
        'Proportionality Worksheet',
        'Case Intake',
        'Intake Notes',
        'Conflict Check',
      ],
      structural_hints: [
        'firm-template header',
        'underscore-prefix folder location (_Working-Drafts, _Exhibit-Index, _00-Intake)',
      ],
    },
    fills_proof_slots: [],
    extractor_skill: null,
    adequacy_criteria: [
      'Firm-template header',
      'Internal-only framing (Draft / Internal / Working labels)',
      'Not filed (filing_bound: never)',
    ],
    typical_aps: 2,
    filing_bound: 'never',
  },
  {
    id: 'unclassified_other',
    name: 'Unclassified / catch-all',
    category: 'other',
    definition:
      'Anything that does not fit any other doc_type — typically miscellaneous correspondence, news clips, marketing collateral, screenshots. Flagged for human review (heterogeneous by definition).',
    identifying_signals: {
      filename_regex: [
        /misc|other|screenshot|clip|news|flyer|marketing|brochure/i,
      ],
      keyword_phrases: [],
      structural_hints: [
        'no other variant signature scores high',
        'failure-to-match indicator',
      ],
    },
    fills_proof_slots: [],
    extractor_skill: null,
    adequacy_criteria: [
      'Flagged for attorney triage',
      'No other doc_type signature dominant',
    ],
    typical_aps: 1,
    filing_bound: 'optional',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// CONTRACTS, INVOICES, EQUIPMENT
// ───────────────────────────────────────────────────────────────────────────

const CONTRACTS_AND_INVOICES: DocType[] = [
  {
    id: 'vendor_contract',
    name: 'Vendor / service-provider contract',
    category: 'business_contract',
    definition:
      'Inverse of customer_contract — Petitioner is the BUYER contracting a vendor or service provider. Vendor letterhead; pricing flows the other way; SOW (Statement of Work) attachment common.',
    identifying_signals: {
      filename_regex: [
        /vendor.*agreement|service.*agreement|procurement|tedarikci|sow(?![a-z])/i,
      ],
      keyword_phrases: [
        'Vendor',
        'Service Agreement',
        'Service Provider',
        'Statement of Work',
        'SOW',
        'Goods',
        'Services',
        // Petitioner-as-Buyer indicators per E2_STRUCTURAL_VARIANTS Variant 2.
        'Customer',
        'Buyer',
        'Client',
        'Procurement',
        // Vendor-side pricing signals.
        'Vendor Pricing',
        'Service Fee',
        'Hourly Rate',
        'Deliverables',
      ],
    },
    fills_proof_slots: ['E3.operating_evidence', 'E2.in_process_walsh_pollard'],
    extractor_skill: 'contract',
    adequacy_criteria: [
      'Signed by both parties',
      'Petitioner identified as Customer / Buyer / Client',
      'SOW or pricing schedule attached',
      'Term active',
    ],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'supplier_contract',
    name: 'Supplier contract (operations)',
    category: 'business_contract',
    definition: 'Recurring supplier agreement.',
    identifying_signals: {
      filename_regex: [/supplier|tedarik/i],
      keyword_phrases: ['Supplier Agreement'],
    },
    fills_proof_slots: ['E3.operating_evidence'],
    extractor_skill: 'contract',
    adequacy_criteria: ['Signed', 'Active term'],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'customer_contract',
    name: 'Customer / offtake / supply agreement',
    category: 'business_contract',
    definition:
      'Contract under which a customer commits to buy from the Petitioner — anchors marginality + substantiality + revenue-capacity arguments. Petitioner is the SELLER; pricing schedule references units/volumes; delivery and acceptance clauses present.',
    identifying_signals: {
      // `\bagreement\b` / `\bcontract\b` catch generic naming
      // ("Indemnification Agreement.pdf", "Final Contract King Louis -
      // Daria.pdf"); customer-specific signals stay above so the
      // discriminator goes to customer_contract first.
      filename_regex: [
        /customer|client.*agreement|msa|sow|offtake|supply.*agreement|distribution.*agreement/i,
        /(?<![a-z])(agreement|contract)(?![a-z])/i,
      ],
      keyword_phrases: [
        'Customer',
        'Client',
        'Master Services Agreement',
        'Statement of Work',
        'Offtake Agreement',
        'Supply Agreement',
        'Agreement',
        'Indemnification',
        // Petitioner-as-Seller indicators per E2_STRUCTURAL_VARIANTS Variant 1.
        'Seller',
        'Supplier',
        'Provider',
        // Pricing / unit / volume signals.
        'Unit Price',
        'Per-Unit',
        'Pricing Schedule',
        'Quantity',
        'Volume',
        'Minimum Order',
        // Delivery / acceptance.
        'Delivery',
        'Acceptance',
        'Term',
        'Renewal',
        // Recital boilerplate.
        'WHEREAS',
      ],
    },
    fills_proof_slots: ['E3.operating_evidence', 'E4.financial_capacity'],
    extractor_skill: 'customer-contract',
    adequacy_criteria: [
      'Signed by both parties',
      'Compensation / pricing terms stated',
      'Petitioner identified as Seller / Supplier / Provider',
    ],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'franchise_agreement',
    name: 'Distribution / franchise / licensing agreement',
    category: 'business_contract',
    definition:
      'Territory-or-IP-grant contract — distribution rights, franchise terms, or trademark/IP license. Distinct from customer/vendor contracts because RIGHTS are granted (not goods/services sold). Carries territory + exclusivity grant, royalty/franchise-fee schedule, brand-standards / quality obligations, term + renewal + termination.',
    identifying_signals: {
      filename_regex: [
        /franchise.*agreement|distribution.*agreement|licensing.*agreement|license.*agreement|trademark.*license|bayilik.*sozlesme/i,
      ],
      keyword_phrases: [
        'Franchise Agreement',
        'Franchisee',
        'Franchisor',
        'Distribution Agreement',
        'License Agreement',
        'Licensee',
        'Licensor',
        // Territory / exclusivity per E2_STRUCTURAL_VARIANTS Variant 3.
        'Territory',
        'Exclusive Territory',
        'Non-Exclusive',
        'Exclusivity',
        // Royalty / franchise-fee.
        'Royalty',
        'Franchise Fee',
        'License Fee',
        'Initial Fee',
        'Continuing Fee',
        // Brand-standards / IP grants.
        'Brand Standards',
        'Quality Standards',
        'Trademark License',
        'IP License',
        'Trademark',
        'Operations Manual',
        // Foreign analogs.
        'Bayilik Sözleşmesi',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Bayilik Sözleşmesi / Franchise Sözleşmesi' },
    },
    fills_proof_slots: [
      'E2.investment_amount_proof',
      'E2.at_risk_evidence',
      'E3.business_formation',
    ],
    extractor_skill: 'contract',
    adequacy_criteria: [
      'Signed',
      'Territory + exclusivity definition present',
      'Royalty / franchise-fee schedule explicit',
      'Anti-restrictive paragraph triggers E-2 nuance review',
    ],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'fdd',
    name: 'Franchise Disclosure Document (FDD)',
    category: 'business_contract',
    definition: 'FTC-required Franchise Disclosure Document.',
    identifying_signals: {
      filename_regex: [/fdd|franchise.*disclosure/i],
      keyword_phrases: ['Franchise Disclosure Document', 'FDD', 'Item 1', 'Item 7', 'Item 19'],
    },
    fills_proof_slots: ['E2.proportionality_substantiality'],
    extractor_skill: null,
    adequacy_criteria: ['Current edition (annual update)', 'Item 7 cited for substantiality'],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'fdd_item7',
    name: 'FDD Item 7 — Estimated Initial Investment',
    category: 'industry_evidence',
    definition: 'FDD Item 7 table — franchise system\'s estimated initial investment range. Canonical substantiality benchmark for franchises.',
    identifying_signals: {
      filename_regex: [/item.?7|fdd.*item/i],
      keyword_phrases: ['Item 7', 'Estimated Initial Investment', 'Total'],
    },
    fills_proof_slots: ['E2.proportionality_substantiality'],
    extractor_skill: null,
    adequacy_criteria: ['Same edition as franchise agreement', 'Range cited explicitly'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'fdd_item19',
    name: 'FDD Item 19 — Financial Performance Representations',
    category: 'industry_evidence',
    definition: 'FDD Item 19 — historical financial performance disclosed by franchisor (when provided).',
    identifying_signals: {
      filename_regex: [/item.?19/i],
      keyword_phrases: ['Item 19', 'Financial Performance Representations'],
    },
    fills_proof_slots: ['E4.business_plan_5yr'],
    extractor_skill: null,
    adequacy_criteria: ['Includes representative units', 'Methodology disclosed'],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'incentive_grant_taxcredit',
    name: 'Incentive / grant / tax-credit instrument',
    category: 'business_contract',
    definition:
      'Government / agency instrument awarding the Petitioner an incentive, grant, tax credit, or production tax credit (PTC). Government / agency party (not commercial); contains performance conditions and reporting requirements. Routes to the bot incentiveDocument extractor.',
    identifying_signals: {
      filename_regex: [
        /incentive.*award|incentive.*letter|grant.*award|grant.*letter|tax.*credit|ptc(?![a-z])|ira.*credit|tesvik.*belge|hibe.*destek/i,
      ],
      keyword_phrases: [
        'Incentive',
        'Grant',
        'Tax Credit',
        'Production Tax Credit',
        'PTC',
        'Investment Tax Credit',
        'ITC',
        'IRA',
        'Inflation Reduction Act',
        'Award Letter',
        'Award Notice',
        // Performance / reporting clauses per E2_STRUCTURAL_VARIANTS Variant 4.
        'Performance Conditions',
        'Performance Period',
        'Reporting Requirements',
        'Compliance Reporting',
        'Recapture',
        'Clawback',
        // Government-agency letterhead signals.
        'Department of',
        'Agency',
        'State of',
        'Economic Development',
        // Foreign analogs.
        'Teşvik Belgesi',
        'Devlet Yardımı',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Teşvik Belgesi / Devlet Yardımı Sözleşmesi' },
    },
    fills_proof_slots: [
      'E2.investment_amount_proof',
      'E3.operating_evidence',
      'E4.financial_capacity',
    ],
    extractor_skill: null,
    adequacy_criteria: [
      'Government / agency letterhead',
      'Recipient block names Petitioner-entity',
      'Performance conditions and reporting requirements explicit',
      'Award amount or rate stated',
    ],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'partnership_jv_alliance',
    name: 'Partnership / JV / strategic-alliance agreement',
    category: 'business_contract',
    definition:
      'Bilateral or multilateral agreement establishing a partnership, joint venture, or strategic alliance — neither pure sale nor pure purchase. Contains capital-contribution schedule, governance, profit-sharing, exit / dissolution. Multi-party signature page (3+ signatories common).',
    identifying_signals: {
      filename_regex: [
        /partnership.*agreement|joint.*venture|jv.*agreement|alliance.*agreement|strategic.*alliance|ortaklik.*sozlesme/i,
      ],
      keyword_phrases: [
        'Partnership Agreement',
        'Joint Venture',
        'JV Agreement',
        'Strategic Alliance',
        'Alliance Agreement',
        // Multi-party + capital + profit signals per E2_STRUCTURAL_VARIANTS Variant 5.
        'Capital Contribution',
        'Capital Contributions',
        'Profit Sharing',
        'Profit Distribution',
        'Loss Allocation',
        'Governance',
        'Management Committee',
        // Exit / dissolution.
        'Exit',
        'Dissolution',
        'Wind-up',
        'Termination',
        // Foreign analogs.
        'Ortaklık Sözleşmesi',
        'Stratejik İşbirliği',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Ortaklık Sözleşmesi / Stratejik İşbirliği' },
      de: { native_name: 'Joint-Venture-Vertrag' },
      fr: { native_name: 'Accord de Coentreprise' },
    },
    fills_proof_slots: [
      'E1.entity_treaty_ownership',
      'E3.operating_evidence',
    ],
    extractor_skill: 'contract',
    adequacy_criteria: [
      'Multi-party signature page (typically 3+ signatories)',
      'Capital-contribution schedule attached',
      'Profit-sharing / distribution clause explicit',
      'Governance and exit clauses present',
    ],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'vendor_invoice',
    name: 'Vendor invoice (B2B, services or supplies)',
    category: 'invoice_or_receipt',
    definition:
      'Single-page B2B vendor invoice to the Petitioner for goods or services. Distinguished from retail receipt by "Bill To" block + invoice number + line-item table; from professional-services invoice by absence of time-entry table. Tab G.5 vendor-invoices anchor.',
    identifying_signals: {
      filename_regex: [
        /invoice|fatura|inv[-_]?\d|bill[-_]\d|rechnung|facture/i,
      ],
      keyword_phrases: [
        'Invoice',
        'Fatura',
        'Bill To',
        'Sold To',
        'Ship To',
        'Total Due',
        'Subtotal',
        'Amount Due',
        'Invoice Number',
        'Invoice Date',
        'Due Date',
        'Tax Total',
        'Sales Tax',
        // Line-item table signals per E2_STRUCTURAL_VARIANTS Variant 1.
        'Description',
        'Qty',
        'Quantity',
        'Unit Price',
        'Line Total',
        'Payment Terms',
        'Net 30',
        'Net 60',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Fatura' },
      de: { native_name: 'Rechnung' },
      fr: { native_name: 'Facture' },
    },
    fills_proof_slots: ['E3.operating_evidence'],
    extractor_skill: 'bank-receipt',
    adequacy_criteria: [
      'Vendor identified (letterhead)',
      '"Bill To" block contains Petitioner-entity',
      'Line-item table with qty + unit price',
      'Amount and date clear',
    ],
    typical_aps: 3,
    filing_bound: 'optional',
  },
  {
    id: 'retail_receipt',
    name: 'Retail / point-of-sale receipt',
    category: 'invoice_or_receipt',
    definition:
      'Short receipt for a retail purchase (equipment, supplies, build-out materials). Often photographed rather than scanned. Distinguished from vendor_invoice by narrow aspect ratio (thermal receipt), absence of "Bill To" block, and merchant-not-vendor lexicon. Filename regex deliberately requires POS/store/cashier/register co-occurrence so bare "receipt" / "makbuz" still routes to paid_invoice (the firm uses those terms for general expense receipts).',
    identifying_signals: {
      filename_regex: [
        /pos.*receipt|retail.*receipt|cash.*receipt|store.*receipt|register.*receipt|till.*receipt|yazarkasa.*fis|kasa.*fis/i,
      ],
      keyword_phrases: [
        'Makbuz',
        'Receipt',
        'POS',
        'Register',
        // Retail merchant-context signals per E2_STRUCTURAL_VARIANTS Variant 2.
        'Cashier',
        'Cashier ID',
        'Register #',
        'Store',
        'Thank you for shopping',
        'Visit us at',
        // Payment-method line.
        'Cash',
        'Card',
        'Visa',
        'Mastercard',
        'Last4',
        'Last Four',
        'Auth Code',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Makbuz / Yazarkasa Fişi' },
    },
    fills_proof_slots: ['E2.at_risk_evidence', 'E3.operating_evidence'],
    extractor_skill: 'bank-receipt',
    adequacy_criteria: [
      'Merchant header (no "Bill To")',
      'Cashier / register ID line',
      'Payment-method line (Cash / Card / Last4)',
    ],
    typical_aps: 2,
    filing_bound: 'optional',
  },
  {
    id: 'professional_services_invoice',
    name: 'Professional-services invoice (legal / accounting / consulting)',
    category: 'invoice_or_receipt',
    definition:
      'Time-and-materials professional invoice with itemized hours. Distinguished from vendor_invoice by time-entry table (timekeeper / hours / rate / amount) and professional-firm letterhead aesthetic. Tab F "Legal Fee Invoice" exhibit is canonical.',
    identifying_signals: {
      filename_regex: [
        /legal.*fee|retainer.*invoice|consulting.*invoice|hourly.*invoice|professional.*fee|avukat.*fatura|attorney.*invoice/i,
      ],
      keyword_phrases: [
        'Legal Fees',
        'Attorney Fees',
        'Retainer',
        'Trust Account',
        'IOLTA',
        'Consulting Fees',
        'Professional Fees',
        // Time-entry table signals per E2_STRUCTURAL_VARIANTS Variant 4.
        'Timekeeper',
        'Hours',
        'Rate',
        'Hourly Rate',
        'Time Entry',
        'Billable',
        'Date',
        'Description',
        // Bar / professional license footer.
        'Bar Number',
        'Bar No.',
        'CPA License',
        'PE License',
      ],
    },
    fills_proof_slots: ['E2.at_risk_evidence', 'E2.in_process_walsh_pollard'],
    extractor_skill: 'bank-receipt',
    adequacy_criteria: [
      'Time-entry table with timekeeper / hours / rate',
      'Professional-firm letterhead',
      'Bar-license / professional-license footer (legal/CPA/PE)',
    ],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'paid_invoice',
    name: 'Paid invoice (receipt)',
    category: 'invoice_or_receipt',
    definition: 'Invoice marked paid — evidence funds were spent (at risk).',
    identifying_signals: {
      filename_regex: [
        /paid|receipt|odendi|facture|recu|recibo|rechnung|makbuz/i,
        // Bare "$<amount>" or "payment" in filename — covers attorney
        // expense exports like "07.02.25 $105.13.pdf", "$10,000
        // payment.pdf", "branding design - april - 1000.pdf".
        /\$\s*\d|(?<![a-z])payment(?![a-z])/i,
        // Monthly expense summary pattern: "1- January 25.pdf",
        // "2- February 2024.pdf", "5 -August 24.pdf". These are
        // attorney-curated month-bucket expense rolls.
        /\b\d+\s*-\s*(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
        // Common SaaS / vendor subscription filenames the attorney
        // exports as expense evidence. Pattern is purposely narrow:
        // brand names, not generic words.
        // Note: "adobe" omitted — overlaps with Adobe Photoshop
        // certificate filenames; an Adobe subscription invoice should
        // have "$" or "invoice" in the name and hit the patterns above.
        /(?<![a-z])(godaddy|go.daddy|google.workspace|stripe|shopify|aws|microsoft.365|domain|workspace|agency.subs|subscription)(?![a-z])/i,
      ],
      keyword_phrases: [
        'Paid',
        'Payment Received',
        'Receipt',
        'Paid in Full',
        'Amount Paid',
        'Payment Confirmation',
        'Facture',
        'Reçu',
        'Rechnung',
      ],
    },
    fills_proof_slots: ['E2.investment_amount_proof', 'E2.at_risk_evidence', 'E2.in_process_walsh_pollard'],
    extractor_skill: 'bank-receipt',
    adequacy_criteria: ['"Paid" stamp or zero balance', 'Payee matches vendor'],
    typical_aps: 4,
    filing_bound: 'always',
  },
  {
    id: 'equipment_po',
    name: 'Equipment purchase order',
    category: 'invoice_or_receipt',
    definition: 'Purchase order for business equipment — supports at-risk + Walsh & Pollard.',
    identifying_signals: {
      filename_regex: [/purchase.*order|po\b|equipment/i],
      keyword_phrases: ['Purchase Order', 'PO #', 'Equipment'],
    },
    fills_proof_slots: ['E2.at_risk_evidence', 'E2.in_process_walsh_pollard'],
    extractor_skill: 'bank-receipt',
    adequacy_criteria: ['Executed (signed/confirmed)', 'Paired with payment proof'],
    typical_aps: 3,
    filing_bound: 'optional',
  },
  {
    id: 'delivery_receipt',
    name: 'Delivery receipt',
    category: 'invoice_or_receipt',
    definition: 'Signed delivery receipt confirming receipt of goods.',
    identifying_signals: {
      filename_regex: [/delivery|teslim/i],
      keyword_phrases: ['Delivered', 'Signed for'],
    },
    fills_proof_slots: ['E3.operating_evidence'],
    extractor_skill: null,
    adequacy_criteria: ['Recipient signature', 'Date'],
    typical_aps: 3,
    filing_bound: 'optional',
  },
  {
    id: 'merchant_processing_approval',
    name: 'Merchant processing approval (Stripe/Square/etc.)',
    category: 'merchant_processing',
    definition: 'Approval letter or onboarding confirmation from a merchant processor.',
    identifying_signals: {
      filename_regex: [/stripe|square|merchant|paypal/i],
      keyword_phrases: ['Stripe', 'Square', 'Merchant Account', 'Welcome to'],
    },
    fills_proof_slots: ['E3.operating_evidence', 'E2.in_process_walsh_pollard'],
    extractor_skill: null,
    adequacy_criteria: ['Account active (not "pending review")', 'Entity name matches Articles'],
    typical_aps: 4,
    filing_bound: 'optional',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// PERMITS, LICENSES, INSURANCE
// ───────────────────────────────────────────────────────────────────────────

const PERMITS: DocType[] = [
  {
    id: 'state_business_license',
    name: 'State business license',
    category: 'permits_licenses',
    definition: 'State-issued license to operate a business.',
    identifying_signals: {
      filename_regex: [/business.*license|state.*license/i],
      keyword_phrases: ['Business License', 'License Number'],
    },
    fills_proof_slots: ['E3.licenses_permits'],
    extractor_skill: 'incentive-document',
    adequacy_criteria: ['Current (not expired)', 'Entity name matches Articles'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'food_permit',
    name: 'Food service permit',
    category: 'permits_licenses',
    definition: 'Health-department food service permit (required for restaurants/cafés).',
    identifying_signals: {
      filename_regex: [/food.*permit|health.*permit|food.*service/i],
      keyword_phrases: ['Food Service', 'Health Department', 'Permit'],
    },
    fills_proof_slots: ['E3.licenses_permits'],
    extractor_skill: 'incentive-document',
    adequacy_criteria: ['Current', 'Premises address matches lease'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'liquor_license',
    name: 'Liquor license',
    category: 'permits_licenses',
    definition: 'State liquor license (when alcohol is served).',
    identifying_signals: {
      filename_regex: [/liquor|abc.*license|alcohol/i],
      keyword_phrases: ['Liquor License', 'Alcohol Beverage', 'ABC'],
    },
    fills_proof_slots: ['E3.licenses_permits'],
    extractor_skill: 'incentive-document',
    adequacy_criteria: ['Current', 'Type matches operations'],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'professional_business_license',
    name: 'Professional license',
    category: 'permits_licenses',
    definition: 'State professional license (medical, dental, law, accounting, real estate, etc.).',
    identifying_signals: {
      filename_regex: [/professional.*license|state.*license/i],
      keyword_phrases: ['Professional License', 'License Number'],
    },
    fills_proof_slots: ['E3.licenses_permits', 'E5.specialized_knowledge_pack'],
    extractor_skill: 'credential',
    adequacy_criteria: ['Current', 'Holder matches principal or staff'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'health_department_permit',
    name: 'Health department permit',
    category: 'permits_licenses',
    definition: 'Health department permit (clinics, salons, food, etc.).',
    identifying_signals: {
      filename_regex: [/health.*department|health.*permit/i],
      keyword_phrases: ['Health Department', 'Permit'],
    },
    fills_proof_slots: ['E3.licenses_permits'],
    extractor_skill: 'incentive-document',
    adequacy_criteria: ['Current'],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'contractor_license',
    name: 'Contractor / trades license',
    category: 'permits_licenses',
    definition: 'State contractor or trades license (GC, electrical, plumbing, HVAC).',
    identifying_signals: {
      filename_regex: [/contractor.*license|trades?.*license/i],
      keyword_phrases: ['Contractor License', 'License Number'],
    },
    fills_proof_slots: ['E3.licenses_permits'],
    extractor_skill: 'credential',
    adequacy_criteria: ['Current', 'Class matches operations'],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'insurance_general_liability',
    name: 'General liability insurance binder',
    category: 'insurance',
    definition: 'General liability insurance certificate of coverage.',
    identifying_signals: {
      filename_regex: [/gl.*insurance|general.*liability|coi/i],
      keyword_phrases: ['Certificate of Insurance', 'General Liability', 'Coverage'],
    },
    fills_proof_slots: ['E3.licenses_permits'],
    extractor_skill: null,
    adequacy_criteria: ['Current term', 'Insured matches entity'],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'insurance_workers_comp',
    name: 'Workers\' comp insurance',
    category: 'insurance',
    definition: 'Workers\' compensation insurance certificate.',
    identifying_signals: {
      filename_regex: [/workers.*comp|wc.*insurance/i],
      keyword_phrases: ['Workers\' Compensation', 'WC'],
    },
    fills_proof_slots: ['E3.licenses_permits'],
    extractor_skill: null,
    adequacy_criteria: ['Current term', 'Required when employees present'],
    typical_aps: 4,
    filing_bound: 'optional',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// INDUSTRY EVIDENCE
// ───────────────────────────────────────────────────────────────────────────

const INDUSTRY_EVIDENCE: DocType[] = [
  {
    id: 'industry_evidence_ibisworld',
    name: 'IBISWorld industry report',
    category: 'industry_evidence',
    definition: 'IBISWorld industry profile — premier substantiality benchmark.',
    identifying_signals: {
      filename_regex: [/ibis.?world|ibis/i],
      keyword_phrases: ['IBISWorld', 'IBIS World', 'Industry Report'],
    },
    fills_proof_slots: ['E2.proportionality_substantiality'],
    extractor_skill: null,
    adequacy_criteria: ['NAICS code cited', 'Report ≤ 24 months old'],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'industry_evidence_bls_qcew',
    name: 'BLS QCEW data',
    category: 'industry_evidence',
    definition: 'Bureau of Labor Statistics — Quarterly Census of Employment and Wages.',
    identifying_signals: {
      filename_regex: [/bls|qcew/i],
      keyword_phrases: ['Bureau of Labor Statistics', 'QCEW', 'Quarterly Census'],
    },
    fills_proof_slots: ['E2.proportionality_substantiality'],
    extractor_skill: null,
    adequacy_criteria: ['NAICS and geography cited'],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'industry_evidence_fred',
    name: 'FRED economic data',
    category: 'industry_evidence',
    definition: 'St. Louis Fed FRED economic data series.',
    identifying_signals: {
      filename_regex: [/fred/i],
      keyword_phrases: ['FRED', 'Federal Reserve Economic Data'],
    },
    fills_proof_slots: ['E2.proportionality_substantiality'],
    extractor_skill: null,
    adequacy_criteria: ['Series ID cited', 'Date range cited'],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'industry_evidence_statista',
    name: 'Statista report',
    category: 'industry_evidence',
    definition: 'Statista market data.',
    identifying_signals: {
      filename_regex: [/statista/i],
      keyword_phrases: ['Statista'],
    },
    fills_proof_slots: ['E2.proportionality_substantiality'],
    extractor_skill: null,
    adequacy_criteria: ['Statista citation included', 'Recent'],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'industry_evidence_census_acs',
    name: 'Census ACS data',
    category: 'industry_evidence',
    definition: 'U.S. Census American Community Survey — geography/demography substantiality.',
    identifying_signals: {
      filename_regex: [/census|acs/i],
      keyword_phrases: ['American Community Survey', 'U.S. Census', 'ACS'],
    },
    fills_proof_slots: ['E2.proportionality_substantiality'],
    extractor_skill: null,
    adequacy_criteria: ['Table ID cited', 'Geography matches business location'],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'market_study',
    name: 'Custom market study',
    category: 'industry_evidence',
    definition: 'Engaged-firm market study or feasibility analysis.',
    identifying_signals: {
      filename_regex: [/market.*study|feasibility/i],
      keyword_phrases: ['Market Study', 'Feasibility Analysis'],
    },
    fills_proof_slots: ['E2.proportionality_substantiality', 'E4.business_plan_5yr'],
    extractor_skill: null,
    adequacy_criteria: ['Author/firm credentialed', 'Methodology disclosed'],
    typical_aps: 4,
    filing_bound: 'optional',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// PAYROLL & EMPLOYMENT
// ───────────────────────────────────────────────────────────────────────────

const PAYROLL_EMPLOYMENT: DocType[] = [
  {
    id: 'payroll_register',
    name: 'Payroll register / pay run report',
    category: 'payroll',
    definition:
      "Periodic payroll-provider report listing each employee's gross / net / deductions for the pay period. Provider-generated (Gusto, ADP, Paychex, QuickBooks Payroll). Distinguished by per-employee row structure with Gross/Federal-WH/State-WH/FICA/Net columns + YTD totals. Drives the marginality us_workers_employed flag.",
    identifying_signals: {
      filename_regex: [
        /payroll.*register|pay.?run|pay.?register|pay.?period|bordro|gusto.*payroll|adp.*payroll|paychex.*payroll/i,
      ],
      keyword_phrases: [
        'Payroll Register',
        'Pay Run',
        'Pay Register',
        'Pay Period',
        // Per-employee tabular columns per E2_STRUCTURAL_VARIANTS Variant 1.
        'Gross Pay',
        'Net Pay',
        'Federal Withholding',
        'State Withholding',
        'FICA',
        'Social Security',
        'Medicare',
        'YTD',
        'Year-to-Date',
        // Provider-footer signals.
        'Powered by Gusto',
        'ADP',
        'Paychex',
        'QuickBooks Payroll',
        // Foreign analog.
        'Bordro',
        'Maaş Bordrosu',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Bordro / Maaş Bordrosu' },
    },
    fills_proof_slots: ['E4.hiring_timetable'],
    extractor_skill: 'payroll',
    adequacy_criteria: [
      'Provider letterhead (ADP/Gusto/Paychex/QuickBooks)',
      'Period covered stated',
      'Per-employee row with gross/net/withholding columns',
      'YTD column present',
    ],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'form_941_quarterly',
    name: "Form 941 — quarterly federal employer tax return",
    category: 'payroll',
    definition:
      'Quarterly federal employer tax return summarizing total wages + federal withholding + FICA for the quarter. Used in renewals to evidence quarter-by-quarter workforce continuity. Distinguished by IRS form code "941" and quarter-checkbox grid.',
    identifying_signals: {
      filename_regex: [
        /941(?![a-z])|form.?941|quarterly.*employer|quarterly.*tax.*return|futa/i,
      ],
      keyword_phrases: [
        'Form 941',
        '941',
        "Employer's QUARTERLY Federal Tax Return",
        'Quarterly Federal',
        // Quarter checkbox grid per E2_STRUCTURAL_VARIANTS Variant 3.
        'Quarter',
        'Q1',
        'Q2',
        'Q3',
        'Q4',
        '1: January, February, March',
        '2: April, May, June',
        '3: July, August, September',
        '4: October, November, December',
        // FICA / wage line items.
        'Total wages',
        'Total federal income tax',
        'Social security wages',
        'Medicare wages',
        // IRS letterhead.
        'Department of the Treasury',
        'Internal Revenue Service',
        'OMB No. 1545-0029',
      ],
    },
    fills_proof_slots: ['E3.tax_compliance', 'E4.hiring_timetable'],
    extractor_skill: 'payroll',
    adequacy_criteria: [
      'Form code "941" in header',
      'Quarter checkbox grid present',
      'Employer EIN matches U.S. enterprise',
      'IRS letterhead',
    ],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'employee_roster',
    name: 'Employee list / org chart payroll snapshot',
    category: 'payroll',
    definition:
      'Simplified employee-list document — name + title + start date + status — without dollar figures. Used when proving workforce COUNT but not specific wages. Distinguished from payroll_register by absence of dollar columns and static-snapshot framing.',
    identifying_signals: {
      filename_regex: [
        /employee.?list|roster|headcount|org.?chart|personnel.?list|personel.?listesi|staff.?list|team.?roster/i,
      ],
      keyword_phrases: [
        'Employee List',
        'Roster',
        'Headcount',
        'Personnel List',
        'Staff Roster',
        'Team Roster',
        // Foreign analog.
        'Personel Listesi',
        // Per-employee row WITHOUT dollar columns per E2_STRUCTURAL_VARIANTS Variant 4.
        'Name',
        'Title',
        'Position',
        'Start Date',
        'Date of Hire',
        'Status',
        'Full-Time',
        'Part-Time',
        'Hours/wk',
        'Hours per Week',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Personel Listesi / Çalışan Listesi' },
    },
    fills_proof_slots: ['E4.hiring_timetable', 'E5.executive_supervisory_authority'],
    extractor_skill: null,
    adequacy_criteria: [
      'Per-employee row without dollar columns',
      'Start-date column',
      'Title / position stated',
      'Status (full/part-time) noted',
    ],
    typical_aps: 3,
    filing_bound: 'optional',
  },
  {
    id: 'payroll_provider_contract',
    name: 'Payroll provider contract',
    category: 'payroll',
    definition: 'Service agreement with payroll provider (ADP, Gusto, Paychex).',
    identifying_signals: {
      filename_regex: [/adp|gusto|paychex|payroll.*service/i],
      keyword_phrases: ['Payroll Service', 'ADP', 'Gusto'],
    },
    fills_proof_slots: ['E3.operating_evidence'],
    extractor_skill: 'contract',
    adequacy_criteria: ['Active subscription'],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'w2',
    name: 'Wage / withholding statement — Form W-2 / 1099',
    category: 'payroll',
    definition:
      "Year-end wage summary form: US W-2 (3-up or 4-up boxes), 1099-NEC, or 1099-MISC. Single page, multi-box layout (4-6 mini-form copies in a 2x2 or 3x2 grid). Distinguished from full tax returns by tiny grid-based pre-printed layout and single-year scope (no schedules).",
    identifying_signals: {
      filename_regex: [
        /w.?2(?![a-z])|w-?2(?![a-z])|wage.*tax|1099(?:.?nec|.?misc|.?int|.?div|.?r)?|wage.*statement/i,
      ],
      keyword_phrases: [
        'Form W-2',
        'Form W2',
        'W-2',
        'Wage and Tax Statement',
        // 1099 family per E2_STRUCTURAL_VARIANTS Variant 4.
        'Form 1099',
        '1099-NEC',
        '1099-MISC',
        '1099-INT',
        '1099-DIV',
        // Multi-up grid + numbered box pattern.
        'Box 1',
        'Box 2',
        'Box 3',
        'Box 4',
        'Box 5',
        'Wages, tips, other compensation',
        'Federal income tax withheld',
        'Social security wages',
        'Medicare wages',
        // Employer/employee dual identifier block.
        "Employer's name",
        "Employer's EIN",
        "Employee's SSN",
      ],
    },
    fills_proof_slots: ['E4.hiring_timetable'],
    extractor_skill: 'payroll',
    adequacy_criteria: [
      'Employer EIN matches U.S. enterprise',
      'Issued for tax year',
      'Multi-up box layout (W-2 typical) or single 1099 form',
    ],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'offer_letter',
    name: 'Job-offer letter (US Petitioner → Beneficiary)',
    category: 'employment_evidence',
    definition:
      'Forward-looking offer letter from US Petitioner to Beneficiary setting position, compensation, status, reporting line, and contingencies (visa / background). Distinguished from VOE / recommendation by forward-looking start-date and visa-contingency clause. Routes to the jobOffer extractor; drives salary-below-benchmark and CV-vs-offer drift gates.',
    identifying_signals: {
      filename_regex: [
        /offer.*letter|employment.*offer|job.*offer|is.*teklifi/i,
      ],
      keyword_phrases: [
        'Offer of Employment',
        'Job Offer',
        'Employment Offer',
        'Position',
        'Salary',
        'Start Date',
        // Forward-looking + reporting + status per E2_STRUCTURAL_VARIANTS Variant 4.
        'reporting to',
        'Annual Compensation',
        'Base Salary',
        'Bonus',
        'Full-Time',
        'Part-Time',
        'Exempt',
        'Non-Exempt',
        // Visa contingency (single strongest signal vs other employer letters).
        'subject to E-2',
        'subject to visa',
        'contingent upon',
        'visa contingency',
        'visa approval',
        'background check',
        // Foreign analog.
        'İş Teklifi',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'İş Teklif Mektubu' },
    },
    fills_proof_slots: ['E4.hiring_timetable', 'E5.executive_supervisory_authority'],
    extractor_skill: 'job-offer',
    adequacy_criteria: [
      'Signed by Petitioner officer + Beneficiary (or Beneficiary countersign)',
      'Forward-looking start-date',
      'Compensation explicit',
      'Visa contingency clause present (E-2-typical)',
    ],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'job_description',
    name: 'Job description',
    category: 'employment_evidence',
    definition: 'Job description for a U.S. position — duties, requirements, scope.',
    identifying_signals: {
      filename_regex: [/job.*description|position.*description/i],
      keyword_phrases: ['Job Description', 'Position Description', 'Duties'],
    },
    fills_proof_slots: ['E4.hiring_timetable', 'E5.executive_supervisory_authority'],
    extractor_skill: 'job-offer',
    adequacy_criteria: ['Clear duties', 'Reporting line stated'],
    typical_aps: 3,
    filing_bound: 'optional',
  },
  {
    id: 'hiring_timetable',
    name: 'Hiring timetable',
    category: 'employment_evidence',
    definition: 'Quarter-by-quarter hiring projection for the 5-year window.',
    identifying_signals: {
      filename_regex: [/hiring.*timetable|hiring.*plan/i],
      keyword_phrases: ['Hiring Timetable', 'Year 1', 'Year 5', 'Position'],
    },
    fills_proof_slots: ['E4.hiring_timetable'],
    extractor_skill: null,
    adequacy_criteria: ['Roles, dates, wages projected', 'No critical hires past Year 5'],
    typical_aps: 3,
    filing_bound: 'always',
  },
  {
    id: 'employment_record_us',
    name: 'U.S. employment record / verification letter / I-9',
    category: 'employment_evidence',
    definition:
      'Formal HR letter (Verification of Employment / VOE) confirming employment dates, position, salary, and full-time status — typically formulaic, single page, HR-department signer (not direct supervisor). Distinguished from recommendation_letter by structured fields and from offer_letter by historical (not forward-looking) framing. Includes Form I-9 employment-eligibility verification.',
    identifying_signals: {
      filename_regex: [
        /employment.*record|verification.*employment|voe(?![a-z])|hr.*letter|(?<![a-z0-9])i-?9(?![a-z0-9])/i,
      ],
      keyword_phrases: [
        'employed',
        'verification of employment',
        'Verification of Employment',
        'VOE',
        'Form I-9',
        'Employment Eligibility Verification',
        // Formulaic VOE field-block signals per E2_STRUCTURAL_VARIANTS Variant 2.
        'Start Date',
        'End Date',
        'Date of Hire',
        'Position',
        'Title',
        'Salary',
        'Annual Salary',
        'Hourly Rate',
        'Employment Status',
        'Full-Time',
        'Part-Time',
        // HR-department signer.
        'Human Resources',
        'HR Department',
        'HR Manager',
        'HR Director',
      ],
    },
    fills_proof_slots: ['E5.executive_supervisory_authority'],
    extractor_skill: null,
    adequacy_criteria: [
      'Employer letterhead',
      'Signed by HR-department officer',
      'Field-style format (Start/End/Position/Salary)',
    ],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'employment_record_treaty_country',
    name: 'Treaty-country employment record',
    category: 'employment_evidence',
    definition: 'Treaty-country employer letter / SGK record / similar.',
    identifying_signals: {
      filename_regex: [/sgk|hizmet.*belge|employment.*verification/i],
      keyword_phrases: ['SGK Hizmet Dökümü', 'Employment Verification'],
    },
    foreign_language_equivalents: { tr: { native_name: 'SGK Hizmet Dökümü' } },
    fills_proof_slots: ['E1.cbi_amigos_domicile', 'E5.specialized_knowledge_pack'],
    extractor_skill: 'service-record',
    adequacy_criteria: ['Government or employer letterhead', 'Translation'],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'salary_payslip_treaty_country',
    name: 'Treaty-country salary payslip',
    category: 'employment_evidence',
    definition: 'Salary payslip from treaty country — supports salary-origin SOF.',
    identifying_signals: {
      filename_regex: [/payslip|paystub|paystubs|maas.*bordro|gehaltsabrechnung|bulletin.*paie|fiche.*paie|nomina/i],
      keyword_phrases: ['Maaş Bordrosu', 'Net Salary', 'Gross Salary', 'Bulletin de Paie', 'Fiche de Paie', 'Pay Stub', 'Earnings Statement'],
    },
    foreign_language_equivalents: { tr: { native_name: 'Maaş Bordrosu' } },
    fills_proof_slots: ['E2.SOF.origin_evidence'],
    extractor_skill: 'payroll',
    adequacy_criteria: ['Employer letterhead', 'Multiple periods preferred'],
    typical_aps: 4,
    filing_bound: 'optional',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// CREDENTIALS (Subtype-4)
// ───────────────────────────────────────────────────────────────────────────

const CREDENTIALS: DocType[] = [
  {
    id: 'cv',
    name: 'Narrative chronological CV / résumé',
    category: 'credentials',
    definition:
      "Long-form chronological CV — 2-6 pages, reverse-chrono with summary, experience, education, skills. Distinguished from academic CV by absence of publications/grants sections and shorter page count.",
    identifying_signals: {
      filename_regex: [
        /cv(?![a-z])|resume|curriculum.*vitae|ozgecmis|lebenslauf/i,
      ],
      keyword_phrases: [
        'Curriculum Vitae',
        'CV',
        'Resume',
        'Résumé',
        'Özgeçmiş',
        'Lebenslauf',
        // Reverse-chrono experience pattern per E2_STRUCTURAL_VARIANTS Variant 1.
        'Experience',
        'Work Experience',
        'Professional Experience',
        'Education',
        'Skills',
        'Languages',
        'Certifications',
        'Summary',
        'Objective',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Özgeçmiş' },
      de: { native_name: 'Lebenslauf' },
      fr: { native_name: 'Curriculum Vitae' },
    },
    fills_proof_slots: ['E5.specialized_knowledge_pack'],
    extractor_skill: 'cv',
    adequacy_criteria: [
      'Reverse-chrono experience pattern',
      'Includes employer + title + dates',
      'Education with degree + institution + year',
    ],
    typical_aps: 3,
    filing_bound: 'always',
  },
  {
    id: 'cv_academic',
    name: 'Academic / research CV (publications + appointments)',
    category: 'credentials',
    definition:
      'Long, publication-heavy academic CV including appointments, grants, teaching, peer-review. Distinguished from narrative CV by Publications section (bibliographic entries), grant-funding section, and long page count (10-30 pages).',
    identifying_signals: {
      filename_regex: [
        /academic.*cv|research.*cv|faculty.*cv|publications.*cv|cv.*academic/i,
      ],
      keyword_phrases: [
        // Academic-CV-specific section heads per E2_STRUCTURAL_VARIANTS Variant 2.
        'Publications',
        'Selected Publications',
        'Peer-Reviewed',
        'Conference Proceedings',
        'Grants',
        'Funding',
        'Awards and Honors',
        'Teaching',
        'Teaching Experience',
        'Peer Review',
        'Editorial Service',
        'Professional Service',
        // Bibliographic-entry indicators.
        'Journal of',
        'Proceedings of',
        'Vol.',
        'pp.',
        'doi:',
      ],
    },
    fills_proof_slots: ['E5.specialized_knowledge_pack'],
    extractor_skill: 'cv',
    adequacy_criteria: [
      'Publications section with bibliographic entries',
      'Grant / funding section',
      'Page count ≥ 10',
    ],
    typical_aps: 3,
    filing_bound: 'optional',
  },
  {
    id: 'service_record',
    name: 'Foreign-government / institutional service record',
    category: 'credentials',
    definition:
      'Foreign-government or large-institution-issued formal service record — Turkish Hizmet Belgesi, military service record, civil-service tenure certificate. Distinguished from VOE by government / quasi-government issuer + multi-period history table + official wet-ink stamp. Subtype-4 essential-skills anchor + 9 FAM 402.9-7(2)(b) salary-differential argument.',
    identifying_signals: {
      filename_regex: [
        /service.*record|hizmet.*kayit|hizmet.*belge|civil.*service|military.*service|sgk.*hizmet/i,
      ],
      keyword_phrases: [
        'Service Record',
        'Hizmet Kaydı',
        'Hizmet Belgesi',
        'Employed since',
        // Multi-period history table per E2_STRUCTURAL_VARIANTS Variant 3.
        'Position History',
        'Tenure',
        'Period of Service',
        'Years of Service',
        // Government / institutional letterhead + seal.
        'Ministry',
        'Bakanlığı',
        'Civil Service',
        'Military',
        'TSK',
        'Personnel Department',
        // Official stamp / employee-ID indicators.
        'Employee ID',
        'Sicil No',
        'Personnel Number',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Hizmet Belgesi / SGK Hizmet Dökümü' },
    },
    fills_proof_slots: ['E5.specialized_knowledge_pack'],
    extractor_skill: 'service-record',
    adequacy_criteria: [
      'Government / institutional letterhead with seal',
      'Specifies role and tenure across multiple periods',
      'Official wet-ink stamp present',
      'Certified translation if non-English',
    ],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'diploma',
    name: 'Diploma / degree certificate',
    category: 'credentials',
    definition:
      "Single-page formal university-issued certificate awarding a degree. Ornamental layout with institutional crest; degree-name + field-of-study; date; two officer-signature blocks (President/Rector + Dean). Distinguished from transcript by single page + ornamental border + no per-course detail.",
    identifying_signals: {
      filename_regex: [
        /diploma|diplom|degree|mezuniyet.*belge|abschluss|bachelor|master|phd|doktora/i,
      ],
      keyword_phrases: [
        'Diploma',
        'Diplom',
        'Bachelor',
        "Bachelor's",
        'Master',
        "Master's",
        'Doctor',
        'Doctorate',
        'PhD',
        'Doktora',
        'Mezuniyet',
        // Ornamental layout per E2_STRUCTURAL_VARIANTS Variant 1.
        'has been awarded',
        'is hereby conferred',
        'has fulfilled',
        'has completed the requirements',
        // Officer-signature signals.
        'President',
        'Rector',
        'Dean',
        'Chancellor',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Diploma / Mezuniyet Belgesi' },
      de: { native_name: 'Diplom / Zeugnis' },
      fr: { native_name: 'Diplôme' },
    },
    fills_proof_slots: ['E5.specialized_knowledge_pack'],
    extractor_skill: 'credential',
    adequacy_criteria: ['Institution accredited', 'Translation if non-English'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'academic_transcript',
    name: 'Academic transcript / record',
    category: 'credentials',
    definition:
      'Multi-page academic record listing courses, grades, credits, GPA, and dates. Distinguished from diploma by tabular per-course structure, multi-page, and presence of grade column. Used in essential-skills depth arguments where degree alone is insufficient.',
    identifying_signals: {
      filename_regex: [
        /transcript|academic.*record|releve.*note|releve.*notes|not.*dokum|not.*belge|gpa.*report/i,
      ],
      keyword_phrases: [
        'Transcript',
        'Academic Record',
        'Official Transcript',
        'Relevé de Notes',
        'Not Dökümü',
        'Not Belgesi',
        // Tabular structure per E2_STRUCTURAL_VARIANTS Variant 2.
        'Course',
        'Credits',
        'Credit Hours',
        'Grade',
        'GPA',
        'Cumulative GPA',
        'Term',
        'Semester',
        'Quarter',
        // Cumulative summary indicators.
        'Cumulative',
        'Total Credits',
        'Honors',
        'Dean\'s List',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Not Dökümü / Transkript' },
      de: { native_name: 'Notenspiegel / Zeugnis' },
      fr: { native_name: 'Relevé de Notes' },
    },
    fills_proof_slots: ['E5.specialized_knowledge_pack'],
    extractor_skill: 'credential',
    adequacy_criteria: [
      'Institutional letterhead / seal',
      'Per-course tabular structure',
      'GPA / cumulative-grade summary',
      'Translation if non-English',
    ],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'professional_license',
    name: 'Professional certification / license',
    category: 'credentials',
    definition:
      'Single-page profession-specific license (PE, CPA, MD, RN, bar admission) or industry certification (PMP, AWS, CFA, ISO auditor). Distinguished from diploma by certifying-body issuer (non-university) + license/certification number + expiry date.',
    identifying_signals: {
      filename_regex: [
        /professional.*license|certification|sertifika|license(?![a-z])|pe.*license|cpa.*license|bar.*admission|pmp(?![a-z])|aws.*cert|cfa(?![a-z])|iso.*cert/i,
        // Generic "Certificate" filenames common to credential evidence.
        // Excludes the formation-doc "Certificate of Good Standing" which
        // scores higher via its own stronger regex.
        /\bcertificate\b/i,
      ],
      keyword_phrases: [
        'Certification',
        'License',
        'Licensed',
        'Sertifika',
        'Lisans',
        // Profession-specific issuers per E2_STRUCTURAL_VARIANTS Variant 3.
        'Professional Engineer',
        'Certified Public Accountant',
        'Bar Admission',
        'State Bar',
        'Medical License',
        'Project Management Professional',
        'AWS Certified',
        'Chartered Financial Analyst',
        'ISO',
        // License-number + expiry signals.
        'License Number',
        'License No',
        'Certification Number',
        'Issued',
        'Expires',
        'Valid Through',
        'Renewal Date',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Sertifika / Mesleki Lisans' },
    },
    fills_proof_slots: ['E5.specialized_knowledge_pack', 'E3.licenses_permits'],
    extractor_skill: 'credential',
    adequacy_criteria: [
      'Issuing body credible (non-university certifying body)',
      'License / certification number visible',
      'Expiry / renewal date stated',
      'Currently valid (not expired)',
    ],
    typical_aps: 4,
    filing_bound: 'always',
  },
  {
    id: 'recommendation_letter',
    name: 'Letter of recommendation (prior employer praise)',
    category: 'credentials',
    definition:
      "Prior or current employer's letter praising the Beneficiary's performance, character, and qualifications. Distinguished from VOE by qualitative/praise tone (no exact dates or salary required) and from job-offer by historical framing. Single signer (typically direct supervisor, not HR).",
    identifying_signals: {
      filename_regex: [
        /recommendation|reference.*letter|lor(?![a-z])|tavsiye.*mektup|praise.*letter/i,
      ],
      keyword_phrases: [
        'recommend',
        'recommendation',
        'highly recommend',
        'reference',
        'Tavsiye',
        'Tavsiye Mektubu',
        // Subjective adjectives per E2_STRUCTURAL_VARIANTS Variant 1.
        'excellent',
        'exceptional',
        'outstanding',
        'dedicated',
        'remarkable',
        'invaluable',
        // Relationship-context phrasing.
        'have known',
        'had the pleasure',
        'pleased to recommend',
        'without reservation',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Tavsiye Mektubu / Referans Mektubu' },
    },
    fills_proof_slots: ['E5.specialized_knowledge_pack'],
    extractor_skill: 'recommendation-letter',
    adequacy_criteria: [
      'Employer / institutional letterhead',
      'Single signer with title',
      'Recommender credentials clear',
      'Substantive content beyond boilerplate',
    ],
    typical_aps: 3,
    filing_bound: 'optional',
  },
  {
    id: 'training_certificate',
    name: 'Training certificate / course-completion',
    category: 'credentials',
    definition:
      'Single-page short-course or training-program completion certificate. Distinguished from professional_license by no license number, no examination, and "completion" / "attendance" language (not "licensed"). Lower APS — supplementary to depth, not primary credentialing.',
    identifying_signals: {
      filename_regex: [
        /training.*cert|completion.*cert|workshop.*cert|course.*cert|egitim.*sertifika|kurs.*sertifika|seminer.*sertifika/i,
      ],
      keyword_phrases: [
        'Training',
        'Workshop',
        'Course',
        'Seminar',
        'Eğitim',
        'Kurs',
        'Seminer',
        // Completion / attendance language per E2_STRUCTURAL_VARIANTS Variant 4.
        'Completion',
        'Has Completed',
        'Successfully Completed',
        'Attended',
        'Participated in',
        'Certificate of Completion',
        'Certificate of Attendance',
        'Eğitim Sertifikası',
        'Katılım Sertifikası',
        // Hours / units (vs license-number for prof certs).
        'Hours',
        'CEU',
        'Continuing Education',
        'Units',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Eğitim Sertifikası / Katılım Belgesi' },
    },
    fills_proof_slots: ['E5.specialized_knowledge_pack'],
    extractor_skill: 'credential',
    adequacy_criteria: [
      'Training-provider letterhead',
      'Hours / CEU / unit value stated',
      'No license number expected (vs professional_license)',
    ],
    typical_aps: 3,
    filing_bound: 'optional',
  },
  {
    id: 'expert_letter_industry',
    name: 'Industry-expert advisory letter',
    category: 'credentials',
    definition:
      "Letter from a professor, industry analyst, market-research figure, or trade-association leader corroborating market size, demand, or sectoral viability of the Petitioner's enterprise. Distinguished from recommendation_letter by independent third-party institutional letterhead, writer-credentials block, and subject-matter (market/industry, not the Beneficiary).",
    identifying_signals: {
      filename_regex: [
        /expert.*letter|advisory.*letter|industry.*expert|market.*expert|industry.*advisory|industry.*letter/i,
      ],
      keyword_phrases: [
        'Expert Letter',
        'Advisory Letter',
        'Industry Expert',
        'Market Expert',
        'Industry Advisory',
        // Writer-credentials block per E2_STRUCTURAL_VARIANTS Variant 1.
        'Professor',
        'Associate Professor',
        'Department of',
        'University',
        'Trade Association',
        'Industry Analyst',
        'years of experience',
        'expertise in',
        // Subject framing.
        'Market Size',
        'Market Demand',
        'Industry Outlook',
        'Sector Analysis',
        'addressable market',
        // Closing / attestation.
        'To Whom It May Concern',
      ],
    },
    fills_proof_slots: ['E2.proportionality_substantiality', 'E4.financial_capacity'],
    extractor_skill: 'recommendation-letter',
    adequacy_criteria: [
      'Independent institutional letterhead',
      'Writer-credentials paragraph (degrees, publications, years in field)',
      'Subject is market / industry, not the Beneficiary',
      'APS-5 anchoring language',
    ],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'expert_letter_technical',
    name: 'Subject-matter advisory letter (technical / regulatory)',
    category: 'credentials',
    definition:
      'Narrower technical letter from an engineer, accountant, attorney (non-firm), or regulatory specialist validating a specific technical claim (building code compliance, NAICS classification, technical novelty). Distinguished from industry expert by license-emphasis (PE/CPA/PhD) and specific-question subject.',
    identifying_signals: {
      filename_regex: [
        /technical.*letter|regulatory.*letter|pe.*letter|engineer.*letter|cpa.*letter|technical.*opinion/i,
      ],
      keyword_phrases: [
        'Technical Opinion',
        'Regulatory Opinion',
        'Compliance Letter',
        'PE Letter',
        // Writer-credentials emphasizing license per E2_STRUCTURAL_VARIANTS Variant 2.
        'Professional Engineer',
        'P.E.',
        'Certified Public Accountant',
        'C.P.A.',
        'PhD',
        'Doctor of Philosophy',
        'License Number',
        'License No.',
        'Bar Admission',
        // Technical / regulatory subject.
        'building code',
        'compliance with',
        'in conformance with',
        'NAICS classification',
        'technical novelty',
        'in my professional opinion',
      ],
    },
    fills_proof_slots: ['E2.proportionality_substantiality'],
    extractor_skill: 'recommendation-letter',
    adequacy_criteria: [
      'Writer-credentials paragraph emphasizes a license (PE, CPA, PhD)',
      'Letter body cites specific technical / regulatory question',
      'Independent institutional letterhead',
    ],
    typical_aps: 4,
    filing_bound: 'optional',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// CRYPTO & SOF ORIGIN EVIDENCE
// ───────────────────────────────────────────────────────────────────────────

const CRYPTO_AND_SOF_ORIGIN: DocType[] = [
  {
    id: 'crypto_exchange_kyc',
    name: 'Crypto exchange KYC',
    category: 'crypto_evidence',
    definition: 'KYC-verified account documentation from a crypto exchange.',
    identifying_signals: {
      filename_regex: [/kyc|coinbase|binance|kraken|bitfinex/i],
      keyword_phrases: ['KYC', 'Identity Verification', 'Coinbase', 'Binance', 'Kraken'],
    },
    fills_proof_slots: ['E2.SOF.crypto_chain'],
    extractor_skill: null,
    adequacy_criteria: ['Exchange-issued letterhead or PDF', 'Account holder name matches principal'],
    typical_aps: 4,
    filing_bound: 'always',
  },
  {
    id: 'crypto_trade_ledger',
    name: 'Crypto trade ledger',
    category: 'crypto_evidence',
    definition: 'Full trade ledger / transaction history from exchange.',
    identifying_signals: {
      filename_regex: [/ledger|transaction.*history|trade.*history/i],
      keyword_phrases: ['Transaction History', 'Trade History', 'BTC', 'ETH'],
    },
    fills_proof_slots: ['E2.SOF.crypto_chain'],
    extractor_skill: null,
    adequacy_criteria: ['Complete ledger', 'Reconciles to liquidations'],
    typical_aps: 4,
    filing_bound: 'always',
  },
  {
    id: 'crypto_blockchain_txid',
    name: 'Blockchain TXID record',
    category: 'crypto_evidence',
    definition: 'On-chain transaction record (Etherscan, Blockchain.com) for material movements.',
    identifying_signals: {
      filename_regex: [/txid|blockchain|etherscan/i],
      keyword_phrases: ['Transaction Hash', 'Block', '0x'],
    },
    fills_proof_slots: ['E2.SOF.crypto_chain'],
    extractor_skill: null,
    adequacy_criteria: ['TXID resolvable on-chain', 'Address matches ledger'],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'crypto_liquidation_record',
    name: 'Crypto liquidation / fiat-conversion record',
    category: 'crypto_evidence',
    definition: 'Record of converting crypto to fiat — exchange withdrawal record + bank deposit.',
    identifying_signals: {
      filename_regex: [/liquidation|withdrawal|fiat.*convert/i],
      keyword_phrases: ['Withdrawal', 'Fiat', 'USD', 'EUR'],
    },
    fills_proof_slots: ['E2.SOF.crypto_chain'],
    extractor_skill: null,
    adequacy_criteria: ['Exchange withdrawal pairs with bank deposit', 'Same date ± 5 days'],
    typical_aps: 4,
    filing_bound: 'always',
  },
  {
    id: 'gift_letter',
    name: 'Notarized gift letter',
    category: 'sof_origin_evidence',
    definition:
      'Donor-signed letter declaring an irrevocable gift of funds with amount, date, and "no repayment expected" language. Single-signer (donor only); short letter format (1-2 pages); often notarized or apostilled per jurisdiction.',
    identifying_signals: {
      filename_regex: [
        /gift.*letter|hediye|donation.*letter|don.*letter|hibe/i,
      ],
      keyword_phrases: [
        // Core gift-language anchors per E2_STRUCTURAL_VARIANTS Variant 2.
        'Gift',
        'Donation',
        'irrevocable',
        'do hereby gift',
        'outright gift',
        'no repayment',
        'no repayment expected',
        'no expectation of repayment',
        'donor',
        // Jurisdictional analogs.
        'Hibe',
        'Hibe Sözleşmesi',
        'Schenkung',
        'Schenkungsurkunde',
        'Donation entre vifs',
        // Notarial framing.
        'Notary Public',
        'Noter',
        'Apostille',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Hibe Sözleşmesi / Bağış Mektubu' },
      de: { native_name: 'Schenkungsurkunde' },
      fr: { native_name: 'Acte de Donation' },
    },
    fills_proof_slots: ['E2.SOF.gift_documentation'],
    extractor_skill: 'contract',
    adequacy_criteria: [
      'Notarized (or apostilled per jurisdiction)',
      'Names recipient',
      'States amount/date/irrevocability',
      'Donor SOF separately required',
    ],
    typical_aps: 3,
    filing_bound: 'always',
  },
  {
    id: 'donor_passport',
    name: 'Donor passport',
    category: 'identity',
    definition: 'Passport bio of gift donor — supports gift documentation chain.',
    identifying_signals: {
      filename_regex: [/donor.*passport|gift.*passport/i],
      keyword_phrases: ['Passport'],
    },
    fills_proof_slots: ['E2.SOF.gift_documentation'],
    extractor_skill: 'passport',
    adequacy_criteria: ['Donor identity clear'],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'loan_agreement',
    name: 'Loan agreement / promissory note',
    category: 'sof_origin_evidence',
    definition:
      'Bilateral contract between lender and borrower setting principal, interest, repayment schedule, and (typically) collateral. Flagged for "at-risk" scrutiny when collateralized by the Petitioner enterprise — funds secured by U.S. business assets do NOT count toward investment.',
    identifying_signals: {
      // `\bloan\b` lets bare "Loan" filenames match — letter-only
      // lookarounds so "Caisse d'Epargne_loan.pdf" still hits.
      filename_regex: [
        /loan.*agreement|kredi.*sozlesme|promissory|mortgage.*agreement|(?<![a-z])loan(?![a-z])/i,
      ],
      keyword_phrases: [
        'Loan Agreement',
        'Lender',
        'Borrower',
        'Promissory Note',
        // Repayment / interest signals — distinguish from gift/inheritance.
        'Principal',
        'Interest Rate',
        'Repayment Schedule',
        'Maturity Date',
        'Annual Percentage Rate',
        'APR',
        // Collateral language — drives at-risk gate.
        'Collateral',
        'Security Interest',
        'Pledged',
        'Secured by',
        // Jurisdictional analogs.
        'Kredi Sözleşmesi',
        'Senet',
        'Darlehensvertrag',
        'Contrat de Prêt',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Kredi Sözleşmesi / Senet' },
      de: { native_name: 'Darlehensvertrag' },
      fr: { native_name: 'Contrat de Prêt' },
    },
    fills_proof_slots: ['E2.SOF.loan_collateral', 'E2.SOF.origin_evidence'],
    extractor_skill: 'contract',
    adequacy_criteria: [
      'Signed by lender + borrower',
      'Interest rate + repayment schedule explicit',
      'Collateral schedule attached',
      'Collateral is non-business (not Petitioner enterprise assets)',
    ],
    typical_aps: 4,
    filing_bound: 'always',
  },
  {
    id: 'inheritance_estate_accounting',
    name: 'Inheritance / probate document',
    category: 'sof_origin_evidence',
    definition:
      'Court-issued or probate-registry instrument conveying assets to heirs. US Letters Testamentary, Turkish Veraset İlamı, UK Grant of Probate. Distinguished from sale/gift by court letterhead, decedent block, and heirs/share-percent table.',
    identifying_signals: {
      filename_regex: [
        /inheritance|estate|probate|veraset|letters.*testamentary|grant.*of.*probate|erbschein/i,
      ],
      keyword_phrases: [
        'Estate',
        'Probate',
        'Veraset İlamı',
        'inherited',
        // Court / decedent vocabulary per E2_STRUCTURAL_VARIANTS Variant 3.
        'Decedent',
        'Deceased',
        'Müteveffa',
        'Letters Testamentary',
        'Letters of Administration',
        'Grant of Probate',
        'Erbschein',
        'Acte de Notoriété',
        // Heirs / share-percent table indicators.
        'Heir',
        'Heirs',
        'Mirasçı',
        'Mirasçılar',
        'Share',
        'Pay',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Veraset İlamı / Mirasçılık Belgesi' },
      de: { native_name: 'Erbschein' },
      fr: { native_name: 'Acte de Notoriété' },
    },
    fills_proof_slots: ['E2.SOF.origin_evidence'],
    extractor_skill: 'government-doc',
    adequacy_criteria: [
      'Court / probate-registry issued (not notarial)',
      'Certified translation',
      'Decedent and beneficiary clear',
      'Share percentages reconcile to claimed inheritance amount',
    ],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'business_profit_distribution',
    name: 'Business profit distribution / dividend statement',
    category: 'sof_origin_evidence',
    definition: 'Distribution or dividend statement evidencing business-profit-origin SOF.',
    identifying_signals: {
      filename_regex: [/distribution|dividend|kar.*dağıtım/i],
      keyword_phrases: ['Distribution', 'Dividend', 'Kar Dağıtımı'],
    },
    fills_proof_slots: ['E2.SOF.origin_evidence'],
    extractor_skill: 'financial-statement',
    adequacy_criteria: ['Tied to business tax filings', 'Recipient is principal'],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'share_purchase_agreement',
    name: 'Share purchase / sale-of-business agreement',
    category: 'sof_origin_evidence',
    definition:
      "Agreement under which the Beneficiary previously sold shares or a business; the proceeds are now the E-2 capital. Distinguished from real-estate sale_contract by reps & warranties block, closing-conditions schedule, and longer page count (15-60 pages).",
    identifying_signals: {
      filename_regex: [
        /share.*purchase|sale.*of.*business|stock.*purchase|spa(?![a-z])|exit.*agreement|hisse.*devir|hisse.*satis|business.*sale.*agreement/i,
      ],
      keyword_phrases: [
        'Share Purchase Agreement',
        'Stock Purchase Agreement',
        'SPA',
        'Sale of Business',
        'Hisse Devir Sözleşmesi',
        'Hisse Satış Sözleşmesi',
        // Reps & warranties block — strongest single signal vs real-estate sale.
        'Representations and Warranties',
        'Reps and Warranties',
        // Closing conditions.
        'Closing Conditions',
        'Conditions Precedent',
        'Closing Date',
        // Consideration / purchase-price recital.
        'Purchase Price',
        'Consideration',
        // Multi-party signature page.
        'Seller',
        'Buyer',
        'Satıcı',
        'Alıcı',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Hisse Devir Sözleşmesi' },
      de: { native_name: 'Anteilskaufvertrag' },
      fr: { native_name: 'Cession de Parts Sociales' },
    },
    fills_proof_slots: ['E2.SOF.origin_evidence'],
    extractor_skill: 'contract',
    adequacy_criteria: [
      'Signed by all parties (3+ signatories common)',
      'Reps & warranties section present',
      'Closing conditions schedule attached',
      'Consideration matches buyer wire and seller bank deposit',
    ],
    typical_aps: 4,
    filing_bound: 'always',
  },
  {
    id: 'salary_savings_declaration',
    name: 'Salary / savings declaration (affidavit of accumulated funds)',
    category: 'sof_origin_evidence',
    definition:
      'Beneficiary-signed declaration that capital comes from accumulated salary/savings over a stated period, paired with corroborating bank-statement ledger filed separately. Lowest APS within source_of_funds — flagged by APS gate; must be supplemented with bank-statement and tax-return ledger.',
    identifying_signals: {
      filename_regex: [
        /salary.*declaration|savings.*declaration|affidavit.*of.*funds|birikim.*beyani|sof.*affidavit/i,
      ],
      keyword_phrases: [
        'Declaration',
        'Affidavit',
        'Beyan',
        'Beyanname',
        // Aggregated-amount language.
        'accumulated savings',
        'salary savings',
        'birikim',
        'do hereby declare',
        'I hereby affirm',
        'under penalty of perjury',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Birikim Beyanı / Yeminli Beyanname' },
    },
    fills_proof_slots: ['E2.SOF.origin_evidence'],
    extractor_skill: null,
    adequacy_criteria: [
      'Signed by Beneficiary',
      'Accumulation period stated',
      'Total amount asserted',
      'Bank-statement ledger separately required (declaration alone is APS-2)',
    ],
    typical_aps: 2,
    filing_bound: 'always',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// AMIGOS DOMICILE
// ───────────────────────────────────────────────────────────────────────────

const AMIGOS: DocType[] = [
  {
    id: 'amigos_utility_bill',
    name: 'Utility bill — treaty country (AMIGOS)',
    category: 'amigos_domicile',
    definition: 'Treaty-country utility bill in principal\'s name supporting 3-year domicile.',
    identifying_signals: {
      filename_regex: [/utility|elektrik|fatura|bill/i],
      keyword_phrases: ['Account Number', 'Service Address', 'Fatura'],
    },
    fills_proof_slots: ['E1.cbi_amigos_domicile'],
    extractor_skill: null,
    adequacy_criteria: ['Service address in treaty country', 'Account in principal\'s name', 'Monthly cadence preferred'],
    typical_aps: 4,
    filing_bound: 'always',
  },
  {
    id: 'amigos_treaty_country_tax_cert',
    name: 'Treaty-country tax residency certificate',
    category: 'amigos_domicile',
    definition: 'Tax residency certificate from treaty country.',
    identifying_signals: {
      filename_regex: [/tax.*residency|mukim|wohnsitzbescheinigung/i],
      keyword_phrases: ['Tax Residency', 'Mukim', 'Resident for Tax'],
    },
    foreign_language_equivalents: { tr: { native_name: 'Mukimlik Belgesi' } },
    fills_proof_slots: ['E1.cbi_amigos_domicile'],
    extractor_skill: 'government-doc',
    adequacy_criteria: ['Government-issued', 'Translation', 'Covers AMIGOS 3-year window'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'amigos_immigration_log',
    name: 'Immigration entry/exit log',
    category: 'amigos_domicile',
    definition: 'Government-issued entry/exit record for principal — Turkish e-Devlet "yurda giriş/çıkış" or equivalent.',
    identifying_signals: {
      filename_regex: [/giriş.*çıkış|entry.*exit|immigration.*log/i],
      keyword_phrases: ['Yurda Giriş', 'Yurda Çıkış', 'Entry/Exit'],
    },
    foreign_language_equivalents: { tr: { native_name: 'Yurda Giriş Çıkış Belgesi' } },
    fills_proof_slots: ['E1.cbi_amigos_domicile'],
    extractor_skill: 'government-doc',
    adequacy_criteria: ['Government-issued', 'Covers AMIGOS 3-year window', 'Gaps > 90 days require explanation'],
    typical_aps: 5,
    filing_bound: 'always',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// FORMS — USCIS / DOS
// ───────────────────────────────────────────────────────────────────────────

const FORMS: DocType[] = [
  {
    id: 'i129',
    name: 'Form I-129 (Petition for a Nonimmigrant Worker)',
    category: 'uscis_form',
    definition:
      'USCIS Form I-129 base petition for nonimmigrant worker. Multi-page government form (7-15 pages base + 4-8 page E-supplement); Part-numbered sections; OMB number top-right; form code + edition date footer; petitioner / beneficiary blocks; signature page.',
    identifying_signals: {
      filename_regex: [/i.?129(?!.*supplement)|form.*i.?129|petition.*nonimmigrant/i],
      keyword_phrases: [
        'Form I-129',
        'I-129',
        'Petition for a Nonimmigrant Worker',
        // Part-numbered sections per E2_STRUCTURAL_VARIANTS Variant 1.
        'Part 1.',
        'Part 2.',
        'Part 3.',
        'Petitioner Information',
        'Information About This Petition',
        'OMB No.',
        'Edition',
      ],
      pdf_form_field_hints: [
        'Pt1Line1_FamilyName',
        'Pt1Line1_GivenName',
        'Pt2Line1_RequestedAction',
      ],
    },
    fills_proof_slots: ['FORMS.uscis_petition'],
    extractor_skill: null,
    adequacy_criteria: [
      'Current edition (check footer date)',
      'Wet-ink or audited DocuSign',
      'OMB number visible',
    ],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'i129_e_supplement',
    name: 'Form I-129 E supplement',
    category: 'uscis_form',
    definition: 'I-129 Supplement E — Treaty Trader/Investor Classification supplement.',
    identifying_signals: {
      filename_regex: [/i.?129.*e|supplement.*e/i],
      keyword_phrases: ['Supplement E', 'Treaty Trader', 'Treaty Investor'],
    },
    fills_proof_slots: ['FORMS.uscis_petition'],
    extractor_skill: null,
    adequacy_criteria: ['Attached to I-129', 'Investment table reconciles to wires'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'i539',
    name: 'Form I-539 (dependent COS/extension)',
    category: 'uscis_form',
    definition: 'USCIS I-539 application for change/extension of nonimmigrant status — spouse derivative.',
    identifying_signals: {
      filename_regex: [/i.?539(?!a)/i],
      keyword_phrases: ['Form I-539', 'Application to Extend'],
    },
    fills_proof_slots: ['DEP.dependent_forms'],
    extractor_skill: null,
    adequacy_criteria: ['Current edition'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'i539a',
    name: 'Form I-539A (additional dependents)',
    category: 'uscis_form',
    definition: 'I-539A supplement for additional dependents (children).',
    identifying_signals: {
      filename_regex: [/i.?539a/i],
      keyword_phrases: ['Form I-539A', 'Supplemental Information'],
    },
    fills_proof_slots: ['DEP.dependent_forms'],
    extractor_skill: null,
    adequacy_criteria: ['Attached to I-539'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'g28',
    name: 'Form G-28 (Notice of Entry of Appearance as Attorney)',
    category: 'uscis_form',
    definition:
      'Attorney G-28 appearance form. Short (1-2 page) procedural form with attorney + client signature blocks; OMB number; form code footer.',
    identifying_signals: {
      filename_regex: [/g.?28(?![a-z0-9])|form.*g.?28/i],
      keyword_phrases: [
        'Form G-28',
        'G-28',
        'Notice of Entry of Appearance',
        'Notice of Entry of Appearance as Attorney',
        // Attorney-side fields per E2_STRUCTURAL_VARIANTS Variant 2.
        'Attorney',
        'State Bar Number',
        'Bar Number',
        'EOIR ID',
        'Accredited Representative',
      ],
      pdf_form_field_hints: [
        'g28_attorney_name',
        'g28_attorney_bar_number',
      ],
    },
    fills_proof_slots: ['FORMS.uscis_petition'],
    extractor_skill: null,
    adequacy_criteria: [
      'Signed by attorney and client',
      'Bar number / state bar present',
    ],
    typical_aps: 4,
    filing_bound: 'always',
  },
  {
    id: 'g1145',
    name: 'Form G-1145 (e-Notification)',
    category: 'uscis_form',
    definition: 'G-1145 e-Notification of Application/Petition Acceptance.',
    identifying_signals: {
      filename_regex: [/g.?1145/i],
      keyword_phrases: ['Form G-1145', 'e-Notification'],
    },
    fills_proof_slots: ['FORMS.uscis_petition'],
    extractor_skill: null,
    adequacy_criteria: ['Email and phone present'],
    typical_aps: 3,
    filing_bound: 'optional',
  },
  {
    id: 'g1650',
    name: 'Form G-1650 (Authorization for Credit Card Transactions)',
    category: 'uscis_form',
    definition: 'G-1650 credit card payment authorization.',
    identifying_signals: {
      filename_regex: [/g.?1650/i],
      keyword_phrases: ['Form G-1650', 'Authorization for Credit Card'],
    },
    fills_proof_slots: ['FORMS.uscis_petition'],
    extractor_skill: null,
    adequacy_criteria: ['Signed'],
    typical_aps: 3,
    filing_bound: 'optional',
  },
  {
    id: 'ds160_confirmation',
    name: 'DS-160 confirmation page',
    category: 'dos_form',
    definition: 'DS-160 nonimmigrant visa application confirmation page (with barcode).',
    identifying_signals: {
      filename_regex: [/ds.?160|aa[a-z0-9]{8}/i],
      keyword_phrases: ['DS-160', 'CONFIRMATION', 'Application ID', 'Barcode'],
    },
    fills_proof_slots: ['FORMS.ds160_confirmation', 'DEP.dependent_forms'],
    extractor_skill: null,
    adequacy_criteria: ['Barcode legible', 'Within 30-day validity at interview'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'ds156e',
    name: 'DS-156E (E-Visa Application supplement)',
    category: 'dos_form',
    definition:
      'Completed DS-156E E-Visa application supplement — Parts I (employer), II (treaty trader/investor), III (employee). Multi-page DOS form distinguished from DS-160 by E-treaty-specific fields and three-part structure.',
    identifying_signals: {
      filename_regex: [/ds.?156.?e|ds156e|e.?visa.*application/i],
      keyword_phrases: [
        'DS-156E',
        'Nonimmigrant Treaty Trader',
        'Nonimmigrant Treaty Investor',
        'Part I',
        'Part II',
        'Part III',
        'Department of State',
      ],
    },
    fills_proof_slots: ['FORMS.ds156e'],
    extractor_skill: null,
    adequacy_criteria: ['All three parts complete', 'Part II reconciles to investment proof'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'rfe_noid_notice',
    name: 'RFE / NOID / decision notice (USCIS-issued response)',
    category: 'uscis_form',
    definition:
      'USCIS-issued correspondence requesting evidence (RFE), intent to deny (NOID), or rendering decision (approval/denial). Distinguished from receipt/approval I-797 notices by evidence-request bullet list and response-deadline date. Lives in the working folder, not the filed Tab structure. Routes to the rfeNotice extractor.',
    identifying_signals: {
      filename_regex: [
        /rfe(?![a-z])|noid(?![a-z])|request.*for.*evidence|notice.*of.*intent.*to.*deny|decision.*notice|denial.*notice/i,
      ],
      keyword_phrases: [
        'Request for Evidence',
        'Notice of Intent to Deny',
        'Notice of Intent to Revoke',
        'Decision',
        'Denial',
        'Approval',
        // DHS letterhead per E2_STRUCTURAL_VARIANTS Variant 5.
        'Department of Homeland Security',
        'U.S. Citizenship and Immigration Services',
        // Response-deadline + evidence-request bullet list signals.
        'Response Due',
        'must respond',
        'evidence requested',
        'You must submit',
        'failure to respond',
        'within 87 days',
        'within 30 days',
        // RFE-specific bullet patterns.
        'In order to establish',
        'You have not established',
      ],
    },
    fills_proof_slots: [],
    extractor_skill: null,
    adequacy_criteria: [
      '"Request for Evidence" / "Notice of Intent to Deny" / "Decision" header',
      'DHS letterhead',
      'Response-deadline date',
      'Evidence-request bullet list (RFE/NOID)',
    ],
    typical_aps: 5,
    filing_bound: 'never',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// AFFIDAVITS / ATTORNEY WORK PRODUCT
// ───────────────────────────────────────────────────────────────────────────

const AFFIDAVITS_AND_WORK_PRODUCT: DocType[] = [
  {
    id: 'intent_to_depart_affidavit',
    name: 'Intent-to-depart affidavit',
    category: 'affidavit_attestation',
    definition: 'Sworn statement of intent to depart at end of authorized stay.',
    identifying_signals: {
      filename_regex: [/intent.*depart|departure.*intent/i],
      keyword_phrases: ['Intent to Depart', 'depart the United States'],
    },
    fills_proof_slots: ['DEP.intent_to_depart'],
    extractor_skill: null,
    adequacy_criteria: ['Signed by principal/dependent'],
    typical_aps: 2,
    filing_bound: 'always',
  },
  {
    id: 'cover_letter',
    name: 'Petition memorandum / brief (full cover letter)',
    category: 'attorney_work_product',
    definition:
      "The firm's formal cover letter / legal memorandum arguing every E-2 element with inline exhibit citations. Long (25-90 pages); section-headed by FAM elements; attorney signature with bar ID. Distinguished from short transmittal by length, density of `(Exhibit ...)` citations, and element-by-element argument structure.",
    identifying_signals: {
      filename_regex: [
        /cover.*letter|petition.*memo|petition.*brief|legal.*memo|petition.*memorandum|brief|dilekce/i,
      ],
      keyword_phrases: [
        'Cover Letter',
        'Legal Memorandum',
        'Petition Memorandum',
        'Memorandum of Law',
        // Addressee block per E2_STRUCTURAL_VARIANTS Variant 1.
        'USCIS',
        'U.S. Citizenship and Immigration Services',
        'Service Center',
        'Consular Officer',
        'Department of State',
        'RE:',
        're:',
        'Re:',
        // E-2 element headings.
        'Treaty Country',
        'Substantial Investment',
        'Real and Operating Enterprise',
        'More than Marginal',
        'Develop and Direct',
        'Source of Funds',
        // Inline exhibit citations.
        '(Exhibit',
        'See Exhibit',
        'Tab',
        // Closing formula.
        'Respectfully submitted',
        'Sincerely',
      ],
    },
    fills_proof_slots: ['FORMS.cover_letter'],
    extractor_skill: 'cover-letter',
    adequacy_criteria: [
      'Firm letterhead + addressee USCIS/DOS block',
      'RE: line with beneficiary + petitioner',
      'Multiple inline (Exhibit X.Y) citations',
      'Section headings matching E-2 elements',
      'Attorney signature with bar ID',
    ],
    typical_aps: 3,
    filing_bound: 'always',
  },
  {
    id: 'cover_letter_transmittal',
    name: 'Short transmittal / cover sheet',
    category: 'attorney_work_product',
    definition:
      'Short cover note (1-3 pages) for filings that do not carry the full firm brief, or for transmittal to a consular post. Distinguished from full cover_letter by short page count, no element-by-element argument, and few or no exhibit citations.',
    identifying_signals: {
      filename_regex: [
        /cover.*sheet|transmittal|letter.*of.*transmittal|filing.*letter/i,
      ],
      keyword_phrases: [
        'Letter of Transmittal',
        'Cover Sheet',
        'Transmittal',
        'Enclosed please find',
        'Enclosed herewith',
        'Filing',
      ],
    },
    fills_proof_slots: ['FORMS.cover_letter'],
    extractor_skill: null,
    adequacy_criteria: [
      'Letterhead + addressee + RE + brief body + attorney signature',
      'Page count ≤ 3',
    ],
    typical_aps: 2,
    filing_bound: 'optional',
  },
  {
    id: 'exhibit_index',
    name: 'Exhibit index',
    category: 'attorney_work_product',
    definition: 'Tab-by-tab exhibit index with page ranges and APS scores.',
    identifying_signals: {
      filename_regex: [/exhibit.*index|index.*exhibits/i],
      keyword_phrases: ['Exhibit Index', 'Tab', 'Page'],
    },
    fills_proof_slots: ['FORMS.cover_letter'],
    extractor_skill: null,
    adequacy_criteria: ['Every exhibit listed', 'Page ranges accurate'],
    typical_aps: 3,
    filing_bound: 'always',
  },
  {
    id: 'business_plan_5yr',
    name: 'Full-narrative 5-year business plan (E-2 standard)',
    category: 'business_plan',
    definition:
      'Dominant variant for E-2 — 25-60 page narrative plan covering executive summary, market analysis, operations, marketing, organization, and 5-year financials. Distinguished by Table of Contents, 5-year financial-projection grid (Year 1-5 columns), hire-plan table, and NAICS code. Satisfies Matter of Ho requirements.',
    identifying_signals: {
      filename_regex: [
        /business.*plan|5.year.*plan|five.year.*plan|e2.*plan|e-2.*plan|is.?plan|isplani/i,
      ],
      keyword_phrases: [
        'Business Plan',
        '5-Year Business Plan',
        '5-Year Plan',
        'Five-Year Plan',
        'İş Planı',
        // Mandatory section headings per E2_STRUCTURAL_VARIANTS Variant 1.
        'Executive Summary',
        'Market Analysis',
        'Operations',
        'Operations Plan',
        'Marketing',
        'Marketing Plan',
        'Management',
        'Organization',
        'Financial Projections',
        'Hiring Plan',
        // 5-year horizon signals.
        'Year 1',
        'Year 2',
        'Year 3',
        'Year 4',
        'Year 5',
        // NAICS reference.
        'NAICS',
        'NAICS Code',
        // TOC indicator.
        'Table of Contents',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'İş Planı (5 Yıllık)' },
    },
    fills_proof_slots: ['E4.business_plan_5yr', 'E2.proportionality_substantiality'],
    extractor_skill: 'business-plan',
    adequacy_criteria: [
      'Table of contents on page 2-3',
      'Matter of Ho six elements present',
      '5-year financial-projection grid (Year 1-5 columns)',
      'Hiring timetable included',
      'NAICS code cited',
      'Third-party market data cited',
    ],
    typical_aps: 3,
    filing_bound: 'always',
  },
  {
    id: 'business_plan_pitch_deck',
    name: 'Short / pitch-deck business plan',
    category: 'business_plan',
    definition:
      'Condensed plan (10-25 pages) used for renewals or when operating history substitutes for projections. May be a slide-deck export. Distinguished from full plan by landscape orientation, slide-numbering footer, low text density per page, and bullet-heavy format with minimal narrative.',
    identifying_signals: {
      filename_regex: [
        /pitch.?deck|deck.*business|summary.*plan|overview.*plan|short.*plan|business.*overview|pitch/i,
      ],
      keyword_phrases: [
        'Pitch Deck',
        'Pitch',
        'Summary Plan',
        'Business Overview',
        'Overview',
        // Slide-style indicators per E2_STRUCTURAL_VARIANTS Variant 2.
        'Slide',
        'Page 1 of',
        'Page 2 of',
        // Common slide-deck section heads (terser than full plan).
        'The Problem',
        'The Solution',
        'Market Size',
        'Traction',
        'The Team',
        'The Ask',
      ],
    },
    fills_proof_slots: ['E4.business_plan_5yr'],
    extractor_skill: 'business-plan',
    adequacy_criteria: [
      'Renewal-only context (operating history substitutes for full projections)',
      'Hiring continuity stated',
      'Page count ≥ 10',
    ],
    typical_aps: 2,
    filing_bound: 'optional',
  },
  {
    id: 'financial_model_spreadsheet',
    name: 'Financial-model spreadsheet export',
    category: 'business_plan',
    definition:
      'Spreadsheet PDF export — multi-tab financial model with revenue model, expense model, headcount, cash-flow forecast. Sometimes filed as appendix to full business plan; sometimes standalone. Distinguished from narrative plan by pure tabular presentation, no paragraphs, spreadsheet-export aesthetic with gridlines.',
    identifying_signals: {
      filename_regex: [
        /financial.?model|projection.*model|pro.?forma|forecast|model.*xlsx|model.*xls|finansal.*model/i,
      ],
      keyword_phrases: [
        'Financial Model',
        'Pro Forma',
        'Pro-Forma',
        'Financial Projections',
        'Forecast',
        'Revenue Model',
        // Tabular line-item lexicon per E2_STRUCTURAL_VARIANTS Variant 3.
        'Revenue',
        'COGS',
        'Cost of Goods Sold',
        'Gross Profit',
        'OpEx',
        'Operating Expenses',
        'EBITDA',
        'Net Income',
        'Cash',
        'Headcount',
        // Multi-period column heads.
        'Year 1',
        'Year 2',
        'Year 3',
        'Year 4',
        'Year 5',
        'Q1',
        'Q2',
        'Q3',
        'Q4',
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
      ],
    },
    fills_proof_slots: ['E4.business_plan_5yr', 'E4.financial_capacity'],
    extractor_skill: 'financial-statement',
    adequacy_criteria: [
      'Multi-column year/month grid',
      'Line-item lexicon (Revenue / COGS / OpEx / EBITDA)',
      'No narrative paragraphs (pure tabular)',
      'Reconciles to narrative plan if filed alongside one',
    ],
    typical_aps: 3,
    filing_bound: 'optional',
  },
  {
    id: 'certified_translation',
    name: 'Certified translation (translator declaration)',
    category: 'translation',
    definition:
      'Single-page translator declaration certifying that an attached document has been accurately translated from source to target language. Dominant variant for E-2. Distinguished from sworn/notarized affidavit by translator-only signer (no notary seal).',
    identifying_signals: {
      filename_regex: [
        /translation|certified.*trans|translator.*cert|translation.*certification|tercume.*belge|tercume.*tasdik/i,
      ],
      keyword_phrases: [
        'Certificate of Translation',
        "Translator's Certification",
        "Translator's Declaration",
        'Certified Translation',
        'I certify',
        'I am competent to translate',
        'true and accurate translation',
        // Source → target framing per E2_STRUCTURAL_VARIANTS Variant 1.
        'from Turkish to English',
        'from German to English',
        'from French to English',
        'from Spanish to English',
        'translated from',
        'translated into English',
        // Foreign analog.
        'Tercüme Belgesi',
      ],
    },
    fills_proof_slots: [],
    extractor_skill: null,
    adequacy_criteria: [
      "Translator's name + signature + statement of competence",
      'Source-to-target language declarative sentence',
      'Single page',
      '8 CFR 103.2(b)(3) compliant',
    ],
    primary_authority: '8 CFR 103.2(b)(3)',
    typical_aps: 4,
    filing_bound: 'always',
  },
  {
    id: 'sworn_translation',
    name: 'Sworn / notarized translator affidavit',
    category: 'translation',
    definition:
      'Formal translator affidavit with notarial acknowledgment or sworn-translator stamp (yeminli tercüman in Turkey, traducteur assermenté in France). Distinguished from simple certified translation by notarial seal, sworn-translator registration number, and (sometimes) attached apostille.',
    identifying_signals: {
      filename_regex: [
        /sworn.*translation|yeminli.*tercume|notarized.*translation|apostille.*translation|traducteur.*assermente/i,
      ],
      keyword_phrases: [
        'Sworn Translation',
        'Yeminli Tercüme',
        'Yeminli Tercüman',
        'Notarized Translation',
        'Traducteur Assermenté',
        'Traduction Assermentée',
        'Beeidigter Übersetzer',
        // Notarial seal / registration signals per E2_STRUCTURAL_VARIANTS Variant 2.
        'Notary Public',
        'Noter',
        'Notar',
        'Acknowledged before me',
        'Sworn-Translator Number',
        'Translator Registration',
        'Apostille',
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Yeminli Tercüme / Noter Onaylı Tercüme' },
      de: { native_name: 'Beeidigte Übersetzung' },
      fr: { native_name: 'Traduction Assermentée' },
    },
    fills_proof_slots: [],
    extractor_skill: null,
    adequacy_criteria: [
      'Notarial seal pattern',
      'Sworn-translator registration number',
      'Two-signer pattern (translator + notary)',
      'Apostille attached if required',
    ],
    primary_authority: '8 CFR 103.2(b)(3)',
    typical_aps: 5,
    filing_bound: 'always',
  },
];

// ───────────────────────────────────────────────────────────────────────────
// EXPORT
// ───────────────────────────────────────────────────────────────────────────

export const ALL_DOC_TYPES: DocType[] = [
  ...IDENTITY,
  ...VITAL_RECORDS,
  ...CORPORATE,
  ...FOREIGN_REGISTRIES,
  ...TAX,
  ...FINANCIAL,
  ...REAL_ESTATE,
  ...CONTRACTS_AND_INVOICES,
  ...PERMITS,
  ...INDUSTRY_EVIDENCE,
  ...PAYROLL_EMPLOYMENT,
  ...CREDENTIALS,
  ...CRYPTO_AND_SOF_ORIGIN,
  ...AMIGOS,
  ...FORMS,
  ...AFFIDAVITS_AND_WORK_PRODUCT,
];

export const DOC_TYPES_BY_ID: Record<string, DocType> = Object.fromEntries(
  ALL_DOC_TYPES.map((d) => [d.id, d]),
);

export const DOC_TYPES_BY_CATEGORY: Record<string, DocType[]> = ALL_DOC_TYPES.reduce(
  (acc, d) => {
    (acc[d.category] ||= []).push(d);
    return acc;
  },
  {} as Record<string, DocType[]>,
);

/** All proof-slot ids reachable from at least one doc-type. Useful for
 *  checking that proof-slots.ts and doc-taxonomy.ts are kept in sync. */
export const ALL_REACHABLE_SLOT_IDS: Set<string> = new Set(
  ALL_DOC_TYPES.flatMap((d) => d.fills_proof_slots),
);

export {
  IDENTITY,
  VITAL_RECORDS,
  CORPORATE,
  FOREIGN_REGISTRIES,
  TAX,
  FINANCIAL,
  REAL_ESTATE,
  CONTRACTS_AND_INVOICES,
  PERMITS,
  INDUSTRY_EVIDENCE,
  PAYROLL_EMPLOYMENT,
  CREDENTIALS,
  CRYPTO_AND_SOF_ORIGIN,
  AMIGOS,
  FORMS,
  AFFIDAVITS_AND_WORK_PRODUCT,
};
