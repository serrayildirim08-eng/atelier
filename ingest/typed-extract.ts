/**
 * Per-PDF classifier + extractor.
 *
 * One Haiku 4.5 call per PDF: classify into a doc_type AND extract the
 * type-specific micro-schema. Output is a discriminated-union PerPdfFacts.
 *
 * The per-PDF call is intentionally cheap and fast (Haiku, small context,
 * minimal output). The aggregator (Sonnet) does the cross-document
 * reasoning afterward, reading the typed memory in bulk.
 *
 * Concurrency is gated by runWithConcurrency to keep us under Anthropic's
 * input-tokens-per-minute rate limit. Default concurrency = 5; tune via
 * TYPED_EXTRACT_CONCURRENCY env var if your tier allows more.
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import { pdfContentHash, readPdfCache, writePdfCache } from '@/lib/pdf-cache';
import { sampleLongText } from '@/lib/token-count';
import { extractPdfText } from './pdf';
import {
  PerPdfFactsSchema,
  type DocType,
  type PerPdfFacts,
  type PerPdfResult,
} from './typed-memory';
import { extractContract } from './extractors/contract';
import { extractBankReceipt } from './extractors/bank-receipt';
import { extractWireConfirmation } from './extractors/wire-confirmation';
import { extractGovernmentDoc } from './extractors/government-doc';
import { extractPassport } from './extractors/passport';
import { extractI94 } from './extractors/i94';
import { extractVisaStamp } from './extractors/visa-stamp';
import { extractVitalRecords } from './extractors/vital-records';
import { extractPayroll } from './extractors/payroll';
import { extractTaxReturn } from './extractors/tax-return';
import { extractFinancialStatement } from './extractors/financial-statement';
import { extractJobOffer } from './extractors/job-offer';
import { extractServiceRecord } from './extractors/service-record';
import { extractCv } from './extractors/cv';
import { extractCredential } from './extractors/credential';
import { extractRecommendationLetter } from './extractors/recommendation-letter';
import { extractCorporateFormation } from './extractors/corporate-formation';
import { extractForeignCorporate } from './extractors/foreign-corporate';
import { extractImagePhoto } from './extractors/image-photo';
import { extractCustomerContract } from './extractors/customer-contract';
import { extractRealEstatePurchase } from './extractors/real-estate-purchase';
import { extractIncentiveDocument } from './extractors/incentive-document';

/**
 * Doc types that route through the rich contract extractor as a second
 * pass. The first-pass classifier returns one of the thin doc_types; if
 * it's contract-flavored, we run extractContract() to enrich the result
 * with the 6-variant contract_subtype-discriminated schema.
 */
const CONTRACT_FLAVORED_DOC_TYPES: ReadonlySet<DocType> = new Set<DocType>([
  'business_contract',
  'lease_or_property',
  'ownership_evidence',
  'formation_doc',
]);

/**
 * Doc types that route through the rich bank-receipt extractor (manual
 * §5.1.3 multi-installment, §5.1.6 recurring rental, §5.2.1 FX receipts).
 */
const BANK_RECEIPT_FLAVORED_DOC_TYPES: ReadonlySet<DocType> = new Set<DocType>([
  'money_movement',
  'source_of_funds',
]);

/**
 * Doc types that route through the rich wire-confirmation extractor
 * (manual §5.2.1 / §5.2.2 / §5.2.3 + Subtype-4 corporate funding).
 */
const WIRE_CONFIRMATION_FLAVORED_DOC_TYPES: ReadonlySet<DocType> =
  new Set<DocType>(['money_movement']);

/**
 * Doc types that route through the rich government-doc extractor (manual
 * §5.1.1 / §5.1.2 title deeds, §12.3 / §12.4 vital records, court orders).
 * source_of_funds carries title deeds in the Akalan structure; vital
 * records and court orders typically land in `other` since the thin
 * taxonomy has no slot for them.
 */
const GOVERNMENT_DOC_FLAVORED_DOC_TYPES: ReadonlySet<DocType> =
  new Set<DocType>(['source_of_funds', 'other']);

/**
 * Doc types that route through the rich passport extractor (manual §3.1).
 */
const PASSPORT_FLAVORED_DOC_TYPES: ReadonlySet<DocType> = new Set<DocType>([
  'passport',
]);

/**
 * Doc types that route through the rich I-94 extractor (manual §3.4).
 * The thin classifier lumps I-94, visa stamps, I-797 under status_doc;
 * the I-94 extractor itself filters down to actual I-94 records.
 */
const I94_FLAVORED_DOC_TYPES: ReadonlySet<DocType> = new Set<DocType>([
  'status_doc',
]);

/**
 * Doc types that route through the rich visa-stamp / I-797 extractor
 * (manual §3.2). Status_doc is necessary but not sufficient — the router
 * also checks the filename hint (visa | stamp | i-797) to disambiguate
 * from plain I-94 records. The thin classifier puts all three under
 * status_doc, so a filename hint is the cheapest disambiguation.
 */
const VISA_STAMP_FLAVORED_DOC_TYPES: ReadonlySet<DocType> = new Set<DocType>([
  'status_doc',
]);

/** Filename pattern that signals a visa stamp / I-797 within status_doc. */
const VISA_STAMP_FILENAME_RE = /(visa|stamp|i-?797)/i;

/**
 * Doc types that route through the rich vital-records extractor (manual
 * §12.3 / §12.4). Vital records typically land in `other` (no thin
 * doc_type slot), occasionally in source_of_funds. Coexists with the
 * government-doc extractor — both may fire on the same PDF.
 */
const VITAL_RECORDS_FLAVORED_DOC_TYPES: ReadonlySet<DocType> =
  new Set<DocType>(['source_of_funds', 'other']);

