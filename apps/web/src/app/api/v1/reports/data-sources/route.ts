import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { getAvailableDataSources } from "@grc/reporting";

// GET /api/v1/reports/data-sources — Available data sources for template builder
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const sources = getAvailableDataSources();
  return Response.json({ data: sources });
}
