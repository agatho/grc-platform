// Cron Job: DD Session Expiry (Hourly)
// Finds DD sessions past their deadline and sets status to 'expired'.

import { db, ddSession } from "@grc/db";
import { and, sql, inArray, eq } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

import { log } from "../lib/logger";
interface DdExpiryResult {
  processed: number;
  expired: number;
}

export const processDdExpiry = withCronInstrumentation(
  "dd-expiry",
  async (): Promise<DdExpiryResult> => {
    const now = new Date();
    let expired = 0;

    // Find sessions that are still active but past their deadline
    const overdueSessions = await db
      .select({
        id: ddSession.id,
        orgId: ddSession.orgId,
        vendorId: ddSession.vendorId,
        status: ddSession.status,
        tokenExpiresAt: ddSession.tokenExpiresAt,
        supplierEmail: ddSession.supplierEmail,
      })
      .from(ddSession)
      .where(
        and(
          inArray(ddSession.status, ["invited", "in_progress"]),
          sql`${ddSession.tokenExpiresAt} < NOW()`,
        ),
      );

    if (overdueSessions.length === 0) {
      log.info("[cron:dd-expiry] No expired DD sessions found");
      return { processed: 0, expired: 0 };
    }

    for (const session of overdueSessions) {
      try {
        await db
          .update(ddSession)
          .set({
            status: "expired",
            updatedAt: now,
          })
          .where(eq(ddSession.id, session.id));

        expired++;

        log.info("[cron:dd-expiry] Expired session", {
          ddSessionId: session.id,
          vendorId: session.vendorId,
          supplierEmail: session.supplierEmail,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error("[cron:dd-expiry] Failed to expire session", {
          ddSessionId: session.id,
          err: message,
        });
      }
    }

    return { processed: overdueSessions.length, expired };
  },
);
