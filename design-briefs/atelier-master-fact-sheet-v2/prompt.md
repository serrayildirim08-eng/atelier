# Atelier — Master Fact Sheet First, full system (Designer A · v2)

> v1 redesigned the dossier shell. v2 redesigns **the entire product** — every screen, every state, every cross-cutting surface — under one rule: every choice defends itself with `attorney faster · more accurate · harder to mis-handle`. Aesthetic is downstream. Courier New stays. Quiet ink-on-paper stays. The earned accent stays exactly one (3px `--ink` left rail). Everything else is on the table.

---

## one-line vision

A **single ledger** with three modes — **desk** (pre-matter), **sheet** (the matter), **press** (the generators) — each carrying the same masthead, the same audit border vocabulary, the same `§§` anchor grammar, so the attorney never re-learns where things live and a paralegal opening any screen can read it from the top.

---

## context

Atelier is an Electron desktop tool for E-2 visa attorneys (sole audience: attorney + a paralegal who picks up mid-flight). Backend pipeline is fixed (`docs/CAPABILITIES.md`): Phase 0 → 0.6 → 1 (per-PDF Haiku, ×N) → 2 (Sonnet aggregator + 13 deterministic gates). The UI's job is to surface **39 proof slots × 26 doc-types × 13 gates × 1 aggregate ledger** in a way that an attorney drafting under time pressure never has to *remember which tab the answer lives in.*

Today's IA has eight tabs in the dossier (`facts / exhibits / draft / review / audit / binder / context / log`, defined `app/page.tsx:95`) plus a separate generators panel plus a separate matter-list home plus a separate ingest splash plus three error states. **v2 collapses all of it to the same three-pane chrome with five inspector modes.** Same masthead everywhere. Same anchors. Same audit border. Same gate logic. The user moves between *modes,* not *screens.*

The existing token system (`globals.css`) stays. `Courier New` / `font-mono` is the monospace voice — non-negotiable. The cream/sage/sky tokens belong to other projects in Serra's design grammar; **we do not use them here.** Pure ink on paper. One earned accent and that accent is contrast.

---

## references (workflow-first, not aesthetic)

The eight v1 references stand. v2 adds three to cover what v1 didn't reach:

1. **Bloomberg Terminal — DES screen.** Two-keystroke `§§` jumper. Carry forward.
2. **Linear · issue page.** Three-pane geometry, properties never leave. Carry forward.
3. **Stripe Dashboard · Payment Detail.** Pinned masthead + scrollable timeline + right rail. Carry forward.
4. **Notion · Sync Blocks.** Same fact, two surfaces, edits propagate. Carry forward.
5. **GitHub · Files Changed sticky review.** Conflicts pin to their fact row. Carry forward.
6. **Adobe Acrobat Pro · bookmark sidebar.** SOF spine geometry. Carry forward.
7. **Things 3 · Today empty state.** Empty more loved than full. Carry forward.
8. **Tufte small-multiples + tabular-nums.** Discrepancies pop without color. Carry forward.

**v2 additions:**

9. **Bloomberg Terminal · Launchpad multi-monitor view.** A senior attorney runs three matters in parallel. v2's home is **a single rolodex** of matters, each row showing exactly the same six masthead cells in miniature (investor / enterprise / posture / I-94 / proportionality / state-chip), so the attorney can scan all open work in one glance and never click into a matter to find out where it stands. Borrow: `MatterRolodex` row geometry. Don't borrow: the chromatic ticker pulses.

10. **Adobe Reader · the side-by-side compare diff.** When the attorney is reviewing a draft, the draft and the source fact sheet must be visible **at the same time**, not in modal-and-canvas alternation. Borrow: docked, never-modal preview surface. The pre-generation approval flow becomes a *split view*, not an overlay.

11. **macOS Finder · column view (cmd-3).** When inspecting an exhibit, the attorney moves from category → file → page → quote in a left-to-right cascade without losing the column-1 context. Borrow: `ExhibitCascade` for the per-PDF preview. Don't borrow: Finder chrome, breadcrumb pills.

---

## palette (no invention, no exception)

```
--paper          #FAFAFA   sheet ground
--paper-2        #F0F0F0   recessed surfaces (masthead, accordion summaries, inspector ground)
--paper-3        #E5E5E5   keycap chip / severity-5 fill behind tag
--paper-deep     #D4D4D4   scrollbar tracks only
--ink            #0A0A0A   primary type, severity-5 chips, attorney-confirmed border, earned accent
--ink-2          #1F1F1F   secondary type, severity-4 chips
--graphite       #404040   meta type, bot-classified border (mid conf)
--graphite-soft  #595959   page numbers, p.refs, dash placeholder
--rule           rgba(10,10,10,0.10)  hairlines
--rule-strong    rgba(10,10,10,0.32)  card borders, severity-3 borders
```

