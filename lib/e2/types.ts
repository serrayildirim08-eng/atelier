/**
 * E-2 document doctrine — type scaffolding.
 *
 * This file defines the SHAPE of the per-case document framework.
 * No data lives here; data lives in:
 *   - doc-taxonomy.ts  (canonical doc-types)
 *   - proof-slots.ts   (slot registry)
 *   - proof-matrix.ts  (profile → required slots)
 *   - posts/*.ts       (per-consulate overrides)
 *
 * The framework has 3 axes and 4 operations:
 *
 *   Axis 1 — DocType         what the document IS
 *   Axis 2 — CaseProfile     who the case is FOR
 *   Axis 3 — ProofSlot       what the document PROVES
 *
 *   Op 1 — classify          PDF      → DocType   (already done by typed extractors)
 *   Op 2 — allocate          DocType  → ProofSlot[]   (table lookup, given CaseProfile)
 *   Op 3 — audit             ProofSlot[] required − filled  → MissingnessReport
 *   Op 4 — manifest          filled docs + post profile  → tabbed binder
 *
 * Authority cascade: INA → 8 CFR → 9 FAM → USCIS PM → BIA precedent → AAO non-precedent → practitioner.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * COMPOSITION PATTERN (lib/e2/proof-matrix.ts will implement this)
 * ───────────────────────────────────────────────────────────────────────────
 *
 * The required-slots list for a case is NOT a single giant table lookup. It is
 * COMPOSED from independent layers, each contributed by one CaseProfile field:
 *
 *   base_slots                          ← always required (the 5 FAM elements + SOF)
 *   + posture_slots[posture]            ← consular_first_time adds DS-156E binder slots,
 *                                         uscis_extension adds I-129 + prior payroll slots
 *   + stage_slots[stage]                ← pre_launch adds Walsh & Pollard "in process of
 *                                         investing" slots, operating adds tax-return slots
 *   + subtype_slots[principal_subtype]  ← essential_skills adds specialized-skills proof,
 *                                         executive adds org-chart-with-direct-reports
 *   + vehicle_slots[vehicle]            ← restaurant adds food/liquor permits, franchise
 *                                         adds FDD + Item 7 + anti-restrictive paragraph,
 *                                         real_estate_active adds active-management proof
 *   + origin_slots[funds_origins[*]]    ← gift adds notarized gift letter + donor SOF,
 *                                         crypto adds exchange KYC + ledger + TXID + tax,
 *                                         loan_personal_collateral adds collateral schedule
 *   + nationality_slots[nationality_path] ← cbi_investment adds AMIGOS three-year domicile pack
 *   + post_overrides[post]              ← Istanbul adds Tapu/Vergi Levhası slots,
 *                                         Frankfurt adds Handelsregister, Tokyo enforces
 *                                         Tab 1–5 + 70-page cap, Madrid 30-page cap, etc.
 *   + dependent_slots                   ← if has_dependents: I-539/I-539A or DS-160 each,
 *                                         marriage cert, birth certs, Notice of Intent to Depart
 *
 * Each layer is its own small file (e.g., lib/e2/posts/istanbul.ts) so it can be
 * kept current independently as DOS guidance and post procedures change.
 */

// ───────────────────────────────────────────────────────────────────────────
// AXIS 2 — CASE PROFILE
// ───────────────────────────────────────────────────────────────────────────

/**
 * The four E-2 principal sub-types from manuals/_E2-SUBTYPE-TAXONOMY.md §12,
 * already detected by ingest/extractors/subtype-detect.ts.
 */
export type PrincipalSubtype =
  | 'individual_investor'
  | 'corporate_owned_investor'
  | 'executive_supervisory'
  | 'essential_skills_employee';

/**
 * Filing posture — drives whether DS-156E or I-129 E supplement is the primary form
 * and whether a consular binder or USCIS petition is the assembly target.
 */
