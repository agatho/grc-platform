// Sprint 69: Regulatory Digest Generator Worker
// Runs weekly (Monday 8:00) — generates weekly regulatory digests

import { db, regulatoryChange, regulatoryDigest } from "@grc/db";
import { eq, and, gte, lte, sql } from "drizzle-orm";

export async function processRegulatoryDigest(): Promise<{
  digestsGenerated: number;
}> {
  console.log("[regulatory-digest-generator] Generating weekly digests");

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const periodStart = weekAgo.toISOString().split("T")[0];
  const periodEnd = now.toISOString().split("T")[0];

  // Get all orgs with regulatory changes
  const orgChanges = await db
    .select({
      orgId: regulatoryChange.orgId,
      count: sql<number>`count(*)`,
      criticalCount: sql<number>`count(*) filter (where ${regulatoryChange.classification} = 'critical')`,
    })
    .from(regulatoryChange)
    .where(gte(regulatoryChange.createdAt, weekAgo))
    .groupBy(regulatoryChange.orgId);

  let digestsGenerated = 0;

  for (const orgChange of orgChanges) {
    try {
      // In production: generate AI summary of changes
      await db.insert(regulatoryDigest).values({
        orgId: orgChange.orgId,
        periodStart,
        periodEnd,
        digestType: "weekly",
        summary: `Weekly regulatory digest: ${orgChange.count} changes detected, ${orgChange.criticalCount} critical.`,
        changeCount: orgChange.count,
        criticalCount: orgChange.criticalCount,
      });
      digestsGenerated++;
    } catch (err) {
      console.error(`[regulatory-digest-generator] Failed for org ${orgChange.orgId}:`, err);
    }
  }

  console.log(`[regulatory-digest-generator] Generated ${digestsGenerated} digests`);
  return { digestsGenerated };
}
