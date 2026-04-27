/**
 * Cross-document aggregator.
 *
 * Reads the typed memory (PerPdfResult[] grouped by doc_type) and
 * produces a unified E2FactsSchema. This is the single Sonnet call
 * where cross-document reasoning happens — the per-PDF extractor only
 * sees one document, the aggregator sees them all.
 *
 * Inputs are kept compact: each PerPdfResult is serialized as a small
 * JSON block under its filename. The aggregator's job is reconciliation,
 * not re-extraction — it should never invent facts not present in the
 * typed memory.
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import { E2FactsSchema, type E2Facts } from './schema';
import { DOC_TYPE_LABELS, type PerPdfResult, type TypedMemory } from './typed-memory';
import {
  CONTRACT_SUBTYPE_LABELS,
  type ContractFacts,
} from './extractors/contract.schema';
import {
  BANK_RECEIPT_SUBTYPE_LABELS,
  type BankReceiptFacts,
} from './extractors/bank-receipt.schema';
import {
  WIRE_CONFIRMATION_SUBTYPE_LABELS,
  checkFxGate,
  FX_GATE_TOLERANCE,
  type WireConfirmationFacts,
} from './extractors/wire-confirmation.schema';
import {
  GOVERNMENT_DOC_SUBTYPE_LABELS,
  type GovernmentDocFacts,
} from './extractors/government-doc.schema';

/** Tolerance for the manual §4.5 quality gate (USD). */
const CONSIDERATION_GATE_TOLERANCE_USD = 100;

/** Iterate every PerPdfResult in the typed memory regardless of grouping. */
function* iterMemoryEntries(memory: TypedMemory): Generator<PerPdfResult> {
  for (const list of Object.values(memory)) {
    if (!list) continue;
    for (const entry of list) yield entry;
  }
}

