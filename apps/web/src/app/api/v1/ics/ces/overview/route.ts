import { db, controlEffectivenessScore, control } from "@grc/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import { sql, count } from "drizzle-orm";

// GET /api/v1/ics/ces/overview — All CES scores for org (paginated)
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);
  const sortBy = searchParams.get("sort") ?? "score";
  const sortDir = searchParams.get("dir") === "asc" ? "asc" : "desc";
  const minScore = searchParams.get("minScore");
  const maxScore = searchParams.get("maxScore");
  const trend = searchParams.get("trend");

  const conditions = [
    eq(controlEffectivenessScore.orgId, ctx.orgId),
    isNull(control.deletedAt),
  ];

  if (minScore) {
    conditions.push(
      sql`${controlEffectivenessScore.score} >= ${Number(minScore)}`,
    );
  }
  if (maxScore) {
    conditions.push(
      sql`${controlEffectivenessScore.score} <= ${Number(maxScore)}`,
    );
  }
  if (trend) {
    conditions.push(eq(controlEffectivenessScore.trend, trend));
  }

  const where = and(...conditions);

  const [totalRow] = await db
    .select({ total: count() })
    .from(controlEffectivenessScore)
    .innerJoin(control, eq(control.id, controlEffectivenessScore.controlId))
    .where(where);

  const orderCol =
    sortBy === "title"
      ? control.title
      : sortBy === "trend"
        ? controlEffectivenessScore.trend
        : controlEffectivenessScore.score;

  const orderFn =
    sortDir === "asc" ? sql`${orderCol} ASC` : sql`${orderCol} DESC`;

  const rows = await db
    .select({
      controlId: controlEffectivenessScore.controlId,
      controlTitle: control.title,
      controlType: control.controlType,
      frequency: control.frequency,
      score: controlEffectivenessScore.score,
      trend: controlEffectivenessScore.trend,
      previousScore: controlEffectivenessScore.previousScore,
      testScoreAvg: controlEffectivenessScore.testScoreAvg,
      overduePenalty: controlEffectivenessScore.overduePenalty,
      findingPenalty: controlEffectivenessScore.findingPenalty,
      automationBonus: controlEffectivenessScore.automationBonus,
      openFindingsCount: controlEffectivenessScore.openFindingsCount,
      lastTestAt: controlEffectivenessScore.lastTestAt,
      lastComputedAt: controlEffectivenessScore.lastComputedAt,
    })
    .from(controlEffectivenessScore)
    .innerJoin(control, eq(control.id, controlEffectivenessScore.controlId))
    .where(where)
    .orderBy(orderFn)
    .limit(limit)
    .offset(offset);

  return paginatedResponse(rows, totalRow?.total ?? 0, page, limit);
}
