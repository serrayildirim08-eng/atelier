/**
 * pickReviewerEffort tests — pure (no Anthropic calls).
 *
 * Covers the routing rule:
 *   - non-E-2 case types always return 'high'
 *   - E-2 with no severity-4-or-5 conflict_register entries returns 'medium'
 *   - E-2 with at least one severity-4-or-5 entry returns 'high'
 *   - missing / malformed conflict_register is treated as no conflicts
 */

import { describe, expect, it } from 'vitest';
import { pickReviewerEffort } from '@/reason/checker';
import type { CaseFacts } from '@/ingest/schema';

function f<T>(value: T) {
  return { value, source_page: null, source_quote: null, confidence: 1 };
}

function conflict(severity: number) {
  return {
    description: f(`severity-${severity} test entry`),
    conflict_type: f('test'),
    severity: f(severity),
    fact_a_doc: f('a.pdf'),
    fact_a_page: f(1),
    fact_b_doc: f('b.pdf'),
    fact_b_page: f(1),
  };
}

function e2(conflicts: ReturnType<typeof conflict>[]): CaseFacts {
  return {
    case_type: 'E2',
    facts: { conflict_register: conflicts },
  } as unknown as CaseFacts;
}

function eb1a(conflicts: ReturnType<typeof conflict>[]): CaseFacts {
  return {
    case_type: 'EB1A',
    facts: { conflict_register: conflicts },
  } as unknown as CaseFacts;
}

describe('pickReviewerEffort', () => {
  it("returns 'medium' for E-2 with empty conflict_register", () => {
    expect(pickReviewerEffort(e2([]))).toBe('medium');
  });

  it("returns 'medium' for E-2 with severity-3 entry only", () => {
    expect(pickReviewerEffort(e2([conflict(3)]))).toBe('medium');
  });

  it("returns 'medium' for E-2 with multiple low-severity entries", () => {
    expect(pickReviewerEffort(e2([conflict(1), conflict(2), conflict(3)]))).toBe('medium');
  });

  it("returns 'high' for E-2 with one severity-4 entry", () => {
    expect(pickReviewerEffort(e2([conflict(4)]))).toBe('high');
  });

  it("returns 'high' for E-2 with one severity-5 entry", () => {
    expect(pickReviewerEffort(e2([conflict(5)]))).toBe('high');
  });

  it("returns 'high' for E-2 when only one of many entries is severity-4", () => {
    expect(pickReviewerEffort(e2([conflict(1), conflict(3), conflict(4)]))).toBe('high');
  });

  it("returns 'high' for EB-1A with empty conflict_register", () => {
    expect(pickReviewerEffort(eb1a([]))).toBe('high');
  });

  it("returns 'high' for EB-1A with no severity-4-or-5 entries", () => {
    expect(pickReviewerEffort(eb1a([conflict(1), conflict(2)]))).toBe('high');
  });

  it("treats missing conflict_register as no conflicts on E-2", () => {
    const facts = { case_type: 'E2', facts: {} } as unknown as CaseFacts;
    expect(pickReviewerEffort(facts)).toBe('medium');
  });
});
