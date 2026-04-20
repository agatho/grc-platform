import { db, controlEffectivenessScore, control } from "@grc/db";
import { eq, and, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/ics/ces/heatmap — CES heatmap data (controlType x frequency)
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const rows = await db
    .select({
      controlType: control.controlType,
      frequency: control.frequency,
      avgScore: sql<number>`ROUND(AVG(${controlEffectivenessScore.score}))`.as(
        "avg_score",
      ),
      controlCount: sql<number>`COUNT(*)`.as("control_count"),
      minScore: sql<number>`MIN(${controlEffectivenessScore.score})`.as(
        "min_score",
      ),
      maxScore: sql<number>`MAX(${controlEffectivenessScore.score})`.as(
        "max_score",
      ),
    })
    .from(controlEffectivenessScore)
    .innerJoin(control, eq(control.id, controlEffectivenessScore.controlId))
    .where(
      and(
        eq(controlEffectivenessScore.orgId, ctx.orgId),
        isNull(control.deletedAt),
      ),
    )
    .groupBy(control.controlType, control.frequency);

  // Build matrix structure for frontend
  const cells = rows.map((r) => ({
    controlType: r.controlType,
    frequency: r.frequency,
    avgScore: Number(r.avgScore),
    controlCount: Number(r.controlCount),
    minScore: Number(r.minScore),
    maxScore: Number(r.maxScore),
  }));

  return Response.json({ data: cells });
}
