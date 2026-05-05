# Atelier — Master Fact Sheet First (Designer A)

## one-line vision

A two-column dossier that boots to a single **dense, audited fact sheet** — the attorney's source of truth — with every other surface (SOF, conflicts, proof slots, drafts, audit) docked as a right-side **inspector** that anchors *into* the sheet by `§§` reference. The sheet is the case. Everything else is a lookup.

## context

Atelier is an Electron desktop tool for E-2 visa attorneys. Sole audience: the attorney (and a paralegal who can pick up mid-flight). Information density is a feature, not a tax. The current UI buries decisions behind eight tabs (Facts / Exhibits / Drafts / Review / Audit / Binder / Context / Log) — the attorney has to *remember which tab the answer lives in*. We collapse that into one persistent left rail (the sheet) and one inspector (the lookup), with the eight tabs reduced to four **modes** of the inspector.

The existing token system stays. Courier New / `font-mono` is the monospace voice — non-negotiable. Quiet ink-on-paper. One earned accent reserved for severity 4–5.

## references (workflow-first, not aesthetic)

1. **Bloomberg Terminal — Security Description (DES)** screen. Every fact is one row, label-on-left, value-on-right, anchor letter on far left. Mash-keystroke navigation. We borrow: `§§A` `§§E` `§§G` anchor codes the attorney can type to jump.
2. **Linear's issue page** (left: triage queue; center: the issue; right: properties inspector). We borrow the three-pane geometry and the *"properties never leave the screen"* discipline. Don't borrow: the colorful labels.
3. **Notion's Sync Blocks** for fact-sheet → cover-letter binding. We borrow the idea that the same fact appears in two surfaces and edits propagate. Don't borrow: chrome, slash menus, hover affordances.
4. **Stripe Dashboard — Payment Detail page**. The "what" lives at the top in a fixed strip that survives scroll; chronological events stack below; right rail shows related objects (customer, dispute, payout). We borrow: pinned masthead + scrollable timeline + right rail.
5. **GitHub Pull Request — "Files changed" with sticky review controls**. Reviews stay visible while scrolling diff. We borrow: severity-1-to-5 conflicts that *pin themselves* to the relevant fact row when in view.
6. **Looker Studio / Tableau audit captions** ("Last refreshed by Jane · 02:41 EDT") that surface attribution without a separate tab. We borrow: every cell carries a 4px-wide left border encoding `bot-classified | attorney-confirmed | attorney-overridden`.
7. **Adobe Acrobat Pro — bookmark sidebar** with consistent depth indents. We borrow: the SOF chain renders as a left-anchored vertical spine with leg numbers `01 → 02 → 03`.
8. **Things 3 — Today screen on first open**. Empty state is more loved than full state — but it shows you exactly what's missing. We borrow: the "fatal-gap" boot screen when a matter has no formation doc / no passport / no I-129.

## palette (existing tokens, no invention)

```
--paper          #FAFAFA   sheet ground
--paper-2        #F0F0F0   recessed surfaces (inspector, masthead, accordion summaries)
--paper-3        #E5E5E5   keycap chip / severity-5 fill behind tag
--paper-deep     #D4D4D4   scrollbar tracks only
--ink            #0A0A0A   primary type, severity-5 chips, attorney-confirmed border
--ink-2          #1F1F1F   secondary type, severity-4 chips
--graphite       #404040   meta type, bot-classified border
--graphite-soft  #595959   page numbers, p.refs, dash placeholder
--rule           rgba(10,10,10,0.10)  hairlines
--rule-strong    rgba(10,10,10,0.32)  card borders, severity-3 borders
```

**The earned accent.** No new color. The accent IS contrast: severity-5 conflicts use a 3px **`--ink`** left rail + the chip text inverts to `--paper` on `--ink` background. Severity-4 keeps the 3px rail but in `--rule-strong`. That's the entire alarm vocabulary. We do not introduce red, ochre, or sage. Quiet panic.

**Confidence ribbon (bot signal).** A 4px left border on every editable cell encodes provenance:
- bot, low conf (<0.6) → 4px `--rule` (almost invisible) + value rendered in `--graphite` italic
- bot, mid conf (0.6–0.85) → 4px `--rule` + value rendered in `--ink-2`
- bot, high conf (>0.85) → 4px `--rule-strong` + value rendered in `--ink`
- attorney-confirmed → 4px `--ink` solid + a single `✓` in `font-mono text-label` after value
- attorney-overridden → 4px `--ink` solid + a single `↻` glyph + provenance trailer ("was: $410,000")

