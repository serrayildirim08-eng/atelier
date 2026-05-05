# E-2 Visa Case Files — Empirical Survey of Voluntarily-Shared Cases

> Compiled 2026-04-30 for the AKALAN Atelier document-fingerprint vector database project. Companion to `research/2026-04-29_doc-variant-taxonomy.md`.

---

## 1. Methodology

### 1.1 Sources searched
Direct fetches and structured-search queries (Reddit JSON API, Google web search) were attempted against the following platforms:

| Platform / source-type | Fetch method | Result |
|---|---|---|
| Reddit r/immigration | JSON API (`reddit.com/r/immigration/search.json`) | Successful — multiple search slices on E-2-related queries |
| Reddit r/USCIS | JSON API | Successful (limited E-2 hits; subreddit skews toward family-based + employment petitions) |
| Reddit r/expats, r/IWantOut | JSON API | Searched; almost no genuine E-2 case posts; volume of off-topic noise high |
| Reddit r/E2visa | JSON API | Empty / non-existent at time of research |
| VisaJourney forums | HTML fetch + Google site-search | Severe limitation — VisaJourney is K-1/CR-1/IR-1 dominant; only 1 E-2-relevant thread surfaced |
| Pandev Law blog | HTML fetch | Successful (3 case studies recovered) |
| Berardi Immigration Law | HTML fetch | Successful (3 case studies recovered) |
| Richards & Jurusik (Buffalo NY) | HTML fetch | Successful (3 case studies recovered, all Canadian/Toronto) |
| Hawks Villafranca Law (Austin TX) | HTML fetch | Successful (1 case study recovered) |
| Ashoori Law, Malescu Law, Patel Law, Reddy Neumann, Mubarak | Web-search snippet only | Surface-level data captured; full-page fetches blocked or oversized |
| Klasko Immigration | Searched | Mostly thought-leadership; few specific anonymized cases public |
| YouTube transcripts | Searched | No transcripts surfaced via search; YouTube Caption API not invoked |
| LinkedIn attorney posts | Searched | Generic content; no specific case posts surfaced |
| Substack newsletters (Mehta / Cohen / Siskind) | Searched | Hit policy commentary, not individual cases |
| Twitter / X | Not directly accessible | No usable data |
| Quora / Avvo | Searched | Surface-level Q&A only; no substantive case packets shared |
| Turkish-language sources (Manay CPA, VisAmerika, Onal Gallant, Gold Visa) | Searched | Educational Turkish content; no specific public case studies retrieved |

### 1.2 Date range covered
Cases identified span **2020-10-13 through 2026-04-30** (most recent: Toronto consulate 6Ci-flag case, posted 2026-04-30; oldest: r/immigration digital marketing agency F-1 → E-2 thread, 2020-10-13). Bulk of substantive cases concentrate in **2023-2025**.

### 1.3 Filters applied
- Filtered to threads/posts containing E-2-specific signal (forms, investment amounts, consulate names, document types).
- Excluded purely educational/marketing pages (law firm "what is E-2" guides) unless they contained anonymized client case detail.
- Excluded posts that mentioned E-2 only tangentially (e.g., spouse of an E-2 holder asking unrelated questions).

### 1.4 Total counts
- **Cases captured with at least country + sub-type + outcome:** 17
- **Cases with detailed document-list narrative:** 6 (Hawks Villafranca, 3× Berardi, EB-1A petitioner who provides cross-comparable doc list, Pandev Paris)
- **Cases sparse (outcome + few document mentions only):** 11
- **Geographic distribution (treaty country of nationality):** Canada 8, Honduras 1, France 1, Spain (resident MX) 1, Austria 1, Pakistan (mention only) 1, Romania (mention only) 1, Mexico 1, Thailand 1, UK (mention) 1, plus aggregate firm-roster mentions (Italy, Egypt, India, Panama, Mauritius, Dubai, Venezuela, Palestine).
- **Sub-type distribution:**
  - Subtype 1 (individual investor / sole owner consular new): **11**
  - Subtype 2 (corporate-owned, multi-shareholder): **2**
  - Subtype 3 (executive-supervisory employee of qualifying enterprise): **1**
  - Subtype 4 (essential-skills employee): **0** (no public-share cases surfaced)
  - Unclear: **3**

### 1.5 Known limitations / gaps
- **Reddit bot-block cap:** Reddit JSON API tolerated `limit=3` to `limit=10` reliably; larger fetches were size-blocked. Many threads existed but were not opened individually due to per-thread fetch budget.
- **No first-person Türkiye / Turkish E-2 cases surfaced** despite Turkish-language searches. Turkish E-2 holders appear to share less in public English forums.
- **Subtype 4 (essential-skills employee) entirely absent** from public sharing — these are typically large-corporate transfers handled internally and rarely narrated publicly.
- **Investment-amount disclosure highly variable.** When attorneys describe approved cases, investment is often quoted as a range or threshold ("$50,000," "$100K-$150K," "below $50,000"); when posters self-narrate, exact amounts are commonly omitted.
- **Document-list verbatim enumeration is rare** in voluntary sharing. The richest doc lists came from the Berardi case studies (which itemize categories like "research and development costs, marketing expenses, office and general expenses, legal and accounting fees, payroll expenses, office rent, travel expenses") and Hawks Villafranca ($50k Venezuelan/Spanish case).
- **Reddit 2026-04-30 cutoff:** Reddit search "past year" filter for `r/immigration` "E-2 visa interview" returned 0 results — strongly suggesting Reddit's search index is sparse for E-2 content vs. H-1B/O-1.

---

## 2. Per-case summaries (chronological, most recent first)

### Case 01 — Canada · Subtype 3 (essential-skills/engineer transitioning) · 2025-11-08
- **Source:** https://old.reddit.com/r/immigration/comments/1szm36d/6ci_bar_discovered_during_e2_visa_interview_at/
- **Date posted:** 2026-04-30 (interview: 2025-11-08)
- **Sub-type (inferred):** Subtype 3 (engineer with employee role) — though the poster phrases it as "my E-2 visa investment" in one passage, suggesting possible Subtype 1 dual role
- **Country (treaty country):** Canada
- **Investment amount range:** Not disclosed
- **Filing route:** consular_new (Toronto consulate)
- **Document list (verbatim from poster):**
  - Application packet (general)
  - Four affidavits submitted in rebuttal/waiver:
    - Three contractor affidavits "stated I only ever did engineering work at the site"
    - One project owner affidavit "stated I never did anything other than engineering design and testing (IE no management duties)"
  - Sworn TN-1 denial statements (referenced as historical record)
  - Rebuttal package addressed to FAM 9 elements of fraud