**The earned accent is contrast.** Sev-5 = 3px solid `--ink` rail + chip-fill inverts. Sev-4 = 3px `--rule-strong` rail. Sev-3 = 2px `--rule`. Sev-1–2 = inline-only chip in `--rule`. No red. No ochre. No sage. Quiet panic.

**The provenance ribbon (4px left border on every editable cell) is the audit trail without ceremony.** Five states — bot-low / bot-mid / bot-high / attorney-confirmed / attorney-overridden — encoded in border thickness + fill + glyph + value-color. Inspect any cell for two seconds and you know who decided it. This is global; it survives across desk / sheet / press. There is no "audit tab" because the audit is the border.

---

## typography (existing tokens, role-tightened)

```
--text-stunt     96px    Fraunces 300 opsz 144  · only on desk-empty ("drop a dossier") and press-empty
--text-hero      64px    Fraunces 700 opsz 96   · masthead investor H1 (one per matter, anywhere it appears)
--text-display   38.4px  Fraunces 400 italic    · §§ section numerals (i / ii / iii) + matter rolodex row title
--text-section   24px    sans 600               · inspector mode title, pre-press preview headline
--text-title     16.8px  sans 600               · generator card titles, accordion summaries, fact-cell headlines
--text-lede      16px    sans 500               · empty-state explainers
--text-body      15px    sans 500               · reading copy, cell values
--text-meta      13px    sans 500 / mono 500    · subtitles, masthead tails, exhibit captions
--text-label     11.5px  mono 600 +0.06em       · §§ anchors, page refs, audit timestamps, severity tags, smcp eyebrows uppercase +0.10em
```

**Numbers are always `font-mono tabular-nums`.** Even when surrounding type is sans. USD, percentages, EIN last-four, page refs, dependent counts, days-to-admit-until — single mono column so a $425k → $410k → $419,800 sequence reads with mechanical precision and discrepancy *visually pops* before the reviewer scans.

`Fraunces` earns its spot in **exactly four** places, system-wide: stunt empty-states, masthead H1, section numerals, rolodex row title. Everywhere else is sans or mono. No exceptions. No "let's add a serif here for warmth."

---

## layout — the three modes

Same chrome shell across all three modes:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  HEADER (atelier wordmark · cmd-K · date · time · sy@akalan.law)            │
├─────────────┬───────────────────────────────────────────────┬───────────────┤
│             │                                               │               │
│  RAIL       │   CENTER COLUMN                               │   INSPECTOR   │
│  240 / 200  │   720–960                                     │   400 / 360   │
│             │                                               │               │
│  matters    │   the active surface for this mode            │   five modes: │
│             │                                               │   sof /       │
│             │   masthead is sticky top:0 within column      │   conflicts / │
│             │                                               │   proof /     │
│             │                                               │   drafts /    │
│             │                                               │   audit       │
│             │                                               │               │
└─────────────┴───────────────────────────────────────────────┴───────────────┘
```

**Mode switches change the center column only.** The rail and the inspector survive. The masthead survives. The audit ribbon survives. The attorney never loses context to navigate.

**Mode 1 · Desk (pre-matter, no matter selected).** Center column is the **rolodex** — every open matter as a Bloomberg Launchpad row showing the six masthead cells in miniature. Drag-drop targets line the bottom 80px (`E-2` / `EB-1A` / `auto-detect`). Inspector shows the *firm-wide* audit ribbon (last 24 attorney decisions across all matters).

**Mode 2 · Sheet (matter selected, the dossier).** Center column is the **sheet** — sections I–VI as v1 designed. Inspector shows matter-scoped modes.

**Mode 3 · Press (generation surface).** Center column is the **draft preview** with split-view to the sheet. Inspector becomes the **approval flow** (decision summary / risk register / facts table / attorney initials), no modal occlusion.

The modes are reachable by `cmd-1` (desk), `cmd-2` (sheet), `cmd-3` (press) from any context. State is preserved across switches.

---

## motion grammar (paper-on-desk, not balletic)

Same library as v1, extended for the new surfaces:

```
flick           150ms cubic-bezier(0.2, 0, 0.2, 1)        accordion expand, drawer toggle
underline       180ms cubic-bezier(0.16, 1, 0.3, 1)       inspector tab indicator, mode-switch
ledger          240ms cubic-bezier(0.4, 0, 0.2, 1)        cell save state machine: editing→saving→saved-pulse→idle
inkwell         320ms cubic-bezier(0.4, 0, 0.2, 1)        anchor jump, conflict-pin click
pin             200ms ease-out                            conflict pin slide-in
masthead-deal   staggered 120ms × 6, 40ms gap             matter ingest complete, populated masthead, ONCE
hatch           static                                    diagonal stripe overlay on gated sections
ambient-conflict 600ms ease-in-out, period 8s             border-left-width 3px↔4px on first un-ack'd sev-4+, idle ≥12s
mode-shift      220ms cubic-bezier(0.2, 0, 0, 1)          desk↔sheet↔press: center column cross-fades, rail+inspector hold
press-stream    240ms ease-out per token-batch            cover-letter streaming markdown reveal, batched 60ms
ingest-pulse    sequential 60ms × N cards                 phase-1 per-PDF row reveal during ingest

