/**
 * migrate-all.ts — Apply all SQL migrations with the transaction semantics
 * each file was written for.
 *
 * Why multi-pass: ARCTOS has cross-dependencies (e.g. an ALTER TABLE in
 * migration N adds a FK to a table created in migration N+50). A single
 * pass fails on those — the second pass retries failures after their
 * prerequisites exist.
 *
 * ── Transaction handling (ARCTOS-FULL-2026-08-31 / S09-05) ────────────
 * The previous implementation stripped a leading `BEGIN;` and a trailing
 * `COMMIT;`/`ROLLBACK;` from every file and then forced the whole file
 * into a single `client.begin(...)`. That inverted the intent of every
 * hand-written two-phase migration: `0318` documents in its own header
 * that the `ALTER TYPE … ADD VALUE` block MUST commit before the values
 * are referenced, and PostgreSQL rejects the reference with `55P04`
 * otherwise. Eight of the 43 permanently failing migrations were pure
 * artefacts of that rewrite (evidence: S09-psql-autocommit-retry.txt).
 *
 * The runner now classifies each file:
 *
 *   • "managed"    — the file contains no transaction control of its own
 *                    and no statement that PostgreSQL forbids inside a
 *                    transaction block. The runner wraps it in ONE
 *                    transaction, so it is applied all-or-nothing. This
 *                    is the default and covers the vast majority.
 *
 *   • "self-managed" — the file carries its own `BEGIN;`/`COMMIT;`, or
 *                    contains `ALTER TYPE … ADD VALUE`, `CREATE INDEX
 *                    CONCURRENTLY`, `VACUUM`, `CREATE DATABASE` or
 *                    `ALTER SYSTEM`. The runner then behaves exactly like
 *                    `psql -f … -v ON_ERROR_STOP=1`: statements are split
 *                    and sent one at a time in autocommit, and the file's
 *                    own BEGIN/COMMIT are executed verbatim. On error the
 *                    session is rolled back to a clean state and the file
 *                    is reported as failed.
 *
 * ── Ordering (S09-15 / S13-21) ────────────────────────────────────────
 * File order is plain byte order (`LC_ALL=C sort`), which for the
 * zero-padded four-digit prefixes used here is numerically correct and —
 * unlike `sort -V` — reproducible bit-for-bit in JavaScript. The same
 * ordering is used by `scripts/docker-entrypoint.sh`, so the development,
 * CI, DR and production paths apply the identical sequence.
 *
 * Usage: DATABASE_URL=... npx tsx src/migrate-all.ts
 */
import postgres from "postgres";
import { createHash } from "crypto";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const client = postgres(process.env.DATABASE_URL!, {
  max: 1,
  onnotice: () => {},
  // #WAVE23.2 / S09-05: pin the session timezone to UTC for the whole run.
  // The audit_log hash formula (v1/v2) feeds `created_at::text` into
  // SHA-256 and `timestamptz::text` renders in the SESSION timezone, so a
  // run in Europe/Berlin produced different hashes than one in UTC for the
  // same row. Setting it as a startup parameter survives reconnects, which
  // a per-transaction `SET LOCAL` did not.
  connection: { TimeZone: "UTC" },
});
const MIGRATIONS_DIR = join(__dirname, "../drizzle");

/** Statements PostgreSQL refuses to run inside a transaction block. */
const NON_TRANSACTIONAL =
  /\bALTER\s+TYPE\s+[^;]*?\bADD\s+VALUE\b|\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b|\bDROP\s+INDEX\s+CONCURRENTLY\b|\bVACUUM\b|\bCREATE\s+DATABASE\b|\bALTER\s+SYSTEM\b|\bREINDEX\s+(?:\w+\s+)?CONCURRENTLY\b/i;

/** A file-level `BEGIN;` means the author manages transactions themselves. */
const OWN_TRANSACTION = /^[ \t]*BEGIN\s*(?:TRANSACTION|WORK)?\s*;/im;

