import type { CaseFacts } from '@/ingest/schema';

/**
 * Build a single retrieval query string from a case-fact set. The
 * embedded query competes against doctrine chunks; we want it to be
 * dense in the topical signals that govern which manual sections apply
 * (case type, subtype, industry, SOF posture, conflict topics) and
 * thin on PII (names, dates) that hurt similarity.
 *
 * Empty fields are dropped silently — the embedder handles short
 * queries fine and we'd rather emit a tight query than pad with nulls.
 */
export function buildDoctrineQuery(caseFacts: CaseFacts): string {
  const parts: string[] = [];
  parts.push(`Case type: ${caseFacts.case_type}`);

  if (caseFacts.case_type === 'E2') {
    const f = caseFacts.facts;
    const enterprise = f.enterprise;
    if (enterprise.industry?.value) parts.push(`Industry: ${enterprise.industry.value}`);
    if (enterprise.entity_type?.value) parts.push(`Entity type: ${enterprise.entity_type.value}`);
    if (enterprise.state_of_formation?.value)
      parts.push(`State of formation: ${enterprise.state_of_formation.value}`);
    if (f.investor.nationality?.value) parts.push(`Investor nationality: ${f.investor.nationality.value}`);
    if (f.investor.current_us_status?.value)
      parts.push(`Current US status: ${f.investor.current_us_status.value}`);

    const investmentItems = f.investment.items
      .map((it) => it.category?.value)
      .filter((c): c is string => !!c);
    if (investmentItems.length) parts.push(`Investment categories: ${investmentItems.join(', ')}`);

    const total = f.investment.total_committed_usd?.value;
    if (typeof total === 'number') parts.push(`Total committed USD: ${total}`);

    const sofKinds = f.source_of_funds
      .map((s) => s.origin_category?.value)
      .filter((c): c is string => !!c);
    if (sofKinds.length) parts.push(`Source-of-funds origin types: ${sofKinds.join(', ')}`);

    const ownership = f.ownership_chain
      .map((o) => `${o.ownership_percent?.value ?? '?'}% ${o.nationality?.value ?? ''} (${o.direct_or_indirect?.value ?? ''})`)
      .filter((s) => s.trim());
    if (ownership.length) parts.push(`Ownership chain: ${ownership.join(' | ')}`);

    const conflicts = f.conflict_register
      .map((c) => c.conflict_type?.value)
      .filter((c): c is string => !!c);
    if (conflicts.length) parts.push(`Conflict topics: ${[...new Set(conflicts)].join(', ')}`);

    parts.push(
      'Relevant doctrine: substantiality, marginality, real and operating, develop and direct, source of funds chain, treaty national ownership, irrevocable commitment.',
    );
  } else if (caseFacts.case_type === 'EB1A') {
    parts.push(
      'Relevant doctrine: Kazarian two-step, ten regulatory criteria, sustained acclaim, final merits determination, extraordinary ability standard.',
    );
  } else if (caseFacts.case_type === 'EB1B') {
    parts.push(
      'Relevant doctrine: outstanding professor or researcher, six regulatory criteria, international recognition, qualifying employer, three years of experience.',
    );
  } else if (caseFacts.case_type === 'EB1C') {
    parts.push(
      'Relevant doctrine: multinational manager or executive, qualifying relationship, one year abroad, primary duties, doing business standard.',
    );
  }

  return parts.join('\n');
}
