// GET /api/v1/vendors/[id]/risk-profile — Wave-24-D3 aggregated profile
//
// #WAVE24-D3: was 404. Each piece of vendor risk lives in its own
// table (vendor, vendor_risk_assessment, contract, ...) so callers had
// to make 4–5 round-trips to assemble a profile view. This endpoint
// returns a single aggregated payload covering:
//   • The vendor row itself (tier, criticality flags, current scores).
//   • The latest risk assessment + its scoring breakdown.
//   • Contract counts + total annual value (engaged contracts only).
//   • A simple risk-band classification derived from residualRiskScore.
//
// Read-only, so RBAC is the default `withAuth()` (any authenticated
// org member). RLS clips cross-tenant leakage as usual.

import { db, vendor, vendorRiskAssessment, contract } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";
import { requireUuidParam } from "@/lib/param-validation";

type IdCtx = { params: Promise<{ id: string }> };

// Banding mirrors the residual-risk thresholds used in the dashboard
// (low ≤ 33, medium ≤ 66, high otherwise). Single helper so the band
// boundaries stay one-source-of-truth.
function classifyRiskBand(score: number | null | undefined): string {
  if (score == null) return "unassessed";
  if (score >= 67) return "high";
  if (score >= 34) return "medium";
  return "low";
}

export const GET = withErrorHandler<IdCtx>(async function GET(req, { params }) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { id } = await params;
  requireUuidParam(id);

  // Vendor row.
  const [v] = await db
    .select({
      id: vendor.id,
      name: vendor.name,
      tier: vendor.tier,
      category: vendor.category,
      status: vendor.status,
      country: vendor.country,
      inherentRiskScore: vendor.inherentRiskScore,
      residualRiskScore: vendor.residualRiskScore,
      lastAssessmentDate: vendor.lastAssessmentDate,
      nextAssessmentDate: vendor.nextAssessmentDate,
      doraCriticalIct: vendor.doraCriticalIct,
      isLksgRelevant: vendor.isLksgRelevant,
      lksgTier: vendor.lksgTier,
      lksgTier1: vendor.lksgTier1,
    })
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

  // Latest scored assessment (history is keyed by assessmentDate desc).
  const [latestAssessment] = await db
    .select({
      id: vendorRiskAssessment.id,
      assessmentDate: vendorRiskAssessment.assessmentDate,
      inherentRiskScore: vendorRiskAssessment.inherentRiskScore,
      residualRiskScore: vendorRiskAssessment.residualRiskScore,
      confidentialityScore: vendorRiskAssessment.confidentialityScore,
      integrityScore: vendorRiskAssessment.integrityScore,
      availabilityScore: vendorRiskAssessment.availabilityScore,
      complianceScore: vendorRiskAssessment.complianceScore,
      financialScore: vendorRiskAssessment.financialScore,
      reputationScore: vendorRiskAssessment.reputationScore,
      riskTrend: vendorRiskAssessment.riskTrend,
      notes: vendorRiskAssessment.notes,
    })
    .from(vendorRiskAssessment)
    .where(
      and(
        eq(vendorRiskAssessment.vendorId, id),
        eq(vendorRiskAssessment.orgId, ctx.orgId),
      ),
    )
    .orderBy(desc(vendorRiskAssessment.assessmentDate))
    .limit(1);

  // Engaged-contract spend rollup — DORA monitoring tile uses the same
  // status filter as /tprm/concentration so the two views agree on
  // "currently engaged" semantics.
  const [contractSummary] = await db
    .select({
      count: sql<number>`count(*)::int`,
      totalAnnualValue: sql<string>`coalesce(sum(coalesce(${contract.annualValue}, 0)), 0)`,
    })
    .from(contract)
    .where(
      and(
        eq(contract.vendorId, id),
        eq(contract.orgId, ctx.orgId),
        isNull(contract.deletedAt),
        sql`${contract.status} in ('active','negotiation','renewal','pending_approval')`,
      ),
    );

  return Response.json({
    data: {
      vendor: v,
      inherentRiskScore: v.inherentRiskScore,
      residualRiskScore: v.residualRiskScore,
      riskBand: classifyRiskBand(v.residualRiskScore),
      latestAssessment: latestAssessment ?? null,
      contracts: {
        count: contractSummary?.count ?? 0,
        totalAnnualValue: Number(contractSummary?.totalAnnualValue ?? 0),
      },
      flags: {
        doraCriticalIct: v.doraCriticalIct,
        lksgRelevant: v.isLksgRelevant,
        lksgTier: v.lksgTier,
        lksgTier1: v.lksgTier1,
      },
      asOf: new Date().toISOString(),
    },
  });
});
