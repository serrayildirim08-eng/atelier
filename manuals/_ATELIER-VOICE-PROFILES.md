# Atelier — Voice Profiles (Master Index)

> Single source of truth for which voice profile Atelier uses at which
> stage. The drafter (`draft/cover-letter.ts`) routes to a profile based
> on `caseFacts.subtype` + `caseFacts.draft_mode` (initial /
> premium-upgrade / rfe-response / service-request).
>
> **Calibrated against:** Kacar-Salih (Subtype 1, initial), B&B International
> (Subtype 1, RFE response), Cemre Musluoglu (Subtype 3, premium upgrade
> + RFE response, APPROVED), Fehime Karakurt (Subtype 1, service request,
> APPROVED), Karasu Metin (Subtype 1, with RFE, APPROVED — pending deeper voice harvest).
>
> **Version:** v1.0 — 2026-04-29

---

## Profile selection matrix

The drafter receives `(subtype, draft_mode, posture)` and picks a profile from this matrix.

| `draft_mode` | Subtype 1 (individual) | Subtype 2 (corp-owned) | Subtype 3 (executive) | Subtype 4 (essential-skills) |
|---|---|---|---|---|
| `initial_filing` | **Profile A** (Kacar-Salih) — Roman numeral / ALL CAPS thematic, law-firm voice | (Profile A — pending Subtype 2 calibration) | **Profile B** (Cemre vol2) — petitioner-corporate, anti-ambiguity declarative | **Profile C** (Camural — pending separate corpus) — petitioner-corporate, salary-differential |
| `premium_upgrade_supplement` | **Profile B** (Cemre vol2) | (Profile B) | (Profile B) | (Profile B) |
| `rfe_response` | **Profile D** (B&B + Karasu) — ALL CAPS thematic, state→rule→apply→conclude | (Profile D) | (Profile D, with classification reaffirmation) | (Profile D, with skill reaffirmation) |
| `service_request` | **Profile E** (Fehime) — formal letter, family-reunification framing | (Profile E) | (Profile E) | (Profile E) |
| `internal_review` (NOT filed) | **Profile F** (Cemre rfe outline) — emoji-augmented diagnostic | (Profile F) | (Profile F) | (Profile F) |

---

## Profile A — Initial cover letter (Subtype 1)

**Source:** `_VOICE-CORPUS-from-Kacar-Salih.md` + Cemre initial cover letter (the mis-classified one — voice is correct even though classification was wrong).

**Section heads:** Roman numeral + ALL CAPS, mirrored to firm Tab letter.
```
## I.    INTRODUCTION
## II.   QUALIFICATION UNDER A TREATY OF COMMERCE AND NAVIGATION  ← Tab C
## III.  OWNERSHIP STRUCTURE AND CORPORATE HISTORY                 ← Tab D
## IV.   THE INVESTMENT: SOURCE, TRANSFER, AND AT-RISK COMMITMENT  ← Tab E
## V.    SUBSTANTIALITY OF THE INVESTMENT                          ← Tab F
## VI.   MARGINALITY AND ONGOING COMMERCIAL ACTIVITY               ← Tab G
## VII.  ROLE OF THE BENEFICIARY: DEVELOPING AND DIRECTING         ← Tab H
## VIII. CONCLUSION
```

**Section closing pattern:** "Accordingly, [element] is satisfied under INA § … and 9 FAM 402.9-…"

**Defensive paragraph (foreign-jurisdiction):** Insert culture/law explanation BEFORE the exhibit citation.
```
"Under [Treaty Country] law and customary practice, [foreign mechanism].
Accordingly, [factual claim is evidenced through the foreign-jurisdiction artifact].
(Exhibit: [Title] dated [Date])"
```

**Defined terms:** "the Beneficiary", "the Petitioner". Never first name. Never "Applicant" or "Investor" alone.

**Currency:** `<ISO> <amount>.<cents>` always.

**Citation format:** `(Exhibit: <Title> dated <Date>)` — uniform.

---

## Profile B — Premium-upgrade supplement (any subtype)

**Source:** Cemre Musluoglu vol2 cover letter.

**RE line:** `RE: CONTINUATION OF FORM I-129, PETITION FOR NON-IMMIGRANT WORKER – UPGRADING TO PREMIUM PROCESSING AND INTRODUCING NEW EVIDENCE`

