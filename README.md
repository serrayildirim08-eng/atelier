# Atelier

An AI paralegal for US business-immigration petitions. Atelier takes the PDFs of a case, detects
the visa category (E-2, EB-1A, EB-1B or EB-1C), extracts the case facts into a typed record with
per-field provenance, drafts a cover letter from that record, and runs an independent reviewer pass
that audits the draft against the record.

It runs as a single-user Electron desktop application around a Next.js server; in packaged builds
that server is bound to the loopback interface. Every stage is a call to the Anthropic API. The
output is a draft for an attorney to read, edit and sign; Atelier has no filing or submission integration.

---

## Architecture

```
┌──────────────────────── Electron 33 main process (electron/main.cjs) ────────────────────────┐
│  spawns the Next.js standalone server on a free port, HOSTNAME=127.0.0.1                     │
│  BrowserWindow: contextIsolation · sandbox · nodeIntegration: false                          │
│  new-window requests (window.open, target=_blank) → system browser; new windows denied       │
└──────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                               │ POST /api/ingest  (multipart, field "files")
                                               ▼
┌──────────────────────── app/api/ingest/route.ts (Node runtime) ──────────────────────────────┐
│  per uploaded file, in parallel (Promise.all):                                               │
│                                                                                              │
│  ingest/pdf.ts      pdf-parse v2: per-page text with [page N] markers                        │
│                     < 50 chars/page → treated as a scan                                      │
│  ingest/detect.ts   case type: E2 | EB1A | EB1B | EB1C            claude-haiku-4-5           │
│  ingest/claude.ts   text PDFs: fact extraction, Citations API     claude-sonnet-4-6          │
│  ingest/vision.ts   scanned PDFs: page images → extraction        claude-sonnet-4-6          │
│  draft/             cover letter (Markdown)                       claude-opus-4-7            │
│  reason/            reviewer: draft vs. extracted facts           claude-opus-4-7            │
│                                                                                              │
│  lib/usage-log.ts   append-only JSONL cost ledger  ──►  lib/audit.ts (optional Langfuse)     │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

| Layer | Technology |
| --- | --- |
| Desktop shell | Electron 33, electron-builder 25 (macOS dmg arm64/x64, Windows NSIS x64) |
| Application | Next.js 16.2 (App Router, `output: 'standalone'`), React 19.2, TypeScript (strict), Tailwind CSS 4 |
| Model access | `@anthropic-ai/sdk` |
| Schemas | zod 4 |
| PDF handling | pdf-parse 2.4.5 (text extraction and page rendering) |

---

## Pipeline

Each uploaded PDF runs through four stages; extraction has a text variant and a scan variant. A failure at any stage is returned as a typed error
object for that file (`pdf_parse_failed`, `detection_failed`, `extraction_failed`,
`vision_extraction_failed`, `draft_failed`, `review_failed`); other files in the same request are
unaffected.

| Stage | Module | Model | Input sent to the API | Output contract |
| --- | --- | --- | --- | --- |
| Detect | `ingest/detect.ts` | `claude-haiku-4-5` | First 4,000 characters of the extracted text | `DetectionSchema`: case type, confidence 0–1, reasoning, verbatim evidence quotes |
| Extract (text) | `ingest/claude.ts` | `claude-sonnet-4-6` | Full extracted text as a `document` block with citations enabled | Per-case-type facts schema, validated with `Schema.parse` |
| Extract (scan) | `ingest/vision.ts` | `claude-sonnet-4-6` | Pages rendered to PNG at 2x scale, capped at 20 pages | Same facts schema, via structured outputs |
| Draft | `draft/cover-letter.ts` | `claude-opus-4-7` | The extracted facts JSON | Free-text Markdown letter (no schema) |
| Review | `reason/checker.ts` | `claude-opus-4-7` | The extracted facts JSON and the draft | `ReviewReportSchema` |

The draft and review stages operate on the extracted record, not on the source PDFs. The reviewer
therefore checks the draft for consistency with what extraction produced; errors introduced at
extraction are not visible to it.

Each system prompt carries a `cache_control` breakpoint with a 1-hour TTL, as does the document
block on the text-extraction path.

---

## Deterministic core, probabilistic edge

Model output is treated as untrusted input and is validated before the next stage consumes it.

1. **Schema-bound outputs.** Detection, scanned-PDF extraction and review use `messages.parse` with
   `zodOutputFormat(...)`; each throws if `parsed_output` is missing, so a malformed response
   becomes a typed per-file error rather than partial data.
2. **Text extraction with citations.** The Citations API cannot be combined with structured
   outputs, so the text path concatenates the response's text blocks, isolates the outermost JSON
   object, runs `JSON.parse`, then validates with the case type's zod schema
   (`ingest/claude.ts:342-370`). Citation metadata is returned by the API but is not yet mapped
   onto the schema fields.
3. **Per-field provenance.** Every leaf fact in the four facts schemas is wrapped as
   `{ value, source_page, source_quote, confidence }`, each nullable (`ingest/schema.ts:8-14`).
   The extraction prompt requires all four to be `null` when the source does not support a value.
   Some fields additionally carry document references (`exhibits_referenced`, `evidence_doc`,
   `source_doc`, `fact_a_doc` / `fact_b_doc`).
4. **Case-type discrimination.** `CaseFacts` is a discriminated union on `case_type`; detection,
   extraction, drafting and review each select their prompt and schema from that key.
5. **Typed review verdict.** The reviewer returns `overall_assessment` as one of `ready`,
   `minor_revisions`, `major_revisions` or `not_ready`, plus arrays of inconsistencies
   (`hallucination`, `contradicts_facts`, `internal_inconsistency`), missing arguments and weak
   spots, each with a `critical` / `major` / `minor` severity (`reason/schema.ts`).

The following controls are expressed in prompts only and are not enforced by code:

- The drafter may cite only authorities listed in its prompt and must otherwise write
  `[CITE NEEDED: <subject>]`. There is no post-generation citation check.
- Gap markers (`[MISSING: …]`, `[WEAK: …]`, `[INSUFFICIENT CRITERIA: …]`) are required by the
  drafting prompt; the reviewer prompt instructs the model to treat them as correct output.
- The extraction schema includes a `conflict_register` with a 1–5 severity scale, where the prompt
  defines 5 as dispositive. The route does not branch on severity: drafting and review run for every
  successfully extracted file.
- For EB-1A and EB-1B, an evidence scoring rubric (probative value, independence, corroboration,
  summed to 3–9 and mapped to an RFE-risk band) is defined in the prompt and bounded by the schema.
  The sum and the band mapping are produced by the model and are not recomputed in code.

---

## Data handling

- **Uploads** are read into memory as `Buffer`s (`route.ts:45`). The application does not write
  documents, extracted text, facts, drafts or reviews to disk or to a database; results are returned
  in the HTTP response and held in the renderer's state.
- **Documents are sent to the Anthropic API.** On the text path the full extracted text of each PDF
  is sent; on the scan path, rendered page images for up to 20 pages. The detected case type, the
  extracted facts and the draft are sent on later calls. No redaction is applied before these calls.
- **Accepted input** is checked by `.pdf` filename extension only (`route.ts:38`). There is no size
  limit, MIME or magic-byte check, or page cap on the text path.
- **Credentials** are read from environment variables (`.env.local` in development). The Anthropic
  client is constructed with SDK defaults and reads `ANTHROPIC_API_KEY`.
- **Network surface.** In the packaged app the Next.js server listens on `127.0.0.1` on a free port.
  There is no authentication layer; the design assumes a single local user.

---

## Logging

| Sink | Contents | Behaviour |
| --- | --- | --- |
| `db/cost.jsonl` (`lib/usage-log.ts`) | Timestamp, stage, model, case type, input / output / cache-creation / cache-read tokens, estimated USD cost | Append-only JSONL, one row per successful model call. Path overridable with `COST_LOG_PATH`. Gitignored. Write failures are logged and never block the request. |
| Langfuse (`lib/audit.ts`) | The same usage metadata as a `generation-create` event | Fire-and-forget `fetch` with a 2-second timeout. No-op unless `LANGFUSE_HOST`, `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` are all set. Events are not grouped into per-case traces. |

Neither sink records prompts, document content or model outputs. A usage row is written only after
a call succeeds (and, for schema-bound stages, after validation), so failed calls are not recorded.

---

## Governance controls, mapped to the EU AI Act

Atelier is a drafting aid for a lawyer, not a decision system. The table maps implemented controls
to the articles of Regulation (EU) 2024/1689 that address the same concern. It is a design
statement by the author, not a conformity assessment.

| Control | Status | Related provision |
| --- | --- | --- |
| Per-field `source_page`, `source_quote`, `confidence`; nullable when unsupported (`ingest/schema.ts`) | Implemented (schema); null-when-unsupported is a prompt rule | Art. 10 data governance · Art. 13 transparency |
| Append-only usage and cost ledger per model call, optional Langfuse mirror (`lib/usage-log.ts`, `lib/audit.ts`) | Implemented; records usage metadata, not inputs or outputs | Art. 12 record-keeping (partial) |
| Independent reviewer returning a schema-typed readiness verdict (`reason/checker.ts`, `reason/schema.ts`) | Implemented | Art. 9 risk management · Art. 15 accuracy |
| Closed citation allowlist with `[CITE NEEDED]` fallback (`draft/cover-letter.ts`) | Prompt-level only | Art. 15 accuracy |
| Mandatory gap markers in drafts | Prompt-level only | Art. 13 transparency · Art. 14 human oversight |
| Output is a draft only; no filing, submission or client-facing action exists in the system | Implemented (by absence of any such integration) | Art. 14 human oversight |
| Pipeline halt on dispositive (severity 5) conflicts, routed to attorney review | Planned | Art. 14 human oversight |

---

## Getting started

Requirements: Node.js and npm. An Anthropic API key.

```bash
cp .env.example .env.local     # set ANTHROPIC_API_KEY
npm install
npm run dev                    # Next.js at http://localhost:3000
npm run electron:dev           # Next.js dev server + Electron window
npm run lint
```

Packaging (runs `next build`, then electron-builder; output in `dist-electron/`):

```bash
npm run electron:build         # current platform
npm run electron:build:mac     # dmg, arm64 + x64
npm run electron:build:win     # NSIS installer, x64
```

Environment variables used by the code:

| Variable | Required | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Yes | All model calls; the ingest route returns 500 without it |
| `LANGFUSE_HOST`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` | No | Enables the Langfuse mirror |
| `COST_LOG_PATH` | No | Overrides the cost ledger path (default `db/cost.jsonl`) |

