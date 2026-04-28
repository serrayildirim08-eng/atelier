'use client';

/**
 * GeneratePanel — the only legitimate UI entry point to a generator.
 *
 * Every "Generate" action on the matter dashboard MUST go through this
 * panel, which routes through PreGenerationApprovalModal. No code path
 * should call draftCoverLetter / draftDeclaration / fillForm /
 * buildExhibitList directly from a button handler.
 *
 * The modal handles its own preview-fetch + approve-or-reject lifecycle;
 * this component just opens it with the selected generator and renders
 * the most recent output (path or inline text) underneath.
 */

import { useState } from 'react';
import {
  PreGenerationApprovalModal,
  type ApprovalResult,
} from './pre-generation-approval';
import type { PreviewGenerator } from '@/lib/preview-store';

async function downloadAsDocx(content: string, filename: string): Promise<void> {
  const res = await fetch('/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, filename }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    alert(`Export failed: ${data.error ?? res.statusText}`);
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadAsMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface GenerateButtonGroupItem {
  generator: PreviewGenerator;
  label: string;
  description: string;
}

const COVER_AND_LIST: GenerateButtonGroupItem[] = [
  {
    generator: 'cover_letter',
    label: 'Cover letter',
    description: 'Sonnet 4.6 / Opus 4.7 by case_type · ~16K tokens · ~$0.30',
  },
  {
    generator: 'exhibit_list',
    label: 'Exhibit list',
    description: 'Mechanical · A–L tab convention · $0',
  },
  {
    generator: 'business_plan',
    label: 'Business plan (E-2)',
    description: '5-year P&L · Sonnet 4.6 + adaptive thinking · ~16K tokens · ~$0.30',
  },
];

const DECLARATIONS: GenerateButtonGroupItem[] = [
  {
    generator: 'declaration_beneficiary',
    label: 'Declaration · Beneficiary',
    description: 'Investor’s own under-penalty-of-perjury declaration',
  },
  {
    generator: 'declaration_spouse',
    label: 'Declaration · Spouse',
    description: 'Dependent spouse declaration (E-2D)',
  },
  {
    generator: 'declaration_enterprise_rep',
    label: 'Declaration · Enterprise rep',
    description: 'Petitioner officer’s declaration',
  },
];

const FORMS: GenerateButtonGroupItem[] = [
  { generator: 'forms_i129', label: 'I-129', description: 'Petition for a Nonimmigrant Worker' },
  { generator: 'forms_i129e', label: 'I-129E', description: 'E-1/E-2 Classification Supplement' },
  { generator: 'forms_g28', label: 'G-28', description: 'Notice of Entry of Appearance' },
  { generator: 'forms_i539', label: 'I-539', description: 'Application to Extend / Change Status (spouse)' },
  { generator: 'forms_i539a', label: 'I-539A', description: 'Supplemental Information for Application I-539 (child)' },
];

const NOIDS: GenerateButtonGroupItem[] = [
  {
    generator: 'noid_principal',
    label: 'NoID · Principal',
    description: 'Notice of Intent to Depart — principal beneficiary',
  },
  {
    generator: 'noid_dependent',
    label: 'NoID · Dependent',
    description: 'Notice of Intent to Depart — accompanying spouse / minor',
  },
];

interface OutputRow {
  generator: PreviewGenerator;
  output_path: string | null;
  output_inline: string | null;
  approved_at: string;
}

export function GeneratePanel({ matterId }: { matterId: string }) {
  const [openGenerator, setOpenGenerator] = useState<PreviewGenerator | null>(null);
  const [outputs, setOutputs] = useState<OutputRow[]>([]);

  function onApproved(generator: PreviewGenerator, result: ApprovalResult) {
    setOutputs((prev) => [
      {
        generator,
        output_path: result.output_path,
        output_inline: result.output_inline,
        approved_at: result.preview.approved_at ?? new Date().toISOString(),
      },
      ...prev,
    ]);
  }

  return (
    <div className="grid gap-6">
      <Group title="Cover letter and exhibit index" items={COVER_AND_LIST} onPick={setOpenGenerator} />
      <Group title="Declarations" items={DECLARATIONS} onPick={setOpenGenerator} />
      <Group title="USCIS / DOS forms" items={FORMS} onPick={setOpenGenerator} />
      <Group title="Notices of Intent to Depart" items={NOIDS} onPick={setOpenGenerator} />

      {outputs.length > 0 && (
        <article className="border border-rule bg-paper">
          <header className="flex items-baseline justify-between px-5 py-3 border-b border-rule paper-recess">
            <span className="smcp text-graphite">Recent outputs</span>
            <span className="font-mono text-label text-graphite-soft tabular-nums">{outputs.length}</span>
          </header>
          <ul className="px-5 py-5 grid gap-3">
            {outputs.map((o, i) => (
              <li key={`${o.generator}-${i}`} className="border border-rule px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-body text-ink">{o.generator.replace(/_/g, ' ')}</span>
                  <span className="font-mono text-meta text-graphite-soft">
                    {new Date(o.approved_at).toLocaleString()}
                  </span>
                </div>
                {o.output_path && (
                  <div className="font-mono text-meta text-graphite mt-1 break-all">
                    → {o.output_path}
                  </div>
                )}
                {o.output_inline && (
                  <>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() =>
                          downloadAsDocx(o.output_inline ?? '', `${o.generator}.docx`)
                        }
                        className="px-3 py-1.5 border border-ink smcp text-meta hover:bg-ink hover:text-paper transition-colors"
                      >
                        download .docx
                      </button>
                      <button
                        onClick={() =>
                          downloadAsMarkdown(o.output_inline ?? '', `${o.generator}.md`)
                        }
                        className="px-3 py-1.5 border border-rule smcp text-meta text-graphite hover:border-ink hover:text-ink transition-colors"
                      >
                        download .md
                      </button>
                    </div>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-meta text-graphite hover:text-ink">
                        ▸ view inline ({o.output_inline.length.toLocaleString()} chars)
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap text-meta bg-paper-deep/30 p-3 max-h-96 overflow-y-auto leading-relaxed">
                        {o.output_inline}
                      </pre>
                    </details>
                  </>
                )}
              </li>
            ))}
          </ul>
        </article>
      )}

      <PreGenerationApprovalModal
        open={openGenerator !== null}
        matterId={matterId}
        generator={openGenerator ?? 'cover_letter'}
        onClose={() => setOpenGenerator(null)}
        onApproved={(result) => {
          if (openGenerator) onApproved(openGenerator, result);
        }}
      />
    </div>
  );
}

function Group(props: {
  title: string;
  items: GenerateButtonGroupItem[];
  onPick: (g: PreviewGenerator) => void;
}) {
  return (
    <article className="border border-rule bg-paper">
      <header className="flex items-baseline justify-between px-5 py-3 border-b border-rule paper-recess">
        <span className="smcp text-graphite">{props.title}</span>
        <span className="font-mono text-label text-graphite-soft tabular-nums">{props.items.length}</span>
      </header>
      <div className="px-5 py-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {props.items.map((item) => (
          <button
            key={item.generator}
            onClick={() => props.onPick(item.generator)}
            className="text-left border border-rule bg-paper px-4 py-4 hover:border-ink transition-colors group"
          >
            <div className="text-title font-semibold text-ink leading-tight">{item.label}</div>
            <div className="text-meta text-graphite-soft mt-2 leading-snug">
              {item.description}
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="smcp text-graphite-soft group-hover:text-ink transition-colors">
                approve & generate
              </span>
              <span className="font-mono text-meta text-graphite-soft group-hover:text-ink transition-colors">
                →
              </span>
            </div>
          </button>
        ))}
      </div>
    </article>
  );
}
