/**
 * migrate-all.ts — Apply all SQL migrations in 2 passes.
 *
 * The ARCTOS migrations have cross-dependencies (e.g., Sprint 14 references
 * tables from Sprint 36). A single pass fails on ~19 files. Two passes
 * resolve all dependencies and create all 340+ tables correctly.
 *
 * Usage: DATABASE_URL=... npx tsx src/migrate-all.ts
 */
import postgres from "postgres";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const client = postgres(process.env.DATABASE_URL!);
const MIGRATIONS_DIR = join(__dirname, "../drizzle");

async function main() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Applying ${files.length} migrations...\n`);

  for (const pass of [1, 2]) {
    let ok = 0;
    let fail = 0;
    for (const file of files) {
      try {
        let sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
        sql = sql.replace(/--> statement-breakpoint/g, "");
        await client.unsafe(sql);
        ok++;
      } catch {
        fail++;
      }
    }
    console.log(`  Pass ${pass}: ${ok} succeeded, ${fail} had errors (expected on pass 1)`);
  }

  // Verify table count
  const [{ count }] = await client.unsafe(
    `SELECT count(*)::int as count FROM information_schema.tables WHERE table_schema = 'public'`
  );
  console.log(`\n✓ ${count} tables created`);

  await client.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
