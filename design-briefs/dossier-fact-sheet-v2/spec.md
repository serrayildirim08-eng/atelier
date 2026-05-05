# Atelier — Dossier v2 Spec
**Designer B · Master fact sheet first**

Organized by workflow stage. A token, type, motion or component appears
under the stage where it does its primary work.

---

## Stage 1 — Receive a chaotic client folder
*Workflow: 60–200 PDFs hit the ingest tray. The attorney needs to see
the binder fill in real time and know when ingestion is "good enough" to
start working.*

### Tokens used
- `paper`, `paper-2`, `rule` (skeleton rows)
- `text-eyebrow`, `text-label` mono, `text-meta`

### Components
- **IngestTray** (existing, lightly retouched) — shrinks to a *header
  chip* on the matter header during background ingest. Click expands to
  the right rail with per-PDF progress. Never blocks the fact sheet.
- **MatterHeader** — gains a `header chip` slot (top right) with current
  ingest job count, e.g. `ingesting 12/87 · 03:14 elapsed`.

### Motion
- Ingest progress bar: hairline fill, 1 px tall, `text-ink-2`,
  `--ease-paper`, no rainbow tint. Replaces the current sage→sky→ochre
  band in `globals.css:287`. (One-line CSS swap.)

---

## Stage 2 — Triage for fatal gaps
*Workflow: before any analysis, the attorney needs to know "is anything
disqualifying missing?" — no formation doc, no passport, no I-129.*

### Tokens used
- `--accent-alarm` `#7A2F1F` (NEW — only earned chromatic mark)
- `text-eyebrow`, `text-fact` (NEW)

### Components
- **GateBanner** (in `MatterHeader`) — single line:
  `2 fatal-missing · 1 sev-5 conflict · drafts gated`. Click jumps the
  rail to the first blocker.
- **AnchorRail** glyphs — `‡` in `--accent-alarm` for any anchor whose
  section contains a fatal-missing or sev-5.

### States
| state          | visual                                                       |
| ---            | ---                                                          |
| `clean`        | `ready to generate.` in `text-meta` `text-graphite`          |
| `1-blocker`    | `1 fatal-missing — see facts.` `text-meta` `text-ink-2`      |
| `n-blockers`   | `3 facts blocking · 2 sev-5 — see register.`                 |
| `alarm`        | as above, with 2-px left border in `--accent-alarm`          |

### Motion
- The alarm border on fatal rows: one-time breath on first viewport
  intersection — `keyframes alarm-breath` 2 s sine,
  `rgba(122,47,31,0.55) → 1 → 0.55`. After `IntersectionObserver` fires
  once, the border holds at 1.0. Implement via a `data-alarm-seen`
  attribute toggled on first intersection.

---

## Stage 3 — Establish the master facts table
*Workflow: read the canonical facts top to bottom, edit anything wrong,
verify provenance.*

### Tokens used
- `text-fact` (NEW): `16px/22px, weight 500, letter-spacing -0.005em`,
  tabular numerals.
- `paper-2` for sticky eyebrow row background; `paper-3` for the
  audit gutter ground.

### Components
- **FactSheet** — eight stacked sections (Identity, Enterprise,
  Investment, SOF, Proof, Conflicts, Exhibits, Drafts). Sticky eyebrow
  per section.
- **FactRow** — 28 px standard, 4-column grid `[label | value | inline glyph | source ref]`.
- **AuditMargin** — 14-px gutter on the right edge of the center column,
  ink dot per row showing last-touched-by hover.
- **CitationPane** (right rail) — receives focus from any clicked fact.
  Shows: source quote, page, classifier confidence, full audit trail,
  inline edit input, `Cmd+Enter` to commit.

### States — `FactRow`
| state          | visual                                                       |
| ---            | ---                                                          |
| `set`          | `text-fact text-ink`, source ref in `text-label graphite-soft` |
| `unset`        | italic `unset` in `text-graphite-soft`                        |
| `edit`         | input border `border-ink`, mono if id-shaped                  |
| `saving`       | input shows `… saving` in `text-label graphite-soft` tail     |
| `saved-flash`  | 200 ms underline in `text-ink-2` then dissipates              |
| `error`        | `text-ink` value, error message in `text-meta ink-2` below    |
| `alarm-fatal`  | adds 2-px left border in `--accent-alarm`                     |

### Motion
- Provenance underline reveal: re-use `cite-reveal` in `globals.css` —
  120 ms, `--ease-paper`. Click opens the right rail with no animation
  (margin pane fade only, 240 ms).

### Accessibility
- Each fact row is a `button` with `aria-describedby` pointing at its
  source citation. `unset` rows include `aria-label="unset, click to fill {field name}"`.
- Audit dots are non-interactive at the dot level; the row is the hit
  target. Screen reader announces `last touched by AS at 14:32` on focus.

---

## Stage 4 — Build the SOF chain end-to-end
*Workflow: trace each leg from origin to US deployment, reconcile
dollar amounts across legs, flag any discrepancy.*

### Tokens used
- `paper-3` chain background, `ink-2` flow strokes, `--accent-alarm`
  for delta lines.