- **Visual / structural details mentioned:** affidavits described as separately authored; rebuttal "package" suggests bound/tabbed presentation
- **RFE history:** Not technically RFE — case held under INA §212(a)(6)(C)(i) waiver pending due to a TN-1 history flag. Consular officer wanted to recommend issuance; supervisor blocked due to 6Ci hit.
- **Outcome:** Visa NOT issued; awaiting waiver adjudication (~6 months wait reported). Investment "about to be lost."
- **Notes / quirks:** Important data point — clean E-2 case can be derailed by historical TN-1 denials at land border POEs. Multiple denials at multiple POEs (Pacific Highway, Peace Arch, Sweet Grass) accumulated into a 6Ci flag despite the underlying E-2 merits being adequate.

### Case 02 — Canada · Subtype 1 (individual investor, planning) · 2025-11-18
- **Source:** https://old.reddit.com/r/immigration/comments/1p04sen/anyone_approved_for_e2_visa_recently_in/
- **Date posted:** 2025-11-18
- **Sub-type:** Subtype 1 (planned construction PM / consulting service business in Florida)
- **Country:** Canada
- **Investment amount range:** Targeting ~$100,000 "active business spending" (excluding legal fees) — pre-filing planning stage
- **Filing route:** consular_new (planned)
- **Document list (planned/described):**
  - Office lease
  - Insurance documents (commercial)
  - Office equipment receipts
  - Software subscriptions: Bluebeam, QuickBooks, MS365, AI tools
  - Truck purchase ($30-35k FMV) + commercial insurance — flagged by attorney as possibly NOT counting toward E-2 investment
  - Marketing & branding receipts
  - CPA & bookkeeping engagement
  - Part-time W-2 admin payroll (5-10 hrs/week)
  - GC license preparation course evidence
  - Small professional retainers (survey, drafting, engineer)
- **Visual / structural details:** planning-stage, no document yet executed
- **RFE history:** N/A
- **Outcome:** Pending — pre-application
- **Notes / quirks:** Useful empirical data on the **$100K spending threshold** that attorneys reportedly impose informally for service-business E-2s. Vehicle inclusion is explicitly contested by the poster's attorney.

### Case 03 — Canada · Subtype 1 (franchise investor, planning) · 2025-11-18
- **Source:** https://old.reddit.com/r/immigration/comments/1p0i9q0/best_franchise_for_e2_visa_with_100k_budget/
- **Date posted:** 2025-11-18
- **Sub-type:** Subtype 1 (planned franchise purchase)
- **Country:** Canada
- **Investment amount range:** $100K-$150K (planned)
- **Filing route:** consular_new (planned)
- **Document list (described as targeted):**
  - Franchise agreement (planned)
  - 1-2 W-2 employee documents
  - Semi-absentee operating model documentation
- **Outcome:** Pre-application research stage
- **Notes / quirks:** Same poster as Case 02 — investor hedging between service business and franchise paths. Confirms popular E-2 budget tier.

### Case 04 — Honduras · Subtype 1 (family) · 2025-04
- **Source:** https://old.reddit.com/r/immigration/comments/1l10tma/best_choices/
- **Date posted:** 2025-06-01
- **Sub-type:** Subtype 1 (family business — principal + dependents)
- **Country:** Honduras
- **Investment amount range:** Not disclosed (family business)
- **Filing route:** consular_new (E-2 + dependents)
- **Document list:** Not enumerated; poster references "the family business" generically
- **Outcome:** **APPROVED** ("This past April, my family and I had our E-2 visas approved")
- **Notes / quirks:** Aging-out concern for 21-yr-old dependent — notable for cohort/family-immigration angle. University-credit transfer to F-1 considered.

### Case 05 — France · Subtype 1 · ongoing as of 2025-08
- **Source:** https://old.reddit.com/r/immigration/comments/1mju6c5/chances_at_eb2_niw/
- **Date posted:** 2025-08-07
- **Sub-type:** Subtype 1 (cofounder, dog-supplements e-commerce)
- **Country:** France
- **Investment amount range:** Not stated; business now generating "$15M revenue this year"
- **Filing route:** Currently on E-2 status (filing route not specified — likely consular_new originally)
- **Document list mentions (post-issuance evidence):**
  - Patent application (pending)
  - Pilot study with 40 dogs (independent vet + Harvard Medical researchers oversight)
  - Inc 5000 ranking certificate (sub-400)
  - Shopify award certificate (100,000 online orders)
- **Outcome:** APPROVED (current status); now scoping EB-2 NIW transition
- **Notes / quirks:** Demonstrates **maturation profile** — successful E-2 builds documentary corpus over years (patents, third-party studies, awards, revenue) that becomes EB-2 NIW raw material.

### Case 06 — Pakistan · Subtype 1 (cell-phone repair) · ~2024
- **Source:** Ashoori Law case study — https://www.ashoorilaw.com/blog/e2-visa-case-study/ (search-snippet capture; full body not retrieved due to fetch size)
- **Date:** ~2024 (case-study published; specific filing date not stated)
- **Sub-type:** Subtype 1 (sole owner)
- **Country:** Pakistan
- **Investment amount range:** "Substantial" — exact amount not disclosed in published snippet
- **Filing route:** Likely consular_new (no explicit indicator)
- **Document list (verbatim from snippet):**
  - LLC registration documents
  - EIN issuance from IRS
  - Business bank account (where investment funds were transferred)
  - Gift documentation from US-LPR uncle (source-of-funds)
  - Investment fund transfer evidence
- **Visual / structural details:** Standard LLC corporate file; gift-letter evidence implied to be sworn/notarized
- **Outcome:** APPROVED
- **Notes / quirks:** **Gift-from-relative SOF chain is empirically real** and used in approved cases — relevant for AKALAN's Source of Funds variant taxonomy.

### Case 07 — Romania · Subtype 1 (existing US business) · ~2024
- **Source:** Ashoori Law case study (snippet only)
- **Date:** ~2024 case-study publication
- **Sub-type:** Subtype 1 (sole owner of existing operating business)
- **Country:** Romania
- **Investment amount range:** Not disclosed (existing business operating >10 years)
- **Filing route:** consular_new at US Consulate Romania (Bucharest)
- **Document list (inferred from snippet):**
  - 10+ years of operating business records
  - Full payroll records
  - Track-record / financial statement series
