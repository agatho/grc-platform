import { db, evidenceFreshnessConfig } from "@grc/db";
import { createFreshnessConfigSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/connectors/freshness-config
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "control_owner");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createFreshnessConfigSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(evidenceFreshnessConfig)
      .values({
        orgId: ctx.orgId,
        entityType: body.data.entityType,
        entityId: body.data.entityId,
        connectorId: body.data.connectorId,
        testKey: body.data.testKey,
        maxAgeDays: body.data.maxAgeDays,
        warningDays: body.data.warningDays,
        autoCollect: body.data.autoCollect,
        notifyOnStale: body.data.notifyOnStale,
        notifyRoles: body.data.notifyRoles ?? ["control_owner", "risk_manager"],
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/connectors/freshness-config
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("ics", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(evidenceFreshnessConfig.orgId, ctx.orgId)];

  const entityType = searchParams.get("entityType");
  if (entityType) {
    conditions.push(eq(evidenceFreshnessConfig.entityType, entityType));
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(evidenceFreshnessConfig)
      .where(where)
      .orderBy(desc(evidenceFreshnessConfig.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(evidenceFreshnessConfig).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
