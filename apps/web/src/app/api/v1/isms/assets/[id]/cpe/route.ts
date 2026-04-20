import { db, assetCpe, asset } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { assignAssetCpeSchema } from "@grc/shared";
import { extractCpeVendorProduct } from "@grc/shared";

// GET /api/v1/isms/assets/:id/cpe — Get CPE identifiers for asset
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify asset belongs to org
  const [assetRow] = await db
    .select({ id: asset.id })
    .from(asset)
    .where(and(eq(asset.id, id), eq(asset.orgId, ctx.orgId)))
    .limit(1);

  if (!assetRow) {
    return Response.json({ error: "Asset not found" }, { status: 404 });
  }

  const cpes = await db
    .select()
    .from(assetCpe)
    .where(and(eq(assetCpe.assetId, id), eq(assetCpe.orgId, ctx.orgId)));

  return Response.json({ data: cpes });
}

// POST /api/v1/isms/assets/:id/cpe — Assign CPE to asset
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const body = await req.json();
  const parsed = assignAssetCpeSchema.safeParse({ ...body, assetId: id });
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Verify asset belongs to org
  const [assetRow] = await db
    .select({ id: asset.id })
    .from(asset)
    .where(and(eq(asset.id, id), eq(asset.orgId, ctx.orgId)))
    .limit(1);

  if (!assetRow) {
    return Response.json({ error: "Asset not found" }, { status: 404 });
  }

  // Extract vendor/product from CPE if not provided
  const cpeInfo = extractCpeVendorProduct(parsed.data.cpeUri);

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(assetCpe)
      .values({
        assetId: id,
        orgId: ctx.orgId,
        cpeUri: parsed.data.cpeUri,
        vendor: parsed.data.vendor ?? cpeInfo?.vendor ?? null,
        product: parsed.data.product ?? cpeInfo?.product ?? null,
        version: parsed.data.version ?? cpeInfo?.version ?? null,
        createdBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}

// DELETE /api/v1/isms/assets/:id/cpe — Remove CPE from asset
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  const url = new URL(req.url);
  const cpeId = url.searchParams.get("cpeId");

  if (!cpeId) {
    return Response.json(
      { error: "cpeId query parameter required" },
      { status: 400 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const deleted = await tx
      .delete(assetCpe)
      .where(
        and(
          eq(assetCpe.id, cpeId),
          eq(assetCpe.assetId, id),
          eq(assetCpe.orgId, ctx.orgId),
        ),
      )
      .returning({ id: assetCpe.id });
    return deleted;
  });

  if (result.length === 0) {
    return Response.json({ error: "CPE not found" }, { status: 404 });
  }

  return Response.json({ data: { deleted: true } });
}
