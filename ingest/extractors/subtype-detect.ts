/**
 * Phase-0.6 E-2 case-subtype classifier.
 *
 * Two operating modes:
 *
 *   mode: 'raw_docs' (DEFAULT — production)
 *     The bot reads RAW client documents only — passports, contracts,
 *     bank statements, CVs, diplomas, certificates, foreign corporate
 *     records, Tapu records, service records. The bot does NOT see
 *     cover letters, Job Offer Letters, or filed USCIS/DOS forms in
 *     production: those are OUTPUTS the bot generates from these inputs.
 *     Signals therefore come from document presence + content shape, not
 *     from "REQUESTED CLASSIFICATION" lines or letterhead.
 *
 *   mode: 'filed_sample' (REGRESSION TEST)
 *     Reads filed Akalan exemplars (Camural, Kacar-Salih) so we can
 *     calibrate detection accuracy against ground truth. This mode
 *     looks for letterhead, REQUESTED CLASSIFICATION lines, etc.
 *
 * Default is 'raw_docs'. The route in app/api/ingest-path/route.ts
 * picks broader samples (any contract / CV / passport / bank statement,
 * up to 6 PDFs) via pickRawDocSamplePaths so the detector sees the
 * doc types whose presence drives the §7 raw-docs signal table.
 */

import path from 'node:path';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import { E2CaseSubtypeSchema, type E2CaseSubtype } from './subtype-detect.schema';

export type SubtypeDetectMode = 'raw_docs' | 'filed_sample';

/* ---------------------------------------------------------------------- */
/* RAW DOCS prompt — production path                                      */
/* ---------------------------------------------------------------------- */

