/**
 * E-2 binder manifest emitter.
 *
 * Inputs:
 *   - CaseProfile (axis 2)
 *   - FilledExhibit[] (with page counts)
 *   - The resolved BinderProfile (subtype × posture × post)
 *
 * Output:
 *   BinderManifest with ordered tabs, exhibits in each tab, page counts per
 *   section, total filed pages, total pages counted toward cap, and warnings
 *   when a cap is approached or breached.
 *
 * Tab assignment rule:
 *   For each filled exhibit, look up its doc-type, find the proof slots it can
 *   fill, take the FIRST slot's semantic_section, and place the exhibit in the
 *   binder section matching that semantic. If no proof slot has a
 *   semantic_section (rare — work-product, translations), the exhibit is
 *   parked in `cover_letter` if that section exists, else dropped from the
 *   manifest with a warning.
 */

import type {
  BinderManifest,
  BinderProfile,
  CaseProfile,
  FilledExhibit,
  SemanticSection,
} from './types';
import { PROOF_SLOTS_BY_ID } from './proof-slots';
import { DOC_TYPES_BY_ID } from './doc-taxonomy';
import { getPostProfile } from './binder-posts';
import {
  USCIS_SUBTYPE1,
  USCIS_SUBTYPE2,
  USCIS_SUBTYPE3,
  USCIS_SUBTYPE4,
} from './binder-profiles';

// ───────────────────────────────────────────────────────────────────────────
// Profile selection
// ───────────────────────────────────────────────────────────────────────────

export function selectBinderProfile(profile: CaseProfile): BinderProfile {
  if (profile.posture === 'consular_first_time' || profile.posture === 'consular_renewal') {
    if (!profile.post) throw new Error('consular posture requires a post');
    return getPostProfile(profile.post);
  }
  // USCIS — choose by principal subtype.
  switch (profile.principal_subtype) {
    case 'individual_investor':
      return USCIS_SUBTYPE1;
    case 'corporate_owned_investor':
      return USCIS_SUBTYPE2;
    case 'executive_supervisory':
      return USCIS_SUBTYPE3;
    case 'essential_skills_employee':
      return USCIS_SUBTYPE4;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

interface ManifestExhibit {
  exhibit_id: string;
  doc_type_id: string;
  pdf_path: string;
  pages: number;
  effective_aps: 1 | 2 | 3 | 4 | 5;
}

interface InputExhibit extends FilledExhibit {
  pages: number;
  exhibit_id?: string;
}

/** First semantic section a doc-type can land in, by walking its proof_slots. */
function inferSection(docTypeId: string): SemanticSection | null {
  const dt = DOC_TYPES_BY_ID[docTypeId];
  if (!dt) return null;
  for (const slotId of dt.fills_proof_slots) {
    const slot = PROOF_SLOTS_BY_ID[slotId];
    if (slot?.semantic_section) return slot.semantic_section;
  }
  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// Build manifest
// ───────────────────────────────────────────────────────────────────────────

export interface ManifestInput {
  case_profile: CaseProfile;
  filled_exhibits: InputExhibit[];
  binder_profile?: BinderProfile;
}

export function buildBinderManifest(input: ManifestInput): BinderManifest {
  const { case_profile, filled_exhibits } = input;
  const binder = input.binder_profile ?? selectBinderProfile(case_profile);

  const sectionIndex = new Map<SemanticSection, BinderProfile['ordered_sections'][number]>();
  for (const s of binder.ordered_sections) sectionIndex.set(s.semantic, s);

  // Collect exhibits per semantic section.
  const exhibitsBySection: Map<SemanticSection, ManifestExhibit[]> = new Map();
  const warnings: string[] = [];

  filled_exhibits.forEach((ex, idx) => {
    let section = inferSection(ex.doc_type_id);
    if (!section || !sectionIndex.has(section)) {
      const fallback: SemanticSection = sectionIndex.has('cover_letter') ? 'cover_letter' : binder.ordered_sections[0]!.semantic;
      warnings.push(
        `Exhibit ${ex.pdf_path} (doc_type=${ex.doc_type_id}) has no matching section in profile ${binder.profile_id}; parked under ${fallback}.`,
      );
      section = fallback;
    }
    const list = exhibitsBySection.get(section) ?? [];
    list.push({
      exhibit_id: ex.exhibit_id ?? `EX-${String(idx + 1).padStart(3, '0')}`,
      doc_type_id: ex.doc_type_id,
      pdf_path: ex.pdf_path,
      pages: ex.pages,
      effective_aps: ex.effective_aps,
    });
    exhibitsBySection.set(section, list);
  });

  // Build the ordered_tabs in physical order.
  const sortedSections = [...binder.ordered_sections].sort((a, b) => a.physical_order - b.physical_order);
  const orderedTabs: BinderManifest['ordered_tabs'] = [];
  let totalPagesFiled = 0;
  let totalPagesCapped = 0;
  const excludedSet = new Set(binder.excluded_from_page_cap);

  for (const sec of sortedSections) {
    const exhibits = exhibitsBySection.get(sec.semantic) ?? [];
    const pageCount = exhibits.reduce((s, ex) => s + ex.pages, 0);
    totalPagesFiled += pageCount;
    if (!excludedSet.has(sec.semantic)) totalPagesCapped += pageCount;

    orderedTabs.push({
      semantic: sec.semantic,
      physical_label: sec.physical_label,
      title: sec.title,
      exhibits,
      page_count_in_section: pageCount,
    });
  }

  // Cap warnings.
  if (binder.page_cap !== null) {
    const cap = binder.page_cap;
    if (totalPagesCapped > cap) {
      warnings.push(`PAGE CAP EXCEEDED: ${totalPagesCapped}/${cap} pages count toward cap (${binder.profile_id}).`);
    } else if (totalPagesCapped >= Math.floor(cap * 0.9)) {
      warnings.push(`Approaching page cap: ${totalPagesCapped}/${cap} (${binder.profile_id}).`);
    }
  }

  return {
    case_profile,
    binder_profile: binder,
    ordered_tabs: orderedTabs,
    total_pages_filed: totalPagesFiled,
    total_pages_capped: totalPagesCapped,
    warnings,
  };
}
