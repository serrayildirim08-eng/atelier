import { z } from 'zod';

const SeverityEnum = z.enum(['critical', 'major', 'minor']);

const ElementEnum = z.enum([
  'treaty_country',
  'substantial_investment',
  'real_and_operating',
  'more_than_marginal',
  'develop_and_direct',
]);

const ElementOrGeneralEnum = z.enum([
  'treaty_country',
  'substantial_investment',
  'real_and_operating',
  'more_than_marginal',
  'develop_and_direct',
  'general',
]);

const InconsistencySchema = z.object({
  severity: SeverityEnum,
  category: z.enum(['hallucination', 'contradicts_facts', 'internal_inconsistency']),
  description: z.string(),
  letter_excerpt: z.string().nullable(),
  facts_value: z.string().nullable(),
});

const MissingArgumentSchema = z.object({
  element: ElementEnum,
  description: z.string(),
  what_is_missing: z.string(),
  suggestion: z.string(),
});

const WeakSpotSchema = z.object({
  severity: SeverityEnum,
  element: ElementOrGeneralEnum,
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
