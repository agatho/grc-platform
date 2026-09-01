#!/usr/bin/env node
// [ARCTOS-FULL-2026-08-31 / WP11 · S11-11, S11-02]
//
// Runner for the worker test suite.
//
// Two jobs:
//
// 1. GUARD. `apps/worker/tests/lib/job-runtime.db.test.ts` proves the three
//    core promises of WP9 — advisory job lock (a job runs once even when two
//    runs start), transactional atomicity, and notification dedup — and is
//    written as `const suite = URL ? describe : describe.skip`. Without a
//    database URL those six tests vanish and the summary still says "passed".
//    WP9 flagged that in its handover ("ein stiller Skip ist S11-02").
//
//      * DATABASE_URL / WORKER_DATABASE_URL set → the suite runs.
//      * neither set, ALLOW_SKIP_DB_TESTS=1     → it skips and this runner
//                                                 prints what is NOT covered.
//      * neither set, no opt-out                → exit 1 with instructions.
//
// 2. ROLE. The worker does not run as `grc_app`. `grc_app` is the *web*
//    runtime role: it has no BYPASSRLS and, correctly, may not insert into
//    `organization`. The worker runs as `grc_worker` (BYPASSRLS, no
//    SUPERUSER — migration 0437 / deploy/provision-grc-app.sh).
//
//    That matters here because a single `APP_DATABASE_URL` cannot serve both:
//    pointed at `grc_app` the worker fixture dies with "new row violates
//    row-level security policy for table organization"; pointed at
//    `grc_worker` every RLS test in `packages/db` and `apps/web` silently
//    passes because BYPASSRLS switches off the very thing they assert.
//    Measured both ways during WP11.
//
//    So the worker takes `WORKER_DATABASE_URL` when it is set and passes it
//    to vitest as `APP_DATABASE_URL` for this process only. One repository
//    wide environment therefore looks like:
//
//      DATABASE_URL=postgresql://grc:…          # migrations, seeds
//      APP_DATABASE_URL=postgresql://grc_app:…  # web + packages/db RLS tests
//      WORKER_DATABASE_URL=postgresql://grc_worker:…
//
//    Without WORKER_DATABASE_URL the behaviour is unchanged.

import { spawnSync } from "node:child_process";

const WORKER_URL = process.env.WORKER_DATABASE_URL;
const DB_URL =
  WORKER_URL ?? process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL;

if (!DB_URL) {
  if (process.env.ALLOW_SKIP_DB_TESTS === "1") {
    console.warn(
      [
        "",
        "  @grc/worker: the Postgres-backed job-runtime suite will SKIP.",
        "  Reason: no DATABASE_URL / WORKER_DATABASE_URL and",
        "          ALLOW_SKIP_DB_TESTS=1 was set explicitly.",
        "  Not covered: tests/lib/job-runtime.db.test.ts — advisory job lock,",
        "  transactional atomicity, notification dedup (WP9 / S10-09, -10, -13).",
        "",
      ].join("\n"),
    );
  } else {
    console.error(
      [
        "",
        "  @grc/worker: the Postgres-backed job-runtime suite cannot run.",
        "",
        "  No database URL is set, so tests/lib/job-runtime.db.test.ts would",
        "  silently skip and the run would still report success — the exact",
        "  pattern S11-02 describes.",
        "",
        "  Either:",
        "    export WORKER_DATABASE_URL=postgresql://grc_worker:...@localhost:5432/grc_platform",
        "  or, if you knowingly want a run without it:",
        "    ALLOW_SKIP_DB_TESTS=1 npm test",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }
}

const env = { ...process.env };
if (WORKER_URL) {
  // Scoped to this process tree only — the repository-wide APP_DATABASE_URL
  // keeps pointing at grc_app for everyone else.
  env.APP_DATABASE_URL = WORKER_URL;
}

const res = spawnSync("npx", ["vitest", "run", "--passWithNoTests"], {
  stdio: "inherit",
  env,
});
process.exit(res.status ?? 1);
