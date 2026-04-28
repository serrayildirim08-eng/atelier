# E-2 Consular-Side Filing Path: Citation-Anchored Research

**Prepared:** 2026-04-28
**Audience:** Akalan Portal AI paralegal — fills the consular-process gap in the existing I-129 renewal-calibrated E-2 doctrine.
**Convention:** Each non-trivial claim is tagged `(source — retrieved 2026-04-28)`; confidence is `high` (primary DOS/USCIS/9 FAM), `medium` (consulate post pages or aggregated practitioner sources with multiple corroborations), or `low` (single practitioner blog or inferred). FACT vs PATTERN tags are used where the line matters.

---

## 1. DS-160 (Online Nonimmigrant Visa Application) for E-2 cases

**Form basics.** DS-160 is the universal NIV electronic application; every E-1, E-2, E-2S spouse, and E-2D child applicant files their own. It is hosted on the Consular Electronic Application Center (CEAC). Confirmation page barcode (CEAC ID) is taken to interview. (`travel.state.gov / DS-160 — retrieved 2026-04-28`, FACT, high)

### 1.1 E-2-specific DS-160 fields applicants commonly fumble

- **"Purpose of Trip" / Visa Class.** Must select the precise sub-class: `E1 - TREATY TRADER`, `E2 - TREATY INVESTOR`, `E2 - EXEC/MGR/ESSENTIAL EMP`, or the dependent variants `E2 - CHILD OF TREATY INVESTOR` / `E2 - SPOUSE OF TREATY INVESTOR`. Picking the wrong sub-class (e.g. principal investor selecting "Exec/Mgr/Essential Employee") routes the file to the wrong DS-156E rule path. (PATTERN; multiple practitioner sites — medium)
- **"Have you been issued a U.S. visa in the last ten years?"** plus prior-visa number. For renewals this MUST match the prior E-2 visa foil exactly; transposed digits are a documented 221(g) trigger. (`rnlawgroup.com — retrieved 2026-04-28`, PATTERN, medium)
- **Present/Previous Employer block.** Salary, title, address, and dates must reconcile with the DS-156E Part III and any I-129 record. Material divergence ("CEO" on DS-156E vs "Director" on DS-160) is itself a 221(g) flag. (`rnlawgroup.com — retrieved 2026-04-28`, PATTERN, medium)
- **"Have you ever been refused a U.S. visa, been refused admission, or had a visa cancelled?"** Any prior 221(g) — including the present one if previously issued — counts as a refusal under DOS practice. False "No" answers are the single most cited DS-160 defect. (`thecassellfirm.com / kasturilaw.com — retrieved 2026-04-28`, PATTERN, high)
- **Unlawful presence / overstay question.** A common 2025 221(g) source per Reddy Neumann Brown. (`rnlawgroup.com — retrieved 2026-04-28`, PATTERN, medium)
- **Travel companions / Travel paid by.** For E-2 employees, the "paid by" must name the U.S. enterprise, not the principal investor personally — mismatches cue source-of-funds questions. (PATTERN; practitioner — low)

### 1.2 2025-26 DS-160 updates

- **Public-social-media requirement (DS-160 social handles).** Effective **18 June 2025** State announced that F, M, J applicants must set social profiles to "public"; expansion to **H-1B / H-4 effective 15 Dec 2025**. E-category is NOT yet listed in the public-profile mandate, but the 5-year handle disclosure on DS-160 has applied to all NIV applicants since 2019 and is unchanged. (`colorado.edu/isss/2025/07/16 — retrieved 2026-04-28`; `tandslaw.com — retrieved 2026-04-28`, FACT, high) **[NEEDS VERIFICATION whether DOS extended the public-profile rule to E-category by April 2026.]**
- **In-person rule.** Effective **2 September 2025** all NIV applicants regardless of age must appear in person; the prior under-14 / over-79 exemption is gone. Applies fully to E-2D children. (`travel.state.gov / news; multiple practitioner aggregators — retrieved 2026-04-28`, FACT, high)
- **"Visa Integrity Fee" — $250.** Enacted in HR-1 ("One Big Beautiful Bill Act") on **4 July 2025**, charged at issuance (not application). As of late March 2026 the payment mechanism is still not operational and Bureau of Consular Affairs has not pushed implementation guidance to posts. (`cnbc.com / 2025-07-18`; `gtlaw-insidebusinessimmigration.com — retrieved 2026-04-28`, FACT for the law / PATTERN for "not yet operational", medium) **[NEEDS VERIFICATION when DOS turns the fee on.]**