reduced-motion: every duration → 0ms; pulses → instant border-color swap; staggers → single frame.
```

**No springs anywhere.** No overshoot. A page does not bounce on a desk.

**The one ambient detail.** When the dossier has been idle ≥12s and there is at least one un-ack'd sev-4+ conflict, the conflict's `--ink` rail breathes 3px↔4px every 8s. Stops on hover or scroll. Document.visibilityState gated.

---

## component inventory — full system, by mode

### desk · pre-matter

**`MatterRolodex`** (replaces the home rendered by `Binder` + `DossierEmpty` in `app/page.tsx:1789–1925, 3656–3696`).

The rolodex is the home. Every matter is one row showing the six masthead cells, ink-on-paper, no thumbnails:

```
  Salih Kacar              Wise Guys Deli LLC      ••••XXXX        ••••YYYY        2027-08-11      112.3%
  TUR · individual         RI LLC · 2021-10-04     exp 2032-04     formed 2021      in 348d · ok    meets §V
  ────────────────────────────────────────────────────────────────────────────────────────────────────
  Onur Camural             Pomega Energy LLC       ••••XXXX        ••••YYYY        DS              125.0%
  TUR · ess.skills         DE LLC · 2023-09-01     exp 2030-09     formed 2023      duration · ok   meets §V
  ────────────────────────────────────────────────────────────────────────────────────────────────────
  [drift case] · 1 sev-5   Wise Guys Deli LLC      ••••XXXX        ••••YYYY        2027-08-11      blocked
                                                                                                    ◢ §§V
  ════════════════════════════════════════════════════════════════════════════════════════════════════
                          drag any folder here        ──         or  press cmd-O
```

Each row is `cmd-click → open in sheet`. The state-chip column on the far right is one of `INTAKE / GAPS·N / CONFLICTS·N / READY / FILED` (the v1 chip vocabulary). Worst-case state wins.

**Why this beats v1's vertical rail.** v1 kept the home as a rail of matter names + a stunt empty-state in the dossier pane. That works for a single matter at a time, but Serra is now running 3+ matters concurrently (the BackgroundIngestPill at `page.tsx:2012` exists *because* this is the real workflow). The rolodex puts the answer to "what's blocking which case" on screen without a click. The rail collapses to 200px showing only matter labels — for navigating between, not for triage. (Triage is the rolodex.)

**`IngestStrip`** (replaces `BackgroundIngestPill` in `page.tsx:2012`).

The 80px strip pinned at the bottom of desk shows up to four concurrent ingests, each one row:

```
  Kacar-Salih (E-2)        ingesting · 47s     phase 1 · 17/89 docs       expand ↗   cancel ✕
  Camural-Pomega (E-2)     phase 0.6 · 4s                                  expand ↗   cancel ✕
```

The pill's status pulses at the left margin (1.5px border thickness changing 0→1.5 over 600ms ease-in-out). Phase progression is mapped against the Phase 0→0.6→1→2 progression in `docs/CAPABILITIES.md §2`. **Each row is also a row in the rolodex above** — the strip is just the pinned-bottom view of in-flight matters. Single source of truth.

**`DropTarget`** (replaces the implicit drop handler on the dossier pane).

Two explicit drop-targets line the bottom of desk: **`drop E-2 dossier`** and **`drop EB-1A dossier`**. Drag-over animates a 1px diagonal hatch overlay (the same `hatch` recipe used for gated sections — visual continuity). Auto-detect drop is a third smaller chip — `or auto-detect` — that runs Phase 0 first, branches by case_type. Why explicit: today the user uses `Binder.add E-2 matter` button (`page.tsx:1979–2007`) which is buried inside the rail; making it the dominant action on desk is faster.

### sheet · the matter (v1's province, expanded)

The v1 sheet stands. v2 changes:

**`MatterMasthead`** (replaces `CaseOverviewCard` in `app/components/case-overview-card.tsx`).

Six pinned cells in a 6-column grid (was 4 — too wide for MBP 13"), ordered by attorney's first-3-seconds priority:

```
  investor              enterprise            passport         EIN · formed       I-94 admit-until    proportionality
  Salih Kacar           Wise Guys Deli LLC    ••••XXXX1        XX-XXX2472         2027-08-11          112.3%
  Turkey · individual   RI · LLC · 2021       exp 2032-04-11   formed 2021-10-04  in 348 days · ok    meets §V
  ────────────────────────────────────────────────────────────────────────────────────────────────────────────
  bot-high · 0.94 ✓     bot-high · 0.92 ✓     bot-high · 0.97 ✓ bot-mid · 0.81    bot-high · 0.96 ✓   computed
