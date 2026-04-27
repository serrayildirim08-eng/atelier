# E-2 Sub-Type Comparison — Camural vs. Kacar-Salih

> **Critical finding:** the two filings handed to ConCistenC are NOT the same E-2 case
> type. They differ in legal sub-category, beneficiary role, who signs the cover letter,
> what evidence is needed, and what voice the firm writes in. The current
> `E2-MANUAL-FOR-CLAUDE-CODE.md` was calibrated to Kacar-Salih only and does NOT
> cover the Camural pattern. This comparison document explains what changes.

---

## 0. The two E-2 sub-types

| Aspect | Kacar-Salih | Camural |
|---|---|---|
| **Filed** | 2026-01-07 | 2024-02-08 |
| **Sub-category** | E-2 **Treaty Investor** (individual) | E-2 **Specialized Knowledge Employee** of treaty enterprise |
| **Beneficiary role** | The investor / 50% owner / President | An employee being sponsored by the treaty enterprise |
| **Petitioner** | The LLC (small restaurant) | A corporate enterprise (Pomega Energy Storage Tech Inc.) |
| **Investment size** | $120,000 individual | $4,000,000 corporate parent → subsidiary |
| **Cover letter author** | The law firm (Akalan letterhead) | The Petitioner itself (Pomega corporate letterhead, signed by VP HR Jason Lewis) |
| **Source of funds** | Personal lawful sources (property sale + rental) | Corporate parent (Pomega Turkey via Vakifbank → Citibank) |
| **Authority cited** | 9 FAM 402.9-4 to -7 (the investor elements) | Same elements PLUS 9 FAM 402.9-7(2) (specialized knowledge) and 8 CFR 214.2(e)(18) (essential skills employees) |
| **Dependents** | I-539 spouse + 3 children | None in this filing (beneficiary on prior B-2) |
| **Has SOF chain?** | Yes, individual lawful trace | No — single corporate wire, no individual SOF |
| **Defensive paragraphs** | Tapu, TEFE/TUFE, spouse-named lease | None (corporate funding is straightforward) |

The manual must distinguish these from Phase 0 (case detection).

---

## 1. Tab structure — Camural's A-H is shorter and re-ordered

