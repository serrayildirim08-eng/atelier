/**
 * RFE / NOID rich-extraction second pass — runs on PDFs that look like
 * USCIS RFE / NOID notices OR firm-authored responses to them. Phase-3
 * detects RFE-flagged docs but locks subject_category to 'other'; this
 * extractor classifies via section-heading + verbatim-language patterns
 * and extracts the verbatim assertions on each side of the case so the
 * aggregator can populate rfes[].initial_filing_assertion and
 * rfes[].response_assertion.
 *
 * Single Haiku 4.5 call fills RfeNoticeFactsSchema. The aggregator's
 * Phase-4 enrichment pairs RFE notice ↔ response by subject_category
 * (or filename heuristics) and writes the assertion fields onto the
 * matching rfes[] entry.
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  RfeNoticeFactsSchema,
  type RfeNoticeFacts,
} from './rfe-notice.schema';

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

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document extraction on a USCIS Request for Evidence (RFE) notice, Notice of Intent to Deny (NOID), OR a firm-authored response to one. Your output is the input to the material_change_in_response_to_uscis gate (Matter of Izummi) and the multi_round_rfe_escalation gate.

Extract the following fields per RfeNoticeFactsSchema. EVERY leaf field carries the {value, source_page, source_quote, confidence} provenance wrapper.

Field-specific guidance:

- document_role: classify the document's posture:
  · 'rfe_notice' — USCIS-issued Request for Evidence (header has USCIS letterhead, "REQUEST FOR EVIDENCE", a receipt number, a response deadline).
  · 'noid_notice' — USCIS-issued Notice of Intent to Deny (header explicitly says "NOTICE OF INTENT TO DENY" / "NOID").
  · 'rfe_response' — firm-authored letter responding to an RFE (signature block by the firm's attorney; references the RFE date in the opening; section headings are thematic ALL-CAPS like "TIMELY FILING OF FORM I-129 PRIOR TO EXPIRATION OF STATUS").
  · 'noid_response' — firm-authored letter responding to a NOID.
  · 'unknown' — none of the above can be confidently determined.

- subject_category: classify the substantive issue. Detect via section headings + verbatim language patterns:
  · 'bona_fide_enterprise' — verbatim cues: "It does not appear that your enterprise is conducting any sort of commercial business" / "you have not shown that it is actively working in a commercial sense" / "evidence that the business was legally created, you have not shown that it is actively working".
  · 'marginality' — verbatim cues: "able to generate enough of an income to provide a minimal living" / "marginal" / "sole purpose of providing a living to the alien and his family" / 9 FAM 402.9-6(D).
  · 'substantial_investment' — verbatim cues: "substantiality" / "amount of investment" / "9 FAM 402.9-6(C)" / "proportionality" / "irrevocable commitment".
  · 'nationality_or_ownership' — verbatim cues: "treaty national" / "50% ownership" / 9 FAM 402.9-4(B) / "nationality of the principal investor".
  · 'develop_and_direct' — verbatim cues: "develop and direct" / 8 CFR § 214.2(e)(15) / "executive or supervisory" capacity / "ownership of at least 50%".
  · 'procedural_status' — verbatim cues: "Please provide evidence that the I-539 has been approved" / "maintenance of status" / "you are still maintaining a valid non-immigrant status" / "Form I-539" / "B-1/B-2 expiration".
  · 'source_of_funds' — verbatim cues: "lawful source" / "trace the funds" / 9 FAM 402.9-6(B) / "at risk" / "documentary evidence of the source".
  · 'classification_ambiguity' — verbatim cues: "the statements made in the cover letter submitted with your application are insufficient" / "additional evidence" with no specific substantive theme / generic "we need additional evidence" framing.
  · 'multiple' — when the notice presents TWO OR MORE distinct substantive challenges (e.g., E3 bona-fide AND E4 marginality in the same notice). PREFER 'multiple' over picking one when the notice is genuinely compound.
  · 'other' — none of the above fit with confidence ≥ 0.5.

  Confidence: 0.9 when a section heading + verbatim USCIS language unambiguously names the category; 0.6 when inferred from context; 0.4 heuristic. Never invent.

- rfe_date: ISO 8601 (YYYY-MM-DD). For an RFE / NOID notice, parse from the header date / "Date: [date]" line. For a response, parse the underlying RFE date the response references in its opening (e.g., "in response to the Request for Evidence dated 2026-04-06").

- response_deadline: ISO 8601 (YYYY-MM-DD). For a notice, parse from "Your response must be received in this office by [date]" / "must reach this office by [date]" / "by no later than [date]". For a response document, leave value=null (not applicable).

- issuing_officer_name + issuing_officer_title: from the signature block of an RFE / NOID notice. Examples: "Carrie M. Selby" / "Acting Associate Director SCO". For a response document, leave both null (the signatory there is the firm's attorney, captured separately by the cover-letter extractor).

- evidence_requested: array of bullet items USCIS asks for. ONLY populate on an RFE / NOID notice (document_role='rfe_notice' / 'noid_notice'). Each entry is a Field<string>; pull each requested item as a short verbatim phrase (5–25 words). Examples:
  · "Federal income tax returns for the enterprise (last 2 years)"
  · "Latest financial statements (Balance Sheet + Statements of Income/Expenses; audited preferred)"
  · "State Quarterly Wage Reports (last 2 quarters)"
  Cap the array at 25 items; if more, capture the most material 25.

- initial_filing_assertion: ONLY populate when document_role='rfe_notice' / 'noid_notice' AND the notice quotes back the petitioner's ORIGINAL claim (typical pattern: "First, in your letter from Counsel it states that you did not engage in business activities until 2023" — the quoted-back assertion). Capture the verbatim claim USCIS attributes to the original filing. Otherwise null.

- response_assertion: ONLY populate when document_role='rfe_response' / 'noid_response' AND the response makes a verbatim factual claim on the same point (operational-since date, ownership timeline, business activity, status maintenance). Capture the firm's NEW assertion, verbatim. Otherwise null. The aggregator pairs initial_filing_assertion (from the notice) with response_assertion (from the response) by matching subject_category to detect Matter of Izummi material change.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers in the input.
- source_quote is a short verbatim phrase (5–25 words) copied from the source.
- confidence is in [0, 1]; do not emit values below 0.3.

Edge cases:
- A response that addresses MULTIPLE subject categories (typical for compound NOIDs): set subject_category='multiple' and leave initial_filing_assertion / response_assertion as the most material single quote (the aggregator's per-category pairing falls back to filename heuristics in the multi-category case).
- A second-round RFE that escalates from procedural to substantive (B&B International pattern: RFE-1 was procedural_status, RFE-2 was bona_fide_enterprise + marginality): classify by RFE-2's content.
- A NOID that cites a Final Denial precedent (Matter of Izummi, Matter of Katigbak) but does not itself make a substantive challenge: classify by the underlying substantive issue, not by the procedural posture.

Output: ONE JSON object matching RfeNoticeFactsSchema. No prose, no commentary, no markdown fences.`;

export interface RfeNoticeExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface RfeNoticeExtractResult {
  filename: string;
  pageCount: number;
  facts?: RfeNoticeFacts;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractRfeNotice(
  input: RfeNoticeExtractInput,
): Promise<RfeNoticeExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the RfeNoticeFacts schema. No prose, no markdown fences.`;

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
        code: 'rfe_notice_extract_failed',
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

  const validated = RfeNoticeFactsSchema.safeParse(raw);
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
    facts: validated.data as RfeNoticeFacts,
  };
}
