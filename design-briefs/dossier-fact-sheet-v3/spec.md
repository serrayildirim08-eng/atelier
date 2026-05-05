# Atelier — Full-System Spec (Designer B, v3)

> Organized by **screen × state**. Each row in the matrices below names
> the surface, the state, the components rendered, the data source, the
> motion, and the keyboard. Anything not in the matrix doesn't ship.
>
> Tokens, type, motion, and accessibility are global at the bottom.

---

## 0. Index of screens

| # | screen                   | path / mount                                                       |
| - | ---                      | ---                                                                |
| 1 | Home (no matter)         | `app/page.tsx` — `Dossier()` returns `DossierEmpty` or `MatterList` |
| 2 | Home + drag              | overlay via `DragOverlay` + `dragActive` state                     |
| 3 | Pre-flight ingest        | header chip + `LoadingProgress` cell-1 lit                         |
| 4 | Phase-1 streaming        | `LoadingProgress` typewriter table; partial dossier                |
| 5 | Phase-2 aggregating      | `LoadingProgress` cell-4 lit; "weaving the dossier"                |
| 6 | Ingest-error             | `BackgroundIngestPill` red-bordered + `DossierError`               |
| 7 | Dossier — clean          | full `FactSheet` scroll                                            |
| 8 | Dossier — fatal-unset    | gate banner + alarm border on row(s)                               |
| 9 | Dossier — sev-5 conflict | inline `ConflictSidecar` row + gate banner                         |
| 10 | Dossier — needs-review  | `NeedsReviewPile` pinned at top of binder                          |
| 11 | Editing a fact          | `EditableCell` opens in right rail                                 |
| 12 | Re-classifying a PDF    | `DocTypeQuickPicker` in right rail                                 |
| 13 | Re-aggregating          | `ReloadingBanner` + dimmed sections                                |
| 14 | Pre-generation          | `PreGenerationRail` in right rail                                  |
| 15 | Generating (background) | streaming markdown in rail; chip in stack                          |
| 16 | Generation complete     | `DraftGate` row updates; rail collapses                            |
| 17 | Generation failed       | rail shows error; chip turns error                                 |
| 18 | RFE pending             | `RfeChip` in `MatterHeader`; NoID rows unlock                      |
| 19 | Lost matter root        | `RelinkPanel` in center                                            |
| 20 | Schema mismatch         | `ReAggregateButton` prominent in center                            |
| 21 | Matter overlay (open)   | full-screen `MatterOverlay`                                        |
| 22 | Per-PDF preview         | inline in right rail (`DocumentPreviewFrame fillContainer=false`)   |
| 23 | Cmd+K dossier search    | `paper-recess` overlay                                             |
| 24 | Keyboard cheatsheet     | `paper-recess` overlay (no scrim)                                  |
| 25 | Paralegal handoff       | last-touched subline + ResumeMarker                                |

---

## 1. Home (no matter selected)

### 1.a · zero matters (first launch)

**Components:**
- `Header` (existing).
- `Binder` left rail in `idle` state — empty list, copy `no matters yet · drop a folder.`
- Center: `DossierEmpty` (existing) — keep verbatim. The stunt headline survives only here.
- `Marginalia` right rail — empty, with the keyboard cheatsheet hint at top: `? for shortcuts`.
- `StatusBar` shows `0 files · 0 matters · ready.`

**Data source:** `results: IngestResult[]` is empty.

**Motion:** none. `fade-in` on first paint only.

**Keyboard:** `?` opens cheatsheet; `Cmd+O` triggers `onPickFolder`.

### 1.b · one or more matters ingested

**Components:**
- `MatterListLine` × N in the center column (replaces `DossierEmpty`).
- `DropZone` (NEW) at the bottom of center, full-width hairline, 56 px tall.
- Right rail empty with last-touched line: `last touched: AS · 14:32 · Kacar-Salih · facts.investment.total_committed_usd`.

**Data source:**
- `results: IngestResult[]` from `app/page.tsx:390`.
- `dashboardOverrides` for display names.
- For each matter: `matterMemories[id]` for last-touched (derived from `auditTrail` in `lib/preview-store.ts` if available; else fall back to ingest timestamp).

**Row content per `MatterListLine`:**
```
[ display_name (text-fact) ] [ E-2 / subtype (smcp text-meta) ] [ gate-glyph ] [ last-touched (text-label mono graphite-soft) ]
```
Glyph mapping per matter:
- `‡` (alarm) — any fatal-unset OR any sev-5 conflict.
- `·` (partial) — any sev-3/4 conflict OR any unset non-fatal.
- `✓` (clean) — gate banner would say `ready to generate.`

