/**
 * Deterministic + LLM-fallback applicant identification from the
 * post-aggregation E-2 ownership chain.
 *
 * Problem this solves: when the typed-aggregate Sonnet pass leaves
 * `caseFacts.investor.full_name` blank (no passport ingested, passport
 * extraction failed, or the LLM declined to bind across sections), the
 * downstream drafter, gates, and dossier UI all break. The legal rule is
 * mechanical: under 8 CFR 214.2(e)(1) and 9 FAM 402.9-4(B), the principal
 * E-2 applicant must be a national of a treaty country and must own at
 * least 50% (directly or via parent entities) of the petitioning
 * enterprise. When exactly one such owner exists in the post-aggregation
 * ownership_chain, identifying the principal applicant is determined.
 *
 * Logic ladder (deterministic only, no LLM):
 *
 *   1. Investor.full_name already populated → SKIP (never overwrite).
 *   2. ownership_chain has exactly one owner who is (a) a treaty national
 *      AND (b) holds ≥ 50% → propose that owner as the applicant. Apply.
 *   3. Sum of treaty-national ownership ≥ 50%, but no single treaty
 *      national crosses 50% on their own → AMBIGUOUS. Do not fill;
 *      log a severity-3 'ambiguous_applicant_identity' conflict.
 *   4. Single treaty national who holds < 50% (e.g., 49% Turkish, 51%
 *      American) → NO FILL; log a severity-3
 *      'ownership_below_threshold' conflict.
 *   5. Single non-treaty national majority owner (e.g., 75% Chinese) →
 *      NO FILL; log a severity-4 'non_treaty_majority_owner' conflict.
 *      The case theory is not E-2 viable as drafted.
 *   6. Empty / nationality-less / percentage-less ownership_chain →
 *      NO FILL, no conflict (Phase-3 INVESTOR ↔ OWNER BINDING already
 *      surfaces these cases).
 *
 * The Haiku fallback (gated by APPLICANT_HAIKU_FALLBACK_ENABLED=1) only
 * fires when steps 2–5 all decline, which in practice means the
 * ownership_chain has multiple owners and the deterministic logic has no
 * single answer. The fallback is intentionally bounded (one Haiku call,
 * cached system prompt, JSON-out only); it never proposes a name not
 * already in the chain. The default-disabled flag keeps tests deterministic
 * and avoids spurious API charges in CI.
 */

import { z } from 'zod';
import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import { isTreatyNational, lookupTreatyCountry } from '@/lib/e2/treaty-countries';

/* ---------------------------------------------------------------------- */
/* Field shape (mirrors typed-aggregate's FieldT — kept in-house to avoid */
/* a circular import).                                                    */
/* ---------------------------------------------------------------------- */

export interface FieldT<T> {
  value: T | null;
  source_page: number | null;
  source_quote: string | null;
  confidence: number | null;
}

const NULL_FIELD: FieldT<never> = {
  value: null,
  source_page: null,
  source_quote: null,
  confidence: null,
};

function makeField<T>(
  value: T | null,
  source_page: number | null,
  source_quote: string | null,
  confidence: number | null,
): FieldT<T> {
  return { value, source_page, source_quote, confidence };
}

/* ---------------------------------------------------------------------- */
/* Public types                                                           */
/* ---------------------------------------------------------------------- */

/** Shape of a single E-2 ownership_chain entry as emitted by the aggregator. */
export interface OwnershipEntryT {
  owner_name: FieldT<string>;
  ownership_percent: FieldT<number>;
  nationality: FieldT<string>;
  direct_or_indirect: FieldT<string>;
}

/** Conflict register entry shape (mirrors ConflictEntrySchema). */
export interface ConflictEntryT {
  description: FieldT<string>;
  conflict_type: FieldT<string>;
  severity: FieldT<number>;
  fact_a_doc: FieldT<string>;
  fact_a_page: FieldT<number>;
  fact_b_doc: FieldT<string>;
  fact_b_page: FieldT<number>;
}

