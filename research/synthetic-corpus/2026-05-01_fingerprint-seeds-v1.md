# E-2 Document Fingerprint Synthetic Seeds — v1

- **Date:** 2026-05-01
- **Total gap variants identified:** 32
- **Source taxonomy:** `research/2026-04-29_doc-variant-taxonomy.md`
- **Source empirical:** `research/2026-04-29_e2-shared-cases-empirical.md`
- **Status:** draft v1 — awaiting Supervisor (Serra Yıldırım) sign-off before vector DB ingestion

---

## Gap inventory

P0 = privacy-blocked in public corpus (forms, internal memos, ownership instruments, cover letters)
P1 = Subtype 4 (essential-skills employee) — entire sub-type has zero public examples
P2 = other underrepresented variants (specialty civil-registry, niche financial, ancillary)

| doc_type | variant# | variant name | empirical examples | priority |
|---|---|---|---|---|
| status_doc | 1 | Consular visa foil | 0 | P0 |
| status_doc | 2 | I-797 USCIS notice | 0 | P0 |
| status_doc | 3 | EAD card scan | 0 | P0 |
| status_doc | 4 | CBP admission stamp page | 0 | P0 |
| i94 | 1 | CBP I-94 web printout | 0 | P0 |
| i94 | 2 | Legacy paper I-94 / I-797A tear-off | 0 | P2 |
| bank_statement | 3 | Multi-currency / FX-account | 0 | P2 |
| bank_statement | 4 | Brokerage / investment account | 0 | P2 |
| tax_doc | 3 | Pass-through return (1065 / K-1) | 0 | P2 |
| money_movement | 3 | Check image / counter-deposit slip | 0 | P2 |
| money_movement | 4 | Inter-account / book transfer | 0 | P2 |
| source_of_funds | 3 | Inheritance / probate document | 0 | P2 |
| source_of_funds | 5 | Sale-of-business / SPA | 0 | P2 |
| source_of_funds | 6 | Salary/savings declaration | 0 | P2 |
| formation_doc | 3 | Operating Agreement / Bylaws | 0 | P0 |
| formation_doc | 4 | Amendment / Restatement | 0 | P0 |
| formation_doc | 5 | Certificate of Good Standing | 0 | P2 |
| ownership_evidence | 1 | Cap table / member schedule | 0 | P0 |
| ownership_evidence | 2 | Share / membership certificate | 0 | P0 |
| ownership_evidence | 3 | Membership-Interest Transfer Agreement | 0 | P0 |
| business_contract | 4 | Incentive / grant / tax-credit instrument | 0 | P2 |
| business_contract | 5 | Partnership / JV agreement | 0 | P2 |
| uscis_or_dos_form | 1 | I-129 + E-Supplement | 0 | P0 |
| uscis_or_dos_form | 2 | G-28 / G-1145 / G-1650 | 0 | P0 |
| uscis_or_dos_form | 3 | DS-160 / DS-156E | 0 | P0 |
| uscis_or_dos_form | 4 | I-539 / I-539A | 0 | P0 |
| cover_letter | 1 | Petition memorandum / brief (Tab B) | 0 | P0 |
| employer_letter | 3 | Foreign service record (Hizmet Belgesi) | 0 | P1 |
| employer_letter | 4 | Job offer letter | 0 | P1 |
| vital_record | 2 | Marriage certificate | 0 | P2 |
| vital_record | 3 | Divorce decree | 0 | P2 |
| translation_certification | 1 | Translator certification page | 0 | P0 |

---

## Fingerprint entries

### status_doc / Variant 1 — Consular visa foil
- **Why synthetic:** Real foils are passport-affixed and never publicly shared (carries holder photo + MRZ + visa number); empirical corpus has zero scans.
- **Structural skeleton:** US-DOS template sticker (single page) / top band "VISA — UNITED STATES OF AMERICA" with eagle seal / left photo box ~25% / right field block (Surname, Given Name, Sex, Birth Date, Nationality, Passport No., Entries, Issue/Expiry, Annotations, Visa Class) / two-line ICAO MRZ at bottom / issuing-post field (e.g., "ISTANBUL", "TORONTO").
- **Mandatory fields/labels:** Surname, Given Name, Visa Type/Class (E2), Issuing Post, Control Number, Entries, Issue Date, Expiration Date, Annotations.
- **Typographic signature:** Sans-serif uppercase fixed grid; OCR-B for MRZ; thin horizontal divider lines; faint blue-and-red US watermark; passport-page yellowed background bleed at edges.
- **Distinguishing markers vs neighbor variants:** Vs I-797 (Variant 2) — foil has photo and MRZ, I-797 never does. Vs CBP stamp (Variant 4) — foil is printed sticker geometry, stamp is ink-on-page with handwriting. Vs EAD card (Variant 3) — foil is single-sided in passport, EAD is two-sided plastic card scan.
- **Synthetic vector seed (3 sentences):** "VISA — UNITED STATES OF AMERICA. Surname / Nom: [BENEFICIARY SURNAME]. Given Name: [BENEFICIARY GIVEN]. Visa Type / Class: R / E2. Issuing Post: ISTANBUL. Control Number: [CTRL-NO]. Entries: M. Issue Date: [DATE]. Expiration Date: [DATE]. Annotations: PETITIONER — [COMPANY NAME]. P<USA[BENEFICIARY-SURNAME]<<[BENEFICIARY-GIVEN]<<<<<<<<<<<<<<<<<<<<<<<<."

### status_doc / Variant 2 — I-797 USCIS Notice of Action
- **Why synthetic:** Privacy-blocked; receipt numbers and personal data redacted in every public case study.
- **Structural skeleton:** DHS letterhead band top-left with USCIS seal / "Notice of Action" header right / four-cell case data table (Receipt Number, Received Date, Priority Date, Notice Date / Page) / second table (Petitioner, Beneficiary, Class, Valid From, Valid To) / body paragraph in formal register / fee/payment block / I-94 perforation tear-off strip at page 2 bottom (I-797A only) / form footer "Form I-797A (Rev. MM/DD/YY) N".
- **Mandatory fields/labels:** "U.S. Citizenship and Immigration Services", "Notice of Action", Receipt Number, Notice Type, Class, Valid From, Valid To, "If you have any questions...", "Form I-797".
- **Typographic signature:** Times-roman body, monospace receipt number, USCIS dark-blue seal upper-left, two-column header table with hairline rules, perforation marks rendered as dashed line across full page width.
- **Distinguishing markers vs neighbor variants:** Vs visa foil — I-797 is on US letter paper with USCIS letterhead, no photo, no MRZ. Vs RFE notice (uscis_or_dos_form Variant 5) — I-797 says "Notice Type: Approval Notice" / "Receipt Notice" / "Extension Approval", RFE says "Request for Evidence". Vs EAD — no card geometry.
- **Synthetic vector seed (3 sentences):** "U.S. Department of Homeland Security — U.S. Citizenship and Immigration Services. NOTICE OF ACTION. RECEIPT NUMBER: EAC[10-DIGITS]. CASE TYPE: I-129, PETITION FOR A NONIMMIGRANT WORKER. NOTICE TYPE: APPROVAL NOTICE. CLASS: E-2. VALID FROM [DATE] TO [DATE]. The above petition has been approved. The petition indicates that the named foreign worker will apply for a visa abroad at the American Embassy or Consulate at [POST]. Please contact the consulate directly for information about visa issuance procedures."