/**
 * Doc types that route through the rich payroll extractor (manual §9
 * marginality / 9 FAM 402.9-6(D)). The thin classifier has a dedicated
 * payroll_doc slot.
 */
const PAYROLL_FLAVORED_DOC_TYPES: ReadonlySet<DocType> = new Set<DocType>([
  'payroll_doc',
]);

/**
 * Doc types that route through the rich tax-return extractor (manual §9
 * + investment-vs-balance-sheet gate). The thin classifier uses tax_doc
 * for both tax returns and W-2s; the rich extractor itself disambiguates
 * via tax_return_subtype.
 */
const TAX_RETURN_FLAVORED_DOC_TYPES: ReadonlySet<DocType> = new Set<DocType>([
  'tax_doc',
]);

/**
 * Doc types that route through the rich financial-statement extractor
 * (manual §9 + P&L-vs-tax-return net-income gate). financial_statement
 * is the canonical slot; business_plan often bundles statements as
 * exhibits, so it routes here too.
 */
const FINANCIAL_STATEMENT_FLAVORED_DOC_TYPES: ReadonlySet<DocType> =
  new Set<DocType>(['financial_statement', 'business_plan']);

/* ---------------------------------------------------------------------- */
/* Subtype-4 employee extractors (manual MANUAL-SUBTYPE-4 §3.3 / §3.7)     */
/* ---------------------------------------------------------------------- */

/**
 * Job-offer letters route on doc_type='cover_letter' AND a filename
 * hint — the thin classifier puts both attorney cover letters and
 * Petitioner offer letters in the cover_letter bucket.
 */
const JOB_OFFER_FLAVORED_DOC_TYPES: ReadonlySet<DocType> = new Set<DocType>([
  'cover_letter',
]);
const JOB_OFFER_FILENAME_RE = /(job[-_\s]?offer|offer[-_\s]?letter)/i;

/**
 * Service records (foreign government / former-employer employment
 * records). The thin taxonomy has no slot for these — they land in
 * `other`. Filename hint disambiguates from generic "other" PDFs.
 */
const SERVICE_RECORD_FLAVORED_DOC_TYPES: ReadonlySet<DocType> =
  new Set<DocType>(['other']);
const SERVICE_RECORD_FILENAME_RE =
  /(service[-_\s]?record|sicil|hizmet|employment[-_\s]?cert)/i;

/**
 * CVs / résumés. The thin classifier has no cv_or_resume slot — fall
 * through on filename. The router still includes 'other' so a CV that
 * Haiku categorized into the catch-all gets re-extracted.
 */
const CV_FLAVORED_DOC_TYPES: ReadonlySet<DocType> = new Set<DocType>(['other']);
const CV_FILENAME_RE = /(\bcv\b|resume|özgeçmiş|ozgecmis|curriculum)/i;

/**
 * Credentials (diplomas, certifications, licenses, transcripts). Same
 * routing pattern as CVs — `other` plus a filename hint.
 */
const CREDENTIAL_FLAVORED_DOC_TYPES: ReadonlySet<DocType> = new Set<DocType>([
  'other',
]);
const CREDENTIAL_FILENAME_RE =
  /(diploma|certificate|license|transcript|sertifika|lisans|belge)/i;

/**
 * Recommendation / reference letters. Land in `other` since the thin
 * taxonomy lumps them outside cover_letter (which is the firm's
 * attorney letter to USCIS, not a third-party endorsement).
 */
const RECOMMENDATION_LETTER_FLAVORED_DOC_TYPES: ReadonlySet<DocType> =
  new Set<DocType>(['other']);
const RECOMMENDATION_LETTER_FILENAME_RE =
  /(recommendation|reference|letter[-_\s]?of[-_\s]?rec|tavsiye)/i;

/* ---------------------------------------------------------------------- */
/* Batch 5 — Corporate / Foreign / Image extractors                        */
/* ---------------------------------------------------------------------- */

/**
 * Corporate formation documents (Articles, EIN, Good Standing, state
 * registrations, OA amendments). Domestic-jurisdiction formation only —
 * foreign-corporate Articles route through the foreign-corporate
 * extractor below.
 */
const CORPORATE_FORMATION_FLAVORED_DOC_TYPES: ReadonlySet<DocType> =
  new Set<DocType>(['formation_doc']);

/**
 * Foreign-jurisdiction corporate documents (Esas Sözleşme, board
 * resolutions, shareholder registers, audited financials, tax
 * certificates). Lands in ownership_evidence / financial_statement /
 * other in the thin taxonomy; the filename hint disambiguates from
 * domestic counterparts.
 */
const FOREIGN_CORPORATE_FLAVORED_DOC_TYPES: ReadonlySet<DocType> =
  new Set<DocType>(['ownership_evidence', 'financial_statement', 'other']);
const FOREIGN_CORPORATE_FILENAME_RE =
  /(foreign[-_\s]?articles|board[-_\s]?resolution|shareholder[-_\s]?register|audit|esas[-_\s]?sözleşme|ana[-_\s]?sözleşme|yönetim[-_\s]?kurulu|denetim)/i;

/**
 * Image-bearing PDF pages (signature pages, apostille stamps, consular
 * seals, passport photos, other). Routes when the PDF is a pure scan
 * (looksLikeScan=true) OR the filename hints at an image artifact. The
 * router handles both signals; the filename pattern below is one of two
 * triggers checked at fan-out time.
 */
const IMAGE_PHOTO_FILENAME_RE =
  /(photo|signature|stamp|apostille|seal|imza|fotoğraf|fotograf|mühür|muhur)/i;

/* ---------------------------------------------------------------------- */
/* Batch 6 — customer-commitment / real-estate / incentive extractors      */
/* ---------------------------------------------------------------------- */

