# prompt.md — Atelier · Archival Craft

> Paste this into a fresh Claude. It is a design-build brief, not a code spec. Reference `spec.md` for tokens; `moodboard.md` for visual anchors. Execute it; don't second-guess it.

---

## 1. One-line vision

A senior partner's **bound case book at 7pm**: foxed cream paper, India-ink type, oxblood cloth at the spine, a forest-green ribbon between the pages where this matter is open. Atelier is not an app surface — it is a working volume in a private library.

## 2. Context

Atelier is the AI paralegal of Akalan Immigration, owned and operated by attorney Serra Yildirim. Electron desktop app (Next.js 16 + Tailwind 4), 13" MBP through 27" iMac. It ingests E-2 / EB-1A / EB-1B / EB-1C folders (60–900 PDFs), classifies them into 12 lettered exhibit tabs (A–L) and 26 doc-types, extracts a structured `caseFacts` object with provenance per leaf, drafts cover letter / exhibit list / I-129 / declarations / NoIDs, then audits drafts against 13 deterministic gates emitting severity-1-to-5 conflicts. Sev 4–5 blocks submission.

The IA is correct. The aesthetic is the problem — current surface drifts editorial-modernist (Studio Lin, Inkwell, *The Gentlewoman*). This redesign moves it to **legal-craft archival**: bound casebook, bar-association letterhead, the desk of a partner whose grandfather practised at the same firm. Heavier than editorial. More solemn. Slower.

Audience is Serra alone at v1, scaling to 2–5 attorneys by EOY 2026. No clients. No opposing counsel. No marketing. Don't over-explain anything.

## 3. References (11 — see `moodboard.md` for full citations)

Palette / paper-stock anchors
- **Cassell & Company bound volumes (1907–1917)** — cream board + oxblood seal at the head-band.
- **Yale University Press / Foundation Press casebook spines** — oxblood cloth, India-ink foil stamping, foxing on the fore-edge.
- **Cravath letterhead engraving plate (mid-1990s)** — bone-black ink on Crane's Crest 32lb, deep impression, top rule 1.5pt.

Typography anchors
- **Hoefler & Co. *Pairings* specimen** — serif body / display serif / mono label triad calibrated for legal documents.
- ***Cambridge Law Journal*, CUP, 1988** — Plantin body, justified, hyphens auto, 10/13 setting on a 26-pica measure.
- **Bringhurst, *Elements of Typographic Style* (3rd ed., Hartley & Marks)** — page proportions, hanging punctuation, drop folio convention.
- **The 1990 Bluebook 15th edition** — small-caps for case names, Courier for citation strings, hairline above footnotes.

Layout / motion / craft anchors
- **Smythe-sewn bound case books (Foundation Press, 2010s)** — head-band, tail-band, ribbon marker, foliated page numbers.
- **Pina Zangaro Machina presentation portfolio** — book cloth + bookbinder's tape + screw-post hardware as material register.
- **Letterpress impression on Crane's Lettra 110C cotton stock** — visible bite, slightly inked rule, no glow.
- ***WSJ* "What's News" rail** — left-rail typographic index of the day's matter list, ranked by weight not chrome.

Anti-references (refuse to drift toward these)
- Notion / Linear / Vercel — pill-rounded `2xl` cards, soft shadows, "command bar." We have no cards. We have ruled stationery.
- Westlaw / LexisNexis chrome — democratic blue, dropdown-as-everything. We borrow their density and reject their visual register completely.
- Cursor / Perplexity / Claude.ai — typewriter "thinking…" loaders, ✨ icons, streaming-text fade-from-blur. Atelier is not an AI app; it is a paralegal that happens to use AI.
- *The Gentlewoman* / *Apartamento* / Inkwell — italic kicker-ledes, 64pt mid-page swooning serifs. Editorial. Designer A's territory; not ours.

## 4. Palette

Five paper stops, four ink stops, one oxblood seal, one forest ribbon, one raw-umber footnote ink. **Total: ten chromatic values, used with restraint.** No gradient is ever displayed except the brass-rule reveal under the matter masthead and the indeterminate sweep-bar.