**Sort order:** newest-touched first.

**Motion:** hover row → `paper-2/40` tint (120 ms) + 7-day touch sparkline cross-fades in (existing pattern repurposed). No row entrance animation.

**Keyboard:** `j/k` selects matter; `Enter` opens; `Cmd+O` triggers ingest; `?` cheatsheet.

### 1.c · drag-active

**Components:**
- `DragOverlay` (existing) — keep, but slim: a single hairline rectangle full center, label `release to ingest · n PDFs detected` if dropped count is known, else `release to ingest`.
- `MatterListLine` rows dim to `text-graphite-soft` opacity 0.6.

**Data source:** `dragActive: boolean`.

**Motion:** 120 ms `--ease-paper` border-color transition `rule → ink`.

---

## 2. Ingest pipeline (matter being ingested)

### 2.a · pre-flight (Phase 0 — case-type detect)

**Components:**
- `BackgroundIngestPill` bottom-right (existing). Label: `detecting case type — Haiku 4.5`.
- `LoadingProgress` overlay if `expandedIngestId` is set: cell-1 (Scan) lit; cell-2 (Subtype) is the *running* cell with 2-px ink border on paper.
- Header chip in `MatterHeader` (only after a matter row exists in the list): `Phase 0 · ~1s`.

**Data source:** `progress.stage === 'subtype_detecting'` from `LoadingStreamEvent.type === 'progress'` in `loading-progress.tsx:43`.

**Motion:** 7-cell strip cells use `transition-colors 240ms`; no shimmer.

### 2.b · Phase 0.6 (subtype detect, parallel with Phase 1)

**Components:**
- Same as 2.a but cell-2 lit; cell-3 (Classify) running.
- Subtype result lands as a row in the typewriter table: `subtype: individual_investor — uscis_extension · HIGH`.

**Data source:** `LoadingStreamEvent.type === 'subtype_result'`.

**Motion:** typewriter row `fade-up` 200 ms.

### 2.c · Phase 1 (per-PDF classify + extract, streaming)

**Components:**
- `LoadingProgress` typewriter table fills as facts land. Each PDF result emits a row:
  `[index/total] filename → doc_type · suggested_filename`.
- The 9 binder categories (`EXHIBIT_CATEGORIES`) populate live in the *partial dossier* shown in the center column once perPdfCount > 0.
- `BinderLoadingRow` in the left-rail matter list shows the in-flight matter with `working` smcp + per-PDF count.

**Data source:**
- `LoadingStreamEvent.type === 'pdf_result'` for each PDF.
- `typedMemory` populated by accumulating per-PDF facts; surfaces in the partial dossier via `MemoryPane` until `caseFacts` lands.

**Motion:** 60 ms stagger between rows (existing). Cursor blink on the active row via 6-frame CSS keyframe (existing). Recolor any rainbow band to `text-ink-2` solid hairline.

### 2.d · Phase 2 (Sonnet 4.6 aggregator)

**Components:**
- `LoadingProgress` cell-4 lit; "weaving the dossier — Sonnet 4.6 · ~30 s" subline.
- Center column shows the partial dossier (Phase-1 facts) with section bodies dimmed to opacity 0.6 and a single line at the top: `aggregator running — fact sheet refreshing in ~30s`.

**Data source:** `progress.stage === 'aggregating'`.

**Motion:** none new; the dim is a static 0.6 opacity, not animated.

### 2.e · Phase 2 result lands

**Components:**
- Center column re-renders with full `FactSheet`.
- Gate banner populates with the verdict.
- Anchor rail glyphs update.
- Right rail shows last-touched + 13-gate audit summary in `text-meta`.

**Motion:** fact sheet sections fade-in with `--ease-paper` 240 ms (one per section, no stagger).

### 2.f · ingest error

**Components:**
- `BackgroundIngestPill` border thickens to ink, label `extraction failed — see log`.
- `DossierError` (existing) renders in center if attempting to open the matter.
- `LogPane` (existing) shows the error from `result.error.code` + `.message`.

**Data source:** `result.error: { code, message }` from `IngestResult` shape at `page.tsx:67`.

**Motion:** none. Error is static.

---

## 3. Dossier — the fact sheet scroll

This section consolidates v2's sections 3–6 plus the new screens. The
center column scrolls one continuous document. Anchor rail in left
controls scroll-to position. Right rail mutates per-row hover/click.

### 3.a · `MatterHeader` (sticky, 96 px tall)

