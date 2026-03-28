import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { getThreatTrends } from "@grc/reporting";
import { threatTrendsQuerySchema } from "@grc/shared";

// GET /api/v1/isms/threats/trends — Monthly trend data
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const query = threatTrendsQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );

  const trends = await getThreatTrends(ctx.orgId, query.months);
  return Response.json({ data: { trends } });
}