/**
 * Customer-commitment commercial contracts (offtake / supply / MSA /
 * distribution / long-term agreement). Routes when the thin classifier
 * returns business_contract AND the filename or content references the
 * customer-commitment pattern (manual MANUAL-SUBTYPE-4 §3.8.2).
 */
const CUSTOMER_CONTRACT_FLAVORED_DOC_TYPES: ReadonlySet<DocType> =
  new Set<DocType>(['business_contract']);
const CUSTOMER_CONTRACT_PATTERN_RE =
  /(offtake|supply|distribution|MSA|master[-_\s]?services[-_\s]?agreement|long[-_\s]?term[-_\s]?agreement)/i;

/**
 * Real-estate purchase agreements / deeds. Routes when the thin
 * classifier returns lease_or_property AND the content references
 * purchase / sale / conveyance / closing language (manual
 * MANUAL-SUBTYPE-4 §3.8.5).
 */
const REAL_ESTATE_PURCHASE_FLAVORED_DOC_TYPES: ReadonlySet<DocType> =
  new Set<DocType>(['lease_or_property']);
const REAL_ESTATE_PURCHASE_PATTERN_RE =
  /(purchase[-_\s]?agreement|purchase[-_\s]?and[-_\s]?sale|conveyance|warranty[-_\s]?deed|quitclaim|grant[-_\s]?deed|special[-_\s]?warranty|closing[-_\s]?date|title[-_\s]?insurance|grantor|grantee|recorded[-_\s]?deed)/i;

/**
 * Government-incentive documents (PTC, IRA, state credits, federal
 * grants, tax exemptions). Routes when the thin classifier returns
 * business_contract AND the content references incentives / tax credits
 * / grants / IRA / PTC.
 */
const INCENTIVE_DOCUMENT_FLAVORED_DOC_TYPES: ReadonlySet<DocType> =
  new Set<DocType>(['business_contract']);
const INCENTIVE_DOCUMENT_PATTERN_RE =
  /(production[-_\s]?tax[-_\s]?credit|\bPTC\b|inflation[-_\s]?reduction[-_\s]?act|\bIRA\b|tax[-_\s]?credit|tax[-_\s]?exemption|federal[-_\s]?grant|state[-_\s]?credit|FILOT|fee[-_\s]?in[-_\s]?lieu|abatement|incentive[-_\s]?agreement|economic[-_\s]?development[-_\s]?credit)/i;

function extractFirstJsonObject(text: string): string {
  const start = text.indexOf('{');
  if (start < 0) throw new Error('No JSON object found in response');
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\') {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error('Unterminated JSON object in response');
}

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document fact extraction on a single PDF from an E-2 Treaty Investor case folder. Your output goes into a typed memory the case-level aggregator will reason over later.

Your job is THREE-FOLD for each document: classify, extract, and suggest a canonical filename.

