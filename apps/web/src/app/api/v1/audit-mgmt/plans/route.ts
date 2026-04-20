import { db, auditPlan } from "@grc/db";
import { createAuditPlanSchema } from "@grc/shared";
import { requireModule } from "@grc/auth";
import { eq, and, count, desc, asc, inArray, ilike } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";
import type { SQL } from "drizzle-orm";

// POST /api/v1/audit-mgmt/plans — Create audit plan
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "auditor", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createAuditPlanSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(auditPlan)
      .values({
        orgId: ctx.orgId,
        name: body.data.name,
        year: body.data.year,
        description: body.data.description,
        totalPlannedDays: body.data.totalPlannedDays,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/audit-mgmt/plans — List audit plans
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("audit", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(auditPlan.orgId, ctx.orgId)];

  // Year filter
  const year = searchParams.get("year");
  if (year) {
    conditions.push(eq(auditPlan.year, Number(year)));
  }

  // Status filter
  const status = searchParams.get("status");
  if (status) {
    const statuses = status.split(",") as Array<
      "draft" | "approved" | "active" | "completed"
    >;
    conditions.push(inArray(auditPlan.status, statuses));
  }

  // Search
  const search = searchParams.get("search");
  if (search) {
    conditions.push(ilike(auditPlan.name, `%${search}%`));
  }

  const where = and(...conditions);

  const sortDir = searchParams.get("sortDir") === "asc" ? asc : desc;

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(auditPlan)
      .where(where)
      .orderBy(sortDir(auditPlan.year), desc(auditPlan.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(auditPlan).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
