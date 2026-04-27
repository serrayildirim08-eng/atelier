/**
 * I-94 rich-extraction second pass — runs after typed-extract.ts
 * classifies a PDF as doc_type='status_doc' AND the document is an I-94
 * (CBP arrival/departure record). A single Haiku 4.5 call fills
 * I94FactsSchema, which the aggregator uses for the manual §3.4
 * status-violation gate (admit_until_date ≥ filing_date).
 *
 * Mirrors the contract extractor pattern: pre-extracted PDF text in,
 * I94ExtractResult out. Manual JSON parse + Zod validate.
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import { I94FactsSchema, type I94Facts } from './i94.schema';

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

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document I-94 extraction on a single PDF from an E-2 Treaty Investor case folder. The I-94 is the CBP arrival/departure record establishing lawful status; the aggregator uses your output to gate the filing (manual §3.4 admit_until_date ≥ filing_date).

Extract the following fields per the I94Facts schema. EVERY field carries the {value, source_page, source_quote, confidence} provenance wrapper.

Field-specific guidance:

- full_name_ascii: the holder's name as printed on the I-94, in ASCII (CBP records are already ASCII; preserve any all-caps formatting in the value but DO NOT alter spelling).

- admission_number: the 11-digit CBP admission number (sometimes labeled "Admission (I-94) Record Number"). Capture verbatim.

- class_of_admission: the class code (e.g., "E-2", "B-2", "F-1", "L-1A", "VWB"). For E-2, the I-94 may also print "E-2 (Spouse)" or "E-2 (Child)" — capture verbatim.

- admission_date: ISO YYYY-MM-DD. The "Date of Admission" or arrival date.

- admit_until_date: ISO YYYY-MM-DD. The "Admit Until Date" — i.e., the date when authorized stay expires. May print "D/S" (duration of status) on some I-94s; in that case, leave admit_until_date.value=null and set duration_of_status_marker.value=true.

- port_of_entry: airport / land border crossing where the alien was admitted, e.g., "JFK", "LAX", "Detroit, MI", "Buffalo, NY". Verbatim.

- duration_of_status_marker: true if the I-94 prints "D/S" rather than a specific date in the admit-until field; false otherwise.

- cbp_record_number: optional supplementary identifier some I-94 printouts include. Leave value=null if not present.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers in the input.
- source_quote is a short verbatim phrase (5–25 words) copied from the source.
- confidence is in [0, 1]: 1.0 = explicit and unambiguous; ~0.7 = clear in context; ~0.5 = ambiguous; do not emit values below 0.3.

Edge cases:
- The CBP I-94 retrieval website prints multiple historical I-94s on one PDF ("Travel History"). When that occurs, extract the MOST RECENT entry as the primary (the one whose admission_date is the latest); other entries are not captured here.
- If the document is a paper I-94 stub (older format), extract the same fields from the printed slip.
- If the document is an I-797 approval notice or a visa stamp rather than an I-94, this extractor is the wrong pass — return all fields null. The router will have routed it to the visa-stamp extractor.

Output: ONE JSON object matching I94FactsSchema. No prose, no commentary, no markdown fences.`;

export interface I94ExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface I94ExtractResult {
  filename: string;
  pageCount: number;
  facts?: I94Facts;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractI94(
  input: I94ExtractInput,
): Promise<I94ExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the I94Facts schema. No prose, no markdown fences.`;

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
        code: 'i94_extract_failed',
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

  const validated = I94FactsSchema.safeParse(raw);
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
    facts: validated.data as I94Facts,
  };
}
