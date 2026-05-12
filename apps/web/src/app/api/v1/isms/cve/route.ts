// #NIGHT-005: /api/v1/isms/cve root returned 404 — sub-routes
// (dashboard, feed, matches) exist but no aggregated list endpoint.
// This route returns the matched CVEs for the calling tenant — the
// closest thing to a "list of CVEs relevant to me".

import { db, cveAssetMatch, cveFeedItem } from "@grc/db";
import { eq, desc } from "drizzle-orm";
import { requireModule } from "@grc/auth";
import { withAuth, paginate } from "@/lib/api";
import { withErrorHandler } from "@/lib/api-wrapper";

export const GET = withErrorHandler(async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { limit, offset } = paginate(req);

  const rows = await db
    .select({
      id: cveAssetMatch.id,
      cveId: cveFeedItem.cveId,
      assetId: cveAssetMatch.assetId,
      matchedCpe: cveAssetMatch.matchedCpe,
      status: cveAssetMatch.status,
      matchedAt: cveAssetMatch.matchedAt,
    })
    .from(cveAssetMatch)
    .innerJoin(cveFeedItem, eq(cveAssetMatch.cveId, cveFeedItem.id))
    .where(eq(cveAssetMatch.orgId, ctx.orgId))
    .orderBy(desc(cveAssetMatch.matchedAt))
    .limit(limit)
    .offset(offset);

  return Response.json({
    data: rows,
    meta: {
      relatedEndpoints: [
        { method: "GET", path: "/api/v1/isms/cve/dashboard" },
        {
          method: "GET",
          path: "/api/v1/isms/cve/feed",
          description: "Global NVD feed",
        },
        {
          method: "GET",
          path: "/api/v1/isms/cve/matches",
          description: "Asset-CVE matching",
        },
      ],
    },
  });
});