`.env.example` also lists `OPENAI_API_KEY` and `DATABASE_URL`; no code reads them.
`docker-compose.yml` starts a `pgvector/pgvector:pg16` container whose init script only enables the
`vector` extension. The application does not connect to it, and it is not needed to run Atelier.

---

## Repository layout

```
app/                Next.js UI (app/page.tsx) and the ingest route (app/api/ingest/route.ts)
ingest/             pdf · detect · claude (text extraction) · vision (scan extraction) · schema
draft/              cover-letter drafter and per-case-type prompts
reason/             reviewer and review-report schema
lib/                Anthropic client · usage/cost ledger · Langfuse hook
electron/           main process and preload (exposes only platform and isDesktop)
db/init/            Postgres init script (enables pgvector; no tables)
docker-compose.yml  Postgres container (not used by the application yet)
research/           design and research notes that informed the architecture
```

---

## Roadmap and known gaps

- **Tests and CI.** There is no test suite and no CI workflow.
- **Enforced halt.** Severity-5 conflicts are recorded in the facts but do not stop drafting.
- **Citation enforcement.** Draft citations are not checked against the allowlist in code, and
  Citations API metadata is not yet mapped onto `source_page` / `source_quote`.
- **Upload validation.** Size limits, content-type and magic-byte checks, and a page cap for the
  text path.
- **Scan truncation signal.** The vision path sets a `truncated` flag at 20 pages, but it is not
  propagated to the API response or UI.
- **Redaction.** No PII redaction before content is sent to the model provider.
- **Credential storage.** Keys are read from environment variables; OS keychain storage is not
  implemented.
- **Retries.** No application-level retry or backoff around model calls.
- **Persistence and retrieval.** No database schema, persistence layer or vector retrieval; the
  pgvector container is groundwork only.
- **Audit trail.** Per-case trace grouping in Langfuse, and logging of failed calls.

## Status

MVP, version 0.1.0 (`package.json`).

## Author

Serra Yıldırım — attorney (Istanbul Bar), LL.M. Law & Technology candidate at Erasmus University Rotterdam. Built with Claude Code.
