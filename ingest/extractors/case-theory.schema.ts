/**
 * EB-1A case-theory synthesizer schema (Tier-3).
 *
 * Runs AFTER per-PDF rich extraction AND field-of-endeavor classification.
 * Produces the one-line "what makes this person extraordinary" framing
 * that anchors every downstream LLM gate (criteria (h)(3)(i)–(x),
 * Kazarian step-2, expert-letter scaffolding, cover-letter draft).
 *
 * Output is NOT a legal conclusion — it is the synthesis attorneys would
 * write at the top of a strategy memo: who the beneficiary is, what they
 * do, why they matter, and what evidence carries the case theory.
 */

import { z } from 'zod';

export const CaseTheoryConfidenceEnum = z.enum(['HIGH', 'MED', 'LOW']);
export type CaseTheoryConfidence = z.infer<typeof CaseTheoryConfidenceEnum>;

export const EvidenceAnchorSchema = z.object({
  /** Document this anchor cites (filename or stable ID). */
  source_id: z.string(),
  /** 1-sentence summary of why this doc supports the case theory. */
  why_it_matters: z.string(),
});
export type EvidenceAnchor = z.infer<typeof EvidenceAnchorSchema>;

export const CaseTheorySchema = z.object({
  /**
   * One sentence, 15–35 words. Pattern: "<Name> is a <role> working on
   * <focus area>, recognized for <distinctive contribution>." Drops the
   * <Name> if the synthesizer cannot anchor it confidently.
   */
  one_line: z.string(),
  /**
   * 2–4 sentences. The specialized-knowledge arc the cover letter will
   * expand: how the beneficiary's career converged on this focus, what
   * makes the work distinctive, and what the field has done with it.
   * Avoids legal conclusions — no "rises to the very top", no
   * "extraordinary ability" framing.
   */
  specialized_knowledge_arc: z.string(),
  /**
   * 2–6 evidence anchors that carry the case theory. Each names a source
   * doc and 1 sentence on why it matters. Empty array allowed when only
   * the CV is available; a HIGH-confidence theory should have ≥3.
   */
  evidence_anchors: z.array(EvidenceAnchorSchema),
  /**
   * HIGH — CV + multiple rec letters + (publications or awards) all
   *        converge on the same arc.
   * MED  — CV + 1–2 corroborating signals; arc is plausible but thin.
   * LOW  — CV-only or signals disagree; attorney must rewrite manually.
   */
  confidence: CaseTheoryConfidenceEnum,
  /**
   * 1–2 sentences. What the synthesizer DID NOT see that would raise
   * confidence (e.g., "no publication titles available"; "no rec letters
   * speak to commercial impact"). Empty string when confidence = HIGH.
   */
  gaps: z.string(),
});

export type CaseTheory = z.infer<typeof CaseTheorySchema>;
