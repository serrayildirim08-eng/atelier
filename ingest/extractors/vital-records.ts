/**
 * Vital-records rich-extraction second pass — runs alongside the
 * government-doc extractor when typed-extract.ts classifies a PDF as
 * doc_type='other' or 'source_of_funds'. Both extractors may fire on the
 * same vital-records PDF: government-doc captures the broader
 * issuing-authority structure; this one drills into translation
 * certification (manual §12 quality gate).
 *
 * Mirrors the contract extractor pattern: pre-extracted PDF text in,
 * VitalRecordsExtractResult out. Manual JSON parse + Zod validate.
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  VitalRecordsFactsSchema,
  type VitalRecordsFacts,
} from './vital-records.schema';

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

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document extraction on a foreign vital record (birth certificate, marriage certificate, or divorce decree) attached to an E-2 Treaty Investor case folder. The extracted facts feed a typed memory the case-level aggregator will use to verify dependent eligibility (manual §12) and to gate the filing against the translator-certification requirement (manual §12.3).

Your job is two-fold:

1. CLASSIFY the document into exactly ONE vital_record_subtype:

   - birth_certificate — establishes parent-child relationship (required per manual §12.4 for each dependent child).

   - marriage_certificate — establishes spousal relationship (required per manual §12.3 for the dependent spouse).

   - divorce_decree — terminates a prior marriage. Used when the dependent spouse's eligibility depends on prior marriage(s) having been dissolved.

2. EXTRACT the subtype-specific fields per the schema for the chosen vital_record_subtype.

Subtype-specific guidance:

birth_certificate:
- child_name_native: child's name in the original script of the certificate, with all diacritics preserved.
- child_name_ascii: ASCII transliteration suitable for filing-bound text (manual §15). Apply Turkish ş→s, ı→i, İ→I, ğ→g, ü→u, ö→o, ç→c (or equivalent rules per source script). The cover-letter drafter uses ONLY this field for filing text.
- dob: ISO YYYY-MM-DD.
- place_of_birth: city + country if both visible.
- parent1_name / parent2_name: parents as named on the certificate. Most certificates print "Father" first then "Mother"; capture whichever order the document uses.
- registry_office: issuing authority verbatim (e.g., "Nüfus Müdürlüğü", "Civil Registry Office", "Standesamt").
- registration_date: ISO YYYY-MM-DD when the certificate was registered with the authority.

marriage_certificate:
- spouse1_name / spouse2_name: parties to the marriage. Do not assume which spouse is the Beneficiary — the aggregator cross-references against the passport extraction.
- marriage_date: ISO YYYY-MM-DD.
- marriage_place: city + country if both visible.
- registry: the issuing authority's name verbatim.

divorce_decree:
- party1_name / party2_name: parties to the divorce.
- divorce_date: ISO YYYY-MM-DD when the decree was finalized.
- court_name: name of the court that issued the decree.
- jurisdiction: country / state / province.
- case_number: docket / case number verbatim.

Translation-certification fields (ALL THREE VARIANTS):

- certified_translation_present: true if the PDF contains BOTH the original-language certificate AND a typed/printed English translation alongside it. false if no English translation is present at all. If only some pages are translated, set value=false (a partial translation is treated as no certified translation for the gate).

- translator_name: name of the translator who produced the English version, as printed on the translator's signed certification statement. Verbatim. value=null when the certification statement is missing or the name is illegible.

- translator_certification_date: ISO YYYY-MM-DD as printed on the translator's signed certification block. value=null when missing.

The translator's "certification" is a specific block of text ON the translation that says something like: "I, [Name], certify that I am competent to translate from [language] to English, and that the foregoing translation is true and accurate to the best of my ability." The block must include a signature, the translator's name, and a date. Without all three, certified_translation_present should be false.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers in the input.
- source_quote is a short verbatim phrase (5–25 words) copied from the source. For native-script names, the source_quote is in the native script.
- confidence is in [0, 1]: 1.0 = explicit and unambiguous; ~0.7 = clear in context; ~0.5 = ambiguous; do not emit values below 0.3.
- Dates: prefer ISO YYYY-MM-DD; if format ambiguous (DD.MM.YYYY common in Turkish docs vs MM/DD/YYYY), use the convention indicated by the document's locale; if still ambiguous, leave value=null.
- Booleans: only emit true/false when the source supports it; otherwise null.

Edge cases:
- A PDF that contains BOTH a foreign-language certificate AND its certified English translation is one document — capture native names from the original-language pages and capture certified_translation_present=true. The translator block typically lives on the last page of the translation.
- If a single PDF contains multiple distinct vital records (e.g., birth certificates for two children), classify by the PRIMARY document and note secondary content briefly.
- If the document is partially OCR-garbled, extract what is legible; leave noisy fields null.

Output: ONE JSON object matching the vital_record_subtype-discriminated VitalRecordsFacts schema. No prose, no commentary, no markdown fences.`;

export interface VitalRecordsExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface VitalRecordsExtractResult {
  filename: string;
  pageCount: number;
  facts?: VitalRecordsFacts;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractVitalRecords(
  input: VitalRecordsExtractInput,
): Promise<VitalRecordsExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the vital_record_subtype-discriminated VitalRecordsFacts schema. No prose, no markdown fences.`;

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
        code: 'vital_records_extract_failed',
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

  const validated = VitalRecordsFactsSchema.safeParse(raw);
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
    facts: validated.data as VitalRecordsFacts,
  };
}