### 1.3 Common DS-160 errors that produce 221(g) on E-2 specifically

| Error | Why it bites E-2 | Source |
|---|---|---|
| Title / salary mismatch with DS-156E and I-129 record | Officer reads E-2 file as inconsistent on managerial / essential-employee role | `rnlawgroup.com — retrieved 2026-04-28` (PATTERN, medium) |
| Investment amount listed in DS-160 "Other Information" inconsistent with DS-156E Part II | Substantiality challenge | Practitioner consensus (PATTERN, medium) |
| Source-of-funds narrative omitted on DS-160 but present in cover letter | Officer flags incomplete disclosure | Practitioner (PATTERN, low) |
| Wrong company name / FEIN (using d/b/a vs legal entity) | E-Visa Unit registration mismatch | Practitioner (PATTERN, medium) |

---

## 2. DS-156E (Nonimmigrant Treaty Trader / Investor Application)

### 2.1 Form metadata
- OMB Control Number **1405-0101**, current OMB approval **expires 30 April 2026**, latest 30-day Federal Register notice 28 Aug 2024 (extension and revision). (`federalregister.gov 2024-19259; omb.report 1405-0101 — retrieved 2026-04-28`, FACT, high)

### 2.2 Who must file DS-156E (FACT, high — `9 FAM 402.9-9` and `travel.state.gov/treaty-trader-investor` — retrieved 2026-04-28)

- **Required:**
  - All E-1 treaty trader applicants (Parts I, II, III).
  - E-2 **Executive / Manager / Essential Employee** applicants (Parts I, II, III) — Parts I and II are completed by the qualifying U.S. enterprise; Part III by each individual employee applicant.
- **NOT required:**
  - **Principal E-2 investors** applying as the owner of the enterprise (DOS treats the substantive showing as built into the consular package + DS-160 + supporting binder, not a separate DS-156E). This is the most-missed piece for U.S. counsel transitioning from I-129 practice.
  - **All E-1 / E-2 derivatives** (spouse, children under 21).

> Practical note: when a single treaty enterprise sends multiple essential-employee applicants over a 5-year window, **Parts I and II can be re-used** if no material change has occurred and the enterprise is registered with the post's E-Visa Unit; only Part III is re-filed per applicant. (`9 FAM 402.9-9` "company registration" guidance, expanded 2023 — `ogletree.com — retrieved 2026-04-28`, FACT, high)

### 2.3 Section-by-section content

**Part I — Petitioner / Employer (signed by an authorized officer of the U.S. enterprise; not the applicant)**
- Legal name, d/b/a, U.S. address, FEIN, date and state of incorporation
- Type of business (NAICS-style category) and whether sole proprietorship / partnership / corporation / LLC / branch of foreign parent
- Treaty country of nationality of the enterprise (≥50% ownership test)
- Names and nationalities of owners holding ≥50%
- (`ds156_e.PDF — eforms.state.gov — retrieved 2026-04-28`, FACT, high; field-level details corroborated by `boundless.com/form-ds-156e-explained — retrieved 2026-04-28`, medium)

**Part II — Investment / Trade / Staffing (signed by the same enterprise officer)**
- Total amount invested + breakdown by category (real property, equipment, inventory, working capital, lease deposits, fees, etc.) — this is the **substantiality** showing
- Source of investment funds (personal savings / loan / sale of asset / gift) and whether funds are "at risk" and committed
- Annual gross / net income, US-source revenue
- Total U.S. employees by category (US workers, treaty-country nationals in E status, principal investor), broken out as essential vs ordinarily skilled
- Future hiring plan (typical 5-year horizon)
- (`ds156_e.PDF — retrieved 2026-04-28`, FACT, high)

