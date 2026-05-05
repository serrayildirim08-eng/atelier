# E-2 Document Structural-Variant Taxonomy

> Generic, genre-level structural variants for the 26 doc_types in
> `ingest/typed-memory.ts` (DocTypeEnum / DOC_TYPE_LABELS). Issuer,
> jurisdiction, and language live INSIDE a variant; structural genre
> separates variants. This is the scaffold for the document-fingerprint
> library used by the bot when filenames are uninformative.
>
> Anchored in `manuals/02-CASE-FILE-STRUCTURE.md`,
> `manuals/03-EXHIBIT-INDEX-TEMPLATE.md`,
> `manuals/E2-PREPARATION-MANUAL.md`, and the per-PDF micro-schemas in
> `ingest/typed-memory.ts`.
>
> Date: 2026-04-29
> Tab references use the firm's A-L convention.
> Element references use E1-E5 (Nationality / Investment / Real-Operating
> / More-than-Marginal / Develop-and-Direct).

---

## passport
**Generic variant count:** 2

### Variant 1 — Biometric biographic page (machine-readable)
- **What it is:** The single biographic page extracted (or photographed)
  out of a modern ICAO-9303 biometric passport. By far the dominant
  variant in E-2 filings — every Beneficiary, every dependent, every
  treaty-national co-owner produces one.
- **When it appears in an E-2 file:** Tab C (E1, Beneficiary), Tab C/D
  (E1, treaty-national co-owners), Tab L (E1/I-539 evidence for spouse
  and each minor child).
- **Shared features:**
  - Two-zone page layout: photo + biographic block on top half, MRZ
    (two ICAO lines, fixed-pitch monospace) bottom 15-20%.
  - Mandatory labels: surname, given names, nationality, date of birth,
    sex, place of birth, date of issue, date of expiry, passport
    number, type / code.
  - Single page per scan (rarely two if the photo is pulled separately).
  - Language: dual-language at minimum — issuing country's official
    language + English/French per ICAO; field labels are localized but
    MRZ is invariant.
  - Identifying indicia: holder photograph, machine-readable MRZ band,
    passport-number stamp, embedded biometric chip icon (gold/silver
    rectangle), holographic overlay artifacts on scans.
- **Distinguishing features:** Includes MRZ; one-page; biographic-only
  (no entry/exit stamps); page number is typically 2 of the booklet.
- **Filename keywords:** `passport | bio | biographic | data-page |
  page-2 | pasaport`
- **Confidence-weighted classifier signals:**
  1. Two-line ICAO MRZ band detected at the page bottom (highest signal,
     near-deterministic).
  2. Biographic field label set (nationality + passport number + DOB +
     expiry on one page).
  3. Photo placement (left or right ~25% of page width).
  4. Aspect ratio of scanned region matches ICAO booklet page (~125 ×
     88 mm, 1.42:1).
  5. Header zone contains country name in two scripts.
- **Cross-jurisdictional notes:** Layout is ICAO-fixed, so the structure
  is essentially identical across treaty countries; only the cover
  language, color palette, and emblem differ.

### Variant 2 — Stamped/used pages spread (entry-exit history)
- **What it is:** A scan of one or more interior pages bearing entry/
  exit stamps, visa foils, and admission stickers. Used when the firm
  needs to corroborate a travel history claim (renewal cases, prior
  status) rather than identity.
- **When it appears in an E-2 file:** Tab C/H (renewals — corroborating
  prior E-2 employment travel), occasionally Tab L if a dependent's
  travel history is contested.
- **Shared features:**
  - Mostly visual: stamps, visa foils, partial sticker images;
    biographic labels absent.
  - Variable count: 1-10+ pages depending on use.
  - Multiple language scripts on the same page (one per port-of-entry).
  - Identifying indicia: rectangular and circular ink stamps, visa
    foils with country emblems, US CBP admission stamps with date +
    class-of-admission code (e.g., "E-2 / D/S").
- **Distinguishing features:** No MRZ; no biographic field block;
  collage of dated stamps; often partially blank pages bordering the
  stamped page.
- **Filename keywords:** `passport-stamps | visa-pages | travel-history
  | entry-exit | used-pages`
- **Confidence-weighted classifier signals:**
  1. Absence of MRZ + presence of multiple distinct stamp shapes.
  2. Date-stamp density (multiple ISO-parsable dates in disparate
     orientations).
  3. Visa-foil rectangle (printed strip with photo + country emblem
     mid-page).
  4. CBP admission ink stamp pattern.
- **Cross-jurisdictional notes:** Stamp graphics vary widely; the
  variant signature is the *pattern density* of stamps, not the stamps
  themselves.

---

## status_doc
**Generic variant count:** 4

### Variant 1 — Consular visa foil (in-passport sticker, scanned)
- **What it is:** The full-page sticker affixed inside the passport by a
  US consulate, bearing photo, MRZ, and class-of-admission. In E-2
  renewal filings the prior E-2 visa is the canonical Tab C exhibit.
- **When it appears in an E-2 file:** Tab C (E1, renewal — prior E-2
  visa).
- **Shared features:**
  - Standardized US-DOS layout: photo top-left, US emblem watermark,
    name fields, visa number, control number, issuing post,
    annotations, two ICAO MRZ lines at the bottom.
  - Single page.
  - English-only.
  - Identifying indicia: holder photo, "VISA" header text, "United
    States of America" with eagle/seal, two-line MRZ, two-letter visa
    classification ("E2", "E1", "L1A", "B1/B2").
- **Distinguishing features vs other status_doc variants:** Pictorial
  (photo + MRZ); one page; printed inside a passport-page background
  not on US letter paper.
- **Filename keywords:** `visa | stamp | consular | foil | E2-visa |
  vize`
- **Classifier signals:**
  1. "VISA" + US Department of State header band.
  2. Photo + MRZ on US-format sticker (not ICAO booklet shape).
  3. Visa class code in dedicated field.
  4. Issuing-post field (e.g., "Istanbul", "London").
- **Cross-jurisdictional notes:** This is a US document regardless of
  passport country — layout is invariant across consular posts.

### Variant 2 — USCIS approval / receipt notice (I-797 family)
- **What it is:** A single-page or two-page USCIS-issued notice
  confirming receipt or approval of a petition (I-797A/B/C). For E-2
  COS / change-of-status this is the operative status proof.
- **When it appears in an E-2 file:** Tab C (E1, COS or prior E-2
  status), Tab H (renewal corroboration of prior E-2 period).
- **Shared features:**
  - DHS letterhead with USCIS logo top; case-data block (receipt
    number, priority date, notice type, class) in fixed positions; body
    paragraph + fee/processing notes; tear-off I-94 perforation strip
    on I-797A bottom.
  - 1-2 pages.
  - English-only.
  - Identifying indicia: receipt number with three-letter service-
    center prefix (EAC/WAC/MSC/LIN/SRC/IOE/NBC), barcode, Department
    of Homeland Security seal, "Notice of Action" header, "I-797"
    form number footer.
- **Distinguishing features:** Government letterhead format (not photo
  / not foil); two-column header table of dates; "Notice Type"
  classifier text; no MRZ.
- **Filename keywords:** `I-797 | I797 | approval | receipt | notice |
  EAD-approval | extension-approval`
- **Classifier signals:**
  1. "Notice of Action" header text with USCIS form footer "I-797".
  2. Receipt-number regex (3-letter prefix + 10 digits).
  3. Tabular date block (Received / Priority / Notice / Page).
  4. DHS seal top-left.
- **Cross-jurisdictional notes:** US-only document; invariant.

### Variant 3 — Employment Authorization Document (EAD) card scan
- **What it is:** A two-sided plastic-card scan combining photo, name,
  category code (e.g., A05, C09, E-2-S), and expiration. Common when a
  spouse or dependent has work authorization.
- **When it appears in an E-2 file:** Tab C (E1, treaty-national
  co-owner whose nationality proof is the EAD), Tab L (spouse).
- **Shared features:**
  - Card-sized image, often two scans on one PDF page (front + back).
  - Front: photo, USCIS seal, name, USCIS#, category, expiry, card #.
  - Back: signature strip, magnetic-style band, machine-readable text.
  - Identifying indicia: laminated-card reflections, "Employment
    Authorization" header, USCIS seal, category code.
- **Distinguishing features:** Card aspect ratio (~85×54 mm), two-sided
  scan, no MRZ in ICAO format (US-EAD has its own machine band on
  back).
- **Filename keywords:** `EAD | work-permit | I-766 | card | calisma-
  izni`
- **Classifier signals:**
  1. Card aspect ratio (front + back layout).
  2. "Employment Authorization" / "Resident" label.
  3. Category-code field ("A05", "C09", "E-2", "E-2-S").
  4. USCIS# / card-number printed pattern.
- **Cross-jurisdictional notes:** US-only.

### Variant 4 — CBP admission stamp page (passport interior)
- **What it is:** Same as passport-Variant-2 in form, but the *purpose*
  is to evidence US status (e.g., last admission). Often the firm files
  this under status_doc rather than passport when the operative fact
  is admission class + admit-until written by hand on the stamp.
- **When it appears in an E-2 file:** Tab C (E1, current status).
- **Shared features:** Single passport page with one or more US CBP
  ink stamps; handwritten class + admit-until annotations.
- **Distinguishing features vs Variant 1:** No visa foil (stamp not
  sticker); handwritten annotations; pages without photo.
- **Filename keywords:** `admission-stamp | CBP-stamp | entry-stamp |
  port-of-entry`
- **Classifier signals:**
  1. CBP rectangular ink stamp (date + port + class).
  2. Handwritten "D/S" or "MM-DD-YYYY" annotation overlaid.
  3. No printed sticker geometry.
- **Cross-jurisdictional notes:** Stamp is US-issued; passport
  background varies.

---

## i94
**Generic variant count:** 2

### Variant 1 — CBP I-94 web printout (post-2013, electronic record)
- **What it is:** A printout from i94.cbp.dhs.gov of the most recent
  arrival record. The dominant variant for nearly every modern filing.
- **When it appears in an E-2 file:** Tab C (E1, current status), Tab L
  (each dependent).
