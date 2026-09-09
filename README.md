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
