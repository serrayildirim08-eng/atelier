/**
 * Per-PDF recommendation-letter extractor schema (rich second-pass).
 *
 * Captures third-party endorsement letters supporting Subtype-3/4
 * specialized-knowledge filings (manual §3.3.6). The aggregator uses
 * letter_kind for the personal_reference_letter gate (severity 3 — manual
 * §3.3.6 requires prior-employer letters; personal letters are weak
 * evidence). The strongest verbatim quote should be cited in the cover
 * letter's "BENEFICIARY'S EMPLOYMENT HISTORY AND QUALIFICATIONS" section.
 *
 * Flat schema with one array. Provenance: every leaf carries {value,
 * source_page, source_quote, confidence}, mirroring contract.schema.ts.
 */

import { z } from 'zod';

const Field = <T extends z.ZodTypeAny>(value: T) =>
  z.object({
    value: value.nullable(),
    source_page: z.number().int().nullable(),
    source_quote: z.string().nullable(),
    confidence: z.number().min(0).max(1).nullable(),
  });

export const RecommendationLetterFactsSchema = z.object({
  letter_kind: Field(
    z.enum(['prior_employer', 'academic', 'personal', 'unclear']),
  ),
  author_name: Field(z.string()),
  author_title: Field(z.string()),
  author_employer: Field(z.string()),
  author_relationship_to_beneficiary: Field(z.string()),
  beneficiary_name_ascii: Field(z.string()),
  claimed_period_of_observation_start: Field(z.string()),
  claimed_period_of_observation_end: Field(z.string()),
  specialized_expertise_described_verbatim: Field(z.string()),
  projects_or_products_named: z.array(Field(z.string())),
  contact_info_present: Field(z.boolean()),
  letterhead_present: Field(z.boolean()),
  signature_present: Field(z.boolean()),
  signed_date: Field(z.string()),
});

export type RecommendationLetterFacts = z.infer<
  typeof RecommendationLetterFactsSchema
>;
