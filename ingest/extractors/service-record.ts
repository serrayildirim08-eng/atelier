/**
 * Service-record rich-extraction second pass — runs after typed-extract.ts
 * classifies a PDF as doc_type='other' AND the filename matches
 * /(service[-_\s]?record|sicil|hizmet|employment[-_\s]?cert)/i. Single
 * Haiku 4.5 call fills ServiceRecordFactsSchema. The aggregator uses
 * salary_at_termination + peer benchmark to support the Subtype-4
 * salary-differential argument (manual §3.3.3).
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  ServiceRecordFactsSchema,
  type ServiceRecordFacts,
} from './service-record.schema';

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

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document extraction on a foreign service / employment record (e.g., Turkish SGK Hizmet Belgesi, Turkish "Sicil Kaydı", a former-employer HR letter, an EU social-security tenure printout) attached to an E-2 Treaty Investor case folder. The aggregator uses your output to support the Subtype-4 specialized-knowledge salary-differential argument (manual §3.3.3, 9 FAM 402.9-7(2)(b)).

Extract the following fields per the ServiceRecordFacts schema. EVERY field carries the {value, source_page, source_quote, confidence} provenance wrapper.

Field-specific guidance:

- employer_legal_name: name of the prior employer, in the form printed on the document (Latin if printed Latin, native if printed in native script — keep verbatim).
- employer_country: country whose authority issued the record OR where the employer was domiciled.
- beneficiary_name_ascii: the Beneficiary's name in ASCII (apply Turkish ş→s, ı→i, ğ→g, ü→u, ö→o, ç→c if needed). The cover letter uses ASCII names.
- position_title: as printed.
- employment_start_date / employment_end_date: ISO YYYY-MM-DD. If end_date is "still employed" or open, leave value=null.
- total_tenure_months: integer months, computed from start to end. If start is set and end is null (still employed), compute to today and note "still employed; computed to source-document date" in source_quote.
- salary_at_termination_amount + salary_at_termination_currency: the most recent salary on the record. ISO-4217 currency code. If the source uses a frequency other than annual (e.g., monthly), capture the source amount AS-IS and note "monthly" in source_quote — the aggregator handles the multiplier.
- supervisor_name: who the Beneficiary reported to, if printed.
- signatory_name + signatory_title: who signed/issued the record.
- signed_date: ISO YYYY-MM-DD when the record was issued.
- foreign_peer_salary_benchmark_amount + foreign_peer_salary_benchmark_currency + foreign_peer_salary_source_quote: ONLY populate when the source document itself cites a national/industry average salary for the role (rare — most service records don't include this; the aggregator sources benchmarks elsewhere). When present, capture the verbatim quote with the cited source.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers.
- source_quote is a short verbatim phrase (5–25 words).
- confidence is in [0, 1]; do not emit values below 0.3.
- Currency: amounts as numbers with symbols/commas stripped; ISO-4217 separately.
- Account numbers, full SSNs, full government IDs: NEVER capture. Service records sometimes print TC Kimlik / SGK numbers in full — strip on extract.

Output: ONE JSON object matching ServiceRecordFactsSchema. No prose, no commentary, no markdown fences.`;

export interface ServiceRecordExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface ServiceRecordExtractResult {
  filename: string;
  pageCount: number;
  facts?: ServiceRecordFacts;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractServiceRecord(
  input: ServiceRecordExtractInput,
): Promise<ServiceRecordExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the ServiceRecordFacts schema. No prose, no markdown fences.`;

  let response;
  try {
    response = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 3000,
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
        code: 'service_record_extract_failed',
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

  const validated = ServiceRecordFactsSchema.safeParse(raw);
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
    facts: validated.data as ServiceRecordFacts,
  };
}
