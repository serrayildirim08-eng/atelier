/**
 * The full EB-1A criterion gates view for a matter. Top bar carries the
 * Step-1 Kazarian indicator (X / 3 currently met). The eight intake
 * criteria render unconditionally; Display + Commercial Success render
 * only when the matter's profile triggers them.
 *
 * Step-1 "currently met" rule (UI-tier, NOT the legal merits test):
 *   a criterion counts toward the indicator when it has at least ONE
 *   classified document on file. This is intentionally lenient — Step 1
 *   is a *count*, not a quality gauge. Final-merits review (Step 2) is
 *   the attorney's call and lives elsewhere.
 *
 * Design notes:
 *   - No tabs inside; sections are vertical, generous whitespace.
 *   - The indicator bar uses ink hairline ticks. No progress chrome.
 *   - Empty profile-triggered criteria render NOTHING (not an empty
 *     state) — they shouldn't exist in the binder if the candidate's
 *     field doesn't cover them.
 */

import { CriterionSection } from './criterion-section';
import {
  EB1A_CRITERIA,
  KAZARIAN_THRESHOLD,
  type CriterionId,
} from './criteria-meta';
import {
  bucketDocsByCriterion,
  type EB1AClassifiedPayload,
} from '@/app/api/matter/[id]/mock-eb1a-criteria';

interface EB1ACriteriaGatesProps {
  payload: EB1AClassifiedPayload;
}

export function EB1ACriteriaGates({ payload }: EB1ACriteriaGatesProps) {
  const buckets = bucketDocsByCriterion(payload.docs);

  // Resolve the active criterion list (8 + 0/1/2 triggered).
  const active = EB1A_CRITERIA.filter((c) => {
    if (!c.profileTriggered) return true;
    if (c.id === 'display') return payload.profile.triggers_display;
    if (c.id === 'commercial_success')
      return payload.profile.triggers_commercial_success;
    return false;
  });

  // Step-1 count: criteria with ≥1 classified doc.
  const metIds: CriterionId[] = active
    .filter((c) => (buckets.get(c.id)?.length ?? 0) > 0)
    .map((c) => c.id);

  const totalActive = active.length;
  const totalDocs = payload.docs.length;

  return (
    <div className="grid gap-12">
      <KazarianIndicator
        met={metIds.length}
        threshold={KAZARIAN_THRESHOLD}
        total={totalActive}
        totalDocs={totalDocs}
        metIds={metIds}
        active={active.map((c) => ({ id: c.id, label: c.label, order: c.order }))}
      />

      <div className="grid gap-12">
        {active.map((c) => {
          const docs = buckets.get(c.id) ?? [];
          const reason =
            c.id === 'display'
              ? payload.profile.display_trigger_reason
              : c.id === 'commercial_success'
                ? payload.profile.commercial_success_trigger_reason
                : undefined;
          return (
            <CriterionSection
              key={c.id}
              meta={c}
              docs={docs}
              activatedReason={reason}
            />
          );
        })}
      </div>
    </div>
  );
}

interface KazarianIndicatorProps {
  met: number;
  threshold: number;
  total: number;
  totalDocs: number;
  metIds: CriterionId[];
  active: Array<{ id: CriterionId; label: string; order: number }>;
}

function KazarianIndicator({
  met,
  threshold,
  total,
  totalDocs,
  metIds,
  active,
}: KazarianIndicatorProps) {
  const reaches = met >= threshold;
  const metSet = new Set(metIds);

  return (
    <section className="border border-ink-2 bg-paper px-7 py-7 grid gap-6" aria-label="Step-1 Kazarian indicator">
      <header className="grid grid-cols-[1fr_auto] gap-4 items-baseline">
        <div>
          <div className="smcp text-graphite mb-2">step 1 · kazarian</div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h2
              className="font-mono tabular-nums font-semibold text-ink leading-none"
              style={{ fontSize: '2.6rem' }}
            >
              {met}
              <span className="text-graphite-soft"> / </span>
              <span className="text-graphite">{threshold}</span>
            </h2>
            <span className="text-body text-graphite leading-snug">
              criteria currently met{' '}
              <span className="text-graphite-soft">
                · across {total} active {total === 1 ? 'criterion' : 'criteria'}
              </span>
            </span>
          </div>
          <p className="text-meta text-graphite-soft mt-3 max-w-2xl leading-snug">
            {reaches
              ? 'Step-1 numeric threshold reached. Final-merits review (Step 2) determines whether the totality of evidence shows sustained acclaim.'
              : `Step 1 requires evidence under at least three (h)(3) criteria. ${threshold - met} short.`}
          </p>
        </div>
        <div className="text-right">
          <div className="smcp text-graphite-soft mb-1.5">binder</div>
          <div className="font-mono tabular-nums text-body text-ink-2">
            {totalDocs} {totalDocs === 1 ? 'doc' : 'docs'} classified
          </div>
        </div>
      </header>

      <ul className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-3 border-t border-rule pt-5">
        {active.map((c) => {
          const ok = metSet.has(c.id);
          return (
            <li key={c.id} className="flex items-baseline gap-2.5 min-w-0">
              <span
                aria-hidden
                className={
                  'w-px h-3 shrink-0 ' + (ok ? 'bg-ink' : 'bg-rule-strong')
                }
              />
              <a
                href={`#criterion-${c.id}`}
                className={
                  'text-meta truncate transition-colors ' +
                  (ok
                    ? 'text-ink hover:text-graphite font-semibold'
                    : 'text-graphite-soft hover:text-ink')
                }
              >
                {c.label}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
