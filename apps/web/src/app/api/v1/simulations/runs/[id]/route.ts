import { db, simulationRun, simulationRunResult } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const [run] = await db.select().from(simulationRun)
    .where(and(eq(simulationRun.id, id), eq(simulationRun.orgId, ctx.orgId)));
  if (!run) return Response.json({ error: "Not found" }, { status: 404 });

  const results = await db.select().from(simulationRunResult)
    .where(eq(simulationRunResult.runId, id));

  return Response.json({ data: { ...run, results } });
}