export type ProceduralPosture =
  | 'consular_first_time'      // first-ever E-2, applicant abroad, DS-160 + DS-156E
  | 'consular_renewal'         // post-issued visa expired/expiring, DS-160 + DS-156E
  | 'uscis_change_of_status'   // applicant in U.S. on another NIV, I-129 + E supp
  | 'uscis_extension';         // already in E-2 status, I-129 + E supp extension

/**
 * Stage of the enterprise at filing time. Drives whether operating-history exhibits
 * (tax returns, payroll, business bank statements) or operationally-ready exhibits
 * (lease + paid build-out + Walsh & Pollard "in process of investing") apply.
 */
export type EnterpriseStage =
  | 'pre_launch'    // formed, funds deploying, no revenue yet — Walsh & Pollard regime
  | 'early_stage'   // <12 months operating, partial-year financials
  | 'operating';    // ≥12 months, full tax returns + payroll history

/**
 * Investment vehicle / business model — drives doc-type expectations.
 */
export type Vehicle =
  | 'restaurant_food_service'           // restaurants, cafés, delis (food permits + liquor license slots)
  | 'franchise'                         // adds FDD + Item 7 anchor + anti-restrictive paragraph slots
  | 'tech_saas'                         // SaaS / software — product-dev contracts, hired CTO substitute
  | 'consulting_services'               // marginality high-risk — needs office + W-2 hires
  | 'professional_services'             // law / accounting / architecture — license slots required
  | 'ecommerce'                         // passive-attack risk if no employees + no physical presence
  | 'real_estate_active'                // active brokerage / management — passive disqualifies
  | 'hospitality_lodging'               // hotel / motel / B&B / short-term-rental management
  | 'healthcare_clinic'                 // medical / dental / wellness clinic — license-heavy
  | 'beauty_personal_care'              // salon / spa / barbershop — common E-2 vehicle
  | 'fitness_wellness'                  // gym / yoga / pilates studio
  | 'automotive_services'               // repair / detailing / dealership
  | 'construction_trades'               // GC / HVAC / electrical / plumbing — bonding + insurance
  | 'import_export_trade'               // E-1 cross-over but also E-2 vehicle
  | 'manufacturing'                     // light/heavy industrial — equipment-heavy substantiality
  | 'retail_brick_mortar'               // store-front retail
  | 'education_training'                // private school / training academy / language school
  | 'media_entertainment'               // production / studio / agency
  | 'other';

/**
 * Source-of-funds origin categories from E2_Doctrinal_Briefing_2026 §2.1.
 * A case may have multiple origins; each adds its own evidence requirements.
 */
export type FundsOrigin =
  | 'salary_employment'
  | 'business_profits_dividends'
  | 'sale_of_real_estate'
  | 'sale_of_business_or_shares'
  | 'inheritance'
  | 'gift'
  | 'loan_personal_collateral'      // loans collateralized by NON-business assets count
  | 'personal_savings'
  | 'cryptocurrency'                 // adds exchange KYC + ledger + TXID + liquidation chain slots
  | 'rental_income'
  | 'investment_portfolio_sale';     // sale of stocks / bonds / mutual funds / managed portfolios

/**
 * Treaty-nationality acquisition path. CBI triggers AMIGOS Act §7 three-year domicile pack.
 */
export type NationalityPath =
  | 'birth'
  | 'descent'
  | 'marriage'
  | 'naturalization_residency'    // long-form residency-based naturalization
  | 'cbi_investment';              // citizenship-by-investment — AMIGOS three-year rule applies

/**
 * Consular post id. Each post has its own page cap, submission portal, and local
 * doc additions; profiles live in lib/e2/posts/{post}.ts.
 */
export type ConsularPost =
  | 'istanbul'
  | 'ankara'
  | 'tokyo'
  | 'osaka_kobe'
  | 'naha'
  | 'frankfurt'
  | 'paris'
  | 'london'
  | 'toronto'
  | 'seoul'
  | 'madrid'
  | 'rome'
  | 'other';

