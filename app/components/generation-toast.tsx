'use client';

/**
 * Phase 11 — fixed-position chip in the bottom-right corner showing the
 * status of every background generation job. Pending jobs animate; the
 * attorney can dismiss completed/errored jobs with the × button. The
 * approval modal closes immediately on submit and the work continues
 * here without blocking navigation.
 */

import { useEffect, useState } from 'react';
import {
  globalGenerationQueue,
  type GenerationJob,
} from '@/lib/generation-queue';

export function GenerationToastStack() {
  const [jobs, setJobs] = useState<GenerationJob[]>(() => globalGenerationQueue.list());

  useEffect(() => {
    return globalGenerationQueue.subscribe(setJobs);
  }, []);

  if (jobs.length === 0) return null;

  return (
    <div className="fixed bottom-12 left-6 z-30 grid gap-2 max-w-[22rem]">
      {jobs.map((j) => (
        <GenerationChip
          key={j.id}
          job={j}
          onDismiss={() => globalGenerationQueue.dismiss(j.id)}
        />
      ))}
    </div>
  );
}

function GenerationChip({
  job,
  onDismiss,
}: {
  job: GenerationJob;
  onDismiss: () => void;
}) {
  const generatorLabel = job.generator.replace(/_/g, ' ');
  if (job.status === 'pending') {
    return (
      <div
        className="border border-rule-strong bg-paper px-4 py-2.5 paper-recess flex items-center gap-3 shadow-md"
        role="status"
        aria-live="polite"
      >
        <span className="pulse-dot-bg" aria-hidden />
        <div className="grid">
          <span className="font-mono text-[0.65rem] smcp text-graphite-soft tracking-wider">
            generating · background
          </span>
          <span className="text-meta text-ink leading-tight">
            {generatorLabel} · {job.matter_id}
          </span>
        </div>
      </div>
    );
  }
  if (job.status === 'completed') {
    return (
      <div className="border border-rule-strong bg-paper px-4 py-2.5 flex items-start gap-3 shadow-md">
        <div className="grid flex-1">
          <span className="font-mono text-[0.65rem] smcp text-graphite-soft tracking-wider">
            generated
          </span>
          <span className="text-meta text-ink leading-tight">
            {generatorLabel} · {job.matter_id}
          </span>
          {job.output_path && (
            <span className="font-mono text-[0.65rem] text-graphite truncate mt-0.5">
              → {job.output_path}
            </span>
          )}
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="smcp text-meta text-graphite hover:text-ink shrink-0"
        >
          ✕
        </button>
      </div>
    );
  }
  // error
  return (
    <div className="border border-ink bg-paper px-4 py-2.5 flex items-start gap-3 shadow-md">
      <div className="grid flex-1">
        <span className="font-mono text-[0.65rem] smcp text-ink tracking-wider">
          generation failed
        </span>
        <span className="text-meta text-ink leading-tight">
          {generatorLabel} · {job.matter_id}
        </span>
        {job.error && (
          <span className="font-mono text-[0.65rem] text-graphite mt-0.5 break-words">
            {job.error}
          </span>
        )}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss error notification"
        className="smcp text-meta text-graphite hover:text-ink shrink-0"
      >
        ✕
      </button>
    </div>
  );
}
