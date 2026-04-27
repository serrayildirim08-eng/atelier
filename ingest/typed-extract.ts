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

Your job is two-fold for each document:

1. CLASSIFY the document into exactly ONE doc_type from this taxonomy:
   - passport — passport bio page or photo page identifying the investor
   - status_doc — I-94 record, visa stamp, change-of-status approval, ESTA, EAD card, etc.
   - bank_statement — periodic statement from a bank or brokerage
   - tax_doc — tax return (1040, 1040-NR, foreign equivalents), W-2, 1099
   - money_movement — wire confirmation, bank transfer receipt, cashier's check, payment stub showing money moved
   - source_of_funds — deed of sale, gift letter, inheritance documentation, loan agreement, sale-of-business contract
   - formation_doc — articles of incorporation/organization, EIN letter, operating agreement, bylaws, amendments
   - ownership_evidence — cap table, share certificate, operating-agreement exhibit B, ledger of ownership
   - lease_or_property — commercial lease, premises sublease, deed for the enterprise's premises
   - business_plan — formal business plan, projections, market analysis
   - invoice_or_receipt — vendor invoice, equipment purchase receipt, build-out cost, professional-fee invoice
   - business_contract — customer contract, vendor contract, franchise agreement, distribution agreement, OR a Membership Interest Transfer Agreement / Bill of Sale of LLC interest (these route to the rich contract extractor downstream)
   - payroll_doc — payroll register, employee list, W-2 summary for the enterprise
   - uscis_or_dos_form — Form I-129 (and E supplement), Form DS-160 confirmation, Form DS-156E, Form G-28
   - cover_letter — attorney cover letter or petition memorandum addressed to USCIS or a US consulate
   - expert_letter — opinion / advisory / industry expert letter supporting the petition
   - other — does not fit any of the above; use sparingly

2. EXTRACT the type-specific fields per the schema for the chosen doc_type. Only the schema variant matching your chosen doc_type is valid in your JSON output.

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
    const scanEntry: Omit<PerPdfResult, 'filename' | 'error'> = {
      pageCount: parsed.pageCount,
      facts: {
        doc_type: 'other',
        one_line_summary: {
          value: 'Scanned document — text extraction returned sparse content; OCR/vision required.',
          source_page: null,
          source_quote: null,
          confidence: 0.4,
        },
        key_facts: [],
      },
    };
    writePdfCache(hash, scanEntry);
    return { filename: input.filename, ...scanEntry };
  }

  const text = parsed.text.length > MAX_TEXT_CHARS
    ? parsed.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
    : parsed.text;

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

  const [contractResult, bankReceiptResult, wireConfirmationResult, governmentDocResult] =
    await Promise.all([
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

  const entry = {
    pageCount: parsed.pageCount,
    facts,
    contract,
    bankReceipt,
    wireConfirmation,
    governmentDoc,
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
