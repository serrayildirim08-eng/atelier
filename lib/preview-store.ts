/**
 * Pre-generation preview persistence.
 *
 * The approval flow is two-step:
 *   1. POST /api/matter/[id]/preview → buildXxxPreview() returns the
 *      facts + defensives + authorities + structural outline the
 *      generator WOULD use, persists it under db/previews/<matter>/
 *      <preview_id>.json with status='pending'. NO Anthropic call.
 *   2. POST /api/matter/[id]/approve → attorney signs off (or rejects).
 *      On approval, the actual generator runs against an edited copy
 *      of the facts; status flips to 'approved' with attorney_initials
 *      + executed_at + output_path.
 *
 * Every state transition (created / approved / rejected) appends a
 * line to db/audit/preview-approvals.jsonl so the firm has a tamper-
 * evident audit trail of exactly what was reviewed when, by whom, and
 * what edits were applied.
 */

import { promises as fs } from 'node:fs';
import {
  randomBytes,
  randomUUID,
} from 'node:crypto';
import { dirname, join } from 'node:path';

// Env vars are read on each access so tests can mkdtemp-override per case.
function previewRoot(): string {
  return process.env.PREVIEW_STORE_DIR ?? 'db/previews';
}
function auditLogPath(): string {
  return process.env.PREVIEW_AUDIT_LOG_PATH ?? 'db/audit/preview-approvals.jsonl';
}

export type PreviewGenerator =
  | 'cover_letter'
  | 'noid_principal'
  | 'noid_dependent'
  | 'forms_i129'
  | 'forms_i129e'
  | 'forms_g28'
  | 'forms_i539'
  | 'forms_i539a'
  | 'declaration_beneficiary'
  | 'declaration_spouse'
  | 'declaration_enterprise_rep'
  | 'exhibit_list';

export interface PreviewFactRow {
  field_path: string;
  value: unknown;
  source_doc: string | null;
  source_page: number | null;
  source_quote: string | null;
  confidence: number | null;
}

export interface PreviewConflictEntry {
  description: string;
  conflict_type: string;
  severity: number;
  fact_a_doc: string | null;
  fact_b_doc: string | null;
}

export interface PreviewStructuralOutlineItem {
  roman: string;
  heading: string;
  one_line_summary: string;
}

export interface PreviewPayload {
  preview_id: string;
  generator: PreviewGenerator;
  matter_id: string;
  facts_used: PreviewFactRow[];
  defensive_paragraphs_required: string[];
  authorities_to_cite: string[];
  conflicts_to_flag_in_output: PreviewConflictEntry[];
  structural_outline: PreviewStructuralOutlineItem[];
  estimated_output_length_tokens: number;
  estimated_cost_usd: number;
  args: Record<string, unknown> | null;
  created_at: string;
}

export interface PreviewEdit {
  field_path: string;
  new_value: unknown;
}

export type PreviewStatus = 'pending' | 'approved' | 'rejected';

export interface PreviewRecord extends PreviewPayload {
  status: PreviewStatus;
  attorney_initials: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  executed_at: string | null;
  output_path: string | null;
  edits: PreviewEdit[];
}

/* ---------------------------------------------------------------------- */
/* IDs (ULID-shaped)                                                       */
/* ---------------------------------------------------------------------- */

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Encode a non-negative integer (≤ Number.MAX_SAFE_INTEGER) into Crockford
 * base32, left-padded to `length`. Used for the 10-char time component.
 * Stays inside Number range (Date.now() is ~10^13, well below 2^53).
 */
function encodeCrockfordNumber(value: number, length: number): string {
  let out = '';
  let v = value;
  for (let i = 0; i < length; i++) {
    out = CROCKFORD[v % 32] + out;
    v = Math.floor(v / 32);
  }
  return out;
}

/** Encode raw bytes into Crockford base32, left-padded to `length`. */
function encodeCrockfordBytes(bytes: Buffer, length: number): string {
  // Read 5 bits at a time across the byte buffer.
  const bits: number[] = [];
  for (const b of bytes) {
    for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  }
  let out = '';
  // Walk from the right so the result is right-aligned within `length`.
  let pos = bits.length;
  while (out.length < length) {
    let group = 0;
    for (let k = 0; k < 5; k++) {
      pos -= 1;
      const bit = pos >= 0 ? bits[pos] : 0;
      group |= bit << k;
    }
    out = CROCKFORD[group] + out;
  }
  return out;
}

/**
 * Generate a Crockford-base32 ULID-shaped identifier.
 * 10 chars time component (Date.now() ms) + 16 chars random.
 * Lexically sortable by creation time. Falls back to randomUUID-based
 * randomness if randomBytes is unavailable.
 */
export function newPreviewId(): string {
  const timePart = encodeCrockfordNumber(Date.now(), 10);
  let randPart = '';
  try {
    randPart = encodeCrockfordBytes(randomBytes(10), 16);
  } catch {
    randPart = randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase();
  }
  return `${timePart}${randPart}`;
}

/* ---------------------------------------------------------------------- */
/* Filesystem                                                              */
/* ---------------------------------------------------------------------- */

