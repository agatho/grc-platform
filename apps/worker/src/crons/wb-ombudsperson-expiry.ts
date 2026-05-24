// Sprint 46: Ombudsperson Assignment Expiry (Daily)
// Auto-deactivate expired ombudsperson assignments

import { db, wbOmbudspersonAssignment } from "@grc/db";
import { and, eq, sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface OmbudspersonExpiryResult {
  processed: number;
  deactivated: number;
}

export const processWbOmbudspersonExpiry = withCronInstrumentation(
  "wb-ombudsperson-expiry",
  async (): Promise<OmbudspersonExpiryResult> => {
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

    return { processed: expired.length, deactivated: expired.length };
  },
);
