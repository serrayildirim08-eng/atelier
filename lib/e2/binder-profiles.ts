/**
 * Base BinderProfiles for USCIS Subtype 1/2/3/4 and the generic consular template.
 *
 * Per-post overrides live in lib/e2/binder-posts.ts and are applied on top of
 * `consular_base` to produce the final consular profile.
 *
 * Base profiles encode SECTION ORDERING and LABELS — the semantic framework
 * defined in types.ts (SemanticSection) is mapped here to physical tabs that
 * match how the firm actually files.
 *
 * Subtype-specific notes:
 *   - Subtype-1 (individual investor):     Tabs A-L (Kacar-Salih convention)
 *   - Subtype-2 (corporate-owned):         adds foreign_entity_ownership tab
 *   - Subtype-3 (executive/supervisory):   replaces investment_sof_individual
 *                                           with investment_sof_corporate
 *   - Subtype-4 (essential skills):        Tabs A-H, content per letter differs
 *                                           (specialized_knowledge replaces some)
 */

import type { BinderProfile, SemanticSection } from './types';

// ───────────────────────────────────────────────────────────────────────────
// USCIS SUBTYPE 1 — Individual Investor (Kacar-Salih convention)
// ───────────────────────────────────────────────────────────────────────────

export const USCIS_SUBTYPE1: BinderProfile = {
  profile_id: 'uscis-subtype1',
  applies_to: {
    posture: ['uscis_change_of_status', 'uscis_extension'],
    principal_subtype: ['individual_investor'],
  },
  ordered_sections: [
    { semantic: 'forms', physical_label: 'TAB A', physical_order: 1, title: 'USCIS forms package' },
    { semantic: 'cover_letter', physical_label: 'TAB B', physical_order: 2, title: 'Cover letter / legal memorandum' },
    { semantic: 'applicant_personal', physical_label: 'TAB C', physical_order: 3, title: 'Applicant personal documents' },
    { semantic: 'treaty_nationality', physical_label: 'TAB D', physical_order: 4, title: 'Treaty nationality & ownership' },
    { semantic: 'ownership_corporate_history', physical_label: 'TAB E', physical_order: 5, title: 'Corporate formation & history' },
    { semantic: 'investment_sof_individual', physical_label: 'TAB F', physical_order: 6, title: 'Investment & source of funds' },
    { semantic: 'substantiality', physical_label: 'TAB G', physical_order: 7, title: 'Substantiality / proportionality' },
    { semantic: 'real_and_operating', physical_label: 'TAB H', physical_order: 8, title: 'Real & operating business' },
    { semantic: 'marginality_capacity', physical_label: 'TAB I', physical_order: 9, title: 'Marginality / business plan' },
    { semantic: 'develop_and_direct', physical_label: 'TAB J', physical_order: 10, title: 'Develop & direct' },
    { semantic: 'intent_to_depart_principal', physical_label: 'TAB K', physical_order: 11, title: 'Intent to depart' },
    { semantic: 'dependent_forms', physical_label: 'TAB L', physical_order: 12, title: 'Dependent forms & biographic' },
  ],
  page_cap: null,
  excluded_from_page_cap: [],
  submission: { portal: 'uscis_lockbox', address: 'USCIS Texas/California Service Center per current direct-filing chart' },
  format_rules: { pdf_only: false, file_naming_convention: 'TAB A through TAB L' },
  local_doc_additions: [],
};

// ───────────────────────────────────────────────────────────────────────────
// USCIS SUBTYPE 2 — Corporate-Owned Investor
// ───────────────────────────────────────────────────────────────────────────