## typography

Serif (Fraunces, via `--font-display`) earns its spot in *exactly two* places: the matter masthead H1 and the section roman numerals (`I`, `II`, `III`). Everywhere else is the existing 15px sans body or `font-mono` (Courier-grade) for facts, refs, audit timestamps.

```
hero-mast    72/76, Fraunces 700, opsz 96, tracking -0.014em       investor name in masthead
section-num  38.4/1.0, Fraunces 400 italic, opsz 36, -0.01em        roman numerals beside §§ anchors
title        16.8/1.2, system 600                                   inspector tab labels, generator card titles
body         15/1.55, system 500                                    reading copy, descriptions
fact-mono    15/1.45, ui-monospace 500, tabular-nums                every fact value, every USD, every passport
meta         13/1.5, system 500                                     subtitles, hints, descriptions
ref-mono     11.5/1.0, ui-monospace 600, tracking 0.06em            §§ anchors, page refs, audit timestamps
smcp-label   11.5/1.0, system 600, uppercase, tracking 0.10em       eyebrows, "the matter", "severity"
```

**Numbers are always `font-mono tabular-nums`.** Even when the surrounding type is sans. USD, percentages, EIN last-four, page refs, dependent counts, days-to-admit-until — all monospace, so a single column of $425,000 / $410,000 / $415,000 reads with mechanical precision and a discrepancy *visually pops* before the reviewer has to scan.

## layout & spacing

**Three columns, all visible, all the time on >=1280px:**

```
┌─────────────┬───────────────────────────────────────────────┬───────────────────┐
│  matter     │                                               │                   │
│  rail       │   the sheet (scrollable, dense, audited)      │   inspector       │
│  240px      │   flexes 720–960                              │   400px           │
│             │                                               │                   │
│  case index │   §§ pinned masthead (84px, fixed within col) │   tab strip:      │
│  fatal-gaps │   I.   parties                                │   [SOF]           │
│  next step  │   II.  enterprise                             │   [conflicts]     │
│             │   III. investment & SOF                       │   [proof slots]   │
│             │   IV.  proof slots                            │   [drafts]        │
│             │   V.   conflicts                              │   [audit]         │
│             │   VI.  drafts                                 │                   │
│             │                                               │                   │
└─────────────┴───────────────────────────────────────────────┴───────────────────┘
```

On 13" MBP (1440 wide), inspector collapses to 360px and the rail narrows to 200px. Below 1280px (rare for desktop legal tool) the inspector docks as a bottom sheet at 320px tall — never a hidden modal.

**Spacing scale (8px grid).** Inter-section: 64px. Inter-row inside section: 12px. Cell padding: 14px vertical / 18px horizontal. Masthead-to-rail vertical rhythm: 24px. Hairline-vs-card: hairlines for *within-section* boundaries, full borders only for cards that contain edits.

**The masthead never scrolls.** It is `position: sticky; top: 0` within the center column. It carries: investor name (serif H1), E-2 subtype, posture, dependents, I-94 admit-until chip, service center jurisdiction, and a `confidence: 87%` ribbon for the entire detection. When the attorney scrolls down to §IV proof slots, she still sees who and what she's working on.

## motion grammar

This is a desk tool. Motion is mechanical, not balletic.

```
flick           150ms cubic-bezier(0.2, 0, 0.2, 1)        section-accordion expand
underline       180ms cubic-bezier(0.16, 1, 0.3, 1)       inspector tab indicator
ledger          240ms cubic-bezier(0.4, 0, 0.2, 1)        cell save → ✓ pulse → idle
inkwell         320ms cubic-bezier(0.4, 0, 0.2, 1)        anchor jump: §§ pulses, target row underlines
pin             200ms ease-out                             conflict pins itself to row when in viewport
```

**No springs, no easing-out-back, no overshoot.** This is a paper-on-desk metaphor. A page does not bounce.

**Reduced motion.** All durations clamp to 0ms; the pulse becomes an instant border-color swap; the anchor jump becomes a `scrollIntoView({ behavior: 'auto' })`.

**The one ambient detail.** When the dossier has been idle for 12s and there is at least one severity-4-or-5 conflict that is not yet acknowledged, the conflict's left rail (`--ink`) breathes a 600ms `border-left-width: 3px → 4px → 3px` pulse every 8s. Stops on hover or scroll. Never on severity-≤3.

