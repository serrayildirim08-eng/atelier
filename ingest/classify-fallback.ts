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

import { ALL_DOC_TYPES, DOC_TYPES_BY_ID } from '@/lib/e2/doc-taxonomy';
import type { DocCategory } from '@/lib/e2/types';

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

/**
 * Strip Unicode diacritics so accented filenames/text match plain-ASCII
 * regexes (`/diplom/i` matches "Diplôme", `/identite/i` matches
 * "Identité"). Matters for French / German / Turkish evidence — the
 * existing taxonomy regexes are mostly ASCII-fold, and without this we
 * miss every accented variant.
 */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Precomputed scoring data per doc-type. Built once at module init from
 * `ALL_DOC_TYPES`. Keyword phrases are pre-folded and form-field hints
 * pre-lowercased so the per-classification hot path skips re-folding
 * 1700+ static strings on every call.
 */
interface PrecomputedDocType {
  id: string;
  filenameRegexes: readonly RegExp[];
  headerRegexes: readonly RegExp[];
  keywords: readonly { phrase: string; folded: string }[];
  formFieldHints: readonly { hint: string; lower: string }[];
}

const PRECOMPUTED: readonly PrecomputedDocType[] = ALL_DOC_TYPES.map((dt) => ({
  id: dt.id,
  filenameRegexes: dt.identifying_signals.filename_regex ?? [],
  headerRegexes: dt.identifying_signals.header_regex ?? [],
  keywords: (dt.identifying_signals.keyword_phrases ?? []).map((phrase) => ({
    phrase,
    folded: fold(phrase),
  })),
  formFieldHints: (dt.identifying_signals.pdf_form_field_hints ?? []).map((hint) => ({
    hint,
    lower: hint.toLowerCase(),
  })),
}));

function scoreOne(
  foldedFilename: string,
  firstPageText: string,
  foldedText: string,
  lowerFormFieldNames: readonly string[],
  dt: PrecomputedDocType,
): MatchTrace {
  const hits: string[] = [];
  let score = 0;

  for (const re of dt.filenameRegexes) {
    if (re.test(foldedFilename)) {
      score += FILENAME_HIT;
      hits.push(`filename ~ ${re.source}`);
      break; // count filename signal once
    }
  }

  for (const re of dt.headerRegexes) {
    if (re.test(firstPageText) || re.test(foldedText)) {
      score += HEADER_HIT;
      hits.push(`header ~ ${re.source}`);
    }
  }

  for (const k of dt.keywords) {
    if (foldedText.includes(k.folded)) {
      score += KEYWORD_HIT;
      hits.push(`keyword "${k.phrase}"`);
    }
  }

  for (const f of dt.formFieldHints) {
    if (lowerFormFieldNames.some((name) => name.includes(f.lower))) {
      score += PDF_FORM_FIELD_HIT;
      hits.push(`form field "${f.hint}"`);
    }
  }

  // STRUCTURAL_HIT reserved for future structural-hint detection.
  void STRUCTURAL_HIT;

  return { doc_type_id: dt.id, score, hits };
}

export interface FallbackInput {
  filename: string;
  first_page_text: string;
  pdf_form_field_names?: string[];
}

