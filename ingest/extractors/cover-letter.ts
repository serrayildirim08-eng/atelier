/**
 * Cover-letter rich-extraction second pass — runs after typed-extract.ts
 * classifies a PDF as doc_type='cover_letter'. Pulls the narrative
 * assertions the thin classifier does not capture: the operational-since
 * date, the claimed business model, an explicit NAICS if cited, and (for
 * Subtype 3 / 4) the principal-treaty-investor identity declarative.
 *
 * Single Haiku 4.5 call fills CoverLetterRichFactsSchema. The aggregator
 * (Phase-4 enrichment) writes these into enterprise.fully_operational_since_date
 * and enterprise.claimed_business_model so downstream gates leave
 * 'data_incomplete'.
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  CoverLetterRichFactsSchema,
  type CoverLetterRichFacts,
} from './cover-letter.schema';

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

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document extraction on an E-2 cover letter / petition memorandum (the firm's letter-of-counsel addressed to USCIS or a US consulate). The document was already classified as doc_type='cover_letter'; this second pass pulls the narrative claims the thin classifier does not capture. Your output drives the b2_status_violation_signal gate and the external_evidence_contradiction_risk gate.

Extract the following four fields per CoverLetterRichFactsSchema. EVERY field carries the {value, source_page, source_quote, confidence} provenance wrapper.

Field-specific guidance:

- fully_operational_since_date: ISO 8601 (YYYY-MM-DD or YYYY-MM if month-only). The case theory's claim about when the enterprise BEGAN day-to-day commercial activity. Look for prose like:
  · "the enterprise has been fully operational since [date]"
  · "the company began operations on [date]"
  · "active commercial activity since [date]"
  · "Petitioner has been actively conducting business since [date]"
  · Turkish: "şirket [tarih] tarihinden beri faaliyet göstermektedir"
  · Turkish: "[tarih] tarihinden itibaren ticari faaliyetlerine başlamıştır"
  Prefer EXPLICIT operational-since assertions over formation-date / incorporation-date. If only a formation date is stated and no separate operational-since claim, leave value=null.
  Confidence: 0.9 when a verbatim "operational since [date]" / "fully operational since [date]" / "actively doing business since [date]" sentence is found; 0.6 when the operational-since claim is inferred from context (e.g., "Petitioner began serving customers in [date]"); 0.4 when only a heuristic-fuzzy match (e.g., revenue-generation timeline). Never invent.

- claimed_business_model: short phrase ≤ 200 chars describing what the petition asserts the enterprise does. Look for the first paragraph after a section heading like:
  · "OWNERSHIP STRUCTURE AND CONTROL"
  · "BUSINESS DESCRIPTION"
  · "OVERVIEW OF THE ENTERPRISE"
  · "THE PETITIONER" / "ABOUT THE PETITIONER"
  · Roman-numeral "I." / "II." / "III." section headings naming the industry
  Pick the most descriptive single sentence or compressed phrase that names the industry / activity (e.g., "Turkish-American restaurant specializing in Mediterranean cuisine", "B2B e-commerce platform for medium-voltage electrical equipment", "International trading company focused on Turkish textile exports"). Truncate at 200 chars. Confidence 0.9 verbatim, 0.6 inferred, 0.4 heuristic-fuzzy.

- claimed_industry_naics: 6-digit NAICS code if the cover letter cites one explicitly (e.g., "NAICS code 722511 — Full-Service Restaurants"). Most cover letters do NOT cite NAICS — leave value=null in that case. Confidence 0.9 verbatim, never below 0.7 (NAICS codes are unambiguous strings).

- principal_treaty_investor_identity: anti-ambiguity declarative naming the principal treaty investor, used by Subtype-3 and Subtype-4 cases where the investor is a corporation or family entity rather than the Beneficiary as a natural person. Look for verbatim sentences like:
  · "The principal treaty investor in this petition is [Corp Name]..."
  · "[Corp Name] is the principal treaty investor pursuant to 9 FAM 402.9-4(B)..."
  · "The treaty national investor is [Person] / [Corp Name]..."
  Capture the entity / person name. Subtype-1 / Subtype-2 individual-investor petitions typically OMIT this declarative — leave value=null. Confidence 0.9 verbatim, 0.6 inferred, 0.4 heuristic.

- co_petitioner_relationships: optional array of {full_name, relationship} pairs naming each non-investor person whose status is tied to this petition (spouse / child / sibling / parent for derivative beneficiaries, co_investor / business_partner for joint-investor structures). Pull from verbatim phrases in the cover letter prose:
  · "the Beneficiary's spouse, [Name]" → relationship='spouse'
  · "the Beneficiary's daughter [Name]" / "the Beneficiary's son [Name]" / "the Beneficiary's child" → 'child'
  · "[Name], a co-investor in the enterprise" / "[Name] also invested" → 'co_investor'
  · "[Name], the Beneficiary's brother / sister" → 'sibling'
  · "[Name], the Beneficiary's father / mother / parent" → 'parent'
  · "[Name], business partner of the Beneficiary" / "[Name] and Beneficiary as joint members" (no investment language) → 'business_partner'
  When the relationship is referenced but the marker is unclear, use 'unknown'. Empty array [] when no co-petitioner relationships are stated. Each entry's full_name and relationship Field<T> carries the same provenance rules as the other fields. Do NOT enumerate every member of the petitioner LLC here — only persons whose relationship to the Beneficiary is named in cover-letter prose.

- prior_passport_renewal_footnote: defensive footnote pattern the firm uses when the Beneficiary's passport was renewed during the case (B&B International + Splash Sub1 both used this). Detect the prose pattern: "the Beneficiary's prior passport, [old number], was renewed on [date] and the current passport, [new number], is appended hereto" / "Beneficiary's passport (No. [old]) was replaced by [new] in [date]" / Turkish "Beneficiary'nin önceki pasaportu ([old]) yenilenmiş olup, mevcut pasaportu ([new]) eklenmiştir". When detected, return {paragraph_text: <the verbatim explanatory paragraph, ≤ 500 chars>, prior_passport_number: <old #>, current_passport_number: <new #>}. Otherwise return null. Both passport numbers must be present in the prose — leave null if only one is named.

- five_year_business_horizon: when the cover letter narrative summarizes the petitioner's 5-year revenue / staffing trajectory inline (typically in a "Substantiality" / "More than Marginal" / "Five-Year Plan" section), capture {year_1_revenue_usd, year_3_revenue_usd, year_5_revenue_usd, year_5_employee_count}. All four are numbers (no comma, no $ sign) or null when not stated. Look for prose like "In Year 1, projected revenue is $250,000, growing to $1.5M by Year 3 and $4M by Year 5, with 18 employees on payroll by year-end Year 5" / "By the fifth year of operations, the Petitioner anticipates [N] U.S. workers and [$X] in annual revenue". Do NOT pull from the business plan attachment — only from the cover letter's own narrative claims (the gate compares the two sources downstream). When NO horizon is summarized in the cover letter, return null.

- develop_and_direct_role_grant: when the cover letter cites a verbatim role-grant document for the Beneficiary's authority (Operating Agreement clause, Board Resolution, employment agreement section), capture {role_title, granting_document_ref, authority_scope[]}. role_title is the granted position ("President", "Chief Executive Officer", "Managing Member"). granting_document_ref is the document the cover letter references ("Section 5.2 of the Operating Agreement", "Board Resolution dated 2024-02-01", "Employment Agreement § 3"). authority_scope is a closed list of any of: "contract_signing" / "banking_authority" / "hire_fire" / "day_to_day_operations" / "strategic_planning". Include each scope item ONLY when the cover letter prose explicitly grants it (e.g., "shall have authority to sign contracts on behalf of the Petitioner" → "contract_signing"; "with sole signature authority over Petitioner bank accounts" → "banking_authority"; "shall hire, supervise, and terminate U.S. workers" → "hire_fire"; "responsible for day-to-day operations" / "manages day-to-day affairs" → "day_to_day_operations"; "shall set strategic direction" / "approves the annual business plan" → "strategic_planning"). When the cover letter grants ONLY a title with no scope items enumerated, return {role_title, granting_document_ref, authority_scope: []} so the downstream reviewer can flag the E5 vulnerability. When no role grant is recited, return null.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers in the input.
- source_quote is a short verbatim phrase (5–25 words) copied from the source that contains or directly evidences the value.
- confidence is in [0, 1]: per the per-field guidance above; do not emit values below 0.3.
- Dates: prefer ISO YYYY-MM-DD; if only month is stated, YYYY-MM is acceptable; if format ambiguous (MM/DD vs DD/MM), leave value=null.

Edge cases:
- Some cover letters cite BOTH a formation date AND a separate operational-since date (e.g., "The Petitioner was incorporated on 2022-06-01 and has been fully operational since 2022-08-19"). Capture the OPERATIONAL date, not the formation date.
- Some cover letters claim retroactive operational status from a date BEFORE the Beneficiary's status authorization — this is the Flatturbo failure pattern. Do NOT flag here; just capture the claimed date as-stated. The aggregator's b2_status_violation_signal gate compares against the I-94 / status_doc separately.
- If the cover letter is a renewal / extension and references "continued operations since [original E-2 grant]", capture that date with confidence ~0.6 (it's an inferred operational-since).

Output: ONE JSON object matching CoverLetterRichFactsSchema. No prose, no commentary, no markdown fences.`;

export interface CoverLetterExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface CoverLetterExtractResult {
  filename: string;
  pageCount: number;
  facts?: CoverLetterRichFacts;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractCoverLetter(
  input: CoverLetterExtractInput,
): Promise<CoverLetterExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the CoverLetterRichFacts schema. No prose, no markdown fences.`;

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
        code: 'cover_letter_extract_failed',
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

  const validated = CoverLetterRichFactsSchema.safeParse(raw);
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
    facts: validated.data as CoverLetterRichFacts,
  };
}
