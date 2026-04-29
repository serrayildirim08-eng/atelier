/**
 * Phase-9 — pure helpers shared by `DeterministicGatesPanel` and its tests.
 *
 * Vitest runs in node-env (no DOM / RTL), so the panel's React tree is
 * not directly testable. This module exports the per-gate UI decisions
 * (severity → Tailwind classes, default-open rule, summary text) as
 * pure functions so the test suite can pin the behaviour without
 * mounting components.
 */

import type { GateRunResult } from '@/reason';

/**
 * Severity → Tailwind utility classes for the colored pill badge.
 *
 * Sticks to the existing `app/page.tsx` palette (ink / rule / paper
 * tokens). Severity colors layered onto those tokens so the badge reads
 * as ornament-on-ink rather than a saas pill.
 */
export const GATE_SEVERITY_PILL_CLASS: Record<1 | 2 | 3 | 4 | 5, string> = {
  5: 'bg-red-100 text-red-900 border border-red-300',
  4: 'bg-orange-100 text-orange-900 border border-orange-300',
  3: 'bg-yellow-100 text-yellow-900 border border-yellow-300',
  2: 'bg-blue-100 text-blue-900 border border-blue-300',
  1: 'bg-stone-100 text-stone-900 border border-stone-300',
};

export const GATE_SEVERITY_LABEL: Record<1 | 2 | 3 | 4 | 5, string> = {
  5: 'critical',
  4: 'major',
  3: 'moderate',
  2: 'minor',
  1: 'info',
};

export function severityPillClass(severity: 1 | 2 | 3 | 4 | 5): string {
  return GATE_SEVERITY_PILL_CLASS[severity];
}

/**
 * Severity 5 (critical) gates default open so the attorney sees the
 * finding without an extra click. 1-4 collapse by default so the panel
 * doesn't drown the dossier.
 */
export function gateDefaultOpen(g: GateRunResult): boolean {
  return g.outcome.fired && g.outcome.severity === 5;
}

/**
 * Summary line for the collapsed "gates passed" affordance. When zero
 * gates fired, returns "All N gates passed." otherwise the count of
 * not-fired entries.
 */
export function passedGatesSummary(gates: GateRunResult[]): string {
  const passed = gates.filter(
    (g) => !g.outcome.fired && g.outcome.reason === 'not_applicable',
  );
  if (gates.length === 0) return 'No gates evaluated.';
  if (gates.every((g) => !g.outcome.fired) && passed.length === gates.length) {
    return `All ${gates.length} gates passed.`;
  }
  return `${passed.length} of ${gates.length} gates passed.`;
}
