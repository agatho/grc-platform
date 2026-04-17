import { db, organizationContact } from "@grc/db";
import { updateOrganizationContactSchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/organizations/[id]/contacts/[contactId]
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const { id, contactId } = await params;

  if (ctx.orgId !== id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const [row] = await db
    .select()
    .from(organizationContact)
    .where(
      and(
        eq(organizationContact.id, contactId),
        eq(organizationContact.orgId, id),
        isNull(organizationContact.deletedAt),
      ),
    );

  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: row });
}

// PUT /api/v1/organizations/[id]/contacts/[contactId]
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id, contactId } = await params;

  if (ctx.orgId !== id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = updateOrganizationContactSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    // If setting as primary, unset others
    if (parsed.data.isPrimary && parsed.data.roleType) {
      await tx
        .update(organizationContact)
        .set({ isPrimary: false })
        .where(
          and(
            eq(organizationContact.orgId, id),
            eq(organizationContact.roleType, parsed.data.roleType),
            isNull(organizationContact.deletedAt),
          ),
        );
    }

    const [updated] = await tx
      .update(organizationContact)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      })
      .where(
        and(
          eq(organizationContact.id, contactId),
          eq(organizationContact.orgId, id),
        ),
      )
      .returning();
    return updated;
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: result });
}

// DELETE /api/v1/organizations/[id]/contacts/[contactId] (soft delete)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id, contactId } = await params;

  if (ctx.orgId !== id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [deleted] = await tx
      .update(organizationContact)
      .set({ deletedAt: new Date(), updatedBy: ctx.userId })
      .where(
        and(
          eq(organizationContact.id, contactId),
          eq(organizationContact.orgId, id),
          isNull(organizationContact.deletedAt),
        ),
      )
      .returning();
    return deleted;
  });

  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ data: { deleted: true } });
}