const RAW_DOCS_SYSTEM_PROMPT = `You are an immigration paralegal performing Phase-0.6 sub-type triage on a case folder for an E-2 (8 CFR §214.2(e); 9 FAM 402.9) filing the firm is preparing.

CRITICAL CONTEXT — INPUT MODEL:
You are reading RAW CLIENT DOCUMENTS the firm has collected. You will NOT see a cover letter, a Job Offer Letter, an I-129, an I-129E, a DS-160, or a DS-156E in the input — those are OUTPUTS the bot generates from these raw inputs. Do NOT rely on letterhead, "REQUESTED CLASSIFICATION" lines, or filed-form signals; they will not be present. Reason from document PRESENCE and CONTENT instead.

Your job: pick the principal sub-type, identify the procedural posture, and flag dependents.

The four E-2 principal sub-types (one and only one applies):

1. individual_investor — Beneficiary directly invests substantial capital and develops & directs the enterprise. Owns ≥50% personally OR has operational control via governance. Pattern: a single individual + a small US LLC + a personal source-of-funds chain.

2. corporate_owned_investor — A treaty-country CORPORATION is the investor. The human beneficiary qualifies because of that corporate ownership, NOT because the beneficiary funded the US enterprise personally.

3. executive_supervisory_employee — Beneficiary is an EMPLOYEE (NOT funding) of a qualifying treaty enterprise, in an executive or supervisory capacity. Beneficiary's nationality MUST match the enterprise's qualifying treaty-country nationality.

4. essential_skills_employee — Beneficiary is an EMPLOYEE (NOT funding) with special qualifications essential to the enterprise's operation, NOT readily available in the US labor market. Foreign-language-and-culture alone is NOT enough.

=== RAW-DOCS SIGNAL TABLE (use ONLY these heuristics) ===

Subtype 1 — individual_investor:
- Membership Interest Transfer Agreement names the Beneficiary as a member with ownership ≥50% (or any percent that, combined with treaty-national co-owners, reaches ≥50%).
- Operating Agreement lists the Beneficiary as a member with capital contribution.
- Personal source-of-funds chain documented in raw form: foreign property sale (Tapu / title deed) + foreign personal bank statements + currency conversion receipt + international wire to Beneficiary's US personal account + final transfer to the enterprise or co-owner.
- NO foreign-parent corporate documents (no audited group financials, no foreign Articles for a parent company).
- The US enterprise's formation documents reference the Beneficiary as an organizing or majority member.

Subtype 2 — corporate_owned_investor:
- Foreign corporate Articles of Incorporation / equivalent for a treaty-country PARENT entity.
- Audited financials for that foreign parent.
- Board resolution authorizing the parent's investment in the US entity.
- Shareholder register showing ≥50% treaty-national ownership of the foreign parent.
- A single corporate-parent → US-subsidiary funding flow (parent's bank → US subsidiary's bank), NOT a personal SOF chain.
- The Beneficiary appears as the parent corporation's executive in foreign service / payroll records, NOT as the personal investor.

Subtype 3 — executive_supervisory_employee:
- Beneficiary CV / Resume titled at C-suite (CEO, CFO, COO, CTO), VP, Director, General Manager, or Country Manager level, with prior P&L responsibility, signing authority, and supervised teams.
- Letters of Recommendation describe the Beneficiary supervising significant operations or directing strategy.
- Compensation evidence (offer letter from foreign employer, prior payroll) puts comp at executive industry/geography benchmarks.
- The US enterprise's corporate documents show an EXISTING entity (incorporated > 1 year ago, with prior payroll, prior tax filings) — NOT a fresh formation.
- NO Membership Interest Transfer Agreement granting ownership to the Beneficiary.
- Beneficiary's prior service record at the foreign treaty-country parent is in management.

Subtype 4 — essential_skills_employee:
- Beneficiary CV / Resume titled at specialist, engineer, technician, analyst, or non-C-suite manager level (NOT CEO / CFO / VP).
- Diploma in a relevant technical field.
- Industry certifications (manufacturer-specific, vendor-specific, regulatory, language-of-trade).
- Letters of Recommendation describe specialized technical expertise — specific products, processes, applications, training programs the Beneficiary built or runs.
- Service Record (or prior employer letter) shows salary differential vs the US domestic peer market — i.e., the foreign salary at the foreign employer is meaningfully above local peer benchmarks because of the specialized skills.
- The US enterprise's corporate documents show an EXISTING entity (NOT a fresh formation).
- Foreign-language-and-culture alone is NOT enough to qualify — if the only differentiator is bilingualism, route LOW confidence.

=== PROCEDURAL POSTURE — RAW-DOCS SIGNAL TABLE ===

Without I-129 / DS-160 in the input, infer posture from prior status evidence in the raw docs:

- consular_new — Beneficiary's passport shows NO prior E-2 stamp, NO prior US I-94 record, AND beneficiary's mailing address / residence evidence is foreign. First-time E-2 issued at consulate.
- uscis_cos_new — Beneficiary's passport shows a current US visa stamp in another category (B-1/B-2, F-1, H-1B, L-1, etc.), there is a US I-94 still valid, and US residence evidence is present. Change-of-Status filing.
- uscis_extension — Beneficiary's passport shows a PRIOR E-2 visa stamp, the I-94 is current (admit-until in the FUTURE), and US residence + prior US tax / payroll evidence is present. Extension filing.
- consular_renewal — Beneficiary's passport shows a PRIOR E-2 visa stamp BUT the I-94 has expired or the Beneficiary is currently abroad. Re-issuance at consulate.

If signals are unclear or absent, prefer the most conservative posture: uscis_extension for individual_investor (renewal is the most common Akalan E-2 case); uscis_cos_new for employee subtypes when US presence is confirmed; consular_new otherwise.

=== DEPENDENTS ===

- has_dependents=true if ANY of: spouse passport bio-page, child passport bio-page, marriage certificate, birth certificate, dependent's prior visa stamp, dependent's prior I-94.
- dependent_breakdown.spouse=true when spouse's passport + marriage certificate are present.
- dependent_breakdown.children = count of distinct child passports OR child birth certificates.
- If has_dependents=false, dependent_breakdown MUST be null and dependent_count MUST be 0.

=== OUTPUT RULES ===

- principal_subtype: exactly one of individual_investor / corporate_owned_investor / executive_supervisory_employee / essential_skills_employee.
- procedural_posture: exactly one of consular_new / uscis_cos_new / uscis_extension / consular_renewal.
- detection_signals: 2–6 verbatim quotes from the documents (each 5–25 words) that justify the principal_subtype + procedural_posture pick. Prefix each with [filename] for traceability. Examples:
    "[membership-transfer-agreement.pdf] transferred 50% membership interest to Salih Kacar in consideration of $120,000.00"
    "[passport.pdf] E-2 visa issued 2023-08-12 valid until 2026-08-11"
- detection_confidence:
  - HIGH — at least 3 strong raw-document signals align (e.g., Membership Interest Transfer + personal SOF chain + no foreign parent for Subtype 1; OR Diploma + technical certifications + LoR describing specialized expertise + offer letter with salary-differential evidence for Subtype 4).
  - MED — 1–2 strong signals plus several weak ones; or signals point unambiguously to "employee" but the Subtype 3 vs 4 split is unclear.
  - LOW — only weak signals; missing key evidence; or contradictory signals; route to attorney for manual confirmation.
- reasoning: 1–3 sentences citing the strongest signals you found and stating the pick.

=== IMPORTANT GUARDRAILS ===

- DO NOT INVENT FACTS. If the documents do not contain a clear signal, the verdict is LOW confidence — say so honestly.
- DO NOT GUESS AT DEPENDENTS. If you don't see spouse / child identity docs, dependents=false.
- The four sub-types are MUTUALLY EXCLUSIVE. If signals point to multiple subtypes, pick the strongest by signal weight (presence of a Membership Interest Transfer to the Beneficiary beats CV title; presence of a foreign parent's audited financials beats personal SOF).
- "Foreign-language-and-culture alone is NOT enough" for Subtype 4 — if the only argued skill is bilingualism / cultural fit, route to LOW confidence.

=== AKALAN FIRM EXEMPLARS (calibration, raw-doc shape) ===

- Kacar-Salih (Jan 2026) → individual_investor + uscis_extension. Raw-doc signals: Membership Interest Transfer Agreement names Salih Kacar as 50% member; Operating Agreement amendment lists Kacar + Demir as members; Tapu records show Turkish property sale; personal Turkish bank receipts (TRY 30K + 40K + 2.9M + 1M + 30K) from buyer; FX conversion receipt; international wires from Beneficiary's Turkish account to his US personal account; final transfer to co-owner's US account; no foreign-parent corporate docs; passport shows prior E-2 visa + valid I-94; spouse passport + 3 child birth certificates present.

- Camural / Pomega (Feb 2024) → essential_skills_employee + uscis_cos_new. Raw-doc signals: Beneficiary CV titled "Medium Voltage Sales Specialist"; Diploma in electrical engineering; multiple manufacturer certifications; Letters of Recommendation from prior employers describing specific medium-voltage product expertise; Service Record showing salary differential vs US sales-engineer benchmarks; foreign parent (Pomega Energy) Turkish corporate docs + audited financials in folder; US subsidiary corporate docs (existing entity, not fresh); parent → subsidiary wire confirmation; NO personal SOF chain; passport shows prior B-2 visa + active US I-94 (entered solo on B-2); no spouse / child docs in this filing.`;

