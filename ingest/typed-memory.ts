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
  'other',
]);
export type DocType = z.infer<typeof DocTypeEnum>;

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  passport: 'Passport',
  status_doc: 'US status / I-94 / visa stamp',
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
  other: 'Other',
};

/* ---------------------------------------------------------------------- */
/* Per-type micro-schemas                                                 */
/* ---------------------------------------------------------------------- */

const PassportFactsSchema = z.object({
  doc_type: z.literal('passport'),
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
  full_name: Field(z.string()),
  status_class: Field(z.string()),
  i94_admission_number: Field(z.string()),
  admission_date: Field(z.string()),
  authorized_until: Field(z.string()),
  issuing_office: Field(z.string()),
});

const BankTransferEntrySchema = z.object({
  date: Field(z.string()),
  amount_usd: Field(z.number()),
  counterparty: Field(z.string()),
  direction: Field(z.enum(['in', 'out'])),
});

const BankStatementFactsSchema = z.object({
  doc_type: z.literal('bank_statement'),
  account_holder: Field(z.string()),
  bank_name: Field(z.string()),
  account_last4: Field(z.string()),
  statement_period: Field(z.string()),
  ending_balance_usd: Field(z.number()),
  notable_transfers: z.array(BankTransferEntrySchema),
});

const TaxDocFactsSchema = z.object({
  doc_type: z.literal('tax_doc'),
  filer_name: Field(z.string()),
  tax_year: Field(z.string()),
  form_type: Field(z.string()),
  total_income_usd: Field(z.number()),
  jurisdiction: Field(z.string()),
});

const MoneyMovementFactsSchema = z.object({
  doc_type: z.literal('money_movement'),
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
  counterparty_name: Field(z.string()),
  role: Field(z.enum(['customer', 'vendor', 'service_provider', 'partner', 'other'])),
  contract_value_usd: Field(z.number()),
  term_summary: Field(z.string()),
  signed_date: Field(z.string()),
});

const PayrollDocFactsSchema = z.object({
  doc_type: z.literal('payroll_doc'),
  employer_name: Field(z.string()),
  employee_count: Field(z.number()),
  pay_period: Field(z.string()),
  total_payroll_usd: Field(z.number()),
  has_w2_employees: Field(z.boolean()),
});

const UscisOrDosFormFactsSchema = z.object({
  doc_type: z.literal('uscis_or_dos_form'),
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
  visa_type_argued: Field(z.string()),
  addressee: Field(z.string()),
  attorney_name: Field(z.string()),
  attorney_signature_present: Field(z.boolean()),
  letter_date: Field(z.string()),
  word_count_estimate: Field(z.number()),
});

const ExpertLetterFactsSchema = z.object({
  doc_type: z.literal('expert_letter'),
  writer_name: Field(z.string()),
  writer_title: Field(z.string()),
  writer_institution: Field(z.string()),
  writer_country: Field(z.string()),
  relationship_to_beneficiary: Field(z.string()),
  letter_date: Field(z.string()),
  strongest_sentence: Field(z.string()),
});

const OtherFactsSchema = z.object({
  doc_type: z.literal('other'),
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
  error?: { code: string; message: string };
}

/**
 * Memory groups per-PDF extractions by doc_type. The aggregator and the
 * frontend both read this shape.
 */
export type TypedMemory = Partial<Record<DocType, PerPdfResult[]>>;

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
