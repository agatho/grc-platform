import { db, controlTestCampaign, controlTest, control } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

const campaignStatusSchema = z.object({
  status: z.enum(["draft", "active", "completed", "cancelled"]),
});

const VALID_CAMPAIGN_TRANSITIONS: Record<string, string[]> = {
  draft: ["active", "cancelled"],
  active: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

// PUT /api/v1/control-test-campaigns/:id/status — Activate/complete campaign
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(controlTestCampaign)
    .where(
      and(
        eq(controlTestCampaign.id, id),
        eq(controlTestCampaign.orgId, ctx.orgId),
        isNull(controlTestCampaign.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = campaignStatusSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const targetStatus = body.data.status;
  const currentStatus = existing.status;

  const allowed = VALID_CAMPAIGN_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(targetStatus)) {
    return Response.json(
      {
        error: `Invalid transition from '${currentStatus}' to '${targetStatus}'. Allowed: ${(allowed ?? []).join(", ")}`,
      },
      { status: 422 },
    );
  }

  // When activating, auto-create control tests for all active controls if none exist
  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(controlTestCampaign)
      .set({
        status: targetStatus,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(controlTestCampaign.id, id),
          eq(controlTestCampaign.orgId, ctx.orgId),
          isNull(controlTestCampaign.deletedAt),
        ),
      )
      .returning();

    // On activate: generate tests for controls that don't already have one in this campaign
    if (targetStatus === "active") {
      const existingTests = await tx
        .select({ controlId: controlTest.controlId })
        .from(controlTest)
        .where(
          and(
            eq(controlTest.campaignId, id),
            eq(controlTest.orgId, ctx.orgId),
            isNull(controlTest.deletedAt),
          ),
        );

      const existingControlIds = new Set(
        existingTests.map((t: { controlId: string }) => t.controlId),
      );

      const activeControls = await tx
        .select({ id: control.id })
        .from(control)
        .where(and(eq(control.orgId, ctx.orgId), isNull(control.deletedAt)));

      const newTests = activeControls
        .filter((c: { id: string }) => !existingControlIds.has(c.id))
        .map((c: { id: string }) => ({
          orgId: ctx.orgId,
          controlId: c.id,
          campaignId: id,
          testType: "design_effectiveness" as const,
          status: "planned" as const,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        }));

      if (newTests.length > 0) {
        await tx.insert(controlTest).values(newTests);
      }
    }

    return row;
  });

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}
