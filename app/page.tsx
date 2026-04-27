'use client';

import { useCallback, useState } from 'react';
import type { DragEvent, ChangeEvent } from 'react';

interface FieldProvenance<T> {
  value: T | null;
  source_page: number | null;
  source_quote: string | null;
  confidence: number | null;
}

interface E2FactsLike {
  applicant_name: FieldProvenance<string>;
  dob: FieldProvenance<string>;
  passport_number: FieldProvenance<string>;
  country: FieldProvenance<string>;
  business_name: FieldProvenance<string>;
  ein: FieldProvenance<string>;
  investment_amount: FieldProvenance<number>;
  dates: FieldProvenance<string>[];
  addresses: FieldProvenance<string>[];
}

interface IngestResult {
  filename: string;
  pageCount: number;
  facts?: E2FactsLike;
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
        Drop a PDF (or a folder of PDFs) to extract E2 facts. Each value carries page, source
        quote, and confidence.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
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
            ? 'Extracting facts…'
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
  if (!result.facts) return null;
  const facts = result.facts;
  type Row = { label: string; field: FieldProvenance<string | number> };
  const rows: Row[] = [
    { label: 'applicant_name', field: facts.applicant_name },
    { label: 'dob', field: facts.dob },
    { label: 'passport_number', field: facts.passport_number },
    { label: 'country', field: facts.country },
    { label: 'business_name', field: facts.business_name },
    { label: 'ein', field: facts.ein },
    { label: 'investment_amount', field: facts.investment_amount },
  ];

  return (
    <div className="border rounded p-4 bg-white">
      <div className="font-medium mb-3">
        {result.filename}{' '}
        <span className="text-xs text-gray-500">({result.pageCount} pages)</span>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-gray-500 text-xs uppercase">
          <tr>
            <th className="py-1 pr-4 font-normal">Field</th>
            <th className="py-1 pr-4 font-normal">Value</th>
            <th className="py-1 pr-4 font-normal">Page</th>
            <th className="py-1 pr-4 font-normal">Conf.</th>
            <th className="py-1 font-normal">Source quote</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <FieldRow key={row.label} label={row.label} field={row.field} />
          ))}
          {facts.dates.map((f, i) => (
            <FieldRow key={`dates-${i}`} label={i === 0 ? 'dates' : ''} field={f} />
          ))}
          {facts.addresses.map((f, i) => (
            <FieldRow key={`addresses-${i}`} label={i === 0 ? 'addresses' : ''} field={f} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FieldRow({
  label,
  field,
}: {
  label: string;
  field: FieldProvenance<string | number>;
}) {
  return (
    <tr className="border-t">
      <td className="py-1 pr-4 align-top text-gray-600">{label}</td>
      <td className="py-1 pr-4 align-top">
        {field.value === null ? (
          <span className="text-gray-400">—</span>
        ) : (
          String(field.value)
        )}
      </td>
      <td className="py-1 pr-4 align-top">{field.source_page ?? ''}</td>
      <td className="py-1 pr-4 align-top">
        {field.confidence != null ? field.confidence.toFixed(2) : ''}
      </td>
      <td className="py-1 align-top text-gray-700 italic">
        {field.source_quote ? `“${field.source_quote}”` : ''}
      </td>
    </tr>
  );
}
