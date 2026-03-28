import { db, controlTestScript } from "@grc/db";
import { createTestScriptSchema, testScriptQuerySchema } from "@grc/shared";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";

// POST /api/v1/control-testing/scripts — Create test script
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "control_owner", "auditor");
  if (ctx instanceof Response) return ctx;

  const body = createTestScriptSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ error: "Validation failed", details: body.error.flatten() }, { status: 422 });
  }

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx.insert(controlTestScript)
      .values({
        ...body.data,
        orgId: ctx.orgId,
        createdBy: ctx.userId,
        aiGenerated: false,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}

// GET /api/v1/control-testing/scripts — List scripts
export async function GET(req: Request) {
  const ctx = await withAuth("admin", "control_owner", "auditor", "risk_manager");
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = testScriptQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!query.success) {
    return Response.json({ error: "Invalid query", details: query.error.flatten() }, { status: 422 });
  }

  const { page, limit, controlId, testType, isActive } = query.data;
  const offset = (page - 1) * limit;

  const conditions = [eq(controlTestScript.orgId, ctx.orgId)];
  if (controlId) conditions.push(eq(controlTestScript.controlId, controlId));
  if (testType) conditions.push(eq(controlTestScript.testType, testType));
  if (isActive !== undefined) conditions.push(eq(controlTestScript.isActive, isActive));

  const [scripts, countResult] = await Promise.all([
    db.select().from(controlTestScript)
      .where(and(...conditions))
      .orderBy(desc(controlTestScript.createdAt))
      .limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(controlTestScript)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: scripts,
    pagination: { page, limit, total: Number(countResult[0]?.count ?? 0) },
  });
}
