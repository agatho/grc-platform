import { db, vendorScorecard } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, desc } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/tprm/scorecards
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const { limit, offset } = paginate(url.searchParams);
  const tier = url.searchParams.get("tier");

  const query = db
    .select()
    .from(vendorScorecard)
    .where(eq(vendorScorecard.orgId, ctx.orgId))
    .orderBy(desc(vendorScorecard.overallScore))
    .limit(limit)
    .offset(offset);

  const rows = await query;
  const filtered = tier ? rows.filter((r) => r.tier === tier) : rows;

  return paginatedResponse(filtered, filtered.length, limit, offset);
});
