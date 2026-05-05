# EB-1A Document Structural-Variant Taxonomy

> Generic structural variants for EB-1A doc_types. Issuer and
> language live INSIDE variants; genre separates them.
>
> Date: 2026-05-05
> Status: draft v2 — awaiting Supervisor (Serra Yıldırım) sign-off
> Revisions: applied 2026-05-05 cross-review (4 P0 / 9 P1 / 7 P2).
> Total doc_types: 17
> Total variants: 41
> Maps to: Atelier 8-criterion intake taxonomy (Awards / Membership /
> Media / Judge / Original Contributions / Authorship / Critical Role /
> Remuneration), plus regulatory criteria (vii) Display and (x)
> Commercial Success when triggered.
> Companion to: `research/2026-04-29_doc-variant-taxonomy.md` (E-2 sibling)

---

## award_certificate
**Generic variant count:** 3
**Maps to criterion:** Awards (primary); occasionally Critical Role

### Variant 1 — Formal printed certificate / diploma
- **What it is:** Single-page certificate with ornamental border,
  org seal, recipient in display type, signature block.
- **Shared features:**
  - Display body line ("is hereby awarded to…").
  - Issuing emblem top center; 1-2 signatures with title.
  - Date of conferral; sometimes serial number.
  - Heavy negative space; minimal narrative.
- **Distinguishing markers:** Decorative border + display type, no
  jury rationale text.
- **Filename keywords:** `award, certificate, diploma, prize,
  honor, ödül, sertifika`
- **Classifier signals:**
  1. Centered display heading ("Certificate of…").
  2. Emblem top third + signatures bottom third.
  3. Recipient name in larger font than body.

### Variant 2 — Award announcement / press release
- **What it is:** Multi-paragraph announcement naming recipient,
  prize, rationale.
- **Shared features:**
  - Issuing org letterhead or web-article header.
  - Dateline + narrative body paragraphs.
  - Names a class/year; often lists jurors.
- **Distinguishing markers:** Prose body explaining why; not a
  certificate face. Multiple awardees often listed.
- **Filename keywords:** `announcement, press-release, awardees,
  laureate, winners, duyuru`
- **Classifier signals:**
  1. Dateline + paragraph structure.
  2. Lists multiple recipients or a jury panel.
  3. Verbs "announces / selected / named".

### Variant 3 — Award-program rules / selection-criteria packet
- **What it is:** Evidence describing how the award is judged —
  rules, jury, eligibility, prior awardees.
- **Shared features:**
  - Multi-page with sections (Eligibility, Jury, Process).
  - Hosted on award website; archived as PDF.
  - Lists prior winners or jurors.
- **Distinguishing markers:** Describes award itself, not recipient.
- **Filename keywords:** `rules, criteria, eligibility, jury,
  about-the-prize`
- **Classifier signals:**
  1. Headings include "Eligibility" or "Selection".
  2. No single named recipient.
  3. Often paired with a Variant 1.

---

## recommendation_letter
**Generic variant count:** 3
**Maps to criterion:** Any (h)(3) criterion the letter analyzes —
commonly Original Contributions, Critical Role, Authorship,
Membership; also Awards, Judge, and Media when the letter targets
those criteria

### Variant 1 — Independent expert opinion letter
- **What it is:** Letter from an expert with no prior tie to
  beneficiary, opining on field-wide impact.
- **Shared features:**
  - Recommender's institutional letterhead.
  - 3-6 pages: credentials → field → contribution → significance.
  - "I have never met / worked with" disclosure.
  - Signed, dated, CV often attached.
- **Distinguishing markers:** Explicit independence statement; broad
  field-impact language.
- **Filename keywords:** `expert, independent, opinion, EV, letter,
  recommendation, ref`
- **Classifier signals:**
  1. Phrase "I have never collaborated / am not affiliated".
  2. Letterhead not of beneficiary's employer.
  3. Five-section structure.

### Variant 2 — Dependent / collaborator letter
- **What it is:** Letter from a co-author, employer, advisor, or
  direct collaborator.
