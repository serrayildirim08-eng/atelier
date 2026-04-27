import type { CaseType } from '@/ingest/schema';

export type CitationKind =
  | 'ina' // INA § 101(a)(15)(E)(ii)
  | 'cfr' // 8 CFR § 214.2(e)(12)
  | 'fam' // 9 FAM 402.9-4(B)(1)
  | 'uscis_pm' // USCIS PM Vol. 6 Pt. F Ch. 2
  | 'case_name' // Matter of Walsh and Pollard
  | 'reporter_in_dec' // 20 I&N Dec. 60
  | 'reporter_federal' // 596 F.3d 1115
  | 'unknown';

export interface ExtractedCitation {
  kind: CitationKind;
  raw: string; // verbatim match from the letter
  normalized: string; // canonical form for allowlist comparison
  start: number; // index into the letter string
  end: number;
}

export type CitationVerifyStatus =
  | 'on_allowlist' // matches a per-case-type or shared allowlist entry
  | 'off_allowlist' // citation is well-formed but not authorized for this case type
  | 'aao_route_to_human' // AAO/BIA non-precedent — uncheckable, requires attorney review
  | 'unparseable'; // citation surface-form malformed (rare, surfaced for sanity)

export interface CitationVerifyFinding {
  citation: ExtractedCitation;
  status: CitationVerifyStatus;
  message: string;
}

export interface CitationVerifyResult {
  case_type: CaseType;
  total_citations: number;
  on_allowlist: number;
  off_allowlist: number;
  aao_routed: number;
  unparseable: number;
  findings: CitationVerifyFinding[];
}

export type LintCategory = 'defined_term_drift' | 'citation_format';

export interface LintFinding {
  category: LintCategory;
  message: string;
  excerpt: string; // up to ~30 words around the offending span
  start: number;
  end: number;
}

export interface VerifyReport {
  case_type: CaseType;
  citations: CitationVerifyResult;
  lint: LintFinding[];
  // Quick rollups for the UI + reviewer prompt.
  flagged_count: number;
  ok: boolean; // true if no off_allowlist + no aao_routed + no lint findings
}