- **Shared features:**
  - Single page, white background, narrow margins.
  - Header: "U.S. Customs and Border Protection — Most Recent
    Arrival" or "Travel History".
  - Field block in label-value pairs: Admission (I-94) Number, Family
    Name, First Name, Birth Date, Document Number, Country of
    Citizenship, Date of Entry, Class of Admission, Admit Until Date.
  - English-only; printed today's date in footer.
  - Identifying indicia: 11-digit admission number, CBP/DHS footer
    URL, no signature (it's a web report).
- **Distinguishing features:** Web-printout aesthetic (HTML-table
  rendering); single-arrival fields; no perforation / no card.
- **Filename keywords:** `I-94 | I94 | arrival | CBP | i94-record |
  travel-history`
- **Classifier signals:**
  1. "Admission (I-94) Number" label + 11-digit number pattern.
  2. CBP/DHS URL in footer or header.
  3. "Most Recent Arrival" or "Travel History" header text.
  4. Class-of-Admission field with two-letter code ("E2", "B2",
     "F1").
- **Cross-jurisdictional notes:** US-only.

### Variant 2 — Legacy paper card (pre-2013) or attached I-797A tear-off
- **What it is:** The physical white card with stapled corners or the
  I-94 tear-off section at the bottom of an I-797A. Rare in current
  filings but appears in long-history renewals.
- **When it appears in an E-2 file:** Tab C (renewal corroboration
  history), Tab H (prior status periods).
- **Shared features:**
  - Card-shaped scanned image, perforated edges, handwritten
    annotations (port-of-entry, admit-until in officer's hand).
  - Pre-printed CBP fields (departure number, arrival/departure
    record).
  - Identifying indicia: green/white card stock, perforated tear
    line, handwriting overlaid on printed form.
- **Distinguishing features vs Variant 1:** Image-heavy (scan), not
  typeset; handwriting present; card aspect ratio.
- **Filename keywords:** `I-94-card | paper-I94 | legacy-I94 |
  tear-off`
- **Classifier signals:**
  1. Card-shape scan with perforation marks.
  2. Handwriting detection in admit-until / port-of-entry zones.
  3. Stapled-corner artifact in scan.
- **Cross-jurisdictional notes:** US-only.

---

## bank_statement
**Generic variant count:** 4

### Variant 1 — Personal current/checking/savings statement
- **What it is:** The default consumer-account periodic statement for
  an individual or joint account holder. Used to corroborate
  source-of-funds (sale proceeds sitting in personal account, salary
  accumulation, gift receipt).
- **When it appears in an E-2 file:** Tab E.1 (source-origin), Tab E.2
  (transfer leg if outbound from a personal account).
- **Shared features:**
  - Three-zone layout: bank header (~12-15%) with branch + account-
    holder block; transaction body table (60-70%); footer/balance-
    summary block (15-20%).
  - Mandatory fields: account holder, account number (often masked),
    statement period, opening balance, closing balance, transaction
    list (date, description, debit, credit, running balance).
  - Typical 1-6 pages per period; multi-month archives 5-30 pages.
  - Language: issuing country's official language for non-US banks;
    English for US banks; certified translation typically separate.
  - Identifying indicia: bank logo, IBAN/SWIFT or domestic routing,
    branch address, statement-issued date, occasional embossed seal
    or wet-ink stamp on Tab E source-of-funds use.
- **Distinguishing features:** Single account holder (1-2 names);
  consumer-account fee patterns (ATM, retail debit-card, recurring
  household bills); no business-account headers like "Operating
  Account" or "DBA"; balances often denominated in domestic
  currency.
- **Filename keywords:** `personal | current | checking | savings |
  individual | hesap-ozeti | extrait | extracto`
- **Classifier signals:**
  1. Account-holder block with one or two natural-person names.
  2. Header zone bank-logo geometry + branch-address block.
  3. Transaction descriptions skewing consumer (POS, ATM, payroll
     credit, utility direct debit).
  4. Balance summary with opening/closing in single currency.
- **Cross-jurisdictional notes:** Header position, IBAN/routing layout,
  and required disclosures vary; transaction-table topology is nearly
  universal.

### Variant 2 — Business operating / commercial statement
- **What it is:** The periodic statement for a company's primary
  operating account (LLC, Inc., AŞ, Ltd. Şti., GmbH, S.A.). Used to
  corroborate Tab G real-and-operating + at-risk deployment.
- **When it appears in an E-2 file:** Tab E.2/E.3 (incoming
  capitalization wires), Tab G (12-month commercial activity).
- **Shared features:**
  - Same three-zone layout as personal but header carries a legal-
    entity name (with corporate suffix) instead of an individual.
  - Additional indicia: DBA line, EIN/tax-ID block (US), commercial-
    deposit categorizations (ACH credit, wire-in, merchant deposit),
    line-of-credit subsection.
  - Typical 2-12 pages per period.
- **Distinguishing features:** Account-holder is an entity (corporate
  suffix detection); transaction descriptors include vendor names,
  payroll provider names (Gusto, ADP, Paychex), merchant-services
  deposits, commercial-loan line items; fee schedule typically has
  "Business Maintenance Fee" or analog.
- **Filename keywords:** `business | operating | commercial | LLC |
  Inc | corp | sirket | sirket-hesap`
- **Classifier signals:**
  1. Account-holder block contains a legal-entity suffix
     (LLC / Inc. / Corp / AŞ / Ltd. / GmbH / SARL).
  2. Transaction descriptors include payroll-provider strings or
     merchant-services deposit IDs.
  3. EIN-shaped number (US) or tax-ID line (foreign) in header.
  4. Higher absolute transaction volume / dollar magnitude.
- **Cross-jurisdictional notes:** Same topology as Variant 1 but the
  account-holder line and descriptor lexicon shift; the structural
  signature is the entity-suffix and merchant-vendor descriptor mix.

### Variant 3 — Multi-currency / FX-account statement
- **What it is:** A statement covering an account that holds balances
  in two or more currencies, often with a per-currency sub-ledger and
  an FX-conversion settlement section. Common in Tab E.1/E.2 when
  funds originated in one currency and converted to USD.
- **When it appears in an E-2 file:** Tab E.2 (currency-conversion
  receipt-adjacent statements).
- **Shared features:**
  - Header carries the account holder + a currency-list table (e.g.,
    "TRY · USD · EUR" or "USD · CAD").
  - Body is *segmented per currency*: each currency gets its own
    opening, transactions, closing block; FX conversion entries
    cross-reference between blocks.
  - Footer summary table: balance per currency + USD-equivalent.
- **Distinguishing features vs Variant 1/2:** Multiple currency
  symbols on a single statement; explicit FX-rate column or
  "Converted At" notation; segmented sub-ledgers.
- **Filename keywords:** `FX | multi-currency | foreign-currency | USD-
  TRY | EUR-USD | doviz-hesap`
- **Classifier signals:**
  1. Multiple currency symbols co-occurring in the body table.
  2. "FX rate" / "Conversion rate" column or footnote.
  3. Repeated three-letter ISO currency codes (USD/EUR/TRY/GBP/CAD).
  4. Segmented per-currency opening/closing balances.
- **Cross-jurisdictional notes:** Layout patterns are similar across
  multinational banks; signal is the *currency-multiplicity*, not the
  bank.

### Variant 4 — Brokerage / investment account statement
- **What it is:** A statement from a securities-brokerage account
  showing positions (cash, equities, fixed income, mutual funds) and
  activity. Appears when the source of funds is liquidation of an
  investment portfolio.
- **When it appears in an E-2 file:** Tab E.1 (source-origin —
  liquidation proceeds).
- **Shared features:**
  - Header: account holder + account number + period.
  - "Portfolio summary" table at top: asset class, market value,
    cost basis, unrealized gain/loss.
  - "Activity" section: trades, dividends, interest, withdrawals,
    deposits.
  - Holdings table: ticker, units, market price, market value.
  - Often 5-25 pages.
- **Distinguishing features:** Position table with tickers / CUSIPs /
  ISINs; market-value vs cost-basis columns; trade/dividend descriptor
  set distinct from retail-banking descriptors; performance-summary
  graph or "asset allocation" pie chart not present in Variants 1-3.
- **Filename keywords:** `brokerage | investment | portfolio | IRA |
  401k | securities | yatirim-hesap`
- **Classifier signals:**
  1. Ticker/CUSIP/ISIN column in a holdings table.
  2. "Portfolio Summary" or "Asset Allocation" header.
  3. Market value + cost basis + unrealized gain/loss column triple.
  4. Trade-confirmation language ("Bought", "Sold", "Reinvested").
- **Cross-jurisdictional notes:** US/EU brokerage layouts are
  similar; the structural signal is the holdings-table topology.

---

## tax_doc
**Generic variant count:** 4

### Variant 1 — Personal income tax return (1040-class, foreign analog)
- **What it is:** An individual's annual income-tax return — US Form
  1040 with schedules, or the foreign-jurisdiction analog (Turkey's
  Yıllık Gelir Vergisi Beyannamesi, UK SA100, Canadian T1).
- **When it appears in an E-2 file:** Tab E.1 (corroborating salary-or-
  savings source), Tab H (Beneficiary's individual income history).
- **Shared features:**
  - Multi-page government form with fixed field grid; pre-printed line
    numbers; taxpayer identification block.
  - Mandatory fields: filer name(s), tax year, filing status, taxable
    income, total tax, refund or balance due.
  - Typical 2-15 pages with schedules.
  - Identifying indicia: revenue-authority logo, OMB number (US) or
    jurisdiction-specific form code, taxpayer signature line.
- **Distinguishing features:** Filer is one or two individuals; W-2 /
  1099 / wage attachments; Schedule A/B/C/D/E (US) or analog; no
  corporate balance sheet.
- **Filename keywords:** `1040 | personal-tax | individual-tax |
  schedule-c | beyanname | gelir-vergisi`
- **Classifier signals:**
  1. Form number printed in header ("Form 1040").
  2. Filing-status checkbox row.
  3. SSN or foreign-equivalent personal-tax-ID format.
  4. Wage line item ("Wages, salaries, tips").
- **Cross-jurisdictional notes:** Form geometry varies but the
  individual-vs-entity distinction is universal — single-name filer
  block + wage-line presence.

### Variant 2 — Corporate income tax return (1120 / 1120S / foreign
  analog)
- **What it is:** A C-corp or S-corp's annual return — US Form 1120 /
  1120S, foreign analog (Kurumlar Vergisi Beyannamesi, UK CT600).
- **When it appears in an E-2 file:** Tab G (renewal — actual operating
  history), drives the tax-balance-sheet drift gate when paired with
  the I-129 E Supplement.
- **Shared features:**
  - Multi-page government form; entity name + EIN block; corporate-
    income line items; balance-sheet schedule (Schedule L, US);
    reconciliation of book-to-tax (Schedule M, US).
  - Typical 5-30 pages with schedules.
  - Identifying indicia: revenue-authority logo, OMB number, officer
    signature with title.
- **Distinguishing features:** Filer is an entity (corporate suffix);
  Schedule L balance-sheet table; "Total assets" / "Total
  liabilities" line items.
- **Filename keywords:** `1120 | 1120S | corporate-tax | corp-return |
  kurumlar-vergisi | CT600`
- **Classifier signals:**
  1. Form number "1120" or "1120S" (or analog) in header.
  2. Schedule-L balance-sheet table presence.
  3. EIN format in entity block.
  4. Officer-signature line with title.
- **Cross-jurisdictional notes:** Entity-tax forms across treaty
  countries share Schedule-L-style asset/liability schedules.

### Variant 3 — Pass-through entity return (1065 / partnership / LLC)
- **What it is:** A partnership / multi-member LLC return reporting on
  Form 1065 and issuing K-1s to members.
- **When it appears in an E-2 file:** Tab D (ownership-corporate
  history corroboration), Tab G (renewal operating history).
- **Shared features:**
  - Form 1065 main return + per-partner K-1 attachments; partner
    capital reconciliation; balance-sheet schedule.
- **Distinguishing features vs Variant 2:** K-1 schedules per partner;
  partner ownership-percent column; no entity-level income tax in
  most cases (pass-through indication).
- **Filename keywords:** `1065 | K-1 | K1 | partnership | LLC-return`
- **Classifier signals:**
  1. Form number "1065" in header.
  2. K-1 schedule format ("Schedule K-1 (Form 1065)").
  3. Partner ownership-percent column.
  4. "Pass-through" or "partner's share" language.
- **Cross-jurisdictional notes:** US pattern dominant; foreign
  pass-through analogs exist but rarer in E-2 filings.

### Variant 4 — Wage / withholding statement (W-2 / 1099 / foreign
  payslip analog)
- **What it is:** A small, formatted wage-summary form: US W-2 (3-up or
  4-up boxes), 1099-NEC/MISC, or foreign analog (Bordro/Maaş Bordrosu
  annual summary).
- **When it appears in an E-2 file:** Tab E.1 (salary-source
  corroboration), Tab H (Beneficiary income history).
- **Shared features:**
  - Single page, multi-box layout (4-6 mini-form copies arranged in a
    2x2 or 3x2 grid).
  - Mandatory fields: employer name + EIN, employee name + SSN, year,
    Box 1 wages, federal/state withholding.
  - Identifying indicia: form code "W-2", "1099-NEC" in header.
- **Distinguishing features vs Variants 1-3:** Tiny grid-based layout
  (boxes are pre-printed); single-year scope; no schedules; multiple
  identical copies on one page.
- **Filename keywords:** `W-2 | W2 | 1099 | wage-statement | bordro`
- **Classifier signals:**
  1. Multi-up identical box layout.
  2. Form code "W-2" / "1099" header.
  3. Numbered box pattern (Box 1, Box 2, ..., Box 14).
  4. Employer/employee dual identifier block.
- **Cross-jurisdictional notes:** US-specific; foreign payslip-summary
  forms are looser in layout but follow the same wage/withholding
  field set.

---

## money_movement
**Generic variant count:** 4

### Variant 1 — International wire confirmation (with FX leg)
- **What it is:** A SWIFT/SEPA-mediated international wire receipt
  showing origin currency, FX rate, and USD-leg detail.
- **When it appears in an E-2 file:** Tab E.2 (transfer leg of source-
  of-funds chain).
- **Shared features:**
  - Single page (occasionally 2); receipt-style layout with bank
    header, transaction-reference block, sender / beneficiary blocks,
    amount fields in two currencies, FX rate, value date.
  - Mandatory labels: SWIFT/BIC code, IBAN/account number for both
    sides, reference / message-to-beneficiary, intermediary bank
    (if any).
  - Identifying indicia: bank stamp or wet-ink signature, SWIFT MT103
    field codes (:50K:, :59:, :70:, :71A:, :32A:, :33B:).
- **Distinguishing features:** Two currency amounts + an FX rate; SWIFT
  field codes; cross-border bank pair.
- **Filename keywords:** `wire | SWIFT | international | havale | EFT |
  USD-transfer | currency-conversion`
- **Classifier signals:**
  1. SWIFT field-code regex (:50K: / :59: / :32A:).
  2. FX-rate field with two currency amounts.
  3. BIC / SWIFT-code 8-or-11-char pattern in header / sender /
     beneficiary block.
  4. Intermediary-bank line.
- **Cross-jurisdictional notes:** SWIFT MT103 fields are universal;
  surrounding template differs per bank.

### Variant 2 — Domestic USD wire / ACH confirmation
- **What it is:** A US-domestic wire (Fedwire) or ACH credit
  confirmation, single currency, no FX.
- **When it appears in an E-2 file:** Tab E.2/E.3 (capitalization to
  Petitioner from US-side personal account).
- **Shared features:**
  - Bank header + reference-number block + sender/beneficiary
    accounts + single USD amount + value date.
  - Identifying indicia: ABA routing number, Fedwire reference,
    "ACH" or "WIRE" identifier.
- **Distinguishing features vs Variant 1:** Single currency, no SWIFT
  field codes, ABA routing instead of BIC.
- **Filename keywords:** `wire-USD | ACH | fedwire | domestic-transfer`
- **Classifier signals:**
  1. ABA 9-digit routing number presence.
  2. "Fedwire reference" / "ACH" header.
  3. Single USD amount (no FX rate field).
  4. Same-country sender/beneficiary banks.
- **Cross-jurisdictional notes:** US-only.

### Variant 3 — Check image / counter-deposit slip
- **What it is:** A scanned check (front + endorsement back) or a
  branch-counter deposit slip with teller-stamp.
- **When it appears in an E-2 file:** Tab E.2/E.3 (small-amount
  transfers, Petitioner-internal funding events).
- **Shared features:**
  - Image-heavy: handwritten payee / amount fields; signature; routing
    + account MICR line at bottom; deposit-slip stamp pattern.
- **Distinguishing features:** Handwriting present; MICR line at
  bottom; no SWIFT codes; image-only or low-text-density scan.
- **Filename keywords:** `check | cheque | deposit-slip | dekont`
- **Classifier signals:**
  1. MICR-font line at page bottom.
  2. Handwritten amount + payee detection.
  3. Endorsement-stamp pattern on reverse.
  4. Low text density relative to image area.
- **Cross-jurisdictional notes:** Check geometry varies; deposit-slip
  pattern is similar across banks.

### Variant 4 — Inter-account transfer / book entry
- **What it is:** A same-bank, same-holder (or holder-to-related-party)
  internal transfer confirmation. Often used to bridge personal
  account → business account funding events.
- **When it appears in an E-2 file:** Tab E.3 (at-risk deployment from
  personal to Petitioner's account at the same bank).
- **Shared features:**
  - Bank header + transfer-reference + from-account / to-account (both
    masked) + amount + timestamp.
- **Distinguishing features:** Same bank both sides; no SWIFT/ABA;
  shorter receipt; "Book transfer" / "Internal transfer" label.
- **Filename keywords:** `transfer | book-transfer | internal-transfer
  | virman`
- **Classifier signals:**
  1. Same bank logo top + same-bank account format on both sides.
  2. "Internal" / "Book" / "Virman" / "Same-bank" label.
  3. Absence of routing/SWIFT codes.
  4. Short receipt length (< 1 page).
- **Cross-jurisdictional notes:** Universal pattern.

---

## source_of_funds
**Generic variant count:** 6

### Variant 1 — Property / asset sale deed (deed of sale)
- **What it is:** A notarized contract conveying real property or a
  significant asset, identifying buyer/seller and consideration. The
  Tapu (Turkey) and equivalent registry instruments live here.
- **When it appears in an E-2 file:** Tab E.1 (origin of funds when
  capital came from a property sale).
- **Shared features:**
  - Notarial header with notary name + notary protocol number; parties
    block (seller + buyer with national-ID numbers); asset
    identification block (parcel/registry no., address); consideration
    amount; signature page with wet-ink + notary seal.
  - Typical 2-8 pages.
  - Language: issuing jurisdiction; certified translation usually
    attached.
- **Distinguishing features:** Notary seal + signature; consideration
  amount in body; asset identification block.
- **Filename keywords:** `deed | sale | tapu | satis-sozlesmesi |
  bill-of-sale`
- **Classifier signals:**
  1. Notarial protocol number + notary seal pattern.
  2. "Seller" / "Buyer" / "Satıcı" / "Alıcı" labeled blocks.
  3. Consideration / sale-price line.
  4. Asset-identification block with registry number.
- **Cross-jurisdictional notes:** Civil-law jurisdictions notarize at
  the deed level; common-law jurisdictions use bill-of-sale + closing
  statement instead — both fit this variant structurally.

### Variant 2 — Gift letter / declaration
- **What it is:** A donor-signed letter declaring an irrevocable gift
  of funds to a recipient, with amount, date, and "no repayment
  expected" language.
- **When it appears in an E-2 file:** Tab E.1 (origin when capital came
  from a family or third-party gift).
- **Shared features:**
  - One-page letter format; donor identification block; recipient
    block; amount; gift-date; explicit "no repayment expected" /
    "outright gift" language; signature; sometimes notarized /
    apostilled.
- **Distinguishing features vs other source_of_funds variants:** Short
  (1-2 pages); declarative letter format (not a contract); single
  signer (donor); explicit gift-language anchor.
- **Filename keywords:** `gift | gift-letter | hibe | donation-letter`
- **Classifier signals:**
  1. "Gift" / "Hibe" / "Donation" header.
  2. Single-party signature (donor only).
  3. "No repayment" / "outright" language.
  4. Letter-format short page count.
- **Cross-jurisdictional notes:** Form is universal; notarization
  requirement varies.

### Variant 3 — Inheritance / probate document
- **What it is:** A court-issued or probate-registry instrument
  conveying assets to heirs (US Letters Testamentary, Turkish Veraset
  İlamı, UK Grant of Probate).
- **When it appears in an E-2 file:** Tab E.1 (origin when capital
  flowed through inheritance).
- **Shared features:**
  - Court / registry letterhead; case number; decedent block; heirs
    block + share percentages; asset description (sometimes); judge /
    registrar signature + seal.
  - Typical 2-10 pages.
- **Distinguishing features vs Variant 1/2:** Court issuance (not
  notary, not letter); decedent + heirs block; share-percent table.
- **Filename keywords:** `inheritance | probate | veraset | letters-
  testamentary | grant-of-probate`
- **Classifier signals:**
  1. Court / registry letterhead + case number.
  2. Decedent ("deceased" / "müteveffa") block.
  3. Heirs/share-percent table.
  4. Judge or registrar signature line.
- **Cross-jurisdictional notes:** Civil-law uses a single inheritance
  certificate; common-law uses letters testamentary + will copy —
  structurally distinguishable from a deed by the decedent block.

### Variant 4 — Loan agreement / promissory note
- **What it is:** A bilateral contract between lender and borrower
  setting amount, interest, repayment schedule.
- **When it appears in an E-2 file:** Tab E.1 (origin when funds are
  borrowed) — flagged for "at-risk" scrutiny if collateralized by the
  Petitioner's enterprise.
- **Shared features:**
  - Contract-style multi-page document; lender + borrower blocks;
    principal; interest; repayment schedule; collateral block;
    signature page.
- **Distinguishing features vs other source_of_funds variants:**
  Bilateral signers; repayment schedule presence; interest rate;
  often collateral schedule attached.
- **Filename keywords:** `loan | promissory | kredi-sozlesmesi | loan-
  agreement | mortgage`
- **Classifier signals:**
  1. "Loan" / "Promissory" / "Kredi" header.
  2. Interest rate / repayment schedule table.
  3. Lender + borrower bilateral signature blocks.
  4. Collateral schedule.
- **Cross-jurisdictional notes:** Universal contract pattern.

### Variant 5 — Sale-of-business / share-purchase agreement (prior business)
- **What it is:** Agreement under which the Beneficiary previously sold
  a business, the proceeds of which are now the E-2 capital.
- **When it appears in an E-2 file:** Tab E.1 (origin when the source
  is a prior-business divestiture).
- **Shared features:**
  - Multi-party share / asset purchase agreement; consideration
    schedule; representations & warranties; closing conditions; signed
    + dated.
  - Typical 15-60 pages.
- **Distinguishing features vs Variant 1:** Purchase target is shares
  / business, not real property; reps & warranties block; closing
  conditions; longer page count.
- **Filename keywords:** `share-purchase | SPA | sale-of-business |
  exit-agreement | hisse-devir`
- **Classifier signals:**
  1. "Share Purchase Agreement" / "SPA" / "Hisse Devir" header.
  2. Reps & warranties section heading.
  3. Closing-conditions schedule.
  4. Multi-party signature page (3+ signatories common).
- **Cross-jurisdictional notes:** Universal commercial pattern.

### Variant 6 — Salary / savings declaration with corroborating ledger
- **What it is:** A declaration (often Beneficiary-signed) that capital
  comes from accumulated salary plus the bank-statement run that
  corroborates the build-up. The declaration is standalone here; the
  ledger fits under bank_statement.
- **When it appears in an E-2 file:** Tab E.1 (origin when no single
  inflection event funded the capital).
- **Shared features:**
  - Short declaration (1-2 pages); declarant block; period over which
    savings accumulated; total amount asserted; signature.
- **Distinguishing features:** No counterparty (it's a declaration);
  weakest APS within source_of_funds — flagged in the firm's APS
  table.
- **Filename keywords:** `salary | savings | declaration | birikim |
  affidavit-of-funds`
- **Classifier signals:**
  1. "Declaration" / "Affidavit" / "Beyan" header.
  2. Single declarant signature.
  3. Aggregated amount + accumulation period (no per-tx ledger).
  4. No counterparty block.
- **Cross-jurisdictional notes:** Universal.

> Note: a 7th category, `crypto`, is enumerated in the schema but
> appears rarely; structurally it presents as either an exchange
> account statement (Variant 4-of-bank_statement-flavored) or a
> wallet-export PDF — handled at the bot's content-classifier layer
> rather than as a dedicated structural variant here.

---

## formation_doc
**Generic variant count:** 5

### Variant 1 — Articles of Organization / Incorporation
- **What it is:** The state-filed charter establishing an LLC or
  corporation. The single mandatory exhibit at Tab D.1.
- **When it appears in an E-2 file:** Tab D (ownership-corporate
  history), Tab G (real-and-operating).
- **Shared features:**
  - State-of-formation header + filing-stamp area; entity name; entity
    type; registered agent block; effective date; organizer/
    incorporator signature.
  - Typical 1-4 pages.
  - Identifying indicia: state seal or filing stamp ("FILED" with
    timestamp), document/charter number.
- **Distinguishing features:** Government-filed (not internal);
  registered-agent block; "FILED" stamp.
- **Filename keywords:** `articles | incorporation | organization |
  charter | certificate-of-formation`
- **Classifier signals:**
  1. "Articles of Organization" / "Articles of Incorporation" /
     "Certificate of Formation" header.
  2. State-of-formation seal or filing stamp.
  3. Registered-agent block.
  4. Document/charter number.
- **Cross-jurisdictional notes:** US-state-specific layouts but the
  field set is constant; foreign-corporate equivalents (Esas
  Sözleşme, Articles of Association) live here too.

### Variant 2 — EIN / tax-ID assignment letter (CP-575 / 147-C)
- **What it is:** The IRS letter assigning an Employer Identification
  Number to the entity, or its replacement (147-C verification).
- **When it appears in an E-2 file:** Tab D (corroborating entity
  identity for federal tax purposes).
- **Shared features:**
  - Single-page IRS letter; left-margin EIN block; entity name +
    address; brief paragraph + filing-requirements list.
  - Identifying indicia: IRS logo, "Department of the Treasury",
    "Notice CP 575" or "147-C", signature ("Director, Accounts
    Management"), EIN format XX-XXXXXXX.
- **Distinguishing features:** IRS letterhead (not state); single
  page; short body; EIN regex.
- **Filename keywords:** `EIN | CP-575 | 147-C | tax-ID | IRS-letter`
- **Classifier signals:**
  1. "Department of the Treasury — Internal Revenue Service" header.
  2. EIN format XX-XXXXXXX in left-margin block.
  3. Notice code "CP 575" / "147-C".
  4. Single-page letter format.
- **Cross-jurisdictional notes:** US-specific; foreign tax-ID
  certificates take a comparable single-page form.

### Variant 3 — Operating agreement / bylaws
- **What it is:** The internal governance document for an LLC
  (operating agreement) or corporation (bylaws). Sets ownership,
  capital contributions, voting, distributions.
- **When it appears in an E-2 file:** Tab D (ownership detail), Tab E.3
  (at-risk capital contribution if recited in the agreement).
- **Shared features:**
  - Multi-page contract format; recitals; definitions; member/
    shareholder schedule (Exhibit A); capital contributions schedule;
    governance articles; signature page.
  - Typical 20-80 pages with exhibits.
- **Distinguishing features:** Internal document (no government seal);
  member/shareholder schedule with ownership %; capital-contributions
  schedule; long page count.
- **Filename keywords:** `operating-agreement | OA | bylaws |
  shareholders-agreement | esas-sozlesme`
- **Classifier signals:**
  1. "Operating Agreement" / "Bylaws" / "Shareholders' Agreement"
     header.
  2. Member/shareholder schedule with ownership-% column.
  3. Capital-contributions schedule (Exhibit B common).
  4. Long page count + section-numbered articles.
- **Cross-jurisdictional notes:** Internal-governance docs exist in
  every jurisdiction; the schedule pattern is universal.

### Variant 4 — Amendment / restatement / certificate of conversion
- **What it is:** A subsequent filing modifying the original Articles
  or Operating Agreement (name change, address change, conversion of
  entity type, member admission).
- **When it appears in an E-2 file:** Tab D (when the entity has
  evolved between formation and filing).
- **Shared features:**
  - State-filing layout similar to Variant 1 but identifies the
    *change*; references original filing date / charter number.
- **Distinguishing features vs Variant 1:** "Amendment" / "Restated"
  / "Conversion" in title; cross-references prior filing; shorter.
- **Filename keywords:** `amendment | restated | restatement |
  conversion | articles-amendment`
- **Classifier signals:**
  1. "Amendment" / "Restated" / "Conversion" in title.
  2. Cross-reference to original filing date / charter number.
  3. State filing stamp on the amendment specifically.
- **Cross-jurisdictional notes:** Same as Variant 1.

### Variant 5 — Certificate of Good Standing / Existence
- **What it is:** A current state-issued certificate that the entity is
  validly existing and current on franchise / annual reports.
- **When it appears in an E-2 file:** Tab D (currency check at filing
  date — typically dated within 90 days of E-2 submission).
- **Shared features:**
  - Single-page state-issued certificate; entity name; date of
    formation; "in good standing as of [date]"; state seal +
    Secretary's signature.
- **Distinguishing features:** Single page; "in good standing"
  language; recent issue date; seal + signature.
- **Filename keywords:** `good-standing | existence | certificate |
  status-certificate`
- **Classifier signals:**
  1. "Good Standing" / "Existence" / "Status" in header.
  2. Single page.
  3. State seal + Secretary's name signature.
  4. Recent ISO date.
- **Cross-jurisdictional notes:** US-state pattern; civil-law
  equivalents (Faaliyet Belgesi) are similar single-page certificates.

---

## ownership_evidence
**Generic variant count:** 3

### Variant 1 — Cap table / member schedule
- **What it is:** A spreadsheet-style summary listing every owner,
  share/unit count, percent, and class. Often issued as an exhibit to
  the operating agreement or as a standalone snapshot.
- **When it appears in an E-2 file:** Tab D (ownership % proof — drives
  the treaty-national 50% gate).
- **Shared features:**
  - Tabular layout: Owner | Shares/Units | % | Class | Date acquired.
  - 1-3 pages.
  - Signed or initialed by an officer.
- **Distinguishing features:** Tabular; aggregate-summary; references
  multiple owners.
- **Filename keywords:** `cap-table | ownership | members-list |
  shareholders | hissedar-listesi`
- **Classifier signals:**
  1. Owner-name + percent-ownership tabular structure.
  2. Sum of percents = 100 (or near it).
  3. "Cap Table" / "Members" / "Shareholders" header.
  4. Class column (common / preferred / Class A / Class B).
- **Cross-jurisdictional notes:** Universal tabular pattern.

### Variant 2 — Share / membership certificate (single-holder)
- **What it is:** A formal certificate naming one owner, the number of
  shares/units they hold, and a certificate number. Often artifacts
  with an ornamental border.
- **When it appears in an E-2 file:** Tab D (single-owner proof).
- **Shared features:**
  - Single page; ornamental border; entity name; "This certifies
    that [holder] is the owner of [N] shares/units"; certificate
    number; date; officer signatures (President + Secretary commonly).
- **Distinguishing features vs Variant 1:** Single-holder focus;
  ornamental layout; certificate number; not tabular.
- **Filename keywords:** `share-certificate | stock-certificate |
  membership-certificate | hisse-senedi`
- **Classifier signals:**
  1. Ornamental border / engraved style.
  2. "This certifies that..." pattern.
  3. Certificate number prominent.
  4. Two officer-signature blocks.
- **Cross-jurisdictional notes:** Common-law uses physical
  certificates; civil-law uses ledger entries — physical certificates
  are the dominant Variant 2 form.

### Variant 3 — Membership-interest transfer / assignment instrument
- **What it is:** The bilateral instrument transferring shares/units
  from a prior owner to the current one. The Akalan firm's Tab D.5 /
  Tab C.5 / Tab E.3.a is canonically this document.
- **When it appears in an E-2 file:** Tab D, Tab C (treaty proof for
  current ownership), Tab E.3 (at-risk anchor).
- **Shared features:**
  - Bilateral contract; assignor + assignee blocks; interest
    description; consideration; effective date; signatures.
  - 3-12 pages.
- **Distinguishing features vs Variants 1/2:** Bilateral parties;
  consideration recital; effective-date clause; transfer-of-interest
  language.
- **Filename keywords:** `transfer | assignment | membership-interest-
  transfer | hisse-devir | bill-of-sale`
- **Classifier signals:**
  1. "Transfer" / "Assignment" / "Devir" header.
  2. Assignor + assignee bilateral signature blocks.
  3. Consideration line.
  4. Effective-date clause.
- **Cross-jurisdictional notes:** Universal bilateral-contract pattern.

---

## lease_or_property
**Generic variant count:** 3

### Variant 1 — Commercial lease (premises)
- **What it is:** A landlord-tenant lease for the Petitioner's
  business premises. Tab G's Commercial Lease exhibit.
- **When it appears in an E-2 file:** Tab G (real-and-operating).
- **Shared features:**
  - Multi-page contract; premises description (address + sq ft); term
    + renewal; base rent + escalations; deposit; CAM/NNN charges;
    permitted use; landlord + tenant signatures + dates.
  - Typical 20-80 pages with riders + exhibits.
- **Distinguishing features:** Tenant is the Petitioner-entity;
  permitted-use clause references commercial activity; CAM/NNN
  schedules; long.
- **Filename keywords:** `commercial-lease | premises | retail-lease |
  office-lease | kira-sozlesmesi`
- **Classifier signals:**
  1. Tenant block contains an entity legal name.
  2. "Commercial" / "Retail" / "Office" / "Premises" in header or
     defined-term list.
  3. CAM / NNN / triple-net schedule.
  4. Square-footage line.
- **Cross-jurisdictional notes:** Universal commercial-lease pattern.

### Variant 2 — Residential lease (Beneficiary or rental-income
  source)
- **What it is:** A residential tenancy agreement. Two distinct
  sub-uses in E-2: (a) Beneficiary's housing (lifestyle proof) or (b)
  the Beneficiary as landlord, where rental income is the
  source-of-funds.
- **When it appears in an E-2 file:** Tab E.1 (rental-income source)
  or supplementary background.
- **Shared features:**
  - Shorter contract; landlord + tenant; premises (address + units);
    monthly rent; security deposit; term; signatures.
  - 5-20 pages.
- **Distinguishing features vs Variant 1:** Tenant is an individual;
  no CAM/NNN; "Residential" / "Apartment" / "Single-Family"
  vocabulary; shorter.
- **Filename keywords:** `residential-lease | rental | apartment-lease
  | tenancy | konut-kirasi`
- **Classifier signals:**
  1. Tenant is a natural person.
  2. "Residential" / "Apartment" / "Konut" in header.
  3. Absence of CAM/NNN schedules.
  4. Short page count relative to commercial.
- **Cross-jurisdictional notes:** Universal residential-tenancy
  pattern.

### Variant 3 — Real-estate purchase / closing instrument (premises
  acquisition)
- **What it is:** Purchase agreement + closing statement when the
  Petitioner buys (rather than leases) its premises. The bot routes
  this to a rich `realEstatePurchase` extractor.
- **When it appears in an E-2 file:** Tab G (when premises are owned),
  Tab E.3 (when purchase is the at-risk deployment).
- **Shared features:**
  - Purchase agreement (multi-page) + closing statement (HUD-1 / ALTA
    settlement statement single page, or jurisdictional analog);
    buyer + seller; consideration; closing date.
- **Distinguishing features vs Variant 1/2:** Purchase (not lease);
  closing statement attached; buyer is the Petitioner; deed
  cross-references.
- **Filename keywords:** `purchase | closing | HUD-1 | ALTA |
  settlement-statement | satis`
- **Classifier signals:**
  1. "Purchase Agreement" / "Closing Statement" / "ALTA" / "HUD-1"
     header.
  2. Buyer = Petitioner-entity name.
  3. Closing-statement line-item table.
  4. Cross-reference to a deed instrument.
- **Cross-jurisdictional notes:** Universal — closing/settlement form
  varies by jurisdiction.

---

## business_plan
**Generic variant count:** 3

### Variant 1 — Full-narrative 5-year plan (E-2 standard)
- **What it is:** The dominant variant for E-2 — a 25-60 page narrative
  plan covering executive summary, market, operations, marketing,
  organization, and 5-year financials.
- **When it appears in an E-2 file:** Tab G.8 (more-than-marginal
  projections), Tab H.6 (develop-and-direct corroboration).
- **Shared features:**
  - Cover page + table of contents + 8-12 narrative sections + 5-year
    financial appendix.
  - Mandatory sections: Executive Summary, Market Analysis,
    Operations, Marketing, Management/Organization, Financial
    Projections, NAICS classification, Hiring Plan.
  - Typical 25-60 pages with appendices.
  - English-only (filed copy).
- **Distinguishing features:** TOC present; 5-year horizon explicit;
  hire-plan table; NAICS code cited.
- **Filename keywords:** `business-plan | 5-year-plan | BP | E-2-plan |
  iş-plani`
- **Classifier signals:**
  1. Table of contents on page 2-3.
  2. "Executive Summary" + "Financial Projections" section heads.
  3. 5-year financial-projection grid (Year 1-5 columns).
  4. NAICS code line.
- **Cross-jurisdictional notes:** US-immigration-tailored; structure
  is invariant.

### Variant 2 — Short / pitch-deck plan (renewal-style)
- **What it is:** A condensed plan (10-25 pages) used for renewals or
  when the operating history substitutes for projections. May be a
  slide-deck export.
- **When it appears in an E-2 file:** Tab G.8 (renewal — projections
  optional).
- **Shared features:**
  - Slide-style layout (one concept per page); minimal narrative;
    heavy use of graphics + bullet lists.
  - 10-25 pages.
- **Distinguishing features vs Variant 1:** Slide aspect ratio (often
  16:9 landscape); minimal text density per page; no full TOC; bullet-
  heavy.
- **Filename keywords:** `pitch | deck | summary-plan | overview`
- **Classifier signals:**
  1. Landscape page orientation.
  2. Low text density per page.
  3. Slide-numbering footer (1/25, 2/25).
  4. Heavy graphics/charts ratio.
- **Cross-jurisdictional notes:** Format-driven, not jurisdiction-
  driven.

### Variant 3 — Financial-model spreadsheet export
- **What it is:** A spreadsheet PDF export — multi-tab financial model
  with revenue model, expense model, headcount, cash-flow forecast.
  Sometimes filed as an appendix to Variant 1; sometimes standalone.
- **When it appears in an E-2 file:** Tab G.8 appendix.
- **Shared features:**
  - Tabular pages; column headers Year 1-5 (or monthly); line items
    revenue / COGS / OpEx / EBITDA / Net Income / Cash.
- **Distinguishing features:** Pure tabular; no narrative; spreadsheet-
  export aesthetic.
- **Filename keywords:** `financial-model | projections | pro-forma |
  forecast | model`
- **Classifier signals:**
  1. Multi-column year/month grid.
  2. Line-item lexicon (Revenue / COGS / OpEx / EBITDA).
  3. No narrative paragraphs.
  4. Spreadsheet gridlines.
- **Cross-jurisdictional notes:** Universal financial-model pattern.

---

## invoice_or_receipt
**Generic variant count:** 4

### Variant 1 — Vendor invoice (B2B, services or supplies)
- **What it is:** A vendor's invoice to the Petitioner for goods or
  services. Tab G.5 vendor-invoices and Tab F substantiality build
  primarily from this variant.
- **When it appears in an E-2 file:** Tab G.5 (commercial activity),
  Tab F (substantiality reconciliation).
- **Shared features:**
  - Single-page invoice format; vendor letterhead; "Invoice"
    keyword; invoice number; bill-to (Petitioner) block; line items
    (description, qty, unit price, line total); subtotal + tax +
    total; payment terms.
- **Distinguishing features:** "Invoice" / "Fatura" header; bill-to
  is the Petitioner; line-item table.
- **Filename keywords:** `invoice | fatura | bill | vendor-invoice`
- **Classifier signals:**
  1. "Invoice" / "Fatura" header.
  2. Invoice-number field.
  3. Line-item table with qty + unit price.
  4. "Bill To" + Petitioner entity name.
- **Cross-jurisdictional notes:** Universal commercial pattern.

### Variant 2 — Retail / point-of-sale receipt
- **What it is:** A short receipt for a retail purchase (equipment,
  supplies, build-out materials). Often photographed rather than
  scanned.
- **When it appears in an E-2 file:** Tab F substantiality items;
  Tab G evidence of operations.
- **Shared features:**
  - Narrow strip format; merchant header; date + time; line items
    + price; subtotal + tax + total; payment-method line; cashier
    ID.
- **Distinguishing features vs Variant 1:** Narrow aspect ratio (thermal
  receipt); short; no bill-to block; merchant-not-vendor lexicon.
- **Filename keywords:** `receipt | POS | retail-receipt | makbuz`
- **Classifier signals:**
  1. Narrow page or image aspect.
  2. Merchant header (no "Bill To").
  3. Cashier / register ID line.
  4. Payment-method line (Cash / Card / Last4).
- **Cross-jurisdictional notes:** Universal retail pattern.

### Variant 3 — Utility / recurring service bill
- **What it is:** A periodic bill for utilities, telecom, software
  subscriptions, insurance, or similar recurring services.
- **When it appears in an E-2 file:** Tab G (operating-activity
  corroboration).
- **Shared features:**
  - Single-page bill; service-provider letterhead; account / customer
    number; service period; usage block (kWh / GB / minutes); current
    charges + past-due; due date; payment-stub at bottom.
- **Distinguishing features vs Variants 1/2:** Service-period framing;
  usage block; payment-stub tear-off.
- **Filename keywords:** `utility | electric | water | telecom |
  internet | insurance-bill | abonelik`
- **Classifier signals:**
  1. Service-period date range.
  2. Usage table (kWh / GB / minutes / units).
  3. Payment-stub tear-off section.
  4. "Account number" / "Customer number" prominent.
- **Cross-jurisdictional notes:** Universal.

### Variant 4 — Professional-services invoice (legal / accounting /
  consulting)
- **What it is:** Time-and-materials professional invoice with
  itemized hours. Tab F's "Legal Fee Invoice" exhibit is canonical.
- **When it appears in an E-2 file:** Tab E.3 (at-risk via legal /
  consulting fees), Tab F (substantiality items).
- **Shared features:**
  - Same general structure as Variant 1 with the addition of a time-
    entry table: timekeeper / date / description / hours / rate /
    amount.
- **Distinguishing features vs Variant 1:** Time-entry table; rate ×
  hours line items; firm-letterhead aesthetic.
- **Filename keywords:** `legal-fee | retainer | consulting | hourly |
  professional-fee | avukat-fatura`
- **Classifier signals:**
  1. Time-entry table with timekeeper / hours / rate.
  2. Professional-firm letterhead.
  3. "Trust" / "IOLTA" / "Retainer" account language (legal).
  4. Bar-license footer (legal).
- **Cross-jurisdictional notes:** Universal professional-services
  pattern.

---

## business_contract
**Generic variant count:** 5

### Variant 1 — Customer / offtake / supply agreement
- **What it is:** A contract under which a customer commits to buy
  from the Petitioner — anchors marginality and substantiality
  arguments.
- **When it appears in an E-2 file:** Tab G (real-and-operating, more-
  than-marginal); routes to the bot's `customerContract` rich
  extractor.
- **Shared features:**
  - Multi-page bilateral contract; recitals; definitions; product /
    service description; pricing schedule; term + termination;
    delivery / acceptance; warranties; signatures.
  - 15-60 pages.
- **Distinguishing features:** Petitioner is the *seller*; pricing
  schedule references units / volumes; delivery / acceptance clauses.
- **Filename keywords:** `MSA | offtake | supply | customer-contract |
  distribution | satis-sozlesmesi`
- **Classifier signals:**
  1. Petitioner appears as Seller / Supplier / Vendor in party block.
  2. Pricing schedule with units / per-unit price.
  3. Delivery / acceptance clauses.
  4. "Term" / "Renewal" article.
- **Cross-jurisdictional notes:** Universal commercial-contract
  pattern.

### Variant 2 — Vendor / service-provider contract
- **What it is:** Inverse of Variant 1 — Petitioner is the *buyer*
  contracting a vendor or service provider.
- **When it appears in an E-2 file:** Tab F substantiality (vendor
  commitments), Tab G (real-and-operating).
- **Shared features:** Same general structure as Variant 1; pricing
  flows the other way.
- **Distinguishing features:** Petitioner is the *buyer*; vendor
  letterhead.
- **Filename keywords:** `vendor | service-agreement | SOW |
  procurement | tedarikci`
- **Classifier signals:**
  1. Petitioner appears as Customer / Buyer / Client.
  2. Vendor block as the seller / provider.
  3. SOW (Statement of Work) attachment.
- **Cross-jurisdictional notes:** Universal.

### Variant 3 — Distribution / franchise / licensing agreement
- **What it is:** A territory-or-IP-grant contract — distribution
  rights, franchise terms, or trademark/IP license. Distinct from
  Variants 1/2 because rights granted, not goods/services sold.
- **When it appears in an E-2 file:** Tab G (especially franchise
  E-2 cases).
- **Shared features:**
  - Multi-page contract; territory + exclusivity grant;
    royalty / franchise-fee schedule; brand-standards / quality
    obligations; term + renewal + termination.
- **Distinguishing features vs Variant 1/2:** Territory definition;
  royalty schedule; brand-standards; trademark-license clause.
- **Filename keywords:** `franchise | distribution | license | royalty
  | bayilik`
- **Classifier signals:**
  1. "Franchise" / "Distribution" / "License" header.
  2. Territory / exclusivity definition.
  3. Royalty / franchise-fee schedule.
  4. Brand-standards / quality clauses.
- **Cross-jurisdictional notes:** Universal.

### Variant 4 — Incentive / grant / tax-credit instrument
- **What it is:** A government / agency instrument awarding the
  Petitioner an incentive, tax credit, grant, or PTC (production tax
  credit). Routes to the bot's `incentiveDocument` rich extractor.
- **When it appears in an E-2 file:** Tab G (operating-environment
  corroboration when incentives are part of the business model).
- **Shared features:**
  - Government / agency letterhead or contract; recipient block;
    incentive description; amount or rate; performance conditions;
    reporting requirements; signatures.
- **Distinguishing features vs Variants 1-3:** Government / agency
  party (not commercial); "incentive" / "grant" / "tax credit"
  vocabulary.
- **Filename keywords:** `incentive | grant | PTC | IRA | tax-credit |
  tesvik`
- **Classifier signals:**
  1. Government-agency letterhead / signature.
  2. "Incentive" / "Grant" / "Tax Credit" / "PTC" / "IRA" terms.
  3. Performance-condition schedule.
  4. Reporting-requirement schedule.
- **Cross-jurisdictional notes:** Universal — analogous instruments
  across jurisdictions.

### Variant 5 — Partnership / JV / strategic-alliance agreement
- **What it is:** A bilateral or multilateral agreement establishing a
  partnership, joint venture, or strategic alliance — neither pure
  sale nor pure purchase.
- **When it appears in an E-2 file:** Tab G or Tab D (when the JV
  itself is the Petitioner-entity).
- **Shared features:**
  - Multi-party contract; capital-contribution schedule; governance;
    profit-sharing; exit / dissolution.
- **Distinguishing features vs Variants 1/2:** Multi-party (often 3+);
  capital-contribution schedule; profit-sharing clause.
- **Filename keywords:** `partnership | JV | joint-venture | alliance |
  ortakhk`
- **Classifier signals:**
  1. 3+ party signature blocks.
  2. Capital-contribution schedule.
  3. Profit-sharing / distribution clause.
  4. "Joint Venture" / "Partnership" / "Alliance" header.
- **Cross-jurisdictional notes:** Universal.

---

## payroll_doc
**Generic variant count:** 4

### Variant 1 — Payroll register / pay run report
- **What it is:** A periodic payroll-provider report listing each
  employee's gross / net / deductions for the pay period. Provider-
  generated (Gusto, ADP, Paychex, QuickBooks Payroll).
- **When it appears in an E-2 file:** Tab G.7 (real-and-operating —
  US workforce) → drives the marginality `us_workers_employed` flag.
- **Shared features:**
  - Tabular layout: Employee | Gross | Federal WH | State WH | FICA |
    Net | YTD totals.
  - Header: pay-period dates, pay-date, employer name + EIN.
  - Footer: totals row.
  - Typical 1-5 pages.
- **Distinguishing features:** Per-employee row structure; YTD
  columns; period-specific (single pay run).
- **Filename keywords:** `payroll | pay-run | pay-register | bordro |
  Gusto | ADP | Paychex`
- **Classifier signals:**
  1. Per-employee row with gross / net / withholding columns.
  2. Pay-period date range in header.
  3. Payroll-provider footer ("Powered by Gusto").
  4. YTD column.
- **Cross-jurisdictional notes:** US-payroll layout dominant; foreign
  Bordro analogs follow the same per-employee row pattern.

### Variant 2 — W-2 / 1099 annual wage summary (year-end)
- **What it is:** Year-end wage summary forms — overlaps with tax_doc
  Variant 4 in shape; the firm files them under payroll_doc when the
  emphasis is workforce evidence rather than the Beneficiary's
  individual income.
- **When it appears in an E-2 file:** Tab G.7 (renewal — establishing
  W-2 employees existed during prior period).
- **Shared features / Distinguishing features:** See tax_doc Variant 4.
- **Filename keywords:** `W-2 | W2 | 1099 | year-end-payroll |
  annual-wage`
- **Classifier signals:** As tax_doc Variant 4.
- **Cross-jurisdictional notes:** US-specific; foreign year-end
  payslip-summaries are looser but follow the same logic.

### Variant 3 — Form 941 / quarterly tax return (employer side)
- **What it is:** Quarterly federal employer tax return summarizing
  total wages + federal withholding + FICA for the quarter.
- **When it appears in an E-2 file:** Tab G.7 (renewal — quarter-by-
  quarter workforce continuity).
- **Shared features:**
  - 2-3 page IRS form; quarter checkbox; total wages line; total
    federal withholding line; FICA line; signature.
- **Distinguishing features:** Form code "941"; quarter checkbox;
  IRS letterhead.
- **Filename keywords:** `941 | quarterly | employer-tax | FUTA`
- **Classifier signals:**
  1. "Form 941" header.
  2. Quarter checkbox grid.
  3. IRS form footer.
- **Cross-jurisdictional notes:** US-specific.

### Variant 4 — Employee list / org chart payroll snapshot
- **What it is:** A simplified employee-list document — name + title +
  start date + status — without dollar figures. Used when the firm is
  proving workforce *count* but not specific wages.
- **When it appears in an E-2 file:** Tab G or Tab H (organizational
  structure proof).
- **Shared features:**
  - Tabular: Name | Title | Start Date | Status | Hours/wk.
- **Distinguishing features vs Variants 1-3:** No dollar columns; no
  withholding; static-snapshot framing.
- **Filename keywords:** `employee-list | roster | headcount | org-
  chart | personel-listesi`
- **Classifier signals:**
  1. Per-employee row without dollar columns.
  2. Start-date column.
  3. "Roster" / "Headcount" / "Personel" header.
- **Cross-jurisdictional notes:** Universal.

---

## uscis_or_dos_form
**Generic variant count:** 5

### Variant 1 — Petition form (I-129 main + supplements)
- **What it is:** The petition form proper — I-129 base + classification
  supplement (E for E-2). Tab A.3 / A.4.
- **When it appears in an E-2 file:** Tab A (procedural).
- **Shared features:**
  - Multi-page government form; Part-numbered sections; OMB number
    top-right; form code + edition date footer; petitioner /
    beneficiary blocks; signature page.
  - Typical 7-15 pages base + 4-8 page supplement.
- **Distinguishing features:** "I-129" form code; "Petition for a
  Nonimmigrant Worker" header; Parts 1-9.
- **Filename keywords:** `I-129 | I129 | petition | E-Supplement |
  treaty-trader-investor`
- **Classifier signals:**
  1. "I-129" form code in footer.
  2. "Petition for a Nonimmigrant Worker" / "Supplement E"
     subtitle.
  3. OMB number top-right.
  4. Part-numbered sections.
- **Cross-jurisdictional notes:** US-only.

### Variant 2 — Notice-of-appearance / representation form (G-28,
  G-1145, ACH G-1650)
