import { db, controlMaturity, control } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/isms/maturity/gap-analysis — controls with gap > 0
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Get latest maturity per control (most recent assessedAt)
  const rows = await db
    .select({
      controlId: controlMaturity.controlId,
      controlTitle: control.title,
      department: control.department,
      currentMaturity: controlMaturity.currentMaturity,
      targetMaturity: controlMaturity.targetMaturity,
      gap: sql<number>`(${controlMaturity.targetMaturity} - ${controlMaturity.currentMaturity})`,
      assessedAt: controlMaturity.assessedAt,
    })
    .from(controlMaturity)
    .innerJoin(control, eq(controlMaturity.controlId, control.id))
    .where(
      and(
        eq(controlMaturity.orgId, ctx.orgId),
        sql`${controlMaturity.targetMaturity} - ${controlMaturity.currentMaturity} > 0`,
      ),
    )
    .orderBy(
      desc(
        sql`${controlMaturity.targetMaturity} - ${controlMaturity.currentMaturity}`,
      ),
    );

  // Deduplicate: keep latest per control
  const seen = new Set<string>();
  const deduplicated = rows.filter((row) => {
    if (seen.has(row.controlId)) return false;
    seen.add(row.controlId);
    return true;
  });

  // Aggregate stats
  const allLatest = await db
    .select({
      avgCurrent: sql<number>`round(avg(${controlMaturity.currentMaturity})::numeric, 1)`,
      avgTarget: sql<number>`round(avg(${controlMaturity.targetMaturity})::numeric, 1)`,
      totalControls: sql<number>`count(distinct ${controlMaturity.controlId})::int`,
    })
    .from(controlMaturity)
    .where(eq(controlMaturity.orgId, ctx.orgId));

  const stats = allLatest[0];
  const avgGap = Number(
    ((stats?.avgTarget ?? 0) - (stats?.avgCurrent ?? 0)).toFixed(1),
  );

  return Response.json({
    data: deduplicated,
    stats: {
      avgCurrent: stats?.avgCurrent ?? 0,
      avgTarget: stats?.avgTarget ?? 0,
      avgGap,
      totalControls: stats?.totalControls ?? 0,
    },
  });
}