/** Decision codes surfaced by `inferApplicantFromOwnership`. */
export type ApplicantInferenceDecision =
  | 'skipped_existing_value'
  | 'filled_single_treaty_majority'
  | 'ambiguous_multiple_treaty_nationals'
  | 'ownership_below_threshold'
  | 'non_treaty_majority_owner'
  | 'no_decision_needs_llm'
  | 'no_ownership_data';

export interface ApplicantInferenceResult {
  /** Decision the deterministic ladder reached. */
  decision: ApplicantInferenceDecision;
  /** Populated only when decision = 'filled_single_treaty_majority'. */
  full_name?: FieldT<string>;
  /** Conflicts to append to caseFacts.conflict_register (may be empty). */
  conflicts: ConflictEntryT[];
  /** Human-readable trace for logging / debugging. */
  reasoning: string;
}

/* ---------------------------------------------------------------------- */
/* Constants                                                              */
/* ---------------------------------------------------------------------- */

/**
 * 9 FAM 402.9-4(B) requires "at least 50%" treaty-national ownership.
 * A single owner crossing this threshold is the principal-applicant
 * candidate. Strict inequality below the threshold = no fill.
 */
export const TREATY_OWNERSHIP_THRESHOLD = 50;

const CONFLICT_SOURCE_QUOTE = '[deterministic applicant-from-ownership inference]';
const HAIKU_CONFLICT_SOURCE_QUOTE = '[Haiku applicant-inference fallback]';

/* ---------------------------------------------------------------------- */
/* Helpers                                                                */
/* ---------------------------------------------------------------------- */

function asNumberOrNull(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return v;
}

function asNonEmptyString(v: string | null | undefined): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function buildConflict(params: {
  description: string;
  conflict_type: string;
  severity: number;
  fact_a_doc: string;
  source_quote?: string;
}): ConflictEntryT {
  const sq = params.source_quote ?? CONFLICT_SOURCE_QUOTE;
  return {
    description: {
      value: params.description,
      source_page: null,
      source_quote: sq,
      confidence: 1,
    },
    conflict_type: {
      value: params.conflict_type,
      source_page: null,
      source_quote: sq,
      confidence: 1,
    },
    severity: {
      value: params.severity,
      source_page: null,
      source_quote: sq,
      confidence: 1,
    },
    fact_a_doc: {
      value: params.fact_a_doc,
      source_page: null,
      source_quote: sq,
      confidence: 1,
    },
    fact_a_page: NULL_FIELD,
    fact_b_doc: NULL_FIELD,
    fact_b_page: NULL_FIELD,
  };
}

interface NormalizedOwner {
  index: number;
  name: string;
  nationalityRaw: string | null;
  ownershipPercent: number | null;
  isTreaty: boolean;
  treatyCountryName: string | null;
  source_page: number | null;
  source_quote: string | null;
}

function normalizeChain(chain: readonly OwnershipEntryT[]): NormalizedOwner[] {
  const out: NormalizedOwner[] = [];
  for (let i = 0; i < chain.length; i++) {
    const e = chain[i];
    const name = asNonEmptyString(e.owner_name?.value ?? null);
    if (!name) continue;
    const nat = asNonEmptyString(e.nationality?.value ?? null);
    const pct = asNumberOrNull(e.ownership_percent?.value ?? null);
    const treaty = nat ? lookupTreatyCountry(nat) : null;
    out.push({
      index: i,
      name,
      nationalityRaw: nat,
      ownershipPercent: pct,
      isTreaty: treaty !== null,
      treatyCountryName: treaty?.name ?? null,
      source_page: e.owner_name?.source_page ?? null,
      source_quote: e.owner_name?.source_quote ?? null,
    });
  }
  return out;
}

