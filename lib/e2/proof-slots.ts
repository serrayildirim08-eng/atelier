/**
 * E-2 proof slot registry.
 *
 * Each slot represents ONE thing that must be proved for an E-2 case (or one
 * thing that, if proved, helps satisfy an FAM element). The audit operation
 * is: required-slots-for-case − slots-filled-by-PDFs = MissingnessReport.
 *
 * Slot id convention:
 *   <FAM_ELEMENT_OR_AREA>.<sub_area>[.<qualifier>]
 *   e.g. "E2.SOF.origin_evidence", "E5.develop_direct.org_chart"
 *
 * The DocTypeId strings in `requires_one_of` / `recommends_also` are stable
 * ids that doc-taxonomy.ts will declare. They are listed here as raw strings
 * because the doc-taxonomy entries fan out by foreign-language equivalents
 * and per-vehicle variants — keeping the slot file declarative-only avoids
 * forcing this file to be reordered every time a new doc-type is added.
 *
 * Composition (proof-matrix.ts) decides WHICH slots from this registry apply
 * to a given CaseProfile. The slot definitions themselves are profile-agnostic.
 */

import type { ProofSlot } from './types';

// ───────────────────────────────────────────────────────────────────────────
// E1 — TREATY NATIONALITY
// ───────────────────────────────────────────────────────────────────────────

const E1_SLOTS: ProofSlot[] = [
  {
    id: 'E1.principal_passport',
    fam_elements: ['E1_treaty_nationality'],
    semantic_section: 'applicant_personal',
    description:
      'Principal applicant possesses a valid treaty-country passport at the time of filing.',
    authority: '8 CFR 214.2(e)(3); 9 FAM 402.9-4(B)',
    requires_one_of: ['passport_bio'],
    recommends_also: ['passport_full', 'visa_stamp'],
    adequacy_notes:
      'Passport must be valid for at least 6 months beyond intended period of stay (DOS Six-Month Club waiver country list excepted). Bio page must be legible; MRZ must match printed data.',
    severity_if_missing: 5,
    severity_if_inadequate: 4,
  },
  {
    id: 'E1.principal_nationality_path',
    fam_elements: ['E1_treaty_nationality'],
    semantic_section: 'treaty_nationality',
    description:
      "Documentary proof of how the principal acquired treaty-country nationality (birth, descent, marriage, naturalization, or CBI). Required when nationality path is anything other than birth-in-country shown on passport.",
    authority: '9 FAM 402.9-4(B)(2); 8 CFR 214.2(e)(3)',
    requires_one_of: [
      'birth_certificate',
      'naturalization_certificate',
      'cbi_certificate',
      'marriage_certificate',
    ],
    recommends_also: ['certified_translation'],
    adequacy_notes:
      'Naturalization certificates and CBI certificates must show issuance date. Translations required for non-English originals.',
    severity_if_missing: 4,
    severity_if_inadequate: 3,
  },
  {
    id: 'E1.entity_treaty_ownership',
    fam_elements: ['E1_treaty_nationality'],
    semantic_section: 'treaty_nationality',
    description:
      'U.S. enterprise is at least 50% owned (directly or through a chain) by treaty-country nationals. Cap table or equivalent ownership chart with passports of all owners totaling ≥50%.',
    authority: '8 CFR 214.2(e)(3)(ii); 9 FAM 402.9-4(C)',
    requires_one_of: ['organizational_chart', 'cap_table', 'operating_agreement'],
    recommends_also: ['member_resolution', 'stock_subscription', 'mita'],
    adequacy_notes:
      'Ownership percentages must sum to ≥50% via treaty-national ultimate beneficial owners. Indirect ownership through non-treaty intermediaries breaks the chain. For Subtype-2 (corporate-owned), foreign parent must itself be ≥50% treaty-owned.',
    severity_if_missing: 5,
    severity_if_inadequate: 5,
  },
  {
    id: 'E1.foreign_owner_passports',
    fam_elements: ['E1_treaty_nationality'],
    semantic_section: 'treaty_nationality',
    description:
      'Passport bio pages for every foreign owner whose nationality is being counted toward the ≥50% treaty-ownership total.',
    authority: '9 FAM 402.9-4(C)(2)',
    requires_one_of: ['passport_bio'],
    recommends_also: [],
    adequacy_notes:
      'One bio page per counted owner. If an owner is itself a corporate entity, recurse — supply the foreign-corporate registry doc and its owners\' passports.',
    severity_if_missing: 5,
    severity_if_inadequate: 4,
  },
  {
    id: 'E1.cbi_amigos_domicile',
    fam_elements: ['E1_treaty_nationality'],
    semantic_section: 'treaty_nationality',
    description:
      'For nationality acquired by citizenship-by-investment (CBI), AMIGOS Act §7 requires three years of domicile in the treaty country prior to filing.',
    authority: 'AMIGOS Act §7 (P.L. 119-XX); 9 FAM 402.9-4(B)(3) supplemental guidance',
    requires_one_of: [
      'amigos_utility_bill',
      'amigos_treaty_country_tax_cert',
      'amigos_immigration_log',
    ],
    recommends_also: ['lease_residential', 'employment_record_treaty_country'],
    adequacy_notes:
      'Need a corroborating set covering the 36-month window: utility bills (monthly cadence preferred), treaty-country tax residency certificate, immigration entry/exit log. Gaps > 90 days require explanation.',
    severity_if_missing: 5,
    severity_if_inadequate: 5,
  },
];

