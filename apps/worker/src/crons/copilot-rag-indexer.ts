// Sprint 67: Copilot RAG Indexer Worker
// Runs every 6 hours — indexes org data for RAG retrieval
//
// ── ARCTOS-FULL-2026-08-31 · WP8 · S07-16 (Medium) ───────────────────
//
// Befund, drei zusammenhängende Defekte:
//
//  1. `SELECT id, title, description FROM risk WHERE org_id = …` ohne
//     `deleted_at IS NULL`. Ein Risiko, das soft-gelöscht wurde, WEIL
//     seine Beschreibung personenbezogene Angaben enthielt, die dort
//     nicht hingehören, landete trotzdem im Index.
//  2. `onConflictDoNothing()`: ein einmal indizierter Datensatz wurde nie
//     aktualisiert. Eine Korrektur der Beschreibung erreichte den Index
//     nie — Art. 5(1)(d), Richtigkeit.
//  3. Es gab keinen Pfad, der `copilot_rag_source` je bereinigt hätte.
//     Der Bestand wächst und niemand räumt ihn ab.
//
// Zur Einordnung, weil es die Schwere bestimmt: `copilot_rag_source`
// wird heute nur aggregiert gelesen (`count`, `max(lastIndexedAt)` je
// `sourceType`), die Inhalte gehen noch an kein Modell, und
// `packages/ai/src/embeddings.ts` hält fest, dass die `embedding`-Spalte
// nie befüllt wurde. Der Datenbestand entsteht trotzdem — und der Tag,
// an dem jemand die Retrieval-Seite fertigstellt, ist der Tag, an dem
// gelöschte Inhalte an ein Modell gehen.
//
// Gegenprobe aus dem Bericht: `control-embedding-sync.ts` filtert
// `isNull(control.deletedAt)` korrekt. Der Defekt war spezifisch für
// diesen Indexer, nicht systemweit.

import { db, copilotRagSource } from "@grc/db";
import { sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface IndexerResult {
  orgsProcessed: number;
  sourcesIndexed: number;
  sourcesUpdated: number;
  sourcesPruned: number;
}

function unwrap<T>(rows: unknown): T[] {
  return (
    Array.isArray(rows) ? rows : ((rows as { rows?: T[] }).rows ?? [])
  ) as T[];
}

export const processCopilotRagIndexer = withCronInstrumentation(
  "copilot-rag-indexer",
  async (): Promise<IndexerResult> => {
    const orgs = unwrap<{ org_id: string }>(
      await db.execute(
        sql`SELECT DISTINCT org_id FROM copilot_conversation
             WHERE last_message_at > now() - interval '30 days'`,
      ),
    );

    let sourcesIndexed = 0;
    let sourcesUpdated = 0;
    let sourcesPruned = 0;
    const errors: string[] = [];

    for (const row of orgs) {
      const orgId = row.org_id;
      try {
        // 1. Bereinigen, BEVOR neu indiziert wird — sonst steht eine
        //    gerade gelöschte Zeile bis zum nächsten Lauf im Index.
        const pruned = unwrap<{ n: number }>(
          await db.execute(
            sql`SELECT public.copilot_rag_prune(${orgId}::uuid) AS n`,
          ),
        );
        sourcesPruned += Number(pruned[0]?.n ?? 0);

        // 2. Indizieren — mit Soft-Delete-Filter.
        const risks = unwrap<{
          id: string;
          title: string | null;
          description: string | null;
        }>(
          await db.execute(
            sql`SELECT id, title, description
                  FROM risk
                 WHERE org_id = ${orgId}::uuid
                   AND deleted_at IS NULL
                 LIMIT 1000`,
          ),
        );

        for (const r of risks) {
          // `onConflictDoUpdate` statt `onConflictDoNothing`: eine
          // Korrektur muss im Index ankommen.
          const res = await db
            .insert(copilotRagSource)
            .values({
              orgId,
              sourceType: "risk",
              entityId: r.id,
              title: r.title ?? "Untitled Risk",
              content: `${r.title ?? ""}\n${r.description ?? ""}`,
              lastIndexedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [
                copilotRagSource.orgId,
                copilotRagSource.sourceType,
                copilotRagSource.entityId,
                copilotRagSource.chunkIndex,
              ],
              set: {
                title: sql`excluded.title`,
                content: sql`excluded.content`,
                lastIndexedAt: new Date(),
              },
            })
            .returning({ id: copilotRagSource.id });
          if (res.length > 0) sourcesIndexed++;
          else sourcesUpdated++;
        }
      } catch (err) {
        // Vorher stand hier ein leerer `catch {}` (S10-11). Ein Org, für
        // das die Bereinigung fehlschlägt, behält gelöschte Inhalte im
        // Index — das darf nicht unbemerkt bleiben.
        errors.push(
          `${orgId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `copilot-rag-indexer: ${errors.length} org(s) failed — ${errors.join("; ")}`,
      );
    }

    return {
      orgsProcessed: orgs.length,
      sourcesIndexed,
      sourcesUpdated,
      sourcesPruned,
    };
  },
);
