# Moodboard — Atelier Full System v3 (Designer B)

Each reference is justified by *what workflow problem it solves*. Aesthetic is downstream.

This moodboard expands v2 to cover the full product surface — home,
ingest, generation, handoff. New entries marked with `[NEW]`.

---

## 1. Bloomberg Terminal — MAIN window, equity description page
**Problem solved:** dense facts you scan, never navigate.
**Borrow:** the rectangle of canonical facts is *always pinned* in the same place, every ticker, every session. Surrounding panels reference the rectangle by anchor. The eye has a permanent home.
**Don't borrow:** green-on-black; the four-monitor density assumption; the 4-character function-code language.
**Where it lands:** the entire center column of the dossier — the fact sheet *is* the MAIN rectangle. The matter list on the home is a mini-MAIN, one row per matter.

## 2. Bloomberg Law — docket sheet
**Problem solved:** at-a-glance gap detection in a long list of facts.
**Borrow:** the run of em-dashes that marks every missing field. A docket where six fields out of forty are dashed is instantly diagnostic. The eye doesn't read the dashes — it sees the *texture* of absence.
**Don't borrow:** the 1998 chrome; the seven-color tag system.
**Where it lands:** italic `unset` markers on every empty `FactRow`; the proof-slot sparkline; the "fatal missing" border treatment; the per-matter gate glyph in the home matter list.

## 3. Linear — issue page (left rail + center)
**Problem solved:** keyboard-first navigation between anchors that don't shift the user's frame of reference.
**Borrow:** the two-rail anchor + content split; the spacebar-to-zoom focus mode; `Cmd+K` global jump.
**Don't borrow:** rounded SaaS chrome; the playful empty states; gradient priority pills; anything with a sparkle.
**Where it lands:** the left anchor rail; `g f/c/p/r/b/d/a/l/x`; the right rail mutating without page-level navigation; the matter overlay (`o`) as zoom mode.

## 4. Edward Tufte — sparkline tables (Beautiful Evidence, p. 47)
**Problem solved:** dense tabular reading; one number, one trend, one flag, per row, with no visual noise between them.
**Borrow:** the principle that a sparkline replaces a chart when the chart's only job is to communicate a state.
**Don't borrow:** nothing. Borrow it all.
**Where it lands:** the proof-slot 5-cell completeness sparkline; the per-matter 7-day touch sparkline that cross-fades on hover in the home matter list; the per-section completion glyph in fact-sheet eyebrows.

## 5. NYT Pitchbot / Google Docs suggested edits — diff view
**Problem solved:** showing a contradiction inline at the fact it contradicts, without forcing the user into a separate audit screen.
**Borrow:** the side margin glyph that signals "two readings of this fact exist"; the inline strike-through; the diff pane in the rail when drilling in.
**Don't borrow:** red/green coloration; comment-thread chrome.
**Where it lands:** the inline `ConflictSidecar` for sev 4–5; the `‡` glyph in the side margin of fact rows where a conflict pertains; the `ConflictDiff` rail for sev-5 drilldown.

## 6. Financial Times — Visual Vocabulary, Sankey diagrams
**Problem solved:** rendering a multi-leg flow (origin → intermediate → destination) as a single readable picture rather than as a table the reader must reconstruct in their head.
**Borrow:** flow width = magnitude; reconciliation deltas in the margin in a quieter mono.
**Don't borrow:** rainbow segment colors; FT brand chrome.
**Where it lands:** `SofChainDiagram`. Stroke = USD scaled, capped 24 px. Discrepant legs get a `--accent-alarm` delta number above them.

## 7. GitHub — git blame gutter
**Problem solved:** showing per-line provenance (who touched this, when, in what change) without leaving the file.
**Borrow:** the 14-px margin column that holds attribution; hover expansion to a richer pill; click-to-pin behavior.
**Don't borrow:** full-bleed diff panes; commit hash chrome; URL-as-citation idiom.
**Where it lands:** `AuditMargin` gutter on the right edge of the center column. Every `FactRow` has an audit dot; hover expands; click pins into the right rail. Also: the `LogPane` rows borrow the timestamp-led blame line format.