```css
/* Paper — foxed cream, calibrated to feel like a 50-year-old library
   volume under a 3000K green-shaded desk lamp. Warmer than Designer A's
   #FAF8F3 by ~2 points on green/yellow. */
--paper-foxed:    #F2EAD8;   /* base sheet — fore-edge of an old casebook */
--paper-recess:   #E8DFC8;   /* recessed: section heads, footnote bands */
--paper-2:        #DED2B5;   /* table zebra, drag-active overlay */
--paper-deep:     #C9B98E;   /* foxed margin, only behind page numbers */
--vellum:         #F7EFDB;   /* drafts pane only — perceptibly warmer */

/* Ink — India-ink jet, faintly cool. The traditional rotring Indian-ink
   black, not warm sepia. Body copy lives at --ink-2 not --ink to match
   1980s Cambridge Plantin printing weight. */
--ink:            #15140E;   /* headlines, masthead, chapter rules */
--ink-2:          #2A271E;   /* body text — Plantin printed weight */
--graphite:       #5C5648;   /* labels, marginalia, citation strings */
--graphite-soft:  #8A8270;   /* drop folio, foxing, decorative-only */

/* The two earned chromatic marks. */
--seal-oxblood:   #6E1A1A;   /* dispositive flags (sev 4–5), spine band,
                                 the matter-typed glyph at the masthead.
                                 Used 4–6 times per page maximum. */
--ribbon-forest:  #28432B;   /* "the matter is open here" — active tab
                                 underline, single ribbon down the dossier
                                 left edge, "ready" status hairline. */

/* Footnote / citation ink — raw umber, not graphite. Cooler than --paper
   warmer than --ink. Used only for inline FAM / 8 CFR / USCIS PM cites. */
--ink-umber:      #5A3F1E;

/* Hairlines — load-bearing structural element. */
--rule:           rgba(21, 20, 14, 0.10);
--rule-strong:    rgba(21, 20, 14, 0.32);
--rule-ink:       rgba(21, 20, 14, 0.85);   /* page-head rule, chapter break */
```

Ratio law: oxblood is reserved. A clean dossier shows zero oxblood. The spine band, the matter-type glyph, and the dispositive sev-5 row are the only places it appears. Forest ribbon is used twice per screen at most: the active tab underline and the open-here marker on the matter list.

## 5. Typography

Three faces. One justified body. One display serif at masthead only. Courier New as the clerical voice — non-negotiable.

```css
--font-serif-body:   "Plantin MT Pro", "Plantin", "Iowan Old Style",
                     "Hoefler Text", Georgia, "Times New Roman", serif;
--font-display:      "Garamond Premier Pro", "Adobe Garamond Pro",
                     "Garamond", "EB Garamond", "Iowan Old Style", serif;
--font-mono:         "Courier New", "Courier", ui-monospace, monospace;
--font-bridge-sans:  "Söhne", "Inter", -apple-system, system-ui, sans-serif;
                     /* Bridge sans is used **only** for status pills and
                        button labels where a serif would read as twee.
                        Body copy never goes through this stack. */
```

**Type scale.** Eight stops. The masthead is the only place display Garamond appears at hero size; everything else lives in Plantin body or Courier label. All numerical surfaces use tabular figures.

```
--text-masthead:   3.6rem  / 1.05  / -0.012em  Garamond Premier 400 italic small-caps
                                                /* matter masthead only — once per dossier */
--text-folio:      2.0rem  / 1.10  / -0.005em  Garamond Premier 400
                                                /* drop folio (page number) on the dossier shell */
--text-chapter:    1.5rem  / 1.20  / -0.005em  Plantin 500
                                                /* section heads — Investor / Enterprise / Source of Funds */
--text-title:      1.125rem/ 1.35  / 0          Plantin 600
                                                /* card titles, exhibit tab titles */
--text-body:       0.9375rem/1.55  / 0          Plantin 400
                                                /* reading copy — facts panel, draft pane */
--text-meta:       0.8125rem/1.50  / 0.005em    Plantin 400
                                                /* secondary inline, provenance sub-line */
--text-label:      0.6875rem/1.40  / 0.16em     Courier New 700 small-caps
                                                /* labels, status pills, FAM cite strings */
--text-cite:       0.6875rem/1.45  / 0.04em     Courier New 600
                                                /* inline FAM / 8 CFR / USCIS PM citations,
                                                   color: --ink-umber */
```

Three further rules.

