# Concistenc — moodboard (v1, 2026-04-28)

Eight named references, each grounded in a specific pattern with a one-line "what to learn." Anti-references at the bottom. The moodboard sits behind the prompt — when the redesign drifts, come back here.

---

## Palette + restraint

### 1. The Gentlewoman (web edition)
**URL:** https://www.thegentlewoman.co.uk
**What to learn:** how monochrome reads as *confidence*, not austerity. Hierarchy is carried entirely by size + spacing on a black-on-white ground; the signal is "we don't need color to tell you what matters." The "1/8 → 8/8" pacing of the carousel is the only moving thing on the page; everything else is still.
**Borrow:** the ratio of breathing-room to type. The voice register ("a confident, unhurried publication that trusts restraint and intellectual substance over visual spectacle"). The discipline of equal visual weight across sections.
**Don't borrow:** carousel pacing (we are not a magazine), fashion-editorial vocabulary, the navigation chrome.

### 2. Klim Type Foundry (own site)
**URL:** https://klim.co.nz
**What to learn:** how a serious typographer sets type at scale on screen, with the body in a clean sans (Söhne, Geograph) and the display in their own serifs (Tiempos, Söhne Mono for code). It's the canonical "system-sans body + serious-serif headline" reference — exactly the pairing we want.
**Borrow:** the discipline of treating the headline serif as a load-bearing component, never decorative. The hairline rule grid behind dense specimen pages.
**Don't borrow:** foundry-marketing flourishes — animated weight sliders, glyph carousels, marketing CTAs. We are an attorney's tool, not a foundry.

### 3. NYT Magazine 2026 redesign (Bichler)
**URL:** https://www.itsnicethat.com/features/gail-bichler-the-new-york-times-magazine-redesign-publication-spotlight-080426
**What to learn:** the redesign's thesis is *quiet anchoring*. Page furniture moved from bottom to top margins to free vertical space. Cheltenham Revival treated as the institutional headline, with "an italic that's more literary" — italic explicitly reserved for the moments where the prose calls for it, not as a hierarchy carrier. This is exactly the italic budget we want.
**Borrow:** the italic discipline. The "more vertical" treatment of artwork. The pacing of moving furniture up to free vertical breathing.
**Don't borrow:** the Cheltenham slab personality (wrong register for a private legal tool — slab-serif reads "newspaper of record," our register is "private workshop"). The seven-column grid (overkill for our surfaces).

---

## Type choice — Lyon Display

### 4. Commercial Type — Lyon specimen
**URL:** https://commercialtype.com/catalog/lyon
**What to learn:** Lyon Display is Granjon (1500s French Renaissance) reinterpreted by Kai Bernau. Sharp terminal serifs, calligraphic warmth in the italics, weight modulation that reads as institutional-literary at 64–96px. Five weights, italic per weight, full Latin/Cyrillic/Greek. $325 entry tier, perpetual desktop + web. *This is the chosen serif for the redesign.*
**Borrow:** Lyon Display Regular at 64px (matter hero) and Light at 96px (empty-state stunt). Italic Light at 13px in source-quote blockquotes.
**Don't borrow:** Lyon Text at body sizes — we keep system-sans for body. Lyon Fine at small sizes — overkill for our needs.

### 5. Klim — Tiempos Headline (backup serif)
**URL:** https://klim.co.nz/retail-fonts/tiempos-headline/
**What to learn:** Tiempos is Sowersby's modernized Times — built for newspaper economy and legibility, with separate Text/Headline/Fine cuts. Twelve styles, 300–900, italic per weight. If Lyon's license blocks, Tiempos Headline at Light or Regular is the drop-in replacement (one line in `globals.css`).
**Borrow:** if substituted, Tiempos Headline at weight 300 or 400 only — Bold and Black read newspaper-front-page, wrong register for a private workshop.
**Don't borrow:** Tiempos as a body face (we have system-sans). Headline at heavy weights (400+).

---

## Structure — the three broken skeletons

### 6. Stripe billing event timeline
**URL:** https://docs.stripe.com/billing/subscriptions/overview (and the Dashboard's subscription event view)
**What to learn:** the canonical vertical-timeline-of-money-flow pattern. Hairline vertical rule on the left, dotted/squared markers, time-stamped events flowing downward, monetary amounts in tabular-mono, no card wrappers, just the spine. Stripe got this right because they trusted the structural literalism — money moves through accounts over time, render that as time on a vertical axis, period.
**Borrow:** the structural literalism for the Money tab. The tabular-mono right-alignment for amounts. The way the spine starts and ends slightly inset from the markers.
**Don't borrow:** brand purple, marketing illustrations, gradient strokes, Atlas Inter (their system font) — we're sans/system-first not custom-sans.

