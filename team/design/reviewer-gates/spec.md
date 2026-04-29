# Reviewer Panel — Gate Sonuçları Spec

**Status:** v1.0 · 2026-04-29
**Owner:** ui-designer
**Implements:** F2 (frontend-junior-1)
**Backend contract:** `reason/checker.ts` → `runFullReview()` returns `FullReviewResult { deterministic: GateRunResult[]; llm: ReviewReport }`
**DNA reference:** `team/design/_DNA.md` v1.0
**Companion files:** `moodboard.md`, `prototype.html`, `rationale.md`

---

## 0. Emotional thesis

> "Margin'a düşülmüş bir avukat notu — sayfa kenarındaki kalem işareti gibi. Alarm değil, dikkat çekme."

Bu panel iki tarafa hizmet eder: (1) **avukat hızlı tarayışla** (a) "case-fatal var mı?" (b) "neye odaklanmalıyım?" sorularına yanıt bulmalı; (2) bulduğu her finding **sayfa içinde nereye atıfta bulunduğunu** keskin gösterir (letter excerpt, facts value, authority cite).

## 1. Veri kaynağı (kanonik)

### 1.1 Deterministic gates

11 gate (E-2 için). Her biri:
- **Name** (string) — `ownership_volatility`, `co_petitioner_fund_circularity`, `unaccounted_sof_share`, `multi_round_rfe_escalation`, `b2_status_violation_signal`, `status_gap_pre_filing`, `material_change_in_response_to_uscis`, `external_evidence_contradiction_risk`, `develop_and_direct_role_authority_thin`, `five_year_horizon_marginal_failure`, `five_year_horizon_vs_business_plan_drift`
- **Outcome** ya:
  - `{ fired: true, severity: 4 | 5, finding: string, authority: string }` (örn. `"INA § 101(a)(15)(E)"`)
  - veya `{ fired: false, reason: 'not_applicable' | 'data_incomplete', note?: string }`

### 1.2 LLM ReviewReport

- `overall_assessment`: `'ready' | 'minor_revisions' | 'major_revisions' | 'not_ready'` — **VERDICT**
- `summary`: free-form paragraph (bir-iki cümle)
- `inconsistencies[]`: `{ severity: 'critical'|'major'|'minor', category: 'hallucination'|'contradicts_facts'|'internal_inconsistency', description, letter_excerpt, facts_value }`
- `missing_arguments[]`: `{ element, description, what_is_missing, suggestion }`
- `weak_spots[]`: `{ severity, element, description, rfe_risk, suggestion }`

### 1.3 Severity hiyerarşisi (görsel mapping — RENK DEĞİL)

DNA constraint: severity **renk taşımaz**. Ayrım:

| Severity | Origin | Visual treatment |
|---|---|---|
| **5** (dispositive / critical) | gate fired sev=5; LLM `severity: 'critical'` | font-weight 700 ink + 2px solid left rule + filled square sigil ▣ + smcp uppercase "DISPOSITIVE" lozenge |
| **4** (factual_material / major) | gate fired sev=4; LLM `severity: 'major'` | font-weight 600 ink + 1.5px left rule + open square sigil ▢ + smcp "MATERIAL" |
| **minor** | LLM `severity: 'minor'` | font-weight 500 graphite + hairline left rule + dot · sigil + smcp "MINOR" |
| **not_applicable / data_incomplete** | gate not fired | font-weight 500 graphite-soft + dotted left rule + em-dash "—" sigil + collapsed by default |

Rubric red (`#B8392E`) **tek istisna** (HITL stop-point): yalnız sev=5 fired-AND-uncontested gate'lerin sigil'ine ince bir kontur. Asla fill, asla satırın gövdesine.

## 2. Layout

### 2.1 Page structure (1440px viewport baseline)

