import {
  db,
  ropaEntry,
  ropaDataCategory,
  ropaDataSubject,
  ropaRecipient,
  user,
} from "@grc/db";
import { updateRopaEntrySchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/dpms/ropa/:id — Full RoPA detail
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [row] = await db
    .select({
      id: ropaEntry.id,
      orgId: ropaEntry.orgId,
      workItemId: ropaEntry.workItemId,
      title: ropaEntry.title,
      purpose: ropaEntry.purpose,
      legalBasis: ropaEntry.legalBasis,
      legalBasisDetail: ropaEntry.legalBasisDetail,
      controllerOrgId: ropaEntry.controllerOrgId,
      processorName: ropaEntry.processorName,
      processingDescription: ropaEntry.processingDescription,
      retentionPeriod: ropaEntry.retentionPeriod,
      retentionJustification: ropaEntry.retentionJustification,
      technicalMeasures: ropaEntry.technicalMeasures,
      organizationalMeasures: ropaEntry.organizationalMeasures,
      internationalTransfer: ropaEntry.internationalTransfer,
      transferCountry: ropaEntry.transferCountry,
      transferSafeguard: ropaEntry.transferSafeguard,
      status: ropaEntry.status,
      lastReviewed: ropaEntry.lastReviewed,
      nextReviewDate: ropaEntry.nextReviewDate,
      responsibleId: ropaEntry.responsibleId,
      responsibleName: user.name,
      createdAt: ropaEntry.createdAt,
      updatedAt: ropaEntry.updatedAt,
      createdBy: ropaEntry.createdBy,
    })
    .from(ropaEntry)
    .leftJoin(user, eq(ropaEntry.responsibleId, user.id))
    .where(
      and(
        eq(ropaEntry.id, id),
        eq(ropaEntry.orgId, ctx.orgId),
        isNull(ropaEntry.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const [categories, subjects, recipients] = await Promise.all([
    db
      .select()
      .from(ropaDataCategory)
      .where(and(eq(ropaDataCategory.ropaEntryId, id), eq(ropaDataCategory.orgId, ctx.orgId))),
    db
      .select()
      .from(ropaDataSubject)
      .where(and(eq(ropaDataSubject.ropaEntryId, id), eq(ropaDataSubject.orgId, ctx.orgId))),
    db
      .select()
      .from(ropaRecipient)
      .where(and(eq(ropaRecipient.ropaEntryId, id), eq(ropaRecipient.orgId, ctx.orgId))),
  ]);

  return Response.json({ data: { ...row, categories, subjects, recipients } });
}

// PUT /api/v1/dpms/ropa/:id — Update RoPA entry
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(ropaEntry)
    .where(
      and(
        eq(ropaEntry.id, id),
        eq(ropaEntry.orgId, ctx.orgId),
        isNull(ropaEntry.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = updateRopaEntrySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(ropaEntry)
      .set({
        ...body.data,
        updatedAt: new Date(),
      })
      .where(eq(ropaEntry.id, id))
      .returning();
    return row;
  });

  return Response.json({ data: updated });
}

// DELETE /api/v1/dpms/ropa/:id — Soft-delete RoPA entry
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("dpms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(ropaEntry)
    .where(
      and(
        eq(ropaEntry.id, id),
        eq(ropaEntry.orgId, ctx.orgId),
        isNull(ropaEntry.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await withAuditContext(ctx, async (tx) => {
    await tx
      .update(ropaEntry)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(ropaEntry.id, id));
  });

  return Response.json({ success: true });
}
