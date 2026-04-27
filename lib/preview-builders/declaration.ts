/**
 * buildDeclarationPreview — pure analysis for the three-variant
 * declaration drafter. No Anthropic call.
 */

import type { CaseFacts } from '@/ingest/schema';
import type { DeclarantRole } from '@/draft/declaration';
import type {
  PreviewConflictEntry,
  PreviewFactRow,
  PreviewStructuralOutlineItem,
} from '@/lib/preview-store';

interface DeclarationPreviewBody {
  facts_used: PreviewFactRow[];
  defensive_paragraphs_required: string[];
  authorities_to_cite: string[];
  conflicts_to_flag_in_output: PreviewConflictEntry[];
  structural_outline: PreviewStructuralOutlineItem[];
  estimated_output_length_tokens: number;
  estimated_cost_usd: number;
}

const DECLARATION_INPUT_TOKENS_EST = 4_000;
const DECLARATION_OUTPUT_TOKENS_EST = 2_500;
const SONNET_INPUT_PER_MTOK = 3;
const SONNET_OUTPUT_PER_MTOK = 15;

const DECLARATION_AUTHORITIES = ['28 U.S.C. § 1746 (penalty of perjury)'];

const OUTLINE_BY_ROLE: Record<DeclarantRole, PreviewStructuralOutlineItem[]> = {
  beneficiary: [
    { roman: 'I', heading: 'Identity', one_line_summary: 'Declarant identifies self + immigration status.' },
    { roman: 'II', heading: 'Investment narrative', one_line_summary: 'Source, transfer, at-risk commitment.' },
    { roman: 'III', heading: 'Develop and direct', one_line_summary: 'Ownership + governance + operational control.' },
    { roman: 'IV', heading: 'Verification', one_line_summary: '28 U.S.C. § 1746 perjury formula.' },
  ],
  spouse: [
    { roman: 'I', heading: 'Identity', one_line_summary: 'Spouse identifies self + relationship to principal.' },
    { roman: 'II', heading: 'Marriage', one_line_summary: 'Date, place, name of principal beneficiary.' },
    { roman: 'III', heading: 'Intent', one_line_summary: 'Intent to accompany + intent to depart on status termination.' },
    { roman: 'IV', heading: 'Verification', one_line_summary: '28 U.S.C. § 1746 perjury formula.' },
  ],
  enterprise_representative: [
    { roman: 'I', heading: 'Identity', one_line_summary: 'Officer identifies self + role in petitioner entity.' },
    { roman: 'II', heading: 'Enterprise', one_line_summary: 'Legal name, EIN, formation, industry.' },
    { roman: 'III', heading: 'Ownership', one_line_summary: 'Investor stake + treaty-country aggregate ≥50%.' },
    { roman: 'IV', heading: 'Governance', one_line_summary: 'How the investor exercises develop-and-direct.' },
    { roman: 'V', heading: 'Verification', one_line_summary: '28 U.S.C. § 1746 perjury formula.' },
  ],
};

/** Field paths the declarations consume, by declarant role. */
const ROLE_PATHS: Record<DeclarantRole, string[]> = {
  beneficiary: [
    'investor.full_name',
    'investor.dob',
    'investor.nationality',
    'investor.passport_number',
    'investor.current_us_status',
    'investment.total_committed_usd',
    'investment.total_cost_of_enterprise_usd',
    'investment.proportionality_percent',
    'elements_evidence.develop_and_direct_basis',
    'source_of_funds',
  ],
  spouse: [
    'investor.full_name',
    'dependents',
  ],
  enterprise_representative: [
    'enterprise.legal_name',
    'enterprise.ein',
    'enterprise.formation_date',
    'enterprise.state_of_formation',
    'enterprise.industry',
    'ownership_chain',
    'elements_evidence.develop_and_direct_basis',
  ],
};

function readPath(facts: unknown, path: string): {
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
  if (
    cur &&
    typeof cur === 'object' &&
    'value' in cur &&
    'source_page' in cur &&
    'source_quote' in cur &&
    'confidence' in cur
  ) {
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

export function buildDeclarationPreview(
  caseFacts: CaseFacts,
  declarant: DeclarantRole,
): DeclarationPreviewBody {
  const paths = ROLE_PATHS[declarant];
  const facts_used: PreviewFactRow[] = paths.map((p) => {
    const r = readPath(caseFacts.facts, p);
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
    (DECLARATION_INPUT_TOKENS_EST / 1e6) * SONNET_INPUT_PER_MTOK +
    (DECLARATION_OUTPUT_TOKENS_EST / 1e6) * SONNET_OUTPUT_PER_MTOK;

  return {
    facts_used,
    defensive_paragraphs_required: [],
    authorities_to_cite: DECLARATION_AUTHORITIES,
    conflicts_to_flag_in_output: [],
    structural_outline: OUTLINE_BY_ROLE[declarant],
    estimated_output_length_tokens: DECLARATION_OUTPUT_TOKENS_EST,
    estimated_cost_usd,
  };
}