- **What it is:** Procedural attorney / fee forms — short, 1-2 pages.
- **When it appears in an E-2 file:** Tab A.1, A.2, A.5, A.6.
- **Shared features:**
  - 1-2 page form; signature lines; OMB number; form code footer.
- **Distinguishing features:** Short page count; one or two field
  blocks; form codes "G-28" / "G-1145" / "G-1650".
- **Filename keywords:** `G-28 | G28 | G-1145 | G-1650 | ACH |
  e-notification`
- **Classifier signals:**
  1. Form codes in footer.
  2. 1-2 page count.
  3. Signature line + role (attorney / applicant).
- **Cross-jurisdictional notes:** US-only.

### Variant 3 — DOS visa-application form (DS-160 / DS-156E)
- **What it is:** State Department visa-application family — DS-160
  (NIV electronic application) and DS-156E (E-treaty supplement).
- **When it appears in an E-2 file:** Consular filings (Tab A analog
  for consular).
- **Shared features:**
  - DS-160 confirmation page (single page with barcode + photo) or
    multi-page DS-156E with E-treaty fields.
  - Identifying indicia: DOS letterhead, "Form DS-160" / "DS-156E"
    code.
- **Distinguishing features vs Variants 1/2:** DOS (not USCIS); DS
  prefix; barcode-confirmation page format for DS-160.
