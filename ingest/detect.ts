import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { DetectionSchema, type Detection } from './schema';

const SYSTEM_PROMPT = `You are an immigration paralegal performing fast case-type triage on a client's case folder. Read the document samples and decide which one of four visa types the case is. Return a structured detection result.

The four case types you must distinguish:

**E2 — Treaty Investor Visa**
Form signals: I-129 + E-1/E-2 Classification Supplement, DS-160 + DS-156E. Cover-letter/petition signals: "treaty investor", "substantial investment", "treaty country", "9 FAM 402.9", "8 CFR 214.2(e)", "Matter of Walsh and Pollard", "develop and direct", "more than marginal", "real and operating enterprise", "irrevocably committed", "at risk".

**EB1A — Extraordinary Ability (employment-based, first preference, alien of extraordinary ability)**
Form signals: I-140 with "Alien of Extraordinary Ability" box checked, no PERM. Petition-letter signals: "extraordinary ability", "sustained national or international acclaim", "risen to the very top of the field", "Kazarian", "596 F.3d 1115", "8 CFR 204.5(h)", references to the 10 regulatory criteria (awards, membership, published material, judging, original contributions, scholarly articles, exhibitions, leading/critical role, high salary, commercial success), "final merits".

**EB1B — Outstanding Professor or Researcher (employment-based, first preference, employer-sponsored)**
Form signals: I-140 with "Outstanding Professor or Researcher" box. Petition signals: "outstanding professor", "outstanding researcher", "permanent research position", "tenure track", "three years of teaching or research experience", "8 CFR 204.5(i)", references to the 6 regulatory criteria (subset of EB1A's 10).

**EB1C — Multinational Manager or Executive (employment-based, first preference, employer-sponsored)**
Form signals: I-140 with "Multinational Manager or Executive" box. Petition signals: "multinational manager", "multinational executive", "qualifying relationship", "parent / subsidiary / affiliate / branch", "doing business for at least one year", "one year of the three preceding years employed abroad", "managerial capacity", "executive capacity", "8 CFR 204.5(j)", "functional manager", "personnel manager".

Output rules:
- Pick exactly one of: E2, EB1A, EB1B, EB1C.
- confidence: 0–1. 1 = unambiguous form box and matching petition language. ~0.6 = strong inference from petition language without the form. Below 0.5 = guess; you should still pick the most likely but flag low confidence.
- reasoning: 1–2 sentences citing the strongest signals you found.
- evidence_quotes: 1–3 short verbatim quotes (each ≤30 words) from the documents that justify the choice.
- If the documents show MULTIPLE filing types (e.g. an E-2 followed by an EB-1C amendment), pick the type that the COVER LETTER / PETITION MEMO is currently arguing — that is the active case. Note ambiguity in reasoning.`;

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

const PER_FILE_CHARS = 4000;
const MAX_FILES = 3;

export interface DetectionInput {
  filename: string;
  text: string;
}

export async function detectCaseType(samples: DetectionInput[]): Promise<Detection> {
  if (samples.length === 0) {
    throw new Error('detectCaseType requires at least one document sample');
  }

  const trimmed = samples
    .slice(0, MAX_FILES)
    .map(
      (s) =>
        `## File: ${s.filename}\n\n${s.text.slice(0, PER_FILE_CHARS)}${
          s.text.length > PER_FILE_CHARS ? '\n[…truncated…]' : ''
        }`,
    )
    .join('\n\n---\n\n');

  const response = await client().messages.parse({
    model: 'claude-haiku-4-5',
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: trimmed }],
    output_config: {
      format: zodOutputFormat(DetectionSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error('Detector response did not match the detection schema');
  }
  return response.parsed_output;
}
