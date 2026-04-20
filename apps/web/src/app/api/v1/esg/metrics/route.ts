import { db, esrsMetric, esrsDatapointDefinition, user } from "@grc/db";
import { createEsrsMetricSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc, ilike, or } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

// POST /api/v1/esg/metrics — Create metric linked to datapoint
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createEsrsMetricSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // Verify datapoint exists
  const [datapoint] = await db
    .select({ id: esrsDatapointDefinition.id })
    .from(esrsDatapointDefinition)
    .where(eq(esrsDatapointDefinition.id, body.data.datapointId));

  if (!datapoint) {
    return Response.json(
      { error: "ESRS datapoint not found" },
      { status: 404 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(esrsMetric)
      .values({
        orgId: ctx.orgId,
        datapointId: body.data.datapointId,
        name: body.data.name,
        unit: body.data.unit,
        frequency: body.data.frequency,
        collectionMethod: body.data.collectionMethod,
        calculationFormula: body.data.calculationFormula,
        responsibleUserId: body.data.responsibleUserId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/esg/metrics — List org metrics
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("esg", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(esrsMetric.orgId, ctx.orgId)];

  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(or(ilike(esrsMetric.name, pattern))!);
  }

  const isActive = searchParams.get("isActive");
  if (isActive !== null) {
    conditions.push(eq(esrsMetric.isActive, isActive === "true"));
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: esrsMetric.id,
        orgId: esrsMetric.orgId,
        datapointId: esrsMetric.datapointId,
        datapointCode: esrsDatapointDefinition.datapointCode,
        esrsStandard: esrsDatapointDefinition.esrsStandard,
        datapointNameEn: esrsDatapointDefinition.nameEn,
        name: esrsMetric.name,
        unit: esrsMetric.unit,
        frequency: esrsMetric.frequency,
        collectionMethod: esrsMetric.collectionMethod,
        responsibleUserId: esrsMetric.responsibleUserId,
        responsibleUserName: user.name,
        isActive: esrsMetric.isActive,
        createdAt: esrsMetric.createdAt,
        updatedAt: esrsMetric.updatedAt,
      })
      .from(esrsMetric)
      .leftJoin(
        esrsDatapointDefinition,
        eq(esrsMetric.datapointId, esrsDatapointDefinition.id),
      )
      .leftJoin(user, eq(esrsMetric.responsibleUserId, user.id))
      .where(where)
      .orderBy(desc(esrsMetric.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(esrsMetric).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
