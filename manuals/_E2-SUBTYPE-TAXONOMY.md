# E-2 Sub-Type Taxonomy (Authoritative)

> Synthesizes 9 FAM 402.9, 8 CFR 214.2(e), USCIS Policy Manual, and the two
> real Akalan filings (Kacar-Salih + Camural) into a single decision tree for
> the agent's Phase-0 case-subtype detector. The agent uses this to pick which
> Tab map, which cover-letter template, which evidence schema, and which voice
> to apply per case.

---

## 1. The full E-2 universe

```
E-2 Treaty Investor / Treaty Trader (INA §101(a)(15)(E))
│
├── E-1 Treaty Trader   (8 CFR 214.2(e); 9 FAM 402.9-3)         [out of scope here]
│
└── E-2 Treaty Investor (8 CFR 214.2(e); 9 FAM 402.9-3)
    │
    ├── PRINCIPAL — the person who develops and directs
    │   │
    │   ├── 1. Individual Treaty Investor
    │   │      • Person directly invests substantial capital
    │   │      • Owns ≥50% OR has operational control
    │   │      • Develops & directs the enterprise
    │   │      • Pattern: Kacar-Salih (small LLC, $120K, sole/co-owner)
    │   │      • Authority: 9 FAM 402.9-4 to -6, 8 CFR 214.2(e)(2)
    │   │
    │   └── 2. Corporate-Owned E-2 (rare)
    │          • Treaty-country corporation is the investor
    │          • Individual principal still must qualify as treaty national
    │          • Authority: 9 FAM 402.9-4(B), 8 CFR 214.2(e)(3)
    │
    ├── EMPLOYEE — sponsored by a qualifying treaty enterprise
    │   │
    │   ├── 3. Executive / Supervisory Employee  (E-2 Manager)
    │   │      • "Great authority to determine the policy and direction"
    │   │      • Supervises significant portion of operations
    │   │      • Authority: 8 CFR 214.2(e)(17), 9 FAM 402.9-7(2)(a)
    │   │
    │   └── 4. Essential Skills / Specialized Knowledge Employee
    │          • Special qualifications essential to enterprise
    │          • Skills not readily available in US labor market
    │          • Salary-differential proof
    │          • Pattern: Camural (Pomega Energy — Medium Voltage Sales Specialist)
    │          • Authority: 8 CFR 214.2(e)(18), 9 FAM 402.9-7(2)(b)
    │
    └── DEPENDENT — derivative status under principal
        │
        ├── 5. E-2 Spouse (I-539, with EAD eligibility)
        │      • Authority: INA §214(e)(6); 9 FAM 402.9-8
        │
        └── 6. E-2 Child (I-539A, under 21, unmarried)
               • Authority: 9 FAM 402.9-8
```

The agent's Phase-0 detector must classify each filing into exactly **one
principal subtype (1–4)** plus **zero or more dependents (5–6)**.

---

## 2. Procedural variants (orthogonal to subtype)

Every subtype above can present as one of these procedural postures:

| Procedural variant | What it is | Form mix |
|---|---|---|
| **New (Consular)** | First-time E-2 issued at US consulate abroad | DS-160 + DS-156E (no I-129) |
| **New (USCIS COS)** | Change of Status to E-2 from inside US | I-129 + I-129E |
| **Extension (USCIS)** | Extending E-2 status without leaving US | I-129 + I-129E (renewal context) |
| **Visa Renewal (Consular)** | Re-issuance of stamp at consulate | DS-160 + DS-156E |
| **Re-Validation** | Limited domestic stamp renewal (where available) | Varies |

Detection signals:
- I-129 + I-129E present → USCIS path (COS or Extension)
- DS-160 + DS-156E only → consular path (new or renewal)
- I-94 admit-until date in past + I-129E filed → COS
- I-94 admit-until date in future + I-129E filed → Extension
- "Renewal" or "Extension" stated explicitly in cover letter → renewal posture

---

## 3. Element checklist by subtype

What the agent must prove varies by subtype. Cover letter sections ARE the
element list.

