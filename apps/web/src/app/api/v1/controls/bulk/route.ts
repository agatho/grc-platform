// POST /api/v1/controls/bulk
//
// #WAVE21-B4: Bulk-create controls. Same contract as /risks/bulk —
// max 100 items per request, per-item audit-log entries.

import { control, workItem } from "@grc/db";
import { createControlSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { withAuth, withAuditContext } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { bulkExecute, bulkRequestSchema, type SafeParseable } from "@/lib/bulk";

// Manual type — see comment in /risks/bulk/route.ts on why we don't
// use z.infer here.
interface ControlInput {
  title: string;
  description?: string;
  controlType: string;
  frequency?: string;
  automationLevel?: string;
  assertions?: string[];
  ownerId?: string;
  department?: string;
  objective?: string;
  testInstructions?: string;
  reviewDate?: string;
  costOnetime?: number;
  costAnnual?: number;
  effortHours?: number;
  budgetId?: string;
  costNote?: string;
}

export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "control_owner", "process_owner");
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

  const result = await bulkExecute<ControlInput, unknown>(
    envelope.data.items,
    createControlSchema as unknown as SafeParseable<ControlInput>,
    async (data: ControlInput) => {
      return await withAuditContext(ctx, async (tx) => {
        const [wi] = await tx
          .insert(workItem)
          .values({
            orgId: ctx.orgId,
            typeKey: "control",
            name: data.title,
            status: "draft",
            responsibleId: data.ownerId,
            grcPerspective: ["ics"],
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
          })
          .returning();

        const [row] = await tx
          .insert(control)
          .values({
            orgId: ctx.orgId,
            workItemId: wi.id,
            title: data.title,
            description: data.description,
            controlType: data.controlType,
            frequency: data.frequency,
            automationLevel: data.automationLevel,
            assertions: data.assertions,
            ownerId: data.ownerId,
            department: data.department,
            objective: data.objective,
            testInstructions: data.testInstructions,
            reviewDate: data.reviewDate,
            costOnetime: data.costOnetime,
            costAnnual: data.costAnnual,
            effortHours: data.effortHours,
            budgetId: data.budgetId,
            costNote: data.costNote,
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