- **Shared features:**
  - Same shape as Variant 1 with relationship disclosure ("I
    supervised / co-authored / employed").
  - More granular project detail.
- **Distinguishing markers:** Affirmative tie to beneficiary;
  first-person joint-work narrative.
- **Filename keywords:** `collaborator, advisor, supervisor,
  coauthor, employer-letter`
- **Classifier signals:**
  1. Affirmative relationship sentence in opening.
  2. Letterhead of employer or co-author's institution.
  3. Insider project-level details.

### Variant 3 — Short endorsement / blurb
- **What it is:** 1-page endorsement or quick sign-off from a senior
  figure.
- **Shared features:**
  - Letterhead + 2-4 short paragraphs.
  - Reputational vouching, not analytical.
  - Sometimes an email PDF.
- **Distinguishing markers:** Under ~1 page; no five-section
  structure.
- **Filename keywords:** `endorsement, blurb, short-letter, note`
- **Classifier signals:**
  1. Page count = 1, word count < 400.
  2. No subsection headings.
  3. Signed by a high-title name (Director, Chair, CEO).

---

## citation_report
**Generic variant count:** 3
**Maps to criterion:** Original Contributions, Authorship

### Variant 1 — Database screenshot / export
- **What it is:** Export or screenshot of a citation database
  showing profile, h-index, citations, per-paper counts.
- **Shared features:**
  - Database UI chrome (logo, profile photo, metric tiles).
  - Tabular paper list with year + cited-by counts.
  - URL footer or capture timestamp.
- **Distinguishing markers:** Recognizable database branding; raw
  tabular per-paper rows.
- **Filename keywords:** `scholar, scopus, wos, citations, h-index,
  profile, export`
- **Classifier signals:**
  1. Database logo in header.
  2. Metrics block (h-index, i10, total citations).
  3. Headers "Title | Year | Cited by".

### Variant 2 — Citation analysis memo
- **What it is:** Narrative summary of citation metrics with
  screenshots embedded.
- **Shared features:**
  - Multi-page prose with totals, percentiles, comparators.
  - Embedded database screenshots as figures.
- **Distinguishing markers:** Prose around screenshots, not a raw
  export.
- **Filename keywords:** `citation-analysis, metrics-memo,
  impact-summary`
- **Classifier signals:**
  1. Headings + paragraphs around figures.
  2. Comparative phrasing ("top X% in field").
  3. Often paired with an expert letter referencing same numbers.

### Variant 3 — Field-normalized impact memo
- **What it is:** Memo or report contextualizing citations against
  field norms via FWCI (Field-Weighted Citation Impact),
  percentile-by-field, or top-X% certifications from SciVal,
  InCites, Dimensions.
- **Shared features:**
  - Source branding (SciVal / InCites / Dimensions).
  - FWCI numeric value (e.g., FWCI 4.2) with field-baseline
    interpretation (1.0 = world average).
  - Percentile-by-field bands (top 1% / 5% / 10%).
  - Subject-area / ASJC / FoR field codes.
- **Distinguishing markers:** Field-normalization vocabulary
  (FWCI, percentile-by-field, top-X%); not raw counts.
- **Filename keywords:** `fwci, scival, incites, dimensions,
  field-weighted, percentile, top-percent, normalized-impact`
- **Classifier signals:**
  1. Acronym "FWCI" or phrase "field-weighted citation impact".
  2. Source branding (SciVal / InCites / Dimensions).
  3. Top-X% certification or percentile-by-field band.

---

## peer_review_invitation
**Generic variant count:** 2
**Maps to criterion:** Judge

### Variant 1 — Journal review request email
- **What it is:** Email from journal editor asking beneficiary to
  review a manuscript.
- **Shared features:**
  - Headers (From journal, Subject "Review Invitation").
  - Manuscript ID + title + abstract.
  - Decision links ("Agree / Decline"); deadline.
- **Distinguishing markers:** Email format; manuscript ID; invite
  verb.
- **Filename keywords:** `review-invite, peer-review, manuscript,
  editor`
- **Classifier signals:**
  1. Subject contains "review" + "invitation"/"request".
  2. Manuscript-ID pattern.
  3. Decision-link or "Agree to Review" button.

### Variant 2 — Completed-review confirmation
- **What it is:** Post-review confirmation or portal record listing
  completed reviews.
- **Shared features:**
  - "Thank you for completing your review of…".
  - Reviewer-portal screenshot of past reviews.
  - Recognition badges (Publons / WoS Reviewer Recognition).
- **Distinguishing markers:** Past tense; lists multiple reviews.
- **Filename keywords:** `review-completed, publons, reviewer-record`
- **Classifier signals:**
  1. Verbs "completed / submitted / verified".
  2. Tabular list of N reviews.
  3. Recognition-platform branding.

---

## editorial_board_notice
**Generic variant count:** 2
**Maps to criterion:** Judge

### Variant 1 — Appointment / invitation letter
- **What it is:** Letter inviting beneficiary to serve on editorial
  board, program committee, or grant panel.
- **Shared features:**
  - Issuing journal/society letterhead.
  - Term length, responsibilities, start date.
  - Counter-signature line.
- **Distinguishing markers:** Forward-looking ("invite to serve"),
  names a term.
- **Filename keywords:** `editorial-board, appointment, invitation,
  program-committee`
- **Classifier signals:**
  1. Phrase "invite to serve / appointment to".
  2. Term-length sentence.
  3. Journal/society letterhead.

### Variant 2 — Masthead / board roster
- **What it is:** Public masthead or roster showing beneficiary as
  board member.
- **Shared features:**
  - Names + titles + affiliations under "Editorial Board".
  - Journal/conference branding; capture URL + date.
- **Distinguishing markers:** Beneficiary in a roster list, not a
  personal letter.
- **Filename keywords:** `masthead, board-roster, editors-page,
  committee-list`
- **Classifier signals:**
  1. Header "Editorial Board" / "Program Committee".
  2. Multi-name roster with affiliations.
  3. Beneficiary name highlighted in annotation.

---

## media_article
**Generic variant count:** 3
**Maps to criterion:** Media

### Variant 1 — Feature / profile article about beneficiary
- **What it is:** Article whose subject is the beneficiary; not
  authored by them.
- **Shared features:**
  - Outlet masthead; journalist byline.
  - Headline + body; photos of beneficiary.
  - Publication date, URL/print citation.
- **Distinguishing markers:** Beneficiary is OBJECT; byline is
  someone else.
- **Filename keywords:** `profile, feature, article, press, media`
- **Classifier signals:**
  1. Byline ≠ beneficiary; name in headline.
  2. Outlet branding present.
  3. Photo of beneficiary in body.

### Variant 2 — Interview / Q&A
- **What it is:** Q&A-format article quoting beneficiary.
- **Shared features:**
  - Alternating Q/A blocks.
  - Outlet branding; photo of beneficiary.
- **Distinguishing markers:** Q&A typographic structure.
- **Filename keywords:** `interview, qa, conversation, röportaj`
- **Classifier signals:**
  1. Repeating Q/A pattern (bold-Q, plain-A).
  2. Name in answer attributions.
  3. Outlet masthead.

### Variant 3 — Circulation / reach evidence
- **What it is:** Evidence of outlet's audience size or prestige
  (Alexa, ABC audit, media kit).
- **Shared features:**
  - Tabular reach metrics (uniques, print run, coverage).
  - Outlet name in title; not about beneficiary.
- **Distinguishing markers:** Data ABOUT outlet, not the article.
- **Filename keywords:** `circulation, audience, reach, media-kit,
  ranking`
- **Classifier signals:**
  1. Numeric audience data.
  2. Outlet logo + "media kit" framing.
  3. No beneficiary name in body.

---

## published_paper
**Generic variant count:** 4
**Maps to criterion:** Authorship, Original Contributions

### Variant 1 — Peer-reviewed journal article (PDF reprint)
- **What it is:** Final published article from a peer-reviewed
  journal.
- **Shared features:**
  - Journal masthead; volume/issue/pages/DOI.
  - Author block with affiliations + ORCID + corresponding-author
    indicator.
  - Abstract + IMRaD body + references.
  - Submission/acceptance dates.
- **Distinguishing markers:** DOI present; journal masthead; full
  references list.
- **Filename keywords:** `paper, journal, article, doi, reprint,
  pdf`
- **Classifier signals:**
  1. DOI string (`10.\d{4,9}/`).
  2. Masthead with volume / issue / pages.
  3. Abstract block + references section.

### Variant 2 — Conference proceedings paper
- **What it is:** Paper published in a conference proceedings volume.
- **Shared features:**
  - Conference name + year on header/footer.
  - Often shorter (4-12 pages); fixed two-column layout.
  - Indexed in IEEE/ACM/Springer LNCS-style headers.
- **Distinguishing markers:** Conference-name banner, not a journal
  masthead; ISBN rather than (only) ISSN.
- **Filename keywords:** `proceedings, conference, lncs, ieee-conf,
  acm`
- **Classifier signals:**
  1. Conference acronym + year in header/footer.
  2. Two-column rigid layout.
  3. ISBN string, sometimes paired with DOI.

### Variant 3 — Book chapter / edited-volume contribution
- **What it is:** A chapter authored by beneficiary inside a larger
  edited book.
- **Shared features:**
  - Chapter number + title at top.
  - Editor names noted at front matter; publisher logo.
  - Often single-column trade layout; references at chapter end.
- **Distinguishing markers:** "Chapter N" label; book title in
  header; editor + author distinct.
- **Filename keywords:** `chapter, book, edited-volume, springer,
  routledge`
- **Classifier signals:**
  1. "Chapter N — Title" header pattern.
  2. Book ISBN, not journal ISSN.
  3. References at chapter end + cross-reference to other chapters.

### Variant 4 — Predatory-venue red-flag pattern
- **What it is:** A document that LOOKS like Variant 1 but the
  venue is a predatory journal (Beall's-list adjacent, pay-to-
  publish without genuine peer review). Flagged for exclusion or
  defensive treatment.
- **Shared features:**
  - Journal masthead present but issuer is a known mill or
    unverified publisher.
  - Pay-to-publish badges, "fast-track" / "rapid review" claims.
  - Editorial board absent, anonymized, or implausibly broad.
  - No peer-review confirmation; suspiciously short
    submission-to-publication interval.
- **Distinguishing markers:** Surface-similar to Variant 1; fails
  on venue scrutiny.
- **Filename keywords:** `oa-pay, fast-track, omics, beall,
  predatory-flag`
- **Classifier signals:**
  1. Pay-to-publish or APC banner without indexed peer review.
  2. Editorial-board page missing, broken, or implausible.
  3. Submission-to-publication interval < 30 days disclosed.

---

## conference_invitation
**Generic variant count:** 2
**Maps to criterion:** Keynote / invited-speaker → Original
Contributions (v) + recognition-adjacent acclaim; session-chair /
program-committee role → Judge (iv). Disambiguate by role-keyword.

### Variant 1 — Speaker / keynote invitation letter
- **What it is:** Letter inviting beneficiary as speaker, keynote,
  panelist, or session chair.
- **Shared features:**
  - Conference letterhead; named role; date/venue.
  - Honorarium/travel terms (sometimes).
  - Program-chair signature.
- **Distinguishing markers:** Forward-looking; explicit role label.
- **Filename keywords:** `keynote, invited-speaker, panelist,
  conference-invite`
- **Classifier signals:**
  1. Phrase "invite as keynote / invited speaker".
  2. Conference name + date in opening.
  3. Program-chair signature block.

### Variant 2 — Conference program / agenda
- **What it is:** Agenda or program showing beneficiary in a
  session block.
- **Shared features:**
  - Time-slotted schedule with sessions + speakers.
  - Conference branding header.
- **Distinguishing markers:** Beneficiary as a name in a schedule,
  not addressed in a letter.
- **Filename keywords:** `program, agenda, schedule, sessions,
  speakers-list`
- **Classifier signals:**
  1. Time-stamped schedule grid.
  2. "Speakers"/"Panel" section listing beneficiary.
  3. Conference branding header/footer.

---

## judging_task_record
**Generic variant count:** 2
**Maps to criterion:** Judge

### Variant 1 — Judging assignment / rubric package
- **What it is:** Documentation showing beneficiary was assigned to
  judge a competition, grant, hackathon, thesis defense, or similar.
- **Shared features:**
  - Letter or email assigning role + rubric/criteria.
  - List of submissions or candidates to evaluate.
  - Confidentiality language.
- **Distinguishing markers:** Names beneficiary as evaluator and
  describes what is being judged.
- **Filename keywords:** `judge, jury, evaluator, rubric, grant-
  panel, thesis-jury`
- **Classifier signals:**
  1. Verb pattern "appointed as judge / evaluator / juror".
  2. Rubric or scoring criteria attached.
  3. List of items/candidates to assess.

### Variant 2 — Completed-judging confirmation
- **What it is:** Letter or certificate confirming beneficiary
  completed a judging cycle.
- **Shared features:**
  - Past-tense confirmation; thanks language.
  - May list cycle/year/cohort.
  - Issuing org letterhead.
- **Distinguishing markers:** Past-tense, retrospective.
- **Filename keywords:** `judging-confirmation, thank-you-judge,
  jury-completed`
- **Classifier signals:**
  1. Past-tense verbs ("served as / completed").
  2. Org letterhead, not a rubric.
  3. Cycle/year identifier.

---

## patent_or_ip_filing
**Generic variant count:** 3
**Maps to criterion:** Original Contributions

### Variant 1 — Granted patent face / front page
- **What it is:** First page of a granted patent showing patent
  number, title, inventors, assignee, abstract.
- **Shared features:**
  - Patent-office seal/header (USPTO, EPO, WIPO, TÜRKPATENT).
  - Patent number + filing/grant dates.
  - Inventor + assignee blocks.
  - Abstract + representative figure.
- **Distinguishing markers:** Office seal + patent number in standard
  format.
- **Filename keywords:** `patent, granted, uspto, epo, wipo,
  türkpatent`
- **Classifier signals:**
  1. Office seal/header (USPTO/EPO/WIPO/etc.).
  2. Patent number pattern (e.g., `US\d{7,8}B\d`, `EP\d{7}B\d`).
  3. Inventor / Assignee labeled fields.

### Variant 2 — Pending application / publication
- **What it is:** Published pending application not yet granted.
- **Shared features:**
  - Application number + publication number.
  - "Pub. Date" earlier than any grant.
  - Same office header style as Variant 1.
- **Distinguishing markers:** Status = published/pending, not
  granted.
- **Filename keywords:** `application, pending, published-app,
  pre-grant`
- **Classifier signals:**
  1. Application-number pattern (e.g., `US\d{4}/\d{7}A\d`).
  2. Word "Application" in title block.
  3. No grant date present.

### Variant 3 — Citation / forward-citation evidence
- **What it is:** Evidence that the patent has been cited by other
  patents or papers — a derivative impact document.
- **Shared features:**
  - List of citing patents/papers with dates.
  - Often from Google Patents, Lens.org, or USPTO PAIR.
  - Source platform branding.
- **Distinguishing markers:** Citing-document list, not the patent
  itself.
- **Filename keywords:** `forward-citations, cited-by, lens,
  google-patents`
- **Classifier signals:**
  1. Tabular list with patent/paper IDs + dates.
  2. Platform branding (Google Patents / Lens.org).
  3. Reference to a parent patent number.

---

## salary_evidence
**Generic variant count:** 3
**Maps to criterion:** Remuneration / High Salary

### Variant 1 — Pay record (W-2, paystub, 1099, payroll summary)
- **What it is:** Tax or payroll document showing beneficiary's
  actual compensation.
- **Shared features:**
  - Issuer + recipient block; tax year or pay period.
  - Gross / net / withholdings columns.
  - Government form layout (W-2 boxes 1-20) or payroll software
    template.
- **Distinguishing markers:** Standardized box layout (W-2/1099) or
  per-period payroll grid.
- **Filename keywords:** `w2, paystub, 1099, payroll, salary,
  bordro`
- **Classifier signals:**
  1. Form heading ("W-2", "1099-NEC", "Pay Statement").
  2. Numbered box layout or pay-period table.
  3. SSN/EIN-style ID fields (often redacted).

### Variant 2 — Employment contract / offer letter (compensation
  clause)