### 3.1 Subtype 1 — Individual Treaty Investor (Kacar-Salih)

| Element | Authority | Cover-letter section |
|---|---|---|
| Treaty country nationality | 9 FAM 402.9-4(A) | II |
| Petitioner ≥ 50% treaty-national ownership | 9 FAM 402.9-4(B) | II–III |
| Substantial investment, irrevocably committed, at risk | 9 FAM 402.9-6(B), -6(D); Matter of Walsh & Pollard | IV–V |
| Real and operating bona-fide enterprise | 9 FAM 402.9-6(A) | VI |
| More than marginal | 9 FAM 402.9-6(E); Matter of Ho (5-yr plan, by analogy) | VI |
| Develop and direct | 9 FAM 402.9-7(1) | VII |
| Nonimmigrant intent | 9 FAM 402.9-4(F) | NOID Tab |

### 3.2 Subtype 2 — Corporate-Owned E-2

Same as Subtype 1 PLUS:
- Corporate parent's treaty-country nationality and ≥50% treaty ownership of the parent itself (9 FAM 402.9-4(B)).

### 3.3 Subtype 3 — Executive/Supervisory Employee

The treaty enterprise itself must already qualify (Subtype 1 or 2). Then the
employee-specific elements:

| Element | Authority |
|---|---|
| Employee's treaty-country nationality (must match the enterprise's qualifying nationality) | 9 FAM 402.9-7(2)(a) |
| Position is genuinely executive or supervisory | 9 FAM 402.9-7(2)(a); 8 CFR 214.2(e)(17) |
| Title + organizational placement | 9 FAM 402.9-7(2)(a) |
| Duties = ultimate control or supervision of major component | 9 FAM 402.9-7(2)(a) |
| Number / skill level of supervised employees | 9 FAM 402.9-7(2)(a) |
| Salary commensurate with executive/supervisory role + industry + geography | 9 FAM 402.9-7(2)(a) |
| Prior executive/supervisory experience | 9 FAM 402.9-7(2)(a) |

**Important nuance:** An exec/supervisor that primarily does "routine
substantive staff work" with only incidental supervision FAILS this category.
The drafter must include the manual's **anti-routine paragraph**.

### 3.4 Subtype 4 — Essential Skills Employee (Camural)

Same enterprise-qualifying foundation as 3.3 PLUS:

| Element | Authority |
|---|---|
| Employee's treaty-country nationality | 9 FAM 402.9-7(2)(b); 8 CFR 214.2(e)(18) |
| Special qualifications essential to operation | 8 CFR 214.2(e)(18) |
| Degree of proven expertise in the area | 9 FAM 402.9-7(2)(b) |
| Whether others possess the same skill | 9 FAM 402.9-7(2)(b) |
| Length of experience / training with the enterprise | 9 FAM 402.9-7(2)(b) |
| Training period required to do the job | 9 FAM 402.9-7(2)(b) |
| Skill's relationship to enterprise's specific processes / applications | 9 FAM 402.9-7(2)(b) |
| Salary the special qualifications command | 9 FAM 402.9-7(2)(b) |
| Skills NOT readily available in US labor market | 8 CFR 214.2(e)(18); 9 FAM 402.9-7(2)(b) |
| Foreign-language-and-culture alone is NOT enough | 9 FAM 402.9-7(2)(b) |

**Time-limited nature (CRITICAL drafting consideration):**
- Start-up skills may no longer be essential after initial operations.
- Some skills are essential only short-term for training local employees.
- Long-term essentiality requires showing product improvement / quality control / unique-service activities.

The drafter must ARGUE the projected duration and frame the skill as either
durably essential OR justify the limited-duration request honestly.

### 3.5 Subtype 5 — E-2 Spouse (I-539)

| Element | Authority |
|---|---|
| Marital relationship documented | 9 FAM 402.9-8 |
| Concurrent or subsequent to principal's filing | 9 FAM 402.9-8 |
| Intent to depart with principal | 9 FAM 402.9-4(F), 8 CFR 214.2(e)(5) |
| EAD eligibility (incident to status, no separate I-765 since 2022) | INA §214(e)(6) |

