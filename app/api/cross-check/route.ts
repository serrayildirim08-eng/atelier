/**
 * POST /api/cross-check
 *
 * Cross-checks free-text correspondence (email thread, Copilot
 * summary, attorney-client notes, intake call transcript) against the
 * structured CaseFacts already extracted from the matter's PDFs. The
 * model returns a list of inconsistencies, missing details, and
 * contradictions — same severity scale as the reviewer flags.
 *
 * Body:
 *   { case_facts: CaseFacts, context_text: string, source?: 'email' | 'note' }
 *
 * Response:
 *   { findings: CrossCheckFinding[], usage: { input_tokens, output_tokens } }
 */

import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import type { CaseFacts } from '@/ingest/schema';

export const runtime = 'nodejs';
export const maxDuration = 120;

const FindingSchema = z.object({
  severity: z
    .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
    .describe('1 = informational, 5 = blocks filing'),
  finding_type: z
    .enum([
      'contradiction',
      'inconsistency',
      'missing_detail',
      'unverified_claim',
      'date_drift',
      'amount_drift',
      'name_drift',
      'other',
    ])
    .describe('What kind of issue this is.'),
  field_in_facts: z
    .string()
    .nullable()
    .describe('Dotted path into CaseFacts.facts that this finding relates to, or null.'),
  context_quote: z
    .string()
    .describe('Verbatim quote from the pasted context that triggered the finding (≤240 chars).'),
  fact_value: z
    .string()
    .nullable()
    .describe('The corresponding value already in CaseFacts (stringified), or null if absent.'),
  rationale: z
    .string()
    .describe('1–2 sentences. Why this is a finding. Plain English.'),
  suggested_action: z
    .string()
    .nullable()
    .describe('What the attorney should do next. Or null if no action needed.'),
});

const ResponseSchema = z.object({
  findings: z.array(FindingSchema),
  overall_assessment: z.enum(['clean', 'minor_drift', 'material_conflict']),
  one_line_summary: z.string(),
});

const SYSTEM_PROMPT = `You are an immigration paralegal cross-checking a body of free-text correspondence against the structured case facts already extracted from the petitioner's documents.

Your job: find every place where the correspondence and the case facts DISAGREE, where the correspondence reveals a fact the case file is MISSING, or where the correspondence makes a CLAIM that is not yet substantiated by the documents.

Output ONE JSON object matching the schema. No prose outside the schema fields.

Severity scale:
  1 = trivia (typo, paraphrase difference)
  2 = minor drift (rounding, abbreviation, time-zone)
  3 = needs attorney attention (date off by days/weeks, amount off ≤10%)
  4 = material drift (date off by months, amount off >10%, name spelled differently in a way that affects identity)
  5 = blocks filing (named investor mismatch, treaty country mismatch, source-of-funds origin mismatch, USCIS-form-relevant date conflict)

Finding-types:
  - contradiction: docs say X, correspondence says Y, both can't be true
  - inconsistency: phrased differently or with different scope; might or might not be a real conflict
  - missing_detail: correspondence reveals a fact the case file doesn't have
  - unverified_claim: correspondence asserts X but no document supports it
  - date_drift / amount_drift / name_drift: specialized contradictions

Be precise. Quote the correspondence verbatim. Keep rationale to 1–2 sentences. Don't invent context_quote — every quote MUST appear verbatim in the input correspondence text.

If the correspondence is clean against the facts, return an empty findings array and overall_assessment: 'clean'.`;

interface RequestBody {
  case_facts?: unknown;
  context_text?: unknown;
  source?: unknown;
}

function isCaseFacts(v: unknown): v is CaseFacts {
  if (!v || typeof v !== 'object') return false;
  const obj = v as Record<string, unknown>;
  return typeof obj.case_type === 'string' && obj.facts !== undefined;
}

export async function POST(request: Request): Promise<Response> {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isCaseFacts(body.case_facts)) {
    return Response.json({ error: 'Missing or invalid case_facts' }, { status: 400 });
  }
  if (typeof body.context_text !== 'string' || body.context_text.trim().length === 0) {
    return Response.json({ error: 'Missing context_text' }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY is not set' }, { status: 500 });
  }

  const caseFactsJson = JSON.stringify(body.case_facts, null, 2);
  const contextText = body.context_text;
  const source = typeof body.source === 'string' ? body.source : 'note';

  const userMessage = `## Source\n${source}\n\n## Case facts\n\n\`\`\`json\n${caseFactsJson}\n\`\`\`\n\n## Correspondence text to cross-check\n\n${contextText}\n\nReturn the findings JSON.`;

  try {
    const response = await getAnthropic().messages.parse({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral', ttl: '1h' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
      output_config: { format: zodOutputFormat(ResponseSchema) },
    });

    if (!response.parsed_output) {
      return Response.json(
        { error: 'cross_check_unparseable', message: 'Model output did not match schema' },
        { status: 502 },
      );
    }

    logAnthropicUsage({
      stage: 'review',
      model: 'claude-sonnet-4-6',
      case_type: body.case_facts.case_type,
      usage: response.usage,
    });

    return Response.json({
      ...response.parsed_output,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    });
  } catch (e: unknown) {
    return Response.json(
      {
        error: 'cross_check_failed',
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
