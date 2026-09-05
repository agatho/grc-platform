#!/usr/bin/env node
// [ARCTOS-FULL-2026-08-31 / WP11 · S11-11, S11-02]
//
// Runs the two Postgres-backed vitest projects of @grc/db as part of the
// ordinary `npm test`:
//
//   tests/integration/**  — audit hash chain, tamper evidence, GDPR erasure
//                           (acceptance criteria of WP4 and WP8)
//   tests/rls/**          — cross-tenant isolation and the 534-object RLS
//                           system test (acceptance criterion of WP2)
//
// Before this file both suites were reachable only through
// `npm run test:integration` / `test:rls`, i.e. through a separate CI job.
// The audit's point (S11-11) is that the sharpest negative security tests in
// the repository did not run in the standard test run, so a regression in
// tenant isolation or in the audit chain would not have turned `npm test` red.
//
// Missing database handling — the rule from the remediation plan is "no skip
// without a documented reason":
//
//   * DATABASE_URL / APP_DATABASE_URL set  → both suites run. This is the
//     default in CI and in the dev container.
//   * neither set, ALLOW_SKIP_DB_TESTS=1   → they are skipped, but the skip is
//     printed with its reason and the reason is this env var, set by a human.
//   * neither set, no opt-out              → EXIT 1 with instructions. A
//     laptop without Postgres gets a loud, actionable failure instead of a
//     silently green run that proves nothing.

import { spawnSync } from "node:child_process";

const DB_URL = process.env.DATABASE_URL ?? process.env.APP_DATABASE_URL;

const SUITES = [
  {
    name: "integration (audit chain, tamper evidence, GDPR erasure)",
    config: "vitest.integration.config.ts",
  },
  {
    name: "rls (cross-tenant isolation, RLS system test)",
    config: "vitest.rls.config.ts",
  },
];

if (!DB_URL) {
  if (process.env.ALLOW_SKIP_DB_TESTS === "1") {
    console.warn(
      [
        "",
        "  @grc/db: SKIPPING the Postgres-backed suites.",
        "  Reason: neither DATABASE_URL nor APP_DATABASE_URL is set and",
        "          ALLOW_SKIP_DB_TESTS=1 was set explicitly.",
        "  Not covered by this run:",
        `    - ${SUITES[0].name}`,
        `    - ${SUITES[1].name}`,
        "  These are the acceptance criteria of WP2 (tenant isolation) and",
        "  WP4/WP8 (audit integrity, Art. 17 erasure). A green run without",
        "  them says nothing about either.",
        "",
      ].join("\n"),
    );
    process.exit(0);
  }
  console.error(
    [
      "",
      "  @grc/db: the Postgres-backed test suites cannot run.",
      "",
      "  DATABASE_URL (or APP_DATABASE_URL) is not set, so the cross-tenant",
      "  RLS system test and the audit tamper-evidence tests would not run.",
      "  They are part of `npm test` on purpose (S11-11) — skipping them",
      "  silently is what the audit found and what this runner prevents.",
      "",
      "  Either:",
      "    export DATABASE_URL=postgresql://grc:...@localhost:5432/grc_platform",
      "  or, if you knowingly want a run without them:",
      "    ALLOW_SKIP_DB_TESTS=1 npm test",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

let failed = 0;
for (const suite of SUITES) {
  console.log(`\n=== @grc/db: ${suite.name} ===`);
  const res = spawnSync(
    "npx",
    ["vitest", "run", "--config", suite.config, "--passWithNoTests"],
    { stdio: "inherit", env: process.env },
  );
  if (res.status !== 0) failed++;
}

process.exit(failed > 0 ? 1 : 0);
