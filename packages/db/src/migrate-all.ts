/**
 * migrate-all.ts — Apply all SQL migrations with proper per-file transactions.
 *
 * Why multi-pass: ARCTOS has cross-dependencies (e.g. an ALTER TABLE in
 * migration N adds a FK to a table created in migration N+50). A single
 * pass fails on those — the second pass retries failures after their
 * prerequisites exist.
 *
 * Why explicit transactions: without BEGIN…COMMIT per file, a statement
 * failure in the middle of a multi-statement migration leaves the
 * migration partially applied (e.g. the CREATE TABLE went through but
 * the subsequent CREATE INDEX didn't). The next pass then sees "table
 * exists" for the CREATE TABLE and "index exists" for the retry —
 * neither succeeds and the migration is stuck forever.
 *
 * The implementation uses `client.begin(...)` which guarantees a single
 * transaction scoped to that callback: any thrown error triggers a real
 * ROLLBACK and the next file starts from a clean session.
 *
 * Usage: DATABASE_URL=... npx tsx src/migrate-all.ts
 */
import postgres from "postgres";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const client = postgres(process.env.DATABASE_URL!, {
  max: 1,
  onnotice: () => {},
});
const MIGRATIONS_DIR = join(__dirname, "../drizzle");

interface PassResult {
  ok: string[];
  fail: { file: string; error: string }[];
}

async function runPass(files: string[]): Promise<PassResult> {
  const ok: string[] = [];
  const fail: { file: string; error: string }[] = [];

  for (const file of files) {
    let sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
    // Drizzle-generated files use this sentinel between statements; strip it
    // so the driver sees a single multi-statement batch.
    sql = sql.replace(/--> statement-breakpoint/g, "");
    // Skip the file if it is effectively empty (only whitespace/comments).
    if (!/\S/.test(sql.replace(/--.*$/gm, ""))) {
      ok.push(file);
      continue;
    }

    try {
      await client.begin(async (tx) => {
        await tx.unsafe(sql);
      });
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
    .sort();

  console.log(`Applying ${files.length} migrations...\n`);

  const pass1 = await runPass(files);
  console.log(
    `  Pass 1: ${pass1.ok.length} succeeded, ${pass1.fail.length} deferred`,
  );

  const pass2 = await runPass(pass1.fail.map((f) => f.file));
  console.log(
    `  Pass 2: ${pass2.ok.length} recovered, ${pass2.fail.length} still failing`,
  );

  let pass3: PassResult | null = null;
  if (pass2.fail.length > 0) {
    pass3 = await runPass(pass2.fail.map((f) => f.file));
    console.log(
      `  Pass 3: ${pass3.ok.length} recovered, ${pass3.fail.length} still failing`,
    );
  }

  const stillFailing = pass3 ? pass3.fail : pass2.fail;

  const [{ count }] = await client.unsafe<{ count: number }[]>(
    `SELECT count(*)::int as count FROM information_schema.tables WHERE table_schema = 'public'`,
  );
  console.log(`\n✓ ${count} tables created`);

  if (stillFailing.length > 0) {
    console.log(`\n✗ ${stillFailing.length} migrations still failing:`);
    for (const f of stillFailing) {
      console.log(`    ${f.file}`);
      console.log(`      ${f.error}`);
    }
    await client.end();
    process.exit(1);
  }

  console.log(`\nAll migrations applied successfully.`);
  await client.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
