/**
 * Sub-application alias map (Phase-7 Task B).
 *
 * Bridges firm-internal folder / filename naming variants to the canonical
 * `sub1`..`sub6` slots used by `co_petitioners[].sub_application_status`.
 * Phase-6's `\bSub([1-6])\b` filename regex caught the canonical pattern;
 * this map fills in the variants the firm uses across older case folders
 * (`Subordinate-One`, `S1_PetitionerB`, `Sub_2-AyseTarlaci`, etc.).
 *
 * The map is consulted as a fallback by `deriveCoPetitionersEnriched`
 * AFTER the primary regex misses. Lookup is case-insensitive and matches
 * substrings on the filename (so `S1_PetitionerB-passport.pdf` still
 * resolves to `sub1`).
 *
 * Attorney-supplied per-matter aliases on
 * `caseFacts.facts.matter.sub_application_aliases` take precedence over
 * this static map.
 */

export type SubApplicationStatus = 'sub1' | 'sub2' | 'sub3' | 'sub4' | 'sub5' | 'sub6';

/**
 * Static alias map. Keys are normalized via `normalizeAliasKey` (lowercase,
 * non-alphanumeric stripped) and matched as substrings of the same
 * normalization applied to the filename. Order does not matter — the
 * first match wins on iteration. Add new variants here as the firm
 * surfaces them.
 */
export const SUB_APPLICATION_ALIAS_MAP: Record<string, SubApplicationStatus> = {
  sub1: 'sub1',
  sub_1: 'sub1',
  s1: 'sub1',
  subordinateone: 'sub1',
  subone: 'sub1',
  sub2: 'sub2',
  sub_2: 'sub2',
  s2: 'sub2',
  subordinatetwo: 'sub2',
  subtwo: 'sub2',
  sub3: 'sub3',
  sub_3: 'sub3',
  s3: 'sub3',
  subordinatethree: 'sub3',
  subthree: 'sub3',
  sub4: 'sub4',
  sub_4: 'sub4',
  s4: 'sub4',
  subordinatefour: 'sub4',
  subfour: 'sub4',
  sub5: 'sub5',
  sub_5: 'sub5',
  s5: 'sub5',
  subordinatefive: 'sub5',
  subfive: 'sub5',
  sub6: 'sub6',
  sub_6: 'sub6',
  s6: 'sub6',
  subordinatesix: 'sub6',
  subsix: 'sub6',
};

function normalizeAliasKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Resolve a filename to a sub-application slot. Tries the attorney-supplied
 * per-matter overrides first (when provided), then the static alias map.
 * Returns null when no alias matches.
 */
export function resolveSubApplicationAlias(
  filename: string,
  perMatterOverrides?: Record<string, string> | null,
): SubApplicationStatus | null {
  const normFilename = normalizeAliasKey(filename);
  if (!normFilename) return null;

  if (perMatterOverrides) {
    for (const [alias, slot] of Object.entries(perMatterOverrides)) {
      const normAlias = normalizeAliasKey(alias);
      if (!normAlias) continue;
      if (!normFilename.includes(normAlias)) continue;
      const normSlot = normalizeAliasKey(slot);
      if (/^sub[1-6]$/.test(normSlot)) {
        return normSlot as SubApplicationStatus;
      }
    }
  }

  for (const [alias, slot] of Object.entries(SUB_APPLICATION_ALIAS_MAP)) {
    if (normFilename.includes(alias)) return slot;
  }
  return null;
}
