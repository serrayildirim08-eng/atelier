/**
 * E-2 treaty country list (qualifying treaty of commerce and navigation).
 *
 * Authority: 8 CFR 214.2(e)(1); 9 FAM 402.9-10 ("Treaty Country" table);
 * INA § 101(a)(15)(E)(ii). Mirror of the Department of State public list at
 * https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/fees/treaty.html
 * (filtered to E-2 / "Treaty Investor"; E-1-only entries excluded).
 *
 * Use this module when reasoning about whether an owner / petitioner is a
 * treaty national for principal-applicant identification, treaty-ownership
 * gates (9 FAM 402.9-4(B), §3.2 of the firm manual), or visa-class viability
 * before draft-mode runs.
 *
 * Important nuances (not encoded by `isTreatyNational`):
 *   - Bolivia: investments must have been in place before June 10, 2012;
 *     beneficiaries grandfathered until June 10, 2022 (now expired).
 *   - Ecuador: investments must have been in place before May 18, 2018;
 *     grandfathered until May 18, 2028.
 *   - Israel: effective May 1, 2019 (no retroactivity).
 *   - New Zealand: effective June 10, 2019 (Pub. L. 115-226).
 *   - Portugal: effective March 15, 2024.
 *   - China (Taiwan) is on the list; the People's Republic of China is NOT.
 *   - Yugoslavia: kept verbatim from State's list — a successor-state
 *     national (Serbia, Montenegro, Kosovo, Croatia, Bosnia, Macedonia,
 *     Slovenia) typically claims under their successor-state entry.
 *
 * The returned `isTreatyNational` is a soft, name-driven check. Cases with
 * Bolivia / Ecuador grandfather questions, dual nationality, or a USC who
 * acquired post-investment must be flagged for attorney review separately;
 * this helper returns `true` for the country without surfacing the date
 * caveat.
 */

/**
 * Canonical E-2 treaty country record. ISO 3166-1 alpha-2 / alpha-3 are
 * provided for callers that key off ISO codes (e.g. country pickers in the
 * UI); `nationalityAdjectives` covers the most common free-text spellings
 * seen on passports, formation docs, and shareholder registers.
 */
export interface E2TreatyCountry {
  /** Canonical English country name (matches DOS treaty list verbatim). */
  name: string;
  /** ISO 3166-1 alpha-2 code (null only for non-ISO entities like "Yugoslavia"). */
  iso2: string | null;
  /** ISO 3166-1 alpha-3 code (null only for non-ISO entities). */
  iso3: string | null;
  /**
   * Common nationality / demonym strings seen in extracted documents.
   * All-lowercase. Matched substring-wise after normalization.
   */
  nationalityAdjectives: readonly string[];
  /**
   * Common alternate country names (e.g. "South Korea" for "Korea (South)",
   * "UK" for "United Kingdom"). Lowercased; matched substring-wise.
   */
  aliases: readonly string[];
  /** Optional human-readable note about effective date / restrictions. */
  note?: string;
}

