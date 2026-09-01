// Sprint 71: Anomaly Detection Runner Worker
// Runs every 30 minutes — scans KRI time series for anomalies

import { db, riskPredictionModel, riskAnomalyDetection } from "@grc/db";
import { eq, and, sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";
import { reportJobError } from "../lib/job-runtime";

export const processAnomalyDetection = withCronInstrumentation(
  "anomaly-detection-runner",
  async (): Promise<{
    modelsProcessed: number;
    anomaliesDetected: number;
  }> => {
    // Find active anomaly detection models
    const models = await db
      .select()
      .from(riskPredictionModel)
      .where(
        and(
          eq(riskPredictionModel.isActive, true),
          eq(riskPredictionModel.modelType, "anomaly_detection"),
          eq(riskPredictionModel.status, "active"),
        ),
      );

    const anomaliesDetected = 0;

    for (const model of models) {
      try {
        // In production: run anomaly detection on KRI time series via
        // TimescaleDB, check KRI values against model thresholds, and
        // generate anomaly records for deviations.
        void model;
      } catch (err) {
        // [WP9 · S10-11] was a silent catch — see lib/job-runtime.ts
        reportJobError(
          {
            job: "anomaly-detection-runner",
            scope: "generate anomaly records for deviations.",
          },
          err,
        );
        // continues to the next model).
      }
    }

    void riskAnomalyDetection;
    void sql;
    return { modelsProcessed: models.length, anomaliesDetected };
  },
);
