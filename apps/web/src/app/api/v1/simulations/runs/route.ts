import { db, simulationRun, scenarioEngineScenario } from "@grc/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { startSimulationRunSchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(req: Request) {
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
});
export const POST = withErrorHandler(async function POST(req: Request) {
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
});
