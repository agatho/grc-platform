import { db, regulatoryFeedItem, regulatoryRelevanceScore } from "@grc/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
import { count } from "drizzle-orm";

// GET /api/v1/regulatory/relevant — Org-relevant regulatory items with relevance scores
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const { page, limit, offset, searchParams } = paginate(req);
  const minRelevance = Number(searchParams.get("minRelevance") ?? 0);

  const conditions = [eq(regulatoryRelevanceScore.orgId, ctx.orgId)];

  if (minRelevance > 0) {
    conditions.push(
      sql`${regulatoryRelevanceScore.relevanceScore} >= ${minRelevance}`,
    );
  }

  const where = and(...conditions);

  const [totalRow] = await db
    .select({ total: count() })
    .from(regulatoryRelevanceScore)
    .where(where);

  const rows = await db
    .select({
      id: regulatoryRelevanceScore.id,
      feedItemId: regulatoryRelevanceScore.feedItemId,
      relevanceScore: regulatoryRelevanceScore.relevanceScore,
      reasoning: regulatoryRelevanceScore.reasoning,
      affectedModules: regulatoryRelevanceScore.affectedModules,
      isNotified: regulatoryRelevanceScore.isNotified,
      computedAt: regulatoryRelevanceScore.computedAt,
      // Feed item fields
      source: regulatoryFeedItem.source,
      title: regulatoryFeedItem.title,
      summary: regulatoryFeedItem.summary,
      url: regulatoryFeedItem.url,
      publishedAt: regulatoryFeedItem.publishedAt,
      category: regulatoryFeedItem.category,
      jurisdictions: regulatoryFeedItem.jurisdictions,
      frameworks: regulatoryFeedItem.frameworks,
    })
    .from(regulatoryRelevanceScore)
    .innerJoin(
      regulatoryFeedItem,
      eq(regulatoryFeedItem.id, regulatoryRelevanceScore.feedItemId),
    )
    .where(where)
    .orderBy(desc(regulatoryRelevanceScore.relevanceScore))
    .limit(limit)
    .offset(offset);

  return paginatedResponse(rows, totalRow?.total ?? 0, page, limit);
}
