/**
 * E-2 typed memory: per-document micro-schemas.
 *
 * Each PDF in a case folder is classified into ONE doc_type and a small,
 * type-specific schema is filled. The collection of these per-PDF
 * extractions is the "typed memory" the aggregator reasons over to
 * produce a unified E2FactsSchema.
 *
 * Design choices:
 * - Per-type schemas stay minimal (6-10 leaf fields each). The aggregator
 *   does the heavy lifting; the per-PDF extractor only captures what is
 *   directly visible in that one document.
 * - Provenance (source_page, source_quote, confidence) is preserved on
 *   every leaf via the same Field<T> wrapper used by the matter-level
 *   schema, so citations remain traceable through aggregation.
 */

import { z } from 'zod';
import type { ContractFacts } from './extractors/contract.schema';
import type { BankReceiptFacts } from './extractors/bank-receipt.schema';
import type { WireConfirmationFacts } from './extractors/wire-confirmation.schema';
import type { GovernmentDocFacts } from './extractors/government-doc.schema';
import type { PassportFactsRich } from './extractors/passport.schema';
import type { I94Facts } from './extractors/i94.schema';
import type { VisaStampFacts } from './extractors/visa-stamp.schema';
import type { VitalRecordsFacts } from './extractors/vital-records.schema';
import type { PayrollFacts } from './extractors/payroll.schema';
import type { TaxReturnFacts } from './extractors/tax-return.schema';
import type { FinancialStatementFacts } from './extractors/financial-statement.schema';
import type { JobOfferFacts } from './extractors/job-offer.schema';
import type { ServiceRecordFacts } from './extractors/service-record.schema';
import type { CvFacts } from './extractors/cv.schema';
import type { CredentialFacts } from './extractors/credential.schema';
import type { CorporateFormationFacts } from './extractors/corporate-formation.schema';
import type { ForeignCorporateFacts } from './extractors/foreign-corporate.schema';
import type { ImagePhotoFacts } from './extractors/image-photo.schema';
import type { RecommendationLetterFacts } from './extractors/recommendation-letter.schema';
import type { CustomerContractFacts } from './extractors/customer-contract.schema';
import type { RealEstatePurchaseFacts } from './extractors/real-estate-purchase.schema';
import type { IncentiveDocumentFacts } from './extractors/incentive-document.schema';
import type { CoverLetterRichFacts } from './extractors/cover-letter.schema';
import type { RfeNoticeFacts } from './extractors/rfe-notice.schema';
import type { I129ESupplementFacts } from './extractors/i129e-supplement.schema';
import type { BusinessPlanRichFacts } from './extractors/business-plan.schema';

const Field = <T extends z.ZodTypeAny>(value: T) =>
  z.preprocess(
    (v: unknown) => {
      if (v === null || v === undefined) {
        return { value: null, source_page: null, source_quote: null, confidence: null };
      }
      if (typeof v !== 'object' || Array.isArray(v)) {
        return { value: v, source_page: null, source_quote: null, confidence: null };
      }
      return v;
    },
    z.object({
      value: value.nullable(),
      source_page: z.number().int().nullable(),
      source_quote: z.string().nullable(),
      confidence: z.number().min(0).max(1).nullable(),
    }),
  );

/* ---------------------------------------------------------------------- */
/* Doc-type taxonomy                                                      */
/* ---------------------------------------------------------------------- */