const SYSTEM_PROMPT = `You are a senior immigration paralegal at Akalan Immigration Law performing cross-document reconciliation on an E-2 Treaty Investor case folder. The case folder has already been processed document-by-document by a per-PDF extractor; you are reading the resulting "typed memory" — facts grouped by document type — and producing a unified E-2 case-fact set.

Authority cascade (apply throughout):
- INA § 101(a)(15)(E)(ii)
- 8 CFR § 214.2(e), specifically (e)(12)–(16)
- 9 FAM 402.9, especially 402.9-4(B) (treaty country) and 402.9-6 (substantive standards)
- USCIS Policy Manual Vol. 2, Part G
- Matter of Walsh and Pollard, 20 I&N Dec. 60 (BIA 1988) — irrevocable commitment doctrine
- Matter of Ho, 22 I&N Dec. 206 (Assoc. Comm'r 1998) — comprehensive/credible/verifiable plan, by analogy

Your job is RECONCILIATION, not invention. Apply these rules strictly:

1. Every fact in the unified output must trace back to one or more entries in the typed memory. NEVER fabricate a value the memory does not contain.
2. When multiple memory entries speak to the same fact (e.g., the investor's name appears in passport, status_doc, and bank_statement), prefer the most authoritative source: passport > status_doc > forms > bank/tax > business plan > cover letter > other.
3. When two authoritative sources disagree (e.g., DOB on passport vs DOB on a bank statement), DO NOT silently pick one. Populate the field with the most authoritative value AND log a conflict_register entry with severity per the rubric in rule 6.
4. For the investment ledger (E2InvestmentSchema.items), aggregate every relevant invoice_or_receipt and money_movement entry into a line item with category, amount, and date. The total_committed_usd must equal the sum of items within $100; if it does not, log a conflict_register entry at severity 4.
5. For source_of_funds chains (E2FactsSchema.source_of_funds), one chain entry per source_of_funds memory entry. Cross-reference money_movement memory to populate intermediate steps where possible.
6. conflict_register severity rubric (1-5):
   - 1 cosmetic (diacritic / capitalization / formatting variant)
   - 2 clerical (single-digit / single-character collision resolvable from primary ID)
   - 3 factual_minor (small amount mismatch <$1K; minor address variant)
   - 4 factual_material (>$5K investment drift; defective translation; G-28 mismatch; loan secured by enterprise's own assets per 9 FAM 402.9-6(C); first-line-supervisor risk)
   - 5 dispositive (DOB unresolvable from primary ID; investment leg with no source documentation; investor still abroad; unsupported >$10K source-of-funds gap; ownership <50% treaty national)

Field-population rules:

- investor.* — prefer passport memory; fall back to status_doc, then forms.
- enterprise.legal_name + ein + formation_date — prefer formation_doc memory.
- ownership_chain — prefer ownership_evidence memory; cross-check against any operating-agreement entry inside formation_doc memory.
- investment.items — aggregate from invoice_or_receipt memory.
- investment.total_committed_usd — sum of investment.items.amount_usd.
- investment.total_cost_of_enterprise_usd — prefer business_plan memory if present.
- investment.proportionality_percent — compute total_committed / total_cost × 100 ONLY if both are present and non-null; otherwise leave null.
- source_of_funds — one chain entry per source_of_funds memory entry; trace through money_movement memory where possible.
- elements_evidence.* — write a 2-3 sentence narrative basis per element, citing the memory entries that support it. Where the memory does not support an element (e.g., no payroll_doc + solo investor), leave the basis null and log a marginality conflict at severity 3-4.

Cross-document gates (in addition to the per-element rules above):

- Manual §4.5 (Membership Interest Transfer Agreement gate). When the typed memory contains a contract with contract_subtype='membership_interest_transfer_agreement', its total_consideration_amount MUST equal the I-129 E Supplement's investment_amount_usd (uscis_or_dos_form with form_id matching "I-129E" or "I-129 E Supplement"). Mismatch beyond $100 = severity 5 conflict_register entry with conflict_type='investment_amount_drift'. Populate fact_a_doc with the contract filename and fact_b_doc with the I-129E filename. The infrastructure also runs a deterministic post-check after your output; logging the conflict here is preferred so the narrative reflects it.
- Membership-interest-transfer's transferee.ownership_after combined with the Petitioner's other treaty-national owners must reach ≥50% (9 FAM 402.9-4(B)). If it does not, severity 5, conflict_type='ownership_below_treaty_threshold'.
- Membership-interest-transfer's effective_date_role and the executive_role_granted feed E5 develop-and-direct (manual §8.7); use them to populate elements_evidence.develop_and_direct_basis when present.
- Manual §5.2.1 (FX validation gate). When the typed memory contains a wire-confirmation with wire_subtype='international_wire_with_fx', |source_amount × exchange_rate − target_amount| / target_amount MUST be ≤ 1% (0.01). Mismatch = severity 3 conflict_register entry with conflict_type='fx_rate_drift'. Populate fact_a_doc with the wire filename. The infrastructure also runs this gate deterministically after your output; logging the conflict here is preferred so the narrative reflects it.
- Manual §5.4 (SOF chain reconstruction). Use the BANK RECEIPTS, WIRE CONFIRMATIONS, and GOVERNMENT DOCUMENTS blocks to populate source_of_funds chain entries. A multi_installment bank receipt's total_received_amount sums the property-sale proceeds (compare against title_deed if both present); an international_wire_with_fx records the §5.2.1 conversion; a usd_only_wire / corporate_funding records the §5.2.3 close-of-chain deployment.
- Manual §5.1.2 Tapu defensive paragraph. When a government document with government_doc_subtype='title_deed' appears in the typed memory, the drafter MUST insert the Tapu defensive paragraph BEFORE citing the deed exhibit. The infrastructure surfaces this requirement as a separate `defensive_paragraphs_required.tapu_explanation` flag in the aggregator output; you do not need to log it as a conflict_register entry — populate elements_evidence narratives accordingly so the drafter has the cue.

Provenance carry-over:
- Every leaf field in the output schema carries source_page, source_quote, confidence.
- Inherit source_page and source_quote from the per-PDF entry that supplied the value, with the filename PREFIXED into source_quote like "[passport.pdf p.2] John Doe, born 1985-03-10".
- If a value is computed (e.g., proportionality_percent, total_committed_usd as a sum), set source_page=null and source_quote="[computed from items]" with confidence reflecting input confidence.

OUTPUT SHAPE — STRICT (most common cause of validation failure):

Every leaf field in E2FactsSchema is wrapped in a Field object with EXACTLY these four keys:
  { "value": <T or null>, "source_page": <integer or null>, "source_quote": <string or null>, "confidence": <0..1 or null> }

You MUST emit every field defined in the schema, even when the typed memory has nothing to say about it. For missing data, emit the canonical empty Field:
  { "value": null, "source_page": null, "source_quote": null, "confidence": null }

NEVER omit a field. NEVER substitute a bare null for a Field object. NEVER substitute a bare string or number for a Field object.

For arrays (e.g., ownership_chain, source_of_funds, conflict_register), an empty array [] is valid when the typed memory provides no entries.

Do NOT include any extra top-level keys not in E2FactsSchema. The schema's top-level keys are:
  case_type-specific facts: investor, enterprise, ownership_chain, investment, source_of_funds, elements_evidence, conflict_register

Output: ONE JSON object matching E2FactsSchema. No prose, no commentary, no markdown fences. Begin your response with { and end with }.`;