- **What it is:** Contract or offer specifying salary, bonus, equity
  terms.
- **Shared features:**
  - Letterhead or contract cover page.
  - Compensation clause / Schedule A; signature block.
  - Term length, title, reporting line.
- **Distinguishing markers:** Forward-looking; states agreed
  compensation, not paid record.
- **Filename keywords:** `offer, contract, employment-agreement,
  compensation-clause`
- **Classifier signals:**
  1. Headers "Offer Letter" / "Employment Agreement".
  2. Compensation section heading.
  3. Signature block with both parties.

### Variant 3 — Comparable-salary benchmark report
- **What it is:** Third-party report showing field/role salary
  distribution. US sources: BLS OEWS, OFLC, Payscale, Glassdoor,
  Mercer, Radford. Non-US / overseas-comparator sources: TÜİK
  (Türkiye İstatistik Kurumu), Eurostat SES (Structure of
  Earnings Survey), Robert Half EMEA salary guide.
- **Shared features:**
  - Benchmark source branding (US or non-US).
  - Percentile distribution (10th / 50th / 90th) for occupation.
  - Geography + SOC code (US data) or job family / NACE / ISCO
    code (EU data) or NUTS-region key.
- **Distinguishing markers:** ABOUT the field/role, not the
  beneficiary; tabular percentiles. Non-US benchmarks required
  when (ix) is anchored on overseas compensation.
