import { db, grcRoiCalculation } from "@grc/db";
import { roniScenarioSchema } from "@grc/shared";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// POST /api/v1/roni/scenario — Budget cut scenario analysis
// "If budget is cut by X%, which treatments drop and what is the new RONI?"
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const body = roniScenarioSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const { cutPercent } = body.data;

  // Get all ROI calculations with investment costs
  const calculations = await db
    .select({
      entityType: grcRoiCalculation.entityType,
      entityId: grcRoiCalculation.entityId,
      investmentCost: grcRoiCalculation.investmentCost,
      riskReductionValue: grcRoiCalculation.riskReductionValue,
      roiPercent: grcRoiCalculation.roiPercent,
      inherentAle: grcRoiCalculation.inherentAle,
      residualAle: grcRoiCalculation.residualAle,
    })
    .from(grcRoiCalculation)
    .where(
      and(
        eq(grcRoiCalculation.orgId, ctx.orgId),
        isNotNull(grcRoiCalculation.investmentCost),
      ),
    )
    .orderBy(sql`${grcRoiCalculation.roiPercent} ASC NULLS FIRST`);

  const totalBudget = calculations.reduce(
    (sum, c) => sum + Number(c.investmentCost ?? 0),
    0,
  );
  const cutAmount = totalBudget * (cutPercent / 100);

  // Drop lowest ROI entities first until cut amount is reached
  let accumulated = 0;
  const droppedTreatments: Array<{
    entityType: string;
    entityId: string;
    investmentCost: number;
    roiPercent: number | null;
    aleIncrease: number;
  }> = [];
  let newRoni = 0;

  for (const calc of calculations) {
    if (accumulated >= cutAmount) break;

    const cost = Number(calc.investmentCost ?? 0);
    const aleReduction =
      Number(calc.inherentAle ?? 0) - Number(calc.residualAle ?? 0);

    droppedTreatments.push({
      entityType: calc.entityType,
      entityId: calc.entityId,
      investmentCost: cost,
      roiPercent: calc.roiPercent ? Number(calc.roiPercent) : null,
      aleIncrease: aleReduction,
    });

    accumulated += cost;
    newRoni += aleReduction;
  }

  // Current baseline RONI (sum of all ALE reductions that would be lost)
  const currentTotalAleReduction = calculations.reduce(
    (sum, c) =>
      sum + (Number(c.inherentAle ?? 0) - Number(c.residualAle ?? 0)),
    0,
  );

  return Response.json({
    data: {
      cutPercent,
      totalBudget: Math.round(totalBudget * 100) / 100,
      cutAmount: Math.round(cutAmount * 100) / 100,
      actualCutAmount: Math.round(accumulated * 100) / 100,
      droppedTreatments,
      droppedCount: droppedTreatments.length,
      newRoni: Math.round(newRoni * 100) / 100,
      deltaRoni: Math.round(newRoni * 100) / 100,
      currentTotalAleReduction: Math.round(currentTotalAleReduction * 100) / 100,
      remainingProtection:
        Math.round((currentTotalAleReduction - newRoni) * 100) / 100,
    },
  });
}
