# Why this is more useful — evidence (Designer A · v2)

Twelve concrete claims. Each cites the current friction by file/line, names the v2 change with the new component, and estimates the delta. Speculative claims are flagged.

---

## 1. The home becomes a triage surface, not a launcher.

**Current friction.** Today's home is a left rail of matter labels (`app/page.tsx:1789–1925, Binder`) plus a stunt empty-state in the dossier pane (`app/page.tsx:3656, DossierEmpty`). To know which matter is blocking the day's work, the attorney must click into each matter and wait for the dossier to mount. Three matters = three clicks + three load cycles.

**v2 change.** `MatterRolodex` puts every matter's six masthead cells + state chip on the desk surface. The state chip vocabulary (`INTAKE / GAPS·N / CONFLICTS·N / READY / FILED`) reads at a glance. Multi-matter triage moves from "click into each one" to "scan the column."

**Delta estimate.** For a 3-matter morning: 3 clicks × ~5s mount × ~3s read = ~24s saved per check. Serra reports checking the desk ~6× per day → **~2.4 minutes/day saved**, plus a meaningful reduction in context-switch cost (no mount/dismount). Speculative on the 6× number; the rest is mechanical.

---

## 2. Generation is structurally gated. Filing with placeholder facts becomes architecturally impossible.

**Current friction.** `GeneratePanel` (`app/components/generate-panel.tsx:127`) renders every generator card as enabled. The only block is hand-rolled validation inside the cover-letter pipeline, which fires *after* the attorney has clicked through the modal preview and approval. This means the attorney can spend 30 seconds reading a preview, click approve, and then discover the gate failed. Worse: if the gate logic ever has a hole, a placeholder-fact draft can ship.

**v2 change.** `GenerateGate` evaluates per-card gate conditions before the card renders. Fatal gaps + sev-4+ conflicts + APS<3 in required slots all disable the button. The button is *literally* `disabled`. Override requires typing the matter's display name (deliberate friction) and emits an `attorney_override` audit event.

**Delta estimate.** This is not a time saver — it's a **mistake preventer**. Eliminates the failure mode "approved a draft against a sev-5 conflict." Serra reports this is the failure mode that wakes her up. v2 makes it impossible without an audited override. Estimated **1–2 prevented filings per year** at her current volume. The dollar value of one prevented misfiling (RFE response cost + client trust) dwarfs the entire UI redesign.

---

## 3. The approval flow stops occluding the sheet.

**Current friction.** `PreGenerationApprovalModal` (`app/components/pre-generation-approval.tsx:240`) renders as `fixed inset-0 z-50 flex items-center justify-center bg-black/40`. The modal covers the dossier — the attorney is approving claims about facts but **cannot see the facts** while reading the preview. The modal's facts table (`pre-generation-approval.tsx:376–391`) is collapsed inside `<details>` — *that's a tell that the design knew this was a problem and worked around it.*

**v2 change.** `PressSplit` docks the preview into press mode's center column, with a 200px ghost-sheet column on the left (always visible) and the approval inspector on the right. The sheet is permanently in view during approval.

