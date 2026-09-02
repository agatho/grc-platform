import { db, cveFeedItem } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, desc, gte, lte, ilike, or } from "drizzle-orm";
import { withAuth, paginate } from "@/lib/api";
import { z } from "zod";
import {
  parseQueryParams,
  searchQueryParam,
  dateQueryParam,
} from "@/lib/query-schema";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// #S04-09 (ARCTOS-FULL-2026-08-31): query parameters are now validated
// against a schema instead of being read as `string | null` and cast
// with `as <enum>`. An unknown filter value used to reach Postgres and
// surface as a 500 (`invalid input value for enum …`); it is a 422 now,
// and free-text search terms are length-bounded.
const cveFeedQuerySchema = z.object({
  severity: z.string().trim().min(1).max(40).optional(),
  search: searchQueryParam,
  // Previously fed straight into `new Date(...)`; an unparseable value
  // produced an Invalid Date and a Postgres error.
  startDate: dateQueryParam,
  endDate: dateQueryParam,
});

// GET /api/v1/isms/cve/feed — Latest CVE feed items (paginated)
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const q = parseQueryParams(cveFeedQuerySchema, searchParams);
  if (!q.ok)
    return Response.json(
      { error: q.message, details: q.details },
      { status: 422 },
    );
  const severity = q.data.severity ?? null;
  const search = q.data.search ?? null;
  const startDate = q.data.startDate ?? null;
  const endDate = q.data.endDate ?? null;

  const conditions: ReturnType<typeof eq>[] = [];

  if (severity) {
    conditions.push(eq(cveFeedItem.cvssSeverity, severity));
  }
  if (search) {
    conditions.push(
      or(
        ilike(cveFeedItem.cveId, `%${search}%`),
        ilike(cveFeedItem.title, `%${search}%`),
      )!,
    );
  }
  if (startDate) {
    conditions.push(gte(cveFeedItem.publishedAt, new Date(startDate)));
  }
  if (endDate) {
    conditions.push(lte(cveFeedItem.publishedAt, new Date(endDate)));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(cveFeedItem)
    .where(whereClause)
    .orderBy(desc(cveFeedItem.publishedAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(cveFeedItem)
    .where(whereClause);

  return Response.json({
    data: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});
