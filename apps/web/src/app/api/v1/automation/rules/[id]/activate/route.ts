import { db, automationRule } from "@grc/db";
import { activateRuleSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// PUT /api/v1/automation/rules/:id/activate — Toggle rule active state (admin only)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const body = activateRuleSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify rule exists and belongs to org
  const [existing] = await db
    .select({ id: automationRule.id })
    .from(automationRule)
    .where(and(eq(automationRule.id, id), eq(automationRule.orgId, ctx.orgId)));

  if (!existing) {
    return Response.json({ error: "Rule not found" }, { status: 404 });
  }

  const [updated] = await db
    .update(automationRule)
    .set({
      isActive: body.data.isActive,
      updatedAt: new Date(),
    })
    .where(eq(automationRule.id, id))
    .returning();

  return Response.json({ data: updated });
}
