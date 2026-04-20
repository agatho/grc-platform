// Sprint 86: Community License Check Worker
// Runs daily — checks license validity for enterprise editions

import { db, communityEditionConfig } from "@grc/db";
import { eq, and, lt } from "drizzle-orm";

export async function processCommunityLicenseCheck(): Promise<{
  expiredCount: number;
  downgradeCount: number;
}> {
  console.log("[community-license-check] Running license validity check");

  // Find expired enterprise licenses
  const expired = await db
    .select()
    .from(communityEditionConfig)
    .where(
      and(
        eq(communityEditionConfig.editionType, "enterprise"),
        lt(communityEditionConfig.licenseExpiresAt, new Date()),
      ),
    );

  let downgradeCount = 0;

  for (const config of expired) {
    try {
      // Downgrade to community edition
      await db
        .update(communityEditionConfig)
        .set({
          editionType: "community",
          enabledModules: ["erm", "bpm", "ics", "dms"],
          maxUsers: 25,
          maxEntities: 3,
          updatedAt: new Date(),
        })
        .where(eq(communityEditionConfig.id, config.id));

      downgradeCount++;
      console.log(
        `[community-license-check] Downgraded org ${config.orgId} to community edition`,
      );
    } catch (err) {
      console.error(
        `[community-license-check] Failed to downgrade org ${config.orgId}:`,
        err,
      );
    }
  }

  console.log(
    `[community-license-check] Found ${expired.length} expired, downgraded ${downgradeCount}`,
  );
  return { expiredCount: expired.length, downgradeCount };
}
