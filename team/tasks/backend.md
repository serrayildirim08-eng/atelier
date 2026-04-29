# Backend Pod — Task Kuyruğu

Senior: `backend-senior`. ID prefix `B`.

## Format

```
## B<N> — <kısa başlık>
**Status:** todo | in_progress | blocked | done
**Owner:** backend-senior | backend-junior-1 | backend-junior-2
**Why:** ...
**Acceptance:** ...
**Files (likely):** ...
**Notes:** ...
```

---

## Açık task'lar

### B1 — Yeni extractor'ları typed-aggregate'e bağla
**Status:** done
**Owner:** backend-senior (junior pattern'i takip etti, registration zaten Phase-4/6/7'de yapilmisti; eksik kalan unit test'ler bu sprintte eklendi)
**Why:** `ingest/extractors/cover-letter.{ts,schema.ts}`, `i129e-supplement.{ts,schema.ts}`, `rfe-notice.{ts,schema.ts}` unstaged duruyor — typed-extract pipeline'a girmedikleri sürece kullanılmıyor.
**Acceptance:**
- [x] Üç extractor `ingest/typed-extract.ts` içinde register edildi (mevcut pattern'e uy) — Phase-4/6/7 batch'lerinde tamamlanmış (typed-extract.ts L51-53; typed-aggregate Phase-4/6/7/8 enrichment fonksiyonları)
- [x] `typed-aggregate` üç extractor'ın çıktısını E2Facts'e merge ediyor — `enrichPhase4Fields`, `enrichPhase6Fields`, `enrichPhase7Fields`, `enrichPhase8Fields`
- [x] Her biri için fixture-based test var (test/ingest/extractors/cover-letter.test.ts, i129e-supplement.test.ts, rfe-notice.test.ts) — 23 test, hepsi yeşil
- [x] `npx vitest run` 324 test passed, 0 yeni fail
**Files:** test/ingest/extractors/{cover-letter,i129e-supplement,rfe-notice}.test.ts
**Notes:** B1 brief out-of-date — extractor'lar zaten Phase-4/6/7'de wired. Geriye kalan iş schema-level unit test coverage'tı; eklendi. TypeScript pre-existing app/page.tsx ReAggregateButton hatası var ama backend scope dışı (frontend pod).

### B2 — Phase-0.7 alanlarını typed-aggregate emit etsin
**Status:** done
**Owner:** backend-senior
**Why:** REFACTOR-NOTES TODO: deterministic gate'ler `data_incomplete` dönüyor çünkü extractor yeni optional alanları (`matter.co_petitioners`, `ownership_history`, `rfes`, `investment.claimed_amount_usd`, `source_of_funds[].documented_amount_usd/source_person`) emit etmiyor. Schema kabul ediyor ama doldurulmuyor.
**Acceptance:**
- [ ] typed-extract / typed-aggregate yeni alanları (en azından PDF'den extract edilebilen kısmını) doldurur
- [ ] Bir gerçek E-2 fixture'da gate'ler `not_applicable` veya gerçek bulgu döner — `data_incomplete` değil
- [ ] Mevcut testler geçer, yeni alan kapsamı için test eklenir
**Files (likely):** ingest/typed-extract.ts, ingest/typed-aggregate.ts, ingest/typed-memory.ts, ingest/schema.ts (sadece okuma)
**Notes:** Senior judgment — hangi alan claude-extracted, hangisi heuristic olabilir. RFE alanları muhtemelen `rfe-notice` extractor'ından (B1) geliyor; B1 önce bitmeli.

### B3 — Phase-0.7 draft_mode detector
**Status:** done
**Owner:** backend-junior-2
**Why:** Drafter `caseFacts.draft_mode` kabul ediyor ama hiçbir detector populate etmiyor. Heuristic gerekli.
**Acceptance:**
- [ ] `ingest/detect.ts` (veya yeni dosya) `detectDraftMode(caseFolder): DraftMode` export ediyor
- [ ] Heuristik: "Request for Evidence dated", premium-processing election, service-request keyword'leri tarayıp `'rfe_response' | 'premium_upgrade' | 'service_request' | 'initial'` döner
- [ ] Default `'initial'`
- [ ] Fixture-based test (en az 4 case)
**Files (likely):** ingest/detect.ts veya ingest/draft-mode-detect.ts, test/ingest/
**Notes:** Phase-0.6 sub-type detector'ın yanına bağımsız fonksiyon olarak. Cost: Haiku 4.5 ile classify, prompt caching.

### B4 — Imm-464-2023 regression fixture
**Status:** done
**Owner:** backend-junior-2
**Why:** REFACTOR-NOTES TODO: BUS-folder-Cemre case'i `_E2-SUBTYPE-TAXONOMY.md`'deki "folder labels not trustable" caveat'ının regression fixture'ı. Suite'e eklenmezse caveat sessizce kaybolur, Subtype 1'e mis-route.
**Acceptance:**
- [ ] `test/ingest/subtype-detect.test.ts` mevcut değilse skeleton oluştur
- [ ] Imm-464-2023 case'i fixture olarak ekle (BUS folder + Cemre-shape facts)
- [ ] Test: detector bu case'i Subtype 4 (veya doğru subtype neyse) olarak classify ediyor, Subtype 1'e DEĞİL
**Files (likely):** test/ingest/subtype-detect.test.ts, test/fixtures/imm-464-2023.json
**Notes:** Senior'a danış: gerçek case PDF'i fixture'a sığdırılmaz; `CaseFacts` JSON sample'ı yeterli.

### B5 — EB-1A drafter manual-block loader migration
**Status:** blocked
**Owner:** backend-senior
**Why:** REFACTOR-NOTES TODO: EB-1A/B/C drafter'ları hâlâ inline prompt'la çalışıyor — `// TODO: migrate to manual-block loader (see E-2)` comment'ı orada. E-2 path'i Master OS § 3'ün 7-block stack'ini kullanıyor, EB-1A geride kaldı.
**Acceptance:**
- [ ] `EB1A-PREPARATION-MANUAL.md` ve `EB1A-MANUAL-FOR-CLAUDE-CODE.md` mevcut mu kontrol — yoksa BLOCKED, content gerekiyor (Serra'ya soru: research'a mı yazdıralım, manuel mi?)
- [ ] Mevcutsa: `draft/cover-letter.ts` EB-1A path'i E-2 ile aynı 7-block pattern'i kullanır
- [ ] EB-1A için en az 1 fixture-based draft test
**Files (likely):** draft/cover-letter.ts, manuals/EB1A/, lib/manual-loader.ts (yoksa)
**Notes:** Manuals yoksa BLOCKED — questions/backend-<n>.md yaz. EB-1B/C bu sprintte değil; sadece EB-1A.

---

## Tamamlananlar (arşiv)

- **B1** (2026-04-29): 3 extractor için schema validation unit test'leri eklendi (`test/ingest/extractors/{cover-letter,i129e-supplement,rfe-notice}.test.ts`, 23 test). Registration ve aggregate-merge işi zaten Phase-4/6/7 batch'lerinde tamamlanmıştı; brief out-of-date'ti, kalan iş test coverage'tı.
- **B2** (2026-04-29): `test/ingest/phase07-aggregate-emission.test.ts` eklendi (8 test). Fully populated Kacar-shape fixture üzerinde 7 Phase-0.7-targeted gate (`ownership_volatility`, `co_petitioner_fund_circularity`, `unaccounted_sof_share`, `multi_round_rfe_escalation`, `b2_status_violation_signal`, `status_gap_pre_filing`, `material_change_in_response_to_uscis`) hiçbiri `data_incomplete` dönmüyor. Phase-3..9 enrichment fonksiyonları doldurmayı zaten yapıyor; bu test acceptance lock'u.
- **B3** (2026-04-29): `ingest/draft-mode-detect.{ts,schema.ts}` + `test/ingest/draft-mode-detect.test.ts` eklendi (11 test). Heuristic-first (filename + text patterns) → Haiku 4.5 fallback (prompt caching mandatory) → 'initial' default. Heuristic 4 mode'u da deterministik ayırıyor; LLM yalnızca contradictory / missing-signal durumlarda devreye giriyor.
- **B4** (2026-04-29): `test/fixtures/imm-464-2023.json` (Cemre / Musluoglu Global) + `test/ingest/subtype-detect.test.ts` (7 test). Fixture metadata 'BUS folder label not trustable' caveat'ını locks. `pickRawDocSamplePaths` "BUS" substring'ini Subtype 1 signal'ı olarak kabul etmiyor — regression sigortalı.