| Tab | Camural Heading | Tab | Kacar-Salih Heading |
|-----|-----------------|-----|---------------------|
| A | **Table of Contents AND Cover Letter** (combined) | A | Forms |
| B | **Forms** (G-1145, G-28, I-129, I-129E + Job Offer Letter) | B | Cover Letter |
| C | **Applicant Information** (Passport, Visa, I-94, Resume, Prior Work, Diploma, Certificates, LoR) | C | Treaty Qualification |
| D | **Intent to Depart** | D | Ownership History |
| E | **Nationality of the Investor** (Shares + Owners' passports) | E | Investment SOF/Transfer/AtRisk |
| F | **Ownership** (Turkish + US entity docs, both org charts) | F | Substantiality |
| G | **Investment** (Vakifbank wire + Citibank receipt + Balance Sheets) | G | Marginality |
| H | **Real and Operating** (catalogues, customer agmts, lease, land purchase, payroll, P&L) | H | Develop & Direct |
| — | (no dependent tabs) | I-L | NOID + Dependents |

**Implication:** the agent must classify the filing's sub-type FIRST, then choose a Tab map.

---

## 2. Cover-letter section structure — different drafting model

### Camural (Petitioner-authored, ALL CAPS sections)

```
[Opening: parties, request, beneficiary background]
INVESTMENT, ESTABLISHMENT, OWNERSHIP AND CONTROL
DOING BUSINESS
PREMISES
OPERATING PERSONNEL
FINANCIAL SITUATION AND FUTURE PLANS
THE BENEFICIARY'S PROSPECTIVE ROLE
BENEFICIARY'S EMPLOYMENT HISTORY AND QUALIFICATIONS
CONCLUSION
[Signature: VP HR — Pomega corporate letterhead]
```

### Kacar-Salih (firm-authored, Roman numerals)

```
I.    INTRODUCTION
II.   QUALIFICATION UNDER A TREATY OF COMMERCE AND NAVIGATION
III.  OWNERSHIP STRUCTURE AND CORPORATE HISTORY
IV.   THE INVESTMENT: SOURCE, TRANSFER, AND AT-RISK COMMITMENT OF FUNDS
V.    SUBSTANTIALITY OF THE INVESTMENT
VI.   MARGINALITY AND ONGOING COMMERCIAL ACTIVITY
VII.  ROLE OF THE BENEFICIARY: DEVELOPING AND DIRECTING
VIII. CONCLUSION
[Signature: attorney — Akalan letterhead]
```

**Implication:** drafter must produce TWO templates, picked by sub-type.

---

## 3. Voice patterns — Camural is corporate marketing; Kacar-Salih is paralegal-tight

### Camural voice signatures (verbatim)

> "Pomega has now responded to the substantial electricity demands of the U.S.
> market with a massive initiative: the company has decided to replicate its
> advanced energy and lithium-ion battery production facility, an engineering
> marvel located in Ankara…"

> "Distinguished figures such as Senator Lindsey Graham and President Biden
> have taken a keen interest in the project, actively monitoring its progress…"

> "Owing to his extensive knowledge, experience, and expertise, Mr. Camural
> has been compensated significantly above the industry standard."

**Voice features:**
- Corporate "we" / "our" pronouns
- Marketing-flavored adjectives ("engineering marvel", "ambitious undertaking")
- Name-drops politicians + IRA + tax credits
- Financial metrics integrated narratively (IRR, DSCR, breakeven month)
- SWOT analysis style content
- Industry-specific jargon (LFP cells, BESS, EPC, GWh)
- Personal endorsement quotes (Letter of Recommendation excerpts inline)
- Salary comparison narrative ("nearly triple peers")

### Kacar-Salih voice signatures (verbatim — for contrast)

> "Accordingly, the Petitioner is properly and lawfully structured to support
> E-2 Treaty Investor classification."

> "Under Turkish law and customary practice, real property transfers are
> effected directly through the Land Registry Office (Tapu Mudurlugu)…"

**Voice features:**
- Defined terms ("the Beneficiary", "the Petitioner")
- Each section ends with "Accordingly, [element] is satisfied under INA §… and 9 FAM…"
- Inline `(Exhibit: …)` parenthetical citations
- Defensive cultural/legal paragraphs BEFORE foreign exhibits
- Conservative, evidence-first prose
- No marketing language

**Implication:** the AI drafter must hold TWO voice profiles, not one.

---

## 4. New document types not in current manual

The manual's Section 13 lists 22 skills calibrated to Kacar-Salih's docs. Camural
introduces these new types:

| New doc type | Section in Camural | Why critical | Suggested skill |
|---|---|---|---|
| **Job Offer Letter** | Tab B | Anchors the role being offered + compensation | `job-offer-extractor` |
| **Resume / CV** (deep) | Tab C | Specialized knowledge proof | extend `cv-extractor` |
| **Beneficiary's Prior Work and Service Record** | Tab C | Salary differential proof (TRY 140K vs TRY 45K avg) | `service-record-extractor` |
| **Diploma** | Tab C | Education credential | `credential-extractor` |
| **Certificates** | Tab C | Industry certifications corroborating specialized knowledge | extend `credential-extractor` |
| **Letter of Recommendation** | Tab C | Third-party validation of beneficiary's specialized skill | `recommendation-letter-extractor` |
| **Foreign-entity corporate documents** | Tab F | Parent-subsidiary relationship for treaty enterprise | `foreign-corporate-doc-extractor` |
| **Shares Certificate** (foreign) | Tab F | Treaty-country ownership of parent | extend `corporate-doc-extractor` |
| **Org chart of foreign entity** | Tab F | Parent enterprise structure | extend `org-chart-extractor` |
| **Project Catalogue** | Tab H | Real-and-operating proof + scale demonstration | `project-catalog-extractor` |
| **Product Catalogue** (Kontrolmatik, E-House) | Tab H | Product range proof | merge with project-catalog |
| **Customer Offtake Agreement** (POWIN $1B) | Tab H | Future revenue proof | `customer-contract-extractor` |
| **Vendor Equipment Invoice** (JS Machine $1.38M) | Tab H | At-risk capital deployment | extend `invoice-extractor` |
| **Land Purchase Agreement** | Tab H | Real-property-acquisition proof for plant | `real-estate-purchase-extractor` |
| **Government Incentive Documents** (PTC, IRA, state credits) | inline mention | Substantiality + economic-impact context | `incentive-document-extractor` |

Estimated new skill count: **~10 net-new** skills + **~5 extensions** to existing.

---

## 5. Specialized-knowledge proof — the core legal pivot

For an E-2 Investor (Kacar-Salih), the agent proves:

1. Treaty country nationality
2. Substantial investment, lawful + at-risk
3. Real & operating enterprise
4. More than marginal
5. Develop & direct

For an E-2 Specialized Knowledge Employee (Camural), the agent ALSO proves the
treaty enterprise's qualification (mostly inherited from the parent's own E-2
filing), but the **employee-specific element** is:

