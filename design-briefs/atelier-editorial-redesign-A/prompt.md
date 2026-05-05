# ATELIER · Editorial Redesign — Designer A's Prompt
> Paste-ready brief for a fresh Claude. ~210 lines.

## 1 · ONE-LINE VISION
Build Atelier as a **butcher-paper sheet pinned under a brass dinkus on a partner's reading desk** — a single sheet of warm cream paper, subdivided by hairlines, headlined in Fraunces, footnoted in Courier, with one oxblood asterisk reserved for the moments that demand the attorney's eyes. Not a SaaS console. Not a chat surface. Not an "AI app."

## 2 · CONTEXT
Atelier is the in-house AI paralegal of Akalan Immigration. The sole user is **Serra**, a managing partner who ingests 60–900 PDFs per case (E-2 / EB-1A / EB-1B / EB-1C), watches a pipeline classify and extract them, edits structured facts, then approves and signs USCIS-bound artifacts (cover letter, exhibit list, I-129, declarations, NoIDs). It runs as an Electron desktop app — never a browser, never mobile. The audience is one attorney, then 2–5 attorneys.

The codebase is **already mature**: strict monochrome (`globals.css` lines 6–28), Fraunces variable axis-locked, Courier as the protected mono voice, paper-grain texture, a real motion library (`cascade-in`, `tab-glide-track`, `brass-reveal`, `sweep-bar`, `ring-spin`, `lift-hover`), a 9000-line single-page dashboard with a three-column shell (Binder · Dossier · Marginalia), a working PreGenerationApproval modal, a working ingest pipeline with editorial microcopy ("praying to immigration gods · auditing draft against the unified facts").

This is a **redesign that respects the bones**. We are not throwing out the type stack, the motion library, or the IA. We are tightening hierarchy, claiming dead real estate (Marginalia rail), demoting two SaaS-shaped components back to editorial registers, introducing one inked accent with strict semantics, and codifying the voice.

## 3 · REFERENCES
See `moodboard.md` (12 references). Primary anchors:
- **Aesop** store pages — hairline-only hierarchy, cream + jet, mono caption.
- **Kinfolk + Apartamento + The Gentlewoman** — section labels in mono lowercase, italic on punctuation only, asymmetric column rhythm with marginalia.
- **The Paris Review online** — 68ch reading column, 48px section breath, no chrome.
- **Are.na editor** — register + register + register replaces card grid (this is the GeneratePanel fix).
- **Strand bookstore receipts** — letterpress + typewriter + oxblood wax-stamp = three voices, one sheet, perfect hierarchy.

Anti-references: **Notion, Linear, Vercel dashboard, Stripe Atlas, any 2024–2026 "AI app" with a Sparkle icon**.

## 4 · PALETTE (named, with role)
Strict mono spine; ONE inked accent; two hairline gradients only.

```
--paper-cream:   #FAFAFA  /* default surface                            */
--paper-vellum:  #F4F2EC  /* dossier shell, marginalia                  */
--paper-recess:  #F0F0F0  /* recessed wells, modal backdrop tint        */
--paper-grain-3: #E8E6E0  /* page edges                                 */
--paper-deep:    #D4D4D4  /* card edge under hover                      */

--ink-jet:       #0A0A0A  /* body, headlines, signature stamp           */
--ink-2:         #1F1F1F  /* secondary body, button hover               */
--ink-mute:      #2E2E2E
--graphite:      #404040
--graphite-soft: #595959

--seal:          #5B1A12  /* OXBLOOD. Used ONLY for: attorney-initials
                             focus border, sev-5 conflict glyph + 2px
                             left gutter, wax-stamp on signed artifacts,
                             masthead alarm chip ("4 critical · resolve
                             before submission"). Never on links. Never
                             on buttons. Never as a tint behind text.
                             ~6 occurrences per page maximum.            */

--brass-hair:    rgba(165, 135, 90, 0.55)   /* warm hairline ONLY        */
--sky-rule:      rgba(120, 145, 170, 0.55)  /* cold hairline ONLY        */

--rule:          rgba(10, 10, 10, 0.10)
--rule-strong:   rgba(10, 10, 10, 0.32)
--rule-edge:     rgba(10, 10, 10, 0.55)
```

