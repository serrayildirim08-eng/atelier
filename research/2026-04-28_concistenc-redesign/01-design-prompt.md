# Concistenc — design prompt (v1, 2026-04-28)

You are redesigning Concistenc, a desktop AI paralegal app for a single immigration attorney. Three locked decisions sit above all design choices and are non-negotiable: (1) strict monochrome, no chromatic accent ever; (2) one display serif — **Lyon Display** — added on top of the existing system-sans body; (3) the Money, Conflicts, and Citations tabs each get a structurally distinct skeleton instead of all sharing SectionHeader → Card grid → ProvenanceBlock. Everything that follows is grounded in those three decisions.

The product is not a SaaS, not a wellness app, not a startup dashboard. It is a private attorney's workshop — closer to a 19th-century law office than to Linear. The metaphor is **the binder, the dossier, the desk, the clerk**. The user is ADHD-leaning and exhausted by chrome; calm density beats novelty every time.

---

## 1. One-line vision

A monochrome attorney's atelier rendered in code: paper-2 ground, jet ink, hairline rules, Lyon Display only at hero scale, system-sans for everything else, and three tabs that look like a *timeline*, an *editor's report*, and a *legal review document* — not three flavors of the same card grid.

Emotional simile: **a leather-bound dossier opened on a quiet desk at 9 a.m., warm lamp, hairline ruled paper, one fountain pen.** Not "minimal." Not "premium." *Quiet, cared-for, load-bearing.*

---

## 2. Context (read before coding)

- Stack: Next.js 16.2, React 19.2, Tailwind v4 with `@theme` CSS variables, Electron desktop wrapper, no new design libs. Fonts come in via `@font-face` from `/public/fonts/` or via Klim/Commercial Type CDN if licensed; no Google Fonts.
- Files in scope:
  - `app/globals.css` — token system; extend, do not replace.
  - `app/page.tsx` — home + dossier dashboard (5,861 lines; surgical edits only).
  - `app/matter/[id]/page.tsx` — matter dashboard with 7 tabs (1,154 lines).
  - `app/components/loading-progress.tsx` — long-running ingest screen.
  - `app/components/sof-chain-table.tsx` — current Money tab table; will be **replaced** by a vertical timeline component.
  - `app/components/conflict-register.tsx` — current Conflicts tab card grid; will be **replaced** by banded paragraph flow.
  - `app/components/authority-cite-check.tsx` — current Citations tab card grid; will be **replaced** by diff-style annotated view.
- No new dependencies except: web fonts (Lyon Display) and optionally `motion` (Framer) for the loading screen. Everything else uses CSS keyframes and Tailwind.
- Desktop-first. Tablet width is the floor for matter dashboard. Mobile is out of scope.

---

## 3. Reference anchors (what to internalize, what to ignore)

Read `03-moodboard.md` for the full set with URLs. Compressed:

- **The Gentlewoman (web).** Monochrome that's *confident*, not austere. Hierarchy by size + spacing only. Borrow: ratio of breathing-room to type. Don't borrow: carousel pacing, fashion editorial voice.
- **Klim Type Foundry's own site.** How a serious typographer sets type at scale on screen. Borrow: Lyon-class display sitting on a hairline-ruled grid with system-sans body. Don't borrow: foundry-marketing flourishes (specimen carousels, animated weight sliders).
- **NYT Magazine 2026 redesign (Bichler).** Hero serif treated as a quiet anchor, page furniture moved up to free vertical space, italic reserved for "literary" emphasis. Borrow: italic discipline. Don't borrow: the slab-serif personality (wrong register).
- **Stripe billing event timeline.** Vertical axis with hairline rule, dotted node markers, time-stamped events flowing downward, monetary amounts in tabular-mono. Borrow: structural literalism for the Money tab. Don't borrow: brand purple, marketing illustrations.
- **GitHub PR diff view.** Gutter-and-content split, hairline left margin marks the change, struck-through annotation for removals. Borrow: inline citation context with allowlist/off-allowlist as gutter marks. Don't borrow: green/red coloring (we are monochrome — use weight + strikethrough + position instead).
- **Atlantic / NYT op-ed banded essay.** Severity bands separated by negative space, no boxes, no dividers; reads as prose. Borrow: this exact structure for Conflicts. Don't borrow: drop caps, bylines, photo leads.
- **Bloomberg Terminal (the *idea*, not the visuals).** Information density carries authority. Borrow: trust the user with density; never cushion data in pillows of whitespace inside cards. Don't borrow: the green-on-black, the chromatic alarms, the orange.

