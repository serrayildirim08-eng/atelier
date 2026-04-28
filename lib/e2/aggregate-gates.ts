/**
 * Map deterministic aggregate-gate row arrays from typed-aggregate.ts to
 * the unified ConflictRegisterEntry[] shape consumed by document-audit.
 *
 * The server runs ~15 rule-based gates and ships their row outputs via
 * IngestSuccess.aggregate_audit. Each gate has its own row shape but they
 * all carry: a description (what the gate found), a severity (1-5), and
 * pointers to the docs/fields involved. We normalize them here so the
 * audit pane can render them next to LLM-emitted conflicts uniformly.
 *
 * Field plucking is defensive (`unknown` → field) because the server
 * payload is intentionally typed as `unknown[]` to avoid pulling the
 * full typed-aggregate type graph into the client bundle.
 */

import type { ConflictRegisterEntry, Severity } from './types';

interface AggregateAuditLike {
  fx_gate_results?: unknown[];
  passport_validity_results?: unknown[];
  i94_status_results?: unknown[];
  translation_gate_results?: unknown[];
  salary_benchmark_results?: unknown[];
  cv_title_drift_results?: unknown[];
  personal_reference_results?: unknown[];
  credential_verifiability_results?: unknown[];
  tax_balance_sheet_results?: unknown[];
  pl_tax_net_income_results?: unknown[];
  real_estate_buyer_mismatch_results?: unknown[];
  incentive_recipient_mismatch_results?: unknown[];
  substantiality_recon_results?: unknown[];
  entity_coherence_results?: unknown[];
}

function s(v: unknown): string {
  return v == null ? '' : String(v);
}

function n(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  const num = Number(v);
  return Number.isFinite(num) ? num : undefined;
}

function clampSev(v: unknown): Severity {
  const num = n(v);
  if (num === undefined) return 3;
  return Math.min(5, Math.max(1, Math.round(num))) as Severity;
}

function get(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  return (obj as Record<string, unknown>)[key];
}

interface GateConverter {
  fieldName: string;
  rowsKey: keyof AggregateAuditLike;
  /** Build a ConflictRegisterEntry from one row. Return null to skip the row. */
  build: (row: unknown, idx: number) => ConflictRegisterEntry | null;
}

