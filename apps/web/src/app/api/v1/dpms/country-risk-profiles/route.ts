import { db, countryRiskProfile } from "@grc/db";
import { eq, count } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import { requireModule } from "@grc/auth";

// GET /api/v1/dpms/country-risk-profiles — Browse country risk database (read-only, shared)
export async function GET(req: Request) {
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
}