// ───────────────────────────────────────────────────────────────────────────
// E2 — SUBSTANTIAL INVESTMENT
// ───────────────────────────────────────────────────────────────────────────

const E2_INVESTMENT_SLOTS: ProofSlot[] = [
  {
    id: 'E2.investment_amount_proof',
    fam_elements: ['E2_substantial_investment'],
    semantic_section: 'investment_sof_individual',
    description:
      'Documentary proof of the total amount invested or irrevocably committed to the U.S. enterprise. Sum of receipts / wires / paid invoices must match the investment figure stated on Form I-129 E supplement or DS-156E Part II.',
    authority: '8 CFR 214.2(e)(14); 9 FAM 402.9-6(C)',
    requires_one_of: [
      'wire_swift_mt103',
      'wire_confirmation',
      'bank_receipt',
      'cancelled_check',
      'paid_invoice',
    ],
    recommends_also: ['fx_conversion_receipt', 'balance_sheet'],
    adequacy_notes:
      'The total of supporting receipts must reconcile to ±2% of the stated investment figure. Discrepancies > 2% open a credibility hit and a likely RFE on substantiality.',
    severity_if_missing: 5,
    severity_if_inadequate: 4,
  },
  {
    id: 'E2.at_risk_evidence',
    fam_elements: ['E2_at_risk'],
    semantic_section: 'investment_sof_individual',
    description:
      'Funds are irrevocably committed and subject to partial or total loss if the enterprise fails. Escrow conditioned on visa issuance is NOT at-risk; spent or unconditionally released funds are.',
    authority: '9 FAM 402.9-6(B)(2); Matter of Walsh & Pollard, 20 I&N Dec. 60 (BIA 1988)',
    requires_one_of: [
      'paid_invoice',
      'wire_swift_mt103',
      'lease_commercial',
      'mita',
      'bill_of_sale',
    ],
    recommends_also: ['equipment_po', 'vendor_invoice', 'photo_buildout'],
    adequacy_notes:
      'Escrow agreements that release ONLY upon visa issuance are disqualifying — funds are not at risk. Escrow that releases on business milestones (lease execution, build-out, asset purchase) qualifies. Spent funds always qualify.',
    severity_if_missing: 5,
    severity_if_inadequate: 5,
  },
  {
    id: 'E2.proportionality_substantiality',
    fam_elements: ['E2_substantial_investment'],
    semantic_section: 'substantiality',
    description:
      'The investment is substantial relative to the total cost of either purchasing an existing enterprise or establishing a viable new one in the relevant industry. Inverse-sliding-scale: smaller total enterprise cost requires higher ratio.',
    authority: '9 FAM 402.9-6(D); 8 CFR 214.2(e)(14)',
    requires_one_of: [
      'industry_evidence_ibisworld',
      'industry_evidence_bls_qcew',
      'industry_evidence_fred',
      'industry_evidence_statista',
      'industry_evidence_census_acs',
      'fdd_item7',
      'market_study',
    ],
    recommends_also: ['business_plan_5yr', 'cpa_letter'],
    adequacy_notes:
      'Industry-cost benchmark must be from a recognized source (IBISWorld, BLS QCEW, FRED, Statista, Census ACS, or for franchises FDD Item 7). Benchmarks older than 24 months should be replaced. Cite specific NAICS code and geography.',
    severity_if_missing: 4,
    severity_if_inadequate: 4,
  },
  {
    id: 'E2.in_process_walsh_pollard',
    fam_elements: ['E2_at_risk', 'E3_real_and_operating'],
    semantic_section: 'real_and_operating',
    description:
      'For pre-launch enterprises, evidence that the applicant is "in the process of investing" — irrevocable financial commitments demonstrating the investment is more than mere intent.',
    authority: 'Matter of Walsh & Pollard, 20 I&N Dec. 60 (BIA 1988); 9 FAM 402.9-6(B)(3)',
    requires_one_of: ['lease_commercial', 'paid_invoice', 'equipment_po', 'mita'],
    recommends_also: ['photo_buildout', 'vendor_contract', 'merchant_processing_approval'],
    adequacy_notes:
      'A signed lease + paid first-month rent + paid build-out invoices + paid equipment receipts is the canonical Walsh & Pollard pack. Mere LOIs, term sheets, or unsigned contracts are insufficient.',
    severity_if_missing: 5,
    severity_if_inadequate: 4,
  },
];

