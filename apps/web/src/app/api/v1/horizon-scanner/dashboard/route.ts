import {
  db,
  horizonScanSource,
  horizonScanItem,
  horizonImpactAssessment,
} from "@grc/db";
import { eq, and, sql, or, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(_req: Request) {
  const ctx = await withAuth(
    "admin",
    "dpo",
    "risk_manager",
    "auditor",
    "viewer",
  );
  if (ctx instanceof Response) return ctx;

  const [totalSrc, activeSrc, totalItems, newItems, critItems, pendingAssess] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(horizonScanSource)
        .where(
          or(
            eq(horizonScanSource.orgId, ctx.orgId),
            isNull(horizonScanSource.orgId),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(horizonScanSource)
        .where(
          and(
            or(
              eq(horizonScanSource.orgId, ctx.orgId),
              isNull(horizonScanSource.orgId),
            ),
            eq(horizonScanSource.isActive, true),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(horizonScanItem)
        .where(eq(horizonScanItem.orgId, ctx.orgId)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(horizonScanItem)
        .where(
          and(
            eq(horizonScanItem.orgId, ctx.orgId),
            eq(horizonScanItem.status, "new"),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(horizonScanItem)
        .where(
          and(
            eq(horizonScanItem.orgId, ctx.orgId),
            eq(horizonScanItem.classification, "critical"),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(horizonImpactAssessment)
        .where(
          and(
            eq(horizonImpactAssessment.orgId, ctx.orgId),
            eq(horizonImpactAssessment.status, "draft"),
          ),
        ),
    ]);

  return Response.json({
    data: {
      totalSources: Number(totalSrc[0]?.count ?? 0),
      activeSources: Number(activeSrc[0]?.count ?? 0),
      totalItems: Number(totalItems[0]?.count ?? 0),
      newItems: Number(newItems[0]?.count ?? 0),
      criticalItems: Number(critItems[0]?.count ?? 0),
      pendingAssessments: Number(pendingAssess[0]?.count ?? 0),
      upcomingDeadlines: [],
      recentItems: [],
      itemsByClassification: {},
      itemsByJurisdiction: {},
    },
  });
});
