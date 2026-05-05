/**
 * EB-1A Tier-0 deterministic variant classifier.
 *
 * Consumes the structured manifest at `eb1a-variant-manifest.ts` and
 * matches a single document (filename + first-page text) against the 41
 * EB-1A variants. Output is the highest-scoring variant with provenance
 * for debugging and confidence calibration.
 *
 * Cascade tier: Tier-0 (regex/keyword scoring; zero LLM cost). Mirrors
 * the architecture of `ingest/classify-fallback.ts` for E-2 documents
 * but is a separate corpus because the EB-1A regulatory grammar
 * (criterion mapping, predatory-venue red-flag, comparable-evidence
 * (h)(4) substitution) is orthogonal to the E-2 doc-taxonomy.
 *
 * Wiring: callers should branch on `case_theory.visa_class === 'EB1A'`
 * and route to this classifier in lieu of the E-2 fallback. The output
 * shape (`Eb1aClassification`) is the contract the EB-1A criterion
 * gates and the frontend criteria UI consume.
 */

import {
  EB1A_VARIANT_MANIFEST,
  EB1A_VARIANT_BY_ID,
  type Eb1aDocType,
  type Eb1aVariant,
  type Eb1aVariantId,
  type Hh3Criterion,
} from './eb1a-variant-manifest';

/* ---------------------------------------------------------------------- */
/* Output contract — frontend + criterion-gates consume this.              */
/* ---------------------------------------------------------------------- */

export interface Eb1aClassification {
  /** Coarse doc_type id (one of the 17). Null when nothing scored above 0. */
  doc_type: Eb1aDocType | null;
  /** Specific variant id, e.g., "recommendation_letter:v1". */
  variant_id: Eb1aVariantId | null;
  /**
   * (h)(3) criteria this document maps to per the manifest. Empty when
   * the variant is non-anchor (cv_or_resume) — the cascade flag below
   * is what callers gate on.
   */
  criterion_map: Hh3Criterion[];
  /** Confidence in [0, 1]; mirrors the Tier-0 calibration in classify-fallback. */
  confidence: number;
  /**
   * Whether this variant is a non-anchor (orienting only). When true,
   * the criterion-classifier branch MUST NOT fire. Currently true only
   * for cv_or_resume variants per cross-review P2 #20.
   */
  cv_orienting_only: boolean;
  /** Predatory-venue red-flag (published_paper:v4) or null. */
  hard_flag: 'predatory_venue_redflag' | null;
  /** Top-5 candidates with raw scores for telemetry / human review. */
  candidates: ReadonlyArray<{
    variant_id: Eb1aVariantId;
    doc_type: Eb1aDocType;
    score: number;
    matched: string[];
  }>;
  /** Hits that fired on the winning variant. */
  matched_signals: string[];
}

/* ---------------------------------------------------------------------- */
/* Internal scoring                                                        */
/* ---------------------------------------------------------------------- */

const FILENAME_HIT = 6;
const CONTENT_HIT = 3;
const EXCLUSION_PENALTY = 5;
const COLLISION_BONUS = 2;
const CONFIDENCE_DENOMINATOR = 14;
const CONFIDENCE_FLOOR = 0;
const CONFIDENCE_THRESHOLD_RETURN = 0.45;

interface VariantTrace {
  variant: Eb1aVariant;
  score: number;
  hits: string[];
  hardExcluded: boolean;
}

/** NFD-fold + lowercase so `Özgeçmiş` matches `ozgecmis`. */
function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Word count for the short-endorsement (rec letter v3) heuristic.
 * Counts non-empty whitespace-delimited tokens.
 */
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function scoreVariant(
  variant: Eb1aVariant,
  foldedFilename: string,
  firstPageText: string,
  foldedText: string,
): VariantTrace {
  const hits: string[] = [];
  let score = 0;
  let hardExcluded = false;

  for (const kw of variant.filename_keywords) {
    const folded = fold(kw);
    if (foldedFilename.includes(folded)) {
      score += FILENAME_HIT;
      hits.push(`filename "${kw}"`);
      // Don't break — multi-keyword filenames are common signal-stacks
      // for narrowly-named EB-1A evidence (e.g., "fwci-scival-2024.pdf").
    }
  }

  for (const re of variant.content_signals) {
    if (re.test(firstPageText) || re.test(foldedText)) {
      score += CONTENT_HIT;
      hits.push(`content ~ ${re.source.slice(0, 60)}`);
    }
  }

  for (const re of variant.exclusion_signals) {
    if (re.test(firstPageText) || re.test(foldedText)) {
      score -= EXCLUSION_PENALTY;
      hits.push(`exclude ~ ${re.source.slice(0, 60)}`);
      // Hard exclusion: published_paper Var 1 vs media_article Var 1
      // disambiguation collapses on the references-section presence.
      // For rec_letter v1, the "I supervised" phrase is a hard signal
      // the doc is the dependent variant — exclude entirely so the
      // collision tiebreaker doesn't have to fight the wrong winner.
      if (
        variant.variant_id === 'recommendation_letter:v1' ||
        variant.variant_id === 'media_article:v1' ||
        variant.variant_id === 'conference_invitation:v1' ||
        variant.variant_id === 'editorial_board_notice:v1' ||
        variant.variant_id === 'patent_or_ip_filing:v1' ||
        variant.variant_id === 'patent_or_ip_filing:v2'
      ) {
        hardExcluded = true;
      }
    }
  }

  // Recommendation_letter:v3 gets a structural bonus when the document
  // is short (cross-review § 6 #1: page count = 1, word count < 400).
  if (variant.variant_id === 'recommendation_letter:v3') {
    const wc = wordCount(firstPageText);
    if (wc > 0 && wc < 400) {
      score += 2;
      hits.push(`structural word_count<400 (${wc})`);
    } else if (wc >= 400) {
      // Long letters are NOT blurbs; downweight aggressively.
      score -= 2;
    }
  }

  return { variant, score, hits, hardExcluded };
}

