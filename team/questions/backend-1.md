---
id: backend-1
task: B5
pod: backend
asked_at: 2026-04-29T21:05:00Z
---
## Soru
EB-1A drafter'i E-2'nin manual-block loader pattern'ine migrate etmek icin `manuals/EB1A/EB1A-PREPARATION-MANUAL.md` ve `EB1A-MANUAL-FOR-CLAUDE-CODE.md` gerekli. Repo'da `manuals/EB1A/` dizini yok — sadece E-2 manual'leri var. Nasil ilerleyelim?

## Baglam
- `manuals/` altinda sadece E-2 dosyalari var (E2-FRAMEWORK-1..5, E2-PREPARATION-MANUAL, E2-MANUAL-FOR-CLAUDE-CODE, MANUAL-SUBTYPE-1..4). EB1A klasoru yok.
- `_ATELIER-SYSTEM-PROMPT.md § 3` zaten "(pending)" markerlariyla bunu belirtmis (REFACTOR-NOTES line 65).
- B5 brief'i de bu durumda BLOCKED yazmamizi soyluyor.

## Secenekler
- A: Research pod'una EB1A manual'lerini yazdiralim (yeni task acmak — R1?), B5 onlar bitince acilsin.
- B: Sen / Akalan ekibi manual draft'ini disardan saglayin, biz repo'ya ekleyelim.
- C: B5'i bu sprintten cikar, EB-1A migration baska bir batch'e ertelensin (Phase-9 / EB-parity batch).