export const DocTypeEnum = z.enum([
  'passport',
  'status_doc',
  'i94',
  'bank_statement',
  'tax_doc',
  'money_movement',
  'source_of_funds',
  'formation_doc',
  'ownership_evidence',
  'lease_or_property',
  'business_plan',
  'invoice_or_receipt',
  'business_contract',
  'payroll_doc',
  'uscis_or_dos_form',
  'cover_letter',
  'expert_letter',
  'employer_letter',
  'cv_or_resume',
  'financial_statement',
  'credential',
  'vital_record',
  'title_deed',
  'government_id',
  'translation_certification',
  'other',
]);
export type DocType = z.infer<typeof DocTypeEnum>;

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  passport: 'Passport',
  status_doc: 'US status / visa stamp / I-797 / EAD',
  i94: 'CBP I-94 arrival/departure record',
  bank_statement: 'Bank statement',
  tax_doc: 'Tax return / W-2',
  money_movement: 'Wire / transfer / check',
  source_of_funds: 'Source of funds (deed, gift, inheritance, loan)',
  formation_doc: 'Articles / EIN / operating agreement',
  ownership_evidence: 'Cap table / share certificate',
  lease_or_property: 'Lease / premises / property',
  business_plan: 'Business plan',
  invoice_or_receipt: 'Invoice / purchase receipt',
  business_contract: 'Customer / vendor contract',
  payroll_doc: 'Payroll / employment record',
  uscis_or_dos_form: 'USCIS / DOS form (I-129, DS-160, DS-156E, G-28)',
  cover_letter: 'Cover letter / petition memo',
  expert_letter: 'Expert / advisory letter',
  employer_letter: 'Employer letter / verification of employment / service record',
  cv_or_resume: 'CV / resume',
  financial_statement: 'Balance sheet / P&L / cash flow',
  credential: 'Diploma / professional certification / license',
  vital_record: 'Birth / marriage / divorce / death certificate',
  title_deed: 'Title deed / land registry / Tapu',
  government_id: 'National ID / driver’s license / SSN card',
  translation_certification: 'Certified translator’s declaration',
  other: 'Other',
};

/* ---------------------------------------------------------------------- */
/* Per-type micro-schemas                                                 */
/* ---------------------------------------------------------------------- */

/**
 * Common fields every micro-schema carries. Spread into each variant of
 * the discriminated union so the fields are required on every
 * PerPdfFacts shape (and the classifier prompt always emits them).
 *
 * Two coexisting names are stored:
 *   - suggested_filename — kebab-case ASCII for the audit / rename system.
 *   - display_name      — slot-based, dot-separated, diacritic-preserved
 *                         human-readable name for the dashboard inventory
 *                         and exhibit list. Disk filenames are NEVER
 *                         modified; both fields are pure metadata.
 */
const COMMON_FIELDS = {
  /**
   * Canonical filename suggestion. Kebab-case, lowercase, ASCII-only,
   * ≤80 chars, ends in `.pdf`. Pattern:
   *   <party-or-entity>-<doc-type>-<distinguishing-detail>-<date>.pdf
   * The aggregator and the rename API treat this as a soft suggestion;
   * applied aliases live in db/filename-aliases.json (no source-file
   * mutation).
   */
  suggested_filename: Field(z.string()),
  /**
   * Human-readable display name. Slot-based, " · " (U+00B7) separated,
   * Title Case proper nouns + labels, native diacritics PRESERVED (never
   * ASCII-folded — that's suggested_filename's job). Cap 110 chars
   * including the .pdf extension; on overflow, slots drop in priority
   * Detail → Identifier → Institution. Slot order:
   *   [Entity] · [Institution] · [Identifier] · [Doc Type Label]
   *           · [Detail] · [Period]
   * Used by the dashboard document-inventory and the exhibit-list
   * generator. Coexists with suggested_filename — neither replaces the
   * raw on-disk filename.
   */
  display_name: Field(z.string()),
};

const PassportFactsSchema = z.object({
  doc_type: z.literal('passport'),
  ...COMMON_FIELDS,
  full_name: Field(z.string()),
  dob: Field(z.string()),
  nationality: Field(z.string()),
  passport_number: Field(z.string()),
  passport_expiry: Field(z.string()),
  place_of_birth: Field(z.string()),
  issue_date: Field(z.string()),
});

const StatusDocFactsSchema = z.object({
  doc_type: z.literal('status_doc'),
  ...COMMON_FIELDS,
  full_name: Field(z.string()),
  status_class: Field(z.string()),
  i94_admission_number: Field(z.string()),
  admission_date: Field(z.string()),
  authorized_until: Field(z.string()),
  issuing_office: Field(z.string()),
});

const I94ThinFactsSchema = z.object({
  doc_type: z.literal('i94'),
  ...COMMON_FIELDS,
  full_name: Field(z.string()),
  admission_number: Field(z.string()),
  class_of_admission: Field(z.string()),
  admission_date: Field(z.string()),
  admit_until_date: Field(z.string()),
  port_of_entry: Field(z.string()),
});

const BankTransferEntrySchema = z.object({
  date: Field(z.string()),
  amount_usd: Field(z.number()),
  counterparty: Field(z.string()),
  direction: Field(z.enum(['in', 'out'])),
});

