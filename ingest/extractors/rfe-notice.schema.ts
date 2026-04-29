/**
 * Per-PDF RFE / NOID rich-extraction schema (Phase-4 second pass).
 *
 * Phase-3 detects RFE-flagged docs via filename / status-class regex but
 * locks subject_category to 'other' and leaves the assertion fields null.
 * This rich extractor reads the RFE / NOID body and pulls:
 *
 *   - subject_category — closed enum aligned with the RfeEntrySchema +
 *     extended values (multiple, develop_and_direct, classification_ambiguity,
 *     procedural_status, nationality_or_ownership) so a compound RFE
 *     does not collapse to 'other'. The aggregator coerces to the schema's
 *     accepted set.
 *   - rfe_date / response_deadline — header dates (ISO 8601).
 *   - issuing_officer_name + title — signature block.
 *   - evidence_requested[] — bullet list of what USCIS asks for.
 *   - response_assertion — verbatim assertion FROM A RESPONSE document
 *     (vs from the notice itself — separate detection logic at routing).
 *
 * Provenance lives on every leaf via Field<T>; nested arrays carry their
 * own per-element Fields (matching cv.schema.ts).
 */

import { z } from 'zod';

const Field = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value: value.nullable(),
    source_page: z.number().int().nullable(),
    source_quote: z.string().nullable(),
    confidence: z.number().min(0).max(1).nullable(),
  });

export const RFE_SUBJECT_CATEGORIES = [
  'bona_fide_enterprise',
  'marginality',
  'substantial_investment',
  'nationality_or_ownership',
  'develop_and_direct',
  'procedural_status',
  'source_of_funds',
  'classification_ambiguity',
  'multiple',
  'other',
] as const;

export const RfeNoticeFactsSchema = z.object({
  document_role: Field(
    z.enum(['rfe_notice', 'noid_notice', 'rfe_response', 'noid_response', 'unknown']),
  ),
  subject_category: Field(z.enum(RFE_SUBJECT_CATEGORIES)),
  rfe_date: Field(z.string()),
  response_deadline: Field(z.string()),
  issuing_officer_name: Field(z.string()),
  issuing_officer_title: Field(z.string()),
  evidence_requested: z.array(Field(z.string())),
  initial_filing_assertion: Field(z.string()),
  response_assertion: Field(z.string()),
});

export type RfeNoticeFacts = z.infer<typeof RfeNoticeFactsSchema>;
export type RfeSubjectCategory = (typeof RFE_SUBJECT_CATEGORIES)[number];
