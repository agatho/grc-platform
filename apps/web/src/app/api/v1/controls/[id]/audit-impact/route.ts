import { db, finding, control, audit, workItem } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, isNull, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/v1/controls/[id]/audit-impact
//
// Summarises audit-side evidence for a single control. Used by the Controls
// detail page and ISMS assessment workflow to flag controls whose current
// maturity rating may be overstated given recent audit findings (ISO 27001
// Annex A wirksamkeitsnachweis / ISO 27005 Kap. 7 Risk Assessment).
//
// Provides a suggested maturity adjustment (integer delta on the CMM 1–5
// scale) so the downstream assessment run has a concrete recommendation
// rather than a vague warning.
export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Verify control exists + accessible
  const [ctrl] = await db
    .select({
      id: control.id,
      title: control.title,
      controlType: control.controlType,
      status: control.status,
    })
    .from(control)
    .where(
      and(
        eq(control.id, id),
        eq(control.orgId, ctx.orgId),
        isNull(control.deletedAt),
      ),
    );
  if (!ctrl) {
    return Response.json({ error: "Control not found" }, { status: 404 });
  }

  // All findings on this control (all sources — audit, control_test, etc.)
  const rows = await db
    .select({
      id: finding.id,
      title: finding.title,
      severity: finding.severity,
      status: finding.status,
      source: finding.source,
      auditId: finding.auditId,
      auditTitle: audit.title,
      elementId: workItem.elementId,
      createdAt: finding.createdAt,
    })
    .from(finding)
    .leftJoin(audit, eq(finding.auditId, audit.id))
    .leftJoin(workItem, eq(finding.workItemId, workItem.id))
    .where(
      and(
        eq(finding.controlId, id),
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
      ),
    )
    .orderBy(desc(finding.createdAt));

  const openStatuses = new Set(["identified", "in_remediation"]);
  const criticalSeverities = new Set([
    "improvement_requirement",
    "insignificant_nonconformity",
    "significant_nonconformity",
  ]);

  let openCount = 0;
  let openCritical = 0;
  const bySeverity: Record<string, number> = {};
  for (const f of rows) {
    if (openStatuses.has(f.status)) openCount++;
    if (openStatuses.has(f.status) && criticalSeverities.has(f.severity))
      openCritical++;
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
  }

  // Suggested maturity delta (CMM 1–5 scale):
  //  - 1 or more significant_nonconformity open → -2 levels
  //  - else 1 or more insignificant_nonconformity open → -1 level
  //  - else 1 or more improvement_requirement open → -1 level
  //  - else 0 (no negative audit evidence)
  let suggestedMaturityDelta = 0;
  const openSig = rows.filter(
    (f) =>
      openStatuses.has(f.status) && f.severity === "significant_nonconformity",
  ).length;
  const openInsig = rows.filter(
    (f) =>
      openStatuses.has(f.status) &&
      f.severity === "insignificant_nonconformity",
  ).length;
  const openImp = rows.filter(
    (f) =>
      openStatuses.has(f.status) && f.severity === "improvement_requirement",
  ).length;
  if (openSig > 0) suggestedMaturityDelta = -2;
  else if (openInsig > 0 || openImp > 0) suggestedMaturityDelta = -1;

  return Response.json({
    data: {
      control: ctrl,
      findingsTotal: rows.length,
      findingsBySeverity: bySeverity,
      openCount,
      openCritical,
      findings: rows,
      suggestedMaturityDelta,
    },
  });
}