Anti-references (do *not* look like): Notion templates, Vercel marketing pages, Stripe Atlas, any wellness app, anything with rounded-2xl pillow cards, any startup landing page from 2022.

---

## 4. Palette — strict monochrome, no exceptions

All values already in `globals.css`. No additions to the chromatic axis. Roles are explicit; nothing is named `rubric` or `ochre` anymore.

```
/* Surfaces */
--color-paper:        #FAFAFA;  /* default ground */
--color-paper-2:      #F0F0F0;  /* recessed surfaces (sidebar, code blocks, paper-recess) */
--color-paper-3:      #E5E5E5;  /* hovered or selected ground */
--color-paper-deep:   #D4D4D4;  /* depressed key, struck-through gutter ground */

/* Ink */
--color-ink:          #0A0A0A;  /* primary text, hero headlines, severe markers */
--color-ink-2:        #1F1F1F;  /* secondary text, source quotes */
--color-graphite:     #404040;  /* tertiary text, captions */
--color-graphite-soft:#595959;  /* placeholder text, "not extracted" italic */

/* Hairlines */
--color-rule:         rgba(10, 10, 10, 0.10);  /* default 1px hairline */
--color-rule-strong:  rgba(10, 10, 10, 0.32);  /* hover, active, key separators */
```

**Severity hierarchy in monochrome.** This is the most important non-color rule in the system. The previous codebase used `#15803D / #A16207 / #B91C1C` for confidence pills and severity strips — kill all of them, including `--color-rubric`, `--color-rubric-soft`, `--color-ochre`, `--color-verdant`, `--color-seal`. Severity is carried by **measurable visual mass**, not hue:

| Severity | Left-border weight | Type weight | Type size | Left-padding |
|---|---|---|---|---|
| DISPOSITIVE | 2.5px solid `--color-ink` | 700 | `--text-section` (24px) | 24px |
| MATERIAL | 1.5px solid `--color-ink` | 600 | `--text-title` (17px) | 18px |
| MINOR | 1px solid `--color-rule-strong` | 500 | `--text-body` (15px) | 14px |
| CLERICAL | 1px solid `--color-rule` | 500 | `--text-meta` (13px) | 12px |
| COSMETIC | no border | 400 | `--text-meta` (13px) | 0 |

Confidence pills become small uppercase mono labels at 11.5px, no fill, no border, just letterspacing and weight: `HIGH` (weight 700, ink), `MEDIUM` (weight 600, graphite), `LOW` (weight 500, graphite-soft, struck through). Strikethrough uses the existing `text-decoration: line-through` with `text-decoration-thickness: 1px; text-decoration-color: var(--color-graphite);`.

---

## 5. Typography — system-sans body + Lyon Display hero

### 5a. Stack

```
--font-display: "Lyon Display", "Iowan Old Style", "Hoefler Text", "Apple Garamond", Georgia, "Times New Roman", serif;
--font-body:    -apple-system, "Helvetica Neue", "Inter", system-ui, sans-serif;
--font-mono:    ui-monospace, "SF Mono", "Berkeley Mono", Menlo, monospace;
```

Lyon Display is the *only* serif in the system. It is used at three sizes and nowhere else:
1. **Hero (96px)** — empty-state "Drop a dossier." on home, only when there are zero matters.
2. **Hero (64px)** — matter masthead investor name on `/matter/[id]`.
3. **Display (38px)** — section heroes inside dossier panes, page titles in Generate flows.

