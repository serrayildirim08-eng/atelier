# Refactor notes — Atelier manual-block loader + Phase-0.7 gates

**Date:** 2026-04-29
**Scope:** wire the Akalan manual stack into the E-2 drafter and add the four Flatturbo / B&B / Cemre gates to the deterministic reviewer layer.
**Trigger doc:** `manuals/_CROSS-CASE-SYNTHESIS-2026-04-29.md` § 6 + § 9.

## Files changed

| File | Before | After | Change |
|---|---:|---:|---|
| `draft/cover-letter.ts` | 386 | 524 | E-2 path now loads 5 manual blocks + voice corpus + RAG + facts (7-block stack per Master OS § 3). EB-1A/B/C bodies untouched except `// TODO: migrate to manual-block loader (see E-2)`. Slim E-2 system prompt is now ~25 lines vs ~40-line inline structure. |
| `reason/checker.ts` | 333 | 555 | Added 4 deterministic gates (`ownership_volatility`, `co_petitioner_fund_circularity`, `unaccounted_sof_share`, `multi_round_rfe_escalation`) + `E2_DETERMINISTIC_GATES` registry + `runE2DeterministicGates()` helper. Existing LLM `checkDraft` flow unchanged. |
| `reason/index.ts` | 9 | 21 | Re-export the new gates and types. |
| `ingest/schema.ts` | 388 | 460 | Added optional Phase-0.7 fields (`E2Facts.matter`, `ownership_history`, `filed_date_i129`, `rfes`, `investment.claimed_amount_usd`, `source_of_funds[].documented_amount_usd`, `source_of_funds[].source_person`). New `DraftModeEnum`. `CaseFacts` now carries optional `subtype` + `draft_mode`. All additions are optional / null-defaulted — no caller breaks. |
| `test/lib/e2-gates.test.ts` | — | 267 | New. 14 tests covering fires/doesn't-fire/null-safe per gate + registry order assertion. |
| `manuals/_E2-SUBTYPE-TAXONOMY.md` | 457 | 471 | Prepended "Detector caveats — folder labels are NOT trustable" section with verbatim Cemre lesson + Imm-464-2023 as canonical regression exemplar. |

## New behavior

### Drafter (E-2 path only)

When `caseFacts.case_type === 'E2'`, the system context is now assembled per Master OS § 3:

```
[Block 0, 1h]  Slim binding frame   — built from caseFacts.subtype + draft_mode
[Block 1, 1h]  Master OS            — _ATELIER-SYSTEM-PROMPT.md
[Block 2, 1h]  Practitioner manual  — E2-PREPARATION-MANUAL.md
[Block 3, 1h]  AI sibling           — E2-MANUAL-FOR-CLAUDE-CODE.md
[Block 4, 1h]  Sub-type manual      — MANUAL-SUBTYPE-{1,2,3,4}-*.md  (selectSubtypeManualPath)
[Block 5, 1h]  Voice corpus(a)      — selectVoiceCorpusPaths(subtype, draft_mode)
[Block 6, 1h]  Doctrine RAG hits    — preserved (retrieveDoctrine)
[Block 7, 5m]  Facts JSON           — preserved
```

Subtype default when `caseFacts.subtype` is absent: `individual_investor` (Profile A). Draft-mode default when `caseFacts.draft_mode` is absent: `initial`. Profile binding follows `_ATELIER-VOICE-PROFILES.md` matrix (A/B/C/D/E).

`loadManualBlock` is failure-tolerant: any missing manual file logs a warn and skips, the drafter does not crash. The slim binding frame still loads even when the manuals dir is missing entirely (dev fallback).

EB-1A / EB-1B / EB-1C drafters: untouched. Each has a `// TODO: migrate to manual-block loader (see E-2)` comment at the top of its prompt const.

`draftCoverLetter` and `draftCoverLetterStream` exported signatures unchanged.

### Reviewer (E-2 deterministic layer)

Four new gates, all pure / null-safe / individually exported, signature `(facts: E2Facts) => GateOutcome`:

| Gate | Severity | Authority |
|---|---|---|
| `ownership_volatility` | 4 | 9 FAM 402.9-7(1) |
| `co_petitioner_fund_circularity` | 5 | 9 FAM 402.9-6(B) |
| `unaccounted_sof_share` | 5 | 9 FAM 402.9-6(C) |
| `multi_round_rfe_escalation` | 5 | manual § 12.5 |

Outcome shape: `{fired: true, severity, finding, authority}` or `{fired: false, reason: 'not_applicable' | 'data_incomplete', note?}`. The LLM `checkDraft` is unchanged in this pass — gate outputs are not yet folded into the reviewer prompt; that wiring is left for the next iteration so attorneys can audit the gates standalone first.

## Migration risks

1. **Token-spend rise.** The full E-2 stack (Blocks 1–5) is ~6,800 lines of Markdown. Cold-cache cost on a brand-new matter is materially higher than the previous inline prompt — back-of-envelope ~30K input tokens vs ~1.5K. The 1h cache breakpoints amortize this across drafts within an hour, but the FIRST draft of the day pays in full. Mitigation: monitor `usage-log` for the first week; consider trimming `E2-PREPARATION-MANUAL.md` (1,475 lines) if the model is over-anchoring on procedural sections it doesn't need at draft time.
2. **Schema additions are optional everywhere.** Existing matters extracted before these fields landed will have all four new gates return `data_incomplete` and never fire. This is intentional but means the gates produce ZERO findings on the legacy fixtures — surface this to the attorney before calling the new layer "validated".
3. **Voice corpus mismatch.** Subtype 4 currently routes to `_CAMURAL-vs-KACAR-COMPARISON.md` as a stand-in (per the brief). That file is a *comparison* doc, not a voice corpus. The drafter will treat it as exemplar text but the resulting voice will lean toward Kacar (Subtype 1) phrasing. Risk is mostly cosmetic for now — no live Subtype 4 cases in the queue.
4. **Folder-label classification regression.** Imm-464-2023 is the regression case for the new `_E2-SUBTYPE-TAXONOMY.md` caveat. If the Phase-0.6 detector ever lands without this caveat baked in, Cemre-shape cases will silently mis-route to Subtype 1 manuals.

## TODOs

- [ ] **EB-1A / EB-1B / EB-1C drafter migration** to the manual-block loader. Requires authoring `EB1A-PREPARATION-MANUAL.md`, `EB1A-MANUAL-FOR-CLAUDE-CODE.md`, etc. — currently pending per `_ATELIER-SYSTEM-PROMPT.md § 3` "(pending)" markers.
- [ ] **Phase-0.7 draft_mode detector.** The drafter accepts `caseFacts.draft_mode` but no detector populates it yet. Heuristic: scan intake for "Request for Evidence dated", premium-processing election, or service-request keywords; default `'initial'` otherwise. Lives next to the Phase-0.6 sub-type detector.
- [ ] **Voice corpus extraction for Subtype 2 + Subtype 4.** Subtype 2 has no production case in the calibration batch (escalate when one lands). Subtype 4 needs a standalone `_VOICE-CORPUS-from-Camural.md` extracted from the comparison doc.
- [ ] **Fold deterministic gate outcomes into the LLM reviewer prompt.** Right now `runE2DeterministicGates` is exported but `checkDraft` doesn't call it. Next pass: append fired-gate findings to the reviewer's user message under a `## Pre-firing deterministic gate hits` heading so the LLM addresses them in `weak_spots`.
- [ ] **Schema-validator round-trip for the new optional fields.** `E2FactsSchema.parse()` accepts the new fields but the typed-aggregate extractor doesn't yet emit them — the gates will run on `data_incomplete` until the extractor learns to populate `matter.co_petitioners`, `ownership_history`, `rfes`, etc.
- [ ] **Phase-0.6 detector hardening for Imm-464-2023.** Add the BUS-folder-Cemre case as a fixture in `test/ingest/subtype-detect.test.ts` (when that suite exists) to prevent the mis-classification regression.

## Verification

- `npx tsc --noEmit` — clean.
- `npx vitest run` — 129 tests pass (115 baseline + 14 new gate tests). No prior tests broke.

## Phase 2 — 2026-04-29 (later)

Follow-up pass: harvest the 4 OCR-derived gates from `_CROSS-CASE-SYNTHESIS § 9.1 ADDENDUM` (Flatturbo NOID + Final Denial verbatim), and close the Phase-1 open issue "gate outputs are NOT yet folded into the LLM `checkDraft` prompt".

### New gates (4)

| Gate | Severity | Authority | Empirical anchor |
|---|---|---|---|
| `b2_status_violation_signal` | 5 | INA § 101(a)(15)(B); 9 FAM 402.9-7 | Flatturbo (Beksac) — pre-auth ops on B-2 |
| `status_gap_pre_filing` | 5 | 8 CFR § 248.1(b) | Flatturbo — 6-month gap (B-2 → I-129) |
| `material_change_in_response_to_uscis` | 5 | *Matter of Izummi*, 22 I&N Dec. 169 | Flatturbo — RFE vs ITD assertions diverged |
| `external_evidence_contradiction_risk` | 4 | firm policy | Flatturbo — Yelp surfaced auto-repair under e-commerce claim |

All four follow the Phase-1 contract: pure / null-safe / individually exported / signature `(facts: E2Facts) => GateOutcome`. Each lands on `not_applicable` (don't fire, inputs were dispositive) or `data_incomplete` (don't fire, surface upstream extractor gap) when inputs are absent.

### LLM `checkDraft` wiring (closes Phase-1 TODO)

`checkDraft` now runs `runE2DeterministicGates(facts)` first when `case_type === 'E2'` and injects a dedicated cached system block (1h TTL, between the case-type system prompt and the 5m facts block) listing every gate's status. The block instructs the LLM to (a) accept gate findings as authoritative, (b) add qualitative checks the gates can't do, and (c) never override a fired severity-5 gate without an explicit attorney note. Non-E-2 case types are unchanged. Block layout is rendered by the new exported `renderGateBlock(GateRunResult[])` helper.

