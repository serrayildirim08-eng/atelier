import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import type { CaseFacts, CaseType, E2Facts } from '@/ingest/schema';
import { ReviewReportSchema, type ReviewReport } from './schema';
import type { VerifyReport } from '@/lib/verify';
import { reportToReviewerPrompt } from '@/lib/verify';
import {
  createAssertionComparator,
  type AssertionComparator,
} from './material-change-comparator';

const SHARED_REVIEW_FRAMEWORK = `Conduct five checks and produce a structured review report.

## Check 1: Grounding (no hallucination)

For every SPECIFIC FACTUAL CLAIM ABOUT THE CASE (names, dates, addresses, dollar amounts, percentages, employee counts, citation counts, role titles, etc.), cross-reference the facts JSON.
- A claim that contradicts the facts: severity=critical, category=contradicts_facts.
- A claim that introduces specific case information NOT derivable from the facts JSON: severity=major, category=hallucination.
- Generic legal boilerplate, statutory citations, procedural language, and rhetorical framing are NOT subject to this check.
- [MISSING: <field>], [CITE NEEDED: ...], [INSUFFICIENT CRITERIA: ...], and [WEAK: ...] markers in the draft are correctly flagged gaps. Do NOT flag them as inconsistencies.

## Check 2: Internal consistency

For every dollar amount, date, name, address, ownership percentage, or other repeated value:
- Verify the value appears identically each time. "$150,000" and "$150,000.00" together is internal inconsistency.
- Names spelled differently, dates in different formats, addresses with discrepancies — flag each (category=internal_inconsistency).
- Severity: minor for purely cosmetic; major if the variance creates legal ambiguity.

## Check 3: Element / criterion coverage

(See per-case-type section below for the specific elements and labels to use.) Determine whether the draft ARGUES each required element/criterion by linking specific facts to the legal standard, versus merely RECITING the rule. A section that quotes the rule but never names the relevant case facts is a missing argument.

## Check 4: USCIS RFE risk

(See per-case-type section below for the specific RFE patterns to screen.) Each weak_spots entry: severity, element label, description, the specific rfe_risk, and a concrete suggestion to strengthen.

## Check 5: Structured forensic fields — leverage and address

The Facts JSON includes structured forensic fields. The draft is responsible for confronting them, not hiding them. Apply these rules:

### conflict_register (all case types)
- Severity 5 (dispositive) entries: the draft MUST disclose, address, or pause for attorney sign-off. A draft that proceeds as if a severity-5 conflict does not exist = severity=critical, category=contradicts_facts.
- Severity 4 (factual_material) entries: the draft should address or contextualize. Silently ignored severity-4 entry = severity=major, category=internal_inconsistency or contradicts_facts (whichever fits).
- Severity 1-3: acceptable to omit from the letter; do NOT flag the omission.

### evidence_aps (EB-1A, EB-1B only)
- For each criterion the draft argues, check whether the supporting evidence_aps rows are predominantly APS 3-5 (HIGH rfe_risk). A criterion argued solely on APS 3-5 evidence = weak_spots entry, severity=major, with concrete suggestion to substitute or supplement with APS ≥6 evidence (if any exists in facts) or pivot to a different criterion (if 3+ already meet).
- A draft that ignores the strongest available evidence (APS 8-9 items present in facts but unreferenced in the letter) = weak_spots entry, severity=major, "lead with the APS 8-9 evidence in [criterion]".

### kazarian_step_two and international_recognition (EB-1A and EB-1B respectively)
- top_of_field_evidence: items present in facts but absent from the draft's Section V (EB-1A) / Section VI (EB-1B) = missing_arguments entry.
- peer_benchmarking: rows with real benchmark_source in facts but no benchmarking paragraph in the draft = missing_arguments. If the draft asserts the beneficiary is "at the top" or "internationally recognized" without any benchmarking and the facts have no peer_benchmarking rows either, = weak_spots, severity=major.
- narrative_stress_test: if populated in facts but not addressed in the draft = missing_arguments. Do NOT flag if the field is null.

### subordinate_tier_table (EB-1C only)
- All side="us" rows tier="non-professional" AND draft does not pivot to function-manager doctrine: severity=critical, category="contradicts_facts" or weak_spots major depending on whether the draft hides this fact. Cite INA 101(a)(44)(A)(ii).
- side="us" rows present in facts but draft's Section VI does not reference the tier classification = missing_arguments.
- UNCLEAR rows: do NOT flag the draft for omitting them; UNCLEAR is a data-quality issue upstream, not a draft defect.

## Severity rubric

- critical: would cause denial or constitute a fundamental misrepresentation. Use sparingly.
- major: would likely draw an RFE; substantive issue requiring revision before filing.
- minor: cosmetic, formatting, low risk.

## Output rules

- Be specific. For each finding, quote a SHORT excerpt (≤30 words) from the letter so the reviewer can locate it. letter_excerpt may be null for findings about an absence.
- Do NOT pad. Empty arrays for empty categories. Do not invent findings to fill space.
- summary: 1–3 sentences capturing the overall verdict.
- overall_assessment:
  - ready: no critical or major findings; minor cleanup only.
  - minor_revisions: a small number of major findings, fixable in under an hour.
  - major_revisions: several major findings, or one critical finding.
  - not_ready: critical errors that require restarting sections.
- element labels: use exactly the labels listed in the per-case-type block below, or "general" for findings that don't map to a specific element/criterion.`;

