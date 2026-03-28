import { db, marketplaceInstallation } from "@grc/db";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { updateInstallationSchema } from "@grc/shared";

// GET /api/v1/marketplace/installations/:id
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const [row] = await db.select().from(marketplaceInstallation)
    .where(and(eq(marketplaceInstallation.id, id), eq(marketplaceInstallation.orgId, ctx.orgId)));
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
}

// PATCH /api/v1/marketplace/installations/:id
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const body = updateInstallationSchema.parse(await req.json());
  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx.update(marketplaceInstallation).set({ ...body, updatedAt: new Date() })
      .where(and(eq(marketplaceInstallation.id, id), eq(marketplaceInstallation.orgId, ctx.orgId))).returning();
    return updated;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}

// DELETE /api/v1/marketplace/installations/:id (uninstall)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;
  const result = await withAuditContext(ctx, async (tx) => {
    const [updated] = await tx.update(marketplaceInstallation).set({
      status: "uninstalled", uninstalledAt: new Date(), updatedAt: new Date(),
    }).where(and(eq(marketplaceInstallation.id, id), eq(marketplaceInstallation.orgId, ctx.orgId))).returning();
    return updated;
  });
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: { id: result.id, uninstalled: true } });
}
