import {
  db,
  kri,
  kriMeasurement,
  notification,
  userOrganizationRole,
} from "@grc/db";
import { addKriMeasurementSchema } from "@grc/shared";
import { eq, and, isNull, count, desc, gte, lte } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import { requireModule } from "@grc/auth";
import type { SQL } from "drizzle-orm";

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

  // If any threshold is missing, default to green
  if (green == null || yellow == null || red == null) {
    return "green";
  }

  if (direction === "asc") {
    // Higher is worse: green < yellow < red
    if (value >= red) return "red";
    if (value >= yellow) return "yellow";
    return "green";
  }

  // desc: Lower is worse: green > yellow > red
  if (value <= red) return "red";
  if (value <= yellow) return "yellow";
  return "green";
}

/** Compute trend from last 3 measurements using 5% threshold. */
function computeTrend(
  values: number[],
  direction: "asc" | "desc",
): "improving" | "stable" | "worsening" {
  if (values.length < 2) return "stable";

  // values are ordered newest first: [latest, previous, ...]
  const latest = values[0];
  const previous = values[1];

  if (previous === 0) return "stable";

  const changePercent = ((latest - previous) / Math.abs(previous)) * 100;

  if (Math.abs(changePercent) <= 5) return "stable";

  if (direction === "asc") {
    // Higher is worse: increase = worsening, decrease = improving
    return changePercent > 0 ? "worsening" : "improving";
  }

  // desc: Lower is worse: decrease = worsening, increase = improving
  return changePercent < 0 ? "worsening" : "improving";
}

// POST /api/v1/kris/:id/measurements -- Add measurement
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
      and(eq(kri.id, kriId), eq(kri.orgId, ctx.orgId), isNull(kri.deletedAt)),
    );

  if (!kriRow) {
    return Response.json({ error: "KRI not found" }, { status: 404 });
  }

  const body = addKriMeasurementSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    // 1. Insert measurement
    const [measurement] = await tx
      .insert(kriMeasurement)
      .values({
        kriId,
        orgId: ctx.orgId,
        value: body.data.value.toString(),
        measuredAt: new Date(body.data.measuredAt),
        source: body.data.source,
        notes: body.data.notes,
        createdBy: ctx.userId,
      })
      .returning();

    // 2. Compute alert status from thresholds
    const newAlertStatus = computeAlertStatus(
      body.data.value,
      kriRow.direction,
      kriRow.thresholdGreen,
      kriRow.thresholdYellow,
      kriRow.thresholdRed,
    );

    // 3. Compute trend from last 3 measurements
    const recentMeasurements = await tx
      .select({ value: kriMeasurement.value })
      .from(kriMeasurement)
      .where(eq(kriMeasurement.kriId, kriId))
      .orderBy(desc(kriMeasurement.measuredAt))
      .limit(3);

    const recentValues = recentMeasurements.map((m: { value: string }) =>
      parseFloat(m.value),
    );
    const newTrend = computeTrend(recentValues, kriRow.direction);

    // 4. Update KRI: currentValue, currentAlertStatus, trend, lastMeasuredAt
    const previousAlertStatus = kriRow.currentAlertStatus;

    const [updatedKri] = await tx
      .update(kri)
      .set({
        currentValue: body.data.value.toString(),
        currentAlertStatus: newAlertStatus,
        trend: newTrend,
        lastMeasuredAt: new Date(body.data.measuredAt),
        updatedAt: new Date(),
        updatedBy: ctx.userId,
      })
      .where(eq(kri.id, kriId))
      .returning();

    // 5. If alert status CHANGED and alertEnabled: create notifications
    if (newAlertStatus !== previousAlertStatus && kriRow.alertEnabled) {
      const targetRoles: ("admin" | "risk_manager")[] =
        newAlertStatus === "red"
          ? ["risk_manager", "admin"]
          : newAlertStatus === "yellow"
            ? ["risk_manager"]
            : [];

      if (targetRoles.length > 0) {
        // Find users with target roles in this org
        const targetUsers: { userId: string; role: string }[] = await tx
          .select({
            userId: userOrganizationRole.userId,
            role: userOrganizationRole.role,
          })
          .from(userOrganizationRole)
          .where(
            and(
              eq(userOrganizationRole.orgId, ctx.orgId),
              isNull(userOrganizationRole.deletedAt),
            ),
          );

        const notifyUserIds = [
          ...new Set(
            targetUsers
              .filter((u: { userId: string; role: string }) =>
                targetRoles.includes(u.role as "admin" | "risk_manager"),
              )
              .map((u: { userId: string; role: string }) => u.userId),
          ),
        ];

        const alertLabel = newAlertStatus === "red" ? "RED" : "YELLOW";

        // Insert notifications for each target user
        if (notifyUserIds.length > 0) {
          await tx.insert(notification).values(
            notifyUserIds.map((userId) => ({
              userId,
              orgId: ctx.orgId,
              type: "status_change" as const,
              entityType: "kri",
              entityId: kriId,
              title: `KRI Alert: ${kriRow.name} is now ${alertLabel}`,
              message: `KRI "${kriRow.name}" alert status changed from ${previousAlertStatus.toUpperCase()} to ${alertLabel}. Current value: ${body.data.value}`,
              channel: "both" as const,
              templateKey: "kri_alert",
              templateData: {
                kriId,
                kriName: kriRow.name,
                previousStatus: previousAlertStatus,
                newStatus: newAlertStatus,
                value: body.data.value,
              },
              createdBy: ctx.userId,
            })),
          );
        }
      }
    }

    return { measurement, kri: updatedKri };
  });

  return Response.json({ data: result }, { status: 201 });
}

// GET /api/v1/kris/:id/measurements -- List measurements (paginated)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const { id: kriId } = await params;

  // Verify KRI exists in this org
  const [kriRow] = await db
    .select({ id: kri.id })
    .from(kri)
    .where(
      and(eq(kri.id, kriId), eq(kri.orgId, ctx.orgId), isNull(kri.deletedAt)),
    );

  if (!kriRow) {
    return Response.json({ error: "KRI not found" }, { status: 404 });
  }

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [
    eq(kriMeasurement.kriId, kriId),
    eq(kriMeasurement.orgId, ctx.orgId),
  ];

  // Filter by date range
  const from = searchParams.get("from");
  if (from) {
    conditions.push(gte(kriMeasurement.measuredAt, new Date(from)));
  }

  const to = searchParams.get("to");
  if (to) {
    conditions.push(lte(kriMeasurement.measuredAt, new Date(to)));
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(kriMeasurement)
      .where(where)
      .orderBy(desc(kriMeasurement.measuredAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(kriMeasurement).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
