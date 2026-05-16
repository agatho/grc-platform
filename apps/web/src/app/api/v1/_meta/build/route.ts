// GET /api/v1/_meta/build
//
// #WAVE23-D1: Self-service Production-Commit-SHA-Diagnose. Wave 22 hat
// festgestellt, dass A1+A2 Repo-Code-korrekt sind aber Production-Behavior
// falsch ist — Deploy-/Migration-Drift, kein Code-Bug. Die Wave-23-Diagnose
// (D1 im claude-code-wave23-prompt.md) braucht den prod-Commit-SHA, um
// gegen `git rev-parse origin/main` zu vergleichen. Bisher war das eine
// SSH-only Operation; dieser Endpoint macht es zum `curl` für jeden,
// der einen authentifizierten Session-Cookie hat.
//
// Public discovery on purpose: der commit-SHA, branch und build-time sind
// in jedem GitHub-Push-Event sichtbar; sie enthüllen keine Geheimnisse.
// Aber: KEIN withAuth-Wrap → der Health-Probe + die D1-Diagnose
// funktionieren auch wenn die Auth-Layer rot ist (z. B. wenn die
// User-Tabelle migrations-drift hat). Anders als `/api/v1/health` der
// die Auth-DB pingt, hat dieser Endpoint NULL DB-Touches — er kann nicht
// 500-en wegen DB-Issues, was D1 verlässlich macht.

import { getRequestId } from "@/lib/api-errors";
import { withErrorHandler } from "@/lib/api-wrapper";

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

export const GET = withErrorHandler(async function GET(req: Request) {
  return Response.json({
    data: {
      commitSha: COMMIT_SHA,
      branch: GIT_BRANCH,
      builtAt: BUILT_AT,
      nodeVersion: process.version,
      // Uptime in Sekunden seit Prozess-Boot. Hilft zu unterscheiden
      // zwischen "Container wurde gerade neu gestartet" (Sekunden) vs.
      // "Container läuft seit Tagen, Deploy ist alt" (>86400).
      runtimeUptimeSeconds: Math.floor(
        (Date.now() - PROCESS_START_MS) / 1000,
      ),
      requestId: getRequestId(req),
    },
  });
});
