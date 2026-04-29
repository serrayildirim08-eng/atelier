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
**Status:** todo
**Owner:** backend-junior-1
**Why:** `ingest/extractors/cover-letter.{ts,schema.ts}`, `i129e-supplement.{ts,schema.ts}`, `rfe-notice.{ts,schema.ts}` unstaged duruyor — typed-extract pipeline'a girmedikleri sürece kullanılmıyor.
**Acceptance:**
- [ ] Üç extractor `ingest/typed-extract.ts` içinde register edildi (mevcut pattern'e uy)
- [ ] `typed-aggregate` üç extractor'ın çıktısını E2Facts'e merge ediyor
- [ ] Her biri için fixture-based test var (test/ingest/extractors/)
- [ ] `npx tsc --noEmit` clean, `npx vitest run` 0 yeni fail
**Files (likely):** ingest/typed-extract.ts, ingest/typed-aggregate.ts, test/ingest/extractors/
**Notes:** Pattern için mevcut extractor'lardan birini referans al. pdf-parse v2 API zorunlu.

### B2 — Phase-0.7 alanlarını typed-aggregate emit etsin
**Status:** todo
**Owner:** backend-senior
**Why:** REFACTOR-NOTES TODO: deterministic gate'ler `data_incomplete` dönüyor çünkü extractor yeni optional alanları (`matter.co_petitioners`, `ownership_history`, `rfes`, `investment.claimed_amount_usd`, `source_of_funds[].documented_amount_usd/source_person`) emit etmiyor. Schema kabul ediyor ama doldurulmuyor.
**Acceptance:**
- [ ] typed-extract / typed-aggregate yeni alanları (en azından PDF'den extract edilebilen kısmını) doldurur
- [ ] Bir gerçek E-2 fixture'da gate'ler `not_applicable` veya gerçek bulgu döner — `data_incomplete` değil
- [ ] Mevcut testler geçer, yeni alan kapsamı için test eklenir
**Files (likely):** ingest/typed-extract.ts, ingest/typed-aggregate.ts, ingest/typed-memory.ts, ingest/schema.ts (sadece okuma)
**Notes:** Senior judgment — hangi alan claude-extracted, hangisi heuristic olabilir. RFE alanları muhtemelen `rfe-notice` extractor'ından (B1) geliyor; B1 önce bitmeli.

### B3 — Phase-0.7 draft_mode detector
**Status:** todo
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
**Status:** todo
**Owner:** backend-junior-2
**Why:** REFACTOR-NOTES TODO: BUS-folder-Cemre case'i `_E2-SUBTYPE-TAXONOMY.md`'deki "folder labels not trustable" caveat'ının regression fixture'ı. Suite'e eklenmezse caveat sessizce kaybolur, Subtype 1'e mis-route.
**Acceptance:**
- [ ] `test/ingest/subtype-detect.test.ts` mevcut değilse skeleton oluştur
- [ ] Imm-464-2023 case'i fixture olarak ekle (BUS folder + Cemre-shape facts)
- [ ] Test: detector bu case'i Subtype 4 (veya doğru subtype neyse) olarak classify ediyor, Subtype 1'e DEĞİL
**Files (likely):** test/ingest/subtype-detect.test.ts, test/fixtures/imm-464-2023.json
**Notes:** Senior'a danış: gerçek case PDF'i fixture'a sığdırılmaz; `CaseFacts` JSON sample'ı yeterli.

### B5 — EB-1A drafter manual-block loader migration
**Status:** todo
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

_—_
