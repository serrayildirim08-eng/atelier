# spec.md — Atelier · Archival Craft

> Implementation tokens. Reference these from JSX as Tailwind 4 utilities or directly via CSS custom properties. The `@theme` block goes verbatim into `app/globals.css`.

---

## 1. Tailwind 4 `@theme` block

```css
@theme {
  /* PAPER — five stops, foxed cream */
  --color-paper-foxed:   #F2EAD8;
  --color-paper-recess:  #E8DFC8;
  --color-paper-2:       #DED2B5;
  --color-paper-deep:    #C9B98E;
  --color-vellum:        #F7EFDB;

  /* INK — four stops, India-ink jet, faintly cool */
  --color-ink:           #15140E;
  --color-ink-2:         #2A271E;
  --color-graphite:      #5C5648;
  --color-graphite-soft: #8A8270;

  /* THE TWO EARNED MARKS */
  --color-seal:          #6E1A1A;   /* oxblood — sev 4–5 only, spine band */
  --color-ribbon:        #28432B;   /* forest — open-here ribbon, ready hairline */

  /* CITATION INK */
  --color-ink-umber:     #5A3F1E;

  /* HAIRLINES */
  --color-rule:          rgba(21, 20, 14, 0.10);
  --color-rule-strong:   rgba(21, 20, 14, 0.32);
  --color-rule-ink:      rgba(21, 20, 14, 0.85);

  /* TYPE STACKS */
  --font-serif-body:     "Plantin MT Pro", "Plantin", "Iowan Old Style",
                         "Hoefler Text", Georgia, "Times New Roman", serif;
  --font-display:        "Garamond Premier Pro", "Adobe Garamond Pro",
                         "Garamond", "EB Garamond", "Iowan Old Style", serif;
  --font-mono:           "Courier New", "Courier", ui-monospace, monospace;
  --font-bridge:         "Söhne", "Inter", -apple-system, system-ui, sans-serif;

  /* TYPE SCALE — eight stops */
  --text-masthead:       3.6rem;     /* 57.6px — masthead, once per dossier */
  --text-folio:          2rem;       /* 32px   — drop folio number */
  --text-chapter:        1.5rem;     /* 24px   — section heads */
  --text-title:          1.125rem;   /* 18px   — card / tab titles */
  --text-body:           0.9375rem;  /* 15px   — Plantin reading copy */
  --text-meta:           0.8125rem;  /* 13px   — provenance, sub-line */
  --text-label:          0.6875rem;  /* 11px   — Courier small-caps */
  --text-cite:           0.6875rem;  /* 11px   — citation strings, umber */

  /* SPACING — Bringhurst rhythm, 4px base, 1.5× */
  --space-1:  0.25rem;   /*  4px */
  --space-2:  0.5rem;    /*  8px */
  --space-3:  0.75rem;   /* 12px */
  --space-4:  1rem;      /* 16px */
  --space-5:  1.5rem;    /* 24px */
  --space-6:  2rem;      /* 32px */
  --space-7:  3rem;      /* 48px */
  --space-8:  4.5rem;    /* 72px */
  --space-9:  7.5rem;    /* 120px */

  /* MOTION CURVES — four named */
  --ease-page-turn:    cubic-bezier(0.25, 0.10, 0.25, 1.00);
  --ease-ribbon:       cubic-bezier(0.45, 0.05, 0.20, 1.00);
  --ease-ink-soak:     cubic-bezier(0.40, 0.00, 0.20, 1.00);
  --ease-impression:   cubic-bezier(0.20, 0.00, 0.10, 1.00);

  /* MOTION DURATIONS */
  --dur-impression:    140ms;
  --dur-ink-soak:      220ms;
  --dur-page-turn:     380ms;
  --dur-ribbon:        520ms;
  --dur-brass-rule:    1200ms;
  --dur-grain-drift:   18s;
}
```

## 2. Palette role table

