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
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  // Trigger async indexing job (returns immediately)
  // In production, this would enqueue a worker job
  const indexed = { sourceTypes: body.data.sourceTypes, status: "queued", forceReindex: body.data.forceReindex };

  return Response.json({ data: indexed }, { status: 202 });
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