function summarizeOwners(owners: readonly NormalizedOwner[]): string {
  if (owners.length === 0) return '(empty)';
  return owners
    .map((o) => {
      const nat = o.nationalityRaw ?? '(unknown nat)';
      const pct = o.ownershipPercent != null ? `${o.ownershipPercent}%` : '(unknown %)';
      const flag = o.isTreaty ? 'treaty' : 'non-treaty';
      return `${o.name} — ${nat} [${flag}], ${pct}`;
    })
    .join('; ');
}

/* ---------------------------------------------------------------------- */
/* Deterministic inference (the heart of this module)                     */
/* ---------------------------------------------------------------------- */

export interface InferApplicantInput {
  ownership_chain: readonly OwnershipEntryT[];
  /**
   * Current value of caseFacts.investor.full_name. When non-empty, the
   * ladder short-circuits with `skipped_existing_value` and never overwrites.
   */
  current_investor_full_name: string | null;
  /**
   * Optional filename hint used for conflict.fact_a_doc. Falls back to the
   * source_quote of the matched owner row when omitted; final fallback is
   * the literal "ownership_chain (post-aggregation)".
   */
  source_doc_hint?: string | null;
}

/**
 * Pure deterministic ladder. No I/O. No LLM. The Haiku fallback lives in
 * `inferApplicantWithLlmFallback` below and only fires when this returns
 * `decision === 'no_decision_needs_llm'` AND the env flag is enabled.
 */
