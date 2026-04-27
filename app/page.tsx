'use client';

import { Fragment, useCallback, useState, useMemo, useEffect } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import type { ReviewReport } from '@/reason';
import type { CaseType, E2Facts } from '@/ingest';

/* ---------------------------------------------------------------------- */
/* Types                                                                   */
/* ---------------------------------------------------------------------- */

interface FieldProvenance {
  value: unknown;
  source_page: number | null;
  source_quote: string | null;
  confidence: number | null;
}

function isFieldLeaf(v: unknown): v is FieldProvenance {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return 'value' in o && 'source_page' in o && 'source_quote' in o && 'confidence' in o;
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

type DossierTab = 'facts' | 'memory' | 'draft' | 'review' | 'log';

interface IngestProgress {
  stage: string;
  label: string;
  pdfCount: number;
}

type DocType =
  | 'passport'
  | 'status_doc'
  | 'bank_statement'
  | 'tax_doc'
  | 'money_movement'
  | 'source_of_funds'
  | 'formation_doc'
  | 'ownership_evidence'
  | 'lease_or_property'
  | 'business_plan'
  | 'invoice_or_receipt'
  | 'business_contract'
  | 'payroll_doc'
  | 'uscis_or_dos_form'
  | 'cover_letter'
  | 'expert_letter'
  | 'other';

const DOC_TYPE_LABEL: Record<DocType, string> = {
  passport: 'Passport',
  status_doc: 'US status / I-94',
  bank_statement: 'Bank statement',
  tax_doc: 'Tax document',
  money_movement: 'Wire / transfer',
  source_of_funds: 'Source of funds',
  formation_doc: 'Formation doc',
  ownership_evidence: 'Ownership',
  lease_or_property: 'Lease / property',
  business_plan: 'Business plan',
  invoice_or_receipt: 'Invoice / receipt',
  business_contract: 'Contract',
  payroll_doc: 'Payroll',
  uscis_or_dos_form: 'USCIS / DOS form',
  cover_letter: 'Cover letter',
  expert_letter: 'Expert letter',
  other: 'Other',
};

interface PerPdfMemoryEntry {
  filename: string;
  pageCount: number;
  doc_type: DocType | null;
  facts: Record<string, unknown> | null;
  error: { code: string; message: string } | null;
}

type TypedMemory = Partial<Record<DocType, PerPdfMemoryEntry[]>>;

interface AkalanBridge {
  platform: string;
  isDesktop: boolean;
  pickFolder?: () => Promise<string | null>;
}

declare global {
  interface Window {
    akalan?: AkalanBridge;
  }
}

const PDF_EXT = /\.pdf$/i;

/* ---------------------------------------------------------------------- */
/* File traversal — preserved from prior version                           */
/* ---------------------------------------------------------------------- */

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
    if (typeof getEntry === 'function') work.push(traverse(getEntry.call(item)));
  }
  await Promise.all(work);
  return files;
}

/* ---------------------------------------------------------------------- */
/* Case-type taxonomy                                                      */
/* ---------------------------------------------------------------------- */

const CASE_LABEL: Record<CaseType, string> = {
  E2: 'Treaty Investor',
  EB1A: 'Extraordinary Ability',
  EB1B: 'Outstanding Researcher',
  EB1C: 'Multinational Manager',
};

const CASE_GLYPH: Record<CaseType, string> = {
  E2: 'E·II',
  EB1A: 'EB·IA',
  EB1B: 'EB·IB',
  EB1C: 'EB·IC',
};

const ASSESSMENT_LABEL: Record<string, string> = {
  ready: 'Ready',
  minor_revisions: 'Minor revisions',
  major_revisions: 'Major revisions',
  not_ready: 'Not ready',
};

const ASSESSMENT_TONE: Record<string, string> = {
  ready: 'text-verdant',
  minor_revisions: 'text-ochre',
  major_revisions: 'text-rubric',
  not_ready: 'text-rubric',
};

/* ---------------------------------------------------------------------- */
/* Page — three-pane atelier layout                                        */
/* ---------------------------------------------------------------------- */

