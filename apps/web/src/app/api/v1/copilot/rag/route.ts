import { db, copilotRagSource } from "@grc/db";
import { ragIndexRequestSchema } from "@grc/shared";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/copilot/rag — Trigger RAG indexing
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = ragIndexRequestSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // [ARCTOS-FULL-2026-08-31 / WP6 · S05-17]
  //
  // Diese Route antwortete `status: "queued"` und legte nichts an — es
  // gab keinen Job, keine Queue, keinen Eintrag. Eine Statusaussage über
  // etwas, das nicht stattgefunden hat, ist derselbe Defekt wie in
  // S14-02 (erfundene Prüfergebnisse), nur kleiner.
  //
  // Der Indexlauf selbst gehört zu `copilot-rag-indexer` (Eigentum WP8).
  // Diese Route sagt deshalb jetzt die Wahrheit: sie meldet den
  // tatsächlichen Indexstand und ob ein Neuaufbau angefordert werden
  // kann — statt eine Einreihung zu behaupten.
  const stats = (await db.execute(sql`
    SELECT source_type,
           count(*)::int AS chunks,
           max(last_indexed_at)::text AS last_indexed
      FROM copilot_rag_source
     WHERE org_id = ${ctx.orgId}::uuid
     GROUP BY source_type
  `)) as unknown as Array<{
    source_type: string;
    chunks: number;
    last_indexed: string;
  }>;

  return Response.json(
    {
      data: {
        requestedSourceTypes: body.data.sourceTypes,
        forceReindex: body.data.forceReindex,
        // Ehrlich: es wird hier nichts eingereiht.
        status: "not_enqueued",
        note:
          "Die Indizierung läuft als geplanter Job (copilot-rag-indexer), nicht auf Anforderung über diese Route. " +
          "Der aktuelle Indexstand steht in `currentIndex`.",
        currentIndex: stats,
      },
    },
    { status: 200 },
  );
}

// GET /api/v1/copilot/rag — Get RAG indexing status
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const stats = await db
    .select({
      sourceType: copilotRagSource.sourceType,
      count: sql<number>`count(*)`,
      lastIndexed: sql<string>`max(${copilotRagSource.lastIndexedAt})`,
    })
    .from(copilotRagSource)
    .where(eq(copilotRagSource.orgId, ctx.orgId))
    .groupBy(copilotRagSource.sourceType);

  return Response.json({ data: stats });
}