## 8. Westlaw — KeyCite citator
**Problem solved:** documents reference each other as citations, not thumbnails. A citation in the margin is a portal to the source, never a preview that competes with the document being read.
**Borrow:** the convention `[ex. 3-A p.12]` — a parenthetical that, when clicked, jumps to the exhibit at the page. Reading flow is preserved.
**Don't borrow:** the Westlaw color palette; the "yellow flag / red flag" treatment.
**Where it lands:** every fact's source citation; every draft's inline exhibit reference; the right-rail PDF viewer that opens at page; the cite-check verdict pill compressed to one line under the draft.

## 9. Are.na — block + source
**Problem solved:** a fact and its provenance live together; the user never wonders "where did this come from."
**Borrow:** hover/focus on any block reveals its source under itself, in the same visual unit. Provenance is part of the block, not a separate panel.
**Don't borrow:** grid card aesthetic; social/follow chrome.
**Where it lands:** the provenance underline reveal under each fact row, terminating in the page citation in mono (`p. 12, garanti_FX_confirmation.pdf`). Reuses existing `cite-reveal` motion.

## 10. Superhuman — keyboard cheatsheet (`?` overlay)
**Problem solved:** a fluent user wants every action on the keyboard; they need a discoverable cheatsheet without leaving their context.
**Borrow:** `?` reveals a `paper-recess` overlay (no scrim, no chrome).
**Don't borrow:** gamified onboarding; "command bar as personality"; gradient backgrounds.
**Where it lands:** the `?` cheatsheet overlay; the entire keyboard map.

## 11. [NEW] Stripe Radar — live event log
**Problem solved:** the user is staring at a 35 s ingest. They need to see the system *working*, not a spinner. Each event must be the lowest-disclosed truth — "Phase 0 complete, case_type: E2", not "running…".
**Borrow:** a streaming log of monospace event rows, lowest-disclosed first, each row immutable once written. The user reads it like a deposition transcript being typed.
**Don't borrow:** the colored event-type chips; the timeline graph.
**Where it lands:** the existing `LoadingProgress` typewriter table — already the right pattern. Recolor the rainbow band to ink-2 hairline. Each Phase-1 PDF result writes a row; each gate firing writes a row; Phase 2 writes the aggregator-complete row. The attorney watches the binder fill in.

## 12. [NEW] A trial attorney's case-list legal pad
**Problem solved:** the home page can't be a SaaS dashboard. The attorney is fluent. She wants to see her matters as a list, not a card grid. Each line carries name + status + last-touched. That's it.
**Borrow:** dense one-line-per-matter, no thumbnails, no avatars, no progress bars. Status carried by a single trailing glyph.
**Don't borrow:** manilla folder skeuomorphism; legal-pad yellow; ruled lines; spiral binding graphic.
**Where it lands:** the home `MatterListLine` rows — 28 px each, ~30 visible without scroll on a 13" MBP. The drop zone is a single hairline rectangle below.

## 13. [NEW] A litigator's two-monitor setup (deposition + exhibits side-by-side)
**Problem solved:** when reviewing the cover letter draft, the attorney must see the source-of-truth fact sheet at the same time. Toggling tabs is mental tax.
**Borrow:** the principle that the *output* and the *source* are visible simultaneously, never multiplexed. The streaming draft lands in the rail. The fact sheet stays in the center.
**Don't borrow:** code-editor split-pane chrome; resize handles; minimaps.
**Where it lands:** during cover-letter generation, the markdown streams into the right rail while the fact sheet stays in the center. The attorney can scroll either side independently. This is the *one* moment two things move at once.