**Part III — Applicant / Employee (signed by the individual applicant)**
- Position title, salary, duration sought, % time in supervisory vs hands-on duties
- Education, prior experience, language skills, and **why the role is "essential"** (for essential-employee track) — i.e. specialized skills not readily available in the U.S. labor market
- Prior U.S. status / prior E visas
- (`ds156_e.PDF — retrieved 2026-04-28`, FACT, high)

### 2.4 What attaches to DS-156E (PATTERN aggregated from consulate post checklists, medium)
- Company registration / good-standing certificate, articles of incorporation, ownership chart proving treaty-nationality
- Business plan with 5-year pro forma (especially for new enterprises — marginality rebuttal)
- Tax returns (federal + state), audited financials or CPA-prepared statements, bank statements
- Lease, equipment receipts, payroll records (I-9s, W-2s, quarterly 941)
- For source of funds: bank wires, gift letters, sale-of-asset proof traced to the U.S. business account
- For Part III applicant: CV, diplomas (with translations), professional licenses, prior employment verification, salary letter

### 2.5 How DS-156E differs substantively from the I-129 E supplement

| Dimension | I-129 + E supplement | DS-156E |
|---|---|---|
| Adjudicator | USCIS service center (CSC for E-2) | Consular officer + post's E-Visa Unit (E-VU) / Treaty Visa Unit |
| Standard of review | Preponderance, deference to prior approvals codified | Same substantive law (INA 101(a)(15)(E), 8 CFR 214.2(e), 9 FAM 402.9) but officer reviews **de novo** at first-time consular case (`9 FAM 402.9-7` — high) |
| Form field granularity | I-129 Supplement E asks for fewer line items; cover letter carries the load | DS-156E itself **contains** the substantiality table — Part II line-by-line breakdown of investment is mandatory on the form, not just in the memo |
| Dependents | Filed on I-539 separately | No DS-156E required; covered by their own DS-160 only |
| Re-use across applicants | None — each I-129 stands alone | Parts I & II re-usable across employees within the registration window (5-year customary review) |

### 2.6 Common DS-156E errors (PATTERN, medium)
- Listing the **foreign parent** as the U.S. employer in Part I (Part I asks for the U.S. enterprise that is the qualifying business)
- Investment "at risk" total in Part II that double-counts uncommitted funds
- Part III "essential" narrative recycled from I-129 cover letter without tightening to the consular standard ("specialized" + "for a finite period to train U.S. workers" or "qualifications not readily available")
- Mismatched signature dates across Parts I/II/III (post will sometimes refuse to accept)
- Old form revision (the eforms.state.gov master is the only authoritative version)

---

## 3. Pre-interview document package — the "interview binder"

### 3.1 Tabbed binder structure (PATTERN — corroborated by U.S. Embassy France required-format page and the multi-post template hosted on `common.usembassy.gov/.../E2-Requirements.pdf — retrieved 2026-04-28`; medium-high)

A typical post-published structure (applicant brings two identical binders — one for the post to retain, one to keep):

- **Section A — Cover Letter (legal memorandum) + Table of Contents**
- **Section B — Forms:** DS-160 confirmation; DS-156E Parts I, II, III; MRV fee receipt
- **Section C — Applicant-personal:** passport bio page, prior visas, photos, CV, diplomas, marriage / birth certificates for derivatives
- **Section D — Treaty nationality of business:** ownership chart, share certificates / cap table, passports of ≥50% owners
- **Section E — Real & Operating enterprise:** articles of incorporation, certificate of good standing, business licenses, lease, utility bills
- **Section F — Substantial investment:** source-of-funds tracing, wire receipts, escrow / closing statements, equipment invoices, capital-expenditure ledger
- **Section G — Not marginal:** business plan with 5-year financial projections, current P&L, payroll showing U.S. workers, tax returns
- **Section H — Develop & Direct (principal) OR Essential / Executive role (employee):** ownership %, board minutes, organizational chart with applicant boxed; for employees the Part III qualifications proof
- **Section I — Intent to depart / non-immigrant intent:** statement of intent, foreign ties evidence (real estate, family, foreign tax residency)

