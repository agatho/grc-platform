// job-runtime.ts — shared execution primitives for every worker job.
//
// [ARCTOS-FULL-2026-08-31 / WP9] Answers S10-09, S10-10, S10-11, S10-12,
// S10-13 and S10-14 as INFRASTRUCTURE instead of 128 individual patches.
//
// The audit measured, across the 128 cron files: 0 advisory locks,
// 0 `SELECT … FOR UPDATE SKIP LOCKED`, 3 transactions, 69 non-idempotent
// jobs, 39 fully empty `catch` blocks and 5 broken attempts at setting an
// org context. The one job that got it right — `risk-acceptance-expiry.ts`
// (transaction per org + `SET LOCAL` + guarded UPDATE with RETURNING) —
// is the template this module generalises.
//
// What lives here:
//   withJobLock()      — cluster-wide mutual exclusion via a PostgreSQL
//                        session advisory lock held on ONE reserved
//                        connection (S10-09).
//   withOrgContext()   — a real transaction with a transaction-local
//                        `app.current_org_id`; never touches session state
//                        on a pooled connection (S10-14).
//   claimRow()         — guarded read-then-claim with RETURNING (S10-09).
//   reclaimStaleRows() — lease expiry for rows stuck in a running state
//                        after a crash (S10-09, scenario C).
//   createRunReport()  — error accounting so a job can report a partial
//                        failure honestly instead of counting it away in an
//                        empty catch (S10-11, S10-12).
//
// Design rule for this work package: **no result is better than a made-up
// result**. A job that cannot measure something must fail loudly and
// persist nothing.

import { db, baseClient } from "@grc/db";
import { sql } from "drizzle-orm";
import { emitCronEvent } from "./cron-instrument";

// ──────────────────────────────────────────────────────────────
// Structured error reporting (S10-11)
// ──────────────────────────────────────────────────────────────

export interface JobErrorContext {
  /** Job name, matching the `cron` field of the instrumentation wrapper. */
  job: string;
  /** What the job was doing — "org 3f2…", "document 91a…", "send email". */
  scope?: string;
}

export function describeError(err: unknown): {
  message: string;
  errorName: string;
} {
  const e = err as Error | undefined;
  return {
    message: e?.message ?? String(err),
    errorName: e?.constructor?.name ?? e?.name ?? "Error",
  };
}

/**
 * Record a caught error. Replaces the 39 empty `catch {}` blocks and the 28
 * counter-only ones. The comment those blocks carried ("Wrapper logs
 * structured error") was false: `withCronInstrumentation` only sees errors
 * that ESCAPE the handler, and an in-loop catch is exactly what stops them
 * escaping.
 */
export function reportJobError(ctx: JobErrorContext, err: unknown): void {
  const { message, errorName } = describeError(err);
  emitCronEvent("error", {
    cron: ctx.job,
    phase: "item-error",
    scope: ctx.scope ?? null,
    message,
    errorName,
  });
}

/**
 * Error accounting for a job that processes a set of items and must survive
 * a single bad item without pretending the run succeeded.
 *
 * `toResult()` yields `{ ok, failed, errors }`; `ok === false` makes the
 * HTTP layer answer 207/500 instead of `200 {success:true}` (S10-12), and
 * the error list is emitted as structured log lines, not only as a body
 * field nobody reads.
 */
export interface RunReport {
  fail(scope: string, err: unknown): void;
  readonly failed: number;
  /** Error summaries, capped so a 10k-row failure cannot blow up the body. */
  readonly errors: string[];
  toResult<T extends object>(
    payload: T,
  ): T & {
    ok: boolean;
    failed: number;
    errors: string[];
  };
}

const MAX_REPORTED_ERRORS = 20;

