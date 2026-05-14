// GET /api/v1/controls/findings-summary
//
// #WAVE18-P1-3: Cowork QA's Wave-17 dataflow tests reported this 500
// — the route didn't exist, so the request fell through to
// /controls/[id]/findings/route.ts with id="findings-summary" and
// crashed on the UUID cast (same fall-through pattern as the Wave-12
// /dpms/ropa/export 500-empty bug).
//
// ICS-Dashboard KPI rollup: severity distribution, status distribution,
// overdue count, top affected controls. Mirrors the shape the
// /processes/governance-summary route emits so the dashboard pages can
// share rendering primitives.

import { db, finding, control } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, isNull, sql, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const now = new Date();
  const orgScope = and(eq(finding.orgId, ctx.orgId), isNull(finding.deletedAt));

  // Per-severity + per-status + overall counters in one query so the
  // dashboard renders without a round-trip storm.
  const [overall] = await db
    .select({
      total: sql<number>`count(*)::int`,
      // ISO 19011 severity buckets — we surface every value the enum
      // accepts so the UI can colour-code without doing the bucket
      // logic itself.
      majorNonconformity: sql<number>`count(*) filter (where ${finding.severity} = 'major_nonconformity')::int`,
      minorNonconformity: sql<number>`count(*) filter (where ${finding.severity} = 'minor_nonconformity')::int`,
      significantNonconformity: sql<number>`count(*) filter (where ${finding.severity} = 'significant_nonconformity')::int`,
      insignificantNonconformity: sql<number>`count(*) filter (where ${finding.severity} = 'insignificant_nonconformity')::int`,
      observation: sql<number>`count(*) filter (where ${finding.severity} = 'observation')::int`,
      opportunityForImprovement: sql<number>`count(*) filter (where ${finding.severity} = 'opportunity_for_improvement')::int`,
      improvementRequirement: sql<number>`count(*) filter (where ${finding.severity} = 'improvement_requirement')::int`,
      recommendation: sql<number>`count(*) filter (where ${finding.severity} = 'recommendation')::int`,
      positive: sql<number>`count(*) filter (where ${finding.severity} = 'positive')::int`,
      conforming: sql<number>`count(*) filter (where ${finding.severity} = 'conforming')::int`,
      identified: sql<number>`count(*) filter (where ${finding.status} = 'identified')::int`,
      inRemediation: sql<number>`count(*) filter (where ${finding.status} = 'in_remediation')::int`,
      remediated: sql<number>`count(*) filter (where ${finding.status} = 'remediated')::int`,
      verified: sql<number>`count(*) filter (where ${finding.status} = 'verified')::int`,
      accepted: sql<number>`count(*) filter (where ${finding.status} = 'accepted')::int`,
      closed: sql<number>`count(*) filter (where ${finding.status} = 'closed')::int`,
      // Overdue = remediation_due_date < now AND not closed/verified.
      overdue: sql<number>`count(*) filter (where ${finding.remediationDueDate} < current_date and ${finding.status} not in ('closed','verified'))::int`,
    })
    .from(finding)
    .where(orgScope);

  // Top 5 controls with the most still-open findings — the ICS team
  // wants a "where do we have the worst control hygiene" tile.
  const topControls = await db
    .select({
      controlId: finding.controlId,
      controlTitle: control.title,
      openFindings: sql<number>`count(*)::int`,
      criticalCount: sql<number>`count(*) filter (where ${finding.severity} in ('major_nonconformity','significant_nonconformity'))::int`,
    })
    .from(finding)
    .leftJoin(control, eq(finding.controlId, control.id))
    .where(
      and(
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
        sql`${finding.controlId} is not null`,
        sql`${finding.status} not in ('closed','verified','accepted')`,
      ),
    )
    .groupBy(finding.controlId, control.title)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  return Response.json({
    data: {
      asOf: now.toISOString(),
      total: overall?.total ?? 0,
      bySeverity: {
        major_nonconformity: overall?.majorNonconformity ?? 0,
        minor_nonconformity: overall?.minorNonconformity ?? 0,
        significant_nonconformity: overall?.significantNonconformity ?? 0,
        insignificant_nonconformity: overall?.insignificantNonconformity ?? 0,
        observation: overall?.observation ?? 0,
        opportunity_for_improvement: overall?.opportunityForImprovement ?? 0,
        improvement_requirement: overall?.improvementRequirement ?? 0,
        recommendation: overall?.recommendation ?? 0,
        positive: overall?.positive ?? 0,
        conforming: overall?.conforming ?? 0,
      },
      byStatus: {
        identified: overall?.identified ?? 0,
        in_remediation: overall?.inRemediation ?? 0,
        remediated: overall?.remediated ?? 0,
        verified: overall?.verified ?? 0,
        accepted: overall?.accepted ?? 0,
        closed: overall?.closed ?? 0,
      },
      overdue: overall?.overdue ?? 0,
      topAffectedControls: topControls.map((t) => ({
        controlId: t.controlId,
        controlTitle: t.controlTitle,
        openFindings: t.openFindings,
        criticalCount: t.criticalCount,
      })),
    },
  });
});
