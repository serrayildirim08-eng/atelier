# moodboard.md — Atelier · Archival Craft

> 11 references, grouped by dimension. Each entry: what to borrow, what NOT to borrow. The reference exists so the implementation Claude has a specific anchor in the world; it is not a license to copy everything about the source.

---

## Palette / paper-stock anchors

### 1. Cassell & Company bound volumes (1907–1917)
*The Cassell illustrated reference series — "Universal Portrait Gallery," "Cassell's Family Magazine."*
**Borrow:** the cream-board-with-oxblood-cloth-spine ratio. The interior pages have foxed cream stock at roughly `#F2EAD8` after a century of UV; the spine is dyed a deep oxblood roughly `#6E1A1A` with a 1.2pt rule above and below the title block. The interior never uses oxblood — only the binding does. This is the doctrine: the chrome lives at the edges, the work lives on the page.
**Don't borrow:** the Edwardian filigree, the gold leaf, the Victorian title-block flourishes. Atelier's masthead is single-line italic small-caps Garamond, not an engraving.

### 2. Yale University Press / Foundation Press casebook spines (1980s–2010s reprints)
*The Yale Coursebook series; Foundation Press *Federal Income Taxation*; the West Hornbook in oxblood.*
**Borrow:** oxblood cloth at the spine, India-ink foil stamping for the title and author, a single ribbon marker (silk, forest green or burgundy) sewn at the head-band. Atelier's "open-here" ribbon down the active matter card is a direct port of the silk ribbon idiom. The ribbon is the only forest-green element in the entire app.
**Don't borrow:** the West "Black Letter" cover with white sans-serif type. Westlaw inherited that look and it now reads as 1990s database chrome. We're after the 1985 hornbook, not the 2003 reprint.

### 3. Cravath, Swaine & Moore letterhead engraving plate (mid-1990s)
*Cravath's letterhead is engraved bone-black on Crane's Crest 32lb cotton stock. The engraving has visible bite — paper is depressed where the type sits.*
**Borrow:** the bone-black ink (`#15140E`, biased very faintly cool), the 1.5pt top rule, the Garamond italic at the firm's name in a single line above an India-ink rule. The "letterpress bite" on Atelier buttons (1px translateY + inset shadow) is the digital equivalent of the engraving's depression.
**Don't borrow:** the firm's address block formatting, the centred address. Atelier is not letterhead; it is the case book the letterhead correspondence is bound into.

---

## Typography anchors

### 4. Hoefler & Co. *Pairings* — *Plantin × Garamond × Courier* (2017)
*One of H&Co's specimen pages explicitly built for legal documents. Plantin set at 10/13 for body, Garamond Premier at 28pt for chapter heads, Courier for citation strings.*
**Borrow:** the exact triad. Plantin body at 0.9375rem, Garamond display at 3.6rem masthead, Courier New at 0.6875rem citation strings. The hierarchical contrast reads "considered" at any zoom; sans-serif never enters the page hierarchy except as a bridge for status pills.
**Don't borrow:** the Hoefler color palette (their specimen uses a saturated ochre and teal). Our chrome is paper, ink, oxblood, forest, umber. Five values total.

### 5. *Cambridge Law Journal*, Cambridge University Press, 1988
*The CLJ has set in Plantin since the 1970s. Body justified, hyphens auto, 26-pica measure, drop-cap on each article.*
**Borrow:** the justified body with auto-hyphenation; the 26-pica (≈28rem) measure for the cover-letter pane; the Plantin reading weight; the hairline 0.5pt rule under the article title; small-caps for footnote markers. Atelier's draft pane sets like a CLJ article when printed at 100%.
**Don't borrow:** the running-head with article title in italic on every spread. We have a single drop folio; we don't need a running head.

### 6. Bringhurst, *The Elements of Typographic Style*, 3rd edition (Hartley & Marks, 2004)
*The Bringhurst is the textbook. Its own typography is what most people remember more than its content.*
**Borrow:** the proportion system (4px base, 1.5× rhythm), hanging punctuation, the drop folio convention, the "one italic moment per spread" rule, the 66ch optimal measure for sans bridges, the small-caps for section heads. Bringhurst's prescription that the primary text type and the display type should "agree but not match" is why we pair Plantin (body) with Garamond Premier (display).
**Don't borrow:** the academic frontispiece styling. Atelier is a working volume, not a treatise.

