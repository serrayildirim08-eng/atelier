/**
 * EB-1A field-of-endeavor classifier schema (Tier-3).
 *
 * Run AFTER per-PDF rich extraction has produced CV roles, diploma
 * fields, recent publications, and recommendation-letter excerpts.
 * Output is a single Goldilocks-graded label that the criteria gates
 * use as the peer-comparison anchor.
 *
 * Goldilocks rule:
 *   too_broad   — peer comparison meaningless ("computer science")
 *   goldilocks  — specific enough that "others in the field" is
 *                 well-defined, broad enough that a peer set exists
 *                 ("applied machine learning for medical imaging")
 *   too_narrow  — no defined peer set ("React 19 server-component
 *                 memory profiling on Vercel Edge")
 */

import { z } from 'zod';

export const FieldSpecificityEnum = z.enum(['too_broad', 'goldilocks', 'too_narrow']);
export type FieldSpecificity = z.infer<typeof FieldSpecificityEnum>;

export const FieldConfidenceEnum = z.enum(['HIGH', 'MED', 'LOW']);
export type FieldConfidence = z.infer<typeof FieldConfidenceEnum>;

export const FieldOfEndeavorSchema = z.object({
  /**
   * The field label, 3–10 words. Style: noun phrase, sentence case,
   * no leading "the". Examples: "applied machine learning for medical
   * imaging", "medium-voltage switchgear engineering",
   * "computational structural biology".
   */
  label: z.string(),
  /**
   * One-sentence description of who counts as a peer. Used downstream
   * by the criteria gates (high salary, awards, etc.) when framing
   * benchmarking.
   */
  peer_set_description: z.string(),
  specificity: FieldSpecificityEnum,
  confidence: FieldConfidenceEnum,
  /**
   * 1–3 sentences explaining why this label was chosen and why it lands
   * in the chosen specificity bucket.
   */
  reasoning: z.string(),
  /**
   * Verbatim phrases (5–25 words) from the inputs that justify the
   * choice. Mirrors subtype-detect's detection_signals.
   */
  detection_signals: z.array(z.string()),
});

export type FieldOfEndeavorClassification = z.infer<typeof FieldOfEndeavorSchema>;