export const USCIS_SUBTYPE2: BinderProfile = {
  profile_id: 'uscis-subtype2',
  applies_to: {
    posture: ['uscis_change_of_status', 'uscis_extension'],
    principal_subtype: ['corporate_owned_investor'],
  },
  ordered_sections: [
    { semantic: 'forms', physical_label: 'TAB A', physical_order: 1, title: 'USCIS forms package' },
    { semantic: 'cover_letter', physical_label: 'TAB B', physical_order: 2, title: 'Cover letter / legal memorandum' },
    { semantic: 'applicant_personal', physical_label: 'TAB C', physical_order: 3, title: 'Applicant personal documents' },
    { semantic: 'treaty_nationality', physical_label: 'TAB D', physical_order: 4, title: 'Treaty nationality & ownership' },
    { semantic: 'foreign_entity_ownership', physical_label: 'TAB E', physical_order: 5, title: 'Foreign parent entity & registry' },
    { semantic: 'ownership_corporate_history', physical_label: 'TAB F', physical_order: 6, title: 'U.S. corporate formation' },
    { semantic: 'investment_sof_corporate', physical_label: 'TAB G', physical_order: 7, title: 'Parent → Subsidiary investment' },
    { semantic: 'substantiality', physical_label: 'TAB H', physical_order: 8, title: 'Substantiality / proportionality' },
    { semantic: 'real_and_operating', physical_label: 'TAB I', physical_order: 9, title: 'Real & operating business' },
    { semantic: 'marginality_capacity', physical_label: 'TAB J', physical_order: 10, title: 'Marginality / business plan' },
    { semantic: 'develop_and_direct', physical_label: 'TAB K', physical_order: 11, title: 'Develop & direct' },
    { semantic: 'intent_to_depart_principal', physical_label: 'TAB L', physical_order: 12, title: 'Intent to depart' },
    { semantic: 'dependent_forms', physical_label: 'TAB M', physical_order: 13, title: 'Dependent forms & biographic' },
  ],
  page_cap: null,
  excluded_from_page_cap: [],
  submission: { portal: 'uscis_lockbox' },
  format_rules: { pdf_only: false, file_naming_convention: 'TAB A through TAB M' },
  local_doc_additions: [],
};

// ───────────────────────────────────────────────────────────────────────────
// USCIS SUBTYPE 3 — Executive / Supervisory Employee
// ───────────────────────────────────────────────────────────────────────────

export const USCIS_SUBTYPE3: BinderProfile = {
  profile_id: 'uscis-subtype3',
  applies_to: {
    posture: ['uscis_change_of_status', 'uscis_extension'],
    principal_subtype: ['executive_supervisory'],
  },
  ordered_sections: [
    { semantic: 'forms', physical_label: 'TAB A', physical_order: 1, title: 'USCIS forms package' },
    { semantic: 'cover_letter', physical_label: 'TAB B', physical_order: 2, title: 'Cover letter / legal memorandum' },
    { semantic: 'applicant_personal', physical_label: 'TAB C', physical_order: 3, title: 'Applicant personal documents' },
    { semantic: 'treaty_nationality', physical_label: 'TAB D', physical_order: 4, title: 'Treaty nationality & ownership' },
    { semantic: 'foreign_entity_ownership', physical_label: 'TAB E', physical_order: 5, title: 'Foreign parent entity (if applicable)' },
    { semantic: 'ownership_corporate_history', physical_label: 'TAB F', physical_order: 6, title: 'U.S. corporate formation' },
    { semantic: 'investment_sof_corporate', physical_label: 'TAB G', physical_order: 7, title: 'Investment & source of funds' },
    { semantic: 'real_and_operating', physical_label: 'TAB H', physical_order: 8, title: 'Real & operating business' },
    { semantic: 'marginality_capacity', physical_label: 'TAB I', physical_order: 9, title: 'Marginality / hiring plan' },
    { semantic: 'develop_and_direct', physical_label: 'TAB J', physical_order: 10, title: 'Executive/supervisory authority' },
    { semantic: 'intent_to_depart_principal', physical_label: 'TAB K', physical_order: 11, title: 'Intent to depart' },
    { semantic: 'dependent_forms', physical_label: 'TAB L', physical_order: 12, title: 'Dependent forms & biographic' },
  ],
  page_cap: null,
  excluded_from_page_cap: [],
  submission: { portal: 'uscis_lockbox' },
  format_rules: { pdf_only: false, file_naming_convention: 'TAB A through TAB L' },
  local_doc_additions: [],
};

// ───────────────────────────────────────────────────────────────────────────
// USCIS SUBTYPE 4 — Essential Skills Employee (Camural convention)
// ───────────────────────────────────────────────────────────────────────────

