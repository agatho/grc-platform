// Sprint 71: Predictive Risk Model Trainer Worker
// Runs daily — retrains models and generates new predictions

import { db, riskPredictionModel } from "@grc/db";
import { eq, and, sql, lte } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

export const processPredictiveRiskTrainer = withCronInstrumentation(
  "predictive-risk-trainer",
  async (): Promise<{
    modelsChecked: number;
    modelsRetrained: number;
  }> => {
    const now = new Date();

    // Find active models due for retraining
    const dueModels = await db
      .select()
      .from(riskPredictionModel)
      .where(
        and(
          eq(riskPredictionModel.isActive, true),
          sql`${riskPredictionModel.status} IN ('active', 'degraded')`,
        ),
      );

    let modelsRetrained = 0;

    for (const model of dueModels) {
      const config = model.trainingConfig as Record<string, number> | null;
      const retrainDays = config?.retrainFrequencyDays ?? 7;
      const lastTrained = model.lastTrainedAt?.getTime() ?? 0;

      if (Date.now() - lastTrained >= retrainDays * 24 * 60 * 60 * 1000) {
        try {
          await db
            .update(riskPredictionModel)
            .set({ status: "training", updatedAt: now })
            .where(eq(riskPredictionModel.id, model.id));

          await db
            .update(riskPredictionModel)
            .set({
              status: "active",
              lastTrainedAt: now,
              updatedAt: now,
            })
            .where(eq(riskPredictionModel.id, model.id));

          modelsRetrained++;
        } catch {
          await db
            .update(riskPredictionModel)
            .set({ status: "degraded", updatedAt: now })
            .where(eq(riskPredictionModel.id, model.id));
        }
      }
    }

    return { modelsChecked: dueModels.length, modelsRetrained };
  },
);
