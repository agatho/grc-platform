import {
  db,
  esgMeasurement,
  esrsMetric,
} from "@grc/db";
import { recordMeasurementSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

// POST /api/v1/esg/measurements — Record single measurement
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = recordMeasurementSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify metric belongs to org
  const [metric] = await db
    .select({ id: esrsMetric.id })
    .from(esrsMetric)
    .where(
      and(
        eq(esrsMetric.id, body.data.metricId),
        eq(esrsMetric.orgId, ctx.orgId),
      ),
    );

  if (!metric) {
    return Response.json(
      { error: "Metric not found in this organization" },
      { status: 404 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(esgMeasurement)
      .values({
        orgId: ctx.orgId,
        metricId: body.data.metricId,
        periodStart: body.data.periodStart,
        periodEnd: body.data.periodEnd,
        value: String(body.data.value),
        unit: body.data.unit,
        dataQuality: body.data.dataQuality,
        source: body.data.source,
        notes: body.data.notes,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/esg/measurements — List measurements with filters
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(esgMeasurement.orgId, ctx.orgId)];

  const metricId = searchParams.get("metricId");
  if (metricId) {
    conditions.push(eq(esgMeasurement.metricId, metricId));
  }

  const dataQuality = searchParams.get("dataQuality");
  if (dataQuality && ["measured", "estimated", "calculated"].includes(dataQuality)) {
    conditions.push(
      eq(esgMeasurement.dataQuality, dataQuality as "measured" | "estimated" | "calculated"),
    );
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: esgMeasurement.id,
        orgId: esgMeasurement.orgId,
        metricId: esgMeasurement.metricId,
        metricName: esrsMetric.name,
        periodStart: esgMeasurement.periodStart,
        periodEnd: esgMeasurement.periodEnd,
        value: esgMeasurement.value,
        unit: esgMeasurement.unit,
        dataQuality: esgMeasurement.dataQuality,
        source: esgMeasurement.source,
        verifiedBy: esgMeasurement.verifiedBy,
        verifiedAt: esgMeasurement.verifiedAt,
        notes: esgMeasurement.notes,
        recordedAt: esgMeasurement.recordedAt,
      })
      .from(esgMeasurement)
      .leftJoin(esrsMetric, eq(esgMeasurement.metricId, esrsMetric.id))
      .where(where)
      .orderBy(desc(esgMeasurement.recordedAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(esgMeasurement).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
