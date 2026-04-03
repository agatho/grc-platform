import {
  db,
  kri,
  risk,
  notification,
  userOrganizationRole,
} from "@grc/db";
import { createKriSchema } from "@grc/shared";
import {
  eq,
  and,
  isNull,
  count,
  desc,
  sql,
} from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import { requireModule } from "@grc/auth";
import type { SQL } from "drizzle-orm";


// POST /api/v1/kris -- Create KRI
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, "POST");
  if (moduleCheck) return moduleCheck;

  const body = createKriSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Soft limit: max 200 KRIs per org
  const [{ value: kriCount }] = await db
    .select({ value: count() })
    .from(kri)
    .where(and(eq(kri.orgId, ctx.orgId), isNull(kri.deletedAt)));

  if (kriCount >= 200) {
    return Response.json(
      { error: "KRI limit reached (max 200 per organization)" },
      { status: 429 },
    );
  }

  // If riskId provided, verify risk exists in same org
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

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(kri)
      .values({
        orgId: ctx.orgId,
        name: body.data.name,
        description: body.data.description,
        riskId: body.data.riskId ?? null,
        unit: body.data.unit,
        direction: body.data.direction,
        thresholdGreen: body.data.thresholdGreen?.toString() ?? null,
        thresholdYellow: body.data.thresholdYellow?.toString() ?? null,
        thresholdRed: body.data.thresholdRed?.toString() ?? null,
        measurementFrequency: body.data.measurementFrequency,
        alertEnabled: body.data.alertEnabled,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })
      .returning();

    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/kris -- List KRIs (paginated, filterable)
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("erm", ctx.orgId, "GET");
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [
    eq(kri.orgId, ctx.orgId),
    isNull(kri.deletedAt),
  ];

  // Filter by alertStatus
  const alertStatus = searchParams.get("alertStatus");
  if (alertStatus && ["green", "yellow", "red"].includes(alertStatus)) {
    conditions.push(
      eq(kri.currentAlertStatus, alertStatus as "green" | "yellow" | "red"),
    );
  }

  // Filter by riskId
  const riskId = searchParams.get("riskId");
  if (riskId) {
    conditions.push(eq(kri.riskId, riskId));
  }

  // Filter by measurementFrequency
  const measurementFrequency = searchParams.get("measurementFrequency");
  if (
    measurementFrequency &&
    ["daily", "weekly", "monthly", "quarterly"].includes(measurementFrequency)
  ) {
    conditions.push(
      eq(
        kri.measurementFrequency,
        measurementFrequency as "daily" | "weekly" | "monthly" | "quarterly",
      ),
    );
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
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
        linkedRiskName: risk.title,
      })
      .from(kri)
      .leftJoin(risk, eq(kri.riskId, risk.id))
      .where(where)
      .orderBy(desc(kri.updatedAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(kri).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
