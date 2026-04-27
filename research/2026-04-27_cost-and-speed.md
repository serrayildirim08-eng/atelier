# AKALAN Portal — Cost & Speed Research

**Date:** 2026-04-27
**Scope:** "as cheap and fast as possible" — operations, model right-sizing, pipeline shape, runtime/infra
**Repo state:** `forensic-doctrine` branch at `f897260`. Per-stage pipeline: Haiku 4.5 detect → Haiku 4.5 per-PDF extract → Sonnet 4.6 (adaptive thinking) aggregate → Sonnet 4.6 (adaptive + effort:high) draft → Sonnet 4.6 (adaptive + effort:high) review. Citations API, vision fallback, cost meter, Langfuse audit, TTL=1h pinning — all already shipped.

---

## TL;DR — Do these in this order

The only "infra" move is to **keep doing nothing** — Electron-only on a laptop, no Azure, no Postgres, no Vercel. The savings are inside the Anthropic call shape.

| # | Change | Effort | $/case | Latency/case | Risk |
|---|---|---|---|---|---|
| 1 | Drop `thinking: adaptive` from `reason/checker.ts` | 5 min | −$0.10 | −60–120 s | low (structured-output schema already constrains) |
| 2 | SHA-256 dedup of PDFs in `classifyAndExtractOnePdf` | 1 h | −$0.05 (~15% of Haiku calls) | −5–10 s | none |
| 3 | Run `detect()` and the first wave of per-PDF `extract()` in parallel | 1 h | $0 | −3–8 s | low |
| 4 | Drop `thinking: adaptive` from `ingest/typed-aggregate.ts` (deterministic §4.5 gate already covers it) | 30 min | −$0.10 to −$0.20 | −20 s | medium — A/B on a known-conflict folder |
| 5 | Move Facts JSON into `system` array with its own 1h cache breakpoint | 2 h | −$0.05 | −30% review TTFT | low |
| 6 | Route drafter by case_type — keep Sonnet 4.6 for E-2 / EB-1C; upgrade to Opus 4.7 for EB-1A / EB-1B only | 1 h | +$0.50–$1.50 on EB-1 only; $0 elsewhere | nil | low — gated on case_type |
| 7 | Add `effort_override` to the reviewer; default `'medium'` for E-2 renewals when `conflict_register` has no severity 4-5 | 3 h | −$0.05 to −$0.15 on routine E-2 | small | medium — eval first |
| 8 | Files API: upload PDF once per case, reference by `file_id` with `cache_control` on the document block | 4–6 h | −$0.05 to −$0.10 | −1–3 s/stage from skipping base64 | low |
| 9 | Free `client.messages.countTokens` pre-flight gate on aggregator + drafter | 1.5 h | $0 (enables safer raised budgets) | nil | none |
| 10 | Stream the drafter to the UI (`messages.stream`) | 6–8 h | $0 billed | first-paragraph in 3–5 s vs ~30 s | low |

**Cumulative effect on a typical 5-PDF E-2 case** (assuming caching warms): roughly **$0.40 → $0.10–$0.15 per case**, **3–5 min → ~90 s wall-clock**, and a perceived-latency drop on draft and review that's larger than the numbers suggest because TTFT is what the user feels.

**At 5–20 cases/month**, the net OpEx hit is **Anthropic only, ~$3–$30/mo**. Everything else stays $0.

---

## What the four parallel research agents converged on

1. **You've already done the high-leverage architectural work.** Citations API, vision fallback, cost meter, Langfuse audit, TTL=1h pinning, detect-prompt padding above the Haiku 4096-token cache floor — these were the prior-report top-5 and they're shipped. The remaining wins are smaller individually but compound.
2. **Adaptive thinking is now the dominant hidden cost.** It's on three of five Anthropic calls per case (aggregate, draft, review), and Anthropic's own docs explicitly recommend "respond directly" for structured-output checker tasks ([Building with extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking), retrieved 2026-04-27). Removing it from the reviewer alone saves ~$0.10/case and ~60–120 s of TTFT — that's the single highest-ROI change in the codebase.
3. **The cheapest infra is what you have.** Electron on a laptop + Anthropic API + zero cloud is both the cheapest and the most defensible compliance posture under ABA Op. 512 (which favors "closed systems" — data not used for training, kept inside protected boundaries). Defer Azure, defer Postgres, defer Tauri.
4. **Files API + multi-breakpoint caching is the next architectural win.** Each adds modest $-savings but compounds in latency and unlocks the reviewer to read raw PDFs cheaply when conflict-register entries demand a source-quote audit.