- **Filename keywords:** `bls, oews, oflc, mercer, radford,
  payscale, glassdoor, salary-survey, tüik, eurostat, ses,
  robert-half-emea`
- **Classifier signals:**
  1. Source branding (BLS / OFLC / Mercer / TÜİK / Eurostat /
     Robert Half EMEA / etc.).
  2. Percentile distribution table.
  3. SOC code (US) or NACE/ISCO/NUTS identifier (EU/TR).

---

## membership_credential
**Generic variant count:** 2
**Maps to criterion:** Membership

### Variant 1 — Admission / induction letter
- **What it is:** Letter from a selective body confirming
  beneficiary's election or admission.
- **Shared features:**
  - Org letterhead; "We are pleased to inform" pattern.
  - Date of election; class/cohort name.
  - Signature of president/secretary.
- **Distinguishing markers:** One-time admission event; refers to
  selection process.
- **Filename keywords:** `admission, induction, election, fellow,
  member-letter`
- **Classifier signals:**
  1. Verb pattern "elected / inducted / admitted as".
  2. Org letterhead with selectivity language.
  3. Class/cohort year.

### Variant 2 — Membership-criteria / bylaws excerpt
- **What it is:** Org's published criteria documenting that
  membership requires outstanding achievement (judged by experts).
- **Shared features:**
  - Bylaws section / "Become a Fellow" page.
  - Criteria list (years of practice, peer nomination,
    contributions).
  - Often paired with a Variant 1 for the same org.
