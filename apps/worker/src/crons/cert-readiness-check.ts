// Cron Job: Certification Readiness Snapshot
// Periodically checks and updates readiness scores for active assessments.

import { db, certReadinessAssessment } from "@grc/db";
import { eq, ne } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface CertSnapshotResult {
  processed: number;
  updated: number;
}

export const processCertReadinessCheck = withCronInstrumentation(
  "cert-readiness-check",
  async (): Promise<CertSnapshotResult> => {
    const now = new Date();
    let updated = 0;

  const activeAssessments = await db
    .select()
    .from(certReadinessAssessment)
    .where(ne(certReadinessAssessment.status, "expired"));

  for (const assessment of activeAssessments) {
    try {
      const details =
        (assessment.controlDetails as Array<{ status: string }>) ?? [];
      if (details.length === 0) continue;

      const implemented = details.filter(
        (d) => d.status === "implemented",
      ).length;
      const partial = details.filter((d) => d.status === "partial").length;
      const na = details.filter((d) => d.status === "not_applicable").length;
      const applicable = details.length - na;
      if (applicable === 0) continue;

      const score = ((implemented + partial * 0.5) / applicable) * 100;
      const currentScore = Number(assessment.readinessScore ?? 0);

      if (Math.abs(score - currentScore) > 0.01) {
        await db
          .update(certReadinessAssessment)
          .set({
            readinessScore: score.toFixed(2),
            implementedControls: implemented,
            partialControls: partial,
            notApplicable: na,
            notImplemented: details.filter(
              (d) => d.status === "not_implemented",
            ).length,
            updatedAt: now,
          })
          .where(eq(certReadinessAssessment.id, assessment.id));
        updated++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[cron:cert-readiness-check] Error for ${assessment.id}:`,
        message,
      );
    }
  }

    return { processed: activeAssessments.length, updated };
  },
);
