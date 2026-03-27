import { db, grcCostEntry } from "@grc/db";
import { eq, and, sql, gte, lte, isNotNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/costs/by-department — Aggregated costs by department
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const costType = url.searchParams.get("cost_type") ?? "actual";

  const conditions = [
    eq(grcCostEntry.orgId, ctx.orgId),
    eq(grcCostEntry.costType, costType as "planned" | "actual" | "forecast"),
    isNotNull(grcCostEntry.department),
  ];

  if (year) {
    conditions.push(gte(grcCostEntry.periodStart, `${year}-01-01`));
    conditions.push(lte(grcCostEntry.periodEnd, `${year}-12-31`));
  }

  const results = await db
    .select({
      department: grcCostEntry.department,
      totalAmount: sql<string>`SUM(${grcCostEntry.amount})`.as("total_amount"),
      totalHours: sql<string>`SUM(${grcCostEntry.hours})`.as("total_hours"),
      entryCount: sql<number>`COUNT(*)`.as("entry_count"),
    })
    .from(grcCostEntry)
    .where(and(...conditions))
    .groupBy(grcCostEntry.department);

  return Response.json({
    data: results.map((r) => ({
      department: r.department,
      totalAmount: Number(r.totalAmount),
      totalHours: r.totalHours ? Number(r.totalHours) : 0,
      entryCount: Number(r.entryCount),
    })),
  });
}
