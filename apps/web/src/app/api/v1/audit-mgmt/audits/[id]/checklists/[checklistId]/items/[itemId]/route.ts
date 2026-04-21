import { db, auditChecklistItem, auditChecklist } from "@grc/db";
import { evaluateChecklistItemSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

type RouteParams = {
  params: Promise<{ id: string; checklistId: string; itemId: string }>;
};

// PUT /api/v1/audit-mgmt/audits/[id]/checklists/[checklistId]/items/[itemId]
// Evaluate a checklist item (result + notes + evidence)
export async function PUT(req: Request, { params }: RouteParams) {
  const { id, checklistId, itemId } = await params;
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = evaluateChecklistItemSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify checklist belongs to audit and org
  const [checklist] = await db
    .select()
    .from(auditChecklist)
    .where(
      and(
        eq(auditChecklist.id, checklistId),
        eq(auditChecklist.auditId, id),
        eq(auditChecklist.orgId, ctx.orgId),
      ),
    );

  if (!checklist) {
    return Response.json({ error: "Checklist not found" }, { status: 404 });
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(auditChecklistItem)
      .set({
        result: body.data.result,
        notes: body.data.notes,
        evidenceIds: body.data.evidenceIds,
        // ISO 19011 / ISO 17021-1 Arbeitspapier-Felder
        criterionReference: body.data.criterionReference,
        auditMethod: body.data.auditMethod,
        interviewee: body.data.interviewee,
        intervieweeRole: body.data.intervieweeRole,
        sampleSize: body.data.sampleSize,
        sampleIds: body.data.sampleIds,
        riskRating: body.data.riskRating,
        correctiveActionSuggestion: body.data.correctiveActionSuggestion,
        remediationDeadline: body.data.remediationDeadline,
        completedAt: new Date(),
        completedBy: ctx.userId,
      })
      .where(
        and(
          eq(auditChecklistItem.id, itemId),
          eq(auditChecklistItem.checklistId, checklistId),
          eq(auditChecklistItem.orgId, ctx.orgId),
        ),
      )
      .returning();

    if (!row) return null;

    // Update completed count on checklist
    const [countResult] = await tx
      .select({
        completed: sql<number>`COUNT(*) FILTER (WHERE ${auditChecklistItem.result} IS NOT NULL)`,
      })
      .from(auditChecklistItem)
      .where(eq(auditChecklistItem.checklistId, checklistId));

    await tx
      .update(auditChecklist)
      .set({ completedItems: countResult.completed })
      .where(eq(auditChecklist.id, checklistId));

    return row;
  });

  if (!updated) {
    return Response.json(
      { error: "Checklist item not found" },
      { status: 404 },
    );
  }

  return Response.json({ data: updated });
}