```

**The six-column geometry maps to backend capabilities:**

| cell | source | gate it speaks to |
|---|---|---|
| investor | `caseFacts.facts.investor.full_name` (passport rich extractor `ingest/extractors/passport.ts`) | — |
| enterprise | `caseFacts.facts.enterprise.{legal_name, state_of_formation, formation_date}` | — |
| passport | `caseFacts.facts.investor.{passport_number, passport_expiry}` | `passport_expires_soon` (`typed-aggregate.ts:1664–1719`, sev-3) |
| EIN · formed | `caseFacts.facts.enterprise.{ein, formation_date}` | — |
| I-94 admit-until | `aggregate_audit.i94_status_results[0].admit_until_iso` | `status_violation_at_filing` (`typed-aggregate.ts:1723–1775`, sev-5) |
| proportionality | `caseFacts.facts.investment.proportionality_percent` | `proportionality_gate` (in `aggregate-gates.ts`); when <100% the cell tail says `review §V` with clickable `§§V` |

Each cell carries a 4px provenance rail (the audit border vocabulary above). The I-94 cell turns its rail to 3px `--ink` when ≤30 days; value italicizes; reads `in 12 days · attention`. The proportionality cell switches its tail to `review §V` when <100%.

**`FatalGapsBoot`** (the v1 component — keep, with one extension). Current `MissingFieldsList` (`page.tsx:4575`) lists *all* missing field paths as a flat list which is too noisy. Replace with the FatalGapsBoot bone-dry checklist for a curated set: no formation doc → §IV gate fails / no passport bio → §I gate fails / no I-129 yet generated. The full missing-paths list moves into `[audit]` mode of inspector as a secondary view (paralegal can spelunk it; attorney doesn't have to look at it on every paint).

**`SofChainSpine`** (v1 — carry forward as primary view). The table version (`app/components/sof-chain-table.tsx`) stays as a `T`-toggle for bulk editing. The spine is what the attorney reads.

**`ProofSlotsBoard`** (v1 scoreboard — extend). Connect each X/Y to the actual elements from `lib/e2/proof-slots.ts`:

```
   IV.  proof slots                  treaty 4/4   investment 7/8   real-and-operating 5/6   marginality 3/4   develop-and-direct 5/5
                                     E1: 4/4      E4: 7/8           E3: 5/6                  E5: 3/4           E2: 5/5
         24 of 27 filled at APS-4+         3 weak slots — see below