**Composition:**
```
┌────────────────────────────────────────────────────────────────────┐
│ Salih Kaçar · Wise Guys Deli LLC                    [ E-2 indv. ]  │
│ uscis_extension · 4 dependents · ‡ RFE pending — 30 days remaining │
│ 3 facts unset · 1 sev-5 conflict · drafts gated                    │
│ last touched: AS · 14:32 · facts.investment.total_committed_usd    │
└────────────────────────────────────────────────────────────────────┘
```

**States:** `unloaded · loaded-clean · loaded-with-gate · loaded-with-alarm`.

**Backed by:**
- `result.caseFacts.facts.investor.full_name`, `.enterprise.legal_name`.
- `result.e2_subtype.{principal_subtype, procedural_posture, has_dependents, dependent_count}` (`subtype-detect.schema.ts:42`).
- Gate banner verdict computed client-side from:
  - `result.caseFacts.facts.conflict_register` filtered for sev ≥ 5.
  - `auditDocuments({ case_profile, filled_exhibits })` from `lib/e2/document-audit.ts` for fatal-missing slots.
  - `result.aggregate_audit.*` from the 13 gates.
- Last-touched: `lib/preview-store.ts:auditTrail` last entry (actor, iso, field_path).
- `RfeChip` from `result.caseFacts.facts.rfe?` if such a field is wired (TBD; for now reads from a `notes` header surfacing).

**Motion:** the gate banner appears with `--ease-decisive` 400 ms on first ingest-complete; otherwise static.

### 3.b · `AnchorRail` (left rail, second section)

**Composition:** 9 rows, each `[glyph] [smcp label] [tail count]`.
```
‡ facts          02/07 unset
✓ chain
· proof          04/05
‡ register       1 sev-5
· binder         87 docs
· drafts         12 gated
· audit
· log
· context
```

**Glyph computation:**
- `facts`: number of unset `Field<T>` leaves whose `requirement === 'required'` per `proof-matrix.ts`. Alarm if any have `severity_if_missing >= 4`.
- `chain`: `discrepancy` if any leg's deltas exceed gate tolerance (`investment_amount_drift`, `fx_rate_drift`, `treaty_ownership_below_50`, `board_resolution_amount_drift`).
- `proof`: `MissingnessReport.fatal_gaps.length > 0 → ‡`; else fraction filled.
- `register`: count of sev-5 conflicts → ‡; sev 3–4 → `·`; clean → `✓`.
- `binder`: doc count + completeness glyph from `EXHIBIT_CATEGORIES` × `typedMemory` × `documentOverrides`.
- `drafts`: count of `gated` rows from `DraftGate`.

**Motion:** click row → smooth scroll center column to anchor (240 ms `--ease-paper`); current anchor highlights via 2-px ink left border.

### 3.c · `FactSheet` — section 1 Identity

**Rows (FactRow each):**
| label                           | source field                          | mono? | fatal severity |
| ---                             | ---                                   | ---   | ---            |
| Investor full name              | `investor.full_name`                  | no    | 5 (passport)   |
| Date of birth                   | `investor.dob`                        | no    | 4              |
| Place of birth                  | `investor.place_of_birth`             | no    | 3              |
| Nationality                     | `investor.nationality`                | no    | 5 (treaty)     |
| Passport number                 | `investor.passport_number` masked     | yes   | 5              |
| Passport expiry                 | `investor.passport_expiry`            | yes   | 4 (gate)       |
| Current US status               | `investor.current_us_status`          | no    | 4              |
| Dependents                      | derived from `e2_subtype.dependent_breakdown` | yes | 1            |

**Severity sourcing:** read directly from `proof-slots.ts:E1_SLOTS[*].severity_if_missing`.

**Section glyph in eyebrow:** count of unset rows; alarm if any `severity_if_missing >= 4`.

### 3.d · `FactSheet` — section 2 Enterprise

**Rows:**
| label                  | source field                      |
| ---                    | ---                               |
| Legal name             | `enterprise.legal_name`           |
| EIN (last 4)           | `enterprise.ein`                  |
| Formation date         | `enterprise.formation_date`       |
| State of formation     | `enterprise.state_of_formation`   |
| Entity type            | `enterprise.entity_type`          |
| NAICS                  | `enterprise.naics_code`           |
| Industry               | `enterprise.industry`             |
| Physical address       | `enterprise.physical_address`     |

### 3.e · `FactSheet` — section 3 Investment posture

