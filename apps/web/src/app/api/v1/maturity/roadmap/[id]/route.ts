import { db, maturityRoadmapItem } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { updateMaturityRoadmapItemSchema } from "@grc/shared";

// GET /api/v1/maturity/roadmap/:id
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  const [row] = await db.select().from(maturityRoadmapItem)
    .where(and(eq(maturityRoadmapItem.id, id), eq(maturityRoadmapItem.orgId, ctx.orgId)));
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
}

// PATCH /api/v1/maturity/roadmap/:id
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  const body = updateMaturityRoadmapItemSchema.parse(await req.json());
  const updateData: Record<string, unknown> = { ...body, updatedAt: new Date() };
  if (body.dueDate) updateData.dueDate = new Date(body.dueDate);
  if (body.status === "completed") updateData.completedAt = new Date();
  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx.update(maturityRoadmapItem).set(updateData)
      .where(and(eq(maturityRoadmapItem.id, id), eq(maturityRoadmapItem.orgId, ctx.orgId))).returning();
    return updated;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}

// DELETE /api/v1/maturity/roadmap/:id
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  const result = await withAuditContext(ctx, async (tx) => {
    const [deleted] = await tx.delete(maturityRoadmapItem)
      .where(and(eq(maturityRoadmapItem.id, id), eq(maturityRoadmapItem.orgId, ctx.orgId))).returning();
    return deleted;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: { id: result.id, deleted: true } });
}
