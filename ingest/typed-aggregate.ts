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
import { countMessageTokens } from '@/lib/token-count';
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
import type { PassportFactsRich } from './extractors/passport.schema';
import type { I94Facts } from './extractors/i94.schema';
import type { VisaStampFacts } from './extractors/visa-stamp.schema';
import {
  VITAL_RECORDS_SUBTYPE_LABELS,
  type VitalRecordsFacts,
} from './extractors/vital-records.schema';
import type { JobOfferFacts } from './extractors/job-offer.schema';
import type { ServiceRecordFacts } from './extractors/service-record.schema';
import type { CvFacts } from './extractors/cv.schema';
import {
  CREDENTIAL_SUBTYPE_LABELS,
  type CredentialFacts,
} from './extractors/credential.schema';
import type { RecommendationLetterFacts } from './extractors/recommendation-letter.schema';
import {
  PAYROLL_SUBTYPE_LABELS,
  type PayrollFacts,
} from './extractors/payroll.schema';
import {
  TAX_RETURN_SUBTYPE_LABELS,
  TAX_BALANCE_SHEET_GATE_TOLERANCE,
  hasScheduleL,
  type TaxReturnFacts,
} from './extractors/tax-return.schema';
import {
  FINANCIAL_STATEMENT_SUBTYPE_LABELS,
  PL_TAX_GATE_TOLERANCE_USD,
  hasPlNetIncome,
  type FinancialStatementFacts,
} from './extractors/financial-statement.schema';

/** Tolerance for the manual §4.5 quality gate (USD). */
const CONSIDERATION_GATE_TOLERANCE_USD = 100;

/** Manual §3.1 — passport must be valid for ≥ 6 months from filing. */
const PASSPORT_VALIDITY_MIN_DAYS = 180;

/** Manual MANUAL-SUBTYPE-4 — Jaccard threshold for cv ↔ job-offer title drift. */
const CV_TITLE_JACCARD_THRESHOLD = 0.3;

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
- Manual §5.1.2 Tapu defensive paragraph. When a government document with government_doc_subtype='title_deed' appears in the typed memory, the drafter MUST insert the Tapu defensive paragraph BEFORE citing the deed exhibit. The infrastructure surfaces this requirement as a separate defensive_paragraphs_required.tapu_explanation flag in the aggregator output; you do not need to log it as a conflict_register entry — populate elements_evidence narratives accordingly so the drafter has the cue.
- Manual §3.1 (Passport validity gate). When a rich passport extraction is present, its date_of_expiration MUST be ≥ 6 months from the filing date. Mismatch = severity 3 conflict_register entry with conflict_type='passport_expires_soon'. The infrastructure runs this gate deterministically; logging the conflict here is optional but helpful for narrative coherence.
- Manual §3.4 (I-94 status gate). When a rich I-94 extraction is present and admit_until_date is a real date (not D/S), it MUST be ≥ filing_date. Mismatch = severity 5 conflict_register entry with conflict_type='status_violation_at_filing'. The infrastructure runs this gate deterministically.
- Manual §12.3 / §12.4 (Translation certification gate). When a rich vital-records extraction is present and certified_translation_present.value is false, the dependent eligibility exhibit lacks a competent translator's certification. This is a severity 3 conflict_register entry with conflict_type='translation_certification_missing'. The infrastructure runs this gate deterministically.
- Manual §3.1 / §15 (Name reconciliation). The rich passport extraction now provides full_name_native AND full_name_ascii. Use full_name_ascii for filing-bound text (cover letter, forms). When a vital-records or government-doc extraction lists ASCII names that DO NOT match the passport ASCII form, log a severity 2 'name_transliteration_drift' conflict so the attorney can review the chosen spelling.
- Manual §9 / §4 (Tax balance sheet vs investment gate). When the typed memory contains a tax-return with tax_return_subtype ∈ {form_1120, form_1120s, form_1065} AND the I-129 E Supplement's investment_amount_usd is known, |schedule_l_total_assets_end − I-129E investment_amount_usd| / I-129E investment_amount_usd MUST be ≤ 25% (0.25). Mismatch = severity 3 conflict_register entry with conflict_type='tax_balance_sheet_drift'. Populate fact_a_doc with the tax-return filename and fact_b_doc with the I-129E filename. The infrastructure runs this gate deterministically.
- Manual §9 (P&L vs tax-return net-income gate). When the typed memory contains a P&L (or combined_statements) AND a tax-return for the same tax_year, the P&L net_income_amount and the tax-return net_income_or_loss_amount MUST agree within $1,000. Mismatch = severity 3 conflict_register entry with conflict_type='pl_tax_net_income_drift'. Populate fact_a_doc with the P&L filename and fact_b_doc with the tax-return filename. The infrastructure runs this gate deterministically.
- Manual §9 (Marginality evidence). When the typed memory contains a payroll_register or employee_list with employee_count_excluding_beneficiary ≥ 1, the Petitioner is presumed to employ ≥1 U.S. worker beyond the Beneficiary — the §9 marginality narrative is supportable. The infrastructure surfaces this as marginality_evidence_present.us_workers_employed=true alongside the case facts; populate elements_evidence.more_than_marginal_basis accordingly. When no payroll evidence is present AND the enterprise is a solo Beneficiary investor, log a severity 3-4 'marginality_unsupported' conflict.

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

DOCUMENT INVENTORY WITH ALIASES (read this section first):

The user message includes a DOCUMENT INVENTORY block listing each PDF's raw filename, its classified doc_type, the canonical \`suggested_filename\` from the document-classifier-renamer, and (when applied) the attorney-accepted alias. The inventory is the source of truth for how to NAME documents in source_quote.

When source_quote prefixes a quote with a filename, use this priority order:
1. If an applied alias exists for the PDF, use the alias (e.g., "[kacar-salih-passport-bio-page.pdf p.2] John Doe, born 1985-03-10").
2. Otherwise, if a suggested_filename exists with confidence ≥ 0.7, use the suggested_filename.
3. Otherwise, use the raw filename as it appeared in the typed memory.

Apply the same priority everywhere a filename appears in the unified output: source_quote prefixes on every Field<T>, conflict_register fact_a_doc / fact_b_doc, source_of_funds.origin_evidence, investment.items.evidence_doc. The drafter downstream cites by these names; using the alias means the cover letter ships with attorney-readable references like "(Exhibit: Kacar-Salih Passport Bio Page)" instead of "(Exhibit: 1709245687.pdf)".

When NO alias is applied AND suggested_filename confidence is below 0.7, you may flag the entry in conflict_register at severity 1-2 (cosmetic, conflict_type='filename_uncanonical') so the attorney sees it in the dashboard, but do NOT block on this — uncanonical filenames are workflow noise, not a substantive RFE risk.

