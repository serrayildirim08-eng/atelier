/**
 * Foreign-corporate extractor — second pass after the typed-extract.ts
 * classifier.
 *
 * Runs a single Haiku 4.5 call dedicated to foreign-jurisdiction corporate
 * documents (Esas Sözleşme, board resolutions, shareholder registers,
 * audited financials, foreign tax certificates). Called from
 * classifyAndExtractOnePdf when the first-pass classifier returns an
 * ownership/financial-flavored doc_type AND the filename matches one of
 * the foreign-document patterns (see typed-extract.ts router).
 *
 * Manual JSON parse + Zod validate (the discriminated union has too many
 * nullable Field<> params for Anthropic's structured-output cap of 16).
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  ForeignCorporateFactsSchema,
  type ForeignCorporateFacts,
} from './foreign-corporate.schema';

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

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document foreign-corporate extraction on a single PDF from an E-2 Treaty Investor case folder. The document is from a treaty-country jurisdiction (Turkey, Germany, etc.) and feeds the typed memory the case-level aggregator uses to evaluate manual §3 (treaty nationality) and §6 (substantiality cross-references).

Your job is two-fold:

1. CLASSIFY the document into exactly ONE foreign_doc_subtype:

   - foreign_articles — formation document for a foreign entity (Turkish "Esas Sözleşme" / "Ana Sözleşme", German "Gesellschaftsvertrag", equivalent). States the entity name, country, registry id, organizers / founders with ownership percentages, and the registered capital amount + currency. Recognize by the foreign-language equivalents of "Articles of Association", "Memorandum and Articles", or the explicit foreign legal-form term.
   - board_resolution — minutes of a board / management committee meeting authorizing a specific corporate act, especially the parent's investment in the US subsidiary. Turkish: "yönetim kurulu kararı". Recognize by meeting-date header, resolution language ("RESOLVED that…"), signatory block.
   - shareholder_register — current cap table / pay sheet of the foreign entity's owners with ownership percentages and (where available) nationalities. Turkish: "ortaklar pay defteri". Recognize by tabulated rows of shareholder names + percentages + share counts.
   - audited_financials — multi-period financial statements signed off by an external auditor. Recognize by auditor signature block, "Independent Auditor's Report" / "Bağımsız Denetçi Raporu", opinion paragraph.
   - foreign_tax_certificate — government-issued tax registration / status certificate. Turkish: "vergi levhası". Recognize by tax-authority letterhead, tax registration number, tax year.
   - other_foreign_corporate — last-resort. Use when the document is clearly a foreign corporate record but does not fit the above (e.g., trade-registry gazette extract, foreign vendor license). Use sparingly.

2. EXTRACT the subtype-specific fields per the schema for the chosen subtype. Only the schema variant matching your chosen subtype is valid in your JSON output. Common fields appear on every variant:

   - entity_legal_name_native: the entity's name in the original script ("Pomega Enerji Anonim Şirketi"). Capture as it appears.
   - entity_legal_name_ascii: ASCII transliteration per manual §15: ç→c, ğ→g, ı→i, İ→i, ö→o, ş→s, ü→u (and uppercase counterparts). Example: "Pomega Enerji Anonim Sirketi".
   - entity_country: country of registration.
   - entity_type: foreign legal-form term as stated ("Anonim Şirketi", "Limited Şirketi", "GmbH", "S.A.").
   - registry_number_or_id: the entity's trade-registry number.
   - filing_date: the date this document was filed/issued.

Subtype-specific guidance:

foreign_articles:
- organizers: one entry per founder/organizer named in the document. Capture name + role (e.g., "Founder", "Director", "Member") + ownership_percent. Use ASCII transliteration on names.
- registered_capital_amount + registered_capital_currency: capture as stated. ISO-4217 currency code (TRY, EUR, USD).

board_resolution:
- meeting_date: the date the meeting was held.
- resolution_text_verbatim: a short verbatim phrase (5–25 words) capturing the operative resolution. Examples: "RESOLVED that the Company invest USD 95,600 in Pomega Energy LLC", "Approve subscription of 1,000 shares of Pomega Energy LLC".
- signatories: one entry per board member who signed. Capture name + title (e.g., "Chairman", "CFO").
- authorizes_us_investment: true if the resolution's operative text explicitly authorizes investment, capital contribution, or share subscription in a US entity. False if the resolution is unrelated. Null if unclear.
- authorized_amount_usd: the dollar amount the resolution authorizes for the US investment, in USD. If stated in the source currency, convert at the rate in the document (and note in source_quote); if no rate, leave value=null.

shareholder_register:
- as_of_date: the date the register reflects (often "as of" or printed at the top).
- shareholders: one entry per shareholder. Capture name + nationality + ownership_percent + share_class (e.g., "Class A", "Common", "Preferred"). Nationality is critical for the manual §3.2 treaty-ownership gate — populate it from the source whenever stated.
- total_shares_issued: total share count across the register.
- treaty_national_ownership_percent: SUM of ownership_percent across every shareholder whose nationality matches the qualifying treaty country (Turkey for an Akalan Subtype 2/3/4 case). Compute from the shareholders[] rows. If nationalities are not stated, leave value=null and emit a low confidence — the aggregator's §3.2 gate will see the null and surface a data-quality conflict instead of a substantive failure.

audited_financials:
- period_start / period_end: the fiscal-period boundaries.
- total_assets / total_revenue / net_income: figures from the audited statements. Capture in the source currency; ISO-4217 currency code separate.
- auditor_name: the audit firm name (and individual signatory if shown).
- opinion_type: 'unqualified' (standard clean opinion), 'qualified' (specific carve-outs), 'adverse' (financials misstated), 'disclaimer' (auditor declines to opine). Read the opinion paragraph carefully.

foreign_tax_certificate:
- tax_year: the year(s) the certificate covers.
- certificate_kind: short verbatim phrase (e.g., "vergi levhası", "tax registration", "VAT certificate").
- issuing_authority: the tax-authority name.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers in the input.
- source_quote is a short verbatim phrase (5–25 words) copied from the source that contains or directly evidences the value. For native-script names, capture in the original script — DO NOT ASCII-fold the source_quote.
- confidence is in [0, 1]: 1.0 = explicit and unambiguous; ~0.7 = clear in context; ~0.5 = ambiguous; do not emit values below 0.3.
- Currency: amounts as numbers with symbols/commas stripped; ISO-4217 currency code captured separately. NEVER convert to USD unless the source itself states an exchange rate.
- Dates: prefer ISO YYYY-MM-DD; if format ambiguous (MM/DD vs DD/MM), leave value=null.

Edge cases:
- A foreign-language packet that bundles articles + a board resolution + a tax certificate: classify by the document's PRIMARY purpose. Usually the articles dominate; secondary content can be referenced in source_quote on the relevant field.
- An untranslated foreign document where you cannot read the operative text: return foreign_doc_subtype='other_foreign_corporate' with a one_line_summary noting the language and the inability to extract.

Output: ONE JSON object matching the foreign_doc_subtype-discriminated ForeignCorporateFacts schema. No prose, no commentary, no markdown fences.`;

export interface ForeignCorporateExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface ForeignCorporateExtractResult {
  filename: string;
  pageCount: number;
  facts?: ForeignCorporateFacts;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractForeignCorporate(
  input: ForeignCorporateExtractInput,
): Promise<ForeignCorporateExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the foreign_doc_subtype-discriminated ForeignCorporateFacts schema. No prose, no markdown fences.`;

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
        code: 'foreign_corporate_extract_failed',
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

  const validated = ForeignCorporateFactsSchema.safeParse(raw);
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
    facts: validated.data as ForeignCorporateFacts,
  };
}