const BankStatementFactsSchema = z.object({
  doc_type: z.literal('bank_statement'),
  ...COMMON_FIELDS,
  account_holder: Field(z.string()),
  bank_name: Field(z.string()),
  account_last4: Field(z.string()),
  statement_period: Field(z.string()),
  ending_balance_usd: Field(z.number()),
  notable_transfers: z.array(BankTransferEntrySchema),
});

const TaxDocFactsSchema = z.object({
  doc_type: z.literal('tax_doc'),
  ...COMMON_FIELDS,
  filer_name: Field(z.string()),
  tax_year: Field(z.string()),
  form_type: Field(z.string()),
  total_income_usd: Field(z.number()),
  jurisdiction: Field(z.string()),
});

const MoneyMovementFactsSchema = z.object({
  doc_type: z.literal('money_movement'),
  ...COMMON_FIELDS,
  amount_usd: Field(z.number()),
  amount_origin: Field(z.number()),
  origin_currency_code: Field(z.string()),
  fx_rate_used: Field(z.number()),
  date: Field(z.string()),
  from_holder: Field(z.string()),
  from_account_last4: Field(z.string()),
  to_holder: Field(z.string()),
  to_account_last4: Field(z.string()),
  reference: Field(z.string()),
});

const SourceOfFundsFactsSchema = z.object({
  doc_type: z.literal('source_of_funds'),
  ...COMMON_FIELDS,
  category: Field(
    z.enum([
      'deed_of_sale',
      'gift_letter',
      'inheritance',
      'loan_agreement',
      'sale_of_business',
      'salary_or_savings',
      'crypto',
      'other',
    ]),
  ),
  amount_usd: Field(z.number()),
  date: Field(z.string()),
  donor_or_seller: Field(z.string()),
  recipient: Field(z.string()),
  notarized_or_apostilled: Field(z.boolean()),
  notes: Field(z.string()),
});

const FormationDocFactsSchema = z.object({
  doc_type: z.literal('formation_doc'),
  ...COMMON_FIELDS,
  kind: Field(
    z.enum([
      'articles_of_incorporation',
      'articles_of_organization',
      'ein_letter',
      'operating_agreement',
      'bylaws',
      'amendment',
      'other',
    ]),
  ),
  entity_legal_name: Field(z.string()),
  entity_type: Field(z.string()),
  formation_date: Field(z.string()),
  state_of_formation: Field(z.string()),
  ein: Field(z.string()),
});

const OwnershipEntryDocSchema = z.object({
  owner_name: Field(z.string()),
  ownership_percent: Field(z.number()),
  nationality: Field(z.string()),
});

const OwnershipEvidenceFactsSchema = z.object({
  doc_type: z.literal('ownership_evidence'),
  ...COMMON_FIELDS,
  kind: Field(
    z.enum(['cap_table', 'share_certificate', 'operating_agreement_exhibit', 'other']),
  ),
  entity_name: Field(z.string()),
  ownership_entries: z.array(OwnershipEntryDocSchema),
  total_shares_or_units: Field(z.number()),
  document_date: Field(z.string()),
});

const LeaseOrPropertyFactsSchema = z.object({
  doc_type: z.literal('lease_or_property'),
  ...COMMON_FIELDS,
  address: Field(z.string()),
  lessor: Field(z.string()),
  lessee: Field(z.string()),
  term_start: Field(z.string()),
  term_end: Field(z.string()),
  monthly_rent_usd: Field(z.number()),
  deposit_usd: Field(z.number()),
  square_footage: Field(z.number()),
});

const BusinessPlanFactsSchema = z.object({
  doc_type: z.literal('business_plan'),
  ...COMMON_FIELDS,
  enterprise_name: Field(z.string()),
  industry: Field(z.string()),
  naics_code: Field(z.string()),
  projected_revenue_year1_usd: Field(z.number()),
  projected_revenue_year5_usd: Field(z.number()),
  hire_plan_summary: Field(z.string()),
  market_summary: Field(z.string()),
  five_year_horizon_addressed: Field(z.boolean()),
});

const InvoiceOrReceiptFactsSchema = z.object({
  doc_type: z.literal('invoice_or_receipt'),
  ...COMMON_FIELDS,
  vendor: Field(z.string()),
  item_description: Field(z.string()),
  amount_usd: Field(z.number()),
  date: Field(z.string()),
  payment_method: Field(z.string()),
  category: Field(
    z.enum([
      'equipment',
      'inventory',
      'build_out',
      'professional_fees',
      'marketing',
      'lease_deposit',
      'franchise_fee',
      'working_capital',
      'other',
    ]),
  ),
});

