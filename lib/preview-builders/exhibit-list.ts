/**
 * buildExhibitListPreview — mechanical, no LLM.
 *
 * The preview lists which PDFs would land in which Tab so the attorney
 * can move them before the index is rendered. Cost is $0 because the
 * exhibit-list generator itself is mechanical (no Anthropic call).
 */

import type { TypedMemory } from '@/ingest/typed-memory';
import { buildExhibitList } from '@/draft/exhibit-list';
import type {
  PreviewConflictEntry,
  PreviewFactRow,
  PreviewStructuralOutlineItem,
} from '@/lib/preview-store';

interface ExhibitListPreviewBody {
  facts_used: PreviewFactRow[];
  defensive_paragraphs_required: string[];
  authorities_to_cite: string[];
  conflicts_to_flag_in_output: PreviewConflictEntry[];
  structural_outline: PreviewStructuralOutlineItem[];
  estimated_output_length_tokens: number;
  estimated_cost_usd: number;
}

export function buildExhibitListPreview(
  memory: TypedMemory,
): ExhibitListPreviewBody {
  const list = buildExhibitList({ memory });

  // Each PDF that lands in the index becomes a fact row keyed by its
  // tab + display name so the attorney can drag/drop to relocate.
  const facts_used: PreviewFactRow[] = [];
  const outline: PreviewStructuralOutlineItem[] = [];
  for (const tab of list.tabs) {
    outline.push({
      roman: tab.tab,
      heading: tab.heading,
      one_line_summary: `${tab.items.length} doc${tab.items.length === 1 ? '' : 's'} · ${tab.total_pages} pp.`,
    });
    for (const item of tab.items) {
      facts_used.push({
        field_path: `tabs.${tab.tab}.items[${item.filename}].display_name`,
        value: item.display_name,
        source_doc: item.filename,
        source_page: null,
        source_quote: item.one_line_summary,
        confidence: 1,
      });
    }
  }

  return {
    facts_used,
    defensive_paragraphs_required: [],
    authorities_to_cite: [],
    conflicts_to_flag_in_output: [],
    structural_outline: outline,
    estimated_output_length_tokens: 0,
    estimated_cost_usd: 0,
  };
}
