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

function scoreOne(filename: string, firstPageText: string, formFieldNames: string[], dt: DocType): MatchTrace {
  const hits: string[] = [];
  let score = 0;

  const foldedFilename = fold(filename);
  const foldedText = fold(firstPageText);

  // Filename regex — tested against accent-folded form so accented
  // filenames hit the same patterns as their ASCII equivalents.
  for (const re of dt.identifying_signals.filename_regex ?? []) {
    if (re.test(foldedFilename)) {
      score += FILENAME_HIT;
      hits.push(`filename ~ ${re.source}`);
      break; // count filename signal once
    }
  }

  // First-page header regex
  for (const re of dt.identifying_signals.header_regex ?? []) {
    if (re.test(firstPageText) || re.test(foldedText)) {
      score += HEADER_HIT;
      hits.push(`header ~ ${re.source}`);
    }
  }

  // Keyword phrases (folded substring match)
  for (const phrase of dt.identifying_signals.keyword_phrases ?? []) {
    if (foldedText.includes(fold(phrase))) {
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

/**
 * Map fine-grained doc-taxonomy ids (e.g., `passport_bio`, `diploma`,
 * `tapu_senedi`) to the coarse `DocType` enum used by the typed-memory
 * pipeline. Used by the image-classification path (no first-page text →
 * filename signals only) to take a Tier-0 hit and route the document
 * into the right per-DocType bucket.
 *
 * Returns `null` for ids that legitimately have no coarse mapping
 * (industry-evidence stat reports, organizational charts, raw photos);
 * the caller should fall back to `'other'` in that case.
 */
export function coarseFromFineDocTypeId(
  id: string | null | undefined,
): import('./typed-memory').DocType | null {
  if (!id) return null;
  const map: Record<string, import('./typed-memory').DocType> = {
    // Identity
    passport_bio: 'passport',
    passport_full: 'passport',
    donor_passport: 'passport',
    visa_stamp: 'status_doc',
    ead: 'status_doc',
    prior_approval_notice: 'status_doc',
    i94: 'i94',
    naturalization_certificate: 'vital_record',
    birth_certificate: 'vital_record',
    marriage_certificate: 'vital_record',
    adoption_decree: 'vital_record',
    nufus_kayit_ornegi: 'vital_record',
    // USCIS / DOS / consular forms
    i129: 'uscis_or_dos_form',
    i129_e_supplement: 'uscis_or_dos_form',
    i539: 'uscis_or_dos_form',
    i539a: 'uscis_or_dos_form',
    ds156e: 'uscis_or_dos_form',
    ds160_confirmation: 'uscis_or_dos_form',
    g28: 'uscis_or_dos_form',
    g1145: 'uscis_or_dos_form',
    g1650: 'uscis_or_dos_form',
    mita: 'uscis_or_dos_form',
    cover_letter: 'cover_letter',
    // Money / banking
    bank_statement_personal: 'bank_statement',
    bank_statement_business: 'bank_statement',
    bank_receipt: 'money_movement',
    cancelled_check: 'money_movement',
    fx_conversion_receipt: 'money_movement',
    wire_confirmation: 'money_movement',
    wire_swift_mt103: 'money_movement',
    crypto_blockchain_txid: 'money_movement',
    // Source of funds
    gift_letter: 'source_of_funds',
    inheritance_estate_accounting: 'source_of_funds',
    loan_agreement: 'source_of_funds',
    crypto_liquidation_record: 'source_of_funds',
    crypto_trade_ledger: 'source_of_funds',
    // Tax
    tax_return_1040: 'tax_doc',
    tax_return_1065: 'tax_doc',
    tax_return_1120: 'tax_doc',
    tax_return_1120s: 'tax_doc',
    tax_return_foreign: 'tax_doc',
    tax_return_schedule_c: 'tax_doc',
    vergi_levhasi: 'tax_doc',
    w2: 'tax_doc',
    amigos_treaty_country_tax_cert: 'tax_doc',
    // Formation / corporate
    articles_of_incorporation: 'formation_doc',
    articles_of_organization: 'formation_doc',
    bylaws: 'formation_doc',
    operating_agreement: 'formation_doc',
    member_resolution: 'formation_doc',
    board_minutes: 'formation_doc',
    ein_cp575: 'formation_doc',
    ss4_form: 'formation_doc',
    employer_registration: 'formation_doc',
    certificate_of_good_standing: 'formation_doc',
    merchant_processing_approval: 'formation_doc',
    foreign_corporate_registry_companies_house: 'formation_doc',
    foreign_corporate_registry_handelsregister: 'formation_doc',
    foreign_corporate_registry_kbis: 'formation_doc',
    foreign_corporate_registry_other: 'formation_doc',
    foreign_corporate_registry_ticaret_sicil_gazetesi: 'formation_doc',
    foreign_corporate_registry_visura: 'formation_doc',
    // Ownership
    cap_table: 'ownership_evidence',
    stock_subscription: 'ownership_evidence',
    membership_certificate: 'ownership_evidence',
    // Real estate / lease
    title_deed_us: 'title_deed',
    tapu_senedi: 'title_deed',
    lease_commercial: 'lease_or_property',
    lease_residential: 'lease_or_property',
    // Contracts / business
    customer_contract: 'business_contract',
    supplier_contract: 'business_contract',
    vendor_contract: 'business_contract',
    franchise_agreement: 'business_contract',
    sale_contract: 'business_contract',
    bill_of_sale: 'business_contract',
    collateral_schedule: 'business_contract',
    payroll_provider_contract: 'business_contract',
    insurance_general_liability: 'business_contract',
    insurance_workers_comp: 'business_contract',
    fdd: 'business_contract',
    fdd_item7: 'business_contract',
    fdd_item19: 'business_contract',
    // Invoices / receipts
    paid_invoice: 'invoice_or_receipt',
    vendor_invoice: 'invoice_or_receipt',
    delivery_receipt: 'invoice_or_receipt',
    equipment_po: 'invoice_or_receipt',
    // Payroll
    payroll_register: 'payroll_doc',
    salary_payslip_treaty_country: 'payroll_doc',
    // Financial
    audited_financial_statement: 'financial_statement',
    balance_sheet: 'financial_statement',
    profit_loss_statement: 'financial_statement',
    business_profit_distribution: 'financial_statement',
    investment_portfolio_statement: 'financial_statement',
    // Credentials / licenses
    diploma: 'credential',
    professional_license: 'credential',
    professional_business_license: 'credential',
    state_business_license: 'credential',
    contractor_license: 'credential',
    sales_tax_permit: 'credential',
    food_permit: 'credential',
    health_department_permit: 'credential',
    liquor_license: 'credential',
    cbi_certificate: 'credential',
    training_certificate: 'credential',
    // Letters
    recommendation_letter: 'expert_letter',
    cpa_letter: 'expert_letter',
    employment_record_treaty_country: 'employer_letter',
    employment_record_us: 'employer_letter',
    service_record: 'employer_letter',
    offer_letter: 'employer_letter',
    // CV / resume
    cv: 'cv_or_resume',
    // Translation
    certified_translation: 'translation_certification',
    // Business plan
    business_plan_5yr: 'business_plan',
  };
  return map[id] ?? null;
}