export interface CaseProfile {
  visa_class: 'E2';
  principal_subtype: PrincipalSubtype;
  posture: ProceduralPosture;
  stage: EnterpriseStage;
  vehicle: Vehicle;
  funds_origins: FundsOrigin[];        // can be multiple (e.g., real-estate sale + rental)
  nationality_path: NationalityPath;
  treaty_country: string;              // ISO 3166-1 alpha-3 (e.g., "TUR", "JPN")
  post: ConsularPost | null;           // null when posture is uscis_*
  has_dependents: boolean;
  dependent_breakdown: { spouse: boolean; children_under_21: number } | null;
}

// ───────────────────────────────────────────────────────────────────────────
// SEVERITY — shared 1-to-5 scale matching the existing manual's APS system
// ───────────────────────────────────────────────────────────────────────────

/**
 * Severity scale used across the framework:
 *   1 — informational / nice-to-have. No real adjudication risk.
 *   2 — minor. Adjudicator may notice; no RFE on its own.
 *   3 — moderate. Likely to trigger an RFE if isolated; correctable.
 *   4 — serious. Strong RFE / 221(g) trigger or material credibility hit.
 *   5 — fatal. Element fails on this alone; case is dead without remediation.
 *
 * Mirrors the existing manuals/E2-MANUAL-FOR-CLAUDE-CODE.md convention
 * (severity 5 = halt, severity 4 = attorney escalation, etc.) and the
 * APS (Authority/Provenance Score) 1–5 already used per-exhibit.
 */
export type Severity = 1 | 2 | 3 | 4 | 5;

// ───────────────────────────────────────────────────────────────────────────
// AXIS 3 — PROOF SLOTS
// ───────────────────────────────────────────────────────────────────────────

/**
 * The 9 FAM 402.9 elements (conjunctive — failure of any one is fatal).
 */
export type FamElement =
  | 'E1_treaty_nationality'        // 9 FAM 402.9-4(B); 8 CFR 214.2(e)(3)
  | 'E2_substantial_investment'    // 9 FAM 402.9-6(C)–(D); 8 CFR 214.2(e)(14)
  | 'E2_source_of_funds'           // 9 FAM 402.9-6(C); 8 CFR 214.2(e)(12)
  | 'E2_at_risk'                   // 9 FAM 402.9-6(B); Walsh & Pollard
  | 'E3_real_and_operating'        // 9 FAM 402.9-6(B); 8 CFR 214.2(e)(12)–(13)
  | 'E4_more_than_marginal'        // 9 FAM 402.9-6(E); 8 CFR 214.2(e)(15)
  | 'E5_develop_and_direct';       // 9 FAM 402.9-6(F); 8 CFR 214.2(e)(16)

/**
 * DS-156E form sections that need their own backing exhibits at the consular post.
 */
export type Ds156eSection =
  | 'PART_I_petitioner_employer'    // U.S. enterprise officer signs
  | 'PART_II_investment_staffing'   // substantiality table
  | 'PART_III_applicant_employee';  // each individual applicant; only for exec/mgr/essential

/**
 * Semantic section ids — what KIND of content goes in a binder location.
 *
 * Tab LETTERS / NUMBERS vary across binder profiles:
 *   - Subtype-1 USCIS (Kacar-Salih)        → A B C D E F G H I J K L
 *   - Subtype-4 USCIS (Camural)            → A B C D E F G H (different content per letter!)
 *   - Consular generic (multi-post tpl)    → A B C D E F G H I
 *   - Tokyo                                → Tab 1 / 2 / 3 / 4 / 5 (numbers; Tab 1 excl. cap)
 *   - Paris                                → TAB A B C D E F G + 50-page cap (A-C + G-28 excl.)
 *   - Madrid                               → 2 PDFs only (DS-156E + supporting); 30-page cap
 *
 * The SEMANTIC section ids below are stable across all profiles. Each binder
 * profile (lib/e2/posts/{post}.ts and lib/e2/profiles/uscis-{subtype}.ts) maps
 * these semantic ids to its physical tab labels.
 */
