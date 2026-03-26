import { db, executiveKpiSnapshot } from "@grc/db";
import { eq, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { executiveTrendQuerySchema } from "@grc/shared";

// GET /api/v1/executive/trend — 12-month KPI snapshots for trend charts
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const parsed = executiveTrendQuerySchema.safeParse({
    months: url.searchParams.get("months") ?? "12",
  });

  const months = parsed.success ? parsed.data.months : 12;

  const rows = await db
    .select({
      snapshotDate: executiveKpiSnapshot.snapshotDate,
      kpis: executiveKpiSnapshot.kpis,
      createdAt: executiveKpiSnapshot.createdAt,
    })
    .from(executiveKpiSnapshot)
    .where(eq(executiveKpiSnapshot.orgId, ctx.orgId))
    .orderBy(desc(executiveKpiSnapshot.snapshotDate))
    .limit(months * 5); // ~5 snapshots per month (weekly)

  return Response.json({
    data: {
      snapshots: rows,
      count: rows.length,
    },
  });
}
