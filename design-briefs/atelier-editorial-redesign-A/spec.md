# Atelier — Designer A Spec
## Editorial / cinematic redesign for an attorney-grade AI paralegal

> Strict monochrome stays the spine. One inked accent (`--seal`) earns its place by appearing **only** where an attorney signature, a sev-5 conflict, or a single masthead alarm is on screen. Courier remains the technical voice; Fraunces remains the body of work; serenity comes from spacing, not from chroma. The product is not "premium SaaS." It is a desk lamp, a stack of folders, a fountain pen, and a clock.

---

## 1. The aesthetic thesis (one line, physical)

> Atelier is a **butcher-paper sheet pinned under a brass dinkus on a partner's reading desk** — the desk has a single inked stamp, a fountain pen, and a clock that never stops ticking.

If it would not exist on that desk, it does not exist on the screen.

---

## 2. Palette (named, with role and ground-truth comment)

The repo currently runs **strict mono** (`globals.css` lines 6–28: every legacy chroma token folded back to `#404040`). I am **not** undoing that doctrine. I am promoting one inked accent (`--seal`) and two warm/cold hairlines to deliberate semantic duty. Nothing tinted, nothing filled.

```
/* Paper — five steps so the eye can land. */
--paper-cream:   #FAFAFA;   /* default surface (existing --color-paper)   */
--paper-vellum:  #F4F2EC;   /* dossier shell — barely warmer than cream   */
--paper-recess:  #F0F0F0;   /* recessed wells, modal backdrop tint        */
--paper-grain-3: #E8E6E0;   /* page edge, scrollback, divider weight      */
--paper-deep:    #D4D4D4;   /* card edge under hover lift                 */

/* Ink — three jet steps + two graphite. */
--ink-jet:       #0A0A0A;   /* body, headlines, signature stamp           */
--ink-2:         #1F1F1F;   /* secondary body, button hover               */
--ink-mute:      #2E2E2E;   /* labels under uppercase smcp ceremony       */
--graphite:      #404040;   /* meta, secondary inline                     */
--graphite-soft: #595959;   /* tertiary, hint text, footnote              */

/* Inked seal — the ONE chromatic accent. Restraint or it becomes a logo. */
--seal:          #5B1A12;   /* oxblood — used for: attorney-initials box
                               focus border, sev-5 conflict glyph, wax-stamp
                               on signed artifacts, masthead alarm chip.
                               Never on links. Never on buttons. Never as
                               a tint behind text. ~6 occurrences/page max. */

/* Brass — warm hairline ONLY. Marks "computed, not typed". */
--brass-hair:    rgba(165, 135, 90, 0.55);

/* Sky — cold hairline ONLY. Underlines exhibit refs in body text. */
--sky-rule:      rgba(120, 145, 170, 0.55);

/* Hairlines */
--rule:          rgba(10, 10, 10, 0.10);
--rule-strong:   rgba(10, 10, 10, 0.32);
--rule-edge:     rgba(10, 10, 10, 0.55);   /* page-edge, masthead bottom  */
```

**Forbidden additions:** no green, no blue swatches, no severity color ramp (severity stays weight + glyph + position; sev-5 alone earns `--seal`), no gradient surfaces beyond the two hairline gradients above, no shadow exceeding `0 6px 12px -8px rgba(10,10,10,0.18)`.

---

## 3. Typography (axis-locked, four roles only)

Type stack is already correct. Keep it. What's missing is **rhythm tokens** and a stricter rule about when the serif appears.

