// Sprint 43: External Auditor Share Expiry (Daily 01:00)
// Auto-deactivate expired external auditor shares

import { db, externalAuditorShare } from "@grc/db";
import { and, eq, sql } from "drizzle-orm";

interface ShareExpiryResult { processed: number; deactivated: number; }

export async function processExternalShareExpiry(): Promise<ShareExpiryResult> {
  console.log(`[cron:external-share-expiry] Starting`);

  const expired = await db.update(externalAuditorShare)
    .set({ isActive: false, revokedAt: new Date() })
    .where(and(
      eq(externalAuditorShare.isActive, true),
      sql`${externalAuditorShare.expiresAt} <= NOW()`,
    ))
    .returning();

  console.log(`[cron:external-share-expiry] Deactivated ${expired.length} expired shares`);
  return { processed: expired.length, deactivated: expired.length };
}
