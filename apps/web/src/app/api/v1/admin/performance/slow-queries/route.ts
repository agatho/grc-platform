import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { withAuth } from "@/lib/api";
import type { SlowQueriesResponse, SlowQueryEntry } from "@grc/shared";

// GET /api/v1/admin/performance/slow-queries — Top-20 slow queries
export async function GET(req: Request) {
  const ctx = await withAuth("admin");
  if (ctx instanceof Response) return ctx;

  const threshold = 100; // ms

  let queries: SlowQueryEntry[] = [];

  try {
    // Query pg_stat_statements if available
    const result = await db.execute(sql`
      SELECT
        LEFT(query, 200) as query,
        ROUND(mean_exec_time::numeric, 2) as avg_duration_ms,
        calls as call_count
      FROM pg_stat_statements
      WHERE mean_exec_time > ${threshold}
        AND query NOT LIKE '%pg_stat_statements%'
      ORDER BY mean_exec_time DESC
      LIMIT 20
    `);

    queries = (result as Record<string, unknown>[]).map(
      (row: Record<string, unknown>) => {
        const queryText = String(row.query ?? "");
        // Extract table names from query
        const tableMatches =
          queryText.match(/(?:FROM|JOIN|UPDATE|INTO)\s+"?(\w+)"?/gi) ?? [];
        const tables = tableMatches.map((m) =>
          m.replace(/(?:FROM|JOIN|UPDATE|INTO)\s+"?/i, "").replace(/"$/, ""),
        );

        return {
          query: queryText,
          avgDurationMs: Number(row.avg_duration_ms ?? 0),
          callCount: Number(row.call_count ?? 0),
          tables,
          indexRecommended: Number(row.avg_duration_ms ?? 0) > 500,
        };
      },
    );
  } catch {
    // pg_stat_statements extension may not be available
    // Return empty list
  }

  const response: SlowQueriesResponse = {
    queries,
    totalSlowQueries: queries.length,
    threshold,
  };

  return Response.json({ data: response });
}
