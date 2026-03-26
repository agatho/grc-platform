import { db, riskCatalogEntry } from "@grc/db";
import { eq, and, count, asc, ilike, or, isNull } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/catalogs/risks/[catalogId]/entries — List risk catalog entries
export async function GET(
  req: Request,
  { params }: { params: Promise<{ catalogId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { catalogId } = await params;
  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(riskCatalogEntry.catalogId, catalogId)];

  // Level filter
  const levelParam = searchParams.get("level");
  if (levelParam) {
    conditions.push(eq(riskCatalogEntry.level, Number(levelParam)));
  }

  // Parent filter (for tree browsing)
  const parentEntryId = searchParams.get("parentEntryId");
  if (parentEntryId === "null" || parentEntryId === "root") {
    conditions.push(isNull(riskCatalogEntry.parentEntryId));
  } else if (parentEntryId) {
    conditions.push(eq(riskCatalogEntry.parentEntryId, parentEntryId));
  }

  // Search
  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(riskCatalogEntry.code, pattern),
        ilike(riskCatalogEntry.titleDe, pattern),
        ilike(riskCatalogEntry.titleEn, pattern),
      )!,
    );
  }

  // Only active entries by default
  const includeInactive = searchParams.get("includeInactive") === "true";
  if (!includeInactive) {
    conditions.push(eq(riskCatalogEntry.isActive, true));
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(riskCatalogEntry)
      .where(where)
      .orderBy(asc(riskCatalogEntry.sortOrder), asc(riskCatalogEntry.code))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(riskCatalogEntry).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
