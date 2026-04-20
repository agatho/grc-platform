// Sprint 78: Benchmark Pool Aggregator
// Aggregates anonymized submissions into benchmark pools

import { db, benchmarkSubmission, benchmarkPool } from "@grc/db";
import { eq, and, sql } from "drizzle-orm";

interface BenchmarkAggregatorResult {
  poolsUpdated: number;
  submissionsProcessed: number;
  errors: number;
}

export async function processBenchmarkAggregator(): Promise<BenchmarkAggregatorResult> {
  const result: BenchmarkAggregatorResult = {
    poolsUpdated: 0,
    submissionsProcessed: 0,
    errors: 0,
  };

  const now = new Date();
  const currentQuarter = `Q${Math.ceil((now.getMonth() + 1) / 3)}-${now.getFullYear()}`;

  try {
    // Aggregate submissions by module, industry, org_size_range
    const aggregations = await db.execute(sql`
      SELECT
        module_key,
        industry,
        org_size_range,
        count(*)::int as participant_count,
        avg(score::numeric)::numeric(5,2) as avg_score,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY score::numeric)::numeric(5,2) as median_score,
        percentile_cont(0.25) WITHIN GROUP (ORDER BY score::numeric)::numeric(5,2) as p25_score,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY score::numeric)::numeric(5,2) as p75_score
      FROM benchmark_submission
      WHERE consent_given = true
      GROUP BY module_key, industry, org_size_range
      HAVING count(*) >= 5
    `);

    for (const agg of aggregations as Array<Record<string, unknown>>) {
      try {
        // Upsert into benchmark_pool
        await db.insert(benchmarkPool).values({
          moduleKey: agg.module_key as
            | "erm"
            | "isms"
            | "bcms"
            | "dpms"
            | "audit"
            | "ics"
            | "esg"
            | "tprm"
            | "bpm"
            | "overall",
          industry: agg.industry as
            | "financial_services"
            | "healthcare"
            | "manufacturing"
            | "technology"
            | "energy"
            | "retail"
            | "public_sector"
            | "insurance"
            | "automotive"
            | "other",
          orgSizeRange: String(agg.org_size_range),
          participantCount: Number(agg.participant_count),
          avgScore: String(agg.avg_score),
          medianScore: String(agg.median_score),
          p25Score: String(agg.p25_score),
          p75Score: String(agg.p75_score),
          periodLabel: currentQuarter,
        });
        result.poolsUpdated++;
      } catch (err) {
        result.errors++;
      }
    }

    result.submissionsProcessed = (aggregations as Array<unknown>).length;
  } catch (err) {
    console.error("[worker] benchmark-aggregator: Failed:", err);
    result.errors++;
  }

  return result;
}
