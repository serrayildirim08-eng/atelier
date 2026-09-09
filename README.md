# Atelier

**An AI paralegal for evidence-heavy legal drafting.** Drop a case folder in, get a structured fact record, a drafted brief, and a reviewer pass that checks the draft against the evidence — with every model call logged.

Built solo by an attorney who got tired of doing the same forensic reading by hand. First workflow shipped: US business-immigration petitions (E-2, EB-1A / EB-1B / EB-1C). The pipeline is domain-agnostic; the prompts and schemas are the only immigration-specific parts.

## How it works

```
case folder (PDFs, scans, images)
   │
   ▼
ingest/    detect file types → parse PDFs (pdf-parse) → vision pass for scans
           → Claude extracts facts into a typed schema (zod) with exhibit references
   │
   ▼
reason/    checker audits the draft against the extracted record:
           unsupported claims, missing exhibits, weakest counter-argument
   │
   ▼
draft/     Claude drafts the cover letter / petition memorandum in the firm's voice
   │
   ▼
lib/       Anthropic client, per-stage audit trail, usage + cost log
```

- **Provenance first.** Every extracted fact carries an exhibit reference; the reviewer flags anything in the draft that the record doesn't support.
- **Structured, not freeform.** Extraction and review are schema-validated (zod) so downstream steps can trust the shape.
- **Auditable.** Each stage writes to an audit log (`lib/audit.ts`) and a usage log (`lib/usage-log.ts`).

## Governance controls, mapped to the EU AI Act

Atelier is a drafting aid for a lawyer, not a decision system, and it is not itself a high-risk AI system under Annex III. The table exists because the controls it implements are the ones the AI Act asks of high-risk systems (Chapter III, Section 2), and because they are the right controls for any legal-AI tool regardless of classification.

| Control in Atelier | Where the AI Act asks for it |
|---|---|
| Every extracted fact is stored with its source page, verbatim quote and confidence; an unsupported value is `null`, never inferred (`ingest/schema.ts`) | Art. 10 data governance · Art. 13 transparency to deployers |
| Every model call is logged with model, token classes and cost, append-only, mirrored to an observability service (`lib/usage-log.ts`, `lib/audit.ts`) | Art. 12 record-keeping (automatic logging) · Art. 11 technical documentation |
| Closed citation allowlist: the drafter may cite only listed authorities or must write `[CITE NEEDED]` and stop (`draft/cover-letter.ts`) | Art. 15 accuracy and robustness · Art. 9 risk controls for a known failure mode (invented case law) |
| Severity-graded contradiction detection (1–5) with a dispositive HALT that stops the pipeline and routes the file to an attorney (`ingest/claude.ts`) | Art. 14 human oversight (an operator who can interrupt the system) |
| Gap markers (`[MISSING]`, `[WEAK]`, `[INSUFFICIENT CRITERIA]`) are mandatory output; the reviewer is told they are correct, not defects | Art. 13 transparency · Art. 14 human oversight |
| Independent reviewer model audits the draft against the fact record on five checks and returns a ready / not-ready verdict (`reason/checker.ts`) | Art. 9 testing and validation · Art. 15 accuracy · Art. 17 quality management |
| Evidence rubric (probative value × independence × corroboration → 3–9 → RFE risk) applied at extraction and enforced at review | Art. 9 risk management · Art. 15 accuracy |
| Local-first desktop build: client PDFs never leave the machine; API keys in the OS keychain | GDPR Art. 25 data protection by design · Art. 32 security |
| Every drafting decision is a draft that a person must accept; no automated legal decision is ever issued by the system | Art. 14 human oversight · GDPR Art. 22 automated decision-making |

Article numbers refer to Regulation (EU) 2024/1689. Mapping written by the author; it is a design statement, not a conformity assessment.

## Stack

Next.js (App Router) · TypeScript · Tailwind · Anthropic SDK · zod · pdf-parse · Postgres + pgvector (docker-compose) · Electron desktop build (electron-builder, macOS + Windows)

## Run it

```bash
cp .env.example .env.local     # add your Anthropic key
docker compose up -d           # Postgres + pgvector
npm install
npm run dev                    # web: http://localhost:3000
npm run electron:dev           # desktop shell
```

## Layout

```
app/          Next.js UI + /api/ingest route
ingest/       detect · pdf · vision · claude · schema
reason/       checker · schema
draft/        cover-letter
lib/          anthropic · audit · usage-log
electron/     main · preload
db/init/      Postgres extensions (pgvector)
research/     design notes and frontier research that shaped the architecture
```

## Status

Working MVP (v0.2). Roadmap items live in `research/`: Citations-API-based provenance, firm-voice style extraction, and a broader set of drafting workflows beyond immigration.

## Author

Serra Yıldırım — attorney (Istanbul Bar), LL.M. Law & Technology candidate at Erasmus University Rotterdam. Built with Claude Code.
