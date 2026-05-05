/**
 * Mock EB-1A classifier output. The real shape is what the Haiku-tier
 * classifier (backend-senior, parallel) will emit per document:
 *
 *   {
 *     id: string                        // doc id
 *     filename: string                  // raw on-disk
 *     doc_type: DocType                 // taxonomy doc_type (research/2026-05-05_eb1a-doc-variant-taxonomy.md)
 *     variant_id: string                // 'V1' | 'V2' | …
 *     variant_label: string             // human-readable variant
 *     criterion: CriterionId            // primary bucket; doc may also surface secondaries
 *     secondary_criteria?: CriterionId[]// optional fan-out
 *     confidence: number                // 0..1
 *     uploaded_at: string               // ISO
 *   }
 *
 * The criterion taxonomy intentionally mirrors `criteria-meta.ts`. When
 * the backend contract lands, replace `getMockEB1ADocs` with the real
 * loader; the UI consumes through `loadMatterCriteriaBuckets`.
 */

import type { CriterionId } from '@/app/components/eb1a/criteria-meta';

export interface EB1ADocClassification {
  id: string;
  filename: string;
  doc_type: string;
  variant_id: string;
  variant_label: string;
  criterion: CriterionId;
  secondary_criteria?: CriterionId[];
  confidence: number;
  uploaded_at: string;
}

export interface MatterCriteriaProfile {
  /** Whether the candidate's profile activates (vii) Display. */
  triggers_display: boolean;
  /** Whether the candidate's profile activates (x) Commercial Success. */
  triggers_commercial_success: boolean;
  /** Reason for trigger — copy used in the activation marginalia. */
  display_trigger_reason?: string;
  commercial_success_trigger_reason?: string;
}

export interface EB1AClassifiedPayload {
  docs: EB1ADocClassification[];
  profile: MatterCriteriaProfile;
}

/* ────────────────────────────────────────────────────────────── seed data ── */

function d(
  id: string,
  filename: string,
  doc_type: string,
  variant_id: string,
  variant_label: string,
  criterion: CriterionId,
  confidence: number,
  uploaded_at: string,
  secondary_criteria?: CriterionId[],
): EB1ADocClassification {
  return {
    id,
    filename,
    doc_type,
    variant_id,
    variant_label,
    criterion,
    secondary_criteria,
    confidence,
    uploaded_at,
  };
}

/**
 * Default mock — STEM beneficiary (academic-ish), no Display, no Commercial
 * Success. Mirrors the kind of EB-1A profile Akalan files most often:
 * mid-career researcher / engineering lead.
 */