/* ---------------------------------------------------------------------- */
/* Disambiguation tiebreakers — cross-review § 6                            */
/* ---------------------------------------------------------------------- */

/**
 * Apply collision bonuses: when a variant explicitly lists colliders
 * and the would-be runner-up is one of them, nudge the winner up by
 * `COLLISION_BONUS`. Encodes the cross-review § 6 weakness fixes
 * (rec_letter v1↔v2, conf_invite v1↔editorial_board v1, paper v1↔
 * media_article v1) at the score-aggregation layer.
 */
function applyCollisionBonuses(traces: VariantTrace[]): VariantTrace[] {
  if (traces.length < 2) return traces;
  const sorted = [...traces].sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const runnerUp = sorted[1];
  if (!top || !runnerUp) return traces;
  if (
    top.variant.collides_with?.includes(runnerUp.variant.variant_id)
  ) {
    // The winner already lists the runner-up as a known collider —
    // bonus stays put.
    top.score += COLLISION_BONUS;
    top.hits.push(`collision_bonus(${runnerUp.variant.variant_id})`);
  }
  return sorted;
}

/* ---------------------------------------------------------------------- */
/* Public API                                                              */
/* ---------------------------------------------------------------------- */

export interface Eb1aClassifyInput {
  filename: string;
  first_page_text: string;
}

/**
 * Classify a single document against the EB-1A 41-variant manifest.
 * Pure / synchronous / zero-cost — no LLM call, no I/O.
 */
export function classifyEb1aVariant(
  input: Eb1aClassifyInput,
): Eb1aClassification {
  const foldedFilename = fold(input.filename);
  const foldedText = fold(input.first_page_text);

  const traces: VariantTrace[] = [];
  for (const variant of EB1A_VARIANT_MANIFEST) {
    const t = scoreVariant(
      variant,
      foldedFilename,
      input.first_page_text,
      foldedText,
    );
    if (t.hardExcluded) continue;
    if (t.score > 0) traces.push(t);
  }

  const sorted = applyCollisionBonuses(traces);
  const top = sorted[0];

  if (!top) {
    return {
      doc_type: null,
      variant_id: null,
      criterion_map: [],
      confidence: 0,
      cv_orienting_only: false,
      hard_flag: null,
      candidates: [],
      matched_signals: [],
    };
  }

  const second = sorted[1];
  const baseConfidence = Math.min(1, top.score / CONFIDENCE_DENOMINATOR);
  const margin = second
    ? Math.max(0, top.score - second.score) / Math.max(1, top.score)
    : 1;
  const confidence = Math.max(
    CONFIDENCE_FLOOR,
    baseConfidence * (0.5 + 0.5 * margin),
  );

  const winner = top.variant;
  const surfaceVariant = confidence >= CONFIDENCE_THRESHOLD_RETURN;

  return {
    doc_type: surfaceVariant ? winner.doc_type : null,
    variant_id: surfaceVariant ? winner.variant_id : null,
    criterion_map: surfaceVariant ? [...winner.criterion_map] : [],
    confidence,
    cv_orienting_only:
      surfaceVariant && winner.cascade_flag === 'non_anchor',
    hard_flag:
      surfaceVariant && winner.hard_flag === 'predatory_venue_redflag'
        ? 'predatory_venue_redflag'
        : null,
    candidates: sorted.slice(0, 5).map((t) => ({
      variant_id: t.variant.variant_id,
      doc_type: t.variant.doc_type,
      score: t.score,
      matched: t.hits.slice(0, 4),
    })),
    matched_signals: top.hits,
  };
}

/**
 * Convenience: expose manifest version for cache invalidation. Callers
 * that cache classifications across runs should key on this.
 */
export { EB1A_VARIANT_MANIFEST_VERSION } from './eb1a-variant-manifest';

/**
 * Re-export the lookup table so consumers (criterion gates, frontend)
 * can resolve a variant_id back to its full record without re-importing
 * the manifest.
 */
export { EB1A_VARIANT_BY_ID, HH3_CRITERION_LABELS } from './eb1a-variant-manifest';
export type {
  Eb1aDocType,
  Eb1aVariantId,
  Eb1aVariant,
  Hh3Criterion,
} from './eb1a-variant-manifest';
