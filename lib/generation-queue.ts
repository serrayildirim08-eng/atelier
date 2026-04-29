/**
 * In-memory generation job queue.
 *
 * Phase 11 — the pre-generation approval modal used to keep itself open
 * during the (slow) `/api/matter/[id]/approve` round-trip, blocking
 * navigation. The queue lifts the post-approve fetch into a background
 * job so the modal can close immediately on submit. Subscribers (a toast
 * chip + the `recentOutput` panel) receive completion + error events.
 *
 * Scope: process-local (no localStorage) — jobs that are in-flight when
 * the user reloads will simply be lost; the attorney can re-run from the
 * matter list. We never want a stale job to be replayed against an
 * Anthropic call that already ran.
 */
import type { PreviewGenerator, PreviewRecord } from '@/lib/preview-store';

export type JobStatus = 'pending' | 'completed' | 'error';

export interface GenerationJob {
  id: string;
  matter_id: string;
  generator: PreviewGenerator;
  status: JobStatus;
  created_at: number;
  completed_at: number | null;
  /** Populated on completion. */
  output_path: string | null;
  output_inline: string | null;
  preview: PreviewRecord | null;
  /** Populated on error. */
  error: string | null;
}

type Listener = (jobs: GenerationJob[]) => void;

export interface GenerationQueue {
  enqueue: (
    matter_id: string,
    generator: PreviewGenerator,
    runner: () => Promise<{
      output_path: string | null;
      output_inline: string | null;
      preview: PreviewRecord;
    }>,
  ) => GenerationJob;
  /** Drop a completed/errored job from the toast (keep pending). */
  dismiss: (id: string) => void;
  /** Read current job list (sorted oldest-first). */
  list: () => GenerationJob[];
  /** Subscribe; returns an unsubscribe fn. */
  subscribe: (l: Listener) => () => void;
}

function makeId(): string {
  // Cheap unique id — no crypto dep, no collisions expected at human scale.
  return `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createGenerationQueue(): GenerationQueue {
  const jobs = new Map<string, GenerationJob>();
  const listeners = new Set<Listener>();

  function snapshot(): GenerationJob[] {
    return Array.from(jobs.values()).sort((a, b) => a.created_at - b.created_at);
  }

  function emit() {
    const s = snapshot();
    for (const l of listeners) l(s);
  }

  function enqueue(
    matter_id: string,
    generator: PreviewGenerator,
    runner: () => Promise<{
      output_path: string | null;
      output_inline: string | null;
      preview: PreviewRecord;
    }>,
  ): GenerationJob {
    const job: GenerationJob = {
      id: makeId(),
      matter_id,
      generator,
      status: 'pending',
      created_at: Date.now(),
      completed_at: null,
      output_path: null,
      output_inline: null,
      preview: null,
      error: null,
    };
    jobs.set(job.id, job);
    emit();

    runner()
      .then((result) => {
        const cur = jobs.get(job.id);
        if (!cur) return;
        cur.status = 'completed';
        cur.completed_at = Date.now();
        cur.output_path = result.output_path;
        cur.output_inline = result.output_inline;
        cur.preview = result.preview;
        emit();
      })
      .catch((e: unknown) => {
        const cur = jobs.get(job.id);
        if (!cur) return;
        cur.status = 'error';
        cur.completed_at = Date.now();
        cur.error = e instanceof Error ? e.message : String(e);
        emit();
      });

    return job;
  }

  return {
    enqueue,
    dismiss(id: string) {
      const cur = jobs.get(id);
      if (!cur) return;
      if (cur.status === 'pending') return;
      jobs.delete(id);
      emit();
    },
    list: snapshot,
    subscribe(l) {
      listeners.add(l);
      l(snapshot());
      return () => {
        listeners.delete(l);
      };
    },
  };
}

/**
 * Process-singleton. The home page's queue lives for the lifetime of the
 * tab; multiple instances would race on duplicate fetches.
 */
export const globalGenerationQueue: GenerationQueue = createGenerationQueue();
