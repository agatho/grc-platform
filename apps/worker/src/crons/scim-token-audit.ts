// Cron Job: SCIM Token Audit
// DAILY — Check for SCIM tokens that haven't been used in 90 days
// and alert admins about potentially unused tokens

import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withCronInstrumentation } from "../lib/cron-instrument";

interface ScimTokenAuditResult {
  staleTokenCount: number;
  error: string | null;
}

export const processScimTokenAudit = withCronInstrumentation(
  "scim-token-audit",
  async (): Promise<ScimTokenAuditResult> => {
    try {
      // Find active tokens that haven't been used in 90 days
      const staleTokens = await db.execute(sql`
        SELECT st.id, st.org_id, st.description, st.last_used_at, st.created_at
        FROM scim_token st
        WHERE st.is_active = true
          AND (st.last_used_at IS NULL OR st.last_used_at < now() - interval '90 days')
          AND st.created_at < now() - interval '7 days'
      `);

      const count = Array.isArray(staleTokens) ? staleTokens.length : 0;
      // In a full implementation, this would create notifications for admins
      // via createNotification() for each org with stale tokens.
      return { staleTokenCount: count, error: null };
    } catch (err) {
      // Keep the in-result `error` field for backwards compatibility
      // (downstream callers may inspect it). The wrapper also logs.
      const message = err instanceof Error ? err.message : "Unknown error";
      return { staleTokenCount: 0, error: message };
    }
  },
);
