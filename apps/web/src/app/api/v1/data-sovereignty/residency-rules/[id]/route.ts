import { db, dataResidencyRule } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { updateDataResidencyRuleSchema } from "@grc/shared";

// GET /api/v1/data-sovereignty/residency-rules/:id
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const [row] = await db.select().from(dataResidencyRule)
    .where(and(eq(dataResidencyRule.id, id), eq(dataResidencyRule.orgId, ctx.orgId)));
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
}

// PATCH /api/v1/data-sovereignty/residency-rules/:id
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const body = updateDataResidencyRuleSchema.parse(await req.json());
  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx.update(dataResidencyRule).set({ ...body, updatedAt: new Date() })
      .where(and(eq(dataResidencyRule.id, id), eq(dataResidencyRule.orgId, ctx.orgId))).returning();
    return updated;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}

// DELETE /api/v1/data-sovereignty/residency-rules/:id
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const result = await withAuditContext(ctx, async (tx) => {
    const [deleted] = await tx.delete(dataResidencyRule)
      .where(and(eq(dataResidencyRule.id, id), eq(dataResidencyRule.orgId, ctx.orgId))).returning();
    return deleted;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: { id: result.id, deleted: true } });
}