```
┌─────────────────────────────────────────────────────────────┐
│  TopNav (return / matter id) — 48px                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Verdict masthead — 200–240px                                │
│  ─────────────                                               │
│  smcp "verdict"        |                                     │
│  Display title (Fraunces 38px, sentence-case)                │
│  "Major revisions before submission."                        │
│  lede summary (italic, max-w-prose, sky-deep accent line)    │
│                                                              │
├──────────────────────────────────────┬──────────────────────┤
│                                       │                      │
│  Letter / draft pane                  │  Findings rail       │
│  (paper, scroll, max-w-[64ch])        │  (cream surface,     │
│                                       │   sticky, max-w-     │
│  Inline marginalia: superscript       │   [22rem])           │
│  citation marks ⁂¹ ⁂² ⁂³  next to     │                      │
│  the offending line                   │  - Section: gates    │
│                                       │  - Section: incon-   │
│                                       │    sistencies        │
│                                       │  - Section: weak     │
│                                       │    spots             │
│                                       │  - Section: missing  │
│                                       │    arguments         │
│                                       │                      │
│  Default split: 64ch / rail 22rem    │  Filter chips:       │
│  Container: max-w-[1440px] mx-auto    │  [all][5][4][minor]  │
│                                       │                      │
└───────────────────────────────────────┴──────────────────────┘
```

**Alternative** (no draft loaded yet): findings rail centered, 60ch max-w. Draft pane kaybolur.

### 2.2 Verdict masthead

- Background: paper (no warm tint — verdict is the cold judgment)
- Padding: `px-16 pt-14 pb-10`
- Top: `<span class="smcp text-graphite-soft">verdict</span>` — quiet
- Title: Fraunces serif, `text-display` (38.4px), sentence-case, NO punctuation drama:
  - `'ready'` → "Ready to file."
  - `'minor_revisions'` → "Minor marks before filing."
  - `'major_revisions'` → "Major revisions before submission."
  - `'not_ready'` → "Not ready. Hold." (only verdict that gets the period-stop)
- Lede: italic, max-w-prose, body size, graphite. Optional sky-deep 1px left rule (provenance hint that this came from the model).
- Below lede: rollup counts in mono — `5 dispositive · 7 material · 3 minor · 2 not applicable`. NEVER use color in counts; weight only.

### 2.3 Letter / draft pane

- Single column reading. `font-body`, line-height 1.62, max-w-[64ch].
- Marginalia anchors: superscript glyph `⁂¹` (asterism + numeral, mono, smaller). Hover/click → scroll target finding in rail; rail item highlights with 2px ink left rule + sage-wash background for 1.4s.
- Highlighted excerpt (when finding selected from rail): the matched substring gets sky-wash (`bg-sky-wash`) + sky-deep 1px box-shadow inset on left edge. Subtle.

### 2.4 Findings rail

- Background: `cream` warm surface — distinguishes annotation territory from the text being annotated.
- Padding interior: `p-7`. Sticky on scroll.
- Section headers: `font-display-section` (Fraunces 24px) + dinkus separator above each section after the first.
  - Examples: "Gate findings", "Inconsistencies", "Weak spots", "Missing arguments"

#### 2.4.1 Filter chips

Above sections. Quiet pills, smcp text:

```
[ all 17 ] [ ▣ 5  dispositive 4 ] [ ▢ 4  material 7 ] [ · minor 3 ] [ na 3 ]
```

Active chip: `bg-ink text-paper`. Inactive: `border-rule text-graphite hover:border-ink`. Counts in mono tabular.

## 3. Finding card vocabulary

### 3.1 Severity 5 (dispositive)

```html
<article class="border-l-2 border-ink pl-5 pr-3 py-4 bg-cream-2">
  <header class="flex items-baseline gap-3 mb-2">
    <span class="font-mono text-label text-ink leading-none">▣</span>
    <span class="smcp text-ink font-bold">dispositive</span>
    <span class="text-meta text-graphite-soft font-mono tabular-nums">⁂1</span>
  </header>
  <h3 class="text-title font-bold text-ink leading-snug mb-1.5">
    Co-petitioner fund circularity
  </h3>
  <p class="text-body text-ink-2 leading-relaxed mb-3">
    Two of three SOF rows route through accounts owned by the petitioning
    entity itself. This is the textbook bootstrap problem under …
  </p>
  <footer class="grid gap-2">
    <div class="text-meta">
      <span class="smcp text-graphite-soft mr-2">authority</span>
      <span class="font-mono cite text-ink">9 FAM 402.9-6(B)(1)</span>
    </div>
    <div class="text-meta text-graphite italic">
      <span class="smcp text-graphite-soft not-italic mr-2">from facts</span>
      "Account ending ••••4471 — held by Treaty Co LLC, …"
    </div>
  </footer>
</article>
```

