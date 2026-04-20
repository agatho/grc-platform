import { db, marketplaceListing } from "@grc/db";
import { eq, and, sql, desc, asc, ilike } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import {
  createMarketplaceListingSchema,
  listMarketplaceListingsQuerySchema,
} from "@grc/shared";

// GET /api/v1/marketplace/listings
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = listMarketplaceListingsQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );
  const conditions: ReturnType<typeof eq>[] = [
    eq(marketplaceListing.orgId, ctx.orgId),
  ];
  if (query.categoryId)
    conditions.push(eq(marketplaceListing.categoryId, query.categoryId));
  if (query.status)
    conditions.push(eq(marketplaceListing.status, query.status));
  if (query.isFeatured !== undefined)
    conditions.push(eq(marketplaceListing.isFeatured, query.isFeatured));
  if (query.isVerified !== undefined)
    conditions.push(eq(marketplaceListing.isVerified, query.isVerified));
  if (query.priceType)
    conditions.push(eq(marketplaceListing.priceType, query.priceType));
  if (query.search)
    conditions.push(ilike(marketplaceListing.name, `%${query.search}%`));

  const orderCol =
    query.sortBy === "install_count"
      ? marketplaceListing.installCount
      : query.sortBy === "avg_rating"
        ? marketplaceListing.avgRating
        : query.sortBy === "name"
          ? marketplaceListing.name
          : marketplaceListing.createdAt;
  const orderFn = query.sortOrder === "asc" ? asc : desc;
  const offset = (query.page - 1) * query.limit;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(marketplaceListing)
      .where(and(...conditions))
      .orderBy(orderFn(orderCol))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(marketplaceListing)
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

// POST /api/v1/marketplace/listings
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = createMarketplaceListingSchema.parse(await req.json());

  const result = await withAuditContext(ctx, async (tx) => {
    const [created] = await tx
      .insert(marketplaceListing)
      .values({
        orgId: ctx.orgId,
        ...body,
        createdBy: ctx.userId,
      })
      .returning();
    return created;
  });

  return Response.json({ data: result }, { status: 201 });
}
