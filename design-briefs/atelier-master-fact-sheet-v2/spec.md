# Atelier — Master Fact Sheet First, full system · Spec (v2)

Token spec is **additive only** to existing `globals.css`. No new colors. New names below are CSS custom-property *aliases* for clarity in component code; they all resolve to existing values.

---

## Tokens (existing, role-tightened)

### palette

```
--paper          #FAFAFA   sheet ground, draft preview ground, rolodex ground
--paper-2        #F0F0F0   masthead, accordion summaries, inspector ground, ghost-sheet column in press
--paper-3        #E5E5E5   keycap chip / severity-5 chip-fill background swap
--paper-deep     #D4D4D4   scrollbar tracks only — never a fill
--ink            #0A0A0A   primary type, severity-5 chips, attorney-confirmed border, earned accent
--ink-2          #1F1F1F   secondary type, severity-4 chips
--graphite       #404040   meta type, bot-classified border (mid conf), masthead tails
--graphite-soft  #595959   page numbers, p.refs, dash placeholder
--rule           rgba(10,10,10,0.10)  hairlines within sections
--rule-strong    rgba(10,10,10,0.32)  card borders, severity-3/4 borders, ingest-strip borders
```

**No accent token.** The accent IS contrast — sev-5 chips invert (fill `--ink`, text `--paper`) and the attorney-confirmed rail is solid 4px `--ink`. There are no red, ochre, sage, sky, or cream values in this design.

### type scale

```
--text-stunt     96px    Fraunces 300 opsz 144 / -0.025em / line-height 0.95   desk-empty stunt + press-empty
--text-hero      64px    Fraunces 700 opsz 96  / -0.014em                       masthead H1 (one per matter, system-wide)
--text-display   38.4px  Fraunces 400 italic opsz 36 / -0.010em                 §§ section numerals + rolodex row title
--text-section   24px    sans 600 / -0.005em                                    inspector mode title, press preview headline
--text-title     16.8px  sans 600 / -0.005em                                    generator card titles, accordion summaries, fact-cell headlines
--text-lede      16px    sans 500 / 0                                           empty-state explainers
--text-body      15px    sans 500 / 1.55 line-height                            reading copy, cell values
--text-meta      13px    sans 500 / 1.5 line-height                             subtitles, hints, masthead tails
--text-label     11.5px  ui-monospace 600 / +0.06em (smcp uppercase: +0.10em)   §§ anchors, p.refs, audit timestamps, severity tags, eyebrows
```

`tabular-nums` on every numeric column. No exception. USD, percentages, EIN last-four, page refs, dependent counts, days-to-admit-until, Δ amounts.

### motion

```
flick           150ms cubic-bezier(0.2, 0, 0.2, 1)         accordion expand, drawer toggle, gate-state expand
underline       180ms cubic-bezier(0.16, 1, 0.3, 1)        inspector tab indicator translate, mode-switch indicator
ledger          240ms cubic-bezier(0.4, 0, 0.2, 1)         cell save state machine
inkwell         320ms cubic-bezier(0.4, 0, 0.2, 1)         anchor jump: §§ source pulses, target row underlines L→R
pin             200ms ease-out                             conflict pin slides in from right edge of row
masthead-deal   staggered 120ms × 6, 40ms gap              first-paint of populated masthead, ONCE per ingest
hatch           static                                     diagonal stripe overlay on gated sections, no animation
ambient-conflict 600ms ease-in-out, period 8s              border-left-width 3px↔4px on first un-ack'd sev-4+
mode-shift      220ms cubic-bezier(0.2, 0, 0, 1)           desk↔sheet↔press cross-fade; rail+inspector hold
press-stream    240ms ease-out per token-batch             cover-letter streaming markdown reveal, batched 60ms
ingest-pulse    sequential 60ms × N cards                  phase-1 per-PDF row reveal during ingest

reduced-motion: every duration → 0ms; pulses → instant border-color swap; staggers → single frame.
```

### provenance ribbon (4px left border, global)

The audit-trail border is the same vocabulary on every editable cell across desk / sheet / press:

```
bot-low        border-l: 4px solid --rule              + value italic, --graphite
bot-mid        border-l: 4px solid --rule              + value --ink-2
bot-high       border-l: 4px solid --rule-strong       + value --ink
confirmed      border-l: 4px solid --ink               + ✓ glyph (font-mono text-label)
overridden     border-l: 4px solid --ink               + ↻ glyph + tail "was: $410,000"
```

