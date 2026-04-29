# E-2 Preparation Manual — Akalan Business Immigration

> Practitioner-facing case-build manual. Calibrated against Kacar-Salih
> (Subtype 1, individual_investor + uscis_extension, Jan 2026) and
> Camural / Pomega Energy (Subtype 4, essential_skills_employee +
> uscis_cos_new, Feb 2024). Sibling to the AI-facing
> `E2-MANUAL-FOR-CLAUDE-CODE.md`.
>
> **Authority stack:** INA § 101(a)(15)(E)(ii) · 8 CFR § 214.2(e) ·
> 9 FAM 402.9 · 22 CFR § 41.51 · USCIS Policy Manual Vol. 2, Pt. F.
>
> **Defined terms (firm convention):** *the Beneficiary* (the principal
> E-2 applicant); *the Petitioner* (the US enterprise); *the Treaty
> Country* (the country whose nationality the Beneficiary holds and
> whose treaty with the US grounds E-2 eligibility); *the Investment*
> (the funds irrevocably committed to the US enterprise).
>
> **Currency convention:** `<ISO> <amount>.<cents>` everywhere
> (`TRY 4,000,000.00`, `$120,000.00`, `EUR 240,000.00`). Never bare
> numerals.
>
> **Date convention:** ISO 8601 (`YYYY-MM-DD`).
>
> **Citation convention:** inline `(Exhibit: <Title> dated <Date>)`
> matching the exhibit index verbatim.

---

## Table of Contents

1. **Procedural architecture** — the five elements, the four routes, the form inventory, the four sub-types
2. **Forms walkthrough** — every form, field-by-field, signatory, fact source
3. **Business plan** — required sections, *Matter of Ho* anchor, the source rule, length norms
4. **Source of funds trail** — origin → conversion → wire → US deposit → deployment, with named numbers
5. **Corporate / incorporation documents** — Articles, OA, EIN, member resolutions, MITA, cap table, Good Standing, foreign parent
6. **Operational evidence** — lease, premises, build-out, inventory, vendor contracts, indicia of active commerce
7. **Employee evidence (marginality)** — W-2 vs 1099, I-9, W-4, payroll, Form 941, workers' comp, state UI
8. **Spending reconciliation** — every dollar: amount · date · category · invoice present · bank confirmation present
9. **The investment table** — deliverable artifact: rows × columns + substantiality calculation
10. **Sub-type variations** — Subtype 1 (Kacar), 2 (corp-owned), 3 (exec/supervisory), 4 (Camural)
11. **Common pitfalls + RFE triggers**
12. **Filing & post-filing** — receipts, biometrics, interview, RFE response, renewal triggers

---

# Part I — Procedural Architecture

## 1.1 The five E-2 elements

Every E-2 case must establish, in this order, with documentary proof:

| # | Element | Source | One-line test |
|---|---|---|---|
| **E1** | Treaty country nationality (Beneficiary) AND ≥ 50 % treaty-national ownership of the Petitioner | INA § 101(a)(15)(E)(ii); 9 FAM 402.9-4 | Is the Beneficiary a national of a qualifying treaty country, and do treaty-country nationals own at least half of the Petitioner? |
| **E2** | Substantial investment in a bona fide enterprise, irrevocably committed and at risk | 9 FAM 402.9-6(B) and (C); 22 CFR § 41.51(b)(8) | Has the money actually moved, can it be lost if the venture fails, and is it substantial relative to the cost of the enterprise? |
| **E3** | The enterprise is real and operating (not paper, not speculative, not a mere holding) | 9 FAM 402.9-6(D) | Is there an active commercial undertaking producing goods or services for profit, with premises, employees, customers, and suppliers? |
| **E4** | The enterprise is more than marginal (it produces or will produce more than minimal living for the Beneficiary and family) | 9 FAM 402.9-6(E); *Matter of Walsh & Pollard*, 20 I&N Dec. 60 (BIA 1988) | Will the enterprise generate, within five years, sufficient income to do more than support the Beneficiary's family — typically through W-2 employees beyond the Beneficiary? |
| **E5** | The Beneficiary will develop and direct the enterprise (investor) OR the Beneficiary is an executive / supervisor / essential-skills employee of a treaty enterprise (employee) | 9 FAM 402.9-7(1) (investor) and 402.9-7(2)(a)–(b) (employee) | Does the Beneficiary control the enterprise via majority ownership or operational governance, OR fill a role that requires executive / supervisory authority or specialized knowledge? |

A weak element does not defeat the case if the others are strong; a
missing element does. Every Tab in the exhibit index ties back to one
or more elements (see Part I § 1.4 below).

## 1.2 The four procedural postures

| Posture | When | Forms filed | Where |
|---|---|---|---|
| **Consular new** | First-time E-2, Beneficiary abroad | DS-160 + DS-156E | US consulate in the Treaty Country (e.g., Ankara, Frankfurt) |
| **Consular renewal** | Beneficiary abroad (or returning), prior E-2 expired | DS-160 + DS-156E | Same consulate |
| **USCIS Change-of-Status (COS)** | Beneficiary inside the US on another status (B-2, F-1, H-1B, L-1, etc.) | I-129 + I-129E + G-28 + G-1145 + G-1650 (+ I-539 / I-539A for dependents) | USCIS lockbox → service center |
| **USCIS Extension** | Beneficiary inside the US on prior E-2, status still valid | Same as COS | Same |

The forms inventory (Part II) is exhaustive across all four postures;
the firm files what each posture requires and documents the others as
"not applicable to this filing."

## 1.3 The four E-2 sub-types

| Subtype | Label | Anchor case | Pattern |
|---|---|---|---|
| **1** | `individual_investor` | Kacar-Salih, Wise Guys Deli LLC, Rhode Island | One human + small US LLC + personal SOF chain (property sale, savings, gift, inheritance, lawful loan) |
| **2** | `corporate_owned_investor` | (firm exemplar pending) | Foreign treaty-country corporation invests in a US subsidiary; human Beneficiary qualifies through the corporate ownership |
| **3** | `executive_supervisory_employee` | (firm exemplar pending) | Beneficiary is an executive or supervisor (C-suite, VP, Director, Country Manager) of a qualifying treaty enterprise |
| **4** | `essential_skills_employee` | Camural, Pomega Energy LLC, Delaware | Beneficiary holds specialized knowledge essential to the enterprise; foreign parent + US subsidiary; salary differential vs US peer market |

Sub-type drives the cover-letter voice (law-firm-attorney for Subtype 1,
petitioner-corporate for Subtypes 3 and 4), the authority allowlist (Subtypes 3 and
4 add 9 FAM 402.9-7(2)(a) and (b)), and the SOF chain shape (Subtype 1
is personal; Subtypes 2, 3, 4 are corporate-parent funded).

## 1.4 Tab A–L convention (firm filing structure)

| Tab | Heading | E-2 Element | Typical doc types |
|---|---|---|---|
| **A** | Forms (procedural) | — | I-129, I-129E, G-28, G-1145, G-1650 |
| **B** | Cover letter | argument (all) | Akalan cover letter |
| **C** | Treaty Qualification | E1 — nationality | passport, I-94, prior visa stamp, MITA, member resolutions, co-owner nationality proof |
| **D** | Ownership Structure & Corporate History | E1 — ≥ 50 % | Articles, Operating Agreement, EIN letter, Bill of Sale, MITA (current) |
| **E** | Investment / SOF / At-Risk | E2 — source of funds | Tapu / title deeds, bank receipts, FX conversion, international wires, US deposits, MITA, legal-fee invoice |
| **F** | Substantiality | E2 — proportionality | Balance sheet, MITA, invested-funds summary |
| **G** | Marginality + Real & Operating | E3 + E4 | Premises photos, commercial lease, business bank statements, vendor invoices, payroll, tax return, business plan, industry data |
| **H** | Develop & Direct | E5 | Member resolution appointing role, org chart, Beneficiary CV, business plan |
| **I** | NOID Principal | NIV intent | Notice of Intent to Depart (Beneficiary) |
| **J** | Forms for Dependents | dependent forms | I-539 (spouse), I-539A (each child) |
| **K** | NOID Dependents | NIV intent | Notice of Intent to Depart (each dependent) |
| **L** | Dependent Biographic | dependent evidence | Spouse passport + I-94 + visa, child passports, marriage cert, birth certs, certified translations |

Inline `(Exhibit: …)` citations in the cover letter must match the
filed exhibit index verbatim. The exhibit index template lives at
`manuals/03-EXHIBIT-INDEX-TEMPLATE.md`.

## 1.5 APS scoring (probative value gate)

Element-critical evidence must hit APS ≥ 4 before filing.

| APS | Meaning | Examples |
|---|---|---|
| 5 | Court / government / audited; independent; corroborated | Title deed, IRS CP-575, Articles of Organization, audited financials |
| 4 | Third-party institutional; independent; corroborated | Bank statement, lease, payroll provider report, board resolution |
| 3 | Self-prepared but supported by third-party data | Business plan with industry citations, balance sheet |
| 2 | Self-declared, partial corroboration | Affidavit with supporting receipts |
| 1 | Bare assertion | RFE bait — supplement or remove |

---

# Part II — Forms Walkthrough

Every form below is described with: **purpose · who signs · key fields ·
fact source · common mistakes · cross-form consistency**.

