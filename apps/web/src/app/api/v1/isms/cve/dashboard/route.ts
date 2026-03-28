import { db, cveAssetMatch, cveFeedItem } from "@grc/db";
import { requireModule } from "@grc/auth";
import { eq, and, sql, gte } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/isms/cve/dashboard — CVE dashboard KPIs
export async function GET(req: Request) {
  const ctx = await withAuth();
  if (ctx instanceof Response) return ctx;

  const moduleCheck = await requireModule("isms", ctx.orgId, req.method);
  if (moduleCheck) return moduleCheck;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Open matches (new + acknowledged)
  const [matchStats] = await db
    .select({
      openMatches: sql<number>`count(*) filter (where ${cveAssetMatch.status} in ('new', 'acknowledged'))::int`,
      newMatchesLast7Days: sql<number>`count(*) filter (where ${cveAssetMatch.matchedAt} >= ${sevenDaysAgo})::int`,
      affectedAssets: sql<number>`count(distinct ${cveAssetMatch.assetId}) filter (where ${cveAssetMatch.status} in ('new', 'acknowledged'))::int`,
    })
    .from(cveAssetMatch)
    .where(eq(cveAssetMatch.orgId, ctx.orgId));

  // Critical CVEs affecting org's assets
  const [criticalStats] = await db
    .select({
      criticalCves: sql<number>`count(distinct ${cveAssetMatch.cveId})::int`,
    })
    .from(cveAssetMatch)
    .leftJoin(cveFeedItem, eq(cveAssetMatch.cveId, cveFeedItem.id))
    .where(
      and(
        eq(cveAssetMatch.orgId, ctx.orgId),
        eq(cveFeedItem.cvssSeverity, "critical"),
        sql`${cveAssetMatch.status} in ('new', 'acknowledged')`,
      ),
    );

  // Mean remediation time for resolved matches
  const [remediationStats] = await db
    .select({
      avgDays: sql<number>`coalesce(
        avg(extract(epoch from (${cveAssetMatch.acknowledgedAt} - ${cveAssetMatch.matchedAt})) / 86400)::numeric(10, 1),
        0
      )`,
    })
    .from(cveAssetMatch)
    .where(
      and(
        eq(cveAssetMatch.orgId, ctx.orgId),
        sql`${cveAssetMatch.status} in ('mitigated', 'not_applicable')`,
        sql`${cveAssetMatch.acknowledgedAt} is not null`,
      ),
    );

  // Total CVEs in feed
  const [feedStats] = await db
    .select({ totalCvesInFeed: sql<number>`count(*)::int` })
    .from(cveFeedItem);

  // Last sync time
  const [lastSync] = await db
    .select({ fetchedAt: cveFeedItem.fetchedAt })
    .from(cveFeedItem)
    .orderBy(sql`${cveFeedItem.fetchedAt} desc`)
    .limit(1);

  return Response.json({
    data: {
      openMatches: matchStats.openMatches,
      criticalCves: criticalStats.criticalCves,
      affectedAssets: matchStats.affectedAssets,
      meanRemediationDays: Number(remediationStats.avgDays),
      newMatchesLast7Days: matchStats.newMatchesLast7Days,
      totalCvesInFeed: feedStats.totalCvesInFeed,
      lastSyncAt: lastSync?.fetchedAt?.toISOString() ?? null,
    },
  });
}
