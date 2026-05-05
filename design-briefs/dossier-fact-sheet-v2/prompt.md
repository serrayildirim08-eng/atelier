# Atelier — Dossier v2 (Designer B: Master Fact Sheet First)

> Paste-ready brief for a fresh Claude. The deliverable is the redesign of the
> Atelier matter dossier as a **single dense fact-sheet view** that an attorney
> can read in three seconds and act on in thirty. Exhibits, conflicts, SOF
> chain, audit, and drafts are panels that *reference the fact sheet by anchor*,
> not parallel tabs that compete with it.

## 1. one-line vision

The dossier is a master fact sheet you can scan like a deposition outline —
every other surface in the app is a citation that lands you back inside it.

## 2. context

- Desktop Electron app for an immigration attorney handling E-2 cases.
- Single power user. No client-facing surfaces.
- 13" MBP minimum, 27" iMac maximum. Optimize for 1440 px first, scale.
- The attorney already knows the case shape — she does not need a wizard.
  She needs to know what's missing in this file before her 11 AM call.
- Existing IA spine stays: ingest → dossier → generate. Reorganize within.
- Existing tokens stay: `paper`, `paper-2`, `paper-3`, `paper-deep`, `ink`,
  `ink-2`, `graphite`, `graphite-soft`, `rule`, `rule-strong`. Quiet palette.
  No invented color. Severity is carried by **weight + glyph + position**,
  not chromatic accent. One earned exception below.
- Courier New is the monospace voice (file paths, IDs, page citations,
  numerical fields, audit hashes). Non-negotiable. Display face stays the
  current serif (Lyon / Source Serif via the existing `font-display` slot).

## 3. references — by workflow problem solved

| Problem this UI must solve                           | Reference                                                  | What to borrow                                                                    | What NOT to borrow      |
| ---                                                  | ---                                                        | ---                                                                               | ---                     |
| dense facts you scan, don't navigate                 | Bloomberg Terminal MAIN window                             | the rectangle of canonical facts always pinned; surrounding panels reference it   | green-on-black; clutter |
| left rail of permanent anchors, right rail mutates   | Linear issue page                                          | the two-rail anchor + content split; spacebar-to-zoom focus mode                  | rounded SaaS chrome     |
| at-a-glance gap detection                            | Bloomberg LAW docket sheet                                 | the run of dashes that marks a missing field — instantly diagnostic               | overstuffed top nav     |
| facts that cite their own provenance                 | Are.na block + source                                      | hover reveals provenance without nav cost                                         | grid card aesthetic     |
| dense tabular reading                                | Edward Tufte sparkline tables (Beautiful Evidence, p. 47)  | sparkline-density per row; one number, one trend, one flag                        | nothing — borrow it all |
| conflict register that intrudes only at sev 4–5      | NYT Pitchbot diff view                                     | inline strike-through + side margin glyph; nothing modal                          | red/green coloration    |
| SOF chain as a single readable diagram               | Sankey flows in FT Visual Vocabulary                       | left-to-right flow with width = dollars; reconciliation deltas printed in margin  | rainbow segmentation    |
| audit trail without leaving the page                 | Git blame gutter (GitHub)                                  | a 14-px margin column showing last-touched-by + timestamp on hover                | full-bleed diff panes   |
| keyboard-first navigation                            | Superhuman                                                 | `j/k` row, `g f` to facts, `g s` to SOF, `?` for cheatsheet                       | gamified onboarding     |
| document-as-citation, not document-as-thumbnail      | Westlaw KeyCite                                            | exhibits referenced as `[ex. E-3 p.12]`, click jumps to PDF in same column        | branded chrome          |

Anti-references: any AI tool that uses sparkles or rainbow gradients;
Notion AI page summaries; Apple Notes (too soft); Linear's empty states
(too playful). Atelier is a deposition exhibit binder rendered in software,
not a productivity app.

## 4. palette

Existing tokens, used like this:

```
--color-paper          #FAFAFA   sheet (everywhere by default)
--color-paper-2        #F0F0F0   recessed surfaces (header strips, fact sheet rail)
--color-paper-3        #E5E5E5   gutter columns (audit margin, chain background)
--color-paper-deep     #D4D4D4   inactive thumbnails, severity 1 dots
--color-ink            #0A0A0A   primary type, severity 5 marks, primary CTA fill
--color-ink-2          #1F1F1F   secondary type, severity 4 weight
--color-graphite       #404040   tertiary type, smcp eyebrows, severity 3
--color-graphite-soft  #595959   trailing meta, page citations, severity 1–2
--color-rule           rgba(10,10,10,.10)  hairlines, table borders
--color-rule-strong    rgba(10,10,10,.32)  emphatic borders, fact sheet frame
```

**One earned accent — `--accent-alarm` `#7A2F1F` (oxidized red ochre, not bright red).**
Used only for *severity 5 dispositive conflicts* and *required-but-missing
fatal exhibits* (no formation doc, no passport, no I-129). Appears as a
2-px left border on a fact-sheet row, a single dot in the conflict
sidecar, and a `‡` glyph in the SOF chain. **Nowhere else.** Severity
4 stays ink-bold. Severity 1–3 stay graphite/graphite-soft.

The accent is the only chromatic mark in the entire UI. It functions
like the red wax seal on a sealed envelope — when it appears, you stop.

## 5. typography

```
font-display    existing serif (Lyon / Source Serif), 400/600/700
font-body       existing sans (Inter Tight or current default), 400/500/600
font-mono       'Courier New', monospace, 400/700  ← non-negotiable
```

| token       | size / line-height          | weight       | letter-spacing | use                                                |
| ---         | ---                         | ---          | ---            | ---                                                |
| `text-eyebrow` | 11 px / 14 px            | 600 caps     | 0.14em         | `smcp` section labels (`facts`, `chain`, `register`)  |
| `text-label`   | 12 px / 16 px            | 400 mono     | 0               | page citations, IDs, hashes, file paths            |
| `text-meta`    | 13 px / 18 px            | 400          | 0               | tail captions, exhibit refs                        |
| `text-body`    | 14 px / 20 px            | 400          | 0               | facts, descriptions, conflict text                 |
| `text-fact`    | 16 px / 22 px            | 500          | -0.005em       | **the fact sheet primary values** (NEW)            |
| `text-title`   | 22 px / 26 px            | 600 display  | -0.012em       | the matter name, panel titles                      |
| `text-page`    | 32 px / 36 px            | 400 display  | -0.018em       | matter header H1 only                              |

`text-fact` is the new token Designer B introduces — it is the size you
see when the eye lands on the fact sheet. It sits between body and title,
weighted just enough to be the densest readable rank. Tabular numerals
on every numerical field.

Italic is reserved for **null/empty fields** (a fact that has not been
extracted yet renders as `unset` in `text-graphite-soft italic`). Italic
is a mark of absence, full stop. Never used for emphasis.

## 6. layout & spacing

The dossier is a three-column instrument. Always.

```
  [ 240px      ]  [ flexible center           ]  [ 320px       ]
  [ anchor     ]  [ master fact sheet         ]  [ panel       ]
  [ rail       ]  [ + diagram strip           ]  [ (mutable)   ]
```

- **Left rail (240 px, fixed):** the matter spine — investor name, legal
  entity, posture pill, a vertical list of *anchors* that scroll the center
  to the corresponding section. Anchors: Facts · SOF Chain · Proof Slots ·
  Conflicts · Exhibits · Drafts · Audit. Each anchor has a glyph status
  to the right (`✓` complete, `·` partial, `‡` blocked, `‡` in alarm if
  fatal). The rail is the *only* place tabs exist anymore — and they are
  not tabs, they are scroll anchors.