export const E2_TREATY_COUNTRIES: readonly E2TreatyCountry[] = [
  { name: 'Albania', iso2: 'AL', iso3: 'ALB', nationalityAdjectives: ['albanian'], aliases: [] },
  { name: 'Argentina', iso2: 'AR', iso3: 'ARG', nationalityAdjectives: ['argentine', 'argentinian', 'argentinean'], aliases: [] },
  { name: 'Armenia', iso2: 'AM', iso3: 'ARM', nationalityAdjectives: ['armenian'], aliases: [] },
  { name: 'Australia', iso2: 'AU', iso3: 'AUS', nationalityAdjectives: ['australian'], aliases: [] },
  { name: 'Austria', iso2: 'AT', iso3: 'AUT', nationalityAdjectives: ['austrian'], aliases: [] },
  { name: 'Azerbaijan', iso2: 'AZ', iso3: 'AZE', nationalityAdjectives: ['azerbaijani', 'azeri'], aliases: [] },
  { name: 'Bahrain', iso2: 'BH', iso3: 'BHR', nationalityAdjectives: ['bahraini'], aliases: [] },
  { name: 'Bangladesh', iso2: 'BD', iso3: 'BGD', nationalityAdjectives: ['bangladeshi'], aliases: [] },
  { name: 'Belgium', iso2: 'BE', iso3: 'BEL', nationalityAdjectives: ['belgian'], aliases: [] },
  {
    name: 'Bolivia',
    iso2: 'BO',
    iso3: 'BOL',
    nationalityAdjectives: ['bolivian'],
    aliases: [],
    note: 'Investments must pre-date June 10, 2012; grandfather window expired June 10, 2022.',
  },
  { name: 'Bosnia and Herzegovina', iso2: 'BA', iso3: 'BIH', nationalityAdjectives: ['bosnian', 'herzegovinian'], aliases: ['bosnia', 'herzegovina'] },
  { name: 'Brunei', iso2: 'BN', iso3: 'BRN', nationalityAdjectives: ['bruneian'], aliases: ['brunei darussalam'] },
  { name: 'Bulgaria', iso2: 'BG', iso3: 'BGR', nationalityAdjectives: ['bulgarian'], aliases: [] },
  { name: 'Cameroon', iso2: 'CM', iso3: 'CMR', nationalityAdjectives: ['cameroonian'], aliases: [] },
  { name: 'Canada', iso2: 'CA', iso3: 'CAN', nationalityAdjectives: ['canadian'], aliases: [] },
  { name: 'Chile', iso2: 'CL', iso3: 'CHL', nationalityAdjectives: ['chilean'], aliases: [] },
  {
    name: 'China (Taiwan)',
    iso2: 'TW',
    iso3: 'TWN',
    nationalityAdjectives: ['taiwanese'],
    // Deliberately excludes 'republic of china' / 'roc' / bare 'china' —
    // those aliases collide with PRC inputs and produce the wrong verdict.
    // Free-text "Taiwan", "Taiwanese", or ISO TW / TWN is the supported
    // surface for this entry.
    aliases: ['taiwan'],
    note: 'Only Taiwan (ROC) qualifies. The People’s Republic of China is NOT a treaty country.',
  },
  { name: 'Colombia', iso2: 'CO', iso3: 'COL', nationalityAdjectives: ['colombian'], aliases: [] },
  { name: 'Congo (Brazzaville)', iso2: 'CG', iso3: 'COG', nationalityAdjectives: ['congolese'], aliases: ['republic of the congo', 'congo brazzaville'] },
  { name: 'Congo (Kinshasa)', iso2: 'CD', iso3: 'COD', nationalityAdjectives: ['congolese'], aliases: ['democratic republic of the congo', 'drc', 'dr congo', 'congo kinshasa'] },
  { name: 'Costa Rica', iso2: 'CR', iso3: 'CRI', nationalityAdjectives: ['costa rican'], aliases: [] },
  { name: 'Croatia', iso2: 'HR', iso3: 'HRV', nationalityAdjectives: ['croatian'], aliases: [] },
  { name: 'Czech Republic', iso2: 'CZ', iso3: 'CZE', nationalityAdjectives: ['czech'], aliases: ['czechia'] },
  { name: 'Denmark', iso2: 'DK', iso3: 'DNK', nationalityAdjectives: ['danish'], aliases: [] },
  {
    name: 'Ecuador',
    iso2: 'EC',
    iso3: 'ECU',
    nationalityAdjectives: ['ecuadorian', 'ecuadoran'],
    aliases: [],
    note: 'Investments must pre-date May 18, 2018; grandfathered until May 18, 2028.',
  },
  { name: 'Egypt', iso2: 'EG', iso3: 'EGY', nationalityAdjectives: ['egyptian'], aliases: [] },
  { name: 'Estonia', iso2: 'EE', iso3: 'EST', nationalityAdjectives: ['estonian'], aliases: [] },
  { name: 'Ethiopia', iso2: 'ET', iso3: 'ETH', nationalityAdjectives: ['ethiopian'], aliases: [] },
  { name: 'Finland', iso2: 'FI', iso3: 'FIN', nationalityAdjectives: ['finnish', 'finn'], aliases: [] },
  { name: 'France', iso2: 'FR', iso3: 'FRA', nationalityAdjectives: ['french'], aliases: [] },
  { name: 'Georgia', iso2: 'GE', iso3: 'GEO', nationalityAdjectives: ['georgian'], aliases: [] },
  { name: 'Germany', iso2: 'DE', iso3: 'DEU', nationalityAdjectives: ['german'], aliases: ['federal republic of germany', 'deutschland'] },
  { name: 'Greece', iso2: 'GR', iso3: 'GRC', nationalityAdjectives: ['greek', 'hellenic'], aliases: ['hellenic republic'] },
  { name: 'Grenada', iso2: 'GD', iso3: 'GRD', nationalityAdjectives: ['grenadian'], aliases: [] },
  { name: 'Honduras', iso2: 'HN', iso3: 'HND', nationalityAdjectives: ['honduran'], aliases: [] },
  { name: 'Ireland', iso2: 'IE', iso3: 'IRL', nationalityAdjectives: ['irish'], aliases: [] },
  {
    name: 'Israel',
    iso2: 'IL',
    iso3: 'ISR',
    nationalityAdjectives: ['israeli'],
    aliases: [],
    note: 'E-2 treaty effective May 1, 2019.',
  },
  { name: 'Italy', iso2: 'IT', iso3: 'ITA', nationalityAdjectives: ['italian'], aliases: [] },
  { name: 'Jamaica', iso2: 'JM', iso3: 'JAM', nationalityAdjectives: ['jamaican'], aliases: [] },
  { name: 'Japan', iso2: 'JP', iso3: 'JPN', nationalityAdjectives: ['japanese'], aliases: [] },
  { name: 'Jordan', iso2: 'JO', iso3: 'JOR', nationalityAdjectives: ['jordanian'], aliases: [] },
  { name: 'Kazakhstan', iso2: 'KZ', iso3: 'KAZ', nationalityAdjectives: ['kazakh', 'kazakhstani'], aliases: [] },
  {
    name: 'Korea (South)',
    iso2: 'KR',
    iso3: 'KOR',
    nationalityAdjectives: ['korean', 'south korean'],
    aliases: ['south korea', 'republic of korea', 'rok'],
  },
  { name: 'Kosovo', iso2: 'XK', iso3: 'XKX', nationalityAdjectives: ['kosovar', 'kosovan'], aliases: ['republic of kosovo'] },
  { name: 'Kyrgyzstan', iso2: 'KG', iso3: 'KGZ', nationalityAdjectives: ['kyrgyz', 'kyrgyzstani'], aliases: [] },
  { name: 'Latvia', iso2: 'LV', iso3: 'LVA', nationalityAdjectives: ['latvian'], aliases: [] },
  { name: 'Liberia', iso2: 'LR', iso3: 'LBR', nationalityAdjectives: ['liberian'], aliases: [] },
  { name: 'Lithuania', iso2: 'LT', iso3: 'LTU', nationalityAdjectives: ['lithuanian'], aliases: [] },
  { name: 'Luxembourg', iso2: 'LU', iso3: 'LUX', nationalityAdjectives: ['luxembourgish', 'luxembourger'], aliases: [] },
  { name: 'Macedonia', iso2: 'MK', iso3: 'MKD', nationalityAdjectives: ['macedonian'], aliases: ['north macedonia', 'fyrom', 'republic of north macedonia'] },
  { name: 'Mexico', iso2: 'MX', iso3: 'MEX', nationalityAdjectives: ['mexican'], aliases: [] },
  { name: 'Moldova', iso2: 'MD', iso3: 'MDA', nationalityAdjectives: ['moldovan'], aliases: [] },
  { name: 'Mongolia', iso2: 'MN', iso3: 'MNG', nationalityAdjectives: ['mongolian'], aliases: [] },
  { name: 'Montenegro', iso2: 'ME', iso3: 'MNE', nationalityAdjectives: ['montenegrin'], aliases: [] },
  { name: 'Morocco', iso2: 'MA', iso3: 'MAR', nationalityAdjectives: ['moroccan'], aliases: [] },
  { name: 'Netherlands', iso2: 'NL', iso3: 'NLD', nationalityAdjectives: ['dutch', 'netherlandish'], aliases: ['holland', 'the netherlands'] },
  {
    name: 'New Zealand',
    iso2: 'NZ',
    iso3: 'NZL',
    nationalityAdjectives: ['new zealander', 'kiwi'],
    aliases: [],
    note: 'E-2 treaty effective June 10, 2019 (Pub. L. 115-226).',
  },
  { name: 'Norway', iso2: 'NO', iso3: 'NOR', nationalityAdjectives: ['norwegian'], aliases: [] },
  { name: 'Oman', iso2: 'OM', iso3: 'OMN', nationalityAdjectives: ['omani'], aliases: [] },
  { name: 'Pakistan', iso2: 'PK', iso3: 'PAK', nationalityAdjectives: ['pakistani'], aliases: [] },
  { name: 'Panama', iso2: 'PA', iso3: 'PAN', nationalityAdjectives: ['panamanian'], aliases: [] },
  { name: 'Paraguay', iso2: 'PY', iso3: 'PRY', nationalityAdjectives: ['paraguayan'], aliases: [] },
  { name: 'Philippines', iso2: 'PH', iso3: 'PHL', nationalityAdjectives: ['filipino', 'philippine'], aliases: ['the philippines'] },
  { name: 'Poland', iso2: 'PL', iso3: 'POL', nationalityAdjectives: ['polish'], aliases: [] },
  {
    name: 'Portugal',
    iso2: 'PT',
    iso3: 'PRT',
    nationalityAdjectives: ['portuguese'],
    aliases: [],
    note: 'E-2 treaty effective March 15, 2024.',
  },
  { name: 'Romania', iso2: 'RO', iso3: 'ROU', nationalityAdjectives: ['romanian'], aliases: [] },
  { name: 'Senegal', iso2: 'SN', iso3: 'SEN', nationalityAdjectives: ['senegalese'], aliases: [] },
  { name: 'Serbia', iso2: 'RS', iso3: 'SRB', nationalityAdjectives: ['serbian'], aliases: ['republic of serbia'] },
  { name: 'Singapore', iso2: 'SG', iso3: 'SGP', nationalityAdjectives: ['singaporean'], aliases: [] },
  { name: 'Slovak Republic', iso2: 'SK', iso3: 'SVK', nationalityAdjectives: ['slovak', 'slovakian'], aliases: ['slovakia'] },
  { name: 'Slovenia', iso2: 'SI', iso3: 'SVN', nationalityAdjectives: ['slovene', 'slovenian'], aliases: [] },
  { name: 'Spain', iso2: 'ES', iso3: 'ESP', nationalityAdjectives: ['spanish', 'spaniard'], aliases: [] },
  { name: 'Sri Lanka', iso2: 'LK', iso3: 'LKA', nationalityAdjectives: ['sri lankan', 'srilankan'], aliases: ['ceylon'] },
  { name: 'Suriname', iso2: 'SR', iso3: 'SUR', nationalityAdjectives: ['surinamese'], aliases: [] },
  { name: 'Sweden', iso2: 'SE', iso3: 'SWE', nationalityAdjectives: ['swedish', 'swede'], aliases: [] },
  { name: 'Switzerland', iso2: 'CH', iso3: 'CHE', nationalityAdjectives: ['swiss'], aliases: ['swiss confederation'] },
  { name: 'Thailand', iso2: 'TH', iso3: 'THA', nationalityAdjectives: ['thai'], aliases: [] },
  { name: 'Togo', iso2: 'TG', iso3: 'TGO', nationalityAdjectives: ['togolese'], aliases: [] },
  { name: 'Trinidad & Tobago', iso2: 'TT', iso3: 'TTO', nationalityAdjectives: ['trinidadian', 'tobagonian'], aliases: ['trinidad and tobago', 'trinidad'] },
  { name: 'Tunisia', iso2: 'TN', iso3: 'TUN', nationalityAdjectives: ['tunisian'], aliases: [] },
  { name: 'Turkey', iso2: 'TR', iso3: 'TUR', nationalityAdjectives: ['turkish', 'turk'], aliases: ['turkiye', 'türkiye', 'republic of turkey'] },
  { name: 'Ukraine', iso2: 'UA', iso3: 'UKR', nationalityAdjectives: ['ukrainian'], aliases: [] },
  {
    name: 'United Kingdom',
    iso2: 'GB',
    iso3: 'GBR',
    nationalityAdjectives: ['british', 'briton', 'english', 'scottish', 'welsh', 'northern irish'],
    aliases: ['uk', 'great britain', 'britain', 'england', 'scotland', 'wales', 'northern ireland'],
  },
  {
    name: 'Yugoslavia',
    iso2: null,
    iso3: null,
    nationalityAdjectives: ['yugoslav', 'yugoslavian'],
    aliases: ['former yugoslavia', 'sfry'],
    note: 'Successor-state nationals (Serbia, Montenegro, Kosovo, Croatia, Bosnia, Macedonia, Slovenia) typically claim under their successor entry rather than this legacy listing.',
  },
];