Visual thesis: heaviest type, square solid sigil, 2px ink rule, subtle cream-2 wash. **No red surface.** Authority cite in cite-mono uppercase tracking.

### 3.2 Severity 4 (material)

Same structure, but:
- left rule `border-l-[1.5px] border-ink-2`
- sigil `▢` (open square)
- smcp `material`
- font-weight `font-semibold` (not bold)
- background `bg-paper` (no cream-2 wash)

### 3.3 Minor

- left rule hairline `border-l border-rule-strong`
- sigil `·` (mono-rendered middle dot)
- smcp `minor` text-graphite
- title `font-medium` graphite, body italic
- collapsed-by-default behavior (see §5)

### 3.4 Not-applicable / data-incomplete

- left rule `border-l border-dashed border-rule`
- sigil `—` (em-dash, mono)
- smcp `not applicable` or `data incomplete`
- ALL text graphite-soft
- Always collapsed; no expand action; one-line teaser only

### 3.5 Inconsistencies (LLM, with letter_excerpt + facts_value)

Special two-column finding card. Severity treatment from §3.1–3.3 applies; the body shows:

```
┌───────────────────────────────────────┐
│ ▣ DISPOSITIVE        ⁂4               │
│ Hallucinated beneficiary alias        │
│                                       │
│ ┌──────────────┐ ┌──────────────────┐ │
│ │ in letter    │ │ in facts          │ │
│ │ "also known  │ │ aliases: [        │ │
│ │  as Mehmet…" │ │   "Mehmed", null  │ │
│ │              │ │ ]                 │ │
│ └──────────────┘ └──────────────────┘ │
│                                       │
│ category: hallucination               │
└───────────────────────────────────────┘
```

- Two parallel quote blocks, each with smcp gutter label ("in letter" / "in facts").
- Letter block: `bg-paper-2 border-l border-graphite-soft`
- Facts block: `bg-sky-wash border-l border-sky-deep`
- Both `font-mono text-meta italic`. Body labels in smcp.

### 3.6 Weak spots / Missing arguments

Same severity treatment, but body adds two distinct slots:

- For weak_spots: `rfe_risk` (smcp gutter "rfe risk" + body) and `suggestion` (smcp gutter "fix" + body). Suggestion block has sage-wash `bg-sage-wash` indicating "this is the prescribed strengthening."
- For missing_arguments: `what_is_missing` (smcp "missing") + `suggestion` (smcp "add", sage-wash).

## 4. Filter / sort behavior

- Default sort: severity desc → category (gate first, then inconsistency, then weak_spot, then missing_argument) → element-label asc.
- Filter chips toggle scope. Multi-select OR within severity, AND across categories.
- "all" chip resets to default.
- Empty filtered state: dinkus + "No findings of that grade." italic graphite.

## 5. State vocabulary (every component must define)

| State | Default | Hover | Focus | Active/expanded | Loading | Empty |
|---|---|---|---|---|---|---|
| Finding card sev 5/4 | as §3 | hairline rule shifts ink → graphite, 200ms ease-out | 1.5px ink outline 2px offset | none (always expanded) | — | — |
| Finding card minor | collapsed (title + sigil only) | hairline thickens | 1.5px ink outline | expanded reveals body + footer | — | "No minor findings." |
| NA card | collapsed permanently | hairline shifts 200ms | 1.5px ink outline | not expandable | — | hidden by default; toggle in filter chip |
| Filter chip | smcp graphite, border-rule | border-ink, text-ink | 1.5px ink outline | bg-ink text-paper | — | — |
| Verdict masthead | as §2.2 | — | — | — | shimmer text on title 1.4s while review streams | "No review yet. Run it." drop-cap intro |
| Letter pane marginalia anchor | mono sup, graphite | scale-105 ink | underline hairline | sage-deep ink + sage-wash bg flash 1.4s | — | hidden if no findings |

## 6. Motion specs

| Motion | Duration | Easing | Trigger |
|---|---|---|---|
| Card entry on initial load | stagger 40ms × index, fade-up 280ms | cubic-bezier(0.2, 0.8, 0.2, 1) | first paint |
| Marginalia → rail scroll | scrollIntoView({ behavior: 'smooth' }) capped 320ms | native | anchor click |
| Rail → letter scroll + flash | scroll 320ms, then sage-wash flash 1.4s, fade out 280ms | both ease-out | finding click |
| Filter chip toggle | bg/text crossfade 200ms | ease-out | click |
| Minor card expand | height auto via `<details>` (native), 240ms ease-out | native | click on summary |
| Verdict shimmer (loading) | 1.4s linear shimmer on title characters | linear | review streaming |

