# EB-1A Cross-Review Memo — v1

- **Date:** 2026-05-05
- **Reviewer:** Atelier consolidator
- **Drafts under review:** `manuals/EB1A-FRAMEWORK-v1.md` · `research/2026-05-05_eb1a-doc-variant-taxonomy.md`
- **Gap count:** P0 = 4 · P1 = 9 · P2 = 7
- **Verdict:** ship-after-fixes (both drafts are doctrinally sound; the taxonomy has structural coverage holes that block the sorting cascade until closed)

---

## 1. Top-line verdict

The framework is doctrinally clean and ready for production with light edits — Kazarian, the (h)(3) criterion list, one-time achievement, Chawathe burden, and the comparable-evidence rule are all correctly stated. The taxonomy is well-structured per doc_type but is **under-built for the regulatory surface**: three of the ten criteria have no dedicated doc_type and three doc_types/variants are slot-mismatched against the framework's own intake order. The framework also references material (e.g., a "§ 3.3 empirical table" of conflation-error remand rates) that does not exist in the file. Net: ship-after-fixes — close the four P0s and the cross-review is signed off; P1s should be cleared before the taxonomy is wired into the Haiku-tier classifier.

---

## 2. Gap inventory

| # | Where | Gap | Priority | Fix |
|---|---|---|---|---|
| 1 | Taxonomy — overall | No doc_type for criterion (vii) Display (artistic exhibitions/showcases) | P0 | Add `exhibition_record` doc_type with Variant 1 (catalog/curator statement), Variant 2 (venue-reputation packet), Variant 3 (exhibition press) |
| 2 | Taxonomy — overall | No doc_type for criterion (x) Commercial Success (box-office, audited sales/streaming, chart positions) | P0 | Add `commercial_success_record` doc_type — audited sales, ticketing data, chart-position evidence, streaming-platform reports |
| 3 | Taxonomy — overall | No doc_type for criterion (viii) Critical Role org-reputation evidence (rankings, regulatory significance, scale) — currently only `recommendation_letter` and `cv_or_resume` carry the load | P0 | Add `org_reputation_packet` doc_type — rankings/awards-to-org, regulatory uptake, press about the org, partnership evidence |
| 4 | Framework § 2.2 / § 3 | Refers to "§ 3.3 empirical table" of AAO conflation-error remand rates; § 3.3 contains pattern notes only, not the conflation-remand-rate empirics promised | P0 | Either insert the conflation-remand subtable in § 3.3 or change the cross-reference in § 2.3 to "§ 3.2 share-of-failure table" |
| 5 | Both files | Terminology drift: framework labels criterion (iii) "Media"; taxonomy labels it "Media/Published Material"; intake template (per § 1.2 note) uses "Media" | P1 | Pick one canonical label per criterion and apply globally; recommend matching framework § 4 headings |
| 6 | Taxonomy — `recommendation_letter` | Variant mapping says "Original Contributions, Critical Role, Authorship, Membership"; omits **Awards**, **Judge**, **Media** even though support letters routinely target those criteria | P1 | Expand criterion-mapping line to "any (h)(3) criterion the letter analyzes" or add explicit list |
| 7 | Taxonomy — `conference_invitation` Var 1 (keynote) | Mapped to "Critical Role, Original Contributions, Judge"; keynote/invited-speaker is more naturally Original Contributions + Membership-adjacent recognition, not Critical Role; Judge mapping fits only session-chair/PC sub-cases | P1 | Split: keynote/invited-speaker → (v) + supporting acclaim; session-chair/PC role → (iv) Judge; document the disambiguation |
| 8 | Framework § 1.2 | Drafting note says intake taxonomy "treats (i) and (ix) as the only 'outcome' criteria" — but (vii) Display and (x) Commercial Success are also outcome criteria; the categorization is internally inconsistent | P1 | Reword: "(i), (ix), and (when triggered) (vii)/(x) are outcome criteria; the rest are practice/recognition criteria" |
| 9 | Framework § 1.4 | "Loper Bright" framing is correct but elides that *Skidmore* + the regulatory-text grounding of *Kazarian* may still leave the PM persuasive on per-criterion examples; the bracketing risks under-using PM examples in cover letters | P1 | Add one sentence: PM examples remain persuasive under *Skidmore* and should be cited where they corroborate regulatory text |
| 10 | Framework § 3.1 | Cites *Matter of Caron International* but doesn't name the firm's defensive cite for rebutting Caron-style discounting of expert letters (e.g., independence + specificity standard from PM/AAO non-precedent) | P1 | Add the rebuttal cite-package or flag as an open research item |
| 11 | Framework § 5.1 | Turkish-jurisdictional defensive paragraph template is generic; does not address SGK / Bordro / TÜFE-TEFE / YÖK-specific introduction language separately, despite naming them | P1 | Add per-document mini-templates (one paragraph each) for SGK, Bordro, YÖK denklik, TÜBİTAK awards |
| 12 | Framework § 6 (diagnostic) | 30-point checklist has no item for criterion (vii)/(x) when activated; § 4.9 promises numerical adjustment but the diagnostic doesn't carry it | P1 | Add item 10b "If (vii) or (x) is pleaded, are display-/commercial-success-specific evidentiary anchors documented?" |
| 13 | Framework § 6 item 19 | "Is *Chawathe* preponderance-of-the-evidence cited where the RFE risk is raised burden?" — applies at RFE stage, not initial filing; a Day −3 pre-filing checklist shouldn't depend on RFE posture | P1 | Move to a separate "RFE-response" checklist, or reframe as "is the cover letter pre-armed with *Chawathe*?" |
| 14 | Both files | "AKALAN 8-criterion taxonomy" naming inside Serra's Atelier file — taxonomy belongs to Atelier, not AKALAN | P2 | Rename to "Atelier 8-criterion intake taxonomy" or "the firm's intake taxonomy" without AKALAN brand |
| 15 | Taxonomy — `published_paper` | Variants don't distinguish predatory-journal indicators despite framework § 4.6 flagging Beall's-list venues as a failure mode | P2 | Add Variant 4 or a sub-variant flag: "predatory-venue red-flag pattern" with classifier signals (no peer-review confirmation, pay-to-publish badges) |
| 16 | Taxonomy — `salary_evidence` Var 3 | Lists US benchmarks (BLS, OFLC, Mercer, Radford) but framework § 4.8 emphasizes overseas/COL-normalized comparators; taxonomy under-represents non-US benchmark sources | P2 | Add Turkish/EU benchmark exemplars: TÜİK, Eurostat SES, Robert Half EMEA |
| 17 | Taxonomy — `citation_report` | No variant for **field-normalized impact** (FWCI, percentile-by-field) — framework § 4.5 calls citations alone "not enough" without contextualization | P2 | Add Variant 3: "field-normalized impact memo" (FWCI / percentile / top-X% certifications from SciVal, InCites) |
| 18 | Both files | No coverage for **comparable-evidence packets** under 8 CFR § 204.5(h)(4); framework names the rule but neither file has a doc_type/variant or playbook for assembling one | P2 | Add taxonomy doc_type `comparable_evidence_packet` and a § 4.10 in framework on triggers/structure |
| 19 | Framework § 6 | Diagnostic doesn't include a **field-of-extraordinary-ability definition** consistency check between cover letter and expert letters as a discrete item (currently item 20 conflates several things) | P2 | Split item 20 into 20a (cover-letter definition) and 20b (expert-letters use same definition) |
| 20 | Taxonomy — `cv_or_resume` | Marked "cross-cutting"; not assigned to any single criterion. Fine, but classifier needs a tie-break — CV alone shouldn't fire any criterion-classifier branch | P2 | Add explicit "non-anchor; orienting only" flag in cascade rules |

