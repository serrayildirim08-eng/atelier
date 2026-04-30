/**
 * Shared Zod helpers for extractor schemas.
 *
 * Lives here (not in `ingest/typed-memory.ts`) because per-PDF extractor
 * schemas import from this module without dragging in the heavier
 * typed-memory aggregate types.
 */

import { z } from 'zod';

/**
 * Currency-tolerant number — accepts a number or a numeric string with
 * currency symbols / thousands separators. The LLM routinely returns
 * "$1,234.56" / "1.234,56" / "$10,000.00" for fields the schema declared
 * as `z.number()`. Without this preprocess, the schema rejects → the
 * extractor retries → bank-statement-heavy folders take 12 minutes to
 * ingest.
 *
 * Heuristic for the EU/US comma ambiguity: if the last separator is a
 * comma AND there are exactly 2 digits after it (e.g. "1.234,56"), treat
 * comma as decimal. Otherwise commas are thousands separators
 * (e.g. "1,234.56" or "1,500" stays as integer 1500).
 *
 * Use only on fields the LLM should return as money or money-adjacent
 * decimals (balances, revenue, consideration, rent, fees). Do NOT use on
 * pure integer counts (year, headcount, term in years) — those have
 * their own validity checks.
 */
export const CurrencyNumber = z.preprocess((v) => {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return v;
  const cleaned = v
    .replace(/[$€£₺¥₪]/g, '')
    .replace(/\s/g, '')
    .replace(/(\d),(\d{2})$/, '$1.$2')
    .replace(/,/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '—') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : v;
}, z.number());