```

Each chip is a clickable filter into the section below; clicking "investment 7/8" scopes the §IV list to only `E4_*` slots. Empty required slots get the 3px `--ink` rail + `+ add evidence` chip — the chip opens the inspector to `[exhibits]` mode filtered to slot.requires_one_of (`proof-slots.ts:36`, `requires_one_of: ['passport_bio']` etc.). The exhibits inspector uses the doc-taxonomy's category mapping to surface only relevant exhibits, not all 89 PDFs.

**`ConflictPin` / `ConflictsInspector`** (v1 — extend with gate-source attribution). Each conflict carries a `<gate_source>` chip showing which deterministic gate emitted it (`investment_amount_drift` → `§4.5 gate · typed-aggregate.ts:1538`). The inspector's `[conflicts]` mode is primary-sorted by severity, secondary-sorted by gate-source. Sev-1–2 demoted to a single `+N minor` collapsed chip (was: avg'd severity counts in `app/components/conflict-register.tsx:48–75`).

**`ExhibitsInspector`** (replaces `MemoryPane` + `DocumentInventory` in `page.tsx:3065` and `app/components/document-inventory.tsx`).

The exhibits surface is a column-view cascade: **category → document → page → quote.** Categories are the 9 firm-convention exhibit categories from the brief (1 Applicant · 2 Company · 3 SOF · 4 Bank · 5 Operational · 6 Employee · 7 Tax · 8 Invoice · 9 Others), mapped from `DocTypeEnum` (`ingest/typed-memory.ts:62–89`):

| category | doc_types from taxonomy | required-slot anchor |
|---|---|---|
| 1 Applicant | `passport · status_doc · i94 · government_id · vital_record · cv_or_resume · credential` | E1 + Subtype 4 |
| 2 Company | `formation_doc · ownership_evidence · business_contract · business_plan` | E2 + E3 |
| 3 SOF | `source_of_funds · money_movement` | E4 SOF |
| 4 Bank | `bank_statement` | E4 supporting |
| 5 Operational | `lease_or_property · invoice_or_receipt` | E3 + E5 |
| 6 Employee | `payroll_doc · employer_letter` | E5 marginality |
| 7 Tax | `tax_doc` | E4 cross-check |
| 8 Invoice | `invoice_or_receipt` | E4 items |
| 9 Others | everything not above + `unclassified_other` (the new doc-type) | review |

**The "needs review" pile** sits at the top of category 9, sorted by confidence ASCENDING — every doc the bot didn't classify confidently is the first thing the attorney sees. `unclassified_other` from the new taxonomy renders here. Each thumbnail carries the `ReclassifyChip` (`<doc-type-short> · <conf>`); 240px popover with seven alternatives, hotkeyed 1–7. Override persists via the existing `documentOverrides` flow (`page.tsx:2218–2249`).

**The `DocumentInlinePreview`** (currently buried in matter overlay, `page.tsx`). v2 promotes it to the third column of the cascade — the page is rendered inline next to the document list. No more click-to-modal-iframe-loses-context. The fourth column shows the cited quotes (`source_quote` from any field that cites this doc/page) — the attorney sees, in one screen, *which fact uses which quote on which page in which document.*

**`AuditRibbon`** (v1 — extend). Bottom of inspector, 32px collapsed, full-height expanded. Row format: `<hh:mm> <verb> <§§anchor or filename> · <by actor>`. v2 extension: **the ribbon is global** — it lives across desk / sheet / press, scoped to the active matter on sheet/press, scoped firm-wide on desk. Same component, three views.

**`LogPane`** (current) folds into the audit ribbon's expanded state. The current "log" tab disappears. The Binder + Context tabs likewise fold — Binder becomes the exhibits cascade (already covered); Context becomes a single inline section in §I parties (paste-area + cross-check button, persists per-matter as today).

### press · generation surface

**`GenerateGate`** (v1) lives here. Each generator card (cover_letter, exhibit_list, business_plan, declarations ×3, forms ×5, NoIDs ×2 — 13 total from `generate-panel.tsx:63–118`) shows:

```
  Cover letter
  Sonnet 4.6 · ~16K tokens · ~$0.30
  ──────────────────────────────────────
  ◢ blocked: 3 fatal gaps · 1 sev-5 conflict
  resolve before generating →
```

Click "resolve before generating" → switches to `sheet` mode, `[conflicts]` inspector, scrolled to blocking item. The button is `disabled` when blocked. Override = type the matter's display name + leaves an `attorney_override` audit event.

**`PressSplit`** (replaces `PreGenerationApprovalModal` in `app/components/pre-generation-approval.tsx`).

The current modal is centered, occludes the sheet — bad geometry, the attorney is approving a draft against the facts but can't see the facts. v2 docks the preview into the center column of `press` mode, with the sheet visible as a ghosted left rail (200px). The inspector pane becomes the approval surface (decision summary / risk register / outline / authorities / facts table / initials). All current sections (`pre-generation-approval.tsx:280–392`) preserved; layout changes only.

```
┌─────────────┬───────────────────────────────────────────┬───────────────────┐
│  matters    │   PRESS · cover letter preview            │   APPROVAL        │
│  rolodex    │                                           │                   │
│  (ghost     │   I.   parties                            │   decision        │
│   200px,    │        Salih Kacar, Turkish national...   │   ─ Salih Kacar,  │
│   --paper-2)│                                           │     Turkey...     │
│             │   II.  enterprise                         │                   │
│             │        Wise Guys Deli LLC, formed 2021... │   risk register 1 │
│             │                                           │   ‡ sev-5 §§V     │
│             │   III. investment                         │     drift $5,000  │
│             │        Total committed $120,000...        │                   │
│             │                                           │   structural      │
│             │   IV.  source of funds                    │   outline         │
│             │        Property sale → FX → wire...       │   I parties       │
│             │                                           │   II enterprise   │
│             │   V.   conflicts on register              │   III investment  │
│             │        Investment amount drift §§V→       │   IV SOF          │
│             │                                           │   V conflicts     │
│             │   VI.  authorities cited                  │   VI authorities  │
│             │        9 FAM 402.9-4(B), 8 CFR 214.2(e)... │                   │
│             │                                           │   facts ▸ 87      │
│             │                                           │                   │
│             │                                           │   attorney        │
│             │                                           │   initials [SY ]  │
│             │                                           │                   │
│             │                                           │   reject          │
│             │                                           │   approve →       │
└─────────────┴───────────────────────────────────────────┴───────────────────┘
```

The streaming markdown reveal (`press-stream` motion, 240ms per token batch) uses the same paragraph-with-exhibit-links renderer as the current draft pane (`page.tsx:6322 ParagraphWithExhibitLinks`). When approval is clicked, the queue pattern (`globalGenerationQueue.enqueue`, `pre-generation-approval.tsx:165`) carries forward — desk view shows the pill, attorney can keep reading other matters while it drafts.

**`OutputLedger`** (replaces the "Recent outputs" article in `generate-panel.tsx:150–204`).

After approval, the press center column converts to a chronological ledger of approved outputs for this matter — cover_letter, exhibit_list, declarations, forms, NoIDs — each row shows `<approved_at> · <generator> · <attorney_initials> · [open .docx] · [open .md] · [view inline]`. The current tabs/groups model (cover/letter, declarations, forms, NoIDs) becomes a column-view filter at the top of press, not a stack of cards. Faster scan.

---

## state machine — every state, every surface

```
DESK
  empty (no matters)               rolodex blank · drop-target prominent · stunt "drop a dossier"
  multi (≥1 matter)                rolodex populated · drop-target collapsed to 60px
  ingesting (≥1 in-flight)         IngestStrip pinned bottom · pill-rows for each
  reload-after-override            rolodex banner: "matter X re-aggregating · 24s elapsed"

