/**
 * EB-1A Tier-3 field-of-endeavor classifier.
 *
 * Runs AFTER per-PDF rich extraction. Single Haiku 4.5 call with
 * structured output via zodOutputFormat. Few-shot Goldilocks examples
 * embedded in the system prompt so the specificity judgment is
 * calibrated. The aggregator (typed-aggregate-eb1a.ts) calls this
 * function and folds the result into EB1AFacts.field_classification.
 */

import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  FieldOfEndeavorSchema,
  type FieldOfEndeavorClassification,
} from './field-of-endeavor.schema';

const SYSTEM_PROMPT = `You are an immigration paralegal performing Phase-0.7 field-of-endeavor classification on an EB-1A self-petition (8 CFR §204.5(h); Kazarian v. USCIS, 596 F.3d 1115 (9th Cir. 2010)).

Your job: read the beneficiary's CV roles, diploma fields, recent publications, award titles, and recommendation-letter excerpts, then output a single Goldilocks-graded field-of-endeavor label.

The label is the peer-comparison anchor for the criteria gates downstream — high salary (h)(3)(ix), awards (h)(3)(i), original contributions of major significance (h)(3)(v) all benchmark against "others in the field." A bad label here propagates into RFE-prone arguments, so the Goldilocks bucket matters as much as the label itself.

=== GOLDILOCKS RULE ===

specificity = "too_broad" — peer comparison is meaningless because the peer set is the entire profession. Examples:
  - "computer science"
  - "medicine"
  - "engineering"
  - "biology"
  - "law"

specificity = "goldilocks" — specific enough that "others in the field" is well-defined, broad enough that a real peer set exists with measurable benchmarks (salary surveys, publication counts, award lists). Examples:
  - "applied machine learning for medical imaging"
  - "medium-voltage switchgear engineering"
  - "computational structural biology"
  - "earthquake-resistant high-rise structural engineering"
  - "consumer credit risk modeling"
  - "perovskite solar cell materials"
  - "post-production color grading for narrative film"

specificity = "too_narrow" — no defined peer set; the description is so specific that no benchmark exists. Examples:
  - "React 19 server-component memory profiling on Vercel Edge"
  - "real-time inference for one specific drug-discovery pipeline at one specific company"
  - "vendor-specific firmware engineering for a single proprietary SCADA platform"

When in doubt between too_narrow and goldilocks, prefer goldilocks IF a 2-sentence peer description with measurable benchmarks exists.

When in doubt between too_broad and goldilocks, prefer goldilocks IF you can name 3+ subdomains the peer set excludes.

=== HOW TO PICK THE LABEL ===

Priority order of inputs:
1. CV current title + last 2 titles + role descriptions (heaviest weight — this is what the beneficiary actually does day-to-day).
2. Terminal-degree field of study (anchors the formal training).
3. Recent (last 3 years) publication titles — these surface the active research focus.
4. Award titles — what was the award FOR (often more specific than the CV titles).
5. Recommendation-letter framing — pull verbatim phrases like "leading expert in X" or "pioneer of Y".

Style rules:
- 3–10 words.
- Noun phrase, sentence case, no leading "the".
- Avoid org names ("at Google" — wrong; "applied ML" — right).
- Avoid product names ("Tesla autopilot engineering" — wrong; "self-driving perception systems" — right).
- Avoid year-bound versions ("React 19 …" — wrong; "frontend architecture for high-traffic web platforms" — right, if peer set fits).
- Prefer the working term the field itself uses — "computational structural biology", not "biology with computers".

=== peer_set_description ===

One sentence, 15–35 words, that names who counts as a peer for benchmarking. Should pass this test: "If you took 100 randomly drawn people meeting this description from major US institutions, you would have a credible benchmarking cohort."

Examples:
  - "Senior researchers and applied scientists working on machine-learning models for radiology, pathology, or other medical imaging applications at academic medical centers, hospital systems, or imaging-focused industry labs."
  - "Engineers responsible for the design and integration of medium-voltage switchgear (typically 1–35 kV) for industrial substations, utility distribution, or large-scale commercial projects."

=== detection_signals ===

3–8 verbatim phrases (5–25 words each) from the input that anchored your choice. Each prefixed with [source-id] where source-id is the input doc identifier the caller provided.

=== reasoning ===

1–3 sentences. Explain (a) why the label, (b) why this specificity bucket. If specificity ≠ goldilocks, explain what would need to change to make it goldilocks.

=== confidence ===

HIGH — multiple input categories agree on the same domain; both CV titles and terminal degree align; recent publications corroborate.
MED  — primary signal (CV) is clear but corroborating signals are sparse; or CV titles drift across two adjacent domains.
LOW  — inputs disagree, or only the CV is available with a single role and no publications/awards/letters; the human reviewer must confirm.

Output the FieldOfEndeavorClassification structure exactly. NEVER hallucinate evidence; if a category is empty, just don't cite it.`;

