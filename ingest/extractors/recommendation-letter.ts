/**
 * Recommendation-letter rich-extraction second pass — runs after
 * typed-extract.ts classifies a PDF as doc_type='other' AND filename
 * matches /(recommendation|reference|letter[-_\s]?of[-_\s]?rec|tavsiye)/i.
 * Single Haiku 4.5 call fills RecommendationLetterFactsSchema.
 *
 * The aggregator uses letter_kind for the personal_reference_letter gate
 * (manual §3.3.6: prior-employer letters are required; personal letters
 * are weak evidence at severity 3).
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  RecommendationLetterFactsSchema,
  type RecommendationLetterFacts,
} from './recommendation-letter.schema';

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

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document extraction on a third-party recommendation / reference letter for an E-2 Treaty Investor employee filing (Subtype 3 or 4). The aggregator uses letter_kind to gate evidentiary weight (manual §3.3.6: prior-employer letters carry the most weight; personal letters are weak evidence and trigger severity-3 conflict).

Extract the following fields per the RecommendationLetterFacts schema. EVERY leaf field carries the {value, source_page, source_quote, confidence} provenance wrapper.

Field-specific guidance:

- letter_kind: classify the author's relationship as one of:
  * 'prior_employer' — author is a former or current direct supervisor / executive at a company where the Beneficiary was employed. Strongest evidentiary weight.
  * 'academic' — author is a faculty member, advisor, or academic peer (department chair, thesis committee, etc.).
  * 'personal' — author is a friend, neighbor, family acquaintance, or non-employer reference. Weak evidence; the aggregator will log severity 3 conflict_register entry on this.
  * 'unclear' — relationship cannot be determined from the letter.

- author_name: full name as printed on the signature block.
- author_title: e.g., "Director of Engineering", "Professor of Mechanical Engineering", "CEO".
- author_employer: the institution / company the author represents.
- author_relationship_to_beneficiary: a short verbatim phrase from the letter describing how the author knows the Beneficiary (e.g., "served as direct manager from 2018-2023", "thesis advisor at Boğaziçi University", "longtime family friend").

- beneficiary_name_ascii: the Beneficiary's name in ASCII (apply transliteration).

- claimed_period_of_observation_start / claimed_period_of_observation_end: ISO YYYY-MM-DD. The dates between which the author observed the Beneficiary's work / qualifications. If the letter says "since 2019, ongoing", set start and leave end null.

- specialized_expertise_described_verbatim: the strongest 1–3 sentences from the letter describing the Beneficiary's specialized knowledge / executive performance, copied verbatim. The drafter inserts this into the cover letter italicized.

- projects_or_products_named[]: a flat array of specific projects, products, clients, or contracts named in the letter. Each is its own provenanced Field. Empty array if none named (a sign of generic letter — weak evidence).

- contact_info_present: true if the letter includes a phone number AND email AND business address for the author. false otherwise. USCIS adjudicators give more weight to letters whose authors are reachable.

- letterhead_present: true if the letter is on official company / institution letterhead (logo + address + contact info).

- signature_present: true if a wet or e-signature is visible above the typed name.

- signed_date: ISO YYYY-MM-DD when the letter was signed.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers.
- source_quote is a short verbatim phrase (5–25 words). For specialized_expertise_described_verbatim the source_quote IS the value (truncated to 25 words if needed; the value carries the full quote).
- confidence is in [0, 1]; do not emit values below 0.3.

Edge cases:
- A letter on personal stationery from a former CEO of a former employer: classify as 'prior_employer' (the relationship matters, not the stationery). Set letterhead_present=false.
- A letter from a friend who happens to be a senior executive at an unrelated company: classify as 'personal' if the relationship to the Beneficiary is friendship rather than employment.

Output: ONE JSON object matching RecommendationLetterFactsSchema. No prose, no commentary, no markdown fences.`;

export interface RecommendationLetterExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface RecommendationLetterExtractResult {
  filename: string;
  pageCount: number;
  facts?: RecommendationLetterFacts;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractRecommendationLetter(
  input: RecommendationLetterExtractInput,
): Promise<RecommendationLetterExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the RecommendationLetterFacts schema. No prose, no markdown fences.`;

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
        code: 'recommendation_letter_extract_failed',
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

  const validated = RecommendationLetterFactsSchema.safeParse(raw);
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
    facts: validated.data as RecommendationLetterFacts,
  };
}