SHEET
  loading-no-data                  masthead skeleton · 4-step LoadingStep checklist · paper-grain ground
  loading-partial-typedmemory      masthead skeleton + memory-pane stream (the current MemoryPane @ 3065)
  partial (fatal gaps)             FatalGapsBoot rendered in §III–§VI position · I/II + scoreboard render
  drafting                         all sections expanded · [SOF] inspector default
  conflict-pending (sev-4+)        masthead unchanged · §§V ambient pulse · [conflicts] highlighted
  review-ready                     READY chip in masthead · §§VI ungated · [drafts] inspector default
  filed                            small filed·YYYY-MM-DD ribbon at masthead bottom · sections read-only
  re-link-required (lost root)    full-screen banner: "matter root not found · [re-link folder] [re-aggregate]"
  re-aggregating                   sheet held; thin top-of-masthead progress bar; sections read-only
  unsaved-edits-pending            footer banner: "3 unsaved edits · [save all] [discard]" + cell-level ledger pulses
  ingest-error                     DossierError card in center (current, kept) · inspector hidden

PRESS
  blocked                          gate cards show ◢ blocked · disabled buttons
  building-preview                 center column empty · inspector says "building preview…" mono
  preview-ready                    split-view rendered · approval inspector ready
  generating-after-approve         pill in IngestStrip · press shows ledger row "drafting…"
  generated                        ledger row resolves with output_path · inline preview accessible
  generate-error                   inspector banner with error code · approve button re-enabled

ANY
  offline                          masthead-attached banner: "offline · reconnecting…" · edits queued (existing pattern)
  hidden (document.visibilityState !== 'visible')   ambient-conflict pulse paused · streaming paused