export type SemanticSection =
  | 'forms'                          // forms package (USCIS or DOS)
  | 'cover_letter'                   // legal memorandum / petitioner cover
  | 'applicant_personal'             // passport, photos, prior visas, beneficiary CV
  | 'treaty_nationality'             // ownership ≥50% treaty, share certs, owner passports
  | 'ownership_corporate_history'    // articles, operating agt, member resolutions, transfers
  | 'foreign_entity_ownership'       // SUBTYPE-4: foreign parent's structure, both org charts
  | 'investment_sof_individual'      // SUBTYPE-1: personal SOF chain (origin → US deployment)
  | 'investment_sof_corporate'       // SUBTYPE-4: parent → subsidiary single wire + B/S progression
  | 'substantiality'                 // proportionality / industry-cost benchmark
  | 'real_and_operating'             // premises, lease, vendor invoices, customer contracts
  | 'marginality_capacity'           // tax returns, payroll, business plan, hiring timetable
  | 'develop_and_direct'             // SUBTYPE-1: org chart, member resolution appointing role
  | 'specialized_knowledge'          // SUBTYPE-4: CV + Service Record + Diploma + Certs + LoR
  | 'intent_to_depart_principal'
  | 'dependent_forms'
  | 'dependent_intent_to_depart'
  | 'dependent_biographic';

/**
 * A canonical proof slot. The case-audit's required-slots list is composed of these.
 * `id` is stable; `authority` is the primary citation that requires the proof;
 * `requires_one_of` lets a slot accept any of several doc-types as adequate fill.
 */
export interface ProofSlot {
  id: string;                          // e.g., "E2.SOF.real_estate_chain"
  fam_elements: FamElement[];          // which 9 FAM elements this slot helps prove
  ds156e_sections?: Ds156eSection[];   // DS-156E backing, if consular
  semantic_section?: SemanticSection;        // which semantic section this slot lives in
                                              // (binder profile maps section → physical tab)
  description: string;                 // human-readable: what the slot is
  authority: string;                   // primary citation requiring this proof
  requires_one_of: DocTypeId[];        // any of these doc-types can fill the slot
  recommends_also: DocTypeId[];        // strengthens but not strictly required
  adequacy_notes: string;              // adequacy criteria beyond mere presence
  severity_if_missing: Severity;       // how fatal it is if no doc fills this slot
  severity_if_inadequate: Severity;    // how fatal it is if filled-but-deficient
}

// ───────────────────────────────────────────────────────────────────────────
// AXIS 1 — DOCUMENT TAXONOMY
// ───────────────────────────────────────────────────────────────────────────

/**
 * Document-type id. The `keyof` of the canonical taxonomy const. Type-safe across
 * extractors — no string drift. New doc-types added to taxonomy automatically
 * become valid `DocTypeId` values via TypeScript inference.
 */
export type DocTypeId = string; // narrowed at the taxonomy.ts boundary via `as const`

/**
 * Document-type categories — coarse buckets for organizing the taxonomy and
 * the per-PDF Tier-0 heuristic classifier.
 */
