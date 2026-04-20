/**
 * migrate-all-report.ts — Same as migrate-all, but outputs the full list
 * of failing files to stdout as newline-separated paths. Used by one-off
 * tooling (e.g. cleanup scripts that need to move the failing migrations).
 */
import postgres from "postgres";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const client = postgres(process.env.DATABASE_URL!, {
  max: 1,
  onnotice: () => {},
});
const MIGRATIONS_DIR = join(__dirname, "../drizzle");

async function runPass(
  files: string[],
): Promise<{ ok: string[]; fail: string[] }> {
  const ok: string[] = [];
  const fail: string[] = [];
  for (const file of files) {
    let sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
    sql = sql.replace(/--> statement-breakpoint/g, "");
    try {
      await client.unsafe(`BEGIN; ${sql}; COMMIT;`);
      ok.push(file);
    } catch {
      try {
        await client.unsafe(`ROLLBACK;`);
      } catch {}
      fail.push(file);
    }
  }
  return { ok, fail };
}

async function main() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const p1 = await runPass(files);
  const p2 = await runPass(p1.fail);
  const p3 = await runPass(p2.fail);
  // Everything that fails after 3 passes is genuinely incompatible.
  for (const f of p3.fail) {
    console.log(f);
  }
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
