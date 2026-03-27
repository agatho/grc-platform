// Cron Job: SCIM Token Audit
// DAILY — Check for SCIM tokens that haven't been used in 90 days
// and alert admins about potentially unused tokens

import { db } from "@grc/db";
import { sql } from "drizzle-orm";

interface ScimTokenAuditResult {
  staleTokenCount: number;
  error: string | null;
}

export async function processScimTokenAudit(): Promise<ScimTokenAuditResult> {
  const now = new Date();
  console.log(`[cron:scim-token-audit] Starting at ${now.toISOString()}`);

  try {
    // Find active tokens that haven't been used in 90 days
    const staleTokens = await db.execute(sql`
      SELECT st.id, st.org_id, st.description, st.last_used_at, st.created_at
      FROM scim_token st
      WHERE st.is_active = true
        AND (st.last_used_at IS NULL OR st.last_used_at < now() - interval '90 days')
        AND st.created_at < now() - interval '7 days'
    `);

    const count = (staleTokens as any[]).length;

    if (count > 0) {
      console.log(`[cron:scim-token-audit] Found ${count} stale SCIM tokens`);
      // In a full implementation, this would create notifications for admins
      // via createNotification() for each org with stale tokens
    }

    return { staleTokenCount: count, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[cron:scim-token-audit] Error: ${message}`);
    return { staleTokenCount: 0, error: message };
  }
}