| Token                | Hex      | Role                                                | Allowed surfaces                                   |
|----------------------|----------|-----------------------------------------------------|----------------------------------------------------|
| `--paper-foxed`      | `#F2EAD8`| Base sheet                                          | `body`, dossier shell                              |
| `--paper-recess`     | `#E8DFC8`| Recessed plane                                      | section heads, footnote bands, table head          |
| `--paper-2`          | `#DED2B5`| Zebra / hover bed                                   | table zebra, drag overlay, hover row               |
| `--paper-deep`       | `#C9B98E`| Foxed margin                                        | only behind drop folio + page-edge fox             |
| `--vellum`           | `#F7EFDB`| Drafts pane only                                    | DraftPane background — perceptibly warmer          |
| `--ink`              | `#15140E`| Headlines, masthead, chapter rules                  | Garamond / Plantin display tier                    |
| `--ink-2`            | `#2A271E`| Body copy                                           | Plantin 400 reading copy                           |
| `--graphite`         | `#5C5648`| Labels, marginalia, body provenance text            | Courier labels, Plantin meta                       |
| `--graphite-soft`    | `#8A8270`| Drop folio, decorative footers, foxing              | drop folio only                                    |
| `--seal` (oxblood)   | `#6E1A1A`| **Reserved.** Sev-4/5 conflict register row, spine band, matter-typed glyph at masthead | At most three uses per visible page |
| `--ribbon` (forest)  | `#28432B`| Open-here marker, active tab underline, ready-state hairline | At most two uses per visible page         |
| `--ink-umber`        | `#5A3F1E`| Inline FAM / 8 CFR / USCIS PM citations             | Courier inline cites only                          |

Contrast verification (against `--paper-foxed`):

| Pair                              | Ratio | WCAG       |
|-----------------------------------|-------|------------|
| `--ink` on paper                  | 14.4  | AAA        |
| `--ink-2` on paper                | 11.7  | AAA        |
| `--graphite` on paper             | 5.4   | AA body, AA-large fail — labels MUST be 600+ |
| `--graphite-soft` on paper        | 3.1   | decorative only — never load-bearing       |
| `--seal` on paper                 | 7.1   | AAA        |
| `--ribbon` on paper               | 8.6   | AAA        |
| `--ink-umber` on paper            | 7.4   | AAA        |
| `--paper-foxed` on `--ink`        | 14.4  | inverse AAA — used on letterpress button hover |

## 3. Type scale, weight, tracking

| Token            | Size      | Line     | Tracking | Family              | Weight | Use                                                |
|------------------|-----------|----------|----------|---------------------|--------|----------------------------------------------------|
| `--text-masthead`| 3.6rem    | 1.05     | -0.012em | display Garamond    | 400 italic small-caps | matter masthead, once per dossier                  |
| `--text-folio`   | 2rem      | 1.10     | -0.005em | display Garamond    | 400    | drop folio (page-number)                           |
| `--text-chapter` | 1.5rem    | 1.20     | -0.005em | serif body Plantin  | 500 small-caps | section heads (Investor / Enterprise / SOF)       |
| `--text-title`   | 1.125rem  | 1.35     | 0        | serif body Plantin  | 600    | card titles, tab titles                            |
| `--text-body`    | 0.9375rem | 1.55     | 0        | serif body Plantin  | 400    | reading copy                                       |
| `--text-meta`    | 0.8125rem | 1.50     | 0.005em  | serif body Plantin  | 400    | provenance sub-line                                |
| `--text-label`   | 0.6875rem | 1.40     | 0.16em   | mono Courier New    | 700 small-caps | labels, status pills, doc-type stamps            |
| `--text-cite`    | 0.6875rem | 1.45     | 0.04em   | mono Courier New    | 600    | inline FAM / 8 CFR / USCIS PM cites, color: umber  |

Body justification rules:

```css
.dossier-body, .draft-pane {
  text-align: justify;
  hyphens: auto;
  hanging-punctuation: first last allow-end;
  max-inline-size: 28rem;
  font-feature-settings: "kern" 1, "liga" 1, "calt" 1;
  font-variant-numeric: tabular-nums;
  font-optical-sizing: auto;
}
```

## 4. Motion library

