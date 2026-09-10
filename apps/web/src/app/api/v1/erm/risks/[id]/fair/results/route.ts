import { db, fairSimulationResult, risk } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/erm/risks/:id/fair/results — Latest simulation results
export const GET = withErrorHandler(async function GET(
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
});
