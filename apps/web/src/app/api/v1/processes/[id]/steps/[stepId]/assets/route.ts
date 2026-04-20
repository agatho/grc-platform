import { db, process, processStep, processStepAsset, asset } from "@grc/db";
import { linkProcessAssetSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/processes/:id/steps/:stepId/assets — Link asset to step
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const ctx = await withAuth("admin", "process_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, stepId } = await params;

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

  // Verify step exists
  const [step] = await db
    .select({ id: processStep.id })
    .from(processStep)
    .where(
      and(
        eq(processStep.id, stepId),
        eq(processStep.processId, id),
        isNull(processStep.deletedAt),
      ),
    );

  if (!step) {
    return Response.json({ error: "Step not found" }, { status: 404 });
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
    .select({ id: processStepAsset.id })
    .from(processStepAsset)
    .where(
      and(
        eq(processStepAsset.processStepId, stepId),
        eq(processStepAsset.assetId, body.data.assetId),
      ),
    );

  if (duplicate) {
    return Response.json(
      { error: "Asset is already linked to this step" },
      { status: 409 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(processStepAsset)
      .values({
        orgId: ctx.orgId,
        processStepId: stepId,
        assetId: body.data.assetId,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: result }, { status: 201 });
}

// GET /api/v1/processes/:id/steps/:stepId/assets — List assets for step
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bpm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id, stepId } = await params;

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

  // Verify step exists
  const [step] = await db
    .select({ id: processStep.id })
    .from(processStep)
    .where(
      and(
        eq(processStep.id, stepId),
        eq(processStep.processId, id),
        isNull(processStep.deletedAt),
      ),
    );

  if (!step) {
    return Response.json({ error: "Step not found" }, { status: 404 });
  }

  const assets = await db
    .select({
      linkId: processStepAsset.id,
      assetId: asset.id,
      name: asset.name,
      assetTier: asset.assetTier,
      description: asset.description,
      createdAt: processStepAsset.createdAt,
    })
    .from(processStepAsset)
    .innerJoin(asset, eq(processStepAsset.assetId, asset.id))
    .where(
      and(eq(processStepAsset.processStepId, stepId), isNull(asset.deletedAt)),
    );

  return Response.json({ data: assets });
}
