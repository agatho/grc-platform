import { db, crossRegionReplication } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import { createCrossRegionReplicationSchema, listCrossRegionReplicationsQuerySchema } from "@grc/shared";

// GET /api/v1/data-sovereignty/replications
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = listCrossRegionReplicationsQuerySchema.parse(Object.fromEntries(url.searchParams));
  const conditions = [eq(crossRegionReplication.orgId, ctx.orgId)];
  if (query.status) conditions.push(eq(crossRegionReplication.status, query.status));

  const offset = (query.page - 1) * query.limit;
  const [rows, [{ total }]] = await Promise.all([
    db.select().from(crossRegionReplication).where(and(...conditions))
      .orderBy(desc(crossRegionReplication.createdAt)).limit(query.limit).offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(crossRegionReplication).where(and(...conditions)),
  ]);

  return Response.json({
    data: rows,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  });
}

// POST /api/v1/data-sovereignty/replications
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = createCrossRegionReplicationSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx.insert(crossRegionReplication).values({
      orgId: ctx.orgId, ...body,
    }).returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
