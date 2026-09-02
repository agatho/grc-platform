import { db, grcCostEntry } from "@grc/db";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/costs/by-area — Aggregated costs by GRC area
// Maps entity_type to grc_area for aggregation
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

  // Map entity types to GRC areas via a CASE expression
  const grcAreaExpr = sql<string>`CASE
    WHEN ${grcCostEntry.entityType} IN ('risk', 'risk_treatment', 'kri') THEN 'erm'
    WHEN ${grcCostEntry.entityType} IN ('control', 'control_test', 'finding') THEN 'ics'
    WHEN ${grcCostEntry.entityType} IN ('incident', 'vulnerability', 'threat') THEN 'isms'
    WHEN ${grcCostEntry.entityType} IN ('ropa_entry', 'dpia', 'dsr', 'data_breach') THEN 'dpms'
    WHEN ${grcCostEntry.entityType} IN ('audit', 'audit_plan') THEN 'audit'
    WHEN ${grcCostEntry.entityType} IN ('vendor', 'contract') THEN 'tprm'
    WHEN ${grcCostEntry.entityType} IN ('bcp', 'bia', 'bc_exercise') THEN 'bcms'
    WHEN ${grcCostEntry.entityType} IN ('esg_target', 'esg_datapoint') THEN 'esg'
    ELSE 'general'
  END`;

  const results = await db
    .select({
      grcArea: grcAreaExpr.as("grc_area"),
      totalAmount: sql<string>`SUM(${grcCostEntry.amount})`.as("total_amount"),
      entryCount: sql<number>`COUNT(*)`.as("entry_count"),
    })
    .from(grcCostEntry)
    .where(and(...conditions))
    .groupBy(grcAreaExpr);

  return Response.json({
    data: results.map((r) => ({
      grcArea: r.grcArea,
      totalAmount: Number(r.totalAmount),
      entryCount: Number(r.entryCount),
    })),
  });
});