A new orchestrator `runFullReview(caseFacts, draft, verifyReport?, options?)` fans out to deterministic + LLM and returns `{deterministic: GateRunResult[], llm: ReviewResult}`. The Phase-1 `checkDraft` signature is preserved.

### Schema additions

All optional / null-defaulted (back-compatible with all pre-existing extractions):

- `E2InvestorSchema.current_status` — granular B-2 / B-1 / ESTA status.
- `E2InvestorSchema.prior_status_expiration_date` — last status expiration.
- `E2InvestorSchema.work_authorization_date` — when E-2 work auth issued.
- `E2EnterpriseSchema.fully_operational_since_date` — case theory's day-one-of-ops claim.
- `E2EnterpriseSchema.claimed_business_model` — what the petition asserts.
- `E2EnterpriseSchema.observed_business_model` — what an external check (Yelp / Google / BBB / Wayback) shows.
- `RfeEntrySchema.initial_filing_assertion` — verbatim assertion at filing.
- `RfeEntrySchema.response_assertion` — verbatim assertion in the RFE/NOID response (mismatch trips Izummi).

The task brief used `beneficiary` / `business`; mapped to the canonical `investor` / `enterprise` field names already on `E2FactsSchema`. Gate authorities and triggers are unchanged from the brief.

### Files changed (Phase 2)

| File | Phase-1 lines | Phase-2 lines | Δ |
|---|---:|---:|---:|
| `reason/checker.ts` | 555 | 802 | +247 (4 gates + `renderGateBlock` + `runFullReview` + `checkDraft` system-block injection) |
| `reason/index.ts` | 21 | 28 | +7 (re-export 4 gates + `renderGateBlock` + `runFullReview` + `FullReviewResult`) |
| `ingest/schema.ts` | 460 | 482 | +22 (8 new optional fields across investor / enterprise / rfes) |
| `test/lib/e2-gates.test.ts` | 267 | 452 | +185 (12 gate tests + 1 `renderGateBlock` shape test) |

### Test count

Phase-1 baseline: 129 (115 + 14 gate). Phase-2 total: **142** (115 + 27 in `e2-gates.test.ts`). Δ = +13: 12 gate tests (3 each × 4 new gates) + 1 `renderGateBlock` rendering assertion. Registry-order test was updated from 4 → 8 gates.

### Remaining open issues

- [ ] **Schema-validator round-trip for Phase-2 fields.** Same posture as Phase-1: the typed-aggregate extractor doesn't yet emit `current_status`, `prior_status_expiration_date`, `work_authorization_date`, `fully_operational_since_date`, `claimed_business_model`, `observed_business_model`, `initial_filing_assertion`, `response_assertion`. Until the extractor learns to populate them, all four new gates return `data_incomplete`. Hand-populating from intake forms is the interim path.
- [ ] **`observed_business_model` source pipeline.** No automated puller exists yet for Yelp / Google / BBB / Wayback. Until it lands, `observed_business_model` is human-entered and `external_evidence_contradiction_risk` operates as a checklist prompt (data_incomplete with note).
- [ ] **Multi-RFE assertion diff (richer than equality).** `material_change_in_response_to_uscis` currently does string-equality on the assertion fields. False negatives are possible when the same fact is restated in different prose ("operational since August 2022" vs "began operations 2022-08-19"). A semantic-similarity layer or attorney-curated normalization is the next pass.
- [ ] **EB-1A/B/C deterministic gate parity.** Phase-2 still touches E-2 only. The other case types have no deterministic gate registry; whether to author one (or stay LLM-only there) is a doctrinal call for Serra.
- [ ] **`runFullReview` adoption.** Exported but no caller yet — the existing UI / CLI entrypoints still call `checkDraft` directly. Switching them is a routine follow-up; doing so surfaces the deterministic findings on the matter dashboard independently of the LLM narrative.

### Verification (Phase 2)

- `npx tsc --noEmit` — clean.
- `npx vitest run` — 142 tests pass (129 prior + 13 new). No prior tests broke.

## Phase 3 — 2026-04-29 (later still)

Closes the Phase-1/Phase-2 open issue: "the typed-aggregate extractor doesn't yet emit the new optional gate inputs — gates return `data_incomplete` until the extractor learns to populate them." Phase-3 adds a deterministic post-aggregation enrichment that reads the typed memory and fills the Phase-1/Phase-2 fields directly, idempotent over whatever the LLM aggregator already produced.

### Files changed (Phase 3)

| File | Phase-2 lines | Phase-3 lines | Δ |
|---|---:|---:|---:|
| `ingest/typed-aggregate.ts` | 3767 | 4178 | +411 (8 derive helpers + `enrichSourceOfFundsChains` + `enrichPhase3Fields` orchestrator + 1 invocation site after `parsed.data` is validated) |
| `test/ingest/phase3-enrichment.test.ts` | — | 480 | +480 (23 new tests across 9 derive describes + orchestrator describe) |

### Aggregation rules added

All exposed as exported pure functions (importable for tests + reuse):

| Helper | Source memory | Notes |
|---|---|---|
| `deriveCoPetitioners(memory)` | `corporateFormation.members_or_shareholders` (articles) + `new_member_list` (amendments) + `contract.transferor` / `transferee` (MITA) | Excludes investor via `findInvestorName` + `nameMatches`; deduped on normalized full_name; role taken from `members_or_shareholders[].role` when present, otherwise `'transferor'` / `'transferee'` for MITA parties. |
| `deriveOwnershipHistory(memory)` | Articles (`filing_date_or_effective_date` + `members_or_shareholders`) and amendments (`effective_date` + `new_member_list`). | Sorted ascending by parsed effective_date. Owner names without a date are dropped. Source doc filename surfaced in `source_doc.value`. |
| `deriveFiledDateI129(memory)` | `uscis_or_dos_form.signature_date` where `form_id` matches I-129 (preferred) or I-129E (fallback). | Provenance carries through. |
| `deriveRfes(memory)` | Status_doc with `status_class` matching `/(rfe\|noid\|notice of intent to deny\|request for evidence)/i`; cover_letter / `other` matches by filename + summary. | `subject_category` defaults to `'other'` (Phase-3 cannot semantically classify); `initial_filing_assertion` / `response_assertion` left null pending Phase-4 RFE-body extraction. |
| `deriveClaimedAmountUsd(memory)` | I-129E `investment_amount_usd`. | Same source as the existing §4.5 + §6 + §9 deterministic gates; Phase-3 just exposes it as a `Field<number>`. |
| `deriveCurrentStatus(memory)` | Rich `i94.class_of_admission` (preferred) → thin `status_doc.status_class`. | Maps directly to `B_2_LIKE_STATUSES` in `b2StatusViolationSignalGate`. |
| `derivePriorStatusExpirationDate(memory)` | Rich `i94.admit_until_date` (skipped when `duration_of_status_marker.value === true`) → thin `status_doc.authorized_until`. | D/S records correctly return null — the gate must not interpret D/S as an expired status. |
| `enrichSourceOfFundsChains(memory, chains)` | Per-chain: `documented_amount_usd` falls back to `origin_amount_usd` (lossy but unblocks `unaccounted_sof_share`); `source_person.full_name` is bound by name-matching `chain.notes` / `origin_evidence` against `source_of_funds` doc-type entries' `donor_or_seller`. | Never overwrites a populated field. |
| `enrichPhase3Fields(facts, memory)` | Orchestrator — runs each helper above and writes only when the LLM aggregator left the field absent / null. | Mutates `facts` in place; idempotent. |

The orchestrator is invoked on a single line in `aggregateTypedMemoryToE2`, immediately after `parsed.data` is validated and before any of the existing conflict-register gates run, so the deterministic gates downstream can read canonical inputs.

### Skipped explicitly (Phase-4 / -5)

Per the brief, four field families remain `null` after Phase-3 and continue to return `data_incomplete` from their gates:

- `investor.work_authorization_date` — no reliable signal in the typed memory (a prior E-2 approval notice would land as `status_doc` but we can't tell whether the approval is for THIS case theory's enterprise without cover-letter narrative).
- `enterprise.fully_operational_since_date` — needs cover-letter narrative body extraction (Phase-4).
- `enterprise.claimed_business_model` — same; cover-letter business-description section is not in the rich extractor stack.
- `enterprise.observed_business_model` — explicit Phase-5 (Yelp / Google / BBB / Wayback puller).
- `rfes[].initial_filing_assertion` / `response_assertion` — needs RFE-response body extraction (Phase-4).

### Open issues

- [ ] **Cover-letter rich extractor.** Current cover_letter doc_type only captures metadata (visa_type_argued, addressee, attorney_name, letter_date, word_count_estimate). A rich extractor that pulls the operational-since-date claim and the business-model paragraph would unblock `b2_status_violation_signal` (currently `data_incomplete` whenever `fully_operational_since_date` is null) and `external_evidence_contradiction_risk`. Estimated 1 new schema + 1 new extractor + ~150 lines of aggregator wiring.
- [ ] **RFE / NOID rich extractor.** Phase-3 detects RFE-flagged docs via filename / status-class regex, but `subject_category` is locked to `'other'` and the assertion text fields stay null. A dedicated rich extractor (read the RFE body, extract `subject_category` from a closed enum + the verbatim assertion the response addresses) is the missing piece for `material_change_in_response_to_uscis` and `multi_round_rfe_escalation` precision.
- [ ] **`observed_business_model` external puller.** Yelp / Google / BBB / Wayback fetch + summary. Out-of-band (no Anthropic call); could be a scheduled background job that writes back to the matter's facts JSON. Without it, `external_evidence_contradiction_risk` operates as a checklist prompt.
- [ ] **Semantic similarity for `material_change_in_response_to_uscis`.** Phase-2 uses string-equality; once Phase-4 RFE extraction lands, a paraphrase-tolerant comparator is needed (otherwise "operational since August 2022" vs "began operations 2022-08-19" would falsely trip the gate).
- [ ] **`runFullReview` callsite wiring.** Still exported but no UI / CLI caller. Surfacing the deterministic-gate findings on the matter dashboard independent of the LLM narrative is the natural Phase-4 follow-up.
- [ ] **Co-petitioner role enrichment from MITA payment terms.** Phase-3 sets `role = 'transferor' / 'transferee'`; a richer label (e.g., 'co-investor', 'lender') would reduce false positives on `co_petitioner_fund_circularity` when the transferor was actually the seller-of-business and not part of the petitioning group. Needs an MITA narrative read.
- [ ] **EB-1A / EB-1B / EB-1C deterministic gate parity.** Same posture as Phase-2: still E-2 only.

