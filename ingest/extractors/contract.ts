/**
 * Contract extractor — second pass after the typed-extract.ts classifier.
 *
 * Runs a single Haiku 4.5 call dedicated to contract-rich extraction: it
 * classifies into one of six contract subtypes and fills the matching
 * variant of ContractFactsSchema. Called from classifyAndExtractOnePdf
 * when the first-pass classifier returns a contract-flavored doc_type.
 *
 * Input: pre-extracted PDF text (avoids double-parsing — the orchestrator
 * has already called extractPdfText). Output: ContractExtractResult,
 * mirroring PerPdfResult's shape.
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import { ContractFactsSchema, type ContractFacts } from './contract.schema';

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

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document contract extraction on a single PDF from an E-2 Treaty Investor case folder. Your output goes into a typed memory the case-level aggregator will reason over later.

Your job is two-fold:

1. CLASSIFY the document into exactly ONE contract_subtype:
   - membership_interest_transfer_agreement — transfers an LLC membership interest from a prior holder to a subsequent holder; usually states an effective date, a percentage transferred, a total consideration, payment terms, and (commonly) grants an executive title to the transferee. THE HIGHEST-LEVERAGE CONTRACT IN E-2: it drives ownership %, investment dollar amount, AND develop-and-direct effective date in three different cover-letter sections.
   - operating_agreement — initial governing contract among LLC members at formation; lists initial members, ownership percentages, capital contributions, and management structure (member-managed vs manager-managed). May appear as the original or as an amendment.
   - bill_of_sale — earlier-link transfer of membership interest, typically notarized, with consideration and (often) a promissory note.
   - commercial_lease — premises lease where the tenant is the Petitioner and the use is business (storefront, kitchen, office, manufacturing).
   - residential_lease — lease on a residential property whose rent is claimed as a SOURCE of investment funds. Defensive cases: landlord may be the Beneficiary's spouse rather than the Beneficiary; rent may include an indexed escalation clause (TEFE / TUFE / CPI). Capture both faithfully — the cover-letter drafter needs them to deploy the manual's mandatory defensive paragraphs.
   - other_contract — does not fit the above; use sparingly, with a one-line summary.

2. EXTRACT the subtype-specific fields per the schema for the chosen contract_subtype. Only the schema variant matching your chosen contract_subtype is valid in your JSON output.

Subtype-specific guidance:

membership_interest_transfer_agreement:
- transferor.ownership_before / transferee.ownership_after must reflect the percentages stated in the agreement (typically: transferor 100→50, transferee 0→50, or some variant).
- total_consideration_amount + total_consideration_currency: extract verbatim (e.g., "$120,000.00", "USD 120000"). Capture the currency in ISO-4217.
- payment_terms.upfront vs deferred: many agreements say "$80,000 upon execution; remaining $40,000 in 4 quarterly installments". Capture upfront_amount and the deferred_amount + schedule as a verbatim quote.
- executive_role_granted: the title (e.g., "President", "Manager", "Chief Executive Officer"). If the agreement grants no role, leave value=null.
- effective_date_role: the date the role becomes effective; usually = effective_date but sometimes deferred.

operating_agreement:
- One members[] entry per initial member. ownership_percent must sum to 100 if all entries are populated; if not, do not normalize — just extract what the source says.
- amendment_or_original: 'original' if this is the at-formation agreement; 'amendment' if it modifies a prior agreement.

bill_of_sale:
- consideration_amount + consideration_currency: extract verbatim. If the source uses a foreign currency, leave the value as-is in that currency and record the ISO code.
- notarized_or_apostilled: true if a notary block is visible in the PDF.

commercial_lease:
- tenant_legal_name should match the Petitioner. If it does not, do not silently extract; capture the lease's tenant verbatim — the aggregator will surface the conflict.
- monthly_rent_amount + currency: extract verbatim.

residential_lease:
- landlord_relationship_to_beneficiary: critical for the spouse-named-lease defensive paragraph. If the landlord name does not appear in the document AS the Beneficiary, classify as 'unclear' rather than guessing. The aggregator will resolve against the passport extraction.
- escalation_clause_verbatim + escalation_index_named: capture both the full clause text and the named index ("TUFE", "TEFE", "CPI", "RPI"). Required for the TEFE/TUFE defensive footnote.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers in the input.
- source_quote is a short verbatim phrase (5–25 words) copied from the source that contains or directly evidences the value.
- confidence is in [0, 1]: 1.0 = explicit and unambiguous; ~0.7 = clear in context; ~0.5 = ambiguous; do not emit values below 0.3.
- Currency: extract amounts as numbers with symbols/commas stripped and capture the ISO-4217 currency code separately. DO NOT convert to USD here — the aggregator will reconcile FX with the wire-confirmation extractor.
- Dates: prefer ISO YYYY-MM-DD; if format ambiguous (MM/DD vs DD/MM), leave value=null.
- Booleans: only emit true/false when the source supports it; otherwise null.

Edge cases:
- If a single PDF contains multiple distinct contracts, classify by the document's PRIMARY contract; note any secondary content briefly in source_quote on the most relevant field.
- If a document is partially OCR-garbled, extract what is legible; leave noisy fields null.
- Do NOT guess the contract_subtype. If genuinely unsure, choose 'other_contract'.

Output: ONE JSON object matching the contract_subtype-discriminated ContractFacts schema. No prose, no commentary, no markdown fences.`;

export interface ContractExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface ContractExtractResult {
  filename: string;
  pageCount: number;
  facts?: ContractFacts;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractContract(
  input: ContractExtractInput,
): Promise<ContractExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the contract_subtype-discriminated ContractFacts schema. No prose, no markdown fences.`;

  // The 6-variant contract union with PartySchema + PaymentTermsSchema
  // sub-objects has ~70 nullable Field<> params across variants — likely
  // over Anthropic's structured-output union-param cap (16). Use manual
  // JSON parse + Zod validate, same pattern as ingest/typed-extract.ts.
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
        code: 'contract_extract_failed',
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

  const validated = ContractFactsSchema.safeParse(raw);
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
    facts: validated.data as ContractFacts,
  };
}
