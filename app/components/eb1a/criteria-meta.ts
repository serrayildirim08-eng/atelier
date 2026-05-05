/**
 * Canonical EB-1A criterion metadata for the Atelier 8-criterion intake
 * order, plus the two profile-triggered criteria (Display, Commercial
 * Success) folded in conditionally as positions 9 + 10.
 *
 * Microcopy `qualityBar` is distilled from manuals/EB1A-FRAMEWORK-v1.md
 * § 4 (Whitfield, "what counts / quality bar"). Keep edits in lockstep
 * with the framework — this file is *display* of the doctrine, not a
 * fork of it.
 */

export type CriterionId =
  | 'awards'
  | 'membership'
  | 'media'
  | 'judge'
  | 'original_contributions'
  | 'authorship'
  | 'critical_role'
  | 'remuneration'
  | 'display'
  | 'commercial_success';

export interface CriterionMeta {
  id: CriterionId;
  /** Display label (sentence-case, framework § 4 canonical). */
  label: string;
  /** Regulatory cite, ready to drop into a margin. */
  cite: string;
  /** One-line doctrinal anchor for the section sub-head. */
  precis: string;
  /**
   * Empty-state quality-bar microcopy. Distilled from § 4. This shows
   * when the section has zero docs — tells the attorney what evidence
   * package to assemble, not what to click.
   */
  qualityBar: string;
  /**
   * Profile-triggered criteria (Display, Commercial Success) only render
   * when the candidate's profile activates them. Default is false.
   */
  profileTriggered?: boolean;
  /**
   * Atelier intake order index — drives section ordering. (vii) and (x)
   * sit at 9 + 10 when triggered.
   */
  order: number;
}

export const EB1A_CRITERIA: ReadonlyArray<CriterionMeta> = [
  {
    id: 'awards',
    order: 1,
    label: 'Awards',
    cite: '8 CFR § 204.5(h)(3)(i)',
    precis: 'Lesser nationally or internationally recognized prizes for excellence in the field.',
    qualityBar:
      'Three-source minimum per award: certificate, selection criteria, prior-recipients list. Document conferring body’s standing and the competitive pool — accomplished practitioners, not novices.',
  },
  {
    id: 'membership',
    order: 2,
    label: 'Membership',
    cite: '8 CFR § 204.5(h)(3)(ii)',
    precis: 'Associations requiring outstanding achievement, judged by recognized experts.',
    qualityBar:
      'Bylaws excerpt + membership-criteria publication + association letter confirming the beneficiary’s grade and the basis for elevation. Pay-to-join societies do not count; the selective tier must be the one held.',
  },
  {
    id: 'media',
    order: 3,
    label: 'Media',
    cite: '8 CFR § 204.5(h)(3)(iii)',
    precis: 'Published material *about* the beneficiary in professional, trade, or major media.',
    qualityBar:
      'Article copy + circulation/readership data for the venue + certified translation per 8 CFR § 103.2(b)(3) for foreign-language items + author byline confirmation. Articles authored *by* the beneficiary route to Authorship.',
  },
  {
    id: 'judge',
    order: 4,
    label: 'Judge',
    cite: '8 CFR § 204.5(h)(3)(iv)',
    precis: 'Participation as a judge of the work of others in the field or an allied field.',
    qualityBar:
      'Editor letter or platform record (Publons / ORCID review profile) + dated review confirmations. Five-to-ten completed reviews preferred for a sustained-judging claim. Document the act of judging, not just the invitation.',
  },
  {
    id: 'original_contributions',
    order: 5,
    label: 'Original contributions',
    cite: '8 CFR § 204.5(h)(3)(v)',
    precis: 'Original contributions of major significance to the field.',
    qualityBar:
      'Five-to-seven independent expert letters from non-collaborators addressing specific contribution and specific impact + objective metrics (citations, adoption, licensing, regulatory uptake, replication). The most-failed criterion — third-party impact must be shown, not just claimed.',
  },
  {
    id: 'authorship',
    order: 6,
    label: 'Authorship',
    cite: '8 CFR § 204.5(h)(3)(vi)',
    precis: 'Scholarly articles in professional, trade, or major-media venues.',
    qualityBar:
      'Publication list with venue metadata (impact factor or h5-index, publisher, peer-review confirmation) + sample articles + Google Scholar / ORCID profile. For non-first / non-corresponding authorship, supply a defensive paragraph on contribution percentage and field-conventions on author order.',
  },
  {
    id: 'critical_role',
    order: 7,
    label: 'Critical role',
    cite: '8 CFR § 204.5(h)(3)(viii)',
    precis: 'A leading or critical role for an organization of distinguished reputation.',
    qualityBar:
      'Org chart + role description + decisional-authority memorandum + 3-5 testimonial letters from external stakeholders outside the reporting chain + organization-reputation packet (rankings, regulatory significance, awards to the org). Title alone does not carry this criterion.',
  },
  {
    id: 'remuneration',
    order: 8,
    label: 'Remuneration',
    cite: '8 CFR § 204.5(h)(3)(ix)',
    precis: 'High salary or significantly high remuneration relative to the field.',
    qualityBar:
      'Pay stubs / employment contracts + tax returns + field-benchmark report (BLS, Robert Half, industry-specific, or TÜİK / Eurostat SES for non-US peers) + percentile-rank statement. Non-US compensation requires cost-of-living normalization.',
  },
  {
    id: 'display',
    order: 9,
    label: 'Display',
    cite: '8 CFR § 204.5(h)(3)(vii)',
    precis: 'Display of the beneficiary’s work at artistic exhibitions or showcases.',
    qualityBar:
      'Exhibition catalog or curator statement + venue-reputation packet + press coverage of the exhibition itself. Activated only when the candidate practises in visual arts, design, or performance.',
    profileTriggered: true,
  },
  {
    id: 'commercial_success',
    order: 10,
    label: 'Commercial success',
    cite: '8 CFR § 204.5(h)(3)(x)',
    precis: 'Commercial successes in the performing arts.',
    qualityBar:
      'Audited box-office / streaming / sales data from major platforms + chart positions. Activated only when the candidate practises in the performing arts.',
    profileTriggered: true,
  },
] as const;

export const KAZARIAN_THRESHOLD = 3 as const;

/** Resolve a criterion by id. Throws on unknown id (caller error). */
export function getCriterion(id: CriterionId): CriterionMeta {
  const c = EB1A_CRITERIA.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown EB-1A criterion: ${id}`);
  return c;
}
