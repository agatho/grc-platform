import { db, controlCatalogEntry } from "@grc/db";
import { eq, and, count, asc, ilike, or, isNull } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/catalogs/controls/[catalogId]/entries — List control catalog entries
export async function GET(
  req: Request,
  { params }: { params: Promise<{ catalogId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { catalogId } = await params;
  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(controlCatalogEntry.catalogId, catalogId)];

  // Level filter
  const levelParam = searchParams.get("level");
  if (levelParam) {
    conditions.push(eq(controlCatalogEntry.level, Number(levelParam)));
  }

  // Parent filter
  const parentEntryId = searchParams.get("parentEntryId");
  if (parentEntryId === "null" || parentEntryId === "root") {
    conditions.push(isNull(controlCatalogEntry.parentEntryId));
  } else if (parentEntryId) {
    conditions.push(eq(controlCatalogEntry.parentEntryId, parentEntryId));
  }

  // Search
  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(controlCatalogEntry.code, pattern),
        ilike(controlCatalogEntry.titleDe, pattern),
        ilike(controlCatalogEntry.titleEn, pattern),
      )!,
    );
  }

  // Active filter
  const includeInactive = searchParams.get("includeInactive") === "true";
  if (!includeInactive) {
    conditions.push(eq(controlCatalogEntry.isActive, true));
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(controlCatalogEntry)
      .where(where)
      .orderBy(asc(controlCatalogEntry.sortOrder), asc(controlCatalogEntry.code))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(controlCatalogEntry).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
}