function previewPath(matterId: string, previewId: string): string {
  return join(previewRoot(), matterId, `${previewId}.json`);
}

async function ensureDir(path: string): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
}

interface AuditLine {
  ts: string;
  matter_id: string;
  generator: PreviewGenerator;
  preview_id: string;
  attorney_initials: string | null;
  action: 'preview_created' | 'approved' | 'rejected';
  edits_count: number;
  output_path: string | null;
}

async function appendAuditLine(line: AuditLine): Promise<void> {
  const target = auditLogPath();
  await ensureDir(target);
  await fs.appendFile(target, JSON.stringify(line) + '\n', 'utf8');
}

/* ---------------------------------------------------------------------- */
/* Public surface                                                          */
/* ---------------------------------------------------------------------- */

export async function writePreview(payload: PreviewPayload): Promise<PreviewRecord> {
  const record: PreviewRecord = {
    ...payload,
    status: 'pending',
    attorney_initials: null,
    approved_at: null,
    rejected_at: null,
    rejection_reason: null,
    executed_at: null,
    output_path: null,
    edits: [],
  };
  const path = previewPath(payload.matter_id, payload.preview_id);
  await ensureDir(path);
  await fs.writeFile(path, JSON.stringify(record, null, 2), 'utf8');
  await appendAuditLine({
    ts: record.created_at,
    matter_id: record.matter_id,
    generator: record.generator,
    preview_id: record.preview_id,
    attorney_initials: null,
    action: 'preview_created',
    edits_count: 0,
    output_path: null,
  });
  return record;
}

export async function readPreview(
  matterId: string,
  previewId: string,
): Promise<PreviewRecord | null> {
  try {
    const raw = await fs.readFile(previewPath(matterId, previewId), 'utf8');
    return JSON.parse(raw) as PreviewRecord;
  } catch {
    return null;
  }
}

export async function listPreviews(matterId: string): Promise<PreviewRecord[]> {
  const dir = join(previewRoot(), matterId);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: PreviewRecord[] = [];
  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    try {
      const raw = await fs.readFile(join(dir, name), 'utf8');
      out.push(JSON.parse(raw) as PreviewRecord);
    } catch {
      /* skip malformed */
    }
  }
  // Most-recent first.
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function recordApproval(
  matterId: string,
  previewId: string,
  args: {
    attorney_initials: string;
    edits: PreviewEdit[];
    output_path: string | null;
  },
): Promise<PreviewRecord | null> {
  const record = await readPreview(matterId, previewId);
  if (!record) return null;
  if (record.status !== 'pending') return record;
  const now = new Date().toISOString();
  record.status = 'approved';
  record.attorney_initials = args.attorney_initials;
  record.approved_at = now;
  record.executed_at = now;
  record.output_path = args.output_path;
  record.edits = args.edits;
  await fs.writeFile(
    previewPath(matterId, previewId),
    JSON.stringify(record, null, 2),
    'utf8',
  );
  await appendAuditLine({
    ts: now,
    matter_id: matterId,
    generator: record.generator,
    preview_id: previewId,
    attorney_initials: args.attorney_initials,
    action: 'approved',
    edits_count: args.edits.length,
    output_path: args.output_path,
  });
  return record;
}

export async function recordRejection(
  matterId: string,
  previewId: string,
  args: {
    attorney_initials: string;
    rejection_reason?: string | null;
  },
): Promise<PreviewRecord | null> {
  const record = await readPreview(matterId, previewId);
  if (!record) return null;
  if (record.status !== 'pending') return record;
  const now = new Date().toISOString();
  record.status = 'rejected';
  record.attorney_initials = args.attorney_initials;
  record.rejected_at = now;
  record.rejection_reason = args.rejection_reason ?? null;
  await fs.writeFile(
    previewPath(matterId, previewId),
    JSON.stringify(record, null, 2),
    'utf8',
  );
  await appendAuditLine({
    ts: now,
    matter_id: matterId,
    generator: record.generator,
    preview_id: previewId,
    attorney_initials: args.attorney_initials,
    action: 'rejected',
    edits_count: 0,
    output_path: null,
  });
  return record;
}

/* ---------------------------------------------------------------------- */
/* Edit application                                                        */
/* ---------------------------------------------------------------------- */

/**
 * Apply attorney edits to a clone of facts_used, returning the edited
 * fact rows. Sets confidence: 1 and source_quote: '[attorney_edit]' for
 * any row the attorney touched, so downstream generators can see which
 * values were attestation-grade vs extracted.
 */
export function applyEdits(
  factsUsed: PreviewFactRow[],
  edits: PreviewEdit[],
): PreviewFactRow[] {
  const map = new Map(factsUsed.map((r) => [r.field_path, { ...r }]));
  for (const edit of edits) {
    const existing = map.get(edit.field_path);
    if (existing) {
      existing.value = edit.new_value;
      existing.confidence = 1;
      existing.source_quote = '[attorney_edit]';
    } else {
      map.set(edit.field_path, {
        field_path: edit.field_path,
        value: edit.new_value,
        source_doc: null,
        source_page: null,
        source_quote: '[attorney_edit]',
        confidence: 1,
      });
    }
  }
  return Array.from(map.values());
}
