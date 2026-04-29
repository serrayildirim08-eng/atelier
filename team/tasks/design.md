# Design — Task Kuyruğu

Owner: `ui-designer`. ID prefix `D`.

## Format

```
## D<N> — <ekran/feature adı>
**Status:** todo | in_progress | blocked | done
**Why:** ...
**Deliverables:** ...
**Emotional thesis:** ...
**Anti-references:** ...
**Notes:** ...
```

Atelier DNA: **şu an B&W Notion-DNA token system kuruldu, ama hedef luxury-editorial.** Aesop / Kinfolk / Monocle / Apartamento yönüne çekiyoruz — yapıyı korumadan, ruhu değiştirerek. Bu D1'in işi.

---

## Açık task'lar

### D1 — Atelier DNA audit + kanonikleştirme
**Status:** todo
**Owner:** ui-designer
**Why:** `c5f188f` commit'i "B&W token system + Notion-DNA matter dashboard" demiş, mevcut UI bu temelde duruyor. Ama Serra'nın hedefi luxury-editorial. Şu anki agent prompt'u (luxury-editorial / Aesop) ile fiili kod (B&W / Notion) çelişiyor. Bu çatışma **çözülene kadar** F1, F2, F3 başlayamaz — herhangi bir polish hangi DNA'ya doğru çekecek bilmiyor.
**Deliverables:**
- [ ] `team/design/_DNA.md` — Atelier'in kanonik design DNA dokümanı (palette token isimleri, type scale, spacing scale, motion timing, ornament policy, allowed/forbidden zone)
- [ ] `team/design/_DNA-audit.md` — mevcut B&W Notion-DNA UI'ın (matter dashboard, intake, reviewer, loading) audit'i: nereler luxury-editorial yönünde tweak gerektiriyor (typography, whitespace, motion, icon treatment, microcopy ton)
- [ ] Top 3-5 prescriptive fix önerisi, dosya/component bazında
- [ ] `~/.claude/agents/ui-designer.md` ve `~/.claude/agents/frontend-senior.md` prompt'larını güncel kanonik DNA ile güncelle (önemli — yoksa ekip ayrışacak)
**Emotional thesis:** "İmmigrasyon avukatlığının kalemi gümüş, kâğıdı el yapımı — dijital olduğunda da o ağırlık hissedilmeli." (Serra netleştirebilir)
**Anti-references:** Linear, Stripe, Notion'ın kendi UI'ı, Material Design, glassmorphism, "AI startup" gradient'leri
**References to study:** Aesop web, Kinfolk magazine layout, Monocle dergi tipografisi, Apartamento, Cabana magazine
**Notes:**
- Notion-DNA'nın YAPISI (information density, table-like matter dashboard) iyi — onu KORUYORUZ
- Notion-DNA'nın RUHU (sans-serif sade, açık-koyu mod, generic spacing) — onu DEĞİŞTİRİYORUZ → editorial serif display, daha geniş line-height, palette'e cream/sage/sky sıcaklık katmanları katma
- Bu task L size — 2-3 saat kafa+yazma, sub-1h'ta acele etme

### D2 — Reviewer paneli: gate sonuçları spec
**Status:** blocked
**Owner:** ui-designer
**Blocker:** D1 bitmeli (DNA olmadan severity hierarchy'sinin görsel ayrımı tutarsız olur)
**Why:** F2'nin başlayabilmesi için spec gerekli. Backend zaten `runFullReview` ile deterministic+llm sonuçları dönüyor; UI sunum kararı alınmamış.
**Deliverables:**
- [ ] `team/design/reviewer-gates/spec.md` — layout, severity 4 vs 5 görsel ayrımı (renk değil, ağırlık/typo/ornament), authority cite treatment, collapsed-vs-expanded davranış
- [ ] `team/design/reviewer-gates/moodboard.md` — 6-12 referans (legal annotation tradition'larından — Bluebook, redline, marginalia)
- [ ] `team/design/reviewer-gates/prototype.html` — statik Tailwind sketch
**Emotional thesis:** "Margin'a düşülmüş bir avukat notu" — sayfa kenarındaki kalem işareti gibi. Alarm değil, dikkat çekme.
**Anti-references:** Sentry, Datadog, Linear issue listesi — anything that screams "alert"
**Notes:** Severity 4 ile 5 arasındaki fark RENK ile değil, type weight + ornament density ile yapılmalı (B&W system kısıtı + luxury-editorial kuralı uyumlu).

---

## Tamamlananlar (arşiv)

_—_
