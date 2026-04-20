import { db, asset } from "@grc/db";
import { createAssetSchema } from "@grc/shared";
import { eq, and, isNull, count, desc, inArray, sql } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";
import type { AssetTier } from "@grc/shared";

// Valid tier hierarchy: child tier -> allowed parent tiers
const VALID_PARENT_TIERS: Record<AssetTier, AssetTier[]> = {
  business_structure: [], // top-level, no parent required
  primary_asset: ["business_structure"],
  supporting_asset: ["primary_asset"],
};

// POST /api/v1/assets — Create asset (admin only)
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = createAssetSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const { parentAssetId, assetTier } = body.data;

  // Validate tier hierarchy when parent is provided
  if (parentAssetId) {
    const [parent] = await db
      .select({
        id: asset.id,
        orgId: asset.orgId,
        assetTier: asset.assetTier,
      })
      .from(asset)
      .where(and(eq(asset.id, parentAssetId), isNull(asset.deletedAt)));

    if (!parent) {
      return Response.json(
        { error: "Parent asset not found" },
        { status: 422 },
      );
    }

    // Parent must be in same org
    if (parent.orgId !== ctx.orgId) {
      return Response.json(
        { error: "Parent asset must belong to the same organization" },
        { status: 422 },
      );
    }

    // Validate tier hierarchy
    const allowedParentTiers = VALID_PARENT_TIERS[assetTier];
    if (
      allowedParentTiers.length > 0 &&
      !allowedParentTiers.includes(parent.assetTier as AssetTier)
    ) {
      return Response.json(
        {
          error: `Invalid tier hierarchy: '${assetTier}' cannot have parent of tier '${parent.assetTier}'. Allowed parent tiers: ${allowedParentTiers.join(", ")}`,
        },
        { status: 422 },
      );
    }
  }

  // Compute protection goal class: GREATEST(C, I, A)
  const c = body.data.defaultConfidentiality;
  const i = body.data.defaultIntegrity;
  const a = body.data.defaultAvailability;
  const protectionGoalClass =
    c != null && i != null && a != null ? Math.max(c, i, a) : null;

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(asset)
      .values({
        orgId: ctx.orgId,
        name: body.data.name,
        description: body.data.description,
        assetTier: body.data.assetTier,
        codeGroup: body.data.codeGroup,
        defaultConfidentiality: body.data.defaultConfidentiality ?? null,
        defaultIntegrity: body.data.defaultIntegrity ?? null,
        defaultAvailability: body.data.defaultAvailability ?? null,
        defaultAuthenticity: body.data.defaultAuthenticity ?? null,
        defaultReliability: body.data.defaultReliability ?? null,
        protectionGoalClass,
        contactPerson: body.data.contactPerson,
        dataProtectionResponsible: body.data.dataProtectionResponsible,
        dpoEmail: body.data.dpoEmail,
        latestAuditDate: body.data.latestAuditDate,
        latestAuditResult: body.data.latestAuditResult,
        parentAssetId: body.data.parentAssetId ?? null,
        visibleInModules: body.data.visibleInModules,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/assets — List assets (paginated, filterable)
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [
    eq(asset.orgId, ctx.orgId),
    isNull(asset.deletedAt),
  ];

  // Filter by tier
  const tier = searchParams.get("tier");
  if (tier) {
    const validTiers: AssetTier[] = [
      "business_structure",
      "primary_asset",
      "supporting_asset",
    ];
    if (validTiers.includes(tier as AssetTier)) {
      conditions.push(eq(asset.assetTier, tier as AssetTier));
    }
  }

  // Filter by multiple tiers
  const tiers = searchParams.getAll("tiers");
  if (tiers.length > 0) {
    conditions.push(inArray(asset.assetTier, tiers as AssetTier[]));
  }

  // Filter by visible_in_modules (array overlap)
  const module = searchParams.get("module");
  if (module) {
    conditions.push(sql`${asset.visibleInModules} @> ARRAY[${module}]::text[]`);
  }

  // Search by name
  const search = searchParams.get("search");
  if (search) {
    conditions.push(sql`${asset.name} ILIKE ${"%" + search + "%"}`);
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(asset)
      .where(where)
      .orderBy(desc(asset.updatedAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(asset).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