- **Filename keywords:** `DS-160 | DS-156E | DS160 | DS156E | visa-
  application`
- **Classifier signals:**
  1. "DS-160" / "DS-156E" form code.
  2. DOS letterhead.
  3. Barcode-confirmation layout (DS-160).
- **Cross-jurisdictional notes:** US-DOS only.

### Variant 4 — Dependent forms (I-539 / I-539A)
- **What it is:** Spouse/child status applications. Tab J.
- **When it appears in an E-2 file:** Tab J.
- **Shared features:**
  - Multi-page government form; part-numbered sections; OMB number;
    applicant block; signature page.
- **Distinguishing features:** "I-539" / "I-539A" form codes;
  applicant is a derivative.
- **Filename keywords:** `I-539 | I-539A | dependent | spouse | child`
- **Classifier signals:**
  1. "I-539" / "I-539A" form code.
  2. "Application to Extend / Change Status" header.
  3. Derivative-applicant block.
- **Cross-jurisdictional notes:** US-only.

### Variant 5 — RFE / NOID / decision notice (USCIS-issued response)
- **What it is:** USCIS-issued correspondence requesting evidence,
  intent-to-deny, or rendering decision (approval / denial). Routes
  to the bot's `rfeNotice` rich extractor.
- **When it appears in an E-2 file:** `_RFE-NOID/` working folder; not
  in the filed Tab structure but is USCIS-issued.
