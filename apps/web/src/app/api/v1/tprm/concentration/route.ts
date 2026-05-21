import { db, vendor, contract, vendorConcentrationAnalysis } from "@grc/db";
import { computeHHI, classifyHHI } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/tprm/concentration?type=spend|single_source|geographic|technology
//
// #WAVE15-P2-02: Wave-14 QA reported `data: null` from this endpoint —
// the route only ever returned the latest stored snapshot from
// vendor_concentration_analysis, and that table is empty until POST
// /analyze is run. For a regulator-facing tile that's a non-starter,
// so the GET now computes the spend-share + HHI live from contracts
// when no snapshot is available. The snapshot path still wins so
// historical analyses (with their analyst-curated commentary) aren't
// shadowed by today's compute.
export const GET = withErrorHandler(async function GET(req: Request) {
  // #WAVE24-D4: vendor_manager + contract_manager added. They own
  // the vendor + contract data this view aggregates, so locking them
  // out of their own concentration tile made no sense. CISO read
  // access is also added — DORA Art. 28 expects the IS-responsible
  // role to monitor third-party concentration risk.
  const ctx = await withAuth(
    "admin",
    "risk_manager",
    "vendor_manager",
    "contract_manager",
    "ciso",
  );
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const analysisType = url.searchParams.get("type") || "spend";

  // Snapshot path — most-recent stored analysis wins.
  const rows = await db
    .select()
    .from(vendorConcentrationAnalysis)
    .where(
      and(
        eq(vendorConcentrationAnalysis.orgId, ctx.orgId),
        eq(vendorConcentrationAnalysis.analysisType, analysisType),
      ),
    )
    .orderBy(desc(vendorConcentrationAnalysis.analysisDate))
    .limit(1);

  if (rows[0]) {
    return Response.json({ data: { ...rows[0], source: "snapshot" } });
  }

  // Live fall-back. Only `spend` is computed today — the other types
  // still lean on the stored-snapshot path until their own aggregations
  // land (single_source needs a sub-processor join, geographic needs
  // country bucketing on the vendor row, technology needs a category
  // pivot). For those, return a typed empty payload so the UI knows
  // to render the "no analysis yet" empty state.
  if (analysisType !== "spend") {
    return Response.json({
      data: {
        analysisType,
        source: "live",
        hhiScore: 0,
        riskLevel: "low",
        results: {
          vendors: [],
          totalSpend: 0,
          note: "no live aggregation for this analysis type yet",
        },
      },
    });
  }

  const spendRows = await db
    .select({
      vendorId: contract.vendorId,
      vendorName: vendor.name,
      annualSpend: sql<string>`coalesce(sum(coalesce(${contract.annualValue}, 0)), 0)`,
    })
    .from(contract)
    .innerJoin(vendor, eq(contract.vendorId, vendor.id))
    .where(
      and(
        eq(contract.orgId, ctx.orgId),
        isNull(contract.deletedAt),
        isNull(vendor.deletedAt),
        // Only "engaged" contracts contribute to current spend.
        sql`${contract.status} in ('active','negotiation','renewal','pending_approval')`,
      ),
    )
    .groupBy(contract.vendorId, vendor.name);

  const vendors = spendRows
    .map((r) => ({
      vendorId: r.vendorId,
      vendorName: r.vendorName,
      annualSpend: Number(r.annualSpend ?? 0),
    }))
    .filter((v) => v.annualSpend > 0)
    .sort((a, b) => b.annualSpend - a.annualSpend);

  const totalSpend = vendors.reduce((sum, v) => sum + v.annualSpend, 0);
  const hhiScore = computeHHI(
    vendors.map((v) => ({ vendorId: v.vendorId ?? "", spend: v.annualSpend })),
  );
  const riskLevel = classifyHHI(hhiScore);

  return Response.json({
    data: {
      analysisType: "spend",
      source: "live",
      hhiScore,
      riskLevel,
      results: {
        vendors: vendors.map((v) => ({
          ...v,
          sharePct: totalSpend > 0 ? (v.annualSpend / totalSpend) * 100 : 0,
        })),
        totalSpend,
        vendorCount: vendors.length,
      },
    },
  });
});

// POST /api/v1/tprm/concentration/analyze — Trigger full concentration
// analysis. Snapshots the live computation into
// vendor_concentration_analysis so the analyst can attach commentary.
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const today = new Date().toISOString().split("T")[0];

  // Same query as the live GET path — kept inline so the snapshot is
  // self-contained and provably matches what GET returns.
  const spendRows = await db
    .select({
      vendorId: contract.vendorId,
      vendorName: vendor.name,
      annualSpend: sql<string>`coalesce(sum(coalesce(${contract.annualValue}, 0)), 0)`,
    })
    .from(contract)
    .innerJoin(vendor, eq(contract.vendorId, vendor.id))
    .where(
      and(
        eq(contract.orgId, ctx.orgId),
        isNull(contract.deletedAt),
        isNull(vendor.deletedAt),
        sql`${contract.status} in ('active','negotiation','renewal','pending_approval')`,
      ),
    )
    .groupBy(contract.vendorId, vendor.name);

  const vendors = spendRows
    .map((r) => ({
      vendorId: r.vendorId,
      vendorName: r.vendorName,
      annualSpend: Number(r.annualSpend ?? 0),
    }))
    .filter((v) => v.annualSpend > 0)
    .sort((a, b) => b.annualSpend - a.annualSpend);

  const totalSpend = vendors.reduce((sum, v) => sum + v.annualSpend, 0);
  const hhiScore = computeHHI(
    vendors.map((v) => ({ vendorId: v.vendorId ?? "", spend: v.annualSpend })),
  );
  const riskLevel = classifyHHI(hhiScore);

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(vendorConcentrationAnalysis)
      .values({
        orgId: ctx.orgId,
        analysisType: "spend",
        analysisDate: today,
        results: {
          vendors,
          totalSpend,
          vendorCount: vendors.length,
        },
        hhiScore,
        riskLevel,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
});
