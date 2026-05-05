# Atelier — Designer A Moodboard
## Twelve references that earn their cite

Each entry: where to look, what specifically to borrow, what specifically NOT to borrow. Filtered through one constraint — this is a desktop legal tool, not a fashion magazine. Beauty is a side effect of fitness for purpose.

---

## Palette & material

### 1. **Aesop** (aesop.com/u/store-locator) — paper-cream + jet on hairline
- **Look at:** the store-locator pages (e.g., the Brick Lane signature page, or any Tokyo store page).
- **Borrow:** the cream ground (`#F8F4ED` ish), 1px hairline rules carrying ALL hierarchy, jet-black headlines in Optima Italic at 56px+ with no other type ceremony, a lower-case all-caps mono caption in Courier-adjacent at 11px tracking 0.18em.
- **Don't borrow:** the centered editorial layout, the lifestyle photography, the perfume-counter chic. Atelier is for the attorney's desk, not the boutique's wall. Also: Aesop runs no chromatic accent at all; we permit one (the seal).

### 2. **Kinfolk magazine** (printed issues 26+) — paper-vellum on dossier shell
- **Look at:** the masthead block on the inside front cover. Notice how the section name ("Reading Room", "Travel") is a Courier-style mono caption sitting flush left at 8pt, with 200% leading above and below.
- **Borrow:** the asymmetric column rhythm — body text in a 7-column ratio with a 3-column marginalia, identical to Atelier's main + Marginalia split (`grid-cols-[16rem_1fr_19rem]`). Borrow the marginalia treatment specifically: italic Fraunces pull-quotes, dropped capitals, vellum-on-vellum.
- **Don't borrow:** the photo-driven storytelling. We have no photos. We have facts under hairlines. Also: Kinfolk's pace is contemplative and slow; Atelier is contemplative-but-urgent (there's a deadline). The countdown lives in masthead Tier 1 specifically because we cannot afford Kinfolk's pace.

### 3. **Apartamento magazine** — informal warmth in masthead corners
- **Look at:** the section dividers (e.g., between editorial and "Notes" in issue 32+). Look at the way page numbers sit at the inside corner with a single mono digit and a 1pt rule.
- **Borrow:** the page-corner tag treatment for the masthead's brass diagonal score (§9.1) — small, deliberate, ignorable but felt. Borrow the lowercase-as-default treatment of section names ("notes", "interviews"), which is exactly the Atelier `smcp` doctrine.
- **Don't borrow:** the home-photography aesthetic, the chatty interview voice, the warm-warm-warm palette. Atelier permits one warm hairline (`--brass-hair`); not three.

---

## Typography

### 4. **The Gentlewoman** — Fraunces / serif at section headline scale
- **Look at:** the cover treatment of any issue, then the inside-feature headlines.
- **Borrow:** how a single Fraunces (or its kin, GT Sectra) headline at 64–96px is the only display ceremony on the page, and how the body underneath is a humble sans at 14–15px with no tonal competition. This is exactly Atelier's masthead → body relationship.
- **Borrow specifically:** the trick of italicizing only the punctuation (the period in `atelier.`). The Gentlewoman's masthead does this with the `n.` in "no.10". It's the rarest possible italic, and it's the soul of the wordmark.
- **Don't borrow:** their image-as-hero conventions, their fashion editorial layout. Atelier has no images.

### 5. **Monocle subscriber portal** (monocle.com/account, the inner pages)
- **Look at:** the membership-card render after login — the small-caps section labels in mono, the dignified "your subscription" tone, the way tabular figures sit on the right margin.
- **Borrow:** the micro-typography rules — `font-feature-settings: "tnum" 1, "ss01" 1`, mono uppercase tracking at exactly 0.10em (we already use 0.10em in `globals.css`, line 93 — it was previously 0.20em, the dial-back to 0.10em is correct), "smcp" labels that whisper rather than shout.
- **Borrow:** the rhythm of "label : value" pairs in the account dashboard, identical to the FactsPane Tier 2 rhythm.
- **Don't borrow:** the navy / teal accent. Monocle has chromatic permission we do not.

### 6. **Cleary Gottlieb internal dossier system** (proprietary, but I designed it; the canonical screenshot is in my portfolio)
- **Look at:** the way exhibit tabs A–L are rendered in a left-margin gutter, drop-cap style, on a hairline-bordered vellum recto. The display name to the right, the on-disk filename below it in Courier 9pt graphite.
- **Borrow:** this exact treatment for the Exhibits accordion (§6.5). Do not invent new typography for this; this is the convention every BigLaw associate already reads.
- **Don't borrow:** the burgundy header (Cleary brand). Atelier's seal is `#5B1A12` because it is **inked**, not branded.

---

## Layout & rhythm

### 7. **The Paris Review online** (theparisreview.org/interviews) — readable column on a quiet ground
- **Look at:** any of the long-form interviews (Joan Didion, James Baldwin). Notice the 68-character reading column, the 24px paragraph spacing, the absence of any UI chrome, the way blockquotes are flush-left with no italic.
- **Borrow:** the 68ch reading column for the Dossier (§4 spec). Borrow the rule of "section break = 48px of nothing, sometimes a centered dinkus, never a divider with a label." The dossier's pane sections obey this.
- **Don't borrow:** the dropcap-on-every-section treatment. We use dropcap once — on the empty state. Otherwise the pane reads as text, not as a design exercise.

### 8. **The New York Review of Books** print edition — masthead ceremony + sober body
- **Look at:** the front-page masthead. Notice the wordmark in serif italic, the table-of-contents below it in mono with em-dash separators between page numbers, the dignified silence between elements.
- **Borrow:** the masthead-as-ceremony pattern. Atelier's masthead is short (52px tall) but every element earns its place: wordmark, ⌘K line, clock, brass score. Borrow the em-dash separator in the meta column (`—` between elements, not `·`).
- **Don't borrow:** the all-text density of the inside spreads. The dossier needs more breath than the NYRB allows.

### 9. **Are.na editor** (are.na/anyone/channel) — register + register + register
- **Look at:** how channel blocks stack in the editor view. No card chrome, just a left-aligned title, a date in mono, a small triangle indicator. The whole interface reads as a list of registers, not a grid of tiles.
- **Borrow:** this exact pattern for the GeneratePanel (§6.7). Four registers, stacked, hairline between, no card chrome. Are.na is the proof that "list of editorial entries" can replace "grid of cards" without losing browse-ability.
- **Don't borrow:** the avatar circles, the "by [name]" attributions, the mosaic toggle. Atelier has no users to attribute and no images to mosaic.

---

## Voice & microcopy

### 10. **Field Notes brand book / the printed thank-you cards inside the package**
- **Look at:** the small printed line on the inside of any Field Notes 3-pack: *"I'm not writing it down to remember it later, I'm writing it down to remember it now."*
- **Borrow:** the **dry, deadpan, lowercase, full-sentence** voice. It is the voice of someone who knows the reader is a professional and trusts them to find the joke. This is the voice of the existing "praying to immigration gods" copy — Field Notes is the doctrine.
- **Don't borrow:** the rural / outdoorsy register. Atelier's voice is urban, lawyerly, and unsentimental.

### 11. **WhereCanIComplain.com / Defunct city of the day** (Tumblr-era, but the voice is gold)
- **Look at:** the dry, one-line state-of-affairs descriptions ("Today the Department of Sanitation is operating at 67% capacity. The reason is bureaucratic.").
- **Borrow:** this register for the Editor's note in Marginalia (§6.9). State-aware, dry, never enthusiastic, never alarmed. *"the desk is clear."* / *"reading the bundle."* / *"four flags. address them before signing."*
- **Don't borrow:** the political register. Atelier has no opinions about USCIS. Atelier has opinions about cover letters.

---

## Polish & detail

### 12. **The Strand bookstore's printed receipts** — wax-stamp + fountain-pen ceremony
- **Look at:** an actual paper receipt from the Strand (not the email). The header is letterpress, the line items are typewriter, the total is hand-stamped in a small oxblood square. Three voices, one slip of paper, perfect hierarchy.
- **Borrow:** the wax-stamp metaphor for the signed-artifact moment (§9.7). 36px round, oxblood `--seal`, attorney's initials in 11px Courier weight 700 paper-color centered inside. The stamp is the only chromatic moment on the screen at that beat, and that's why it lands.
- **Don't borrow:** the typewriter line items. Courier already does this work; we don't need to dress it up further.

---

## Anti-references — what we must not become

- **Notion** — too soft, too SaaS, too tile-grid, too rounded. Atelier's hairlines are sharp.
- **Linear** — beautiful but dark-mode-first, gradient-accented, springy. Atelier is paper-cream and unsprung.
- **Vercel dashboard** — exactly the trap GeneratePanel is currently in. Card chrome + multi-column tile grid + colored status pills. We replace this with editorial registers.
- **Apple Mail** — too transparent, too iOS, too tinted. Atelier's surfaces are paper, not glass.
- **Robinhood / fintech** — large numbers in green/red, big bold sans, dashboard-energy. Atelier's dollar figures are Fraunces and contemplative.
- **Stripe Atlas / docs** — competent and beautiful but **branded**. Atelier is not a brand exercise; it's a desk.
- **Adobe / Microsoft Word "modern" Office UI** — ribbon, cards, color-coded categories. Atelier never categorizes by color.
- **Most "AI" interfaces of 2024–2026** — chat surface, ghost-tokens, "Sparkle" icons, "✨" everywhere. Atelier has no chat surface. The bot is the clerk; the attorney is the partner. Neither speaks.

---

## Cross-cutting test for any new reference

If a candidate reference fails this question, drop it: **"Could this exist as a piece of paper on a partner's reading desk at 2 a.m.?"** Aesop's hairlines pass. Linear's gradients fail. The Gentlewoman's masthead passes. Vercel's tiles fail. Apply ruthlessly.
