// Cron Job: ROI/RONI Calculation (Monthly)
// Recalculates ROI and RONI values for all risk treatments and controls.

import {
  db,
  grcRoiCalculation,
  grcCostEntry,
  risk,
  riskTreatment,
  control,
  organization,
} from "@grc/db";
import { eq, and, isNull, sql } from "drizzle-orm";

interface RoiCalculationResult {
  processed: number;
  orgsProcessed: number;
  errors: number;
}

export async function processRoiCalculation(): Promise<RoiCalculationResult> {
  const now = new Date();
  console.log(`[cron:roi-calculation] Starting at ${now.toISOString()}`);

  let processed = 0;
  let errors = 0;

  // Fetch all active organizations
  const orgs = await db
    .select({ id: organization.id })
    .from(organization)
    .where(isNull(organization.deletedAt));

  for (const org of orgs) {
    try {
      // ── Risk Treatments: ALE reduction method ──
      const treatments = await db
        .select({
          id: riskTreatment.id,
          riskId: riskTreatment.riskId,
          costEstimate: riskTreatment.costEstimate,
          expectedRiskReduction: riskTreatment.expectedRiskReduction,
        })
        .from(riskTreatment)
        .where(
          and(eq(riskTreatment.orgId, org.id), isNull(riskTreatment.deletedAt)),
        );

      for (const treatment of treatments) {
        try {
          // Get the parent risk for ALE data
          const [parentRisk] = await db
            .select({
              inherentLikelihood: risk.inherentLikelihood,
              inherentImpact: risk.inherentImpact,
              residualLikelihood: risk.residualLikelihood,
              residualImpact: risk.residualImpact,
              financialImpactExpected: risk.financialImpactExpected,
            })
            .from(risk)
            .where(and(eq(risk.id, treatment.riskId), eq(risk.orgId, org.id)))
            .limit(1);

          if (!parentRisk) continue;

          // Calculate ALE (Annualized Loss Expectancy)
          const financialImpact = Number(
            parentRisk.financialImpactExpected || 0,
          );
          const inherentLikelihood = (parentRisk.inherentLikelihood ?? 1) / 5; // normalize to 0-1
          const residualLikelihood = (parentRisk.residualLikelihood ?? 1) / 5;

          const inherentAle = financialImpact * inherentLikelihood;
          const residualAle = financialImpact * residualLikelihood;
          const aleReduction = inherentAle - residualAle;

          // Get actual costs for this treatment
          const [actualCosts] = await db
            .select({
              total: sql<string>`COALESCE(SUM(${grcCostEntry.amount}), '0')`,
            })
            .from(grcCostEntry)
            .where(
              and(
                eq(grcCostEntry.orgId, org.id),
                eq(grcCostEntry.entityType, "risk_treatment"),
                eq(grcCostEntry.entityId, treatment.id),
                eq(grcCostEntry.costType, "actual"),
              ),
            );

          const investmentCost = Number(
            actualCosts?.total || treatment.costEstimate || 0,
          );
          const roiPercent =
            investmentCost > 0
              ? ((aleReduction - investmentCost) / investmentCost) * 100
              : 0;

          // RONI: cost of NOT investing (for accepted risks with no treatment)
          const roniCfo = inherentAle; // CFO: negative return
          const roniCiso = inherentAle; // CISO: risk exposure

          // Upsert ROI calculation
          await db.insert(grcRoiCalculation).values({
            orgId: org.id,
            entityType: "risk_treatment",
            entityId: treatment.id,
            investmentCost: String(Math.round(investmentCost * 100) / 100),
            riskReductionValue: String(Math.round(aleReduction * 100) / 100),
            roiPercent: String(Math.round(roiPercent * 100) / 100),
            roniCfo: String(Math.round(roniCfo * 100) / 100),
            roniCiso: String(Math.round(roniCiso * 100) / 100),
            inherentAle: String(Math.round(inherentAle * 100) / 100),
            residualAle: String(Math.round(residualAle * 100) / 100),
            calculationMethod: "ale_reduction",
            computedAt: now,
          });

          processed++;
        } catch (err) {
          errors++;
          console.error(
            `[cron:roi-calculation] Error for treatment ${treatment.id}:`,
            err instanceof Error ? err.message : String(err),
          );
        }
      }

      // ── Controls: penalty avoidance method ──
      const controls = await db
        .select({
          id: control.id,
        })
        .from(control)
        .where(and(eq(control.orgId, org.id), isNull(control.deletedAt)));

      for (const ctrl of controls) {
        try {
          // Get actual costs for this control
          const [actualCosts] = await db
            .select({
              total: sql<string>`COALESCE(SUM(${grcCostEntry.amount}), '0')`,
            })
            .from(grcCostEntry)
            .where(
              and(
                eq(grcCostEntry.orgId, org.id),
                eq(grcCostEntry.entityType, "control"),
                eq(grcCostEntry.entityId, ctrl.id),
                eq(grcCostEntry.costType, "actual"),
              ),
            );

          const investmentCost = Number(actualCosts?.total || 0);
          if (investmentCost === 0) continue;

          // For controls, use penalty avoidance estimation
          // Simplified: assume control prevents a fraction of potential fines
          const estimatedPenaltyAvoidance = investmentCost * 2; // Conservative 2x multiplier
          const roiPercent =
            investmentCost > 0
              ? ((estimatedPenaltyAvoidance - investmentCost) /
                  investmentCost) *
                100
              : 0;

          await db.insert(grcRoiCalculation).values({
            orgId: org.id,
            entityType: "control",
            entityId: ctrl.id,
            investmentCost: String(Math.round(investmentCost * 100) / 100),
            riskReductionValue: String(
              Math.round(estimatedPenaltyAvoidance * 100) / 100,
            ),
            roiPercent: String(Math.round(roiPercent * 100) / 100),
            roniCfo: String(Math.round(estimatedPenaltyAvoidance * 100) / 100),
            roniCiso: String(Math.round(estimatedPenaltyAvoidance * 100) / 100),
            inherentAle: "0",
            residualAle: "0",
            calculationMethod: "penalty_avoidance",
            computedAt: now,
          });

          processed++;
        } catch (err) {
          errors++;
          console.error(
            `[cron:roi-calculation] Error for control ${ctrl.id}:`,
            err instanceof Error ? err.message : String(err),
          );
        }
      }
    } catch (err) {
      errors++;
      console.error(
        `[cron:roi-calculation] Error for org ${org.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `[cron:roi-calculation] Done. Processed: ${processed}, Orgs: ${orgs.length}, Errors: ${errors}`,
  );

  return { processed, orgsProcessed: orgs.length, errors };
}