// ───────────────────────────────────────────────────────────────────────────
// E2 — SOURCE OF FUNDS chain
// ───────────────────────────────────────────────────────────────────────────

const E2_SOF_SLOTS: ProofSlot[] = [
  {
    id: 'E2.SOF.origin_evidence',
    fam_elements: ['E2_source_of_funds'],
    semantic_section: 'investment_sof_individual',
    description:
      'Documentary proof of the lawful origin of every funds-origin category in the investment. Each origin (salary, business profit, real-estate sale, gift, loan, inheritance, crypto, etc.) needs its own origin-evidence pack.',
    authority: '8 CFR 214.2(e)(12); 9 FAM 402.9-6(C)(3)',
    requires_one_of: [
      'tax_return_foreign',
      'tax_return_1040',
      'sale_contract',
      'title_deed_us',
      'tapu_senedi',
      'gift_letter',
      'loan_agreement',
      'inheritance_estate_accounting',
      'business_profit_distribution',
      'salary_payslip_treaty_country',
    ],
    recommends_also: ['certified_translation', 'cpa_letter'],
    adequacy_notes:
      'Match origin to evidence per the Doctrinal Briefing §2.1 grid. A real-estate sale needs the title deed (showing prior ownership ≥1 year) AND the sale contract AND the buyer wire AND the closing statement.',
    severity_if_missing: 5,
    severity_if_inadequate: 4,
  },
  {
    id: 'E2.SOF.intermediate_holding',
    fam_elements: ['E2_source_of_funds'],
    semantic_section: 'investment_sof_individual',
    description:
      'Bank statements covering the period from origin event to U.S. deployment, showing the funds residing in the principal\'s account without unexplained inflows or outflows.',
    authority: '9 FAM 402.9-6(C)(4); ICE/HSI guidance on SOF traceability',
    requires_one_of: ['bank_statement_personal'],
    recommends_also: ['bank_statement_business'],
    adequacy_notes:
      'Continuous coverage from origin to deployment. Each statement period must follow the prior — gaps must be explained. Unexplained large inflows/outflows ≥10% of the investment amount require sub-SOF.',
    severity_if_missing: 4,
    severity_if_inadequate: 3,
  },
  {
    id: 'E2.SOF.us_deployment',
    fam_elements: ['E2_source_of_funds', 'E2_substantial_investment'],
    semantic_section: 'investment_sof_individual',
    description:
      'Wire transfer or equivalent record showing funds entering the U.S. enterprise\'s account or paying U.S. vendors directly.',
    authority: '9 FAM 402.9-6(C)(5); 8 CFR 214.2(e)(14)',
    requires_one_of: [
      'wire_swift_mt103',
      'wire_confirmation',
      'bank_receipt',
      'cancelled_check',
    ],
    recommends_also: ['fx_conversion_receipt', 'bank_statement_business'],
    adequacy_notes:
      'Wire receipts must show originator (principal or treaty entity) AND beneficiary (U.S. enterprise or U.S. vendor). A "wire from Person X to Person X" is a self-transfer, not a deployment.',
    severity_if_missing: 5,
    severity_if_inadequate: 4,
  },
  {
    id: 'E2.SOF.crypto_chain',
    fam_elements: ['E2_source_of_funds'],
    semantic_section: 'investment_sof_individual',
    description:
      'For crypto-origin funds: KYC-verified exchange account, full trade ledger, blockchain TXIDs for material movements, fiat-conversion records, and treaty-country tax treatment.',
    authority: '9 FAM 402.9-6(C)(3) per FinCEN BSA guidance and DOS supplemental cable',
    requires_one_of: [
      'crypto_exchange_kyc',
      'crypto_trade_ledger',
      'crypto_blockchain_txid',
      'crypto_liquidation_record',
    ],
    recommends_also: ['tax_return_foreign', 'tax_return_1040', 'cpa_letter'],
    adequacy_notes:
      'All four sub-elements should be present: KYC + ledger + TXIDs (for ≥$10K movements) + liquidation/fiat-conversion record. Tax declaration in treaty country strengthens the chain.',
    severity_if_missing: 5,
    severity_if_inadequate: 4,
  },
  {
    id: 'E2.SOF.gift_documentation',
    fam_elements: ['E2_source_of_funds'],
    semantic_section: 'investment_sof_individual',
    description:
      'For gifts: notarized gift letter from donor + donor\'s own SOF chain proving lawful origin of gifted funds.',
    authority: '9 FAM 402.9-6(C)(3); IRS Form 709 reporting analogue',
    requires_one_of: ['gift_letter'],
    recommends_also: [
      'bank_statement_personal',
      'tax_return_foreign',
      'donor_passport',
      'certified_translation',
    ],
    adequacy_notes:
      'Gift letter must (1) be notarized, (2) name principal as recipient, (3) state amount and date, (4) state irrevocability ("not a loan"), (5) state donor\'s relationship. Donor SOF is mandatory — a gift without donor-SOF is functionally unsourced.',
    severity_if_missing: 5,
    severity_if_inadequate: 4,
  },
  {
    id: 'E2.SOF.loan_collateral',
    fam_elements: ['E2_source_of_funds', 'E2_at_risk'],
    semantic_section: 'investment_sof_individual',
    description:
      'For loans: loan agreement + collateral schedule showing security is NON-business assets (personal real estate, securities, etc.). Loans secured by the U.S. business itself do NOT count toward investment.',
    authority: '8 CFR 214.2(e)(14)(ii); Matter of Walsh & Pollard',
    requires_one_of: ['loan_agreement'],
    recommends_also: [
      'title_deed_us',
      'tapu_senedi',
      'investment_portfolio_statement',
      'collateral_schedule',
    ],
    adequacy_notes:
      'Collateral schedule must list specific non-business assets. A loan secured by the new enterprise\'s receivables, equipment, or stock is excluded from countable investment per the regulation.',
    severity_if_missing: 4,
    severity_if_inadequate: 5,
  },
];

