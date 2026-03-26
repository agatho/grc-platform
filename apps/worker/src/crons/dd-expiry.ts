// Cron Job: DD Session Expiry (Hourly)
// Finds DD sessions past their deadline and sets status to 'expired'.

import { db, ddSession } from "@grc/db";
import { and, sql, inArray, eq } from "drizzle-orm";

interface DdExpiryResult {
  processed: number;
  expired: number;
}

export async function processDdExpiry(): Promise<DdExpiryResult> {
  const now = new Date();
  let expired = 0;

  console.log(`[cron:dd-expiry] Starting at ${now.toISOString()}`);

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
    console.log("[cron:dd-expiry] No expired DD sessions found");
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

      console.log(
        `[cron:dd-expiry] Expired session ${session.id} (vendor: ${session.vendorId}, email: ${session.supplierEmail})`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[cron:dd-expiry] Failed to expire session ${session.id}:`,
        message,
      );
    }
  }

  console.log(
    `[cron:dd-expiry] Processed ${overdueSessions.length} sessions, ${expired} expired`,
  );

  return { processed: overdueSessions.length, expired };
}