```
/* Stack (already in globals.css, repeated for completeness) */
--font-display: var(--font-fraunces), "Iowan Old Style", "Hoefler Text",
                "Apple Garamond", Georgia, serif;
--font-body:    -apple-system, "Helvetica Neue", "Inter", system-ui, sans-serif;
--font-mono:    "Courier New", ui-monospace, "SF Mono", Menlo, monospace;
                /* Courier New is canonical and protected. */

/* Fraunces axis lock — opsz tuned per size. SOFT 0 always (sharp terminals,
   attorney-grade). WONK 0 always (no quirky alts in a legal product). */
--fraunces-stunt:   "opsz" 144, "SOFT" 0, "WONK" 0;
--fraunces-hero:    "opsz"  96, "SOFT" 0, "WONK" 0;
--fraunces-section: "opsz"  36, "SOFT" 0, "WONK" 0;
--fraunces-title:   "opsz"  20, "SOFT" 0, "WONK" 0;

/* Scale — inherit from globals.css; add ONE missing rung */
--text-stunt:   6rem      /* 96px   — masthead empty state              */
--text-hero:    4rem      /* 64px   — matter masthead inside dossier    */
--text-display: 2.4rem    /* 38.4px — pane heroes, sparingly            */
--text-section: 1.5rem    /* 24px   — pane section headers              */
--text-subhead: 1.2rem    /* 19.2px — NEW: blocks within a section      */
--text-title:   1.05rem   /* 16.8px — card titles, modal heading        */
--text-lede:    1rem      /* 16px   — pane intro paragraphs             */
--text-body:    0.9375rem /* 15px   — DEFAULT reading                    */
--text-meta:    0.8125rem /* 13px   — secondary inline                   */
--text-label:   0.72rem   /* 11.5px — uppercase smcp                     */
--text-foot:    0.66rem   /* 10.5px — cite/foot, tracked 0.18em          */

/* Vertical rhythm */
--rhythm-1:  4px;  --rhythm-2:  8px;  --rhythm-3: 12px;
--rhythm-4: 16px;  --rhythm-5: 24px;  --rhythm-6: 36px;
--rhythm-7: 48px;  --rhythm-8: 72px;
```

**The four roles, full stop:**

1. **Stunt / Hero / Display** — Fraunces. Italic only on the wordmark period (`atelier.`) and on the rare em-dashed editor's pull-quote.
2. **Section / Title / Subhead** — Fraunces at `opsz 36–20`, weight 600, tracking `-0.012em`.
3. **Body / Lede / Meta** — system sans, weight 500, line-height 1.55 default, 1.65 on lede.
4. **Mono** — Courier New, never italic, never bold under 13px. Two ceremonies:
   - **`smcp`** (uppercase, tracking 0.10em, weight 600): section labels — `DECISION`, `RISK REGISTER`, `AUTHORITIES CITED`.
   - **`label-quiet`** (sentence case, tracking 0.04em, weight 500): inline meta — `passport.pdf · p.2`.

**Hard rule:** Fraunces never appears in tabular data, never inside a button, never as a body paragraph. Courier never appears at >13px except in the masthead `⌘K` chip and the alarm chip.

---

## 4. Spacing & layout grid

The shell stays. It's already correct: `grid-rows-[3.25rem_1fr_1.75rem]` (masthead, dossier, status bar) over `grid-cols-[16rem_1fr_19rem]` (Binder, Dossier, Marginalia).

**What changes:**

- Dossier reading column max-width **68ch (≈ 740px)**. Anything wider is supplementary (tables, audit, exhibits accordion).
- Section breathing room **`--rhythm-7` (48px)** between pane sections. The current build uses `gap-6` (24px) in too many places — half a beat short for editorial rhythm.
- Modal padding **36px × 28px** (current `px-9 py-6` is close — keep). Modal max-width climbs from `max-w-3xl` (768px) to **820px** so the 87-row facts table breathes.
- Marginalia (right rail, 19rem / 304px) gets a **24px outer gutter** (currently flush) and a `--paper-vellum` ground so it visibly recedes from the dossier.
- Binder (left rail, 16rem / 256px) keeps its grain. Add a **2px vertical hairline of `--rule-edge`** at the inside edge — the binder reads as a clipped edge of paper, not an adjacent column.

---

## 5. Motion — four named curves, each owning a job

The repo already has half of these. I am naming them, capping them, and assigning each one purpose.

```
/* Editorial cascade — pane lands one row at a time. */
--ease-cascade:  cubic-bezier(0.22, 0.86, 0.32, 1);  /*  420ms          */

/* Page lift — paper rises a hair off the sheet. Hover only. */
--ease-lift:     cubic-bezier(0.20, 0.80, 0.20, 1);  /*  220ms          */

/* Tab glide — underline tracks across pane switches. */
--ease-glide:    cubic-bezier(0.45, 0.05, 0.20, 1);  /*  380ms          */

/* Brass reveal — left-to-right hairline for a computed value. */
--ease-reveal:   cubic-bezier(0.22, 0.86, 0.32, 1);  /* 1200ms, 200ms in */
```

**What does NOT exist:** spring physics, parallax, scroll-jank, hero gradients, page transitions, anything beyond 600ms except `brass-reveal` (1200ms is the only ceremony beat in the app — the moment a computed figure earns its hairline).

