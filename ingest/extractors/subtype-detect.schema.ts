/**
 * Phase-0.6 case-subtype detector schema.
 *
 * Matches the canonical decision-tree object specified in
 * manuals/_E2-SUBTYPE-TAXONOMY.md §12. Run AFTER the Phase-0 case-type
 * detector returns case_type='E2' and BEFORE per-document extraction.
 *
 * The detector emits a single E2CaseSubtype struct that downstream phases
 * (extractor, drafter, reviewer) branch on:
 *   - principal_subtype routes to MANUAL-SUBTYPE-{1,2,3,4}
 *   - procedural_posture decides USCIS vs consular form expectations
 *   - has_dependents adds the I-539 / I-539A tabs
 *   - detection_confidence below 'HIGH' should route to attorney review
 */

import { z } from 'zod';

export const E2PrincipalSubtypeEnum = z.enum([
  'individual_investor',
  'corporate_owned_investor',
  'executive_supervisory_employee',
  'essential_skills_employee',
]);
export type E2PrincipalSubtype = z.infer<typeof E2PrincipalSubtypeEnum>;

export const E2ProceduralPostureEnum = z.enum([
  'consular_new',
  'uscis_cos_new',
  'uscis_extension',
  'consular_renewal',
]);
export type E2ProceduralPosture = z.infer<typeof E2ProceduralPostureEnum>;

export const E2DetectionConfidenceEnum = z.enum(['HIGH', 'MED', 'LOW']);
export type E2DetectionConfidence = z.infer<typeof E2DetectionConfidenceEnum>;

const DependentBreakdownSchema = z.object({
  spouse: z.boolean(),
  children: z.number().int().min(0),
});

export const E2CaseSubtypeSchema = z.object({
  principal_subtype: E2PrincipalSubtypeEnum,
  procedural_posture: E2ProceduralPostureEnum,
  has_dependents: z.boolean(),
  dependent_count: z.number().int().min(0),
  dependent_breakdown: DependentBreakdownSchema.nullable(),
  /**
   * Verbatim phrases (5–25 words each) the classifier matched against the
   * taxonomy §7 signal table. The reviewer + attorney see these to audit
   * the classification — especially important when detection_confidence
   * is LOW.
   */
  detection_signals: z.array(z.string()),
  detection_confidence: E2DetectionConfidenceEnum,
  /**
   * Free-form rationale (1–3 sentences). The drafter uses this when
   * generating the attorney memo for skeleton-status subtypes (2, 3).
   */
  reasoning: z.string(),
});

export type E2CaseSubtype = z.infer<typeof E2CaseSubtypeSchema>;

export const PRINCIPAL_SUBTYPE_LABELS: Record<E2PrincipalSubtype, string> = {
  individual_investor: 'Subtype 1 — Individual Treaty Investor',
  corporate_owned_investor: 'Subtype 2 — Corporate-Owned Investor',
  executive_supervisory_employee: 'Subtype 3 — Executive/Supervisory Employee',
  essential_skills_employee: 'Subtype 4 — Essential Skills Employee',
};

/** Subtypes whose manuals are skeleton-only — bot must route to attorney. */
export const SKELETON_SUBTYPES: ReadonlySet<E2PrincipalSubtype> =
  new Set<E2PrincipalSubtype>([
    'corporate_owned_investor',
    'executive_supervisory_employee',
  ]);