### severity vocabulary (global)

```
sev-5    border-l: 3px solid --ink           + chip bg --ink / text --paper / "DISPOSITIVE"
sev-4    border-l: 3px solid --rule-strong   + chip border --ink / text --ink / "MATERIAL"
sev-3    border-l: 2px dashed --rule         + chip border --rule-strong / text --ink-2 / "MINOR"
sev-2    inline only, demoted into "+N minor" chip in --rule
sev-1    inline only, demoted into "+N minor" chip in --rule

Each severity is encoded in THREE independent visual variables (rail thickness + rail color/style + chip fill).
Colorblind-safe by structure.
```

---

## Screen × State matrix (every surface, every state)

The full audit. Rows are surfaces; columns are state shapes; cells describe what the user sees and what is locked.

### DESK (mode 1, pre-matter / multi-matter triage)

| state | trigger | rolodex | drop strip | inspector | locked |
|---|---|---|---|---|---|
| **empty** | no matters in `results[]` | stunt headline "drop a dossier" | full 240px tall, prominent | hidden | everything |
| **multi** | ≥1 matter | populated rows (6 cells + state chip) | collapsed 60px | firm-wide audit ribbon (24 events) | nothing |
| **ingesting** | ≥1 in-flight ingest | matters render; in-flight rows show `[INGEST]` chip + phase mono | replaced by `IngestStrip` (1–4 rows) | firm-wide audit ribbon shows ingest-started events | clicking in-flight matter row deferred until phase 0 complete |
| **reload-after-override** | re-aggregate post-override | top banner "matter X re-aggregating · 24s elapsed" | unchanged | unchanged | clicking that matter row |
| **error** | ingest fails | failed matter row shows `[ERROR]` chip in `--ink` solid; rest unchanged | unchanged | unchanged | clicking failed row → error detail in inspector |

### SHEET (mode 2, the dossier)

| state | trigger | masthead | center column | inspector default | locked |
|---|---|---|---|---|---|
| **loading-no-data** | matter selected, ingest still in flight | skeleton (6 placeholder cells, --paper-2 fills) | DossierLoading 4-step checklist | hidden | everything except cancel |
| **loading-partial-typedmemory** | typedMemory streaming, caseFacts not yet | skeleton with first 1–2 cells populated | MemoryPane stream (current pattern, page.tsx:3065) | `[ingest log]` mode | sections III/IV/V/VI |
| **partial (fatal gaps)** | caseFacts present, fatal_gaps.length>0 | populated; `gaps·N` chip in --ink solid | I + II + IV-scoreboard render; FatalGapsBoot replaces III/V/VI | `[fatal gaps]` mode | III, V, VI, drafts (hatched overlay) |
| **drafting** | gaps clear, no sev-4+ | populated, `IN PROGRESS` chip hollow | all sections expanded | `[SOF]` mode | nothing |
| **conflict-pending** | sev-4+ conflict opened | populated; ambient pulse on §§V chip | sections render; conflict pin inline at fact row | `[conflicts]` mode highlighted with count | drafts only |
| **review-ready** | all proofs APS-4+, no open sev-4+ | `READY` chip hollow `--ink` outline | all sections render | `[drafts]` mode | nothing |
| **filed** | filing date logged | small `filed·YYYY-MM-DD` ribbon below masthead | sections read-only (--graphite cast) | `[audit]` mode | all editable cells |
| **re-link-required** | matter root path lost | banner-replaces-center: "matter root not found" + [re-link folder] [re-aggregate] | banner | hidden | everything until re-linked |
| **re-aggregating** | re-aggregate in flight | thin top progress bar, sections held | held | held | edits |
| **unsaved-edits-pending** | ≥1 cell edit not yet saved | unchanged | footer banner: "3 unsaved edits · [save all] [discard]" + per-cell `ledger` pulse | unchanged | mode switch (warns) |
| **error** | extraction error | DossierError card in center (current pattern, page.tsx:3724) | DossierError | hidden | everything |
| **offline** | Electron lost backend | masthead-attached banner "offline · reconnecting…" | unchanged | last active | edits queued |

### PRESS (mode 3, generation surface)

