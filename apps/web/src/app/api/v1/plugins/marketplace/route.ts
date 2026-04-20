import { db, extensionMarketplace, plugin } from "@grc/db";
import { eq, desc, sql, ilike } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";

// GET /api/v1/plugins/marketplace — Browse marketplace
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const search = url.searchParams.get("search");
  const pricingModel = url.searchParams.get("pricingModel");
  const featured = url.searchParams.get("featured");
  const { page, limit, offset } = paginate(req);

  const conditions = [];
  if (pricingModel)
    conditions.push(eq(extensionMarketplace.pricingModel, pricingModel));
  if (featured === "true")
    conditions.push(eq(extensionMarketplace.isFeatured, true));

  const whereClause =
    conditions.length > 0
      ? sql`${sql.join(conditions, sql` AND `)}`
      : undefined;

  const rows = await db
    .select({
      listing: extensionMarketplace,
      plugin: {
        id: plugin.id,
        key: plugin.key,
        name: plugin.name,
        version: plugin.version,
        category: plugin.category,
        author: plugin.author,
        iconUrl: plugin.iconUrl,
        isVerified: plugin.isVerified,
      },
    })
    .from(extensionMarketplace)
    .innerJoin(plugin, eq(extensionMarketplace.pluginId, plugin.id))
    .where(whereClause)
    .orderBy(desc(extensionMarketplace.downloadCount))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(extensionMarketplace)
    .where(whereClause);

  return Response.json(paginatedResponse(rows, Number(count), page, limit));
}