const USER_INSTRUCTION = `Below is the typed memory for this E-2 case folder. Reconcile the entries into a unified E2FactsSchema following the rules above.`;

function memoryToPromptText(memory: TypedMemory): string {
  const sections: string[] = [];
  const orderedTypes = Object.keys(memory).sort();
  for (const type of orderedTypes) {
    const entries = memory[type as keyof TypedMemory];
    if (!entries || entries.length === 0) continue;
    const label = DOC_TYPE_LABELS[type as keyof typeof DOC_TYPE_LABELS] ?? type;
    const body = entries
      .map((e: PerPdfResult) => {
        const facts = e.facts ? JSON.stringify(e.facts, null, 2) : '(no facts extracted)';
        return `### ${e.filename} (page count: ${e.pageCount})\n${facts}`;
      })
      .join('\n\n');
    sections.push(`## ${label.toUpperCase()} — ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}\n\n${body}`);
  }

  // Rich extractions cross-cut the doc_type taxonomy: a single PDF
  // carries both its thin doc_type extraction (above) AND a rich facts
  // payload from one or more rich extractors. Surface each rich block as
  // its own section so the gates in the system prompt fire reliably.
  const contractEntries: { filename: string; pageCount: number; contract: ContractFacts }[] = [];
  const bankReceiptEntries: { filename: string; pageCount: number; bankReceipt: BankReceiptFacts }[] = [];
  const wireEntries: { filename: string; pageCount: number; wireConfirmation: WireConfirmationFacts }[] = [];
  const govDocEntries: { filename: string; pageCount: number; governmentDoc: GovernmentDocFacts }[] = [];

  for (const entry of iterMemoryEntries(memory)) {
    if (entry.contract) {
      contractEntries.push({
        filename: entry.filename,
        pageCount: entry.pageCount,
        contract: entry.contract,
      });
    }
    if (entry.bankReceipt) {
      bankReceiptEntries.push({
        filename: entry.filename,
        pageCount: entry.pageCount,
        bankReceipt: entry.bankReceipt,
      });
    }
    if (entry.wireConfirmation) {
      wireEntries.push({
        filename: entry.filename,
        pageCount: entry.pageCount,
        wireConfirmation: entry.wireConfirmation,
      });
    }
    if (entry.governmentDoc) {
      govDocEntries.push({
        filename: entry.filename,
        pageCount: entry.pageCount,
        governmentDoc: entry.governmentDoc,
      });
    }
  }

  if (contractEntries.length > 0) {
    const body = contractEntries
      .map((e) => {
        const label = CONTRACT_SUBTYPE_LABELS[e.contract.contract_subtype];
        return `### ${e.filename} — ${label} (page count: ${e.pageCount})\n${JSON.stringify(e.contract, null, 2)}`;
      })
      .join('\n\n');
    sections.push(
      `## CONTRACTS (rich extraction) — ${contractEntries.length} entr${contractEntries.length === 1 ? 'y' : 'ies'}\n\n${body}`,
    );
  }

  if (bankReceiptEntries.length > 0) {
    const body = bankReceiptEntries
      .map((e) => {
        const label = BANK_RECEIPT_SUBTYPE_LABELS[e.bankReceipt.receipt_subtype];
        return `### ${e.filename} — ${label} (page count: ${e.pageCount})\n${JSON.stringify(e.bankReceipt, null, 2)}`;
      })
      .join('\n\n');
    sections.push(
      `## BANK RECEIPTS (rich extraction) — ${bankReceiptEntries.length} entr${bankReceiptEntries.length === 1 ? 'y' : 'ies'}\n\n${body}`,
    );
  }

  if (wireEntries.length > 0) {
    const body = wireEntries
      .map((e) => {
        const label = WIRE_CONFIRMATION_SUBTYPE_LABELS[e.wireConfirmation.wire_subtype];
        return `### ${e.filename} — ${label} (page count: ${e.pageCount})\n${JSON.stringify(e.wireConfirmation, null, 2)}`;
      })
      .join('\n\n');
    sections.push(
      `## WIRE CONFIRMATIONS (rich extraction) — ${wireEntries.length} entr${wireEntries.length === 1 ? 'y' : 'ies'}\n\n${body}`,
    );
  }

  if (govDocEntries.length > 0) {
    const body = govDocEntries
      .map((e) => {
        const label = GOVERNMENT_DOC_SUBTYPE_LABELS[e.governmentDoc.government_doc_subtype];
        return `### ${e.filename} — ${label} (page count: ${e.pageCount})\n${JSON.stringify(e.governmentDoc, null, 2)}`;
      })
      .join('\n\n');
    sections.push(
      `## GOVERNMENT DOCUMENTS (rich extraction) — ${govDocEntries.length} entr${govDocEntries.length === 1 ? 'y' : 'ies'}\n\n${body}`,
    );
  }

  return sections.join('\n\n');
}