const BusinessContractFactsSchema = z.object({
  doc_type: z.literal('business_contract'),
  ...COMMON_FIELDS,
  counterparty_name: Field(z.string()),
  role: Field(z.enum(['customer', 'vendor', 'service_provider', 'partner', 'other'])),
  contract_value_usd: Field(z.number()),
  term_summary: Field(z.string()),
  signed_date: Field(z.string()),
});

const PayrollDocFactsSchema = z.object({
  doc_type: z.literal('payroll_doc'),
  ...COMMON_FIELDS,
  employer_name: Field(z.string()),
  employee_count: Field(z.number()),
  pay_period: Field(z.string()),
  total_payroll_usd: Field(z.number()),
  has_w2_employees: Field(z.boolean()),
});

const UscisOrDosFormFactsSchema = z.object({
  doc_type: z.literal('uscis_or_dos_form'),
  ...COMMON_FIELDS,
  form_id: Field(z.string()),
  form_edition: Field(z.string()),
  beneficiary_name: Field(z.string()),
  petitioner_name: Field(z.string()),
  signature_present: Field(z.boolean()),
  signature_date: Field(z.string()),
  attorney_g28_present: Field(z.boolean()),
  // I-129 E Supplement only: dollar amount of the treaty-investor
  // investment as restated on the form. Drives the manual §4.5 quality
  // gate against the membership_interest_transfer_agreement contract's
  // total_consideration_amount (mismatch = severity 5).
  investment_amount_usd: Field(z.number()),
});

const CoverLetterFactsSchema = z.object({
  doc_type: z.literal('cover_letter'),
  ...COMMON_FIELDS,
  visa_type_argued: Field(z.string()),
  addressee: Field(z.string()),
  attorney_name: Field(z.string()),
  attorney_signature_present: Field(z.boolean()),
  letter_date: Field(z.string()),
  word_count_estimate: Field(z.number()),
});

const ExpertLetterFactsSchema = z.object({
  doc_type: z.literal('expert_letter'),
  ...COMMON_FIELDS,
  writer_name: Field(z.string()),
  writer_title: Field(z.string()),
  writer_institution: Field(z.string()),
  writer_country: Field(z.string()),
  relationship_to_beneficiary: Field(z.string()),
  letter_date: Field(z.string()),
  strongest_sentence: Field(z.string()),
});

const EmployerLetterFactsSchema = z.object({
  doc_type: z.literal('employer_letter'),
  ...COMMON_FIELDS,
  letter_kind: Field(
    z.enum([
      'letter_of_recommendation',
      'verification_of_employment',
      'service_record',
      'reference_letter',
      'other',
    ]),
  ),
  employer_name: Field(z.string()),
  beneficiary_name: Field(z.string()),
  position_title: Field(z.string()),
  employment_start_date: Field(z.string()),
  employment_end_date: Field(z.string()),
  letter_date: Field(z.string()),
});

const CvOrResumeFactsSchema = z.object({
  doc_type: z.literal('cv_or_resume'),
  ...COMMON_FIELDS,
  beneficiary_name: Field(z.string()),
  current_title: Field(z.string()),
  current_employer: Field(z.string()),
  total_years_experience: Field(z.number()),
  highest_degree: Field(z.string()),
  prior_executive_titles_count: Field(z.number()),
  specialized_skills_summary: Field(z.string()),
});

const FinancialStatementThinFactsSchema = z.object({
  doc_type: z.literal('financial_statement'),
  ...COMMON_FIELDS,
  statement_kind: Field(
    z.enum(['balance_sheet', 'profit_and_loss', 'cash_flow', 'combined', 'other']),
  ),
  entity_name: Field(z.string()),
  period_or_as_of_date: Field(z.string()),
  total_assets_usd: Field(z.number()),
  total_revenue_usd: Field(z.number()),
  net_income_usd: Field(z.number()),
});

const CredentialFactsSchema = z.object({
  doc_type: z.literal('credential'),
  ...COMMON_FIELDS,
  credential_kind: Field(
    z.enum([
      'diploma',
      'professional_certification',
      'training_certificate',
      'license',
      'transcript',
      'other',
    ]),
  ),
  holder_name: Field(z.string()),
  issuing_institution: Field(z.string()),
  field_of_study_or_subject: Field(z.string()),
  date_issued: Field(z.string()),
  identifier_or_certificate_number: Field(z.string()),
});