// E-2 reviewer — Authority cascade: INA § 101(a)(15)(E)(ii); 8 CFR § 214.2(e); 9 FAM 402.9;
// USCIS Policy Manual Vol. 2 Part G; Matter of Walsh and Pollard; Matter of Ho by analogy.
const E2_SYSTEM_PROMPT = `You are a senior US immigration attorney conducting a pre-submission review of a draft E-2 Treaty Investor visa cover letter. Catch errors and weaknesses BEFORE filing. The legal cascade: INA § 101(a)(15)(E)(ii); 8 CFR § 214.2(e); 9 FAM 402.9; USCIS Policy Manual Vol. 2 Part G; Matter of Walsh and Pollard; Matter of Ho by analogy.

You receive: (1) a Facts JSON extracted from source documents (each value carrying source_page, source_quote, confidence) and (2) the Draft cover letter.

${SHARED_REVIEW_FRAMEWORK}

## E-2 element labels — use these exactly:
- e2_treaty_country
- e2_substantial_investment
- e2_real_and_operating
- e2_more_than_marginal
- e2_develop_and_direct
- e2_source_of_funds
- general

## E-2 RFE patterns to screen (Check 4):
- Marginality: solo / home-based / no W-2 hires → near-certain RFE under 9 FAM 402.9-6(E).
- Substantial investment: proportionality not stated explicitly, or ratio thin given total cost (inverted sliding scale).
- At-risk / irrevocably committed: funds in personal account labeled "for the business" but not deployed (Walsh and Pollard failure).
- Source of funds: gaps in chain (origin → final), missing donor source-of-funds for gifts, loans secured by enterprise's own assets (9 FAM 402.9-6(C) violation), unexplained large deposits, crypto without exchange records.
- Real and operating: business plans but no evidence of operations (license, lease, transactions, customers, employees).
- Develop and direct: ownership <50% AND no documented operational control via governance.
- Treaty nationality of enterprise: cap-table not pinned to ≥50% treaty-national ownership.
- Date bracket: incorporation → EIN → bank account → wires → lease → buildout → first hire → operating start → filing — flag any out-of-order events (especially lease commencing AFTER filing, EIN issued AFTER lease signed, first payroll AFTER extension RFE).
- 2025-2026 trend: PA-2025-16 discretionary factors not addressed; 1099-only hiring plans; absentee franchise structures.

## E-2 Check 5 anchors:
- Source-of-funds gap entries in conflict_register at severity 4-5 MUST be addressed in Section VII; silent omission = critical.
- Date-bracket inversions logged at severity 3-4 should be acknowledged or corrected in the letter.
- Loan-secured-by-enterprise-assets conflict (severity 4) must be addressed under 9 FAM 402.9-6(C); silently treating such a loan as part of the substantial investment = critical.`;

// EB-1A reviewer — Authority cascade: INA § 203(b)(1)(A); 8 CFR § 204.5(h);
// Kazarian v. USCIS, 596 F.3d 1115 (9th Cir. 2010); USCIS Policy Manual Vol. 6 Part F Ch. 2.
const EB1A_SYSTEM_PROMPT = `You are a senior US immigration attorney conducting a pre-submission review of a draft EB-1A (Alien of Extraordinary Ability) I-140 petition memorandum. Catch errors and weaknesses BEFORE filing. The legal cascade: INA § 203(b)(1)(A); 8 CFR § 204.5(h); Kazarian v. USCIS, 596 F.3d 1115 (9th Cir. 2010); USCIS Policy Manual Vol. 6 Part F Ch. 2.

You receive: (1) a Facts JSON extracted from source documents (each value carrying source_page, source_quote, confidence) and (2) the Draft cover letter.

${SHARED_REVIEW_FRAMEWORK}

## EB-1A element / criterion labels — use these exactly:
- eb1a_step_one_summary (whether 3+ criteria are claimed and supported)
- eb1a_1_lesser_prizes_or_awards
- eb1a_2_membership
- eb1a_3_published_material_about
- eb1a_4_judging
- eb1a_5_original_contributions
- eb1a_6_scholarly_articles
- eb1a_7_artistic_exhibitions
- eb1a_8_leading_critical_role
- eb1a_9_high_salary
- eb1a_10_commercial_success
- eb1a_kazarian_step_two_final_merits
- eb1a_expert_letters_quality
- general

## EB-1A RFE patterns to screen (Check 4):
- Awards: "do not appear to be nationally or internationally recognized" — flag any participation/completion/internal/pay-to-play awards used as Criterion 1.
- Membership: "membership requirements have not been documented as requiring outstanding achievement judged by recognized experts" — flag pay-to-join or generic-credential memberships.
- Published material about: "discusses the field generally rather than the beneficiary specifically" — flag press releases vs editorial coverage.
- Original contributions: "the evidence does not establish major significance to the field at large" — flag patents that are FILED (not granted), or contributions claimed without adoption/citation/follow-on evidence.
- Final merits (Kazarian step 2): "even assuming the beneficiary meets three criteria, the totality does not establish sustained acclaim" — flag if the draft does not explicitly invoke the two-step framework, define the comparison cohort, or address recent (within 3 years) acclaim.
- Expert letters: templated/boilerplate phrasing across letters (e.g. "without question one of the foremost", "rare combination of brilliance and dedication"); circular letters (writer cites only what beneficiary said about the writer); AI-drafted patterns (em-dashes, triadic structures, "moreover/furthermore" overuse); over-reliance on collaborator letters with no arms-length voices.
- Citation counts: claimed totals not reconciled to Google Scholar / Web of Science; ex-self-citation not addressed when USCIS demands it; co-authorship dilution on 100+-author papers.
- High salary (Criterion 9): comparison group not appropriate (e.g., comparing to all software engineers when claim is computer-vision specialist).

## EB-1A Check 5 anchors:
- evidence_aps: any claimed criterion supported only by APS 3-5 rows (HIGH rfe_risk) and the draft argues it as a confident "yes" without hedging = weak_spots major.
- evidence_aps: APS 8-9 items in facts that the draft does not reference at all = weak_spots major (wasted strongest evidence).
- kazarian_step_two.peer_benchmarking: rows present in facts but no benchmarking paragraph or table in Section V = missing_arguments.
- kazarian_step_two.peer_benchmarking: empty in facts AND draft asserts "very top of field" without a defined comparison cohort = weak_spots major; the [WEAK: ...] flag from the drafter should be present, and if not, surface it.
- kazarian_step_two.top_of_field_evidence: items in facts but absent from Section V = missing_arguments.
- kazarian_step_two.narrative_stress_test: populated in facts but draft skips the counter-argument = missing_arguments.
- conflict_register severity 4-5 entries flagging templated/AI-drafted/circular expert letters: draft should not cite the flagged letters as primary evidence in Section IV without addressing the issue.`;

