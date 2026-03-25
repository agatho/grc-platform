import { db, kri, kriMeasurement } from "@grc/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { requireModule } from "@grc/auth";
import { z } from "zod";

const batchMeasurementSchema = z.object({
  measurements: z
    .array(
      z.object({
        value: z.number(),
        measuredAt: z.string().datetime(),
        source: z.enum(["manual", "api_import", "calculated"]).default("api_import"),
        notes: z.string().optional(),
      }),
    )
    .min(1)
    .max(1000),
});

/** Compute alert status from value and thresholds, respecting direction. */
function computeAlertStatus(
  value: number,
  direction: "asc" | "desc",
  thresholdGreen: string | null,
  thresholdYellow: string | null,
  thresholdRed: string | null,
): "green" | "yellow" | "red" {
  const green = thresholdGreen != null ? parseFloat(thresholdGreen) : null;
  const yellow = thresholdYellow != null ? parseFloat(thresholdYellow) : null;
  const red = thresholdRed != null ? parseFloat(thresholdRed) : null;

  if (green == null || yellow == null || red == null) {
    return "green";
  }

  if (direction === "asc") {
    if (value >= red) return "red";
    if (value >= yellow) return "yellow";
    return "green";
  }

  if (value <= red) return "red";
  if (value <= yellow) return "yellow";
  return "green";
}

/** Compute trend from the first two values (newest first). */
function computeTrend(
  values: number[],
  direction: "asc" | "desc",
): "improving" | "stable" | "worsening" {
  if (values.length < 2) return "stable";

  const latest = values[0];
  const previous = values[1];

  if (previous === 0) return "stable";

  const changePercent = ((latest - previous) / Math.abs(previous)) * 100;

  if (Math.abs(changePercent) <= 5) return "stable";

  if (direction === "asc") {
    return changePercent > 0 ? "worsening" : "improving";
  }

  return changePercent < 0 ? "worsening" : "improving";
}

// POST /api/v1/kris/:id/measurements/batch -- Batch import measurements
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, "POST");
  if (moduleCheck) return moduleCheck;

  const { id: kriId } = await params;

  // Verify KRI exists in this org
  const [kriRow] = await db
    .select()
    .from(kri)
    .where(
      and(
        eq(kri.id, kriId),
        eq(kri.orgId, ctx.orgId),
        isNull(kri.deletedAt),
      ),
    );

  if (!kriRow) {
    return Response.json({ error: "KRI not found" }, { status: 404 });
  }

  const body = batchMeasurementSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    // Insert all measurements
    const rows = await tx
      .insert(kriMeasurement)
      .values(
        body.data.measurements.map((m) => ({
          kriId,
          orgId: ctx.orgId,
          value: m.value.toString(),
          measuredAt: new Date(m.measuredAt),
          source: m.source,
          notes: m.notes,
          createdBy: ctx.userId,
        })),
      )
      .returning();

    // Recompute KRI current state from latest measurement
    const [latestMeasurement] = await tx
      .select({ value: kriMeasurement.value, measuredAt: kriMeasurement.measuredAt })
      .from(kriMeasurement)
      .where(eq(kriMeasurement.kriId, kriId))
      .orderBy(desc(kriMeasurement.measuredAt))
      .limit(1);

    if (latestMeasurement) {
      const latestValue = parseFloat(latestMeasurement.value);

      const newAlertStatus = computeAlertStatus(
        latestValue,
        kriRow.direction,
        kriRow.thresholdGreen,
        kriRow.thresholdYellow,
        kriRow.thresholdRed,
      );

      // Get last 3 measurements for trend
      const recentMeasurements = await tx
        .select({ value: kriMeasurement.value })
        .from(kriMeasurement)
        .where(eq(kriMeasurement.kriId, kriId))
        .orderBy(desc(kriMeasurement.measuredAt))
        .limit(3);

      const recentValues = recentMeasurements.map((m: { value: string }) => parseFloat(m.value));
      const newTrend = computeTrend(recentValues, kriRow.direction);

      await tx
        .update(kri)
        .set({
          currentValue: latestMeasurement.value,
          currentAlertStatus: newAlertStatus,
          trend: newTrend,
          lastMeasuredAt: latestMeasurement.measuredAt,
          updatedAt: new Date(),
          updatedBy: ctx.userId,
        })
        .where(eq(kri.id, kriId));
    }

    return { inserted: rows.length };
  });

  return Response.json({ data: result }, { status: 201 });
}
