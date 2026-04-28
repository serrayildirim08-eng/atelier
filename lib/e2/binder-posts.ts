/**
 * Per-consulate-post BinderProfile overrides.
 *
 * Each post defines:
 *   - Tab labels / numbering (Tokyo "Tab 1-5"; Paris "TAB A-G"; Madrid combined)
 *   - Page cap and excluded sections
 *   - Submission portal (email address, USVisaAppt, etc.)
 *   - Format rules (PDF size, naming convention)
 *   - Local doc additions (Tapu for Istanbul, Visura for Rome, etc.)
 *
 * These overrides are applied on top of CONSULAR_BASE in lib/e2/binder-profiles.ts.
 *
 * Sources:
 *   - research/2026-04-28_e2-consular-posts.md (per-post idiosyncrasies)
 *   - research/2026-04-28_e2-consular-filing.md (filing mechanics)
 */

import type { BinderProfile, ConsularPost } from './types';
import { CONSULAR_BASE } from './binder-profiles';

// Helper to clone the base sections — avoids accidental shared-reference mutation.
function cloneBaseSections(): BinderProfile['ordered_sections'] {
  return CONSULAR_BASE.ordered_sections.map((s) => ({ ...s }));
}

// ───────────────────────────────────────────────────────────────────────────
// ISTANBUL
// ───────────────────────────────────────────────────────────────────────────

export const ISTANBUL: BinderProfile = {
  ...CONSULAR_BASE,
  profile_id: 'consular-istanbul',
  applies_to: { ...CONSULAR_BASE.applies_to, post: 'istanbul' },
  ordered_sections: cloneBaseSections(),
  page_cap: 70,
  excluded_from_page_cap: ['forms', 'cover_letter'],
  submission: { portal: 'email', address: 'EVisasIstanbul@state.gov' },
  format_rules: { pdf_only: true, max_file_size_mb: 10, file_naming_convention: 'TAB A through TAB I (or J if subtype-specific tab)' },
  local_doc_additions: ['tapu_senedi', 'vergi_levhasi', 'foreign_corporate_registry_ticaret_sicil_gazetesi'],
};

// ───────────────────────────────────────────────────────────────────────────
// ANKARA
// ───────────────────────────────────────────────────────────────────────────

export const ANKARA: BinderProfile = {
  ...ISTANBUL,
  profile_id: 'consular-ankara',
  applies_to: { ...CONSULAR_BASE.applies_to, post: 'ankara' },
  ordered_sections: cloneBaseSections(),
  submission: { portal: 'email', address: 'EVisasAnkara@state.gov' },
};

// ───────────────────────────────────────────────────────────────────────────
// TOKYO — Tab 1–5 numbering, 70-page cap, Tab 1 excluded from cap
// ───────────────────────────────────────────────────────────────────────────

const TOKYO_SECTIONS: BinderProfile['ordered_sections'] = [
  { semantic: 'forms', physical_label: 'Tab 1', physical_order: 1, title: 'Tab 1 — DS-156E + DS-160 + cover materials (excluded from page cap)' },
  { semantic: 'treaty_nationality', physical_label: 'Tab 2', physical_order: 2, title: 'Tab 2 — Treaty nationality & corporate ownership' },
  { semantic: 'investment_sof_individual', physical_label: 'Tab 3', physical_order: 3, title: 'Tab 3 — Investment & source of funds' },
  { semantic: 'real_and_operating', physical_label: 'Tab 4', physical_order: 4, title: 'Tab 4 — Real & operating business' },
  { semantic: 'marginality_capacity', physical_label: 'Tab 5', physical_order: 5, title: 'Tab 5 — Marginality & develop-and-direct' },
];

export const TOKYO: BinderProfile = {
  ...CONSULAR_BASE,
  profile_id: 'consular-tokyo',
  applies_to: { ...CONSULAR_BASE.applies_to, post: 'tokyo' },
  ordered_sections: TOKYO_SECTIONS,
  page_cap: 70,
  excluded_from_page_cap: ['forms'],
  submission: { portal: 'email', address: 'TokyoEVisa@state.gov', notes: 'Tokyo enforces strict Tab 1–5 convention; Tab 1 (forms + cover) excluded from 70-page cap' },
  format_rules: { pdf_only: true, max_file_size_mb: 10, file_naming_convention: 'Tab 1 – Tab 5' },
  local_doc_additions: [],
};

// ───────────────────────────────────────────────────────────────────────────
// OSAKA / KOBE & NAHA — follow Tokyo conventions (per DOS uniform Japan procedure)
// ───────────────────────────────────────────────────────────────────────────

