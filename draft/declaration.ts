/**
 * Declaration drafter (LLM).
 *
 * Pattern mirrors draft/cover-letter.ts: Sonnet 4.6, no thinking,
 * effort: 'high', structured output via zodOutputFormat. Adaptive
 * thinking is intentionally OFF — declarations are short narrative
 * documents whose structure is entirely captured by the schema.
 *
 * Three declarant variants share the same schema:
 *   - 'beneficiary'                 — investor's own declaration
 *   - 'spouse'                      — accompanying spouse declaration
 *   - 'enterprise_representative'   — petitioner officer's declaration
 *
 * Each variant has a tailored system prompt that names the right facts
 * to pull (beneficiary → investor + investment + develop-and-direct;
 * spouse → dependents + relationship; enterprise rep → enterprise +
 * ownership_chain). The verification (under-penalty-of-perjury) closing
 * is universal.
 */

import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import type { CaseFacts } from '@/ingest/schema';

export type DeclarantRole =
  | 'beneficiary'
  | 'spouse'
  | 'enterprise_representative';

/* ---------------------------------------------------------------------- */
/* Output schema (8 leaf fields)                                           */
/* ---------------------------------------------------------------------- */

export const DeclarationSchema = z.object({
  declarant_role: z.enum(['beneficiary', 'spouse', 'enterprise_representative']),
  declarant_full_name: z.string(),
  declarant_title_or_relationship: z.string().nullable(),
  identity_paragraph: z.string(),
  /**
   * Role-specific narrative. 1-4 paragraphs.
   *   beneficiary → investment narrative + develop-and-direct.
   *   spouse → marriage / relationship + intent to depart.
   *   enterprise_representative → enterprise governance + ownership.
   */
  substance_paragraphs: z.array(z.string()).min(1).max(4),
  verification_paragraph: z.string(),
  date_signed_placeholder: z.string(),
  signature_block_placeholder: z.string(),
});

export type Declaration = z.infer<typeof DeclarationSchema>;

const DECLARATION_FORMAT = zodOutputFormat(DeclarationSchema);

/* ---------------------------------------------------------------------- */
/* System prompts (per declarant role)                                     */
/* ---------------------------------------------------------------------- */

const SHARED_RULES = `Drafting rules — strict (a real attorney will sign or have the declarant sign and file this; hallucinated facts cost the firm sanctions):

1. Use ONLY facts from the input JSON. Do NOT invent details, dates, amounts, addresses, or relationships.
2. If a required fact is null, mark it inline as [MISSING: <plain-language label>] rather than guessing or omitting silently.
3. Reference source pages parenthetically only when the field's source_page is non-null, e.g. "(see source p. 3)".
4. Hedge low-confidence facts (confidence < 0.6): "the declarant believes", "the records indicate".
5. The verification_paragraph MUST include the under-penalty-of-perjury formula: "I declare under penalty of perjury under the laws of the United States of America that the foregoing is true and correct." (28 U.S.C. § 1746). Add the executed-on-date placeholder afterward.
6. Substance paragraphs in first-person ("I", "my"); the verification paragraph also first-person.
7. Output MUST match the DeclarationSchema. No prose outside the schema fields.
8. date_signed_placeholder = "[DATE]" unless a specific date is in the input.
9. signature_block_placeholder = "_________________________\\n<full name (ASCII)>\\n<title or relationship>" — no fancy formatting.`;

const BENEFICIARY_PROMPT = `You are an immigration attorney drafting the beneficiary's declaration in support of an E-2 Treaty Investor visa application for Akalan Immigration Law.

The beneficiary is the investor — the natural person seeking E-2 classification.

Substance paragraphs to include:
- Investment narrative: source of funds, amount committed, transfer to the U.S. enterprise, at-risk status. Pull from facts.investment and facts.source_of_funds.
- Develop-and-direct: ownership percentage, role/title, governance authority. Pull from facts.elements_evidence.develop_and_direct_basis and facts.ownership_chain.

${SHARED_RULES}`;