// ───────────────────────────────────────────────────────────────────────────
// E3 — REAL & OPERATING
// ───────────────────────────────────────────────────────────────────────────

const E3_SLOTS: ProofSlot[] = [
  {
    id: 'E3.business_formation',
    fam_elements: ['E3_real_and_operating'],
    semantic_section: 'ownership_corporate_history',
    description:
      'U.S. enterprise is properly formed under state law, has a valid EIN, and is in good standing.',
    authority: '8 CFR 214.2(e)(13); 9 FAM 402.9-6(B)(1)',
    requires_one_of: ['articles_of_organization', 'articles_of_incorporation'],
    recommends_also: [
      'operating_agreement',
      'bylaws',
      'ein_cp575',
      'certificate_of_good_standing',
    ],
    adequacy_notes:
      'Articles must be state-stamped (filed). EIN CP-575 (or 147C verification letter) required. Certificate of good standing should be ≤6 months old at filing.',
    severity_if_missing: 5,
    severity_if_inadequate: 3,
  },
  {
    id: 'E3.business_premises',
    fam_elements: ['E3_real_and_operating'],
    semantic_section: 'real_and_operating',
    description:
      'Physical commercial premises secured by lease or ownership, suitable for the stated business.',
    authority: '9 FAM 402.9-6(B)(1); 8 CFR 214.2(e)(12)',
    requires_one_of: ['lease_commercial', 'title_deed_us'],
    recommends_also: ['photo_premises', 'photo_buildout', 'utility_bill_business'],
    adequacy_notes:
      'Lease must be executed (signed by both parties) and current. Term ≥12 months strongly preferred. A virtual office / coworking-only address triggers heightened real-and-operating scrutiny — often disqualifying for high-marginality vehicles.',
    severity_if_missing: 5,
    severity_if_inadequate: 4,
  },
  {
    id: 'E3.foreign_corporate_registry',
    fam_elements: ['E1_treaty_nationality', 'E3_real_and_operating'],
    semantic_section: 'foreign_entity_ownership',
    description:
      'For Subtype-2 (corporate-owned) and Subtype-4 (essential-skills employee): official registry extract for the foreign parent entity. Used to prove the parent\'s legal existence and ownership chain.',
    authority: '9 FAM 402.9-4(C)(3) (corporate ownership); 9 FAM 402.9-7(B) (Subtype-4)',
    requires_one_of: [
      'foreign_corporate_registry_kbis',
      'foreign_corporate_registry_handelsregister',
      'foreign_corporate_registry_visura',
      'foreign_corporate_registry_companies_house',
      'foreign_corporate_registry_ticaret_sicil_gazetesi',
      'foreign_corporate_registry_other',
    ],
    recommends_also: ['certified_translation'],
    adequacy_notes:
      'Registry extract must be current (≤6 months). Translation required. For Subtype-4, must show foreign parent is real and operating, not a shell.',
    severity_if_missing: 5,
    severity_if_inadequate: 4,
  },
  {
    id: 'E3.licenses_permits',
    fam_elements: ['E3_real_and_operating'],
    semantic_section: 'real_and_operating',
    description:
      'Vehicle-specific licenses and permits required to legally operate. Restaurants: food permit + liquor (if alcohol). Healthcare: state license. Construction: bonding. Professional services: state professional license.',
    authority: '9 FAM 402.9-6(B)(1) (legal-operation requirement)',
    requires_one_of: [
      'state_business_license',
      'food_permit',
      'liquor_license',
      'professional_business_license',
      'health_department_permit',
      'contractor_license',
    ],
    recommends_also: ['insurance_general_liability', 'insurance_workers_comp'],
    adequacy_notes:
      'Required permits depend on vehicle (see proof-matrix vehicle_slots). A restaurant operating without a food permit is not legally operating regardless of build-out completeness.',
    severity_if_missing: 5,
    severity_if_inadequate: 4,
  },
  {
    id: 'E3.operating_evidence',
    fam_elements: ['E3_real_and_operating'],
    semantic_section: 'real_and_operating',
    description:
      'Evidence the enterprise is actively conducting business: vendor invoices, customer contracts, paid invoices, delivery receipts, payment processor activity.',
    authority: '8 CFR 214.2(e)(12); 9 FAM 402.9-6(B)(1)',
    requires_one_of: [
      'vendor_invoice',
      'customer_contract',
      'paid_invoice',
      'merchant_processing_approval',
    ],
    recommends_also: [
      'bank_statement_business',
      'delivery_receipt',
      'supplier_contract',
    ],
    adequacy_notes:
      'For operating-stage cases: ≥6 months of vendor invoices and customer transactions. For pre-launch: this slot is satisfied by the Walsh & Pollard pack instead (E2.in_process_walsh_pollard takes its place via composition).',
    severity_if_missing: 4,
    severity_if_inadequate: 3,
  },
  {
    id: 'E3.tax_compliance',
    fam_elements: ['E3_real_and_operating'],
    semantic_section: 'real_and_operating',
    description:
      'Federal tax filings appropriate to the enterprise\'s stage and structure. Operating-stage enterprises: at least one filed federal return. Pre-launch: tax registration (EIN + state employer + sales-tax permit if applicable).',
    authority: '9 FAM 402.9-6(B)(1); 26 USC 6011',
    requires_one_of: [
      'tax_return_1120',
      'tax_return_1120s',
      'tax_return_1065',
      'tax_return_schedule_c',
      'ein_cp575',
    ],
    recommends_also: ['vergi_levhasi', 'sales_tax_permit', 'employer_registration'],
    adequacy_notes:
      'Returns must be the as-filed copies (not draft/working copies) — show preparer signature or e-file confirmation. Pre-launch enterprises substitute tax-registration evidence.',
    severity_if_missing: 4,
    severity_if_inadequate: 3,
  },
];