| Recipe                | Duration | Curve              | Properties                                        | Reduced motion          |
|-----------------------|----------|--------------------|---------------------------------------------------|-------------------------|
| Page turn (tab swap)  | 380ms    | `--ease-page-turn` | `opacity 0→1, translateY 6px→0`                   | 0ms                     |
| Ribbon glide          | 520ms    | `--ease-ribbon`    | `transform translateX(--tab-x), width(--tab-w)`   | 0ms snap                |
| Brass-rule reveal     | 1200ms   | `--ease-ink-soak`  | `transform scaleX(0→1) origin: left`, mount only  | 400ms (kept)            |
| Ink-soak fact reveal  | 420ms    | `--ease-ink-soak`  | `opacity 0→1, letter-spacing 0.01em→0`, 55ms stagger | 0ms                  |
| Paper recess (active) | 140ms    | `--ease-impression`| `translateY 0→1, inset-shadow 0→1px ink @ 6%`     | instant                 |
| Sweep-bar             | 1600ms   | `linear`           | gradient `background-position -120% → 220%`        | hidden                  |
| Grain drift           | 18000ms  | `linear`           | `background-position 0,0 → 60px,60px`              | paused                  |
| Sigil hover           | 320ms    | `--ease-ink-soak`  | `transform rotate(0deg → 22.5deg)`                | 0ms                     |

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0ms !important;
  }
  .brass-reveal { animation-duration: 400ms !important; }
}
```

## 5. Component inventory + state matrix

Each component must implement every state. `—` means "not applicable".

### 5.1 `MatterMasthead`
| State          | Treatment                                                                                              |
|----------------|--------------------------------------------------------------------------------------------------------|
| First mount    | Garamond italic small-caps matter name fades in 380ms; brass-rule reveals 1200ms.                      |
| Idle           | Drop folio at right foot. Sigil `⁂` static.                                                            |
| Hover (sigil)  | Sigil rotates 0→22.5deg over 320ms `--ease-ink-soak`.                                                  |
| Sev-4/5 active | Spine band oxblood ribbon down the masthead's left edge (4px wide × full bleed).                       |
| Reduced motion | Brass-rule retained at 400ms; sigil instant.                                                           |

### 5.2 `MatterRail` (left 280px)
| State          | Treatment                                                                                              |
|----------------|--------------------------------------------------------------------------------------------------------|
| Idle           | Stack of matter rows ranked by I-94 days asc. Each row: matter name (Plantin 600), case-type glyph (Courier 700), days-remaining (Courier 700 right-aligned). |
| Active matter  | 4px `--ribbon` rule down the row's left edge, full row height.                                          |
| Hover          | Row background to `--paper-2`; no shift.                                                               |
| Days < 14      | Days-remaining cell in `--seal`. The only oxblood in the rail.                                          |
| Empty list     | "drop a folder. the dossier opens itself." centred at 120px above and below.                            |

### 5.3 `DossierBody` (center, 1fr, max 980px)
| State          | Treatment                                                                                              |
|----------------|--------------------------------------------------------------------------------------------------------|
| Idle           | Six-tab nav (Facts / Exhibits / Draft / Review / Audit / Log) with Plantin 500 tab labels and a forest-ribbon underline.        |
| Tab change     | Page turn 380ms — opacity 0→1 + translateY 6→0.                                                        |
| Loading        | Sweep-bar under tab nav, otherwise content area shows skeleton hairlines (Plantin lorem grey-rules).   |
| Empty tab      | "nothing on this tab yet" Plantin italic in `--graphite-soft` at center.                               |
| Error          | Single ruled paragraph in Plantin italic; Courier `error · code` label above. No icon.                 |

### 5.4 `MarginRail` (right 320px)
| State          | Treatment                                                                                              |
|----------------|--------------------------------------------------------------------------------------------------------|
| Idle           | "—" (em-dash) in `--graphite-soft` if no selection.                                                    |
| Fact selected  | Provenance lifts in: Courier filename, Plantin page number, Plantin source-quote in italic.             |
| Cite hovered   | The cite's display-name lifts into the rail in Plantin italic; 220ms `--ease-ink-soak`.                 |
| Generate ready | Stack of generate actions (Cover letter / Exhibit list / etc.) as ruled rows, no buttons.              |

### 5.5 `FactsPanel` (Plantin folio)
| State          | Treatment                                                                                              |
|----------------|--------------------------------------------------------------------------------------------------------|
| Idle           | Definition list. Term Plantin 600. Value Plantin 400. Provenance Courier `--text-meta` `--graphite`.   |
| Missing value  | Em-dash `—` in `--graphite-soft` italic. Below it, Courier label `intake →` linking to intake block.   |
| Edited value   | Right margin glyph: a single Courier `*` in `--ink-umber` denoting "manually corrected by attorney".   |
| Hover (term)   | Underline term 0.5px `--ink-umber`; provenance sub-line shifts to `--ink-2` from `--graphite`.          |
| Conflict       | Sev-4/5 fact gets a oxblood Courier `‡‡‡` glyph in the right margin; tooltip via the marginalia rail.   |

### 5.6 `ExhibitsAccordion` (A–L tabs)
| State          | Treatment                                                                                              |
|----------------|--------------------------------------------------------------------------------------------------------|
| Closed         | Single hairline-ruled row: letter (Plantin 700 28pt) · title (Plantin 500 16pt) · doc count (Courier 11pt). |
| Open           | Row expands; thumbnails grid (3:4 ratio, paper-recess background, no shadow).                          |
| Empty tab      | "nothing filed under this tab yet" Plantin italic.                                                     |
| Smart-gap      | Tab heads gain a Courier label `[ missing — CV expected ]` in `--ink-umber` at right.                   |
| Drag-active    | Row background `--paper-2`; 1px `--rule-strong` border.                                                 |

### 5.7 `ConflictRegister`
| State          | Treatment                                                                                              |
|----------------|--------------------------------------------------------------------------------------------------------|
| Empty          | Plantin italic: "no conflicts on register. re-run reviewer after every fact edit."                     |
| Sev 1–2        | Glyph `·` (single bullet); body in `--graphite`; Courier label `cosmetic` / `clerical`.                 |
| Sev 3          | Glyph `‡`; body in `--ink-2`; Courier label `minor`.                                                    |
| Sev 4          | Glyph `‡‡`; body in `--ink`; Courier label `material`; row hairline `--rule-strong`.                    |
| Sev 5          | Glyph `‡‡‡`; body in `--ink`; Courier label in `--seal`; row left edge: 2px oxblood rule.               |
| Conflict block | Approval modal shows: "dispositive — submission blocked. resolve in audit before generating."          |

### 5.8 `PreGenerationApprovalModal`
| State          | Treatment                                                                                              |
|----------------|--------------------------------------------------------------------------------------------------------|
| Loading        | "building preview…" Plantin italic; sweep-bar under header.                                             |
| Ready          | Roman-numeral sections (I. decision, II. risk register, III. structural outline, IV. defensive, V. authorities, VI. implications). Roman in Courier 700 at left margin gutter. |
| Conflict block | Approve button disabled; label changes to `dispositive — resolve in audit`. Footer hairline turns oxblood. |
| Error          | "error · code: <code>" Courier label; Plantin paragraph below.                                         |
| Submitting     | Approve button label → `committing — keep window open` (Plantin italic).                                |

### 5.9 `LoadingProgress`
| State          | Treatment                                                                                              |
|----------------|--------------------------------------------------------------------------------------------------------|
| Phase running  | Phase head in Garamond italic 18pt; sweep-bar underneath.                                              |
| Per-PDF stream | Single-line ledger entries: filename Courier 11pt → ⟶ doc-type Plantin 500 12pt · `02p` Courier drop-tracked. 60ms stagger. |
| Phase complete | Phase head turns from `--ink-2` to `--graphite`; sweep-bar replaced by 1px static rule.                 |
| Error in phase | Phase head retains `--ink`; per-PDF row gains `‡` glyph in `--seal` at right.                           |
| Cancel         | Courier label `cancel · esc` in marginalia rail. No button surface.                                    |

### 5.10 `GeneratePanel`
| State          | Treatment                                                                                              |
|----------------|--------------------------------------------------------------------------------------------------------|
| Idle           | Four ruled groups. Each row: generator name (Plantin 600) · model+token+cost (Courier `--text-cite`).  |
| Hover row      | Background `--paper-2`; right-edge Courier label `→ preview · approve · generate`.                      |
| Generating     | Row gains a sweep-bar at its base 2px hairline; Plantin italic `drafting — kept warm in the background`.|
| Generated      | Row gains drop-tracked timestamp in Courier `--text-cite` `--graphite`; oxblood seal glyph at right means flagged. |
| Failed         | Row gains Courier label `error · retry?` in `--ink` (not oxblood — failures are clerical, not dispositive). |

### 5.11 `PdfDetailModal`
| State          | Treatment                                                                                              |
|----------------|--------------------------------------------------------------------------------------------------------|
| Open           | Bound spread: left half iframe; right half rich-extract panels. 1px `--rule-strong` between halves.    |
| Hover field    | Field underlines 0.5px `--ink-umber`; provenance lifts in.                                             |
| No extract yet | Right half: "extraction pending — Sonnet has not finished aggregating." Plantin italic.                |
| Iframe error   | Replace iframe with Courier ledger: filename · pages · `error · code`.                                  |

### 5.12 `IntakeBlock`
| State          | Treatment                                                                                              |
|----------------|--------------------------------------------------------------------------------------------------------|
| Idle           | Form fields rendered as ruled rows: label (Courier `--text-label`) · input (Plantin 400 underline-only)|
| Required       | Required field gets a Courier `*` in `--ink-umber` at left margin gutter.                              |
| Auto-filled    | Field background `--vellum`; right margin Courier label `from passport, page 2`.                        |
| Manual edit    | Field gains Courier `*` at right margin (matches FactsPanel's "manually corrected" glyph).             |
| Saved          | "saved · 17:14" Courier `--text-cite` in `--graphite-soft` at row foot. No toast.                       |

## 6. Interaction contracts

- **Click vs cmd-click on a `[Tab E.4]` cite.** Click: opens the exhibit's `display_name` in the marginalia rail. Cmd-click: opens the source PDF in PdfDetailModal. Shift-click: copies the cite to clipboard, no UI feedback (the cite is already on the page).
- **Drag a folder onto the matter list.** Whole window goes to `--paper-2` for 220ms; a 1px `--rule-strong` border appears around the dossier shell; release fires ingest. No icon.
- **Approval modal escape.** Esc closes the modal IF not submitting. While submitting, esc shows Courier label "committing — keep window open" inline; second esc within 2s confirms cancel.
- **Hover an unfocused fact.** No reaction. The marginalia rail does NOT update on hover. Only on focus (click) does the rail load.

## 7. State machine (global)

```
[no matter]
   │  drop folder
   ▼