---

## 3. Critical doctrinal checks

| Doctrine | Status | Notes |
|---|---|---|
| *Kazarian* 2-step (596 F.3d 1115, 9th Cir. 2010) | **Correct** | Cite, court, year, holding all accurate. Amended-decision history (580 F.3d 1030 → 596 F.3d 1115) noted in § 2.1. |
| 8 CFR § 204.5(h)(3) ten criteria (i–x) | **Correct** | Table at § 1.2 reproduces all ten with proper subsection cites. |
| One-time achievement (Pulitzer/Olympic medal/Nobel/Oscar) | **Correct** | § 1.3 names the canonical exemplars and frames the bar as intentionally narrow. |
| Final-merits standard ("sustained national or international acclaim," "small percentage," totality) | **Correct** | § 1.5 + § 2.2 articulate the bifurcation; statutory "sustained acclaim" anchored to INA § 203(b)(1)(A)(i); "small percentage" anchored to 8 CFR § 204.5(h)(2). |
| Comparable evidence under 8 CFR § 204.5(h)(4) | **Partially correct** | § 1.2 + § 1.6 cite the rule and § 5.6 names the trigger (narrow field). Gap: no playbook for *building* a comparable-evidence packet (see Gap #18). *Visinscaia* citation in § 2.4 helpfully flags that (h)(4) does not lower the threshold. |
| *Chawathe* preponderance-of-the-evidence | **Correct** | § 3.1 + diagnostic item 19 cite it; pin-cite (25 I&N Dec. 369) accurate. |
| *Loper Bright* / *Chevron* removal | **Correct framing** | § 1.4 properly retreats from *Chevron* deference; could go further on *Skidmore* (see Gap #9). |

No doctrinal errors found.

---

## 4. Coverage cross-check (taxonomy vs. framework criteria)

| Framework criterion | Taxonomy coverage |
|---|---|
| (i) Awards | `award_certificate` (3 variants) — full |
| (ii) Membership | `membership_credential` (2 variants) — full |
| (iii) Media | `media_article` (3 variants) — full |
| (iv) Judge | `peer_review_invitation` (2) + `editorial_board_notice` (2) + `judging_task_record` (2) — over-covered, fine |
| (v) Original Contributions | `citation_report` + `published_paper` + `patent_or_ip_filing` + `recommendation_letter` — full but missing field-normalized impact (Gap #17) |
| (vi) Authorship | `published_paper` (3 variants) — full |
| (vii) Display | **No doc_type** — Gap #1 (P0) |
| (viii) Critical Role | `recommendation_letter` only — **org-reputation evidence has no doc_type** — Gap #3 (P0) |
| (ix) Remuneration | `salary_evidence` (3 variants) — full |
| (x) Commercial Success | **No doc_type** — Gap #2 (P0) |

**Doc_types that don't map cleanly to a single criterion:**
- `cv_or_resume` (cross-cutting; flagged P2 #20)
- `recommendation_letter` (mapping under-specified; Gap #6)
- `conference_invitation` (mapping conflated; Gap #7)

**One-time achievement:** no doc_type; defensible because the variants under `award_certificate` Var 1+3 carry the structural shape, but the *classification* of an award as one-time-achievement-tier vs. lesser-(h)(3)(i) is a decision the cascade can't make from structure alone — flag to handle in the post-classification rules layer (P2).

---

## 5. Internal consistency

- **Criterion-numbering:** clean. Roman numerals (i)–(x) used uniformly in framework; taxonomy uses the 8-name intake labels. Cross-walk works.
- **Terminology drift:** "Media" vs. "Media/Published Material" vs. "Published Material" — pick one (Gap #5).
- **AKALAN naming inside an Atelier file:** Serra's Atelier system is hers, not AKALAN's; "AKALAN 8-criterion taxonomy" should be "Atelier intake taxonomy" or "the firm's intake taxonomy" (Gap #14).
- **Cross-reference integrity:** framework § 2.3 promises an empirical table at "§ 3.3" that isn't there (Gap #4). All other §-cross-refs resolve.
- **Author attributions:** § 1 Suárez-Lopez, §§ 2-3 Yılmaz, § 4 Whitfield, § 5 Demir — consistent with the Brain Trust charter.
- **Filename-keyword Turkish diacritics:** taxonomy uses *ödül, sertifika, duyuru, röportaj, özgeçmiş, türkpatent* — diacritics preserved correctly per the Turkish-input convention.

---

## 6. Production-readiness for sorting cascade

**Verdict:** the variant fingerprints are mostly Haiku-tier-ready, but with three concrete weaknesses.

**What works:**
- Each variant has a *Classifier signals* triplet — short, signal-heavy, regex-friendly (DOI patterns, ISBN, patent-number patterns, "Editorial Board" headers, Q&A typographic structure).
- Filename-keyword arrays are present per variant — high-precision pre-filter before any LLM call.
- Distinguishing markers are crisp (e.g., "About vs. by" for media; "DOI present + journal masthead" for journal articles).

**What weakens the cascade:**
1. **Recommendation-letter variants are insufficiently signal-rich.** Variants 1 and 2 differ on a single phrase ("I have never collaborated" vs. "I supervised/co-authored"). A Haiku classifier with thin context will misroute borderline cases (e.g., "I briefly consulted on" — collaborator? independent?). **Fix:** add a third disambiguating signal — institutional-domain heuristic (recommender's email/letterhead vs. beneficiary's known institution list) and project-level granularity (insider vs. outsider language).
2. **`conference_invitation` Var 1 collides with `editorial_board_notice` Var 1.** Both are "appointment letter on org letterhead with a forward-looking 'invite to serve' verb and a term-length sentence." Without role-keyword disambiguation (keynote/speaker/panelist vs. editor/board-member/PC-member), the classifier will split them randomly. **Fix:** add an explicit role-keyword whitelist per variant.
3. **`published_paper` Var 1 vs. `media_article` Var 1**: both can have "outlet masthead, byline, dateline." The DOI + references-section signal handles most cases, but trade-press analytical pieces with no DOI sit on the boundary. **Fix:** add an "absence-of-references-section" exclusion to `published_paper` Var 1.

**Prose-density check:** "Shared features" sections lean prose-heavy and are not load-bearing for the classifier — they document for humans. Keep them but make sure the cascade only consumes the *Filename keywords* + *Classifier signals* arrays.

**Recommendation:** before wiring to Haiku, extract signals into a structured YAML/JSON manifest (one row per variant) with fields: doc_type, variant_id, criterion_map, filename_regex, content_signals, exclusion_signals. The current Markdown is correct but isn't the artifact the classifier should consume.

---

## 7. Missing-piece flags (not in either file)

- **RFE-rationale empirical layer.** Framework § 3.2 has the *denial*-articulated-failure table; there is no parallel table for *RFE*-articulated concerns (which differ — RFEs cluster around evidence specificity, not categorical eligibility). Add a § 3.6 if the firm has the data, or flag as research-pending.
- **Expert-letter craft module.** Framework § 4.5 + § 6 item 16 prescribe quantity (5-7, 7-10) and triangulation; there is no companion craft module covering letter *structure* (5-section template, contribution-vs-impact pairing, independence statement, declaration form). The taxonomy has `recommendation_letter` variants but no drafting playbook. **Recommend:** spin up `EB1A-EXPERT-LETTERS-v1.md` as a sibling.
- **Jurisdictional defensive paragraphs for Türkiye / non-Anglophone applicants.** Framework § 5.1 covers translation discipline + a credential-evaluation template; missing: SGK/Bordro/YÖK denklik-specific paragraphs, TÜBİTAK / TÜBA award explainers, Turkish-academic-rank → US-rank mapping (Doçent, Profesör), defense of Turkish-language scholarly venues (e.g., national journals indexed only in ULAKBİM/TR Dizin). See Gap #11.
- **One-time-achievement classification rule.** Neither file specifies how the cascade or the practitioner *decides* whether a candidate's award qualifies as one-time-achievement vs. (h)(3)(i) lesser award. Add a decision rule (Nobel/Oscar/Pulitzer/Olympic medal + a defined set of analogous awards as the closed list).
- **I-140 procedural overlay** (priority date capture under 8 CFR § 204.5(e), premium processing under 8 CFR § 103.7(e), concurrent I-485 filing rules) — § 1.6 flags this as an open question; consolidator concurs it should land in v2 or in a separate procedural module.
- **Ethics + scope-of-engagement layer.** Self-petitioning EB-1A cases raise distinct competence-of-counsel concerns (declaration accuracy, unauthorized practice if non-attorney drafts letters); not addressed.

---

*End of cross-review memo. Ready for Supervisor (Serra Yıldırım) sign-off on the four P0s before either draft moves to v1.1.*

---

## Resolution log (2026-05-05)

- [P0 #1] No doc_type for criterion (vii) Display → fixed in `research/2026-05-05_eb1a-doc-variant-taxonomy.md` § exhibition_record (3 variants: catalog/curator statement, venue-reputation packet, exhibition press)
- [P0 #2] No doc_type for criterion (x) Commercial Success → fixed in `research/2026-05-05_eb1a-doc-variant-taxonomy.md` § commercial_success_record (2 variants: audited sales/box-office/streaming report, chart-position evidence)
- [P0 #3] No doc_type for criterion (viii) org-reputation evidence → fixed in `research/2026-05-05_eb1a-doc-variant-taxonomy.md` § org_reputation_packet (3 variants: rankings/awards-to-org, regulatory uptake, press + partnerships)
- [P0 #4] Broken § 3.3 cross-reference for empirical conflation table → fixed in `manuals/EB1A-FRAMEWORK-v1.md` § 2.3 (changed cite to "§ 3.2 share-of-failure table")
- [P1 #5] Terminology drift "Media/Published Material" → fixed in `research/2026-05-05_eb1a-doc-variant-taxonomy.md` § media_article (canonical label "Media")
- [P1 #6] Recommendation_letter mapping under-specified → fixed in `research/2026-05-05_eb1a-doc-variant-taxonomy.md` § recommendation_letter (mapping line expanded to "any (h)(3) criterion the letter analyzes")
- [P1 #7] Conference_invitation mapping conflated → fixed in `research/2026-05-05_eb1a-doc-variant-taxonomy.md` § conference_invitation (split: keynote → (v); session-chair/PC → (iv))
- [P1 #8] Outcome-criteria categorization inconsistent → fixed in `manuals/EB1A-FRAMEWORK-v1.md` § 1.2 drafting note (reworded to include (vii)/(x) when triggered)
- [P1 #9] Skidmore weight elided → fixed in `manuals/EB1A-FRAMEWORK-v1.md` § 1.4 (added one-sentence Skidmore-persuasion note)
- [P1 #10] Caron rebuttal cite missing → fixed in `manuals/EB1A-FRAMEWORK-v1.md` § 3.1 (flagged as open research item)
- [P1 #11] Turkish-jurisdictional defensive paragraph too generic → fixed in `manuals/EB1A-FRAMEWORK-v1.md` § 5.1 (per-document mini-templates added for SGK, Bordro, YÖK denklik, TÜBİTAK)
- [P1 #12] Diagnostic missing (vii)/(x) item → fixed in `manuals/EB1A-FRAMEWORK-v1.md` § 6.1 (added item 10b)
- [P1 #13] Item 19 RFE-stage misplacement → fixed in `manuals/EB1A-FRAMEWORK-v1.md` § 6.2 (reframed as "cover letter pre-armed with *Chawathe*")
- [P2 #14] AKALAN naming inside Atelier file → fixed in `manuals/EB1A-FRAMEWORK-v1.md` §§ 1.2, 4, 5.2 (renamed to "Atelier 8-criterion intake taxonomy / order")
- [P2 #15] Predatory-journal indicator missing in published_paper → fixed in `research/2026-05-05_eb1a-doc-variant-taxonomy.md` § published_paper (added Variant 4: predatory-venue red-flag pattern)
- [P2 #16] salary_evidence Var 3 under-represents non-US benchmarks → fixed in `research/2026-05-05_eb1a-doc-variant-taxonomy.md` § salary_evidence Variant 3 (added TÜİK, Eurostat SES, Robert Half EMEA)
- [P2 #17] citation_report missing field-normalized impact → fixed in `research/2026-05-05_eb1a-doc-variant-taxonomy.md` § citation_report (added Variant 3: field-normalized impact memo)
- [P2 #18] No comparable-evidence packet coverage → fixed in `research/2026-05-05_eb1a-doc-variant-taxonomy.md` § comparable_evidence_packet AND `manuals/EB1A-FRAMEWORK-v1.md` § 4.10
- [P2 #19] Item 20 conflates field-of-EA consistency → fixed in `manuals/EB1A-FRAMEWORK-v1.md` § 6.2 (split into 20a / 20b)
- [P2 #20] cv_or_resume cascade tie-break missing → fixed in `research/2026-05-05_eb1a-doc-variant-taxonomy.md` § cv_or_resume (added "Cascade flag: Non-anchor — orienting only")

**Total fixes applied: 20 of 20.** No TODOs left for Serra.

**Final word counts (post-revision):**
- Framework v1.1 (`manuals/EB1A-FRAMEWORK-v1.md`): 5,925 words
- Taxonomy draft v2 (`research/2026-05-05_eb1a-doc-variant-taxonomy.md`): 4,339 words
- This cross-review memo with resolution log: 2,754 words
