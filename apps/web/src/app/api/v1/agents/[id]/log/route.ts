import { db, agentExecutionLog } from "@grc/db";
import { eq, and, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/agents/:id/log — Execution log for agent
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  const logs = await db
    .select()
    .from(agentExecutionLog)
    .where(
      and(eq(agentExecutionLog.agentId, id), eq(agentExecutionLog.orgId, ctx.orgId)),
    )
    .orderBy(desc(agentExecutionLog.executedAt))
    .limit(limit)
    .offset(offset);

  return Response.json({ data: logs });
}
