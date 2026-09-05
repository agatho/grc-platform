// ARCTOS worker — scheduler + HTTP control surface.
//
// [ARCTOS-FULL-2026-08-31 / WP9] This file used to be 1.589 lines of which
// roughly 1.350 were 96 copies of the same nine-line endpoint block:
//
//     app.post("/crons/x", async (c) => {
//       try { return c.json({ success: true, ...(await processX()) }); }
//       catch (err) { … return c.json({ success: false, error: msg }, 500); }
//     });
//
// Four audit findings lived in that shape:
//   S10-02  nothing ever CALLED these endpoints — there was no scheduler,
//           and the `X-Cron-Secret` header they demand appeared nowhere else
//           in the repository. All 128 jobs were dead code in production.
//   S10-12  a run in which every organisation failed still answered
//           HTTP 200 `{"success":true,"errors":[…48 entries…]}`, so any
//           monitor pinging the status code saw green.
//   S10-20  `/health`, `/automation/health` and `/events/auth` sat outside
//           the CRON_SECRET middleware.
//   S10-22  the driver's error message — table, column, constraint and
//           statement fragments — went straight into the response body.
//
// The endpoints are now generated from `lib/job-registry.ts`, which is also
// what the scheduler reads, so "registered as an endpoint" and "actually
// scheduled" cannot drift apart again.

import { Hono } from "hono";
import type { Context } from "hono";
import { serve } from "@hono/node-server";
import { timingSafeEqual, randomUUID } from "crypto";
import { db } from "@grc/db";
import { sql } from "drizzle-orm";
import { registerWebhookEnqueueHandler } from "@grc/events";
import {
  initAutomationEngine,
  getAutomationEngine,
} from "./crons/automation-engine-init";
import { registerModuleCrons } from "./lib/module-aware-cron";
import {
  JOB_REGISTRY,
  JOB_PATH_ALIASES,
  findJob,
  reconcileMissedRuns,
} from "./lib/job-registry";
import { runJob, startScheduler, type JobRunOutcome } from "./lib/scheduler";
import { processDailyAuditAnchor } from "./crons/daily-audit-anchor";
import { assertWorkerDbRole } from "./lib/db-role-guard";
import { emitCronEvent } from "./lib/cron-instrument";

import { log } from "./lib/logger";
const app = new Hono();

// ──────────────────────────────────────────────────────────────
// Startup
// ──────────────────────────────────────────────────────────────

// [S01-09, handed over by WP2] Refuse to run as a database SUPERUSER.
void assertWorkerDbRole();

const moduleCrons = registerModuleCrons();

// Sprint 28: Automation Engine (subscribes to the Event Bus).
initAutomationEngine();

// Webhook fan-out: route entity events emitted in THIS process to the
// webhook_delivery_log outbox.
registerWebhookEnqueueHandler();

// [S10-02] The scheduler. Everything above this line existed before; this
// line is what makes the 131 registered jobs actually run.
//
// [Welle 5c] Die Zahl stand seit WP9 auf „129" — hier, in
// `crons/job-run-retention.ts` und in `tests/lib/job-registry.test.ts`.
// `JOB_REGISTRY.length` ist 131 (gemessen 2026-09-05); der Test hält sie
// ab jetzt fest, statt sie in drei Kommentaren zu wiederholen.
const scheduler = startScheduler(JOB_REGISTRY);

// [OP-100 · Welle 5c] Nachholabgleich gegen `job_run`: ein Job, dessen
// Solltermin in ein Neustartfenster fiel, läuft heute gar nicht und
// hinterlässt keine Spur. Nur wenn der Scheduler wirklich läuft — bei
// `CRON_SCHEDULER_ENABLED != true` ist auch das Nachholen abgeschaltet.
// Bewusst nicht awaited: der Worker muss seinen Port binden, während die
// nachgeholten Läufe im Hintergrund abarbeiten.
if (scheduler) {
  void reconcileMissedRuns(JOB_REGISTRY).catch((err: unknown) => {
    emitCronEvent("error", {
      cron: "scheduler",
      phase: "catchup-failed",
      message: err instanceof Error ? err.message : String(err),
    });
  });
}

// ──────────────────────────────────────────────────────────────
// Authentication for every non-public surface
// ──────────────────────────────────────────────────────────────
//
// [S10-20] The middleware itself was well built — constant-time compare,
// fail-closed when CRON_SECRET is unset, no fallback default — it simply
// did not cover `/events/auth` and `/automation/health`. It now covers
// every path except `/health`, which a container healthcheck must be able
// to call without a secret.

