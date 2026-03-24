import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";

// GET /api/v1/audit-log/integrity-check — Hash chain verification (admin, auditor)
export async function GET() {
  const ctx = await withAuth("admin", "auditor");
  if (ctx instanceof Response) return ctx;

  const [result] = await db.execute<{
    chain_length: number;
    total_entries: number;
    status: string;
  }>(sql`
    WITH RECURSIVE chain AS (
      SELECT id, entry_hash, previous_hash, 1 AS seq
      FROM audit_log
      WHERE previous_hash IS NULL

      UNION ALL

      SELECT a.id, a.entry_hash, a.previous_hash, c.seq + 1
      FROM audit_log a
      JOIN chain c ON a.previous_hash = c.entry_hash
    )
    SELECT
      (SELECT count(*)::int FROM chain) AS chain_length,
      (SELECT count(*)::int FROM audit_log) AS total_entries,
      CASE
        WHEN (SELECT count(*) FROM chain) = (SELECT count(*) FROM audit_log)
        THEN 'integrity_confirmed'
        ELSE 'integrity_violation'
      END AS status
  `);

  return Response.json({
    data: {
      status: result.status,
      chainLength: result.chain_length,
      totalEntries: result.total_entries,
      brokenLinks: result.total_entries - result.chain_length,
      checkedAt: new Date().toISOString(),
    },
  });
}
