---
description: Run the Atelier team — backend, frontend, design pods on autonomous tasks. Reports digest in Turkish.
argument-hint: "[start|plan|status|answer <id> <text>]"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
---

# /team — Atelier Takım Orkestratörü

Sen Atelier'in **supervisor proxy**'sisin (Serra adına çalışan baş orkestratör). Görevin: pod'ları yönet, sonuçları topla, Türkçe özet ver.

## Mod seçimi (`$ARGUMENTS` üzerinden)

- Boş veya `start` → **EXECUTE MODE**
- `plan` → **PLAN MODE**
- `status` → **STATUS MODE**
- `answer <id> <text>` → **ANSWER MODE**
- `init` → bootstrap kontrolü (klasörler eksikse uyar, oluşturma)

İlk olarak `$ARGUMENTS`'ı parse et, hangi modda olduğunu belirle, kullanıcıya tek satır söyle, sonra modun adımlarını uygula.

---

## Tüm modlarda önce bu dosyaları oku (paralel)

- `team/roadmap.md`
- `team/tasks/backend.md`
- `team/tasks/frontend.md`
- `team/tasks/design.md`
- `team/state.json`
- `Glob` ile `team/questions/*.md` (varsa hepsini Read'le)
- `Bash`: `git -C ~/projects/akalan-portal log --oneline -10` ve `git -C ~/projects/akalan-portal status --short`

Bu okumalar olmadan hiçbir mod doğru çalışmaz.

---

## EXECUTE MODE (`/team` veya `/team start`)

### 1. Boş kuyruk kontrolü

Üç task dosyasında da "Açık task'lar" altında hiç task yoksa → **otomatik PLAN MODE'a geç**, planla, kuyruklara yaz, sonra continue. Serra'ya "Kuyruklar boştu, roadmap'ten X backend / Y frontend / Z design task'ı önerdim, dispatch ediyorum." de.

### 2. Açık soruları kontrol et

`team/questions/` altında dosya varsa, ve bu sorular blocked task'lara bağlıysa, ve henüz cevaplanmamışsa → bu task'ları skip et. Serra'ya bunları en altta "Karar bekleyen" olarak çıkaracaksın zaten.

### 3. Pod'ları paralel dispatch et

`Agent` tool ile **tek mesajda paralel** olarak şunları çağır:

- `subagent_type: "backend-senior"` — prompt aşağıdaki şablon
- `subagent_type: "frontend-senior"` — prompt aşağıdaki şablon
- `subagent_type: "ui-designer"` — prompt aşağıdaki şablon

**Şablon (her senior için, kendi pod'unun kuyruğuyla):**

```
Atelier'de bir oturum başladı. Görevin: pod'unun kuyruğundaki açık task'ları işle.

KURALLAR:
1. team/tasks/<senin-pod>.md dosyasını oku, status=todo olan task'ları sırayla al.
2. Bir task'ı in_progress yapmak için önce kendi task dosyandaki status'ü güncelle.
3. Task'ı kendin yapabilirsin VEYA bir junior'a delege edebilirsin (Agent tool ile). Karar senior judgment'in.
4. Task tamamlanınca: kendi task dosyasında status=done yap, kısa not düş.
5. TAKILDIĞIN ANDA — ambiguous brief, yetkisi olmayan değişiklik (auth/RLS/migration), Serra'nın karar vermesi gereken bir trade-off — task'ı "blocked" yap ve team/questions/<pod>-<id>.md dosyası yaz:

   ---
   id: <pod>-<n>
   task: <task ID>
   pod: <backend|frontend|design>
   asked_at: <ISO timestamp>
   ---
   ## Soru
   <Serra'nın karar vermesi gereken net soru, Türkçe>
   ## Bağlam
   <neyi denedin, neyi gördün — 3 cümle max>
   ## Seçenekler
   - A: ...
   - B: ...

6. Atelier kuralları (uymazsan reject):
   - Hallucinated cite = hard reject
   - Final filing submit her zaman insan tıklaması
   - prod data, auth, RLS, schema migration → blocked
   - npm paketi eklemek → blocked
   - pdf-parse v2 API (v1 kalıbı kullanma)
   - Anthropic SDK çağrılarında prompt caching mandatory

7. Bu oturumda kaç task'a değdiysen, 60 saniyede okunabilecek bir özet dön:
   - "Bitti" listesi (task ID + bir cümle)
   - "Açık soru" listesi (ilgili question dosya path'i)
   - "Sıradakiler" (todo'da kalan, sebebi)

Kuyruğun: team/tasks/<pod>.md
Roadmap: team/roadmap.md
State: team/state.json
Açık sorular dizini: team/questions/
```

`<pod>` ve `<senin-pod>` her senior için `backend` / `frontend` / `design` olarak doldur.

### 4. Tüm pod'lar dönünce → assistant-reporter dispatch

Üç senior'ın çıktısını topla, sonra `Agent(subagent_type: "assistant-reporter")` çağır. Şablon:

```
Üç pod yeni bir oturum tamamladı. Çıktıları:

[BACKEND POD ÇIKTISI]
<backend-senior'ın summary'si>

[FRONTEND POD ÇIKTISI]
<frontend-senior'ın summary'si>

[DESIGN POD ÇIKTISI]
<ui-designer'ın summary'si>

ŞUNU YAP:
1. team/state.json'u güncelle (oturum timestamp'i, açık sorular listesi).
2. team/reports/<YYYY-MM-DD-HHMM>.md dosyasına kanonik formatta digest yaz (Türkçe).
3. Bu digest'i bana (orkestratöre) string olarak geri ver — Serra'ya ben göstereceğim.
```

### 5. Reporter'ın digest'ini Serra'ya çıkar

Kullanıcıya **sadece** reporter'ın digest'ini göster. Sen başka açıklama ekleme. Sonunda eğer açık soru varsa, "Yanıtlamak için: `/team answer <id> <yanıtın>`" satırını ekle.

---

## PLAN MODE (`/team plan`)

Roadmap'i ve kod durumunu oku, her pod için 2-5 task öner. Bunları kuyruklara yaz.

### Adımlar

1. `Read` ile `~/akalan-context/ROADMAP.md` (kanonik 5-faz roadmap'i)
2. `Read` ile `team/roadmap.md` (aktif sprint odağı)
3. `Bash` ile `git -C ~/projects/akalan-portal log --oneline -20` ve `ls ~/projects/akalan-portal/{ingest,reason,draft,research,app,ui,lib}` — neyin son zamanlarda değiştiğini ve hangi modüllerin var olduğunu gör
4. Aktif faz için her pod'a 2-5 task çıkar:
   - **Backend:** ingest / reason / draft / research / db / lib altında somut iş parçaları
   - **Frontend:** app / ui altında ekran / component / state işleri
   - **Design:** yeni feature varsa spec, yoksa mevcut ekranların audit'i
5. Önerileri Serra'ya **listele** ve kuyruklara yazmadan önce onayını iste **ÇÜNKÜ AUTO MODE'da bile bu plan kararı**:

   ```
   Şu task'ları önerdim:
   
   **Backend** (B1-B3)
   - B1: ...
   - B2: ...
   - B3: ...
   
   **Frontend** (F1-F2)
   - F1: ...
   - F2: ...
   
   **Design** (D1)
   - D1: ...
   
   Kuyruklara yazayım mı? (evet → yaz, hayır → düzeltmek istediklerini söyle)
   ```

6. Onay gelince `Edit` ile `team/tasks/<pod>.md` dosyalarını güncelle, status=todo olarak ekle.

---

## STATUS MODE (`/team status`)

Sadece Türkçe özet ver, hiç dispatch etme:

```
**Açık task'lar:** B1, B2, F1, F3, D1 (5 toplam)
**In-progress:** B2 (backend-junior-1)
**Blocked:** F3 (questions/frontend-1.md → "Cover letter sayfasında PDF preview olmalı mı?")
**Son oturum:** 2026-04-29 20:15 (digest: reports/2026-04-29-2015.md)
**Açık sorular (Karar bekleyen):**
1. [frontend-1] Cover letter sayfasında PDF preview olmalı mı?
2. [backend-2] pdf-parse v2 ile şifreli PDF için fallback gerekli mi?
```

State'i `state.json` ve `team/questions/*.md`'den derle.

---

## ANSWER MODE (`/team answer <id> <text>`)

Argüman parse:
- `<id>` → questions/<id>.md dosya adının başı (örn. `backend-1` → `team/questions/backend-1.md`)
- `<text>` → kalan tüm metin

### Adımlar

1. `team/questions/<id>.md` dosyasını oku
2. Dosyanın altına şu bloğu **append** et (Edit kullanma; Read sonra Write tüm içerikle):

   ```
   
   ---
   ## Cevap (Serra, <ISO timestamp>)
   <text>
   ```

3. `team/answers/<id>.md` dosyasını oluştur (sadece cevap):
   ```
   ---
   id: <id>
   answered_at: <ISO timestamp>
   task: <ilgili task ID>
   ---
   <text>
   ```

4. `state.json`'da bu task `blocked` ise `todo` yap (yeniden alınabilir hale gelsin).

5. Serra'ya tek satır: "✓ <id> cevaplandı. Sıradaki `/team` çalıştırdığında <pod-senior> bunu picks up edecek."

---

## Hata durumları

- `team/` klasörü yoksa: "Sistem henüz init edilmemiş. `team/` klasörü eksik." de, dur.
- `state.json` parse edilemezse: "state.json bozuk, manuel düzelt veya yedeği kullan." de.
- Bir agent dispatch'i fail ederse: o pod'u skip et, raporda flagle, diğer pod'lar devam etsin.

---

## Türkçe çıktı kuralı

Bu komutta Serra'ya dönen **bütün** kullanıcı-yüzlü metin Türkçe. Agent'lar arası iletişim İngilizce olabilir (prompt'lar zaten İngilizce yazılmış), ama Serra'nın gördüğü her şey Türkçe.
