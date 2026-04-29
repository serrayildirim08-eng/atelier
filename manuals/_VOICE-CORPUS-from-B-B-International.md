# Firm Voice Corpus — Extracted from B&B International Trading LLC RFE Response (Filed 2026-04-08)

> Source: real Akalan Business Immigration RFE response, 28 pages, parsed
> via `~/Akalan-Forensic/akalan_agent.py` from
> `Imm-1007-2025 - B&B International Trading LLC (BUS)/Documents/RFE response/RFE cover letter.pdf`.
>
> **This is a second voice profile distinct from `_VOICE-CORPUS-from-Kacar-Salih.md`.**
> Kacar = initial cover letter voice (Roman-numeral structure, narrative-heavy, foreign-jurisdiction defensive paragraphs).
> B&B = RFE-response voice (ALL-CAPS thematic headings, rule-state-apply-conclude paragraph mechanics, concise).

## Filing metadata

- **Filing type:** RFE response (1st RFE round)
- **Beneficiary:** Bilge Azazi (Turkish national, DOB 1994-04-10)
- **Petitioner:** B&B International Trading LLC (Florida LLC)
- **Sub-type:** Subtype 1 (`individual_investor`) — but with E5 develop-and-direct vulnerability (50/50 ownership; Berkant Ozgun appointed President)
- **Posture:** USCIS COS_NEW + I-539 protective bridge
- **Receipt:** IOE0936087645
- **Premium processing:** YES
- **RFE-1 issued:** 2026-04-06 (maintenance of status only)
- **RFE-1 response date:** 2026-04-08 (2-day turnaround)
- **RFE-2 issued:** 2026-04-28 (E3 + E4 substantive — 20 days after Akalan's RFE-1 response)
- **Drafting attorney signing:** Yasin Bilgehan Akalan, Esq. (NY Bar)

---

## Voice signatures (verbatim from RFE response)

### Section-heading convention (RFE-response specific)

| Pattern | Kacar (initial cover letter) | B&B (RFE response) |
|---|---|---|
| Format | `## I.` `## II.` Roman numerals, ALL CAPS heading | ALL CAPS thematic, no numbering |
| Anchor | Mirrors Tab letter (II↔C, III↔D…) | Anchors a discrete legal claim |
| Examples | `## II. QUALIFICATION UNDER A TREATY OF COMMERCE AND NAVIGATION` | `TIMELY FILING OF FORM I-129 PRIOR TO EXPIRATION OF STATUS`; `PROTECTIVE FILING OF FORM I-539`; `BENEFICIARY HAS MAINTAINED LAWFUL STATUS`; `APPROVAL OF FORM I-539 IS NOT REQUIRED` |

### Opening paragraph (RFE response template)

> "This response is submitted on behalf of the Petitioner, **[PETITIONER LEGAL NAME]**, in response to the Request for Evidence dated **[RFE_DATE]**. Please note that a Form G-28, Notice of Entry of Appearance as Attorney, is enclosed with this response. (Exhibit: G-28, Notice of Entry of Appearance as Attorney)"

Always opens with: identification of party + RFE date + G-28 enclosure callout. Single paragraph, single citation.

### Argument-paragraph mechanics (state → rule → apply → conclude)

The B&B response uses a four-beat micro-structure within each thematic section:

```
Beat 1 — STATE:    The Beneficiary was admitted to the United States in
                   B-2 status with an authorized stay valid until
                   April 5, 2026. (Exhibit I-94 Record; Exhibit:
                   Passport and B-2 Visa)

Beat 2 — STATE:    The Petitioner timely filed the Form I-129 petition
                   requesting E-2 classification, which was received by
                   USCIS on March 20, 2026 (Exhibit: I-129 Premium
                   Processing Receipt Notice; Exhibit: FedEx Delivery
                   Confirmation).

Beat 3 — APPLY:    Accordingly, Form I-129 was properly filed before
                   the expiration of the Beneficiary's authorized stay.

Beat 4 — RULE:     Under applicable regulations and USCIS policy, a
                   nonimmigrant who files a timely request for change
                   of status is considered to be in a period of
                   authorized stay while the petition is pending.
                   See 8 C.F.R. § 248.1(b).
```

Pattern: `STATE the fact (with exhibit cite)` → `STATE the supporting fact (with exhibit cite)` → `Accordingly, [conclusion of fact-application]` → `Under [authority], [rule]. See [citation].`

### Bullet-list summary recap (used at the end of each thematic section)

> "Therefore, the evidence demonstrates that:
> • The Form I-129 was timely filed prior to expiration of status
> • The Beneficiary filed a protective Form I-539 to ensure continuity
> • The Beneficiary has remained in a period of authorized stay; and
> • The Beneficiary has fully maintained lawful nonimmigrant status."

Pattern: `Therefore, the evidence demonstrates that: [bullets, each starting with "The Form" or "The Beneficiary"; second-to-last bullet ends with "; and"]`

### Inline exhibit citation format

The B&B response shows **observed drift** from the manual's prescribed `(Exhibit: <Title> dated <Date>)` format:

| Observed | Manual prescription |
|---|---|
| `(Exhibit I-94 Record; Exhibit: Passport and B-2 Visa)` | `(Exhibit: I-94 Record; Exhibit: Passport and B-2 Visa)` — colon required |
| `(Exhibit: G-28, Notice of Entry of Appearance as Attorney)` | matches manual ✓ |
| `(Exhibit: I-129 Premium Processing Receipt Notice; Exhibit: FedEx Delivery Confirmation)` | matches manual ✓ |
| `(Exhibit: I-539 Receipt Notice)` | manual would prefer `(Exhibit: I-539 Receipt Notice dated 2026-03-17)` — date missing in human-drafted version |

**Calibration finding:** Atelier's drafter must enforce uniform `(Exhibit: <Title> dated <Date>)`. Eylul/Akalan drift on this in fast turnarounds — two-day RFE response had 1 missing colon and ~6 missing dates. Pre-generation reviewer should normalize.

### Closing template (RFE-response specific)

> "In response to this RFE, the following evidence is submitted:
> • Exhibit: G-28, Notice of Entry of Appearance as Attorney
> • Exhibit I-94 Record
> • Exhibit: Passport and B-2 Visa
> • Exhibit: I-129 Premium Processing Receipt Notice
> • Exhibit: FedEx Delivery Confirmation
> • Exhibit: I-539 Receipt Notice
>
> Accordingly, the requirement outlined in the RFE has been satisfied.
>
> We respectfully request that USCIS continue processing and approve the Form I-129 petition.
>
> Respectfully submitted,
> Yasin Bilgehan Akalan, Esq.
> Attorney for Petitioner
> Akalan Business Immigration"

Pattern: bulleted exhibit list → `Accordingly, the requirement outlined in the RFE has been satisfied.` → `We respectfully request that USCIS continue processing and approve the Form I-129 petition.` → signature block.

### Defensive footnote pattern (passport renewal)

> "[1] The Beneficiary was issued a B-2 visa in a prior passport (Passport No. **S02174044**), which has since expired. A copy of the visa page from the prior passport is submitted. The Beneficiary currently uses a renewed passport (Passport No. **U26585648**). The Beneficiary's admission to the United States and corresponding Form I-94 record remain the same, and the use of a renewed passport does not affect her admission or maintenance of status."

Pattern (single paragraph, four moves):
1. Identify the apparent anomaly (`prior passport vs current passport`).
2. State what was submitted to address it (`A copy of the visa page from the prior passport is submitted`).
3. Acknowledge the new state (`The Beneficiary currently uses a renewed passport`).
4. Explain why the anomaly does not impair the legal claim (`I-94 record remain the same, and the use of a renewed passport does not affect her admission or maintenance of status`).

This is reusable as the `defensive_passport_renewal` template — Atelier's drafter should produce this verbatim shape when a passport-renewal-mid-petition fact pattern is detected.

### Letterhead signature block (B&B / Akalan firm structure as of 2026-04-08)

```
Yasin Bilgehan Akalan, Esq.            490 Route 304, Suite 3
   New York Bar                        New City, NY 10956
Gokhan Michael Kiran, Esq.             4250 Veterans Memorial Hwy, Suite 245 E,
   Pennsylvania, New York & New Jersey Bar    Holbrook, NY 11741
                                       AKALAN LAW FIRM, PLLC
                                       404 Clifton Ave, Unit 2B, Clifton NJ 07011
Melis Ozge Ozcan, Esq.
   New York Bar
MAIN PHONE: (212) 542 3940    ADJUSTMENT DEPT: (212) 542 3939    EMAIL: INFO@AKALANLAW.COM
```

Note vs Kacar letterhead (2026-01-07):
- Roster expanded: Huseyin Emre Eney removed; Gokhan Michael Kiran + Melis Ozge Ozcan added.
- Office expanded: Clifton, NJ added; 18 W. 33rd Street NYC dropped.
- Phone: `(212) 542-3939` → `(212) 542 3940` main + `(212) 542 3939` adjustment dept (split).
- Tagline: `AKALAN BUSINESS IMMIGRATION, PLLC` ↔ `AKALAN LAW FIRM, PLLC` — entity name appears to vary by filing/letter type.

**Calibration finding:** the firm's letterhead changes over time. The drafter should pull current letterhead from `lib/firm/letterhead.ts` (or equivalent), not hardcode.

---

## Adversarial corpus (USCIS RFE language captured here for the pre-filing reviewer)

The 2nd RFE (2026-04-28) is a textbook E3/E4 challenge. Capture verbatim for Atelier's reviewer to learn what to flag at pre-generation:

### USCIS bona-fide-enterprise (E3) attack pattern

> "While you have submitted evidence that the business was legally created, you have not shown that it is actively working in a commercial sense to produce services or goods for profit. Specifically, you submitted a Profit-Loss document that shows for the time period between **[date_range]**, the total business income was **$[trivial_amount]** in **[non-revenue category, e.g., 'Bank Rewards']**. The **[year]** Tax Return listed a **total business loss of $[loss]**. The lease you submitted is for **a house in a residential neighborhood**. You have not submitted evidence of any sales or manner in which you are selling products on the open market. **It does not appear that your enterprise is conducting any sort of commercial business.**"

### USCIS marginality (E4) attack pattern

> "It does not appear that your enterprise had made any income from selling products on the open market. As such, it has not been shown that the enterprise is able to generate enough of an income to provide a minimal living for the beneficiary."

### Trigger conditions (Atelier reviewer should flag at pre-generation)

| Pre-filing signal | Bot gate | Action |
|---|---|---|
| Tax return shows loss in the calendar year preceding filing | `marginality_loss_pre_filing` (severity 4) | Require offsetting evidence: hiring schedule, future contracts, family resources |
| YTD revenue < $5,000 from non-customer sources only (interest, rewards, refunds) | `no_open_market_commerce` (severity 5) | Block drafting; require customer invoices |
| Lease type ∈ {residential, mixed-use without separate commercial sublet} | `lease_residential_for_commercial_business` (severity 5) | Block drafting; require commercial lease |
| Business plan < 15 pages OR no industry citations | `business_plan_thin` (severity 4) | Block drafting; require *Matter of Ho*-grade plan |
| Org chart absent | `org_chart_missing` (severity 3) | Generate placeholder + mark for attorney completion |
| State Quarterly Wage Reports not in filing | `state_qwr_missing` (severity 3) | Pull from accounting system or generate stub |

---

## Voice features summary (for Atelier drafter mode `rfe_response`)

| Feature | RFE-response voice (B&B) |
|---|---|
| Section heads | ALL-CAPS thematic, no numbering, mirrored to USCIS's specific evidentiary requests |
| Paragraph rhythm | 4-beat: state → state → apply (Accordingly, …) → rule (Under …, See …) |
| Bullet recaps | Closing each thematic section: "Therefore, the evidence demonstrates that:" + 4–6 bullets, all starting with "The Form" or "The Beneficiary" |
| Defined terms | "the Beneficiary", "the Petitioner" — consistent with manual + Kacar |
| Citation format | Should be `(Exhibit: <Title> dated <Date>)`; observed drift in fast turnarounds — drafter must enforce |
| Authority | C.F.R. + USCIS policy in apply/rule beats; `See [citation]` is the firm's signature suffix |
| Footnote pattern | Single-paragraph, four-move structure (anomaly → submission → new state → why anomaly is harmless) |
| Closing | "Accordingly, the requirement outlined in the RFE has been satisfied. We respectfully request that USCIS continue processing and approve the Form I-129 petition." — formulaic |
| Tone | Direct, fact-led, light on rhetoric; assumes the adjudicator has misframed the standard and corrects with a `[claim] is not required.` heading (e.g., "APPROVAL OF FORM I-539 IS NOT REQUIRED") |
| Length | Short — RFE-1 response was ~28 pages with most of the bulk being attached exhibits, ~3 pages of actual narrative |

---

## What still needs harvesting from B&B (for next pass)

- [ ] **RFE-2 response** — once filed (deadline 2026-07-24); will reveal how Akalan handles a substantive E3/E4 challenge (vs the procedural E1-doesn't-actually-exist-yet challenge of RFE-1).
- [ ] **Original I-129 cover letter** — was the initial filing's cover letter as thin as the business plan? (Currently on disk as `cover letter structure.docx` draft + 457-page image-only `Filing_I-129_E-2_Azazi-Bilge_03172026.pdf`; needs OCR pass.)
- [ ] **CoS written statement** — `Documents/CoS/CoS written statement.pdf` likely the COS-route equivalent of a cover letter; voice may differ from RFE response.
- [ ] **MITA v2 + OA Amendment v2 + Member Resolution v2** — what did Akalan revise mid-case in response to USCIS pressure?

---

Last updated: 2026-04-29
Source filing: `Imm-1007-2025 - B&B International Trading LLC (BUS)/Documents/RFE response/RFE cover letter.pdf`