Loading-screen percent is the exception: 88px → 128px italic Lyon Display Light, scaling to fill 1.5× hero-height of breathing room. *This is the only place italic appears in display sizes.*

If the Lyon license isn't yet in place, the fallback chain (Iowan Old Style → Hoefler Text → Georgia) works at all three tiers and the codebase already has Iowan smuggled in. Do not add a chromatic Google Fonts import; the fallback chain is final.

### 5b. Type scale — extend from 6 tokens to 8

```
/* keep */
--text-label:    0.72rem;    /* 11.5px — smcp uppercase mono */
--text-meta:     0.8125rem;  /* 13px   — secondary inline */
--text-body:     0.9375rem;  /* 15px   — reading copy DEFAULT */
--text-lede:     1rem;       /* 16px   — italic ledes (kept but rarely used) */
--text-title:    1.05rem;    /* 16.8px — card titles */

/* add */
--text-section:  1.5rem;     /* 24px   — pane section headers (NEW) */
--text-display:  2.4rem;     /* 38.4px — page heroes inside panes (kept ratio) */
--text-hero:     4rem;       /* 64px   — matter masthead investor name (NEW) */
--text-stunt:    6rem;       /* 96px   — empty-state "Drop a dossier." (NEW) */
```

The previous scale collapsed `--text-section` onto card titles; that's why the dashboard felt structurally identical. Section headers now sit at 24px Lyon Display, weight 400, letter-spacing -0.005em, line-height 1.15. Card titles stay 17px system-sans, weight 600.

### 5c. Per-token spec

| Token | Family | Weight | Size | Tracking | Line-height | Use |
|---|---|---|---|---|---|---|
| `--text-stunt` | Lyon Display | 400 | 96px | -0.025em | 0.95 | empty-state hero only |
| `--text-hero` | Lyon Display | 400 | 64px | -0.02em | 1.02 | matter masthead investor |
| `--text-display` | Lyon Display | 400 | 38px | -0.012em | 1.08 | pane heroes |
| `--text-section` | Lyon Display | 400 | 24px | -0.005em | 1.15 | section headers inside panes |
| `--text-title` | system-sans | 600 | 17px | -0.005em | 1.35 | card titles, table column heads |
| `--text-lede` | system-sans | 500 | 16px | 0 | 1.55 | rare ledes |
| `--text-body` | system-sans | 500 | 15px | 0 | 1.55 | reading default |
| `--text-meta` | system-sans | 500 | 13px | 0.005em | 1.45 | secondary text |
| `--text-label` | mono | 600 | 11.5px | 0.10em | 1 | smcp uppercase |

### 5d. Italic budget — exactly one role

Italic appears in **source quotes only** — `<blockquote>` rendered inside `<details>` provenance blocks. Nowhere else. The previous codebase had italic in 6 roles (wordmark period, lede paragraphs, "no exhibits in this section yet" empty hints, attorney attestation, "not extracted" placeholders, source quotes); kill 5 of them and use:

- "not extracted" → `text-graphite-soft text-meta` (no italic, just lighter weight + smaller size).
- Lede paragraphs → roman, weight 500, `--text-lede`.
- Empty-state hints → roman, weight 500, `--text-meta`, `--color-graphite`.
- Attorney attestation → smcp uppercase mono, no italic.
- Source quotes inside `<details>` → Lyon Display **italic**, weight 400, `--text-meta` (13px), color `--color-ink-2`, with a 1.5px left border in `--color-rule-strong`, padding-left 14px, margin-block 8px.

When italic is preserved this strictly, it earns its meaning back: *the only italic on the page is the source speaking.*

---

## 6. Layout & spacing

### 6a. Spacing scale (use these only)

`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 / 144 px`. Tailwind tokens: `1 / 2 / 3 / 4 / 6 / 8 / 12 / 16 / 24 / 36`. Anything off-scale must justify itself in a comment.

### 6b. Hero breathing room

Heroes get 1.5× their own type size in vertical breathing above and below. Concretely:
- Empty-state hero (96px) → 144px above, 144px below.
- Matter hero (64px) → 96px above, 64px below (asymmetric — hero anchors top, content flows close).
- Section header (24px) → 48px above, 24px below.

