/**
 * Payroll extractor — second pass after the typed-extract.ts classifier.
 *
 * Runs a single Haiku 4.5 call dedicated to payroll-rich extraction:
 * classifies into one of five payroll subtypes and fills the matching
 * variant of PayrollFactsSchema. Called from classifyAndExtractOnePdf
 * when the first-pass classifier returns payroll_doc.
 *
 * Mirrors the contract / bank-receipt extractor pattern: pre-extracted
 * PDF text in, PayrollExtractResult out. Manual JSON parse + Zod validate
 * (the discriminated union exceeds Anthropic's structured-output cap).
 */

import { getAnthropic } from '@/lib/anthropic';
import { logAnthropicUsage } from '@/lib/usage-log';
import {
  PayrollFactsSchema,
  type PayrollFacts,
} from './payroll.schema';

function extractFirstJsonObject(text: string): string {
  const start = text.indexOf('{');
  if (start < 0) throw new Error('No JSON object found in response');
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === '\\') {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error('Unterminated JSON object in response');
}

const SYSTEM_PROMPT = `You are an immigration paralegal performing per-document payroll extraction on a single PDF from an E-2 Treaty Investor case folder. The extracted facts feed a typed memory the case-level aggregator will use to evaluate marginality (manual §9 / 9 FAM 402.9-6(D)).

Your job is two-fold:

1. CLASSIFY the document into exactly ONE payroll_subtype:

   - payroll_register — a period-by-period register listing each employee on a row with a gross-pay figure for the period. Typical sources: ADP, Gusto, Paychex, QuickBooks Payroll. Distinct from a W-2 summary because rows are PER PAY PERIOD, not per year.

   - w2_summary — annual W-2 aggregate (Form W-3 transmittal, employer's W-2 totals, or a payroll-vendor year-end summary) showing total wages reported and total employee count for a single tax year.

   - form_941 — IRS Form 941 (Quarterly Federal Tax Return). Each quarter is one document. Confirms total wages and total employees as reported to the IRS.

   - employee_list — bare roster (HR census, employee handbook attachment) without dollar figures. Lower probative value but useful when no register is available.

   - other_payroll — anything that does not match the above (state-filed forms, partial stubs, fragmentary documents). Use sparingly with a one-line summary.

2. EXTRACT the subtype-specific fields per the schema for the chosen payroll_subtype. Only the schema variant matching your chosen payroll_subtype is valid in your JSON output.

Subtype-specific guidance:

payroll_register:
- pay_period_start / pay_period_end: ISO YYYY-MM-DD bounds of the pay period the register covers. Some registers print a single "pay date" — use that as pay_period_end and leave pay_period_start null if no start date is shown.
- employee_rows: ONE entry per row in the register. Capture {employee_name, position_title, gross_pay_amount, hours_worked, employment_status}. employment_status rules: 'W2' if a W-2 is implied (regular wage row); '1099' if the row is for a contractor; 'owner_draw' if labeled as an owner draw / member distribution. If unclear, leave value=null.
- total_gross_wages_amount + currency: arithmetic sum across rows (USD for US payrolls). Capture verbatim if printed; otherwise leave null and let the aggregator sum from rows.
- employee_count_excluding_beneficiary: distinct employee count, EXCLUDING the Beneficiary if the Beneficiary's name appears among the rows. The Beneficiary is the visa applicant (the person the case is for) — if their identity is not yet established at extract time, count ALL distinct employees and let the aggregator subtract.
- beneficiary_included: true if any row matches the Beneficiary's name. Use lower confidence (~0.5) when uncertain — the aggregator cross-checks against the passport extraction.

w2_summary:
- tax_year: YYYY format (the calendar year the W-2s cover).
- total_wages_reported: aggregate "Wages, tips, other compensation" (Box 1) across all W-2s.
- employee_count: number of W-2s issued.
- employer_ein: 9-digit EIN; capture in NN-NNNNNNN format if printed that way.

form_941:
- quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4' based on the period the 941 covers.
- year: YYYY.
- total_wages: line 2 ("Wages, tips, and other compensation").
- total_employees: line 1 ("Number of employees who received wages").

employee_list:
- list_date: the date as-of the roster.
- employee_rows: same shape as payroll_register but with gross_pay_amount and hours_worked likely null.
- employee_count_excluding_beneficiary + beneficiary_included: same rules as payroll_register.

other_payroll:
- one_line_summary: what the document is and why it might matter to a marginality analysis.

Provenance rules — non-negotiable on every leaf field:
- NEVER invent. If a field is not present in this document, return value=null AND source_page=null AND source_quote=null AND confidence=null.
- source_page is the 1-indexed page number from the [page N] markers in the input.
- source_quote is a short verbatim phrase (5–25 words) copied from the source that contains or directly evidences the value.
- confidence is in [0, 1]: 1.0 = explicit and unambiguous; ~0.7 = clear in context; ~0.5 = ambiguous; do not emit values below 0.3.
- Currency: amounts as numbers with symbols/commas stripped; ISO-4217 currency code captured separately. NEVER convert to USD here.
- Dates: prefer ISO YYYY-MM-DD; if format ambiguous (MM/DD vs DD/MM), leave value=null.
- SSNs and full account numbers MUST NOT appear in your output. Strip on extract. EINs are fine to capture (they are not PII to redact in this pipeline).

Edge cases:
- A single PDF that contains multiple distinct payroll documents (register + 941 in one bundle) should be classified by its PRIMARY purpose. If a register dominates, treat as payroll_register; if quarterly forms dominate, treat as form_941.
- If a row in a payroll_register has unparseable amount or hours, include the row with the legible fields populated and leave the others null at row level.
- If the document is partially OCR-garbled, extract what is legible; leave noisy fields null.

Output: ONE JSON object matching the payroll_subtype-discriminated PayrollFacts schema. No prose, no commentary, no markdown fences.`;