const VitalRecordFactsSchema = z.object({
  doc_type: z.literal('vital_record'),
  ...COMMON_FIELDS,
  record_kind: Field(
    z.enum([
      'birth_certificate',
      'marriage_certificate',
      'divorce_decree',
      'death_certificate',
      'other',
    ]),
  ),
  primary_party_name: Field(z.string()),
  secondary_party_name: Field(z.string()),
  event_date: Field(z.string()),
  registry_office: Field(z.string()),
  registry_country: Field(z.string()),
  has_certified_translation: Field(z.boolean()),
});

const TitleDeedFactsSchema = z.object({
  doc_type: z.literal('title_deed'),
  ...COMMON_FIELDS,
  property_address: Field(z.string()),
  registered_owner_name: Field(z.string()),
  parcel_or_registry_number: Field(z.string()),
  registration_date: Field(z.string()),
  transfer_date: Field(z.string()),
  registry_office: Field(z.string()),
  registry_country: Field(z.string()),
});

const GovernmentIdFactsSchema = z.object({
  doc_type: z.literal('government_id'),
  ...COMMON_FIELDS,
  id_kind: Field(
    z.enum([
      'national_id',
      'drivers_license',
      'state_id',
      'foreign_residency_card',
      'social_security_card',
      'other',
    ]),
  ),
  holder_name: Field(z.string()),
  id_number: Field(z.string()),
  issue_country: Field(z.string()),
  issue_date: Field(z.string()),
  expiry_date: Field(z.string()),
});

const TranslationCertificationFactsSchema = z.object({
  doc_type: z.literal('translation_certification'),
  ...COMMON_FIELDS,
  translator_name: Field(z.string()),
  source_language: Field(z.string()),
  target_language: Field(z.string()),
  document_translated_summary: Field(z.string()),
  date_signed: Field(z.string()),
  competency_statement_present: Field(z.boolean()),
});

const OtherFactsSchema = z.object({
  doc_type: z.literal('other'),
  ...COMMON_FIELDS,
  one_line_summary: Field(z.string()),
  key_facts: z.array(
    z.object({
      key: Field(z.string()),
      value: Field(z.string()),
    }),
  ),
});

/* ---------------------------------------------------------------------- */
/* Discriminated union — the per-PDF facts schema                          */
/* ---------------------------------------------------------------------- */

export const PerPdfFactsSchema = z.discriminatedUnion('doc_type', [
  PassportFactsSchema,
  StatusDocFactsSchema,
  I94ThinFactsSchema,
  BankStatementFactsSchema,
  TaxDocFactsSchema,
  MoneyMovementFactsSchema,
  SourceOfFundsFactsSchema,
  FormationDocFactsSchema,
  OwnershipEvidenceFactsSchema,
  LeaseOrPropertyFactsSchema,
  BusinessPlanFactsSchema,
  InvoiceOrReceiptFactsSchema,
  BusinessContractFactsSchema,
  PayrollDocFactsSchema,
  UscisOrDosFormFactsSchema,
  CoverLetterFactsSchema,
  ExpertLetterFactsSchema,
  EmployerLetterFactsSchema,
  CvOrResumeFactsSchema,
  FinancialStatementThinFactsSchema,
  CredentialFactsSchema,
  VitalRecordFactsSchema,
  TitleDeedFactsSchema,
  GovernmentIdFactsSchema,
  TranslationCertificationFactsSchema,
  OtherFactsSchema,
]);

export type PerPdfFacts = z.infer<typeof PerPdfFactsSchema>;

