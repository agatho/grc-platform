// scheduler.ts — the scheduler the platform did not have.
//
// [ARCTOS-FULL-2026-08-31 / WP9 · S10-02, S13-14, S03-10]
//
// Finding S10-02: for the 128 cron jobs there was no scheduler anywhere —
// not in `docker-compose.production.yml`, not in `deploy/`, not in the
// runbook. A repository-wide search for `setInterval`, `node-cron`,
// `croner` or `cron.schedule` inside `apps/worker` and `packages` returned
// zero hits. Every deadline-driven obligation of a GRC platform (GDPR
// Art. 33, Art. 12, HinSchG §17, NIS2, DORA, AI Act, Art. 17 deletion,
// ADR-011 anchoring) was therefore never evaluated in production.
//
// Why in-process rather than an `ofelia`/`supercronic` sidecar: the jobs
// already live in this process, an HTTP hop would add a second failure mode
// (and a shared secret in a second place), and — decisive — the audit's
// scenario B for S10-09 was exactly "an external caller times out and
// retries, both runs process the same rows". A scheduler that calls the
// handler directly, under an advisory lock, has no timeout to retry after.
// The HTTP endpoints stay in place so an external scheduler remains
// possible; both paths take the same lock, so the two can coexist.
//
// Cron dialect: standard five fields (minute hour day-of-month month
// day-of-week), with `*`, `a`, `a-b`, `a,b`, `*/n` and `a-b/n`. Both 0 and
// 7 mean Sunday. No seconds field, no `@daily` aliases, no timezone —
// everything is UTC, deliberately, so a DST shift cannot move a statutory
// deadline check.

import { db, jobRun } from "@grc/db";
import { eq } from "drizzle-orm";
import { hostname } from "os";
import { emitCronEvent } from "./cron-instrument";
import { withJobLock, describeError } from "./job-runtime";

export interface JobDefinition {
  /** kebab-case, matches the cron file name and the HTTP path. */
  name: string;
  /** Five-field UTC cron expression. */
  schedule: string;
  run: (...args: never[]) => Promise<unknown>;
}

// ──────────────────────────────────────────────────────────────
// Cron expression parsing
// ──────────────────────────────────────────────────────────────

const FIELD_RANGES: Array<[number, number]> = [
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // day of month
  [1, 12], // month
  [0, 7], // day of week (0 and 7 = Sunday)
];

function parseField(spec: string, min: number, max: number): Set<number> {
  const values = new Set<number>();
  for (const part of spec.split(",")) {
    const [rangePart, stepPart] = part.split("/");
    const step = stepPart === undefined ? 1 : Number(stepPart);
    if (!Number.isInteger(step) || step < 1) {
      throw new Error(`invalid step "${stepPart}" in cron field "${spec}"`);
    }
    let lo: number;
    let hi: number;
    if (rangePart === "*" || rangePart === "") {
      lo = min;
      hi = max;
    } else if (rangePart.includes("-")) {
      const [a, b] = rangePart.split("-");
      lo = Number(a);
      hi = Number(b);
    } else {
      lo = Number(rangePart);
      hi = stepPart === undefined ? lo : max;
    }
    if (
      !Number.isInteger(lo) ||
      !Number.isInteger(hi) ||
      lo < min ||
      hi > max ||
      lo > hi
    ) {
      throw new Error(`invalid range "${rangePart}" in cron field "${spec}"`);
    }
    for (let v = lo; v <= hi; v += step) values.add(v);
  }
  return values;
}

export interface ParsedSchedule {
  fields: Array<Set<number>>;
  source: string;
}

export function parseCron(expression: string): ParsedSchedule {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(
      `cron expression must have 5 fields, got ${parts.length}: "${expression}"`,
    );
  }
  const fields = parts.map((p, i) =>
    parseField(p, FIELD_RANGES[i][0], FIELD_RANGES[i][1]),
  );
  // Normalise Sunday so both spellings match.
  if (fields[4].has(7)) fields[4].add(0);
  return { fields, source: expression };
}

/** True when `date` (UTC) falls in the minute the expression selects. */
export function cronMatches(parsed: ParsedSchedule, date: Date): boolean {
  const [min, hour, dom, month, dow] = parsed.fields;
  if (!min.has(date.getUTCMinutes())) return false;
  if (!hour.has(date.getUTCHours())) return false;
  if (!month.has(date.getUTCMonth() + 1)) return false;

  // Vixie-cron semantics: when BOTH day-of-month and day-of-week are
  // restricted, the job runs when EITHER matches. When only one is
  // restricted, only that one counts.
  const domRestricted = dom.size !== 31;
  const dowRestricted = dow.size !== 8;
  const domHit = dom.has(date.getUTCDate());
  const dowHit = dow.has(date.getUTCDay());
  if (domRestricted && dowRestricted) return domHit || dowHit;
  if (domRestricted) return domHit;
  if (dowRestricted) return dowHit;
  return true;
}