**Opening paragraph:** repeats the initial cover letter's opening but adds:
> "Our petition is currently under adjudication at the [Service Center]. We are submitting a request to upgrade the petition to premium processing, along with additional evidence demonstrating that the business is operational. For the officer's convenience, the complete cover letter and petition package are included. **Newly submitted exhibits and those containing additional evidence have been underlined for easier reference**. The requisite payment for Form I-907 is also enclosed herewith."

**Anti-ambiguity declarative (Subtype 3 / 4 mandatory):**
> "**The principal treaty investor in this petition is [CORP_NAME]. [Beneficiary Title] has been appointed as the [ROLE] of [Petitioner], with executive authority over [scope]**."

Lead the Ownership section with this exact-shape sentence; do NOT bury in narrative.

**Body:** verbatim copy of initial cover letter with new evidence inserted, **underlined** for visual surfacing.

**Closing:** standard initial-filing closing.

---

## Profile D — RFE / NOID response

**Source:** `_VOICE-CORPUS-from-B-B-International.md` + Cemre RFE response + Karasu RFE response (pending deeper harvest).

**Section heads:** ALL-CAPS thematic, no numbering, mirrored to USCIS's specific evidentiary requests.
- Examples observed: `TIMELY FILING OF FORM I-129 PRIOR TO EXPIRATION OF STATUS`, `PROTECTIVE FILING OF FORM I-539`, `BENEFICIARY HAS MAINTAINED LAWFUL STATUS`, `APPROVAL OF FORM I-539 IS NOT REQUIRED`, `RFE Response Point 1. Classification of the Beneficiary – Employee vs. Investor`, `RFE Response Point 2. Source and Path of Investment Funds`.
- Pattern: **one heading per discrete legal claim**; sub-arguments live as bullets within.
- For multi-RFE-point responses, use `RFE Response Point N. <subject>` numbering.

**Opening paragraph (boilerplate):**
> "This response is submitted on behalf of the Petitioner, **[PETITIONER LEGAL NAME]**, in response to the Request for Evidence dated **[RFE_DATE]**. Please note that a Form G-28, Notice of Entry of Appearance as Attorney, is enclosed with this response. (Exhibit: G-28, Notice of Entry of Appearance as Attorney)"

**Argument-paragraph mechanics (4 beats):**
```
Beat 1 — STATE:    The Beneficiary [fact]. (Exhibit: …)
Beat 2 — STATE:    The Petitioner [supporting fact]. (Exhibit: …)
Beat 3 — APPLY:    Accordingly, [fact-application conclusion].
Beat 4 — RULE:     Under [authority], [rule]. See [citation].
```

**Bullet-list summary (closing each thematic section):**
> "Therefore, the evidence demonstrates that:
> • The [factual claim 1]
> • The Beneficiary [factual claim 2]
> • The Beneficiary [factual claim 3]; and
> • The [factual claim 4]"

(Pattern: "Therefore, the evidence demonstrates that:" + 4–6 bullets, each starting with "The Form" or "The Beneficiary" or "The Petitioner". Second-to-last bullet ends with "; and".)

**Defensive footnote (anomalies):** single-paragraph, four-move structure.
1. Identify the apparent anomaly.
2. State what was submitted to address it.
3. Acknowledge the new state.
4. Explain why the anomaly does not impair the legal claim.

**Closing template:**
> "In response to this RFE, the following evidence is submitted:
> • Exhibit: …
> • Exhibit: …
>
> Accordingly, the requirement outlined in the RFE has been satisfied.
>
> We respectfully request that USCIS continue processing and approve the Form I-129 petition.
>
> Respectfully submitted,
> [Attorney Name], Esq.
> Attorney for Petitioner
> Akalan Business Immigration"

---

## Profile E — Service Request (expediting stuck dependents)

**Source:** Fehime Karakurt service request letter.

**Use case:** principal's I-129 approved, dependents' I-539s stuck in queue. Letter requests USCIS to prioritize the dependent applications.

**RE line:** `RE: Service Request for [Form], [purpose]`

**Body structure:**
1. Identification of representation + receipt numbers + the "concurrently submitted" framing.
2. State that the principal I-129 was filed under Premium Processing — frame the dependents as deserving the same priority.
3. Family-reunification + regulatory-compliance argument.
4. Explicit request for priority consideration.
5. Numbered enclosure list with each form name + dated.