// ───────────────────────────────────────────────────────────────────────────
// E4 — MARGINALITY / CAPACITY TO GENERATE > MINIMAL LIVING
// ───────────────────────────────────────────────────────────────────────────

const E4_SLOTS: ProofSlot[] = [
  {
    id: 'E4.business_plan_5yr',
    fam_elements: ['E4_more_than_marginal'],
    semantic_section: 'marginality_capacity',
    description:
      'Five-year business plan demonstrating capacity to generate more than marginal income — i.e., income that exceeds what would only support the principal and family. Must include hiring plan, revenue projections, market analysis.',
    authority: 'Matter of Ho, 22 I&N Dec. 206 (Acting Assoc. Comm\'r 1998); 9 FAM 402.9-6(E)',
    requires_one_of: ['business_plan_5yr'],
    recommends_also: [
      'market_study',
      'industry_evidence_ibisworld',
      'industry_evidence_census_acs',
      'fdd_item19',
      'cpa_letter',
    ],
    adequacy_notes:
      'Plan must satisfy Matter of Ho: (1) financial projections with assumptions, (2) market analysis with cited data, (3) marketing strategy, (4) staffing plan with hiring timetable, (5) operations plan, (6) management bios. Plans without third-party market data are weak; plans without a hiring timetable are weakest.',
    severity_if_missing: 5,
    severity_if_inadequate: 4,
  },
  {
    id: 'E4.hiring_timetable',
    fam_elements: ['E4_more_than_marginal'],
    semantic_section: 'marginality_capacity',
    description:
      'Hiring timetable showing U.S. workers will be employed within five years — required for any vehicle other than the rare "self-supporting" exception under 9 FAM 402.9-6(E)(2).',
    authority: '9 FAM 402.9-6(E); 8 CFR 214.2(e)(15)',
    requires_one_of: ['hiring_timetable', 'business_plan_5yr'],
    recommends_also: ['offer_letter', 'job_description', 'payroll_register'],
    adequacy_notes:
      'Timetable must specify role titles, hiring quarters, and projected wage rates. Hires deferred past Year 5 do not count. For operating-stage cases with prior W-2s, prior payroll plus forward timetable is the canonical pack.',
    severity_if_missing: 4,
    severity_if_inadequate: 4,
  },
  {
    id: 'E4.financial_capacity',
    fam_elements: ['E4_more_than_marginal'],
    semantic_section: 'marginality_capacity',
    description:
      'Financial statements showing the enterprise has, or will have, the present or future capacity to generate income exceeding marginal living for the family (operating cases) or the financial cushion to operate beyond marginality (pre-launch).',
    authority: '9 FAM 402.9-6(E); 8 CFR 214.2(e)(15)',
    requires_one_of: [
      'balance_sheet',
      'profit_loss_statement',
      'audited_financial_statement',
      'tax_return_1120',
      'tax_return_1120s',
      'tax_return_1065',
      'tax_return_schedule_c',
    ],
    recommends_also: ['cpa_letter', 'bank_statement_business'],
    adequacy_notes:
      'For operating cases: at least last full tax year with positive trend or sufficient cushion. For pre-launch: capitalization evidencing ≥18 months of runway. CPA letter strengthens self-prepared statements.',
    severity_if_missing: 4,
    severity_if_inadequate: 3,
  },
];

