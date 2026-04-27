/**
 * sampleLongText tests — pure (no Anthropic calls).
 *
 * Pinned behavior:
 *   - text at or under maxChars passes through verbatim
 *   - text over maxChars samples ~75% from the front, ~25% from the back
 *   - the middle marker is present and names the dropped char range
 *   - the resulting string fits inside maxChars (no growth)
 */

import { describe, expect, it } from 'vitest';
import { sampleLongText } from '@/lib/token-count';

describe('sampleLongText', () => {
  it('returns the text unchanged when it fits the budget', () => {
    const text = 'a'.repeat(100);
    expect(sampleLongText(text, 200)).toBe(text);
  });

  it('returns the text unchanged at the exact budget boundary', () => {
    const text = 'b'.repeat(500);
    expect(sampleLongText(text, 500)).toBe(text);
  });

  it('samples front + back when text exceeds the budget', () => {
    const front = 'A'.repeat(10_000);
    const back = 'Z'.repeat(10_000);
    const middle = 'M'.repeat(50_000);
    const text = front + middle + back;
    const result = sampleLongText(text, 4_000);
    // Front of the result starts with A (front of original).
    expect(result.startsWith('A')).toBe(true);
    // End of the result ends with Z (back of original).
    expect(result.endsWith('Z')).toBe(true);
    // Middle marker is present.
    expect(result).toContain('truncated');
  });

  it('keeps the result within the maxChars budget', () => {
    const text = 'x'.repeat(100_000);
    const max = 5_000;
    const result = sampleLongText(text, max);
    expect(result.length).toBeLessThanOrEqual(max);
  });

  it('puts roughly 75% of the budget in the front sample', () => {
    const front = 'F'.repeat(10_000);
    const middle = 'M'.repeat(50_000);
    const back = 'B'.repeat(10_000);
    const text = front + middle + back;
    const max = 8_000;
    const result = sampleLongText(text, max);
    // Count F characters at the start of the result.
    const frontMatches = result.match(/^F+/);
    const frontLen = frontMatches ? frontMatches[0].length : 0;
    // Should be near 75% of the budget (allow ±200 for marker overhead).
    expect(frontLen).toBeGreaterThan(5_500);
    expect(frontLen).toBeLessThan(6_200);
  });

  it('emits a marker that names the truncated char range', () => {
    const text = 'q'.repeat(20_000);
    const result = sampleLongText(text, 5_000);
    // Marker should reference the dropped range somewhere.
    expect(result).toMatch(/truncated/);
    expect(result).toMatch(/\d+-\d+/);
  });
});