**Forbidden:** any second chromatic accent, severity color ramp (severity stays glyph + weight), gradient surfaces, shadows above `0 6px 12px -8px rgba(10,10,10,0.18)`.

## 5 · TYPOGRAPHY
Stack already correct (`globals.css`):
```
--font-display: var(--font-fraunces), "Iowan Old Style", "Hoefler Text", Georgia, serif;
--font-body:    -apple-system, "Helvetica Neue", "Inter", system-ui, sans-serif;
--font-mono:    "Courier New", ui-monospace, "SF Mono", Menlo, monospace;  /* PROTECTED */

/* Fraunces axis lock — SOFT 0 always, WONK 0 always, opsz tuned per size */
--fraunces-stunt:   "opsz" 144, "SOFT" 0, "WONK" 0;
--fraunces-hero:    "opsz"  96, "SOFT" 0, "WONK" 0;
--fraunces-section: "opsz"  36, "SOFT" 0, "WONK" 0;
--fraunces-title:   "opsz"  20, "SOFT" 0, "WONK" 0;
```
Scale: stunt 96 / hero 64 / display 38.4 / section 24 / **subhead 19.2 (NEW — for blocks within sections)** / title 16.8 / lede 16 / body 15 / meta 13 / label 11.5 / foot 10.5.

**Four roles, full stop:**
1. Stunt/Hero/Display — Fraunces. Italic only on the wordmark period (`atelier.`) and on Marginalia editor's notes.
2. Section/Title/Subhead — Fraunces opsz 36–20, weight 600, tracking `-0.012em`.
3. Body/Lede/Meta — system sans, weight 500, lh 1.55 (1.65 lede).
4. Mono — Courier New. Two ceremonies only: `smcp` (uppercase, tracking 0.10em, weight 600, label-only) and `label-quiet` (sentence case, tracking 0.04em, weight 500, inline meta).

**Hard rule:** Fraunces never in tabular data, never inside a button, never as body. Courier never above 13px except masthead `⌘K` line and the alarm chip.

## 6 · LAYOUT & SPACING
Shell stays: `grid-rows-[3.25rem_1fr_1.75rem]` over `grid-cols-[16rem_1fr_19rem]` (Binder · Dossier · Marginalia).

- Dossier reading column max-width **68ch (~740px)**. Wider only for tables/audit.
- Section breathing room **48px** between pane sections (current build at 24px is half a beat short).
- Modal padding **36 × 28px**, max-width **820px** (up from 768).
- Marginalia gets **24px outer gutter** + `--paper-vellum` ground (currently flush, currently same color).
- Binder gets a **2px vertical hairline of `--rule-edge`** at its inside edge — reads as a clipped paper edge.

## 7 · MOTION GRAMMAR (four named curves, each owning a job)
```
--ease-cascade: cubic-bezier(0.22, 0.86, 0.32, 1)   /*  420ms — pane lands  */
--ease-lift:    cubic-bezier(0.20, 0.80, 0.20, 1)   /*  220ms — hover lift  */
--ease-glide:   cubic-bezier(0.45, 0.05, 0.20, 1)   /*  380ms — tab underline */
--ease-reveal:  cubic-bezier(0.22, 0.86, 0.32, 1)   /* 1200ms, 200ms in — brass */
```
**Forbidden:** spring physics, parallax, scroll-jank, hero gradients, page transitions, anything beyond 600ms except `brass-reveal`. Reduced motion → all 0ms; cascade → opacity-only; brass → final state instantly; sweep-bar → static dotted hairline.

## 8 · COMPONENT INVENTORY (existing → diagnosis → ship)

