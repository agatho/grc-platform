// Sprint 83: Portal Session Expiry Worker
// Runs every 15 minutes — expires stale portal sessions

import { db, portalSession } from "@grc/db";
import { eq, and, lt, sql } from "drizzle-orm";

export async function processPortalSessionExpiry(): Promise<{
  expiredCount: number;
}> {
  console.log("[portal-session-expiry] Running session expiry check");

  const result = await db
    .update(portalSession)
    .set({ status: "expired" })
    .where(
      and(
        eq(portalSession.status, "active"),
        lt(portalSession.expiresAt, new Date()),
      ),
    )
    .returning({ id: portalSession.id });

  console.log(`[portal-session-expiry] Expired ${result.length} sessions`);
  return { expiredCount: result.length };
}