### status_doc / Variant 3 — EAD card scan
- **Why synthetic:** Cards are scanned only in firm files; carry photo, USCIS#, A-number — never publicly shared.
- **Structural skeleton:** Two card images on single PDF page (front above, back below) / front: USCIS dark-blue seal top-left, "EMPLOYMENT AUTHORIZATION" red header band, holder photo left, identity fields right (Surname, Given Name, USCIS#, Category, Card #, Country of Birth, Terms, Card Expires) / back: signature strip, machine-readable optical band (3 lines), "Department of Homeland Security" footer.
- **Mandatory fields/labels:** "Employment Authorization", USCIS#, Category (e.g., "E-2-S", "A05", "C09"), Card Expires, Sex, Country of Birth.
- **Typographic signature:** Card aspect ~85×54 mm; security-print rosette pattern; laser-engraved monospace identity text; holographic overlay artifacts on scan; USCIS eagle holographic.
- **Distinguishing markers vs neighbor variants:** Vs national-ID (government_id Variant 1) — EAD has USCIS seal not foreign-state emblem, "E-2-S" / "A05" / "C09" category code is unique to USCIS. Vs Green Card (government_id Variant 3) — EAD says "Employment Authorization" not "Permanent Resident", expiry within 1-3 years.
- **Synthetic vector seed (3 sentences):** "EMPLOYMENT AUTHORIZATION — UNITED STATES OF AMERICA — DEPARTMENT OF HOMELAND SECURITY. Surname: [SPOUSE SURNAME]. Given Name: [SPOUSE GIVEN]. USCIS#: [9-DIGIT]. Category: E-2-S. Card #: [CARD-NO]. Country of Birth: TÜRKİYE. Sex: F. Card Expires: [DATE]. Terms and Conditions: Authorized to Work Only with DHS Authorization."

### status_doc / Variant 4 — CBP admission stamp page
- **Why synthetic:** Lives inside passport; never shared publicly with class/admit-until annotation visible.
- **Structural skeleton:** Single passport interior page background (yellowed cream paper, watermark visible) / one or more rectangular CBP ink stamps (port name + date + officer ID) / handwritten "E-2 / D/S" or "E-2 — MM/DD/YYYY" overlaid in officer's hand / no printed sticker geometry / passport page number visible top corner.
- **Mandatory fields/labels:** Port-of-entry name (e.g., "JFK INTERNATIONAL", "DTW", "TORONTO PRECLEARANCE"), CBP officer stamp number, "ADMITTED" text, handwritten class-of-admission, handwritten admit-until date or "D/S".
- **Typographic signature:** Ink-stamp rectangular geometry (~50×30 mm); officer handwriting in blue or black ballpoint; partial second/third stamps from prior trips; passport page background visible around stamps.
- **Distinguishing markers vs neighbor variants:** Vs visa foil (Variant 1) — stamp has no photo, no MRZ, no printed sticker; handwriting present. Vs I-94 web printout — stamp is image-only on passport page background, web printout is white-paper HTML aesthetic.
- **Synthetic vector seed (3 sentences):** "ADMITTED — JFK INTERNATIONAL — [DATE] — CBP OFFICER [STAMP-ID]. Class: E-2. Admit Until: D/S. United States Customs and Border Protection. Department of Homeland Security."

### i94 / Variant 1 — CBP I-94 web printout
- **Why synthetic:** Printouts contain 11-digit admission number tied to passport — universally redacted in public sharing.
- **Structural skeleton:** Single white page / DHS/CBP header band with seal top / "Most Recent I-94" or "Travel History" title / vertical label-value field block (Admission (I-94) Number, Family Name, First (Given) Name, Birth Date, Document Number, Country of Citizenship, Date of Entry, Class of Admission, Admit Until Date) / footer URL "i94.cbp.dhs.gov" with print-date timestamp.
- **Mandatory fields/labels:** "Admission (I-94) Number", "Class of Admission", "Admit Until Date", "Date of Entry", "Country of Citizenship", footer URL.
- **Typographic signature:** Browser-print aesthetic; sans-serif (Helvetica/Arial); HTML-rendered table with thin gray rules; small print-date footer; no signature; no government wet-ink anywhere.
- **Distinguishing markers vs neighbor variants:** Vs CBP stamp (status_doc Variant 4) — I-94 printout is white-paper HTML report, no passport-page bleed, no handwriting. Vs legacy paper I-94 (Variant 2) — no card aspect, no perforation, no handwriting overlay.
- **Synthetic vector seed (3 sentences):** "U.S. Customs and Border Protection — Most Recent Arrival. Admission (I-94) Number: [11-DIGIT]. Family Name: [BENEFICIARY SURNAME]. First (Given) Name: [BENEFICIARY GIVEN]. Birth Date: [DATE]. Document Number: [PASSPORT-NO]. Country of Citizenship: TURKEY. Date of Entry: [DATE]. Class of Admission: E2. Admit Until Date: [DATE]. Retrieved from i94.cbp.dhs.gov on [DATE]."

### i94 / Variant 2 — Legacy paper I-94 / I-797A tear-off
- **Why synthetic:** Pre-2013 cards survive only in long-history renewal files; never narrated in public corpus.
- **Structural skeleton:** Card-aspect scanned image (~150×80 mm, perforated edges) / pre-printed CBP form fields ("Admission Number", "Family Name", "First Name", "Birthdate", "Country of Citizenship") / handwritten port-of-entry stamp + admit-until in officer's hand / perforation marks visible top and bottom edges / for I-797A tear-off variant: appears as bottom strip of an I-797A page with same perforated geometry.
- **Mandatory fields/labels:** "Arrival/Departure Record", "Admission Number", "Family Name", "Country of Citizenship", port stamp, admit-until handwritten.
- **Typographic signature:** Green-and-white card stock or pale-yellow tear-off paper; handwriting in ballpoint dominant; staple-puncture artifacts at corner; perforation dot pattern at edges.
- **Distinguishing markers vs neighbor variants:** Vs web printout (Variant 1) — physical card geometry, handwriting, no URL footer. Vs CBP stamp page — Variant 2 IS the form (not a stamp on a passport page); the form itself has pre-printed fields.
- **Synthetic vector seed (3 sentences):** "Arrival/Departure Record — Form I-94. Admission Number: [11-DIGIT]. 1. Family Name: [BENEFICIARY SURNAME]. 2. First (Given) Name: [BENEFICIARY GIVEN]. 3. Birthdate (Day/Mo/Yr): [DATE]. 4. Country of Citizenship: TURKEY. Admitted Until: [HANDWRITTEN DATE or D/S]. Class of Admission: E2."

### bank_statement / Variant 3 — Multi-currency / FX-account
- **Why synthetic:** SOF chains involving FX conversion are described categorically in public corpus but the segmented sub-ledger structure is never reproduced.
- **Structural skeleton:** Bank header band with logo + branch / account holder block + currency-list table ("TRY · USD · EUR") / per-currency segmented body: each currency gets its own opening-balance line, transaction list, closing-balance line / FX-conversion entries cross-reference between segments with conversion rate / footer summary table (per-currency closing balance + USD-equivalent at statement close).
- **Mandatory fields/labels:** "Statement Period", per-currency "Opening Balance" / "Closing Balance", "FX Rate" or "Conversion Rate", three-letter ISO codes (TRY, USD, EUR, GBP), "USD Equivalent".
- **Typographic signature:** Multi-section body with horizontal rule between currency segments; columnar transaction tables; bold currency-symbol headers; conversion rates rendered to 4-6 decimals (e.g., 1 USD = 32.4567 TRY).
- **Distinguishing markers vs neighbor variants:** Vs personal/business statement (Variants 1/2) — multi-currency has multiple ISO codes co-occurring and segmented ledgers, single-currency variants do not. Vs brokerage (Variant 4) — no holdings table, no tickers/CUSIPs.
- **Synthetic vector seed (3 sentences):** "Hesap Özeti / Account Statement — [BANK NAME]. Hesap Sahibi / Account Holder: [BENEFICIARY]. IBAN: TR[24-DIGIT]. Hesap Türü / Account Type: Çoklu Döviz / Multi-Currency. Dönem / Period: [DATE] – [DATE]. TRY açılış bakiyesi / TRY Opening Balance: [TRY AMOUNT]. USD opening balance: [USD AMOUNT]. FX conversion [DATE]: [TRY AMOUNT] @ rate 1 USD = 32.4567 TRY → [USD AMOUNT]."

### bank_statement / Variant 4 — Brokerage / investment account
- **Why synthetic:** SOF from portfolio liquidation appears categorically but holdings tables (with tickers + cost basis) are highly identifying and never shared.
- **Structural skeleton:** Brokerage logo + period header / "Portfolio Summary" table (Asset Class, Market Value, Cost Basis, Unrealized Gain/Loss, % of Portfolio) / "Activity" section (Trades, Dividends, Interest, Withdrawals, Deposits) / "Holdings" table (Symbol/CUSIP, Description, Quantity, Market Price, Market Value, Cost Basis) / "Realized Gains/Losses" page / disclosures page at end (small print).
- **Mandatory fields/labels:** "Portfolio Summary", "Asset Allocation", "Holdings", ticker symbols (3-5 char) or CUSIPs (9 char) or ISINs (12 char), "Cost Basis", "Unrealized Gain/Loss", "Realized".
- **Typographic signature:** Multi-page (5-25 pages); pie chart or bar graph for asset allocation; tabular grid with right-aligned currency columns; small-print disclosures at end; brokerage logo with FINRA/SIPC footer disclosure.
- **Distinguishing markers vs neighbor variants:** Vs personal/business deposit account — has holdings table with tickers/CUSIPs; market value vs cost basis columns. Vs multi-currency (Variant 3) — securities lexicon (Bought/Sold/Reinvested/Dividend), not FX-rate language.
- **Synthetic vector seed (3 sentences):** "[BROKERAGE NAME] — Account Statement. Account Number: [MASKED]. Account Holder: [BENEFICIARY]. Statement Period: [DATE] – [DATE]. Portfolio Summary: Total Market Value [USD AMOUNT], Total Cost Basis [USD AMOUNT], Unrealized Gain/Loss [USD AMOUNT]. Holdings: AAPL — Apple Inc. — 250.000 shares — Market Price [USD] — Market Value [USD AMOUNT] — Cost Basis [USD AMOUNT]."

### tax_doc / Variant 3 — Pass-through return (1065 / K-1)
- **Why synthetic:** Multi-member LLC returns and per-partner K-1s contain partner-specific allocations privacy-blocked in public sharing.
- **Structural skeleton:** Form 1065 cover page (entity name, EIN, Principal Business Activity, Date Business Started) / income section (gross receipts, COGS, gross profit) / deductions section / Schedule B (yes/no questions) / Schedule K (partners' aggregate share) / Schedule L balance sheet / Schedule M-1 / Schedule M-2 (partners' capital reconciliation) / per-partner Schedule K-1 attachments (one per partner: ownership %, share of income/loss/distributions).
- **Mandatory fields/labels:** "Form 1065 — U.S. Return of Partnership Income", EIN, "Schedule K-1 (Form 1065)", "Partner's Share of Income, Deductions, Credits, etc.", "Partner's identifying number", "Profit %", "Loss %", "Capital %".
- **Typographic signature:** IRS form gridded layout; OMB number top-right; per-partner K-1 schedules each ~2 pages with per-partner identifying block; partner capital reconciliation table.
- **Distinguishing markers vs neighbor variants:** Vs 1120 (Variant 2) — 1065 has K-1 schedules + no entity-level income tax line; 1120 has corporate tax computation. Vs 1040 (Variant 1) — entity filer not individual; no wage line.
- **Synthetic vector seed (3 sentences):** "Form 1065 — U.S. Return of Partnership Income — For calendar year [YEAR]. Name of Partnership: [COMPANY NAME] LLC. Employer Identification Number: [XX-XXXXXXX]. Date Business Started: [DATE]. Schedule K-1 (Form 1065) — Partner's Share of Income, Deductions, Credits, etc. Partner's identifying number: [SSN/EIN]. Partner's name: [BENEFICIARY]. Profit %: 50.0000%. Loss %: 50.0000%. Capital %: 50.0000%."

### money_movement / Variant 3 — Check / counter-deposit slip
- **Why synthetic:** Check images carry MICR routing/account; never shared in public corpus.
- **Structural skeleton:** Check image — top: bank logo, check number top-right, payor name + address top-left / middle: pay-to-the-order-of line + amount in numerals + amount in words / bottom: signature line + memo line + MICR band (routing-account-check#) / sometimes endorsement back image stitched to same PDF page (signature line + bank deposit stamp).
- **Mandatory fields/labels:** "Pay to the Order of", amount numerals, amount in words, "MEMO", MICR routing (9 digits) + account number + check number, signature.
- **Typographic signature:** Handwritten amount + payee dominant; printed payor address top-left; check security-print background pattern; MICR-font (E-13B) at bottom in distinctive squared digits; deposit-slip variant has teller-stamp + date-time-counter-ID rectangular stamp.
- **Distinguishing markers vs neighbor variants:** Vs wire (Variants 1/2) — check has MICR not SWIFT/ABA-as-routing-display; handwriting; image-heavy. Vs inter-account (Variant 4) — different bank possible; physical instrument geometry.
- **Synthetic vector seed (3 sentences):** "[BANK NAME]. Check No. [4-DIGIT]. Date: [DATE]. Pay to the Order of: [COMPANY NAME] LLC — [USD AMOUNT]. [USD AMOUNT in words] DOLLARS. MEMO: Capital contribution per Operating Agreement Schedule B. [BENEFICIARY signature]. ⑆[ROUTING 9-DIGIT]⑆ [ACCOUNT-NO]⑈ [CHECK-NO]."

### money_movement / Variant 4 — Inter-account / book transfer
- **Why synthetic:** Same-bank book transfers (personal → entity at same bank) are a routine Tab E.3 anchor but never publicly disclosed.
- **Structural skeleton:** Single-page receipt / bank header (same logo for both legs) / transaction-reference block / "From Account" line (masked) + "To Account" line (masked) / amount + value date / "Internal Transfer" / "Book Transfer" / "Virman" label / no SWIFT, no ABA routing displayed (same-bank context implied).
- **Mandatory fields/labels:** "Internal Transfer" / "Book Transfer" / "Virman", "From", "To", "Amount", "Reference", "Value Date", same-bank logo on both account lines.
- **Typographic signature:** Short receipt (typically <1 page); bank logo only once at top; account numbers shown masked (****1234); no FX rate; single-currency context only.
- **Distinguishing markers vs neighbor variants:** Vs international wire (Variant 1) — no SWIFT codes, no FX rate, no intermediary-bank line, no cross-border bank pair. Vs domestic wire/ACH (Variant 2) — no ABA routing displayed, "Book"/"Internal" label rather than "Fedwire"/"ACH".
- **Synthetic vector seed (3 sentences):** "[BANK NAME] — Internal Transfer Receipt. Reference: [REF-ID]. Date: [DATE]. From: [BENEFICIARY] Personal Checking ****[LAST-4]. To: [COMPANY NAME] LLC Operating Account ****[LAST-4]. Amount: [USD AMOUNT]. Description: At-risk capital contribution to Petitioner per Operating Agreement § 3.1."

### source_of_funds / Variant 3 — Inheritance / probate document
- **Why synthetic:** Inheritance documents identify decedent + heirs by name and share-percent; privacy-sensitive and never shared.
- **Structural skeleton:** Court / civil-registry letterhead with seal / case number + date / "Veraset İlamı" / "Letters Testamentary" / "Grant of Probate" header / decedent block (name, last residence, date of death, registry record) / heirs block as table (heir name, kinship, share-fraction or percent) / sometimes asset description (real property parcel, bank balances) / judge or registrar signature + wet-ink seal.
- **Mandatory fields/labels:** "Müteveffa" / "Deceased" / "Decedent", "Mirasçı" / "Heir" / "Beneficiary", share-percent or share-fraction (e.g., "1/4", "25%"), case number, court / registry name, judge/registrar signature.
- **Typographic signature:** Civil-law: notarial protocol number at top, dense paragraph format, single-line signature with embossed seal; common-law: court caption (IN THE MATTER OF), formal "WHEREAS" recitals, seal embossed bottom-right.
- **Distinguishing markers vs neighbor variants:** Vs deed (Variant 1) — has decedent block + heirs share table; deed has buyer/seller bilateral block. Vs gift letter (Variant 2) — court-issued not donor-letter; multi-page; heirs not single recipient.
- **Synthetic vector seed (3 sentences):** "T.C. [İL] [İLÇE] Sulh Hukuk Mahkemesi — Veraset İlamı — Esas No: [YEAR]/[NO]. Müteveffa: [DECEDENT NAME], T.C. Kimlik No [11-DIGIT], son ikametgâh adresi [ADDRESS], [DATE] tarihinde vefat etmiştir. Mirasçılar ve hisseleri aşağıda gösterilmiştir: [HEIR 1 NAME] (eş) — 1/4 hisse; [HEIR 2 NAME] (çocuk) — 3/8 hisse; [BENEFICIARY] (çocuk) — 3/8 hisse. İşbu veraset ilamı [DATE] tarihinde tanzim edilmiştir."

### source_of_funds / Variant 5 — Sale-of-business / SPA
- **Why synthetic:** Prior-business SPAs contain consideration, reps & warranties, and counterparty identities — universally privacy-blocked.
- **Structural skeleton:** Cover page ("Share Purchase Agreement" / "Hisse Devir Sözleşmesi" + parties + date) / table of contents / Article 1 Definitions / Article 2 Purchase and Sale (consideration schedule) / Article 3 Closing / Article 4 Representations and Warranties of Seller / Article 5 Representations of Buyer / Article 6 Covenants / Article 7 Indemnification / Article 8 Termination / signature page (3+ signatories common).
- **Mandatory fields/labels:** "Share Purchase Agreement" / "SPA" / "Hisse Devir Sözleşmesi", "Purchase Price" / "Consideration", "Closing", "Representations and Warranties", "Indemnification", "Effective Date".
- **Typographic signature:** 15-60 pages; numbered sections + sub-sections (1.1, 1.2, 2.1...); defined-terms in Initial Caps; Schedule A/B/C exhibits at end (cap table, disclosure schedule, ancillary docs); multi-party signature page with title lines.
- **Distinguishing markers vs neighbor variants:** Vs deed (Variant 1) — purchase target is business shares, not real property; reps & warranties block; closing conditions; longer. Vs MITA (ownership_evidence Variant 3) — SPA is the *operative purchase* with consideration + reps; MITA is the *transfer instrument* moving the interest after the deal. Vs OA — SPA has buyer/seller; OA has members.
- **Synthetic vector seed (3 sentences):** "SHARE PURCHASE AGREEMENT — This Share Purchase Agreement is entered into as of [DATE] by and between [SELLER NAME], a natural person resident at [ADDRESS] ("Seller"), and [BUYER NAME] ("Buyer"). WHEREAS, Seller owns 100% of the issued and outstanding shares of [PRIOR COMPANY NAME] A.Ş., a joint-stock company organized under the laws of the Republic of Türkiye; WHEREAS, Seller wishes to sell and Buyer wishes to purchase all such shares for the consideration set forth herein. ARTICLE 2 — PURCHASE AND SALE. Section 2.1 Purchase Price. The aggregate consideration payable by Buyer to Seller for the Shares shall be [USD AMOUNT], payable as set forth in Schedule 2.1."

### source_of_funds / Variant 6 — Salary/savings declaration
- **Why synthetic:** Beneficiary-signed declarations are firm work-product; never shared publicly.
- **Structural skeleton:** Single-page (sometimes 2) declaration / declarant block at top (name, citizenship, ID number, address) / numbered or paragraph-form declarative statements (employment history span, total accumulated savings, asserted bank accounts, source attribution) / closing affirmation ("I declare under penalty of perjury") / signature + date / sometimes notarial acknowledgment block at bottom.
- **Mandatory fields/labels:** "Declaration" / "Affidavit" / "Beyan", declarant identity block, accumulation period (date range), aggregate amount asserted, signature + date.
- **Typographic signature:** Letter-format on plain paper or firm letterhead; Times-roman body; 1-2 pages; signature on its own line; no counterparty block; no per-transaction ledger (the corroborating ledger is filed separately as bank_statement).
- **Distinguishing markers vs neighbor variants:** Vs gift letter (Variant 2) — single-party (declarant) not donor + recipient; "savings" / "salary" language not "gift". Vs SPA (Variant 5) — short, no purchase, no counterparty. Vs court inheritance (Variant 3) — no court letterhead, no decedent.
- **Synthetic vector seed (3 sentences):** "DECLARATION OF SOURCE OF FUNDS. I, [BENEFICIARY], a citizen of the Republic of Türkiye, holding Turkish national identity number [11-DIGIT] and resident at [ADDRESS], do hereby declare and affirm the following. From [DATE] through [DATE] I was continuously employed as [TITLE] at [PRIOR EMPLOYER NAME], earning aggregate net compensation of approximately [USD AMOUNT] over that period. The capital invested in [COMPANY NAME] LLC originates entirely from these accumulated post-tax earnings, which were held in my personal accounts at [BANK NAME] (IBAN TR[24-DIGIT]) prior to transfer to the Petitioner."

### formation_doc / Variant 3 — Operating Agreement / Bylaws
- **Why synthetic:** OAs contain member capital schedules, governance, and distribution waterfalls — entirely absent from public corpus by name.
- **Structural skeleton:** Cover page (entity name + state + "Operating Agreement" + effective date) / Recitals (WHEREAS clauses) / Article I Definitions / Article II Formation / Article III Members and Capital Contributions (with Schedule A — Members + Initial Capital) / Article IV Allocations and Distributions / Article V Management (Manager-Managed vs Member-Managed) / Article VI Transfers of Membership Interest / Article VII Dissolution / Article VIII Miscellaneous / signature page / Schedule A (member roster) / Schedule B (capital contributions schedule).
- **Mandatory fields/labels:** "Operating Agreement", "Members", "Capital Contribution", "Membership Interest", "Manager", "Distributions", "Schedule A", "Schedule B", "Effective Date".
- **Typographic signature:** 20-80 pages; numbered Articles + Sections; defined terms in Initial Caps; Schedule A is a member-name + percentage table at the end; signature page with member-name + date lines; firm letterhead absent (internal document).
- **Distinguishing markers vs neighbor variants:** Vs Articles (Variant 1) — internal not state-filed, no "FILED" stamp, no registered-agent block; long page count. Vs MITA (ownership_evidence V3) — OA is the *governance constitution*, MITA is a *single transfer event*. Vs amendment (Variant 4) — original not modification.
- **Synthetic vector seed (3 sentences):** "OPERATING AGREEMENT OF [COMPANY NAME] LLC, a [STATE] limited liability company. This Operating Agreement (this "Agreement") is entered into and effective as of [DATE] by and among the Members listed on Schedule A hereto. WHEREAS, the Members have caused the Company to be formed by filing the Articles of Organization with the [STATE] Secretary of State on [DATE]; NOW, THEREFORE, in consideration of the mutual covenants set forth herein, the Members agree as follows. ARTICLE III — MEMBERS AND CAPITAL CONTRIBUTIONS. Section 3.1. Each Member has contributed to the capital of the Company the amount set forth opposite such Member's name on Schedule B."

### formation_doc / Variant 4 — Amendment / Restatement
- **Why synthetic:** Amendments cross-reference original filing; never narrated in public corpus.
- **Structural skeleton:** State-filing layout similar to Articles (state seal area, FILED stamp, filing date) / title "Articles of Amendment" / "Amended and Restated Articles of Organization" / "Certificate of Conversion" / cross-reference to original (charter number + original filing date) / specific amendment language (name change / address / member admission / entity-type conversion) / organizer or member signature.
- **Mandatory fields/labels:** "Amendment" / "Amended and Restated" / "Conversion", reference to original Charter Number, "FILED" state stamp, Effective Date.
- **Typographic signature:** Shorter than original Articles (1-3 pages typical); state-template form with fillable fields; FILED stamp from state office; identical state-letterhead but title says Amendment.
- **Distinguishing markers vs neighbor variants:** Vs original Articles (Variant 1) — title contains "Amendment" / "Restated" / "Conversion"; cross-references prior charter. Vs Good Standing (Variant 5) — Amendment changes the entity, Good Standing certifies current status without changing it.
- **Synthetic vector seed (3 sentences):** "ARTICLES OF AMENDMENT TO ARTICLES OF ORGANIZATION OF [COMPANY NAME] LLC. Pursuant to the provisions of [STATE STATUTE] § ___, the undersigned hereby submits the following Articles of Amendment, amending the Articles of Organization originally filed with the [STATE] Secretary of State on [DATE] under Charter Number [CHARTER-NO]. The name of the Company is hereby changed from "[OLD NAME] LLC" to "[NEW NAME] LLC" effective as of [DATE]. FILED — Office of the Secretary of State of [STATE] — [DATE]."

### formation_doc / Variant 5 — Certificate of Good Standing
- **Why synthetic:** Required as currency-of-existence at filing; never narrated in public corpus.
- **Structural skeleton:** Single-page state-issued certificate / state seal embossed center-top or full-color upper-left / "Certificate of Good Standing" / "Certificate of Existence" / "Certificate of Status" header / certifying paragraph (entity name, formation date, statement that entity is in good standing as of [date]) / Secretary of State signature block / state seal embossed at bottom-right / certification number.
- **Mandatory fields/labels:** "Good Standing" / "Existence" / "Status", entity name, formation date, certification date (recent — typically within 90 days of E-2 filing), Secretary's signature, certification number.
- **Typographic signature:** Single page; ornate state seal (embossed circle); formal calligraphic title in some states; Secretary of State signature reproduced in printed form; sometimes blue ribbon/foil security feature.
- **Distinguishing markers vs neighbor variants:** Vs Articles (Variant 1) — single page; no "FILED" stamp; current-status snapshot not original charter. Vs amendment (Variant 4) — does not change the entity; certifies current existence only.
- **Synthetic vector seed (3 sentences):** "STATE OF [STATE] — OFFICE OF THE SECRETARY OF STATE — CERTIFICATE OF GOOD STANDING. I, [SECRETARY NAME], Secretary of State of the State of [STATE], do hereby certify that [COMPANY NAME] LLC, a domestic limited liability company organized under the laws of this State on [DATE], Charter Number [CHARTER-NO], is in good standing and is current in payment of all franchise taxes and annual report filings as of the date of this Certificate. Given under my hand and the Great Seal of the State of [STATE] at the City of [CAPITAL] this [DATE]. Certification Number: [CERT-NO]."

### ownership_evidence / Variant 1 — Cap table / member schedule
- **Why synthetic:** Cap tables enumerate every owner by name, percent, and class — privacy-sensitive and never publicly shared.
- **Structural skeleton:** Page header (entity name + "Capitalization Table" / "Members Schedule" + as-of date) / tabular body (Owner Name / Class / Units or Shares / Ownership % / Date Acquired / Capital Contribution) / totals row at bottom (sum of % = 100.0000) / sometimes class-by-class subtotal / officer signature or initial block at the bottom.
- **Mandatory fields/labels:** "Cap Table" / "Capitalization Table" / "Schedule of Members", "Owner" / "Member" / "Shareholder", "Class", "%", "Total: 100.0000%", as-of date, officer signature.
- **Typographic signature:** Spreadsheet-style tabular layout; fixed-width number columns; right-aligned percentages and currency; 1-3 pages; minimal narrative; column gridlines.
- **Distinguishing markers vs neighbor variants:** Vs OA (formation_doc Variant 3) — cap table is a standalone schedule (sometimes Schedule A of an OA); concentrated tabular data only. Vs share certificate (Variant 2) — cap table lists multiple owners aggregated; certificate names one. Vs MITA (Variant 3) — snapshot, not transfer event.
- **Synthetic vector seed (3 sentences):** "[COMPANY NAME] LLC — Schedule of Members — As of [DATE]. Member Name | Class | Membership Units | Ownership % | Date Acquired | Capital Contribution. [BENEFICIARY] | Class A | 7,500 | 75.0000% | [DATE] | [USD AMOUNT]. [CO-OWNER NAME] | Class A | 2,500 | 25.0000% | [DATE] | [USD AMOUNT]. Total | | 10,000 | 100.0000% | | [USD AMOUNT]."

### ownership_evidence / Variant 2 — Share / membership certificate
- **Why synthetic:** Physical share certificates with certificate number + holder name are issued in firm files; never publicly shared.
- **Structural skeleton:** Single page, often landscape / ornamental engraved border (vine / scrollwork / guilloche security pattern) / entity name as large display type center-top / "This Certifies That [HOLDER] is the registered owner of [N] [units / shares / membership interests]" / certificate number top-right or bottom-right (e.g., "Certificate No. 1") / two officer signature blocks side-by-side at bottom (President + Secretary, or Manager + Member) / corporate seal embossed center-bottom / date of issuance.
- **Mandatory fields/labels:** "Certificate", "This Certifies That", holder name, number of shares/units, certificate number, two officer signatures, corporate seal, date.
- **Typographic signature:** Ornamental serif display title; engraved/scrolled border; landscape orientation common; embossed circular seal; calligraphic flourishes; gold or blue accents.
- **Distinguishing markers vs neighbor variants:** Vs cap table (Variant 1) — single-holder named in body, ornamental layout, certificate number prominent, not tabular. Vs MITA (Variant 3) — certificate is *evidence of ownership*, MITA is the *transfer instrument*.
- **Synthetic vector seed (3 sentences):** "[COMPANY NAME] LLC — Membership Interest Certificate — Certificate No. 1. This Certifies That [BENEFICIARY] is the registered owner of Seven Thousand Five Hundred (7,500) Class A Membership Units of [COMPANY NAME] LLC, a [STATE] limited liability company, transferable on the books of the Company in person or by duly authorized attorney upon surrender of this certificate properly endorsed. In Witness Whereof, the Company has caused this Certificate to be signed by its duly authorized officers and to be sealed with the Seal of the Company this [DATE]. _____________ Manager   _____________ Secretary."

### ownership_evidence / Variant 3 — Membership-Interest Transfer Agreement
- **Why synthetic:** MITAs are Akalan's canonical Tab D.5 / E.3.a anchor; entirely absent from public corpus.
- **Structural skeleton:** Cover page (title + parties + effective date) / Recitals (assignor's prior ownership, basis for transfer, consideration) / Section 1 Transfer / Section 2 Consideration / Section 3 Representations and Warranties / Section 4 Effective Date / Section 5 Further Assurances / Section 6 Governing Law / signature page (assignor + assignee + sometimes Manager consent) / Schedule A (description of transferred interest).
- **Mandatory fields/labels:** "Membership Interest Transfer Agreement" / "Assignment of Membership Interest" / "Hisse Devir Sözleşmesi", "Assignor", "Assignee", "Effective Date", "Consideration", units or percentage transferred.
- **Typographic signature:** 3-12 pages; numbered sections; Initial-caps defined terms; bilateral signature block; sometimes notarial acknowledgment if cross-border; clean professional formatting on firm or party letterhead.
- **Distinguishing markers vs neighbor variants:** Vs SPA (source_of_funds Variant 5) — MITA is single-instrument transfer of LLC membership interest, much shorter than full SPA; SPA is corporate-shares with reps & warranties + closing conditions. Vs cap table — bilateral transfer event, not snapshot. Vs share certificate — instrument moving the interest, not certificate evidencing it.
- **Synthetic vector seed (3 sentences):** "MEMBERSHIP INTEREST TRANSFER AGREEMENT — This Membership Interest Transfer Agreement (this "Agreement") is entered into as of [DATE] by and between [ASSIGNOR NAME] ("Assignor") and [ASSIGNEE NAME] ("Assignee"). WHEREAS, Assignor is the record and beneficial owner of [PERCENTAGE]% of the Membership Interests of [COMPANY NAME] LLC, a [STATE] limited liability company (the "Company"); WHEREAS, Assignor desires to transfer and assign to Assignee, and Assignee desires to accept from Assignor, all of Assignor's right, title, and interest in such Membership Interests in exchange for the consideration set forth herein. Section 1. Transfer. Effective as of the Effective Date, Assignor hereby irrevocably transfers, assigns, and conveys to Assignee all of Assignor's right, title, and interest in [N] Membership Units of the Company, representing [PERCENTAGE]% of the issued and outstanding Membership Interests."

### business_contract / Variant 4 — Incentive / grant / tax-credit instrument
- **Why synthetic:** Government incentive contracts are rare in E-2 corpus and absent from public sharing.
- **Structural skeleton:** Government / agency letterhead with seal / agreement title ("Production Tax Credit Award Letter", "Investment Incentive Agreement", "IRA §45Y Allocation Notice") / recipient block (entity name + EIN + address) / recital paragraphs (statutory authority, program name, application reference) / award block (amount or rate, performance conditions, eligibility period) / reporting/compliance schedule / agency signature + seal / sometimes recipient counter-signature.
- **Mandatory fields/labels:** "Incentive" / "Grant" / "Tax Credit" / "PTC" / "ITC" / "IRA §" / "Teşvik Belgesi", awarding agency, recipient EIN, performance conditions, reporting schedule, agency officer signature.
- **Typographic signature:** Government letterhead with department seal; formal contract or letter format; statutory citations in body (e.g., "26 U.S.C. § 45Y"); official seal embossed or rendered in color; signature block with agency-officer title.
- **Distinguishing markers vs neighbor variants:** Vs customer/vendor contract (Variants 1/2) — government party not commercial; "incentive" / "grant" / "tax credit" lexicon. Vs JV (Variant 5) — bilateral with state agency, not multi-party commercial.
- **Synthetic vector seed (3 sentences):** "T.C. Sanayi ve Teknoloji Bakanlığı — Yatırım Teşvik Belgesi — Belge No: [DOC-NO]. İşbu belge, [COMPANY NAME] A.Ş. (Vergi No: [TAX-ID]) tarafından [LOCATION] adresinde kurulacak [PROJECT DESCRIPTION] yatırımına ilişkin olarak, 2012/3305 sayılı Bakanlar Kurulu Kararı hükümleri çerçevesinde düzenlenmiştir. Yatırım Tutarı: [USD AMOUNT]. Sağlanan Destekler: KDV İstisnası, Gümrük Vergisi Muafiyeti, Vergi İndirimi (%50), Sigorta Primi İşveren Hissesi Desteği. Tamamlanma Süresi: [DATE]."

### business_contract / Variant 5 — Partnership / JV agreement
- **Why synthetic:** Multi-party JV instruments contain capital-contribution and profit-share schedules privacy-blocked in public corpus.
- **Structural skeleton:** Cover page (parties + title + effective date) / Article I Formation and Purpose / Article II Capital Contributions (with Schedule A — Capital Contribution per Party) / Article III Governance (Management Committee composition) / Article IV Allocations and Distributions / Article V Transfers and Exit / Article VI Dissolution / signature page (3+ signatories typical) / Schedule A capital schedule / Schedule B profit-sharing waterfall.
- **Mandatory fields/labels:** "Joint Venture Agreement" / "Partnership Agreement" / "Strategic Alliance Agreement" / "Ortaklık Sözleşmesi", "Capital Contribution", "Profit and Loss Allocation", "Management Committee", "Exit", multi-party signature block.
- **Typographic signature:** 20-60 pages; numbered Articles + Sections; multi-party signature page (3+ signatories distinguishes from bilateral commercial contracts); capital schedule and profit-share schedule prominent.
- **Distinguishing markers vs neighbor variants:** Vs customer/vendor (Variants 1/2) — bilateral commercial sale, not joint contribution. Vs OA (formation_doc Variant 3) — JV agreement is between independent parties forming a venture, OA is the venture's internal governance constitution. Vs MITA (ownership_evidence V3) — JV creates the structure, MITA transfers interest within an existing structure.
- **Synthetic vector seed (3 sentences):** "JOINT VENTURE AGREEMENT — This Joint Venture Agreement (this "Agreement") is entered into as of [DATE] by and among [PARTY A NAME], a [JURISDICTION] entity ("Party A"), [PARTY B NAME], a [JURISDICTION] entity ("Party B"), and [PARTY C NAME], a [JURISDICTION] entity ("Party C", and together with Party A and Party B, the "Parties"). WHEREAS, the Parties wish to establish a joint venture for the purpose of [JV PURPOSE] in the United States through a newly-formed [STATE] limited liability company to be known as [JV ENTITY NAME] LLC. ARTICLE II — CAPITAL CONTRIBUTIONS. Section 2.1. Each Party shall contribute capital to the Joint Venture in the amounts and on the terms set forth on Schedule A: Party A — [USD AMOUNT] (40%); Party B — [USD AMOUNT] (35%); Party C — [USD AMOUNT] (25%)."

### uscis_or_dos_form / Variant 1 — I-129 + E-Supplement
- **Why synthetic:** Mandatory in every USCIS-route case but never narrated by name in public corpus.
- **Structural skeleton:** Form I-129 cover page (Petition for a Nonimmigrant Worker — base form) / Part 1 Petitioner / Part 2 Information About This Petition / Part 3 Beneficiary / Part 4 Processing Information / Part 5 Basic Information About the Proposed Employment / Part 6 Foreign Employer / Part 7-9 various / signature page / E-Supplement appended (Part A Treaty Country, Part B Investor Information, Part C Business Information).
- **Mandatory fields/labels:** "Form I-129", "Petition for a Nonimmigrant Worker", "OMB No. 1615-0009", "Supplement E", Receipt Number (after USCIS), Petitioner block, Beneficiary block, Classification (E-2), Treaty Country, Investment Amount.
- **Typographic signature:** USCIS form gridded layout; "Part 1", "Part 2", etc. headers; checkboxes; OMB number top-right; form-edition date footer (e.g., "Form I-129 Edition 04/01/24"); 7-15 pages base + 4-8 pages Supplement E.
- **Distinguishing markers vs neighbor variants:** Vs DS-160 (Variant 3) — USCIS not DOS; multi-page form filed by Petitioner not Beneficiary. Vs G-28 (Variant 2) — long; substantive petition, not procedural attorney form. Vs I-539 (Variant 4) — for principal worker not derivatives.
- **Synthetic vector seed (3 sentences):** "Form I-129 — Petition for a Nonimmigrant Worker — Department of Homeland Security — U.S. Citizenship and Immigration Services — OMB No. 1615-0009. Part 1. Petitioner Information. Legal Name of Petitioner: [COMPANY NAME] LLC. Trade Name (if any): [DBA]. In Care Of Name: [BENEFICIARY], Member-Manager. Mailing Address: [ADDRESS]. FEIN: [XX-XXXXXXX]. Classification Sought: E-2 Treaty Investor. Supplement E to Form I-129 — Section 1: Treaty Country: TURKEY. Section 2: Total Cumulative Investment in U.S. Enterprise: [USD AMOUNT]."

### uscis_or_dos_form / Variant 2 — G-28 / G-1145 / G-1650
- **Why synthetic:** Procedural forms never enumerated by posters; firm-routine but unseen.
- **Structural skeleton:** Single or two-page USCIS form / form code in footer ("Form G-28", "Form G-1145", "Form G-1650") / OMB number top-right / Part 1 Information About Attorney / Part 2 Eligibility / Part 3 Notice of Appearance As Attorney or Accredited Representative (G-28) / signature blocks.
- **Mandatory fields/labels:** "Form G-28" / "Form G-1145" / "Form G-1650", "Notice of Entry of Appearance as Attorney" (G-28), "E-Notification" (G-1145), "Authorization for Credit Card Transactions" (G-1650), attorney name + bar admission, applicant name + signature.
- **Typographic signature:** Short (1-2 pages); form code prominent in footer; gridded form fields with checkboxes; signature lines at bottom; OMB number top-right; firm-internal completion routine.
- **Distinguishing markers vs neighbor variants:** Vs I-129 (Variant 1) — short, procedural, no Beneficiary substantive info. Vs RFE (Variant 5) — applicant-completed not USCIS-issued.
- **Synthetic vector seed (3 sentences):** "Form G-28 — Notice of Entry of Appearance as Attorney or Accredited Representative — Department of Homeland Security — OMB No. 1615-0105. Part 1. Information About Attorney or Accredited Representative. 1.a. Family Name: [ATTORNEY SURNAME]. 1.b. Given Name: Yasin. 2. State Bar Number: [BAR-ID]. 3. Law Firm: AKALAN BUSINESS IMMIGRATION PLLC. Part 2. Eligibility. I am an attorney eligible to practice law in, and a member in good standing of, the bar of the highest courts of the following states: NEW YORK. Part 3. Notice of Appearance. I hereby enter my appearance as attorney for the petitioner, [COMPANY NAME] LLC, in the above-captioned matter."

### uscis_or_dos_form / Variant 3 — DS-160 / DS-156E
- **Why synthetic:** DS-160 confirmation pages contain barcode + photo + application number; never publicly shared.
- **Structural skeleton:** DS-160 confirmation: single page, DOS letterhead top, "Online Nonimmigrant Visa Application — Confirmation" title, applicant photo top-right, barcode top-left, Application ID + Confirmation Number prominent, summary fields (Name, Date of Birth, Place of Birth, Passport Number, Visa Class), printed instruction footer. DS-156E: multi-page E-treaty supplement with sections on Treaty Country, Position, Investment, Source of Funds, Trade Information.
- **Mandatory fields/labels:** "DS-160" / "DS-156E", "Online Nonimmigrant Visa Application", "Confirmation", Application ID (10-character alphanumeric), Confirmation Number, Visa Class (E2), DOS seal, "Form DS-160" footer.
- **Typographic signature:** DS-160 confirmation has distinctive barcode block top-left (~30×30 mm); applicant photo top-right; sans-serif body; DOS Bureau of Consular Affairs footer URL. DS-156E is multi-page form-style with checkboxes and field-grid.
- **Distinguishing markers vs neighbor variants:** Vs I-129 (Variant 1) — DOS not USCIS; DS-160 is single-page barcode confirmation, I-129 is multi-page petition. Vs G-28 — applicant-completed visa application not attorney form.
- **Synthetic vector seed (3 sentences):** "U.S. Department of State — Online Nonimmigrant Visa Application (DS-160) — Confirmation. Application ID: [10-CHAR ALPHANUMERIC]. Confirmation Number: [10-DIGIT]. Surname: [BENEFICIARY SURNAME]. Given Names: [BENEFICIARY GIVEN]. Date of Birth: [DATE]. Place of Birth: [CITY], TURKEY. Passport Number: [PASSPORT-NO]. Visa Class: E — Treaty Trader/Investor. Bring this confirmation page with you to your interview."

### uscis_or_dos_form / Variant 4 — I-539 / I-539A
- **Why synthetic:** Spousal/child status applications privacy-blocked; never narrated.
- **Structural skeleton:** Form I-539 base (multi-page) / Part 1 Information About You / Part 2 Application Type (Extend / Change Status checkbox) / Part 3 Processing Information / Part 4 Information About Your Application / Part 5-7 various / signature page / I-539A supplement attached for each additional family member (spouse + each child gets one I-539A).
- **Mandatory fields/labels:** "Form I-539", "Application to Extend/Change Nonimmigrant Status", "Form I-539A — Supplemental Information for Application to Extend/Change Status", OMB number, Applicant name, Current Status, Status Sought.
- **Typographic signature:** USCIS gridded form layout; OMB top-right; form-edition footer; one I-539 + multiple I-539A attachments; signature pages for each.
- **Distinguishing markers vs neighbor variants:** Vs I-129 (Variant 1) — derivative-applicant focus, not principal worker. Vs DS-160 (Variant 3) — USCIS COS form, not DOS visa application.
- **Synthetic vector seed (3 sentences):** "Form I-539 — Application to Extend/Change Nonimmigrant Status — Department of Homeland Security — U.S. Citizenship and Immigration Services — OMB No. 1615-0003. Part 1. Information About You. 1.a. Family Name: [SPOUSE SURNAME]. 1.b. Given Name: [SPOUSE GIVEN]. 2. A-Number (if any): [A-NO or "None"]. 3. USCIS Online Account Number: [if any]. 4. Country of Birth: TURKEY. 5. Country of Citizenship: TURKEY. Part 2. Application Type. I am applying for: An extension of stay in my current status. Current Nonimmigrant Status: E-2 Dependent. Date Status Expires: [DATE]."

### cover_letter / Variant 1 — Petition memorandum / brief (Tab B)
- **Why synthetic:** AKALAN-style cover letters with element-by-element argument and `(Exhibit X.Y)` citations are firm-proprietary; entirely absent from public corpus.
- **Structural skeleton:** Firm letterhead (AKALAN BUSINESS IMMIGRATION PLLC) / addressee (USCIS Service Center or Consular Officer at [POST]) / RE: line (Petitioner / Beneficiary / Classification) / Introduction (one paragraph) / Statement of Facts / Argument organized by E-2 elements (E1 Treaty National / E2 Substantial Investment / E3 Real and Operating / E4 More Than Marginal / E5 Develop and Direct) with inline `(Exhibit X.Y)` citations / Conclusion + Relief Requested / attorney signature block (Yasin Akalan, Esq. or designated attorney + bar admission).
- **Mandatory fields/labels:** Firm letterhead, "RE:", element headers ("E1 — Treaty Nationality", "E2 — Substantial Investment", etc.), inline `(Exhibit [Tab].[N])` citations, "Respectfully submitted", attorney signature with bar ID.
- **Typographic signature:** 25-90 pages; Times-roman or firm-standard serif body; numbered headings; Tab-letter exhibit citations (A.1, B.3, C.5...); footer with page number "Page X of Y"; firm-letterhead reproduced at every page top in some firms.
- **Distinguishing markers vs neighbor variants:** Vs short transmittal (Variant 2) — long, element-organized, citation-dense. Vs business plan — no executive summary / market analysis sections; argumentative voice with statutory cites. Vs expert letter — firm-issued not third-party; advocacy not corroboration.
- **Synthetic vector seed (3 sentences):** "AKALAN BUSINESS IMMIGRATION PLLC — [DATE] — VIA E-FILING — U.S. Citizenship and Immigration Services — California Service Center. RE: Petition for E-2 Treaty Investor Classification — Petitioner: [COMPANY NAME] LLC — Beneficiary: [BENEFICIARY] — Classification: E-2 Treaty Investor — INA § 101(a)(15)(E)(ii). Dear Sir or Madam: This memorandum is submitted on behalf of the above-captioned Petitioner in support of its Petition for a Nonimmigrant Worker (Form I-129) seeking to classify the Beneficiary, [BENEFICIARY], as an E-2 treaty investor pursuant to INA § 101(a)(15)(E)(ii) and 8 C.F.R. § 214.2(e). As demonstrated below and corroborated by the documentary evidence at Tabs A through L, the Petitioner satisfies each of the five regulatory requirements for E-2 classification."

### employer_letter / Variant 3 — Foreign service record (Hizmet Belgesi)
- **Why synthetic:** Subtype 4 absent from entire empirical corpus; foreign-government service records also missing.
- **Structural skeleton:** Government / institutional letterhead with state seal / "Hizmet Belgesi" / "Service Record" / "Certificate of Employment" header / employee identity block (name, T.C. Kimlik / national ID, employee number) / multi-period employment history table (dates, position, grade, salary by period, status) / aggregate totals (total years of service) / official wet-ink stamp + signature block (HR director or registrar) + departmental seal / sometimes apostille attached.
- **Mandatory fields/labels:** "Hizmet Belgesi", employee national ID, position-by-position history with dates, employee number, official institutional seal, signature.
- **Typographic signature:** Civil-service form; multi-period table format; institutional seal (Turkish coat of arms for T.C. ministries); wet-ink stamp; bilingual (Turkish + sometimes English) for Subtype 4 export use.
- **Distinguishing markers vs neighbor variants:** Vs LOR (Variant 1) — fielded service record with multi-period table, not narrative praise. Vs VOE (Variant 2) — government issuer with seal not private-HR letterhead; multi-period not single-position. Vs job offer (Variant 4) — backward-looking service history, not forward-looking offer.
- **Synthetic vector seed (3 sentences):** "T.C. [BAKANLIK / KURUM] — Personel Daire Başkanlığı — HİZMET BELGESİ — Belge No: [DOC-NO] — Tarih: [DATE]. İşbu belge, aşağıda kimlik bilgileri verilen personelimizin kurumumuzdaki hizmet kayıtlarını tasdik etmek üzere düzenlenmiştir. Adı Soyadı: [BENEFICIARY]. T.C. Kimlik No: [11-DIGIT]. Sicil No: [EMP-ID]. Hizmet Kayıtları: [DATE] – [DATE] / Mühendis / 8. Derece / Aylık Brüt: [TRY AMOUNT]; [DATE] – [DATE] / Kıdemli Mühendis / 6. Derece / Aylık Brüt: [TRY AMOUNT]; [DATE] – devam ediyor / Proje Yöneticisi / 4. Derece / Aylık Brüt: [TRY AMOUNT]. Toplam Hizmet Süresi: [N] yıl [N] ay."

### employer_letter / Variant 4 — Job offer letter
- **Why synthetic:** Petitioner-to-Beneficiary offer letters are firm-routine for Subtype 3/4; never narrated publicly.
- **Structural skeleton:** Petitioner letterhead / date / addressee (Beneficiary at [ADDRESS]) / "Re: Offer of Employment" / opening congratulatory paragraph / Position block (Title, Reporting To, Start Date, Location) / Compensation block (Base Salary, Bonus, Equity, Benefits) / At-will + contingencies clauses (subject to E-2 approval / background check) / closing / Petitioner officer signature + Beneficiary acceptance signature line.
- **Mandatory fields/labels:** "Offer of Employment" / "Job Offer", Position title, Start Date, Base Salary, "subject to E-2 visa approval", "at-will employment", Petitioner officer signature, Beneficiary acceptance.
- **Typographic signature:** 2-4 pages; Petitioner letterhead (NOT firm letterhead); business-letter format; clear field-style position/compensation block; signature lines at end.
- **Distinguishing markers vs neighbor variants:** Vs LOR / VOE — forward-looking, contains start date and visa contingency; not historical employment description. Vs service record — single position, US Petitioner issuer, English-only typically.
- **Synthetic vector seed (3 sentences):** "[COMPANY NAME] LLC — [ADDRESS] — [DATE]. [BENEFICIARY] — [ADDRESS]. Re: Offer of Employment — Senior Project Manager. Dear [BENEFICIARY]: We are pleased to offer you the position of Senior Project Manager at [COMPANY NAME] LLC, reporting to the Managing Member. Your start date will be [DATE], subject to issuance of an E-2 nonimmigrant visa under INA § 101(a)(15)(E)(ii). Compensation: Base Salary [USD AMOUNT] per annum, paid bi-weekly, plus discretionary annual bonus targeted at 15% of base, plus standard benefits package."

### vital_record / Variant 2 — Marriage certificate
- **Why synthetic:** Tab L spouse derivative documents are privacy-blocked; not publicly shared in any case in empirical corpus.
- **Structural skeleton:** Civil-registry letterhead with seal / "Evlilik Belgesi" / "Marriage Certificate" / "Acte de Mariage" header / certificate number + registration date / spouse 1 block (name, DOB, citizenship, parents) / spouse 2 block (same fields) / marriage event (date + place + officiant) / witnesses block (sometimes) / registrar signature + civil-registry seal.
- **Mandatory fields/labels:** "Evlilik Belgesi" / "Marriage Certificate", spouse-1 name + DOB, spouse-2 name + DOB, marriage date, marriage place, registrar signature, registry seal.
- **Typographic signature:** Single page or two pages; civil-registry letterhead with state seal; bilateral spouse blocks; formal civil-registry stamp; sometimes ornamental border in some jurisdictions.
- **Distinguishing markers vs neighbor variants:** Vs birth certificate (Variant 1) — two-spouse subject not single registrant + parents block; "Marriage" header. Vs divorce decree (Variant 3) — civil-registry not court issuer; marriage event not dissolution; no case number.
- **Synthetic vector seed (3 sentences):** "T.C. [İL] [İLÇE] Nüfus Müdürlüğü — EVLİLİK BELGESİ — Kayıt No: [REG-NO] — Tarih: [DATE]. Evlenen Eş 1: [BENEFICIARY] — T.C. Kimlik No: [11-DIGIT] — Doğum Tarihi: [DATE] — Doğum Yeri: [CITY] — Anne Adı: [MOTHER] — Baba Adı: [FATHER]. Evlenen Eş 2: [SPOUSE NAME] — T.C. Kimlik No: [11-DIGIT] — Doğum Tarihi: [DATE] — Doğum Yeri: [CITY] — Anne Adı: [MOTHER] — Baba Adı: [FATHER]. Evlenme Tarihi: [DATE]. Evlenme Yeri: [CITY], TÜRKİYE. Nikah Memuru: [OFFICIANT NAME]."

### vital_record / Variant 3 — Divorce decree
- **Why synthetic:** Court-issued dissolution documents are privacy-blocked and rare in E-2 corpus.
- **Structural skeleton:** Court letterhead (e.g., "T.C. [İL] Aile Mahkemesi" / "[State] Family Court") / case caption with case number + parties / "Decree of Divorce" / "Boşanma Kararı" / "Decree of Dissolution" header / WHEREAS / FINDINGS recitals / ORDER section (dissolution effective date, custody / property / support disposition if relevant) / judge signature + court seal / sometimes filing stamp.
- **Mandatory fields/labels:** "Boşanma Kararı" / "Decree of Divorce" / "Decree of Dissolution", case number, parties (Plaintiff / Petitioner + Defendant / Respondent), effective date, judge signature, court seal.
- **Typographic signature:** Court caption format ("IN THE [COURT NAME] — IN RE THE MARRIAGE OF [PARTY A] and [PARTY B]"); legal-pleading aesthetic; numbered findings + ordered paragraphs; judge signature with court seal.
- **Distinguishing markers vs neighbor variants:** Vs marriage cert (Variant 2) — court not civil-registry issuer; case number; "Decree" / "Dissolution" language. Vs death cert (Variant 4) — no decedent; alive parties.
- **Synthetic vector seed (3 sentences):** "T.C. [İL] Aile Mahkemesi — Esas No: [YEAR]/[NO] — Karar No: [YEAR]/[NO] — BOŞANMA KARARI. Davacı: [PETITIONER NAME] — T.C. Kimlik No: [11-DIGIT]. Davalı: [RESPONDENT NAME] — T.C. Kimlik No: [11-DIGIT]. Dava: Boşanma. HÜKÜM: Tarafların Türk Medeni Kanunu m.166 uyarınca evlilik birliğinin temelinden sarsılması nedeniyle BOŞANMALARINA, kararın kesinleşme tarihinden itibaren yürürlüğe girmesine, kesinleşmiş işbu kararın nüfus müdürlüğüne tebliğine karar verilmiştir. Karar tarihi: [DATE]."

### translation_certification / Variant 1 — Translator certification page
- **Why synthetic:** Foundational to every non-English document in firm files but absent from public corpus by name.
- **Structural skeleton:** Single page (sometimes 2) on plain or translator-letterhead paper / "Certificate of Translation" / "Translator's Declaration" header / translator name + credentials block / source-language → target-language declarative statement / competency statement ("I am competent to translate from [SOURCE] to English") / document-translated description (e.g., "Marriage Certificate dated [DATE], registry no. [NO]") / date / translator signature / sometimes notarial acknowledgment block at bottom.
- **Mandatory fields/labels:** "Certificate of Translation" / "Translator's Declaration" / "Tercüme Tasdik Belgesi", translator name + credentials, "competent to translate", source → target language statement, document description, translator signature, date.
- **Typographic signature:** Single page; clean letter format; translator name + degree/certification credentials; signature block; sometimes simple notarial stamp at bottom; attached to source document and English translation.
- **Distinguishing markers vs neighbor variants:** Vs sworn-translator affidavit (Variant 2) — Variant 1 is translator-only signer (no notary stamp / no sworn-translator registration number / no apostille). Vs cover letter — single page, translator-issued not firm-issued, declarative not argumentative.
- **Synthetic vector seed (3 sentences):** "CERTIFICATE OF TRANSLATION. I, [TRANSLATOR NAME], holding a [DEGREE] from [INSTITUTION] and being fluent in both Turkish and English, hereby declare under penalty of perjury under the laws of the United States that I am competent to translate from Turkish to English and that the attached English-language document is a true, accurate, and complete translation of the attached Turkish-language original entitled "Evlilik Belgesi" (Marriage Certificate) dated [DATE], registry number [REG-NO], issued by the [İL] Nüfus Müdürlüğü. Executed this [DATE] at [CITY, STATE]. _______________ [TRANSLATOR NAME], Translator."

---

*End of file. Ready for Supervisor (Serra Yıldırım) review.*
