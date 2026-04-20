import { db, risk, riskAsset, asset } from "@grc/db";
import { eq, and, isNull, count } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { z } from "zod";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

const createAssetLinkSchema = z.object({
  assetId: z.string().uuid(),
});

// POST /api/v1/risks/:id/asset-links — Link risk to asset
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify risk exists in org
  const [existing] = await db
    .select({ id: risk.id })
    .from(risk)
    .where(
      and(eq(risk.id, id), eq(risk.orgId, ctx.orgId), isNull(risk.deletedAt)),
    );

  if (!existing) {
    return Response.json({ error: "Risk not found" }, { status: 404 });
  }

  const body = createAssetLinkSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify asset exists in same org
  const [existingAsset] = await db
    .select({ id: asset.id })
    .from(asset)
    .where(
      and(
        eq(asset.id, body.data.assetId),
        eq(asset.orgId, ctx.orgId),
        isNull(asset.deletedAt),
      ),
    );

  if (!existingAsset) {
    return Response.json(
      { error: "Asset not found in this organization" },
      { status: 422 },
    );
  }

  // Check for duplicate link
  const [dup] = await db
    .select({ id: riskAsset.id })
    .from(riskAsset)
    .where(
      and(
        eq(riskAsset.riskId, id),
        eq(riskAsset.assetId, body.data.assetId),
        eq(riskAsset.orgId, ctx.orgId),
      ),
    );

  if (dup) {
    return Response.json(
      { error: "This risk is already linked to this asset" },
      { status: 409 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(riskAsset)
      .values({
        orgId: ctx.orgId,
        riskId: id,
        assetId: body.data.assetId,
        createdBy: ctx.userId,
      })
      .returning();

    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/risks/:id/asset-links — List asset links for risk
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify risk exists in org
  const [existing] = await db
    .select({ id: risk.id })
    .from(risk)
    .where(
      and(eq(risk.id, id), eq(risk.orgId, ctx.orgId), isNull(risk.deletedAt)),
    );

  if (!existing) {
    return Response.json({ error: "Risk not found" }, { status: 404 });
  }

  const { page, limit, offset } = paginate(req);

  const conditions = and(
    eq(riskAsset.riskId, id),
    eq(riskAsset.orgId, ctx.orgId),
  );

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: riskAsset.id,
        orgId: riskAsset.orgId,
        riskId: riskAsset.riskId,
        assetId: riskAsset.assetId,
        assetName: asset.name,
        assetTier: asset.assetTier,
        createdAt: riskAsset.createdAt,
        createdBy: riskAsset.createdBy,
      })
      .from(riskAsset)
      .leftJoin(asset, eq(riskAsset.assetId, asset.id))
      .where(conditions)
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(riskAsset).where(conditions),
  ]);

  return paginatedResponse(items, total, page, limit);
}