const DEFAULT_DOCS: EB1ADocClassification[] = [
  // Awards
  d('a1', 'TUBITAK_award_certificate_2022.pdf', 'award_certificate', 'V1', 'Formal certificate', 'awards', 0.94, '2026-04-20T10:14:00Z'),
  d('a2', 'TUBITAK_2022_press_release.pdf', 'award_certificate', 'V2', 'Award announcement', 'awards', 0.88, '2026-04-20T10:15:30Z'),
  d('a3', 'TUBITAK_selection_rules_packet.pdf', 'award_certificate', 'V3', 'Selection criteria packet', 'awards', 0.79, '2026-04-22T08:42:00Z'),

  // Membership
  d('m1', 'IEEE_senior_member_admission.pdf', 'membership_credential', 'V1', 'Admission letter', 'membership', 0.91, '2026-04-21T13:01:00Z'),

  // Media
  d('me1', 'milliyet_profile_feature_2024.pdf', 'media_article', 'V1', 'Feature / profile', 'media', 0.86, '2026-04-23T09:18:00Z'),
  d('me2', 'milliyet_circulation_audit_2024.pdf', 'media_article', 'V3', 'Circulation evidence', 'media', 0.74, '2026-04-23T09:20:00Z'),

  // Judge
  d('j1', 'IEEE_TPAMI_review_invite_2023.pdf', 'peer_review_invitation', 'V1', 'Review request email', 'judge', 0.92, '2026-04-19T15:44:00Z'),
  d('j2', 'publons_review_history_export.pdf', 'peer_review_invitation', 'V2', 'Completed-review confirmation', 'judge', 0.83, '2026-04-19T15:46:00Z'),
  d('j3', 'NeurIPS_PC_assignment_2024.pdf', 'judging_task_record', 'V1', 'Judging assignment / rubric', 'judge', 0.81, '2026-04-19T15:51:00Z'),

  // Original contributions
  d(
    'oc1', 'expert_letter_Dr_Aydin_independent.pdf', 'recommendation_letter', 'V1',
    'Independent expert letter', 'original_contributions', 0.9, '2026-04-24T11:22:00Z',
    ['critical_role'],
  ),
  d('oc2', 'scopus_citation_export.pdf', 'citation_report', 'V1', 'Database export', 'original_contributions', 0.88, '2026-04-24T11:24:00Z'),
  d('oc3', 'scival_field_normalized_memo.pdf', 'citation_report', 'V3', 'Field-normalized impact memo', 'original_contributions', 0.7, '2026-04-24T11:26:00Z'),
  d('oc4', 'patent_US11234567_face.pdf', 'patent_or_ip_filing', 'V1', 'Granted patent face', 'original_contributions', 0.93, '2026-04-25T07:11:00Z'),

  // Authorship
  d('au1', 'Demir_2023_TPAMI_reprint.pdf', 'published_paper', 'V1', 'Peer-reviewed journal article', 'authorship', 0.95, '2026-04-25T07:14:00Z'),
  d('au2', 'Demir_2024_NeurIPS_proceedings.pdf', 'published_paper', 'V2', 'Conference proceedings paper', 'authorship', 0.89, '2026-04-25T07:15:00Z'),

  // Critical role
  d('cr1', 'Akbank_AI_lead_role_description.pdf', 'recommendation_letter', 'V1', 'External stakeholder letter', 'critical_role', 0.84, '2026-04-26T16:02:00Z'),

  // Remuneration
  d('r1', 'Akbank_W2_equivalent_2024.pdf', 'salary_evidence', 'V1', 'Pay record', 'remuneration', 0.92, '2026-04-27T09:33:00Z'),
  d('r2', 'TUIK_field_benchmark_AI_2024.pdf', 'salary_evidence', 'V3', 'Field-benchmark report', 'remuneration', 0.78, '2026-04-27T09:35:00Z'),
];

const DEFAULT_PROFILE: MatterCriteriaProfile = {
  triggers_display: false,
  triggers_commercial_success: false,
};

/**
 * Returns the classified payload for a given matter id. For now, every id
 * returns the default seed; once the classifier ships, this will fetch by
 * matter id from storage.
 */
export function getMockEB1AClassifiedPayload(
  id: string,
): EB1AClassifiedPayload {
  void id;
  return {
    docs: DEFAULT_DOCS,
    profile: DEFAULT_PROFILE,
  };
}

/* ────────────────────────────────────────────────────────────── bucketing ── */

export interface CriterionBucket {
  criterion: CriterionId;
  docs: EB1ADocClassification[];
}

/**
 * Bucket classified docs by primary criterion. Secondary criteria are
 * intentionally NOT duplicated into other buckets — the primary is the
 * authoritative slot for evidence quality counting; secondaries surface
 * inside the doc card as cross-references.
 */
export function bucketDocsByCriterion(
  docs: EB1ADocClassification[],
): Map<CriterionId, EB1ADocClassification[]> {
  const map = new Map<CriterionId, EB1ADocClassification[]>();
  for (const doc of docs) {
    const arr = map.get(doc.criterion);
    if (arr) arr.push(doc);
    else map.set(doc.criterion, [doc]);
  }
  return map;
}