### 7. The 1990 Bluebook (15th edition)
*The Harvard Law Review's citation guide. Set in Times Roman body with Courier in citation fields. The 15th is the last edition before they re-typeset it; collectors prefer it.*
**Borrow:** the small-caps for case names; the Courier for citation strings (this is where Atelier's Courier-as-clerical-voice doctrine comes from); the use of em-dash and en-dash with hairline spacing. FAM, 8 CFR, USCIS PM citations in Atelier render in Courier `--text-cite` `--ink-umber` because the Bluebook taught us to.
**Don't borrow:** the Times Roman body — Plantin reads heavier and stamps better at body size. And the Bluebook's chrome (their cover is famously ugly).

---

## Layout / craft anchors

### 8. Smythe-sewn bound case books (Foundation Press, 2010s editions)
*Each case book is Smythe-sewn — folded signatures stitched through the fold rather than glued. The book opens flat. Head-band and tail-band are visible at the spine. Foliated page numbers in italic small-caps Garamond at the foot of each spread.*
**Borrow:** the open-flat assumption — Atelier's three-column layout is a flat-open spread, not a stacked single column. The head-band as the brass-rule reveal under the masthead. The foliated page numbers as the drop folio in `--graphite-soft` Garamond. The ribbon marker as the active-matter ribbon.
**Don't borrow:** the binding tape glued at the head-band. We don't need a faux-book chrome — the ribbon and folio carry it.

### 9. Pina Zangaro Machina presentation portfolio
*A bookbinder's-tape-and-screw-post architecture book, used by architects to present working portfolios. Linen-grey book cloth, exposed black screw posts, no covers — just bound paper.*
**Borrow:** the material register. Atelier's UI should feel like a working portfolio, not a finished book. The hairlines are the screw posts; the ruled rows are the bookbinder's tape. The dossier is bound but not sealed — pages can be added or removed.
**Don't borrow:** the linen texture. Our paper is foxed cream, not linen.

### 10. Letterpress impression on Crane's Lettra 110C cotton stock
*Crane's Lettra is the standard cotton stock for letterpress wedding invitations and law-firm letterhead. 110C is the heaviest weight — the bite from a hand-fed press is dramatic.*
**Borrow:** the impression itself. The :active state on Atelier buttons translates 1px and gains an inset shadow at 6% ink, mimicking the paper depression where letterpress type has been fed. The hover state retains the paper plane; only :active goes recessed.
**Don't borrow:** the wedding-invitation chrome (centred type, ornaments, deckle edges). Atelier has no deckle. The inner pages are clean cream.

---

## Index / dispatch anchors

### 11. *The Wall Street Journal* "What's News" left rail (1990s broadsheet)
*A typographic index of the day's most important stories, ranked by editorial weight. Each entry: bold sans-serif lede, italic continuation, page number in light Roman.*
**Borrow:** the typographic ranking — no chrome, no icons, weight and italic and tracking carry the hierarchy. Atelier's left matter rail is a direct port: matter name in Plantin 600, case-type glyph in Courier 700, days-remaining in Courier 700 right-aligned, all on hairlines. The rail is the WSJ "What's News" for an attorney's open matters.
**Don't borrow:** the WSJ Cheltenham hed-face. Plantin is heavier and reads "law firm," not "newspaper of record."

---

## Anti-references — explicitly do not drift toward these

### A. Notion / Linear / Vercel dashboard surfaces
*Rounded `2xl` cards, soft drop shadows, command bar, brand color accent.*
**Why this is not us:** card-based architecture pretends every piece of information is independent. A dossier is not independent. It is a single bound volume with hairlined sections. We have no cards, only ruled paragraphs.

### B. Westlaw / LexisNexis chrome
*Democratic blue, dropdown-as-everything, dense without typographic discipline.*
**Why this is not us:** Westlaw inherited the post-1995 database aesthetic and never recovered. We share their information density and reject their visual register completely. The 1985 Foundation Press hornbook is what Westlaw used to look like before it was a SaaS.

### C. Cursor / Perplexity / Claude.ai
*Typewriter "thinking…" loaders, ✨ icons, streaming-text fade-from-blur, AI-tool chrome.*
**Why this is not us:** Atelier is not an AI app. It is a paralegal's working volume that happens to use AI internally. The user should never see model names, token counts, or "thinking…" except inside the cost line of the approval modal where the line item is functional.

### D. *The Gentlewoman*, *Apartamento*, Inkwell editorial
*Italic kicker-ledes, 64pt mid-page swooning serifs, single saturated accent (cobalt or cherry).*
**Why this is not us:** this is Designer A's territory. Designer B is heavier, more solemn, more bookish. We don't swoon. The masthead is once per dossier, not once per section. Editorial drama and archival craft are different registers.

### E. Studio Lin / Pentagram-style minimalism
*Single sans-serif typeface, lots of negative space, Pantone yellow accent, "decorative restraint as concept."*
**Why this is not us:** we are typographically maximal under tight chromatic restraint. Three faces (Plantin, Garamond Premier, Courier) earning their spots, not one face doing all the work. Studio Lin is for branding; Atelier is for working.

---

End of moodboard.