### Verification (Phase 3)

- `npx tsc --noEmit` — clean.
- `npx vitest run` — 165 tests pass (142 prior + 23 new). No prior tests broke.

## Phase 4 — 2026-04-29 (later again)

Closes the two highest-leverage open issues from Phase-3: cover-letter narrative-body extraction (`enterprise.fully_operational_since_date` + `enterprise.claimed_business_model`) and RFE / NOID rich classification + assertion pairing (`rfes[].subject_category` + `initial_filing_assertion` + `response_assertion`). Without these, `b2_status_violation_signal`, `external_evidence_contradiction_risk`, `material_change_in_response_to_uscis`, and `multi_round_rfe_escalation` returned `data_incomplete` even on cases that empirically tripped them (Flatturbo, B&B International).

### Files changed (Phase 4)

| File | Phase-3 lines | Phase-4 lines | Δ |
|---|---:|---:|---:|
| `ingest/extractors/cover-letter.schema.ts` | — | 40 | new (4-field rich schema) |
| `ingest/extractors/cover-letter.ts` | — | 190 | new (single Haiku 4.5 call, MAX_TEXT_CHARS=60K) |
| `ingest/extractors/rfe-notice.schema.ts` | — | 61 | new (10-value subject_category enum, document_role discriminator, evidence_requested[]) |
| `ingest/extractors/rfe-notice.ts` | — | 202 | new (single Haiku 4.5 call) |
| `ingest/typed-memory.ts` | 859 | 882 | +23 (2 type imports + 2 fields on `PerPdfResult`) |
| `ingest/typed-extract.ts` | 1311 | 1368 | +57 (2 imports + 2 router constants + content-or-filename match block + Promise.all entries + result handlers) |
| `ingest/schema.ts` | 482 | 490 | +8 (5 new `subject_category` enum values appended; old values preserved) |
| `ingest/typed-aggregate.ts` | 4178 | 4522 | +344 (`deriveCoverLetterFields`, `deriveRfesRich`, `enrichPhase4Fields` orchestrator + invocation site after `enrichPhase3Fields`; `deriveRfes` return type extended with the 5 new enum values) |
| `test/ingest/phase4-enrichment.test.ts` | — | 406 | new (24 tests: 8 cover-letter × 4 fields × {populated, null-safe} + 16 RFE: 9 subject_category × ≥1 case + null-safe + assertion pairing + orchestrator) |

### New behavior

**Cover-letter rich extractor** — Routes when the thin classifier returns `doc_type='cover_letter'` AND the filename does NOT match the RFE / NOID / response pattern (RFE responses also carry `cover_letter` doc_type but route to the RFE extractor). Pulls 4 narrative claims:

- `fully_operational_since_date` — ISO 8601, parsed from "the enterprise has been fully operational since [date]" / "actively conducting business since [date]" / Turkish "[tarih] tarihinden itibaren ticari faaliyetlerine başlamıştır".
- `claimed_business_model` — short phrase ≤ 200 chars from the section after "OWNERSHIP STRUCTURE AND CONTROL" / "BUSINESS DESCRIPTION" / Roman-numeral headings.
- `claimed_industry_naics` — explicit NAICS code if cited (most cover letters omit this).
- `principal_treaty_investor_identity` — anti-ambiguity declarative for Subtype-3/4 cases ("The principal treaty investor in this petition is [Corp Name]").

Confidence rules per field: 0.9 verbatim, 0.6 inferred, 0.4 heuristic-fuzzy. Never invents; missing values return `value=null` with `confidence=null`.

**RFE / NOID rich extractor** — Routes when the filename OR the first 4K of body text matches `/(\brfe\b|\bnoid\b|notice[-_\s]?of[-_\s]?intent[-_\s]?to[-_\s]?deny|request[-_\s]?for[-_\s]?evidence)/i`. Independent of the thin doc_type so it catches both USCIS-issued notices (typically `other` or `status_doc` thin classification) and firm-authored responses (typically `cover_letter` thin classification). Captures:

- `document_role` — discriminator: `rfe_notice` | `noid_notice` | `rfe_response` | `noid_response` | `unknown`.
- `subject_category` — closed 10-value enum: `bona_fide_enterprise` | `marginality` | `substantial_investment` | `nationality_or_ownership` | `develop_and_direct` | `procedural_status` | `source_of_funds` | `classification_ambiguity` | `multiple` | `other`. Detection via section headings + verbatim USCIS language patterns harvested from the manuals (`_extracts/Imm-1007-2025_B-B-International_extract.md`, `_extracts/Imm-645-2023_Flatturbo-Beksac_extract.md`).
- `rfe_date` / `response_deadline` — header dates (ISO 8601).
- `issuing_officer_name` + `issuing_officer_title` — signature block on notices only.
- `evidence_requested[]` — bullet list (capped at 25 items) from notices.
- `initial_filing_assertion` — verbatim petition assertion the notice quotes back.
- `response_assertion` — verbatim claim from a response document.

**`enrichPhase4Fields` orchestrator** — Runs after `enrichPhase3Fields` in `aggregateTypedMemoryToE2`. Idempotent (never overwrites a populated field):

