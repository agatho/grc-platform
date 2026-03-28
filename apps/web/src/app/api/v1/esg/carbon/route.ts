import { db, emissionSource, emissionActivityData, emissionFactor } from "@grc/db";
import { createEmissionSourceSchema, createActivityDataSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, withAuditContext, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/esg/carbon — Carbon dashboard data
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "process_owner");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const year = url.searchParams.get("year") || new Date().getFullYear().toString();

  // Aggregate emissions by scope
  const emissions = await db.execute(sql`
    SELECT es.scope, es.scope3_category,
           SUM(ead.computed_co2e_tonnes) as total_co2e,
           ead.computation_method
    FROM emission_activity_data ead
    JOIN emission_source es ON ead.source_id = es.id
    WHERE ead.org_id = ${ctx.orgId}
      AND EXTRACT(YEAR FROM ead.reporting_period_start::date) = ${parseInt(year)}
    GROUP BY es.scope, es.scope3_category, ead.computation_method
  `);

  return Response.json({ data: { year: parseInt(year), emissions } });
}
