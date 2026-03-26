import { db, vendor, vendorRiskAssessment } from "@grc/db";
import { createVendorRiskAssessmentSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/vendors/:id/risk-assessments — Create risk assessment
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify vendor
  const [v] = await db
    .select({ id: vendor.id })
    .from(vendor)
    .where(and(eq(vendor.id, id), eq(vendor.orgId, ctx.orgId), isNull(vendor.deletedAt)));
  if (!v) {
    return Response.json({ error: "Vendor not found" }, { status: 404 });
  }

  const body = createVendorRiskAssessmentSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(vendorRiskAssessment)
      .values({
        vendorId: id,
        orgId: ctx.orgId,
        assessmentDate: body.data.assessmentDate,
        inherentRiskScore: body.data.inherentRiskScore,
        residualRiskScore: body.data.residualRiskScore,
        confidentialityScore: body.data.confidentialityScore,
        integrityScore: body.data.integrityScore,
        availabilityScore: body.data.availabilityScore,
        complianceScore: body.data.complianceScore,
        financialScore: body.data.financialScore,
        reputationScore: body.data.reputationScore,
        controlsApplied: body.data.controlsApplied ?? [],
        riskTrend: body.data.riskTrend,
        assessedBy: ctx.userId,
        notes: body.data.notes,
      })
      .returning();

    // Update vendor scores and dates
    const nextDate = new Date(body.data.assessmentDate);
    nextDate.setFullYear(nextDate.getFullYear() + 1);

    await tx
      .update(vendor)
      .set({
        inherentRiskScore: body.data.inherentRiskScore,
        residualRiskScore: body.data.residualRiskScore,
        lastAssessmentDate: body.data.assessmentDate,
        nextAssessmentDate: nextDate.toISOString().split("T")[0],
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(eq(vendor.id, id));

    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/vendors/:id/risk-assessments — List assessments
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const rows = await db
    .select()
    .from(vendorRiskAssessment)
    .where(
      and(
        eq(vendorRiskAssessment.vendorId, id),
        eq(vendorRiskAssessment.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(vendorRiskAssessment.assessmentDate));

  return Response.json({ data: rows });
}
