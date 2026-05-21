// GET /api/v1/esg/measurements/schema — Wave-24-D6
//
// #WAVE24-D6: Wave-24 QA bounced off POST /esg/measurements with 422s
// because the body shape isn't documented anywhere a caller can fetch
// programmatically. This endpoint exposes the required + optional
// fields plus a known-good example so the alpha ESG workflow stops
// being a guess-and-check loop.
//
// Schema mirrors @grc/shared `recordMeasurementSchema` —
// keep in sync.

import { requireModule } from "@grc/auth";
import { db, esrsMetric } from "@grc/db";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  // #WAVE25-C3: Wave-24 D6 example used a hardcoded placeholder UUID
  // for metricId, which made the POST example fail with 404 "Metric
  // not found in this organization". Now we resolve a real metric
  // from the caller's org and use its ID in the example so the
  // schema -> POST flow round-trips successfully out of the box.
  // Falls back to the placeholder + a hint string when no metric
  // exists (fresh tenant, no ESG data seeded yet).
  const [sampleMetric] = await db
    .select({ id: esrsMetric.id, unit: esrsMetric.unit })
    .from(esrsMetric)
    .where(eq(esrsMetric.orgId, ctx.orgId))
    .limit(1);
  const exampleMetricId =
    sampleMetric?.id ?? "00000000-0000-0000-0000-000000000000";
  const exampleUnit = sampleMetric?.unit ?? "tCO2e";
  const exampleHint = sampleMetric
    ? undefined
    : "No ESG metrics seeded in this org yet — replace metricId with a real UUID from GET /api/v1/esg/metrics before POSTing.";

  return Response.json({
    data: {
      endpoint: "/api/v1/esg/measurements",
      method: "POST",
      contentType: "application/json",
      hint: exampleHint,
      fields: {
        metricId: {
          type: "uuid",
          required: true,
          description:
            "ID of the ESRS metric this measurement reports. Must exist in this org.",
        },
        periodStart: {
          type: "date",
          required: true,
          format: "YYYY-MM-DD",
          description: "Reporting-period start (inclusive).",
        },
        periodEnd: {
          type: "date",
          required: true,
          format: "YYYY-MM-DD",
          description: "Reporting-period end (inclusive).",
        },
        value: {
          type: "number",
          required: true,
          description:
            "Measured value in the metric's native unit (or in `unit` override if provided).",
        },
        unit: {
          type: "string",
          required: false,
          description:
            "Unit override — use only when the metric's default unit is not appropriate.",
        },
        dataQuality: {
          type: "enum",
          required: false,
          values: ["measured", "estimated", "calculated"],
          description: "How the value was obtained. Defaults to 'measured'.",
        },
        source: {
          type: "string",
          required: false,
          description: "Source system / document the measurement came from.",
        },
        notes: {
          type: "string",
          required: false,
          description: "Free-form context for the auditor.",
        },
      },
      example: {
        metricId: exampleMetricId,
        periodStart: "2026-01-01",
        periodEnd: "2026-03-31",
        value: 1234.56,
        unit: exampleUnit,
        dataQuality: "measured",
        source: "Energy meter export Q1-2026",
        notes: "Scope-1 stationary combustion, gas heating.",
      },
    },
  });
});
