import { db, processSimulationResult } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/processes/:id/simulation/results/:runId
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; runId: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { runId } = await params;

  const [result] = await db
    .select()
    .from(processSimulationResult)
    .where(and(eq(processSimulationResult.id, runId), eq(processSimulationResult.orgId, ctx.orgId)));

  if (!result) {
    return Response.json({ error: "Result not found" }, { status: 404 });
  }

  return Response.json({ data: result });
}