**Rows:**
| label                           | source field                                       |
| ---                             | ---                                                |
| Total committed (USD)           | `investment.total_committed_usd`                   |
| Irrevocably spent (USD)         | `investment.total_spent_usd`                       |
| Total cost of enterprise (USD)  | `investment.total_cost_of_enterprise_usd`          |
| Proportionality %               | `investment.proportionality_percent`               |
| Substantiality verdict          | derived (≥100% → meets; 80–100% → review; <80% → light) |
| Marginality verdict             | derived from `marginality_evidence_present.us_workers_employed` + `payroll_doc` count + `personal_reference_letter` conflict |

**Inline component:** `OperationsExpenditureTable` (existing) inside a `SectionAccordion` titled "Heading buckets — outlay by §VI category". Default closed.

### 3.f · `FactSheet` — section 4 Source-of-funds chain

**Primary view:** `SofChainDiagram` (NEW, replaces `SofChainTable` as primary).

**Diagram spec:**
- 240 px tall, full center-column width.
- Left column: origin nodes (from `source_of_funds[i].origin_category` + `.origin_evidence`).
- Middle: intermediate (FX conversions, transfers).
- Right: US deployment (final destination).
- Stroke width = USD amount, scaled proportionally; cap at 24 px so a $1M leg doesn't dwarf an $80K leg.
- Inline glyph per leg: `✓` corroborated (origin_evidence on file) · `·` asserted (no doc) · `‡` discrepancy (gate fired).
- Margin delta numbers in mono `--accent-alarm` for any leg whose dollars don't reconcile (e.g., `−$5,000 · investment_amount_drift`).

**States:** `empty · partial-chain · reconciled · discrepancy`.

**Below diagram:** 2-line summary `Σ chain total · n legs · reconciliation status`.

**Fold-down:** `SectionAccordion` titled "Tabular view (denormalized)" — opens the existing `SofChainTable` with `EditableCell` per cell. Same data, alternative reading.

**Data source:** `result.caseFacts.facts.source_of_funds[]` from `E2FactsSchema`.

**Gate hookup:** the `‡` glyph + delta number pulls from `result.aggregate_audit.fx_gate_results`, `investment_amount_drift` results, and `treaty_ownership_below_50` if applicable.

### 3.g · `FactSheet` — section 5 Proof slot matrix

**Rows (5):**
| element                        | source                                            |
| ---                            | ---                                               |
| E1 Treaty nationality          | `proof-matrix.ts:resolveSlots(profile)` filtered for `fam_elements: ['E1_treaty_nationality']` |
| E2 Substantial investment      | `fam_elements: ['E2_substantial_investment']`     |
| E3 Real and operating          | `fam_elements: ['E3_real_and_operating']`         |
| E4 More than marginal          | `fam_elements: ['E4_more_than_marginal']`         |
| E5 Develop and direct          | `fam_elements: ['E5_develop_and_direct']`         |

**Per row:**
```
[smcp label] [filled/required (mono)] [5-cell sparkline] [verdict glyph]
E1 TREATY      04/05                   ■ ■ ■ ■ ▢          ✓
E2 SUBSTANTIAL 02/06                   ■ ■ ▢ ▢ ▢ ▢        ‡
```

**Sparkline:** 5 cells × 8 × 12 px, 2 px gap. Filled = `ink`, weak (APS<3) = `graphite`, missing = `paper-deep`. No color.

**Verdict glyph:** `✓` over-spec or at-spec; `·` near-spec; `‡` under-spec. Alarm border (left 2 px in `--accent-alarm`) if any `fatal_gaps.length > 0`.

**Data source:** `auditDocuments({ case_profile: e2_subtype derived, filled_exhibits: typedMemory derived })` from `lib/e2/document-audit.ts:auditDocuments`.

### 3.h · `FactSheet` — section 6 Conflict register

**Composition:**
- Sev 4–5 inline as `ConflictSidecar` rows. Each row:
  `[‡ glyph] [conflict_type slug (mono)] [description] · A: <doc>p.<n> · B: <doc>p.<n>`.
- Sev 1–3 collapsed behind chip: `12 minor — click to expand`. Click → right rail shows full sev-1–3 list.

**Severity → visual:**
| sev | weight              | glyph | position cue                    |
| --- | ---                 | ---   | ---                             |
| 5   | bold ink + alarm border | `‡` | inline + 2-px alarm border    |
| 4   | semibold ink        | `‡`   | inline                          |
| 3   | medium ink-2        | `‡`   | sidecar collapsed               |
| 2   | regular graphite    | `·`   | sidecar collapsed               |
| 1   | regular graphite    | `·`   | sidecar collapsed               |

**Data source:** `result.caseFacts.facts.conflict_register` (`ConflictEntrySchema`).

