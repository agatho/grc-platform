// GET /api/v1/bcms/readiness-monitor
//
// Combines three BCMS timeliness dimensions in one payload:
// 1. Active crises with DORA 4h/72h/1m timer state (computeDoraDeadlines)
// 2. BCP review freshness (next_review_date overdue)
// 3. BCP test freshness (last_tested_date > 1 year old)
// 4. Exercise coverage YTD (ISO 22301 Kap. 8.5 requires at least annual)

import { db, crisisScenario, bcp, bcExercise } from "@grc/db";
import { requireModule } from "@grc/auth";
import { computeDoraDeadlines } from "@grc/shared";
import { and, eq, isNull, gte } from "drizzle-orm";
import { withAuth } from "@/lib/api";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(_req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  // ─── Active crises ────────────────────────────────────────
  const crises = await db
    .select({
      id: crisisScenario.id,
      name: crisisScenario.name,
      severity: crisisScenario.severity,
      status: crisisScenario.status,
      activatedAt: crisisScenario.activatedAt,
      resolvedAt: crisisScenario.resolvedAt,
    })
    .from(crisisScenario)
    .where(eq(crisisScenario.orgId, ctx.orgId));

  const activeCrises = crises
    .filter((c) => c.status === "activated")
    .map((c) => {
      const classifiedAt = c.activatedAt ? new Date(c.activatedAt) : now;
      const dora = computeDoraDeadlines(classifiedAt, now);
      return {
        id: c.id,
        name: c.name,
        severity: c.severity,
        activatedAtIso: classifiedAt.toISOString(),
        dora: {
          earlyWarningAtIso: dora.earlyWarning.toISOString(),
          intermediateAtIso: dora.intermediate.toISOString(),
          finalAtIso: dora.final.toISOString(),
          earlyWarningOverdue: dora.earlyWarningOverdue,
          intermediateOverdue: dora.intermediateOverdue,
          finalOverdue: dora.finalOverdue,
          nextDeadlineLabel: dora.nextDeadlineLabel,
          nextDeadlineAtIso: dora.nextDeadlineAt?.toISOString() ?? null,
          hoursUntilNext: dora.nextDeadlineAt
            ? Math.round((dora.nextDeadlineAt.getTime() - now.getTime()) / (60 * 60 * 1000))
            : null,
        },
      };
    });

  // ─── BCP freshness ────────────────────────────────────────
  const bcps = await db
    .select({
      id: bcp.id,
      title: bcp.title,
      status: bcp.status,
      nextReviewDate: bcp.nextReviewDate,
      lastTestedDate: bcp.lastTestedDate,
    })
    .from(bcp)
    .where(and(eq(bcp.orgId, ctx.orgId), isNull(bcp.deletedAt)));

  const bcpIssues = bcps
    .filter((b) => b.status === "published" || b.status === "approved")
    .map((b) => {
      const nextReview = b.nextReviewDate ? new Date(b.nextReviewDate) : null;
      const reviewOverdueDays = nextReview
        ? Math.floor((now.getTime() - nextReview.getTime()) / DAY_MS)
        : null;
      const lastTested = b.lastTestedDate ? new Date(b.lastTestedDate) : null;
      const testAgeDays = lastTested
        ? Math.floor((now.getTime() - lastTested.getTime()) / DAY_MS)
        : null;
      const reviewOverdue = reviewOverdueDays !== null && reviewOverdueDays > 0;
      const untested = lastTested === null;
      const testStale = testAgeDays !== null && testAgeDays > 365;

      return {
        id: b.id,
        title: b.title,
        status: b.status,
        nextReviewDate: b.nextReviewDate,
        lastTestedDate: b.lastTestedDate,
        reviewOverdueDays,
        testAgeDays,
        reviewOverdue,
        untested,
        testStale,
        hasIssue: reviewOverdue || untested || testStale,
      };
    });

  const bcpWithIssues = bcpIssues.filter((b) => b.hasIssue);

  // ─── Exercise coverage YTD ───────────────────────────────
  const exercisesThisYear = await db
    .select({ id: bcExercise.id })
    .from(bcExercise)
    .where(
      and(
        eq(bcExercise.orgId, ctx.orgId),
        eq(bcExercise.status, "completed"),
        gte(bcExercise.actualDate, yearStart.toISOString().slice(0, 10)),
      ),
    );

  const exerciseCoverageYtd = exercisesThisYear.length;
  const exerciseIsoGap = exerciseCoverageYtd === 0;

  const summary = {
    activeCrisesCount: activeCrises.length,
    crisesWithOverdueDora: activeCrises.filter((c) => c.dora.intermediateOverdue || c.dora.finalOverdue)
      .length,
    bcpTotal: bcpIssues.length,
    bcpWithIssues: bcpWithIssues.length,
    bcpReviewOverdue: bcpIssues.filter((b) => b.reviewOverdue).length,
    bcpUntested: bcpIssues.filter((b) => b.untested).length,
    bcpTestStale: bcpIssues.filter((b) => b.testStale).length,
    exerciseCoverageYtd,
    exerciseIsoGap,
    overallReady:
      activeCrises.length === 0 &&
      bcpWithIssues.length === 0 &&
      exerciseCoverageYtd > 0,
  };

  return Response.json({
    data: {
      summary,
      activeCrises,
      bcpIssues: bcpWithIssues,
      bcpAll: bcpIssues,
      exerciseCoverageYtd,
    },
  });
}