export interface PerPdfResult {
  filename: string;
  pageCount: number;
  facts?: PerPdfFacts;
  /**
   * Rich contract extraction, attached as a second pass when the first-pass
   * classifier returns a contract-flavored doc_type (business_contract,
   * lease_or_property, ownership_evidence, formation_doc). The contract
   * facts use their own contract_subtype-discriminated schema; the original
   * `facts` field stays populated with the thin doc_type extraction so
   * downstream consumers that don't know about contracts still work.
   */
  contract?: ContractFacts;
  /**
   * Rich bank-receipt extraction (manual §5.1.3 multi-installment property
   * sale, §5.1.6 recurring rental income, or single FX/transfer receipts).
   * Attached when the first-pass classifier returns money_movement or
   * source_of_funds. Discriminated by receipt_subtype (single_event vs
   * multi_installment).
   */
  bankReceipt?: BankReceiptFacts;
  /**
   * Rich wire-confirmation extraction (manual §5.2.1 / §5.2.2 / §5.2.3 + the
   * Subtype-4 corporate-funding pattern). Attached when the first-pass
   * classifier returns money_movement. Discriminated by wire_subtype
   * (international_wire_with_fx | usd_only_wire | corporate_funding); the
   * aggregator runs a deterministic FX-validation gate against the
   * international_wire_with_fx variant.
   */
  wireConfirmation?: WireConfirmationFacts;
  /**
   * Rich government-document extraction (manual §5.1.1 / §5.1.2 title deeds,
   * §12.3 marriage certificates, §12.4 birth certificates, court orders).
   * Attached when the first-pass classifier returns source_of_funds (title
   * deeds) or other (vital records, court orders). Detection of a
   * title_deed sets the drafter's tapu-explanation defensive flag.
   */
  governmentDoc?: GovernmentDocFacts;
  /**
   * Rich passport extraction (manual §3.1). Splits full_name into native
   * + ASCII forms, captures sex, and feeds the deterministic
   * passport_expires_soon gate (≥ 6 months validity at filing).
   */
  passport?: PassportFactsRich;
  /**
   * Rich I-94 extraction (manual §3.4). Adds port_of_entry and feeds the
   * deterministic status_violation_at_filing gate (admit_until ≥ filing).
   */
  i94?: I94Facts;
  /**
   * Rich visa-stamp / I-797 extraction (manual §3.2). Attached when the
   * first-pass returns status_doc AND the filename matches
   * /(visa|stamp|i-797)/i — the thin classifier lumps stamps, I-94s, and
   * I-797 notices together under status_doc.
   */
  visaStamp?: VisaStampFacts;
  /**
   * Rich vital-records extraction (manual §12.3 / §12.4). Drills into
   * translation certification (translator name + date) for the
   * deterministic translation_certification_missing gate. Coexists with
   * governmentDoc — both may fire on the same PDF.
   */
  vitalRecords?: VitalRecordsFacts;
  /**
   * Rich payroll extraction (manual §9 marginality / 9 FAM 402.9-6(D)).
   * Discriminated by payroll_subtype (payroll_register | w2_summary |
   * form_941 | employee_list | other_payroll). When a payroll_register
   * carries employee_count_excluding_beneficiary ≥ 1 the aggregator sets
   * marginality_evidence_present.us_workers_employed=true.
   */
  payroll?: PayrollFacts;
  /**
   * Rich tax-return extraction (manual §9 + investment-vs-balance-sheet
   * gate). Discriminated by tax_return_subtype (form_1120 | form_1120s |
   * form_1065 | form_1040_schedule_c | form_1040_k1 | other_tax_return).
   * Variants with Schedule L feed the deterministic
   * tax_balance_sheet_drift gate against the I-129 E Supplement.
   */
  taxReturn?: TaxReturnFacts;
  /**
   * Rich financial-statement extraction. Discriminated by
   * statement_subtype (profit_and_loss | balance_sheet | cash_flow |
   * combined_statements | other_financial). The P&L net_income feeds the
   * deterministic pl_tax_net_income_drift gate against the matching
   * tax-return for the same tax year.
   */
  financialStatement?: FinancialStatementFacts;
  /**
   * Rich job-offer-letter extraction (manual MANUAL-SUBTYPE-4 §3.3 / §3.7).
   * Drives the salary_below_benchmark and cv_title_vs_offer_drift gates.
   */
  jobOffer?: JobOfferFacts;
  /**
   * Rich service-record extraction (manual MANUAL-SUBTYPE-4 §3.3.3).
   * Foreign-government / former-employer record establishing the
   * Beneficiary's prior tenure + salary for the salary-differential
   * argument under 9 FAM 402.9-7(2)(b).
   */
  serviceRecord?: ServiceRecordFacts;
  /**
   * Rich CV / résumé extraction (manual MANUAL-SUBTYPE-4 §3.3.2).
   * current_position_title feeds the cv_title_vs_offer_drift gate.
   */
  cv?: CvFacts;
  /**
   * Rich credential extraction (manual MANUAL-SUBTYPE-4 §3.3.4 / §3.3.5).
   * Discriminated by credential_subtype; the diploma variant's
   * apostille_or_legalization_present field drives the
   * credential_unverifiable gate.
   */
  credential?: CredentialFacts;
  /**
   * Rich recommendation-letter extraction (manual MANUAL-SUBTYPE-4 §3.3.6).
   * letter_kind drives the personal_reference_letter gate (severity 3
   * for kind='personal' since prior-employer letters are required).
   */
  recommendationLetter?: RecommendationLetterFacts;
  /**
   * Rich corporate-formation extraction (Articles of Organization /
   * Incorporation, Operating Agreement amendments, EIN assignment letter,
   * Certificate of Good Standing, state registrations). Attached when
   * the first-pass classifier returns doc_type='formation_doc'. Renderers
   * MUST mask all but the last 4 digits of any captured EIN per the
   * firm's PII rule.
   */
  corporateFormation?: CorporateFormationFacts;
  /**
   * Rich foreign-corporate extraction (Esas Sözleşme, board resolutions,
   * shareholder registers, audited financials, foreign tax certificates).
   * Attached when the first-pass classifier returns an ownership /
   * financial / other-flavored doc_type AND the filename matches the
   * foreign-corporate pattern (typed-extract.ts router). The
   * shareholder_register variant feeds the manual §3.2 deterministic
   * gate (treaty_national_ownership_percent ≥ 50).
   */
  foreignCorporate?: ForeignCorporateFacts;
  /**
   * Rich image-bearing extraction — passport photos, signature pages,
   * apostille stamps, consular seals, other image artifacts. Stacks with
   * passport / i94 / government-doc when the same PDF carries both text
   * and an image-bearing rendering. Routes when looksLikeScan=true OR
   * the filename hints at an image artifact (typed-extract.ts router).
   */
  imagePhoto?: ImagePhotoFacts;
  /**
   * Rich customer-contract extraction (manual MANUAL-SUBTYPE-4 §3.8.2 —
   * offtake / supply / MSA / distribution agreements). Routes when the
   * thin classifier returns business_contract AND the content / filename
   * matches the customer-commitment pattern. Surfaced in the cover-letter
   * DOING BUSINESS section as substantiality + marginality anchors.
   */
  customerContract?: CustomerContractFacts;
  /**
   * Rich real-estate purchase-agreement extraction (manual MANUAL-SUBTYPE-4
   * §3.8.5). Routes when the thin classifier returns lease_or_property
   * AND the content references purchase / sale / conveyance / closing.
   * Drives the deterministic 'real_estate_buyer_mismatch' gate
   * (severity 4) when buyer_legal_name disagrees with the Petitioner's
   * legal_name.
   */
  realEstatePurchase?: RealEstatePurchaseFacts;
  /**
   * Rich incentive-document extraction (PTC, IRA, state credits, federal
   * grants, tax exemptions). Routes when the thin classifier returns
   * business_contract AND the content references incentives / tax credits
   * / grants / IRA / PTC. Drives the deterministic
   * 'incentive_recipient_mismatch' gate (severity 3) when
   * recipient_legal_name disagrees with the Petitioner's legal_name.
   */
  incentiveDocument?: IncentiveDocumentFacts;
  /**
   * Rich cover-letter extraction (Phase-4). Routes when the thin
   * classifier returns doc_type='cover_letter'. Pulls the narrative
   * assertions the thin classifier doesn't capture: operational-since
   * date, claimed business model, NAICS if cited, and (Subtype 3/4)
   * principal-treaty-investor identity. Drives b2_status_violation_signal
   * and external_evidence_contradiction_risk gates.
   */
  coverLetter?: CoverLetterRichFacts;
  /**
   * Rich RFE / NOID extraction (Phase-4). Routes on filename match
   * /(rfe|noid|notice of intent to deny|request for evidence)/i regardless
   * of thin doc_type. Classifies subject_category into a closed enum and
   * extracts header dates / officer / evidence-requested bullets, plus
   * the verbatim assertion the firm responds to (initial_filing_assertion)
   * and the response's new assertion (response_assertion). Drives
   * material_change_in_response_to_uscis and multi_round_rfe_escalation.
   */
  rfeNotice?: RfeNoticeFacts;
  /**
   * Rich I-129 E Supplement extraction (Phase-7). Routes when the thin
   * doc_type='uscis_or_dos_form' AND the form_id matches I-129E OR the
   * filename / first-page text indicates a "Supplement E" / "Treaty
   * Trader / Treaty Investor" header. Adds industry_classification +
   * treaty_country + beneficiary_ownership_percent that the thin
   * UscisOrDosFormFactsSchema lacks. Closes the Phase-6 NAICS drift gate
   * to a 3-source comparison.
   */
  i129eSupplement?: I129ESupplementFacts;
  /**
   * Rich business-plan extraction (Phase-9). Routes when the thin
   * doc_type='business_plan'. Pulls year-1 / year-3 / year-5 revenue +
   * year-5 employee count for the
   * `five_year_horizon_vs_business_plan_drift` gate to compare against
   * the cover-letter narrative claim.
   */
  businessPlan?: BusinessPlanRichFacts;
  error?: { code: string; message: string };
}

