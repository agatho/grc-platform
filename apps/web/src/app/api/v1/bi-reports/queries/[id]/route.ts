import { db, biQuery } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { updateBiQuerySchema } from "@grc/shared";

// GET /api/v1/bi-reports/queries/:id
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  const [row] = await db.select().from(biQuery)
    .where(and(eq(biQuery.id, id), eq(biQuery.orgId, ctx.orgId)));
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
}

// PATCH /api/v1/bi-reports/queries/:id
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  const body = updateBiQuerySchema.parse(await req.json());
  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx.update(biQuery).set({ ...body, updatedAt: new Date() })
      .where(and(eq(biQuery.id, id), eq(biQuery.orgId, ctx.orgId))).returning();
    return updated;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}

// DELETE /api/v1/bi-reports/queries/:id
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;
  const { id } = await params;
  const result = await withAuditContext(ctx, async (tx) => {
    const [deleted] = await tx.delete(biQuery)
      .where(and(eq(biQuery.id, id), eq(biQuery.orgId, ctx.orgId))).returning();
    return deleted;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: { id: result.id, deleted: true } });
}
