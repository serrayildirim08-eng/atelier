# AKALAN E-2 Portal — Prompt Research Handoff Bundle

> **Purpose:** Self-contained briefing to hand to another Claude / ChatGPT session for **prompt-engineering research**. The receiving chat has no filesystem access — everything it needs is inlined below.
>
> **Date assembled:** 2026-04-28
> **Source repo:** `~/projects/akalan-portal` (private)
> **Bundle structure:**
>
> - **PART 0** — Starter prompt to paste into the other chat
> - **PART 1** — Project snapshot (stack, pipeline, current state)
> - **PART 2** — Doctrinal foundation (legal brain)
> - **PART 3** — Operational manuals (how the firm actually files)
> - **PART 4** — New research (2026-04-28 deep dives)
> - **PART 5** — Specific deliverables wanted from the other chat
>
> **How to use:** Paste PART 0 into the new chat as your first message. If the chat supports file uploads, attach this whole bundle file instead. Otherwise, paste the rest in chunks (most chats handle ~30K-50K tokens per message).

---

# PART 0 — STARTER PROMPT (paste this verbatim into the other chat)

```
You are doing PROMPT-ENGINEERING RESEARCH for an AI paralegal product called the AKALAN Portal — a Next.js + Anthropic SDK app that takes a folder of client immigration documents (PDFs) and produces a complete E-2 treaty-investor visa filing package (cover letter, exhibit index, business plan critique, source-of-funds memo, forms reconciliation).

The pipeline has four phases — each a separate Anthropic API call:
  Phase 0 (DETECT)   — Haiku 4.5    classifies case_type + sub-type from a small sample of pages
  Phase 1 (EXTRACT)  — Sonnet 4.6   per-document typed extraction with provenance ({value, source_page, source_quote, confidence})
  Phase 3 (DRAFT)    — Opus 4.7     produces the cover letter Roman-numeral sections (II–VIII) in firm voice
  Phase 4 (REVIEW)   — Opus 4.7     hallucination + RFE-risk + quality-gate enforcement

Prompt caching is wired on system prompts. The product has 4 E-2 sub-types: (1) Individual Investor, (2) Corporate-Owned Investor, (3) Executive/Supervisory Employee, (4) Essential Skills Employee — each with its own schema, voice, tab structure, and authority allowlist. Subtype 1 and 4 are in production; 2 and 3 are skeletons.

Quality bar (NON-NEGOTIABLE):
  • ZERO hallucinated citations. Every legal claim must trace to the authority cascade: INA → 8 CFR → USCIS Policy Manual → 9 FAM 402.9 → BIA precedent (Walsh & Pollard, Hsu, Khan, Ho-by-analogy). Authority allowlist is enforced.
  • Every extracted fact carries {value, source_page, source_quote, confidence}.
  • PII-strip rule: never persist routing numbers, account numbers, SSNs, full DOB, or full passport numbers in long-term memory.
  • Defensive drafting: when a foreign-jurisdiction practice is unfamiliar to USCIS (Tapu, TEFE/TUFE, spouse-named lease, etc.), the cultural/legal explanation is inserted BEFORE the exhibit citation.
  • Drafter never invents a case citation. If unverified, output [CITE NEEDED — VERIFY: <draft>] and route to attorney.

What I want from YOU (this chat):

PRODUCE PRODUCTION-GRADE PROMPT TEMPLATES for the four pipeline phases, optimized for:
  1. Anthropic prompt caching (system prompts cache-friendly: stable headers, dynamic tail)
  2. Structured outputs (use `tool_use` with strict JSON schemas where possible; fall back to fenced JSON)
  3. Hallucination resistance (explicit allowlists, [CITE NEEDED] sentinel, refusal patterns)
  4. Latency budget (Haiku for cheap ops, Sonnet for extraction, Opus only for draft+review)
  5. Cost: target $5/case all-in across all 4 phases

Specific deliverables:
  A. PHASE-0 DETECTOR PROMPT — sub-type + procedural-posture classifier. Input: 5-10 sampled pages. Output: {principal_subtype, procedural_posture, has_dependents, detection_signals[], detection_confidence}. Include heuristic table and few-shot examples.
  B. PHASE-1 EXTRACTOR PROMPTS — one per document type (passport, bank_statement, title_deed, currency_conversion, wire_confirmation, vital_records, operating_agreement, membership_transfer_agreement, payroll, tax_return, lease, business_plan, etc.). Each returns typed JSON matching the schema given for that document in the manuals (Section 3 of Subtype-1 / Subtype-4 manuals below). Provenance discipline: {value, source_page, source_quote, confidence} per field.
  C. PHASE-3 DRAFTER PROMPTS — one per cover-letter section (II Treaty, III Ownership, IV Investment, V Substantiality, VI Marginality, VII Develop&Direct, VIII Conclusion). Subtype-1 voice (Roman numerals, "the Beneficiary"/"the Petitioner") AND Subtype-4 voice (corporate "we"/"our", ALL CAPS section heads). Few-shot from the firm voice corpus.
  D. PHASE-4 REVIEWER PROMPTS — quality-gate check (Section 15 of main manual + Section 7 of Subtype-4) plus RFE-risk scoring (Section 3 of Doctrinal Briefing).
  E. PROMPT-CACHING ARCHITECTURE — which fields go in cache_control: ephemeral=5m, ephemeral=1h. Practical guide for this pipeline.
  F. AUTHORITY ALLOWLIST ENFORCEMENT — concrete pattern (regex + LLM check + retrieval against canonical citation list) to ensure no invented cites slip through.

Format your output as production-ready prompts with `<system>...</system>` and `<user>...</user>` tags, plus rationale notes per prompt explaining WHY each constraint is there.

Quality bar for your prompts: a senior attorney reading the prompt should be able to predict, within a tight tolerance, what the model will output. No vague instructions ("write a good cover letter") — every prompt is operationalized. Every refusal pattern is explicit.

Below this prompt is all the context you need: doctrinal briefing, subtype taxonomy, manuals, voice corpus, cover letter template, and three new (2026-04-28) research reports on consular filing, per-post idiosyncrasies, and E-2 NEW filings.

[paste rest of bundle below this line]
```

---

# PART 1 — PROJECT SNAPSHOT

**What it is:** AI paralegal portal for **Akalan Business Immigration, PLLC** (Yasin Bilgehan Akalan, Esq. + Huseyin Emre Eney, Esq.; New York Bar). Firm specializes in E-2 (primary), EB-1A, EB-1B, EB-1C. Primary client base: Turkish nationals filing through U.S. Mission Türkiye (Istanbul + Ankara).

**Stack:**
- Next.js 16 + Turbopack + TypeScript + Tailwind
- Anthropic SDK 0.91.1 — all Claude calls go through `lib/anthropic.ts`
- pdf-parse v2 (with native getScreenshot for vision fallback — wired but unused)
- Postgres + pgvector via docker-compose (container running, schema unused)
- Azure deployment target

**Pipeline (per file):**
- Phase 0 — Haiku 4.5 — case-type + sub-type detection from sampled pages
- Phase 1 — Sonnet 4.6 — typed per-document extraction
- Phase 3 — Opus 4.7 — cover letter draft (Roman-numeral sections)
- Phase 4 — Opus 4.7 — hallucination + RFE-risk review
- Prompt caching on system prompts (wired, not yet measured)

**Sub-types in production:**
- Subtype 1 — Individual Investor (calibrated to Kacar-Salih, $120K, RI LLC, Jan 2026)
- Subtype 4 — Essential Skills Employee (calibrated to Camural / Pomega Energy, Feb 2024)
- Subtypes 2 (Corporate-Owned) and 3 (Executive/Supervisory) are skeletons — escalate to attorney.

**Authority cascade (enforced by allowlist):**
1. INA § 101(a)(15)(E)(ii)
2. 8 CFR § 214.2(e)
3. USCIS Policy Manual Vol. 2 Part G
4. 9 FAM 402.9
5. BIA precedent: *Matter of Walsh and Pollard*, 20 I&N Dec. 60 (BIA 1988); *Matter of Hsu*; *Matter of Khan*; *Matter of Ho* (by analogy for business plans)
6. Practitioner consensus — pattern only, never primary cite

**Compliance gates (open):** engagement-letter AI clause; Foundry Claude BAA migration; GDPR Transfer Impact Assessment; PII redaction policy; Langfuse 7-year audit logging; Lakera prompt-injection defense; RPA prohibition for filing automation.

**Defensive drafting patterns already encoded:**
- Tapu Müdürlüğü (Turkish title deed without separate sales contract)
- TEFE/TUFE indexed lease escalation
- Spouse-named lease as household income source
- Anti-routine paragraph (when title combines exec + skilled-worker)
- At-risk pre-emption sentence ("No portion of the investment derives from unsecured loans, loans collateralized by the assets of the U.S. enterprise…")

**What's NOT yet built:**
- SharePoint + Outlook Microsoft Graph integration
- Database persistence (pgvector is up but unused)
- Vision fallback for scanned PDFs (capability there, not wired)
- Fact fusion across files within a case folder
- Per-consulate format adapters (Istanbul/Tokyo/Paris/Madrid all have different conventions — see PART 4.2)

---

# PART 2 — DOCTRINAL FOUNDATION

## 2.1 E-2 Doctrinal Briefing 2026

> Source file: `~/akalan-context/E2_Doctrinal_Briefing_2026.md` (660 lines)
> Currency: April 27, 2026

# E-2 TREATY INVESTOR VISA — DOCTRINAL BRIEFING
**For: Akalan Immigration Law Firm — AI Paralegal Agent Knowledge Base**
**Currency: April 27, 2026** | **Author/role: Research brief feeding the case-type manual**

> **READ-ME:** This document is the legal brain the agent should reason from for E-2 cases. Authority cascade: **(1) INA § 101(a)(15)(E)(ii) and 8 CFR § 214.2(e)** (statutory/regulatory floor); **(2) USCIS Policy Manual Vol. 2, Part G** (binding on USCIS adjudicators handling I-129 change-of-status filings); **(3) 9 FAM 402.9** (binding on consular officers handling DS-160/DS-156E cases — *this is the dominant authority because most E-2 cases are consular*); **(4) BIA precedent decisions** — *Matter of Walsh and Pollard*, *Matter of Hsu*, *Matter of Khan*; **(5) AAO non-precedent decisions* (persuasive only); **(6) practitioner consensus** (AILA, firm-published RFE patterns).

[NOTE TO RECEIVING CHAT: The full 660-line briefing follows the same structure as below. Key sections — read all carefully:]

**Section 1. THE FIVE E-2 ELEMENTS** — derived from INA § 101(a)(15)(E)(ii), 8 CFR § 214.2(e)(12)–(15), and 9 FAM 402.9-6. They are conjunctive — failure on any one is fatal:
1. Treaty country nationality (9 FAM 402.9-4(B); 8 CFR 214.2(e)(3))
2. Substantial investment (9 FAM 402.9-6(C)–(D); 8 CFR 214.2(e)(14))
3. Real & operating enterprise (9 FAM 402.9-6(B); 8 CFR 214.2(e)(12)–(13))
4. More than marginal (9 FAM 402.9-6(E); 8 CFR 214.2(e)(15))
5. Develop and direct (9 FAM 402.9-6(F); 8 CFR 214.2(e)(16); *Matter of Walsh and Pollard*)

