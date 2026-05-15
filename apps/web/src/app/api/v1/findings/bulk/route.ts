// POST /api/v1/findings/bulk
//
// #WAVE21-B4: Bulk-create findings. Same contract as /risks/bulk —
// max 100 items per request, per-item audit-log entries.

import { finding, workItem } from "@grc/db";
import { createFindingSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { bulkExecute, bulkRequestSchema, type SafeParseable } from "@/lib/bulk";
import type { z } from "zod";

type FindingInput = z.infer<typeof createFindingSchema>;

export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth(
    "admin",
    "auditor",
    "risk_manager",
    "control_owner",
    "process_owner",
    "ciso",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const envelope = bulkRequestSchema.safeParse(await req.json());
  if (!envelope.success) {
    return Response.json(
      {
        error: "Bulk request must be {items: [...]}, max 100 items.",
        details: envelope.error.flatten(),
      },
      { status: 422 },
    );
  }

  const result = await bulkExecute<FindingInput, unknown>(
    envelope.data.items,
    createFindingSchema as unknown as SafeParseable<FindingInput>,
    async (data: FindingInput) => {
      return await withAuditContext(ctx, async (tx) => {
        const [wi] = await tx
          .insert(workItem)
          .values({
            orgId: ctx.orgId,
            typeKey: "finding",
            name: data.title,
            status: "draft",
            responsibleId: data.ownerId,
            grcPerspective: ["ics"],
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          })
          .returning();

        const [row] = await tx
          .insert(finding)
          .values({
            orgId: ctx.orgId,
            workItemId: wi.id,
            title: data.title,
            description: data.description,
            severity: data.severity,
            source: data.source,
            controlId: data.controlId,
            controlTestId: data.controlTestId,
            riskId: data.riskId,
            auditId: data.auditId,
            ownerId: data.ownerId,
            remediationPlan: data.remediationPlan,
            remediationDueDate: data.remediationDueDate,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          })
          .returning();
        return { ...row, elementId: wi.elementId };
      });
    },
  );

  return Response.json(result.body, { status: result.status });
});