- **Justified body, hyphens auto, 26-pica measure.** Cover-letter pane sets `text-align: justify; hyphens: auto; max-inline-size: 28rem` to land on Cambridge Law Journal proportions. Hanging punctuation on quotes (`hanging-punctuation: first last`).
- **Drop folio.** Every dossier shell prints a Garamond drop folio at the foot — `0001` left, `0014` right — in `--graphite-soft`. Not load-bearing; mood-bearing. Tied to scroll position.
- **Inline citation register.** FAM / 8 CFR / USCIS PM citations render in `var(--font-mono)` at `--text-cite` in `--ink-umber`, with a 0.5px hairline rule under them on hover (1px solid `--ink-umber` for the keyboard-focused state). Click opens authority browser; modifier-click opens the source PDF.

## 6. Layout & spacing

The window is a **bound dossier laid open**. Three columns from left to right: left rail = matter list (the WSJ "What's News" register), middle = the open page (facts, exhibits, draft, review, audit, log — selected via tabs), right rail = marginalia (provenance trail, conflict glyphs, generate actions).

```
| 280px matter rail | 1fr open page (max 980px gutter) | 320px marginalia |
```

Gutter convention. Every column has a 32px outer gutter and a 24px inner gutter. The center column is bounded by a 1px `--rule` on each side to read as the open spread; outside that, paper extends to the window edges. The brass-rule reveal under the masthead is the only animated rule.

Spacing scale (Bringhurst-derived, 4px base, 1.5× rhythm).

```
--space-1:  4px   /* badge inner */
--space-2:  8px   /* hairline-to-text */
--space-3:  12px  /* form row */
--space-4:  16px  /* default rhythm */
--space-5:  24px  /* paragraph rhythm */
--space-6:  32px  /* gutter */
--space-7:  48px  /* chapter break */
--space-8:  72px  /* page break */
--space-9:  120px /* full-page silence */
```

Vertical rhythm. Body line-height 1.55 over a 21.5px baseline. Section heads sit on a 24px baseline; chapters on 32px. Never break the rhythm with a 17px or 19px gap. Empty states get 120px of silence above the drop cap.

## 7. Motion grammar

The app moves like a leather-bound book. **Slow. Considered. Never elastic.** No spring. No bounce. No scroll-triggered hero animation. Every motion follows one of four named curves.

```css
--ease-page-turn:   cubic-bezier(0.25, 0.10, 0.25, 1.00);  /* 380ms — page swap, tab change */
--ease-ribbon:      cubic-bezier(0.45, 0.05, 0.20, 1.00);  /* 520ms — ribbon glide on tab indicator */
--ease-ink-soak:    cubic-bezier(0.40, 0.00, 0.20, 1.00);  /* 220ms — fact reveal, hairline draw */
--ease-impression:  cubic-bezier(0.20, 0.00, 0.10, 1.00);  /* 140ms — button press, paper recess */
```

Six recipes — drop each into the named element exactly.

1. **Page turn (tab change).** `opacity 0 → 1, translateY +6px → 0, duration 380ms, --ease-page-turn`. No horizontal slide; this is a recto-verso swap, not a swipe.
2. **Ribbon glide.** Active tab underline is a 2px `--ribbon-forest` rule positioned via `--tab-x / --tab-w` custom props. Glides 520ms `--ease-ribbon`. Reduced motion: instant snap, no fade.
3. **Brass-rule reveal.** The 1px hairline under the matter masthead reveals 1200ms `--ease-ink-soak`, scaleX 0 → 1 from left origin, on first mount only. Re-renders do not replay.
4. **Ink soak (fact reveal).** When the ingest pipeline emits a new fact onto the page, opacity 0 → 1 with letter-spacing 0.01em → 0 over 420ms `--ease-ink-soak`. Stagger 55ms per row, max 12 rows then snap.
5. **Paper recess (button press).** Buttons translate y +1px and inset-shadow `0 1px 0 rgba(21,20,14,0.06) inset` on `:active`, 140ms `--ease-impression`. Letterpress bite, not Material ripple.
6. **Indeterminate sweep.** Loading bar is a 2px hairline with a 60%-wide raw-umber gradient drifting left-to-right at 1.6s linear infinite. The gradient is `--ink-umber` 0% / `--seal-oxblood` 50% / `--ink-umber` 100%, alpha capped at 0.55. No multi-color rainbow. No rotating spinner — Atelier never spins.

Idle motion: **ambient grain drift.** The paper-grain pattern drifts diagonally 60px every 18s linear infinite. Imperceptible at any single frame but the screen never reads as frozen. This is the only ambient motion. Sage-pulse, glow, parallax, all banned.

