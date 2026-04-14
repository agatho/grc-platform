import { db, vendor, lksgAssessment } from "@grc/db";
import { createLksgAssessmentSchema, updateLksgAssessmentSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/lksg/:vendorId/assessment — Create LkSG assessment
export async function POST(
  req: Request,
  { params }: { params: Promise<{ vendorId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { vendorId } = await params;

  // Verify vendor
  const [v] = await db
    .select({ id: vendor.id })
    .from(vendor)
    .where(
      and(
        eq(vendor.id, vendorId),
        eq(vendor.orgId, ctx.orgId),
        isNull(vendor.deletedAt),
        eq(vendor.isLksgRelevant, true),
      ),
    );
  if (!v) {
    return Response.json(
      { error: "Vendor not found or not marked as LkSG-relevant" },
      { status: 404 },
    );
  }

  const body = createLksgAssessmentSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(lksgAssessment)
      .values({
        vendorId,
        orgId: ctx.orgId,
        assessmentDate: body.data.assessmentDate,
        lksgTier: body.data.lksgTier,
        riskAreas: body.data.riskAreas ?? [],
        mitigationPlans: body.data.mitigationPlans ?? [],
        overallRiskLevel: body.data.overallRiskLevel,
        assessedBy: ctx.userId,
        status: "draft",
      })
      .returning();

    // Update vendor lksgTier
    await tx
      .update(vendor)
      .set({ lksgTier: body.data.lksgTier, updatedBy: ctx.userId, updatedAt: new Date() })
      .where(eq(vendor.id, vendorId));

    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// PUT /api/v1/lksg/:vendorId/assessment — Update latest LkSG assessment
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ vendorId: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "dpo");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { vendorId } = await params;

  const body = updateLksgAssessmentSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Find the latest assessment for this vendor
  const [existing] = await db
    .select({ id: lksgAssessment.id })
    .from(lksgAssessment)
    .where(
      and(eq(lksgAssessment.vendorId, vendorId), eq(lksgAssessment.orgId, ctx.orgId)),
    )
    .orderBy(desc(lksgAssessment.createdAt))
    .limit(1);

  if (!existing) {
    return Response.json({ error: "No assessment found" }, { status: 404 });
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(lksgAssessment)
      .set({
        ...body.data,
        updatedAt: new Date(),
      })
      .where(eq(lksgAssessment.id, existing.id))
      .returning();
    return row;
  });

  return Response.json({ data: updated });
}

// GET /api/v1/lksg/:vendorId/assessment — List assessments for vendor
export async function GET(
  req: Request,
  { params }: { params: Promise<{ vendorId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { vendorId } = await params;

  const rows = await db
    .select()
    .from(lksgAssessment)
    .where(
      and(eq(lksgAssessment.vendorId, vendorId), eq(lksgAssessment.orgId, ctx.orgId)),
    )
    .orderBy(desc(lksgAssessment.assessmentDate));

  return Response.json({ data: rows });
}
