// Embedding generation (companion to the completion router, ADR-008).
//
// Bestand note (2026-07-11): the Copilot RAG table `copilot_rag_source`
// (migration 0189) has an `embedding JSONB` column, but nothing in the
// codebase ever populated it and @grc/ai had no embedding call — the
// existing test mocks (`generateEmbedding` → [0,0,0] in the route smoke
// suites and the worker db-proxy helper) described an intended surface
// that was never implemented. This module implements that surface.
//
// Providers: of the configured completion providers only OpenAI and
// Ollama expose embedding endpoints here (Claude CLI/API and Gemini are
// completion-only in this codebase). Selection mirrors router.ts:
// explicit env override first (EMBEDDING_PROVIDER / EMBEDDING_MODEL),
// then first available by API-key/base-URL presence.
//
// Storage contract: `control_embedding.embedding` is vector(1536)
// (EMBEDDING_VECTOR_DIMENSION — sized for OpenAI text-embedding-3-small).
// Models with fewer dimensions (e.g. Ollama nomic-embed-text = 768) are
// zero-padded: zero-padding does not change cosine similarity between
// vectors of the same model, and vectors are only ever compared within
// the same stored `model` value (queries filter on it).

import OpenAI from "openai";

/** Fixed pgvector storage dimension (see migration 0377). */
export const EMBEDDING_VECTOR_DIMENSION = 1536;

export type EmbeddingProvider = "openai" | "ollama";

export interface EmbeddingProviderInfo {
  provider: EmbeddingProvider;
  /** Stored alongside each vector — similarity queries filter on it. */
  model: string;
}

const DEFAULT_EMBEDDING_MODELS: Record<EmbeddingProvider, string> = {
  openai: "text-embedding-3-small", // 1536 dimensions
  ollama: "nomic-embed-text", // 768 dimensions → zero-padded
};

function isProviderConfigured(provider: EmbeddingProvider): boolean {
  if (provider === "openai") return Boolean(process.env.OPENAI_API_KEY);
  return Boolean(
    process.env.OLLAMA_BASE_URL || process.env.OLLAMA_ENABLED === "true",
  );
}

/**
 * Resolve the active embedding provider, or null when none is
 * configured (callers must skip embedding paths cleanly in that case).
 */
export function getEmbeddingProvider(): EmbeddingProviderInfo | null {
  const explicit = process.env.EMBEDDING_PROVIDER as
    | EmbeddingProvider
    | undefined;
  if (explicit === "openai" || explicit === "ollama") {
    if (!isProviderConfigured(explicit)) return null;
    return {
      provider: explicit,
      model: process.env.EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODELS[explicit],
    };
  }
  for (const provider of ["openai", "ollama"] as const) {
    if (isProviderConfigured(provider)) {
      return {
        provider,
        model:
          process.env.EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODELS[provider],
      };
    }
  }
  return null;
}

/**
 * Zero-pad a raw model vector to the fixed storage dimension.
 * Exported for tests. Throws when the model emits more dimensions than
 * the column can hold (e.g. text-embedding-3-large = 3072) — that is a
 * configuration error, not a runtime condition to paper over.
 */
export function padToStorageDimension(
  vector: number[],
  dimension: number = EMBEDDING_VECTOR_DIMENSION,
): number[] {
  if (vector.length > dimension) {
    throw new Error(
      `Embedding has ${vector.length} dimensions but storage is vector(${dimension}) — use a smaller embedding model`,
    );
  }
  if (vector.length === dimension) return vector;
  return [...vector, ...new Array<number>(dimension - vector.length).fill(0)];
}

async function embedOpenAI(text: string, model: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const client = new OpenAI({ apiKey });
  const response = await client.embeddings.create({ model, input: text });
  const vector = response.data[0]?.embedding;
  if (!vector || vector.length === 0) {
    throw new Error("OpenAI returned an empty embedding");
  }
  return vector;
}

async function embedOllama(text: string, model: string): Promise<number[]> {
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
  const response = await fetch(`${baseUrl}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: text }),
  });
  if (!response.ok) {
    const err = await response.text().catch(() => "Unknown error");
    throw new Error(`Ollama embeddings error (${response.status}): ${err}`);
  }
  const data = (await response.json()) as { embedding?: number[] };
  if (!data.embedding || data.embedding.length === 0) {
    throw new Error("Ollama returned an empty embedding");
  }
  return data.embedding;
}

/**
 * Generate an embedding for `text`, zero-padded to
 * EMBEDDING_VECTOR_DIMENSION. Pass `info` (from getEmbeddingProvider())
 * to pin provider + model across a batch; otherwise it is resolved per
 * call. Throws when no provider is configured.
 */
export async function generateEmbedding(
  text: string,
  info?: EmbeddingProviderInfo,
): Promise<number[]> {
  const target = info ?? getEmbeddingProvider();
  if (!target) {
    throw new Error(
      "No embedding provider configured (set OPENAI_API_KEY or OLLAMA_BASE_URL)",
    );
  }
  const raw =
    target.provider === "openai"
      ? await embedOpenAI(text, target.model)
      : await embedOllama(text, target.model);
  return padToStorageDimension(raw);
}