## 14. [NEW] Wet-ink signature blocks
**Problem solved:** the pre-generation approval must feel like a contract, not a click. Initials are required. Submission is a deliberate act.
**Borrow:** the sticky-bottom signature line — `Attorney initials [______]` — visible while the attorney scrolls the preview. The submit button is disabled until initials are present.
**Don't borrow:** DocuSign branding; the "click to sign" gradient buttons; faux-handwriting fonts.
**Where it lands:** the `PreGenerationRail` sticky bottom. Initials field is a 2-char-min `<input type="text">`. `[reject]` `[approve & generate]` to its right. The button is genuinely disabled until 2 chars present — no placebo.

## 15. [NEW] Pacific Reporter — "Continued at p. 412"
**Problem solved:** when a paralegal opens a matter mid-flight, she needs to know where the previous reader stopped. Without a tour, without a modal, without a "welcome back."
**Borrow:** the convention that a long document carries forward markers — pagination citations that say "this thread continues here." The marker is a piece of the document, not a notification.
**Don't borrow:** the legal-citation arcana; the small caps.
**Where it lands:** the `MatterHeader` subline `last touched: AS · 14:32 · facts.investment.total_committed_usd`. `Cmd+K` opens with a `where you were last` row at top. The audit margin's most recent dot pulses *once* on first viewport intersection per session — the only hint that the matter isn't fresh.

---

## Anti-references — explicitly forbidden

- **Notion AI page summaries** — too soft, too prose, too willing to hide structure behind a chat. Atelier never summarizes; it shows.
- **Apple Notes** — too gentle, too willing to round corners. We are square; we are paper.
- **Linear empty states** — too playful (the bouncing icon, the cute copy). Atelier's empty state is `unset` in italic graphite-soft. Period.
- **Any AI tool with sparkles** — the v0 / Cursor / Replit aesthetic signals "we are LLM-powered and excited about it." Atelier hides its LLM behind a deposition binder. Sparkles, gradients, rainbow ring spinners are out.
- **Frosted glass** — VOID territory. Not Atelier.
- **Microsoft Copilot suggestion cards** — the sky-blue shimmer card that says "I drafted this for you, click to use." We don't sell generation; we *gate* it.
- **Salesforce Lightning** — the field of cards-of-cards, every value buried two clicks deep. Density without typographic discipline is noise. Atelier is the inverse.
- **PACER classic** — the platonic example of a legal tool that treats density as an excuse for ugliness. The opposite of v3's thesis: you can be dense AND set well. Named explicitly as the bottom of the elevator we're climbing out of.
- **Clay / Attio / Pipedrive — anything CRM-shaped** — the home is not a CRM. There is no pipeline. There are no "stages." There is one matter at a time, fluently navigated.
- **Dropbox Paper / Coda / any "doc-as-app"** — Atelier is not a doc. The fact sheet is structured; the draft is a derived artifact. We do not allow free-form writing in the matter view.
- **GitHub PR review pane** — too narrow a metaphor; we don't approve diffs, we approve generations against gated facts. We borrow the *blame gutter* (item 7) but not the review chrome.

---

## What this moodboard ADDS over v2

| v2 was scoped to              | v3 adds these references                                       |
| ---                           | ---                                                            |
| dossier shell                 | Stripe Radar (ingest), legal pad (home), 2-monitor (drafting) |
| read-only inspection          | wet-ink signature (pre-generation rail)                        |
| solo attorney                 | Pacific Reporter (paralegal handoff)                          |
| sev 4–5 conflict drill        | (unchanged — Pitchbot still primary)                          |
| SOF chain                     | (unchanged — FT Sankey still primary)                         |
| audit margin                  | (unchanged — git blame still primary)                         |
| keyboard map                  | (unchanged — Superhuman still primary)                        |

Same DNA, expanded scope. The deposition binder metaphor holds across
all 15 references — every single one is something a reading attorney
already knows in muscle memory.
