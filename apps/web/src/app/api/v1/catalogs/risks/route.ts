import { db, riskCatalog } from "@grc/db";
import { eq, count, desc, ilike, or, and } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/catalogs/risks — List risk catalogs
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions = [eq(riskCatalog.isActive, true)];

  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(riskCatalog.name, pattern),
        ilike(riskCatalog.source, pattern),
      )!,
    );
  }

  const source = searchParams.get("source");
  if (source) {
    conditions.push(eq(riskCatalog.source, source));
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(riskCatalog)
      .where(where)
      .orderBy(desc(riskCatalog.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(riskCatalog).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