**Reduced-motion contract:** `@media (prefers-reduced-motion: reduce)` → all animations 0ms; cascade collapses to opacity-only; brass-reveal jumps to final state; sweep-bar becomes a static dotted hairline.

---

## 6. Component inventory (existing → diagnosis → redesign)

### 6.1 Masthead (`Header`, page.tsx:1750)
- **Now:** `atelier.` wordmark + `⌘K search the binder` chip (button-shaped well) + clock + meta.
- **Fix:** keep wordmark. Replace the ⌘K well — currently a button shape that fights the masthead — with a **single Courier line**, no border, no fill: `⌘K  search the binder` in `--graphite`, hover lifts to `--ink-jet`. Clock gets `--text-meta` `tabular-nums`, never blinks.
- **Add:** at the right edge of the masthead, a `--brass-hair` 1px diagonal score, 24px long, angled 12°. The "stamp registration" mark. No tooltip, no purpose. It is the point.

### 6.2 Binder (left rail, `Binder` page.tsx:1789)
- **Now:** `my matters` smcp + `active / archived / other` sections + drop-zone CTA.
- **Diagnosis:** the `text-title` group label and `smcp text-graphite-soft` directly above each row create two competing ceremonies.
- **Fix:** demote section markers to a **single Courier line** (`active · 4`); kill redundant subtitles. Each matter row gets a left **2px hairline gutter** in `--rule` that becomes `--ink-jet` when selected. That is the only selection chrome — no fill, no background change.
- **Add:** hovered row reveals a Courier `→` glyph at the right edge over 220ms. The active row's idle glyph is `‖` — a quiet "you are here."

### 6.3 Dossier shell (`Dossier` page.tsx:2197)
- **Now:** seven-to-eight tabs (facts / exhibits / draft / review / audit / binder / context / log).
- **Diagnosis:** seven equally-loud tabs reads like a SaaS app.
- **Fix:** group by ceremony. **PRIMARY** (facts · exhibits · draft · review) renders in serif at `--text-subhead`. **AUXILIARY** (audit · binder · context · log) renders in `smcp` Courier, separated by a 24px gap and a 1px vertical `--rule`. The tab underline glide stays. Active tab's underline thickens to 1.5px; never a fill.

### 6.4 FactsPane — **the biggest single fix**
- **Now:** Investor, Enterprise, Investment, Source-of-Funds, Operations, Spend, Generated-artifacts. All seven render at the same heading size, same density. Eye gets lost.
- **Fix:** three-tier rhythm.

  **Tier 1 — Vital signs.** Investor + Enterprise + I-94 deadline countdown. Renders as a **3-column horizontal slab** at the pane top, 96px tall, cream paper, `--rhythm-7` top padding, 1.5px `--ink-jet` bottom border. The I-94 countdown is the rightmost column; the day count uses `--text-display` (38.4px Fraunces) — `12 days` — with `submit by 14 May 2026` in body sans below. This is the ONLY place the day count gets typographic ceremony.

  **Tier 2 — Substance.** Investment + Source-of-Funds. Two-column reading layout, 48px gap. Each block opens with `--text-subhead` (19.2px Fraunces, weight 600). Provenance affordance: every Field<T> value wraps in a `<span>` whose hover (220ms `--ease-lift`) reveals a tiny `--brass-hair` underscore plus a Courier popover `passport.pdf · p.2 · high`. No icons. The hairline IS the icon.

  **Tier 3 — Ledger.** Operations + Spend, compact tabular, mono dominant, `--text-meta` body. Generated-artifacts moves OUT of FactsPane into a Marginalia card — see §6.10.

  Empty fields render as `[ — ]` in `--graphite-soft` mono italic. Hover reveals an `intake →` link in `--graphite`; click scrolls to the Intake block with the row temporarily highlighted via `cascade-in`.

### 6.5 Exhibits accordion (`MemoryPane` + `DocumentInventory` 12-tab convention)
- **Now:** A–L lettered tabs, accordion details/summary, mock thumbnails inside.
- **Diagnosis:** the line-diagram thumbnail (fake-page hairlines pretending to be text) is theatrical. In a tool used by a 12-year practitioner, fake content reads as toy.
- **Fix:** kill the line-diagram. Each thumbnail becomes a **single hairline-bordered vellum rectangle**, `aspect-[3/4]`, with the `display_name` in `--text-meta` Fraunces inside (top-left, 12px padding) and the page count in `--text-foot` Courier (bottom-right). Hover: `--ease-lift` 1px translateY, hairline deepens from `--rule` to `--rule-strong`. Click → DocumentPreview overlay.
- **Tab letter (A, B, …)** gets the only display ceremony in this pane: 36px Fraunces, weight 400, `--ink-jet`, in a left-margin column 56px wide. The letter is a drop-cap. Fix it in place; do not redraw it on accordion open.