## component inventory (organized by workflow stage)

### stage 1–3 · receive · triage · facts (the boot screen)

**Component: `MatterRail`** (left column, 240px). Lists open matters by *display name*, each row carrying a single chip indicating worst-case state: `INTAKE` (no facts yet), `GAPS·N` (count of fatal gaps), `CONFLICTS·N` (count of sev-4-or-5), or `READY` (all proof slots filled, no open sev-4+, draft approved). Chip color is purely typographic: `INTAKE` is `--graphite`, `GAPS` and `CONFLICTS` are `--ink` solid background with `--paper` text, `READY` is a hollow `--ink` outline.

**Component: `FatalGapsBoot`** (replaces the empty/loading splash). When a matter has any of {no formation doc, no passport bio, no I-129 yet drafted} the masthead area renders a **bone-dry checklist**:

```
  fatal gaps before this matter can be filed
  ───────────────────────────────────────────
  ·   Articles of Organization (Tab D)         not on record
  ·   Beneficiary passport bio page (Tab C)    not on record
  ·   I-129 draft                              not yet generated

  the rest of the dossier is hidden until these clear.
```

The masthead and the proof-slots section render. Everything else (drafts, generators, NoIDs) is *gated* — visible but with a 1px diagonal hatching overlay reading `gated · resolve fatal gaps first`. This is the structural prevention the brief asked for.

**Component: `MatterMasthead`** (replaces `CaseOverviewCard`). Six pinned fields in a 6-column grid (was 4 — too wide), ordered by *what an attorney needs in the first 3 seconds*:

```
investor          enterprise         passport         EIN · formed       I-94 admit-until    proportionality
[NAME]            [LEGAL NAME]       ••••XXXX         ••••YYYY           2027-04-12          112.3%
nationality       industry           exp. date        formation date     in 348 days · ok    meets §V
```

The `I-94 admit-until` chip turns its left rail to 3px `--ink` when ≤30 days; the value italicizes and reads `in 12 days · attention` in `--ink`. The `proportionality` chip's tail switches from "meets substantiality" to "review §V" with a clickable `§§V` anchor when <100%.

### stage 4 · the SOF chain (the redesign's centerpiece)

**Component: `SofChainSpine`** (replaces `SofChainTable` *as the primary view*; the table version remains as a secondary "table mode" toggle for power editing).

The spine is a single readable diagram. Vertical, anchored to a left rule. Each leg is a node. Each node carries: leg number `01` / `02` / `03`, origin category, USD amount in `font-mono` right-aligned, evidence document (clickable), final destination (last-4 masked), and a ledger of conflicts inline if any. Legs connect with a 1px `--rule-strong` vertical line. Discrepancies between legs (e.g., $425k → $410k) render the second amount in `--ink` bold with a tooltip "Δ $15,000 vs. leg 01" and an inline `§§V` link to the conflict register.

```
  origin                    USD              evidence                     destination

  01  ─────  property sale   $425,000        tapu_deed_bebek.pdf p.3      garanti TRY ••••8819
       │                                     APS-4 ✓ confirmed
       │
  02  ─────  FX conversion   $419,800        garanti_FX.pdf p.2           garanti USD ••••8902
       │                     Δ $5,200        APS-4 ✓ confirmed            (FX spread)
       │
  03  ─────  wire to US LLC  $410,000        wire_8819_8902_9015.pdf      wells fargo ••••9015
       │                     Δ $9,800        APS-3 attorney-confirmed     business operating
       │                     §§V conflict-3                                    
       │
  Σ chain                    $410,000        deployed
```

The spine is the answer to "how does the SOF chain become a single readable diagram." It collapses *table-mode mental load* into *exhibit-binder mental load*. The table version stays a keyboard toggle (`T`) for the attorney who wants to bulk-edit.

### stage 5 · conflicts (anchored, never quarantined)

**Component: `ConflictPin`**. Conflicts no longer live only in §V. Each conflict renders **twice**: once in the inspector's `[conflicts]` mode list (sorted by severity, no count badges that average sev-2 and sev-5 together), and once *inline at its anchor row*. The inline version is a 1-line strip pinned to the right edge of the relevant fact row:

```
  Investment committed     $425,000  ◢ sev-4 · cover letter says $425k, escrow ledger p.7 says $410k    §§V→
```

Hover the strip → it expands to show fact A and fact B side-by-side. Click the `§§V→` → inspector switches to `[conflicts]` mode and the conflict scrolls into view with a 320ms `inkwell` underline. Sev-1–2 conflicts do *not* render inline (they would be noise); they live only in `[conflicts]` mode.

