import { db, automationRule } from "@grc/db";
import {
  createAutomationRuleSchema,
  automationRuleQuerySchema,
} from "@grc/shared";
import { eq, and, desc, sql, ilike } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// POST /api/v1/automation/rules — Create a new automation rule (admin only)
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const body = createAutomationRuleSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const [created] = await db
    .insert(automationRule)
    .values({
      orgId: ctx.orgId,
      name: body.data.name,
      description: body.data.description,
      triggerType: body.data.triggerType,
      triggerConfig: body.data.triggerConfig,
      conditions: body.data.conditions,
      actions: body.data.actions,
      cooldownMinutes: body.data.cooldownMinutes,
      maxExecutionsPerHour: body.data.maxExecutionsPerHour,
      createdBy: ctx.userId,
    })
    .returning();

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/automation/rules — List automation rules (admin only)
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);

  const query = automationRuleQuerySchema.safeParse({
    isActive: searchParams.get("isActive") ?? undefined,
    triggerType: searchParams.get("triggerType") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    page,
    limit,
  });

  // Build where conditions
  const conditions = [eq(automationRule.orgId, ctx.orgId)];

  if (query.success && query.data.isActive !== undefined) {
    conditions.push(eq(automationRule.isActive, query.data.isActive));
  }
  if (query.success && query.data.triggerType) {
    conditions.push(eq(automationRule.triggerType, query.data.triggerType));
  }
  if (query.success && query.data.search) {
    conditions.push(ilike(automationRule.name, `%${query.data.search}%`));
  }

  const rows = await db
    .select()
    .from(automationRule)
    .where(and(...conditions))
    .orderBy(desc(automationRule.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count: total }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(automationRule)
    .where(and(...conditions));

  return paginatedResponse(rows, total, page, limit);
}