export function inferApplicantFromOwnership(
  input: InferApplicantInput,
): ApplicantInferenceResult {
  const { ownership_chain, current_investor_full_name } = input;

  // Step 1 — never overwrite an existing investor name.
  if (asNonEmptyString(current_investor_full_name)) {
    return {
      decision: 'skipped_existing_value',
      conflicts: [],
      reasoning: `investor.full_name already populated ("${current_investor_full_name}"); inference skipped.`,
    };
  }

  const owners = normalizeChain(ownership_chain);
  if (owners.length === 0) {
    return {
      decision: 'no_ownership_data',
      conflicts: [],
      reasoning: 'ownership_chain is empty or has no owner_name values; nothing to infer.',
    };
  }

  // Treat any owner with both a known nationality AND a known percent as
  // "evaluable". Owners missing either field can't drive the deterministic
  // ladder but are still surfaced in the reasoning trace.
  const evaluable = owners.filter(
    (o) => o.nationalityRaw !== null && o.ownershipPercent !== null,
  );

  const treatyMajority = evaluable.filter(
    (o) => o.isTreaty && (o.ownershipPercent ?? 0) >= TREATY_OWNERSHIP_THRESHOLD,
  );
  const nonTreatyMajority = evaluable.filter(
    (o) => !o.isTreaty && (o.ownershipPercent ?? 0) >= TREATY_OWNERSHIP_THRESHOLD,
  );
  const treatyOwners = evaluable.filter((o) => o.isTreaty);
  const treatyOwnershipSum = treatyOwners.reduce(
    (acc, o) => acc + (o.ownershipPercent ?? 0),
    0,
  );

  const docHint =
    asNonEmptyString(input.source_doc_hint ?? null) ??
    asNonEmptyString(owners[0]?.source_quote ?? null) ??
    'ownership_chain (post-aggregation)';

  const summary = summarizeOwners(owners);

  // Step 2 — exactly one treaty-national majority owner → fill.
  if (treatyMajority.length === 1) {
    const winner = treatyMajority[0];
    return {
      decision: 'filled_single_treaty_majority',
      full_name: makeField(
        winner.name,
        winner.source_page,
        `[applicant inferred from ownership_chain: ${winner.treatyCountryName ?? winner.nationalityRaw} national holding ${winner.ownershipPercent}%]`,
        0.9,
      ),
      conflicts: [],
      reasoning: `Single treaty-national majority owner: ${winner.name} (${winner.treatyCountryName ?? winner.nationalityRaw}, ${winner.ownershipPercent}%). Filled investor.full_name. Owners: ${summary}.`,
    };
  }

  // Step 2b — multiple treaty-national majority owners (rare; means the
  // chain has overlapping rows, e.g. direct + indirect). Treat as
  // ambiguous.
  if (treatyMajority.length > 1) {
    const candidates = treatyMajority.map((o) => `${o.name} (${o.ownershipPercent}%)`).join(' / ');
    return {
      decision: 'ambiguous_multiple_treaty_nationals',
      conflicts: [
        buildConflict({
          description:
            `Multiple treaty-national owners each cross the ${TREATY_OWNERSHIP_THRESHOLD}% threshold (${candidates}). ` +
            `Cannot deterministically identify the E-2 principal applicant from ownership_chain alone — ` +
            `attorney must designate the principal beneficiary and confirm the remaining qualifying owners file as Sub2/Sub3 co-petitioners or derivatives. ` +
            `Owners: ${summary}.`,
          conflict_type: 'ambiguous_applicant_identity',
          severity: 3,
          fact_a_doc: docHint,
        }),
      ],
      reasoning: `Multiple treaty-national majority owners (${candidates}); ambiguous — conflict logged, no fill.`,
    };
  }

  // Step 3 — multiple treaty nationals add up to ≥ 50% but no single one
  // crosses 50%.
  if (treatyOwners.length >= 2 && treatyOwnershipSum >= TREATY_OWNERSHIP_THRESHOLD) {
    const candidates = treatyOwners
      .map((o) => `${o.name} (${o.ownershipPercent}%)`)
      .join(' / ');
    return {
      decision: 'ambiguous_multiple_treaty_nationals',
      conflicts: [
        buildConflict({
          description:
            `Two or more treaty-national owners aggregate to ≥ ${TREATY_OWNERSHIP_THRESHOLD}% but no single owner crosses the threshold individually (${candidates}). ` +
            `Per 9 FAM 402.9-4(B), the principal applicant must personally hold ≥ 50% — co-ownership does not satisfy the ` +
            `nationality element on its own. Attorney must designate the principal and reconcile the remaining ` +
            `treaty-national interests as Sub2/Sub3 co-petitioners. Owners: ${summary}.`,
          conflict_type: 'ambiguous_applicant_identity',
          severity: 3,
          fact_a_doc: docHint,
        }),
      ],
      reasoning: `Aggregated treaty ownership ≥ ${TREATY_OWNERSHIP_THRESHOLD}% across ${treatyOwners.length} owners but no individual majority; ambiguous — conflict logged, no fill.`,
    };
  }

  // Step 4 — non-treaty majority owner short-circuits the case theory.
  if (nonTreatyMajority.length >= 1) {
    const blocker = nonTreatyMajority[0];
    return {
      decision: 'non_treaty_majority_owner',
      conflicts: [
        buildConflict({
          description:
            `Majority owner ${blocker.name} holds ${blocker.ownershipPercent}% but is a national of ` +
            `${blocker.nationalityRaw}, which is NOT a qualifying E-2 treaty country (8 CFR 214.2(e)(1); 9 FAM 402.9-10). ` +
            `The case as documented does not satisfy the nationality element — confirm whether the case theory is ` +
            `actually E-2, or whether ownership has been restructured before filing. Owners: ${summary}.`,
          conflict_type: 'non_treaty_majority_owner',
          severity: 4,
          fact_a_doc: docHint,
        }),
      ],
      reasoning: `Non-treaty majority owner: ${blocker.name} (${blocker.nationalityRaw}, ${blocker.ownershipPercent}%); case theory not E-2 viable — conflict logged, no fill.`,
    };
  }

  // Step 5 — single treaty national, but below the 50% threshold. No
  // single non-treaty owner crosses 50% either (would have hit Step 4).
  if (treatyOwners.length === 1) {
    const candidate = treatyOwners[0];
    return {
      decision: 'ownership_below_threshold',
      conflicts: [
        buildConflict({
          description:
            `Sole treaty-national owner ${candidate.name} (${candidate.treatyCountryName ?? candidate.nationalityRaw}) holds ` +
            `${candidate.ownershipPercent}%, below the 9 FAM 402.9-4(B) ${TREATY_OWNERSHIP_THRESHOLD}% nationality threshold. ` +
            `Cannot fill investor.full_name from ownership alone — confirm via passport / I-129 beneficiary or restructure ` +
            `ownership before filing. Owners: ${summary}.`,
          conflict_type: 'ownership_below_threshold',
          severity: 3,
          fact_a_doc: docHint,
        }),
      ],
      reasoning: `Sole treaty national ${candidate.name} below ${TREATY_OWNERSHIP_THRESHOLD}% threshold (${candidate.ownershipPercent}%); conflict logged, no fill.`,
    };
  }

  // Step 6 — fall-through: no treaty owners, no non-treaty majority. Could
  // be all owners with unknown nationality, or evaluable rows are 0. The
  // Haiku fallback may help when there are multiple owners with names but
  // no nationalities yet.
  return {
    decision: 'no_decision_needs_llm',
    conflicts: [],
    reasoning:
      `Deterministic ladder did not converge: no single treaty-national majority, no aggregated treaty majority, no non-treaty majority. ` +
      `Owners: ${summary}.`,
  };
}

