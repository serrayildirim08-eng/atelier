# Atelier Takım Sistemi

Bu klasör, supervisor (Serra) ile alt agent ekibi arasındaki çalışma alanıdır. Her oturum buradaki dosyalar üzerinden işliyor.

## Yapı

```
team/
├── roadmap.md              # Aktif odak + kanonik roadmap'e referans
├── tasks/
│   ├── backend.md          # Backend pod'unun task kuyruğu
│   ├── frontend.md         # Frontend pod'unun task kuyruğu
│   └── design.md           # UI Designer'ın task kuyruğu
├── questions/              # Pod'lar takıldığında buraya yazar (her soru bir .md)
├── answers/                # Serra'nın yanıtları (her cevap bir .md)
├── reports/                # assistant-reporter'ın oturum digest'leri
└── state.json              # Task'ların durumu (todo / in_progress / blocked / done)
```

## Komutlar

`~/projects/akalan-portal` içindeyken Claude Code'a:

- `/team` veya `/team start` → tüm pod'ları paralel başlatır, oturum sonunda Türkçe digest döner
- `/team plan` → roadmap + kod durumuna bakıp her pod için task önerir, kuyruklara yazar
- `/team status` → açık iş + bekleyen sorular + son rapor
- `/team answer <id> <yanıt>` → açık bir soruya cevap kaydeder, ilgili pod bir sonraki turda picks up

## Pod'lar

| Pod | Senior (Opus) | Juniors (Sonnet) |
|---|---|---|
| Backend | `backend-senior` | `backend-junior-1`, `backend-junior-2` |
| Frontend | `frontend-senior` | `frontend-junior-1`, `frontend-junior-2` |
| Design | — | `ui-designer` (Opus, junior seniority) |

`assistant-reporter` (Sonnet) — sadece Serra'ya raporlar, hep Türkçe.

## Akış

1. Serra `/team` yazar
2. Orkestratör `roadmap.md` + `tasks/*.md` + `state.json` + açık `questions/` okur
3. Üç pod senior'ı paralel dispatch edilir; senior'lar gerekirse junior'lara delege eder
4. Pod'lar takılırsa → `questions/<pod>-<id>.md` yazar ve o task'ı `blocked` işaretler
5. Pod'lar bitirirse → `state.json` güncellenir, kısa bir özet döner
6. `assistant-reporter` üç pod'un çıktısını + git aktivitesini okur, `reports/<timestamp>.md` yazar
7. Serra'ya Türkçe digest gösterilir, son satır "Karar bekleyen" sorular

## Kurallar

- **Hiçbir agent prod data'ya, auth'a, RLS'e, schema migration'lara izinsiz dokunamaz** → blokere düşer, Serra'ya sorulur
- **Yeni npm paketi** her pod için Serra onayı ister
- **Hallucinated cite = hard reject** (Atelier kuralı, agent'lara özellikle hatırlatılır)
- **Final filing submit always human click** — agent asla `submit` butonuna basmaz

## State semantiği (`state.json`)

```json
{
  "tasks": {
    "B1": { "pod": "backend", "status": "in_progress", "owner": "backend-junior-1", "started": "2026-04-29T..." },
    "F2": { "pod": "frontend", "status": "blocked", "blocker": "questions/frontend-3.md" }
  },
  "last_session": "2026-04-29T20:15:00Z"
}
```