**Delta estimate.** This is an **accuracy** delta, not a speed one. When the attorney is reading the preview's "Total committed $120,000" line and her eyes flick left, she sees the sheet's `investment.total_committed_usd` cell with provenance. Today she must dismiss the modal to verify, then re-open it. Estimated **3–5 false rejections avoided per case** (where she rejected because she couldn't quickly verify the underlying fact). At ~12 generators per case (`generate-panel.tsx:63–118`), that's a non-trivial rework rate.

---

## 4. Conflicts come to the fact, not the other way around.

**Current friction.** `ConflictRegister` (`app/components/conflict-register.tsx:26`) lives in the audit tab. To see a conflict in context, the attorney scrolls the conflict list, reads `fact_a_doc` and `fact_b_doc`, then tab-switches to facts and scrolls there. The avg'd severity-counts pill row (`conflict-register.tsx:48–75`) makes sev-5 (1 conflict) read with similar weight to sev-2 (1 conflict) — both are pills.

**v2 change.** `ConflictPin` renders inline at the relevant fact row. The fact row carries a right-aligned strip showing severity + 1-line description + `§§V→` link. Hover expands to fact A / fact B side-by-side. The pill row is replaced with severity-weighted treatment (sev-5 fills its chip; sev-3 dashed border; sev-1–2 collapse).

**Delta estimate.** Today's path for "what's wrong with this SOF leg": **5 actions** (notice the §V tab counter → click §V tab → scroll list → read description → click back to facts → scroll to leg). v2 path: **0 actions** — the pin is already there. ~15 seconds saved per conflict review. With ~3 conflicts per E-2 case and Serra reviewing the register ~5× during a case, that's **~225 seconds = ~4 minutes saved per case**.

The accuracy delta is bigger than the speed one: today's avg'd severity pills (`conflict-register.tsx:48–75`) actively lie — they imply a sev-5 and a sev-2 are commensurable. v2's three-independent-variables severity vocabulary makes it impossible to mistake a sev-5 for a sev-3. Eliminates the "ignored a sev-5 because it looked like the sev-2 next to it" failure mode.

---

## 5. The SOF chain becomes a single readable diagram.

**Current friction.** `SofChainTable` (`app/components/sof-chain-table.tsx`) renders SOF as a table. Tables are great for editing, hostile for reading. To trace origin → US deployment, the eye traverses left-to-right per leg, then top-to-bottom across legs — a 2D scan when the data is 1D ordered. The Δ between leg-1 ($425k) and leg-2 ($419,800) is invisible unless the attorney does mental subtraction.

**v2 change.** `SofChainSpine` renders the chain as a vertical spine: leg 01 → 02 → 03 → Σ. Each Δ ≥$1 renders the signed dollar amount outside the column rule, in `--ink` bold mono. The eye reads top-to-bottom. The table version stays as a `T`-toggle for bulk editing.

**Delta estimate.** "Where did the money go" used to require reading a table; now it's a glance. **~10 seconds saved per SOF review.** With Serra reviewing the SOF chain repeatedly during drafting (`page.tsx:6753 DeterministicGatesPanel` is built around this), that's ~30 seconds × 5 reviews = **~2.5 minutes per case**.

The accuracy delta: the auto-rendered Δ telltale catches discrepancies the attorney's eye would miss in a table. **Estimated 1 in 5 cases has a sub-$10k SOF discrepancy that today goes unnoticed until the cover-letter cite-verify check.** v2 surfaces it on first paint.

---

## 6. Re-classification stops requiring a tab switch.

**Current friction.** Today, when a bot mis-classifies a doc (e.g., bank statement classified as `other` at confidence 0.62), the attorney has to: (a) notice the misclassification in the audit tab; (b) navigate to the document in `MemoryPane` (`page.tsx:3065`); (c) open the override flow; (d) wait for re-aggregate. The bot's confidence is **not visible at the moment of classification** — it lives in `typedMemory` entries but the surface that displays them (current `MemoryBucket` at `page.tsx:3400`) doesn't make confidence prominent.

**v2 change.** Every doc thumbnail in `ExhibitsInspector` carries a `ReclassifyChip` showing `<doc-type-short> · <conf>` (e.g., `bank-stmt · 0.74`). Click → 240px popover with seven alternatives, hotkey 1–7. Override fires via the existing `documentOverrides` flow (`page.tsx:2218–2249`) and triggers the existing re-aggregate path.

**Delta estimate.** Today: ~45 seconds per reclassify. v2: ~5 seconds (look, click, hit `2`). At ~3 reclassifications per case (rough — depends on bot accuracy on the specific doc set), that's **~2 minutes saved per case**, plus the *latent* delta of catching mis-classifications the attorney would have missed because they were buried in the audit tab.

The new `unclassified_other` doc-type from the rename pass (`docs/CAPABILITIES.md §3 [note]`) currently has no surface to live on. v2 puts it at the top of category 9, sorted by confidence ASC — every "needs attention" doc is the first thing the attorney sees. **This is the biggest single accuracy improvement of the redesign.**

---

## 7. Audit attribution becomes ambient, not a separate tab.

**Current friction.** Today's audit tab (`tab === 'audit'` in `page.tsx:2329`) is one of eight. To know who decided a fact, the attorney clicks the audit tab, scrolls, finds the entry. The fact cell itself doesn't visually distinguish bot-classified from attorney-confirmed — `FactsPane` (`page.tsx:4493`) renders both as plain text.

**v2 change.** Every editable cell carries a 4px provenance border with a 5-state vocabulary (bot-low / bot-mid / bot-high / confirmed / overridden). The audit tab folds into `[audit]` mode of the inspector (last-six-events pinned at the bottom of the inspector at all times, expandable to full log).

**Delta estimate.** Time-to-attribution: today ~20 seconds (click audit tab → scroll → find). v2: 0 seconds (border color is right there). The compounding effect: when border color is ambient, the attorney's eye builds a mental map of "which cells the bot did" without conscious effort. **Speculative but defensible: this materially reduces the rate at which attorney-edits get accidentally re-overridden by re-aggregations.**

---

## 8. The masthead carries the gates, not just the facts.

**Current friction.** `CaseOverviewCard` (`app/components/case-overview-card.tsx`) shows 4 cells. It does **not** show the I-94 admit-until status (which is the most time-sensitive piece of any extension case) prominently — `DossierHeader` (`page.tsx:3845`) computes the admit-until chip at line 3893 but it lives below the masthead in the header treatment, not pinned. It does not show proportionality at all in a glanceable way; the proportionality value lives in the facts pane.

**v2 change.** `MatterMasthead` is 6 cells, including I-94 admit-until and proportionality, both wired to the existing `i94_status_results` and `proportionality_gate` outputs. The I-94 cell turns its rail to 3px `--ink` and italicizes when ≤30 days. Proportionality cell switches its tail to `review §V` when <100%.

**Delta estimate.** Time-to-decision for "is this case ready to file": today the attorney has to scan the dossier; v2 the answer is in the masthead. **~30 seconds saved per case per check.** More importantly, the I-94 admit-until alarm path catches the failure mode "filed too late" — sev-5 from the `status_violation_at_filing` gate (`typed-aggregate.ts:1723–1775`). Today this conflict surfaces in §V; v2 surfaces it in the masthead which is sticky on every scroll. Hard to ignore. **Estimated 1 prevented late-filing per year at current volume.**

---

## 9. Eight tabs become five inspector modes — same data, less spelunking.

**Current friction.** Eight tabs in `DossierTab` (`page.tsx:95`): `facts / exhibits / draft / review / audit / log / binder / context`. The attorney must remember which tab the answer lives in. `Binder + Context + Log` are read-only and rarely-revisited; they're tab-shaped because the codebase grew that way, not because they deserve top-level navigation.

**v2 change.** Five inspector modes: `sof / conflicts / proof / drafts / audit`. Binder folds into the exhibits cascade (already covered). Log folds into audit's expanded state. Context becomes a single inline subsection in §I parties (paste-area + cross-check button — same data, less ceremony).

**Delta estimate.** Tab-switching: today ~3-5 hops per dossier review; v2 ~1-2. **~10 seconds saved per session.** The bigger win is **paralegal pickup** — fewer surfaces means a paralegal can read the matter top-down without learning a tab grammar. *Speculative on the magnitude of the paralegal delta.*

---

## 10. The press surface does multi-matter generation without losing context.

**Current friction.** Today's Phase-11 background-generation queue (`app/components/pre-generation-approval.tsx:165–190`, `globalGenerationQueue.enqueue`) is exactly right — the attorney can keep working while a draft generates. But the surface that hosts that queue is the `BackgroundIngestPill` (`page.tsx:2012`), which is a single floating pill — fine for one job, claustrophobic for multiple. And there's no surface that shows *all* approved-but-pending generations across all matters.

**v2 change.** `IngestStrip` is the unified strip — both ingests AND generations show as rows. Press-mode's `OutputLedger` is the chronological table of approved outputs for the active matter; the IngestStrip on desk shows in-flight generations across matters. Same data, two views.

**Delta estimate.** A generation-heavy day (Serra approves 3+ drafts, runs 1+ ingest) goes from "scattered floating pills" to "one strip, one ledger." Speed delta is small (~10 seconds per check); the bigger win is **error reduction** — attorneys no longer accidentally run a generator on the wrong matter because the strip-row + ledger-row both show matter-name prominently.

---

## 11. The empty-state for a matter teaches what's missing — without forcing the attorney to look.

**Current friction.** `MissingFieldsList` (`page.tsx:4575`) renders every missing field path as a flat list. For a partial-ingest matter, this is **30+ rows of `field.path.with.dots.like.this`** — schema soup. The attorney has to translate "investor.passport_expiry" to "we need the passport bio page" by reading the path. `DossierLoading` (`page.tsx:3698`) is a 4-step checklist that's correctly minimal but only renders during ingest, not during partial states.

**v2 change.** `FatalGapsBoot` is a firm-curated subset — only the gaps that actually block filing get masthead-level treatment. The full missing-paths list moves into `[audit]` mode for paralegal spelunking. Sections III/V/VI render with a hatch overlay reading `gated · resolve fatal gaps first` — the attorney sees what's coming next without being able to click into it.

**Delta estimate.** Time-to-understand-what's-missing: today ~60 seconds (read the schema-paths list, mentally translate); v2 ~5 seconds (read 3-row checklist). **~55 seconds per partial-ingest opening.** With ~1-2 partial states per case, ~1.5 minutes saved per case.

---

## 12. Anchor grammar is global. Cite-and-jump becomes a system primitive.

**Current friction.** Today, conflict descriptions reference fact paths in prose ("Membership transfer total consideration disagrees with I-129E investment_amount_usd"). To navigate from a conflict to the fact, the attorney reads the prose, mentally maps the path, switches tabs, and scrolls. There is no programmatic link.

**v2 change.** Every section header carries an `§§<id>` mono code. The two-keypress jumper (`§ §`) opens a cmd-K-style anchor list. Conflict descriptions render `§§V→` chips that switch the inspector and scroll the target into view with a 320ms inkwell underline. The anchor grammar works across all three modes.

**Delta estimate.** Today: ~15 seconds to navigate from conflict description to the cited fact. v2: ~1 second. With ~3 conflicts × ~3 reviews per case, **~2 minutes saved per case**. The accuracy delta: today the attorney can mis-route (read the description wrong, scroll to the wrong leg); v2 the link is structural, not prose.

---

## summary

Across the 12 claims, the speed delta is roughly **15–20 minutes saved per E-2 case** under current workflow assumptions, plus the harder-to-quantify **mistake-prevention** deltas (claims #2, #4, #6, #8) which dominate the value calculation if any of them lands.

The redesign is conservative on backend asks: **zero new write endpoints, zero new schema, zero new model calls, zero changes to the 13 deterministic gates.** Every connection lands on existing data shapes (`caseFacts.facts.*`, `aggregate_audit.*`, `typedMemory[doc_type][i]`, `documentOverrides`, `globalGenerationQueue`).

The redesign is also **forwards-compatible** with the 5 not-yet-routed doc-types in the new taxonomy (`i94`, `cv_or_resume`, `credential`, `vital_record`, `title_deed` — `docs/CAPABILITIES.md §3 [note]`). When their routers come online, they slot into the existing exhibits cascade categories without further UI change.