1. CLASSIFY the document into exactly ONE doc_type from this taxonomy. Pick by the document's CONTENT, not by the input filename — the input filename is often opaque scan output (e.g., \`1709245687.pdf\`). Each entry shows 3 canonical-filename examples; suggested_filename should aim for that shape.

   - passport — passport bio page / photo page / Turkish "Pasaport" page. Examples: kacar-salih-passport-bio-page.pdf · onur-camural-passport-bio-page.pdf · ozlem-demir-passport-bio-page.pdf
   - status_doc — visa stamp, EAD card, ESTA, change-of-status approval (I-797). Examples: kacar-salih-prior-e2-visa-stamp-2023.pdf · onur-camural-i-797-approval-notice-2024.pdf · ozlem-demir-ead-card-2025.pdf
   - i94 — CBP I-94 arrival/departure record. Recognize by "I-94", "Admission Number", "Class of Admission", "Admit Until Date". Examples: kacar-salih-i94-2025-08-12.pdf · onur-camural-i94-arrival-2024-02-01.pdf · gokmen-erdogan-i94-record.pdf
   - bank_statement — multi-month account statement. Examples: kacar-salih-akbank-statement-2025-q4.pdf · pomega-energy-isbank-statement-2024-jan.pdf · wise-guys-deli-citi-statement-2025-h2.pdf
   - tax_doc — tax return (1040, 1120, 1120S, 1065, foreign equivalent), W-2, 1099, 941. Examples: wise-guys-deli-form-1120s-tax-year-2024.pdf · kacar-salih-w2-2024.pdf · pomega-energy-foreign-tax-return-2023.pdf
   - money_movement — wire / SWIFT confirmation, bank transfer slip, cashier's check, FX conversion receipt. Examples: akbank-wire-confirmation-eur-to-usd-2025-08-15.pdf · pomega-energy-parent-to-us-wire-2024-01-30.pdf · kacar-salih-fx-conversion-try-to-usd-2025-11-25.pdf
   - source_of_funds — deed of sale (non-real-property), gift letter, inheritance documentation, loan agreement, sale-of-business contract. Examples: kacar-salih-property-sale-deed-istanbul-besiktas-2019.pdf · demir-family-gift-letter-usd-50k-2024.pdf · pomega-loan-agreement-eur-2-million-2023.pdf
   - title_deed — government land-registry title deed (Turkish Tapu, US recorded deed, foreign equivalent). Recognize by "Title Deed", "Tapu", "Land Registry", parcel/plot identifiers. Examples: tapu-deed-istanbul-besiktas-1024-7-2019.pdf · kacar-salih-prior-title-deed-istanbul-2019.pdf · current-title-deed-buyer-arda-yilmaz-2025-11-22.pdf
   - formation_doc — articles of incorporation / organization, EIN letter, operating agreement, bylaws, amendments. Examples: wise-guys-deli-articles-of-organization-rhode-island-2021.pdf · pomega-energy-foreign-articles-of-incorporation-2018.pdf · wise-guys-deli-ein-letter-2021.pdf
   - ownership_evidence — cap table, share certificate, ownership ledger, member resolution recording ownership. Examples: pomega-energy-shareholder-register-2024-q1.pdf · wise-guys-deli-cap-table-2025-12-05.pdf · pomega-energy-share-certificate-001-2018.pdf
   - lease_or_property — commercial premises lease, sublease, residential lease used as SOF rental income. Examples: wise-guys-deli-commercial-lease-providence-ri-2022.pdf · kacar-salih-residential-lease-istanbul-tufe-escalation-2023.pdf · pomega-energy-us-warehouse-lease-2024.pdf
   - business_plan — formal multi-year plan, projections, market analysis. Examples: wise-guys-deli-business-plan-2026-2030.pdf · pomega-energy-five-year-business-plan-2024-2028.pdf · onur-camural-pomega-medium-voltage-business-plan-2024.pdf
   - invoice_or_receipt — vendor invoice, equipment purchase, build-out, professional-fee invoice. Examples: wise-guys-deli-equipment-invoice-restaurant-depot-2022.pdf · pomega-energy-assembly-line-vendor-invoice-2024-q1.pdf · akalan-immigration-legal-fee-invoice-2026.pdf
   - business_contract — customer / vendor contract, franchise / distribution agreement, OR a Membership Interest Transfer Agreement / Bill of Sale of LLC interest (these route to the rich contract extractor downstream). Examples: wise-guys-deli-membership-interest-transfer-agreement-2025-12-05.pdf · wise-guys-deli-operating-agreement-2021.pdf · pomega-energy-customer-offtake-agreement-2024.pdf
   - payroll_doc — payroll register, employee list, W-2 summary, Form 941. Examples: wise-guys-deli-payroll-register-2025-q4.pdf · pomega-energy-us-employee-list-2024-q4.pdf · wise-guys-deli-form-941-2025-q3.pdf
   - financial_statement — balance sheet, profit & loss, cash flow, combined statements. Examples: wise-guys-deli-profit-and-loss-2024.pdf · pomega-energy-balance-sheet-2024-q1.pdf · wise-guys-deli-balance-sheet-as-of-2025-12-31.pdf
   - uscis_or_dos_form — I-129 (and E supplement), DS-160, DS-156E, G-28, G-1145, G-1650, I-539, I-539A. Examples: kacar-salih-form-i-129-2026-01-07.pdf · kacar-salih-form-i-129e-supplement-2026-01-07.pdf · ozlem-kacar-form-i-539-spouse-2026.pdf
   - cover_letter — cover letter / petition memorandum addressed to USCIS or a US consulate. Examples: akalan-cover-letter-kacar-salih-e2-renewal-2026-01-07.pdf · pomega-energy-cover-letter-camural-e2-specialized-2024-02-08.pdf · akalan-petition-memo-eb1c-2026.pdf
   - expert_letter — independent opinion / advisory / industry expert letter supporting the petition. Examples: prof-ahmet-yilmaz-expert-letter-pomega-2024.pdf · industry-advisory-letter-medium-voltage-energy-2024.pdf · expert-opinion-restaurant-industry-marginality-2026.pdf
   - employer_letter — employer-issued letter of recommendation / verification of employment / service record describing the beneficiary's tenure and duties. Examples: pomega-energy-letter-of-recommendation-camural-2024.pdf · siemens-turkey-service-record-camural-2018-2023.pdf · prior-employer-verification-of-employment-erdogan-2022.pdf
   - cv_or_resume — beneficiary's CV / resume / Turkish "ozgecmis". Examples: onur-camural-cv-medium-voltage-specialist.pdf · kacar-salih-resume-executive-chef.pdf · gokmen-erdogan-curriculum-vitae-2026.pdf
   - credential — diploma, professional certification, training certificate, license, transcript. Examples: onur-camural-diploma-electrical-engineering-itu-2008.pdf · kacar-salih-culinary-arts-certificate-le-cordon-bleu.pdf · siemens-mv-product-certification-camural-2020.pdf
   - vital_record — birth / marriage / divorce / death certificate (with or without certified translation). Examples: kacar-ozlem-marriage-certificate-istanbul-2008.pdf · zeynep-kacar-birth-certificate-2014.pdf · arda-yilmaz-divorce-decree-2020.pdf
   - government_id — national ID, driver's license, foreign residency card, SSN card. Examples: kacar-salih-rhode-island-drivers-license-2024.pdf · onur-camural-turkish-national-id-2022.pdf · zeynep-kacar-social-security-card.pdf
   - translation_certification — standalone certified translator's declaration (separate from the underlying foreign document). Recognize by translator name + competency statement + signature/date. Examples: certified-translation-declaration-tapu-istanbul-2025.pdf · translator-cert-marriage-certificate-kacar-2024.pdf · translator-affidavit-pomega-board-resolution-2024.pdf
   - other — does NOT fit ANY category above with confidence ≥ 0.5. Use ONLY as a last resort.

   CLASSIFICATION DISCIPLINE — important:
   - For every document, evaluate ALL 24 non-other categories. Only return 'other' if you have evaluated every category and ZERO category fits with confidence ≥ 0.5. "Other" is a confession the classifier could not decide; in production this is too common and degrades downstream typed memory. Prefer the closest category and reflect uncertainty in the field-level confidence values.
   - When a document straddles two categories (e.g., a Bill of Sale that transfers real property — both source_of_funds and title_deed), pick by the document's PRIMARY legal effect: government registry record → title_deed; sale contract → source_of_funds.
   - When a document is a foreign-language original, classify by content (use the translation if attached) and append a "-tr" / "-de" / "-fr" language suffix in suggested_filename.

