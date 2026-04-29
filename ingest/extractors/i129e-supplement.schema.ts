/**
 * Per-PDF I-129 E Supplement rich-extraction schema (Phase-7 second pass).
 *
 * The thin uscis_or_dos_form classifier captures form_id / signature_date /
 * investment_amount_usd but skips the substantive industry / treaty-country
 * / ownership fields the supplement carries. This rich schema fills the
 * Phase-6 NAICS drift gate's third source (cover_letter ↔ business_plan ↔
 * I-129E) and the Phase-1 unaccounted_sof_share validation.
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

export const I129ESupplementFactsSchema = z.object({
  industry_classification: Field(z.string()),
  naics_code: Field(z.string()),
  investment_amount_usd: Field(z.number()),
  treaty_country: Field(z.string()),
  beneficiary_ownership_percent: Field(z.number()),
});

export type I129ESupplementFacts = z.infer<typeof I129ESupplementFactsSchema>;