**Firm-stable phrases:**
- "This office represents the above-captured beneficiaries"
- "concurrently submitted through their spouse/parent"
- "principles of family reunification"
- "USCIS's commitment to efficient processing and regulatory compliance"
- "we respectfully request that the dependent I-539 applications be accorded priority consideration"

---

## Profile F — Internal review document (NOT filed)

**Source:** Cemre Musluoglu `rfe outline.docx` — the firm's pre-response self-critique memo.

**Use case:** before drafting an RFE response, generate a candid internal diagnostic that maps each USCIS request to the existing record's strengths and gaps.

**Tone:** self-critical, candid, diagnostic-first.

**Format signatures:**
- Emoji-augmented verdict-per-issue rubric: ✅ (addressed) / ⚠️ (partially addressed) / ❌ (justified concern, must remedy).
- Each issue gets: USCIS Concern → What Your Letters Provide → Verdict → Recommended Action.
- Closing "Final Verdict" paragraph: "The RFE is mostly justified, particularly regarding [list]. However, [strength], and with [targeted supplements], you should be in a strong position to respond successfully."

**Atelier reviewer integration:** at `Stage = aggregate` (Phase 4), produce an artifact in this voice profile. Save to the matter folder; do NOT include in the petition packet. Surface to the supervising attorney for sign-off before the drafter runs the actual RFE response.

---

## Cross-profile invariants (enforced at every drafter pass)

These hold regardless of which profile is selected:

| Invariant | Rule |
|---|---|
| Defined terms | "the Beneficiary", "the Petitioner", "the Treaty Country", "the Investment", "the Enterprise" — verbatim, no substitutions |
| Currency | `<ISO> <amount>.<cents>` (`USD 80,000.00`, `TRY 4,000,000.00`) |
| Date | ISO 8601 (`YYYY-MM-DD`) — except in cover-letter narrative where prose dates are acceptable (Akalan uses prose dates in narrative; reviewer must enforce ISO in tables and case header) |
| Citation | `(Exhibit: <Title> dated <Date>)` — colon required, date required (observed drift in fast turnarounds — Atelier must normalize) |
| Authority | Only authorities on the loaded sub-type manual's allowlist |
| Provenance | Every fact: `{value, source_doc, source_page, source_quote, confidence}` |
| Display name | 4-tier priority: applied alias > display_name > suggested_filename > raw filename. Never print raw on-disk filenames |
| Hedging | `confidence < 0.6` triggers "appears to be", "the record indicates", "the petitioner asserts" |
| Missing facts | `[MISSING: <plain-language label>]` inline; do not pad with rule-statement alone |
| Self-correction | If you catch yourself writing in first person, substituting "Applicant" for "Beneficiary", or padding with rule when fact is missing, stop and re-do |

---

## Letterhead vintage handling

The firm's letterhead has changed across cases:

| Vintage | Attorneys | Office(s) | Phone |
|---|---|---|---|
| 2023 (Karasu, Fehime) | Yasin B. Akalan, Huseyin Emre Eney | New City NY + 18 W. 33rd St NYC + Holbrook NY | (212) 542-3940 main + 3939 adjustment |
| 2026-01 (Kacar) | Yasin Bilgehan Akalan, Huseyin Emre Eney | New City NY + 18 W. 33rd St NYC | (212) 542-3939 single |
| 2026-04 (B&B RFE) | Yasin Bilgehan Akalan, Gokhan Michael Kiran, Melis Ozge Ozcan | New City NY + Holbrook NY + Clifton NJ | (212) 542-3940 main + 3939 adjustment |

**Drafter rule:** pull current letterhead from `lib/firm/letterhead.ts` (or equivalent runtime config). Do NOT hardcode. The historical letterheads above are reference only — for backfilling old cases or matching tone/era when reading historical filings.

---

## What still needs harvesting (open items)

- [ ] Karasu RFE response — adds a 3rd Subtype-1 RFE response sample (B&B pending + Cemre approved + Karasu approved triangulation)
- [ ] Original I-129 cover letter from B&B (image-only PDF, OCR pending)
- [ ] Splash Sub1 (Seyma Soyletmez) + Sub2 (Halil Soyletmez) cover letters (downloads pending)
- [ ] Flatturbo cover letters (download pending)
- [ ] Camural Subtype 4 voice corpus (separate from this batch — exists in `_CAMURAL-vs-KACAR-COMPARISON.md` but not extracted as standalone profile)
- [ ] Ozdil Sercan voice corpus (agent in progress)

---

Last updated: 2026-04-29