export type DocCategory =
  | 'uscis_form'                    // I-129, I-539, I-539A, G-28, G-1145, G-1650
  | 'dos_form'                      // DS-160 confirmation, DS-156E
  | 'identity'                      // passport, visa stamp, I-94, EAD, naturalization cert
  | 'vital_record'                  // birth, marriage, death certificates
  | 'corporate_formation'           // articles, operating agreement, bylaws, certificate of good standing
  | 'corporate_governance'          // member resolutions, board minutes, organizational chart
  | 'ownership_transfer'            // membership interest transfer agt, stock subscription, bill of sale
  | 'foreign_corporate_registry'    // K-bis, Handelsregister, Visura, Companies House, Ticaret Sicil Gazetesi
  | 'tax_return'                    // 1120/1120S/1065/Schedule C, foreign tax returns, T2 (Canada)
  | 'tax_registration'              // EIN CP-575, Vergi Levhası, sales-tax permit, employer registration
  | 'financial_statement'           // balance sheet, P&L, audited financials, CPA letter
  | 'bank_statement'                // multi-month statements (personal or business)
  | 'wire_or_receipt'               // SWIFT MT103, wire confirmation, bank receipt, cancelled check
  | 'currency_conversion'           // FX conversion receipt
  | 'real_estate'                   // title deed (Tapu), deed, HUD-1, closing statement, lease
  | 'business_contract'             // vendor, supplier, customer contracts; franchise agreement
  | 'business_plan'                 // 5-year plan, FDD Item 19 supplement, market study
  | 'industry_evidence'             // IBISWorld, BLS QCEW, FRED, FDD Item 7, Statista, Census ACS
  | 'payroll'                       // W-2, payroll register, payroll provider contract
  | 'employment_evidence'           // offer letters, job descriptions, hiring timetable
  | 'credentials'                   // CV, diplomas, professional licenses, recommendation letters
  | 'permits_licenses'              // state/local business license, food permit, liquor license
  | 'insurance'                     // general liability, workers' comp binders
  | 'merchant_processing'           // Stripe/Square/bank merchant onboarding + approval
  | 'invoice_or_receipt'            // vendor invoices, equipment POs, paid invoices, delivery receipts
  | 'crypto_evidence'               // exchange KYC, trade ledger, blockchain TXIDs, liquidation records
  | 'sof_origin_evidence'           // gift letter, loan agreement, inheritance estate accounting
  | 'amigos_domicile'               // utility bills, treaty-country tax cert, immigration entry/exit log
  | 'photographs'                   // premises photos, build-out progression
  | 'affidavit_attestation'         // intent to depart, source-of-funds affidavit
  | 'translation'                   // certified English translation
  | 'attorney_work_product'         // SOF memo, cover letter, exhibit index (drafter outputs)
  | 'other';

/**
 * One canonical document type. Each entry says:
 *   - what it IS (id, name, category, definition)
 *   - how to RECOGNIZE it (filename signals, header regex, foreign-language equivalents)
 *   - what it can PROVE (proof_slots it can fill, with optional adequacy gates)
 *   - which extractor SCHEMA to run (skill name → ingest/extractors/*.ts)
 */
export interface DocType {
  id: string;                          // stable id, e.g., "passport_bio"
  name: string;                        // human label, e.g., "Passport biographic page"
  category: DocCategory;
  definition: string;                  // 1–2 sentence description
  identifying_signals: {
    filename_regex?: RegExp[];         // /passport/i, /tapu/i, /k-?bis/i
    header_regex?: RegExp[];           // first-page header patterns
    keyword_phrases?: string[];        // "Department of Homeland Security", "Tapu Sicil"
    pdf_form_field_hints?: string[];   // form-field names if the PDF is a fillable form
    structural_hints?: string[];       // "MRZ at bottom", "two-column with embossed seal"
  };
  foreign_language_equivalents?: {
    [language_or_country: string]: {   // "tr", "de", "fr", "it", "ja", "ko", "es"
      native_name: string;             // "Tapu Senedi", "Handelsregister", "K-bis"
      notes?: string;                  // e.g., "no separate sales contract, transfer is direct"
    };
  };
  fills_proof_slots: string[];         // ProofSlot ids this doc-type can satisfy
  extractor_skill: string | null;      // ingest/extractors/<skill>.ts — null if no LLM extractor
  adequacy_criteria: string[];         // gates beyond mere presence (e.g., "issued within 6 mo")
  primary_authority?: string;          // citation that requires this doc category
  pii_strip?: ('account_number' | 'routing' | 'ssn' | 'passport_number' | 'dob' | 'home_address')[];