export default function Page() {
  const [results, setResults] = useState<IngestResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [tab, setTab] = useState<DossierTab>('facts');
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());
  const [progress, setProgress] = useState<IngestProgress | null>(null);
  const [isElectron, setIsElectron] = useState(false);
  const [typedMemory, setTypedMemory] = useState<TypedMemory>({});
  const [perPdfCount, setPerPdfCount] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });
  const [matterRoot, setMatterRoot] = useState<string | null>(null);
  const [matterOverlayOpen, setMatterOverlayOpen] = useState(false);
  const [selectedEntryKey, setSelectedEntryKey] = useState<string | null>(null);
  const [entryLabels, setEntryLabels] = useState<Record<string, string>>({});
  const [dashboardOverrides, setDashboardOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && !!window.akalan?.pickFolder);
  }, []);

  useEffect(() => {
    if (!matterOverlayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMatterOverlayOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [matterOverlayOpen]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const selected = results[selectedIdx];

  const handleFiles = useCallback(async (files: File[]) => {
    const pdfs = files.filter((f) => PDF_EXT.test(f.name));
    if (pdfs.length === 0) {
      setResults([
        {
          filename: '(none)',
          pageCount: 0,
          error: { code: 'no_pdfs', message: 'No .pdf files found in the deposit.' },
        },
      ]);
      setSelectedIdx(0);
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
        setSelectedIdx(0);
        setTab('facts');
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

  const handleFolderPath = useCallback(async (rootPath: string) => {
    setLoading(true);
    setResults([]);
    setProgress(null);
    setTypedMemory({});
    setPerPdfCount({ done: 0, total: 0 });
    setMatterRoot(rootPath);

    try {
      const res = await fetch('/api/ingest-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: rootPath }),
      });

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setResults([
          {
            filename: rootPath,
            pageCount: 0,
            error: {
              code: 'http_' + res.status,
              message: data.error ?? `HTTP ${res.status}`,
            },
          },
        ]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const collected: IngestResult[] = [];
      let pdfCount = 0;

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          let evt: { type: string; [k: string]: unknown };
          try {
            evt = JSON.parse(line) as { type: string; [k: string]: unknown };
          } catch {
            continue;
          }
          if (evt.type === 'start') {
            pdfCount = (evt.total as number) ?? 0;
            setPerPdfCount({ done: 0, total: pdfCount });
            setProgress({
              stage: 'starting',
              label: `Found ${pdfCount} PDFs`,
              pdfCount,
            });
          } else if (evt.type === 'progress') {
            setProgress({
              stage: (evt.stage as string) ?? 'working',
              label: (evt.label as string) ?? 'Working',
              pdfCount,
            });
          } else if (evt.type === 'pdf_result') {
            const entry: PerPdfMemoryEntry = {
              filename: evt.filename as string,
              pageCount: (evt.pageCount as number) ?? 0,
              doc_type: (evt.doc_type as DocType | null) ?? null,
              facts: (evt.facts as Record<string, unknown> | null) ?? null,
              error: (evt.error as { code: string; message: string } | null) ?? null,
            };
            const bucket: DocType = entry.doc_type ?? 'other';
            setTypedMemory((prev) => {
              const list = prev[bucket] ?? [];
              return { ...prev, [bucket]: [...list, entry] };
            });
            setPerPdfCount((prev) => ({ done: prev.done + 1, total: prev.total }));
          } else if (evt.type === 'result') {
            collected.push(evt.result as IngestResult);
            setResults([...collected]);
            if (collected.length === 1) setSelectedIdx(0);
          } else if (evt.type === 'done') {
            setProgress(null);
          }
        }
      }
    } catch (e: unknown) {
      setResults([
        {
          filename: rootPath,
          pageCount: 0,
          error: {
            code: 'network',
            message: e instanceof Error ? e.message : String(e),
          },
        },
      ]);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, []);

  const onPickFolderElectron = useCallback(async () => {
    if (!window.akalan?.pickFolder) return;
    const picked = await window.akalan.pickFolder();
    if (!picked) return;
    handleFolderPath(picked);
  }, [handleFolderPath]);

  return (
    <div
      className="h-screen grid grid-rows-[3.25rem_1fr_1.75rem] paper-grain"
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragActive) setDragActive(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragActive(false);
      }}
      onDrop={onDrop}
    >
      <Header now={now} />

      <main className="grid grid-cols-[16rem_1fr_19rem] min-h-0 border-y border-rule-strong">
        <Binder
          results={results}
          selectedIdx={selectedIdx}
          onSelect={(i) => {
            setSelectedIdx(i);
            setTab('facts');
          }}
          loading={loading}
          progress={progress}
          perPdfCount={perPdfCount}
          isElectron={isElectron}
          onPickFolder={onPickFolder}
          onPickFolderElectron={onPickFolderElectron}
        />
        <Dossier
          result={selected}
          tab={tab}
          onTab={setTab}
          loading={loading}
          hasAny={results.length > 0}
          typedMemory={typedMemory}
          perPdfCount={perPdfCount}
          matterRoot={matterRoot}
          entryLabels={entryLabels}
          onOpenMatter={() => setMatterOverlayOpen(true)}
        />
        <Marginalia result={selected} loading={loading} />
      </main>

      <StatusBar results={results} loading={loading} now={now} />

      {dragActive && <DragOverlay />}

      {matterOverlayOpen && (
        <MatterOverlay
          matterName={selected?.filename ?? matterRoot ?? 'Matter'}
          matterRoot={matterRoot}
          result={selected}
          typedMemory={typedMemory}
          selectedEntryKey={selectedEntryKey}
          onSelectEntry={setSelectedEntryKey}
          entryLabels={entryLabels}
          onSetLabel={(key, label) =>
            setEntryLabels((prev) => ({ ...prev, [key]: label }))
          }
          dashboardOverrides={dashboardOverrides}
          onSetDashboardOverride={(path, val) =>
            setDashboardOverrides((prev) => ({ ...prev, [path]: val }))
          }
          onClose={() => setMatterOverlayOpen(false)}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Header                                                                  */
/* ---------------------------------------------------------------------- */

function Header({ now }: { now: Date }) {
  const date = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const time = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center px-6 paper-grain border-b border-rule">
      <div className="flex items-center gap-3">
        <span className="sigil" aria-hidden>A</span>
        <div className="flex items-baseline gap-2.5 leading-none">
          <span className="font-display text-[1.05rem] tracking-wide">akalan</span>
          <span className="text-rule-strong">·</span>
          <span className="display-italic text-[1.05rem] text-rubric">atelier</span>
        </div>
      </div>

      <div className="flex items-center gap-3 px-3 py-1 border border-rule paper-recess text-[0.78rem] text-graphite hover:border-ink-2 transition-colors cursor-text">
        <span className="font-mono text-[0.7rem]">⌘K</span>
        <span className="smcp">search the binder</span>
      </div>

      <div className="flex items-center justify-end gap-5 text-[0.78rem] text-graphite font-mono">
        <span>{date}</span>
        <span className="text-rule-strong">·</span>
        <span>{time}</span>
        <span className="text-rule-strong">·</span>
        <span>sy@akalan.law</span>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------------- */
/* Binder (left rail)                                                      */
/* ---------------------------------------------------------------------- */

function Binder({
  results,
  selectedIdx,
  onSelect,
  loading,
  progress,
  perPdfCount,
  isElectron,
  onPickFolder,
  onPickFolderElectron,
}: {
  results: IngestResult[];
  selectedIdx: number;
  onSelect: (i: number) => void;
  loading: boolean;
  progress: IngestProgress | null;
  perPdfCount: { done: number; total: number };
  isElectron: boolean;
  onPickFolder: (e: ChangeEvent<HTMLInputElement>) => void;
  onPickFolderElectron: () => void;
}) {
  return (
    <aside className="border-r border-rule paper-grain min-h-0 flex flex-col">
      <div className="px-5 pt-5 pb-3">
        <div className="smcp text-[0.65rem] text-graphite-soft mb-1">⁂  the binder</div>
        <div className="font-display text-[0.92rem] leading-tight">
          {results.length === 0
            ? 'No active matters.'
            : `${results.length} ${results.length === 1 ? 'matter' : 'matters'} on the desk`}
        </div>
      </div>

      <div className="brass-rule mx-3" />

      <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
        {loading && <BinderLoadingRow progress={progress} perPdfCount={perPdfCount} />}
        {!loading && results.length === 0 && (
          <div className="px-3 py-6 text-[0.78rem] text-graphite italic font-display">
            Drop a dossier into the dossier pane to begin.
          </div>
        )}
        {results.map((r, i) => (
          <BinderRow
            key={i}
            result={r}
            selected={i === selectedIdx}
            onSelect={() => onSelect(i)}
          />
        ))}
      </div>

      <div className="border-t border-rule px-3 py-3 flex flex-col gap-2">
        {isElectron ? (
          <button
            onClick={onPickFolderElectron}
            className="block text-center px-3 py-1.5 border border-ink-2 text-[0.78rem] cursor-pointer hover:bg-ink hover:text-paper transition-colors smcp"
          >
            ※ deposit a folder
          </button>
        ) : (
          <label className="block">
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
            <span className="block text-center px-3 py-1.5 border border-ink-2 text-[0.78rem] cursor-pointer hover:bg-ink hover:text-paper transition-colors smcp">
              ※ deposit a folder
            </span>
          </label>
        )}
        <div className="font-mono text-[0.62rem] text-graphite-soft text-center tracking-widest">
          {isElectron ? 'native picker · streamed from disk' : 'PDFs · case files · exhibits'}
        </div>
      </div>
    </aside>
  );
}

function BinderLoadingRow({
  progress,
  perPdfCount,
}: {
  progress: IngestProgress | null;
  perPdfCount: { done: number; total: number };
}) {
  const showCount = perPdfCount.total > 0;
  return (
    <div className="px-3 py-3">
      <div className="smcp text-[0.62rem] text-rubric mb-2">⁂  working</div>
      {progress ? (
        <>
          <div className="font-mono text-[0.62rem] text-graphite mb-1 tracking-widest uppercase">
            {progress.stage}
          </div>
          <div className="font-display italic text-[0.85rem] text-ink-2 leading-tight">
            {progress.label}
          </div>
          {showCount && progress.stage === 'classifying' && (
            <div className="mt-2 font-mono text-[0.7rem] text-ink-2">
              {perPdfCount.done} / {perPdfCount.total}
            </div>
          )}
        </>
      ) : (
        <div className="font-display italic text-[0.85rem] text-ink-2 leading-tight">
          Detecting case type… extracting facts… drafting… reviewing.
        </div>
      )}
      <div className="mt-2 font-mono text-[0.62rem] text-graphite tracking-widest">
        TYPED MEMORY · PARALLEL HAIKU + SONNET AGGREGATOR
      </div>
    </div>
  );
}

function BinderRow({
  result,
  selected,
  onSelect,
}: {
  result: IngestResult;
  selected: boolean;
  onSelect: () => void;
}) {
  const caseType = result.caseFacts?.case_type;
  const isError = !!result.error;
  const assessment = result.review?.overall_assessment;

  return (
    <button
      onClick={onSelect}
      className={
        'group w-full text-left px-3 py-2.5 transition-colors border-l-2 ' +
        (selected
          ? 'border-rubric paper-recess'
          : 'border-transparent hover:bg-paper-2/60')
      }
    >
      <div className="flex items-baseline justify-between gap-2 mb-0.5">
        <div className="font-display text-[0.92rem] leading-tight truncate">
          {trimFilename(result.filename)}
        </div>
        {caseType && (
          <span className="font-mono text-[0.62rem] text-graphite shrink-0 tracking-wider">
            {CASE_GLYPH[caseType]}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-[0.7rem] text-graphite-soft">
        {isError ? (
          <span className="text-rubric smcp">error</span>
        ) : caseType ? (
          <>
            <span className="font-mono">{result.pageCount}p</span>
            <span className="text-rule-strong">·</span>
            <span className="truncate">{CASE_LABEL[caseType]}</span>
          </>
        ) : (
          <span className="smcp">pending</span>
        )}
      </div>
      {assessment && (
        <div className={`mt-1 smcp text-[0.6rem] ${ASSESSMENT_TONE[assessment]}`}>
          † {ASSESSMENT_LABEL[assessment] ?? assessment}
        </div>
      )}
    </button>
  );
}

function trimFilename(s: string) {
  const noExt = s.replace(/\.pdf$/i, '');
  return noExt.length > 28 ? noExt.slice(0, 27) + '…' : noExt;
}

/* ---------------------------------------------------------------------- */
/* Dossier (center pane)                                                   */
/* ---------------------------------------------------------------------- */

function Dossier({
  result,
  tab,
  onTab,
  loading,
  hasAny,
  typedMemory,
  perPdfCount,
  matterRoot,
  entryLabels,
  onOpenMatter,
}: {
  result: IngestResult | undefined;
  tab: DossierTab;
  onTab: (t: DossierTab) => void;
  loading: boolean;
  hasAny: boolean;
  typedMemory: TypedMemory;
  perPdfCount: { done: number; total: number };
  matterRoot: string | null;
  entryLabels: Record<string, string>;
  onOpenMatter: () => void;
}) {
  const memoryHasEntries = Object.values(typedMemory).some(
    (list) => Array.isArray(list) && list.length > 0,
  );

  if (loading && !hasAny && memoryHasEntries) {
    return (
      <section className="min-h-0 flex flex-col paper-grain">
        <DossierLoadingHeader perPdfCount={perPdfCount} />
        <div className="flex-1 overflow-y-auto min-h-0">
          <MemoryPane
            typedMemory={typedMemory}
            matterRoot={matterRoot}
            entryLabels={entryLabels}
            onOpenMatter={onOpenMatter}
          />
        </div>
      </section>
    );
  }

  if (loading && !hasAny) return <DossierLoading />;
  if (!result) return <DossierEmpty />;
  if (result.error) return <DossierError result={result} />;
  if (!result.caseFacts) return <DossierEmpty />;

  return (
    <section className="min-h-0 flex flex-col paper-grain">
      <DossierHeader result={result} />
      <DossierTabs tab={tab} onTab={onTab} result={result} />
      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === 'facts' && <FactsPane facts={result.caseFacts.facts} />}
        {tab === 'memory' && (
          <MemoryPane
            typedMemory={typedMemory}
            matterRoot={matterRoot}
            entryLabels={entryLabels}
            onOpenMatter={onOpenMatter}
          />
        )}
        {tab === 'draft' && <DraftPane result={result} />}
        {tab === 'review' && <ReviewPane result={result} />}
        {tab === 'log' && <LogPane result={result} />}
      </div>
    </section>
  );
}

function DossierLoadingHeader({
  perPdfCount,
}: {
  perPdfCount: { done: number; total: number };
}) {
  return (
    <header className="px-9 pt-7 pb-5 border-b border-rule">
      <div className="smcp text-[0.65rem] text-graphite-soft mb-1">⁂  building typed memory</div>
      <h1 className="font-display text-[1.55rem] leading-tight">
        Classifying {perPdfCount.done} of {perPdfCount.total} documents
      </h1>
      <p className="font-display italic text-[0.95rem] text-graphite mt-1.5">
        Each PDF is sorted into its document type and its facts read into memory. The
        aggregator runs once every PDF is in.
      </p>
    </header>
  );
}

function MemoryPane({
  typedMemory,
  matterRoot,
  entryLabels,
  onOpenMatter,
}: {
  typedMemory: TypedMemory;
  matterRoot: string | null;
  entryLabels: Record<string, string>;
  onOpenMatter: () => void;
}) {
  const buckets = (Object.entries(typedMemory) as [DocType, PerPdfMemoryEntry[]][])
    .filter(([, list]) => Array.isArray(list) && list.length > 0)
    .sort((a, b) => b[1].length - a[1].length);

  const [collapsedBuckets, setCollapsedBuckets] = useState<Record<string, boolean>>({});

  if (buckets.length === 0) {
    return (
      <div className="px-9 py-12 font-display italic text-[0.95rem] text-graphite">
        Typed memory is empty. PDFs will appear here as they are classified.
      </div>
    );
  }

  const totalEntries = buckets.reduce((acc, [, list]) => acc + list.length, 0);

  return (
    <div className="px-9 py-7 space-y-7">
      <button
        onClick={onOpenMatter}
        className="w-full flex items-baseline justify-between border border-ink-2 paper-recess px-5 py-3 hover:bg-ink hover:text-paper transition-colors group"
      >
        <span className="font-display italic text-[1rem] group-hover:not-italic">
          Open the matter
        </span>
        <span className="font-mono text-[0.7rem] tracking-widest text-graphite group-hover:text-paper-2">
          {buckets.length} categories · {totalEntries} documents →
        </span>
      </button>

      {buckets.map(([docType, entries]) => (
        <MemoryBucket
          key={docType}
          docType={docType}
          entries={entries}
          collapsed={!!collapsedBuckets[docType]}
          onToggle={() =>
            setCollapsedBuckets((s) => ({ ...s, [docType]: !s[docType] }))
          }
          entryLabels={entryLabels}
          onOpenMatter={onOpenMatter}
        />
      ))}
    </div>
  );
}

function MemoryBucket({
  docType,
  entries,
  collapsed,
  onToggle,
  entryLabels,
  onOpenMatter,
}: {
  docType: DocType;
  entries: PerPdfMemoryEntry[];
  collapsed: boolean;
  onToggle: () => void;
  entryLabels: Record<string, string>;
  onOpenMatter: () => void;
}) {
  return (
    <section>
      <button
        onClick={onToggle}
        className="w-full flex items-baseline justify-between border-b border-rule pb-1.5 mb-3 group hover:border-ink-2 transition-colors text-left"
      >
        <div className="flex items-baseline gap-3">
          <span
            className="font-mono text-[0.78rem] text-graphite-soft transition-transform group-hover:text-ink-2"
            style={{
              display: 'inline-block',
              transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
              transformOrigin: '50% 55%',
              width: '0.85rem',
            }}
          >
            ▶
          </span>
          <h2 className="font-display text-[1.05rem] group-hover:text-rubric transition-colors">
            {DOC_TYPE_LABEL[docType]}
          </h2>
          <span className="font-mono text-[0.7rem] text-graphite tracking-widest">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
        <span className="font-mono text-[0.62rem] text-graphite-soft tracking-widest">
          {docType}
        </span>
      </button>
      {!collapsed && (
        <ul className="space-y-1.5">
          {entries.map((e) => {
            const key = entryKey(docType, e.filename);
            const label = entryLabels[key] ?? getSuggestedDocLabel(e);
            return (
              <li key={key}>
                <button
                  onClick={onOpenMatter}
                  className="w-full text-left flex items-baseline gap-2 px-3 py-1 border-l-2 border-rule hover:border-rubric hover:bg-paper-2/40 transition-colors group"
                >
                  <span className="shrink-0 font-mono text-[0.6rem] text-graphite-soft tracking-widest group-hover:text-rubric">
                    →
                  </span>
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-display text-[0.92rem] truncate group-hover:text-rubric"
                      title={label}
                    >
                      {label}
                    </div>
                    <div
                      className="font-mono text-[0.65rem] text-graphite-soft truncate"
                      title={e.filename}
                    >
                      {e.filename}
                    </div>
                  </div>
                  {e.error && (
                    <span className="shrink-0 font-mono text-[0.62rem] text-rubric tracking-widest">
                      error
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function entryKey(docType: DocType, filename: string): string {
  return `${docType}::${filename}`;
}

/**
 * Auto-suggest a human-readable label for a per-PDF memory entry, derived
 * from the doc_type and the populated facts. The attorney can override
 * via entryLabels in the overlay; this helper is the seed.
 */
function getSuggestedDocLabel(entry: PerPdfMemoryEntry): string {
  const facts = entry.facts;
  const fallback = basenameOf(entry.filename);
  if (!facts || typeof facts !== 'object') return fallback;
  const type = entry.doc_type;
  const get = (key: string): string | null => {
    const v = (facts as Record<string, unknown>)[key];
    if (v && typeof v === 'object' && 'value' in (v as Record<string, unknown>)) {
      const val = (v as { value: unknown }).value;
      if (val === null || val === undefined) return null;
      return String(val);
    }
    return null;
  };
  switch (type) {
    case 'passport': {
      const name = get('full_name');
      return name ? `${name}'s passport` : fallback;
    }
    case 'status_doc': {
      const name = get('full_name');
      const cls = get('status_class');
      return [name, cls].filter(Boolean).join(' · ') || fallback;
    }
    case 'bank_statement': {
      const bank = get('bank_name');
      const last4 = get('account_last4');
      const period = get('statement_period');
      const parts = [bank, last4 && `·${last4}`, period].filter(Boolean);
      return parts.length > 0 ? parts.join(' ') : fallback;
    }
    case 'tax_doc': {
      const filer = get('filer_name');
      const year = get('tax_year');
      const form = get('form_type');
      return [filer, year, form].filter(Boolean).join(' · ') || fallback;
    }
    case 'money_movement': {
      const amt = get('amount_usd');
      const date = get('date');
      const to = get('to_holder');
      const parts = [amt && `$${amt}`, date, to && `→ ${to}`].filter(Boolean);
      return parts.length > 0 ? parts.join(' · ') : fallback;
    }
    case 'source_of_funds': {
      const cat = get('category');
      const amt = get('amount_usd');
      const donor = get('donor_or_seller');
      const parts = [cat, amt && `$${amt}`, donor && `from ${donor}`].filter(Boolean);
      return parts.length > 0 ? parts.join(' · ') : fallback;
    }
    case 'formation_doc': {
      const kind = get('kind');
      const entity = get('entity_legal_name');
      return [kind, entity].filter(Boolean).join(' · ') || fallback;
    }
    case 'ownership_evidence': {
      const kind = get('kind');
      const entity = get('entity_name');
      return [kind, entity].filter(Boolean).join(' · ') || fallback;
    }
    case 'lease_or_property': {
      const addr = get('address');
      return addr ? `Lease · ${addr}` : fallback;
    }
    case 'business_plan': {
      const ent = get('enterprise_name');
      return ent ? `${ent} business plan` : fallback;
    }
    case 'invoice_or_receipt': {
      const vendor = get('vendor');
      const amt = get('amount_usd');
      const cat = get('category');
      const parts = [vendor, amt && `$${amt}`, cat].filter(Boolean);
      return parts.length > 0 ? parts.join(' · ') : fallback;
    }
    case 'business_contract': {
      const cp = get('counterparty_name');
      const role = get('role');
      return [cp, role].filter(Boolean).join(' · ') || fallback;
    }
    case 'payroll_doc': {
      const emp = get('employer_name');
      return emp ? `${emp} payroll` : fallback;
    }
    case 'uscis_or_dos_form': {
      const id = get('form_id');
      const ben = get('beneficiary_name');
      return [id, ben].filter(Boolean).join(' · ') || fallback;
    }
    case 'cover_letter': {
      const visa = get('visa_type_argued');
      return visa ? `Cover letter · ${visa}` : 'Cover letter';
    }
    case 'expert_letter': {
      const writer = get('writer_name');
      const inst = get('writer_institution');
      if (writer && inst) return `${writer} (${inst})`;
      return writer ?? fallback;
    }
    case 'other': {
      const sum = get('one_line_summary');
      return sum ?? fallback;
    }
    default:
      return fallback;
  }
}

function basenameOf(p: string): string {
  const i = p.lastIndexOf('/');
  return i >= 0 ? p.slice(i + 1) : p;
}

function MemoryFactsList({ facts }: { facts: Record<string, unknown> }) {
  const rows: { key: string; value: string }[] = [];
  for (const [k, v] of Object.entries(facts)) {
    if (k === 'doc_type') continue;
    if (v && typeof v === 'object' && 'value' in (v as Record<string, unknown>)) {
      const fv = (v as { value: unknown }).value;
      if (fv === null || fv === undefined) continue;
      rows.push({ key: k, value: String(fv) });
    } else if (Array.isArray(v) && v.length > 0) {
      rows.push({ key: k, value: `${v.length} entries` });
    }
  }
  if (rows.length === 0) {
    return (
      <div className="font-display italic text-[0.78rem] text-graphite-soft mt-1">
        all fields null
      </div>
    );
  }
  return (
    <dl className="mt-1 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-[0.78rem]">
      {rows.map((r) => (
        <Fragment key={r.key}>
          <dt className="font-mono text-[0.7rem] text-graphite tracking-wide">{r.key}</dt>
          <dd className="text-ink-2 truncate" title={r.value}>
            {r.value}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

function DossierEmpty() {
  return (
    <section className="min-h-0 grid place-items-center paper-grain px-12">
      <div className="max-w-[560px] text-center">
        <div className="dinkus mb-8">⁂</div>
        <h1 className="font-display text-[3.2rem] leading-[1.05] tracking-[-0.01em]">
          Drop a <span className="display-italic text-rubric">dossier</span>.
        </h1>
        <p className="mt-6 font-display italic text-[1.1rem] text-ink-2 leading-relaxed">
          PDFs, folders, exhibits — anything bound for USCIS.
        </p>
        <div className="mt-8 grid grid-cols-4 gap-x-4 gap-y-1 text-[0.72rem] smcp text-graphite border-t border-b border-rule py-4">
          <div>E·II</div>
          <div>EB·IA</div>
          <div>EB·IB</div>
          <div>EB·IC</div>
          <div className="font-display italic normal-case tracking-normal text-graphite-soft text-[0.78rem]">
            Treaty Investor
          </div>
          <div className="font-display italic normal-case tracking-normal text-graphite-soft text-[0.78rem]">
            Extraordinary Ability
          </div>
          <div className="font-display italic normal-case tracking-normal text-graphite-soft text-[0.78rem]">
            Outstanding Researcher
          </div>
          <div className="font-display italic normal-case tracking-normal text-graphite-soft text-[0.78rem]">
            Multinational Manager
          </div>
        </div>
        <p className="mt-8 text-[0.78rem] text-graphite leading-relaxed drop-cap">
          The atelier reads each file end to end, identifies the case type, extracts every fact
          with provenance, drafts the cover letter in the firm’s voice, and audits the draft for
          inconsistency and RFE risk before you ever set eyes on it.
        </p>
      </div>
    </section>
  );
}

function DossierLoading() {
  return (
    <section className="min-h-0 grid place-items-center paper-grain px-12">
      <div className="max-w-[480px] text-center fade-in">
        <div className="dinkus mb-8">⁂</div>
        <p className="font-display italic text-[1.4rem] text-ink leading-relaxed">
          “The clerk is reading the file.”
        </p>
        <ol className="mt-10 grid gap-3 text-left">
          <LoadingStep n="i" label="detecting case type" />
          <LoadingStep n="ii" label="extracting facts with citation" />
          <LoadingStep n="iii" label="drafting the cover letter" />
          <LoadingStep n="iv" label="reviewing for inconsistency & rfe risk" />
        </ol>
        <div className="mt-10 font-mono text-[0.7rem] text-graphite tracking-widest">
          ‹ 2–4 MIN PER FILE ›
        </div>
      </div>
    </section>
  );
}

function LoadingStep({ n, label }: { n: string; label: string }) {
  return (
    <li className="flex items-baseline gap-4 border-b border-rule pb-2">
      <span className="font-mono text-[0.7rem] smcp text-rubric w-6">{n}.</span>
      <span className="font-display italic text-[0.95rem] text-ink-2">{label}</span>
    </li>
  );
}

function DossierError({ result }: { result: IngestResult }) {
  return (
    <section className="min-h-0 grid place-items-center px-12 paper-grain">
      <div className="max-w-[520px] border border-rubric/40 paper-recess p-8 fade-up">
        <div className="smcp text-rubric text-[0.75rem] mb-3">† problem with the deposit</div>
        <div className="font-display text-[1.4rem] leading-tight mb-1">{result.filename}</div>
        <div className="font-mono text-[0.7rem] text-graphite mb-4">
          [{result.error?.code}]
        </div>
        <div className="font-display italic text-[1rem] text-ink-2 leading-relaxed">
          {result.error?.message}
        </div>
      </div>
    </section>
  );
}

function DossierHeader({ result }: { result: IngestResult }) {
  const caseType = result.caseFacts?.case_type;
  const conf = result.detection_confidence;
  const assessment = result.review?.overall_assessment;
  const clientName = guessClientName(result);

  return (
    <header className="px-9 pt-7 pb-5">
      <div className="flex items-center gap-3 smcp text-[0.65rem] text-graphite mb-3">
        <span className="font-mono not-italic">{result.filename}</span>
        <span className="text-rule-strong">·</span>
        <span className="font-mono">{result.pageCount} pp</span>
        {caseType && (
          <>
            <span className="text-rule-strong">·</span>
            <span className="font-mono">{CASE_GLYPH[caseType]}</span>
          </>
        )}
        {typeof conf === 'number' && (
          <>
            <span className="text-rule-strong">·</span>
            <span className="font-mono">conf {conf.toFixed(2)}</span>
          </>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-6">
        <h1 className="font-display text-[2.4rem] leading-[1.1] tracking-[-0.012em] text-ink">
          {clientName}
          <span className="display-italic text-graphite text-[1.5rem] ml-3">
            — {caseType ? CASE_LABEL[caseType] : 'matter'}
          </span>
        </h1>
        {assessment && (
          <div
            className={`text-right shrink-0 ${ASSESSMENT_TONE[assessment]}`}
            title="Review assessment"
          >
            <div className="smcp text-[0.62rem] text-graphite">† assessment</div>
            <div className="font-display italic text-[1.15rem] leading-tight">
              {ASSESSMENT_LABEL[assessment] ?? assessment}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function guessClientName(r: IngestResult): string {
  // Try common shapes; fall back to filename.
  const facts = r.caseFacts?.facts;
  if (facts) {
    const candidates = [
      'petitioner_name',
      'beneficiary_name',
      'investor_name',
      'manager_name',
      'researcher_name',
      'name',
    ];
    for (const k of candidates) {
      const v = facts[k];
      if (isFieldLeaf(v) && typeof v.value === 'string') return v.value;
      if (typeof v === 'string') return v;
    }
    // Try nested: petitioner.name
    for (const top of ['petitioner', 'beneficiary', 'investor', 'employer']) {
      const obj = facts[top];
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const inner = (obj as Record<string, unknown>).name;
        if (isFieldLeaf(inner) && typeof inner.value === 'string') return inner.value;
        if (typeof inner === 'string') return inner;
      }
    }
  }
  return trimFilename(r.filename);
}

function DossierTabs({
  tab,
  onTab,
  result,
}: {
  tab: DossierTab;
  onTab: (t: DossierTab) => void;
  result: IngestResult;
}) {
  const tabs: { key: DossierTab; label: string; suffix?: string }[] = [
    { key: 'facts', label: 'Facts' },
    { key: 'memory', label: 'Memory' },
    {
      key: 'draft',
      label: 'Draft',
      suffix: result.draft ? undefined : result.draftError ? '!' : '…',
    },
    {
      key: 'review',
      label: 'Review',
      suffix: result.review
        ? `${result.review.inconsistencies.length + result.review.weak_spots.length}`
        : result.reviewError
          ? '!'
          : '…',
    },
    { key: 'log', label: 'Log' },
  ];
  return (
    <nav className="px-9 border-b border-rule">
      <ul className="flex items-baseline gap-7 -mb-px">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <li key={t.key}>
              <button
                onClick={() => onTab(t.key)}
                className={
                  'pb-3 pt-0.5 border-b-2 transition-colors flex items-baseline gap-1.5 ' +
                  (active
                    ? 'border-rubric text-ink'
                    : 'border-transparent text-graphite hover:text-ink-2')
                }
              >
                <span className="font-display text-[1rem]">{t.label}</span>
                {t.suffix && (
                  <span
                    className={
                      'font-mono text-[0.6rem] ' +
                      (t.suffix === '!' ? 'text-rubric' : 'text-graphite-soft')
                    }
                  >
                    {t.suffix}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ---------------------------------------------------------------------- */
/* Facts pane                                                              */
/* ---------------------------------------------------------------------- */

function FactsPane({ facts }: { facts: Record<string, unknown> }) {
  return (
    <div className="px-9 py-7 grid gap-7 fade-in">
      {Object.entries(facts).map(([key, value]) => (
        <FactSection key={key} label={key} value={value} top />
      ))}
    </div>
  );
}

function humanLabel(s: string) {
  return s.replace(/_/g, ' ');
}

function FactSection({ label, value, top }: { label: string; value: unknown; top?: boolean }) {
  if (isFieldLeaf(value)) {
    return (
      <div>
        <SectionLabel label={label} />
        <FactLine field={value} />
      </div>
    );
  }
  if (Array.isArray(value)) {
    return (
      <div>
        <SectionLabel label={label} count={value.length} />
        {value.length === 0 ? (
          <div className="font-display italic text-graphite text-[0.9rem]">— none on record</div>
        ) : (
          <ol className="grid gap-2.5">
            {value.map((item, i) => (
              <li
                key={i}
                className="grid grid-cols-[2rem_1fr] gap-3 border-b border-rule pb-2.5 last:border-b-0"
              >
                <span className="font-mono text-[0.7rem] text-graphite-soft pt-0.5">
                  {(i + 1).toString().padStart(2, '0')}.
                </span>
                <ArrayItem item={item} />
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return (
      <div>
        <SectionLabel label={label} />
        <dl className="grid grid-cols-[10rem_1fr] gap-x-6 gap-y-2 border-t border-rule pt-2">
          {entries.map(([k, v]) => (
            <FactDefRow key={k} label={k} value={v} />
          ))}
        </dl>
      </div>
    );
  }
  return (
    <div className="text-[0.92rem]">
      <span className="smcp text-[0.62rem] text-graphite mr-2">{humanLabel(label)}</span>
      {String(value)}
    </div>
  );
}

function SectionLabel({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-baseline gap-3 mb-2.5">
      <h3 className="smcp text-[0.7rem] text-rubric">§ {humanLabel(label)}</h3>
      {typeof count === 'number' && (
        <span className="font-mono text-[0.65rem] text-graphite-soft">{count}</span>
      )}
      <div className="flex-1 border-b border-rule translate-y-[-0.32em]" />
    </div>
  );
}

function FactDefRow({ label, value }: { label: string; value: unknown }) {
  if (isFieldLeaf(value)) {
    return (
      <>
        <dt className="smcp text-[0.65rem] text-graphite pt-1">{humanLabel(label)}</dt>
        <dd>
          <FactLine field={value} compact />
        </dd>
      </>
    );
  }
  if (Array.isArray(value)) {
    return (
      <>
        <dt className="smcp text-[0.65rem] text-graphite pt-1">
          {humanLabel(label)}{' '}
          <span className="font-mono normal-case tracking-normal text-graphite-soft">
            ({value.length})
          </span>
        </dt>
        <dd>
          <ol className="grid gap-1.5">
            {value.map((item, i) => (
              <li key={i} className="border-b border-rule pb-1.5 last:border-b-0">
                <ArrayItem item={item} compact />
              </li>
            ))}
          </ol>
        </dd>
      </>
    );
  }
  if (value && typeof value === 'object') {
    return (
      <>
        <dt className="smcp text-[0.65rem] text-graphite pt-1">{humanLabel(label)}</dt>
        <dd>
          <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-1.5">
            {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
              <FactDefRow key={k} label={k} value={v} />
            ))}
          </dl>
        </dd>
      </>
    );
  }
  return (
    <>
      <dt className="smcp text-[0.65rem] text-graphite pt-1">{humanLabel(label)}</dt>
      <dd className="text-[0.9rem]">{String(value)}</dd>
    </>
  );
}

function ArrayItem({ item, compact }: { item: unknown; compact?: boolean }) {
  if (isFieldLeaf(item)) return <FactLine field={item} compact={compact} />;
  if (item && typeof item === 'object') {
    return (
      <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-1">
        {Object.entries(item as Record<string, unknown>).map(([k, v]) => (
          <FactDefRow key={k} label={k} value={v} />
        ))}
      </dl>
    );
  }
  return <span className="text-[0.9rem]">{String(item)}</span>;
}

function FactLine({ field, compact }: { field: FieldProvenance; compact?: boolean }) {
  return (
    <div className={'flex flex-wrap items-baseline gap-x-3 gap-y-0.5 ' + (compact ? '' : 'py-1')}>
      <span className={(compact ? 'text-[0.92rem]' : 'text-[1rem]') + ' text-ink'}>
        {field.value === null ? (
          <span className="text-graphite-soft italic font-display">— none on record</span>
        ) : typeof field.value === 'object' ? (
          JSON.stringify(field.value)
        ) : (
          String(field.value)
        )}
      </span>
      {field.source_page != null && (
        <sup className="cite">
          ¹ p.{field.source_page}
          {field.confidence != null && (
            <>
              {' '}
              · conf {field.confidence.toFixed(2)}
            </>
          )}
        </sup>
      )}
      {field.source_quote && (
        <span className="block w-full font-display italic text-[0.86rem] text-ink-2 mt-0.5 pl-3 border-l-2 border-paper-deep">
          “{field.source_quote}”
        </span>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Draft pane                                                              */
/* ---------------------------------------------------------------------- */

function DraftPane({ result }: { result: IngestResult }) {
  const [copied, setCopied] = useState(false);

  if (result.draftError) {
    return (
      <div className="px-9 py-7">
        <div className="border border-rubric/40 paper-recess p-5">
          <div className="smcp text-[0.7rem] text-rubric mb-2">† draft failed</div>
          <div className="font-mono text-[0.7rem] text-graphite mb-3">
            [{result.draftError.code}]
          </div>
          <div className="font-display italic text-[1rem] text-ink-2">
            {result.draftError.message}
          </div>
        </div>
      </div>
    );
  }

  if (!result.draft) {
    return (
      <div className="px-9 py-12 text-center">
        <div className="dinkus mb-6">⁂</div>
        <p className="font-display italic text-[1.1rem] text-graphite">
          The draft is not yet on the desk.
        </p>
      </div>
    );
  }

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.draft!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  // Split paragraphs for editorial typesetting
  const paragraphs = result.draft.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  return (
    <div className="px-9 py-7 fade-in">
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <div className="smcp text-[0.65rem] text-graphite">¶ cover letter</div>
          <div className="font-display italic text-[0.95rem] text-ink-2">
            drafted in the firm’s voice
          </div>
        </div>
        <button
          onClick={onCopy}
          className="px-3 py-1.5 border border-ink-2 text-[0.78rem] hover:bg-ink hover:text-paper transition-colors smcp"
        >
          {copied ? '✓ copied' : '⁕ copy to clipboard'}
        </button>
      </div>
      <article className="max-w-[68ch] mx-auto bg-paper-2/40 border border-rule px-10 py-9 text-[1.02rem] leading-[1.7] text-ink">
        {paragraphs.map((p, i) => (
          <p
            key={i}
            className={
              'mb-4 last:mb-0 ' + (i === 0 ? 'drop-cap font-display text-[1.06rem]' : '')
            }
          >
            {p.trim()}
          </p>
        ))}
      </article>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Review pane                                                             */
/* ---------------------------------------------------------------------- */

function ReviewPane({ result }: { result: IngestResult }) {
  if (result.reviewError) {
    return (
      <div className="px-9 py-7">
        <div className="border border-rubric/40 paper-recess p-5">
          <div className="smcp text-[0.7rem] text-rubric mb-2">† review failed</div>
          <div className="font-mono text-[0.7rem] text-graphite mb-3">
            [{result.reviewError.code}]
          </div>
          <div className="font-display italic text-[1rem] text-ink-2">
            {result.reviewError.message}
          </div>
        </div>
      </div>
    );
  }

  if (!result.review) {
    return (
      <div className="px-9 py-12 text-center">
        <div className="dinkus mb-6">⁂</div>
        <p className="font-display italic text-[1.1rem] text-graphite">
          The auditor has not yet returned the file.
        </p>
      </div>
    );
  }

  const r = result.review;
  return (
    <div className="px-9 py-7 grid gap-8 fade-in">
      <div>
        <SectionLabel label="summary" />
        <p className="font-display text-[1.08rem] leading-[1.55] text-ink">{r.summary}</p>
      </div>

      <FindingGroup
        glyph="‡"
        title="Inconsistencies"
        count={r.inconsistencies.length}
        emptyText="No inconsistencies between draft and facts."
      >
        {r.inconsistencies.map((f, i) => (
          <FindingCard key={i} severity={f.severity} eyebrow={f.category}>
            <div className="text-[0.95rem] text-ink mb-2">{f.description}</div>
            {f.letter_excerpt && (
              <BlockQuote label="draft">{f.letter_excerpt}</BlockQuote>
            )}
            {f.facts_value && (
              <div className="text-[0.78rem] text-graphite mt-1">
                <span className="smcp text-[0.6rem] text-graphite-soft mr-2">facts</span>
                <span className="font-mono">{f.facts_value}</span>
              </div>
            )}
          </FindingCard>
        ))}
      </FindingGroup>

      <FindingGroup
        glyph="†"
        title="Missing arguments"
        count={r.missing_arguments.length}
        emptyText="All required elements appear to be argued."
      >
        {r.missing_arguments.map((f, i) => (
          <FindingCard key={i} eyebrow={f.element}>
            <div className="text-[0.95rem] text-ink mb-2">{f.description}</div>
            <DefMini label="missing" value={f.what_is_missing} />
            <DefMini label="suggestion" value={f.suggestion} />
          </FindingCard>
        ))}
      </FindingGroup>

      <FindingGroup
        glyph="※"
        title="Weak spots & RFE risks"
        count={r.weak_spots.length}
        emptyText="No notable RFE risks identified."
      >
        {r.weak_spots.map((f, i) => (
          <FindingCard key={i} severity={f.severity} eyebrow={f.element}>
            <div className="text-[0.95rem] text-ink mb-2">{f.description}</div>
            <DefMini label="rfe risk" value={f.rfe_risk} />
            <DefMini label="suggestion" value={f.suggestion} />
          </FindingCard>
        ))}
      </FindingGroup>
    </div>
  );
}

function FindingGroup({
  glyph,
  title,
  count,
  emptyText,
  children,
}: {
  glyph: string;
  title: string;
  count: number;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-3">
        <h3 className="smcp text-[0.72rem] text-rubric">
          {glyph} {title}
        </h3>
        <span className="font-mono text-[0.65rem] text-graphite-soft">({count})</span>
        <div className="flex-1 border-b border-rule translate-y-[-0.32em]" />
      </div>
      {count === 0 ? (
        <p className="font-display italic text-[0.95rem] text-graphite">{emptyText}</p>
      ) : (
        <div className="grid gap-3">{children}</div>
      )}
    </div>
  );
}

const SEVERITY_TONE: Record<string, string> = {
  critical: 'border-l-rubric',
  major: 'border-l-ochre',
  minor: 'border-l-graphite',
};

function FindingCard({
  children,
  severity,
  eyebrow,
}: {
  children: React.ReactNode;
  severity?: string;
  eyebrow?: string;
}) {
  return (
    <div
      className={
        'border border-rule border-l-[3px] paper-recess px-5 py-4 ' +
        (severity ? SEVERITY_TONE[severity] ?? 'border-l-graphite' : 'border-l-graphite')
      }
    >
      <div className="flex items-baseline gap-3 mb-1.5">
        {severity && (
          <span
            className={
              'smcp text-[0.6rem] ' +
              (severity === 'critical' || severity === 'major'
                ? 'text-rubric'
                : 'text-ochre')
            }
          >
            ‡ {severity}
          </span>
        )}
        {eyebrow && (
          <span className="smcp text-[0.6rem] text-graphite">
            {humanLabel(eyebrow)}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function BlockQuote({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-paper-deep pl-3 my-1.5">
      <div className="smcp text-[0.6rem] text-graphite-soft mb-0.5">{label}</div>
      <div className="font-display italic text-[0.92rem] text-ink-2">“{children}”</div>
    </div>
  );
}

function DefMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-3 text-[0.84rem] py-0.5">
      <dt className="smcp text-[0.6rem] text-graphite pt-1">{label}</dt>
      <dd className="text-ink-2">{value}</dd>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Log pane                                                                */
/* ---------------------------------------------------------------------- */

function LogPane({ result }: { result: IngestResult }) {
  const rows: { k: string; v: string }[] = [
    { k: 'filename', v: result.filename },
    { k: 'pages', v: String(result.pageCount) },
  ];
  if (result.caseFacts) rows.push({ k: 'case type', v: CASE_LABEL[result.caseFacts.case_type] });
  if (typeof result.detection_confidence === 'number')
    rows.push({ k: 'detection confidence', v: result.detection_confidence.toFixed(3) });
  if (result.detection_reasoning)
    rows.push({ k: 'detection reasoning', v: result.detection_reasoning });
  if (result.draft) rows.push({ k: 'draft', v: `${result.draft.length} chars` });
  if (result.review)
    rows.push({
      k: 'review findings',
      v: `${result.review.inconsistencies.length} inconsistencies · ${result.review.missing_arguments.length} missing · ${result.review.weak_spots.length} weak spots`,
    });

  return (
    <div className="px-9 py-7 fade-in">
      <SectionLabel label="processing log" />
      <dl className="grid grid-cols-[14rem_1fr] gap-x-6 gap-y-2.5 border-t border-rule pt-3">
        {rows.map((r) => (
          <div key={r.k} className="contents">
            <dt className="smcp text-[0.65rem] text-graphite pt-1">{r.k}</dt>
            <dd className="font-mono text-[0.82rem] text-ink-2 break-all">{r.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Marginalia (right rail)                                                 */
/* ---------------------------------------------------------------------- */

const DOCTRINE: Record<CaseType, { glyph: string; refs: { mark: string; text: string }[] }> = {
  E2: {
    glyph: 'E·II',
    refs: [
      { mark: '§', text: '8 C.F.R. § 214.2(e) — Treaty trader/investor.' },
      { mark: '§', text: '9 FAM 402.9 — Substantiality, marginality, real & operating.' },
      { mark: '¶', text: 'Source-of-funds traceability is the most common RFE driver.' },
    ],
  },
  EB1A: {
    glyph: 'EB·IA',
    refs: [
      { mark: '§', text: '8 C.F.R. § 204.5(h) — Ten regulatory criteria.' },
      { mark: '¶', text: 'Kazarian v. USCIS, 596 F.3d 1115 — Two-step review.' },
      { mark: '¶', text: 'Final merits: sustained acclaim + small percentage at top.' },
    ],
  },
  EB1B: {
    glyph: 'EB·IB',
    refs: [
      { mark: '§', text: '8 C.F.R. § 204.5(i) — Outstanding researcher.' },
      { mark: '¶', text: 'Two of six criteria + international recognition.' },
      { mark: '¶', text: 'Three years of teaching/research experience required.' },
    ],
  },
  EB1C: {
    glyph: 'EB·IC',
    refs: [
      { mark: '§', text: '8 C.F.R. § 204.5(j) — Multinational manager/executive.' },
      { mark: '¶', text: 'Qualifying relationship between US and foreign entity.' },
      { mark: '¶', text: 'One year abroad in last three; managerial capacity in both.' },
    ],
  },
};

function Marginalia({ result, loading }: { result: IngestResult | undefined; loading: boolean }) {
  if (loading || !result) return <MarginaliaIntro />;
  if (result.error) return <MarginaliaIntro />;
  const caseType = result.caseFacts?.case_type;

  return (
    <aside className="border-l border-rule paper-grain min-h-0 overflow-y-auto px-5 py-6 grid gap-7 content-start">
      <MarginaliaBlock title="provenance">
        <ProvenanceSummary result={result} />
      </MarginaliaBlock>

      <MarginaliaBlock title="ai usage · this matter">
        <UsageEstimate result={result} />
      </MarginaliaBlock>

      {caseType && (
        <MarginaliaBlock title="doctrine on file">
          <ul className="grid gap-2.5">
            {DOCTRINE[caseType].refs.map((r, i) => (
              <li key={i} className="flex gap-2 margin-note">
                <span className="text-rubric font-mono text-[0.7rem] shrink-0 pt-0.5">
                  {r.mark}
                </span>
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        </MarginaliaBlock>
      )}

      <MarginaliaBlock title="filing">
        <ul className="grid gap-1.5 margin-note">
          <li className="flex justify-between">
            <span className="text-graphite">Form</span>
            <span className="font-mono">
              {caseType === 'E2' ? 'DS-160 / I-129' : 'I-140'}
            </span>
          </li>
          <li className="flex justify-between">
            <span className="text-graphite">Premium processing</span>
            <span className="font-mono">{caseType === 'E2' ? '—' : 'available'}</span>
          </li>
          <li className="flex justify-between">
            <span className="text-graphite">Adjudication</span>
            <span className="font-mono">USCIS · NSC</span>
          </li>
        </ul>
      </MarginaliaBlock>
    </aside>
  );
}

function MarginaliaIntro() {
  return (
    <aside className="border-l border-rule paper-grain min-h-0 overflow-y-auto px-5 py-6 grid gap-7 content-start">
      <MarginaliaBlock title="the atelier">
        <p className="margin-note">
          A single desk for the firm’s immigration practice. Drop a dossier; the clerk reads it,
          extracts every fact with citation, drafts the cover letter in your voice, and audits the
          draft against the regulations before you read a word.
        </p>
      </MarginaliaBlock>
      <MarginaliaBlock title="practice areas">
        <ul className="grid gap-1.5 margin-note">
          <li className="flex justify-between">
            <span className="font-mono text-graphite">E·II</span>
            <span>Treaty Investor</span>
          </li>
          <li className="flex justify-between">
            <span className="font-mono text-graphite">EB·IA</span>
            <span>Extraordinary Ability</span>
          </li>
          <li className="flex justify-between">
            <span className="font-mono text-graphite">EB·IB</span>
            <span>Outstanding Researcher</span>
          </li>
          <li className="flex justify-between">
            <span className="font-mono text-graphite">EB·IC</span>
            <span>Multinational Manager</span>
          </li>
        </ul>
      </MarginaliaBlock>
      <MarginaliaBlock title="house rules">
        <ol className="grid gap-2 margin-note">
          <li>
            <span className="text-rubric font-mono text-[0.7rem] mr-2">i.</span>
            Every fact carries its citation.
          </li>
          <li>
            <span className="text-rubric font-mono text-[0.7rem] mr-2">ii.</span>
            No claim survives the auditor without an exhibit.
          </li>
          <li>
            <span className="text-rubric font-mono text-[0.7rem] mr-2">iii.</span>
            The PDF stays on this machine.
          </li>
        </ol>
      </MarginaliaBlock>
    </aside>
  );
}

function MarginaliaBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h4 className="smcp text-[0.65rem] text-rubric mb-2 flex items-baseline gap-2">
        <span>※</span>
        <span>{title}</span>
        <span className="flex-1 border-b border-rule translate-y-[-0.3em]" />
      </h4>
      {children}
    </section>
  );
}

function ProvenanceSummary({ result }: { result: IngestResult }) {
  const stats = useMemo(() => {
    const out = { total: 0, withPage: 0, avgConf: 0, conf: 0, confCount: 0 };
    function walk(v: unknown) {
      if (isFieldLeaf(v)) {
        out.total += 1;
        if (v.source_page != null) out.withPage += 1;
        if (typeof v.confidence === 'number') {
          out.conf += v.confidence;
          out.confCount += 1;
        }
      } else if (Array.isArray(v)) {
        v.forEach(walk);
      } else if (v && typeof v === 'object') {
        Object.values(v as Record<string, unknown>).forEach(walk);
      }
    }
    if (result.caseFacts) walk(result.caseFacts.facts);
    out.avgConf = out.confCount > 0 ? out.conf / out.confCount : 0;
    return out;
  }, [result]);

  return (
    <ul className="grid gap-1.5 margin-note">
      <li className="flex justify-between">
        <span className="text-graphite">Facts extracted</span>
        <span className="font-mono">{stats.total}</span>
      </li>
      <li className="flex justify-between">
        <span className="text-graphite">With page citation</span>
        <span className="font-mono">
          {stats.withPage}/{stats.total}
        </span>
      </li>
      <li className="flex justify-between">
        <span className="text-graphite">Mean confidence</span>
        <span className="font-mono">
          {stats.confCount > 0 ? stats.avgConf.toFixed(2) : '—'}
        </span>
      </li>
      <li className="flex justify-between">
        <span className="text-graphite">Case type</span>
        <span className="font-mono">
          {result.caseFacts ? CASE_GLYPH[result.caseFacts.case_type] : '—'}
          {typeof result.detection_confidence === 'number' &&
            ` · ${result.detection_confidence.toFixed(2)}`}
        </span>
      </li>
    </ul>
  );
}

function UsageEstimate({ result }: { result: IngestResult }) {
  // Order-of-magnitude estimate; real cost lives in usage-log.
  const pages = result.pageCount;
  const est = Math.max(0.04, 0.018 * pages + 0.12);
  return (
    <ul className="grid gap-1.5 margin-note">
      <li className="flex justify-between">
        <span className="text-graphite">Pages read</span>
        <span className="font-mono">{pages}</span>
      </li>
      <li className="flex justify-between">
        <span className="text-graphite">Estimated cost</span>
        <span className="font-mono">${est.toFixed(2)}</span>
      </li>
      <li className="flex justify-between">
        <span className="text-graphite">Cache</span>
        <span className="font-mono">1 h TTL</span>
      </li>
    </ul>
  );
}

/* ---------------------------------------------------------------------- */
/* Status bar                                                              */
/* ---------------------------------------------------------------------- */

function StatusBar({
  results,
  loading,
  now,
}: {
  results: IngestResult[];
  loading: boolean;
  now: Date;
}) {
  const totalPages = results.reduce((a, r) => a + (r.pageCount || 0), 0);
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <footer className="px-6 flex items-center justify-between text-[0.7rem] text-graphite font-mono border-t border-rule paper-grain tracking-wide">
      <div className="flex items-center gap-4">
        <span className={loading ? 'text-rubric' : 'text-verdant'}>
          {loading ? '● working' : '○ ready'}
        </span>
        <span className="text-rule-strong">·</span>
        <span>
          {results.length} {results.length === 1 ? 'matter' : 'matters'}
        </span>
        <span className="text-rule-strong">·</span>
        <span>{totalPages} pages</span>
      </div>
      <div className="flex items-center gap-4">
        <span>opus 4.7 · 1m ctx</span>
        <span className="text-rule-strong">·</span>
        <span>{time}</span>
        <span className="text-rule-strong">·</span>
        <span className="smcp">akalan atelier v.0.2</span>
      </div>
    </footer>
  );
}

/* ---------------------------------------------------------------------- */
/* Drag overlay                                                            */
/* ---------------------------------------------------------------------- */

function DragOverlay() {
  return (
    <div
      className="absolute inset-0 pointer-events-none grid place-items-center fade-in"
      style={{ background: 'rgba(241, 233, 214, 0.92)' }}
    >
      <div className="text-center pointer-events-none">
        <div className="dinkus mb-6">⁂</div>
        <div className="font-display italic text-[3rem] text-rubric leading-none">
          Release to deposit.
        </div>
        <div className="mt-4 smcp text-graphite text-[0.78rem]">
          ※ pdfs · folders · exhibits
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Matter overlay — full-viewport, category accordion + PDF preview        */
/* ---------------------------------------------------------------------- */

function MatterOverlay({
  matterName,
  matterRoot,
  result,
  typedMemory,
  selectedEntryKey,
  onSelectEntry,
  entryLabels,
  onSetLabel,
  dashboardOverrides,
  onSetDashboardOverride,
  onClose,
}: {
  matterName: string;
  matterRoot: string | null;
  result: IngestResult | undefined;
  typedMemory: TypedMemory;
  selectedEntryKey: string | null;
  onSelectEntry: (key: string | null) => void;
  entryLabels: Record<string, string>;
  onSetLabel: (key: string, label: string) => void;
  dashboardOverrides: Record<string, string>;
  onSetDashboardOverride: (path: string, value: string) => void;
  onClose: () => void;
}) {
  const buckets = (Object.entries(typedMemory) as [DocType, PerPdfMemoryEntry[]][])
    .filter(([, list]) => Array.isArray(list) && list.length > 0)
    .sort((a, b) => b[1].length - a[1].length);

  const totalEntries = buckets.reduce((acc, [, list]) => acc + list.length, 0);
  const e2Facts =
    result && 'caseFacts' in result && result.caseFacts?.case_type === 'E2'
      ? (result.caseFacts.facts as E2Facts)
      : null;
  const e2Subtype =
    result && 'e2_subtype' in result ? (result.e2_subtype ?? null) : null;

  return (
    <div
      className="fixed inset-0 z-50 paper-grain fade-in flex flex-col"
      style={{ background: 'var(--color-paper)' }}
    >
      <MatterOverlayHeader
        matterName={matterName}
        bucketCount={buckets.length}
        totalEntries={totalEntries}
        onClose={onClose}
      />
      <div className="brass-rule mx-9" />
      <div className="flex-1 overflow-y-auto border-t border-rule">
        <div className="max-w-5xl mx-auto px-9 py-9 space-y-12">
          <MatterDashboard
            e2Facts={e2Facts}
            e2Subtype={e2Subtype}
            ready={!!e2Facts}
            overrides={dashboardOverrides}
            onSet={onSetDashboardOverride}
          />
          <MatterDocumentsSection
            buckets={buckets}
            matterRoot={matterRoot}
            selectedEntryKey={selectedEntryKey}
            onSelectEntry={onSelectEntry}
            entryLabels={entryLabels}
            onSetLabel={onSetLabel}
          />
        </div>
      </div>
    </div>
  );
}

function MatterOverlayHeader({
  matterName,
  bucketCount,
  totalEntries,
  onClose,
}: {
  matterName: string;
  bucketCount: number;
  totalEntries: number;
  onClose: () => void;
}) {
  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center px-9 py-5">
      <div>
        <button
          onClick={onClose}
          className="font-mono text-[0.78rem] text-graphite hover:text-rubric transition-colors smcp tracking-widest flex items-center gap-2"
        >
          <span className="text-[1rem]">←</span>
          <span>back to dossier</span>
        </button>
      </div>
      <div className="text-center">
        <div className="smcp text-[0.62rem] text-graphite-soft tracking-widest mb-1">
          ※ matter
        </div>
        <div className="font-display text-[1.4rem] leading-none">
          {basenameOf(matterName)}
        </div>
      </div>
      <div className="flex items-center justify-end gap-4 font-mono text-[0.7rem] text-graphite tracking-widest">
        <span>{bucketCount} categories</span>
        <span className="text-rule-strong">·</span>
        <span>{totalEntries} documents</span>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------------- */
/* Matter dashboard — editable summary at the top of the overlay           */
/* ---------------------------------------------------------------------- */

function readFieldValue(field: unknown): string | null {
  if (!field || typeof field !== 'object') return null;
  const o = field as Record<string, unknown>;
  if (!('value' in o)) return null;
  if (o.value === null || o.value === undefined) return null;
  return String(o.value);
}

function MatterDashboard({
  e2Facts,
  e2Subtype,
  ready,
  overrides,
  onSet,
}: {
  e2Facts: E2Facts | null;
  e2Subtype: { principal_subtype?: string; procedural_posture?: string } | null;
  ready: boolean;
  overrides: Record<string, string>;
  onSet: (path: string, value: string) => void;
}) {
  if (!ready || !e2Facts) {
    return (
      <section>
        <SectionTitle marker="⁂" label="dashboard" />
        <div className="paper-recess border border-rule px-7 py-10 font-display italic text-[1rem] text-graphite text-center">
          Matter dashboard pending — the aggregator hasn&rsquo;t finished
          reconciling the typed memory yet.
        </div>
      </section>
    );
  }

  const inv = e2Facts.investor;
  const ent = e2Facts.enterprise;
  const investment = e2Facts.investment;
  const sof = e2Facts.source_of_funds;
  const own = e2Facts.ownership_chain;
  const conflicts = e2Facts.conflict_register;

  const investorRows: { path: string; label: string; value: string | null }[] = [
    { path: 'investor.full_name', label: 'Full name', value: readFieldValue(inv.full_name) },
    { path: 'investor.dob', label: 'Date of birth', value: readFieldValue(inv.dob) },
    { path: 'investor.place_of_birth', label: 'Place of birth', value: readFieldValue(inv.place_of_birth) },
    { path: 'investor.nationality', label: 'Nationality', value: readFieldValue(inv.nationality) },
    { path: 'investor.passport_number', label: 'Passport no.', value: readFieldValue(inv.passport_number) },
    { path: 'investor.passport_expiry', label: 'Passport expiry', value: readFieldValue(inv.passport_expiry) },
    { path: 'investor.current_us_status', label: 'US status', value: readFieldValue(inv.current_us_status) },
  ];

  const enterpriseRows: { path: string; label: string; value: string | null }[] = [
    { path: 'enterprise.legal_name', label: 'Legal name', value: readFieldValue(ent.legal_name) },
    { path: 'enterprise.ein', label: 'EIN', value: readFieldValue(ent.ein) },
    { path: 'enterprise.formation_date', label: 'Formation date', value: readFieldValue(ent.formation_date) },
    { path: 'enterprise.state_of_formation', label: 'State of formation', value: readFieldValue(ent.state_of_formation) },
    { path: 'enterprise.entity_type', label: 'Entity type', value: readFieldValue(ent.entity_type) },
    { path: 'enterprise.industry', label: 'Industry', value: readFieldValue(ent.industry) },
    { path: 'enterprise.naics_code', label: 'NAICS code', value: readFieldValue(ent.naics_code) },
    { path: 'enterprise.physical_address', label: 'Physical address', value: readFieldValue(ent.physical_address) },
  ];

  const investmentRows: { path: string; label: string; value: string | null }[] = [
    { path: 'investment.total_committed_usd', label: 'Total committed', value: readFieldValue(investment.total_committed_usd) },
    { path: 'investment.total_spent_usd', label: 'Total spent', value: readFieldValue(investment.total_spent_usd) },
    { path: 'investment.total_cost_of_enterprise_usd', label: 'Total cost of enterprise', value: readFieldValue(investment.total_cost_of_enterprise_usd) },
    { path: 'investment.proportionality_percent', label: 'Proportionality %', value: readFieldValue(investment.proportionality_percent) },
    { path: 'investment.items_count', label: 'Investment line items', value: String(investment.items.length) },
  ];

  const subtypeStr = e2Subtype?.principal_subtype
    ? `${e2Subtype.principal_subtype}${e2Subtype.procedural_posture ? ' · ' + e2Subtype.procedural_posture : ''}`
    : null;
  const subtypeRows: { path: string; label: string; value: string | null }[] = [
    { path: 'meta.subtype', label: 'Sub-type', value: subtypeStr },
    { path: 'meta.case_type', label: 'Case type', value: 'E-2 Treaty Investor' },
  ];

  const criticalConflicts = conflicts.filter((c) => {
    const sev = readFieldValue(c.severity);
    return sev === '4' || sev === '5';
  });

  return (
    <section className="space-y-9">
      <SectionTitle marker="⁂" label="dashboard" />

      <DashboardPanel title="Case meta">
        {subtypeRows.map((r) => (
          <DashboardRow
            key={r.path}
            label={r.label}
            path={r.path}
            extracted={r.value}
            override={overrides[r.path]}
            onSave={onSet}
          />
        ))}
      </DashboardPanel>

      <DashboardPanel title="Investor">
        {investorRows.map((r) => (
          <DashboardRow
            key={r.path}
            label={r.label}
            path={r.path}
            extracted={r.value}
            override={overrides[r.path]}
            onSave={onSet}
          />
        ))}
      </DashboardPanel>

      <DashboardPanel title="Enterprise">
        {enterpriseRows.map((r) => (
          <DashboardRow
            key={r.path}
            label={r.label}
            path={r.path}
            extracted={r.value}
            override={overrides[r.path]}
            onSave={onSet}
          />
        ))}
      </DashboardPanel>

      <DashboardPanel title="Investment">
        {investmentRows.map((r) => (
          <DashboardRow
            key={r.path}
            label={r.label}
            path={r.path}
            extracted={r.value}
            override={overrides[r.path]}
            onSave={onSet}
          />
        ))}
      </DashboardPanel>

      {own.length > 0 && (
        <DashboardPanel title={`Ownership chain · ${own.length}`}>
          <ul className="divide-y divide-rule">
            {own.map((o, i) => (
              <li key={i} className="py-2 grid grid-cols-[1fr_auto_auto] gap-4 items-baseline">
                <div className="font-display text-[0.95rem]">
                  {readFieldValue(o.owner_name) ?? '(unnamed)'}
                </div>
                <div className="font-mono text-[0.78rem] text-graphite">
                  {readFieldValue(o.nationality) ?? '—'}
                </div>
                <div className="font-mono text-[0.85rem] text-ink-2">
                  {readFieldValue(o.ownership_percent) ?? '—'}%
                </div>
              </li>
            ))}
          </ul>
        </DashboardPanel>
      )}

      {sof.length > 0 && (
        <DashboardPanel title={`Source of funds · ${sof.length} chain${sof.length === 1 ? '' : 's'}`}>
          <ul className="space-y-3">
            {sof.map((s, i) => (
              <li key={i} className="border-l-2 border-rule pl-3">
                <div className="font-display text-[0.95rem]">
                  {readFieldValue(s.origin_category) ?? '(category unknown)'}
                  {readFieldValue(s.origin_amount_usd) && (
                    <span className="font-mono text-[0.78rem] text-graphite ml-2">
                      · ${readFieldValue(s.origin_amount_usd)}
                    </span>
                  )}
                </div>
                {readFieldValue(s.origin_evidence) && (
                  <div className="font-mono text-[0.75rem] text-graphite-soft mt-0.5">
                    {readFieldValue(s.origin_evidence)}
                  </div>
                )}
                {readFieldValue(s.notes) && (
                  <div className="font-display italic text-[0.82rem] text-ink-2 mt-1">
                    {readFieldValue(s.notes)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </DashboardPanel>
      )}

      {criticalConflicts.length > 0 && (
        <DashboardPanel title={`Conflicts · ${criticalConflicts.length} flagged for attorney`}>
          <ul className="space-y-2">
            {criticalConflicts.map((c, i) => (
              <li key={i} className="flex items-baseline gap-3">
                <span className="font-mono text-[0.62rem] text-rubric tracking-widest shrink-0">
                  sev {readFieldValue(c.severity)}
                </span>
                <span className="font-display text-[0.88rem] text-ink-2">
                  {readFieldValue(c.description) ?? '(no description)'}
                </span>
              </li>
            ))}
          </ul>
        </DashboardPanel>
      )}
    </section>
  );
}

function SectionTitle({ marker, label }: { marker: string; label: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-5">
      <span className="font-display italic text-[1.1rem] text-rubric">{marker}</span>
      <span className="smcp text-[0.78rem] text-graphite tracking-[0.2em]">
        {label}
      </span>
      <div className="flex-1 border-b border-rule mb-1.5" />
    </div>
  );
}

function DashboardPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="paper-recess border border-rule px-7 py-5">
      <div className="smcp text-[0.7rem] text-rubric tracking-widest mb-3 pb-2 border-b border-rule">
        {title}
      </div>
      {children}
    </div>
  );
}

function DashboardRow({
  label,
  path,
  extracted,
  override,
  onSave,
}: {
  label: string;
  path: string;
  extracted: string | null;
  override: string | undefined;
  onSave: (path: string, value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const display = override ?? extracted;
  const overridden = override !== undefined;

  return (
    <div className="grid grid-cols-[10rem_1fr_auto] gap-4 items-baseline py-1.5">
      <div className="font-mono text-[0.7rem] text-graphite tracking-wide uppercase">
        {label}
      </div>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSave(path, draft);
              setEditing(false);
            } else if (e.key === 'Escape') {
              setEditing(false);
            }
          }}
          className="font-display text-[0.95rem] bg-transparent border-b border-rubric outline-none pb-0.5"
        />
      ) : (
        <div className="font-display text-[0.95rem] text-ink-2 break-words">
          {display ?? <span className="italic text-graphite-soft">not extracted</span>}
          {overridden && (
            <span className="ml-2 font-mono text-[0.6rem] text-ochre tracking-widest">
              edited
            </span>
          )}
        </div>
      )}
      {editing ? (
        <button
          onClick={() => {
            onSave(path, draft);
            setEditing(false);
          }}
          className="font-mono text-[0.62rem] text-rubric tracking-widest smcp hover:text-ink"
        >
          save
        </button>
      ) : (
        <button
          onClick={() => {
            setDraft(display ?? '');
            setEditing(true);
          }}
          className="font-mono text-[0.62rem] text-graphite hover:text-rubric tracking-widest smcp"
        >
          ✎
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Documents accordion — categories + per-doc inline expand                */
/* ---------------------------------------------------------------------- */

function MatterDocumentsSection({
  buckets,
  matterRoot,
  selectedEntryKey,
  onSelectEntry,
  entryLabels,
  onSetLabel,
}: {
  buckets: [DocType, PerPdfMemoryEntry[]][];
  matterRoot: string | null;
  selectedEntryKey: string | null;
  onSelectEntry: (key: string | null) => void;
  entryLabels: Record<string, string>;
  onSetLabel: (key: string, label: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const [t] of buckets) init[t] = false;
    return init;
  });

  return (
    <section>
      <SectionTitle marker="⁂" label="documents · click to preview" />
      <div className="space-y-5">
        {buckets.map(([docType, entries]) => {
          const isCollapsed = !!collapsed[docType];
          return (
            <div key={docType} className="border border-rule paper-recess">
              <button
                onClick={() =>
                  setCollapsed((s) => ({ ...s, [docType]: !s[docType] }))
                }
                className="w-full flex items-baseline justify-between px-5 py-3 group hover:bg-paper-2/50 transition-colors text-left"
              >
                <div className="flex items-baseline gap-3">
                  <span
                    className="font-mono text-[0.78rem] text-graphite-soft transition-transform group-hover:text-rubric"
                    style={{
                      display: 'inline-block',
                      transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                      transformOrigin: '50% 55%',
                      width: '0.8rem',
                    }}
                  >
                    ▶
                  </span>
                  <span className="font-display text-[1.05rem] group-hover:text-rubric transition-colors">
                    {DOC_TYPE_LABEL[docType]}
                  </span>
                  <span className="font-mono text-[0.65rem] text-graphite tracking-widest">
                    {entries.length}
                  </span>
                </div>
                <span className="font-mono text-[0.6rem] text-graphite-soft tracking-widest">
                  {docType}
                </span>
              </button>
              {!isCollapsed && (
                <ul className="border-t border-rule">
                  {entries.map((e) => {
                    const key = entryKey(docType, e.filename);
                    const expanded = selectedEntryKey === key;
                    const label = entryLabels[key] ?? getSuggestedDocLabel(e);
                    return (
                      <li key={key} className="border-b border-rule last:border-b-0">
                        <button
                          onClick={() => onSelectEntry(expanded ? null : key)}
                          className={
                            'w-full text-left flex items-baseline gap-3 px-5 py-2.5 transition-colors group ' +
                            (expanded
                              ? 'bg-paper-2/40'
                              : 'hover:bg-paper-2/30')
                          }
                        >
                          <span
                            className="font-mono text-[0.62rem] text-graphite-soft shrink-0"
                            style={{
                              display: 'inline-block',
                              transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                              transformOrigin: '50% 55%',
                              width: '0.7rem',
                            }}
                          >
                            ▶
                          </span>
                          <div className="flex-1 min-w-0">
                            <div
                              className={
                                'font-display text-[0.92rem] truncate ' +
                                (expanded ? 'text-rubric' : 'text-ink-2 group-hover:text-rubric')
                              }
                              title={label}
                            >
                              {label}
                            </div>
                            <div
                              className="font-mono text-[0.62rem] text-graphite-soft truncate"
                              title={e.filename}
                            >
                              {basenameOf(e.filename)}
                            </div>
                          </div>
                          {e.error && (
                            <span className="shrink-0 font-mono text-[0.6rem] text-rubric tracking-widest">
                              error
                            </span>
                          )}
                        </button>
                        {expanded && (
                          <DocumentInlinePreview
                            entry={e}
                            entryKeyValue={key}
                            docType={docType}
                            matterRoot={matterRoot}
                            label={label}
                            onSetLabel={onSetLabel}
                            overridden={entryLabels[key] !== undefined}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DocumentInlinePreview({
  entry,
  entryKeyValue,
  docType,
  matterRoot,
  label,
  onSetLabel,
  overridden,
}: {
  entry: PerPdfMemoryEntry;
  entryKeyValue: string;
  docType: DocType;
  matterRoot: string | null;
  label: string;
  onSetLabel: (key: string, value: string) => void;
  overridden: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const absPath = matterRoot
    ? `${matterRoot}${matterRoot.endsWith('/') ? '' : '/'}${entry.filename}`
    : null;
  const pdfSrc = absPath
    ? `/api/file?path=${encodeURIComponent(absPath)}`
    : null;

  return (
    <div className="px-5 py-5 border-t border-rule space-y-5 bg-paper">
      <div>
        {editing ? (
          <div className="flex items-baseline gap-3">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (draft.trim()) onSetLabel(entryKeyValue, draft.trim());
                  setEditing(false);
                } else if (e.key === 'Escape') {
                  setEditing(false);
                }
              }}
              className="flex-1 font-display italic text-[1.25rem] bg-transparent border-b border-rubric outline-none pb-1"
            />
            <button
              onClick={() => {
                if (draft.trim()) onSetLabel(entryKeyValue, draft.trim());
                setEditing(false);
              }}
              className="font-mono text-[0.62rem] text-rubric tracking-widest smcp hover:text-ink"
            >
              save
            </button>
          </div>
        ) : (
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display italic text-[1.25rem] leading-tight">
              {label}
            </h3>
            <button
              onClick={() => {
                setDraft(label);
                setEditing(true);
              }}
              className="shrink-0 font-mono text-[0.62rem] text-graphite hover:text-rubric tracking-widest smcp"
            >
              ✎ rename
            </button>
          </div>
        )}
        <div className="mt-1 font-mono text-[0.65rem] text-graphite-soft truncate" title={entry.filename}>
          {DOC_TYPE_LABEL[docType]} · {entry.filename}
          {!overridden && (
            <span className="ml-2 text-rule-strong">(auto-named)</span>
          )}
        </div>
      </div>

      {pdfSrc ? (
        <div className="border border-rule paper-recess">
          <iframe
            src={pdfSrc}
            title={label}
            className="w-full"
            style={{ height: '60vh', border: 0 }}
          />
        </div>
      ) : (
        <div className="border border-rule paper-recess px-5 py-12 text-center font-display italic text-graphite">
          PDF preview unavailable — matter root not set.
        </div>
      )}

      <div>
        <div className="smcp text-[0.62rem] text-graphite-soft tracking-widest mb-2">
          ⁂  facts
        </div>
        {entry.error ? (
          <div className="font-mono text-[0.78rem] text-rubric">
            error · {entry.error.code}: {entry.error.message}
          </div>
        ) : entry.facts ? (
          <MemoryFactsList facts={entry.facts} />
        ) : (
          <div className="font-display italic text-[0.85rem] text-graphite-soft">
            No facts extracted.
          </div>
        )}
      </div>
    </div>
  );
}