/* ---------------------------------------------------------------------- */
/* Haiku fallback                                                         */
/* ---------------------------------------------------------------------- */

const HAIKU_SYSTEM_PROMPT = `You identify the most likely E-2 principal applicant from a JSON ownership chain.

Authority: 8 CFR 214.2(e)(1) and 9 FAM 402.9-4(B). The principal must be (a) a national of a qualifying E-2 treaty country and (b) hold at least 50% of the petitioning enterprise (directly or via parent entities).

You will be given a JSON array of owner objects with fields {owner_name, ownership_percent, nationality, direct_or_indirect}. Some fields may be null / missing.

Return a single JSON object matching this schema:
{
  "verdict": "applicant_identified" | "ambiguous" | "not_e2_viable",
  "applicant_full_name": string | null,   // MUST be one of the owner_name values when verdict='applicant_identified'; null otherwise
  "applicant_nationality": string | null, // copy of the matching owner's nationality string when known
  "reasoning": string                      // one or two sentences citing the rule and the chosen row
}

Rules:
- NEVER invent a name. applicant_full_name must come verbatim from one of the owner_name fields, or be null.
- If two or more owners individually meet both prongs (treaty + ≥50%), return verdict='ambiguous' with applicant_full_name=null.
- If no owner is a treaty national OR the lone treaty national is < 50%, return verdict='not_e2_viable' with applicant_full_name=null.
- Treat the People's Republic of China, Russia, India, Brazil as NOT treaty countries; Taiwan IS a treaty country.
- No prose outside the JSON object.`;

const HaikuVerdictSchema = z.object({
  verdict: z.enum(['applicant_identified', 'ambiguous', 'not_e2_viable']),
  applicant_full_name: z.string().nullable(),
  applicant_nationality: z.string().nullable(),
  reasoning: z.string(),
});

export type HaikuApplicantVerdict = z.infer<typeof HaikuVerdictSchema>;

function isHaikuFallbackEnabled(): boolean {
  const v = process.env.APPLICANT_HAIKU_FALLBACK_ENABLED;
  if (!v) return false;
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes';
}

/**
 * Single Haiku 4.5 call. Returns null on any failure (no key, schema miss,
 * network error). Fail-closed: a null return leaves caseFacts unchanged.
 */
