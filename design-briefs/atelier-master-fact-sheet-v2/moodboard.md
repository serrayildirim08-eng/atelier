# Moodboard — Atelier · Master Fact Sheet First, full system (v2)

Each reference is justified by the **workflow problem it solves**. Twelve named references grouped by surface; every one cites the current Atelier file it replaces or extends.

---

## desk · pre-matter / multi-matter triage

**1. Bloomberg Terminal · Launchpad multi-monitor view.**
Workflow problem: Serra runs three matters in parallel. Today the home is a vertical rail of matter labels (`app/page.tsx:1789–1925, Binder`) with a stunt empty-state in the dossier pane (`page.tsx:3656`) that *requires clicking into a matter* to see its state. Launchpad shows every active position's key fields in a row, scannable at one glance.
Borrow: the `MatterRolodex` row geometry — six masthead cells in miniature plus a state chip per matter, all on screen.
Don't borrow: chromatic ticker pulses, neon green text, the eight-toolbar overlay.

**2. macOS Notification Center · stack of notification cards.**
Workflow problem: in-flight ingests today live in a single `BackgroundIngestPill` (`page.tsx:2012`) — fine for one matter, claustrophobic for three. Notification Center shows N cards stacked, each readable, dismissable per-card.
Borrow: the `IngestStrip` row geometry, multiple in-flight matters in parallel rows, expand/cancel per row.
Don't borrow: rounded card corners, blur backgrounds, the swipe-to-dismiss gesture (we use explicit cancel ✕).

**3. Things 3 · Today empty state.**
Workflow problem: empty/partial states must teach what's missing without being chrome-box. Things' empty Today shows the action you need next, in the same typography as the rest of the app.
Borrow: stunt-headline empty state for desk-empty + the FatalGapsBoot dry-checklist treatment (kept from v1).
Don't borrow: spring physics, the rounded color blocks.

---

## sheet · masthead and provenance

**4. Stripe Dashboard · Payment Detail page.**
Workflow problem: pinned masthead with the "what" while scrolling the long tail of evidence. Today's `CaseOverviewCard` (`app/components/case-overview-card.tsx`, 4 cells) doesn't carry I-94 or proportionality, so the attorney has to scroll to find them.
Borrow: sticky 6-cell masthead within center column, cells ordered by attorney's first-3-seconds priority.
Don't borrow: chromatic accent (Stripe purple), card shadows, the "View raw object" affordance.

**5. Looker Studio / Tableau · audit captions everywhere.**
Workflow problem: every value must carry attribution without a separate audit tab. Today's `FactsPane` (`page.tsx:4493`) doesn't visually distinguish bot-classified vs. attorney-confirmed facts; both render as plain text.
Borrow: the 4px provenance border (5-state vocabulary). Inspect any cell for two seconds and you know who decided it.
Don't borrow: the Tableau chrome, "powered by" trailers.

---

## sheet · SOF chain and conflict handling

**6. Adobe Acrobat Pro · bookmark sidebar with depth indents.**
Workflow problem: SOF chain is intrinsically ordered (origin → intermediate → US deployment). Today's `SofChainTable` (`app/components/sof-chain-table.tsx`) renders as a row-and-column matrix that the attorney has to mentally re-order.
Borrow: the vertical spine with leg numerals, left-anchored, fixed width.
Don't borrow: the Acrobat all-tools sidebar, the panel-pin chrome.

**7. Tufte · small multiples + sparklines, plus tabular-nums discipline.**
Workflow problem: discrepancies between SOF legs ($425k → $410k) need to *visually pop* in a column of mono dollars without color. Today's `SofChainTable` renders amounts in mixed-width fonts so a $5k drift doesn't pop until the attorney reads each row.
Borrow: tabular-nums in single mono column, Δ glyph + signed dollars rendered outside the column rule. Three-amount sequences read at a glance.
Don't borrow: nothing — Tufte is the entire aesthetic logic.

**8. GitHub · Files Changed view with sticky review controls.**
Workflow problem: today's `ConflictRegister` (`app/components/conflict-register.tsx`) lives in the audit tab, away from the fact rows the conflicts are about. The avg'd severity-counts pill row at the top (`conflict-register.tsx:48–75`) reads sev-5 with similar weight as sev-2.
Borrow: inline `ConflictPin` at the relevant fact row + severity vocabulary in three independent variables (rail thickness + rail color + chip fill).
Don't borrow: colored line backgrounds (colorblind-hostile), comment-thread metaphor.

