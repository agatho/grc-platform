// Sprint 44: Vendor Scorecard Recomputer (Daily 06:00)
// Recomputes scorecards for vendors with stale data

import { db, vendorScorecard, notification } from "@grc/db";
import { classifyVendorTier, DEFAULT_SCORECARD_WEIGHTS } from "@grc/shared";
import { eq, sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface ScorecardRecomputeResult {
  processed: number;
  tierChanges: number;
}

export const processScorecardRecomputer = withCronInstrumentation(
  "scorecard-recomputer",
  async (): Promise<ScorecardRecomputeResult> => {
    let tierChanges = 0;

    const scorecards = await db.select().from(vendorScorecard);

    for (const sc of scorecards) {
      const weights =
        (sc.weights as Record<string, number>) || DEFAULT_SCORECARD_WEIGHTS;
      const dimensions = sc.dimensionScores as Record<string, number>;

      // Recompute weighted score
      let score = 0;
      for (const [dim, weight] of Object.entries(weights)) {
        score += (dimensions[dim] || 0) * weight;
      }
      const overallScore = Math.round(score);
      const tier = classifyVendorTier(overallScore);

      if (tier !== sc.tier) {
        tierChanges++;
      }

      await db
        .update(vendorScorecard)
        .set({
          overallScore,
          tier,
          previousScore: sc.overallScore,
          previousTier: sc.tier,
          computedAt: new Date(),
        })
        .where(eq(vendorScorecard.id, sc.id));
    }

    return { processed: scorecards.length, tierChanges };
  },
);
