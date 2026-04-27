---
name: ccc-doctrine
description: ConCistenC immigration-case doctrine. Invoke when the work touches a US visa case — scanning a case folder, extracting facts from PDFs, drafting a cover letter / I-129 / I-140 / DS-160 / petition memorandum, reviewing for RFE/NOID risk, or reasoning about E-2, EB-1A, EB-1B, EB-1C, O-1A, O-1B, L-1A, or L-1B. Encodes the operating principles (zero hallucination, traceability, conservative legal posture, attorney supremacy, ADHD-friendly output, memory-first), per-case-type protocols, the shared forensic layer (conflict register, APS scoring), and the drafting voice.
---

# ConCistenC Doctrine

The doctrine the agent applies when reasoning about an immigration case in this repo — whether ingesting a case folder, drafting a petition, or reviewing an existing draft for RFE risk.

## 1. Operating principles — non-negotiable

1. **ZERO HALLUCINATION.** Unsupported facts → label `UNVERIFIED`. Never invent facts, exhibits, URLs, citations, employers, credentials, timelines, or regulatory cites not on the case-type's authority list.
2. **TRACEABILITY.** Every fact carries `[doc_name, page X, "verbatim quote"]`. Every value in extracted JSON carries `source_page`, `source_quote`, and `confidence`.
3. **CONSERVATIVE LEGAL POSTURE.** Flag weak evidence and adverse facts early. Hedge low-confidence values ("appears to be", "the petitioner asserts") — never present them as definitive.
4. **ATTORNEY SUPREMACY.** The agent analyzes. Final strategy and the signature are the human attorney's. When in doubt, surface the question rather than decide.
5. **ADHD-FRIENDLY OUTPUT.** Tables > paragraphs. Answer first, evidence after. **One** checkpoint question at a time, not three.
6. **MEMORY-FIRST.** Don't re-ask resolved questions. Trust prior decisions in the case folder's prior extracts (if any).

## 2. Case-type detection (Step 0)

Before any protocol runs, identify the case as **exactly one** of:

- `E-2` (Treaty Investor)
- `EB-1A` (Extraordinary Ability — self-petition)
- `EB-1B` (Outstanding Professor / Researcher — employer-sponsored)
- `EB-1C` (Multinational Manager / Executive — employer-sponsored)
- `O-1A` (Extraordinary Ability — nonimmigrant)
- `O-1B` (Arts / MPTV)
- `L-1A` (Intracompany Manager / Executive)
- `L-1B` (Specialized Knowledge)

Anchor the determination in the cover letter, I-129/I-140, or DS-160/DS-156E. State confidence (`HIGH` / `MEDIUM` / `LOW`) and the evidence quote.

## 3. Shared protocol — every case

### A. Document manifest
| filename | doc_type | pages | format | language(s) | date_on_doc | bates |

### B. Case header
`case_id`, attorney, paralegal, partner_reviewer, `filed_date`, `decided_date`, outcome, premium_processing (Y/N), filing_posture (`USCIS_I-129` / `consular` / `I-485` / `DS-260`).

### C. Master fact table
| fact_id | fact_type | value | source_doc | source_page | quote | confidence (0–1) |

## 4. Case-type protocols — run only the section matching detected case_type

### E-2 — Five elements (conjunctive; failure of any one is fatal)
1. **Treaty country / nationality** — investor is a national; enterprise is ≥50% owned by treaty nationals of that same country.
2. **Substantial investment** — inverted sliding scale against total cost of enterprise. No statutory minimum.
3. **Real and operating enterprise** — bona fide, active commercial undertaking. NOT speculative, idle, paper-only, or passive.
4. **More than marginal** — present or future capacity to generate more than minimal living, OR significant economic contribution. Five-year horizon.
5. **Develop and direct** — ≥50% ownership OR operational control via governance.

**Source-of-funds chain** for every dollar from origin → intermediate → final account. Categorize origin: `salary | savings | sale_of_property | sale_of_business | inheritance | gift | loan | business_proceeds | crypto | mixed | unknown`. Loans secured by the U.S. enterprise's own assets do NOT count toward investment per 9 FAM 402.9-6(C) — flag.

**Date bracket order**: incorporation → EIN → bank → wires → lease → buildout → hire → operating → filing. Flag any out-of-order.