```

---

## surface rules (system-wide)

- **Hairline vs. card.** Within a section: hairline `--rule` between rows. Between sections: empty 64px gap. Cards (full `--rule-strong` border) are reserved for things you can edit (SOF leg, conflict, fact cell, generator gate). Reading-only data is hairlines.
- **Recess rule.** `--paper-2` on masthead, inspector ground, accordion summaries, ghost-sheet column in press. Never on a fact cell.
- **Density rule.** Inside the sheet, *information density never decreases* on subsequent paints. Whitespace lives between sections, not inside them. The §III SOF spine may be 14 rows tall; we do not paginate.
- **One H1 per surface.** Stunt-empty in desk-empty, masthead investor in sheet, press preview headline in press. Section numerals are H2-display, italic Fraunces lowercase numerals (`i.` `ii.` `iii.`).
- **Provenance border is global.** Every editable cell across all three modes carries the 4px audit-trail rail. Same color vocabulary. No special cases.
- **Anchor grammar is global.** `§§<id>` prefix, two-keypress jumper, 320ms inkwell on arrival. Works from any surface.

---

## voice & microcopy

Lawyerly with a dry edge. Lowercase where the existing system already lowercases. No emoji. No exclamation marks. No AI-flavored "let's" / "shall we." Examples (current → replace):

- `Drop a dossier into the dossier pane, or use the buttons below to start a new E-2 or EB-1A matter.` (`page.tsx:1914`) → `drag a folder · drop E-2 here · drop EB-1A here · or cmd-O`
- `The clerk is reading the file.` (`page.tsx:3702`) → `reading. 17/89 documents classified.`
- `No conflicts on register. Re-run the reviewer after every fact edit to refresh.` (`conflict-register.tsx:36`) → `register clean. re-run after fact edits.`
- `Building preview…` (`pre-generation-approval.tsx:272`) → `assembling cover letter · 12 facts loaded`
- `nothing filed under this tab yet.` (`document-inventory.tsx:194`) → keep, already correct.
- (gate copy) `blocked: 3 fatal gaps · 1 sev-5 conflict.` then on its own line: `resolve before generating →`
- (audit ribbon) `serra · 02:41 · confirmed §§III.investment.committed_usd $425,000`
- (admit-until ≤30d) `in 12 days · attention.`
- (paralegal handoff) `last decision: serra · 02:41 · confirmed sof leg-2`

---

## game-tier polish (six details, each tied to an element)

1. **The §§ anchor.** Every section header in sheet + every section in press preview carries `§§<id>` mono code. Two-keypress jumper opens cmd-K-style. Type `e` → "§§III investment" → enter. 240ms underline pulse on arrival. The Bloomberg Terminal idea, executed once, used four ways (jump, cite, link from conflict, link from missing-evidence chip).

2. **The Δ telltale.** Anywhere two amounts disagree by ≥$1, the second renders `Δ <signed_usd>` outside the column rule, in `--ink` bold mono, with the conflict pin sliding in on hover. Used in SOF spine + cover letter preview (when the draft references an amount that disagrees with the sheet).

3. **The audit-trail border (global).** 4px left edge color on every editable cell, every conflict, every slot resolution, every approval row. Five-state vocabulary. The audit is the border.

4. **The fatal-gap diagonal hatching.** Gated sections render with 1px diagonal hatch (CSS gradient 45deg, 8px stride, `--rule` over `--paper`) and one line of mono: `gated · resolve fatal gaps first`. Same hatch shows on press generator cards while blocked, and on drag-target on desk during a hover. One visual = one meaning across the system.

5. **The masthead-deal first paint.** When a matter finishes ingesting and the masthead populates, every value field underlines L→R in `120ms` staggered by `40ms` per cell. Six cells, total 360ms, mechanical. The case "deals itself" onto the desk. Once per ingest. Never on reload.

6. **The press cross-fade.** Switching from sheet to press shows the ghost-sheet column (200px, `--paper-2`) animate in from the right while the center column cross-fades from full-sheet to draft-preview. 220ms `mode-shift`. The attorney sees the sheet collapse to the side, not disappear.

---

## anti-patterns (what NOT to ship)

- **No tab proliferation.** Eight tabs become five inspector modes. Binder + Context + Log fold under audit / exhibits / parties.
- **No icon-only severity.** Glyphs are an *additional* tell; severity is rail thickness + rail color + chip fill (three independent variables, colorblind-safe).
- **No avg'd severity counts.** Replace `severity 5·1 4·2 3·0 2·1 1·0` row (`conflict-register.tsx:48–75`) with weighted-by-severity treatment (sev-5 fills chip; sev-4 solid border; sev-3 dashed; sev-1–2 collapse).
- **No skeumorphic letterhead.** Existing paper grain is fine. Do not add wax seals, foxing edges, or "vintage briefcase" textures.
- **No sage / sky / cream / ochre / red.** Those tokens belong elsewhere. Atelier is ink on paper. The accent is contrast.
- **No "AI is thinking…" anthropomorphism.** Loading copy is `ingesting · 17/89 documents` or `bot · classifying`. The bot is a tool.
- **No modal generators.** The current centered approval modal occludes the sheet. PressSplit replaces it. The sheet is always visible.
- **No toast-only confirmations.** Every saved edit produces a 240ms ledger pulse on the cell's left rail + an immediate audit-ribbon entry. No floating toast that disappears in 3s.
- **No drag-to-reorder on SOF legs.** Legs are chronological. Reordering is editing the data, not a UI gesture. Add/remove via explicit `+ add leg` / `× remove`.
- **No purple-gradient AI sparkles.** The bot's classifications carry the same 4px provenance border as attorney edits, distinguished only by border thickness/fill. AI is a tool, not a vibe.
- **No "Recent outputs" stack of cards** (current `generate-panel.tsx:150`). Replaced by chronological `OutputLedger` table — single column, scannable, sortable.
- **No "drag a dossier" overlay over the sheet.** The drop target is a discrete strip on desk, not a hover-overlay on the dossier center column.
- **No spaced-out FactsPane raw-schema dump as default.** The current "raw extracted facts (full schema dump)" `<details>` (`page.tsx:4510–4519`) goes into a debug-only mode reachable from cmd-shift-D, not in primary view. Attorneys do not read JSON.

---

## tech & constraints

- **Framework.** Existing Next.js custom build per `AGENTS.md` (`node_modules/next/dist/docs/` is canonical — read before touching framework). React 18 + Tailwind. No new tokens in `globals.css`.
- **Electron, desktop only.** 13" MBP (1440×900) minimum, 27" iMac maximum. No mobile breakpoints. No tablet.
- **Existing component tree, in-place renames:**
  - `CaseOverviewCard` → `MatterMasthead` (extends from 4 cells to 6, gains provenance border)
  - `ConflictRegister` → `ConflictsInspector` + new `ConflictPin`
  - `SofChainTable` stays as table-mode; `SofChainSpine` is new default view
  - `DocumentInventory` + `MemoryPane` → `ExhibitsInspector` (cascade view, gains `ReclassifyChip`)
  - `GeneratePanel` → `GenerateGate` + `PressSplit` (replaces `PreGenerationApprovalModal`)
  - `Binder` (left rail) becomes `MatterRolodex` on desk + collapsed `MatterRail` on sheet
  - `BackgroundIngestPill` → `IngestStrip` row (same data shape)
  - `LogPane` + `ContextPane` + `BinderPane` fold into `[audit]` / `[exhibits]` modes
- **State.**
  - Anchor jumps via URL hash: `#§§III.investment` (Electron-restorable)
  - Inspector mode via query param: `?inspect=conflicts`
  - Active surface via path or hash: `/desk` `/matter/:id?inspect=...` `/matter/:id/press?gen=cover_letter`
  - All restorable on Electron reload (existing pattern)
