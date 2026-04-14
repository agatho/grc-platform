import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

/**
 * GET /api/v1/esg/erm-stats
 * Returns summary stats for ESG risk IROs and their ERM sync status.
 */
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const result = await db.execute(
    sql`SELECT
          COUNT(*) FILTER (WHERE is_material = true AND iro_type = 'risk') AS "totalMaterialRisks",
          COUNT(*) FILTER (WHERE is_material = true AND iro_type = 'risk' AND erm_risk_id IS NOT NULL) AS "syncedToErm"
        FROM materiality_iro
        WHERE org_id = ${ctx.orgId}`,
  );

  const row = result.rows?.[0] ?? {};

  return Response.json({
    data: {
      totalMaterialRisks: Number(row.totalMaterialRisks ?? 0),
      syncedToErm: Number(row.syncedToErm ?? 0),
    },
  });
}
