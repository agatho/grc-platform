import { db, dataRegion } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createDataRegionSchema, listDataRegionsQuerySchema } from "@grc/shared";

// GET /api/v1/data-sovereignty/regions
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = listDataRegionsQuerySchema.parse(Object.fromEntries(url.searchParams));
  const conditions = [];
  if (query.status) conditions.push(eq(dataRegion.status, query.status));

  const offset = (query.page - 1) * query.limit;
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(dataRegion).where(whereClause)
      .orderBy(dataRegion.name).limit(query.limit).offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(dataRegion).where(whereClause),
  ]);

  return Response.json({
    data: rows,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  });
}

// POST /api/v1/data-sovereignty/regions
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = createDataRegionSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx.insert(dataRegion).values(body).returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
