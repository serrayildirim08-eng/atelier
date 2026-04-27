/**
 * POST /api/matter/[id]/approve
 *
 * Step 2 of the two-step approval flow. The attorney either:
 *   - approves (with optional fact edits) → executor runs the
 *     real generator against the edited facts; preview status flips
 *     to 'approved' with attorney_initials + executed_at + output_path.
 *   - rejects → preview status flips to 'rejected'; no generator
 *     runs; rejection_reason is recorded if provided.
 *
 * Either way an audit-log line is appended to
 * db/audit/preview-approvals.jsonl by lib/preview-store.
 *
 * Body: { preview_id, approved, attorney_initials, edits?, rejection_reason? }
 */

import { executeApprovedPreview } from '@/lib/preview-builders/execute';
import {
  readPreview,
  recordApproval,
  recordRejection,
  type PreviewEdit,
} from '@/lib/preview-store';
import type { CaseFacts } from '@/ingest/schema';
import type { TypedMemory } from '@/ingest/typed-memory';
import { getMockMatter, getMockTypedMemory } from '../mock-data';

export const runtime = 'nodejs';
export const maxDuration = 600;

interface ApprovalBody {
  preview_id?: unknown;
  approved?: unknown;
  attorney_initials?: unknown;
  edits?: unknown;
  rejection_reason?: unknown;
  /** Live caseFacts from the home page; overrides mock when present. */
  case_facts?: unknown;
  /** Live typed memory from the home page; overrides mock when present. */
  typed_memory?: unknown;
}

function isCaseFacts(v: unknown): v is CaseFacts {
  if (!v || typeof v !== 'object') return false;
  const obj = v as Record<string, unknown>;
  return typeof obj.case_type === 'string' && obj.facts !== undefined;
}

function isTypedMemory(v: unknown): v is TypedMemory {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function parseEdits(input: unknown): PreviewEdit[] {
  if (!Array.isArray(input)) return [];
  const out: PreviewEdit[] = [];
  for (const e of input) {
    if (
      e &&
      typeof e === 'object' &&
      'field_path' in e &&
      typeof (e as { field_path: unknown }).field_path === 'string' &&
      'new_value' in e
    ) {
      out.push({
        field_path: (e as { field_path: string }).field_path,
        new_value: (e as { new_value: unknown }).new_value,
      });
    }
  }
  return out;
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;

  let body: ApprovalBody;
  try {
    body = (await request.json()) as ApprovalBody;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.preview_id !== 'string' || body.preview_id.length === 0) {
    return Response.json({ error: 'Missing preview_id' }, { status: 400 });
  }
  if (typeof body.attorney_initials !== 'string' || body.attorney_initials.length === 0) {
    return Response.json({ error: 'Missing attorney_initials' }, { status: 400 });
  }
  if (typeof body.approved !== 'boolean') {
    return Response.json({ error: 'Missing approved (boolean)' }, { status: 400 });
  }

  const previewId = body.preview_id;
  const initials = body.attorney_initials;

  const record = await readPreview(id, previewId);
  if (!record) {
    return Response.json({ error: 'Preview not found' }, { status: 404 });
  }
  if (record.status !== 'pending') {
    return Response.json(
      { error: `Preview already ${record.status}`, preview: record },
      { status: 409 },
    );
  }

  // Rejection path: stamp + audit, no generator call.
  if (body.approved === false) {
    const updated = await recordRejection(id, previewId, {
      attorney_initials: initials,
      rejection_reason:
        typeof body.rejection_reason === 'string' ? body.rejection_reason : null,
    });
    return Response.json({ rejected: true, preview: updated });
  }

  // Approval path: execute generator, then stamp. Prefer caller-supplied
  // facts (the live home-page matter); fall back to mock for the demo.
  const caseFacts: CaseFacts = isCaseFacts(body.case_facts)
    ? body.case_facts
    : getMockMatter(id).caseFacts;
  const memory: TypedMemory = isTypedMemory(body.typed_memory)
    ? body.typed_memory
    : getMockTypedMemory(id);
  const edits = parseEdits(body.edits);

  let executeResult;
  try {
    executeResult = await executeApprovedPreview(
      record,
      caseFacts,
      memory,
      edits,
    );
  } catch (e: unknown) {
    return Response.json(
      {
        error: 'Generator execution failed',
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }

  const updated = await recordApproval(id, previewId, {
    attorney_initials: initials,
    edits,
    output_path: executeResult.output_path,
  });

  return Response.json({
    approved: true,
    output_path: executeResult.output_path,
    output_inline: executeResult.output_inline,
    usage: executeResult.usage,
    preview: updated,
  });
}