export function createRunReport(job: string): RunReport {
  const errors: string[] = [];
  let failed = 0;
  return {
    fail(scope: string, err: unknown) {
      failed++;
      reportJobError({ job, scope }, err);
      if (errors.length < MAX_REPORTED_ERRORS) {
        // Scope only — the raw driver message can carry table, column and
        // statement fragments (S10-22). The full message went to the
        // structured error log above, which is not returned over HTTP.
        errors.push(`${scope}: ${describeError(err).errorName}`);
      }
    },
    get failed() {
      return failed;
    },
    get errors() {
      return errors.slice();
    },
    toResult(payload) {
      return {
        ...payload,
        ok: failed === 0,
        failed,
        errors: errors.slice(),
      };
    },
  };
}

// ──────────────────────────────────────────────────────────────
// Advisory locking (S10-09)
// ──────────────────────────────────────────────────────────────

export class JobLockBusy extends Error {
  constructor(public readonly lockName: string) {
    super(`job lock busy: ${lockName}`);
    this.name = "JobLockBusy";
  }
}

/**
 * Stable 63-bit key for a job name. `hashtextextended` is built in, stable
 * across versions for a fixed seed, and gives us a bigint for the two-arg
 * advisory-lock API without keeping a lock-id registry in the code.
 */
const LOCK_NAMESPACE = 0x4152_4354; // "ARCT"

/**
 * Run `fn` under a cluster-wide advisory lock. If another process (second
 * worker instance, a retried HTTP call after a gateway timeout, the
 * in-process scheduler racing a manual trigger) already holds it, `fn` does
 * NOT run and the result is `{ skipped: true }`.
 *
 * The lock is a SESSION advisory lock taken on a dedicated reserved
 * connection, because a transaction-level lock would end at the first
 * commit — and these jobs commit many times.
 */
export async function withJobLock<T>(
  lockName: string,
  fn: () => Promise<T>,
): Promise<
  { skipped: true; lockName: string } | { skipped: false; result: T }
> {
  const conn = await baseClient.reserve();
  let held = false;
  try {
    const rows = await conn<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(
        ${LOCK_NAMESPACE}::int,
        (hashtextextended(${lockName}, 0) % 2147483647)::int
      ) AS locked`;
    held = rows[0]?.locked === true;
    if (!held) {
      emitCronEvent("info", {
        cron: lockName,
        phase: "skipped",
        reason: "lock-held-elsewhere",
      });
      return { skipped: true, lockName };
    }
    const result = await fn();
    return { skipped: false, result };
  } finally {
    if (held) {
      try {
        await conn`
          SELECT pg_advisory_unlock(
            ${LOCK_NAMESPACE}::int,
            (hashtextextended(${lockName}, 0) % 2147483647)::int
          )`;
      } catch (err) {
        // Releasing the session ends the lock anyway; still worth seeing.
        reportJobError({ job: lockName, scope: "advisory-unlock" }, err);
      }
    }
    conn.release();
  }
}

// ──────────────────────────────────────────────────────────────
// Org context (S10-14)
// ──────────────────────────────────────────────────────────────

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Run `fn` inside ONE transaction whose `app.current_org_id` is set
 * transaction-locally, so it applies to every statement of `fn` and reverts
 * on commit/rollback.
 *
 * This replaces three broken patterns found by S10-14:
 *   * `set_config(..., false)` on the shared base pool — session-scoped,
 *     lands on an arbitrary pooled connection, and permanently poisons that
 *     connection for later context-less queries;
 *   * `set_config(..., true)` outside a transaction — scoped to the implicit
 *     single-statement transaction, i.e. gone before the query it was meant
 *     for;
 *   * setting the context AFTER the writes it was supposed to scope.
 *
 * It also gives S10-13 for free: the whole per-org unit is atomic, so a job
 * that dies mid-set leaves no half-written org behind.
 */
export async function withOrgContext<T>(
  orgId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.current_org_id', ${orgId}, true)`,
    );
    return fn(tx);
  });
}

/** Same, without an org — a plain atomic unit of work (S10-13). */
export async function withTransaction<T>(
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(fn);
}