/* ---------------------------------------------------------------------- */
/* FILED SAMPLE prompt — regression test against historical filings        */
/* ---------------------------------------------------------------------- */

const FILED_SAMPLE_SYSTEM_PROMPT = `You are an immigration paralegal performing Phase-0.6 sub-type triage on a HISTORICAL filed Akalan E-2 case folder (a regression-test exemplar that already includes the cover letter and filed forms). Use this mode ONLY for ground-truth calibration runs against Camural / Kacar-Salih style filings — production runs use the raw_docs mode.

The four E-2 principal sub-types (one and only one applies):

1. individual_investor — Beneficiary directly invests substantial capital and develops & directs the enterprise. Owns ≥50% personally OR has operational control via governance. Pattern: a single individual + a small US LLC + a personal source-of-funds chain (sale of property, savings, gift, lawful loan). Authority: 9 FAM 402.9-4(A), 9 FAM 402.9-4(B), 9 FAM 402.9-7(1); 8 CFR §214.2(e)(2).

2. corporate_owned_investor — A treaty-country CORPORATION is the investor; the human beneficiary qualifies because of that corporate ownership. Authority: 9 FAM 402.9-4(B); 8 CFR §214.2(e)(3).

3. executive_supervisory_employee — Beneficiary is an EMPLOYEE (NOT funding) of a qualifying treaty enterprise, in an executive or supervisory capacity. Authority: 9 FAM 402.9-7(2)(a); 8 CFR §214.2(e)(17). Cover letter often says "REQUESTED CLASSIFICATION: E2 — EXECUTIVE/SUPERVISORY".

4. essential_skills_employee — Beneficiary is an EMPLOYEE (NOT funding) with special qualifications essential to the enterprise's operation, NOT readily available in the US labor market. Authority: 9 FAM 402.9-7(2)(b); 8 CFR §214.2(e)(18). Cover letter often says "REQUESTED CLASSIFICATION: E2 — SPECIALIZED KNOWLEDGE".

=== TAXONOMY §7 — FILED-SAMPLE SIGNAL TABLE ===

| Signal | Suggests subtype |
| --- | --- |
| (Beneficiary) in cover letter is also (Investor) or majority owner | 1 |
| Membership Interest Transfer Agreement OR Operating Agreement names beneficiary as ≥50% member | 1 |
| Cover letter on LAW-FIRM letterhead and signed by Attorney | 1 (most likely) |
| Cover letter on PETITIONER / CORPORATE letterhead, signed by VP HR / COO / officer | 3 or 4 |
| "REQUESTED CLASSIFICATION: E2 — SPECIALIZED KNOWLEDGE" anywhere in the cover letter | 4 |
| "REQUESTED CLASSIFICATION: E2 — EXECUTIVE/SUPERVISORY" anywhere in the cover letter | 3 |
| Job Offer Letter present in the folder | 3 or 4 |
| Beneficiary's salary stated WITH industry / peer comparison | 4 |
| Beneficiary CV emphasizes specialized technical skills NOT exec authority | 4 |
| Beneficiary CV emphasizes prior P&L ownership, signing authority, supervised teams | 3 |
| Multiple foreign + US entity corporate documents (parent-subsidiary structure) | 2, 3, or 4 |
| Single foreign LLC + only US LLC corporate documents | 1 |
| Personal SOF chain narrated (property sale, inheritance, currency conversion) | 1 |
| Single corporate-parent → US-subsidiary wire, NO personal SOF | 2, 3, or 4 |
| I-539 + I-539A forms present | + dependents |
| No I-539 / no spouse + child documents | dependents=false |

=== PROCEDURAL POSTURE ===

| Posture | Signals |
| --- | --- |
| consular_new | DS-160 + DS-156E only, NO I-129. |
| uscis_cos_new | I-129 + I-129E present; I-94 admit-until in PAST OR Beneficiary in another status. |
| uscis_extension | I-129 + I-129E present; cover letter says "Renewal" / "Extension"; I-94 admit-until in FUTURE. |
| consular_renewal | DS-160 + DS-156E only; cover letter says "Renewal"; prior E-2 visa stamp referenced. |

If signals conflict, prefer the form mix the cover letter is currently arguing.

=== DEPENDENTS ===

- has_dependents=true if ANY of: I-539, I-539A, dependent passport bio-pages, dependent visa stamps, dependent Notice of Intent to Depart, marriage certificate or birth certificate exhibits.
- dependent_breakdown.spouse=true when an I-539 + spouse passport / marriage cert is present.
- dependent_breakdown.children = count of I-539A forms OR distinct child birth certificates.
- If has_dependents=false, dependent_breakdown MUST be null and dependent_count MUST be 0.

=== OUTPUT RULES ===

- principal_subtype: exactly one of the four enums.
- procedural_posture: exactly one of the four enums.
- detection_signals: 2–6 verbatim quotes (5–25 words each) prefixed with [filename].
- detection_confidence: HIGH (3+ strong signals), MED (1–2 strong + weak), LOW (only weak; route to attorney).
- reasoning: 1–3 sentences citing strongest signals.

=== AKALAN EXEMPLARS ===

- Kacar-Salih → individual_investor + uscis_extension. Signals: law-firm letterhead, Membership Interest Transfer names beneficiary as 50% member, personal SOF chain, I-129 + I-129E + I-539 + I-539A.
- Camural / Pomega → essential_skills_employee + uscis_cos_new. Signals: petitioner letterhead, "REQUESTED CLASSIFICATION: E2 — SPECIALIZED KNOWLEDGE", Job Offer Letter, Diploma + Certificates + LoR, parent + subsidiary corporate docs, parent → subsidiary wire, no personal SOF.`;

