// Sprint 67: Copilot RAG Indexer Worker
// Runs every 6 hours — indexes org data for RAG retrieval

import { db, copilotRagSource } from "@grc/db";
import { sql } from "drizzle-orm";

export async function processCopilotRagIndexer(): Promise<{
  orgsProcessed: number;
  sourcesIndexed: number;
}> {
  console.log("[copilot-rag-indexer] Starting RAG indexing cycle");

  // Get all orgs with active copilot usage
  const orgs = await db.execute(
    sql`SELECT DISTINCT org_id FROM copilot_conversation WHERE last_message_at > now() - interval '30 days'`,
  );

  let sourcesIndexed = 0;

  for (const row of orgs) {
    const orgId = (row as Record<string, string>).org_id;
    try {
      // Index risks
      const risks = await db.execute(
        sql`SELECT id, title, description FROM risk WHERE org_id = ${orgId}::uuid LIMIT 1000`,
      );

      for (const risk of risks) {
        const r = risk as Record<string, string>;
        await db
          .insert(copilotRagSource)
          .values({
            orgId,
            sourceType: "risk",
            entityId: r.id,
            title: r.title ?? "Untitled Risk",
            content: `${r.title ?? ""}\n${r.description ?? ""}`,
            lastIndexedAt: new Date(),
          })
          .onConflictDoNothing();
        sourcesIndexed++;
      }

      console.log(
        `[copilot-rag-indexer] Indexed org ${orgId}: ${risks.length} risks`,
      );
    } catch (err) {
      console.error(`[copilot-rag-indexer] Failed for org ${orgId}:`, err);
    }
  }

  console.log(
    `[copilot-rag-indexer] Completed: ${orgs.length} orgs, ${sourcesIndexed} sources`,
  );
  return { orgsProcessed: orgs.length, sourcesIndexed };
}
