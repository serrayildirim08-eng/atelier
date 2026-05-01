/**
 * lib/e2/service-center-routing.ts
 *
 * Maps a US state (code or full name) to the USCIS service center that
 * processes E-2 / I-129 petitions filed from that state.
 *
 * Doctrine source: 8 CFR §103.2(a)(7); USCIS I-129 Direct Filing Instructions
 * and the USCIS "Direct Filing Addresses for Form I-129" page.
 *
 * WARNING: USCIS jurisdiction assignments change periodically (sometimes
 * annually). This mapping reflects USCIS I-129 routing as of approximately
 * 2024-Q4. Verify against https://www.uscis.gov/i-129 before relying on
 * this in production filings.
 *
 * Potomac Service Center (PSC) took over some functions from VSC/NSC around
 * 2019-2020. E-2 / I-129 nonimmigrant worker petitions from certain states
 * are now routed to PSC. The split below follows the I-129 direct-filing
 * chart; if USCIS changes routing, update STATE_TO_SERVICE_CENTER only.
 */

export type UscisServiceCenter =
  | 'california'
  | 'nebraska'
  | 'texas'
  | 'vermont'
  | 'potomac'
  | 'unknown';

export interface ServiceCenterRouting {
  service_center: UscisServiceCenter;
  service_center_label: string; // e.g. "California Service Center (CSC)"
  filing_address?: string;
  source: 'state_lookup' | 'fallback';
  notes?: string;
}

// ── Canonical state code → full name ────────────────────────────────────────
// 50 states + DC + inhabited territories (PR, VI, GU, AS, MP)
const STATE_CODE_TO_NAME: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  // Territories
  PR: 'Puerto Rico',
  VI: 'Virgin Islands',
  GU: 'Guam',
  AS: 'American Samoa',
  MP: 'Northern Mariana Islands',
};

// Reverse map: normalized full name → state code
const NAME_TO_STATE_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_CODE_TO_NAME).map(([code, name]) => [
    name.toLowerCase(),
    code,
  ]),
);

// ── State code → service center ───────────────────────────────────────────────
// Source: USCIS "Direct Filing Addresses for Form I-129" (2024-Q4 snapshot).
// Verify at https://www.uscis.gov/i-129 before production use.
//
// California Service Center (CSC): western states + Pacific territories
// Nebraska Service Center (NSC): central/plains states
// Texas Service Center (TSC): south-central states
// Vermont Service Center (VSC): New England + some mid-Atlantic
// Potomac Service Center (PSC): remaining mid-Atlantic (DC, MD, VA, WV, DE, NJ, PA)
//   — PSC took E-2/I-129 nonimmigrant filings from VSC for these states ~2019-2020.
const STATE_TO_SERVICE_CENTER: Record<string, UscisServiceCenter> = {
  // California Service Center
  AK: 'california',
  AZ: 'california',
  CA: 'california',
  HI: 'california',
  ID: 'california',
  MT: 'california',
  NV: 'california',
  OR: 'california',
  WA: 'california',
  WY: 'california', // WY sometimes routes CSC for I-129; verify
  // Pacific territories → CSC
  GU: 'california',
  AS: 'california',
  MP: 'california',

  // Nebraska Service Center
  CO: 'nebraska',
  IA: 'nebraska',
  IL: 'nebraska',
  IN: 'nebraska',
  KS: 'nebraska',
  MI: 'nebraska',
  MN: 'nebraska',
  MO: 'nebraska',
  ND: 'nebraska',
  NE: 'nebraska',
  OH: 'nebraska',
  SD: 'nebraska',
  UT: 'nebraska',
  WI: 'nebraska',

  // Texas Service Center
  AR: 'texas',
  LA: 'texas',
  MS: 'texas',
  NM: 'texas',
  OK: 'texas',
  TX: 'texas',

  // Vermont Service Center
  CT: 'vermont',
  ME: 'vermont',
  MA: 'vermont',
  NH: 'vermont',
  NY: 'vermont',
  RI: 'vermont',
  VT: 'vermont',
  // Puerto Rico / USVI → VSC per USCIS I-129 instructions
  PR: 'vermont',
  VI: 'vermont',

  // Potomac Service Center
  // PSC handles mid-Atlantic E-2/I-129 filings (formerly VSC territory).
  AL: 'potomac',
  DC: 'potomac',
  DE: 'potomac',
  FL: 'potomac',
  GA: 'potomac',
  KY: 'potomac',
  MD: 'potomac',
  NC: 'potomac',
  NJ: 'potomac',
  PA: 'potomac',
  SC: 'potomac',
  TN: 'potomac',
  VA: 'potomac',
  WV: 'potomac',
};