| state | trigger | center column (preview) | inspector (approval) | locked |
|---|---|---|---|---|
| **gate-blocked** | fatal gap, sev-4+, or APS<3 in required slot | "press is blocked. resolve the §§ links below" + the gate cards | inspector hidden | approve & generate |
| **gate-clear** | all clear | gate cards render in normal state with chosen generator highlighted | inspector hidden until generator picked | nothing |
| **building-preview** | generator picked, POST /preview running | mono "assembling cover letter · 12 facts loaded" | inspector says "building preview…" | approve, reject |
| **preview-ready** | preview returned | split-view: ghost-sheet 200px left + draft preview center | full approval surface (decision / risk / outline / authorities / facts / initials) | nothing |
| **approving** | approve clicked, queue accepted | preview held with banner "drafting…" | inspector held with banner | edits to facts (was: pending edits ship with approval) |
| **generated** | queue resolved | OutputLedger row appended to bottom of center | approval inspector clears, returns to gate cards | nothing |
| **generate-error** | queue rejected | preview restored | inspector banner with error code, retry button | nothing |
| **override-required** | attorney chooses "generate anyway" | center prompts: "type the matter name to override" | inspector held | until matter name typed |

---

## Per-component spec

### desk surfaces

**`MatterRolodex`** — rolodex of open matters.

```
geometry:
  full-width on desk center column (720–960)
  per-row: 6-column grid with state-chip column on far right
  row height: 96px (allows 2-line title + 1-line tail per cell)
  row separator: 1px --rule
  hover: --paper-2 / 60% fill
  click: opens matter in sheet (mode 2)
  cmd-click: opens in new electron window (existing pattern)

cells (mirror of MatterMasthead, miniature):
  investor          enterprise            passport         EIN · formed       I-94 admit-until    state chip
  --text-display    --text-display        --text-meta mono --text-meta mono   --text-meta mono    chip vocabulary
  Salih Kacar       Wise Guys Deli LLC    ••••XXXX1        XX-XXX2472         2027-08-11          INTAKE | GAPS·N | CONFLICTS·N | READY | FILED

state chip:
  INTAKE          bg transparent / border --rule / text --graphite
  GAPS·N          bg --ink / text --paper
  CONFLICTS·N     bg --ink / text --paper
  READY           bg transparent / border 1px --ink / text --ink
  FILED           bg transparent / border --rule-strong / text --graphite-soft / italic

empty state:
  stunt "drop a dossier" centered, --text-stunt
  drop-target strip 240px tall pinned bottom (full E-2 / EB-1A / auto-detect chips)
```

**`IngestStrip`** — pinned bottom of desk, replaces `BackgroundIngestPill` (page.tsx:2012) when on desk surface.

```
geometry:
  position: sticky bottom 0
  height: 80px collapsed, expands to 200px when 4+ in flight
  per-row: 1 line · matter name · phase · count · expand · cancel
  border: top --rule-strong / bg --paper-2 / paper-grain texture

per-row format:
  Kacar-Salih (E-2)        ingesting · 47s     phase 1 · 17/89 docs       expand ↗   cancel ✕

phase-mapping (from docs/CAPABILITIES.md §2):
  detecting        → "phase 0 · case-type"
  subtype          → "phase 0.6 · subtype"
  classifying      → "phase 1 · N/M docs"
  aggregating      → "phase 2 · cross-document"
  done             → row removes after 800ms ledger pulse

pulse: 1.5px border thickness 0→1.5 over 600ms ease-in-out, period 4s
```

**`DropTarget`** — explicit drop strips on desk-empty.

```
three buckets, full-width, 80px tall each:
  drop E-2 dossier here
  drop EB-1A dossier here
  or auto-detect (smaller, 40px tall, --graphite)

dragover: hatch overlay (the global hatch recipe), --ink dashed border
drop:     fade out, ingest starts, IngestStrip row appears
```

### sheet surfaces

**`MatterMasthead`** — 6-column pinned masthead.

