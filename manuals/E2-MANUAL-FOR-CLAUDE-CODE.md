# E-2 Manual for Claude Code Agent

> Production manual for the ConCistenC AI paralegal building E-2 cases.
> Calibrated against the Kacar-Salih E-2 Renewal filing (filed 2026-01-07,
> Akalan Business Immigration). For every document the firm uses, this
> manual states: what it is → what the firm calculates with it → why it
> matters legally → what the agent must extract → which skill to invoke →
> the cover-letter snippet template.
>
> **Read order:** Master OS → this manual → case-specific intake.
>
> **Mandatory inheritance:** ConCistenC persona, six operating principles
> (zero hallucination, traceability, conservative posture, attorney
> supremacy, ADHD-friendly, memory-first), refusal patterns.

---

## 0. How the Agent Chains This Manual

```
[PDF folder dropped] →
  Phase 0: detect case_type (Haiku-tier classifier)
  Phase 1: per-document EXTRACT loop (this manual drives it)
       → for each document:
            - identify Tab + Exhibit slot
            - run extractor schema for that doc type
            - assign APS, capture provenance
            - flag conflicts, flag missing fields
  Phase 2: cross-document RECONCILE
       → SOF chain integrity, ownership math, dates
  Phase 3: DRAFTER (cover letter)
       → fills section II–VII per this manual's snippets
  Phase 4: REVIEWER (hallucination + RFE risk)
       → enforces every authority cite + every exhibit cite
  Phase 5: ATTORNEY queue
```

**Provenance rule:** every extracted field is `{value, source_page,
source_quote, confidence}`. Never bare value.

**Authority rule:** every legal claim ties to INA §101(a)(15)(E) +
the relevant 9 FAM 402.9 subsection. No bare assertions.

---

## 1. Tab A — Forms (Procedural)

### 1.1 Form G-1145 (e-Notification)
- **What it is:** Optional notice request for electronic receipt notification.
- **Element:** Procedural.
- **Firm uses it for:** Fast confirmation of USCIS lockbox receipt.
- **Agent extraction:** applicant name, email, mobile.
- **Skill:** `form-field-extractor` (template-aware OCR, not LLM).
- **Cover letter snippet:** none (Tab A is procedural, not argued in letter).
- **Quality gate:** None — purely administrative.

### 1.2 Form G-28 (Notice of Entry of Appearance)
- **What it is:** Establishes counsel of record before USCIS.
- **Element:** Procedural.
- **Firm uses it for:** Authorizes attorney to act; one G-28 per beneficiary AND each dependent.
- **Agent extraction:** counsel name, bar number, eligibility category, applicant, signature dates.
- **Skill:** `form-field-extractor`.
- **Quality gate:** Must be signed, dated within 30 days, bar number cross-checked.
- **Cover letter snippet:** none.

### 1.3 Form I-129 + I-129 E Supplement
- **What it is:** Petition for nonimmigrant worker (E classification).
- **Element:** Procedural — but the I-129 E Supplement is where the substantive E-2 facts are restated.
- **Firm uses it for:** Form-bound version of the cover letter facts.
- **Agent extraction (I-129):** petitioner FEIN, address, dates of intended employment, fee tally.
- **Agent extraction (I-129 E Supplement):** investment amount, ownership %, treaty country, type of business.
- **Skill:** `form-field-extractor` + `consistency-check` (must match cover letter and exhibit index numbers).
- **Quality gate:** Investment amount on I-129 E **must equal** the amount in cover letter Section IV. Discrepancy = severity 4 conflict, escalate.
- **Cover letter snippet:** none — but cover letter values must mirror this form.

### 1.4 Form G-1650 (ACH Authorization for Fees)
- **What it is:** Authorizes USCIS to debit the firm's IOLTA / business account for filing fees.
- **Element:** Procedural.
- **Firm uses it for:** Fee payment. One per fee category (e.g., I-129 fee, I-539 fee).
- **Agent extraction:** account holder name, business name, routing/account, authorized amount.
- **Skill:** `form-field-extractor`. **DO NOT log routing/account number to memory** — strip on extract.
- **Quality gate:** Total of G-1650 amounts = total of all fees on I-129 + I-539.
- **Cover letter snippet:** none.
- **PII rule:** routing + account → never persist beyond active case. Drop from final memory pass.

---

## 2. Tab B — Cover Letter (Drafter Output, Not Input)

This Tab is **produced** by the Phase 3 drafter, not extracted. Its
structure must follow the firm's Roman-numeral section convention,
each section mirroring the Tab letter it relies on (II↔C, III↔D,
IV↔E, V↔F, VI↔G, VII↔H — note: Akalan has used this II-III-IV-V-VI-VII
ordering with VII for develop-and-direct and a final VIII for intent
to depart in some renewals; preserve the order from `01-COVER-LETTER-TEMPLATE.md`).

**Drafter anchors (must include in every cover letter):**

1. Statutory cite at first reference: `INA §101(a)(15)(E)(ii)`.
2. Regulatory cite: `8 CFR §214.2(e)`.
3. FAM cite per section: `9 FAM 402.9-4` (nationality), `-6(B)` (at-risk),
   `-6(C)` (substantiality), `-6(E)` (marginality), `-7` (develop & direct).
4. Inline exhibit citation format: `(Exhibit: <Title> dated <Date>)`.
5. Each section ends with: `Accordingly, <element> is satisfied under
   INA §… and 9 FAM 402.9-…`
6. Defined terms: `the Beneficiary` and `the Petitioner` — never first
   name, never "Applicant", never "Investor" alone.
7. Currency: `<ISO> <amount>.<cents>` always (e.g., `TRY 4,000,000.00`,
   `$120,000.00`).

**Defensive-drafting rule:** when an exhibit reflects foreign-jurisdiction
practice unfamiliar to USCIS, **insert the cultural/legal explanation
BEFORE the exhibit citation**. Example pattern (real Akalan phrasing):

> "Under [Treaty Country] law and customary practice, real property
> transfers are effected directly through the [official body], and a
> separate written sales contract is not issued in standard title deed
> transfers. Accordingly, the lawful sale of the Beneficiary's real
> property is evidenced through the official title deed records.
> (Exhibit: …)"

---

## 3. Tab C — Qualification Under a Treaty of Commerce and Navigation
**E-2 Element 1 — Treaty Country Nationality**

