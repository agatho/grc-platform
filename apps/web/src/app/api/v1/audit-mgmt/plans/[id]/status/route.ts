import { db, auditPlan } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

const VALID_PLAN_TRANSITIONS: Record<string, string[]> = {
  draft: ["approved"],
  approved: ["active", "draft"],
  active: ["completed"],
  completed: [],
};

const planStatusSchema = z.object({
  status: z.enum(["draft", "approved", "active", "completed"]),
});

// PUT /api/v1/audit-mgmt/plans/[id]/status — Approval workflow
export async function PUT(req: Request, { params }: RouteParams) {
  const { id } = await params;
  const ctx = await withAuth("admin", "auditor", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = planStatusSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [existing] = await db
    .select()
    .from(auditPlan)
    .where(and(eq(auditPlan.id, id), eq(auditPlan.orgId, ctx.orgId)));

  if (!existing) {
    return Response.json({ error: "Audit plan not found" }, { status: 404 });
  }

  const allowed = VALID_PLAN_TRANSITIONS[existing.status] ?? [];
  if (!allowed.includes(body.data.status)) {
    return Response.json(
      {
        error: `Cannot transition from '${existing.status}' to '${body.data.status}'`,
        allowedTransitions: allowed,
      },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const setValues: Record<string, unknown> = {
      status: body.data.status,
      updatedAt: new Date(),
    };

    if (body.data.status === "approved") {
      setValues.approvedBy = ctx.userId;
      setValues.approvedAt = new Date();
    }

    const [row] = await tx
      .update(auditPlan)
      .set(setValues)
      .where(and(eq(auditPlan.id, id), eq(auditPlan.orgId, ctx.orgId)))
      .returning();
    return row;
  });

  return Response.json({ data: updated });
}