  /**
   * Typical APS (Authority/Provenance Score, 1–5) for this doc-type.
   * APS = Probative Value × Independence × Corroboration. The actual score for
   * a specific instance can be lower (e.g., a self-prepared CV starts at 3 but
   * drops to 2 if no third-party corroboration exists in the file).
   *
   *   5 — Court / government / audited; independent; fully corroborated
   *       (Tapu, IRS CP-575, Articles, passport bio, government registry)
   *   4 — Third-party institutional; independent; corroborated
   *       (bank statement, lease, payroll provider report, customer offtake)
   *   3 — Self-prepared but supported by third-party data
   *       (business plan with industry data, balance sheet, CV)
   *   2 — Self-declared, partial corroboration
   *       (affidavit with supporting receipts)
   *   1 — Self-declared, no corroboration — RFE bait
   *
   * Filing rule: element-critical evidence must hit APS ≥ 4. Anything APS ≤ 2
   * must be supplemented or removed before filing.
   */
  typical_aps: 1 | 2 | 3 | 4 | 5;

  /**
   * Whether this doc-type belongs in the filed package or is internal-only.
   *   'always'   — must be in the filed binder (e.g., passport, MITA, lease)
   *   'optional' — sometimes filed, sometimes not (e.g., business plan in renewals)
   *   'never'    — internal-only working artifact (e.g., SOF memo draft, RFE response draft,
   *                proportionality worksheet, conflict register, exhibit index master)
   */
  filing_bound: 'always' | 'optional' | 'never';
}

// ───────────────────────────────────────────────────────────────────────────
// OPERATIONS — output shapes
// ───────────────────────────────────────────────────────────────────────────

export type SlotRequirement = 'required' | 'recommended' | 'optional';

export interface InadequateReason {
  reason: string;                      // e.g., "passport expires in 4 months — DOS requires ≥6 mo"
  severity: Severity;                  // 1–5 per the shared scale
  authority?: string;                  // citation for the adequacy gate, if applicable
}

export interface FilledExhibit {
  doc_type_id: string;
  pdf_path: string;
  effective_aps: 1 | 2 | 3 | 4 | 5;   // actual APS for this instance — may be lower than
                                       // doc-type's typical_aps if corroboration is missing
                                       // or higher if multiple corroborators converge
}

export interface SlotResolution {
  slot_id: string;
  requirement: SlotRequirement;
  status: 'filled' | 'partially_filled' | 'missing' | 'inadequate';
  filled_by: FilledExhibit[];
  highest_aps: 0 | 1 | 2 | 3 | 4 | 5;   // 0 if status === 'missing'; max effective_aps otherwise
  inadequate_reasons?: InadequateReason[];
  effective_severity: Severity;        // computed: max of slot's severity_if_missing/inadequate
                                       // applied to actual status, capped at status semantics
}

/**
 * Cross-document inconsistencies detected during aggregation. Mirrors the
 * existing typed-aggregate.ts conflict register, but typed at the framework
 * level so the audit can include them in the unified report.
 *
 * Examples that surface as conflicts:
 *   - I-129 E says investment $120K, MITA consideration says $110K
 *   - EIN on tax return ≠ EIN on Articles of Organization
 *   - Beneficiary name spelled "Çağlar" on passport, "Caglar" on I-129 (OK if
 *     the I-129 explicitly carries the ASCII transliteration; conflict otherwise)
 *   - Effective date on Member Resolution ≠ effective date on MITA
 *   - SOF chain: sum of receipts ≠ stated sale price on title deed
 */