- **Center column (fluid, 720 px – 1100 px):** the master fact sheet,
  rendered as a single long readable document of stacked sections. This
  is the *thing*. Eight sections separated by hairline rules (`border-rule`)
  with eyebrow labels (`text-eyebrow`):

  1. **Identity** — investor full name, nationality, passport last4 +
     expiry, current US status, dependents count.
  2. **Enterprise** — legal name, EIN last4, formation date, state, NAICS,
     physical address, lease term.
  3. **Investment posture** — committed, irrevocably spent, proportionality
     %, substantiality verdict, marginality verdict.
  4. **Source-of-funds chain** — the diagram (see §13).
  5. **Proof slots** — five rows, one per E-2 element. Each row shows
     filled/weak/missing slot count, with a single sparkline.
  6. **Conflict register** — *only sev 4–5 inline*; sev 1–3 collapsed
     behind a count chip.
  7. **Exhibits** — A–L tab grid, one row per tab, doc count, page count,
     completeness glyph.
  8. **Drafts** — the generators with their gating state.

  Spacing: 56 px between sections, 24 px within. Hairline rule between
  sections. Each section's eyebrow is sticky inside its section so you
  always know where you are during a long scroll.

- **Right rail (320 px, mutable):** the *citation pane*. Whatever is
  hovered or focused in the center column expands here with provenance:
  the source PDF page, the rich-extractor confidence, the audit trail
  (who wrote this fact, when, what was the previous value), and an
  inline edit affordance. **No modals.** Edit happens here in the rail
  with `Cmd+Enter` to commit, `Esc` to revert. The right rail also
  serves as the home for the conflict drill-down when a sev-4/5 row is
  clicked — same pane, different content.

- 48 px outer page padding. The matter header (page-level H1) is 96 px
  tall, fixed at top, holding only matter name + posture chip + the
  *gate banner* (see §9). The header never scrolls away.

- Density rule: a row in the fact sheet is 28 px tall (data row) or 44 px
  (data row with provenance hover-strip). The chain diagram is 240 px tall.
  Nothing else exceeds 320 px without being a scrollable panel.

## 7. motion grammar

Atelier is a legal instrument, not a product demo. Motion is restraint.

- `--ease-paper`   `cubic-bezier(0.22, 0.61, 0.36, 1)`  — default for all UI
- `--ease-decisive` `cubic-bezier(0.16, 1, 0.3, 1)`  — for state changes that
  carry weight (gate unlocks, draft generated, conflict resolved)
- `--ease-margin`  `cubic-bezier(0.4, 0, 0.6, 1)`  — for the right-rail
  citation pane swap (it slides up 4 px and re-fades, not horizontally)

Durations:
- micro (rule reveal, eyebrow underline, hover states)  120 ms
- standard (rail anchor scroll, panel swap, edit mode)  240 ms
- decisive (gate banner appear, alarm dot pulse one-time)  400 ms

Only ambient motion in the entire app: when a fatal-missing field is
unset, the row's left 2 px alarm border breathes between
`rgba(122,47,31,0.55)` and `rgba(122,47,31,1.0)` on a 2 s sine, *only
until the attorney has scrolled past it once*. After first viewport
intersection, it stays solid. This is the UI's only un-prompted gesture.

`prefers-reduced-motion`: kill the ambient breath; cut all transitions
to 1 ms; keep `:focus` rings static. Audit attribution still hovers in
without a fade — instant.

No spring physics. No bounces. No staggered card entrance. This is a
binder, not a slot machine.

## 8. component inventory

Every component has explicit states. Names assume the new spec.

### `MatterHeader`
`states:` `unloaded` · `loaded-clean` · `loaded-with-gate` · `loaded-with-alarm`
- Holds: matter name (`text-page`), posture chip, dependents chip, the
  *gate banner* slot.
- Always visible. Never collapses.

### `AnchorRail` (left)
`states:` `idle` · `scrolled` (current anchor highlights via `text-ink` +
2px ink left border) · `alarm` (anchor glyph swaps to `‡` in
`--accent-alarm` if its section contains a sev-5 conflict or a fatal
missing slot)
- Anchors: Facts, SOF, Proof, Conflicts, Exhibits, Drafts, Audit.
- Keyboard: `g f`, `g s`, `g p`, `g c`, `g e`, `g d`, `g a`. `?` shows
  the cheatsheet (a `paper-recess` overlay, not a modal).

