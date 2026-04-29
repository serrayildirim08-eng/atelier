/**
 * Embeddings client with two providers:
 *
 *   1. OpenAI `text-embedding-3-large` truncated to 1024 dims (default
 *      when OPENAI_API_KEY is set). Best quality on legal text and
 *      cheap; symmetric (same vector for document and query).
 *
 *   2. Local transformers.js using `Xenova/bge-small-en-v1.5` (384
 *      dims). Falls back here when OPENAI_API_KEY is missing — runs
 *      entirely offline, weights cached at first use (~130MB to
 *      ~/.cache/huggingface). Slightly lower retrieval quality than
 *      OpenAI but no API/key/network dependency. Good enough for the
 *      doctrine corpus (391 chunks).
 *
 * The active provider is recorded in the index meta so the retriever
 * can detect mismatch (e.g., index built with OpenAI, retrieval running
 * locally) and tell the operator to rebuild instead of returning
 * silently-corrupted results.
 */

const OPENAI_MODEL = 'text-embedding-3-large';
const OPENAI_DIM = 1024;
const OPENAI_BATCH_SIZE = 64;
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/embeddings';

const LOCAL_MODEL = 'Xenova/bge-small-en-v1.5';
const LOCAL_DIM = 384;

export interface EmbedBatchOptions {
  inputType: 'document' | 'query';
}

export interface EmbedProvider {
  /** Identifier persisted in the index meta and surfaced in build logs. */
  model: string;
  /** Vector dimensionality. */
  dim: number;
  /** Embed a batch; returns one vector per input in input order. */
  embed(texts: string[], options: EmbedBatchOptions): Promise<number[][]>;
}

let _provider: EmbedProvider | null = null;

export function getEmbedProvider(): EmbedProvider {
  if (_provider) return _provider;
  _provider = process.env.OPENAI_API_KEY ? makeOpenAIProvider() : makeLocalProvider();
  return _provider;
}

/** Force-reset (mostly for tests / mid-build provider switches). */
export function resetEmbedProvider(): void {
  _provider = null;
}

// Aliases so existing callers (the indexer) don't break.
export const EMBED_MODEL = (): string => getEmbedProvider().model;
export const EMBED_DIM = (): number => getEmbedProvider().dim;

export async function embedBatch(
  texts: string[],
  options: EmbedBatchOptions,
): Promise<number[][]> {
  if (texts.length === 0) return [];
  return getEmbedProvider().embed(texts, options);
}

export async function embedOne(
  text: string,
  options: EmbedBatchOptions,
): Promise<number[]> {
  const [v] = await embedBatch([text], options);
  return v;
}

/** L2-normalize a vector; cosine similarity becomes a plain dot product on normalized vectors. */
export function normalize(v: number[]): number[] {
  let sum = 0;
  for (const x of v) sum += x * x;
  const norm = Math.sqrt(sum) || 1;
  return v.map((x) => x / norm);
}

/* --------------------------------------------------------------------- */
/* OpenAI provider                                                        */
/* --------------------------------------------------------------------- */

interface OpenAIEmbedResponse {
  data?: { embedding: number[]; index: number }[];
  error?: { message: string };
}

function makeOpenAIProvider(): EmbedProvider {
  return {
    model: OPENAI_MODEL,
    dim: OPENAI_DIM,
    async embed(texts, _options) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not set; cannot use OpenAI embedder.');
      }
      const out: number[][] = new Array(texts.length);
      for (let i = 0; i < texts.length; i += OPENAI_BATCH_SIZE) {
        const slice = texts.slice(i, i + OPENAI_BATCH_SIZE);
        const response = await fetch(OPENAI_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            input: slice,
            model: OPENAI_MODEL,
            dimensions: OPENAI_DIM,
          }),
        });
        if (!response.ok) {
          const body = await response.text();
          throw new Error(
            `OpenAI embed failed (${response.status} ${response.statusText}): ${body.slice(0, 500)}`,
          );
        }
        const json = (await response.json()) as OpenAIEmbedResponse;
        if (json.error) throw new Error(`OpenAI embed error: ${json.error.message}`);
        for (const item of json.data ?? []) {
          out[i + item.index] = item.embedding;
        }
      }
      for (let i = 0; i < out.length; i++) {
        if (!out[i]) throw new Error(`OpenAI embed: missing embedding at index ${i}`);
      }
      return out;
    },
  };
}

/* --------------------------------------------------------------------- */
/* Local transformers.js provider                                         */
/* --------------------------------------------------------------------- */

type FeatureExtractionFn = (
  texts: string[],
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ data: Float32Array | number[]; dims: number[] }>;

let _localPipelinePromise: Promise<FeatureExtractionFn> | null = null;

async function loadLocalPipeline(): Promise<FeatureExtractionFn> {
  if (_localPipelinePromise) return _localPipelinePromise;
  _localPipelinePromise = (async () => {
    // Dynamic import keeps Next/Turbopack from trying to resolve
    // transformers.js at edge-bundling time. The package is Node-only
    // (uses fs / onnxruntime-node) and only the indexer + drafter
    // (both Node runtime) ever touch it.
    const mod = await import('@huggingface/transformers');
    const pipeline = mod.pipeline as unknown as (
      task: 'feature-extraction',
      model: string,
    ) => Promise<FeatureExtractionFn>;
    return pipeline('feature-extraction', LOCAL_MODEL);
  })();
  return _localPipelinePromise;
}

function makeLocalProvider(): EmbedProvider {
  return {
    model: LOCAL_MODEL,
    dim: LOCAL_DIM,
    async embed(texts, _options) {
      const extract = await loadLocalPipeline();
      const out: number[][] = new Array(texts.length);
      // bge-small inputs cap at 512 tokens — for safety, run one text
      // at a time; the model is small enough that batching gains are
      // marginal on a corpus of a few hundred chunks.
      for (let i = 0; i < texts.length; i++) {
        const result = await extract([texts[i]], { pooling: 'mean', normalize: false });
        const data = Array.from(result.data as Float32Array);
        // dims is [batch, dim]; we passed batch=1, so the whole array is the vector.
        if (data.length !== LOCAL_DIM) {
          throw new Error(
            `Local embed: expected ${LOCAL_DIM} dims, got ${data.length} from ${LOCAL_MODEL}`,
          );
        }
        out[i] = data;
      }
      return out;
    },
  };
}