2. EXTRACT the type-specific fields per the schema for the chosen doc_type. Only the schema variant matching your chosen doc_type is valid in your JSON output.

3. SUGGEST a canonical filename in the suggested_filename field. This is a soft suggestion an attorney can accept or reject. Naming convention (mandatory):
   - Pattern: <party-or-entity>-<doc-type>-<distinguishing-detail>-<date-if-relevant>.pdf
   - Lowercase, kebab-case (hyphen-separated), ASCII only.
   - Transliterate Turkish characters: ç→c, ğ→g, ı→i, İ→i, ö→o, ş→s, ü→u (and uppercase counterparts).
   - Maximum 80 characters including the .pdf extension.
   - Always end with .pdf.
   - Distinguishing-detail examples: bio-page (passport), signature-page (contract last page), istanbul-besiktas (location), usd-120k (amount), 2024-q1 (period), 2025-08-15 (specific date).
   - Party preference order: (a) Beneficiary's name when the doc identifies the beneficiary (passport, CV, employer letter, vital record); (b) Petitioner / enterprise name when the doc identifies the enterprise (Articles, lease, bank statements, payroll, financial statements); (c) bank or institution when neither party is the focus (e.g., "akbank-wire-confirmation-..."); (d) the doc category itself when no party is identifiable ("expert-opinion-...").
   - If beneficiary name is absent, use entity name; if both absent, use doc category + date.
   - Worked examples:
     · Kacar-Salih's passport bio page → "kacar-salih-passport-bio-page.pdf"
     · Wise Guys Deli LLC Articles of Organization → "wise-guys-deli-articles-of-organization.pdf"
     · Turkish Tapu deed for Istanbul Besiktas property → "tapu-deed-istanbul-besiktas-2019.pdf"
     · Pomega Energy board resolution from January 2024 → "pomega-energy-board-resolution-2024-01.pdf"
     · Akbank wire confirmation EUR-to-USD on 2025-08-15 → "akbank-wire-confirmation-eur-to-usd-2025-08-15.pdf"

   suggested_filename is a Field<string>: populate value with the kebab-case name; source_page=null and source_quote="[derived from document content]" with confidence reflecting how clearly you could identify party + doc-type + detail (1.0 unambiguous, ~0.7 confident, ~0.5 best-effort).

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers in the input.
- source_quote is a short verbatim phrase (5–25 words) copied from the source that contains or directly evidences the value.
- confidence is in [0, 1]: 1.0 = explicit and unambiguous; ~0.7 = clear in context; ~0.5 = ambiguous; do not emit values below 0.3.
- Currency: numbers in USD with symbols/commas stripped. If the source gives a foreign currency and a rate is stated, convert and note in source_quote; if no rate stated, leave value=null.
- Dates: prefer ISO YYYY-MM-DD; if format ambiguous (MM/DD vs DD/MM), leave value=null.
- Booleans: only emit true/false when the source supports it; otherwise null.

Edge cases:
- If a single PDF clearly contains multiple distinct documents (e.g., a cover letter followed by an exhibit), classify by the document's PRIMARY purpose. Note any secondary content briefly in the relevant field if appropriate.
- If a document is partially OCR-garbled, extract what is legible; leave noisy fields null.
- If you cannot confidently classify, choose 'other' and populate one_line_summary + a few key_facts entries with whatever is legible.
- Do NOT guess the doc_type. If genuinely unsure, choose 'other'.

