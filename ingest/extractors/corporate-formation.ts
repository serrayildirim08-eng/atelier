/**
 * Corporate-formation extractor — second pass after the typed-extract.ts
 * classifier.
 *
 * Runs a single Haiku 4.5 call dedicated to corporate-formation extraction:
 * classifies into one of seven formation_doc_subtypes and fills the matching
 * variant of CorporateFormationFactsSchema. Called from
 * classifyAndExtractOnePdf when the first-pass classifier returns
 * doc_type='formation_doc'.
 *
 * Manual JSON parse + Zod validate (the discriminated union has too many
 * nullable Field<> params for Anthropic's structured-output cap of 16).
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  CorporateFormationFactsSchema,
  type CorporateFormationFacts,
} from './corporate-formation.schema';

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

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document corporate-formation extraction on a single PDF from an E-2 Treaty Investor case folder. Your output goes into the typed memory the case-level aggregator will reason over later (manual §4 ownership history, §6 substantiality cross-references).

Your job is two-fold:

1. CLASSIFY the document into exactly ONE formation_doc_subtype:

   - articles_of_organization — formation document for an LLC. Filed with a US state. States the entity name, registered agent, organizer, and (often) an initial member list. Recognize by "Articles of Organization", "Limited Liability Company", state-level filing stamp.
   - articles_of_incorporation — formation document for a Corporation. States the corporate name, registered agent, incorporator, authorized share counts, and (often) an initial board / shareholder list. Recognize by "Articles of Incorporation", "Certificate of Incorporation".
   - operating_agreement_amendment — modifies an existing LLC operating agreement after formation. States amendment number, effective date, and the post-amendment member list with capital contributions. Recognize by "Amendment to Operating Agreement", "First Amendment", explicit prior-vs-new member list.
   - ein_assignment_letter — IRS-issued letter (CP 575) confirming the entity's federal EIN. Recognize by "Internal Revenue Service", "Employer Identification Number", "CP 575" header.
   - certificate_of_good_standing — Secretary of State or equivalent certificate confirming the entity is in good standing as of an issued date. Recognize by "Certificate of Good Standing", "Certificate of Existence", state seal.
   - state_registration — annual report, foreign qualification, name change, or amendment of articles filed with a state. Recognize by state-form names ("Annual Report", "Foreign Qualification", "Statement of Information").
   - other_formation — does not fit the above (e.g., bylaws-only document, mere LLC operating agreement WITHOUT amendment, board minutes). Use sparingly.

2. EXTRACT the subtype-specific fields per the schema for the chosen subtype. Only the schema variant matching your chosen subtype is valid in your JSON output. Common fields (entity_legal_name, entity_state_or_country, entity_type, filing_date_or_effective_date, registered_agent_name) appear on every variant — populate them whenever the source supports a value.

Subtype-specific guidance:

articles_of_organization / articles_of_incorporation:
- registrant_name: the name listed as the filer / requester on the state's filing form.
- members_or_shareholders: one entry per member (LLC) or initial shareholder (Corp). Capture name + ownership_percent + role (e.g., "Manager", "Member", "Director", "President"). If percentages are not stated, leave that field null per row.
- organizer_or_incorporator_name: the natural person who signed the formation document on behalf of the registrant.
- signed_date: the date next to the organizer's signature.
- principal_office_address: the entity's principal office / business / mailing address as listed on the Articles. Capture the full multi-line address as a single string with comma separators (street, city, state, zip). This is the operating address — NOT the registered agent's address. If the Articles list only a registered-agent address and no separate principal office, leave principal_office_address=null and populate registered_agent_address only.
- registered_agent_address: the registered agent's service-of-process address as listed alongside the registered_agent_name. Same comma-separated single-string format. Populate even when it equals the principal office (downstream will dedupe).

operating_agreement_amendment:
- amendment_number: string like "First Amendment", "Amendment No. 2".
- effective_date: the date the amendment takes effect (often distinct from signing date).
- prior_member_list: every member named in the recitals as the pre-amendment owner. Capture name + ownership_percent.
- new_member_list: every member as defined post-amendment. Capture name + ownership_percent.
- capital_contribution_changes_summary: a short verbatim phrase describing the capital movement (e.g., "$80,000 paid by Salih Kacar in exchange for 50% membership interest").

ein_assignment_letter:
- ein_full: capture the FULL EIN exactly as stated. Renderers downstream will mask all but the last 4 digits per the firm's PII rule — do NOT pre-mask in your JSON output.
- assigned_date: the date the letter was issued.
- irs_signature_present: true if the letter shows an IRS signature block / IRS officer name.
- mailing_address: the entity's mailing address as printed on the IRS letter (the address block addressed to the entity, NOT IRS's own return address). Capture as a single string with comma separators (street, city, state, zip). This populates the master fact sheet's company physical_address — extract carefully, the EIN letter is often the most authoritative address source in the file.

certificate_of_good_standing:
- jurisdiction: the state / authority issuing the certificate.
- status_value: short verbatim phrase from the certificate (e.g., "active in good standing", "in good standing", "valid existence").
- issued_date: the date the certificate was issued.
- expiry_or_validity_period: any validity window stated on the certificate (e.g., "valid for 60 days", "as of December 31, 2025"). Verbatim phrase.

state_registration:
- registration_kind: 'annual_report' | 'foreign_qualification' | 'amendment_of_articles' | 'name_change' | 'other_state_registration'.
- status_value: short phrase describing the registration's status (e.g., "filed", "accepted", "rejected").
- principal_office_address: the entity's current business address as filed with the state on this registration. Annual reports often carry the most up-to-date address even when Articles only listed the registered agent. Same comma-separated single-string format.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers in the input.
- source_quote is a short verbatim phrase (5–25 words) copied from the source that contains or directly evidences the value.
- confidence is in [0, 1]: 1.0 = explicit and unambiguous; ~0.7 = clear in context; ~0.5 = ambiguous; do not emit values below 0.3.
- Dates: prefer ISO YYYY-MM-DD; if format ambiguous (MM/DD vs DD/MM), leave value=null.
- Booleans: only emit true/false when the source supports it; otherwise null.

Edge cases:
- A formation packet that bundles Articles + EIN letter + Certificate in one PDF: classify by the document's PRIMARY purpose. Usually the Articles dominate; secondary content can be referenced in source_quote on the relevant field.
- A foreign-jurisdiction formation document (e.g., Turkish "Esas Sözleşme") should NOT use this extractor — those route through the foreign-corporate extractor. If you encounter one, return formation_doc_subtype='other_formation' with a short one_line_summary noting the routing.

Output: ONE JSON object matching the formation_doc_subtype-discriminated CorporateFormationFacts schema. No prose, no commentary, no markdown fences.`;

export interface CorporateFormationExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface CorporateFormationExtractResult {
  filename: string;
  pageCount: number;
  facts?: CorporateFormationFacts;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractCorporateFormation(
  input: CorporateFormationExtractInput,
): Promise<CorporateFormationExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the formation_doc_subtype-discriminated CorporateFormationFacts schema. No prose, no markdown fences.`;

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
        code: 'corporate_formation_extract_failed',
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

  const validated = CorporateFormationFactsSchema.safeParse(raw);
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
    facts: validated.data as CorporateFormationFacts,
  };
}