/* ---------------------------------------------------------------------- */
/* Lookup helpers                                                         */
/* ---------------------------------------------------------------------- */

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    // strip combining diacritics so "Türkiye" and "Turkiye" collide
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Surface forms for `name` that should NOT be used in the loose substring
 * scan. The canonical "China (Taiwan)" / "Korea (South)" /
 * "Congo (Brazzaville)" / "Congo (Kinshasa)" names contain a non-treaty
 * prefix ("China") or an ambiguous bare prefix ("Korea", "Congo") that
 * would otherwise match free-text inputs naming the wrong jurisdiction
 * (PRC, North Korea, the other Congo). Exact-match through the lookup
 * map still works — only the substring scan is affected.
 */
const SUBSTRING_BLOCKED_NAMES: ReadonlySet<string> = new Set([
  'China (Taiwan)',
  'Korea (South)',
  'Congo (Brazzaville)',
  'Congo (Kinshasa)',
]);

/**
 * Build a flat normalized lookup table of every country / iso / nationality
 * surface form to its canonical record. Computed once at module load.
 */
const TREATY_LOOKUP: ReadonlyMap<string, E2TreatyCountry> = (() => {
  const map = new Map<string, E2TreatyCountry>();
  for (const c of E2_TREATY_COUNTRIES) {
    const surfaces: string[] = [c.name, ...c.aliases, ...c.nationalityAdjectives];
    if (c.iso2) surfaces.push(c.iso2);
    if (c.iso3) surfaces.push(c.iso3);
    for (const s of surfaces) {
      const k = normalizeForMatch(s);
      if (k && !map.has(k)) map.set(k, c);
    }
  }
  return map;
})();