export interface AggregateUsage {
  input_tokens: number;
  output_tokens: number;
}

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

export interface ConsiderationGateInputs {
  contractFilename: string;
  contractPage: number | null;
  contractQuote: string | null;
  contractAmountUsd: number;
  i129eFilename: string;
  i129ePage: number | null;
  i129eQuote: string | null;
  i129eAmountUsd: number;
}

/**
 * Drafter cues derived deterministically from the typed memory. The
 * drafter consults this object to decide whether to insert defensive
 * paragraphs before exhibit citations (manual §2 / §5.1.2). Each flag is
 * orthogonal — multiple may be true on the same matter.
 */
export interface DefensiveParagraphsRequired {
  /**
   * Manual §5.1.2: when a foreign title-deed exhibit is cited, the cover
   * letter must explain the Tapu / Land Registry mechanism BEFORE the
   * exhibit. Set true whenever the typed memory contains any government
   * document with government_doc_subtype='title_deed'.
   */
  tapu_explanation: boolean;
}

/**
 * One row in the deterministic FX-gate audit. Surfaced alongside the
 * aggregator output so callers can show per-wire FX status independent of
 * the conflict_register narrative. ok=true with relative_drift=null means
 * the gate could not run (one of source/target/rate was null).
 */
export interface FxGateAuditRow {
  filename: string;
  ok: boolean;
  relative_drift: number | null;
  source_amount: number | null;
  source_currency: string | null;
  target_amount: number | null;
  target_currency: string | null;
  exchange_rate: number | null;
}

/** Tolerance the gate applies to the consideration drift (exported for tests). */
export const CONSIDERATION_GATE_TOLERANCE = CONSIDERATION_GATE_TOLERANCE_USD;

/**
 * Pull the inputs to the manual §4.5 quality gate from the typed memory.
 * Returns null if either side is missing, currency-ambiguous, or non-USD —
 * we do not raise false positives across FX boundaries (the contract is
 * almost always in USD for an E-2 to a US LLC; if it isn't, the FX
 * reconciliation is a separate aggregator-level concern).
 */