const CONVERTERS: GateConverter[] = [
  {
    fieldName: 'fx_drift',
    rowsKey: 'fx_gate_results',
    build: (row, idx) => {
      const desc = s(get(row, 'finding') || get(row, 'description'));
      if (!desc) return null;
      return {
        id: `fx_drift_${idx}`,
        description: `FX validation: ${desc}`,
        severity: clampSev(get(row, 'severity') ?? 4),
        evidence: [
          {
            pdf_path: s(get(row, 'wire_doc') || get(row, 'doc')),
            doc_type_id: 'wire_confirmation',
            field_name: 'fx_rate',
            value: s(get(row, 'observed_rate') || get(row, 'value')),
          },
        ].filter((e) => e.pdf_path),
      };
    },
  },
  {
    fieldName: 'passport_validity',
    rowsKey: 'passport_validity_results',
    build: (row, idx) => {
      const desc = s(get(row, 'finding') || get(row, 'description'));
      if (!desc) return null;
      return {
        id: `passport_validity_${idx}`,
        description: `Passport validity: ${desc}`,
        severity: clampSev(get(row, 'severity') ?? 4),
        evidence: [
          {
            pdf_path: s(get(row, 'passport_doc') || get(row, 'doc')),
            doc_type_id: 'passport_bio',
            field_name: 'expiry',
            value: s(get(row, 'expiry') || get(row, 'value')),
          },
        ].filter((e) => e.pdf_path),
      };
    },
  },
  {
    fieldName: 'i94_status',
    rowsKey: 'i94_status_results',
    build: (row, idx) => {
      const desc = s(get(row, 'finding') || get(row, 'description'));
      if (!desc) return null;
      return {
        id: `i94_status_${idx}`,
        description: `I-94 status: ${desc}`,
        severity: clampSev(get(row, 'severity') ?? 4),
        evidence: [
          {
            pdf_path: s(get(row, 'i94_doc') || get(row, 'doc')),
            doc_type_id: 'i94',
            field_name: 'admit_until',
            value: s(get(row, 'admit_until') || get(row, 'value')),
          },
        ].filter((e) => e.pdf_path),
      };
    },
  },
  {
    fieldName: 'translation_missing',
    rowsKey: 'translation_gate_results',
    build: (row, idx) => {
      const desc = s(get(row, 'finding') || get(row, 'description'));
      if (!desc) return null;
      return {
        id: `translation_${idx}`,
        description: `Translation: ${desc}`,
        severity: clampSev(get(row, 'severity') ?? 3),
        evidence: [
          {
            pdf_path: s(get(row, 'doc') || get(row, 'source_doc')),
            doc_type_id: 'certified_translation',
            field_name: 'certification',
            value: '',
          },
        ].filter((e) => e.pdf_path),
      };
    },
  },
  {
    fieldName: 'salary_below_benchmark',
    rowsKey: 'salary_benchmark_results',
    build: (row, idx) => {
      const desc = s(get(row, 'finding') || get(row, 'description'));
      if (!desc) return null;
      return {
        id: `salary_benchmark_${idx}`,
        description: `Salary benchmark: ${desc}`,
        severity: clampSev(get(row, 'severity') ?? 3),
        evidence: [
          {
            pdf_path: s(get(row, 'offer_doc') || get(row, 'doc')),
            doc_type_id: 'offer_letter',
            field_name: 'salary',
            value: s(get(row, 'offered_salary') || get(row, 'value')),
          },
        ].filter((e) => e.pdf_path),
      };
    },
  },
  {
    fieldName: 'cv_title_drift',
    rowsKey: 'cv_title_drift_results',
    build: (row, idx) => {
      const desc = s(get(row, 'finding') || get(row, 'description'));
      if (!desc) return null;
      return {
        id: `cv_title_${idx}`,
        description: `CV title drift: ${desc}`,
        severity: clampSev(get(row, 'severity') ?? 3),
        evidence: [
          {
            pdf_path: s(get(row, 'cv_doc') || get(row, 'doc')),
            doc_type_id: 'cv',
            field_name: 'title',
            value: s(get(row, 'cv_title') || get(row, 'value')),
          },
        ].filter((e) => e.pdf_path),
      };
    },
  },
  {
    fieldName: 'personal_reference_only',
    rowsKey: 'personal_reference_results',
    build: (row, idx) => {
      const desc = s(get(row, 'finding') || get(row, 'description'));
      if (!desc) return null;
      return {
        id: `personal_reference_${idx}`,
        description: `Reference letter: ${desc}`,
        severity: clampSev(get(row, 'severity') ?? 3),
        evidence: [
          {
            pdf_path: s(get(row, 'letter_doc') || get(row, 'doc')),
            doc_type_id: 'recommendation_letter',
            field_name: 'kind',
            value: s(get(row, 'letter_kind') || get(row, 'value')),
          },
        ].filter((e) => e.pdf_path),
      };
    },
  },
  {
    fieldName: 'credential_unverifiable',
    rowsKey: 'credential_verifiability_results',
    build: (row, idx) => {
      const desc = s(get(row, 'finding') || get(row, 'description'));
      if (!desc) return null;
      return {
        id: `credential_${idx}`,
        description: `Credential verifiability: ${desc}`,
        severity: clampSev(get(row, 'severity') ?? 3),
        evidence: [
          {
            pdf_path: s(get(row, 'credential_doc') || get(row, 'doc')),
            doc_type_id: 'diploma',
            field_name: 'apostille',
            value: '',
          },
        ].filter((e) => e.pdf_path),
      };
    },
  },
  {
    fieldName: 'tax_balance_sheet_drift',
    rowsKey: 'tax_balance_sheet_results',
    build: (row, idx) => {
      const desc = s(get(row, 'finding') || get(row, 'description'));
      if (!desc) return null;
      return {
        id: `tax_balance_sheet_${idx}`,
        description: `Tax balance sheet: ${desc}`,
        severity: clampSev(get(row, 'severity') ?? 4),
        evidence: [
          {
            pdf_path: s(get(row, 'tax_doc') || get(row, 'doc')),
            doc_type_id: 'tax_return_1120',
            field_name: 'schedule_l',
            value: s(get(row, 'observed_value') || get(row, 'value')),
          },
        ].filter((e) => e.pdf_path),
      };
    },
  },
  {
    fieldName: 'pl_tax_drift',
    rowsKey: 'pl_tax_net_income_results',
    build: (row, idx) => {
      const desc = s(get(row, 'finding') || get(row, 'description'));
      if (!desc) return null;
      return {
        id: `pl_tax_${idx}`,
        description: `P&L vs tax return: ${desc}`,
        severity: clampSev(get(row, 'severity') ?? 4),
        evidence: [
          {
            pdf_path: s(get(row, 'pl_doc') || get(row, 'doc')),
            doc_type_id: 'profit_loss_statement',
            field_name: 'net_income',
            value: s(get(row, 'pl_net_income') || get(row, 'value')),
          },
        ].filter((e) => e.pdf_path),
      };
    },
  },
  {
    fieldName: 'real_estate_buyer_mismatch',
    rowsKey: 'real_estate_buyer_mismatch_results',
    build: (row, idx) => {
      const desc = s(get(row, 'finding') || get(row, 'description'));
      if (!desc) return null;
      return {
        id: `re_buyer_${idx}`,
        description: `Real estate buyer: ${desc}`,
        severity: clampSev(get(row, 'severity') ?? 4),
        evidence: [
          {
            pdf_path: s(get(row, 're_doc') || get(row, 'doc')),
            doc_type_id: 'sale_contract',
            field_name: 'buyer_name',
            value: s(get(row, 'buyer_name') || get(row, 'value')),
          },
        ].filter((e) => e.pdf_path),
      };
    },
  },
  {
    fieldName: 'incentive_recipient_mismatch',
    rowsKey: 'incentive_recipient_mismatch_results',
    build: (row, idx) => {
      const desc = s(get(row, 'finding') || get(row, 'description'));
      if (!desc) return null;
      return {
        id: `incentive_${idx}`,
        description: `Incentive doc: ${desc}`,
        severity: clampSev(get(row, 'severity') ?? 3),
        evidence: [
          {
            pdf_path: s(get(row, 'incentive_doc') || get(row, 'doc')),
            doc_type_id: 'state_business_license',
            field_name: 'recipient_name',
            value: s(get(row, 'recipient_name') || get(row, 'value')),
          },
        ].filter((e) => e.pdf_path),
      };
    },
  },
  {
    fieldName: 'substantiality_recon',
    rowsKey: 'substantiality_recon_results',
    build: (row, idx) => {
      const desc = s(get(row, 'finding') || get(row, 'description'));
      if (!desc) return null;
      return {
        id: `substantiality_${idx}`,
        description: `Substantiality: ${desc}`,
        severity: clampSev(get(row, 'severity') ?? 4),
        evidence: [],
      };
    },
  },
  {
    fieldName: 'entity_coherence',
    rowsKey: 'entity_coherence_results',
    build: (row, idx) => {
      const desc = s(get(row, 'finding') || get(row, 'description'));
      if (!desc) return null;
      return {
        id: `entity_coherence_${idx}`,
        description: `Entity name coherence: ${desc}`,
        severity: clampSev(get(row, 'severity') ?? 3),
        evidence: [],
      };
    },
  },
];

/**
 * Convert a server-emitted aggregate_audit payload into ConflictRegisterEntry[].
 * Empty arrays / undefined fields produce no entries — only real findings
 * surface in the audit.
 */
export function aggregateGatesToConflicts(
  payload: AggregateAuditLike | undefined,
): ConflictRegisterEntry[] {
  if (!payload) return [];
  const out: ConflictRegisterEntry[] = [];
  for (const c of CONVERTERS) {
    const rows = payload[c.rowsKey];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    rows.forEach((row, idx) => {
      const entry = c.build(row, idx);
      if (entry) out.push(entry);
    });
  }
  return out;
}
