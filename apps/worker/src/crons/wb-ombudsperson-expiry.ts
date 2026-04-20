// Sprint 46: Ombudsperson Assignment Expiry (Daily)
// Auto-deactivate expired ombudsperson assignments

import { db, wbOmbudspersonAssignment } from "@grc/db";
import { and, eq, sql } from "drizzle-orm";

interface OmbudspersonExpiryResult {
  processed: number;
  deactivated: number;
}

export async function processWbOmbudspersonExpiry(): Promise<OmbudspersonExpiryResult> {
  console.log(`[cron:wb-ombudsperson-expiry] Starting`);

  const expired = await db
    .update(wbOmbudspersonAssignment)
    .set({ isActive: false, revokedAt: new Date() })
    .where(
      and(
        eq(wbOmbudspersonAssignment.isActive, true),
        sql`${wbOmbudspersonAssignment.expiresAt} <= NOW()`,
      ),
    )
    .returning();

  console.log(
    `[cron:wb-ombudsperson-expiry] Deactivated ${expired.length} assignments`,
  );
  return { processed: expired.length, deactivated: expired.length };
}
