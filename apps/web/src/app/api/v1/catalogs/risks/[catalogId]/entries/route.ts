import { db, catalogEntry } from "@grc/db";
import { eq, and, count, asc, ilike, or, isNull } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/catalogs/risks/[catalogId]/entries — List catalog entries
export const GET = withErrorHandler(async function GET(
  req: Request,
  { params }: { params: Promise<{ catalogId: string }> },
) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { catalogId } = await params;
  const { page, limit, offset, searchParams } = paginate(req);

  const conditions: SQL[] = [eq(catalogEntry.catalogId, catalogId)];

  // Level filter
  const levelParam = searchParams.get("level");
  if (levelParam) {
    conditions.push(eq(catalogEntry.level, Number(levelParam)));
  }

  // Parent filter (for tree browsing)
  const parentEntryId = searchParams.get("parentEntryId");
  if (parentEntryId === "null" || parentEntryId === "root") {
    conditions.push(isNull(catalogEntry.parentEntryId));
  } else if (parentEntryId) {
    conditions.push(eq(catalogEntry.parentEntryId, parentEntryId));
  }

  // Search
  const search = searchParams.get("search");
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(ilike(catalogEntry.code, pattern), ilike(catalogEntry.name, pattern))!,
    );
  }

  // Only active entries by default
  const includeInactive = searchParams.get("includeInactive") === "true";
  if (!includeInactive) {
    conditions.push(eq(catalogEntry.status, "active"));
  }

  const where = and(...conditions);

  const [items, [{ value: total }]] = await Promise.all([
    db
      .select()
      .from(catalogEntry)
      .where(where)
      .orderBy(asc(catalogEntry.sortOrder), asc(catalogEntry.code))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(catalogEntry).where(where),
  ]);

  return paginatedResponse(items, total, page, limit);
});
