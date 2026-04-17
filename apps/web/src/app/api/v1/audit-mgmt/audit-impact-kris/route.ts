import { db, finding, audit, riskTreatment } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, isNull, sql, inArray } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/audit-mgmt/audit-impact-kris
//
// Platform-wide key risk indicators derived from audit & finding data.
// Consumed by ERM dashboards and management reviews to answer the
// oversight questions mandated by ISO 31000 6.6 / COSO ERM Principle 17:
//
//  - Do we have unresolved audit findings?
//  - Are our remediation plans on schedule?
//  - Are there audit findings that did not get linked back to a risk
//    (traceability gap)?
//  - How many completed audits ended with a non-conforming conclusion?
//
// The endpoint is read-only and agnostic to a single audit — it aggregates
// across the whole organisation context.
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const today = new Date().toISOString().slice(0, 10);
  const openStatuses = ["identified", "in_remediation"] as const;

  // 1. Open findings by severity
  const openBySev = await db
    .select({
      severity: finding.severity,
      cnt: sql<number>`count(*)::int`,
    })
    .from(finding)
    .where(
      and(
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
        inArray(finding.status, [...openStatuses]),
      ),
    )
    .groupBy(finding.severity);

  const openFindingsBySeverity: Record<string, number> = {
    observation: 0,
    recommendation: 0,
    improvement_requirement: 0,
    insignificant_nonconformity: 0,
    significant_nonconformity: 0,
  };
  let openFindingsTotal = 0;
  for (const r of openBySev) {
    openFindingsBySeverity[r.severity] = r.cnt;
    openFindingsTotal += r.cnt;
  }

  // 2. Overdue findings — open + past due
  const [{ overdueCnt }] = await db
    .select({ overdueCnt: sql<number>`count(*)::int` })
    .from(finding)
    .where(
      and(
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
        inArray(finding.status, [...openStatuses]),
        sql`${finding.remediationDueDate} IS NOT NULL AND ${finding.remediationDueDate} < ${today}`,
      ),
    );

  // 3. Findings without a risk link — traceability gap (ISO 31000 feedback loop)
  const [{ unlinkedCnt }] = await db
    .select({ unlinkedCnt: sql<number>`count(*)::int` })
    .from(finding)
    .where(
      and(
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
        inArray(finding.status, [...openStatuses]),
        sql`${finding.riskId} IS NULL`,
      ),
    );

  // 4. Open treatments derived from audit findings (keyed by workItemId)
  //    → indicates how many ERM treatments were created via audit sync.
  const [{ auditTreatmentCnt }] = await db
    .select({ auditTreatmentCnt: sql<number>`count(*)::int` })
    .from(riskTreatment)
    .where(
      and(
        eq(riskTreatment.orgId, ctx.orgId),
        isNull(riskTreatment.deletedAt),
        sql`${riskTreatment.workItemId} IS NOT NULL`,
        inArray(riskTreatment.status, ["planned", "in_progress"]),
      ),
    );

  // 5. Completed audits by conclusion (last 12 months)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const completedAudits = await db
    .select({
      conclusion: audit.conclusion,
      cnt: sql<number>`count(*)::int`,
    })
    .from(audit)
    .where(
      and(
        eq(audit.orgId, ctx.orgId),
        isNull(audit.deletedAt),
        eq(audit.status, "completed"),
        sql`${audit.updatedAt} >= ${oneYearAgo.toISOString()}`,
      ),
    )
    .groupBy(audit.conclusion);

  const auditsByConclusion: Record<string, number> = {};
  let auditsCompletedLast12Months = 0;
  for (const r of completedAudits) {
    const key = r.conclusion ?? "unspecified";
    auditsByConclusion[key] = r.cnt;
    auditsCompletedLast12Months += r.cnt;
  }

  return Response.json({
    data: {
      generatedAt: new Date().toISOString(),
      openFindingsTotal,
      openFindingsBySeverity,
      overdueFindings: Number(overdueCnt),
      unlinkedFindings: Number(unlinkedCnt),
      auditTreatmentsOpen: Number(auditTreatmentCnt),
      auditsCompletedLast12Months,
      auditsByConclusion,
    },
  });
}