/* ---------------------------------------------------------------------- */
/* Detector                                                               */
/* ---------------------------------------------------------------------- */

const DETECTION_FORMAT = zodOutputFormat(E2CaseSubtypeSchema);

const PER_FILE_CHARS = 6000;
const MAX_FILES = 6;

export interface SubtypeDetectionInput {
  filename: string;
  text: string;
}

export interface SubtypeDetectionOptions {
  /**
   * Production runs use 'raw_docs' (the bot only sees raw client docs).
   * 'filed_sample' is for regression-testing against Akalan exemplars
   * where the cover letter and filed forms are present in the folder.
   * Default: 'raw_docs'.
   */
  mode?: SubtypeDetectMode;
}

export async function detectE2Subtype(
  samples: SubtypeDetectionInput[],
  options: SubtypeDetectionOptions = {},
): Promise<E2CaseSubtype> {
  if (samples.length === 0) {
    throw new Error('detectE2Subtype requires at least one document sample');
  }

  const mode: SubtypeDetectMode = options.mode ?? 'raw_docs';
  const systemPrompt =
    mode === 'filed_sample' ? FILED_SAMPLE_SYSTEM_PROMPT : RAW_DOCS_SYSTEM_PROMPT;

  const trimmed = samples
    .slice(0, MAX_FILES)
    .map(
      (s) =>
        `## File: ${s.filename}\n\n${s.text.slice(0, PER_FILE_CHARS)}${
          s.text.length > PER_FILE_CHARS ? '\n[…truncated…]' : ''
        }`,
    )
    .join('\n\n---\n\n');

  const response = await getAnthropic().messages.parse({
    model: 'claude-haiku-4-5',
    max_tokens: 2000,
    system: [
      { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral', ttl: '1h' } },
    ],
    messages: [{ role: 'user', content: trimmed }],
    output_config: { format: DETECTION_FORMAT },
  });

  if (!response.parsed_output) {
    throw new Error('E-2 sub-type detector response did not match the schema');
  }

  logAnthropicUsage({
    stage: 'detect',
    model: 'claude-haiku-4-5',
    case_type: 'E2',
    usage: response.usage,
  });

  return response.parsed_output;
}

/* ---------------------------------------------------------------------- */
/* Sample picker — raw_docs mode                                          */
/* ---------------------------------------------------------------------- */

/**
 * Filename-pattern heuristics for picking signal-dense raw documents.
 * Order matters: each bucket gets at most 2 PDFs, total cap is 6.
 *
 * The detector's signal-weight model puts contracts first (Membership
 * Interest Transfer / Operating Agreement / leases — highest leverage
 * for Subtype 1 vs. employee subtypes), then CVs (separates Subtype 3
 * from 4), then passports (procedural posture), then bank statements
 * (corroborates SOF chain shape — present for Subtype 1, absent for
 * employee subtypes).
 */
const RAW_DOC_BUCKETS: { name: string; patterns: RegExp[] }[] = [
  {
    name: 'contract',
    patterns: [
      /membership[-_\s]?interest/i,
      /transfer[-_\s]?agreement/i,
      /operating[-_\s]?agreement/i,
      /bill[-_\s]?of[-_\s]?sale/i,
      /share(holder)?s?[-_\s]?agreement/i,
      /lease/i,
      /\bcontract\b/i,
      /\bagreement\b/i,
    ],
  },
  {
    name: 'cv',
    patterns: [
      /\bcv\b/i,
      /resume/i,
      /\bo[zg]gec?mis\b/i, // ozgecmis / özgeçmiş
      /curriculum[-_\s]?vitae/i,
    ],
  },
  {
    name: 'passport',
    patterns: [/passport/i, /pasaport/i],
  },
  {
    name: 'bank',
    patterns: [
      /\bbank\b/i,
      /statement/i,
      /\bextre\b/i, // Turkish bank statement
      /receipt/i,
      /\bwire\b/i,
      /transfer[-_\s]?confirmation/i,
      /swift/i,
    ],
  },
];

const MAX_PER_BUCKET = 2;
const MAX_TOTAL_SAMPLES = 6;

/**
 * Pick up to 6 signal-dense PDFs for the raw_docs sub-type detector.
 * Uses filename-pattern matching across four buckets (contract / cv /
 * passport / bank). Falls back to the first 3 PDFs if no filename
 * matches any heuristic — the detector will likely return LOW
 * confidence in that case, which is the right outcome.
 */
export function pickRawDocSamplePaths(pdfPaths: string[]): string[] {
  const seen = new Set<string>();
  const picked: string[] = [];

  for (const bucket of RAW_DOC_BUCKETS) {
    let bucketCount = 0;
    for (const p of pdfPaths) {
      if (seen.has(p)) continue;
      const base = path.basename(p).toLowerCase();
      if (bucket.patterns.some((re) => re.test(base))) {
        seen.add(p);
        picked.push(p);
        bucketCount++;
        if (bucketCount >= MAX_PER_BUCKET) break;
        if (picked.length >= MAX_TOTAL_SAMPLES) return picked;
      }
    }
    if (picked.length >= MAX_TOTAL_SAMPLES) break;
  }

  if (picked.length === 0) {
    // No filename matched — fall back to first 3 alphabetically. The
    // detector should return LOW confidence; the route should surface
    // that and route to attorney for manual sub-type selection.
    return pdfPaths.slice(0, 3);
  }

  return picked;
}
