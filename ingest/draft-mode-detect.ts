/**
 * Phase-0.7 draft-mode detector.
 *
 * Decides which DraftMode the drafter should run in based on signals from
 * the case folder's raw documents. Runs AFTER Phase-0 case-type detection
 * and (for E-2 cases) AFTER Phase-0.6 sub-type detection.
 *
 *   'initial'         — first-time filing. Default when nothing else fires.
 *   'rfe_response'    — USCIS issued an RFE / NOID; firm is responding.
 *   'premium_upgrade' — Form I-907 / premium-processing election; converts
 *                       a regular filing into 15-business-day adjudication.
 *   'service_request' — case-status or expedite request via egov.uscis.gov
 *                       service-request channel; not a fresh petition.
 *
 * Two-stage flow:
 *   1. Heuristic scan over filenames + sample text (cheap, deterministic).
 *      If a single mode wins by hard signal, return it; cost = 0 LLM calls.
 *   2. If signals are absent / contradictory, fall through to a Haiku 4.5
 *      classify call with prompt caching. Returns 'initial' on parser
 *      failure (best-effort posture matches subtype-detect's fallback).
 *
 * Note on 'rfe_response' vs 'initial': an RFE NOTICE in the folder alone is
 * not enough — initial filings sometimes archive prior RFEs from earlier
 * matters. The deciding signal is presence of an RFE response cover letter
 * OR the I-129/cover-letter explicitly framing itself as a response.
 */

import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  DraftModeDetectionSchema,
  type DraftModeDetection,
} from './draft-mode-detect.schema';
import type { DraftMode } from './schema';

export interface DraftModeDetectionInput {
  filename: string;
  text: string;
}

/* ---------------------------------------------------------------------- */
/* Heuristic layer — filename + text patterns                             */
/* ---------------------------------------------------------------------- */

const FILENAME_PATTERNS: Array<{ mode: DraftMode; re: RegExp }> = [
  { mode: 'rfe_response', re: /\brfe[-_\s]?response\b/i },
  { mode: 'rfe_response', re: /\bresponse[-_\s]?to[-_\s]?rfe\b/i },
  { mode: 'rfe_response', re: /\bnoid[-_\s]?response\b/i },
  { mode: 'premium_upgrade', re: /\bi[-_]?907\b/i },
  { mode: 'premium_upgrade', re: /\bpremium[-_\s]?processing\b/i },
  { mode: 'service_request', re: /\bservice[-_\s]?request\b/i },
  { mode: 'service_request', re: /\bexpedite[-_\s]?request\b/i },
];

/**
 * Text snippets that, when present in the body of any sample, are dispositive
 * for a particular mode. Phrases are matched case-insensitively. Order
 * matters only insofar as we tally one hit per mode per file and pick the
 * highest scorer; ties fall through to the LLM.
 */
const TEXT_PATTERNS: Array<{ mode: DraftMode; re: RegExp }> = [
  // RFE / NOID response framing
  { mode: 'rfe_response', re: /\bresponse to (?:the )?(?:request for evidence|rfe|notice of intent to deny|noid)\b/i },
  { mode: 'rfe_response', re: /\bin response to (?:your|the) (?:request for evidence|rfe|noid)\b/i },
  { mode: 'rfe_response', re: /\brequest for evidence dated\b/i },
  { mode: 'rfe_response', re: /\brfe dated\b/i },
  { mode: 'rfe_response', re: /\bnotice of intent to deny dated\b/i },

  // Premium processing
  { mode: 'premium_upgrade', re: /\brequest for premium processing\b/i },
  { mode: 'premium_upgrade', re: /\bpremium processing election\b/i },
  { mode: 'premium_upgrade', re: /\bform i-907\b/i },
  { mode: 'premium_upgrade', re: /\bupgrade(?: this petition)? to premium\b/i },

  // Service request (e-request channel)
  { mode: 'service_request', re: /\bservice request submitted\b/i },
  { mode: 'service_request', re: /\bcase outside (?:normal )?processing time\b/i },
  { mode: 'service_request', re: /\bexpedite request\b/i },
  { mode: 'service_request', re: /\begov\.uscis\.gov\b/i },
];