### 3.1 Beneficiary's Treaty Country Passport (Biographic Page)
- **What it is:** Government-issued nationality proof.
- **Tab/Exhibit:** C.4. **APS:** 5.
- **Element proven:** E1 (nationality).
- **Firm uses it for:** Anchor the nationality claim. Cited at first introduction of Beneficiary in cover letter Section II.
- **Why it matters:** 9 FAM 402.9-4 requires national of qualifying treaty country. Without this exhibit there is no E-2.
- **Agent extraction schema:**
  ```json
  {
    "full_name_native": "<original spelling>",
    "full_name_ascii": "<ASCII transliteration>",
    "passport_number": "<>",
    "country_of_issue": "<>",
    "date_of_birth": "<YYYY-MM-DD>",
    "date_of_issue": "<YYYY-MM-DD>",
    "date_of_expiration": "<YYYY-MM-DD>",
    "sex": "<M/F>",
    "place_of_birth": "<>"
  }
  ```
- **Skill:** `passport-extractor` (vision pass, MRZ-aware).
- **Defensive drafting:** if expiration < 6 months from filing → flag (visa rules require ≥ 6 months validity).
- **Cover letter snippet:**
  > "The Beneficiary is a national of `<<Treaty Country>>`, as
  > evidenced by his `<<Treaty Country>>` passport. (Exhibit:
  > Beneficiary's `<<Treaty Country>>` Passport Biographic Page.)"

### 3.2 Prior E-2 Visa (Renewal Only)
- **What it is:** Visa stamp + I-797 approval notice from prior E-2 cycle.
- **Tab/Exhibit:** C.1. **APS:** 5. **Required for:** Renewal.
- **Element proven:** E1 (continuity) + supports E5 develop-and-direct.
- **Firm uses it for:** Demonstrate prior E-2 status, prior compliance, continuity.
- **Why it matters:** Renewal narrative requires prior status proof. Also evidences pattern of prior compliance for discretionary considerations under PA-2025-16.
- **Agent extraction:** prior visa number, validity dates, classification, port of entry, prior I-94 admit-until date.
- **Skill:** `visa-stamp-extractor` (vision).
- **Cover letter snippet (renewal):**
  > "The Beneficiary has previously held E-2 status with the Petitioner
  > from `<<start>>` to `<<end>>` and has consistently complied with
  > all conditions of E-2 classification. (Exhibit: Copy of Prior E-2
  > Visa.)"

### 3.3 Payroll Records for Prior E-2 Employment (Renewal Only)
- **What it is:** W-2s, pay stubs, payroll provider reports for the prior E-2 period.
- **Tab/Exhibit:** C.2. **APS:** 4. **Required for:** Renewal.
- **Element proven:** E1 + E5 (the Beneficiary actually worked the prior E-2 role) + E3/E4 (the Petitioner was actually paying employees).
- **Firm uses it for:** Three-fer — proves the Beneficiary worked, proves the Petitioner operated, proves prior compliance.
- **Why it matters:** USCIS scrutinizes whether the prior E-2 was actually used per its terms.
- **Agent extraction:** employer name+EIN, employee name, gross wages by quarter, withholdings, dates of employment.
- **Skill:** `payroll-extractor`.
- **Defensive drafting:** if any quarter shows zero wages while in E-2 → severity 3 conflict, attorney review.

### 3.4 Form I-94 Arrival/Departure Record
- **What it is:** CBP record of admission with class of admission (e.g., "E-2") and admit-until date.
- **Tab/Exhibit:** C.3. **APS:** 5.
- **Element proven:** Procedural / E1 continuity.
- **Firm uses it for:** Prove lawful status at time of filing (especially for COS or renewal).
- **Why it matters:** I-539 / COS eligibility depends on lawful status maintained.
- **Agent extraction:** admission number, class of admission, admit-until date, port of entry.
- **Skill:** `i94-extractor`.
- **Quality gate:** admit-until date must be ≥ filing date. If < filing date → status violation, escalate severity 5.

### 3.5 Co-Owner's EAD Card / Passport Showing Nationality
- **What it is:** Nationality proof for the OTHER member(s) whose nationality counts toward 50%+ treaty ownership.
- **Tab/Exhibit:** C.7. **APS:** 5.
- **Element proven:** E1 (50%+ treaty ownership).
- **Firm uses it for:** Show that the combined treaty-country ownership reaches the 50% threshold.
- **Why it matters:** 9 FAM 402.9-4(B). Without this, the nationality element fails even if the Beneficiary alone is a treaty national.
- **Agent extraction:** same passport schema as 3.1, plus EAD category if applicable.
- **Skill:** `passport-extractor` or `ead-extractor`.
- **Cover letter snippet:**
  > "`<<XX>>%` of the membership interest is held by `<<Beneficiary>>`,
  > a national of `<<Treaty Country>>`, and `<<XX>>%` is held by
  > `<<Co-Owner>>`, also a national of `<<Treaty Country>>`. Combined
  > treaty-country ownership equals `<<XX>>%`. (Exhibit: …)"

### 3.6 Membership Interest Transfer Agreement (cross-listed in C, D, E, F)
- See section 4.5 (Tab D) for full manual entry — this exhibit appears in multiple Tabs because it proves multiple elements simultaneously.

### 3.7 Member Resolutions
- **What it is:** Corporate resolutions adopted by the LLC members (consent / vote document).
- **Tab/Exhibit:** C.6 (also referenced in D.3, H.3). **APS:** 4.
- **Element proven:** E1 (formal acknowledgment of treaty owners) + E5 (appointment to executive role).
- **Firm uses it for:** Show that the ownership and management structure was formally adopted, not just contractual.
- **Agent extraction:** resolution date, resolutions adopted (verbatim), members present, signatures.
- **Skill:** `corporate-doc-extractor`.

---

## 4. Tab D — Ownership Structure and Corporate History
**E-2 Element 1 (50%+) + Corporate Setup**

### 4.1 Articles of Organization
- **What it is:** State-filed formation document.
- **Tab/Exhibit:** D.1. **APS:** 5.
- **Element proven:** E1 (entity exists), E3 (real and legal entity).
- **Firm uses it for:** Anchor the corporate-history narrative — formation date, state, registered agent.
- **Why it matters:** Without legal formation, no Petitioner.
- **Agent extraction:**
  ```json
  {
    "entity_legal_name": "<>",
    "entity_type": "LLC | Corp | …",
    "state_of_formation": "<>",
    "formation_date": "<YYYY-MM-DD>",
    "registered_agent": "<>",
    "principal_address": "<>"
  }
  ```
- **Skill:** `corporate-doc-extractor`.
- **Cover letter snippet:**
  > "The Petitioner was organized on `<<Date>>` under the laws of
  > `<<State>>` as a `<<entity type>>`. (Exhibit: Articles of
  > Organization.)"

### 4.2 Original Operating Agreement
- **What it is:** Contract among the LLC members governing rights/duties at formation.
- **Tab/Exhibit:** D.2. **APS:** 4.
- **Element proven:** E1 (initial ownership %) + corporate setup.
- **Firm uses it for:** Anchor the initial ownership snapshot — who owned what at formation.
- **Agent extraction:** initial members + ownership %, capital contributions, management structure.
- **Skill:** `contract-extractor`.

### 4.3 Initial Member Resolutions
- **What it is:** First resolutions of the LLC members confirming initial ownership and authority.
- **Tab/Exhibit:** D.3. **APS:** 4.
- **Element proven:** E1 (formal record of initial ownership).
- **Firm uses it for:** Corroborate the Operating Agreement's initial-ownership snapshot.

### 4.4 Bill of Sale (Prior Owner → Subsequent Owner)
- **What it is:** Notarized transfer of membership interest, with consideration.
- **Tab/Exhibit:** D.4. **APS:** 4. **Required when:** ownership has changed since formation.
- **Element proven:** E1 (chain of ownership) + corporate continuity.
- **Firm uses it for:** Document each link in the ownership chain.
- **Agent extraction:** transferor, transferee, % transferred, consideration, date, notarization details.
- **Skill:** `contract-extractor`.
- **Why it matters:** A break in the ownership chain = severity 4 conflict. The agent must build a full ownership timeline from formation to filing.
- **Cover letter snippet (real Akalan phrasing):**
  > "Subsequently, pursuant to a duly executed Bill of Sale subscribed
  > and sworn on `<<Date>>`, original member `<<Prior>>` transferred
  > his entire `<<XX>>%` membership interest in `<<Petitioner>>` to
  > `<<Subsequent>>` in consideration of `$<<Amount>>`, as evidenced by
  > a promissory note executed in connection with the transfer."

### 4.5 Membership Interest Transfer Agreement (current ownership)
- **What it is:** Most recent membership transfer that produced the current ownership structure.
- **Tab/Exhibit:** D.5 (cross-listed C.5, E.3.a, F.1). **APS:** 4.
- **Element proven:** E1 (current ownership for 50% calc) + E2 (consideration paid = part of the investment) + E5 (often grants the executive role).
- **Firm uses it for:** Anchor the current-ownership state, the dollar consideration, the effective date, and the role assignments.
- **Agent extraction:**
  ```json
  {
    "effective_date": "<YYYY-MM-DD>",
    "transferor": {"name": "<>", "ownership_before": "<%>"},
    "transferee": {"name": "<>", "ownership_after": "<%>"},
    "interest_transferred": "<%>",
    "total_consideration": "<currency + amount>",
    "payment_terms": {"upfront": "<>", "deferred": "<>", "schedule": "<>"},
    "executive_role_granted": "<>",
    "effective_date_role": "<YYYY-MM-DD>"
  }
  ```
- **Skill:** `contract-extractor`.
- **Why it matters:** This single document drives the math for **three** different cover letter sections — ownership %, investment dollar amount, and develop-and-direct. Errors here propagate.
- **Quality gate:** consideration in the agreement **must equal** the investment total in I-129 E Supplement and Section IV of cover letter. Mismatch = severity 5.
- **Cover letter snippet:**
  > "Pursuant to a fully executed Membership Interest Transfer Agreement
  > dated `<<Date>>`, `<<Prior Owner>>` transferred `<<XX>>%` of her
  > membership interest in `<<Petitioner>>` to the Beneficiary,
  > `<<Beneficiary Name>>`, in exchange for a total consideration of
  > `$<<Amount>>`. The terms of the transfer, including the payment
  > structure and effective date of `<<Date>>`, are fully documented
  > in the enclosed agreement and related corporate records. (Exhibit:
  > Membership Interest Transfer Agreement dated `<<Date>>` —
  > `<<Prior>>` to `<<Beneficiary>>`.)"

---

## 5. Tab E — Investment: Source, Transfer, and At-Risk Commitment of Funds
**E-2 Element 2 + Source-of-Funds chain**

> **Why this Tab is the most rigorous:** SOF gaps are the #1 reason for E-2
> RFEs and denials. The agent must reconstruct a continuous trail from
> lawful origin → personal account → currency conversion → international
> wire → US business deployment, with **zero unexplained gaps over
> $10,000**. Per Master OS, any unexplained gap > $10K = attorney
> escalation.

### 5.1 Source / Origin Documents

#### 5.1.1 Prior Title Deed
- **What it is:** Government-issued land registry document showing the Beneficiary's PRIOR ownership of real property in the treaty country.
- **Tab/Exhibit:** E.1.a. **APS:** 5.
- **Element proven:** E2 — source of funds is lawful (own real property).
- **Firm uses it for:** Establish that the Beneficiary owned the property before sale.
- **Agent extraction:** parcel ID, property type, registration date, owner name (ASCII + native), registry office, location.
- **Skill:** `government-doc-extractor` + `foreign-language-translator` (capture original quote, transliterate to ASCII).

#### 5.1.2 Current Title Deed
- **What it is:** Land registry document confirming the property has been transferred to a new owner.
- **Tab/Exhibit:** E.1.b. **APS:** 5.
- **Element proven:** E2 — sale actually closed.
- **Firm uses it for:** Confirm the property transfer happened on `<<Date>>` and proceeds are lawful.
- **Agent extraction:** transfer date, new owner name, transfer registry number.
- **Defensive drafting:**
  > **MANDATORY** — when the treaty country effects transfers without a
  > separate sale contract (e.g., Turkey's Tapu Müdürlüğü), the cover
  > letter must explain this BEFORE introducing the exhibit. Real Akalan
  > phrasing:
  >
  > "Under `<<Treaty Country>>` law and customary practice, real
  > property transfers are effected directly through the `<<official
  > body — e.g., Land Registry Office (Tapu Mudurlugu)>>`, and a
  > separate written sales contract is not issued in standard title
  > deed transfers. Accordingly, the lawful sale of the Beneficiary's
  > real property is evidenced through the official title deed records."

#### 5.1.3 Bank Receipts Confirming Property Sale Proceeds
- **What it is:** Wire/transfer confirmations showing the buyer paid the Beneficiary.
- **Tab/Exhibit:** E.1.c. **APS:** 5.
- **Element proven:** E2 — funds actually received from named buyer.
- **Firm uses it for:** Build the per-installment table of receipts (multiple deposits totaling sale price).
- **Agent extraction:**
  ```json
  {
    "receipts": [
      {
        "date": "<YYYY-MM-DD>",
        "amount": "<currency + amount>",
        "from_name": "<buyer>",
        "from_account_last4": "<>",
        "to_name": "<Beneficiary>",
        "to_account_last4": "<>",
        "bank": "<>",
        "memo_or_remittance": "<>"
      }
    ]
  }
  ```
- **Skill:** `bank-receipt-extractor` (table extraction).
- **Why it matters:** Each receipt becomes a row in the SOF chain table. Sum of receipts must equal sale price stated in title deed transfer.
- **Cover letter narration pattern (real Akalan phrasing):**
  > "The initial transfer of `<<TRY 30,000.00>>` was made on
  > `<<Date>>`. The remaining portion of the deposit `<<TRY
  > 40,000.00>>` was made by the buyer, `<<Buyer Name>>` on
  > `<<Date>>`. On the sale day, `<<Date>>` the amount of `<<TRY
  > 2,900,000.00>>`, `<<TRY 1,000,000.00>>`, and `<<TRY 30,000.00>>`,
  > all credited to the same personal account of `<<Beneficiary>>` by
  > the buyer `<<Buyer Name>>`. (Exhibit: …)"

#### 5.1.4 Bank Statement (Sale Proceeds Period)
- **What it is:** Multi-month bank statement covering the period when sale proceeds were received.
- **Tab/Exhibit:** E.1.d. **APS:** 4.
- **Element proven:** E2 — receipts are not isolated, they exist within an authentic banking history.
- **Firm uses it for:** Corroborate the receipts and show no unexplained outflows.
- **Agent extraction:** account holder, account last4, statement period, opening/closing balance, all deposits + withdrawals during the period.
- **Skill:** `bank-statement-extractor` (table extraction with date/amount/counterparty).

#### 5.1.5 Residential Lease Agreement (Rental Income Source)
- **What it is:** Lease that generates rental income claimed as a source of investment funds.
- **Tab/Exhibit:** E.1.e. **APS:** 4.
- **Element proven:** E2 — additional lawful income source.
- **Firm uses it for:** Anchor the rental income narrative (monthly amount, tenant, term).
- **Agent extraction:**
  ```json
  {
    "landlord_name": "<>",
    "landlord_relationship": "<Beneficiary | spouse | other>",
    "tenant_name": "<>",
    "tenant_account_last4": "<>",
    "monthly_rent_initial": "<currency + amount>",
    "monthly_rent_current": "<currency + amount>",
    "term": "<from / to>",
    "escalation_clause": "<verbatim>"
  }
  ```
- **Skill:** `contract-extractor`.
- **Defensive drafting cases:**
  - **Spouse-named lease:** If landlord is spouse not Beneficiary → MUST insert this real Akalan defense:
    > "Under U.S. immigration law, lawful income earned by a spouse
    > forms part of the family's household financial resources and may
    > be lawfully applied toward an E-2 investment. Accordingly, the
    > documented rental income received through the marital household
    > constitutes legitimate capital available to the Beneficiary for
    > investment purposes."
  - **Indexed escalation (TEFE/TUFE / CPI):** explain in footnote that the escalation is tied to officially published inflation indices issued by the national statistics authority. Real Akalan footnote pattern:
    > "In `<<Country>>`, residential lease agreements commonly
    > incorporate annual rent adjustments that are indexed to officially
    > published inflation indicators, historically including
    > `<<TEFE/TUFE/CPI etc.>>`. These indices are issued by `<<official
    > statistics authority>>`. Accordingly, periodic rent increases
    > that reflect such adjustments constitute lawful and customary
    > rental practice within the `<<Country>>` residential leasing
    > market."

#### 5.1.6 Bank Receipts + Statements Reflecting Rental Income Deposits
- **What it is:** Recurring electronic transfers from tenant to Beneficiary's account.
- **Tab/Exhibit:** E.1.f and E.1.g. **APS:** 5 / 4.
- **Element proven:** E2 — rental income is real, recurring, lawful.
- **Firm uses it for:** Build the recurring-deposit table corroborating monthly rent claims.
- **Agent extraction:** same as 5.1.3 for each recurring deposit; identify the consistent tenant counterparty.

### 5.2 Transfer Documents

#### 5.2.1 Currency Conversion Receipt
- **What it is:** Bank-issued receipt for FX conversion (treaty-country currency → USD).
- **Tab/Exhibit:** E.2.a. **APS:** 4.
- **Element proven:** E2 — fund movement to USD is documented and at a regulated rate.
- **Firm uses it for:** Anchor the conversion event with: source currency amount, target USD amount, exchange rate, conversion date, source account, destination account.
- **Agent extraction:**
  ```json
  {
    "conversion_date": "<YYYY-MM-DD>",
    "source_currency": "<ISO>",
    "source_amount": "<>",
    "source_account_iban_last6": "<>",
    "target_currency": "USD",
    "target_amount": "<>",
    "target_account_iban_last6": "<>",
    "exchange_rate": "<>",
    "bank": "<>"
  }
  ```
- **Skill:** `bank-receipt-extractor`.
- **Quality gate:** `source_amount × exchange_rate ≈ target_amount` (within 1% rounding). Mismatch = severity 3 conflict.
- **Cover letter narration pattern (real Akalan):**
  > "Following receipt, `<<TRY 4,086,900.00>>` of these lawful funds
  > was converted into U.S. dollars through a regulated foreign-exchange
  > transaction conducted at `<<Bank Name>>` on `<<Date>>` at the bank's
  > USD selling rate of `<<42.75000>>` `<<TRY>>` per 1 USD, resulting
  > in the lawful purchase of USD `<<95,600.00>>`. The conversion was
  > executed from the Beneficiary's `<<source-currency>>` account
  > IBAN ending in `<<431656>>` to his U.S.-dollar-denominated account
  > IBAN ending in `<<224595>>`, both maintained with `<<Bank Name>>`.
  > (Exhibit: Currency Conversion Receipt.)"

#### 5.2.2 USD Transfers (International Wires)
- **What it is:** SWIFT confirmations for wires from treaty-country bank to a US bank in the Beneficiary's name.
- **Tab/Exhibit:** E.2.b. **APS:** 5.
- **Element proven:** E2 — funds entered the US under Beneficiary's name.
- **Firm uses it for:** Document that funds reached US under Beneficiary's name BEFORE deployment to the enterprise.
- **Agent extraction:** sender bank, sender account last4, receiver bank, receiver account last4, amount, value date, SWIFT MT103 reference if visible.
- **Skill:** `wire-confirmation-extractor`.

#### 5.2.3 USD Transfer Receipt to Co-Owner Account / Petitioner Account
- **What it is:** Final transfer step — Beneficiary's US account → Co-owner's US account (when buying interest from co-owner) OR Beneficiary's US account → Petitioner's operating account.
- **Tab/Exhibit:** E.2.c. **APS:** 5.
- **Element proven:** E2 — funds actually deployed to the investment, not retained.
- **Firm uses it for:** Close the SOF chain.
- **Agent extraction:** same as 5.2.2.
- **Cover letter narration pattern (real Akalan):**
  > "Thereafter, on `<<Date>>`, the Beneficiary transferred USD
  > `<<80,000.00>>` from his U.S. account ending in `<<2472>>` to the
  > U.S. bank account of co-owner `<<Co-Owner Name>>`, whose account
  > ends in `<<3772>>`, in accordance with the purchase obligations
  > set forth in the Membership Interest Transfer Agreement dated
  > `<<Date>>`, pursuant to which the Beneficiary acquired
  > `<<XX>>%` ownership of `<<Petitioner>>`. (Exhibit: USD Transfers;
  > Exhibit: Membership Interest Transfer Agreement; Exhibit: USD
  > Transfer Receipt to Co-Owner Account.)"

### 5.3 At-Risk Commitment Documents

#### 5.3.1 Membership Interest Transfer Agreement (at-risk view)
- See 4.5 for full extraction. In Tab E it is cited specifically for the at-risk subsection because the CONSIDERATION in the agreement = the at-risk commitment.

#### 5.3.2 Legal Fee Invoice
- **What it is:** Counsel's invoice for the E-2 transaction and filing services.
- **Tab/Exhibit:** E.3.b. **APS:** 3.
- **Element proven:** E2 — funds spent (i.e., at risk in form of fees, partial proof of irrevocable expenditure).
- **Firm uses it for:** Show that funds have actually been irrevocably spent, beyond just contractual commitments.
- **Agent extraction:** invoice date, payor, services, amount, paid date.
- **Skill:** `invoice-extractor`.

### 5.4 Mandatory Reconstruction — SOF Chain

**Agent task at end of Tab E extraction:**

Build a single chain table with these mandatory rows. Every row must
have an exhibit. Every gap > $10,000 = severity 5 escalation.

| Step | What | Counterparty | Amount | Date | Source acct | Target acct | Exhibit |
|------|------|--------------|--------|------|-------------|-------------|---------|
| 1 | Origin (sale / rent / etc.) | `<>` | `<>` | `<>` | n/a | `<>` | E.1.x |
| 2 | Receipt in TC personal account | `<>` | `<>` | `<>` | `<>` | `<>` | E.1.x |
| 3 | Currency conversion | (bank) | `<>` | `<>` | `<>` | `<>` | E.2.a |
| 4 | International wire to US | (bank) | `<>` | `<>` | `<>` | `<>` | E.2.b |
| 5 | Deployment to Petitioner | (or co-owner) | `<>` | `<>` | `<>` | `<>` | E.2.c |

**Agent rule:** If any row has missing fields or amounts that don't reconcile within ±1% across rows, halt and escalate. Do NOT draft cover letter without a clean chain.

### 5.5 Cover Letter Section IV Construction (Drafter Task)

The drafter must produce **two subsections under Section IV** mirroring
Akalan's actual structure:

**A. Lawful Source and Traceability of Funds** — narrate origin sources
in chronological order. Include defensive paragraphs (Tapu / TEFE-TUFE /
spouse-lease) WHERE APPLICABLE. End with: "Accordingly, both the …
proceeds and the … income constitute lawful, ordinary income …"

**B. Irrevocable Placement of Funds at Risk** — quantify total
investment, at-risk portion, and contractually-committed portion. Cite
9 FAM 402.9-6(B). Include the real Akalan boilerplate:

> "Once transferred, the invested capital became fully subject to the
> fortunes of the enterprise and exposed to the possibility of partial
> or total loss in the event that the business does not succeed. There
> is no guarantee of return, no redemption mechanism, and no protection
> of principal independent of the company's performance. Accordingly,
> the investment is irrevocably committed and satisfies the 'at-risk'
> requirement set forth under 9 FAM 402.9-6(B)."

> "No portion of the investment derives from unsecured loans, loans
> collateralized by the assets of the U.S. enterprise, or any other
> impermissible financing mechanism."

This last sentence is a **mandatory pre-emption** of 8 CFR §214.2(e)(12)
RFE risk.

---

## 6. Tab F — Substantiality of the Investment
**E-2 Element 2 — Proportionality**

### 6.1 Membership Interest Transfer Agreement
- See 4.5. Cited again here because the consideration = the substantiality numerator.

### 6.2 Petitioner's Balance Sheet
- **What it is:** Internal accounting snapshot of the Petitioner's assets, liabilities, and equity.
- **Tab/Exhibit:** F.2. **APS:** 3.
- **Element proven:** E2 (proportionality denominator) + E3 (real and operating).
- **Firm uses it for:** Establish total enterprise value/cost — the denominator for proportionality.
- **Agent extraction:**
  ```json
  {
    "as_of_date": "<>",
    "total_assets": "<>",
    "total_liabilities": "<>",
    "total_equity": "<>",
    "asset_breakdown": {"cash": "<>", "inventory": "<>", "equipment": "<>", "other": "<>"}
  }
  ```
- **Skill:** `financial-statement-extractor`.

### 6.3 Drafter Logic for Section V Substantiality

**Real Akalan approach (CRITICAL):** Akalan does **NOT** compute a strict
percentage proportionality in the cover letter. Instead, the firm argues
substantiality **qualitatively** in three moves:

1. **Industry context** — name the industry and describe its capital
   intensity (real Akalan: "a longstanding food-service establishment
   within the restaurant and delicatessen industry, a sector that
   requires continuous capital outlay for inventory procurement,
   equipment maintenance, vendor payments, staffing…").

2. **Absolute and proportional substantial** — assert both, without
   computing a ratio: "the Beneficiary's total investment commitment of
   `$<<Total>>`, of which `$<<At Risk>>` has already been irrevocably
   placed at risk … constitutes a substantial investment both in
   absolute terms and in proportion to the overall value and operational
   requirements of the enterprise."

3. **Loss-if-fails** — quantify economic motivation: "the amount
   invested … reflects a meaningful financial commitment that would
   result in significant financial loss to the Beneficiary should the
   enterprise fail."

Cite 9 FAM 402.9-6(C). Cite Membership Interest Transfer Agreement +
Petitioner's Balance Sheet.

**Reviewer's note:** This is a deliberate firm style. The reviewer
(Phase 4) should NOT flag the absence of a strict % ratio as a defect,
unless the case profile (high enterprise cost) suggests RFE risk on
proportionality. In that case, the reviewer suggests adding a ratio
table to Section V as an enhancement, but does not block.

**Defensive note for AI drafter:** Matter of Walsh and Pollard (Interim
Decision #3111) — not cited in the real Akalan filing for at-risk, but
SHOULD be cited if the case has any thin-margin facts (e.g., not all
funds yet expended, contingent on future earnings). The drafter should
add Walsh and Pollard when at-risk has any softness.

---

## 7. Tab G — Marginality and Ongoing Commercial Activity
**E-2 Elements 3 (Real & Operating) + 4 (More than Marginal) — combined**

> Akalan combines E3 and E4 in one cover-letter section because the
> evidence overlaps. The agent should follow the same pattern.

### 7.1 Photographs of Business Premises
- **Tab/Exhibit:** G.1. **APS:** 3.
- **Element:** E3 (real and operating).
- **Firm uses it for:** Visual proof of physical operations — storefront, dining area, kitchen, signage.
- **Agent extraction:** photo count, captions/locations if labeled.
- **Skill:** `image-classifier` (vision) — confirm photos depict claimed business type.

### 7.2 Articles of Organization (cross-listed)
- See 4.1. In Tab G, cited to anchor the operating-since-formation timeline.

### 7.3 Commercial Lease
- **Tab/Exhibit:** G.3. **APS:** 4.
- **Element:** E3 (premises secured) + E4 (commitment to ongoing operations).
- **Firm uses it for:** Establish a fixed business location with multi-year commitment.
- **Agent extraction:** landlord, tenant=Petitioner, address, term length, rent, security deposit, options to renew.
- **Skill:** `contract-extractor`.

### 7.4 Business Bank Statements
- **Tab/Exhibit:** G.4. **APS:** 4.
- **Element:** E3 + E4.
- **Firm uses it for:** Show ongoing commercial activity — recurring deposits (revenue), recurring outflows (operations).
- **Agent extraction:** account holder = Petitioner, statement period, total deposits, total withdrawals, average daily balance, top counterparties.
- **Skill:** `bank-statement-extractor`.
- **Quality gate:** require ≥ 12 months for renewals, ≥ 3 months for new E-2.

### 7.5 Vendor Invoices
- **Tab/Exhibit:** G.5. **APS:** 4.
- **Element:** E3 — actual procurement of goods/services.
- **Firm uses it for:** Anchor "active commercial activity" claim — paying vendors = real operations.
- **Agent extraction:** vendor names, invoice dates, amounts, services, paid status.
- **Skill:** `invoice-extractor`.

### 7.6 Federal Tax Return (most recent year)
- **Tab/Exhibit:** G.6. **APS:** 5.
- **Element:** E3 + E4 — IRS-acknowledged commercial operations + revenue figures.
- **Firm uses it for:** Strongest exhibit for marginality — sworn revenue and expenses.
- **Agent extraction:**
  ```json
  {
    "tax_year": "<>",
    "filer_ein": "<>",
    "form_type": "1120 | 1120S | 1065 | Schedule C",
    "gross_receipts": "<>",
    "total_deductions": "<>",
    "ordinary_business_income": "<>",
    "wages_paid": "<>"
  }
  ```
- **Skill:** `tax-return-extractor`.
- **Quality gate:** EIN on tax return must equal EIN on Articles of Organization / Operating Agreement / I-129. Mismatch = severity 5.

### 7.7 Payroll Records
- **Tab/Exhibit:** G.7. **APS:** 4.
- **Element:** E3 + E4 — actual W-2 employees beyond Beneficiary's family.
- **Firm uses it for:** Anchor "more than marginal" — the enterprise supports U.S. workers, not just the Beneficiary.
- **Agent extraction:** employee count by quarter, total wages, position titles, employee names + last4 SSN (do NOT persist SSN to memory).
- **Skill:** `payroll-extractor`. **PII rule:** strip SSN at extract.
- **Quality gate:** at filing, employee count ≥ 1 non-family. If count = 0 → severity 4 conflict (marginality risk).

### 7.8 Drafter Logic for Section V/VI Marginality

Real Akalan structure (mirror exactly):

1. **Real and operating** paragraph — premises, photos, ongoing operations, vendor procurement, commercial transactions.
2. **Revenue + tax return** paragraph — bank records, merchant processing, vendor invoices, "produced income beyond that required solely to support the Beneficiary and his family."
3. **Capacity / future** paragraph — describe operational enhancements under Beneficiary's direction (real example: "extending service hours during peak demand periods, optimizing menu offerings, strengthening supplier relationships, and adjusting staffing levels").
4. **Employee count** sentence — "As of the date of this application, the enterprise employs `<<#>>` employees, as reflected in the enclosed payroll records, demonstrating that it has developed beyond a marginal operation."
5. **Wrap-up** — "Accordingly, the Petitioner is not marginal within the meaning of INA §101(a)(15)(E) and 9 FAM 402.9-6(E)…"

---

## 8. Tab H — Role of the Beneficiary: Developing and Directing
**E-2 Element 5 — Develop & Direct**

### 8.1 Beneficiary's Prior E-2 Visa (cross-listed)
- See 3.2. In Tab H, cited to evidence prior compliance + prior exercise of develop-and-direct authority.

### 8.2 Beneficiary's Prior E-2 Employment History
- **Tab/Exhibit:** H.2. **APS:** 4. **Required for:** Renewal.
- **Element:** E5 — track record of actually developing/directing during prior status.
- **Agent extraction:** employer, role, dates, achievements (verbatim).
- **Skill:** `cv-extractor` filtered to prior E-2 period.

### 8.3 Member Resolution Appointing President / Title
- **Tab/Exhibit:** H.3. **APS:** 4.
- **Element:** E5 — formal grant of executive authority.
- **Firm uses it for:** Anchor the title/role with corporate formality.
- **Agent extraction:** appointee, title, effective date, scope of authority (verbatim).
- **Skill:** `corporate-doc-extractor`.

### 8.4 Organizational Chart
- **Tab/Exhibit:** H.4. **APS:** 3.
- **Element:** E5 — visual hierarchy showing Beneficiary at top.
- **Agent extraction:** hierarchy tree, span of control (how many direct reports).
- **Skill:** `org-chart-extractor` (vision).
- **Quality gate:** Beneficiary must appear at top OR with executive title; ≥ 1 direct/indirect report below for develop-and-direct.

### 8.5 Beneficiary's CV
- **Tab/Exhibit:** H.5. **APS:** 3.
- **Element:** E5 — qualifications to direct.
- **Agent extraction:** education, work history, executive roles, total years of experience, industry specialization.
- **Skill:** `cv-extractor`.

### 8.6 Business Plan
- **Tab/Exhibit:** H.6 (cross-listed G.8). **APS:** 3.
- **Element:** E4 (marginality projections) + E5 (the strategy the Beneficiary will execute).
- **Firm uses it for:** Anchor the "develop and direct" forward narrative — what the Beneficiary plans to do.
- **Agent extraction:** plan period, hiring schedule by year, revenue projections, operational expansion items.
- **Skill:** `business-plan-extractor`.

### 8.7 Drafter Logic for Develop-and-Direct Section

**Real Akalan structure (mirror exactly):**

1. **Position anchor** — "principal treaty investor and `<<XX>>%` owner …
   occupies the senior-most executive position … exercises ultimate
   authority over its development and direction."
2. **Effective-date event** — "Effective `<<Date>>`, upon completion of
   the membership interest transfer, the Beneficiary assumed the role
   of `<<Title>>`."
3. **Responsibilities list (defensive)** — "responsible for establishing
   and implementing the company's strategic objectives, overseeing
   financial planning and reinvestment decisions, and directing the
   overall operational framework."
4. **Decision-making list** — "budgetary oversight, vendor and supplier
   relationships, staffing structure, operational policies, and quality
   control standards."
5. **Anti-routine paragraph (CRITICAL DEFENSIVE)** — "The Beneficiary's
   role is not limited to performing routine or hands-on operational
   tasks. Rather, his executive authority derives directly from his
   ownership interest and is exercised through strategic oversight,
   managerial direction, and control of the enterprise's essential
   functions."
6. **Industry-specific role detail** — describe specific executive
   functions in the industry (Akalan example: "Executive Chef and
   Kitchen Director, leveraging nearly three decades of professional
   culinary experience…").
7. **Wrap-up with cite** — "the Beneficiary's role is executive and
   managerial in nature … consistent with INA §101(a)(15)(E) and
   9 FAM 402.9-7."

**Defensive flag for Reviewer:** when the Beneficiary's title combines
executive + skilled-worker elements (e.g., "President + Executive Chef",
"CEO + Lead Engineer"), the reviewer MUST verify the anti-routine
paragraph (item 5) is present and the qualifications list shows
ownership-based authority (not just labor-based). Without paragraph 5,
this is severity 4 RFE risk.

---

## 9. Tab I — Notice of Intent to Depart (Principal)

### 9.1 Signed Notice of Intent to Depart (Beneficiary)
- **What it is:** Signed and dated statement affirming the temporary, nonimmigrant nature of E-2 and intent to depart upon expiration.
- **Tab/Exhibit:** I.1. **APS:** 3.
- **Element:** Nonimmigrant intent (required because E-2 is NIV).
- **Firm uses it for:** Discrete proof of nonimmigrant intent under PA-2025-16 discretionary considerations.
- **Agent extraction:** signer name, date signed, statement (verbatim).
- **Skill:** `affidavit-extractor`.
- **Cover letter snippet (real Akalan):**
  > "The Beneficiary acknowledges the temporary and nonimmigrant nature
  > of E-2 Treaty Investor classification and affirms his intent to
  > depart the United States upon the expiration or termination of his
  > authorized period of stay."

---

## 10. Tab J — Forms for Dependents

### 10.1 Form I-539 (Dependent Spouse) + I-539A (Dependent Children)
- **What it is:** Application for change of status to E-2 dependent.
- **Tab/Exhibit:** J.3 (spouse), J.5 (each child).
- **Element:** Dependent eligibility.
- **Firm uses it for:** Concurrent filing — approval contingent on principal E-2 approval.
- **Agent extraction:** family relationship, dates, current immigration status, prior I-94.
- **Skill:** `form-field-extractor`.
- **Quality gate:** every dependent's relationship must be supported by Tab L.4 vital-records exhibit.

### 10.2 G-28 + G-1145 + G-1650 (Dependents)
- See sections 1.1, 1.2, 1.4. Same logic, separate forms per filer.

---

## 11. Tab K — Notice of Intent to Depart (Dependents)
- **Tab/Exhibit:** K.1–K.N (one per dependent).
- **Element:** Nonimmigrant intent for each dependent.
- **Firm uses it for:** Mirror of Tab I but for spouse + each child.
- **Agent extraction + skill:** same as 9.1.

---

## 12. Tab L — Biographic / Immigration Info for Dependents

### 12.1 Dependent Passport Bio Page
- See 3.1. APS 5. Per dependent.

### 12.2 Dependent U.S. Visa + I-94
- See 3.4. Confirms current lawful status. Per dependent.

### 12.3 Marriage Certificate + Certified English Translation
- **What it is:** Vital records proof of spousal relationship.
- **Tab/Exhibit:** L.1.c. **APS:** 4.
- **Element:** Dependent eligibility (spouse).
- **Agent extraction:** spouses' names (ASCII + native), date and place of marriage, registry, translator certification.
- **Skill:** `vital-records-extractor`.
- **Quality gate:** translator's certification must be present (signed, dated, statement of competency).

### 12.4 Vital Records / Birth Certificate + Certified Translation
- **What it is:** Proof of parent-child relationship for each dependent child.
- **Tab/Exhibit:** L.2.c, L.3.c, L.4.c. **APS:** 4.
- **Element:** Dependent eligibility (child).
- **Agent extraction:** child name (ASCII + native), DOB, parents named, registry, translator certification.
- **Skill:** `vital-records-extractor`.

---

## 13. Cross-cutting Agent Skills (referenced above)

These are the skill names this manual assumes exist. Each is a focused
extractor with its own prompt + schema (build separately, do not bloat
this manual).

| Skill name | Used for |
|------------|----------|
| `form-field-extractor` | USCIS forms (G-1145, G-28, I-129, I-129E, I-539, I-539A, G-1650) |
| `passport-extractor` | Passport bio pages (vision + MRZ) |
| `visa-stamp-extractor` | Visa stamps + I-797 notices |
| `i94-extractor` | I-94 records |
| `ead-extractor` | EAD cards |
| `bank-receipt-extractor` | Wire receipts, transfer slips |
| `bank-statement-extractor` | Multi-month statements (table extraction) |
| `wire-confirmation-extractor` | SWIFT MT103 confirmations |
| `payroll-extractor` | W-2s, payroll provider reports |
| `tax-return-extractor` | 1120/1120S/1065/Schedule C |
| `invoice-extractor` | Vendor invoices, legal fee invoices |
| `contract-extractor` | Operating agmt, leases, transfer agmts |
| `corporate-doc-extractor` | Articles of Org, member resolutions |
| `government-doc-extractor` | Title deeds, vital records (foreign) |
| `foreign-language-translator` | Certified translation pass / verification |
| `vital-records-extractor` | Birth/marriage certificates + translations |
| `business-plan-extractor` | Multi-year business plans |
| `org-chart-extractor` | Org charts (vision) |
| `cv-extractor` | Resumes / CVs |
| `image-classifier` | Premises photos, document quality checks |
| `affidavit-extractor` | Signed statements (intent to depart, etc.) |
| `financial-statement-extractor` | Balance sheets, P&Ls |

Each extractor returns `{value, source_page, source_quote, confidence}`
per Master OS provenance rule.

---

## 14. Authority Verification (Mandatory Before Drafting)

Before the drafter is allowed to emit a cover letter, the agent must
verify each citation it intends to use. The agent **MUST** maintain a
hard-coded allowlist of known-good authorities. Verbatim list:

- `INA § 101(a)(15)(E)(ii)` — present in 8 USC 1101(a)(15)(E)(ii).
- `8 CFR § 214.2(e)` — including subsections (1)–(23).
- `9 FAM 402.9-1` through `9 FAM 402.9-13` — verify subsection used.
- `Matter of Walsh and Pollard, Interim Decision #3111` — at-risk.
- `Matter of Ho, 19 I&N Dec. 582 (BIA 1988)` — 5-year plan, by analogy.
- `8 USC 1184(c)` — temporary worker generally.

**Refusal pattern:** if the drafter wants to cite anything outside this
list, halt and require attorney approval. **Never invent a case
citation, never invent a FAM subsection.**

Where the cover letter cites a case or FAM that the agent CANNOT verify
exists in its allowlist, output `[CITE NEEDED — VERIFY: <draft cite>]`
and route to attorney before filing.

---

## 15. Quality Gates (the Reviewer's Phase 4 Checklist)

Before the package is presented to the supervising attorney, the
Reviewer (Phase 4) must verify all of these. Any failure = halt.

- [ ] Every Tab populated; missing exhibits flagged.
- [ ] Every required element has at least one APS ≥ 4 exhibit.
- [ ] Source-of-funds chain has zero gaps > $10,000.
- [ ] Currency conversion math reconciles (within ±1%).
- [ ] EIN consistent across Articles, tax return, I-129, payroll.
- [ ] Investment amount consistent across Membership Transfer
      Agreement, I-129 E Supplement, cover letter Section IV.
- [ ] Effective date consistent across Membership Transfer Agreement,
      Member Resolution Appointing President, cover letter.
- [ ] Treaty-country combined ownership ≥ 50%.
- [ ] All cited authorities are in allowlist (Section 14).
- [ ] All foreign-jurisdiction practices have defensive paragraphs
      inserted BEFORE their exhibit citations.
- [ ] Anti-routine paragraph present in develop-and-direct section IF
      title combines executive + skilled-worker elements.
- [ ] At-risk pre-emption sentence present ("No portion of the
      investment derives from unsecured loans, loans collateralized by
      the assets of the U.S. enterprise, or any other impermissible
      financing mechanism.")
- [ ] All names in filing-bound text are ASCII transliterations.
- [ ] Currency in ISO + commas + .00 throughout.
- [ ] Every `(Exhibit: …)` citation in cover letter resolves to a real
      exhibit in the index.
- [ ] Conflict register: no severity ≥ 4 unresolved.
- [ ] Attorney sign-off captured (Phase 7).

---

## 16. Memory Hooks (Per Master OS)

After case completion, save to memory with proper namespacing:

- `project_<case_id>_ownership_chain` — full ownership timeline.
- `project_<case_id>_sof_chain` — SOF chain final (sanitized — no
  account numbers, no SSN).
- `project_<case_id>_filing_metadata` — receipt #, filing date,
  outcome.
- `playbook_e2_defensive_<jurisdiction>` — any new defensive paragraph
  pattern discovered (Tapu, TEFE/TUFE, spouse-lease, etc.) for reuse.
- `voice_e2_<phrase_id>` — verbatim firm-voice phrases newly added to
  the corpus.

**DO NOT WRITE to memory:** account numbers, routing numbers, SSNs,
passport numbers, full DOBs, full home addresses. PII strip BEFORE
persistence.

---

## 17. Worked Example — Kacar-Salih (Reference Case)

The manual above was calibrated against this real Akalan filing:

| Field | Value |
|-------|-------|
| Petitioner | LLC organized in Rhode Island (Oct 4, 2021) |
| Beneficiary | Salih Kacar (Turkish national) |
| Co-owner | Ozlem Demir (Turkish national, 50%) |
| Total investment | `$120,000.00` (`$80,000` at risk) |
| Source 1 | Real-property sale, TRY 4,000,000.00 |
| Source 2 | Rental income (spouse-named lease, TRY 14K → 19K/mo) |
| FX conversion | TRY 4,086,900 → USD 95,600 @ 42.75 (Nov 25, 2025) |
| US wires | USD 80,000 (2 international wires) |
| Deployment | USD 80,000 → co-owner's US account ending 3772 (Dec 11, 2025) |
| Employees at filing | 4 W-2 |
| Beneficiary role | President + Executive Chef + Kitchen Director |
| Effective ownership date | Dec 5, 2025 |
| Filing date | Jan 7, 2026 |
| Filing type | I-129 + I-539 + I-539A (E-2 Renewal w/ COS for spouse + 3 kids) |

Use this as a regression-test fixture: feed the Kacar-Salih documents
to a fresh agent run; the agent should produce a filing package that
mirrors Akalan's actual structure within a tight tolerance.

---

## 18. What Is Deliberately NOT in This Manual

- ChatGPT / GPT-5.5 specific instructions — the agent runs on
  Claude family models; cross-model is out of scope.
- Specific Anthropic API parameters (cache TTL, model routing) — see
  the portal codebase, not this manual.
- Database schema — see `/schemas/01-postgres-schema.sql`.
- Zod field types — see `/schemas/02-zod-schemas.ts`.
- Cover-letter literal template — see `01-COVER-LETTER-TEMPLATE.md`.
- Folder tree — see `02-CASE-FILE-STRUCTURE.md`.
- Exhibit index — see `03-EXHIBIT-INDEX-TEMPLATE.md`.
- Other visa types (EB-1A/B/C, O-1A/B, L-1A/B) — separate manuals.

---

## 19. Versioning

- **V1** — 2026-04-27. Initial manual. Calibrated against single
  Akalan filing (Kacar-Salih, 426 pp.).
- **Open improvements (V2 candidates):**
  - OCR + corpus-build 2-3 more Akalan E-2 filings to harden voice.
  - Add fact-extraction success metrics per skill.
  - Add the Reviewer's actual prompt template (currently only a
    checklist).
  - Add specific RFE response templates (Phase 4.5).
  - Add EAD-extension policy (post-end-of-automatic-EAD-extension).

---

**End of E-2 Manual.**
