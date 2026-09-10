import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { log } from "@/lib/logger";

// GET /api/v1/health
//
// Liveness + readiness probe for ops tooling (Docker healthcheck,
// external uptime monitors, load balancers). Intentionally unauthenticated
// -- the probe needs to work before any session exists.
//
// Returns:
//   200 + { status: "healthy", ... } when the app can reach its DB
//   503 + { status: "degraded", reason: "database_unreachable" } when it is not
//
// No business data is exposed. Payload kept minimal to prevent info leaks
// to unauthenticated callers.
//
// [ARCTOS-FULL-2026-08-31 / Welle 4b-7 · OP-079] Genau diese Zusage stand hier
// über einem `error: err.message.slice(0, 200)`. Der Endpunkt ist
// unauthentifiziert (`middleware.ts`-Allowlist), und die Meldung, die dort
// landete, stammte aus dem Datenbanktreiber: `password authentication failed
// for user "grc_app"`, `connect ECONNREFUSED 127.0.0.1:5432`, `database
// "grc_v4c" does not exist` — Rollenname, Host, Port, Datenbankname, an jeden
// anonymen Aufrufer. Der Schwesterendpunkt `/api/health` macht es seit jeher
// richtig (`catch { dbOk = false; }`) und beweist damit, dass die Meldung für
// den Zweck der Sonde nicht gebraucht wird. Sie steht jetzt im Log, wo der
// Betreiber sie ohnehin sucht; die Antwort trägt nur noch einen stabilen
// Grund, den ein Monitor auswerten kann.
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
    log.error("health probe: database unreachable", {
      error: err instanceof Error ? err.message : String(err),
    });
    return Response.json(
      {
        status: "degraded",
        checkedAt: new Date().toISOString(),
        reason: "database_unreachable",
        service: "arctos-web",
      },
      { status: 503 },
    );
  }
}