export function classifyByTier0(input: FallbackInput): FallbackClassification {
  const foldedFilename = fold(input.filename);
  const foldedText = fold(input.first_page_text);
  const lowerFormFieldNames = (input.pdf_form_field_names ?? []).map((f) =>
    f.toLowerCase(),
  );

  const traces: MatchTrace[] = [];
  for (const dt of PRECOMPUTED) {
    const t = scoreOne(
      foldedFilename,
      input.first_page_text,
      foldedText,
      lowerFormFieldNames,
      dt,
    );
    if (t.score > 0) traces.push(t);
  }

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

/**
 * Default coarse-bucket per fine-grained DocCategory. Covers the categories
 * that map 1:1 to a single coarse bucket. Categories that fan out to multiple
 * coarse buckets (identity → passport/status_doc/i94/government_id;
 * real_estate → title_deed/lease_or_property; employment_evidence →
 * employer_letter/payroll_doc; credentials → credential/cv_or_resume/expert_letter;
 * crypto_evidence → money_movement/source_of_funds) are handled in COARSE_BY_ID
 * below. Anything not in either table returns null and the caller falls back
 * to 'other'.
 */
const COARSE_BY_CATEGORY: Partial<
  Record<DocCategory, import('./typed-memory').DocType>
> = {
  uscis_form: 'uscis_or_dos_form',
  dos_form: 'uscis_or_dos_form',
  vital_record: 'vital_record',
  corporate_formation: 'formation_doc',
  corporate_governance: 'ownership_evidence',
  ownership_transfer: 'ownership_evidence',
  foreign_corporate_registry: 'formation_doc',
  tax_return: 'tax_doc',
  tax_registration: 'tax_doc',
  financial_statement: 'financial_statement',
  bank_statement: 'bank_statement',
  wire_or_receipt: 'money_movement',
  currency_conversion: 'money_movement',
  business_contract: 'business_contract',
  business_plan: 'business_plan',
  payroll: 'payroll_doc',
  invoice_or_receipt: 'invoice_or_receipt',
  sof_origin_evidence: 'source_of_funds',
  translation: 'translation_certification',
  insurance: 'business_contract',
  credentials: 'credential',
  permits_licenses: 'credential',
  merchant_processing: 'formation_doc',
  attorney_work_product: 'cover_letter',
};

/**
 * Per-id overrides. Required only where the category-default is wrong for a
 * specific doc-type — e.g. `cbi_certificate` lives in the `identity` category
 * but the firm files it as a `credential`. Keep this list as small as possible;
 * adding a new doc-type should normally not require a new entry here.
 */
const COARSE_BY_ID: Record<string, import('./typed-memory').DocType> = {
  // identity → fan-out across passport / status_doc / i94 / government_id /
  // vital_record / credential.
  passport_bio: 'passport',
  passport_full: 'passport',
  donor_passport: 'passport',
  visa_stamp: 'status_doc',
  ead: 'status_doc',
  prior_approval_notice: 'status_doc',
  cbp_admission_stamp: 'status_doc',
  i94: 'i94',
  i94_paper_card: 'i94',
  naturalization_certificate: 'vital_record',
  cbi_certificate: 'credential',
  national_id_card: 'government_id',
  drivers_license: 'government_id',
  residency_immigrant_id: 'government_id',

  // real_estate → title_deed vs lease_or_property
  title_deed_us: 'title_deed',
  tapu_senedi: 'title_deed',
  property_encumbrance_extract: 'title_deed',
  lease_commercial: 'lease_or_property',
  lease_residential: 'lease_or_property',
  real_estate_purchase_closing: 'lease_or_property',

  // employment_evidence → employer_letter vs payroll_doc
  offer_letter: 'employer_letter',
  employment_record_us: 'employer_letter',
  employment_record_treaty_country: 'employer_letter',
  salary_payslip_treaty_country: 'payroll_doc',

  // credentials → cv_or_resume / employer_letter / expert_letter
  cv: 'cv_or_resume',
  cv_academic: 'cv_or_resume',
  service_record: 'employer_letter',
  recommendation_letter: 'expert_letter',
  expert_letter_industry: 'expert_letter',
  expert_letter_technical: 'expert_letter',

  // financial_statement → expert_letter (CPA letter is third-party advisory)
  cpa_letter: 'expert_letter',

  // crypto_evidence → money_movement vs source_of_funds
  crypto_blockchain_txid: 'money_movement',
  crypto_trade_ledger: 'source_of_funds',
  crypto_liquidation_record: 'source_of_funds',

  // amigos_domicile → tax_doc (treaty-country tax cert)
  amigos_treaty_country_tax_cert: 'tax_doc',

  // attorney_work_product internal memo → other (not filed)
  internal_memo_worksheet: 'other',

  // FDD items have category 'industry_evidence' but functionally belong with
  // the franchise contract bundle the firm files them with.
  fdd_item7: 'business_contract',
  fdd_item19: 'business_contract',

  // membership_certificate has category 'corporate_formation' but the firm
  // treats it as direct ownership evidence (Tab D ownership-percent proof).
  membership_certificate: 'ownership_evidence',

  // other → other (catch-all)
  unclassified_other: 'other',
};

/**
 * Map fine-grained doc-taxonomy ids (e.g., `passport_bio`, `diploma`,
 * `tapu_senedi`) to the coarse `DocType` enum used by the typed-memory
 * pipeline. Resolution order: per-id override → category default → null.
 *
 * Returns `null` for ids that legitimately have no coarse mapping
 * (industry-evidence stat reports, organizational charts, raw photos);
 * the caller should fall back to `'other'` in that case.
 */
export function coarseFromFineDocTypeId(
  id: string | null | undefined,
): import('./typed-memory').DocType | null {
  if (!id) return null;
  const override = COARSE_BY_ID[id];
  if (override) return override;
  const dt = DOC_TYPES_BY_ID[id];
  if (!dt) return null;
  return COARSE_BY_CATEGORY[dt.category] ?? null;
}
