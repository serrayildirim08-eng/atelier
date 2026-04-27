import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import type { CaseFacts, CaseType } from '@/ingest/schema';
import { ReviewReportSchema, type ReviewReport } from './schema';
import type { VerifyReport } from '@/lib/verify';
import { reportToReviewerPrompt } from '@/lib/verify';

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

export interface ReviewResult {
  report: ReviewReport;
  usage: { input_tokens: number; output_tokens: number };
}

export async function checkDraft(
  caseFacts: CaseFacts,
  draft: string,
  verifyReport?: VerifyReport,
): Promise<ReviewResult> {
  const factsJson = JSON.stringify(caseFacts.facts, null, 2);
  // Verify Phase B (deterministic regex + per-case-type allowlist) runs
  // before this call. If a report is present, append it to the user prompt
  // so the reviewer focuses on flagged spans rather than re-deriving the
  // same checks. The system prompt remains cacheable (verify lives only in
  // the user message, which is per-request anyway).
  const verifySection = verifyReport ? `\n\n${reportToReviewerPrompt(verifyReport)}` : '';

  // No `thinking` here: the reviewer is structured-output-shaped
  // (ReviewReportSchema enumerates the failure modes) and Phase B already
  // catches the citation-allowlist class. Adaptive thinking was ~60-120 s
  // TTFT and ~$0.10/case for no measured catch-rate gain.
  const response = await getAnthropic().messages.parse({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    output_config: {
      effort: 'high',
      format: REVIEW_FORMAT,
    },
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPTS[caseFacts.case_type],
        cache_control: { type: 'ephemeral', ttl: '1h' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Review this ${caseFacts.case_type} cover letter draft against the source facts.\n\n## Facts (each value carries source_page, source_quote, confidence)\n\n\`\`\`json\n${factsJson}\n\`\`\`\n\n## Draft cover letter\n\n${draft}${verifySection}`,
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
