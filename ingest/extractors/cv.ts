/**
 * CV / résumé rich-extraction second pass — runs after typed-extract.ts
 * classifies a PDF as cv-flavored. Routing accepts doc_type='cv_or_resume'
 * (if the classifier ever emits it) OR the filename matches
 * /(\bcv\b|resume|özgeçmiş|ozgecmis|curriculum)/i. Single Haiku 4.5 call
 * fills CvFactsSchema.
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import { CvFactsSchema, type CvFacts } from './cv.schema';

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

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document extraction on a CV / résumé / özgeçmiş for an E-2 Treaty Investor case folder. The CV anchors the Beneficiary's specialized-knowledge / develop-and-direct narrative (manual §3.3.2 / §8.5).

Extract the following fields per the CvFacts schema. EVERY leaf field carries the {value, source_page, source_quote, confidence} provenance wrapper.

Field-specific guidance:

- full_name_ascii: ASCII transliteration suitable for filing-bound text. Apply Turkish ş→s, ı→i, İ→I, ğ→g, ü→u, ö→o, ç→c.
- full_name_native: name in the original script with all diacritics preserved.
- current_position_title: title of the most-recent role (the role marked "Present" or whose end_date is the latest).
- current_employer: the employer of that most-recent role.
- total_experience_years: total professional years across all roles. If not explicitly stated, compute from the earliest role start to the latest role end (or "today" for current roles).
- roles[]: one entry per professional role IN REVERSE CHRONOLOGICAL ORDER. Each carries {employer, position_title, start_date (YYYY-MM-DD or YYYY-MM if month-only), end_date (or null if current), location, key_responsibilities_summary (truncate to ~300 chars)}.
- education[]: degree-bearing credentials. completion_year as a 4-digit integer.
- certifications[]: industry / professional certifications. validity_status: 'active' if no expiration is shown or expiration is in the future; 'expired' if expiration has passed; 'pending' if the source says exam-pending; 'unknown' otherwise.
- languages[]: each {language, proficiency_level} where proficiency is one of native | fluent | professional | conversational | basic.
- specialized_skills_keywords[]: a flat list of skills / domains / technologies relevant to the position (e.g., "PLC programming", "ASME Section VIII", "AWS architecture", "molecular gastronomy"). Each is its own provenanced Field.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers.
- source_quote is a short verbatim phrase (5–25 words).
- confidence is in [0, 1]; do not emit values below 0.3.
- Account numbers, full SSNs, passport numbers: NEVER capture from CV's contact section.

Edge cases:
- Some CVs list multiple concurrent roles (e.g., "Director, Acme Corp + Adjunct Professor, Foo University"). Capture each as its own roles[] entry.
- If a CV has a "Selected Publications" or "Patents" section, do NOT capture those here — they belong to the EB-1A pipeline and are out of scope for this extractor.

Output: ONE JSON object matching CvFactsSchema. No prose, no commentary, no markdown fences.`;

export interface CvExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface CvExtractResult {
  filename: string;
  pageCount: number;
  facts?: CvFacts;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractCv(input: CvExtractInput): Promise<CvExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the CvFacts schema. No prose, no markdown fences.`;

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
      pageCount: input.pageCount,
      error: {
        code: 'cv_extract_failed',
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

  const validated = CvFactsSchema.safeParse(raw);
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
    facts: validated.data as CvFacts,
  };
}