interface HeuristicVerdict {
  mode: DraftMode | null;
  /** Filename or quoted text snippet that drove the verdict. */
  signals: string[];
}

/**
 * Pure / deterministic. Returns mode=null when signals are absent or
 * contradictory (multiple modes both fired). Caller falls through to the
 * LLM in that case.
 */
export function detectDraftModeHeuristic(
  samples: DraftModeDetectionInput[],
): HeuristicVerdict {
  const tallies: Partial<Record<DraftMode, number>> = {};
  const signals: string[] = [];

  for (const s of samples) {
    for (const { mode, re } of FILENAME_PATTERNS) {
      if (re.test(s.filename)) {
        tallies[mode] = (tallies[mode] ?? 0) + 1;
        signals.push(`[filename:${s.filename}] matches ${re.source}`);
      }
    }
    for (const { mode, re } of TEXT_PATTERNS) {
      const m = s.text.match(re);
      if (m) {
        tallies[mode] = (tallies[mode] ?? 0) + 1;
        signals.push(`[${s.filename}] "${m[0]}"`);
      }
    }
  }

  const entries = Object.entries(tallies) as [DraftMode, number][];
  if (entries.length === 0) {
    return { mode: null, signals: [] };
  }

  entries.sort((a, b) => b[1] - a[1]);
  // Single-mode lead — accept.
  if (entries.length === 1) {
    return { mode: entries[0][0], signals };
  }
  // Multi-mode but a clear winner (≥ 2× runner-up) — accept.
  if (entries[0][1] >= entries[1][1] * 2) {
    return { mode: entries[0][0], signals };
  }
  // Contradictory — let the LLM arbitrate.
  return { mode: null, signals };
}

/* ---------------------------------------------------------------------- */
/* LLM fallback — Haiku 4.5 classifier with prompt caching                 */
/* ---------------------------------------------------------------------- */

const SYSTEM_PROMPT = `You are an immigration paralegal performing Phase-0.7 draft-mode triage on a case folder. Decide which one of four drafter operating modes the firm should use for this matter. You see only document samples; pick the mode the COVER LETTER / petition memo would frame itself in.

The four draft modes (one and only one applies):

1. initial — First-time filing of this petition for this beneficiary on this case theory. The drafter writes a fresh I-129 / DS-160 cover letter. Default when no other mode fires. Signals: a fresh I-129 + classification supplement, no prior RFE notice in the folder, no I-907 election, no e-request artifacts.

2. rfe_response — USCIS has issued a Request for Evidence (RFE) or a Notice of Intent to Deny (NOID) on a previously filed petition; the firm is RESPONDING. The drafter must write a response cover letter that addresses each USCIS concern point-by-point. Signals: an RFE / NOID notice from USCIS (e.g., "Request for Evidence dated 2024-08-12"), AND either a draft response cover letter framed as "response to the request for evidence" OR the firm has scheduled new evidence exhibits keyed to the RFE topics. An RFE NOTICE alone (archived from a prior matter) is NOT enough; look for response framing.

3. premium_upgrade — The firm is filing or has filed Form I-907 to upgrade the petition to premium processing (15-business-day adjudication). The cover letter is short and references the upgrade, not the underlying petition theory. Signals: Form I-907 in the folder, "request for premium processing", "premium processing election", or "upgrade to premium" framing in the cover letter.

4. service_request — The firm is making an egov.uscis.gov e-request (expedite, case outside normal processing time, change of address on a pending case, etc.). NOT a fresh petition. Signals: "service request submitted", "case outside normal processing time", "expedite request", or egov.uscis.gov e-request artifacts.

=== OUTPUT RULES ===

- mode: exactly one of initial / rfe_response / premium_upgrade / service_request.
- confidence: HIGH (multiple strong signals align), MED (one strong signal), LOW (only weak / inferred signals — route to attorney).
- signals: 1–4 short verbatim quotes (each 5–25 words) prefixed with [filename] that justify the mode pick. Examples:
    "[response-cover-letter.pdf] In response to the Request for Evidence dated August 12, 2024..."
    "[i907.pdf] Form I-907 — Request for Premium Processing Service"
- reasoning: 1–2 sentences citing the strongest signals.

=== GUARDRAILS ===

- DO NOT confuse an archived prior RFE (background context) with an active RFE response. The deciding evidence for rfe_response is response framing in the cover letter, not the mere presence of an RFE notice.
- If the folder contains BOTH an I-907 election AND an RFE response, pick rfe_response (the RFE work is the substantive draft; the I-907 is a separate one-page filing).
- Default to initial whenever signals are absent or weak. The drafter's initial mode is the safest fallback.`;