**Severity hierarchy is structural, not chromatic.** Sev-5 is a 3px solid `--ink` left rail + chip text inverts. Sev-4 is 3px `--rule-strong` rail. Sev-3 is 2px `--rule` rail + smaller type. Sev-1–2 are inline-only in the list, no rail. The ConflictRegister bug in the current build (sev-5 reading the same as sev-2 because both are pills with similar weight) is solved by: rail thickness, rail color, and chip-fill inversion. Three independent visual variables.

### stage 6 · proof slots (the scoreboard)

**Component: `ProofSlotsBoard`**. The current `SlotRow` already encodes status correctly; the redesign keeps the row markup and adds a **boot-screen scoreboard** at the section header:

```
   IV.  proof slots                  treaty 4/4   investment 7/8   real-and-operating 5/6   marginality 3/4   develop-and-direct 5/5

         24 of 27 filled at APS-4+         3 weak slots — see below
```

Each "X/Y" is a clickable filter that scopes the section below to just that element's slots. Weak slots (filled at APS-3 or below) get a 2px `--rule-strong` rail. Empty required slots get a 3px `--ink` rail and an inline `+ add evidence` chip that opens the inspector to `[exhibits]` filtered by the slot's `requires_one_of`.

### stage 7 · drafts (gated, with audit trail)

**Component: `GenerateGate`**. The redesigned generator panel **cannot be entered** while there is any (a) fatal gap, or (b) unresolved sev-4-or-5 conflict, or (c) proof slot below APS-3 in a required element. Each generator card shows its own gate state:

```
  Cover letter
  Sonnet 4.6 · ~16K · ~$0.30
  ─────────────────────────────────
  ◢ blocked: 3 fatal gaps · 1 sev-5 conflict
  resolve before generating →
```

Click "resolve before generating" → inspector opens to `[conflicts]` mode scrolled to the blocking item. The gate is structural (the button is `disabled`) — it is impossible to ship a draft with placeholder facts. The user can override only via a deliberate "generate anyway" path that requires typing the matter's display name; the override is logged as an `attorney_override` audit event.

### stage 8 · re-classification (without spelunking)

**Component: `ReclassifyChip`**. Every document thumbnail in the binder/exhibits view carries a `font-mono text-label` chip on the bottom-right reading the bot's classification: `bank-statement-personal · 0.74`. Click → a 240px popover drops with the seven most likely alternatives, each a one-click reassign. The chosen alt becomes attorney-confirmed (`✓`). The bot's confidence is *visible at the moment of classification* — no audit-tab spelunking.

### stage 9 · paralegal handoff (the timeline)

**Component: `AuditRibbon`**. A 32px-tall horizontal strip pinned at the bottom of the inspector showing the last six audit events for this matter:

```
  02:41 attorney-confirmed §§III.investment.committed_usd · 425000     by serra
  02:38 attorney-overridden §§V.conflict-3 → resolved-as-fx-spread     by serra
  02:35 reclassified bank_stmt_2024-09.pdf → brokerage-statement       by serra
  02:11 bot-classified 17 documents (typed memory built)                by gpt-5.1
  01:58 ingest started                                                  by atelier
  ...                                                                                  full log →
```

A paralegal opening the matter sees the last attorney decisions inline, in chronological order, without leaving the dossier. "Full log" expands the ribbon to a full-height pane.

### stage 10 · RFE/NOID readiness (no separate mode)

Audit attribution is always-on. Every fact cell, conflict, proof-slot resolution carries a `title=` tooltip with `bot · gpt-5.1 · 2026-04-19 02:11` or `attorney-confirmed · serra · 2026-04-22 14:33`. The current build has this on cells but not on slots/conflicts. The redesign extends it everywhere. RFE preparation is then `Cmd-P → "Print audit trail (PDF)"` from the masthead overflow menu.

## state machine

