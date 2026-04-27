/**
 * Display-name slot composition.
 *
 * The per-PDF classifier (typed-extract.ts) emits `display_name` directly
 * as a string per the patterns documented in the system prompt. This
 * module is the deterministic counterpart: a pure slot composer that
 * applies the global rules — separator, 110-char cap, drop priority —
 * without re-implementing the per-doc-type pattern table.
 *
 * Two consumers:
 *   1. Tests pin the slot-strip-priority cap behavior (see
 *      test/ingest/display-name.test.ts) without depending on Anthropic.
 *   2. The exhibit-list and document-inventory sort comparator extracts
 *      [Entity] (slot 1) and [Period] (last slot) from a rendered
 *      display_name to drive Tab → Entity → date desc → alphabetical.
 *
 * Slot order is canonical:
 *   [Entity] · [Institution] · [Identifier] · [Doc Type Label]
 *           · [Detail] · [Period]
 *
 * Drop priority on 110-char overflow:
 *   Detail → Identifier → Institution
 *
 * Diacritics are preserved (Salih Kaçar, Pomega Enerji A.Ş.). ASCII
 * folding is reserved for `suggested_filename` (the kebab-case audit
 * name, governed by app/api/matter/[id]/rename/route.ts).
 */

export const DISPLAY_NAME_SEPARATOR = ' · ';
export const DISPLAY_NAME_MAX_LEN = 110;
export const DISPLAY_NAME_EXT = '.pdf';

export interface DisplayNameSlots {
  entity?: string | null;
  institution?: string | null;
  identifier?: string | null;
  doc_type_label?: string | null;
  detail?: string | null;
  period?: string | null;
}

const SLOT_ORDER: readonly (keyof DisplayNameSlots)[] = [
  'entity',
  'institution',
  'identifier',
  'doc_type_label',
  'detail',
  'period',
] as const;

const DROP_PRIORITY: readonly (keyof DisplayNameSlots)[] = [
  'detail',
  'identifier',
  'institution',
] as const;

function composeFromSlots(
  slots: DisplayNameSlots,
  dropped: ReadonlySet<keyof DisplayNameSlots>,
): string {
  const parts: string[] = [];
  for (const key of SLOT_ORDER) {
    if (dropped.has(key)) continue;
    const v = slots[key];
    if (typeof v === 'string' && v.length > 0) parts.push(v);
  }
  return parts.join(DISPLAY_NAME_SEPARATOR) + DISPLAY_NAME_EXT;
}

/**
 * Compose a display name from its slots, applying the 110-char cap.
 *
 * If the assembled name exceeds the cap, slots are dropped in priority
 * Detail → Identifier → Institution until under (or all three are gone,
 * at which point the over-length string is returned — calling code is
 * expected to treat that as a content-author error and accept the
 * truncation pressure on the remaining slots).
 *
 * Empty / null slots are simply absent — no "[unknown]" or em-dash
 * placeholder is ever emitted.
 */
export function buildDisplayName(slots: DisplayNameSlots): string {
  const dropped = new Set<keyof DisplayNameSlots>();
  let name = composeFromSlots(slots, dropped);
  for (const drop of DROP_PRIORITY) {
    if (name.length <= DISPLAY_NAME_MAX_LEN) break;
    if (
      typeof slots[drop] === 'string' &&
      (slots[drop] as string).length > 0
    ) {
      dropped.add(drop);
      name = composeFromSlots(slots, dropped);
    }
  }
  return name;
}

/**
 * Extract the [Entity] slot — slot 1 — from a rendered display_name.
 * Used by the exhibit-list / document-inventory sort comparator to
 * group within a tab by entity. Returns the empty string when the
 * display_name is malformed (no separator).
 */
export function extractEntitySlot(displayName: string): string {
  const trimmed = displayName.replace(/\.pdf$/, '');
  const parts = trimmed.split(DISPLAY_NAME_SEPARATOR);
  return parts[0] ?? '';
}

/**
 * Extract the [Period] slot — last slot — from a rendered display_name.
 * The slot may be a bare ISO date ("2025-12-05"), a quarter-period
 * ("2024-Q1"), a year ("2023"), or a phrase ("expires 2032-04-11",
 * "as of 2025-12-31"). The caller normalizes via parsePeriodForSort.
 */
export function extractPeriodSlot(displayName: string): string {
  const trimmed = displayName.replace(/\.pdf$/, '');
  const parts = trimmed.split(DISPLAY_NAME_SEPARATOR);
  if (parts.length < 2) return '';
  return parts[parts.length - 1] ?? '';
}

/**
 * Return a sortable string from a Period slot, preferring ISO YYYY-MM-DD
 * > YYYY-MM > YYYY-Qn > YYYY. Quarters convert to a synthetic
 * mid-quarter month (Q1→02, Q2→05, Q3→08, Q4→11) so the lexicographic
 * compare keeps Q4 after Q1 of the same year. Returns '0000' when no
 * year is found, which sorts to the bottom of any descending order.
 */
export function parsePeriodForSort(period: string): string {
  if (!period) return '0000';
  const isoMatch = period.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const yearMonth = period.match(/(\d{4})-(\d{2})\b/);
  if (yearMonth) return `${yearMonth[1]}-${yearMonth[2]}-15`;
  const quarter = period.match(/(\d{4})-Q([1-4])/i);
  if (quarter) {
    const months = { '1': '02', '2': '05', '3': '08', '4': '11' } as const;
    return `${quarter[1]}-${months[quarter[2] as '1' | '2' | '3' | '4']}-15`;
  }
  const year = period.match(/(\d{4})/);
  if (year) return `${year[1]}-06-30`;
  return '0000';
}

/**
 * Tab → Entity → date desc → alphabetical comparator on rendered
 * display_name strings. The tab dimension is handled outside this
 * function (callers iterate tabs in TAB_ORDER); this comparator scopes
 * to within-tab ordering.
 */
export function compareDisplayNameInTab(a: string, b: string): number {
  const entityCmp = extractEntitySlot(a).localeCompare(
    extractEntitySlot(b),
    'en',
  );
  if (entityCmp !== 0) return entityCmp;
  const dateA = parsePeriodForSort(extractPeriodSlot(a));
  const dateB = parsePeriodForSort(extractPeriodSlot(b));
  if (dateA !== dateB) return dateB.localeCompare(dateA);
  return a.localeCompare(b, 'en');
}
