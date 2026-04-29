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
import { resolveSubApplicationAlias } from '@/lib/case-folder-aliases';
import { E2FactsSchema, type E2Facts } from './schema';
import {
  DOC_TYPE_LABELS,
  type PerPdfResult,
  type TypedMemory,
  type SubstantialityReconResult,
  type SubstantialityReconEvidence,
  type EntityCoherenceResult,
  type EntityNameOccurrence,
  type EntityNameGroup,
} from './typed-memory';
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
import {
  CORPORATE_FORMATION_SUBTYPE_LABELS,
  type CorporateFormationFacts,
} from './extractors/corporate-formation.schema';
import {
  FOREIGN_CORPORATE_SUBTYPE_LABELS,
  TREATY_OWNERSHIP_THRESHOLD,
  type ForeignCorporateFacts,
} from './extractors/foreign-corporate.schema';
import {
  IMAGE_PHOTO_SUBTYPE_LABELS,
  type ImagePhotoFacts,
} from './extractors/image-photo.schema';
import type { CustomerContractFacts } from './extractors/customer-contract.schema';
import type { RealEstatePurchaseFacts } from './extractors/real-estate-purchase.schema';
import type { IncentiveDocumentFacts } from './extractors/incentive-document.schema';

/** Tolerance for the manual §4.5 quality gate (USD). */
const CONSIDERATION_GATE_TOLERANCE_USD = 100;

/**
 * Manual §6 board-resolution gate: |authorized_amount_usd −
 * I-129E investment_amount_usd| / I-129E_amount must be ≤ 10%. Drift
 * beyond 10% = severity 4 (factual_material, attorney escalation).
 */
const BOARD_RESOLUTION_DRIFT_TOLERANCE = 0.1;

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
- Manual §3.2 (Treaty-national ownership gate). When the typed memory contains a foreign-corporate shareholder_register, treaty_national_ownership_percent MUST be ≥ 50 (9 FAM 402.9-4(B)). Below 50 = severity 5 conflict_register entry with conflict_type='treaty_ownership_below_50'. Populate fact_a_doc with the shareholder-register filename. The infrastructure runs this gate deterministically.
- Manual §6 (Board-resolution authorized-amount drift gate). When the typed memory contains a foreign-corporate board_resolution with authorized_amount_usd populated AND the I-129 E Supplement's investment_amount_usd is known, |authorized_amount_usd − I-129E investment_amount_usd| / I-129E investment_amount_usd MUST be ≤ 10%. Drift beyond 10% = severity 4 conflict_register entry with conflict_type='board_resolution_amount_drift'. Populate fact_a_doc with the board-resolution filename and fact_b_doc with the I-129E filename. The infrastructure runs this gate deterministically.
- Manual MANUAL-SUBTYPE-4 §3.8.5 (Real-estate buyer-mismatch gate). When the typed memory contains a real-estate purchase whose buyer_legal_name does NOT match the Petitioner enterprise.legal_name, severity 4 conflict_register entry with conflict_type='real_estate_buyer_mismatch'. Reasoning: a deed in the Beneficiary's personal name (or a sister entity) breaks the at-risk-of-the-enterprise narrative — the property is not owned by the Petitioner. The infrastructure runs this gate deterministically using a normalized legal-name comparison; logging here is preferred so the narrative reflects it.
- Manual MANUAL-SUBTYPE-4 (Incentive recipient-mismatch gate). When the typed memory contains an incentive document whose recipient_legal_name does NOT match the Petitioner enterprise.legal_name, severity 3 conflict_register entry with conflict_type='incentive_recipient_mismatch'. Reasoning: an incentive awarded to a parent / sister entity / the Beneficiary individually cannot be cited as Petitioner enterprise capacity. The infrastructure runs this gate deterministically.

DETERMINISTIC PRE-COMPUTE BLOCKS (read these BEFORE the typed memory; they exist precisely because cross-section reasoning has been unreliable):

