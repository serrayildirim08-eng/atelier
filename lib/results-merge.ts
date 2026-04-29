/**
 * Phase 11 — merge a freshly-ingested matter result into an existing
 * results array by matter basename (filename). Used by the home page so
 * re-running the same case folder updates that matter in place rather
 * than wiping every other matter on the binder.
 *
 * Pure function so the home-page reducer logic is unit-testable without
 * pulling React in.
 */
export function mergeResultsByFilename<T extends { filename: string }>(
  prev: T[],
  next: T,
): T[] {
  const idx = prev.findIndex((r) => r.filename === next.filename);
  if (idx === -1) return [...prev, next];
  const out = prev.slice();
  out[idx] = next;
  return out;
}
