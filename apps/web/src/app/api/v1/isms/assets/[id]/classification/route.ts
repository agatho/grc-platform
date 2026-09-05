import { db, assetClassification, asset } from "@grc/db";
import { requireModule } from "@grc/auth";
import { classifyAssetSchema } from "@grc/shared";
import { eq, and } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import type { ProtectionLevel } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

function computeOverall(
  c: ProtectionLevel,
  i: ProtectionLevel,
  a: ProtectionLevel,
): ProtectionLevel {
  if (c === "very_high" || i === "very_high" || a === "very_high")
    return "very_high";
  if (c === "high" || i === "high" || a === "high") return "high";
  return "normal";
}

// GET /api/v1/isms/assets/[id]/classification
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: assetId } = await params;

  const rows = await db
    .select()
    .from(assetClassification)
    .where(
      and(
        eq(assetClassification.orgId, ctx.orgId),
        eq(assetClassification.assetId, assetId),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    return Response.json({ data: null });
  }

  return Response.json({ data: rows[0] });
});
// PUT /api/v1/isms/assets/[id]/classification
export const PUT = withErrorHandler(async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id: assetId } = await params;

  const body = await req.json();
  const parsed = classifyAssetSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  // Verify asset exists in org
  const assets = await db
    .select({ id: asset.id })
    .from(asset)
    .where(and(eq(asset.id, assetId), eq(asset.orgId, ctx.orgId)))
    .limit(1);

  if (assets.length === 0) {
    return Response.json({ error: "Asset not found" }, { status: 404 });
  }

  const data = parsed.data;
  const overall = computeOverall(
    data.confidentialityLevel,
    data.integrityLevel,
    data.availabilityLevel,
  );

  const result = await withAuditContext(ctx, async (tx) => {
    // Upsert — one classification per asset
    const existing = await tx
      .select({ id: assetClassification.id })
      .from(assetClassification)
      .where(
        and(
          eq(assetClassification.orgId, ctx.orgId),
          eq(assetClassification.assetId, assetId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await tx
        .update(assetClassification)
        .set({
          confidentialityLevel: data.confidentialityLevel,
          confidentialityReason: data.confidentialityReason ?? null,
          integrityLevel: data.integrityLevel,
          integrityReason: data.integrityReason ?? null,
          availabilityLevel: data.availabilityLevel,
          availabilityReason: data.availabilityReason ?? null,
          overallProtection: overall,
          classifiedAt: new Date(),
          classifiedBy: ctx.userId,
          reviewDate: data.reviewDate ?? null,
          updatedAt: new Date(),
        })
        .where(eq(assetClassification.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await tx
      .insert(assetClassification)
      .values({
        orgId: ctx.orgId,
        assetId,
        confidentialityLevel: data.confidentialityLevel,
        confidentialityReason: data.confidentialityReason ?? null,
        integrityLevel: data.integrityLevel,
        integrityReason: data.integrityReason ?? null,
        availabilityLevel: data.availabilityLevel,
        availabilityReason: data.availabilityReason ?? null,
        overallProtection: overall,
        classifiedBy: ctx.userId,
        reviewDate: data.reviewDate ?? null,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 200 });
});
