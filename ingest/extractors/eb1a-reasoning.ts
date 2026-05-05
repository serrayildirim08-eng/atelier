/**
 * EB-1A Tier-3 reasoning bundle — single Haiku 4.5 call that returns
 * BOTH the field-of-endeavor classification AND the case-theory synthesis
 * from the same CV / rec-letter / diploma input.
 *
 * Replaces the two-call sequence:
 *   classifyFieldOfEndeavor() → synthesizeCaseTheory()
 *
 * Saves: 1 round-trip per EB-1A matter, 1 system-prompt cache-miss on
 * first-of-day, plus the redundancy of CV facts being repeated across
 * two payloads. Output schema below combines the two prior shapes
 * verbatim — callers can split the result with `splitEb1aReasoning()`.
 */

import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  FieldOfEndeavorSchema,
  type FieldOfEndeavorClassification,
} from './field-of-endeavor.schema';
import {
  CaseTheorySchema,
  type CaseTheory,
} from './case-theory.schema';
import type { FieldOfEndeavorInput } from './field-of-endeavor';
import type { CaseTheoryInput } from './case-theory';

export const Eb1aReasoningSchema = z.object({
  field_of_endeavor: FieldOfEndeavorSchema,
  case_theory: CaseTheorySchema,
});
export type Eb1aReasoning = z.infer<typeof Eb1aReasoningSchema>;

const FORMAT = zodOutputFormat(Eb1aReasoningSchema);

const SYSTEM_PROMPT = `You are an immigration paralegal performing the Phase-0.7 + Phase-0.8 EB-1A reasoning bundle (8 CFR §204.5(h); Kazarian v. USCIS, 596 F.3d 1115 (9th Cir. 2010)).

You produce TWO outputs from a single read of the inputs (CV, diplomas, rec letters, publications, awards):

==================================================================
PART 1 — field_of_endeavor (Phase-0.7 Goldilocks classifier)
==================================================================

The label is the peer-comparison anchor for the criteria gates downstream — high salary (h)(3)(ix), awards (h)(3)(i), original contributions (h)(3)(v) all benchmark against "others in the field." A bad label here propagates into RFE-prone arguments, so the Goldilocks bucket matters as much as the label itself.

specificity = "too_broad" — peer comparison is meaningless because the peer set is the entire profession. Examples: "computer science", "medicine", "engineering", "biology", "law".

specificity = "goldilocks" — specific enough that "others in the field" is well-defined, broad enough that a real peer set exists with measurable benchmarks. Examples: "applied machine learning for medical imaging", "medium-voltage switchgear engineering", "computational structural biology", "earthquake-resistant high-rise structural engineering", "consumer credit risk modeling", "perovskite solar cell materials", "post-production color grading for narrative film".

specificity = "too_narrow" — no defined peer set; the description is so specific that no benchmark exists. Examples: "React 19 server-component memory profiling on Vercel Edge", "real-time inference for one specific drug-discovery pipeline at one specific company".

When in doubt between too_narrow and goldilocks, prefer goldilocks IF a 2-sentence peer description with measurable benchmarks exists. When in doubt between too_broad and goldilocks, prefer goldilocks IF you can name 3+ subdomains the peer set excludes.

label style — 3–10 words, noun phrase, sentence case, no leading "the". Avoid org names, product names, year-bound versions.

peer_set_description — One sentence, 15–35 words, names who counts as a peer. Should pass: "If you took 100 randomly drawn people meeting this description from major US institutions, you would have a credible benchmarking cohort."

detection_signals — 3–8 verbatim phrases (5–25 words each) from the input that anchored your choice. Each prefixed with [source-id].

reasoning — 1–3 sentences. Explain (a) why the label, (b) why this specificity bucket. If specificity ≠ goldilocks, explain what would need to change to make it goldilocks.

field_of_endeavor.confidence — HIGH | MED | LOW. HIGH when CV titles + degree + publications align; LOW when CV-only with one role.

==================================================================
PART 2 — case_theory (Phase-0.8 case-theory synthesis)
==================================================================

NOT a legal conclusion. Do NOT use the phrases "extraordinary ability", "rises to the very top", "sustained acclaim", "national or international". Those determinations live in the criteria gates and Kazarian step 2 — case_theory is upstream of them.

one_line — 15–35 words. Pattern: "<Name> is a <role> working on <focus area>, recognized for <distinctive contribution>." Drop <Name> if you cannot confidently anchor it. Use the field_of_endeavor.label you produced above as the <focus area> anchor.

specialized_knowledge_arc — 2–4 sentences covering: (1) how the career converged on this focus, (2) what makes the work distinctive (technique, dataset, problem framing), (3) what the field has done with it (citations, adoption, downstream work). If publication / award / adoption signals are absent, write only beats 1 + 2 and surface the gap in \`gaps\`.

evidence_anchors — 2–6 entries. Each names a source_id (use the [source-id] tag from the input) and 1 sentence on why that document carries the theory. Prioritize: (1) rec letters describing distinctive contribution verbatim, (2) publications aligned with focus, (3) awards aligned with focus, (4) CV roles where title + responsibilities show convergence.

case_theory.confidence — HIGH | MED | LOW. HIGH when CV + ≥2 rec letters + (publications OR awards) all converge. LOW when CV-only or signals disagree or field_of_endeavor.confidence = LOW.

gaps — 1–2 sentences naming what you did NOT see that would raise confidence. Empty string when confidence = HIGH.

==================================================================
OUTPUT
==================================================================

Output the Eb1aReasoning structure exactly: { field_of_endeavor: ..., case_theory: ... }. NEVER hallucinate evidence; if a category is empty, just don't cite it. Order: produce field_of_endeavor first (case_theory references its label), then case_theory.`;

