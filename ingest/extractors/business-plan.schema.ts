/**
 * Per-PDF business-plan rich-extraction schema (Phase-9).
 *
 * The thin BusinessPlanFactsSchema in typed-memory.ts captures only
 * year_1 / year_5 revenue + a hire-plan summary. This rich schema
 * captures the four numeric projections the
 * `five_year_horizon_vs_business_plan_drift` gate compares against the
 * cover letter's narrative claims (Phase-7 / Phase-8).
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

export const BusinessPlanRichFactsSchema = z.object({
  year_1_revenue_usd: Field(z.number()),
  year_3_revenue_usd: Field(z.number()),
  year_5_revenue_usd: Field(z.number()),
  year_5_employee_count: Field(z.number()),
});

export type BusinessPlanRichFacts = z.infer<typeof BusinessPlanRichFactsSchema>;
