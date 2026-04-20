import { db, generalCatalogEntry } from "@grc/db";
import { updateGeneralCatalogEntrySchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/catalogs/objects/[id] — Object detail
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const [entry] = await db
    .select()
    .from(generalCatalogEntry)
    .where(
      and(
        eq(generalCatalogEntry.id, id),
        eq(generalCatalogEntry.orgId, ctx.orgId),
        isNull(generalCatalogEntry.deletedAt),
      ),
    );

  if (!entry) {
    return Response.json({ error: "Object not found" }, { status: 404 });
  }

  return Response.json({ data: entry });
}

// PUT /api/v1/catalogs/objects/[id] — Update object
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "control_owner",
    "process_owner",
  );
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const body = updateGeneralCatalogEntrySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(generalCatalogEntry)
      .set({ ...body.data, updatedAt: new Date() })
      .where(
        and(
          eq(generalCatalogEntry.id, id),
          eq(generalCatalogEntry.orgId, ctx.orgId),
          isNull(generalCatalogEntry.deletedAt),
        ),
      )
      .returning();
    return row;
  });

  if (!updated) {
    return Response.json({ error: "Object not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}

// DELETE /api/v1/catalogs/objects/[id] — Soft delete object
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(generalCatalogEntry)
      .set({ deletedAt: new Date(), deletedBy: ctx.userId })
      .where(
        and(
          eq(generalCatalogEntry.id, id),
          eq(generalCatalogEntry.orgId, ctx.orgId),
          isNull(generalCatalogEntry.deletedAt),
        ),
      )
      .returning();
    return row;
  });

  if (!deleted) {
    return Response.json({ error: "Object not found" }, { status: 404 });
  }

  return Response.json({ data: { id: deleted.id, deleted: true } });
}
