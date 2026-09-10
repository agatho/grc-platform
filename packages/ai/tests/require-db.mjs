#!/usr/bin/env node
// [ARCTOS-FULL-2026-08-31 / WP11 · S11-11, S11-02]
//
// Guard in front of `vitest run` for @grc/ai.
//
// `tests/regression-s05-20-21.test.ts` guards its database half with
// `const describeDb = DB_URL ? describe : describe.skip` — three tests that
// prove the pgvector pre-filter cannot return another tenant's embeddings
// (S05-20/-21, the positive findings WP6 had to keep). Without a database URL
// they disappear and the run still reports success.
//
// Same contract as the other packages: run it, or opt out explicitly with
// ALLOW_SKIP_DB_TESTS=1 and see in the log what is not covered.

const DB_URL = process.env.DATABASE_URL ?? process.env.APP_DATABASE_URL;

if (DB_URL) process.exit(0);

if (process.env.ALLOW_SKIP_DB_TESTS === "1") {
  console.warn(
    [
      "",
      "  @grc/ai: the pgvector tenant-isolation regression will SKIP.",
      "  Reason: DATABASE_URL is not set and ALLOW_SKIP_DB_TESTS=1 was set",
      "          explicitly.",
      "  Not covered: tests/regression-s05-20-21.test.ts (database half) —",
      "  the proof that embedding search is org-scoped.",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

console.error(
  [
    "",
    "  @grc/ai: the pgvector tenant-isolation regression cannot run.",
    "",
    "  DATABASE_URL is not set, so tests/regression-s05-20-21.test.ts would",
    "  silently skip three cross-tenant assertions and the run would still be",
    "  green — the pattern S11-02 describes.",
    "",
    "  Either:",
    "    export DATABASE_URL=postgresql://grc:...@localhost:5432/grc_platform",
    "  or, if you knowingly want a run without it:",
    "    ALLOW_SKIP_DB_TESTS=1 npm test",
    "",
  ].join("\n"),
);
process.exit(1);
