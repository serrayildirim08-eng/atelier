/**
 * buildFormsPreview — mechanical, no LLM.
 *
 * Loads the form's field map (draft/forms/<form-id>.json), resolves
 * every JSONPath against the matter's data, and surfaces:
 *   - which fields will be filled (with the resolved value)
 *   - which fields are unfilled (mapped path → null/undefined)
 * The attorney sees the full punch list before the PDF is generated.
 */

import { loadFieldMap, resolveJsonPath } from '@/draft/forms-filler';
import type { CaseFacts } from '@/ingest/schema';
import type {
  PreviewConflictEntry,
  PreviewFactRow,
  PreviewStructuralOutlineItem,
} from '@/lib/preview-store';

interface FormsPreviewBody {
  facts_used: PreviewFactRow[];
  defensive_paragraphs_required: string[];
  authorities_to_cite: string[];
  conflicts_to_flag_in_output: PreviewConflictEntry[];
  structural_outline: PreviewStructuralOutlineItem[];
  estimated_output_length_tokens: number;
  estimated_cost_usd: number;
}

export async function buildFormsPreview(
  caseFacts: CaseFacts,
  formId: string,
): Promise<FormsPreviewBody> {
  let fieldMap: Record<string, string>;
  try {
    fieldMap = await loadFieldMap(formId);
  } catch (e) {
    return {
      facts_used: [],
      defensive_paragraphs_required: [],
      authorities_to_cite: [],
      conflicts_to_flag_in_output: [
        {
          description: `Field map for ${formId} could not be loaded: ${
            e instanceof Error ? e.message : String(e)
          }`,
          conflict_type: 'forms_field_map_missing',
          severity: 4,
          fact_a_doc: null,
          fact_b_doc: null,
        },
      ],
      structural_outline: [],
      estimated_output_length_tokens: 0,
      estimated_cost_usd: 0,
    };
  }

  const data = { facts: caseFacts.facts, context: {} };
  const facts_used: PreviewFactRow[] = [];
  const unfilled: string[] = [];

  for (const [acroFieldName, jsonPath] of Object.entries(fieldMap)) {
    const value = resolveJsonPath(data, jsonPath);
    facts_used.push({
      field_path: `forms.${formId}.${acroFieldName}`,
      value: value ?? null,
      source_doc: null,
      source_page: null,
      source_quote: jsonPath,
      confidence: value ? 1 : null,
    });
    if (value === undefined || value === null || value === '') {
      unfilled.push(acroFieldName);
    }
  }

  const outline: PreviewStructuralOutlineItem[] = [
    {
      roman: 'I',
      heading: `${formId.toUpperCase()} mechanical fill`,
      one_line_summary: `${facts_used.length - unfilled.length} of ${facts_used.length} fields will populate; ${unfilled.length} unfilled.`,
    },
  ];

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
