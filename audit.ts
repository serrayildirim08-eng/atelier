/**
 * Langfuse audit hook — fetch-based, no SDK dependency.
 *
 * Sends a "generation" observation per Anthropic call to a self-hosted
 * Langfuse v3 instance. Configured via env: LANGFUSE_HOST,
 * LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY. If any is missing, the
 * function is a silent no-op — the pipeline doesn't depend on Langfuse
 * being reachable. Iteration 5 of the /loop priority list (Compliance
 * triple); audit log is the substrate every other compliance gate
 * reduces to ("show me the log").
 *
 * Tier-0 implementation: per-call generation only. Trace grouping
 * (one trace per case folder spanning detect → extract → draft → review)
 * is a follow-up — pass a trace_id through the call chain when ready.
 */

import type { AnthropicUsageLike, UsageStage } from './usage-log';

interface LangfuseConfig {
  host: string;
  publicKey: string;
  secretKey: string;
}

function readConfig(): LangfuseConfig | null {
  const host = process.env.LANGFUSE_HOST;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  if (!host || !publicKey || !secretKey) return null;
  return { host: host.replace(/\/$/, ''), publicKey, secretKey };
}

function basicAuth(cfg: LangfuseConfig): string {
  const token = Buffer.from(`${cfg.publicKey}:${cfg.secretKey}`).toString('base64');
  return `Basic ${token}`;
}

export interface AuditGenerationInput {
  stage: UsageStage;
  model: string;
  case_type?: string;
  usage: AnthropicUsageLike;
  estimated_cost_usd?: number | null;
}

/**
 * Fire-and-forget audit observation. Non-blocking, never throws.
 * Real signal value when LANGFUSE_HOST is reachable; silent no-op
 * when env vars are absent.
 */
export function recordGeneration(input: AuditGenerationInput): void {
  const cfg = readConfig();
  if (!cfg) return;

  const now = new Date().toISOString();
  const id = `atelier-${input.stage}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const event = {
    batch: [
      {
        id,
        type: 'generation-create',
        timestamp: now,
        body: {
          id,
          name: `atelier-${input.stage}`,
          startTime: now,
          endTime: now,
          model: input.model,
          modelParameters: {
            stage: input.stage,
            case_type: input.case_type ?? null,
          },
          metadata: {
            stage: input.stage,
            case_type: input.case_type ?? null,
            estimated_cost_usd: input.estimated_cost_usd ?? null,
          },
          usage: {
            input: input.usage.input_tokens,
            output: input.usage.output_tokens,
            total: input.usage.input_tokens + input.usage.output_tokens,
            unit: 'TOKENS',
          },
          usageDetails: {
            input: input.usage.input_tokens,
            output: input.usage.output_tokens,
            cache_creation_input_tokens:
              input.usage.cache_creation_input_tokens ?? 0,
            cache_read_input_tokens: input.usage.cache_read_input_tokens ?? 0,
          },
        },
      },
    ],
  };

  fetch(`${cfg.host}/api/public/ingestion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuth(cfg),
    },
    body: JSON.stringify(event),
    // Best-effort; don't bog down the request path.
    signal: AbortSignal.timeout(2000),
  }).catch((e: unknown) => {
    console.warn(
      '[audit] Langfuse ingestion failed:',
      e instanceof Error ? e.message : String(e),
    );
  });
}
