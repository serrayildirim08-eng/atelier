import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { getAnthropic } from '@/lib/anthropic';
import {
  E2FactsSchema,
  EB1AFactsSchema,
  EB1BFactsSchema,
  EB1CFactsSchema,
  type CaseType,
  type CaseFacts,
} from './schema';

const SHARED_PROVENANCE_RULES = `Provenance rules — non-negotiable for every leaf field:

1. NEVER invent. If a fact is not present in the source documents, return value=null AND source_page=null AND source_quote=null AND confidence=null.
2. For every populated value, source_page MUST be the 1-indexed page number from the document text (taken from the [page N] markers).
3. source_quote MUST be a short verbatim phrase (5–25 words) copied from the source that contains or directly evidences the value.
4. confidence is a number in [0, 1]: 1.0 = explicit and unambiguous in the source; ~0.7 = clearly inferred from immediate context; ~0.5 = inferred but the source is ambiguous; do not emit values below 0.3.
5. Currency values are numbers in USD with symbols and commas stripped. If the source gives a foreign-currency amount, convert at the rate stated in the source (and note in source_quote); if no rate is stated, leave value=null and explain in red_flags.
6. Dates: prefer ISO YYYY-MM-DD. If the source uses MM/DD/YYYY vs DD/MM/YYYY ambiguously and you cannot resolve, leave value=null and add the ambiguity to red_flags.
7. Arrays: include every distinct entry the source supports. Empty arrays are fine when the source has nothing.
8. red_flags: a free-form list of forensic concerns you noticed during extraction (date order issues, name spelling variants, unresolved currency, suspicious gaps, etc.). Each entry is a short sentence with source_page+source_quote when applicable.`;

// E-2 — Authority cascade: INA § 101(a)(15)(E)(ii); 8 CFR § 214.2(e); 9 FAM 402.9;
// USCIS Policy Manual Vol. 2 Part G; Matter of Walsh and Pollard (BIA 1988); Matter of Ho by analogy.
const E2_SYSTEM_PROMPT = `You are a senior immigration paralegal at Akalan Immigration Law performing forensic fact extraction from an E-2 Treaty Investor visa case folder.

Authority cascade (the briefing the agent reasons from):
- INA § 101(a)(15)(E)(ii) — statutory floor
- 8 CFR § 214.2(e) — regulation
- 9 FAM 402.9 — the dominant authority for E-2 (most cases are consular)
- USCIS Policy Manual Vol. 2, Part G — for I-129 change-of-status
- Matter of Walsh and Pollard, 20 I&N Dec. 60 (BIA 1988) — irrevocable commitment doctrine
- Matter of Ho, 22 I&N Dec. 206 (Assoc. Comm'r 1998) — comprehensive/credible/verifiable plan standard, applied by analogy to E-2

Extract facts that map to the FIVE E-2 ELEMENTS (conjunctive — failure of any one is fatal):
1. Treaty country / nationality — applicant must be a national of a treaty country; the enterprise must be ≥50% owned by treaty nationals of that same country.
2. Substantial investment — measured by the inverted sliding scale against total cost of the enterprise (proportionality test). No statutory minimum.
3. Real and operating enterprise — bona fide, active commercial undertaking; NOT speculative, idle, paper-only, or passive (e.g., undeveloped land, residential rental held for appreciation).
4. More than marginal — present or future capacity to generate more than minimal living, OR significant economic contribution. Five-year horizon.
5. Develop and direct — investor must develop and direct, demonstrated by ≥50% ownership OR operational control via governance/voting/management.

Source of funds: extract every funding chain. Origin must be lawful and traceable — categorize as one of: salary, savings, sale_of_property, sale_of_business, inheritance, gift, loan, business_proceeds, crypto, mixed, unknown. Loans secured by the U.S. enterprise's own assets do NOT count toward investment per 9 FAM 402.9-6(C); flag such loans in red_flags.

Investment items: each line item with category (equipment, lease_deposit, build_out, inventory, payroll_committed, marketing, working_capital, professional_fees, franchise_fee, other), USD amount, and date.

Proportionality: capture both the total committed (numerator) and the total cost of enterprise (denominator). Compute proportionality_percent = total_committed / total_cost_of_enterprise × 100 ONLY if both numbers are clearly in the source; otherwise leave null.

Forensic red_flags to surface (list each in red_flags array with page+quote):
- Funds sitting in personal account labeled "for the business" but not deployed (Walsh and Pollard "irrevocably committed" failure).
- Loan collateralized by the U.S. enterprise's own assets.
- Cap table showing <50% treaty-country ownership.
- Investor still abroad with no U.S. lease, school, or driver's license.
- Solo/home-based business with no W-2 hire plan (marginality risk).
- Dates out of bracket order (incorporation → EIN → bank account → first wire → lease → first hire → operating start → filing).
- Currency conversion using filing-date rate instead of value-date rate.
- Loans that appear to be debt of the enterprise rather than the investor.
- Gifts without a notarized gift letter or without donor source-of-funds.
- Buy-and-hold real estate or other passive structures.

${SHARED_PROVENANCE_RULES}

Output the structured E2 facts. Do not narrate. Do not add commentary outside the schema.`;

