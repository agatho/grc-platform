import { db, maturityModel } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createMaturityModelSchema, listMaturityModelsQuerySchema } from "@grc/shared";

// GET /api/v1/maturity/models
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const query = listMaturityModelsQuerySchema.parse(Object.fromEntries(url.searchParams));
  const conditions = [eq(maturityModel.orgId, ctx.orgId)];
  if (query.moduleKey) conditions.push(eq(maturityModel.moduleKey, query.moduleKey));

  const offset = (query.page - 1) * query.limit;
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(maturityModel).where(and(...conditions))
      .orderBy(maturityModel.moduleKey).limit(query.limit).offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(maturityModel).where(and(...conditions)),
  ]);

  return Response.json({
    data: rows,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  });
}

// POST /api/v1/maturity/models
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createMaturityModelSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx.insert(maturityModel).values({
      orgId: ctx.orgId,
      moduleKey: body.moduleKey,
      currentLevel: body.currentLevel,
      targetLevel: body.targetLevel,
      targetDate: body.targetDate ? new Date(body.targetDate) : undefined,
      notes: body.notes,
    }).returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