```
grid:        grid-cols-6 gap-x-7 gap-y-5
height:      168px sticky top:0 within center column
ground:      --paper-2

cells (per stage 2-3 of v1, extended to 6):
  investor          enterprise         passport         EIN · formed       I-94 admit-until    proportionality
  --text-meta       --text-meta        --text-meta      --text-meta        --text-meta         --text-meta
  --text-display    --text-display     --text-body mono --text-body mono   --text-body mono    --text-body mono
  --text-label tail --text-label tail  --text-label     --text-label       --text-label        --text-label

provenance ribbon:  4px left border, five-state vocabulary (above)

cell-specific behaviors:
  passport:           rail goes 3px --ink when expiry within 180d (passport_expires_soon gate)
  i94 admit-until:    rail goes 3px --ink when ≤30 days; tail italicizes "in 12 days · attention"
                      special "DS" rendering when admit_until is duration-of-status (the existing AdmitUntilChip kind)
  proportionality:    when <100%, tail switches to "review §V" with clickable §§V anchor

backend mapping:
  investor          ← caseFacts.facts.investor.{full_name, nationality}
  enterprise        ← caseFacts.facts.enterprise.{legal_name, state_of_formation, formation_date}
  passport          ← caseFacts.facts.investor.{passport_number, passport_expiry}
  EIN·formed        ← caseFacts.facts.enterprise.{ein, formation_date}
  i94 admit-until   ← aggregate_audit.i94_status_results[earliest non-DS]
  proportionality   ← caseFacts.facts.investment.proportionality_percent (from aggregate-gates.ts proportionality_gate)
```

**`FatalGapsBoot`** — bone-dry checklist, replaces sections III–VI when fatal gaps present.

```
header:   "fatal gaps before this matter can be filed"   (smcp uppercase, --graphite)
rule:     1px --rule full-width
rows:     · <slot.label>  <gap.message>     (font-mono, --ink-2 left, --graphite right)

gated regions render with hatch overlay:
  background-image: repeating-linear-gradient(45deg, --rule 0, --rule 1px, transparent 1px, transparent 8px)
  text overlay:     "gated · resolve fatal gaps first"  (mono, --graphite-soft, centered)

gap definitions (firm-curated, from proof-slots.ts):
  - no formation_doc with subtype=articles_of_org/articles_of_inc → §IV blocked
  - no passport_bio for principal → §I blocked, gates with E1.principal_passport (sev-5)
  - no I-129 yet generated → §VI blocked
```

**`SofChainSpine`** — primary view (v1 carry-forward).

```
columns:        origin / USD / evidence / destination
row height:     80px (allows 2-line evidence + 1-line destination)
spine rail:     vertical 1px --rule-strong, x = 28px from left
leg numeral:    font-mono --text-meta tabular-nums --graphite-soft, padded 0
USD column:     font-mono tabular-nums right-aligned --text-body --ink
delta:          Δ <signed_usd> outside column rule, --ink, font-mono semibold
discrepancy ≥$1: triggers Δ render
attorney-confirmed: ✓ glyph appended to APS marker
section header: "III. investment & source-of-funds chain"  (Fraunces italic numeral iii. + sans label)

backend mapping:
  rows from caseFacts.facts.source_of_funds[] (one row per leg)
  origin ← origin_category + origin_evidence (with the underline anchor to the document)
  USD ← origin_amount_usd
  evidence ← origin_evidence (clickable, opens ExhibitsInspector cascade)
  destination ← final_destination

table-mode toggle: T key → renders SofChainTable (current component, app/components/sof-chain-table.tsx)
```

**`ProofSlotsBoard`** — scoreboard + filtered slot list.

```
scoreboard:     5 element chips: "treaty 4/4" "investment 7/8" "real-and-operating 5/6" "marginality 3/4" "develop-and-direct 5/5"
chip:           font-mono tabular-nums --text-meta, clickable (filter)
clicking chip:  scopes the section list below to that element's slots
weak slot:      border-l 2px --rule-strong + APS-3 marker
empty required: border-l 3px --ink + inline "+ add evidence" chip
                "+ add evidence" opens ExhibitsInspector filtered to slot.requires_one_of (proof-slots.ts:36)

backend mapping:
  scoreboard counts ← aggregate over proof-slots × document-audit gates
    each ProofSlot has fam_elements[] → bucket by element id (E1/E2/E3/E4/E5)
    "filled at APS-N+" ← document-audit.ts adequacy result for slot
  weak slot ← APS-3 from document-audit
  empty required ← slot.severity_if_missing >= 4 + no documents in requires_one_of[]
```

**`ConflictsInspector` + `ConflictPin`** — anchored, never quarantined.

