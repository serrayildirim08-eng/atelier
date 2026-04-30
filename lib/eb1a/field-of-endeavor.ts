/**
 * Field-of-endeavor classifier — Tier 3.
 *
 * Goldilocks rule (spec discussion 2026-04-30):
 *   too_broad   — peer comparison meaningless ("computer science",
 *                 "medicine", "engineering")
 *   goldilocks  — specific enough that "others in the field" is well-
 *                 defined, broad enough that a peer set actually exists
 *                 ("applied machine learning for medical imaging",
 *                 "medium-voltage switchgear engineering")
 *   too_narrow  — no defined peer set ("React 19 server-component memory
 *                 profiling on Vercel Edge")
 *
 * Inputs (in priority order):
 *   - CV current title + last 2 titles + role descriptions
 *   - Diploma fields (especially terminal degree)
 *   - Recent publications (titles only — abstracts not needed at this
 *     pass; the criteria-(vi) gate digs deeper)
 *   - Award narratives (titles + citation text from award letters)
 *   - Recommendation-letter framing (how writers describe the
 *     beneficiary's domain)
 *
 * Output: EB1AFieldClassification block. The label is ALWAYS manually
 * editable downstream; manual_override_used flips when the operator
 * replaces the auto label.
 *
 * Why this is a separate pass and not part of the main aggregator:
 * the Goldilocks call is judgmental and specificity-graded. Mixing it
 * into the giant E-2-style aggregator pollutes the prompt and degrades
 * quality. Keep it isolated, cheap (Haiku 4.5, single small call with
 * few-shot Goldilocks examples), and manually overridable. Upgrade to
 * Sonnet only if Haiku underperforms on the specificity judgment.
 */

/**
 * Public re-export of the Haiku 4.5 classifier so app/ code can import
 * the field-of-endeavor classification entry point from `@/lib/eb1a`
 * without reaching into the ingest/extractors path.
 */
export {
  classifyFieldOfEndeavor,
  type FieldOfEndeavorInput as FieldClassificationInput,
} from '@/ingest/extractors/field-of-endeavor';