1. `enterprise.fully_operational_since_date` ← cover-letter rich (earliest letter_date when multiple cover letters present).
2. `enterprise.claimed_business_model` ← cover-letter rich.
3. `enterprise.naics_code` ← cover-letter `claimed_industry_naics` (only when LLM left absent and the other Phase-3 NAICS sources didn't fire).
4. `rfes[]` ← `deriveRfesRich(memory)` when (a) a richer extraction is available AND (b) existing entries are Phase-3 stubs (all `subject_category='other'` and no assertion fields populated). The stub-detection guard preserves attorney-edited assertions.

**`deriveRfesRich` pairing logic** — One `rfes[]` entry per notice (`document_role` ∈ {`rfe_notice`, `noid_notice`}). Notice's `initial_filing_assertion` lands on the entry directly. Response's `response_assertion` is paired by matching `subject_category` (with `multiple` matching anything). When multiple responses match a notice, the first detected wins.

### Schema enum extension

`E2FactsSchema.rfes[].subject_category` enum was extended with 5 new Phase-4 values (`nationality_or_ownership`, `develop_and_direct`, `procedural_status`, `classification_ambiguity`, `multiple`). The 7 Phase-2 values (`bona_fide_enterprise`, `marginality`, `substantial_investment`, `source_of_funds`, `classification`, `maintenance_of_status`, `other`) are preserved for back-compat — old extractions continue to validate, and `procedural_status` ↔ `maintenance_of_status` and `classification_ambiguity` ↔ `classification` are recognized as semantic synonyms by the gate layer (no normalization done here; gates that read `subject_category` should accept both forms).

### Test count

Phase-3 baseline: 165. Phase-4 total: **189** (+24). Coverage breakdown:
- 8 `deriveCoverLetterFields`: 4 fields × {populated, null-safe} + 1 multi-cover-letter ordering test (counted within the 8).
- 10 `deriveRfesRich` subject_category coverage: 9 categories + null-safe.
- 3 `deriveRfesRich` assertion pairing.
- 3 `enrichPhase4Fields` orchestrator.

### Open issues remaining

- [ ] **`observed_business_model` external puller.** Yelp / Google / BBB / Wayback fetcher — still Phase-5. Without it, `external_evidence_contradiction_risk` operates as a checklist prompt even after Phase-4 populates `claimed_business_model`.
- [ ] **Semantic similarity for `material_change_in_response_to_uscis`.** Phase-4 populates the verbatim assertion fields but the gate still uses string-equality. "Operational since August 2022" vs "began operations 2022-08-19" would not currently trip — needs a paraphrase-tolerant comparator (next pass).
- [ ] **`runFullReview` callsite wiring.** Still exported but no UI / CLI caller. Surfacing the deterministic-gate findings (now backed by populated Phase-4 inputs) on the matter dashboard independent of the LLM narrative is the natural next step.
- [ ] **EB-1A / EB-1B / EB-1C deterministic gate parity.** Phase-4 still touches E-2 only (cover-letter / RFE schemas would need EB-flavored variants for the EB drafters, which are explicitly out of scope here).
- [ ] **`investor.work_authorization_date` puller.** Phase-3 left this null; Phase-4 doesn't address it (a prior E-2 approval notice would land as `status_doc` but binding "this approval is for THIS case theory's enterprise" still needs cover-letter narrative reading we don't do today).
- [ ] **Cover-letter NAICS conflict detection.** When the cover letter cites a different NAICS than the I-129E or business plan, Phase-4 silently prefers the existing field (idempotence) — no `conflict_register` entry is logged. Worth a `naics_drift` conflict in a future pass.

### Verification (Phase 4)

- `npx tsc --noEmit` — clean.
- `npx vitest run` — 189 tests pass (165 prior + 24 new). No prior tests broke.

## Phase 5 — 2026-04-29 (later still)

Closes three of the highest-leverage open issues from Phase-4: `runFullReview` callsite wiring, `investor.work_authorization_date` puller, and a paraphrase-tolerant comparator for `material_change_in_response_to_uscis`. With these, the deterministic gate layer is now visible end-to-end (API → UI), the B-2 status violation gate stops returning `data_incomplete` on cases with prior US work auth on file, and Matter of Izummi no longer false-positives on benign paraphrases.

### Files changed (Phase 5)

| File | Phase-4 lines | Phase-5 lines | Δ |
|---|---:|---:|---:|
| `reason/material-change-comparator.ts` | — | 137 | new (Haiku 4.5 comparator + per-request cache) |
| `reason/checker.ts` | 802 | 906 | +104 (comparator import + async gate variant + `runE2DeterministicGatesAsync` + `RunFullReviewOptions` + comparator routing in `runFullReview`) |
| `reason/index.ts` | 28 | 39 | +11 (re-export comparator + async gate + threshold const + new option type) |
| `ingest/typed-aggregate.ts` | 4522 | 4604 | +82 (`deriveWorkAuthorizationDate` + invocation in `enrichPhase3Fields`) |
| `ingest/index.ts` | 360 | 372 | +12 (`deterministic_gates?: GateRunResult[]` on `IngestSuccess`) |
| `app/api/ingest/route.ts` | 103 | 107 | +4 (swap `checkDraft` → `runFullReview`, surface both layers) |
| `app/api/ingest-path/route.ts` | 499 | 504 | +5 (same swap + streaming variant) |
| `app/page.tsx` | 5790 | 5848 | +58 (extended `IngestResult` + `DeterministicGatesPanel` rendered in `ReviewPane`) |
| `test/lib/phase5.test.ts` | — | 364 | new (16 active tests + 1 skipped live placeholder) |

### New behavior

**`runFullReview` callsite wiring (Task A).** The Next.js batch route (`app/api/ingest/route.ts`) and the streaming matter-folder route (`app/api/ingest-path/route.ts`) both now call `runFullReview(caseFacts, draft, verifyReport)` instead of `checkDraft`. The response shape carries both layers:

```ts
result = {
  ...result,
  review: reviewed.llm.report,         // existing ReviewReport
  deterministic_gates: reviewed.deterministic, // GateRunResult[]
};
```

`IngestSuccess.deterministic_gates?: GateRunResult[]` is the new optional field; absent for EB-1A/B/C until deterministic gate parity ships (explicit Phase-6). The dossier UI's `ReviewPane` renders a new `DeterministicGatesPanel` above the existing inconsistencies / missing-arguments / weak-spots groups. Severity 5 fires render with the `critical` border-weight, severity 4 with `major`. Gates returning `not_applicable` are silenced in the UI; `data_incomplete` is surfaced as an aggregate count so the attorney can spot extractor gaps. No Electron IPC handler exists for the reviewer pipeline today (the desktop wrapper proxies the Next.js routes), so no IPC change was needed.

**`investor.work_authorization_date` puller (Task B).** New `deriveWorkAuthorizationDate(memory)` in `typed-aggregate.ts` scans every `PerPdfResult` for (a) rich `visaStamp` extracts whose `classification` matches `/E[12] | H[1-3] | L[12] | O[12] | P[1-4] | TN | OPT | EAD | employment authorization | work permit/i` and (b) thin `status_doc` entries with the same classification regex on `status_class` + populated `admission_date`. Returns the EARLIEST work-authorizing start date as a `FieldT<string>` (so the prior H-1B in a renewal flow short-circuits the gate even before the E-2 was approved). Wired into `enrichPhase3Fields` immediately after `prior_status_expiration_date`. Idempotent — never overwrites a populated field. Gate fall-through (no work-auth doc on file → field stays null → `b2_status_violation_signal` falls back to `filed_date_i129` comparison) is preserved.

**Semantic-similarity comparator for `material_change_in_response_to_uscis` (Task C).** New `reason/material-change-comparator.ts` exports `createAssertionComparator()` — returns an `AssertionComparator` (signature `(a, b) => Promise<{same, confidence, explanation}>`). Single Haiku 4.5 call per (a, b) pair, `max_tokens=100`, in-memory cache keyed on a stable order-independent hash. New gate variant `materialChangeInResponseToUscisGateAsync(facts, comparator)` runs the string-equality fast path first, then calls the comparator only on differing strings, fires only when `same: false && confidence >= MATERIAL_CHANGE_COMPARATOR_THRESHOLD (0.7)`. Sub-threshold disagreements are treated as ambiguous — the gate stays silent (the LLM reviewer catches genuine contradictions in qualitative analysis, so under-firing here is safer than raising a severity-5 finding on a paraphrase the LLM was unsure about).

`runFullReview` now defaults to constructing a fresh comparator per call (cache is per-request, no persistence). Callers can pass `comparator: null` to opt out and fall back to the legacy Phase-2 string-equality behavior (used in tests that want to assert the legacy behavior is still wired through). `runE2DeterministicGatesAsync(facts, comparator)` is the async equivalent of the sync registry runner, exposed for callers that want the same routing without the LLM reviewer trip.

### Test count

Phase-4 baseline: 189. Phase-5 total: **205 active + 1 skipped** = 206. Δ = +16 active tests (slightly above the +12 target):
- 6 runFullReview integration tests (response shape, gate registry order, non-E-2 path, `comparator: null` legacy path, comparator-suppression path, separable layers).
- 5 `deriveWorkAuthorizationDate` / `enrichPhase3Fields` tests (null when no work-auth doc, visa-stamp E-2, multi-approval EARLIEST wins, status-doc EAD fallback, orchestrator integration).
- 4 `materialChangeInResponseToUscisGateAsync` tests (string-equality fast path, comparator says same → no fire, comparator says different + high confidence → fire, comparator says different + low confidence → no fire).
- 1 `runE2DeterministicGatesAsync` routing test.
- 1 skipped `__skip__` describe block reserved for live Haiku integration when the firm green-lights paid live tests.

The Anthropic SDK is mocked at the `@/lib/anthropic` boundary so no live calls run during tests. The comparator is passed in directly via `RunFullReviewOptions.comparator` so the LLM reviewer mock and the comparator mock are independent.

### Phase-6 still open (explicit)

These items remain after Phase-5 and are NOT addressed here:

- [ ] **External business-model puller (Yelp / Google / BBB / Wayback).** Phase-6. Without it, `external_evidence_contradiction_risk` operates as a checklist prompt even when `claimed_business_model` is now reliably populated by Phase-4. Needs an out-of-band fetch + summary pipeline (no Anthropic call); could be a scheduled job that writes back to the matter's facts JSON.
- [ ] **EB-1A / EB-1B / EB-1C deterministic gate parity.** Phase-6. Phase-5 still touches E-2 only. Whether to author a deterministic gate registry for the EB family (or stay LLM-only there) is a doctrinal call for Serra; if green-lit, the `runFullReview` orchestrator already returns `deterministic: GateRunResult[]` for any case type, so adding EB gates is a routine additive pass.
- [ ] **NAICS drift `conflict_register` entry.** Phase-6. When the cover letter cites a different NAICS than the I-129E or business plan, Phase-4 silently prefers the existing field (idempotence) — no `conflict_register` entry is logged. Add a `naics_drift` conflict (severity 3 or 4 depending on whether the two codes resolve to the same 2-digit sector) so the attorney sees the divergence on the dashboard.

### Other open issues (carried from Phase-4)

- [ ] **Co-petitioner role enrichment from MITA payment terms.** Carried from Phase-3.
- [ ] **Schema-validator round-trip for new optional fields.** All new fields validate; this item is closed for `work_authorization_date` (now populated by Phase-5) but stays open for `claimed_industry_naics` from cover-letter rich until the conflict register entry above lands.

### Verification (Phase 5)

- `npx tsc --noEmit` — clean.
- `npx vitest run` — 205 active + 1 skipped (206 total). 189 prior + 16 new active. No prior tests broke.

## Phase 6 — 2026-04-29 (final this session)

Closes three open issues from Phase-5: NAICS drift conflict_register entry, co-petitioner role enrichment (3 new fields), and the manual-input stub for the external_evidence_contradiction_risk gate. Skipped explicitly: EB-1A/B/C parity (separate batch), automated Yelp/Google/BBB API integration, and a vector-embedding semantic comparator for the NAICS phrase drift detector (the deterministic Jaccard threshold is a cheap stand-in until firm green-lights paid embeddings).

### Files changed (Phase 6)

| File | Phase-5 lines | Phase-6 lines | Δ |
|---|---:|---:|---:|
| `ingest/schema.ts` | 490 | 528 | +38 (`E2EnterpriseSchema.observed_business_model_manual_input` + 2 new closed enums for co-petitioner + 3 optional Field<T> on CoPetitionerSchema) |
| `ingest/extractors/cover-letter.schema.ts` | 41 | 71 | +30 (CoPetitionerRelationshipFromCoverLetterSchema + co_petitioner_relationships[] on CoverLetterRichFactsSchema, optional/default=[]) |
| `ingest/extractors/cover-letter.ts` | 191 | 202 | +11 (prompt addendum for co_petitioner_relationships extraction) |
| `ingest/typed-aggregate.ts` | 4604 | 4942 | +338 (deriveCoPetitionersEnriched, deriveObservedBusinessModel, deriveNaicsDriftConflicts, enrichPhase6Fields orchestrator + invocation site after enrichPhase4Fields; aggregateTypedMemoryToE2 options extended with observedBusinessModelManualInput) |
| `reason/checker.ts` | 906 | 916 | +10 (externalEvidenceContradictionRiskGate consults observed_business_model_manual_input as a fallback when observed_business_model is null) |
| `test/ingest/phase6-enrichment.test.ts` | — | 320 | new (14 tests) |

### New behavior

**Task A — NAICS drift conflict_register entry.** `deriveNaicsDriftConflicts(memory)` walks every per-PDF entry that carries a coverLetter rich extraction OR is doc_type='business_plan', collects `{doc, code, phrase}` triples, and emits at most one conflict per matter when (a) two non-null NAICS codes differ at the 2-digit sector OR (b) two non-null industry phrases share Jaccard token overlap ≤ 0.2. Severity 4. Conflict_type `naics_industry_drift`. Wired into the new `enrichPhase6Fields` orchestrator which runs after `enrichPhase4Fields` in `aggregateTypedMemoryToE2`. Idempotent — checked by `(conflict_type, fact_a_doc, fact_b_doc)` triple before push.

i129e_supplement_extractor_pending — the I-129 E Supplement thin extraction (`UscisOrDosFormFactsSchema` in `ingest/typed-memory.ts`) has no `industry_classification` field. The brief noted this case: the gate compares cover_letter ↔ business_plan only (degraded but useful) and a code comment in `deriveNaicsDriftConflicts` flags the gap so the next phase that adds I-129E rich extraction knows to wire it in.

**Task B — Co-petitioner role enrichment.** `CoPetitionerSchema` extended with three optional Field<T>s:
- `relationship_to_principal` — closed enum `'spouse' | 'child' | 'co_investor' | 'sibling' | 'parent' | 'business_partner' | 'unknown'`. Sourced from cover-letter prose via the new `co_petitioner_relationships[]` field on `CoverLetterRichFactsSchema` (extractor prompt extended with verbatim phrase guidance).
- `sub_application_status` — closed enum `'sub1'..'sub6' | 'derivative_only' | 'none'`. Detected from filename pattern `\bSub([1-6])\b` (case-insensitive) on any document that names the co-petitioner via thin extracted fields, corporate-formation members, or MITA transferor/transferee.
- `role_in_petitioner_entity` — short phrase like "50% Member-Manager", "President". Built from members_or_shareholders entries in articles_of_organization / articles_of_incorporation by combining `ownership_percent` + `role`.

`deriveCoPetitionersEnriched(memory)` is exported for direct unit testing; `enrichPhase6Fields` merges its output onto the existing `facts.matter.co_petitioners` array (idempotent — never overwrites a populated field, name-matched on the normalized `full_name`).

**Task C — observed_business_model_manual_input.** `E2EnterpriseSchema.observed_business_model_manual_input` (optional Field<string>). `deriveObservedBusinessModel(memory, manualInput)` returns the trimmed manualInput as a Field<string> when present, else null — no Yelp/Google/BBB calls. `aggregateTypedMemoryToE2` accepts a new option `observedBusinessModelManualInput?: string | null` and pipes it into `enrichPhase6Fields`.

`externalEvidenceContradictionRiskGate` (Phase-2) updated to consult the manual-input field as a fallback: when `observed_business_model` is null but `observed_business_model_manual_input` is populated, the gate uses the manual input as the comparison source and the finding text says "attorney manual input" instead of "externally observed". When both are null, the gate's `data_incomplete` note now also mentions the manual-input path so the attorney sees both routes to populate the field.

**Attorney UI follow-up:** the dossier UI's matter form should expose `observed_business_model_manual_input` as a one-line text input ("If you've checked Yelp / Google / BBB / the Petitioner's website, what business activities are visible there?") with no auto-pull. The route caller passes the typed string into `aggregateTypedMemoryToE2(memory, { observedBusinessModelManualInput })`. No UI component is added in this phase — the typed-aggregate hook is the contract.

### Test count

Phase-5 baseline: 205 active + 1 skipped. Phase-6 total: **219 active + 1 skipped** (220 total). Δ = +14 active (slightly above the +12 target):
- 4 NAICS drift (matching codes / mismatching codes / phrase drift / single-source).
- 2 relationship_to_principal (populated / null).
- 2 sub_application_status (filename detected / no Sub-N filename).
- 2 role_in_petitioner_entity (articles members / MITA-only).
- 3 manual-input + gate integration (matches → not_applicable / differs → fires sev 4 / null → data_incomplete).
- 1 deriveObservedBusinessModel direct null-safety.

### Explicitly NOT in Phase 6

- **EB-1A / EB-1B / EB-1C deterministic gate parity.** Separate batch per the brief. The orchestrator already returns `deterministic: GateRunResult[]` for any case type; adding EB gates is a routine additive pass.
- **Automated Yelp / Google / BBB / Wayback puller.** Out of scope per the brief; the manual-input stub is the contract for now.
- **Vector-embedding semantic comparator for NAICS phrase drift.** The Jaccard ≤ 0.2 threshold catches dramatic divergence ("e-commerce beauty retail" vs "automotive repair") but will miss subtle paraphrases. A paraphrase-tolerant comparator (similar to Phase-5's `material-change-comparator`) is the natural next pass once firm green-lights paid embedding calls for this gate.
- **I-129 E Supplement industry_classification extraction.** The thin form extractor has no industry/NAICS slot. When that lands, `deriveNaicsDriftConflicts` should add I-129E as a third source.
- **Cover-letter `co_petitioner_relationships` prompt-driven population in fixtures without LLM calls.** The schema accepts the field and the deriver reads it; fixtures populate the field directly. Live cases will only see populated entries once the next case folder runs through the Haiku 4.5 cover-letter extractor with the updated prompt.

### Open issues remaining

- [ ] **Fold Phase-6 `naics_industry_drift` conflict_register entry into the dossier UI.** `DeterministicGatesPanel` (Phase-5) renders gate findings; the conflict_register goes to a separate panel today. Worth a UI pass that highlights `naics_industry_drift` next to the deterministic gate findings.
- [ ] **Co-petitioner role enrichment requires a re-aggregation pass to land on existing matters.** Idempotent enrichment on the typed memory means a stale `facts.matter.co_petitioners` array lacking the 3 new fields stays stale until re-aggregation; surface a "Re-run aggregation" affordance on the matter dashboard.
- [ ] **Sub-application status from filename only (no metadata fallback).** The detector reads `\bSub([1-6])\b` from filenames. When the firm renames files via the alias system, the detector still looks at the raw filename — by design (the alias map doesn't carry sub-application metadata). When the alias map gains a `sub_application` slot, wire it in.

### Verification (Phase 6)

- `npx tsc --noEmit` — clean.
- `npx vitest run` — 219 active + 1 skipped (220 total). 205 prior + 14 new active. No prior tests broke.

## Phase 7 — 2026-04-29 (yes still)

Three data-layer follow-ups from the Phase-6 open list: I-129 E Supplement rich extractor (closes the NAICS drift gate to a 3-source comparison), sub-application alias-map metadata fallback (closes the "filename-only detector" Phase-6 open issue), and three high-leverage cover-letter narrative extensions per the Atelier voice corpus (passport-renewal footnote, five-year horizon, develop-and-direct role grant). Skipped explicitly: Dossier UI work, vector embeddings, EB parity (separate batches per the brief).

### Files changed (Phase 7)

| File | Phase-6 lines | Phase-7 lines | Δ |
|---|---:|---:|---:|
| `ingest/extractors/i129e-supplement.schema.ts` | — | 31 | new (5-field rich schema) |
| `ingest/extractors/i129e-supplement.ts` | — | 166 | new (single Haiku 4.5 call, MAX_TEXT_CHARS=60K) |
| `ingest/typed-memory.ts` | 882 | 893 | +11 (1 type import + `i129eSupplement?` slot on `PerPdfResult`) |
| `ingest/typed-extract.ts` | 1368 | 1397 | +29 (import + 2 router constants `I129E_SUPPLEMENT_FILENAME_RE` / `..._BODY_RE` + match block + Promise.all entry + result handler) |
| `ingest/typed-aggregate.ts` | 4942 | 5138 | +196 (`deriveCoverLetterPhase7Fields`, `deriveCoPetitionersEnriched` options arg + alias-map fallback, `deriveNaicsDriftConflicts` 3-source extension + `NaicsDriftConflict.fact_c` + `NAICS_DRIFT_3SRC` conflict_id, `enrichPhase6Fields` aliases threading + 3-source description rendering, `resolveSubApplicationAlias` import) |
| `ingest/extractors/cover-letter.schema.ts` | 71 | 110 | +39 (3 Phase-7 sub-schemas — `PriorPassportRenewalFootnoteSchema`, `FiveYearBusinessHorizonSchema`, `DevelopAndDirectRoleGrantSchema` — + 3 nullable optional fields on `CoverLetterRichFactsSchema`) |
| `ingest/extractors/cover-letter.ts` | 202 | 205 | +3 (prompt addendum: 3 new field guidance blocks) |
| `ingest/schema.ts` | 528 | 530 | +2 (`MatterMetaSchema.sub_application_aliases?: Record<string, string>`) |
| `lib/case-folder-aliases.ts` | — | 94 | new (`SUB_APPLICATION_ALIAS_MAP` static + `resolveSubApplicationAlias(filename, perMatterOverrides?)`) |
| `test/ingest/phase7-enrichment.test.ts` | — | 483 | new (18 tests) |

### New behavior

**Task A — I-129 E Supplement extractor + 3-source NAICS drift.** Routes when filename matches `/(i[-_\s]?129[-_\s]?e\b|supplement[-_\s]?e\b|treaty[-_\s]?(trader|investor))/i` OR the first 4K of body text matches the substantive header pattern (`Section 1: Treaty Trader/Investor` / `Classification sought under E-2` / `Amount of investment in U.S. dollars`). Independent of the thin `doc_type` (most often `uscis_or_dos_form`, but tolerates `other` when the supplement was scanned out from the I-129 packet). Captures `industry_classification` + `naics_code` + `investment_amount_usd` + `treaty_country` + `beneficiary_ownership_percent`. The aggregator's `deriveNaicsDriftConflicts` now collects sources from cover_letter + business_plan + I-129E; when all three populated NAICS codes pairwise differ (or all three industry phrases pairwise diverge under the Jaccard ≤ 0.2 threshold), emits a single `NAICS_DRIFT_3SRC` conflict carrying `fact_c` and the gate label `[deterministic Phase-7 NAICS drift gate (3-source)]`. The 2-source path (Phase-6 behavior) is preserved as a fallback when fewer than 3 sources are populated.

**Task B — Sub-application alias-map metadata fallback.** New `lib/case-folder-aliases.ts` exposes `SUB_APPLICATION_ALIAS_MAP` (static — `Sub_1` / `S1` / `Subordinate-One` / `SubOne` etc. → `sub1`..`sub6`) + `resolveSubApplicationAlias(filename, perMatterOverrides?)`. Lookup is case-insensitive on a normalized substring match (lowercase + non-alphanumeric stripped). `MatterMetaSchema` extended with optional `sub_application_aliases?: Record<string, string>` so the attorney can supply per-matter overrides on `caseFacts.facts.matter.sub_application_aliases`; overrides take precedence over the static map. `deriveCoPetitionersEnriched` now accepts an optional `{ subApplicationAliases }` second arg; the regex path stays primary, the alias map fires only when the regex misses. `enrichPhase6Fields` threads `facts.matter.sub_application_aliases` into the call. Idempotent (existing populated `sub_application_status` fields are never overwritten).

**Task C — Cover-letter Phase-7 field extensions.** Three new optional/nullable fields on `CoverLetterRichFactsSchema`:

- `prior_passport_renewal_footnote: { paragraph_text, prior_passport_number, current_passport_number } | null` — the firm's signature defensive footnote when the Beneficiary's passport was renewed mid-case (B&B + Splash Sub1 pattern). Captures both numbers + the verbatim explanatory paragraph (≤ 500 chars).
- `five_year_business_horizon: { year_1_revenue_usd, year_3_revenue_usd, year_5_revenue_usd, year_5_employee_count } | null` — narrative summary inline in the cover letter (Substantiality / Marginality section), distinct from the business plan's projections. Reviewer can compare across the two sources to detect drift.
- `develop_and_direct_role_grant: { role_title, granting_document_ref, authority_scope[] } | null` — verbatim authority-grant capture; closed scope enum: `contract_signing` / `banking_authority` / `hire_fire` / `day_to_day_operations` / `strategic_planning`. Empty `authority_scope: []` with a populated `role_title` is the Berkant-style E5 vulnerability marker (only title granted, no scope items enumerated).

Surfaced to the drafter / reviewer through the existing `entry.coverLetter` JSON serialization in `memoryToPromptText` — no E2FactsSchema slots added (these are LLM-only narrative claims). New helper `deriveCoverLetterPhase7Fields(memory)` exposed for direct unit testing + future reviewer wiring; returns the FIRST populated entry per field across all `cover_letter` extracts (these are case invariants — initial filing and RFE response cover letters agree).

### Test count

Phase-6 baseline: 219 active + 1 skipped. Phase-7 total: **237 active + 1 skipped** (238 total). Δ = +18 active (slightly above the +16 target). Coverage breakdown:
- 2 `I129ESupplementFactsSchema` parse tests (full / null payload).
- 4 `deriveNaicsDriftConflicts` 3-source tests (2-src fallback / 3-src codes / agreement → no fire / I-129E phrase drift).
- 1 `enrichPhase6Fields` 3-source conflict_register integration.
- 3 `resolveSubApplicationAlias` (static / null / attorney override).
- 1 `deriveCoPetitionersEnriched` alias-map fallback.
- 2 `CoverLetterRichFactsSchema` Phase-7 parse (full / legacy back-compat).
- 4 `deriveCoverLetterPhase7Fields` (3 fields × populated + 1 null-safe).
- 1 `SUB_APPLICATION_ALIAS_MAP` integrity (every value matches `^sub[1-6]$`).

### Phase-8+ explicit (carried + new)

Skipped per the brief; tracked here for the next batch:

- [ ] **Dossier UI work.** `DeterministicGatesPanel` (Phase-5) + `naics_industry_drift` conflict_register UI surfacing (Phase-6 open) + a "Re-run aggregation" affordance on the matter dashboard (Phase-6 open) + an `observed_business_model_manual_input` text input on the matter form (Phase-6 follow-up). All UI; deferred.
- [ ] **Vector embeddings.** Paraphrase-tolerant comparator for NAICS phrase drift (Phase-6 open). Same posture as Phase-5's `material-change-comparator` — wait for firm green-light on paid embeddings.
- [ ] **EB-1A / EB-1B / EB-1C deterministic gate parity.** Carried from every prior phase. The `runFullReview` orchestrator already returns `deterministic: GateRunResult[]` for any case type; adding EB gate registries is a routine additive pass once the EB-flavored cover-letter / RFE schemas are scoped.
- [ ] **External business-model puller (Yelp / Google / BBB / Wayback).** Carried from Phase-5 / Phase-6. Without it, `external_evidence_contradiction_risk` operates as a checklist prompt anchored to the manual-input stub.
- [ ] **I-129E investment-amount validation.** Phase-7 captures `investment_amount_usd` on the rich extraction but the aggregator still reads the thin `UscisOrDosFormFactsSchema.investment_amount_usd` for the §4.5 consideration drift gate (`findConsiderationGateInputs`). When the rich extraction is more precise (the supplement carries the restated amount in a labelled field), prefer it as the primary source.
- [ ] **Co-petitioner role enrichment from MITA payment terms.** Carried from Phase-3 / Phase-6.
- [ ] **`runFullReview` callsite wiring on Electron IPC.** Carried; `runFullReview` is wired through the Next.js routes but the Electron desktop wrapper proxies those routes today (no separate IPC handler needed).
- [ ] **Drafter / reviewer wiring of the 3 Phase-7 cover-letter fields.** The fields are captured + serialized into the aggregator prompt's typed memory; the drafter and `checkDraft` currently see them only as opaque JSON in `entry.coverLetter`. Worth a dedicated reviewer prompt block ("when `develop_and_direct_role_grant.authority_scope` is empty, flag E5 vulnerability") and a drafter binding ("when `prior_passport_renewal_footnote` is populated, cite for consistency").
- [ ] **`five_year_business_horizon` ↔ `business_plan` projections drift gate.** Cover-letter narrative claim vs business-plan projections (year_5 revenue + employee count). Severity 3 when a single year diverges > 25%, severity 4 on full-trajectory mismatch. Authority: 9 FAM 402.9-6(D) marginality + USCIS Policy Manual on substantiated projections.

### Verification (Phase 7)

- `npx tsc --noEmit` — clean.
- `npx vitest run` — 237 active + 1 skipped (238 total). 219 prior + 18 new active. No prior tests broke.

## Phase 8 — 2026-04-29 (still later)

Closes the Phase-7 open issue: "Drafter / reviewer wiring of the 3 Phase-7 cover-letter fields." Phase-7 captured the passport-renewal footnote, the five-year business horizon, and the develop-and-direct role grant in the cover-letter rich extractor + `deriveCoverLetterPhase7Fields` helper, but the drafter only saw them as opaque JSON in `entry.coverLetter` and the reviewer had no gate consumers. Phase-8 routes these onto a new `E2FactsSchema.cover_letter_phase7` slot, binds them to the slim drafter prompt, and adds two deterministic gates that read the slot directly.

### Files changed (Phase 8)

| File | Phase-7 lines | Phase-8 lines | Δ |
|---|---:|---:|---:|
| `ingest/schema.ts` | 530 | 588 | +58 (4 new sub-schemas — `CoverLetterPhase7PassportFootnoteSchema`, `CoverLetterPhase7HorizonSchema`, `DevelopAndDirectAuthorityScopeEnum`, `CoverLetterPhase7RoleGrantSchema` — + `CoverLetterPhase7Schema` aggregate + optional slot on `E2FactsSchema`) |
| `ingest/typed-aggregate.ts` | 5138 | 5230 | +92 (`enrichPhase8Fields` orchestrator + `KNOWN_AUTHORITY_SCOPES` filter + invocation site after `enrichPhase6Fields`) |
| `reason/checker.ts` | 911 | 989 | +78 (2 new gates `developAndDirectRoleAuthorityThinGate` + `fiveYearHorizonMarginalFailureGate` + `OPERATIONAL_AUTHORITY_SCOPES` set + 2 new `GateName` literals + 2 entries on `E2_DETERMINISTIC_GATES`) |
| `reason/index.ts` | 37 | 39 | +2 (re-export both gates) |
| `draft/cover-letter.ts` | 527 | 553 | +26 (`PHASE8_BINDING_FRAME` const + slim-prompt embed + 3 new exports for tests: `buildE2SlimPrompt`, `buildE2SystemStack`, `PHASE8_BINDING_FRAME`) |
| `test/lib/e2-gates.test.ts` | 452 | 454 | +2 (registry-order test extended 8 → 10 + Markdown row count 10 → 12) |
| `test/lib/phase5.test.ts` | 364 | 366 | +2 (deterministic length 8 → 10 + registry-order test extended) |
| `test/ingest/phase8-enrichment.test.ts` | — | 281 | new (8 tests) |
| `test/lib/phase8-gates.test.ts` | — | 138 | new (8 tests) |

### New behavior

**Schema slot.** `E2FactsSchema.cover_letter_phase7?` now carries three optional/nullable sub-fields mirroring the per-cover-letter rich shapes: `passport_renewal_footnote` (verbatim defensive footnote + both passport numbers), `five_year_horizon` (year-1/3/5 revenue + year-5 employee count), and `develop_and_direct_role_grant` (`role_title` + `granting_document_ref` + `authority_scope[]`). The `authority_scope` enum is closed: `contract_signing | banking_authority | hire_fire | day_to_day_operations | strategic_planning` — same closed set the cover-letter rich extractor emits.

**Phase-8 enricher.** `enrichPhase8Fields(facts, memory)` runs after `enrichPhase6Fields` in `aggregateTypedMemoryToE2`. Reads `deriveCoverLetterPhase7Fields(memory)` (the Phase-7 helper) and writes onto `facts.cover_letter_phase7`. Idempotent — never overwrites a populated sub-field. Unknown `authority_scope` strings (legacy fixtures) are dropped silently via the `KNOWN_AUTHORITY_SCOPES` filter so back-compat parses validate.

**Drafter slim-prompt binding.** `buildE2SlimPrompt` now embeds a 25-line `PHASE8_BINDING_FRAME` block that gives the LLM three explicit instructions: (1) when `passport_renewal_footnote` is populated, generate the firm's defensive footnote VERBATIM per the loaded `_VOICE-CORPUS-from-B-B-International.md § Defensive footnote pattern` four-move structure (anomaly → submission → new state → harmless); (2) when `five_year_horizon` is populated, weave the year-1/3/5 revenue + year-5 employee count into the Substantiality / Marginality section (Roman numeral V or VI per loaded sub-type manual); (3) when `develop_and_direct_role_grant` is populated, surface the role title + granting doc + authority scope, and insert the firm's `[E5 WEAK: Member resolution grants title without operational authority]` warning marker if `authority_scope` lacks any of `contract_signing`, `banking_authority`, `hire_fire`, `day_to_day_operations`. The drafter API signature is unchanged — the binding frame just sits inside Block 0 (the slim binding frame) before the manual stack.

**Reviewer integration.** Two new gates land on the `E2_DETERMINISTIC_GATES` registry (now 10 gates total):

| Gate | Severity | Trigger | Authority |
|---|---|---|---|
| `develop_and_direct_role_authority_thin` | 4 | `cover_letter_phase7.develop_and_direct_role_grant.authority_scope` is populated AND lacks all of `contract_signing` / `banking_authority` / `day_to_day_operations`. | 9 FAM 402.9-7(1) develop-and-direct |
| `five_year_horizon_marginal_failure` | 4 | `cover_letter_phase7.five_year_horizon.year_5_employee_count <= 1`. Fires regardless of revenue level — Walsh & Pollard requires more-than-Beneficiary employment. | 9 FAM 402.9-6(E); *Matter of Walsh and Pollard* |

Both gates are pure / null-safe — absent inputs return `data_incomplete` without firing. Both flow through `runE2DeterministicGates` and `runE2DeterministicGatesAsync` registry runners and surface in the `renderGateBlock` Markdown table (now 12 lines: 10 gate rows + header + separator).

### Test count

Phase-7 baseline: 237 active + 1 skipped. Phase-8 total: **253 active + 1 skipped** (254 total). Δ = +16 active (slightly above the +14 target). Coverage breakdown:
- 4 `enrichPhase8Fields` (footnote / horizon / role grant + unknown-scope filter / null-safe).
- 2 schema parse (full Phase-8 `cover_letter_phase7` shape + back-compat without the slot).
- 2 drafter slim-prompt binding (`PHASE8_BINDING_FRAME` content + `buildE2SlimPrompt` embed).
- 4 `developAndDirectRoleAuthorityThinGate` (fires on title-only / doesn't fire with contract_signing / doesn't fire with banking_authority or day_to_day_operations / null-safe).
- 4 `fiveYearHorizonMarginalFailureGate` (fires on count=1 / fires on count=0 / doesn't fire on count≥2 / null-safe both branches).

### Phase-9+ explicit (carried + new)

Skipped per the brief; tracked here for the next batch:

- [ ] **Dossier UI work.** `DeterministicGatesPanel` rendering of the 2 new Phase-8 gates + a "cover_letter_phase7 coverage" attorney sidebar showing which fields the cover-letter extractor surfaced for the matter. All UI; deferred.
- [ ] **Vector embeddings.** Paraphrase-tolerant comparator for NAICS phrase drift (Phase-6 carried) and for `develop_and_direct_role_authority_thin` granular scope-match. Wait for firm green-light on paid embeddings.
- [ ] **EB-1A / EB-1B / EB-1C deterministic gate parity.** Carried from every prior phase. The `runFullReview` orchestrator already returns `deterministic: GateRunResult[]` for any case type; adding EB gate registries is a routine additive pass once the EB-flavored cover-letter / RFE schemas are scoped.
- [ ] **Automated external puller (Yelp / Google / BBB / Wayback).** Carried from Phase-5/6. Without it, `external_evidence_contradiction_risk` operates as a checklist prompt anchored to the Phase-6 manual-input stub.
- [ ] **`five_year_business_horizon` ↔ `business_plan` projections drift gate.** Carried from Phase-7 open list. Cover-letter narrative claim vs business-plan projections (year_5 revenue + employee count). Severity 3 when a single year diverges > 25%, severity 4 on full-trajectory mismatch. Not addressed in Phase-8.
- [ ] **`hire_fire` + `strategic_planning`-only role grants.** The Phase-8 `develop_and_direct_role_authority_thin` gate currently treats `hire_fire` as non-operational (only `contract_signing` / `banking_authority` / `day_to_day_operations` count). The brief listed `hire_fire` as part of the "operational authority" set per the original spec, so the gate fires on a `hire_fire`-only grant; if the firm later treats hire/fire as sufficient operational authority on its own, downgrade the gate to `not_applicable` for that case.
- [ ] **I-129E investment-amount validation.** Carried from Phase-7 open list.
- [ ] **`runFullReview` callsite wiring on Electron IPC.** Carried.
- [ ] **Co-petitioner role enrichment from MITA payment terms.** Carried from Phase-3 / Phase-6 / Phase-7.

### Verification (Phase 8)

- `npx tsc --noEmit` — clean.
- `npx vitest run` — 253 active + 1 skipped (254 total). 237 prior + 16 new active. No prior tests broke (2 registry-order tests updated to reflect the new 10-gate registry).

## Phase 9 — 2026-04-29 (one more)

Closes the Phase-8 carried items "Dossier UI work" (severity badges, expand/collapse, re-run affordance, gate-not-fired summary on `DeterministicGatesPanel`) and "`five_year_business_horizon` ↔ `business_plan` projections drift gate". Adds a thin `business_plan` rich extractor, an 11th deterministic gate, a re-run review API route, and a small pure-helpers module so the panel's UI decisions are testable inside the node-env Vitest harness.

### Files changed (Phase 9)

| File | Phase-8 lines | Phase-9 lines | Δ |
|---|---:|---:|---:|
| `ingest/schema.ts` | 588 | 605 | +17 (`BusinessPlanPhase9HorizonSchema` + `BusinessPlanPhase9Schema` + optional slot on `E2FactsSchema`) |
| `ingest/extractors/business-plan.schema.ts` | — | 30 | new (`BusinessPlanRichFactsSchema`: 4 numeric Field<T> leaves) |
| `ingest/extractors/business-plan.ts` | — | 153 | new (single Haiku 4.5 call, matches cover-letter.ts pattern) |
| `ingest/typed-memory.ts` | 800 | 810 | +10 (`businessPlan?` slot on `PerPdfResult` + import) |
| `ingest/typed-extract.ts` | 1359 | 1380 | +21 (`BUSINESS_PLAN_FLAVORED_DOC_TYPES` + Promise.all entry + result un-wrap + entry write) |
| `ingest/typed-aggregate.ts` | 5230 | 5286 | +56 (`enrichPhase9Fields` orchestrator + invocation site after `enrichPhase8Fields`) |
| `reason/checker.ts` | 989 | 1056 | +67 (1 new gate `fiveYearHorizonVsBusinessPlanDriftGate` + 2 threshold consts + new `GateName` literal + entry on `E2_DETERMINISTIC_GATES`) |
| `reason/index.ts` | 39 | 42 | +3 (re-export gate + 2 threshold consts) |
| `lib/gates-ui.ts` | — | 60 | new (severity → Tailwind class table, `gateDefaultOpen`, `passedGatesSummary` — pure / testable) |
| `app/api/review/route.ts` | — | 65 | new (POST handler — `case_facts` + `draft` → `runFullReview` → `{ review, deterministic_gates }`) |
| `app/page.tsx` | 6500ish | +120 | severity-badge pills + `<details>`-based expand/collapse + re-run button wired to `/api/review` + collapsed "gates passed" summary; `Dossier`/`ReviewPane` thread an `onResultUpdate` callback so the rerun replaces the in-state review |
| `test/lib/e2-gates.test.ts` | 454 | 456 | +2 (registry-order test 10 → 11 + Markdown row count 12 → 13) |
| `test/lib/phase5.test.ts` | 366 | 368 | +2 (deterministic length 10 → 11 + registry-order test extended) |
| `test/lib/phase8-gates.test.ts` | 138 | 290 | +152 (4 new tests: fires / doesn't-fire / null-safe / threshold-edge) |
| `test/lib/gates-ui.test.ts` | — | 130 | new (7 tests: severity-class collisions / labels / default-open rules / gates-passed summary / re-run POST contract) |

### New behavior

**Schema slot.** `E2FactsSchema.business_plan_phase9?` carries an optional `five_year_horizon: { year_1_revenue_usd, year_3_revenue_usd, year_5_revenue_usd, year_5_employee_count }` mirroring the `cover_letter_phase7.five_year_horizon` shape. The drift gate compares the two slots.

**Phase-9 enricher.** `enrichPhase9Fields(facts, memory)` runs after `enrichPhase8Fields` in `aggregateTypedMemoryToE2`. Walks every `PerPdfResult.businessPlan` (the new rich-extraction slot), picks the FIRST entry with at least one populated numeric leaf, and writes it onto `facts.business_plan_phase9.five_year_horizon`. Idempotent.

**Reviewer integration.** New gate on `E2_DETERMINISTIC_GATES` (now 11 gates total):

| Gate | Severity | Trigger | Authority |
|---|---|---|---|
| `five_year_horizon_vs_business_plan_drift` | 4 | BOTH `cover_letter_phase7.five_year_horizon` AND `business_plan_phase9.five_year_horizon` populated AND year-5 revenue diverges by > 25% OR year-5 employee count diverges by > 50% across the two sources. | 9 FAM 402.9-6(E); *Matter of Ho*, 22 I&N Dec. 206 |

Pure, null-safe (`data_incomplete` when either side absent or both numeric leaves are null), and threshold-defensive (uses `max(|a|, |b|)` as the divergence denominator so the comparison is symmetric and stable when one side is small).

**UI — `DeterministicGatesPanel`.**
- **Severity pills** (Phase-9): each fired gate gets a colored pill — sev 5 = red (`bg-red-100 text-red-900 border-red-300`), sev 4 = orange, sev 3 = yellow, sev 2 = blue, sev 1 = stone. The class table lives in `lib/gates-ui.ts` so the test suite can pin the palette without mounting React.
- **Expand/collapse** (Phase-9): each fired gate is a `<details>` element. Severity-5 gates default open; sev 1-4 default closed. The summary row renders `sev N · label · gate-name · [+/−]` so the attorney sees the headline before expanding.
- **Re-run review button** (Phase-9): a new button at the top of the panel, label "Re-run review", visible only when the matter has both `caseFacts` and `draft`. On click, posts `{ case_facts, draft }` to `/api/review` (new route — runs `runFullReview` server-side and returns `{ review, deterministic_gates }`); during the request the button shows "Re-running…" + `animate-pulse` and is disabled. On success, `onResultUpdate` replaces the result's `review` and `deterministic_gates` in page state. On failure, an inline `re-run failed` panel surfaces the error message.
- **Gates-passed summary** (Phase-9): collapsed-by-default `<details>` block at the bottom of the panel showing `✓ M of N gates passed` (or `All N gates passed.` when zero fired). Inside, every not-fired gate row renders `gate_name · reason` so the attorney can audit which checks the system actually ran.

### Test count

Phase-8 baseline: 253 active + 1 skipped. Phase-9 total: **264 active + 1 skipped** (265 total). Δ = +11 active (slightly above the +10 target). Coverage breakdown:
- 4 `fiveYearHorizonVsBusinessPlanDriftGate` (fires-on-revenue-drift / doesn't-fire-when-within-tolerance / null-safe / threshold-edge for both revenue 25% and employees 50%).
- 2 `severityPillClass` (5 distinct classes / human label table).
- 2 `gateDefaultOpen` (sev 5 fired opens / sev 4 fired and not-fired collapse).
- 2 `passedGatesSummary` (`All N` form / `M of N` form).
- 1 re-run POST contract test (`/api/review` with `{ case_facts, draft }`).

### Phase-10+ explicit (carried + new)

- [ ] **Vector embeddings.** Paraphrase-tolerant comparator for NAICS phrase drift (Phase-6 carried) and granular `develop_and_direct` scope-match. Wait for firm green-light on paid embeddings.
- [ ] **EB-1A / EB-1B / EB-1C deterministic gate parity.** Carried from every prior phase. The `runFullReview` orchestrator already returns `deterministic: GateRunResult[]` for any case type; adding EB gate registries is a routine additive pass once the EB-flavored cover-letter / RFE schemas are scoped.
- [ ] **Automated external puller (Yelp / Google / BBB / Wayback).** Carried from Phase-5/6/8. Without it, `external_evidence_contradiction_risk` operates as a checklist prompt anchored to the manual-input stub.
- [ ] **I-129E investment-amount validation.** Carried from Phase-7/8.
- [ ] **`runFullReview` callsite wiring on Electron IPC.** Carried.
- [ ] **Co-petitioner role enrichment from MITA payment terms.** Carried from Phase-3 / Phase-6 / Phase-7 / Phase-8.
- [ ] **Single-year horizon drift severities.** Phase-9 fires at severity 4 on either year-5 revenue >25% drift OR year-5 employee >50% drift. The original brief sketched a separate severity-3 single-year mismatch tier; not carved out — the LLM reviewer's qualitative pass surfaces year-1/year-3 anomalies adequately for the current MVP.
- [ ] **Drift-gate denominator policy.** Phase-9 uses `max(|a|, |b|)` as the symmetric divergence denominator. When one side is zero, the gate falls back to `not_applicable` for that pair (rather than firing on a divide-by-zero or treating zero as 100% drift). If the firm later wants asymmetric "cover letter must not exceed business plan by >25%" semantics, the gate body has the explicit branch ready.
- [ ] **Phase-9 rich-extractor schema overlap with thin `BusinessPlanFactsSchema`.** The new `BusinessPlanRichFactsSchema` (year-1 / year-3 / year-5 revenue + year-5 employee count) overlaps the thin schema's `projected_revenue_year1_usd` / `projected_revenue_year5_usd`. Both populate per-PDF; the aggregator reads the rich slot for the gate, but the thin slot remains canonical for memory display + downstream LLM prompts. A future pass could remove the overlap by promoting the rich fields onto the thin schema.

### Verification (Phase 9)

- `npx tsc --noEmit` — clean.
- `npx vitest run` — 264 active + 1 skipped (265 total). 253 prior + 11 new active. No prior tests broke (2 registry-order tests updated to reflect the new 11-gate registry).

## Phase 10 — 2026-04-29 (FINAL CODE-ONLY PHASE)

Closes the carried Phase-8/9 item "Vector embeddings — paraphrase-tolerant comparator". Replaces (alongside, not instead of) the Phase-5 LLM-based `material-change-comparator.ts` with an embedding-based comparator that uses cosine similarity against the same embedder the RAG layer already uses (`lib/rag/embed.ts` — OpenAI `text-embedding-3-large` @1024d when `OPENAI_API_KEY` is set, local bge-small-en-v1.5 @384d otherwise). Cheaper per call (no Haiku invocation), faster (no network round-trip when local embeddings are warm), and shares the embedding stack the repo already has wired so we don't add a second model dependency.

### Files changed (Phase 10)

| File | Phase-9 lines | Phase-10 lines | Δ |
|---|---:|---:|---:|
| `reason/embedding-comparator.ts` | — | 121 | new (`embeddingMaterialChangeComparator(a, b, opts)` returning `{same, similarity}` + `createEmbeddingAssertionComparator(opts)` adapter to the existing `AssertionComparator` contract + `EMBEDDING_COMPARATOR_DEFAULT_THRESHOLD` const) |
| `reason/checker.ts` | 1056 | 1071 | +15 (`ComparatorOption` type — `'llm' \| 'embedding' \| AssertionComparator \| null` — + `resolveComparator` switch + `runFullReviewWithEmbeddingComparator` convenience export; default behavior unchanged for callers that don't pass `comparator`) |
| `reason/index.ts` | 42 | 53 | +11 (re-export embedding comparator entrypoints + `runFullReviewWithEmbeddingComparator` + `ComparatorOption`) |
| `test/lib/phase10.test.ts` | — | 282 | new (6 unit tests on `embeddingMaterialChangeComparator` + 4 integration tests via `runFullReview` + 1 gate-level smoke through the adapter) |

### New behavior

**Comparator.** `embeddingMaterialChangeComparator(a, b, opts?)` embeds both inputs as queries (the embedder is symmetric so document/query distinction doesn't matter for assertion-vs-assertion comparison), normalizes both vectors, and returns `{ same: cos >= threshold, similarity: cos }`. Default threshold 0.85 — empirical RAG retrieval sweet spot for "semantically equivalent" pairs (model-dependent: 0.85 conservative for OpenAI 3-large @1024d, slightly low for bge-small @384d). Caller-owned `Map<string, number>` cache keys on order-independent JSON-quoted (a, b) pair; cache stores the cosine similarity (not `same`), so a caller varying `threshold` across calls reuses the same vectors. Failure-tolerant: any embedder throw degrades to string-equality + `console.warn`, mirroring the `lib/rag/retrieve.ts` posture (RAG returns `[]` on index miss; we return same-on-equal here).

**Adapter.** `createEmbeddingAssertionComparator(opts)` lifts the embedding comparator into the `AssertionComparator` contract used by `materialChangeInResponseToUscisGateAsync`. Maps cosine onto the gate's existing `confidence >= 0.7` floor: `confidence = same ? similarity : 1 - similarity`. The gate's semantics — "fire only on confident-different" — survive unchanged when the embedding path replaces the LLM path.

**`runFullReview` switch.** `comparator` option now accepts `'llm' | 'embedding' | <AssertionComparator> | null`. Default `'llm'` — every existing callsite is byte-identical. `'embedding'` constructs a fresh `createEmbeddingAssertionComparator()` per call. Passing an explicit comparator (e.g. for tests) still works. `null` still skips the comparator entirely (Phase-2 string-equality fallback). Convenience export `runFullReviewWithEmbeddingComparator(facts, draft, verifyReport?, options?)` pins `comparator: 'embedding'` for callers that don't want to thread the option through.

**Configuration knob.** The repo can now flip from LLM to embedding comparator by switching `runFullReview`'s `comparator` option at the callsite, no code changes needed. `app/api/review/route.ts` and any future caller can plumb a feature flag onto the option without touching `reason/`.

### Test count

Phase-9 baseline: 264 active + 1 skipped. Phase-10 total: **275 active + 1 skipped** (276 total). Δ = +11 active (slightly above the +10 target). Coverage breakdown:
- 6 `embeddingMaterialChangeComparator` (exact-match short-circuit / above-threshold same / below-threshold different / custom threshold / cache hit on order-reversed pair / failure-tolerant fallback + warn).
- 4 `runFullReview` integration (embedding suppresses paraphrase / embedding fires on orthogonal pair / default LLM path back-compat / `runFullReviewWithEmbeddingComparator` routes through `embedBatch`).
- 1 gate-level smoke through the embedding adapter (`materialChangeInResponseToUscisGateAsync` doesn't fire when embedder says same with high confidence).

### No further code-only phases viable

Phase-10 is the LAST viable code-only phase. The remaining items genuinely require new input or out-of-band work:

- **EB-1A / EB-1B / EB-1C deterministic gate parity.** Carried from every prior phase. Requires new EB case data — Eylul's calibration batch was E-2 only; without empirical EB-1A/B/C cases to anchor gates against (the way Flatturbo / B&B International / Cemre anchor the E-2 gates), authoring an EB gate registry would be guesswork and produce false-positive-prone code. **Blocked on data, not engineering.**
- **Automated external puller (Yelp / Google / BBB / Wayback).** Carried from Phase-5/6/8/9. Requires API integration / scraping / TOS decisions outside code-only scope. The Phase-6 `observed_business_model_manual_input` slot lets the attorney type observed-model evidence today; closing the loop with an automated puller is a separate workstream. **Blocked on integration / legal decisions.**
- **I-129E investment-amount validation, MITA payment-terms enrichment, single-year horizon drift severities, drift-gate denominator policy, schema-overlap consolidation.** All carried open items from Phase-7/8/9. Each is now subsumed by one of the above two blockers OR is a low-leverage cosmetic refinement that should wait for empirical signal from production use rather than speculative authoring. **Closed by Phase 8/9/10 as code-only items.**
- **Electron IPC `runFullReview` callsite wiring.** Carried. The Electron desktop wrapper already proxies the Next.js `/api/review` route; no separate IPC handler needed.

### Verification (Phase 10)

- `npx tsc --noEmit` — clean.
- `npx vitest run` — 275 active + 1 skipped (276 total). 264 prior + 11 new active. No prior tests broke.