// ───────────────────────────────────────────────────────────────────────────
// E5 — DEVELOP & DIRECT (principal) / SPECIALIZED KNOWLEDGE (Subtype-4)
// ───────────────────────────────────────────────────────────────────────────

const E5_SLOTS: ProofSlot[] = [
  {
    id: 'E5.develop_direct.org_chart',
    fam_elements: ['E5_develop_and_direct'],
    semantic_section: 'develop_and_direct',
    description:
      'Organizational chart placing the principal at the top with at least 50% control authority over the enterprise. For Subtype-1 individual investors, this is the canonical develop-and-direct exhibit.',
    authority: '9 FAM 402.9-6(F); 8 CFR 214.2(e)(16)',
    requires_one_of: ['organizational_chart'],
    recommends_also: ['member_resolution', 'operating_agreement', 'bylaws'],
    adequacy_notes:
      'Chart must show the principal in a position with operational authority (CEO, Managing Director, sole Member-Manager). A passive-investor structure (LP-only, advisor-only) defeats develop-and-direct.',
    severity_if_missing: 5,
    severity_if_inadequate: 4,
  },
  {
    id: 'E5.develop_direct.appointing_resolution',
    fam_elements: ['E5_develop_and_direct'],
    semantic_section: 'develop_and_direct',
    description:
      'Member resolution, board minute, or written consent appointing the principal as Managing Director / CEO / Sole Manager.',
    authority: '8 CFR 214.2(e)(16)',
    requires_one_of: ['member_resolution', 'board_minutes', 'operating_agreement'],
    recommends_also: ['bylaws'],
    adequacy_notes:
      'Resolution must be signed by all required signatories under the operating agreement / bylaws. Effective date must precede the filing date.',
    severity_if_missing: 4,
    severity_if_inadequate: 3,
  },
  {
    id: 'E5.executive_supervisory_authority',
    fam_elements: ['E5_develop_and_direct'],
    semantic_section: 'develop_and_direct',
    description:
      'For Subtype-3 (executive/supervisory employee): proof of supervisory authority over a substantial component of the enterprise — direct-reports table, scope of authority, position description.',
    authority: '9 FAM 402.9-7(C); 8 CFR 214.2(e)(17)',
    requires_one_of: ['organizational_chart', 'job_description'],
    recommends_also: ['offer_letter', 'employment_record_us', 'member_resolution'],
    adequacy_notes:
      'Position must be principally executive or supervisory (not merely titled so). Look for: number of direct reports, authority to hire/fire, decision-making scope, salary commensurate with seniority.',
    severity_if_missing: 5,
    severity_if_inadequate: 4,
  },
  {
    id: 'E5.specialized_knowledge_pack',
    fam_elements: ['E5_develop_and_direct'],
    semantic_section: 'specialized_knowledge',
    description:
      'For Subtype-4 (essential-skills employee): credentials proving the applicant possesses skills essential to the operation of the U.S. enterprise — CV + diplomas + service record + professional certifications + recommendation letters.',
    authority: '9 FAM 402.9-7(D); 8 CFR 214.2(e)(18)',
    requires_one_of: ['cv', 'service_record'],
    recommends_also: [
      'diploma',
      'professional_license',
      'recommendation_letter',
      'training_certificate',
    ],
    adequacy_notes:
      'Skills must be (1) essential, (2) not readily available in the U.S. labor market, and (3) of degree/duration justifying nonimmigrant rather than immigrant categorization. Service record from foreign parent strengthens "essentialness." Generic CV alone is weak.',
    severity_if_missing: 5,
    severity_if_inadequate: 5,
  },
];

// ───────────────────────────────────────────────────────────────────────────
// FORMS — petition / consular forms package
// ───────────────────────────────────────────────────────────────────────────

