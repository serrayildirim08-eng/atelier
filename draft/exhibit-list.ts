/**
 * Mechanical exhibit-list generator (no LLM).
 *
 * Reads the matter's typed memory + filename alias map and produces a
 * structured exhibit list bucketed by Akalan's A-L tab convention
 * (see `manuals/03-EXHIBIT-INDEX-TEMPLATE.md`). Output has two faces:
 *   1. JSON for the dashboard to render.
 *   2. Markdown the drafter can embed in the cover letter.
 *
 * Routing:
 *   - Default per-doc-type tab assignments live in DOC_TYPE_TO_TAB.
 *   - uscis_or_dos_form is disambiguated by form_id: I-539 / I-539A go
 *     to Tab J (dependents), everything else to Tab A.
 *   - 'other' and 'translation_certification' fall into 'unassigned'
 *     because their tab depends on the underlying document, not the
 *     classifier's slot.
 *   - The map is the firm's *primary* assignment. Cross-listing (e.g.,
 *     MITA on Tabs C/D/E) is an attorney decision; we surface the
 *     primary tab here and leave cross-references to the cover letter.
 *
 * Display name precedence: applied alias > suggested_filename > raw
 * filename. The alias map is the per-matter sidecar at
 * db/filename-aliases.json maintained by app/api/matter/[id]/rename.
 */

import type {
  DocType,
  PerPdfResult,
  TypedMemory,
} from '@/ingest/typed-memory';

/* ---------------------------------------------------------------------- */
/* Tab taxonomy                                                            */
/* ---------------------------------------------------------------------- */

export type Tab =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'unassigned';

export const TAB_ORDER: Tab[] = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'unassigned',
];

interface TabMeta {
  heading: string;
  element: string | null;
}

export const TAB_META: Record<Tab, TabMeta> = {
  A: { heading: 'Forms (Procedural)', element: null },
  B: { heading: 'Cover Letter', element: null },
  C: {
    heading: 'Qualification Under a Treaty of Commerce and Navigation',
    element: 'E-2 Element 1 — Treaty Country Nationality',
  },
  D: {
    heading: 'Ownership Structure and Corporate History',
    element: 'E-2 Element 1 — 50%+ Treaty-National Ownership',
  },
  E: {
    heading: 'Investment: Source, Transfer, At-Risk Commitment of Funds',
    element: 'E-2 Element 2 — Substantial Investment + Source of Funds',
  },
  F: {
    heading: 'Substantiality of the Investment',
    element: 'E-2 Element 2 — Proportionality Test',
  },
  G: {
    heading: 'Marginality and Ongoing Commercial Activity',
    element: 'E-2 Elements 3 (Real & Operating) + 4 (More than Marginal)',
  },
  H: {
    heading: 'Role of Beneficiary: Developing and Directing the Enterprise',
    element: 'E-2 Element 5 — Develop & Direct',
  },
  I: { heading: 'Notice of Intent to Depart (Principal)', element: null },
  J: { heading: 'Forms for Dependents', element: null },
  K: { heading: 'Notice of Intent to Depart (Dependents)', element: null },
  L: {
    heading: 'Biographic / Immigration Information for Dependents',
    element: null,
  },
  unassigned: { heading: 'Unassigned (attorney sort)', element: null },
};

export const DOC_TYPE_TO_TAB: Record<DocType, Tab> = {
  passport: 'C',
  status_doc: 'C',
  i94: 'C',
  bank_statement: 'E',
  tax_doc: 'G',
  money_movement: 'E',
  source_of_funds: 'E',
  formation_doc: 'D',
  ownership_evidence: 'D',
  lease_or_property: 'G',
  business_plan: 'G',
  invoice_or_receipt: 'E',
  business_contract: 'D',
  payroll_doc: 'G',
  uscis_or_dos_form: 'A',
  cover_letter: 'B',
  expert_letter: 'G',
  employer_letter: 'H',
  cv_or_resume: 'H',
  financial_statement: 'F',
  credential: 'H',
  vital_record: 'L',
  title_deed: 'E',
  government_id: 'C',
  translation_certification: 'unassigned',
  other: 'unassigned',
};

/** I-539 and I-539A filings are dependent forms — Tab J, not Tab A. */
const DEPENDENT_FORM_RE = /^\s*i[-\s]?539a?\b/i;

/* ---------------------------------------------------------------------- */
/* Output shape                                                            */
/* ---------------------------------------------------------------------- */

export interface ExhibitItem {
  filename: string;
  /** Applied alias > suggested_filename > raw filename. */
  display_name: string;
  doc_type: DocType;
  page_count: number;
  /** Per-document one-line summary if the classifier emitted one. */
  one_line_summary: string | null;
}

export interface ExhibitTab {
  tab: Tab;
  heading: string;
  element: string | null;
  items: ExhibitItem[];
  total_pages: number;
}

export interface ExhibitList {
  tabs: ExhibitTab[];
  total_pages: number;
  total_documents: number;
  generated_at: string;
}

export interface ExhibitListInputs {
  memory: TypedMemory;
  /** matter_id → { pdf_path → alias_filename }. Optional. */
  aliases?: Record<string, string>;
}

/* ---------------------------------------------------------------------- */
/* Implementation                                                          */
/* ---------------------------------------------------------------------- */