- **Distinguishing markers:** ABOUT the org's criteria, not the
  beneficiary.
- **Filename keywords:** `criteria, bylaws, fellowship-rules,
  eligibility, how-to-join`
- **Classifier signals:**
  1. Headings "Eligibility" / "Selection Criteria" / "Fellowship".
  2. Numbered criteria list.
  3. No beneficiary name; org-level document.

---

## cv_or_resume
**Generic variant count:** 2
**Maps to criterion:** Cross-cutting (orienting document for all 8
criteria)
**Cascade flag:** Non-anchor — orienting only. CV/resume alone
MUST NOT fire any criterion-classifier branch on its own; it is a
navigation aid for the human reviewer, not primary evidence.

### Variant 1 — Academic CV (long-form, EB-1A flavored)
- **What it is:** Multi-page CV with sections aligned to EB-1A
  criteria — Awards, Memberships, Publications, Talks, Editorial /
  Review service, Patents, Press.
- **Shared features:**
  - 4-15+ pages; reverse-chronological lists per section.
  - Numbered or bulleted publications with venues + DOIs.
  - "Awards" / "Honors" section near top.
  - Often a "Selected Press" or "Media" section.
- **Distinguishing markers:** Section structure mirrors EB-1A
  criteria; long.
- **Filename keywords:** `cv, curriculum-vitae, academic-cv,
  long-cv, özgeçmiş`