**Click handler:** sev 4–5 row → right rail `ConflictDiff` with A vs B side-by-side, three actions (`dismiss · resolve A · resolve B · note`).

### 3.i · `FactSheet` — section 7 Binder (Exhibit grid)

**Composition:**
- Pinned at top: `NeedsReviewPile` (NEW) — any entry whose `doc_type === 'other'` OR classifier confidence < 0.85 OR has unresolved override-pending state.
- Then 9 category rows from `EXHIBIT_CATEGORIES` (`page.tsx:2673`):
  ```
  1 · Applicant Documents          12 docs · 47p ✓
  2 · Company Documents            04 docs · 32p ✓
  3 · Source of Funds              09 docs · 41p ‡ (membership transfer drift)
  ...
  9 · Others                       06 docs · 22p ·
  ```
- Each row click → expand into right rail with the per-doc list (thumbnails). Default collapsed.

**Per-row needs-review computation:**
- `entries.filter(e => e.doc_type === 'other' || (e.facts.confidence ?? 1) < 0.85 || overrides[e.filename]?.doc_type_override !== null && !reaggregatedSinceOverride).length`.

**Data source:** `typedMemory: TypedMemory` + `documentOverrides`.

**Two-click reclassification:**
1. Click row in `NeedsReviewPile` → right rail opens with `DocTypeQuickPicker` over the bot's doc_type, showing `(detect 0.72)` next to the bot's classification.
2. Pick new doc_type → `applyMatterOverridePatch({ document: { filename, doc_type_override } })` → audit entry written → `LogPane` row appears `re-classified · AS · 14:32 · re-aggregate to refresh facts`.

### 3.j · `FactSheet` — section 8 Drafts

**Composition:** `DraftGate` rows, one per generator group from `generate-panel.tsx`:
```
Cover letter and exhibit index
  · cover_letter            [Identity ✓ · Enterprise ✓ · SOF ‡ · Conflicts ✓]   gated · see facts
  · exhibit_list            [—]                                                  unlocked
  · business_plan           [Investment ✓ · Items ✓ · Marginality ‡]            gated-soft

Declarations
  · declaration_beneficiary [Identity ✓ · Investor ✓]                            unlocked    last AS · 14:32 · v0.5.docx
  · declaration_spouse      [Dependents ‡]                                       gated · 1 unset
  · declaration_enterprise_rep [Ownership ✓]                                     unlocked

USCIS / DOS forms
  · forms_i129              [Identity ✓ · Enterprise ✓]                          unlocked
  · forms_i129e             [Investment ✓ · Conflicts ✓]                         unlocked
  · forms_g28               [Identity ✓]                                         unlocked
  · forms_i539              [Dependents ‡]                                       gated
  · forms_i539a             [Dependents ‡]                                       gated

Notices of Intent to Depart
  · noid_principal          [— — — RFE pending: unlocked]                        unlocked
  · noid_dependent          [— — — RFE pending: unlocked]                        unlocked
```

**States per row:** `gated · gated-soft · unlocked · awaiting-initials · generating · complete · failed`.

**Gating logic:**
- `gated` if any fatal-missing field unset OR any sev-5 conflict open OR any 13-gate verdict severity ≥ 5.
- `gated-soft` if any sev-3/4 conflict open.
- `unlocked` if all clean OR sev-3 explicitly acknowledged.

**Click `gated`:** right rail shows `BlockerList` — exact list of blockers with field_paths and conflict_types, each clickable to scroll the fact sheet to the offending row.

**Click `unlocked`:** right rail opens `PreGenerationRail`.

**Data source:** `globalGenerationQueue` for in-flight; `caseFacts.conflict_register` + `auditDocuments` for gating.

### 3.k · `FactSheet` — section 9 Audit log

**Composition:** `LogPane` (existing, refactored) — reverse-chronological list of `auditTrail[]` entries from `lib/preview-store.ts`. Each row:
```
2026-05-01T14:32:08Z · AS · fact_edit · facts.investment.total_committed_usd · 410000 → 425000
2026-05-01T14:30:15Z · AS · doc_type_override · garanti_FX_confirmation.pdf · money_movement → source_of_funds
2026-05-01T14:28:01Z · clerk · ingest_complete · 87 PDFs · 412 pages
```

Mono throughout. RFE filter: `since:rfe` shows only entries after the RFE issuance date.

### 3.l · `AuditMargin` (gutter on right edge of center column)

**Composition:** 14 px wide column, `paper-3` ground, no marks by default.

