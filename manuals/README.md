# E-2 Manual System (Multi-Sub-Type)

> The bot's Phase-0 detector classifies the case into one of four E-2
> sub-types, then loads the matching manual. Master OS is always loaded first;
> the taxonomy file is the dispatcher; the four sub-type manuals contain the
> per-case-type instructions.

---

## File structure

```
templates/E-2/
│
├── README.md                                       ← you are here (dispatcher map)
├── _E2-SUBTYPE-TAXONOMY.md                         ← Phase-0 decision tree (master)
│
├── MANUAL-SUBTYPE-1-Individual-Investor.md         ← pointer to E2-MANUAL-FOR-CLAUDE-CODE.md
├── MANUAL-SUBTYPE-2-Corporate-Owned-Investor.md    ← skeleton (V2 calibration pending)
├── MANUAL-SUBTYPE-3-Executive-Supervisory.md       ← skeleton (V2 calibration pending)
├── MANUAL-SUBTYPE-4-Essential-Skills-Employee.md   ← full (calibrated to Camural)
│
├── E2-MANUAL-FOR-CLAUDE-CODE.md                    ← canonical Subtype-1 content (currently deployed)
│
├── 01-COVER-LETTER-TEMPLATE.md                     ← Subtype-1 cover-letter scaffold
├── 02-CASE-FILE-STRUCTURE.md                       ← Subtype-1 folder tree
├── 03-EXHIBIT-INDEX-TEMPLATE.md                    ← Subtype-1 exhibit-index template
│
├── _VOICE-CORPUS-from-Kacar-Salih.md               ← Subtype-1 firm voice corpus
├── _CAMURAL-vs-KACAR-COMPARISON.md                 ← side-by-side analysis
└── _E2-SUBTYPE-TAXONOMY.md                         ← (listed twice; same file)
```

---

## How the bot uses this folder

```
[PDF folder dropped]
      │
      ▼
Phase 0 — load Master OS
      │
      ▼
Phase 0.5 — load _E2-SUBTYPE-TAXONOMY.md
      │
      ▼
Phase 0.6 — case-subtype-detector classifies the filing:
            { principal_subtype, procedural_posture, has_dependents }
      │
      ├── 'individual_investor'          → load MANUAL-SUBTYPE-1
      ├── 'corporate_owned_investor'     → load MANUAL-SUBTYPE-2 (skeleton — escalate)
      ├── 'executive_supervisory_employee' → load MANUAL-SUBTYPE-3 (skeleton — escalate)
      └── 'essential_skills_employee'    → load MANUAL-SUBTYPE-4
      │
      ▼
Phase 1+ — execute per the loaded sub-type manual
```

When the detector returns a subtype with status `skeleton`, the bot must:
1. Surface a memo to the supervising attorney explaining the subtype + missing manual.
2. Run a partial extraction using available shared skills.
3. Block automatic drafting — attorney decides whether to proceed manually.

---

## Sub-type quick reference

| Subtype | Pattern source | Status | Trigger |
|---|---|---|---|
| 1 — Individual Investor | Kacar-Salih (RI LLC, $120K, Jan 2026) | **PRODUCTION** | Beneficiary owns ≥50%; firm letterhead; Roman-numeral cover; individual SOF chain |
| 2 — Corporate-Owned Investor | (no firm exemplar yet) | **SKELETON** | Foreign corporation IS the investor; beneficiary as corp's exec; full UBO chain |
| 3 — Executive/Supervisory Employee | (no firm exemplar yet) | **SKELETON** | "REQUESTED CLASSIFICATION: E2 — EXECUTIVE/SUPERVISORY"; C-suite/VP title; org-chart top tier |
| 4 — Essential Skills / Specialized Knowledge | Camural / Pomega (Pomega Energy, Feb 2024) | **PRODUCTION** | "REQUESTED CLASSIFICATION: E2 — SPECIALIZED KNOWLEDGE"; Petitioner letterhead; Job Offer Letter; Diploma+CV+LoR |

Each manual contains:
- When to load
- Tab structure
- Cover-letter section structure + drafter voice
- Per-document manual entries (what / why / agent extraction / skill / quality gate)
- Authority allowlist for that subtype
- Reviewer Phase-4 checklist for that subtype
- Worked-example fixture for regression testing

---

## How to add a new sub-type manual

When a new firm exemplar lands (e.g., a Subtype-2 corporate-owned filing):

1. OCR the filing (`pdftoppm` + `tesseract` or vision pass).
2. Extract Tab structure + cover-letter section anatomy.
3. Identify net-new document types and update Section 13 skill list in this README.
4. Replace the relevant skeleton manual with full content following the
   Subtype-4 template structure (sections 0 through 9).
5. Add a worked-example fixture.
6. Add the subtype's signals to `_E2-SUBTYPE-TAXONOMY.md` §7.
7. Update `case-subtype-detector` skill prompt so the new signals are recognized.
8. Re-deploy manuals to `~/projects/akalan-portal/manuals/` for Claude Code.

---

## How the firm uses this folder per case

For a NEW E-2 case:

1. Drop client documents into the case folder.
2. Bot runs Phase 0 → returns subtype + procedural posture.
3. Bot loads the matching manual.
4. Bot extracts each document per the manual's per-document entries.
5. Bot drafts the cover letter per the manual's voice profile.
6. Reviewer (Phase 4) runs the manual's quality-gate checklist.
7. Attorney signs off.
8. File.

Each manual is **versioned independently** so Subtype-1 improvements don't
require re-deploying Subtype-4, and vice versa.

---

## Authority sources (master list)

- [9 FAM 402.9 — Treaty Traders, Investors, and Specialty Occupations](https://fam.state.gov/fam/09FAM/09FAM040209.html)
- [E-2 Treaty Investors — USCIS](https://www.uscis.gov/working-in-the-united-states/temporary-workers/e-2-treaty-investors)
- [Treaty Trader & Treaty Investor — U.S. Department of State](https://travel.state.gov/content/travel/en/us-visas/employment/treaty-trader-investor-visa-e.html)
- [8 CFR §214.2 — Special requirements (eCFR)](https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-214/subpart-A/section-214.2)

---

## Calibration log

| Date | Filing | Subtype | Result |
|---|---|---|---|
| 2026-04-27 | Kacar-Salih E-2 Renewal (Jan 2026) | 1 — Individual Investor | Subtype-1 manual deployed |
| 2026-04-27 | Camural / Pomega E-2 (Feb 2024) | 4 — Essential Skills Employee | Subtype-4 manual deployed |

---

Last updated: 2026-04-27
