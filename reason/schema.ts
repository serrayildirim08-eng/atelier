import { z } from 'zod';

const SeverityEnum = z.enum(['critical', 'major', 'minor']);

/**
 * Element / criterion label is free-form because the labels differ by
 * case type (E-2 has 5 statutory elements; EB-1A has 10 regulatory
 * criteria + final merits; EB-1B has 6; EB-1C has qualifying-relationship
 * etc.). The reviewer prompt instructs the model to use stable per-case
 * labels (e.g. "e2_treaty_country", "eb1a_3_published_material_about",
 * "eb1c_qualifying_relationship", or "general").
 */
const ElementLabel = z.string();

const InconsistencySchema = z.object({
  severity: SeverityEnum,
  category: z.enum(['hallucination', 'contradicts_facts', 'internal_inconsistency']),
  description: z.string(),
  letter_excerpt: z.string().nullable(),
  facts_value: z.string().nullable(),
});

const MissingArgumentSchema = z.object({
  element: ElementLabel,
  description: z.string(),
  what_is_missing: z.string(),
  suggestion: z.string(),
});

const WeakSpotSchema = z.object({
  severity: SeverityEnum,
  element: ElementLabel,
  description: z.string(),
  rfe_risk: z.string(),
  suggestion: z.string(),
});

export const ReviewReportSchema = z.object({
  overall_assessment: z.enum(['ready', 'minor_revisions', 'major_revisions', 'not_ready']),
  summary: z.string(),
  inconsistencies: z.array(InconsistencySchema),
  missing_arguments: z.array(MissingArgumentSchema),
  weak_spots: z.array(WeakSpotSchema),
});

export type ReviewReport = z.infer<typeof ReviewReportSchema>;
export type Inconsistency = z.infer<typeof InconsistencySchema>;
export type MissingArgument = z.infer<typeof MissingArgumentSchema>;
export type WeakSpot = z.infer<typeof WeakSpotSchema>;