**Section 1.1 Treaty country / nationality** — applicant must hold the nationality of a country with a qualifying treaty. Enterprise nationality must match (≥ 50% treaty-national ownership). Notable: Portugal added effective March 15, 2024. France reciprocity extended from 25 to 48 months. Non-treaty countries to flag: India, China (PRC), Russia, Brazil, Vietnam, South Africa, Nigeria, most Gulf except Bahrain and Oman. CBI workaround paradigm: Grenada, Turkey, Montenegro (defunct 2022), St. Lucia.

**Section 1.2 Substantial investment** — proportionality test, no statutory minimum. Inverted sliding scale: smaller business = higher % required. Up to $100K → 75–100%; $100K–$500K → 60–75%; $500K–$3M → 30–60%; $3M+ → 30% or less may suffice. Counted: equipment, inventory, leasehold improvements, lease deposits, legal/professional fees, marketing, payroll obligations, working capital irrevocably committed. NOT counted: personal expenses, sweat equity, uncommitted cash, residential real estate. Loans only count if collateralized by investor's personal non-business assets.

**Section 1.3 Real & operating** — bona fide enterprise, real, active, producing services or goods for profit. Excludes speculative/idle, paper organizations, uncommitted funds, passive investment. Privilege evidence of actual transactions over plans. Walsh & Pollard "in the process of investing" doctrine for pre-launch.

**Section 1.4 More than marginal** — capacity to generate more than minimal living for investor + family. Two prongs (alternatives — pass either): (1) Income prong; (2) Job creation / economic contribution prong. 2026 trend: adjudicators rejecting plans relying on 1099 contractors, requiring W-2 hiring timetable. Solo consultant + home office + sub-$100K = highest marginality-denial risk.

**Section 1.5 Develop and direct** — solely to develop and direct the enterprise. Established by ≥ 50% ownership OR operational control (managerial position, voting trust, GP role, manager of manager-managed LLC). Franchise pitfall: restrictive franchise agreement can defeat develop-and-direct.