Reduced motion: cut every animation duration to 0 except the brass-rule reveal (kept at 400ms — typographic, not decorative).

## 8. Component inventory

Twelve elements. Each named for the bookbinder's term, then mapped to the React component it replaces.

1. **Masthead** (`MatterMasthead`) — Garamond italic small-caps matter name + Courier matter ID + drop folio + brass-rule reveal. Replaces the current top header.
2. **Spine** (`MatterRail`) — left 280px column. Stack of matter cards, each ranked by I-94 days remaining ascending. Active matter shows a 4px `--ribbon-forest` ribbon down its left edge.
3. **Recto** (`DossierBody`) — center 1fr column, the open page. Hosts six tabs: Facts, Exhibits, Draft, Review, Audit, Log. Tab nav is a single horizontal hairline with a forest ribbon glide.
4. **Marginalia** (`MarginRail`) — right 320px column. Provenance for the focused fact, conflict glyphs for the focused exhibit, generate-action stack for the focused draft. Updates on selection only.
5. **Plantin folio** (`FactsPanel`) — Bringhurst-style definition list. Term in Plantin 600, value in Plantin 400, provenance sub-line in Courier `--text-meta` `--graphite`. Hover a value: the source filename + page number underlines in `--ink-umber`.
6. **A–L tabs** (`ExhibitsAccordion`) — 12 lettered tabs, single-column ToC: letter (Plantin 600 28pt) · title (Plantin 500 16pt) · doc count (Courier 11pt drop-tracked). Hairline-ruled. No icons. The convention IS the icon.
7. **Cite-bar** (`AuthorityCiteCheck`) — inline ribbon under any draft. Lists each `[Tab E.4]` reference inline-mono in `--ink-umber`; clicking opens the PDF.
8. **Conflict register** (`ConflictRegister`) — register table styled like the front-matter of a casebook. Severity carried by glyph weight: `·` (1–2), `‡` (3), `‡‡` (4), `‡‡‡` (5). Sev 5 row is the only oxblood appearance allowed in the register; the rest is monochrome.
9. **Approval modal** (`PreGenerationApprovalModal`) — full-bleed overlay set to 90vh, paper-foxed background, centered max-width 720px. Roman numerals (I., II., III.) in Courier in the left margin gutter for each section. Footer: Courier initials field + paper-recess buttons.
10. **Ingest progress** (`LoadingProgress`) — typographic ledger. Each PDF gets a one-line entry: filename (Courier 11pt) → ⟶ doc-type (Plantin 500 12pt) · page count (drop-tracked). Phase head in Garamond italic 18pt. No bar, no spinner. The sweep-bar is the only kinetic element, and it sits under the phase head, not next to each row.
11. **Generate panel** (`GeneratePanel`) — four ruled groups (Cover & list / Declarations / Forms / NoIDs). Each row is a single hairline-ruled definition pair: generator name (Plantin 600) · model + token + cost (Courier `--text-cite`).
12. **Detail modal** (`PdfDetailModal`) — bound spread metaphor: left half is the PDF iframe (paper-foxed background behind the iframe so its white edge reads as a tipped-in plate), right half is structured rich-extract panels. 1px `--rule-strong` between halves.

Each component documents its idle / focus / hover / generating / generated / failed states in `spec.md`.

## 9. State machine

Five canonical states per surface. Every screen must answer all five; missing states are bugs.

1. **First-run / empty matter list.** Drop cap "S." in Garamond 96pt. Single line: "Drop a folder. The dossier opens itself." 120px above and below. No illustration. No CTA.
2. **Ingest running.** Sweep-bar under the phase head. Per-PDF rows append in Courier with 60ms stagger. Cancel control sits in the marginalia rail as a Courier label, not a button: `cancel · esc`.
3. **Dossier open.** All six tabs available. Active tab carries the forest ribbon. Marginalia rail reflects current selection.
4. **Conflict block.** Sev-4 or sev-5 conflict present. Approval modal's "approve & generate" button is disabled, label changes to `dispositive — resolve in audit` (Courier label, not red — the oxblood register row is the alarm).
5. **Submission ready.** Drop folio gains a forest-ribbon underline. Bottom-right: `ready for filing — initial to seal` in Plantin italic.

State-aware microcopy lives in §11.

