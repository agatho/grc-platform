import { db, regulatoryFeedItem } from "@grc/db";
import { sql, count, desc, eq, and } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import { regulatoryFeedQuerySchema } from "@grc/shared";

// GET /api/v1/regulatory/feed — Paginated regulatory feed
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const parsed = regulatoryFeedQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? "1",
    limit: url.searchParams.get("limit") ?? "20",
    source: url.searchParams.get("source") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    jurisdiction: url.searchParams.get("jurisdiction") ?? undefined,
    framework: url.searchParams.get("framework") ?? undefined,
    since: url.searchParams.get("since") ?? undefined,
  });

  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof sql>[] = [];

  if (parsed.data.source) {
    conditions.push(sql`${regulatoryFeedItem.source} = ${parsed.data.source}`);
  }
  if (parsed.data.category) {
    conditions.push(sql`${regulatoryFeedItem.category} = ${parsed.data.category}`);
  }
  if (parsed.data.jurisdiction) {
    conditions.push(sql`${parsed.data.jurisdiction} = ANY(${regulatoryFeedItem.jurisdictions})`);
  }
  if (parsed.data.framework) {
    conditions.push(sql`${parsed.data.framework} = ANY(${regulatoryFeedItem.frameworks})`);
  }
  if (parsed.data.since) {
    conditions.push(sql`${regulatoryFeedItem.publishedAt} >= ${parsed.data.since}`);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db
    .select({ total: count() })
    .from(regulatoryFeedItem)
    .where(where);

  const rows = await db
    .select()
    .from(regulatoryFeedItem)
    .where(where)
    .orderBy(desc(regulatoryFeedItem.publishedAt))
    .limit(limit)
    .offset(offset);

  return paginatedResponse(rows, totalRow?.total ?? 0, page, limit);
}
