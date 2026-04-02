import { db } from "@grc/db";
import { requireModule } from "@grc/auth";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/eam/dashboards/portfolio-optimization — All assessment distribution donuts
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "viewer");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("eam", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const dimensions = [
    "license_type", "functional_fit", "technical_fit",
    "lifecycle_status", "business_criticality", "time_classification", "six_r_strategy",
  ];

  const distributions: Record<string, Array<{ value: string; count: number }>> = {};

  for (const dim of dimensions) {
    const result = await db.execute(sql`
      SELECT ${sql.raw(dim)} AS value, COUNT(*)::int AS count
      FROM application_portfolio ap
      JOIN architecture_element ae ON ap.element_id = ae.id
      WHERE ae.org_id = ${ctx.orgId} AND ae.status != 'retired' AND ${sql.raw(dim)} IS NOT NULL
      GROUP BY ${sql.raw(dim)}
      ORDER BY count DESC
    `);
    distributions[dim] = result as unknown as Array<{ value: string; count: number }>;
  }

  return Response.json({ data: distributions });
}