[ingesting]  (sweep-bar, per-PDF ledger)
   │  pipeline complete
   ▼
[dossier open]  (six tabs, default = facts)
   │  user requests generate
   ▼
[approval pending]  (modal, roman-numeral sections)
   │
   ├─ sev-4/5 present ───▶ [conflict block]  (button disabled, oxblood footer)
   │                          │  attorney resolves in audit tab
   │                          └▶ [approval pending]
   │
   ├─ approve ───▶ [generating]  (row sweep-bar, draft streams in)
   │                  │  draft complete
   │                  ▼
   │              [draft drafted]  (drafts pane populated, ribbon on tab)
   │                  │
   │                  └▶ [submission ready]  (drop folio gains ribbon)
   │
   └─ reject ───▶ [dossier open]  (no state change beyond audit log entry)
```

## 8. Accessibility

- WCAG AA on all surfaces. AAA on body / heads / sev-5.
- Focus ring: 1.5px solid `--ink` outline, 2px offset. The same on all focusables.
- Keyboard: `tab` moves through rail / tabs / body / margin rail in reading order. `j` / `k` move between matters in the rail. `?` opens the keymap (Courier ledger overlay).
- Screen reader: each conflict row reads `severity 5, dispositive, investment_amount_drift, contract vs I-129E`. The glyph is `aria-hidden`.
- `prefers-reduced-motion`: all animations 0ms except brass-rule (400ms typographic).
- Print: see §10.

## 9. Tech & constraints

- Next.js 16 + Tailwind 4. All tokens via `@theme`. No design-system library.
- `next/font/local` for Plantin MT Pro + Garamond Premier Pro (commercial licenses required). Fallback stack: Source Serif 4 Display + EB Garamond, both via Google Fonts. Set `font-display: swap` on both.
- Courier New stays. Already in stack. Do NOT propose JetBrains Mono / Plex Mono / Berkeley Mono — non-negotiable.
- Electron desktop, 1280–2560px. No mobile breakpoints.
- Performance: first paint < 600ms cold. Tab swap < 80ms. Page-turn animation runs after paint.
- Bundle: keep new fonts under 180KB combined (subset Latin Extended + small caps + lining figures + tabular-nums).
- React 19 + Tailwind 4: use `@theme` block above; do not use a `tailwind.config.ts` extension for these tokens.

## 10. Print stylesheet (bonus)

```css
@media print {
  :root {
    --color-paper-foxed: #FFFFFF;
    --color-paper-recess: #FFFFFF;
    --color-paper-2: #F4F4F4;
    --color-rule: rgba(0,0,0,0.20);
    --color-rule-strong: rgba(0,0,0,0.55);
  }
  .grain-drift, .sweep-bar, .ring-spin { display: none !important; }
  .dossier-body { max-inline-size: none; column-count: 1; }
  /* Sev-5 retained in oxblood; everything else collapses to black hairlines. */
  .conflict-row[data-severity="5"] { color: #6E1A1A; border-left-color: #6E1A1A; }
  .drop-folio { color: #000; }
}
```

---

End of spec.
