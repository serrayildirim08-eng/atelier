# Atelier — Master Fact Sheet First · Spec

Token spec is **additive only** to existing `globals.css`. No new colors. New names below are CSS custom-property *aliases* for clarity in component code; they all resolve to existing values.

---

## Stage-mapped component spec

### stage 1 (receive) → `MatterRail`

| token | value | role |
|---|---|---|
| `--rail-w` | `240px` (200px on ≤1440 viewport) | column width |
| chip · INTAKE | bg `transparent`, border `--rule`, text `--graphite`, `font-mono text-label` | row index |
| chip · GAPS·N | bg `--ink`, text `--paper`, no border | row index |
| chip · CONFLICTS·N | bg `--ink`, text `--paper`, no border | row index |
| chip · READY | bg `transparent`, border `1px --ink`, text `--ink` | row index |
| row hover | `--paper-2 / 60%` | meta |
| row spacing | 12px vertical, 12px gutter | meta |

### stage 2–3 (triage + facts) → `MatterMasthead`, `FatalGapsBoot`

```
masthead grid:    grid-cols-6 gap-x-7 gap-y-5  (was grid-cols-4 — too wide for MBP 13")
masthead height:  ~168px sticky within center column
masthead recess:  --paper-2
investor name:    --text-hero / Fraunces 700 opsz 96 / -0.014em / --ink
six pinned cells: --text-meta eyebrow / --text-body display value / --text-label tail
```

Field-leaf provenance ribbon — 4px left border on every editable cell:

```
bot-low      border-l: 4px solid --rule              + value italic, --graphite
bot-mid      border-l: 4px solid --rule              + value --ink-2
bot-high     border-l: 4px solid --rule-strong       + value --ink
confirmed    border-l: 4px solid --ink               + ✓ glyph (font-mono text-label)
overridden   border-l: 4px solid --ink               + ↻ glyph + tail "was: $410,000"
```

`FatalGapsBoot` slot: replaces the §III–§VI sections when `result.fatal_gaps.length > 0`. Single bone-dry checklist component:

```
header:   "fatal gaps before this matter can be filed"   (smcp, --graphite)
rule:     1px --rule across full width
rows:     · <slot.label>  <gap.message>     (font-mono, --ink-2 left, --graphite right)
gated regions render with diagonal hatch overlay (see §motion · hatch).
```

### stage 4 (SOF) → `SofChainSpine` + `SofChainTable` (toggle T)

```
spine columns:   origin / USD / evidence / destination
spine row:       80px tall (allows 2-line evidence + 1-line destination)
spine rail:      vertical 1px --rule-strong, x = 28px from left
leg numeral:     font-mono --text-meta tabular-nums, --graphite-soft, padded 0
USD column:      font-mono tabular-nums right-aligned, --text-body --ink
delta telltale:  Δ <signed_usd> rendered outside the column rule, --ink, font-mono semibold
discrepancy ≥ $1: triggers Δ render
attorney-confirmed: ✓ glyph appended to APS marker
section header:  "III. investment & source-of-funds chain"  (Fraunces 400 italic numeral i.i.i  + sans label)
```

### stage 5 (conflicts) → `ConflictsInspector` + `ConflictPin`

```
severity rail:
  sev-5    border-l: 3px solid --ink           + chip bg --ink / text --paper / "DISPOSITIVE"
  sev-4    border-l: 3px solid --rule-strong   + chip border --ink / text --ink / "MATERIAL"
  sev-3    border-l: 2px dashed --rule         + chip border --rule-strong / text --ink-2 / "MINOR"
  sev-2    inline only, demoted into "+N minor" chip in --rule
  sev-1    inline only, demoted into "+N minor" chip in --rule

conflict pin (inline at fact row):
  layout:        right-aligned strip, max-width 32ch, single-line truncate
  hover:         expands to 2-row layout (fact A / fact B)
  click §§ link: switches inspector to [conflicts] mode, scrolls + 320ms inkwell underline

ambient pulse:  on first sev-4-or-5 not yet acknowledged; idle ≥12s; period 8s; clamp 0ms reduced-motion
```