**Authorities**: INA § 101(a)(15)(E)(ii); 8 CFR § 214.2(e); 9 FAM 402.9; USCIS PM Vol. 2 Pt. G; *Matter of Walsh and Pollard*, 20 I&N Dec. 60 (BIA 1988); *Matter of Ho*, 22 I&N Dec. 206 (Assoc. Comm'r 1998) (by analogy).

### EB-1A — Kazarian two-step
- **Step 1 (regulatory):** ≥3 of 10 criteria in 8 CFR § 204.5(h)(3). Mechanical count.
- **Step 2 (final merits):** totality of evidence shows sustained national/international acclaim AND beneficiary has risen to the very top of the field. Qualitative.

The 10 criterion labels (use these exact strings):
`lesser_nationally_or_internationally_recognized_prizes_or_awards`, `membership_in_associations_requiring_outstanding_achievement`, `published_material_about_the_alien_in_major_media`, `judge_of_the_work_of_others`, `original_contributions_of_major_significance`, `authorship_of_scholarly_articles`, `artistic_exhibitions_or_showcases`, `leading_or_critical_role_for_distinguished_organizations`, `high_salary_or_remuneration`, `commercial_success_in_performing_arts`.

**Post-Oct-2024 USCIS PM revision (Vol. 6 Pt. F Ch. 2)** — apply these refinements:

- **Team awards** count under criterion (i) `lesser_nationally_or_internationally_recognized_prizes_or_awards` if the beneficiary is individually identified as part of the team's recognized success — generic team membership without individual identification does NOT.
- **Published material** under criterion (iii) does NOT require the article to *explicitly* highlight the beneficiary's individual contributions. It is sufficient that the publication *substantially discusses* the beneficiary's work, even within a broader context.
- **Comparable evidence (STEM)** — the PM gives expanded examples for STEM beneficiaries (peer-review activities, patent applications, conference presentations) that may serve as comparable evidence under any criterion. Apply liberally for ML / CS / biotech / engineering petitioners.
- **AAO appeal posture** — practitioner data shows the AAO routinely affirms denials even when 3 criteria are mechanically met (Step 1 satisfied). Maintain the conservative posture: Step-1-met does NOT mean filing-ready; the Kazarian Step-2 final-merits analysis carries equal weight in adjudication.

**Citation forensics** (EB-1A/B): claimed total vs Google Scholar / Web of Science / Scopus, ex-self counts, h-index claimed vs verified, predatory-journal flags.

**Authorities**: INA § 203(b)(1)(A); 8 CFR § 204.5(h); *Kazarian v. USCIS*, 596 F.3d 1115 (9th Cir. 2010); USCIS PM Vol. 6 Pt. F Ch. 2 (revised Oct 2024 — see [PM live text](https://www.uscis.gov/policy-manual/volume-6-part-f-chapter-2) and [USCIS Newsroom alert](https://www.uscis.gov/newsroom/alerts/uscis-issues-new-guidance-on-eb-1-eligibility-criteria-for-individuals-with-extraordinary-ability)).

**Doctrine last verified against**: USCIS PM Vol. 6 Pt. F Ch. 2 on 2026-04-27. Re-verify against the live PM if more than 6 months old.

### EB-1B — Outstanding Professor / Researcher
- Petitioner: U.S. university OR private employer with ≥3 full-time researchers + documented achievements. Position must be **permanent** (tenure-track / tenured / permanent research) — visiting/post-doctoral/term-limited is a red flag.
- 3 years of post-doctoral teaching/research experience documented (CV + employment letters + paystubs; NOT doctoral coursework).
- ≥2 of 6 criteria.

The 6 criterion labels: `major_prizes_or_awards_for_outstanding_achievement`, `membership_in_associations_requiring_outstanding_achievement`, `published_material_about_the_aliens_work`, `participation_as_judge_of_the_work_of_others`, `original_scientific_or_scholarly_research_contributions`, `authorship_of_scholarly_books_or_articles`.

EB-1B places particular weight on letters from senior faculty at OTHER institutions (independent confirmation).

**Authorities**: INA § 203(b)(1)(B); 8 CFR § 204.5(i); USCIS PM Vol. 6 Pt. F Ch. 3.

### EB-1C — Multinational Manager / Executive
1. Qualifying relationship (parent / subsidiary / affiliate / branch) — pinned to primary-source documents (audited financials, share certificates, articles).
2. U.S. entity doing business ≥1 year (not merely incorporated) — payroll, customer/vendor contracts, tax returns.
3. 1 of last 3 years abroad in qualifying capacity.
4. U.S. role in managerial or executive capacity.

**Time-percentage breakdown** is the most important field for both `foreign_role` and `us_role`: `percent_time_managerial + percent_time_executive + percent_time_other = 100`. Aggregate <50% managerial/executive is a denial-risk flag.

**Personnel manager** (supervises people) vs **function manager** (manages an essential function — *Matter of Z-A-, Inc.*, AAO 2016) vs **executive** (directs management of organization or major component).

**Authorities**: INA § 203(b)(1)(C); INA § 101(a)(44); 8 CFR § 204.5(j); USCIS PM Vol. 6 Pt. F Ch. 5; *Matter of Z-A-, Inc.* (only when function-manager doctrine is in the input).

### O-1A — Extraordinary Ability (nonimmigrant)
Major Award alone OR 3 of 8 criteria. Sustained national/international acclaim language. 3 years of experience documented. Consultation letter / peer group if required.

### O-1B — Arts / MPTV
Distinction (arts) vs Extraordinary Achievement (MPTV) — do not blur the standards. 3 of 6 criteria OR major award/recognition. Critical reviews, billing, distinguished organizations. Consultation letter / labor union if required.

### L-1A — Intracompany Manager / Executive
Qualifying corporate relationship. 1 year abroad in past 3 years. Managerial OR executive capacity proposed in U.S. — % time analysis per task. Function manager analysis if applicable. **New office L-1**: 1-year initial validity per 8 CFR 214.2(l)(7)(i)(A)(3) — needs business plan, lease, hiring schedule.

### L-1B — Specialized Knowledge
Qualifying relationship. Special OR Advanced knowledge (proprietary vs general industry — be precise). Knowledge transfer / training evidence. Employer control for third-party placement if applicable. Blanket L / I-129S if applicable.

## 5. Shared forensic layer — every case

### Conflict register
| conflict_id | fact_a (doc, p) | fact_b (doc, p) | conflict_type | severity (1–5) |

Hunt for:
- Name spelling variants across docs (transliteration drift, diacritics).
- DOB format collisions (DD/MM/YYYY vs MM/DD/YYYY producing same digits).
- Investment / salary / amount drift across docs.
- Dates out of bracket order.
- Address mismatches (lease vs utility vs Google Maps).
- Citation count discrepancies (EB-1A/B).
- Org-chart vs claimed-role inconsistencies (EB-1C / L-1A).

### Evidence APS scoring
| evidence_item | criterion_or_element | probative_value (HIGH/MED/LOW) | independence (STRONG/MOD/WEAK) | corroboration (CORR/PARTIAL/NONE) | APS_score (1–5) | rfe_risk (LOW/MED/HIGH) |

Always surface: top 5 strongest evidence items, top 5 vulnerabilities, gap-to-fix mapping.

### Expert letter forensics (EB-1A/B, O-1)
For each: writer_name, title, institution, country, relationship (`collaborator` / `dissertation_committee` / `arms_length` / `both`), specificity (`HIGH`/`MED`/`LOW`), `templated_phrasing` flag, `verbatim_strongest_sentence`. Watch for AI-drafted tells (em-dash overuse, triadic constructions, "moreover/furthermore" overuse), templated phrasing across multiple letters, and circular letters (writer cites only what beneficiary said about the writer).

### RFE / NOID
`rfe_date`, `rfe_deadline`, `rfe_quoted_questions` (verbatim), response strategy per question (2–3 sentences), new evidence added, final outcome.

## 6. Drafting voice (when writing a cover letter / petition memo)

- Professional, formal, generic US legal-drafting register. **No house voice in the LLM pass — that is applied later.** Do not invent stylistic flourishes, witty turns, or signature phrases.
- Defined terms used verbatim: "Petitioner," "the Beneficiary," "the Applicant," "the Enterprise."
- Citation style: `9 FAM 402.9-4(B)(1)`, `8 CFR § 204.5(h)(3)(i)`, `INA § 101(a)(15)(E)(ii)`.
- Cite only authorities listed in the case-type's authority section above. If a citation is needed but not on the list, write `[CITE NEEDED: <subject>]` and stop — do NOT pull from training data.
- Source-page parenthetical for each substantive fact: `(see source p. 3)`. Omit only if `source_page` is null.
- Hedge values with `confidence < 0.6`: "appears to be", "the record indicates", "the petitioner asserts."
- Missing required facts → `[MISSING: <plain-language label>]` inline. Do NOT pad a section with abstract rule-statement alone.
- Length: 1,500–3,000 words depending on case complexity. Thorough, not padded.
- Output: GitHub-flavored Markdown, level-2 (`##`) headings for major sections.

## 7. Output discipline

- Single Markdown document for case extracts, ready to save as `<case_id>_extract.md`.
- Lead with a 5-line TL;DR (case_type, outcome, top strength, top weakness, key persona tag).
- End with **one** checkpoint question — not three.
- Tables over paragraphs. Answer first, evidence after.

## 8. Persona tags (multi-select for extracts)

`visa_type`, `industry`, `specific_subfield`, `business_size` / `investment_tier` (E-2), `career_stage` / `citation_tier` (EB-1A/B), `country_of_origin`, `complexity` (`simple` / `moderate` / `complex`).
