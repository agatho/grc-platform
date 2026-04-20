import { db, soaEntry, certificationReadinessSnapshot } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, or, gte, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { estimateWeeksToReadiness } from "@grc/shared";

// GET /api/v1/isms/certification/timeline — Estimated time to readiness
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Current open gaps
  const [{ openGaps }] = await db
    .select({
      openGaps: sql<number>`count(*)::int`,
    })
    .from(soaEntry)
    .where(
      and(
        eq(soaEntry.orgId, ctx.orgId),
        or(
          eq(soaEntry.applicability, "applicable"),
          eq(soaEntry.applicability, "partially_applicable"),
        ),
        or(
          eq(soaEntry.implementation, "not_implemented"),
          eq(soaEntry.implementation, "planned"),
          eq(soaEntry.implementation, "partially_implemented"),
        ),
      ),
    );

  // Estimate closure rate from snapshots (compare last 2 snapshots)
  const snapshots = await db
    .select({
      score: certificationReadinessSnapshot.score,
      gapCount: certificationReadinessSnapshot.gapCount,
      createdAt: certificationReadinessSnapshot.createdAt,
    })
    .from(certificationReadinessSnapshot)
    .where(
      and(
        eq(certificationReadinessSnapshot.orgId, ctx.orgId),
        eq(certificationReadinessSnapshot.framework, "iso27001"),
      ),
    )
    .orderBy(desc(certificationReadinessSnapshot.createdAt))
    .limit(6);

  let closedLastMonth = 0;
  if (snapshots.length >= 2) {
    const latest = snapshots[0];
    const previous = snapshots[1];
    const daysDiff =
      (new Date(latest.createdAt).getTime() -
        new Date(previous.createdAt).getTime()) /
      (1000 * 60 * 60 * 24);
    const gapDiff = previous.gapCount - latest.gapCount;
    closedLastMonth = daysDiff > 0 ? Math.round((gapDiff / daysDiff) * 30) : 0;
  }

  const estimatedWeeks = estimateWeeksToReadiness(openGaps, closedLastMonth);

  return Response.json({
    data: {
      openGaps,
      closedLastMonth,
      estimatedWeeks,
      estimatedDate:
        estimatedWeeks !== null
          ? new Date(
              Date.now() + estimatedWeeks * 7 * 24 * 60 * 60 * 1000,
            ).toISOString()
          : null,
      snapshots: snapshots.map((s) => ({
        score: s.score,
        gapCount: s.gapCount,
        createdAt: s.createdAt,
      })),
    },
  });
}
