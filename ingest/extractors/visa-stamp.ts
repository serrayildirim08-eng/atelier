/**
 * Visa-stamp / I-797 rich-extraction second pass — runs after
 * typed-extract.ts classifies a PDF as doc_type='status_doc' AND the
 * filename matches the visa/stamp/I-797 regex (the thin classifier lumps
 * visa stamps, I-94s, and I-797 notices under a single doc_type, so the
 * router uses the filename hint to pick the correct rich extractor).
 *
 * Mirrors the contract extractor pattern: pre-extracted PDF text in,
 * VisaStampExtractResult out. Manual JSON parse + Zod validate.
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  VisaStampFactsSchema,
  type VisaStampFacts,
} from './visa-stamp.schema';

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

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document extraction on a US visa stamp OR a USCIS I-797 approval notice. Both are anchors for prior US status; the cover-letter drafter cites them in Tab C.1 (manual §3.2) for renewals.

Extract the following fields per the VisaStampFacts schema. EVERY field carries the {value, source_page, source_quote, confidence} provenance wrapper.

Field-specific guidance:

- visa_number: alphanumeric "Visa No." or "Foil No." printed on a consular foil. For an I-797, this is the receipt number printed at the top (e.g., "EAC2412345678"). The schema also has a separate i797_receipt_number — populate visa_number for foil stamps and i797_receipt_number for I-797s; populate BOTH when both numbers appear (rare).

- classification: the visa class as printed (e.g., "E-2", "B-2", "F-1", "L-1A", "H-1B"). For E-2 stamps, the foil prints "E-2" or "E-2 (Treaty Investor)". Capture verbatim.

- validity_start_date / validity_end_date: ISO YYYY-MM-DD. For consular foils, the "Issue Date" and "Expiration Date" fields. For I-797 approvals, the "Valid From" and "Valid Until" fields.

- port_of_issue: the city / consulate location where the visa was issued (e.g., "Istanbul", "Frankfurt", "Mumbai"). For I-797s, the USCIS service center processing center (CSC, NSC, TSC, VSC). Verbatim.

- issuing_consulate: the consulate or service-center name (e.g., "U.S. Consulate General Istanbul", "California Service Center"). Verbatim.

- holder_name_ascii: the holder's name as printed (US authorities issue ASCII transliterations).

- entries: 'M' if the foil prints "Multiple", or a digit ('1', '2'…) if a specific number of entries is authorized. For I-797s entries does not apply — leave value=null.

- i797_receipt_number: only populated when the document is an I-797 notice; the receipt number prefix is one of EAC / WAC / SRC / LIN / MSC / IOE plus a 10-digit sequence.

- prior_admissions: a list of prior entry stamps visible on the same passport page (one row per stamp). Each row has port_of_entry, admission_date, classification. Empty array when no entry stamps are visible.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers in the input.
- source_quote is a short verbatim phrase (5–25 words) copied from the source.
- confidence is in [0, 1]: 1.0 = explicit and unambiguous; ~0.7 = clear in context; ~0.5 = ambiguous; do not emit values below 0.3.

Edge cases:
- A passport page showing multiple visa stamps from different cycles: extract the MOST RECENT visa as primary (the one with the latest validity_start_date). Earlier stamps go in prior_admissions[] only if they are entry/exit stamps; earlier visa foils are NOT captured here — the renewal narrative only cares about the most recent prior visa.
- An I-797 that grants change of status from inside the US (rather than approving a petition): treat the same way; classification is the new class granted.
- If the document is actually an I-94 record rather than a visa or I-797, this extractor is the wrong pass — return all fields null. The router uses the filename hint to choose between i94 and visa-stamp; misroutes are rare.

Output: ONE JSON object matching VisaStampFactsSchema. No prose, no commentary, no markdown fences.`;

export interface VisaStampExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface VisaStampExtractResult {
  filename: string;
  pageCount: number;
  facts?: VisaStampFacts;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractVisaStamp(
  input: VisaStampExtractInput,
): Promise<VisaStampExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the VisaStampFacts schema. No prose, no markdown fences.`;

  let response;
  try {
    response = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2000,
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
      pageCount: input.pageCount,
      error: {
        code: 'visa_stamp_extract_failed',
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
      pageCount: input.pageCount,
      error: {
        code: 'json_parse_failed',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }

  const validated = VisaStampFactsSchema.safeParse(raw);
  if (!validated.success) {
    return {
      filename: input.filename,
      pageCount: input.pageCount,
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

  return {
    filename: input.filename,
    pageCount: input.pageCount,
    facts: validated.data as VisaStampFacts,
  };
}
