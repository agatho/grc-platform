import { db, grcCostEntry } from "@grc/db";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/costs/by-category — Aggregated costs by cost category
export const GET = withErrorHandler(async function GET(req: Request) {
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
});