### 6c. Surface rules

- **One bordered surface per region.** Cards-in-cards-in-sections is the audit's #4 offense; kill it. When a section's content is a table, the outer card is dropped and the table sits directly under the section header on `--color-paper`.
- **Hairline rules carry hierarchy.** `border-rule` for everyday separators, `border-rule-strong` for active states, hovers, and the masthead lower edge, full `--color-ink` only for the page header bottom border (1.5px).
- **Paper-recess for "embedded" surfaces only.** Sidebar binder, code blocks, struck-through gutter ground. Not for cards.

### 6d. Three-column layout (home + matter)

- Home page: `[binder 320px][dossier 1fr][marginalia 280px]`. Binder scrolls independently, dossier is the main column, marginalia is right rail (margin-note class). Gaps: 0 (separated by hairline `border-r`).
- Matter dashboard: full-width masthead → tabstrip → pane. Pane internal grid is 12-col with 24px gutter; hero spans 8 cols on desktop, 12 on tablet.

### 6e. Tab strip

The current pill-with-dot-bullet treatment is fine but needs cooling:
- Active: `bg-ink text-paper`, weight 600, no dot, no bullet, no badge ornament.
- Inactive: `text-graphite hover:text-ink`, no background, no border.
- Badge counts (Conflicts, Citations) sit inline as mono tabular figures at 13px, no parentheses, no fill.
- Drop the 1.5×1.5 dot decoration — it's the audit's "ornament budget overspent."

---

## 7. Motion grammar

ADHD-friendly means: **no springs, no overshoot, no parallax, no novelty.** Three named curves total. Reduced-motion respects all of them.

```
--ease-paper:   cubic-bezier(0.2, 0.0, 0.2, 1);   /* default UI transitions */
--ease-rule:    cubic-bezier(0.16, 1, 0.3, 1);    /* fade-up reveals */
--ease-loading: cubic-bezier(0.65, 0, 0.35, 1);   /* loading-screen percent breathing */
```

Durations:
- Tab/page transitions: 180ms `--ease-paper`, opacity only, no transform.
- Provenance disclosure (`<details>`): 200ms `--ease-paper`, content fades and shifts 4px.
- Pane reveal on first mount: 280ms `--ease-rule`, fade-up 6px (already present, keep).
- Loading-screen percent: 1200ms `--ease-loading`, scale 1.00 → 1.005 → 1.00 (barely-perceptible breath, paired with opacity 0.96 → 1 → 0.96).
- Hovers: instant on color, 120ms on border-color, never on size.

The loading-screen percent is the *only* element with ambient motion when the screen is at rest. Everything else is still until acted on.

`@media (prefers-reduced-motion: reduce)` collapses all of the above to opacity-only at 120ms.

---

## 8. Component inventory

### Keepers (do not touch)

- **Sigil** (`.sigil`) — 1.65rem ink-bordered initials with 0.5px inset border. Earned, info-bearing.
- **Paper grain** (`.paper-grain`) — radial-gradient noise at 0.024 opacity. Atmospheric.
- **Hairline rules** (`.brass-rule`, `border-rule`, `border-rule-strong`).
- **Reading baseline** — 15px / 1.55 / weight 500.
- **Provenance disclosure** — `<details>` with `<summary>` smcp label, source quote in italic Lyon blockquote, source page + confidence in tabular-mono.
- **smcp** label class (mono uppercase, 0.10em tracking, weight 600).
- **Sentence-case** label-quiet class.

### Killers (delete from CSS, codebase, and JSX)