**Masthead (`Header`, page.tsx:1750)** — Replace the ⌘K *button-shaped well* with a single Courier line: `⌘K  search the binder` in `--graphite`, hover lifts to `--ink-jet`. Add a 24px-long, 12°-angled `--brass-hair` diagonal score at the right edge — the "stamp registration" mark. No tooltip, no purpose.

**Binder (left rail)** — Demote section headers to a single Courier line (`active · 4`). Each matter row gets a left 2px hairline gutter in `--rule` that becomes `--ink-jet` when selected. Hovered row: Courier `→` glyph fades in over 220ms. Active row's idle glyph: `‖` ("you are here").

**Dossier tabs** — Group by ceremony. **Primary** (facts · exhibits · draft · review) renders in serif at `--text-subhead`. **Auxiliary** (audit · binder · context · log) renders in `smcp` Courier, separated by 24px gap and a 1px vertical `--rule`. Active tab underline thickens to 1.5px (`tab-glide-track` exists, keep it).

**FactsPane (THE BIGGEST FIX)** — Currently 7 blocks at the same heading size. Three-tier rhythm:
- **Tier 1: Vital signs** — Investor + Enterprise + I-94 deadline countdown as a 3-column horizontal slab, 96px tall, cream paper, `--rhythm-7` top padding, 1.5px `--ink-jet` bottom border. **The day count uses `--text-display` (38.4px Fraunces) — `12 days`** — with `submit by 14 May 2026` in body sans below. Only place the day count gets ceremony.
- **Tier 2: Substance** — Investment + Source-of-Funds in two-column reading layout, 48px gap, each opens with `--text-subhead` (19.2px Fraunces 600). Provenance affordance: every `Field<T>` value, on hover (220ms `--ease-lift`), reveals a `--brass-hair` underscore + Courier popover `passport.pdf · p.2 · high`. **The hairline IS the icon.**
- **Tier 3: Ledger** — Operations + Spend, compact tabular, mono-dominant, `--text-meta`. Generated-artifacts MOVES OUT of FactsPane to Marginalia.
- Empty fields render as `[ — ]` graphite-soft mono italic. Hover → `intake →` link. Click → scrolls to Intake with row highlighted via `cascade-in`.

**Exhibits accordion (`document-inventory.tsx`)** — KILL the line-diagram fake-page thumbnails. Each thumbnail becomes a single hairline-bordered vellum rectangle, `aspect-[3/4]`, with `display_name` in `--text-meta` Fraunces top-left and page count in `--text-foot` Courier bottom-right. Hover: `--ease-lift` 1px translateY, hairline deepens. Tab letter (A–L) gets the only display ceremony in this pane: 36px Fraunces 400 in a 56px left-margin column, drop-cap.

**PreGenerationApproval modal (`pre-generation-approval.tsx`)** — Two-zone modal, not five homogeneous sections.
- **Zone 1** (top, on `--paper-cream`): "Decision" + "Implications" with `--text-subhead` Fraunces section labels. Editor's lede.
- **Zone 2** (below 1px `--rule`, on `--paper-recess`): "Risk register" + "Outline" + "Defensive" + "Authorities" with the existing `smcp` Courier labels. Technical apparatus.
- Footer single line: `attorney initials [____]   reject   approve & generate`. Initials input gets `--seal` 1px focus border (only `--seal` in this modal). Approve button: `--ink-jet` fill, paper text. Reject: hairline only.
- Cost line `≈ $0.420` in **Fraunces `--text-subhead`** — currency reads as deliberation, not metric.

**GeneratePanel (`generate-panel.tsx`) — SECOND BIGGEST FIX** — Currently four card-chrome `Group`s with three-column tile grids. Reads like Vercel. Replace with **four printed registers stacked vertically**: no card chrome, no border. Each section: `smcp` label, `--rule` hairline, list of generator rows. Each row: Fraunces `--text-subhead` label left, `--text-meta` graphite description, `--text-foot` Courier model+token estimate right (`Sonnet 4.6 · ~16K · ≈$0.30`). Hover: row's bottom-edge hairline thickens to 1.5px `--ink-jet` + Courier `→` at right edge. No transform, no fill. Group titles in Fraunces `--text-section` with count as superscript Courier (`Cover letter & exhibit index ³`). Recent-outputs article migrates to Marginalia.

