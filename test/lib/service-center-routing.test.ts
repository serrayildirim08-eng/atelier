/**
 * lib/e2/service-center-routing — unit tests.
 */

import { describe, expect, it } from 'vitest';
import { routeServiceCenter } from '@/lib/e2/service-center-routing';

describe('routeServiceCenter', () => {
  // ── Common state code cases ─────────────────────────────────────────────
  it('NY → vermont', () => {
    const r = routeServiceCenter('NY');
    expect(r.service_center).toBe('vermont');
    expect(r.source).toBe('state_lookup');
    expect(r.service_center_label).toBe('Vermont Service Center (VSC)');
  });

  it('CA → california', () => {
    const r = routeServiceCenter('CA');
    expect(r.service_center).toBe('california');
    expect(r.service_center_label).toBe('California Service Center (CSC)');
  });

  it('TX → texas', () => {
    const r = routeServiceCenter('TX');
    expect(r.service_center).toBe('texas');
    expect(r.service_center_label).toBe('Texas Service Center (TSC)');
  });

  it('IA → nebraska', () => {
    const r = routeServiceCenter('IA');
    expect(r.service_center).toBe('nebraska');
    expect(r.service_center_label).toBe('Nebraska Service Center (NSC)');
  });

  it('VA → potomac', () => {
    const r = routeServiceCenter('VA');
    expect(r.service_center).toBe('potomac');
    expect(r.service_center_label).toBe('Potomac Service Center (PSC)');
  });

  // ── Full name cases (case-insensitive) ──────────────────────────────────
  it('"New York" → vermont', () => {
    expect(routeServiceCenter('New York').service_center).toBe('vermont');
  });

  it('"california" (lowercase full name) → california', () => {
    expect(routeServiceCenter('california').service_center).toBe('california');
  });

  it('"new york" (all lowercase) → vermont', () => {
    expect(routeServiceCenter('new york').service_center).toBe('vermont');
  });

  // ── Lowercase state codes ───────────────────────────────────────────────
  it('"ny" (lowercase code) → vermont', () => {
    expect(routeServiceCenter('ny').service_center).toBe('vermont');
  });

  it('"tx" (lowercase code) → texas', () => {
    expect(routeServiceCenter('tx').service_center).toBe('texas');
  });

  // ── Territory cases ─────────────────────────────────────────────────────
  it('GU (Guam) → california', () => {
    expect(routeServiceCenter('GU').service_center).toBe('california');
  });

  it('PR (Puerto Rico) → vermont', () => {
    expect(routeServiceCenter('PR').service_center).toBe('vermont');
  });

  // ── Edge / fallback cases ───────────────────────────────────────────────
  it('empty string → unknown', () => {
    const r = routeServiceCenter('');
    expect(r.service_center).toBe('unknown');
    expect(r.source).toBe('fallback');
  });

  it('null → unknown', () => {
    const r = routeServiceCenter(null);
    expect(r.service_center).toBe('unknown');
    expect(r.source).toBe('fallback');
  });

  it('undefined → unknown', () => {
    const r = routeServiceCenter(undefined);
    expect(r.service_center).toBe('unknown');
    expect(r.source).toBe('fallback');
  });

  it('"XX" (invalid code) → unknown', () => {
    const r = routeServiceCenter('XX');
    expect(r.service_center).toBe('unknown');
    expect(r.source).toBe('fallback');
  });

  it('"  NY  " (padded whitespace) → vermont', () => {
    expect(routeServiceCenter('  NY  ').service_center).toBe('vermont');
  });
});