function stripComments(s: string): string {
  return s.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function isBlank(s: string): boolean {
  return !/\S/.test(stripComments(s));
}

/**
 * Split a SQL script into individual statements on top-level semicolons.
 * Understands line comments, (nestable) block comments, single-quoted
 * strings incl. `''` and `E'\\'` escapes, quoted identifiers and
 * dollar-quoted bodies — the constructs actually used by the 354 files in
 * `drizzle/`. Concatenating the result reproduces the input verbatim, which
 * `tests/migrate-all-splitter.test.ts` asserts for every migration file.
 */
export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  const n = sql.length;
  let cur = "";
  let i = 0;

  while (i < n) {
    const ch = sql[i];

    // -- line comment
    if (ch === "-" && sql[i + 1] === "-") {
      const nl = sql.indexOf("\n", i);
      const end = nl === -1 ? n : nl + 1;
      cur += sql.slice(i, end);
      i = end;
      continue;
    }

    // /* block comment */ (PostgreSQL nests them)
    if (ch === "/" && sql[i + 1] === "*") {
      let depth = 1;
      let j = i + 2;
      while (j < n && depth > 0) {
        if (sql[j] === "/" && sql[j + 1] === "*") {
          depth++;
          j += 2;
        } else if (sql[j] === "*" && sql[j + 1] === "/") {
          depth--;
          j += 2;
        } else {
          j++;
        }
      }
      cur += sql.slice(i, j);
      i = j;
      continue;
    }

    // '…' string literal. Backslash escapes only apply to E'…'.
    if (ch === "'") {
      const escaped = /[eE]$/.test(cur) && !/[A-Za-z0-9_]{2}$/.test(cur);
      let j = i + 1;
      while (j < n) {
        if (escaped && sql[j] === "\\") {
          j += 2;
          continue;
        }
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") {
            j += 2;
            continue;
          }
          j++;
          break;
        }
        j++;
      }
      cur += sql.slice(i, j);
      i = j;
      continue;
    }

    // "…" quoted identifier
    if (ch === '"') {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === '"') {
          if (sql[j + 1] === '"') {
            j += 2;
            continue;
          }
          j++;
          break;
        }
        j++;
      }
      cur += sql.slice(i, j);
      i = j;
      continue;
    }

    // $tag$ … $tag$ dollar-quoted body
    if (ch === "$") {
      const m = /^\$([A-Za-z_\u0080-\uffff][A-Za-z0-9_\u0080-\uffff]*)?\$/.exec(
        sql.slice(i, i + 128),
      );
      if (m) {
        const tag = m[0];
        const endIdx = sql.indexOf(tag, i + tag.length);
        const j = endIdx === -1 ? n : endIdx + tag.length;
        cur += sql.slice(i, j);
        i = j;
        continue;
      }
    }

    if (ch === ";") {
      cur += ";";
      out.push(cur);
      cur = "";
      i++;
      continue;
    }

    cur += ch;
    i++;
  }

  if (cur.length) out.push(cur);
  return out;
}

export type MigrationMode = "managed" | "self-managed";

export function classify(sql: string): MigrationMode {
  const bare = stripComments(sql);
  return NON_TRANSACTIONAL.test(bare) || OWN_TRANSACTION.test(bare)
    ? "self-managed"
    : "managed";
}