/**
 * Memory groups per-PDF extractions by doc_type. The aggregator and the
 * frontend both read this shape.
 */
export type TypedMemory = Partial<Record<DocType, PerPdfResult[]>>;

/* ---------------------------------------------------------------------- */
/* Audit-row interfaces — Tab F substantiality reconciliation             */
/* ---------------------------------------------------------------------- */

export interface SubstantialityReconEvidence {
  filename: string;
  amount_usd: number;
  category: 'outflow' | 'invoice' | 'equipment';
}

/**
 * Tab F substantiality reconciliation result. Computed deterministically
 * from the typed memory by ingest/typed-aggregate.ts. Verdicts:
 *   - 'within_tolerance'      — coverage_ratio ∈ [0.85, 1.15]
 *   - 'under_documented'      — coverage_ratio < 0.85, severity 3
 *   - 'over_documented'       — coverage_ratio > 1.15, severity 2
 *   - 'no_committed_amount'   — neither contract nor I-129E supplied a
 *                                committed figure; gate is a no-op
 */
export interface SubstantialityReconResult {
  total_committed_usd: number | null;
  sum_outflows_usd: number;
  sum_invoices_usd: number;
  sum_equipment_usd: number;
  coverage_ratio: number | null;
  verdict:
    | 'within_tolerance'
    | 'under_documented'
    | 'over_documented'
    | 'no_committed_amount';
  evidence_doc: SubstantialityReconEvidence[];
  /** Filename of the contract that supplied total_committed_usd, if any. */
  contract_filename: string | null;
  /** Contract effective_date (ISO YYYY-MM-DD) used for the ±90d window. */
  contract_effective_date: string | null;
}

