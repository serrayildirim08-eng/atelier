/**
 * Phase 11 — mergeResultsByFilename pinning.
 *
 * Bug being prevented: handleFolderPath used to call setResults([]) on
 * every drop, wiping the entire binder when re-running the same case
 * folder. The merge helper preserves siblings AND replaces the same-
 * basename entry in place.
 */

import { describe, expect, it } from 'vitest';
import { mergeResultsByFilename } from '@/lib/results-merge';

describe('mergeResultsByFilename', () => {
  it('appends a new entry when no matter with that filename exists', () => {
    const prev = [{ filename: 'caseA', x: 1 }];
    const out = mergeResultsByFilename(prev, { filename: 'caseB', x: 2 });
    expect(out).toEqual([
      { filename: 'caseA', x: 1 },
      { filename: 'caseB', x: 2 },
    ]);
  });

  it('replaces in-place when the same filename exists, preserving order', () => {
    const prev = [
      { filename: 'caseA', x: 1 },
      { filename: 'caseB', x: 2 },
      { filename: 'caseC', x: 3 },
    ];
    const out = mergeResultsByFilename(prev, { filename: 'caseB', x: 99 });
    expect(out).toEqual([
      { filename: 'caseA', x: 1 },
      { filename: 'caseB', x: 99 },
      { filename: 'caseC', x: 3 },
    ]);
  });

  it('does not mutate the input array', () => {
    const prev = [
      { filename: 'caseA', x: 1 },
      { filename: 'caseB', x: 2 },
    ];
    const before = JSON.stringify(prev);
    mergeResultsByFilename(prev, { filename: 'caseB', x: 99 });
    expect(JSON.stringify(prev)).toBe(before);
  });

  it('handles an empty prev array', () => {
    const out = mergeResultsByFilename<{ filename: string }>([], { filename: 'caseA' });
    expect(out).toEqual([{ filename: 'caseA' }]);
  });

  it('preserves siblings when replacing one matter — re-running deborah does not wipe other cases', () => {
    const prev = [
      { filename: 'flatturbo', stage: 'final' },
      { filename: 'deborah', stage: 'partial' },
      { filename: 'cemre', stage: 'final' },
    ];
    const out = mergeResultsByFilename(prev, {
      filename: 'deborah',
      stage: 'final',
    });
    expect(out.map((r) => r.filename)).toEqual(['flatturbo', 'deborah', 'cemre']);
    expect(out[1].stage).toBe('final');
  });
});
