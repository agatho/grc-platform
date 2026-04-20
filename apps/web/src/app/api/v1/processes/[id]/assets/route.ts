import { db, process, processAsset, asset } from "@grc/db";
import { linkProcessAssetSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/processes/:id/assets — Link asset to process
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const body = linkProcessAssetSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify process exists and belongs to org
  const [existing] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  // Verify asset exists and belongs to same org
  const [assetRow] = await db
    .select({ id: asset.id })
    .from(asset)
    .where(
      and(
        eq(asset.id, body.data.assetId),
        eq(asset.orgId, ctx.orgId),
        isNull(asset.deletedAt),
      ),
    );

  if (!assetRow) {
    return Response.json(
      { error: "Asset not found in this organization" },
      { status: 422 },
    );
  }

  // Check duplicate
  const [duplicate] = await db
    .select({ id: processAsset.id })
    .from(processAsset)
    .where(
      and(
        eq(processAsset.processId, id),
        eq(processAsset.assetId, body.data.assetId),
      ),
    );

  if (duplicate) {
    return Response.json(
      { error: "Asset is already linked to this process" },
      { status: 409 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(processAsset)
      .values({
        orgId: ctx.orgId,
        processId: id,
        assetId: body.data.assetId,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: result }, { status: 201 });
}

// GET /api/v1/processes/:id/assets — List process-level assets
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify process exists and belongs to org
  const [existing] = await db
    .select({ id: process.id })
    .from(process)
    .where(
      and(
        eq(process.id, id),
        eq(process.orgId, ctx.orgId),
        isNull(process.deletedAt),
      ),
    );

  if (!existing) {
    return Response.json({ error: "Process not found" }, { status: 404 });
  }

  const assets = await db
    .select({
      linkId: processAsset.id,
      assetId: asset.id,
      name: asset.name,
      assetTier: asset.assetTier,
      description: asset.description,
      createdAt: processAsset.createdAt,
    })
    .from(processAsset)
    .innerJoin(asset, eq(processAsset.assetId, asset.id))
    .where(and(eq(processAsset.processId, id), isNull(asset.deletedAt)));

  return Response.json({ data: assets });
}