- `.drop-cap::first-letter` — defined, unused. Delete.
- `.dinkus` and its `::before/::after` — kâğıtta uçar, ekranda asla. Delete.
- `atelier.` italic-period wordmark in `Header()` — replace with sentence-case sans wordmark `concistenc`, no italic, weight 600, tracking -0.02em, 32px.
- `⁂` glyph in `case-overview-card.tsx:80` — meaningless ornament. Delete.
- `E·II / EB·IA / EB·IB / EB·IC` middle-dot codes everywhere (`page.tsx:269-272, 1932-1935, 4383-4407`) — replace with real legal codes `E-2 / EB-1A / EB-1B / EB-1C`. A senior lawyer will catch the aestheticization on day one.
- Tab letters A–L rendered at 17px bold mono inline as decoration — reduce to 11.5px smcp gutter labels next to the tab they label (still info-bearing) or drop entirely if redundant with the document-inventory section header.
- `⌘K search the binder` bubble (`page.tsx:878-881`) — if search isn't actually wired, delete the entire bubble. If wired, collapse to a 24×24 paper-recess square with just `⌘K` in mono 11.5px, no copy. Audit: it's currently a billboard for vapor.
- Inline chromatic hex codes `#15803D / #A16207 / #B91C1C` (`page.tsx:2094-2096, 2405-2414`) — kill, replace with monochrome severity-mass system from §4.
- `text-rubric / text-ochre / border-rubric/60` — find/replace to monochrome equivalents (`text-ink / text-graphite / border-rule-strong`).
- Cards-in-cards-in-sections — wherever a Section wraps a single Card that wraps a single content block, flatten to: SectionHeader → content directly on paper.

### New components (build these)

#### 8a. `<MoneyTimeline />` — replaces `SofChainTable` in the Money tab

Vertical timeline. Source-of-funds chain rendered as a time-axis flow.

Structure:
```
[24px section header: "Source of funds"]
[1px vertical rule, --color-rule-strong, runs the full height of the timeline, positioned at left: 32px]
[for each leg in chain:
  [marker: 8×8 square outline ink, sitting on the rule]
  [right of marker, 24px gap:
    [smcp 11.5px label: "ORIGIN" / "WIRE" / "ESCROW" / "ENTERPRISE"]
    [17px title weight 600: account name + last-4]
    [13px graphite meta: bank, jurisdiction, date in tabular-mono]
    [optional 13px ink-2: amount, tabular-mono, right-aligned in column]
    [<details> provenance disclosure underneath]
  ]
  [48px gap before next leg]
]
[final marker is filled square ink (8×8), the rule terminates 8px below it]
```

The vertical rule is the spine. Markers are squares, not dots — squares read "ledger entry" and dots read "bullet point." Each leg is a node; gaps are uniform 48px. Amounts in tabular-mono align in a right column at 14ch width. No card. No border around the whole component. The rule is the only line.

#### 8b. `<ConflictBands />` — replaces `ConflictRegister` in the Conflicts tab

Banded paragraph flow. Severity-grouped, prose-like. No card grid, no boxes, no dividers.

Structure:
```
[24px section header: "Conflicts in the record"]
[for each band in [DISPOSITIVE, MATERIAL, MINOR, CLERICAL, COSMETIC]:
  [11.5px smcp band label, color --color-graphite, margin-bottom 8px]
  [for each conflict in band:
    [paragraph block per §4 severity table:
      left-border weight, type weight, type size, left-padding all from the table]
    [<details> provenance disclosure underneath, indented to match left-padding]
    [16px gap before next conflict in same band]
  ]
  [96px gap before next band — this is the negative-space band separator, not a rule]
]
```

The conflict body is a real paragraph. Sentence-case. 1.55 line-height. It reads top-to-bottom like prose. The visual hierarchy across bands is: DISPOSITIVE shouts (24px, weight 700, 2.5px ink border), COSMETIC whispers (13px, weight 400, no border, indented 0). The 96px gap between bands does the work that section dividers would have done in the old design.

#### 8c. `<CitationDiff />` — replaces `AuthorityCiteCheck` in the Citations tab

Diff-style annotated view. Like `git diff` or a Bluebook review.

Layout: two-column grid `[40px gutter][1fr content]`.

