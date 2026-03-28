import { db, copilotConversation } from "@grc/db";
import { updateConversationSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/copilot/conversations/:id
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner", "process_owner", "auditor", "dpo", "viewer");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const [conv] = await db
    .select()
    .from(copilotConversation)
    .where(and(eq(copilotConversation.id, id), eq(copilotConversation.orgId, ctx.orgId)));

  if (!conv) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: conv });
}

// PATCH /api/v1/copilot/conversations/:id
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner", "process_owner", "auditor", "dpo", "viewer");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const body = updateConversationSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx
      .update(copilotConversation)
      .set({ ...body.data, updatedAt: new Date() })
      .where(and(eq(copilotConversation.id, id), eq(copilotConversation.orgId, ctx.orgId)))
      .returning();
    return updated;
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}

// DELETE /api/v1/copilot/conversations/:id
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner", "process_owner", "auditor", "dpo", "viewer");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const result = await withAuditContext(ctx, async (tx) => {
    const [deleted] = await tx
      .delete(copilotConversation)
      .where(and(eq(copilotConversation.id, id), eq(copilotConversation.orgId, ctx.orgId)))
      .returning();
    return deleted;
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: { id } });
}
