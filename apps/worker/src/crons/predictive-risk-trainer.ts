// Sprint 71: Predictive Risk Model Trainer Worker
// Runs daily — retrains models and generates new predictions

import { db, riskPredictionModel } from "@grc/db";
import { eq, and, sql, lte } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";
import { claimRow, createRunReport } from "../lib/job-runtime";

export const processPredictiveRiskTrainer = withCronInstrumentation(
  "predictive-risk-trainer",
  async (): Promise<{
    modelsChecked: number;
    modelsRetrained: number;
    ok: boolean;
    failed: number;
    errors: string[];
  }> => {
    const report = createRunReport("predictive-risk-trainer");
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

    const modelsRetrained = 0;

    for (const model of dueModels) {
      const config = model.trainingConfig as Record<string, number> | null;
      const retrainDays = config?.retrainFrequencyDays ?? 7;
      const lastTrained = model.lastTrainedAt?.getTime() ?? 0;

      if (Date.now() - lastTrained >= retrainDays * 24 * 60 * 60 * 1000) {
        try {
          // [WP9 · S10-09] Guarded claim — the unconditional UPDATE let two
          // workers "retrain" the same model at once.
          const claimed = await claimRow({
            table: "risk_prediction_model",
            id: model.id,
            expectedStatus: model.status,
            nextStatus: "training",
          });
          if (!claimed) continue;

          // [WP9 · S10-15 class] The two UPDATEs used to be adjacent: the
          // model went active → training → active with `lastTrainedAt = now`
          // and nothing in between. Every model reported a fresh training
          // run it never had, which is what the drift/retrain policy is
          // supposed to detect. No trainer exists, so the model is marked
          // `degraded` and `lastTrainedAt` is left untouched — the honest
          // state is "overdue for retraining", not "just retrained".
          await db
            .update(riskPredictionModel)
            .set({ status: "degraded", updatedAt: now })
            .where(eq(riskPredictionModel.id, model.id));
          report.fail(
            `model ${model.id}`,
            new Error(
              "model retraining is not implemented in this build; " +
                "lastTrainedAt deliberately not advanced",
            ),
          );
        } catch (err) {
          report.fail(`model ${model.id}`, err);
          await db
            .update(riskPredictionModel)
            .set({ status: "degraded", updatedAt: now })
            .where(eq(riskPredictionModel.id, model.id));
        }
      }
    }

    return report.toResult({
      modelsChecked: dueModels.length,
      modelsRetrained,
    });
  },
);