**ConflictRegister / Reviewer** — Keep glyph + weight system (sev-1..5: `·`, `·`, `‡`, `‡`, `‡`). **Sev-5 alone earns `--seal`** for the glyph + 2px `--seal` left gutter on the row. While any sev≥4 unresolved: the masthead `⌘K search the binder` line is replaced by Courier `4 critical · resolve before submission` in `--seal`, no fill. Only chromatic alarm in the entire app, one line of mono.

**Marginalia (right rail) — UNCLAIMED REAL ESTATE** — Three editorial cards on `--paper-vellum`:
- Top: Clock & countdown — I-94 day count repeats here, deadline date, Courier `last admission 03 Mar 2026`. Intentional redundancy with FactsPane Tier 1.
- Middle: Recent outputs ledger (migrated from GeneratePanel). Last 3 approved artifacts: title in Fraunces `--text-meta` italic, timestamp + cost in Courier, hairline divider.
- Bottom: **Editor's note** — single state-aware Fraunces italic `--text-meta` line:
  - 0 PDFs: *"the desk is clear."*
  - ingest: *"reading the bundle."*
  - draft ready, review pending: *"the draft is on the desk; the auditor is sharpening her pencil."*
  - sev-5 unresolved: *"four flags. address them before signing."*

**Pipeline progress** — Keep `sweep-bar`. Add per-PDF mini ledger below: `max-h-[12rem]` overflow-scroll, one Courier line per PDF (`passport.pdf · ✓ identity · 2.1s`), newest entry slides in via `cascade-in` from bottom. Failed: `‡` glyph in `--seal`. Keep "praying to immigration gods" microcopy.

**Cover letter viewer (`DraftPane`)** — Replace blue `[Tab E.4]` links with Courier inline span in `--ink-2` + 1px `--sky-rule` hairline underline. Hover: hairline thickens to 1.5px `--ink-jet`; vellum popover (160 × 220 thumbnail) fades in 8px above (180ms opacity + translateY, `--ease-cascade`). `[CITE NEEDED]` / `[MISSING:phone]` get `--seal` underline + Courier suffix `· fix in intake`. Streaming cursor: single `▍` Courier block in `--ink-jet`, blinking 1.4s linear.

## 9 · STATE MACHINE
Empty (no matter) · Loading (first matter) · Loading (switching) · Ready · Error · Streaming draft · Sev≥4 unresolved · Submitted/Sealed. See `spec.md §7` for the full table; each state declares surface, heading, body, and motion.

## 10 · SURFACE RULES
- **Backgrounds:** `--paper-cream` is default, `--paper-vellum` is the dossier shell + marginalia, `--paper-recess` is recessed wells (modal apparatus zone, audit log).
- **Hairlines** carry hierarchy: `--rule` for default dividers, `--rule-strong` for active/hover, `--rule-edge` for page edges.
- **Hover** = hairline weight change OR 1px translateY (`lift-hover` exists), never fill change, never scale.
- **Selection** (binder rows, tabs) = hairline color change, never fill.
- **Focus-visible** = 1.5px `--ink-jet` outline, 2px offset (already correct in `globals.css`).
- **Approved + signed artifact** = wax-stamp in `--seal`, only chromatic moment on screen at that beat.