// EB-1B reviewer — Authority cascade: INA § 203(b)(1)(B); 8 CFR § 204.5(i);
// USCIS Policy Manual Vol. 6 Part F Ch. 3.
const EB1B_SYSTEM_PROMPT = `You are a senior US immigration attorney conducting a pre-submission review of a draft EB-1B (Outstanding Professor or Researcher) I-140 petition memorandum. Catch errors and weaknesses BEFORE filing. The legal cascade: INA § 203(b)(1)(B); 8 CFR § 204.5(i); USCIS Policy Manual Vol. 6 Part F Ch. 3.

You receive: (1) a Facts JSON extracted from source documents and (2) the Draft cover letter.

${SHARED_REVIEW_FRAMEWORK}

## EB-1B element / criterion labels — use these exactly:
- eb1b_petitioner_qualifying_employer
- eb1b_permanent_position
- eb1b_three_years_experience
- eb1b_step_one_summary (2+ criteria claimed and supported)
- eb1b_1_major_prizes_or_awards
- eb1b_2_membership
- eb1b_3_published_material_about
- eb1b_4_judging
- eb1b_5_original_contributions
- eb1b_6_scholarly_books_or_articles
- eb1b_expert_letters_quality
- general

## EB-1B RFE patterns to screen (Check 4):
- Permanent position: "the petitioner has not established a permanent research position" — flag visiting / postdoc / term-limited offers; flag absent tenure-track classification or board minutes / faculty handbook.
- Qualifying employer (private): if petitioner is private, did the draft document 3+ full-time researchers AND major institutional achievements?
- Three years of experience: relies on doctoral coursework rather than post-doctoral teaching/research; positions arrayed as Field<string> entries should reference exact dates and titles.
- Criteria support: USCIS uses 8 CFR 204.5(i)(3)(i) standards similar to (h)(3) — same red flags as EB-1A on awards / membership / published material / contributions / authorship / judging.
- Expert letters: same patterns as EB-1A; particular weight on arms-length senior faculty at OTHER institutions; flag if all letters come from current institution / dissertation supervisors.

## EB-1B Check 5 anchors:
- evidence_aps: same rules as EB-1A — APS 3-5 evidence argued without hedging = weak_spots major; APS 8-9 evidence ignored = weak_spots major.
- international_recognition: rows populated in facts (collaborators, talks abroad, foreign grants) but no international-recognition section in the draft = missing_arguments. International recognition is the overarching standard for EB-1B (8 CFR 204.5(i)(2)) — silent omission is a category=missing_arguments major finding.
- international_recognition.peer_benchmarking and top_of_field_evidence: same rules as EB-1A's kazarian_step_two equivalents.
- international_recognition.narrative_stress_test: populated but skipped = missing_arguments.
- A draft that argues only national (not international) recognition when international_recognition fields are mostly null = weak_spots major; the draft should surface the gap with [WEAK: ...] rather than gloss over it.`;

// EB-1C reviewer — Authority cascade: INA § 203(b)(1)(C); INA § 101(a)(44); 8 CFR § 204.5(j);
// USCIS Policy Manual Vol. 6 Part F Ch. 5.
const EB1C_SYSTEM_PROMPT = `You are a senior US immigration attorney conducting a pre-submission review of a draft EB-1C (Multinational Manager or Executive) I-140 petition memorandum. Catch errors and weaknesses BEFORE filing. The legal cascade: INA § 203(b)(1)(C); INA § 101(a)(44); 8 CFR § 204.5(j); USCIS Policy Manual Vol. 6 Part F Ch. 5.

You receive: (1) a Facts JSON extracted from source documents and (2) the Draft cover letter.

${SHARED_REVIEW_FRAMEWORK}

## EB-1C element labels — use these exactly:
- eb1c_qualifying_relationship
- eb1c_us_doing_business
- eb1c_one_year_abroad
- eb1c_foreign_managerial_executive_capacity
- eb1c_us_managerial_executive_capacity
- eb1c_functional_vs_personnel_manager
- general

## EB-1C RFE patterns to screen (Check 4):
- Qualifying relationship: not pinned to a primary-source document (audited financials, share certificates, articles, board minutes); intermediary holdcos with unclear ownership chain.
- Doing business: U.S. entity formed less than a year before filing, OR formed earlier but no evidence of regular trading (mere incorporation is not "doing business").
- One year abroad: dates do not satisfy the 1-of-3-years window; gaps for non-qualifying employment; the role abroad is described in operational terms rather than managerial/executive.
- Managerial / executive capacity (foreign or U.S. role): "the role described is not primarily managerial or executive" — flag aggregate percent_time_managerial+executive below 50%, role descriptions heavy on hands-on tasks, span_of_control too narrow (fewer than 3 levels), only contractor / 1099 reports.
- Function manager: claim made without concrete evidence the function is "essential" and managed at a senior level; failure to distinguish from personnel manager doctrine.
- Calendar gaps: 1-year-abroad window is calculated incorrectly (e.g., excluding L-1 admission window).
- 2025–2026 trend: USCIS has been particularly aggressive on EB-1C qualifying-capacity narratives; flag any role description that reads as "first-line supervisor" or where the beneficiary supervises mostly contractors.

## EB-1C Check 5 anchors:
- subordinate_tier_table side="us": if all rows are tier="non-professional" AND the draft's Section VI argues personnel-manager doctrine (rather than function-manager), this is the textbook first-line-supervisor failure under INA 101(a)(44)(A)(ii) — severity=critical, category=contradicts_facts. Cite the statute.
- subordinate_tier_table populated but no tier analysis in Section V (foreign role) or Section VI (U.S. role) = missing_arguments.
- subordinate_tier_table contains contractor / 1099 rows being argued as direct reports for managerial-capacity purposes = weak_spots major.
- conflict_register severity 4 entry "first-line supervisor problem" present in facts but draft's Section VI omits the function-manager pivot = severity=major, category=missing_arguments.
- conflict_register severity 5 entries on the qualifying-relationship element (e.g., ownership chain not pinned to primary source) MUST be addressed in Section II; silent omission = critical.`;

const SYSTEM_PROMPTS: Record<CaseType, string> = {
  E2: E2_SYSTEM_PROMPT,
  EB1A: EB1A_SYSTEM_PROMPT,
  EB1B: EB1B_SYSTEM_PROMPT,
  EB1C: EB1C_SYSTEM_PROMPT,
};

const REVIEW_FORMAT = zodOutputFormat(ReviewReportSchema);

export type ReviewerEffort = 'low' | 'medium' | 'high';

export interface ReviewResult {
  report: ReviewReport;
  usage: { input_tokens: number; output_tokens: number };
}

