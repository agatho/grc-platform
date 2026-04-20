import { db, finding, riskTreatment, workItem } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/v1/findings/[id]/sync-treatment
// Create or update a risk_treatment entry derived from this finding's
// remediation plan + due date. Requires finding.riskId to be set.
//
// Closes the Audit → ERM feedback loop (ISO 27001 9.2 / 10.2, ISO 31000 6.6,
// IIA 2120): when an auditor records a remediation plan on a nonconforming
// finding that is linked to a specific risk, that plan becomes the formal
// risk treatment in the register. Idempotent per finding work_item.
export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "auditor", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // 1. Load the finding; verify access + that it has the required fields.
  const [f] = await db
    .select({
      id: finding.id,
      workItemId: finding.workItemId,
      riskId: finding.riskId,
      title: finding.title,
      remediationPlan: finding.remediationPlan,
      remediationDueDate: finding.remediationDueDate,
      ownerId: finding.ownerId,
      severity: finding.severity,
    })
    .from(finding)
    .where(
      and(
        eq(finding.id, id),
        eq(finding.orgId, ctx.orgId),
        isNull(finding.deletedAt),
      ),
    );

  if (!f) {
    return Response.json({ error: "Finding not found" }, { status: 404 });
  }
  if (!f.riskId) {
    return Response.json(
      {
        error:
          "Finding has no riskId — link a risk first before syncing a treatment.",
      },
      { status: 422 },
    );
  }
  if (!f.remediationPlan) {
    return Response.json(
      { error: "Finding has no remediation plan to sync." },
      { status: 422 },
    );
  }

  // 2. Upsert by workItemId (each finding has exactly one work item).
  const treatmentDescription = f.title
    ? `${f.title}\n\n${f.remediationPlan}`
    : f.remediationPlan;

  const result = await withAuditContext(ctx, async (tx) => {
    const [existing] = await tx
      .select()
      .from(riskTreatment)
      .where(
        and(
          eq(riskTreatment.riskId, f.riskId!),
          eq(riskTreatment.workItemId, f.workItemId!),
          isNull(riskTreatment.deletedAt),
        ),
      );

    if (existing) {
      const [updated] = await tx
        .update(riskTreatment)
        .set({
          description: treatmentDescription,
          dueDate: f.remediationDueDate ?? undefined,
          responsibleId: f.ownerId ?? undefined,
          updatedAt: new Date(),
          updatedBy: ctx.userId,
        })
        .where(eq(riskTreatment.id, existing.id))
        .returning();
      return { operation: "updated", treatment: updated };
    }

    const [inserted] = await tx
      .insert(riskTreatment)
      .values({
        orgId: ctx.orgId,
        riskId: f.riskId!,
        workItemId: f.workItemId,
        description: treatmentDescription,
        responsibleId: f.ownerId ?? undefined,
        dueDate: f.remediationDueDate ?? undefined,
        status: "planned",
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    return { operation: "created", treatment: inserted };
  });

  return Response.json({ data: result }, { status: 201 });
}