const DETECTION_FORMAT = zodOutputFormat(DraftModeDetectionSchema);

const PER_FILE_CHARS = 4000;
const MAX_FILES = 4;

async function detectDraftModeViaLlm(
  samples: DraftModeDetectionInput[],
): Promise<DraftModeDetection> {
  const trimmed = samples
    .slice(0, MAX_FILES)
    .map(
      (s) =>
        `## File: ${s.filename}\n\n${s.text.slice(0, PER_FILE_CHARS)}${
          s.text.length > PER_FILE_CHARS ? '\n[…truncated…]' : ''
        }`,
    )
    .join('\n\n---\n\n');

  const response = await getAnthropic().messages.parse({
    model: 'claude-haiku-4-5',
    max_tokens: 1500,
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral', ttl: '1h' } },
    ],
    messages: [{ role: 'user', content: trimmed }],
    output_config: { format: DETECTION_FORMAT },
  });

  if (!response.parsed_output) {
    throw new Error('Draft-mode detector response did not match the schema');
  }

  logAnthropicUsage({
    stage: 'detect',
    model: 'claude-haiku-4-5',
    usage: response.usage,
  });

  return response.parsed_output;
}

/* ---------------------------------------------------------------------- */
/* Public entry point                                                     */
/* ---------------------------------------------------------------------- */

/**
 * Returns the draft-mode for a case folder. Tries cheap heuristics first;
 * only fires Haiku 4.5 when signals are absent or contradictory. On any
 * unexpected error from the LLM path, returns 'initial' (the safest
 * default — the drafter always has a fresh-petition path).
 */
export async function detectDraftMode(
  samples: DraftModeDetectionInput[],
): Promise<DraftModeDetection> {
  if (samples.length === 0) {
    return {
      mode: 'initial',
      confidence: 'LOW',
      signals: [],
      reasoning:
        'No document samples provided; defaulted to initial. Attorney must confirm draft mode.',
    };
  }

  const heuristic = detectDraftModeHeuristic(samples);
  if (heuristic.mode !== null) {
    return {
      mode: heuristic.mode,
      confidence: 'HIGH',
      signals: heuristic.signals.slice(0, 4),
      reasoning: `Heuristic match — ${heuristic.signals.length} signal(s) aligned on ${heuristic.mode}.`,
    };
  }

  try {
    return await detectDraftModeViaLlm(samples);
  } catch (e: unknown) {
    return {
      mode: 'initial',
      confidence: 'LOW',
      signals: [],
      reasoning: `[draft-mode-detect-error] ${e instanceof Error ? e.message : String(e)}; fell back to initial.`,
    };
  }
}

/** Convenience: returns the bare DraftMode value (drops detection metadata). */
export async function detectDraftModeValue(
  samples: DraftModeDetectionInput[],
): Promise<DraftMode> {
  const result = await detectDraftMode(samples);
  return result.mode;
}
