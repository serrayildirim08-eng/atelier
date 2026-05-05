/**
 * EB-1A Tier-3 case-theory synthesizer.
 *
 * Single Haiku 4.5 call with structured output via zodOutputFormat.
 * Reads CV (current title + prior titles + role descriptions), field-of-
 * endeavor classification, recommendation-letter excerpts, recent
 * publication titles, and award titles. Returns the one-line case
 * framing + specialized-knowledge arc that anchors every downstream
 * EB-1A gate.
 *
 * The aggregator (typed-aggregate-eb1a.ts) calls this AFTER the field-of-
 * endeavor classifier and folds the result into EB1AFacts.case_theory.
 */

import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  CaseTheorySchema,
  type CaseTheory,
} from './case-theory.schema';

const SYSTEM_PROMPT = `You are an immigration paralegal performing Phase-0.8 case-theory synthesis on an EB-1A self-petition (8 CFR §204.5(h); Kazarian v. USCIS, 596 F.3d 1115 (9th Cir. 2010)).

Your job: read the beneficiary's CV, the field-of-endeavor classification, recommendation-letter excerpts, publication titles, and award titles, then output the one-line case framing + specialized-knowledge arc that anchors every downstream LLM gate (criteria (h)(3)(i)–(x), Kazarian step 2, expert-letter scaffolding, cover-letter draft).

This is NOT a legal conclusion. Do NOT use the phrases "extraordinary ability", "rises to the very top", "sustained acclaim", "national or international". Those determinations live in the criteria gates and Kazarian step 2 — your output is upstream of them.

=== one_line ===

One sentence, 15–35 words. Preferred pattern:
  "<Name> is a <role> working on <focus area>, recognized for <distinctive contribution>."

Drop <Name> if you cannot confidently anchor it from the CV. Use the field-of-endeavor label as the anchor for <focus area> when one is provided.

Examples:
  - "Ada Chen is an applied research scientist working on machine-learning models for radiology, recognized for early-detection algorithms now deployed at three academic medical centers."
  - "Senior structural engineer working on earthquake-resistant high-rise design, recognized for retrofit methodologies adopted by two regional building codes."

Avoid:
  - Generic puffery ("brilliant pioneer of X").
  - Marketing language ("revolutionary", "world-class", "groundbreaking").
  - Org-name-as-credential ("works at Google" — instead say what they DO at Google).

=== specialized_knowledge_arc ===

2–4 sentences. The arc the cover letter will expand. Cover three beats:
  1. How the beneficiary's career converged on this focus (training → role progression).
  2. What makes the work distinctive (technique, dataset, problem framing).
  3. What the field has done with it (citations, adoption, downstream work) — only if signals support it.

If publication / award / adoption signals are absent, write only beats 1 and 2 and surface the gap in the \`gaps\` field.

=== evidence_anchors ===

2–6 entries. Each names a source_id (use the [source-id] tag from the input) and 1 sentence on why that document carries the theory. Prioritize, in order:
  1. Recommendation letters that describe the distinctive contribution verbatim.
  2. Publications with titles that align with the focus area.
  3. Awards whose titles align with the focus area.
  4. CV roles where title + responsibilities show convergence.

If only the CV is available, return 0–2 anchors and set confidence=LOW.

=== confidence ===

HIGH — CV + ≥2 rec letters + (publications OR awards) all converge on the same focus area.
MED  — CV + 1–2 corroborating signals; arc is plausible but thin.
LOW  — CV-only, OR signals disagree, OR field-of-endeavor classifier returned LOW confidence. The attorney must rewrite manually.

=== gaps ===

1–2 sentences naming what you did NOT see that would raise confidence. Examples:
  - "No publication titles available — citation impact cannot be inferred."
  - "Two rec letters but neither speaks to commercial / clinical adoption."
Empty string when confidence = HIGH.

Output the CaseTheory structure exactly. NEVER hallucinate evidence; if a category is empty, just don't cite it.`;

const FORMAT = zodOutputFormat(CaseTheorySchema);

export interface CaseTheoryInput {
  /** Field-of-endeavor classifier output (label + peer set + reasoning). */
  field_of_endeavor?: {
    label?: string | null;
    peer_set_description?: string | null;
    specificity?: 'too_broad' | 'goldilocks' | 'too_narrow' | null;
    confidence?: 'HIGH' | 'MED' | 'LOW' | null;
  };
  cv?: {
    full_name?: string | null;
    current_title?: string | null;
    current_employer?: string | null;
    prior_titles?: string[];
    role_descriptions?: string[];
    source_id?: string;
  };
  recommendation_letter_excerpts?: Array<{ excerpt: string; source_id?: string }>;
  recent_publication_titles?: Array<{ title: string; source_id?: string }>;
  award_titles?: Array<{ title: string; source_id?: string }>;
}

function renderInput(input: CaseTheoryInput): string {
  const sections: string[] = [];

  if (input.field_of_endeavor?.label) {
    const f = input.field_of_endeavor;
    const lines = ['## Field of endeavor (Phase-0.7 classifier)'];
    lines.push(`Label: ${f.label}`);
    if (f.peer_set_description) lines.push(`Peer set: ${f.peer_set_description}`);
    if (f.specificity) lines.push(`Specificity: ${f.specificity}`);
    if (f.confidence) lines.push(`Classifier confidence: ${f.confidence}`);
    sections.push(lines.join('\n'));
  }

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

  if (input.recommendation_letter_excerpts?.length) {
    const lines = ['## Recommendation-letter excerpts'];
    for (const r of input.recommendation_letter_excerpts) {
      lines.push(`[${r.source_id ?? 'rec'}] ${r.excerpt}`);
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

  return sections.join('\n\n');
}

export async function synthesizeCaseTheory(
  input: CaseTheoryInput,
): Promise<CaseTheory> {
  const rendered = renderInput(input);
  if (!rendered.trim() || !input.cv) {
    return {
      one_line: '',
      specialized_knowledge_arc: '',
      evidence_anchors: [],
      confidence: 'LOW',
      gaps:
        'No CV provided. Case theory cannot be synthesized without at least the beneficiary current title and a role description.',
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
    throw new Error('Case-theory synthesizer response did not match the schema');
  }

  logAnthropicUsage({
    stage: 'detect',
    model: 'claude-haiku-4-5',
    case_type: 'EB1A',
    usage: response.usage,
  });

  return response.parsed_output;
}