### 3.6 Subtype 6 — E-2 Child (I-539A)

| Element | Authority |
|---|---|
| Parent-child relationship documented (vital records + certified translation) | 9 FAM 402.9-8 |
| Under 21, unmarried | 9 FAM 402.9-8 |
| Concurrent with principal | 9 FAM 402.9-8 |

---

## 4. Tab structure by subtype (firm convention vs. minimum)

> Akalan's filings show the firm tailors Tab structure per subtype.

### Subtype 1 (Individual Investor) — Akalan A–L pattern (Kacar-Salih)

```
A Forms
B Cover Letter
C Treaty Qualification
D Ownership History
E Investment SOF/Transfer/AtRisk
F Substantiality
G Marginality + Real & Operating
H Develop & Direct
I NOID Principal
J Forms for Dependents
K NOID Dependents
L Dependent Biographic Info
```

### Subtype 4 (Essential Skills Employee) — Akalan A–H pattern (Camural)

```
A Table of Contents AND Cover Letter (combined)
B Forms (G-1145, G-28, I-129, I-129E, Job Offer Letter)
C Applicant Information (Passport, Visa, I-94, Resume, Prior Work, Diploma, Certificates, LoR)
D Intent to Depart
E Nationality of the Investor [parent enterprise]
F Ownership (Turkish + US entity, both org charts)
G Investment (parent → subsidiary wire + balance sheets)
H Real and Operating (catalogues, customer agmts, lease, land purchase, payroll, P&L)
[no dependent tabs in Camural's filing]
```

### Subtype 3 (Executive/Supervisory Employee) — pattern not yet observed in firm archive

