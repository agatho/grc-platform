import { db, grcBudget } from "@grc/db";
import { eq, count, desc } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] `withErrorHandler` is what opens the
// `requestDbStorage.run(...)` frame that `withAuth` -> establishRequestScopedContext
// mutates with the org-pinned connection (apps/web/src/lib/api-wrapper.ts:113).
// Without it that helper falls back to `requestDbStorage.enterWith(...)`, which
// Next drops across the `await` in withAuth (api.ts:184-196), the handler's
// queries run on the context-less base pool, and RLS filters every row — the
// route answers 200 with an EMPTY list instead of the tenant's data.
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/budgets — List all budgets for the org (lightweight dropdown use)
export const GET = withErrorHandler(async function GET(req: Request) {
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
});