const FORMAT = zodOutputFormat(FieldOfEndeavorSchema);

export interface FieldOfEndeavorInput {
  /** [source-id]-keyed bundle of evidence for the classifier. */
  cv?: {
    current_title?: string | null;
    prior_titles?: string[];
    role_descriptions?: string[];
    source_id?: string;
  };
  diplomas?: Array<{
    field_of_study?: string | null;
    degree?: string | null;
    is_terminal?: boolean | null;
    source_id?: string;
  }>;
  recent_publication_titles?: Array<{ title: string; source_id?: string }>;
  award_titles?: Array<{ title: string; source_id?: string }>;
  recommendation_letter_excerpts?: Array<{ excerpt: string; source_id?: string }>;
}

function renderInput(input: FieldOfEndeavorInput): string {
  const sections: string[] = [];

  if (input.cv) {
    const { current_title, prior_titles = [], role_descriptions = [], source_id = 'cv' } = input.cv;
    const lines = [`## CV [${source_id}]`];
    if (current_title) lines.push(`Current title: ${current_title}`);
    if (prior_titles.length) lines.push(`Prior titles: ${prior_titles.join(' | ')}`);
    if (role_descriptions.length) {
      lines.push('Role descriptions:');
      for (const d of role_descriptions) lines.push(`  - ${d}`);
    }
    sections.push(lines.join('\n'));
  }

  if (input.diplomas?.length) {
    const lines = ['## Diplomas'];
    for (const d of input.diplomas) {
      const id = d.source_id ?? 'diploma';
      lines.push(
        `[${id}] ${d.degree ?? '?'} in ${d.field_of_study ?? '?'}${d.is_terminal ? ' (terminal)' : ''}`,
      );
    }
    sections.push(lines.join('\n'));
  }

  if (input.recent_publication_titles?.length) {
    const lines = ['## Recent publications (titles only)'];
    for (const p of input.recent_publication_titles) {
      lines.push(`[${p.source_id ?? 'pub'}] ${p.title}`);
    }
    sections.push(lines.join('\n'));
  }

  if (input.award_titles?.length) {
    const lines = ['## Award titles'];
    for (const a of input.award_titles) {
      lines.push(`[${a.source_id ?? 'award'}] ${a.title}`);
    }
    sections.push(lines.join('\n'));
  }

  if (input.recommendation_letter_excerpts?.length) {
    const lines = ['## Recommendation-letter excerpts'];
    for (const r of input.recommendation_letter_excerpts) {
      lines.push(`[${r.source_id ?? 'rec'}] ${r.excerpt}`);
    }
    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n');
}

export async function classifyFieldOfEndeavor(
  input: FieldOfEndeavorInput,
): Promise<FieldOfEndeavorClassification> {
  const rendered = renderInput(input);
  if (!rendered.trim()) {
    return {
      label: '',
      peer_set_description: '',
      specificity: 'too_broad',
      confidence: 'LOW',
      reasoning:
        'No CV, diplomas, publications, awards, or recommendation excerpts were provided to the classifier. The label cannot be inferred without at least the CV current title and a terminal-degree field of study.',
      detection_signals: [],
    };
  }

  const response = await getAnthropic().messages.parse({
    model: 'claude-haiku-4-5',
    max_tokens: 1500,
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral', ttl: '1h' } },
    ],
    messages: [{ role: 'user', content: rendered }],
    output_config: { format: FORMAT },
  });

  if (!response.parsed_output) {
    throw new Error('Field-of-endeavor classifier response did not match the schema');
  }

  logAnthropicUsage({
    stage: 'detect',
    model: 'claude-haiku-4-5',
    case_type: 'EB1A',
    usage: response.usage,
  });

  return response.parsed_output;
}
