# Frontend Pod — Task Kuyruğu

Senior: `frontend-senior`. ID prefix `F`.

## Format

```
## F<N> — <kısa başlık>
**Status:** todo | in_progress | blocked | done
**Owner:** frontend-senior | frontend-junior-1 | frontend-junior-2
**Design ref:** team/design/<feature>/spec.md (varsa)
**Why:** ...
**Acceptance:** ...
**Files (likely):** ...
**Notes:** ...
```

---

## Açık task'lar

### F1 — Modified intake/ingest akışını PR-hazır hale getir
**Status:** blocked
**Owner:** frontend-senior
**Blocker:** D1 bitmeli (DNA netleşmeli; intake form ve dashboard luxury-editorial gözden geçirilecek)
**Why:** `app/page.tsx`, `app/api/ingest-path/route.ts`, `app/api/ingest/route.ts` modified ama commit edilmedi. Akış şu an staging'de — gerçek bir E-2 fixture'la uçtan uca yeşillenmesi lazım, yoksa B1/B2 backend tarafı UI'da görünmüyor.
**Acceptance:**
- [ ] Yerel `next dev` ile bir gerçek E-2 case folder ingest edilebiliyor (intake → ingest → dashboard)
- [ ] Loading state'i (LoadingProgress component) doğru per-PDF counter veriyor
- [ ] Error state'i sessiz şekilde fail ediyor (bkz F3)
- [ ] Console temiz, no React key warnings, no a11y warnings
- [ ] Browser'da happy path + 1 edge case (boş klasör veya bozuk PDF) test edildi
**Files (likely):** app/page.tsx, app/api/ingest{,-path}/route.ts, ui/
**Notes:** UI testlerini VERIFIED gözle yap — type check ve unit test feature correctness'i doğrulamaz. Screenshot al, raporda mention et.

### F2 — Reviewer panelinde deterministic gate sonuçları
**Status:** todo
**Owner:** frontend-junior-1
**Design ref:** team/design/reviewer-gates/spec.md (D2 üretecek — yoksa BLOCKED)
**Why:** `runFullReview` artık `{deterministic: GateRunResult[], llm: ReviewResult}` dönüyor. Backend tarafı bitmiş ama UI hâlâ sadece llm tarafını gösteriyor. Attorney deterministic gate'leri standalone audit edebilmeli.
**Acceptance:**
- [ ] Reviewer panel `## Pre-firing deterministic gate hits` başlığı altında fired gate'leri listeler
- [ ] Severity 4 vs 5 görsel olarak ayrı (D2 spec'ine göre)
- [ ] `not_applicable` ve `data_incomplete` outcome'ları collapsed by default, expand ile görünür
- [ ] Authority cite'i (e.g. "9 FAM 402.9-7(1)") her fired gate'de gösterilir
**Files (likely):** ui/reviewer/, app/matter/
**Notes:** D2 spec gelmeden başlama — yoksa wireframe stage'de boğulursun. F2 başlamadan önce design.md'de D2 done mu kontrol et.

### F3 — Loading progress error/timeout/retry polish
**Status:** todo
**Owner:** frontend-junior-2
**Why:** PDF parse-time `page-budget large docs` bir kısmı handle etti ama UI tarafında 30+ saniyeye çıkan ingest'lerde kullanıcı blank state veya stuck loading bar görüyor.
**Acceptance:**
- [ ] Timeout state (>60s tek PDF) sessiz, editorial bir mesajla görünür ("This file is taking longer than usual…")
- [ ] Retry CTA tek bir PDF için (tüm akışı baştan başlatmadan)
- [ ] Error mesajları teknik jargon içermiyor (no stack traces, no error codes; backend'in kullanıcıya gösterdiği sade mesaj)
- [ ] Skeleton/shimmer renkleri B&W Notion-DNA token system'inden — ad-hoc hex yok
**Files (likely):** ui/loading-progress, app/api/ingest/route.ts (error contract için)
**Notes:** Atelier rules: alarmist olma (no red, no shake animations). D1'in kanonik DNA dokümanını okuyarak start.

---

## Tamamlananlar (arşiv)

_—_