/** `LC_ALL=C sort` — byte order. Identical to the entrypoint's ordering. */
export function migrationOrder(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Applied-state ledger (ARCTOS-FULL-2026-08-31 / S09-06, S13-21).
 *
 * Before this table existed, nothing kept track of which migrations had run:
 * `drizzle/meta/_journal.json` covered 25 of 357 files, and both the runner
 * and `scripts/docker-entrypoint.sh` replayed the entire directory on every
 * invocation. That made idempotency a hard precondition, which the files do
 * not universally satisfy (`0285` creates a trigger, `0306` a policy, neither
 * guarded) — so a second container start produced errors that `ON_ERROR_STOP=0`
 * then swallowed.
 *
 * The ledger is shared by this runner and the entrypoint so that dev, CI, DR
 * and production agree on what has been applied (S09-02).
 */
const LEDGER_DDL = `
  CREATE TABLE IF NOT EXISTS _arctos_migrations (
    filename    TEXT PRIMARY KEY,
    checksum    TEXT NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_by  TEXT NOT NULL DEFAULT 'migrate-all',
    status      TEXT NOT NULL DEFAULT 'applied'
  )`;

export function checksum(sql: string): string {
  return createHash("sha256").update(sql, "utf8").digest("hex");
}

interface PassResult {
  ok: string[];
  fail: { file: string; error: string }[];
}

async function applySelfManaged(sql: string): Promise<void> {
  const statements = splitStatements(sql).filter((s) => !isBlank(s));
  try {
    for (const stmt of statements) {
      await client.unsafe(stmt);
    }
  } catch (err) {
    // The file may have opened a transaction that is now aborted. Reset the
    // session so the next file starts clean — max:1 means we share it.
    try {
      await client.unsafe("ROLLBACK");
    } catch {
      /* no transaction open — nothing to roll back */
    }
    throw err;
  }
}

async function record(file: string, sum: string): Promise<void> {
  await client.unsafe(
    `INSERT INTO _arctos_migrations (filename, checksum, applied_by)
     VALUES ($1, $2, 'migrate-all')
     ON CONFLICT (filename) DO UPDATE SET checksum = EXCLUDED.checksum`,
    [file, sum],
  );
}

async function runPass(
  files: string[],
  applied?: Map<string, string>,
): Promise<PassResult> {
  const ok: string[] = [];
  const fail: { file: string; error: string }[] = [];

  for (const file of files) {
    const raw = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
    const sum = checksum(raw);
    const known = applied?.get(file);
    if (known !== undefined) {
      if (known !== sum) {
        console.log(
          `  ! ${file} was applied earlier with a different checksum — not re-applied.`,
        );
      }
      ok.push(file);
      continue;
    }
    let sql = raw;
    // Drizzle-generated files use this sentinel between statements; strip it
    // so the driver sees a single multi-statement batch.
    sql = sql.replace(/--> statement-breakpoint/g, "");

    // Skip the file if it is effectively empty (only whitespace/comments).
    if (isBlank(sql)) {
      await record(file, sum);
      applied?.set(file, sum);
      ok.push(file);
      continue;
    }

    try {
      if (classify(sql) === "self-managed") {
        await applySelfManaged(sql);
      } else {
        await client.begin(async (tx) => {
          await tx.unsafe("SET LOCAL TIME ZONE 'UTC'");
          await tx.unsafe(sql);
        });
      }
      await record(file, sum);
      applied?.set(file, sum);
      ok.push(file);
    } catch (err) {
      fail.push({
        file,
        error: err instanceof Error ? err.message.split("\n")[0] : String(err),
      });
    }
  }

  return { ok, fail };
}

async function main() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort(migrationOrder);

  await client.unsafe(LEDGER_DDL);
  const ledgerRows = await client.unsafe<
    { filename: string; checksum: string }[]
  >(`SELECT filename, checksum FROM _arctos_migrations`);
  const applied = new Map(ledgerRows.map((r) => [r.filename, r.checksum]));

  console.log(
    `Applying ${files.length} migrations` +
      (applied.size > 0 ? ` (${applied.size} already recorded as applied)` : "") +
      `...\n`,
  );

  const pass1 = await runPass(files, applied);
  console.log(
    `  Pass 1: ${pass1.ok.length} succeeded, ${pass1.fail.length} deferred`,
  );
  // A file that only succeeds on a later pass would still fail under the
  // production entrypoint, which applies every file exactly once. Name them.
  for (const f of pass1.fail) {
    console.log(`      deferred: ${f.file} — ${f.error}`);
  }

  const pass2 = await runPass(pass1.fail.map((f) => f.file), applied);
  console.log(
    `  Pass 2: ${pass2.ok.length} recovered, ${pass2.fail.length} still failing`,
  );

  let pass3: PassResult | null = null;
  if (pass2.fail.length > 0) {
    pass3 = await runPass(pass2.fail.map((f) => f.file), applied);
    console.log(
      `  Pass 3: ${pass3.ok.length} recovered, ${pass3.fail.length} still failing`,
    );
  }

  const stillFailing = pass3 ? pass3.fail : pass2.fail;

  // #S09-01: the error a later pass reports is frequently a follow-on of a
  // completely different first-pass error (0042 reported `column
  // "module_scope" does not exist` while the actual defect was a 42601 in an
  // INSERT). Carry the pass-1 error along so the summary names the cause.
  const firstError = new Map(pass1.fail.map((f) => [f.file, f.error]));

  const [{ count }] = await client.unsafe<{ count: number }[]>(
    `SELECT count(*)::int as count FROM information_schema.tables WHERE table_schema = 'public'`,
  );
  console.log(`\n✓ ${count} tables created`);
  console.log(
    `✓ ${files.length - stillFailing.length}/${files.length} migrations applied`,
  );

  if (stillFailing.length > 0) {
    console.log(`\n✗ ${stillFailing.length} migrations still failing:`);
    for (const f of stillFailing) {
      console.log(`    ${f.file}`);
      console.log(`      ${f.error}`);
      const first = firstError.get(f.file);
      if (first && first !== f.error) {
        console.log(`      (pass 1 / root cause: ${first})`);
      }
    }
    await client.end();
    process.exit(1);
  }

  console.log(`\nAll migrations applied successfully.`);
  await client.end();
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
