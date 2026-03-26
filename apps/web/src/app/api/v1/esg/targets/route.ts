import { db, esgTarget, esrsMetric } from "@grc/db";
import { createTargetSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

// POST /api/v1/esg/targets — Create target
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createTargetSchema.safeParse(await req.json());
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

  if (body.data.targetYear <= body.data.baselineYear) {
    return Response.json(
      { error: "Target year must be after baseline year" },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(esgTarget)
      .values({
        orgId: ctx.orgId,
        metricId: body.data.metricId,
        name: body.data.name,
        baselineYear: body.data.baselineYear,
        baselineValue: String(body.data.baselineValue),
        targetYear: body.data.targetYear,
        targetValue: String(body.data.targetValue),
        targetType: body.data.targetType,
        sbtiAligned: body.data.sbtiAligned,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/esg/targets — List targets
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(esgTarget.orgId, ctx.orgId)];

  const status = searchParams.get("status");
  if (
    status &&
    ["on_track", "at_risk", "off_track", "achieved"].includes(status)
  ) {
    conditions.push(
      eq(
        esgTarget.status,
        status as "on_track" | "at_risk" | "off_track" | "achieved",
      ),
    );
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: esgTarget.id,
        orgId: esgTarget.orgId,
        metricId: esgTarget.metricId,
        metricName: esrsMetric.name,
        name: esgTarget.name,
        baselineYear: esgTarget.baselineYear,
        baselineValue: esgTarget.baselineValue,
        targetYear: esgTarget.targetYear,
        targetValue: esgTarget.targetValue,
        targetType: esgTarget.targetType,
        sbtiAligned: esgTarget.sbtiAligned,
        status: esgTarget.status,
        createdAt: esgTarget.createdAt,
        updatedAt: esgTarget.updatedAt,
      })
      .from(esgTarget)
      .leftJoin(esrsMetric, eq(esgTarget.metricId, esrsMetric.id))
      .where(where)
      .orderBy(desc(esgTarget.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(esgTarget).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