**No bounce. No slide-from-side > 6px. No scale > 1.04. No parallax.**

## 7. Accessibility

- Filter chips: `role="group" aria-label="filter findings by severity"`, each chip `<button aria-pressed>`.
- Marginalia anchors: `<a href="#finding-N">` with `aria-describedby` pointing to the rail card id.
- Sigil glyphs (▣ ▢ · — ⁂): `aria-hidden="true"`; severity carried by smcp text label which is exposed to AT.
- All severity states reach **WCAG AA contrast** at smcp size; sage-wash and sky-wash never carry information — purely mood.
- Keyboard nav: tab through chips → through findings → through marginalia. Arrow keys within chip group.
- `prefers-reduced-motion`: stagger entries → instantaneous; shimmer → static; smooth scroll → instant.

## 8. Edge cases

| Case | Behavior |
|---|---|
| All gates returned `not_applicable` | Hide gate section entirely. Show only LLM sections. Summary masthead may say "All deterministic gates passed." in lede. |
| LLM returned 0 findings, gates all clean | verdict='ready'. Masthead shows full ready treatment with empty-state drop-cap line: "The matter is clean. Re-read it once more, then file." |
| `data_incomplete` count > 3 | Verdict masthead adds smcp warning lozenge (cream-2 surface, 1.5px ink border) "review limited by missing facts" — clickable, scrolls to NA section. |
| Long finding (>4 lines body) | Truncate to 4 lines with "·  ·  ·" mid-text dinkus, full text on `<details>` expand. Title and footer always visible. |
| No draft uploaded | Letter pane replaced by drop-cap empty state: "Drop a draft to mark it." center column, no rail. |
| LLM request failed mid-review | Gates render normally; LLM section shows narrow card "The reviewer note will follow." + retry button (smcp `try again`, ink border). |
| Severity 5 fired AND draft has marginalia anchor | Rail card auto-scrolls into view on first paint; flashes sage-wash once. (Sole "auto-attention" pattern.) |

## 9. Microcopy

| String | Use |
|---|---|
| "verdict" | masthead label |
| "Ready to file." / "Minor marks before filing." / "Major revisions before submission." / "Not ready. Hold." | masthead title |
| "dispositive" / "material" / "minor" / "not applicable" | severity smcp |
| "from facts" / "in letter" / "from text" | provenance gutter labels |
| "authority" | citation gutter |
| "rfe risk" / "fix" | weak_spot gutter labels |
| "missing" / "add" | missing_argument gutter labels |
| "mark this for the attorney" | future bookmark CTA (D5) |
| "No findings of that grade." | empty filter |
| "review limited by missing facts" | data_incomplete warning |

**Yasak:** "Issue", "Error", "Warning", "Action Required", "Click to view", "View details", emojis, exclamation marks (except in "Hold." period as expressive period).

## 10. Hand-off checklist (frontend-junior-1)

- [ ] Read `_DNA.md` v1.0 §3 (palette), §6 (motion), §11 (HITL exception)
- [ ] Read `runFullReview` return type in `reason/checker.ts:996`
- [ ] Build `<FindingCard severity="5"|"4"|"minor"|"na" type="gate"|"inconsistency"|"weak_spot"|"missing_argument" />` as the central component
- [ ] Use Phosphor icons for return arrow (NOT ASCII `←`)
- [ ] Default-collapsed minor + NA cards via native `<details>` for free a11y
- [ ] Implement marginalia anchor → rail scroll + flash (320ms scroll, 1.4s fade flash)
- [ ] Verify in 1280px and 1440px viewports
- [ ] Verify `prefers-reduced-motion`
- [ ] Verify keyboard tab order and focus rings
- [ ] Pixel-check against `prototype.html` before declaring done

## 11. Out of scope (future)

- Inline draft editing (D5 task)
- Multi-reviewer collaboration / comment threads (post-MVP)
- "Mark for attorney" bookmark queue (D5)
- Diff view between two review runs (D8)
