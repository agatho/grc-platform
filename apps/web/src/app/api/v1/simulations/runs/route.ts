import { db, simulationRun, scenarioEngineScenario } from "@grc/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { startSimulationRunSchema } from "@grc/shared";

export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const url = new URL(req.url);
  const scenarioId = url.searchParams.get("scenarioId");
  if (!scenarioId)
    return Response.json({ error: "scenarioId is required" }, { status: 400 });

  const rows = await db
    .select()
    .from(simulationRun)
    .where(
      and(
        eq(simulationRun.scenarioId, scenarioId),
        eq(simulationRun.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(simulationRun.createdAt));

  return Response.json({ data: rows });
}

export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = startSimulationRunSchema.parse(await req.json());

  // Get run number
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(simulationRun)
    .where(eq(simulationRun.scenarioId, body.scenarioId));

  const result = await withAuditContext(ctx, async (tx) => {
    // Update scenario status
    await tx
      .update(scenarioEngineScenario)
      .set({ status: "running", updatedAt: new Date() })
      .where(eq(scenarioEngineScenario.id, body.scenarioId));

    const [created] = await tx
      .insert(simulationRun)
      .values({
        orgId: ctx.orgId,
        scenarioId: body.scenarioId,
        runNumber: count + 1,
        iterations: body.iterations,
        confidenceLevel: String(body.confidenceLevel),
        executedBy: ctx.userId,
        status: "running",
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
