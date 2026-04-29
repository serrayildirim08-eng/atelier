'use client';

import { Fragment, useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { DragEvent, ChangeEvent } from 'react';
import type { GateRunResult, ReviewReport } from '@/reason';
import type { AggregateAuditPayload, CaseType, E2Facts } from '@/ingest';
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
import { GenerationToastStack } from '@/app/components/generation-toast';
import { mergeResultsByFilename } from '@/lib/results-merge';
import {
  aggregateGatesToConflicts,
  auditFromMemory,
  buildBinderManifest,
  deriveCaseProfile,
  resolveDocTypeId,
  selectBinderProfile,
  PROOF_SLOTS_BY_ID,
  DOC_TYPES_BY_ID,
  type BinderManifest,
  type DetectedSubtypeShape,
  type MemoryPdfEntry,
  type CaseProfile,
  type ConflictRegisterEntry,
  type FundsOrigin,
  type Vehicle,
  type ConsularPost,
  type SlotResolution,
  type Severity,
} from '@/lib/e2';
import {
  GATE_SEVERITY_LABEL,
  severityPillClass,
  gateDefaultOpen,
  passedGatesSummary,
} from '@/lib/gates-ui';

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
  /**
   * Phase-5: deterministic E-2 gate outcomes from runFullReview. Surfaced
   * on the review pane independently of the LLM narrative.
   */
  deterministic_gates?: GateRunResult[];
  reviewError?: { code: string; message: string };
  error?: { code: string; message: string };
  e2_subtype?: {
    principal_subtype: string;
    procedural_posture: string;
    has_dependents: boolean;
    detection_confidence?: 'HIGH' | 'MED' | 'LOW';
    reasoning?: string;
    detection_signals?: string[];
  } | null;
  aggregate_audit?: AggregateAuditPayload;
  source_pdfs?: string[];
}

type DossierTab = 'facts' | 'exhibits' | 'draft' | 'review' | 'log' | 'audit' | 'binder' | 'context';

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
  /** Rich-extractor subtype discriminators forwarded from the server. The
   *  E-2 audit framework uses these to refine the coarse `doc_type` into
   *  fine-grained doc-type ids (lib/e2/from-memory.ts). */
  subtypes?: {
    formation_doc_subtype?: string | null;
    contract_subtype?: string | null;
    government_doc_subtype?: string | null;
    tax_return_subtype?: string | null;
    statement_subtype?: string | null;
    credential_subtype?: string | null;
    payroll_subtype?: string | null;
    wire_subtype?: string | null;
    vital_record_subtype?: string | null;
    foreign_doc_subtype?: string | null;
  };
  /** Full rich-extraction objects forwarded from the server. Keys mirror
   *  PerPdfResult fields in ingest/typed-memory.ts. Only present when the
   *  second-pass extractor ran successfully on this PDF. The PDF detail
   *  modal renders these as structured fact panels. */
  rich?: Record<string, unknown> | null;
}

type TypedMemory = Partial<Record<DocType, PerPdfMemoryEntry[]>>;

interface AkalanBridge {
  platform: string;
  isDesktop: boolean;
  pickFolder?: () => Promise<string | null>;
  pathForFile?: (file: File) => string;
}

declare global {
  interface Window {
    akalan?: AkalanBridge;
  }
}

const PDF_EXT = /\.pdf$/i;

/**
 * Given an absolute path resolved by Electron's webUtils.getPathForFile,
 * return the matter folder root.
 *   - If the path is a folder (no trailing file extension), return as-is.
 *   - If the path is a file (looks like ".../something.pdf"), return its
 *     parent directory — that's the folder the user dragged from.
 * Heuristic-only. Server-side fs.stat in /api/ingest-path is the
 * authoritative check.
 */
function resolveDroppedFolder(firstPath: string): string {
  const cleaned = firstPath.replace(/\/+$/, '');
  const basename = cleaned.split('/').pop() ?? '';
  if (/\.[a-zA-Z0-9]{1,5}$/.test(basename)) {
    const lastSlash = cleaned.lastIndexOf('/');
    return lastSlash > 0 ? cleaned.slice(0, lastSlash) : cleaned;
  }
  return cleaned;
}

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