> The beneficiary possesses **specialized knowledge** essential to the
> efficient operation of the enterprise, and that knowledge is **not readily
> obtainable** in the U.S. labor market. *9 FAM 402.9-7(2); 8 CFR 214.2(e)(18).*

The agent must extract:

- **Years of relevant experience** (Camural: 10+ years, energy sector)
- **Specific industry / equipment expertise** (Camural: AIS + GIS, medium voltage equipment, energy storage)
- **Geographic specialization** (Camural: UK, Nordic, Baltic, Middle East, KSA, Iraq, Lebanon, Egypt, Libya, Pakistan, Bangladesh)
- **Quantified achievement** (Camural: doubled annual sales target at SIEMENS in 2022)
- **Salary differential vs domestic peers** (Camural: TRY 140K vs TRY 45K Turkish average ~3x peers)
- **Education credentials** (degree from accredited institution)
- **Industry certifications** (specialized to the role)
- **Third-party validation** (LoR from prior senior manager — direct quote)
- **Prior international travel and assignments** (multinational seasoning)

These map to a **new schema variant**: `SpecializedKnowledgeBeneficiaryFacts`.

---

## 6. Source-of-funds model — completely different

Kacar-Salih SOF:
```
Origin (property sale + rental income)
  → Personal account (TRY)
  → Currency conversion (TRY → USD)
  → International wire to US personal account
  → Deployment to Petitioner (or co-owner)
```

Camural SOF (corporate, much simpler):
```
Origin: parent company's corporate funds (Pomega Turkey)
  → Single international wire ($4M)
    Vakifbank account ***068
      → Citibank account ***457 (Pomega US)
  → Deployed: $2.55M fixed assets (Q2 2023), then accumulating
```

**Key difference:** corporate-funded E-2 doesn't need individual lawful-source
tracing. It needs:
- Parent-subsidiary corporate relationship proof
- Single wire confirmation
- Deployment evidence (fixed-asset purchases, payroll, vendor invoices)
- Balance-sheet snapshots over time

The manual's SOF chain table format does NOT fit corporate funding; a separate
**Corporate Funding Schema** is needed.

---

## 7. Updated agent decision tree (Phase 0)

