# Atelier — Full-System Redesign (Designer B, v3)

> Paste-ready brief for a fresh Claude. Deliverable: redesign the entire
> Atelier product as a *deposition binder reading instrument*. Every
> screen, every state, every cross-cutting concern. Usefulness above all.
>
> Designer A is likely chasing aesthetic coherence. We are chasing
> *attorney velocity*: time-to-first-decision, errors-prevented,
> handoff-resilience. Aesthetic is downstream of those.

---

## 1. one-line vision

Atelier is one continuous **deposition binder**. The home is its index.
The dossier is its master fact sheet. Every generator is a stamp on the
binder, and every generation is **mechanically gated** by what the binder
says is missing or contradicted.

The attorney never navigates *away from the matter she is reading*. She
hands it off and the next reader lands inside the same scroll position
with a margin gutter showing who touched what.

## 2. context

- Desktop Electron app for an immigration attorney (sole user, fluent).
- Single matter type live: E-2 (4 sub-types). EB-1A/B/C reserved.
- 13" MBP minimum, 27" iMac maximum. Optimize for 1440 px wide first.
- The pipeline (`docs/CAPABILITIES.md`) is fixed: Phase 0 → 0.6 → 1 → 2,
  26 doc-types, 13 deterministic gates, `Field<T>` provenance on every
  leaf, 39 proof slots across 5 E-2 elements (`lib/e2/proof-slots.ts`).
  This redesign **does not propose backend changes**. It propose a UI
  that finally renders what the backend already returns.
- Existing IA spine: ingest → dossier → generate. Reorganize within it,
  do not break it.
- Existing tokens stay (`paper`, `paper-2`, `paper-3`, `paper-deep`,
  `ink`, `ink-2`, `graphite`, `graphite-soft`, `rule`, `rule-strong`).
  Two new tokens earned in v2 stay: `--accent-alarm` `#7A2F1F` and
  `text-fact` `16/22 500 -0.005em`. No further accents.
- **Courier New is the monospace voice** — file paths, IDs, page
  citations, hashes, audit timestamps, doc_type slugs. Non-negotiable.
- Display: `Source Serif Pro` (existing `font-display`) for matter name,
  panel titles, and the empty-state hero only. Body: existing sans
  default. Italic = absence (an `unset` field). Italic is never
  emphasis.
- Pipeline is slow (35 s ingest median, 30 s re-aggregate, 60 s cover
  letter draft). UI must make wait time **feel like surveillance**, not
  spinner-watching. The attorney watches the binder fill in, not a bar.

## 3. references — by workflow problem solved

| Problem this UI must solve                                     | Reference                                            | What to borrow                                                                                | What NOT to borrow                |
| ---                                                            | ---                                                  | ---                                                                                           | ---                               |
| matter index that doesn't pretend to be a CRM                  | A trial attorney's case-list legal pad               | a list of names with one trailing chip (status), no pictures                                  | manilla folder skeuomorphism      |
| dense facts you scan, never navigate                           | Bloomberg Terminal MAIN window                       | one rectangle of canonical facts always pinned                                                | green-on-black                    |
| at-a-glance gap detection across 87 fields                     | Bloomberg Law docket sheet                           | the run of `unset` markers — texture of absence reads instantly                               | 1998 chrome                       |
| left rail of permanent anchors, right rail mutates             | Linear issue page                                    | two-rail anchor + content split; spacebar-zoom focus                                          | rounded SaaS chrome               |
| live ingest as binder filling itself                           | Stripe radar live event log                          | streaming row-per-event, monospace, lowest-disclosed first                                    | green ✓ confetti                  |
| diff view at the fact, not in a separate audit                 | Google Docs suggested edits                          | inline strike-through + side-margin glyph for sev 4–5                                         | red/green; comment-thread chrome  |
| SOF chain as one readable diagram                              | FT Visual Vocabulary Sankey                          | left-to-right flow, stroke = USD, deltas printed in margin                                    | rainbow segments                  |
| audit trail without leaving the page                           | GitHub git blame gutter                              | 14 px margin column with attribution dots; hover expands; click pins                          | full-bleed diff panes             |
| document-as-citation, not document-as-thumbnail                | Westlaw KeyCite                                      | `[ex. 3-A p.12]` parenthetical jumps to PDF in same column                                    | branded chrome                    |
| keyboard-first navigation                                      | Superhuman                                           | `g f / g s`, `Cmd+K`, `?` cheatsheet as `paper-recess` overlay                                | gamified onboarding               |
| draft + source-of-truth visible at the same time               | A litigator's two-monitor setup                      | the draft pane scrolls independently; fact sheet stays pinned in margin                       | code-editor split-pane chrome     |
| state-aware loading that earns its 35 s                        | Bloomberg ingest "BUILDING THE DASHBOARD" (existing) | typewriter table that *fills as facts land*; nothing fake                                     | rainbow gradient progress         |
| pre-generation approval as a contract, not a click             | Wet-ink signature blocks                             | initials field is required, sticky bottom of rail; missing initials = no submit               | DocuSign branding                 |
| reclassification you do in two clicks                          | Gmail label keyboard picker                          | type-to-filter dropdown over the bot's classification, classifier confidence visible          | "are you sure?" modal             |
| paralegal handoff that doesn't lose the thread                 | Pacific Reporter's "Continued at p. 412"             | last-touched line in matter header; resume marker honored on next open                        | "welcome back!" modal             |

Anti-references: any AI tool with sparkles or rainbow gradients
(v0/Cursor/Replit aesthetic); Notion-AI page summaries (too soft);
Salesforce Lightning (density without typographic discipline); Linear's
empty states (too playful); Apple Notes (too round); MS Copilot
suggestion cards (sells generation; we gate it).

