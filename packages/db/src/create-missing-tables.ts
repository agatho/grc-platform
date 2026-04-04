/**
 * Creates all database tables defined in Drizzle schemas but missing from PostgreSQL.
 *
 * Usage: DATABASE_URL="postgresql://..." npx tsx src/create-missing-tables.ts
 *
 * This script introspects the Drizzle schema exports and compares them against
 * pg_tables. Any table defined in schema but not in the DB gets created with
 * basic column types. Foreign keys and complex defaults are omitted for simplicity —
 * the tables will be fully functional for Drizzle ORM reads/writes.
 *
 * Idempotent: uses CREATE TABLE IF NOT EXISTS.
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as schema from "./index.js";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

function pgType(col: any): string {
  const ct = col.columnType;
  if (ct === "PgUUID") return "UUID";
  if (ct === "PgVarchar") return `VARCHAR(${col.length || 255})`;
  if (ct === "PgText") return "TEXT";
  if (ct === "PgBoolean") return "BOOLEAN";
  if (ct === "PgInteger") return "INTEGER";
  if (ct === "PgNumeric")
    return `NUMERIC(${col.precision || 10},${col.scale || 2})`;
  if (ct === "PgTimestamp")
    return col.withTimezone ? "TIMESTAMPTZ" : "TIMESTAMP";
  if (ct === "PgJsonb") return "JSONB";
  if (ct === "PgSerial") return "SERIAL";
  if (ct === "PgBigint53" || ct === "PgBigSerial53") return "BIGINT";
  if (ct === "PgReal") return "REAL";
  if (ct === "PgDoublePrecision") return "DOUBLE PRECISION";
  if (ct === "PgDate") return "DATE";
  if (ct === "PgArray") return "TEXT[]";
  if (ct === "PgInet") return "INET";
  if (col.enumValues) return "VARCHAR(50)";
  return "TEXT";
}

async function main() {
  const rows = await db.execute(
    sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  const existing = new Set((rows as any[]).map((r: any) => r.tablename));

  const tables: Array<{ name: string; config: any }> = [];
  for (const value of Object.values(schema)) {
    try {
      const config = getTableConfig(value as PgTable);
      if (config?.name && !existing.has(config.name)) {
        tables.push({ name: config.name, config });
      }
    } catch {
      /* not a table */
    }
  }

  if (tables.length === 0) {
    console.log("All tables already exist. Nothing to do.");
    await client.end();
    return;
  }

  console.log(`Creating ${tables.length} missing tables...`);
  let created = 0;
  let failed = 0;

  for (const { name, config } of tables.sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    try {
      const cols = config.columns.map((c: any) => {
        let def = `"${c.name}" ${pgType(c)}`;
        if (c.primary) def += " PRIMARY KEY";
        if (c.notNull && !c.primary) def += " NOT NULL";
        if (c.hasDefault) {
          const t = pgType(c);
          if (c.primary && t === "UUID") def += " DEFAULT gen_random_uuid()";
          else if (t === "BOOLEAN")
            def += ` DEFAULT ${c.default === true ? "true" : "false"}`;
          else if (t === "TIMESTAMPTZ" || t === "TIMESTAMP")
            def += " DEFAULT now()";
          else if (t === "INTEGER") def += " DEFAULT 0";
          else if (t === "JSONB") def += " DEFAULT '{}'::jsonb";
        }
        return def;
      });

      const ddl = `CREATE TABLE IF NOT EXISTS "${name}" (${cols.join(", ")})`;
      await db.execute(sql.raw(ddl));
      created++;
    } catch (e: any) {
      console.error(`FAILED ${name}: ${e.message?.substring(0, 120)}`);
      failed++;
    }
  }

  console.log(`\nDone: ${created} created, ${failed} failed`);
  await client.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
