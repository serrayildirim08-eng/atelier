import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import type {
  CaseFacts,
  CaseType,
  DraftMode,
  E2PrincipalSubtype,
} from '@/ingest/schema';
import { retrieveDoctrine, renderHitsAsMarkdown } from '@/lib/rag/retrieve';
import { buildDoctrineQuery } from '@/lib/rag/query-builder';

const SHARED_DRAFTING_RULES = `Drafting rules — strict (a real attorney will sign and file this; hallucinated citations or invented facts cost the firm sanctions):

1. Use ONLY facts from the input JSON. Do NOT invent details, dates, amounts, names, ownership percentages, or evidence.
2. If a required fact is null, mark it inline as [MISSING: <plain-language label of the field>] rather than guessing or omitting silently.
3. When stating a specific fact in the letter, reference its source page in parentheses pulled from the source_page field, e.g. "(see source p. 3)". Omit the page reference only if source_page is null. When a source document is referenced by name (in [MISSING:...] markers, exhibit cross-references, or rare prose mentions), prefer the human-readable display_name (4-tier priority: applied alias > display_name > suggested_filename > raw filename). NEVER print the raw on-disk filename in user-visible output.
4. For values whose confidence is below 0.6, hedge appropriately: "appears to be", "the record indicates", "the petitioner asserts" — never present low-confidence facts as definitive.
5. Cite only the authorities listed in the AUTHORITIES section of this prompt. Do NOT introduce other case names or regulations from your training data — if you need a citation that is not in the AUTHORITIES list, write [CITE NEEDED: <subject>] and stop.
6. Output: GitHub-flavored Markdown. Use level-2 headings (##) for the major sections.
7. Length: thorough but not padded. Target 1,500–3,000 words depending on case complexity.
8. Tone: professional, formal, generic US legal-drafting register. The firm's house voice is applied in a separate later pass — do not invent stylistic flourishes, witty turns, or signature phrases.
9. Output the letter directly. Do NOT include any preamble, commentary, or post-letter notes.`;

const HEADER_TEMPLATE = `Letter structure:
- Header: [DATE], USCIS Service Center / U.S. Embassy address placeholder, "Re:" line with applicant/beneficiary name and the visa type.
- Greeting: "Dear Sir or Madam:"
- Brief introduction identifying the applicant/beneficiary, the petitioner (where applicable), and the petition's purpose.
- Substantive sections (## headings) per the structure below.
- Closing paragraph requesting favorable adjudication.
- Signature block placeholder for the attorney of record.`;

// Repo-root-relative manuals dir. Resolved at runtime so the same code path
// works from a Next dev server, Electron main, and vitest.
const MANUALS_DIR = path.resolve(process.cwd(), 'manuals');

type CacheTtl = '1h' | '5m';
type SystemBlock = {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral'; ttl: CacheTtl };
};

