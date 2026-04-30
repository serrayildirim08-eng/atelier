/**
 * Filing metadata — Tier 1 manual overrides.
 *
 * Two design rules from the EB-1A spec discussion (2026-04-30):
 *   1. filing_route + consulate_post are ALWAYS manual. The bot does not
 *      auto-detect these even when an I-797 + I-94 are present. This is
 *      because misclassification propagates into the wrong cover-letter
 *      template and the wrong filing checklist.
 *   2. Address fields auto-fill from passport / visa / I-797 mailing
 *      blocks, but every field stays editable. Detected values land in
 *      filing_metadata before any override is applied; overrides REPLACE
 *      detected values, they do not merge.
 */

import type { EB1AFilingMetadata, FilingRoute } from './types';

export interface FilingMetadataOverride {
  filing_route?: FilingRoute;
  consulate_post?: string;
  i140_receipt_number?: string;
  i140_filed_date?: string;
  residential_address?: string;
  mailing_address?: string;
  mailing_address_same_as_residential?: boolean;
}

const nullField = <T>() => ({
  value: null as T | null,
  source_page: null,
  source_quote: null,
  confidence: null,
});

export function defaultFilingMetadata(): EB1AFilingMetadata {
  return {
    filing_route: nullField<FilingRoute>(),
    consulate_post: nullField<string>(),
    i140_receipt_number: nullField<string>(),
    i140_filed_date: nullField<string>(),
    residential_address: nullField<string>(),
    mailing_address: nullField<string>(),
    mailing_address_same_as_residential: nullField<boolean>(),
    manual_overrides_applied: [],
  };
}

export function applyFilingMetadataOverrides(
  base: EB1AFilingMetadata,
  override: FilingMetadataOverride,
): EB1AFilingMetadata {
  const applied: string[] = [];
  const next = { ...base, manual_overrides_applied: [...base.manual_overrides_applied] };

  const setField = <K extends keyof FilingMetadataOverride>(
    key: K,
    targetKey: keyof EB1AFilingMetadata,
  ) => {
    const v = override[key];
    if (v === undefined) return;
    applied.push(String(key));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (next as any)[targetKey] = {
      value: v,
      source_page: null,
      source_quote: '[manual override]',
      confidence: 1,
    };
  };

  setField('filing_route', 'filing_route');
  setField('consulate_post', 'consulate_post');
  setField('i140_receipt_number', 'i140_receipt_number');
  setField('i140_filed_date', 'i140_filed_date');
  setField('residential_address', 'residential_address');
  setField('mailing_address', 'mailing_address');
  setField('mailing_address_same_as_residential', 'mailing_address_same_as_residential');

  for (const k of applied) {
    next.manual_overrides_applied.push({
      value: k,
      source_page: null,
      source_quote: '[manual override]',
      confidence: 1,
    });
  }

  return next;
}