### `FactSheet` (center)
`states:` `loading-skeleton` · `partial` · `complete`
- Eight stacked sections with sticky eyebrows.
- Each row is a `FactRow` (see below).
- Section completion glyph in eyebrow row tail: `02/07 unset` etc.

### `FactRow`
`states:` `set` · `unset` · `edit` · `saving` · `saved-flash` · `error` · `alarm-fatal`
- 28 px row, 4-column grid: `[ label  |  value (text-fact)  |  sparkline/glyph  |  source ref ]`
- Hover anywhere on the row: `paper-2/40` tint, audit margin column reveals
  `last touched by AS · 14h ago` in `text-label` graphite-soft.
- Click: focus moves to the right rail with provenance + edit affordance.
- `unset` renders italic `unset` in graphite-soft. `alarm-fatal` adds the
  2-px left border in `--accent-alarm`.
- The cell values use Courier mono only when the value is identifier-shaped
  (EIN, passport, account last4, hash, page citation). Names and prose stay
  in `text-fact` sans.

### `SofChainDiagram`
`states:` `empty` · `partial-chain` · `reconciled` · `discrepancy`
- Replaces the current `SofChainTable` as the **primary** SOF view. Sankey-style
  horizontal flow at 240 px tall: origin nodes → intermediate nodes →
  US deployment nodes. Stroke width = USD scaled, capped 24 px.
- Each leg has a single inline glyph: `✓` (corroborated, doc on file),
  `·` (asserted, no doc), `‡` (discrepancy in dollar amount across the leg).
- A *delta margin*: any leg whose dollars don't reconcile shows the delta
  as a small Courier number above the leg in `--accent-alarm`
  (`-$15,000 between MT103 and bank statement`).
- Below the diagram: a 2-line summary — `Σ chain total · chain depth ·
  reconciliation status`.
- Hovering a leg reveals the doc in the right rail.
- The current `SofChainTable` becomes a fold-down "tabular view" toggle —
  same data, denormalized rows.

### `ProofSlotMatrix`
`states:` `under-spec` · `at-spec` · `over-spec`
- Five rows (treaty nationality · substantial investment · real-and-operating ·
  marginality · develop-and-direct). Each row shows: `slots filled / required`
  as a tabular number, an inline 5-cell completeness sparkline (filled /
  weak / missing), and a verdict glyph.
- A row in `under-spec` raises the section's anchor in the left rail to alarm.

### `ConflictSidecar`
`states:` `empty` · `low-noise` · `loud` (≥1 sev 5)
- Inline in the fact sheet *only sev 4–5*. Sev 1–3 collapse behind a chip
  (`12 minor · click to expand`).
- Each inline conflict is a single line: `‡ {description} · A: {doc}p.{n} · B: {doc}p.{n}`.
- Click expands into the right rail with the diff view.

### `ExhibitGrid`
`states:` `under-binder` · `complete-binder`
- A–L tabs as a 12-row grid (not a 12-column grid like before). Each row:
  letter, title, count, completeness glyph, optional missing-required hint.
- Clicking a row opens the per-tab list in the right rail (not navigating
  away). Thumbnails only inside the right rail, not in the center column.

### `DraftGate`
`states:` `gated` · `gated-soft` · `unlocked` · `awaiting-initials` · `generating` · `complete`
- Each generator (cover letter, business plan, I-129, etc.) is a row, not
  a card. The row shows: name, prerequisite glyphs (which fact sections
  are complete enough), gating verdict, last generated timestamp.
- A generator is `gated` when any sev-5 conflict or fatal-missing field
  is unresolved. Click on `gated` opens the right rail with *exactly which
  facts are blocking generation* — no guessing.
- `gated-soft` (sev 3–4 unresolved) shows a dotted-underline warn glyph
  but allows generation behind a confirm rail.

### `AuditMargin`
`states:` `quiet` · `revealed`
- A 14-px gutter on the *right edge of the fact sheet center column*.
  Always present, normally rendered as `paper-3` ground, no marks.
- Each row's audit attribution is a 4-px ink dot in this gutter; hover
  the row, the dot expands into a horizontal pill: `AS · 14:32 · src
  G-28.pdf p.2`. Click to pin into the right rail with the full audit
  trail back to ingest.

