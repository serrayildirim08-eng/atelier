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
    name: 'Passport biographic page',
    category: 'identity',
    definition: "The data page of an applicant's or owner's passport showing name, date of birth, nationality, passport number, and MRZ.",
    identifying_signals: {
      filename_regex: [/passport/i, /pasaport/i, /reisepass/i, /pasaporte/i, /passeport/i],
      keyword_phrases: ['Type/Type', 'P<', 'Place of birth', 'Date of issue', 'Date of expiry'],
      structural_hints: ['MRZ at bottom (two lines starting with P<)', 'photo at top-left'],
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
    adequacy_criteria: ['Validity ≥ 6 months beyond intended stay', 'MRZ legible and matches printed data'],
    primary_authority: '8 CFR 214.2(e)(3); 22 CFR 41.104',
    pii_strip: ['passport_number', 'dob'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'passport_full',
    name: 'Full passport (all stamped pages)',
    category: 'identity',
    definition: 'Scan of every used page of the passport showing entry/exit stamps and prior visas. Strengthens prior-status review.',
    identifying_signals: {
      filename_regex: [/passport.*full|full.*passport|passport.*all/i],
      keyword_phrases: ['Admitted', 'Departure', 'CBP'],
    },
    fills_proof_slots: ['APP.prior_visas_and_status'],
    extractor_skill: 'passport',
    adequacy_criteria: ['All pages scanned', 'Stamps legible'],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'visa_stamp',
    name: 'U.S. visa stamp',
    category: 'identity',
    definition: 'Prior or current U.S. visa foil affixed to a passport page.',
    identifying_signals: {
      // Bare `\bvisa\b` (letter-bounded) covers "Visa issued <date>.jpeg"
      // exports without false-matching "Visage" or "Vista". The strong
      // patterns above stay first so they win on score-equal ties.
      filename_regex: [
        /visa.*stamp|us.*visa|nonimmigrant/i,
        /(?<![a-z])visa(?![a-z])/i,
      ],
      keyword_phrases: ['UNITED STATES OF AMERICA', 'NONIMMIGRANT VISA', 'Visa Type/Class', 'Annotation'],
      structural_hints: ['green-tinted foil', 'embossed seal'],
    },
    fills_proof_slots: ['APP.prior_visas_and_status', 'E1.principal_passport'],
    extractor_skill: 'visa-stamp',
    adequacy_criteria: ['Foil is U.S.-issued (DOS-formatted)', 'Visa class and validity dates legible'],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'i94',
    name: 'CBP Form I-94 (Arrival/Departure Record)',
    category: 'identity',
    definition: 'CBP I-94 record showing most recent entry, class of admission, admit-until date.',
    identifying_signals: {
      filename_regex: [/i.?94|arrival.*departure/i],
      keyword_phrases: ['Admission (I-94) Record', 'Admit Until', 'Class of Admission', 'i94.cbp.dhs.gov'],
    },
    fills_proof_slots: ['APP.prior_visas_and_status'],
    extractor_skill: 'i94',
    adequacy_criteria: ['Printout from CBP I-94 lookup or paper I-94 stub'],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'ead',
    name: 'Employment Authorization Document (Form I-766)',
    category: 'identity',
    definition: 'USCIS-issued EAD card. Surfaces in dependent extension scenarios where E-2 spouse holds incident-of-status work authorization.',
    identifying_signals: {
      filename_regex: [/ead|i.?766|employment.*authorization/i],
      keyword_phrases: ['EMPLOYMENT AUTHORIZATION', 'Category', 'USCIS#'],
    },
    fills_proof_slots: ['APP.prior_visas_and_status'],
    extractor_skill: null,
    adequacy_criteria: ['Card not expired'],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'prior_approval_notice',
    name: 'Prior I-797 / I-20 status notice',
    category: 'identity',
    definition: 'USCIS I-797 approval notice or SEVIS I-20 Certificate of Eligibility for a prior nonimmigrant petition or status grant.',
    identifying_signals: {
      // I-20 (F-1 SEVIS) covered here for filename-only routing — coarse
      // status_doc bucket is correct; richer per-form extraction can
      // split later.
      filename_regex: [/i.?797|approval.*notice|i.?20\b/i],
      keyword_phrases: ['Form I-797', 'NOTICE OF ACTION', 'Receipt Number', 'Notice Type: Approval', 'Form I-20', 'SEVIS', 'Certificate of Eligibility'],
    },
    fills_proof_slots: ['APP.prior_visas_and_status'],
    extractor_skill: null,
    adequacy_criteria: ['Receipt number present', 'Approval not superseded by later denial'],
    typical_aps: 5,
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
];

// ───────────────────────────────────────────────────────────────────────────
// VITAL RECORDS — birth, marriage, death, adoption, divorce
// ───────────────────────────────────────────────────────────────────────────

const VITAL_RECORDS: DocType[] = [
  {
    id: 'birth_certificate',
    name: 'Birth certificate',
    category: 'vital_record',
    definition: 'Government-issued long-form birth certificate naming both parents.',
    identifying_signals: {
      filename_regex: [/birth.*cert|doğum.*belge|geburtsurkunde|naissance|nascita|出生/i],
      keyword_phrases: ['Certificate of Birth', 'Doğum Belgesi', 'Geburtsurkunde', 'Acte de Naissance'],
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
    adequacy_criteria: ['Long-form (full) certificate, not abbreviated', 'Both parents named', 'Certified translation if non-English'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'marriage_certificate',
    name: 'Marriage certificate',
    category: 'vital_record',
    definition: 'Government-issued marriage certificate (not religious-only).',
    identifying_signals: {
      filename_regex: [/marriage.*cert|evlilik|heiratsurkunde|mariage|matrimonio|婚姻/i],
      keyword_phrases: ['Certificate of Marriage', 'Evlilik Cüzdanı', 'Heiratsurkunde', 'Acte de Mariage'],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Evlilik Cüzdanı / Evlenme Kayıt Örneği' },
      de: { native_name: 'Heiratsurkunde' },
      fr: { native_name: 'Acte de Mariage' },
      ja: { native_name: '婚姻届受理証明書' },
    },
    fills_proof_slots: ['E1.principal_nationality_path', 'DEP.marriage_certificate'],
    extractor_skill: 'government-doc',
    adequacy_criteria: ['Government-issued (civil, not religious-only)', 'Translation if non-English'],
    typical_aps: 5,
    filing_bound: 'always',
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
    definition: 'State-stamped articles of organization for an LLC.',
    identifying_signals: {
      filename_regex: [/articles.*organization|articles.*org|aoo/i],
      keyword_phrases: ['Articles of Organization', 'Limited Liability Company', 'organized under the laws of'],
    },
    fills_proof_slots: ['E3.business_formation'],
    extractor_skill: 'corporate-formation',
    adequacy_criteria: ['State-stamped (filed)', 'Registered agent listed', 'EIN application reflects same entity name'],
    primary_authority: '8 CFR 214.2(e)(13)',
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'articles_of_incorporation',
    name: 'Articles of Incorporation (Corporation)',
    category: 'corporate_formation',
    definition: 'State-stamped articles of incorporation for a corporation.',
    identifying_signals: {
      filename_regex: [/articles.*incorporation|articles.*inc/i],
      keyword_phrases: ['Articles of Incorporation', 'authorized to issue', 'incorporated under the laws of'],
    },
    fills_proof_slots: ['E3.business_formation'],
    extractor_skill: 'corporate-formation',
    adequacy_criteria: ['State-stamped (filed)', 'Authorized shares stated', 'Registered agent listed'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'operating_agreement',
    name: 'LLC Operating Agreement',
    category: 'corporate_formation',
    definition: 'Members\' agreement governing an LLC — membership interests, manager designation, capital contributions.',
    identifying_signals: {
      filename_regex: [/operating.*agreement|llc.*agreement/i],
      keyword_phrases: ['Operating Agreement', 'Membership Interest', 'Manager-Managed', 'Member-Managed'],
    },
    fills_proof_slots: ['E1.entity_treaty_ownership', 'E3.business_formation', 'E5.develop_direct.appointing_resolution'],
    extractor_skill: 'contract',
    adequacy_criteria: ['Signed by all members', 'Membership percentages total 100%', 'Effective date precedes filing'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'bylaws',
    name: 'Corporate Bylaws',
    category: 'corporate_formation',
    definition: 'Corporate bylaws — board structure, officer roles, meeting procedures.',
    identifying_signals: {
      filename_regex: [/bylaws/i],
      keyword_phrases: ['BYLAWS', 'Board of Directors', 'Officers'],
    },
    fills_proof_slots: ['E3.business_formation', 'E5.develop_direct.appointing_resolution'],
    extractor_skill: 'corporate-formation',
    adequacy_criteria: ['Adopted (signed by incorporator or initial board)', 'Effective date precedes filing'],
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
    name: 'LLC membership unit certificate / Corp share certificate',
    category: 'corporate_formation',
    definition: 'Issued unit/share certificate evidencing ownership of LLC membership interest or Corp shares. Direct ownership evidence.',
    identifying_signals: {
      filename_regex: [/membership.*cert|share.*cert|stock.*cert|unit.*cert/i],
      keyword_phrases: ['Membership Certificate', 'Share Certificate', 'Stock Certificate', 'Membership Units', 'Class A', 'Class B'],
    },
    fills_proof_slots: ['E1.entity_treaty_ownership'],
    extractor_skill: 'corporate-formation',
    adequacy_criteria: ['Issued to treaty national', 'Units/shares stated', 'Signed by authorized officer'],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'ein_cp575',
    name: 'IRS EIN assignment letter (CP-575) or 147C verification',
    category: 'tax_registration',
    definition: 'IRS-issued EIN assignment letter (CP-575 for newly issued, 147C for replacement verification).',
    identifying_signals: {
      filename_regex: [/cp.?575|147c|ein/i],
      keyword_phrases: ['Employer Identification Number', 'CP 575', '147C', 'INTERNAL REVENUE SERVICE'],
    },
    fills_proof_slots: ['E3.business_formation', 'E3.tax_compliance'],
    extractor_skill: 'corporate-formation',
    adequacy_criteria: ['EIN matches entity name on Articles', 'IRS letterhead'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'certificate_of_good_standing',
    name: 'Certificate of Good Standing',
    category: 'corporate_formation',
    definition: 'State-issued certificate confirming entity is in good standing (current on annual reports and franchise tax).',
    identifying_signals: {
      filename_regex: [/good.*standing|cogs|status.*certificate/i],
      keyword_phrases: ['Certificate of Good Standing', 'Certificate of Existence', 'in good standing'],
    },
    fills_proof_slots: ['E3.business_formation'],
    extractor_skill: 'corporate-formation',
    adequacy_criteria: ['Issued ≤ 6 months before filing', 'State seal/signature present'],
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
    name: 'Capitalization table',
    category: 'corporate_governance',
    definition: 'Cap table listing every owner, units/shares held, and percentage.',
    identifying_signals: {
      filename_regex: [/cap.*table|capitali[sz]ation/i],
      keyword_phrases: ['Cap Table', 'Capitalization Table', 'Units', 'Membership Interest'],
    },
    fills_proof_slots: ['E1.entity_treaty_ownership'],
    extractor_skill: null,
    adequacy_criteria: ['Sums to 100%', 'Treaty-national ownership ≥ 50%'],
    typical_aps: 3,
    filing_bound: 'always',
  },
  {
    id: 'mita',
    name: 'Membership Interest Transfer Agreement',
    category: 'ownership_transfer',
    definition: 'Agreement transferring membership interest in an LLC — common for buy-in or buy-out scenarios.',
    identifying_signals: {
      filename_regex: [/mita|membership.*interest.*transfer|transfer.*agreement/i],
      keyword_phrases: ['Membership Interest Transfer', 'Assignor', 'Assignee'],
    },
    fills_proof_slots: ['E1.entity_treaty_ownership', 'E2.investment_amount_proof', 'E2.at_risk_evidence'],
    extractor_skill: 'contract',
    adequacy_criteria: ['Signed by assignor and assignee', 'Consideration stated and reconciles to wire'],
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
    name: 'IRS Form 1120 (C-Corp return)',
    category: 'tax_return',
    definition: 'Federal C-corporation income tax return.',
    identifying_signals: {
      filename_regex: [/1120(?!s)|form.*1120/i],
      keyword_phrases: ['Form 1120', 'U.S. Corporation Income Tax Return'],
    },
    fills_proof_slots: ['E3.tax_compliance', 'E4.financial_capacity'],
    extractor_skill: 'tax-return',
    adequacy_criteria: ['As-filed copy with preparer signature or e-file confirmation'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'tax_return_1120s',
    name: 'IRS Form 1120-S (S-Corp return)',
    category: 'tax_return',
    definition: 'Federal S-corporation income tax return.',
    identifying_signals: {
      filename_regex: [/1120.?s|form.*1120s/i],
      keyword_phrases: ['Form 1120-S', 'Income Tax Return for an S Corporation'],
    },
    fills_proof_slots: ['E3.tax_compliance', 'E4.financial_capacity'],
    extractor_skill: 'tax-return',
    adequacy_criteria: ['As-filed copy', 'K-1s attached'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'tax_return_1065',
    name: 'IRS Form 1065 (Partnership return)',
    category: 'tax_return',
    definition: 'Federal partnership income tax return.',
    identifying_signals: {
      filename_regex: [/1065|form.*1065/i],
      keyword_phrases: ['Form 1065', 'Return of Partnership Income'],
    },
    fills_proof_slots: ['E3.tax_compliance', 'E4.financial_capacity'],
    extractor_skill: 'tax-return',
    adequacy_criteria: ['As-filed copy', 'K-1s attached'],
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
    name: 'IRS Form 1040 (personal return)',
    category: 'tax_return',
    definition: 'U.S. personal income tax return — supports salary-origin and rental-origin SOF.',
    identifying_signals: {
      filename_regex: [/1040(?!.s)|form.*1040/i],
      keyword_phrases: ['Form 1040', 'U.S. Individual Income Tax Return'],
    },
    fills_proof_slots: ['E2.SOF.origin_evidence'],
    extractor_skill: 'tax-return',
    adequacy_criteria: ['As-filed copy', 'Schedules attached as relevant'],
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
    definition: 'Monthly personal bank account statement.',
    identifying_signals: {
      // ASCII-folded forms catch French "Relevé Bancaire" via the fold()
      // step in classify-fallback.ts (NFD strip). Bank brand names cover
      // the ubiquitous US clients whose attorneys export statements with
      // filenames like "BofA_2025-03.pdf" or "Chase_eStmt.pdf" that
      // carry no "bank" or "statement" token.
      filename_regex: [
        /bank.*statement|hesap.*ekstre|kontoauszug|releve.*bancaire|releve.*compte/i,
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
      ],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Hesap Ekstresi' },
      de: { native_name: 'Kontoauszug' },
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
    definition: 'Monthly business bank account statement for the U.S. enterprise.',
    identifying_signals: {
      // Same brand-name pattern as the personal statement, but with the
      // entity / business-checking signals layered on top so a brand-only
      // filename ("Chase_03_2025.pdf") still classifies generically as
      // bank_statement and the aggregator can decide personal vs business
      // via the account name on the page.
      filename_regex: [
        /business.*bank|business.*statement|business.*checking/i,
        /(?<![a-z])(bofa|chase|citibank|citi|wells.*fargo|capital.*one|jpmorgan|usaa|truist|pnc|us\s*bank)(?![a-z]).*business/i,
      ],
      keyword_phrases: [
        'Business Checking',
        'Business Account',
        'EIN',
        'Business Savings',
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
    id: 'wire_swift_mt103',
    name: 'SWIFT MT103 wire confirmation',
    category: 'wire_or_receipt',
    definition: 'SWIFT MT103 message confirming an international wire transfer.',
    identifying_signals: {
      filename_regex: [/mt.?103|swift|wire/i],
      keyword_phrases: ['MT103', 'Ordering Customer', 'Beneficiary Customer', '50K:', '59:'],
    },
    fills_proof_slots: ['E2.investment_amount_proof', 'E2.at_risk_evidence', 'E2.SOF.us_deployment'],
    extractor_skill: 'wire-confirmation',
    adequacy_criteria: ['Originator and beneficiary clearly stated', 'Amount and date present'],
    pii_strip: ['account_number'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'wire_confirmation',
    name: 'Wire transfer confirmation',
    category: 'wire_or_receipt',
    definition: 'Bank wire transfer confirmation (non-SWIFT format, e.g., domestic Fedwire, ACH).',
    identifying_signals: {
      filename_regex: [/wire.*confirm|wire.*receipt|fedwire/i],
      keyword_phrases: ['Wire Transfer', 'Confirmation Number', 'IMAD', 'OMAD'],
    },
    fills_proof_slots: ['E2.investment_amount_proof', 'E2.SOF.us_deployment'],
    extractor_skill: 'wire-confirmation',
    adequacy_criteria: ['Bank letterhead or e-banking PDF', 'Originator/beneficiary visible'],
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
    name: 'Cancelled check',
    category: 'wire_or_receipt',
    definition: 'Cleared check showing payment from drawer to payee.',
    identifying_signals: {
      filename_regex: [/check|cheque|cancel/i],
      keyword_phrases: ['Pay to the order of', 'MICR'],
    },
    fills_proof_slots: ['E2.investment_amount_proof', 'E2.SOF.us_deployment'],
    extractor_skill: 'bank-receipt',
    adequacy_criteria: ['Front and back (endorsement) visible', 'Bank clearing stamp'],
    pii_strip: ['account_number', 'routing'],
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
    name: 'Balance sheet',
    category: 'financial_statement',
    definition: 'Statement of financial position — assets, liabilities, equity at a point in time.',
    identifying_signals: {
      filename_regex: [/balance.*sheet|bilanço/i],
      keyword_phrases: ['Balance Sheet', 'Total Assets', 'Total Liabilities', 'Equity'],
    },
    foreign_language_equivalents: { tr: { native_name: 'Bilanço' } },
    fills_proof_slots: ['E2.investment_amount_proof', 'E4.financial_capacity'],
    extractor_skill: 'financial-statement',
    adequacy_criteria: ['Assets = Liabilities + Equity', 'CPA letter strengthens self-prepared'],
    typical_aps: 3,
    filing_bound: 'always',
  },
  {
    id: 'profit_loss_statement',
    name: 'Profit & Loss statement',
    category: 'financial_statement',
    definition: 'Income statement — revenue, expenses, net income over a period.',
    identifying_signals: {
      filename_regex: [/p.?n.?l|profit.*loss|income.*statement|gelir.*tablo/i],
      keyword_phrases: ['Profit and Loss', 'Income Statement', 'Net Income', 'Revenue'],
    },
    foreign_language_equivalents: { tr: { native_name: 'Gelir Tablosu' } },
    fills_proof_slots: ['E4.financial_capacity'],
    extractor_skill: 'financial-statement',
    adequacy_criteria: ['Period covered stated', 'CPA letter strengthens'],
    typical_aps: 3,
    filing_bound: 'always',
  },
  {
    id: 'audited_financial_statement',
    name: 'Audited financial statements',
    category: 'financial_statement',
    definition: 'CPA-audited financial statements with audit opinion.',
    identifying_signals: {
      filename_regex: [/audit/i],
      keyword_phrases: ['Independent Auditor\'s Report', 'GAAP', 'Audit Opinion'],
    },
    fills_proof_slots: ['E4.financial_capacity', 'E2.investment_amount_proof'],
    extractor_skill: 'financial-statement',
    adequacy_criteria: ['Unqualified opinion preferred', 'Auditor\'s license verifiable'],
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
    name: 'U.S. title deed',
    category: 'real_estate',
    definition: 'Recorded U.S. real-estate title deed (warranty deed, grant deed, quitclaim).',
    identifying_signals: {
      filename_regex: [/deed|title/i],
      keyword_phrases: ['Warranty Deed', 'Grant Deed', 'Quitclaim Deed', 'Recorded'],
    },
    fills_proof_slots: ['E2.SOF.origin_evidence', 'E3.business_premises', 'E2.SOF.loan_collateral'],
    extractor_skill: 'real-estate-purchase',
    adequacy_criteria: ['County recorder stamp', 'Grantor/grantee match SOF chain'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'tapu_senedi',
    name: 'Tapu Senedi (Turkish title deed)',
    category: 'real_estate',
    definition: 'Turkish Land Registry title deed.',
    identifying_signals: {
      filename_regex: [/tapu/i],
      keyword_phrases: ['Tapu Senedi', 'Tapu Sicil', 'Ada/Parsel'],
    },
    foreign_language_equivalents: { tr: { native_name: 'Tapu Senedi' } },
    fills_proof_slots: ['E2.SOF.origin_evidence', 'E2.SOF.loan_collateral'],
    extractor_skill: 'real-estate-purchase',
    adequacy_criteria: ['Certified translation', 'Holding period > 12 months supports SOF'],
    typical_aps: 5,
    filing_bound: 'always',
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
    name: 'Commercial lease',
    category: 'real_estate',
    definition: 'Lease of commercial premises for the U.S. enterprise.',
    identifying_signals: {
      filename_regex: [/commercial.*lease|lease.*agreement|kira.*sozlesme|bail.*commercial|contrat.*bail/i],
      keyword_phrases: ['Commercial Lease', 'Landlord', 'Tenant', 'Premises', 'Bail Commercial'],
    },
    fills_proof_slots: ['E2.at_risk_evidence', 'E2.in_process_walsh_pollard', 'E3.business_premises'],
    extractor_skill: 'contract',
    adequacy_criteria: ['Executed by both parties', 'Term ≥ 12 months preferred', 'Premises address matches Articles'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'lease_residential',
    name: 'Residential lease',
    category: 'real_estate',
    definition: 'Residential lease — supports AMIGOS Act domicile and dependent housing facts.',
    identifying_signals: {
      filename_regex: [/residential.*lease|apartment.*lease|kira.*konut|bail.*habitation|bail.*location|mietvertrag/i],
      keyword_phrases: ['Residential Lease', 'Tenant', 'Premises', 'Mietvertrag'],
    },
    fills_proof_slots: ['E1.cbi_amigos_domicile'],
    extractor_skill: 'contract',
    adequacy_criteria: ['Executed', 'Address in treaty country'],
    typical_aps: 4,
    filing_bound: 'optional',
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
];

// ───────────────────────────────────────────────────────────────────────────
// CONTRACTS, INVOICES, EQUIPMENT
// ───────────────────────────────────────────────────────────────────────────

const CONTRACTS_AND_INVOICES: DocType[] = [
  {
    id: 'vendor_contract',
    name: 'Vendor / supplier contract',
    category: 'business_contract',
    definition: 'Contract with a vendor or supplier supporting active operations.',
    identifying_signals: {
      filename_regex: [/vendor|supplier|supply.*agreement/i],
      keyword_phrases: ['Vendor', 'Supplier', 'Goods', 'Services'],
    },
    fills_proof_slots: ['E3.operating_evidence', 'E2.in_process_walsh_pollard'],
    extractor_skill: 'contract',
    adequacy_criteria: ['Signed', 'Term active'],
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
    name: 'Customer contract',
    category: 'business_contract',
    definition: 'Contract with paying customer — supports real-and-operating + revenue capacity.',
    identifying_signals: {
      // `\bagreement\b` / `\bcontract\b` catch generic naming
      // ("Indemnification Agreement.pdf", "Final Contract King Louis -
      // Daria.pdf"); customer-specific signals stay above so the
      // discriminator goes to customer_contract first.
      filename_regex: [
        /customer|client.*agreement|msa|sow/i,
        /(?<![a-z])(agreement|contract)(?![a-z])/i,
      ],
      keyword_phrases: [
        'Customer',
        'Client',
        'Master Services Agreement',
        'Statement of Work',
        'Agreement',
        'Indemnification',
      ],
    },
    fills_proof_slots: ['E3.operating_evidence', 'E4.financial_capacity'],
    extractor_skill: 'customer-contract',
    adequacy_criteria: ['Signed', 'Compensation terms stated'],
    typical_aps: 4,
    filing_bound: 'optional',
  },
  {
    id: 'franchise_agreement',
    name: 'Franchise agreement',
    category: 'business_contract',
    definition: 'Executed franchise agreement between franchisee and franchisor.',
    identifying_signals: {
      filename_regex: [/franchise.*agreement/i],
      keyword_phrases: ['Franchise Agreement', 'Franchisee', 'Franchisor', 'Royalty'],
    },
    fills_proof_slots: ['E2.investment_amount_proof', 'E2.at_risk_evidence', 'E3.business_formation'],
    extractor_skill: 'contract',
    adequacy_criteria: ['Signed', 'Anti-restrictive paragraph triggers E-2 nuance review'],
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
    id: 'vendor_invoice',
    name: 'Vendor invoice',
    category: 'invoice_or_receipt',
    definition: 'Invoice from a vendor — typically paired with a paid_invoice or wire to prove operations.',
    identifying_signals: {
      filename_regex: [/invoice|fatura|inv[-_]?\d|bill[-_]\d/i],
      keyword_phrases: [
        'Invoice',
        'Bill To',
        'Total Due',
        'Subtotal',
        'Amount Due',
        'Invoice Number',
        'Invoice Date',
        'Due Date',
        'Tax Total',
      ],
    },
    foreign_language_equivalents: { tr: { native_name: 'Fatura' } },
    fills_proof_slots: ['E3.operating_evidence'],
    extractor_skill: 'bank-receipt',
    adequacy_criteria: ['Vendor identified', 'Amount and date clear'],
    typical_aps: 3,
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
    name: 'Payroll register',
    category: 'payroll',
    definition: 'Payroll register — periodic listing of paid employees, wages, and taxes withheld.',
    identifying_signals: {
      filename_regex: [/payroll.*register|payroll/i],
      keyword_phrases: ['Payroll Register', 'Gross Pay', 'Net Pay', 'Federal Withholding'],
    },
    fills_proof_slots: ['E4.hiring_timetable'],
    extractor_skill: 'payroll',
    adequacy_criteria: ['Provider letterhead (ADP/Gusto/etc.)', 'Period covered stated'],
    typical_aps: 5,
    filing_bound: 'always',
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
    name: 'IRS Form W-2',
    category: 'payroll',
    definition: 'Annual W-2 wage and tax statement issued to employees.',
    identifying_signals: {
      filename_regex: [/w.?2|wage.*tax/i],
      keyword_phrases: ['Form W-2', 'Wage and Tax Statement'],
    },
    fills_proof_slots: ['E4.hiring_timetable'],
    extractor_skill: 'payroll',
    adequacy_criteria: ['Employer EIN matches U.S. enterprise', 'Issued for tax year'],
    typical_aps: 5,
    filing_bound: 'optional',
  },
  {
    id: 'offer_letter',
    name: 'Employment offer letter',
    category: 'employment_evidence',
    definition: 'Offer of employment letter to a U.S. worker.',
    identifying_signals: {
      filename_regex: [/offer.*letter|employment.*offer/i],
      keyword_phrases: ['Offer of Employment', 'Position', 'Salary', 'Start Date'],
    },
    fills_proof_slots: ['E4.hiring_timetable', 'E5.executive_supervisory_authority'],
    extractor_skill: 'job-offer',
    adequacy_criteria: ['Signed by both parties or signed countersign'],
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
    definition: 'Letter or record from U.S. employer evidencing prior employment, plus Form I-9 employment-eligibility verification.',
    identifying_signals: {
      filename_regex: [/employment.*record|verification.*employment|(?<![a-z0-9])i-?9(?![a-z0-9])/i],
      keyword_phrases: ['employed', 'verification of employment', 'Form I-9', 'Employment Eligibility Verification'],
    },
    fills_proof_slots: ['E5.executive_supervisory_authority'],
    extractor_skill: null,
    adequacy_criteria: ['Letterhead', 'Signed'],
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
    name: 'Curriculum vitae / résumé',
    category: 'credentials',
    definition: 'Applicant\'s CV or résumé.',
    identifying_signals: {
      filename_regex: [/cv|resume|özgeçmiş|lebenslauf/i],
      keyword_phrases: ['Curriculum Vitae', 'Education', 'Experience'],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Özgeçmiş' },
      de: { native_name: 'Lebenslauf' },
    },
    fills_proof_slots: ['E5.specialized_knowledge_pack'],
    extractor_skill: 'cv',
    adequacy_criteria: ['Includes employer dates', 'Education detailed'],
    typical_aps: 3,
    filing_bound: 'always',
  },
  {
    id: 'service_record',
    name: 'Service record (foreign parent)',
    category: 'credentials',
    definition: 'Foreign-parent employer-issued service record — Subtype-4 essential-skills anchor.',
    identifying_signals: {
      filename_regex: [/service.*record|hizmet.*kayıt/i],
      keyword_phrases: ['Service Record', 'Hizmet Kaydı', 'Employed since'],
    },
    fills_proof_slots: ['E5.specialized_knowledge_pack'],
    extractor_skill: 'service-record',
    adequacy_criteria: ['Letterhead of foreign parent', 'Specifies role and tenure', 'Translation'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'diploma',
    name: 'Diploma / degree certificate',
    category: 'credentials',
    definition: 'University or technical-school diploma.',
    identifying_signals: {
      // `transcript` and `releve.*note` (French "relevé de notes")
      // catch academic transcripts; routed to the same coarse
      // credential bucket as the diploma proper.
      filename_regex: [/diploma|diplom|degree|transcript|releve.*note/i],
      keyword_phrases: ['Diploma', 'Bachelor', 'Master', 'Doctor', 'Diplom', 'Transcript', 'Relevé de Notes'],
    },
    foreign_language_equivalents: {
      tr: { native_name: 'Diploma' },
      de: { native_name: 'Diplom / Zeugnis' },
    },
    fills_proof_slots: ['E5.specialized_knowledge_pack'],
    extractor_skill: 'credential',
    adequacy_criteria: ['Institution accredited', 'Translation if non-English'],
    typical_aps: 5,
    filing_bound: 'always',
  },
  {
    id: 'professional_license',
    name: 'Professional license / certification',
    category: 'credentials',
    definition: 'Professional certification or license held by applicant.',
    identifying_signals: {
      filename_regex: [
        /professional.*license|certification|sertifika/i,
        // Generic "Certificate" filenames common to credential evidence
        // (e.g., "Adobe Photoshop Certificate.jpeg", "Accounting
        // Certificate.jpeg"). Excludes the formation-doc "Certificate of
        // Good Standing" via its own stronger regex which scores higher.
        /\bcertificate\b/i,
      ],
      keyword_phrases: ['Certification', 'License', 'Sertifika'],
    },
    fills_proof_slots: ['E5.specialized_knowledge_pack', 'E3.licenses_permits'],
    extractor_skill: 'credential',
    adequacy_criteria: ['Issuing body credible', 'Current'],
    typical_aps: 4,
    filing_bound: 'always',
  },
  {
    id: 'recommendation_letter',
    name: 'Recommendation / reference letter',
    category: 'credentials',
    definition: 'Letter of recommendation from prior employer, professor, or industry expert.',
    identifying_signals: {
      filename_regex: [/recommendation|reference.*letter/i],
      keyword_phrases: ['recommend', 'highly recommend', 'reference'],
    },
    fills_proof_slots: ['E5.specialized_knowledge_pack'],
    extractor_skill: 'recommendation-letter',
    adequacy_criteria: ['Letterhead', 'Recommender credentials clear'],
    typical_aps: 3,
    filing_bound: 'optional',
  },
  {
    id: 'training_certificate',
    name: 'Training certificate',
    category: 'credentials',
    definition: 'Training-program completion certificate.',
    identifying_signals: {
      filename_regex: [/training.*cert|completion.*cert/i],
      keyword_phrases: ['Training', 'Completion', 'Certificate'],
    },
    fills_proof_slots: ['E5.specialized_knowledge_pack'],
    extractor_skill: 'credential',
    adequacy_criteria: ['Issuing body credible'],
    typical_aps: 3,
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
    definition: 'Notarized letter from donor stating gift amount, date, irrevocability.',
    identifying_signals: {
      filename_regex: [/gift.*letter|hediye/i],
      keyword_phrases: ['Gift', 'irrevocable', 'do hereby gift', 'donor'],
    },
    fills_proof_slots: ['E2.SOF.gift_documentation'],
    extractor_skill: 'contract',
    adequacy_criteria: ['Notarized', 'Names recipient', 'States amount/date/irrevocability', 'Donor SOF separately required'],
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
    name: 'Loan agreement',
    category: 'sof_origin_evidence',
    definition: 'Personal loan agreement with collateral schedule.',
    identifying_signals: {
      // `\bloan\b` lets bare "Loan" filenames match — letter-only
      // lookarounds so "Caisse d'Epargne_loan.pdf" still hits.
      filename_regex: [/loan.*agreement|kredi.*sozlesme|promissory|(?<![a-z])loan(?![a-z])/i],
      keyword_phrases: ['Loan Agreement', 'Lender', 'Borrower', 'Promissory Note'],
    },
    fills_proof_slots: ['E2.SOF.loan_collateral', 'E2.SOF.origin_evidence'],
    extractor_skill: 'contract',
    adequacy_criteria: ['Signed', 'Collateral schedule attached', 'Collateral is non-business'],
    typical_aps: 4,
    filing_bound: 'always',
  },
  {
    id: 'inheritance_estate_accounting',
    name: 'Inheritance / estate accounting',
    category: 'sof_origin_evidence',
    definition: 'Estate accounting or probate document for inherited funds.',
    identifying_signals: {
      filename_regex: [/inheritance|estate|probate|veraset/i],
      keyword_phrases: ['Estate', 'Probate', 'Veraset İlamı', 'inherited'],
    },
    foreign_language_equivalents: { tr: { native_name: 'Veraset İlamı' } },
    fills_proof_slots: ['E2.SOF.origin_evidence'],
    extractor_skill: 'government-doc',
    adequacy_criteria: ['Court-issued', 'Translation', 'Decedent and beneficiary clear'],
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
    name: 'Form I-129 (Petition for Nonimmigrant Worker)',
    category: 'uscis_form',
    definition: 'USCIS Form I-129 — base petition for nonimmigrant worker.',
    identifying_signals: {
      filename_regex: [/i.?129/i],
      keyword_phrases: ['Form I-129', 'Petition for a Nonimmigrant Worker'],
    },
    fills_proof_slots: ['FORMS.uscis_petition'],
    extractor_skill: null,
    adequacy_criteria: ['Current edition', 'Wet-ink or audited DocuSign'],
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
    definition: 'Attorney G-28 appearance form.',
    identifying_signals: {
      filename_regex: [/g.?28/i],
      keyword_phrases: ['Form G-28', 'Notice of Entry of Appearance'],
    },
    fills_proof_slots: ['FORMS.uscis_petition'],
    extractor_skill: null,
    adequacy_criteria: ['Signed by attorney and client'],
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
    name: 'DS-156E (E-Visa Application)',
    category: 'dos_form',
    definition: 'Completed DS-156E E-Visa application — Parts I, II, III.',
    identifying_signals: {
      filename_regex: [/ds.?156.?e/i],
      keyword_phrases: ['DS-156E', 'Nonimmigrant Treaty Trader', 'Part I', 'Part II', 'Part III'],
    },
    fills_proof_slots: ['FORMS.ds156e'],
    extractor_skill: null,
    adequacy_criteria: ['All three parts complete', 'Part II reconciles to investment proof'],
    typical_aps: 5,
    filing_bound: 'always',
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
    name: 'Attorney cover letter / legal memorandum',
    category: 'attorney_work_product',
    definition: 'Cover letter / legal memo organizing the petition by FAM element.',
    identifying_signals: {
      filename_regex: [/cover.*letter|legal.*memo/i],
      keyword_phrases: ['Cover Letter', 'Legal Memorandum', 're:'],
    },
    fills_proof_slots: ['FORMS.cover_letter'],
    extractor_skill: null,
    adequacy_criteria: ['Cites each exhibit by tab+page', 'Walks through every FAM element'],
    typical_aps: 3,
    filing_bound: 'always',
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
    name: '5-year business plan (Matter of Ho)',
    category: 'business_plan',
    definition: 'Five-year business plan satisfying Matter of Ho requirements.',
    identifying_signals: {
      filename_regex: [/business.*plan|5.year.*plan/i],
      keyword_phrases: ['Business Plan', '5-Year', 'Executive Summary', 'Financial Projections'],
    },
    fills_proof_slots: ['E4.business_plan_5yr', 'E2.proportionality_substantiality'],
    extractor_skill: null,
    adequacy_criteria: ['Matter of Ho six elements present', 'Hiring timetable included', 'Third-party market data cited'],
    typical_aps: 3,
    filing_bound: 'always',
  },
  {
    id: 'certified_translation',
    name: 'Certified translation',
    category: 'translation',
    definition: 'Certified English translation of a non-English document.',
    identifying_signals: {
      filename_regex: [/translation|certified.*trans/i],
      keyword_phrases: ['Certified Translation', 'Translator\'s Certification', 'I certify'],
    },
    fills_proof_slots: [],
    extractor_skill: null,
    adequacy_criteria: ['Translator\'s name + signature + statement of competence', '8 CFR 103.2(b)(3) compliant'],
    primary_authority: '8 CFR 103.2(b)(3)',
    typical_aps: 4,
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