- **Shared features:**
  - Multi-page USCIS letter; "Request for Evidence" / "Notice of
    Intent to Deny" / "Decision" header; case-data block; bullet
    list of evidence requested; response-deadline; officer signature.
- **Distinguishing features:** USCIS-issued (DHS letterhead); evidence-
  request bullet list; response-deadline date.
- **Filename keywords:** `RFE | NOID | request-for-evidence | notice-
  of-intent-to-deny | decision`
- **Classifier signals:**
  1. "Request for Evidence" / "Notice of Intent to Deny" /
     "Decision" header.
  2. DHS letterhead.
  3. Evidence-request bullet list.
  4. Response-deadline date.
- **Cross-jurisdictional notes:** US-only.

---

## cover_letter
**Generic variant count:** 2

### Variant 1 — Petition memorandum / brief (multi-page argument)
- **What it is:** The firm's formal cover-letter / memorandum
  arguing every E-2 element with inline exhibit citations. Tab B.
- **When it appears in an E-2 file:** Tab B.
- **Shared features:**
  - Firm letterhead; addressee (USCIS Service Center or Consular
    Officer); RE: line with case identifier; multi-section argument
    body matching E-2 elements (E1-E5); inline `(Exhibit X.Y)`
    citations; conclusion + relief requested; attorney signature
    block.
  - Typical 25-90 pages.
