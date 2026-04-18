import { db } from "@grc/db";
import { sql } from "drizzle-orm";

// GET /api/v1/health
//
// Liveness + readiness probe for ops tooling (Docker healthcheck,
// external uptime monitors, load balancers). Intentionally unauthenticated
// -- the probe needs to work before any session exists.
//
// Returns:
//   200 + { status: "healthy", ... } when the app can reach its DB
//   503 + { status: "degraded", error: "..." } when the DB is unreachable
//
// No business data is exposed. Payload kept minimal to prevent info leaks
// to unauthenticated callers.
export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  try {
    // Minimal round-trip -- select 1 is ~0.1ms when DB is healthy.
    await db.execute(sql`SELECT 1`);
    const dbLatencyMs = Date.now() - start;
    return Response.json(
      {
        status: "healthy",
        checkedAt: new Date().toISOString(),
        dbLatencyMs,
        service: "arctos-web",
      },
      { status: 200 },
    );
  } catch (err) {
    return Response.json(
      {
        status: "degraded",
        checkedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message.slice(0, 200) : "unknown",
        service: "arctos-web",
      },
      { status: 503 },
    );
  }
}