async function downloadInlineAsDocx(content: string, filename: string): Promise<void> {
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

function downloadInlineAsMarkdown(content: string, filename: string): void {
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
    return <span className="smcp text-graphite">{label}</span>;
  }
  const sizing =
    size === 'full' ? 'px-3 py-1.5 text-meta' : 'px-2 py-0.5 text-label';
  return (
    <span
      className={`inline-flex items-center smcp ${sizing} ${style.container} ${style.text}`}
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
  // Per-matter root map (filename → absolute folder). Persisted to
  // localStorage so HMR / page reloads can restore matterRoot from the
  // currently-selected matter. Without this, rename / re-aggregate would
  // silently no-op after a full refresh until the folder is re-picked.
  const [matterRoots, setMatterRoots] = useState<Record<string, string>>({});
  // Per-matter typedMemory snapshot. Persisted so the Exhibits / Audit /
  // Memory panes re-populate on reload without forcing a re-ingest. Large
  // (rich extraction objects) — if localStorage rejects a write we fall
  // back to in-memory only and the user gets a re-fetch on click.
  const [matterMemories, setMatterMemories] = useState<Record<string, TypedMemory>>({});
  const [matterOverlayOpen, setMatterOverlayOpen] = useState(false);
  // PDF detail modal state — when set, opens the PdfDetailModal showing
  // preview + structured rich extraction + audit findings for that PDF.
  const [pdfDetailFilename, setPdfDetailFilename] = useState<string | null>(null);
  const [selectedEntryKey, setSelectedEntryKey] = useState<string | null>(null);
  const [entryLabels, setEntryLabels] = useState<Record<string, string>>({});
  const [dashboardOverrides, setDashboardOverrides] = useState<Record<string, string>>({});
  // Persisted manual overrides for the current matter (matter display name +
  // per-document display name + per-document doc_type override). Loaded from
  // /api/matter-overrides on matter open and refreshed on each PATCH; the
  // re-aggregate response also re-emits the latest map.
  const [matterOverride, setMatterOverride] = useState<{
    matter_root: string;
    matter_display_name?: string | null;
    documents: Record<string, { display_name?: string | null; doc_type_override?: DocType | null }>;
  } | null>(null);
  // In-flight draft text streamed from the route during Phase 3. Cleared
  // when the closing `result` event lands (which carries the server-
  // authoritative final draft). DraftPane reads result.draft ?? this.
  const [streamingDraft, setStreamingDraft] = useState<string>('');
  // Full event stream accumulator powering <LoadingProgress/>: every NDJSON
  // line received from /api/ingest-path is pushed in order; the component
  // reduces it into rows + stage-strip state. Reset on each new ingest.
  const [streamEvents, setStreamEvents] = useState<LoadingStreamEvent[]>([]);
  const [streamStartedAt, setStreamStartedAt] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  const cancelIngest = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
    setProgress(null);
    setResults([]);
    setTypedMemory({});
    setPerPdfCount({ done: 0, total: 0 });
    setMatterRoot(null);
    setStreamingDraft('');
    setStreamEvents([]);
    setStreamStartedAt(null);
    setMatterOverride(null);
  }, []);

  // Hydrate entryLabels from a server-side override map. Each persisted
  // document override carries a display_name keyed by relative filename;
  // we map back to the entryKey form (`<doc_type>::<filename>`) using the
  // current typedMemory so the existing rename UI keeps using its key
  // convention. doc_type may have shifted under an override, so resolve
  // it via the override itself when present.
  const hydrateEntryLabelsFromOverride = useCallback(
    (
      ov: {
        documents: Record<
          string,
          { display_name?: string | null; doc_type_override?: DocType | null }
        >;
      } | null,
      mem: TypedMemory,
    ) => {
      if (!ov) return;
      const next: Record<string, string> = {};
      for (const [filename, doc] of Object.entries(ov.documents ?? {})) {
        const label = doc.display_name;
        if (!label) continue;
        const effectiveType: DocType =
          doc.doc_type_override ??
          (Object.entries(mem).find(([, list]) =>
            (list ?? []).some((e) => e.filename === filename),
          )?.[0] as DocType | undefined) ??
          'other';
        next[`${effectiveType}::${filename}`] = label;
      }
      setEntryLabels((prev) => ({ ...prev, ...next }));
    },
    [],
  );

  // Re-aggregate handler — POSTs to /api/re-aggregate, picks up the fresh
  // per-PDF payload + matter_override, and replays them into state so doc
  // grouping / display names / matter title all update without a re-ingest.
  // Generated drafts/reviews on the current matter are preserved (the route
  // returns only caseFacts + audit; the Dossier merge keeps draft/review).
  const runReaggregate = useCallback(async () => {
    if (!matterRoot) return;
    setReloadingDocs(true);
    setReloadingDocsLabel('Re-aggregating from cache…');
    try {
      const res = await fetch('/api/re-aggregate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matter_root: matterRoot }),
      });
      const data = (await res.json()) as {
        result?: IngestResult;
        per_pdf?: PerPdfMemoryEntry[];
        matter_override?: typeof matterOverride;
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.result) {
        throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`);
      }
      const next = data.result;
      if ('error' in next && next.error) {
        throw new Error(`${next.error.code}: ${next.error.message}`);
      }
      // Replace matter-level facts + audit; preserve draft/review/e2_subtype.
      setResults((prev) =>
        prev.map((r) => {
          if (r.filename !== next.filename) return r;
          if ('error' in r && r.error) return r;
          return {
            ...r,
            caseFacts: next.caseFacts ?? r.caseFacts,
            aggregate_audit: next.aggregate_audit ?? r.aggregate_audit,
            source_pdfs: next.source_pdfs ?? r.source_pdfs,
            pageCount: next.pageCount ?? r.pageCount,
            detection_confidence: next.detection_confidence ?? r.detection_confidence,
            detection_reasoning: next.detection_reasoning ?? r.detection_reasoning,
          };
        }),
      );
      if (Array.isArray(data.per_pdf)) {
        const fresh: TypedMemory = {};
        for (const entry of data.per_pdf) {
          const bucket: DocType = entry.doc_type ?? 'other';
          const list = fresh[bucket] ?? [];
          list.push(entry);
          fresh[bucket] = list;
        }
        setTypedMemory(fresh);
        setMatterMemories((mp) => ({ ...mp, [next.filename]: fresh }));
        if (data.matter_override) hydrateEntryLabelsFromOverride(data.matter_override, fresh);
      }
      if (data.matter_override !== undefined) {
        setMatterOverride(data.matter_override ?? null);
      }
    } finally {
      setReloadingDocs(false);
      setReloadingDocsLabel(null);
    }
  }, [matterRoot, hydrateEntryLabelsFromOverride]);

  // Patch the persisted override store and update local state. Called from
  // DossierHeader (matter rename) and DocumentInlinePreview (per-document
  // rename + doc_type override).
  const applyMatterOverridePatch = useCallback(
    async (
      patch: {
        matter_display_name?: string | null;
        document?: {
          filename: string;
          display_name?: string | null;
          doc_type_override?: DocType | null;
        };
      },
    ): Promise<boolean> => {
      if (!matterRoot) return false;
      try {
        const res = await fetch('/api/matter-overrides', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matter_root: matterRoot, ...patch }),
        });
        const data = (await res.json()) as {
          matter_override?: typeof matterOverride;
          error?: string;
          message?: string;
        };
        if (!res.ok) {
          console.warn('[matter-overrides] PATCH failed:', data.error, data.message);
          return false;
        }
        setMatterOverride(data.matter_override ?? null);
        return true;
      } catch (e: unknown) {
        console.warn(
          '[matter-overrides] PATCH error:',
          e instanceof Error ? e.message : String(e),
        );
        return false;
      }
    },
    [matterRoot],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsElectron(typeof window !== 'undefined' && !!window.akalan?.pickFolder);
  }, []);

  useEffect(() => {
    if (!matterOverlayOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMatterOverlayOpen(false);
        setPdfDetailFilename(null);
      }
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
  // We can't use a useState lazy initializer (Next.js SSR runs without
  // localStorage so server [] would mismatch the client's hydrated
  // value), so we hydrate in a mount effect. The setState-in-effect
  // rule is intentionally disabled here: the alternative is a hydration
  // warning, and this is the canonical Next.js pattern for client-only
  // persistence.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('akalan:matters:v1');
      if (!raw) return;
      const stored = JSON.parse(raw) as IngestResult[];
      if (Array.isArray(stored) && stored.length > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setResults(stored);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedIdx(0);
      }
    } catch {
      /* ignore — corrupt storage just means the binder starts empty */
    }
    try {
      const rawRoots = localStorage.getItem('akalan:matter-roots:v1');
      if (rawRoots) {
        const parsed = JSON.parse(rawRoots) as Record<string, string>;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setMatterRoots(parsed);
        }
      }
    } catch {
      /* ignore — corrupt storage just means roots are not restored */
    }
    try {
      const rawMem = localStorage.getItem('akalan:matter-memories:v1');
      if (rawMem) {
        const parsed = JSON.parse(rawMem) as Record<string, TypedMemory>;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setMatterMemories(parsed);
        }
      }
    } catch {
      /* ignore — corrupt storage just means memories are not restored */
    }
  }, []);

  // Persist matter-root map whenever it changes.
  useEffect(() => {
    try {
      if (Object.keys(matterRoots).length === 0) {
        localStorage.removeItem('akalan:matter-roots:v1');
      } else {
        localStorage.setItem('akalan:matter-roots:v1', JSON.stringify(matterRoots));
      }
    } catch {
      /* localStorage full or disabled — non-fatal */
    }
  }, [matterRoots]);

  // Persist matter-memories map. Heavy on disk; quota errors are swallowed.
  useEffect(() => {
    try {
      if (Object.keys(matterMemories).length === 0) {
        localStorage.removeItem('akalan:matter-memories:v1');
      } else {
        localStorage.setItem(
          'akalan:matter-memories:v1',
          JSON.stringify(matterMemories),
        );
      }
    } catch {
      /* QuotaExceededError or similar — silently degrade to session-only */
    }
  }, [matterMemories]);

  // Track which matter we've already auto-loaded this session, so a
  // matter-select effect doesn't trigger /api/re-aggregate every time the
  // user toggles tabs. Reset on cancel / clear so a fresh load can run.
  const autoLoadedRef = useRef<Set<string>>(new Set());
  // Surface re-aggregate in-flight to the UI so MemoryPane can render a
  // visible loading state (banner + skeleton rows) while cached documents
  // stream back. Otherwise users stare at the empty/idle Exhibits panel
  // for ~30s of Sonnet aggregation with no signal that anything is
  // happening.
  const [reloadingDocs, setReloadingDocs] = useState(false);
  const [reloadingDocsLabel, setReloadingDocsLabel] = useState<string | null>(null);

  // Whenever the selected matter changes, rehydrate matterRoot + the
  // persisted typedMemory snapshot. Lets rename / re-aggregate / Exhibits
  // pane work after a full reload, with the matter overrides re-fetched
  // from the server in the same effect.
  useEffect(() => {
    const selectedFilename = results[selectedIdx]?.filename;
    if (!selectedFilename) return;
    const persistedRoot = matterRoots[selectedFilename];
    if (persistedRoot && persistedRoot !== matterRoot) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMatterRoot(persistedRoot);
    }
    const persistedMem = matterMemories[selectedFilename];
    if (persistedMem) {
      const hasAny = Object.values(persistedMem).some(
        (l) => Array.isArray(l) && l.length > 0,
      );
      const currentEmpty = Object.values(typedMemory).every(
        (l) => !Array.isArray(l) || l.length === 0,
      );
      if (hasAny && currentEmpty) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTypedMemory(persistedMem);
      }
    }
    // Refresh persisted overrides for this matter so the rename + override
    // badges show without forcing a re-ingest.
    if (persistedRoot) {
      void fetch(
        `/api/matter-overrides?matter_root=${encodeURIComponent(persistedRoot)}`,
      )
        .then((r) => r.json())
        .then((data: { matter_override?: typeof matterOverride }) => {
          setMatterOverride(data.matter_override ?? null);
          if (data.matter_override) {
            hydrateEntryLabelsFromOverride(
              data.matter_override,
              persistedMem ?? typedMemory,
            );
          }
        })
        .catch(() => {
          /* network glitch — overrides will refresh on next interaction */
        });
    }
    // We intentionally exclude typedMemory + matterOverride from deps to
    // avoid an infinite restore loop; this effect should only fire when
    // the user changes selection or the persisted maps update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIdx, results, matterRoots, matterMemories]);

  // Auto re-aggregate on matter select when the typedMemory snapshot is
  // empty and we know where the folder lives. Cheap (cache-hit per file +
  // one Sonnet call) and runs once per session per matter so flipping
  // tabs doesn't replay it.
  useEffect(() => {
    const sel = results[selectedIdx]?.filename;
    if (!sel) return;
    const root = matterRoots[sel];
    if (!root) return;
    if (autoLoadedRef.current.has(sel)) return;
    const persisted = matterMemories[sel];
    const hasMem =
      persisted &&
      Object.values(persisted).some((l) => Array.isArray(l) && l.length > 0);
    if (hasMem) return;
    autoLoadedRef.current.add(sel);
    setReloadingDocs(true);
    setReloadingDocsLabel('Reading cached extracts and re-grouping documents…');
    void (async () => {
      try {
        const res = await fetch('/api/re-aggregate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matter_root: root }),
        });
        const data = (await res.json()) as {
          result?: IngestResult;
          per_pdf?: PerPdfMemoryEntry[];
          matter_override?: typeof matterOverride;
        };
        if (!res.ok || !data.result) return;
        const next = data.result;
        if ('error' in next && next.error) return;
        setResults((prev) =>
          prev.map((r) =>
            r.filename === next.filename
              ? {
                  ...r,
                  caseFacts: next.caseFacts ?? r.caseFacts,
                  aggregate_audit: next.aggregate_audit ?? r.aggregate_audit,
                  source_pdfs: next.source_pdfs ?? r.source_pdfs,
                  pageCount: next.pageCount ?? r.pageCount,
                }
              : r,
          ),
        );
        if (Array.isArray(data.per_pdf)) {
          const fresh: TypedMemory = {};
          for (const entry of data.per_pdf) {
            const bucket: DocType = entry.doc_type ?? 'other';
            const list = fresh[bucket] ?? [];
            list.push(entry);
            fresh[bucket] = list;
          }
          setTypedMemory(fresh);
          setMatterMemories((mp) => ({ ...mp, [next.filename]: fresh }));
          if (data.matter_override)
            hydrateEntryLabelsFromOverride(data.matter_override, fresh);
        }
        if (data.matter_override !== undefined) {
          setMatterOverride(data.matter_override ?? null);
        }
      } catch (e: unknown) {
        console.warn(
          '[auto-reload] re-aggregate failed:',
          e instanceof Error ? e.message : String(e),
        );
      } finally {
        setReloadingDocs(false);
        setReloadingDocsLabel(null);
      }
    })();
  }, [selectedIdx, results, matterRoots, matterMemories, hydrateEntryLabelsFromOverride]);

  // Periodic background re-scan of the currently-selected matter folder.
  // Picks up new documents the attorney drops into the folder without a
  // manual click. Only runs while the window is focused and the page is
  // visible, so the app idle in the background doesn't burn Sonnet
  // tokens. Default cadence: every 10 minutes; tune via env if needed.
  useEffect(() => {
    if (!matterRoot) return;
    let cancelled = false;
    const PERIOD_MS = 10 * 60 * 1000;
    const tick = async () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const res = await fetch('/api/re-aggregate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matter_root: matterRoot }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          result?: IngestResult;
          per_pdf?: PerPdfMemoryEntry[];
          matter_override?: typeof matterOverride;
        };
        if (cancelled) return;
        const next = data.result;
        if (!next || ('error' in next && next.error)) return;
        setResults((prev) =>
          prev.map((r) =>
            r.filename === next.filename
              ? {
                  ...r,
                  caseFacts: next.caseFacts ?? r.caseFacts,
                  aggregate_audit: next.aggregate_audit ?? r.aggregate_audit,
                  source_pdfs: next.source_pdfs ?? r.source_pdfs,
                  pageCount: next.pageCount ?? r.pageCount,
                }
              : r,
          ),
        );
        if (Array.isArray(data.per_pdf)) {
          const fresh: TypedMemory = {};
          for (const entry of data.per_pdf) {
            const bucket: DocType = entry.doc_type ?? 'other';
            const list = fresh[bucket] ?? [];
            list.push(entry);
            fresh[bucket] = list;
          }
          setTypedMemory(fresh);
          setMatterMemories((mp) => ({ ...mp, [next.filename]: fresh }));
        }
        if (data.matter_override !== undefined) {
          setMatterOverride(data.matter_override ?? null);
        }
      } catch {
        /* network glitch — try again next tick */
      }
    };
    const id = setInterval(tick, PERIOD_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [matterRoot]);

  useEffect(() => {
    try {
      if (results.length === 0) {
        localStorage.removeItem('akalan:matters:v1');
      } else {
        localStorage.setItem('akalan:matters:v1', JSON.stringify(results));
      }
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

  // Forward-declared via ref so onDrop (defined here) can call into
  // handleFolderPath (defined further down) without a TDZ violation.
  const handleFolderPathRef = useRef<(rootPath: string) => void>(() => {});

  const onDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragActive(false);

      // Electron-only fast path: when running inside atelier and the user
      // drops a folder (or files inside one), resolve the absolute folder
      // path via webUtils.getPathForFile and route through the streaming
      // /api/ingest-path endpoint. Without this, drag-drop falls back to
      // /api/ingest (per-file, non-streaming) and a 400-PDF deposit takes
      // hours instead of minutes — and skips the heartbeat.
      const pathForFile = window.akalan?.pathForFile;
      if (pathForFile && e.dataTransfer.files.length > 0) {
        const firstPath = pathForFile(e.dataTransfer.files[0]);
        if (firstPath) {
          const folderPath = resolveDroppedFolder(firstPath);
          if (folderPath) {
            handleFolderPathRef.current(folderPath);
            return;
          }
        }
      }

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
    // Phase 11 — do NOT wipe `results` on re-run. Prior matters (and the
    // current matter's prior extracts) stay in place until the new
    // streamed result lands. The collected[] array below merges by
    // matter basename (`filename`) so re-running the same folder
    // updates that matter in-place rather than dropping every other
    // matter on the binder.
    setLoading(true);
    setProgress(null);
    setTypedMemory({});
    setPerPdfCount({ done: 0, total: 0 });
    setMatterRoot(rootPath);
    setMatterRoots((prev) => ({ ...prev, [rootPath.split('/').pop() ?? rootPath]: rootPath }));
    setMatterOverride(null);
    setStreamingDraft('');
    setStreamEvents([]);
    setStreamStartedAt(Date.now());

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/ingest-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: rootPath }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        const errorResult: IngestResult = {
          filename: rootPath.split('/').pop() ?? rootPath,
          pageCount: 0,
          error: {
            code: 'http_' + res.status,
            message: data.error ?? `HTTP ${res.status}`,
          },
        };
        setResults((prev) => mergeResultsByFilename(prev, errorResult));
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
              subtypes:
                (evt.subtypes as PerPdfMemoryEntry['subtypes'] | undefined) ?? undefined,
              rich: (evt.rich as Record<string, unknown> | null) ?? null,
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
          } else if (evt.type === 'result_partial') {
            // Aggregator finished. The full pipeline still has draft +
            // review running in the background, but we can release the
            // loading overlay NOW so the user can browse Facts /
            // Exhibits / Audit while the drafter + reviewer finish.
            // The closing `result` event will replace this entry with a
            // fully-populated record once draft + review land.
            const partial = evt.result as IngestResult;
            const ov = (evt.matter_override as typeof matterOverride) ?? null;
            if (ov) {
              setMatterOverride(ov);
              setTypedMemory((mem) => {
                hydrateEntryLabelsFromOverride(ov, mem);
                return mem;
              });
            }
            // Persist the typedMemory snapshot for this matter so reloads
            // can re-populate the Exhibits / Memory panes without a fresh
            // ingest.
            setTypedMemory((mem) => {
              setMatterMemories((mp) => ({ ...mp, [partial.filename]: mem }));
              return mem;
            });
            collected.push(partial);
            // Phase 11 — merge by matter basename so re-running the same
            // folder replaces the prior entry in-place instead of
            // appending a duplicate or wiping siblings. The setResults
            // updater also computes the post-merge index for the
            // current matter and forwards it to setSelectedIdx so the
            // dossier focuses on the matter that just produced the
            // partial rather than whatever was selected before.
            setResults((prev) => {
              const merged = mergeResultsByFilename(prev, partial);
              const idx = merged.findIndex((r) => r.filename === partial.filename);
              if (idx >= 0) setSelectedIdx(idx);
              return merged;
            });
            setLoading(false);
            // Keep `progress` set so the inline background-chip on the
            // header can show "drafting…" / "reviewing…".
          } else if (evt.type === 'result') {
            // Final event: replace the partial record (if any) with the
            // fully-populated one (draft + review attached). If no
            // partial was emitted (error path), append normally.
            const finalResult = evt.result as IngestResult;
            const ov = (evt.matter_override as typeof matterOverride) ?? null;
            if (ov) {
              setMatterOverride(ov);
              setTypedMemory((mem) => {
                hydrateEntryLabelsFromOverride(ov, mem);
                return mem;
              });
            }
            setTypedMemory((mem) => {
              setMatterMemories((mp) => ({ ...mp, [finalResult.filename]: mem }));
              return mem;
            });
            if (collected.length > 0) {
              collected[collected.length - 1] = finalResult;
            } else {
              collected.push(finalResult);
            }
            setResults((prev) => {
              const merged = mergeResultsByFilename(prev, finalResult);
              const idx = merged.findIndex((r) => r.filename === finalResult.filename);
              if (idx >= 0) setSelectedIdx(idx);
              return merged;
            });
            setStreamingDraft('');
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
      const isAbort =
        (e instanceof DOMException && e.name === 'AbortError') ||
        (e instanceof Error && e.name === 'AbortError');
      if (!isAbort) {
        const errorResult: IngestResult = {
          filename: rootPath.split('/').pop() ?? rootPath,
          pageCount: 0,
          error: {
            code: 'network',
            message: e instanceof Error ? e.message : String(e),
          },
        };
        setResults((prev) => mergeResultsByFilename(prev, errorResult));
      }
    } finally {
      setLoading(false);
      setProgress(null);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [router]);

  // Wire the ref so onDrop can call into the latest handleFolderPath
  // without a TDZ. handleFolderPathRef is declared above onDrop; we
  // assign here, after handleFolderPath exists.
  handleFolderPathRef.current = handleFolderPath;

  const onPickFolderElectron = useCallback(async () => {
    if (!window.akalan?.pickFolder) return;
    const picked = await window.akalan.pickFolder();
    if (!picked) return;
    handleFolderPath(picked);
  }, [handleFolderPath]);

  // Re-link the currently-selected matter to a folder on disk and reload
  // typedMemory from the per-PDF cache via /api/re-aggregate. Used when a
  // matter survived a reload via localStorage but its matter_root was not
  // persisted (matters ingested before matterRoots persistence shipped).
  // Skips the heavy classifier/drafter/reviewer pipeline; only the Sonnet
  // aggregator runs.
  const relinkAndReaggregate = useCallback(async () => {
    if (!window.akalan?.pickFolder) return;
    const picked = await window.akalan.pickFolder();
    if (!picked) return;
    const sel = results[selectedIdx]?.filename;
    setMatterRoot(picked);
    if (sel) {
      setMatterRoots((prev) => ({ ...prev, [sel]: picked }));
    }
    setReloadingDocs(true);
    setReloadingDocsLabel('Loading documents from cache…');
    try {
    // runReaggregate reads matterRoot via closure; setState is async, so
    // call the API directly with the picked path here.
    const res = await fetch('/api/re-aggregate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matter_root: picked }),
    });
    const data = (await res.json()) as {
      result?: IngestResult;
      per_pdf?: PerPdfMemoryEntry[];
      matter_override?: typeof matterOverride;
      error?: string;
      message?: string;
    };
    if (!res.ok || !data.result) {
      throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`);
    }
    const next = data.result;
    if ('error' in next && next.error) {
      throw new Error(`${next.error.code}: ${next.error.message}`);
    }
    setResults((prev) =>
      prev.map((r) => {
        if (r.filename !== next.filename) return r;
        if ('error' in r && r.error) return r;
        return {
          ...r,
          caseFacts: next.caseFacts ?? r.caseFacts,
          aggregate_audit: next.aggregate_audit ?? r.aggregate_audit,
          source_pdfs: next.source_pdfs ?? r.source_pdfs,
          pageCount: next.pageCount ?? r.pageCount,
        };
      }),
    );
    if (Array.isArray(data.per_pdf)) {
      const fresh: TypedMemory = {};
      for (const entry of data.per_pdf) {
        const bucket: DocType = entry.doc_type ?? 'other';
        const list = fresh[bucket] ?? [];
        list.push(entry);
        fresh[bucket] = list;
      }
      setTypedMemory(fresh);
      setMatterMemories((mp) => ({ ...mp, [next.filename]: fresh }));
      if (data.matter_override)
        hydrateEntryLabelsFromOverride(data.matter_override, fresh);
    }
    if (data.matter_override !== undefined) {
      setMatterOverride(data.matter_override ?? null);
    }
    } finally {
      setReloadingDocs(false);
      setReloadingDocsLabel(null);
    }
  }, [results, selectedIdx, hydrateEntryLabelsFromOverride]);

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
          onDelete={(i) => {
            const r = results[i];
            const name = (r?.filename ?? '').replace(/\.pdf$/i, '') || 'this matter';
            if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
            setResults((prev) => prev.filter((_, idx) => idx !== i));
            setSelectedIdx((prev) => {
              if (prev === i) return 0;
              return prev > i ? prev - 1 : prev;
            });
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
          onOpenPdf={(name) => setPdfDetailFilename(name)}
          streamingDraft={streamingDraft}
          onResultUpdate={(updater) => {
            setResults((prev) =>
              prev.map((r, i) => (i === selectedIdx ? updater(r) : r)),
            );
          }}
          matterDisplayName={matterOverride?.matter_display_name ?? null}
          onSetMatterDisplayName={(value) =>
            applyMatterOverridePatch({ matter_display_name: value })
          }
          onReaggregate={runReaggregate}
          onRelink={relinkAndReaggregate}
          selectedEntryKey={selectedEntryKey}
          onSelectEntry={setSelectedEntryKey}
          onSetLabel={(key, label) =>
            setEntryLabels((prev) => ({ ...prev, [key]: label }))
          }
          documentOverrides={matterOverride?.documents ?? null}
          onApplyDocOverride={async (filename, patch) =>
            applyMatterOverridePatch({ document: { filename, ...patch } })
          }
          reloadingDocs={reloadingDocs}
          reloadingDocsLabel={reloadingDocsLabel}
        />
        <Marginalia
          result={selected}
          results={results}
          loading={loading}
          streamingDraft={streamingDraft}
        />
      </main>

      <StatusBar results={results} loading={loading} now={now} />

      {/* Background-progress chip: when the loading overlay is closed but
          drafter / reviewer are still running, show a small fixed chip
          so the user knows work is continuing in the background. */}
      {!loading && progress && (progress.stage === 'drafting' || progress.stage === 'reviewing') && (
        <div className="fixed bottom-12 right-6 z-30 border border-rule-strong bg-paper px-4 py-2.5 paper-recess flex items-center gap-3 shadow-md">
          <span className="pulse-dot-bg" aria-hidden />
          <div className="grid">
            <span className="font-mono text-[0.65rem] smcp text-graphite-soft tracking-wider">
              background
            </span>
            <span className="text-meta text-ink leading-tight">
              {progress.stage === 'drafting' ? 'Drafting cover letter…' : 'Reviewing draft…'}
            </span>
          </div>
        </div>
      )}

      {/* Phase 11 — background generation jobs (cover letter / forms /
          declarations / NoIDs / business plan) surface here so the
          approval modal can close immediately on submit and the
          attorney can keep navigating while the artifact is drafted. */}
      <GenerationToastStack />

      {dragActive && <DragOverlay />}

      {loading && streamStartedAt !== null && (
        <div className="fixed inset-0 z-40 paper-grain overflow-y-auto">
          <button
            onClick={() => {
              if (window.confirm('Cancel ingestion and clear the matter?')) {
                cancelIngest();
              }
            }}
            className="fixed top-5 right-6 z-50 px-3 py-1.5 border border-rule-strong bg-paper-2 hover:bg-ink hover:text-paper text-meta smcp tracking-wider transition-colors"
            aria-label="Cancel ingestion"
          >
            cancel ingestion ✕
          </button>
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
          matterName={
            matterOverride?.matter_display_name ??
            deriveAutoMatterName(selected) ??
            selected?.filename ??
            matterRoot ??
            'Matter'
          }
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
          documentOverrides={matterOverride?.documents ?? null}
          onApplyDocOverride={async (filename, patch) =>
            applyMatterOverridePatch({
              document: { filename, ...patch },
            })
          }
          onClose={() => setMatterOverlayOpen(false)}
        />
      )}

      {pdfDetailFilename && (
        <PdfDetailModal
          filename={pdfDetailFilename}
          matterRoot={matterRoot}
          typedMemory={typedMemory}
          caseFacts={selected?.caseFacts}
          aggregateAudit={selected?.aggregate_audit}
          documentOverride={
            matterOverride?.documents?.[pdfDetailFilename] ?? null
          }
          onApplyDocOverride={async (filename, patch) =>
            applyMatterOverridePatch({ document: { filename, ...patch } })
          }
          onClose={() => setPdfDetailFilename(null)}
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

      <div className="flex items-center gap-3 px-3 py-1.5 border border-rule paper-recess text-meta text-graphite hover:border-ink transition-colors cursor-text">
        <span className="font-mono text-label">⌘K</span>
        <span className="smcp">search the binder</span>
      </div>

      <div className="flex items-center justify-end gap-5 text-meta text-graphite font-mono">
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
  onDelete,
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
  onDelete: (i: number) => void;
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
            onDelete={() => onDelete(i)}
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
  onDelete,
}: {
  result: IngestResult;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const caseType = result.caseFacts?.case_type;
  const isError = !!result.error;
  const assessment = result.review?.overall_assessment;

  return (
    <div
      className={
        'group relative transition-colors border-l-2 ' +
        (selected
          ? 'border-ink paper-recess'
          : 'border-transparent hover:bg-paper-2/60')
      }
    >
      <button onClick={onSelect} className="w-full text-left px-3 py-2.5 pr-9">
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <div
            className="text-body leading-snug truncate"
            title={result.filename}
          >
            {deriveAutoMatterName(result) ?? trimFilename(result.filename)}
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
      <button
        onClick={onDelete}
        aria-label="Delete matter"
        title="Delete matter"
        className="absolute top-2 right-2 w-6 h-6 grid place-items-center text-graphite-soft hover:text-ink hover:bg-paper-deep/60 transition-colors font-mono text-base border border-rule"
      >
        ×
      </button>
    </div>
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
  onOpenPdf,
  streamingDraft,
  onResultUpdate,
  matterDisplayName,
  onSetMatterDisplayName,
  onReaggregate,
  onRelink,
  selectedEntryKey,
  onSelectEntry,
  onSetLabel,
  documentOverrides,
  onApplyDocOverride,
  reloadingDocs,
  reloadingDocsLabel,
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
  onOpenPdf: (filename: string) => void;
  streamingDraft?: string;
  onResultUpdate?: (updater: (r: IngestResult) => IngestResult) => void;
  matterDisplayName?: string | null;
  onSetMatterDisplayName?: (value: string | null) => Promise<boolean> | boolean;
  onReaggregate?: () => Promise<void>;
  onRelink?: () => Promise<void>;
  selectedEntryKey?: string | null;
  onSelectEntry?: (key: string | null) => void;
  onSetLabel?: (key: string, label: string) => void;
  documentOverrides?:
    | Record<string, { display_name?: string | null; doc_type_override?: DocType | null }>
    | null;
  onApplyDocOverride?: (
    filename: string,
    patch: { display_name?: string | null; doc_type_override?: DocType | null },
  ) => Promise<boolean>;
  reloadingDocs?: boolean;
  reloadingDocsLabel?: string | null;
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
      <DossierHeader
        result={result}
        matterRoot={matterRoot}
        onResultUpdate={onResultUpdate}
        matterDisplayName={matterDisplayName}
        onSetMatterDisplayName={onSetMatterDisplayName}
        onReaggregate={onReaggregate}
      />
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
            onReaggregate={onReaggregate}
            onRelink={onRelink}
            selectedEntryKey={selectedEntryKey}
            onSelectEntry={onSelectEntry}
            onSetLabel={onSetLabel}
            documentOverrides={documentOverrides}
            onApplyDocOverride={onApplyDocOverride}
            reloadingDocs={reloadingDocs}
            reloadingDocsLabel={reloadingDocsLabel}
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
        {tab === 'review' && (
          <ReviewPane result={result} onResultUpdate={onResultUpdate} />
        )}
        {tab === 'audit' && (
          <AuditPane
            key={`audit:${result.filename}`}
            typedMemory={typedMemory}
            caseFacts={result.caseFacts}
            matterId={result.filename}
            matterRoot={matterRoot}
            onOpenMatter={onOpenMatter}
            onOpenPdf={onOpenPdf}
            aggregateAudit={result.aggregate_audit}
          />
        )}
        {tab === 'binder' && (
          <BinderPane
            key={`binder:${result.filename}`}
            typedMemory={typedMemory}
            caseFacts={result.caseFacts}
            matterId={result.filename}
            matterRoot={matterRoot}
            onOpenMatter={onOpenMatter}
            onOpenPdf={onOpenPdf}
          />
        )}
        {tab === 'context' && (
          <ContextPane
            matterId={result.filename}
            caseFacts={result.caseFacts}
          />
        )}
        {tab === 'log' && <LogPane result={result} />}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* ContextPane — paste email / Copilot summaries / intake-call notes and  */
/* cross-check them against the structured facts already extracted from   */
/* the PDFs. Persists per matter to localStorage. Cross-check hits a      */
/* small Sonnet endpoint that returns severity-coded findings.            */
/* ---------------------------------------------------------------------- */

interface CrossCheckFinding {
  severity: 1 | 2 | 3 | 4 | 5;
  finding_type:
    | 'contradiction'
    | 'inconsistency'
    | 'missing_detail'
    | 'unverified_claim'
    | 'date_drift'
    | 'amount_drift'
    | 'name_drift'
    | 'other';
  field_in_facts: string | null;
  context_quote: string;
  fact_value: string | null;
  rationale: string;
  suggested_action: string | null;
}

interface CrossCheckResult {
  findings: CrossCheckFinding[];
  overall_assessment: 'clean' | 'minor_drift' | 'material_conflict';
  one_line_summary: string;
}

const CONTEXT_STORAGE_KEY = (matterId: string) => `akalan:context:v1:${matterId}`;
const CONTEXT_RESULT_KEY = (matterId: string) => `akalan:context-result:v1:${matterId}`;

function ContextPane({
  matterId,
  caseFacts,
}: {
  matterId: string;
  caseFacts: { case_type: CaseType; facts: Record<string, unknown> } | undefined;
}) {
  const [text, setText] = useState<string>('');
  const [source, setSource] = useState<'email' | 'note'>('email');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CrossCheckResult | null>(null);

  // Hydrate from localStorage on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CONTEXT_STORAGE_KEY(matterId));
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setText(saved);
      }
      const savedResult = localStorage.getItem(CONTEXT_RESULT_KEY(matterId));
      if (savedResult) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setResult(JSON.parse(savedResult) as CrossCheckResult);
      }
    } catch {
      /* corrupt localStorage — start fresh */
    }
  }, [matterId]);

  // Persist on every keystroke (debounced via the browser's natural batching).
  useEffect(() => {
    try {
      if (text.length === 0) {
        localStorage.removeItem(CONTEXT_STORAGE_KEY(matterId));
      } else {
        localStorage.setItem(CONTEXT_STORAGE_KEY(matterId), text);
      }
    } catch {
      /* full / disabled — non-fatal */
    }
  }, [matterId, text]);

  const runCrossCheck = async () => {
    if (!caseFacts || text.trim().length === 0) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/cross-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_facts: caseFacts,
          context_text: text,
          source,
        }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok || typeof data.error === 'string') {
        const message =
          (typeof data.message === 'string' && data.message) ||
          (typeof data.error === 'string' && data.error) ||
          `HTTP ${res.status}`;
        setError(message);
        return;
      }
      const stripped: CrossCheckResult = {
        findings: (data.findings as CrossCheckFinding[]) ?? [],
        overall_assessment:
          (data.overall_assessment as CrossCheckResult['overall_assessment']) ?? 'clean',
        one_line_summary: (data.one_line_summary as string) ?? '',
      };
      setResult(stripped);
      try {
        localStorage.setItem(CONTEXT_RESULT_KEY(matterId), JSON.stringify(stripped));
      } catch {
        /* ignore */
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="px-9 py-7 grid gap-6 fade-in">
      <header className="grid gap-1">
        <span className="smcp text-graphite-soft">⁂  correspondence context</span>
        <h2 className="text-title">Paste email threads, Copilot summaries, or intake-call notes.</h2>
        <p className="text-body text-graphite leading-relaxed max-w-prose">
          The bot will cross-check this text against the structured facts already
          extracted from the matter&rsquo;s PDFs. Anything that contradicts, drifts,
          or surfaces a missing detail comes back as a severity-coded flag.
        </p>
      </header>

      <div className="flex items-baseline gap-3">
        <span className="smcp text-graphite-soft">source:</span>
        <button
          onClick={() => setSource('email')}
          className={`px-3 py-1 border smcp text-meta tracking-wider transition-colors ${
            source === 'email'
              ? 'border-ink bg-ink text-paper'
              : 'border-rule text-graphite hover:border-ink'
          }`}
        >
          email thread
        </button>
        <button
          onClick={() => setSource('note')}
          className={`px-3 py-1 border smcp text-meta tracking-wider transition-colors ${
            source === 'note'
              ? 'border-ink bg-ink text-paper'
              : 'border-rule text-graphite hover:border-ink'
          }`}
        >
          attorney note
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste email thread, Copilot summary, or call notes…"
        className="w-full min-h-[20rem] border border-rule paper-recess px-4 py-3 font-mono text-[0.78rem] leading-relaxed resize-y focus:outline-none focus:border-ink"
      />

      <div className="flex items-baseline justify-between gap-4">
        <div className="font-mono text-meta text-graphite-soft tabular-nums">
          {text.length.toLocaleString()} chars · saved per matter
        </div>
        <button
          onClick={runCrossCheck}
          disabled={running || text.trim().length === 0 || !caseFacts}
          className="px-4 py-2 border border-ink smcp text-meta tracking-wider hover:bg-ink hover:text-paper transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? 'cross-checking…' : 'cross-check now'}
        </button>
      </div>

      {error && (
        <div className="border border-rubric/60 bg-rubric/5 px-4 py-3 text-body text-ink">
          <span className="smcp text-rubric mr-2">error</span>
          {error}
        </div>
      )}

      {result && (
        <section className="grid gap-3">
          <header className="border-t border-rule pt-4 flex items-baseline justify-between">
            <div>
              <span className="smcp text-graphite-soft mr-3">verdict:</span>
              <span
                className={
                  result.overall_assessment === 'material_conflict'
                    ? 'text-rubric font-semibold'
                    : result.overall_assessment === 'minor_drift'
                      ? 'text-ink'
                      : 'text-graphite'
                }
              >
                {result.overall_assessment.replace(/_/g, ' ')}
              </span>
            </div>
            <span className="font-mono text-meta tabular-nums text-graphite">
              {result.findings.length} finding{result.findings.length === 1 ? '' : 's'}
            </span>
          </header>
          <p className="text-body italic text-graphite leading-relaxed">
            {result.one_line_summary}
          </p>
          {result.findings.length === 0 ? (
            <p className="text-body text-graphite-soft">
              No conflicts surfaced. The correspondence is consistent with the case file.
            </p>
          ) : (
            <ul className="grid gap-3">
              {result.findings.map((f, i) => (
                <li
                  key={`${f.finding_type}-${i}`}
                  className={`border px-4 py-3 ${
                    f.severity >= 4
                      ? 'border-rubric/60 bg-rubric/5'
                      : f.severity === 3
                        ? 'border-ink/40'
                        : 'border-rule'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3 mb-1.5">
                    <span className="font-mono text-meta tracking-wider smcp text-ink">
                      severity {f.severity} · {f.finding_type.replace(/_/g, ' ')}
                    </span>
                    {f.field_in_facts && (
                      <span className="font-mono text-[0.7rem] text-graphite-soft">
                        {f.field_in_facts}
                      </span>
                    )}
                  </div>
                  <div className="text-body text-ink mb-2">{f.rationale}</div>
                  <div className="font-mono text-[0.72rem] text-graphite mb-1 leading-relaxed">
                    <span className="text-graphite-soft">from text:</span>{' '}
                    <span className="italic">&ldquo;{f.context_quote}&rdquo;</span>
                  </div>
                  {f.fact_value && (
                    <div className="font-mono text-[0.72rem] text-graphite leading-relaxed">
                      <span className="text-graphite-soft">in case file:</span>{' '}
                      {f.fact_value}
                    </div>
                  )}
                  {f.suggested_action && (
                    <div className="mt-2 text-body text-ink-2">
                      <span className="smcp text-graphite-soft mr-2">do:</span>
                      {f.suggested_action}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
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
    generators: [
      { generator: 'business_plan', label: 'Generate · Business plan (E-2)' },
    ],
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

/**
 * Time-based estimated progress — ticks from 0 to ~94% over an expected
 * duration (default 35s, the rough Sonnet aggregator wall-clock for a
 * mid-sized matter), then holds. The actual completion is driven by the
 * caller's `running` toggle: when it flips false we let the consumer
 * snap to 100 if desired.
 */
function useEstimatedProgress(running: boolean, expectedMs = 35_000): number {
  const [pct, setPct] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (!running) {
      setPct(0);
      startedAtRef.current = null;
      return;
    }
    startedAtRef.current = Date.now();
    let raf = 0;
    const tick = () => {
      const t0 = startedAtRef.current ?? Date.now();
      const elapsed = Date.now() - t0;
      // Asymptotic curve: fast initial climb, slowing as we approach 94.
      const ratio = Math.min(1, elapsed / expectedMs);
      const eased = 1 - Math.pow(1 - ratio, 2.4);
      setPct(Math.min(94, Math.round(eased * 94)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, expectedMs]);
  return pct;
}

/**
 * Editorial loading state for the Exhibits pane: spinning conic-gradient
 * ring (sage→sky→ochre), animated percentage, sweep bar, and skeleton
 * rows staggered in so the user feels the cache being read.
 */
function DocumentsLoading({ label }: { label: string | null }) {
  const pct = useEstimatedProgress(true);
  const skeletons = [0, 1, 2, 3, 4, 5];
  return (
    <div className="px-9 py-10 fade-in">
      <div className="border border-rule paper-recess p-7 mb-6">
        <div className="flex items-center gap-5">
          <div className="ring-spin shrink-0" aria-hidden />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-title text-ink tabular-nums pct-tick">
                {pct}
                <span className="text-graphite-soft">%</span>
              </span>
              <span className="smcp text-label text-graphite tracking-wider truncate">
                {label ?? 'reading documents from cache'}
              </span>
            </div>
            <div className="sweep-bar mt-3" />
            <div className="mt-2 font-mono text-label text-graphite-soft">
              cache hit · re-grouping by doc type · aggregating into case facts
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {skeletons.map((i) => (
          <div
            key={i}
            className="border border-rule paper-recess px-5 py-3 fade-up"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-label text-graphite-soft tabular-nums w-6">
                0{i + 1}
              </span>
              <div className="flex-1">
                <div
                  className="h-3 bg-paper-2 mb-1.5 animate-pulse"
                  style={{
                    width: `${42 + ((i * 13) % 35)}%`,
                    animationDelay: `${i * 120}ms`,
                  }}
                />
                <div
                  className="h-2 bg-paper-2/70 animate-pulse"
                  style={{
                    width: `${22 + ((i * 9) % 18)}%`,
                    animationDelay: `${i * 150 + 60}ms`,
                  }}
                />
              </div>
              <span className="font-mono text-label text-graphite-soft animate-pulse">
                · · ·
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Slim banner rendered above the documents list when a background
 * re-aggregate is in flight but earlier results are already on screen
 * (so we don't blow them away with a full skeleton state). Carries the
 * spinning ring + ticking percentage + sweep bar in compact form.
 */
function ReloadingBanner({ label }: { label: string | null }) {
  const pct = useEstimatedProgress(true);
  return (
    <div
      className="border border-rule paper-recess fade-in"
      role="status"
      aria-live="polite"
    >
      <div className="px-4 py-2.5 flex items-center gap-4">
        <div
          className="ring-spin shrink-0"
          style={{ width: '1.4rem', height: '1.4rem' }}
          aria-hidden
        />
        <span className="font-mono text-meta text-ink tabular-nums pct-tick">
          {pct}%
        </span>
        <span className="smcp text-label text-graphite tracking-wide truncate">
          {label ?? 'reading documents from cache'}
        </span>
        <span className="ml-auto font-mono text-label text-graphite-soft">
          live
        </span>
      </div>
      <div className="sweep-bar" />
    </div>
  );
}

function MemoryPane({
  typedMemory,
  matterRoot,
  entryLabels,
  onOpenMatter,
  matterId,
  caseFacts,
  onReaggregate,
  onRelink,
  selectedEntryKey,
  onSelectEntry,
  onSetLabel,
  documentOverrides,
  onApplyDocOverride,
  reloadingDocs,
  reloadingDocsLabel,
}: {
  typedMemory: TypedMemory;
  matterRoot: string | null;
  entryLabels: Record<string, string>;
  onOpenMatter: () => void;
  /** Used as the matter_id in /api/matter/[id]/{preview,approve} calls. */
  matterId?: string;
  /** Live caseFacts forwarded to the approval flow. */
  caseFacts?: unknown;
  selectedEntryKey?: string | null;
  onSelectEntry?: (key: string | null) => void;
  onSetLabel?: (key: string, label: string) => void;
  documentOverrides?:
    | Record<string, { display_name?: string | null; doc_type_override?: DocType | null }>
    | null;
  onApplyDocOverride?: (
    filename: string,
    patch: { display_name?: string | null; doc_type_override?: DocType | null },
  ) => Promise<boolean>;
  /**
   * Manually re-pull the per-PDF cache. Surfaced to the empty-state CTA
   * when matterRoot is set but typedMemory is blank — typically after a
   * page reload where the in-memory snapshot was lost.
   */
  onReaggregate?: () => Promise<void>;
  /**
   * Re-link the matter to a folder on disk (the user re-picks it) and
   * re-aggregate from the per-PDF cache. Surfaced when matterRoot is
   * unknown — i.e., the matter survived localStorage but its source folder
   * was never persisted (pre-matterRoots-persistence ingest).
   */
  onRelink?: () => Promise<void>;
  /** True while a re-aggregate is in flight; drives skeleton + banner UI. */
  reloadingDocs?: boolean;
  /** Optional human label shown in the loading banner. */
  reloadingDocsLabel?: string | null;
}) {
  const [reloading, setReloading] = useState(false);
  const [reloadError, setReloadError] = useState<string | null>(null);
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

  // Generation gate: Serra's rule is that no artifact may be drafted
  // until the corpus is at least 80% classified (i.e., not sitting in
  // the 'other' bucket and not stuck on an extraction error). A doc
  // that the attorney has manually moved out of 'other' counts as
  // classified, which is why we resolve the override before checking.
  const GENERATE_GATE_PERCENT = 80;
  let classifiedCount = 0;
  for (const { entries } of categoryEntries) {
    for (const { docType, entry } of entries) {
      const ovr = documentOverrides?.[entry.filename] ?? null;
      const effectiveType = ovr?.doc_type_override ?? docType;
      if (!entry.error && effectiveType !== 'other') {
        classifiedCount += 1;
      }
    }
  }
  const classifyPercent =
    totalEntries > 0 ? Math.floor((classifiedCount / totalEntries) * 100) : 0;
  const generateGateOpen = classifyPercent >= GENERATE_GATE_PERCENT;

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
    const canReload = !!matterRoot && !!onReaggregate;
    const canRelink = !matterRoot && !!onRelink;
    if (reloadingDocs) {
      return <DocumentsLoading label={reloadingDocsLabel ?? null} />;
    }
    return (
      <div className="px-9 py-16 grid place-items-center">
        <div className="border border-rule bg-paper grid place-items-center py-12 px-8 text-center max-w-lg">
          <div className="grid gap-4">
            <div
              className="sigil mx-auto"
              style={{ width: '2.4rem', height: '2.4rem', fontSize: '0.85rem' }}
            >
              —
            </div>
            <p className="text-body text-graphite leading-relaxed">
              {canReload
                ? 'Re-loading documents from cache…'
                : canRelink
                  ? 'This matter was ingested before folder paths were remembered. Pick the original folder once and Atelier will keep it linked from now on.'
                  : 'Exhibits are empty. PDFs will appear here as they are classified.'}
            </p>
            {canRelink && (
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  disabled={reloading}
                  onClick={async () => {
                    setReloading(true);
                    setReloadError(null);
                    try {
                      await onRelink!();
                    } catch (e: unknown) {
                      setReloadError(
                        e instanceof Error ? e.message : String(e),
                      );
                    } finally {
                      setReloading(false);
                    }
                  }}
                  className="border border-ink bg-paper px-4 py-1.5 text-meta text-ink hover:bg-ink hover:text-paper disabled:opacity-50 disabled:cursor-wait smcp"
                >
                  {reloading ? 'Loading…' : 'Locate matter folder'}
                </button>
                {reloadError && (
                  <span className="font-mono text-label text-ink" role="alert">
                    {reloadError}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Doc-type bucket list (same shape MatterOverlay uses) so the Exhibits
  // pane can host the Needs Review pile + per-doc inline preview +
  // reclassify directly, without forcing the user into the full overlay.
  const docTypeBuckets = (
    Object.entries(typedMemory) as [DocType, PerPdfMemoryEntry[]][]
  )
    .filter(([, list]) => Array.isArray(list) && list.length > 0)
    .sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="px-9 py-7 grid gap-7">
      <button
        onClick={onOpenMatter}
        className="w-full flex items-baseline justify-between border border-ink bg-paper px-5 py-3 hover:bg-ink hover:text-paper transition-colors group"
      >
        <span className="text-body text-ink font-semibold group-hover:text-paper">
          Open the matter
        </span>
        <span className="font-mono text-meta text-graphite group-hover:text-paper-2">
          {populated.length} sections · {totalEntries} documents →
        </span>
      </button>

      {reloadingDocs && <ReloadingBanner label={reloadingDocsLabel ?? null} />}

      {onSelectEntry && onSetLabel && (
        <MatterDocumentsSection
          buckets={docTypeBuckets}
          matterRoot={matterRoot}
          selectedEntryKey={selectedEntryKey ?? null}
          onSelectEntry={onSelectEntry}
          entryLabels={entryLabels}
          onSetLabel={onSetLabel}
          documentOverrides={documentOverrides ?? null}
          onApplyDocOverride={onApplyDocOverride}
        />
      )}

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
          generateGateOpen={generateGateOpen}
          classifyPercent={classifyPercent}
          generateGateThreshold={GENERATE_GATE_PERCENT}
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
        <section className="border border-rule bg-paper">
          <header className="flex items-baseline justify-between gap-3 px-5 py-3 border-b border-rule paper-recess">
            <span className="smcp text-graphite">recent output</span>
            <span className="font-mono text-meta text-graphite-soft">
              {recentOutput.generator.replace(/_/g, ' ')} · {new Date(recentOutput.approved_at).toLocaleString()}
            </span>
          </header>
          <div className="px-5 py-5 font-mono text-meta">
            {recentOutput.output_path && (
              <div className="text-graphite mb-3 break-all">
                → {recentOutput.output_path}
              </div>
            )}
            {recentOutput.output_inline && (
              <>
                <div className="mb-3 flex gap-2">
                  <button
                    onClick={() =>
                      downloadInlineAsDocx(
                        recentOutput.output_inline ?? '',
                        `${recentOutput.generator}.docx`,
                      )
                    }
                    className="px-3 py-1.5 border border-ink smcp text-meta hover:bg-ink hover:text-paper transition-colors"
                  >
                    download .docx
                  </button>
                  <button
                    onClick={() =>
                      downloadInlineAsMarkdown(
                        recentOutput.output_inline ?? '',
                        `${recentOutput.generator}.md`,
                      )
                    }
                    className="px-3 py-1.5 border border-rule smcp text-meta text-graphite hover:border-ink hover:text-ink transition-colors"
                  >
                    download .md
                  </button>
                </div>
                <details>
                  <summary className="cursor-pointer text-meta text-graphite hover:text-ink">
                    ▸ view inline ({recentOutput.output_inline.length.toLocaleString()} chars)
                  </summary>
                  <pre className="mt-2 whitespace-pre-wrap text-meta bg-paper-deep/30 p-3 max-h-96 overflow-y-auto leading-relaxed">
                    {recentOutput.output_inline}
                  </pre>
                </details>
              </>
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

  // Escape key closes — iframe focus can swallow click events on the
  // header X button, so the keyboard shortcut is the reliable fallback.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      {/* Floating close button outside the iframe, always clickable. */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 z-10 bg-paper border border-graphite/40 px-4 py-2 font-mono text-meta text-ink-2 hover:bg-ink hover:text-paper transition-colors shadow-lg"
        aria-label="Close preview"
      >
        ✕  Close (Esc)
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-paper w-full max-w-5xl h-[90vh] flex flex-col border border-rule-strong"
      >
        <div className="px-6 py-3 border-b border-rule paper-recess flex items-baseline justify-between">
          <div className="grid gap-1 min-w-0">
            <div className="smcp text-graphite">document preview</div>
            <div className="font-mono text-body text-ink-2 truncate max-w-2xl">
              {filename}
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="smcp text-meta px-3 py-2 border border-ink hover:bg-ink hover:text-paper transition-colors shrink-0"
          >
            close · esc
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
  generateGateOpen,
  classifyPercent,
  generateGateThreshold,
  onPickDocument,
}: {
  spec: ExhibitCategorySpec;
  entries: { docType: DocType; entry: PerPdfMemoryEntry }[];
  collapsed: boolean;
  onToggle: () => void;
  entryLabels: Record<string, string>;
  onOpenMatter: () => void;
  onPickGenerator?: (g: PreviewGenerator) => void;
  generateGateOpen: boolean;
  classifyPercent: number;
  generateGateThreshold: number;
  onPickDocument?: (filename: string) => void;
}) {
  const empty = entries.length === 0;
  return (
    <section className="border border-rule bg-paper">
      <button
        onClick={onToggle}
        className="w-full flex items-baseline justify-between px-5 py-3 group hover:bg-paper-deep/30 transition-colors text-left paper-recess border-b border-rule"
      >
        <div className="flex items-baseline gap-3">
          <span className="smcp text-graphite group-hover:text-ink transition-colors">
            {spec.label}
          </span>
          <span className="font-mono text-meta text-graphite-soft tabular-nums">
            {empty ? '—' : `${entries.length} doc${entries.length === 1 ? '' : 's'}`}
          </span>
        </div>
        <span className="font-mono text-meta text-graphite-soft group-hover:text-ink transition-colors">
          {collapsed ? '▸' : '▾'}
        </span>
      </button>

      {!collapsed && (
        <div className="px-5 py-5 grid gap-4">
          {empty ? (
            <div className="text-body text-graphite-soft italic">
              No documents in this category yet.
            </div>
          ) : (
            <ul className="grid gap-2">
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
                    className={`border-l border-rule pl-3 py-2 hover:border-ink transition-colors ${
                      clickable ? 'cursor-pointer' : ''
                    }`}
                    title={clickable ? 'Click to preview the PDF' : undefined}
                  >
                    <div
                      className={`text-body ${clickable ? 'text-ink underline-offset-2 hover:underline decoration-ink-2' : 'text-ink-2'}`}
                    >
                      {display}
                    </div>
                    <div className="font-mono text-meta text-graphite-soft truncate mt-0.5">
                      {DOC_TYPE_LABELS[docType] ?? docType} · {entry.filename}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {spec.generators.length > 0 && (
            <div className="border-t border-rule pt-4 grid gap-2">
              {!generateGateOpen && (
                <p className="font-mono text-meta text-graphite-soft">
                  classify ≥{generateGateThreshold}% of documents before
                  generating · currently {classifyPercent}%
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {spec.generators.map((g) => (
                  <button
                    key={g.generator}
                    disabled={!generateGateOpen}
                    onClick={() => {
                      if (!generateGateOpen) return;
                      if (onPickGenerator) {
                        onPickGenerator(g.generator as PreviewGenerator);
                      } else {
                        onOpenMatter();
                      }
                    }}
                    title={
                      generateGateOpen
                        ? 'Opens the preview → approve modal. NO output ships without attorney sign-off.'
                        : `Locked until ${generateGateThreshold}% of documents are classified (currently ${classifyPercent}%).`
                    }
                    className="text-meta smcp px-3 py-2 border border-ink hover:bg-ink hover:text-paper transition-colors disabled:opacity-40 disabled:hover:bg-paper disabled:hover:text-ink disabled:cursor-not-allowed"
                  >
                    {g.label}
                  </button>
                ))}
              </div>
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
        className="w-full flex items-baseline justify-between pb-2 mb-3 group hover:border-ink transition-colors text-left border-b border-rule"
      >
        <div className="flex items-baseline gap-3">
          <span
            className="font-mono text-meta text-graphite-soft transition-transform group-hover:text-ink"
            style={{
              display: 'inline-block',
              transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
              transformOrigin: '50% 55%',
              width: '0.85rem',
            }}
          >
            ▶
          </span>
          <h2 className="smcp text-graphite group-hover:text-ink transition-colors">
            {DOC_TYPE_LABEL[docType]}
          </h2>
          <span className="font-mono text-meta text-graphite-soft tabular-nums">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
        <span className="font-mono text-label text-graphite-soft">
          {docType}
        </span>
      </button>
      {!collapsed && (
        <ul className="grid gap-1.5">
          {entries.map((e) => {
            const key = entryKey(docType, e.filename);
            const label = entryLabels[key] ?? getSuggestedDocLabel(e);
            return (
              <li key={key}>
                <button
                  onClick={onOpenMatter}
                  className="w-full text-left flex items-baseline gap-2 px-3 py-2 border-l border-rule hover:border-ink hover:bg-paper-deep/30 transition-colors group"
                >
                  <span className="shrink-0 font-mono text-meta text-graphite-soft group-hover:text-ink">
                    →
                  </span>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-body text-ink-2 truncate group-hover:text-ink"
                      title={label}
                    >
                      {label}
                    </div>
                    <div
                      className="font-mono text-label text-graphite-soft truncate mt-0.5"
                      title={e.filename}
                    >
                      {e.filename}
                    </div>
                  </div>
                  {e.error && (
                    <span className="shrink-0 smcp text-ink font-semibold">
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
      <div className="text-meta italic text-graphite-soft mt-1">
        all fields null
      </div>
    );
  }
  return (
    <dl className="mt-1 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-meta">
      {rows.map((r) => (
        <Fragment key={r.key}>
          <dt className="font-mono text-label text-graphite tracking-wide">{r.key}</dt>
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
    ['E-2', 'Treaty Investor'],
    ['EB-1A', 'Extraordinary Ability'],
    ['EB-1B', 'Outstanding Researcher'],
    ['EB-1C', 'Multinational Manager'],
  ] as const;
  return (
    <section className="min-h-0 grid place-items-center paper-grain px-12">
      <div className="max-w-[640px] text-center">
        <h1
          className="font-display text-stunt text-ink"
          style={{
            fontVariationSettings: '"opsz" 144, "SOFT" 0, "WONK" 0',
            fontWeight: 300,
            letterSpacing: '-0.025em',
            lineHeight: 0.95,
          }}
        >
          Drop a dossier.
        </h1>
        <p className="mt-12 text-lede text-ink-2 leading-relaxed">
          PDFs, folders, exhibits &mdash; anything bound for USCIS.
        </p>
        <div className="mt-14 grid grid-cols-4 gap-x-4 gap-y-2 border-t border-b border-rule py-5">
          {caseTypes.map(([code, label]) => (
            <div key={code} className="grid gap-1">
              <div className="font-mono text-meta text-graphite">{code}</div>
              <div className="text-meta text-graphite-soft">{label}</div>
            </div>
          ))}
        </div>
        <p className="mt-10 text-body text-graphite leading-relaxed">
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

/**
 * Phase 11 — re-runs the cross-document aggregator (`aggregateTypedMemoryToE2`)
 * via /api/re-aggregate without re-extracting any PDFs. The per-PDF
 * cache (lib/pdf-cache) makes this near-free for the per-document Haiku
 * step; the only real cost is the matter-level Sonnet aggregator (~30s).
 *
 * Mirrors the Phase-9 "Re-run review" button pattern (DeterministicGatesPanel)
 * but at the aggregation layer. Replaces caseFacts + aggregate_audit on
 * success; leaves draft/review untouched (the attorney can re-run review
 * separately from the review pane).
 */
function ReAggregateButton({
  matterRoot,
  onResultUpdate,
  onReaggregate,
}: {
  matterRoot: string;
  onResultUpdate: (updater: (r: IngestResult) => IngestResult) => void;
  onReaggregate?: () => Promise<void>;
}) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setRunning(true);
    setError(null);
    if (onReaggregate) {
      try {
        await onReaggregate();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setRunning(false);
      }
      return;
    }
    try {
      const res = await fetch('/api/re-aggregate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matter_root: matterRoot }),
      });
      const data = (await res.json()) as {
        result?: IngestResult;
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.result) {
        setError(data.message ?? data.error ?? `HTTP ${res.status}`);
        return;
      }
      const next = data.result;
      // Failure shape — surface the error and bail without touching state.
      if ('error' in next && next.error) {
        setError(`${next.error.code}: ${next.error.message}`);
        return;
      }
      onResultUpdate((r) => {
        if ('error' in r && r.error) return r;
        // Replace the matter-level facts + deterministic gate rows from
        // the fresh aggregate; preserve draft / review / e2_subtype so
        // the attorney's downstream work survives.
        return {
          ...r,
          caseFacts: next.caseFacts ?? r.caseFacts,
          aggregate_audit: next.aggregate_audit ?? r.aggregate_audit,
          source_pdfs: next.source_pdfs ?? r.source_pdfs,
          pageCount: next.pageCount ?? r.pageCount,
          detection_confidence:
            next.detection_confidence ?? r.detection_confidence,
          detection_reasoning:
            next.detection_reasoning ?? r.detection_reasoning,
        };
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={running}
        title="Re-run the matter-level aggregator against the cached per-PDF extracts. No PDFs are re-parsed; the cover letter and review are untouched."
        className={
          'smcp text-meta px-3 py-1 border border-rule-strong bg-paper hover:bg-stone-50 disabled:opacity-50 disabled:cursor-wait ' +
          (running ? 'animate-pulse' : '')
        }
      >
        {running ? 'Re-aggregating…' : 'Re-aggregate'}
      </button>
      {error && (
        <span className="font-mono text-meta text-ink" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}

function DossierHeader({
  result,
  matterRoot,
  onResultUpdate,
  matterDisplayName,
  onSetMatterDisplayName,
  onReaggregate,
}: {
  result: IngestResult;
  matterRoot?: string | null;
  onResultUpdate?: (updater: (r: IngestResult) => IngestResult) => void;
  matterDisplayName?: string | null;
  onSetMatterDisplayName?: (value: string | null) => Promise<boolean> | boolean;
  onReaggregate?: () => Promise<void>;
}) {
  const caseType = result.caseFacts?.case_type;
  const conf = result.detection_confidence;
  const assessment = result.review?.overall_assessment;
  const clientName = guessClientName(result);
  const autoDerivedName = deriveAutoMatterName(result);
  // Matter title preference: manual override → auto-derived (investor ·
  // company · E-2) → source-folder basename. Source folder is the last
  // resort so dossiers never lead with `OneDrive_xyz` garbage.
  const effectiveMatterName =
    (matterDisplayName ?? '').trim() || autoDerivedName || result.filename;
  const matterRenamed =
    !!matterDisplayName && matterDisplayName !== effectiveMatterName;

  const [editingMatterName, setEditingMatterName] = useState(false);
  const [matterNameDraft, setMatterNameDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const saveMatterName = async (raw: string) => {
    if (!onSetMatterDisplayName) {
      setEditingMatterName(false);
      return;
    }
    const trimmed = raw.trim();
    setSaving(true);
    setSaveError(null);
    try {
      // Empty input clears the override; same name as folder also clears.
      const next = trimmed.length === 0 || trimmed === result.filename ? null : trimmed;
      const ok = await onSetMatterDisplayName(next);
      if (!ok) {
        setSaveError(
          matterRoot
            ? 'Save failed — see console.'
            : 'Re-pick the folder first (matter root unset).',
        );
        return;
      }
      setEditingMatterName(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <header className="px-9 pt-7 pb-5">
      <div className="flex items-center gap-3 font-mono text-meta text-graphite mb-3">
        {editingMatterName ? (
          <span className="flex items-center gap-2">
            <input
              autoFocus
              value={matterNameDraft}
              disabled={saving}
              onChange={(e) => setMatterNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void saveMatterName(matterNameDraft);
                else if (e.key === 'Escape') {
                  setSaveError(null);
                  setEditingMatterName(false);
                }
              }}
              className="font-mono text-meta text-ink bg-transparent border-b border-ink outline-none min-w-[10rem] max-w-[20rem] truncate"
              placeholder={result.filename}
              aria-label="Rename matter"
              maxLength={200}
            />
            {saving && (
              <span className="font-mono text-label text-graphite-soft animate-pulse">
                saving…
              </span>
            )}
            {saveError && (
              <span
                className="font-mono text-label text-ink border border-ink px-1.5 py-0.5"
                role="alert"
              >
                {saveError}
              </span>
            )}
          </span>
        ) : (
          <span className="flex items-center gap-2 min-w-0">
            <span className="truncate" title={effectiveMatterName}>
              {effectiveMatterName}
            </span>
            {onSetMatterDisplayName && (
              <button
                type="button"
                onClick={() => {
                  setMatterNameDraft(effectiveMatterName);
                  setEditingMatterName(true);
                }}
                title="Rename matter (display only — source folder is not renamed)"
                aria-label="Rename matter"
                className="shrink-0 inline-flex items-center justify-center w-6 h-6 border border-rule text-graphite hover:text-ink hover:border-rule-strong hover:bg-paper-2 transition-colors"
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" />
                  <path d="M9.5 3.5l3 3" />
                </svg>
              </button>
            )}
          </span>
        )}
        {matterRenamed && !editingMatterName && (
          <span
            className="font-mono text-label text-graphite-soft truncate"
            title={`source folder: ${result.filename}`}
          >
            ({result.filename})
          </span>
        )}
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
        {matterRoot && onResultUpdate && (
          <span className="ml-auto">
            <ReAggregateButton
              matterRoot={matterRoot}
              onResultUpdate={onResultUpdate}
              onReaggregate={onReaggregate}
            />
          </span>
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
      {result.e2_subtype && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="font-mono text-meta border border-rule px-2 py-0.5 text-ink">
            {SUBTYPE_BADGE_LABEL[result.e2_subtype.principal_subtype] ??
              result.e2_subtype.principal_subtype}
          </span>
          <span className="font-mono text-meta border border-rule px-2 py-0.5 text-graphite">
            {POSTURE_BADGE_LABEL[result.e2_subtype.procedural_posture] ??
              result.e2_subtype.procedural_posture}
          </span>
          {result.e2_subtype.detection_confidence && (
            <span
              className="font-mono text-meta px-2 py-0.5 border"
              style={{
                color: SUBTYPE_CONF_COLOR[result.e2_subtype.detection_confidence],
                borderColor: SUBTYPE_CONF_COLOR[result.e2_subtype.detection_confidence],
              }}
            >
              {result.e2_subtype.detection_confidence}
            </span>
          )}
          {result.e2_subtype.has_dependents && (
            <span className="font-mono text-meta border border-rule px-2 py-0.5 text-graphite">
              + dependents
            </span>
          )}
          {result.e2_subtype.reasoning && (
            <details className="text-meta text-graphite-soft">
              <summary className="cursor-pointer hover:text-graphite">why?</summary>
              <p className="mt-1 leading-snug max-w-prose">{result.e2_subtype.reasoning}</p>
            </details>
          )}
        </div>
      )}
    </header>
  );
}

const SUBTYPE_BADGE_LABEL: Record<string, string> = {
  individual_investor: 'Subtype 1 · Individual',
  corporate_owned_investor: 'Subtype 2 · Corporate-owned',
  executive_supervisory_employee: 'Subtype 3 · Executive',
  essential_skills_employee: 'Subtype 4 · Essential skills',
};
const POSTURE_BADGE_LABEL: Record<string, string> = {
  consular_new: 'Consular · new',
  consular_renewal: 'Consular · renewal',
  uscis_cos_new: 'USCIS · COS',
  uscis_extension: 'USCIS · extension',
};
const SUBTYPE_CONF_COLOR: Record<string, string> = {
  HIGH: '#15803D',
  MED: '#A16207',
  LOW: '#B91C1C',
};

/**
 * Compose the matter's auto-derived display name from extracted facts:
 * "<investor> · <company> · <case type>". Falls back to whichever pieces
 * are available; only returns null if no facts have landed yet.
 *
 * Used as the default matter title so the dossier never shows raw
 * `OneDrive_xyz` source-folder garbage. The user can still override via
 * the pen icon in the header (matter_display_name in the override store).
 */
function deriveAutoMatterName(r: IngestResult | undefined): string | null {
  if (!r) return null;
  const facts = r.caseFacts?.facts as Record<string, unknown> | undefined;
  if (!facts) return null;

  const readScalar = (v: unknown): string | null => {
    if (isFieldLeaf(v) && typeof v.value === 'string') return v.value.trim() || null;
    if (typeof v === 'string') return v.trim() || null;
    return null;
  };

  let investor: string | null = null;
  for (const k of ['petitioner_name', 'beneficiary_name', 'investor_name', 'name']) {
    investor = readScalar(facts[k]);
    if (investor) break;
  }
  if (!investor) {
    for (const top of ['investor', 'petitioner', 'beneficiary', 'principal']) {
      const obj = facts[top];
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const o = obj as Record<string, unknown>;
        investor =
          readScalar(o.full_name) ??
          readScalar(o.name) ??
          readScalar(o.full_name_ascii);
        if (investor) break;
      }
    }
  }

  let company: string | null = null;
  const ent = facts.enterprise as Record<string, unknown> | undefined;
  if (ent && typeof ent === 'object') {
    company =
      readScalar(ent.legal_name) ??
      readScalar(ent.dba) ??
      readScalar(ent.name);
  }
  if (!company) {
    company =
      readScalar(facts.enterprise_name) ??
      readScalar(facts.company_name) ??
      null;
  }

  const caseTypeRaw = r.caseFacts?.case_type;
  const caseTypeLabel = (() => {
    if (!caseTypeRaw) return null;
    if (caseTypeRaw === 'E2') return 'E-2';
    if (caseTypeRaw === 'EB1A') return 'EB-1A';
    if (caseTypeRaw === 'EB1B') return 'EB-1B';
    if (caseTypeRaw === 'EB1C') return 'EB-1C';
    return caseTypeRaw;
  })();

  const parts = [investor, company, caseTypeLabel].filter(
    (p): p is string => !!p && p.length > 0,
  );
  if (parts.length === 0) return null;
  return parts.join(' · ');
}

function guessClientName(r: IngestResult): string {
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
    // E-2 / EB-1 schemas put the human name under investor.full_name /
    // beneficiary.full_name, not nested .name. Check both forms.
    for (const top of ['investor', 'petitioner', 'beneficiary', 'principal', 'employer']) {
      const obj = facts[top];
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const o = obj as Record<string, unknown>;
        for (const inner of [o.full_name, o.name, o.full_name_ascii]) {
          if (isFieldLeaf(inner) && typeof inner.value === 'string') return inner.value;
          if (typeof inner === 'string') return inner;
        }
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
    { key: 'audit', label: 'Audit' },
    { key: 'binder', label: 'Binder' },
    { key: 'context', label: 'Context' },
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
                    ? 'border-ink text-ink'
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
      <MissingFieldsList facts={facts} />
      <StructuredFactsPanel
        facts={facts}
        typedMemory={typedMemory}
        matterId={matterId}
      />
      <details className="border border-rule paper-recess">
        <summary className="cursor-pointer px-5 py-3 font-mono text-meta text-graphite hover:bg-ink/5">
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

function isFieldWrapper(v: unknown): v is { value: unknown; source_page?: number | null; source_quote?: string | null; confidence?: number | null } {
  return (
    !!v &&
    typeof v === 'object' &&
    'value' in (v as Record<string, unknown>) &&
    'source_quote' in (v as Record<string, unknown>) &&
    'confidence' in (v as Record<string, unknown>)
  );
}

function isMissingValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' || /^\[MISSING(:[^\]]*)?\]$/i.test(t);
  }
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function collectMissingPaths(node: unknown, prefix: string, out: string[]): void {
  if (node === null || node === undefined) return;
  if (typeof node !== 'object') return;
  if (isFieldWrapper(node)) {
    if (isMissingValue(node.value)) out.push(prefix || '(root)');
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, i) => collectMissingPaths(item, `${prefix}[${i}]`, out));
    return;
  }
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    collectMissingPaths(v, prefix ? `${prefix}.${k}` : k, out);
  }
}

function humanizePath(p: string): string {
  return p
    .replace(/\[\d+\]/g, '')
    .split('.')
    .map((seg) => seg.replace(/_/g, ' '))
    .join(' › ');
}

function MissingFieldsList({ facts }: { facts: Record<string, unknown> }) {
  const missing = useMemo(() => {
    const out: string[] = [];
    collectMissingPaths(facts, '', out);
    // Dedupe while preserving order.
    const seen = new Set<string>();
    return out.filter((p) => (seen.has(p) ? false : (seen.add(p), true)));
  }, [facts]);

  if (missing.length === 0) {
    return (
      <section className="border border-rule paper-recess px-5 py-4">
        <div className="smcp text-graphite-soft mb-1">missing</div>
        <div className="text-body text-graphite">
          Nothing missing — every field surfaced by the extractors carries a value.
        </div>
      </section>
    );
  }

  return (
    <section className="border border-rule paper-recess">
      <header className="px-5 py-3 border-b border-rule flex items-baseline justify-between">
        <span className="smcp text-ink ">·  missing fields</span>
        <span className="font-mono text-meta text-graphite-soft tabular-nums">
          {missing.length} {missing.length === 1 ? 'item' : 'items'}
        </span>
      </header>
      <ul className="px-5 py-4 grid gap-1.5 text-body text-graphite leading-snug list-disc list-inside">
        {missing.map((p) => (
          <li key={p} className="font-mono text-meta">
            <span className="text-ink">{humanizePath(p)}</span>
            <span className="text-graphite-soft text-label ml-2">{p}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------------------------------------------------------------- */
/* Audit pane — checklist of required E-2 proof slots and what's missing  */
/* ---------------------------------------------------------------------- */

const POSTURE_OPTIONS: { value: CaseProfile['posture']; label: string }[] = [
  { value: 'consular_first_time', label: 'Consular — first time' },
  { value: 'consular_renewal', label: 'Consular — renewal' },
  { value: 'uscis_change_of_status', label: 'USCIS — change of status' },
  { value: 'uscis_extension', label: 'USCIS — extension' },
];

const SUBTYPE_OPTIONS: { value: CaseProfile['principal_subtype']; label: string }[] = [
  { value: 'individual_investor', label: 'Subtype 1 — Individual investor' },
  { value: 'corporate_owned_investor', label: 'Subtype 2 — Corporate-owned investor' },
  { value: 'executive_supervisory', label: 'Subtype 3 — Executive / supervisory' },
  { value: 'essential_skills_employee', label: 'Subtype 4 — Essential skills employee' },
];

const STAGE_OPTIONS: { value: CaseProfile['stage']; label: string }[] = [
  { value: 'pre_launch', label: 'Pre-launch (Walsh & Pollard)' },
  { value: 'early_stage', label: 'Early stage (<12 mo)' },
  { value: 'operating', label: 'Operating (≥12 mo)' },
];

const VEHICLE_OPTIONS: { value: Vehicle; label: string }[] = [
  { value: 'restaurant_food_service', label: 'Restaurant / food service' },
  { value: 'franchise', label: 'Franchise' },
  { value: 'tech_saas', label: 'Tech / SaaS' },
  { value: 'consulting_services', label: 'Consulting services' },
  { value: 'professional_services', label: 'Professional services' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'real_estate_active', label: 'Real estate (active)' },
  { value: 'hospitality_lodging', label: 'Hospitality / lodging' },
  { value: 'healthcare_clinic', label: 'Healthcare / clinic' },
  { value: 'beauty_personal_care', label: 'Beauty / personal care' },
  { value: 'fitness_wellness', label: 'Fitness / wellness' },
  { value: 'automotive_services', label: 'Automotive services' },
  { value: 'construction_trades', label: 'Construction / trades' },
  { value: 'import_export_trade', label: 'Import / export' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'retail_brick_mortar', label: 'Retail (brick & mortar)' },
  { value: 'education_training', label: 'Education / training' },
  { value: 'media_entertainment', label: 'Media / entertainment' },
  { value: 'other', label: 'Other' },
];

const ORIGIN_OPTIONS: { value: FundsOrigin; label: string }[] = [
  { value: 'salary_employment', label: 'Salary' },
  { value: 'business_profits_dividends', label: 'Business profits / dividends' },
  { value: 'sale_of_real_estate', label: 'Sale of real estate' },
  { value: 'sale_of_business_or_shares', label: 'Sale of business / shares' },
  { value: 'inheritance', label: 'Inheritance' },
  { value: 'gift', label: 'Gift' },
  { value: 'loan_personal_collateral', label: 'Loan (non-business collateral)' },
  { value: 'personal_savings', label: 'Personal savings' },
  { value: 'cryptocurrency', label: 'Cryptocurrency' },
  { value: 'rental_income', label: 'Rental income' },
  { value: 'investment_portfolio_sale', label: 'Investment portfolio sale' },
];

const NATIONALITY_OPTIONS: { value: CaseProfile['nationality_path']; label: string }[] = [
  { value: 'birth', label: 'Birth' },
  { value: 'descent', label: 'Descent' },
  { value: 'marriage', label: 'Marriage' },
  { value: 'naturalization_residency', label: 'Naturalization (residency-based)' },
  { value: 'cbi_investment', label: 'CBI — citizenship by investment (AMIGOS)' },
];

const POST_OPTIONS: { value: ConsularPost; label: string }[] = [
  { value: 'istanbul', label: 'Istanbul' },
  { value: 'ankara', label: 'Ankara' },
  { value: 'tokyo', label: 'Tokyo' },
  { value: 'osaka_kobe', label: 'Osaka-Kobe' },
  { value: 'naha', label: 'Naha' },
  { value: 'frankfurt', label: 'Frankfurt' },
  { value: 'paris', label: 'Paris' },
  { value: 'london', label: 'London' },
  { value: 'toronto', label: 'Toronto' },
  { value: 'seoul', label: 'Seoul' },
  { value: 'madrid', label: 'Madrid' },
  { value: 'rome', label: 'Rome' },
  { value: 'other', label: 'Other / unknown' },
];

const FAM_GROUPS: { fam: string; label: string }[] = [
  { fam: 'E1_treaty_nationality', label: 'E1 — Treaty Nationality' },
  { fam: 'E2_substantial_investment', label: 'E2 — Substantial Investment' },
  { fam: 'E2_source_of_funds', label: 'E2 — Source of Funds' },
  { fam: 'E2_at_risk', label: 'E2 — At Risk' },
  { fam: 'E3_real_and_operating', label: 'E3 — Real & Operating' },
  { fam: 'E4_more_than_marginal', label: 'E4 — More than Marginal' },
  { fam: 'E5_develop_and_direct', label: 'E5 — Develop & Direct' },
];

function severityClasses(sev: Severity, status: SlotResolution['status']): string {
  if (status === 'filled') return 'border-l-2 border-l-transparent';
  if (sev >= 5) return 'border-l-2 border-l-[#B91C1C] bg-[#B91C1C]/[0.04]';
  if (sev >= 4) return 'border-l-2 border-l-[#C2410C] bg-[#C2410C]/[0.04]';
  if (sev >= 3) return 'border-l-2 border-l-[#A16207] bg-[#A16207]/[0.03]';
  return 'border-l-2 border-l-rule';
}

function severityChip(sev: Severity): { color: string; label: string } {
  if (sev >= 5) return { color: '#B91C1C', label: `sev ${sev}` };
  if (sev >= 4) return { color: '#C2410C', label: `sev ${sev}` };
  if (sev >= 3) return { color: '#A16207', label: `sev ${sev}` };
  return { color: '#595959', label: `sev ${sev}` };
}

function loadStoredProfile(matterId: string | undefined): CaseProfile | null {
  if (!matterId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`e2-profile:${matterId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CaseProfile;
    if (parsed?.visa_class !== 'E2') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Pull provenance-wrapped value (`{ value, source_quote, ... }`) or return raw. */
function unwrapField<T = unknown>(field: unknown): T | undefined {
  if (field && typeof field === 'object' && 'value' in (field as Record<string, unknown>)) {
    return (field as { value: T }).value;
  }
  return field as T | undefined;
}

function clampSeverity(n: unknown): Severity {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 1;
  return Math.min(5, Math.max(1, Math.round(v))) as Severity;
}

/** Read the LLM-emitted `conflict_register` from caseFacts.facts and convert
 *  to ConflictRegisterEntry[] for the audit. Each entry's fields are
 *  provenance-wrapped (`Field<T>` → `{ value, source_page, source_quote, ... }`),
 *  so unwrap before mapping. */
function readConflictRegister(
  facts: Record<string, unknown> | undefined,
): ConflictRegisterEntry[] {
  if (!facts) return [];
  const raw = facts.conflict_register;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry, idx): ConflictRegisterEntry | null => {
      if (!entry || typeof entry !== 'object') return null;
      const e = entry as Record<string, unknown>;
      const description = unwrapField<string>(e.description) ?? '';
      const conflictType = unwrapField<string>(e.conflict_type) ?? `conflict_${idx}`;
      const severity = clampSeverity(unwrapField(e.severity));
      const factADoc = unwrapField<string>(e.fact_a_doc) ?? '';
      const factAPage = unwrapField<number>(e.fact_a_page);
      const factBDoc = unwrapField<string>(e.fact_b_doc) ?? '';
      const factBPage = unwrapField<number>(e.fact_b_page);
      if (!description) return null;
      return {
        id: `${conflictType}_${idx}`,
        description,
        severity,
        evidence: [
          {
            pdf_path: factADoc,
            doc_type_id: 'unknown',
            field_name: conflictType,
            value: factAPage ?? '',
          },
          {
            pdf_path: factBDoc,
            doc_type_id: 'unknown',
            field_name: conflictType,
            value: factBPage ?? '',
          },
        ].filter((ev) => ev.pdf_path),
      };
    })
    .filter((x): x is ConflictRegisterEntry => x !== null);
}

function buildEntriesFromMemory(typedMemory: TypedMemory): MemoryPdfEntry[] {
  const entries: MemoryPdfEntry[] = [];
  for (const [, list] of Object.entries(typedMemory)) {
    for (const entry of list ?? []) {
      const sub = entry.subtypes ?? {};
      // The from-memory adapter expects rich extraction objects keyed by
      // their _subtype discriminator string. Reconstruct minimal shapes
      // from the forwarded discriminators — that's all the adapter reads.
      entries.push({
        filename: entry.filename,
        pageCount: entry.pageCount,
        facts: { doc_type: entry.doc_type ?? undefined },
        corporateFormation: sub.formation_doc_subtype
          ? { formation_doc_subtype: sub.formation_doc_subtype }
          : undefined,
        contract: sub.contract_subtype ? { contract_subtype: sub.contract_subtype } : undefined,
        governmentDoc: sub.government_doc_subtype
          ? { government_doc_subtype: sub.government_doc_subtype }
          : undefined,
        taxReturn: sub.tax_return_subtype
          ? { tax_return_subtype: sub.tax_return_subtype }
          : undefined,
        financialStatement: sub.statement_subtype
          ? { statement_subtype: sub.statement_subtype }
          : undefined,
        credential: sub.credential_subtype
          ? { credential_subtype: sub.credential_subtype }
          : undefined,
        payroll: sub.payroll_subtype ? { payroll_subtype: sub.payroll_subtype } : undefined,
        wireConfirmation: sub.wire_subtype ? { wire_subtype: sub.wire_subtype } : undefined,
        vitalRecords: sub.vital_record_subtype
          ? { vital_record_subtype: sub.vital_record_subtype }
          : undefined,
        foreignCorporate: sub.foreign_doc_subtype
          ? { foreign_doc_subtype: sub.foreign_doc_subtype }
          : undefined,
      });
    }
  }
  return entries;
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <label className="smcp text-graphite-soft">{label}</label>
      {children}
    </div>
  );
}

function CaseProfileEditor({
  profile,
  onChange,
}: {
  profile: CaseProfile;
  onChange: (next: CaseProfile) => void;
}) {
  const update = <K extends keyof CaseProfile>(key: K, value: CaseProfile[K]) =>
    onChange({ ...profile, [key]: value });

  const toggleOrigin = (o: FundsOrigin) => {
    const has = profile.funds_origins.includes(o);
    const next = has ? profile.funds_origins.filter((x) => x !== o) : [...profile.funds_origins, o];
    update('funds_origins', next.length === 0 ? ['personal_savings'] : next);
  };

  const isConsular = profile.posture.startsWith('consular_');

  return (
    <details className="border border-rule paper-recess" open>
      <summary className="cursor-pointer px-5 py-3 font-mono text-meta text-graphite hover:bg-ink/5">
        ▾ case profile
      </summary>
      <div className="grid gap-4 px-5 py-4 border-t border-rule grid-cols-1 md:grid-cols-2">
        <FieldRow label="Posture">
          <select
            className="border border-rule bg-paper px-2 py-1 text-meta w-full"
            value={profile.posture}
            onChange={(e) => update('posture', e.target.value as CaseProfile['posture'])}
          >
            {POSTURE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Principal subtype">
          <select
            className="border border-rule bg-paper px-2 py-1 text-meta w-full"
            value={profile.principal_subtype}
            onChange={(e) =>
              update('principal_subtype', e.target.value as CaseProfile['principal_subtype'])
            }
          >
            {SUBTYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Stage">
          <select
            className="border border-rule bg-paper px-2 py-1 text-meta w-full"
            value={profile.stage}
            onChange={(e) => update('stage', e.target.value as CaseProfile['stage'])}
          >
            {STAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Vehicle">
          <select
            className="border border-rule bg-paper px-2 py-1 text-meta w-full"
            value={profile.vehicle}
            onChange={(e) => update('vehicle', e.target.value as Vehicle)}
          >
            {VEHICLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Nationality path">
          <select
            className="border border-rule bg-paper px-2 py-1 text-meta w-full"
            value={profile.nationality_path}
            onChange={(e) =>
              update('nationality_path', e.target.value as CaseProfile['nationality_path'])
            }
          >
            {NATIONALITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Treaty country (ISO 3-letter)">
          <input
            className="border border-rule bg-paper px-2 py-1 text-meta w-full font-mono uppercase"
            placeholder="TUR"
            maxLength={3}
            value={profile.treaty_country}
            onChange={(e) => update('treaty_country', e.target.value.toUpperCase())}
          />
        </FieldRow>
        {isConsular && (
          <FieldRow label="Consular post">
            <select
              className="border border-rule bg-paper px-2 py-1 text-meta w-full"
              value={profile.post ?? 'other'}
              onChange={(e) => update('post', e.target.value as ConsularPost)}
            >
              {POST_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FieldRow>
        )}
        <FieldRow label="Has dependents">
          <div className="flex items-center gap-3 text-meta flex-wrap">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={profile.has_dependents}
                onChange={(e) => {
                  const has = e.target.checked;
                  if (has) {
                    onChange({
                      ...profile,
                      has_dependents: true,
                      dependent_breakdown: profile.dependent_breakdown ?? {
                        spouse: false,
                        children_under_21: 0,
                      },
                    });
                  } else {
                    onChange({
                      ...profile,
                      has_dependents: false,
                      dependent_breakdown: null,
                    });
                  }
                }}
              />
              <span>yes</span>
            </label>
            {profile.has_dependents && (
              <>
                <label className="inline-flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={profile.dependent_breakdown?.spouse ?? false}
                    onChange={(e) =>
                      onChange({
                        ...profile,
                        dependent_breakdown: {
                          spouse: e.target.checked,
                          children_under_21:
                            profile.dependent_breakdown?.children_under_21 ?? 0,
                        },
                      })
                    }
                  />
                  <span>spouse</span>
                </label>
                <label className="inline-flex items-center gap-1.5">
                  <span>children &lt;21:</span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    className="border border-rule bg-paper px-2 py-0.5 w-16 text-meta tabular-nums"
                    value={profile.dependent_breakdown?.children_under_21 ?? 0}
                    onChange={(e) =>
                      onChange({
                        ...profile,
                        dependent_breakdown: {
                          spouse: profile.dependent_breakdown?.spouse ?? false,
                          children_under_21: Math.max(0, parseInt(e.target.value, 10) || 0),
                        },
                      })
                    }
                  />
                </label>
              </>
            )}
          </div>
        </FieldRow>
        <div className="md:col-span-2">
          <FieldRow label="Funds origins (one or more)">
            <div className="flex flex-wrap gap-1.5">
              {ORIGIN_OPTIONS.map((o) => {
                const active = profile.funds_origins.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggleOrigin(o.value)}
                    className={
                      'border px-2 py-0.5 text-meta transition-colors ' +
                      (active
                        ? 'border-ink bg-ink text-paper'
                        : 'border-rule text-graphite hover:bg-ink/5')
                    }
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </FieldRow>
        </div>
      </div>
    </details>
  );
}

function SlotRow({
  resolution,
  matterRoot,
  onOpenMatter,
  onOpenPdf,
  muted,
}: {
  resolution: SlotResolution;
  matterRoot: string | null;
  onOpenMatter: () => void;
  onOpenPdf?: (filename: string) => void;
  muted?: boolean;
}) {
  const slot = PROOF_SLOTS_BY_ID[resolution.slot_id];
  const filled = resolution.status === 'filled';
  const chip = severityChip(resolution.effective_severity);
  return (
    <li
      className={
        'paper-recess border border-rule px-4 py-2 ' +
        severityClasses(resolution.effective_severity, resolution.status)
      }
    >
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-meta tabular-nums w-5 text-graphite-soft">
          {filled ? '✓' : '·'}
        </span>
        <div className="flex-1 min-w-0">
          <div className={'font-mono text-meta ' + (muted ? 'text-graphite' : 'text-ink')}>
            {resolution.slot_id}
          </div>
          {slot?.description && (
            <div className="text-meta text-graphite mt-0.5 leading-snug">{slot.description}</div>
          )}
          {resolution.filled_by.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {resolution.filled_by.map((ex, i) => (
                <button
                  key={`${ex.pdf_path}:${i}`}
                  type="button"
                  onClick={() => (onOpenPdf ? onOpenPdf(ex.pdf_path) : onOpenMatter())}
                  title={matterRoot ? `${matterRoot}/${ex.pdf_path}` : ex.pdf_path}
                  className="border border-rule px-2 py-0.5 text-meta font-mono text-graphite hover:bg-ink/5 truncate max-w-[24rem]"
                >
                  {trimFilename(ex.pdf_path)} · APS {ex.effective_aps}
                </button>
              ))}
            </div>
          )}
          {!filled && slot?.requires_one_of && slot.requires_one_of.length > 0 && (
            <div className="mt-1 text-meta text-graphite-soft font-mono">
              needs:{' '}
              {slot.requires_one_of
                .slice(0, 3)
                .map((id) => DOC_TYPES_BY_ID[id]?.name ?? id)
                .join(' · ')}
              {slot.requires_one_of.length > 3 ? ` · +${slot.requires_one_of.length - 3}` : ''}
            </div>
          )}
        </div>
        <span className="text-meta font-mono whitespace-nowrap" style={{ color: chip.color }}>
          {chip.label}
        </span>
      </div>
    </li>
  );
}

function AuditPane({
  typedMemory,
  caseFacts,
  matterId,
  matterRoot,
  onOpenMatter,
  onOpenPdf,
  aggregateAudit,
}: {
  typedMemory: TypedMemory;
  caseFacts: { case_type: CaseType; facts: Record<string, unknown> } | undefined;
  matterId: string | undefined;
  matterRoot: string | null;
  onOpenMatter: () => void;
  onOpenPdf?: (filename: string) => void;
  aggregateAudit?: AggregateAuditPayload;
}) {
  const initialProfile = useMemo<CaseProfile | null>(() => {
    if (caseFacts?.case_type !== 'E2') return null;
    const stored = loadStoredProfile(matterId);
    if (stored) return stored;
    const detected = ((caseFacts.facts as { e2_subtype?: unknown }).e2_subtype ?? null) as
      | DetectedSubtypeShape
      | null;
    return deriveCaseProfile(detected);
  }, [caseFacts, matterId]);

  const [profile, setProfile] = useState<CaseProfile | null>(initialProfile);

  useEffect(() => {
    if (!profile || !matterId || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(`e2-profile:${matterId}`, JSON.stringify(profile));
    } catch {
      // localStorage unavailable / quota — silent
    }
  }, [profile, matterId]);

  const report = useMemo(() => {
    if (!profile) return null;
    const entries = buildEntriesFromMemory(typedMemory);
    const llmConflicts = readConflictRegister(caseFacts?.facts);
    const gateConflicts = aggregateGatesToConflicts(aggregateAudit);
    return auditFromMemory({
      case_profile: profile,
      entries,
      conflicts: [...gateConflicts, ...llmConflicts],
    });
  }, [profile, typedMemory, caseFacts, aggregateAudit]);

  if (caseFacts?.case_type !== 'E2' || !profile || !report) {
    return (
      <div className="px-9 py-7 fade-in">
        <p className="text-graphite">
          Audit is currently E-2 only. Open an E-2 matter to see the proof-slot checklist.
        </p>
      </div>
    );
  }

  const required = report.resolutions.filter((r) => r.requirement === 'required');
  const recommended = report.resolutions.filter((r) => r.requirement === 'recommended');
  const filledRequired = required.filter((r) => r.status === 'filled').length;

  // Group required slots by FAM element (first match wins so each slot
  // surfaces in exactly one section).
  const groupedRequired: Record<string, SlotResolution[]> = {};
  const seen = new Set<string>();
  for (const group of FAM_GROUPS) {
    groupedRequired[group.fam] = [];
    for (const r of required) {
      if (seen.has(r.slot_id)) continue;
      const slot = PROOF_SLOTS_BY_ID[r.slot_id];
      if (!slot) continue;
      if (slot.fam_elements.includes(group.fam as never)) {
        groupedRequired[group.fam].push(r);
        seen.add(r.slot_id);
      }
    }
  }
  const ungrouped = required.filter((r) => !seen.has(r.slot_id));

  return (
    <div className="px-9 py-7 grid gap-6 fade-in">
      <header>
        <div className="smcp text-graphite-soft mb-1">missingness audit</div>
        <h2 className="text-title font-bold leading-snug">
          {filledRequired} of {required.length} required slots filled
        </h2>
        <p className="text-meta text-graphite mt-1 flex items-center gap-3 flex-wrap">
          <span>{report.fatal_gaps.length} fatal</span>
          <span>·</span>
          <span>{report.recommended_gaps.length} recommended missing</span>
          <span>·</span>
          <span
            className="font-mono"
            style={{ color: severityChip(report.max_severity).color }}
          >
            max severity {report.max_severity}/5
          </span>
        </p>
      </header>

      <CaseProfileEditor profile={profile} onChange={setProfile} />

      {report.conflicts.length > 0 && (
        <section>
          <h3 className="text-body font-medium mb-2">Cross-document conflicts</h3>
          <ul className="grid gap-2">
            {report.conflicts.map((c) => (
              <li
                key={c.id}
                className={
                  'paper-recess border border-rule px-4 py-2 ' +
                  severityClasses(c.severity, 'inadequate')
                }
              >
                <div className="text-body text-ink">{c.description}</div>
                <div className="text-meta text-graphite-soft font-mono mt-1">
                  <span style={{ color: severityChip(c.severity).color }}>
                    {severityChip(c.severity).label}
                  </span>
                  {c.suggested_resolution ? ` · ${c.suggested_resolution}` : ''}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {FAM_GROUPS.map((group) => {
        const slots = groupedRequired[group.fam] ?? [];
        if (slots.length === 0) return null;
        const filled = slots.filter((s) => s.status === 'filled').length;
        return (
          <section key={group.fam}>
            <h3 className="text-body font-medium mb-2 flex items-baseline justify-between">
              <span>{group.label}</span>
              <span className="text-meta text-graphite-soft font-mono tabular-nums">
                {filled}/{slots.length}
              </span>
            </h3>
            <ul className="grid gap-2">
              {slots.map((r) => (
                <SlotRow
                  key={r.slot_id}
                  resolution={r}
                  matterRoot={matterRoot}
                  onOpenMatter={onOpenMatter}
                  onOpenPdf={onOpenPdf}
                />
              ))}
            </ul>
          </section>
        );
      })}

      {ungrouped.length > 0 && (
        <section>
          <h3 className="text-body font-medium mb-2 flex items-baseline justify-between">
            <span>Forms / Dependents / Other</span>
            <span className="text-meta text-graphite-soft font-mono tabular-nums">
              {ungrouped.filter((s) => s.status === 'filled').length}/{ungrouped.length}
            </span>
          </h3>
          <ul className="grid gap-2">
            {ungrouped.map((r) => (
              <SlotRow
                key={r.slot_id}
                resolution={r}
                matterRoot={matterRoot}
                onOpenMatter={onOpenMatter}
                onOpenPdf={onOpenPdf}
              />
            ))}
          </ul>
        </section>
      )}

      {recommended.length > 0 && (
        <section>
          <h3 className="text-body font-medium mb-2">Recommended (not strictly required)</h3>
          <ul className="grid gap-2">
            {recommended.map((r) => (
              <SlotRow
                key={r.slot_id}
                resolution={r}
                matterRoot={matterRoot}
                onOpenMatter={onOpenMatter}
                onOpenPdf={onOpenPdf}
                muted
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Binder pane — tab + page-cap aware exhibit emitter                      */
/* ---------------------------------------------------------------------- */

function BinderPane({
  typedMemory,
  caseFacts,
  matterId,
  matterRoot,
  onOpenMatter,
  onOpenPdf,
}: {
  typedMemory: TypedMemory;
  caseFacts: { case_type: CaseType; facts: Record<string, unknown> } | undefined;
  matterId: string | undefined;
  matterRoot: string | null;
  onOpenMatter: () => void;
  onOpenPdf?: (filename: string) => void;
}) {
  const profile = useMemo<CaseProfile | null>(() => {
    if (caseFacts?.case_type !== 'E2') return null;
    const stored = loadStoredProfile(matterId);
    if (stored) return stored;
    const detected = ((caseFacts.facts as { e2_subtype?: unknown }).e2_subtype ?? null) as
      | DetectedSubtypeShape
      | null;
    return deriveCaseProfile(detected);
  }, [caseFacts, matterId]);

  const manifest = useMemo<BinderManifest | null>(() => {
    if (!profile) return null;
    let binderProfile;
    try {
      binderProfile = selectBinderProfile(profile);
    } catch {
      // selectBinderProfile throws when consular posture without post; bail.
      return null;
    }
    const filled_exhibits = buildEntriesFromMemory(typedMemory)
      .map((entry) => {
        const docTypeId = resolveDocTypeId(entry);
        if (!docTypeId) return null;
        const dt = DOC_TYPES_BY_ID[docTypeId];
        return {
          doc_type_id: docTypeId,
          pdf_path: entry.filename,
          pages: entry.pageCount ?? 1,
          effective_aps: (dt?.typical_aps ?? 3) as 1 | 2 | 3 | 4 | 5,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return buildBinderManifest({
      case_profile: profile,
      filled_exhibits,
      binder_profile: binderProfile,
    });
  }, [profile, typedMemory]);

  if (caseFacts?.case_type !== 'E2' || !profile || !manifest) {
    return (
      <div className="px-9 py-7 fade-in">
        <p className="text-graphite">
          Binder is currently E-2 only. Open an E-2 matter; consular postures need a post selected
          in the Audit tab&apos;s case profile.
        </p>
      </div>
    );
  }

  const cap = manifest.binder_profile.page_cap;
  const overCap = cap !== null && manifest.total_pages_capped > cap;
  const nearCap = cap !== null && !overCap && manifest.total_pages_capped >= cap * 0.9;

  return (
    <div className="px-9 py-7 grid gap-6 fade-in">
      <header>
        <div className="smcp text-graphite-soft mb-1">binder manifest</div>
        <h2 className="text-title font-bold leading-snug">{manifest.binder_profile.profile_id}</h2>
        <p className="text-meta text-graphite mt-1 flex items-center gap-3 flex-wrap">
          <span>
            {manifest.total_pages_filed} pages filed · {manifest.total_pages_capped} count toward
            cap{cap !== null ? ` (cap ${cap})` : ''}
          </span>
          {manifest.binder_profile.submission?.address && (
            <>
              <span>·</span>
              <span className="font-mono">{manifest.binder_profile.submission.address}</span>
            </>
          )}
        </p>
        {overCap && (
          <div className="mt-2 border-l-[3px] border-ink bg-paper-deep/30 text-ink font-semibold px-3 py-2 text-meta smcp">
            page cap exceeded — {manifest.total_pages_capped} / {cap}
          </div>
        )}
        {nearCap && !overCap && (
          <div className="mt-2 border-l-[3px] border-rule-strong text-ink-2 px-3 py-2 text-meta">
            Approaching page cap — {manifest.total_pages_capped} / {cap}
          </div>
        )}
        {manifest.warnings.length > 0 && (
          <ul className="mt-2 grid gap-1">
            {manifest.warnings.map((w, i) => (
              <li key={i} className="text-meta text-graphite font-mono">
                ⚠ {w}
              </li>
            ))}
          </ul>
        )}
      </header>

      <div className="grid gap-4">
        {manifest.ordered_tabs.map((tab) => {
          const excluded = manifest.binder_profile.excluded_from_page_cap.includes(tab.semantic);
          return (
            <section key={`${tab.physical_label}-${tab.semantic}`} className="border border-rule paper-recess">
              <header className="px-5 py-2 border-b border-rule flex items-baseline justify-between">
                <div>
                  <span className="font-mono text-meta text-graphite-soft">{tab.physical_label}</span>
                  <span className="ml-3 text-body text-ink">{tab.title}</span>
                </div>
                <span className="font-mono text-meta text-graphite-soft tabular-nums">
                  {tab.page_count_in_section} pages{excluded ? ' · excluded from cap' : ''}
                </span>
              </header>
              {tab.exhibits.length === 0 ? (
                <div className="px-5 py-3 text-meta text-graphite-soft italic">No exhibits in this section yet.</div>
              ) : (
                <ul className="grid divide-y divide-rule">
                  {tab.exhibits.map((ex) => (
                    <li key={ex.exhibit_id} className="px-5 py-2 flex items-baseline gap-3">
                      <span className="font-mono text-meta text-graphite-soft tabular-nums w-12">
                        {ex.exhibit_id}
                      </span>
                      <button
                        type="button"
                        onClick={() => (onOpenPdf ? onOpenPdf(ex.pdf_path) : onOpenMatter())}
                        title={matterRoot ? `${matterRoot}/${ex.pdf_path}` : ex.pdf_path}
                        className="flex-1 text-left font-mono text-meta text-ink hover:bg-ink/5 truncate"
                      >
                        {trimFilename(ex.pdf_path)}
                      </button>
                      <span className="font-mono text-meta text-graphite-soft tabular-nums whitespace-nowrap">
                        {DOC_TYPES_BY_ID[ex.doc_type_id]?.name ?? ex.doc_type_id} · {ex.pages}p · APS {ex.effective_aps}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
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
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setState(EMPTY_INTAKE);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<IntakeFields>;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({
        address: typeof parsed.address === 'string' ? parsed.address : '',
        phone: typeof parsed.phone === 'string' ? parsed.phone : '',
        email: typeof parsed.email === 'string' ? parsed.email : '',
      });
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    <section className="border border-rule bg-paper">
      <header className="px-5 py-3 border-b border-rule paper-recess flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-meta text-graphite-soft tabular-nums">{roman}</span>
          <span className="smcp text-graphite">{title}</span>
        </div>
        <span className="text-meta text-graphite-soft italic">attorney attestation · merges into draft</span>
      </header>
      <dl className="px-5 py-5 grid grid-cols-[12rem_1fr] gap-x-6 gap-y-4">
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
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(value);
  }, [value]);
  return (
    <>
      <dt className="smcp text-graphite-soft pt-2">{label}</dt>
      <dd>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== value) onChange(draft);
          }}
          placeholder={placeholder}
          className="w-full max-w-md border border-rule px-3 py-2 font-mono text-meta text-ink-2 focus:outline-none focus:border-ink"
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
    <section className="border border-rule bg-paper">
      <header className="px-5 py-3 border-b border-rule paper-recess flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-meta text-graphite-soft tabular-nums">{roman}</span>
          <span className="smcp text-graphite">{title}</span>
        </div>
      </header>
      <dl className="px-5 py-5 grid grid-cols-[12rem_1fr] gap-x-6 gap-y-3">
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
      <dt className="smcp text-graphite-soft pt-0.5">{label}</dt>
      <dd>
        <span
          className={
            isMissing
              ? 'text-meta text-graphite-soft italic'
              : 'text-body text-ink leading-snug'
          }
        >
          {valueLabel}
        </span>
        {(confidence !== null || sourcePage !== null) && (
          <span className="ml-3 font-mono text-label text-graphite-soft tabular-nums">
            {sourcePage !== null && `p.${sourcePage}`}
            {confidence !== null && ` · ${Math.round(confidence * 100)}%`}
          </span>
        )}
        {sourceQuote && !isMissing && (
          <div className="text-meta text-graphite-soft italic mt-1 leading-snug">
            &ldquo;{sourceQuote.length > 90 ? sourceQuote.slice(0, 90) + '…' : sourceQuote}&rdquo;
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
          <div className="text-body italic text-graphite text-body">— none on record</div>
        ) : (
          <ol className="grid gap-2.5">
            {value.map((item, i) => (
              <li
                key={i}
                className="grid grid-cols-[2rem_1fr] gap-3 border-b border-rule pb-2.5 last:border-b-0"
              >
                <span className="font-mono text-label text-graphite-soft pt-0.5">
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
    <div className="text-body">
      <span className="smcp text-label text-graphite mr-2">{humanLabel(label)}</span>
      {String(value)}
    </div>
  );
}

function SectionLabel({ label, count }: { label: string; count?: number }) {
  return (
    <div className="flex items-baseline gap-3 mb-3 pb-2 border-b border-rule">
      <h3 className="smcp text-graphite">{humanLabel(label)}</h3>
      {typeof count === 'number' && (
        <span className="font-mono text-meta text-graphite-soft tabular-nums">{count}</span>
      )}
    </div>
  );
}

function FactDefRow({ label, value }: { label: string; value: unknown }) {
  if (isFieldLeaf(value)) {
    return (
      <>
        <dt className="smcp text-label text-graphite pt-1">{humanLabel(label)}</dt>
        <dd>
          <FactLine field={value} compact />
        </dd>
      </>
    );
  }
  if (Array.isArray(value)) {
    return (
      <>
        <dt className="smcp text-label text-graphite pt-1">
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
        <dt className="smcp text-label text-graphite pt-1">{humanLabel(label)}</dt>
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
      <dt className="smcp text-label text-graphite pt-1">{humanLabel(label)}</dt>
      <dd className="text-body">{String(value)}</dd>
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
  return <span className="text-body">{String(item)}</span>;
}

function FactLine({ field, compact }: { field: FieldProvenance; compact?: boolean }) {
  return (
    <div className={'flex flex-wrap items-baseline gap-x-3 gap-y-0.5 ' + (compact ? '' : 'py-1')}>
      <span className={(compact ? 'text-body' : 'text-body') + ' text-ink'}>
        {field.value === null ? (
          <span className="text-graphite-soft italic font-display">— none on record</span>
        ) : typeof field.value === 'object' ? (
          JSON.stringify(field.value)
        ) : (
          String(field.value)
        )}
      </span>
      {field.source_page != null && (
        <sup className="cite">¹ p.{field.source_page}</sup>
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
        <div className="border border-ink paper-recess p-5">
          <div className="smcp text-ink mb-2">draft failed</div>
          <div className="font-mono text-meta text-graphite mb-3">
            [{result.draftError.code}]
          </div>
          <div className="text-body text-ink-2 leading-relaxed">
            {result.draftError.message}
          </div>
        </div>
      </div>
    );
  }

  const text = result.draft || streamingDraft || '';

  if (!text) {
    return (
      <div className="px-9 py-16 grid place-items-center">
        <div className="border border-rule bg-paper grid place-items-center py-16 px-8 text-center max-w-md">
          <div className="grid gap-3">
            <div className="sigil mx-auto" style={{ width: '2.4rem', height: '2.4rem', fontSize: '0.85rem' }}>
              —
            </div>
            <p className="text-body text-graphite leading-relaxed">
              The draft is not yet on the desk.
            </p>
          </div>
        </div>
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

  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

  return (
    <div className="px-9 py-7 fade-in">
      <div className="flex items-baseline justify-between mb-5">
        <div className="grid gap-1">
          <div className="smcp text-graphite">cover letter</div>
          <div className="text-meta text-graphite-soft">
            drafted in the firm&rsquo;s voice · exhibit refs underlined
          </div>
        </div>
        <button
          onClick={onCopy}
          className="px-3 py-2 border border-ink smcp text-meta hover:bg-ink hover:text-paper transition-colors"
        >
          {copied ? '✓ copied' : 'copy to clipboard'}
        </button>
      </div>
      <article className="max-w-[68ch] mx-auto bg-paper border border-rule px-10 py-9 text-body leading-[1.75] text-ink">
        {paragraphs.map((p, i) => (
          <p key={i} className="mb-4 last:mb-0">
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

function DeterministicGatesPanel({
  gates,
  onRerun,
  rerunning,
}: {
  gates?: GateRunResult[];
  onRerun?: () => void;
  rerunning?: boolean;
}) {
  if (!gates || gates.length === 0) return null;
  const fired = gates.filter((g) => g.outcome.fired);
  const dataIncomplete = gates.filter(
    (g) => !g.outcome.fired && g.outcome.reason === 'data_incomplete',
  );
  const passed = gates.filter(
    (g) => !g.outcome.fired && g.outcome.reason === 'not_applicable',
  );
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-4 pb-2 border-b border-rule">
        <h3 className="smcp text-graphite">Deterministic gates</h3>
        <span className="font-mono text-meta text-graphite-soft tabular-nums">
          {fired.length} fired · {dataIncomplete.length} data_incomplete · {passed.length} passed
        </span>
        {onRerun && (
          <button
            type="button"
            onClick={onRerun}
            disabled={rerunning}
            className={
              'ml-auto smcp text-meta px-3 py-1 border border-rule-strong bg-paper hover:bg-stone-50 disabled:opacity-50 disabled:cursor-wait ' +
              (rerunning ? 'animate-pulse' : '')
            }
          >
            {rerunning ? 'Re-running…' : 'Re-run review'}
          </button>
        )}
      </div>
      {fired.length === 0 ? (
        <p className="text-body text-graphite leading-relaxed">
          No deterministic gates fired.{' '}
          {dataIncomplete.length > 0
            ? `${dataIncomplete.length} gate(s) returned data_incomplete — extractor inputs are missing.`
            : null}
        </p>
      ) : (
        <div className="grid gap-3">
          {fired.map((g, i) => {
            if (!g.outcome.fired) return null;
            const sev = g.outcome.severity;
            const sevLabel = GATE_SEVERITY_LABEL[sev as 4 | 5];
            const pillClass = severityPillClass(sev as 1 | 2 | 3 | 4 | 5);
            const defaultOpen = gateDefaultOpen(g);
            return (
              <details
                key={i}
                open={defaultOpen}
                className="border border-rule bg-paper px-5 py-4 border-l-rule-strong border-l-[3px]"
              >
                <summary className="cursor-pointer flex items-baseline gap-3 list-none">
                  <span
                    className={
                      'smcp text-meta px-2 py-0.5 tracking-wider ' + pillClass
                    }
                  >
                    sev {sev} · {sevLabel}
                  </span>
                  <span className="smcp text-graphite-soft">
                    {humanLabel(g.name)}
                  </span>
                  <span className="ml-auto text-meta text-graphite-soft">
                    {defaultOpen ? '−' : '+'}
                  </span>
                </summary>
                <div className="mt-3">
                  <div className="text-body text-ink mb-2 leading-relaxed">
                    {g.outcome.finding}
                  </div>
                  <DefMini label="severity" value={String(sev)} />
                  <DefMini label="authority" value={g.outcome.authority} />
                  <DefMini label="gate" value={g.name} />
                </div>
              </details>
            );
          })}
        </div>
      )}
      {gates.length > fired.length && (
        <details className="mt-4 border border-rule bg-paper px-4 py-2">
          <summary className="cursor-pointer smcp text-meta text-graphite">
            ✓ {passedGatesSummary(gates)}
          </summary>
          <div className="mt-3 grid gap-1">
            {gates
              .filter((g) => !g.outcome.fired)
              .map((g, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_auto] gap-3 py-1 text-meta items-baseline"
                >
                  <span className="font-mono text-ink-2">{g.name}</span>
                  <span className="smcp text-graphite-soft">
                    {!g.outcome.fired ? g.outcome.reason : ''}
                  </span>
                </div>
              ))}
          </div>
        </details>
      )}
    </div>
  );
}

function ReviewPane({
  result,
  onResultUpdate,
}: {
  result: IngestResult;
  onResultUpdate?: (updater: (r: IngestResult) => IngestResult) => void;
}) {
  const [rerunning, setRerunning] = useState(false);
  const [rerunError, setRerunError] = useState<string | null>(null);

  const onRerun =
    onResultUpdate && result.caseFacts && result.draft
      ? async () => {
          setRerunning(true);
          setRerunError(null);
          try {
            const res = await fetch('/api/review', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                case_facts: result.caseFacts,
                draft: result.draft,
              }),
            });
            const data = (await res.json()) as {
              review?: ReviewReport;
              deterministic_gates?: GateRunResult[];
              error?: string;
              message?: string;
            };
            if (!res.ok || data.error) {
              setRerunError(data.message ?? data.error ?? `HTTP ${res.status}`);
            } else {
              onResultUpdate((r) => ({
                ...r,
                review: data.review,
                deterministic_gates: data.deterministic_gates,
                reviewError: undefined,
              }));
            }
          } catch (e) {
            setRerunError(e instanceof Error ? e.message : String(e));
          } finally {
            setRerunning(false);
          }
        }
      : undefined;

  if (result.reviewError) {
    return (
      <div className="px-9 py-7">
        <div className="border border-ink paper-recess p-5">
          <div className="smcp text-ink mb-2">review failed</div>
          <div className="font-mono text-meta text-graphite mb-3">
            [{result.reviewError.code}]
          </div>
          <div className="text-body text-ink-2 leading-relaxed">
            {result.reviewError.message}
          </div>
        </div>
      </div>
    );
  }

  if (!result.review) {
    return (
      <div className="px-9 py-16 grid place-items-center">
        <div className="border border-rule bg-paper grid place-items-center py-16 px-8 text-center max-w-md">
          <div className="grid gap-3">
            <div className="sigil mx-auto" style={{ width: '2.4rem', height: '2.4rem', fontSize: '0.85rem' }}>
              —
            </div>
            <p className="text-body text-graphite leading-relaxed">
              The auditor has not yet returned the file.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const r = result.review;
  return (
    <div className="px-9 py-7 grid gap-9 fade-in">
      <div>
        <SectionLabel label="summary" />
        <p className="text-lede text-ink leading-relaxed">{r.summary}</p>
      </div>

      <DeterministicGatesPanel
        gates={result.deterministic_gates}
        onRerun={onRerun}
        rerunning={rerunning}
      />
      {rerunError && (
        <div className="border border-ink paper-recess p-4">
          <div className="smcp text-ink mb-1">re-run failed</div>
          <div className="text-body text-ink-2 leading-relaxed">{rerunError}</div>
        </div>
      )}

      <FindingGroup
        title="Inconsistencies"
        count={r.inconsistencies.length}
        emptyText="No inconsistencies between draft and facts."
      >
        {r.inconsistencies.map((f, i) => (
          <FindingCard key={i} severity={f.severity} eyebrow={f.category}>
            <div className="text-body text-ink mb-2 leading-relaxed">{f.description}</div>
            {f.letter_excerpt && (
              <BlockQuote label="draft">{f.letter_excerpt}</BlockQuote>
            )}
            {f.facts_value && (
              <div className="flex items-baseline gap-2 mt-2 text-meta">
                <span className="smcp text-graphite-soft">facts</span>
                <span className="font-mono text-ink-2">{f.facts_value}</span>
              </div>
            )}
          </FindingCard>
        ))}
      </FindingGroup>

      <FindingGroup
        title="Missing arguments"
        count={r.missing_arguments.length}
        emptyText="All required elements appear to be argued."
      >
        {r.missing_arguments.map((f, i) => (
          <FindingCard key={i} eyebrow={f.element}>
            <div className="text-body text-ink mb-2 leading-relaxed">{f.description}</div>
            <DefMini label="missing" value={f.what_is_missing} />
            <DefMini label="suggestion" value={f.suggestion} />
          </FindingCard>
        ))}
      </FindingGroup>

      <FindingGroup
        title="Weak spots & RFE risks"
        count={r.weak_spots.length}
        emptyText="No notable RFE risks identified."
      >
        {r.weak_spots.map((f, i) => (
          <FindingCard key={i} severity={f.severity} eyebrow={f.element}>
            <div className="text-body text-ink mb-2 leading-relaxed">{f.description}</div>
            <DefMini label="rfe risk" value={f.rfe_risk} />
            <DefMini label="suggestion" value={f.suggestion} />
          </FindingCard>
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
    <div>
      <div className="flex items-baseline gap-3 mb-4 pb-2 border-b border-rule">
        <h3 className="smcp text-graphite">{title}</h3>
        <span className="font-mono text-meta text-graphite-soft tabular-nums">{count}</span>
      </div>
      {count === 0 ? (
        <p className="text-body text-graphite leading-relaxed">{emptyText}</p>
      ) : (
        <div className="grid gap-3">{children}</div>
      )}
    </div>
  );
}

const SEVERITY_WEIGHT: Record<string, string> = {
  critical: 'border-l-ink border-l-[3px]',
  major: 'border-l-rule-strong border-l-[3px]',
  minor: 'border-l-rule border-l-[3px]',
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
        'border border-rule bg-paper px-5 py-4 ' +
        (severity ? SEVERITY_WEIGHT[severity] ?? 'border-l-rule border-l-[3px]' : 'border-l-rule border-l-[3px]')
      }
    >
      <div className="flex items-baseline gap-3 mb-2">
        {severity && (
          <span
            className={
              'smcp ' +
              (severity === 'critical'
                ? 'text-ink font-semibold'
                : severity === 'major'
                  ? 'text-ink-2 font-medium'
                  : 'text-graphite')
            }
          >
            {severity}
          </span>
        )}
        {eyebrow && (
          <span className="smcp text-graphite-soft">
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
    <div className="border-l border-rule-strong pl-3 my-2">
      <div className="smcp text-graphite-soft mb-0.5">{label}</div>
      <div className="text-body text-ink-2 italic leading-relaxed">&ldquo;{children}&rdquo;</div>
    </div>
  );
}

function DefMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[6rem_1fr] gap-3 py-1 items-baseline">
      <dt className="smcp text-graphite-soft">{label}</dt>
      <dd className="text-body text-ink-2 leading-snug">{value}</dd>
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
      <dl className="grid grid-cols-[14rem_1fr] gap-x-6 gap-y-3 border-t border-rule pt-4">
        {rows.map((r) => (
          <div key={r.k} className="contents">
            <dt className="smcp text-graphite-soft pt-0.5">{r.k}</dt>
            <dd className="font-mono text-body text-ink-2 break-words">{r.v}</dd>
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
      { mark: '§', text: '8 C.F.R. ·  214.2(e) — Treaty trader/investor.' },
      { mark: '§', text: '9 FAM 402.9 — Substantiality, marginality, real & operating.' },
      { mark: '¶', text: 'Source-of-funds traceability is the most common RFE driver.' },
    ],
  },
  EB1A: {
    glyph: 'EB·IA',
    refs: [
      { mark: '§', text: '8 C.F.R. ·  204.5(h) — Ten regulatory criteria.' },
      { mark: '¶', text: 'Kazarian v. USCIS, 596 F.3d 1115 — Two-step review.' },
      { mark: '¶', text: 'Final merits: sustained acclaim + small percentage at top.' },
    ],
  },
  EB1B: {
    glyph: 'EB·IB',
    refs: [
      { mark: '§', text: '8 C.F.R. ·  204.5(i) — Outstanding researcher.' },
      { mark: '¶', text: 'Two of six criteria + international recognition.' },
      { mark: '¶', text: 'Three years of teaching/research experience required.' },
    ],
  },
  EB1C: {
    glyph: 'EB·IC',
    refs: [
      { mark: '§', text: '8 C.F.R. ·  204.5(j) — Multinational manager/executive.' },
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
    <footer className="px-6 flex items-center justify-between text-label text-graphite font-mono border-t border-rule paper-grain tracking-wide">
      <div className="flex items-center gap-4">
        <span className={loading ? 'text-ink' : 'text-graphite'}>
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
      <div className="text-center pointer-events-none border border-ink bg-paper px-12 py-10">
        <div className="text-display font-bold text-ink leading-none tracking-[-0.02em]">
          release to deposit
        </div>
        <div className="mt-4 smcp text-graphite">
          pdfs · folders · exhibits
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Matter overlay — full-viewport, category accordion + PDF preview        */
/* ---------------------------------------------------------------------- */

/* ---------------------------------------------------------------------- */
/* PDF detail modal — preview + structured rich extraction + audit hits   */
/* ---------------------------------------------------------------------- */

function findEntryByFilename(
  typedMemory: TypedMemory,
  filename: string,
): PerPdfMemoryEntry | null {
  for (const list of Object.values(typedMemory)) {
    for (const entry of list ?? []) {
      if (entry.filename === filename) return entry;
    }
  }
  return null;
}

function PdfDetailModal({
  filename,
  matterRoot,
  typedMemory,
  caseFacts,
  aggregateAudit,
  documentOverride,
  onApplyDocOverride,
  onClose,
}: {
  filename: string;
  matterRoot: string | null;
  typedMemory: TypedMemory;
  caseFacts: { case_type: CaseType; facts: Record<string, unknown> } | undefined;
  aggregateAudit?: AggregateAuditPayload;
  documentOverride?: {
    display_name?: string | null;
    doc_type_override?: DocType | null;
  } | null;
  onApplyDocOverride?: (
    filename: string,
    patch: { display_name?: string | null; doc_type_override?: DocType | null },
  ) => Promise<boolean>;
  onClose: () => void;
}) {
  const entry = findEntryByFilename(typedMemory, filename);

  // PDF preview URL: server route serves local PDFs by absolute path.
  const pdfUrl = useMemo(() => {
    if (!matterRoot) return null;
    return `/api/file?path=${encodeURIComponent(`${matterRoot}/${filename}`)}`;
  }, [matterRoot, filename]);

  // Cross-reference: which conflicts mention this PDF?
  const relatedConflicts = useMemo<ConflictRegisterEntry[]>(() => {
    const llm = readConflictRegister(caseFacts?.facts);
    const gates = aggregateGatesToConflicts(aggregateAudit);
    return [...gates, ...llm].filter((c) =>
      c.evidence.some((e) => e.pdf_path && filename.includes(e.pdf_path.split('/').pop() ?? '')),
    );
  }, [filename, caseFacts, aggregateAudit]);

  // Cross-reference: which proof slots can this PDF fill?
  const fillsSlots = useMemo<string[]>(() => {
    if (!entry) return [];
    const memEntry: MemoryPdfEntry = {
      filename: entry.filename,
      pageCount: entry.pageCount,
      facts: { doc_type: entry.doc_type ?? undefined },
      ...(entry.subtypes ?? {}),
    } as MemoryPdfEntry;
    const docTypeId = resolveDocTypeId(memEntry);
    if (!docTypeId) return [];
    const dt = DOC_TYPES_BY_ID[docTypeId];
    return dt?.fills_proof_slots ?? [];
  }, [entry]);

  if (!entry) {
    return (
      <div
        className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center p-6"
        onClick={onClose}
      >
        <div
          className="bg-paper border border-rule p-6 max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="smcp text-graphite-soft mb-1">Document not found</div>
          <p className="text-body text-graphite mb-3">{filename}</p>
          <button
            type="button"
            onClick={onClose}
            className="border border-rule px-3 py-1 text-meta text-graphite hover:bg-ink/5"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const factsObj = entry.facts ?? {};
  const displayName = unwrapField<string>((factsObj as Record<string, unknown>).display_name);
  const summary = unwrapField<string>((factsObj as Record<string, unknown>).one_line_summary);
  const richEntries = entry.rich
    ? Object.entries(entry.rich).filter(([, v]) => v !== null && v !== undefined)
    : [];
  const overrideDisplayName = documentOverride?.display_name ?? null;
  const overrideDocType = documentOverride?.doc_type_override ?? null;
  const renderedTitle =
    overrideDisplayName ?? displayName ?? trimFilename(filename);

  const persistDisplayName = (raw: string | null) => {
    if (!onApplyDocOverride) return;
    const trimmed = raw?.trim() ?? '';
    void onApplyDocOverride(filename, {
      display_name: trimmed.length === 0 ? null : trimmed,
    });
  };
  const persistDocType = (value: string) => {
    if (!onApplyDocOverride) return;
    void onApplyDocOverride(filename, {
      doc_type_override: value.length === 0 ? null : (value as DocType),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-stretch justify-center"
      onClick={onClose}
    >
      <div
        className="bg-paper border border-rule m-6 flex-1 max-w-[1400px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-6 py-3 border-b border-rule flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="smcp text-graphite-soft mb-0.5">document detail</div>
            {onApplyDocOverride ? (
              <input
                defaultValue={renderedTitle}
                onBlur={(e) => {
                  if (e.target.value.trim() !== renderedTitle) {
                    persistDisplayName(e.target.value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                className="text-body text-ink bg-transparent border-b border-transparent focus:border-ink outline-none w-full truncate"
                aria-label="Rename document (display only)"
                maxLength={200}
              />
            ) : (
              <h2 className="text-body text-ink truncate">{renderedTitle}</h2>
            )}
            <div className="text-meta text-graphite-soft font-mono mt-0.5 truncate">
              {filename} · {entry.pageCount} pages · {entry.doc_type ?? 'unknown'}
              {overrideDocType && overrideDocType !== entry.doc_type && (
                <span className="ml-2 border border-ink px-1.5 py-0.5 smcp text-ink">
                  override · {overrideDocType} · pending re-aggregate
                </span>
              )}
            </div>
            {onApplyDocOverride && (
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <label className="smcp text-label text-graphite-soft">
                  document type
                </label>
                <select
                  value={overrideDocType ?? ''}
                  onChange={(e) => persistDocType(e.target.value)}
                  className="font-mono text-meta text-ink bg-paper border border-rule px-2 py-1 hover:border-rule-strong"
                  title="Manually reclassify this document. Click Re-aggregate to re-extract under the selected type."
                >
                  <option value="">(auto · {entry.doc_type ?? 'unknown'})</option>
                  {(Object.entries(DOC_TYPE_LABELS) as [DocType, string][]).map(
                    ([k, lbl]) => (
                      <option key={k} value={k}>
                        {lbl} · {k}
                      </option>
                    ),
                  )}
                </select>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-rule px-3 py-1 text-meta text-graphite hover:bg-ink/5 whitespace-nowrap"
          >
            Close (Esc)
          </button>
        </header>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 min-h-0">
          <div className="border-r border-rule bg-paper-2 min-h-0">
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="w-full h-full"
                title={`PDF preview — ${filename}`}
              />
            ) : (
              <div className="p-6 text-meta text-graphite-soft">
                Matter folder not available — preview disabled.
              </div>
            )}
          </div>
          <div className="overflow-y-auto p-6 grid gap-5">
            {summary && (
              <section>
                <div className="smcp text-graphite-soft mb-1">summary</div>
                <p className="text-body text-ink leading-snug">{summary}</p>
              </section>
            )}
            {entry.subtypes && Object.values(entry.subtypes).some((v) => v) && (
              <section>
                <div className="smcp text-graphite-soft mb-1">subtype</div>
                <ul className="font-mono text-meta text-graphite grid gap-0.5">
                  {Object.entries(entry.subtypes)
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <li key={k}>
                        <span className="text-graphite-soft">{k}:</span> {String(v)}
                      </li>
                    ))}
                </ul>
              </section>
            )}
            {fillsSlots.length > 0 && (
              <section>
                <div className="smcp text-graphite-soft mb-1">fills proof slots</div>
                <ul className="font-mono text-meta text-graphite grid gap-0.5">
                  {fillsSlots.map((sid) => (
                    <li key={sid}>
                      {sid}
                      {PROOF_SLOTS_BY_ID[sid]?.description ? (
                        <span className="text-graphite-soft">
                          {' — '}
                          {PROOF_SLOTS_BY_ID[sid].description}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {relatedConflicts.length > 0 && (
              <section>
                <div className="smcp text-graphite-soft mb-1">audit findings on this document</div>
                <ul className="grid gap-2">
                  {relatedConflicts.map((c) => (
                    <li
                      key={c.id}
                      className="paper-recess border border-rule px-3 py-2 border-l-2"
                      style={{ borderLeftColor: severityChip(c.severity).color }}
                    >
                      <div className="text-body text-ink">{c.description}</div>
                      <div className="text-meta text-graphite-soft mt-0.5 font-mono">
                        <span style={{ color: severityChip(c.severity).color }}>
                          {severityChip(c.severity).label}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {richEntries.length > 0 && (
              <section>
                <div className="smcp text-graphite-soft mb-1">extracted facts</div>
                <div className="grid gap-3">
                  {richEntries.map(([key, value]) => (
                    <details
                      key={key}
                      open
                      className="border border-rule paper-recess"
                    >
                      <summary className="cursor-pointer px-3 py-1.5 font-mono text-meta text-graphite hover:bg-ink/5">
                        ▾ {key}
                      </summary>
                      <pre className="px-3 py-2 border-t border-rule text-meta font-mono text-ink whitespace-pre-wrap break-words overflow-x-auto">
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    </details>
                  ))}
                </div>
              </section>
            )}
            {entry.error && (
              <section className="border border-rule paper-recess px-3 py-2 border-l-[3px] border-l-ink">
                <div className="smcp text-ink font-semibold mb-1">extraction error</div>
                <div className="text-meta font-mono text-ink">{entry.error.code}</div>
                <div className="text-meta text-graphite mt-0.5">{entry.error.message}</div>
              </section>
            )}
            <details className="border border-rule paper-recess">
              <summary className="cursor-pointer px-3 py-1.5 font-mono text-meta text-graphite hover:bg-ink/5">
                ▸ raw thin facts
              </summary>
              <pre className="px-3 py-2 border-t border-rule text-meta font-mono text-ink whitespace-pre-wrap break-words overflow-x-auto">
                {JSON.stringify(entry.facts, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  documentOverrides,
  onApplyDocOverride,
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
  documentOverrides:
    | Record<string, { display_name?: string | null; doc_type_override?: DocType | null }>
    | null;
  onApplyDocOverride?: (
    filename: string,
    patch: { display_name?: string | null; doc_type_override?: DocType | null },
  ) => Promise<boolean>;
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
            documentOverrides={documentOverrides}
            onApplyDocOverride={onApplyDocOverride}
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
          className="font-mono text-meta text-graphite hover:text-ink transition-colors smcp  flex items-center gap-2"
        >
          <span className="text-body">←</span>
          <span>back to dossier</span>
        </button>
      </div>
      <div className="text-center">
        <div className="smcp text-label text-graphite-soft  mb-1">
          ※ matter
        </div>
        <div className="font-display text-title font-bold leading-none">
          {basenameOf(matterName)}
        </div>
      </div>
      <div className="flex items-center justify-end gap-4 font-mono text-label text-graphite ">
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
        <SectionTitle marker="·" label="dashboard" />
        <div className="paper-recess border border-rule px-7 py-10 text-body italic text-graphite text-center">
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
      <SectionTitle marker="·" label="dashboard" />

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
                <div className="font-display text-body">
                  {readFieldValue(o.owner_name) ?? '(unnamed)'}
                </div>
                <div className="font-mono text-meta text-graphite">
                  {readFieldValue(o.nationality) ?? '—'}
                </div>
                <div className="font-mono text-meta text-ink-2">
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
                <div className="font-display text-body">
                  {readFieldValue(s.origin_category) ?? '(category unknown)'}
                  {readFieldValue(s.origin_amount_usd) && (
                    <span className="font-mono text-meta text-graphite ml-2">
                      · ${readFieldValue(s.origin_amount_usd)}
                    </span>
                  )}
                </div>
                {readFieldValue(s.origin_evidence) && (
                  <div className="font-mono text-meta text-graphite-soft mt-0.5">
                    {readFieldValue(s.origin_evidence)}
                  </div>
                )}
                {readFieldValue(s.notes) && (
                  <div className="text-meta italic text-ink-2 mt-1">
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
                <span className="font-mono text-label text-ink  shrink-0">
                  sev {readFieldValue(c.severity)}
                </span>
                <span className="font-display text-meta text-ink-2">
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
    <div className="flex items-baseline gap-3 mb-4 pb-2 border-b border-rule">
      <span className="font-mono text-meta text-graphite-soft tabular-nums">{marker}</span>
      <span className="smcp text-graphite">{label}</span>
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
      <div className="smcp text-label text-ink  mb-3 pb-2 border-b border-rule">
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
      <div className="font-mono text-label text-graphite tracking-wide uppercase">
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
          className="font-display text-body bg-transparent border-b border-ink outline-none pb-0.5"
        />
      ) : (
        <div className="font-display text-body text-ink-2 break-words">
          {display ?? <span className="italic text-graphite-soft">not extracted</span>}
          {overridden && (
            <span className="ml-2 font-mono text-label text-ink-2 ">
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
          className="font-mono text-label text-ink  smcp hover:text-ink"
        >
          save
        </button>
      ) : (
        <button
          onClick={() => {
            setDraft(display ?? '');
            setEditing(true);
          }}
          className="font-mono text-label text-graphite hover:text-ink  smcp"
        >
          ✎
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Inline doc-type quick picker — reclassify without expanding the row     */
/* ---------------------------------------------------------------------- */

function DocTypeQuickPicker({
  filename,
  currentType,
  override,
  onApplyDocOverride,
  compact = true,
}: {
  filename: string;
  currentType: DocType;
  override: DocType | null;
  onApplyDocOverride?: (
    filename: string,
    patch: { display_name?: string | null; doc_type_override?: DocType | null },
  ) => Promise<boolean>;
  compact?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  if (!onApplyDocOverride) return null;
  const value = override ?? '';

  const onChange = async (next: string) => {
    setSaving(true);
    try {
      await onApplyDocOverride(filename, {
        doc_type_override: next.length === 0 ? null : (next as DocType),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <span
      className="shrink-0 inline-flex items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <select
        value={value}
        disabled={saving}
        onChange={(e) => void onChange(e.target.value)}
        title={
          override
            ? `Manually classified as ${override}; click Re-aggregate to apply.`
            : 'Forward to another document type — re-aggregate to apply.'
        }
        className={
          'font-mono text-ink bg-paper border border-rule hover:border-rule-strong focus:border-ink outline-none ' +
          (compact ? 'text-label px-1.5 py-0.5' : 'text-meta px-2 py-1')
        }
      >
        <option value="">forward to…</option>
        <optgroup label={`current · ${currentType}`}>
          {(Object.entries(DOC_TYPE_LABELS) as [DocType, string][])
            .filter(([k]) => k === currentType)
            .map(([k, lbl]) => (
              <option key={k} value={k}>
                {lbl} · {k}
              </option>
            ))}
        </optgroup>
        <optgroup label="reclassify as">
          {(Object.entries(DOC_TYPE_LABELS) as [DocType, string][])
            .filter(([k]) => k !== currentType)
            .map(([k, lbl]) => (
              <option key={k} value={k}>
                {lbl} · {k}
              </option>
            ))}
        </optgroup>
      </select>
      {saving && (
        <span className="font-mono text-label text-graphite-soft animate-pulse">
          ⤴
        </span>
      )}
    </span>
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
  documentOverrides,
  onApplyDocOverride,
}: {
  buckets: [DocType, PerPdfMemoryEntry[]][];
  matterRoot: string | null;
  selectedEntryKey: string | null;
  onSelectEntry: (key: string | null) => void;
  entryLabels: Record<string, string>;
  onSetLabel: (key: string, label: string) => void;
  documentOverrides:
    | Record<string, { display_name?: string | null; doc_type_override?: DocType | null }>
    | null;
  onApplyDocOverride?: (
    filename: string,
    patch: { display_name?: string | null; doc_type_override?: DocType | null },
  ) => Promise<boolean>;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const [t] of buckets) init[t] = false;
    return init;
  });

  // Compute the "needs review" pile: extraction errors, plus docs the
  // classifier dropped into 'other' that haven't been manually reclassified
  // yet. These are the docs the attorney most likely wants to triage first.
  const needsReview: { docType: DocType; entry: PerPdfMemoryEntry }[] = [];
  for (const [docType, entries] of buckets) {
    for (const entry of entries) {
      const ovr = documentOverrides?.[entry.filename] ?? null;
      const hasOverride = !!ovr?.doc_type_override;
      if (entry.error) {
        needsReview.push({ docType, entry });
      } else if (docType === 'other' && !hasOverride) {
        needsReview.push({ docType, entry });
      }
    }
  }

  return (
    <section>
      {needsReview.length > 0 && (
        <div className="mb-7 border-2 border-ink paper-recess">
          <div className="px-5 py-3 border-b-2 border-ink flex items-baseline justify-between">
            <div className="flex items-baseline gap-3">
              <span className="font-display text-title text-ink">needs review</span>
              <span className="font-mono text-label text-graphite">
                {needsReview.length} document{needsReview.length === 1 ? '' : 's'}
              </span>
            </div>
            <span className="smcp text-label text-graphite-soft">
              · classify or rename to clear
            </span>
          </div>
          <ul>
            {needsReview.map(({ docType, entry }) => {
              const key = entryKey(docType, entry.filename);
              const expanded = selectedEntryKey === key;
              const persistedLabel =
                documentOverrides?.[entry.filename]?.display_name ?? null;
              const label =
                entryLabels[key] ?? persistedLabel ?? getSuggestedDocLabel(entry);
              return (
                <li key={key} className="border-b border-rule last:border-b-0">
                  <div
                    className={
                      'flex items-baseline gap-3 px-5 py-2.5 transition-colors group ' +
                      (expanded ? 'bg-paper-2/40' : 'hover:bg-paper-2/30')
                    }
                  >
                    <button
                      type="button"
                      onClick={() => onSelectEntry(expanded ? null : key)}
                      className="text-left flex-1 min-w-0 flex items-baseline gap-3"
                    >
                      <span
                        className="font-mono text-label text-graphite-soft shrink-0"
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
                            'font-display text-body truncate ' +
                            (expanded
                              ? 'text-ink'
                              : 'text-ink-2 group-hover:text-ink')
                          }
                          title={label}
                        >
                          {label}
                        </div>
                        <div
                          className="font-mono text-label text-graphite-soft truncate"
                          title={entry.filename}
                        >
                          {basenameOf(entry.filename)}
                        </div>
                      </div>
                    </button>
                    {entry.error ? (
                      <span className="shrink-0 font-mono text-label text-ink border border-ink px-1.5 py-0.5 smcp">
                        error · {entry.error.code}
                      </span>
                    ) : (
                      <span className="shrink-0 font-mono text-label text-ink border border-ink px-1.5 py-0.5 smcp">
                        unclassified
                      </span>
                    )}
                    <DocTypeQuickPicker
                      filename={entry.filename}
                      currentType={docType}
                      override={
                        documentOverrides?.[entry.filename]?.doc_type_override ?? null
                      }
                      onApplyDocOverride={onApplyDocOverride}
                    />
                  </div>
                  {expanded && (
                    <DocumentInlinePreview
                      entry={entry}
                      entryKeyValue={key}
                      docType={docType}
                      matterRoot={matterRoot}
                      label={label}
                      onSetLabel={onSetLabel}
                      overridden={
                        entryLabels[key] !== undefined || persistedLabel !== null
                      }
                      docTypeOverride={
                        documentOverrides?.[entry.filename]?.doc_type_override ?? null
                      }
                      onApplyDocOverride={onApplyDocOverride}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <SectionTitle marker="·" label="documents · click to preview" />
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
                    className="font-mono text-meta text-graphite-soft transition-transform group-hover:text-ink"
                    style={{
                      display: 'inline-block',
                      transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                      transformOrigin: '50% 55%',
                      width: '0.8rem',
                    }}
                  >
                    ▶
                  </span>
                  <span className="font-display text-title group-hover:text-ink transition-colors">
                    {DOC_TYPE_LABEL[docType]}
                  </span>
                  <span className="font-mono text-label text-graphite ">
                    {entries.length}
                  </span>
                </div>
                <span className="font-mono text-label text-graphite-soft ">
                  {docType}
                </span>
              </button>
              {!isCollapsed && (
                <ul className="border-t border-rule">
                  {entries.map((e) => {
                    const key = entryKey(docType, e.filename);
                    const expanded = selectedEntryKey === key;
                    const persistedLabel = documentOverrides?.[e.filename]?.display_name ?? null;
                    const label = entryLabels[key] ?? persistedLabel ?? getSuggestedDocLabel(e);
                    const docOverride = documentOverrides?.[e.filename] ?? null;
                    const docTypeOverride = docOverride?.doc_type_override ?? null;
                    return (
                      <li key={key} className="border-b border-rule last:border-b-0">
                        <div
                          className={
                            'flex items-baseline gap-3 px-5 py-2.5 transition-colors group ' +
                            (expanded ? 'bg-paper-2/40' : 'hover:bg-paper-2/30')
                          }
                        >
                          <button
                            type="button"
                            onClick={() => onSelectEntry(expanded ? null : key)}
                            className="text-left flex-1 min-w-0 flex items-baseline gap-3"
                          >
                            <span
                              className="font-mono text-label text-graphite-soft shrink-0"
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
                                  'font-display text-body truncate ' +
                                  (expanded
                                    ? 'text-ink'
                                    : 'text-ink-2 group-hover:text-ink')
                                }
                                title={label}
                              >
                                {label}
                              </div>
                              <div
                                className="font-mono text-label text-graphite-soft truncate"
                                title={e.filename}
                              >
                                {basenameOf(e.filename)}
                              </div>
                            </div>
                          </button>
                          {docTypeOverride && (
                            <span
                              className="shrink-0 font-mono text-label text-ink border border-ink px-1.5 py-0.5 smcp"
                              title={`Manually classified as ${docTypeOverride}; click Re-aggregate to apply.`}
                            >
                              override · {docTypeOverride}
                            </span>
                          )}
                          {e.error && (
                            <span className="shrink-0 font-mono text-label text-ink ">
                              error
                            </span>
                          )}
                          <DocTypeQuickPicker
                            filename={e.filename}
                            currentType={docType}
                            override={docTypeOverride}
                            onApplyDocOverride={onApplyDocOverride}
                          />
                        </div>
                        {expanded && (
                          <DocumentInlinePreview
                            entry={e}
                            entryKeyValue={key}
                            docType={docType}
                            matterRoot={matterRoot}
                            label={label}
                            onSetLabel={onSetLabel}
                            overridden={
                              entryLabels[key] !== undefined || persistedLabel !== null
                            }
                            docTypeOverride={docTypeOverride}
                            onApplyDocOverride={onApplyDocOverride}
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
  docTypeOverride,
  onApplyDocOverride,
}: {
  entry: PerPdfMemoryEntry;
  entryKeyValue: string;
  docType: DocType;
  matterRoot: string | null;
  label: string;
  onSetLabel: (key: string, value: string) => void;
  overridden: boolean;
  docTypeOverride?: DocType | null;
  onApplyDocOverride?: (
    filename: string,
    patch: { display_name?: string | null; doc_type_override?: DocType | null },
  ) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [savingType, setSavingType] = useState(false);
  const absPath = matterRoot
    ? `${matterRoot}${matterRoot.endsWith('/') ? '' : '/'}${entry.filename}`
    : null;
  const pdfSrc = absPath
    ? `/api/file?path=${encodeURIComponent(absPath)}`
    : null;
  const effectiveOverrideType = docTypeOverride ?? null;
  const overrideMismatch =
    effectiveOverrideType !== null && effectiveOverrideType !== docType;

  const persistRename = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSetLabel(entryKeyValue, trimmed);
    if (onApplyDocOverride) {
      void onApplyDocOverride(entry.filename, { display_name: trimmed });
    }
  };

  const onChangeDocType = async (value: string) => {
    if (!onApplyDocOverride) return;
    setSavingType(true);
    try {
      // Empty option clears the override.
      const next = value.length === 0 ? null : (value as DocType);
      await onApplyDocOverride(entry.filename, { doc_type_override: next });
    } finally {
      setSavingType(false);
    }
  };

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
                  persistRename(draft);
                  setEditing(false);
                } else if (e.key === 'Escape') {
                  setEditing(false);
                }
              }}
              className="flex-1 text-title font-semibold bg-transparent border-b border-ink outline-none pb-1"
            />
            <button
              onClick={() => {
                persistRename(draft);
                setEditing(false);
              }}
              className="smcp text-meta text-ink hover:text-graphite"
            >
              save
            </button>
          </div>
        ) : (
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-title font-semibold leading-tight text-ink">
              {label}
            </h3>
            <button
              onClick={() => {
                setDraft(label);
                setEditing(true);
              }}
              className="shrink-0 smcp text-meta text-graphite hover:text-ink"
            >
              rename
            </button>
          </div>
        )}
        <div className="mt-1 font-mono text-label text-graphite-soft truncate" title={entry.filename}>
          {DOC_TYPE_LABEL[docType]} · {entry.filename}
          {!overridden && (
            <span className="ml-2 text-rule-strong">(auto-named)</span>
          )}
        </div>
        {onApplyDocOverride && (
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <label className="smcp text-label text-graphite-soft">
              document type
            </label>
            <select
              value={effectiveOverrideType ?? ''}
              disabled={savingType}
              onChange={(e) => void onChangeDocType(e.target.value)}
              className="font-mono text-meta text-ink bg-paper border border-rule px-2 py-1 hover:border-rule-strong"
              title="Manually reclassify this document. Click Re-aggregate to re-extract under the selected type."
            >
              <option value="">(auto · {DOC_TYPE_LABELS[docType]})</option>
              {(Object.entries(DOC_TYPE_LABELS) as [DocType, string][]).map(
                ([k, lbl]) => (
                  <option key={k} value={k}>
                    {lbl} · {k}
                  </option>
                ),
              )}
            </select>
            {overrideMismatch && (
              <span
                className="font-mono text-label text-ink border border-ink px-1.5 py-0.5 smcp"
                title={`Override pending: this document will re-bucket under ${effectiveOverrideType} on the next Re-aggregate.`}
              >
                pending re-aggregate
              </span>
            )}
            {savingType && (
              <span className="font-mono text-label text-graphite-soft animate-pulse">
                saving…
              </span>
            )}
          </div>
        )}
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
        <div className="border border-rule paper-recess px-5 py-12 text-center text-body italic text-graphite">
          PDF preview unavailable — matter root not set.
        </div>
      )}

      <div>
        <div className="smcp text-label text-graphite-soft  mb-2">
          ·  facts
        </div>
        {entry.error ? (
          <div className="font-mono text-meta text-ink">
            error · {entry.error.code}: {entry.error.message}
          </div>
        ) : entry.facts ? (
          <MemoryFactsList facts={entry.facts} />
        ) : (
          <div className="text-meta italic text-graphite-soft">
            No facts extracted.
          </div>
        )}
      </div>
    </div>
  );
}
