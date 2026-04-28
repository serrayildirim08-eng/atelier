import type { CitationVerifyResult, CitationVerifyStatus } from '@/lib/verify/types';

const STATUS_META: Record<
  CitationVerifyStatus,
  { tag: string; weight: 'heavy' | 'med' | 'light'; blurb: string }
> = {
  on_allowlist: {
    tag: 'OK',
    weight: 'light',
    blurb: 'matches allowlist',
  },
  off_allowlist: {
    tag: 'OFF',
    weight: 'heavy',
    blurb: 'not authorized for this case type',
  },
  aao_route_to_human: {
    tag: 'AAO',
    weight: 'med',
    blurb: 'attorney review (uncheckable)',
  },
  unparseable: {
    tag: 'BAD',
    weight: 'heavy',
    blurb: 'malformed citation',
  },
};

const weightClass = (w: 'heavy' | 'med' | 'light') =>
  w === 'heavy'
    ? 'border-ink text-ink font-semibold'
    : w === 'med'
      ? 'border-rule-strong text-ink-2 font-medium'
      : 'border-rule text-graphite';

interface Props {
  result: CitationVerifyResult;
}

export function AuthorityCiteCheck({ result }: Props) {
  const counters: Array<{ status: CitationVerifyStatus; count: number }> = [
    { status: 'on_allowlist', count: result.on_allowlist },
    { status: 'off_allowlist', count: result.off_allowlist },
    { status: 'aao_route_to_human', count: result.aao_routed },
    { status: 'unparseable', count: result.unparseable },
  ];

  const cleared =
    result.off_allowlist === 0 &&
    result.aao_routed === 0 &&
    result.unparseable === 0;

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-5 flex-wrap">
        <span className="smcp text-graphite mr-2">authority</span>
        <span
          className={
            'inline-flex items-baseline gap-1.5 border rounded-full px-2.5 py-0.5 text-meta ' +
            (cleared
              ? 'border-rule text-graphite'
              : 'border-ink text-ink font-semibold')
          }
        >
          <span>{cleared ? 'cleared' : 'gated'}</span>
          <span className="font-mono tabular-nums">{result.total_citations}</span>
        </span>
        {counters.map(({ status, count }) => {
          const meta = STATUS_META[status];
          return (
            <span
              key={status}
              className={
                'inline-flex items-baseline gap-1.5 border rounded-full px-2.5 py-0.5 text-meta ' +
                weightClass(meta.weight) +
                ' ' +
                (count === 0 ? 'opacity-40' : '')
              }
            >
              <span>{meta.tag.toLowerCase()}</span>
              <span className="font-mono tabular-nums">{count}</span>
            </span>
          );
        })}
      </div>

      {result.findings.length === 0 ? (
        <p className="text-body text-graphite leading-relaxed">
          No citations extracted yet — draft the cover letter first, then re-run the verifier.
        </p>
      ) : (
        <ul className="border-t border-rule">
          {result.findings.map((finding, i) => {
            const meta = STATUS_META[finding.status];
            return (
              <li
                key={i}
                className="grid grid-cols-[4.5rem_1fr_auto] gap-x-4 items-baseline border-b border-rule last:border-b-0 py-3"
              >
                <span
                  className={
                    'smcp ' +
                    (meta.weight === 'heavy'
                      ? 'text-ink font-semibold'
                      : meta.weight === 'med'
                        ? 'text-ink-2'
                        : 'text-graphite')
                  }
                  title={meta.blurb}
                >
                  {meta.tag}
                </span>
                <div className="min-w-0">
                  <div className="font-mono text-body text-ink truncate">
                    {finding.citation.normalized || finding.citation.raw}
                  </div>
                  <div className="text-meta text-graphite-soft mt-0.5 truncate">
                    {finding.message}
                  </div>
                </div>
                <span className="font-mono text-meta text-graphite-soft">
                  {finding.citation.kind}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
