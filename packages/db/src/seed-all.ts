import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";

const client = postgres(process.env.DATABASE_URL!);
const SQL_DIR = join(__dirname, "../sql");

const SEED_ORDER = [
  "seed_module_definitions_sprint4_9.sql",
  "seed_work_item_types_sprint5_9.sql",
  "seed_catalog_iso27002_2022.sql",
  "seed_catalog_bsi_threats.sql",
  "seed_catalog_nist_csf2.sql",
  "seed_catalog_cambridge_v2.sql",
  "seed_catalog_wef_global_risks.sql",
  "seed_catalog_cis_controls_v8.sql",
  "seed_fachliche_stammdaten.sql",
  "seed_cross_framework_mappings.sql",
];

async function main() {
  console.log("Running ARCTOS seed data...");
  for (const file of SEED_ORDER) {
    try {
      const sql = readFileSync(join(SQL_DIR, file), "utf-8");
      console.log(`  > ${file}`);
      await client.unsafe(sql);
    } catch (err) {
      console.error(`  FAILED: ${file}`, (err as Error).message);
    }
  }
  console.log("Seed complete.");
  await client.end();
}

main();