### 6.6 PreGenerationApproval modal (`pre-generation-approval.tsx`)
- **Now:** five sections (decision · risk register · structural outline · defensive paragraphs · authorities cited · implications) all using the same `ApprovalSection` chrome. Reads as homogeneous list; critical and non-critical info compete.
- **Fix:** two-zone modal.
  - **Zone 1 — "Decision" + "Implications"** at the top, on `--paper-cream`, with `--text-subhead` Fraunces section labels (not smcp Courier). The editor's lede.
  - **Zone 2 — "Risk register" + "Outline" + "Defensive" + "Authorities"** below a 1px `--rule` hairline, on `--paper-recess`, with the existing `smcp` Courier section labels. The technical apparatus.
  - Footer becomes a single horizontal line: `attorney initials [____]   reject   approve & generate`. Initials input gets a `--seal` 1px focus border (the only `--seal` in this modal). Approve is `--ink-jet` fill, paper text. Reject is hairline only.
  - Cost line `≈ $0.420` renders in **Fraunces** at `--text-subhead` — currency reads as deliberation, not a SaaS metric. Token count next to it stays Courier `--text-meta`.

### 6.7 GeneratePanel (`generate-panel.tsx`) — **second biggest fix**
- **Now:** four `Group` cards × three-column grids of generator buttons. Each button: title + description + "approve & generate →" footer. Reads like Vercel dashboard.
- **Diagnosis:** the SaaS shape (titled card + multi-column tile + hover-border) is the loudest tonal slip in the app. Next to the dossier pane this panel feels like a different product.
- **Fix:** four sections become **four printed registers** stacked vertically — no card chrome, no border, just an `smcp` section label, a `--rule` hairline, and a list of generator rows.
  - Each row: `--text-subhead` Fraunces label on the left, `--text-meta` description in graphite, `--text-foot` Courier model+token estimate on the right (`Sonnet 4.6 · ~16K · ≈$0.30`). On hover the row's bottom-edge hairline thickens to 1.5px `--ink-jet`. Right-edge gets the Courier `→`. No transform, no fill.
  - Group titles use Fraunces `--text-section` (24px, weight 600), with the count in superscript Courier (`Cover letter & exhibit index ³`).
  - "Recent outputs" article keeps its existing structure but moves to **Marginalia** (right rail) — see §6.10.

### 6.8 ConflictRegister / Reviewer (`ReviewPane`, `conflict-register.tsx`)
- **Now:** sev-1..5 with glyph (·, ·, ‡, ‡, ‡) + weight ramp. Already monochrome-correct.
- **Fix:** keep the glyph/weight system. **Sev-5 alone earns `--seal`** for the glyph and a 2px left hairline gutter on the row. Add a **submit-disabled affordance** at the masthead: while any sev≥4 is unresolved, the `⌘K search the binder` line is replaced by a Courier line `4 critical · resolve before submission` in `--seal`, no fill. The only chromatic alarm in the entire app is one line of mono.

### 6.9 Marginalia (right rail, 19rem) — **the unclaimed real estate**
- **Now:** under-used. Sometimes empty, sometimes a stage label. Mostly dead.
- **Fix:** three editorial cards on `--paper-vellum`.
  - **Top card — Clock & countdown.** I-94 day count repeats here at small size, with the deadline date and a Courier `last admission 03 Mar 2026`. Intentional redundancy with FactsPane Tier 1: the clock should be visible regardless of pane.
  - **Middle card — Recent outputs ledger.** Migrated from GeneratePanel. Last 3 approved artifacts: title in Fraunces `--text-meta` italic, timestamp + cost in Courier, hairline divider between rows. Click → artifact viewer.
  - **Bottom card — Editor's note.** A single quiet line of state-aware copy:
    - 0 PDFs ingested: *"the desk is clear."*
    - ingest in progress: *"reading the bundle."*
    - draft ready, review pending: *"the draft is on the desk; the auditor is sharpening her pencil."*
    - sev-5 unresolved: *"four flags. address them before signing."*
  - Editor's note: Fraunces italic `--text-meta`, max two lines, no exclamation marks, no emojis.