## 4. palette

```
--color-paper          #FAFAFA   sheet (everywhere by default)
--color-paper-2        #F0F0F0   recessed surfaces, sticky eyebrow strips, header chip
--color-paper-3        #E5E5E5   audit gutter ground, chain background
--color-paper-deep     #D4D4D4   inactive thumbnails, severity 1 dots
--color-ink            #0A0A0A   primary type, severity 5 marks, primary CTA fill
--color-ink-2          #1F1F1F   secondary type, severity 4 weight, in-progress fills
--color-graphite       #404040   tertiary type, smcp eyebrows, severity 3
--color-graphite-soft  #595959   trailing meta, page citations, severity 1–2, italic 'unset'
--color-rule           rgba(10,10,10,.10)   hairlines, table borders
--color-rule-strong    rgba(10,10,10,.32)   emphatic borders, fact-sheet frame
--accent-alarm         #7A2F1F                oxidized red ochre — sev 5 + fatal-missing ONLY
```

The accent is the only chromatic mark in the entire UI — **the wax seal
on a sealed envelope**. It appears on:

- the 2-px left border of a `FactRow` whose value is `alarm-fatal`,
- the inline glyph (`‡`) on a sev-5 `ConflictSidecar` row,
- the delta number (`−$5,000`) on a discrepant SOF leg,
- the gate verdict pill in `MatterHeader` when drafts are blocked,
- the `‡` glyph on an anchor in the left rail when its section
  contains a fatal item.

**Nowhere else.** Severity 4 is bold ink. Severity 1–3 is graphite.
Color enters at sev 5. Period.

## 5. typography

```
font-display    'Source Serif Pro' (existing slot), 300/400/600/700
font-body       Inter / system sans, 400/500/600
font-mono       'Courier New', 400/700                     ← non-negotiable
```

| token         | size / line                | weight       | tracking      | use                                                |
| ---           | ---                        | ---          | ---           | ---                                                |
| `text-eyebrow`  | 11 / 14                  | 600 caps     | +0.14em       | smcp section labels (`facts`, `chain`, `register`) |
| `text-label`    | 12 / 16                  | 400 mono     | 0             | page citations, IDs, hashes, file paths            |
| `text-meta`     | 13 / 18                  | 400          | 0             | tail captions, exhibit refs, conflict refs         |
| `text-body`     | 14 / 20                  | 400          | 0             | facts, descriptions, conflict text                 |
| `text-fact`     | 16 / 22                  | 500          | -0.005em      | **fact sheet primary values** (v2 token)           |
| `text-title`    | 22 / 26                  | 600 display  | -0.012em      | matter name (binder rail), panel titles            |
| `text-page`     | 32 / 36                  | 400 display  | -0.018em      | matter header H1                                   |
| `text-stunt`    | 88 / 84                  | 300 display  | -0.025em      | empty-state hero only ("Drop a dossier.")          |

Italic is reserved for `unset` fields. Tabular numerals on every
numerical field. Mono adjacent to prose is the visual cue for **audit
truth** — anything you can copy-paste into a document and have it still
mean something is mono.

## 6. layout & spacing — the whole product

The product is a single `h-screen` shell, three structural rows:

```
┌─────────────────────── Header (3.25rem) ────────────────────────────┐
│  atelier.        ⌘K search the binder        clock · matter ref     │
├──────┬───────────────────────────────────────────────┬──────────────┤
│  L   │              CENTER                           │      R       │
│ 240  │  fluid 720–1100 px                            │   320        │
│  px  │                                               │      px      │
│ rail │  fact-sheet OR draft OR exhibits OR audit     │  citation /  │
│      │  (depending on selected anchor)               │  edit pane   │
├──────┴───────────────────────────────────────────────┴──────────────┤
│  Status bar (1.75rem) — clock, file count, last-touched, queue jobs │
└─────────────────────────────────────────────────────────────────────┘
```

### The home (no matter selected)

