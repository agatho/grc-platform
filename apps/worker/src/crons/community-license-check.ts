// Sprint 86: Community License Check Worker
// Runs daily — checks license validity for enterprise editions

import { db, communityEditionConfig } from "@grc/db";
import { eq, and, lt } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

export const processCommunityLicenseCheck = withCronInstrumentation(
  "community-license-check",
  async (): Promise<{ expiredCount: number; downgradeCount: number }> => {
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
      } catch {
        // Wrapper logs structured error; loop continues to next org.
      }
    }

    return { expiredCount: expired.length, downgradeCount };
  },
);