- **Distinguishing features:** Long; section-headed; element-
  organized; inline exhibit citations; attorney signature with bar
  ID.
- **Filename keywords:** `cover-letter | brief | petition-memo | memo
  | tab-B | dilekce`
- **Classifier signals:**
  1. Firm letterhead + addressee USCIS / DOS block.
  2. RE: line with beneficiary + petitioner.
  3. Multiple inline `(Exhibit ...)` citations.
  4. Section headings matching E-2 elements.
  5. Attorney-signature with bar-ID footer.
- **Cross-jurisdictional notes:** US-immigration-tailored.

### Variant 2 — Short transmittal / cover sheet
- **What it is:** A 1-3 page short cover note — typical for filings
  that don't carry the firm's full brief, or for transmittal to
  consular post.
- **When it appears in an E-2 file:** Tab B (rare) or pre-filed
  transmittal.
- **Shared features:** Letterhead + addressee + RE + brief body +
  attorney signature.
- **Distinguishing features vs Variant 1:** Short; no element-by-
  element argument; few or no exhibit citations.
- **Filename keywords:** `cover-sheet | transmittal | letter-of-
  transmittal`
- **Classifier signals:**
  1. Short page count.
  2. No `(Exhibit ...)` citation density.
  3. Single body paragraph or two.
- **Cross-jurisdictional notes:** Universal letter pattern.

---

## expert_letter
**Generic variant count:** 2

### Variant 1 — Industry-expert advisory letter
- **What it is:** A letter from a professor, industry analyst, market-
  research figure, or trade-association leader corroborating market
  size, demand, or sectoral viability of the Petitioner's enterprise.
- **When it appears in an E-2 file:** Tab G (more-than-marginal
  corroboration).
- **Shared features:**
  - Letterhead (university / firm / association); addressee
    ("To Whom It May Concern" / USCIS); writer-credentials paragraph;
    industry-substance paragraph(s); strongest sentence; signature
    + title + institution.
  - Typical 2-5 pages.
- **Distinguishing features:** Independent third-party letterhead;
  writer's credentials block; subject-matter (market / demand)
  rather than personal acquaintance with Beneficiary.
- **Filename keywords:** `expert-letter | advisory | industry-expert |
  market-expert`
- **Classifier signals:**
  1. Independent institutional letterhead.
  2. Writer-credentials paragraph (degrees, publications, years in
     field).
  3. Subject is market / industry, not the Beneficiary.
  4. APS-5 anchoring language.
- **Cross-jurisdictional notes:** Universal.

### Variant 2 — Subject-matter advisory letter (technical / regulatory)
- **What it is:** A narrower technical letter from an engineer,
  accountant, attorney (non-firm), or regulatory specialist
  validating a specific technical claim (e.g., compliance with a
  building code, NAICS classification, technical novelty).
- **When it appears in an E-2 file:** Tab G or Tab F (substantiality —
  technical-feasibility corroboration).
- **Shared features:** Same general letter structure as Variant 1.
- **Distinguishing features vs Variant 1:** Subject is a specific
  technical / regulatory question (not market sizing); writer-
  credentials emphasize technical license / specialty.
- **Filename keywords:** `technical-letter | regulatory-letter | PE-
  letter | engineer-letter | CPA-letter`
- **Classifier signals:**
  1. Writer-credentials paragraph emphasizes a license (PE, CPA,
     PhD).
  2. Letter body cites specific technical / regulatory question.
  3. Independent institutional letterhead.
- **Cross-jurisdictional notes:** Universal.

---

## employer_letter
**Generic variant count:** 4

### Variant 1 — Letter of recommendation (prior employer praise)
- **What it is:** A prior or current employer's letter praising the
  Beneficiary's performance, character, and qualifications.
- **When it appears in an E-2 file:** Tab H (develop-and-direct /
  Subtype-4 essential-skills evidence).
- **Shared features:**
  - Employer letterhead; addressee; relationship-to-Beneficiary
    paragraph; substance paragraphs (qualities, achievements);
    closing recommendation; signer + title.
  - 1-3 pages.
- **Distinguishing features:** Praise / qualitative tone; no formal
  HR fields (no exact salary, no exact dates necessarily).
- **Filename keywords:** `recommendation | reference-letter | LOR |
  praise-letter | tavsiye-mektubu`
- **Classifier signals:**
  1. "Recommend" / "Recommendation" / "Tavsiye" in body.
  2. Subjective adjectives ("excellent", "exceptional",
     "dedicated").
  3. Single signer.
  4. Employer letterhead.
- **Cross-jurisdictional notes:** Universal.

### Variant 2 — Verification of employment (formal HR letter)
- **What it is:** A formal HR letter confirming employment dates,
  position, salary, and full-time status — typically formulaic.
- **When it appears in an E-2 file:** Tab H (essential-skills tenure
  proof), Tab E.1 (salary-source corroboration).
- **Shared features:**
  - Employer letterhead; addressee; structured fields (start date,
    end date, position, salary, employment status); HR signer.
  - Typically 1 page.
- **Distinguishing features vs Variant 1:** Formulaic / fielded; HR
  signer (not direct supervisor); exact dates + salary.
- **Filename keywords:** `verification | VOE | employment-verification
  | HR-letter`
- **Classifier signals:**
  1. Field-style format: Start date / End date / Position / Salary.
  2. HR-department signer.
  3. Single page.
  4. Formulaic boilerplate.
- **Cross-jurisdictional notes:** Universal.

### Variant 3 — Foreign-government / institutional service record
- **What it is:** A foreign-government or large-institution-issued
  formal service record — Turkish Hizmet Belgesi, military service
  record, civil-service tenure certificate. Routes to
  `serviceRecord` rich extractor.
- **When it appears in an E-2 file:** Tab H (Subtype-4 prior tenure +
  salary-differential argument under 9 FAM 402.9-7(2)(b)).
- **Shared features:**
  - Government / institutional letterhead with seal; structured
    fields (employee ID, position-by-position history, salary by
    period); official stamp + signature.
- **Distinguishing features vs Variants 1/2:** Government / quasi-
  government issuer; multi-period history table; official seal.
- **Filename keywords:** `service-record | hizmet-belgesi | civil-
  service | military-service`
- **Classifier signals:**
  1. Government / institutional letterhead + seal.
  2. Multi-period history table.
  3. Official wet-ink stamp.
  4. Employee-ID / civil-service-ID number.
- **Cross-jurisdictional notes:** Civil-law jurisdictions issue these
  routinely; common-law jurisdictions less so.

### Variant 4 — Job-offer letter (forward-looking, US Petitioner →
  Beneficiary)
- **What it is:** A US Petitioner-issued offer to the Beneficiary
  setting position, compensation, and start. Routes to `jobOffer`
  rich extractor. Drives salary-below-benchmark and CV-vs-offer
  drift gates.
- **When it appears in an E-2 file:** Tab H (Subtype-4 / executive-
  supervisory).
- **Shared features:**
  - Petitioner letterhead; addressee (Beneficiary); offer block (title,
    start, compensation, status, reporting); contingencies (visa /
    background); signatures (Petitioner officer + Beneficiary).
- **Distinguishing features vs Variants 1-3:** Forward-looking
  (not historical); Petitioner = US entity; "subject to E-2 visa"
  contingency.
- **Filename keywords:** `offer-letter | job-offer | employment-offer
  | iş-teklifi`
- **Classifier signals:**
  1. "Offer" / "Job Offer" header.
  2. Forward-looking start-date.
  3. Petitioner letterhead.
  4. Visa-contingency clause.
- **Cross-jurisdictional notes:** US-immigration-tailored.

---

## cv_or_resume
**Generic variant count:** 2

### Variant 1 — Narrative chronological CV
- **What it is:** Long-form chronological CV — 2-6 pages, reverse-
  chrono with summary, experience, education, skills.
- **When it appears in an E-2 file:** Tab H (develop-and-direct or
  essential-skills).
- **Shared features:**
  - Header (name, contact); summary / objective; experience section
    (employer | title | dates | bullets); education; skills /
    certifications.
- **Distinguishing features:** Reverse-chrono; bullet-heavy;
  experience section dominant.
- **Filename keywords:** `CV | resume | curriculum-vitae | ozgecmis`
- **Classifier signals:**
  1. Reverse-chrono experience pattern (most-recent first).
  2. Bullet-list employment-detail blocks.
  3. Education section with degree + institution + year.
  4. "CV" / "Resume" / "Özgeçmiş" header or filename.
- **Cross-jurisdictional notes:** Universal.

### Variant 2 — Academic / research CV (publications + appointments)
- **What it is:** Academic CV — long, publication-heavy, includes
  appointments, grants, teaching, peer-review.
- **When it appears in an E-2 file:** Tab H or Tab G when the
  Beneficiary's academic credentials anchor essential skills (rare
  but appears).
- **Shared features:** Same general structure as Variant 1 plus
  Publications, Grants, Teaching, Service sections.
- **Distinguishing features vs Variant 1:** Publications section
  (bibliographic entries); grant-funding section; long page count
  (10-30 pages).
- **Filename keywords:** `academic-CV | research-CV | publications |
  faculty-CV`
- **Classifier signals:**
  1. Publications section with bibliographic-entry pattern.
  2. Grant / funding section.
  3. Long page count (10+).
- **Cross-jurisdictional notes:** Universal.

---

## financial_statement
**Generic variant count:** 4

### Variant 1 — Balance sheet (point-in-time)
- **What it is:** Statement of assets, liabilities, equity at a
  specific date. Tab F's Petitioner Balance Sheet exhibit.
