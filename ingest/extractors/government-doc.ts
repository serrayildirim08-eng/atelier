/**
 * Government-document extractor — second pass after the typed-extract.ts
 * classifier. Runs a single Haiku 4.5 call dedicated to foreign
 * government-document extraction: classifies into one of five
 * government_doc_subtype variants and fills the matching variant of
 * GovernmentDocFactsSchema.
 *
 * Called from classifyAndExtractOnePdf when the first-pass classifier
 * returns source_of_funds (title deed) or other (vital records, court
 * orders that fall outside the thin doc_type taxonomy).
 *
 * Mirrors the contract extractor's contract: pre-extracted PDF text in,
 * GovernmentDocExtractResult out. Manual JSON parse + Zod validate (the
 * discriminated union exceeds Anthropic's structured-output cap).
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  GovernmentDocFactsSchema,
  type GovernmentDocFacts,
} from './government-doc.schema';

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

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document extraction on a foreign government-issued document attached to an E-2 Treaty Investor case folder. The extracted facts feed a typed memory the case-level aggregator will use to build the SOF chain (manual §5.4), trigger defensive paragraphs (manual §5.1.2 Tapu pattern), and verify dependent eligibility (manual §12).

Your job is two-fold:

1. CLASSIFY the document into exactly ONE government_doc_subtype:

   - title_deed — government-issued land-registry document. Real Akalan example: a Turkish "Tapu" issued by the Tapu Mudurlugu (Land Registry Office) showing the Beneficiary's ownership of real property OR a current deed showing the property has been transferred to a new owner. Other treaty-country equivalents (e.g., Italian "atto notarile di vendita registrato", French "acte de vente", UK Land Registry title) all classify here.

   - vital_record_birth — government-issued birth certificate establishing parent-child relationship. Required exhibit per manual §12.4 for each dependent child.

   - vital_record_marriage — government-issued marriage certificate establishing the spouse relationship. Required exhibit per manual §12.3.

   - court_order — judicial order: name change, custody, divorce, guardianship, etc. Used when dependent eligibility or name continuity must be evidenced.

   - other_government_doc — any other government-issued document that does not match the above (e.g., police record, tax-residency certificate, military service record). Use sparingly with a one-line summary.

2. EXTRACT the subtype-specific fields per the schema for the chosen government_doc_subtype. Only the schema variant matching your chosen government_doc_subtype is valid in your JSON output.

Subtype-specific guidance:

title_deed:
- registry_office: the issuing authority verbatim (e.g., "Tapu Mudurlugu", "Land Registry Office", "Catasto", "HM Land Registry"). Real Akalan canonical Turkish form: "Tapu Mudurlugu" (without diacritics is acceptable when the source is OCR'd).
- parcel_id: parcel / ada / pafta / lot identifier. Capture verbatim including any punctuation.
- property_type: e.g., "residential", "commercial", "agricultural", "mixed-use" — extract whatever the source uses.
- registration_date: the date this deed was registered with the registry (the OWNERSHIP-establishment date for the named owner). ISO YYYY-MM-DD.
- owner_name_native: the owner's name in the original script of the document (Turkish, Cyrillic, Arabic, etc.) verbatim.
- owner_name_ascii: ASCII transliteration. Apply Turkish "ş→s, ı→i, İ→I, ğ→g, ü→u, ö→o, ç→c" or equivalent rules per source script. The cover-letter draft is filing-bound and must use the ASCII form (manual §15).
- owner_country: country whose registry issued the deed.
- location: human-readable location of the property (city, district, neighborhood).
- transfer_date_if_any / new_owner_if_any / transfer_registry_number: ONLY populate these when the deed itself records a TRANSFER (i.e., the §5.1.2 current deed showing the property has been sold). For a §5.1.1 prior deed showing only original ownership, leave all three null. The aggregator distinguishes the prior vs. current deed by the presence of these fields.

vital_record_birth:
- All names captured in BOTH native script AND ASCII transliteration.
- date_of_birth in ISO YYYY-MM-DD.
- registry_office / registry_number / registry_date come from the registrar's seal or footer; capture verbatim.
- certified_translation_present: true if the PDF includes a certified English translation alongside the foreign-language certificate. translator_certification_present: true if the translator's signed certification statement (statement of competency, signature, date) is visible. Both must be true to satisfy manual §12 quality gate.

vital_record_marriage:
- Same name-handling rules as birth certificates. spouse_a / spouse_b are the two parties to the marriage; do not assume which is the Beneficiary — the aggregator cross-references against the passport extraction.

court_order:
- order_kind: e.g., "name_change", "divorce_decree", "custody", "guardianship", "other" — verbatim or lowercase normalized.
- parties: list of named parties to the matter.
- one_line_summary: a single sentence summarizing the operative ruling, in your own words but anchored to the source.

other_government_doc:
- one_line_summary captures what the document is and why it might matter to an immigration filing.
- reference_number: any visible identifying number on the document.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers in the input.
- source_quote is a short verbatim phrase (5–25 words) copied from the source that contains or directly evidences the value. For native-script names, the source_quote MUST be in the native script; for ASCII names, source_quote is the same native phrase that you transliterated.
- confidence is in [0, 1]: 1.0 = explicit and unambiguous; ~0.7 = clear in context; ~0.5 = ambiguous; do not emit values below 0.3.
- Dates: prefer ISO YYYY-MM-DD; if format ambiguous (DD.MM.YYYY common in Turkish docs vs MM/DD/YYYY), use the convention indicated by the document's language and locale; if still ambiguous, leave value=null.
- Booleans: only emit true/false when the source supports it; otherwise null.

Edge cases:
- A title deed accompanied by a certified English translation in the same PDF is still title_deed; do not classify as other_government_doc just because translation pages are present. Capture native names from the original-language pages.
- If a single PDF contains multiple distinct government documents (e.g., birth certificates for two children), classify by the PRIMARY document; the per-PDF classifier upstream typically already split these — if not, capture the dominant document and mention secondary content in source_quote on one_line_summary.
- If the document is partially OCR-garbled, extract what is legible; leave noisy fields null.

Output: ONE JSON object matching the government_doc_subtype-discriminated GovernmentDocFacts schema. No prose, no commentary, no markdown fences.`;

export interface GovernmentDocExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface GovernmentDocExtractResult {
  filename: string;
  pageCount: number;
  facts?: GovernmentDocFacts;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractGovernmentDoc(
  input: GovernmentDocExtractInput,
): Promise<GovernmentDocExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the government_doc_subtype-discriminated GovernmentDocFacts schema. No prose, no markdown fences.`;

  // The 5-variant union has ~50 nullable Field<> params across variants
  // — over Anthropic's structured-output union-param cap (16). Use
  // manual JSON parse + Zod validate, same pattern as ContractFactsSchema.
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
        code: 'government_doc_extract_failed',
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

  const validated = GovernmentDocFactsSchema.safeParse(raw);
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
    facts: validated.data as GovernmentDocFacts,
  };
}
