import { db, grcBudget } from "@grc/db";
import { createBudgetSchema } from "@grc/shared";
import { eq, and, count, desc, isNull } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

// POST /api/v1/budget — Create budget (hierarchical)
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const body = createBudgetSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  // If parentBudgetId provided, verify it exists and belongs to same org
  if (body.data.parentBudgetId) {
    const [parent] = await db
      .select({ id: grcBudget.id })
      .from(grcBudget)
      .where(
        and(
          eq(grcBudget.id, body.data.parentBudgetId),
          eq(grcBudget.orgId, ctx.orgId),
        ),
      );
    if (!parent) {
      return Response.json(
        { error: "Parent budget not found" },
        { status: 404 },
      );
    }
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(grcBudget)
      .values({
        orgId: ctx.orgId,
        name: body.data.name,
        budgetType: body.data.budgetType,
        grcArea: body.data.grcArea,
        year: body.data.year,
        periodStart: body.data.periodStart,
        periodEnd: body.data.periodEnd,
        totalAmount: body.data.totalAmount.toString(),
        currency: body.data.currency,
        ownerId: body.data.ownerId,
        parentBudgetId: body.data.parentBudgetId,
        notes: body.data.notes,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/budget — List budgets, optionally filtered by parentId
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);
  const parentId = searchParams.get("parentId");
  const rootOnly = searchParams.get("rootOnly") === "true";

  const conditions = parentId
    ? and(
        eq(grcBudget.orgId, ctx.orgId),
        eq(grcBudget.parentBudgetId, parentId),
      )
    : rootOnly
      ? and(eq(grcBudget.orgId, ctx.orgId), isNull(grcBudget.parentBudgetId))
      : eq(grcBudget.orgId, ctx.orgId);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(grcBudget)
      .where(conditions)
      .orderBy(desc(grcBudget.year))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(grcBudget).where(conditions),
  ]);

  return paginatedResponse(items, total, page, limit);
}
