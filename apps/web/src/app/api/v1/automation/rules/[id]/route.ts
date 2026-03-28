import { db, automationRule } from "@grc/db";
import { updateAutomationRuleSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/automation/rules/:id — Rule detail (admin only)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const [rule] = await db
    .select()
    .from(automationRule)
    .where(and(eq(automationRule.id, id), eq(automationRule.orgId, ctx.orgId)));

  if (!rule) {
    return Response.json({ error: "Rule not found" }, { status: 404 });
  }

  return Response.json({ data: rule });
}

// PUT /api/v1/automation/rules/:id — Update rule (admin only)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const body = updateAutomationRuleSchema.safeParse(await req.json());
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
      ...body.data,
      updatedAt: new Date(),
    })
    .where(eq(automationRule.id, id))
    .returning();

  return Response.json({ data: updated });
}

// DELETE /api/v1/automation/rules/:id — Delete rule (admin only)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const [existing] = await db
    .select({ id: automationRule.id })
    .from(automationRule)
    .where(and(eq(automationRule.id, id), eq(automationRule.orgId, ctx.orgId)));

  if (!existing) {
    return Response.json({ error: "Rule not found" }, { status: 404 });
  }

  await db.delete(automationRule).where(eq(automationRule.id, id));

  return Response.json({ success: true });
}
