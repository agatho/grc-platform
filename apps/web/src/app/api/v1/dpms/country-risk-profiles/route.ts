import { db, countryRiskProfile } from "@grc/db";
import { eq, count } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import { requireModule } from "@grc/auth";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/dpms/country-risk-profiles — Browse country risk database (read-only, shared)
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const riskLevel = searchParams.get("riskLevel");
  const countryCode = searchParams.get("countryCode");

  const conditions = [];
  if (riskLevel)
    conditions.push(eq(countryRiskProfile.overallRiskLevel, riskLevel));
  if (countryCode)
    conditions.push(eq(countryRiskProfile.countryCode, countryCode));

  const where = conditions.length > 0 ? conditions[0] : undefined;

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(countryRiskProfile)
      .where(where)
      .orderBy(countryRiskProfile.countryName)
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(countryRiskProfile).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
});
