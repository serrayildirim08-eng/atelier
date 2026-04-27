/**
 * Job-offer-letter rich-extraction second pass — runs after typed-extract.ts
 * classifies a PDF as doc_type='cover_letter' AND the filename matches
 * /(job[-_\s]?offer|offer[-_\s]?letter)/i. Single Haiku 4.5 call fills
 * JobOfferFactsSchema, which the aggregator uses for the
 * salary_below_benchmark and cv_title_vs_offer_drift gates.
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import { JobOfferFactsSchema, type JobOfferFacts } from './job-offer.schema';

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

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document extraction on a Petitioner-issued job offer letter for an E-2 Treaty Investor employee filing (Subtype 3 executive/supervisory or Subtype 4 essential-skills employee). The aggregator uses your output to gate (a) the salary against an industry benchmark and (b) the title against the Beneficiary's CV.

Extract the following fields per the JobOfferFacts schema. EVERY field carries the {value, source_page, source_quote, confidence} provenance wrapper.

Field-specific guidance:

- petitioner_legal_name: full legal name of the US Petitioner LLC / Corp making the offer.
- petitioner_ein_last4: ONLY the last 4 digits of the FEIN if printed on letterhead. Do not capture the full EIN. value=null if not present.
- position_title: as printed on the offer.
- classification_basis: 'specialized_knowledge' for Subtype-4 essential-skills employees ("specialist", "engineer", "domain expert", "highly skilled"); 'executive_supervisory' for Subtype-3 (President, Director, VP, Manager); 'other' if uncertain.
- proposed_start_date / proposed_end_date: ISO YYYY-MM-DD. Many offers state "for an initial period of two years" — compute end_date from start_date + duration if both are present in the source.
- annual_salary_amount + annual_salary_currency: extract verbatim. If salary is stated monthly, multiply by 12 and note "monthly × 12" in source_quote. ISO-4217 currency code.
- work_location: city + state for US sites; "remote" if explicitly remote.
- supervisor_name: who the Beneficiary will report to.
- duties_summary_verbatim: the duties paragraph(s) verbatim (truncate to ~500 chars if long).
- full_time_or_part_time: 'full_time' (40+ hrs/wk), 'part_time' (<40), 'unclear' if not stated.
- letterhead_present: true if the offer is on the Petitioner's letterhead (logo + address + contact info at top).
- signatory_name + signatory_title: the person who signed the offer.
- signed_date: ISO YYYY-MM-DD when the offer was signed by the Petitioner.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers.
- source_quote is a short verbatim phrase (5–25 words).
- confidence is in [0, 1]; do not emit values below 0.3.
- Currency: amounts as numbers with symbols/commas stripped; ISO-4217 captured separately.

Output: ONE JSON object matching JobOfferFactsSchema. No prose, no commentary, no markdown fences.`;

export interface JobOfferExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface JobOfferExtractResult {
  filename: string;
  pageCount: number;
  facts?: JobOfferFacts;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractJobOffer(
  input: JobOfferExtractInput,
): Promise<JobOfferExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the JobOfferFacts schema. No prose, no markdown fences.`;

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
        code: 'job_offer_extract_failed',
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

  const validated = JobOfferFactsSchema.safeParse(raw);
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
    facts: validated.data as JobOfferFacts,
  };
}
