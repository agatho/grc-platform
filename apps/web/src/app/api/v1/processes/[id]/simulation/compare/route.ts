import { db, processSimulationResult } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/processes/:id/simulation/compare?scenarioA=...&scenarioB=...
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const scenarioA = url.searchParams.get("scenarioA");
  const scenarioB = url.searchParams.get("scenarioB");

  if (!scenarioA || !scenarioB) {
    return Response.json({ error: "scenarioA and scenarioB query params required" }, { status: 422 });
  }

  const [resultA] = await db
    .select()
    .from(processSimulationResult)
    .where(and(eq(processSimulationResult.scenarioId, scenarioA), eq(processSimulationResult.orgId, ctx.orgId)))
    .orderBy(processSimulationResult.executedAt)
    .limit(1);

  const [resultB] = await db
    .select()
    .from(processSimulationResult)
    .where(and(eq(processSimulationResult.scenarioId, scenarioB), eq(processSimulationResult.orgId, ctx.orgId)))
    .orderBy(processSimulationResult.executedAt)
    .limit(1);

  if (!resultA || !resultB) {
    return Response.json({ error: "One or both scenarios have no results" }, { status: 404 });
  }

  const comparison = {
    scenarioA: resultA,
    scenarioB: resultB,
    delta: {
      avgCycleTime: parseFloat(resultB.avgCycleTime as string) - parseFloat(resultA.avgCycleTime as string),
      p95CycleTime: parseFloat(resultB.p95CycleTime as string) - parseFloat(resultA.p95CycleTime as string),
      avgCost: parseFloat(resultB.avgCost as string) - parseFloat(resultA.avgCost as string),
      avgCycleTimePct: resultA.avgCycleTime
        ? ((parseFloat(resultB.avgCycleTime as string) - parseFloat(resultA.avgCycleTime as string)) / parseFloat(resultA.avgCycleTime as string)) * 100
        : 0,
    },
  };

  return Response.json({ data: comparison });
}
