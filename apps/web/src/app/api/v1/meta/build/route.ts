// GET /api/v1/meta/build
//
// #WAVE23-D1: Self-service Production-Commit-SHA-Diagnose.
//
// #WAVE23.3: Path was `/api/v1/_meta/build` originally — Next.js App
// Router treats folders prefixed with `_` as PRIVATE folders and
// silently excludes them from routing. The route file was built into
// the image but Next.js never registered the path, so every request
// 404'd to the catch-all HTML page. Renamed `_meta` → `meta`.
//
// Public discovery on purpose: der commit-SHA, branch und build-time sind
// in jedem GitHub-Push-Event sichtbar; sie enthüllen keine Geheimnisse.
// Aber: KEIN withAuth-Wrap → der Health-Probe + die D1-Diagnose
// funktionieren auch wenn die Auth-Layer rot ist (z. B. wenn die
// User-Tabelle migrations-drift hat). Anders als `/api/v1/health` der
// die Auth-DB pingt, hat dieser Endpoint NULL DB-Touches — er kann nicht
// 500-en wegen DB-Issues, was D1 verlässlich macht.

import { getRequestId } from "@/lib/api-errors";

// #WAVE23-D1: deliberately NOT wrapped in withErrorHandler. The
// route does no DB call, no auth check, no schema parse — there's
// no failure mode that needs the wrapper's RFC-7807 mapping. Pulling
// in withErrorHandler also pulled in `@/lib/logger` which transitively
// imports `next-auth` for SSR session reading; vitest can't resolve
// that without the full Next.js runtime, breaking the meta-build
// unit test. The route is pure and can't throw.

// Build-time substitutionen via Next.js env-vars. Im Dockerfile gesetzt
// via `ARG GIT_SHA` + `ENV NEXT_PUBLIC_GIT_SHA=$GIT_SHA`. Wenn sie zur
// Laufzeit fehlen (z. B. dev), fallen sie auf "unknown" zurück, damit
// der Endpoint trotzdem 200 liefert statt zu crashen.
const COMMIT_SHA =
  process.env.NEXT_PUBLIC_GIT_SHA ?? process.env.GIT_SHA ?? "unknown";
const GIT_BRANCH =
  process.env.NEXT_PUBLIC_GIT_BRANCH ?? process.env.GIT_BRANCH ?? "unknown";
const BUILT_AT =
  process.env.NEXT_PUBLIC_BUILD_TIME ??
  process.env.BUILD_TIME ??
  // Wenn keine Build-Time injected wurde, nehmen wir den Boot-Time des
  // Node-Prozesses als pessimistische obere Schranke ("spätestens hier
  // hat der Build stattgefunden"). Reicht für Drift-Diagnose aus.
  new Date().toISOString();

const PROCESS_START_MS = Date.now();

export function GET(req: Request) {
  return Response.json({
    data: {
      commitSha: COMMIT_SHA,
      branch: GIT_BRANCH,
      builtAt: BUILT_AT,
      nodeVersion: process.version,
      // Uptime in Sekunden seit Prozess-Boot. Hilft zu unterscheiden
      // zwischen "Container wurde gerade neu gestartet" (Sekunden) vs.
      // "Container läuft seit Tagen, Deploy ist alt" (>86400).
      runtimeUptimeSeconds: Math.floor((Date.now() - PROCESS_START_MS) / 1000),
      requestId: getRequestId(req),
    },
  });
}