> **Form-edition rule.** USCIS revises form editions periodically. Before
> filing, verify the current edition at `uscis.gov/forms/<form-code>` and
> confirm the edition date matches what is on the form being filed.
> Outdated editions are routinely rejected. The firm's bot caches blank
> PDFs at `app/forms/blank/`; refresh that folder when USCIS publishes
> a new edition.

## 2.1 Form G-1145 — e-Notification of Application/Petition Acceptance

**Purpose.** Optional. Tells USCIS to send electronic acknowledgment of
lockbox receipt to a designated email or phone.

**Who signs.** The Beneficiary (or the petitioning entity's authorized
signatory).

**Key fields:** applicant or petitioner name; email address; mobile phone.

**Fact source:** the engagement intake form.

**Common mistakes:**
- Phone formatted with country code (USCIS expects domestic 10-digit format).
- Email typo (Beneficiary loses receipt confirmation).

**Cross-form consistency.** The applicant name on G-1145 must match the
Beneficiary name on I-129 Pt. 2 (and on I-539 for the spouse).

**Filing note.** Clip G-1145 to the front of the petition packet.
USCIS routes it to lockbox staff for return-of-receipt processing.

## 2.2 Form G-28 — Notice of Entry of Appearance as Attorney or Accredited Representative

**Purpose.** Establishes counsel of record. One G-28 per applicant —
i.e., one for the Beneficiary, one for the spouse on I-539, one per
child on I-539A.

**Who signs.** The attorney **and** the applicant. Both signatures are
required; an unsigned G-28 voids attorney access.

**Key fields:**
- Pt. 1: attorney name, bar number, state of admission, employer name (firm), address, phone, email.
- Pt. 2: eligibility of attorney (attorney is the typical box).
- Pt. 3: applicant name, A-number (if any), application/petition type.
- Signatures + dates (both sides).

**Fact source:** firm bar records (attorney side) + intake (applicant side).

**Common mistakes:**
- Bar number transcribed wrong — the firm's bot cross-checks against `lib/attorney-roster.json`.
- Signature date older than 30 days at filing.
- Wrong eligibility box (attorney vs accredited representative).
- One G-28 attempted to cover the principal AND a dependent — does not work; one per applicant.

**Cross-form consistency.** Applicant name on G-28 = applicant name on
the underlying form (I-129 / I-539 / I-539A). Attorney bar number on
G-28 = bar number on the cover letter signature block.

## 2.3 Form I-129 — Petition for a Nonimmigrant Worker (with E Supplement)

**Purpose.** The substantive petition. The base I-129 carries identity
+ classification + processing routing; the E Supplement (the dedicated
E-1 / E-2 / E-3 attachment) carries the substantive E-2 facts.

**Who signs.** The Petitioner's authorized signatory (typically the
Beneficiary if the Beneficiary is a member-manager; otherwise an officer
or registered agent). The attorney does NOT sign the petition itself —
the petitioner signs it; counsel signs G-28 separately.

### 2.3.1 Base I-129 — key fields

| Part | Field | Source |
|---|---|---|
| 1 | Petitioner legal name | Articles of Organization |
| 1 | Petitioner address | Lease (premises address) |
| 1 | Petitioner FEIN | IRS CP-575 / EIN letter |
| 1 | Year established | Articles of Organization (filing date) |
| 1 | Current number of employees in the United States | Payroll register (Q4 prior year) |
| 1 | Gross / net annual income | Tax return (most recent Form 1120 / 1120S / 1065) |
| 2 | Beneficiary full legal name | Passport bio page (native + ASCII) |
| 2 | Beneficiary date of birth | Passport |
| 2 | Beneficiary country of birth | Passport |
| 2 | Beneficiary nationality | Passport |
| 2 | Beneficiary passport number, issuing country, expiration | Passport |
| 2 | Beneficiary US address | Lease or US mailing address |
| 2 | Beneficiary I-94 admission number | I-94 record |
| 4 | Requested action (extension, change of status, new employment) | Posture (consular vs USCIS COS vs extension) |
| 5 | Basis for classification (E-2) | Settled by sub-type |
| 5 | Dates of intended employment | Cover letter Section IV / VII |
| 7 | Filing fee tally | Current USCIS fee schedule |

### 2.3.2 I-129 E Supplement — key fields

This is the substantive E-classification attachment. It restates, in
form-bound shorthand, what the cover letter argues at length.

| Pt. | Field | Source | Drift gate |
|---|---|---|---|
| 1 | Classification (E-2) | Cover letter | — |
| 1 | Treaty country | Beneficiary passport | Must match nationality on Pt. 2 of base I-129 |
| 1 | Type of business (industry / NAICS) | Articles + business plan | — |
| 2 | Investment amount in USD | MITA total consideration (Subtype 1) **OR** parent-to-sub authorized amount (Subtypes 2 / 3 / 4) | **§ 4.5 gate**: must equal MITA total consideration within $100 |
| 2 | Source of investment funds (1-line summary) | SOF narrative in cover letter Section IV | — |
| 2 | Total cost of enterprise | Balance sheet total assets OR business-plan year-1 total | Substantiality computed = investment / total cost |
| 2 | Beneficiary ownership percentage | Operating Agreement amendment (current) | Must agree with cover letter Section III |
| 2 | Co-owner names + nationalities + percentages | Co-owner passport + Operating Agreement amendment | Sum of treaty-national % must be ≥ 50 |
| 3 | Beneficiary role (member-manager / officer / employee) | Member resolution appointing role | — |
| 3 | Develop-and-direct narrative (short) | Cover letter Section VII | — |

**Common mistakes (severe — high RFE risk):**
- Investment amount on I-129E ≠ MITA total consideration. The bot's
  manual § 4.5 gate fires severity 5 on any drift > $100. Always reconcile.
- Treaty country mis-spelled (e.g., "Turkey" vs the form expects
  alphabetical codes in some editions). Verify the current form's
  expected format.
- Ownership percentage rounded — write the exact percent that appears in
  the Operating Agreement amendment, not a rounded version.
- Co-owner nationality omitted. If the Beneficiary alone is 50 %, the
  co-owner's nationality is irrelevant to the threshold but should still
  be disclosed; if combined treaty nationality is needed (e.g., 30 % +
  20 %), the co-owner nationality is element-critical.

**Cross-form consistency.**
- I-129 Pt. 2 Beneficiary identity = passport bio page = G-28 applicant
  = cover letter Section II.
- I-129E Pt. 2 investment amount = MITA total consideration = cover
  letter Section IV.
- I-129E Pt. 2 ownership % = Operating Agreement amendment current
  composition = cover letter Section III.

## 2.4 Form G-1650 — ACH Authorization for Filing Fees

**Purpose.** Authorizes USCIS to debit the firm's IOLTA or business
account for filing fees. One G-1650 per fee category (I-129 fee, I-539
fee, biometric fees, premium processing if elected).

**Who signs.** The account holder (typically the firm's managing
attorney or the Beneficiary if paying directly).

**Key fields:** account holder legal name, business name (if business
account), routing number, account number, authorized amount.

**Fact source:** firm's accounting system OR Beneficiary's bank.

**Common mistakes:**
- Routing/account number transposed (filing rejected, fees re-tendered,
  receipt date pushed → potential status gap).
- Authorized amount exceeds the actual fee — USCIS will only debit the
  posted fee, but the discrepancy looks unprofessional.
- Multiple G-1650s with overlapping fee categories — one G-1650 per
  distinct fee.

**PII rule.** Routing + account numbers are sensitive. The firm's bot
strips them at extract; never persist beyond the active case file.
After filing, redact routing/account on the case copy retained in the
matter folder.

## 2.5 Form DS-160 — Online Nonimmigrant Visa Application (consular routes only)

**Purpose.** Mandatory for any consular E-2 (new or renewal). One
DS-160 per applicant — Beneficiary, spouse, each child of visa age.

**Who signs.** The applicant electronically (no wet signature). The
applicant must answer truthfully under § 22 USC 6011 — false answers
support a § 212(a)(6)(C) misrepresentation finding.

**Key fields (selected):**
- Personal info (name, DOB, nationality, marital status).
- Travel info (intended date of arrival, intended length of stay).
- US point of contact (the Petitioner address).
- Work / education history (last 5 employers, last 2 schools).
- Security questions (50+, all of them; truthful answers required).
- Photo upload (consulate-specific specs; 5 cm × 5 cm typical).

**Common mistakes:**
- Photo rejected (background not white, face not centered, glasses on).
- Name discrepancy — the DS-160 must match passport exactly, including
  diacritics where the passport uses them.
- Prior US travel under-reported. Consulates cross-check ESTA + I-94
  history.

**Cross-form consistency.** DS-160 confirmation barcode is required at
the consular interview; print it and bring to interview.

## 2.6 Form DS-156E — Nonimmigrant Treaty Trader / Treaty Investor Application (consular)

**Purpose.** The consular analogue of the I-129 E Supplement. Carries
the substantive E-2 facts for consular-route filings.

**Who signs.** The Beneficiary (and Petitioner if separate entity).

**Key fields:** mirror I-129 E Supplement (treaty country, investment
amount, ownership, role, source of funds summary). Section III also
asks for personnel breakdown (US workers vs foreign nationals) and the
amount of the Beneficiary's salary if employee-route.

