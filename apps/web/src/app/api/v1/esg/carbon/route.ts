import {
  db,
  emissionSource,
  emissionActivityData,
  emissionFactor,
} from "@grc/db";
import {
  createEmissionSourceSchema,
  createActivityDataSchema,
} from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/esg/carbon — Carbon dashboard data
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "esg_manager",
    "esg_contributor",
    "process_owner",
  );
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const year =
    url.searchParams.get("year") || new Date().getFullYear().toString();

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
});
