import { db, regulationSimulation } from "@grc/db";
import { requireModule } from "@grc/auth";
import { simulationCompareSchema } from "@grc/shared";
import { eq, and, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/compliance/simulator/compare?ids=a,b — Compare 2 simulations
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids");
  if (!idsParam) {
    return Response.json(
      { error: "ids query parameter required" },
      { status: 400 },
    );
  }

  const ids = idsParam.split(",");
  const parsed = simulationCompareSchema.safeParse({ ids });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(regulationSimulation)
    .where(
      and(
        inArray(regulationSimulation.id, parsed.data.ids),
        eq(regulationSimulation.orgId, ctx.orgId),
      ),
    );

  if (rows.length !== 2) {
    return Response.json(
      { error: "Both simulations must exist and belong to your organization" },
      { status: 404 },
    );
  }

  const [a, b] = rows;
  const comparison = {
    simulationA: a,
    simulationB: b,
    scoreDelta: Number(b.afterScore) - Number(a.afterScore),
    gapCountDelta: b.gapCount - a.gapCount,
    costDelta:
      Number(b.estimatedTotalCost ?? 0) - Number(a.estimatedTotalCost ?? 0),
  };

  return Response.json({ data: comparison });
}
