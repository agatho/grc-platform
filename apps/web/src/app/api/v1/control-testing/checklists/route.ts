import { db, controlTestChecklist, toTimestampInput } from "@grc/db";
import { createChecklistSchema, checklistQuerySchema } from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] `withErrorHandler` is what opens the
// `requestDbStorage.run(...)` frame that `withAuth` -> establishRequestScopedContext
// mutates with the org-pinned connection (apps/web/src/lib/api-wrapper.ts:113).
// Without it that helper falls back to `requestDbStorage.enterWith(...)`, which
// Next drops across the `await` in withAuth (api.ts:184-196), the handler's
// queries run on the context-less base pool, and RLS filters every row — the
// route answers 200 with an EMPTY list instead of the tenant's data.
import { withErrorHandler } from "@/lib/api-wrapper";

// POST /api/v1/control-testing/checklists — Create checklist
export const POST = withErrorHandler(async function POST(req: Request) {
  const ctx = await withAuth("admin", "control_owner", "auditor");
  if (ctx instanceof Response) return ctx;

  const body = createChecklistSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { error: "Validation failed", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(controlTestChecklist)
      .values({
        ...body.data,
        dueDate: toTimestampInput(body.data.dueDate),
        orgId: ctx.orgId,
        createdBy: ctx.userId,
        aiGenerated: false,
        totalItems: body.data.items.length,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
});
// GET /api/v1/control-testing/checklists
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth(
    "admin",
    "control_owner",
    "auditor",
    "risk_manager",
  );
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = checklistQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!query.success) {
    return Response.json(
      { error: "Invalid query", details: query.error.flatten() },
      { status: 422 },
    );
  }

  const { page, limit, controlId, status, assigneeId } = query.data;
  const offset = (page - 1) * limit;

  const conditions = [eq(controlTestChecklist.orgId, ctx.orgId)];
  if (controlId) conditions.push(eq(controlTestChecklist.controlId, controlId));
  if (status) conditions.push(eq(controlTestChecklist.status, status));
  if (assigneeId)
    conditions.push(eq(controlTestChecklist.assigneeId, assigneeId));

  const [checklists, countResult] = await Promise.all([
    db
      .select()
      .from(controlTestChecklist)
      .where(and(...conditions))
      .orderBy(desc(controlTestChecklist.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(controlTestChecklist)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: checklists,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
});
