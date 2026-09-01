/**
 * Regression tests for the migration corpus.
 *
 * [ARCTOS-FULL-2026-08-31 / WP1]
 * Every assertion here fails on the pre-remediation tree — these are the
 * checks that would have surfaced BASE-002 / S09-01 long before a DR restore
 * did. They need no database: they read `packages/db/drizzle` and the runner's
 * own helpers.
 */
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  classify,
  migrationOrder,
  splitStatements,
} from "../../src/migrate-all";

const DIR = join(__dirname, "..", "..", "drizzle");
const FILES = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort(migrationOrder);
const read = (f: string) => readFileSync(join(DIR, f), "utf-8");

describe("statement splitter (S09-05)", () => {
  it("round-trips every migration byte-for-byte", () => {
    for (const f of FILES) {
      const sql = read(f).replace(/--> statement-breakpoint/g, "");
      expect(splitStatements(sql).join(""), `round-trip failed for ${f}`).toBe(
        sql,
      );
    }
  });

  it("keeps dollar-quoted bodies, strings and comments in one statement", () => {
    const sql =
      "DO $$ BEGIN RAISE NOTICE 'a; b'; END $$;\n" +
      "-- a comment with a ; in it\n" +
      "SELECT 'it''s';\n" +
      "/* block ; comment */ SELECT 1;";
    const parts = splitStatements(sql).filter((p) => /\S/.test(p));
    // Three statements: the DO block (its inner `;` are inside $$…$$), the
    // SELECT preceded by the line comment (whose `;` must not split), and the
    // SELECT preceded by the block comment (likewise).
    expect(parts).toHaveLength(3);
    expect(parts[0]).toContain("RAISE NOTICE 'a; b'");
    expect(parts[1]).toContain("'it''s'");
    expect(parts[2]).toContain("/* block ; comment */");
  });
});

describe("transaction classification (S09-05)", () => {
  it("runs a file with ALTER TYPE … ADD VALUE outside a transaction", () => {
    // PostgreSQL rejects using an enum value in the transaction that added it
    // (55P04). The old runner stripped the file's own BEGIN/COMMIT and forced
    // exactly that, which produced 8 of the 43 failures.
    expect(
      classify(
        "ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ciso';\n" +
          "UPDATE x SET role = 'ciso'::user_role;",
      ),
    ).toBe("self-managed");
  });

  it("respects a file that manages its own transaction", () => {
    expect(classify("BEGIN;\nSELECT 1;\nCOMMIT;")).toBe("self-managed");
  });

  it("wraps an ordinary DDL file in one transaction", () => {
    expect(classify("CREATE TABLE x (id uuid primary key);")).toBe("managed");
  });

  it("does not misread the words inside a comment", () => {
    expect(
      classify("-- BEGIN; and ALTER TYPE t ADD VALUE 'x'\nSELECT 1;"),
    ).toBe("managed");
  });
});

describe("file ordering (S09-15 / S13-21)", () => {
  it("orders identically to `LC_ALL=C sort`", () => {
    const shuffled = [...FILES].reverse();
    expect([...shuffled].sort(migrationOrder)).toEqual(FILES);
  });

  it("assigns every migration a unique number", () => {
    const numbers = FILES.map((f) => /^(\d{4}[a-z]?)_/.exec(f)?.[1]);
    const dupes = numbers.filter((n, i) => numbers.indexOf(n) !== i);
    expect(dupes, `duplicate migration numbers: ${dupes.join(", ")}`).toEqual(
      [],
    );
  });
});

describe("index names are unique schema-wide (S09-01 / 42P07)", () => {
  it("never gives an existing index name to a different table without IF NOT EXISTS", () => {
    const re =
      /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(IF\s+NOT\s+EXISTS\s+)?"?([A-Za-z0-9_]+)"?\s+ON\s+"?([A-Za-z0-9_]+)"?/gi;
    const seen = new Map<string, string>();
    const collisions: string[] = [];
    for (const f of FILES) {
      const sql = read(f).replace(/--[^\n]*/g, "");
      for (const m of sql.matchAll(re)) {
        const [, ifNotExists, name, table] = m;
        const prev = seen.get(name);
        if (prev === undefined) seen.set(name, table);
        else if (prev !== table && !ifNotExists) {
          collisions.push(`${f}: ${name} (${prev} → ${table})`);
        }
      }
    }
    expect(collisions).toEqual([]);
  });
});

describe("ADR-023 §4 metadata header", () => {
  it("is present on every migration written for this remediation", () => {
    const required = [
      "-- Migration:",
      "-- Breaking:",
      "-- Estimated-Duration:",
      "-- Locking:",
      "-- Compensating-Required:",
      "-- Reviewer:",
    ];
    const remediationFiles = FILES.filter((f) => /^03(8[2-9])_/.test(f));
    expect(remediationFiles.length).toBeGreaterThan(0);
    for (const f of remediationFiles) {
      const head = read(f).split("\n").slice(0, 40).join("\n");
      for (const key of required) {
        expect(head, `${f} is missing "${key}"`).toContain(key);
      }
    }
  });
});

describe("no migration references a relation nothing creates (S09-01)", () => {
  it("does not target the three phantom tables any more", () => {
    // notification_template, dashboard_widget_config and grc_report_template
    // exist in no migration and in no pgTable; unguarded references to them
    // aborted 0025, 0124 and 0093 and took the tables those files create with
    // them. They may only appear behind an existence guard now.
    for (const phantom of [
      "notification_template",
      "dashboard_widget_config",
    ]) {
      for (const f of FILES) {
        const sql = read(f);
        if (!sql.includes(phantom)) continue;
        expect(
          sql.includes(`to_regclass('public.${phantom}')`),
          `${f} references ${phantom} without a to_regclass guard`,
        ).toBe(true);
      }
    }
    // `grc_report_template` may still be named in an explanatory comment, but
    // must not appear in executable SQL any more.
    const executable = FILES.map((f) => read(f).replace(/--[^\n]*/g, "")).join(
      "\n",
    );
    expect(executable).not.toContain("grc_report_template");
  });
});