async function callHaikuApplicantFallback(
  ownership_chain: readonly OwnershipEntryT[],
): Promise<HaikuApplicantVerdict | null> {
  // Strip provenance noise — Haiku just needs the four logical fields.
  const compact = ownership_chain.map((e) => ({
    owner_name: e.owner_name?.value ?? null,
    ownership_percent: e.ownership_percent?.value ?? null,
    nationality: e.nationality?.value ?? null,
    direct_or_indirect: e.direct_or_indirect?.value ?? null,
  }));

  let raw: unknown;
  try {
    const response = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 600,
      system: [
        {
          type: 'text',
          text: HAIKU_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral', ttl: '1h' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Ownership chain:\n\`\`\`json\n${JSON.stringify(compact, null, 2)}\n\`\`\`\n\nReturn JSON only.`,
        },
      ],
    });

    logAnthropicUsage({
      stage: 'extract',
      model: 'claude-haiku-4-5',
      case_type: 'E2',
      usage: response.usage,
    });

    let text = '';
    for (const block of response.content) {
      if (block.type === 'text') text += block.text;
    }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }

  const parsed = HaikuVerdictSchema.safeParse(raw);
  if (!parsed.success) return null;
  return parsed.data;
}

/**
 * Public async entry point — runs the deterministic ladder, then (if
 * unresolved AND env-enabled) one Haiku call. Honors the same skip /
 * never-overwrite contract as the deterministic helper.
 *
 * Tests should call `inferApplicantFromOwnership` directly to avoid any
 * network surface; this wrapper exists for the aggregator integration.
 */
export async function inferApplicantWithLlmFallback(
  input: InferApplicantInput,
): Promise<ApplicantInferenceResult> {
  const deterministic = inferApplicantFromOwnership(input);
  if (deterministic.decision !== 'no_decision_needs_llm') return deterministic;
  if (!isHaikuFallbackEnabled()) return deterministic;

  const verdict = await callHaikuApplicantFallback(input.ownership_chain);
  if (!verdict) return deterministic;

  const owners = normalizeChain(input.ownership_chain);
  const docHint =
    asNonEmptyString(input.source_doc_hint ?? null) ??
    asNonEmptyString(owners[0]?.source_quote ?? null) ??
    'ownership_chain (post-aggregation)';

  if (verdict.verdict === 'applicant_identified' && verdict.applicant_full_name) {
    // Sanity guard — Haiku is only allowed to nominate a name already in
    // the chain. Otherwise treat as no-op.
    const match = owners.find(
      (o) => o.name.toLowerCase().trim() === verdict.applicant_full_name!.toLowerCase().trim(),
    );
    if (!match) return deterministic;
    if (!isTreatyNational(match.nationalityRaw)) {
      // Haiku tried to anoint a non-treaty national — refuse.
      return deterministic;
    }
    return {
      decision: 'filled_single_treaty_majority',
      full_name: makeField(
        match.name,
        match.source_page,
        `[applicant inferred via Haiku 4.5 fallback: ${verdict.reasoning}]`,
        0.7,
      ),
      conflicts: [],
      reasoning: `Haiku fallback identified ${match.name}: ${verdict.reasoning}`,
    };
  }

  if (verdict.verdict === 'ambiguous') {
    return {
      decision: 'ambiguous_multiple_treaty_nationals',
      conflicts: [
        buildConflict({
          description:
            `Haiku applicant-inference fallback returned ambiguous on a chain the deterministic ladder also could not resolve. ` +
            `Reasoning: ${verdict.reasoning}. Attorney must designate the principal applicant manually.`,
          conflict_type: 'ambiguous_applicant_identity',
          severity: 3,
          fact_a_doc: docHint,
          source_quote: HAIKU_CONFLICT_SOURCE_QUOTE,
        }),
      ],
      reasoning: `Haiku fallback verdict=ambiguous: ${verdict.reasoning}`,
    };
  }

  // not_e2_viable
  return {
    decision: 'non_treaty_majority_owner',
    conflicts: [
      buildConflict({
        description:
          `Haiku applicant-inference fallback returned not_e2_viable. Reasoning: ${verdict.reasoning}. ` +
          `Confirm whether the case theory is actually E-2 before drafting.`,
        conflict_type: 'non_treaty_majority_owner',
        severity: 4,
        fact_a_doc: docHint,
        source_quote: HAIKU_CONFLICT_SOURCE_QUOTE,
      }),
    ],
    reasoning: `Haiku fallback verdict=not_e2_viable: ${verdict.reasoning}`,
  };
}
