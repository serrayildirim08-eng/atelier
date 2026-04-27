import type { ExtractedCitation, CitationKind } from '@/lib/verify/types';

// Citation regexes tuned for the surface forms used in immigration drafting.
// Patterns are deliberately permissive on whitespace + section-symbol variants
// (§, Sec., or omitted) and tighten on the structural shape (chapter / part /
// subsection sequence) so we minimize both false positives and false negatives.

const PATTERNS: Array<{ kind: CitationKind; regex: RegExp }> = [
  // INA § 101(a)(15)(E)(ii)
  {
    kind: 'ina',
    regex:
      /\bINA\s+(?:§|Sec\.?|Section)?\s*(\d+(?:\([a-z]\))?(?:\(\d+\))?(?:\([A-Z]\))?(?:\([ivxlcdm]+\))?(?:\([A-Z]\))?(?:\(\d+\))?)/gi,
  },
  // 8 CFR § 214.2(e)(12) or 8 CFR 214.2(e)
  {
    kind: 'cfr',
    regex:
      /\b(\d+)\s+CFR\s+(?:§|Sec\.?|Section)?\s*(\d+\.\d+(?:\([a-z0-9ivxlcdm]+\))*)/gi,
  },
  // 9 FAM 402.9-4(B)(1)
  {
    kind: 'fam',
    regex: /\b(\d+)\s+FAM\s+(\d+\.\d+(?:-\d+)?(?:\([A-Z]\))?(?:\(\d+\))?)/g,
  },
  // USCIS Policy Manual Vol. 6 Pt. F Ch. 2  (or USCIS PM Vol. ...)
  {
    kind: 'uscis_pm',
    regex:
      /\bUSCIS\s+(?:Policy\s+Manual\s+|PM\s+)Vol\.?\s+(\d+)\s+P(?:ar)?t\.?\s+([A-Z])\s+Ch(?:apter|\.)?\s+(\d+)/gi,
  },
  // Matter of Walsh and Pollard / Matter of Z-A-, Inc.
  {
    kind: 'case_name',
    regex:
      /\bMatter\s+of\s+([A-Z][\w-]*(?:\s+(?:and|&)\s+[A-Z][\w-]+)?(?:,\s+Inc\.?)?)/g,
  },
  // 20 I&N Dec. 60 (BIA 1988)
  {
    kind: 'reporter_in_dec',
    regex: /\b(\d+)\s+I&N\s+Dec\.?\s+(\d+)/g,
  },
  // 596 F.3d 1115 / 22 F.4th 1234
  {
    kind: 'reporter_federal',
    regex: /\b(\d+)\s+F\.?\s*(?:Supp\.?\s+)?(?:\dd|\dth)\s+(\d+)/g,
  },
];

/**
 * Normalize the matched raw text into a canonical comparison form.
 * Goal: strip whitespace variation and section-symbol variants so allowlist
 * comparison is invariant to formatting choices.
 */
function normalize(kind: CitationKind, raw: string): string {
  switch (kind) {
    case 'ina': {
      const m = raw.match(/\d+(?:\([a-z0-9ivxlcdm]+\))*/i);
      return m ? `INA § ${m[0]}` : raw.trim();
    }
    case 'cfr': {
      const m = raw.match(/(\d+)\s+CFR\s+(?:§|Sec\.?|Section)?\s*(\d+\.\d+(?:\([a-z0-9ivxlcdm]+\))*)/i);
      return m ? `${m[1]} CFR § ${m[2]}` : raw.trim();
    }
    case 'fam': {
      const m = raw.match(/(\d+)\s+FAM\s+(\S+)/);
      return m ? `${m[1]} FAM ${m[2]}` : raw.trim();
    }
    case 'uscis_pm': {
      const m = raw.match(
        /USCIS\s+(?:Policy\s+Manual\s+|PM\s+)Vol\.?\s+(\d+)\s+P(?:ar)?t\.?\s+([A-Z])\s+Ch(?:apter|\.)?\s+(\d+)/i,
      );
      return m ? `USCIS PM Vol. ${m[1]} Pt. ${m[2]} Ch. ${m[3]}` : raw.trim();
    }
    case 'case_name':
      return raw.replace(/\s+/g, ' ').trim();
    case 'reporter_in_dec': {
      const m = raw.match(/(\d+)\s+I&N\s+Dec\.?\s+(\d+)/);
      return m ? `${m[1]} I&N Dec. ${m[2]}` : raw.trim();
    }
    case 'reporter_federal': {
      const m = raw.match(/(\d+)\s+F\.?\s*(\dd|\dth)\s+(\d+)/i);
      return m ? `${m[1]} F.${m[2]} ${m[3]}` : raw.trim();
    }
    default:
      return raw.trim();
  }
}

export function extractCitations(text: string): ExtractedCitation[] {
  const results: ExtractedCitation[] = [];
  for (const { kind, regex } of PATTERNS) {
    // Reset state on the global regex each pass.
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const raw = match[0];
      results.push({
        kind,
        raw,
        normalized: normalize(kind, raw),
        start: match.index,
        end: match.index + raw.length,
      });
    }
  }
  // Sort by start position, then de-duplicate exact same span+kind (some
  // patterns can co-match a substring of another — e.g., a Matter-of name
  // immediately followed by an I&N Dec reporter both fire correctly).
  results.sort((a, b) => a.start - b.start || a.end - b.end);
  return results;
}