- **Classifier signals:**
  1. Section headers including "Publications" + "Awards" +
     "Talks/Invited Lectures".
  2. Page count > 3; dense list formatting.
  3. DOI or arXiv strings present in body.

### Variant 2 — Industry resume (short-form)
- **What it is:** 1-2 page resume emphasizing roles, achievements,
  skills.
- **Shared features:**
  - 1-2 pages; bullet lists under each role.
  - Skills / Tools row; education at bottom.
  - Less emphasis on publications; sometimes a "Selected Honors"
    line.
- **Distinguishing markers:** Short; role-driven; few or no
  publications.
- **Filename keywords:** `resume, cv-short, one-pager, özgeçmiş`
- **Classifier signals:**
  1. Page count ≤ 2.
  2. Skills/tools section present.
  3. Roles bulleted as accomplishments, not publications.

---

## exhibition_record
**Generic variant count:** 3
**Maps to criterion:** Display (criterion (vii))

### Variant 1 — Exhibition catalog / curator statement
- **What it is:** Printed or PDF catalog accompanying an exhibition,
  with curator essay naming and contextualizing beneficiary's work.
- **Shared features:**
  - Venue branding cover; exhibition title + dates.
  - Curator statement (1-3 pages) discussing artists/works.
  - Plate pages with reproductions + captions (artist, title,
    medium, year).
