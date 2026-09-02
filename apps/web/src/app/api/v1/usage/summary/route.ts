import { db, usageRecord, usageMeter } from "@grc/db";
import { eq, and, sql, gte } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/usage/summary — Current period usage summary
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const summary = await db
    .select({
      meterKey: usageMeter.key,
      meterName: usageMeter.name,
      unit: usageMeter.unit,
      totalQuantity: sql<number>`sum(${usageRecord.quantity}::numeric)`,
      recordCount: sql<number>`count(*)`,
    })
    .from(usageRecord)
    .innerJoin(usageMeter, eq(usageRecord.meterId, usageMeter.id))
    .where(
      and(
        eq(usageRecord.orgId, ctx.orgId),
        gte(usageRecord.periodStart, periodStart),
      ),
    )
    .groupBy(usageMeter.key, usageMeter.name, usageMeter.unit);

  return Response.json({
    data: {
      period: {
        start: periodStart.toISOString(),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString(),
      },
      meters: summary,
    },
  });
});
