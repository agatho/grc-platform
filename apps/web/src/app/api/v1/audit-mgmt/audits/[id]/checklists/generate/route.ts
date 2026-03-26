import { db, auditChecklist, auditChecklistItem, audit, control } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/v1/audit-mgmt/audits/[id]/checklists/generate
// Auto-generate checklist from controls in scope (frameworks/departments/processes)
export async function POST(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Get the audit
  const [existing] = await db
    .select()
    .from(audit)
    .where(
      and(
        eq(audit.id, id),
        eq(audit.orgId, ctx.orgId),
        isNull(audit.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Audit not found" }, { status: 404 });
  }

  // Find controls in scope for this org
  const controlConditions = [
    eq(control.orgId, ctx.orgId),
    isNull(control.deletedAt),
  ];

  // If audit has scopeFrameworks, filter controls by framework
  // For now, fetch all active controls for the org
  const controls = await db
    .select({
      id: control.id,
      title: control.title,
      description: control.description,
    })
    .from(control)
    .where(and(...controlConditions))
    .limit(200);

  if (controls.length === 0) {
    return Response.json(
      { error: "No controls found in scope to generate checklist" },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    // Create the checklist
    const [checklist] = await tx
      .insert(auditChecklist)
      .values({
        orgId: ctx.orgId,
        auditId: id,
        name: `Auto-generated Checklist - ${existing.title}`,
        sourceType: "auto_controls",
        totalItems: controls.length,
        completedItems: 0,
        createdBy: ctx.userId,
      })
      .returning();

    // Create checklist items from controls
    const items = controls.map((ctrl, idx) => ({
      orgId: ctx.orgId,
      checklistId: checklist.id,
      controlId: ctrl.id,
      question: `Is control "${ctrl.title}" effectively implemented and operating?`,
      expectedEvidence: ctrl.description
        ? `Evidence of: ${ctrl.description.substring(0, 200)}`
        : undefined,
      sortOrder: idx + 1,
    }));

    const createdItems = await tx
      .insert(auditChecklistItem)
      .values(items)
      .returning();

    return {
      checklist,
      itemCount: createdItems.length,
    };
  });

  return Response.json({ data: created }, { status: 201 });
}
