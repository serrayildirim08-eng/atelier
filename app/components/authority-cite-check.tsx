import type { CitationVerifyResult, CitationVerifyStatus } from '@/lib/verify/types';

const STATUS_META: Record<
  CitationVerifyStatus,
  { tag: string; tone: string; ring: string; blurb: string }
> = {
  on_allowlist: {
    tag: 'OK',
    tone: 'text-verdant',
    ring: 'border-verdant/40',
    blurb: 'matches allowlist',
  },
  off_allowlist: {
    tag: 'OFF',
    tone: 'text-rubric',
    ring: 'border-rubric',
    blurb: 'not authorized for this case type',
  },
  aao_route_to_human: {
    tag: 'AAO',
    tone: 'text-ochre',
    ring: 'border-ochre/60',
    blurb: 'attorney review (uncheckable)',
  },
  unparseable: {
    tag: 'BAD',
    tone: 'text-rubric',
    ring: 'border-rubric/60',
    blurb: 'malformed citation',
  },
};

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
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <span className="smcp text-[0.62rem] text-graphite tracking-[0.2em]">
          authority status
        </span>
        <span
          className={
            'inline-flex items-baseline gap-2 border px-2.5 py-0.5 text-[0.66rem] smcp tracking-widest ' +
            (cleared ? 'border-verdant/50 text-verdant' : 'border-rubric text-rubric')
          }
        >
          <span>{cleared ? 'cleared' : 'gated'}</span>
          <span className="font-mono tabular-nums text-ink">
            {result.total_citations}
          </span>
        </span>
        {counters.map(({ status, count }) => {
          const meta = STATUS_META[status];
          return (
            <span
              key={status}
              className={
                'inline-flex items-baseline gap-1.5 border px-2 py-0.5 text-[0.66rem] smcp tracking-widest ' +
                meta.ring +
                ' ' +
                (count === 0 ? 'opacity-40' : '')
              }
            >
              <span className={meta.tone}>{meta.tag.toLowerCase()}</span>
              <span className="font-mono tabular-nums text-ink">{count}</span>
            </span>
          );
        })}
      </div>

      {result.findings.length === 0 ? (
        <p className="font-display italic text-[0.95rem] text-graphite px-1">
          No citations extracted yet — draft the cover letter first, then re-run the verifier.
        </p>
      ) : (
        <ul className="border-t border-rule">
          {result.findings.map((finding, i) => {
            const meta = STATUS_META[finding.status];
            return (
              <li
                key={i}
                className="grid grid-cols-[5rem_1fr_auto] gap-x-4 items-baseline border-b border-rule py-2.5"
              >
                <span
                  className={
                    'smcp text-[0.62rem] tracking-[0.18em] ' + meta.tone
                  }
                  title={meta.blurb}
                >
                  {meta.tag}
                </span>
                <div className="min-w-0">
                  <div className="font-mono text-[0.82rem] text-ink truncate">
                    {finding.citation.normalized || finding.citation.raw}
                  </div>
                  <div className="text-[0.74rem] text-graphite italic font-display truncate">
                    {finding.message}
                  </div>
                </div>
                <span className="font-mono text-[0.66rem] text-graphite-soft tracking-wider">
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
