/**
 * Tier-0 deterministic doc-type classifier.
 *
 * Runs FIRST in the classification cascade — before any LLM call. Matches the
 * input PDF (filename + first-page text) against doc-taxonomy identifying
 * signals using regex and keyword scoring. If the top score is high enough,
 * the LLM extraction step can be skipped or directed to a known extractor.
 *
 * Cascade levels (target cost per PDF):
 *   Tier 0 — this file              ~$0   regex + keyword scoring
 *   Tier 1 — local embeddings       ~$0   nearest-neighbor in tiny corpus
 *   Tier 2 — Haiku batch             $    one shared cached prompt for batches
 *   Tier 3 — Sonnet (single)         $$   only on truly ambiguous outliers
 *
 * Tier 0's job is to handle the >70% of PDFs that arrive with informative
 * filenames or unmistakable header text (passport, tapu, MT103, I-129 …).
 *
 * Output shape is intentionally simple — it composes upstream of the existing
 * typed-extract.ts pipeline.
 */

import { ALL_DOC_TYPES } from '@/lib/e2/doc-taxonomy';
import type { DocType } from '@/lib/e2/types';

export interface FallbackClassification {
  doc_type_id: string | null;
  confidence: number; // 0..1
  matched_signals: string[]; // human-readable hints for UI / debugging
  candidates: { doc_type_id: string; score: number }[]; // top 5 with raw scores
}

const FILENAME_HIT = 6;
const KEYWORD_HIT = 3;
const HEADER_HIT = 5;
const PDF_FORM_FIELD_HIT = 8;
const STRUCTURAL_HIT = 1;

const TIER0_CONFIDENCE_THRESHOLD = 0.6;

interface MatchTrace {
  doc_type_id: string;
  score: number;
  hits: string[];
}

function scoreOne(filename: string, firstPageText: string, formFieldNames: string[], dt: DocType): MatchTrace {
  const hits: string[] = [];
  let score = 0;

  const lowerFilename = filename.toLowerCase();
  const lowerText = firstPageText.toLowerCase();

  // Filename regex
  for (const re of dt.identifying_signals.filename_regex ?? []) {
    if (re.test(lowerFilename)) {
      score += FILENAME_HIT;
      hits.push(`filename ~ ${re.source}`);
      break; // count filename signal once
    }
  }

  // First-page header regex
  for (const re of dt.identifying_signals.header_regex ?? []) {
    if (re.test(firstPageText)) {
      score += HEADER_HIT;
      hits.push(`header ~ ${re.source}`);
    }
  }

  // Keyword phrases
  for (const phrase of dt.identifying_signals.keyword_phrases ?? []) {
    if (lowerText.includes(phrase.toLowerCase())) {
      score += KEYWORD_HIT;
      hits.push(`keyword "${phrase}"`);
    }
  }

  // PDF form field hints (highest signal — fillable forms are unambiguous)
  for (const field of dt.identifying_signals.pdf_form_field_hints ?? []) {
    if (formFieldNames.some((f) => f.toLowerCase().includes(field.toLowerCase()))) {
      score += PDF_FORM_FIELD_HIT;
      hits.push(`form field "${field}"`);
    }
  }

  // Structural hints reserved — currently no auto-detection. STRUCTURAL_HIT
  // is unused on purpose; left as a constant so the scoring weights stay in
  // one place when structural detection lands.
  void STRUCTURAL_HIT;

  return { doc_type_id: dt.id, score, hits };
}

export interface FallbackInput {
  filename: string;
  first_page_text: string;
  pdf_form_field_names?: string[];
}

export function classifyByTier0(input: FallbackInput): FallbackClassification {
  const traces: MatchTrace[] = ALL_DOC_TYPES.map((dt) =>
    scoreOne(input.filename, input.first_page_text, input.pdf_form_field_names ?? [], dt),
  ).filter((t) => t.score > 0);

  traces.sort((a, b) => b.score - a.score);

  const top = traces[0];
  const second = traces[1];
  if (!top) {
    return { doc_type_id: null, confidence: 0, matched_signals: [], candidates: [] };
  }

  // Confidence: top score scaled by margin over runner-up.
  // Saturating model: score 12+ = 1.0, with margin penalty if runner-up is close.
  const baseConfidence = Math.min(1, top.score / 12);
  const margin = second ? Math.max(0, top.score - second.score) / Math.max(1, top.score) : 1;
  const confidence = baseConfidence * (0.5 + 0.5 * margin);

  return {
    doc_type_id: confidence >= TIER0_CONFIDENCE_THRESHOLD ? top.doc_type_id : null,
    confidence,
    matched_signals: top.hits,
    candidates: traces.slice(0, 5).map((t) => ({ doc_type_id: t.doc_type_id, score: t.score })),
  };
}

/** Convenience: returns just the doc-type id if Tier-0 is confident, else null. */
export function tier0Hint(input: FallbackInput): string | null {
  return classifyByTier0(input).doc_type_id;
}
