import { db, controlTestChecklist } from "@grc/db";
import { createChecklistSchema, checklistQuerySchema } from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/control-testing/checklists — Create checklist
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "control_owner", "auditor");
  if (ctx instanceof Response) return ctx;

  const body = createChecklistSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx.insert(controlTestChecklist)
      .values({
        ...body.data,
        orgId: ctx.orgId,
        createdBy: ctx.userId,
        aiGenerated: false,
        totalItems: body.data.items.length,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}

// GET /api/v1/control-testing/checklists
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "control_owner", "auditor", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = checklistQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) {
    return Response.json({ error: "Invalid query", details: query.error.flatten() }, { status: 422 });
  }

  const { page, limit, controlId, status, assigneeId } = query.data;
  const offset = (page - 1) * limit;

  const conditions = [eq(controlTestChecklist.orgId, ctx.orgId)];
  if (controlId) conditions.push(eq(controlTestChecklist.controlId, controlId));
  if (status) conditions.push(eq(controlTestChecklist.status, status));
  if (assigneeId) conditions.push(eq(controlTestChecklist.assigneeId, assigneeId));

  const [checklists, countResult] = await Promise.all([
    db.select().from(controlTestChecklist)
      .where(and(...conditions))
      .orderBy(desc(controlTestChecklist.createdAt))
      .limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(controlTestChecklist)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: checklists,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
}
