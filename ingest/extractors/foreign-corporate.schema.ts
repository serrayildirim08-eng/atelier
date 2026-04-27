/**
 * Per-PDF foreign-corporate extractor schema.
 *
 * Six-variant discriminated union (by `foreign_doc_subtype`) covering
 * the foreign-jurisdiction corporate documents an E-2 case folder
 * typically contains for Subtype 2 / 3 / 4 (treaty-enterprise filings):
 *   - foreign_articles            (Esas Sözleşme / Ana Sözleşme / equivalent)
 *   - board_resolution            (yönetim kurulu kararı authorizing US investment)
 *   - shareholder_register        (cap table for the foreign parent)
 *   - audited_financials          (parent's audited group financials)
 *   - foreign_tax_certificate     (vergi levhası / equivalent)
 *   - other_foreign_corporate     (last-resort)
 *
 * Common fields (entity_legal_name native + ASCII per manual §15
 * transliteration, country, type, registry_number, filing_date) appear on
 * every variant. The shareholder_register variant exposes the manual §3.2
 * gate input: treaty_national_ownership_percent must reach ≥ 50% — the
 * aggregator runs a deterministic post-check and emits severity 5 on
 * failure.
 */

import { z } from 'zod';

const Field = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value: value.nullable(),
    source_page: z.number().int().nullable(),
    source_quote: z.string().nullable(),
    confidence: z.number().min(0).max(1).nullable(),
  });

/* ---------------------------------------------------------------------- */
/* Shared sub-schemas                                                     */
/* ---------------------------------------------------------------------- */

const ForeignOrganizerSchema = z.object({
  name: Field(z.string()),
  role: Field(z.string()),
  ownership_percent: Field(z.number()),
});

const ForeignSignatorySchema = z.object({
  name: Field(z.string()),
  title: Field(z.string()),
});

