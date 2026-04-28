/**
 * Tab A–L document inventory. The Akalan firm convention groups every
 * exhibit into one of twelve lettered tabs (A: Forms ... L: Dependent
 * Biographic Info). Each tab shows a stack of mock PDF thumbnails;
 * once the ingest pipeline writes back per-tab classifications the
 * `documents` prop becomes the source of truth.
 *
 * Display naming: each thumbnail shows the slot-based human-readable
 * `display_name` (Title Case, diacritics preserved) with the raw on-disk
 * filename rendered below in graphite small text for traceability. Disk
 * filenames are NEVER modified — display_name is pure metadata.
 */

interface DocStub {
  /** Raw on-disk filename. Always shown as the small graphite trailer. */
  filename: string;
  pages: number;
  /**
   * Human-readable display name. Optional because the legacy mock TABS
   * below predate the slot-based naming convention; when absent the
   * raw filename is used as the primary label too.
   */
  display_name?: string;
}

interface Tab {
  letter: string;
  title: string;
  hint: string;
  documents: DocStub[];
}

const TABS: Tab[] = [
  {
    letter: 'A',
    title: 'Forms',
    hint: 'G-1145 · G-28 · I-129 · I-129E · G-1650',
    documents: [
      { filename: 'G-1145.pdf', pages: 1 },
      { filename: 'G-28.pdf', pages: 2 },
      { filename: 'I-129.pdf', pages: 7 },
      { filename: 'I-129E_supplement.pdf', pages: 11 },
      { filename: 'G-1650_freedom_of_info.pdf', pages: 1 },
    ],
  },
  {
    letter: 'B',
    title: 'Cover Letter',
    hint: 'Counsel’s narrative + Index of exhibits',
    documents: [
      { filename: 'cover_letter_v0.4_DRAFT.pdf', pages: 23 },
      { filename: 'exhibit_index.pdf', pages: 4 },
    ],
  },
  {
    letter: 'C',
    title: 'Treaty Qualification',
    hint: 'Nationality of investor & enterprise',
    documents: [
      { filename: 'passport_bio_page.pdf', pages: 1 },
      { filename: 'TR_naturalization_certificate.pdf', pages: 2 },
      { filename: 'I-94_history.pdf', pages: 3 },
    ],
  },
  {
    letter: 'D',
    title: 'Ownership History',
    hint: 'Articles · operating agreement · membership ledger',
    documents: [
      { filename: 'articles_of_organization_FL.pdf', pages: 4 },
      { filename: 'operating_agreement_v3.pdf', pages: 22 },
      { filename: 'membership_ledger.pdf', pages: 1 },
      { filename: 'EIN_letter_CP575.pdf', pages: 1 },
    ],
  },
  {
    letter: 'E',
    title: 'Investment SOF',
    hint: 'Source-of-funds chain · escrow · wires',
    documents: [
      { filename: 'tapu_deed_bebek.pdf', pages: 6 },
      { filename: 'garanti_FX_confirmation.pdf', pages: 2 },
      { filename: 'wells_fargo_personal_stmt_2024-09.pdf', pages: 9 },
      { filename: 'is_yatirim_closing_statement.pdf', pages: 4 },
      { filename: 'notarized_gift_letter_TR.pdf', pages: 2 },
      { filename: 'wire_8819_8902_9015.pdf', pages: 3 },
    ],
  },
  {
    letter: 'F',
    title: 'Substantiality',
    hint: 'Proportionality memo · enterprise cost build-up',
    documents: [
      { filename: 'proportionality_memo.pdf', pages: 5 },
      { filename: 'enterprise_cost_buildup.pdf', pages: 3 },
    ],
  },
  {
    letter: 'G',
    title: 'Marginality',
    hint: 'Pro forma · payroll register · vendor invoices',
    documents: [
      { filename: 'pro_forma_5yr.pdf', pages: 14 },
      { filename: 'ADP_payroll_register_Q1.pdf', pages: 8 },
      { filename: 'vendor_invoices_bundle.pdf', pages: 27 },
    ],
  },
  {
    letter: 'H',
    title: 'Develop & Direct',
    hint: 'Org chart · signing authority · day-to-day evidence',
    documents: [
      { filename: 'org_chart.pdf', pages: 1 },
      { filename: 'signing_authority_resolution.pdf', pages: 2 },
      { filename: 'POS_daily_summary_screenshots.pdf', pages: 6 },
    ],
  },
  {
    letter: 'I',
    title: 'NOID Principal',
    hint: 'Holding tab — populated only on RFE/NOID',
    documents: [],
  },
  {
    letter: 'J',
    title: 'Forms for Dependents',
    hint: 'I-539 · I-539A · supplemental biographics',
    documents: [
      { filename: 'I-539.pdf', pages: 7 },
      { filename: 'I-539A_child.pdf', pages: 5 },
    ],
  },
  {
    letter: 'K',
    title: 'NOID Dependents',
    hint: 'Holding tab — populated only on RFE/NOID',
    documents: [],
  },
  {
    letter: 'L',
    title: 'Dependent Biographic Info',
    hint: 'Marriage cert · birth certs · spouse passport',
    documents: [
      { filename: 'marriage_certificate_apostille.pdf', pages: 4 },
      { filename: 'spouse_passport_bio.pdf', pages: 1 },
      { filename: 'child_birth_certificate.pdf', pages: 2 },
    ],
  },
];

