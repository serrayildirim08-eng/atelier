'use client';

import { useCallback, useState } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import type { ReviewReport } from '@/reason';
import type { CaseType } from '@/ingest';

interface FieldProvenance {
  value: unknown;
  source_page: number | null;
  source_quote: string | null;
  confidence: number | null;
}

function isFieldLeaf(v: unknown): v is FieldProvenance {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    'value' in o &&
    'source_page' in o &&
    'source_quote' in o &&
    'confidence' in o
  );
}

interface IngestResult {
  filename: string;
  pageCount: number;
  caseFacts?: { case_type: CaseType; facts: Record<string, unknown> };
  detection_confidence?: number;
  detection_reasoning?: string;
  draft?: string;
  draftError?: { code: string; message: string };
  review?: ReviewReport;
  reviewError?: { code: string; message: string };
  error?: { code: string; message: string };
}

const PDF_EXT = /\.pdf$/i;

async function collectFilesFromItems(items: DataTransferItemList): Promise<File[]> {
  const files: File[] = [];
  type Entry = {
    isFile: boolean;
    isDirectory: boolean;
    file?: (cb: (file: File) => void) => void;
    createReader?: () => { readEntries: (cb: (entries: Entry[]) => void) => void };
  };
  const readDir = (reader: { readEntries: (cb: (entries: Entry[]) => void) => void }) =>
    new Promise<Entry[]>((resolve) => reader.readEntries(resolve));
  const traverse = async (entry: Entry | null): Promise<void> => {
    if (!entry) return;
    if (entry.isFile && entry.file) {
      await new Promise<void>((resolve) => {
        entry.file!((file) => {
          files.push(file);
          resolve();
        });
      });
      return;
    }
    if (entry.isDirectory && entry.createReader) {
      const reader = entry.createReader();
      while (true) {
        const batch = await readDir(reader);
        if (batch.length === 0) break;
        await Promise.all(batch.map((e) => traverse(e)));
      }
    }
  };
  const work: Promise<void>[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const getEntry = (item as unknown as { webkitGetAsEntry?: () => Entry | null })
      .webkitGetAsEntry;
    if (typeof getEntry === 'function') {
      work.push(traverse(getEntry.call(item)));
    }
  }
  await Promise.all(work);
  return files;
}

