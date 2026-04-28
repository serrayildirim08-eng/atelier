# Concistenc — at-a-glance spec (v1, 2026-04-28)

Companion to `01-design-prompt.md`. Use this as the lookup sheet during implementation. Numbers are load-bearing; do not improvise.

---

## Locked decisions

1. Strict monochrome. No chromatic accent ever.
2. One serif: **Fraunces** (Undercase Type, free / OFL via Google Fonts). Variable font; lock axes `opsz` per size, `SOFT=0`, `WONK=0` for the attorney-grade tone. Fallback chain: Iowan Old Style → Hoefler Text → Apple Garamond → Georgia. Backup if Fraunces feels too distinctive: EB Garamond (also free). Backup if budget opens later: Lyon Display (Commercial Type, $325).
3. Three skeletons broken: Money → vertical timeline; Conflicts → banded paragraph flow; Citations → diff-style annotated view.

---

## Palette (final, no chromatic axis)

| Token | Hex | Role |
|---|---|---|
| `--color-paper` | `#FAFAFA` | default ground |
| `--color-paper-2` | `#F0F0F0` | recessed surfaces |
| `--color-paper-3` | `#E5E5E5` | hovered/selected ground |
| `--color-paper-deep` | `#D4D4D4` | depressed key, struck-through gutter wash |
| `--color-ink` | `#0A0A0A` | primary text, hero, severe markers |
| `--color-ink-2` | `#1F1F1F` | secondary text, source quotes |
| `--color-graphite` | `#404040` | tertiary text, captions |
| `--color-graphite-soft` | `#595959` | placeholders, "not on file" |
| `--color-rule` | `rgba(10,10,10,0.10)` | default 1px hairline |
| `--color-rule-strong` | `rgba(10,10,10,0.32)` | hover, active, key separators |

**Kill from globals.css:** `--color-rubric`, `--color-rubric-soft`, `--color-ochre`, `--color-verdant`, `--color-seal`. **Kill from page.tsx:** inline `#15803D / #A16207 / #B91C1C` at lines 2094–2096 and 2405–2414, plus all `text-rubric / text-ochre / border-rubric/60` references.

---

## Type stack

```
--font-display: "Fraunces", "Iowan Old Style", "Hoefler Text", "Apple Garamond", Georgia, "Times New Roman", serif;
--font-body:    -apple-system, "Helvetica Neue", "Inter", system-ui, sans-serif;
--font-mono:    ui-monospace, "SF Mono", "Berkeley Mono", Menlo, monospace;
```

## Type scale (8 tokens)

| Token | Size | Family | Weight | Tracking | Line-height |
|---|---|---|---|---|---|
| `--text-stunt` | 96px (6rem) | display | 400 | -0.025em | 0.95 |
| `--text-hero` | 64px (4rem) | display | 400 | -0.020em | 1.02 |
| `--text-display` | 38.4px (2.4rem) | display | 400 | -0.012em | 1.08 |
| `--text-section` | 24px (1.5rem) | display | 400 | -0.005em | 1.15 |
| `--text-title` | 16.8px (1.05rem) | body | 600 | -0.005em | 1.35 |
| `--text-lede` | 16px (1rem) | body | 500 | 0 | 1.55 |
| `--text-body` | 15px (0.9375rem) | body | 500 | 0 | 1.55 |
| `--text-meta` | 13px (0.8125rem) | body | 500 | 0.005em | 1.45 |
| `--text-label` | 11.5px (0.72rem) | mono | 600 | 0.10em | 1.0 |

New tokens vs existing: `--text-stunt`, `--text-hero`, `--text-section`. The first two are net-new; `--text-section` previously collapsed onto `--text-title`, which is why the dashboard felt structurally identical pane-to-pane.

## Italic budget

One role: source quotes inside `<details>` provenance blocks, rendered as Fraunces italic, weight 400, 13px, `opsz: 14`, `SOFT: 0`, color `--color-ink-2`, 1.5px left border `--color-rule-strong`, padding-left 14px. Nowhere else.

## Severity in monochrome (Conflicts tab specifically)

| Severity | Left-border | Type weight | Type size | Left-padding |
|---|---|---|---|---|
| DISPOSITIVE | 2.5px solid ink | 700 | 24px | 24px |
| MATERIAL | 1.5px solid ink | 600 | 17px | 18px |
| MINOR | 1px rule-strong | 500 | 15px | 14px |
| CLERICAL | 1px rule | 500 | 13px | 12px |
| COSMETIC | none | 400 | 13px | 0 |