const ForeignShareholderRowSchema = z.object({
  name: Field(z.string()),
  nationality: Field(z.string()),
  ownership_percent: Field(z.number()),
  share_class: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* Variants                                                               */
/* ---------------------------------------------------------------------- */

const ForeignArticlesSchema = z.object({
  foreign_doc_subtype: z.literal('foreign_articles'),
  entity_legal_name_native: Field(z.string()),
  entity_legal_name_ascii: Field(z.string()),
  entity_country: Field(z.string()),
  entity_type: Field(z.string()),
  registry_number_or_id: Field(z.string()),
  filing_date: Field(z.string()),
  organizers: z.array(ForeignOrganizerSchema),
  registered_capital_amount: Field(z.number()),
  registered_capital_currency: Field(z.string()),
});

const BoardResolutionSchema = z.object({
  foreign_doc_subtype: z.literal('board_resolution'),
  entity_legal_name_native: Field(z.string()),
  entity_legal_name_ascii: Field(z.string()),
  entity_country: Field(z.string()),
  entity_type: Field(z.string()),
  registry_number_or_id: Field(z.string()),
  filing_date: Field(z.string()),
  meeting_date: Field(z.string()),
  resolution_text_verbatim: Field(z.string()),
  signatories: z.array(ForeignSignatorySchema),
  authorizes_us_investment: Field(z.boolean()),
  authorized_amount_usd: Field(z.number()),
});

const ShareholderRegisterSchema = z.object({
  foreign_doc_subtype: z.literal('shareholder_register'),
  entity_legal_name_native: Field(z.string()),
  entity_legal_name_ascii: Field(z.string()),
  entity_country: Field(z.string()),
  entity_type: Field(z.string()),
  registry_number_or_id: Field(z.string()),
  filing_date: Field(z.string()),
  as_of_date: Field(z.string()),
  shareholders: z.array(ForeignShareholderRowSchema),
  total_shares_issued: Field(z.number()),
  /**
   * Sum of `ownership_percent` for every shareholder whose `nationality`
   * is the qualifying treaty country. Drives the manual §3.2 (9 FAM
   * 402.9-4(B)) deterministic gate: must reach ≥ 50% for the entity to
   * qualify as a treaty enterprise. Computed by the model from the
   * shareholders[] rows.
   */
  treaty_national_ownership_percent: Field(z.number()),
});

const AuditedFinancialsSchema = z.object({
  foreign_doc_subtype: z.literal('audited_financials'),
  entity_legal_name_native: Field(z.string()),
  entity_legal_name_ascii: Field(z.string()),
  entity_country: Field(z.string()),
  entity_type: Field(z.string()),
  registry_number_or_id: Field(z.string()),
  filing_date: Field(z.string()),
  period_start: Field(z.string()),
  period_end: Field(z.string()),
  total_assets: Field(z.number()),
  total_revenue: Field(z.number()),
  net_income: Field(z.number()),
  currency: Field(z.string()),
  auditor_name: Field(z.string()),
  opinion_type: Field(
    z.enum(['unqualified', 'qualified', 'adverse', 'disclaimer']),
  ),
});

const ForeignTaxCertificateSchema = z.object({
  foreign_doc_subtype: z.literal('foreign_tax_certificate'),
  entity_legal_name_native: Field(z.string()),
  entity_legal_name_ascii: Field(z.string()),
  entity_country: Field(z.string()),
  entity_type: Field(z.string()),
  registry_number_or_id: Field(z.string()),
  filing_date: Field(z.string()),
  tax_year: Field(z.string()),
  certificate_kind: Field(z.string()),
  issuing_authority: Field(z.string()),
});

const OtherForeignCorporateSchema = z.object({
  foreign_doc_subtype: z.literal('other_foreign_corporate'),
  entity_legal_name_native: Field(z.string()),
  entity_legal_name_ascii: Field(z.string()),
  entity_country: Field(z.string()),
  entity_type: Field(z.string()),
  registry_number_or_id: Field(z.string()),
  filing_date: Field(z.string()),
  one_line_summary: Field(z.string()),
});

/* ---------------------------------------------------------------------- */
/* Discriminated union                                                    */
/* ---------------------------------------------------------------------- */

export const ForeignCorporateFactsSchema = z.discriminatedUnion(
  'foreign_doc_subtype',
  [
    ForeignArticlesSchema,
    BoardResolutionSchema,
    ShareholderRegisterSchema,
    AuditedFinancialsSchema,
    ForeignTaxCertificateSchema,
    OtherForeignCorporateSchema,
  ],
);

export type ForeignCorporateFacts = z.infer<typeof ForeignCorporateFactsSchema>;
export type ForeignCorporateSubtype =
  ForeignCorporateFacts['foreign_doc_subtype'];

export const FOREIGN_CORPORATE_SUBTYPE_LABELS: Record<
  ForeignCorporateSubtype,
  string
> = {
  foreign_articles: 'Foreign Articles (Esas / Ana Sözleşme)',
  board_resolution: 'Board Resolution (Yönetim Kurulu Kararı)',
  shareholder_register: 'Shareholder Register / Cap Table',
  audited_financials: 'Audited Financials',
  foreign_tax_certificate: 'Foreign Tax Certificate (Vergi Levhası)',
  other_foreign_corporate: 'Other Foreign Corporate Document',
};

/* ---------------------------------------------------------------------- */
/* Manual §3.2 — treaty-ownership gate                                    */
/* ---------------------------------------------------------------------- */

/**
 * 9 FAM 402.9-4(B): the petitioning enterprise must be ≥50% owned by
 * nationals of the qualifying treaty country. Threshold is exclusive of
 * the boundary — `treaty_national_ownership_percent < 50` triggers the
 * severity 5 gate. Exported so the aggregator can reference the number
 * by name instead of a magic constant.
 */
export const TREATY_OWNERSHIP_THRESHOLD = 50;
