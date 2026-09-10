import { db, riskTreatment } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, sql, count } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/erm/kpi-cards — 4 KPI card data points
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // KPI 1: Enterprise Risks in Evaluation (not yet active)
  const risksInEvalResult = await db.execute(
    sql`SELECT COUNT(*) as count FROM risk
        WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL
          AND evaluation_phase IS NOT NULL AND evaluation_phase != 'active'`,
  );

  // KPI 2: ERM-relevant Process Risks
  const processRisksResult = await db.execute(
    sql`SELECT COUNT(*) as count FROM risk
        WHERE org_id = ${ctx.orgId} AND deleted_at IS NULL
          AND risk_source = 'process'`,
  );

  // KPI 3: Measures in Implementation
  const [measuresInProgress] = await db
    .select({ count: count() })
    .from(riskTreatment)
    .where(
      and(
        eq(riskTreatment.orgId, ctx.orgId),
        isNull(riskTreatment.deletedAt),
        eq(riskTreatment.status, "in_progress"),
      ),
    );

  // KPI 4: Overdue Measures
  const [overdueMeasures] = await db
    .select({ count: count() })
    .from(riskTreatment)
    .where(
      and(
        eq(riskTreatment.orgId, ctx.orgId),
        isNull(riskTreatment.deletedAt),
        sql`${riskTreatment.status} NOT IN ('completed', 'cancelled')`,
        sql`${riskTreatment.dueDate} < CURRENT_DATE`,
      ),
    );

  return Response.json({
    data: {
      risksInEvaluation: Number(risksInEvalResult[0]?.count ?? 0),
      processRisks: Number(processRisksResult[0]?.count ?? 0),
      measuresInProgress: measuresInProgress?.count ?? 0,
      overdueMeasures: overdueMeasures?.count ?? 0,
    },
  });
});
