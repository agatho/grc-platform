import { db, extensionMarketplace, plugin } from "@grc/db";
import { eq, desc, sql, or, ilike } from "drizzle-orm";
import { withAuth, paginate, paginatedResponse } from "@/lib/api";
// [E2E-TRIAGE-2026-09-02] withErrorHandler opens the requestDbStorage.run()
// frame that withAuth needs to bind the org-pinned connection; without it the
// handler queries the context-less pool and RLS filters every row (api.ts:184).
import { withErrorHandler } from "@/lib/api-wrapper";

// GET /api/v1/plugins/marketplace — Browse marketplace
export const GET = withErrorHandler(async function GET(req: Request) {
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
  // [ARCTOS-FULL-2026-08-31 / Welle 4b-4 · OP-176] `search` wurde gelesen und
  // nie in eine Bedingung uebersetzt: die Marktplatzsuche filterte nichts.
  // Gesucht wird ueber die beiden Spalten, die die Kachel anzeigt (`title`,
  // `short_description`) — beide liegen auf `extension_marketplace`, damit
  // die Zaehlabfrage weiter ohne den Verbund auf `plugin` auskommt und
  // Liste und `total` dieselbe Bedingung sehen.
  const term = search?.trim();
  if (term) {
    const pattern = `%${term}%`;
    const match = or(
      ilike(extensionMarketplace.title, pattern),
      ilike(extensionMarketplace.shortDescription, pattern),
    );
    if (match) conditions.push(match);
  }

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
});
