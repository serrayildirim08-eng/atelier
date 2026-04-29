# Reviewer Panel — Rationale

**Status:** v1.0 · 2026-04-29
**Companion:** `spec.md`, `moodboard.md`, `prototype.html`

---

## Why this design, in one page.

The panel must do two contradictory things at once: **scream "case-fatal" loudly enough that an attorney cannot ignore it**, and **whisper "minor stylistic note" so quietly it never costs attention before it earns it**. Most reviewer UIs (Linear, Sentry, Datadog) solve this with color-coded severity dots — red for P0, amber for P1, etc. The DNA forbids this. So the entire design is a study in **how to carry severity hierarchy without a single hue**.

The answer is the **margin-note tradition**: a senior associate's red pen does not invent new colors as severity escalates; the same red ink simply gets *more presence* — heavier strokes, more frequent marks, larger marginalia, a circled paragraph. Severity is *typographic and ornamental*, not chromatic.

We mapped that tradition onto four severity tiers using three concurrent axes:

| Axis | Severity 5 | Severity 4 | Minor | NA |
|---|---|---|---|---|
| **Type weight** | bold (700) | semibold (600) | medium (500) | medium (500) |
| **Left rule** | 2px solid ink | 1.5px solid ink-2 | 1px hairline rule-strong | 1px dashed rule |
| **Sigil glyph** | ▣ filled square | ▢ open square | · middle dot | — em-dash |

Three independent axes, all monochrome, give us four discriminable levels — and crucially, **the levels remain discriminable in grayscale, in low-vision, and on a printed page**. Color blindness is not a special case; it's the baseline.

## Why two columns?

The old "review report" pattern (Linear, GitHub Files Changed) is single-column with inline comments. That works for code but not for legal prose: the **letter** is the artifact under review, and the letter must remain readable as continuous prose. So we keep the letter in its own reading column (max-w-[64ch] for editorial comfort) and put the findings in a sticky right rail. Marginalia anchors (`⁂¹` `⁂²`) connect the two without cluttering the letter.

The right rail is **cream**, not paper. This is the single largest mood decision in the spec, and it's deliberate: cream marks "this is annotation territory, not the source." Apartamento and Aesop product pages use this trick — the warm surface is where the *commentary about* the cool surface lives.

## Why is the verdict masthead so quiet?

Because verdicts on legal work are quiet by tradition. Judges do not write opinions in 96-point bold red. The masthead uses Fraunces serif at the standard `text-display` (38px) — two tiers below the empty-state stunt size. The verdict line is sentence-case, ends with a period, and that's the entire emphasis. "Not ready. Hold." gets two stops because the gravity earns it. "Ready to file." gets one period and a wide column of paper to breathe into.

The sky-deep 1px left rule on the lede paragraph is the only chromatic element on the masthead. It signals "this came from a model" — provenance hint, not severity. It's the same convention used inline in the letter to mark a quoted passage that has a finding attached.

## Why does the inconsistency card use parallel quotes?

Because *The New Yorker*'s fact-check tradition is the direct ancestor of automated factual-consistency checking, and the Yorker's house style for fact-checks is to lay the published claim and the verifiable source side by side, in the same monospace, with quiet smcp gutters labeling each. We adopt this verbatim — letter excerpt on left (paper-2 surface, neutral), facts value on right (sky-wash surface, provenance hint). The reader's eye does the comparison; the UI does not editorialize it.

## Why the asterism (⁂)?

Because it's the **functional ornament** that sets a marginalia anchor apart from a footnote. Footnotes use Arabic numerals (¹ ² ³); chapter divisions use the dinkus (· · ·); but marginalia — the senior associate's circled note in the margin — historically uses asterism in printed legal codices and Cabana-tier editorial design. Using `⁂¹` instead of `¹` immediately tells the reader: "this is not a citation, it's a margin note pointing at a specific finding." Three glyphs of work for a clear semantic distinction.

## Why is the whole panel forbidden from using rubric red?

Because the DNA reserves rubric red for **HITL stop-points**: places where a human attorney must take an explicit action before generation continues (engagement letter AI clause, citation verification, pre-generation approval, conflict-flagged blocking). The reviewer panel is **not** a HITL stop-point — it's a contemplative analysis surface. Reading findings does not block generation; the attorney chooses when to act on them. Therefore the panel inherits the contemplative palette (paper / cream / sage / sky on a B&W base) without escalating to rubric.

The single exception in §11 of the spec is the *deliberate* deviation: a sev-5-fired-and-uncontested gate gets a thin rubric kontur on its sigil. That's it. No surfaces, no fills, no copy. The rubric is the attorney's red pen, and it taps the page once.

## What if a junior says "but red would be faster to scan"?

Coaching opportunity. The answer is: yes, color is fast — and that's exactly why every SaaS dashboard uses it, and why no piece of luxury-editorial design ever does. The Atelier user is an attorney who will sit with this panel for 20 minutes per matter. We are not optimizing for the 2-second glance. We are optimizing for the **third reading**, where typography weight and ornament density still hold up, while a colored dot has long since become wallpaper.

If they keep pushing, point them to *Cabana* magazine and the question: would a Cabana spread be improved by adding a red box around the most important paragraph? Of course not. The most important paragraph announces itself through scale, position, and typeface. Same here.
