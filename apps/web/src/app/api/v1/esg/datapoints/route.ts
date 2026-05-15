// GET /api/v1/esg/datapoints
//
// #WAVE19-P3-03: ESG-metric form on the UI requires a `datapointId`
// from the ESRS-datapoint catalogue. Without this discovery route
// the picker comes up empty and POST /esg/metrics 422s with
// {fieldErrors:{datapointId:['Required']}}.
//
// The 65 datapoints from `seed_esrs_datapoints.sql` (now wired into
// seed-all.ts in the same PR) are catalog reference data — same
// for every org. RLS doesn't apply because the table has no
// `org_id` column. Returns the full ESRS taxonomy with optional
// filters by `esrsStandard` (E1, E2, ..., G1) and `mandatory`.

import { db, esrsDatapointDefinition } from "@grc/db";
import { and, eq, asc } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const standardParam = url.searchParams.get("esrsStandard");
  const mandatoryParam = url.searchParams.get("mandatory");

  const conds = [];
  if (standardParam) {
    conds.push(eq(esrsDatapointDefinition.esrsStandard, standardParam));
  }
  if (mandatoryParam === "true") {
    conds.push(eq(esrsDatapointDefinition.isMandatory, true));
  } else if (mandatoryParam === "false") {
    conds.push(eq(esrsDatapointDefinition.isMandatory, false));
  }

  const rows = await db
    .select({
      id: esrsDatapointDefinition.id,
      esrsStandard: esrsDatapointDefinition.esrsStandard,
      disclosureRequirement: esrsDatapointDefinition.disclosureRequirement,
      datapointCode: esrsDatapointDefinition.datapointCode,
      nameEn: esrsDatapointDefinition.nameEn,
      nameDe: esrsDatapointDefinition.nameDe,
      descriptionEn: esrsDatapointDefinition.descriptionEn,
      descriptionDe: esrsDatapointDefinition.descriptionDe,
      dataType: esrsDatapointDefinition.dataType,
      unit: esrsDatapointDefinition.unit,
      isMandatory: esrsDatapointDefinition.isMandatory,
      frequency: esrsDatapointDefinition.frequency,
    })
    .from(esrsDatapointDefinition)
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(
      asc(esrsDatapointDefinition.esrsStandard),
      asc(esrsDatapointDefinition.datapointCode),
    );

  // Group by ESRS-standard for the picker UI — the form usually
  // shows them as "E1 — Climate Change > E1-1 GHG Emissions Scope 1"
  // rather than a flat 65-item list.
  const byStandard = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.esrsStandard ?? "OTHER";
    if (!byStandard.has(key)) byStandard.set(key, []);
    byStandard.get(key)!.push(r);
  }

  return Response.json({
    data: {
      total: rows.length,
      datapoints: rows,
      byStandard: Object.fromEntries(byStandard),
      // Schema discovery hint for clients that want to build a generic
      // metric-create form.
      bodyShape: {
        endpoint: "POST /api/v1/esg/metrics",
        required: ["datapointId", "name", "unit", "frequency"],
        optional: ["category", "targetValue", "tolerance"],
      },
    },
  });
});
