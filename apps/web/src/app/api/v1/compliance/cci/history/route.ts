import { db, complianceCultureSnapshot } from "@grc/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { cciHistoryQuerySchema } from "@grc/shared";
import type { CCIHistoryEntry, CCITrend, CCIFactorScores } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/compliance/cci/history?months=12 — Monthly snapshots for trend chart
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = cciHistoryQuerySchema.safeParse({
    months: url.searchParams.get("months") ?? "12",
  });

  if (!query.success) {
    return Response.json(
      { error: "Validation failed", details: query.error.flatten() },
      { status: 422 },
    );
  }

  const snapshots = await db
    .select()
    .from(complianceCultureSnapshot)
    .where(
      and(
        eq(complianceCultureSnapshot.orgId, ctx.orgId),
        isNull(complianceCultureSnapshot.orgEntityId),
      ),
    )
    .orderBy(desc(complianceCultureSnapshot.period))
    .limit(query.data.months);

  const history: CCIHistoryEntry[] = snapshots.reverse().map((s) => ({
    period: s.period,
    overallScore: Number(s.overallScore),
    factorScores: s.factorScores as CCIFactorScores,
    trend: s.trend as CCITrend | null,
  }));

  return Response.json({ data: history });
});
