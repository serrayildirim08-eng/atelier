/**
 * Phase-0.7 draft-mode detector schema.
 *
 * The drafter's case-facts contract carries `caseFacts.draft_mode` as an
 * optional DraftMode (see `ingest/schema.ts`). This detector populates it.
 * Default fallback when detection fails: 'initial'.
 */

import { z } from 'zod';
import { DraftModeEnum } from './schema';

export const DraftModeDetectionConfidenceEnum = z.enum(['HIGH', 'MED', 'LOW']);
export type DraftModeDetectionConfidence = z.infer<typeof DraftModeDetectionConfidenceEnum>;

export const DraftModeDetectionSchema = z.object({
  mode: DraftModeEnum,
  confidence: DraftModeDetectionConfidenceEnum,
  /**
   * 1–4 verbatim quotes (5–25 words each) prefixed with [filename] that
   * justify the mode pick. Empty when the heuristic / LLM had no positive
   * signals (only the default-to-'initial' path).
   */
  signals: z.array(z.string()),
  /**
   * 1–2 sentences citing the strongest signals. Surface to the attorney
   * when confidence is below HIGH.
   */
  reasoning: z.string(),
});

export type DraftModeDetection = z.infer<typeof DraftModeDetectionSchema>;