**Common mistakes:**
- Amount-of-investment field left in TRY/EUR — must be in USD.
- Source-of-funds narrative too thin — consular officers expect 2–3
  sentences minimum even though the form gives a small box.

## 2.7 Form I-539 — Application to Extend / Change Nonimmigrant Status (spouse + each child)

**Purpose.** Used when E-2 dependents are inside the US and need a
change of status to E-2 dependent OR an extension of existing E-2
dependent status. Spouse + each child each need an I-539; the family
files together.

> **2024 USCIS fee structure note.** Effective Apr 1, 2024 USCIS
> introduced separate I-539 fees per applicant. Consult the current
> fee schedule at filing time. Online filing is allowed for some
> categories; paper filing remains accepted.

**Who signs.** The principal applicant (the spouse if the spouse files
the I-539; the parent on behalf of a minor child).

**Key fields:**
- Pt. 1: applicant identity (name, DOB, country of birth, nationality, A-number, I-94, current US address, daytime phone, email).
- Pt. 2: application type (extension or change of status).
- Pt. 3: processing info (nonimmigrant classification requested = "E-2 Dependent").
- Pt. 4: additional info about applicant (basis for eligibility — relationship to principal).
- Pt. 5: principal applicant info (name, DOB, USCIS receipt number).
- Pt. 6: addresses (current US + foreign).
- Pt. 7: signature.
- Pt. 8 (if needed): preparer / interpreter.

**Cross-form consistency.** Pt. 5 principal applicant name + receipt
number must match the principal's I-129 receipt notice.

## 2.8 Form I-539A — Supplemental Information for Application to Extend / Change Nonimmigrant Status (each additional applicant)

**Purpose.** One I-539A per additional dependent (each child beyond
the spouse). The spouse files the base I-539; each child gets an
I-539A appended. The I-539A is **not** a standalone application —
it's an attachment to the I-539.

**Who signs.** The parent on behalf of the child (the same parent who
signed the underlying I-539).

**Key fields:** same identity fields as I-539 Pt. 1, plus relationship
to principal (= "child of E-2 principal").

**Common mistakes:**
- Dependent listed on the I-539A but no fee paid — each I-539A carries
  its own biometric fee for applicants 14 +; verify the biometric fee
  per child.
- Children old enough to file their own I-539 (typically because they
  age out before adjudication) — flag at intake; if a minor will turn
  21 during adjudication, escalate to attorney.

## 2.9 Pre-filing checklist (every E-2 case)

- [ ] G-28 signed (attorney + each applicant), within 30 days of filing
- [ ] G-1145 attached to front of packet
- [ ] I-129 base + I-129E Supplement complete; investment amount cross-checked against MITA
- [ ] G-1650 ACH authorizations for every fee category
- [ ] Cover letter Roman-numeral sections II–VIII match Tab C–H exhibits
- [ ] Exhibit index final, with APS scoring complete (every element-critical exhibit ≥ 4)
- [ ] If COS or extension: I-94 admit-until > filing date (no status gap)
- [ ] If consular: DS-160 confirmation barcode + DS-156E for each applicant; appointment scheduled
- [ ] If dependents: I-539 + I-539A for each, plus spouse / child passports + marriage / birth certs (Tab L)
- [ ] All foreign-language documents accompanied by certified English translation (8 CFR § 103.2(b)(3))

---

# Part III — Business Plan

The business plan is the connective tissue across substantiality (E2),
real-and-operating (E3), marginality (E4), and develop-and-direct (E5).
A weak plan can sink an otherwise strong file; a strong plan can carry
borderline elements past adjudicator scrutiny.

## 3.1 Authority anchor

*Matter of Ho*, 19 I&N Dec. 582 (BIA 1988) — controlling for what makes
a business plan credible:

> "The petitioner must submit a business plan that is, at a minimum,
> credible. Conclusory statements of fact, projections, and plans
> without supporting evidence are inadequate. The plan must show in
> detail what the proposed enterprise will do, the projected income,
> the projected expenses, the projected staffing, and the projected
> profits. The projections must be based upon objective, verifiable
> evidence."

Practical translation: every projection must cite a source. A revenue
forecast that is not grounded in verifiable industry data, comparable
businesses, or pre-signed contracts is, in *Matter of Ho*'s
formulation, "conclusory" — and conclusory equals inadequate.

## 3.2 Required sections (Akalan template)

| § | Section | Length norm | What USCIS / consulate looks for |
|---|---|---|---|
| 1 | Executive summary | 1–2 pages | The five elements compressed: who is investing, how much, in what, why now, who runs it |
| 2 | Industry analysis | 4–8 pages | NAICS classification, market size, growth rate, competitive structure, barriers to entry. Cite IBISWorld / Statista / BLS / Census / industry trade reports |
| 3 | Business description | 3–5 pages | Products / services, target market, geographic scope, value proposition, regulatory environment (licensing, health permits, ATF / TTB if applicable) |
| 4 | Marketing plan | 3–5 pages | Customer acquisition strategy, pricing, channels, marketing budget by year |
| 5 | Operations plan | 4–6 pages | Premises, equipment, suppliers, daily operations, hours, capacity, quality control, technology stack |
| 6 | Management & organizational structure | 3–5 pages | Org chart, the Beneficiary's role and authority, key hires, advisory board, cite to CV / credentials in Tab H |
| 7 | Financial projections | 5–8 pages | Year 1–5 income statement, balance sheet, cash flow. Hiring schedule by quarter. Breakeven month. Sensitivity analysis (best / base / downside). Every figure cites a source |
| 8 | Investment & use-of-funds | 2–3 pages | Where the money goes: lease deposit, build-out, equipment, inventory, payroll committed, marketing, working capital. Mirrors the investment table (Part IX) |
| 9 | Growth strategy | 2–3 pages | Year 3–5 expansion (additional locations, product lines, hires), exit pathway (none required, but signals long-term commitment) |
| **Total** | | **30–45 pages** | Some firms run 60–80; brevity at the cost of citation density is the wrong trade-off |

## 3.3 The source rule (non-negotiable)

Every projected figure carries a source field. If no source exists,
the figure must be flagged `[ASSUMED — verify before filing]` and
either replaced or supported with an expert letter (Tab G in some firm
filings).

| Figure type | Acceptable sources |
|---|---|
| Industry size, growth rate | IBISWorld, Statista, US Census County Business Patterns, BLS NAICS data |
| Comparable business revenue | Public filings (10-K, 10-Q), trade-association benchmarks, ReferenceUSA |
| Wage projections | BLS OES (Occupational Employment Statistics) at the MSA level |
| Lease comparables | CoStar, LoopNet, broker comps |
| Equipment costs | Vendor quotes (preferably written, dated, on letterhead) |
| Build-out costs | Contractor estimates, GC quotes |
| Marketing costs | Vendor quotes (digital agency, signage, etc.) |

## 3.4 Hiring schedule (drives marginality)

USCIS reads the hiring schedule for marginality. A plan that hires only
the Beneficiary in years 1–5 fails *Walsh & Pollard*. A plan that hires
≥ 1 W-2 US worker beyond the Beneficiary by month 12, scaling to ≥ 3
by year 3, materially supports E4.

Recommended granularity:

| Quarter | Role | W-2 / 1099 | Annual gross | Cumulative US worker count (excl. Beneficiary) |
|---|---|---|---|---|
| Q1 Y1 | (Beneficiary as President / Manager) | — | — | 0 |
| Q2 Y1 | Line cook (W-2) | W-2 | $36,000 | 1 |
| Q3 Y1 | Server (W-2) | W-2 | $28,000 (+ tips) | 2 |
| Q4 Y1 | Dishwasher (W-2) | W-2 | $26,000 | 3 |
| Q1 Y2 | Cashier (W-2) | W-2 | $30,000 | 4 |
| … | | | | |

Each role ties back to the operations plan (capacity, hours, expected
service rate) — not invented to clear the marginality bar.

## 3.5 Length norms by sub-type

| Sub-type | Plan length | Why |
|---|---|---|
| 1 (small individual investor, < $250 K) | 30–40 pages | Adjudicator wants substance, not bulk; thin-substance bulk reads as padding |
| 2 / 3 / 4 (corporate, > $1 M) | 50–80 pages | Larger investments invite deeper scrutiny; financial projections + sensitivity analysis carry more weight |
| Renewal | 25–35 pages | Update of original plan + actuals-vs-projections variance analysis + revised year-3-to-5 forward look |

## 3.6 Signature and date

