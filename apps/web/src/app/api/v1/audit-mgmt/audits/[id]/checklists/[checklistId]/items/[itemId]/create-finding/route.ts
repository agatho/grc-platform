import {
  db,
  finding,
  workItem,
  auditChecklistItem,
  auditChecklist,
  audit,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

type RouteParams = {
  params: Promise<{ id: string; checklistId: string; itemId: string }>;
};

// ISO 19011 § 3.4 — akzeptiert ISO-Werte UND Legacy-Synonyme (Migration 0293).
const createFindingFromItemSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  severity: z.enum([
    // ISO-konform
    "positive",
    "conforming",
    "opportunity_for_improvement",
    "minor_nonconformity",
    "major_nonconformity",
    // Legacy
    "observation",
    "recommendation",
    "improvement_requirement",
    "insignificant_nonconformity",
    "significant_nonconformity",
  ]),
  ownerId: z.string().uuid().optional(),
  remediationPlan: z.string().optional(),
  remediationDueDate: z.string().optional(),
  // Cross-module link to the ERM risk register. When set, downstream processes
  // (report, KRIs, risk reassessment prompt) pick this finding up as evidence
  // that the control mitigating that risk is not fully effective.
  riskId: z.string().uuid().optional(),
});

// POST /api/v1/audit-mgmt/audits/[id]/checklists/[checklistId]/items/[itemId]/create-finding
// Create a shared Finding from a nonconforming checklist item
export const POST = withErrorHandler(async function POST(
  req: Request,
  { params }: RouteParams,
) {
  const { id, checklistId, itemId } = await params;
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createFindingFromItemSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify the checklist item exists and belongs to this audit/org
  const [item] = await db
    .select({
      id: auditChecklistItem.id,
      controlId: auditChecklistItem.controlId,
      result: auditChecklistItem.result,
    })
    .from(auditChecklistItem)
    .innerJoin(
      auditChecklist,
      eq(auditChecklistItem.checklistId, auditChecklist.id),
    )
    .where(
      and(
        eq(auditChecklistItem.id, itemId),
        eq(auditChecklistItem.checklistId, checklistId),
        eq(auditChecklist.auditId, id),
        eq(auditChecklistItem.orgId, ctx.orgId),
      ),
    );

  if (!item) {
    return Response.json(
      { error: "Checklist item not found" },
      { status: 404 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    // Create work item
    const [wi] = await tx
      .insert(workItem)
      .values({
        orgId: ctx.orgId,
        typeKey: "finding",
        name: body.data.title,
        status: "draft",
        responsibleId: body.data.ownerId,
        grcPerspective: ["audit"],
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    // Create the shared finding with source='audit'
    const [row] = await tx
      .insert(finding)
      .values({
        orgId: ctx.orgId,
        workItemId: wi.id,
        title: body.data.title,
        description: body.data.description,
        severity: body.data.severity,
        source: "audit",
        controlId: item.controlId,
        auditId: id,
        riskId: body.data.riskId,
        ownerId: body.data.ownerId,
        remediationPlan: body.data.remediationPlan,
        remediationDueDate: body.data.remediationDueDate,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    // Update finding count on audit
    await tx
      .update(audit)
      .set({
        findingCount: sql`COALESCE(${audit.findingCount}, 0) + 1`,
        updatedAt: new Date(),
      })
      .where(eq(audit.id, id));

    return { ...row, elementId: wi.elementId };
  });

  return Response.json({ data: created }, { status: 201 });
});
