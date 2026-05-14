// GET /api/v1/dora/critical-vendors
//
// #WAVE14D-P1-07: Wave-14 QA flagged this as a 404. DORA Art. 28-30
// (TPRM for ICT third parties + register of all ICT services from
// critical providers) requires a discoverable list of vendors flagged
// `tier=critical`. Without it the DORA dashboard has no way to assemble
// the "critical ICT third parties" register and the cross-module
// TPRM-Critical → DORA chain is broken.
//
// This is a thin denormalized view: vendor row + the vendor's open
// contracts + the vendor's most recent due-diligence date. The DORA
// dashboard joins this with ict_provider rows to mark which TPRM
// vendors qualify as ICT under DORA Art. 3 §19.

import { db, vendor, contract, vendorDueDiligence } from "@grc/db";
import { requireModule } from "@grc/auth";
import { and, eq, isNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  // dora module gate (same key the rest of /api/v1/dora/* uses)
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Pull every vendor with tier=critical for the active org. Soft-deleted
  // vendors are excluded — the regulator wants the live operational list.
  const vendors = await db
    .select({
      id: vendor.id,
      name: vendor.name,
      legalName: vendor.legalName,
      category: vendor.category,
      tier: vendor.tier,
      status: vendor.status,
      country: vendor.country,
      inherentRiskScore: vendor.inherentRiskScore,
      residualRiskScore: vendor.residualRiskScore,
      lastAssessmentDate: vendor.lastAssessmentDate,
      nextAssessmentDate: vendor.nextAssessmentDate,
      ownerId: vendor.ownerId,
    })
    .from(vendor)
    .where(
      and(
        eq(vendor.orgId, ctx.orgId),
        eq(vendor.tier, "critical"),
        isNull(vendor.deletedAt),
      ),
    )
    .orderBy(sql`coalesce(${vendor.residualRiskScore}, 0) desc`);

  if (vendors.length === 0) {
    return Response.json({
      data: {
        total: 0,
        vendors: [],
        coverage: {
          assessedRecently: 0,
          activeContracts: 0,
        },
      },
    });
  }

  // Active-contract counts per vendor — DORA wants to know whether a
  // critical TPRM relationship is currently consuming services or
  // dormant. `active|negotiation|renewal|pending_approval` all count
  // as "engaged".
  const vendorIds = vendors.map((v) => v.id);
  const contractRows = await db
    .select({
      vendorId: contract.vendorId,
      activeCount: sql<number>`count(*) filter (where ${contract.status} in ('active','negotiation','renewal','pending_approval'))::int`,
      totalCount: sql<number>`count(*)::int`,
    })
    .from(contract)
    .where(
      and(
        eq(contract.orgId, ctx.orgId),
        isNull(contract.deletedAt),
        sql`${contract.vendorId} = ANY(${vendorIds})`,
      ),
    )
    .groupBy(contract.vendorId);
  const contractsByVendor = new Map(contractRows.map((r) => [r.vendorId, r]));

  // Most-recent completed due-diligence per vendor — a critical vendor
  // with no DD on file is a regulatory finding waiting to happen.
  const ddRows = await db
    .select({
      vendorId: vendorDueDiligence.vendorId,
      completedAt: sql<string | null>`max(${vendorDueDiligence.completedAt})`,
    })
    .from(vendorDueDiligence)
    .where(
      and(
        eq(vendorDueDiligence.orgId, ctx.orgId),
        sql`${vendorDueDiligence.vendorId} = ANY(${vendorIds})`,
        eq(vendorDueDiligence.status, "completed"),
      ),
    )
    .groupBy(vendorDueDiligence.vendorId);
  const ddByVendor = new Map(ddRows.map((r) => [r.vendorId, r.completedAt]));

  const enriched = vendors.map((v) => {
    const c = contractsByVendor.get(v.id);
    return {
      ...v,
      activeContracts: c?.activeCount ?? 0,
      totalContracts: c?.totalCount ?? 0,
      lastDueDiligenceCompletedAt: ddByVendor.get(v.id) ?? null,
    };
  });

  // Coverage roll-ups for the dashboard tile.
  const now = Date.now();
  const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
  const assessedRecently = enriched.filter(
    (v) =>
      v.lastAssessmentDate &&
      new Date(v.lastAssessmentDate).getTime() > oneYearAgo,
  ).length;
  const activeContracts = enriched.reduce(
    (sum, v) => sum + v.activeContracts,
    0,
  );

  return Response.json({
    data: {
      total: enriched.length,
      vendors: enriched,
      coverage: {
        assessedRecently,
        activeContracts,
      },
    },
  });
});