- **INVESTOR ↔ OWNER BINDING** block. The infrastructure has already name-matched the investor (passport / I-129 beneficiary) against every member/shareholder row in every formation document. Read its **Verdict** line:
  - \`match_found\` → populate ownership_chain entries from the listed matches (one per row), inherit source_page/source_quote from the formation document, and reference the investor's role explicitly in elements_evidence.develop_and_direct_basis. Do NOT re-derive this match from raw JSON; the deterministic block is the source of truth for who owns what.
  - \`no_match\` → log a severity 4 conflict_register entry with conflict_type='investor_not_listed_as_owner', fact_a_doc set to the formation document filename(s), and DO NOT silently fabricate ownership_chain entries to paper over the gap. The principal applicant must be visible in the chain (8 CFR §214.2(e)(15) / 9 FAM 402.9-4(B)).
  - \`no_formation_doc\` / \`no_investor_name\` / \`no_member_list_subtype\` → leave ownership_chain=[] and log severity 3-4 conflict per the verdict's stated requirement.

- **SOURCE-OF-FUNDS CHAIN HINTS** block. The infrastructure has assembled candidate chains anchored on every wire confirmation, identifying upstream origin (title deed, multi-installment receipts), sending account (single-event receipts whose from_name matches the investor), the wire spine, and deployment (when receiver name-matches the enterprise). Use these chains to populate \`source_of_funds\` — one chain entry per spine wire. The 5-field SourceOfFundsChainSchema (origin_category, origin_amount_usd, origin_evidence, final_destination, notes) cannot represent the full multi-hop trace; compress the intermediate steps into \`notes\` with file references like "Property sale (tapu.pdf) → multi-installment receipts (receipts.pdf) → international wire with FX (wire.pdf) → Petitioner US account". For every chain whose issues block reports ⚠ markers, also log a severity 3 conflict_register entry with conflict_type='sof_chain_incomplete' (origin/sending unbound) or conflict_type='sof_chain_unbound' (sender ≠ investor or receiver ≠ enterprise), fact_a_doc set to the spine wire's filename. Verdict \`no_chain_evidence\` → leave source_of_funds=[] AND log severity 5 'no_sof_evidence'. Verdict \`receipts_only_no_wire\` → populate source_of_funds with partial origin entries and log severity 4 'sof_chain_incomplete'.

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

The user message includes a DOCUMENT INVENTORY block listing each PDF's raw filename, its classified doc_type, the human-readable slot-based \`display_name\` (Title Case, diacritics preserved, dot-separated), the kebab-ASCII \`suggested_filename\`, and (when applied) the attorney-accepted alias. The inventory is the source of truth for how to NAME documents in source_quote.

When source_quote prefixes a quote with a filename, use this 4-tier priority order:
1. If an applied alias exists for the PDF, use the alias (e.g., "[kacar-salih-passport-bio-page.pdf p.2] John Doe, born 1985-03-10").
2. Otherwise, if a display_name exists with confidence ≥ 0.5, use the display_name (slot-based, diacritic-preserved — the human-readable form the attorney sees in the dashboard).
3. Otherwise, if a suggested_filename exists with confidence ≥ 0.7, use the suggested_filename (kebab ASCII).
4. Otherwise, use the raw filename as it appeared in the typed memory.

Apply the same priority everywhere a filename appears in the unified output: source_quote prefixes on every Field<T>, conflict_register fact_a_doc / fact_b_doc, source_of_funds.origin_evidence, investment.items.evidence_doc. The drafter downstream cites by these names; using the display_name means the cover letter ships with attorney-readable references like "(Exhibit: Salih Kaçar · Türkiye · Passport bio page)" instead of "(Exhibit: 1709245687.pdf)".

When NO alias is applied AND BOTH display_name confidence < 0.5 AND suggested_filename confidence is below 0.7, you may flag the entry in conflict_register at severity 1-2 (cosmetic, conflict_type='filename_uncanonical') so the attorney sees it in the dashboard, but do NOT block on this — uncanonical filenames are workflow noise, not a substantive RFE risk.

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
 * display_name | suggested_filename | suggestion_confidence. The system
 * prompt's 4-tier priority rules (alias → display_name @ ≥0.5 →
 * suggested_filename @ ≥0.7 → raw) reference this table.
 */
function buildDocInventoryWithAliases(
  memory: TypedMemory,
  aliases: Record<string, FilenameAlias> = {},
): string {
  type Row = {
    pdf_path: string;
    doc_type: string;
    applied_alias: string;
    display_name: string;
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
    const dn = entry.facts && 'display_name' in entry.facts
      ? (entry.facts as { display_name?: { value: string | null; confidence: number | null } })
          .display_name
      : null;
    rows.push({
      pdf_path: entry.filename,
      doc_type: docType,
      applied_alias: aliases[entry.filename]?.alias ?? '—',
      display_name: dn?.value ?? '—',
      suggested_filename: sf?.value ?? '—',
      suggestion_confidence:
        sf?.confidence != null ? sf.confidence.toFixed(2) : '—',
    });
  }
  if (rows.length === 0) return '';

  const header =
    '| pdf_path | doc_type | applied alias | display_name | suggested_filename | suggestion confidence |\n' +
    '| --- | --- | --- | --- | --- | --- |';
  const body = rows
    .map(
      (r) =>
        `| ${r.pdf_path} | ${r.doc_type} | ${r.applied_alias} | ${r.display_name} | ${r.suggested_filename} | ${r.suggestion_confidence} |`,
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
  const corporateFormationEntries: { filename: string; pageCount: number; corporateFormation: CorporateFormationFacts }[] = [];
  const foreignCorporateEntries: { filename: string; pageCount: number; foreignCorporate: ForeignCorporateFacts }[] = [];
  const imagePhotoEntries: { filename: string; pageCount: number; imagePhoto: ImagePhotoFacts }[] = [];
  const customerContractEntries: { filename: string; pageCount: number; customerContract: CustomerContractFacts }[] = [];
  const realEstatePurchaseEntries: { filename: string; pageCount: number; realEstatePurchase: RealEstatePurchaseFacts }[] = [];
  const incentiveDocumentEntries: { filename: string; pageCount: number; incentiveDocument: IncentiveDocumentFacts }[] = [];

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
    if (entry.corporateFormation) {
      corporateFormationEntries.push({
        filename: entry.filename,
        pageCount: entry.pageCount,
        corporateFormation: entry.corporateFormation,
      });
    }
    if (entry.foreignCorporate) {
      foreignCorporateEntries.push({
        filename: entry.filename,
        pageCount: entry.pageCount,
        foreignCorporate: entry.foreignCorporate,
      });
    }
    if (entry.imagePhoto) {
      imagePhotoEntries.push({
        filename: entry.filename,
        pageCount: entry.pageCount,
        imagePhoto: entry.imagePhoto,
      });
    }
    if (entry.customerContract) {
      customerContractEntries.push({
        filename: entry.filename,
        pageCount: entry.pageCount,
        customerContract: entry.customerContract,
      });
    }
    if (entry.realEstatePurchase) {
      realEstatePurchaseEntries.push({
        filename: entry.filename,
        pageCount: entry.pageCount,
        realEstatePurchase: entry.realEstatePurchase,
      });
    }
    if (entry.incentiveDocument) {
      incentiveDocumentEntries.push({
        filename: entry.filename,
        pageCount: entry.pageCount,
        incentiveDocument: entry.incentiveDocument,
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

  if (corporateFormationEntries.length > 0) {
    const body = corporateFormationEntries
      .map((e) => {
        const label =
          CORPORATE_FORMATION_SUBTYPE_LABELS[
            e.corporateFormation.formation_doc_subtype
          ];
        return `### ${e.filename} — ${label} (page count: ${e.pageCount})\n${JSON.stringify(e.corporateFormation, null, 2)}`;
      })
      .join('\n\n');
    sections.push(
      `## CORPORATE FORMATION (rich extraction) — ${corporateFormationEntries.length} entr${corporateFormationEntries.length === 1 ? 'y' : 'ies'}\n\n${body}`,
    );
  }

  if (foreignCorporateEntries.length > 0) {
    const body = foreignCorporateEntries
      .map((e) => {
        const label =
          FOREIGN_CORPORATE_SUBTYPE_LABELS[
            e.foreignCorporate.foreign_doc_subtype
          ];
        return `### ${e.filename} — ${label} (page count: ${e.pageCount})\n${JSON.stringify(e.foreignCorporate, null, 2)}`;
      })
      .join('\n\n');
    sections.push(
      `## FOREIGN CORPORATE (rich extraction) — ${foreignCorporateEntries.length} entr${foreignCorporateEntries.length === 1 ? 'y' : 'ies'}\n\n${body}`,
    );
  }

  if (imagePhotoEntries.length > 0) {
    const body = imagePhotoEntries
      .map((e) => {
        const subtypeKey = e.imagePhoto.image_subtype.value;
        const label = subtypeKey
          ? IMAGE_PHOTO_SUBTYPE_LABELS[subtypeKey]
          : 'Other Image';
        return `### ${e.filename} — ${label} (page count: ${e.pageCount})\n${JSON.stringify(e.imagePhoto, null, 2)}`;
      })
      .join('\n\n');
    sections.push(
      `## IMAGE / PHOTO (rich extraction) — ${imagePhotoEntries.length} entr${imagePhotoEntries.length === 1 ? 'y' : 'ies'}\n\n${body}`,
    );
  }

  if (customerContractEntries.length > 0) {
    const body = customerContractEntries
      .map(
        (e) =>
          `### ${e.filename} (page count: ${e.pageCount})\n${JSON.stringify(e.customerContract, null, 2)}`,
      )
      .join('\n\n');
    sections.push(
      `## CUSTOMER CONTRACTS (rich extraction) — ${customerContractEntries.length} entr${customerContractEntries.length === 1 ? 'y' : 'ies'}\n\n${body}`,
    );
  }

  if (realEstatePurchaseEntries.length > 0) {
    const body = realEstatePurchaseEntries
      .map(
        (e) =>
          `### ${e.filename} (page count: ${e.pageCount})\n${JSON.stringify(e.realEstatePurchase, null, 2)}`,
      )
      .join('\n\n');
    sections.push(
      `## REAL ESTATE PURCHASES (rich extraction) — ${realEstatePurchaseEntries.length} entr${realEstatePurchaseEntries.length === 1 ? 'y' : 'ies'}\n\n${body}`,
    );
  }

  if (incentiveDocumentEntries.length > 0) {
    const body = incentiveDocumentEntries
      .map(
        (e) =>
          `### ${e.filename} (page count: ${e.pageCount})\n${JSON.stringify(e.incentiveDocument, null, 2)}`,
      )
      .join('\n\n');
    sections.push(
      `## INCENTIVES (rich extraction) — ${incentiveDocumentEntries.length} entr${incentiveDocumentEntries.length === 1 ? 'y' : 'ies'}\n\n${body}`,
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

/* ---------------------------------------------------------------------- */
/* Tab F substantiality reconciliation (deterministic gate)                */
/* ---------------------------------------------------------------------- */

const SUBSTANTIALITY_LOWER_RATIO = 0.85;
const SUBSTANTIALITY_UPPER_RATIO = 1.15;
const SUBSTANTIALITY_DATE_WINDOW_DAYS = 90;

/** Normalize a name for fuzzy "is this the investor / enterprise" check. */
function normalizeName(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Substring-tolerant name match: either side contains the other (after normalize). */
function nameMatches(candidate: string | null | undefined, target: string | null | undefined): boolean {
  const a = normalizeName(candidate);
  const b = normalizeName(target);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

function parseIsoDate(s: string | null | undefined): Date | null {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function withinDateWindow(eventDate: Date | null, anchor: Date | null, days: number): boolean {
  if (!eventDate || !anchor) return true; // no anchor → don't filter on date
  const deltaMs = Math.abs(eventDate.getTime() - anchor.getTime());
  return deltaMs <= days * 24 * 60 * 60 * 1000;
}

/** Pull the investor's full_name from any per-doc-type entry that carries one. */
function findInvestorName(memory: TypedMemory): string | null {
  for (const entry of iterMemoryEntries(memory)) {
    const facts = entry.facts;
    if (!facts) continue;
    if (facts.doc_type === 'passport') {
      const v = facts.full_name?.value;
      if (v) return v;
    }
    if (facts.doc_type === 'uscis_or_dos_form') {
      const v = facts.beneficiary_name?.value;
      if (v) return v;
    }
  }
  return null;
}

/** Pull the enterprise's legal_name from any entry that carries one. */
function findEnterpriseName(memory: TypedMemory): string | null {
  for (const entry of iterMemoryEntries(memory)) {
    const facts = entry.facts;
    if (!facts) continue;
    if (facts.doc_type === 'formation_doc') {
      // formation_doc variant in this codebase uses `kind` not `legal_name`;
      // entity_legal_name lives on the rich `corporateFormation` extractor
      // attached to the same PerPdfResult.
      const cf = entry.corporateFormation;
      if (cf?.entity_legal_name?.value) return cf.entity_legal_name.value;
    }
    if (facts.doc_type === 'uscis_or_dos_form') {
      const v = facts.petitioner_name?.value;
      if (v) return v;
    }
  }
  return null;
}

/**
 * Deterministic INVESTOR ↔ OWNER binding pre-compute. Walks every
 * corporate-formation rich extraction in the typed memory, fuzzy-matches
 * the listed members/shareholders against the investor's name (passport
 * → I-129 fallback), and emits a markdown block consumed by the
 * aggregator system prompt.
 *
 * Why deterministic: the LLM aggregator gets the formation JSON and the
 * passport JSON in separate sections of the prompt and historically
 * fails to bridge "Salih Kaçar listed as 100% member of LLC X" ↔
 * "Salih Kaçar is the principal applicant on the passport" — the binding
 * step is exactly the kind of cross-section reasoning that benefits from
 * a pre-computed hint table the model can read off of.
 */
export function buildInvestorOwnerBindingBlock(memory: TypedMemory): string {
  const investorName = findInvestorName(memory);

  type MemberRow = {
    filename: string;
    entity: string | null;
    memberName: string;
    ownershipPercent: number | null;
    role: string | null;
    listSource: 'current' | 'prior' | 'new';
    matchesInvestor: boolean;
  };
  const allMembers: MemberRow[] = [];
  let formationDocCount = 0;

  for (const entry of iterMemoryEntries(memory)) {
    const cf = entry.corporateFormation;
    if (!cf) continue;
    formationDocCount++;
    const entity = cf.entity_legal_name?.value ?? null;
    const sub = cf.formation_doc_subtype;

    if (sub === 'articles_of_organization' || sub === 'articles_of_incorporation') {
      for (const m of cf.members_or_shareholders) {
        const name = m.name?.value;
        if (!name) continue;
        allMembers.push({
          filename: entry.filename,
          entity,
          memberName: name,
          ownershipPercent: m.ownership_percent?.value ?? null,
          role: m.role?.value ?? null,
          listSource: 'current',
          matchesInvestor: investorName ? nameMatches(name, investorName) : false,
        });
      }
    } else if (sub === 'operating_agreement_amendment') {
      for (const m of cf.prior_member_list) {
        const name = m.name?.value;
        if (!name) continue;
        allMembers.push({
          filename: entry.filename,
          entity,
          memberName: name,
          ownershipPercent: m.ownership_percent?.value ?? null,
          role: null,
          listSource: 'prior',
          matchesInvestor: investorName ? nameMatches(name, investorName) : false,
        });
      }
      for (const m of cf.new_member_list) {
        const name = m.name?.value;
        if (!name) continue;
        allMembers.push({
          filename: entry.filename,
          entity,
          memberName: name,
          ownershipPercent: m.ownership_percent?.value ?? null,
          role: null,
          listSource: 'new',
          matchesInvestor: investorName ? nameMatches(name, investorName) : false,
        });
      }
    }
  }

  if (formationDocCount === 0) {
    return (
      `## INVESTOR ↔ OWNER BINDING (deterministic pre-compute)\n\n` +
      `**Verdict:** \`no_formation_doc\` — no corporate-formation document was ingested for this matter; ownership chain cannot be deterministically bound.`
    );
  }

  if (!investorName) {
    return (
      `## INVESTOR ↔ OWNER BINDING (deterministic pre-compute)\n\n` +
      `**Verdict:** \`no_investor_name\` — no passport / I-129 beneficiary name in the typed memory to match against ${formationDocCount} formation document${formationDocCount === 1 ? '' : 's'}. Populate investor.full_name first; ownership_chain binding is downstream of that.`
    );
  }

  if (allMembers.length === 0) {
    return (
      `## INVESTOR ↔ OWNER BINDING (deterministic pre-compute)\n\n` +
      `Investor name: **${investorName}**\nFormation documents: **${formationDocCount}** (none of a subtype that lists members/shareholders — e.g., EIN letter or good-standing certificate only).\n\n` +
      `**Verdict:** \`no_member_list_subtype\` — formation documents present but none are articles_of_organization / articles_of_incorporation / operating_agreement_amendment. Request articles or operating agreement to bind ownership.`
    );
  }

  const matches = allMembers.filter((m) => m.matchesInvestor);

  const tableHeader =
    '| filename | entity | member_name | ownership % | role | list | matches investor? |\n' +
    '| --- | --- | --- | --- | --- | --- | --- |';
  const rows = allMembers
    .map(
      (m) =>
        `| ${m.filename} | ${m.entity ?? '—'} | ${m.memberName} | ${m.ownershipPercent != null ? `${m.ownershipPercent.toFixed(2)}%` : '—'} | ${m.role ?? '—'} | ${m.listSource} | ${m.matchesInvestor ? '✓ MATCH' : '—'} |`,
    )
    .join('\n');

  let verdictLine: string;
  if (matches.length === 0) {
    verdictLine =
      `**Verdict:** \`no_match\` — investor "${investorName}" was NOT name-matched against any listed member/shareholder in the ${formationDocCount} formation document${formationDocCount === 1 ? '' : 's'} above. ` +
      `Per 8 CFR §214.2(e)(15) and 9 FAM 402.9-4(B), the principal applicant must appear in the ownership chain. ` +
      `Log a severity 4 conflict_register entry with conflict_type='investor_not_listed_as_owner' citing the formation document filename(s) as fact_a_doc.`;
  } else {
    const matchSummary = matches
      .map((m) => {
        const pctStr = m.ownershipPercent != null ? `${m.ownershipPercent.toFixed(2)}%` : 'unspecified %';
        const entityStr = m.entity ?? 'unknown entity';
        return `- "${m.memberName}" → ${entityStr} (${pctStr}, ${m.listSource} list, ${m.filename})`;
      })
      .join('\n');
    verdictLine =
      `**Verdict:** \`match_found\` — investor "${investorName}" IS listed as a member/shareholder. Bind these into ownership_chain entries (one per match) and reference the role explicitly in elements_evidence.develop_and_direct_basis.\n\n${matchSummary}`;
  }

  return (
    `## INVESTOR ↔ OWNER BINDING (deterministic pre-compute)\n\n` +
    `Investor name (passport / I-129): **${investorName}**\n` +
    `Formation documents in memory: **${formationDocCount}**\n\n` +
    `${tableHeader}\n${rows}\n\n${verdictLine}`
  );
}

/**
 * Deterministic SOURCE-OF-FUNDS chain hints pre-compute. Anchors on every
 * wire-confirmation in the typed memory and walks outward to identify the
 * candidate origin (real-property sale, investor's bank account) and
 * deployment (US business bank account) for each chain. Emits a markdown
 * block consumed by the aggregator system prompt.
 *
 * Why deterministic: SourceOfFundsChainSchema is a flat 5-field shape
 * (origin_category, origin_amount_usd, origin_evidence, final_destination,
 * notes) with no slot for intermediate steps. Without this pre-compute the
 * aggregator must reconstruct the chain from raw JSON in three different
 * sections (BANK RECEIPTS, WIRE CONFIRMATIONS, GOVERNMENT DOCUMENTS) and
 * compress the steps into prose `notes` — the multi-hop reasoning is
 * exactly where chains have been silently dropped.
 */
export function buildSofChainHintsBlock(memory: TypedMemory): string {
  const investorName = findInvestorName(memory);
  const enterpriseName = findEnterpriseName(memory);

  const wireEntries: { filename: string; pageCount: number; wireConfirmation: WireConfirmationFacts }[] = [];
  const bankReceiptEntries: { filename: string; pageCount: number; bankReceipt: BankReceiptFacts }[] = [];
  const titleDeedEntries: { filename: string; subtype: string }[] = [];

  for (const entry of iterMemoryEntries(memory)) {
    if (entry.wireConfirmation) {
      wireEntries.push({
        filename: entry.filename,
        pageCount: entry.pageCount,
        wireConfirmation: entry.wireConfirmation,
      });
    }
    if (entry.bankReceipt) {
      bankReceiptEntries.push({
        filename: entry.filename,
        pageCount: entry.pageCount,
        bankReceipt: entry.bankReceipt,
      });
    }
    if (entry.governmentDoc?.government_doc_subtype === 'title_deed') {
      titleDeedEntries.push({
        filename: entry.filename,
        subtype: entry.governmentDoc.government_doc_subtype,
      });
    }
  }

  const headerStats =
    `Investor: **${investorName ?? '(unknown)'}** · Enterprise: **${enterpriseName ?? '(unknown)'}**\n` +
    `Wires found: **${wireEntries.length}** · Bank receipts: **${bankReceiptEntries.length}** · Title deeds: **${titleDeedEntries.length}**`;

  if (wireEntries.length === 0 && bankReceiptEntries.length === 0) {
    return (
      `## SOURCE-OF-FUNDS CHAIN HINTS (deterministic pre-compute)\n\n${headerStats}\n\n` +
      `**Verdict:** \`no_chain_evidence\` — no wire confirmations or bank receipts in the typed memory. ` +
      `Per 9 FAM 402.9-6(D)(2) and Manual §5, the SOF chain MUST be documented; if no terminal-deployment evidence is present, log a severity 5 conflict_register entry with conflict_type='no_sof_evidence' and leave source_of_funds=[].`
    );
  }

  type ChainStep = {
    role: 'origin' | 'sending_account' | 'wire' | 'deployment';
    filename: string;
    summary: string;
  };
  type Chain = {
    spineFilename: string;
    spineLabel: string;
    senderName: string | null;
    receiverName: string | null;
    amount: number | null;
    currency: string | null;
    steps: ChainStep[];
    issues: string[];
    investorBound: boolean;
    enterpriseBound: boolean;
  };

  const chains: Chain[] = [];
  for (const w of wireEntries) {
    const wc = w.wireConfirmation;
    let senderName: string | null = null;
    let receiverName: string | null = null;
    let amount: number | null = null;
    let currency: string | null = null;
    let fxLeg: string | null = null;
    const valueDate = wc.value_date?.value ?? null;

    if (wc.wire_subtype === 'international_wire_with_fx') {
      senderName = wc.sender.holder_name?.value ?? null;
      receiverName = wc.receiver.holder_name?.value ?? null;
      amount = wc.target_amount?.value ?? null;
      currency = wc.target_currency?.value ?? null;
      const sa = wc.source_amount?.value ?? null;
      const sc = wc.source_currency?.value ?? null;
      const ta = wc.target_amount?.value ?? null;
      const tc = wc.target_currency?.value ?? null;
      const fx = wc.exchange_rate?.value ?? null;
      fxLeg = `${sa ?? '?'} ${sc ?? '?'} → ${ta ?? '?'} ${tc ?? '?'} @ ${fx ?? '?'}`;
    } else if (wc.wire_subtype === 'usd_only_wire') {
      senderName = wc.sender.holder_name?.value ?? null;
      receiverName = wc.receiver.holder_name?.value ?? null;
      amount = wc.amount?.value ?? null;
      currency = wc.currency?.value ?? null;
    } else if (wc.wire_subtype === 'corporate_funding') {
      senderName = wc.parent_entity.holder_name?.value ?? null;
      receiverName = wc.subsidiary_entity.holder_name?.value ?? null;
      amount = wc.amount?.value ?? null;
      currency = wc.currency?.value ?? null;
    }

    const investorBound = investorName ? nameMatches(senderName, investorName) : false;
    const enterpriseBound = enterpriseName ? nameMatches(receiverName, enterpriseName) : false;

    const steps: ChainStep[] = [];

    // Origin candidates: title deed + multi-installment property-sale receipts
    for (const td of titleDeedEntries) {
      steps.push({
        role: 'origin',
        filename: td.filename,
        summary: `Asset evidenced by title deed (government_doc_subtype='${td.subtype}') — likely sale-of-property origin.`,
      });
    }
    for (const br of bankReceiptEntries) {
      const r = br.bankReceipt;
      if (r.receipt_subtype === 'multi_installment') {
        const counterparty = r.consistent_counterparty_name?.value ?? null;
        const proceedsKind = r.proceeds_kind?.value ?? null;
        const total = r.total_received_amount?.value ?? null;
        const totalCcy = r.total_received_currency?.value ?? null;
        steps.push({
          role: 'origin',
          filename: br.filename,
          summary: `Multi-installment receipts (${proceedsKind ?? 'unspecified kind'}) — counterparty "${counterparty ?? 'unspecified'}", total ${total ?? '?'} ${totalCcy ?? '?'}.`,
        });
      }
    }

    // Sending account candidate: single-event deposits where from_name name-matches investor
    for (const br of bankReceiptEntries) {
      const r = br.bankReceipt;
      if (r.receipt_subtype !== 'single_event') continue;
      const fromName = r.receipt.from_name?.value ?? null;
      const ek = r.event_kind?.value ?? null;
      if (investorName && nameMatches(fromName, investorName)) {
        steps.push({
          role: 'sending_account',
          filename: br.filename,
          summary: `Investor's bank movement — ${fromName ?? '?'} → ${r.receipt.to_name?.value ?? '?'}, ${r.receipt.amount?.value ?? '?'} ${r.receipt.currency?.value ?? '?'} (${ek ?? '?'}, ${r.receipt.date?.value ?? '?'}).`,
        });
      }
    }

    // Wire spine itself
    steps.push({
      role: 'wire',
      filename: w.filename,
      summary: `${WIRE_CONFIRMATION_SUBTYPE_LABELS[wc.wire_subtype]} — ${senderName ?? '?'} → ${receiverName ?? '?'}, ${amount ?? '?'} ${currency ?? '?'}${fxLeg ? ` (${fxLeg})` : ''}, value_date ${valueDate ?? '?'}.`,
    });

    // Deployment leg: receiver name-matched against the enterprise IS the deployment (the wire itself
    // closes the chain). Surface explicitly so the aggregator does not have to re-derive.
    if (enterpriseBound && receiverName) {
      steps.push({
        role: 'deployment',
        filename: w.filename,
        summary: `Funds delivered to Petitioner enterprise account ("${receiverName}").`,
      });
    }

    const issues: string[] = [];
    if (!senderName) issues.push('wire missing sender holder_name');
    if (!receiverName) issues.push('wire missing receiver holder_name');
    if (investorName && !investorBound && wc.wire_subtype !== 'corporate_funding') {
      issues.push(`wire sender ("${senderName ?? '?'}") does not name-match investor ("${investorName}") — origin leg unbound`);
    }
    if (enterpriseName && !enterpriseBound) {
      issues.push(`wire receiver ("${receiverName ?? '?'}") does not name-match enterprise ("${enterpriseName}") — deployment leg unbound`);
    }
    const hasUpstream = steps.some((s) => s.role === 'origin' || s.role === 'sending_account');
    if (!hasUpstream) {
      issues.push('no upstream origin or sending-account evidence found — origin leg of chain is undocumented');
    }

    chains.push({
      spineFilename: w.filename,
      spineLabel: WIRE_CONFIRMATION_SUBTYPE_LABELS[wc.wire_subtype],
      senderName,
      receiverName,
      amount,
      currency,
      steps,
      issues,
      investorBound,
      enterpriseBound,
    });
  }

  if (chains.length === 0) {
    // Receipts-only fallback. Useful when the case has bank evidence but
    // no wire slip yet (filing-prep stage).
    const lines = bankReceiptEntries.map((br) => {
      const r = br.bankReceipt;
      if (r.receipt_subtype === 'multi_installment') {
        return `- ${br.filename}: multi-installment, total ${r.total_received_amount?.value ?? '?'} ${r.total_received_currency?.value ?? '?'} (${r.proceeds_kind?.value ?? '?'}, counterparty "${r.consistent_counterparty_name?.value ?? '?'}")`;
      }
      return `- ${br.filename}: single-event ${r.event_kind?.value ?? '?'}, ${r.receipt.amount?.value ?? '?'} ${r.receipt.currency?.value ?? '?'} (${r.receipt.from_name?.value ?? '?'} → ${r.receipt.to_name?.value ?? '?'})`;
    });
    return (
      `## SOURCE-OF-FUNDS CHAIN HINTS (deterministic pre-compute)\n\n${headerStats}\n\n` +
      `**Verdict:** \`receipts_only_no_wire\` — bank receipts present but no wire confirmation closing the chain into the Petitioner enterprise. Log a severity 4 conflict_register entry with conflict_type='sof_chain_incomplete' citing the receipt filenames; populate source_of_funds with the partial origin evidence.\n\n${lines.join('\n')}`
    );
  }

  const chainBlocks = chains
    .map((c, i) => {
      const stepLines = c.steps
        .map((s) => `  - **[${s.role}]** ${s.summary} _(evidence: ${s.filename})_`)
        .join('\n');
      const issuesLine =
        c.issues.length === 0
          ? `  ✓ All structural links present.`
          : c.issues.map((iss) => `  ⚠ ${iss}`).join('\n');
      const bindings = `  • investor ↔ sender: ${c.investorBound ? '✓ matched' : '⚠ not matched'} · enterprise ↔ receiver: ${c.enterpriseBound ? '✓ matched' : '⚠ not matched'}`;
      return `### Chain ${i + 1} — anchored on ${c.spineLabel} (${c.spineFilename})\n${stepLines}\n${bindings}\n${issuesLine}`;
    })
    .join('\n\n');

  return (
    `## SOURCE-OF-FUNDS CHAIN HINTS (deterministic pre-compute)\n\n${headerStats}\n\n` +
    `Use these candidate chains to populate \`source_of_funds\` (one chain entry per spine wire). When a chain has issues marked ⚠, also log a corresponding severity-3 conflict_register entry with conflict_type='sof_chain_incomplete' or 'sof_chain_unbound', citing the wire filename as fact_a_doc. The 5-field SourceOfFundsChainSchema cannot represent the full multi-hop chain; compress the intermediate steps into the \`notes\` field with file references.\n\n${chainBlocks}`
  );
}

/**
 * Reconcile Tab F substantiality: prove the committed-investment number
 * with actual money-out evidence.
 *
 * total_committed_usd ← MITA contract.total_consideration_amount (USD)
 *                       ↳ fallback I-129E.investment_amount_usd
 * sum_outflows ← Σ money_movement.amount_usd where from_holder matches
 *                 investor or enterprise, within ±90d of contract effective
 * sum_invoices ← Σ invoice_or_receipt.amount_usd where vendor != investor
 * sum_equipment ← Σ contract.bill_of_sale.total_consideration_amount
 *                 + Σ business_contract.contract_value_usd where role='vendor'
 *
 * coverage_ratio = (outflows + invoices + equipment) / total_committed_usd
 *
 * Verdicts:
 *   < 0.85 → 'under_documented' (severity 3 — committed but un-proved)
 *   > 1.15 → 'over_documented'  (severity 2 — likely double-counting)
 *   else   → 'within_tolerance' (audit row only)
 *   total_committed null/0 → 'no_committed_amount' (no-op)
 */
export function reconcileSubstantiality(memory: TypedMemory): SubstantialityReconResult {
  // 1) Locate total_committed_usd.
  let total_committed_usd: number | null = null;
  let contract_filename: string | null = null;
  let contract_effective_date: string | null = null;

  for (const entry of iterMemoryEntries(memory)) {
    const c = entry.contract;
    if (
      c?.contract_subtype === 'membership_interest_transfer_agreement' &&
      c.total_consideration_currency.value === 'USD' &&
      typeof c.total_consideration_amount.value === 'number'
    ) {
      total_committed_usd = c.total_consideration_amount.value;
      contract_filename = entry.filename;
      contract_effective_date = c.effective_date.value ?? null;
      break;
    }
  }
  if (total_committed_usd === null) {
    for (const entry of iterMemoryEntries(memory)) {
      const f = entry.facts;
      if (f?.doc_type === 'uscis_or_dos_form') {
        const formId = f.form_id?.value ?? '';
        const isI129E = /i[-\s]?129\s*e/i.test(formId);
        const amt = f.investment_amount_usd?.value;
        if (isI129E && typeof amt === 'number') {
          total_committed_usd = amt;
          break;
        }
      }
    }
  }

  if (total_committed_usd === null || total_committed_usd === 0) {
    return {
      total_committed_usd,
      sum_outflows_usd: 0,
      sum_invoices_usd: 0,
      sum_equipment_usd: 0,
      coverage_ratio: null,
      verdict: 'no_committed_amount',
      evidence_doc: [],
      contract_filename,
      contract_effective_date,
    };
  }

  const investorName = findInvestorName(memory);
  const enterpriseName = findEnterpriseName(memory);
  const anchor = parseIsoDate(contract_effective_date);

  const evidence: SubstantialityReconEvidence[] = [];
  let sum_outflows_usd = 0;
  let sum_invoices_usd = 0;
  let sum_equipment_usd = 0;

  // 2) Outflows from money_movement.
  const mmEntries = memory.money_movement ?? [];
  for (const entry of mmEntries) {
    if (!entry.facts || entry.facts.doc_type !== 'money_movement') continue;
    const f = entry.facts;
    const amount = f.amount_usd?.value;
    if (typeof amount !== 'number' || amount <= 0) continue;
    const fromHolder = f.from_holder?.value;
    const isOutbound =
      nameMatches(fromHolder, investorName) ||
      nameMatches(fromHolder, enterpriseName);
    if (!isOutbound) continue;
    const moveDate = parseIsoDate(f.date?.value);
    if (!withinDateWindow(moveDate, anchor, SUBSTANTIALITY_DATE_WINDOW_DAYS)) continue;
    sum_outflows_usd += amount;
    evidence.push({ filename: entry.filename, amount_usd: amount, category: 'outflow' });
  }

  // 3) Invoices/receipts (exclude refunds where vendor is the investor).
  const invEntries = memory.invoice_or_receipt ?? [];
  for (const entry of invEntries) {
    if (!entry.facts || entry.facts.doc_type !== 'invoice_or_receipt') continue;
    const f = entry.facts;
    const amount = f.amount_usd?.value;
    if (typeof amount !== 'number' || amount <= 0) continue;
    const vendor = f.vendor?.value;
    if (nameMatches(vendor, investorName)) continue; // refund / self-pay
    sum_invoices_usd += amount;
    evidence.push({ filename: entry.filename, amount_usd: amount, category: 'invoice' });
  }

  // 4) Equipment / bills of sale.
  for (const entry of iterMemoryEntries(memory)) {
    const c = entry.contract;
    if (
      c?.contract_subtype === 'bill_of_sale' &&
      c.consideration_currency.value === 'USD' &&
      typeof c.consideration_amount.value === 'number'
    ) {
      const amt = c.consideration_amount.value;
      sum_equipment_usd += amt;
      evidence.push({ filename: entry.filename, amount_usd: amt, category: 'equipment' });
    }
    if (
      entry.facts?.doc_type === 'business_contract' &&
      entry.facts.role?.value === 'vendor' &&
      typeof entry.facts.contract_value_usd?.value === 'number'
    ) {
      const amt = entry.facts.contract_value_usd.value;
      sum_equipment_usd += amt;
      evidence.push({ filename: entry.filename, amount_usd: amt, category: 'equipment' });
    }
  }

  const documented = sum_outflows_usd + sum_invoices_usd + sum_equipment_usd;
  const coverage_ratio = documented / total_committed_usd;
  const verdict: SubstantialityReconResult['verdict'] =
    coverage_ratio < SUBSTANTIALITY_LOWER_RATIO
      ? 'under_documented'
      : coverage_ratio > SUBSTANTIALITY_UPPER_RATIO
        ? 'over_documented'
        : 'within_tolerance';

  return {
    total_committed_usd,
    sum_outflows_usd,
    sum_invoices_usd,
    sum_equipment_usd,
    coverage_ratio,
    verdict,
    evidence_doc: evidence,
    contract_filename,
    contract_effective_date,
  };
}

/* ---------------------------------------------------------------------- */
/* Tab D entity-coherence (deterministic gate)                             */
/* ---------------------------------------------------------------------- */

const ENTITY_LEVENSHTEIN_THRESHOLD = 2;

const ENTITY_SUFFIX_RE =
  /\b(l\.?l\.?c\.?|inc\.?|corp\.?|corporation|co\.?|company|limited|ltd\.?|p\.?l\.?l\.?c\.?|gmbh|a\.?ş\.?|as|sti)\b/g;

/** Turkish-aware ASCII fold + punctuation strip for entity name compares. */
function foldEntityName(s: string): string {
  return s
    .toLowerCase()
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/[.,'’`"]/g, '')
    .replace(ENTITY_SUFFIX_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const m = a.length;
  const n = b.length;
  // Two-row table (memory-efficient).
  let prev = new Array<number>(n + 1);
  let cur = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(
        cur[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

const US_LLC_SUFFIX_RE =
  /\b(l\.?l\.?c\.?|inc\.?|corp\.?|corporation|co\.?|company|limited|ltd\.?|p\.?l\.?l\.?c\.?)\b/i;

function collectEntityNameOccurrences(memory: TypedMemory): EntityNameOccurrence[] {
  const out: EntityNameOccurrence[] = [];
  for (const entry of iterMemoryEntries(memory)) {
    const facts = entry.facts;

    // Source 1: corporateFormation.entity_legal_name on every formation_doc
    // that ran through the rich extractor (all 7 subtypes share the field).
    if (entry.corporateFormation?.entity_legal_name?.value) {
      out.push({
        filename: entry.filename,
        source_field: 'corporateFormation.entity_legal_name',
        raw_name: entry.corporateFormation.entity_legal_name.value,
      });
    }

    if (!facts) continue;

    // Source 2: uscis_or_dos_form.petitioner_name.
    if (facts.doc_type === 'uscis_or_dos_form' && facts.petitioner_name?.value) {
      out.push({
        filename: entry.filename,
        source_field: 'uscis_or_dos_form.petitioner_name',
        raw_name: facts.petitioner_name.value,
      });
    }

    // Source 3: lease_or_property.lessee — but only when the lessee name
    // looks like a US entity (carries a corporate suffix). Personal-name
    // lessees would muddy the gate.
    if (
      facts.doc_type === 'lease_or_property' &&
      typeof facts.lessee?.value === 'string' &&
      US_LLC_SUFFIX_RE.test(facts.lessee.value)
    ) {
      out.push({
        filename: entry.filename,
        source_field: 'lease_or_property.lessee',
        raw_name: facts.lessee.value,
      });
    }

    // Source 4: payroll_doc.employer_name.
    if (facts.doc_type === 'payroll_doc' && facts.employer_name?.value) {
      out.push({
        filename: entry.filename,
        source_field: 'payroll_doc.employer_name',
        raw_name: facts.employer_name.value,
      });
    }

    // Source 5: financial_statement.entity_name (thin variant).
    if (facts.doc_type === 'financial_statement' && facts.entity_name?.value) {
      out.push({
        filename: entry.filename,
        source_field: 'financial_statement.entity_name',
        raw_name: facts.entity_name.value,
      });
    }
  }
  return out;
}

function groupEntityNames(occurrences: EntityNameOccurrence[]): EntityNameGroup[] {
  const groups: EntityNameGroup[] = [];
  for (const occ of occurrences) {
    const folded = foldEntityName(occ.raw_name);
    if (!folded) continue;
    let attached = false;
    for (const g of groups) {
      if (
        g.canonical_name === folded ||
        levenshtein(g.canonical_name, folded) <= ENTITY_LEVENSHTEIN_THRESHOLD
      ) {
        g.occurrences.push(occ);
        attached = true;
        break;
      }
    }
    if (!attached) {
      groups.push({ canonical_name: folded, occurrences: [occ] });
    }
  }
  return groups;
}

/** Foreign-parent detection: does any entry carry an authorized board_resolution? */
function detectForeignParent(memory: TypedMemory): {
  foreign_name_folded: string;
  authorizes_us_investment: boolean;
} | null {
  for (const entry of iterMemoryEntries(memory)) {
    const fc = entry.foreignCorporate;
    if (!fc) continue;
    if (fc.foreign_doc_subtype !== 'board_resolution') continue;
    const name = fc.entity_legal_name_ascii?.value;
    const authorizes = fc.authorizes_us_investment?.value;
    if (typeof name === 'string' && name.length > 0) {
      return {
        foreign_name_folded: foldEntityName(name),
        authorizes_us_investment: authorizes === true,
      };
    }
  }
  return null;
}

/**
 * Reconcile Tab D entity coherence: when the matter contains formation
 * docs + petition forms + leases + payroll + financial statements, every
 * named entity MUST describe the same legal person. Drift = severity 4.
 *
 * Levenshtein ≤ 2 merges near-duplicates ("wise guys deli" vs
 * "wise guy's deli"). A foreign-parent / US-subsidiary pattern (foreign
 * corporate board_resolution.authorizes_us_investment === true) is an
 * accepted multi-group case — no conflict fires.
 */
export function reconcileEntityCoherence(memory: TypedMemory): EntityCoherenceResult {
  const occurrences = collectEntityNameOccurrences(memory);
  if (occurrences.length === 0) {
    return {
      verdict: 'no_entity_evidence',
      groups: [],
      canonical_name: null,
      foreign_parent_name: null,
      us_subsidiary_name: null,
    };
  }
  const groups = groupEntityNames(occurrences);
  if (groups.length === 1) {
    return {
      verdict: 'single_entity',
      groups,
      canonical_name: groups[0].canonical_name,
      foreign_parent_name: null,
      us_subsidiary_name: null,
    };
  }

  const foreign = detectForeignParent(memory);
  if (foreign && foreign.authorizes_us_investment) {
    const parentGroup = groups.find(
      (g) =>
        g.canonical_name === foreign.foreign_name_folded ||
        levenshtein(g.canonical_name, foreign.foreign_name_folded) <=
          ENTITY_LEVENSHTEIN_THRESHOLD,
    );
    const usGroup = groups.find((g) => g !== parentGroup);
    if (parentGroup && usGroup) {
      return {
        verdict: 'parent_subsidiary',
        groups,
        canonical_name: null,
        foreign_parent_name: parentGroup.canonical_name,
        us_subsidiary_name: usGroup.canonical_name,
      };
    }
  }

  return {
    verdict: 'name_drift',
    groups,
    canonical_name: null,
    foreign_parent_name: null,
    us_subsidiary_name: null,
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

/**
 * Manual MANUAL-SUBTYPE-4 §3.8.5 (real-estate buyer-mismatch gate). For
 * every real-estate purchase agreement in the typed memory whose
 * buyer_legal_name does not match the Petitioner's legal_name, ok=false.
 * ok=true with reason='no_petitioner_name' when the Petitioner's name
 * isn't known and the comparison cannot run.
 */
export interface RealEstateBuyerMismatchAuditRow {
  filename: string;
  ok: boolean;
  reason: 'ok' | 'mismatch' | 'no_petitioner_name' | 'no_buyer_name';
  buyer_legal_name: string | null;
  petitioner_legal_name: string | null;
  source_page: number | null;
  source_quote: string | null;
}

/**
 * Manual MANUAL-SUBTYPE-4 §3 (incentive recipient-mismatch gate). For
 * every incentive document whose recipient_legal_name does not match
 * the Petitioner's legal_name, ok=false. ok=true with
 * reason='no_petitioner_name' when the Petitioner's name isn't known.
 */
export interface IncentiveRecipientMismatchAuditRow {
  filename: string;
  ok: boolean;
  reason: 'ok' | 'mismatch' | 'no_petitioner_name' | 'no_recipient_name';
  recipient_legal_name: string | null;
  petitioner_legal_name: string | null;
  source_page: number | null;
  source_quote: string | null;
}

/**
 * Normalize a legal name for comparison. Lowercases, collapses
 * whitespace, strips trailing punctuation, and strips common entity
 * suffixes so cosmetic differences don't trip the gate. The gate
 * already only fires severity-3/4 (not dispositive) so a false-positive
 * from cosmetic drift is recoverable, but we'd rather avoid it.
 */
function normalizeLegalName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\b(llc|l\.l\.c\.|inc|incorporated|corp|corporation|ltd|limited|co)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Manual MANUAL-SUBTYPE-4 §3.8.5 buyer-mismatch gate — pure / deterministic. */
export function runRealEstateBuyerMismatchGate(
  memory: TypedMemory,
  petitionerLegalName: string | null,
): RealEstateBuyerMismatchAuditRow[] {
  const rows: RealEstateBuyerMismatchAuditRow[] = [];
  const petitionerNorm = normalizeLegalName(petitionerLegalName);
  for (const entry of iterMemoryEntries(memory)) {
    if (!entry.realEstatePurchase) continue;
    const buyer = entry.realEstatePurchase.buyer_legal_name.value;
    const sourcePage = entry.realEstatePurchase.buyer_legal_name.source_page;
    const sourceQuote = entry.realEstatePurchase.buyer_legal_name.source_quote;
    if (!buyer) {
      rows.push({
        filename: entry.filename,
        ok: true,
        reason: 'no_buyer_name',
        buyer_legal_name: buyer,
        petitioner_legal_name: petitionerLegalName,
        source_page: sourcePage,
        source_quote: sourceQuote,
      });
      continue;
    }
    if (!petitionerNorm) {
      rows.push({
        filename: entry.filename,
        ok: true,
        reason: 'no_petitioner_name',
        buyer_legal_name: buyer,
        petitioner_legal_name: petitionerLegalName,
        source_page: sourcePage,
        source_quote: sourceQuote,
      });
      continue;
    }
    const buyerNorm = normalizeLegalName(buyer);
    const matches = buyerNorm === petitionerNorm;
    rows.push({
      filename: entry.filename,
      ok: matches,
      reason: matches ? 'ok' : 'mismatch',
      buyer_legal_name: buyer,
      petitioner_legal_name: petitionerLegalName,
      source_page: sourcePage,
      source_quote: sourceQuote,
    });
  }
  return rows;
}

/** Manual MANUAL-SUBTYPE-4 incentive recipient-mismatch gate — pure / deterministic. */
export function runIncentiveRecipientMismatchGate(
  memory: TypedMemory,
  petitionerLegalName: string | null,
): IncentiveRecipientMismatchAuditRow[] {
  const rows: IncentiveRecipientMismatchAuditRow[] = [];
  const petitionerNorm = normalizeLegalName(petitionerLegalName);
  for (const entry of iterMemoryEntries(memory)) {
    if (!entry.incentiveDocument) continue;
    const recipient = entry.incentiveDocument.recipient_legal_name.value;
    const sourcePage = entry.incentiveDocument.recipient_legal_name.source_page;
    const sourceQuote = entry.incentiveDocument.recipient_legal_name.source_quote;
    if (!recipient) {
      rows.push({
        filename: entry.filename,
        ok: true,
        reason: 'no_recipient_name',
        recipient_legal_name: recipient,
        petitioner_legal_name: petitionerLegalName,
        source_page: sourcePage,
        source_quote: sourceQuote,
      });
      continue;
    }
    if (!petitionerNorm) {
      rows.push({
        filename: entry.filename,
        ok: true,
        reason: 'no_petitioner_name',
        recipient_legal_name: recipient,
        petitioner_legal_name: petitionerLegalName,
        source_page: sourcePage,
        source_quote: sourceQuote,
      });
      continue;
    }
    const recipientNorm = normalizeLegalName(recipient);
    const matches = recipientNorm === petitionerNorm;
    rows.push({
      filename: entry.filename,
      ok: matches,
      reason: matches ? 'ok' : 'mismatch',
      recipient_legal_name: recipient,
      petitioner_legal_name: petitionerLegalName,
      source_page: sourcePage,
      source_quote: sourceQuote,
    });
  }
  return rows;
}

/* ---------------------------------------------------------------------- */
/* Phase-3 deterministic enrichment — populate the optional gate inputs   */
/* (matter.co_petitioners, ownership_history, filed_date_i129, rfes,      */
/* investment.claimed_amount_usd, source_of_funds.documented_amount_usd / */
/* source_person, investor.current_status / prior_status_expiration_date) */
/* directly from the typed memory. The LLM aggregator is permitted but    */
/* not required to fill these — Phase-3 fills the gaps so the Phase-1/2   */
/* gates stop returning data_incomplete on every matter.                  */
/*                                                                        */
/* Each enrichment is null-safe: if the typed memory has no signal, the   */
/* field stays whatever the LLM emitted (often absent, which the schema   */
/* treats as `undefined`). NEVER fabricates.                              */
/* ---------------------------------------------------------------------- */

type FieldT<T> = {
  value: T | null;
  source_page: number | null;
  source_quote: string | null;
  confidence: number | null;
};

function makeField<T>(
  value: T | null,
  source_page: number | null,
  source_quote: string | null,
  confidence: number | null,
): FieldT<T> {
  return { value, source_page, source_quote, confidence };
}

const NULL_FIELD: FieldT<never> = {
  value: null,
  source_page: null,
  source_quote: null,
  confidence: null,
};

/**
 * Phase-3 §1 — co-petitioners.
 *
 * Walks every corporate-formation members list and every MITA
 * transferor/transferee, normalizes against the principal investor's
 * name, and emits a CoPetitioner entry per non-investor person.
 * Deduplicated on normalized full_name. Returns [] when no candidate
 * persons are found.
 */
export function deriveCoPetitioners(
  memory: TypedMemory,
): { full_name: FieldT<string>; role: FieldT<string> }[] {
  const investorName = findInvestorName(memory);
  const seen = new Map<string, { full_name: FieldT<string>; role: FieldT<string> }>();

  const add = (
    name: string,
    role: string | null,
    page: number | null,
    quote: string | null,
  ) => {
    const norm = normalizeName(name);
    if (!norm) return;
    if (investorName && nameMatches(name, investorName)) return;
    if (seen.has(norm)) return;
    seen.set(norm, {
      full_name: makeField(name, page, quote, 0.9),
      role: role ? makeField(role, page, quote, 0.7) : NULL_FIELD,
    });
  };

  for (const entry of iterMemoryEntries(memory)) {
    const cf = entry.corporateFormation;
    if (cf) {
      const sub = cf.formation_doc_subtype;
      if (sub === 'articles_of_organization' || sub === 'articles_of_incorporation') {
        for (const m of cf.members_or_shareholders) {
          const n = m.name?.value;
          if (n) add(n, m.role?.value ?? null, m.name.source_page, m.name.source_quote);
        }
      } else if (sub === 'operating_agreement_amendment') {
        for (const m of cf.new_member_list) {
          const n = m.name?.value;
          if (n) add(n, null, m.name.source_page, m.name.source_quote);
        }
      }
    }
    const c = entry.contract;
    if (c?.contract_subtype === 'membership_interest_transfer_agreement') {
      const tr = c.transferor.name?.value;
      const te = c.transferee.name?.value;
      if (tr) add(tr, 'transferor', c.transferor.name.source_page, c.transferor.name.source_quote);
      if (te) add(te, 'transferee', c.transferee.name.source_page, c.transferee.name.source_quote);
    }
  }

  return [...seen.values()];
}

/**
 * Phase-3 §2 — ownership_history.
 *
 * Articles of org/inc → one entry at filing_date_or_effective_date with
 * the members_or_shareholders list. Operating-agreement amendments → one
 * entry at effective_date with new_member_list. Sorted ascending by date.
 * Owner names without a date are dropped (cannot anchor a transition).
 */
export function deriveOwnershipHistory(
  memory: TypedMemory,
): {
  effective_date: FieldT<string>;
  owner_names: FieldT<string>[];
  source_doc: FieldT<string>;
}[] {
  type Entry = {
    effective_date: FieldT<string>;
    owner_names: FieldT<string>[];
    source_doc: FieldT<string>;
    sortKey: number;
  };
  const out: Entry[] = [];

  for (const entry of iterMemoryEntries(memory)) {
    const cf = entry.corporateFormation;
    if (!cf) continue;
    const sub = cf.formation_doc_subtype;
    let dateField: FieldT<string> | null = null;
    let names: { value: string; page: number | null; quote: string | null }[] = [];

    if (sub === 'articles_of_organization' || sub === 'articles_of_incorporation') {
      const d = cf.filing_date_or_effective_date;
      if (d?.value) dateField = makeField(d.value, d.source_page, d.source_quote, d.confidence);
      names = cf.members_or_shareholders
        .map((m) => ({
          value: m.name?.value ?? '',
          page: m.name?.source_page ?? null,
          quote: m.name?.source_quote ?? null,
        }))
        .filter((n) => !!n.value);
    } else if (sub === 'operating_agreement_amendment') {
      const d = cf.effective_date ?? cf.filing_date_or_effective_date;
      if (d?.value) dateField = makeField(d.value, d.source_page, d.source_quote, d.confidence);
      names = cf.new_member_list
        .map((m) => ({
          value: m.name?.value ?? '',
          page: m.name?.source_page ?? null,
          quote: m.name?.source_quote ?? null,
        }))
        .filter((n) => !!n.value);
    } else {
      continue;
    }

    if (!dateField || names.length === 0) continue;
    const parsed = parseIsoDate(dateField.value);
    out.push({
      effective_date: dateField,
      owner_names: names.map((n) => makeField(n.value, n.page, n.quote, 0.9)),
      source_doc: makeField(entry.filename, null, null, 1),
      sortKey: parsed ? parsed.getTime() : 0,
    });
  }

  out.sort((a, b) => a.sortKey - b.sortKey);
  return out.map((e) => ({
    effective_date: e.effective_date,
    owner_names: e.owner_names,
    source_doc: e.source_doc,
  }));
}

/**
 * Phase-3 §3 — filed_date_i129.
 *
 * Pull from the I-129 USCIS form's signature_date. Falls back to null when
 * no I-129 form is present or signature_date is missing. Treats both
 * "I-129" and "I-129E" (Supplement) as valid sources, preferring the base
 * I-129 when both exist.
 */
export function deriveFiledDateI129(memory: TypedMemory): FieldT<string> | null {
  let i129: FieldT<string> | null = null;
  let i129e: FieldT<string> | null = null;
  for (const entry of iterMemoryEntries(memory)) {
    const f = entry.facts;
    if (!f || f.doc_type !== 'uscis_or_dos_form') continue;
    const formId = f.form_id?.value ?? '';
    const sig = f.signature_date;
    if (!sig?.value) continue;
    if (/i[-\s]?129\s*e/i.test(formId) && !i129e) {
      i129e = makeField(sig.value, sig.source_page, sig.source_quote, sig.confidence);
    } else if (/i[-\s]?129\b/i.test(formId) && !i129) {
      i129 = makeField(sig.value, sig.source_page, sig.source_quote, sig.confidence);
    }
  }
  return i129 ?? i129e;
}

/**
 * Phase-3 §4 — RFE / NOID list.
 *
 * Heuristic scan: status_doc with status_class containing "RFE"/"NOID",
 * cover_letter with letter_kind hinting at RFE response, or any 'other'
 * doc whose one_line_summary references RFE/NOID. We cannot semantically
 * classify subject_category from filename + thin extraction alone, so
 * default to 'other'. initial_filing_assertion / response_assertion stay
 * null — they require body-text extraction (Phase-4).
 */
export function deriveRfes(
  memory: TypedMemory,
): {
  rfe_date: FieldT<string>;
  subject_category: FieldT<
    | 'bona_fide_enterprise'
    | 'marginality'
    | 'substantial_investment'
    | 'source_of_funds'
    | 'classification'
    | 'maintenance_of_status'
    | 'other'
    | 'nationality_or_ownership'
    | 'develop_and_direct'
    | 'procedural_status'
    | 'classification_ambiguity'
    | 'multiple'
  >;
  notes: FieldT<string>;
  initial_filing_assertion?: FieldT<string>;
  response_assertion?: FieldT<string>;
}[] {
  const out: ReturnType<typeof deriveRfes> = [];

  const rfePattern = /\b(rfe|noid|notice of intent to deny|request for evidence)\b/i;

  for (const entry of iterMemoryEntries(memory)) {
    const f = entry.facts;
    if (!f) continue;

    let dateValue: string | null = null;
    let datePage: number | null = null;
    let dateQuote: string | null = null;
    let noteText: string | null = null;
    let matched = false;

    if (f.doc_type === 'status_doc') {
      const cls = f.status_class?.value ?? '';
      if (rfePattern.test(cls) || rfePattern.test(entry.filename)) {
        matched = true;
        dateValue = f.admission_date?.value ?? f.authorized_until?.value ?? null;
        datePage = f.admission_date?.source_page ?? null;
        dateQuote = f.admission_date?.source_quote ?? null;
        noteText = cls || null;
      }
    } else if (f.doc_type === 'cover_letter') {
      if (rfePattern.test(entry.filename)) {
        matched = true;
        dateValue = f.letter_date?.value ?? null;
        datePage = f.letter_date?.source_page ?? null;
        dateQuote = f.letter_date?.source_quote ?? null;
        noteText = `RFE-flagged cover letter (${entry.filename})`;
      }
    } else if (f.doc_type === 'other') {
      const summary = f.one_line_summary?.value ?? '';
      if (rfePattern.test(summary) || rfePattern.test(entry.filename)) {
        matched = true;
        noteText = summary || null;
      }
    }

    if (!matched) continue;
    out.push({
      rfe_date: dateValue
        ? makeField(dateValue, datePage, dateQuote, 0.7)
        : NULL_FIELD,
      subject_category: makeField('other' as const, null, null, 0.5),
      notes: noteText ? makeField(noteText, null, null, 0.7) : NULL_FIELD,
    });
  }

  return out;
}

/**
 * Phase-3 §5 — investment.claimed_amount_usd.
 *
 * Pull the I-129 E Supplement's investment_amount_usd. Same pattern as
 * findConsiderationGateInputs, but exposed as a Field<number> for
 * unaccountedSofShareGate consumption.
 */
export function deriveClaimedAmountUsd(memory: TypedMemory): FieldT<number> | null {
  for (const entry of iterMemoryEntries(memory)) {
    const f = entry.facts;
    if (!f || f.doc_type !== 'uscis_or_dos_form') continue;
    const formId = f.form_id?.value ?? '';
    if (!/i[-\s]?129\s*e/i.test(formId)) continue;
    const amt = f.investment_amount_usd;
    if (typeof amt?.value !== 'number') continue;
    return makeField(amt.value, amt.source_page, amt.source_quote, amt.confidence);
  }
  return null;
}

/**
 * Phase-3 §6 — investor.current_status.
 *
 * Prefer rich i94 class_of_admission; fall back to thin status_doc
 * status_class. Both are short tokens like "B-2", "F-1", "ESTA".
 */
export function deriveCurrentStatus(memory: TypedMemory): FieldT<string> | null {
  for (const entry of iterMemoryEntries(memory)) {
    if (entry.i94?.class_of_admission?.value) {
      const f = entry.i94.class_of_admission;
      return makeField(f.value!, f.source_page, f.source_quote, f.confidence);
    }
  }
  for (const entry of iterMemoryEntries(memory)) {
    const f = entry.facts;
    if (f?.doc_type === 'status_doc' && f.status_class?.value) {
      const sc = f.status_class;
      return makeField(sc.value!, sc.source_page, sc.source_quote, sc.confidence);
    }
  }
  return null;
}

/**
 * Phase-3 §7 — investor.prior_status_expiration_date.
 *
 * Prefer rich i94 admit_until_date (skip when D/S marker is set — a
 * D/S admission has no calendar expiration). Fall back to status_doc
 * authorized_until.
 */
export function derivePriorStatusExpirationDate(
  memory: TypedMemory,
): FieldT<string> | null {
  for (const entry of iterMemoryEntries(memory)) {
    if (!entry.i94) continue;
    if (entry.i94.duration_of_status_marker?.value === true) continue;
    const f = entry.i94.admit_until_date;
    if (f?.value) return makeField(f.value, f.source_page, f.source_quote, f.confidence);
  }
  for (const entry of iterMemoryEntries(memory)) {
    const f = entry.facts;
    if (f?.doc_type === 'status_doc' && f.authorized_until?.value) {
      const au = f.authorized_until;
      return makeField(au.value!, au.source_page, au.source_quote, au.confidence);
    }
  }
  return null;
}

/**
 * Phase-5 §1 — investor.work_authorization_date.
 *
 * Pull the EARLIEST plausible US work-authorization start date for the
 * Beneficiary from the typed memory. Sources, in order of authority:
 *   1. visaStamp rich extracts where the classification is a
 *      work-authorizing class (E, H, L, O, P, EAD/Employment Authorization)
 *      and validity_start_date is populated.
 *   2. status_doc (thin) entries whose status_class names a work-authorizing
 *      class, using admission_date as the auth start.
 *
 * The B-2 status violation gate compares this against
 * enterprise.fully_operational_since_date — operations BEFORE the
 * earliest known work-auth = 9 FAM 402.9-7 violation. We deliberately
 * pick the EARLIEST work-authorizing date across all surfaced classes
 * (an H-1B before the E-2 still authorized employment) so the gate
 * doesn't false-positive on a renewal-flow case where the prior class
 * was already work-authorized.
 *
 * Returns null when no work-authorizing document is on file (the gate
 * handles null gracefully — falls back to filed_date_i129 comparison).
 */
const WORK_AUTHORIZING_CLASSIFICATIONS = /\b(e[-\s]?[12]|h[-\s]?[1-3][a-c]?|l[-\s]?[12][ab]?|o[-\s]?[12]|p[-\s]?[1-4]|tn|opt|ead|employment\s+authorization|work\s+permit)\b/i;

export function deriveWorkAuthorizationDate(memory: TypedMemory): FieldT<string> | null {
  const candidates: { date: Date; field: FieldT<string> }[] = [];

  for (const entry of iterMemoryEntries(memory)) {
    // Source 1: rich visa-stamp / I-797 extracts.
    const vs = entry.visaStamp;
    if (vs) {
      const cls = vs.classification?.value ?? '';
      if (WORK_AUTHORIZING_CLASSIFICATIONS.test(cls)) {
        const start = vs.validity_start_date;
        if (start?.value) {
          const d = new Date(start.value);
          if (!Number.isNaN(d.getTime())) {
            candidates.push({
              date: d,
              field: makeField(start.value, start.source_page, start.source_quote, start.confidence),
            });
          }
        }
      }
    }
    // Source 2: thin status_doc entries.
    const f = entry.facts;
    if (f?.doc_type === 'status_doc') {
      const cls = f.status_class?.value ?? '';
      if (WORK_AUTHORIZING_CLASSIFICATIONS.test(cls)) {
        const adm = f.admission_date;
        if (adm?.value) {
          const d = new Date(adm.value);
          if (!Number.isNaN(d.getTime())) {
            candidates.push({
              date: d,
              field: makeField(adm.value, adm.source_page, adm.source_quote, adm.confidence),
            });
          }
        }
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.date.getTime() - b.date.getTime());
  return candidates[0].field;
}

/**
 * Phase-3 §8 — source_of_funds enrichment in place.
 *
 * For each chain entry already on parsed.data.source_of_funds, if
 * documented_amount_usd is missing, fall back to origin_amount_usd
 * (lossy but better than null for the unaccounted_sof_share gate). If
 * source_person is missing, attempt to bind from a same-named entry in
 * the source_of_funds doc_type memory (donor_or_seller field).
 *
 * Returns the chains with the new optional fields populated only where
 * a confident source exists. Never overwrites a populated field.
 */
export function enrichSourceOfFundsChains(
  memory: TypedMemory,
  chains: E2Facts['source_of_funds'],
): E2Facts['source_of_funds'] {
  // Build a lookup: donor_or_seller name → SOF doc_type entry
  type SofDocEntry = {
    donor: string | null;
    amount: number | null;
    page: number | null;
    quote: string | null;
  };
  const sofDocs: SofDocEntry[] = [];
  for (const entry of iterMemoryEntries(memory)) {
    const f = entry.facts;
    if (f?.doc_type !== 'source_of_funds') continue;
    sofDocs.push({
      donor: f.donor_or_seller?.value ?? null,
      amount: f.amount_usd?.value ?? null,
      page: f.amount_usd?.source_page ?? null,
      quote: f.amount_usd?.source_quote ?? null,
    });
  }

  return chains.map((chain) => {
    const documented = chain.documented_amount_usd?.value;
    const origin = chain.origin_amount_usd?.value;
    let updatedDocumented = chain.documented_amount_usd;
    if ((updatedDocumented === undefined || documented == null) && typeof origin === 'number') {
      updatedDocumented = makeField(
        origin,
        chain.origin_amount_usd.source_page,
        chain.origin_amount_usd.source_quote,
        0.6,
      );
    }

    let updatedSourcePerson = chain.source_person;
    const sourcePersonName = chain.source_person?.full_name?.value;
    if (!updatedSourcePerson || !sourcePersonName) {
      // Match SOF doc_type donor_or_seller against this chain's notes /
      // origin_evidence (best signal we have without semantic linking).
      const notes = chain.notes?.value ?? '';
      const origin_ev = chain.origin_evidence?.value ?? '';
      const haystack = `${notes} ${origin_ev}`;
      for (const d of sofDocs) {
        if (!d.donor) continue;
        if (nameMatches(haystack, d.donor)) {
          updatedSourcePerson = {
            full_name: makeField(d.donor, d.page, d.quote, 0.6),
          };
          break;
        }
      }
    }

    return {
      ...chain,
      documented_amount_usd: updatedDocumented,
      source_person: updatedSourcePerson,
    };
  });
}

/* ---------------------------------------------------------------------- */
/* Phase-4 derivation helpers — cover-letter rich + RFE/NOID rich          */
/* ---------------------------------------------------------------------- */

/**
 * Phase-4 §1 — enterprise.fully_operational_since_date /
 * claimed_business_model / claimed_industry_naics from the rich
 * cover-letter extraction. The thin cover_letter doc_type carries only
 * letter_date / addressee / attorney_name / word_count_estimate; the
 * narrative claims live on entry.coverLetter (Phase-4 second pass).
 *
 * When multiple cover_letter entries are present (initial + RFE response),
 * prefer the EARLIEST by letter_date — the operational-since claim from
 * the initial filing is what the b2_status_violation_signal gate compares
 * against. Falls back to whichever has a populated value when dates tie.
 */
export function deriveCoverLetterFields(memory: TypedMemory): {
  fully_operational_since_date: FieldT<string> | null;
  claimed_business_model: FieldT<string> | null;
  claimed_industry_naics: FieldT<string> | null;
  principal_treaty_investor_identity: FieldT<string> | null;
} {
  type Candidate = {
    filename: string;
    letter_date: string | null;
    rich: PerPdfResult['coverLetter'];
  };
  const candidates: Candidate[] = [];
  for (const entry of iterMemoryEntries(memory)) {
    if (!entry.coverLetter) continue;
    const f = entry.facts;
    const letterDate =
      f && f.doc_type === 'cover_letter' ? f.letter_date?.value ?? null : null;
    candidates.push({ filename: entry.filename, letter_date: letterDate, rich: entry.coverLetter });
  }
  if (candidates.length === 0) {
    return {
      fully_operational_since_date: null,
      claimed_business_model: null,
      claimed_industry_naics: null,
      principal_treaty_investor_identity: null,
    };
  }
  candidates.sort((a, b) => {
    if (a.letter_date && b.letter_date) return a.letter_date.localeCompare(b.letter_date);
    if (a.letter_date) return -1;
    if (b.letter_date) return 1;
    return a.filename.localeCompare(b.filename);
  });

  function pick<K extends keyof NonNullable<PerPdfResult['coverLetter']>>(
    key: K,
  ): FieldT<string> | null {
    for (const c of candidates) {
      const f = c.rich?.[key];
      if (f && (f as FieldT<string>).value != null) {
        const v = f as FieldT<string>;
        return makeField(v.value!, v.source_page, v.source_quote, v.confidence);
      }
    }
    return null;
  }

  return {
    fully_operational_since_date: pick('fully_operational_since_date'),
    claimed_business_model: pick('claimed_business_model'),
    claimed_industry_naics: pick('claimed_industry_naics'),
    principal_treaty_investor_identity: pick('principal_treaty_investor_identity'),
  };
}

/**
 * Phase-7 — narrative cover-letter fields beyond the Phase-4 four. These
 * are LLM-only captures (no E2FactsSchema slot) surfaced to the drafter +
 * reviewer via the cover_letter rich payload that lands in memoryToPromptText.
 * Returns the FIRST populated entry per field across all cover_letter
 * extracts (cover letters of differing dates almost always agree on these
 * — they're invariant across initial filing / RFE response).
 *
 *   - prior_passport_renewal_footnote: B&B + Splash Sub1 signature pattern;
 *     drafter cites for consistency when on file.
 *   - five_year_business_horizon: cover-letter narrative claim (NOT business
 *     plan); the Substantiality/Marginality reviewer compares against
 *     the business plan's projections to detect drift.
 *   - develop_and_direct_role_grant: verbatim authority-grant scope; an
 *     empty authority_scope[] is the Berkant-style E5 vulnerability marker.
 */
export function deriveCoverLetterPhase7Fields(memory: TypedMemory): {
  prior_passport_renewal_footnote: NonNullable<
    NonNullable<PerPdfResult['coverLetter']>['prior_passport_renewal_footnote']
  > | null;
  five_year_business_horizon: NonNullable<
    NonNullable<PerPdfResult['coverLetter']>['five_year_business_horizon']
  > | null;
  develop_and_direct_role_grant: NonNullable<
    NonNullable<PerPdfResult['coverLetter']>['develop_and_direct_role_grant']
  > | null;
} {
  let footnote: ReturnType<typeof deriveCoverLetterPhase7Fields>['prior_passport_renewal_footnote'] = null;
  let horizon: ReturnType<typeof deriveCoverLetterPhase7Fields>['five_year_business_horizon'] = null;
  let grant: ReturnType<typeof deriveCoverLetterPhase7Fields>['develop_and_direct_role_grant'] = null;
  for (const entry of iterMemoryEntries(memory)) {
    const cl = entry.coverLetter;
    if (!cl) continue;
    if (!footnote && cl.prior_passport_renewal_footnote)
      footnote = cl.prior_passport_renewal_footnote;
    if (!horizon && cl.five_year_business_horizon)
      horizon = cl.five_year_business_horizon;
    if (!grant && cl.develop_and_direct_role_grant)
      grant = cl.develop_and_direct_role_grant;
  }
  return {
    prior_passport_renewal_footnote: footnote,
    five_year_business_horizon: horizon,
    develop_and_direct_role_grant: grant,
  };
}

const RFE_NOTICE_FILENAME_RE = /(\brfe\b|\bnoid\b|notice[-_\s]?of[-_\s]?intent[-_\s]?to[-_\s]?deny|request[-_\s]?for[-_\s]?evidence)/i;

/**
 * Phase-4 §2 — rfes[] enriched with subject_category + assertion text.
 *
 * Walks every entry whose rich rfeNotice was populated; emits one rfes[]
 * entry per RFE / NOID notice (document_role='rfe_notice' / 'noid_notice').
 * For each notice, scans the same memory for a paired response document
 * (document_role='rfe_response' / 'noid_response') matching on
 * subject_category — the response's response_assertion lands on the
 * notice's rfes[] entry. When subject_category='multiple' or matching is
 * ambiguous, falls back to the first response entry detected.
 *
 * Returns [] when no rich rfeNotice extractions are present (the caller
 * keeps the Phase-3 deriveRfes output instead).
 */
export function deriveRfesRich(
  memory: TypedMemory,
): ReturnType<typeof deriveRfes> {
  type RfeEntry = ReturnType<typeof deriveRfes>[number];
  const out: RfeEntry[] = [];

  type Bound = {
    filename: string;
    rich: NonNullable<PerPdfResult['rfeNotice']>;
  };
  const all: Bound[] = [];
  for (const entry of iterMemoryEntries(memory)) {
    if (!entry.rfeNotice) continue;
    all.push({ filename: entry.filename, rich: entry.rfeNotice });
  }
  if (all.length === 0) return out;

  const notices = all.filter(
    (b) =>
      b.rich.document_role.value === 'rfe_notice' ||
      b.rich.document_role.value === 'noid_notice',
  );
  const responses = all.filter(
    (b) =>
      b.rich.document_role.value === 'rfe_response' ||
      b.rich.document_role.value === 'noid_response',
  );

  for (const n of notices) {
    const cat = n.rich.subject_category;
    const subjVal = (cat.value ?? 'other') as RfeEntry['subject_category']['value'];
    const noteText = `${n.filename}: ${cat.value ?? 'other'}${
      n.rich.evidence_requested.length > 0
        ? ` — ${n.rich.evidence_requested.length} evidence items`
        : ''
    }`;

    let initial: FieldT<string> | undefined;
    const initF = n.rich.initial_filing_assertion;
    if (initF.value != null) {
      initial = makeField(initF.value, initF.source_page, initF.source_quote, initF.confidence);
    }

    let response: FieldT<string> | undefined;
    const match = responses.find(
      (r) =>
        r.rich.subject_category.value === cat.value ||
        r.rich.subject_category.value === 'multiple' ||
        cat.value === 'multiple',
    );
    if (match) {
      const respF = match.rich.response_assertion;
      if (respF.value != null) {
        response = makeField(
          respF.value,
          respF.source_page,
          respF.source_quote,
          respF.confidence,
        );
      }
    }

    const dateF = n.rich.rfe_date;
    out.push({
      rfe_date:
        dateF.value != null
          ? makeField(dateF.value, dateF.source_page, dateF.source_quote, dateF.confidence)
          : NULL_FIELD,
      subject_category: makeField(
        subjVal,
        cat.source_page,
        cat.source_quote,
        cat.confidence,
      ),
      notes: makeField(noteText, null, null, 0.7),
      ...(initial ? { initial_filing_assertion: initial } : {}),
      ...(response ? { response_assertion: response } : {}),
    });
  }

  return out;
}

/**
 * Phase-4 orchestrator. Mutates `facts` in place to populate the cover-
 * letter narrative claims and the rich RFE assertions Phase-3 left
 * `data_incomplete`. Idempotent: never overwrites a populated field.
 * Returns the mutated facts.
 *
 * Runs AFTER enrichPhase3Fields so it can upgrade Phase-3's stub rfes[]
 * (where subject_category='other' and assertions are null) when richer
 * RFE extractions exist.
 */
export function enrichPhase4Fields(facts: E2Facts, memory: TypedMemory): E2Facts {
  const cl = deriveCoverLetterFields(memory);

  // enterprise.fully_operational_since_date.
  if (
    !facts.enterprise.fully_operational_since_date ||
    facts.enterprise.fully_operational_since_date.value == null
  ) {
    if (cl.fully_operational_since_date) {
      facts.enterprise.fully_operational_since_date = cl.fully_operational_since_date;
    }
  }

  // enterprise.claimed_business_model.
  if (
    !facts.enterprise.claimed_business_model ||
    facts.enterprise.claimed_business_model.value == null
  ) {
    if (cl.claimed_business_model) {
      facts.enterprise.claimed_business_model = cl.claimed_business_model;
    }
  }

  // enterprise.naics_code — only fill when LLM left it absent and the
  // cover letter explicitly cites one. Phase-3 / aggregator extracts
  // NAICS from the I-129E + business_plan; cover-letter cite is a last
  // resort that should not overwrite either.
  if (!facts.enterprise.naics_code || facts.enterprise.naics_code.value == null) {
    if (cl.claimed_industry_naics) {
      facts.enterprise.naics_code = cl.claimed_industry_naics;
    }
  }

  // rfes[] — Phase-3 emits stub entries with subject_category='other' and
  // null assertions. If a richer Phase-4 extraction is available, replace
  // the stub set with the rich set. Idempotence is preserved by checking
  // whether existing entries already carry a non-'other' subject_category
  // OR a populated initial_filing_assertion: if so, leave alone.
  const rich = deriveRfesRich(memory);
  if (rich.length > 0) {
    const existing = facts.rfes ?? [];
    const hasRichExisting = existing.some(
      (r) =>
        r.subject_category?.value != null && r.subject_category.value !== 'other',
    );
    const hasAssertions = existing.some(
      (r) => r.initial_filing_assertion?.value != null || r.response_assertion?.value != null,
    );
    if (!hasRichExisting && !hasAssertions) {
      facts.rfes = rich;
    }
  }

  return facts;
}

/* ---------------------------------------------------------------------- */
/* Phase-6 derivation helpers                                              */
/* ---------------------------------------------------------------------- */

const SUB_APP_FILENAME_RE = /\bsub\s*([1-6])\b/i;

/**
 * Phase-6 §B — co-petitioner role enrichment.
 *
 * Layered on top of deriveCoPetitioners. For each co-petitioner already
 * derived, attach (where derivable from the typed memory):
 *   - relationship_to_principal  ← cover-letter rich extraction's
 *                                  co_petitioner_relationships[] match
 *                                  by normalized name.
 *   - sub_application_status     ← per-doc filename pattern (`Sub2`, etc.)
 *                                  on any document that names the
 *                                  co-petitioner. First match wins.
 *   - role_in_petitioner_entity  ← member resolutions / amendments role +
 *                                  ownership_percent ("50% Member",
 *                                  "President").
 *
 * Idempotent: leaves a field null when no signal is found. Never
 * overwrites a populated field.
 */
export function deriveCoPetitionersEnriched(
  memory: TypedMemory,
  options?: { subApplicationAliases?: Record<string, string> | null },
): {
  full_name: FieldT<string>;
  role: FieldT<string>;
  relationship_to_principal?: FieldT<string>;
  sub_application_status?: FieldT<string>;
  role_in_petitioner_entity?: FieldT<string>;
}[] {
  const base = deriveCoPetitioners(memory);
  if (base.length === 0) return [];

  type RelHit = { name: string; relationship: string; page: number | null; quote: string | null; confidence: number | null };
  const relHits: RelHit[] = [];
  for (const entry of iterMemoryEntries(memory)) {
    const cl = entry.coverLetter;
    if (!cl) continue;
    const list = (cl as unknown as { co_petitioner_relationships?: unknown }).co_petitioner_relationships;
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const it = item as { full_name?: FieldT<string>; relationship?: FieldT<string> };
      const n = it.full_name?.value;
      const r = it.relationship?.value;
      if (!n || !r) continue;
      relHits.push({
        name: n,
        relationship: r,
        page: it.relationship?.source_page ?? null,
        quote: it.relationship?.source_quote ?? null,
        confidence: it.relationship?.confidence ?? 0.7,
      });
    }
  }

  type RoleEntityHit = { name: string; role: string | null; pct: number | null; page: number | null; quote: string | null };
  const roleEntityHits: RoleEntityHit[] = [];
  for (const entry of iterMemoryEntries(memory)) {
    const cf = entry.corporateFormation;
    if (!cf) continue;
    const sub = cf.formation_doc_subtype;
    if (sub === 'articles_of_organization' || sub === 'articles_of_incorporation') {
      for (const m of cf.members_or_shareholders) {
        const n = m.name?.value;
        if (!n) continue;
        roleEntityHits.push({
          name: n,
          role: m.role?.value ?? null,
          pct: m.ownership_percent?.value ?? null,
          page: m.role?.source_page ?? m.name.source_page,
          quote: m.role?.source_quote ?? m.name.source_quote,
        });
      }
    }
  }

  type SubAppHit = { sub: string; page: number | null; quote: string | null };
  const subAppByName = new Map<string, SubAppHit>();
  for (const entry of iterMemoryEntries(memory)) {
    // Phase-6 primary: \bSub([1-6])\b filename regex.
    // Phase-7 fallback: alias map (lib/case-folder-aliases.ts) consulted
    // when the regex misses, with attorney-supplied per-matter overrides
    // taking precedence over the static map.
    let sub: string | null = null;
    const m = SUB_APP_FILENAME_RE.exec(entry.filename);
    if (m) {
      sub = `sub${m[1]}`;
    } else {
      const resolved = resolveSubApplicationAlias(
        entry.filename,
        options?.subApplicationAliases ?? null,
      );
      if (resolved) sub = resolved;
    }
    if (!sub) continue;
    const f = entry.facts;
    if (!f) continue;
    const candidates: string[] = [];
    const anyF = f as unknown as Record<string, FieldT<string> | undefined>;
    for (const k of ['full_name', 'beneficiary_name', 'petitioner_name', 'transferor_name', 'transferee_name']) {
      const v = anyF[k]?.value;
      if (typeof v === 'string') candidates.push(v);
    }
    const cf = entry.corporateFormation;
    if (cf) {
      const formSub = cf.formation_doc_subtype;
      if (formSub === 'articles_of_organization' || formSub === 'articles_of_incorporation') {
        for (const mem of cf.members_or_shareholders) {
          const n = mem.name?.value;
          if (n) candidates.push(n);
        }
      } else if (formSub === 'operating_agreement_amendment') {
        for (const mem of cf.new_member_list) {
          const n = mem.name?.value;
          if (n) candidates.push(n);
        }
      }
    }
    const c = entry.contract;
    if (c?.contract_subtype === 'membership_interest_transfer_agreement') {
      const tr = c.transferor.name?.value;
      const te = c.transferee.name?.value;
      if (tr) candidates.push(tr);
      if (te) candidates.push(te);
    }
    for (const cand of candidates) {
      const norm = normalizeName(cand);
      if (!norm) continue;
      if (!subAppByName.has(norm)) {
        subAppByName.set(norm, { sub, page: null, quote: entry.filename });
      }
    }
  }

  return base.map((co) => {
    const norm = normalizeName(co.full_name.value);
    const enriched: ReturnType<typeof deriveCoPetitionersEnriched>[number] = { ...co };

    const rel = relHits.find((h) => nameMatches(h.name, co.full_name.value));
    if (rel) {
      enriched.relationship_to_principal = makeField(
        rel.relationship,
        rel.page,
        rel.quote,
        rel.confidence,
      );
    }

    const subHit = subAppByName.get(norm);
    if (subHit) {
      enriched.sub_application_status = makeField(
        subHit.sub,
        subHit.page,
        subHit.quote,
        0.9,
      );
    }

    const roleHit = roleEntityHits.find((h) => nameMatches(h.name, co.full_name.value));
    if (roleHit) {
      const parts: string[] = [];
      if (roleHit.pct != null) parts.push(`${roleHit.pct}% Member`);
      if (roleHit.role) parts.push(roleHit.role);
      const phrase = parts.join(' / ').trim() || roleHit.role || null;
      if (phrase) {
        enriched.role_in_petitioner_entity = makeField(
          phrase,
          roleHit.page,
          roleHit.quote,
          0.8,
        );
      }
    }

    return enriched;
  });
}

/**
 * Phase-6 §C — observed_business_model from manual-input stub.
 *
 * No automated puller (Yelp / Google / BBB are out-of-scope this phase).
 * Returns the attorney-typed manualInput as a Field<string> when present,
 * else null. The aggregator's enrichPhase6Fields prefers an existing
 * facts.enterprise.observed_business_model when populated; manualInput
 * only fills the manual_input slot. The external_evidence_contradiction_risk
 * gate reads observed_business_model_manual_input as a fallback when
 * observed_business_model is null.
 */
export function deriveObservedBusinessModel(
  _memory: TypedMemory,
  manualInput?: string | null,
): FieldT<string> | null {
  if (!manualInput || manualInput.trim().length === 0) return null;
  return makeField(manualInput.trim(), null, '[manual attorney input]', 1);
}

/**
 * Phase-6 §A — NAICS / industry drift across cover_letter ↔ business_plan.
 *
 * Returns 0 or 1 conflict-register entries (one per matter). Compares:
 *   - coverLetter.claimed_industry_naics  (6-digit NAICS code, optional)
 *   - coverLetter.claimed_business_model  (industry phrase)
 *   - business_plan.naics_code            (6-digit NAICS code)
 *   - business_plan.industry              (industry phrase)
 *
 * Phase-7 — I-129 E Supplement (rich) is the third source. When all three
 * are populated and pairwise diverge, emit a 3-source conflict
 * (`NAICS_DRIFT_3SRC`) carrying fact_c.
 *
 * Drift detected when EITHER (a) two non-null NAICS codes differ at the
 * 2-digit sector OR (b) two non-null industry phrases share Jaccard token
 * overlap ≤ 0.2 (e.g., "e-commerce beauty retail" vs "automotive repair").
 * One entry only; severity 4 (factual_material).
 */
const NAICS_PHRASE_JACCARD_THRESHOLD = 0.2;

function tokenizeIndustryPhrase(s: string | null | undefined): Set<string> {
  if (!s) return new Set();
  return new Set(
    normalizeName(s)
      .split(' ')
      .filter((t) => t.length >= 3 && !/^(and|the|for|with|llc|inc|company|services|enterprise|business)$/.test(t)),
  );
}

export interface NaicsDriftConflict {
  conflict_id: 'NAICS_DRIFT' | 'NAICS_DRIFT_3SRC';
  fact_a: { source_doc: string; value: string };
  fact_b: { source_doc: string; value: string };
  fact_c?: { source_doc: string; value: string };
  conflict_type: 'naics_industry_drift';
  severity: 4;
}

export function deriveNaicsDriftConflicts(memory: TypedMemory): NaicsDriftConflict[] {
  type Source = { doc: string; code: string | null; phrase: string | null };
  const sources: Source[] = [];

  for (const entry of iterMemoryEntries(memory)) {
    if (entry.coverLetter) {
      const code = entry.coverLetter.claimed_industry_naics?.value ?? null;
      const phrase = entry.coverLetter.claimed_business_model?.value ?? null;
      if (code || phrase) sources.push({ doc: entry.filename, code, phrase });
    }
    const f = entry.facts;
    if (f?.doc_type === 'business_plan') {
      const code = f.naics_code?.value ?? null;
      const phrase = f.industry?.value ?? null;
      if (code || phrase) sources.push({ doc: entry.filename, code, phrase });
    }
    // Phase-7 — I-129 E Supplement is the third source.
    if (entry.i129eSupplement) {
      const code = entry.i129eSupplement.naics_code?.value ?? null;
      const phrase = entry.i129eSupplement.industry_classification?.value ?? null;
      if (code || phrase) sources.push({ doc: entry.filename, code, phrase });
    }
  }
  if (sources.length < 2) return [];

  // Look for 3-source mutual divergence first (richer signal).
  if (sources.length >= 3) {
    for (let i = 0; i < sources.length; i++) {
      for (let j = i + 1; j < sources.length; j++) {
        for (let k = j + 1; k < sources.length; k++) {
          const a = sources[i];
          const b = sources[j];
          const c = sources[k];
          if (a.code && b.code && c.code) {
            const codes = new Set([a.code, b.code, c.code]);
            if (codes.size === 3) {
              return [
                {
                  conflict_id: 'NAICS_DRIFT_3SRC',
                  fact_a: { source_doc: a.doc, value: a.code },
                  fact_b: { source_doc: b.doc, value: b.code },
                  fact_c: { source_doc: c.doc, value: c.code },
                  conflict_type: 'naics_industry_drift',
                  severity: 4,
                },
              ];
            }
          }
          if (a.phrase && b.phrase && c.phrase) {
            const ab = jaccard(tokenizeIndustryPhrase(a.phrase), tokenizeIndustryPhrase(b.phrase));
            const ac = jaccard(tokenizeIndustryPhrase(a.phrase), tokenizeIndustryPhrase(c.phrase));
            const bc = jaccard(tokenizeIndustryPhrase(b.phrase), tokenizeIndustryPhrase(c.phrase));
            if (ab <= NAICS_PHRASE_JACCARD_THRESHOLD && ac <= NAICS_PHRASE_JACCARD_THRESHOLD && bc <= NAICS_PHRASE_JACCARD_THRESHOLD) {
              return [
                {
                  conflict_id: 'NAICS_DRIFT_3SRC',
                  fact_a: { source_doc: a.doc, value: a.phrase },
                  fact_b: { source_doc: b.doc, value: b.phrase },
                  fact_c: { source_doc: c.doc, value: c.phrase },
                  conflict_type: 'naics_industry_drift',
                  severity: 4,
                },
              ];
            }
          }
        }
      }
    }
  }

  for (let i = 0; i < sources.length; i++) {
    for (let j = i + 1; j < sources.length; j++) {
      const a = sources[i];
      const b = sources[j];

      if (a.code && b.code) {
        const aSec = a.code.slice(0, 2);
        const bSec = b.code.slice(0, 2);
        if (a.code !== b.code || aSec !== bSec) {
          return [
            {
              conflict_id: 'NAICS_DRIFT',
              fact_a: { source_doc: a.doc, value: a.code },
              fact_b: { source_doc: b.doc, value: b.code },
              conflict_type: 'naics_industry_drift',
              severity: 4,
            },
          ];
        }
      }

      if (a.phrase && b.phrase) {
        const overlap = jaccard(tokenizeIndustryPhrase(a.phrase), tokenizeIndustryPhrase(b.phrase));
        if (overlap <= NAICS_PHRASE_JACCARD_THRESHOLD) {
          return [
            {
              conflict_id: 'NAICS_DRIFT',
              fact_a: { source_doc: a.doc, value: a.phrase },
              fact_b: { source_doc: b.doc, value: b.phrase },
              conflict_type: 'naics_industry_drift',
              severity: 4,
            },
          ];
        }
      }
    }
  }
  return [];
}

/**
 * Phase-6 orchestrator. Runs after enrichPhase4Fields. Mutates facts in
 * place. Idempotent — never overwrites populated fields. Append-only on
 * conflict_register (de-duped by conflict_type per-matter).
 */
export function enrichPhase6Fields(
  facts: E2Facts,
  memory: TypedMemory,
  options?: { observedBusinessModelManualInput?: string | null },
): E2Facts {
  // Co-petitioner enrichment — upgrade existing entries with the 3 new
  // optional fields when derivable. Only attaches; never replaces names.
  if (facts.matter?.co_petitioners && facts.matter.co_petitioners.length > 0) {
    const enriched = deriveCoPetitionersEnriched(memory, {
      subApplicationAliases: facts.matter.sub_application_aliases ?? null,
    });
    const byName = new Map<string, ReturnType<typeof deriveCoPetitionersEnriched>[number]>();
    for (const e of enriched) {
      const k = normalizeName(e.full_name.value);
      if (k) byName.set(k, e);
    }
    facts.matter.co_petitioners = facts.matter.co_petitioners.map((co) => {
      const k = normalizeName(co.full_name.value);
      const hit = byName.get(k);
      if (!hit) return co;
      const merged: typeof co = { ...co };
      if (
        (!merged.relationship_to_principal || merged.relationship_to_principal.value == null) &&
        hit.relationship_to_principal
      ) {
        merged.relationship_to_principal = hit.relationship_to_principal as typeof merged.relationship_to_principal;
      }
      if (
        (!merged.sub_application_status || merged.sub_application_status.value == null) &&
        hit.sub_application_status
      ) {
        merged.sub_application_status = hit.sub_application_status as typeof merged.sub_application_status;
      }
      if (
        (!merged.role_in_petitioner_entity || merged.role_in_petitioner_entity.value == null) &&
        hit.role_in_petitioner_entity
      ) {
        merged.role_in_petitioner_entity = hit.role_in_petitioner_entity;
      }
      return merged;
    });
  }

  // observed_business_model_manual_input — attorney-typed Yelp/Google/BBB
  // check. Manual stub only; no API.
  if (
    !facts.enterprise.observed_business_model_manual_input ||
    facts.enterprise.observed_business_model_manual_input.value == null
  ) {
    const obs = deriveObservedBusinessModel(memory, options?.observedBusinessModelManualInput ?? null);
    if (obs) facts.enterprise.observed_business_model_manual_input = obs;
  }

  // NAICS drift conflict_register entry (one per matter, idempotent on
  // conflict_type + fact_a_doc + fact_b_doc).
  const drifts = deriveNaicsDriftConflicts(memory);
  for (const d of drifts) {
    const alreadyLogged = facts.conflict_register.some(
      (c) =>
        c.conflict_type.value === 'naics_industry_drift' &&
        c.fact_a_doc.value === d.fact_a.source_doc &&
        c.fact_b_doc.value === d.fact_b.source_doc,
    );
    if (alreadyLogged) continue;
    const triadSuffix = d.fact_c
      ? ` vs ${d.fact_c.source_doc} ("${d.fact_c.value}")`
      : '';
    const gateLabel =
      d.conflict_id === 'NAICS_DRIFT_3SRC'
        ? '[deterministic Phase-7 NAICS drift gate (3-source)]'
        : '[deterministic Phase-6 NAICS drift gate]';
    facts.conflict_register.push({
      description: {
        value: `NAICS / industry drift across ${d.fact_a.source_doc} ("${d.fact_a.value}") vs ${d.fact_b.source_doc} ("${d.fact_b.value}")${triadSuffix}. Reconcile the industry classification before filing — divergent NAICS / industry framing is an RFE risk under USCIS Policy Manual Vol. 2 Part L.`,
        source_page: null,
        source_quote: gateLabel,
        confidence: 1,
      },
      conflict_type: {
        value: 'naics_industry_drift',
        source_page: null,
        source_quote: '[deterministic Phase-6 NAICS drift gate]',
        confidence: 1,
      },
      severity: {
        value: d.severity,
        source_page: null,
        source_quote: '[deterministic Phase-6 NAICS drift gate]',
        confidence: 1,
      },
      fact_a_doc: {
        value: d.fact_a.source_doc,
        source_page: null,
        source_quote: d.fact_a.value,
        confidence: 1,
      },
      fact_a_page: { value: null, source_page: null, source_quote: null, confidence: 1 },
      fact_b_doc: {
        value: d.fact_b.source_doc,
        source_page: null,
        source_quote: d.fact_b.value,
        confidence: 1,
      },
      fact_b_page: { value: null, source_page: null, source_quote: null, confidence: 1 },
    });
  }

  return facts;
}

/**
 * Phase-8 orchestrator. Routes the Phase-7 cover-letter narrative-claim
 * fields (passport-renewal footnote, five-year horizon, develop-and-direct
 * role grant) onto facts.cover_letter_phase7 so the drafter and the two
 * Phase-8 gates (develop_and_direct_role_authority_thin,
 * five_year_horizon_marginal_failure) can consume them without round-
 * tripping through entry.coverLetter JSON. Runs after enrichPhase6Fields.
 * Idempotent — never overwrites a populated field.
 *
 * The cover-letter rich extractor's enum values for authority_scope
 * (closed enum: contract_signing | banking_authority | hire_fire |
 * day_to_day_operations | strategic_planning) are also the canonical
 * E2FactsSchema enum, so the values pass through verbatim. Unknown
 * authority_scope strings (legacy fixtures) are dropped silently.
 */
const KNOWN_AUTHORITY_SCOPES: ReadonlySet<string> = new Set([
  'contract_signing',
  'banking_authority',
  'hire_fire',
  'day_to_day_operations',
  'strategic_planning',
]);

export function enrichPhase8Fields(facts: E2Facts, memory: TypedMemory): E2Facts {
  const phase7 = deriveCoverLetterPhase7Fields(memory);
  const target = facts.cover_letter_phase7 ?? {};

  if (
    target.passport_renewal_footnote == null &&
    phase7.prior_passport_renewal_footnote
  ) {
    const f = phase7.prior_passport_renewal_footnote;
    target.passport_renewal_footnote = {
      paragraph_text: f.paragraph_text,
      prior_passport_number: f.prior_passport_number,
      current_passport_number: f.current_passport_number,
    };
  }

  if (target.five_year_horizon == null && phase7.five_year_business_horizon) {
    const h = phase7.five_year_business_horizon;
    target.five_year_horizon = {
      year_1_revenue_usd: h.year_1_revenue_usd,
      year_3_revenue_usd: h.year_3_revenue_usd,
      year_5_revenue_usd: h.year_5_revenue_usd,
      year_5_employee_count: h.year_5_employee_count,
    };
  }

  if (
    target.develop_and_direct_role_grant == null &&
    phase7.develop_and_direct_role_grant
  ) {
    const g = phase7.develop_and_direct_role_grant;
    target.develop_and_direct_role_grant = {
      role_title: g.role_title,
      granting_document_ref: g.granting_document_ref,
      authority_scope: g.authority_scope.filter((s) => KNOWN_AUTHORITY_SCOPES.has(s)) as (
        | 'contract_signing'
        | 'banking_authority'
        | 'hire_fire'
        | 'day_to_day_operations'
        | 'strategic_planning'
      )[],
    };
  }

  if (
    target.passport_renewal_footnote ||
    target.five_year_horizon ||
    target.develop_and_direct_role_grant
  ) {
    facts.cover_letter_phase7 = target;
  }
  return facts;
}

/**
 * Phase-9 — surfaces the business-plan rich extractor's five-year
 * horizon (year-1 / year-3 / year-5 revenue + year-5 employee count)
 * onto facts.business_plan_phase9. The
 * `five_year_horizon_vs_business_plan_drift` gate compares this against
 * facts.cover_letter_phase7.five_year_horizon for credibility under
 * Matter of Ho. Idempotent — never overwrites a populated slot. Picks
 * the FIRST populated business_plan rich entry (case folders rarely
 * carry multiple plans; when they do, the LLM aggregator's preference
 * cascade keeps the most authoritative source elsewhere).
 */
export function enrichPhase9Fields(facts: E2Facts, memory: TypedMemory): E2Facts {
  if (facts.business_plan_phase9?.five_year_horizon != null) return facts;

  type Horizon = {
    year_1_revenue_usd: number | null;
    year_3_revenue_usd: number | null;
    year_5_revenue_usd: number | null;
    year_5_employee_count: number | null;
  };
  let horizon: Horizon | null = null;
  for (const entry of iterMemoryEntries(memory)) {
    const bp = entry.businessPlan;
    if (!bp) continue;
    const y1 = bp.year_1_revenue_usd?.value ?? null;
    const y3 = bp.year_3_revenue_usd?.value ?? null;
    const y5 = bp.year_5_revenue_usd?.value ?? null;
    const e5 = bp.year_5_employee_count?.value ?? null;
    if (y1 == null && y3 == null && y5 == null && e5 == null) continue;
    horizon = {
      year_1_revenue_usd: y1,
      year_3_revenue_usd: y3,
      year_5_revenue_usd: y5,
      year_5_employee_count: e5,
    };
    break;
  }
  if (horizon) {
    facts.business_plan_phase9 = {
      ...(facts.business_plan_phase9 ?? {}),
      five_year_horizon: horizon,
    };
  }
  return facts;
}

/**
 * Phase-3 orchestrator. Mutates `facts` in place to populate any of the
 * Phase-1 / Phase-2 optional gate inputs that the LLM aggregator left
 * absent. Idempotent: never overwrites a populated field. Returns the
 * mutated facts for chaining convenience.
 */
export function enrichPhase3Fields(facts: E2Facts, memory: TypedMemory): E2Facts {
  // matter.co_petitioners — only fill when LLM produced none.
  if (!facts.matter || !facts.matter.co_petitioners || facts.matter.co_petitioners.length === 0) {
    const coPet = deriveCoPetitioners(memory);
    if (coPet.length > 0) {
      facts.matter = { co_petitioners: coPet };
    }
  }

  // ownership_history — only fill when LLM produced none.
  if (!facts.ownership_history || facts.ownership_history.length === 0) {
    const hist = deriveOwnershipHistory(memory);
    if (hist.length > 0) {
      facts.ownership_history = hist;
    }
  }

  // filed_date_i129 — fill when missing or value is null.
  if (!facts.filed_date_i129 || facts.filed_date_i129.value == null) {
    const filed = deriveFiledDateI129(memory);
    if (filed) facts.filed_date_i129 = filed;
  }

  // rfes[] — fill when missing or empty.
  if (!facts.rfes || facts.rfes.length === 0) {
    const rfes = deriveRfes(memory);
    if (rfes.length > 0) facts.rfes = rfes;
  }

  // investment.claimed_amount_usd — fill when absent or null.
  const inv = facts.investment;
  if (!inv.claimed_amount_usd || inv.claimed_amount_usd.value == null) {
    const claimed = deriveClaimedAmountUsd(memory);
    if (claimed) inv.claimed_amount_usd = claimed;
  }

  // source_of_funds enrichment.
  if (Array.isArray(facts.source_of_funds) && facts.source_of_funds.length > 0) {
    facts.source_of_funds = enrichSourceOfFundsChains(memory, facts.source_of_funds);
  }

  // investor.current_status.
  if (!facts.investor.current_status || facts.investor.current_status.value == null) {
    const cs = deriveCurrentStatus(memory);
    if (cs) facts.investor.current_status = cs;
  }

  // investor.prior_status_expiration_date.
  if (
    !facts.investor.prior_status_expiration_date ||
    facts.investor.prior_status_expiration_date.value == null
  ) {
    const ex = derivePriorStatusExpirationDate(memory);
    if (ex) facts.investor.prior_status_expiration_date = ex;
  }

  // investor.work_authorization_date — Phase-5: pull the earliest
  // plausible work-auth start from any visaStamp / status_doc whose
  // classification names a work-authorizing class (E/H/L/O/P/EAD).
  // Phase-3 noted we can't be certain the prior approval is for THIS
  // case theory's enterprise, but for the b2_status_violation_signal
  // gate that doesn't matter — any prior US work auth foreclosing the
  // "operating on a B visa" failure mode is enough to short-circuit
  // the gate. False negatives on first-time E-2 cases (no prior auth
  // → field stays null → gate falls back to filed_date_i129) are the
  // intended behavior.
  if (
    !facts.investor.work_authorization_date ||
    facts.investor.work_authorization_date.value == null
  ) {
    const wa = deriveWorkAuthorizationDate(memory);
    if (wa) facts.investor.work_authorization_date = wa;
  }

  // enterprise.fully_operational_since_date / claimed_business_model —
  // Phase-3 cannot derive: cover-letter narrative body is not extracted.
  // Phase-4 (cover-letter rich extractor) will populate. observed
  // business model needs the external puller — explicitly out of scope.

  // rfes[].initial_filing_assertion / response_assertion — see above
  // (cover-letter / RFE-response body extraction is Phase-4).

  return facts;
}

export async function aggregateTypedMemoryToE2(
  memory: TypedMemory,
  options?: {
    filingDate?: Date;
    aliases?: Record<string, FilenameAlias>;
    /**
     * Phase-6 — optional one-line attorney-typed observation of the
     * petitioner's externally-visible business activity (Yelp / Google /
     * BBB / petitioner website). When supplied, lands on
     * facts.enterprise.observed_business_model_manual_input and feeds the
     * external_evidence_contradiction_risk gate as a fallback when
     * observed_business_model is null. No automated puller.
     */
    observedBusinessModelManualInput?: string | null;
  },
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
  real_estate_buyer_mismatch_results: RealEstateBuyerMismatchAuditRow[];
  incentive_recipient_mismatch_results: IncentiveRecipientMismatchAuditRow[];
  substantiality_recon_results: SubstantialityReconResult[];
  entity_coherence_results: EntityCoherenceResult[];
}> {
  const memoryBlock = memoryToPromptText(memory);
  const inventoryBlock = buildDocInventoryWithAliases(memory, options?.aliases);
  const inventorySection = inventoryBlock ? `\n\n${inventoryBlock}` : '';
  const investorOwnerBlock = buildInvestorOwnerBindingBlock(memory);
  const sofChainBlock = buildSofChainHintsBlock(memory);
  const userMessage = `${USER_INSTRUCTION}${inventorySection}\n\n${investorOwnerBlock}\n\n${sofChainBlock}\n\n# Typed memory\n\n${memoryBlock}\n\nRespond with ONLY a single JSON object matching the E2FactsSchema. No prose, no markdown fences, no commentary.`;

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
  // Bumped to 32K so adaptive thinking + the JSON body both fit. With
  // E2FactsSchema's ~176 leaves, the JSON itself runs 6–10K; thinking on
  // a 158K-token corpus can easily eat 12K. 16K was getting truncated
  // mid-object on real cases ("No JSON object found in response").
  //
  // Streaming is mandatory: Anthropic refuses non-streaming requests that
  // could exceed 10 minutes wall-clock, and a 158K-input + adaptive-thinking
  // call can easily cross that. We stream and assemble the final message;
  // no UI deltas are surfaced — the route's heartbeat covers that.
  const FIRST_PASS_MAX_TOKENS = 32_000;
  const stream = getAnthropic().messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: FIRST_PASS_MAX_TOKENS,
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
  const response = await stream.finalMessage();

  let jsonText = '';
  for (const block of response.content) {
    if (block.type === 'text') jsonText += block.text;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(extractFirstJsonObject(jsonText));
  } catch (firstErr: unknown) {
    // Fallback: retry once with thinking disabled. On a 158K-token corpus
    // adaptive thinking sometimes consumes the entire output budget and
    // the JSON never lands. Without thinking the model goes straight to
    // structured output. Same prompt, same schema constraints.
    const retryStream = getAnthropic().messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 16_000,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral', ttl: '1h' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });
    const retry = await retryStream.finalMessage();
    let retryText = '';
    for (const block of retry.content) {
      if (block.type === 'text') retryText += block.text;
    }
    try {
      raw = JSON.parse(extractFirstJsonObject(retryText));
    } catch (retryErr: unknown) {
      throw new Error(
        `Aggregator JSON parse failed (retry also failed) — ` +
          `first: ${firstErr instanceof Error ? firstErr.message : String(firstErr)}; ` +
          `retry: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`,
      );
    }
    logAnthropicUsage({
      stage: 'extract',
      model: 'claude-sonnet-4-6',
      case_type: 'E2',
      usage: retry.usage,
    });
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

  // Phase-3 deterministic enrichment: fill the Phase-1/Phase-2 gate inputs
  // (matter.co_petitioners, ownership_history, filed_date_i129, rfes[],
  // investment.claimed_amount_usd, source_of_funds.documented_amount_usd /
  // source_person, investor.current_status / prior_status_expiration_date)
  // directly from the typed memory whenever the LLM aggregator left them
  // absent. Idempotent — never overwrites a populated field. Runs BEFORE
  // the conflict-register backstops so the gate authority cascade has
  // canonical inputs to read.
  enrichPhase3Fields(parsed.data, memory);

  // Phase-4 enrichment — cover-letter rich + RFE/NOID rich. Runs after
  // Phase-3 so it can upgrade the stub rfes[] entries (subject_category
  // ='other', assertions null) when richer extractions are available, and
  // populates enterprise.fully_operational_since_date /
  // claimed_business_model from the cover-letter narrative body so
  // b2_status_violation_signal and external_evidence_contradiction_risk
  // gates leave 'data_incomplete'.
  enrichPhase4Fields(parsed.data, memory);

  // Phase-6 enrichment — co-petitioner role detail, observed_business_model
  // manual-input stub, NAICS drift conflict_register entry. The manual
  // input field is wired through aggregateTypedMemoryToE2's options
  // (defaulting to null when callers don't supply it).
  enrichPhase6Fields(parsed.data, memory, {
    observedBusinessModelManualInput:
      options?.observedBusinessModelManualInput ?? null,
  });

  // Phase-8 enrichment — surface the Phase-7 cover-letter narrative claims
  // (passport-renewal footnote, five-year horizon, develop-and-direct role
  // grant) onto facts.cover_letter_phase7 so the drafter and the two
  // new Phase-8 gates can read them as canonical inputs.
  enrichPhase8Fields(parsed.data, memory);

  // Phase-9 enrichment — surface the business-plan rich extractor's
  // five-year horizon onto facts.business_plan_phase9 so the
  // five_year_horizon_vs_business_plan_drift gate can compare it
  // against the cover-letter narrative claim.
  enrichPhase9Fields(parsed.data, memory);

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

  // Tab F substantiality reconciliation: prove the committed-investment
  // figure with money-out evidence (outflows + invoices + equipment).
  // Idempotent: only one substantiality_under_documented or
  // substantiality_over_documented finding per matter — keyed on
  // conflict_type alone, not document pair, since the gate aggregates
  // many docs into a single ratio.
  const substantialityRecon = reconcileSubstantiality(memory);
  if (
    substantialityRecon.verdict === 'under_documented' ||
    substantialityRecon.verdict === 'over_documented'
  ) {
    const conflictType =
      substantialityRecon.verdict === 'under_documented'
        ? 'substantiality_under_documented'
        : 'substantiality_over_documented';
    const severity = substantialityRecon.verdict === 'under_documented' ? 3 : 2;
    const alreadyLogged = parsed.data.conflict_register.some(
      (c) => c.conflict_type.value === conflictType,
    );
    if (!alreadyLogged) {
      const ratioPct =
        substantialityRecon.coverage_ratio !== null
          ? (substantialityRecon.coverage_ratio * 100).toFixed(1)
          : 'n/a';
      const documented =
        substantialityRecon.sum_outflows_usd +
        substantialityRecon.sum_invoices_usd +
        substantialityRecon.sum_equipment_usd;
      const evidenceList = substantialityRecon.evidence_doc
        .map((e) => `${e.filename} (${e.category}, USD ${e.amount_usd.toFixed(2)})`)
        .join('; ');
      parsed.data.conflict_register.push({
        description: {
          value: `Tab F substantiality coverage = ${ratioPct}% (committed USD ${
            substantialityRecon.total_committed_usd?.toFixed(2) ?? 'n/a'
          }; documented USD ${documented.toFixed(2)} = outflows ${substantialityRecon.sum_outflows_usd.toFixed(
            2,
          )} + invoices ${substantialityRecon.sum_invoices_usd.toFixed(
            2,
          )} + equipment ${substantialityRecon.sum_equipment_usd.toFixed(2)}). Evidence: ${evidenceList}`,
          source_page: null,
          source_quote: '[deterministic Tab F reconciliation gate]',
          confidence: 1,
        },
        conflict_type: {
          value: conflictType,
          source_page: null,
          source_quote: '[deterministic Tab F reconciliation gate]',
          confidence: 1,
        },
        severity: {
          value: severity,
          source_page: null,
          source_quote: '[deterministic Tab F reconciliation gate]',
          confidence: 1,
        },
        fact_a_doc: {
          value: substantialityRecon.contract_filename,
          source_page: null,
          source_quote: null,
          confidence: 1,
        },
        fact_a_page: {
          value: null,
          source_page: null,
          source_quote: null,
          confidence: 1,
        },
        fact_b_doc: {
          value:
            substantialityRecon.evidence_doc[0]?.filename ?? null,
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
  }

  // Tab D entity coherence: every named entity across formation docs +
  // petition forms + leases + payroll + financial statements should
  // describe the same legal person. Drift = severity 4. A foreign
  // parent / US subsidiary pattern (board_resolution authorizing US
  // investment) is an accepted multi-group case — no conflict fires.
  // Idempotent on (conflict_type, sorted distinct_names hash).
  const entityCoherence = reconcileEntityCoherence(memory);
  if (entityCoherence.verdict === 'name_drift') {
    const distinctNames = entityCoherence.groups
      .map((g) => g.canonical_name)
      .sort()
      .join('|');
    const alreadyLogged = parsed.data.conflict_register.some(
      (c) =>
        c.conflict_type.value === 'entity_name_drift' &&
        c.description.value?.includes(distinctNames),
    );
    if (!alreadyLogged) {
      const groupsSummary = entityCoherence.groups
        .map(
          (g) =>
            `"${g.canonical_name}" (${g.occurrences
              .map((o) => `${o.filename}:${o.source_field}`)
              .join(', ')})`,
        )
        .join('; ');
      parsed.data.conflict_register.push({
        description: {
          value: `Entity name drift across ${entityCoherence.groups.length} distinct identities [${distinctNames}]. Groups: ${groupsSummary}. Verify that every formation_doc / petitioner_name / lessee / employer_name / financial_statement.entity_name describes the same legal entity, or document the parent / subsidiary relationship via a board_resolution authorizing US investment.`,
          source_page: null,
          source_quote: '[deterministic Tab D coherence gate]',
          confidence: 1,
        },
        conflict_type: {
          value: 'entity_name_drift',
          source_page: null,
          source_quote: '[deterministic Tab D coherence gate]',
          confidence: 1,
        },
        severity: {
          value: 4,
          source_page: null,
          source_quote: '[deterministic Tab D coherence gate]',
          confidence: 1,
        },
        fact_a_doc: {
          value: entityCoherence.groups[0]?.occurrences[0]?.filename ?? null,
          source_page: null,
          source_quote: null,
          confidence: 1,
        },
        fact_a_page: {
          value: null,
          source_page: null,
          source_quote: null,
          confidence: 1,
        },
        fact_b_doc: {
          value: entityCoherence.groups[1]?.occurrences[0]?.filename ?? null,
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

  // Manual §3.2 treaty-ownership gate: deterministic backstop. For every
  // foreign-corporate shareholder_register with a populated
  // treaty_national_ownership_percent below TREATY_OWNERSHIP_THRESHOLD,
  // append a severity-5 conflict. Idempotent on
  // (conflict_type, fact_a_doc).
  for (const entry of iterMemoryEntries(memory)) {
    const fc = entry.foreignCorporate;
    if (!fc || fc.foreign_doc_subtype !== 'shareholder_register') continue;
    const pct = fc.treaty_national_ownership_percent.value;
    if (pct == null) continue;
    if (pct >= TREATY_OWNERSHIP_THRESHOLD) continue;
    const alreadyLogged = parsed.data.conflict_register.some(
      (c) =>
        c.conflict_type.value === 'treaty_ownership_below_50' &&
        c.fact_a_doc.value === entry.filename,
    );
    if (alreadyLogged) continue;
    parsed.data.conflict_register.push({
      description: {
        value: `Foreign-corporate shareholder register reports treaty-national ownership ${pct.toFixed(2)}% (threshold ${TREATY_OWNERSHIP_THRESHOLD}%). Manual §3.2 / 9 FAM 402.9-4(B) gate failed — entity does not qualify as a treaty enterprise.`,
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      conflict_type: {
        value: 'treaty_ownership_below_50',
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
        value: entry.filename,
        source_page: fc.treaty_national_ownership_percent.source_page,
        source_quote: fc.treaty_national_ownership_percent.source_quote,
        confidence: 1,
      },
      fact_a_page: {
        value: fc.treaty_national_ownership_percent.source_page,
        source_page: fc.treaty_national_ownership_percent.source_page,
        source_quote: fc.treaty_national_ownership_percent.source_quote,
        confidence: 1,
      },
      fact_b_doc: {
        value: null,
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

  // Manual §6 board-resolution authorized-amount drift gate: deterministic
  // backstop. For every foreign-corporate board_resolution with
  // authorized_amount_usd populated AND the I-129E investment_amount_usd
  // known, drift beyond BOARD_RESOLUTION_DRIFT_TOLERANCE (10%) → severity-4
  // conflict. Idempotent on (conflict_type, fact_a_doc, fact_b_doc).
  let i129eAmountForBoardGate: number | null = null;
  let i129eFilenameForBoardGate: string | null = null;
  let i129ePageForBoardGate: number | null = null;
  let i129eQuoteForBoardGate: string | null = null;
  for (const entry of iterMemoryEntries(memory)) {
    if (entry.facts?.doc_type !== 'uscis_or_dos_form') continue;
    const formId = entry.facts.form_id.value ?? '';
    if (!/i[-\s]?129\s*e/i.test(formId)) continue;
    const amount = entry.facts.investment_amount_usd.value;
    if (amount == null) continue;
    i129eAmountForBoardGate = amount;
    i129eFilenameForBoardGate = entry.filename;
    i129ePageForBoardGate = entry.facts.investment_amount_usd.source_page;
    i129eQuoteForBoardGate = entry.facts.investment_amount_usd.source_quote;
    break;
  }
  if (
    i129eAmountForBoardGate != null &&
    i129eAmountForBoardGate > 0 &&
    i129eFilenameForBoardGate != null
  ) {
    for (const entry of iterMemoryEntries(memory)) {
      const fc = entry.foreignCorporate;
      if (!fc || fc.foreign_doc_subtype !== 'board_resolution') continue;
      const authorized = fc.authorized_amount_usd.value;
      if (authorized == null) continue;
      const drift = Math.abs(authorized - i129eAmountForBoardGate);
      const driftRatio = drift / i129eAmountForBoardGate;
      if (driftRatio <= BOARD_RESOLUTION_DRIFT_TOLERANCE) continue;
      const alreadyLogged = parsed.data.conflict_register.some(
        (c) =>
          c.conflict_type.value === 'board_resolution_amount_drift' &&
          c.fact_a_doc.value === entry.filename &&
          c.fact_b_doc.value === i129eFilenameForBoardGate,
      );
      if (alreadyLogged) continue;
      parsed.data.conflict_register.push({
        description: {
          value: `Board-resolution authorized amount USD ${authorized.toFixed(2)} disagrees with I-129 E Supplement investment amount USD ${i129eAmountForBoardGate.toFixed(2)} (drift USD ${drift.toFixed(2)}, ${(driftRatio * 100).toFixed(1)}%; tolerance ${(BOARD_RESOLUTION_DRIFT_TOLERANCE * 100).toFixed(0)}%). Manual §6 gate failed.`,
          source_page: null,
          source_quote: '[deterministic post-aggregation gate]',
          confidence: 1,
        },
        conflict_type: {
          value: 'board_resolution_amount_drift',
          source_page: null,
          source_quote: '[deterministic post-aggregation gate]',
          confidence: 1,
        },
        severity: {
          value: 4,
          source_page: null,
          source_quote: '[deterministic post-aggregation gate]',
          confidence: 1,
        },
        fact_a_doc: {
          value: entry.filename,
          source_page: fc.authorized_amount_usd.source_page,
          source_quote: fc.authorized_amount_usd.source_quote,
          confidence: 1,
        },
        fact_a_page: {
          value: fc.authorized_amount_usd.source_page,
          source_page: fc.authorized_amount_usd.source_page,
          source_quote: fc.authorized_amount_usd.source_quote,
          confidence: 1,
        },
        fact_b_doc: {
          value: i129eFilenameForBoardGate,
          source_page: i129ePageForBoardGate,
          source_quote: i129eQuoteForBoardGate,
          confidence: 1,
        },
        fact_b_page: {
          value: i129ePageForBoardGate,
          source_page: i129ePageForBoardGate,
          source_quote: i129eQuoteForBoardGate,
          confidence: 1,
        },
      });
    }
  }

  // Manual MANUAL-SUBTYPE-4 §3.8.5 real-estate buyer-mismatch gate.
  // Severity 4: a deed/purchase agreement in a non-Petitioner name
  // breaks the at-risk-of-the-enterprise narrative.
  const petitionerLegalName = parsed.data.enterprise.legal_name.value;
  const realEstateBuyerRows = runRealEstateBuyerMismatchGate(
    memory,
    petitionerLegalName,
  );
  for (const row of realEstateBuyerRows) {
    if (row.ok) continue;
    if (row.reason !== 'mismatch') continue;
    const alreadyLogged = parsed.data.conflict_register.some(
      (c) =>
        c.conflict_type.value === 'real_estate_buyer_mismatch' &&
        c.fact_a_doc.value === row.filename,
    );
    if (alreadyLogged) continue;
    parsed.data.conflict_register.push({
      description: {
        value: `Real-estate purchase buyer "${row.buyer_legal_name ?? '?'}" disagrees with Petitioner legal name "${row.petitioner_legal_name ?? '?'}" — at-risk-of-the-enterprise narrative requires the purchase be held by the Petitioner. Manual MANUAL-SUBTYPE-4 §3.8.5 gate failed.`,
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      conflict_type: {
        value: 'real_estate_buyer_mismatch',
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      severity: {
        value: 4,
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

  // Manual MANUAL-SUBTYPE-4 incentive recipient-mismatch gate.
  // Severity 3: an incentive awarded to the Beneficiary personally /
  // to a parent / sister entity cannot be claimed as Petitioner capacity.
  const incentiveRecipientRows = runIncentiveRecipientMismatchGate(
    memory,
    petitionerLegalName,
  );
  for (const row of incentiveRecipientRows) {
    if (row.ok) continue;
    if (row.reason !== 'mismatch') continue;
    const alreadyLogged = parsed.data.conflict_register.some(
      (c) =>
        c.conflict_type.value === 'incentive_recipient_mismatch' &&
        c.fact_a_doc.value === row.filename,
    );
    if (alreadyLogged) continue;
    parsed.data.conflict_register.push({
      description: {
        value: `Incentive recipient "${row.recipient_legal_name ?? '?'}" disagrees with Petitioner legal name "${row.petitioner_legal_name ?? '?'}" — incentive cannot be claimed as Petitioner enterprise capacity until the recipient discrepancy is resolved.`,
        source_page: null,
        source_quote: '[deterministic post-aggregation gate]',
        confidence: 1,
      },
      conflict_type: {
        value: 'incentive_recipient_mismatch',
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
    real_estate_buyer_mismatch_results: realEstateBuyerRows,
    incentive_recipient_mismatch_results: incentiveRecipientRows,
    substantiality_recon_results: [substantialityRecon],
    entity_coherence_results: [entityCoherence],
  };
}