The plan is signed and dated by the Beneficiary (or in employee
sub-types, by the Petitioner's authorized signatory). An undated plan
reads as an off-the-shelf template; a dated plan reads as a current
document the Beneficiary stands behind.

---

# Part IV — Source of Funds Trail

The single most scrutinized element of any individual-investor E-2 file.
Every dollar that lands in the Petitioner's account must trace to a
**lawful, verifiable origin**, through a **continuous chain of
custody**, with **named numbers at every step**.

## 4.1 The five-link chain

```
[Origin]  →  [Conversion]  →  [International transfer]  →  [US deposit]  →  [Deployment to enterprise]
```

| Link | What it proves | Per-step required documents |
|---|---|---|
| **Origin** | Where the money came from (sale of property, salary accumulation, gift, inheritance, business proceeds, lawful loan) | Title deed (sale) / payslips (salary) / gift letter (gift) / probate documents (inheritance) / loan agreement (loan) — **plus** the recipient bank statement showing the proceeds landed |
| **Conversion** | If origin currency ≠ USD: the FX conversion event | FX receipt with: source amount + source currency, target amount + target currency, conversion rate, conversion date, conversion provider name |
| **International transfer** | Cross-border movement | SWIFT confirmation MT103 with: sender name + sender bank + sender account, receiver name + receiver bank + receiver account, amount, value date, reference |
| **US deposit** | Money landed in a US-domiciled account in a name traceable to the Beneficiary or the Petitioner | US bank statement showing the deposit, with date + amount + originator |
| **Deployment** | Money flowed from the US receiving account to the Petitioner (or in MITA settlements, to the seller / co-owner) | Domestic wire / ACH / cashier's check + recipient bank statement |

Every link must carry **named numbers**: the sender's name, the sender's
bank, the last 4 of the sender's account; the receiver's name, the
receiver's bank, the last 4 of the receiver's account.

## 4.2 Named-numbers template

Worked example (Kacar-Salih, redacted last 4):

```
Origin:   Sale of real property at Beşiktaş parcel 1024/7
          Seller: Salih Kaçar (Beneficiary)
          Buyer:  Arda Yılmaz
          Sale price: TRY 4,000,000.00
          Effective date: 2025-11-22 (Tapu Müdürlüğü registry)

Receipts (5 installments):
  TRY 30,000.00      2025-10-15  Akbank, Yılmaz #2103 → Kaçar #4316
  TRY 40,000.00      2025-10-18  Akbank, Yılmaz #2103 → Kaçar #4316
  TRY 2,900,000.00   2025-11-24  Akbank, Yılmaz #2103 → Kaçar #4316
  TRY 1,000,000.00   2025-11-24  Akbank, Yılmaz #2103 → Kaçar #4316
  TRY 30,000.00      2025-11-24  Akbank, Yılmaz #2103 → Kaçar #4316
                     Σ = TRY 4,000,000.00

Conversion:
  Date: 2025-11-25
  Provider: Akbank
  Source: TRY 4,086,900.00 (includes TRY 86,900.00 of unrelated rental balance)
  Target: USD 95,600.00
  Rate:   1 USD = 42.75 TRY

International transfer:
  Date: 2025-11-25
  Sender:   Salih Kaçar, Akbank, account ending #4316
  Receiver: Salih Kaçar, Citibank N.A. (Providence, RI), account ending #2472
  Amount:   USD 80,000.00 (two SWIFT MT103 wires aggregating to total)
  Reference: KSALIH-MITA-202512

US deposit:
  Date: 2025-11-26 (settle date)
  Account: Salih Kaçar, Citibank #2472 (US personal)
  Confirmation: Citibank statement, period 2025-11-01 to 2025-11-30

Deployment to enterprise (MITA settlement):
  Date: 2025-12-11
  Sender:   Salih Kaçar, Citibank #2472
  Receiver: Maria Lopez, Citibank #3772 (the prior 50 % member, settling the MITA consideration)
  Amount:   USD 80,000.00
  Reference: MITA settlement of $120,000.00 total ($80,000.00 upfront + $40,000.00 deferred)
  Underlying: MITA dated 2025-12-05 (Tab D Exhibit D.5)
```

Every step is documented; every step is cross-referenced into the
exhibit index Tab E with a sequential exhibit slot.

## 4.3 Per-source-type playbooks

### 4.3.1 Sale of real property (the Tapu pattern, Subtype 1)

**Origin documents:**
- Prior title deed (proves Beneficiary owned the property — establishes lawful pre-transaction ownership)
- Current title deed (registry record of the sale, with buyer name + sale date + parcel ID)
- Sale-price corroboration (registry record OR notarized sale contract OR TBB payment record)

**Foreign-jurisdiction defensive paragraph (mandatory for Tapu transfers):**

> Under Turkish law and customary practice, real property transfers
> are effected directly through the Tapu Müdürlüğü (Land Registry
> Directorate), and a separate written sales contract is not issued
> in standard title deed transfers. Accordingly, the lawful sale of
> the Beneficiary's real property is evidenced through the official
> Tapu records.

**Common pitfalls:**
- The Tapu transfer date precedes the bank receipts — the registry can
  list a date earlier than payment if installments are negotiated; the
  cover-letter narrative must explain this.
- Cash receipts in TRY at multiple intervals — every installment must
  appear individually in the bank statements; consolidated affidavits
  alone are insufficient.

### 4.3.2 Salary accumulation (savings)

**Origin documents:**
- Employment contract / offer letter establishing the salary
- Bordro (Turkish payslips) or equivalent, ideally 24+ months
- Bank statements showing salary deposits accumulating
- Tax declarations (gelir vergisi beyannamesi) corroborating the salary

**Common pitfalls:**
- Lifestyle expenditures unaccounted — adjudicators ask "if salary was
  $X / month and you saved $Y, where did living expenses come from?"
  The cover letter narrative should address this with one or two
  sentences.
- Salary stated in cover letter ≠ salary in service record / tax
  declarations — fire severity 5 conflict.

### 4.3.3 Gift

**Origin documents:**
- Gift letter on letterhead (donor name, donee name, amount, date,
  signature, "no expectation of repayment" language)
- Donor's source-of-funds proof (bank statement showing the donor had
  the funds; ideally the donor's own SOF chain to a lawful origin)
- Bank confirmation of the gift transfer (SWIFT or domestic wire)

**Common pitfalls:**
- Donor SOF is not investigated — adjudicators sometimes require donor
  SOF (especially gifts > $50K).
- "Loan" relabeled as "gift" to avoid the at-risk requirement (E-2
  funds must be at risk; loans secured against the enterprise's assets
  are NOT at risk under 9 FAM 402.9-6(B)). If the documents read like
  a loan, treat as a loan.

### 4.3.4 Inheritance

**Origin documents:**
- Death certificate of the testator
- Probate / veraset ilamı (Turkish certificate of inheritance)
- Will (if any)
- Distribution record showing the Beneficiary received the assets
- Sale of the inherited assets (if liquidated for the investment)

**Common pitfalls:**
- The Beneficiary inherits in-kind property (real estate) but then
  needs to liquidate it — the SOF chain has TWO origins: the
  inheritance event AND the subsequent sale. Document both.

### 4.3.5 Lawful loan

**Origin documents:**
- Loan agreement: lender, borrower, principal, interest rate, repayment schedule, security (collateral)
- Lender's source of funds (bank statement)
- Bank confirmation of disbursement to the Beneficiary
- For unrelated-party loans: tax / regulatory disclosures of the loan

**Critical at-risk rule.** Under 9 FAM 402.9-6(B), funds borrowed
against the enterprise's assets are **not** at risk and do **not**
count as E-2 investment. Funds borrowed against the Beneficiary's
*personal* assets (e.g., a mortgage on the Beneficiary's residence) **do**
count, because the Beneficiary's personal assets are at risk if the
enterprise fails. This distinction is element-determinative.

### 4.3.6 Business proceeds (Subtypes 2, 3, 4)

**Origin documents:**
- Foreign parent's audited financial statements (showing accumulated
  retained earnings and cash position sufficient to fund the US
  subsidiary)
- Foreign parent's board resolution authorizing the US investment
  (signed, dated, signatories named with titles)
- Shareholder register of the foreign parent (≥ 50 % treaty-national
  ownership)
- Foreign tax filings of the parent (corroborating the financials)

**Common pitfalls:**
- Audited financials > 18 months old at filing — get an interim period
  audit or unaudited interim statements with a CFO certification.
- Board resolution authorizes "up to" $X but actual transfer is $Y > $X —
  amend or get a supplementary resolution.

## 4.4 The defensive narrative

Every SOF chain ends with a defensive narrative paragraph in the cover
letter Section IV, immediately preceding the exhibit citations:

> The Beneficiary's investment of `USD <<amount>>.00` derives from a
> lawful and traceable source: `<<one-sentence origin>>`. The proceeds
> were converted from `<<TRY>>` to `USD` on `<<YYYY-MM-DD>>` at a rate
> of `<<rate>>` and transferred via SWIFT to the Beneficiary's US
> personal account at `<<US bank>>` on `<<YYYY-MM-DD>>`. The funds were
> then deployed to settle the membership-interest transfer consideration
> on `<<YYYY-MM-DD>>`. Each link of the chain is documented.
> (Exhibits: …)

The defensive paragraph is what an adjudicator reads in 30 seconds. The
exhibits are what the adjudicator audits if the defensive paragraph
raises any question.

---

# Part V — Corporate / Incorporation Documents

The Petitioner's entity formation, ownership, and corporate-history
package. Establishes E1 (≥ 50 % treaty ownership) and provides the
documentary backbone that every other element references.

## 5.1 Required documents (Subtype 1 — domestic-only)

| # | Document | Purpose | APS | Source |
|---|---|---|---|---|
| D.1 | Articles of Organization (LLC) or Articles of Incorporation (Corp) | Establishes the legal entity | 5 | State Secretary of State filing copy |
| D.2 | Original Operating Agreement (LLC) or Bylaws (Corp) | Establishes governance, original membership / shareholder structure | 4 | Counsel's office |
| D.3 | Initial Member / Shareholder Resolutions | Documents the original organizing actions | 4 | Counsel's office |
| D.4 | Bill of Sale (if a prior owner transferred to the Beneficiary) | Documents the prior transfer chain (history) | 4 | Counsel's office |
| D.5 | Operating Agreement Amendment / Membership Interest Transfer Agreement (current) | Documents the Beneficiary's current ownership stake | 5 | Counsel's office |
| D.6 | EIN Letter (IRS CP-575) | Confirms the entity has a federal employer identification number | 5 | IRS |
| D.7 | Certificate of Good Standing (current, ≤ 90 days old) | Confirms the entity is in good standing with the state | 5 | State Secretary of State |
| D.8 | State foreign-LLC registrations (if entity operates in states other than the state of formation) | Confirms multi-state operation compliance | 5 | Each state's SOS |

## 5.2 Required documents (Subtypes 2, 3, 4 — foreign parent + US subsidiary)

In addition to the domestic D.1–D.8 (for the US subsidiary), file:

| # | Document | Purpose | APS |
|---|---|---|---|
| D.9 | Foreign parent Articles of Incorporation / Esas Sözleşme / equivalent | Foreign entity exists | 5 |
| D.10 | Foreign parent Operating / Shareholder Agreement | Foreign governance + ownership | 4 |
| D.11 | Foreign parent Shareholder Register (Pay Defteri / equivalent) | Documents ≥ 50 % treaty-national ownership of the foreign parent | 5 |
| D.12 | Foreign parent Audited Financial Statements (most recent) | Substantiates the parent's capacity to fund the US sub | 5 |
| D.13 | Foreign parent Board Resolution authorizing US investment | Documents the corporate decision to invest | 4 |
| D.14 | Foreign parent Tax Filings (most recent year, redacted as needed) | Corroborates the audit | 4 |
| D.15 | Certificate of Good Standing for the foreign parent | Foreign-jurisdiction equivalent — confirms the parent is active | 4 |
| D.16 | Translation certifications for every non-English foreign-jurisdiction document | 8 CFR § 103.2(b)(3) compliance | 5 |

## 5.3 The MITA / Bill of Sale (the ownership-establishing document)

For Subtype 1 cases involving a transfer of an existing entity (rather
than a fresh formation), the **Membership Interest Transfer Agreement
(MITA)** is the single most important document in the entire file.
It establishes:

- Who the Beneficiary is buying the interest from (the transferor).
- The percentage of membership being transferred (must establish ≥ 50 %
  ownership for individual_investor sub-type, OR combined ≥ 50 % with
  treaty-national co-owners).
- The total consideration (this is the **investment amount** that drives
  the I-129E Pt. 2 amount-of-investment field — the § 4.5 deterministic
  gate).
- The role granted to the Beneficiary (member-manager, President, etc.)
  effective on the closing date — drives E5 develop-and-direct.
- The closing date (drives the SOF deployment timeline).

**Required MITA fields (drafting checklist):**

```
☐ Parties (legal names, addresses, signatures)
☐ Effective date
☐ Description of the transferred interest (% of membership)
☐ Total consideration (USD)
☐ Payment schedule (upfront, deferred, escrowed)
☐ Representations and warranties (transferor: clean title, no liens)
☐ Closing conditions (filing of OA amendment, member resolution, etc.)
☐ Governing law (state of formation typical)
☐ Role granted to the Beneficiary (member-manager, President, signatory authority)
☐ Survival clauses
☐ Counterpart and electronic signature acceptance
☐ Exhibit list (Operating Agreement amendment, member resolutions)
```

The bot's contract extractor parses MITAs into a structured form
(`ingest/extractors/contract.ts`); the human attorney must review the
extraction before relying on it.

## 5.4 Member resolutions (the role-granting document)

The member resolution that appoints the Beneficiary to a specific role
(President, Manager, CEO) is the documentary anchor for E5
develop-and-direct. Required content:

- Date of the resolution (must coincide with or follow the MITA effective
  date).
- Members voting (signatures of all current members).
- Resolution text (verbatim): "RESOLVED, that [Beneficiary Name] is
  hereby appointed as [Role] of [Petitioner Legal Name], with
  [authority — signing authority, hire/fire authority, banking
  authority, etc.]…"
- Effective date.

**Common pitfall.** A resolution that grants only a title (e.g.,
"President") without granting any operational authority does not
support develop-and-direct. The resolution must enumerate authority:
contract signing, banking, hiring, day-to-day operations.

---

# Part VI — Operational Evidence (Real & Operating)

E3 requires that the enterprise be **real** (not paper, not pre-launch
indefinitely), **operating** (active commercial activity), and **bona
fide** (lawful, not a sham). Tab G in the firm's exhibit convention
carries this evidence.

## 6.1 The premises chain

| # | Document | Purpose | APS |
|---|---|---|---|
| G.1 | Photographs of business premises (interior + exterior + signage) | Visually establishes the premises exists, is configured for the claimed business, and has the indicia of an operating enterprise | 4 |
| G.2 | Articles of Organization (cross-listed from D.1) | Legal entity exists | 5 |
| G.3 | Commercial lease | Premises secured for ≥ the requested visa term, signed by the Petitioner | 4 |
| G.3.a | Premises licenses (food, alcohol, retail, professional services as applicable) | Lawful operating authority for the specific business | 4 |
| G.3.b | Workers' compensation insurance certificate | Compliance with state employment law | 4 |
| G.3.c | General commercial liability insurance certificate | Operating-business indicia | 3 |
| G.3.d | Utility bills (electricity, water, gas — most recent month) | Premises is active | 3 |

## 6.2 Lease requirements

The commercial lease is read closely by adjudicators. Required content
for a strong E3 / E4 showing:

- Lessor (legal name + address) and Lessee (the Petitioner's legal
  name — must match Articles of Organization exactly).
- Premises address.
- Term (start date, end date — should extend at least through the
  requested visa validity period, ideally + 1 year).
- Rent (monthly + annual; escalation clause if any).
- Security deposit (cited in the investment table as a counted use of
  funds).
- Permitted use (must match the business described in the petition —
  if the lease says "office use only" but the business is a
  restaurant, the lease is defective).
- Signatures (Lessor + Lessee — Lessee must be the Petitioner, not
  the Beneficiary personally; if signed personally, escalate to
  attorney).
- Date of execution.

For Turkish-jurisdiction residential leases used as SOF (rental income),
the **TÜFE escalation defensive paragraph** is required:

> Under Turkish landlord-tenant law, residential lease rents are
> indexed to the Türkiye Üretici Fiyat Endeksi (TÜFE — Producer Price
> Index) on annual renewal, capped statutorily. Accordingly, the
> rental income figure in the Beneficiary's source-of-funds chain
> reflects the indexed rent for the relevant period.

## 6.3 Business bank statements

The Petitioner's US business bank account statements are central. The
firm files at minimum the most recent 12 months of statements (or all
months since formation if shorter).

What adjudicators read from bank statements:

- **Inflows.** Customer payments, vendor refunds, owner contributions,
  loan proceeds. Inflows other than the original investment indicate
  active commerce.
- **Outflows.** Payroll (cross-references payroll register), rent
  (cross-references lease), vendor payments (cross-references
  invoices), tax payments (cross-references tax returns), insurance
  premiums.
- **Cadence.** Multiple inflows and outflows per week indicate active
  operation; sparse activity raises questions.
- **Period covered.** ≥ 12 months ideal.

## 6.4 Vendor and customer evidence

| Document | What it proves |
|---|---|
| Vendor invoices (paid + unpaid) | Active commerce, supplier relationships |
| Customer invoices / POS reports | Revenue generation |
| Industry-data report (IBISWorld / Statista) | Market context for the projections |
| Pre-signed customer contracts (Subtype 4 frequently) | Demand pre-validation |
| Distribution / franchise agreements | Channel structure |
| Trade-show registration / membership in industry association | External validation |

---

# Part VII — Employee Evidence (Marginality)

E4 requires the enterprise to be **more than marginal** — i.e., capable
of producing more than minimal living for the Beneficiary's family,
typically demonstrated through W-2 employment of US workers beyond the
Beneficiary.

## 7.1 W-2 vs 1099 — why W-2 matters

USCIS gives **substantially greater weight** to W-2 employees than to
1099 contractors when evaluating marginality. Reasons:

- W-2 = employer-employee relationship, employer-withheld taxes,
  employer-paid FICA/Medicare/UI — indicates the Petitioner is a real
  employer of US workers.
- 1099 = independent contractor, no withholding, no employer benefits —
  may indicate the Petitioner is more a service-coordinator than a
  real operator.
- Some adjudicators discount 1099 workers entirely for marginality;
  best practice is to have ≥ 1 W-2 employee beyond the Beneficiary by
  the filing date.

## 7.2 Required employee documents

For each W-2 employee (per period):

| # | Document | Purpose | Per-employee or per-period |
|---|---|---|---|
| G.7.a | Form I-9 (Employment Eligibility Verification) | Statutory work-authorization compliance | Per employee, completed at hire |
| G.7.b | Form W-4 (Employee's Withholding Certificate) | Withholding election | Per employee |
| G.7.c | State withholding form (if state has income tax) | State withholding election | Per employee |
| G.7.d | Direct-deposit / pay-method authorization | Operational record | Per employee |
| G.7.e | Form W-2 (annual wage statement) | Annual issuance | Per employee, annually |
| G.7.f | Pay stubs (recent 3 months) | Current employment confirmation | Per employee |
| G.7.g | Government-issued ID (for the I-9) | I-9 verification record | Per employee |
| G.7.h | Social Security Card or Section 1 documentation | I-9 verification record | Per employee |

For the entity:

| # | Document | Purpose | Cadence |
|---|---|---|---|
| G.7.i | Payroll register | Comprehensive employment record | Monthly or per pay period |
| G.7.j | Form 941 (Quarterly Federal Tax Return) | Quarterly federal payroll tax | Quarterly |
| G.7.k | Form 940 (FUTA) | Annual federal unemployment | Annually |
| G.7.l | State unemployment insurance returns | Quarterly state UI | Quarterly |
| G.7.m | Workers' compensation insurance certificate | State law compliance | Annually + on request |

For 1099 contractors (where used):

| Document | Purpose |
|---|---|
| Form 1099-NEC (annual) | Contractor compensation reporting |
| Independent contractor agreement | Documents the IC relationship |
| Tax ID / SSN of contractor | For 1099 reporting |
| Invoice + payment record | Documents the work performed |

## 7.3 The marginality narrative

In the cover letter Section VI, the marginality argument cites:

- Current W-2 employee count (excluding the Beneficiary).
- Cumulative wages paid in the trailing 12 months.
- Hiring schedule from the business plan (year 1 → year 5 W-2 headcount
  growth).
- Quarterly Form 941 totals (corroborating the payroll register).
- The five-year financial projection's payroll line (showing
  payroll-to-revenue ratio).

A clean Subtype-1 marginality argument:

> The Petitioner currently employs `<<N>>` US workers on a W-2 basis
> (excluding the Beneficiary), as documented by the Q4 `<<year>>`
> payroll register (Exhibit: G.7) and corroborated by the Form 941 for
> Q4 `<<year>>` (Exhibit: G.6). Cumulative wages paid in the trailing
> twelve months total `USD <<amount>>.00`. The Petitioner's five-year
> business plan (Exhibit: G.8) projects W-2 headcount growth from
> `<<N>>` in Year 1 to `<<M>>` in Year 5. Accordingly, the enterprise
> is more than marginal under 9 FAM 402.9-6(E).

---

# Part VIII — Spending Reconciliation

The Investment is what the Beneficiary committed; the Spending is what
the Petitioner actually paid out. The two must reconcile within
adjudicator-tolerable bands. Tab E (investment / SOF / at-risk) and
Tab G (operational evidence) together carry this story.

## 8.1 The reconciliation methodology

For every dollar of the investment:

| Field | Source | Question answered |
|---|---|---|
| Amount | Bank statement OR invoice | How much was spent? |
| Date | Bank statement OR invoice | When? |
| Category | Manually classified | What kind of expense? |
| Counterparty (vendor / lessor / employee / counsel) | Invoice OR check | Who received the money? |
| Invoice present? | Document inventory | Is there a third-party document? |
| Bank confirmation present? | Bank statement | Did the money actually leave? |
| Counts toward investment? | Y / N | Is this includable per § 4.5 / § 5.2.1 / 9 FAM 402.9-6(B)? |

## 8.2 What counts toward investment (the includables)

| Category | Counts? | Authority / Rationale |
|---|---|---|
| Lease deposit + first / last month rent | Yes | Direct enterprise-establishment cost |
| Build-out / leasehold improvements | Yes | Direct enterprise cost |
| Equipment purchases | Yes | Direct enterprise cost |
| Initial inventory | Yes | Direct enterprise cost |
| Marketing & advertising | Yes (within reason) | Direct enterprise cost; large pre-launch ad buys may invite scrutiny |
| Working capital (operating reserves) | Yes (≤ 30–40 % of total typical) | Permitted but should not dominate |
| Payroll committed (signed contracts, scheduled hires) | Yes (where committed in writing) | Direct enterprise cost |
| Insurance premiums | Yes | Operating cost |
| Utility deposits | Yes | Direct enterprise cost |
| Legal fees (organizational, lease, MITA) | Partially — most adjudicators allow organizational legal fees (incorporation, OA, MITA); routinely exclude immigration legal fees | Adjudicator-discretionary; many firms include in "use of funds" but flag as potentially excluded |
| Real estate purchase (the building itself) | Generally **NO** | 9 FAM 402.9-6(C) — passive real-estate investment is not a bona fide commercial enterprise. Building purchase as part of an active operation (e.g., hotel + the building it operates in) may be partially includable; flag to attorney |
| Pre-incorporation expenses | Generally **NO** unless directly traceable to the eventual enterprise | Conservative posture |
| Personal expenses (Beneficiary living expenses, vehicles) | **NO** | Not investment in the enterprise |

## 8.3 What does NOT count

- Funds borrowed against the enterprise's assets (9 FAM 402.9-6(B)).
- Speculative future commitments without contracts (9 FAM 402.9-6(C)).
- Real estate held for appreciation (9 FAM 402.9-6(C)).
- Funds in the Petitioner's account but not yet directed to enterprise
  use (i.e., parked cash without a documented purpose) — these are
  arguably "committed" but USCIS wants to see them deployed.

## 8.4 Worked reconciliation table (Wise Guys Deli, Kacar-Salih)

| # | Date | Category | Counterparty | Amount (USD) | Invoice? | Bank conf? | Counts? | Source exhibit |
|---|---|---|---|---|---|---|---|---|
| 1 | 2025-12-11 | MITA settlement to co-owner | Maria Lopez | $80,000.00 | MITA D.5 | Citi 2025-12 | Yes | E.3.a + E.2.c |
| 2 | 2025-12-11 | MITA deferred consideration (escrow) | Maria Lopez | $40,000.00 | MITA D.5 | Citi 2026-01 | Yes | E.3.a + E.2.c |
| 3 | 2026-01-04 | Legal services (organizational) | Akalan Immigration | $8,500.00 | Akalan Inv #2026-001 | Citi 2026-01 | Conservatively yes | E.3.b |
| 4 | 2025-10-01 | Lease deposit | RI Properties LLC | $12,000.00 | Lease G.3 | WGD-Citi 2025-10 | Yes | G.3 |
| 5 | 2025-10-01 | Q4 rent | RI Properties LLC | $9,000.00 | Lease G.3 | WGD-Citi 2025-10 | Yes | G.3 |
| 6 | 2022-03-15 | Kitchen equipment | Restaurant Depot | $18,500.00 | Restdepot Inv 2022-03-15 | WGD-Citi 2022-03 | Yes | G.5 |
| 7 | 2025-10-15 | Inventory (food + supplies, Q4 cumulative) | Sysco Foodservice | $14,000.00 | Sysco Invs Q4 | WGD-Citi 2025-10 / 11 / 12 | Yes | G.5 |
| 8 | 2025-Q4 | Payroll (Q4 employees, gross) | 4 W-2 employees | $32,000.00 | Payroll register G.7.i | WGD-Citi 2025-10 / 11 / 12 | Yes | G.7.i |
| 9 | 2025-12-15 | Marketing (signage + digital) | Local printer + Google Ads | $4,500.00 | Vendor invoices | WGD-Citi 2025-12 | Yes | G.5 |
| | | | **Σ counted** | **$218,000.00** | | | | |

**Reconciliation against the investment:**

```
Total committed (per MITA + cover letter Section IV): $120,000.00
Total counted spending (above):                       $218,000.00
Coverage ratio:                                       181.7 %
Verdict: substantiality robustly supported; spending exceeds
         committed because of operating outflows beyond the
         original capital injection.
```

The bot's deterministic substantiality gate (Part IX) computes this
ratio and fires `substantiality_under_documented` (severity 3) if the
ratio drops below 0.85, or `substantiality_over_documented` (severity
2) if it exceeds 1.15 *as a check on double-counting*. The 181.7 %
above is fine because the over-counting includes ongoing operational
spending that exceeds the original commitment — which is exactly what
a real-and-operating enterprise looks like.

---

# Part IX — The Investment Table (Deliverable Artifact)

The investment table is the single artifact that ties the case
together. It is filed in Tab E (typically as a one-page summary
exhibit) and cross-referenced in the cover letter Section IV.

## 9.1 Structure

The investment table is a wide-form table with these columns:

| Column | Type | Source |
|---|---|---|
| `#` | sequence number | self |
| `date` | ISO date | bank statement OR invoice |
| `category` | enumerated | manually assigned (one of: MITA settlement / lease deposit / lease rent / build-out / equipment / inventory / payroll / marketing / professional fees / insurance / utilities / working capital / other) |
| `counterparty` | string | invoice / contract |
| `amount_usd` | numeric (2 decimal) | bank or invoice |
| `invoice_doc` | filename or "—" | exhibit index |
| `bank_doc` | filename or "—" | exhibit index |
| `counts_toward_investment` | boolean | per § 8.2 |
| `notes` | string | adjudicator-facing explanation if non-obvious |

## 9.2 Substantiality calculation

```
investment_amount        = sum(counts_toward_investment === true)
total_cost_of_enterprise = balance_sheet.total_assets (most recent)
                            OR business_plan.year_1_total_capitalization
proportionality_percent  = investment_amount / total_cost_of_enterprise
```

There is no statutory minimum percentage. Adjudicator practice
(reflected in 9 FAM 402.9-6(C) and the "inverted sliding scale"
guidance) is:

| Total cost of enterprise | Substantial proportionality |
|---|---|
| ≤ $500K | ≥ ~50 % (the smaller the enterprise, the higher the proportionality must be) |
| $500K – $2M | ≥ ~30–40 % |
| $2M – $10M | ≥ ~20–30 % |
| > $10M | ≥ ~10–15 % |

These are practical adjudicator norms, not statutory thresholds. A 50 %
proportionality on a $250 K business is a comfortable file; a 12 %
proportionality on a $500 K business is RFE-prone.

## 9.3 Building the investment table from extracted facts

The bot's pipeline can populate the investment table automatically:

```
For each PDF in the case folder:
  if doc_type ∈ {money_movement, invoice_or_receipt, business_contract}:
    add a row to the investment table
  if doc_type === 'bank_statement':
    parse outflows; for each outflow, attempt to match an invoice on amount + date ± 3 days

Reconciliation pass:
  for each row: set counts_toward_investment per § 8.2 rules
  compute investment_amount = sum(counted)
  pull total_cost_of_enterprise from balance sheet (most recent)
  compute proportionality_percent
  fire substantiality_recon_results audit row
```

The attorney reviews the auto-populated table in the matter dashboard,
edits classifications, and signs off via the pre-generation approval
flow before the table is exported as a filed exhibit.

## 9.4 Common reconciliation failures

| Failure | Symptom | Fix |
|---|---|---|
| Bank outflow exists, no invoice | Bank shows $X paid to a vendor; no invoice in the folder | Request invoice from vendor; if unobtainable, supplement with vendor letter on letterhead |
| Invoice exists, no bank confirmation | Invoice marked "PAID" but no bank outflow within ±90 days | Either invoice was paid in cash (request cash receipt + cash-source narrative), OR invoice is unpaid (mark as committed but unpaid, classify carefully) |
| Bank outflow to a vendor; vendor name doesn't match invoice | Possibly a parent / subsidiary / d/b/a; also possibly a misclassified payment | Request clarification + invoice from vendor with matching legal name |
| Round numbers everywhere | Looks fabricated (real invoices have decimals) | Pull actual invoices, replace rounded estimates |

---

# Part X — Sub-type Variations

## 10.1 Subtype 1 — Individual Investor (Kacar shape)

**Anchor pattern:** one human + small US LLC + personal SOF chain.

**Distinguishing exhibits:**
- Tab D: MITA between prior owner(s) and the Beneficiary
- Tab E: personal SOF chain (Tapu / savings / gift / inheritance / loan)
- Tab H: member resolution appointing the Beneficiary as President /
  Manager + signing authority; CV emphasizing prior P&L / management
  experience

**Cover-letter voice:** law-firm-attorney (Roman numerals II–VIII,
"the Beneficiary," "the Petitioner").

**Authority allowlist:** INA § 101(a)(15)(E)(ii); 8 CFR § 214.2(e);
9 FAM 402.9-4(A) and (B); 9 FAM 402.9-7(1).

**Common pitfalls:**
- Co-owner nationality not properly disclosed → 50 %-threshold
  ambiguity → severity 5 RFE risk.
- SOF chain has missing link (e.g., FX conversion receipt not preserved)
  → severity 4 RFE risk.
- Member resolution grants the role but not the operational authority →
  develop-and-direct weakened.

## 10.2 Subtype 2 — Corporate-Owned Investor

**Anchor pattern:** treaty-country corporation invests in US subsidiary;
human Beneficiary qualifies *because* of the corporate ownership chain.

**Distinguishing exhibits:**
- Tab D: foreign parent's Esas Sözleşme + shareholder register + audited
  financials + board resolution authorizing US investment
- Tab E: parent → US subsidiary wire (NO personal SOF chain)
- Tab D: US subsidiary Articles + EIN + Operating Agreement
- Tab L: spouse + child docs (often present)

**Cover-letter voice:** typically law-firm-attorney, but with corporate
formality. The Beneficiary's role in the foreign parent is an anchor
for E5 if the Beneficiary is a director/officer of the parent.

**Authority allowlist:** + 9 FAM 402.9-4(B); 9 FAM 402.9-6(C); 9 FAM
402.9-7(1) (or 7(2) if Beneficiary is an employee of the corporate
investor).

**Common pitfalls:**
- Treaty-national ownership of the foreign parent < 50 % → element
  failure under 9 FAM 402.9-4(B). Verify the shareholder register at
  filing.
- Audited financials > 18 months old → either get an interim audit OR
  file an attorney certification with current management accounts.
- Board resolution authorizes "up to" $X but actual transfer is $Y > $X
  → amend or supplement.

## 10.3 Subtype 3 — Executive / Supervisory Employee

**Anchor pattern:** Beneficiary is a C-suite / VP / Director / Country
Manager of a qualifying treaty enterprise; nationality of the
Beneficiary must match the qualifying treaty-country nationality of the
enterprise.

**Distinguishing exhibits:**
- Tab D: parent + subsidiary corporate documents (same as Subtype 2)
- Tab B: Job Offer Letter from the Petitioner (US subsidiary) to the
  Beneficiary
- Tab C: Beneficiary CV emphasizing prior P&L responsibility, signing
  authority, supervised teams, prior C-suite or VP titles
- Tab C: compensation evidence (offer letter + salary benchmark) putting
  comp at executive industry / geography levels
- Tab H: Beneficiary's role in the US subsidiary (Org chart + role
  description)

