import { db, vendorConcentrationAnalysis } from "@grc/db";
import { computeHHI, classifyHHI } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// GET /api/v1/tprm/concentration?type=spend|single_source|geographic|technology
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const analysisType = url.searchParams.get("type") || "spend";

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

  return Response.json({ data: rows[0] || null });
}

// POST /api/v1/tprm/concentration/analyze — Trigger full concentration analysis
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("tprm", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // Compute HHI from vendor spend data (simplified — in production, join with cost entries)
  const today = new Date().toISOString().split("T")[0];

  const created = await withAuditContext(ctx, async (tx) => {
    // Placeholder spend analysis — in production this would query grc_cost_entry
    const spendData = { vendors: [], totalSpend: 0, hhi: 0 };
    const hhiScore = computeHHI([]);
    const riskLevel = classifyHHI(hhiScore);

    const [row] = await tx
      .insert(vendorConcentrationAnalysis)
      .values({
        orgId: ctx.orgId,
        analysisType: "spend",
        analysisDate: today,
        results: spendData,
        hhiScore,
        riskLevel,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}