| state | trigger | masthead | sheet | inspector |
|---|---|---|---|---|
| **empty** | no matter open | "drag a matter folder" | dim | hidden |
| **ingesting** | folder dropped, `<60s` typical | progress ribbon (mono pulse) | skeleton sections I–VI | "ingest log" mode, scrollable |
| **partial** | ingest done, fatal gaps present | `gaps·3` chip in `--ink` solid | only I–II + IV-scoreboard render; III/V/VI hatched | `[fatal gaps]` mode (replaces drafts tab while gated) |
| **drafting** | gaps clear | full masthead | all sections expanded by default | `[SOF]` opens by default |
| **conflict-pending** | sev-4+ conflict opened | masthead unchanged | `§§V` ambient pulse (12s idle) | `[conflicts]` highlighted with conflict count chip |
| **review-ready** | all proofs APS-4+, no open conflicts | `READY` chip (hollow `--ink`) | `§§VI drafts` becomes ungated | `[drafts]` becomes default mode |
| **filed** | filing date logged | small `filed·YYYY-MM-DD` ribbon at bottom of masthead | sections become read-only (`--graphite` cast) | `[audit]` is default mode |

## surface rules

- **Hairline vs. card.** Within a section: hairline `--rule` between rows. Between sections: nothing — empty 64px gap. Cards (full `--rule-strong` border) are reserved for things you can edit (SOF leg, conflict, fact cell). Reading-only data is hairlines.
- **Recess rule.** `paper-recess` (`--paper-2`) is reserved for the masthead, the inspector ground, and section-accordion summary rows. Never on a fact cell.
- **Density rule.** Inside the sheet, *information density never decreases*. Whitespace lives between sections, not inside them. The §III SOF spine is allowed to be 14 rows tall on a long case; we do not paginate, we scroll.
- **One H1 per matter.** The masthead serif is the only H1. Section numerals are H2 in size but render in italic Fraunces lowercase numerals (`i`, `ii`, `iii`) at `--text-section`. No competing displays.

## voice & microcopy

Lawyerly with a dry edge. Lowercase where the existing system already lowercases. No emoji. No exclamation marks. No AI-flavored "let's" / "shall we." Examples:

- (current) `No conflicts on register. Re-run the reviewer after every fact edit to refresh.`
- (replace) `register clean. re-run after fact edits.`

- (current) `nothing filed under this tab yet.`
- (keep — already correct.)

- (gate copy) `blocked: 3 fatal gaps · 1 sev-5 conflict.` then on its own line: `resolve before generating →`. Not "Please resolve all blocking issues before proceeding."

- (audit ribbon) `serra · 02:41 · confirmed §§III.investment.committed_usd $425,000` — never "Serra confirmed the investment committed amount as $425,000 at 2:41 AM."

- (empty SOF) `no source-of-funds chain on record. add the first leg → §§III.add` — the action is the link, not a separate button.

- (admit-until ≤30d) `in 12 days · attention.` Not "Warning: I-94 expiration imminent."

## game-tier polish (five details, each tied to an element)

1. **The §§ anchor.** Every section header carries an `§§<id>` mono code. The attorney can press `§ §` (two keypresses, no command-key) to open a `cmd+k`-style anchor jumper. Type `e`, see "§§III investment", press enter. A 240ms underline pulse on arrival. This is the Bloomberg Terminal idea, executed once.

2. **The Δ telltale.** Anywhere the SOF chain shows two amounts that disagree by more than $1, the second amount renders the `Δ` glyph + signed dollar amount in mono, *outside* the column rule, in `--ink` bold. Hover → the conflict pin slides in from the right.

3. **The audit-trail border.** Every editable cell is bordered on its 4px-wide left edge with a color encoding bot-vs-attorney provenance. This is the audit trail without ceremony — there is no "audit tab" because the audit is the border. Inspect any cell for two seconds and you know who decided it.

4. **The fatal-gap diagonal hatching.** When a section is gated, it doesn't disappear — it renders with a 1px diagonal hatch overlay (CSS gradient at 45deg, 8px stride, `--rule` over `--paper`) and a single line of mono text reading `gated · resolve fatal gaps first`. The attorney sees what's coming next, but cannot click into it. Game-tier because the empty state is more loved than the full state.

5. **The masthead pulse, exactly once.** When a matter first finishes ingesting and the masthead populates, every value field underlines its value left-to-right in `120ms` staggered by `40ms` per field. Six fields, total 360ms, mechanical and confident. The attorney sees the case "deal itself" onto the desk. Never repeats; reload doesn't re-pulse.

## anti-patterns (what NOT to ship)