**Cover-letter voice:** petitioner-corporate ("the Petitioner [name]
respectfully submits…"), formal corporate register.

**Authority allowlist:** + 9 FAM 402.9-7(2)(a); 8 CFR § 214.2(e)(17).

**Common pitfalls:**
- Title is "Director" but role is in fact mid-level individual
  contributor → adjudicator scrutinizes role description.
- Compensation below executive market median → fire severity 3
  `salary_below_benchmark` conflict.
- Beneficiary's nationality matches the treaty country, but the
  enterprise's qualifying ownership is in a *different* treaty country
  → mismatch defeats E1.

## 10.4 Subtype 4 — Essential Skills Employee (Camural shape)

**Anchor pattern:** Beneficiary has specialized knowledge essential to
the enterprise; foreign parent + US subsidiary; salary differential vs
US peer market.

**Distinguishing exhibits:**
- Tab D: parent + subsidiary corporate documents
- Tab B: Job Offer Letter (specialized role)
- Tab C: Beneficiary diploma + manufacturer / industry certifications
- Tab C: foreign service record showing salary differential vs US peer
  median
- Tab C: letters of recommendation from prior employers describing
  specialized expertise
- Tab E: parent → subsidiary wire (NO personal SOF chain)

**Cover-letter voice:** petitioner-corporate (same as Subtype 3).

**Authority allowlist:** + 9 FAM 402.9-7(2)(b); 8 CFR § 214.2(e)(18).

**Critical rule.** Foreign-language-and-culture alone is **NOT enough**
for "essential skills." The skill must be technical (engineering,
specific product knowledge, regulatory expertise, patented process,
trade certification). If the Beneficiary's only differentiator is
bilingualism, escalate to attorney; this is a frequent RFE / denial
pattern.

**Common pitfalls:**
- Service record salary differential is < 25 % above local peer median
  → weakens the "specialized knowledge" argument.
- Diploma in a generic field (Business Administration, Economics)
  without industry certifications → role specificity is undermined.
- Letters of recommendation are from personal references, not prior
  employer supervisors → fire severity 3 `personal_reference_letter`
  conflict; replace with prior-employer letters.

---

# Part XI — Common Pitfalls + RFE Triggers

A non-exhaustive catalog, organized by element. Cross-referenced to
the bot's deterministic gates where applicable.

## 11.1 E1 (nationality / ownership)

| Pitfall | Severity | Bot gate |
|---|---|---|
| Treaty-country ownership of the Petitioner < 50 % | 5 | `treaty_ownership_below_50` (§ 3.2 gate) |
| Beneficiary's nationality does not match the qualifying treaty country | 5 | — |
| Co-owner nationality not documented (unable to verify combined ≥ 50 %) | 4 | — |
| Beneficiary holds dual nationality, only the *non-treaty* one is asserted on DS-160 | 4 | — |

## 11.2 E2 (substantial investment / at-risk / source of funds)

| Pitfall | Severity | Bot gate |
|---|---|---|
| MITA total consideration ≠ I-129E investment amount > $100 drift | 5 | `investment_amount_drift` (§ 4.5 gate) |
| Foreign-corporate board resolution authorizes amount that drifts > 10 % vs I-129E | 4 | `board_resolution_amount_drift` (§ 6 gate) |
| FX conversion: source × rate ≠ target ± 1 % | 3 | `fx_rate_drift` (§ 5.2.1 gate) |
| Substantiality coverage ratio < 0.85 | 3 | `substantiality_under_documented` (§ F gate) |
| Substantiality coverage ratio > 1.15 | 2 | `substantiality_over_documented` (§ F gate, possible double-counting) |
| Investment funds borrowed against enterprise assets (not at risk) | 5 | — |
| Real estate purchase classified as investment | 4 | — |
| Pre-incorporation expenses claimed as investment | 3 | — |

## 11.3 E3 / E4 (real and operating / marginality)

| Pitfall | Severity | Bot gate |
|---|---|---|
| No W-2 employees beyond the Beneficiary | 3–4 | `marginality_unsupported` (Sonnet narrative gate) |
| Lease "office use only" but business is restaurant / retail | 4 | — |
| Lease signed by Beneficiary personally, not by the Petitioner | 4 | — |
| No business bank statements OR < 6 months of bank activity | 3 | — |
| No tax return filed (entity in operation > 1 year) | 4 | — |

## 11.4 E5 (develop and direct / specialized employee)

| Pitfall | Severity | Bot gate |
|---|---|---|
| Member resolution grants title but not operational authority | 3 | — |
| Beneficiary CV doesn't match the role being claimed | 3 | `cv_title_vs_offer_drift` (Subtype 4 gate) |
| Letter of recommendation is personal, not employer-supervisor | 3 | `personal_reference_letter` (Subtype 4 gate) |
| Foreign credential not equivalent to US (no credential evaluation) | 2 | `credential_unverifiable` (Subtype 4 gate) |
| Specialized knowledge claim is bilingualism / cultural fluency only | 4 | — |

## 11.5 Procedural

| Pitfall | Severity | Bot gate |
|---|---|---|
| I-94 admit-until < filing date (status violation at filing) | 5 | `status_violation_at_filing` (§ 3.4 gate) |
| Passport expires within 6 months of filing | 3 | `passport_expires_soon` (§ 3.1 gate) |
| Foreign-language document without certified English translation | 3 | `translation_certification_missing` (§ 12.3 gate) |
| Missing signatures on G-28 (one party only) | 4 | — |
| Form edition expired | 4 | — |
| Beneficiary photograph rejected (DS-160) | 2 | — |

## 11.6 Document hygiene

| Pitfall | Severity |
|---|---|
| Entity name drift across Tab D documents (Articles say "Wise Guys Deli LLC", lease says "Wise Guy's Deli, LLC") | 4 — `entity_name_drift` (§ D gate) |
| Inconsistent Beneficiary name spelling (passport native vs filings) — fails I-129 Pt. 2 cross-check | 4 |
| Date inconsistencies (MITA effective 2025-12-05 but member resolution dated 2025-12-01) | 3 |
| Document cited in cover letter not present in exhibit index | 5 (filing rejection risk) |

---

# Part XII — Filing & Post-Filing

## 12.1 Filing mechanics

**Consular routes** (consular_new, consular_renewal):

1. DS-160 + DS-156E completed online for each applicant.
2. Pay MRV fee (typically `USD 315.00` per applicant for E-2 — verify
   current rate at the State Department fee schedule).
3. Schedule consular interview at the post (Ankara, Frankfurt, etc.).
   Wait times vary; check `travel.state.gov`.
4. Assemble the package (cover letter + Tab C–H exhibits) for the
   officer.
5. Attend interview; bring originals + DS-160 confirmation; expect
   60–90 min total time at post.

**USCIS routes** (uscis_cos_new, uscis_extension):

1. Assemble and ship to the appropriate USCIS lockbox (verify current
   address per the I-129 instructions; varies by state).
2. Receive Form I-797C Notice of Action (receipt) within 2–4 weeks.
3. If biometrics required (typically I-539 dependents): receive
   biometrics appointment; appear at ASC.
4. Routine adjudication: 4–8 months without premium processing;
   ~15 business days with premium processing.
5. Receive Form I-797 Approval Notice OR RFE / NOID / Denial.

## 12.2 Premium processing (USCIS routes only)

I-129 with E-2 classification is currently eligible for premium
processing (`USD 1,685.00` as of writing — verify current Form I-907
fee).

When to elect:
- Beneficiary's prior status expires soon.
- Petitioner needs the Beneficiary on payroll quickly.
- Beneficiary needs to travel internationally and re-enter on the new
  status.

When to skip:
- Standard timeline acceptable.
- Substantive RFE risk is high (premium-processed cases are still
  subject to RFE; the 15-day clock pauses during RFE response).

## 12.3 Receipt and biometrics handling

- Receipt notice (I-797C): file in matter folder; record receipt number
  in case management; transmit to client.
- Biometrics: scheduled by USCIS; client appears at ASC with
  appointment notice + government-issued ID. Typically a fingerprint /
  photo session, ~30 minutes.
- If biometrics need to be rescheduled (travel, illness): submit a
  rescheduling request via USCIS online account + maintain copy of
  the original notice.

## 12.4 Interview prep (consular)

Two weeks before the interview:

- Confirm appointment time + post.
- Brief the client on common questions:
  - "Tell me about your business."
  - "How much have you invested? Where did the money come from?"
  - "How many employees do you have?"
  - "What is your role at the company?"
  - "When do you intend to return to [Treaty Country]?"
- Prepare the client to bring:
  - Passport (current + any prior).
  - DS-160 confirmation barcode (printed).
  - Petition packet (consular copy — Tab A excluded; Tabs B–H + L).
  - Originals of all foreign-jurisdiction documents.
  - Recent business bank statements.
  - Recent payroll records.
- Brief on demeanor: confident, concise, factual. Do not volunteer
  information beyond what is asked. Do not argue with the officer.

## 12.5 RFE / NOID response

If the officer issues a Request for Evidence (RFE) or Notice of Intent
to Deny (NOID):

1. **Read carefully.** RFEs identify specific evidentiary deficiencies
   (e.g., "submit additional evidence of substantiality" — what does
   the officer want?). NOIDs are more serious — the officer has tentatively
   decided to deny and is giving a final chance to rebut.
2. **Calendar the deadline.** RFE response window is typically 60–87
   days; NOID response is typically 30 days. Missing the deadline is
   fatal.
3. **Respond comprehensively.** Address every question asked, with
   targeted exhibits + a focused legal brief that anchors back to the
   five elements.
4. **Pre-consult attorney supremacy.** Significant RFE / NOID responses
   should be reviewed by the supervising immigration attorney; the
   bot's drafter is not authorized to ship NOID responses without
   attorney approval (see the pre-generation approval flow).
5. **File via the same lockbox** that issued the RFE / NOID, with the
   RFE / NOID barcode page on top.

## 12.6 Approval handling

On approval:

- I-797 Approval Notice received.
- For consular routes: visa is issued at the consulate; client returns
  the passport with the visa stamp.
- For USCIS routes: I-94 is updated electronically; client retrieves
  the new I-94 from the CBP I-94 website.
- Send the client a closing letter:
  - Approval notice copy.
  - New I-94 (USCIS routes) or visa stamp page (consular routes).
  - Validity period.
  - **Renewal calendar entry** (typically 60 days before expiration —
    set a calendar reminder).
  - Travel guidance (re-entry rules under the new status).
- Update the matter file to "approved" status. Archive per the firm's
  retention policy (typically 7 years).

## 12.7 Renewal triggers

E-2 status is granted for up to 2 years (USCIS) or up to 5 years
(consular, depending on treaty country reciprocity). Renewal can be
filed:

- USCIS: up to 6 months before expiration; ideally 4 months out to
  avoid status gap risk.
- Consular: any time before passport / visa expiration; the visa stamp
  remains valid for re-entry until its own expiration date even if I-94
  expires.

Renewal-trigger calendar reminders should be set at intake:
- 6 months before expiration → renewal kickoff.
- 4 months before expiration → packet assembly should be underway.
- 2 months before expiration → file (USCIS) or schedule consular
  appointment.

The renewal package mirrors the original but emphasizes:
- **Continuity** (prior visa stamp + prior I-94 in Tab C).
- **Compliance** (prior E-2 employment payroll in Tab C).
- **Active operation since prior approval** (updated bank statements,
  tax returns, payroll register in Tab G).
- **Updated business plan** with actuals-vs-projections variance
  analysis (the Year 1 actuals against the original Year 1 projections;
  if variance > 25 %, narrative explanation in cover letter).

---

## Closing notes

This manual is paired with:
- `manuals/E2-MANUAL-FOR-CLAUDE-CODE.md` — the firm's AI-facing manual
  driving the bot's per-document extraction and cover-letter drafting.
- `manuals/01-COVER-LETTER-TEMPLATE.md` — the cover-letter Roman-numeral
  template.
- `manuals/02-CASE-FILE-STRUCTURE.md` — the firm's case-folder
  organization on disk.
- `manuals/03-EXHIBIT-INDEX-TEMPLATE.md` — the Tab A–L exhibit-index
  template.
- `manuals/_E2-SUBTYPE-TAXONOMY.md` — the Phase-0.6 sub-type decision
  tree.
- `manuals/MANUAL-SUBTYPE-1-Individual-Investor.md` (and 2 / 3 / 4) —
  per-sub-type calibration manuals.

**Maintainer note.** This manual is a living document. When USCIS or
DOS revises a form, a fee, or a policy, update the affected section
and bump the version stamp below. Form-edition checks at filing time
are non-negotiable.

**Version.** v1.0 — 2026-04-29 — Akalan Business Immigration

— end of manual —
