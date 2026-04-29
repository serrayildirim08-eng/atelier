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
**Status:** done
**Owner:** ui-designer
**Completed:** 2026-04-29
**Deliverables:**
- [x] `team/design/_DNA.md` v1.0 — kanonik DNA, B&W concrete-and-jet base + cream/sage/sky warmth layer + rubric red, type scale (Fraunces + sans + mono), spacing, motion tokens, ornament library, microcopy, HITL exception
- [x] `team/design/_DNA-audit.md` v1.0 — 4 kategoride sapma + top 5 prescriptive fix (palette token genişlemesi, sidebar warmth, verified→sage, provenance→sky, spacing rhythm bump)
- [x] `~/.claude/agents/ui-designer.md` güncellendi — emotional thesis, kanonik DNA reference, HITL exception
- [x] `~/.claude/agents/frontend-senior.md` güncellendi — DNA reference, forbidden zone (ASCII arrows), HITL exception, review citation kuralı
**Notes:**
- Mevcut UI roadmap'in iddia ettiği kadar Notion-DNA değil — fiilen monastic-editorial (Bluebook + Apple Notes hibrit). Omurga sağlam, eksik olan warmth ve severity vocabulary.
- `globals.css`'te `--color-rubric` ve `--color-rubric-soft` token'ları yanlış değerlerde (graphite duplicate). DNA §3.3'te düzeltildi; F1'de implementation gerekli.
- F1 ve F3 artık unblock — D2 ile devam ediyorum.

### D2 — Reviewer paneli: gate sonuçları spec
**Status:** done
**Owner:** ui-designer
**Completed:** 2026-04-29
**Deliverables:**
- [x] `team/design/reviewer-gates/spec.md` v1.0 — verdict masthead + letter pane + sticky cream rail; severity 5/4/minor/na ornament axis (type weight + left rule + sigil ▣▢·—); inconsistency parallel-quote card (letter-excerpt vs facts-value); HITL-only rubric reservation; full state vocabulary; backend contract bound to `runFullReview` `FullReviewResult` (gates + ReviewReport)
- [x] `team/design/reviewer-gates/moodboard.md` v1.0 — 12 references with explicit borrow/don't-borrow notes (Bluebook, Aesop, Kinfolk, Monocle, Cabana, Apartamento, Yorker fact-check, 19th-c codex, Field Notes; counter: Linear/Sentry/Datadog as anti-anchors)
- [x] `team/design/reviewer-gates/prototype.html` — static Tailwind sketch with concrete gate fixtures (co-petitioner circularity, unaccounted SOF, develop-and-direct authority thin, alias hallucination, 5-yr horizon weak spot, marginality missing argument)
- [x] `team/design/reviewer-gates/rationale.md` v1.0 — why severity-without-hue, why two columns, why asterism, why no rubric on this view
**Notes:**
- F2 unblock — junior-1 spec'in §10 hand-off checklist'ini izleyebilir.
- Spec rubric red'i bu view'dan açıkça uzak tutuyor; rubric yalnızca HITL stop-point'lerinde (engagement letter, citation gate, pre-generation approval, conflict-flagged) kullanılacak. D5/D6'da bu kararı tekrar ele alacağız.

---

## Tamamlananlar (arşiv)

- **D1** (2026-04-29) — Atelier DNA v1.0 kanonikleşti. `team/design/_DNA.md` + `_DNA-audit.md`. Mevcut "concrete & jet" base korundu; cream / sage / sky warmth katmanı + rubric red token'ları eklendi (F1'de implementation gerekli). ui-designer + frontend-senior prompt'ları güncellendi. F1 ve F3 unblock.
- **D2** (2026-04-29) — Reviewer panel spec v1.0. `team/design/reviewer-gates/{spec,moodboard,prototype,rationale}`. Severity 5/4/minor/na ornament axis (type weight + left rule + sigil) — renksiz hiyerarşi. Backend `runFullReview` çıktısına bağlı. F2 unblock.
