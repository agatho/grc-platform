import { db, catalog } from "@grc/db";
import { eq, count, desc, ilike, or, and, arrayContains } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/catalogs/controls — List control catalogs (from generic catalog table)
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions = [
    eq(catalog.isActive, true),
    eq(catalog.catalogType, "control"),
  ];

  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(ilike(catalog.name, pattern), ilike(catalog.source, pattern))!,
    );
  }

  const source = searchParams.get("source");
  if (source) {
    conditions.push(eq(catalog.source, source));
  }

  const module = searchParams.get("module");
  if (module) {
    conditions.push(arrayContains(catalog.targetModules, [module]));
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(catalog)
      .where(where)
      .orderBy(desc(catalog.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(catalog).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
