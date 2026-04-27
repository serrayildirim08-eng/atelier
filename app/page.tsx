'use client';

import { Fragment, useCallback, useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { DragEvent, ChangeEvent } from 'react';
import type { ReviewReport } from '@/reason';
import type { CaseType, E2Facts } from '@/ingest';
import {
  PreGenerationApprovalModal,
  type ApprovalResult,
} from '@/app/components/pre-generation-approval';
import type { PreviewGenerator } from '@/lib/preview-store';
import { DOC_TYPE_TO_TAB } from '@/draft/exhibit-list';
import type { Tab as ExhibitTabKey } from '@/draft/exhibit-list';
import {
  LoadingProgress,
  type LoadingStreamEvent,
} from '@/app/components/loading-progress';

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

type DossierTab = 'facts' | 'exhibits' | 'draft' | 'review' | 'log';

interface IngestProgress {
  stage: string;
  label: string;
  pdfCount: number;
}

type DocType =
  | 'passport'
  | 'status_doc'
  | 'i94'
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
  | 'employer_letter'
  | 'cv_or_resume'
  | 'financial_statement'
  | 'credential'
  | 'vital_record'
  | 'title_deed'
  | 'government_id'
  | 'translation_certification'
  | 'other';

const DOC_TYPE_LABELS: Record<DocType, string> = {
  passport: 'Passport',
  status_doc: 'US status / visa stamp / I-797 / EAD',
  i94: 'CBP I-94 record',
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
  employer_letter: 'Employer letter / verification of employment',
  cv_or_resume: 'CV / resume',
  financial_statement: 'Financial statement',
  credential: 'Diploma / certification / license',
  vital_record: 'Birth / marriage / divorce certificate',
  title_deed: 'Title deed / Tapu',
  government_id: 'National ID / driver’s license',
  translation_certification: 'Translation certification',
  other: 'Other',
};

// Backwards-compat alias for any old call sites that still reference the
// singular form. New code should use DOC_TYPE_LABELS.
const DOC_TYPE_LABEL = DOC_TYPE_LABELS;

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

/**
 * Four-tier status pill styling. Hierarchy is carried by fill / border
 * weight / type weight — no semantic color. NOT_READY is the visual
 * anchor (full inverse jet); READY is the quietest (paper with a 20%
 * jet hairline). Both compact (sidebar row) and full (overlay header)
 * sizes share the same color/border vocabulary; only padding + font-
 * size differ. See manual ASSESSMENT_LABEL for the human strings.
 */
const ASSESSMENT_PILL: Record<
  string,
  { container: string; text: string }
> = {
  not_ready: {
    container: 'bg-ink text-paper border border-ink',
    text: 'font-bold',
  },
  major_revisions: {
    container: 'bg-paper text-ink border-[1.5px] border-ink',
    text: 'font-bold',
  },
  minor_revisions: {
    container: 'bg-paper text-ink border border-ink/45',
    text: 'font-semibold',
  },
  ready: {
    container: 'bg-paper text-graphite border border-ink/20',
    text: 'font-medium',
  },
};

function StatusPill({
  assessment,
  size = 'compact',
}: {
  assessment: string;
  size?: 'compact' | 'full';
}) {
  const style = ASSESSMENT_PILL[assessment];
  const label = ASSESSMENT_LABEL[assessment] ?? assessment;
  if (!style) {
    return (
      <span className="smcp text-[0.6rem] text-graphite">{label}</span>
    );
  }
  const sizing =
    size === 'full'
      ? 'px-3 py-1.5 text-[0.7rem] tracking-[0.22em]'
      : 'px-2 py-0.5 text-[0.55rem] tracking-[0.18em]';
  return (
    <span
      className={`inline-flex items-center font-mono uppercase ${sizing} ${style.container} ${style.text}`}
    >
      {label}
    </span>
  );
}

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
  // In-flight draft text streamed from the route during Phase 3. Cleared
  // when the closing `result` event lands (which carries the server-
  // authoritative final draft). DraftPane reads result.draft ?? this.
  const [streamingDraft, setStreamingDraft] = useState<string>('');
  // Full event stream accumulator powering <LoadingProgress/>: every NDJSON
  // line received from /api/ingest-path is pushed in order; the component
  // reduces it into rows + stage-strip state. Reset on each new ingest.
  const [streamEvents, setStreamEvents] = useState<LoadingStreamEvent[]>([]);
  const [streamStartedAt, setStreamStartedAt] = useState<number | null>(null);
  const router = useRouter();

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

  // Persist matters across page refreshes. The binder rail (left) reads
  // results[] — without this, every Cmd+R wipes the user's case list.
  // localStorage cap is ~5MB; ~14KB per matter (incl. draft) → 200+ cases
  // before bumping into the limit, which is past any solo firm's volume.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('akalan:matters:v1');
      if (!raw) return;
      const stored = JSON.parse(raw) as IngestResult[];
      if (Array.isArray(stored) && stored.length > 0) {
        setResults(stored);
        setSelectedIdx(0);
      }
    } catch {
      /* ignore — corrupt storage just means the binder starts empty */
    }
  }, []);

  useEffect(() => {
    if (results.length === 0) return;
    try {
      localStorage.setItem('akalan:matters:v1', JSON.stringify(results));
    } catch {
      /* localStorage full or disabled — non-fatal, just skip persistence */
    }
  }, [results]);

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
    setStreamingDraft('');
    setStreamEvents([]);
    setStreamStartedAt(Date.now());

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
      let matterId: string | null = null;

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
          // Mirror every event into the LoadingProgress accumulator before
          // dispatching to the legacy reducers. The component reduces the
          // full sequence into the typewriter rows + stage strip.
          setStreamEvents((prev) => [...prev, evt as unknown as LoadingStreamEvent]);
          if (evt.type === 'start') {
            pdfCount = (evt.total as number) ?? 0;
            matterId = (evt.matter as string) ?? null;
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
          } else if (evt.type === 'draft_delta') {
            // Streaming draft: accumulate into a sidecar state. The
            // closing `result` event lands with the server-authoritative
            // assembled draft, at which point the streaming buffer is
            // cleared. DraftPane reads result.draft ?? streamingDraft so
            // the user sees text as it's written.
            const delta = (evt.delta as string) ?? '';
            if (delta) setStreamingDraft((prev) => prev + delta);
          } else if (evt.type === 'draft_done') {
            // No-op for now — the closing `result` event arrives shortly
            // with the full assembled draft and clears streamingDraft.
          } else if (evt.type === 'draft_error') {
            // The closing `result` event will carry the draftError too;
            // we don't need to mutate state here. Keeping the branch so
            // unknown-event-type warnings stay quiet.
          } else if (evt.type === 'result') {
            collected.push(evt.result as IngestResult);
            setResults([...collected]);
            setStreamingDraft('');
            if (collected.length === 1) setSelectedIdx(0);
          } else if (evt.type === 'done') {
            setProgress(null);
            // Auto-navigation to /matter/<id> disabled: that route reads
            // the hardcoded mock from getMockMatter() and would clobber
            // the real ingest result sitting in client state. Stay on
            // home — the Dossier component already renders results[0]
            // with the real extracted facts / draft / review.
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
  }, [router]);

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
          streamingDraft={streamingDraft}
        />
        <Marginalia
          result={selected}
          results={results}
          loading={loading}
          streamingDraft={streamingDraft}
        />
      </main>

      <StatusBar results={results} loading={loading} now={now} />

      {dragActive && <DragOverlay />}

      {loading && streamStartedAt !== null && (
        <div className="fixed inset-0 z-40 paper-grain overflow-y-auto">
          <div className="max-w-[80rem] mx-auto px-10 py-12">
            <LoadingProgress
              events={streamEvents}
              startedAt={streamStartedAt}
            />
          </div>
        </div>
      )}

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
    <header className="grid grid-cols-[1fr_auto_1fr] items-center px-6 paper-grain border-b-[1.5px] border-ink">
      <div className="flex items-center">
        <span className="font-display text-[46px] font-semibold tracking-[-0.035em] text-ink leading-none">
          atelier<span className="italic">.</span>
        </span>
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
      <div className="px-5 pt-6 pb-4">
        <div className="smcp text-graphite-soft mb-1">my matters</div>
        <div className="text-title leading-tight">
          {results.length === 0
            ? 'No active matters.'
            : `${results.length} ${results.length === 1 ? 'matter' : 'matters'} on the desk`}
        </div>
      </div>

      <div className="border-t border-rule" />

      <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
        {loading && <BinderLoadingRow progress={progress} perPdfCount={perPdfCount} />}
        {!loading && results.length === 0 && (
          <div className="px-3 py-6 text-body text-graphite leading-relaxed">
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
            className="block text-center px-3 py-2 border border-ink-2 cursor-pointer hover:bg-ink hover:text-paper transition-colors smcp"
          >
            create new matter
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
            <span className="block text-center px-3 py-2 border border-ink-2 cursor-pointer hover:bg-ink hover:text-paper transition-colors smcp">
              create new matter
            </span>
          </label>
        )}
        <div className="label-quiet text-graphite-soft text-center">
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
      <div className="smcp text-ink mb-2">working</div>
      {progress ? (
        <>
          <div className="label-quiet text-graphite mb-1 uppercase">{progress.stage}</div>
          <div className="text-body text-ink-2 leading-snug">{progress.label}</div>
          {showCount && progress.stage === 'classifying' && (
            <div className="mt-2 font-mono text-meta text-ink-2 tabular-nums">
              {perPdfCount.done} / {perPdfCount.total}
            </div>
          )}
        </>
      ) : (
        <div className="text-body text-ink-2 leading-snug">
          Detecting case type… extracting facts… drafting… reviewing.
        </div>
      )}
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
        <div className="text-body leading-snug truncate">
          {trimFilename(result.filename)}
        </div>
        {caseType && (
          <span className="font-mono text-meta text-graphite shrink-0">
            {CASE_GLYPH[caseType]}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-meta text-graphite-soft">
        {isError ? (
          <span className="smcp text-ink">error</span>
        ) : caseType ? (
          <>
            <span className="font-mono tabular-nums">{result.pageCount}p</span>
            <span className="text-rule-strong">·</span>
            <span className="truncate">{CASE_LABEL[caseType]}</span>
          </>
        ) : (
          <span className="smcp">pending</span>
        )}
      </div>
      {assessment && (
        <div className="mt-1.5">
          <StatusPill assessment={assessment} size="compact" />
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
  streamingDraft,
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
  streamingDraft?: string;
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
        {tab === 'facts' && (
          <FactsPane
            facts={result.caseFacts.facts}
            typedMemory={typedMemory}
            matterId={result.filename}
          />
        )}
        {tab === 'exhibits' && (
          <MemoryPane
            typedMemory={typedMemory}
            matterRoot={matterRoot}
            entryLabels={entryLabels}
            onOpenMatter={onOpenMatter}
            matterId={result.filename}
            caseFacts={result.caseFacts}
          />
        )}
        {tab === 'draft' && (
          <DraftPane
            result={result}
            streamingDraft={streamingDraft}
            typedMemory={typedMemory}
            matterRoot={matterRoot}
          />
        )}
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
      <div className="smcp text-graphite-soft mb-1">building typed memory</div>
      <h1 className="text-title leading-snug">
        Classifying {perPdfCount.done} of {perPdfCount.total} documents
      </h1>
      <p className="text-body text-graphite mt-2 leading-relaxed">
        Each PDF is sorted into its document type and its facts read into memory.
        The aggregator runs once every PDF is in.
      </p>
    </header>
  );
}

/**
 * 8-category exhibits taxonomy. Maps the 26 raw doc_type buckets into
 * the firm's filing structure. Each category surfaces:
 *   - the documents that landed in it (display_name + raw filename)
 *   - one or more Generate buttons for the artifacts that section drives
 *
 * Generators are wired by name to the existing preview → approve API
 * (lib/preview-builders + app/api/matter/[id]/preview / approve). Until
 * the home-page's freshly-ingested matter is plumbed into that API, the
 * Generate buttons surface as "(open matter to generate)" prompts.
 */
type ExhibitCategoryKey =
  | 'applicant'
  | 'company'
  | 'business_plan'
  | 'cover_letter'
  | 'source_of_funds'
  | 'operational'
  | 'forms_letters'
  | 'employees'
  | 'unassigned';

interface ExhibitCategorySpec {
  key: ExhibitCategoryKey;
  label: string;
  doc_types: DocType[];
  generators: { generator: string; label: string }[];
}

const EXHIBIT_CATEGORIES: ExhibitCategorySpec[] = [
  {
    key: 'applicant',
    label: '1 · Applicant Documents',
    doc_types: ['passport', 'status_doc', 'i94', 'government_id', 'vital_record', 'credential', 'cv_or_resume'],
    generators: [
      { generator: 'declaration_beneficiary', label: 'Generate · Beneficiary declaration' },
      { generator: 'declaration_spouse', label: 'Generate · Spouse declaration' },
      { generator: 'noid_principal', label: 'Generate · NoID (principal)' },
      { generator: 'noid_dependent', label: 'Generate · NoID (dependent)' },
    ],
  },
  {
    key: 'company',
    label: '2 · Company Documents',
    doc_types: ['formation_doc', 'ownership_evidence'],
    generators: [
      { generator: 'declaration_enterprise_rep', label: 'Generate · Enterprise rep declaration' },
    ],
  },
  {
    key: 'business_plan',
    label: '3 · Business Plan',
    doc_types: ['business_plan'],
    generators: [],
  },
  {
    key: 'cover_letter',
    label: '4 · Cover Letter',
    doc_types: ['cover_letter'],
    generators: [
      { generator: 'cover_letter', label: 'Generate · Cover letter' },
    ],
  },
  {
    key: 'source_of_funds',
    label: '5 · Source of Funds',
    doc_types: ['source_of_funds', 'title_deed', 'money_movement', 'bank_statement'],
    generators: [],
  },
  {
    key: 'operational',
    label: '6 · Operational Documents',
    doc_types: ['lease_or_property', 'invoice_or_receipt', 'financial_statement', 'business_contract', 'tax_doc'],
    generators: [],
  },
  {
    key: 'forms_letters',
    label: '7 · Forms and Letters',
    doc_types: ['uscis_or_dos_form', 'expert_letter'],
    generators: [
      { generator: 'forms_i129', label: 'Fill · I-129' },
      { generator: 'forms_i129e', label: 'Fill · I-129E' },
      { generator: 'forms_g28', label: 'Fill · G-28' },
      { generator: 'forms_i539', label: 'Fill · I-539 (spouse)' },
      { generator: 'forms_i539a', label: 'Fill · I-539A (child)' },
      { generator: 'exhibit_list', label: 'Generate · Exhibit list' },
    ],
  },
  {
    key: 'employees',
    label: '8 · Employee Documents',
    doc_types: ['payroll_doc', 'employer_letter'],
    generators: [],
  },
  {
    key: 'unassigned',
    label: 'Unassigned · Attorney sort',
    doc_types: ['translation_certification', 'other'],
    generators: [],
  },
];

function MemoryPane({
  typedMemory,
  matterRoot,
  entryLabels,
  onOpenMatter,
  matterId,
  caseFacts,
}: {
  typedMemory: TypedMemory;
  matterRoot: string | null;
  entryLabels: Record<string, string>;
  onOpenMatter: () => void;
  /** Used as the matter_id in /api/matter/[id]/{preview,approve} calls. */
  matterId?: string;
  /** Live caseFacts forwarded to the approval flow. */
  caseFacts?: unknown;
}) {
  // Compute the per-category aggregated entries from the raw doc_type
  // buckets. Empty categories still render so the firm's taxonomy is
  // visible at a glance — the dossier *should* show "Business Plan: 0
  // documents — drop one in" rather than hide the heading.
  const categoryEntries: { spec: ExhibitCategorySpec; entries: { docType: DocType; entry: PerPdfMemoryEntry }[] }[] =
    EXHIBIT_CATEGORIES.map((spec) => {
      const flat: { docType: DocType; entry: PerPdfMemoryEntry }[] = [];
      for (const dt of spec.doc_types) {
        const list = typedMemory[dt];
        if (!list) continue;
        for (const e of list) flat.push({ docType: dt, entry: e });
      }
      return { spec, entries: flat };
    });

  const populated = categoryEntries.filter((c) => c.entries.length > 0);
  const totalEntries = populated.reduce((acc, c) => acc + c.entries.length, 0);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [openGenerator, setOpenGenerator] = useState<PreviewGenerator | null>(null);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [recentOutput, setRecentOutput] = useState<{
    generator: PreviewGenerator;
    output_path: string | null;
    output_inline: string | null;
    approved_at: string;
  } | null>(null);

  if (totalEntries === 0) {
    return (
      <div className="px-9 py-12 font-display italic text-[0.95rem] text-graphite">
        Exhibits are empty. PDFs will appear here as they are classified.
      </div>
    );
  }

  return (
    <div className="px-9 py-7 space-y-5">
      <button
        onClick={onOpenMatter}
        className="w-full flex items-baseline justify-between border border-ink-2 paper-recess px-5 py-3 hover:bg-ink hover:text-paper transition-colors group"
      >
        <span className="font-display italic text-[1rem] group-hover:not-italic">
          Open the matter
        </span>
        <span className="font-mono text-[0.7rem] tracking-widest text-graphite group-hover:text-paper-2">
          {populated.length} sections · {totalEntries} documents →
        </span>
      </button>

      {categoryEntries.map(({ spec, entries }) => (
        <ExhibitCategoryCard
          key={spec.key}
          spec={spec}
          entries={entries}
          collapsed={!!collapsed[spec.key]}
          onToggle={() => setCollapsed((s) => ({ ...s, [spec.key]: !s[spec.key] }))}
          entryLabels={entryLabels}
          onOpenMatter={onOpenMatter}
          onPickGenerator={(g) => setOpenGenerator(g)}
          onPickDocument={
            matterRoot
              ? (filename) => {
                  // matterRoot is the absolute folder path; entry.filename
                  // is relative inside it. Concat to get the absolute PDF
                  // path the /api/file proxy expects.
                  const sep = matterRoot.endsWith('/') ? '' : '/';
                  setPreviewPath(`${matterRoot}${sep}${filename}`);
                }
              : undefined
          }
        />
      ))}

      {recentOutput && (
        <section className="border border-rule paper-recess">
          <header className="px-5 py-3 border-b border-rule-strong">
            <span className="smcp text-[0.65rem] text-rubric tracking-[0.22em]">
              ⁂  recent output
            </span>
            <span className="ml-3 font-display italic text-[0.85rem] text-graphite">
              {recentOutput.generator.replace(/_/g, ' ')} · {new Date(recentOutput.approved_at).toLocaleString()}
            </span>
          </header>
          <div className="px-5 py-4 font-mono text-[0.7rem]">
            {recentOutput.output_path && (
              <div className="text-graphite mb-2 break-all">
                → {recentOutput.output_path}
              </div>
            )}
            {recentOutput.output_inline && (
              <details>
                <summary className="cursor-pointer text-graphite">
                  ▸ view inline ({recentOutput.output_inline.length.toLocaleString()} chars)
                </summary>
                <pre className="mt-2 whitespace-pre-wrap text-[0.7rem] bg-ink-2/5 p-3 max-h-96 overflow-y-auto">
                  {recentOutput.output_inline}
                </pre>
              </details>
            )}
          </div>
        </section>
      )}

      {matterId && (
        <PreGenerationApprovalModal
          open={openGenerator !== null}
          matterId={matterId}
          generator={openGenerator ?? 'cover_letter'}
          // Merge attorney-intake (phone/email/address) into caseFacts
          // before the modal POSTs them. Empty intake fields don't
          // overwrite extracted values.
          caseFacts={
            caseFacts && (caseFacts as { facts?: unknown }).facts
              ? mergeIntakeIntoCaseFacts(
                  caseFacts as { facts: { investor?: unknown } },
                  readIntakeForm(matterId),
                )
              : caseFacts
          }
          typedMemory={typedMemory}
          onClose={() => setOpenGenerator(null)}
          onApproved={(result: ApprovalResult) => {
            if (openGenerator) {
              setRecentOutput({
                generator: openGenerator,
                output_path: result.output_path,
                output_inline: result.output_inline,
                approved_at: result.preview.approved_at ?? new Date().toISOString(),
              });
            }
          }}
        />
      )}

      {previewPath && (
        <DocumentPreviewModal path={previewPath} onClose={() => setPreviewPath(null)} />
      )}
    </div>
  );
}

function DocumentPreviewModal({ path, onClose }: { path: string; onClose: () => void }) {
  const filename = path.split('/').pop() ?? path;
  const fileSrc = `/api/file?path=${encodeURIComponent(path)}`;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-paper w-full max-w-5xl h-[90vh] flex flex-col border border-graphite/30 shadow-xl"
      >
        <div className="px-6 py-3 border-b border-graphite/20 flex items-baseline justify-between">
          <div>
            <div className="smcp text-[0.65rem] text-graphite">¶ document preview</div>
            <div className="font-display italic text-[1.05rem] text-ink-2 truncate max-w-2xl">
              {filename}
            </div>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[0.7rem] text-graphite hover:text-ink-2"
          >
            [×] close
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <iframe
            src={fileSrc}
            className="w-full h-full"
            title={filename}
          />
        </div>
      </div>
    </div>
  );
}

function ExhibitCategoryCard({
  spec,
  entries,
  collapsed,
  onToggle,
  entryLabels,
  onOpenMatter,
  onPickGenerator,
  onPickDocument,
}: {
  spec: ExhibitCategorySpec;
  entries: { docType: DocType; entry: PerPdfMemoryEntry }[];
  collapsed: boolean;
  onToggle: () => void;
  entryLabels: Record<string, string>;
  onOpenMatter: () => void;
  onPickGenerator?: (g: PreviewGenerator) => void;
  onPickDocument?: (filename: string) => void;
}) {
  const empty = entries.length === 0;
  return (
    <section className="border border-rule paper-recess">
      <button
        onClick={onToggle}
        className="w-full flex items-baseline justify-between px-5 py-3 group hover:bg-ink/5 transition-colors text-left"
      >
        <div className="flex items-baseline gap-3">
          <span className="font-display italic text-[1.05rem] text-ink-2">
            {spec.label}
          </span>
          <span className="font-mono text-[0.7rem] text-graphite-soft tracking-wider">
            {empty ? '—' : `${entries.length} doc${entries.length === 1 ? '' : 's'}`}
          </span>
        </div>
        <span className="font-mono text-[0.7rem] text-graphite group-hover:text-ink-2">
          {collapsed ? '▸' : '▾'}
        </span>
      </button>

      {!collapsed && (
        <div className="px-5 pb-5 pt-1 space-y-4">
          {empty ? (
            <div className="font-display italic text-[0.85rem] text-graphite-soft px-2">
              No documents in this category yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {entries.map(({ docType, entry }, i) => {
                const display =
                  entryLabels[entry.filename] ||
                  ((entry.facts as { display_name?: { value?: string } } | null | undefined)?.display_name?.value as string | undefined) ||
                  ((entry.facts as { suggested_filename?: { value?: string } } | null | undefined)?.suggested_filename?.value as string | undefined) ||
                  entry.filename;
                const clickable = !!onPickDocument;
                return (
                  <li
                    key={`${entry.filename}-${i}`}
                    onClick={clickable ? () => onPickDocument(entry.filename) : undefined}
                    className={`border-l-2 border-rule pl-3 py-1.5 hover:border-ink-2 transition-colors ${
                      clickable ? 'cursor-pointer hover:bg-ink/5' : ''
                    }`}
                    title={clickable ? 'Click to preview the PDF' : undefined}
                  >
                    <div
                      className={`font-display text-[0.9rem] ${clickable ? 'text-blue-700 hover:underline' : 'text-ink-2'}`}
                    >
                      {display}
                    </div>
                    <div className="font-mono text-[0.65rem] text-graphite-soft truncate">
                      {DOC_TYPE_LABELS[docType] ?? docType} · {entry.filename}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {spec.generators.length > 0 && (
            <div className="border-t border-rule pt-3 flex flex-wrap gap-2">
              {spec.generators.map((g) => (
                <button
                  key={g.generator}
                  onClick={() => {
                    if (onPickGenerator) {
                      onPickGenerator(g.generator as PreviewGenerator);
                    } else {
                      onOpenMatter();
                    }
                  }}
                  title="Opens the preview → approve modal. NO output ships without attorney sign-off."
                  className="text-[0.72rem] font-mono px-3 py-1.5 border border-ink-2 hover:bg-ink hover:text-paper transition-colors smcp"
                >
                  {g.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
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
  const caseTypes = [
    ['E·II', 'Treaty Investor'],
    ['EB·IA', 'Extraordinary Ability'],
    ['EB·IB', 'Outstanding Researcher'],
    ['EB·IC', 'Multinational Manager'],
  ] as const;
  return (
    <section className="min-h-0 grid place-items-center paper-grain px-12">
      <div className="max-w-[560px] text-center">
        <h1 className="text-display leading-[1.05] tracking-[-0.01em]">
          Drop a dossier.
        </h1>
        <p className="mt-5 text-lede text-ink-2 leading-relaxed">
          PDFs, folders, exhibits &mdash; anything bound for USCIS.
        </p>
        <div className="mt-10 grid grid-cols-4 gap-x-4 gap-y-2 border-t border-b border-rule py-5">
          {caseTypes.map(([glyph, label]) => (
            <div key={glyph} className="grid gap-1">
              <div className="font-mono text-meta text-graphite">{glyph}</div>
              <div className="text-meta text-graphite-soft">{label}</div>
            </div>
          ))}
        </div>
        <p className="mt-8 text-body text-graphite leading-relaxed">
          The clerk reads each file end to end, identifies the case type, extracts every fact
          with provenance, drafts the cover letter in the firm&rsquo;s voice, and audits the draft
          for inconsistency and RFE risk before you set eyes on it.
        </p>
      </div>
    </section>
  );
}

function DossierLoading() {
  return (
    <section className="min-h-0 grid place-items-center paper-grain px-12">
      <div className="max-w-[480px] text-center fade-in">
        <h2 className="text-title text-ink leading-snug">The clerk is reading the file.</h2>
        <ol className="mt-10 grid gap-2 text-left">
          <LoadingStep n="01" label="detecting case type" />
          <LoadingStep n="02" label="extracting facts with citation" />
          <LoadingStep n="03" label="drafting the cover letter" />
          <LoadingStep n="04" label="reviewing for inconsistency & RFE risk" />
        </ol>
        <div className="mt-10 label-quiet text-graphite-soft">2&ndash;4 min per file</div>
      </div>
    </section>
  );
}

function LoadingStep({ n, label }: { n: string; label: string }) {
  return (
    <li className="flex items-baseline gap-4 border-b border-rule pb-2.5">
      <span className="font-mono text-meta text-graphite tabular-nums w-7 shrink-0">{n}</span>
      <span className="text-body text-ink-2">{label}</span>
    </li>
  );
}

function DossierError({ result }: { result: IngestResult }) {
  return (
    <section className="min-h-0 grid place-items-center px-12 paper-grain">
      <div className="max-w-[520px] border border-rule-strong paper-recess p-8 fade-up">
        <div className="smcp text-ink mb-3">extraction failed</div>
        <div className="text-title leading-snug mb-1">{result.filename}</div>
        <div className="font-mono text-meta text-graphite mb-4">[{result.error?.code}]</div>
        <div className="text-body text-ink-2 leading-relaxed">{result.error?.message}</div>
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
      <div className="flex items-center gap-3 font-mono text-meta text-graphite mb-3">
        <span className="truncate">{result.filename}</span>
        <span className="text-rule-strong">·</span>
        <span className="tabular-nums">{result.pageCount} pp</span>
        {caseType && (
          <>
            <span className="text-rule-strong">·</span>
            <span>{CASE_GLYPH[caseType]}</span>
          </>
        )}
        {typeof conf === 'number' && (
          <>
            <span className="text-rule-strong">·</span>
            <span className="tabular-nums">conf {conf.toFixed(2)}</span>
          </>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-6">
        <h1 className="text-display leading-[1.1] tracking-[-0.012em] text-ink">
          {clientName}
        </h1>
        {assessment && (
          <div className="text-right shrink-0">
            <div className="smcp text-graphite mb-1.5">assessment</div>
            <StatusPill assessment={assessment} size="full" />
          </div>
        )}
      </div>
      {caseType && (
        <div className="mt-2 text-meta text-graphite">{CASE_LABEL[caseType]}</div>
      )}
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
    { key: 'exhibits', label: 'Exhibits' },
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
                <span className="text-body">{t.label}</span>
                {t.suffix && (
                  <span className="font-mono text-meta text-graphite-soft tabular-nums">
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

function FactsPane({
  facts,
  typedMemory,
  matterId,
}: {
  facts: Record<string, unknown>;
  typedMemory?: TypedMemory;
  matterId?: string;
}) {
  return (
    <div className="px-9 py-7 grid gap-8 fade-in">
      <StructuredFactsPanel
        facts={facts}
        typedMemory={typedMemory}
        matterId={matterId}
      />
      <details className="border border-rule paper-recess">
        <summary className="cursor-pointer px-5 py-3 font-mono text-[0.75rem] text-graphite hover:bg-ink/5">
          ▸ raw extracted facts (full schema dump)
        </summary>
        <div className="px-5 py-4 grid gap-7 border-t border-rule">
          {Object.entries(facts).map(([key, value]) => (
            <FactSection key={key} label={key} value={value} top />
          ))}
        </div>
      </details>
    </div>
  );
}

/**
 * Structured 7-block facts panel — the firm-friendly view of the matter.
 * Reads the canonical E2Facts shape with optional chaining + missing-flag
 * fallbacks. Each block is paired with the live extracted values so an
 * attorney can read the matter at a glance without diving the schema.
 */
function StructuredFactsPanel({
  facts,
  typedMemory,
  matterId,
}: {
  facts: Record<string, unknown>;
  typedMemory?: TypedMemory;
  matterId?: string;
}) {
  const [intake, setIntake] = useIntakeForm(matterId);
  const investor = (facts.investor as Record<string, FieldLeaf<unknown>> | undefined) ?? {};
  const enterprise = (facts.enterprise as Record<string, FieldLeaf<unknown>> | undefined) ?? {};
  const investment = (facts.investment as Record<string, unknown> | undefined) ?? {};
  const sourceOfFunds = Array.isArray(facts.source_of_funds)
    ? (facts.source_of_funds as Record<string, FieldLeaf<unknown>>[])
    : [];

  const investmentItems = Array.isArray(
    (investment as { items?: unknown }).items,
  )
    ? ((investment as { items: Record<string, FieldLeaf<unknown>>[] }).items)
    : [];

  // Total transferred from source_of_funds origin amounts.
  const totalTransferred = sourceOfFunds.reduce((acc, sof) => {
    const v = (sof.origin_amount_usd as FieldLeaf<number> | undefined)?.value;
    return acc + (typeof v === 'number' ? v : 0);
  }, 0);

  // Most recent I-94 admit_until — investor.current_us_status text often
  // includes it when the I-94 was extracted at the per-PDF level. Fall
  // back to a status-string inference.
  const currentStatus = (investor.current_us_status as FieldLeaf<string> | undefined)?.value;
  const inUSA =
    typeof currentStatus === 'string' &&
    !/abroad|outside|not in u\.?s\.?|never been/i.test(currentStatus);

  // I-94 deadline countdown: walk typed memory's i94 + status_doc entries,
  // pull the latest admit_until_date, compute days remaining.
  const i94Bundle = pickLatestI94(typedMemory);

  return (
    <div className="grid gap-7">
      <StructuredBlock
        roman="I"
        title="Applicant"
        rows={[
          { label: 'Full name', field: investor.full_name },
          { label: 'Date of birth', field: investor.dob },
          { label: 'Place of birth', field: investor.place_of_birth },
          { label: 'Nationality', field: investor.nationality },
          {
            label: 'Current location',
            field: investor.current_us_status,
            fallback: currentStatus
              ? inUSA
                ? '🇺🇸 in the United States'
                : '✈ abroad'
              : null,
          },
        ]}
      />

      <IntakeBlock
        roman="I.b"
        title="Applicant intake (manual)"
        intake={intake}
        onChange={setIntake}
      />

      <StructuredBlock
        roman="II"
        title="Identity bundle (passport · visa · I-94)"
        rows={[
          { label: 'Passport number', field: investor.passport_number },
          { label: 'Passport expiry', field: investor.passport_expiry },
          { label: 'Passport issue date', fallback: '[See passport bio page in Applicant Documents]' },
          { label: 'Issuing authority', fallback: '[See passport bio page in Applicant Documents]' },
          { label: 'Most recent visa', fallback: '[See visa stamp / I-797 in Applicant Documents]' },
          {
            label: 'Most recent I-94',
            fallback: i94Bundle.found
              ? `${i94Bundle.classOfAdmission ?? '?'} · admitted ${i94Bundle.admissionDate ?? '?'}`
              : '[See CBP I-94 in Applicant Documents]',
          },
          {
            label: 'I-94 admit-until date',
            fallback: i94Bundle.found
              ? `${i94Bundle.admitUntilDate ?? '?'}` +
                (i94Bundle.daysRemaining !== null
                  ? `  ·  ${i94Bundle.daysRemaining > 0 ? `${i94Bundle.daysRemaining} days remaining` : `EXPIRED ${Math.abs(i94Bundle.daysRemaining)} days ago`}`
                  : '')
              : '[See CBP I-94 — drives the matter deadline]',
          },
        ]}
      />

      <StructuredBlock
        roman="III"
        title="Company"
        rows={[
          { label: 'Legal name', field: enterprise.legal_name },
          { label: 'EIN', field: enterprise.ein },
          { label: 'Formation date', field: enterprise.formation_date },
          { label: 'State of formation', field: enterprise.state_of_formation },
          { label: 'Entity type', field: enterprise.entity_type },
          { label: 'Industry / what they do', field: enterprise.industry },
          { label: 'NAICS code', field: enterprise.naics_code },
          { label: 'Physical address', field: enterprise.physical_address },
        ]}
      />

      <StructuredBlock
        roman="IV"
        title="Source of funds"
        rows={[
          {
            label: 'Total transferred (USD)',
            fallback:
              totalTransferred > 0
                ? `$${totalTransferred.toLocaleString('en-US')}  ·  computed from ${sourceOfFunds.length} chain${sourceOfFunds.length === 1 ? '' : 's'}`
                : '[None recorded yet]',
          },
          ...sourceOfFunds.flatMap((sof, i): BlockRow[] => {
            const cat = (sof.origin_category as FieldLeaf<string> | undefined)?.value;
            const amt = (sof.origin_amount_usd as FieldLeaf<number> | undefined)?.value;
            const dest = (sof.final_destination as FieldLeaf<string> | undefined)?.value;
            return [
              {
                label: `Chain ${i + 1} · origin`,
                field: sof.origin_category,
                fallback:
                  typeof cat === 'string' && typeof amt === 'number'
                    ? `${cat} → $${amt.toLocaleString('en-US')}`
                    : null,
              },
              {
                label: `Chain ${i + 1} · destination`,
                field: sof.final_destination,
                fallback: typeof dest === 'string' ? dest : null,
              },
            ];
          }),
        ]}
      />

      <StructuredBlock
        roman="V"
        title="Operations"
        rows={[
          { label: 'Nature of business', field: enterprise.industry },
          { label: 'Employees on payroll', fallback: '[Pull from Employee Documents → payroll register]' },
          { label: 'Real & operating evidence', fallback: '[See lease + bank statements + vendor invoices in Operational Documents]' },
        ]}
      />

      <StructuredBlock
        roman="VI"
        title="Spend"
        rows={[
          {
            label: 'Total committed (USD)',
            field: (investment as { total_committed_usd?: FieldLeaf<number> }).total_committed_usd,
          },
          {
            label: 'Total spent (USD)',
            field: (investment as { total_spent_usd?: FieldLeaf<number> }).total_spent_usd,
          },
          {
            label: 'Total enterprise cost',
            field: (investment as { total_cost_of_enterprise_usd?: FieldLeaf<number> }).total_cost_of_enterprise_usd,
          },
          {
            label: 'Proportionality',
            field: (investment as { proportionality_percent?: FieldLeaf<number> }).proportionality_percent,
          },
          {
            label: 'Investment line items',
            fallback:
              investmentItems.length > 0
                ? `${investmentItems.length} item${investmentItems.length === 1 ? '' : 's'} · see raw view below for full ledger`
                : '[None recorded yet]',
          },
        ]}
      />

      <StructuredBlock
        roman="VII"
        title="Generated artifacts"
        rows={[
          { label: 'Cover letter', fallback: '[See Draft tab]' },
          { label: 'Business plan', fallback: '[Not generated yet]' },
          { label: 'Declarations', fallback: '[Generate from Exhibits → Applicant / Company section]' },
          { label: 'Forms (I-129, I-129E, G-28)', fallback: '[Generate from Exhibits → Forms and Letters]' },
          { label: 'Exhibit list', fallback: '[Generate from Exhibits → Forms and Letters]' },
        ]}
      />
    </div>
  );
}

interface FieldLeaf<T> {
  value: T | null;
  source_page: number | null;
  source_quote: string | null;
  confidence: number | null;
}

function isFieldLeafShape(v: unknown): v is FieldLeaf<unknown> {
  return !!v && typeof v === 'object' && 'value' in v && 'source_page' in v;
}

/* ---------------------------------------------------------------------- */
/* Intake form (phone / email / address — fields not in PerPdfFacts)      */
/* ---------------------------------------------------------------------- */

export interface IntakeFields {
  address: string;
  phone: string;
  email: string;
}

const EMPTY_INTAKE: IntakeFields = { address: '', phone: '', email: '' };

function intakeKey(matterId: string | undefined): string | null {
  if (!matterId) return null;
  return `akalan:intake:v1:${matterId}`;
}

/**
 * useIntakeForm — small client-side store for the applicant fields the
 * pipeline can't extract from PDFs (address / phone / email). Persists
 * to localStorage so the firm doesn't re-key them each session. The
 * approval flow merges these into caseFacts.investor before calling
 * preview/approve, so generated drafts see the values without a schema
 * change upstream.
 */
function useIntakeForm(
  matterId: string | undefined,
): [IntakeFields, (next: IntakeFields) => void] {
  const [state, setState] = useState<IntakeFields>(EMPTY_INTAKE);

  useEffect(() => {
    const key = intakeKey(matterId);
    if (!key) return;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        setState(EMPTY_INTAKE);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<IntakeFields>;
      setState({
        address: typeof parsed.address === 'string' ? parsed.address : '',
        phone: typeof parsed.phone === 'string' ? parsed.phone : '',
        email: typeof parsed.email === 'string' ? parsed.email : '',
      });
    } catch {
      setState(EMPTY_INTAKE);
    }
  }, [matterId]);

  const setIntake = (next: IntakeFields) => {
    setState(next);
    const key = intakeKey(matterId);
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* localStorage full / disabled — non-fatal */
    }
  };

  return [state, setIntake];
}

/**
 * Read intake values for a matter outside React (used by the modal
 * call-site to merge into caseFacts before sending to preview/approve).
 */
export function readIntakeForm(matterId: string | undefined): IntakeFields {
  const key = intakeKey(matterId);
  if (!key || typeof window === 'undefined') return EMPTY_INTAKE;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return EMPTY_INTAKE;
    const parsed = JSON.parse(raw) as Partial<IntakeFields>;
    return {
      address: typeof parsed.address === 'string' ? parsed.address : '',
      phone: typeof parsed.phone === 'string' ? parsed.phone : '',
      email: typeof parsed.email === 'string' ? parsed.email : '',
    };
  } catch {
    return EMPTY_INTAKE;
  }
}

/** Make a Field<T>-shaped leaf wrapping an attorney-attestation value. */
function intakeFieldLeaf(value: string): FieldLeaf<string> | null {
  if (!value || value.trim().length === 0) return null;
  return {
    value: value.trim(),
    source_page: null,
    source_quote: '[attorney_intake]',
    confidence: 1,
  };
}

/**
 * Merge intake values into caseFacts.investor. Returns a new caseFacts
 * object — never mutates the input. Empty fields are skipped so a blank
 * intake row doesn't overwrite what extraction found.
 */
export function mergeIntakeIntoCaseFacts<T extends { facts: { investor?: unknown } }>(
  caseFacts: T,
  intake: IntakeFields,
): T {
  const cloned = JSON.parse(JSON.stringify(caseFacts)) as T;
  const factsObj = cloned.facts as Record<string, unknown>;
  const inv = (factsObj.investor as Record<string, unknown> | undefined) ?? {};
  const address = intakeFieldLeaf(intake.address);
  const phone = intakeFieldLeaf(intake.phone);
  const email = intakeFieldLeaf(intake.email);
  if (address) inv.address = address;
  if (phone) inv.phone = phone;
  if (email) inv.email = email;
  factsObj.investor = inv;
  return cloned;
}

function IntakeBlock({
  roman,
  title,
  intake,
  onChange,
}: {
  roman: string;
  title: string;
  intake: IntakeFields;
  onChange: (next: IntakeFields) => void;
}) {
  return (
    <section className="border border-rule paper-recess">
      <header className="px-5 py-3 border-b border-rule-strong flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[0.75rem] text-rubric tabular-nums">{roman}.</span>
          <span className="font-display italic text-[1.05rem] text-ink-2">{title}</span>
          <span className="font-mono text-[0.62rem] text-graphite-soft">attorney attestation · merges into draft</span>
        </div>
      </header>
      <dl className="px-5 py-4 grid grid-cols-[12rem_1fr] gap-x-6 gap-y-3">
        <IntakeRow
          label="Address"
          value={intake.address}
          placeholder="123 Main St, City, State ZIP"
          onChange={(v) => onChange({ ...intake, address: v })}
        />
        <IntakeRow
          label="Phone"
          value={intake.phone}
          placeholder="+1 305 555 1212"
          onChange={(v) => onChange({ ...intake, phone: v })}
        />
        <IntakeRow
          label="Email"
          value={intake.email}
          placeholder="client@example.com"
          onChange={(v) => onChange({ ...intake, email: v })}
        />
      </dl>
    </section>
  );
}

function IntakeRow({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  // Sync draft when matter switches.
  useEffect(() => {
    setDraft(value);
  }, [value]);
  return (
    <>
      <dt className="font-display text-[0.85rem] text-graphite pt-1.5">{label}</dt>
      <dd>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== value) onChange(draft);
          }}
          placeholder={placeholder}
          className="w-full max-w-md border border-rule px-2 py-1.5 font-mono text-[0.78rem] text-ink-2 focus:outline-none focus:border-ink-2"
        />
      </dd>
    </>
  );
}

/**
 * Walk the matter's typed memory looking for the most recent CBP I-94
 * admission. Returns admit_until_date + days remaining (negative if the
 * status has already expired). Searches both the dedicated `i94` slot
 * and the legacy `status_doc` slot since older extractor versions
 * mapped I-94 records under status_doc.
 */
function pickLatestI94(typedMemory: TypedMemory | undefined): {
  found: boolean;
  classOfAdmission: string | null;
  admissionDate: string | null;
  admitUntilDate: string | null;
  daysRemaining: number | null;
} {
  const empty = {
    found: false,
    classOfAdmission: null,
    admissionDate: null,
    admitUntilDate: null,
    daysRemaining: null,
  };
  if (!typedMemory) return empty;

  const candidates: { admitUntil: string | null; admissionDate: string | null; classOfAdmission: string | null }[] = [];

  for (const bucket of ['i94', 'status_doc'] as const) {
    const list = typedMemory[bucket];
    if (!list) continue;
    for (const entry of list) {
      const facts = entry.facts as Record<string, FieldLeaf<unknown>> | null;
      if (!facts) continue;
      const admitUntil = (facts.admit_until_date as FieldLeaf<string> | undefined)?.value;
      const admissionDate = (facts.admission_date as FieldLeaf<string> | undefined)?.value;
      const classOfAdmission = (facts.class_of_admission as FieldLeaf<string> | undefined)?.value;
      if (typeof admitUntil === 'string' && admitUntil.length > 0) {
        candidates.push({
          admitUntil,
          admissionDate: typeof admissionDate === 'string' ? admissionDate : null,
          classOfAdmission: typeof classOfAdmission === 'string' ? classOfAdmission : null,
        });
      }
    }
  }

  if (candidates.length === 0) return empty;

  // Pick the latest admit-until date — that's the most recent admission.
  candidates.sort((a, b) => (a.admitUntil! < b.admitUntil! ? 1 : -1));
  const latest = candidates[0];

  // Days remaining vs today (UTC midnight comparison).
  let daysRemaining: number | null = null;
  const m = latest.admitUntil!.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const target = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
    const now = new Date();
    if (Number.isFinite(target.getTime())) {
      daysRemaining = Math.round(
        (target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      );
    }
  }

  return {
    found: true,
    classOfAdmission: latest.classOfAdmission,
    admissionDate: latest.admissionDate,
    admitUntilDate: latest.admitUntil,
    daysRemaining,
  };
}

interface BlockRow {
  label: string;
  field?: FieldLeaf<unknown>;
  fallback?: string | null;
}

function StructuredBlock({
  roman,
  title,
  rows,
}: {
  roman: string;
  title: string;
  rows: BlockRow[];
}) {
  return (
    <section className="border border-rule paper-recess">
      <header className="px-5 py-3 border-b border-rule-strong flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[0.75rem] text-rubric tabular-nums">{roman}.</span>
          <span className="font-display italic text-[1.05rem] text-ink-2">{title}</span>
        </div>
      </header>
      <dl className="px-5 py-4 grid grid-cols-[12rem_1fr] gap-x-6 gap-y-2.5">
        {rows.map((row, i) => (
          <FactKVRow
            key={`${row.label}-${i}`}
            label={row.label}
            field={row.field}
            fallback={row.fallback}
          />
        ))}
      </dl>
    </section>
  );
}

function FactKVRow({
  label,
  field,
  fallback,
}: {
  label: string;
  field: FieldLeaf<unknown> | undefined;
  fallback?: string | null;
}) {
  let valueLabel: string;
  let confidence: number | null = null;
  let sourcePage: number | null = null;
  let sourceQuote: string | null = null;

  if (isFieldLeafShape(field)) {
    if (field.value === null || field.value === undefined || field.value === '') {
      valueLabel = fallback ?? '[MISSING]';
    } else {
      valueLabel = String(field.value);
    }
    confidence = field.confidence ?? null;
    sourcePage = field.source_page ?? null;
    sourceQuote = field.source_quote ?? null;
  } else if (typeof fallback === 'string') {
    valueLabel = fallback;
  } else {
    valueLabel = '[MISSING]';
  }

  const isMissing = valueLabel.startsWith('[');

  return (
    <>
      <dt className="font-display text-[0.85rem] text-graphite pt-0.5">{label}</dt>
      <dd className="text-[0.95rem]">
        <span
          className={
            isMissing
              ? 'font-mono text-[0.75rem] text-graphite-soft italic'
              : 'font-display text-ink-2'
          }
        >
          {valueLabel}
        </span>
        {(confidence !== null || sourcePage !== null) && (
          <span className="ml-3 font-mono text-[0.62rem] text-graphite-soft">
            {sourcePage !== null && `p.${sourcePage}`}
            {confidence !== null &&
              ` · conf ${Math.round(confidence * 100)}%`}
          </span>
        )}
        {sourceQuote && !isMissing && (
          <div className="font-display italic text-[0.7rem] text-graphite-soft mt-0.5">
            “{sourceQuote.length > 90 ? sourceQuote.slice(0, 90) + '…' : sourceQuote}”
          </div>
        )}
      </dd>
    </>
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

/**
 * Tab letter → ordered list of filenames map. Built off the exhibits
 * accordion's category routing so a "Tab E.4" reference in the draft
 * resolves to the 4th item the firm filed under Tab E.
 */
type ExhibitRefMap = Partial<Record<ExhibitTabKey, string[]>>;

function buildExhibitRefMap(
  typedMemory: TypedMemory | undefined,
): ExhibitRefMap {
  const map: ExhibitRefMap = {};
  if (!typedMemory) return map;
  for (const [docTypeRaw, list] of Object.entries(typedMemory)) {
    if (!list) continue;
    const docType = docTypeRaw as DocType;
    const tab = DOC_TYPE_TO_TAB[docType] ?? 'unassigned';
    const bucket = map[tab] ?? [];
    for (const entry of list) {
      bucket.push(entry.filename);
    }
    map[tab] = bucket;
  }
  return map;
}

/**
 * Resolve a "Tab E.4" / "Exhibit C" reference to a filename via the
 * tab → filenames map. Subsection number is 1-based; if it's missing
 * or out of range, returns the first filename in that tab so the user
 * still gets *something* to look at.
 */
function resolveExhibitRef(ref: string, map: ExhibitRefMap): string | null {
  const m = ref.match(/^(?:Tab|Exhibit)\s+([A-L])(?:\.(\d+))?/i);
  if (!m) return null;
  const tab = m[1].toUpperCase() as ExhibitTabKey;
  const subsection = m[2] ? Number.parseInt(m[2], 10) : null;
  const list = map[tab];
  if (!list || list.length === 0) return null;
  if (subsection !== null && subsection > 0 && subsection <= list.length) {
    return list[subsection - 1];
  }
  return list[0];
}

/**
 * Inline-render a draft paragraph with `Tab X.Y` / `Exhibit X.Y`
 * references styled as blue links. Click resolves to the matched PDF
 * via the supplied refMap and fires onPickRef so the parent can open a
 * preview modal.
 */
function ParagraphWithExhibitLinks({
  text,
  onPickRef,
  refMap,
}: {
  text: string;
  onPickRef?: (ref: string) => void;
  refMap?: ExhibitRefMap;
}) {
  const re = /\b((?:Tab|Exhibit)\s+[A-L](?:\.\w+(?:\.\w+)?)?)\b/g;
  const parts: (string | { ref: string })[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ ref: m[1] });
    last = m.index + m[1].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  if (parts.length === 0) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) => {
        if (typeof p === 'string') return <span key={i}>{p}</span>;
        const resolvable = !!(refMap && resolveExhibitRef(p.ref, refMap));
        return (
          <span
            key={i}
            onClick={resolvable && onPickRef ? () => onPickRef(p.ref) : undefined}
            title={resolvable ? 'Click to preview the referenced PDF' : 'Exhibit reference (not yet linked to a document)'}
            className={
              resolvable
                ? 'text-blue-700 underline decoration-blue-500 decoration-1 underline-offset-2 cursor-pointer hover:bg-blue-50'
                : 'text-blue-700/60 underline decoration-blue-300/60 decoration-1 underline-offset-2 cursor-help'
            }
          >
            {p.ref}
          </span>
        );
      })}
    </>
  );
}

function DraftPane({
  result,
  streamingDraft,
  typedMemory,
  matterRoot,
}: {
  result: IngestResult;
  streamingDraft?: string;
  typedMemory?: TypedMemory;
  matterRoot?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [previewPath, setPreviewPath] = useState<string | null>(null);

  // Pre-compute "Tab letter → ordered filenames[]" so the inline
  // ParagraphWithExhibitLinks can resolve "Tab E.4" → 4th item under
  // Tab E. Memoize across renders since typedMemory is stable inside a
  // single matter view.
  const exhibitRefMap = useMemo(
    () => buildExhibitRefMap(typedMemory),
    [typedMemory],
  );

  function onPickRef(ref: string) {
    if (!matterRoot) return;
    const filename = resolveExhibitRef(ref, exhibitRefMap);
    if (!filename) return;
    const sep = matterRoot.endsWith('/') ? '' : '/';
    setPreviewPath(`${matterRoot}${sep}${filename}`);
  }

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

  // Server-authoritative draft when present; otherwise the in-flight
  // streaming buffer (paragraphs land live as the model writes). The
  // streaming buffer is cleared when the closing `result` event lands.
  const text = result.draft || streamingDraft || '';

  if (!text) {
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
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  // Split paragraphs for editorial typesetting
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  return (
    <div className="px-9 py-7 fade-in">
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <div className="smcp text-[0.65rem] text-graphite">¶ cover letter</div>
          <div className="font-display italic text-[0.95rem] text-ink-2">
            drafted in the firm’s voice · exhibit refs marked in blue
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
            <ParagraphWithExhibitLinks
              text={p.trim()}
              onPickRef={onPickRef}
              refMap={exhibitRefMap}
            />
          </p>
        ))}
      </article>

      {previewPath && (
        <DocumentPreviewModal
          path={previewPath}
          onClose={() => setPreviewPath(null)}
        />
      )}
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

function Marginalia({
  result,
  results,
  loading,
  streamingDraft,
}: {
  result: IngestResult | undefined;
  results: IngestResult[];
  loading: boolean;
  streamingDraft?: string;
}) {
  // While the drafter streams, show the live typewriter in the right rail
  // so the user can inspect facts on the left without leaving the page.
  const liveDrafting = !!streamingDraft && streamingDraft.length > 0;
  if (liveDrafting) {
    const tail = streamingDraft.split(/\n\s*\n/).slice(-12).join('\n\n');
    return (
      <aside className="border-l border-rule paper-grain min-h-0 overflow-y-auto px-6 py-7 grid gap-5 content-start">
        <header className="grid gap-1">
          <span className="smcp text-graphite-soft">drafting</span>
          <span className="text-title">Cover letter writing itself</span>
          <span className="text-meta text-graphite-soft">scroll the dossier on the left</span>
        </header>
        <pre className="whitespace-pre-wrap text-body leading-relaxed text-ink-2 [&::after]:inline-block [&::after]:w-2 [&::after]:h-[0.85em] [&::after]:bg-ink-2 [&::after]:ml-0.5 [&::after]:animate-pulse [&::after]:content-['']">
          {tail}
        </pre>
      </aside>
    );
  }

  if (loading || !result || result.error) {
    return <FirmTriagePanel results={results} />;
  }
  return <MatterAuditPanel result={result} />;
}

/* ---------------------------------------------------------------------- */
/* Triage rail — replaces brochure intro and matter metadata.             */
/* Strict monochrome. Urgency carried by order, weight, and hairlines.    */
/* ---------------------------------------------------------------------- */

interface FieldLeafShape {
  value: unknown;
  source_page: number | null;
  confidence: number | null;
  source_quote: string | null;
}

function isLeaf(v: unknown): v is FieldLeafShape {
  return (
    !!v &&
    typeof v === 'object' &&
    'value' in (v as object) &&
    'confidence' in (v as object)
  );
}

function leafValue(facts: unknown, path: readonly string[]): unknown {
  let cur: unknown = facts;
  for (const k of path) {
    if (!cur || typeof cur !== 'object') return null;
    cur = (cur as Record<string, unknown>)[k];
  }
  if (isLeaf(cur)) return cur.value;
  return cur ?? null;
}

interface MatterStatus {
  matterName: string;
  caseType: CaseType | undefined;
  conflictCount: number;
  reviewIssues: number;
  hasDraft: boolean;
  hasError: boolean;
  identityKnown: boolean;
  category: 'at_risk' | 'missing' | 'in_progress' | 'ready';
}

function analyzeMatter(r: IngestResult): MatterStatus {
  const caseType = r.caseFacts?.case_type;
  const facts = r.caseFacts?.facts;
  const conflicts = facts && (facts as { conflict_register?: unknown[] }).conflict_register;
  const conflictCount = Array.isArray(conflicts) ? conflicts.length : 0;
  const reviewIssues =
    (r.review?.inconsistencies?.length ?? 0) +
    (r.review?.missing_arguments?.length ?? 0) +
    (r.review?.weak_spots?.length ?? 0);
  const hasDraft = !!r.draft && r.draft.length > 0;
  const hasError = !!r.error || !!r.reviewError;

  let identityKnown = false;
  if (caseType === 'E2' && facts) {
    identityKnown =
      leafValue(facts, ['investor', 'passport_number']) !== null &&
      leafValue(facts, ['investor', 'current_us_status']) !== null;
  } else if (
    facts &&
    (caseType === 'EB1A' || caseType === 'EB1B' || caseType === 'EB1C')
  ) {
    identityKnown = leafValue(facts, ['beneficiary', 'passport_number']) !== null;
  }

  let category: MatterStatus['category'];
  if (hasError || conflictCount > 0 || reviewIssues > 0) category = 'at_risk';
  else if (!identityKnown) category = 'missing';
  else if (hasDraft) category = 'ready';
  else category = 'in_progress';

  const matterName = (r.filename ?? '').replace(/\.pdf$/i, '').replace(/_/g, ' ');

  return {
    matterName,
    caseType,
    conflictCount,
    reviewIssues,
    hasDraft,
    hasError,
    identityKnown,
    category,
  };
}

function FirmTriagePanel({ results }: { results: IngestResult[] }) {
  if (results.length === 0) return <FirmTriageEmpty />;
  const statuses = results.map(analyzeMatter);
  const atRisk = statuses.filter((s) => s.category === 'at_risk');
  const missing = statuses.filter((s) => s.category === 'missing');
  const ready = statuses.filter((s) => s.category === 'ready');
  const inProgress = statuses.filter((s) => s.category === 'in_progress');

  return (
    <aside className="border-l border-rule paper-grain min-h-0 overflow-y-auto px-6 py-7 grid gap-9 content-start">
      <header className="grid gap-1">
        <span className="smcp text-graphite-soft">the desk</span>
        <h2 className="text-title">
          {results.length} {results.length === 1 ? 'matter' : 'matters'} on the desk
        </h2>
      </header>

      <TriageBlock title="due / at risk" count={atRisk.length} empty="Nothing on fire.">
        {atRisk.map((s, i) => (
          <TriageRow key={i} status={s} />
        ))}
      </TriageBlock>

      <TriageBlock
        title="missing"
        count={missing.length}
        empty="All matters have core identity facts."
      >
        {missing.map((s, i) => (
          <TriageRow key={i} status={s} />
        ))}
      </TriageBlock>

      {inProgress.length > 0 && (
        <TriageBlock title="in progress" count={inProgress.length} empty="">
          {inProgress.map((s, i) => (
            <TriageRow key={i} status={s} />
          ))}
        </TriageBlock>
      )}

      <TriageBlock
        title="ready to file"
        count={ready.length}
        empty="None yet — keep building."
      >
        {ready.map((s, i) => (
          <TriageRow key={i} status={s} />
        ))}
      </TriageBlock>
    </aside>
  );
}

function FirmTriageEmpty() {
  return (
    <aside className="border-l border-rule paper-grain min-h-0 overflow-y-auto px-6 py-7 grid gap-6 content-start">
      <header className="grid gap-1">
        <span className="smcp text-graphite-soft">the desk</span>
        <h2 className="text-title">An empty desk.</h2>
      </header>
      <p className="text-body text-graphite leading-relaxed">
        Drop a dossier on the left to begin. Once a matter lands, this rail
        shows what&rsquo;s at risk, what&rsquo;s missing, and what&rsquo;s ready to file
        &mdash; across the firm.
      </p>
    </aside>
  );
}

function TriageBlock({
  title,
  count,
  children,
  empty,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  empty: string;
}) {
  return (
    <section>
      <header className="flex items-baseline gap-3 mb-3">
        <span className="smcp text-graphite">{title}</span>
        <span className="font-mono text-meta text-graphite-soft tabular-nums">{count}</span>
        <span className="flex-1 border-b border-rule translate-y-[-0.3em]" />
      </header>
      {count === 0 ? (
        empty ? <p className="text-meta text-graphite-soft">{empty}</p> : null
      ) : (
        <ul className="grid gap-3">{children}</ul>
      )}
    </section>
  );
}

function TriageRow({ status }: { status: MatterStatus }) {
  // Hairline tick on the left for at-risk rows — pure jet, no color.
  const tick =
    status.category === 'at_risk' ? 'border-l-2 border-ink pl-3 -ml-3' : 'pl-0';
  const detail = (() => {
    if (status.category === 'at_risk') {
      const parts: string[] = [];
      if (status.hasError) parts.push('extract error');
      if (status.conflictCount > 0)
        parts.push(`${status.conflictCount} conflict${status.conflictCount > 1 ? 's' : ''}`);
      if (status.reviewIssues > 0)
        parts.push(`${status.reviewIssues} review issue${status.reviewIssues > 1 ? 's' : ''}`);
      return parts.join(' · ') || 'attention needed';
    }
    if (status.category === 'missing') return 'identity facts incomplete';
    if (status.category === 'ready') return 'auditor passed';
    return status.hasDraft ? 'drafted, awaiting review' : 'extracting';
  })();

  const titleWeight = status.category === 'at_risk' ? 'text-ink' : 'text-ink-2';

  return (
    <li className={`grid grid-cols-[1fr_auto] gap-x-4 items-baseline ${tick}`}>
      <div className="min-w-0">
        <div className={`text-body truncate ${titleWeight}`}>{status.matterName}</div>
        {status.caseType && (
          <div className="font-mono text-meta text-graphite-soft mt-0.5">
            {CASE_GLYPH[status.caseType]} · {CASE_LABEL[status.caseType]}
          </div>
        )}
      </div>
      <div className="text-meta text-graphite text-right shrink-0 max-w-[10rem]">{detail}</div>
    </li>
  );
}

function MatterAuditPanel({ result }: { result: IngestResult }) {
  const status = analyzeMatter(result);
  const facts = result.caseFacts?.facts;
  const items =
    status.caseType && facts ? checklistFor(status.caseType, facts, status.hasDraft) : null;
  const done = items ? items.filter((i) => i.met).length : 0;
  const total = items?.length ?? 0;

  return (
    <aside className="border-l border-rule paper-grain min-h-0 overflow-y-auto px-6 py-7 grid gap-9 content-start">
      <header className="grid gap-1">
        <span className="smcp text-graphite-soft">audit</span>
        <h2 className="text-title break-words">{status.matterName}</h2>
        {status.caseType && (
          <span className="font-mono text-meta text-graphite mt-0.5">
            {CASE_GLYPH[status.caseType]} · {CASE_LABEL[status.caseType]}
          </span>
        )}
      </header>

      <section>
        <header className="flex items-baseline gap-3 mb-3">
          <span className="smcp text-graphite">checklist</span>
          {items && (
            <span className="font-mono text-meta text-graphite-soft tabular-nums">
              {done} / {total}
            </span>
          )}
          <span className="flex-1 border-b border-rule translate-y-[-0.3em]" />
        </header>
        {items ? (
          <ul className="grid gap-2">
            {items.map((i) => (
              <li
                key={i.label}
                className="grid grid-cols-[1.1rem_1fr] items-baseline gap-x-1"
              >
                <span
                  className={`font-mono text-meta tabular-nums ${i.met ? 'text-ink' : 'text-graphite-soft'}`}
                >
                  {i.met ? '✓' : '◯'}
                </span>
                <span className={`text-body ${i.met ? 'text-ink-2' : 'text-graphite'}`}>
                  {i.label}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-meta text-graphite-soft">No case type detected yet.</p>
        )}
      </section>

      <section>
        <header className="flex items-baseline gap-3 mb-3">
          <span className="smcp text-graphite">risk</span>
          <span className="font-mono text-meta text-graphite-soft tabular-nums">
            {status.conflictCount + status.reviewIssues}
          </span>
          <span className="flex-1 border-b border-rule translate-y-[-0.3em]" />
        </header>
        <ul className="grid gap-1.5">
          {status.conflictCount > 0 && (
            <RiskRow
              label={`${status.conflictCount} conflict${status.conflictCount > 1 ? 's' : ''} on register`}
            />
          )}
          {result.review && (
            <>
              {result.review.inconsistencies.length > 0 && (
                <RiskRow
                  label={`${result.review.inconsistencies.length} inconsistenc${result.review.inconsistencies.length > 1 ? 'ies' : 'y'}`}
                />
              )}
              {result.review.missing_arguments.length > 0 && (
                <RiskRow
                  label={`${result.review.missing_arguments.length} missing argument${result.review.missing_arguments.length > 1 ? 's' : ''}`}
                />
              )}
              {result.review.weak_spots.length > 0 && (
                <RiskRow
                  label={`${result.review.weak_spots.length} weak spot${result.review.weak_spots.length > 1 ? 's' : ''}`}
                />
              )}
            </>
          )}
          {status.conflictCount + status.reviewIssues === 0 && (
            <li className="text-meta text-graphite-soft">No flags raised.</li>
          )}
        </ul>
      </section>

      <section>
        <header className="flex items-baseline gap-3 mb-3">
          <span className="smcp text-graphite">next</span>
          <span className="flex-1 border-b border-rule translate-y-[-0.3em]" />
        </header>
        <p className="text-body text-ink-2 leading-relaxed">{nextActionFor(status)}</p>
      </section>
    </aside>
  );
}

function RiskRow({ label }: { label: string }) {
  return (
    <li className="grid grid-cols-[1.1rem_1fr] items-baseline gap-x-1">
      <span className="font-mono text-meta text-ink">⚠</span>
      <span className="text-body text-ink-2">{label}</span>
    </li>
  );
}

function checklistFor(
  caseType: CaseType,
  facts: Record<string, unknown>,
  hasDraft: boolean,
): { label: string; met: boolean }[] {
  if (caseType === 'E2') {
    const own = facts.ownership_chain;
    const sof = facts.source_of_funds;
    return [
      { label: 'Identity established',     met: leafValue(facts, ['investor', 'passport_number']) !== null },
      { label: 'US status known',          met: leafValue(facts, ['investor', 'current_us_status']) !== null },
      { label: 'Enterprise registered',    met: leafValue(facts, ['enterprise', 'ein']) !== null },
      { label: 'Ownership documented',     met: Array.isArray(own) && own.length > 0 },
      { label: 'Investment substantiated', met: typeof leafValue(facts, ['investment', 'total_committed_usd']) === 'number' },
      { label: 'Source of funds traced',   met: Array.isArray(sof) && sof.length > 0 },
      { label: 'Cover letter drafted',     met: hasDraft },
    ];
  }
  // EB-1A / B / C — extractor schemas vary; show a minimal universal list
  // and surface case-specific items as those extractors come online.
  return [
    { label: 'Beneficiary identity', met: leafValue(facts, ['beneficiary', 'passport_number']) !== null },
    { label: 'Cover letter drafted', met: hasDraft },
  ];
}

function nextActionFor(status: MatterStatus): string {
  if (status.hasError) return 'Re-run extraction — last attempt errored.';
  if (status.conflictCount > 0) return 'Resolve conflicts on the register before drafting.';
  if (!status.identityKnown) return 'Identity facts are missing. Add a passport scan and current status doc.';
  if (status.reviewIssues > 0) return 'Address auditor findings — review pane on the dossier.';
  if (!status.hasDraft) return 'Draft the cover letter.';
  return 'Ready for attorney review.';
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
    <div className="absolute inset-0 pointer-events-none grid place-items-center fade-in bg-paper/95">
      <div className="text-center pointer-events-none">
        <div className="dinkus mb-6">⁂</div>
        <div className="font-display text-[28px] font-medium text-ink leading-none">
          release to deposit.
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
