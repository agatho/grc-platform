import { db, fairSimulationResult, risk } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/erm/risks/:id/fair/results — Latest simulation results
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "auditor", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: riskId } = await params;

  // Verify risk belongs to org
  const [riskRow] = await db
    .select({ id: risk.id })
    .from(risk)
    .where(
      and(
        eq(risk.id, riskId),
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    );

  if (!riskRow) {
    return Response.json({ error: "Risk not found" }, { status: 404 });
  }

  // Fetch all simulation results for this risk, newest first
  const results = await db
    .select()
    .from(fairSimulationResult)
    .where(
      and(
        eq(fairSimulationResult.riskId, riskId),
        eq(fairSimulationResult.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(fairSimulationResult.createdAt))
    .limit(10);

  // Also return the latest completed result separately for convenience
  const latest = results.find((r) => r.status === "completed") ?? null;

  return Response.json({ data: { results, latest } });
}
