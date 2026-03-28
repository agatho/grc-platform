// Sprint 57: Worker — Check for expiring API keys and revoke expired ones
import { db, apiKey } from "@grc/db";
import { eq, and, lte, sql } from "drizzle-orm";

export async function checkApiKeyExpiry(): Promise<void> {
  const now = new Date();

  // Revoke expired keys
  const expired = await db
    .update(apiKey)
    .set({ status: "expired", updatedAt: now })
    .where(and(
      eq(apiKey.status, "active"),
      lte(apiKey.expiresAt, now),
    ))
    .returning({ id: apiKey.id, orgId: apiKey.orgId, name: apiKey.name });

  if (expired.length > 0) {
    console.log(`[api-key-expiry] Revoked ${expired.length} expired API keys`);
  }

  // Warn about keys expiring in the next 7 days
  const warningDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const expiringSoon = await db
    .select({ id: apiKey.id, orgId: apiKey.orgId, name: apiKey.name, expiresAt: apiKey.expiresAt })
    .from(apiKey)
    .where(and(
      eq(apiKey.status, "active"),
      lte(apiKey.expiresAt, warningDate),
      sql`${apiKey.expiresAt} > ${now}`,
    ));

  if (expiringSoon.length > 0) {
    console.log(`[api-key-expiry] ${expiringSoon.length} API keys expiring within 7 days`);
  }
}