/**
 * Combined input shape — superset of the two prior inputs. Either of the
 * legacy callers (FieldOfEndeavorInput or CaseTheoryInput) can be widened
 * into this type without losing data.
 */
export type Eb1aReasoningInput = FieldOfEndeavorInput & CaseTheoryInput;

function renderInput(input: Eb1aReasoningInput): string {
  const sections: string[] = [];

  if (input.cv) {
    const {
      full_name,
      current_title,
      current_employer,
      prior_titles = [],
      role_descriptions = [],
      source_id = 'cv',
    } = input.cv;
    const lines = [`## CV [${source_id}]`];
    if (full_name) lines.push(`Name: ${full_name}`);
    if (current_title) lines.push(`Current title: ${current_title}`);
    if (current_employer) lines.push(`Current employer: ${current_employer}`);
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

export async function synthesizeEb1aReasoning(
  input: Eb1aReasoningInput,
): Promise<Eb1aReasoning> {
  const rendered = renderInput(input);
  if (!rendered.trim() || !input.cv) {
    return {
      field_of_endeavor: {
        label: '',
        peer_set_description: '',
        specificity: 'too_broad',
        confidence: 'LOW',
        reasoning:
          'No inputs provided. The label cannot be inferred without at least the CV current title.',
        detection_signals: [],
      },
      case_theory: {
        one_line: '',
        specialized_knowledge_arc: '',
        evidence_anchors: [],
        confidence: 'LOW',
        gaps:
          'No CV provided. Case theory cannot be synthesized without at least the beneficiary current title and a role description.',
      },
    };
  }

  const response = await getAnthropic().messages.parse({
    model: 'claude-haiku-4-5',
    max_tokens: 2500,
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral', ttl: '1h' } },
    ],
    messages: [{ role: 'user', content: rendered }],
    output_config: { format: FORMAT },
  });

  if (!response.parsed_output) {
    throw new Error('EB-1A reasoning bundle response did not match the schema');
  }

  logAnthropicUsage({
    stage: 'detect',
    model: 'claude-haiku-4-5',
    case_type: 'EB1A',
    usage: response.usage,
  });

  return response.parsed_output;
}

/**
 * Backwards-compatible split — lets callers that previously held two
 * separate refs continue to receive both shapes from the bundled call.
 */
export function splitEb1aReasoning(
  bundle: Eb1aReasoning,
): { field: FieldOfEndeavorClassification; theory: CaseTheory } {
  return {
    field: bundle.field_of_endeavor,
    theory: bundle.case_theory,
  };
}