```
inspector mode:
  list sorted desc by severity, then by gate_source
  each row 56px tall with severity rail (vocabulary above) + gate-source chip
  gate-source chip:    e.g. "§4.5 gate · investment_amount_drift"
                       maps to typed-aggregate.ts line numbers from CAPABILITIES.md §5
  click §§-link:       switches center to scrolled-into-view sheet section, 320ms inkwell underline
  Sev-1–2:             demoted into single "+N minor" chip at bottom of list

inline ConflictPin (renders at fact row):
  layout:             right-aligned strip, max-width 32ch, single-line truncate
  format:             "◢ sev-N · <description>     §§V→"
  hover:              expands to 2-row layout (fact A / fact B), 200ms pin recipe
  click §§-link:      switches inspector to [conflicts] mode, scrolls + inkwell
  rendering rule:     only sev-3+ conflicts render inline; sev-1–2 stay in inspector list

ambient pulse:        on first sev-4-or-5 not yet acknowledged; idle ≥12s; period 8s; 3px↔4px border-left-width
                      gated on document.visibilityState === 'visible'

backend mapping:
  conflict_register ← caseFacts.conflict_register
  audit-row arrays ← aggregate_audit.{fx_gate_results, passport_validity_results, i94_status_results, ...}
  gate-source ← inferred from conflict_type → §line# table from CAPABILITIES.md §5
```

**`ExhibitsInspector`** — column-view cascade.

```
geometry:
  4 columns, full inspector width when [exhibits] mode is full-screen-inside-inspector
  category | document | page | quote
  each column 25% width on >1280, 33% on ≤1280 (wraps to 2-row)

column 1 — category:
  9 rows + "needs review" pile
  Categories: 1 Applicant | 2 Company | 3 SOF | 4 Bank | 5 Operational | 6 Employee | 7 Tax | 8 Invoice | 9 Others
  row format: <letter>  <title>  <count>  <pages>
  hover: --paper-2 / 60%
  selected: bg --ink / text --paper

  needs-review pile:
    sits at top of category 9
    sorted by confidence ASC
    every doc with confidence < 0.6 OR doc_type='unclassified_other'
    the new unclassified_other doc-type from the renamed taxonomy lands here

column 2 — document:
  list of documents in selected category
  per row: thumbnail (20×24) + filename + ReclassifyChip
  ReclassifyChip: bottom-right of thumbnail, font-mono --text-label tabular-nums --graphite
                  format: "<doc-type-short> · <conf>"
                  e.g. "bank-stmt · 0.74"
                  click: 240px popover with 7 alternatives, hotkey 1–7, esc dismiss
                  on confirm: chip becomes "✓ <doc-type>" (--ink, --rule-strong)

column 3 — page:
  inline PDF preview using DocumentInlinePreview (existing in page.tsx)
  page navigation: ◂ <n>/<total> ▸
  click on page → column 4 populates with all source_quotes anchored to that page

column 4 — quote:
  list of fact-paths citing this doc/page combination
  format: <§§anchor> · <field-path>  ──  "<source_quote>"
  click §§: anchor jump to fact in sheet (320ms inkwell)

backend mapping:
  categories ← aggregate from typedMemory entries' doc_type → category mapping (in prompt §component inventory)
  documents ← typedMemory[doc_type][i] for selected category
  ReclassifyChip data ← entry.confidence + entry.doc_type
  page preview ← matterRoot/<filename>
  quotes ← scan caseFacts for fields with source_doc=<filename> AND source_page=<page>
```

**`AuditRibbon`** — 32px sticky bottom of inspector, expandable.

```
collapsed (32px):
  6 most recent events, mono-set
  format: <hh:mm> <verb> <§§anchor or filename> · by <actor>
  scroll horizontal if events overflow (rare)
  font: font-mono --text-meta tabular-nums

expanded (full inspector height):
  table view with columns: timestamp | actor | verb | target | prev_value | new_value
  search box at top
  filter by actor / verb / date range

global behavior:
  on desk: shows firm-wide last-24-events
  on sheet: scoped to active matter
  on press: scoped to active matter

backend mapping (existing audit log path):
  reads from db/audit/<matter>/log.jsonl (existing pattern)
  attorney_override events from PreGenerationApprovalModal flow
  cell edits from /api/matter/[id]/fact PATCH
  reclassifications from /api/matter/[id]/document-override
  ingest events from /api/ingest-path
```

### press surfaces