export function DocumentInventory() {
  const totalDocs = TABS.reduce((acc, t) => acc + t.documents.length, 0);
  const totalPages = TABS.reduce(
    (acc, t) => acc + t.documents.reduce((a, d) => a + d.pages, 0),
    0,
  );

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-5 flex-wrap">
        <span className="smcp text-graphite">binder rollup</span>
        <span className="font-mono text-meta text-ink-2 tabular-nums">
          {totalDocs} documents · {totalPages} pages · 12 tabs
        </span>
      </div>

      <ul className="grid gap-px bg-rule border border-rule">
        {TABS.map((tab) => (
          <li key={tab.letter} className="bg-paper">
            <details className="group">
              <summary className="flex items-baseline gap-4 cursor-pointer select-none px-4 py-3 hover:bg-paper-2/60 transition-colors list-none [&::-webkit-details-marker]:hidden">
                <span className="font-mono text-title font-bold leading-none text-ink w-7 shrink-0">
                  {tab.letter}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-body font-semibold text-ink leading-tight">
                    {tab.title}
                  </div>
                  <div className="text-meta text-graphite-soft truncate mt-0.5">
                    {tab.hint}
                  </div>
                </div>
                <span className="font-mono text-meta text-graphite tabular-nums">
                  {tab.documents.length}{' '}
                  {tab.documents.length === 1 ? 'doc' : 'docs'}
                </span>
                <span className="font-mono text-meta text-graphite-soft transition-transform group-open:rotate-90">
                  ›
                </span>
              </summary>
              <div className="px-4 pb-5 pt-1">
                {tab.documents.length === 0 ? (
                  <p className="text-meta text-graphite-soft italic">
                    Nothing filed under this tab yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
                    {tab.documents.map((d) => (
                      <Thumbnail key={d.filename} doc={d} />
                    ))}
                  </div>
                )}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Thumbnail({ doc }: { doc: DocStub }) {
  const lines = Math.min(8, Math.max(3, Math.floor(doc.pages / 2) + 3));
  const primary = doc.display_name && doc.display_name.length > 0
    ? doc.display_name
    : doc.filename;
  return (
    <div className="group cursor-pointer">
      <div
        className="relative aspect-[3/4] paper-recess border border-rule-strong overflow-hidden hover:border-ink transition-colors"
        aria-hidden
      >
        <div className="absolute inset-3 grid gap-[3px] content-start">
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className="h-px bg-rule"
              style={{ width: i === 0 ? '70%' : `${50 + ((i * 17) % 45)}%` }}
            />
          ))}
        </div>
        <div className="absolute right-1.5 bottom-1.5 font-mono text-label text-graphite-soft tabular-nums">
          {String(doc.pages).padStart(2, '0')}p
        </div>
        <div className="absolute left-0 top-0 h-2 w-full bg-rule/40" />
      </div>
      <div
        className="mt-2 text-meta text-ink-2 leading-snug line-clamp-2"
        title={doc.filename}
      >
        {primary}
      </div>
      {doc.display_name && doc.display_name.length > 0 && (
        <small className="block mt-0.5 font-mono text-label text-graphite-soft tabular-nums truncate">
          {doc.filename}
        </small>
      )}
    </div>
  );
}
