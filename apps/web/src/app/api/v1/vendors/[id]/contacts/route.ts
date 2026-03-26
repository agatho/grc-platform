import { db, vendor, vendorContact } from "@grc/db";
import { createVendorContactSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/vendors/:id/contacts — Add contact
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify vendor exists in org
  const [v] = await db
    .select({ id: vendor.id })
    .from(vendor)
    .where(and(eq(vendor.id, id), eq(vendor.orgId, ctx.orgId), isNull(vendor.deletedAt)));
  if (!v) {
    return Response.json({ error: "Vendor not found" }, { status: 404 });
  }

  const body = createVendorContactSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    // If this is primary, unset other primary contacts
    if (body.data.isPrimary) {
      await tx
        .update(vendorContact)
        .set({ isPrimary: false })
        .where(and(eq(vendorContact.vendorId, id), eq(vendorContact.isPrimary, true)));
    }

    const [row] = await tx
      .insert(vendorContact)
      .values({
        vendorId: id,
        orgId: ctx.orgId,
        name: body.data.name,
        email: body.data.email,
        phone: body.data.phone,
        role: body.data.role,
        isPrimary: body.data.isPrimary,
      })
      .returning();

    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/vendors/:id/contacts — List contacts
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const contacts = await db
    .select()
    .from(vendorContact)
    .where(and(eq(vendorContact.vendorId, id), eq(vendorContact.orgId, ctx.orgId)))
    .orderBy(desc(vendorContact.isPrimary), vendorContact.name);

  return Response.json({ data: contacts });
}
