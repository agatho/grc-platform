import { db, riskPrediction } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, desc } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/erm/predictions — All predictions ranked by escalation probability
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const minProbability = searchParams.get("minProbability");

  const conditions = [eq(riskPrediction.orgId, ctx.orgId)];

  const rows = await db
    .select()
    .from(riskPrediction)
    .where(eq(riskPrediction.orgId, ctx.orgId))
    .orderBy(desc(riskPrediction.escalationProbability))
    .limit(limit)
    .offset(offset);

  // Filter by minimum probability client-side for simplicity
  const filtered = minProbability
    ? rows.filter((r) => Number(r.escalationProbability) >= Number(minProbability))
    : rows;

  const allRows = await db
    .select({ id: riskPrediction.id })
    .from(riskPrediction)
    .where(eq(riskPrediction.orgId, ctx.orgId));

  return paginatedResponse(filtered, allRows.length, page, limit);
}