/**
 * First minute strictly after `from` at which the expression matches.
 *
 * [S10-06] Used by `connector-schedule-runner` to advance
 * `connector_schedule.next_run_at`. That column was never written by any
 * code path, so a schedule that became due once stayed due forever and the
 * job re-ran it every 15 minutes without end.
 *
 * Search horizon: 366 days. `null` means the expression can never match
 * again (e.g. 30 February), which the caller must treat as a configuration
 * error rather than as "run immediately".
 */
export function nextRunAfter(parsed: ParsedSchedule, from: Date): Date | null {
  const cursor = new Date(from.getTime());
  cursor.setUTCSeconds(0, 0);
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  const limit = 366 * 24 * 60;
  for (let i = 0; i < limit; i++) {
    if (cronMatches(parsed, cursor)) return new Date(cursor.getTime());
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }
  return null;
}

/**
 * Last minute at or before `from` at which the expression matched.
 *
 * [OP-100 · Welle 5c] Das Gegenstück zu {@link nextRunAfter} und die
 * Grundlage des Nachholabgleichs: „wann hätte dieser Job zuletzt laufen
 * sollen?" ist die Frage, gegen die `job_run` verglichen wird.
 *
 * „At or before", nicht „strictly before": fällt `from` selbst auf eine
 * Trefferminute, ist das der letzte Solltermin. Sonst würde ein Neustart
 * exakt in der Minute eines Jobs dessen eigenen Termin überspringen und
 * den davor melden.
 *
 * Suchhorizont: 366 Tage. `null` heisst, dass der Ausdruck im letzten Jahr
 * nie zutraf — für einen Nachholabgleich bedeutet das „nichts versäumt",
 * nicht „sofort laufen".
 */
export function previousRunAtOrBefore(
  parsed: ParsedSchedule,
  from: Date,
): Date | null {
  const cursor = new Date(from.getTime());
  cursor.setUTCSeconds(0, 0);
  const limit = 366 * 24 * 60;
  for (let i = 0; i < limit; i++) {
    if (cronMatches(parsed, cursor)) return new Date(cursor.getTime());
    cursor.setUTCMinutes(cursor.getUTCMinutes() - 1);
  }
  return null;
}

// ──────────────────────────────────────────────────────────────
// Run accounting (S10-12)
// ──────────────────────────────────────────────────────────────

export type RunStatus = "success" | "partial" | "failed" | "skipped_locked";

function classify(result: unknown): { status: RunStatus; failedItems: number } {
  if (result && typeof result === "object") {
    const r = result as { ok?: boolean; failed?: number; errors?: unknown[] };
    const failed =
      typeof r.failed === "number"
        ? r.failed
        : Array.isArray(r.errors)
          ? r.errors.length
          : 0;
    if (r.ok === false || failed > 0) {
      return { status: "partial", failedItems: failed };
    }
  }
  return { status: "success", failedItems: 0 };
}

/** Trim a job result so a 10k-row payload cannot bloat the run log. */
function compactResult(result: unknown): unknown {
  if (!result || typeof result !== "object") return result ?? null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(result as Record<string, unknown>)) {
    if (Array.isArray(v)) out[k] = v.slice(0, 10);
    else if (v && typeof v === "object") continue;
    else out[k] = v;
  }
  return out;
}

export interface JobRunOutcome {
  job: string;
  status: RunStatus;
  durationMs: number;
  failedItems: number;
  result: unknown;
  error?: string;
}

/**
 * Execute one job: take the advisory lock, run it, record the outcome in
 * `job_run`, and return a machine-readable verdict. Used by BOTH the
 * scheduler and the HTTP endpoints, so a manual trigger can never race the
 * scheduled run.
 */
