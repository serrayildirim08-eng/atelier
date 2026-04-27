/**
 * buildCoverLetterPreview — pure analysis, no Anthropic call.
 *
 * Walks E2Facts, surfaces every leaf the drafter would consume, and
 * produces the preview payload the attorney reviews before approving.
 * The actual cover-letter generator runs only after /approve fires
 * (against an attorney-edited copy of facts_used).
 */

import type { CaseFacts } from '@/ingest/schema';
import type { TypedMemory } from '@/ingest/typed-memory';
import type {
  PreviewConflictEntry,
  PreviewFactRow,
  PreviewStructuralOutlineItem,
} from '@/lib/preview-store';

interface CoverLetterPreviewBody {
  facts_used: PreviewFactRow[];
  defensive_paragraphs_required: string[];
  authorities_to_cite: string[];
  conflicts_to_flag_in_output: PreviewConflictEntry[];
  structural_outline: PreviewStructuralOutlineItem[];
  estimated_output_length_tokens: number;
  estimated_cost_usd: number;
}

const E2_AUTHORITIES = [
  'INA § 101(a)(15)(E)(ii)',
  '8 CFR § 214.2(e)(12)–(16)',
  '9 FAM 402.9-4 (treaty country)',
  '9 FAM 402.9-6 (substantive standards)',
  'USCIS Policy Manual Vol. 2, Part G',
  'Matter of Walsh and Pollard, 20 I&N Dec. 60 (BIA 1988)',
  'Matter of Ho, 22 I&N Dec. 206 (Assoc. Comm\'r 1998)',
];

const E2_OUTLINE: PreviewStructuralOutlineItem[] = [
  { roman: 'I', heading: 'Introduction', one_line_summary: 'Identify investor, enterprise, treaty country, petition purpose.' },
  { roman: 'II', heading: 'Element One — Treaty Country Nationality', one_line_summary: 'Investor nationality + ≥50% treaty-country ownership.' },
  { roman: 'III', heading: 'Element Two — Substantial Investment', one_line_summary: 'Investment ledger, total cost, proportionality, irrevocable commitment.' },
  { roman: 'IV', heading: 'Element Three — Real and Operating Enterprise', one_line_summary: 'Bona fide active commercial undertaking; not speculative or passive.' },
  { roman: 'V', heading: 'Element Four — More Than Marginal', one_line_summary: 'Income or significant economic contribution; 5-year horizon.' },
  { roman: 'VI', heading: 'Element Five — Develop and Direct', one_line_summary: '≥50% ownership OR governance-based operational control.' },
  { roman: 'VII', heading: 'Source of Funds', one_line_summary: 'Lawful, traceable, possessed, irrevocably at-risk.' },
  { roman: 'VIII', heading: 'Conclusion', one_line_summary: 'Request favorable adjudication.' },
];

/** Cost estimate ~ Sonnet 4.6 input + 16K output draft. */
const COVER_LETTER_INPUT_TOKENS_EST = 12_000;
const COVER_LETTER_OUTPUT_TOKENS_EST = 16_000;
const SONNET_INPUT_PER_MTOK = 3;
const SONNET_OUTPUT_PER_MTOK = 15;

function flattenFacts(
  facts: unknown,
  prefix: string,
  out: PreviewFactRow[],
  filenameByPath: Record<string, string> = {},
): void {
  if (facts === null || facts === undefined) return;
  if (typeof facts !== 'object' || Array.isArray(facts)) return;
  const obj = facts as Record<string, unknown>;
  // Field<T> wrapper detection: { value, source_page, source_quote, confidence }
  if (
    'value' in obj &&
    'source_page' in obj &&
    'source_quote' in obj &&
    'confidence' in obj
  ) {
    out.push({
      field_path: prefix,
      value: obj.value,
      source_doc: filenameByPath[prefix] ?? null,
      source_page: typeof obj.source_page === 'number' ? obj.source_page : null,
      source_quote: typeof obj.source_quote === 'string' ? obj.source_quote : null,
      confidence: typeof obj.confidence === 'number' ? obj.confidence : null,
    });
    return;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      v.forEach((item, i) => flattenFacts(item, `${prefix}.${k}[${i}]`, out, filenameByPath));
    } else if (v && typeof v === 'object') {
      flattenFacts(v, `${prefix}.${k}`, out, filenameByPath);
    }
  }
}

function severeConflicts(
  conflict_register: unknown,
): PreviewConflictEntry[] {
  if (!Array.isArray(conflict_register)) return [];
  const out: PreviewConflictEntry[] = [];
  for (const c of conflict_register as Array<Record<string, { value?: unknown }>>) {
    const sev = typeof c?.severity?.value === 'number' ? c.severity.value : null;
    if (sev === null || sev < 3) continue;
    out.push({
      description: String(c.description?.value ?? ''),
      conflict_type: String(c.conflict_type?.value ?? ''),
      severity: sev,
      fact_a_doc: typeof c.fact_a_doc?.value === 'string' ? (c.fact_a_doc.value as string) : null,
      fact_b_doc: typeof c.fact_b_doc?.value === 'string' ? (c.fact_b_doc.value as string) : null,
    });
  }
  return out;
}

function tapuRequired(memory: TypedMemory): boolean {
  for (const list of Object.values(memory)) {
    if (!list) continue;
    for (const entry of list) {
      const gd = (entry as { governmentDoc?: { government_doc_subtype?: string } }).governmentDoc;
      if (gd?.government_doc_subtype === 'title_deed') return true;
    }
  }
  return false;
}

export function buildCoverLetterPreview(
  caseFacts: CaseFacts,
  memory: TypedMemory,
): CoverLetterPreviewBody {
  const factsUsed: PreviewFactRow[] = [];
  flattenFacts(caseFacts.facts, '$', factsUsed);

  const defensives: string[] = [];
  if (tapuRequired(memory)) defensives.push('tapu_explanation');

  const conflicts = severeConflicts(
    (caseFacts.facts as { conflict_register?: unknown }).conflict_register,
  );

  const estimated_cost_usd =
    (COVER_LETTER_INPUT_TOKENS_EST / 1e6) * SONNET_INPUT_PER_MTOK +
    (COVER_LETTER_OUTPUT_TOKENS_EST / 1e6) * SONNET_OUTPUT_PER_MTOK;

  return {
    facts_used: factsUsed,
    defensive_paragraphs_required: defensives,
    authorities_to_cite: E2_AUTHORITIES,
    conflicts_to_flag_in_output: conflicts,
    structural_outline: E2_OUTLINE,
    estimated_output_length_tokens: COVER_LETTER_OUTPUT_TOKENS_EST,
    estimated_cost_usd,
  };
}
