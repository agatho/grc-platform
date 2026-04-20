import { db, vendor, workItem, user, contract } from "@grc/db";
import {
  updateVendorSchema,
  VALID_VENDOR_TRANSITIONS,
  vendorStatusTransitionSchema,
} from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, count } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/vendors/:id — Vendor detail
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [row] = await db
    .select({
      id: vendor.id,
      orgId: vendor.orgId,
      workItemId: vendor.workItemId,
      elementId: workItem.elementId,
      name: vendor.name,
      legalName: vendor.legalName,
      description: vendor.description,
      category: vendor.category,
      tier: vendor.tier,
      status: vendor.status,
      country: vendor.country,
      address: vendor.address,
      website: vendor.website,
      taxId: vendor.taxId,
      inherentRiskScore: vendor.inherentRiskScore,
      residualRiskScore: vendor.residualRiskScore,
      lastAssessmentDate: vendor.lastAssessmentDate,
      nextAssessmentDate: vendor.nextAssessmentDate,
      isLksgRelevant: vendor.isLksgRelevant,
      lksgTier: vendor.lksgTier,
      ownerId: vendor.ownerId,
      ownerName: user.name,
      ownerEmail: user.email,
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt,
      createdBy: vendor.createdBy,
    })
    .from(vendor)
    .leftJoin(workItem, eq(vendor.workItemId, workItem.id))
    .leftJoin(user, eq(vendor.ownerId, user.id))
    .where(
      and(
        eq(vendor.id, id),
        eq(vendor.orgId, ctx.orgId),
        isNull(vendor.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Count linked contracts
  const [{ value: contractCount }] = await db
    .select({ value: count() })
    .from(contract)
    .where(and(eq(contract.vendorId, id), isNull(contract.deletedAt)));

  return Response.json({ data: { ...row, contractCount } });
}

// PUT /api/v1/vendors/:id — Update vendor (also handles status transitions)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const rawBody = await req.json();

  // Check if this is a status transition
  if (rawBody.status && Object.keys(rawBody).length === 1) {
    const parsed = vendorStatusTransitionSchema.safeParse(rawBody);
    if (!parsed.success) {
      return Response.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const [current] = await db
      .select({ status: vendor.status })
      .from(vendor)
      .where(
        and(
          eq(vendor.id, id),
          eq(vendor.orgId, ctx.orgId),
          isNull(vendor.deletedAt),
        ),
      );

    if (!current) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const validTransitions = VALID_VENDOR_TRANSITIONS[current.status] ?? [];
    if (!validTransitions.includes(parsed.data.status)) {
      return Response.json(
        {
          error: `Invalid transition from '${current.status}' to '${parsed.data.status}'`,
          validTransitions,
        },
        { status: 422 },
      );
    }

    const [updated] = await withAuditContext(ctx, async (tx) =>
      tx
        .update(vendor)
        .set({
          status: parsed.data.status,
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        })
        .where(and(eq(vendor.id, id), eq(vendor.orgId, ctx.orgId)))
        .returning(),
    );

    return Response.json({ data: updated });
  }

  // Regular update
  const body = updateVendorSchema.safeParse(rawBody);
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(vendor)
      .set({
        ...body.data,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(vendor.id, id),
          eq(vendor.orgId, ctx.orgId),
          isNull(vendor.deletedAt),
        ),
      )
      .returning();
    return row;
  });

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}

// DELETE /api/v1/vendors/:id — Soft delete
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(vendor)
      .set({
        deletedAt: new Date(),
        deletedBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .where(
        and(
          eq(vendor.id, id),
          eq(vendor.orgId, ctx.orgId),
          isNull(vendor.deletedAt),
        ),
      )
      .returning({ id: vendor.id });
    return row;
  });

  if (!deleted) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: { id: deleted.id, deleted: true } });
}
