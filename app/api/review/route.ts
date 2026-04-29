/**
 * POST /api/review
 *
 * Phase-9 — re-runs the full review (deterministic gates + LLM
 * reviewer) on an already-extracted matter. The DeterministicGatesPanel
 * "Re-run review" button posts the matter's case_facts + draft and
 * receives fresh gate outcomes + a fresh review report so the attorney
 * can iterate without re-ingesting PDFs.
 *
 * Body:  { case_facts: CaseFacts, draft: string }
 * Response: { review: ReviewReport, deterministic_gates: GateRunResult[] }
 *           OR { error: string, code?: string }
 */

import { runFullReview } from '@/reason';
import type { CaseFacts } from '@/ingest/schema';
import { postDraft } from '@/lib/verify';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface RequestBody {
  case_facts?: unknown;
  draft?: unknown;
}

function isCaseFacts(v: unknown): v is CaseFacts {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.case_type === 'string' && o.facts !== undefined;
}

export async function POST(request: Request): Promise<Response> {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isCaseFacts(body.case_facts)) {
    return Response.json({ error: 'Missing or invalid case_facts' }, { status: 400 });
  }
  if (typeof body.draft !== 'string' || body.draft.trim().length === 0) {
    return Response.json({ error: 'Missing draft' }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY is not set' }, { status: 500 });
  }

  try {
    const verifyReport = postDraft(body.draft, body.case_facts.case_type);
    const reviewed = await runFullReview(body.case_facts, body.draft, verifyReport);
    return Response.json({
      review: reviewed.llm.report,
      deterministic_gates: reviewed.deterministic,
    });
  } catch (e: unknown) {
    return Response.json(
      {
        error: 'review_failed',
        code: 'review_failed',
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
