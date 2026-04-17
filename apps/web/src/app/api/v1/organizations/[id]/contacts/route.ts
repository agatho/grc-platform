import { db, organizationContact } from "@grc/db";
import { createOrganizationContactSchema } from "@grc/shared";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/organizations/[id]/contacts — List contacts for an org
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  // Ensure user has access to this org
  if (ctx.orgId !== id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const contacts = await db
    .select()
    .from(organizationContact)
    .where(
      and(
        eq(organizationContact.orgId, id),
        isNull(organizationContact.deletedAt),
      ),
    )
    .orderBy(organizationContact.roleType, desc(organizationContact.isPrimary));

  return Response.json({ data: contacts });
}

// POST /api/v1/organizations/[id]/contacts — Create contact
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const { id } = await params;

  if (ctx.orgId !== id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createOrganizationContactSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    // If isPrimary is true, unset other primaries for the same roleType
    if (parsed.data.isPrimary) {
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

    const [created] = await tx
      .insert(organizationContact)
      .values({
        ...parsed.data,
        orgId: id,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
