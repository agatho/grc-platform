// Sprint 43: External Auditor Share Expiry (Daily 01:00)
// Auto-deactivate expired external auditor shares

import { db, externalAuditorShare } from "@grc/db";
import { and, eq, sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface ShareExpiryResult {
  processed: number;
  deactivated: number;
}

export const processExternalShareExpiry = withCronInstrumentation(
  "external-share-expiry",
  async (): Promise<ShareExpiryResult> => {
    const expired = await db
      .update(externalAuditorShare)
      .set({ isActive: false, revokedAt: new Date() })
      .where(
        and(
          eq(externalAuditorShare.isActive, true),
          sql`${externalAuditorShare.expiresAt} <= NOW()`,
        ),
      )
      .returning();

    return { processed: expired.length, deactivated: expired.length };
  },
);
