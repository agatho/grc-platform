import { db, controlCatalog } from "@grc/db";
import { eq, count, desc, ilike, or, and } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/catalogs/controls — List control catalogs
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions = [eq(controlCatalog.isActive, true)];

  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(controlCatalog.name, pattern),
        ilike(controlCatalog.source, pattern),
      )!,
    );
  }

  const source = searchParams.get("source");
  if (source) {
    conditions.push(eq(controlCatalog.source, source));
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(controlCatalog)
      .where(where)
      .orderBy(desc(controlCatalog.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(controlCatalog).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
