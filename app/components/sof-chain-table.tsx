'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import type { E2Facts } from '@/ingest';

type SofRow = E2Facts['source_of_funds'][number];

interface FieldLeaf<T> {
  value: T | null;
  source_page: number | null;
  source_quote: string | null;
  confidence: number | null;
}

const dash = '—';

const fmtUSD = (n: number | null): string => {
  if (n === null || Number.isNaN(n)) return dash;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
};

const maskLast4 = (s: string | null): string => {
  if (!s) return dash;
  if (s.length <= 4) return s;
  return `••••${s.slice(-4)}`;
};

interface Props {
  matterId: string;
  rows: SofRow[];
}

export function SofChainTable({ matterId, rows }: Props) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-ink-2">
            <Th w="w-9">#</Th>
            <Th>Origin category</Th>
            <Th right w="w-[8.5rem]">Amount (USD)</Th>
            <Th>Origin evidence</Th>
            <Th>Final destination</Th>
            <Th>Notes</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const base = `source_of_funds[${i}]`;
            return (
              <tr
                key={i}
                className="border-b border-rule last:border-b-0 align-top hover:bg-paper-2/40 transition-colors"
              >
                <td className="py-3 pr-2 font-mono text-meta text-graphite-soft tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </td>
                <Td>
                  <EditableCell
                    matterId={matterId}
                    fieldPath={`${base}.origin_category`}
                    leaf={row.origin_category}
                  />
                </Td>
                <Td right>
                  <EditableCell
                    matterId={matterId}
                    fieldPath={`${base}.origin_amount_usd`}
                    leaf={row.origin_amount_usd}
                    kind="currency"
                  />
                </Td>
                <Td>
                  <EditableCell
                    matterId={matterId}
                    fieldPath={`${base}.origin_evidence`}
                    leaf={row.origin_evidence}
                  />
                </Td>
                <Td>
                  <EditableCell
                    matterId={matterId}
                    fieldPath={`${base}.final_destination`}
                    leaf={row.final_destination}
                    mask="last4"
                  />
                </Td>
                <Td>
                  <EditableCell
                    matterId={matterId}
                    fieldPath={`${base}.notes`}
                    leaf={row.notes}
                    multiline
                  />
                </Td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-ink-2">
            <td colSpan={2} className="pt-3 smcp text-graphite">Σ chain total</td>
            <td className="pt-3 text-right font-mono text-title font-semibold tabular-nums text-ink">
              {fmtUSD(
                rows.reduce<number>(
                  (acc, r) => acc + (r.origin_amount_usd.value ?? 0),
                  0,
                ),
              )}
            </td>
            <td colSpan={3} />
          </tr>
        </tfoot>
      </table>
      <p className="mt-4 text-meta text-graphite-soft max-w-[68ch] leading-relaxed">
        Click any cell to edit. Saves on blur (⏎ to commit, esc to revert). Account
        identifiers display as last-four only; full digits never leave the audit log.
      </p>
    </div>
  );
}

function Th({
  children,
  right,
  w,
}: {
  children: React.ReactNode;
  right?: boolean;
  w?: string;
}) {
  return (
    <th
      className={
        'pb-2.5 smcp text-graphite font-medium ' +
        (right ? 'text-right' : 'text-left') +
        (w ? ` ${w}` : '')
      }
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <td
      className={
        'py-3 pr-3 align-top ' + (right ? 'text-right tabular-nums' : '')
      }
    >
      {children}
    </td>
  );
}

/* -------------------------------------------------------------------------- */
/* EditableCell — click to edit, blur/Enter to save, Esc to revert            */
/* -------------------------------------------------------------------------- */

type CellKind = 'text' | 'currency';
type CellMask = 'last4';

interface EditableCellProps {
  matterId: string;
  fieldPath: string;
  leaf: FieldLeaf<unknown>;
  kind?: CellKind;
  mask?: CellMask;
  multiline?: boolean;
}

type CellState = 'idle' | 'editing' | 'saving' | 'saved' | 'error';

