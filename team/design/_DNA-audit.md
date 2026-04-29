# Atelier — DNA Audit (mevcut UI vs. kanonik DNA)

**Status:** v1.0 · 2026-04-29
**Scope:** `app/page.tsx` (root binder), `app/matter/[id]/page.tsx` (matter dashboard), `app/loading-demo/page.tsx` (ingest progress), `app/components/*` (ortak component'ler)
**Companion:** `_DNA.md` v1.0

---

## 0. TL;DR

Mevcut "concrete & jet" sistem **roadmap'te yazıldığı kadar Notion-DNA değil** — fiilen monastic-editorial tarafa çok yakın. Bu iyi haber: omurga sağlam. Eksik olan **warmth ve ornament-as-meaning katmanı**. Bu audit dört kategoride sapma tespit ediyor:

1. **Renk ısısı** — palette tamamen monokrom; cream/sage/sky katmanı yok
2. **Whitespace** — kâfi değil, masaüstü viewport'ta basıkışıyor
3. **Severity vocabulary** — tek "rubric" rengi var, ama 4-vs-5 ayrımı yok (D2'yi etkiler)
4. **Iconography boşluğu** — emoji, ASCII ok ve unicode characters bazı yerlerde line icon gibi davranıyor

İyi haber: **type sistem, ornament library, motion timing kanona uyumlu** — değiştirilmesi gereken minimal.

---

## 1. Sapmalar — kategori bazında

### 1.1 Renk ısısı (warmth)

**Bulgu:** Palette tamamen `paper / ink / graphite / rule` tonları. `app/globals.css` line 6–28 dolduran 12 renk token'ı _hepsi_ neutral grayscale. Roadmap "luxury-editorial" diyor ama UI fiilen Apple Notes + Bluebook hibrit.

**Etki:** Sidebar, masthead, side rail hepsi aynı `paper-grain`. Hiyerarşi typography ile taşınıyor — bu doğru — ama mood "cold archive" hissi veriyor. Aesop / Kinfolk warmth'una mesafeli.

**Düzeltme:** `_DNA.md §3.2` — cream/sage/sky token'larını `globals.css` `@theme`'a ekle. Kullanım disiplini §3.4 kuralında: viewport başına bir warm-surface VEYA bir functional accent.

**Etkilenen dosyalar:**
- `app/globals.css` — token ekleme (frontend-senior)
- `app/page.tsx` line 977 (`<aside>` sidebar) — `paper-grain` → `cream` warm wash
- `app/page.tsx` line 1183, 1203 — middle pane korunuyor (paper-grain)
- `app/matter/[id]/page.tsx` line 186–224 (Masthead) — sigil bloğu hafif cream tint
- `app/components/loading-progress.tsx` — verified satırlar `sage-deep`, source-quote pulls `sky-wash`

**Kural:** root viewport asla cream değil. Cream = secondary/sidebar/sub-block.

---

### 1.2 Whitespace

**Bulgu:** Page-level padding genellikle `px-9 py-7` veya `px-12 pt-14 pb-10`. Sayma:

- `app/page.tsx` line 1391: `px-9 py-7` (correspondence pane)
- `app/matter/[id]/page.tsx` line 123: `px-12 pb-24 pt-10`
- Card interior çoğunlukla `px-7 pt-6 pb-3` (case-overview-card.tsx line 77)

DNA hedefi: `px-16 py-14` page hero için, `p-8` card interior için. Aesop / Apartamento line-up'ta bu hâlâ minimum.

**Etki:** Section'lar arasındaki nefes Kinfolk'a göre dar. Stat card'lar `gap-5` ile yan yana — okuma ritmini bölüyor.

**Düzeltme:**
- Masthead padding: `px-12 → px-16`, `py-14 → py-16`
- Section-arası gap: `gap-12 → gap-16` (overview pane)
- Stat card grid: `gap-5 → gap-7`
- Card interior: `pt-6 pb-3 px-7 → p-8`

**Etkilenen dosyalar:**
- `app/matter/[id]/page.tsx` line 123, 186, 320 (OverviewPane grid gap'leri)
- `app/components/case-overview-card.tsx` line 77

---

### 1.3 Severity vocabulary (D2 öncüsü)

**Bulgu:** Mevcut sistemde tek bir "rubric" rengi var (`#0A0A0A` — yani aslında ink). `globals.css` line 20–24'te `--color-rubric` ve `--color-rubric-soft` aynı `#0A0A0A` ve `#1F1F1F`. **Yani şu anda kırmızı yok.** Ama `loading-progress.tsx` line 188–195'te `pulse-dot-bg` `#b8392e` (annotated red) hard-coded — bu token'a alınmadan inline kullanılmış.

**Etki:** D2'de severity 4 vs 5 ayrımı **typography weight + ornament density** ile yapılacak (renk değil — DNA constraint). Ama bu, rubric red'in "sadece blocking finding'lerde, küçük alanda" kullanılması imkânını korumak için palette'e kanonik girmeli.

**Düzeltme:** `_DNA.md §3.3` — `--color-rubric: #B8392E` ve `--color-rubric-soft: rgba(184,57,46,0.06)` token'larını ekle. Mevcut `globals.css`'teki yanlış alias'ları düzelt. `loading-progress.tsx`'teki hard-code'u token'a referansla.

**Etkilenen dosyalar:**
- `app/globals.css` line 20–24 (token tanımları yanlış, düzeltilecek)
- `app/components/loading-progress.tsx` line 195 (hard-coded color → token)
- D2 spec'inin temel renk vocabulary'si — bu düzeltme yapılmadan D2 başlayamaz

---

### 1.4 Iconography boşluğu

**Bulgu:** Birkaç yerde unicode/ASCII karakteri ikon yerine kullanılmış:

- `app/page.tsx` line 1408: `→` ASCII ok (CTA bağlantısında)
- `app/page.tsx` line 934: `⌘K` mono mark (bu OK, technical ikon)
- `app/matter/[id]/page.tsx` line 142: `←` (back arrow)
- `app/matter/[id]/page.tsx` line 408, 463: `→` (CTA arrow)
- `app/components/loading-progress.tsx` line 695, 706: kullanılmadan kalmış

DNA: line icon, 1.25–1.5px stroke. ASCII ok pikselik kayıyor; mono font-rendering inconsistent.

**Etki:** Aesop / Monocle web'i custom 1.25px line-arrow kullanır. ASCII karakter bunun yanında "hızlı bir prototype" hissi verir.

**Düzeltme:**
- D-future task: 6–8 ikonluk Atelier custom set (back-arrow, forward-arrow, fold, gavel, paragraph-mark, sigil) → SVG sprite
- D1 kapsamında değil; ama back/forward arrows için Phosphor `ArrowLeft` / `ArrowRight` (regular weight) kanonik replacement olarak D1'de tanımlanır
- ASCII ok kullanımı **yasaklanır** — bu kural agent prompt'una yazılır

**Etkilenen dosyalar:**
- `app/page.tsx` çeşitli satırlar (frontend-senior bunu cleanup task'ı yapar)
- `app/matter/[id]/page.tsx` line 142, 408
- Future: `ui/icons/` klasörü (custom Atelier set)

---

### 1.5 Mikro-detaylar (kanona zaten uyumlu, düzeltme gerektirmez)

| Detay | Lokasyon | Status |
|---|---|---|
| Fraunces serif + system sans pairing | layout.tsx + globals.css | uyumlu |
| smcp tracking 0.10em | globals.css line 93 | uyumlu (eski 0.20em düşürülmüş, doğru karar) |
| Drop cap empty-state | globals.css line 117 | uyumlu |
| Dinkus | globals.css line 129 | uyumlu |
| Sigil | globals.css line 207, kullanım matter/[id]/page.tsx line 187 | uyumlu |
| Brass-rule hairline gradient | globals.css line 253 | uyumlu |
| Tab pill (active = bg-ink text-paper) | matter/[id]/page.tsx line 254 | uyumlu — luxury-editorial inverse jet |
| Hairline scrollbar | globals.css line 161 | uyumlu |
| Pulse-dot timing 1.4s | globals.css line 185 | uyumlu |
| Focus ring 1.5px ink | globals.css line 202 | uyumlu |

---

## 2. Top 5 prescriptive fix'ler (öncelik sırasıyla)

### Fix #1 — Palette token genişlemesi (MUST, F1 öncesi)

**File:** `app/globals.css` line 6–28 `@theme` bloğu
**Action:**
1. `--color-rubric` ve `--color-rubric-soft` tanımlarını `_DNA.md §3.3`'teki gerçek değerlere düzelt (`#B8392E` ve wash).
2. `--color-cream`, `--color-cream-2`, `--color-cream-rule` ekle.
3. `--color-sage`, `--color-sage-deep`, `--color-sage-wash` ekle.
4. `--color-sky`, `--color-sky-deep`, `--color-sky-wash` ekle.
5. `--color-ochre` ve `--color-verdant` token'ları sahte (graphite duplicate); ya kullanılan yerler bulunup düzeltilsin ya da token sözlükten silinsin. (frontend-senior `grep` ile kontrol etsin.)

**Owner:** frontend-senior (D1 spec'i imza verdi → F1 başlayabilir)
**Validation:** B&W base etkilenmemeli; warm token'lar OPSIYONEL kullanılır.

### Fix #2 — Sidebar warmth wash (SHOULD)

**File:** `app/page.tsx` line 977 — `<aside className="border-r border-rule paper-grain ...">`
**Action:** `paper-grain` yerine `cream` veya layered: dış `cream-2` + iç content paper. Kura: sidebar = "the binder's spine" — warm leather/cloth hissi. Ana viewport hâlâ cool paper.
**Owner:** frontend-junior-1 (F1 alt-task)
**Validation:** dark sidebar/light content kontrast okunabilirliği geçer.

### Fix #3 — Verified states sage (SHOULD)

**File:** `app/components/loading-progress.tsx`, `app/components/document-inventory.tsx`, `app/components/authority-cite-check.tsx`
**Action:** "verified," "on allowlist," "acknowledged," "complete" gibi pozitif terminal state'ler `text-sage-deep` (text only, sage-wash surface ≤8% area). Şu anda hepsi `text-ink` veya `text-graphite` — fonksiyonel ayrım yok.
**Owner:** frontend-junior-2 (F3 alt-task)
**Validation:** Renk semantik bilgi taşımaz — sage olmadan da hâlâ "verified" anlaşılmalı (typography + iconla). Sage = ekstra mood layer.

### Fix #4 — Provenance/source-quote sky wash (SHOULD)

**File:** `app/matter/[id]/page.tsx` provenance pop'ları, `app/page.tsx` line 1505–1511 source-quote span'ları, `app/components/case-overview-card.tsx` provenance KV
**Action:** "from text," "in case file," `source_quote` italic pull-quote'ları `sky-wash` arka plan + `sky-deep` italic sol çubuk. Şu anda quote'lar tamamen graphite italic — provenance niyet'i visual olarak kayıp.
**Owner:** frontend-junior-1 (F1 alt-task)
**Validation:** quote pulls "this came from a document" hissi versin.

### Fix #5 — Spacing rhythm bump (MUST page-level, SHOULD card-level)

**Files:**
- `app/matter/[id]/page.tsx` line 123 (`<main>` page padding) — `px-12 pb-24 pt-10` → `px-16 pb-28 pt-14`
- `app/matter/[id]/page.tsx` line 186 (`<section>` masthead) — `px-12 pt-14 pb-10` → `px-16 pt-16 pb-12`
- `app/matter/[id]/page.tsx` line 321 (OverviewPane outer grid) — `gap-12` korunuyor, ama internal gap `gap-5` → `gap-7`

**Owner:** frontend-junior-2 (F3 alt-task)
**Validation:** 1440px viewport'ta daha fazla nefes. 1280px'de hâlâ confortable (max-w-[1400px] zaten var).

---

## 3. Bunlardan ETKİLENMEYEN şeyler (D1 scope dışı)

Bu task'lar gelecekteki D-task'larında ele alınır:

- **Custom Atelier icon set** — D7 (gelecek)
- **Reviewer panel severity 4-vs-5 ayrımı** — D2 (D1 bittikten sonra)
- **Empty state'lerin drop-cap'li hero typesetting'i** — D3 (gelecek, page.tsx satır 1391-altında zaten yer tutucu var)
- **Annotation/marginalia rail derinleşmesi** — D2 + D5 birlikte
- **Microcopy denetimi** — D6 (kelime kelime gözden geçirme; D1'de §9'da aksiyom var)

---

## 4. Hand-off notları

- F1 (paint refresh, frontend-senior) bu audit'in §2.1 ve §2.5 fix'lerini doğrudan alır
- F3 (junior-2 chrome polish) §2.3, §2.4, §2.5 alır
- F2 (junior-1 reviewer panel) D2 spec'ini bekler — D2 D1-DNA üzerinden severity hierarchy'sini ornament-density ile çözer
- Backend pod etkilenmez (token isimleri sadece UI tarafı)
