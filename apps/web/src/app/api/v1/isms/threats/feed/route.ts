import { db, threatFeedItem, threatFeedSource } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import { threatFeedQuerySchema } from "@grc/shared";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/isms/threats/feed — Latest threat feed items
export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const url = new URL(req.url);
  const query = threatFeedQuerySchema.parse(
    Object.fromEntries(url.searchParams),
  );

  const conditions = [eq(threatFeedItem.orgId, ctx.orgId)];
  if (query.sourceId) {
    conditions.push(eq(threatFeedItem.sourceId, query.sourceId));
  }

  const offset = (query.page - 1) * query.limit;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: threatFeedItem.id,
        title: threatFeedItem.title,
        description: threatFeedItem.description,
        link: threatFeedItem.link,
        publishedAt: threatFeedItem.publishedAt,
        category: threatFeedItem.category,
        fetchedAt: threatFeedItem.fetchedAt,
        sourceName: threatFeedSource.name,
      })
      .from(threatFeedItem)
      .leftJoin(
        threatFeedSource,
        eq(threatFeedItem.sourceId, threatFeedSource.id),
      )
      .where(and(...conditions))
      .orderBy(desc(threatFeedItem.publishedAt))
      .limit(query.limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(threatFeedItem)
      .where(and(...conditions)),
  ]);

  return Response.json({
    data: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  });
});
