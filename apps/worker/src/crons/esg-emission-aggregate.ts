// Cron Job: ESG Emission Aggregation (Daily)
// Aggregates emission measurements by scope and year from esg_measurement records.
// Updates a materialized summary for the ESG dashboard.

import {
  db,
  esrsMetric,
  esgMeasurement,
  esrsDatapointDefinition,
} from "@grc/db";
import { and, eq, sql } from "drizzle-orm";

interface EsgEmissionAggregateResult {
  processed: number;
  aggregated: number;
}

interface ScopeAggregation {
  orgId: string;
  year: number;
  scope: string;
  totalCo2e: number;
}

export async function processEsgEmissionAggregate(): Promise<EsgEmissionAggregateResult> {
  const now = new Date();
  const currentYear = now.getFullYear();

  console.log(`[cron:esg-emission-aggregate] Starting at ${now.toISOString()}`);

  // 1. Find all emission-related measurements grouped by org, scope, and year
  // Emission datapoints are identified by ESRS standard E1 (Climate Change)
  // and specific datapoint codes for Scope 1, 2, 3 emissions
  const emissionData = await db
    .select({
      orgId: esrsMetric.orgId,
      datapointCode: esrsDatapointDefinition.datapointCode,
      esrsStandard: esrsDatapointDefinition.esrsStandard,
      year: sql<number>`EXTRACT(YEAR FROM ${esgMeasurement.periodStart}::date)`.as(
        "year",
      ),
      totalValue: sql<number>`SUM(${esgMeasurement.value}::numeric)`.as(
        "total_value",
      ),
      measurementCount: sql<number>`COUNT(*)`.as("measurement_count"),
    })
    .from(esgMeasurement)
    .innerJoin(esrsMetric, eq(esgMeasurement.metricId, esrsMetric.id))
    .innerJoin(
      esrsDatapointDefinition,
      eq(esrsMetric.datapointId, esrsDatapointDefinition.id),
    )
    .where(
      and(
        eq(esrsDatapointDefinition.esrsStandard, "E1"),
        sql`EXTRACT(YEAR FROM ${esgMeasurement.periodStart}::date) IN (${currentYear}, ${currentYear - 1})`,
      ),
    )
    .groupBy(
      esrsMetric.orgId,
      esrsDatapointDefinition.datapointCode,
      esrsDatapointDefinition.esrsStandard,
      sql`EXTRACT(YEAR FROM ${esgMeasurement.periodStart}::date)`,
    );

  // 2. Classify into scopes based on datapoint code patterns
  const aggregations: ScopeAggregation[] = [];

  for (const row of emissionData) {
    const code = row.datapointCode?.toUpperCase() ?? "";
    let scope = "unknown";

    if (
      code.includes("SCOPE1") ||
      code.includes("S1") ||
      code.includes("E1-6")
    ) {
      scope = "scope1";
    } else if (
      code.includes("SCOPE2") ||
      code.includes("S2") ||
      code.includes("E1-7")
    ) {
      scope = "scope2";
    } else if (
      code.includes("SCOPE3") ||
      code.includes("S3") ||
      code.includes("E1-8")
    ) {
      scope = "scope3";
    } else {
      // Default E1 emissions to scope1 if not clearly categorized
      scope = "scope1";
    }

    aggregations.push({
      orgId: row.orgId,
      year: row.year,
      scope,
      totalCo2e: Number(row.totalValue),
    });
  }

  // 3. Upsert aggregated data into a cache table or config
  // We store aggregation results as JSON in a setting, or in a dedicated cache
  // For now, we log the results. The dashboard API reads directly from measurements.
  // Future: store in esg_emission_summary table for fast dashboard queries.

  const orgSummaries = new Map<string, Record<string, number>>();

  for (const agg of aggregations) {
    const key = `${agg.orgId}:${agg.year}`;
    if (!orgSummaries.has(key)) {
      orgSummaries.set(key, { scope1: 0, scope2: 0, scope3: 0 });
    }
    const summary = orgSummaries.get(key)!;
    summary[agg.scope] = (summary[agg.scope] ?? 0) + agg.totalCo2e;
  }

  let aggregatedCount = 0;
  for (const [key, summary] of orgSummaries.entries()) {
    const [orgId, yearStr] = key.split(":");
    const total = summary.scope1 + summary.scope2 + summary.scope3;
    console.log(
      `[cron:esg-emission-aggregate] Org ${orgId?.slice(0, 8)}, Year ${yearStr}: ` +
        `S1=${summary.scope1.toFixed(1)} S2=${summary.scope2.toFixed(1)} S3=${summary.scope3.toFixed(1)} Total=${total.toFixed(1)} tCO2e`,
    );
    aggregatedCount++;
  }

  console.log(
    `[cron:esg-emission-aggregate] Processed ${emissionData.length} records, ${aggregatedCount} org-year summaries`,
  );

  return { processed: emissionData.length, aggregated: aggregatedCount };
}
