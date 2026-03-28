import { db, vendorScorecard } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, desc } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/tprm/scorecards
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const { limit, offset } = paginate(url.searchParams);
  const tier = url.searchParams.get("tier");

  let query = db
    .select()
    .from(vendorScorecard)
    .where(eq(vendorScorecard.orgId, ctx.orgId))
    .orderBy(desc(vendorScorecard.overallScore))
    .limit(limit)
    .offset(offset);

  const rows = await query;
  const filtered = tier ? rows.filter((r) => r.tier === tier) : rows;

  return paginatedResponse(filtered, filtered.length, limit, offset);
}
