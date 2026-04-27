import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { E2FactsSchema, type E2Facts } from './schema';

const SYSTEM_PROMPT = `You are an immigration paralegal extracting facts from a client's E2 visa case folder for Akalan Law Firm.

Hard rules — every output is reviewed by an attorney before filing:
1. NEVER invent values. If the document does not contain a fact, return value=null with source_page=null, source_quote=null, confidence=null.
2. Every populated field MUST include source_page (1-indexed) and source_quote (a short verbatim phrase from the document containing the value).
3. confidence is a number between 0 and 1: 1 = explicit and unambiguous in the source; ~0.6 = inferred from clear context; do not emit values below 0.3.
4. The text is delimited by [page N] markers — use those numbers for source_page.
5. dates and addresses are arrays — include every distinct one you can ground in the source. Empty arrays are fine if none are present.
6. investment_amount is a number in USD with currency symbols and commas stripped (e.g. "$150,000.00" → 150000).`;

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

export interface ExtractionResult {
  facts: E2Facts;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  };
}

export async function extractFactsWithClaude(pdfText: string): Promise<ExtractionResult> {
  const response = await client().messages.parse({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Extract E2 visa fields from the following case document.\n\n---\n${pdfText}\n---`,
      },
    ],
    output_config: {
      format: zodOutputFormat(E2FactsSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error('Claude response did not match the E2 facts schema');
  }

  return {
    facts: response.parsed_output,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens,
    },
  };
}