export function findConsiderationGateInputs(
  memory: TypedMemory,
): ConsiderationGateInputs | null {
  let contract: ConsiderationGateInputs | null = null;
  let i129e: { filename: string; page: number | null; quote: string | null; amount: number } | null = null;

  for (const entry of iterMemoryEntries(memory)) {
    if (entry.contract?.contract_subtype === 'membership_interest_transfer_agreement') {
      const c = entry.contract;
      const amount = c.total_consideration_amount.value;
      const currency = c.total_consideration_currency.value;
      if (amount != null && currency === 'USD' && contract == null) {
        contract = {
          contractFilename: entry.filename,
          contractPage: c.total_consideration_amount.source_page,
          contractQuote: c.total_consideration_amount.source_quote,
          contractAmountUsd: amount,
          // i129e fields filled below
          i129eFilename: '',
          i129ePage: null,
          i129eQuote: null,
          i129eAmountUsd: 0,
        };
      }
    }

    if (entry.facts?.doc_type === 'uscis_or_dos_form' && i129e == null) {
      const formId = entry.facts.form_id.value ?? '';
      const isI129E = /i[-\s]?129\s*e/i.test(formId);
      const investmentAmount = entry.facts.investment_amount_usd.value;
      if (isI129E && investmentAmount != null) {
        i129e = {
          filename: entry.filename,
          page: entry.facts.investment_amount_usd.source_page,
          quote: entry.facts.investment_amount_usd.source_quote,
          amount: investmentAmount,
        };
      }
    }
  }

  if (!contract || !i129e) return null;
  return {
    ...contract,
    i129eFilename: i129e.filename,
    i129ePage: i129e.page,
    i129eQuote: i129e.quote,
    i129eAmountUsd: i129e.amount,
  };
}

/**
 * Compute the drafter's defensive-paragraph cues from the typed memory.
 * Pure / deterministic — exported for tests.
 */
export function computeDefensiveParagraphsRequired(
  memory: TypedMemory,
): DefensiveParagraphsRequired {
  let tapu = false;
  for (const entry of iterMemoryEntries(memory)) {
    if (entry.governmentDoc?.government_doc_subtype === 'title_deed') {
      tapu = true;
      break;
    }
  }
  return { tapu_explanation: tapu };
}

/**
 * Run the manual §5.2.1 FX validation gate against every
 * international_wire_with_fx in the typed memory. Returns one audit row
 * per wire — the caller appends conflict_register entries for any row
 * whose ok=false. Pure / deterministic — exported for tests.
 */
export function runFxValidationGate(memory: TypedMemory): FxGateAuditRow[] {
  const rows: FxGateAuditRow[] = [];
  for (const entry of iterMemoryEntries(memory)) {
    if (!entry.wireConfirmation) continue;
    if (entry.wireConfirmation.wire_subtype !== 'international_wire_with_fx') continue;
    const result = checkFxGate(entry.wireConfirmation);
    rows.push({
      filename: entry.filename,
      ok: result.ok,
      relative_drift: result.relative_drift,
      source_amount: result.source_amount,
      source_currency: result.source_currency,
      target_amount: result.target_amount,
      target_currency: result.target_currency,
      exchange_rate: result.exchange_rate,
    });
  }
  return rows;
}

/** Locate the first international_wire_with_fx for a given filename — used to source page/quote provenance for FX-gate conflict entries. */
function findFxWireProvenance(
  memory: TypedMemory,
  filename: string,
): { page: number | null; quote: string | null } {
  for (const entry of iterMemoryEntries(memory)) {
    if (entry.filename !== filename) continue;
    if (entry.wireConfirmation?.wire_subtype !== 'international_wire_with_fx') continue;
    return {
      page: entry.wireConfirmation.exchange_rate.source_page,
      quote: entry.wireConfirmation.exchange_rate.source_quote,
    };
  }
  return { page: null, quote: null };
}

