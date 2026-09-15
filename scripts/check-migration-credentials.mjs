#!/usr/bin/env node
// ============================================================================
// [ARCTOS-FULL-2026-08-31 · OP-267] No login-capable accounts from migrations
// ============================================================================
//
// The project has three switches against demo accounts with known passwords —
// SEED_DEMO_DATA, ALLOW_DEMO_SEED_IN_PROD (#SEC-F04) and
// ALLOW_PRODUCTION_SEED — plus a guard that refuses to start when the first
// two are set (scripts/assert-runtime-config.mjs). All three act on the SEED
// path. Six MIGRATIONS walk past them: they run unconditionally, on every
// database, and before any switch is read. On 2026-09-14 a tenant that should
// have held exactly one account held 35 — 15 of them login-capable with a
// password printed in plain text in the header of 0317 (public repository).
//
// Six files in one class are not individual cases. The answer to a class is a
// check.
//
// Two rules:
//
//   1. A migration must not write `password_hash` into `"user"`. The six
//      historical files are frozen by name; the list may shrink, not grow.
//      (They cannot be edited — ADR-014, they are delivered. They are
//      neutralized by 0480_op267_disable_seeded_login_accounts.sql.)
//
//   2. EVERY address in those six files must be covered by 0480. This is the
//      rule that carries: it also fails when someone adds an address to a
//      frozen file that the neutralization does not know about. Without it
//      the freeze list would be a permission; with it, it is a ledger.
//
// Seeds under packages/db/sql/ are NOT checked here: they hang off the
// switches above, which is the intended path.
// ============================================================================

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS = "packages/db/drizzle";
const NEUTRALIZER = "0480_op267_disable_seeded_login_accounts.sql";

// Frozen on 2026-09-14. Each line names what the file creates.
const FROZEN = new Map([
  ["0096_additional_system_roles.sql", "6 × @arctos.dev (named individually)"],
  ["0316_seed_rbac_test_users.sql", "13 × @arctos.test (placeholder hash)"],
  [
    "0317_seed_rbac_login_users.sql",
    "9 × @meridian.test (password in plain text in the header)",
  ],
  ["0318_user_role_enum_backfill_and_rbac_retry.sql", "retry of 0316/0317"],
  ["0326_seed_arctistx_rbac_users.sql", "4 × @arctistx.test"],
  ["0346_seed_bcm_security_external_auditor_users.sql", "3 × @meridian.test"],
]);

const problems = [];
const lines = (t) => t.split(/\r?\n/);

const files = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith(".sql"))
  .sort();

// ── Rule 1: no new accounts from migrations ─────────────────────────────────
const creators = new Set();
for (const file of files) {
  const text = readFileSync(join(MIGRATIONS, file), "utf8");
  // Only hits that do BOTH: insert into `"user"` and set a password hash.
  // `UPDATE "user" SET password_hash = ...` (as the neutralizer itself does)
  // is explicitly allowed.
  if (!/INSERT\s+INTO\s+"user"/i.test(text)) continue;
  if (!/password_hash/i.test(text)) continue;
  creators.add(file);
  if (!FROZEN.has(file)) {
    const lineNo =
      lines(text).findIndex((l) => /INSERT\s+INTO\s+"user"/i.test(l)) + 1;
    problems.push(
      `${MIGRATIONS}/${file}:${lineNo}\n` +
        `    This migration creates an account with a password hash. Migrations run\n` +
        `    unconditionally on EVERY database and bypass SEED_DEMO_DATA,\n` +
        `    ALLOW_DEMO_SEED_IN_PROD and ALLOW_PRODUCTION_SEED (OP-267).\n` +
        `    Accounts belong in a seed under packages/db/sql/ or in\n` +
        `    packages/db/src/create-admin.ts — not in a migration.`,
    );
  }
}

for (const [file, what] of FROZEN) {
  if (!creators.has(file)) {
    problems.push(
      `${MIGRATIONS}/${file}\n` +
        `    is listed as frozen (${what}) but no longer creates an account.\n` +
        `    If that is intended: remove its entry from FROZEN.`,
    );
  }
}

// ── Rule 2: the neutralizer covers every one of those addresses ─────────────
const neutralizerText = readFileSync(join(MIGRATIONS, NEUTRALIZER), "utf8");

// Patterns of the form  email ILIKE '%@arctos.test'
const domainPatterns = [
  ...neutralizerText.matchAll(/ILIKE\s+'%@([A-Za-z0-9.-]+)'/g),
].map((m) => "@" + m[1].toLowerCase());
// Individually named addresses from the IN list
const namedAddresses = new Set(
  [...neutralizerText.matchAll(/'([A-Za-z0-9._+-]+@[A-Za-z0-9.-]+)'/g)].map(
    (m) => m[1].toLowerCase(),
  ),
);

const isCovered = (address) =>
  namedAddresses.has(address) ||
  domainPatterns.some((d) => address.endsWith(d));

for (const file of FROZEN.keys()) {
  if (!creators.has(file)) continue;
  const text = readFileSync(join(MIGRATIONS, file), "utf8");
  // Only addresses from the INSERT statements on `"user"`. A file may name
  // foreign addresses without creating them: 0096:170 reads back
  // `admin@arctos.dev` as `granted_by`. That account is created by the seed,
  // it is the real administrator of the installation and must stay
  // login-capable — the first version of this rule read the whole file and
  // promptly demanded its neutralization.
  const statements = text.match(/INSERT\s+INTO\s+"user"[\s\S]*?;/gi) ?? [];
  const addresses = new Set(
    statements.flatMap((s) =>
      [...s.matchAll(/'([A-Za-z0-9._+-]+@[A-Za-z0-9.-]+)'/g)].map((m) =>
        m[1].toLowerCase(),
      ),
    ),
  );
  for (const address of addresses) {
    if (!isCovered(address)) {
      problems.push(
        `${MIGRATIONS}/${file}\n` +
          `    '${address}' is not covered by ${NEUTRALIZER}.\n` +
          `    Either add it there, or justify why it should stay login-capable.`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error("");
  console.error("Accounts created by migrations (OP-267):");
  console.error("");
  for (const p of problems) console.error("  " + p + "\n");
  process.exit(1);
}

const n = creators.size;
console.log(
  `OK — ${n} historical migration${n === 1 ? "" : "s"} creating accounts, ` +
    `all neutralized by ${NEUTRALIZER}; no new ones.`,
);
