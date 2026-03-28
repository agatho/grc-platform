// Sprint 78: Auto-Maturity Calculation
// Recalculates maturity levels for all orgs based on assessment data

import { db, maturityModel, maturityAssessment } from "@grc/db";
import { eq, and, desc } from "drizzle-orm";

interface MaturityCalculatorResult {
  orgsProcessed: number;
  modelsUpdated: number;
  errors: number;
}

function scoreToLevel(score: number): "initial" | "managed" | "defined" | "quantitatively_managed" | "optimizing" {
  if (score >= 4.5) return "optimizing";
  if (score >= 3.5) return "quantitatively_managed";
  if (score >= 2.5) return "defined";
  if (score >= 1.5) return "managed";
  return "initial";
}

export async function processMaturityAutoCalculator(): Promise<MaturityCalculatorResult> {
  const result: MaturityCalculatorResult = { orgsProcessed: 0, modelsUpdated: 0, errors: 0 };

  const models = await db.select().from(maturityModel).where(eq(maturityModel.autoCalculated, true));

  const orgIds = [...new Set(models.map((m) => m.orgId))];
  result.orgsProcessed = orgIds.length;

  for (const model of models) {
    try {
      // Get the latest completed assessment for this module
      const [latestAssessment] = await db
        .select()
        .from(maturityAssessment)
        .where(
          and(
            eq(maturityAssessment.orgId, model.orgId),
            eq(maturityAssessment.moduleKey, model.moduleKey),
            eq(maturityAssessment.status, "completed"),
          ),
        )
        .orderBy(desc(maturityAssessment.createdAt))
        .limit(1);

      if (latestAssessment && latestAssessment.overallScore) {
        const score = Number(latestAssessment.overallScore);
        const newLevel = scoreToLevel(score);

        if (newLevel !== model.currentLevel) {
          await db
            .update(maturityModel)
            .set({
              currentLevel: newLevel,
              lastCalculatedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(maturityModel.id, model.id));
          result.modelsUpdated++;
        }
      }
    } catch (err) {
      console.error(`[worker] maturity-auto-calculator: Failed for model ${model.id}:`, err);
      result.errors++;
    }
  }

  return result;
}