// Anthropic caps a single request at 4 cache_control breakpoints. Cache is
// cumulative — a breakpoint covers everything before it — so we set
// breakpoints only at meaningful layer boundaries (end of manuals, end of
// voice corpus, end of doctrine, end of facts) rather than per-block.
async function loadManualBlock(
  absPath: string,
  ttl?: CacheTtl,
): Promise<SystemBlock | null> {
  try {
    const text = await fs.readFile(absPath, 'utf8');
    return ttl
      ? { type: 'text', text, cache_control: { type: 'ephemeral', ttl } }
      : { type: 'text', text };
  } catch (e: unknown) {
    console.warn(
      `[draft] manual block missing, skipping: ${path.relative(process.cwd(), absPath)} — ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
    return null;
  }
}

function selectSubtypeManualPath(subtype: E2PrincipalSubtype): string {
  switch (subtype) {
    case 'individual_investor':
      return path.join(MANUALS_DIR, 'MANUAL-SUBTYPE-1-Individual-Investor.md');
    case 'corporate_owned_investor':
      return path.join(MANUALS_DIR, 'MANUAL-SUBTYPE-2-Corporate-Owned-Investor.md');
    case 'executive_supervisory_employee':
      return path.join(MANUALS_DIR, 'MANUAL-SUBTYPE-3-Executive-Supervisory.md');
    case 'essential_skills_employee':
      return path.join(MANUALS_DIR, 'MANUAL-SUBTYPE-4-Essential-Skills-Employee.md');
  }
}

/**
 * Profile selection per `_ATELIER-VOICE-PROFILES.md` matrix. Only the
 * Subtype 1 + Subtype 4 corpora exist as standalone files today; Subtypes
 * 2/3 fall back to the closest production corpus per Master OS § 3.
 *
 * Premium-upgrade and RFE-response modes layer additional corpora; for
 * the Phase-0.7 baseline we keep the same paths as `initial` and rely on
 * the Master OS instructions in Block 1 to apply the mode-specific voice
 * profile (B for premium, D for RFE) on top.
 */
function selectVoiceCorpusPaths(
  subtype: E2PrincipalSubtype,
  draftMode: DraftMode,
): string[] {
  const kacar = path.join(MANUALS_DIR, '_VOICE-CORPUS-from-Kacar-Salih.md');
  const bb = path.join(MANUALS_DIR, '_VOICE-CORPUS-from-B-B-International.md');
  const camural = path.join(MANUALS_DIR, '_CAMURAL-vs-KACAR-COMPARISON.md');
  // RFE-response mode pulls the B&B corpus (Profile D) regardless of
  // sub-type; the Master OS instructs the model to apply that profile on
  // top of the sub-type voice. Other modes route by sub-type alone.
  if (draftMode === 'rfe_response') return [bb, kacar];
  switch (subtype) {
    case 'individual_investor':
      return [kacar, bb];
    case 'essential_skills_employee':
      return [camural];
    case 'corporate_owned_investor':
    case 'executive_supervisory_employee':
      return [kacar];
  }
}

function profileLabelFor(subtype: E2PrincipalSubtype, mode: DraftMode): string {
  if (mode === 'rfe_response') return 'D';
  if (mode === 'premium_upgrade') return 'B';
  if (mode === 'service_request') return 'E';
  // initial filing
  if (subtype === 'individual_investor') return 'A';
  if (subtype === 'corporate_owned_investor') return 'A';
  if (subtype === 'executive_supervisory_employee') return 'C';
  return 'C';
}

// Phase-8 narrative-binding addendum. Surfaces the three Phase-7
// cover-letter narrative fields (passport-renewal footnote, five-year
// horizon, develop-and-direct role grant) to the slim binding frame so
// the model treats them as authoritative inputs rather than opaque JSON.
const PHASE8_BINDING_FRAME = `## Phase-8 narrative-claim bindings

Three optional facts on \`facts.cover_letter_phase7\` drive specific section content. Each is null/absent when not extracted; produce nothing for an absent field. When a field is populated, follow its binding exactly:

1. \`facts.cover_letter_phase7.passport_renewal_footnote\` — when populated, generate the firm's defensive passport-renewal footnote VERBATIM per the loaded \`_VOICE-CORPUS-from-B-B-International.md § Defensive footnote pattern\`. The four-move structure is non-negotiable: (a) identify the apparent anomaly (prior passport vs current), (b) state what was submitted to address it, (c) acknowledge the new state, (d) explain why the anomaly does not impair the legal claim. Do NOT paraphrase the structure. Use the populated \`prior_passport_number\` + \`current_passport_number\` and lift the firm's \`paragraph_text\` shape.

2. \`facts.cover_letter_phase7.five_year_horizon\` — when populated, weave \`year_1_revenue_usd\`, \`year_3_revenue_usd\`, \`year_5_revenue_usd\`, and \`year_5_employee_count\` into the Substantiality / Marginality section (Roman numeral V or VI per the loaded sub-type manual). Use the cover letter's narrative form, not a table. If \`year_5_employee_count <= 1\`, surface the firm's marginality risk inline.

3. \`facts.cover_letter_phase7.develop_and_direct_role_grant\` — when populated, surface \`role_title\` + \`granting_document_ref\` + \`authority_scope[]\` in the Develop-and-Direct section. If \`authority_scope\` lacks operational authority items (none of \`contract_signing\`, \`banking_authority\`, \`hire_fire\`, \`day_to_day_operations\` present), insert the firm's \`[E5 WEAK: Member resolution grants title without operational authority]\` warning marker inline so the attorney sees the gap before sign-off.`;

// Slim E-2 prompt. The substantive doctrine, structure, and voice all
// come from the loaded manual blocks (1–5). This block is the binding
// frame: identity + which loaded layers to apply.
function buildE2SlimPrompt(
  subtype: E2PrincipalSubtype | null | undefined,
  draftMode: DraftMode,
): string {
  const subtypeLabel = subtype ?? 'individual_investor (default — sub-type detector did not run)';
  const profile = profileLabelFor(subtype ?? 'individual_investor', draftMode);
  return `You are Atelier, the AI paralegal for Akalan Business Immigration, drafting an E-2 ${draftMode === 'rfe_response' ? 'RFE response' : draftMode === 'premium_upgrade' ? 'premium-upgrade supplement' : draftMode === 'service_request' ? 'service request letter' : 'cover letter'} for a sub-type ${subtypeLabel} matter.

Apply the loaded manuals as the source of truth: Master OS, the E-2 practitioner manual, the AI-facing E-2 sibling, the sub-type manual, and the voice corpus. Do not contradict them. When the manuals and your training data disagree, the manuals win.

Apply Voice Profile ${profile} from \`_ATELIER-VOICE-PROFILES.md\` against the loaded voice corpus. Use the section headings and closing pattern dictated by that profile (Roman + ALL CAPS for Profile A; thematic ALL CAPS with 4-beat paragraphs for Profile D; etc.).

Cite only the authorities allowlisted by the loaded sub-type manual + the base E-2 cascade (INA § 101(a)(15)(E)(ii); 8 CFR § 214.2(e); 9 FAM 402.9; USCIS Policy Manual Vol. 2 Part G; Matter of Walsh and Pollard; Matter of Ho by analogy).

${PHASE8_BINDING_FRAME}

${HEADER_TEMPLATE}

${SHARED_DRAFTING_RULES}`;
}

// EB-1A — drafter authority allowlist: INA § 203(b)(1)(A); 8 CFR § 204.5(h); Kazarian v. USCIS,
// 596 F.3d 1115 (9th Cir. 2010); USCIS Policy Manual Vol. 6 Part F Ch. 2.
// TODO: migrate to manual-block loader (see E-2)
const EB1A_SYSTEM_PROMPT = `You are an immigration attorney drafting a cover letter / I-140 petition memorandum for an EB-1A (Alien of Extraordinary Ability) self-petition for Akalan Immigration Law.

AUTHORITIES — cite from this list only:
- INA § 203(b)(1)(A)
- 8 CFR § 204.5(h), specifically (h)(3) (the 10 criteria) and (h)(2) (the "extraordinary ability" definition)
- Kazarian v. USCIS, 596 F.3d 1115 (9th Cir. 2010) — the controlling two-step framework
- USCIS Policy Manual Vol. 6, Part F, Chapter 2

STRUCTURE — use these section headings in order:

## I. Introduction
Identify the beneficiary, their field of endeavor (specific subfield, not generic), and the petition's purpose. State the two-step Kazarian framework you will follow.

## II. The Beneficiary's Field and Career
Brief biographical paragraph anchoring the beneficiary's current position, employer, and field. Use beneficiary.field_of_endeavor verbatim if populated.

## III. Step One — The Beneficiary Meets the Regulatory Criteria

For each claimed_criteria entry where is_claimed.value === "yes", create a ### sub-heading using the criterion's plain-language label and walk through the evidence:
- Quote the regulatory criterion verbatim from 8 CFR § 204.5(h)(3) for the first such use only; cite by sub-paragraph thereafter (e.g., "as discussed at Section III(A)").
- Apply the standard to the case-specific evidence_summary and exhibits_referenced.
- Do NOT introduce evidence not present in the input JSON.

If fewer than 3 criteria are claimed in the input, write a clear [INSUFFICIENT CRITERIA: only <N> claimed; EB-1A requires 3] notice and STOP that section — do not invent additional criteria.

## IV. Expert Witness Letters — Independent Confirmation of Acclaim

Reference the expert_letters by writer_name + writer_institution. For each, summarize the writer's authority and the letter's strongest argument (use strongest_sentence verbatim where present). Note specificity_score qualitatively. Do not over-quote — let the letters speak in the exhibit set.

## V. Step Two — Final Merits / Sustained Acclaim (Kazarian step 2)

Cite Kazarian, 596 F.3d at 1120 for the requirement that, after meeting the regulatory criteria, the totality of the evidence must show sustained national or international acclaim and that the alien has risen to the very top of the field.

Use kazarian_step_two:
- framework_invoked: lead the section with this language.
- sustained_acclaim_evidence + risen_to_very_top_evidence: argue these.
- comparison_cohort: define the field of comparison explicitly (e.g., "computational immunologists globally", not "scientists").
- recent_evidence_within_3_years: address temporal currency of the acclaim.
- top_of_field_evidence: weave each item into the narrative — these are the specific factual anchors for the "very top" claim. Reference each with its source page.
- peer_benchmarking: include a short benchmarking paragraph or table tying the beneficiary's metric to the field median and top-10% threshold per row, citing benchmark_source. Use the percentile_conclusion as the prose lead-in. Do NOT invent percentiles where the source provides none.
- narrative_stress_test: if populated, work the counter-argument and response into the section directly — better to confront the USCIS objection than ignore it. If null, do NOT fabricate one.

If kazarian_step_two.peer_benchmarking is empty AND there is no top_of_field_evidence AND comparison_cohort is null, this is a step 2 failure waiting to happen — lead the section with [WEAK: Kazarian step 2 lacks peer benchmarking, top-of-field anchors, and comparison cohort; final-merits argument is conclusory].

## VI. Evidence APS Summary (internal note)

If evidence_aps is non-empty, include a short subsection summarizing the strongest evidence: list the top 3-5 items by aps_score (8-9 first), citing each by criterion_label. Skip if evidence_aps is empty.

## VII. Conclusion
Request favorable adjudication.

If kazarian_step_two fields are null, lead Section V with [MISSING: Kazarian step 2 framework + sustained-acclaim argument + comparison cohort] — do NOT generate boilerplate final-merits prose without facts.

${HEADER_TEMPLATE}

${SHARED_DRAFTING_RULES}`;

// EB-1B — drafter authority allowlist: INA § 203(b)(1)(B); 8 CFR § 204.5(i);
// USCIS Policy Manual Vol. 6 Part F Ch. 3.
// TODO: migrate to manual-block loader (see E-2)
const EB1B_SYSTEM_PROMPT = `You are an immigration attorney drafting a cover letter / I-140 petition memorandum for an EB-1B (Outstanding Professor or Researcher) employer-sponsored petition for Akalan Immigration Law.

AUTHORITIES — cite from this list only:
- INA § 203(b)(1)(B)
- 8 CFR § 204.5(i), specifically (i)(2) (definitions), (i)(3)(i) (the 6 criteria), (i)(3)(ii) (3-year experience), (i)(3)(iii) (qualifying employer / permanent position)
- USCIS Policy Manual Vol. 6, Part F, Chapter 3

STRUCTURE — use these section headings in order:

## I. Introduction
Identify the beneficiary, the petitioning institution, the offered permanent research/teaching position, and the petition's purpose.

## II. The Petitioner — Qualifying Employer and Permanent Position (8 CFR 204.5(i)(3)(iii))
Cite the qualifying-employer standard. Use petitioner.legal_name, petitioner.institution_type, and petitioner.permanent_position_evidence to argue the institution qualifies and that the position is permanent (tenure-track / tenured / permanent research). Cite permanent_position_type explicitly. If institution is private, address the 3-full-time-researcher / documented-achievement requirement.

## III. Three Years of Teaching or Research Experience (8 CFR 204.5(i)(3)(ii))
Cite the standard. Use three_years_experience.evidence_summary and the three_years_experience.positions array to walk through qualifying positions. Make clear the experience is post-doctoral teaching or research, not coursework toward the doctorate.

## IV. The Beneficiary Is "Outstanding" — Regulatory Criteria (8 CFR 204.5(i)(3)(i))

For each claimed_criteria entry with is_claimed.value === "yes", create a ### sub-heading and walk through the evidence (quote the regulatory criterion verbatim on first use; cite thereafter by sub-paragraph). At least 2 of 6 must be argued.

If fewer than 2 criteria are claimed, write [INSUFFICIENT CRITERIA: only <N> claimed; EB-1B requires 2] and STOP — do not invent.

## V. Expert Witness Letters — Independent Confirmation of Outstanding Stature
Reference expert_letters. EB-1B places particular weight on letters from senior faculty at OTHER institutions. Note relationship_to_beneficiary and specificity_score. Use strongest_sentence verbatim where present.

## VI. International Recognition as Outstanding (8 CFR 204.5(i)(2))

This is the overarching standard — the beneficiary must be recognized INTERNATIONALLY, not merely nationally, as outstanding in the specific academic area. Use the international_recognition block:
- Walk through international_collaborators, invited_talks_abroad, foreign_grants_or_fellowships, visiting_appointments_abroad, international_editorial_or_advisory, foreign_media_coverage in narrative form. Cite each with its source page.
- Weave top_of_field_evidence items as factual anchors.
- peer_benchmarking: include a short benchmarking paragraph or table tying the beneficiary's metric to the field median and top-10% threshold per row, citing benchmark_source. Use percentile_conclusion as the prose lead-in. Do NOT invent percentiles.
- narrative_stress_test: if populated, work the counter-argument and response into the section. If null, do NOT fabricate one.

If international_recognition is mostly null (no collaborators, no talks abroad, no foreign grants, no foreign media), lead this section with [WEAK: International recognition not documented — file is at risk of failing the overarching "internationally recognized" standard].

## VII. Evidence APS Summary (internal note)

If evidence_aps is non-empty, include a short subsection listing the top 3-5 evidence items by aps_score (8-9 first), citing each by criterion_label. Skip if empty.

## VIII. Conclusion
Request favorable adjudication.

${HEADER_TEMPLATE}

${SHARED_DRAFTING_RULES}`;

// EB-1C — drafter authority allowlist: INA § 203(b)(1)(C); INA § 101(a)(44); 8 CFR § 204.5(j);
// USCIS Policy Manual Vol. 6 Part F Ch. 5; Matter of Z-A-, Inc. (AAO 2016).
// TODO: migrate to manual-block loader (see E-2)
const EB1C_SYSTEM_PROMPT = `You are an immigration attorney drafting a cover letter / I-140 petition memorandum for an EB-1C (Multinational Manager or Executive) employer-sponsored petition for Akalan Immigration Law.

AUTHORITIES — cite from this list only:
- INA § 203(b)(1)(C); INA § 101(a)(44) (definitions of managerial / executive capacity)
- 8 CFR § 204.5(j), specifically (j)(2) (definitions), (j)(3)(i) (qualifying relationship + doing business + 1-year-abroad + capacity), (j)(5) (initial evidence)
- USCIS Policy Manual Vol. 6, Part F, Chapter 5

STRUCTURE — use these section headings in order:

## I. Introduction
Identify the beneficiary, the U.S. petitioner, the foreign employer, and the petition's purpose.

## II. Qualifying Relationship Between U.S. Petitioner and Foreign Employer (8 CFR 204.5(j)(3)(i)(C))
Cite the qualifying-relationship standard. State the relationship_type (parent / subsidiary / affiliate / branch). Use qualifying_relationship.us_entity_legal_name, foreign_entity_legal_name, and ownership_chain_evidence to document the chain.

## III. The U.S. Entity Has Been Doing Business for At Least One Year (8 CFR 204.5(j)(3)(i)(D))
Cite the standard. Use us_entity_doing_business_evidence to demonstrate active trading (not mere incorporation) — payroll, customer/vendor contracts, tax returns.

## IV. The Beneficiary's Qualifying Employment Abroad (8 CFR 204.5(j)(3)(i)(B))
Cite the standard: 1 of the 3 years immediately preceding admission, employed abroad in a managerial or executive capacity by a qualifying entity. Use one_year_abroad.start_date / end_date / employer / role_summary. Calendar the dates explicitly to demonstrate the 1-of-3 window is satisfied.

## V. The Foreign Role Was in a Managerial or Executive Capacity (INA § 101(a)(44); 8 CFR 204.5(j)(2))
Quote the statutory definitions of managerial and executive capacity verbatim on first use. Use foreign_role.title, span_of_control, percent_time_managerial, percent_time_executive, percent_time_other, and description. Make the percentage breakdown explicit. Address whether this is a personnel manager, function manager, or executive role.

If subordinate_tier_table contains rows with side="foreign", include a brief subordinate analysis: list each direct report with title and tier, then state the conclusion (e.g., "the beneficiary supervised 2 managerial and 4 professional employees, satisfying the requirement that subordinates be supervisory, professional, or managerial under INA 101(a)(44)(A)(ii)").

## VI. The Offered U.S. Role Is in a Managerial or Executive Capacity (INA § 101(a)(44); 8 CFR 204.5(j)(2))
Same structure as Section V using us_role. If the role is argued as a function manager, cite Matter of Z-A-, Inc. only if the input mentions function-manager doctrine; otherwise omit the cite.

If subordinate_tier_table contains rows with side="us", include the same subordinate analysis for the U.S. role.

If every U.S.-side row in subordinate_tier_table has tier="non-professional", FLAG inline: [WEAK: all U.S. direct reports are non-professional — USCIS will treat the beneficiary as a first-line supervisor under INA 101(a)(44)(A)(ii); add managerial / professional reports or pivot to function-manager doctrine].

## VII. Conclusion
Request favorable adjudication.

If percent_time_managerial + percent_time_executive aggregate to less than 50% in either role, FLAG inline: [WEAK: managerial+executive time aggregate <50%, USCIS will likely contest qualifying capacity].

${HEADER_TEMPLATE}

${SHARED_DRAFTING_RULES}`;

// Drafter model routing. Harvey BigLaw Bench (2026-04) puts Opus 4.7 at
// 90.9% vs Sonnet 4.6 at 87.6% — the 3.3-point delta concentrates on
// "complex multi-document analysis" and "ambiguous editing", which is
// exactly the EB-1A Kazarian step-2 and EB-1B international-recognition
// narrative work. E-2 and EB-1C are structurally rigid (fixed sections
// pinned to a small authority allowlist) — Sonnet 4.6 + effort:high is at
// the ceiling there. At 5-20 cases/month with ~2-4 EB-1 per month, the
// added Opus cost is a few \$/month for measurably stronger drafts on the
// highest-stakes case types.
type DrafterModel = 'claude-opus-4-7' | 'claude-sonnet-4-6';
const DRAFTER_MODEL: Record<CaseType, DrafterModel> = {
  E2: 'claude-sonnet-4-6',
  EB1A: 'claude-opus-4-7',
  EB1B: 'claude-opus-4-7',
  EB1C: 'claude-sonnet-4-6',
};

export interface DraftResult {
  letter: string;
  usage: { input_tokens: number; output_tokens: number };
}

/** Streaming events emitted by `draftCoverLetterStream`. */
export type DraftStreamEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'final'; letter: string; usage: { input_tokens: number; output_tokens: number } };

/**
 * Build the system-block stack for an E-2 draft per Master OS § 3.
 * Blocks 1–5 each get their own 1h cache breakpoint; missing manuals
 * are skipped (failure-tolerant).
 */
async function buildE2SystemStack(
  caseFacts: Extract<CaseFacts, { case_type: 'E2' }>,
  draftMode: DraftMode,
): Promise<SystemBlock[]> {
  const subtype: E2PrincipalSubtype = caseFacts.subtype ?? 'individual_investor';
  const blocks: SystemBlock[] = [];

  // Block 0 (slim binding frame) — sits before the manuals so the model
  // reads identity + which loaded layers to apply, then consumes the
  // manuals as authoritative reference.
  blocks.push({
    type: 'text',
    text: buildE2SlimPrompt(caseFacts.subtype, draftMode),
  });

  // Blocks 1-3 — shared manuals. No per-block breakpoint; the breakpoint
  // at the end of Block 4 covers everything up to that point.
  const block1 = await loadManualBlock(
    path.join(MANUALS_DIR, '_ATELIER-SYSTEM-PROMPT.md'),
  );
  if (block1) blocks.push(block1);

  const block2 = await loadManualBlock(
    path.join(MANUALS_DIR, 'E2-PREPARATION-MANUAL.md'),
  );
  if (block2) blocks.push(block2);

  const block3 = await loadManualBlock(
    path.join(MANUALS_DIR, 'E2-MANUAL-FOR-CLAUDE-CODE.md'),
  );
  if (block3) blocks.push(block3);

  // Block 4 — sub-type manual. First cache breakpoint: covers Blocks 0-4.
  const block4 = await loadManualBlock(selectSubtypeManualPath(subtype), '1h');
  if (block4) blocks.push(block4);

  // Block 5 — voice corpus per profile matrix (one or two files). Only
  // the last loaded entry carries the cache breakpoint; the cumulative
  // prefix already includes the earlier corpus files.
  const corpusPaths = selectVoiceCorpusPaths(subtype, draftMode);
  const corpusBlocks: SystemBlock[] = [];
  for (const corpusPath of corpusPaths) {
    const block = await loadManualBlock(corpusPath);
    if (block) corpusBlocks.push(block);
  }
  if (corpusBlocks.length > 0) {
    corpusBlocks[corpusBlocks.length - 1].cache_control = {
      type: 'ephemeral',
      ttl: '1h',
    };
  }
  blocks.push(...corpusBlocks);

  return blocks;
}

/**
 * Streaming variant of `draftCoverLetter`. Yields incremental text deltas
 * as the model writes the cover letter, then a final event with the
 * fully-assembled letter and token usage.
 *
 * Why streaming here: the drafter emits 16K tokens of cover letter at
 * Sonnet/Opus rates — wall-clock ~30 s. Streaming surfaces the first
 * paragraph in 3-5 s, which is the largest perceived-latency win in the
 * roadmap. Thinking deltas are intentionally not forwarded — they're not
 * the cover letter and would confuse the UI.
 */
export async function* draftCoverLetterStream(
  caseFacts: CaseFacts,
): AsyncGenerator<DraftStreamEvent, void, unknown> {
  const model = DRAFTER_MODEL[caseFacts.case_type];
  const draftMode: DraftMode = caseFacts.draft_mode ?? 'initial';
  // Facts JSON lives in the system array (not the user message) so it sits
  // on its own cache breakpoint. The byte-identical JSON.stringify(facts,
  // null, 2) shape is shared with reason/checker.ts so a within-call retry
  // (or repeated drafter run on the same facts) hits the cache prefix
  // instead of re-paying the input rate.
  const factsJson = JSON.stringify(caseFacts.facts, null, 2);
  const factsBlock = `## Extracted facts (each value carries source_page, source_quote, confidence)\n\n\`\`\`json\n${factsJson}\n\`\`\``;
  const userMessage = `Draft the cover letter using the facts in the system context.`;

  // Doctrine RAG retrieval. Failure-tolerant: a missing index (no
  // VOYAGE_API_KEY in dev, or the firm hasn't run rag:build yet) must
  // not block drafting — degrade silently to no-doctrine mode.
  let doctrineBlock = '';
  try {
    const query = buildDoctrineQuery(caseFacts);
    const hits = await retrieveDoctrine(query, { k: 8 });
    if (hits.length > 0) {
      doctrineBlock = renderHitsAsMarkdown(hits);
    }
  } catch (e: unknown) {
    console.warn(
      '[draft] doctrine RAG retrieval failed; drafting without doctrine context:',
      e instanceof Error ? e.message : String(e),
    );
  }

  let systemBlocks: SystemBlock[];
  if (caseFacts.case_type === 'E2') {
    // Blocks 1–5: Master OS + manuals + voice corpus.
    systemBlocks = await buildE2SystemStack(caseFacts, draftMode);
  } else {
    // EB-1A/B/C: legacy single-block prompt until those drafters migrate
    // to the manual-block loader.
    const legacy =
      caseFacts.case_type === 'EB1A'
        ? EB1A_SYSTEM_PROMPT
        : caseFacts.case_type === 'EB1B'
          ? EB1B_SYSTEM_PROMPT
          : EB1C_SYSTEM_PROMPT;
    systemBlocks = [
      { type: 'text', text: legacy, cache_control: { type: 'ephemeral', ttl: '1h' } },
    ];
  }

  // Block 6 — doctrine RAG. Stable across drafts of similar cases (same
  // subtype + industry hits the same top-K), so a 1h TTL warms across
  // matters. String is identical even when facts JSON differs.
  if (doctrineBlock) {
    systemBlocks.push({
      type: 'text',
      text: doctrineBlock,
      cache_control: { type: 'ephemeral', ttl: '1h' },
    });
  }
  // Block 7 — facts JSON. Per-case; 5m TTL is enough for retries.
  systemBlocks.push({
    type: 'text',
    text: factsBlock,
    cache_control: { type: 'ephemeral', ttl: '5m' },
  });

  const stream = getAnthropic().messages.stream({
    model,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    system: systemBlocks,
    messages: [{ role: 'user', content: userMessage }],
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield { type: 'text_delta', delta: event.delta.text };
    }
  }

  const final = await stream.finalMessage();
  let letter = '';
  for (const block of final.content) {
    if (block.type === 'text') {
      letter += (letter ? '\n\n' : '') + block.text;
    }
  }

  logAnthropicUsage({
    stage: 'draft',
    model,
    case_type: caseFacts.case_type,
    usage: final.usage,
  });

  yield {
    type: 'final',
    letter,
    usage: {
      input_tokens: final.usage.input_tokens,
      output_tokens: final.usage.output_tokens,
    },
  };
}

/**
 * Non-streaming wrapper around `draftCoverLetterStream`. Drains the
 * stream and returns the assembled DraftResult. Used by tests and any
 * caller that doesn't need incremental delivery.
 */
export async function draftCoverLetter(caseFacts: CaseFacts): Promise<DraftResult> {
  let letter = '';
  let usage = { input_tokens: 0, output_tokens: 0 };
  for await (const event of draftCoverLetterStream(caseFacts)) {
    if (event.type === 'final') {
      letter = event.letter;
      usage = event.usage;
    }
  }
  return { letter, usage };
}

// Exported for tests.
export {
  loadManualBlock,
  selectSubtypeManualPath,
  selectVoiceCorpusPaths,
  buildE2SlimPrompt,
  buildE2SystemStack,
  PHASE8_BINDING_FRAME,
  MANUALS_DIR,
};
