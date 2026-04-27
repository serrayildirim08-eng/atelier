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
    <section className="border border-rule paper-recess">
      <header className="px-7 py-3 flex items-baseline justify-between border-b border-rule-strong">
        <div className="flex items-baseline gap-3">
          <span className="smcp text-[0.66rem] text-rubric tracking-[0.22em]">
            ⁂  generate (with attorney approval)
          </span>
          <span className="display-italic text-[0.95rem] text-graphite">
            every output ships only after sign-off
          </span>
        </div>
      </header>

      <div className="px-7 py-5 grid gap-5">
        <Group title="Cover letter and exhibit index" items={COVER_AND_LIST} onPick={setOpenGenerator} />
        <Group title="Declarations" items={DECLARATIONS} onPick={setOpenGenerator} />
        <Group title="USCIS / DOS forms" items={FORMS} onPick={setOpenGenerator} />
        <Group title="Notices of Intent to Depart" items={NOIDS} onPick={setOpenGenerator} />

        {outputs.length > 0 && (
          <div>
            <div className="smcp text-[0.65rem] text-graphite mb-3">¶ recent outputs</div>
            <ul className="space-y-2 font-mono text-[0.72rem]">
              {outputs.map((o, i) => (
                <li key={`${o.generator}-${i}`} className="border border-rule px-3 py-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-ink-2">{o.generator.replace(/_/g, ' ')}</span>
                    <span className="text-graphite-soft text-[0.65rem]">
                      {new Date(o.approved_at).toLocaleString()}
                    </span>
                  </div>
                  {o.output_path && (
                    <div className="text-graphite mt-1 break-all">
                      → {o.output_path}
                    </div>
                  )}
                  {o.output_inline && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-graphite">
                        ▸ view inline ({o.output_inline.length.toLocaleString()} chars)
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap text-[0.7rem] bg-ink-2/5 p-3 max-h-96 overflow-y-auto">
                        {o.output_inline}
                      </pre>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <PreGenerationApprovalModal
        open={openGenerator !== null}
        matterId={matterId}
        generator={openGenerator ?? 'cover_letter'}
        onClose={() => setOpenGenerator(null)}
        onApproved={(result) => {
          if (openGenerator) onApproved(openGenerator, result);
        }}
      />
    </section>
  );
}

function Group(props: {
  title: string;
  items: GenerateButtonGroupItem[];
  onPick: (g: PreviewGenerator) => void;
}) {
  return (
    <div>
      <div className="smcp text-[0.65rem] text-graphite mb-3">¶ {props.title}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {props.items.map((item) => (
          <button
            key={item.generator}
            onClick={() => props.onPick(item.generator)}
            className="text-left border border-rule px-4 py-3 hover:border-ink-2 transition-colors"
          >
            <div className="display-italic text-[0.95rem] text-ink-2">{item.label}</div>
            <div className="font-mono text-[0.65rem] text-graphite-soft mt-1">
              {item.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
