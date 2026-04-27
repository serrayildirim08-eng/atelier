/**
 * buildNoidPreview — Notice of Intent to Depart preview.
 *
 * Two variants:
 *   - 'principal'  → declarant is the principal beneficiary
 *   - 'dependent'  → declarant is an accompanying spouse / minor child
 *
 * NoIDs are short attestations (≤ 1 page) that the declarant intends
 * to depart the United States upon termination of E-2 / E-2D status.
 * Pure preview — no Anthropic call here; the actual generator runs
 * after attorney approval.
 */

import type { CaseFacts } from '@/ingest/schema';
import type { TypedMemory } from '@/ingest/typed-memory';
import type {
  PreviewConflictEntry,
  PreviewFactRow,
  PreviewStructuralOutlineItem,
} from '@/lib/preview-store';

interface NoidPreviewBody {
  facts_used: PreviewFactRow[];
  defensive_paragraphs_required: string[];
  authorities_to_cite: string[];
  conflicts_to_flag_in_output: PreviewConflictEntry[];
  structural_outline: PreviewStructuralOutlineItem[];
  estimated_output_length_tokens: number;
  estimated_cost_usd: number;
}

const NOID_OUTLINE_PRINCIPAL: PreviewStructuralOutlineItem[] = [
  { roman: 'I', heading: 'Identity', one_line_summary: 'Declarant identifies self + nationality + passport.' },
  { roman: 'II', heading: 'Status', one_line_summary: 'Sought / current E-2 status.' },
  { roman: 'III', heading: 'Intent', one_line_summary: 'Intent to depart upon termination of E-2 status.' },
  { roman: 'IV', heading: 'Verification', one_line_summary: '28 U.S.C. § 1746 perjury formula.' },
];

const NOID_OUTLINE_DEPENDENT: PreviewStructuralOutlineItem[] = [
  { roman: 'I', heading: 'Identity', one_line_summary: 'Dependent identifies self + relationship to principal.' },
  { roman: 'II', heading: 'Status', one_line_summary: 'Sought / current E-2D status.' },
  { roman: 'III', heading: 'Intent', one_line_summary: 'Intent to depart upon termination of principal\'s E-2 status.' },
  { roman: 'IV', heading: 'Verification', one_line_summary: '28 U.S.C. § 1746 perjury formula.' },
];

const NOID_AUTHORITIES = ['28 U.S.C. § 1746 (penalty of perjury)'];

const NOID_INPUT_TOKENS_EST = 1_500;
const NOID_OUTPUT_TOKENS_EST = 600;
const SONNET_INPUT_PER_MTOK = 3;
const SONNET_OUTPUT_PER_MTOK = 15;

function readScalar(facts: unknown, path: string): {
  value: unknown;
  source_page: number | null;
  source_quote: string | null;
  confidence: number | null;
} {
  const parts = path.split('.');
  let cur: unknown = facts;
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') {
      return { value: null, source_page: null, source_quote: null, confidence: null };
    }
    cur = (cur as Record<string, unknown>)[p];
  }
  if (cur && typeof cur === 'object' && 'value' in cur) {
    const w = cur as Record<string, unknown>;
    return {
      value: w.value,
      source_page: typeof w.source_page === 'number' ? w.source_page : null,
      source_quote: typeof w.source_quote === 'string' ? w.source_quote : null,
      confidence: typeof w.confidence === 'number' ? w.confidence : null,
    };
  }
  return { value: cur, source_page: null, source_quote: null, confidence: null };
}

export function buildNoidPreview(
  caseFacts: CaseFacts,
  _memory: TypedMemory,
  variant: 'principal' | 'dependent',
): NoidPreviewBody {
  const paths =
    variant === 'principal'
      ? ['investor.full_name', 'investor.nationality', 'investor.passport_number', 'investor.current_us_status']
      : ['investor.full_name', 'dependents'];
  const facts_used: PreviewFactRow[] = paths.map((p) => {
    const r = readScalar(caseFacts.facts, p);
    return {
      field_path: p,
      value: r.value,
      source_doc: null,
      source_page: r.source_page,
      source_quote: r.source_quote,
      confidence: r.confidence,
    };
  });

  const estimated_cost_usd =
    (NOID_INPUT_TOKENS_EST / 1e6) * SONNET_INPUT_PER_MTOK +
    (NOID_OUTPUT_TOKENS_EST / 1e6) * SONNET_OUTPUT_PER_MTOK;

  return {
    facts_used,
    defensive_paragraphs_required: [],
    authorities_to_cite: NOID_AUTHORITIES,
    conflicts_to_flag_in_output: [],
    structural_outline:
      variant === 'principal' ? NOID_OUTLINE_PRINCIPAL : NOID_OUTLINE_DEPENDENT,
    estimated_output_length_tokens: NOID_OUTPUT_TOKENS_EST,
    estimated_cost_usd,
  };
}