## 11 · VOICE & MICROCOPY
- **Lowercase Courier ceremonies** (`smcp`): never punctuated, no articles. `decision`, `risk register`, `authorities cited`, `signed`, `pending counsel`, `awaiting auditor`.
- **Sentence-case body**: full sentences, periods. Em-dash earned. **No exclamation marks anywhere.**
- **Editorial wit, sparingly.** Keep `praying to immigration gods · auditing draft against the unified facts`. Add: extracting → *"reading every page like the partner who has to defend it."* drafting → *"composing in the firm's voice."* reviewing → *"the auditor is comparing the draft line by line. she is unimpressed by default."* sealed → *"signed, sealed. nothing left to do but submit."*
- **Forbidden:** AI-powered, smart, intelligent, automatically, in real-time, seamless, leverage, optimize, streamline, "we", "our", "your". Atelier addresses Serra as a colleague, not a customer.

## 12 · GAME-TIER POLISH (the seven touches)
1. **Ambient brass score** in masthead right edge — drifts 0.3px every 6s on `grainDrift`. The page is breathing, not frozen.
2. **`brass-reveal` under any computed value** — when cover letter renders auto-derived `total_committed_usd`, a 1.2s left-to-right brass hairline draws under the figure. Not on user-entered values.
3. **Diagonal grain drift on dossier shell** — already exists (`grainDrift` 18s linear infinite). Extend to FactsPane Tier 1.
4. **Tab underline glide** — already exists. Apply to new primary/auxiliary split.
5. **Cascade-in on pane lands** — already exists. 60ms stagger across FactsPane blocks and ConflictRegister rows.
6. **Editor's note in Marginalia** — state-aware Fraunces italic, max two lines, never an exclamation.
7. **Wax-stamp on signed artifacts** — 36 × 36 oxblood `--seal` round, upper-right of artifact card, attorney initials in 11px Courier weight 700 paper-color centered. Renders once with 280ms scale-from-0.7 + opacity, then static.

## 13 · ANTI-PATTERNS
- ❌ Blue links anywhere
- ❌ Filled buttons except the modal's `approve & generate`
- ❌ Multi-color severity ramp
- ❌ Drop shadows above 6px blur
- ❌ Card chrome on the GeneratePanel
- ❌ Decorative line-diagram thumbnails
- ❌ Spring physics, parallax, scroll-triggered animation, hero gradients
- ❌ Emojis except `※`, `‡`, `▍`, `→`, `‖`
- ❌ Uppercase headlines (smcp is for labels, not headlines)
- ❌ "AI" / "automatic" / "smart" copy
- ❌ Sage / sky as fill colors
- ❌ Dropdowns with chevron icons (use `›` Courier)
- ❌ Toggles with sliders (use Courier `[ x ]` / `[ · ]`)
- ❌ A second chromatic accent. **One. Inked. Seal.**

## 14 · TECH & CONSTRAINTS
- Next.js 16, Tailwind v4, `@theme` ground truth in `globals.css`.
- Electron desktop only; min-width 1280, target 1440 (13" MBP) → 2560 (27" iMac). No mobile breakpoint.
- Fraunces via `next/font`. Courier New is system-installed.
- localStorage namespace `akalan:*:v1:*`.
- `prefers-reduced-motion` honored.
- Keyboard: `Esc` (modal), `⌘K` (binder search — currently dead, wire it), `g` then `f/e/d/r` (primary tabs).
- Read `node_modules/next/dist/docs/` before any new Next pattern (per `AGENTS.md`).

## 15 · SUCCESS CRITERIA
1. Serra lands on the empty state and recognizes Atelier as **a tool made by someone who has read a cover letter at 2 a.m.**
2. The I-94 day count is answerable in <1 second from any pane.
3. The PreGenerationApproval modal reads in two ceremonies; the eye lands on cost + decision before risk register.
4. No screen contains more than one chromatic moment, and that moment is always sev-5, an attorney signature, or the masthead alarm.
5. GeneratePanel and FactsPane feel like the same product — both editorial registers under hairlines, neither a card grid.
6. Marginalia is alive — clock, recent outputs, editor's note — glanced at like a desk lamp.
7. A reviewer who has never seen Aesop, Kinfolk, or Monocle can still tell within 5 seconds that this product respects the attorney's silence.
