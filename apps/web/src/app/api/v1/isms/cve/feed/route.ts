import { db, cveFeedItem } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, desc, gte, lte, ilike, or } from "drizzle-orm";
import { withAuth, paginate } from "@/lib/api";

// GET /api/v1/isms/cve/feed — Latest CVE feed items (paginated)
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const severity = searchParams.get("severity");
  const search = searchParams.get("search");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

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
}
