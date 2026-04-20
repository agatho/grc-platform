import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

/**
 * GET /api/v1/esg/materiality/[year]/iro
 * Returns materiality_iro items for the given year's assessment.
 * Used by the materiality page to show ERM sync status on risk IROs.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ year: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { year } = await params;
  const reportingYear = parseInt(year, 10);
  if (isNaN(reportingYear)) {
    return Response.json({ error: "Invalid year" }, { status: 400 });
  }

  const result = await db.execute(
    sql`SELECT mi.id, mi.esrs_topic AS "esrsTopic", mi.iro_type AS "iroType",
               mi.title, mi.financial_materiality_score AS "financialMaterialityScore",
               mi.impact_materiality_score AS "impactMaterialityScore",
               mi.is_material AS "isMaterial",
               mi.erm_risk_id AS "ermRiskId",
               mi.erm_synced_at AS "ermSyncedAt"
        FROM materiality_iro mi
        JOIN materiality_assessment ma ON ma.id = mi.assessment_id
        WHERE mi.org_id = ${ctx.orgId}
          AND ma.reporting_year = ${reportingYear}
        ORDER BY mi.esrs_topic, mi.iro_type`,
  );

  return Response.json({ data: (result as unknown as unknown[]) ?? [] });
}