export const OSAKA_KOBE: BinderProfile = {
  ...TOKYO,
  profile_id: 'consular-osaka_kobe',
  applies_to: { ...CONSULAR_BASE.applies_to, post: 'osaka_kobe' },
  ordered_sections: TOKYO_SECTIONS.map((s) => ({ ...s })),
  submission: { portal: 'email', address: 'OsakaKobeEVisa@state.gov', notes: 'Follows Tokyo Tab 1–5 + 70-page cap convention' },
};

export const NAHA: BinderProfile = {
  ...TOKYO,
  profile_id: 'consular-naha',
  applies_to: { ...CONSULAR_BASE.applies_to, post: 'naha' },
  ordered_sections: TOKYO_SECTIONS.map((s) => ({ ...s })),
  submission: { portal: 'email', address: 'NahaEVisa@state.gov', notes: 'Follows Tokyo Tab 1–5 + 70-page cap convention' },
};

// ───────────────────────────────────────────────────────────────────────────
// FRANKFURT — standard letters, Handelsregister required for corporate cases
// ───────────────────────────────────────────────────────────────────────────

export const FRANKFURT: BinderProfile = {
  ...CONSULAR_BASE,
  profile_id: 'consular-frankfurt',
  applies_to: { ...CONSULAR_BASE.applies_to, post: 'frankfurt' },
  ordered_sections: cloneBaseSections(),
  page_cap: null,
  excluded_from_page_cap: [],
  submission: { portal: 'email', address: 'FRA-NIV-E@state.gov' },
  format_rules: { pdf_only: true, max_file_size_mb: 10 },
  local_doc_additions: ['foreign_corporate_registry_handelsregister'],
};

// ───────────────────────────────────────────────────────────────────────────
// PARIS — TAB A-G, 50-page cap, A-C + G-28 excluded
// ───────────────────────────────────────────────────────────────────────────

const PARIS_SECTIONS: BinderProfile['ordered_sections'] = [
  { semantic: 'forms', physical_label: 'TAB A', physical_order: 1, title: 'TAB A — DS-156E + DS-160 (excluded from cap)' },
  { semantic: 'cover_letter', physical_label: 'TAB B', physical_order: 2, title: 'TAB B — Cover letter (excluded from cap)' },
  { semantic: 'applicant_personal', physical_label: 'TAB C', physical_order: 3, title: 'TAB C — Applicant personal (excluded from cap)' },
  { semantic: 'treaty_nationality', physical_label: 'TAB D', physical_order: 4, title: 'TAB D — Treaty nationality & ownership' },
  { semantic: 'investment_sof_individual', physical_label: 'TAB E', physical_order: 5, title: 'TAB E — Investment & source of funds' },
  { semantic: 'real_and_operating', physical_label: 'TAB F', physical_order: 6, title: 'TAB F — Real & operating business' },
  { semantic: 'marginality_capacity', physical_label: 'TAB G', physical_order: 7, title: 'TAB G — Marginality (28-page sub-cap; excluded portion = pages 1-28 only)' },
];

export const PARIS: BinderProfile = {
  ...CONSULAR_BASE,
  profile_id: 'consular-paris',
  applies_to: { ...CONSULAR_BASE.applies_to, post: 'paris' },
  ordered_sections: PARIS_SECTIONS,
  page_cap: 50,
  excluded_from_page_cap: ['forms', 'cover_letter', 'applicant_personal'],
  submission: { portal: 'email', address: 'ParisEVisa@state.gov', notes: 'Paris 50-page cap; A-C and first 28 pages of TAB G excluded' },
  format_rules: { pdf_only: true, max_file_size_mb: 10, file_naming_convention: 'TAB A through TAB G' },
  local_doc_additions: ['foreign_corporate_registry_kbis'],
};

// ───────────────────────────────────────────────────────────────────────────
// LONDON
// ───────────────────────────────────────────────────────────────────────────

export const LONDON: BinderProfile = {
  ...CONSULAR_BASE,
  profile_id: 'consular-london',
  applies_to: { ...CONSULAR_BASE.applies_to, post: 'london' },
  ordered_sections: cloneBaseSections(),
  page_cap: null,
  excluded_from_page_cap: [],
  submission: { portal: 'usvisaappt_com', notes: 'London uses USVisaAppt portal upload — DOS authorized e-mail-bypass post' },
  format_rules: { pdf_only: true, max_file_size_mb: 10 },
  local_doc_additions: ['foreign_corporate_registry_companies_house'],
};

// ───────────────────────────────────────────────────────────────────────────
// TORONTO
// ───────────────────────────────────────────────────────────────────────────

