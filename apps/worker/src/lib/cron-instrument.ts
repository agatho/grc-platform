// Cron-instrumentation helper.
//
// Wraps a cron handler so every cron emits a uniform start + finish
// log line (NDJSON on stdout, pickable by Docker's log driver without
// a sidecar) and so a thrown error never escapes the cron registry
// without being recorded.
//
// Why: 121 cron handlers in apps/worker/src/crons/. Pre-Wave-26 they
// each made their own ad-hoc `console.log("[name] doing thing")`
// calls. There was no per-cron duration tracking, no structured
// fields, and any thrown error bubbled to the Hono runner where it
// logged as a generic 500 with no cron context. Operators couldn't
// answer questions like "how long does the FAIR appetite check take
// in p95?" or "which cron failed at 03:42Z last Tuesday?".
//
// Shape — wrap the existing handler:
//
//   import { withCronInstrumentation } from "../lib/cron-instrument";
//   export const processFoo = withCronInstrumentation(
//     "foo-job",
//     async () => {
//       const updated = await db.update(...).returning();
//       return { updated: updated.length };
//     },
//   );
//
// Output:
//   {"ts":"2026-05-22T...","level":"info","service":"arctos-worker",
//    "cron":"foo-job","phase":"start"}
//   {"ts":"...","level":"info","service":"arctos-worker",
//    "cron":"foo-job","phase":"finish","durationMs":312,
//    "result":{"updated":7}}
//
// On error:
//   {"ts":"...","level":"error","service":"arctos-worker",
//    "cron":"foo-job","phase":"error","durationMs":312,
//    "message":"connection lost","errorName":"PgError"}
//   …then the error is re-thrown so the runner's own retry / alert
//   policy still fires.

// CronResult is intentionally permissive: any JSON-serialisable object,
// or nothing. `Record<string, unknown>` was too narrow — concrete
// shapes like `{ deleted: number }` don't extend it (values aren't
// unknown's subtype in writable position), which tripped TS2345 at
// every wrapped call site.
type CronResult = void | object;
// Handler accepts an arbitrary positional-argument tuple A so that crons
// taking optional inputs (e.g. a target date for backfill runs) can be
// wrapped without splitting them into a thin shim. A defaults to []
// — existing zero-arg handlers continue to satisfy the type.
type CronHandler<R extends CronResult, A extends unknown[] = []> = (
  ...args: A
) => Promise<R>;

const SERVICE = process.env.ARCTOS_SERVICE ?? "arctos-worker";

function emit(level: "info" | "error", payload: Record<string, unknown>): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    service: SERVICE,
    ...payload,
  });
  if (level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

/**
 * Wrap a cron handler with start/finish/error logging + duration
 * tracking. The returned function has the same signature as the
 * original; callers (cron registry, manual triggers) don't need to
 * change.
 *
 * @param cronName  short identifier used in the `cron` log field
 *                  (e.g. "academy-overdue-check"). Use kebab-case
 *                  matching the file name for grep-ability.
 * @param handler   the original cron handler. Should return either
 *                  void or a small JSON-serialisable object summarising
 *                  what was done; that object lands in the finish log.
 */
export function withCronInstrumentation<
  R extends CronResult,
  A extends unknown[] = [],
>(cronName: string, handler: CronHandler<R, A>): CronHandler<R, A> {
  return async (...args: A) => {
    const startedAt = Date.now();
    emit("info", { cron: cronName, phase: "start" });
    try {
      const result = await handler(...args);
      const durationMs = Date.now() - startedAt;
      emit("info", {
        cron: cronName,
        phase: "finish",
        durationMs,
        result: result ?? null,
      });
      return result;
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const e = err as Error;
      // Prefer constructor.name over .name: subclasses of Error that
      // don't override .name (a common shorthand pattern) inherit
      // "Error" from Error.prototype.name, hiding the actual class
      // from the logs. constructor.name reliably reports the JS class
      // for the conventional `extends Error` case.
      emit("error", {
        cron: cronName,
        phase: "error",
        durationMs,
        message: e?.message ?? String(err),
        errorName: e?.constructor?.name ?? e?.name ?? "Error",
      });
      throw err;
    }
  };
}
