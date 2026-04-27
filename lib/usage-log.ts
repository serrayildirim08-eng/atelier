import { appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const COST_LOG_PATH = process.env.COST_LOG_PATH ?? 'db/cost.jsonl';

interface ModelPricing {
  in_per_mtok: number;
  out_per_mtok: number;
  cache_create_1h_per_mtok: number;
  cache_read_per_mtok: number;
}

// Per-million-token rates (USD), as of 2026-04-27.
// Cache-create rate is the 1h-TTL rate (2× base input). The pipeline pins
// ttl: '1h' on every cache_control breakpoint (Iteration 1).
// Source: ~/.claude/projects/-Users-serrayildirim/memory/reference_legal_ai_landscape_2026.md
const PRICING: Record<string, ModelPricing> = {
  'claude-opus-4-7': {
    in_per_mtok: 5,
    out_per_mtok: 25,
    cache_create_1h_per_mtok: 10,
    cache_read_per_mtok: 0.5,
  },
  'claude-opus-4-6': {
    in_per_mtok: 5,
    out_per_mtok: 25,
    cache_create_1h_per_mtok: 10,
    cache_read_per_mtok: 0.5,
  },
  'claude-sonnet-4-6': {
    in_per_mtok: 3,
    out_per_mtok: 15,
    cache_create_1h_per_mtok: 6,
    cache_read_per_mtok: 0.3,
  },
  'claude-sonnet-4-5': {
    in_per_mtok: 3,
    out_per_mtok: 15,
    cache_create_1h_per_mtok: 6,
    cache_read_per_mtok: 0.3,
  },
  'claude-haiku-4-5': {
    in_per_mtok: 1,
    out_per_mtok: 5,
    cache_create_1h_per_mtok: 2,
    cache_read_per_mtok: 0.1,
  },
};

export type UsageStage = 'detect' | 'extract' | 'draft' | 'review';

export interface AnthropicUsageLike {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export interface UsageLogRow {
  timestamp: string;
  stage: UsageStage;
  model: string;
  case_type?: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  estimated_cost_usd: number | null;
}

export function logAnthropicUsage(args: {
  stage: UsageStage;
  model: string;
  case_type?: string;
  usage: AnthropicUsageLike;
}): void {
  const pricing = PRICING[args.model];
  const cache_create = args.usage.cache_creation_input_tokens ?? 0;
  const cache_read = args.usage.cache_read_input_tokens ?? 0;

  const cost_usd = pricing
    ? (args.usage.input_tokens / 1e6) * pricing.in_per_mtok +
      (args.usage.output_tokens / 1e6) * pricing.out_per_mtok +
      (cache_create / 1e6) * pricing.cache_create_1h_per_mtok +
      (cache_read / 1e6) * pricing.cache_read_per_mtok
    : null;

  const row: UsageLogRow = {
    timestamp: new Date().toISOString(),
    stage: args.stage,
    model: args.model,
    case_type: args.case_type,
    input_tokens: args.usage.input_tokens,
    output_tokens: args.usage.output_tokens,
    cache_creation_input_tokens: cache_create,
    cache_read_input_tokens: cache_read,
    estimated_cost_usd: cost_usd,
  };

  try {
    const dir = dirname(COST_LOG_PATH);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    appendFileSync(COST_LOG_PATH, JSON.stringify(row) + '\n');
  } catch (e) {
    // Telemetry must never block a real request.
    console.warn(
      '[usage-log] write failed:',
      e instanceof Error ? e.message : String(e),
    );
  }
}