/**
 * Best-effort match of a free-text country / nationality string against the
 * E-2 treaty list. Returns the canonical record on hit, null on miss.
 *
 * Matching strategy (in order):
 *   1. exact normalized match (handles ISO codes, country names, demonyms)
 *   2. token-substring match against country name + aliases (so "from
 *      Turkey", "Republic of Turkey", "TURKEY (TR)" all hit)
 *   3. token-substring match against nationality adjectives
 *
 * Returns null on empty input, ISO codes that don't belong to a treaty
 * country, or ambiguous strings ("Korean" alone resolves to South Korea
 * because North Korea is not a treaty country).
 */
export function lookupTreatyCountry(
  nationalityOrCountry: string | null | undefined,
): E2TreatyCountry | null {
  if (!nationalityOrCountry) return null;
  const normalized = normalizeForMatch(nationalityOrCountry);
  if (!normalized) return null;

  const exact = TREATY_LOOKUP.get(normalized);
  if (exact) return exact;

  // Token / substring scan. Prefer the longest matched surface so that
  // "south korea" beats "korea" if both were present (they aren't, but
  // future additions could collide).
  let best: { country: E2TreatyCountry; surfaceLength: number } | null = null;
  for (const c of E2_TREATY_COUNTRIES) {
    const surfaces: string[] = [...c.aliases, ...c.nationalityAdjectives];
    if (!SUBSTRING_BLOCKED_NAMES.has(c.name)) surfaces.push(c.name);
    for (const s of surfaces) {
      const k = normalizeForMatch(s);
      if (!k) continue;
      // bidirectional containment so "Republic of Turkey" and "Turkey" both win
      if (normalized.includes(k) || k.includes(normalized)) {
        if (!best || k.length > best.surfaceLength) {
          best = { country: c, surfaceLength: k.length };
        }
      }
    }
  }
  return best ? best.country : null;
}

/**
 * Soft predicate: is the given free-text nationality / country string an
 * E-2 treaty country? Empty / null / unparseable input returns false.
 *
 * NOTE: this does NOT validate Bolivia / Ecuador grandfather windows or
 * rule on dual-nationality conflicts. A `true` answer is necessary but not
 * sufficient for treaty-investor status; the case theory must still meet
 * 9 FAM 402.9-4(B) ownership thresholds, the investor must hold the treaty
 * nationality at the relevant time, and date-restricted treaties (Bolivia,
 * Ecuador) must be cross-checked for grandfather eligibility.
 */
export function isTreatyNational(nationalityOrCountry: string | null | undefined): boolean {
  return lookupTreatyCountry(nationalityOrCountry) !== null;
}