Output: ONE JSON object matching the doc_type-discriminated PerPdfFacts schema. No prose, no commentary, no markdown fences.`;

export interface TypedExtractInput {
  filename: string;
  buffer: Buffer;
}

const MAX_TEXT_CHARS = 60_000;

export async function classifyAndExtractOnePdf(
  input: TypedExtractInput,
): Promise<PerPdfResult> {
  // Content-hash dedup: byte-identical PDFs (translation pairs left as
  // originals, email-attachment forwards, sync copies) skip the Haiku call
  // and the rich extractors. Errors are not cached upstream so we don't
  // need a negative-cache check here.
  const hash = pdfContentHash(input.buffer);
  const cached = readPdfCache(hash);
  if (cached) {
    return { filename: input.filename, ...cached };
  }

  let parsed;
  try {
    parsed = await extractPdfText(input.buffer);
  } catch (e: unknown) {
    return {
      filename: input.filename,
      pageCount: 0,
      error: {
        code: 'pdf_parse_failed',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }

  if (parsed.looksLikeScan) {
    // Pure scan: text extraction returned sparse content. We still run
    // the image-photo extractor (vision pass) so the dashboard surfaces
    // signature pages / apostille stamps / consular seals / passport
    // photos that would otherwise be invisible to the text pipeline.
    // Failure is non-fatal — the placeholder thin facts ship regardless.
    let scanImagePhoto;
    const scanImagePhotoResult = await extractImagePhoto({
      filename: input.filename,
      buffer: input.buffer,
      pageCount: parsed.pageCount,
    });
    if (scanImagePhotoResult.facts) {
      scanImagePhoto = scanImagePhotoResult.facts;
    } else if (scanImagePhotoResult.error) {
      console.warn(
        `[image-photo-extract] ${input.filename}: ${scanImagePhotoResult.error.code} — ${scanImagePhotoResult.error.message}`,
      );
    }

    const scanEntry: Omit<PerPdfResult, 'filename' | 'error'> = {
      pageCount: parsed.pageCount,
      facts: {
        doc_type: 'other',
        suggested_filename: {
          value: null,
          source_page: null,
          source_quote: null,
          confidence: null,
        },
        one_line_summary: {
          value: 'Scanned document — text extraction returned sparse content; OCR/vision required.',
          source_page: null,
          source_quote: null,
          confidence: 0.4,
        },
        key_facts: [],
      },
      imagePhoto: scanImagePhoto,
    };
    writePdfCache(hash, scanEntry);
    return { filename: input.filename, ...scanEntry };
  }

  // Front-half + last-quarter sampling for over-budget docs: legal
  // documents (cover letters, business plans) carry critical content in
  // both the opening framing and the signature/exhibit tail; plain
  // front-only truncation drops the latter. Char-based heuristic — no
  // countTokens round-trip on the per-PDF path (we have N PDFs/case).
  const text = sampleLongText(parsed.text, MAX_TEXT_CHARS);

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the doc_type-discriminated PerPdfFacts schema. No prose, no markdown fences.`;

  // The PerPdfFactsSchema discriminated union has hundreds of nullable
  // params across 17 variants — exceeds Anthropic's structured-output cap
  // (16 union params). Use manual JSON parse + Zod validate, same pattern
  // as ingest/claude.ts extractFactsByCaseType.
  let response;
  try {
    response = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4000,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral', ttl: '1h' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });
  } catch (e: unknown) {
    return {
      filename: input.filename,
      pageCount: parsed.pageCount,
      error: {
        code: 'classify_extract_failed',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }

  let jsonText = '';
  for (const block of response.content) {
    if (block.type === 'text') jsonText += block.text;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(extractFirstJsonObject(jsonText));
  } catch (e: unknown) {
    return {
      filename: input.filename,
      pageCount: parsed.pageCount,
      error: {
        code: 'json_parse_failed',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }

  const validated = PerPdfFactsSchema.safeParse(raw);
  if (!validated.success) {
    return {
      filename: input.filename,
      pageCount: parsed.pageCount,
      error: {
        code: 'schema_mismatch',
        message: validated.error.message.slice(0, 500),
      },
    };
  }

  logAnthropicUsage({
    stage: 'extract',
    model: 'claude-haiku-4-5',
    case_type: 'E2',
    usage: response.usage,
  });

  const facts = validated.data as PerPdfFacts;

  // Second pass: route to each rich extractor whose flavor includes the
  // first-pass doc_type. Multiple extractors may apply to the same PDF
  // (e.g., a money_movement document is both bank-receipt-flavored and
  // wire-confirmation-flavored — they capture different facets), so we
  // run them in parallel rather than picking one.
  //
  // Failure inside any rich extractor is non-fatal: we keep the thin
  // first-pass facts and surface the second-pass error at telemetry
  // level. The cross-extractor gates (consideration drift, FX validation,
  // Tapu defensive flag) all run in the aggregator.
  const richInput = {
    filename: input.filename,
    text,
    pageCount: parsed.pageCount,
  };

  const filenameSuggestsVisaStamp = VISA_STAMP_FILENAME_RE.test(input.filename);
  const filenameSuggestsJobOffer = JOB_OFFER_FILENAME_RE.test(input.filename);
  const filenameSuggestsServiceRecord = SERVICE_RECORD_FILENAME_RE.test(input.filename);
  const filenameSuggestsCv = CV_FILENAME_RE.test(input.filename);
  const filenameSuggestsCredential = CREDENTIAL_FILENAME_RE.test(input.filename);
  const filenameSuggestsRecommendationLetter = RECOMMENDATION_LETTER_FILENAME_RE.test(
    input.filename,
  );
  const filenameSuggestsForeignCorporate =
    FOREIGN_CORPORATE_FILENAME_RE.test(input.filename);
  const filenameSuggestsImagePhoto = IMAGE_PHOTO_FILENAME_RE.test(input.filename);

  // Batch 6 routers — content-or-filename patterns. Customer contracts
  // and incentive documents share the business_contract doc_type, so
  // each pattern fires independently on filename OR sampled text.
  const customerContractMatch =
    CUSTOMER_CONTRACT_PATTERN_RE.test(input.filename) ||
    CUSTOMER_CONTRACT_PATTERN_RE.test(text);
  const realEstatePurchaseMatch =
    REAL_ESTATE_PURCHASE_PATTERN_RE.test(input.filename) ||
    REAL_ESTATE_PURCHASE_PATTERN_RE.test(text);
  const incentiveDocumentMatch =
    INCENTIVE_DOCUMENT_PATTERN_RE.test(input.filename) ||
    INCENTIVE_DOCUMENT_PATTERN_RE.test(text);

  const [
    contractResult,
    bankReceiptResult,
    wireConfirmationResult,
    governmentDocResult,
    passportResult,
    i94Result,
    visaStampResult,
    vitalRecordsResult,
    jobOfferResult,
    serviceRecordResult,
    cvResult,
    credentialResult,
    recommendationLetterResult,
    payrollResult,
    taxReturnResult,
    financialStatementResult,
    corporateFormationResult,
    foreignCorporateResult,
    imagePhotoResult,
    customerContractResult,
    realEstatePurchaseResult,
    incentiveDocumentResult,
  ] = await Promise.all([
    CONTRACT_FLAVORED_DOC_TYPES.has(facts.doc_type)
      ? extractContract(richInput)
      : Promise.resolve(null),
    BANK_RECEIPT_FLAVORED_DOC_TYPES.has(facts.doc_type)
      ? extractBankReceipt(richInput)
      : Promise.resolve(null),
    WIRE_CONFIRMATION_FLAVORED_DOC_TYPES.has(facts.doc_type)
      ? extractWireConfirmation(richInput)
      : Promise.resolve(null),
    GOVERNMENT_DOC_FLAVORED_DOC_TYPES.has(facts.doc_type)
      ? extractGovernmentDoc(richInput)
      : Promise.resolve(null),
    PASSPORT_FLAVORED_DOC_TYPES.has(facts.doc_type)
      ? extractPassport(richInput)
      : Promise.resolve(null),
    I94_FLAVORED_DOC_TYPES.has(facts.doc_type)
      ? extractI94(richInput)
      : Promise.resolve(null),
    VISA_STAMP_FLAVORED_DOC_TYPES.has(facts.doc_type) && filenameSuggestsVisaStamp
      ? extractVisaStamp(richInput)
      : Promise.resolve(null),
    VITAL_RECORDS_FLAVORED_DOC_TYPES.has(facts.doc_type)
      ? extractVitalRecords(richInput)
      : Promise.resolve(null),
    JOB_OFFER_FLAVORED_DOC_TYPES.has(facts.doc_type) && filenameSuggestsJobOffer
      ? extractJobOffer(richInput)
      : Promise.resolve(null),
    SERVICE_RECORD_FLAVORED_DOC_TYPES.has(facts.doc_type) &&
    filenameSuggestsServiceRecord
      ? extractServiceRecord(richInput)
      : Promise.resolve(null),
    CV_FLAVORED_DOC_TYPES.has(facts.doc_type) && filenameSuggestsCv
      ? extractCv(richInput)
      : Promise.resolve(null),
    CREDENTIAL_FLAVORED_DOC_TYPES.has(facts.doc_type) && filenameSuggestsCredential
      ? extractCredential(richInput)
      : Promise.resolve(null),
    RECOMMENDATION_LETTER_FLAVORED_DOC_TYPES.has(facts.doc_type) &&
    filenameSuggestsRecommendationLetter
      ? extractRecommendationLetter(richInput)
      : Promise.resolve(null),
    PAYROLL_FLAVORED_DOC_TYPES.has(facts.doc_type)
      ? extractPayroll(richInput)
      : Promise.resolve(null),
    TAX_RETURN_FLAVORED_DOC_TYPES.has(facts.doc_type)
      ? extractTaxReturn(richInput)
      : Promise.resolve(null),
    FINANCIAL_STATEMENT_FLAVORED_DOC_TYPES.has(facts.doc_type)
      ? extractFinancialStatement(richInput)
      : Promise.resolve(null),
    CORPORATE_FORMATION_FLAVORED_DOC_TYPES.has(facts.doc_type)
      ? extractCorporateFormation(richInput)
      : Promise.resolve(null),
    FOREIGN_CORPORATE_FLAVORED_DOC_TYPES.has(facts.doc_type) &&
    filenameSuggestsForeignCorporate
      ? extractForeignCorporate(richInput)
      : Promise.resolve(null),
    parsed.looksLikeScan || filenameSuggestsImagePhoto
      ? extractImagePhoto({
          filename: input.filename,
          buffer: input.buffer,
          pageCount: parsed.pageCount,
        })
      : Promise.resolve(null),
    CUSTOMER_CONTRACT_FLAVORED_DOC_TYPES.has(facts.doc_type) &&
    customerContractMatch
      ? extractCustomerContract(richInput)
      : Promise.resolve(null),
    REAL_ESTATE_PURCHASE_FLAVORED_DOC_TYPES.has(facts.doc_type) &&
    realEstatePurchaseMatch
      ? extractRealEstatePurchase(richInput)
      : Promise.resolve(null),
    INCENTIVE_DOCUMENT_FLAVORED_DOC_TYPES.has(facts.doc_type) &&
    incentiveDocumentMatch
      ? extractIncentiveDocument(richInput)
      : Promise.resolve(null),
  ]);

  let contract;
  if (contractResult?.facts) {
    contract = contractResult.facts;
  } else if (contractResult?.error) {
    console.warn(
      `[contract-extract] ${input.filename}: ${contractResult.error.code} — ${contractResult.error.message}`,
    );
  }

  let bankReceipt;
  if (bankReceiptResult?.facts) {
    bankReceipt = bankReceiptResult.facts;
  } else if (bankReceiptResult?.error) {
    console.warn(
      `[bank-receipt-extract] ${input.filename}: ${bankReceiptResult.error.code} — ${bankReceiptResult.error.message}`,
    );
  }

  let wireConfirmation;
  if (wireConfirmationResult?.facts) {
    wireConfirmation = wireConfirmationResult.facts;
  } else if (wireConfirmationResult?.error) {
    console.warn(
      `[wire-confirmation-extract] ${input.filename}: ${wireConfirmationResult.error.code} — ${wireConfirmationResult.error.message}`,
    );
  }

  let governmentDoc;
  if (governmentDocResult?.facts) {
    governmentDoc = governmentDocResult.facts;
  } else if (governmentDocResult?.error) {
    console.warn(
      `[government-doc-extract] ${input.filename}: ${governmentDocResult.error.code} — ${governmentDocResult.error.message}`,
    );
  }

  let passport;
  if (passportResult?.facts) {
    passport = passportResult.facts;
  } else if (passportResult?.error) {
    console.warn(
      `[passport-extract] ${input.filename}: ${passportResult.error.code} — ${passportResult.error.message}`,
    );
  }

  let i94;
  if (i94Result?.facts) {
    i94 = i94Result.facts;
  } else if (i94Result?.error) {
    console.warn(
      `[i94-extract] ${input.filename}: ${i94Result.error.code} — ${i94Result.error.message}`,
    );
  }

  let visaStamp;
  if (visaStampResult?.facts) {
    visaStamp = visaStampResult.facts;
  } else if (visaStampResult?.error) {
    console.warn(
      `[visa-stamp-extract] ${input.filename}: ${visaStampResult.error.code} — ${visaStampResult.error.message}`,
    );
  }

  let vitalRecords;
  if (vitalRecordsResult?.facts) {
    vitalRecords = vitalRecordsResult.facts;
  } else if (vitalRecordsResult?.error) {
    console.warn(
      `[vital-records-extract] ${input.filename}: ${vitalRecordsResult.error.code} — ${vitalRecordsResult.error.message}`,
    );
  }

  let jobOffer;
  if (jobOfferResult?.facts) {
    jobOffer = jobOfferResult.facts;
  } else if (jobOfferResult?.error) {
    console.warn(
      `[job-offer-extract] ${input.filename}: ${jobOfferResult.error.code} — ${jobOfferResult.error.message}`,
    );
  }

  let serviceRecord;
  if (serviceRecordResult?.facts) {
    serviceRecord = serviceRecordResult.facts;
  } else if (serviceRecordResult?.error) {
    console.warn(
      `[service-record-extract] ${input.filename}: ${serviceRecordResult.error.code} — ${serviceRecordResult.error.message}`,
    );
  }

  let cv;
  if (cvResult?.facts) {
    cv = cvResult.facts;
  } else if (cvResult?.error) {
    console.warn(
      `[cv-extract] ${input.filename}: ${cvResult.error.code} — ${cvResult.error.message}`,
    );
  }

  let credential;
  if (credentialResult?.facts) {
    credential = credentialResult.facts;
  } else if (credentialResult?.error) {
    console.warn(
      `[credential-extract] ${input.filename}: ${credentialResult.error.code} — ${credentialResult.error.message}`,
    );
  }

  let recommendationLetter;
  if (recommendationLetterResult?.facts) {
    recommendationLetter = recommendationLetterResult.facts;
  } else if (recommendationLetterResult?.error) {
    console.warn(
      `[recommendation-letter-extract] ${input.filename}: ${recommendationLetterResult.error.code} — ${recommendationLetterResult.error.message}`,
    );
  }

  let payroll;
  if (payrollResult?.facts) {
    payroll = payrollResult.facts;
  } else if (payrollResult?.error) {
    console.warn(
      `[payroll-extract] ${input.filename}: ${payrollResult.error.code} — ${payrollResult.error.message}`,
    );
  }

  let taxReturn;
  if (taxReturnResult?.facts) {
    taxReturn = taxReturnResult.facts;
  } else if (taxReturnResult?.error) {
    console.warn(
      `[tax-return-extract] ${input.filename}: ${taxReturnResult.error.code} — ${taxReturnResult.error.message}`,
    );
  }

  let financialStatement;
  if (financialStatementResult?.facts) {
    financialStatement = financialStatementResult.facts;
  } else if (financialStatementResult?.error) {
    console.warn(
      `[financial-statement-extract] ${input.filename}: ${financialStatementResult.error.code} — ${financialStatementResult.error.message}`,
    );
  }

  let corporateFormation;
  if (corporateFormationResult?.facts) {
    corporateFormation = corporateFormationResult.facts;
  } else if (corporateFormationResult?.error) {
    console.warn(
      `[corporate-formation-extract] ${input.filename}: ${corporateFormationResult.error.code} — ${corporateFormationResult.error.message}`,
    );
  }

  let foreignCorporate;
  if (foreignCorporateResult?.facts) {
    foreignCorporate = foreignCorporateResult.facts;
  } else if (foreignCorporateResult?.error) {
    console.warn(
      `[foreign-corporate-extract] ${input.filename}: ${foreignCorporateResult.error.code} — ${foreignCorporateResult.error.message}`,
    );
  }

  let imagePhoto;
  if (imagePhotoResult?.facts) {
    imagePhoto = imagePhotoResult.facts;
  } else if (imagePhotoResult?.error) {
    console.warn(
      `[image-photo-extract] ${input.filename}: ${imagePhotoResult.error.code} — ${imagePhotoResult.error.message}`,
    );
  }

  let customerContract;
  if (customerContractResult?.facts) {
    customerContract = customerContractResult.facts;
  } else if (customerContractResult?.error) {
    console.warn(
      `[customer-contract-extract] ${input.filename}: ${customerContractResult.error.code} — ${customerContractResult.error.message}`,
    );
  }

  let realEstatePurchase;
  if (realEstatePurchaseResult?.facts) {
    realEstatePurchase = realEstatePurchaseResult.facts;
  } else if (realEstatePurchaseResult?.error) {
    console.warn(
      `[real-estate-purchase-extract] ${input.filename}: ${realEstatePurchaseResult.error.code} — ${realEstatePurchaseResult.error.message}`,
    );
  }

  let incentiveDocument;
  if (incentiveDocumentResult?.facts) {
    incentiveDocument = incentiveDocumentResult.facts;
  } else if (incentiveDocumentResult?.error) {
    console.warn(
      `[incentive-document-extract] ${input.filename}: ${incentiveDocumentResult.error.code} — ${incentiveDocumentResult.error.message}`,
    );
  }

  const entry = {
    pageCount: parsed.pageCount,
    facts,
    contract,
    bankReceipt,
    wireConfirmation,
    governmentDoc,
    passport,
    i94,
    visaStamp,
    vitalRecords,
    jobOffer,
    serviceRecord,
    cv,
    credential,
    recommendationLetter,
    payroll,
    taxReturn,
    financialStatement,
    corporateFormation,
    foreignCorporate,
    imagePhoto,
    customerContract,
    realEstatePurchase,
    incentiveDocument,
  };
  writePdfCache(hash, entry);
  return { filename: input.filename, ...entry };
}

/**
 * Run an array of async tasks with bounded concurrency. Each task
 * receives its index so the caller can stream progress events in order.
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  onComplete?: (index: number, result: R) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      const r = await fn(items[i], i);
      results[i] = r;
      onComplete?.(i, r);
    }
  }

  const lanes = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: lanes }, () => worker()));
  return results;
}

export function getTypedExtractConcurrency(): number {
  const raw = process.env.TYPED_EXTRACT_CONCURRENCY;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 50) return parsed;
  return 5;
}