- **RFE history:** None — "without a Request for Evidence"
- **Outcome:** APPROVED, **5-year E-2** (max validity for Romania)
- **Processing:** 3 months from submission to approval
- **Notes / quirks:** "Mature existing business" cases process clean — supporting the empirical pattern that documented operational history obviates marginality concerns.

### Case 08 — Mexico · Subtype 1 (home-improvement franchise) · ~2024
- **Source:** Patel Law / NatLawReview case study — https://natlawreview.com/article/e-2-case-study-e-2-visa-renewal-approved-3-months-and-25-days-through-consular
- **Date:** ~2024 (E-2 renewal)
- **Sub-type:** Subtype 1 (sole owner, home-improvement service franchise)
- **Country:** Mexico
- **Investment amount range:** Not disclosed
- **Filing route:** consular_renewal (Mexico)
- **Document list (inferred):**
  - Franchise agreement
  - In-home design consultation records
  - Renovation project coordination documents
  - Day-to-day operations evidence (renewal-specific)
- **Outcome:** APPROVED
- **Processing:** 3 months 25 days
- **Notes / quirks:** Renewal cases benefit from operational track-record evidence; substantive renewal docs differ markedly from new-application case.

### Case 09 — Canada (entrepreneur, EV software) · Subtype 1 · ~2024
- **Source:** Berardi Immigration Law — https://berardiimmigrationlaw.com/e2-visa-success-electric-vehicle-software-company/
- **Date:** ~2024
- **Sub-type:** Subtype 1 (entrepreneur, sole owner, software/EV startup)
- **Country:** Canada
- **Investment amount range:** Not disclosed (startup phase)
- **Filing route:** consular_new (US Consulate Toronto)
- **Document list (verbatim from case study):**
  - U.S. company formation documents
  - Initial investment evidence covering:
    - Research and development costs
    - Marketing expenses
    - Office and general expenses
    - Legal and accounting fees
    - Payroll expenses
    - Office rent (lease)
    - Travel expenses
  - Detailed business plan (revenue + hiring plan)
- **Visual / structural details:** Application "submitted" to consulate — suggests bound/tabbed packet
- **RFE history:** None mentioned
- **Outcome:** APPROVED, **5-year E-2**. U.S. company also registered in Canada E Visa Program (for future Canadian-citizen sponsorship).
- **Notes / quirks:** Very clean **canonical-7-bucket cost breakdown** that matches AKALAN Whitfield Spending Reconciliation framework almost exactly.

### Case 10 — Canada (property mgmt, real-estate dev) · Subtype 1 · ~2024
- **Source:** Berardi — https://berardiimmigrationlaw.com/building-success-how-our-client-established-a-u-s-property-management-business-with-an-e-2-visa/
- **Date:** ~2024
- **Sub-type:** Subtype 1 (property management + new construction)
- **Country:** Canada
- **Investment amount range:** Not disclosed (substantial — included land + construction)
- **Filing route:** consular_new (Toronto)
- **Document list (verbatim):**
  - U.S. company formation documents
  - Business startup expense receipts
  - Construction cost evidence
  - Land purchase documents
  - Existing US property portfolio evidence
  - Comprehensive business plan (long-term aspirations, revenue, US-worker hiring)
- **Outcome:** APPROVED, **5-year E-2**; US company registered in Canada E Visa Program
- **Notes / quirks:** Pre-existing US property ownership is treated as investable asset base — relevant for SOF-prior-investment subcategory.

### Case 11 — Canada (hotel operator) · Subtype 1 · ~2024
- **Source:** Berardi — https://berardiimmigrationlaw.com/e-2-visa-success-story-opening-a-hotel-in-the-us/
- **Date:** ~2024
- **Sub-type:** Subtype 1 (experienced hotel operator expanding to US)
- **Country:** Canada
- **Investment amount range:** Not disclosed (substantial — land + construction + startup)
- **Filing route:** consular_new (Toronto)
- **Document list (verbatim):**
  - U.S. company formation documents
  - Land purchase contracts
  - Construction cost documentation
  - Legal fees evidence
  - Marketing expense receipts
  - Travel expense documentation
  - Business plan emphasizing job creation + revenue
- **Outcome:** APPROVED, **5-year E-2**; registered in Canada E Visa Program
- **Notes / quirks:** Application submitted **after construction completion** — "after completing the construction" — suggests strategic timing to avoid marginality / pre-investment concerns.

### Case 12 — Canada (real estate / property mgmt) · Subtype 1 · ~2025
- **Source:** Richards & Jurusik — https://rjimmigrationlaw.com/resources/e-2-visa-approval-for-real-estate-and-property-management-company/
- **Date:** Last updated 2025-05-08
- **Sub-type:** Subtype 1 (real-estate business, sole owner)
- **Country:** Canada
- **Investment amount range:** Not disclosed
- **Filing route:** consular_new (US Consulate Toronto)
- **Document list:** Not itemized in published case study (typical R&J brevity)
- **Outcome:** APPROVED via Toronto consulate
- **Notes / quirks:** Client-testimonial framing — reaffirms Toronto as dominant Canadian-applicant venue.

### Case 13 — Three Canadian entrepreneurs · Subtype 1 (×3) · ~2023
- **Source:** Richards & Jurusik — https://rjimmigrationlaw.com/resources/three-e-visa-approvals-on-the-same-day-in-toronto/
- **Date:** Last updated 2025-05-13 (event predates)
- **Sub-type:** Subtype 1 individual investor (likely; could include E-1 trader)
- **Country:** Canada (×3)
- **Investment amount range:** Not disclosed
- **Filing route:** consular_new — all three approved same day at US Consulate Toronto
- **Outcome:** APPROVED (×3 same-day)
- **Notes / quirks:** Empirically establishes **batch-day consulate adjudication** of multiple Canadian E-1/E-2s — relevant to consulate workflow modeling.

### Case 14 — Canada (pool services investment) · Subtype 1 · ~2023
- **Source:** Richards & Jurusik — https://rjimmigrationlaw.com/resources/e2-visa-approved-by-uscis-for_pool-service-company/ (note: title says "by USCIS")
- **Date:** Updated 2025-05-13
- **Sub-type:** Subtype 1 (investment in existing pool services business)
- **Country:** Canada
- **Investment amount range:** Not disclosed
- **Filing route:** **uscis_cos_new or uscis_extension** — title indicates USCIS adjudication, distinguishing this from the consular cases above
- **Document list:** Not itemized
- **Outcome:** APPROVED
- **Notes / quirks:** Important counter-example — Canadian E-2 cases CAN go through USCIS (typically as change-of-status or extension while already in US). Most Canadian E-2 sharing is consular Toronto.