- `text-label` mono for delta numbers, `text-meta` for leg captions.

### Components
- **SofChainDiagram** (NEW, replaces `SofChainTable` as primary view) —
  Sankey-style horizontal flow, 240 px tall, stroke width = USD scaled,
  capped 24 px.
  - Origin nodes (left) → intermediate (center) → US deployment (right).
  - Inline glyphs per leg: `✓` corroborated · `·` asserted · `‡` discrepancy.
  - Margin deltas above each leg in mono red ochre when amounts don't
    reconcile (e.g., `−$15,000`).
- **SofChainTable** (existing, demoted) — kept as a fold-down "tabular
  view" toggle. Same data, denormalized rows, editable cells preserved.

### States
| state             | visual                                                  |
| ---               | ---                                                     |
| `empty`           | "No SOF chain on file." `text-body text-graphite`       |
| `partial-chain`   | nodes drawn, missing legs as dashed strokes             |
| `reconciled`      | all legs solid, `Σ chain reconciled` summary line       |
| `discrepancy`     | offending leg in `--accent-alarm`, delta printed above  |

### Interactions
- Hover a leg → right rail shows the doc that proves it (or `no doc on
  file` if asserted).
- Click a node → opens the right rail with the underlying SOF row in
  edit mode (re-uses the existing `EditableCell` + `/api/matter/.../fact`
  PATCH endpoint).

### Motion
- Diagram entrance: 240 ms `--ease-paper`, opacity 0 → 1, no path drawing
  animation. The diagram is a static reading instrument, not a flourish.

---

## Stage 5 — Audit for conflicts
*Workflow: see contradictions inline at the fact they contradict; drill
into a sev-4/5 without leaving the page.*

### Tokens used
- `text-body`, `text-meta`, `--accent-alarm` (sev 5 only).

### Components
- **ConflictSidecar** — inline only sev 4–5 within the fact sheet near
  the relevant section. Sev 1–3 collapse behind a chip
  `12 minor · click to expand` that opens them in the right rail.
- **ConflictDiff** (right rail) — A vs B side-by-side with provenance
  for each. Action row: `dismiss · resolve A · resolve B · note`.

### States
| state          | visual                                                       |
| ---            | ---                                                          |
| `empty`        | "No conflicts on register." `text-body text-graphite`        |
| `low-noise`    | inline 0 conflicts, sidecar chip `n minor`                   |
| `loud`         | ≥1 sev 5: 2-px left border on the inline row in `--accent-alarm` |

### Severity → visual
| sev | weight              | glyph | position cue                |
| --- | ---                 | ---   | ---                         |
| 5   | bold ink + alarm    | `‡`   | inline + 2-px alarm border  |
| 4   | semibold ink        | `‡`   | inline                      |
| 3   | medium ink-2        | `‡`   | sidecar collapsed           |
| 2   | regular graphite    | `·`   | sidecar collapsed           |
| 1   | regular graphite    | `·`   | sidecar collapsed           |

---

## Stage 6 — Map proof slots
*Workflow: at-a-glance which E-2 elements are filled to APS-4, which are
weak, which are missing.*

### Components
- **ProofSlotMatrix** — five rows, one per E-2 element. Each row:
  `slots filled / required` (mono tabular), 5-cell completeness
  sparkline (`■ ■ ■ ▢ ▢` style), verdict glyph.

### Verdict glyphs
- `✓` over-spec or at-spec
- `·` near-spec, mild risk
- `‡` under-spec, raises anchor rail to alarm

### Visual
- Sparkline cells are 8 × 12 px, 2 px gap. Filled = `ink`, weak = `graphite`,
  missing = `paper-deep`. No color.

---

## Stage 7 — Draft / approve / generate
*Workflow: every generation is gated by attorney sign-off; gating is
mechanical not advisory; drafts cite exhibits inline.*

### Components
- **DraftGate** — replaces `GeneratePanel`. Each generator is a row, not
  a card. Row shows: name, prerequisite glyphs (Identity ✓ Enterprise ✓
  SOF ‡ Conflicts ✓), gating verdict, last attempt timestamp.
- **PreGenerationRail** — relocation of `PreGenerationApprovalModal`
  into the right rail, full-height. Same API, same data, same initials
  field. The rail can stay open while the attorney scrolls the fact
  sheet to verify what feeds the generator.
- **DraftCitationLinks** — every `[ex. E-3 p.12]` in a generated draft
  is a click target opening the PDF in the right rail.

### States — `DraftGate` row
| state              | visual                                                     |
| ---                | ---                                                        |
| `gated`            | row in `paper-2`, action button replaced by `blocked — see facts` |
| `gated-soft`       | dotted underline on action; click opens warn rail          |
| `unlocked`         | action `approve & generate` in `text-eyebrow`              |
| `awaiting-initials`| rail open, initials input focused                          |
| `generating`       | header chip increments, row shows `· generating · 02:14`   |
| `complete`         | row tail shows `last: AS · 14:32 · cover_letter_v0.5.docx` |