// ── Human labels ──────────────────────────────────────────────────────────────
const SERVICE_CENTER_LABELS: Record<UscisServiceCenter, string> = {
  california: 'California Service Center (CSC)',
  nebraska: 'Nebraska Service Center (NSC)',
  texas: 'Texas Service Center (TSC)',
  vermont: 'Vermont Service Center (VSC)',
  potomac: 'Potomac Service Center (PSC)',
  unknown: 'Unknown Service Center',
};

// ── Filing addresses ──────────────────────────────────────────────────────────
//
// Mailing addresses for I-129 petitions per service center. USCIS adjusts
// lockbox PO Boxes from time to time — the strings here name the canonical
// service-center city + the verification URL so a generated cover letter
// always points the attorney to confirm the current PO Box before mailing.
// Direct-PO-Box numbers are intentionally NOT hardcoded to avoid drift.
//
// For consular filings (DS-160 + DS-156E) the filing address is N/A —
// petitions are submitted via the CEAC portal, not mailed.
const SERVICE_CENTER_FILING_ADDRESS: Record<UscisServiceCenter, string | null> = {
  california:
    'USCIS California Service Center, Laguna Niguel, CA — verify current PO Box at uscis.gov/i-129',
  nebraska:
    'USCIS Nebraska Service Center, Lincoln, NE — verify current PO Box at uscis.gov/i-129',
  texas:
    'USCIS Texas Service Center, Mesquite, TX — verify current PO Box at uscis.gov/i-129',
  vermont:
    'USCIS Vermont Service Center, St. Albans, VT — verify current PO Box at uscis.gov/i-129',
  potomac:
    'USCIS Potomac Service Center, Arlington, VA — verify current PO Box at uscis.gov/i-129',
  unknown: null,
};

// ── Normalize input to a 2-letter state code ──────────────────────────────────
function normalizeToStateCode(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  // Already a valid 2-letter code?
  if (upper in STATE_CODE_TO_NAME) return upper;

  // Try full-name lookup (case-insensitive)
  const byName = NAME_TO_STATE_CODE[trimmed.toLowerCase()];
  if (byName) return byName;

  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Map a US state code (e.g., 'NY', 'TX', 'CA') OR full name ('New York')
 * to the USCIS service center that processes E-2 / I-129 filings from
 * that state. Returns service_center: 'unknown' for unrecognized input.
 *
 * NOTE: Verify routing at https://www.uscis.gov/i-129 before relying on
 * this for actual filings — USCIS jurisdiction assignments change over time.
 */
export function routeServiceCenter(
  stateCodeOrName: string | null | undefined,
): ServiceCenterRouting {
  if (stateCodeOrName == null) {
    return {
      service_center: 'unknown',
      service_center_label: SERVICE_CENTER_LABELS.unknown,
      source: 'fallback',
      notes: 'No state provided.',
    };
  }

  const code = normalizeToStateCode(stateCodeOrName);

  if (!code) {
    return {
      service_center: 'unknown',
      service_center_label: SERVICE_CENTER_LABELS.unknown,
      source: 'fallback',
      notes: `Unrecognized state: "${stateCodeOrName}". Check uscis.gov/i-129 for current routing.`,
    };
  }

  const center = STATE_TO_SERVICE_CENTER[code];

  if (!center) {
    // Known state code but no mapping yet (shouldn't happen with the table above)
    return {
      service_center: 'unknown',
      service_center_label: SERVICE_CENTER_LABELS.unknown,
      source: 'fallback',
      notes: `State "${code}" recognized but not mapped to a service center. Verify at uscis.gov/i-129.`,
    };
  }

  return {
    service_center: center,
    service_center_label: SERVICE_CENTER_LABELS[center],
    filing_address: SERVICE_CENTER_FILING_ADDRESS[center] ?? undefined,
    source: 'state_lookup',
  };
}
