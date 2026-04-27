/**
 * Token-counting + long-text sampling utilities.
 *
 * Anthropic's `/v1/messages/count_tokens` is free (separate rate-limit
 * bucket from messages.create). The wrapper exists so call sites can
 * pre-flight-check potentially over-budget requests without a per-stage
 * inline import of the SDK types.
 *
 * `sampleLongText` is the char-based companion: when a single document
 * exceeds the per-PDF budget, take the front half + the last quarter
 * with an explicit middle marker. Beats plain front-only truncation
 * because legal docs (cover letters, business plans) tend to land
 * critical content in both the opening framing and the signature /
 * appendix block.
 *
 * Why char-based on the per-PDF path: count_tokens is free but it's a
 * network round-trip per PDF. With concurrency=5 and 30-PDF folders,
 * that's 30 extra calls. The aggregator runs once per case; that's
 * where countMessageTokens earns its keep.
 */

import type {
  MessageCountTokensParams,
  MessageTokensCount,
} from '@anthropic-ai/sdk/resources/messages/messages';
import { getAnthropic } from './anthropic';

/**
 * Pass-through wrapper for `client.messages.countTokens`. Returns the
 * token count for a hypothetical messages.create call with the same
 * params. Free at the API level.
 */
export async function countMessageTokens(
  params: MessageCountTokensParams,
): Promise<MessageTokensCount> {
  return getAnthropic().messages.countTokens(params);
}

/**
 * Char-based long-text sampler. If `text` is at or under `maxChars`,
 * returns it unchanged. Otherwise returns a front-half + last-quarter
 * sample with a middle marker that names the dropped char range.
 *
 * The heuristic ratio (front: ~75% of budget, back: ~25%) reflects what
 * legal docs put where: the front carries framing, parties, and the
 * substantive argument; the tail carries the signature block, exhibits,
 * and any late-stage citations. The middle is usually the most
 * compressible (boilerplate procedural language).
 */
export function sampleLongText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  // 75% front / 25% back, leaving a few hundred chars for the marker.
  const markerOverhead = 80;
  const usable = maxChars - markerOverhead;
  const frontLen = Math.floor(usable * 0.75);
  const backLen = usable - frontLen;
  const front = text.slice(0, frontLen);
  const back = text.slice(text.length - backLen);
  const droppedFrom = frontLen;
  const droppedTo = text.length - backLen;
  const marker = `\n\n[…middle ${droppedTo - droppedFrom} chars (${droppedFrom}-${droppedTo}) truncated; sampled front 75% + back 25%…]\n\n`;
  return `${front}${marker}${back}`;
}
