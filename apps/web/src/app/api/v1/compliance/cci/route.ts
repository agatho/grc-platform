import { db, complianceCultureSnapshot } from "@grc/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import type { CCICurrentResponse } from "@grc/shared";
import { getPreviousPeriod } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/compliance/cci — Current CCI (latest snapshot) + trend
export const GET = withErrorHandler(async function GET(_req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  // Get latest org-wide snapshot
  const [latest] = await db
    .select()
    .from(complianceCultureSnapshot)
    .where(
      and(
        eq(complianceCultureSnapshot.orgId, ctx.orgId),
        isNull(complianceCultureSnapshot.orgEntityId),
      ),
    )
    .orderBy(desc(complianceCultureSnapshot.period))
    .limit(1);

  if (!latest) {
    return Response.json({
      data: {
        snapshot: null,
        previousSnapshot: null,
        trend: null,
        delta: null,
      } satisfies CCICurrentResponse,
    });
  }

  // Get previous period snapshot
  const previousPeriod = getPreviousPeriod(latest.period);
  const [previous] = await db
    .select()
    .from(complianceCultureSnapshot)
    .where(
      and(
        eq(complianceCultureSnapshot.orgId, ctx.orgId),
        isNull(complianceCultureSnapshot.orgEntityId),
        eq(complianceCultureSnapshot.period, previousPeriod),
      ),
    )
    .limit(1);

  const overallScore = Number(latest.overallScore);
  const prevScore = previous ? Number(previous.overallScore) : null;
  const delta =
    prevScore !== null
      ? Math.round((overallScore - prevScore) * 100) / 100
      : null;

  return Response.json({
    data: {
      snapshot: {
        ...latest,
        overallScore,
      },
      previousSnapshot: previous
        ? { ...previous, overallScore: Number(previous.overallScore) }
        : null,
      trend: latest.trend,
      delta,
    },
  });
});