/**
 * Pick reviewer effort tier from case facts.
 *
 * Default 'high'. Routine E-2 cases (no severity 4-5 conflict_register
 * entries) drop to 'medium' — saves ~30-40% of output/thinking tokens
 * (~$0.05-$0.15/review) at no measured catch-rate cost when the
 * deterministic Phase-B verifier already runs. EB-1A / EB-1B / EB-1C stay
 * at 'high' because their Check 5 forensic logic (Kazarian step-2,
 * international-recognition, function-manager doctrine) is genuinely
 * deeper than the E-2 element walk.
 */
export function pickReviewerEffort(caseFacts: CaseFacts): ReviewerEffort {
  if (caseFacts.case_type !== 'E2') return 'high';
  const conflicts = caseFacts.facts.conflict_register;
  if (Array.isArray(conflicts)) {
    for (const c of conflicts) {
      const sev = c.severity?.value;
      if (typeof sev === 'number' && sev >= 4) return 'high';
    }
  }
  return 'medium';
}

export interface CheckDraftOptions {
  /** Override the auto-selected reviewer effort. */
  effort?: ReviewerEffort;
}

export async function checkDraft(
  caseFacts: CaseFacts,
  draft: string,
  verifyReport?: VerifyReport,
  options?: CheckDraftOptions,
): Promise<ReviewResult> {
  const effort: ReviewerEffort = options?.effort ?? pickReviewerEffort(caseFacts);
  // Facts JSON lives in the system array (not the user message) so it sits
  // on its own cache breakpoint, byte-identical to draft/cover-letter.ts.
  // The 5m TTL matches the typical draft→review chain horizon.
  const factsJson = JSON.stringify(caseFacts.facts, null, 2);
  const factsBlock = `## Extracted facts (each value carries source_page, source_quote, confidence)\n\n\`\`\`json\n${factsJson}\n\`\`\``;

  // Phase-2: deterministic E-2 gates run before the LLM and are folded
  // into the system context as a dedicated cached block (1h TTL — gate
  // outcomes are stable for the matter as long as the facts JSON is).
  // For non-E-2 case types this is a no-op.
  const gateBlock =
    caseFacts.case_type === 'E2'
      ? renderGateBlock(runE2DeterministicGates(caseFacts.facts))
      : null;

  // Verify Phase B (deterministic regex + per-case-type allowlist) runs
  // before this call. If a report is present, append it to the user prompt
  // so the reviewer focuses on flagged spans rather than re-deriving the
  // same checks.
  const verifySection = verifyReport ? `\n\n${reportToReviewerPrompt(verifyReport)}` : '';

  const systemBlocks: Array<{
    type: 'text';
    text: string;
    cache_control?: { type: 'ephemeral'; ttl: '1h' | '5m' };
  }> = [
    {
      type: 'text',
      text: SYSTEM_PROMPTS[caseFacts.case_type],
      cache_control: { type: 'ephemeral', ttl: '1h' },
    },
  ];
  if (gateBlock) {
    systemBlocks.push({
      type: 'text',
      text: gateBlock,
      cache_control: { type: 'ephemeral', ttl: '1h' },
    });
  }
  systemBlocks.push({
    type: 'text',
    text: factsBlock,
    cache_control: { type: 'ephemeral', ttl: '5m' },
  });

  // No `thinking` here: the reviewer is structured-output-shaped
  // (ReviewReportSchema enumerates the failure modes) and Phase B already
  // catches the citation-allowlist class. Adaptive thinking was ~60-120 s
  // TTFT and ~$0.10/case for no measured catch-rate gain.
  const response = await getAnthropic().messages.parse({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    output_config: {
      effort,
      format: REVIEW_FORMAT,
    },
    system: systemBlocks,
    messages: [
      {
        role: 'user',
        content: `Review this ${caseFacts.case_type} cover letter draft against the source facts in the system context.\n\n## Draft cover letter\n\n${draft}${verifySection}`,
      },
    ],
  });

  if (!response.parsed_output) {
    throw new Error('Reviewer response did not match the review report schema');
  }

  logAnthropicUsage({
    stage: 'review',
    model: 'claude-sonnet-4-6',
    case_type: caseFacts.case_type,
    usage: response.usage,
  });

  return {
    report: response.parsed_output,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}

/* ====================================================================== */
/* Deterministic E-2 gates — Phase-0.7 cross-case-synthesis additions     */
/* ---------------------------------------------------------------------- */
/* Pure / deterministic over CaseFacts.facts. Each gate is null-safe:     */
/* missing inputs return either `data_incomplete` (warning, no fire) or   */
/* `not_applicable` rather than crashing. Authority + severity per the    */
/* _CROSS-CASE-SYNTHESIS-2026-04-29.md § 6 table. Empirical reference     */
/* cases: Flatturbo (denial — ownership_volatility, fund circularity,     */
/* unaccounted SOF), Cemre (multi-round RFE escalation, classification).  */
/* ====================================================================== */

export type GateOutcome =
  | { fired: true; severity: 4 | 5; finding: string; authority: string }
  | { fired: false; reason: 'not_applicable' | 'data_incomplete'; note?: string };

export type GateName =
  | 'ownership_volatility'
  | 'co_petitioner_fund_circularity'
  | 'unaccounted_sof_share'
  | 'multi_round_rfe_escalation'
  | 'b2_status_violation_signal'
  | 'status_gap_pre_filing'
  | 'material_change_in_response_to_uscis'
  | 'external_evidence_contradiction_risk'
  | 'develop_and_direct_role_authority_thin'
  | 'five_year_horizon_marginal_failure';

export type GateFn = (facts: E2Facts) => GateOutcome;

function normName(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * `ownership_volatility` — severity 4. Fires when ownership_history shows
 * ≥2 distinct owner-set transitions within 365 days before
 * filed_date_i129. Null inputs → don't fire.
 *
 * Authority: 9 FAM 402.9-7(1) (develop-and-direct).
 * Empirical anchor: Flatturbo (denied) — petitioner ownership flipped 3×
 * in the 12 months pre-filing, undermining the develop-and-direct claim.
 */
export const ownershipVolatilityGate: GateFn = (facts) => {
  const history = facts.ownership_history;
  const filedRaw = facts.filed_date_i129?.value ?? null;
  const filed = parseDate(filedRaw);
  if (!history || history.length === 0 || !filed) {
    return { fired: false, reason: 'data_incomplete' };
  }
  const windowStart = new Date(filed.getTime() - 365 * 86_400_000);

  // Sort by effective_date ascending; collect distinct owner-set transitions
  // that fall within (windowStart, filed].
  const sorted = [...history]
    .map((h) => {
      const date = parseDate(h.effective_date?.value ?? null);
      const owners = (h.owner_names ?? [])
        .map((o) => normName(o?.value ?? null))
        .filter(Boolean)
        .sort()
        .join('|');
      return { date, owners };
    })
    .filter((h) => h.date && h.owners)
    .sort((a, b) => (a.date!.getTime() - b.date!.getTime()));

  let transitions = 0;
  let prevOwners: string | null = null;
  for (const h of sorted) {
    if (prevOwners !== null && h.owners !== prevOwners) {
      const t = h.date!.getTime();
      if (t > windowStart.getTime() && t <= filed.getTime()) {
        transitions += 1;
      }
    }
    prevOwners = h.owners;
  }

  if (transitions >= 2) {
    return {
      fired: true,
      severity: 4,
      finding: `Ownership changed ${transitions} times within 365 days before filing — the develop-and-direct narrative is at risk.`,
      authority: '9 FAM 402.9-7(1)',
    };
  }
  return { fired: false, reason: 'not_applicable' };
};

/**
 * `co_petitioner_fund_circularity` — severity 5. Fires when any
 * source_of_funds entry references a person whose full_name exactly
 * matches a matter.co_petitioners[].full_name.
 *
 * Authority: 9 FAM 402.9-6(B) (at-risk).
 * Empirical anchor: Flatturbo — Tarlaci loan with Tarlaci as co-petitioner.
 */
export const coPetitionerFundCircularityGate: GateFn = (facts) => {
  const coPet = facts.matter?.co_petitioners;
  const sof = facts.source_of_funds;
  if (!coPet || coPet.length === 0 || !sof || sof.length === 0) {
    return { fired: false, reason: 'data_incomplete' };
  }
  const coNames = new Set(
    coPet
      .map((c) => normName(c.full_name?.value ?? null))
      .filter(Boolean),
  );
  if (coNames.size === 0) {
    return { fired: false, reason: 'data_incomplete' };
  }
  const hits: string[] = [];
  for (const chain of sof) {
    const sourceName = normName(chain.source_person?.full_name?.value ?? null);
    if (sourceName && coNames.has(sourceName)) hits.push(sourceName);
  }
  if (hits.length > 0) {
    return {
      fired: true,
      severity: 5,
      finding: `Source-of-funds chain references co-petitioner(s): ${hits.join(', ')}. Funds are not at-risk if recycled within the petition.`,
      authority: '9 FAM 402.9-6(B)',
    };
  }
  return { fired: false, reason: 'not_applicable' };
};

/**
 * `unaccounted_sof_share` — severity 5. Fires when the claimed
 * investment is more than 1.5× the documented SOF total. Null sides →
 * `data_incomplete` warning, not a fire.
 *
 * Authority: 9 FAM 402.9-6(C) (substantiality / lawful source).
 * Empirical anchor: Flatturbo — claimed ≈ 10× documented.
 */
export const unaccountedSofShareGate: GateFn = (facts) => {
  const claimed = facts.investment.claimed_amount_usd?.value ?? null;
  const sof = facts.source_of_funds;
  if (typeof claimed !== 'number' || !sof || sof.length === 0) {
    return { fired: false, reason: 'data_incomplete', note: 'claimed_amount_usd or source_of_funds missing' };
  }
  let documented = 0;
  let anyDocumented = false;
  for (const chain of sof) {
    const v = chain.documented_amount_usd?.value;
    if (typeof v === 'number') {
      documented += v;
      anyDocumented = true;
    }
  }
  if (!anyDocumented) {
    return { fired: false, reason: 'data_incomplete', note: 'no documented_amount_usd populated on any SOF chain' };
  }
  if (claimed > 1.5 * documented) {
    return {
      fired: true,
      severity: 5,
      finding: `Claimed investment USD ${claimed.toFixed(2)} exceeds 1.5× documented SOF total USD ${documented.toFixed(2)}.`,
      authority: '9 FAM 402.9-6(C)',
    };
  }
  return { fired: false, reason: 'not_applicable' };
};

/**
 * `multi_round_rfe_escalation` — severity 5. Fires when rfes.length ≥ 2
 * AND the last RFE is on a substantive E-2 element (bona-fide
 * enterprise / marginality / substantial investment). Procedural
 * follow-ups don't trip the gate.
 *
 * Authority: E-2 manual § 12.5 (multi-round RFE escalation).
 * Empirical anchor: B&B International (RFE-1 procedural, RFE-2 E3+E4
 * substantive).
 */
const SUBSTANTIVE_RFE_SUBJECTS: ReadonlySet<string> = new Set([
  'bona_fide_enterprise',
  'marginality',
  'substantial_investment',
]);

export const multiRoundRfeEscalationGate: GateFn = (facts) => {
  const rfes = facts.rfes;
  if (!rfes || rfes.length < 2) {
    return { fired: false, reason: 'not_applicable' };
  }
  const last = rfes[rfes.length - 1];
  const subj = last.subject_category?.value ?? null;
  if (!subj) return { fired: false, reason: 'data_incomplete' };
  if (SUBSTANTIVE_RFE_SUBJECTS.has(subj)) {
    return {
      fired: true,
      severity: 5,
      finding: `Multi-round RFE escalation: ${rfes.length} RFEs, latest on substantive subject "${subj}". Escalate to senior attorney before drafting response.`,
      authority: 'manual § 12.5',
    };
  }
  return { fired: false, reason: 'not_applicable' };
};

/* ---------------------------------------------------------------------- */
/* Phase-2 gates — derived from Flatturbo NOID + Final Denial OCR        */
/* (per _CROSS-CASE-SYNTHESIS-2026-04-29.md § 9.1 ADDENDUM).             */
/* ---------------------------------------------------------------------- */

const B2_LIKE_STATUSES: ReadonlySet<string> = new Set([
  'b-2',
  'b2',
  'b-1',
  'b1',
  'b-1/b-2',
  'b1/b2',
  'esta',
  'vwp',
  'visa waiver',
]);

function normStatus(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

/**
 * `b2_status_violation_signal` — severity 5. Fires when the principal
 * is on B-2 / B-1 / ESTA AND the case theory claims the enterprise was
 * fully operational either before E-2 work authorization issued OR
 * before the I-129 filing. Pre-authorization day-to-day operations on
 * a B visitor visa = unauthorized employment per 9 FAM 402.9-7.
 *
 * Authority: INA § 101(a)(15)(B); 9 FAM 402.9-7.
 * Empirical anchor: Flatturbo (Beksac) — B-2 from 2022-09 to 2023-03,
 * theory required ops since 2022-08-19, USCIS framed as unauthorized
 * employment in the Final Denial.
 */
export const b2StatusViolationSignalGate: GateFn = (facts) => {
  const status = normStatus(facts.investor.current_status?.value ?? null);
  if (!status) return { fired: false, reason: 'data_incomplete' };
  if (!B2_LIKE_STATUSES.has(status)) return { fired: false, reason: 'not_applicable' };

  const opsSince = parseDate(facts.enterprise.fully_operational_since_date?.value ?? null);
  if (!opsSince) return { fired: false, reason: 'data_incomplete' };

  const workAuth = parseDate(facts.investor.work_authorization_date?.value ?? null);
  const filed = parseDate(facts.filed_date_i129?.value ?? null);
  if (!workAuth && !filed) return { fired: false, reason: 'data_incomplete' };

  if (workAuth && opsSince.getTime() < workAuth.getTime()) {
    return {
      fired: true,
      severity: 5,
      finding: `Principal on ${status.toUpperCase()} but case theory asserts operations since ${facts.enterprise.fully_operational_since_date?.value} — predates E-2 work authorization ${facts.investor.work_authorization_date?.value}. USCIS reads pre-authorization day-to-day operations as unauthorized employment.`,
      authority: 'INA § 101(a)(15)(B); 9 FAM 402.9-7',
    };
  }
  if (filed && opsSince.getTime() < filed.getTime()) {
    return {
      fired: true,
      severity: 5,
      finding: `Principal on ${status.toUpperCase()} but case theory asserts operations since ${facts.enterprise.fully_operational_since_date?.value} — predates I-129 filing ${facts.filed_date_i129?.value}. Pre-filing day-to-day operations on a B visa = unauthorized employment.`,
      authority: 'INA § 101(a)(15)(B); 9 FAM 402.9-7',
    };
  }
  return { fired: false, reason: 'not_applicable' };
};

/**
 * `status_gap_pre_filing` — severity 5. Fires when the principal's
 * prior status expired before the I-129 was filed (out of status at
 * filing, no extraordinary-circumstances showing).
 *
 * Authority: 8 CFR § 248.1(b).
 * Empirical anchor: Flatturbo — B-2 expired 2023-03-22, I-129 filed
 * 2023-09-22 (≈6-month gap).
 */
export const statusGapPreFilingGate: GateFn = (facts) => {
  const priorExp = parseDate(facts.investor.prior_status_expiration_date?.value ?? null);
  const filed = parseDate(facts.filed_date_i129?.value ?? null);
  if (!priorExp || !filed) return { fired: false, reason: 'data_incomplete' };
  const gapMs = filed.getTime() - priorExp.getTime();
  if (gapMs <= 0) return { fired: false, reason: 'not_applicable' };
  const days = Math.round(gapMs / 86_400_000);
  return {
    fired: true,
    severity: 5,
    finding: `Principal out of status at filing: prior status expired ${facts.investor.prior_status_expiration_date?.value}, I-129 filed ${facts.filed_date_i129?.value} (${days}-day gap). Requires consular pivot or 8 CFR § 248.1(b) extraordinary-circumstances showing.`,
    authority: '8 CFR § 248.1(b)',
  };
};

/**
 * `material_change_in_response_to_uscis` — severity 5. Fires when any
 * RFE/NOID entry has both initial_filing_assertion and response_assertion
 * populated and they differ on a material point (date / ownership /
 * activity timeline / operational status). Matter of Izummi: the case
 * is fatal once a material change appears in response to USCIS pressure.
 *
 * Authority: Matter of Izummi, 22 I&N Dec. 169 (Assoc. Comm'r 1998).
 * Empirical anchor: Flatturbo — RFE response said "operational since
 * 2022-08-19", ITD response said "did not engage in business activities
 * until 2023".
 */
export const materialChangeInResponseToUscisGate: GateFn = (facts) => {
  const rfes = facts.rfes;
  if (!rfes || rfes.length === 0) return { fired: false, reason: 'data_incomplete' };
  const mismatches: string[] = [];
  for (const r of rfes) {
    const init = (r.initial_filing_assertion?.value ?? '').trim();
    const resp = (r.response_assertion?.value ?? '').trim();
    if (init && resp && init !== resp) {
      mismatches.push(`"${init}" → "${resp}" (RFE ${r.rfe_date?.value ?? '?'})`);
    }
  }
  if (mismatches.length === 0) {
    const anyPopulated = rfes.some(
      (r) => r.initial_filing_assertion?.value || r.response_assertion?.value,
    );
    return anyPopulated
      ? { fired: false, reason: 'not_applicable' }
      : { fired: false, reason: 'data_incomplete' };
  }
  return {
    fired: true,
    severity: 5,
    finding: `Material change in response to USCIS detected: ${mismatches.join('; ')}. Matter of Izummi forecloses curing a deficient initial filing via post-hoc revision.`,
    authority: 'Matter of Izummi, 22 I&N Dec. 169',
  };
};

/**
 * Async variant of `materialChangeInResponseToUscisGate`. Same fast-path
 * (string equality first), but on differing strings calls the LLM
 * comparator. Gate fires only when comparator returns `same: false` with
 * `confidence >= 0.7`. A confidence below the threshold is treated as
 * "ambiguous" and the gate stays silent (better to under-fire than to
 * raise a severity-5 finding on a paraphrase the LLM was unsure about —
 * the LLM reviewer will catch genuine contradictions in qualitative
 * analysis anyway).
 *
 * Authority + empirical anchor: see the sync variant above.
 */
export const MATERIAL_CHANGE_COMPARATOR_THRESHOLD = 0.7;

export async function materialChangeInResponseToUscisGateAsync(
  facts: E2Facts,
  comparator: AssertionComparator,
): Promise<GateOutcome> {
  const rfes = facts.rfes;
  if (!rfes || rfes.length === 0) return { fired: false, reason: 'data_incomplete' };
  const mismatches: string[] = [];
  let anyPopulated = false;
  for (const r of rfes) {
    const init = (r.initial_filing_assertion?.value ?? '').trim();
    const resp = (r.response_assertion?.value ?? '').trim();
    if (init || resp) anyPopulated = true;
    if (!init || !resp) continue;
    if (init === resp) continue;
    // String differs — ask the LLM whether the underlying fact differs.
    const judgment = await comparator(init, resp);
    if (!judgment.same && judgment.confidence >= MATERIAL_CHANGE_COMPARATOR_THRESHOLD) {
      mismatches.push(
        `"${init}" → "${resp}" (RFE ${r.rfe_date?.value ?? '?'}; comparator confidence ${judgment.confidence.toFixed(2)})`,
      );
    }
  }
  if (mismatches.length === 0) {
    return anyPopulated
      ? { fired: false, reason: 'not_applicable' }
      : { fired: false, reason: 'data_incomplete' };
  }
  return {
    fired: true,
    severity: 5,
    finding: `Material change in response to USCIS detected: ${mismatches.join('; ')}. Matter of Izummi forecloses curing a deficient initial filing via post-hoc revision.`,
    authority: 'Matter of Izummi, 22 I&N Dec. 169',
  };
}

/**
 * `external_evidence_contradiction_risk` — severity 4. Pre-filing
 * reviewer hint: when claimed_business_model differs from
 * observed_business_model (manual external check or Yelp/Google/BBB
 * pull), surface the contradiction risk before USCIS independently
 * fact-finds it. observed null → downgrade to data_incomplete.
 *
 * Authority: firm policy (no statutory anchor).
 * Empirical anchor: Flatturbo — petitioner claimed e-commerce only;
 * USCIS pulled 3 Yelp reviews showing automotive repair services.
 */
export const externalEvidenceContradictionRiskGate: GateFn = (facts) => {
  const claimed = (facts.enterprise.claimed_business_model?.value ?? '').trim();
  const automated = (facts.enterprise.observed_business_model?.value ?? '').trim();
  const manual = (
    facts.enterprise.observed_business_model_manual_input?.value ?? ''
  ).trim();
  // Phase-6: prefer the manual attorney-typed input when present (the
  // automated puller is out of scope; the typed-aggregate hook surfaces
  // observed_business_model_manual_input via aggregateTypedMemoryToE2's
  // options.observedBusinessModelManualInput).
  const observed = manual || automated;
  const sourceLabel = manual ? 'attorney manual input' : 'externally observed';
  if (!claimed) return { fired: false, reason: 'data_incomplete' };
  if (!observed) {
    return {
      fired: false,
      reason: 'data_incomplete',
      note: 'observed_business_model not populated — run external check (Yelp / Google / BBB / Wayback) or attorney-type observed_business_model_manual_input before filing',
    };
  }
  if (normName(claimed) === normName(observed)) {
    return { fired: false, reason: 'not_applicable' };
  }
  return {
    fired: true,
    severity: 4,
    finding: `Claimed business model "${claimed}" differs from ${sourceLabel} "${observed}". USCIS routinely pulls Yelp/Google/BBB; surface the discrepancy pre-filing rather than be fact-found.`,
    authority: 'firm policy',
  };
};

/* ---------------------------------------------------------------------- */
/* Phase-8 gates — Phase-7 cover-letter narrative-claim consumers.        */
/* ---------------------------------------------------------------------- */

const OPERATIONAL_AUTHORITY_SCOPES: ReadonlySet<string> = new Set([
  'contract_signing',
  'banking_authority',
  'day_to_day_operations',
]);

/**
 * `develop_and_direct_role_authority_thin` — severity 4. Fires when the
 * cover letter surfaces a develop-and-direct role grant whose
 * `authority_scope` does NOT include any of `contract_signing`,
 * `banking_authority`, or `day_to_day_operations`. A title-only grant
 * (e.g. member resolution naming the Beneficiary "President" without
 * enumerating operational authority) is the textbook E5 vulnerability —
 * USCIS reads it as ceremonial.
 *
 * Authority: 9 FAM 402.9-7(1) (develop-and-direct).
 */
export const developAndDirectRoleAuthorityThinGate: GateFn = (facts) => {
  const grant = facts.cover_letter_phase7?.develop_and_direct_role_grant;
  if (!grant) return { fired: false, reason: 'data_incomplete' };
  const scope = grant.authority_scope ?? [];
  const hasOperational = scope.some((s) => OPERATIONAL_AUTHORITY_SCOPES.has(s));
  if (hasOperational) return { fired: false, reason: 'not_applicable' };
  return {
    fired: true,
    severity: 4,
    finding: `Develop-and-direct role grant ("${grant.role_title}" per ${grant.granting_document_ref}) lacks operational authority. Granted scope: [${
      scope.length > 0 ? scope.join(', ') : 'none enumerated'
    }]. USCIS reads title-only authority as ceremonial.`,
    authority: '9 FAM 402.9-7(1) develop-and-direct',
  };
};

/**
 * `five_year_horizon_marginal_failure` — severity 4. Fires when the
 * cover letter's five-year business horizon caps year-5 employment at
 * the Beneficiary alone (`year_5_employee_count <= 1`). Walsh & Pollard
 * requires more-than-Beneficiary employment irrespective of revenue —
 * a profitable solo enterprise still trips marginality.
 *
 * Authority: 9 FAM 402.9-6(E); Matter of Walsh and Pollard, 20 I&N Dec.
 * 60 (BIA 1988).
 */
export const fiveYearHorizonMarginalFailureGate: GateFn = (facts) => {
  const horizon = facts.cover_letter_phase7?.five_year_horizon;
  if (!horizon) return { fired: false, reason: 'data_incomplete' };
  const count = horizon.year_5_employee_count;
  if (count == null) return { fired: false, reason: 'data_incomplete' };
  if (count > 1) return { fired: false, reason: 'not_applicable' };
  return {
    fired: true,
    severity: 4,
    finding: `Five-year business horizon projects ${count} year-5 employee(s) — at or below Beneficiary-only employment. Walsh & Pollard requires more-than-Beneficiary employment regardless of revenue level.`,
    authority: '9 FAM 402.9-6(E); Matter of Walsh and Pollard',
  };
};

/**
 * Gate registry. The pre-filing reviewer fans these out and folds the
 * fired outcomes into the LLM reviewer's input (or surfaces them
 * directly on the matter dashboard). Each entry is a `(name, fn)` pair
 * matching the runFxValidationGate / runPassportValidityGate pattern in
 * ingest/typed-aggregate.ts — pure, exported, individually testable.
 */
export const E2_DETERMINISTIC_GATES: ReadonlyArray<{ name: GateName; fn: GateFn }> = [
  { name: 'ownership_volatility', fn: ownershipVolatilityGate },
  { name: 'co_petitioner_fund_circularity', fn: coPetitionerFundCircularityGate },
  { name: 'unaccounted_sof_share', fn: unaccountedSofShareGate },
  { name: 'multi_round_rfe_escalation', fn: multiRoundRfeEscalationGate },
  { name: 'b2_status_violation_signal', fn: b2StatusViolationSignalGate },
  { name: 'status_gap_pre_filing', fn: statusGapPreFilingGate },
  { name: 'material_change_in_response_to_uscis', fn: materialChangeInResponseToUscisGate },
  { name: 'external_evidence_contradiction_risk', fn: externalEvidenceContradictionRiskGate },
  { name: 'develop_and_direct_role_authority_thin', fn: developAndDirectRoleAuthorityThinGate },
  { name: 'five_year_horizon_marginal_failure', fn: fiveYearHorizonMarginalFailureGate },
];

export interface GateRunResult {
  name: GateName;
  outcome: GateOutcome;
}

/** Run every E-2 deterministic gate and return all outcomes. */
export function runE2DeterministicGates(facts: E2Facts): GateRunResult[] {
  return E2_DETERMINISTIC_GATES.map(({ name, fn }) => ({ name, outcome: fn(facts) }));
}

/**
 * Async variant: same as runE2DeterministicGates, but routes the
 * `material_change_in_response_to_uscis` gate through the LLM comparator
 * so paraphrases ("operational since August 2022" vs "began operations
 * 2022-08-19") don't false-positive. All other gates run synchronously
 * — the comparator is the only one that needs the async path.
 */
export async function runE2DeterministicGatesAsync(
  facts: E2Facts,
  comparator: AssertionComparator,
): Promise<GateRunResult[]> {
  const out: GateRunResult[] = [];
  for (const { name, fn } of E2_DETERMINISTIC_GATES) {
    if (name === 'material_change_in_response_to_uscis') {
      out.push({
        name,
        outcome: await materialChangeInResponseToUscisGateAsync(facts, comparator),
      });
    } else {
      out.push({ name, outcome: fn(facts) });
    }
  }
  return out;
}

/**
 * Render the deterministic-gate findings as a Markdown system block for
 * the LLM reviewer. Every gate appears in the table (fired or not) so
 * the LLM can see the full coverage; fired severity-5 entries are
 * additionally highlighted in the trailing instruction paragraph. The
 * layout matches the Phase-2 spec in REFACTOR-NOTES-2026-04-29.md.
 */
export function renderGateBlock(results: GateRunResult[]): string {
  const rows: string[] = [];
  for (const { name, outcome } of results) {
    if (outcome.fired) {
      rows.push(
        `| ${name} | ${outcome.severity} | fired | ${outcome.finding.replace(/\n/g, ' ')} |`,
      );
    } else {
      const note = outcome.reason === 'data_incomplete' ? outcome.note ?? 'inputs missing' : '';
      rows.push(`| ${name} | — | ${outcome.reason} | ${note} |`);
    }
  }
  return [
    '## Deterministic gate findings (run by checker before LLM review)',
    '',
    'The following deterministic gates were evaluated against the extracted facts.',
    'Severity legend: 5 = case-fatal; 4 = high RFE risk; 3 = moderate; 2 = minor; 1 = informational.',
    '',
    '| Gate | Severity | Status | Finding |',
    '|---|---|---|---|',
    ...rows,
    '',
    "The LLM reviewer's job is to: (a) accept the deterministic findings as authoritative; (b) add qualitative risk analysis the gates cannot detect (narrative coherence, voice consistency, defensive paragraph adequacy, exhibit citation compliance); (c) NEVER override a fired severity-5 gate without an explicit attorney note attached to the case facts. Reference fired gates by name in the relevant `weak_spots` / `inconsistencies` entries so the human reviewer can cross-walk this layer.",
  ].join('\n');
}

export interface FullReviewResult {
  deterministic: GateRunResult[];
  llm: ReviewResult;
}

export interface RunFullReviewOptions extends CheckDraftOptions {
  /**
   * Override the assertion comparator used by the
   * `material_change_in_response_to_uscis` gate. Defaults to a fresh
   * Haiku-backed comparator per call (cache is per-call). Tests pass a
   * mock implementation. Set to `null` to skip the comparator entirely
   * and fall back to string-equality (the legacy Phase-2 behavior).
   */
  comparator?: AssertionComparator | null;
}

/**
 * Phase-2 orchestrator. Runs deterministic E-2 gates, then calls the
 * LLM reviewer (which itself injects the same gate outcomes into its
 * system context via checkDraft). Returns both layers so callers can
 * surface the gate outcomes on the dashboard independently of the LLM
 * narrative. For non-E-2 case types `deterministic` is an empty array.
 *
 * Phase-5: routes the `material_change_in_response_to_uscis` gate
 * through an LLM comparator so paraphrased same-fact assertions don't
 * false-positive. Pass `comparator: null` to opt out.
 */
export async function runFullReview(
  caseFacts: CaseFacts,
  draft: string,
  verifyReport?: VerifyReport,
  options?: RunFullReviewOptions,
): Promise<FullReviewResult> {
  let deterministic: GateRunResult[] = [];
  if (caseFacts.case_type === 'E2') {
    if (options?.comparator === null) {
      deterministic = runE2DeterministicGates(caseFacts.facts);
    } else {
      const comparator = options?.comparator ?? createAssertionComparator();
      deterministic = await runE2DeterministicGatesAsync(caseFacts.facts, comparator);
    }
  }
  const llm = await checkDraft(caseFacts, draft, verifyReport, options);
  return { deterministic, llm };
}