---

## sheet · proof slots and exhibits

**9. Linear · issue-status pipeline + activity feed.**
Workflow problem: "X of Y proof slots filled at APS-4+" must read at a glance, with each E-2 element independently scannable. And paralegals must see who-decided-what-when without diving into a separate audit screen.
Borrow:
  (a) the row of element chips with `X/Y` mono fractions for `ProofSlotsBoard`, each clickable into the section below
  (b) the bottom-pinned 32px activity ribbon (collapsed) → full-height pane (expanded) for `AuditRibbon`
Don't borrow: chromatic actor avatars, the "added a comment" prose, multi-color labels.

**10. macOS Finder · column view (cmd-3).**
Workflow problem: today's exhibit interaction is `MemoryPane` (`page.tsx:3065`) — a single-pane category accordion — plus a separate modal for PDF preview (`DocumentPreviewModal`, `page.tsx:3257`). Opening a PDF loses the category context. Re-classifying a doc requires opening the override flow which is yet another surface.
Borrow: the four-column cascade — category → document → page → quote — so the attorney moves left-to-right without losing any column-1 context. ReclassifyChip is on the document column.
Don't borrow: Finder chrome, breadcrumb pills, the keyboard column-jump (we use number-keys).

---

## press · approval flow

**11. Adobe Reader · side-by-side compare diff.**
Workflow problem: the current `PreGenerationApprovalModal` (`app/components/pre-generation-approval.tsx`) is a `fixed inset-0 z-50 flex items-center justify-center` modal that **occludes the sheet the attorney is approving against**. The attorney is reviewing claims against facts but cannot see the facts.
Borrow: `PressSplit` — ghost-sheet column on the left (200px, `--paper-2`), draft preview center, approval inspector right. The sheet is always visible.
Don't borrow: Adobe's blue selection highlight, the "Compare files" tab chrome.

**12. Figma · export panel with prerequisites.**
Workflow problem: "you cannot ship a draft with placeholder facts" must be structural, not advisory. Today's `GeneratePanel` (`app/components/generate-panel.tsx`) shows every generator as enabled regardless of fact-completeness; the only block is the hand-rolled validation in the cover-letter pipeline.
Borrow: the disabled-with-explanation gate pattern. The "click here to fix" link that takes you to the blocker. Override path requires confirm-by-typing.
Don't borrow: modal centering, dropdown chrome, the "Continue without [feature]" anti-friction copy.

---

## anti-references (what we explicitly reject)

**Notion / Linear / Figma when they relax into SaaS-generic.** Pastel labels, rounded soft cards, lavender accents, "let's get started" copy, illustrated empty states, gradient buttons. Atelier is a working surface for an attorney drafting under time pressure. None of that survives.

**Westlaw / LexisNexis · the "results table" treatment.** A results table adjacent to a results sidebar adjacent to a query bar is exactly the navigational ceremony we are escaping. The fact sheet IS the result. There is no query bar. Cmd-K is for anchor-jumping inside the matter, not for searching the binder.

**Salesforce · the dossier-as-thirty-tabs anti-pattern.** Today's eight tabs (`page.tsx:95 type DossierTab`) is what we're escaping. Salesforce normalizes thirty. v2 caps the inspector at five modes. Binder + Context + Log fold under audit / exhibits / parties.

**Apple "Pro" apps when they go dark-mode brutalist.** Logic Pro X, Final Cut. Not us. Atelier is daylight, paper-on-desk. Light mode only, ink on paper.

**Any "AI in the loop" UI from 2024–2026.** No "✨ AI suggestion" sparkle chips, no "✨ smart fill," no chat sidebar, no purple gradient on AI-generated values. The bot's classifications are tools, indistinguishable from any other field provenance, distinguished only by the structural border-color.

**The "Recent outputs" stack of cards** in current `generate-panel.tsx:150–204`. Replaced with `OutputLedger` chronological table — single column, scannable, sortable.

**The current centered approval modal.** Bad geometry. The sheet must remain visible during approval; `PressSplit` enforces this.

**The current `MissingFieldsList` flat schema dump** (`page.tsx:4575`). Too noisy. Replaced by `FatalGapsBoot` (firm-curated subset for sheet) + a `cmd-shift-D` debug-mode-only raw-schema dump.
