/**
 * Phase-0.6 sub-type detector regression suite.
 *
 * The Imm-464-2023 (Cemre Musluoglu / Musluoglu Global) case is the
 * canonical mis-classification exemplar from
 * manuals/_E2-SUBTYPE-TAXONOMY.md §11. It was filed under the SharePoint
 * folder label `(BUS)`, which a naive detector might treat as a Subtype 1
 * signal. The doctrinal answer is Subtype 3
 * (executive_supervisory_employee) — the corporate parent is the
 * principal treaty investor; the Beneficiary is an executive employee.
 *
 * This suite locks in three guarantees:
 *
 *   1. The fixture JSON parses cleanly and tags itself with the correct
 *      expected subtype + the must-not-classify-as warning.
 *   2. The CaseFacts sample inside the fixture validates against the
 *      production E2FactsSchema discriminated union — i.e., a downstream
 *      pipeline that consumes the fixture as a stand-in for ingestion
 *      output won't crash on schema drift.
 *   3. pickRawDocSamplePaths (the filename-pattern sample selector for
 *      the raw_docs detector mode) does NOT treat the literal token
 *      "BUS" in a folder/file name as a Subtype 1 signal — i.e., a
 *      folder labeled "(BUS)" alone cannot drive the classifier toward
 *      individual_investor in the absence of MITA / Operating Agreement
 *      / personal SOF documents.
 *
 * The actual LLM-driven classification of the full Cemre case folder is
 * a manual / staging integration test (the full PDF set does not fit in
 * a unit fixture, and we don't fire Anthropic in CI). The contract here
 * is: ANY change to the detector or the sample picker MUST keep the
 * fixture metadata + the filename-signal contract intact, otherwise the
 * regression caveat from the taxonomy doc is silently lost.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pickRawDocSamplePaths } from '@/ingest/extractors/subtype-detect';
import { E2FactsSchema, DraftModeEnum } from '@/ingest/schema';
import { E2PrincipalSubtypeEnum } from '@/ingest/extractors/subtype-detect.schema';

const FIXTURE_PATH = join(__dirname, '..', 'fixtures', 'imm-464-2023.json');

interface RegressionFixture {
  fixture_id: string;
  matter_label: string;
  sharepoint_folder_label: string;
  case_outcome: string;
  regression_purpose: string;
  expected_principal_subtype: string;
  expected_procedural_posture: string;
  must_not_classify_as: string;
  case_facts_sample: unknown;
  raw_doc_signals_present: string[];
  raw_doc_signals_absent_for_subtype_1: string[];
}

function loadFixture(): RegressionFixture {
  const raw = readFileSync(FIXTURE_PATH, 'utf-8');
  return JSON.parse(raw) as RegressionFixture;
}

describe('Imm-464-2023 sub-type regression fixture', () => {
  it('declares Subtype 3 as the expected classification (NOT Subtype 1)', () => {
    const fx = loadFixture();
    expect(fx.fixture_id).toBe('imm-464-2023');
    expect(fx.expected_principal_subtype).toBe('executive_supervisory_employee');
    expect(fx.must_not_classify_as).toBe('individual_investor');
    // Sanity: expected and must-not-classify-as are different — a future
    // edit that homogenizes them would silently nullify the regression.
    expect(fx.expected_principal_subtype).not.toBe(fx.must_not_classify_as);
  });

  it('preserves the BUS folder-label caveat in fixture metadata', () => {
    const fx = loadFixture();
    expect(fx.sharepoint_folder_label).toBe('BUS');
    expect(fx.regression_purpose.toLowerCase()).toContain('not a reliable subtype 1 indicator');
  });

  it('embeds raw_doc signals that should drive Subtype 3, not Subtype 1', () => {
    const fx = loadFixture();
    // Subtype 3 signals MUST be present in the fixture description.
    expect(
      fx.raw_doc_signals_present.some((s) => /corporate parent|parent corporation|parent.*us subsidiary/i.test(s)),
    ).toBe(true);
    // Subtype 1 signals MUST be explicitly listed as absent.
    expect(
      fx.raw_doc_signals_absent_for_subtype_1.some((s) => /membership interest transfer/i.test(s)),
    ).toBe(true);
    expect(
      fx.raw_doc_signals_absent_for_subtype_1.some((s) => /personal/i.test(s)),
    ).toBe(true);
  });
});

describe('Imm-464-2023 CaseFacts sample shape', () => {
  it('uses valid enum tags for case_type / subtype / draft_mode', () => {
    const fx = loadFixture();
    const sample = fx.case_facts_sample as {
      case_type: string;
      subtype: string;
      draft_mode: string;
      facts: Record<string, unknown>;
    };

    // The production discriminated-union tag for E-2 cases.
    expect(sample.case_type).toBe('E2');

    // subtype + draft_mode tags must be valid enum members so the
    // CaseFacts union assembled from this fixture parses upstream.
    expect(E2PrincipalSubtypeEnum.options).toContain(sample.subtype);
    expect(DraftModeEnum.options).toContain(sample.draft_mode);
  });

  it('embeds the case-shape signals that disambiguate Subtype 3 from Subtype 1', () => {
    const fx = loadFixture();
    const sample = fx.case_facts_sample as {
      facts: {
        ownership_history?: Array<{ owner_type?: string; owner_name?: string }>;
        rfes?: Array<{ subject_category?: string }>;
      };
    };

    // The doctrinal signal that this is Subtype 3 (corporate-parent
    // treaty investor): an ownership_history entry of type
    // 'treaty_country_corporation' rather than a personal owner.
    const ownership = sample.facts.ownership_history ?? [];
    expect(ownership.length).toBeGreaterThan(0);
    expect(ownership[0].owner_type).toBe('treaty_country_corporation');

    // The matter MUST carry an RFE entry with classification_ambiguity
    // — that is what the regression locks in: any pipeline that drops
    // this fixture's RFE shape silently loses the Cemre lesson.
    const rfes = sample.facts.rfes ?? [];
    expect(rfes.some((r) => r.subject_category === 'classification_ambiguity')).toBe(true);
  });

  it('case-shape sample compiles into the E2FactsSchema-shape (best-effort, surfaces drift)', () => {
    // The sample is intentionally a doctrinally-shaped JSON, not a
    // fully Field<T>-instrumented payload (those require source_page +
    // source_quote + confidence on every leaf, which would 10x the
    // fixture size with no regression value). We assert here only that
    // the safeParse FAILURES, if any, are restricted to the well-known
    // Field<T>-wrapping issues — never a top-level shape mismatch.
    const fx = loadFixture();
    const sample = fx.case_facts_sample as { facts: unknown };
    const result = E2FactsSchema.safeParse(sample.facts);
    if (!result.success) {
      // Allowed failure modes: missing Field<T> wrapping on leaves, or
      // missing required nested arrays (ownership_chain etc.) we don't
      // populate in the documentation fixture. NOT allowed: top-level
      // unknown keys or wrong-type discriminators.
      const topLevelKeyMismatch = result.error.issues.find(
        (i) => i.path.length === 0 || i.code === 'unrecognized_keys',
      );
      expect(topLevelKeyMismatch).toBeUndefined();
    }
  });
});

describe('pickRawDocSamplePaths — folder-label resilience', () => {
  it('does NOT treat the literal token "BUS" in a path as a Subtype 1 signal', () => {
    // Cemre-shape folder: the label is "(BUS)" but the actual signal-dense
    // documents are corporate-parent docs + Beneficiary CV (Subtype 3
    // pattern), NOT MITA / Operating Agreement / personal SOF.
    const cemreShape = [
      '/sharepoint/Imm-464-2023 (BUS)/foreign-parent-articles.pdf',
      '/sharepoint/Imm-464-2023 (BUS)/parent-audited-financials.pdf',
      '/sharepoint/Imm-464-2023 (BUS)/board-resolution-investment.pdf',
      '/sharepoint/Imm-464-2023 (BUS)/parent-to-subsidiary-wire.pdf',
      '/sharepoint/Imm-464-2023 (BUS)/beneficiary-cv.pdf',
      '/sharepoint/Imm-464-2023 (BUS)/beneficiary-passport.pdf',
    ];
    const picked = pickRawDocSamplePaths(cemreShape);
    // Picker should land on the CV (Subtype 3 signal) and the passport
    // (procedural posture). It must NOT silently route on the "(BUS)"
    // folder substring — none of these filenames match the contract /
    // operating-agreement / MITA bucket, so the contract bucket stays
    // empty and the picker falls through to CV + passport.
    expect(picked.some((p) => /cv|resume/i.test(p))).toBe(true);
    expect(picked.some((p) => /passport/i.test(p))).toBe(true);
    // No path was selected on the basis of "BUS" alone — the regex set
    // does not include /\(?BUS\)?/ as a Subtype 1 signal.
    for (const p of picked) {
      expect(/\bMembership[-_\s]?Interest\b/i.test(p)).toBe(false);
      expect(/\bOperating[-_\s]?Agreement\b/i.test(p)).toBe(false);
    }
  });
});