### `GateBanner` (in `MatterHeader`)
`states:` `clean` · `1-blocker` · `n-blockers` · `alarm`
- One line in the header strip: `3 facts blocking · 1 sev-5 conflict ·
  drafts gated`. Click jumps the rail to the first blocker.
- `alarm` state pulls in the `--accent-alarm` 2-px left border.

## 9. state machine

| Stage of work                       | What the UI surfaces in 3 seconds                                        |
| ---                                 | ---                                                                       |
| Just opened a freshly ingested file | Gate banner: `5 facts unset · 2 sev-5 conflicts · drafts gated`. Anchor rail shows alarm on Facts + SOF + Conflicts. |
| Mid-flight (paralegal handoff)      | Last-touched line in audit margin; Drafts section shows last attempt + timestamp + initials. Anchor rail shows progress glyphs. |
| Approving a draft                   | Right rail becomes a pre-generation review; never a modal. Initials field lives at bottom of rail, sticky. |
| Conflict resolution                 | Click sev-5 inline → right rail diffs A vs B → attorney edits one or both inline → conflict reclassified or dismissed → row removes inline. |
| RFE/NOID coming in                  | A new top-level header chip `RFE pending — 30 days`. Audit margin shows which facts have been touched since RFE was issued. Drafts section unlocks the `noid_*` row. |
| Re-classifying a misclassified PDF  | Click an exhibit thumbnail in the right rail, type override appears inline; classifier confidence shown next to the override; commit writes audit entry. |

## 10. surface rules

- The fact sheet center column **never stops being the fact sheet**.
  Generators, conflicts, audit, exhibits — none of them replace the
  center. They open in the right rail, period.
- No modals except `PreGenerationApprovalModal` is *re-implemented* as a
  *full-height right-rail panel*, not an overlay. Consequently it can sit
  open while the attorney scrolls the fact sheet to verify the facts the
  generator will use.
- No tabs in the dossier proper. The current 8-tab strip is removed.
  The left anchor rail replaces it entirely.
- Confidence is always shown next to the value, never hidden. When the
  bot's classification confidence is < 0.85, the value is shadowed with a
  subtle `text-graphite-soft` tail `(detect 0.72)` in `text-label` mono.
- Source citation is always one click away — page number on hover, click
  opens the PDF in the right rail at that page.
- File paths and IDs are always Courier. Prose is always serif/sans.
  Mono next to prose is the visual cue for *audit truth*.

## 11. voice & microcopy

Lawyerly. Dry. Lowercase eyebrows, sentence case for facts, no exclamation.

- Section labels: `facts` · `chain` · `proof` · `register` · `binder`
  · `drafts` · `audit`. (Lowercase, smcp.)
- Empty fact: `unset` (italic graphite-soft). Never "—".
- Missing fatal exhibit: `not on file — required for filing`.
- Gated draft: `blocked by 3 unset facts · 1 sev-5 conflict`.
- Conflict description: short declarative — `cover letter says $425,000;
  escrow ledger says $410,000.` Period.
- Audit attribution hover: `AS · 14:32 · prev 410000 → 425000`.
- Gate banner: `ready to generate.` (when clean) or `2 blockers — see
  facts.` (when not). Single-sentence.
- Save flash on a fact: 200ms `saved` underline in `text-label` mono.
  Not a toast.
- No "successfully," no "great," no "all set." Things are either on or
  off the binder.

## 12. game-tier polish (the five details)

1. **Audit margin gutter** — a permanent 14-px ground on the right edge
   of the center column with subtle `paper-3` fill, where attribution
   dots accumulate. Reads like the date column on a court docket.
2. **Alarm border that breathes once** — the `--accent-alarm` 2-px left
   border on fatal-unset rows pulses for 2 s, *one cycle*, on first
   viewport intersection. After the eye has caught it, it stays solid.
   The UI does not nag.