**`GenerateGate`** — gate cards, structural blocking.

```
geometry:
  grid-cols-1 lg:grid-cols-3 gap-4 (existing GeneratePanel pattern)
  per-card: --paper bg, border --rule-strong, 4px provenance rail (audit border vocab)

per-card states:

  unblocked:
    title (--text-title), description (--text-meta), "approve & generate →" button (--ink fill)

  blocked:
    title --graphite-soft
    description --graphite
    "◢ blocked: 3 fatal gaps · 1 sev-5 conflict" line in --ink
    "resolve before generating →" link (clickable, switches to sheet mode + [conflicts] inspector)
    button: disabled (cursor-not-allowed, opacity-40)
    hatch overlay (1px diagonal --rule, 8px stride)

  override-path:
    small text-link "generate anyway" requires confirm-by-typing-matter-name
    on confirm: emit attorney_override audit event, proceed to building-preview

generators (carry-forward from generate-panel.tsx):
  cover_letter, exhibit_list, business_plan
  declaration_beneficiary, declaration_spouse, declaration_enterprise_rep
  forms_i129, forms_i129e, forms_g28, forms_i539, forms_i539a
  noid_principal, noid_dependent

gate-check logic (per-card):
  cover_letter:        fatal_gaps.length===0 AND no open sev-4+ AND APS-4+ in all required slots for case_type
  exhibit_list:        any required slot filled with at least one doc
  business_plan:       investment.total_committed_usd present AND ownership_chain non-empty
  declarations:        principal passport + appropriate dependent docs
  forms_i129:          investor + enterprise + investment all populated
  forms_i129e:         + ownership_chain ≥50% treaty-national
  forms_i539/A:        dependent_count > 0 AND dependent passports present
  noid_*:              prior filing on record + RFE issued (manual flag)
  forms_g28:           always available
```

**`PressSplit`** — replaces PreGenerationApprovalModal.

```
geometry (replaces fixed inset-0 modal):
  left:  ghost-sheet column 200px, --paper-2 ground, scrollable, all sections visible at miniature scale
         purpose: attorney is approving against the facts; the facts must be visible
  center: draft preview, full sections (current PreviewRecord rendering)
  right: approval inspector (full inspector width = 400px on desktop)

approval inspector sections (carry from pre-generation-approval.tsx:280–392):
  decision summary (deriveDecisionSummary)
  risk register (conflicts_to_flag_in_output) — using SEVERITY_RANK glyph weights
  structural outline (preview.structural_outline)
  defensive paragraphs (preview.defensive_paragraphs_required)
  authorities cited (preview.authorities_to_cite)
  implications (cost / tokens / facts count)
  facts table (collapsed by default; expand to inline-edit)
  attorney initials input
  reject / approve & generate buttons

streaming-draft behavior:
  when approve clicked → globalGenerationQueue.enqueue (existing path)
  press center column transitions to "drafting…" with mono pulse
  IngestStrip on desk shows generation pill (single source of truth — same component)
  on resolve: OutputLedger row appended

backend mapping:
  POST /api/matter/[id]/preview → fills inspector
  POST /api/matter/[id]/approve → enqueues to generationQueue
  output_path / output_inline rendered in OutputLedger row
```

**`OutputLedger`** — chronological table of approved outputs.

```
geometry:
  full center column, single table
  columns: approved_at | generator | initials | output_path | actions

per-row:
  approved_at:       font-mono --text-meta tabular-nums --graphite (e.g. "2026-04-22 14:33")
  generator:         "Cover letter" | "Exhibit list" | etc. (current display name)
  initials:          smcp uppercase --ink ("SY")
  output_path:       font-mono --text-meta truncate (e.g. "→ db/drafts/kacar-salih/cover-letter-v0.4.docx")
  actions:           [open .docx] [open .md] [view inline] (existing handlers)

sort:               desc by approved_at
filter:             top-of-column smcp filter chips by generator type
empty-state:        "no drafts approved yet for this matter."

backend mapping:
  reads from db/drafts/<matter>/index.jsonl
  appends on each approve resolution
```

---

## state-machine summary (text form)