export async function aggregateTypedMemoryToE2(
  memory: TypedMemory,
): Promise<{
  caseFacts: E2Facts;
  usage: AggregateUsage;
  defensive_paragraphs_required: DefensiveParagraphsRequired;
  fx_gate_results: FxGateAuditRow[];
}> {
  const memoryBlock = memoryToPromptText(memory);
  const userMessage = `${USER_INSTRUCTION}\n\n# Typed memory\n\n${memoryBlock}\n\nRespond with ONLY a single JSON object matching the E2FactsSchema. No prose, no markdown fences, no commentary.`;

  // Anthropic's structured-output (messages.parse) caps at 16 union/nullable
  // parameters per schema. E2FactsSchema has ~176 (every Field<T> leaf is a
  // 4-way nullable). Use messages.create + manual JSON parse + Zod validate
  // — same pattern as ingest/claude.ts extractFactsByCaseType.
  const response = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral', ttl: '1h' },
      },
    ],
    messages: [{ role: 'user', content: userMessage }],
  });

  let jsonText = '';
  for (const block of response.content) {
    if (block.type === 'text') jsonText += block.text;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(extractFirstJsonObject(jsonText));
  } catch (e: unknown) {
    throw new Error(
      `Aggregator JSON parse failed — ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const parsed = E2FactsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Aggregator response did not match E2FactsSchema: ${parsed.error.message}`,
    );
  }

  logAnthropicUsage({
    stage: 'extract',
    model: 'claude-sonnet-4-6',
    case_type: 'E2',
    usage: response.usage,
  });

  // Manual §4.5 quality gate: deterministic backstop for the Sonnet
  // reasoning. If the membership_interest_transfer total_consideration
  // disagrees with the I-129 E Supplement's investment_amount beyond
  // tolerance, append a severity-5 conflict. Idempotent: skips if the
  // aggregator already logged the same conflict_type for the same docs.
  const gateInputs = findConsiderationGateInputs(memory);
  if (gateInputs) {
    const drift = Math.abs(gateInputs.contractAmountUsd - gateInputs.i129eAmountUsd);
    if (drift > CONSIDERATION_GATE_TOLERANCE_USD) {
      const alreadyLogged = parsed.data.conflict_register.some(
        (c) =>
          c.conflict_type.value === 'investment_amount_drift' &&
          c.fact_a_doc.value === gateInputs.contractFilename &&
          c.fact_b_doc.value === gateInputs.i129eFilename,
      );
      if (!alreadyLogged) {
        parsed.data.conflict_register.push({
          description: {
            value: `Membership Interest Transfer Agreement total consideration USD ${gateInputs.contractAmountUsd.toFixed(
              2,
            )} disagrees with I-129 E Supplement investment amount USD ${gateInputs.i129eAmountUsd.toFixed(
              2,
            )} (drift USD ${drift.toFixed(2)}). Manual §4.5 gate failed.`,
            source_page: null,
            source_quote: '[deterministic post-aggregation gate]',
            confidence: 1,
          },
          conflict_type: {
            value: 'investment_amount_drift',
            source_page: null,
            source_quote: '[deterministic post-aggregation gate]',
            confidence: 1,
          },
          severity: {
            value: 5,
            source_page: null,
            source_quote: '[deterministic post-aggregation gate]',
            confidence: 1,
          },
          fact_a_doc: {
            value: gateInputs.contractFilename,
            source_page: gateInputs.contractPage,
            source_quote: gateInputs.contractQuote,
            confidence: 1,
          },
          fact_a_page: {
            value: gateInputs.contractPage,
            source_page: gateInputs.contractPage,
            source_quote: gateInputs.contractQuote,
            confidence: 1,
          },
          fact_b_doc: {
            value: gateInputs.i129eFilename,
            source_page: gateInputs.i129ePage,
            source_quote: gateInputs.i129eQuote,
            confidence: 1,
          },
          fact_b_page: {
            value: gateInputs.i129ePage,
            source_page: gateInputs.i129ePage,
            source_quote: gateInputs.i129eQuote,
            confidence: 1,
          },
        });
      }
    }
  }

  return {
    caseFacts: parsed.data,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}
