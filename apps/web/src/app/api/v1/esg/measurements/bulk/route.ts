import { db, esgMeasurement, esrsMetric } from "@grc/db";
import { bulkMeasurementImportSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, inArray } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/esg/measurements/bulk — Bulk import measurements (max 500)
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = bulkMeasurementImportSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify all metrics belong to org
  const metricIds = [...new Set(body.data.measurements.map((m) => m.metricId))];
  const validMetrics = await db
    .select({ id: esrsMetric.id })
    .from(esrsMetric)
    .where(
      and(eq(esrsMetric.orgId, ctx.orgId), inArray(esrsMetric.id, metricIds)),
    );

  const validMetricIds = new Set(validMetrics.map((m) => m.id));
  const invalidMetrics = metricIds.filter((id) => !validMetricIds.has(id));

  if (invalidMetrics.length > 0) {
    return Response.json(
      {
        error: "Some metrics not found in this organization",
        invalidMetricIds: invalidMetrics,
      },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const values = body.data.measurements.map((m) => ({
      orgId: ctx.orgId,
      metricId: m.metricId,
      periodStart: m.periodStart,
      periodEnd: m.periodEnd,
      value: String(m.value),
      unit: m.unit,
      dataQuality: m.dataQuality,
      source: m.source,
      notes: m.notes,
    }));

    return tx.insert(esgMeasurement).values(values).returning();
  });

  return Response.json(
    {
      data: {
        imported: created.length,
        measurements: created,
      },
    },
    { status: 201 },
  );
}