export const TORONTO: BinderProfile = {
  ...CONSULAR_BASE,
  profile_id: 'consular-toronto',
  applies_to: { ...CONSULAR_BASE.applies_to, post: 'toronto' },
  ordered_sections: cloneBaseSections(),
  page_cap: 70,
  excluded_from_page_cap: ['forms'],
  submission: { portal: 'email', address: 'TorontoEVisas@state.gov' },
  format_rules: { pdf_only: true, max_file_size_mb: 10 },
  local_doc_additions: [],
};

// ───────────────────────────────────────────────────────────────────────────
// SEOUL
// ───────────────────────────────────────────────────────────────────────────

export const SEOUL: BinderProfile = {
  ...CONSULAR_BASE,
  profile_id: 'consular-seoul',
  applies_to: { ...CONSULAR_BASE.applies_to, post: 'seoul' },
  ordered_sections: cloneBaseSections(),
  page_cap: null,
  excluded_from_page_cap: [],
  submission: { portal: 'email', address: 'SeoulEVisa@state.gov' },
  format_rules: { pdf_only: true, max_file_size_mb: 10 },
  local_doc_additions: [],
};

// ───────────────────────────────────────────────────────────────────────────
// MADRID — most restrictive: 2 PDFs only (DS-156E + supporting), 30-page cap
// ───────────────────────────────────────────────────────────────────────────

const MADRID_SECTIONS: BinderProfile['ordered_sections'] = [
  { semantic: 'forms', physical_label: 'PDF 1', physical_order: 1, title: 'PDF 1 — DS-156E only' },
  { semantic: 'cover_letter', physical_label: 'PDF 2', physical_order: 2, title: 'PDF 2 — All supporting documents (cover, exhibits, everything)' },
  { semantic: 'applicant_personal', physical_label: 'PDF 2', physical_order: 2, title: 'PDF 2 — combined' },
  { semantic: 'treaty_nationality', physical_label: 'PDF 2', physical_order: 2, title: 'PDF 2 — combined' },
  { semantic: 'investment_sof_individual', physical_label: 'PDF 2', physical_order: 2, title: 'PDF 2 — combined' },
  { semantic: 'real_and_operating', physical_label: 'PDF 2', physical_order: 2, title: 'PDF 2 — combined' },
  { semantic: 'marginality_capacity', physical_label: 'PDF 2', physical_order: 2, title: 'PDF 2 — combined' },
];

export const MADRID: BinderProfile = {
  ...CONSULAR_BASE,
  profile_id: 'consular-madrid',
  applies_to: { ...CONSULAR_BASE.applies_to, post: 'madrid' },
  ordered_sections: MADRID_SECTIONS,
  page_cap: 30,
  excluded_from_page_cap: ['forms'],
  submission: { portal: 'email', address: 'MadridEVisa@state.gov', notes: 'Madrid: 2 PDFs only — DS-156E (PDF 1) + all supporting docs combined (PDF 2). Hard 30-page cap on PDF 2.' },
  format_rules: { pdf_only: true, max_file_size_mb: 10, file_naming_convention: '2 PDFs: DS-156E + supporting' },
  local_doc_additions: [],
};

// ───────────────────────────────────────────────────────────────────────────
// ROME — Visura camerale required for corporate-owned cases
// ───────────────────────────────────────────────────────────────────────────

export const ROME: BinderProfile = {
  ...CONSULAR_BASE,
  profile_id: 'consular-rome',
  applies_to: { ...CONSULAR_BASE.applies_to, post: 'rome' },
  ordered_sections: cloneBaseSections(),
  page_cap: null,
  excluded_from_page_cap: [],
  submission: { portal: 'email', address: 'RomeEVisa@state.gov' },
  format_rules: { pdf_only: true, max_file_size_mb: 10 },
  local_doc_additions: ['foreign_corporate_registry_visura'],
};

// ───────────────────────────────────────────────────────────────────────────
// REGISTRY
// ───────────────────────────────────────────────────────────────────────────

export const POST_PROFILES_BY_POST: Partial<Record<ConsularPost, BinderProfile>> = {
  istanbul: ISTANBUL,
  ankara: ANKARA,
  tokyo: TOKYO,
  osaka_kobe: OSAKA_KOBE,
  naha: NAHA,
  frankfurt: FRANKFURT,
  paris: PARIS,
  london: LONDON,
  toronto: TORONTO,
  seoul: SEOUL,
  madrid: MADRID,
  rome: ROME,
};

export function getPostProfile(post: ConsularPost): BinderProfile {
  return POST_PROFILES_BY_POST[post] ?? CONSULAR_BASE;
}