### Gating logic
- `gated` if any fatal-missing field unset OR any sev-5 conflict open.
- `gated-soft` if any sev-3/4 conflict open.
- `unlocked` if all fatal facts set, no sev-5, no sev-4, sev-3 explicitly
  acknowledged.

---

## Stage 8 — Re-classify edge cases
*Workflow: bot misclassifies a brokerage statement as a personal bank
statement; the attorney needs to fix it without spelunking.*

### Components
- **ClassifierOverride** (right rail, opens from `ExhibitGrid` row) —
  inline dropdown over the bot's classification, classifier confidence
  visible at the moment of decision (`detect 0.72`), commit writes
  audit entry. Two clicks total.

### States
| state              | visual                                              |
| ---                | ---                                                 |
| `bot-only`         | bot label + confidence `(detect 0.72)`              |
| `attorney-override`| attorney label, source `manual override · AS · 14:32` |

---

## Stage 9 — Hand off to paralegal / co-counsel
*Workflow: someone else opens the matter and can pick up where the
previous attorney stopped.*

### Components
- **AuditMargin** (already specced in stage 3) — every row carries
  attribution. Hover reveals last-touched-by + timestamp.
- **MatterHeader** sub-line — `last touched: AS · 14:32 · facts.investment.total_committed_usd`.
  One line, top right under the matter name.
- **ResumeMarker** — Cmd+K opens to "where you were last." The matter
  remembers the scroll anchor and the last-edited field per attorney.

---

## Stage 10 — Live with RFE/NOID risk
*Workflow: every choice must be auditable as a future litigation exhibit
without ceremony.*

### Components
- **RfeChip** — appears in `MatterHeader` when an RFE/NOID is on file.
  `RFE pending — 30 days remaining`.
- **AuditMargin filtered** — when RFE active, audit dots brighten to
  `ink` for any fact touched after RFE issuance date. Cmd+K filter:
  `since:rfe`.
- **NoIDDraftRow** — appears in `DraftGate` only when RFE is on file
  (re-uses existing `noid_principal` / `noid_dependent` generators).

---

## Global — palette, type, motion (cross-stage)

### Palette tokens (final)
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
--accent-alarm:       #7A2F1F;     /* NEW — sev 5 + fatal-missing only */
```

### Type scale (final)
```
text-eyebrow  11/14  600 caps  +0.14em       smcp
text-label    12/16  400 mono  0             ids, page cites, hashes
text-meta     13/18  400       0             tail captions, conflict refs
text-body     14/20  400       0             fact descriptions
text-fact     16/22  500       -0.005em      NEW — fact sheet primary values
text-title    22/26  600 disp  -0.012em      panel titles, matter name short
text-page     32/36  400 disp  -0.018em      matter header H1
```

### Motion curves (final)
```
--ease-paper:    cubic-bezier(0.22, 0.61, 0.36, 1);  /* default */
--ease-decisive: cubic-bezier(0.16, 1, 0.30, 1);     /* gate, generate */
--ease-margin:   cubic-bezier(0.40, 0.00, 0.60, 1);  /* right-rail swap */

duration-micro:    120ms
duration-standard: 240ms
duration-decisive: 400ms

prefers-reduced-motion: kill alarm-breath; transitions → 1ms; focus rings static.
```

### Spacing
- Outer padding: 48 px.
- Three-column gap: 24 px.
- Section gap inside fact sheet: 56 px.
- Row gap inside section: 24 px (group) / 0 px (table-like dense).
- Fact row height: 28 px / 44 px (with provenance strip).
- Diagram: 240 px tall.
- Right rail: 320 px wide. Left rail: 240 px wide.

### Keyboard map (v1)
```
g f / g s / g p / g c / g e / g d / g a   jump to section
j / k                                     row down / up in fact sheet
e                                         edit current row in right rail
Cmd+Enter                                 commit edit
Esc                                       revert / close rail
Cmd+K                                     dossier search
?                                         cheatsheet (paper-recess overlay)
```

### Accessibility
- All text contrast ≥ AA on `paper`. `--accent-alarm` on `paper` is
  AA at 16 px regular and AAA at 14 px bold — verified.
- Focus rings: 1.5 px solid `ink`, 2 px offset. Never removed.
- The 12-px audit margin gutter is decorative; all attribution is also
  exposed via `aria-describedby` on each fact row.
- Reduced motion preferences kill ambient breath and slow transitions.

### Tech constraints
- Next.js (breaking version per `node_modules/next/dist/docs/`) + Tailwind.
- All existing API routes preserved: `/api/matter/[id]/fact PATCH`,
  `/api/matter/[id]/preview POST`, `/api/matter/[id]/approve POST`,
  `/api/export POST`.
- All existing data shapes preserved (`E2Facts`, `IngestSuccess`,
  `PreviewRecord`, `PreviewFactRow`, `PreviewConflictEntry`).
- Existing `globals.css` motion utilities re-purposed: `cite-reveal`,
  `dinkus`, `paper-recess`, `paper-grain`. The sage→sky→ochre loading
  band is the only utility being recolored (to `text-ink-2`).
- Two new tokens added: `--accent-alarm` and `text-fact`. Nothing
  removed.
