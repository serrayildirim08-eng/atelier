/**
 * Deterministic display-name derivation for bank-statement PDFs.
 *
 * Output shape: "Chase · Deborah Walther · ****7192 · 2025-03"
 *
 * Slots (in canonical order):
 *   1. bank_short_name      — normalized short form (Chase, BofA, WF, ...)
 *   2. account_holder_name  — legal name as printed (diacritics preserved)
 *   3. ****<last4>          — masked account-number tail (PII rule)
 *   4. <YYYY-MM>            — derived statement year-month
 *
 * Rules:
 * - Slots are joined by " · " (space + U+00B7 middle-dot + space) to match
 *   the slot-based display_name convention used elsewhere in the pipeline
 *   (see typed-extract.ts SYSTEM_PROMPT, app/page.tsx, exhibit-list.ts).
 * - If a slot value is null / blank, drop it cleanly — never emit "—" or
 *   "unknown".
 * - If ALL slots are null, return null. The caller falls back to the raw
 *   filename (or the LLM-suggested display_name).
 * - This is the LOW-PRIORITY fallback. Manual matter-overrides
 *   document.display_name and the LLM-emitted display_name field both
 *   take precedence (see getBankStatementDisplayLabel below).
 *
 * Server-side does NOT write this back to the matter-overrides store. The
 * derive-on-read approach avoids transactional complexity (matter_root
 * timing, idempotency, race conditions on re-ingest) and keeps the manual
 * override path the single source of truth.
 */

import type { BankStatementRichFacts } from '@/ingest/extractors/bank-statement.schema';

function readField<T>(
  field: { value: T | null } | null | undefined,
): T | null {
  if (!field) return null;
  return field.value ?? null;
}

/**
 * Derive a display name from rich bank-statement facts. Returns null when
 * NO slot can be populated — the caller falls back to a higher-priority
 * source (manual override → LLM display_name → filename).
 *
 * Composition is order-preserving: missing middle slots collapse cleanly.
 * "Chase · ****7192 · 2025-03" is valid (holder dropped); so is
 * "Deborah Walther · ****7192" (bank + period dropped).
 */
export function deriveBankStatementDisplayName(
  facts: BankStatementRichFacts | null | undefined,
): string | null {
  if (!facts) return null;

  const shortName = readField(facts.bank_short_name);
  const holder = readField(facts.account_holder_name);
  const last4 = readField(facts.account_number_last4);
  const yearMonth = readField(facts.statement_year_month);

  const slots: string[] = [];

  if (shortName && shortName.trim()) slots.push(shortName.trim());
  if (holder && holder.trim()) slots.push(holder.trim());
  if (last4 && /^\d{4}$/.test(last4)) slots.push(`****${last4}`);
  if (yearMonth && yearMonth.trim()) slots.push(yearMonth.trim());

  if (slots.length === 0) return null;
  return slots.join(' · ');
}

/**
 * Pick the display label for a bank-statement entry following the priority
 * chain manual override → LLM display_name → derived → null.
 *
 * Callers (app/page.tsx, exhibit-list.ts) hand in whatever they have on
 * the entry and let this helper pick. Returns null when nothing is
 * available — the UI falls back to the raw filename in that case.
 */
export function getBankStatementDisplayLabel(opts: {
  manualOverride?: string | null;
  llmDisplayName?: string | null;
  rich?: BankStatementRichFacts | null;
}): string | null {
  const manual = opts.manualOverride?.trim();
  if (manual) return manual;

  const llm = opts.llmDisplayName?.trim();
  if (llm) return llm;

  return deriveBankStatementDisplayName(opts.rich ?? null);
}