**Section 2. SOURCE OF FUNDS** — chronological-annotated-file approach. Origin → custody → transfer → deployment. Acceptable origins: salary, business profits, sale of real estate, sale of business, inheritance, gift (notarized + donor's source-of-funds), loan (personal-asset-collateralized only), personal savings, cryptocurrency (heightened scrutiny). Documentation depth scales: ≤ $100K = 6–12 months; $100K–$500K = 1–3 years; $500K+ = 3–5 years with written narrative.

**Section 2.4 At-risk / irrevocably committed** — funds must be at risk of loss. Walsh & Pollard: "in the process of being invested" only if commitment is real and irrevocable. 2026 caution: consulates increasingly skeptical of "any-reason clawback" escrow. Practical rule: actually-spent > escrowed > LOI.

**Section 3. COMMON RFE / DENIAL PATTERNS** — top 9: (1) marginality, (2) substantial investment / proportionality, (3) at-risk / irrevocably committed, (4) source of funds, (5) real and operating, (6) develop and direct, (7) treaty nationality of enterprise, (8) nonimmigrant intent, (9) essential-employee specialization.

**Section 3.2 Trump-era RFE patterns (2025–2026):** more aggressive marginality attacks on solo/home businesses; more aggressive source-of-funds tracing; "discretionary" denials citing PA-2025-16 (Aug 19, 2025).

**Section 4. E-2 EMPLOYEES** — separate prongs: executive/supervisory (9 FAM 402.9-7(C); 8 CFR 214.2(e)(17)) OR essential-skills (9 FAM 402.9-7(D); 8 CFR 214.2(e)(18)), plus same nationality. Foreign-language-or-culture knowledge alone is NOT essentiality. Long-term vs short-term essentiality framing is critical.

**Section 5. RECENT POLICY SHIFTS — 2025–2026:**
- 9 FAM 402.9 updated February 17, 2026
- France reciprocity extended to 48 months (post-2024)
- Portugal added (March 15, 2024)
- Interview universality (Sept 2, 2025) — all NIV applicants must appear in person
- Consular interviews now handled by rotating officer pools at most posts
- End of automatic EAD extension (Oct 30, 2025)
- PA-2025-16 (Aug 19, 2025) — discretionary factors expansion
- Travel bans (effective Jan 1, 2026): 39 countries entry suspended; 75 countries visa issuance paused for PR
- Expanded social-media vetting (Aug 2025)

**Section 6. FILING POSTURE — I-129 vs. CONSULAR** — most E-2 cases go consular for the multi-year stamp. I-129 = USCIS Service Center, paper-only, document-heavy, binary. Consular = live interview, dominant in E-2 practice. Validity: I-129 grants 2-year status; consular stamp = reciprocity period (5 yrs UK/Japan/Germany; 48 mo France; 60 mo Spain/Turkey/Korea/Grenada; 24 mo Italy).

**Section 6.2 E-2D dependents:** Spouse work authorization (E-2S) — automatic per I-94 annotation since November 2021 USCIS policy update (Vol. 10, Part B, Ch. 2). Children under 21: dependent status, no work auth, can attend school. Age-out at 21 — agent must flag 6 months in advance.

**Section 7. REQUIRED EXHIBITS — REAL-WORLD FILING CHECKLIST** — organized by element. Element 1 (Treaty nationality): passport, birth certificate, naturalization certificate, cap table with color-coded ownership chain, passports of every direct/indirect owner ≥ 50%, operating agreement, stock certificates, articles of incorporation, state certificate of good standing. Element 2 (Substantial investment): itemized investment table, total cost calculation, proportionality calculation, wire transfers, bank statements, equipment invoices, lease + paid rent, build-out contracts, inventory invoices, insurance, professional service agreements, marketing invoices, payroll register, escrow agreement (if applicable). Element 3 (Real & operating): business licenses, EIN/CP-575, state tax registration, lease + premises photos, customer agreements, vendor agreements, website, marketing materials, business bank statements, POS records, first-month financials, FDD if franchise. Element 4 (More than marginal): 5-year business plan, organizational chart, W-2 hiring timetable, job descriptions, LOIs/signed offer letters, comparable-business benchmarks, market analysis, pipeline evidence, support letters. Element 5 (Develop and direct): cap table, operating agreement, corporate resolutions, bank signature authority, CV, prior business experience, photos of investor at business. Source of funds: SOF memorandum, origin documents, bank statements, tax returns, currency exchange receipts, gift letters + donor SOF, loan agreements + collateral evidence. Filing forms: I-129 + E supplement OR DS-160 + DS-156E, G-28, fees, cover letter, exhibit index. E-2 employee specifics: job description with executive/essential-skills analysis, position in org chart, employer's org chart, CV + diplomas + experience letters, salary offer, training plan if short-term essentiality. E-2D dependents: marriage certificate, birth certificates, dependent passports, DS-160 per dependent, I-539 + I-539A.

**Section 8. THE 5-YEAR BUSINESS PLAN STANDARD** — Matter of Ho applied by analogy to E-2. Required components: executive summary, company description, products/services, market analysis (TAM/SAM/SOM with sources), marketing plan, operations plan, management & organization with 5-year W-2 hiring timetable, financial projections (monthly Y1, quarterly Y2, annual Y3-5), sensitivity analysis, job creation summary, risks & mitigation, appendices. Plan failure modes: paper plan from Matter of Ho, franchise's own boilerplate plan, 1099-heavy projections, footnote-free assumptions.

**Section 9. NUMBERS TO KNOW IN 2026:**
- Industry investment ranges: restaurant $250K-$700K; franchise $200K-$500K+; tech/SaaS $100K-$250K; consulting $80K-$150K; e-commerce $80K-$200K; real estate (active) $200K-$500K+; manufacturing $300K-$1.5M; retail $150K-$500K
- FY2025 issuances: 51,047 total. Japan 15,367 (30.1%); Canada 6,779; South Korea 5,359; Germany 3,902; France 3,574; UK 2,720; Italy 1,531; Spain 1,438
- Consular approval rate FY2024: ~90.1% (>90% sustained since FY2021)
- Fees (April 2026): DS-160 MRV $315; I-129 $1,015; Asylum Program Fee $300/$600/$0; Premium Processing $2,805; Reciprocity issuance fee per country

**Section 10. PITFALLS — TOP-OF-MIND TRAPS:**
10.1 Marginal home-based business — solo + home + sub-$100K = near-certain marginality denial
10.2 Franchise vs. original — franchisor's stock plan inadequate; restrictive franchise agreement defeats develop-and-direct
10.3 In-process investment — must spend or escrow with denial-only clawback
10.4 Passive investment trap — buy-and-hold, undeveloped land, brokerage account = disqualified
10.5 Loan secured by enterprise assets — does NOT count
10.6 Cap-table contamination — non-treaty co-founder above 50% kills entire E-2 nationality
10.7 Source-of-funds opacity — cash businesses, undocumented gifts, large unexplained deposits, crypto without exchange records
10.8 Preconceived intent (B-1/B-2 → E-2 COS) — misrepresentation risk
10.9 E-2 → green card path is hard (EB-5, EB-1C, EB-2 NIW, family-based bridges)
10.10 Children aging out — no CSPA protection for E-2D

**Section 11. MANUAL SKELETON — case state machine:**
INTAKE → ELIGIBILITY-SCREEN → STRATEGY-SELECT → DOC-COLLECT → ANALYSIS → DRAFT → REVIEW → FILE → POST-FILE

**Section 12. AUTHORITY APPENDIX:**
- Statute: INA § 101(a)(15)(E)(ii), 8 USC § 1101(a)(15)(E)(ii)
- Regulation: 8 CFR § 214.2(e)
- USCIS PM: Vol. 2, Part G
- FAM: 9 FAM 402.9 (last updated Feb 17, 2026)
- Precedent: Matter of Walsh and Pollard 20 I&N Dec. 60 (BIA 1988); Matter of Hsu 17 I&N Dec. 17 (Reg'l Comm'r 1979); Matter of Khan 16 I&N Dec. 138 (BIA 1977); Matter of Ho 22 I&N Dec. 206 (Assoc. Comm'r 1998 — EB-5 by origin, used by analogy for E-2 plans)
- Forms: I-129 + E supplement, DS-160, DS-156E (consular E supplement, paper), I-539 + I-539A, I-765, G-28
- 2025-26 policy: PA-2025-16 (Aug 19, 2025); DHS End of EAD Auto-Extension (Oct 30, 2025); travel bans (Jan 1, 2026); France 48-month; Portugal addition March 15, 2024

**Section 13. AGENT GUARDRAILS:**
1. Never quote a "minimum investment dollar figure" as a rule
2. Never tell a client a CBI passport will work without due-diligence
3. Always cite up the cascade — PM/FAM/CFR before practitioner blogs
4. Always cross-check nationality against live travel ban list
5. Always run W-2 vs. 1099 screen
6. Always treat franchisor's plan as inadequate
7. Always require source-of-funds memo
8. Always run ownership-chain analysis when there is any non-individual shareholder
9. Always flag age-out of E-2D children at intake
10. Always reverify FAM/PM revision dates before filing memo

---

## 2.2 E-2 Sub-type Taxonomy

> Source file: `manuals/_E2-SUBTYPE-TAXONOMY.md` (457 lines)

[Full content of `_E2-SUBTYPE-TAXONOMY.md`. Key facts:]

**Universe of E-2 sub-types:**
- E-1 Treaty Trader (out of scope)
- E-2 Treaty Investor:
  - PRINCIPAL — Subtype 1 Individual Treaty Investor (Kacar-Salih); Subtype 2 Corporate-Owned E-2 (rare)
  - EMPLOYEE — Subtype 3 Executive/Supervisory (no firm exemplar yet); Subtype 4 Essential Skills/Specialized Knowledge (Camural)
  - DEPENDENT — Subtype 5 E-2 Spouse (I-539, EAD eligible); Subtype 6 E-2 Child (I-539A, under 21)

**Procedural variants** (orthogonal to subtype): New (Consular), New (USCIS COS), Extension (USCIS), Visa Renewal (Consular), Re-Validation.

**Detection signals** for Phase-0 detector:
- "(Beneficiary)" = also "(Investor)" or majority owner → Subtype 1
- Membership Interest Transfer Agreement names beneficiary as ≥ 50% member → Subtype 1
- Cover letter on law-firm letterhead → Subtype 1 (most likely)
- Cover letter on petitioner/corporate letterhead → Subtype 3 or 4
- "REQUESTED CLASSIFICATION: E2 — SPECIALIZED KNOWLEDGE" → Subtype 4
- "REQUESTED CLASSIFICATION: E2 — EXECUTIVE/SUPERVISORY" → Subtype 3
- Job Offer Letter present → Subtype 3 or 4
- Beneficiary's salary stated with vs-peer comparison → Subtype 4
- CV emphasizes specialized skills not exec authority → Subtype 4
- CV emphasizes prior P&L, signing authority, supervised teams → Subtype 3
- Multiple foreign + US entity corporate documents (parent-subsidiary structure) → Subtype 2, 3, or 4
- Single foreign LLC + only US LLC corporate documents → Subtype 1
- Personal SOF chain narrated (property sale, inheritance) → Subtype 1
- Single corporate parent → US subsidiary wire → Subtype 2 or treaty-enterprise filings (3, 4)
- I-539 + I-539A present → + Subtype 5, 6 dependents

**Decision tree return shape:**
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

**Authority citation matrix** (allowlist enforced):
- INA § 101(a)(15)(E)(ii) — every subtype, statutory anchor
- INA § 214(e)(6) — Subtype 5 (spouse EAD)
- 8 CFR § 214.2(e)(2) — Subtype 1 definition
- 8 CFR § 214.2(e)(3) — Subtype 2 corporate ownership
- 8 CFR § 214.2(e)(12) — Subtypes 1, 2 at-risk
- 8 CFR § 214.2(e)(14) — Subtypes 1, 2 substantiality
- 8 CFR § 214.2(e)(15) — Subtypes 1, 2 marginality
- 8 CFR § 214.2(e)(17) — Subtype 3 exec/supervisory
- 8 CFR § 214.2(e)(18) — Subtype 4 essential skills
- 9 FAM 402.9-3 — All — overview
- 9 FAM 402.9-4(A) — All — applicant nationality
- 9 FAM 402.9-4(B) — All — enterprise nationality / ≥ 50% ownership
- 9 FAM 402.9-4(F) — All — nonimmigrant intent
- 9 FAM 402.9-5 — Subtypes 1, 2 — investment definition
- 9 FAM 402.9-6(A) — Subtypes 1, 2 — bona fide enterprise
- 9 FAM 402.9-6(B) — Subtypes 1, 2 — at-risk / commitment
- 9 FAM 402.9-6(C) — Subtypes 1, 2 — substantiality (proportionality)
- 9 FAM 402.9-6(D) — Subtypes 1, 2 — source of funds
- 9 FAM 402.9-6(E) — Subtypes 1, 2 — marginality
- 9 FAM 402.9-7(1) — Subtype 1 — develop and direct
- 9 FAM 402.9-7(2)(a) — Subtype 3 — exec/supervisory employee
- 9 FAM 402.9-7(2)(b) — Subtype 4 — essential skills employee
- 9 FAM 402.9-8 — Subtypes 5, 6 — dependents
- 9 FAM 402.9-9 — Extensions / renewals
- Matter of Walsh and Pollard, Interim Decision #3111 — Subtypes 1, 2 — at-risk
- Matter of Ho, 22 I&N Dec. 206 (Assoc. Comm'r 1998) — Subtypes 1, 2 — 5-yr business plan, by analogy

**Cover-letter author + voice by subtype:**
- Subtype 1: Law-firm letterhead, attorney-signed, conservative paralegal-tight voice, Roman numerals (II–VIII), ALL CAPS section heads
- Subtype 2: Same as 1 with parent-corporate narrative addendum
- Subtype 3: Mixed — likely petitioner OR firm letterhead
- Subtype 4: Petitioner letterhead, signed by Petitioner officer (VP HR, COO), corporate marketing-flavored voice, ALL CAPS heads no Roman numerals
- Subtypes 5–6: Brief support letters embedded in principal letter

**Tab structure by subtype:**
- Subtype 1 (Investor) — Akalan A–L pattern: A Forms, B Cover Letter, C Treaty Qualification, D Ownership History, E Investment SOF/Transfer/AtRisk, F Substantiality, G Marginality + Real & Operating, H Develop & Direct, I NOID Principal, J Forms for Dependents, K NOID Dependents, L Dependent Biographic Info
- Subtype 4 (Essential Skills) — Akalan A–H pattern: A TOC + Cover Letter, B Forms (G-1145, G-28, I-129, I-129E, Job Offer Letter), C Applicant Information (Passport, Visa, I-94, Resume, Prior Work, Diploma, Certificates, LoR), D Intent to Depart, E Nationality of Investor, F Ownership (BOTH entities, org charts), G Investment (parent → subsidiary wire + balance sheets), H Real and Operating (catalogues, customer agmts, lease, land, payroll, P&L)

**Source-of-funds model by subtype:**
- Subtype 1: Personal lawful sources (salary, sale of property, inheritance, gift, loan-non-collateralized-by-enterprise) — Origin → personal account → FX conversion → US wire → deployment to Petitioner
- Subtype 2: Corporate parent funds — Parent's audited financials → parent → US subsidiary single or scheduled wire
- Subtype 3, 4: Petitioner enterprise's existing funds (employee NOT funding) — skip personal SOF; verify enterprise's prior E-2 status / treaty enterprise qualification

---

# PART 3 — OPERATIONAL MANUALS

## 3.1 Main E-2 Manual (Subtype 1, calibrated to Kacar-Salih)

> Source file: `manuals/E2-MANUAL-FOR-CLAUDE-CODE.md` (1003 lines)
> Calibrated against: Kacar-Salih E-2 Renewal (Jan 2026, RI LLC, $120K, Turkish nationals)

[CRITICAL CONTENT — full embed below]

The manual is structured as 19 sections:
0. How the Agent Chains This Manual (pipeline phases 0-5)
1. Tab A — Forms (G-1145, G-28, I-129 + E Supplement, G-1650 ACH)
2. Tab B — Cover Letter (drafter output, not input)
3. Tab C — Qualification Under a Treaty of Commerce and Navigation (Element 1)
4. Tab D — Ownership Structure and Corporate History (Element 1 50%+, corporate setup)
5. Tab E — Investment: Source, Transfer, and At-Risk Commitment (Element 2 + SOF chain)
6. Tab F — Substantiality of the Investment (Element 2 — Proportionality)
7. Tab G — Marginality and Ongoing Commercial Activity (Elements 3 + 4)
8. Tab H — Role of the Beneficiary: Developing and Directing (Element 5)
9. Tab I — Notice of Intent to Depart (Principal)
10. Tab J — Forms for Dependents
11. Tab K — Notice of Intent to Depart (Dependents)
12. Tab L — Biographic / Immigration Info for Dependents
13. Cross-cutting Agent Skills (the 22 extractor skills referenced)
14. Authority Verification (Mandatory Before Drafting) — allowlist
15. Quality Gates (the Reviewer's Phase 4 Checklist)
16. Memory Hooks (Per Master OS — what to save, what NEVER to save)
17. Worked Example — Kacar-Salih (Reference Case fixture)
18. What Is Deliberately NOT in This Manual
19. Versioning

**KEY EXTRACTION SCHEMAS (per-document, from manual Section 3-12):**

**Passport (Tab C.4, APS 5):**
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
Skill: `passport-extractor` (vision pass, MRZ-aware). Quality gate: if expiration < 6 months from filing → flag.

**Articles of Organization (Tab D.1, APS 5):**
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

**Membership Interest Transfer Agreement (Tab D.5, APS 4 — drives THREE cover letter sections):**
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
Quality gate: consideration MUST equal investment total in I-129 E Supplement and Section IV of cover letter. Mismatch = severity 5.

**Bank Receipts confirming sale proceeds (Tab E.1.c, APS 5):**
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

**Currency Conversion Receipt (Tab E.2.a, APS 4):**
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
Quality gate: `source_amount × exchange_rate ≈ target_amount` (within 1%). Mismatch = severity 3.

**Tax Return (Tab G.6, APS 5):**
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
Quality gate: EIN must equal EIN on Articles, Operating Agreement, I-129. Mismatch = severity 5.

[FULL MANUAL CONTENT TRUNCATED HERE FOR BUNDLE LENGTH — receiving chat should request the full file or the user can paste it directly. Reference: `manuals/E2-MANUAL-FOR-CLAUDE-CODE.md`]

**Section 14 — AUTHORITY ALLOWLIST (verbatim — drafter must enforce):**

Hard-coded allowlist of authorities the drafter is permitted to cite:
- `INA § 101(a)(15)(E)(ii)` — present in 8 USC 1101(a)(15)(E)(ii)
- `8 CFR § 214.2(e)` — including subsections (1)–(23)
- `9 FAM 402.9-1` through `9 FAM 402.9-13`
- `Matter of Walsh and Pollard, Interim Decision #3111`
- `Matter of Ho, 22 I&N Dec. 206 (Assoc. Comm'r 1998)`
- `8 USC 1184(c)`

If the drafter wants to cite anything outside this list, halt and require attorney approval. **Never invent a case citation, never invent a FAM subsection.** Where a cited case or FAM cannot be verified, output `[CITE NEEDED — VERIFY: <draft cite>]` and route to attorney.

**Section 15 — QUALITY GATES (reviewer Phase 4):**

Before package goes to attorney:
- [ ] Every Tab populated; missing exhibits flagged
- [ ] Every required element has at least one APS ≥ 4 exhibit
- [ ] Source-of-funds chain has zero gaps > $10,000
- [ ] Currency conversion math reconciles (within ±1%)
- [ ] EIN consistent across Articles, tax return, I-129, payroll
- [ ] Investment amount consistent across Membership Transfer Agreement, I-129 E Supplement, cover letter Section IV
- [ ] Effective date consistent across Transfer Agreement, Member Resolution, cover letter
- [ ] Treaty-country combined ownership ≥ 50%
- [ ] All cited authorities are in allowlist (Section 14)
- [ ] All foreign-jurisdiction practices have defensive paragraphs inserted BEFORE their exhibit citations
- [ ] Anti-routine paragraph present in develop-and-direct section IF title combines executive + skilled-worker elements
- [ ] At-risk pre-emption sentence present
- [ ] All names in filing-bound text are ASCII transliterations
- [ ] Currency in ISO + commas + .00 throughout
- [ ] Every (Exhibit: …) citation in cover letter resolves to a real exhibit in the index
- [ ] Conflict register: no severity ≥ 4 unresolved
- [ ] Attorney sign-off captured

**Section 16 — MEMORY HOOKS (PII rules — CRITICAL for prompt design):**

Save to memory after case completion:
- `project_<case_id>_ownership_chain` — full ownership timeline
- `project_<case_id>_sof_chain` — SOF chain final (sanitized — NO account numbers, NO SSN)
- `project_<case_id>_filing_metadata` — receipt #, filing date, outcome
- `playbook_e2_defensive_<jurisdiction>` — any new defensive paragraph pattern (Tapu, TEFE/TUFE, spouse-lease, etc.)
- `voice_e2_<phrase_id>` — verbatim firm-voice phrases newly added to corpus

**DO NOT WRITE to memory:** account numbers, routing numbers, SSNs, passport numbers, full DOBs, full home addresses. PII strip BEFORE persistence.

---

## 3.2 Subtype 4 Manual (Essential Skills, calibrated to Camural)

> Source file: `manuals/MANUAL-SUBTYPE-4-Essential-Skills-Employee.md` (598 lines)
> Calibrated against: Camural / Pomega Energy filing (Feb 2024, 297 pages)
> Authority anchors: 8 CFR § 214.2(e)(18); 9 FAM 402.9-7(2)(b)

**Trigger signals (Phase-0 must detect):**
- "REQUESTED CLASSIFICATION: E2 — SPECIALIZED KNOWLEDGE" anywhere in cover
- Cover letter on Petitioner / corporate letterhead (not law firm)
- Cover letter signed by Petitioner officer (VP HR / COO), not attorney
- Job Offer Letter present in Tab B
- Beneficiary CV / Resume + Diploma + Certificates + Letters of Recommendation in Tab C
- Foreign + US entity corporate documents (treaty enterprise structure)
- Beneficiary salary stated with industry/peer comparison
- No I-539 dependent forms (or separately filed)

**Subtype-4 Tab structure (Akalan A–H pattern from Camural):**
- TAB A — TABLE OF CONTENTS AND COVER LETTER (combined)
- TAB B — FORMS (G-1145, G-28, I-129, I-129 E Supplement, G-1650 ACH × N, **Job Offer Letter**)
- TAB C — APPLICANT INFORMATION (Passport, US Visa + I-94, Resume/CV, Prior Work and Service Record, Diploma, Certificates, Letter(s) of Recommendation)
- TAB D — INTENT TO DEPART
- TAB E — NATIONALITY OF THE INVESTOR (treaty enterprise's owners ≥ 50%)
- TAB F — OWNERSHIP (foreign-entity + US-entity corporate docs, org charts of BOTH entities)
- TAB G — INVESTMENT (parent → subsidiary wire + recipient bank receipt + multi-period balance sheets)
- TAB H — REAL AND OPERATING (project/product catalogues, customer/offtake agreements, vendor capital invoices, lease, land purchase, payroll, P&L)

**Cover letter — Petitioner-corporate voice. Section structure (verbatim Camural):**
```
[Header: Petitioner letterhead, USCIS service center, RE block]
[Opening paragraph: parties, requested validity dates, beneficiary status, role title, brief bio]
[Petitioner intro paragraph: company structure, parent/subsidiary, industry, market position]

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

**Subtype-4 voice features:**
- Pronouns: corporate `we` / `our`
- Tone: professional but marketing-flavored
- Adjectives permitted: "engineering marvel", "ambitious undertaking", "industry-leading"
- Politicians / public figures permitted when independently verifiable
- Section heads: ALL CAPS, no Roman numerals
- Exhibit citations: inline `(Exhibit: <Title>)` parenthetical, integrated into prose
- Currency: always with comma + .00 (`$4,000,000.00` or `TRY 140,000.00`)
- Letter-of-recommendation excerpts: italicized direct quote with author attribution
- Defensive paragraph: skills not US-available — required per 8 CFR § 214.2(e)(18)
- Defensive paragraph: time-limited essentiality framing (when applicable)

**NEW skills required for Subtype 4:**
- `job-offer-extractor`
- `service-record-extractor` (foreign government / employer issued, with salary differential)
- `credential-extractor` (Diploma + Certificates)
- `recommendation-letter-extractor` (with verbatim quote capture)
- `foreign-corporate-doc-extractor` (Articles, board resolutions, share register, public-listing docs)
- `wire-confirmation-extractor` (corporate variant, no FX gate when both sides USD)
- `financial-statement-extractor`
- `project-catalog-extractor`
- `customer-contract-extractor` (offtake / supply / MSA)
- `real-estate-purchase-extractor`

**Job Offer Letter schema:**
```json
{
  "petitioner_legal_name": "<>",
  "officer_name": "<>",
  "officer_title": "<>",
  "beneficiary_name_ascii": "<>",
  "role_title": "<>",
  "reports_to_title": "<>",
  "base_salary_usd": <number>,
  "bonus_terms": "<verbatim>",
  "benefits": ["401k", "health", "dental", "vision", "life"],
  "start_date": "<YYYY-MM-DD>",
  "validity_or_offer_expiry": "<>",
  "signed_date": "<>"
}
```
Quality gate: `base_salary_usd` must equal salary in cover letter "BENEFICIARY'S EMPLOYMENT HISTORY AND QUALIFICATIONS" section. Mismatch = severity 4.

**Service Record (foreign salary differential proof) schema:**
```json
{
  "issuer_authority": "<e.g., SGK Service Record / Employer HR>",
  "issuer_country": "<>",
  "beneficiary_name_ascii": "<>",
  "employer_history": [{"employer":"<>","start":"<>","end":"<>","most_recent_salary":{"amount":<>,"currency":"<ISO>","frequency":"monthly|annual"}}],
  "country_average_salary_for_role": {"amount":<>,"currency":"<>","source":"<>"},
  "salary_differential_multiple": <number>
}
```

**Letter of Recommendation schema:**
```json
{
  "author_full_name": "<>",
  "author_title": "<>",
  "author_employer": "<>",
  "author_relationship_to_beneficiary": "<former_manager|peer|customer|other>",
  "letter_date": "<YYYY-MM-DD>",
  "endorsement_quote_verbatim": "<>",
  "specific_achievements_cited": ["<>"]
}
```
Drafter use: strongest verbatim quote inserted into "BENEFICIARY'S EMPLOYMENT HISTORY AND QUALIFICATIONS" section, italicized, with author attribution.

**Customer / Offtake Agreement schema:**
```json
{
  "customer_legal_name": "<>",
  "agreement_type": "<offtake|supply|MSA|other>",
  "total_value_usd": <>,
  "term_years": <>,
  "quantity_committed": "<e.g., 7.5 GWh>",
  "pricing_basis": "<fixed|active_market|cost_plus>",
  "execution_date": "<YYYY-MM-DD>",
  "key_terms_verbatim": "<>"
}
```

**Specialized-knowledge proof matrix (drafter must populate every cell):**

| Factor (9 FAM 402.9-7(2)(b)) | Source documents | Extracted via |
|---|---|---|
| Degree of proven expertise | CV + Diploma + Certificates + LoR | cv-extractor + credential-extractor + recommendation-letter-extractor |
| Whether others possess the skill | LoR + Industry context paragraph | recommendation-letter-extractor + drafter |
| Length of experience | CV + Service Record | cv-extractor + service-record-extractor |
| Training period to perform duties | CV + Job Offer Letter | cv-extractor + job-offer-extractor |
| Skill's relationship to processes | Job Offer + Catalogue + CV alignment | drafter narrative |
| Salary qualifications command | Service Record + Job Offer + industry benchmark | service-record-extractor + job-offer-extractor |
| Skills not readily available in US | Drafter narrative — must explicitly assert | drafter |
| Foreign-language-and-culture insufficient | (Negative — must NOT rest case on language alone) | drafter compliance check |

**Time-limited essentiality framing:**
- Plant build-out + employee training of US workforce: "essential during construction and ramp-up phase" → 2 years (typical Camural)
- New product launch / quality control: "essential through commercial-scale production" → 2-3 years
- Long-term ongoing role: "durable expertise unique to enterprise's specific processes" → up to 5 years

**Subtype 4 authority allowlist** (DO NOT cite Walsh & Pollard or Matter of Ho — those are investor-substantiality cases):
- INA § 101(a)(15)(E)(ii)
- 8 CFR § 214.2(e)(17) — distinguishes exec/supervisory from essential-skills
- 8 CFR § 214.2(e)(18) — essential skills (PRIMARY)
- 9 FAM 402.9-3, -4(A), -4(B), -4(F)
- 9 FAM 402.9-7(2) — employees of treaty enterprise (general)
- 9 FAM 402.9-7(2)(b) — essential skills (PRIMARY)

**Subtype 4 Quality Gates (Phase-4 reviewer):**
- [ ] Petitioner letterhead (NOT firm) on cover letter
- [ ] Cover letter signed by Petitioner officer
- [ ] Beneficiary nationality matches qualifying nationality of enterprise
- [ ] Treaty-country combined ownership ≥ 50%
- [ ] Job Offer Letter present and consistent with cover letter role + salary
- [ ] CV documents ≥ 5 years relevant industry experience
- [ ] Service Record shows salary differential vs domestic peers
- [ ] Diploma + at least one Certificate or LoR
- [ ] LoR is from senior third-party
- [ ] Defensive paragraph "skills not readily available in U.S." present
- [ ] If start-up/training role: time-limited essentiality framed
- [ ] No language-alone reliance in specialized-knowledge argument
- [ ] Investment chain: parent → subsidiary wire confirmed by both banks
- [ ] Balance sheets show progression of deployment
- [ ] At least one customer offtake / supply agreement OR strong revenue trajectory

**Camural worked example (regression-test fixture):**
- Beneficiary: Onur Camural (Turkish national)
- Petitioner: Pomega Energy Storage Technologies Inc. (Delaware, formed 2023-02-17)
- Treaty-country ownership: ~92% Turkish (Kontrolmatik TR 50% + Pomega TR 10% + Kontrolmatik US 7% + 5 individual TR shareholders 32%); German shareholder 1% (does NOT defeat ≥ 50%)
- Investment: $4,000,000 single wire (Pomega Turkey, 2023-02-28)
- Wire route: Vakifbank USD account ending 068 → Citibank account ending 457
- Capital deployment: $2.55M by 2023-06-30; $7.39M fixed assets by 2023-12-31
- Real-property: 307 acres in Colleton County, SC for power plant
- Customer commitment: $1B / 7.5 GWh / 5 years with POWIN
- Capital equipment: $1,381,200 from JS Machine (Istanbul)
- Operating personnel: 15 (14 W-2 / 1 1099); 12 executives/managers
- Beneficiary role: Medium Voltage Sales Specialist (reports to VP Business Development)
- Beneficiary qualifications: Kocaeli Univ. Electrical Eng. (2005); 10+ years at Honeywell, OZ-GE, OKSIM, BEST, SIEMENS Energy Turkey
- Geographic coverage: UK, Nordic, Baltic, Italy, KSA, Iraq, Lebanon, Libya, Egypt, Pakistan, Bangladesh, Afghanistan
- Quantified achievement: doubled annual sales target at SIEMENS Energy Turkey in 2022
- Salary differential: TRY 140,000/mo at SIEMENS vs TRY 45,000 Turkish average — 3.1× peers
- US compensation: $80,580 base + bonus + 401K + health/dental/vision/life
- LoR author: Elif Merve Seval, Head of Grid Technology Sales Business Unit, Siemens
- LoR quote: "He is a diligent worker and a very capable salesman… Sales requires a natural skill in dealing with people and knowing the right thing to say, and this was perhaps where Onur set himself apart the most."
- Validity requested: 2024-03-15 → 2026-03-15 (2 years)

---

## 3.3 Cover Letter Template (firm voice, Subtype 1)

> Source file: `manuals/01-COVER-LETTER-TEMPLATE.md` (372 lines)

**Structure (Roman-numeral sections, ALL CAPS heads, mirror Tab letters):**

I. INTRODUCTION
II. QUALIFICATION UNDER A TREATY OF COMMERCE AND NAVIGATION (Tab C)
III. OWNERSHIP STRUCTURE AND CORPORATE HISTORY (Tab D)
IV. THE INVESTMENT: SOURCE, TRANSFER, AND AT-RISK COMMITMENT OF FUNDS (Tab E)
   A. Lawful Source and Traceability of Funds
   B. Transfer Mechanism
   C. Additional Lawful Income Sources
   D. International Transfer and Deployment
V. SUBSTANTIALITY OF THE INVESTMENT (Tab F)
VI. MARGINALITY AND ONGOING COMMERCIAL ACTIVITY (Tab G — combines E3 + E4)
VII. ROLE OF THE BENEFICIARY: DEVELOPING AND DIRECTING THE ENTERPRISE (Tab H)
VIII. CONCLUSION

**Voice rules (every section):**
- Defined terms: "the Beneficiary" / "the Petitioner" — never first name, never "Applicant", never "Investor" alone
- Currency: ISO code + commas + .00 always (e.g., `TRY 4,000,000.00`, `$120,000.00`)
- Inline exhibit cites: `(Exhibit: <Title> dated <Date>)` — never footnotes
- Each section ends with: "Accordingly, [element] is satisfied under INA §… and 9 FAM 402.9-…"
- Authority cites: INA + 9 FAM cited together (not one or the other)
- Tone: formal, third-person, no first person, no rhetorical questions
- Numbers: written numerals for amounts; "fifty percent (50%)" for percentages

**Cultural / legal context insertion** (defensive drafting): when an exhibit reflects foreign-jurisdiction practice unfamiliar to USCIS, insert the cultural/legal explanation BEFORE the exhibit citation. Example pattern (real Akalan):

> "Under [Treaty Country] law and customary practice, real property transfers are effected directly through the [official body], and a separate written sales contract is not issued in standard title deed transfers. Accordingly, the lawful sale of the Beneficiary's real property is evidenced through the official title deed records. (Exhibit: …)"

**Section IV-B mandatory at-risk pre-emption sentence:**

> "No portion of the investment derives from unsecured loans, loans collateralized by the assets of the U.S. enterprise, or any other impermissible financing mechanism."

**Section IV-B at-risk language (mandatory):**

> "Once transferred, the invested capital became fully subject to the fortunes of the enterprise and exposed to the possibility of partial or total loss in the event that the business does not succeed. There is no guarantee of return, no redemption mechanism, and no protection of principal independent of the company's performance. Accordingly, the investment is irrevocably committed and satisfies the 'at-risk' requirement set forth under 9 FAM 402.9-6(B)."

---

## 3.4 Voice Corpus from Kacar-Salih (firm voice samples)

> Source file: `manuals/_VOICE-CORPUS-from-Kacar-Salih.md` (183 lines)

**Verbatim phrases from real filing (use as few-shot examples in drafter prompt):**

Section openings:
> "The Beneficiary has committed to a total investment of $120,000.00, of which $80,000 has already been irrevocably placed at risk and which derives from lawful sources in Turkey…"

Element-satisfaction wrap-up:
> "Accordingly, the Petitioner is properly and lawfully structured to support E-2 Treaty Investor classification."
> "establishes the requisite degree of control and authority required under INA §101(a)(15)(E) and 9 FAM 402.9 for an investor seeking admission to develop and direct a qualifying enterprise."

Source-of-funds narration (Tapu defensive paragraph):
> "Under Turkish law and customary practice, real property transfers are effected directly through the Land Registry Office (Tapu Mudurlugu), and a separate written sales contract is not issued in standard title deed transfers. Accordingly, the lawful sale of the Beneficiary's real property is evidenced through the official title deed records."

Wire-transfer narration pattern (date → amount → counterparty → account):
> "The initial transfer of TRY 30,000.00 was made on October 15, 2025. The remaining portion of the deposit TRY 40,000.00 was made by the buyer, Feyzullah Guler on October 18, 2025. On the sale day, November 24, 2025 the amount of TRY 2,900,000.00, TRY 1,000,000.00, and TRY 30,000.00, all credited to the same personal account of Mr. Kacar by the buyer Feyzullah Guler."

Inline exhibit citation format:
```
(Exhibit: Membership Interest Transfer Agreement dated December 5, 2025 — Ozlem Demir to Salih Kacar)
(Exhibit: Prior Turkish Title Deed dated January 25, 2013)
(Exhibit: Is Bank Receipts confirming that the Beneficiary received TRY 4,000,000.00 from the sale of his house)
```

Pattern: `(Exhibit: [Title] [dated DATE] [— short qualifier])` — embedded inside narrative, NOT footnoted.

**Letterhead (every page):**
```
490 Route 304, Suite 3
New City, NY 10956                              18 W. 33rd Street, 2nd Floor
Yasin Bilgehan Akalan, Esq.                     New York, NY 10001
   New York Bar
Huseyin Emre Eney, Esq.
   New York Bar
AKALAN BUSINESS IMMIGRATION, PLLC
Main Phone: (212) 542-3939   Fax: (332) 230-0747   Email: info@akalanlaw.com
```

---

## 3.5 Case File Structure (Akalan Tab convention)

> Source file: `manuals/02-CASE-FILE-STRUCTURE.md` (211 lines)

```
<CaseID>_<BeneficiarySurname_ASCII>_E2_<New|Renewal|COS>/
│
├── TAB-A_Forms/
├── TAB-B_Cover-Letter/
├── TAB-C_Treaty-Qualification/                  ← Element 1 (Nationality)
├── TAB-D_Ownership-Corporate-History/           ← Element 1 (50%) + corporate
├── TAB-E_Investment-Source-Transfer-AtRisk/     ← Element 2 + SOF
│   ├── 01_Source-Origin/
│   ├── 02_Transfer/
│   ├── 03_AtRisk-Commitment/
│   └── _Source-of-Funds-Memo.pdf                ← internal, fed to cover letter
├── TAB-F_Substantiality/                        ← Element 2 proportionality
├── TAB-G_Marginality-Commercial-Activity/       ← Elements 3 + 4
├── TAB-H_Develop-and-Direct/                    ← Element 5
├── TAB-I_NOID-Principal/                        ← Nonimmigrant intent
├── TAB-J_Forms-Dependents/
├── TAB-K_NOID-Dependents/
└── TAB-L_Dependent-Biographic-Info/
```

**File-naming rules:**
- ASCII filenames (Caglar, not Çağlar)
- Sentence case + dashes (no spaces)
- `<NN>_<doc>` prefix per tab
- Original date in filename when material (e.g., `Title-Deed-2013-01-25.pdf`)
- `-FINAL` suffix on filed copies
- `_underscore-prefix` for non-filed folders

**New vs. Renewal differences:**
- Tab C — New: no prior E-2 visa. Renewal: include prior E-2 visa + payroll records of prior E-2 employment
- Tab D — New: initial corporate setup is the focus. Renewal: include prior + current corporate history
- Tab E — New: source + transfer + initial at-risk. Renewal: plus continued at-risk commitment
- Tab G — New: often relies on 5-year projections. Renewal: includes actual operating history (P&L, tax returns)
- Tab H — New: develop & direct is prospective. Renewal: includes prior E-2 employment history demonstrating develop & direct

---

## 3.6 Exhibit Index Template (with APS scoring)

> Source file: `manuals/03-EXHIBIT-INDEX-TEMPLATE.md` (280 lines)

**APS Scoring Key (Probative × Independence × Corroboration, 1–5):**
- 5: Court / government / audited; independent; fully corroborated (Title deed, IRS CP-575, Articles)
- 4: Third-party institutional; independent; corroborated (Bank statement, lease, payroll provider)
- 3: Self-prepared but supported by third-party data (Business plan with industry data, balance sheet)
- 2: Self-declared, partial corroboration (Affidavit with supporting receipts)
- 1: Self-declared, no corroboration (Bare assertion — RFE bait)

**Filing rule:** Element-critical evidence must hit APS ≥ 4. Anything APS ≤ 2 must be supplemented or removed.

**Source-of-funds chain check (mandatory for Subtype 1):**

| Step | What | Amount | Date | Exhibit | Gap? |
|------|------|--------|------|---------|------|
| 1 | Origin (sale / rental / gift / loan) | <> | <> | E.1.x | <Y/N> |
| 2 | Receipt in personal account (TC) | <> | <> | E.1.x | <> |
| 3 | Currency conversion to USD | <> | <> | E.2.a | <> |
| 4 | International wire to US | <> | <> | E.2.b | <> |
| 5 | Deployment to Petitioner | <> | <> | E.2.c / E.3.a | <> |

**Gap rule:** any unexplained `>$10,000` movement = ESCALATE to attorney.

**Element coverage check:**

| Element | Tab(s) | # of Exhibits | Highest APS | Coverage Status |
|---------|--------|--------------|-------------|-----------------|
| 1 — Treaty Country Nationality | C, D | <> | <> | <OK / WEAK / MISSING> |
| 2 — Substantial Investment | E, F | <> | <> | <> |
| 3 — Real & Operating Enterprise | G | <> | <> | <> |
| 4 — More than Marginal | G | <> | <> | <> |
| 5 — Develop & Direct | H | <> | <> | <> |
| Source of Funds (chain integrity) | E | <> | <> | <> |

Rule: any row reading `WEAK` or `MISSING` → escalate to attorney before drafting.

---

# PART 4 — NEW RESEARCH (2026-04-28)

## 4.1 Consular Filing Path (citation-anchored)

> Source file: `research/2026-04-28_e2-consular-filing.md` (319 lines)
> Fills the I-129-vs-consular gap in the existing renewal-calibrated manual.

**Key findings:**

**1. DS-160 (Online Nonimmigrant Visa Application)** — universal NIV electronic application; every E-1, E-2, E-2S spouse, and E-2D child applicant files their own. CEAC-hosted. Confirmation page barcode (CEAC ID) taken to interview.

E-2-specific fields commonly fumbled:
- "Purpose of Trip" / Visa Class — must select precise sub-class: `E1 - TREATY TRADER`, `E2 - TREATY INVESTOR`, `E2 - EXEC/MGR/ESSENTIAL EMP`, `E2 - CHILD OF TREATY INVESTOR`, `E2 - SPOUSE OF TREATY INVESTOR`
- Prior visa number for renewals — transposed digits = documented 221(g) trigger
- Present/Previous Employer block — salary, title, address, dates must reconcile with DS-156E Part III and any I-129 record
- Prior refusal disclosure — false "No" answers are #1 cited DS-160 defect
- Unlawful presence question — common 2025 221(g) source

2025-26 DS-160 updates:
- Public-social-media requirement effective 18 June 2025 (F/M/J), expansion to H-1B/H-4 effective 15 Dec 2025. E-category NOT YET in public-profile mandate (verify before client-facing use).
- In-person rule effective 2 September 2025 — all NIV applicants regardless of age must appear in person; under-14 / over-79 exemption gone. Applies fully to E-2D children.
- "Visa Integrity Fee" $250 enacted 4 July 2025, charged at issuance, NOT YET OPERATIONAL at posts as of late March 2026 (verify).

**2. DS-156E (Treaty Trader/Investor Application)** — OMB Control Number 1405-0101, current OMB approval expires 30 April 2026, latest 30-day FR notice 28 Aug 2024.

**Who must file DS-156E (CRITICAL — most-missed piece):**
- **Required:** All E-1 treaty trader applicants (Parts I, II, III). E-2 Executive / Manager / Essential Employee applicants (Parts I, II, III) — Parts I and II by qualifying U.S. enterprise, Part III by each individual employee.
- **NOT required:** **Principal E-2 investors** applying as owner of enterprise (DOS treats substantive showing as built into consular package + DS-160 + supporting binder, not separate DS-156E). **All E-1 / E-2 derivatives** (spouse, children under 21).

> Practical note: Parts I and II can be re-used across multiple essential-employee applicants over a 5-year window if no material change has occurred and the enterprise is registered with the post's E-Visa Unit (only Part III re-filed per applicant).

**DS-156E Part I (Petitioner/Employer)** — signed by authorized officer of US enterprise:
- Legal name, d/b/a, US address, FEIN, date and state of incorporation
- Type of business (NAICS-style)
- Treaty country of nationality of enterprise
- Names and nationalities of owners holding ≥ 50%

**DS-156E Part II (Investment/Trade/Staffing)** — signed by same enterprise officer:
- Total amount invested + breakdown by category (real property, equipment, inventory, working capital, lease deposits, fees, etc.)
- Source of investment funds + at-risk attestation
- Annual gross/net income, US-source revenue
- Total US employees by category (US workers, treaty-country in E status, principal investor; essential vs ordinarily skilled)
- Future hiring plan (5-year horizon)

**DS-156E Part III (Applicant/Employee)** — signed by individual applicant:
- Position title, salary, duration sought, % time supervisory vs hands-on
- Education, prior experience, language skills, why role is "essential"
- Prior US status / prior E visas

**3. Pre-interview document package — "interview binder":**

Tabbed binder structure (post-published, multi-post):
- Section A — Cover Letter (legal memorandum) + Table of Contents
- Section B — Forms: DS-160 confirmation; DS-156E Parts I, II, III; MRV fee receipt
- Section C — Applicant-personal: passport bio page, prior visas, photos, CV, diplomas, marriage/birth certificates for derivatives
- Section D — Treaty nationality of business: ownership chart, share certificates / cap table, passports of ≥ 50% owners
- Section E — Real & Operating: articles, certificate of good standing, business licenses, lease, utility bills
- Section F — Substantial investment: SOF tracing, wire receipts, escrow / closing statements, equipment invoices, cap-ex ledger
- Section G — Not marginal: business plan, current P&L, payroll, tax returns
- Section H — Develop & Direct (principal) OR Essential / Executive role (employee)
- Section I — Intent to depart / non-immigrant intent: statement of intent, foreign ties evidence

Order consular officers actually consume:
1. Cover letter — first 2 pages skimmed
2. DS-156E Part II — substantiality table
3. Source-of-funds tab — they pull random wires and ask "where did this come from"
4. Treaty-nationality proof — ownership chart
5. Business plan first page + financial projections summary
6. Everything else only on follow-up

Consular legal memorandum (the consular analog of I-129 cover letter):
- 8-15 pages, addressed `Dear Consular Officer`
- Element-by-element walk-through of 9 FAM 402.9-3 through -7
- For each element, parenthetical pinpoint to exact tab letter and exhibit number ("see Tab F-3, wire receipt of 12 Mar 2025")
- Closing paragraph stating unequivocal intent to depart — consular standard differs from USCIS in litigating nonimmigrant intent more closely

**4. Photograph specs (DOS):**
- Square 2 × 2 inches (51 × 51 mm); digital 600 × 600 px JPEG ≤ 240 kB
- Head size: 1 to 1 ⅜ inches (22-35 mm) chin to top, OR 50%-69% of total image height
- Plain white or off-white background
- Within last 6 months
- No eyeglasses (since 1 Nov 2016)
- No headwear (unless religious daily wear)

**5. MRV fees (FY2026):**
- E-1 / E-2 MRV: $315.00 per applicant
- Visa Integrity Fee: $250 (signed into law 4 Jul 2025; NOT YET OPERATIONAL at posts as of late March 2026)
- MRV is non-refundable, non-transferable; valid 365 days from payment for scheduling
- Reciprocity issuance fee: separate; per DOS reciprocity table per country

**6. Visa stamp annotations:**

| Annotation | Meaning |
|---|---|
| `E-2 PRIN` (or `PRINCIPAL`) | Principal treaty investor |
| `E-2 EMPL OF [COMPANY], EXP [date]` | Executive / Manager / Essential Employee — must name qualifying enterprise + tie-back date |
| `E-2D SP, [PRINCIPAL NAME]` | E-2 dependent spouse |
| `E-2D CH, [PRINCIPAL NAME]` | E-2 dependent child |

**I-94 issuance and 2-year admission rule:**
- E-2 admissions are **2 years per entry** under 8 CFR 214.2(e)(20), regardless of how many years the visa foil itself is valid. Re-entering on a 5-year visa resets the 2-year I-94 each time.
- I-94 generated electronically at POE; CBP issues paper I-94 only at land borders. Always retrieve at i94.cbp.dhs.gov.

**E-2S spouse work authorization** (post-Nov 2021 / Jan 2022):
- USCIS / CBP began issuing I-94s with `E-2S` Class of Admission for E-2 spouses on 30-31 January 2022
- An unexpired `E-2S` I-94 is work authorization incident to status — accepted as List C document for Form I-9
- E-2 children remain `E-2D` (no work authorization)

Common POE issues:
- CBP officer admits spouse with `E-2` instead of `E-2S` — request deferred-inspection appointment to correct
- I-94 expiration set to passport expiration (lesser-of-passport rule) when passport has < 2 years validity — common for Turkish, Pakistani applicants

**7. 221(g) E-2-specific triggers (2025-26):**
1. Source-of-funds gap (third-party wire without gift letter / board resolution)
2. Substantiality near floor (under ~$100K with thin business plan)
3. Speculative / not-yet-operational enterprise (pre-revenue, no employees, lease only signed)
4. Marginality concern (single-investor consulting LLC, no projected hires, modest profit)
5. Treaty nationality unclear (multi-tier holding with non-treaty intermediate parent)
6. Prior visa file inconsistency (DS-160 / DS-156E / I-129 record divergence)
7. Security checks (SAO triggered by name, dual-use technology business, country of birth)
8. Social-media flag (2025+)

**8. Mock interview question list (E-2 specific):**

Business questions (most weight):
- "Tell me about your business in 30 seconds."
- "What does your company do, who are your customers, how do you make money?"
- "How many U.S. employees do you have today, and what's your hiring plan for the next 2 years?"
- "What's the address of your office? Walk me through what's there."

Investment / source of funds:
- "How much have you invested, and on what?"
- "Where did the money come from? Walk me through each wire."
- "Are these funds at risk if the business fails?"
- "Was any of the investment financed? By whom, and is it secured by your personal assets?"

Role:
- "What is your title? What do you do day to day?"
- "Who reports to you? Who do you report to?"
- (Essential employee) "Why can't a U.S. worker do this job?"

Intent to depart:
- "What will you do when your E-2 ends?"
- "Do you have a home / family / business interests in [home country]?"

Treaty nationality:
- "Who owns the company? Are they citizens of [treaty country]?"

Model answer structure (short → specific → tab-pointer):
> "I have invested $325,000 since opening, primarily in equipment and three months of working capital. The funds came from the sale of my Istanbul apartment in March 2025; the closing statement and the wire to our U.S. business account are in Tab F-2 if you'd like to see them."

Avoid: monologue, jargon, hedging, memorized scripts.

---

## 4.2 Per-Consulate Idiosyncrasies (top E-2 posts 2025-26)

> Source file: `research/2026-04-28_e2-consular-posts.md` (344 lines)

**Headline finding:** A single Akalan E-2 template will NOT survive cross-post deployment — manual needs per-post format adapters.

**1. U.S. Consulate General Istanbul, Türkiye (firm priority post):**
- Reciprocity: 60 months, multiple entries, no fee
- Treaty since 1954; CBI Turkish nationality requires 3-year domicile wait per AMIGOS Act
- All Türkiye E-2 packages → `EVisasIstanbul@state.gov` (even Ankara interviews)
- Most Turkish principals interview Istanbul; Ankara is overflow
- Booking: `ais.usvisa-info.com/en-tr/niv`
- Wait time (Dec 2025): visitor 100-180 days; work/student 30-75 days
- Pre-submission required before interview scheduling
- **Interview language:** English / Turkish / Farsi / Arabic. Other languages need sworn translator certified by Turkish Notary Public + 48-hour pre-clearance email to consulate (this is the most concrete Mission-Türkiye procedural detail)
- Local docs expected: Ticaret Sicil Gazetesi, Vergi Levhası, Vergi Kimlik Numarası, apostilled bank statements, Tapu (real estate)
- Dual-nationality: Turkish passport must be the qualifying one even if applicant holds Schengen passport
- No Istanbul-specific 221(g) statistics public; AILA Türkiye chapter for outreach

**2. U.S. Embassy Tokyo + Consulate Naha (Japan) — #1 E-2 country (15,367 / 30.1% FY2025):**
- 5-year validity reciprocity
- Adjudicating posts: Tokyo (Embassy), Osaka-Kobe, Naha (Okinawa), Sapporo / Fukuoka sub-references
- **Tokyo "Tab" convention:** Sub-folders named Tab 1 – Tab 5. PDF, portrait orientation, type-written English
- Tab 1 (DS-160 confirmation, DS-156E Parts I/II/III, company qualification letter, org chart) does NOT count toward 70-page / 50 MB cap
- Adjudication: 6-8 weeks
- Mail-in (interview-waiver) procedures changed Aug 25, 2025
- Dedicated E-unit; interviews historically short (~10 min) when file clean
- Local docs: 登記事項証明書 (tōki jikō shōmeisho — corporate registry), 印鑑証明書 (inkan shōmeisho — registered seal), 戸籍 (koseki — family register)

**3. U.S. Consulate General Frankfurt, Germany:**
- 5 years (60 months), no fee
- FY2025: 3,271 (down 24% from FY2016)
- ONLY E-visa post in Germany. Hosts dedicated E-Visa Unit
- Inquiries: `frankfurtvisainquiries@state.gov`
- **Maximum 90 pages** in package (older 2015 guidance — staleness flag, confirm)
- Proportionality test applied for substantiality
- Local docs: Handelsregister (commercial register), Gewerbeanmeldung (business registration with Gewerbeamt)
- 2 weeks-4 months initial review; 2-6 months total

**4. U.S. Embassy Paris, France:**
- France E-1/E-2 validity: extended 25 → 48 months in 2024 (passeport-talent equivalency)
- I-94 still 2 years per entry
- **"Tab A-G + 50 page" convention:** PDF format, single file ≤ 10 MB. Lettered tabs (A, B, C…). Tab A = DS-160 + photo; Tab B = passport bio + family civil docs; body capped at 50 pages (Tabs A-C and G-28 excluded)
- **Uniquely Paris:** application documents uploaded through `usvisaappt.com` user account at interview-appointment request — most other E-posts use email
- Local docs: K-bis (Extrait K-bis — French commercial register), acte de naissance, livret de famille

**5. U.S. Embassy London, UK:**
- Up to 60 months; first-time UK applicants frequently get 36 months
- FY2025: 2,140 (down 28% from FY2016)
- **MAJOR 2025 SHIFT — no dedicated E-visa officer.** Rotating pool of ~14 consular officers; 2/day on E-cases. Drives inconsistent adjudications
- Interviews now last up to 30 minutes, detailed probing; held alongside visa-control-unit cases (criminal/inadmissibility)
- **Rising INA 214(b) refusals — "why can't an American do this job?"** scrutiny — single most important practitioner signal in 2025-26 dataset
- Submission: `LondonNIV-E@state.gov`
- Local docs: Companies House, HMRC corporation tax returns

**6. U.S. Consulate General Toronto, Canada:**
- 60 months, no fee
- FY2025: 6,779 — second-largest after Japan
- All Canadian E-2 first-time and registration → Toronto by email to `evisacanada@state.gov`. Canadians don't file I-129 first — direct-to-consulate
- **Strict 70-page cap** — forces aggressive curation
- Company registration valid 5 years
- Dedicated E-unit with E-only days
- Interview appointments 1.5-2 months after submission
- End-to-end: 3-5 months
- Sept 6, 2025 DOS guidance: applicants should apply in country of residence/nationality (affects Canadian PRs who third-countried)
- Local docs: Articles of Incorporation, Notice of Articles, CRA business-number registration, T2 Corporation Income Tax Returns

**7. U.S. Embassy Seoul, South Korea:**
- 5 years
- Treaty since November 7, 1957
- FY2025: 5,359 — third-largest
- All E-2 packages → `SeoulNIVEVisa@state.gov`. Dedicated E-unit
- **MAJOR 2025 — Korean Investment & Travel Desk:** Dec 5, 2025 formally launched one-stop fast-track for Samsung, LG, Hyundai, SK, Hanwha + partners (in response to Sept 4, 2025 ICE raid at Hyundai-LG Georgia battery plant — ~300 Korean workers detained). Pilot started October 2025

**8. U.S. Embassy Madrid, Spain:**
- 5 years, no fee
- All Spain E-2s → `evisasmadrid@state.gov`
- **Uniquely category-stratified:** N (new), ROI (renewal), R (registration), A (additional employee). Each has its own format PDF
- Two PDFs: (1) DS-156E only, (2) supporting documents
- **Page limit: 30 pages** (excluding G-28 and tab dividers) — TIGHTEST cap among E-posts
- Three application options after DS-160 + fee
- Embassy target: 90 business days end-to-end
- Five-year business plan explicitly required for new E-2

**9. U.S. Embassy Rome, Italy:**
- Up to 5 years, multiple entries, no fee
- FY2025: 1,241 (down 40% from FY2016 — steepest decline among major Western European)
- Rome only E-2 post in Italy. Submission: `RomeEvisas@state.gov`
- ~120 days adjudication (4 months) 2025-26
- Local docs: Visura Camerale (Camera di Commercio extract), Codice Fiscale, Atto Costitutivo + Statuto

**Cross-cutting 2025-26 patterns:**
1. **Sept 2, 2025 interview-waiver narrowing** is the single biggest cross-post change — most E-class renewals now require in-person interview
2. **Dedicated E-unit vs rotating-officer model bifurcation:** Tokyo, Frankfurt, Toronto, Seoul, Rome run dedicated E-units. London EXPLICITLY DOES NOT — practitioners report 30-min interviews and unexpected 214(b) refusals
3. **Page caps differ wildly:** Madrid 30, Toronto 70, Tokyo 70 (Tab 1 excluded), Paris 50 (Tabs A-C + G-28 excluded), Frankfurt 90 (stale 2015 guidance), Rome / Istanbul / London = data gap
4. **Format conventions are post-specific and non-portable:** Tokyo Tab 1-5, Paris Tab A-G, Madrid N/ROI/R/A category codes, Frankfurt E-Visa Unit routing
5. **2025 administrative-processing climate** — "why can't an American do this?" probing
6. **Submission portals diverge from email everywhere except Paris** (Paris uses usvisaappt.com)
7. **Interview-language flexibility differs by post** — Istanbul publicly offers English/Turkish/Farsi/Arabic with 48-hour translator pre-clearance

---

## 4.3 E-2 NEW (Initial) Filings

> Source file: `research/2026-04-28_e2-new-filing.md` (504 lines)
> Calibrates renewal-tuned manual for first-time / pre-launch filings

**Walsh & Pollard "in process of investing" doctrine** (Matter of Walsh and Pollard, 20 I&N Dec. 60 (BIA 1988), Interim Decision #3111):

Facts the BIA credited as qualifying:
- IAD Ltd. (UK automotive design) contracted by GM
- Created US subsidiary specifically to perform contract
- Concrete pre-revenue acts: rented office space; purchased office furniture; hired two US citizens; established corporate bank account funded with USD 15,000
- BIA held this satisfied "actively in the process of investing"
- Design engineers — though not in supervisory or managerial roles — qualified as essential employees

Holdings relevant to E-2 NEW:
1. NO fixed dollar minimum for E-2 substantiality — "amount normally considered necessary to establish a viable enterprise of the nature contemplated"
2. Either invested OR actively in process of investing — process prong is alive but requires more than intention
3. Lease + furniture + initial hires + funded operating account = qualifying acts even with no revenue

**9 FAM 402.9-6(B) "irrevocably committed" requirements:**
- "An investment conditioned upon the issuance of the E-2 visa MAY STILL QUALIFY if assets held in escrow"
- Funds must be (i) investor's possession, (ii) committed, (iii) at risk, (iv) possibility of partial or total loss
- **"Mere intent to invest, or possession of uncommitted funds in a bank account, is not enough"** — bright line

**At-risk hierarchy (2025-26 consular practice):**
```
SPENT  >  ESCROWED (denial-only release)  >  ESCROWED (general clawback)  >  LOI
```

- SPENT: cancelled checks, wires, paid invoices (strongest)
- ESCROW with denial-only clawback: acceptable per FAM if (a) names specific transaction, (b) restricts release to visa-issuance/admission, (c) restricts clawback to denial event
- ESCROW with "any-reason clawback": increasingly rejected as speculative
- LOI / unsigned PSA: generally insufficient

**Acceptable escrow language:**
> "Funds shall be released from escrow to Seller upon issuance of an E-2 visa to Buyer OR upon Buyer's admission to the United States in E-2 status, whichever first occurs. Funds shall be returned to Buyer ONLY IF an E-2 visa application filed within X days of this Agreement is denied by the U.S. Department of State, after exhaustion of any motion to reconsider. No other event triggers a refund."

**Unacceptable / risky:**
- "Buyer may rescind for any reason"
- "Refund upon failure to close for any cause"
- "Termination at Buyer's sole discretion"

**Pre-launch evidence package — what substitutes for "operating history":**

| Renewal exhibit | E-2 NEW substitute |
|---|---|
| 12+ months business bank statements | Petitioner operating account opened + initial deposits + first vendor outflows (≥ 3 months ideal, ≥ 1 month minimum) |
| Federal tax return (G.6, APS 5) | EIN assignment letter (CP-575) + state sales-tax/employer registration + partial-year P&L if < 12 months operating |
| Payroll records / W-2s (G.7) | Offer letters with start dates + payroll-provider contract (Gusto/ADP) + I-9-ready new-hire packet + hiring-timetable schedule |
| Photos of operating premises (G.1) | Photos of leased premises during build-out, dated, with progress (demo → rough-in → finish) + GC agreement + progress invoices |
| Vendor invoices (G.5) | One-time setup invoices: equipment POs, POS/merchant onboarding, insurance binder, opening inventory order |
| Merchant statements | Merchant-account application + approval letter (Stripe/Square/bank merchant) |

**Mandatory pre-launch exhibits:**
1. Articles of Organization / Incorporation
2. Operating Agreement naming Beneficiary in executive role from day one
3. EIN assignment letter (IRS CP-575)
4. Commercial lease, fully executed + paid security deposit + first month + prepaid CAM
5. Build-out contract or franchise development agreement with progress payments invoiced + paid + dated
6. Equipment POs + paid invoices + delivery proof
7. Insurance binder (general liability, property, workers' comp upon first hire)
8. State / local licensing applications and permits
9. Merchant account onboarding (signed application + approval)
10. Hiring file: at least one signed offer letter with concrete start date + payroll provider contract
11. Business plan (5-year, Matter-of-Ho-compliant)
12. Source-of-funds memo + chain table
13. Photographs (premises current state, dated, equipment in place)
14. Beneficiary CV + executive role appointment

**Recommended drafter posture:** "immediately capable of commencing operations upon Beneficiary's admission" — pair with citation to 9 FAM 402.9-6(D) (bona fide enterprise) and Walsh & Pollard's "in the process of investing" prong.

**Matter of Ho (5-year business plan standard) — Matter of Ho, 22 I&N Dec. 206 (Assoc. Comm'r 1998):**

Standard: "comprehensive, detailed, and credible." Required components (verbatim):
- Description of products/services
- Objectives
- Market analysis (named competing businesses + relative strengths/weaknesses, comparison of competition's products/pricing)
- Target market description
- Manufacturing/production processes, materials, supply sources
- Contracts executed for materials/distribution
- Marketing strategy (pricing, advertising, servicing)
- Organizational structure + personnel experience
- **Staffing timetable**
- **Job descriptions for all positions** (specifying which held by qualifying employees)
- **Sales, cost, and income projections + bases therefor**

Although Matter of Ho is EB-5, the standard is applied by analogy to E-2 NEW because the business plan plays the same evidentiary role.

**Ho-paper-plan failure patterns and defenses:**

| Failure pattern | What kills the plan | Defense |
|---|---|---|
| Hockey-stick revenue without footnoted assumptions | "Speculative" | Footnote each assumption to IBISWorld / BLS QCEW / FRED / Statista / FDD Item 19 with retrieval date |
| "Hire as needed" or "5 employees by Year 5" with no schedule | Marginality denial | Month-by-month staffing timetable Y1; quarterly Y2; annual Y3-5 |
| Stock industry ratios | Loss of credibility | Cite IBISWorld report number, FDD Item 19 if franchise, trade-association data |
| Identical FDD-replicated language for franchise plans | "Stock business plan" rejection | Customize with locale-specific demographics, drive-time analysis, named local competitors |
| No customer-acquisition cost model | Plan can't support revenue ramp | CAC × volume = marketing spend; tied to channel mix |
| Reliance on independent contractors / "1099 only" | 2026 marginality red flag | At least 3-5 W-2 hires by Y5; first within 12-18 months |
| No reinvestment line | Looks like personal-living plan | Show retained-earnings reinvestment — explicit cash-flow line |

**W-2 hiring timetable (2025-26 RFE language):**
- First W-2 hire within 12-18 months of operations
- 3-5 W-2 FTEs by Year 5 (more for capital-intensive industries)
- Each hire: title, FT/PT, anticipated wage band, month of hire, sourcing channel, prerequisite credentials

**Source-of-funds for E-2 NEW (additions to renewal Tab E discipline):**

Tier scaling:
- ≤ $100,000: heightened scrutiny — every dollar traced; smaller pool means less room for unexplained gaps
- $100,000 – $500,000: standard — full chain; ≥ 75-90% expected as proportion
- $500,000+: standard rigor on origin; proportionality threshold drops

**Cryptocurrency as source — required documentary chain (2025-26):**
1. Initial fiat purchase records (bank statement showing fiat → exchange)
2. Exchange KYC pack (onboarding KYC, ID verification, address, source-of-funds questionnaire submitted to exchange)
3. Full transaction logs (every trade, every hop — exchange CSV / API export)
4. Wallet-to-wallet blockchain IDs (block explorer screenshots tying transactions to named addresses)
5. Liquidation records (exchange records of crypto → fiat conversion immediately preceding deployment)
6. US bank-side ingestion records (wire from exchange/off-ramp → applicant's US bank → Petitioner)
7. Tax compliance (home-country and US tax return showing crypto reporting)

> "If this exhaustive ledger cannot be provided, the application will likely be denied."

**CBI (Citizenship-by-Investment) E-2 NEW — AMIGOS Act / NDAA FY 2023, P.L. 117-263 (signed Dec 23, 2022):**

Rule: An E-visa applicant who acquired treaty-country nationality by financial investment must have been domiciled in that treaty country for a continuous period of NOT LESS THAN THREE YEARS at any point before applying for an E-visa.

Carve-outs: Persons previously granted E-visa status are exempt. Persons who acquired treaty nationality by birth, marriage, or non-investment-based residency are not subject.

Designed to limit Grenada / Turkey CBI → E-2 fast-tracks.

**"Bona fide nationality" pack (CBI cases):**
1. Three-year continuous domicile (where AMIGOS applies) — utility bills, lease/title in treaty country, school enrollment, tax residence proof, employer payroll, immigration entry/exit stamps showing physical presence
2. Time held since naturalization — longer the gap, the better
3. Business activities since acquisition (bank account history, business registrations, real estate)
4. Treaty-country tax filings

**Anti-restrictive-franchise paragraph (drafter snippet):**

> "While the Petitioner operates as a franchisee under the Franchise Agreement enclosed herewith (Exhibit: …), the Beneficiary retains and exercises full executive control over those functions that constitute developing and directing the enterprise within the meaning of 9 FAM 402.9-7. Specifically, the Beneficiary determines and controls: local hiring and termination decisions; staff scheduling and supervision; local marketing budget allocation and execution; vendor and supplier relationships within the franchisor's approved-vendor framework; pricing within the franchisor's permitted bands; financial management and reinvestment decisions; and strategic local growth, including additional unit acquisition. The franchisor's brand-standards requirements pertain to product specifications, signage, and quality control — they do not divest the Beneficiary of executive authority over the enterprise's operations, finances, or workforce."

---

# PART 5 — SPECIFIC DELIVERABLES WANTED FROM THE OTHER CHAT

## What we want produced (in order of priority)

### A. PHASE-0 DETECTOR PROMPT (Haiku 4.5)

**Input:** 5-10 sampled pages from a case folder (text only, no images)
**Output:** JSON conforming to E2CaseSubtype type (see PART 2.2)
**Constraints:**
- Cache-friendly system prompt: heuristic table + few-shot examples in cached system; user message is just the sampled text
- Haiku-tier — keep tokens tight, no chain-of-thought
- Confidence labeling: HIGH (3+ strong signals align), MED (1-2 strong + several weak), LOW (only weak signals — route to attorney)
- Detection signals returned verbatim from input

**Few-shot examples needed:** 2 for each subtype (1, 2, 3, 4) covering each procedural posture (consular_new, consular_renewal, uscis_cos_new, uscis_extension). Total: 16 examples.

### B. PHASE-1 EXTRACTOR PROMPTS (Sonnet 4.6)

**One prompt per document type.** ~22 documents in the registry (see Section 13 of main manual + Subtype 4 additions). Each:
- System prompt cached (the schema + extraction rules + provenance discipline)
- User prompt = single document text + page mapping
- Output = `tool_use` strict JSON matching the schema in the manuals
- Provenance discipline: every field carries `{value, source_page, source_quote, confidence}`
- Quality gates evaluated in extractor (e.g., currency conversion math reconciles within 1%)
- PII strip: account/routing/SSN/passport numbers truncated to last4 in extracted output

**Priority documents (build first):**
1. passport — vision, MRZ-aware
2. membership_interest_transfer_agreement — drives 3 cover-letter sections
3. bank_receipt + bank_statement — table extraction, TC-side and US-side variants
4. currency_conversion_receipt — math reconciliation gate
5. wire_confirmation — SWIFT MT103, individual + corporate variants
6. tax_return — 1120/1120S/1065/Schedule C
7. vital_records — birth/marriage cert + certified translation
8. operating_agreement / articles_of_organization
9. payroll
10. business_plan
11. job_offer_letter (Subtype 4)
12. recommendation_letter (Subtype 4 with verbatim quote capture)
13. service_record (Subtype 4 — foreign salary differential)

### C. PHASE-3 DRAFTER PROMPTS (Opus 4.7)

**One prompt per cover-letter section (II–VIII for Subtype 1; the corresponding ALL-CAPS sections for Subtype 4).**

Each:
- Heavy system prompt with: voice rules, defined terms ("the Beneficiary"/"the Petitioner"), exhibit cite format, defensive paragraph triggers, authority allowlist, end-of-section "Accordingly..." pattern
- Few-shot from voice corpus (Kacar-Salih) and Camural for Subtype 4
- User prompt = extracted facts + matching exhibit references + section-specific facts
- Output = section text (no surrounding letter scaffolding)
- Quality gates baked in (e.g., Section IV-B must contain at-risk pre-emption sentence)

**Subtype 1 sections to build:**
- II Treaty Qualification
- III Ownership Structure and Corporate History
- IV Investment (with subsections A-D)
- V Substantiality
- VI Marginality and Ongoing Commercial Activity
- VII Develop and Direct
- VIII Conclusion

**Subtype 4 sections to build:**
- INVESTMENT, ESTABLISHMENT, OWNERSHIP AND CONTROL
- DOING BUSINESS
- PREMISES
- OPERATING PERSONNEL
- FINANCIAL SITUATION AND FUTURE PLANS
- THE BENEFICIARY'S PROSPECTIVE ROLE
- BENEFICIARY'S EMPLOYMENT HISTORY AND QUALIFICATIONS (with italicized LoR quote insertion)
- CONCLUSION

### D. PHASE-4 REVIEWER PROMPTS (Opus 4.7)

**Two prompts:**
1. Quality-gate enforcement (Section 15 of main manual + Section 7 of Subtype-4)
2. RFE-risk scoring against the 9 patterns in Section 3 of Doctrinal Briefing

Output:
- Pass/fail per gate with cited evidence
- RFE-risk score (low/medium/high) with rationale
- List of `[CITE NEEDED]` sentinels found
- Severity-classified issues (1-5)
- Halt at severity ≥ 4

### E. PROMPT-CACHING ARCHITECTURE

Practical guide for this pipeline:
- What goes in `cache_control: ephemeral=5m` vs `ephemeral=1h`
- Order of cached blocks (system → reference → schema → user)
- Cache-warming strategy when starting a new case
- How to handle prompt updates (versioning + re-warm cost)

### F. AUTHORITY ALLOWLIST ENFORCEMENT

Concrete pattern combining:
- Regex match against canonical citation list
- LLM-side check (Phase-4 reviewer) against allowlist
- Retrieval against canonical primary-source URLs (9 FAM, 8 CFR, BIA precedent PDFs) for live-verification
- `[CITE NEEDED — VERIFY: <draft>]` sentinel pattern when unverified
- Refusal pattern: drafter cannot proceed if cited authority not in allowlist; halts to attorney queue

---

# END OF BUNDLE

**File pointers (for the parent Claude Code session, not the receiving chat):**
- `~/akalan-context/E2_Doctrinal_Briefing_2026.md` — full doctrinal briefing
- `~/projects/akalan-portal/manuals/E2-MANUAL-FOR-CLAUDE-CODE.md` — full Subtype-1 manual (1003 lines — bundle has key sections; full is on disk)
- `~/projects/akalan-portal/manuals/MANUAL-SUBTYPE-4-Essential-Skills-Employee.md` — full Subtype-4 manual (598 lines)
- `~/projects/akalan-portal/manuals/_E2-SUBTYPE-TAXONOMY.md` — full taxonomy (457 lines)
- `~/projects/akalan-portal/manuals/01-COVER-LETTER-TEMPLATE.md` — full template (372 lines)
- `~/projects/akalan-portal/manuals/02-CASE-FILE-STRUCTURE.md` — full structure (211 lines)
- `~/projects/akalan-portal/manuals/03-EXHIBIT-INDEX-TEMPLATE.md` — full exhibit template (280 lines)
- `~/projects/akalan-portal/manuals/_VOICE-CORPUS-from-Kacar-Salih.md` — full corpus (183 lines)
- `~/projects/akalan-portal/research/2026-04-28_e2-consular-filing.md` — full consular research (319 lines)
- `~/projects/akalan-portal/research/2026-04-28_e2-consular-posts.md` — full per-post research (344 lines)
- `~/projects/akalan-portal/research/2026-04-28_e2-new-filing.md` — full E-2 NEW research (504 lines)

If the receiving chat needs the FULL text of any of the above (this bundle has key extracts only for length), the user can paste them on request.