### stage 6 (proof slots) → `ProofSlotsBoard`

```
scoreboard:     5 chips (treaty / investment / r-and-o / marginality / d-and-d)
                each: "<element> X/Y" (font-mono tabular-nums, --text-meta)
                clickable, scopes section below
weak slot:      border-l 2px --rule-strong + APS-3 marker
empty required: border-l 3px --ink + inline "+ add evidence" chip → opens [exhibits] inspector mode
filled chip:    APS-N marker as font-mono tabular-nums (current SlotRow markup retained)
```

### stage 7 (drafts) → `GenerateGate` + docked `PreGenerationApprovalModal`

```
gate copy:
   blocked title:   "blocked: 3 fatal gaps · 1 sev-5 conflict"
   gate state:      button[disabled], text --graphite-soft, "resolve before generating →"
   override path:   small text-link "generate anyway" requires confirm-by-typing-matter-name

docked preview:
   modal docks into inspector pane (full inspector width when [drafts] active)
   sheet remains visible to the left
   approve / reject buttons fixed bottom of inspector
```

### stage 8 (re-classify) → `ReclassifyChip` on `Thumbnail`

```
chip position:   bottom-right corner of thumbnail, 6px inset
chip text:       <doc-type-short> · <conf>
                 e.g. "bank-stmt · 0.74"
chip type:       font-mono --text-label tabular-nums, --graphite
chip border:     1px --rule
popover:         240px wide, 7 alternatives, hotkey 1–7, esc to dismiss
on confirm:      chip becomes "✓ <doc-type-short>" (--ink, --rule-strong)
```

### stage 9 (handoff) → `AuditRibbon`

```
position:        sticky bottom of inspector, 32px tall (collapsed)
expanded:        full inspector height
collapsed rows:  6 most recent events
row layout:      <hh:mm> <verb> <§§anchor or filename> · <by actor>
font:            font-mono --text-meta tabular-nums
expand link:     "full log →" right-aligned in collapsed footer
```

### stage 10 (RFE) → audit-trail tooltips on every authored value

Every cell, conflict, slot resolution: native `title=` of the form  
`<actor> · <iso-timestamp> · <why>`.  
`<why>` is `bot-classified`, `attorney-confirmed`, `attorney-overridden was: <prev>`, `reclassified from: <prev>`.  
`Cmd-P` from masthead overflow → `Print audit trail (PDF)` exports the matter's full audit log as a serif-set print artifact.

---

## type scale (existing tokens, with role assignments tightened)

```
--text-stunt    96px   reserved for empty-state ("drag a matter folder")
--text-hero     64px   masthead investor H1 — only legal use of hero serif inside a populated matter
--text-display  38.4px section headers (numeral + label combined): "III. investment & sof"
--text-section  24px   inspector mode title, e.g. "conflicts (4 open)"
--text-title    16.8px generator card titles, accordion summaries, fact-cell headlines
--text-lede     16px   intro paragraphs (rare; mostly empty-state explainers)
--text-body     15px   reading copy + cell values
--text-meta     13px   subtitles, hints, descriptions, masthead tails
--text-label    11.5px smcp eyebrows, page refs (p.7), §§ anchors, audit timestamps, severity tags
```

Letter-spacing rules:
- Fraunces hero / display: `-0.014em` to `-0.010em`
- Sans titles: `-0.005em`
- Sans body / meta: 0
- Mono labels / smcp: `+0.06em` to `+0.10em`
- Tabular-nums on every numeric column, no exception

---

## motion (one named recipe per gesture)

