// GET /api/v1/vendors/[id]/assessments/schema — Wave-25-C2
//
// #WAVE25-C2: Wave-24 QA reported `POST /vendors/{id}/assessments`
// returning 422 with no easy way to figure out the required body
// shape. The endpoint itself is an alias of
// /vendors/{id}/risk-assessments (Wave-24-D2), which uses the
// vendor_risk_assessment table — 8 numeric score columns plus
// assessmentDate. Without a discovery endpoint, callers had to dig
// through @grc/shared to find `createVendorRiskAssessmentSchema`.
//
// This endpoint mirrors the Wave-24 audit-activity and ESG-measurement
// schema-discovery surface: required/optional fields + an example
// body guaranteed to be accepted by POST.

import { db, vendor } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireUuidParam } from "@/lib/param-validation";

type IdCtx = { params: Promise<{ id: string }> };

export const GET = withErrorHandler<IdCtx>(async function GET(req, { params }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  requireUuidParam(id);

  // Verify the vendor exists in the caller's org so /schema isn't a
  // cross-tenant existence oracle.
  const [v] = await db
    .select({ id: vendor.id })
    .from(vendor)
    .where(
      and(
        eq(vendor.id, id),
        eq(vendor.orgId, ctx.orgId),
        isNull(vendor.deletedAt),
      ),
    );
  if (!v) {
    return Response.json({ error: "Vendor not found" }, { status: 404 });
  }

  return Response.json({
    data: {
      endpoint: `/api/v1/vendors/${id}/assessments`,
      aliasOf: `/api/v1/vendors/${id}/risk-assessments`,
      method: "POST",
      contentType: "application/json",
      fields: {
        assessmentDate: {
          type: "date",
          required: true,
          format: "YYYY-MM-DD",
          description: "Date the assessment was performed.",
        },
        inherentRiskScore: {
          type: "integer",
          required: true,
          minimum: 1,
          maximum: 25,
          description:
            "Composite score before mitigating controls (likelihood × impact).",
        },
        residualRiskScore: {
          type: "integer",
          required: true,
          minimum: 1,
          maximum: 25,
          description: "Composite score after current controls.",
        },
        confidentialityScore: {
          type: "integer",
          required: false,
          minimum: 1,
          maximum: 5,
          description:
            "CIA-triad confidentiality dimension (1=low risk, 5=high).",
        },
        integrityScore: {
          type: "integer",
          required: false,
          minimum: 1,
          maximum: 5,
        },
        availabilityScore: {
          type: "integer",
          required: false,
          minimum: 1,
          maximum: 5,
        },
        complianceScore: {
          type: "integer",
          required: false,
          minimum: 1,
          maximum: 5,
        },
        financialScore: {
          type: "integer",
          required: false,
          minimum: 1,
          maximum: 5,
        },
        reputationScore: {
          type: "integer",
          required: false,
          minimum: 1,
          maximum: 5,
        },
        controlsApplied: {
          type: "array<object>",
          required: false,
          description:
            "Freeform list of controls that informed the residual score.",
        },
        riskTrend: {
          type: "enum",
          required: false,
          values: ["improving", "stable", "deteriorating"],
        },
        notes: {
          type: "string",
          required: false,
          description: "Free-form narrative.",
        },
      },
      example: {
        assessmentDate: "2026-05-21",
        inherentRiskScore: 16,
        residualRiskScore: 9,
        confidentialityScore: 4,
        integrityScore: 3,
        availabilityScore: 4,
        complianceScore: 3,
        financialScore: 2,
        reputationScore: 3,
        riskTrend: "stable",
        notes: "Initial assessment based on SOC 2 Type II + ISO 27001 cert.",
      },
    },
  });
});