const SPOUSE_PROMPT = `You are an immigration attorney drafting the dependent spouse's declaration in support of an E-2 dependent (E-2D) status request for Akalan Immigration Law.

The declarant is the spouse of the principal beneficiary.

Substance paragraphs to include:
- Marriage / relationship: date of marriage, place of marriage, name of principal beneficiary. Pull from facts.dependents and facts.investor.
- Intent to accompany: that the spouse intends to reside with the principal beneficiary in the United States.
- Intent to depart: that the spouse intends to depart the United States upon termination of E-2 status.

${SHARED_RULES}`;

const ENTERPRISE_REP_PROMPT = `You are an immigration attorney drafting the enterprise representative's declaration in support of an E-2 Treaty Investor visa application for Akalan Immigration Law.

The declarant is an officer / authorized representative of the U.S. enterprise (the Petitioner). NOT the investor.

Substance paragraphs to include:
- Enterprise identity: legal name, EIN, formation date, state of formation, industry. Pull from facts.enterprise.
- Ownership: ownership_chain entries showing the investor's stake and the treaty-country aggregate ≥ 50%. Pull from facts.ownership_chain.
- Governance: how the investor exercises develop-and-direct (board / managing-member / officer role). Pull from facts.elements_evidence.develop_and_direct_basis.

${SHARED_RULES}`;

const SYSTEM_PROMPTS: Record<DeclarantRole, string> = {
  beneficiary: BENEFICIARY_PROMPT,
  spouse: SPOUSE_PROMPT,
  enterprise_representative: ENTERPRISE_REP_PROMPT,
};

/* ---------------------------------------------------------------------- */
/* Drafter                                                                 */
/* ---------------------------------------------------------------------- */

export interface DeclarationResult {
  declaration: Declaration;
  rendered_text: string;
  usage: { input_tokens: number; output_tokens: number };
}

export interface DraftDeclarationInputs {
  caseFacts: CaseFacts;
  declarant: DeclarantRole;
  /** Optional name override when the schema can't infer it from facts. */
  declarant_full_name?: string;
}

/**
 * Render a Declaration into the canonical text shape for export to PDF
 * or markdown. Joins paragraphs with blank lines; trailing signature
 * block separated by an em-rule.
 */
export function renderDeclarationText(d: Declaration): string {
  const parts: string[] = [];
  parts.push(d.identity_paragraph.trim());
  for (const p of d.substance_paragraphs) {
    parts.push(p.trim());
  }
  parts.push(d.verification_paragraph.trim());
  parts.push(`\nExecuted on ${d.date_signed_placeholder}.\n`);
  parts.push('—'.repeat(40));
  parts.push(d.signature_block_placeholder);
  return parts.join('\n\n');
}

export async function draftDeclaration(
  inputs: DraftDeclarationInputs,
): Promise<DeclarationResult> {
  if (inputs.caseFacts.case_type !== 'E2') {
    throw new Error(
      `draftDeclaration is wired for E-2 only; got ${inputs.caseFacts.case_type}`,
    );
  }

  const factsJson = JSON.stringify(inputs.caseFacts.facts, null, 2);
  const factsBlock = `## Extracted facts (each value carries source_page, source_quote, confidence)\n\n\`\`\`json\n${factsJson}\n\`\`\``;
  const userMessage = `Draft the ${inputs.declarant.replace('_', ' ')} declaration using the facts in the system context. Declarant role: ${inputs.declarant}.${
    inputs.declarant_full_name
      ? ` Use "${inputs.declarant_full_name}" as the declarant's full name when the facts do not name them explicitly.`
      : ''
  }`;

  const response = await getAnthropic().messages.parse({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    output_config: {
      effort: 'high',
      format: DECLARATION_FORMAT,
    },
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPTS[inputs.declarant],
        cache_control: { type: 'ephemeral', ttl: '1h' },
      },
      {
        type: 'text',
        text: factsBlock,
        cache_control: { type: 'ephemeral', ttl: '5m' },
      },
    ],
    messages: [{ role: 'user', content: userMessage }],
  });

  if (!response.parsed_output) {
    throw new Error('Declaration response did not match the declaration schema');
  }

  logAnthropicUsage({
    stage: 'draft',
    model: 'claude-sonnet-4-6',
    case_type: inputs.caseFacts.case_type,
    usage: response.usage,
  });

  return {
    declaration: response.parsed_output,
    rendered_text: renderDeclarationText(response.parsed_output),
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}