Likely similar to Subtype 4 with these adjustments:
- Tab C adds: prior executive role evidence, P&L responsibility, signing authority
- Tab H emphasizes the executive's span of control + decisions made
- Defensive paragraph: anti-"routine staff work" (mirror of investor's anti-routine pattern)

**TODO for V2:** request firm archive for an exec/supervisory exemplar.

---

## 5. Cover-letter author + voice by subtype

| Subtype | Letterhead | Author title | Voice | Section style |
|---|---|---|---|---|
| 1 (Individual Investor) | Law firm | Attorney, Esq. | Conservative paralegal-tight | Roman numerals (II–VIII), ALL CAPS section heads |
| 2 (Corp-Owned) | Law firm | Attorney, Esq. | Same as 1, with parent-corporate narrative addendum | Roman numerals |
| 3 (Exec/Supervisory) | Likely Petitioner OR firm (varies) | VP HR / Attorney | Mixed — corporate facts in petitioner voice; legal arguments in attorney voice | ALL CAPS section heads |
| 4 (Essential Skills) | Petitioner | Petitioner officer (VP HR, COO) | Corporate marketing-flavored | ALL CAPS section heads, no Roman numerals |
| 5–6 (Dependents) | Law firm | Attorney | Brief support letters | Embedded in principal letter |

---

## 6. Source-of-funds model by subtype

| Subtype | SOF source | What the agent traces |
|---|---|---|
| 1 | Personal lawful sources (salary, sale of property, inheritance, gift, loan-non-collateralized-by-enterprise) | Origin → personal account → FX conversion → US wire → deployment to Petitioner |
| 2 | Corporate parent funds | Parent's audited financials → parent → US subsidiary, single or scheduled wire |
| 3, 4 | Petitioner enterprise's existing funds (the employee is NOT funding) | Skip personal SOF entirely; verify enterprise's prior E-2 status / treaty enterprise qualification |

---

## 7. Phase-0 detector signals (for the case-subtype-detector skill)

These are the heuristics the Haiku-tier classifier uses to pick subtype.

| Signal | Suggests |
|---|---|
| `(Beneficiary)` in cover letter is also `(Investor)` or majority owner | 1 |
| Membership Interest Transfer Agreement OR Operating Agreement names beneficiary as ≥50% member | 1 |
| Cover letter on **law-firm letterhead** | 1 (most likely) |
| Cover letter on **petitioner / corporate letterhead** | 3 or 4 |
| `"REQUESTED CLASSIFICATION: E2 — SPECIALIZED KNOWLEDGE"` | 4 |
| `"REQUESTED CLASSIFICATION: E2 — EXECUTIVE/SUPERVISORY"` | 3 |
| Job Offer Letter present | 3 or 4 |
| Beneficiary's salary stated with vs-peer comparison | 4 |
| Beneficiary CV emphasizes specialized skills not exec authority | 4 |
| Beneficiary CV emphasizes prior P&L, signing authority, supervised teams | 3 |
| Multiple foreign + US entity corporate documents (parent-subsidiary structure) | 2, 3, or 4 (treaty-enterprise filings) |
| Single foreign LLC + only US LLC corporate documents | 1 |
| Personal SOF chain narrated (property sale, inheritance, etc.) | 1 |
| Single corporate parent → US subsidiary wire | 2 or treaty-enterprise filings (3, 4) |
| I-539 + I-539A present | + 5, 6 dependents |
| No I-539 / no spouse + child | dependents = none |

The classifier returns: `{ principal_subtype: 1 | 2 | 3 | 4, dependents: bool }`.

---

## 8. Authority citation matrix

What to cite, by element, by subtype. The agent's authority allowlist must
include all of these.

| Citation | Where used |
|---|---|
| `INA §101(a)(15)(E)(ii)` | Every subtype, statutory anchor |
| `INA §214(e)(6)` | Subtype 5 (spouse EAD) |
| `8 CFR §214.2(e)(2)` | Subtype 1 — definition of treaty investor |
| `8 CFR §214.2(e)(3)` | Subtype 2 — corporate ownership |
| `8 CFR §214.2(e)(12)` | Subtypes 1, 2 — at-risk, no impermissible loans |
| `8 CFR §214.2(e)(14)` | Subtypes 1, 2 — substantiality |
| `8 CFR §214.2(e)(15)` | Subtypes 1, 2 — marginality |
| `8 CFR §214.2(e)(17)` | Subtype 3 — exec/supervisory |
| `8 CFR §214.2(e)(18)` | Subtype 4 — essential skills |
| `9 FAM 402.9-3` | All — overview of E-2 |
| `9 FAM 402.9-4(A)` | All — applicant nationality |
| `9 FAM 402.9-4(B)` | All — enterprise nationality / ≥50% ownership |
| `9 FAM 402.9-4(F)` | All — nonimmigrant intent |
| `9 FAM 402.9-5` | Subtypes 1, 2 — investment definition |
| `9 FAM 402.9-6(A)` | Subtypes 1, 2 — bona fide enterprise |
| `9 FAM 402.9-6(B)` | Subtypes 1, 2 — at-risk / commitment |
| `9 FAM 402.9-6(C)` | Subtypes 1, 2 — substantiality (proportionality) |
| `9 FAM 402.9-6(D)` | Subtypes 1, 2 — source of funds |
| `9 FAM 402.9-6(E)` | Subtypes 1, 2 — marginality |
| `9 FAM 402.9-7(1)` | Subtype 1 — develop and direct |
| `9 FAM 402.9-7(2)(a)` | Subtype 3 — exec/supervisory employee |
| `9 FAM 402.9-7(2)(b)` | Subtype 4 — essential skills employee |
| `9 FAM 402.9-8` | Subtypes 5, 6 — dependents |
| `9 FAM 402.9-9` | Extensions / renewals |
| `Matter of Walsh and Pollard, Interim Decision #3111` | Subtypes 1, 2 — at-risk |
| `Matter of Ho, 19 I&N Dec. 582 (BIA 1988)` | Subtypes 1, 2 — 5-yr business plan, by analogy |

---

## 9. Per-subtype document inventory (what the agent must collect)

### Subtype 1 — Individual Investor (existing manual)
See `E2-MANUAL-FOR-CLAUDE-CODE.md` Sections 3–8.

### Subtype 4 — Essential Skills Employee (Camural pattern)

| Tab | Document | Purpose | Skill |
|---|---|---|---|
| A | TOC + Cover Letter (Petitioner-authored) | Argument | drafter |
| B | G-1145, G-28, I-129, I-129E, Job Offer Letter | Procedural + role anchor | form-field-extractor + job-offer-extractor |
| C | Passport | Nationality | passport-extractor |
| C | Visa + I-94 | Lawful US status | visa-stamp-extractor + i94-extractor |
| C | Resume / CV | Specialized knowledge proof | cv-extractor |
| C | Prior Work and Service Record | Foreign salary verification + tenure | service-record-extractor |
| C | Diploma | Education credential | credential-extractor |
| C | Certificates | Industry certifications | credential-extractor |
| C | Letter of Recommendation | Third-party validation | recommendation-letter-extractor |
| D | Notice of Intent to Depart | Nonimmigrant intent | affidavit-extractor |
| E | Shares Certificate + Owners' passports | Treaty-country ownership ≥50% | corporate-doc-extractor |
| F | Foreign-entity corporate docs | Parent enterprise structure | foreign-corporate-doc-extractor |
| F | US-entity corporate docs | Subsidiary structure | corporate-doc-extractor |
| F | Org charts (BOTH entities) | Reporting structure | org-chart-extractor |
| G | Parent → Subsidiary Wire Confirmation | Corporate funding | wire-confirmation-extractor (corporate variant) |
| G | Recipient bank confirmation | Funds received | bank-receipt-extractor |
| G | Balance Sheets (multiple periods) | Capital deployment over time | financial-statement-extractor |
| H | Project / Product Catalogues | Real-and-operating + scale | project-catalog-extractor |
| H | Customer Offtake Agreement | Future revenue + market validation | customer-contract-extractor |
| H | Vendor Equipment Invoices (capital assets) | At-risk capital deployment | invoice-extractor (capital variant) |
| H | Lease Agreement | Premises | contract-extractor (commercial_lease variant) |
| H | Land Purchase Agreement | Real-property acquisition | real-estate-purchase-extractor |
| H | Payroll Summaries | Real-and-operating + employee count | payroll-extractor |
| H | Profit and Loss + Balance Sheet (latest) | Financial health | financial-statement-extractor |

### Subtype 3 — Executive/Supervisory (placeholder until firm sample obtained)

Inherits Subtype 4's Tab structure but adjusts Tab C and H to emphasize:
- Prior executive titles + P&L responsibility (CV deep-extract)
- Letters from prior employers describing executive duties
- Org chart placement (top of US entity, with span of control)
- Compensation matched to executive industry/geography benchmarks
- Decisions delegated to and from beneficiary

---

## 10. Drafter voice pivots (cover letter)

### Subtype 1 (Investor) — paralegal-tight

```
[Roman numerals]
I.   INTRODUCTION
II.  QUALIFICATION UNDER A TREATY OF COMMERCE AND NAVIGATION
III. OWNERSHIP STRUCTURE AND CORPORATE HISTORY
IV.  THE INVESTMENT: SOURCE, TRANSFER, AND AT-RISK COMMITMENT OF FUNDS
V.   SUBSTANTIALITY OF THE INVESTMENT
VI.  MARGINALITY AND ONGOING COMMERCIAL ACTIVITY
VII. ROLE OF THE BENEFICIARY: DEVELOPING AND DIRECTING THE ENTERPRISE
VIII. CONCLUSION
```

Defined terms: `the Beneficiary`, `the Petitioner`. End-of-section: `Accordingly,
[element] is satisfied under INA §… and 9 FAM 402.9-…`. Inline `(Exhibit: …)`.

### Subtype 4 (Essential Skills Employee) — petitioner-corporate

```
[ALL CAPS section heads, no Roman numerals]
[Opening: parties, request, beneficiary background — narrative]
INVESTMENT, ESTABLISHMENT, OWNERSHIP AND CONTROL
DOING BUSINESS
PREMISES
OPERATING PERSONNEL
FINANCIAL SITUATION AND FUTURE PLANS
THE BENEFICIARY'S PROSPECTIVE ROLE
BENEFICIARY'S EMPLOYMENT HISTORY AND QUALIFICATIONS
CONCLUSION
[Signature: Petitioner officer]
```

Voice features:
- Corporate `we`/`our` pronouns
- Industry context narrative
- Salary differential proof in prose
- Inline LoR quote
- Politicians / IRA / market context name-drops where relevant
- Defensive paragraph: "skills not readily available in U.S. labor market" — must be present per 8 CFR §214.2(e)(18)
- Defensive paragraph: time-limited essentiality framing (when applicable)

### Subtype 3 (Exec/Supervisory) — hybrid (recommended)

Petitioner-letterhead but with attorney-style legal sections, OR firm-letterhead
with petitioner facts narrated. Akalan archive doesn't yet show a definitive
pattern — request a firm exemplar.

---

## 11. Open V2 questions

- [ ] Obtain a firm Subtype 3 (Executive/Supervisory) exemplar; codify Tab map and voice.
- [ ] Codify Subtype 2 (Corporate-Owned) Tab map (parent's own E-2-class evidence).
- [ ] Document the full I-129E vs DS-156E switching logic for consular vs USCIS paths.
- [ ] Add the EAD-incident-to-status drafting note for Subtype 5 spouses (post-2022 automatic EAD).
- [ ] Add post-PA-2025-16 discretionary-considerations boilerplate for any subtype.
- [ ] Add post-2025 reciprocity changes (France 48-month, etc.) to country-specific notes.

---

## 12. Decision tree (canonical)

The Phase-0 case-subtype-detector returns this object:

```typescript
type E2CaseSubtype = {
  principal_subtype:
    | 'individual_investor'           // 1
    | 'corporate_owned_investor'      // 2
    | 'executive_supervisory_employee' // 3
    | 'essential_skills_employee';    // 4

  procedural_posture:
    | 'consular_new'
    | 'uscis_cos_new'
    | 'uscis_extension'
    | 'consular_renewal';

  has_dependents: boolean;
  dependent_count: number;
  dependent_breakdown?: { spouse: boolean; children: number };

  detection_signals: string[]; // verbatim phrases that drove the classification
  detection_confidence: 'HIGH' | 'MED' | 'LOW';
};
```

`HIGH` — at least 3 strong signals align (e.g., letterhead + classification statement + role evidence).
`MED` — 1–2 strong signals plus several weak ones.
`LOW` — only weak signals; route to attorney for manual subtype confirmation.

---

## 13. Sources

- [9 FAM 402.9 — Treaty Traders, Investors, and Specialty Occupations](https://fam.state.gov/fam/09FAM/09FAM040209.html)
- [E-2 Treaty Investors — USCIS](https://www.uscis.gov/working-in-the-united-states/temporary-workers/e-2-treaty-investors)
- [Treaty Trader & Treaty Investor — U.S. Department of State](https://travel.state.gov/content/travel/en/us-visas/employment/treaty-trader-investor-visa-e.html)
- [8 CFR § 214.2 — Special requirements (eCFR)](https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-214/subpart-A/section-214.2)
- [E-2 Employee Visa: Executive & Supervisory Qualities — Lawfirm4Immigrants](https://www.lawfirm4immigrants.com/e-2-visas-executive-and-supervisory-character-special-qualifications/)
- [E-2 Visa Employee Requirements 2026 — Alaz Law](https://www.alazlaw.com/blog/e-2-visa-employee-requirements-2026-executive-manager-essential-skills/)

---

Last updated: 2026-04-27
Calibrated against:
- Filing_Camural-Onur_E-2_02082024.pdf (Subtype 4 — Essential Skills, 297 pages)
- Filing_I-129_I-539_E-2_Renewal_Kacar-Salih_01072026.pdf (Subtype 1 — Individual Investor, 426 pages)
- 9 FAM 402.9 (consular practice manual)
- 8 CFR § 214.2(e) (regulations)
- USCIS Policy Manual (referenced)