export const USCIS_SUBTYPE4: BinderProfile = {
  profile_id: 'uscis-subtype4',
  applies_to: {
    posture: ['uscis_change_of_status', 'uscis_extension'],
    principal_subtype: ['essential_skills_employee'],
  },
  ordered_sections: [
    { semantic: 'forms', physical_label: 'TAB A', physical_order: 1, title: 'USCIS forms package' },
    { semantic: 'cover_letter', physical_label: 'TAB B', physical_order: 2, title: 'Cover letter / legal memorandum' },
    { semantic: 'applicant_personal', physical_label: 'TAB C', physical_order: 3, title: 'Applicant personal documents' },
    { semantic: 'foreign_entity_ownership', physical_label: 'TAB D', physical_order: 4, title: 'Foreign parent entity & treaty nationality' },
    { semantic: 'investment_sof_corporate', physical_label: 'TAB E', physical_order: 5, title: 'Parent investment in U.S. enterprise' },
    { semantic: 'real_and_operating', physical_label: 'TAB F', physical_order: 6, title: 'U.S. enterprise real & operating' },
    { semantic: 'specialized_knowledge', physical_label: 'TAB G', physical_order: 7, title: 'Specialized knowledge: CV + service record + diplomas + certs + LoR' },
    { semantic: 'intent_to_depart_principal', physical_label: 'TAB H', physical_order: 8, title: 'Intent to depart & dependent forms' },
  ],
  page_cap: null,
  excluded_from_page_cap: [],
  submission: { portal: 'uscis_lockbox' },
  format_rules: { pdf_only: false, file_naming_convention: 'TAB A through TAB H' },
  local_doc_additions: [],
};

// ───────────────────────────────────────────────────────────────────────────
// CONSULAR BASE — generic consular template (no post yet applied)
// ───────────────────────────────────────────────────────────────────────────

const CONSULAR_BASE_SECTIONS: BinderProfile['ordered_sections'] = [
  { semantic: 'forms', physical_label: 'TAB A', physical_order: 1, title: 'DS-160 + DS-156E forms package' },
  { semantic: 'cover_letter', physical_label: 'TAB B', physical_order: 2, title: 'Cover letter / legal memorandum' },
  { semantic: 'applicant_personal', physical_label: 'TAB C', physical_order: 3, title: 'Applicant personal documents' },
  { semantic: 'treaty_nationality', physical_label: 'TAB D', physical_order: 4, title: 'Treaty nationality & ownership' },
  { semantic: 'ownership_corporate_history', physical_label: 'TAB E', physical_order: 5, title: 'Corporate formation & history' },
  { semantic: 'investment_sof_individual', physical_label: 'TAB F', physical_order: 6, title: 'Investment & source of funds' },
  { semantic: 'substantiality', physical_label: 'TAB G', physical_order: 7, title: 'Substantiality / proportionality' },
  { semantic: 'real_and_operating', physical_label: 'TAB H', physical_order: 8, title: 'Real & operating business' },
  { semantic: 'marginality_capacity', physical_label: 'TAB I', physical_order: 9, title: 'Marginality / business plan' },
];

export const CONSULAR_BASE: BinderProfile = {
  profile_id: 'consular-base',
  applies_to: {
    posture: ['consular_first_time', 'consular_renewal'],
    principal_subtype: ['individual_investor', 'corporate_owned_investor', 'executive_supervisory', 'essential_skills_employee'],
  },
  ordered_sections: CONSULAR_BASE_SECTIONS,
  page_cap: null,
  excluded_from_page_cap: [],
  submission: { portal: 'email', notes: 'Default consular template — most posts override this' },
  format_rules: { pdf_only: true, max_file_size_mb: 25 },
  local_doc_additions: [],
};

export const CONSULAR_BASE_SECTIONS_EXPORT = CONSULAR_BASE_SECTIONS;

// ───────────────────────────────────────────────────────────────────────────
// REGISTRY
// ───────────────────────────────────────────────────────────────────────────

export const BASE_PROFILES: BinderProfile[] = [
  USCIS_SUBTYPE1,
  USCIS_SUBTYPE2,
  USCIS_SUBTYPE3,
  USCIS_SUBTYPE4,
  CONSULAR_BASE,
];

export const BASE_PROFILES_BY_ID: Record<string, BinderProfile> = Object.fromEntries(
  BASE_PROFILES.map((p) => [p.profile_id, p]),
);

/** Helper: rewrite section labels/order using a stable transform. Used by
 *  per-post overrides to produce e.g., Tokyo "Tab 1...Tab 5" or Madrid
 *  combined-PDF layouts without redefining the entire section list. */
export function withSectionLabels(
  base: BinderProfile,
  labelFn: (i: number, section: SemanticSection) => string,
): BinderProfile['ordered_sections'] {
  return base.ordered_sections.map((s, i) => ({ ...s, physical_label: labelFn(i, s.semantic) }));
}