- **Distinguishing markers:** Curatorial prose ABOUT the show; not
  a press release or invoice.
- **Filename keywords:** `catalog, catalogue, curator-statement,
  exhibition-essay, sergi-katalog`
- **Classifier signals:**
  1. Section "Curator's Statement" / "Curatorial Note".
  2. Plate pages with artist/title/medium/year captions.
  3. Venue + exhibition-dates header.

### Variant 2 — Venue-reputation packet
- **What it is:** Evidence the venue itself is distinguished —
  museum tier, prior-exhibitor list, press archive.
- **Shared features:**
  - Venue mission/about page; collection or program scope.
  - Prior shows / past exhibitor index.
  - Industry rankings or accreditations (AAM, ICOM, biennale
    affiliation).
- **Distinguishing markers:** ABOUT the venue, not the beneficiary.
- **Filename keywords:** `venue, museum-about, gallery-profile,
  biennale, sergi-mekan`
- **Classifier signals:**
  1. Pages titled "About" / "Our Program" / "Collection".
  2. List of prior exhibiting artists.
  3. Accreditation or ranking references.

### Variant 3 — Exhibition press / review coverage
- **What it is:** Reviews or feature articles about the exhibition
  itself, mentioning beneficiary's work.
- **Shared features:**
  - Outlet masthead; critic byline.
  - Names exhibition + venue + selected artists.
  - Critical assessment of the show.
- **Distinguishing markers:** Third-party critical voice on the
  exhibition; not a curator statement.
- **Filename keywords:** `review, exhibition-press, art-review,
  sergi-eleştirisi`
- **Classifier signals:**
  1. Critic byline + outlet branding.
  2. Names exhibition title + venue + dates.
  3. Evaluative language ("the show", "this exhibition").

---

## commercial_success_record
**Generic variant count:** 2
**Maps to criterion:** Commercial Success (criterion (x))

### Variant 1 — Audited sales / box-office / streaming report
- **What it is:** Certified or audit-trail report of commercial
  performance — box-office, ticketing, RIAA/IFPI sales, audited
  streaming counts.
- **Shared features:**
  - Issuer branding (Box Office Mojo audited feed, RIAA, IFPI,
    Luminate / MRC, ticketing platform export).
  - Time-windowed totals + per-title or per-tour line items.
  - Venue / territory / format breakdown.
- **Distinguishing markers:** Numeric tabular sales data with
  audit-trail or third-party-issuer branding; not self-reported.
- **Filename keywords:** `box-office, sales-report, audited,
  streaming-report, riaa, luminate, gişe`
