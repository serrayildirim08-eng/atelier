/**
 * /api/matter/[id]/forms
 *
 *   POST → trigger fill of the standard E-2 forms (I-129, I-129E, G-28).
 *          If `has_dependents` is true on the matter, also fills I-539
 *          and one I-539A per dependent. Returns FillFormReport[].
 *
 *   GET  → list filled-form PDFs already on disk for this matter, with
 *          file size + generated_at for the dashboard's punch-list view.
 *
 * The drafter and reviewer are LLM-driven; this route is mechanical.
 * Failures are reported per field, never thrown — the dashboard should
 * surface the unfilled / errors lists for attorney review before the
 * PDF leaves the office.
 */

import {
  fillForm,
  listGeneratedForms,
  type FillFormReport,
} from '@/draft/forms-filler';
import { getMockMatter } from '../mock-data';

export const runtime = 'nodejs';
export const maxDuration = 120;

const E2_BASE_FORMS = ['i-129', 'i-129e', 'g-28'] as const;
const E2_DEPENDENT_FORMS = ['i-539', 'i-539a'] as const;

interface MatterForFormFill {
  case_type: 'E2';
  facts: unknown;
  has_dependents?: boolean;
}

function loadMatterForFormFill(id: string): MatterForFormFill {
  const matter = getMockMatter(id);
  const has_dependents = Boolean(
    matter.e2_subtype && matter.e2_subtype.has_dependents,
  );
  return {
    case_type: 'E2',
    facts: matter.caseFacts.facts,
    has_dependents,
  };
}

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const matter = loadMatterForFormFill(id);

  const formIds: string[] = [...E2_BASE_FORMS];
  if (matter.has_dependents) formIds.push(...E2_DEPENDENT_FORMS);

  const data = { facts: matter.facts, context: {} };
  const reports: FillFormReport[] = [];
  const failures: { form_id: string; message: string }[] = [];

  for (const formId of formIds) {
    try {
      const report = await fillForm({ formId, matterId: id, data });
      reports.push(report);
    } catch (e: unknown) {
      // Infrastructure failure (missing blank PDF, missing field map)
      // — non-fatal at the route level so the dashboard can surface
      // the others.
      failures.push({
        form_id: formId,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return Response.json({
    matter_id: id,
    has_dependents: matter.has_dependents ?? false,
    forms_attempted: formIds,
    reports,
    failures,
  });
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const summaries = await listGeneratedForms(id);
  return Response.json({ matter_id: id, forms: summaries });
}