const FORMS_SLOTS: ProofSlot[] = [
  {
    id: 'FORMS.uscis_petition',
    fam_elements: [
      'E1_treaty_nationality',
      'E2_substantial_investment',
      'E3_real_and_operating',
      'E4_more_than_marginal',
      'E5_develop_and_direct',
    ],
    semantic_section: 'forms',
    description:
      'For USCIS postures: completed I-129 + I-129 E supplement, signed by petitioner officer, with G-28 if represented and G-1145 for e-notification.',
    authority: '8 CFR 214.2(e)(20)–(23); USCIS PM Vol. 2 Pt. L',
    requires_one_of: ['i129'],
    recommends_also: ['i129_e_supplement', 'g28', 'g1145', 'g1650'],
    adequacy_notes:
      'I-129 must use the current edition (check USCIS edition date). E supplement must be physically attached. Signature blocks must be wet-ink or DocuSign with audit trail.',
    severity_if_missing: 5,
    severity_if_inadequate: 4,
  },
  {
    id: 'FORMS.ds160_confirmation',
    fam_elements: ['E1_treaty_nationality'],
    semantic_section: 'forms',
    description:
      'For consular postures: DS-160 confirmation page with barcode for principal (and each dependent applying separately).',
    authority: '22 CFR 41.103; 9 FAM 403.2',
    requires_one_of: ['ds160_confirmation'],
    recommends_also: [],
    adequacy_notes:
      'Barcode page must be legible and within 30-day validity window from interview. One DS-160 per applicant — spouses and children-21+ each need their own.',
    severity_if_missing: 5,
    severity_if_inadequate: 4,
  },
  {
    id: 'FORMS.ds156e',
    fam_elements: [
      'E2_substantial_investment',
      'E3_real_and_operating',
      'E4_more_than_marginal',
      'E5_develop_and_direct',
    ],
    semantic_section: 'forms',
    description:
      'For consular postures: completed DS-156E (E-Visa application), signed by U.S. enterprise officer (Part I) with substantiality table (Part II) and applicant detail (Part III for principal and any exec/mgr/essential employee).',
    authority: '22 CFR 41.51; 9 FAM 402.9-8',
    requires_one_of: ['ds156e'],
    recommends_also: [],
    adequacy_notes:
      'All three parts must be completed. Part II investment figure must reconcile to E2.investment_amount_proof. Part III completed for each E-2 employee, omitted for spouse/children.',
    severity_if_missing: 5,
    severity_if_inadequate: 5,
  },
  {
    id: 'FORMS.cover_letter',
    fam_elements: [
      'E1_treaty_nationality',
      'E2_substantial_investment',
      'E2_source_of_funds',
      'E3_real_and_operating',
      'E4_more_than_marginal',
      'E5_develop_and_direct',
    ],
    semantic_section: 'cover_letter',
    description:
      'Attorney cover letter / legal memorandum walking through each FAM element with exhibit citations.',
    authority: 'Best practice; 8 CFR 103.2(b)(1) (organizing the record)',
    requires_one_of: ['cover_letter'],
    recommends_also: ['exhibit_index'],
    adequacy_notes:
      'Should cite each exhibit by tab+page when referencing evidence. A cover letter without an exhibit index is weaker.',
    severity_if_missing: 3,
    severity_if_inadequate: 2,
  },
];

// ───────────────────────────────────────────────────────────────────────────
// APPLICANT PERSONAL — passport, photos, prior visas
// ───────────────────────────────────────────────────────────────────────────

const APPLICANT_SLOTS: ProofSlot[] = [
  {
    id: 'APP.photographs',
    fam_elements: ['E1_treaty_nationality'],
    semantic_section: 'applicant_personal',
    description:
      'Visa-compliant photographs for each applicant. DS-160 photo embedded in the form; physical 2x2 photos may also be required at interview per post.',
    authority: '22 CFR 41.103(b)(2); 9 FAM 403.2-3(B)(2)',
    requires_one_of: ['photo_2x2'],
    recommends_also: [],
    adequacy_notes:
      'Photo specs: 2x2 inches (51x51mm), white background, taken within 6 months, no glasses, neutral expression. Hijab and other religious head coverings allowed if face is fully visible.',
    severity_if_missing: 3,
    severity_if_inadequate: 3,
  },
  {
    id: 'APP.prior_visas_and_status',
    fam_elements: ['E1_treaty_nationality'],
    semantic_section: 'applicant_personal',
    description:
      'Prior U.S. visas, I-94 records, and any prior status documentation. Required for renewals, COS petitions, and applicants with prior U.S. immigration history.',
    authority: '8 CFR 214.1; 9 FAM 403.2-3(C)',
    requires_one_of: ['visa_stamp', 'i94'],
    recommends_also: ['ead', 'prior_approval_notice'],
    adequacy_notes:
      'I-94 must be current (CBP I-94 lookup printout acceptable). Prior overstays or status violations require explanation.',
    severity_if_missing: 4,
    severity_if_inadequate: 3,
  },
];

// ───────────────────────────────────────────────────────────────────────────
// DEPENDENTS — only when CaseProfile.has_dependents === true
// ───────────────────────────────────────────────────────────────────────────