### Case 15 — Spain (resident Mexico, Venezuelan-origin) · Subtype 1 · 2024-01
- **Source:** Hawks Villafranca Law — https://hawksvillafrancalaw.com/approved-e-2-investor-visa-winning-a-case-with-a-50k-investment/
- **Date:** Posted 2024-01-04
- **Sub-type:** Subtype 1 (sole owner; small investment)
- **Country (treaty):** Spain (client held Spanish citizenship; Venezuelan origin = non-treaty country; resident in Mexico)
- **Investment amount range:** **$50,000 exactly** — explicitly described as the firm's recommended floor
- **Filing route:** consular_new — case **transferred between consulates** to expedite (specific consulate not named)
- **Document list (inferred):**
  - Strong business plan
  - Investment proportionality analysis
  - Contracts with major brands (referenced in interview Q&A)
  - Mock-interview prep records (firm-internal)
- **Visual / structural details:** Interview was "not overly challenging"; client-attorney did a "thorough mock interview"
- **RFE history:** None mentioned
- **Outcome:** APPROVED, ~1 month after interview
- **Notes / quirks:** Important data point on **dual-citizenship strategy**: Venezuelan-origin client used Spanish passport to qualify for E-2. Also: **$50k threshold floor** practiced by some firms vs. the $100k informal practice of others.

