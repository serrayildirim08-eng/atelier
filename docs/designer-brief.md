# AKALAN Portal — Tasarımcı Brief'i

Bu doküman, frontend designer'ın AKALAN Portal'ı **bir avukat gibi anlamasını** sağlamak için yazıldı. Önce ürün ne yapıyor, sonra kim kullanıyor, sonra ekran ekran neyin neden orada olduğu, en sonda da tasarım kararı vermesi gereken açık sorular.

---

## 1. Ürün tek cümlede

AKALAN Portal, bir göçmenlik avukatının **ham müvekkil dosyalarını** (PDF'ler — pasaport, banka ekstresi, kira sözleşmesi, organizasyon belgeleri vs.) yutup, otomatik olarak:
- her PDF'i sınıflandırır + okur,
- vakaya dair structured fact tablosu çıkarır,
- USCIS'e gönderilecek **kapak mektubunu, exhibit listesini, formları ve declaration'ları** üretir,
- bir reviewer ajanı ile draft'ı taradığı gerçek facts'lere karşı denetler.

Yani bot **input olarak ham müvekkil dökümanı** alır, **output olarak USCIS dosyası** üretir. Sample dilekçeler runtime input değil — bot kendi yazıyor.

Hedef vize tipleri: **E-2** (treaty investor), **EB-1A** (extraordinary ability), **EB-1B** (outstanding researcher), **EB-1C** (multinational manager). Her birinin kendi schema'sı, kendi system prompt'u, kendi authority allowlist'i var.

---

## 2. Kullanıcı

**Birincil kullanıcı:** göçmenlik hukuku avukatı (managing partner ya da senior associate).
- Saatte 5 dolarlık değil, dakikada 5 dolarlık iş çıkarır.
- USCIS başvurusunda **uydurulmuş bir authority/citation = malpractice**. Uydurulan tek bir dipnot bile kariyere zarar verir. Bu yüzden ekranda görünen her veri parçası **provenance (kaynağı, sayfası, hangi PDF'ten geldi)** ile gelir.
- Toplu ingest'i tek tek dosya yüklemeye tercih eder — gerçek vakalar 200-900 PDF içerebilir.
- "I-94 deadline'ım 12 gün sonra dolacak" gibi sürelerle yaşar. Tarih bilgisi her zaman üstte ve görünür olmalı.

**İkincil kullanıcı:** paralegal (avukatın ekibi). Aynı UI, ama "approve" yetkisi yok — sadece dosya hazırlar, avukat onaylar.

---

## 3. Veri modeli — tasarımcının bilmesi gereken yapı taşları

UI bu beş yapı taşını sürekli yeniden şekillendiriyor:

### 3.1. Matter (vaka)
Bir müvekkilin tek bir başvurusu. Her matter'ın bir `case_type`'ı (E-2 / EB-1A / EB-1B / EB-1C) ve bir tane `caseFacts` objesi vardır.

### 3.2. CaseFacts (yapısal facts)
Discriminated union — case_type'a göre farklı şekil alır. Ama her vakada **applicant** (kişi), **company** (varsa), **operations** (operasyonlar), **spend** (harcamalar), **identity bundle** (pasaport/I-94/vize), **source of funds** (paranın kökeni) gibi bloklar bulunur. Her field bir `Field<T>` wrapper'ı içinde gelir:
```
{ value: "Mehmet Demir", source: { pdf: "passport.pdf", page: 2 }, confidence: "high" }
```
Tasarımcı: **her bilgi parçacığı kaynağıyla birlikte gösterilebilir olmalı.** Hover ile "bu bilgi nereden geldi" tooltip'i, ya da küçük bir 🔗 ikonu PDF'in o sayfasını açabilir.

### 3.3. PerPdfFacts (PDF başına extract)
Her PDF okunduğunda 26 farklı `doc_type` variant'ından birine düşer (passport / bank_statement / lease / company_registration / tax_return / payroll / invoice / utility_bill / certificate_of_good_standing / etc.). Her variant'ın kendi alanları var.

UI bu 26 variant'ı **8 kategoriye** gruplar (bkz. §4.4 Exhibits):
1. Applicant identity
2. Company formation
3. Business plan
4. Cover letter inputs
5. Source of funds
6. Operations evidence
7. Forms & letters
8. Employees

### 3.4. GeneratedArtifact (üretilen çıktılar)
Bot'un ürettiği her output — kapak mektubu, exhibit listesi, doldurulmuş form, declaration. Her artifact:
- bir `generator` türü (cover_letter, exhibit_list, noid_principal, ds160_filled, vs.)
- bir `preview_id`
- bir `status` (pending / approved / rejected)
- bir `output_path` (dosyada nereye yazıldı)
- bir `usage` (kaç token, kaç dolar)
taşır.

### 3.5. Conflict (reviewer bayrakları)
Reviewer ajanı draft'ı facts'e karşı denetler ve `severity 1-5` skalasında flag çıkarır:
- 1-2 = bilgilendirici
- 3 = orta — avukat görmeli
- 4-5 = kritik — düzeltilmeden gönderilemez

Renk kodu (sarı → kırmızı) doğal, ama ek olarak severity rakamı + glyph (◦ • ▪ ▴ ▲) accessibility için kullanılır.

---

## 4. Ekran ekran — şu an UI'da ne var, ne için

### 4.1. Ana sayfa — Matter Dashboard

**Ne için:** Avukatın bir vakayla iş yaptığı tek ekran. Folder drop → facts görünür → exhibits görünür → generate butonları → çıktılar.

**Kullanıcı akışı:**
1. Avukat müvekkilin tüm dökümanlarını bir klasör olarak sürükler (200-900 PDF).
2. Pipeline ilerlerken stage stage progress görür ("Detecting subtypes · 4/47", "Praying to immigration gods · auditing draft against the unified facts").
3. Pipeline bitince sayfa **üç ana panele** ayrılır:
   - **Sol/orta:** Structured Facts Panel (7 blok) — vaka hakkında bot'un çıkardığı her şey.
   - **Sağ:** Exhibits accordion (8 kategori) — hangi PDF nereye düştü.
   - **Üst banner:** I-94 deadline countdown (varsa).
4. Avukat eksik bilgileri (telefon, email, adres) **Intake Block**'tan girer.
5. Her exhibit kategorisinin altında **Generate** butonu var (cover letter / exhibit list / forms / declarations için).
6. Generate'e basınca **Pre-Generation Approval Modal** açılır — "şu facts'lerle, şu authority'leri citing ederek, ~3000 token, ~$0.40 maliyetinde bir kapak mektubu üreteceğim, onaylıyor musun?"
7. Onay sonrası output streaming olarak gelir (cover letter satır satır yazılır).
8. Kapak mektubunda mavi renkte `[Tab E.4]` referansları — tıklanınca o exhibit'in PDF'i açılır.
9. Reviewer report sayfanın altında — varsa kritik flag'ler kırmızı banner.

**Mevcut hali:** Çalışıyor ama görsel olarak henüz "atelier" hissi yok. Layout var, hierarchy var, ama tipografi ve nefes alanları designer dokunuşu istiyor.

**Tasarımcıdan beklenen:**
- 7 bloklu Facts paneli için bir **görsel ritim** — şu an 7 blok da aynı tipografide, hangisi daha önemli karışıyor.
- Exhibits accordion'unda **8 kategoriyi** farklı (ama tutarlı) ikonlarla ayırma.
- "Generate" butonlarının **idle / generating / generated / failed** state'lerinin tasarımı.
- Pipeline progress'inin **sıkıcı bir progress bar değil**, avukatın hangi PDF okunuyor şu an gibi bir şey görebileceği bir tasarım.

### 4.2. Structured Facts Panel (7 blok)

**Ne için:** Bot'un PDF'lerden çıkardığı **her şey tek bakışta**. Avukat "ben pasaport yükledim, doğum tarihi ne çıkmış?" diye soramaz — direkt görmesi gerekir.

**7 blok:**
1. **Applicant** — ad, soyad, pasaport numarası, doğum tarihi, milliyet, telefon, email, US adresi
2. **Identity bundle** — I-94, pasaport, vize, son admission tarihi (countdown!)
3. **Company** — ad, EIN, kuruluş tarihi, eyalet, adres, NAICS, ownership
4. **Source of Funds** — toplam yatırım, transfer kayıtları, kaynağın kökeni (satılan ev, miras, vs.)
5. **Operations** — kira sözleşmesi, çalışan sayısı, payroll kanıtı, faturalar, faaliyet kanıtı
6. **Spend** — kategorize edilmiş harcama (ekipman / kira / payroll / pazarlama / yasal)
7. **Generated artifacts** — şu ana kadar üretilen kapak mektubu / exhibit listesi / formlar

**Nasıl çalışır:** `app/page.tsx → StructuredFactsPanel`. Her blok kendi içinde `Field<T>` değerlerini render eder. `null` değerler "—" gösterir, ama tasarımcı bunun yerine "[Eksik — intake'te doldur]" linki düşünmeli.

**Tasarımcıdan beklenen:**
- Her blokta **eksik alan görsel olarak ayrı** olmalı (gri / italic / "intake'te doldur" linki).
- Provenance affordance: her field'a hover'da "passport.pdf, sayfa 2" tooltip'i.
- Bloklar arası **visual hierarchy** — Applicant + Identity + I-94 deadline en üst sırada (avukatın ilk baktığı şey).

### 4.3. I-94 Deadline Banner

**Ne için:** Avukatın "kaç günüm var" sorusunun cevabı her zaman ekranın üstünde olmalı. I-94 admission tarihi + verilen süreden hesaplanır.

**Mevcut hali:** Banner var, gün sayısı yazılıyor. Renk kodu var (>30 gün yeşil, 14-30 sarı, <14 kırmızı).

**Tasarımcıdan beklenen:** Bu countdown bir **hero element** olmalı — saat gibi tıkladıkça avukatı uyaran bir şey. Belki gün sayısı + "submit by [tarih]" + I-94 PDF'ine direkt link.

### 4.4. Exhibits Accordion (8 kategori)

**Ne için:** USCIS başvurusunda exhibits klasik olarak Tab A, Tab B, ... şeklinde organize edilir. Bizim 8 kategori = 8 Tab. Her kategori altında ilgili PDF'ler listelenir, hangi PDF hangi exhibit'in altına düştüğü görülür.

**Kategoriler:**
- A. Applicant identity (passport, I-94, vize)
- B. Company formation (incorporation, EIN, op agreement)
- C. Business plan
- D. Cover letter inputs (org chart, marketing materials)
- E. Source of funds (bank statements, sale deeds, gift letters)
- F. Operations evidence (lease, payroll, invoices)
- G. Forms & letters (DS-160, I-129, support letters)
- H. Employees (W-2, payroll, employment contracts)

**Kullanıcı akışı:**
1. Her kategori bir accordion satırı — başlık + içindeki PDF sayısı + "Generate [şey]" butonu (kategoriye göre cover letter, exhibit list, vs.).
2. Açıldığında o kategorideki PDF'lerin listesi (dosya adı + bot'un çıkardığı `display_name` + size + provenance).
3. PDF satırına tıklayınca **DocumentPreviewModal** açılır (iframe ile inline preview).

**Mevcut hali:** Çalışıyor. Categorization çalışıyor. PDF preview çalışıyor.

**Tasarımcıdan beklenen:**
- 8 kategori için ayırt edici ama tutarlı **iconography**.
- Boş kategori state'i (ör. "Hiç company belgesi yüklenmedi — yüklemek ister misin?").
- "Bu kategoride 1 PDF eksik görünüyor" gibi **akıllı boşluk uyarıları** (örn. EB-1A'da CV yüklenmemişse).

### 4.5. Intake Block

**Ne için:** PDF'lerden çıkmayan/çıkamayan bilgileri (telefon, email, US adresi) avukatın elden girdiği form. localStorage'da persist ediliyor, sayfa kapanıp açılınca kalıyor.

**Mevcut hali:** Basit form. Şu an Facts panelinin altına gömülü.

**Tasarımcıdan beklenen:**
- **Eksik field uyarısı:** Facts panelinde "telefon: —" görüyorsan, intake'te o satıra direkt scroll/highlight.
- "Bu alan extracted edilmediği için manuel girmen gerekiyor — bot pasaport ya da Form I-129'da bulamadı" gibi **kontekst tooltipi**.

### 4.6. Pre-Generation Approval Modal

**Ne için:** Bot bir output üretmeden önce avukatın "evet üret" demesi gerekiyor. Bu hem **maliyet kontrolü** (bir generate ~$0.30-$1.50 arası), hem **doctrinal güven** (avukat hangi facts'in citing edileceğini görmeli) için.

**Modal'da ne var:**
- Generator türü ("Cover Letter — E-2")
- Kullanılacak facts'lerin özeti
- Citing edilecek authority'ler (FAM, 8 CFR, USCIS PM)
- Conflict register'da çıkmış flag'ler ("şunu output'ta belirtmen gerekecek")
- Defensive paragraph'lar (eğer reviewer önceden "bu konuda riski ele al" demişse)
- Tahmini token sayısı + tahmini maliyet ($)
- Approve / Reject / Edit Facts butonları

**Mevcut hali:** Çalışıyor. Modal açılıyor, kapanıyor (Escape, backdrop tıklama, ✕ butonu — üçü de çalışıyor).

**Tasarımcıdan beklenen:**
- "$0.42" maliyet rakamı **görünür ama korkutmasın**.
- Authority listesi uzun (10-15 kalem olabilir) — okunabilir scroll.
- "Edit Facts" akışı şu an yok — designer "şu fact yanlış, şöyle olsun" inline edit deneyimini tasarlayabilir.

### 4.7. Document Preview Modal

**Ne için:** Avukat exhibits'te bir PDF'e tıkladığında ya da kapak mektubunda `[Tab E.4]` referansına tıkladığında o PDF inline açılır — ayrı sekme açmasına gerek kalmaz.

**Mevcut hali:** iframe ile çalışıyor. Floating ✕ butonu iframe'in üstünde.

**Tasarımcıdan beklenen:**
- iframe'in **annotation katmanı** — avukat PDF üstünde işaretleme yapabilir mi?
- "Bu PDF'in 26 doc_type variant'ından şuna düştü, şu fields çıktı" sidebar'ı (şu an sadece preview, extract'i göremiyor).

### 4.8. Cover Letter Viewer (clickable refs)

**Ne için:** Üretilen kapak mektubu satır satır streaming olarak gelir. İçinde `[Tab E.4]`, `[Tab F.2]` gibi referanslar — bunlar mavi link, tıklayınca o exhibit PDF'i açılır.

**Mevcut hali:** Streaming çalışıyor. Click-to-open çalışıyor. Hover preview yok.

**Tasarımcıdan beklenen:**
- **Hover preview** — tıklamadan da o exhibit'in ne olduğu görülsün (küçük popover).
- **[CITE NEEDED]** veya **[MISSING:phone]** gibi placeholder'lar — şu an düz [köşeli parantez], designer bunları "kırmızı uyarı pill" yapabilir.
- Streaming sırasında imleç animasyonu / blink — bot yazıyor hissi.

### 4.9. Conflict List (Reviewer Report)

**Ne için:** Reviewer ajanı draft'ı facts'lere karşı denetler ve severity 1-5 flag'ler çıkarır. Avukatın **submit etmeden önce mutlaka okuması** gereken liste.

**Mevcut hali:** Liste var, severity rank glyph'leri var (◦ • ▪ ▴ ▲), renkli.

**Tasarımcıdan beklenen:**
- Severity 4-5 flag'ler **submit butonunu disabled yapmalı** — designer bu interaction'ı tasarlamalı.
- Her flag bir "fix" akışı önerebilir ("şu facts'i düzelt", "şu paragrafı yeniden üret").
- Flag history — avukat fix'ledi, reviewer tekrar koştu, flag düştü mü?

### 4.10. Pipeline Progress

**Ne için:** Folder drop'tan sonra ~90 saniyelik pipeline avukatı bekletir. Sıkıcı bir progress bar değil, **forensic bir hisse** sahip olmalı (bot her PDF'i sınıflandırıyor, çıkartıyor, doğruluyor).

**Mevcut hali:** Stage label'ları var ("Detecting subtypes", "Praying to immigration gods · auditing draft against the unified facts"). Per-PDF progress yok.

**Tasarımcıdan beklenen:**
- Her PDF için **mini bir kart** — "passport.pdf · ✓ Identity · 2.1s".
- Stage timeline (5 stage: Detect → Extract → Aggregate → Draft → Review).
- Hata olduğunda hangi PDF'te ne oldu görünür olmalı.

---

## 5. Henüz UI'da olmayan ama olması gereken şeyler

Bunlar designer'ın **şu an boş** olduğunu bilmesi gereken alanlar:

1. **Multi-matter list** — şu an her seferde tek matter açık. Avukat 30 aktif vakası varsa, "vakalarım" sidebar'ı yok.
2. **Audit log viewer** — `db/audit/preview-approvals.jsonl` ve cost log var, ama UI'da görünmüyor. Compliance için bunlar görünür olmalı.
3. **Cost meter** — bu vaka şu ana kadar bana $X'e mal oldu, şu generate $Y olacak.
4. **API key / settings ekranı** — `.env.local` dosyasını elden düzeltiyor. Bir UI olmalı.
5. **Reviewer report tam ekran** — şu an liste, ama avukat 20+ flag varsa diff view ya da inline-on-document görmek isteyebilir.
6. **Authority browser** — vaka tipi başına allowlist'teki tüm FAM/8 CFR/PM kaynakları gezilebilir bir liste.
7. **Multi-user / firm view** — managing partner vs paralegal yetki ayrımı.
8. **History / versioning** — bir kapak mektubunu 3. kez generate ettin, eski versiyonları nerede?

---

## 6. Tasarım dili önerileri

Designer kararı ama yön niyeti:

- **"Atelier" hissi:** McKinsey + bir butik hukuk firması arası. Ne SaaS-y, ne fazla minimal. Tipografi'ye yatırım yap (serif başlıklar + sans gövde belki).
- **Renk paleti:** Çok az renk. Mavi (link/action), kırmızı (kritik), sarı (uyarı), gri tonları. "Approval modal" altın/sarı vurgu olabilir.
- **Density:** Avukat yoğun. Bilgi yoğunluğu yüksek olabilir, ama hierarchy net olmalı.
- **Microcopy:** Hukuki terim hiç çevrilmez (I-94, EB-1A, FAM 9, 8 CFR §214.2(e)). Etrafındaki UI metni sıcak ve self-aware olabilir ("praying to immigration gods" gibi mevcut tonu koru).

---

## 7. Designer'a teslim edilecek şeyler

Bu brief'le birlikte:
- `app/page.tsx` — mevcut ana sayfa (~2000 satır, scope: tüm dashboard).
- `app/components/pre-generation-approval.tsx` — modal.
- `ingest/schema.ts` — CaseFacts schema'ları.
- `lib/preview-store.ts` — generated artifact yapısı.
- Çalışan dev server üzerinden bir gerçek vaka klasörü ile demo (bu brief'i yazan kişi yapsın).

---

## 8. Açık sorular — designer'ın karar vermesi gereken

1. **Information architecture:** Tek sayfa vs çok sayfa? Şu an tek sayfada Facts + Exhibits + Generated + Reviewer var. Tab'lı mı olsun, panel'li mi?
2. **Mobile?** Avukat masaüstünde çalışır ama "kaç günüm kaldı" için telefondan I-94 countdown'a bakabilmek isteyebilir.
3. **Empty state'ler:** Henüz hiç matter yok ekranı, hiç PDF yüklenmedi ekranı, exhibit kategorisinde 0 PDF, vs.
4. **Onboarding:** İlk kullanım — avukat bot'tan ne bekleyeceğini bilmiyor. Tutorial mı, sample matter mı?
5. **Trust building:** Avukat "bu bot'un çıkardığı pasaport numarasına güvenebilir miyim" diye sürekli sorgular. Provenance + confidence + "bu fact'i 3 PDF'te gördüm" gibi trust signal'ları nasıl tasarlanır?