for (const prefix of ["/crons/*", "/events/*", "/automation/*"]) {
  app.use(prefix, async (c, next) => {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
      return c.json({ error: "CRON_SECRET not configured on server" }, 500);
    }
    const provided = c.req.header("X-Cron-Secret") ?? "";
    const secretBuf = Buffer.from(provided);
    const expectedBuf = Buffer.from(expected);
    // Length is compared first because timingSafeEqual throws on a length
    // mismatch. That leaks the secret's length; for a 32-char hex value
    // this is not a meaningful disclosure and is recorded in WP9.md as a
    // deliberate non-change.
    if (
      secretBuf.length !== expectedBuf.length ||
      !timingSafeEqual(secretBuf, expectedBuf)
    ) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  });
}

// ──────────────────────────────────────────────────────────────
// Health
// ──────────────────────────────────────────────────────────────
//
// [S10-21] The old handler returned a constant. A worker whose connection
// pool was exhausted or dead answered "ok" forever, and because neither
// `web` nor `worker` had a compose healthcheck, `restart: unless-stopped`
// only ever reacted to a process exit, never to a hung process.

app.get("/health", async (c) => {
  const startedAt = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
  } catch (err) {
    emitCronEvent("error", {
      cron: "health",
      phase: "db-probe-failed",
      message: err instanceof Error ? err.message : String(err),
    });
    return c.json(
      {
        status: "degraded",
        service: "worker",
        database: "unreachable",
        timestamp: new Date().toISOString(),
      },
      503,
    );
  }
  return c.json({
    status: "ok",
    service: "worker",
    database: "ok",
    dbLatencyMs: Date.now() - startedAt,
    scheduler: scheduler ? "running" : "disabled",
    scheduledJobs: scheduler?.jobs.length ?? 0,
    timestamp: new Date().toISOString(),
  });
});

// ──────────────────────────────────────────────────────────────
// Scheduler introspection
// ──────────────────────────────────────────────────────────────

app.get("/crons", (c) =>
  c.json({
    scheduler: scheduler ? "running" : "disabled",
    jobs: JOB_REGISTRY.map((j) => ({ name: j.name, schedule: j.schedule })),
    aliases: JOB_PATH_ALIASES,
    moduleJobs: Object.keys(moduleCrons),
  }),
);

// ──────────────────────────────────────────────────────────────
// Auth.js event ingestion
// ──────────────────────────────────────────────────────────────
//
// [S10-20] This endpoint accepted arbitrary JSON, did nothing but
// `console.log`, and threw a Hono 500 on a non-JSON body. It is now behind
// the shared secret, validates its input, and no longer logs
// attacker-controlled content verbatim.

app.post("/events/auth", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    type?: unknown;
  } | null;
  if (!body || typeof body !== "object") {
    return problem(
      c,
      400,
      "validation",
      "Invalid body",
      "Expected a JSON object body.",
    );
  }
  const eventType =
    typeof body.type === "string" ? body.type.slice(0, 64) : "unknown";
  emitCronEvent("info", { cron: "events-auth", phase: "received", eventType });
  return c.json({ received: true, event: eventType });
});

// ──────────────────────────────────────────────────────────────
// Automation engine health
// ──────────────────────────────────────────────────────────────

app.get("/automation/health", (c) => {
  const engine = getAutomationEngine();
  return c.json({
    status: engine ? "ok" : "not_initialized",
    service: "automation-engine",
    timestamp: new Date().toISOString(),
  });
});

// ──────────────────────────────────────────────────────────────
// Cron endpoints — one generated handler for the whole registry
// ──────────────────────────────────────────────────────────────
//
// [S10-12] The status code now carries the verdict:
//   200 everything succeeded
//   207 the run completed but some items failed (partial)
//   409 another process holds this job's advisory lock (S10-09)
//   500 the job threw
//
// [S10-22] The body carries the job name, the verdict and a request id.
// The driver message goes to the structured error log and to
// `job_run.error`, not to the caller.

function asObject(result: unknown): Record<string, unknown> {
  return result && typeof result === "object"
    ? (result as Record<string, unknown>)
    : {};
}

/**
 * [S10-25] ADR-021 requires `application/problem+json` (RFC 7807) with a
 * `requestId`. The audit found the helper used in 5 of 1.357 web routes and
 * the worker not knowing the format at all — it answered `{success, error}`
 * as plain JSON, with the driver message in `error`. Error responses now
 * carry the ADR shape; the 2xx bodies keep `success` plus the job result,
 * because that is what an operator's curl and the run log read.
 */
function problem(
  c: Context,
  status: 400 | 404 | 409 | 500 | 503,
  slug: string,
  title: string,
  detail: string,
  extra: Record<string, unknown> = {},
): Response {
  return c.json(
    {
      type: `https://arctos.charliehund.de/errors/${slug}`,
      title,
      status,
      detail,
      instance: new URL(c.req.url).pathname,
      requestId: randomUUID(),
      ...extra,
    },
    status,
    { "Content-Type": "application/problem+json; charset=utf-8" },
  );
}