```
DESK
  empty         ⟶ ingesting (drop)         ⟶ multi (ingest done)
  multi         ⟶ ingesting (additional drop) ⟶ multi
  multi         ⟶ click row                ⟶ SHEET.<state>
  any-desk      ⟶ cmd-2                    ⟶ SHEET.<last>
  any-desk      ⟶ cmd-3                    ⟶ PRESS.<last>

SHEET
  loading-no-data            ⟶ loading-partial-typedmemory ⟶ partial | drafting
  partial                    ⟶ drafting (gaps clear)
  drafting                   ⟶ conflict-pending (sev-4+ opened)
  conflict-pending           ⟶ drafting (acknowledged) | review-ready (resolved)
  review-ready               ⟶ filed (filing logged)
  any-sheet                  ⟶ re-link-required (root lost)
  any-sheet                  ⟶ unsaved-edits-pending (cell edited)
  any-sheet                  ⟶ cmd-3 ⟶ PRESS.<state for active matter>
  any-sheet                  ⟶ cmd-1 ⟶ DESK.multi

PRESS
  gate-blocked               ⟶ gate-clear (resolve)
  gate-clear                 ⟶ building-preview (pick generator)
  building-preview           ⟶ preview-ready
  preview-ready              ⟶ approving (approve clicked)
  approving                  ⟶ generated (queue resolves) | generate-error
  generated                  ⟶ gate-clear (back to picker)
  any-press                  ⟶ cmd-2 ⟶ SHEET.<active>

ANY
  offline                    visible banner; edits queued; restored on reconnect
  hidden                     ambient + streaming paused; resume on visible
  reduced-motion             all durations clamped 0ms
```

Per state, what's locked / what's visible — see Screen × State matrix above.

---

## accessibility

- Every anchor `<a href="#§§III.investment">` keyboard focusable; visible focus ring `outline: 1.5px solid --ink; outline-offset: 2px`
- Inspector tabs: ARIA `tablist` / `tab` / `tabpanel` with `aria-controls` / `aria-selected`
- Mode switches: ARIA live-region announcement on cmd-1/2/3 ("desk" / "sheet · matter X" / "press · matter X")
- Severity in three independent variables (rail thickness + rail color/style + chip fill) — colorblind-safe
- Reduced-motion clamps every duration to 0ms including masthead-deal staggers, IngestStrip pulses, and ambient-conflict pulse
- Color contrast AA on every text-on-fill combination (≥4.5:1 body, ≥3:1 ≥18px or smcp uppercase)
- All `title=` tooltips reachable via `aria-describedby` so screen readers get audit metadata
- Keyboard map (additive, not replacing existing):
  - `cmd-1` desk · `cmd-2` sheet · `cmd-3` press
  - `cmd-K` global search (existing)
  - `§ §` anchor jumper
  - `T` SOF table-mode toggle within sheet
  - `1`–`5` while inspector focused → switch mode
  - `cmd-shift-D` raw-schema debug mode (gates the FactsPane `<details>` dump)
  - `?` key map overlay
- Drag-drop has full keyboard fallback: `cmd-O` opens native picker (existing path via `onPickFolderElectron`)

---

## tech & constraints

- Existing Next.js custom build per `AGENTS.md` (read `node_modules/next/dist/docs/` before touching framework)
- React 18 client components for editable cells (existing pattern in SofChainTable.EditableCell, FactRow in pre-generation-approval.tsx)
- Anchor state in URL hash; inspector mode in query param; mode in path or hash; restorable on reload
- All file mutations through existing endpoints:
  - `/api/matter/[id]/fact` PATCH (cell edits)
  - `/api/matter/[id]/document-override` PATCH (reclassify)
  - `/api/matter/[id]/preview` POST (press preview)
  - `/api/matter/[id]/approve` POST (press approve)
  - `/api/re-aggregate` POST (re-aggregate)
  - `/api/ingest-path` POST (ingest)
- No new write paths in this redesign
- Performance budgets:
  - Mode switch (cmd-1/2/3): ≤16ms (visibility toggle, not remount)
  - First populated masthead frame after IngestSuccess: ≤80ms
  - Inspector mode switch: ≤16ms
  - Anchor jump: native scrollIntoView + 320ms inkwell underline
  - Streaming-draft token-batch flush: 60ms throttle
  - Ambient conflict pulse: gated on `document.visibilityState === 'visible'`
- Print path: `cmd-P` from masthead overflow → linearized stylesheet that prints sheet + audit ribbon + conflicts + proof-slots as serif-set artifact (the RFE-prep PDF)
