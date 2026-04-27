/**
 * Passport rich-extraction second pass — runs after typed-extract.ts
 * classifies a PDF as doc_type='passport'. A single Haiku 4.5 call fills
 * PassportFactsRichSchema, which the aggregator uses for the manual §3.1
 * passport-expires-soon gate (≥ 6 months validity at filing) and for
 * downstream cover-letter ASCII transliteration.
 *
 * Mirrors the contract extractor pattern: pre-extracted PDF text in,
 * PassportExtractResult out. Manual JSON parse + Zod validate.
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  PassportFactsRichSchema,
  type PassportFactsRich,
} from './passport.schema';

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

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document passport bio-page extraction on a single PDF from an E-2 Treaty Investor case folder. The extracted facts feed a typed memory the case-level aggregator will use to build the cover letter and gate the filing (manual §3.1 passport ≥ 6 months validity).

Extract the following fields per the PassportFactsRich schema. EVERY field carries the {value, source_page, source_quote, confidence} provenance wrapper.

Field-specific guidance:

- full_name_native: the holder's name in the ORIGINAL script of the bio page, with all diacritics preserved (e.g., Turkish "Salih KAÇAR" — keep the ç). For passports whose primary script is Latin with diacritics, this is the printed surname + given names. For non-Latin primary scripts (Arabic, Cyrillic, etc.), capture the native script and put the printed Latin form in full_name_ascii.

- full_name_ascii: ASCII transliteration suitable for USCIS filing-bound text (manual §15). Apply: Turkish ş→s, ı→i, İ→I, ğ→g, ü→u, ö→o, ç→c, Â→A, etc. For Arabic/Cyrillic, use the Latin transliteration that the passport's MRZ already prints (the MRZ is the canonical ASCII source). The cover-letter drafter uses ONLY this field for filing text.

- sex: 'M' / 'F' / 'X' as printed (most passports use M/F; ICAO 9303 also recognizes X).

- date_of_birth, date_of_issue, date_of_expiration: ISO YYYY-MM-DD. If the format is ambiguous (DD/MM/YY common on European passports vs MM/DD/YY), use the convention indicated by the issuing country and the date plausibility (e.g., a "13" must be the day). If still ambiguous, leave value=null.

- place_of_birth: city + country if both visible; just city if only the city is shown. Verbatim from the source.

- nationality: ISO country name in English (e.g., "Turkey" not "TUR" or "Türkiye"). The MRZ holds the ISO-3 country code which you can use to disambiguate.

- country_of_issue: country whose authority issued the passport. For most passports nationality == country_of_issue; for refugee documents or stateless persons they may differ.

- passport_number: capture in full (passport numbers are not PII to redact in this pipeline; SSN / IBAN / routing numbers ARE — but you do not see those on a passport).

- mrz_present: true if the two-line machine-readable zone is visible at the bottom of the bio page; false if obscured / cropped / not present.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers in the input.
- source_quote is a short verbatim phrase (5–25 words) copied from the source. For native-script names, the quote should be in the native script (it is the same text you transliterated for full_name_ascii).
- confidence is in [0, 1]: 1.0 = explicit and unambiguous; ~0.7 = clear in context; ~0.5 = ambiguous; do not emit values below 0.3.
- If a single PDF contains multiple passports (e.g., the principal + a dependent), classify by the PRIMARY bio page and note the secondary in source_quote on full_name_native.

Output: ONE JSON object matching PassportFactsRichSchema. No prose, no commentary, no markdown fences.`;

export interface PassportExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface PassportExtractResult {
  filename: string;
  pageCount: number;
  facts?: PassportFactsRich;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractPassport(
  input: PassportExtractInput,
): Promise<PassportExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the PassportFactsRich schema. No prose, no markdown fences.`;

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
        code: 'passport_extract_failed',
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

  const validated = PassportFactsRichSchema.safeParse(raw);
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
    facts: validated.data as PassportFactsRich,
  };
}
