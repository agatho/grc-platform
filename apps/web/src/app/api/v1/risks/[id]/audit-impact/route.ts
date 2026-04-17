import { db, finding, riskTreatment, risk } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/v1/risks/[id]/audit-impact
//
// Derived view on the ISO 27001 9.2 / IIA 2120 feedback loop: summarises the
// audit-side impact on a single risk without a DB schema change. Used by:
//  - Risk-detail UI to show a reassessment-needed marker
//  - Audit report to list "affected risks"
//  - KRI dashboards for "risks with unresolved audit findings"
//
// `needsReassessment` is a derived boolean: true when at least one linked
// finding has severity >= improvement_requirement AND status is still open
// (identified / in_remediation). This signals that the risk's residual
// score is no longer trustworthy and should be re-scored in the next
// assessment cycle per ISO 27005 Ch. 10 (Risk Acceptance Review).
export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Verify the risk exists and is accessible.
  const [r] = await db
    .select({
      id: risk.id,
      title: risk.title,
      status: risk.status,
      riskScoreResidual: risk.riskScoreResidual,
    })
    .from(risk)
    .where(
      and(
        eq(risk.id, id),
        eq(risk.orgId, ctx.orgId),
        isNull(risk.deletedAt),
      ),
    );
  if (!r) {
    return Response.json({ error: "Risk not found" }, { status: 404 });
  }

  // Pull findings grouped by severity + status.
  const findingsRaw = await db
    .select({
      id: finding.id,
      severity: finding.severity,
      status: finding.status,
      remediationDueDate: finding.remediationDueDate,
      source: finding.source,
    })
    .from(finding)
    .where(
      and(
        eq(finding.riskId, id),
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
      ),
    );

  const findingsTotal = findingsRaw.length;
  const findingsBySeverity: Record<string, number> = {};
  const findingsByStatus: Record<string, number> = {};
  const openStatuses = new Set(["identified", "in_remediation"]);
  const criticalSeverities = new Set([
    "improvement_requirement",
    "insignificant_nonconformity",
    "significant_nonconformity",
  ]);

  let openCritical = 0;
  let overdueOpen = 0;
  const now = new Date().toISOString().slice(0, 10);

  for (const f of findingsRaw) {
    findingsBySeverity[f.severity] = (findingsBySeverity[f.severity] ?? 0) + 1;
    findingsByStatus[f.status] = (findingsByStatus[f.status] ?? 0) + 1;
    const open = openStatuses.has(f.status);
    const critical = criticalSeverities.has(f.severity);
    if (open && critical) openCritical++;
    if (open && f.remediationDueDate && f.remediationDueDate < now) overdueOpen++;
  }

  // Count treatments derived from these findings.
  const [{ treatmentCount }] = await db
    .select({
      treatmentCount: sql<number>`count(*)::int`,
    })
    .from(riskTreatment)
    .where(
      and(
        eq(riskTreatment.riskId, id),
        eq(riskTreatment.orgId, ctx.orgId),
        isNull(riskTreatment.deletedAt),
      ),
    );

  const needsReassessment = openCritical > 0;

  return Response.json({
    data: {
      risk: r,
      findingsTotal,
      findingsBySeverity,
      findingsByStatus,
      openCritical,
      overdueOpen,
      treatmentCount: Number(treatmentCount),
      needsReassessment,
    },
  });
}
