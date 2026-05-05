/**
 * EB-1A criterion gates view. Lists Atelier's 8 (h)(3) intake-order
 * criteria, plus Display + Commercial Success when the candidate's
 * profile triggers them.
 *
 * The classified-doc payload is currently a static mock (see
 * mock-eb1a-criteria.ts). Once backend-senior's Haiku-tier classifier
 * lands, swap `getMockEB1AClassifiedPayload` for the real loader.
 */

import Link from 'next/link';
import { getMockEB1AClassifiedPayload } from '@/app/api/matter/[id]/mock-eb1a-criteria';
import { EB1ACriteriaGates } from '@/app/components/eb1a/eb1a-criteria-gates';

export default async function MatterEB1APage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const payload = getMockEB1AClassifiedPayload(id);

  return (
    <div className="h-screen overflow-y-auto paper-grain">
      <header className="border-b border-rule px-12 h-12 flex items-center justify-between">
        <Link
          href={`/matter/${id}`}
          className="flex items-baseline gap-2 text-meta text-graphite hover:text-ink transition-colors"
        >
          <span className="font-mono">←</span>
          <span className="smcp">return to the matter</span>
        </Link>
        <div className="flex items-baseline gap-3">
          <span className="smcp text-graphite-soft">eb-1a · gates</span>
          <span className="font-mono text-meta text-ink-2">{id}</span>
        </div>
      </header>

      <section className="px-12 pt-14 pb-10">
        <div className="flex items-baseline gap-3 mb-4 flex-wrap">
          <span className="smcp text-graphite-soft">EB-1A</span>
          <span className="text-rule-strong">·</span>
          <span className="smcp text-graphite">8 CFR § 204.5(h)(3)</span>
          <span className="text-rule-strong">·</span>
          <span className="smcp text-graphite">criterion gates</span>
        </div>
        <h1 className="text-display font-bold tracking-[-0.025em] leading-[1.02] text-ink">
          Evidence under each (h)(3) criterion
        </h1>
        <p className="text-lede text-graphite mt-4 max-w-3xl">
          Atelier&rsquo;s intake taxonomy classifies every document under one
          primary criterion. Each section below shows what&rsquo;s on file and,
          where it&rsquo;s bare, the evidence-quality bar the framework demands.
        </p>
      </section>

      <main className="px-12 pb-24 max-w-[1400px]">
        <EB1ACriteriaGates payload={payload} />
      </main>
    </div>
  );
}
