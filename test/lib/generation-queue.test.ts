/**
 * Phase 11 — generation queue tests.
 *
 * Pinned behavior:
 *   - enqueue() returns a job in 'pending' immediately
 *   - subscribers fire on enqueue, completion, and dismiss
 *   - completed runners produce status='completed' + output_path
 *   - thrown runners produce status='error' + error message
 *   - dismiss() removes completed/errored jobs but is a no-op for pending
 *   - multiple parallel jobs do not stomp on each other's state
 */

import { describe, expect, it } from 'vitest';
import { createGenerationQueue } from '@/lib/generation-queue';
import type { PreviewRecord } from '@/lib/preview-store';

function fakePreview(id = 'p-1'): PreviewRecord {
  return {
    preview_id: id,
    generator: 'cover_letter',
    matter_id: 'M-001',
    facts_used: [],
    defensive_paragraphs_required: [],
    authorities_to_cite: [],
    conflicts_to_flag_in_output: [],
    structural_outline: [],
    estimated_output_length_tokens: 0,
    estimated_cost_usd: 0,
    args: null,
    created_at: new Date().toISOString(),
    status: 'approved',
    attorney_initials: 'SY',
    approved_at: new Date().toISOString(),
    rejected_at: null,
    rejection_reason: null,
    executed_at: new Date().toISOString(),
    output_path: null,
    edits: [],
  };
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('createGenerationQueue', () => {
  it('returns a pending job synchronously and notifies subscribers', async () => {
    const q = createGenerationQueue();
    const events: number[] = [];
    q.subscribe((jobs) => events.push(jobs.length));

    let resolve!: (v: { output_path: string | null; output_inline: string | null; preview: PreviewRecord }) => void;
    const job = q.enqueue('M-001', 'cover_letter', () =>
      new Promise((res) => {
        resolve = res;
      }),
    );

    expect(job.status).toBe('pending');
    expect(events).toEqual([0, 1]); // initial snapshot + after enqueue

    resolve({ output_path: '/tmp/out.docx', output_inline: 'hi', preview: fakePreview() });
    await flush();

    const final = q.list();
    expect(final).toHaveLength(1);
    expect(final[0].status).toBe('completed');
    expect(final[0].output_path).toBe('/tmp/out.docx');
    expect(final[0].output_inline).toBe('hi');
  });

  it('captures errors thrown by the runner without crashing the queue', async () => {
    const q = createGenerationQueue();
    q.enqueue('M-002', 'forms_i129', async () => {
      throw new Error('boom');
    });
    await flush();
    const list = q.list();
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe('error');
    expect(list[0].error).toBe('boom');
  });

  it('keeps pending jobs immune to dismiss(); allows dismiss after completion', async () => {
    const q = createGenerationQueue();
    let resolveRunner!: () => void;
    const job = q.enqueue('M-003', 'cover_letter', () =>
      new Promise<{ output_path: string | null; output_inline: string | null; preview: PreviewRecord }>((res) => {
        resolveRunner = () =>
          res({ output_path: null, output_inline: null, preview: fakePreview() });
      }),
    );

    // Pending — dismiss is a no-op.
    q.dismiss(job.id);
    expect(q.list()).toHaveLength(1);

    resolveRunner();
    await flush();
    expect(q.list()[0].status).toBe('completed');

    q.dismiss(job.id);
    expect(q.list()).toHaveLength(0);
  });

  it('runs multiple jobs in parallel without cross-contamination', async () => {
    const q = createGenerationQueue();
    const resolvers: Array<() => void> = [];
    for (let i = 0; i < 3; i++) {
      q.enqueue('M-' + i, 'forms_g28', () =>
        new Promise<{ output_path: string | null; output_inline: string | null; preview: PreviewRecord }>(
          (res) => {
            resolvers.push(() =>
              res({
                output_path: `/out/${i}.docx`,
                output_inline: null,
                preview: fakePreview(`p-${i}`),
              }),
            );
          },
        ),
      );
    }
    expect(q.list().every((j) => j.status === 'pending')).toBe(true);

    // Resolve out of order — list should still match by job id, not order.
    resolvers[2]();
    await flush();
    expect(q.list()[2].status).toBe('completed');
    expect(q.list()[0].status).toBe('pending');

    resolvers[0]();
    resolvers[1]();
    await flush();
    expect(q.list().every((j) => j.status === 'completed')).toBe(true);
  });

  it('subscribe returns an unsubscribe fn that stops further notifications', async () => {
    const q = createGenerationQueue();
    let count = 0;
    const unsub = q.subscribe(() => {
      count += 1;
    });
    expect(count).toBe(1); // initial snapshot
    q.enqueue('M-9', 'cover_letter', async () => ({
      output_path: null,
      output_inline: null,
      preview: fakePreview(),
    }));
    await flush();
    const beforeUnsub = count;
    unsub();
    q.enqueue('M-10', 'cover_letter', async () => ({
      output_path: null,
      output_inline: null,
      preview: fakePreview(),
    }));
    await flush();
    expect(count).toBe(beforeUnsub); // no further notifications
  });
});