Structure:
```
[24px section header: "Citations in the cover letter"]
[for each citation:
  [gutter cell:
    [if allowlist: 1px vertical rule in --color-rule-strong, 100% height of citation block, positioned right: 0 of gutter cell]
    [if off-allowlist: 11.5px mono label "OFF" in --color-ink, weight 700]
    [if AAO-routed: 11.5px mono label "AAO" in --color-graphite, weight 600]
  ]
  [content cell:
    [13px meta gray: §-symbol + cite, e.g. "8 C.F.R. § 214.2(e)(12)"]
    [15px body-weight 500: the context paragraph from the cover letter, 65ch max]
    [if off-allowlist: the same paragraph but with strikethrough applied to the cite token only — text-decoration-line through, --color-graphite, --color-paper-deep wash on the bg of the cite token (8px horizontal padding, no border)]
    [<details> provenance underneath]
  ]
  [32px gap before next citation]
]
```

The hairline left-rule in the gutter is the "in allowlist" marker — silent, almost invisible, the way a reviewer's pencil tick sits in the margin. The struck-through cite token is the only place strikethrough appears in the system. AAO-routed gets a one-word mono label, no badge, no pill. The whole component reads like a marked-up brief.

### 8d. Loading screen — refine within the system

Already cinematic; do not redo. Adjust:
- Percent: Lyon Display Light italic, 88px → 128px, `--ease-loading` breath at §7.
- Stage label (top-right): smcp 11.5px in `--color-graphite`, no decoration.
- Progress hairline: 1px `--color-rule-strong` along the bottom of the viewport, fills left-to-right, no gradient, no pulse, no chromatic accent. Currently uses `var(--color-rubric, #b8392e)` at line 449 — replace with `var(--color-ink)` at 0.4 opacity (`rgba(10,10,10,0.4)`).
- The loading screen is the one place where a single calm motion is allowed. Everything else stays still.

---

## 9. State machine — every pane, every state

For each pane and every component above, design **first-mount, loading, empty, populated, error, offline, edit**. The previous codebase only designs the populated state; that is the audit's "no hero" symptom in disguise.

- **First-mount** — fade-up reveal, 280ms `--ease-rule`, 6px translate.
- **Loading** — paper-recess block at the size the populated content will occupy, hairline rule top + bottom, smcp label "reading the dossier" centered, no spinner. Skeleton rows are 1px hairlines at 0.32 opacity, not pulsing rectangles.
- **Empty** — Lyon Display 38px hero "Nothing here yet." in ink, 13px graphite subhead in roman explaining what would populate this pane, 48px breathing room above.
- **Populated** — the design.
- **Error** — same shape as Empty, 38px Lyon Display hero in `--color-ink-2`, 13px graphite meta with the specific error message in roman (no italic), and a smcp mono "retry" link below at 11.5px.
- **Offline** — masthead gets a smcp suffix `· offline` after the user email; no banner, no toast, no chrome.
- **Edit** — fields sit inline, no modal; border becomes `--color-rule-strong` on focus, 1.5px ink ring on `:focus-visible`. `--color-paper-3` background on the active field.

---

## 10. Voice & microcopy

The product talks like a clerk: **dry, lowercase where natural, exact, never cheery, never apologetic.** No exclamation marks anywhere. No emoji. No "Oops!" or "Almost there!" The previous "search the binder" is the right register; "loading magic for you" is not.

Replace:
- "loading…" → "reading the dossier"
- "no exhibits in this section yet" → "no exhibits filed under this tab"
- "not extracted" → "not on file" (drops the false implication of a failed attempt)
- "attorney attestation · merges into draft" → keep, this is good
- "Drop a dossier." → keep, this is the empty-state hero
- "Drop a dossier here, or paste a URL" → "Drop a dossier here. Or paste a URL." (two sentences, two periods, the period is the period — no italic.)

Section headers stay as nouns: "Source of funds", "Conflicts in the record", "Citations in the cover letter", "Tabs A–L documents." Never verbs, never questions.

---

## 11. Polish density — the five details no one needs but everyone notices

Force at least these five into the implementation:

1. **The hairline that doesn't quite reach the top.** The vertical rule in `<MoneyTimeline />` starts 8px below the first marker and ends 8px below the last, never flush. Reads as "a pen drew it," not "a stylesheet drew it."
2. **Tabular numerals everywhere a number could line up.** Already in `globals.css`; verify every amount, page count, percent, and confidence score uses `font-variant-numeric: tabular-nums`. Misaligned digits in a legal product look amateur the way a misaligned column in a spreadsheet does.
3. **Sentence-case everywhere except smcp labels.** The audit's voice issue. "Source of funds" not "Source of Funds" not "SOURCE OF FUNDS."
4. **The 0.5px inset border on the sigil.** Already there. Preserve it. It's the only ornament on the page that's working.
5. **The 8×8 square markers on the timeline are filled or outlined depending on state.** Outlined = pending leg, filled = settled leg. Two visual states in monochrome, carried by fill alone.

Optional sixth: **time-aware masthead.** The current header shows date and time. Don't animate it. But on `prefers-color-scheme: dark` (in case the user opens the matter dashboard at midnight), invert the paper-2/jet to a warm dim — out of scope for v1, design hook only.

---

## 12. Anti-patterns — never ship any of these

- Any chromatic hex code in any component or stylesheet. The system has zero `#XX` codes outside the grayscale ramp.
- Italic on anything that isn't a `<blockquote>` inside a `<details>`.
- A card inside a card inside a section. One bordered surface per region.
- Springs or overshoot easing on any element. We have three curves; that's it.
- Drop caps. Dinkus glyphs. `⁂`. Middle-dot legal codes (E·II). `atelier.` with italic period.
- Pulsing skeletons, shimmer loaders, dot-flashing spinners, indeterminate spinners of any kind.
- Badge pills with fills. Badges are mono labels at 11.5px, no fill, no border, sometimes a strikethrough.
- "Premium," "modern," "clean," "elegant," "minimal" anywhere in code comments. If the comment justifies a token, name the token.
- Rounded-2xl pillow cards. Border radius is 0 by default; the only radii in the system are `999px` for the tab-strip pills and `0` for everything else.
- Search bubble that doesn't search. Cmd-K labels for affordances that don't exist.
- Tab letters as decoration. If it's not info-bearing, it's debt.
- "Confidence: 0.87" rendered as a pill with chromatic fill. Render it as `HIGH` / `MEDIUM` / `LOW` in mono 11.5px, weight by tier, no fill.

---

## 13. Tech & constraints

- Tailwind v4 with `@theme` block in `globals.css`. Extend the existing token names; the codebase reads `--text-display`, `--color-ink`, `font-mono` etc. directly. Add `--text-section`, `--text-hero`, `--text-stunt`, `--ease-paper`, `--ease-rule`, `--ease-loading`, `--font-display` (rebound to Lyon).
- React 19.2, Server Components default. The three new tab components are client components (`'use client'`) only if they need provenance disclosure state; otherwise keep them server-rendered.
- Electron desktop wrapper. Test on Electron's Chromium. No browser-API-only features beyond what Electron 30+ supports.
- No new deps. Lyon Display is loaded from `/public/fonts/lyon-display-{regular,italic,light,light-italic}.woff2` via `@font-face` in `globals.css`. If the license isn't in place at build time, the fallback chain (Iowan Old Style → Hoefler Text → Georgia) holds the design — verify all hero sizes still render correctly in the fallback before approving the merge.
- File budget for the redesign: `globals.css` grows by ~60 lines; `page.tsx` shrinks by ~150 (killing dead ornaments); `matter/[id]/page.tsx` shrinks by ~80; three new component files of ~120 lines each.

---

## 14. Per-screen prescriptions

### Home page (`app/page.tsx`)

