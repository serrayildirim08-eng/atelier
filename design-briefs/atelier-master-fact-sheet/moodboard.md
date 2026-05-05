# Moodboard — Atelier · Master Fact Sheet First

Each reference is justified by *what workflow problem it solves*, not by aesthetic affinity. Twelve named references, grouped by stage.

---

## stage 1–3 · receive · triage · facts

**1. Bloomberg Terminal · DES (Security Description) screen.**  
Workflow problem: an attorney who *already knows the case* needs the answer in two keystrokes, not three clicks. The DES screen is one fact per row, anchored on the left, and the entire screen is keyboard-navigable.  
Borrow: the `§§` anchor system. The two-keypress jumper. The dense single-screen sheet that doesn't paginate.  
Don't borrow: black background, neon green type, eight-column toolbars, the modal flicker on field commit.

**2. Things 3 · Today on first open (when nothing is scheduled).**  
Workflow problem: empty/partial states must teach the user what's missing without being a chrome-box. Things' "Today" empty state shows you exactly the action you need next, in exactly the typography of the rest of the app.  
Borrow: the FatalGapsBoot dry checklist treatment. Empty-state more loved than full state. Same type system, no special "empty illustration."  
Don't borrow: motion (Things 3 has spring physics; we are paper-on-desk).

**3. Stripe Dashboard · Payment Detail page.**  
Workflow problem: the attorney needs a pinned masthead with the "what" while scrolling through the long tail of evidence. Stripe pins the payment summary at top and lets the events stream below.  
Borrow: sticky masthead within the center column. Six pinned fields, not four. The "this is what you're working on" persistence.  
Don't borrow: chromatic accent (Stripe purple), card shadows, the "View raw object" affordance for non-engineers.

---

## stage 4 · SOF chain

**4. Adobe Acrobat Pro · bookmark sidebar with depth indents.**  
Workflow problem: the SOF chain is intrinsically ordered (origin → intermediate → US deployment). It must read like a single readable diagram, not a row-and-column matrix the attorney has to mentally re-order.  
Borrow: the vertical spine with leg numerals, left-anchored, fixed width. The way a sub-bookmark visually hangs off its parent.  
Don't borrow: the Acrobat chrome (toolbars, panel-pin, the all-tools sidebar).

**5. Tufte · "small multiples" + sparklines.**  
Workflow problem: discrepancies between legs (cover letter says $425k, escrow says $410k) need to *visually pop* in a column of monospace dollars without color.  
Borrow: tabular-nums in a single mono column, Δ glyph + signed dollars rendered outside the column rule. Three-amount sequences read at a glance.  
Don't borrow: nothing — Tufte is the entire aesthetic logic. We're inside it.

**6. Bear (the writing app) · the document focus mode.**  
Workflow problem: the SOF spine should read like a single document, not a configuration screen. Sectioning by leg should feel like sectioning by paragraph.  
Borrow: the typographic restraint, the way each leg is allowed to breathe with 80px row height.  
Don't borrow: theming, monochromatic backgrounds, the "no UI" extremism — we need affordances.

---

## stage 5 · conflicts

**7. GitHub · Files Changed view with sticky review controls.**  
Workflow problem: conflicts must surface at the relevant fact row, not in a quarantined audit tab. GitHub's PR review accomplishes this with the inline "review" controls that pin to the diff line.  
Borrow: the inline ConflictPin treatment. The principle that severity content lives inside the surface it's about, not in a separate inbox.  
Don't borrow: the colored line backgrounds (sev-3 red is colorblind-hostile and aesthetically loud); the comment-thread metaphor.

**8. Hey · the Imbox / Feed / Paper Trail triage.**  
Workflow problem: severity-1 (cosmetic) and severity-5 (dispositive) must read with different *weights*, not similar pills. Hey's triage demos this with three independent buckets that look structurally different.  
Borrow: the principle that severity is encoded in *three independent visual variables* (rail thickness, rail color, chip fill) so colorblind-safe and unmistakable.  
Don't borrow: the bucketed inbox metaphor itself; we want all severities visible together, sorted desc.

---

## stage 6 · proof slots

**9. Linear · the issue-status pipeline visualization.**  
Workflow problem: "X of Y proof slots filled at APS-4+" must read at a glance, with each E-2 element (treaty / investment / r-and-o / marginality / d-and-d) independently scannable.  
Borrow: the row of element chips with `X/Y` mono fractions, each a clickable filter into the section below.  
Don't borrow: chromatic accent for status; multi-color labels.

---

## stage 7 · drafts

**10. Figma · the export panel with prerequisites.**  
Workflow problem: "you cannot ship a draft with placeholder facts" must be structural, not advisory. Figma's export panel disables export when prerequisites are unmet, and shows you exactly what's blocking.  
Borrow: the disabled-with-explanation gate pattern. The "click here to fix" link that takes you to the blocker. Override path that requires a confirm.  
Don't borrow: the modal centering, the dropdown chrome.

---

## stage 8 · re-classification

**11. Apple Photos · the "this looks like" classification chip on a photo.**  
Workflow problem: the bot's confidence at the moment of classification must be visible without leaving the document view. Photos shows you "this looks like a receipt" inline, with a one-click reassign.  
Borrow: the chip on the thumbnail showing `<doc-type> · <conf>`. The popover with the seven most likely alternatives, hotkeyed 1–7.  
Don't borrow: the "iCloud's making suggestions" anthropomorphism; the rounded chip aesthetic — we want a sharp mono pill.

---

## stage 9 · paralegal handoff

**12. Linear · the issue activity feed (collapsed at the bottom).**  
Workflow problem: a paralegal opening the matter mid-flight must see *who decided what, when, why* without diving into a separate audit screen. Linear's activity feed accomplishes this with a 32px-tall ribbon at the bottom of the issue page that expands to full-height.  
Borrow: the bottom-pinned 32px ribbon. The 6-most-recent rows in collapsed mode. The mono timestamp + verb + actor format.  
Don't borrow: the chromatic actor avatars; the "added a comment" / "removed a label" prose voice.

---

## anti-references (what we explicitly reject)

**Notion / Linear / Figma — when they relax into SaaS-generic.** Pastel labels, rounded soft cards, lavender accents, "let's get started" copy, illustrated empty states, gradient buttons. Atelier is a working surface for an attorney drafting under time pressure. None of that survives.

**Westlaw / LexisNexis · the "results table" treatment.** Workflow lesson: a results table *adjacent* to a results sidebar *adjacent* to a query bar is exactly the navigational ceremony we are escaping. The fact sheet IS the result. There is no query bar.

**Salesforce · the dossier-as-a-thousand-tabs anti-pattern.** Eight tabs is what we currently have. Salesforce normalizes thirty. The redesign caps the inspector at five modes and folds Binder + Context + Log under audit.

**Apple "Pro" apps when they go dark-mode brutalist.** Logic Pro X, Final Cut. We are not a video editor. The attorney works in daylight on a paper-on-desk metaphor. Light mode only, ink on paper.

**Any "AI in the loop" UI from 2024–2026.** No "✨ AI suggestion" sparkle chips, no "✨ smart fill," no chat sidebar, no purple gradient on AI-generated values. The bot's classifications are tools, indistinguishable from any other field provenance, distinguished only by the structural border-color.