## 10. Surface rules

Eight rules. Each is a single sentence and is non-negotiable.

1. There are no cards. There are ruled paragraphs and hairlined columns.
2. There are no rounded corners. Every surface is a 0-radius rectangle. The only curves are the conic sweep-bar (banned anyway) and Garamond's letterforms.
3. There are no drop shadows except the 1px paper-recess inset on `:active`. No `box-shadow: 0 4px 12px rgba(0,0,0,0.1)`.
4. Color is reserved. Oxblood marks dispositive risk (sev 4–5) and the spine; forest marks the open-here ribbon and the ready-state hairline; raw-umber marks citations. Everything else is paper or ink.
5. Hairlines are the load-bearing structural element. A panel without a hairline has no business being a panel.
6. Tabular figures everywhere there is a number. `font-variant-numeric: tabular-nums` on table, code, kbd, .tnum, .font-mono.
7. Hanging punctuation everywhere there is body text. `hanging-punctuation: first last allow-end`.
8. Paper-grain is alive. The 18s diagonal grain drift runs always except in `prefers-reduced-motion`.

## 11. Voice & microcopy

Atelier is laconic and self-aware. Lawyer-tone, never bot-tone. Lower-case for clerical labels, sentence-case for everything else. Em-dashes earned. No exclamation marks anywhere. No emoji.

| Surface | Use this | Not this |
|---|---|---|
| Empty matter list | drop a folder. the dossier opens itself. | Welcome to Atelier! |
| Ingest first phase | reading the deposit | Loading documents |
| Ingest mid phase | classifying — 14 of 47 | Processing 14/47 |
| Ingest closing phase | praying to immigration gods · auditing draft against the unified facts | Finalizing |
| Empty exhibit tab | nothing filed under this tab yet | No documents. |
| Generate idle | preview · approve · generate | Generate Cover Letter |
| Generate running | drafting — kept warm in the background | Generating... |
| Generated artifact | drafted at 17:14 — initial to seal | Generated successfully |
| Sev-5 row | dispositive — submission blocked | Critical error |
| Approval cost | ≈ $0.30 | Total cost: $0.30 USD |
| Footer / drop folio | atelier · vol. one · folio 0014 | Page 14 of 30 |

The "praying to immigration gods" string ships as-is. It is the existing tone and it is correct.

## 12. Game-tier polish (six required)

Pick all six. Each is mapped to a specific element.

1. **Foliated drop folio that increments on scroll.** Every 100vh of scroll inside the dossier the right-foot folio ticks one number. Garamond 32pt, `--graphite-soft`. Imperceptible work, deeply felt.
2. **Brass-rule reveal under the masthead on first mount.** 1200ms scaleX 0→1 from left origin. Sells the volume opening.
3. **Ribbon-marker on the active matter.** 4px `--ribbon-forest` rule down the left edge of the active matter card in the spine. When you switch matters, the ribbon glides to the new card 520ms `--ease-ribbon`. The ink-soak fact reveal in the dossier body cross-fades 380ms behind it.
4. **Ambient paper-grain drift.** 18s linear infinite diagonal drift on the dossier shell only — not the matter rail, not the marginalia. Runs always except `prefers-reduced-motion`.
5. **Cite-as-footnote on hover.** Inline `[Tab E.4]` references in the draft pane render in Courier `--text-cite` `--ink-umber`. Hover: 0.5px hairline rule appears below; a Plantin italic preview of the exhibit's `display_name` lifts into the marginalia rail at 220ms `--ease-ink-soak`. No popover.
6. **Letterpress bite on every primary button.** `:active` translateY +1px + inset shadow 1px `--ink @ 6%`. 140ms `--ease-impression`. The button feels printed, not pressed.

Easter eggs (one each, optional but encouraged):
- The Atelier sigil in the masthead is `⁂` (asterism). On hover, it rotates 0deg → 22.5deg over 320ms. No tooltip.
- The footer drop folio reads `vol. one · folio 0014` and ticks. On Friday after 17:00 local, the suffix reads `vol. one · folio 0014 · happy hour`.

## 13. Anti-patterns (refuse these)

Twelve. Each banned for a specific reason.