export default function Page() {
  const [results, setResults] = useState<IngestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback(async (files: File[]) => {
    const pdfs = files.filter((f) => PDF_EXT.test(f.name));
    if (pdfs.length === 0) {
      setResults([
        {
          filename: '(none)',
          pageCount: 0,
          error: { code: 'no_pdfs', message: 'No .pdf files found in the drop.' },
        },
      ]);
      return;
    }

    setLoading(true);
    setResults([]);

    const formData = new FormData();
    for (const f of pdfs) formData.append('files', f);

    try {
      const res = await fetch('/api/ingest', { method: 'POST', body: formData });
      const data = (await res.json()) as { results?: IngestResult[]; error?: string };
      if (!res.ok) {
        setResults([
          {
            filename: pdfs.map((f) => f.name).join(', '),
            pageCount: 0,
            error: { code: 'http_' + res.status, message: data.error ?? `HTTP ${res.status}` },
          },
        ]);
      } else {
        setResults(data.results ?? []);
      }
    } catch (e: unknown) {
      setResults([
        {
          filename: '(network)',
          pageCount: 0,
          error: { code: 'network', message: e instanceof Error ? e.message : String(e) },
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  const onDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragActive(false);
      const items = e.dataTransfer.items;
      const hasEntries =
        items.length > 0 &&
        typeof (items[0] as unknown as { webkitGetAsEntry?: unknown }).webkitGetAsEntry ===
          'function';
      const collected = hasEntries
        ? await collectFilesFromItems(items)
        : Array.from(e.dataTransfer.files);
      handleFiles(collected);
    },
    [handleFiles],
  );

  const onPickFolder = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(Array.from(e.target.files));
  };

  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">AKALAN Portal — Ingest</h1>
      <p className="text-sm text-gray-600 mb-6">
        Drop a PDF (or a folder of PDFs). The system detects case type (E-2 / EB-1A / EB-1B /
        EB-1C), extracts facts with provenance, drafts a cover letter, and reviews it for RFE
        risk.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragActive) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        className={
          'border-2 border-dashed rounded-lg p-12 text-center transition-colors ' +
          (dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white')
        }
      >
        <p className="text-gray-700 mb-4">
          {loading
            ? 'Working… detecting case type → extracting facts → drafting → reviewing (2–4 min per file)'
            : dragActive
              ? 'Release to upload'
              : 'Drag PDFs or a folder here'}
        </p>
        <label className="inline-block">
          <input
            type="file"
            multiple
            accept="application/pdf"
            ref={(el) => {
              if (el) {
                el.setAttribute('webkitdirectory', '');
                el.setAttribute('directory', '');
              }
            }}
            className="hidden"
            onChange={onPickFolder}
          />
          <span className="px-3 py-1 text-xs border rounded cursor-pointer hover:bg-gray-100">
            Or pick a folder
          </span>
        </label>
      </div>

      {results.length > 0 && (
        <div className="mt-8 space-y-6">
          {results.map((r, i) => (
            <ResultCard key={i} result={r} />
          ))}
        </div>
      )}
    </main>
  );
}

const CASE_TYPE_LABEL: Record<CaseType, string> = {
  E2: 'E-2 Treaty Investor',
  EB1A: 'EB-1A Extraordinary Ability',
  EB1B: 'EB-1B Outstanding Researcher',
  EB1C: 'EB-1C Multinational Manager/Executive',
};

const CASE_TYPE_STYLE: Record<CaseType, string> = {
  E2: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  EB1A: 'bg-purple-100 text-purple-800 border-purple-200',
  EB1B: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  EB1C: 'bg-rose-100 text-rose-800 border-rose-200',
};

function ResultCard({ result }: { result: IngestResult }) {
  if (result.error) {
    return (
      <div className="border border-red-200 bg-red-50 rounded p-4">
        <div className="font-medium">{result.filename}</div>
        <div className="text-sm text-red-700 mt-1">
          [{result.error.code}] {result.error.message}
        </div>
      </div>
    );
  }
  if (!result.caseFacts) return null;
  const { case_type, facts } = result.caseFacts;

  return (
    <div className="border rounded p-4 bg-white">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div>
          <div className="font-medium">
            {result.filename}{' '}
            <span className="text-xs text-gray-500">({result.pageCount} pages)</span>
          </div>
          {result.detection_reasoning && (
            <div className="text-xs text-gray-500 mt-1 italic">
              Detection: {result.detection_reasoning}
            </div>
          )}
        </div>
        <span
          className={
            'shrink-0 inline-block text-xs px-2 py-1 rounded border font-medium ' +
            CASE_TYPE_STYLE[case_type]
          }
        >
          {CASE_TYPE_LABEL[case_type]}
          {typeof result.detection_confidence === 'number' && (
            <span className="ml-2 font-normal text-[10px] opacity-75">
              {result.detection_confidence.toFixed(2)}
            </span>
          )}
        </span>
      </div>

      <FactsViewer facts={facts} />

      <DraftSection result={result} />
      <ReviewSection result={result} />
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Facts viewer — recursive renderer for Field<T> + nested objects         */
/* ---------------------------------------------------------------------- */

function FactsViewer({ facts }: { facts: Record<string, unknown> }) {
  return (
    <div className="space-y-4">
      {Object.entries(facts).map(([key, value]) => (
        <FactSection key={key} label={key} value={value} />
      ))}
    </div>
  );
}

function FactSection({ label, value }: { label: string; value: unknown }) {
  if (isFieldLeaf(value)) {
    return (
      <div>
        <div className="text-xs font-medium uppercase text-gray-500 mb-1">{label}</div>
        <div className="border rounded">
          <FactRowInline field={value} />
        </div>
      </div>
    );
  }
  if (Array.isArray(value)) {
    return (
      <div>
        <div className="text-xs font-medium uppercase text-gray-500 mb-1">
          {label} <span className="text-gray-400">({value.length})</span>
        </div>
        {value.length === 0 ? (
          <div className="text-xs text-gray-400 italic">empty</div>
        ) : (
          <div className="space-y-1">
            {value.map((item, i) => (
              <ArrayItem key={i} index={i} item={item} />
            ))}
          </div>
        )}
      </div>
    );
  }
  if (value && typeof value === 'object') {
    return (
      <div>
        <div className="text-xs font-medium uppercase text-gray-500 mb-1">{label}</div>
        <table className="w-full text-sm border rounded">
          <tbody>
            {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
              <FactSubRow key={k} label={k} value={v} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div>
      <span className="text-xs text-gray-500">{label}:</span>{' '}
      <span className="text-sm">{String(value)}</span>
    </div>
  );
}

function FactSubRow({ label, value }: { label: string; value: unknown }) {
  if (isFieldLeaf(value)) {
    const f = value;
    return (
      <tr className="border-t first:border-t-0">
        <td className="py-1 px-2 text-xs text-gray-600 align-top w-48">{label}</td>
        <td className="py-1 px-2 align-top">
          <FactRowInline field={f} />
        </td>
      </tr>
    );
  }
  if (Array.isArray(value)) {
    return (
      <tr className="border-t first:border-t-0">
        <td className="py-1 px-2 text-xs text-gray-600 align-top w-48">{label}</td>
        <td className="py-1 px-2 align-top">
          <div className="space-y-1">
            {value.map((item, i) => (
              <ArrayItem key={i} index={i} item={item} compact />
            ))}
          </div>
        </td>
      </tr>
    );
  }
  if (value && typeof value === 'object') {
    return (
      <tr className="border-t first:border-t-0">
        <td className="py-1 px-2 text-xs text-gray-600 align-top w-48">{label}</td>
        <td className="py-1 px-2 align-top">
          <table className="w-full text-xs">
            <tbody>
              {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
                <FactSubRow key={k} label={k} value={v} />
              ))}
            </tbody>
          </table>
        </td>
      </tr>
    );
  }
  return (
    <tr className="border-t first:border-t-0">
      <td className="py-1 px-2 text-xs text-gray-600 align-top w-48">{label}</td>
      <td className="py-1 px-2 text-sm align-top">{String(value)}</td>
    </tr>
  );
}

function ArrayItem({
  index,
  item,
  compact,
}: {
  index: number;
  item: unknown;
  compact?: boolean;
}) {
  if (isFieldLeaf(item)) {
    return (
      <div className="border rounded px-2 py-1">
        <FactRowInline field={item} prefix={`[${index}]`} />
      </div>
    );
  }
  if (item && typeof item === 'object') {
    return (
      <div className={compact ? 'border rounded' : 'border rounded'}>
        <table className="w-full text-xs">
          <tbody>
            {Object.entries(item as Record<string, unknown>).map(([k, v]) => (
              <FactSubRow key={k} label={k} value={v} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="text-sm">
      [{index}] {String(item)}
    </div>
  );
}

function FactRowInline({
  field,
  prefix,
}: {
  field: FieldProvenance;
  prefix?: string;
}) {
  return (
    <div className="px-2 py-1 text-sm flex flex-wrap gap-x-3 gap-y-0.5 items-baseline">
      {prefix && <span className="text-gray-400 text-xs">{prefix}</span>}
      <span className="font-medium">
        {field.value === null ? <span className="text-gray-400">—</span> : String(field.value)}
      </span>
      {field.source_page != null && (
        <span className="text-xs text-gray-500">p. {field.source_page}</span>
      )}
      {field.confidence != null && (
        <span className="text-xs text-gray-500">conf {field.confidence.toFixed(2)}</span>
      )}
      {field.source_quote && (
        <span className="text-xs text-gray-600 italic">“{field.source_quote}”</span>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Draft + Review sections                                                 */
/* ---------------------------------------------------------------------- */

const ASSESSMENT_STYLE: Record<string, string> = {
  ready: 'bg-green-100 text-green-800 border-green-200',
  minor_revisions: 'bg-amber-100 text-amber-800 border-amber-200',
  major_revisions: 'bg-orange-100 text-orange-800 border-orange-200',
  not_ready: 'bg-red-100 text-red-800 border-red-200',
};

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  major: 'bg-orange-100 text-orange-800 border-orange-200',
  minor: 'bg-yellow-100 text-yellow-800 border-yellow-200',
};

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={
        'inline-block text-xs px-2 py-0.5 rounded border ' +
        (SEVERITY_STYLE[severity] ?? 'bg-gray-100 border-gray-200')
      }
    >
      {severity}
    </span>
  );
}

function ReviewSection({ result }: { result: IngestResult }) {
  if (result.reviewError) {
    return (
      <div className="mt-4 border border-red-200 bg-red-50 rounded p-3 text-sm text-red-700">
        Review failed [{result.reviewError.code}]: {result.reviewError.message}
      </div>
    );
  }
  if (!result.review) return null;
  const r = result.review;

  return (
    <div className="mt-6 border-t pt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700">Review report</h3>
        <span
          className={
            'inline-block text-xs px-2 py-0.5 rounded border ' +
            (ASSESSMENT_STYLE[r.overall_assessment] ?? 'bg-gray-100 border-gray-200')
          }
        >
          {r.overall_assessment.replace('_', ' ')}
        </span>
      </div>
      <p className="text-sm text-gray-700 mb-4">{r.summary}</p>

      <FindingGroup
        title="Inconsistencies"
        count={r.inconsistencies.length}
        emptyText="No inconsistencies found."
      >
        {r.inconsistencies.map((f, i) => (
          <div key={i} className="border rounded p-3 bg-white">
            <div className="flex items-center gap-2 mb-1">
              <SeverityBadge severity={f.severity} />
              <span className="text-xs text-gray-500 uppercase">
                {f.category.replace('_', ' ')}
              </span>
            </div>
            <div className="text-sm text-gray-800">{f.description}</div>
            {f.letter_excerpt && (
              <div className="mt-2 text-xs text-gray-600 italic">
                Letter: “{f.letter_excerpt}”
              </div>
            )}
            {f.facts_value && (
              <div className="text-xs text-gray-600">
                Facts: <span className="font-mono">{f.facts_value}</span>
              </div>
            )}
          </div>
        ))}
      </FindingGroup>

      <FindingGroup
        title="Missing arguments"
        count={r.missing_arguments.length}
        emptyText="All required elements/criteria appear to be argued."
      >
        {r.missing_arguments.map((f, i) => (
          <div key={i} className="border rounded p-3 bg-white">
            <div className="text-xs text-gray-500 uppercase mb-1">{f.element}</div>
            <div className="text-sm text-gray-800 mb-1">{f.description}</div>
            <div className="text-xs text-gray-600 mb-1">
              <span className="font-medium">Missing:</span> {f.what_is_missing}
            </div>
            <div className="text-xs text-gray-600">
              <span className="font-medium">Suggestion:</span> {f.suggestion}
            </div>
          </div>
        ))}
      </FindingGroup>

      <FindingGroup
        title="Weak spots & RFE risks"
        count={r.weak_spots.length}
        emptyText="No notable RFE risks identified."
      >
        {r.weak_spots.map((f, i) => (
          <div key={i} className="border rounded p-3 bg-white">
            <div className="flex items-center gap-2 mb-1">
              <SeverityBadge severity={f.severity} />
              <span className="text-xs text-gray-500 uppercase">{f.element}</span>
            </div>
            <div className="text-sm text-gray-800 mb-1">{f.description}</div>
            <div className="text-xs text-gray-600 mb-1">
              <span className="font-medium">RFE risk:</span> {f.rfe_risk}
            </div>
            <div className="text-xs text-gray-600">
              <span className="font-medium">Suggestion:</span> {f.suggestion}
            </div>
          </div>
        ))}
      </FindingGroup>
    </div>
  );
}

function FindingGroup({
  title,
  count,
  emptyText,
  children,
}: {
  title: string;
  count: number;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="text-xs font-medium uppercase text-gray-500 mb-2">
        {title} <span className="text-gray-400">({count})</span>
      </div>
      {count === 0 ? (
        <div className="text-sm text-gray-400 italic">{emptyText}</div>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}

function DraftSection({ result }: { result: IngestResult }) {
  const [copied, setCopied] = useState(false);

  if (result.draftError) {
    return (
      <div className="mt-4 border border-red-200 bg-red-50 rounded p-3 text-sm text-red-700">
        Draft failed [{result.draftError.code}]: {result.draftError.message}
      </div>
    );
  }
  if (!result.draft) return null;

  const draft = result.draft;
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mt-6 border-t pt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700">Draft cover letter</h3>
        <button
          onClick={onCopy}
          className="text-xs px-2 py-1 border rounded hover:bg-gray-100"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="text-sm whitespace-pre-wrap font-sans bg-gray-50 p-4 rounded border max-h-[600px] overflow-y-auto leading-relaxed">
        {draft}
      </div>
    </div>
  );
}
