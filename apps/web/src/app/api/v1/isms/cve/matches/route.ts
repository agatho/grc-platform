import { db, cveAssetMatch, cveFeedItem, asset } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, desc } from "drizzle-orm";
import { withAuth, paginate } from "@/lib/api";

// GET /api/v1/isms/cve/matches — CVE-Asset matches for org
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const { page, limit, offset, searchParams } = paginate(req);
  const status = searchParams.get("status");
  const severity = searchParams.get("severity");

  const conditions: ReturnType<typeof eq>[] = [
    eq(cveAssetMatch.orgId, ctx.orgId),
  ];

  if (status) {
    conditions.push(eq(cveAssetMatch.status, status));
  }

  const baseQuery = db
    .select({
      id: cveAssetMatch.id,
      cveId: cveAssetMatch.cveId,
      assetId: cveAssetMatch.assetId,
      orgId: cveAssetMatch.orgId,
      matchedCpe: cveAssetMatch.matchedCpe,
      status: cveAssetMatch.status,
      acknowledgedBy: cveAssetMatch.acknowledgedBy,
      acknowledgedAt: cveAssetMatch.acknowledgedAt,
      linkedVulnerabilityId: cveAssetMatch.linkedVulnerabilityId,
      matchedAt: cveAssetMatch.matchedAt,
      createdAt: cveAssetMatch.createdAt,
      updatedAt: cveAssetMatch.updatedAt,
      // Joined
      cveIdStr: cveFeedItem.cveId,
      cveTitle: cveFeedItem.title,
      cvssScore: cveFeedItem.cvssScore,
      cvssSeverity: cveFeedItem.cvssSeverity,
      cvePublishedAt: cveFeedItem.publishedAt,
      assetName: asset.name,
    })
    .from(cveAssetMatch)
    .leftJoin(cveFeedItem, eq(cveAssetMatch.cveId, cveFeedItem.id))
    .leftJoin(asset, eq(cveAssetMatch.assetId, asset.id));

  if (severity) {
    conditions.push(eq(cveFeedItem.cvssSeverity, severity));
  }

  const rows = await baseQuery
    .where(and(...conditions))
    .orderBy(desc(cveAssetMatch.matchedAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(cveAssetMatch)
    .leftJoin(cveFeedItem, eq(cveAssetMatch.cveId, cveFeedItem.id))
    .where(and(...conditions));

  return Response.json({
    data: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
