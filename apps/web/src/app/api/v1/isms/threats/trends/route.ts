import { requireModule } from "@grc/auth";
import { withAuth } from "@/lib/api";
import { getThreatTrends } from "@grc/reporting";
import { threatTrendsQuerySchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/isms/threats/trends — Monthly trend data
export const GET = withErrorHandler(async function GET(req: Request) {
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
});
