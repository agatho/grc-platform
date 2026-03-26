import {
  db,
  esgMeasurement,
  esrsMetric,
  esrsDatapointDefinition,
} from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/esg/scope-emissions/[year] — Scope 1+2+3 summary
export async function GET(
  req: Request,
  { params }: { params: Promise<{ year: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { year } = await params;
  const reportingYear = parseInt(year, 10);
  if (isNaN(reportingYear)) {
    return Response.json({ error: "Invalid year" }, { status: 400 });
  }

  const yearStart = `${reportingYear}-01-01`;
  const yearEnd = `${reportingYear}-12-31`;

  // Map datapoint codes to scopes
  const scopeMapping: Record<string, string> = {
    "E1-4-01": "scope1",
    "E1-4-02": "scope2_location",
    "E1-4-03": "scope2_market",
    "E1-4-04": "scope3",
  };

  const scopeCodes = Object.keys(scopeMapping);

  // Get measurements for emission datapoints within the year
  const measurements = await db
    .select({
      datapointCode: esrsDatapointDefinition.datapointCode,
      value: esgMeasurement.value,
      unit: esgMeasurement.unit,
      dataQuality: esgMeasurement.dataQuality,
      periodStart: esgMeasurement.periodStart,
      periodEnd: esgMeasurement.periodEnd,
      verifiedAt: esgMeasurement.verifiedAt,
    })
    .from(esgMeasurement)
    .innerJoin(esrsMetric, eq(esgMeasurement.metricId, esrsMetric.id))
    .innerJoin(
      esrsDatapointDefinition,
      eq(esrsMetric.datapointId, esrsDatapointDefinition.id),
    )
    .where(
      and(
        eq(esgMeasurement.orgId, ctx.orgId),
        gte(esgMeasurement.periodStart, yearStart),
        lte(esgMeasurement.periodEnd, yearEnd),
        sql`${esrsDatapointDefinition.datapointCode} = ANY(${scopeCodes})`,
      ),
    );

  // Aggregate by scope
  const scopes: Record<
    string,
    { total: number; unit: string; measurements: number; verified: number }
  > = {
    scope1: { total: 0, unit: "tCO2e", measurements: 0, verified: 0 },
    scope2_location: { total: 0, unit: "tCO2e", measurements: 0, verified: 0 },
    scope2_market: { total: 0, unit: "tCO2e", measurements: 0, verified: 0 },
    scope3: { total: 0, unit: "tCO2e", measurements: 0, verified: 0 },
  };

  for (const m of measurements) {
    const scope = scopeMapping[m.datapointCode];
    if (scope && scopes[scope]) {
      scopes[scope].total += parseFloat(String(m.value));
      scopes[scope].measurements += 1;
      if (m.verifiedAt) scopes[scope].verified += 1;
    }
  }

  const totalEmissions =
    scopes.scope1.total +
    scopes.scope2_location.total +
    scopes.scope3.total;

  return Response.json({
    data: {
      reportingYear,
      scopes,
      totalEmissions: Math.round(totalEmissions * 1000) / 1000,
      unit: "tCO2e",
    },
  });
}