const DEPENDENT_SLOTS: ProofSlot[] = [
  {
    id: 'DEP.marriage_certificate',
    fam_elements: ['E1_treaty_nationality'],
    semantic_section: 'dependent_biographic',
    description:
      'Marriage certificate establishing the spousal relationship. Required for any spouse derivative E-2.',
    authority: '8 CFR 214.2(e)(4); 9 FAM 402.9-9',
    requires_one_of: ['marriage_certificate'],
    recommends_also: ['certified_translation'],
    adequacy_notes:
      'Certificate must be government-issued (not religious-only). Translation required for non-English. Subsequent marriages: provide divorce decrees or death certificates for prior spouses.',
    severity_if_missing: 5,
    severity_if_inadequate: 4,
  },
  {
    id: 'DEP.child_birth_certificates',
    fam_elements: ['E1_treaty_nationality'],
    semantic_section: 'dependent_biographic',
    description:
      'Birth certificate for each derivative child under 21, naming both parents (or showing legitimation/adoption).',
    authority: '8 CFR 214.2(e)(4); 9 FAM 402.9-9',
    requires_one_of: ['birth_certificate'],
    recommends_also: ['certified_translation', 'adoption_decree'],
    adequacy_notes:
      'One certificate per child. Child must be unmarried and under 21 at filing. Long-form (full) certificate required, not abbreviated.',
    severity_if_missing: 5,
    severity_if_inadequate: 4,
  },
  {
    id: 'DEP.dependent_passports',
    fam_elements: ['E1_treaty_nationality'],
    semantic_section: 'dependent_biographic',
    description:
      'Passport bio page for each derivative spouse and child.',
    authority: '8 CFR 214.2(e)(4)',
    requires_one_of: ['passport_bio'],
    recommends_also: [],
    adequacy_notes:
      'Each dependent\'s passport must be valid ≥6 months beyond intended stay. Children\'s passports often expire sooner — flag any with <12 months remaining.',
    severity_if_missing: 5,
    severity_if_inadequate: 4,
  },
  {
    id: 'DEP.dependent_forms',
    fam_elements: ['E1_treaty_nationality'],
    semantic_section: 'dependent_forms',
    description:
      'Dependent forms package — for USCIS COS/extension postures: I-539 (spouse) + I-539A (children). For consular postures: DS-160 per dependent.',
    authority: '8 CFR 214.2(e)(4); 22 CFR 41.103',
    requires_one_of: ['i539', 'ds160_confirmation'],
    recommends_also: ['i539a'],
    adequacy_notes:
      'USCIS: spouse files I-539, each child files I-539A as supplement. Consular: each dependent files own DS-160 (children under 14 may have parent sign).',
    severity_if_missing: 5,
    severity_if_inadequate: 4,
  },
  {
    id: 'DEP.intent_to_depart',
    fam_elements: [],
    semantic_section: 'dependent_intent_to_depart',
    description:
      'Statement(s) of intent to depart at end of authorized stay — required from principal and from dependents 18 or older.',
    authority: '9 FAM 402.9-4(D); 8 CFR 214.2(e)(5)',
    requires_one_of: ['intent_to_depart_affidavit'],
    recommends_also: [],
    adequacy_notes:
      'Statement is a declaration; need not document foreign residence ownership/lease (E-2 has no foreign residence requirement, unlike B-1/B-2). Statement should affirm intent in clear language.',
    severity_if_missing: 3,
    severity_if_inadequate: 2,
  },
];

// ───────────────────────────────────────────────────────────────────────────
// EXPORT — full registry
// ───────────────────────────────────────────────────────────────────────────

export const ALL_PROOF_SLOTS: ProofSlot[] = [
  ...E1_SLOTS,
  ...E2_INVESTMENT_SLOTS,
  ...E2_SOF_SLOTS,
  ...E3_SLOTS,
  ...E4_SLOTS,
  ...E5_SLOTS,
  ...FORMS_SLOTS,
  ...APPLICANT_SLOTS,
  ...DEPENDENT_SLOTS,
];

export const PROOF_SLOTS_BY_ID: Record<string, ProofSlot> = Object.fromEntries(
  ALL_PROOF_SLOTS.map((s) => [s.id, s]),
);

export const PROOF_SLOTS_BY_FAM_ELEMENT: Record<string, ProofSlot[]> = ALL_PROOF_SLOTS.reduce(
  (acc, s) => {
    for (const fe of s.fam_elements) {
      (acc[fe] ||= []).push(s);
    }
    return acc;
  },
  {} as Record<string, ProofSlot[]>,
);

export {
  E1_SLOTS,
  E2_INVESTMENT_SLOTS,
  E2_SOF_SLOTS,
  E3_SLOTS,
  E4_SLOTS,
  E5_SLOTS,
  FORMS_SLOTS,
  APPLICANT_SLOTS,
  DEPENDENT_SLOTS,
};