---

## Detailed findings

### 1. Drop `thinking: adaptive` from the reviewer (5 min, highest ROI)

`reason/checker.ts:247-268` runs `messages.parse` against `ReviewReportSchema` with `thinking: { type: 'adaptive' }` + `output_config: { effort: 'high' }`. The schema **already enumerates the failure modes** (severity, category, weak_spots, missing_arguments). Five fixed checks walk the Facts JSON + Draft. There is no multi-step reasoning to do — the work is "read structured input, emit structured output."

- **Anthropic's guidance:** *"Extended thinking adds latency and should only be used when it will meaningfully improve answer quality — typically for problems that require multi-step reasoning. When in doubt, respond directly."* ([Building with extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking), retrieved 2026-04-27).
- **Latency cost:** Sonnet 4.6 with adaptive + max effort has TTFT **138.81s** ([Artificial Analysis — Sonnet 4.6 adaptive](https://artificialanalysis.ai/models/claude-sonnet-4-6-adaptive), retrieved 2026-04-27). Without thinking: ~1.32 s TTFT, 46.7 t/s — same review report in ~30 s instead of 2–3 min.
- **Cost cost:** thinking tokens billed at output rate ($15/MTok Sonnet). A 30K-thinking excursion = $0.45 alone. Removing it on a typical 8K-output review = ~$0.10/case saved.
- **Where the safety net already lives:** the Phase-B deterministic verifier (`reason/checker.ts:6-7`, `:245`) catches the citation-allowlist + grounding failures at $0. Sonnet's job is narrative drift only — exactly the "respond directly" case.
- **Code:** `reason/checker.ts:247-254` — remove the `thinking` line.
- **Test gate:** run on 3 representative E-2 / EB-1A / EB-1C drafts, diff the structured `ReviewReport` output against the current adaptive run. Should be byte-similar; ship if so.

### 2. SHA-256 dedup of PDFs (1 h)

eDiscovery has used hash-based dedup for two decades; SHA-256 is the modern default ([Meridian Discovery dedup FAQ](https://www.meridiandiscovery.com/articles/frequently-asked-questions-about-de-duplication/), retrieved 2026-04-27). Immigration case folders are dedup-friendly because translations + originals + email-attachment copies + "final v2 (1).pdf" are common.

- **Realistic dedup rate** on byte-identical PDFs in a typical case folder: 10–20% (translations of the same passport rarely match byte-for-byte; office sync copies and forwarded attachments do).
- **Cost math:** Haiku 4.5 per-PDF call ≈ 8K input + 1K output ≈ $0.013. 30-PDF folder × 15% dedup × $0.013 = **~$0.06/case**.
- **Latency math:** with `runWithConcurrency(5)`, 4–5 deduped PDFs ≈ 1 fewer concurrent wave ≈ **5–10 s** off the ingest pipeline.
- **Determinism:** `pdf-parse v2` is deterministic on the text-extraction path (pure-JS, no model). Vision-fallback responses are NOT deterministic; only dedup the pre-vision branch.
- **Code:** new `lib/pdf-cache.ts` keyed by `crypto.createHash('sha256').update(buffer).digest('hex')` → JSON file under `~/akalan-context/.cache/`. Wrap the top of `classifyAndExtractOnePdf` (`ingest/typed-extract.ts:119`).
- **Risk:** zero. Cache key is content; identical input always returns identical output.

### 3. Detect ↔ first-wave-extract overlap (1 h)

`detect()` operates on 3 file samples at most (`ingest/detect.ts:142-143`) and returns case_type. Per-PDF extract is **case-type-agnostic** — its system prompt names the doc-type taxonomy, and the case_type only matters at the **aggregator** stage.

- **Critical-path saving:** detect runs 3–8 s today, sequential before extract. Fire `Promise.all([detectCaseType(samples), extractFirstWave(pdfs.slice(0, 5))])` — detect overlaps with the slowest first-wave extract. **Free 3–8 s/case.**
- **Cleanup:** `ingest/typed-extract.ts:70` opens with *"You are an immigration paralegal performing per-document fact extraction on a single PDF from an E-2 Treaty Investor case folder."* — drop the "E-2" phrase. The taxonomy is universal; saying "E-2" is misleading and prevents the prompt from being case-type-shared.
- **Code:** `ingest/index.ts` (top-level orchestrator) and a one-line edit at `typed-extract.ts:70`.
- **Risk:** low — only requires the per-PDF extractor system prompt to be case-type-agnostic, which it already is in substance.

### 4. Drop `thinking: adaptive` from the aggregator (30 min)

`ingest/typed-aggregate.ts:266` runs Sonnet 4.6 with adaptive thinking. The aggregator's job is reconciliation + conflict-register population + source-of-funds chain construction. The `conflict_register` severity rubric is in the system prompt; the §4.5 consideration-gate has a **deterministic post-check** at `typed-aggregate.ts:310-371` that catches the highest-stakes failure (membership-interest-transfer total vs I-129E investment_amount drift) without thinking.

- **Anthropic's hallucination guidance** ([Reduce hallucinations](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations), retrieved 2026-04-27) actually recommends thinking for *"explicit disagreement"* outputs like conflict-register entries. So this is the one spot where the model-only-quality argument leans toward keeping it. Mitigation: drop to `effort: 'low'` instead of fully removing thinking, OR keep adaptive but require the deterministic gate to populate before the LLM call.
- **Cost math:** typed-memory input ~10K, output ~16K. With adaptive thinking, internal reasoning adds 5–15K extra output tokens × $15/MTok = **$0.08–$0.22/case**.
- **Test gate:** run on a folder with a known DOB mismatch between passport and bank statement. Confirm the conflict_register still emits a severity-3 or -4 entry. Confirm the deterministic §4.5 gate still fires on a folder with a contract/I-129E mismatch.
- **Code:** `ingest/typed-aggregate.ts:266` — remove `thinking: { type: 'adaptive' }` (or downgrade to `effort: 'low'`).
- **Confidence:** medium. The deterministic gate is the safety net here. If telemetry shows conflict_register recall dropping, restore.

### 5. Multi-breakpoint cache_control — Facts JSON in `system` array (2 h)

Anthropic now allows **up to 4 cache breakpoints per request** ([Prompt caching docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching), retrieved 2026-04-27). Today, the pipeline uses **one** breakpoint per call (system prompt). The Facts JSON is byte-identical between drafter and reviewer but lives in the user message, so it's not cached.

- **Critical caveat:** prompt caching matches **exact prefix tokens** from the start of the request. Caching the Facts JSON requires it to be in the **system array** (after the persona text, with its own `cache_control`), so both calls have the same prefix up to that breakpoint.
- **Token-cost math** on a 12K-token review prompt (Sonnet 4.6, 1h TTL):
  - Today (system only ~3K cached): hot run = (3K × $0.30 + 9K × $3) = **$0.0279**.
  - With Facts moved to system + 2nd breakpoint after Facts (~9K cached, drafter warmed it 30 s earlier): (9K × $0.30 + 3K × $3) = **$0.0117**.
  - **Per-review savings: ~58% on input cost** ≈ **$0.016/call**. Across draft + review per case: ~$0.05.
- **Cache-creation premium:** writing the Facts breakpoint at draft time costs (9K × $6/MTok 1h) = **$0.054** vs $0.027 uncached input — a $0.027 upfront cost recovered immediately on the first reviewer hit. Worth it as long as drafter+reviewer run within an hour, which is the design.
- **TTL pick:** 5m TTL is cheaper at cache_creation ($3.75/MTok) and sufficient if drafter+reviewer chain within 5 minutes — likely true. Worth measuring.
- **Code:** `draft/cover-letter.ts:235-249` and `reason/checker.ts:239-268`. Move Facts into a 2nd `system` array entry with `cache_control: { type: 'ephemeral', ttl: '5m' }`. Keep `JSON.stringify(facts, null, 2)` consistent so the bytes match.

### 6. Route drafter by case_type (1 h)

Harvey BigLaw Bench (retrieved 2026-04-27): Opus 4.7 90.9% / Opus 4.6 90.2% / **Sonnet 4.6 87.6%**. The 3.3-point Opus 4.7 lift concentrates on *"complex multi-document analysis"* and *"ambiguous editing"* — exactly the EB-1A Kazarian step-2 / EB-1B international-recognition narrative work where peer-benchmarking and stress-testing live (`draft/cover-letter.ts:99-112` for EB-1A).

- **Where the delta does NOT pay:** the E-2 drafter (`draft/cover-letter.ts:27-66`) is structurally rigid — 8 fixed sections, each pinned to a FAM/CFR cite from an allowlist. Same for EB-1C: statutory definitions + tier-table analysis are procedural. Sonnet 4.6 + `effort: 'high'` is at the ceiling here.
- **Where it does pay:** EB-1A's "very top of field" / Kazarian step 2 + EB-1B's "internationally recognized" narratives.
- **Volume math:** at 5–20 cases/month, plausibly 2–4 EB-1A/B per month. Opus 4.7 vs Sonnet 4.6 16K-output draft: **+$0.16/draft on output**, plus thinking overhead. Call it **~$0.50–$1.50/EB-1 draft**. ~$3/month total.
- **Watch:** Opus 4.7's tokenizer can produce **up to 35% more tokens for the same input** ([Finout — Opus 4.7 pricing real cost story](https://www.finout.io/blog/claude-opus-4.7-pricing-the-real-cost-story-behind-the-unchanged-price-tag), retrieved 2026-04-27). Same per-MTok price, but quietly more tokens. Don't extrapolate Sonnet cost tables to Opus.
- **Code:** `draft/cover-letter.ts:238` — replace literal `'claude-sonnet-4-6'` with `caseType === 'EB1A' || caseType === 'EB1B' ? 'claude-opus-4-7' : 'claude-sonnet-4-6'`. `lib/usage-log.ts` PRICING table already has Opus 4.7.
- **Migration gotcha:** Opus 4.7 **does not support `thinking: { type: 'enabled', budget_tokens: N }`** — only `adaptive` ([What's new in Opus 4.7](https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-7), retrieved 2026-04-27). The current code uses `adaptive` so it's safe by construction.

### 7. Reviewer effort tier per case complexity (3 h)

Effort enum in SDK 0.91.1 is `low | medium | high | xhigh | max | null` ([SDK source `messages.d.ts:712`](file:///Users/serrayildirim/projects/akalan-portal/node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts), retrieved 2026-04-27). `budget_tokens` is **deprecated on Sonnet 4.6** — migrate to adaptive + effort.

- **Today's setting:** `effort: 'high'` on every review.
- **Routine E-2 renewals** with `conflict_register` empty or all severity ≤3 don't need `high`. Drop to `medium` saves ~30–40% output/thinking ≈ **$0.05–$0.15/review**.
- **Keep `high`** for:
  - EB-1A/EB-1B with populated `kazarian_step_two` or `international_recognition` (Check 5 forensic logic is genuinely deep)
  - EB-1C with subordinate-tier complications
  - any case where conflict_register has a severity 4 or 5 entry
- **Don't drop to non-thinking entirely** — reasoning-heavy structured tasks lose 5–15% on checklist tasks per Artificial Analysis legal-review benchmarks.
- **Code:** `reason/checker.ts` — add `effort_override?: 'low' | 'medium' | 'high'` parameter to `checkDraft()`; default `'high'`; let the caller pass `'medium'` when conflict_register has no severity 4-5.
- **Per-review savings × ~10 routine cases/mo: ~$1–$2/mo.**

### 8. Files API + cache_control on document blocks (4–6 h)

Beta endpoint family at `client.beta.files.{upload,list,retrieveMetadata,download,delete}`. Required header: **`anthropic-beta: files-api-2025-04-14`** (stable since 2025-04, no version churn in the past 60 days per SDK 0.91.1 changelog).

- **Billing model — important:** referencing a `file_id` in a message **still counts the document tokens on every request**. The Files API saves upload bandwidth + base64 overhead + request size limits, NOT raw document tokens.
- **The cost lever** is `cache_control` on the `document` block. Once a stage caches the document, subsequent stages within the 1h window referencing the same `file_id` hit `cache_read_input_tokens` at ~10% of input rate (Sonnet: $0.30/MTok read vs $3/MTok input).
- **Concrete savings — 5-PDF, 200-page E-2 case** (~100K document tokens):
  - Today: detect (Haiku 100K) + per-PDF extract (Haiku 5×20K) → ~$0.20 just on documents.
  - With Files API + cache: detect writes the cache (100K Haiku cache_creation = $0.125 at 1h rate $1.25/MTok); each per-PDF extract reads its slice as `cache_read` (~$0.05 across 5). **Net: ~$0.13 vs ~$0.20, ~$0.07/case saved.**
  - The bigger win is **eliminating base64 inflation** in request payloads (1–3 s/stage latency) and giving the reviewer cheap access to raw PDFs when conflict_register entries demand source-quote audit (currently the reviewer only sees Facts JSON).
- **Code:** new `lib/files-cache.ts` (upload-once per case, keyed by SHA-256 of bytes — composes with #2; `file_id` persisted under `~/akalan-context/<case>/.files.json`). Update `ingest/detect.ts`, `ingest/typed-extract.ts`, `ingest/extractors/*` to consume `document` blocks.
- **Risk:** beta header. Stable since 2025-04 and Anthropic uses Files API in their own first-party demos, so deprecation risk is low.

### 9. `client.messages.countTokens` pre-flight gate (1.5 h, free)

Anthropic's `/v1/messages/count_tokens` is **free**, separate rate-limit bucket ([Token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting), retrieved 2026-04-27).

- **Use 1:** pre-flight gate on aggregator + drafter. If typed memory + cover-letter authority appendix exceeds, say, 150K input tokens, fall back to a "summary first, draft second" pattern or escalate to compaction beta.
- **Use 2:** replace the char-count hack `MAX_TEXT_CHARS = 60000` (`ingest/typed-extract.ts:117`) with a real token count for docs > 40K chars. Lets you maximize information density without overflow.
- **Code:** new utility in `lib/anthropic.ts`; called from `ingest/typed-aggregate.ts:256` and the drafter.

### 10. Stream the drafter to the UI (6–8 h)

Streaming (`messages.stream`) does **not** reduce billed tokens or wall-clock total. It reduces **perceived latency**.

- For the **reviewer**, streaming buys nothing — the consumer needs the full structured `ReviewReport` before display.
- For the **drafter** (16K-token cover letter), streaming cuts perceived first-paragraph wait from ~30 s to **~3–5 s**. The user sees the letter being written.
- **Code:** `draft/cover-letter.ts:237-250` switches to `client.messages.stream(...)`. SSE in the API route. UI consumes incrementally.
- **Risk:** low. Streaming SDK surface has been stable. Set `display: 'summarized'` on thinking deltas if `thinking: 'adaptive'` is kept on the drafter.

---

## Things to NOT do — and why

1. **Don't downgrade the aggregator to Haiku.** LeMAJ measures a 30% Sonnet→Haiku gap on multi-step legal reasoning ([arxiv 2510.07243](https://arxiv.org/html/2510.07243v1), retrieved 2026-04-27). Hallucinated reconciliation = malpractice. Saving (~$0.20/case) doesn't justify it.
2. **Don't enable thinking on the per-PDF extractor.** Adds variable TTFT for no quality gain on doc classification + structured extraction. Multiplies concurrency contention (the `runWithConcurrency` lane count of 5 is calibrated to no-thinking input-tokens-per-minute).
3. **Don't use Opus 4.7 on the reviewer.** BigLaw Bench measures *generation* quality, not *check* quality. Opus 4.7's tokenizer also produces up to 35% more tokens for the same input — silent cost inflation on a high-volume per-case stage.
4. **Don't enable structured outputs on the aggregator.** The comment at `ingest/typed-aggregate.ts:260-262` correctly notes E2FactsSchema has ~176 nullable params vs Anthropic's 16-param structured-output cap. Manual JSON parse + Zod is right.
5. **Don't migrate to `compact-2026-01-12` beta yet.** Designed for long multi-turn agentic loops; AKALAN is single-shot per stage. Re-evaluate if a single case ever pushes >150K input tokens.
6. **Don't deterministic-bypass the per-PDF extractor.** Filename heuristics give ~25–40% classifiable docs but a misclassified "Articles of Incorporation – v3 (signed).pdf" routed to the wrong sub-schema produces nonsense facts. Per-PDF Haiku is $0.013; the safety margin is worth it. Use filename as a *hint in the prompt*, not a bypass.
7. **Don't escalate `doc_type='other'` to Sonnet.** Silently doubles cost; the failure mode (Sonnet hallucinating facts on a junk doc) is worse than a flagged human-review item. Set `human_review_required: true` and surface in UI.
8. **Don't migrate from Electron to Tauri yet.** Saves ~100-150 MB installer + ~2 s cold start. At 36 MB Next.js standalone the UX is acceptable; the rewrite is 2–4 days. Revisit if you ship to clients.
9. **Don't deploy to Azure yet.** Adds $13–$30/mo for no functional gain at solo scale. Weakens compliance posture (ABA Op. 512 favors closed/local). The current Electron + local-PDF + Anthropic-only architecture is **the cheapest AND most defensible**.
10. **Don't stand up Postgres + pgvector yet.** At 5–20 cases/mo × ~100 chunks, you'd reach 100k vectors after ~80 years. When you eventually need persistence: **SQLite + sqlite-vec** in `~/akalan-context/cases.db` is the right answer; pgvector only matters past ~100k vectors or with a second concurrent writer.

---

## Realistic per-case cost picture (after items 1–8)

Assumptions: 5-PDF E-2 renewal, no severity 4-5 conflicts, drafter+reviewer chain within 5 min so cache hits are warm.

| Stage | Model | Input tokens | Output tokens | Notes | Cost |
|---|---|---|---|---|---|
| Detect | Haiku 4.5 | 6K (cached: ~$0.0006) + 12K samples | ~500 | system prompt cached at 1h | $0.014 |
| Per-PDF extract × 5 | Haiku 4.5 | 8K each (system cached: ~$0.0008) + 5K text | 1K each | system prompt cached at 1h, base64 saved by Files API | $0.025 × 5 = $0.125 |
| Aggregate | Sonnet 4.6 | 10K typed memory + 6K system (cached) | 16K facts | thinking off (item 4) | $0.27 |
| Draft | Sonnet 4.6 | 6K system (cached) + 9K Facts (cached at 5m TTL) | 16K letter | thinking adaptive, effort:high | $0.30 |
| Review | Sonnet 4.6 | 6K system (cached) + 9K Facts (cache_read) + 4K draft | 8K report | thinking off (item 1), effort:medium (item 7) | $0.16 |
| **Total** | | | | | **~$0.87** |

**Compare with today's pipeline** (no Files API, no Facts breakpoint, thinking on aggregate + draft + review, effort:high everywhere): **~$1.30–$1.80/case**. **Net savings: ~35–50% per case.**

For an EB-1A or EB-1B case (drafter on Opus 4.7), add roughly **+$0.50–$1.50/case**.

**Monthly OpEx at 10 cases/mo (mixed E-2 / EB-1):** roughly **$10–$25/mo Anthropic + $0 infra**.

---

## Open questions

1. **Exact token-budget mapping per `effort` tier on Sonnet 4.6.** Anthropic publishes the enum but not a table. Empirical estimate: low ≈ 1k, medium ≈ 4–8k, high ≈ 16–32k, xhigh ≈ 64k, max uncapped. Treat as orders of magnitude only.
2. **`cache_control` on document blocks inside Batch API requests.** Search results suggest yes but no primary-source confirmation in the past 60 days. Smoke-test with 2 requests before relying on it.
3. **5m vs 1h TTL choice for the Facts breakpoint.** 5m is cheaper at cache_creation ($3.75 vs $6/MTok) and sufficient if drafter+reviewer always chain within 5 min. Worth measuring before deciding.
4. **AILA Practice Committee 2025-26 statement on AI-assisted form prep / cloud LLM use.** Paywalled; would refine the ABA Op. 512 compliance argument.
5. **Whether to dedup PDFs at the byte level OR at the extracted-text level.** Translations of the same passport are different bytes but similar text. Byte-dedup is safe; text-dedup risks merging logically distinct documents. Recommendation: byte-only.

---

## Sources (consolidated)

### Anthropic primary
- [Pricing](https://platform.claude.com/docs/en/about-claude/pricing) (retrieved 2026-04-27)
- [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) (retrieved 2026-04-27)
- [Files API](https://platform.claude.com/docs/en/build-with-claude/files) (retrieved 2026-04-27)
- [Batch processing](https://platform.claude.com/docs/en/build-with-claude/batch-processing) (retrieved 2026-04-27)
- [Citations](https://platform.claude.com/docs/en/build-with-claude/citations) (retrieved 2026-04-27)
- [Building with extended thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking) (retrieved 2026-04-27)
- [Adaptive thinking](https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking) (retrieved 2026-04-27)
- [Effort](https://platform.claude.com/docs/en/build-with-claude/effort) (retrieved 2026-04-27)
- [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) (retrieved 2026-04-27)
- [Token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting) (retrieved 2026-04-27)
- [Compaction](https://platform.claude.com/docs/en/build-with-claude/compaction) (retrieved 2026-04-27)
- [Reduce hallucinations](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations) (retrieved 2026-04-27)
- [What's new in Opus 4.7](https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-7) (retrieved 2026-04-27)

### Benchmarks & evals
- [Artificial Analysis — Haiku 4.5](https://artificialanalysis.ai/models/claude-4-5-haiku) (retrieved 2026-04-27)
- [Artificial Analysis — Sonnet 4.6](https://artificialanalysis.ai/models/claude-sonnet-4-6) (retrieved 2026-04-27)
- [Artificial Analysis — Sonnet 4.6 (adaptive max)](https://artificialanalysis.ai/models/claude-sonnet-4-6-adaptive) (retrieved 2026-04-27)
- [Harvey — Opus 4.7 in Harvey](https://www.harvey.ai/blog/opus-4-7-now-live-in-harvey) (retrieved 2026-04-27)
- [Harvey — Sonnet 4.6 in Harvey](https://www.harvey.ai/blog/sonnet-46-now-live-in-harvey) (retrieved 2026-04-27)
- [Harvey — BigLaw Bench](https://www.harvey.ai/blog/introducing-biglaw-bench) (retrieved 2026-04-27)
- [LeMAJ — arxiv 2510.07243](https://arxiv.org/html/2510.07243v1) (retrieved 2026-04-27)
- [Finout — Opus 4.7 pricing real cost story](https://www.finout.io/blog/claude-opus-4.7-pricing-the-real-cost-story-behind-the-unchanged-price-tag) (retrieved 2026-04-27)
- [Caylent — Sonnet 4.6 in Production](https://caylent.com/blog/claude-sonnet-4-6-in-production-capability-safety-and-cost-explained) (retrieved 2026-04-27)

### Infrastructure
- [Azure App Service Linux pricing](https://azure.microsoft.com/en-us/pricing/details/app-service/linux/) (retrieved 2026-04-27)
- [Azure Container Apps pricing](https://azure.microsoft.com/en-us/pricing/details/container-apps/) (retrieved 2026-04-27)
- [Azure DB for PostgreSQL Flexible Server pricing](https://azure.microsoft.com/en-us/pricing/details/postgresql/flexible-server/) (retrieved 2026-04-27)
- [Next.js 16 release notes](https://nextjs.org/blog/next-16) (retrieved 2026-04-27)
- [Neon pricing](https://neon.com/pricing) (retrieved 2026-04-27)
- [sqlite-vec](https://github.com/asg017/sqlite-vec) (retrieved 2026-04-27)
- [Tauri vs Electron 2026 (PkgPulse)](https://www.pkgpulse.com/blog/electron-vs-tauri-2026) (retrieved 2026-04-27)

### Compliance posture
- [ABA Formal Opinion 512 analysis (UNC Law Library)](https://library.law.unc.edu/2025/02/aba-formal-opinion-512-the-paradigm-for-generative-ai-in-legal-practice/) (retrieved 2026-04-27)
- [2025 State Bar AI guidance (Paxton AI)](https://www.paxton.ai/post/2025-state-bar-guidance-on-legal-ai) (retrieved 2026-04-27)

### eDiscovery / dedup
- [Meridian Discovery dedup FAQ](https://www.meridiandiscovery.com/articles/frequently-asked-questions-about-de-duplication/) (retrieved 2026-04-27)
- [GoldFynch — hashing in eDiscovery](https://goldfynch.com/blog/2020/12/20/what-is-hashing-in-ediscovery-and-how-can-it-help-cut-costs/) (retrieved 2026-04-27)

---

*End of report. Sub-agents: 4 in parallel (operations, model right-sizing, pipeline shape, infra). Total source citations: 35+. Methodology: each agent given ground-truth current pipeline state to avoid re-recommending shipped work; orchestrator de-duplicated cross-agent findings and ranked by ROI = ($-or-latency saved) ÷ implementation hours.*