function EditableCell({
  matterId,
  fieldPath,
  leaf,
  kind = 'text',
  mask,
  multiline,
}: EditableCellProps) {
  const [value, setValue] = useState<string | number | null>(leaf.value as string | number | null);
  const [draft, setDraft] = useState<string>(stringifyForEdit(value, kind));
  const [state, setState] = useState<CellState>('idle');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const enterEdit = useCallback(() => {
    setDraft(stringifyForEdit(value, kind));
    setState('editing');
  }, [value, kind]);

  const cancel = useCallback(() => {
    setDraft(stringifyForEdit(value, kind));
    setState('idle');
    setError(null);
  }, [value, kind]);

  const commit = useCallback(async () => {
    const parsed = parseFromEdit(draft, kind);
    if (parsed === '__INVALID__') {
      setError('Invalid value');
      setState('error');
      return;
    }
    if (parsed === value) {
      setState('idle');
      return;
    }
    setState('saving');
    setError(null);
    try {
      const res = await fetch(`/api/matter/${encodeURIComponent(matterId)}/fact`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_path: fieldPath,
          new_value: parsed,
          source_quote: leaf.source_quote,
          source_page: leaf.source_page,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      setValue(parsed);
      setState('saved');
      setTimeout(() => setState((s) => (s === 'saved' ? 'idle' : s)), 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState('error');
    }
  }, [draft, kind, value, matterId, fieldPath, leaf.source_quote, leaf.source_page]);

  useEffect(() => {
    if (state === 'editing' && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [state]);

  const onChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setDraft(e.target.value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    } else if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      void commit();
    } else if (e.key === 'Enter' && multiline && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void commit();
    }
  };

  if (state === 'editing' || state === 'saving') {
    const sharedClass =
      'w-full bg-paper border border-ink px-2 py-1 outline-none text-ink text-body ' +
      (kind === 'currency' ? 'font-mono tabular-nums text-right' : 'font-body');
    if (multiline) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          className={sharedClass + ' min-h-[3.4rem] resize-y leading-snug'}
          value={draft}
          onChange={onChange}
          onBlur={commit}
          onKeyDown={onKeyDown}
          disabled={state === 'saving'}
        />
      );
    }
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        className={sharedClass}
        value={draft}
        onChange={onChange}
        onBlur={commit}
        onKeyDown={onKeyDown}
        disabled={state === 'saving'}
        type={kind === 'currency' ? 'number' : 'text'}
        step={kind === 'currency' ? '1' : undefined}
      />
    );
  }

  const display = formatForDisplay(value, kind, mask);
  const empty = display === dash;
  const stateRing =
    state === 'saved'
      ? 'after:bg-ink'
      : state === 'error'
        ? 'after:bg-ink'
        : 'after:bg-transparent';

  return (
    <button
      type="button"
      onClick={enterEdit}
      title={
        error
          ? `Save failed: ${error}`
          : leaf.source_quote
            ? `${leaf.source_quote}${leaf.source_page ? ` (p. ${leaf.source_page})` : ''}`
            : 'click to edit'
      }
      className={
        'group relative w-full text-left -mx-1.5 px-1.5 py-0.5 cursor-text text-body ' +
        'hover:bg-paper-2/70 hover:outline hover:outline-1 hover:outline-rule transition-colors ' +
        'after:content-[""] after:absolute after:left-0 after:top-0 after:bottom-0 after:w-[2px] ' +
        'after:transition-colors ' +
        stateRing +
        ' ' +
        (kind === 'currency' ? 'font-mono tabular-nums' : '') +
        ' ' +
        (empty ? 'text-graphite-soft italic' : 'text-ink')
      }
    >
      <span className="block min-h-[1.2em] whitespace-pre-wrap break-words">{display}</span>
      {leaf.source_page !== null && !empty && (
        <span className="font-mono text-label text-graphite-soft align-top opacity-0 group-hover:opacity-100 transition-opacity">
          {' '}
          p.{leaf.source_page}
        </span>
      )}
    </button>
  );
}

function stringifyForEdit(value: unknown, kind: CellKind): string {
  if (value === null || value === undefined) return '';
  if (kind === 'currency' && typeof value === 'number') return String(value);
  return String(value);
}

function parseFromEdit(
  draft: string,
  kind: CellKind,
): string | number | null | '__INVALID__' {
  const trimmed = draft.trim();
  if (trimmed.length === 0) return null;
  if (kind === 'currency') {
    const cleaned = trimmed.replace(/[^0-9.\-]/g, '');
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return '__INVALID__';
    return n;
  }
  return trimmed;
}

function formatForDisplay(
  value: unknown,
  kind: CellKind,
  mask?: CellMask,
): string {
  if (value === null || value === undefined || value === '') return dash;
  if (kind === 'currency' && typeof value === 'number') return fmtUSD(value);
  if (mask === 'last4' && typeof value === 'string') {
    const acctMatch = value.match(/(?:acct|account|wire|ref|no\.?)\s*[:#]?\s*(\d{5,})/i);
    if (acctMatch) {
      return value.replace(acctMatch[1], `••••${acctMatch[1].slice(-4)}`);
    }
    return value;
  }
  return String(value);
}