- **No tab proliferation.** Eight tabs is what we're escaping. The redesign caps the inspector at five modes: SOF / conflicts / proof slots / drafts / audit. Binder + Context + Log fold under audit.
- **No icon-only severity.** The current `◢` glyph is fine as an *additional* tell, but the source of truth for severity is the rail color and width, not the glyph. A glyph-only severity register is colorblind-hostile and reads wrong on retina at distance.
- **No avg'd severity counts.** The current "severity 5·1 4·2 3·0 2·1 1·0" pill row reads sev-5 and sev-1 with similar weight. Replace with: sev-5 fills its chip with `--ink`, sev-4 is solid-bordered, sev-3 is dashed-bordered, sev-2-1 are demoted to a single `+3 minor` collapsed chip.
- **No skeumorphic pseudo-letterhead.** The current build has a tasteful paper grain — keep. Do not add wax seals, signature scrawls, foxing edges, or "vintage briefcase" textures. The aesthetic restraint is doing real legal work, not LARPing law.
- **No sage / sky / cream.** Those tokens belong to the broader design grammar but are not used here. This is ink-on-paper. The accent is contrast.
- **No "AI is thinking…" anthropomorphism.** Loading copy is `ingesting · 17/89 documents` or `bot · classifying`. The bot is a tool; it does not have feelings.
- **No modal generators that block the dossier.** The current pre-generation modal is fine in concept, bad in geometry — it occludes the sheet the attorney is approving against. Replace with: the modal docks into the inspector pane (`[drafts]` mode goes full-width inside the inspector), so the sheet stays visible while the attorney reviews the preview.
- **No toast-only confirmations for fact edits.** Every saved edit produces a 240ms ledger pulse on the cell's left rail (state goes `editing → saving → saved → idle`) plus an immediate audit-ribbon entry. No floating toast that disappears in 3s and gives the attorney no record.
- **No drag-to-reorder on SOF legs.** Legs are chronological and order-meaningful (origin → final destination). Reordering is editing the data, not a UI gesture. Add/remove via explicit `+ add leg` / `× remove`.

## tech & constraints

- **Framework.** Existing Next.js (custom build per `AGENTS.md`) + React 18 + Tailwind. Existing `--font-display` (Fraunces via `next/font`), existing `--font-mono` (system), existing token system in `globals.css`.
- **Electron, desktop only.** 13" MBP (1440×900) to 27" iMac (5120×2880). No mobile breakpoints. Dense by design.
- **Existing component tree.** `CaseOverviewCard` becomes `MatterMasthead`. `ConflictRegister` becomes `ConflictsInspector` + `ConflictPin`. `SofChainTable` stays as table-mode; `SofChainSpine` is the new default view. `DocumentInventory` stays largely as-is but gains the `ReclassifyChip`. `GeneratePanel` becomes `GenerateGate` with structural blocking.
- **State.** Anchor jumps via URL hash (`#§§III.investment`); inspector mode via query param (`?inspect=conflicts`); both restorable on Electron reload.
- **Accessibility.** All anchors keyboard-focusable. Inspector tabs follow ARIA tabs pattern. Reduced-motion clamps all animation to 0ms. Color-contrast AA at minimum on every text-on-fill combination. Severity is encoded in *three independent variables* (rail thickness, rail color, chip fill) so colorblind-safe.
- **Performance.** Sheet should render to first usable frame in <80ms after `IngestSuccess` is in memory. Inspector mode switch should be <16ms (no remount, just visibility). The 12s ambient conflict pulse must never run when document is hidden (`document.visibilityState`).

## success criteria (workflow questions, scored 5/5 target)

1. **Time-to-first-decision for "what's missing."** Attorney opens a matter → fatal gaps render in masthead within 2s of paint → boot screen lists them → attorney has the answer in <10s without clicking.
2. **Impossible to ship a draft with placeholder facts.** `GenerateGate` is structural; the cover-letter button is `disabled` until proofs are APS-4 in required slots and no sev-4+ conflicts open. Override requires typing the matter name + leaves an audit event.
3. **SOF gaps surface before the attorney looks.** §III SOF spine at full width by default. Δ telltales render automatically. Missing legs render as a dashed-rule placeholder row reading `+ add leg ← origin: ?`.
4. **Paralegal can pick up mid-flight.** Audit ribbon at bottom of inspector shows last six attorney decisions. Cell tooltips carry `actor · timestamp · why`. The matter rail's chip indicates exactly where the case is in the pipeline.
5. **Bot confidence visible at classification.** Every doc thumbnail carries `<doc-type> · 0.74` chip. Every fact cell's left-rail color encodes bot-vs-attorney + confidence. No tab to click through.

Beyond those: rubric ≥ 45/50 on the standard 10 dimensions. Reviewed below.