- **When it appears in an E-2 file:** Tab F (substantiality —
  proportionality calculation), Tab G (renewal — operating health).
- **Shared features:**
  - Header: entity name + "Balance Sheet" + as-of date.
  - Three-section body: Assets (current + non-current), Liabilities
    (current + non-current), Equity.
  - Footer: total assets = total liabilities + equity.
- **Distinguishing features:** "As of [date]" framing (not period-
  range); A = L + E identity.
- **Filename keywords:** `balance-sheet | BS | bilanco | statement-of-
  position`
- **Classifier signals:**
  1. "Balance Sheet" / "Bilanço" header.
  2. As-of date (single date, not range).
  3. Assets / Liabilities / Equity section structure.
  4. A = L + E reconciling totals.
- **Cross-jurisdictional notes:** US-GAAP and IFRS labels differ but
  structure is universal.

### Variant 2 — Profit & loss / income statement (period)
- **What it is:** Statement of revenues, expenses, net income for a
  reporting period.
- **When it appears in an E-2 file:** Tab G (renewal — operating
  history).
- **Shared features:**
  - Header: entity + "Income Statement" / "P&L" + period range.
  - Body: Revenue → COGS → Gross Profit → OpEx → Operating Income →
    Other → Net Income.
- **Distinguishing features vs Variant 1:** Period-range framing;
  revenue/expense flow (not asset/liability stock).
- **Filename keywords:** `P&L | profit-loss | income-statement |
  PnL | gelir-tablosu`
- **Classifier signals:**
  1. "Profit & Loss" / "Income Statement" / "Gelir Tablosu" header.
  2. Period range (not single date).
  3. Revenue → Net Income flow.
  4. Gross-profit + operating-income subtotals.
- **Cross-jurisdictional notes:** Universal.

### Variant 3 — Cash-flow statement (period)
- **What it is:** Statement of cash flows from operating, investing,
  financing activities.
- **When it appears in an E-2 file:** Tab G (renewal — runway and
  operating-cash-conversion evidence).
- **Shared features:**
  - Three-section body: Operating, Investing, Financing; period
    range; beginning + ending cash reconciliation.
- **Distinguishing features:** Three-activity sectioning; cash-
  reconciliation framing.
- **Filename keywords:** `cash-flow | CF | nakit-akimi`
- **Classifier signals:**
  1. "Cash Flow" / "Nakit Akımı" header.
  2. Operating / Investing / Financing section structure.
  3. Beginning + ending cash reconciliation.
- **Cross-jurisdictional notes:** Universal.

### Variant 4 — Combined / audited financial-statement package
- **What it is:** A combined package including balance sheet, P&L,
  cash flow, notes, and (often) auditor's opinion. The audited form
  is the highest APS variant in this family.
- **When it appears in an E-2 file:** Tab F (substantiality — high-APS
  anchor), Tab G (renewal).
- **Shared features:**
  - Cover page; auditor's letter (if audited); each constituent
    statement on own page; notes to financial statements; long page
    count (15-60 pages).
- **Distinguishing features:** Auditor letter (if applicable); notes;
  long page count; multiple constituent statements bound together.
- **Filename keywords:** `audited | combined | financial-statements |
  annual-report | mali-tablolar`
- **Classifier signals:**
  1. Auditor's-letter page near the top.
  2. Multiple statement types bound together.
  3. "Notes to Financial Statements" section.
  4. Long page count.
- **Cross-jurisdictional notes:** Universal — IFRS and US-GAAP
  audited packages share the same structural anatomy.

---

## credential
**Generic variant count:** 4

### Variant 1 — Diploma / degree certificate
- **What it is:** A formal university-issued certificate awarding a
  degree.
- **When it appears in an E-2 file:** Tab H (essential-skills /
  develop-and-direct credentialing).
- **Shared features:**
  - Single page, ornamental layout; institutional logo + crest;
    "This certifies that [holder] has been awarded the degree of
    [degree] in [field]"; date; signatures (President / Rector +
    Dean).
- **Distinguishing features:** Ornamental; single page; degree-name
  + field-of-study; institutional crest.
- **Filename keywords:** `diploma | degree | bachelor | master |
  PhD | doktora | mezuniyet`
- **Classifier signals:**
  1. Ornamental border / crest.
  2. "Degree of" / "Diploma" / "Mezuniyet" language.
  3. Two officer-signature blocks.
  4. Single page + landscape orientation common.
- **Cross-jurisdictional notes:** Universal.

### Variant 2 — Transcript / academic record
- **What it is:** A multi-page academic record listing courses,
  grades, GPA, dates.
- **When it appears in an E-2 file:** Tab H (essential-skills depth).
- **Shared features:**
  - Tabular layout: Term | Course | Grade | Credits.
  - Header: institution + holder + holder-ID; cumulative GPA.
- **Distinguishing features vs Variant 1:** Tabular; multi-page;
  per-course rows; GPA.
- **Filename keywords:** `transcript | academic-record | not-dokumu`
- **Classifier signals:**
  1. Per-course tabular structure.
  2. Grade column.
  3. GPA / cumulative-grade summary.
  4. Multi-page.
- **Cross-jurisdictional notes:** Universal.

### Variant 3 — Professional certification / license
- **What it is:** A profession-specific license (PE, CPA, MD, RN, bar
  admission) or industry certification (PMP, AWS, CFA, ISO auditor).
- **When it appears in an E-2 file:** Tab H (essential-skills /
  qualifications).
- **Shared features:**
  - Single-page certificate; certifying body logo + seal; holder
    name; certification name; certificate / license number; issue
    date; expiry / renewal date.
- **Distinguishing features vs Variants 1/2:** Profession-specific
  body issuer; license / certification number; expiry date.
- **Filename keywords:** `license | certification | PE | CPA | bar |
  PMP | sertifika | lisans`
- **Classifier signals:**
  1. Certifying-body logo (non-university).
  2. License / certification number.
  3. Expiry / renewal date.
  4. Single page.
- **Cross-jurisdictional notes:** Universal.

### Variant 4 — Training certificate / course-completion
- **What it is:** A short-course or training-program completion
  certificate. Lower APS than Variants 1-3.
- **When it appears in an E-2 file:** Tab H (essential-skills depth,
  supplementary).
- **Shared features:**
  - Single page; training-provider logo; "This certifies completion
    of [course]"; hours / units; date.
- **Distinguishing features vs Variant 3:** No license number; no
  examination; "completion" / "attendance" language; hours-based.
- **Filename keywords:** `training | course-completion | workshop |
  egitim-sertifikasi`
- **Classifier signals:**
  1. "Completion" / "Attendance" / "Eğitim" language.
  2. Hours / CEU / unit value.
  3. Training-provider letterhead.
  4. No license number.
- **Cross-jurisdictional notes:** Universal.

---

## vital_record
**Generic variant count:** 4

### Variant 1 — Birth certificate
- **What it is:** Official civil-registry record of a birth event.
  Used for derivative children (Tab L).
- **When it appears in an E-2 file:** Tab L (children); occasionally
  Tab C (treaty-nationality corroboration if passport unavailable).
- **Shared features:**
  - Civil-registry letterhead + seal; child's name; date + place of
    birth; parent block (mother + father); registration number;
    issue date; registrar signature.
- **Distinguishing features:** Single registrant subject (child);
  parent-block; registry seal.
- **Filename keywords:** `birth-certificate | birth-record | dogum-
  belgesi | act-de-naissance`
- **Classifier signals:**
  1. "Birth Certificate" / "Doğum Belgesi" header.
  2. Parent block (mother + father).
  3. Single registrant subject.
  4. Civil-registry seal.
- **Cross-jurisdictional notes:** Universal civil-registry pattern.

### Variant 2 — Marriage certificate
- **What it is:** Official civil-registry record of a marriage event.
  Used for spouse derivative (Tab L).
- **When it appears in an E-2 file:** Tab L (spouse).
- **Shared features:**
  - Civil-registry letterhead + seal; both spouses' blocks; date +
    place of marriage; officiant; registration number; issue date;
    registrar signature.
- **Distinguishing features vs Variant 1:** Two-spouse subject; no
  parent block; "Marriage" header.
- **Filename keywords:** `marriage-certificate | nikah | evlilik-
  belgesi | act-de-mariage`
- **Classifier signals:**
  1. "Marriage Certificate" / "Evlilik Belgesi" / "Nikah" header.
  2. Two-spouse subject blocks.
  3. Civil-registry seal.
- **Cross-jurisdictional notes:** Universal.

### Variant 3 — Divorce decree / dissolution
- **What it is:** Court order dissolving a marriage. Less common in
  E-2 but appears when a prior marriage affects derivative-status
  arguments or name changes.
- **When it appears in an E-2 file:** Tab L (when relevant), Tab C
  (name-change documentation).
- **Shared features:**
  - Court letterhead; case number; parties; decree language; effective
    date; judge signature + seal.
- **Distinguishing features vs Variants 1/2:** Court (not civil-
  registry); case number; decree language.
- **Filename keywords:** `divorce | decree | dissolution | bosanma`
- **Classifier signals:**
  1. Court letterhead.
  2. Case number.
  3. "Decree" / "Dissolution" / "Boşanma" language.
- **Cross-jurisdictional notes:** Universal court-order pattern.

### Variant 4 — Death certificate
- **What it is:** Official civil-registry record of a death event.
  Rare but appears in inheritance / dependent-status contexts.
- **When it appears in an E-2 file:** Tab E.1 (inheritance source-of-
  funds), Tab L (dependent-status when relevant).
- **Shared features:**
  - Civil-registry letterhead + seal; decedent block; date + place of
    death; cause-of-death (in some jurisdictions); registration
    number.
- **Distinguishing features vs Variants 1-3:** Decedent subject;
  death-event vocabulary.
- **Filename keywords:** `death-certificate | death-record | olum-
  belgesi`
- **Classifier signals:**
  1. "Death Certificate" / "Ölüm Belgesi" header.
  2. Decedent subject block.
  3. Civil-registry seal.
- **Cross-jurisdictional notes:** Universal.

---

## title_deed
**Generic variant count:** 2

### Variant 1 — Land-registry title certificate (Tapu / Title Deed)
- **What it is:** A government-issued title certificate establishing
  ownership of real property. The Turkish Tapu and US recorded deed
  are the dominant forms.
- **When it appears in an E-2 file:** Tab E.1 (source-of-funds property
  origin), Tab G (when Petitioner owns its premises).
- **Shared features:**
  - Government letterhead + seal; parcel/registry block (parcel
    number, address, area, type); registered-owner block; transfer
    history (acquisition date + price); registrar signature + stamp.
  - Typical 1-4 pages.
- **Distinguishing features:** Government registry seal; parcel-
  number; registered-owner-block; APS-5 government instrument.
- **Filename keywords:** `tapu | title-deed | deed | land-registry |
  property-title`
- **Classifier signals:**
  1. Land-registry letterhead + seal.
  2. Parcel / registry number block.
  3. Registered-owner block.
  4. Acquisition-date + price field.
- **Cross-jurisdictional notes:** Civil-law jurisdictions issue Tapu /
  Grundbuch / Cadastre extracts; common-law jurisdictions use a
  recorded deed + title-insurance schedule. Both fit structurally
  here.

### Variant 2 — Property-registry extract / encumbrance certificate
- **What it is:** A registry-issued summary of current encumbrances,
  liens, and ownership status, separate from the underlying title.
- **When it appears in an E-2 file:** Tab E.1 (corroborating clean
  title for a sale-source), Tab G (premises-ownership corroboration).
- **Shared features:**
  - Registry letterhead + seal; parcel block; encumbrance list (liens,
    mortgages, easements); issue date.
- **Distinguishing features vs Variant 1:** Encumbrance / lien framing
  (not title transfer); shorter; current-state snapshot.
- **Filename keywords:** `encumbrance | lien-search | takyidat |
  registry-extract`
- **Classifier signals:**
  1. "Encumbrance" / "Lien" / "Takyidat" language.
  2. Lien / mortgage list.
  3. Registry letterhead + seal.
  4. Issue-date prominent.
- **Cross-jurisdictional notes:** Universal — every land registry has
  an analog.

---

## government_id
**Generic variant count:** 3

### Variant 1 — National ID / state ID card
- **What it is:** A government-issued identity card (national ID in
  most jurisdictions, state ID in the US).
- **When it appears in an E-2 file:** Tab C (treaty-nationality proof
  alternative), Tab E.1 (KYC corroboration on bank documents).
- **Shared features:**
  - Card-shaped scan (front + back, ~85×54 mm); photo; holder name;
    DOB; ID number; issue + expiry; issuing-country emblem.
- **Distinguishing features:** Card aspect; photo; ID-number format
  per country; no MRZ on most national IDs (some have it).