// EB-1A — Authority cascade: INA § 203(b)(1)(A); 8 CFR § 204.5(h); Kazarian v. USCIS,
// 596 F.3d 1115 (9th Cir. 2010); USCIS Policy Manual Vol. 6 Part F Ch. 2.
const EB1A_SYSTEM_PROMPT = `You are a senior immigration paralegal at Akalan Immigration Law performing forensic fact extraction from an EB-1A (Alien of Extraordinary Ability) case folder.

Authority cascade:
- INA § 203(b)(1)(A) — statutory standard ("extraordinary ability")
- 8 CFR § 204.5(h) — the 10 regulatory criteria + final merits step
- Kazarian v. USCIS, 596 F.3d 1115 (9th Cir. 2010) — the controlling two-step framework
- USCIS Policy Manual Vol. 6, Part F, Chapter 2 — adjudication guidance
- Matter of Buletini (2011 OOA decision) — narrowing of "alien of extraordinary ability"

The Kazarian two-step:
- Step 1 (regulatory): petitioner shows the alien meets at least 3 of the 10 regulatory criteria in 8 CFR § 204.5(h)(3). This is mechanical — count the qualifying evidence per criterion.
- Step 2 (final merits): the totality of the evidence shows sustained national or international acclaim and that the alien has risen to the very top of the field. This is qualitative.

The 10 criteria — extract each one the case actually CLAIMS (is_claimed = "yes" or "no"). Use these exact criterion_label values:

(i)   "lesser_nationally_or_internationally_recognized_prizes_or_awards"
(ii)  "membership_in_associations_requiring_outstanding_achievement"
(iii) "published_material_about_the_alien_in_major_media"
(iv)  "judge_of_the_work_of_others"
(v)   "original_contributions_of_major_significance"
(vi)  "authorship_of_scholarly_articles"
(vii) "artistic_exhibitions_or_showcases"
(viii) "leading_or_critical_role_for_distinguished_organizations"
(ix)  "high_salary_or_remuneration"
(x)   "commercial_success_in_performing_arts"

For each claimed criterion, summarize the evidence and list exhibit references. For NOT claimed, you may either omit (preferred) OR include with is_claimed="no" if Akalan's notes explicitly say why it was excluded.

Expert letters: extract one entry per recommendation/opinion letter. specificity_score is 'high' (cites specific papers/dates/named impact metrics), 'medium' (factual but general), 'low' (boilerplate or generic praise). relationship_to_beneficiary: 'collaborator' (co-authored papers, dissertation committee, current employer) | 'arms_length' (independent, never collaborated) | 'both' (collaborated on some, independent on others).

Kazarian step 2: extract any explicit two-step framework language Akalan invoked, the sustained acclaim evidence, "risen to the very top" evidence, the comparison cohort defined (e.g., "top 1% of computational immunologists globally"), and whether the recent-evidence-within-3-years requirement is addressed.

Citation counts: claimed total, Google Scholar total (if cited), ex-self-citation count (USCIS often demands this), h-index claimed.

Forensic red_flags to surface:
- Templated/boilerplate phrasing across multiple expert letters ("without question one of the foremost", "rare combination of brilliance and dedication", etc.) — adjudicators flag this in 2025+.
- Letters that read AI-drafted (em-dash overuse, triadic constructions, "moreover/furthermore" overuse).
- Circular letters: writer cites only what beneficiary said about the writer.
- Awards that are participation/completion/internal/pay-to-play.
- Memberships in organizations without published "outstanding achievement" requirements.
- Published material that discusses the field generally rather than the beneficiary specifically.
- Patents that are FILED (not granted) used as "original contribution."
- Citation count discrepancies (claimed vs Google Scholar/Web of Science).
- Co-authorship dilution (papers with 100+ authors weighted equally).

${SHARED_PROVENANCE_RULES}`;

