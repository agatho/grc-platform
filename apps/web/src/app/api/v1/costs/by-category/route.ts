import { db, grcCostEntry } from "@grc/db";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/costs/by-category — Aggregated costs by cost category
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const costType = url.searchParams.get("cost_type") ?? "actual";

  const conditions = [
    eq(grcCostEntry.orgId, ctx.orgId),
    eq(grcCostEntry.costType, costType as "planned" | "actual" | "forecast"),
  ];

  if (year) {
    conditions.push(gte(grcCostEntry.periodStart, `${year}-01-01`));
    conditions.push(lte(grcCostEntry.periodEnd, `${year}-12-31`));
  }

  const results = await db
    .select({
      costCategory: grcCostEntry.costCategory,
      totalAmount: sql<string>`SUM(${grcCostEntry.amount})`.as("total_amount"),
      entryCount: sql<number>`COUNT(*)`.as("entry_count"),
    })
    .from(grcCostEntry)
    .where(and(...conditions))
    .groupBy(grcCostEntry.costCategory);

  return Response.json({
    data: results.map((r) => ({
      costCategory: r.costCategory,
      totalAmount: Number(r.totalAmount),
      entryCount: Number(r.entryCount),
    })),
  });
}