export interface ConflictRegisterEntry {
  id: string;                          // e.g., "investment_amount_mismatch_i129_vs_mita"
  description: string;                 // human-readable explanation of the conflict
  severity: Severity;                  // 1–5 per the shared scale; ≥4 = attorney escalation
  evidence: {
    pdf_path: string;
    doc_type_id: string;
    field_name: string;                // e.g., "investment_amount", "ein"
    value: string | number;            // the value as observed in this exhibit
    source_quote?: string;             // verbatim text from the exhibit
  }[];
  suggested_resolution?: string;       // e.g., "verify which figure is correct with attorney"
}

export interface MissingnessReport {
  case_profile: CaseProfile;
  resolutions: SlotResolution[];       // every slot for the profile, in canonical order
  fatal_gaps: SlotResolution[];        // required slots that are missing/inadequate AND severity ≥ 4
  recommended_gaps: SlotResolution[];  // recommended slots that are missing
  conflicts: ConflictRegisterEntry[];  // cross-document inconsistencies (severity ≥ 4 = halt)
  max_severity: Severity;              // highest severity across resolutions AND conflicts
  summary: {
    required_count: number;
    required_filled: number;
    recommended_count: number;
    recommended_filled: number;
    fatal_count: number;
    conflict_count: number;
    by_severity: Record<Severity, number>;  // count of resolutions+conflicts at each severity
  };
}

/**
 * Maps semantic sections to physical tab labels, page caps, and submission rules
 * for one specific (subtype × posture × post) cell.
 *
 * Profiles live in lib/e2/profiles/{uscis,consular}-{subtype}.ts (default
 * profiles per posture × subtype), with per-post overrides in
 * lib/e2/posts/{istanbul,tokyo,paris,...}.ts that adjust labels, caps, and
 * the submission portal.
 */
export interface BinderProfile {
  profile_id: string;                  // e.g., "uscis-subtype1", "consular-subtype1-istanbul",
                                       //       "consular-subtype1-tokyo", "consular-subtype4-frankfurt"
  applies_to: {
    posture: ProceduralPosture[];      // which postures this profile covers
    principal_subtype: PrincipalSubtype[];
    post?: ConsularPost;               // omitted for USCIS profiles
  };
  ordered_sections: {
    semantic: SemanticSection;
    physical_label: string;            // "TAB A" / "Tab 1" / "—" (Madrid: combined PDF)
    physical_order: number;            // 1, 2, 3 … the actual filing order
    title: string;                     // human-readable section title
  }[];
  page_cap: number | null;             // null = no published cap. Madrid 30, Toronto 70, Tokyo 70.
  excluded_from_page_cap: SemanticSection[];   // e.g., Tokyo excludes Tab-1 contents
  submission: {
    portal: 'email' | 'usvisaappt_com' | 'mail' | 'uscis_lockbox';
    address?: string;                  // mailbox or URL — e.g., "EVisasIstanbul@state.gov"
    notes?: string;                    // e.g., "Madrid: 2 PDFs only — DS-156E + supporting docs"
  };
  format_rules: {
    pdf_only: boolean;
    orientation?: 'portrait' | 'landscape' | 'either';
    max_file_size_mb?: number;
    file_naming_convention?: string;   // e.g., Tokyo "Tab 1 – Tab 5"; Paris "TAB A B C"
  };
  local_doc_additions: string[];       // DocType ids added by post (e.g., "tapu_senedi" for Istanbul)
}

export interface BinderManifest {
  case_profile: CaseProfile;
  binder_profile: BinderProfile;       // the profile applied to produce this manifest
  ordered_tabs: {
    semantic: SemanticSection;
    physical_label: string;
    title: string;
    exhibits: { exhibit_id: string; doc_type_id: string; pdf_path: string; pages: number; effective_aps: 1 | 2 | 3 | 4 | 5 }[];
    page_count_in_section: number;
  }[];
  total_pages_filed: number;           // sum of all sections excluded_from_page_cap
  total_pages_capped: number;          // sum of pages that count against page_cap
  warnings: string[];                  // e.g., "approaching Madrid 30-page cap (28/30)"
}
