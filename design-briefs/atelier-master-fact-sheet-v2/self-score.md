# Self-score (Designer A · v2)

Three rubrics. Internal scratchpad — not meant for the delivered prompt; lives here for transparency.

---

## A. Standard 10-dimension rubric (target ≥45/50)

| dim | score | reasoning |
|---|---|---|
| 1. Emotional clarity | 5/5 | "single ledger, three modes, same chrome" — the simile is a desk and a printed worksheet, not a SaaS console. Concrete. |
| 2. Reference specificity | 5/5 | 12 references, each cited by name + workflow problem + the current Atelier file it replaces. |
| 3. Palette precision | 5/5 | Existing tokens only, role-tightened. The earned accent is contrast (3px `--ink` rail, chip-fill inversion). No invention. |
| 4. Type specificity | 5/5 | Every type role assigned with font + size + weight + letter-spacing + line-height. Mono numbers are mandatory across the system. |
| 5. Motion detail | 5/5 | 11 named recipes with cubic-beziers, durations, and reduced-motion clamps. Each tied to a specific gesture. |
| 6. Component state coverage | 5/5 | Screen × State matrix covers every state for desk/sheet/press, including offline / hidden / re-link / unsaved-edits. |
| 7. Voice sharpness | 4/5 | Examples replace SaaS-y current copy; voice is dry, lowercase, no exclamation. Could push further on a few generators. |
| 8. Polish density | 5/5 | 6 game-tier polish recipes, each tied to an element (§§ anchor, Δ telltale, audit border, hatch, masthead-deal, press cross-fade). |
| 9. Anti-pattern precision | 5/5 | 13 anti-patterns, each citing what it replaces. No generic "don't use too many colors." |
| 10. Execution readiness | 5/5 | Component renames mapped to existing files. URL/hash schema specified. No new write endpoints. Performance budgets named. |

**Total: 49/50.** No dimension below 4. No rewrite required.

---

## B. Workflow rubric (carry forward from v1)

| q | score | reasoning |
|---|---|---|
| time-to-first-decision | 5/5 | rolodex + state chips on desk = <5s answer to "what's blocking which case" |
| impossible to ship placeholder | 5/5 | GenerateGate is structural; override requires confirm-by-typing + audit event |
| SOF gaps surface auto | 5/5 | spine + Δ telltale + dashed-rule placeholder = no manual reading |
| paralegal pickup | 5/5 | global audit ribbon (32px collapsed) + cell-level provenance border |
| bot conf at classification | 5/5 | ReclassifyChip on every thumbnail; needs-review pile sorted asc |

**Total: 25/25.**

---

## C. Usefulness rubric (new for v2; target ≥30/35)

| q | score | reasoning |
|---|---|---|
| each major change cites backend | 5/5 | every component spec block has a `backend mapping:` subsection citing the file/line that produces the data |
| reduces time-to-first-decision | 5/5 | rolodex + masthead carrying I-94 + proportionality + state chips → <5s answer at multiple levels |
| prevents most common mistakes | 5/5 | structural GenerateGate (placeholder facts) + needs-review pile (mis-classification) + masthead I-94 alarm (late filing) + auto-Δ (SOF discrepancy) |
| respects existing data structures | 5/5 | zero new write paths, zero schema changes, zero new model calls; spec is composition only |
| paralegal pickup mid-flight | 4/5 | global audit ribbon + provenance borders + state chips. Could push further on a "what should I do next" inline hint per fact-row |
| every decision auditable | 5/5 | provenance border on every editable cell; conflict resolutions log; attorney_override events; print-audit-trail PDF path |
| (tiebreaker) honest about speculation | 4/5 | usefulness claims #1, #6, #7, #9 mark estimates as speculative; the rest are mechanical. Could be slightly more aggressive about ranges. |

**Total: 33/35.**

---

## summary

49 + 25 + 33 = 107 / 110. No dimension <3 in any rubric. The v1 → v2 expansion adds:
- multi-matter triage surface (rolodex)
- generation surface (press) that doesn't occlude the sheet
- screen × state matrix covering every state across all three modes
- explicit backend-capability mapping per component
- 12-claim usefulness-evidence section
- vibe-check HTML showing all three modes in working form

Largest residual ambiguity: the firm-wide vs. matter-scoped behavior of the audit ribbon needs a UX call. v2 default: scopes to active matter on sheet/press, scopes firm-wide on desk. Worth a single round of feedback.