## Confidence labels

`HIGH` weight 700 ink · `MEDIUM` weight 600 graphite · `LOW` weight 500 graphite-soft + line-through. All in mono 11.5px tracking 0.10em.

---

## Spacing scale

`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 / 144 px`. Tailwind: `1 / 2 / 3 / 4 / 6 / 8 / 12 / 16 / 24 / 36`.

## Hero breathing

| Hero | Size | Above | Below |
|---|---|---|---|
| Empty-state stunt | 96px | 144px | 144px |
| Matter masthead | 64px | 96px | 64px |
| Pane section header | 24px | 48px | 24px |

---

## Motion

| Curve | Cubic-bezier | Use |
|---|---|---|
| `--ease-paper` | `cubic-bezier(0.2, 0.0, 0.2, 1)` | tab/page transitions, hovers, focus |
| `--ease-rule` | `cubic-bezier(0.16, 1, 0.3, 1)` | first-mount fade-up reveals |
| `--ease-loading` | `cubic-bezier(0.65, 0, 0.35, 1)` | loading-screen percent breath |

| Element | Duration | Curve | Properties |
|---|---|---|---|
| Tab/page transition | 180ms | `--ease-paper` | opacity only |
| Provenance disclosure | 200ms | `--ease-paper` | opacity + 4px translateY |
| Pane first-mount | 280ms | `--ease-rule` | opacity + 6px translateY |
| Loading percent breath | 1200ms loop | `--ease-loading` | scale 1.000→1.005→1.000, opacity 0.96→1→0.96 |
| Hover (color) | 0ms | — | instant |
| Hover (border-color) | 120ms | `--ease-paper` | border-color only |

`@media (prefers-reduced-motion: reduce)` collapses everything to opacity-only at 120ms.

---

## Layout grids

- Home: `[binder 320px][dossier 1fr][marginalia 280px]`. Hairline `border-r` between columns.
- Matter dashboard: full-width masthead → tabstrip → pane (48px top, 96px bottom, 48px horizontal).
- Pane internal grid: 12-col, 24px gutter; hero spans 8 desktop / 12 tablet.

---

## New components (file paths)

| Component | Path | Replaces |
|---|---|---|
| `<MoneyTimeline />` | `app/components/money-timeline.tsx` | `app/components/sof-chain-table.tsx` |
| `<ConflictBands />` | `app/components/conflict-bands.tsx` | `app/components/conflict-register.tsx` |
| `<CitationDiff />` | `app/components/citation-diff.tsx` | `app/components/authority-cite-check.tsx` |

Old components stay in tree for one cycle in case rollback is needed; their imports are removed from `app/matter/[id]/page.tsx` (lines 124–129).

## MoneyTimeline structure (lite)

- Vertical 1px rule at left:32px, color `--color-rule-strong`, starts 8px below first marker, ends 8px below last.
- 8×8 square markers on the rule. Outlined = pending, filled = settled.
- Each leg: smcp label (ORIGIN / WIRE / ESCROW / ENTERPRISE) → 17px title (account + last-4) → 13px graphite meta → 13px ink-2 amount tabular-mono right-aligned in 14ch column.
- 48px gap between legs.
- No card wrapper. No borders. Just the spine.

## ConflictBands structure (lite)

- Bands in order: DISPOSITIVE → MATERIAL → MINOR → CLERICAL → COSMETIC.
- 11.5px smcp band label, color graphite, margin-bottom 8px.
- Each conflict is a paragraph block, severity styling per table.
- 16px between conflicts in same band; 96px between bands.

## CitationDiff structure (lite)

- Two-column grid: `[40px gutter][1fr content]`.
- Gutter: hairline rule for allowlist hits; mono `OFF` label for off-allowlist; mono `AAO` for AAO-routed.
- Content: 13px meta gray cite + 15px body 65ch context paragraph.
- Off-allowlist gets strikethrough on the cite token + `--color-paper-deep` 8px wash, no border.
- 32px between citations.

---

## Killers (line numbers)

