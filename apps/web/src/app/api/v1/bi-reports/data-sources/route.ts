import { db, biDataSource } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, ilike, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import {
  createBiDataSourceSchema,
  listBiDataSourcesQuerySchema,
} from "@grc/shared";

// GET /api/v1/bi-reports/data-sources
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const query = listBiDataSourcesQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );
  const conditions = [eq(biDataSource.orgId, ctx.orgId)];
  if (query.sourceType)
    conditions.push(eq(biDataSource.sourceType, query.sourceType));
  if (query.search)
    conditions.push(ilike(biDataSource.name, `%${query.search}%`));

  const offset = (query.page - 1) * query.limit;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(biDataSource)
      .where(and(...conditions))
      .orderBy(desc(biDataSource.createdAt))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(biDataSource)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  });
}

// POST /api/v1/bi-reports/data-sources
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("reporting", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const body = createBiDataSourceSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(biDataSource)
      .values({
        orgId: ctx.orgId,
        ...body,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
