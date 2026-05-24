// Sprint 83: Portal Session Expiry Worker
// Runs every 15 minutes — expires stale portal sessions

import { db, portalSession } from "@grc/db";
import { eq, and, lt, sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

export const processPortalSessionExpiry = withCronInstrumentation(
  "portal-session-expiry",
  async (): Promise<{ expiredCount: number }> => {
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

    return { expiredCount: result.length };
  },
);