export interface PayrollExtractInput {
  filename: string;
  text: string;
  pageCount: number;
}

export interface PayrollExtractResult {
  filename: string;
  pageCount: number;
  facts?: PayrollFacts;
  error?: { code: string; message: string };
}

const MAX_TEXT_CHARS = 60_000;

export async function extractPayroll(
  input: PayrollExtractInput,
): Promise<PayrollExtractResult> {
  const text =
    input.text.length > MAX_TEXT_CHARS
      ? input.text.slice(0, MAX_TEXT_CHARS) + '\n[…truncated…]'
      : input.text;

  const userMessage = `## Filename\n${input.filename}\n\n## Document text (pages delimited by [page N] markers)\n\n${text}\n\nRespond with ONLY a single JSON object matching the payroll_subtype-discriminated PayrollFacts schema. No prose, no markdown fences.`;

  // The 5-variant union with EmployeeRowSchema sub-objects has ~40
  // nullable Field<> params — over Anthropic's structured-output
  // union-param cap (16). Use manual JSON parse + Zod validate.
  let response;
  try {
    response = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4000,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral', ttl: '1h' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    });
  } catch (e: unknown) {
    return {
      filename: input.filename,
      pageCount: input.pageCount,
      error: {
        code: 'payroll_extract_failed',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }

  let jsonText = '';
  for (const block of response.content) {
    if (block.type === 'text') jsonText += block.text;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(extractFirstJsonObject(jsonText));
  } catch (e: unknown) {
    return {
      filename: input.filename,
      pageCount: input.pageCount,
      error: {
        code: 'json_parse_failed',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }

  const validated = PayrollFactsSchema.safeParse(raw);
  if (!validated.success) {
    return {
      filename: input.filename,
      pageCount: input.pageCount,
      error: {
        code: 'schema_mismatch',
        message: validated.error.message.slice(0, 500),
      },
    };
  }

  logAnthropicUsage({
    stage: 'extract',
    model: 'claude-haiku-4-5',
    case_type: 'E2',
    usage: response.usage,
  });

  return {
    filename: input.filename,
    pageCount: input.pageCount,
    facts: validated.data as PayrollFacts,
  };
}