1. **Rounded `2xl` cards with soft drop shadows.** Notion / Linear surface. We are not consumer SaaS.
2. **Pill-shaped status badges with brand-colored backgrounds (`bg-emerald-500`).** Status carries by font weight + paper recess + hairline border. Color is for risk and ribbons, not state.
3. **Sage / mint / pastel anywhere.** This is Designer A's territory. Designer B does not use sage.
4. **Two accent colors used at equal weight.** Oxblood and forest are not equals. Oxblood is reserved for sev-4/5; forest is reserved for ribbon. They never appear together inside one component.
5. **Spinning loaders.** Atelier never spins. Indeterminate work uses the sweep-bar; per-PDF work appends rows.
6. **Streaming-text typewriter cursor blink.** Cursor / Perplexity tic. Drafts arrive with the ink-soak reveal per paragraph, not per character.
7. **Hover lift > 1px translate or > 0.04 alpha shadow.** Editorial restraint. The paper rises a hair, not a millimeter.
8. **Body copy in Courier.** Courier is the clerical voice — labels, citations, filenames, dates. Body is Plantin.
9. **Sentence-case section heads.** Section heads earn small-caps in Garamond italic. "Investor" reads as "INVESTOR" in 1.5rem Plantin 500 with `font-variant: small-caps`.
10. **Icons as decoration.** No icons in the matter list, the exhibit tabs, or the masthead. The lettered tabs ARE the icon. The single SVG permitted is a hairline atelier sigil at 12px.
11. **Animated severity color.** Sev-5 oxblood does not pulse. It does not glow. It does not breathe. It is set type, not a notification.
12. **Marketing-site full-bleed hero on the empty state.** No hero image. No tagline beyond "drop a folder. the dossier opens itself." 120px of silence is the hero.

## 14. Tech & constraints

- Next.js 16 + Tailwind 4 (existing). All tokens go through Tailwind 4 `@theme` so existing `paper-recess` / `bg-paper-2` utilities re-route to the new palette without touching component JSX.
- Electron desktop, 1280px to 2560px. No mobile. No responsive breakpoint below 1280px.
- Plantin MT Pro / Garamond Premier Pro via `next/font/local` (license required — substitute Plantin substitute "Source Serif 4 Display" + "EB Garamond" if Serra opts not to license; spec.md flags both stacks).
- Courier New stays. Already there. Do not propose a substitute — non-negotiable.
- Performance budget: first paint < 600ms cold, tab switch < 80ms. The page-turn animation runs after paint, not during.
- Accessibility: WCAG AA on every surface. Oxblood `#6E1A1A` on `--paper-foxed` `#F2EAD8` is contrast 7.1 — passes AAA. Forest `#28432B` on `--paper-foxed` is 8.6 — passes AAA. Graphite `#5C5648` on paper is 5.4 — passes AA for body, fails AA-large for label use, so labels carry a 600 weight to compensate.
- Reduced motion: every animation but the brass-rule reveal goes to 0ms. Brass-rule remains because it is typographic, not decorative.
- Print stylesheet: bonus deliverable. Set every panel to `@media print` with `--paper-foxed` → `#FFFFFF`, all hairlines to 0.5pt black, oxblood retained for sev-5. Atelier should print as a real legal memo.

## 15. Success criteria

Eight tests. Pass all eight.

1. A senior partner who has not seen the app guesses, within ten seconds, that it is a legal tool — not a finance tool, not an editorial site, not an AI chatbot.
2. The ingest progress reads as a typographic ledger, not a progress bar.
3. The matter masthead, when freshly mounted, sells the page-opening with the brass-rule reveal — Serra notices it on first run, ignores it on the hundredth.
4. Severity carries by glyph weight at any zoom level. Even at 50% browser zoom, sev-5 is unambiguous without the oxblood being legible.
5. The cover-letter pane sets in justified Plantin at 28rem measure with hyphens auto, and reads like a Cambridge Law Journal article when printed at 100%.
6. The conflict register, on a clean dossier, shows the line `no conflicts on register` in Plantin italic at `--text-body`. No "✓" glyph, no green tick. The absence of register entries is the success state.
7. The 12 exhibit tabs render without a single SVG icon and remain instantly distinguishable.
8. Two senior immigration attorneys, shown the app side-by-side with Westlaw and a Notion legal workspace, identify Atelier as "the one that looks like an actual law firm built it." Westlaw will be called "dated;" Notion will be called "for the marketing team."

---

End of brief. Reference `spec.md` for tokens; `moodboard.md` for visual anchors; build straight from this prompt.