Output: ONE JSON object matching E2FactsSchema. No prose, no commentary, no markdown fences. Begin your response with { and end with }.`;

const USER_INSTRUCTION = `Below is the typed memory for this E-2 case folder. Reconcile the entries into a unified E2FactsSchema following the rules above.`;

/**
 * Per-PDF alias entry shape (matches the rename API's AliasEntry on disk).
 * Only `alias` is consumed by the aggregator; the timestamps live on disk
 * for audit. Aliases here are the attorney-ACCEPTED canonical filenames
 * — distinct from the per-PDF facts.suggested_filename, which is the
 * classifier's auto-suggestion (may or may not have been accepted).
 */
export interface FilenameAlias {
  alias: string;
}

/**
 * Build the DOCUMENT INVENTORY WITH ALIASES block surfaced into the
 * aggregator's user prompt. Renders one row per raw PDF filename in the
 * typed memory; columns are: pdf_path | doc_type | applied_alias |
 * suggested_filename | suggestion_confidence. The system prompt's
 * priority rules (alias → suggested_filename @ ≥0.7 → raw) reference
 * this table.
 */
function buildDocInventoryWithAliases(
  memory: TypedMemory,
  aliases: Record<string, FilenameAlias> = {},
): string {
  type Row = {
    pdf_path: string;
    doc_type: string;
    applied_alias: string;
    suggested_filename: string;
    suggestion_confidence: string;
  };
  const rows: Row[] = [];
  for (const entry of iterMemoryEntries(memory)) {
    const docType = entry.facts?.doc_type ?? 'unclassified';
    const sf = entry.facts && 'suggested_filename' in entry.facts
      ? (entry.facts as { suggested_filename?: { value: string | null; confidence: number | null } })
          .suggested_filename
      : null;
    rows.push({
      pdf_path: entry.filename,
      doc_type: docType,
      applied_alias: aliases[entry.filename]?.alias ?? '—',
      suggested_filename: sf?.value ?? '—',
      suggestion_confidence:
        sf?.confidence != null ? sf.confidence.toFixed(2) : '—',
    });
  }
  if (rows.length === 0) return '';

  const header =
    '| pdf_path | doc_type | applied alias | suggested_filename | suggestion confidence |\n' +
    '| --- | --- | --- | --- | --- |';
  const body = rows
    .map(
      (r) =>
        `| ${r.pdf_path} | ${r.doc_type} | ${r.applied_alias} | ${r.suggested_filename} | ${r.suggestion_confidence} |`,
    )
    .join('\n');

  return `## DOCUMENT INVENTORY WITH ALIASES — ${rows.length} PDF${rows.length === 1 ? '' : 's'}\n\n${header}\n${body}`;
}

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
  const passportEntries: { filename: string; pageCount: number; passport: PassportFactsRich }[] = [];
  const i94Entries: { filename: string; pageCount: number; i94: I94Facts }[] = [];
  const visaStampEntries: { filename: string; pageCount: number; visaStamp: VisaStampFacts }[] = [];
  const vitalRecordsEntries: { filename: string; pageCount: number; vitalRecords: VitalRecordsFacts }[] = [];
  const jobOfferEntries: { filename: string; pageCount: number; jobOffer: JobOfferFacts }[] = [];
  const serviceRecordEntries: { filename: string; pageCount: number; serviceRecord: ServiceRecordFacts }[] = [];
  const cvEntries: { filename: string; pageCount: number; cv: CvFacts }[] = [];
  const credentialEntries: { filename: string; pageCount: number; credential: CredentialFacts }[] = [];
  const recommendationLetterEntries: { filename: string; pageCount: number; recommendationLetter: RecommendationLetterFacts }[] = [];
  const payrollEntries: { filename: string; pageCount: number; payroll: PayrollFacts }[] = [];
  const taxReturnEntries: { filename: string; pageCount: number; taxReturn: TaxReturnFacts }[] = [];
  const financialStatementEntries: { filename: string; pageCount: number; financialStatement: FinancialStatementFacts }[] = [];

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
    if (entry.passport) {
      passportEntries.push({
        filename: entry.filename,
        pageCount: entry.pageCount,
        passport: entry.passport,
      });
    }
    if (entry.i94) {
      i94Entries.push({
        filename: entry.filename,
        pageCount: entry.pageCount,
        i94: entry.i94,
      });
    }
    if (entry.visaStamp) {
      visaStampEntries.push({
        filename: entry.filename,
        pageCount: entry.pageCount,
        visaStamp: entry.visaStamp,
      });
    }
    if (entry.vitalRecords) {
      vitalRecordsEntries.push({
        filename: entry.filename,
        pageCount: entry.pageCount,
        vitalRecords: entry.vitalRecords,
      });
    }
    if (entry.jobOffer) {
      jobOfferEntries.push({
        filename: entry.filename,
        pageCount: entry.pageCount,
        jobOffer: entry.jobOffer,
      });
    }
    if (entry.serviceRecord) {
      serviceRecordEntries.push({
        filename: entry.filename,
        pageCount: entry.pageCount,
        serviceRecord: entry.serviceRecord,
      });
    }
    if (entry.cv) {
      cvEntries.push({
        filename: entry.filename,
        pageCount: entry.pageCount,
        cv: entry.cv,
      });
    }
    if (entry.credential) {
      credentialEntries.push({
        filename: entry.filename,
        pageCount: entry.pageCount,
        credential: entry.credential,
      });
    }
    if (entry.recommendationLetter) {
      recommendationLetterEntries.push({
        filename: entry.filename,
        pageCount: entry.pageCount,
        recommendationLetter: entry.recommendationLetter,
      });
    }
    if (entry.payroll) {
      payrollEntries.push({
        filename: entry.filename,
        pageCount: entry.pageCount,
        payroll: entry.payroll,
      });
    }
    if (entry.taxReturn) {
      taxReturnEntries.push({
        filename: entry.filename,
        pageCount: entry.pageCount,
        taxReturn: entry.taxReturn,
      });
    }
    if (entry.financialStatement) {
      financialStatementEntries.push({
        filename: entry.filename,
        pageCount: entry.pageCount,
        financialStatement: entry.financialStatement,
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

  if (passportEntries.length > 0) {
    const body = passportEntries
      .map((e) => `### ${e.filename} (page count: ${e.pageCount})\n${JSON.stringify(e.passport, null, 2)}`)
      .join('\n\n');
    sections.push(
      `## PASSPORTS (rich extraction) — ${passportEntries.length} entr${passportEntries.length === 1 ? 'y' : 'ies'}\n\n${body}`,
    );
  }

  if (i94Entries.length > 0) {
    const body = i94Entries
      .map((e) => `### ${e.filename} (page count: ${e.pageCount})\n${JSON.stringify(e.i94, null, 2)}`)
      .join('\n\n');
    sections.push(
      `## I-94 RECORDS (rich extraction) — ${i94Entries.length} entr${i94Entries.length === 1 ? 'y' : 'ies'}\n\n${body}`,
    );
  }

  if (visaStampEntries.length > 0) {
    const body = visaStampEntries
      .map((e) => `### ${e.filename} (page count: ${e.pageCount})\n${JSON.stringify(e.visaStamp, null, 2)}`)
      .join('\n\n');
    sections.push(
      `## VISA STAMPS / I-797 (rich extraction) — ${visaStampEntries.length} entr${visaStampEntries.length === 1 ? 'y' : 'ies'}\n\n${body}`,
    );
  }

  if (vitalRecordsEntries.length > 0) {
    const body = vitalRecordsEntries
      .map((e) => {
        const label = VITAL_RECORDS_SUBTYPE_LABELS[e.vitalRecords.vital_record_subtype];
        return `### ${e.filename} — ${label} (page count: ${e.pageCount})\n${JSON.stringify(e.vitalRecords, null, 2)}`;
      })
      .join('\n\n');
    sections.push(
      `## VITAL RECORDS (rich extraction) — ${vitalRecordsEntries.length} entr${vitalRecordsEntries.length === 1 ? 'y' : 'ies'}\n\n${body}`,
    );
  }

  if (jobOfferEntries.length > 0) {
    const body = jobOfferEntries
      .map((e) => `### ${e.filename} (page count: ${e.pageCount})\n${JSON.stringify(e.jobOffer, null, 2)}`)
      .join('\n\n');
    sections.push(
      `## JOB OFFER (rich extraction) — ${jobOfferEntries.length} entr${jobOfferEntries.length === 1 ? 'y' : 'ies'}\n\n${body}`,
    );
  }

  if (serviceRecordEntries.length > 0) {
    const body = serviceRecordEntries
      .map((e) => `### ${e.filename} (page count: ${e.pageCount})\n${JSON.stringify(e.serviceRecord, null, 2)}`)
      .join('\n\n');
    sections.push(
      `## SERVICE RECORDS (rich extraction) — ${serviceRecordEntries.length} entr${serviceRecordEntries.length === 1 ? 'y' : 'ies'}\n\n${body}`,
    );
  }

  if (cvEntries.length > 0) {
    const body = cvEntries
      .map((e) => `### ${e.filename} (page count: ${e.pageCount})\n${JSON.stringify(e.cv, null, 2)}`)
      .join('\n\n');
    sections.push(
      `## CV (rich extraction) — ${cvEntries.length} entr${cvEntries.length === 1 ? 'y' : 'ies'}\n\n${body}`,
    );
  }

  if (credentialEntries.length > 0) {
    const body = credentialEntries
      .map((e) => {
        const label = CREDENTIAL_SUBTYPE_LABELS[e.credential.credential_subtype];
        return `### ${e.filename} — ${label} (page count: ${e.pageCount})\n${JSON.stringify(e.credential, null, 2)}`;
      })
      .join('\n\n');
    sections.push(
      `## CREDENTIALS (rich extraction) — ${credentialEntries.length} entr${credentialEntries.length === 1 ? 'y' : 'ies'}\n\n${body}`,
    );
  }

  if (recommendationLetterEntries.length > 0) {
    const body = recommendationLetterEntries
      .map((e) => `### ${e.filename} (page count: ${e.pageCount})\n${JSON.stringify(e.recommendationLetter, null, 2)}`)
      .join('\n\n');
    sections.push(
      `## RECOMMENDATION LETTERS (rich extraction) — ${recommendationLetterEntries.length} entr${recommendationLetterEntries.length === 1 ? 'y' : 'ies'}\n\n${body}`,
    );
  }

  if (payrollEntries.length > 0) {
    const body = payrollEntries
      .map((e) => {
        const label = PAYROLL_SUBTYPE_LABELS[e.payroll.payroll_subtype];
        return `### ${e.filename} — ${label} (page count: ${e.pageCount})\n${JSON.stringify(e.payroll, null, 2)}`;
      })
      .join('\n\n');
    sections.push(
      `## PAYROLL (rich extraction) — ${payrollEntries.length} entr${payrollEntries.length === 1 ? 'y' : 'ies'}\n\n${body}`,
    );
  }

  if (taxReturnEntries.length > 0) {
    const body = taxReturnEntries
      .map((e) => {
        const label = TAX_RETURN_SUBTYPE_LABELS[e.taxReturn.tax_return_subtype];
        return `### ${e.filename} — ${label} (page count: ${e.pageCount})\n${JSON.stringify(e.taxReturn, null, 2)}`;
      })
      .join('\n\n');
    sections.push(
      `## TAX RETURNS (rich extraction) — ${taxReturnEntries.length} entr${taxReturnEntries.length === 1 ? 'y' : 'ies'}\n\n${body}`,
    );
  }

  if (financialStatementEntries.length > 0) {
    const body = financialStatementEntries
      .map((e) => {
        const label = FINANCIAL_STATEMENT_SUBTYPE_LABELS[e.financialStatement.statement_subtype];
        return `### ${e.filename} — ${label} (page count: ${e.pageCount})\n${JSON.stringify(e.financialStatement, null, 2)}`;
      })
      .join('\n\n');
    sections.push(
      `## FINANCIAL STATEMENTS (rich extraction) — ${financialStatementEntries.length} entr${financialStatementEntries.length === 1 ? 'y' : 'ies'}\n\n${body}`,
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

/**
 * One row from the manual §3.1 passport validity gate. ok=false when the
 * passport will expire within 6 months of filing_date; ok=true with
 * days_until_expiry=null when expiry could not be parsed.
 */
export interface PassportValidityAuditRow {
  filename: string;
  ok: boolean;
  expiry_iso: string | null;
  days_until_expiry: number | null;
  source_page: number | null;
  source_quote: string | null;
}

/** Manual §3.1 passport validity gate — pure / deterministic. */
export function runPassportValidityGate(
  memory: TypedMemory,
  filingDate: Date,
): PassportValidityAuditRow[] {
  const rows: PassportValidityAuditRow[] = [];
  for (const entry of iterMemoryEntries(memory)) {
    if (!entry.passport) continue;
    const expiryStr = entry.passport.date_of_expiration.value;
    const sourcePage = entry.passport.date_of_expiration.source_page;
    const sourceQuote = entry.passport.date_of_expiration.source_quote;
    if (!expiryStr) {
      rows.push({
        filename: entry.filename,
        ok: true,
        expiry_iso: null,
        days_until_expiry: null,
        source_page: sourcePage,
        source_quote: sourceQuote,
      });
      continue;
    }
    const expiry = new Date(expiryStr);
    if (Number.isNaN(expiry.getTime())) {
      rows.push({
        filename: entry.filename,
        ok: true,
        expiry_iso: expiryStr,
        days_until_expiry: null,
        source_page: sourcePage,
        source_quote: sourceQuote,
      });
      continue;
    }
    const days = Math.floor((expiry.getTime() - filingDate.getTime()) / 86_400_000);
    rows.push({
      filename: entry.filename,
      ok: days >= PASSPORT_VALIDITY_MIN_DAYS,
      expiry_iso: expiryStr,
      days_until_expiry: days,
      source_page: sourcePage,
      source_quote: sourceQuote,
    });
  }
  return rows;
}

/**
 * One row from the manual §3.4 I-94 status gate. ok=false when the
 * Beneficiary's admit_until_date precedes filing_date (status violation).
 * ok=true when admit_until is in the future, when D/S is in effect, or
 * when admit_until could not be parsed.
 */
export interface I94StatusAuditRow {
  filename: string;
  ok: boolean;
  admit_until_iso: string | null;
  duration_of_status: boolean;
  source_page: number | null;
  source_quote: string | null;
}

/** Manual §3.4 I-94 status-violation gate — pure / deterministic. */
export function runI94StatusGate(
  memory: TypedMemory,
  filingDate: Date,
): I94StatusAuditRow[] {
  const rows: I94StatusAuditRow[] = [];
  for (const entry of iterMemoryEntries(memory)) {
    if (!entry.i94) continue;
    const admitUntil = entry.i94.admit_until_date.value;
    const dosMarker = entry.i94.duration_of_status_marker.value === true;
    const sourcePage = entry.i94.admit_until_date.source_page;
    const sourceQuote = entry.i94.admit_until_date.source_quote;
    if (dosMarker || !admitUntil) {
      rows.push({
        filename: entry.filename,
        ok: true,
        admit_until_iso: admitUntil,
        duration_of_status: dosMarker,
        source_page: sourcePage,
        source_quote: sourceQuote,
      });
      continue;
    }
    const admit = new Date(admitUntil);
    if (Number.isNaN(admit.getTime())) {
      rows.push({
        filename: entry.filename,
        ok: true,
        admit_until_iso: admitUntil,
        duration_of_status: false,
        source_page: sourcePage,
        source_quote: sourceQuote,
      });
      continue;
    }
    rows.push({
      filename: entry.filename,
      ok: admit.getTime() >= filingDate.getTime(),
      admit_until_iso: admitUntil,
      duration_of_status: false,
      source_page: sourcePage,
      source_quote: sourceQuote,
    });
  }
  return rows;
}

/**
 * One row from the manual §12.3 / §12.4 translation-certification gate.
 * ok=false when certified_translation_present.value === false; null /
 * unknown values are not treated as failures (the upstream extractor
 * couldn't determine).
 */
export interface TranslationGateAuditRow {
  filename: string;
  vital_record_subtype: string;
  ok: boolean;
  certified_translation_present: boolean | null;
  translator_name: string | null;
  source_page: number | null;
  source_quote: string | null;
}

/** Manual §12.3 / §12.4 translation-certification gate — pure / deterministic. */
export function runTranslationGate(memory: TypedMemory): TranslationGateAuditRow[] {
  const rows: TranslationGateAuditRow[] = [];
  for (const entry of iterMemoryEntries(memory)) {
    if (!entry.vitalRecords) continue;
    const present = entry.vitalRecords.certified_translation_present.value;
    rows.push({
      filename: entry.filename,
      vital_record_subtype: entry.vitalRecords.vital_record_subtype,
      ok: present !== false,
      certified_translation_present: present,
      translator_name: entry.vitalRecords.translator_name.value,
      source_page: entry.vitalRecords.certified_translation_present.source_page,
      source_quote: entry.vitalRecords.certified_translation_present.source_quote,
    });
  }
  return rows;
}

/* ---------------------------------------------------------------------- */
/* Subtype-4 employee gates                                                */
/* ---------------------------------------------------------------------- */

/**
 * Manual MANUAL-SUBTYPE-4 §3.7 (salary-vs-benchmark gate). Compares the
 * job-offer's annual salary (USD) against a position+geography industry
 * benchmark.
 *
 * TODO: a salary-benchmark column / lookup is not yet wired into the
 * code base — we have no occupational-salary table, no BLS / OEWS feed,
 * and the service-record extractor's optional benchmark field is rare.
 * For now the gate plumbing is in place but the comparison short-
 * circuits to ok=true with reason='benchmark_not_yet_wired'. When the
 * benchmark feed is added, swap that branch for the real comparison.
 */
export interface SalaryBenchmarkAuditRow {
  filename: string;
  ok: boolean;
  reason: 'benchmark_not_yet_wired' | 'below_benchmark' | 'no_salary' | 'ok';
  annual_salary_usd: number | null;
  annual_salary_currency: string | null;
  benchmark_usd: number | null;
  source_page: number | null;
  source_quote: string | null;
}

export function runSalaryBenchmarkGate(
  memory: TypedMemory,
): SalaryBenchmarkAuditRow[] {
  const rows: SalaryBenchmarkAuditRow[] = [];
  for (const entry of iterMemoryEntries(memory)) {
    if (!entry.jobOffer) continue;
    const salary = entry.jobOffer.annual_salary_amount.value;
    const currency = entry.jobOffer.annual_salary_currency.value;
    const sourcePage = entry.jobOffer.annual_salary_amount.source_page;
    const sourceQuote = entry.jobOffer.annual_salary_amount.source_quote;
    if (salary == null) {
      rows.push({
        filename: entry.filename,
        ok: true,
        reason: 'no_salary',
        annual_salary_usd: null,
        annual_salary_currency: currency,
        benchmark_usd: null,
        source_page: sourcePage,
        source_quote: sourceQuote,
      });
      continue;
    }
    // Benchmark feed not yet wired — see TODO above. Plumb the gate
    // anyway so the audit row + downstream conflict-register entry
    // already exist for when the lookup arrives.
    rows.push({
      filename: entry.filename,
      ok: true,
      reason: 'benchmark_not_yet_wired',
      annual_salary_usd: currency === 'USD' ? salary : null,
      annual_salary_currency: currency,
      benchmark_usd: null,
      source_page: sourcePage,
      source_quote: sourceQuote,
    });
  }
  return rows;
}

/**
 * Manual MANUAL-SUBTYPE-4 §3.3.2 (cv ↔ job-offer title drift gate).
 * Tokenizes both titles into lowercase word sets, drops stop-words, and
 * computes Jaccard. ok=false when |intersection| / |union| < threshold.
 */
export interface CvTitleDriftAuditRow {
  cv_filename: string;
  job_offer_filename: string;
  ok: boolean;
  jaccard: number | null;
  cv_title: string | null;
  job_offer_title: string | null;
  cv_source_page: number | null;
  cv_source_quote: string | null;
  job_offer_source_page: number | null;
  job_offer_source_quote: string | null;
}

const STOPWORDS = new Set([
  'the',
  'and',
  'of',
  'a',
  'an',
  'in',
  'for',
  'to',
  'at',
  'by',
  'with',
]);

function tokenizeTitle(title: string | null | undefined): Set<string> {
  if (!title) return new Set();
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOPWORDS.has(w)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const v of a) if (b.has(v)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 1 : inter / union;
}

export function runCvTitleDriftGate(
  memory: TypedMemory,
): CvTitleDriftAuditRow[] {
  const cvs: { filename: string; cv: CvFacts }[] = [];
  const offers: { filename: string; jobOffer: JobOfferFacts }[] = [];
  for (const entry of iterMemoryEntries(memory)) {
    if (entry.cv) cvs.push({ filename: entry.filename, cv: entry.cv });
    if (entry.jobOffer) offers.push({ filename: entry.filename, jobOffer: entry.jobOffer });
  }
  const rows: CvTitleDriftAuditRow[] = [];
  for (const cv of cvs) {
    for (const offer of offers) {
      const cvTitle = cv.cv.current_position_title.value;
      const offerTitle = offer.jobOffer.position_title.value;
      const cvTokens = tokenizeTitle(cvTitle);
      const offerTokens = tokenizeTitle(offerTitle);
      const j =
        cvTokens.size === 0 && offerTokens.size === 0 ? null : jaccard(cvTokens, offerTokens);
      rows.push({
        cv_filename: cv.filename,
        job_offer_filename: offer.filename,
        ok: j == null ? true : j >= CV_TITLE_JACCARD_THRESHOLD,
        jaccard: j,
        cv_title: cvTitle,
        job_offer_title: offerTitle,
        cv_source_page: cv.cv.current_position_title.source_page,
        cv_source_quote: cv.cv.current_position_title.source_quote,
        job_offer_source_page: offer.jobOffer.position_title.source_page,
        job_offer_source_quote: offer.jobOffer.position_title.source_quote,
      });
    }
  }
  return rows;
}

/**
 * Manual MANUAL-SUBTYPE-4 §3.3.6 (personal-reference letter gate).
 * ok=false when letter_kind === 'personal' (prior-employer / academic
 * letters carry the firm's evidentiary weight). Flagged severity 3.
 */
export interface PersonalReferenceAuditRow {
  filename: string;
  ok: boolean;
  letter_kind: string | null;
  source_page: number | null;
  source_quote: string | null;
}

export function runPersonalReferenceGate(
  memory: TypedMemory,
): PersonalReferenceAuditRow[] {
  const rows: PersonalReferenceAuditRow[] = [];
  for (const entry of iterMemoryEntries(memory)) {
    if (!entry.recommendationLetter) continue;
    const kind = entry.recommendationLetter.letter_kind.value;
    rows.push({
      filename: entry.filename,
      ok: kind !== 'personal',
      letter_kind: kind,
      source_page: entry.recommendationLetter.letter_kind.source_page,
      source_quote: entry.recommendationLetter.letter_kind.source_quote,
    });
  }
  return rows;
}

/**
 * Manual MANUAL-SUBTYPE-4 §3.3.4 / §3.5 (foreign-diploma verifiability
 * gate). For credential_subtype='diploma' issued by a foreign institution,
 * apostille_or_legalization_present must be true. ok=false when the
 * diploma is missing both apostille and consular legalization.
 */
export interface CredentialVerifiabilityAuditRow {
  filename: string;
  ok: boolean;
  credential_subtype: string;
  apostille_or_legalization_present: boolean | null;
  institution_country: string | null;
  source_page: number | null;
  source_quote: string | null;
}

export function runCredentialVerifiabilityGate(
  memory: TypedMemory,
): CredentialVerifiabilityAuditRow[] {
  const rows: CredentialVerifiabilityAuditRow[] = [];
  for (const entry of iterMemoryEntries(memory)) {
    if (!entry.credential) continue;
    if (entry.credential.credential_subtype !== 'diploma') continue;
    const apostille = entry.credential.apostille_or_legalization_present.value;
    rows.push({
      filename: entry.filename,
      ok: apostille !== false,
      credential_subtype: entry.credential.credential_subtype,
      apostille_or_legalization_present: apostille,
      institution_country: entry.credential.institution_country.value,
      source_page: entry.credential.apostille_or_legalization_present.source_page,
      source_quote: entry.credential.apostille_or_legalization_present.source_quote,
    });
  }
  return rows;
}

/**
 * Marginality evidence cues derived deterministically from the typed
 * memory. Sibling to `DefensiveParagraphsRequired` — different semantic
 * axis (defensive paragraphs vs. evidence presence), so it lives in its
 * own object. The drafter consults this to decide whether the §9
 * "more than marginal" narrative is supportable from the file.
 */
export interface MarginalityEvidencePresent {
  /**
   * True when the typed memory contains at least one payroll_register or
   * employee_list with employee_count_excluding_beneficiary ≥ 1. Indicates
   * the Petitioner employs ≥1 U.S. worker beyond the Beneficiary, which
   * supports the §9 marginality narrative under 9 FAM 402.9-6(D).
   */
  us_workers_employed: boolean;
}

/** Compute marginality cues from the typed memory. Pure / deterministic. */
export function computeMarginalityEvidencePresent(
  memory: TypedMemory,
): MarginalityEvidencePresent {
  let usWorkersEmployed = false;
  for (const entry of iterMemoryEntries(memory)) {
    if (!entry.payroll) continue;
    if (
      entry.payroll.payroll_subtype !== 'payroll_register' &&
      entry.payroll.payroll_subtype !== 'employee_list'
    ) {
      continue;
    }
    const count = entry.payroll.employee_count_excluding_beneficiary.value;
    if (count != null && count >= 1) {
      usWorkersEmployed = true;
      break;
    }
  }
  return { us_workers_employed: usWorkersEmployed };
}

/**
 * One row from the manual §9 / §4 tax-balance-sheet vs investment gate.
 * ok=false when |schedule_l_total_assets_end − I-129E investment_amount| /
 * I-129E investment_amount exceeds TAX_BALANCE_SHEET_GATE_TOLERANCE (25%).
 * ok=true with relative_drift=null when the gate cannot run (one input
 * missing).
 */
export interface TaxBalanceSheetAuditRow {
  filename: string;
  ok: boolean;
  relative_drift: number | null;
  schedule_l_total_assets_end: number | null;
  i129e_investment_usd: number | null;
  source_page: number | null;
  source_quote: string | null;
}

/** Manual §9 / §4 tax-balance-sheet gate — pure / deterministic. */
export function runTaxBalanceSheetGate(
  memory: TypedMemory,
): TaxBalanceSheetAuditRow[] {
  // Pull the I-129 E Supplement investment amount once; the gate compares
  // every Schedule-L-bearing tax return against it.
  let i129eAmount: number | null = null;
  for (const entry of iterMemoryEntries(memory)) {
    if (entry.facts?.doc_type !== 'uscis_or_dos_form') continue;
    const formId = entry.facts.form_id.value ?? '';
    if (!/i[-\s]?129\s*e/i.test(formId)) continue;
    const amount = entry.facts.investment_amount_usd.value;
    if (amount != null) {
      i129eAmount = amount;
      break;
    }
  }

  const rows: TaxBalanceSheetAuditRow[] = [];
  for (const entry of iterMemoryEntries(memory)) {
    if (!entry.taxReturn) continue;
    if (!hasScheduleL(entry.taxReturn)) continue;
    const eoy = entry.taxReturn.schedule_l_total_assets_end.value;
    const sourcePage = entry.taxReturn.schedule_l_total_assets_end.source_page;
    const sourceQuote = entry.taxReturn.schedule_l_total_assets_end.source_quote;

    if (eoy == null || i129eAmount == null || i129eAmount === 0) {
      rows.push({
        filename: entry.filename,
        ok: true,
        relative_drift: null,
        schedule_l_total_assets_end: eoy,
        i129e_investment_usd: i129eAmount,
        source_page: sourcePage,
        source_quote: sourceQuote,
      });
      continue;
    }
    const drift = Math.abs(eoy - i129eAmount) / Math.abs(i129eAmount);
    rows.push({
      filename: entry.filename,
      ok: drift <= TAX_BALANCE_SHEET_GATE_TOLERANCE,
      relative_drift: drift,
      schedule_l_total_assets_end: eoy,
      i129e_investment_usd: i129eAmount,
      source_page: sourcePage,
      source_quote: sourceQuote,
    });
  }
  return rows;
}

/**
 * One row from the manual §9 P&L-vs-tax-return net-income gate. Pairs
 * each P&L (or combined_statements) with the tax-return covering the
 * matching tax year; ok=false when |net_income drift| > $1,000.
 */
export interface PlTaxNetIncomeAuditRow {
  pl_filename: string;
  tax_filename: string;
  tax_year: string;
  ok: boolean;
  drift_usd: number | null;
  pl_net_income: number | null;
  tax_net_income: number | null;
  source_page: number | null;
  source_quote: string | null;
}

/**
 * Pull the YYYY year from a P&L period_end (ISO YYYY-MM-DD), the
 * combined_statements period_end, or null if not parseable. The tax
 * return uses tax_year directly.
 */
function plYearFromFinancialStatement(
  facts: FinancialStatementFacts,
): string | null {
  if (!hasPlNetIncome(facts)) return null;
  const periodEnd = facts.period_end.value;
  if (!periodEnd) return null;
  const match = /^(\d{4})/.exec(periodEnd);
  return match ? match[1] : null;
}

/** Manual §9 P&L vs tax-return net-income gate — pure / deterministic. */
export function runPlTaxNetIncomeGate(
  memory: TypedMemory,
): PlTaxNetIncomeAuditRow[] {
  // Index tax returns by tax_year.value for cheap lookup. The tax-return
  // schema stores tax_year as a Field<string>, so we read .value.
  const taxByYear = new Map<
    string,
    { filename: string; netIncome: number | null }
  >();
  for (const entry of iterMemoryEntries(memory)) {
    if (!entry.taxReturn) continue;
    const year = entry.taxReturn.tax_year.value;
    if (!year) continue;
    if (taxByYear.has(year)) continue;
    taxByYear.set(year, {
      filename: entry.filename,
      netIncome: entry.taxReturn.net_income_or_loss_amount.value,
    });
  }

  const rows: PlTaxNetIncomeAuditRow[] = [];
  for (const entry of iterMemoryEntries(memory)) {
    if (!entry.financialStatement) continue;
    if (!hasPlNetIncome(entry.financialStatement)) continue;
    const year = plYearFromFinancialStatement(entry.financialStatement);
    if (!year) continue;
    const taxRow = taxByYear.get(year);
    if (!taxRow) continue;

    const plNet = entry.financialStatement.net_income_amount.value;
    const taxNet = taxRow.netIncome;
    const sourcePage = entry.financialStatement.net_income_amount.source_page;
    const sourceQuote = entry.financialStatement.net_income_amount.source_quote;

    if (plNet == null || taxNet == null) {
      rows.push({
        pl_filename: entry.filename,
        tax_filename: taxRow.filename,
        tax_year: year,
        ok: true,
        drift_usd: null,
        pl_net_income: plNet,
        tax_net_income: taxNet,
        source_page: sourcePage,
        source_quote: sourceQuote,
      });
      continue;
    }
    const drift = Math.abs(plNet - taxNet);
    rows.push({
      pl_filename: entry.filename,
      tax_filename: taxRow.filename,
      tax_year: year,
      ok: drift <= PL_TAX_GATE_TOLERANCE_USD,
      drift_usd: drift,
      pl_net_income: plNet,
      tax_net_income: taxNet,
      source_page: sourcePage,
      source_quote: sourceQuote,
    });
  }
  return rows;
}

export async function aggregateTypedMemoryToE2(
  memory: TypedMemory,
  options?: { filingDate?: Date; aliases?: Record<string, FilenameAlias> },
): Promise<{
  caseFacts: E2Facts;
  usage: AggregateUsage;
  defensive_paragraphs_required: DefensiveParagraphsRequired;
  marginality_evidence_present: MarginalityEvidencePresent;
  fx_gate_results: FxGateAuditRow[];
  passport_validity_results: PassportValidityAuditRow[];
  i94_status_results: I94StatusAuditRow[];
  translation_gate_results: TranslationGateAuditRow[];
  salary_benchmark_results: SalaryBenchmarkAuditRow[];
  cv_title_drift_results: CvTitleDriftAuditRow[];
  personal_reference_results: PersonalReferenceAuditRow[];
  credential_verifiability_results: CredentialVerifiabilityAuditRow[];
  tax_balance_sheet_results: TaxBalanceSheetAuditRow[];
  pl_tax_net_income_results: PlTaxNetIncomeAuditRow[];
}> {
  const memoryBlock = memoryToPromptText(memory);
  const inventoryBlock = buildDocInventoryWithAliases(memory, options?.aliases);
  const inventorySection = inventoryBlock ? `\n\n${inventoryBlock}` : '';
  const userMessage = `${USER_INSTRUCTION}${inventorySection}\n\n# Typed memory\n\n${memoryBlock}\n\nRespond with ONLY a single JSON object matching the E2FactsSchema. No prose, no markdown fences, no commentary.`;

  // Pre-flight token count (free; observability only). Surfaces growth in
  // typed memory before it lands as a request the API truncates or
  // refuses. Threshold is well below Sonnet 4.6's context ceiling — this
  // is an early-warning, not a hard gate. Failure is non-fatal.
  const PREFLIGHT_WARN_TOKENS = 150_000;
  try {
    const count = await countMessageTokens({
      model: 'claude-sonnet-4-6',
      system: [{ type: 'text', text: SYSTEM_PROMPT }],
      messages: [{ role: 'user', content: userMessage }],
    });
    if (count.input_tokens > PREFLIGHT_WARN_TOKENS) {
      console.warn(
        `[typed-aggregate] input_tokens=${count.input_tokens} exceeds ${PREFLIGHT_WARN_TOKENS} threshold; review schema growth.`,
      );
    }
  } catch (e: unknown) {
    console.warn(
      '[typed-aggregate] countTokens failed:',
      e instanceof Error ? e.message : String(e),
    );
  }

  // Anthropic's structured-output (messages.parse) caps at 16 union/nullable
  // parameters per schema. E2FactsSchema has ~176 (every Field<T> leaf is a
  // 4-way nullable). Use messages.create + manual JSON parse + Zod validate
  // — same pattern as ingest/claude.ts extractFactsByCaseType.
  // Adaptive thinking is kept (cross-document reconciliation is genuinely
  // multi-step: source-of-funds chains, ownership reconciliation, conflict
  // detection across heterogeneous sources). Effort is bounded to 'low'
  // because the §4.5 deterministic gate below covers the highest-stakes
  // failure (contract vs I-129E investment drift) and the conflict_register
  // severity rubric in the system prompt does most of the constraining.
  // This trades roughly 5-15K extra thinking tokens for ~$0.10-$0.20/case.
  const response = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low' },
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

  // Manual §5.2.1 FX validation gate: deterministic backstop. For every
  // international_wire_with_fx whose source × rate disagrees with the
  // target beyond FX_GATE_TOLERANCE, append a severity-3 conflict.
  // Idempotent: skips if the aggregator already logged the same
  // conflict_type for the same document.
  const fxRows = runFxValidationGate(memory);
  for (const row of fxRows) {
    if (row.ok) continue;
    const alreadyLogged = parsed.data.conflict_register.some(
      (c) =>
        c.conflict_type.value === 'fx_rate_drift' &&
        c.fact_a_doc.value === row.filename,
    );
    if (alreadyLogged) continue;
    const driftPct =
      row.relative_drift != null ? (row.relative_drift * 100).toFixed(2) : 'n/a';
    const provenance = findFxWireProvenance(memory, row.filename);
    parsed.data.conflict_register.push({
      description: {
        value: `FX validation gate failed: |source ${row.source_amount ?? '?'} ${row.source_currency ?? ''} × rate ${row.exchange_rate ?? '?'} − target ${row.target_amount ?? '?'} ${row.target_currency ?? ''}| / target = ${driftPct}% (tolerance ${(FX_GATE_TOLERANCE * 100).toFixed(0)}%). Manual §5.2.1 gate.`,
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      conflict_type: {
        value: 'fx_rate_drift',
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      severity: {
        value: 3,
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      fact_a_doc: {
        value: row.filename,
        source_page: provenance.page,
        source_quote: provenance.quote,
        confidence: 1,
      },
      fact_a_page: {
        value: provenance.page,
        source_page: provenance.page,
        source_quote: provenance.quote,
        confidence: 1,
      },
      fact_b_doc: {
        value: row.filename,
        source_page: provenance.page,
        source_quote: provenance.quote,
        confidence: 1,
      },
      fact_b_page: {
        value: provenance.page,
        source_page: provenance.page,
        source_quote: provenance.quote,
        confidence: 1,
      },
    });
  }

  // Manual §3.1 passport validity gate (≥ 6 months from filing).
  // filing_date defaults to "now" — the typical pipeline treats the
  // ingest run as proxy for filing day. Caller can override via options.
  const filingDate = options?.filingDate ?? new Date();
  const passportRows = runPassportValidityGate(memory, filingDate);
  for (const row of passportRows) {
    if (row.ok) continue;
    const alreadyLogged = parsed.data.conflict_register.some(
      (c) =>
        c.conflict_type.value === 'passport_expires_soon' &&
        c.fact_a_doc.value === row.filename,
    );
    if (alreadyLogged) continue;
    parsed.data.conflict_register.push({
      description: {
        value: `Passport expires ${row.expiry_iso ?? 'unknown'} — ${row.days_until_expiry ?? '?'} days from filing (manual §3.1 requires ≥ ${PASSPORT_VALIDITY_MIN_DAYS} days).`,
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      conflict_type: {
        value: 'passport_expires_soon',
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      severity: {
        value: 3,
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      fact_a_doc: {
        value: row.filename,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
      fact_a_page: {
        value: row.source_page,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
      fact_b_doc: {
        value: row.filename,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
      fact_b_page: {
        value: row.source_page,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
    });
  }

  // Manual §3.4 I-94 status-violation gate (admit_until_date ≥ filing_date).
  const i94Rows = runI94StatusGate(memory, filingDate);
  for (const row of i94Rows) {
    if (row.ok) continue;
    const alreadyLogged = parsed.data.conflict_register.some(
      (c) =>
        c.conflict_type.value === 'status_violation_at_filing' &&
        c.fact_a_doc.value === row.filename,
    );
    if (alreadyLogged) continue;
    parsed.data.conflict_register.push({
      description: {
        value: `I-94 admit-until ${row.admit_until_iso ?? 'unknown'} precedes filing date — Beneficiary is out of status at filing (manual §3.4).`,
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      conflict_type: {
        value: 'status_violation_at_filing',
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
        value: row.filename,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
      fact_a_page: {
        value: row.source_page,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
      fact_b_doc: {
        value: row.filename,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
      fact_b_page: {
        value: row.source_page,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
    });
  }

  // Manual §12.3 / §12.4 translation-certification gate.
  const translationRows = runTranslationGate(memory);
  for (const row of translationRows) {
    if (row.ok) continue;
    const alreadyLogged = parsed.data.conflict_register.some(
      (c) =>
        c.conflict_type.value === 'translation_certification_missing' &&
        c.fact_a_doc.value === row.filename,
    );
    if (alreadyLogged) continue;
    parsed.data.conflict_register.push({
      description: {
        value: `Vital record (${row.vital_record_subtype}) lacks a competent translator's certification — manual §12 quality gate failed.`,
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      conflict_type: {
        value: 'translation_certification_missing',
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      severity: {
        value: 3,
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      fact_a_doc: {
        value: row.filename,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
      fact_a_page: {
        value: row.source_page,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
      fact_b_doc: {
        value: row.filename,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
      fact_b_page: {
        value: row.source_page,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
    });
  }

  // Manual MANUAL-SUBTYPE-4 §3.7 salary-vs-benchmark gate. The benchmark
  // feed is not yet wired (see runSalaryBenchmarkGate's TODO); the gate
  // currently short-circuits to ok=true. The plumbing below already
  // emits the conflict_register entry on a future ok=false so callers
  // get the contract today.
  const salaryRows = runSalaryBenchmarkGate(memory);
  for (const row of salaryRows) {
    if (row.ok) continue;
    const alreadyLogged = parsed.data.conflict_register.some(
      (c) =>
        c.conflict_type.value === 'salary_below_benchmark' &&
        c.fact_a_doc.value === row.filename,
    );
    if (alreadyLogged) continue;
    parsed.data.conflict_register.push({
      description: {
        value: `Job offer salary USD ${row.annual_salary_usd ?? '?'} below industry benchmark USD ${row.benchmark_usd ?? '?'} (manual MANUAL-SUBTYPE-4 §3.7).`,
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      conflict_type: {
        value: 'salary_below_benchmark',
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      severity: {
        value: 3,
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      fact_a_doc: {
        value: row.filename,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
      fact_a_page: {
        value: row.source_page,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
      fact_b_doc: {
        value: row.filename,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
      fact_b_page: {
        value: row.source_page,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
    });
  }

  // Manual MANUAL-SUBTYPE-4 §3.3.2 cv ↔ job-offer title drift gate.
  const cvDriftRows = runCvTitleDriftGate(memory);
  for (const row of cvDriftRows) {
    if (row.ok) continue;
    const alreadyLogged = parsed.data.conflict_register.some(
      (c) =>
        c.conflict_type.value === 'cv_title_vs_offer_drift' &&
        c.fact_a_doc.value === row.cv_filename &&
        c.fact_b_doc.value === row.job_offer_filename,
    );
    if (alreadyLogged) continue;
    const j = row.jaccard != null ? row.jaccard.toFixed(2) : 'n/a';
    parsed.data.conflict_register.push({
      description: {
        value: `CV current_position_title "${row.cv_title ?? '?'}" diverges from job-offer position_title "${row.job_offer_title ?? '?'}" (Jaccard ${j} < ${CV_TITLE_JACCARD_THRESHOLD}).`,
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      conflict_type: {
        value: 'cv_title_vs_offer_drift',
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      severity: {
        value: 2,
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      fact_a_doc: {
        value: row.cv_filename,
        source_page: row.cv_source_page,
        source_quote: row.cv_source_quote,
        confidence: 1,
      },
      fact_a_page: {
        value: row.cv_source_page,
        source_page: row.cv_source_page,
        source_quote: row.cv_source_quote,
        confidence: 1,
      },
      fact_b_doc: {
        value: row.job_offer_filename,
        source_page: row.job_offer_source_page,
        source_quote: row.job_offer_source_quote,
        confidence: 1,
      },
      fact_b_page: {
        value: row.job_offer_source_page,
        source_page: row.job_offer_source_page,
        source_quote: row.job_offer_source_quote,
        confidence: 1,
      },
    });
  }

  // Manual MANUAL-SUBTYPE-4 §3.3.6 personal-reference gate.
  const personalRefRows = runPersonalReferenceGate(memory);
  for (const row of personalRefRows) {
    if (row.ok) continue;
    const alreadyLogged = parsed.data.conflict_register.some(
      (c) =>
        c.conflict_type.value === 'personal_reference_letter' &&
        c.fact_a_doc.value === row.filename,
    );
    if (alreadyLogged) continue;
    parsed.data.conflict_register.push({
      description: {
        value: `Recommendation letter classified as letter_kind='personal' — Subtype 4 specialized-knowledge requires prior-employer / academic letters (manual §3.3.6).`,
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      conflict_type: {
        value: 'personal_reference_letter',
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      severity: {
        value: 3,
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      fact_a_doc: {
        value: row.filename,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
      fact_a_page: {
        value: row.source_page,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
      fact_b_doc: {
        value: row.filename,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
      fact_b_page: {
        value: row.source_page,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
    });
  }

  // Manual MANUAL-SUBTYPE-4 §3.3.4 / §3.5 credential-verifiability gate.
  const credentialRows = runCredentialVerifiabilityGate(memory);
  for (const row of credentialRows) {
    if (row.ok) continue;
    const alreadyLogged = parsed.data.conflict_register.some(
      (c) =>
        c.conflict_type.value === 'credential_unverifiable' &&
        c.fact_a_doc.value === row.filename,
    );
    if (alreadyLogged) continue;
    parsed.data.conflict_register.push({
      description: {
        value: `Foreign diploma (${row.institution_country ?? 'country unknown'}) lacks apostille / consular legalization — manual §3.5 verifiability gate failed.`,
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      conflict_type: {
        value: 'credential_unverifiable',
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      severity: {
        value: 3,
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      fact_a_doc: {
        value: row.filename,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
      fact_a_page: {
        value: row.source_page,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
      fact_b_doc: {
        value: row.filename,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
      fact_b_page: {
        value: row.source_page,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
    });
  }

  // Manual §9 / §4 tax-balance-sheet gate: deterministic backstop.
  // |Schedule L EOY assets − I-129E investment_amount_usd| / I-129E
  // investment_amount_usd > 25% → severity-3 conflict. Idempotent:
  // skip when same conflict_type + fact_a_doc already logged.
  const taxBalanceSheetRows = runTaxBalanceSheetGate(memory);
  for (const row of taxBalanceSheetRows) {
    if (row.ok) continue;
    if (row.relative_drift == null) continue;
    const alreadyLogged = parsed.data.conflict_register.some(
      (c) =>
        c.conflict_type.value === 'tax_balance_sheet_drift' &&
        c.fact_a_doc.value === row.filename,
    );
    if (alreadyLogged) continue;
    const driftPct = (row.relative_drift * 100).toFixed(2);
    const tolerancePct = (TAX_BALANCE_SHEET_GATE_TOLERANCE * 100).toFixed(0);
    parsed.data.conflict_register.push({
      description: {
        value: `Tax-return Schedule L total assets EOY USD ${row.schedule_l_total_assets_end?.toFixed(2) ?? '?'} disagrees with I-129 E Supplement investment USD ${row.i129e_investment_usd?.toFixed(2) ?? '?'} (drift ${driftPct}%, tolerance ${tolerancePct}%). Manual §9 gate.`,
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      conflict_type: {
        value: 'tax_balance_sheet_drift',
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      severity: {
        value: 3,
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      fact_a_doc: {
        value: row.filename,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
      fact_a_page: {
        value: row.source_page,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
      fact_b_doc: {
        value: row.filename,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
      fact_b_page: {
        value: row.source_page,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
    });
  }

  // Manual §9 P&L vs tax-return net-income gate: deterministic backstop.
  // |P&L net_income − tax-return net_income_or_loss| > $1,000 for the
  // matching tax year → severity-3 conflict. Idempotent on
  // (conflict_type, fact_a_doc=pl, fact_b_doc=tax).
  const plTaxNetIncomeRows = runPlTaxNetIncomeGate(memory);
  for (const row of plTaxNetIncomeRows) {
    if (row.ok) continue;
    if (row.drift_usd == null) continue;
    const alreadyLogged = parsed.data.conflict_register.some(
      (c) =>
        c.conflict_type.value === 'pl_tax_net_income_drift' &&
        c.fact_a_doc.value === row.pl_filename &&
        c.fact_b_doc.value === row.tax_filename,
    );
    if (alreadyLogged) continue;
    parsed.data.conflict_register.push({
      description: {
        value: `P&L net income USD ${row.pl_net_income?.toFixed(2) ?? '?'} disagrees with tax-return net income USD ${row.tax_net_income?.toFixed(2) ?? '?'} for tax year ${row.tax_year} (drift USD ${row.drift_usd.toFixed(2)}, tolerance USD ${PL_TAX_GATE_TOLERANCE_USD}). Manual §9 gate.`,
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      conflict_type: {
        value: 'pl_tax_net_income_drift',
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      severity: {
        value: 3,
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      fact_a_doc: {
        value: row.pl_filename,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
      fact_a_page: {
        value: row.source_page,
        source_page: row.source_page,
        source_quote: row.source_quote,
        confidence: 1,
      },
      fact_b_doc: {
        value: row.tax_filename,
        source_page: null,
        source_quote: null,
        confidence: 1,
      },
      fact_b_page: {
        value: null,
        source_page: null,
        source_quote: null,
        confidence: 1,
      },
    });
  }

  return {
    caseFacts: parsed.data,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
    defensive_paragraphs_required: computeDefensiveParagraphsRequired(memory),
    marginality_evidence_present: computeMarginalityEvidencePresent(memory),
    fx_gate_results: fxRows,
    passport_validity_results: passportRows,
    i94_status_results: i94Rows,
    translation_gate_results: translationRows,
    salary_benchmark_results: salaryRows,
    cv_title_drift_results: cvDriftRows,
    personal_reference_results: personalRefRows,
    credential_verifiability_results: credentialRows,
    tax_balance_sheet_results: taxBalanceSheetRows,
    pl_tax_net_income_results: plTaxNetIncomeRows,
  };
}
