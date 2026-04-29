# Atelier — Kanonik Design DNA

**Status:** v1.0 · 2026-04-29
**Owner:** ui-designer · onay: frontend-senior + Serra
**Replaces:** ad-hoc commit notu `c5f188f` "B&W token system + Notion-DNA matter dashboard"

---

## 1. Emotional thesis (tek satır)

> "İmmigrasyon avukatlığının kalemi gümüş, kâğıdı el yapımı — dijital olduğunda da o ağırlık hissedilmeli."

Bu satır her tasarım kararının taşına vurulduğu çekiç. Bir component soruşturmaya geliyorsa şu soruyu geçmeli: *"Bu, bir avukat masasındaki el yapımı dosyaya dokunma hissini koruyor mu, yoksa bir SaaS dashboard'una mı kayıyor?"*

## 2. Konum (positioning)

| Eksen | Atelier | Karşıt kutup |
|---|---|---|
| Material | El yapımı kâğıt, gümüş kalem, kumaş cilt | Plastik, cam, parlak metal |
| Tone | Restrained, editorial, monastic | Loud, peppy, gamified |
| Density | Spacious, white-space-as-design | Dense dashboard grid |
| Voice | Sentence-case, lowercase headings, "binder," "the matter," "verdict" | Title Case, "Submit," "Action Required" |
| Color | Warm neutrals + jet ink + 1 functional accent (rubric) | Brand-blue + neon-green + drop-shadow gray |

References as anchor:
- Aesop web (whitespace ritual, lowercase confidence)
- Kinfolk magazine (asymmetric editorial layouts)
- Monocle (mono-label discipline, restrained chromatics)
- Apartamento (warmth in neutrals, photographic warmth)
- Cabana magazine (ornament that carries meaning, never ornament-for-ornament)
- *Bluebook* + appellate brief tradition (margin notes, redline marginalia, citation rigor)

Anti-references (forbidden zone):
- Linear, Stripe, Notion'un kendi UI'ı
- Material Design'ın elevation diline yakın drop shadow
- AI-startup gradient'leri (purple → pink, blue → cyan)
- Glassmorphism, neumorphism
- Cards-on-grid SaaS dashboard
- Filled-glyph icons, emoji, bouncy animations

## 3. Palette tokens

Mevcut **"concrete & jet"** B&W sistem (paper / ink / graphite) **temel** olarak korunur — bu Atelier'in *omurgası*. Üzerine **iki sıcaklık katmanı** eklenir: surface ve accent. Renk hiçbir zaman bilgi taşımaz; bilgiyi typography weight + position + ornament taşır. Renk yalnızca **mood** ve **functional rubric** için.

### 3.1 Çekirdek — concrete & jet (mevcut, korunuyor)

```
--color-paper        #FAFAFA   /* baseline surface */
--color-paper-2      #F0F0F0   /* recessed */
--color-paper-3      #E5E5E5   /* deeper recess */
--color-paper-deep   #D4D4D4   /* dividers, hover wash */

--color-ink          #0A0A0A   /* default text */
--color-ink-2        #1F1F1F   /* secondary heavy */
--color-graphite     #404040   /* meta */
--color-graphite-soft #595959  /* tertiary meta */

--color-rule         rgba(10,10,10,0.10)
--color-rule-strong  rgba(10,10,10,0.32)
```

### 3.2 Warmth katmanı — cream + sage + sky (YENİ, eklenecek)

Bu üç token **mevcut B&W'a saygıyla** üzerine konur — surface tinted, accent restrained. Hiçbiri "renkli" hissetmemeli; "ışık almış kâğıt" hissetmeli.

