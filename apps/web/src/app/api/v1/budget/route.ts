import { db, grcBudget } from "@grc/db";
import { createBudgetSchema } from "@grc/shared";
import { eq, and, count, desc } from "drizzle-orm";
import {
  withAuth,
  withAuditContext,
  paginate,
  paginatedResponse,
} from "@/lib/api";

// POST /api/v1/budget — Create yearly budget
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

  // Check for duplicate year
  const [existing] = await db
    .select({ id: grcBudget.id })
    .from(grcBudget)
    .where(
      and(
        eq(grcBudget.orgId, ctx.orgId),
        eq(grcBudget.year, body.data.year),
      ),
    );
  if (existing) {
    return Response.json(
      { error: `Budget for year ${body.data.year} already exists` },
      { status: 409 },
    );
  }

  const created = await withAuditContext(ctx, async (tx) => {
    const [row] = await tx
      .insert(grcBudget)
      .values({
        orgId: ctx.orgId,
        year: body.data.year,
        totalAmount: body.data.totalAmount.toString(),
        currency: body.data.currency,
        notes: body.data.notes,
        createdBy: ctx.userId,
      })
      .returning();
    return row;
  });

  return Response.json({ data: created }, { status: 201 });
}

// GET /api/v1/budget — List all budgets
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "risk_manager", "auditor");
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset } = paginate(req);

  const conditions = eq(grcBudget.orgId, ctx.orgId);

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
