# Atelier — Aktif Roadmap (takım için)

**Kanonik roadmap:** `~/akalan-context/ROADMAP.md` (5 faz, 10 hafta)
**Doktriner referanslar:** `~/akalan-context/E2_Doctrinal_Briefing_2026.md`, `~/akalan-context/akalan-research-agent.md`
**Repo:** `~/projects/akalan-portal`

## Şu an neredeyiz

> Bu bölümü Serra her sprint başında günceller. Pod'lar her oturumda buradan başlar.

**Aktif faz:** Phase 3–4 (Ingest + Reasoning/Drafting). Demo target hâlâ E-2.
**Mevcut modüller:** `ingest/`, `research/`, `manuals/`, `reason/`, `draft/`, `app/`, `ui/`, `lib/`
**Son refactor notları:** `REFACTOR-NOTES-2026-04-29.md`

## Bu sprintin hedefi

- [ ] _Serra burayı doldurur — örnek: "E-2 case folder drop'tan cover letter çıkana kadar uçtan uca tek bir test case'i yeşillendir"_

## Pod'ların sorumluluk alanı

### Backend pod (lider: `backend-senior`)
- `ingest/` — PDF parse (pdf-parse v2), case-type detection (Haiku 4.5), fact extraction (Sonnet 4.6), `CaseFacts` discriminated union
- `reason/` — pre-submission reviewer (Opus 4.7, adaptive thinking)
- `draft/` — cover letter drafter (Opus 4.7, strict authority allowlists)
- `research/` — manuals üretimi (akalan-research-agent.md spec'ine göre)
- `db/` — Postgres + pgvector schema, migration'lar
- `lib/` — shared util'ler, Anthropic SDK wrapper'ları (prompt caching mandatory)

### Frontend pod (lider: `frontend-senior`)
- `app/` — Next.js App Router sayfaları
- `ui/` — paylaşılan component'lar
- `electron/` — masaüstü kabuk (varsa frontend dokunur)
- Loading / error / empty state'leri Atelier'in luxury-editorial estetiğinde

### Design (`ui-designer`)
- Yeni feature spec'leri → `team/design/<feature>/spec.md` + `prototype.html`
- Mevcut ekran audit'leri
- Design token guardian'lığı (ceramic / cream / sage / sky paleti)

## Sınırlar (hiç dokunulmaz)

- `~/Documents/Claude/Projects/AKALAN Portal/` (TCC sandbox)
- Production Azure / Supabase config
- Engagement letter AI clause, HITL boundary, citation verification (11 stop-points'tan biri)
- LawPay, Langfuse persistence settings

Bu sınırlardan birine dokunulması gerekiyorsa pod questions/ altına yazar.
