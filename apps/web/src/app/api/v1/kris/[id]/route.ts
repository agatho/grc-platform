import { db, kri, kriMeasurement, risk } from "@grc/db";
import { updateKriSchema } from "@grc/shared";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { requireModule } from "@grc/auth";

// GET /api/v1/kris/:id -- KRI detail with last 12 measurements
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const [row] = await db
    .select({
      id: kri.id,
      orgId: kri.orgId,
      riskId: kri.riskId,
      name: kri.name,
      description: kri.description,
      unit: kri.unit,
      direction: kri.direction,
      thresholdGreen: kri.thresholdGreen,
      thresholdYellow: kri.thresholdYellow,
      thresholdRed: kri.thresholdRed,
      currentValue: kri.currentValue,
      currentAlertStatus: kri.currentAlertStatus,
      trend: kri.trend,
      measurementFrequency: kri.measurementFrequency,
      lastMeasuredAt: kri.lastMeasuredAt,
      alertEnabled: kri.alertEnabled,
      createdAt: kri.createdAt,
      updatedAt: kri.updatedAt,
      createdBy: kri.createdBy,
      updatedBy: kri.updatedBy,
      linkedRiskName: risk.title,
    })
    .from(kri)
    .leftJoin(risk, eq(kri.riskId, risk.id))
    .where(
      and(eq(kri.id, id), eq(kri.orgId, ctx.orgId), isNull(kri.deletedAt)),
    );

  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch last 12 measurements for sparkline data
  const measurements = await db
    .select({
      id: kriMeasurement.id,
      value: kriMeasurement.value,
      measuredAt: kriMeasurement.measuredAt,
      source: kriMeasurement.source,
    })
    .from(kriMeasurement)
    .where(eq(kriMeasurement.kriId, id))
    .orderBy(desc(kriMeasurement.measuredAt))
    .limit(12);

  return Response.json({
    data: {
      ...row,
      recentMeasurements: measurements.reverse(),
    },
  });
}

// PUT /api/v1/kris/:id -- Update KRI
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, "PUT");
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  // Verify KRI exists in this org
  const [existing] = await db
    .select()
    .from(kri)
    .where(
      and(eq(kri.id, id), eq(kri.orgId, ctx.orgId), isNull(kri.deletedAt)),
    );

  if (!existing) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = updateKriSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // If riskId is being changed, verify new risk exists in same org
  if (body.data.riskId) {
    const [linkedRisk] = await db
      .select({ id: risk.id })
      .from(risk)
      .where(
        and(
          eq(risk.id, body.data.riskId),
          eq(risk.orgId, ctx.orgId),
          isNull(risk.deletedAt),
        ),
      );

    if (!linkedRisk) {
      return Response.json(
        { error: "Linked risk not found in this organization" },
        { status: 422 },
      );
    }
  }

  const updated = await withAuditContext(ctx, async (tx) => {
    const updateValues: Record<string, unknown> = {
      updatedBy: ctx.userId,
      updatedAt: new Date(),
    };

    if (body.data.name !== undefined) updateValues.name = body.data.name;
    if (body.data.description !== undefined)
      updateValues.description = body.data.description;
    if (body.data.riskId !== undefined) updateValues.riskId = body.data.riskId;
    if (body.data.unit !== undefined) updateValues.unit = body.data.unit;
    if (body.data.direction !== undefined)
      updateValues.direction = body.data.direction;
    if (body.data.thresholdGreen !== undefined)
      updateValues.thresholdGreen =
        body.data.thresholdGreen?.toString() ?? null;
    if (body.data.thresholdYellow !== undefined)
      updateValues.thresholdYellow =
        body.data.thresholdYellow?.toString() ?? null;
    if (body.data.thresholdRed !== undefined)
      updateValues.thresholdRed = body.data.thresholdRed?.toString() ?? null;
    if (body.data.measurementFrequency !== undefined)
      updateValues.measurementFrequency = body.data.measurementFrequency;
    if (body.data.alertEnabled !== undefined)
      updateValues.alertEnabled = body.data.alertEnabled;

    const [row] = await tx
      .update(kri)
      .set(updateValues)
      .where(
        and(eq(kri.id, id), eq(kri.orgId, ctx.orgId), isNull(kri.deletedAt)),
      )
      .returning();

    return row;
  });

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: updated });
}

// DELETE /api/v1/kris/:id -- Soft delete (admin only)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, "DELETE");
  if (moduleCheck) return moduleCheck;

  const { id } = await params;

  const deleted = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .update(kri)
      .set({
        deletedAt: new Date(),
        deletedBy: ctx.userId,
        updatedBy: ctx.userId,
        updatedAt: new Date(),
      })
      .where(
        and(eq(kri.id, id), eq(kri.orgId, ctx.orgId), isNull(kri.deletedAt)),
      )
      .returning({ id: kri.id });

    return row;
  });

  if (!deleted) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ data: { id, deleted: true } });
}