| Item | Location | Action |
|---|---|---|
| `.drop-cap` | `globals.css:95–104` | delete |
| `.dinkus` + pseudos | `globals.css:107–122` | delete |
| `atelier.` italic period | `app/page.tsx:874` | replace with `concistenc` (sans, weight 600, no italic) |
| `⌘K search the binder` bubble | `app/page.tsx:878–881` | delete or collapse to 24×24 `⌘K` square |
| `⁂` glyph | `app/components/case-overview-card.tsx:80` | delete |
| `E·II / EB·IA / EB·IB / EB·IC` | `app/page.tsx:269–272, 1932–1935, 4383–4407` | replace with `E-2 / EB-1A / EB-1B / EB-1C` |
| Chromatic SEV hex | `app/page.tsx:2094–2096, 2405–2414` | replace with monochrome severity-mass system |
| `var(--color-rubric, #b8392e)` | `app/components/loading-progress.tsx:449` | replace with `rgba(10,10,10,0.40)` |
| Tab letters A–L at 17px bold | grep `Tabs A — L` | reduce to 11.5px smcp gutter labels or delete |

---

## Voice replacements

| Before | After |
|---|---|
| `loading…` | `reading the dossier` |
| `not extracted` | `not on file` |
| `no exhibits in this section yet` | `no exhibits filed under this tab` |
| `Drop a dossier here, or paste a URL` | `Drop a dossier here. Or paste a URL.` |

No exclamation marks anywhere. No emoji. Sentence-case for everything except smcp labels.

---

## Fraunces licensing & axis lock

- **Vendor:** Undercase Type (Phaedra Charles · David Berlow · Nina Stössinger). Free, OFL.
- **Source:** Google Fonts (`https://fonts.google.com/specimen/Fraunces`) or self-host the woff2 from the OFL repo.
- **Variable axes:**
  - `wght`: 100–900 — use **300** (Light) for hero tiers, **400** for section, **500** italic for source quotes.
  - `opsz`: 9–144 — **lock** per size. 96px hero → `opsz: 144`. 64px hero → `opsz: 96`. 38/24px → `opsz: 36`. 13px italic → `opsz: 14`. Without locking, default opsz looks magazine-cute at hero.
  - `SOFT`: 0–100 — **lock at 0** (sharp terminals). >0 reads consumer-friendly, wrong register.
  - `WONK`: 0–1 — **lock at 0** (no quirky alts). 1 turns on `g`/`f`/`y` swashes that read whimsical.
- **CSS:**
  ```css
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,300..500,0,0;1,9..144,400..500,0,0&display=swap');
  ```
- **Fallback parity test:** before any merge, view all three hero tiers (96 / 64 / 38 px) with the Fraunces stylesheet disabled. Iowan Old Style → Hoefler Text must hold the design without breaking baselines or causing reflow > 4px. The codebase already smuggles Iowan in via the loading-progress component; that confirms the cascade works.

If Fraunces feels too distinctive even with axes locked, swap to **EB Garamond** (also free, OFL, more conservative Granjon-style) — one line in `globals.css`: change `--font-display` to `"EB Garamond", "Iowan Old Style", ...`.

If budget later opens for paid: **Lyon Display** by Kai Bernau (Commercial Type, $325) is the original recommendation — closer institutional-literary register than any free option.

---

## File budget

| File | Δ lines | Net |
|---|---|---|
| `app/globals.css` | +60 | new tokens + ease curves + Fraunces `@import`, minus drop-cap/dinkus |
| `app/page.tsx` | −150 | wordmark, ⌘K bubble, ⁂, E·II glyphs, chromatic hex, italic deflation |
| `app/matter/[id]/page.tsx` | −80 | tab strip simplification, hero scale-up, italic deflation, killer replacements |
| `app/components/money-timeline.tsx` | +120 | new |
| `app/components/conflict-bands.tsx` | +120 | new |
| `app/components/citation-diff.tsx` | +120 | new |
| `app/components/loading-progress.tsx` | −5 | replace `var(--color-rubric, ...)` literal |
| Net | ~+185 | |

---

## Acceptance checklist

- [ ] Zero chromatic hex codes outside the grayscale ramp.
- [ ] Zero italic outside `<details>` blockquotes.
- [ ] One bordered surface per region.
- [ ] Largest type ≥ 64px on populated matter, ≥ 96px on empty state.
- [ ] Money pane reads as a timeline at first glance.
- [ ] Conflicts pane reads as a memo at first glance.
- [ ] Citations pane reads as a marked-up brief at first glance.
- [ ] No `E·II / EB·IA / EB·IB / EB·IC` anywhere.
- [ ] No `atelier.` wordmark.
- [ ] No drop-cap CSS, no dinkus CSS.
- [ ] Loading-screen progress hairline is monochrome.
- [ ] All severity rendered without color.
