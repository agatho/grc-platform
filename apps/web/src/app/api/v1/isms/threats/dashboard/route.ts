import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { getThreatDashboardKPIs } from "@grc/reporting";

// GET /api/v1/isms/threats/dashboard — Aggregated threat KPIs
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const kpis = await getThreatDashboardKPIs(ctx.orgId);
  return Response.json({ data: kpis });
}