function pickDisplayName(
  filename: string,
  facts: PerPdfResult['facts'],
  aliases: Record<string, string> | undefined,
): string {
  const alias = aliases?.[filename];
  if (typeof alias === 'string' && alias.length > 0) return alias;
  const suggested = facts?.suggested_filename?.value;
  if (typeof suggested === 'string' && suggested.length > 0) return suggested;
  return filename;
}

function pickOneLineSummary(facts: PerPdfResult['facts']): string | null {
  if (!facts) return null;
  // The 'other' variant carries one_line_summary directly. Other variants
  // don't expose a single canonical summary field — leave null and let
  // the dashboard render via the type-specific schema if needed.
  if (facts.doc_type === 'other') {
    return facts.one_line_summary?.value ?? null;
  }
  return null;
}

export function pickTab(result: PerPdfResult): Tab {
  if (!result.facts) return 'unassigned';
  const docType = result.facts.doc_type;
  if (docType === 'uscis_or_dos_form') {
    const formId =
      facts_form_id(result.facts) ?? '';
    if (DEPENDENT_FORM_RE.test(formId)) return 'J';
    return 'A';
  }
  return DOC_TYPE_TO_TAB[docType] ?? 'unassigned';
}

/** Narrow accessor: only uscis_or_dos_form variant has form_id. */
function facts_form_id(facts: NonNullable<PerPdfResult['facts']>): string | null {
  if (facts.doc_type !== 'uscis_or_dos_form') return null;
  return facts.form_id?.value ?? null;
}

export function buildExhibitList(inputs: ExhibitListInputs): ExhibitList {
  const aliases = inputs.aliases;
  const buckets: Record<Tab, ExhibitItem[]> = {
    A: [],
    B: [],
    C: [],
    D: [],
    E: [],
    F: [],
    G: [],
    H: [],
    I: [],
    J: [],
    K: [],
    L: [],
    unassigned: [],
  };

  let totalDocs = 0;
  let totalPages = 0;

  for (const list of Object.values(inputs.memory)) {
    if (!list) continue;
    for (const result of list) {
      if (result.error || !result.facts) continue;
      const tab = pickTab(result);
      const item: ExhibitItem = {
        filename: result.filename,
        display_name: pickDisplayName(result.filename, result.facts, aliases),
        doc_type: result.facts.doc_type,
        page_count: result.pageCount,
        one_line_summary: pickOneLineSummary(result.facts),
      };
      buckets[tab].push(item);
      totalDocs += 1;
      totalPages += result.pageCount;
    }
  }

  // Sort each bucket by display_name for stable, human-readable output.
  for (const tab of TAB_ORDER) {
    buckets[tab].sort((a, b) =>
      a.display_name.localeCompare(b.display_name, 'en'),
    );
  }

  const tabs: ExhibitTab[] = TAB_ORDER.filter(
    (tab) => buckets[tab].length > 0,
  ).map((tab) => ({
    tab,
    heading: TAB_META[tab].heading,
    element: TAB_META[tab].element,
    items: buckets[tab],
    total_pages: buckets[tab].reduce((acc, i) => acc + i.page_count, 0),
  }));

  return {
    tabs,
    total_pages: totalPages,
    total_documents: totalDocs,
    generated_at: new Date().toISOString(),
  };
}

/* ---------------------------------------------------------------------- */
/* Markdown rendering                                                      */
/* ---------------------------------------------------------------------- */

export function renderExhibitListMarkdown(list: ExhibitList): string {
  if (list.tabs.length === 0) {
    return '_No exhibits indexed yet._';
  }
  const lines: string[] = [];
  lines.push('# Exhibit Index');
  lines.push('');
  lines.push(
    `${list.total_documents} document${list.total_documents === 1 ? '' : 's'} · ${list.total_pages} page${list.total_pages === 1 ? '' : 's'}`,
  );
  lines.push('');

  for (const tab of list.tabs) {
    const meta = TAB_META[tab.tab];
    const tabLabel = tab.tab === 'unassigned' ? 'Unassigned' : `Tab ${tab.tab}`;
    lines.push(
      `## ${tabLabel} · ${meta.heading} · ${tab.items.length} doc${tab.items.length === 1 ? '' : 's'} · ${tab.total_pages} pp.`,
    );
    if (meta.element) {
      lines.push(`*${meta.element}*`);
    }
    lines.push('');
    for (const item of tab.items) {
      const summary = item.one_line_summary
        ? ` — ${item.one_line_summary}`
        : '';
      lines.push(
        `- **${item.display_name}** (${item.page_count} pp.)${summary}`,
      );
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}

/**
 * Compact one-line-per-tab rendering for embedding in a cover letter:
 *   "Tab A · Forms · I-129, I-129E, G-28 · 12 pages"
 */
export function renderExhibitListCompact(list: ExhibitList): string {
  if (list.tabs.length === 0) return '';
  const lines: string[] = [];
  for (const tab of list.tabs) {
    const meta = TAB_META[tab.tab];
    const tabLabel = tab.tab === 'unassigned' ? 'Unassigned' : `Tab ${tab.tab}`;
    const names = tab.items.map((i) => i.display_name).join(', ');
    lines.push(
      `${tabLabel} · ${meta.heading} · ${names} · ${tab.total_pages} page${tab.total_pages === 1 ? '' : 's'}`,
    );
  }
  return lines.join('\n');
}
