// Cron Job: Control Embedding Sync (companion to migration 0377)
//
// Keeps `control_embedding` in sync with the org's controls so that
// POST /api/v1/ai/suggest-controls can rank candidate controls by
// pgvector cosine similarity instead of the token-overlap heuristic.
//
//   - Candidates: controls without an embedding row, with a vector from
//     a different embedding model, or whose title/description changed
//     since the embedding was computed (content_hash mismatch — the
//     SQL-side hash below is the exact twin of
//     @grc/shared controlEmbeddingContentHash).
//   - Batch: max 50 controls per run — embedding calls are the cost
//     driver; the cron converges over multiple runs.
//   - No provider configured (no OPENAI_API_KEY / OLLAMA_BASE_URL):
//     skip cleanly with a log line, never throw. suggest-controls then
//     keeps using its token-overlap fallback.

import { db, control, controlEmbedding } from "@grc/db";
import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import { generateEmbedding, getEmbeddingProvider } from "@grc/ai";
import {
  controlEmbeddingContentHash,
  controlEmbeddingText,
} from "@grc/shared";
import { withCronInstrumentation } from "../lib/cron-instrument";

const BATCH_LIMIT = 50;

interface ControlEmbeddingSyncResult {
  skipped: boolean;
  candidates: number;
  processed: number;
  errors: number;
  model?: string;
}

export const processControlEmbeddingSync = withCronInstrumentation(
  "control-embedding-sync",
  async (): Promise<ControlEmbeddingSyncResult> => {
    const provider = getEmbeddingProvider();
    if (!provider) {
      console.log(
        "[control-embedding-sync] no embedding provider configured (OPENAI_API_KEY or OLLAMA_BASE_URL) — skipping run",
      );
      return { skipped: true, candidates: 0, processed: 0, errors: 0 };
    }

    // SQL twin of @grc/shared controlEmbeddingContentHash — keep in sync.
    const contentHashSql = sql`encode(digest(coalesce(${control.title}, '') || E'\n' || coalesce(${control.description}, ''), 'sha256'), 'hex')`;

    let candidates: Array<{
      id: string;
      orgId: string;
      title: string;
      description: string | null;
    }>;
    try {
      candidates = await db
        .select({
          id: control.id,
          orgId: control.orgId,
          title: control.title,
          description: control.description,
        })
        .from(control)
        .leftJoin(controlEmbedding, eq(controlEmbedding.controlId, control.id))
        .where(
          and(
            isNull(control.deletedAt),
            or(
              isNull(controlEmbedding.id),
              ne(controlEmbedding.model, provider.model),
              sql`${controlEmbedding.contentHash} <> ${contentHashSql}`,
            ),
          ),
        )
        .limit(BATCH_LIMIT);
    } catch (err) {
      // control_embedding does not exist yet: migration 0377 no-ops until
      // pgvector is installed on the DB server. Skip instead of failing.
      console.log(
        "[control-embedding-sync] candidate query failed (control_embedding missing? pgvector not installed?) — skipping run:",
        err instanceof Error ? err.message : String(err),
      );
      return { skipped: true, candidates: 0, processed: 0, errors: 0 };
    }

    let processed = 0;
    let errors = 0;

    for (const c of candidates) {
      try {
        const vector = await generateEmbedding(
          controlEmbeddingText(c.title, c.description),
          provider,
        );
        const contentHash = controlEmbeddingContentHash(
          c.title,
          c.description,
        );
        const now = new Date();
        await db
          .insert(controlEmbedding)
          .values({
            orgId: c.orgId,
            controlId: c.id,
            embedding: vector,
            contentHash,
            model: provider.model,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: controlEmbedding.controlId,
            set: {
              embedding: vector,
              contentHash,
              model: provider.model,
              updatedAt: now,
            },
          });
        processed++;
      } catch (err) {
        errors++;
        if (errors >= 3 && processed === 0) {
          // Provider is evidently down — abort instead of burning the
          // whole batch on failing calls; the next run retries.
          console.error(
            "[control-embedding-sync] aborting after 3 consecutive failures:",
            err instanceof Error ? err.message : String(err),
          );
          break;
        }
      }
    }

    return {
      skipped: false,
      candidates: candidates.length,
      processed,
      errors,
      model: provider.model,
    };
  },
);
