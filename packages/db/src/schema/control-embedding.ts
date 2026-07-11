// control_embedding — derived pgvector embeddings for AI suggest-controls
// semantic candidate ranking (migration 0377).
//
// Bestand note (2026-07-11): the only prior "embedding" storage is
// copilot_rag_source.embedding (JSONB, never populated, no vector index) —
// there was NO existing pgvector column pattern to copy. This table is the
// first real pgvector usage: fixed vector(1536) sized for OpenAI
// text-embedding-3-small; smaller models (Ollama nomic-embed-text = 768)
// are zero-padded by @grc/ai generateEmbedding. Vectors are only compared
// within the same `model` value — queries filter on it.
//
// Lifecycle: rows are written exclusively by the control-embedding-sync
// worker cron (batch ≤ 50/run). Invalidation via content_hash = SHA-256
// over the canonical control text (@grc/shared controlEmbeddingContentHash;
// the SQL-side twin lives in the cron's candidate filter).
//
// Not modeled here (Drizzle cannot express them) — see migration 0377:
//   - HNSW cosine index: USING hnsw (embedding vector_cosine_ops)
//   - RLS ENABLE + FORCE + policy
//   - audit_trigger registration (copilot_rag_source has one too; we keep
//     rule 5 "audit everything" even though embeddings are derived data —
//     write volume is bounded by the batch limit + hash invalidation)

import {
  customType,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { organization } from "./platform";
import { control } from "./control";

/** Fixed storage dimension — must match @grc/ai EMBEDDING_VECTOR_DIMENSION. */
export const CONTROL_EMBEDDING_DIMENSION = 1536;

// drizzle-orm 0.45 has no first-class pgvector type; pgvector's text
// representation is '[0.1,0.2,...]' which is valid JSON.
const vector1536 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return `vector(${CONTROL_EMBEDDING_DIMENSION})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value) as number[];
  },
});

export const controlEmbedding = pgTable(
  "control_embedding",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organization.id),
    controlId: uuid("control_id")
      .notNull()
      .references(() => control.id, { onDelete: "cascade" }),
    embedding: vector1536("embedding").notNull(),
    // SHA-256 over `${title}\n${description}` — invalidation anchor.
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    // Embedding model the vector came from; similarity queries filter on it.
    model: varchar("model", { length: 100 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // One embedding per control — the sync cron upserts on this.
    uniqueIndex("ctrl_emb_control_uniq").on(table.controlId),
    index("ctrl_emb_org_model_idx").on(table.orgId, table.model),
    // ctrl_emb_hnsw_cosine_idx (USING hnsw ... vector_cosine_ops) lives in
    // migration 0377 — see header comment.
  ],
);
