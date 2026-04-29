/**
 * Per-PDF cover-letter rich-extraction schema (Phase-4 second pass).
 *
 * The first-pass cover_letter doc_type captures only metadata
 * (visa_type_argued, addressee, attorney_name, letter_date,
 * word_count_estimate). This rich schema captures the narrative claims
 * that drive the b2_status_violation_signal and
 * external_evidence_contradiction_risk gates:
 *
 *   - fully_operational_since_date — counsel's claim about when the
 *     enterprise began day-to-day commercial activity (Flatturbo failure
 *     pattern: claimed pre-B-2 operation = unauthorized employment).
 *   - claimed_business_model — short phrase from cover letter's
 *     business-description section; compared against external evidence
 *     (Yelp / Google / BBB / Wayback) by external_evidence_contradiction_risk.
 *   - claimed_industry_naics — when cover letter cites an explicit NAICS.
 *   - principal_treaty_investor_identity — anti-ambiguity declarative
 *     for Subtype-3 / Subtype-4 cases.
 *
 * Provenance lives on every leaf via Field<T>.
 */

import { z } from 'zod';

const Field = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value: value.nullable(),
    source_page: z.number().int().nullable(),
    source_quote: z.string().nullable(),
    confidence: z.number().min(0).max(1).nullable(),
  });

// Phase-6 — closed enum mirrors CoPetitionerSchema.relationship_to_principal
// in ingest/schema.ts. Co-petitioner relationships pulled from cover-letter
// prose ("the Beneficiary's spouse", "Mr. Tarlaci, a co-investor in the
// enterprise") feed deriveCoPetitionersEnriched.
export const CoPetitionerRelationshipFromCoverLetterSchema = z.object({
  full_name: Field(z.string()),
  relationship: Field(
    z.enum([
      'spouse',
      'child',
      'co_investor',
      'sibling',
      'parent',
      'business_partner',
      'unknown',
    ]),
  ),
});

// Phase-7 — defensive passport-renewal footnote. Detects the firm's
// signature pattern ("the Beneficiary's prior passport, [old #], was
// renewed and the current passport, [new #], is appended hereto..."),
// surfaced as the explanatory paragraph + both passport numbers so the
// drafter can cite consistency.
export const PriorPassportRenewalFootnoteSchema = z.object({
  paragraph_text: z.string(),
  prior_passport_number: z.string(),
  current_passport_number: z.string(),
});

// Phase-7 — five-year revenue / staffing horizon as summarized inline in
// the cover letter (typically in the "Substantiality" or "Marginality"
// section — narrative form, not the business plan's projections table).
export const FiveYearBusinessHorizonSchema = z.object({
  year_1_revenue_usd: z.number().nullable(),
  year_3_revenue_usd: z.number().nullable(),
  year_5_revenue_usd: z.number().nullable(),
  year_5_employee_count: z.number().nullable(),
});

// Phase-7 — verbatim "develop and direct" role-grant capture (E5
// vulnerability detector). Lets the LLM reviewer flag when only a title
// is granted (no scope of authority items).
export const DevelopAndDirectRoleGrantSchema = z.object({
  role_title: z.string(),
  granting_document_ref: z.string(),
  authority_scope: z.array(z.string()),
});

export const CoverLetterRichFactsSchema = z.object({
  fully_operational_since_date: Field(z.string()),
  claimed_business_model: Field(z.string()),
  claimed_industry_naics: Field(z.string()),
  principal_treaty_investor_identity: Field(z.string()),
  // Phase-6 optional list — populated only when the cover letter prose
  // names a co-petitioner with a verbatim relationship marker. Empty
  // array (not null) when no markers are found, so back-compat parses
  // legacy fixtures that omit the field entirely.
  co_petitioner_relationships: z
    .array(CoPetitionerRelationshipFromCoverLetterSchema)
    .optional()
    .default([]),
  // Phase-7 narrative-claim extensions (Atelier voice corpus).
  prior_passport_renewal_footnote: PriorPassportRenewalFootnoteSchema
    .nullable()
    .optional()
    .default(null),
  five_year_business_horizon: FiveYearBusinessHorizonSchema
    .nullable()
    .optional()
    .default(null),
  develop_and_direct_role_grant: DevelopAndDirectRoleGrantSchema
    .nullable()
    .optional()
    .default(null),
});

export type CoverLetterRichFacts = z.infer<typeof CoverLetterRichFactsSchema>;