```
flick      150ms cubic-bezier(0.2, 0, 0.2, 1)        accordion expand, drawer toggle
underline  180ms cubic-bezier(0.16, 1, 0.3, 1)       inspector tab indicator translate
ledger     240ms cubic-bezier(0.4, 0, 0.2, 1)        cell save state machine: 200ms saving → 240ms saved-pulse → 800ms hold → idle
inkwell    320ms cubic-bezier(0.4, 0, 0.2, 1)        anchor jump: §§ source pulses, target row underlines L→R
pin        200ms ease-out                             conflict pin slides in from right edge of row
masthead-deal staggered 120ms × 6 fields, 40ms gap   first-paint of populated masthead, ONCE
hatch      static                                    diagonal stripe overlay on gated sections, no animation
ambient-conflict 600ms ease-in-out, period 8s        border-left-width 3px↔4px on first un-ack'd sev-4+

reduced-motion: every duration → 0ms; pulses become instant border-color swap; staggers collapse to single frame.
```

---

## state machine (full)

```
ingest:       empty → ingesting → partial | drafting | error
partial:      drafting (when fatal_gaps.length === 0)
drafting:     conflict-pending (when any sev-4+ opened) | review-ready (when all proofs APS-4+, no open sev-4+)
review-ready: filed (when filing date logged in matter metadata)
any:          error (recoverable; banner pinned to masthead, dossier read-only)
any:          offline (Electron lost backend; banner same shape, "reconnecting…" copy)
```

Per state — what's locked / what's visible:

| state | inspector default | gated |
|---|---|---|
| empty | hidden | everything except matter rail |
| ingesting | [ingest log] | everything except masthead skeleton |
| partial (fatal gaps) | [fatal gaps] | III/V/VI/drafts |
| drafting | [SOF] | drafts only if open sev-4+ or APS<3 in required slot |
| conflict-pending | [conflicts] | drafts only |
| review-ready | [drafts] | nothing |
| filed | [audit] | all editable cells (read-only cast) |
| error | last active | edits |
| offline | last active | edits |

---

## accessibility

- Every anchor `<a href="#§§III.investment">` keyboard focusable; visible focus ring `outline: 1.5px solid --ink; outline-offset: 2px`.
- Inspector tabs: ARIA `tablist` / `tab` / `tabpanel` with `aria-controls` and `aria-selected`.
- Severity is encoded in *three independent variables* (rail thickness, rail color, chip fill). Colorblind-safe by structure.
- Reduced-motion: clamps all motion to 0ms, including the masthead-deal first-paint.
- Color contrast: every text-on-fill combination ≥ 4.5:1 for body, ≥ 3:1 for ≥18px / smcp uppercase.
- All `title=` tooltips reachable via `aria-describedby` on the same element, so screen readers get audit metadata.
- Keyboard map (additive, not replacing existing):
  - `§ §` → anchor jumper
  - `T` → SOF table-mode toggle
  - `1`–`5` while inspector focused → switch mode
  - `?` → key map overlay

---

## tech & constraints

- Existing Next.js custom build (per `AGENTS.md` — read `node_modules/next/dist/docs/` before touching framework).
- Tailwind via existing tokens. No new tokens land in `globals.css`; the spec is composed from existing classes.
- React 18 client components for editable cells (already pattern in `SofChainTable.EditableCell`).
- Anchor state lives in URL hash; inspector mode in query param. Restorable on reload.
- All file mutations go through existing `/api/matter/[id]/fact` PATCH endpoint. No new write paths in this redesign.
- Performance budgets:
  - First populated masthead frame: ≤80ms after `IngestSuccess` resolves
  - Inspector mode switch: ≤16ms (no remount, visibility toggle)
  - Anchor jump scroll: native `scrollIntoView` + 320ms underline overlay
  - Ambient conflict pulse: gated on `document.visibilityState === 'visible'`
- Print path: `Cmd-P` from masthead overflow → print stylesheet that linearizes inspector + sheet into a single serif column with audit ribbon as final page.
