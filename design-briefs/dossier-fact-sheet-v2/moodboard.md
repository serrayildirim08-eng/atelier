# Moodboard — Atelier Dossier v2 (Designer B)

Each reference is justified by *what workflow problem it solves*, not by
aesthetic affinity. Aesthetic is downstream.

---

## 1. Bloomberg Terminal — MAIN window, equity description page
**Problem solved:** dense facts you scan, never navigate.
**Borrow:** the rectangle of canonical facts is *always pinned* in the same
place, every ticker, every session. Surrounding panels reference the
rectangle by anchor. The user's eyes have a permanent home.
**Don't borrow:** green-on-black; the four-monitor density assumption;
the 4-character function-code language.
**Where it lands in v2:** the entire center column of the dossier — the
fact sheet *is* the MAIN rectangle.

## 2. Bloomberg Law — docket sheet
**Problem solved:** at-a-glance gap detection in a long list of facts.
**Borrow:** the run of em-dashes that marks every missing field. A
docket where six fields out of forty are dashed is instantly diagnostic
to the eye. The eye doesn't read the dashes — it sees the *texture* of
absence.
**Don't borrow:** the 1998 chrome; the seven-color tag system.
**Where it lands in v2:** italic `unset` markers on every empty fact row;
the proof-slot sparkline; the "fatal missing" border treatment.

## 3. Linear — issue page (left rail + center)
**Problem solved:** keyboard-first navigation between anchors that don't
shift the user's frame of reference.
**Borrow:** the two-rail anchor + content split; the spacebar-to-zoom
focus mode that makes one panel the whole canvas without losing the
rail.
**Don't borrow:** rounded SaaS chrome; the playful empty states; the
gradient priority pills; anything with a sparkle.
**Where it lands in v2:** the left anchor rail; the `g f/s/p/c/e/d/a`
keyboard map; the right rail that mutates without page-level navigation.

## 4. Edward Tufte — sparkline tables (Beautiful Evidence, p. 47)
**Problem solved:** dense tabular reading; one number, one trend, one flag,
per row, with no visual noise between them.
**Borrow:** the principle that a sparkline replaces a chart when the
chart's only job is to communicate a state. The 5-cell completeness
strip in the proof-slot matrix is a Tufte sparkline.
**Don't borrow:** nothing. Borrow it all.
**Where it lands in v2:** the proof-slot matrix sparkline; the
SOF chain reconciliation summary; the per-section completion glyph.

## 5. NYT Pitchbot / Google Docs suggested edits — diff view
**Problem solved:** showing a contradiction inline at the fact it
contradicts, without forcing the user into a separate audit screen.
**Borrow:** the side margin glyph that signals "two readings of this
fact exist"; the inline strike-through showing the diff.
**Don't borrow:** red/green coloration; the comment-thread chrome.
**Where it lands in v2:** the inline `ConflictSidecar` for sev 4–5;
the `‡` glyph in the side margin of fact rows where a conflict pertains.

## 6. Financial Times — Visual Vocabulary, Sankey diagrams
**Problem solved:** rendering a multi-leg flow (origin → intermediate
→ destination) as a single readable picture rather than as a table the
reader must reconstruct in their head.
**Borrow:** the principle that flow width = magnitude; the practice of
printing reconciliation deltas in the margin in a quieter mono.
**Don't borrow:** the rainbow segment colors; the FT brand chrome.
**Where it lands in v2:** the new `SofChainDiagram`. Stroke width = USD
amount, capped at 24 px so a $1M leg doesn't dwarf an $80K leg into
invisibility.

## 7. GitHub — git blame gutter
**Problem solved:** showing per-line provenance (who touched this, when,
in what change) without leaving the file.
**Borrow:** the 14-px margin column that holds attribution; the hover
expansion to a richer pill; the click-to-pin behavior.
**Don't borrow:** the full-bleed diff panes; the commit hash chrome;
the URL-as-citation idiom.
**Where it lands in v2:** the `AuditMargin` gutter on the right edge of
the center column. Every fact row has an audit dot; hover expands;
click pins into the right rail.

## 8. Westlaw — KeyCite citator
**Problem solved:** documents reference each other as citations, not
thumbnails. A citation in the margin is a portal to the source, never a
preview that competes with the document being read.
**Borrow:** the convention `[ex. E-3 p.12]` — a parenthetical that, when
clicked, jumps to the exhibit at the page. Reading flow is preserved.
**Don't borrow:** the Westlaw color palette; the "yellow flag / red
flag" treatment (we want our alarm to mean something different).
**Where it lands in v2:** every fact's source citation; every draft's
inline exhibit reference; the right-rail PDF viewer that opens at page.

## 9. Are.na — block + source
**Problem solved:** a fact and its provenance live together; the user
never wonders "where did this come from."
**Borrow:** the convention that hover/focus on any block reveals its
source under itself, in the same visual unit. Provenance is not a
separate panel; it is part of the block.
**Don't borrow:** the grid card aesthetic; the social/follow chrome.
**Where it lands in v2:** the provenance underline reveal under each
fact row, terminating in the page citation in mono.

## 10. Superhuman — keyboard cheatsheet (`?` overlay)
**Problem solved:** a fluent user wants every action on the keyboard;
they need a discoverable cheatsheet without leaving their context.
**Borrow:** the `?` key reveals a paper-recess overlay (not a modal —
no scrim, no chrome) listing all keyboard shortcuts.
**Don't borrow:** the gamified onboarding; the "command bar as
personality" pitch; the gradient backgrounds.
**Where it lands in v2:** the `?` cheatsheet overlay; the entire
keyboard map.

## 11. Apple Court Records / PACER classic interface (anti-reference, sort of)
**Problem solved:** what NOT to do when designing a legal data tool.
**Don't borrow:** anything visual.
**Why it's here:** PACER is the platonic example of a legal tool that
treats density as an excuse for ugliness. The opposite of v2's thesis:
you can be dense AND set well. We name PACER explicitly as the bottom
of the elevator we're climbing out of.

## 12. Stripe Dashboard — payment timeline (the leg view)
**Problem solved:** a multi-step financial flow rendered with each step
as a fixed-width tile; reconciliation status shown as a single inline
chip per step.
**Borrow:** the concept that each leg of a flow has a *reconciliation
chip* of fixed visual weight; the eye scans the chips, not the prose.
**Don't borrow:** the purple gradient; the marketing-page typography;
the inline animations.
**Where it lands in v2:** the per-leg glyph in `SofChainDiagram`
(`✓ · ‡`) — fixed weight, fixed position, fixed reading order.

---

## Anti-references — explicitly forbidden

- **Notion AI page summaries** — too soft, too prose, too willing to
  hide structure behind a chat. Atelier never summarizes; it shows.
- **Apple Notes** — too gentle, too willing to round corners. We are
  square; we are paper.
- **Linear empty states** — too playful (the bouncing icon, the cute
  copy). Atelier's empty state is `unset` in italic graphite-soft. Period.
- **Any AI tool with sparkles** — the v0 / Cursor / Replit aesthetic
  signals "we are LLM-powered and excited about it." Atelier hides its
  LLM behind a deposition binder. Sparkles, gradients, rainbow ring
  spinners are out.
- **Frosted glass** — VOID territory. Not Atelier.
- **Microsoft Copilot suggestion cards** — the sky-blue shimmer card
  that says "I drafted this for you, click to use." We don't sell
  generation; we gate it.
- **Salesforce Lightning** — the field of cards-of-cards, every value
  buried two clicks deep. Density without typographic discipline is
  noise. Atelier is the inverse.