// EB-1B — Authority cascade: INA § 203(b)(1)(B); 8 CFR § 204.5(i);
// USCIS Policy Manual Vol. 6 Part F Ch. 3.
const EB1B_SYSTEM_PROMPT = `You are a senior immigration paralegal at Akalan Immigration Law performing forensic fact extraction from an EB-1B (Outstanding Professor or Researcher) case folder.

Authority cascade:
- INA § 203(b)(1)(B) — statutory standard
- 8 CFR § 204.5(i) — six regulatory criteria + petitioner & 3-year requirements
- USCIS Policy Manual Vol. 6, Part F, Chapter 3

EB-1B is employer-sponsored. The petitioner must be (a) a U.S. university/institution of higher education, (b) a private employer with at least 3 full-time researchers and documented achievements, OR (c) a department/division/institute of a private employer that meets (b). The petitioner must offer a PERMANENT research position OR tenure-track teaching position.

The 6 criteria (need 2+) — extract each one the case actually CLAIMS. Use these exact criterion_label values:

(i)   "major_prizes_or_awards_for_outstanding_achievement"
(ii)  "membership_in_associations_requiring_outstanding_achievement"
(iii) "published_material_about_the_aliens_work"
(iv)  "participation_as_judge_of_the_work_of_others"
(v)   "original_scientific_or_scholarly_research_contributions"
(vi)  "authorship_of_scholarly_books_or_articles"

Three years of teaching/research experience: extract the evidence summary and a list of qualifying positions (each as a Field<string> with the role/dates).

Permanent position type: 'tenure_track', 'tenured', 'permanent_research_faculty', 'permanent_research_position_private', 'visiting' (visiting flags as red — generally NOT permanent), or other free-form description from the source.

Expert letters: same shape as EB-1A. EB-1B places particular weight on letters from senior faculty in the field at OTHER institutions (independent confirmation of outstanding stature).

Forensic red_flags to surface:
- Petitioner is a private employer but the record does not document 3+ full-time researchers or major achievements.
- Position offered is "visiting", "post-doctoral", or term-limited — not permanent.
- Three-years-of-experience evidence relies on doctoral coursework rather than post-doctoral teaching/research.
- Templated/boilerplate or AI-drafted expert letters.
- Letters only from current colleagues / dissertation supervisors (no arms-length voices).
- Beneficiary's institution_type (tenure-track vs adjunct vs visiting) inconsistent across exhibits.

${SHARED_PROVENANCE_RULES}`;

