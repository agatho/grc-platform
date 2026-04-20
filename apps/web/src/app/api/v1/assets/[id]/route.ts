import { db, asset } from "@grc/db";
import { updateAssetSchema } from "@grc/shared";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import type { AssetTier } from "@grc/shared";

// Valid tier hierarchy: child tier -> allowed parent tiers
const VALID_PARENT_TIERS: Record<AssetTier, AssetTier[]> = {
  business_structure: [],
  primary_asset: ["business_structure"],
  supporting_asset: ["primary_asset"],
};

// GET /api/v1/assets/:id — Asset detail
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const [row] = await db
    .select()
    .from(asset)
    .where(
      and(
        eq(asset.id, id),
        eq(asset.orgId, ctx.orgId),
        isNull(asset.deletedAt),
      ),
    );

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: row });
}

// PUT /api/v1/assets/:id — Update asset (admin only)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  // Fetch existing asset
  const [existing] = await db
    .select()
    .from(asset)
    .where(
      and(
        eq(asset.id, id),
        eq(asset.orgId, ctx.orgId),
        isNull(asset.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = updateAssetSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Validate tier hierarchy if parent or tier is changing
  const newTier = (body.data.assetTier ?? existing.assetTier) as AssetTier;
  const newParentId =
    body.data.parentAssetId !== undefined
      ? body.data.parentAssetId
      : existing.parentAssetId;

  if (newParentId) {
    // Cannot be own parent
    if (newParentId === id) {
      return Response.json(
        { error: "Asset cannot be its own parent" },
        { status: 422 },
      );
    }

    const [parent] = await db
      .select({
        id: asset.id,
        orgId: asset.orgId,
        assetTier: asset.assetTier,
      })
      .from(asset)
      .where(and(eq(asset.id, newParentId), isNull(asset.deletedAt)));

    if (!parent) {
      return Response.json(
        { error: "Parent asset not found" },
        { status: 422 },
      );
    }

    if (parent.orgId !== ctx.orgId) {
      return Response.json(
        { error: "Parent asset must belong to the same organization" },
        { status: 422 },
      );
    }

    const allowedParentTiers = VALID_PARENT_TIERS[newTier];
    if (
      allowedParentTiers.length > 0 &&
      !allowedParentTiers.includes(parent.assetTier as AssetTier)
    ) {
      return Response.json(
        {
          error: `Invalid tier hierarchy: '${newTier}' cannot have parent of tier '${parent.assetTier}'. Allowed parent tiers: ${allowedParentTiers.join(", ")}`,
        },
        { status: 422 },
      );
    }
  }

  // Compute protection goal class from merged values
  const c =
    body.data.defaultConfidentiality !== undefined
      ? body.data.defaultConfidentiality
      : existing.defaultConfidentiality;
  const i =
    body.data.defaultIntegrity !== undefined
      ? body.data.defaultIntegrity
      : existing.defaultIntegrity;
  const a =
    body.data.defaultAvailability !== undefined
      ? body.data.defaultAvailability
      : existing.defaultAvailability;
  const protectionGoalClass =
    c != null && i != null && a != null ? Math.max(c, i, a) : null;

  const updated = await withAuditContext(ctx, async (tx) => {
    const updateValues: Record<string, unknown> = {
      updatedBy: ctx.userId,
      updatedAt: new Date(),
      protectionGoalClass,
    };

    if (body.data.name !== undefined) updateValues.name = body.data.name;
    if (body.data.description !== undefined)
      updateValues.description = body.data.description;
    if (body.data.assetTier !== undefined)
      updateValues.assetTier = body.data.assetTier;
    if (body.data.codeGroup !== undefined)
      updateValues.codeGroup = body.data.codeGroup;
    if (body.data.defaultConfidentiality !== undefined)
      updateValues.defaultConfidentiality = body.data.defaultConfidentiality;
    if (body.data.defaultIntegrity !== undefined)
      updateValues.defaultIntegrity = body.data.defaultIntegrity;
    if (body.data.defaultAvailability !== undefined)
      updateValues.defaultAvailability = body.data.defaultAvailability;
    if (body.data.defaultAuthenticity !== undefined)
      updateValues.defaultAuthenticity = body.data.defaultAuthenticity;
    if (body.data.defaultReliability !== undefined)
      updateValues.defaultReliability = body.data.defaultReliability;
    if (body.data.contactPerson !== undefined)
      updateValues.contactPerson = body.data.contactPerson;
    if (body.data.dataProtectionResponsible !== undefined)
      updateValues.dataProtectionResponsible =
        body.data.dataProtectionResponsible;
    if (body.data.dpoEmail !== undefined)
      updateValues.dpoEmail = body.data.dpoEmail;
    if (body.data.latestAuditDate !== undefined)
      updateValues.latestAuditDate = body.data.latestAuditDate;
    if (body.data.latestAuditResult !== undefined)
      updateValues.latestAuditResult = body.data.latestAuditResult;
    if (body.data.parentAssetId !== undefined)
      updateValues.parentAssetId = body.data.parentAssetId;
    if (body.data.visibleInModules !== undefined)
      updateValues.visibleInModules = body.data.visibleInModules;

    const [row] = await tx
      .update(asset)
      .set(updateValues)
      .where(
        and(
          eq(asset.id, id),
          eq(asset.orgId, ctx.orgId),
          isNull(asset.deletedAt),
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

// DELETE /api/v1/assets/:id — Soft delete (admin only)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(asset)
      .set({
        deletedAt: new Date(),
        deletedBy: ctx.userId,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(asset.id, id),
          eq(asset.orgId, ctx.orgId),
          isNull(asset.deletedAt),
        ),
      )
      .returning({ id: asset.id });

    return row;
  });

  if (!deleted) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: { id, deleted: true } });
}