```
/* Cream — paper'a hafif sıcak tint. Sıcak surfaces için. */
--color-cream        #F7F2E8   /* warm surface (sidebar, masthead block) */
--color-cream-2      #EFE7D5   /* recessed warm */
--color-cream-rule   rgba(120, 100, 60, 0.14)  /* warm hairline */

/* Sage — restrained editorial accent. Verified/positive states. */
--color-sage         #8A9A87   /* sage default — never bright */
--color-sage-deep    #5C6E5A   /* sage on text */
--color-sage-wash    rgba(138, 154, 135, 0.10)  /* surface tint */

/* Sky — quiet provenance / neutral data accent. */
--color-sky          #A3B4C2   /* sky default — dusty, not vibrant */
--color-sky-deep     #607285
--color-sky-wash     rgba(163, 180, 194, 0.10)
```

### 3.3 Functional rubric (severity / verdict)

Tek bir kontrollü kırmızı. Asla "danger red" değil — **el yazısı redline** rengi.

```
--color-rubric        #B8392E   /* annotated-margin red, only used as ink, not as fill > 5% area */
--color-rubric-soft   rgba(184, 57, 46, 0.06)  /* surface wash for blocking findings */
```

### 3.4 Renk kullanım disiplini

| Rol | Token | Allowed area |
|---|---|---|
| Default reading surface | paper | %80+ of viewport |
| Secondary surface (sidebar, side rail) | cream | sub-blocks, never full screen |
| Recessed/secondary depth | paper-2 / cream-2 | inputs, blockquote |
| Verified / positive | sage-deep (text), sage-wash (≤8% area) | "verified," "on allowlist," "acknowledged" badge |
| Provenance / neutral data | sky-deep / sky-wash | source-quote pulls, citation chips |
| Verdict critical | rubric | redline mark, never as full chip fill |
| Default ink | ink | bütün gövde metni |

**Kural:** her ekranda bir warm-surface (cream) **veya** bir functional accent (sage/sky/rubric), ikisi birden değil. Aynı viewport'ta üç renk çıkıyorsa biri fazlalık.

## 4. Type scale (mevcut, hafif düzenleme)

Sistem **iki aileli**:
- **Display:** Fraunces variable serif (next/font ile yüklü). SOFT 0, WONK 0, opsz tuned. Hero ve section başlıkları.
- **Body:** system sans (-apple-system, Helvetica Neue, Inter). UI ve okuma metni.
- **Mono:** ui-monospace (SF Mono, Berkeley Mono). Sayılar, citations, smcp labels.

Mevcut 8-token ölçek (`stunt / hero / display / section / title / lede / body / meta / label`) korunuyor. Tek tweak:

| Token | Eski | Yeni | Sebep |
|---|---|---|---|
| body | 0.9375rem (15px) | 0.9375rem (15px) | korunuyor |
| meta | 0.8125rem (13px) | 0.8125rem (13px) | korunuyor |
| **lede line-height** | implicit | **1.65** | luxury-editorial nefes |
| **body line-height** | 1.55 | **1.62** | Kinfolk-tier rahatlık |

Tracking discipline:
- smcp: 0.10em (mevcut, doğru — eski 0.20em terk edildi, iyi)
- cite: 0.18em (mevcut)
- display tier: -0.025em ila -0.04em (mevcut)
- body: 0 (default)

## 5. Spacing scale

Tailwind default'a sadık (4px taban) ama **layout padding'i agresif olarak büyütülüyor**:

| Bağlam | Min padding | Tercih edilen |
|---|---|---|
| Page hero / masthead | px-12 py-10 | **px-16 py-14** |
| Section between | gap-8 | **gap-12** |
| Card interior | p-6 | **p-7 / p-8** |
| Inline meta dot separator | mx-2 | mx-3 (stronger breath) |

**Kural:** "şüphede kaldığında padding ekle." Beyaz alan tasarımdır.

## 6. Motion tokens

| Token | Duration | Easing | Kullanım |
|---|---|---|---|
| `--motion-fade` | 200ms | ease-out | tooltip, focus, color shift |
| `--motion-reveal` | 280ms | cubic-bezier(0.2, 0.8, 0.2, 1) | fade-up entries (mevcut) |
| `--motion-slow` | 420ms | cubic-bezier(0.32, 0.72, 0, 1) | masthead reveal, drawer |
| `--motion-pulse` | 1.4s ease-in-out infinite | — | bg-progress dot only |