**Per `FactRow`:** a 4-px ink dot sits in this gutter at row level. Hover row → dot expands into a horizontal pill: `AS · 14:32 · src G-28.pdf p.2`. Click → pin the full audit trail into the right rail.

**States:** `quiet · revealed · pinned`.

**Accessibility:** the dot is decorative; attribution is exposed via `aria-describedby` on each `FactRow`.

### 3.m · The right rail (citation pane) state machine

**Default:** empty, with the matter's last-touched line + `Cmd+K` hint.

**On hover/focus of `FactRow`:** fills with provenance:
- source PDF + page (mono)
- source quote (italic body, max 8 lines)
- classifier confidence (`detect 0.87`)
- full audit trail for this field (reverse-chronological)
- inline edit field (`Cmd+Enter` commit, `Esc` revert)

**On click of sev-4/5 conflict:** fills with `ConflictDiff` (A vs B side-by-side).

**On click of `gated` `DraftGate` row:** fills with `BlockerList`.

**On click of `unlocked` `DraftGate` row:** fills with `PreGenerationRail`.

**On `approve & generate`:** rail stays open, switches to streaming markdown of the draft. Sticky bottom shows `generating · 02:14 · run in background ↘`.

**On click of `[ex. 3-A p.12]` in draft:** fills with PDF preview at that page (`DocumentPreviewFrame fillContainer=false src={apiFileUrl(filename) + "#page=" + n}`).

**On click of `NeedsReviewPile` row:** fills with `DocTypeQuickPicker` over the bot's classification.

**On click of audit margin dot:** fills with the full audit trail pinned.

---

## 4. Generation flow

### 4.a · Pre-generation rail (replaces modal)

**Source API:** `POST /api/matter/[id]/preview { generator, args, case_facts, typed_memory }` returns `PreviewRecord` (`lib/preview-store.ts`).

**Rendered fields (top to bottom):**
1. Decision summary (1 paragraph).
2. Risk register (sev-coded list, sev 1–3 collapsed, sev 4–5 inline).
3. Structural outline (numbered).
4. Citations (mono list, status from `AuthorityCiteCheck`).
5. Implications (1 paragraph).
6. Source fields (collapsed under `▸ show all 87 source fields`). Each row click-to-edit inline.

**Sticky bottom of rail:**
```
Attorney initials  [______]
[ reject ]                          [ approve & generate → ]
```
- `attorney_initials` minimum 2 chars; required.
- `reject` posts `/api/matter/[id]/approve { approved: false }`; closes rail.
- `approve & generate` posts via `globalGenerationQueue.enqueue()` (existing); closes rail; chip in stack appears.

**Edit flow:** click any field row → inline input (reuse `EditableCell`-style); `Cmd+Enter` commits to `edits[]` array; `Esc` reverts; commit fires only on `approve & generate` (not on each blur, to keep the preview as the source of truth until decision time).

### 4.b · Generation in flight

**Components:**
- Right rail shows streaming markdown via existing `streamingDraft` (`page.tsx:427`) + per-paragraph render.
- Sticky bottom: `generating · 02:14 · run in background ↘ · cancel ✕`.
- `GenerationToastStack` chip in bottom-left increments.

**Timeout:** none enforced UI-side; respect server-side timeout. If `> 5 min`, show banner `slow generation — usually completes in 02:30.`

### 4.c · Generation complete

**Components:**
- Right rail collapses to a banner block: `cover_letter_v0.5.docx · AS · 14:32`.
- Banner has 3 buttons: `download .docx · download .md · view inline`.
- `view inline` expands the rail downward with the rendered markdown + the `AuthorityCiteCheck` panel beneath.
- `DraftGate` row in the fact sheet updates to `complete` with last attempt timestamp + initials.

**Audit:** `auditTrail` entry written: `generation_complete · AS · 14:32 · cover_letter · v0.5.docx`.

### 4.d · Generation failed

**Components:**
- Right rail shows error in `text-meta ink` with the error message.
- Two buttons: `retry · view log`.
- `GenerationToastStack` chip turns to error state (border-ink).
- `LogPane` writes a `generation_failed` entry.

---

## 5. Cross-cutting

### 5.a · Cmd+K dossier search

**Trigger:** `Cmd+K` from anywhere in the app.

**Surface:** `paper-recess` overlay, no scrim, ~640 px wide centered, `text-fact` for the search input.

**Indexes searched:**
- Facts: every `Field<T>` in `caseFacts.facts` matched by field_path slug or value.
- Exhibits: every entry in `typedMemory` matched by filename or `display_name`.
- Conflicts: every `conflict_register` entry matched by `conflict_type` or description.
- Proof slots: every slot in `proof-slots.ts` matched by id or description.
- Drafts: every `DraftGate` row matched by generator name.