/* ---------------------------------------------------------------------- */
/* Audit-row interfaces — Tab D entity-name coherence                     */
/* ---------------------------------------------------------------------- */

export interface EntityNameOccurrence {
  /** Filename the candidate entity name appeared on. */
  filename: string;
  /** Source field — e.g., 'formation_doc.corporateFormation.entity_legal_name'. */
  source_field: string;
  /** Raw name as extracted (pre-normalize). */
  raw_name: string;
}

export interface EntityNameGroup {
  /** Canonical (normalized + suffix-stripped) name representing the group. */
  canonical_name: string;
  /** Every occurrence of this group's name across the typed memory. */
  occurrences: EntityNameOccurrence[];
}

/**
 * Tab D entity-coherence audit row. Verdicts:
 *   - 'single_entity'           — exactly one normalized name across docs;
 *                                  no conflict
 *   - 'parent_subsidiary'       — two groups linked by foreign-corporate
 *                                  board_resolution.authorizes_us_investment;
 *                                  no conflict
 *   - 'name_drift'              — two+ unrelated groups; severity 4
 *                                  conflict_type='entity_name_drift'
 *   - 'no_entity_evidence'      — no candidate names at all; no-op
 */
export interface EntityCoherenceResult {
  verdict:
    | 'single_entity'
    | 'parent_subsidiary'
    | 'name_drift'
    | 'no_entity_evidence';
  groups: EntityNameGroup[];
  /** Canonical name when a single coherent identity is established. */
  canonical_name: string | null;
  /**
   * For 'parent_subsidiary' verdict: the foreign-parent's canonical name
   * and the US-subsidiary's canonical name. Empty otherwise.
   */
  foreign_parent_name: string | null;
  us_subsidiary_name: string | null;
}

export function groupByDocType(results: PerPdfResult[]): TypedMemory {
  const out: TypedMemory = {};
  for (const r of results) {
    const t = r.facts?.doc_type ?? 'other';
    const list = out[t] ?? [];
    list.push(r);
    out[t] = list;
  }
  return out;
}