- Header: drop the `atelier.` wordmark. Replace with `concistenc` in system-sans, weight 600, tracking -0.02em, 32px. No italic. No period stunt. Border-bottom stays 1.5px ink.
- Cmd-K bubble: delete unless wired; if wired, collapse to a 24×24 paper-recess square with `⌘K` mono 11.5px centered, no copy.
- Date/time/email row stays in mono on the right; replace the `·` separator with a single en-space `&ensp;` (softer, less ornamented).
- Binder (left): 320px wide, paper-recess background, hairline border-right. Each matter card stays as is. Sigil keeps its 0.5px inset.
- Dossier empty state (`<DossierEmpty />`): the 96px hero "Drop a dossier." in Lyon Display, weight 400, tracking -0.025em, line-height 0.95, color `--color-ink`. Below: 13px meta gray "Or paste a URL." with 48px gap. 144px breathing room above the hero. Below the subhead: case-type glyphs become real codes `E-2 / EB-1A / EB-1B / EB-1C` in mono 13px, weight 600, tracking 0.05em, separated by 24px horizontal gaps, no boxes, no borders.
- Marginalia rail (right): 280px, no background, hairline border-left. Existing margin-note class is fine.

### Matter dashboard (`app/matter/[id]/page.tsx`)

- Masthead: investor name in Lyon Display 64px (`--text-hero`), weight 400, tracking -0.02em, line-height 1.02. 96px breathing room above, 64px below. Underneath: smcp 11.5px label `E-2 · TREATY INVESTOR · MATTER #{matter.id}`, color graphite. Border-bottom 1.5px `--color-rule-strong` (not full ink — masthead is quieter than the page header).
- Tab strip: existing pill treatment, but kill the 1.5×1.5 dot. Active is `bg-ink text-paper`, weight 600. Badge counts as inline mono tabular figures, no parens.
- Pane padding: 48px top, 96px bottom, 48px horizontal on desktop / 24px on tablet.
- Section header within a pane: `--text-section` (24px) Lyon Display, weight 400, color ink, tracking -0.005em. 48px above, 24px below.

### Money tab — `<MoneyTimeline />`

See §8a. The chain runs vertically from origin to enterprise; the vertical rule is the spine; markers are 8×8 squares. Amounts in mono tabular align right at 14ch. No card wrapper. No borders. Just the rule and the legs.

### Conflicts tab — `<ConflictBands />`

See §8b. Severity bands in prose order DISPOSITIVE → MATERIAL → MINOR → CLERICAL → COSMETIC, separated by 96px negative space. Each conflict is a paragraph. Left-border weight + type weight + type size carry severity. No badges, no pills, no chromatic strips.

### Citations tab — `<CitationDiff />`

See §8c. Two-column gutter-and-content grid. Allowlist = hairline left-rule in gutter. Off-allowlist = strikethrough on the cite token + paper-deep wash. AAO = mono `AAO` label. The whole pane reads like a marked-up brief, not a dashboard.

### Loading screen (`app/components/loading-progress.tsx`)

Lyon Display Light italic for the percent, 88–128px, breath motion per §7. Stage label smcp top-right. Progress bar: 1px hairline at the bottom of the viewport, `rgba(10,10,10,0.40)`, no gradient. The variable currently reading `var(--color-rubric, #b8392e)` at line 449 must be replaced with `rgba(10,10,10,0.40)` literally — no token, because there is no token for "ink at 40% opacity for progress" and we're not adding one for a single use site.

---

## 15. Success criteria

The redesign is done when:

1. A 5-second glance at any pane tells you which pane it is, structurally, before you read a word. (Money looks like a timeline. Conflicts looks like a memo. Citations looks like a marked-up brief. Overview / Facts / Documents / Generate keep the card-grid skeleton because they earn it — Money / Conflicts / Citations don't and never did.)
2. There is exactly one bordered surface between the page edge and any leaf content.
3. There is zero italic on the screen except inside `<details>` blockquotes.
4. The largest visible type is at least 64px on a populated matter and at least 96px on the home empty state.
5. Severity is legible at a glance from across the room, monochromatically — visual mass not hue.
6. A senior immigration attorney looking at the page does not catch a single legal-code aestheticization, decorative law glyph, or chromatic confidence pill.
7. The loading screen breathes. Nothing else does.

If any of these fails, the redesign isn't done. Push the section that fails through another pass.