- **Classifier signals:**
  1. Numeric columns (units / revenue / streams) with totals.
  2. Issuer branding from a recognized auditor / data house.
  3. Title + date-range header.

### Variant 2 — Chart-position evidence
- **What it is:** Evidence of chart placement — Billboard, IFPI,
  MÜ-YAP, national charts — for the beneficiary's title or tour.
- **Shared features:**
  - Chart-issuer branding + week / period identifier.
  - Ranked list with title and rank position.
  - Often paired with screenshot timestamps.
- **Distinguishing markers:** Ranked chart format; named chart
  authority.
- **Filename keywords:** `chart, billboard, ifpi, müyap,
  top-100, chart-position`
- **Classifier signals:**
  1. Ranked list with numeric position.
  2. Chart-issuer logo + week/date.
  3. Title + artist columns.

---

## org_reputation_packet
**Generic variant count:** 3
**Maps to criterion:** Critical Role (criterion (viii))

### Variant 1 — Rankings / awards-to-organization
- **What it is:** Evidence the organization itself holds rankings
  or awards — industry rankings, "best places to work", sector
  league tables, awards conferred on the org.
- **Shared features:**
  - Ranking-issuer branding (Forbes, FT, sector trade body).
  - Named ranked list or award announcement; org placement.
  - Methodology note or selection criteria.
- **Distinguishing markers:** ABOUT the org, not the beneficiary.
- **Filename keywords:** `ranking, league-table, top-firms,
  award-to-org, kurumsal-ödül`
- **Classifier signals:**
  1. Ranked or awarded org list with methodology.
  2. Org placement highlighted.
  3. Issuer branding from a recognized ranking body.

### Variant 2 — Regulatory / institutional uptake
- **What it is:** Evidence the org's work, products, or standards
  have been adopted by regulators, governments, or peer
  institutions.
- **Shared features:**
  - Regulator or institutional-letter source.
  - Reference to org's product / methodology / standard.
  - Adoption or implementation language.
- **Distinguishing markers:** Third-party adoption signal; not
  self-promotion.
- **Filename keywords:** `regulatory-uptake, adoption,
  standards-cited, government-reference`
- **Classifier signals:**
  1. Regulator / agency letterhead or document.
  2. Names the org's product / framework.
  3. Adoption / implementation verbs.

### Variant 3 — Press about the organization + partnership evidence
- **What it is:** Independent press, partnership announcements,
  funding rounds, scale evidence (headcount, revenue, geographic
  footprint).
- **Shared features:**
  - Outlet masthead OR partner-org letterhead.
  - Names the org; describes scale, partnership, or funding.
- **Distinguishing markers:** Third-party voice ABOUT the org.
- **Filename keywords:** `org-press, partnership, funding-round,
  scale, kurumsal-haberler`
- **Classifier signals:**
  1. Independent outlet or partner-org branding.
  2. Org named in headline or first paragraph.
  3. Numeric scale / partnership / funding details.

---

## comparable_evidence_packet
**Generic variant count:** 1
**Maps to criterion:** Any (h)(3) criterion that "does not readily
apply" per 8 CFR § 204.5(h)(4)

### Variant 1 — Comparable-evidence brief
- **What it is:** A purpose-built sub-packet inside the cover
  letter (or as a discrete exhibit memo) arguing (h)(4)
  substitution for a listed criterion that doesn't apply.
- **Shared features:**
  - Inapplicability paragraph naming the listed criterion and
    explaining why it does not fit the occupation.
  - Substitute-indicator description.
  - Equivalence argument tying substitute to the regulatory
    purpose of the original criterion.
  - Supporting exhibits (industry-convention evidence, expert
    testimony on field structure).
  - Cite to *Visinscaia* + PM Vol. 6, Pt. F, Ch. 2.
- **Distinguishing markers:** Argumentative memo structure; not a
  primary-evidence document on its own.
- **Filename keywords:** `comparable-evidence, h4-brief,
  204-5-h-4, substitute-evidence`
- **Classifier signals:**
  1. Cite to "8 CFR § 204.5(h)(4)" or "comparable evidence".
  2. Structure: inapplicability → substitute → equivalence.
  3. *Visinscaia* citation present.

---

## End of taxonomy
