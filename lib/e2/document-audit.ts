/**
 * E-2 deterministic missingness auditor.
 *
 * Pure function — no LLM calls. Takes:
 *   - CaseProfile      (axis 2)
 *   - FilledExhibit[]  (PDFs already classified to doc-type ids)
 *   - ConflictRegisterEntry[]  (cross-document inconsistencies, optional)
 *
 * Produces a MissingnessReport with:
 *   - per-slot resolution (filled / partially_filled / missing / inadequate)
 *   - fatal gaps (severity ≥ 4)
 *   - max severity across all resolutions and conflicts
 *   - summary counts
 *
 * The audit is deterministic: same inputs always yield same outputs. This
 * means we can run it on every document upload to give the user immediate,
 * rule-based feedback without any LLM cost.
 */

import type {
  CaseProfile,
  ConflictRegisterEntry,
  FilledExhibit,
  MissingnessReport,
  Severity,
  SlotResolution,
} from './types';
import { resolveSlots } from './proof-matrix';
import { PROOF_SLOTS_BY_ID } from './proof-slots';
import { DOC_TYPES_BY_ID } from './doc-taxonomy';

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

/** Map a doc-type-id → list of slot ids it can fill (per doc-taxonomy.ts). */
function buildFillsIndex(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [docTypeId, dt] of Object.entries(DOC_TYPES_BY_ID)) {
    out[docTypeId] = [...dt.fills_proof_slots];
  }
  return out;
}

const FILLS_INDEX = buildFillsIndex();

function maxAps(values: number[]): 0 | 1 | 2 | 3 | 4 | 5 {
  if (values.length === 0) return 0;
  const m = Math.max(...values);
  return Math.min(5, Math.max(0, Math.round(m))) as 0 | 1 | 2 | 3 | 4 | 5;
}

function maxSeverity(values: Severity[]): Severity {
  if (values.length === 0) return 1;
  return Math.min(5, Math.max(...values)) as Severity;
}

// ───────────────────────────────────────────────────────────────────────────
// Audit
// ───────────────────────────────────────────────────────────────────────────

export interface AuditInput {
  case_profile: CaseProfile;
  filled_exhibits: FilledExhibit[];
  conflicts?: ConflictRegisterEntry[];
}

export function auditDocuments(input: AuditInput): MissingnessReport {
  const { case_profile, filled_exhibits, conflicts = [] } = input;

  const required = resolveSlots(case_profile);

  // Build a slot_id → FilledExhibit[] map by walking each exhibit's doc-type fills.
  const slotFills: Record<string, FilledExhibit[]> = {};
  for (const exhibit of filled_exhibits) {
    const slotIds = FILLS_INDEX[exhibit.doc_type_id] ?? [];
    for (const sid of slotIds) {
      (slotFills[sid] ||= []).push(exhibit);
    }
  }

  // Build a SlotResolution for every slot in the resolved set.
  const resolutions: SlotResolution[] = required.map(({ slot_id, requirement }) => {
    const slot = PROOF_SLOTS_BY_ID[slot_id];
    const filled_by = slotFills[slot_id] ?? [];
    const highest_aps = maxAps(filled_by.map((e) => e.effective_aps));

    let status: SlotResolution['status'];
    if (filled_by.length === 0) {
      status = 'missing';
    } else if (slot && highest_aps < 3) {
      status = 'inadequate';
    } else {
      status = 'filled';
    }

    let effective_severity: Severity = 1;
    if (slot) {
      if (status === 'missing') effective_severity = slot.severity_if_missing;
      else if (status === 'inadequate') effective_severity = slot.severity_if_inadequate;
      else effective_severity = 1; // filled — no penalty
    }

    return {
      slot_id,
      requirement,
      status,
      filled_by,
      highest_aps,
      effective_severity,
    };
  });

  // Categorize.
  const fatal_gaps = resolutions.filter(
    (r) => r.requirement === 'required' && (r.status === 'missing' || r.status === 'inadequate') && r.effective_severity >= 4,
  );
  const recommended_gaps = resolutions.filter(
    (r) => r.requirement === 'recommended' && r.status === 'missing',
  );

  const allSeverities: Severity[] = [
    ...resolutions.map((r) => r.effective_severity),
    ...conflicts.map((c) => c.severity),
  ];
  const max_severity = maxSeverity(allSeverities);

  const by_severity: Record<Severity, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of resolutions) by_severity[r.effective_severity]++;
  for (const c of conflicts) by_severity[c.severity]++;

  const required_count = resolutions.filter((r) => r.requirement === 'required').length;
  const required_filled = resolutions.filter((r) => r.requirement === 'required' && r.status === 'filled').length;
  const recommended_count = resolutions.filter((r) => r.requirement === 'recommended').length;
  const recommended_filled = resolutions.filter((r) => r.requirement === 'recommended' && r.status === 'filled').length;

  return {
    case_profile,
    resolutions,
    fatal_gaps,
    recommended_gaps,
    conflicts,
    max_severity,
    summary: {
      required_count,
      required_filled,
      recommended_count,
      recommended_filled,
      fatal_count: fatal_gaps.length,
      conflict_count: conflicts.length,
      by_severity,
    },
  };
}
