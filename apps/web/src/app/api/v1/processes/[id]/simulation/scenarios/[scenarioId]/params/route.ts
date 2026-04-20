import { db, simulationActivityParam, simulationScenario } from "@grc/db";
import { bulkActivityParamsSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// PUT /api/v1/processes/:id/simulation/scenarios/:scenarioId/params — Set activity params
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; scenarioId: string }> },
) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { scenarioId } = await params;
  const body = bulkActivityParamsSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify scenario exists
  const [scenario] = await db
    .select({ id: simulationScenario.id })
    .from(simulationScenario)
    .where(
      and(
        eq(simulationScenario.id, scenarioId),
        eq(simulationScenario.orgId, ctx.orgId),
      ),
    );

  if (!scenario) {
    return Response.json({ error: "Scenario not found" }, { status: 404 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    // Delete existing params and insert new ones
    await tx
      .delete(simulationActivityParam)
      .where(eq(simulationActivityParam.scenarioId, scenarioId));

    const values = body.data.params.map((p) => ({
      scenarioId,
      orgId: ctx.orgId,
      activityId: p.activityId,
      activityName: p.activityName,
      durationMin: p.durationMin.toString(),
      durationMostLikely: p.durationMostLikely.toString(),
      durationMax: p.durationMax.toString(),
      costPerExecution: p.costPerExecution.toString(),
      resourceId: p.resourceId,
      gatewayProbabilities: p.gatewayProbabilities,
    }));

    const inserted = await tx
      .insert(simulationActivityParam)
      .values(values)
      .returning();
    return inserted;
  });

  return Response.json({ data: result });
}

// GET /api/v1/processes/:id/simulation/scenarios/:scenarioId/params
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; scenarioId: string }> },
) {
  const ctx = await withAuth("admin", "process_owner", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { scenarioId } = await params;

  const activityParams = await db
    .select()
    .from(simulationActivityParam)
    .where(
      and(
        eq(simulationActivityParam.scenarioId, scenarioId),
        eq(simulationActivityParam.orgId, ctx.orgId),
      ),
    );

  return Response.json({ data: activityParams });
}