// ──────────────────────────────────────────────────────────────
// Queue claiming (S10-09)
// ──────────────────────────────────────────────────────────────

/**
 * Atomically claim one queue row: the UPDATE re-asserts the state the
 * SELECT saw, and RETURNING tells us whether we won. Returns `null` when
 * another worker got there first — the caller must then skip the row.
 *
 * The eight queue processors previously did `SELECT … WHERE status='pending'`
 * followed by an unguarded `UPDATE … SET status='running'`, which two
 * workers both "win".
 */
export async function claimRow(params: {
  table: string;
  id: string;
  statusColumn?: string;
  expectedStatus: string;
  nextStatus: string;
  /**
   * Timestamp columns to set to `now()` on a successful claim. Defaults to
   * `["updated_at"]`; pass e.g. `["started_at", "updated_at"]`. Not every
   * queue table has both — `marketplace_security_scan` has no `updated_at`
   * — so the caller states what exists rather than the helper guessing.
   */
  touchColumns?: string[];
}): Promise<boolean> {
  const statusCol = params.statusColumn ?? "status";
  const touch = params.touchColumns ?? ["updated_at"];
  const assignments = [
    sql`${sql.identifier(statusCol)} = ${params.nextStatus}`,
    ...touch.map((c) => sql`${sql.identifier(c)} = now()`),
  ];
  const rows = await db.execute(sql`
    UPDATE ${sql.identifier(params.table)}
       SET ${sql.join(assignments, sql`, `)}
     WHERE id = ${params.id}::uuid
       AND ${sql.identifier(statusCol)} = ${params.expectedStatus}
     RETURNING id`);
  return (rows as unknown as unknown[]).length > 0;
}

/**
 * Lease expiry: put rows that have been "running" longer than
 * `staleAfterMinutes` back into a retryable state. Without this, a worker
 * that is OOM-killed after claiming a row nails that row to `running`
 * forever and the user can never restart the import (S10-09, scenario C).
 */
export async function reclaimStaleRows(params: {
  table: string;
  statusColumn?: string;
  runningStatus: string;
  resetStatus: string;
  startedAtColumn?: string;
  staleAfterMinutes: number;
}): Promise<number> {
  const statusCol = params.statusColumn ?? "status";
  const startedCol = params.startedAtColumn ?? "started_at";
  const rows = await db.execute(sql`
    UPDATE ${sql.identifier(params.table)}
       SET ${sql.identifier(statusCol)} = ${params.resetStatus},
           updated_at = now()
     WHERE ${sql.identifier(statusCol)} = ${params.runningStatus}
       AND ${sql.identifier(startedCol)} IS NOT NULL
       AND ${sql.identifier(startedCol)} <
           now() - (${params.staleAfterMinutes} || ' minutes')::interval
     RETURNING id`);
  return (rows as unknown as unknown[]).length;
}

// ──────────────────────────────────────────────────────────────
// "Not measured" marker (S14-02, S10-06, S10-15)
// ──────────────────────────────────────────────────────────────

/**
 * Thrown by a job (or route) that was asked to produce evidence it cannot
 * actually produce, because the underlying check is not implemented.
 *
 * The whole point: a GRC platform exists to evidence things. A fabricated
 * "pass" is worse than a missing result, because a missing result is
 * visible to an auditor and a fabricated one is not. Every code path that
 * used to write `status: "pass"` / `passRate: "100.00"` without measuring
 * anything now raises this instead of persisting.
 */
export class NotImplementedEvidenceError extends Error {
  constructor(
    public readonly capability: string,
    detail?: string,
  ) {
    super(
      `No evidence produced: "${capability}" is not implemented in this build. ` +
        `Refusing to persist an unmeasured result.` +
        (detail ? ` ${detail}` : ""),
    );
    this.name = "NotImplementedEvidenceError";
  }
}