**Yasak:** spring physics, bounce, scale > 1.04 hover, parallax, rotate'lı entry. Hareket "kâğıt sayfa çevrildi" hissi vermeli, "App store'da scale-up" değil.

## 7. Iconography

- Stroke-only line icons. **1.25–1.5px stroke**. Round join.
- 16/20/24px sizes. Asla custom outside-grid.
- **Yasak:** filled glyphs, emoji, multi-color icons, Material rounded family, Heroicons solid.
- Önerilen kütüphaneler: Phosphor (regular weight), Lucide (custom 1.25px override), tabler-icons (1.5px native).
- Citation/legal-spesifik (margin paragraph mark, gavel, brief, fold) için custom 5–8 ikon set'i ileride çizilecek (D7 task'ı, ileride).

## 8. Ornament policy

| Ornament | Kullanım | Notlar |
|---|---|---|
| Hairline rule (1px rgba) | section dividers | mevcut, korunuyor |
| Brass rule (gradient hairline) | masthead alt çizgi, "halaylı" emphasis | mevcut, sparingly |
| Dinkus (· · ·) | empty-state hero, magazine break | mevcut, korunuyor |
| Drop cap | empty-state ve major page intros (1 instance per screen) | mevcut |
| Sigil (square mark) | matter masthead, attribution | mevcut |
| ⁂ asterism | section header decorator (tercih) | YENİ — Cabana esinli |
| § paragraph mark | margin-note, citation lead-in | YENİ |
| Marginalia (sağ rail) | reviewer panel, document review | mevcut, derinleşecek (D2) |

**Yasak ornaments:** drop shadow > 2% opacity, glassmorphism blur, gradient fills, scrolling chevrons, sparkles, animated underlines.

## 9. Microcopy ton

Hep sentence-case veya lowercase. Türkçe-tatlı-İngilizce dil:

- "the binder" (folder/portal yerine)
- "the matter" (case yerine, formal)
- "verdict" (status yerine, reviewer panelinde)
- "mark" (annotate/comment yerine)
- "return to the binder" (back yerine)
- "search the binder" (search yerine — already in code)
- "working" (loading yerine — already in code)
- "pending" (queued yerine)

**Yasak:** "Submit," "Click here," "Action Required," "Coming soon," "Powered by AI," exclamation marks anywhere.

## 10. State vocabulary (her component için zorunlu)

Bir component'in spec'i bu altıyı **tanımlamadan** review'a girmez:

1. **Default** — sakin, ana karakter
2. **Hover** — alttan emerges, hairline değişimi (renk değil)
3. **Focus** — 1.5px ink outline (mevcut), 2px offset
4. **Active/selected** — sol kenardaki 2px ink çubuk veya inverse jet (sigil-tier)
5. **Loading** — pulse-dot veya shimmer, asla spinner
6. **Empty** — drop-cap'li satır, dinkus, "the binder is bare." stilinde

## 11. Tek istisna: 11 Stop-Points

Aşağıdaki UI noktaları HITL/legal-compliance gerektirir; bu DNA'nın "subtle, restrained" doktrini bu noktalarda ihlal edilir — açıkça **uyarıcı tonda** olur:

- Engagement letter AI clause acknowledgement
- Citation verification gate
- Pre-generation human-loop approval
- Authority allowlist warnings
- Conflict register flagged entries
- (Diğerleri research/akalan-research-agent.md tanımı)

Bu noktalarda rubric color'a izin verilir, hairline 1.5px → 2px, kopya emperative-mood ("acknowledge before continuing") olabilir. **Default DNA'dan sapma deliberate ve dokümante.**

## 12. Versioning

Bu dosya `v1.x` semver. Token name ekleme **minor**, semantic değişme **major**. Major bump → tüm pod'a duyuru, frontend-senior approval.
