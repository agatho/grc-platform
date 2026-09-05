#!/usr/bin/env node
// [ARCTOS-FULL-2026-08-31 / WP11 · S11-11]
//
// Runs the Postgres-backed vitest project of @grc/web as part of `npm test`:
//
//   src/__tests__/rls-route-chain/**  — the real HTTP-route → RLS chain under
//                                       the non-superuser role `grc_app`
//                                       (#SEC-F01b-RUN, WP2 acceptance)
//
// Same contract as packages/db/tests/run-db-suites.mjs: with a database URL
// the suite runs; without one it fails loudly unless a human sets
// ALLOW_SKIP_DB_TESTS=1, in which case the skip is printed together with what
// it leaves uncovered. A silent skip is exactly what S11-02 is about.

import { spawnSync } from "node:child_process";

const DB_URL = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL;

if (!DB_URL) {
  if (process.env.ALLOW_SKIP_DB_TESTS === "1") {
    console.warn(
      [
        "",
        "  @grc/web: SKIPPING the route-chain RLS suite.",
        "  Reason: neither APP_DATABASE_URL nor DATABASE_URL is set and",
        "          ALLOW_SKIP_DB_TESTS=1 was set explicitly.",
        "  Not covered: src/__tests__/rls-route-chain (real route → RLS chain",
        "  under grc_app). This is the WP2 acceptance path over HTTP.",
        "",
      ].join("\n"),
    );
    process.exit(0);
  }
  console.error(
    [
      "",
      "  @grc/web: the route-chain RLS suite cannot run.",
      "",
      "  APP_DATABASE_URL (or DATABASE_URL) is not set. The suite proves that",
      "  a real API route reaches the database as `grc_app` with an org",
      "  context — the one test that would catch a lost RLS context in the",
      "  request path.",
      "",
      "  Either:",
      "    export APP_DATABASE_URL=postgresql://grc_app:...@localhost:5432/grc_platform",
      "  or, if you knowingly want a run without it:",
      "    ALLOW_SKIP_DB_TESTS=1 npm test",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const res = spawnSync(
  "npx",
  ["vitest", "run", "--config", "vitest.rls.config.ts", "--passWithNoTests"],
  { stdio: "inherit", env: process.env },
);
process.exit(res.status ?? 1);