**Result row format:** `[type icon (smcp)] · [path or ID (mono)] · [primary value (text-body)]`.

**Action:** `Enter` on a result → scrolls fact sheet to the corresponding row + opens right rail with provenance.

**Empty state:** typing nothing shows `recent` (last 5 fields touched) + `where you were last` (the last edit's field_path).

### 5.b · Keyboard cheatsheet

**Trigger:** `?`.

**Surface:** `paper-recess` overlay, no scrim, ~480 px wide.

**Contents:**
```
NAVIGATION
g f / g c / g p / g r           jump to facts / chain / proof / register
g b / g d / g a / g l / g x     jump to binder / drafts / audit / log / context
o                               open the matter (full-screen overlay)
Esc                             close rail / overlay / cheatsheet

EDITING
e                               edit current row in right rail
Cmd+Enter                       commit edit
Esc                             revert edit

DOSSIER
Cmd+K                           dossier search
j / k                           row down / up in fact sheet
Cmd+O                           open folder (ingest)

DRAFTS
Cmd+S                           re-aggregate (recompute facts from cache)
```

### 5.c · Reduced motion

`@media (prefers-reduced-motion: reduce)`:
- `--alarm-breath-anim`: `none` (border holds at 1.0 alpha).
- All `transition-duration` reduced to 1 ms.
- `:focus` rings static, no fade.
- `cite-reveal` static (underline immediate, not animated).
- `pulse-dot-bg` static.
- Typewriter table renders instantly (no 60 ms stagger).

### 5.d · Persistence

Stored in localStorage:
- `akalan:context:v1:<matterId>` — context pane text (existing).
- `akalan:context-result:v1:<matterId>` — context pane cross-check result (existing).
- `akalan:scroll:v1:<matterId>` — last scroll anchor + offset (NEW). On matter open, scroll restores. ResumeMarker.
- `akalan:last-edit:v1:<matterId>` — last-edited field_path (NEW). `Cmd+K` highlights this in `recent`.
- `akalan:cheatsheet-seen:v1` — boolean (NEW). On first launch only, the cheatsheet hint pulses for 1 cycle.

Stored on disk via `/api/matter-overrides`:
- `matter_display_name` (existing).
- `documents[filename].doc_type_override` (existing).
- `documents[filename].display_name` (existing).

### 5.e · Accessibility

- All text contrast ≥ AA on `paper`. `--accent-alarm` `#7A2F1F` on `paper` `#FAFAFA` is AA at 16 px regular and AAA at 14 px bold — verified.
- Focus rings: 1.5 px solid `ink`, 2 px offset. Never removed.
- Audit margin gutter is decorative; attribution exposed via `aria-describedby`.
- `FactRow` is a `button` with `aria-describedby` pointing at its source citation.
- `unset` rows include `aria-label="unset, click to fill {field name}"`.
- The streaming draft is `aria-live="polite"` so screen readers don't read every chunk.
- The generation chip is `role="status"` `aria-live="polite"` (existing).

---

## 6. Global tokens (final)

### 6.a · Palette

```css
--color-paper:        #FAFAFA;
--color-paper-2:      #F0F0F0;
--color-paper-3:      #E5E5E5;
--color-paper-deep:   #D4D4D4;
--color-ink:          #0A0A0A;
--color-ink-2:        #1F1F1F;
--color-graphite:     #404040;
--color-graphite-soft:#595959;
--color-rule:         rgba(10,10,10,0.10);
--color-rule-strong:  rgba(10,10,10,0.32);
--accent-alarm:       #7A2F1F;     /* sev 5 + fatal-missing only */
```

### 6.b · Type scale

```
text-eyebrow  11/14  600 caps  +0.14em      smcp
text-label    12/16  400 mono  0            ids, page cites, hashes
text-meta     13/18  400       0            tail captions, conflict refs
text-body     14/20  400       0            fact descriptions
text-fact     16/22  500       -0.005em     fact sheet primary values
text-title    22/26  600 disp  -0.012em     panel titles, matter name short
text-page     32/36  400 disp  -0.018em     matter header H1
text-stunt    88/84  300 disp  -0.025em     empty-state hero only
```

### 6.c · Motion curves

```
--ease-paper:    cubic-bezier(0.22, 0.61, 0.36, 1);   /* default */
--ease-decisive: cubic-bezier(0.16, 1, 0.30, 1);      /* gate, generate */
--ease-margin:   cubic-bezier(0.40, 0.00, 0.60, 1);   /* right-rail swap */

duration-micro:    120ms
duration-standard: 240ms
duration-decisive: 400ms

@keyframes alarm-breath {
  0%, 100% { border-color: rgba(122,47,31,0.55); }
  50%      { border-color: rgba(122,47,31,1.0); }
}
.alarm-row[data-alarm-seen="false"] {
  animation: alarm-breath 2s sine 1;
}
```

`prefers-reduced-motion: reduce` disables the breath and slows transitions to 1 ms.

### 6.d · Spacing

- Outer padding: 48 px
- Three-column gap: 24 px
- Section gap inside fact sheet: 56 px
- Row gap inside section: 0 px (table-like) or 16 px (group)
- Fact row: 28 px standard / 44 px with provenance strip
- Diagram: 240 px
- Right rail: 320 px wide
- Left rail: 240 px wide
- Gutter: 14 px

### 6.e · Keyboard map (v1)

```
g f / g c / g p / g r / g b / g d / g a / g l / g x   jump to anchor
j / k                                                 row down/up
e                                                     edit current row in rail
Cmd+Enter                                             commit edit
Esc                                                   revert / close rail
Cmd+K                                                 dossier search
?                                                     cheatsheet
o                                                     open the matter overlay
Cmd+O                                                 open folder (ingest)
Cmd+S                                                 re-aggregate
```

### 6.f · Tech constraints

- Next.js (the breaking version per `node_modules/next/dist/docs/`)
  + Tailwind + Electron host. `AGENTS.md` token-discipline rule in
  force: short replies, no decorative summaries, comments only when
  the WHY is non-obvious.
- All API contracts preserved (see prompt §14).
- All data shapes preserved (`E2Facts`, `IngestSuccess`,
  `PreviewRecord`, `PreviewFactRow`, `PreviewConflictEntry`,
  `TypedMemory`, `DocType`, `E2CaseSubtype`,
  `MissingnessReport`, `SlotResolution`, `ConflictRegisterEntry`).
- Two new tokens (already added in v2): `--accent-alarm`, `text-fact`.
- Two new tokens added in v3: `text-stunt` (88/84 300 -0.025em, only
  for the home empty state); `--ease-margin` (already documented in
  v2 motion section, now wired to right-rail swap).
- Sankey diagram: hand-rolled SVG, ~80 lines, no chart library.
- Sparkline: Tailwind divs, no JS lib.
- Anchor scroll: `Element.scrollIntoView({ behavior: 'smooth', block: 'start' })` with `prefers-reduced-motion` honored.

### 6.g · Files touched

```
app/page.tsx                                  (rewrite Dossier(); kill DossierTabs; mount AnchorRail + FactSheet)
app/components/case-overview-card.tsx         (folded into MatterHeader)
app/components/sof-chain-table.tsx            (kept as fold-down)
app/components/sof-chain-diagram.tsx          (NEW)
app/components/conflict-register.tsx          (rewrite as ConflictSidecar)
app/components/document-inventory.tsx         (rewrite as ExhibitGrid)
app/components/generate-panel.tsx             (rewrite as DraftGate)
app/components/pre-generation-approval.tsx    (relocate to PreGenerationRail; keep modal API)
app/components/pre-generation-rail.tsx        (NEW; thin wrapper around the same logic)
app/components/loading-progress.tsx           (recolor band only)
app/components/section-accordion.tsx          (no change)
app/components/operations-expenditure-table.tsx (no change)
app/components/authority-cite-check.tsx       (relocate to right rail)
app/components/generation-toast.tsx           (demote to single chip)
app/components/proof-slot-matrix.tsx          (NEW)
app/components/draft-gate.tsx                 (NEW)
app/components/anchor-rail.tsx                (NEW)
app/components/fact-sheet.tsx                 (NEW)
app/components/fact-row.tsx                   (NEW)
app/components/audit-margin.tsx               (NEW)
app/components/right-rail.tsx                 (NEW; the mutating citation pane)
app/components/needs-review-pile.tsx          (NEW)
app/components/blocker-list.tsx               (NEW; the gated-draft drill-in)
app/components/conflict-diff.tsx              (NEW; sev-4/5 diff in rail)
app/components/cmd-k.tsx                      (NEW; dossier search)
app/components/cheatsheet.tsx                 (NEW; ? overlay)
app/globals.css                               (recolor sage→sky→ochre band; add alarm-breath keyframe; add text-stunt + ease-margin)
tailwind.config.ts                            (no change beyond v2)
```

No files removed. Everything that was a tab becomes a scroll section.