### 7. GitHub PR diff view
**URL:** https://github.com/{any}/pull/{any}/files
**What to learn:** the gutter-and-content split for diff reviews. Hairline left rule marks unchanged, additions are flush, removals strike through with a colored wash. The reading model is "the gutter tells you the verdict, the content tells you the substance." Off-allowlist citations are the same shape: the gutter labels them, the content shows the prose.
**Borrow:** gutter-content split. Strikethrough on removed/struck tokens. Inline annotations rather than modal drawers. Hairline left-rule for "unchanged / in-allowlist."
**Don't borrow:** green/red coloring (we are monochrome — use weight + strikethrough + position instead). The +/- gutter sigils (we use mono OFF / AAO labels). The line-number gutter (legal cites don't have line numbers in this view).

### 8. The Atlantic / NYT op-ed banded essay
**URL:** https://www.theatlantic.com/magazine/ (any longform feature) and https://www.nytimes.com/section/opinion (op-eds)
**What to learn:** how an editor's report or banded essay separates sections with *negative space*, not boxes. Each band is a paragraph or run of paragraphs; the band label (or implicit shift) signals the move; the page reads top-to-bottom like prose. Atlantic features in particular use generous between-section gaps with no rules — the white space *is* the structure.
**Borrow:** 96px negative-space gap between severity bands in the Conflicts tab. Sentence-case section labels. The prose-flow reading model — conflicts as paragraphs, not as cards.
**Don't borrow:** drop caps (killed elsewhere), bylines, photo leads, magazine voice.

---

## Voice + tone

### 9. Bloomberg Terminal (the *idea*)
**URL:** https://www.bloomberg.com/professional/products/bloomberg-terminal/ (publicly visible spec sheets and screenshots)
**What to learn:** information density carries authority. The Terminal trusts the user with screens of data because the user is a professional who can read them; it never cushions data in pillows of whitespace inside cards. *That trust* is the lesson — not the green-on-black.
**Borrow:** the trust. Don't pad. Don't pillow. A legal product is a professional product; the attorney knows what she's looking at.
**Don't borrow:** the green-on-black palette, the chromatic alarms, the orange, the function-key chrome, the dense window-management UI. We are calm density, not aggressive density.

---

## Anti-references — do NOT look like

- **Notion templates** — pillowy rounded cards, drag handles everywhere, slash-command chrome.
- **Vercel marketing pages** — high-contrast hero gradients, aggressive type animation, "build for the edge" voice.
- **Stripe Atlas / Stripe Press** — Stripe is OK as a *structural* reference (timeline) but the marketing surfaces (Atlas, Press) are too startup-polished for our register.
- **Linear (the marketing site)** — Linear's product is fine but the marketing pages lean into a chromatic gradient personality we explicitly don't want.
- **Casetext / Westlaw** — these are legitimate legal-tech references, but their visual languages are 2008 enterprise-software dated. The lesson: don't look like 2008 legal software either. The lift is from the *editorial* references (Gentlewoman, Atlantic, NYT Magazine), not from existing legal SaaS.
- **Wellness apps** — anything with gentle blob illustrations, sage greens, "we're proud of you!" microcopy, streak counters.
- **Any product with a streaks/gamification system** — irreversible disqualification of register.
- **VOID-style ceramic/cream/sage** — adjacent project of the same user, but a completely different brief. Cream + sage + DM Serif Display is wrong for an attorney's binder. Strict ground here is paper-2 / jet, not warm cream.

---

## Self-score (rubric)

| Dimension | Score (0–5) | Note |
|---|---|---|
| 1. Emotional clarity | 5 | "leather-bound dossier opened on a quiet desk at 9 a.m." — physical-world simile, not adjective. |
| 2. Reference specificity | 5 | 8 references, each with URL + specific pattern + borrow/don't-borrow. |
| 3. Palette precision | 5 | Every value named, every role explicit, kill list with line numbers. |
| 4. Type specificity | 5 | 8 tokens with size/weight/tracking/line-height/family, italic budget reduced to one role. |
| 5. Motion detail | 4 | Three named curves with cubic-beziers and durations. Held back from springs deliberately (ADHD constraint); the motion section is *intentionally* small. |
| 6. Component state coverage | 5 | First-mount / loading / empty / populated / error / offline / edit per pane. |
| 7. Voice sharpness | 5 | Microcopy table with exact replacements. Lowercase, no exclamations, no emoji, sentence-case rule. |
| 8. Polish density | 5 | Five named details (hairline-not-flush, tabular-nums, sentence-case, sigil inset, square markers). |
| 9. Anti-pattern precision | 5 | Numbered kill-list with file paths and line numbers. |
| 10. Execution readiness | 5 | File paths, Δ-line budgets, fallback chain test, license cost, swap path for backup serif. |
| **Total** | **49 / 50** | |

The single point withheld is in motion: a richer motion library would push the polish, but the ADHD-friendly brief explicitly caps it. Trade accepted.
