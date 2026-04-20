import { db, crisisScenario } from "@grc/db";
import { createCrisisScenarioSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc, ilike, or, inArray } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/bcms/crisis — Create crisis scenario
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createCrisisScenarioSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(crisisScenario)
      .values({
        orgId: ctx.orgId,
        name: body.data.name,
        description: body.data.description,
        category: body.data.category,
        severity: body.data.severity,
        bcpId: body.data.bcpId,
        escalationMatrix: body.data.escalationMatrix,
        communicationTemplate: body.data.communicationTemplate,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/bcms/crisis — List crisis scenarios
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("bcms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(crisisScenario.orgId, ctx.orgId)];

  const statusParam = searchParams.get("status");
  if (statusParam) {
    const statuses = statusParam.split(",") as Array<
      "standby" | "activated" | "resolved" | "post_mortem"
    >;
    conditions.push(inArray(crisisScenario.status, statuses));
  }

  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(crisisScenario.name, pattern),
        ilike(crisisScenario.description, pattern),
      )!,
    );
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(crisisScenario)
      .where(where)
      .orderBy(desc(crisisScenario.updatedAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(crisisScenario).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
