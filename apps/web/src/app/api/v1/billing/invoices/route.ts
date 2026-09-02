import { db, billingInvoice } from "@grc/db";
import { billingQuerySchema } from "@grc/shared";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/billing/invoices — List invoices
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = billingQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success) {
    return Response.json(
      { error: "Validation failed", details: query.error.flatten() },
      { status: 422 },
    );
  }

  const conditions = [eq(billingInvoice.orgId, ctx.orgId)];
  if (query.data.status)
    conditions.push(eq(billingInvoice.status, query.data.status));
  if (query.data.startDate)
    conditions.push(
      gte(billingInvoice.createdAt, new Date(query.data.startDate)),
    );
  if (query.data.endDate)
    conditions.push(
      lte(billingInvoice.createdAt, new Date(query.data.endDate)),
    );

  const { page, limit, offset } = paginate(req);

  const rows = await db
    .select()
    .from(billingInvoice)
    .where(and(...conditions))
    .orderBy(desc(billingInvoice.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(billingInvoice)
    .where(and(...conditions));

  return Response.json(paginatedResponse(rows, Number(count), page, limit));
});