### 3.2 Order consular officers actually consume (PATTERN, medium — synthesized from consulate FAQ pages and practitioner guides incl. Scott Legal, Reddy Neumann Brown — retrieved 2026-04-28)

1. **Cover letter** — first 2 pages skimmed
2. **DS-156E Part II** — substantiality table
3. **Source-of-funds tab** — they pull random wires and ask "where did this come from"
4. **Treaty-nationality proof** — ownership chart
5. **Business plan first page + financial projections summary**
6. Everything else only on follow-up question.

### 3.3 The consular analog of the "I-129 cover letter"

It is a **legal memorandum to the consulate** — usually 8–15 pages — addressed `Dear Consular Officer` (not `Director` as in I-129). Practitioner conventions (PATTERN, medium):
- Element-by-element walk-through of `9 FAM 402.9-3` through `402.9-7` (treaty-country, substantial investment, real & operating, not marginal, develop & direct, source of funds)
- For each element, parenthetical pinpoint to the exact tab letter and exhibit number ("see Tab F-3, wire receipt of 12 Mar 2025")
- Closing paragraph stating **unequivocal intent to depart** when E status ends — the consular standard differs from USCIS in that nonimmigrant intent is litigated more closely at the post (`9 FAM 402.9-4` and Australia E-3 guidance carry this through — `ogletree.com — retrieved 2026-04-28`, high)

### 3.4 Originals + copies; translations
- **Originals** at the interview window for inspection of: passport, marriage / birth certificates, diplomas. (`travel.state.gov` — high)
- **Copies** in the binder (NEVER staple originals into the binder).
- **Translations:** any non-English document needs a **certified English translation** under 22 CFR 41.103. The translator certifies competence; notarization is not required by DOS but several posts request it. (FACT, high — `22 CFR 41.103`; PATTERN at post level — medium)

---

## 4. Photograph specifications

### 4.1 Specs (FACT, `travel.state.gov/photos.html — retrieved 2026-04-28`, high)
- **Square**, 2 × 2 inches (51 × 51 mm) printed; digital upload 600 × 600 px, JPEG, ≤ 240 kB
- **Head size:** 1 to 1 ⅜ inches (22–35 mm) from chin to top of head, OR 50%–69% of total image height
- **Background:** plain white or off-white
- **Recency:** taken within the **last 6 months**
- **No eyeglasses** (since 1 Nov 2016) absent rare medical exception with documentation
- **No headwear** unless religious daily wear; full face visible, no shadows

### 4.2 Common rejection reasons (FACT, `travel.state.gov/photos.html — retrieved 2026-04-28`, high)
- Wrong head size (most frequent)
- Tinted or colored background (cream, gray, blue)
- Eyeglasses worn
- Shadow on face or behind head
- Digitally altered / "beautified" / smartphone "portrait mode" depth-of-field artifact
- Old photo (>6 months) — caught by visible appearance change vs DS-160 file
- Print quality (vending machine, low-DPI inkjet)

---

## 5. MRV fee + reciprocity issuance fee mechanics

### 5.1 Current fee amounts (FY2026)
- **E-1 / E-2 MRV fee: $315.00** per applicant (non-refundable, non-transferable). (`travel.state.gov/fees-visa-services — retrieved 2026-04-28`, FACT, high)
- Standard B/F/M/J MRV: $185 (FACT, high)
- H/L/O/P petition-based MRV: $205 (FACT, high)
- **Visa Integrity Fee: $250** signed into law 4 Jul 2025 — payable at **issuance**, not application; **not yet operational at posts as of late March 2026** per Bureau of Consular Affairs. CPI-indexed from FY2026. (`cnbc.com 2025-07-18`; `gtlaw-insidebusinessimmigration.com — retrieved 2026-04-28`, FACT for the law, PATTERN for "not yet collected", medium) **[NEEDS VERIFICATION whether the fee began being collected between late March and 28 April 2026.]**