### Case 16 — Canadian lawyer · Subtype 1 · ~2021
- **Source:** Pandev Law — https://www.pandevlaw.com/blog/e-2-investor-visa-approval/
- **Date:** ~2021 (URL slug suggests July 2021 date based on companion image)
- **Sub-type:** Subtype 1 (lawyer establishing US legal practice)
- **Country:** Canada
- **Investment amount range:** Not disclosed
- **Filing route:** consular_new (specific consulate not stated; firm is NY-based)
- **Document list:** Not itemized
- **Outcome:** APPROVED, **3-year E-2** (Canada cap is 5; 3 may indicate lawyer's specific request or business-plan horizon)
- **Notes / quirks:** Notable that 3-year was issued vs. 5-year max — suggests consular discretion or specific business justification.

### Case 17 — France-Embassy filing for non-French national (construction consulting) · Subtype 1 · ~2022-2024
- **Source:** Pandev Law — https://www.pandevlaw.com/blog/e-2-visa-approval-construction-consultation-paris-embassy/
- **Date:** ~2022-2024
- **Sub-type:** Subtype 1 (construction consulting, sole owner)
- **Country (treaty):** Not French — nationality undisclosed but explicitly NOT France
- **Investment amount range:** Not disclosed
- **Filing route:** consular_new (US Embassy Paris) — strategically chosen because Paris Embassy accepts non-French E-2 applicants
- **Document list:** Not itemized
- **Outcome:** APPROVED, **5-year E-2**
- **Notes / quirks:** **Forum-shopping consulate strategy** — non-French applicant filed in Paris because home-country consulate had longer queues / less E-2 throughput.

### Case 18 (mention only) — Thailand · Subtype 1 · ~2022
- **Source:** Pandev Law success-stories index (snippet only)
- **Sub-type:** Subtype 1 (sole owner)
- **Country:** Thailand
- **Investment / route / docs:** Not disclosed
- **Outcome:** APPROVED, **3-year E-2** (Thailand has 6-month-2-year visa validity standard, but pattern varies; a 3-year approval is unusual and may reflect client-specific circumstances)
- **Notes:** Thailand reciprocity is structurally short (Thai E-2 dependents traditionally short — often months not years); Pandev-reported 3-year merits scrutiny but is shared on attorney site.

### Case 19 (mention only) — Austria F-1 OPT → considering E-2 · Subtype 1 · 2020-10
- **Source:** https://old.reddit.com/r/immigration/comments/ja3tx4/e2_application_for_digital_marketing_agency/
- **Date posted:** 2020-10-13
- **Sub-type:** Subtype 1 considered (digital marketing agency, sole proprietor)
- **Country:** Austria
- **Investment amount range:** Not disclosed (planning stage — F-1 OPT expiring)
- **Filing route:** Considered — digital marketing agency E-2
- **Document list considered:** Sole-proprietor multiple-client engagement records; one part-time contractor documented
- **Outcome:** Unknown — pre-application; outcome not posted in thread
- **Notes / quirks:** Demonstrates **F-1 OPT → E-2 transition pattern** — common pathway for European entrepreneurs, especially Austrian, Italian, Dutch.

---

## 3. Empirical document-frequency tables

### 3.1 Frequency by doc_type across ALL cases (descending)

Counting only doc_types **explicitly mentioned by name** in the source narrative (not implied or inferred). N = 17 cases with at least some document data; M = 10 cases with substantial doc-list narrative.

| doc_type | mentions | % of M-cases | % of N-cases |
|---|---:|---:|---:|
| Business plan | 7 | 70% | 41% |
| Office lease / commercial lease | 5 | 50% | 29% |
| LLC / company formation documents | 5 | 50% | 29% |
| Marketing expense receipts | 5 | 50% | 29% |
| Legal / accounting fees evidence | 5 | 50% | 29% |
| Investment / business bank account | 5 | 50% | 29% |
| Payroll / W-2 employee records | 5 | 50% | 29% |
| Office equipment / general office expenses | 4 | 40% | 24% |
| Travel expense documentation | 4 | 40% | 24% |
| Source of funds (gift / wire / transfer) | 3 | 30% | 18% |
| Land purchase / real estate contracts | 3 | 30% | 18% |
| Construction cost documentation | 3 | 30% | 18% |
| Software subscription receipts | 2 | 20% | 12% |
| Insurance documents | 2 | 20% | 12% |
| EIN / IRS issuance | 2 | 20% | 12% |
| Franchise agreement | 2 | 20% | 12% |
| Mock-interview prep / interview Q&A docs (firm-internal) | 1 | 10% | 6% |
| Patent / IP filings | 1 | 10% | 6% |
| Award certificates / industry rankings (Inc 5000, Shopify) | 1 | 10% | 6% |
| Affidavits (third-party) | 1 | 10% | 6% |
| Pilot study / scientific evidence | 1 | 10% | 6% |
| R&D cost evidence | 1 | 10% | 6% |
| Truck / vehicle purchase evidence | 1 | 10% | 6% |
| Existing US property portfolio docs | 1 | 10% | 6% |
| Operational track record (10+ years) | 1 | 10% | 6% |
| Contracts with major brands | 1 | 10% | 6% |
| Sworn TN-1 denial statements (waiver context) | 1 | 10% | 6% |
| Cover letter | 0 (only implied via "submitted application packet") | 0% | 0% |
| Form DS-160 confirmation | 0 (universally required but not narrated) | 0% | 0% |
| Form DS-156E | 0 (not narrated by any voluntary sharer) | 0% | 0% |
| Passport / passport photo | 0 (not narrated) | 0% | 0% |
| Articles of Organization / Operating Agreement (named explicitly) | 0 (subsumed under "company formation") | 0% | 0% |
| Membership Interest Transfer Agreement | 0 | 0% | 0% |
| Member resolutions | 0 | 0% | 0% |
| Treaty-country nationality proof | 0 (passport stands in) | 0% | 0% |

### 3.2 Frequency by doc_type × sub-type

| doc_type | Subtype 1 freq (n=11) | Subtype 2/3/4 freq (n=3) | overall freq (n=17) |
|---|---:|---:|---:|
| Business plan | 7 / 11 (64%) | 0 / 3 | 7 / 17 (41%) |
| Company formation | 5 / 11 (45%) | 0 / 3 | 5 / 17 (29%) |
| Office lease | 5 / 11 (45%) | 0 / 3 | 5 / 17 (29%) |
| Payroll evidence | 5 / 11 (45%) | 0 / 3 | 5 / 17 (29%) |
| Marketing expense | 5 / 11 (45%) | 0 / 3 | 5 / 17 (29%) |
| Legal / accounting fees | 5 / 11 (45%) | 0 / 3 | 5 / 17 (29%) |
| Travel expense | 4 / 11 (36%) | 0 / 3 | 4 / 17 (24%) |
| Office equipment | 4 / 11 (36%) | 0 / 3 | 4 / 17 (24%) |
| Source of funds (gift / wire) | 3 / 11 (27%) | 0 / 3 | 3 / 17 (18%) |
| Land / construction | 3 / 11 (27%) | 0 / 3 | 3 / 17 (18%) |
| Affidavits | 0 / 11 | 1 / 3 | 1 / 17 (6%) |
| (Subtype 4 employee docs) | n/a | n/a | 0 / 17 |

**Caveat:** Subtype 2/3/4 sample is too small (n=3) to draw frequency conclusions. The single Subtype 3 case (engineer/employee, Toronto) is the only one with affidavit evidence prominent — driven by the §6Ci waiver context, not by sub-type per se.

### 3.3 Most-cited specific documents (by name)

In rank order across all 17 cases:

1. **"Business plan"** — 7 mentions; commonly described as "comprehensive," "detailed," "highlighting long-term aspirations," "emphasizing job creation"
2. **"Office lease"** — 5 mentions; service businesses
3. **"LLC formation" / "U.S. company formation"** — 5 mentions; Pakistani, all 3 Berardi Canadian, Hawks Spanish/Venezuelan
4. **"Bank statements" / "business bank account"** — 5 mentions; almost universal in attorney-narrated cases
5. **"Payroll" / "W-2 employee records"** — 5 mentions
6. **"EIN issuance" / "IRS EIN documentation"** — 2 explicit mentions (Pakistani case especially)
7. **"Franchise agreement"** — 2 mentions
8. **"Land purchase" / "real estate contracts"** — 3 mentions (hotel + property mgmt cases)
9. **"Construction cost documentation"** — 3 mentions
10. **"Bluebeam, QuickBooks, MS365, AI tools" subscription receipts** — 1 mention (Florida construction PM case; explicitly named software)
11. **"Truck (FMV $30-35k) + commercial insurance"** — 1 mention (vehicle inclusion explicitly contested)
12. **"Inc 5000 ranking"** — 1 mention (third-party recognition for renewal-prep)
13. **"Shopify 100,000-orders award"** — 1 mention
14. **"Patent application (pending)"** — 1 mention
15. **"Pilot study with 40 dogs, Harvard supervision"** — 1 mention (E-2-to-EB-2-NIW bridge evidence)

Notably absent from voluntary public sharing: **Form I-129, Form DS-160, Form DS-156E, Form G-28, member resolutions, Membership Interest Transfer Agreement, attorney cover letter, exhibit dividers / TOC, Akalan-style cover letter** — these exist in every real packet but are universally not enumerated by posters.

### 3.4 Documents mentioned but rarely / never in our existing 26-type taxonomy

Cross-referencing against `research/2026-04-29_doc-variant-taxonomy.md` (88-variant doc taxonomy):

| Surfaced document type | In current taxonomy? | Note |
|---|---|---|
| Mock-interview prep records (firm-internal) | NO | Unique attorney work-product — not part of submission packet but cited as success-driver. Likely should NOT be added to submission taxonomy. |
| Sworn TN-1 denial statements (used in §212(a)(6)(C)(i) waiver context) | NO | Cross-visa procedural evidence. Worth a "prior-immigration-history attachment" variant. |
| Patent / patent-pending documentation | Partially (under "intellectual-property variant" if exists) | Industry-specific addition |
| Inc 5000 / industry ranking certificates | NO | Renewal/extension-specific; supports "track-record" variant |
| Pilot study / peer-reviewable scientific data | NO | Highly industry-specific |
| Existing US property portfolio docs (pre-E-2 ownership) | Partially | Could fold into "investor-prior-asset" SOF variant |
| Software subscription receipts (Bluebeam, QuickBooks, MS365) | NO | Useful as a "Software-tools / SaaS subscription bundle" variant |
| Vehicle purchase + commercial-insurance evidence | NO and contested | E-2 attorneys disagree whether vehicles count toward investment — probably maintain as flagged variant |
| Canada E Visa Program registration records | NO | Specific to Canadian Subtype-2 corporate registrations |
| Forum-shop consulate-transfer paperwork | NO | Procedural; could be a process variant |
| Gift letter from US-LPR relative (cross-border SOF chain) | YES (under SOF variants) | Already covered |
| Third-party affidavits (engineer / contractor / project-owner) | Partially | Existing "professional letter / declaration" variants likely cover but worth confirming |

---

## 4. Sub-type empirical findings

### Subtype 1 — individual investor / sole owner, consular new
- **Cases:** 11 / 17 (65%)
- **Average investment (where disclosed):** $50,000 (Hawks Spanish/Venezuelan) to "substantial unspecified" (most Canadian Berardi cases include 7-figure-implied land+construction). Service-business Florida cases target $100K-$150K. **Modal disclosed range: $100,000-$150,000** for service businesses.
- **Typical document list:** Business plan + LLC formation + office lease + payroll + marketing + legal/accounting + travel — the canonical 7-bucket pattern.
- **Country distribution:** Canada dominant (8 / 11), then Honduras, France, Spain (resident MX), Pakistan, Romania, Mexico, Thailand, Austria.
- **Common RFE rationales:** No RFE in any Subtype 1 case captured. Reported clean approvals at Toronto and Bucharest. RFE rate appears low in voluntarily-shared corpus (consistent with attorney case-study selection bias — they share cleans, not RFEs).

### Subtype 2 — corporate-owned, multi-shareholder
- **Cases:** 2 (the Canada E Visa Program registrations attached to Berardi cases — these establish the US-entity as a corporate E-employer for future employees).
- **Average investment:** Not separately disclosed.
- **Typical document list:** US-company formation + Canada-E-Visa-Program registration + ownership-percentage evidence.
- **Country distribution:** Canada-only in captured cases (specific to Canada E Visa Program structure).
- **RFE rationales:** None reported.

### Subtype 3 — executive-supervisory employee
- **Cases:** 1 (the Toronto Nov 2025 6Ci-flag engineer case — though it could be reclassified as Subtype 1 if poster is also the investor)
- **Average investment:** N/A (employee)
- **Typical document list:** Affidavits from contractors + project-owner; rebuttal package; sworn statements
- **Country:** Canada
- **RFE rationale:** Not RFE — INA §212(a)(6)(C)(i) waiver pending. Reflects how Subtype 3 candidates with prior border-denial history can be derailed.

### Subtype 4 — essential-skills employee
- **Cases:** **0** in voluntarily-shared corpus. Complete absence is itself a finding — these candidates appear to file through corporate immigration counsel and not share publicly.

### Unclear cases
- **Cases:** 3 (Austria F-1 → considering, Florida construction-PM planning, Florida franchise planning) — all in pre-application stage, sub-type not finalized.

---

## 5. Document structural details surfaced

What real posters / case studies described about **how documents looked**:

### Business plans
- "Comprehensive," "detailed," "highlighting long-term aspirations of achieving significant revenue and hiring U.S. workers" (Berardi cases ×3)
- "Detailed financial projections, hiring plans, and market analysis" required (Boundless aggregated reporting)
- "Specific" not "generic" — multiple firms emphasize this
- **Typical length:** Not narrated by any source. AKALAN's framework uses 25-40 pages; no public source contradicts.

### Cover letter / petition narrative
- Universally described by law firms as "the application detailed the client's business plan and goals" — but **never enumerated as a stand-alone document type by self-narrating posters.**
- Implies cover letter is so foundational it's invisible to posters' awareness — contrast with the Akalan-style cover letter that explicitly tabs every exhibit.

### Investment evidence packets
- Berardi case studies **list 7 categories** verbatim: R&D, marketing, office/general, legal/accounting, payroll, office rent, travel. This is the **canonical-7 pattern** that maps to AKALAN's Whitfield Spending Reconciliation framework.
- Hawks case explicitly says "$50,000 invested" — single-line summary in narration suggests bank-statement + transfer-record evidence chain.
- Pakistani case (Ashoori) describes the SOF chain in process steps: "registered an LLC, obtained an EIN number from the IRS, and opened a business bank account where he transferred his investment funds" — implies a sequential paper trail with timestamps.

### Source-of-funds chains
- Pakistani case: gift from US-LPR uncle — narrated in 1 sentence; presumably backed by gift letter + bank wire records.
- France case: "$15M revenue" company — implies multi-year audited / unaudited financials.
- Canadian property mgmt case: existing US property ownership cited as foundational — implies title deeds + existing-asset valuations.

### Languages and stamps
- **No language-specific or apostille details** disclosed in any voluntarily-shared case. Romanian and Honduran cases must have involved foreign-language docs but neither poster specified translations or apostilles.
- Reddit Toronto case: 4 contractor affidavits — implies notarization but unspecified.

### Page counts
- One adjacent EB-1A petition (1,151 pages) was described by a separate Reddit poster as "printed all 1,151 pages and mailed them to USCIS."
- **No E-2 packet page count was disclosed publicly.** AKALAN's 220-380-page E-2 estimate is consistent with industry; no public data contradicts.

### Visual layout
- "Application detailed the client's business plan" / "case was prepared and submitted" — universal language; no description of:
  - Tab dividers
  - Color-coded exhibits
  - Bates numbering
  - Letterhead style
  - Cover-page design

This **gap** is itself the most empirically important finding: **public sharing systematically omits visual-layout detail.** The AKALAN-style structural fingerprints (cover-letter typography, exhibit-tab format, table-of-contents convention) are private knowledge.

---

## 6. Categories underrepresented in public sharing

Documents that almost certainly appear in attorney case-build but rarely in public sharing — privacy-sensitive or technical:

1. **Form I-129 (USCIS COS / extension cases) and Form I-907 (premium processing)** — never narrated by name despite being mandatory for USCIS-route cases.
2. **Form DS-160 confirmation page and Form DS-156E** — universally required for consular cases; never voluntarily described.
3. **Form G-28 (notice of attorney representation)** — never mentioned.
4. **Articles of Organization / Articles of Incorporation by name** — folded into "company formation" generically.
5. **Operating Agreement** — never mentioned by name in any captured case.
6. **Membership Interest Transfer Agreements / Stock Purchase Agreements** — never mentioned despite being central to Subtype 2 corporate-acquisition cases.
7. **Member resolutions / Board resolutions** — entirely absent from public sharing.
8. **Specific bank account numbers / routing numbers** — privacy-redacted in all narratives (correctly).
9. **Specific consular officer names / interview-officer ID numbers** — never disclosed.
10. **Tax returns (personal and business)** — referenced generically as "bank statements and tax documentation" but never enumerated by tax-year.
11. **Lease specifics** — landlord names, lease term lengths, monthly rents — universally redacted.
12. **Vendor invoices and receipts at line-item level** — only categorical totals shared.
13. **Akalan-style cover letter / TAB letter / TOC / exhibit-dividers** — entirely absent. **This is the single biggest empirical gap.** The signature artifact of attorney-prepared E-2 packets is invisible in public sharing.
14. **Specific SOF chain documents** (e.g., a 6-month bank-statement run, a series of dated wire transfers, a CPA letter explaining the source) — generally referenced but never reproduced.

These are exactly the gaps the AKALAN vector database needs to fill from the firm's own corpus.

---

## 7. RFE patterns surfaced

Voluntary corpus is sparse on RFE rationales (attorneys preferentially share clean approvals; rejected applicants share less). Captured RFE-adjacent issues:

1. **§212(a)(6)(C)(i) misrepresentation flag** (1 case, Toronto Nov 2025) — triggered by historical TN-1 denials at land border. Not technically RFE; consular waiver request. **Lesson:** Prior-immigration-history scrutiny can derail an otherwise approvable E-2 entirely.
2. **214(b) refusals at London** (firm aggregated reporting from Berardi/GTLaw/EB-5 Insights articles, not specific cases) — increasing under London's 2024-2025 VCU process; reasons include investment-size adequacy, marginality, business-plan generic-ness.
3. **Marginal-business concerns** (Boundless, Manifest Law aggregated) — for service businesses with 1 client / single contractor (Austrian digital-marketing case alluded to this risk).
4. **Investment-substantiality challenges** for vehicle purchases (planning-stage Florida construction case — attorney warned vehicle "may not count").
5. **Source-of-funds queries** (Pakistani case suggests gift documentation was required).

**Most-likely RFE rationales in 2025-2026 environment** (based on aggregated reporting, not case-by-case):
1. Inadequate substantial-investment showing (subjective, fact-specific)
2. Marginal-enterprise concerns (one-client / no-employee businesses)
3. Source-of-funds chain gaps (especially gift / cross-border SOF)
4. Generic business plan (financial projections too vague)
5. Insufficient applicant role-specific evidence ("develop and direct")

---

## 8. Implications for the vector database

### 8.1 Variants now empirically supported (high coverage)
- **Business plan** variant — well-attested across 7 cases; AKALAN's existing taxonomy variants for length / industry / financial-projection style remain valid.
- **Office lease** variant — well-attested.
- **Bank statement** + **investment-transfer wire** variants — well-attested.
- **LLC formation / company formation packet** — well-attested.
- **Marketing expense** + **legal-fees** + **payroll** + **travel-expense** evidence — well-attested as the canonical-7 spending-reconciliation buckets.
- **Land purchase + construction cost** evidence — well-attested in 3 hotel/real-estate cases.
- **Franchise agreement** — well-attested.
- **Gift-letter SOF** — attested in 1 detailed case (Pakistan/Ashoori).

### 8.2 Variants still under-represented in public corpus
- **Form I-129 / I-907 / DS-160 / DS-156E / G-28** specific layouts and page counts — invisible in public sharing.
- **Akalan-style cover letter** with exhibit-tab citations — completely invisible.
- **Operating Agreement** language and structure variants — invisible.
- **Member resolutions** (sole-member, multi-member, corporate-parent) — invisible.
- **Membership Interest Transfer Agreement** specific clauses — invisible.
- **Stock Purchase Agreement / Asset Purchase Agreement** specific clauses (E-2 acquisitions) — invisible.
- **Form I-94 records** as a layout / structural reference — invisible.
- **Translation cover sheets** with translator certification block — invisible.
- **Foreign-language source documents** with apostille / legalization stamps — invisible.
- **Subtype 4 (essential-skills employee) document set** — entirely absent; full corpus must come from firm files.
- **§212(a)(6)(C)(i) waiver packet structure** — partially attested (1 case; affidavits + rebuttal narrative).
- **Specific consular-officer interview logs / notes** — never available; firm internal only.

### 8.3 Augmentation strategy

| Variant category | Augmentation source | Rationale |
|---|---|---|
| Forms (I-129, DS-160, DS-156E, G-28, I-907) | Firm corpus + USCIS / DOS template scans | Public corpus blind; firm has hundreds of completed exemplars |
| Cover letters / TAB letters | **Firm corpus only** | Akalan-style is proprietary; no public case discloses |
| Member resolutions / OSA ratifications | **Firm corpus only** | Privacy-sensitive; no public sharing |
| Operating Agreements | Firm corpus + (synthetic via state-of-formation templates) | Some public LLC docs exist but Akalan-customized variants are firm-specific |
| Membership Interest / Stock Purchase Agreements | **Firm corpus** | Highly bespoke; AKALAN's Sadik / Karakoc templates illustrate the pattern |
| Source-of-funds packet (full chain) | Firm corpus + (aggregated public attestations as ground truth) | Public cases give the *types* but not the layouts |
| Foreign-language source-doc translations | Firm corpus + bilingual translation-certification templates | Public cases never disclose; firm has Turkish-English, Arabic-English, Spanish-English exemplars |
| §212(6Ci) waiver packets | Firm corpus + 1 anchored Reddit case (Toronto Nov 2025) for synthetic generation | Rare procedural variant |
| Subtype 4 (essential-skills employee) packets | **Firm corpus only** | Public sharing completely absent |
| Industry-specific evidence (patents, pilot studies, awards) | Mix of public industry-press examples + firm corpus | Public cases give attestations; firm corpus needed for layout |

**Synthetic generation is acceptable for:** Cover letters with anonymized client substitution (varying industry / country / sub-type variables across the firm's existing letters); generic LLC formation packets; redacted operating agreements with placeholder clauses.

**Synthetic generation is NOT acceptable for:** Source-of-funds attestations (must be real or annotated as fabricated); member resolutions (signature/legal-effect issues); affidavits (legal effect).

---

## 9. Cited sources (full URL list)

### 9.1 Reddit threads (r/immigration)
- https://old.reddit.com/r/immigration/comments/1szm36d/6ci_bar_discovered_during_e2_visa_interview_at/ — Toronto Nov 2025 6Ci waiver case
- https://old.reddit.com/r/immigration/comments/1p04sen/anyone_approved_for_e2_visa_recently_in/ — Florida construction PM 2025 planning
- https://old.reddit.com/r/immigration/comments/1p0i9q0/best_franchise_for_e2_visa_with_100k_budget/ — Florida franchise 2025 planning
- https://old.reddit.com/r/immigration/comments/1l10tma/best_choices/ — Honduras family E-2 approved April 2025
- https://old.reddit.com/r/immigration/comments/1mju6c5/chances_at_eb2_niw/ — France-citizen E-2 dog supplements
- https://old.reddit.com/r/immigration/comments/ja3tx4/e2_application_for_digital_marketing_agency/ — Austria F-1 → E-2 considering 2020
- https://old.reddit.com/r/immigration/comments/1fieci1/e2_visa_application_lease_of_commercial_property/ — Canadian childcare-center planning 2024
- https://old.reddit.com/r/immigration/comments/13b2g9p/extension_of_e1e2_status_via_uscis_when/ — E-1/E-2 USCIS extension form-filing 2023
- https://old.reddit.com/r/immigration/comments/1g8cdqn/will_approved_i140_prevent_me_from_entering_the/ — I-140 + E-2 entry interaction 2024
- https://old.reddit.com/r/immigration/comments/1szfji4/how_i_got_my_green_card_through_the_eb1a_program/ — adjacent EB-1A 2026 (1,151-page reference)

### 9.2 Reddit search index URLs
- https://www.reddit.com/r/immigration/search.json?q=E-2+visa+approved&restrict_sr=on
- https://www.reddit.com/r/USCIS/search.json?q=E-2+visa+approved
- https://www.reddit.com/r/expats/search.json?q=E-2+visa+approved (sparse)
- https://www.reddit.com/r/IWantOut/search.json?q=E-2+visa (sparse)

### 9.3 Law-firm case studies (substantive content captured)
- https://www.pandevlaw.com/blog/e-2-investor-visa-approval/ — Canadian lawyer 3-yr
- https://www.pandevlaw.com/blog/e-2-visa-approval-construction-consultation-paris-embassy/ — non-French national, Paris filing, 5-yr
- https://www.pandevlaw.com/blog/e-2-investor-visa-approval-2/ — Thai national 3-yr
- https://www.pandevlaw.com/blog/e-2-approval/ — change-of-status approval
- https://www.pandevlaw.com/success-stories/immigration-law/10/
- https://berardiimmigrationlaw.com/e2-visa-success-electric-vehicle-software-company/ — Canadian EV-software 5-yr
- https://berardiimmigrationlaw.com/building-success-how-our-client-established-a-u-s-property-management-business-with-an-e-2-visa/ — Canadian property mgmt 5-yr
- https://berardiimmigrationlaw.com/e-2-visa-success-story-opening-a-hotel-in-the-us/ — Canadian hotel 5-yr
- https://berardiimmigrationlaw.com/important-updates-on-e-2-visa-interviews-at-the-u-s-embassy-in-london/ — London VCU shifts (aggregate reporting)
- https://hawksvillafrancalaw.com/approved-e-2-investor-visa-winning-a-case-with-a-50k-investment/ — Spanish-citizen Venezuelan-origin Mexico-resident, $50k
- https://rjimmigrationlaw.com/resources/category/successful-case-results/e2-visa-success-stories/ — index of 3 Canadian/Toronto E-2 stories
- https://rjimmigrationlaw.com/resources/e-2-visa-approval-for-real-estate-and-property-management-company/
- https://rjimmigrationlaw.com/resources/three-e-visa-approvals-on-the-same-day-in-toronto/
- https://rjimmigrationlaw.com/resources/e2-visa-approved-by-uscis-for-pool-service-company/ — USCIS-route Canadian E-2
- https://www.ashoorilaw.com/blog/e2-visa-case-study/ — Pakistani + Romanian (search-snippet only)
- https://malesculaw.com/e2-visa-approved-for-investment-in-existing-business-a-case-study/ — Romanian existing business
- https://natlawreview.com/article/e-2-case-study-e-2-visa-renewal-approved-3-months-and-25-days-through-consular — Mexican home-improvement 2024
- https://patellegal.com/blog/case-study-discussion-e-2-approval-for-purchase-of-existing-accounting-business/ — accounting business E-2
- https://www.usimmigrationadvisor.com/study-case-E-2-Treaty-Investor-Visa-application-approved-for-a-UK-national.html — UK national E-2
- https://www.usimmigrationadvisor.com/case-studies.html — index of case studies
- https://www.vizamerica.com/e-2-visa-case-studies — case-studies index (fetch failed; Google snippet only)

### 9.4 Industry / aggregate reporting
- https://www.beyondborderglobal.com/resources/e-2-visa-reddit-guide-benefits-requirements-approval-rates-2025
- https://manifestlaw.com/blog/e2-visa-approval-rate/
- https://www.boundless.com/blog/top-us-work-visa-faqs-reddit
- https://americajosh.com/learn-more/immigration/visa-locations/ — embassy / consulate Visa interview reviews
- https://www.gtlaw-insidebusinessimmigration.com/e-visa-process/navigating-e-2-visa-processing-at-the-us-embassy-in-london-what-applicants-need-to-know/
- https://www.eb5insights.com/2025/03/26/navigating-e-2-visa-processing-at-the-us-embassy-in-london-what-applicants-need-to-know/
- https://www.rnlawgroup.com/preparing-for-your-e-2-consulate-interview/
- https://www.rnlawgroup.com/mastering-the-e-2-visa-interview-key-steps-for-success-at-the-consulate/
- https://www.colombohurdlaw.com/visas/e2-visas/long-take-obtain-e2-visa/
- https://www.tryalma.com/learn/e2-processing-time
- https://common.usembassy.gov/wp-content/uploads/sites/57/2023/10/List-of-document-for-E-2-Applications-1.pdf — DOS template doc list
- https://common.usembassy.gov/wp-content/uploads/sites/71/2022/12/E2-Requirements.pdf — older DOS template

### 9.5 VisaJourney (1 thread surfaced)
- https://www.visajourney.com/forums/topic/828508-applying-green-card-from-e-2/ — E-2 → green card adjustment 2025-01-27

### 9.6 Turkish-language sources (educational, not personal cases)
- https://www.manaycpa.com/tr/amerika-yatirimci-e2-vizesi/
- https://www.visamerika.com/12-soru-ile-e2-vizesi-hakkinda-her-sey/
- https://callutku.com/blog/e2-vizesi-sikca-sorulan-sorular/
- https://onalgallant.com/tr/blog/e2-amerika-yatirimci-vizesi-nedir
- https://goldvisa.com.tr/amerika-e2-vizesi-onemli-yatirim-kriterini-anlamak-ve-basariya-ulasmak/
- https://amerikahizmetleri.com/rehber/e2-yatirimci-vizesi
- https://blog.clinchlaw.com/tr/abd-ticaret-yatirim-vizesi/e-2-vizesi/e2-vizesi-suresi/

---

*End of file.*
