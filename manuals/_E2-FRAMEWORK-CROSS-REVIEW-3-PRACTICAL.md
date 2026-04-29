# E-2 Framework — Cross-Review Memo · Practical axis
> Reviewer: Karen Whitfield, Esq. (also Lead Consolidator) · Atelier Brain Trust
> Phase: Cross-review (charter § 3.1)
> Version: v1.0 · 2026-04-29

---

> **Reviewer's posture.** I draft Part 3 and I consolidate the module.
> The two hats are not the same. As drafter I look at Part 3 and ask
> what depth a competent attorney still has to fill in herself before
> she can run a real file. As consolidator I look at all five Parts +
> the two practitioner manuals (`E2-PREPARATION-MANUAL.md`,
> `E2-MANUAL-FOR-CLAUDE-CODE.md`) and ask whether the corpus *as a
> corpus* is internally consistent, properly cross-referenced, and
> deployable as firm doctrine on Supervisor sign-off. This memo is
> written in numbered, time-boxed checklists. Every recommendation is
> P0 / P1 / P2 with a word-count budget so Supervisor can scope.

---

## 1. Self-audit of Part 3 (Practical)

Part 3 is methodologically sound but operationally thin in eight named
places. I will not retrofit fixes here; I will diagnose, size, and
prioritize.

### 1.1 Form-by-form drafting checklist depth — **P0 gap**

Part 3 § 4 (Filing-route decision tree) names the forms but does not
walk them. The Preparation Manual (Part II) does walk them, but in
client-facing how-to register, not in
intake-to-filing-checklist register. A competent attorney handed Part
3 alone cannot file.

What is missing, by form:

1. **I-129.** No checklist for: Part 2 classification election (E-2 vs E-1 vs E-3); Part 5 dates of intended employment vs reciprocity-schedule visa validity (these are not the same); Part 7 prior status reconciliation (which I-94 controls if the Beneficiary has multiple); fee tally cross-check against I-907 if premium elected.
2. **I-129E.** No checklist for: investment-amount field (must equal MITA consideration to the cent — currently buried in `E2-MANUAL-FOR-CLAUDE-CODE.md` § 4.5 quality gate, not surfaced in Part 3); ownership-percentage field rounding rules (50.00 % vs 49.99 % vs 50.50 % — only the first qualifies); type-of-business NAICS guidance; treaty-country drop-down vs free-text edge cases (Türkiye, Côte d'Ivoire — diacritic handling).
3. **G-28.** No checklist for: dating window (within 30 days, per `E2-MANUAL-FOR-CLAUDE-CODE.md` § 1.2, but Part 3 omits); separate G-28 per applicant (principal + spouse + each child); bar-number + state-of-licensure verification.
4. **G-1145.** No coverage at all. Trivial form, but missing means a competent reader cannot file end-to-end from Part 3.
5. **G-1650.** No checklist. ACH authorization mismatches against the actual fee schedule are a top-10 lockbox-rejection cause; Part 3 must acknowledge.
6. **DS-160.** No coverage. Consular route entirely. Critical fields: prior-visa-refusal disclosure (lifetime, all classifications); travel-history five-year window; social-media handles (post-2019 mandatory disclosure); intent-to-return narrative consistency with cover letter and DS-156E.
7. **DS-156E.** No coverage. The substantive E-2 supplement; this is where the consular officer reads the case. Required fields: investment composition; ownership chain; prior nationality(ies); enterprise's substantiality and marginality narrative.
8. **I-539.** No coverage for spouse COS. Biometrics protocol changed in 2024 (reusability across pending applications); Part 3 silent.
9. **I-539A.** No coverage for children COS, including the under-14 vs 14–20 biometrics carve-out.

**Recommendation.** New Part 3 § 4A "Form-by-form filing checklist" — one subsection per form, ~250 words each = ~2,250 words total. **P0** because this is the gap most likely to cause a firm-wide drafting error today.

### 1.2 RFE pattern catalog depth — **P0 gap**

Part 3 § 7 covers exactly **5 RFE response models**: substantiality (§ 7.2), marginality (§ 7.3), ownership (§ 7.4), source-of-funds (§ 7.5), at-risk (§ 7.6). The empirical record (Yılmaz dataset, ~380 redacted decisions, Part 2 § 2.3) shows the agency operates on **at least 30 distinct RFE templates**. The five we cover are the modal five; the next 25 are issued at materially elevated rates and we have no model responses.

The 25 missing RFE patterns, with model-response word-count estimates (each ~400–600 words):

1. *Substantial-investment-source-not-traced* — gap in the SOF chain at conversion or wire step (~500 w).
2. *Marginality-W2-quarter-gap* — Form 941 shows zero wages in a quarter while petitioner claims continuous operations (~450 w).
3. *Ownership-percentage-rounding* — I-129E shows 50 %, OA shows 49.95 % (~400 w).
4. *Develop-direct-passive-investor* — Beneficiary's role description reads as passive investor; no operational decisions enumerated (~500 w).
5. *Real-estate-percentage-overweight* — substantiality argument leans on real-property purchase rather than active operating capital (~500 w).
6. *Cost-to-establish-undocumented* — no cost-to-establish exhibit at all; substantiality can't be measured (~500 w).
7. *Five-year-plan-three-years-only* — business plan stops at Year 3; *Matter of Ho* analogy demands five (~450 w).
8. *Bilingualism-only-Subtype-4* — only proffered specialization is foreign-language fluency (~600 w; *Yıldız v. Garland* anchor).
9. *Executive-vs-functional-Subtype-3* — title is President but duties are operational/staff (~600 w).
10. *Specialized-knowledge-not-readily-available* — no US labor market data showing scarcity (~500 w).
11. *Treaty-country-dual-national-dominant-not-shown* — co-owner has two passports; treaty country not shown to be dominant nationality (~450 w).
12. *Foreign-parent-recency* — Subtype 2 parent's last audited financials are >18 months stale (~450 w).
13. *Subsidiary-independent-decision-making* — Subtype 2/3/4 with parent retaining buy-back or veto (~500 w).
14. *Apostille-vs-consular-legalization-mismatch* — Hague-country document presented with consular legalization (or vice versa) (~400 w).
15. *Translation-credentialing-deficient* — translator certification missing competency statement (~400 w).
16. *Cap-table-discontinuity* — gap in the ownership chain between formation and current (~500 w).
17. *Member-resolution-effective-date-postdates-filing* — appointment to D&D role dated after I-129 filing (~400 w).
18. *Wire-currency-mismatch* — wire-confirmation amount doesn't reconcile to FX-conversion amount within 1 % (~450 w).
19. *Cash-deposit-over-10K-unsupported* — bank statement shows $10K+ cash deposit without parallel paper trail (~500 w).
20. *Inheritance-without-probate* — informal-economy decedent; no probate court (~550 w; lean on Demir Part 4 § 4.1).
21. *Gift-vs-loan-ambiguity* — promissory note with no schedule, no interest, no enforcement (~500 w; lean on Demir Part 4 § 4.5).
22. *SPV-chain-multi-jurisdiction* — three-tier holding structure (~600 w; lean on Demir Part 4 § 4.3).
23. *Variance-on-renewal* — actuals materially diverged from prior projections (~550 w; lean on Demir Part 4 § 6.2).
24. *Beneficiary-role-changed-mid-cycle* — D&D drifted to spouse during prior period (~500 w; lean on Demir Part 4 § 6.3).
25. *Premises-virtual-not-real-and-operating* — registered-agent address with no physical premises (~500 w).

Total: ~12,500 words. **Recommendation.** New Part 3 § 7A "RFE pattern library — 25 additional templates," delivered as a versioned standalone (`manuals/_E2-RFE-LIBRARY.md`) with quarterly merges back into Part 3. **P0** because the empirical denial-rate distribution will not change just because we cover only the top five.

### 1.3 NOID pattern depth — **P1 gap**

Part 3 § 8 covers NOID *response architecture* well but provides zero NOID *templates*. NOIDs are rarer than RFEs, but each one is firm-existential. Recommendation: at least 5 NOID model responses for the modal triggers (impermissible-loan after RFE non-cure; develop-and-direct fundamental insufficiency; SOF chain unrecoverable gap; ownership below 50 %; specialized-knowledge collapses to bilingualism). Each ~700–900 words. Total: ~4,000 words. **P1.**

### 1.4 Premium-processing decision-tree depth — **P1 gap**

Part 3 § 6 has a 6-row table (when to elect / when not to). Insufficient for compounding scenarios:

- Premium + RFE pause-clock interactions (the 15-day clock pauses on RFE response; Demir's edge-case-score-≥-3 contraindication in Part 5 § 2.2 needs Part 3 operational guidance).
- Premium for I-539 dependents (technically not premium-eligible until 2024 expansion; current rule is partial — only some classifications; Part 3 silent).
- Premium re-trigger on RFE response receipt (Part 3 § 6.2 mentions but does not show the math — what does a 15-day re-trigger plus a pause add up to in practice?).
- Premium fee-refund mechanics if USCIS misses the clock (rare but happens).
- Premium for biometrics-pending I-539 vs I-129 lead.

Recommendation: expand § 6 by ~1,200 words with worked-example scenarios. **P1.**

### 1.5 Service-center-specific filing logistics — **P1 gap**

Part 3 § 5.1 has SC processing-time medians but **zero filing logistics**. A competent attorney needs:

- Lockbox addresses (USCIS Phoenix, Lewisville, Elgin, Chicago — wrong lockbox rejects); these update; pin to a versioned reference.
- Courier (FedEx/UPS) vs USPS routing (lockbox PO Box vs street address; some lockboxes accept only one).
- Signature-block conventions per SC (CSC ink-blue vs black; some accept e-signature on G-28, some don't).
- Cover-letter recipient line conventions per SC.
- I-907 routing (must accompany I-129 to the same lockbox; cross-lockbox returns).

Recommendation: new § 5.1A "Filing logistics by service center" — ~800 words. **P1.**

### 1.6 Post-2024 USCIS process changes — **P1 gap**

Part 3 was drafted to a steady-state baseline. Several 2024–2026 process changes are not reflected:

1. **Online filing expansion.** I-129 went online for some classifications in 2024; E-2 status is partial as of 2026-Q1. Document the current online-vs-paper election with as-of-date.
2. **Biometrics protocol updates.** I-539 reusability across pending applications (2024); biometrics waivers expanded for under-14 (2024); some under-14 dependents now skip biometrics entirely.
3. **Fee final rule (April 2024).** New fee schedule with separate Asylum Program Fee on I-129; small-employer / nonprofit carve-outs; G-1650 must reflect these.
4. **2024 sex/gender field changes.** I-129 and I-539 sex-field options changed; back-form-version filings can reject.
5. **Filing-changes notices.** USCIS posts policy alerts that change filing requirements at 30-day-or-less notice; firm needs a standing-check protocol.

Recommendation: new § 5.1B "Post-2024 process changes — currency log" — ~700 words, dated, with a reminder that it is currency-sensitive. **P1.**

### 1.7 Per-consulate interview-prep depth — **P1 gap**

Part 3 § 9 has a generic 50-question simulation. Excellent backbone. But consulate-specific interview cultures vary materially, and Part 3 § 5.2 lists only 5 posts (Ankara, Frankfurt, Mumbai, Mexico City, Tokyo) without coverage. The Supervisor flagged 8 posts: Ankara, Frankfurt, Mumbai, Mexico City, Tokyo, Seoul, Tel Aviv, Madrid.

Each post deserves a ~400-word prep memo: typical interview length, officer demeanor, modal probing themes, dress code conventions, supporting-document expectations, language-use norms (e.g., Ankara officers often switch to Turkish for the early questions to test ease of comprehension; Tel Aviv officers focus heavily on prior-Israeli-residency math; Madrid officers run shorter interviews with heavier post-interview document review). Total: ~3,200 words.

Recommendation: new Part 3 § 9A "Per-consulate interview prep memos." **P1.**

### 1.8 Post-approval handling depth — **P1 gap**

Part 3 § 10 has the closing letter and renewal calendar — but is missing:

1. **Travel guidance per status route.** USCIS COS gives status without visa stamp; Beneficiary cannot leave US. Currently in § 4.3 but no operational checklist (where to stamp; how to time the trip; what to bring).
2. **Employer notice obligations.** Material change in employment requires amended I-129 (8 CFR § 214.2(e)(8)). Part 3 silent; firm has been getting calls about salary changes, role expansions, premise relocations.
3. **AR-11 address change.** 30-day rule; 8 USC § 1305. Routinely missed; should be in closing-letter checklist.
4. **Dependent status maintenance.** Spouse work authorization (post-2022) doesn't auto-renew; expiration tracking.
5. **Renewal trigger taxonomy.** Material change vs no-material-change determines whether renewal is amendment-only or full re-file.

Recommendation: expand § 10 by ~1,000 words with a renewal/amendment/material-change taxonomy. **P1.**

---

## 2. Cross-axis review — practical gaps in OTHER Parts

### 2.1 Part 1 (Suárez-Lopez · Regulatory)

Part 1 is doctrinally exhaustive but **understates the practical companion** at five points:

1. **§ 1.6 "substantial amount of capital" delegation analysis.** Beautiful textualist work. No practical companion: how does a competent attorney *operationalize* the post-*Loper Bright* monitoring? Recommendation (Part 3 add-on or Part 1 § 1.6A): a one-page "early-warning protocol" — what we watch for, who watches, escalation tree if a federal court does test the inverted-sliding-scale post-*Loper Bright*. ~400 words. **P1.**
2. **§ 2.12 at-risk regulation.** Part 1 explains the doctrine. Part 3 § 7.6 has the RFE response. Missing: an *intake-stage screening checklist* — three questions the intake attorney asks at Q24–Q29 to detect a fatal-loan-secured-by-enterprise-assets *before* engagement. Currently Whitfield has the smell-test in her head; nothing is written. **P0.** ~250 words. Place in Part 3 § 1.5.
3. **§ 1.3 NDAA 2023 § 5502 three-year residency rule.** Part 1 flags this as Supervisor-currency-sensitive. **No corresponding Part 3 intake question.** Recommendation: add Q4A to Part 3 § 1.1 — "Naturalized treaty-country national? If so, when, and where domiciled in the trailing five years?" **P0**, immediate exposure if a citizenship-by-investment Beneficiary lands in intake without this question. ~150 words.
4. **§ 7.2 Loper Bright deference posture.** Doctrinally rich. No practitioner artifact: do we now cite the FAM differently in cover letters? Do we cite the FAM at all on contested constructions? A 2-paragraph guidance memo to drafters is missing. **P1.** ~300 words.
5. **§ 9 sub-type integration sections.** Part 1 §§ 9.1–9.4 (per Suárez-Lopez's outline; assumed present given § 4.4 of Part 5 references them) are doctrinal anchors. Each needs a corresponding Part 3 *intake calibration* — what changes about Q19 (sub-type self-identification) for each anchor. Currently Part 3 § 1.4 Q19 is one line. **P1.** ~400 words.

### 2.2 Part 2 (Yılmaz · AAO + Case Law)

Yılmaz's empirical work is the crown jewel but **underconnects to packet-construction artifacts**:

1. **§ 2.3 RFE category distribution.** Beautiful percentages. Missing: a *pre-filing self-RFE protocol* — runs the packet against the top-8 RFE categories before submission. Yılmaz mentions this at § 8.2 ("a pre-filing self-RFE catches roughly 70–80% of the issues"). Should live in Part 3 § 3 (packet assembly) as a stand-alone § 3.6 "Pre-filing self-RFE checklist." **P0.** ~600 words. This is the single highest-leverage practical artifact in the whole module and currently exists only in Yılmaz's prose.
2. **§ 4 service-center priors.** Excellent narrative. No corresponding Part 3 *routing memo template*. Yılmaz § 4.5 mentions registered-agent-strategy decisions; the firm should have a one-page memo template that documents any such routing decision contemporaneously (AAO will look for pretext on appeal). **P1.** ~300 words template.
3. **§ 6.1–6.4 sub-type case-law anchors.** Beautiful. No practitioner companion: which cover-letter section (II–VII) for each sub-type carries each precedent? Currently the practitioner has to map *Hira* / *Walsh & Pollard* / *Ho* / *Izumi* / *Yıldız* to sections from memory. Recommendation: a 4×4 mapping table in Part 3 § 11 (sub-type adjustments). **P1.** ~250 words.
4. **§ 3.1 federal-court appeals.** *Hashemi*, *Tekin*, *Yıldız*. No intake question detecting whether a case has appealable posture (USCIS-route vs consular-route; mandamus posture). **P1.** Add Q35A to Part 3 § 1.7. ~150 words.

### 2.3 Part 4 (Demir · Edge Cases)

Demir's catalog is immediately deployable. The practical gap is **decision-tree depth on case-acceptance**:

1. **§ 2 sub-type misclassification hazards.** Beautiful diagnostic prose. Missing: a *case-acceptance decision tree* — does the firm take this case at all, refer it out, or take it conditioned on rebuild? Current intake protocol (Part 3 § 1) ends at Q35 without an acceptance gate. **P0.** New Part 3 § 1.8 "Case-acceptance decision tree" — ~400 words flowing from Demir's hazards.
2. **§ 3 borderline ownership scenarios.** Excellent table. Missing: an *intake-pricing memo* — these cases cost more attorney-hours; the firm should have a pricing surcharge tied to Demir's edge-case-score (referenced in Part 5 § 2.2 but never defined). **P1.** Define the Demir score in Part 4 § 7 with explicit thresholds; reference in Part 3 fee schedule. ~300 words.
3. **§ 4 SOF edge cases.** Comprehensive resolution prose. Missing: a *deal-breaker red list* — patterns where Demir's resolution is "**stop**, do not file." Currently the only explicit red flag is § 6.4 (mid-cycle drop below 50 %). Other red flags scattered across the catalog — gather into Part 4 § 7A. **P1.** ~400 words.
4. **§ 1 defensive-paragraph catalog.** Drop-in ready, beautifully drafted. Missing: a *trigger-detection checklist* in Part 3 — for each defensive paragraph, what intake question or document signal triggers it? Currently in my head; should be a table in Part 3 § 3.4 (which currently has the placement table but not the *trigger-detection* table). **P0.** ~400 words.

### 2.4 Part 5 (Synthesis · my own consolidator hat)

Self-audit on Part 5:

1. **§ 3 50-point diagnostic.** Solid but **underspecified on starred items.** A "no" on a starred item means do-not-file, but the diagnostic does not tell the attorney what *recovery* posture is available (rebuild? refer out? wait six months for facts to mature?). **P1.** Add a fourth column "If failed → action" to the 50-point list. ~200 words.
2. **§ 2.1, § 2.2 disagreement resolutions.** I drafted the Supervisor-recommended postures. The synthesis does not pre-empt the next-six disagreements that *will* surface as cases come in. Recommendation: add § 2.3 "Disagreement-escalation protocol" — when attorneys split on a Part 3 § 11 sub-type calibration, what's the resolution path? **P2.** ~250 words.
3. **§ 4 sub-type matrix.** Beautiful 7-row table. Missing: a *case-load distribution* row — how many of each sub-type the firm handles annually, so attorney-hour budgeting is grounded. Currently no firmwide telemetry. **P2.** Defer to operations. ~100 words placeholder.
4. **§ 5 open questions registry.** Six items. Most are research-agenda items. Missing: priority and assignment. **P1.** Assign owner + target date per item. ~150 words.

---

## 3. Consolidator coordination items

### 3.1 Inconsistencies between Parts

Three substantive inconsistencies require resolution before publication:

1. **Bank-statement window default.** Part 3 § 5.1 silent (defers to manual); Part 5 § 2.1 resolves to 12 months default with three triggers; **Preparation Manual § 6 currently states ≥ 12 months for renewals, ≥ 3 months for new E-2** without the trigger logic. **Resolution.** Update the Preparation Manual to mirror Part 5 § 2.1 verbatim, and add a forward-pointer to Part 5 § 2.1 in the Manual's filing-checklist. **P0.**
2. **"Shall" vs "should" on defensive paragraphs.** Part 1 § 9.4 (assumed; not directly read) and Part 4 § 1 use "**mandatory** once triggered." Part 3 § 3.4 uses "should be inserted." Part 5 § 1.4 uses "**mandatory, not discretionary**." **Resolution.** Adopt Demir's "mandatory once triggered" everywhere; correct Part 3 § 3.4. **P0.** I'll do this myself in the consolidation pass.
3. **Premium-processing default for renewals.** Part 3 § 6.1 has a case-by-case table; Part 5 § 2.2 resolves to "standard processing default." The Part 3 table includes a "Renewal where adjudicator history at the center is benign" row marked "Optional; case-by-case." **Resolution.** Replace that row with "Standard processing default per Part 5 § 2.2." **P0.**

Two terminological inconsistencies:

4. **"Beneficiary" capitalization.** Preparation Manual capitalizes; `E2-MANUAL-FOR-CLAUDE-CODE.md` capitalizes; Part 3 mostly capitalizes but slips in a few places ("the beneficiary" lowercase in § 9.1). **Resolution.** Global find-replace. **P2.**
5. **"Petitioner" vs "Petitioner LLC" vs "the US enterprise."** Inconsistent across Parts. **Resolution.** Adopt Suárez-Lopez's "Petitioner" (capitalized) globally; align manuals. **P2.**

### 3.2 Duplications that should consolidate

Three duplications add maintenance cost without value:

1. **At-risk regulation citation.** Cited at Part 1 § 2.12, Part 2 § 1.5, Part 3 § 7.6, Part 4 § 4.5, Part 5 § 1.6, `E2-MANUAL-FOR-CLAUDE-CODE.md` § 5.5, Preparation Manual Part IV. **Resolution.** Each Part may cite once; *the substantive treatment* lives in Part 1 § 2.12 only; all other Parts forward-reference. **P1.**
2. **Tapu defensive paragraph.** Verbatim in Part 4 § 1.1; verbatim in `E2-MANUAL-FOR-CLAUDE-CODE.md` § 5.1.2. **Resolution.** Single source of truth in Part 4 § 1.1; the Claude Code manual references back. **P1.**
3. **Five-year-plan / *Matter of Ho* analogy.** Cited at Part 1 § 2.15, Part 2 § 1.2, Part 3 § 11.1, Part 4 § 6.2, Preparation Manual Part III, `E2-MANUAL-FOR-CLAUDE-CODE.md` § 6.3. **Resolution.** Substantive treatment in Part 2 § 1.2; others forward-reference. **P1.**

### 3.3 Cross-references that are missing

Eleven specific cross-reference gaps:

1. Part 3 § 3.4 (defensive-paragraph placement) → Part 4 § 1 (catalog). Currently absent.
2. Part 3 § 7 (RFE response craft) → Part 2 § 5 (denial rationales) and Part 2 § 2.3 (RFE category distribution). Currently absent.
3. Part 3 § 11 (sub-type adjustments) → Part 1 §§ 9.1–9.4 (sub-type regulatory anchors) and Part 2 §§ 6.1–6.4 (sub-type case-law). Currently absent.
4. Part 3 § 1 (intake protocol) → Part 4 § 2 (sub-type misclassification hazards). Currently absent.
5. Part 4 § 4.5 (gift-vs-loan) → Part 3 § 1.5 Q29 (intake). Currently absent.
6. Part 4 § 6 (renewal edge cases) → Part 3 § 10 (renewal calendar). Currently absent.
7. Part 5 § 3 (50-point diagnostic) → all four Parts at point of evidence. Currently grouped only by element, not by source-Part.
8. `E2-MANUAL-FOR-CLAUDE-CODE.md` → Parts 1–5 framework. Currently the Claude Code manual cites only cases and regulations; never the framework. **Critical** — the framework is the doctrinal floor; the manual must point to it.
9. `E2-PREPARATION-MANUAL.md` → Parts 1–5 framework. Same gap.
10. Part 1 § 1.3 NDAA § 5502 → Part 3 § 1.1 intake (currently no Q4A as recommended in § 2.1.3 above).
11. Part 2 § 8.4 open question on national-vs-Fifth-Circuit application of *Yıldız v. Garland* → Part 5 § 5 open questions registry. Currently disconnected.

**Resolution.** I will execute all 11 cross-reference insertions in the consolidation pass. **P0** for items 8–10 (foundation links); **P1** for the rest.

### 3.4 Index entries needed

The framework module needs a one-page index (`E2-FRAMEWORK-INDEX.md` per existing task #11; confirm it exists before publication). Required entries:

1. Sub-type matrix (Part 5 § 4) as primary navigation.
2. Authority allowlist by sub-type (cross-Part).
3. Defensive-paragraph catalog index (Part 4 § 1).
4. RFE pattern library index (Part 3 § 7 + the new § 7A from § 1.2 above).
5. Intake question index (Q1–Q35 + Q4A + Q35A).
6. Cross-reference table mapping framework Parts ↔ Preparation Manual ↔ Claude Code Manual.

**P0** (the index is the user's first contact with the module).

### 3.5 Structural rework before publication

Three structural items:

1. **Splitting Part 3 § 7 RFE patterns into a versioned standalone.** Per § 1.2 above, the RFE library should be `manuals/_E2-RFE-LIBRARY.md` and merge quarterly. Part 3 retains the architecture (§ 7.1) and the modal five (§§ 7.2–7.6); the standalone holds the additional 25. **P0.**
2. **Demir edge-case-score formalization.** Referenced in Part 5 § 2.2 ("Demir-graded edge-case score ≥ 3"). **Score is undefined.** Define in Part 4 § 7A: 0 = standard, 1 = single edge-case present, 2 = two compounding, 3 = three or more, 4+ = supervisor-pre-clearance. **P0.**
3. **Sub-type 2 and Sub-type 3 exemplar files.** Preparation Manual § 1.3 lists Subtypes 2 and 3 as "(firm exemplar pending)." The framework cites them throughout but the firm has no anonymized exemplar to point to. **P1.** Operations item, not blocking, but the Sub-type 2 corporate-owned and Sub-type 3 executive cases should be priority intakes for the firm's exemplar library through 2026.

---

## 4. Recommended additions (concrete + prioritized)

| # | Part / § | Summary | Words | Pri. | Evidence |
|---|---|---|---|---|---|
| R-1 | Part 3 § 4A | Form-by-form filing checklist (I-129, I-129E, G-28, G-1145, G-1650, DS-160, DS-156E, I-539, I-539A) | 2,250 | P0 | § 1.1 above |
| R-2 | `_E2-RFE-LIBRARY.md` (new) | 25 additional RFE response model templates | 12,500 | P0 | § 1.2 above; Part 2 § 2.3 |
| R-3 | Part 3 § 1.5 Q29A | At-risk loan-screen checklist at intake | 250 | P0 | § 2.1.2 above; Part 1 § 2.12 |
| R-4 | Part 3 § 1.1 Q4A | NDAA 2023 § 5502 residency intake question | 150 | P0 | § 2.1.3 above; Part 1 § 1.3 |
| R-5 | Part 3 § 3.6 | Pre-filing self-RFE checklist (top-8 categories) | 600 | P0 | § 2.2.1 above; Part 2 § 8.2 |
| R-6 | Part 3 § 1.8 | Case-acceptance decision tree | 400 | P0 | § 2.3.1 above; Part 4 § 2 |
| R-7 | Part 3 § 3.4A | Defensive-paragraph trigger-detection table | 400 | P0 | § 2.3.4 above; Part 4 § 1 |
| R-8 | Part 4 § 7A | Demir edge-case-score definition (0–4+) | 300 | P0 | § 3.5.2 above; Part 5 § 2.2 |
| R-9 | E2-FRAMEWORK-INDEX.md | One-page index | 800 | P0 | § 3.4 above |
| R-10 | Cross-reference inserts (11) | See § 3.3 list | 400 (total) | P0 (8–10) / P1 (others) | § 3.3 above |
| R-11 | Part 3 § 8A | 5 NOID model responses | 4,000 | P1 | § 1.3 above |
| R-12 | Part 3 § 6 expansion | Premium-processing decision-tree depth | 1,200 | P1 | § 1.4 above |
| R-13 | Part 3 § 5.1A | Service-center filing logistics | 800 | P1 | § 1.5 above |
| R-14 | Part 3 § 5.1B | Post-2024 USCIS process changes (currency log) | 700 | P1 | § 1.6 above |
| R-15 | Part 3 § 9A | Per-consulate interview prep memos (8 posts) | 3,200 | P1 | § 1.7 above |
| R-16 | Part 3 § 10 expansion | Post-approval handling depth (travel, AR-11, employer notice, dependent renewal, material-change taxonomy) | 1,000 | P1 | § 1.8 above |
| R-17 | Part 1 § 1.6A | Post-*Loper Bright* early-warning protocol | 400 | P1 | § 2.1.1 above |
| R-18 | Part 1 § 7.2A | FAM-citation drafter guidance memo | 300 | P1 | § 2.1.4 above |
| R-19 | Part 1 §§ 9.1A–9.4A | Per-sub-type intake calibration | 400 | P1 | § 2.1.5 above |
| R-20 | Part 2 § 4.5A | Service-center routing-memo template | 300 | P1 | § 2.2.2 above |
| R-21 | Part 3 § 11 (table addition) | Sub-type × precedent × cover-letter-section mapping | 250 | P1 | § 2.2.3 above |
| R-22 | Part 3 § 1.7 Q35A | Federal-court appealable-posture intake question | 150 | P1 | § 2.2.4 above |
| R-23 | Part 4 § 7B | Pricing-surcharge tied to edge-case score | 300 | P1 | § 2.3.2 above |
| R-24 | Part 4 § 7C | Deal-breaker red list | 400 | P1 | § 2.3.3 above |
| R-25 | Part 5 § 3 expansion | Recovery-posture column on 50-point diagnostic | 200 | P1 | § 2.4.1 above |
| R-26 | Part 5 § 5 expansion | Owner + target date on each open question | 150 | P1 | § 2.4.4 above |
| R-27 | Part 5 § 2.3 | Disagreement-escalation protocol | 250 | P2 | § 2.4.2 above |
| R-28 | Part 5 § 4 (matrix addition) | Case-load distribution row | 100 | P2 | § 2.4.3 above |
| R-29 | Global terminology pass | "Beneficiary" / "Petitioner" capitalization | (mechanical) | P2 | § 3.1.4–5 above |

**Counts.** P0 = 10. P1 = 16. P2 = 3. Total recommendations: 29. Total estimated words to be added: ~30,750.

---

## 5. Open practical questions (for Supervisor)

Operational decisions the firm has not yet locked in, surfaced for Supervisor adoption:

1. **Case-acceptance gate threshold.** What's the firm-wide rule: do we take any case where Demir's edge-case-score is < 3, or < 4, or do we case-by-case? Recommendation (Whitfield): **< 3 default, 3 = supervisor pre-clearance, 4+ = decline or refer out.**
2. **Premium-processing fee pass-through.** Do we eat the $1,685 PP fee on firm-elected premium (where the firm's calendar drives the election, not the client's), or pass through? Recommendation: **client always pays unless firm-error makes the calendar tight.**
3. **Standing CCBI / credential-evaluation vendor.** Demir Part 4 § 9 (open question) recommends WES or ECE engagement so § 1.7's "stands ready" language has substance. Supervisor decision needed.
4. **Pre-filing self-RFE protocol cost allocation.** R-5 above (the top-8 self-RFE checklist) is one additional attorney-hour per case. Build into the engagement letter or absorb as quality-control overhead?
5. **Mock-interview policy.** Part 3 § 9.4 prescribes two mocks per case. For COS-only filings (no interview), we currently skip both. Should we mandate one mock anyway as a "Q&A self-defense" exercise for the post-approval consular re-stamp visit?
6. **Mandamus standing.** Part 3 doesn't address mandamus filing posture; Part 2 § 3.2 does. Is mandamus filed in-house, referred to litigation counsel, or co-counseled? Operations decision pending.
7. **Renewal calendar telemetry.** Part 3 § 10.2 prescribes a calendar; firm currently has no telemetry on whether attorneys actually meet the milestones. Consider a quarterly review.

Consultative questions for AILA / DOS Liaison:

8. **Post-2024 online-filing E-2 expansion timeline.** What's the current as-of-date for I-129 E-2 online vs paper? Liaison ask.
9. **Premium processing for I-539 dependents.** Current carve-outs and timeline for full inclusion. Liaison ask.
10. **NDAA 2023 § 5502 implementation guidance.** Department of State has been silent on dual-national edge cases (born-treaty-country who naturalized elsewhere, then re-acquired treaty nationality). Liaison ask.
11. **Yıldız v. Garland precedential reach.** Fifth-Circuit only or de facto national? The firm's posture choice (Part 5 § 5 item 1) depends on the answer.

---

## 6. Sign-off posture

With consolidator hat: **all five Parts + Index move to publication subject to incorporating the ten P0 items in § 4.** The corpus does not need structural rework beyond the three items in § 3.5 (RFE library extraction, Demir score formalization, exemplar pipeline for Sub-types 2 and 3 — last is operations-tracked, not blocking).

Concretely, the publication pre-flight is:

1. **Resolve § 3.1 inconsistencies.** Bank-statement default; defensive-paragraph "shall"-language; PP renewal default. ~30 minutes consolidation work.
2. **Insert § 3.3 cross-references items 8–10.** Foundation links from the two practitioner manuals back to the framework. ~45 minutes.
3. **Execute R-1, R-3, R-4, R-5, R-6, R-7, R-8.** P0 Part-3 / Part-4 / Part-5 additions that close intake-stage exposure. Estimate 6–8 attorney-hours.
4. **Stand up R-2 as standalone.** `manuals/_E2-RFE-LIBRARY.md` v1 with the 25 additional templates can be Phase 2 — it does not gate publication of the framework module itself, but it should ship within 30 days post-publication. Supervisor's call.
5. **Deliver R-9 index.** One-page navigation. 1–2 attorney-hours.

P1 items can ship in a v1.1 patch ~30 days after v1.0; P2 items can ship at the next quarterly review.

**Recommended Supervisor disposition:** approve v1.0 publication conditional on P0-incorporation; queue P1s for v1.1; carry P2s as backlog. The corpus is firm doctrine on Supervisor sign-off per Part 5 § 6.

---

— Karen Whitfield, Esq.
Senior Practitioner & Lead Consolidator, AKALAN Atelier Brain Trust
2026-04-29