```
[PDF folder dropped]
   │
   ▼
Detect: case_type ∈ {E2_INVESTOR, E2_EMPLOYEE_SPECIALIZED, E2_EMPLOYEE_EXEC, EB1A, …}
   │
   ├─ E2_INVESTOR ──► Tab map A-L, attorney-voice drafter, individual SOF chain
   │
   ├─ E2_EMPLOYEE_SPECIALIZED ──► Tab map A-H, petitioner-voice drafter, corporate funding,
   │                              specialized-knowledge schema, parent-entity inheritance
   │
   ├─ E2_EMPLOYEE_EXEC ──► same as above + executive-supervisory schema (manual entry needed)
   │
   ├─ EB1A / EB1B / EB1C / O1A / O1B / L1A / L1B ──► other manuals
```

**Detection signals (Haiku-tier classifier prompt should look for):**

| Signal | Points to |
|---|---|
| Cover letter on **firm letterhead** with Roman-numeral sections | E2_INVESTOR |
| Cover letter on **petitioner letterhead** with ALL CAPS section heads | E2_EMPLOYEE |
| "REQUESTED CLASSIFICATION: E2 — SPECIALIZED KNOWLEDGE" | E2_EMPLOYEE_SPECIALIZED |
| "REQUESTED CLASSIFICATION: E2 — EXECUTIVE/SUPERVISORY" | E2_EMPLOYEE_EXEC |
| Beneficiary listed as 50%+ owner | E2_INVESTOR |
| Beneficiary listed as new hire / role offered | E2_EMPLOYEE |
| Job Offer Letter present in Tab B | E2_EMPLOYEE |
| SOF chain narrating personal sources | E2_INVESTOR |
| Single corporate wire from parent | E2_EMPLOYEE |
| I-539 / I-539A for spouse + children | E2_INVESTOR (with dependents) |
| No I-539 / no dependents | E2_EMPLOYEE (often) |

---

## 8. Camural worked example (regression-test fixture)

| Field | Value |
|-------|-------|
| Petitioner | Pomega Energy Storage Technologies Inc. (Delaware, formed Feb 17, 2023) |
| Petitioner HQ | 8260 Greensboro Drive, Suite 390, McLean, VA 22102 |
| Beneficiary | Onur Camural (Turkish national) |
| Beneficiary status at filing | B-2 (visiting) |
| Requested classification | E-2 Specialized Knowledge |
| Proposed role | Medium Voltage Sales Specialist |
| Reports to | Louis Caso (VP Business Development) |
| Validity requested | March 15, 2024 → March 15, 2026 |
| Compensation offered | $80,580 base + bonus + 401K + benefits |
| Treaty enterprise ownership | Kontrolmatik TR 50%, Pomega TR 10%, Kontrolmatik US 7%, individual TR shareholders 32%, German national 1% |
| Treaty-country ownership | ≥ 92% Turkish — satisfies 50% threshold easily |
| Investment | $4,000,000 (single wire from Pomega Turkey to Pomega US, Feb 28, 2023) |
| Wire details | Vakifbank USD account ***068 → Citibank account ***457 |
| Real-property | Land purchased in Colleton County, SC (307 acres for power plant) |
| Customer commitment | $1B / 7.5 GWh offtake with POWIN over 5 years |
| Equipment purchase | $1,381,200 from JS Machine (Istanbul) for assembly line |
| Operating personnel | 15 (14 W-2, 1 1099); 12 executives/managers |
| Beneficiary qualifications | Kocaeli University Electrical Eng. + 10 years SIEMENS / Honeywell / BEST + multi-country sales |
| Specialized knowledge basis | AIS/GIS medium-voltage equipment sales; doubled SIEMENS annual sales 2022 |
| Salary differential proof | Earned TRY 140K/mo vs TRY 45K Turkish average (3× peers) |
| Filing pages | 297 |

Use this as the regression fixture for the E-2 Employee detection + extraction
flow.

---

## 9. Skill list — additions needed

The current manual lists 22 skills. Camural requires the following net-new and
extended skills:

### Net-new