function respond(c: Context, outcome: JobRunOutcome): Response {
  const base = {
    job: outcome.job,
    status: outcome.status,
    durationMs: outcome.durationMs,
    requestId: randomUUID(),
  };
  switch (outcome.status) {
    case "success":
      return c.json({ success: true, ...base, ...asObject(outcome.result) });
    case "partial":
      // 207: the run completed and some items failed. Still a body with the
      // counters, because a partial run is useful information, not an error
      // page.
      return c.json(
        {
          success: false,
          ...base,
          failedItems: outcome.failedItems,
          ...asObject(outcome.result),
        },
        207,
      );
    case "skipped_locked":
      return problem(
        c,
        409,
        "job-locked",
        "Job already running",
        "Another run of this job holds its advisory lock. Nothing was done.",
        { job: outcome.job },
      );
    default:
      // The driver message is in the structured error log and in
      // job_run.error — deliberately not echoed to the caller (S10-22).
      return problem(
        c,
        500,
        "job-failed",
        "Cron job failed",
        "The job threw. See the worker log and job_run for the cause.",
        { job: outcome.job, durationMs: outcome.durationMs },
      );
  }
}

app.post("/crons/modules/:name", async (c) => {
  const name = c.req.param("name");
  const handler = moduleCrons[name];
  if (!handler) {
    return problem(
      c,
      404,
      "unknown-job",
      "Unknown module background process",
      `No module background process named "${name}" is registered.`,
    );
  }
  const outcome = await runJob(
    { name: `modules/${name}`, schedule: "manual", run: handler },
    "http",
  );
  return respond(c, outcome);
});

app.post("/crons/daily-audit-anchor", async (c) => {
  // The only job that takes an input: an operator can back-fill one day.
  // `{"date":"2026-04-15"}` anchors the 15th — WP4 removed the off-by-one
  // that used to anchor the 14th (S03-10).
  const body = (await c.req.json().catch(() => ({}))) as { date?: string };
  const target = body?.date ? new Date(`${body.date}T12:00:00Z`) : undefined;
  if (body?.date && Number.isNaN(target?.getTime())) {
    return problem(
      c,
      400,
      "validation",
      "Invalid date",
      "Expected an ISO date of the form YYYY-MM-DD.",
    );
  }
  const outcome = await runJob(
    {
      name: "daily-audit-anchor",
      schedule: "5 0 * * *",
      run: () => processDailyAuditAnchor(target),
    },
    "http",
  );
  return respond(c, outcome);
});

// [WP4 handover · S03-12] The chain verification answers 503 when the audit
// trail is not verifiably intact, so a monitor treats "chain broken" as an
// outage rather than as a 200 with a field nobody reads. WP4 asked for this
// endpoint explicitly; the job file itself belongs to WP4 and is unchanged.
app.post("/crons/audit-chain-verify", async (c) => {
  const job = findJob("audit-chain-verify");
  if (!job) {
    return problem(
      c,
      404,
      "unknown-job",
      "Unknown job",
      "audit-chain-verify is not registered.",
    );
  }
  const outcome = await runJob(job, "http");
  const result = asObject(outcome.result);
  if (outcome.status === "success" && result.healthy === false) {
    return c.json(
      { success: false, job: job.name, status: "unhealthy", ...result },
      503,
    );
  }
  return respond(c, outcome);
});

app.post("/crons/:job", async (c) => {
  const requested = c.req.param("job");
  const job = findJob(requested);
  if (!job) {
    return problem(
      c,
      404,
      "unknown-job",
      "Unknown job",
      `No job named "${requested}" is registered. GET /crons lists them.`,
    );
  }
  return respond(c, await runJob(job, "http"));
});

// ──────────────────────────────────────────────────────────────
// Server
// ──────────────────────────────────────────────────────────────

// Bind the Hono app to a Node.js HTTP server. The earlier default-export
// form (`{ port, fetch }`) is Bun-specific — under tsx/Node it is silently
// ignored, the script reaches the end of execution, and the container exits
// clean (then crash-loops via the restart policy).
const port = Number(process.env.PORT ?? 3001);

// WORKER_NO_LISTEN lets a test import the app (and the registry) without
// binding a port or starting the scheduler's socket.
if (process.env.WORKER_NO_LISTEN !== "true") {
  serve({ fetch: app.fetch, port }, (info) => {
    log.info("[worker] listening", {
      port: info.port,
      jobs: JOB_REGISTRY.length,
      scheduler: scheduler ? "running" : "disabled",
    });
  });
}

export { app, scheduler };

// Keep the Bun-style default export for compatibility with Bun-based
// runners (tests, local dev) — a no-op when imported under Node.
export default { port, fetch: app.fetch };