- Center is `DossierEmpty` redrawn: the **stunt headline** is replaced
  by a **list of matters** rendered like a printed legal pad. Each
  matter is one line: `<matter name> · <subtype> · <gate verdict> ·
  <last touched>`. No cards. No icons. The list is dense (24 px row,
  ~1100 px wide, 30 fits without scroll on a 13").
- Below the list: a **single drop zone** rendered as a 1 px hairline
  rectangle at full center width, label `drop a dossier · or ⌘O` in
  smcp graphite-soft. No dashed border. No "or click to upload" copy.
  The zone IS the rest of the page.
- Drag-active state: the zone fills with `paper-2`, the hairline
  thickens to 2 px ink, the label swaps to `release to ingest · 87
  PDFs detected`. No bouncing icon, no animation.
- Pre-flight: while `Phase 0` runs, the zone shrinks to 56 px tall and
  shows `detecting case type — Haiku 4.5 · ~1 s`. Source of that
  string: `ingest/detect.ts:151`.

### The dossier (matter selected)

The center column is the **fact sheet by default** (v2's design holds).
The left rail is now an **anchor list** *and* a **matter list** — same
240 px column, two stacked sections separated by a hairline:

```
240px LEFT RAIL
┌────────────────────────┐
│ MY MATTERS  · 14       │  ← BinderSection, existing component, demoted
│  · Kacar-Salih [‡]     │     to a 11-line list at the top
│  · Camural-Pomega [✓]  │
│  · Demir-LLC [·]       │
│  · ... (scroll)        │
├────────────────────────┤  ← hairline rule
│ THIS MATTER            │  ← AnchorRail, the new v2 thing
│  ‡ facts (3 unset)     │
│  ✓ chain               │
│  · proof slots (4/5)   │
│  ‡ register (1 sev 5)  │
│  · binder              │
│  · drafts (2 gated)    │
│  · audit               │
│  · log                 │
│  · context             │
└────────────────────────┘
  ⌘K  ?
```

- Glyph mapping: `✓` complete · `·` partial · `‡` blocked or alarm.
- Anchors are *scroll positions*, not tabs. Clicking scrolls; doesn't
  navigate.
- Keyboard map: `g f` facts · `g c` chain · `g p` proof · `g r`
  register · `g b` binder · `g d` drafts · `g a` audit · `g l` log ·
  `g x` context. `j/k` row down/up inside the fact sheet. `?` shows
  cheatsheet.

The center column scrolls one long document containing all 9 sections
in this order — *no tabs anywhere*:

1. **Identity** (FactSheet section)
2. **Enterprise** (FactSheet section)
3. **Investment posture** (FactSheet section + `OperationsExpenditureTable` collapsed)
4. **Source-of-funds chain** — `SofChainDiagram` (240 px diagram + tabular fold-down)
5. **Proof slot matrix** — `ProofSlotMatrix` (5 rows, sparkline)
6. **Conflict register** — `ConflictSidecar` inline (sev 4–5 only); sev 1–3 chip
7. **Binder** — `ExhibitGrid` (1–9 categories from `EXHIBIT_CATEGORIES`)
8. **Drafts** — `DraftGate` rows (one per generator)
9. **Audit log** — `LogPane` reverse-chronological audit trail

Each section has a sticky `text-eyebrow` that holds inside its viewport
during scroll, so you always know where you are even at row 47.

The right column is the **mutating citation pane**:

- default state: empty, with the matter's last-touched attribution and
  the dossier search box.
- on hover/focus of any `FactRow` → fills with provenance: source PDF +
  page, classifier confidence, full audit trail, inline edit field.
- on click of a sev-4/5 conflict → fills with the diff view: A vs B
  side-by-side with full provenance and three actions (`dismiss ·
  resolve A · resolve B · note`).
- on `approve & generate` → fills with the **PreGenerationRail** (v2
  relocated `PreGenerationApprovalModal`); rail stays open while the
  attorney scrolls the fact sheet to verify.
- on a draft generation in flight → shows the streaming markdown of
  the draft *as it streams* (existing `streamingDraft` state in
  `app/page.tsx:427`). The streaming text appears in the rail, the
  fact sheet stays in the center.
- per-PDF preview → opens *inline in the rail*, not a modal.
  `DocumentPreviewFrame` already supports this with `fillContainer=false`.

### Spacing & density

- Outer padding: 48 px.
- Three-column gap: 24 px.
- Section gap inside fact sheet: 56 px.
- Row gap inside section: 0 px (table-like) or 16 px (group).
- `FactRow` height: 28 px (data) / 44 px (with provenance strip).
- `SofChainDiagram`: 240 px tall.
- `ProofSlotMatrix`: 5 rows × 32 px = 160 px.
- `ExhibitGrid`: 9 categories × 36 px collapsed; expand to per-row
  doc list (44 px per doc).
- `DraftGate`: 14 generator rows × 36 px = 504 px (a single readable
  page).
- Right rail content: 24 px outer padding, 16 px between blocks.

### The matter overlay (Open the matter)

The full-screen overlay (existing — see `MatterOverlay` in `page.tsx`)
becomes the **printable view**: same fact sheet, bigger type
(`text-page` for matter name, `text-title` for section eyebrows),
*without* the right rail. Shortcut: `o`. ESC closes. The overlay is
what you'd PDF for client review.

## 7. motion grammar

Atelier is a legal instrument. Motion is restraint.

```
--ease-paper      cubic-bezier(0.22, 0.61, 0.36, 1)   ← default for all UI
--ease-decisive   cubic-bezier(0.16, 1, 0.30, 1)      ← gate, generate, draft-ready
--ease-margin     cubic-bezier(0.40, 0, 0.60, 1)      ← right-rail content swap
```

```
duration-micro     120ms      hover, eyebrow underline, rule reveal, save flash
duration-standard  240ms      anchor scroll, panel content swap, edit mode
duration-decisive  400ms      gate banner appear, alarm dot first-time pulse
```

Only ambient motion in the entire app: a fatal-unset row's 2-px
left alarm border breathes between `rgba(122,47,31,0.55)` and
`rgba(122,47,31,1.0)` on a 2 s sine — **for one cycle**, on first
viewport intersection per row. After the eye has caught it, it stays
solid. Implement via `IntersectionObserver` + `data-alarm-seen`
attribute. The UI does not nag.

`prefers-reduced-motion`: kill the alarm breath; cut all transitions
to 1 ms; keep `:focus` rings static. Audit attribution still hovers
in instantly.

**Existing utilities to keep verbatim** (`globals.css`):
- `fade-in` (200 ms ease-out) — reuse for right-rail content swap.
- `cite-reveal` — repurpose for provenance underline reveal under a
  fact row.
- `dinkus` — used between major fact-sheet sections (the only piece of
  typographic ornament in the whole app).
- `paper-recess` — eyebrow strips, sticky headers, gate banner.
- `paper-grain` — page background.
- `pulse-dot-bg`, `ring-spin`, `sweep-bar`, `pct-tick` — keep for
  ingest progress and background-job chips.

**Existing utilities to retire / repurpose:**
- The sage→sky→ochre rainbow band in the loading bar (`globals.css`
  near line 287) — recolor to `text-ink-2` solid hairline. The rainbow
  is the only existing UI that shouts.

No spring physics. No bounces. No staggered card entrance. No
parallax. No rounded SaaS chrome.

## 8. component inventory — every surface

Names are stable. Existing components are listed with their refactor
target. New components are marked `(NEW)`.

### Pre-matter / home

- **`Header`** (existing, retouched) — `atelier.` wordmark, ⌘K, clock.
  Unchanged structurally; new `text-eyebrow` for the wordmark trailer.
- **`Binder` left rail** (existing, retouched) — recipe in §6 above.
  States: `idle` · `dragging` · `ingesting` · `error`.
- **`MatterListLine` (NEW)** — replaces `BinderRow`. 28 px row,
  4-column grid `[name | subtype-pill | gate-glyph | last-touched]`.
  Last-touched in mono graphite-soft. Hover: `paper-2/40` + sparkline
  cross-fades in showing 7-day touch history.
- **`DropZone` (NEW)** — full-width hairline rectangle at the bottom of
  the home center. States: `idle` · `dragging` · `pre-flight` ·
  `phase-1-running` · `error`. Replaces the dashed-border pattern.
- **`DossierEmpty`** (existing, demoted) — kept as the truly-empty
  case (zero matters, never ingested). The stunt headline survives.
  Reachable in production only on first launch.

### Ingest / loading

- **`LoadingProgress`** (existing) — keep in place. The 7-cell stage
  strip (scan / subtype / classify / aggregate / draft / review /
  assemble) and the typewriter table both stay. Recolor: kill the
  rainbow band to `text-ink-2`. Reuse for the home pre-flight state
  AND the matter overlay (existing).
- **`BackgroundIngestPill`** (existing) — keep at fixed bottom-right.
  States: `working` · `error` · `cancellable`. Its `onCancel` already
  posts `/api/ingest-path/cancel`; preserve.
- **`IngestExpandOverlay`** (existing — `expandedIngestId` flow in
  `page.tsx:1643`) — keep. Two CTAs at top: `run in background ↘` and
  `cancel ingestion ✕`.

### Dossier / fact sheet

- **`MatterHeader` (NEW, replaces existing dossier header)** — 96 px
  fixed strip. Holds: matter name (`text-page`), subtype pill, posture
  pill, dependents chip, RFE chip if present, the gate banner (single
  line: `3 facts blocking · 1 sev-5 conflict · 2 drafts gated`),
  ⌘K hint. Sticky at top of center column. Never scrolls.
  States: `unloaded` · `loaded-clean` · `loaded-with-gate` ·
  `loaded-with-alarm`.
- **`AnchorRail` (NEW, in left rail under matter list)** — anchors in
  §6. States: `idle` · `scrolled` (current anchor highlights) ·
  `alarm` (anchor glyph swaps to `‡` in `--accent-alarm`).
- **`FactSheet` (NEW, replaces tab system)** — 9 stacked sections,
  sticky eyebrows, 56 px between sections. States:
  `loading-skeleton` · `partial` · `complete`. Renders the 8 fact
  sections from `E2Facts` + the binder + the drafts.
- **`FactRow` (NEW, the unit)** — 28 px, 4-col grid
  `[label | value | inline glyph | source ref]`. States:
  `set · unset · edit · saving · saved-flash · error · alarm-fatal`.
  Reuses `EditableCell` from `sof-chain-table.tsx` API contract
  (`/api/matter/[id]/fact PATCH`).
- **`SofChainDiagram` (NEW, replaces `SofChainTable` as primary)** —
  Sankey diagram, 240 px tall, stroke = USD scaled (capped 24 px),
  inline glyph per leg (`✓ · ‡`), delta margin numbers in mono ochre
  for discrepant legs. Existing `SofChainTable` becomes a fold-down
  "tabular view" toggle beneath the diagram.
- **`ProofSlotMatrix` (NEW)** — 5 rows (one per E-2 element), each
  row: `slots filled / required` (mono tabular), 5-cell sparkline
  (`■ ■ ■ ▢ ▢` style), verdict glyph. Data source:
  `lib/e2/proof-slots.ts` + `lib/e2/document-audit.ts:auditDocuments`.
- **`ConflictSidecar` (NEW, replaces `ConflictRegister`)** — inline
  sev 4–5 only, in the fact sheet near the contradicted facts;
  sev 1–3 collapse behind chip `12 minor · click to expand` that
  opens them in the right rail. Data source:
  `result.caseFacts.facts.conflict_register`.
- **`ExhibitGrid` (NEW, replaces `MemoryPane`/`DocumentInventory`)** —
  9 categories from `EXHIBIT_CATEGORIES` (`page.tsx:2673`) as a 9-row
  list (not a card grid). Each row: number + label, doc count, page
  count, completeness glyph, click-to-expand row reveals per-doc list
  in the right rail, NOT inline. **Thumbnails in the right rail only.**
- **`NeedsReviewPile` (NEW, pinned section)** — at the top of
  `ExhibitGrid`, before category 1, a section labeled `needs review`.
  Renders any entry whose `doc_type === 'other'` OR whose
  classifier confidence < 0.85, OR which has been re-classified
  manually but never re-aggregated. Each row carries the bot's
  classification + confidence in mono. Two clicks to fix:
  click the row → right rail opens with `DocTypeQuickPicker`
  (existing) → pick → `applyMatterOverridePatch` writes audit entry.
- **`DraftGate` (NEW, replaces `GeneratePanel`)** — each generator a
  row, not a card. Row shows: name, prerequisite glyphs (`Identity ✓
  Enterprise ✓ SOF ‡ Conflicts ✓`), gating verdict, last attempt
  timestamp + initials. States: `gated · gated-soft · unlocked ·
  awaiting-initials · generating · complete`. Click `gated` → right
  rail shows *exactly which facts are blocking*, citing the gate
  `conflict_type` and the `field_path`. Click `unlocked` → opens
  `PreGenerationRail`.
- **`PreGenerationRail` (NEW, replaces `PreGenerationApprovalModal`)** —
  full-height right-rail panel; same API, same data, same initials
  field. The rail stays open while the attorney scrolls the fact
  sheet. Sticky bottom: `[reject] [approve & generate · initials __]`.
- **`AuditMargin` (NEW, gutter on right edge of center)** — 14-px
  wide gutter on `paper-3`. Each `FactRow` exposes a 4-px ink dot at
  its row level; hover row → dot expands into a horizontal pill
  `AS · 14:32 · src G-28.pdf p.2`; click → pin the full audit trail
  into the right rail. States: `quiet` · `revealed` · `pinned`.
- **`GateBanner` (in `MatterHeader`)** — single sentence verdict.
  States: `clean · 1-blocker · n-blockers · alarm`. `alarm` adds the
  2-px left border in `--accent-alarm`.
- **`SectionAccordion`** (existing) — used for collapsing the
  `OperationsExpenditureTable` and the SOF tabular fold-down.

### Draft + review + log

- **`DraftPane`** (existing, refactored as scroll section, not tab) —
  renders streaming markdown of the cover letter (or persisted draft).
  `[ex. 3-A p.12]` parentheticals are click handlers that open the
  PDF in the right rail at that page.
- **`AuthorityCiteCheck`** (existing, refactored) — moves from a tab
  into the right rail when a `DraftCitationLink` is hovered with
  `Cmd` held (Westlaw KeyCite pattern). Otherwise it's a single
  collapsed line under the draft pane: `cleared · 14 / 0 off / 0
  AAO / 0 bad — click for findings`.
- **`LogPane`** (existing, refactored) — last section of the fact
  sheet scroll, not a tab. Reverse-chronological audit log: every
  fact edit, every doc-type override, every approve/reject, every
  re-aggregate. Each row: `iso-timestamp · actor · action ·
  field_path · prev → curr`. Mono throughout.
- **`ContextPane`** (existing, refactored) — the email/Copilot
  cross-check stays on its own anchor (`g x`), but the *findings*
  render as inline `ConflictSidecar` rows in the relevant fact
  sections, not as a separate panel.

### Cross-cutting / cosmetics

- **`StatusBar`** (existing) — keep. 1.75rem at bottom. Holds:
  clock, file count, last-touched, queue jobs.
- **`GenerationToastStack`** (existing) — keep, but demote to a
  single chip showing the *count* of in-flight jobs: `2 generating
  · 1 ready`. Click chip → expands the rail with all jobs. The
  current per-job stack in bottom-left is removed.
- **`GenerationChip`** (existing) — relocated inside the rail.
- **`ReloadingBanner`** (existing) — keep at bottom-left for the
  re-aggregate / relink case.
- **`DragOverlay`** (existing) — keep. Single hairline rectangle
  with smcp label.

## 9. state machine — by screen × stage

This is the matrix. Every cell is a screen × stage combination.

### Home (no matter selected)

| stage                           | what is on screen                                                                                            |
| ---                             | ---                                                                                                          |
| empty (first launch)            | `DossierEmpty` stunt headline; drop zone hairline; case-type legend; copy "the clerk reads each file…"      |
| ≥1 matter ingested              | `MatterListLine` list (newest first); drop zone shrunk to a 56 px footer rectangle                          |
| dragging                        | `DragOverlay` thickened hairline, `release to ingest · 87 PDFs detected`; matter list dims to graphite-soft |
| pre-flight (Phase 0 running)    | `LoadingProgress` 7-cell strip lit at cell 1; matter name field empty; drop zone "detecting case type — Haiku 4.5"  |
| phase 1 streaming               | `LoadingProgress` typewriter table fills as facts land; per-PDF row appears every 60 ms (already done)      |
| phase 2 aggregating             | `LoadingProgress` cell 4 lit; "weaving the dossier — Sonnet 4.6 · ~30 s"                                    |
| ingest complete                 | switch to dossier; matter selected; left rail shows `MatterListLine` + `AnchorRail`; gate banner populated  |
| ingest error                    | `BackgroundIngestPill` becomes red-bordered (border-ink), label `extraction failed — see log`; matter row in list shows `[error]` glyph |
| pre-existing matter list + drag | drop zone darkens; matter list stays clickable                                                              |

### Dossier (matter selected, all-clean)

| anchor       | rendering                                                                                                                       |
| ---          | ---                                                                                                                             |
| facts        | `FactSheet` 9 sections, all eyebrow-glyphs `✓`, gate banner `ready to generate.`                                                |
| chain        | `SofChainDiagram` `reconciled`, summary `Σ chain reconciled · 3 legs · all corroborated`                                        |
| proof        | `ProofSlotMatrix` 5/5 `at-spec`, all glyphs `✓`                                                                                 |
| register     | `ConflictSidecar` `empty` — `No conflicts on register.`                                                                         |
| binder       | `ExhibitGrid` 9 categories, all green-glyph                                                                                     |
| drafts       | `DraftGate` rows all `unlocked` or `complete`                                                                                   |
| audit        | `AuditMargin` quiet; `LogPane` shows ingest history                                                                             |
| log          | `LogPane` reverse-chronological                                                                                                 |

### Dossier (matter freshly ingested, problems present)

| condition                                       | what's surfaced in 3 seconds                                                                                                |
| ---                                             | ---                                                                                                                         |
| 5 facts unset including 2 fatal                 | gate banner `5 facts unset · 2 fatal — see facts.`; anchor rail `‡` on facts; alarm border breathes once on each fatal row  |
| 1 sev-5 conflict (drift case)                   | gate banner `1 sev-5 conflict · drafts gated.`; anchor rail `‡` on register; sev-5 row inline in `ConflictSidecar`           |
| treaty ownership 49% (gate fires)               | inline sev-5 in fact section 1 (Identity → Treaty), 2-px alarm border, banner `treaty ownership 49% — drafts gated.`        |
| classifier confidence < 0.85 on 4 docs          | `NeedsReviewPile` shows 4 rows at top of binder; banner unaffected (this is gated-soft, not gated)                          |
| FX rate drift 1.3% (sev 3)                      | inline `‡` in fact section 4 (SOF) at the offending leg; sev-3 line in collapsed sev-1–3 chip; no banner trip               |
| no payroll on file (marginality unsupported)    | inline conflict in fact section 3 (Investment) tagged `marginality_unsupported`; banner `1 minor — see register.`           |
| RFE pending                                     | `RfeChip` in MatterHeader: `RFE pending — 30 days remaining`; `LogPane` filter `since:rfe`; NoID generators unlock          |
| paralegal handoff (someone else opened)         | matter header subline: `last touched: AS · 14:32 · facts.investment.total_committed_usd`; ⌘K opens to "where you were last" |

### Dossier (mid-flight states)

| state                                           | what's on screen                                                                                                            |
| ---                                             | ---                                                                                                                         |
| Phase-1 partial-data dossier (perPdfCount > 0)  | `MemoryPane`/`ExhibitGrid` shows live count; fact sheet sections in `loading-skeleton`; gate banner `ingesting · 12/87`     |
| Re-aggregating after override                   | `ReloadingBanner` bottom-left; matter header subline `re-aggregating — Sonnet 4.6 · ~30 s`; fact sections dim to 0.6        |
| Drafting cover letter (background)              | right rail streams the markdown; gate banner unchanged; `GenerationToastStack` chip increments; `DraftGate` row "generating · 02:14" |
| Editing a fact                                  | right rail open with `EditableCell`-style input; `Cmd+Enter` commit; `Esc` revert; saving state shows "… saving" tail       |
| Re-classifying a misclassified PDF              | right rail shows `DocTypeQuickPicker` over the bot's classification; classifier confidence visible `(detect 0.72)`; commit writes audit |
| Sev-5 conflict resolution                       | click sev-5 inline → right rail diff A vs B with provenance → attorney edits one or both → row removes inline               |
| Approve & generate                              | right rail becomes `PreGenerationRail`; sticky bottom has initials + `[reject] [approve & generate]`                        |
| Lost matter root (matter folder moved)          | gate banner `matter root lost — re-link required.`; center column shows a single `RelinkPanel` with `onRelink` action        |
| Schema mismatch (E2Facts shape changed)         | gate banner `schema mismatch — re-aggregate required.`; center shows `ReAggregateButton` (existing) prominently             |

### Generation states

| state                  | rail content                                                                                                                  |
| ---                    | ---                                                                                                                           |
| pre-generation         | `PreGenerationRail`: decision summary, risk register, structural outline, citations, implications, source-fields collapsed   |
| editing facts inline   | inline edit affordance per field row inside the rail; `Cmd+Enter` commit                                                      |
| awaiting initials      | sticky bottom: `attorney initials __` highlighted; submit disabled until 2-char minimum                                       |
| generating             | rail shows `generating · 02:14`; close-able to background; chip in stack increments                                           |
| complete               | rail collapses to a banner: `cover_letter_v0.5.docx · AS · 14:32 · download .docx · download .md`; `DraftGate` row updates    |
| failed                 | rail shows error in `text-meta ink` with retry; chip turns to error state                                                     |

## 10. surface rules — the canonical decisions

- **Tabs are abolished.** The `DossierTab` enum
  (`'facts'|'exhibits'|'draft'|'review'|'audit'|'binder'|'context'|'log'`)
  is preserved as a routing key in URL but rendered as anchor scroll
  positions, not tab strips. The existing `DossierTabs` component
  becomes a no-op (or is removed).
- **Modals are abolished.** The pre-generation approval, the document
  preview, the doc-type picker, the matter-display-name override —
  all become right-rail panels. The only surviving modal is the
  ingest expand overlay (because it owns the viewport during ingest).
- **One earned ambient motion.** Alarm-row breath, one cycle per row
  per session. Everything else is hover/transition only.
- **One earned chromatic accent.** `--accent-alarm` for sev-5 and
  fatal-missing only. Severity 1–4 carried by weight + glyph + position.
- **Confidence is always visible.** When classifier confidence < 0.85,
  show `(detect 0.72)` in `text-label graphite-soft` next to the
  value. Hidden confidence = silent failure.
- **Source citation is always one click away.** Page number on hover,
  click opens the PDF in the right rail at that page.
- **File paths and IDs are always Courier New.** Prose is always
  serif/sans. Mono adjacent to prose is the audit-truth signal.
- **The fact sheet center column never replaces itself.** Generators,
  conflicts, audits, exhibits — all open in the right rail.
- **The home is a list, not a hero.** The "Drop a dossier" hero
  survives only on first launch (zero matters). The moment there's
  one matter, the list takes over.
- **The matter list is permanent.** It lives in the top of the left
  rail across every state — even mid-ingest, even mid-edit. Switching
  matters is one click, never two.
- **Empty fact = italic `unset`.** Never em-dash. Never blank.

## 11. voice & microcopy

Lawyerly. Dry. Lowercase. No exclamation. No "great", "successfully",
"all set". Things are either on or off the binder.

| context                                      | copy                                                                                |
| ---                                          | ---                                                                                 |
| Section labels (smcp)                        | `facts · chain · proof · register · binder · drafts · audit · log · context`        |
| Empty fact                                   | `unset` (italic graphite-soft)                                                      |
| Missing fatal exhibit                        | `not on file — required for filing`                                                 |
| Gated draft                                  | `blocked by 3 unset facts · 1 sev-5 conflict`                                       |
| Conflict description (sev-5 drift)           | `cover letter says $425,000; escrow ledger says $410,000.`                          |
| Audit hover                                  | `AS · 14:32 · prev 410000 → 425000`                                                 |
| Gate banner (clean)                          | `ready to generate.`                                                                |
| Gate banner (blocked)                        | `2 blockers — see facts.`                                                           |
| Ingest pre-flight                            | `detecting case type — Haiku 4.5 · ~1 s`                                            |
| Ingest aggregate                             | `weaving the dossier — Sonnet 4.6 · ~30 s`                                          |
| Reclassification commit                      | `re-classified · AS · 14:32 · re-aggregate to refresh facts`                        |
| Save flash                                   | 200 ms `saved` underline in `text-label` mono. Not a toast.                         |
| Empty matter list (first launch)             | "Drop a dossier." (the only stunt copy in the app)                                  |
| Empty drop zone                              | `drop a dossier · or ⌘O`                                                            |
| Sev-5 verdict pill                           | `dispositive`                                                                       |
| Cite-check verdict (cleared)                 | `cleared · 14/0/0/0`                                                                |
| Cite-check verdict (gated)                   | `1 off-allowlist — review.`                                                         |
| RFE chip                                     | `RFE pending — 30 days remaining`                                                   |
| Lost matter root                             | `matter root lost — re-link required.`                                              |

The cover letter draft itself stays in the firm's house voice — that's
out of scope for the UI redesign.

## 12. game-tier polish (the seven details)

1. **The audit margin gutter** — a permanent 14 px column on the right
   edge of the center fact sheet, `paper-3` ground. Each row's
   attribution dot accumulates here. Reads like the date column on a
   court docket. (Pattern: GitHub blame.)

2. **The alarm border that breathes once** — `--accent-alarm` 2-px
   left border on a fatal-unset `FactRow` pulses for 2 s, *one cycle*,
   on first viewport intersection per row per session. After the eye
   has caught it, it stays solid. The UI does not nag.

3. **The Cmd+K dossier search** — `paper-recess` quick-jump. Searches
   facts (`investor.passport_number`), exhibits (`E-3 wire 8819`),
   conflicts (`cover_letter dollar_mismatch`), and proof slots
   (`E2.investment_amount_proof`). Searching jumps the fact sheet to
   the field and opens the right rail with provenance. On an empty
   matter the dossier search is a graphite-soft hairline at the top
   of the home.

4. **The provenance underline reveal** — hover any `FactRow`, a 1-px
   underline reveals from left to right under the value, terminating
   in the page citation in mono (`p. 12, garanti_FX_confirmation.pdf`).
   Use the existing `cite-reveal` 120 ms motion in `globals.css`.

5. **The dinkus between sections** — the existing `dinkus` glyph in
   `globals.css:128` separates major fact-sheet sections instead of
   bare hairlines. The only piece of typographic ornament in the app.
   It carries the editorial DNA of the firm.

6. **The streaming draft you can read while the fact sheet stays
   visible** — when a cover letter is generating, the markdown
   streams into the right rail in real time (existing
   `streamingDraft` in `page.tsx:427`). The fact sheet stays in the
   center. This is the *one* moment two things move at once, and
   it's earned because the attorney needs both.

7. **The ingest typewriter table** — keep the existing
   `LoadingProgress` "BUILDING THE DASHBOARD" rows. As Phase 1
   classifies each PDF, the rows fill in like a deposition outline
   being typed live (60 ms stagger already implemented). Recolor the
   rainbow band to ink-2 hairline. This is the only "wow" gesture
   in the app — and it's a gesture **about reading**, not generation.

## 13. anti-patterns — never ship

- A separate "Audit" tab. Audit is a margin gutter inside the fact
  sheet. It does not get a tab.
- A wizard. The attorney is fluent.
- Card grid for exhibits in the center. Exhibits are *rows of text*
  in the center column; thumbnails live in the right rail only.
- Rainbow gradient progress bars. Hairline `text-ink-2` only.
- Toasts for routine state changes. Save flash, audit dot, gate
  banner update — all in place. Toast stack is collapsed to one
  chip showing job count.
- Severity-by-color outside the one earned alarm. Sev 1–4 is weight
  + glyph + position. Color enters at sev 5 and at fatal-missing.
- "Continue" button. The attorney reads. She doesn't progress.
- Modal overlays for routine actions (edit, classify, view PDF).
  All in the right rail.
- Frosted glass. Springs. Bouncing icons. Confetti.
- A "are you sure?" modal anywhere. Confirmation is an `Esc` key.
- Filename-as-display-name in the binder. Use the slot-based
  display name (`display_name` on `DocStub`) with the raw filename
  in `text-label graphite-soft` underneath, as already implemented.
- Sage / sky / cream as primary accents. The Atelier palette is
  paper / ink / graphite. Sage was VOID. Atelier is its own thing.
- A "loading…" string. Use `detecting case type`, `weaving the
  dossier`, `re-aggregating`, `drafting`. The verb does work.
- A "1 of 87" progress counter that doesn't tell you what just
  succeeded. The typewriter table exists exactly to fix this.

## 14. tech & constraints

- Stack: Next.js (the breaking version per
  `node_modules/next/dist/docs/`) + Tailwind + Electron host. No new
  framework. **Read `node_modules/next/dist/docs/` before writing any
  Next.js code.** The `AGENTS.md` rule is in force.
- Tokens: keep all existing in `app/globals.css` and
  `tailwind.config.ts`. Two new from v2 already added:
  `--accent-alarm` and `text-fact`. Nothing further.
- Components to refactor in place (don't rename files except where
  noted):
  - `app/page.tsx` — gut the tab system; hoist anchor rail; collapse
    `Dossier()` body to render the new `FactSheet` scroll. The
    `DossierTabs` component becomes a no-op.
  - `app/components/case-overview-card.tsx` → fold into `MatterHeader`.
  - `app/components/sof-chain-table.tsx` → keep as fold-down; new
    `app/components/sof-chain-diagram.tsx`.
  - `app/components/conflict-register.tsx` → rewrite as
    `ConflictSidecar` (inline + collapsed chip).
  - `app/components/document-inventory.tsx` → rewrite as
    `ExhibitGrid` (rows, not card grid). Keep
    `EXHIBIT_CATEGORIES` from `page.tsx:2673` as the source of truth.
  - `app/components/generate-panel.tsx` → rewrite as `DraftGate`
    rows.
  - `app/components/pre-generation-approval.tsx` → relocate into
    `app/components/pre-generation-rail.tsx`. Keep the modal API for
    the brief transition so callers don't break; flip the surface to
    a right-rail panel. Same generators, same edits, same initials.
  - `app/components/loading-progress.tsx` → keep; recolor band.
  - `app/components/section-accordion.tsx` → keep, used for SOF
    fold-down.
  - `app/components/operations-expenditure-table.tsx` → keep,
    rendered inside the Investment section accordion.
  - `app/components/authority-cite-check.tsx` → keep; relocate to
    right-rail panel triggered on Cmd+hover of a draft citation.
  - `app/components/generation-toast.tsx` → demote to single chip;
    full stack relocates inside the rail when expanded.
- API contracts preserved (everything in `app/api/`):
  - `/api/ingest-path` (POST stream, NDJSON)
  - `/api/matter/[id]/fact PATCH` (the fact edit endpoint)
  - `/api/matter/[id]/preview POST` (preview generation)
  - `/api/matter/[id]/approve POST` (commit + generate)
  - `/api/matter/[id]/cross-check POST` (the context pane)
  - `/api/re-aggregate POST` (re-run aggregator without re-extracting)
  - `/api/export POST` (.docx export)
  - `/api/file` (per-file fetch for preview iframe)
  - `/api/matter-overrides` (display name + doc-type override persistence)
- Data shapes preserved (`E2Facts`, `IngestSuccess`, `PreviewRecord`,
  `PreviewFactRow`, `PreviewConflictEntry`, `TypedMemory`, `DocType`,
  `E2CaseSubtype`).
- Keyboard map ships in v1: `g f/c/p/r/b/d/a/l/x` jump to anchor;
  `j/k` row down/up in fact sheet; `e` edit current row in rail;
  `Cmd+Enter` commit; `Esc` revert / close rail; `Cmd+K` dossier
  search; `?` cheatsheet; `o` open the matter overlay.
- Reduced motion: respect `prefers-reduced-motion`. Default the alarm
  breath off in that mode. Slow transitions to 1 ms.
- Persistence: localStorage already used for context (`page.tsx:2395`)
  and matter-overrides via `/api/matter-overrides`. Add: scroll
  position per matter (anchor + offset), so re-opening lands you
  where you left off (ResumeMarker pattern).
- Bundle: no new heavy deps. The Sankey diagram is hand-rolled SVG
  (~80 lines), not a chart library. The sparkline is Tailwind divs.

## 15. success criteria

The redesign ships when an attorney can:

1. **Drop a folder of 87 PDFs and see in under 30 seconds** what
   case-type was detected, what subtype, what blockers landed, and
   what's still extracting. Without changing tabs (there are none).

2. **Open a freshly ingested matter and answer "what's missing?" in
   under 30 seconds** by reading the gate banner + scrolling the fact
   sheet — sev-5 conflicts and fatal-unset rows are guaranteed-visible
   on the same scroll as the facts they impact.

3. **Trace any SOF leg from origin to US deployment in one diagram,
   no clicks**, with reconciliation deltas printed in the margin.

4. **Be structurally prevented** from generating a cover letter when
   any fatal fact is unset or any sev-5 conflict is unresolved — the
   gate is a closed door with a list of what to fix, not a checkbox.

5. **Hand the matter to a paralegal** who, on opening, sees the
   audit margin's last-touched dots and `LogPane` reverse-chron
   without leaving the fact sheet.

6. **Override the bot's classification of a single PDF in two clicks**,
   with the bot's confidence visible at the moment of decision.

7. **Read the cover letter draft as it streams** while the fact sheet
   stays visible in the center — never lose the source of truth while
   reviewing the output.

8. **Pick up where she left off** on a matter she touched yesterday —
   `Cmd+K` opens to "where you were last", honoring the per-matter
   scroll anchor + last-edited field.

If any of these takes more than the stated number of clicks or
seconds, the redesign has failed. Iterate on the rail, not on the
spec.

---

## Designer contrast — what makes this different from Designer A

Designer A is likely arguing for a *unified visual language* (cream,
sage, editorial calm, one type system from cover letter to dashboard).
This redesign argues that **Atelier's visual language IS its workflow
discipline**: the deposition binder is not an aesthetic — it's a
mechanical commitment that the attorney never navigates away from
the matter she is reading, that the right rail mutates so the center
doesn't, that severity is weight + glyph + position with one earned
chromatic exception. Designer A makes Atelier look like a thing.
Designer B makes Atelier *behave* like a thing — and the look follows
from the behavior, not the other way around.
