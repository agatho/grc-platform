import { db, continuityStrategy } from "@grc/db";
import { createContinuityStrategySchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc, ilike, or } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/bcms/strategies — Create strategy
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createContinuityStrategySchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(continuityStrategy)
      .values({
        orgId: ctx.orgId,
        processId: body.data.processId,
        strategyType: body.data.strategyType,
        name: body.data.name,
        description: body.data.description,
        rtoTargetHours: body.data.rtoTargetHours,
        estimatedCostEur: body.data.estimatedCostEur?.toString(),
        annualCostEur: body.data.annualCostEur?.toString(),
        requiredStaff: body.data.requiredStaff,
        requiredSystems: body.data.requiredSystems,
        alternateLocation: body.data.alternateLocation,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/bcms/strategies — List strategies
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(continuityStrategy.orgId, ctx.orgId)];

  const processId = searchParams.get("processId");
  if (processId) {
    conditions.push(eq(continuityStrategy.processId, processId));
  }

  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(continuityStrategy.name, pattern),
        ilike(continuityStrategy.description, pattern),
      )!,
    );
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(continuityStrategy)
      .where(where)
      .orderBy(desc(continuityStrategy.updatedAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(continuityStrategy).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
