import { db, grcBudget } from "@grc/db";
import { eq, count, desc } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/budgets — List all budgets for the org (lightweight dropdown use)
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset } = paginate(req);

  const conditions = eq(grcBudget.orgId, ctx.orgId);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: grcBudget.id,
        name: grcBudget.name,
        budgetType: grcBudget.budgetType,
        grcArea: grcBudget.grcArea,
        totalAmount: grcBudget.totalAmount,
        currency: grcBudget.currency,
        status: grcBudget.status,
      })
      .from(grcBudget)
      .where(conditions)
      .orderBy(desc(grcBudget.year))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(grcBudget).where(conditions),
  ]);

  return paginatedResponse(items, total, page, limit);
}
