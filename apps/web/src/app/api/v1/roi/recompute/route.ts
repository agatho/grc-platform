import { db, grcRoiCalculation, grcCostEntry } from "@grc/db";
import { roiRecomputeSchema } from "@grc/shared";
import { eq, and, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/roi/recompute — Force recalculate ROI for all entities (or a specific one)
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const body = roiRecomputeSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    // Get distinct entity type/id combinations from cost entries
    const costConditions = [eq(grcCostEntry.orgId, ctx.orgId)];
    if (body.data.entityType) {
      costConditions.push(eq(grcCostEntry.entityType, body.data.entityType));
    }
    if (body.data.entityId) {
      costConditions.push(eq(grcCostEntry.entityId, body.data.entityId));
    }

    const entities = await tx
      .select({
        entityType: grcCostEntry.entityType,
        entityId: grcCostEntry.entityId,
        totalCost: sql<string>`SUM(CASE WHEN ${grcCostEntry.costType} = 'actual' THEN ${grcCostEntry.amount} ELSE 0 END)`,
      })
      .from(grcCostEntry)
      .where(and(...costConditions))
      .groupBy(grcCostEntry.entityType, grcCostEntry.entityId);

    let computed = 0;

    for (const entity of entities) {
      const investmentCost = Number(entity.totalCost);
      if (investmentCost <= 0) continue;

      // Check if we have an existing ROI calculation to get risk reduction values
      const [existing] = await tx
        .select()
        .from(grcRoiCalculation)
        .where(
          and(
            eq(grcRoiCalculation.orgId, ctx.orgId),
            eq(grcRoiCalculation.entityType, entity.entityType),
            eq(grcRoiCalculation.entityId, entity.entityId),
          ),
        );

      const riskReductionValue = existing
        ? Number(existing.riskReductionValue ?? 0)
        : 0;
      const roiPercent =
        investmentCost > 0
          ? ((riskReductionValue - investmentCost) / investmentCost) * 100
          : 0;

      const values = {
        orgId: ctx.orgId,
        entityType: entity.entityType,
        entityId: entity.entityId,
        investmentCost: investmentCost.toString(),
        riskReductionValue: riskReductionValue.toString(),
        roiPercent: (Math.round(roiPercent * 100) / 100).toString(),
        calculationMethod: "ale_reduction" as const,
        computedAt: new Date(),
      };

      if (existing) {
        await tx
          .update(grcRoiCalculation)
          .set({
            investmentCost: values.investmentCost,
            roiPercent: values.roiPercent,
            computedAt: values.computedAt,
          })
          .where(eq(grcRoiCalculation.id, existing.id));
      } else {
        await tx.insert(grcRoiCalculation).values(values);
      }

      computed++;
    }

    return { computed };
  });

  return Response.json({
    data: {
      message: `ROI recomputed for ${result.computed} entities`,
      entitiesProcessed: result.computed,
    },
  });
}