3. **Cmd+K dossier search** — a `paper-recess` quick-jump that searches
   facts (`investor.passport_number`), exhibits (`E-3 wire 8819`), and
   conflicts (`cover_letter dollar_mismatch`). Searching jumps the
   fact sheet to the field and opens the right rail with provenance.
4. **Provenance hover slip** — when hovering any fact row, a 1-px
   underline reveals from left to right under the value, terminating
   in the page citation set in Courier (`p. 12, garanti_FX_confirmation.pdf`).
   The slip is the existing `cite-reveal` motion in `globals.css`,
   re-purposed.
5. **The dinkus between sections** — the existing `dinkus` glyph in
   `globals.css` separates major fact-sheet sections instead of bare
   hairlines. It's the only piece of typographic ornament in the entire
   app and it carries the editorial DNA of the firm. (The dinkus exists
   in `globals.css:128` already; use it.)

## 13. anti-patterns — never ship

- A separate "Audit" tab. Audit is a margin gutter that lives in the fact
  sheet. It does not get its own page.
- A wizard. The attorney is fluent. No first-run, no onboarding, no
  "let's get started."
- Card grid for exhibits in the center column. Exhibits are a *list of
  rows* in the center; thumbnails live in the right rail only.
- Rainbow gradients on the loading state. Loading is a hairline rule
  filling left-to-right in `text-ink-2`. Period.
- Severity carried by color outside the one earned alarm. Severity 1–4
  is weight + glyph + position. Color enters at sev 5 and at fatal-missing.
- Toasts. Every state change happens in place — saved underline, audit
  dot in the margin, gate banner update. The existing `GenerationToastStack`
  shrinks to a single header chip showing job count.
- A "Continue" button anywhere. The attorney reads. She doesn't progress.
- Modal overlays for routine actions (edit, classify, view PDF). All of
  it lands in the right rail.
- Frosted glass. Not in this app.
- Springs. Not in this app.

## 14. tech & constraints

- Stack: Next.js (the breaking version per `node_modules/next/dist/docs/`)
  + Tailwind + Electron host. No new framework.
- All new tokens (`--accent-alarm`, `text-fact`) added to
  `app/globals.css` and `tailwind.config.ts`. Replace none of the
  existing tokens.
- Components to refactor in place: `app/page.tsx` (the dossier shell
  becomes the three-column instrument), `case-overview-card.tsx`,
  `sof-chain-table.tsx` (becomes `SofChainDiagram` + tabular fold-down),
  `conflict-register.tsx` (becomes `ConflictSidecar`), `document-inventory.tsx`
  (becomes `ExhibitGrid`), `generate-panel.tsx` (becomes `DraftGate`),
  `pre-generation-approval.tsx` (relocates to a right-rail panel, not a
  modal — keep the API).
- Keep all existing `field_path`, audit, preview, and approve API contracts.
  This is a UI redesign, not a backend change.
- Keyboard map ships in v1: `g f/s/p/c/e/d/a`, `Cmd+K`, `j/k` row navigation
  in the fact sheet, `Cmd+Enter` to commit, `Esc` to cancel, `?` to show
  the cheatsheet.
- Reduced motion: respect `prefers-reduced-motion`. Default the alarm
  breath off in that mode.

## 15. success criteria

The redesign ships when an attorney can:

1. Open a freshly ingested matter and answer "what's missing?" in **under
   30 seconds** without changing tabs.
2. See every sev-4/5 conflict on the same scroll as the fact it
   contradicts.
3. Trace any SOF leg from origin doc to US deployment in **one diagram,
   no clicks**, with reconciliation deltas printed in the margin.
4. Be **structurally prevented** from generating a cover letter when any
   fatal fact is unset or any sev-5 conflict is unresolved — the gate is
   not a checkbox, it is a closed door with a list of what to fix.
5. Hand the matter to a paralegal who, on opening, sees in the audit
   margin **who touched what last and when** — without leaving the
   fact sheet.
6. Override the bot's classification of a single PDF in **two clicks**,
   with the bot's confidence visible at the moment of decision.

If any of these takes more than the stated number of clicks or seconds,
the redesign has failed. Iterate on the rail, not on the spec.
