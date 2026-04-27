import type { E2Facts } from '@/ingest';

interface FieldLeaf<T> {
  value: T | null;
  source_page: number | null;
  source_quote: string | null;
  confidence: number | null;
}
const v = <T,>(f: unknown): T | null => {
  if (!f || typeof f !== 'object' || !('value' in (f as object))) return null;
  return ((f as FieldLeaf<T>).value ?? null) as T | null;
};

const SEV_LABEL: Record<number, { tag: string; tone: string; ring: string }> = {
  5: { tag: 'DISPOSITIVE', tone: 'text-paper bg-rubric',          ring: 'border-rubric' },
  4: { tag: 'MATERIAL',    tone: 'text-rubric bg-paper',           ring: 'border-rubric' },
  3: { tag: 'MINOR',       tone: 'text-ochre bg-paper',            ring: 'border-ochre/50' },
  2: { tag: 'CLERICAL',    tone: 'text-graphite bg-paper',         ring: 'border-rule-strong' },
  1: { tag: 'COSMETIC',    tone: 'text-graphite-soft bg-paper',    ring: 'border-rule' },
};

interface Props {
  conflicts: E2Facts['conflict_register'];
}

export function ConflictRegister({ conflicts }: Props) {
  const sorted = [...conflicts].sort((a, b) => {
    const sa = v<number>(a.severity) ?? 0;
    const sb = v<number>(b.severity) ?? 0;
    return sb - sa;
  });

  if (sorted.length === 0) {
    return (
      <p className="font-display italic text-[0.95rem] text-graphite px-1">
        No conflicts on register. Re-run the reviewer after every fact edit to refresh.
      </p>
    );
  }

  const counts = sorted.reduce<Record<number, number>>((acc, c) => {
    const s = v<number>(c.severity) ?? 0;
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <span className="smcp text-[0.62rem] text-graphite tracking-[0.2em]">
          severity rollup
        </span>
        {[5, 4, 3, 2, 1].map((s) => {
          const n = counts[s] ?? 0;
          const meta = SEV_LABEL[s];
          return (
            <span
              key={s}
              className={
                'inline-flex items-baseline gap-1.5 border px-2 py-0.5 text-[0.66rem] smcp tracking-widest ' +
                meta.ring +
                ' ' +
                (n === 0 ? 'opacity-40' : '')
              }
            >
              <span className={meta.tone.split(' ')[0]}>{meta.tag.toLowerCase()}</span>
              <span className="font-mono tabular-nums text-ink">{n}</span>
            </span>
          );
        })}
      </div>

      <ol className="grid gap-3">
        {sorted.map((c, i) => {
          const sev = v<number>(c.severity) ?? 0;
          const meta = SEV_LABEL[sev] ?? SEV_LABEL[1];
          return (
            <li
              key={i}
              className={'border border-l-[3px] border-rule pl-4 pr-3 py-3 paper-recess ' + meta.ring}
            >
              <div className="flex items-baseline gap-3 mb-1.5">
                <span
                  className={
                    'px-2 py-[1px] text-[0.6rem] smcp tracking-[0.18em] ' + meta.tone
                  }
                >
                  {meta.tag}
                </span>
                <span className="font-mono text-[0.7rem] text-graphite tracking-widest">
                  {v<string>(c.conflict_type) ?? 'unspecified'}
                </span>
              </div>
              <p className="font-display text-[0.98rem] leading-snug text-ink mb-2">
                {v<string>(c.description) ?? '—'}
              </p>
              <dl className="grid grid-cols-2 gap-x-6 text-[0.78rem] border-t border-rule pt-2">
                <div className="flex items-baseline gap-2">
                  <dt className="smcp text-[0.6rem] text-graphite-soft tracking-widest">
                    A
                  </dt>
                  <dd className="text-ink-2 font-mono text-[0.78rem]">
                    {v<string>(c.fact_a_doc) ?? '—'}
                    {c.fact_a_page.value !== null && (
                      <span className="text-graphite-soft">
                        {' '}
                        · p.{c.fact_a_page.value}
                      </span>
                    )}
                  </dd>
                </div>
                <div className="flex items-baseline gap-2">
                  <dt className="smcp text-[0.6rem] text-graphite-soft tracking-widest">
                    B
                  </dt>
                  <dd className="text-ink-2 font-mono text-[0.78rem]">
                    {v<string>(c.fact_b_doc) ?? '—'}
                    {c.fact_b_page.value !== null && (
                      <span className="text-graphite-soft">
                        {' '}
                        · p.{c.fact_b_page.value}
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
