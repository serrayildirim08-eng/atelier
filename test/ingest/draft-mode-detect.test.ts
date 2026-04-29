/**
 * Phase-0.7 draft-mode detector tests — pure (heuristic layer only, no
 * Anthropic calls).
 *
 * Covers:
 *   1. detectDraftModeHeuristic classifies the four canonical case shapes
 *      (initial, rfe_response, premium_upgrade, service_request).
 *   2. Returns mode=null when signals are absent (caller falls through
 *      to the LLM in production).
 *   3. Returns mode=null when signals contradict (no clear winner).
 *   4. Schema validation: DraftModeDetectionSchema accepts the canonical
 *      output shape and rejects malformed payloads.
 */

import { describe, expect, it } from 'vitest';
import {
  detectDraftModeHeuristic,
  type DraftModeDetectionInput,
} from '@/ingest/draft-mode-detect';
import { DraftModeDetectionSchema } from '@/ingest/draft-mode-detect.schema';

/* ---------------------------------------------------------------------- */
/* Fixtures — minimal, hand-crafted to exercise heuristic patterns         */
/* ---------------------------------------------------------------------- */

const RFE_RESPONSE_FIXTURE: DraftModeDetectionInput[] = [
  {
    filename: 'rfe-response-cover-letter.pdf',
    text: `Dear Officer,
This letter is submitted in response to the Request for Evidence dated August 12, 2024. We address each point below.`,
  },
  {
    filename: 'uscis-rfe-notice.pdf',
    text: `U.S. Citizenship and Immigration Services
REQUEST FOR EVIDENCE — Request for Evidence dated 2024-08-12
We require additional evidence regarding the substantiality of the investment.`,
  },
];

const PREMIUM_UPGRADE_FIXTURE: DraftModeDetectionInput[] = [
  {
    filename: 'i907-premium-processing.pdf',
    text: `Form I-907 — Request for Premium Processing Service
The petitioner hereby submits this premium processing election for the pending I-129 petition.`,
  },
];

const SERVICE_REQUEST_FIXTURE: DraftModeDetectionInput[] = [
  {
    filename: 'expedite-request-confirmation.pdf',
    text: `Service request submitted via egov.uscis.gov.
The case is outside normal processing time and we are requesting expedited adjudication.`,
  },
];

const INITIAL_NO_SIGNAL_FIXTURE: DraftModeDetectionInput[] = [
  {
    filename: 'cover-letter.pdf',
    text: `Dear Officer,
We respectfully submit this petition on behalf of the Beneficiary in support of an E-2 treaty investor classification. Enclosed please find the I-129 with E supplement, evidence of substantial investment, and supporting exhibits.`,
  },
  {
    filename: 'i129.pdf',
    text: `Form I-129, Petition for Nonimmigrant Worker. Classification requested: E-2.`,
  },
];

const CONTRADICTORY_FIXTURE: DraftModeDetectionInput[] = [
  {
    filename: 'rfe-response.pdf',
    text: `In response to the Request for Evidence dated 2024-08-12.`,
  },
  {
    filename: 'i907.pdf',
    text: `Form I-907 — Request for Premium Processing Service. premium processing election.`,
  },
];

/* ---------------------------------------------------------------------- */
/* Heuristic tests                                                        */
/* ---------------------------------------------------------------------- */

describe('detectDraftModeHeuristic', () => {
  it('classifies an RFE response shape as rfe_response', () => {
    const verdict = detectDraftModeHeuristic(RFE_RESPONSE_FIXTURE);
    expect(verdict.mode).toBe('rfe_response');
    expect(verdict.signals.length).toBeGreaterThan(0);
  });

  it('classifies a premium-processing election as premium_upgrade', () => {
    const verdict = detectDraftModeHeuristic(PREMIUM_UPGRADE_FIXTURE);
    expect(verdict.mode).toBe('premium_upgrade');
    expect(verdict.signals.length).toBeGreaterThan(0);
  });

  it('classifies an e-request / expedite shape as service_request', () => {
    const verdict = detectDraftModeHeuristic(SERVICE_REQUEST_FIXTURE);
    expect(verdict.mode).toBe('service_request');
    expect(verdict.signals.length).toBeGreaterThan(0);
  });

  it('returns mode=null when no signals fire (caller defaults to initial / LLM)', () => {
    const verdict = detectDraftModeHeuristic(INITIAL_NO_SIGNAL_FIXTURE);
    expect(verdict.mode).toBeNull();
    expect(verdict.signals).toEqual([]);
  });

  it('returns mode=null when contradictory signals tie (no 2x lead)', () => {
    const verdict = detectDraftModeHeuristic(CONTRADICTORY_FIXTURE);
    expect(verdict.mode).toBeNull();
  });

  it('returns mode=null on empty input', () => {
    const verdict = detectDraftModeHeuristic([]);
    expect(verdict.mode).toBeNull();
    expect(verdict.signals).toEqual([]);
  });

  it('does not falsely fire rfe_response on archived RFE notices without response framing', () => {
    // Folder contains an RFE notice from a prior matter but the active
    // cover letter is a fresh initial filing — no response framing.
    const fixture: DraftModeDetectionInput[] = [
      {
        filename: 'cover-letter.pdf',
        text: `We respectfully submit this petition on behalf of the Beneficiary for E-2 classification. Enclosed are the form I-129, supporting exhibits, and source-of-funds evidence.`,
      },
      {
        filename: 'historical-record.pdf',
        text: `Historical case file from 2019 — closed.`,
      },
    ];
    const verdict = detectDraftModeHeuristic(fixture);
    expect(verdict.mode).toBeNull();
  });
});

/* ---------------------------------------------------------------------- */
/* Schema validation tests                                                */
/* ---------------------------------------------------------------------- */

describe('DraftModeDetectionSchema', () => {
  it('accepts a canonical detection shape', () => {
    const parsed = DraftModeDetectionSchema.parse({
      mode: 'rfe_response',
      confidence: 'HIGH',
      signals: ['[rfe-response.pdf] In response to the Request for Evidence dated 2024-08-12'],
      reasoning: 'Cover letter explicitly frames itself as an RFE response.',
    });
    expect(parsed.mode).toBe('rfe_response');
  });

  it('accepts initial / LOW with empty signals (default-fallback shape)', () => {
    const parsed = DraftModeDetectionSchema.parse({
      mode: 'initial',
      confidence: 'LOW',
      signals: [],
      reasoning: 'No samples; defaulted to initial.',
    });
    expect(parsed.mode).toBe('initial');
    expect(parsed.confidence).toBe('LOW');
  });

  it('rejects an unknown mode value', () => {
    const result = DraftModeDetectionSchema.safeParse({
      mode: 'bogus_mode',
      confidence: 'HIGH',
      signals: [],
      reasoning: 'x',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown confidence value', () => {
    const result = DraftModeDetectionSchema.safeParse({
      mode: 'initial',
      confidence: 'VERY_HIGH',
      signals: [],
      reasoning: 'x',
    });
    expect(result.success).toBe(false);
  });
});
