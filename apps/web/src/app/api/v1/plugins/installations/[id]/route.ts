import { db, pluginInstallation } from "@grc/db";
import { updatePluginInstallationSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/plugins/installations/:id
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const [row] = await db
    .select()
    .from(pluginInstallation)
    .where(
      and(
        eq(pluginInstallation.id, id),
        eq(pluginInstallation.orgId, ctx.orgId),
      ),
    );

  if (!row) {
    return Response.json({ error: "Installation not found" }, { status: 404 });
  }

  return Response.json({ data: row });
}

// PATCH /api/v1/plugins/installations/:id
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const body = updatePluginInstallationSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [updated] = await db
    .update(pluginInstallation)
    .set({ ...body.data, updatedAt: new Date() })
    .where(
      and(
        eq(pluginInstallation.id, id),
        eq(pluginInstallation.orgId, ctx.orgId),
      ),
    )
    .returning();

  if (!updated) {
    return Response.json({ error: "Installation not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}

// DELETE /api/v1/plugins/installations/:id — Uninstall
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  const [deleted] = await db
    .delete(pluginInstallation)
    .where(
      and(
        eq(pluginInstallation.id, id),
        eq(pluginInstallation.orgId, ctx.orgId),
      ),
    )
    .returning();

  if (!deleted) {
    return Response.json({ error: "Installation not found" }, { status: 404 });
  }

  return Response.json({ data: { id } });
}
