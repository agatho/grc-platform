import { db, finding, workItem, user, audit } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, isNull, desc } from "drizzle-orm";
import { withAuth } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

// GET /api/v1/risks/[id]/findings
// All findings linked to this risk via finding.riskId, enriched with the
// audit title (if the finding originated from an audit) and work item's
// elementId for human-readable cross-referencing.
export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const rows = await db
    .select({
      id: finding.id,
      title: finding.title,
      description: finding.description,
      severity: finding.severity,
      status: finding.status,
      source: finding.source,
      elementId: workItem.elementId,
      auditId: finding.auditId,
      auditTitle: audit.title,
      controlId: finding.controlId,
      ownerId: finding.ownerId,
      ownerName: user.name,
      remediationPlan: finding.remediationPlan,
      remediationDueDate: finding.remediationDueDate,
      remediatedAt: finding.remediatedAt,
      verifiedAt: finding.verifiedAt,
      createdAt: finding.createdAt,
      updatedAt: finding.updatedAt,
    })
    .from(finding)
    .leftJoin(workItem, eq(finding.workItemId, workItem.id))
    .leftJoin(audit, eq(finding.auditId, audit.id))
    .leftJoin(user, eq(finding.ownerId, user.id))
    .where(
      and(
        eq(finding.riskId, id),
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
      ),
    )
    .orderBy(desc(finding.createdAt));

  return Response.json({ data: rows });
}
