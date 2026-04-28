/**
 * buildBusinessPlanPreview — mechanical, no LLM.
 *
 * The actual 5-year plan is drafted by draftBusinessPlan (Sonnet 4.6,
 * structured output) only after attorney approval. This preview shows
 * which case-fact rows feed the plan, the authority anchor (Matter of
 * Ho is the SOLE citation the writer is allowed to use), the 8-section
 * outline, and a Sonnet 4.6 cost estimate.
 *
 * E-2 only — the writer's system prompt is wired for E-2 Treaty
 * Investor Tab G-8 / Tab H-1 exhibits.
 */

import type { CaseFacts } from '@/ingest/schema';
import type {
  PreviewConflictEntry,
  PreviewFactRow,
  PreviewStructuralOutlineItem,
} from '@/lib/preview-store';

interface BusinessPlanPreviewBody {
  facts_used: PreviewFactRow[];
  defensive_paragraphs_required: string[];
  authorities_to_cite: string[];
  conflicts_to_flag_in_output: PreviewConflictEntry[];
  structural_outline: PreviewStructuralOutlineItem[];
  estimated_output_length_tokens: number;
  estimated_cost_usd: number;
}

const BP_AUTHORITIES = [
  'Matter of Ho, 19 I&N Dec. 582 (BIA 1988) — sole permitted citation; plan must be "comprehensive, credible, and verifiable".',
];

const BP_OUTLINE: PreviewStructuralOutlineItem[] = [
  { roman: 'I', heading: 'Executive Summary', one_line_summary: 'Investor, enterprise, treaty country, capital deployed, 5-year thesis.' },
  { roman: 'II', heading: 'Market Analysis', one_line_summary: 'Industry, target customers, competitive landscape, sourced facts.' },
  { roman: 'III', heading: 'Products / Services', one_line_summary: 'What the enterprise sells, pricing, unit economics.' },
  { roman: 'IV', heading: 'Operational Plan', one_line_summary: 'Location, lease, suppliers, day-to-day operations.' },
  { roman: 'V', heading: 'Marketing Strategy', one_line_summary: 'Customer acquisition, channels, branding.' },
  { roman: 'VI', heading: 'Management Team', one_line_summary: 'Investor + key hires, qualifications, governance.' },
  { roman: 'VII', heading: 'Financial Projections (5-Year)', one_line_summary: 'Revenue / COGS / OpEx / NI per year + breakeven month + hiring schedule.' },
  { roman: 'VIII', heading: 'Growth Strategy', one_line_summary: 'Scaling plan, capital reinvestment, exit / continuity.' },
];

// Sonnet 4.6 prices (per 1M tokens). The plan is heavy — 16K output,
// long structured input + system prompt. Keep estimates honest.
const BP_INPUT_TOKENS_EST = 18_000;
const BP_OUTPUT_TOKENS_EST = 16_000;
const SONNET_INPUT_PER_MTOK = 3;
const SONNET_OUTPUT_PER_MTOK = 15;

function flattenFacts(
  facts: unknown,
  prefix: string,
  out: PreviewFactRow[],
): void {
  if (facts === null || facts === undefined) return;
  if (typeof facts !== 'object' || Array.isArray(facts)) return;
  const obj = facts as Record<string, unknown>;
  if (
    'value' in obj &&
    'source_page' in obj &&
    'source_quote' in obj &&
    'confidence' in obj
  ) {
    out.push({
      field_path: prefix,
      value: obj.value,
      source_doc: null,
      source_page: typeof obj.source_page === 'number' ? obj.source_page : null,
      source_quote: typeof obj.source_quote === 'string' ? obj.source_quote : null,
      confidence: typeof obj.confidence === 'number' ? obj.confidence : null,
    });
    return;
  }
  for (const [k, v] of Object.entries(obj)) {
    flattenFacts(v, prefix ? `${prefix}.${k}` : k, out);
  }
}

export function buildBusinessPlanPreview(
  caseFacts: CaseFacts,
): BusinessPlanPreviewBody {
  if (caseFacts.case_type !== 'E2') {
    throw new Error('Business-plan generator is wired for E-2 only.');
  }

  const facts_used: PreviewFactRow[] = [];
  flattenFacts(caseFacts.facts, '', facts_used);

  return {
    facts_used,
    defensive_paragraphs_required: [
      'Mark every projected figure WITHOUT a primary source as [ASSUMED — verify before filing].',
      'No URLs cited unless they appear verbatim in the industry-context block.',
      'No statutory or case citations beyond the Matter of Ho anchor.',
    ],
    authorities_to_cite: BP_AUTHORITIES,
    conflicts_to_flag_in_output: [],
    structural_outline: BP_OUTLINE,
    estimated_output_length_tokens: BP_OUTPUT_TOKENS_EST,
    estimated_cost_usd:
      (BP_INPUT_TOKENS_EST * SONNET_INPUT_PER_MTOK) / 1_000_000 +
      (BP_OUTPUT_TOKENS_EST * SONNET_OUTPUT_PER_MTOK) / 1_000_000,
  };
}
