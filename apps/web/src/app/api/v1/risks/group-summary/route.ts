import { db, risk, kri, organization, userOrganizationRole } from "@grc/db";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";

// GET /api/v1/risks/group-summary — Cross-org risk summary (admin/risk_manager)
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Get all orgs the user has access to
  const userOrgRoles = await db
    .select({
      orgId: userOrganizationRole.orgId,
    })
    .from(userOrganizationRole)
    .where(
      and(
        eq(userOrganizationRole.userId, ctx.userId),
        isNull(userOrganizationRole.deletedAt),
      ),
    );

  const orgIds = userOrgRoles.map((r) => r.orgId);

  if (orgIds.length === 0) {
    return Response.json({ data: [] });
  }

  // Use raw SQL to bypass RLS for cross-org summary
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.bypass_rls = 'true'`);

    const rows = await tx.execute(sql`
      SELECT
        o.id AS org_id,
        o.name AS org_name,
        o.org_code,
        COALESCE(r.total_risks, 0)::int AS total_risks,
        COALESCE(r.critical_count, 0)::int AS critical_count,
        COALESCE(r.appetite_exceeded_count, 0)::int AS appetite_exceeded_count,
        COALESCE(r.avg_score, 0)::float AS avg_score,
        COALESCE(r.max_score, 0)::int AS max_score,
        COALESCE(k.kri_red_count, 0)::int AS kri_red_count
      FROM organization o
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS total_risks,
          COUNT(*) FILTER (WHERE risk_score_residual >= 15)::int AS critical_count,
          COUNT(*) FILTER (WHERE risk_appetite_exceeded = true)::int AS appetite_exceeded_count,
          ROUND(AVG(risk_score_residual)::numeric, 2)::float AS avg_score,
          COALESCE(MAX(risk_score_residual), 0)::int AS max_score
        FROM risk
        WHERE risk.org_id = o.id AND risk.deleted_at IS NULL
      ) r ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) FILTER (WHERE current_alert_status = 'red')::int AS kri_red_count
        FROM kri
        WHERE kri.org_id = o.id AND kri.deleted_at IS NULL
      ) k ON true
      WHERE o.id = ANY(${orgIds})
        AND o.deleted_at IS NULL
      ORDER BY r.total_risks DESC
    `);

    return rows;
  });

  // Transform snake_case DB results to camelCase
  const data = (result as Array<Record<string, unknown>>).map((row) => ({
    orgId: row.org_id,
    orgName: row.org_name,
    orgCode: row.org_code,
    totalRisks: row.total_risks,
    criticalCount: row.critical_count,
    appetiteExceededCount: row.appetite_exceeded_count,
    avgScore: row.avg_score,
    maxScore: row.max_score,
    kriRedCount: row.kri_red_count,
  }));

  return Response.json({ data });
}