### 6.10 Pipeline progress (`BinderLoadingRow` page.tsx:2087, `loading-progress.tsx`)
- **Now:** stage label + `sweep-bar` + per-PDF count.
- **Fix:** keep `sweep-bar` (it's good). Add a **per-PDF mini ledger** below the bar: `max-h-[12rem]` overflow-scroll list, one Courier line per PDF — `passport.pdf · ✓ identity · 2.1s`. Newest entry slides in via `cascade-in` from the bottom. Failed lines render with a `‡` glyph in `--seal`, no fill.
- The "Praying to immigration gods" microcopy stays. It is the soul of the product. (Voice §8.)

### 6.11 Cover letter viewer (clickable refs, `DraftPane`)
- **Now:** `[Tab E.4]` references render as plain blue links.
- **Fix:**
  - Replace blue with a Courier inline span in `--ink-2`, with a 1px `--sky-rule` hairline underline. Hover thickens to 1.5px `--ink-jet`; a `--paper-vellum` popover fades in 8px above showing the exhibit's `display_name` and a 160 × 220 first-page thumbnail (vellum, hairline border). Popover entrance: 180ms opacity + 4px translateY, `--ease-cascade`.
  - `[CITE NEEDED]` and `[MISSING:phone]` get a `--seal` underline and a Courier suffix `· fix in intake`. Click → intake.
  - Streaming cursor: a single `▍` Courier block in `--ink-jet`, blinking 1.4s linear infinite, opacity 0–1, only present at the trailing edge.

---

## 7. State machine (per dossier pane, declared centrally)

| State | Surface | Heading | Body | Motion |
|---|---|---|---|---|
| **Empty** (no matter selected) | `paper-grain` | `Drop a dossier.` 96px Fraunces | existing 4-quadrant case-type ledger | cascade-in 420ms, 60ms stagger |
| **Loading — first matter** | `paper-grain` | `The clerk is reading the file.` 24px Fraunces | 4-step ordered list, `sweep-bar` under active step | sweep-bar perpetual, list rows fade-up at 80ms stagger |
| **Loading — switching matter** | active pane stays, dimmed to 0.55 opacity, `paper-recess` overlay | (none) | bottom-left `reloadingDocs` chip | 220ms opacity dip |
| **Ready** (caseFacts present) | `paper-grain` | matter masthead (Fraunces 64px) | 3-tier FactsPane (§6.4) | cascade-in 420ms, 60ms stagger across blocks |
| **Error** (extraction failed) | `paper-recess` card on `paper-grain` | filename + error code in Courier | message in body sans | fade-up 280ms |
| **Streaming draft** | DraftPane on cream | streaming text + trailing `▍` | refs render with `--sky-rule` underline live | none on text; cursor blink only |
| **Sev≥4 unresolved** | masthead chip swap (§6.8) | `4 critical · resolve before submission` Courier `--seal` | (in pane) sev-5 rows get 2px `--seal` left gutter | cursor blink 1.4s linear on the alarm bullet |
| **Submitted (signed wax-stamp)** | success overlay 220ms | `Sealed.` 96px Fraunces, italic period | timestamp + initials + matter + cost in Courier | one-shot 1200ms `brass-reveal` under the headline |

---

## 8. Voice & microcopy (the dry attorney + editorial dignity)

The existing voice is already correct. Codifying:

- **Lowercase Courier ceremonies** (`smcp`): never punctuated, never an article. Examples kept: `decision`, `risk register`, `authorities cited`, `dashboard`, `working`, `binder rollup`. Add: `signed`, `pending counsel`, `awaiting auditor`.
- **Sentence case body**: complete sentences with periods. Articles welcome. Em-dash earned. **No exclamation marks anywhere.**
- **Editorial wit, sparingly.** Keep `praying to immigration gods · auditing draft against the unified facts`. Add 4–6 across the app, each tied to a long-running stage:
  - extracting: *"reading every page like the partner who has to defend it."*
  - drafting: *"composing in the firm's voice."*
  - reviewing: *"the auditor is comparing the draft line by line. she is unimpressed by default."*
  - sealed: *"signed, sealed. nothing left to do but submit."*
- **Forbidden phrases**: AI-powered, smart, intelligent, automatically, in real-time, seamless, leverage, optimize, streamline. Also forbidden: "we", "our", "your" — Atelier addresses the attorney as a colleague, not a customer.

---

## 9. Polish density — the seven game-tier touches

Five required by doctrine; we ship seven because this is a desk tool the attorney looks at all day.

1. **Ambient brass score** in the masthead's right edge (§6.1) — drifts 0.3px every 6s on `grainDrift`, parsed as "the page is breathing, not frozen."
2. **`brass-reveal` under any computed value** — when the cover letter renders the auto-derived `total_committed_usd`, a 1.2s left-to-right brass hairline draws under the figure. Not on user-entered values.
3. **Diagonal grain drift on the dossier shell** — already exists (`grainDrift` 18s linear infinite). Keep. Extend to FactsPane Tier 1.
4. **Tab underline glide** — already exists (`tab-glide-track`). Keep; apply to the new primary/auxiliary split (§6.3).
5. **Cascade-in on pane lands** — already exists. Apply with 60ms stagger to FactsPane blocks and ConflictRegister rows.
6. **Editor's note in Marginalia** — state-aware copy in Fraunces italic (§6.9).
7. **Wax-stamp on signed artifacts** — when the attorney approves & signs, a 36 × 36 oxblood (`--seal`) round in the upper-right of the artifact card, initials inside in 11px Courier, weight 700, paper-color. Renders once with 280ms scale-from-0.7 + opacity, then static. No hover, no animation after the first frame.

---

## 10. Anti-patterns (what NEVER ships)

- ❌ Blue links anywhere (replaced by sky-rule hairline)
- ❌ Filled buttons except the modal's `approve & generate` (`--ink-jet` fill, paper text)
- ❌ Multi-color severity ramp (severity stays glyph + weight; sev-5 alone gets `--seal`)
- ❌ Drop shadows above 6px blur (use hairline borders)
- ❌ Card chrome on the GeneratePanel (replaced by registers, §6.7)
- ❌ Decorative line-diagram thumbnails (replaced by hairline rectangle + display_name, §6.5)
- ❌ Spring physics, parallax, scroll-triggered animation, hero gradients
- ❌ Emojis except `※`, `‡`, `▍`, `→`, `‖` (Courier glyphs only)
- ❌ Uppercase headlines (smcp is for labels, not headlines)
- ❌ "AI" / "automatic" / "smart" copy (see §8)
- ❌ Sage / sky as fill colors (only as hairlines, only in two specific affordances)
- ❌ Dropdowns with chevron icons (use `›` Courier)
- ❌ Toggles with sliders (use Courier `[ x ]` / `[ · ]`)
- ❌ A second chromatic accent. One. Inked. Seal.

---

## 11. Tech & constraints

- Next.js 16 (per `AGENTS.md` warning about breaking changes — read `node_modules/next/dist/docs/` before any new pattern).
- Tailwind v4 + `@theme` block as ground truth (see `globals.css`).
- Electron desktop app — minimum width 1280, designed to read at 1440 (13" MBP) and breathe at 2560 (27" iMac). No mobile breakpoint.
- Fraunces via `next/font` (already wired through `var(--font-fraunces)`).
- Courier New is system-installed; no webfont needed.
- localStorage already carries: typed memory, intake overrides, doc overrides, context paste, label edits. Continue the `akalan:*:v1:*` namespace.
- `prefers-reduced-motion` honored (see §5).
- Keyboard: `Esc` closes modal (existing). `⌘K` opens binder search (currently a dead chip — wire it). `g` then `f/e/d/r` jumps between primary tabs (new).

---

## 12. Success criteria

The redesign succeeds when:

1. A 12-year-practitioner attorney lands on the empty state and recognizes Atelier as **a tool made by someone who has read a cover letter at 2 a.m.** — not by a SaaS team.
2. The attorney can answer "how many days until the I-94 deadline" without scrolling, on every screen, in under 1 second.
3. The PreGenerationApproval modal reads in two ceremonies (decision-zone vs. apparatus-zone); the eye lands on cost + decision before risk register.
4. No screen contains more than one chromatic moment, and that moment is always a sev-5 conflict, an attorney signature, or the masthead alarm chip.
5. The GeneratePanel and the FactsPane feel like **the same product** — both editorial registers under hairlines, neither a card grid.
6. The Marginalia rail is alive — clock, recent outputs, editor's note — and the attorney glances at it the way she glances at a desk lamp.
7. A reviewer who has never seen Aesop, Kinfolk, or Monocle can still tell, within 5 seconds of looking, that this product respects the attorney's silence.
