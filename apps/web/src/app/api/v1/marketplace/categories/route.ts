import { db, marketplaceCategory } from "@grc/db";
import { eq, and, asc } from "drizzle-orm";
import { withAuth, withAuditContext } from "@/lib/api";
import {
  createMarketplaceCategorySchema,
  listMarketplaceCategoriesQuerySchema,
} from "@grc/shared";

// GET /api/v1/marketplace/categories
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const query = listMarketplaceCategoriesQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );
  const conditions: ReturnType<typeof eq>[] = [];
  if (query.categoryType)
    conditions.push(eq(marketplaceCategory.categoryType, query.categoryType));
  if (query.isActive !== undefined)
    conditions.push(eq(marketplaceCategory.isActive, query.isActive));

  const rows = await db
    .select()
    .from(marketplaceCategory)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(marketplaceCategory.sortOrder));

  return Response.json({ data: rows });
}

// POST /api/v1/marketplace/categories
export async function POST(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;
  const body = createMarketplaceCategorySchema.parse(await req.json());

  const [created] = await db
    .insert(marketplaceCategory)
    .values(body)
    .returning();
  return Response.json({ data: created }, { status: 201 });
}