- **Filename keywords:** `national-ID | state-ID | nufus-cuzdani |
  TC-kimlik | identity-card`
- **Classifier signals:**
  1. Card aspect ratio.
  2. Photo + government emblem.
  3. ID-number format detection.
  4. Two-sided scan.
- **Cross-jurisdictional notes:** Universal.

### Variant 2 — Driver's license
- **What it is:** A driver's license card with photo, name, address,
  and licensing-class.
- **When it appears in an E-2 file:** Tab E.1 (KYC corroboration), Tab
  C (US-issued license as residency-context proof).
- **Shared features:**
  - Card-shaped scan; photo; name; address; DOB; license number; class
    (A/B/C/M); issue + expiry.
- **Distinguishing features vs Variant 1:** Address field;
  license-class field; "Driver License" / "Sürücü Belgesi" header.
- **Filename keywords:** `drivers-license | DL | sürücü-belgesi |
  permit-de-conduire`
- **Classifier signals:**
  1. "Driver License" / "Sürücü Belgesi" / "Permis" header.
  2. License-class field (A/B/C/M).
  3. Address line on the front.
  4. Card aspect.
- **Cross-jurisdictional notes:** Universal.

### Variant 3 — Residency / immigrant ID card
- **What it is:** A residency permit card from a foreign jurisdiction
  or US permanent-resident card. Establishes status without being a
  passport.
- **When it appears in an E-2 file:** Tab C (when treaty-national
  co-owner has US residency / SSN as nationality-pivot question),
  Tab L (dependent residency-context).
- **Shared features:**
  - Card-shaped scan; photo; name; status code; expiry; issuing
    authority emblem.
- **Distinguishing features vs Variants 1/2:** Status / category code
  (e.g., "Permanent Resident", "İkamet İzni"); USCIS / immigration-
  authority seal.
- **Filename keywords:** `green-card | I-551 | permanent-resident |
  residency | ikamet-izni`
- **Classifier signals:**
  1. Immigration-authority emblem (USCIS / foreign equivalent).
  2. "Permanent Resident" / "Resident" / "İkamet" language.
  3. Card aspect.
  4. Category-code field.
- **Cross-jurisdictional notes:** Universal — every jurisdiction issues
  an analog.

---

## translation_certification
**Generic variant count:** 2

### Variant 1 — Translator certification page (Akalan-style attached
  declaration)
- **What it is:** A short translator's declaration page certifying
  that an attached document has been accurately translated from the
  source language to the target. The dominant variant for E-2.
- **When it appears in an E-2 file:** Tab L (attached to vital
  records), Tab E.1 (attached to deeds), wherever a non-English
  document is filed.
- **Shared features:**
  - Single page; "Certificate of Translation" / "Translator's
    Declaration" header; translator name + credentials; source-
    language → target-language statement; competency statement
    ("competent to translate"); document-translated description; date;
    signature + (sometimes) notary acknowledgment.
- **Distinguishing features:** Single page; declaratory sentence
  pattern; translator-only signer (or with notary); attached to a
  source document.
- **Filename keywords:** `certified-translation | translator-cert |
  translation-certification | tercume-belgesi`
- **Classifier signals:**
  1. "Certificate of Translation" / "Translator's Declaration"
     header.
  2. Source-language → target-language declarative sentence.
  3. Competency statement.
  4. Single page + signature.
- **Cross-jurisdictional notes:** Universal — pattern is set by USCIS
  8 CFR 103.2(b)(3) and mirrored by foreign consular practice.

### Variant 2 — Sworn / notarized translator affidavit (jurisdiction-
  formal)
- **What it is:** A more formal translator-affidavit with notarial
  acknowledgment or sworn-translator stamp (yeminli tercüman in
  Turkey, traducteur assermenté in France).
- **When it appears in an E-2 file:** Tab L or Tab E.1 (when the
  underlying document requires sworn-translation per jurisdictional
  practice).
- **Shared features:**
  - Same general structure as Variant 1 plus notarial seal /
    sworn-translator stamp; sometimes apostille attached.
- **Distinguishing features vs Variant 1:** Notarial seal; sworn-
  translator registration number; sometimes apostille attached.
- **Filename keywords:** `sworn-translation | yeminli-tercume |
  notarized-translation | apostilled-translation`
- **Classifier signals:**
  1. Notarial seal pattern.
  2. Sworn-translator registration number.
  3. Apostille attachment (optional).
  4. Two-signer pattern (translator + notary).
- **Cross-jurisdictional notes:** Civil-law jurisdictions favor sworn
  / notarized; common-law practice often accepts the simpler
  Variant 1.

---

## other
**Generic variant count:** 3

### Variant 1 — Photographs / image-only artifact
- **What it is:** Image-only PDFs — premises photos (Tab G.1), passport
  photos, signature scans, apostille seals, business cards. Routes to
  the bot's `imagePhoto` extractor.
- **When it appears in an E-2 file:** Tab G.1 (premises photographs);
  occasional ancillary indicia.
- **Shared features:** Page-as-image; minimal text; high pixel density;
  EXIF-style geometry.
- **Distinguishing features:** Text density near zero; image-area
  near full-page.
- **Filename keywords:** `photo | photograph | image | premises |
  scan | resim`
- **Classifier signals:**
  1. Near-zero extracted text.
  2. Single dominant image per page.
  3. Image aspect / EXIF artifacts.
- **Cross-jurisdictional notes:** Universal.

### Variant 2 — Internal memo / worksheet (firm-internal artifact)
- **What it is:** Firm-internal memos, source-of-funds memos,
  proportionality worksheets, intake notes. Not filed but live in
  the working folder.
- **When it appears in an E-2 file:** `_Working-Drafts/`,
  `_Exhibit-Index/`, `_00-Intake/` (not filed).
- **Shared features:** Firm template; internal headings; reference to
  case ID; not on letterhead bound for USCIS.
- **Distinguishing features:** Internal-only framing; firm template
  header; underscore-prefix folder location.
- **Filename keywords:** `memo | worksheet | internal | draft |
  source-of-funds-memo | proportionality`
- **Classifier signals:**
  1. Firm-template header.
  2. Underscore-prefix folder.
  3. "Draft" / "Internal" / "Working" labels.
- **Cross-jurisdictional notes:** Firm-internal — universal.

### Variant 3 — Catch-all / unclassified
- **What it is:** Anything that does not fit the prior 25 doc_types or
  the prior two `other` variants — typically miscellaneous
  correspondence, news clips, marketing collateral, or screenshots.
- **When it appears in an E-2 file:** Anywhere; flagged for human
  review.
- **Shared features:** None — heterogeneous.
- **Distinguishing features:** Failure to match any other variant's
  signature.
- **Filename keywords:** `misc | other | screenshot | clip | news |
  flyer`
- **Classifier signals:**
  1. No other variant's signature scores high.
  2. `key_facts` array population captures heterogeneity (per-PDF
     schema's `OtherFactsSchema`).
- **Cross-jurisdictional notes:** N/A — definitionally heterogeneous.

---

## Summary 1 — Variant counts

| doc_type | variant_count | dominant_variants |
|---|---|---|
| passport | 2 | biometric biographic page / stamped-pages spread |
| status_doc | 4 | consular visa foil / I-797 notice / EAD card / CBP admission stamp |
| i94 | 2 | CBP web printout / legacy paper card |
| bank_statement | 4 | personal current / business operating / multi-currency-FX / brokerage |
| tax_doc | 4 | personal return / corporate return / pass-through return / wage statement (W-2/1099) |
| money_movement | 4 | international wire+FX / domestic USD wire-ACH / check-deposit / inter-account transfer |
| source_of_funds | 6 | deed of sale / gift letter / inheritance / loan agreement / sale-of-business / salary-savings declaration |
| formation_doc | 5 | Articles / EIN letter / operating agreement / amendment / good-standing certificate |
| ownership_evidence | 3 | cap table / share certificate / membership-interest transfer |
| lease_or_property | 3 | commercial lease / residential lease / real-estate purchase |
| business_plan | 3 | full 5-year narrative / short pitch deck / financial-model export |
| invoice_or_receipt | 4 | vendor invoice / retail receipt / utility bill / professional-services invoice |
| business_contract | 5 | customer/offtake / vendor / distribution-franchise-license / incentive-grant / partnership-JV |
| payroll_doc | 4 | payroll register / W-2-1099 / Form 941 / employee list |
| uscis_or_dos_form | 5 | I-129 petition / G-28-1145-1650 / DS-160-156E / I-539-539A / RFE-NOID-decision |
| cover_letter | 2 | full petition memo / short transmittal |
| expert_letter | 2 | industry-expert / technical-regulatory |
| employer_letter | 4 | recommendation / VOE / service record / job offer |
| cv_or_resume | 2 | narrative chronological / academic-research |
| financial_statement | 4 | balance sheet / P&L / cash flow / combined-audited package |
| credential | 4 | diploma / transcript / professional license-certification / training certificate |
| vital_record | 4 | birth / marriage / divorce / death |
| title_deed | 2 | title certificate / encumbrance extract |
| government_id | 3 | national-state ID / driver's license / residency-immigrant ID |
| translation_certification | 2 | translator declaration / sworn-notarized affidavit |
| other | 3 | photographs / internal memo-worksheet / catch-all |

---

## Summary 2 — Total variants & implementation footprint

- **Total variants across all 26 doc_types: 88**
  - Passport 2 + status_doc 4 + i94 2 + bank_statement 4 +
    tax_doc 4 + money_movement 4 + source_of_funds 6 +
    formation_doc 5 + ownership_evidence 3 + lease_or_property 3 +
    business_plan 3 + invoice_or_receipt 4 + business_contract 5 +
    payroll_doc 4 + uscis_or_dos_form 5 + cover_letter 2 +
    expert_letter 2 + employer_letter 4 + cv_or_resume 2 +
    financial_statement 4 + credential 4 + vital_record 4 +
    title_deed 2 + government_id 3 + translation_certification 2 +
    other 3 = 88.

- **doc_types with single dominant variant (no fingerprint diff
  needed beyond doc_type detection):** none collapse to 1 cleanly —
  the lowest are at 2: passport, i94, cover_letter, expert_letter,
  cv_or_resume, title_deed, translation_certification.
  In practice these can ship Phase-1 fingerprints with a coarser
  detector that only distinguishes 2 sub-shapes.

- **doc_types with high variant count (>4) — fingerprint library will
  need most depth here:**
  - source_of_funds (6) — chain anchor; multiple legally distinct
    origins must be told apart.
  - formation_doc (5) — Articles vs OA vs EIN vs amendment vs good-
    standing all collide in filename-only world.
  - business_contract (5) — customer / vendor / distribution /
    incentive / JV diverge sharply on which gates fire.
  - uscis_or_dos_form (5) — wide form-code variety + the RFE/NOID
    sub-variant deserves its own router (already implemented as
    `rfeNotice`).

- **doc_types where filename pattern probably suffices alone:**
  - uscis_or_dos_form (form codes I-129 / G-28 / DS-160 / I-539 / RFE
    are nearly always in filename or first-line).
  - i94 (filename almost always contains "I-94" or "I94").
  - cover_letter (filename typically contains "cover-letter" /
    "brief" / "memo").
  - tax_doc Variant-2/3/4 (form-code "1120" / "1065" / "W-2" usually
    in filename).
  - translation_certification (filename almost always contains
    "translation" / "certified" / "tercume").

- **doc_types where the fingerprint library will materially
  outperform filename-only:**
  - bank_statement — issuer in filename, structural sub-variant
    almost never; the personal/business/FX/brokerage split is exactly
    where filename loses signal.
  - source_of_funds — filename typically says "tapu" or "deed" but
    rarely tells whether the variant is sale, gift, inheritance, or
    loan.
  - formation_doc — Articles vs Operating Agreement vs EIN-letter
    routinely arrive named the entity-name-only.
  - business_contract — filenames default to counterparty name; the
    customer / vendor / distribution / incentive / JV split is
    invisible in filename.
  - employer_letter — filenames default to "letter-from-X"; the
    recommendation / VOE / service-record / job-offer split is the
    operative legal distinction.
  - vital_record — filenames default to surname; the birth / marriage
    / divorce / death split must come from structure.
  - financial_statement — filenames blur balance-sheet / P&L / cash-
    flow / combined into "financials".
  - credential — filenames default to institution; the diploma /
    transcript / license / training split must come from structure.
  - government_id — filenames default to holder-name; the national-ID
    / DL / residency split must come from structure.
  - other — definitionally needs structure to triage.

---

Last updated: 2026-04-29
Anchored against: `ingest/typed-memory.ts` (DocTypeEnum,
DOC_TYPE_LABELS, per-type micro-schemas) and the firm's manuals
`02-CASE-FILE-STRUCTURE.md`, `03-EXHIBIT-INDEX-TEMPLATE.md`, and
`E2-PREPARATION-MANUAL.md`.
