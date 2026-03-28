import { db, biQuery } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, ilike, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createBiQuerySchema, listBiQueriesQuerySchema } from "@grc/shared";

// GET /api/v1/bi-reports/queries
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const query = listBiQueriesQuerySchema.parse(Object.fromEntries(url.searchParams));
  const conditions = [eq(biQuery.orgId, ctx.orgId)];
  if (query.status) conditions.push(eq(biQuery.status, query.status));
  if (query.search) conditions.push(ilike(biQuery.name, `%${query.search}%`));

  const offset = (query.page - 1) * query.limit;
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(biQuery).where(and(...conditions))
      .orderBy(desc(biQuery.createdAt)).limit(query.limit).offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(biQuery).where(and(...conditions)),
  ]);

  return Response.json({
    data: rows,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  });
}

// POST /api/v1/bi-reports/queries
export async function POST(req: Request) {
  const ctx = await withAuth("admin", "risk_manager");
  if (ctx instanceof Response) return ctx;
  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createBiQuerySchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx.insert(biQuery).values({
      orgId: ctx.orgId,
      name: body.name,
      description: body.description,
      dataSourceId: body.dataSourceId,
      sqlText: body.sqlText,
      createdBy: ctx.userId,
    }).returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