| # | Skill | Purpose |
|---|---|---|
| 1 | `job-offer-extractor` | Position, base salary, bonuses, benefits, start date, reporting structure |
| 2 | `service-record-extractor` | Foreign-country employment record with salary verification |
| 3 | `recommendation-letter-extractor` | Author, position, relationship, verbatim endorsement quote |
| 4 | `customer-contract-extractor` | Long-term offtake / supply agreements with $ commitment + term |
| 5 | `real-estate-purchase-extractor` | Land + commercial real-property purchase agreements |
| 6 | `incentive-document-extractor` | PTC, IRA, state-credit, grant agreements |
| 7 | `project-catalog-extractor` | Project / product brochures (capabilities, capacity, scale) |
| 8 | `foreign-corporate-doc-extractor` | Foreign-entity formation, board, shareholders, public-listing docs |
| 9 | `case-subtype-detector` | Phase-0 classifier choosing E2_INVESTOR vs E2_EMPLOYEE_SPECIALIZED vs E2_EMPLOYEE_EXEC |

### Extensions to existing skills

| Existing skill | Extension required |
|---|---|
| `cv-extractor` | Add per-role detail, geographic coverage, quantified achievements, multilingual capability |
| `credential-extractor` | Add diploma, certification, training-record schemas |
| `corporate-doc-extractor` | Add foreign-entity variant + shares-certificate schema |
| `org-chart-extractor` | Add multi-entity variant (parent + subsidiary on same chart) |
| `invoice-extractor` | Add equipment / capital-asset variant |
| `wire-confirmation-extractor` | Add corporate-funding (parent → subsidiary) variant — single wire, no FX |

---

## 10. Manual updates required

To accommodate Camural, the main manual needs:

1. **New Section 0.5** — case sub-type taxonomy + decision tree (Phase 0 expanded).
2. **Section 1 split** — Tab A and Tab B differ by sub-type; document both layouts.
3. **Section 2 split** — two cover-letter templates (Akalan attorney-voice + Pomega-style petitioner-voice). Cross-reference both `01-COVER-LETTER-TEMPLATE.md` (attorney) and a new `01b-COVER-LETTER-TEMPLATE-EMPLOYEE.md` (petitioner).
4. **New Section 3.5** — Specialized Knowledge proof requirements + schema. Cite 9 FAM 402.9-7(2) and 8 CFR 214.2(e)(18).
5. **Section 5 split** — SOF for individual investor (existing) + Corporate Funding for employee-sponsored cases.
6. **Section 8 split** — Develop & Direct (investor) vs. Beneficiary's Prospective Role (employee).
7. **Section 13 update** — add the 9 net-new skills + 6 extensions.
8. **Section 14 update** — add 8 CFR 214.2(e)(18) and 9 FAM 402.9-7(2) to authority allowlist.
9. **Section 17 update** — add Camural worked-example fixture alongside Kacar-Salih.
10. **Voice corpus update** — add Pomega-style petitioner-voice patterns alongside Akalan attorney-voice.

---

## 11. Open questions / V2 candidates

- [ ] Is there an E-2 Executive/Supervisory variant in the firm's archive? (Different again from Specialized Knowledge.)
- [ ] How does the firm handle the parent-entity E-2 filing inheritance — is there a "prior parent E-2 approval" exhibit pattern?
- [ ] Which Tab letters does the firm use for E-2 Employee renewals? (Camural's was a NEW filing; renewal Tab map may differ.)
- [ ] What dependents-Tab pattern exists for E-2 Employees with families?
- [ ] OCR Camural's later cover-letter pages (15+) for full Beneficiary Prospective Role narrative + closing patterns.
- [ ] Compare Camural's cover letter against 1-2 more Pomega-style petitioner letters to validate voice patterns.

---

Last updated: 2026-04-27
Calibrated against:
- `Filing_Camural-Onur_E-2_02082024.pdf` (297 pages, Feb 2024)
- `Filing_I-129_I-539_E-2_Renewal_Kacar-Salih_01072026.pdf` (426 pages, Jan 2026)