- **Accessibility.**
  - All anchors keyboard-focusable; visible focus ring `outline: 1.5px solid --ink; outline-offset: 2px`
  - Inspector tabs: ARIA `tablist` / `tab` / `tabpanel` with `aria-controls` / `aria-selected`
  - Severity in three independent variables (rail thickness + rail color + chip fill) — colorblind-safe
  - Reduced-motion clamps every duration to 0ms including masthead-deal staggers
  - Color contrast ≥4.5:1 body, ≥3:1 ≥18px / smcp uppercase
  - All `title=` tooltips reachable via `aria-describedby`
  - Keyboard map (additive):
    - `cmd-1` desk · `cmd-2` sheet · `cmd-3` press
    - `§ §` anchor jumper
    - `cmd-K` global search
    - `T` SOF table-mode toggle (within sheet)
    - `1`–`5` while inspector focused → switch mode
    - `cmd-shift-D` raw-schema debug mode
    - `?` key map overlay
- **Performance budgets.**
  - Mode switch (desk↔sheet↔press): ≤16ms (visibility toggle, no remount)
  - First populated masthead frame after `IngestSuccess` resolves: ≤80ms
  - Inspector mode switch: ≤16ms
  - Anchor jump: native `scrollIntoView` + 320ms underline overlay
  - Streaming-draft token-batch flush: 60ms throttle
  - Ambient pulse: gated on `document.visibilityState === 'visible'`
- **Print path.** `cmd-P` from masthead overflow → linearized stylesheet that prints sheet + audit ribbon as serif-set artifact (the RFE-prep PDF the brief asked for).

---

## success criteria (workflow questions, scored 5/5 target)

The v1 success criteria stand and now must be measurable across all three modes:

1. **Time-to-first-decision for "what's blocking which case."** Attorney opens Atelier (`cmd-1` desk) → sees rolodex with state-chips for every matter → has the answer in <5s without clicking. (Beats v1's <10s because v1 needed one click into a matter.)
2. **Impossible to ship a draft with placeholder facts.** `GenerateGate` is structural across press. Cover-letter button is `disabled` until proofs are APS-4 in required slots, no sev-4+ conflicts, no fatal gaps. Override requires typing matter name + leaves audit event.
3. **SOF gaps surface before the attorney looks.** §III SOF spine at full width on every sheet open. Δ telltales render automatically. Missing legs render as dashed-rule placeholder rows.
4. **Paralegal can pick up mid-flight from any surface.** Audit ribbon visible on desk (firm-wide), sheet (matter-scoped), press (matter-scoped). Last 6 attorney decisions in 32px collapsed view. Click expands.
5. **Bot confidence visible at classification.** Every doc thumbnail in exhibits cascade carries `<doc-type> · <conf>`. Every fact cell's left-rail color encodes bot-vs-attorney + confidence.
6. **Approval flow never occludes the sheet.** PressSplit shows ghost-sheet column at all times during approval. The attorney is never approving against a hidden source of truth.
7. **Multi-matter triage in <2s.** Rolodex carries all open matters' six masthead cells + state chip in one viewport for ≤6 matters. (More than 6: vertical scroll preserves chip column.)
8. **No re-learning between modes.** Same masthead, same anchor grammar, same audit border, same conflict-pin treatment, same five inspector modes — across desk/sheet/press. The attorney moves between *modes,* not *screens.*

Beyond those: rubric ≥45/50 on the standard 10 dimensions; usefulness rubric ≥30/35 (six dimensions × 5 + one tiebreaker); no claim in the *Why this is more useful — evidence* section unsupported by a citation to current files.