### 5.2 Reciprocity / issuance fee
- **Separate from MRV** and only owed if the applicant's country of nationality charges U.S. citizens a comparable fee for E-equivalent visas. Look up at **travel.state.gov → "U.S. Visa: Reciprocity and Civil Documents by Country"** → country page → row "E-1" or "E-2" → columns: fee, number of entries, validity in months. (`travel.state.gov/Visa-Reciprocity-and-Civil-Documents-by-Country — retrieved 2026-04-28`, FACT, high)
- **How to read a row:** e.g. Turkey E-2 — historically 60 months / multiple / $0 issuance fee (the Turkey-US BIT is reciprocal-friendly). [NEEDS VERIFICATION of current FY2026 Turkey row exact numbers — caller should re-check the live table at filing time.]
- **Refundability:** MRV fee is **non-refundable, non-transferable** between applicants and **non-transferable between visa categories** (since the post-2022 rule tightening). MRV is valid **for 365 days from payment for scheduling and using** under most posts. Reciprocity issuance fee paid only on issuance and is **not refunded if the visa is later revoked**. (`manifestlaw.com/mrv-fee — retrieved 2026-04-28`, PATTERN/medium for the 365-day rule; `travel.state.gov` for non-refundability — high)

---

## 6. Post-issuance / port-of-entry steps

### 6.1 Visa stamp annotations (FACT, `9 FAM 402.9-9` annotation guidance — corroborated by `legalservicesincorporated.com / kpmg.com — retrieved 2026-04-28`, high)

The visa foil's **"Annotation"** field carries a coded string the consular officer types in:

| Annotation | Meaning |
|---|---|
| `E-2 PRIN` (or `PRINCIPAL`) | Principal treaty investor |
| `E-2 EMPL OF [COMPANY], EXP [date]` | Executive / Manager / Essential Employee — must name the qualifying enterprise and a tie-back date |
| `E-2D SP, [PRINCIPAL NAME]` | E-2 dependent spouse, naming the principal |
| `E-2D CH, [PRINCIPAL NAME]` | E-2 dependent child, naming the principal |

Some posts now include the **petition number / E-VU registration number and expiration**, per the 2023 9 FAM update on company registration (`ogletree.com — retrieved 2026-04-28`, high).

### 6.2 I-94 issuance and the 2-year admission rule
- E-2 admissions are **2 years per entry** under **8 CFR 214.2(e)(20)**, regardless of how many years the visa foil itself is valid. Re-entering on a 5-year visa resets the 2-year I-94 each time. (FACT, high — `8 CFR 214.2(e)(20)`)
- The I-94 is generated electronically at POE; CBP issues a paper Form I-94 only at land borders or on request. Always retrieve at **i94.cbp.dhs.gov** post-arrival to confirm Class of Admission and expiration.