export async function runJob(
  job: JobDefinition,
  triggerSource: "scheduler" | "http" | "manual" | "catchup" = "scheduler",
): Promise<JobRunOutcome> {
  const startedAt = Date.now();
  let runId: string | null = null;
  try {
    const [row] = await db
      .insert(jobRun)
      .values({
        jobName: job.name,
        triggerSource,
        host: hostname().slice(0, 120),
      })
      .returning({ id: jobRun.id });
    runId = row?.id ?? null;
  } catch (err) {
    // The run log must never be the reason a statutory deadline job does
    // not run. Log and continue without a row.
    emitCronEvent("error", {
      cron: job.name,
      phase: "run-log-insert-failed",
      ...describeError(err),
    });
  }

  const finish = async (outcome: JobRunOutcome): Promise<JobRunOutcome> => {
    if (runId) {
      try {
        await db
          .update(jobRun)
          .set({
            finishedAt: new Date(),
            durationMs: outcome.durationMs,
            status: outcome.status,
            failedItems: outcome.failedItems,
            result: compactResult(outcome.result) as object,
            error: outcome.error ?? null,
          })
          .where(eq(jobRun.id, runId));
      } catch (err) {
        emitCronEvent("error", {
          cron: job.name,
          phase: "run-log-update-failed",
          ...describeError(err),
        });
      }
    }
    return outcome;
  };

  try {
    const locked = await withJobLock(`cron:${job.name}`, () =>
      (job.run as () => Promise<unknown>)(),
    );
    const durationMs = Date.now() - startedAt;
    if (locked.skipped) {
      return finish({
        job: job.name,
        status: "skipped_locked",
        durationMs,
        failedItems: 0,
        result: null,
      });
    }
    const { status, failedItems } = classify(locked.result);
    return finish({
      job: job.name,
      status,
      durationMs,
      failedItems,
      result: locked.result,
    });
  } catch (err) {
    const { message } = describeError(err);
    return finish({
      job: job.name,
      status: "failed",
      durationMs: Date.now() - startedAt,
      failedItems: 0,
      result: null,
      error: message,
    });
  }
}

// ──────────────────────────────────────────────────────────────
// The scheduler loop
// ──────────────────────────────────────────────────────────────

export interface SchedulerHandle {
  stop(): void;
  /** Jobs the scheduler owns, for the status endpoint. */
  readonly jobs: Array<{ name: string; schedule: string }>;
}

/**
 * Start the scheduler. Ticks once per wall-clock minute (aligned to :00 of
 * the minute) and fires every job whose expression matches that minute.
 *
 * Jobs run concurrently with each other but never with themselves: `runJob`
 * takes a per-job advisory lock, which also covers a second worker
 * container and a rolling deploy overlap.
 */
export function startScheduler(
  jobs: JobDefinition[],
  opts: { enabled?: boolean } = {},
): SchedulerHandle | null {
  const enabled =
    opts.enabled ?? (process.env.CRON_SCHEDULER_ENABLED ?? "true") === "true";
  if (!enabled) {
    emitCronEvent("info", {
      cron: "scheduler",
      phase: "disabled",
      reason: "CRON_SCHEDULER_ENABLED != true",
    });
    return null;
  }

  const compiled = jobs.map((job) => {
    try {
      return { job, parsed: parseCron(job.schedule) };
    } catch (err) {
      // A malformed expression must not silently drop a job — fail the boot.
      throw new Error(
        `job "${job.name}" has an invalid schedule "${job.schedule}": ${describeError(err).message}`,
      );
    }
  });

  emitCronEvent("info", {
    cron: "scheduler",
    phase: "start",
    jobs: compiled.length,
  });

  let timer: NodeJS.Timeout | undefined;
  let stopped = false;
  let lastMinute = "";

  const tick = () => {
    if (stopped) return;
    const now = new Date();
    const minuteKey = now.toISOString().slice(0, 16);
    if (minuteKey === lastMinute) return;
    lastMinute = minuteKey;
    for (const { job, parsed } of compiled) {
      if (!cronMatches(parsed, now)) continue;
      void runJob(job, "scheduler").then((outcome) => {
        if (outcome.status === "failed" || outcome.status === "partial") {
          emitCronEvent("error", {
            cron: job.name,
            phase: "run",
            status: outcome.status,
            failedItems: outcome.failedItems,
            message: outcome.error ?? "job reported item failures",
          });
        }
      });
    }
  };

  // Align to the start of the next minute, then run every 30s. The 30s
  // interval with a minute-key guard keeps the tick robust against event
  // loop lag without ever double-firing inside one minute.
  const msToNextMinute = 60_000 - (Date.now() % 60_000);
  const startTimer = setTimeout(() => {
    tick();
    timer = setInterval(tick, 30_000);
    if (typeof timer.unref === "function") timer.unref();
  }, msToNextMinute);
  if (typeof startTimer.unref === "function") startTimer.unref();

  return {
    stop() {
      stopped = true;
      clearTimeout(startTimer);
      if (timer) clearInterval(timer);
    },
    jobs: compiled.map(({ job }) => ({
      name: job.name,
      schedule: job.schedule,
    })),
  };
}