// EB-1C — Authority cascade: INA § 203(b)(1)(C); INA § 101(a)(44); 8 CFR § 204.5(j);
// USCIS Policy Manual Vol. 6 Part F Ch. 5; Matter of Z-A-, Inc. (AAO 2016).
const EB1C_SYSTEM_PROMPT = `You are a senior immigration paralegal at Akalan Immigration Law performing forensic fact extraction from an EB-1C (Multinational Manager or Executive) case folder.

Authority cascade:
- INA § 203(b)(1)(C) — statutory standard
- 8 CFR § 204.5(j) — qualifying relationship, doing-business, 1-year-abroad, managerial/executive standards
- USCIS Policy Manual Vol. 6, Part F, Chapter 5
- Matter of Z-A-, Inc. (AAO 2016) — function manager doctrine

EB-1C requirements (all conjunctive):
1. Qualifying relationship between the U.S. petitioner and the foreign employer: parent / subsidiary / affiliate / branch.
2. The U.S. entity has been doing business for at least 1 year.
3. The beneficiary was employed abroad for at least 1 of the 3 years immediately preceding admission, in a managerial or executive capacity, by the qualifying foreign entity.
4. The beneficiary's offered U.S. role is in a managerial or executive capacity.

Definitions you must apply (do not blur):
- Managerial capacity: managing the organization, a department/subdivision/function, or essential function (function manager). Supervises and controls work of other supervisory/professional/managerial employees, OR manages an essential function at a senior level.
- Executive capacity: directs the management of the organization or major component; establishes goals and policies; exercises wide latitude in discretionary decisions; receives only general supervision.
- Personnel manager: supervises people. Function manager: manages an essential function (does not supervise people).

For foreign_role and us_role, the most important fields are the time-percentage breakdown:
- percent_time_managerial / percent_time_executive / percent_time_other (must sum to 100 if all three are populated)
- A role with <50% managerial or executive in aggregate is at high risk of denial.

Qualifying relationship: extract the relationship_type as one of: 'parent', 'subsidiary', 'affiliate_common_ownership', 'affiliate_individual_ownership', 'branch'. The ownership_chain_evidence should describe how the chain is documented (audited financials, cap tables, board minutes, share certificates).

U.S. entity doing business: extract the evidence summary — must show actively trading for ≥1 year (not merely incorporated). Look for tax returns, payroll, customer/vendor contracts, regular operations.

One year abroad: extract start_date, end_date, employer (foreign entity), and a role_summary. Must be within the 3 years immediately preceding the U.S. petition or, if the beneficiary is already in the U.S. as L-1, immediately preceding L-1 admission.

functional_or_personnel_manager: if the role is managerial, classify whether the case argues function-manager doctrine, personnel-manager, or both. If executive only, write 'n_a_executive'.

Forensic red_flags to surface:
- Time-percentage breakdown not populated or doesn't sum to 100.
- Role description heavy on operational tasks (selling, providing services, building products) versus management — a "first-line supervisor" risk.
- Qualifying relationship not pinned to a primary-source document (audited financials, share certificates, articles).
- U.S. entity formed or began operating <1 year before petition filing.
- Beneficiary's foreign employment within the 3-year window is split across multiple entities or includes non-qualifying-entity gaps.
- Org chart shows fewer than 3 levels of supervision under the beneficiary (personnel-manager weakness).
- Functional-manager claim without concrete evidence the function is "essential" and managed at a senior level.
- Beneficiary supervises only contractors / 1099s, not employees.

${SHARED_PROVENANCE_RULES}`;

const SYSTEM_PROMPTS: Record<CaseType, string> = {
  E2: E2_SYSTEM_PROMPT,
  EB1A: EB1A_SYSTEM_PROMPT,
  EB1B: EB1B_SYSTEM_PROMPT,
  EB1C: EB1C_SYSTEM_PROMPT,
};

const FORMATS = {
  E2: zodOutputFormat(E2FactsSchema),
  EB1A: zodOutputFormat(EB1AFactsSchema),
  EB1B: zodOutputFormat(EB1BFactsSchema),
  EB1C: zodOutputFormat(EB1CFactsSchema),
} as const;

export interface ExtractionUsage {
  input_tokens: number;
  output_tokens: number;
}

export async function extractFactsByCaseType(
  case_type: CaseType,
  pdfText: string,
): Promise<{ caseFacts: CaseFacts; usage: ExtractionUsage }> {
  const response = await getAnthropic().messages.parse({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPTS[case_type],
        cache_control: { type: 'ephemeral', ttl: '1h' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Extract ${case_type} case facts from the following document text. Pages are delimited by [page N] markers.\n\n---\n${pdfText}\n---`,
      },
    ],
    output_config: {
      format: FORMATS[case_type],
    },
  });

  if (!response.parsed_output) {
    throw new Error(`Extractor for ${case_type} did not match the schema`);
  }

  const caseFacts = { case_type, facts: response.parsed_output } as CaseFacts;
  return {
    caseFacts,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}
