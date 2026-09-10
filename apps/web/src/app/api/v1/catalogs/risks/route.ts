import { db, catalog } from "@grc/db";
import { eq, count, desc, ilike, or, and, arrayContains } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/catalogs/risks — List risk catalogs (from generic catalog table)
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);

  const conditions = [
    eq(catalog.isActive, true),
    eq(catalog.catalogType, "risk"),
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

  const moduleKey = searchParams.get("module");
  if (moduleKey) {
    conditions.push(arrayContains(catalog.targetModules, [moduleKey]));
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
});