### 6.3 The "S" annotation for E spouses (post-Nov 2021 / Jan 2022)
- USCIS / CBP began issuing I-94s with **`E-2S`** Class of Admission for E-2 spouses on **30–31 January 2022**, implementing the November 2021 USCIS Policy Manual change. (`uscis.gov / Policy Manual Vol 10 Pt B Ch 2 — retrieved 2026-04-28`; `ogletree.com — retrieved 2026-04-28`, FACT, high)
- An unexpired `E-2S` I-94 is **work authorization incident to status** — accepted as **List C document for Form I-9** (List C #7 acceptable receipt category per USCIS guidance). No EAD (I-765) is required, though some employers still ask for one. (`uscis.gov — retrieved 2026-04-28`, FACT, high)
- E-2 children remain `E-2D` (no work authorization).
- Pre-Jan-2022 spouses who still hold `E-2` (no S) I-94s received transitional notices treating the I-94 plus the notice as I-9 evidence. (`uscis.gov — retrieved 2026-04-28`, FACT, high)

### 6.4 Common POE issues (PATTERN, medium)
- CBP officer admits the spouse with `E-2` instead of `E-2S` Class of Admission — must request a **deferred-inspection appointment** to correct the I-94, otherwise employer cannot complete I-9 on List C.
- I-94 expiration set to passport expiration (the **lesser-of-passport rule**) when passport has under 2 years validity — common for Turkish, Pakistani applicants — collapses the expected 2-year admission window.
- Annotation foil omits the company name on E-2 EMPL — POE officer may ask for the original visa-application binder; bring it in carry-on.

---

## 7. 221(g) "administrative processing" patterns — E-2 specific (2025-26)

### 7.1 What 221(g) is (FACT, high — `travel.state.gov/administrative-processing-information — retrieved 2026-04-28`)
A **refusal under INA § 221(g)** is technically a denial that the consulate may overcome upon: (a) further documents from applicant, (b) inter-agency security check (SAO Donkey, Hawk, Mantis, etc.), or (c) policy review. Passport may be held or returned.

### 7.2 E-2-specific 221(g) triggers (PATTERN, medium — synthesized `rnlawgroup.com`, `infoimmigration.com`, `migratemate.co`, `npzlaw.com — retrieved 2026-04-28`)

1. **Source-of-funds gap** — wire from a third party (parent, holding co.) without a gift letter or board resolution
2. **Substantiality near the floor** — investment under ~$100K with thin business-plan numbers
3. **Speculative / not-yet-operational enterprise** — pre-revenue, no employees, lease only signed
4. **Marginality concern** — single-investor consulting LLC with no projected hires and modest profit
5. **Treaty nationality unclear** — multi-tier holding structure with non-treaty intermediate parent
6. **Prior visa file inconsistency** — DS-160 / DS-156E / I-129 record divergence
7. **Security checks** — SAO triggered by name match, dual-use technology business (semiconductors, drones, biotech), or country of birth
8. **Social-media flag** — increasingly cited 2025+ when public profiles show employment that contradicts DS-160

### 7.3 Typical resolution timeline (PATTERN, medium)
- Documents-only 221(g): **2–8 weeks** after submission; some posts auto-close in 90 days if applicant doesn't respond
- Security-check (SAO) 221(g): **30–180 days**, occasional 6+ months for sensitive-technology cases
- Policy-review (E-VU re-registration / re-look at company): **30–120 days**

### 7.4 What to do while pending (PATTERN, medium)
- Track CEAC status; if "Refused" stays > 60 days, send a polite written follow-up to the post via post-specific E-Visa Unit email (most posts publish one)
- If passport returned, the applicant **may travel internationally but cannot enter the U.S.** until the visa is issued
- LegalNet inquiry to State (`LegalNet@state.gov`) if attorney follow-up; Congressional inquiry (Senate / House liaison) past 90–120 days
- Mandamus litigation only after typically 6+ months unreasonable delay

---

## 8. Consular interview prep — practitioner approach

### 8.1 Mock interview question list — E-2 specific (PATTERN, medium — synthesized `rnlawgroup.com`, `pandevlaw.com`, `nnuimmigration.com`, `e2visalawyer.net — retrieved 2026-04-28`)

**Business questions (most weight)**
- "Tell me about your business in 30 seconds."
- "What does your company do, who are your customers, and how do you make money?"
- "How many U.S. employees do you have today, and what's your hiring plan for the next 2 years?"
- "What's the address of your office? Walk me through what's there."

**Investment / source of funds**
- "How much have you invested, and on what?"
- "Where did the money come from? Walk me through each wire."
- "Are these funds at risk if the business fails?"
- "Was any of the investment financed? By whom, and is it secured by your personal assets?"

**Role**
- "What is your title? What do you do day to day?"
- "Who reports to you? Who do you report to?"
- (Essential employee) "Why can't a U.S. worker do this job? Have you trained anyone? When will the U.S. worker take over?"

**Intent to depart**
- "What will you do when your E-2 ends?"
- "Do you have a home / family / business interests in [home country]?"

**Treaty nationality**
- "Who owns the company? Are they citizens of [treaty country]?"

### 8.2 Model answer structure (PATTERN, medium)

For each question, the practitioner-coached pattern is **short → specific → tab-pointer**:
> *"I have invested $325,000 since opening, primarily in equipment and three months of working capital. The funds came from the sale of my Istanbul apartment in March 2025; the closing statement and the wire to our U.S. business account are in Tab F-2 if you'd like to see them."*

Avoid: monologue, jargon, hedging, memorized scripts. Officers are trained to detect coaching (`pandevlaw.com — retrieved 2026-04-28`, PATTERN, medium).

### 8.3 When the officer pulls in the spouse vs. only interviews principal (PATTERN, medium)
- Most posts **interview principal alone** when family members are derivative; spouses appear at the window for fingerprinting, oath, and document submission only.
- Spouse pulled in for substantive questioning when:
  - Joint property / financial co-mingling on source-of-funds is material
  - Marriage genuineness is queried (rare for E-2 vs K-1)
  - Spouse is an **owner** in their own right (joint investors → both treated as principals)
  - Spouse intends to use `E-2S` work authorization at a sensitive-industry employer

---

## Open items (NEEDS VERIFICATION)

- Whether DOS expanded the public-social-profile mandate to E-category between Dec 2025 and April 2026 (no public announcement found; check `travel.state.gov` news).
- Whether the $250 Visa Integrity Fee began being collected at posts before 28 April 2026.
- Current Turkey E-2 reciprocity row (validity / number of entries / issuance fee) for FY2026 — the live table is the only authoritative source at filing time.
- Whether the 9 FAM 402.9-9 annotation guidance has been amended in 2025 to reflect the "S" suffix on the **visa foil annotation** (we know I-94 is `E-2S`; the foil itself may still read `E-2D SP`).

## Primary sources cited (retrieved 2026-04-28)

- 9 FAM 402.9 — `https://fam.state.gov/fam/09FAM/09FAM040209.html`
- DS-156E PDF + instructions — `https://eforms.state.gov/Forms/ds156_e.PDF`
- Travel.state.gov — Treaty Trader & Treaty Investor — `https://travel.state.gov/content/travel/en/us-visas/employment/treaty-trader-investor-visa-e.html`
- Travel.state.gov — Photos — `https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos.html`
- Travel.state.gov — Fees for Visa Services — `https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/fees/fees-visa-services.html`
- Travel.state.gov — Visa Reciprocity by Country — `https://travel.state.gov/content/travel/en/us-visas/Visa-Reciprocity-and-Civil-Documents-by-Country.html`
- Travel.state.gov — Administrative Processing — `https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/administrative-processing-information.html`
- USCIS Policy Manual Vol 10 Pt B Ch 2 (E spouse work authorization) — `https://www.uscis.gov/policy-manual/volume-10-part-b-chapter-2`
- USCIS — E-2 Treaty Investors — `https://www.uscis.gov/working-in-the-united-states/temporary-workers/e-2-treaty-investors`
- 8 CFR 214.2(e); 22 CFR 41.51; 22 CFR 41.103
- Federal Register — DS-156E ICR 30-day notice 28 Aug 2024 — `2024-19259`
- Multi-post E-2 Requirements template — `https://common.usembassy.gov/wp-content/uploads/sites/71/2022/12/E2-Requirements.pdf`

## Practitioner sources cited (retrieved 2026-04-28)

- Ogletree Deakins — State Dept E-Visa update (2023, still operative) — `ogletree.com/.../state-department-releases-updated-guidance-for-e-visa-processing/`
- KPMG flash alert 2022-030 — I-94 E-2S annotation start — `kpmg.com/.../flash-alert-2022-030.html`
- Reddy Neumann Brown — DS-160 / 221(g) / E-2 prep — `rnlawgroup.com`
- Scott Legal — E-2 spouse / interview — `legalservicesincorporated.com`
- Pandev Law — E-2 interview questions — `pandevlaw.com`
- NNU Immigration — DS-156E / E-2 interview — `nnuimmigration.com`
- Boundless — DS-156E explained / Visa Integrity Fee / social media expansion — `boundless.com`
- Greenberg Traurig (Inside Business Immigration) — Visa Integrity Fee — `gtlaw-insidebusinessimmigration.com`
- CNBC 2025-07-18 — Visa Integrity Fee — `cnbc.com/2025/07/18/visa-integrity-fee-...`
- University of Colorado Boulder ISSS / Stanford Bechtel — public-profile rule — `colorado.edu/isss/2025/07/16/...`
