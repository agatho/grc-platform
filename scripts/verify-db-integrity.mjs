#!/usr/bin/env node
// ============================================================================
// #S13-02 (WP10) — DB-Integritäts-Gates mit belastbaren Schwellen.
//
// Vorher standen in `ci.yml` vier Assertions mit Schwellen, die bei ~2 % des
// Erwartungswerts lagen:
//
//   | Assertion         | alte Schwelle | gemessener Ist-Wert | Schwelle in % |
//   |-------------------|---------------|---------------------|---------------|
//   | Tabellen          | >= 10         | 528                 | 1,9 %         |
//   | RLS-Policies      | >= 6          | 2.262               | 0,3 %         |
//   | Audit-Trigger     | >= 4          | 275                 | 1,5 %         |
//   | Append-Only-Rules | >= 5          | 5                   | 100 %         |
//
// Ein Commit, der 500 der 528 Tabellen bricht, lieferte 28 >= 10 und damit
// grün. Ein Commit, der RLS von 400 Tabellen entfernt, lieferte 1.862 >= 6
// und damit grün. Die Gates detektierten ausschliesslich den Totalausfall der
// Datenbank, keine Regression.
//
// Dieses Skript misst dieselben Grössen gegen die migrierte Datenbank und
// vergleicht sie mit `scripts/db-integrity-baseline.json`. Die Zahlen dort
// stammen aus einem echten Migrationslauf von Null, nicht aus einer
// Schätzung. Unterschreitung um mehr als die dokumentierte Toleranz = Fehler.
//
// Aufruf:
//   DATABASE_URL=… node scripts/verify-db-integrity.mjs
//   DATABASE_URL=… node scripts/verify-db-integrity.mjs --update-baseline
// ============================================================================
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE = join(HERE, "db-integrity-baseline.json");
const UPDATE = process.argv.includes("--update-baseline");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✗ DATABASE_URL ist nicht gesetzt.");
  process.exit(2);
}

// Jede Kennzahl mit ihrer Bedeutung — die Fehlermeldung muss sagen, WAS
// kaputt ist, nicht nur dass eine Zahl kleiner wurde.
const METRICS = {
  tables: {
    sql: `SELECT count(*) FROM information_schema.tables
          WHERE table_schema='public' AND table_type='BASE TABLE'
            AND table_name NOT LIKE '__drizzle%' AND table_name <> '_arctos_migrations'`,
    means:
      "Tabellen aus den Migrationen. Ein Einbruch heisst: Migrationen sind fehlgeschlagen.",
  },
  rlsPolicies: {
    sql: `SELECT count(*) FROM pg_policies WHERE schemaname='public'`,
    means:
      "RLS-Policies. Ein Einbruch heisst: Mandantentrennung ist für Tabellen " +
      "weggefallen (S01-01 ff.).",
  },
  rlsEnabledTables: {
    sql: `SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity`,
    means:
      "Tabellen mit aktivem ROW LEVEL SECURITY. Policies ohne aktiviertes RLS " +
      "sind wirkungslos — deshalb wird beides getrennt gezählt.",
  },
  rlsForcedTables: {
    sql: `SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relkind='r' AND c.relforcerowsecurity`,
    means:
      "Tabellen mit FORCE ROW LEVEL SECURITY. Ohne FORCE umgeht der " +
      "Tabelleneigentümer die eigene Policy (S01-20).",
  },
  auditTriggers: {
    sql: `SELECT count(*) FROM pg_trigger WHERE tgname='audit_trigger' AND NOT tgisinternal`,
    means:
      "Tabellen mit Audit-Trigger. Ein Einbruch heisst: Vorgänge werden nicht protokolliert.",
  },
  appendOnlyRules: {
    sql: `SELECT count(*) FROM pg_rules WHERE schemaname='public' AND rulename LIKE '%\\_no\\_%'`,
    means:
      "Append-only-Rules auf audit_log / access_log / data_export_log (ADR-011).",
  },
  tombstoneGuards: {
    sql: `SELECT count(*) FROM pg_trigger
          WHERE tgname='audit_log_tombstone_guard' AND NOT tgisinternal`,
    means: "Tombstone-Guard auf audit_log (ADR-011 rev.2, S03-02).",
  },
  // [WP10 · Befund WP11, 2026-09-01] Diese Kennzahl zaehlt nicht, OB die
  // Manipulationsschutz-Trigger existieren, sondern ob sie WIRKEN.
  //
  // Auf einer frisch migrierten Datenbank standen `audit_anchor_append_only_trg`
  // und `audit_anchor_no_truncate` auf tgenabled='O' (ENABLE, der Normalfall)
  // statt 'A' (ENABLE ALWAYS) — obwohl 0401/0403 ausdruecklich ENABLE ALWAYS
  // setzen. Ein Trigger im Zustand 'O' feuert unter
  // `session_replication_role='replica'` NICHT. Genau in diesem Modus laeuft
  // ein pg_restore, und so laeuft logische Replikation. Der Merkle-Root der
  // Audit-Kette waere dort ueberschreibbar gewesen, waehrend jede Pruefung auf
  // "Trigger vorhanden" gruen geblieben waere — dieselbe Klasse wie S08-06:
  // die Kontrolle ist da, ihre Wirkung nicht.
  //
  // Baseline 0, Richtung "both": jeder Guard, der aus ENABLE ALWAYS
  // herausfaellt, laesst diese Zahl steigen und die Pruefung scheitern.
  // Reparatur: ALTER TABLE <tabelle> ENABLE ALWAYS TRIGGER <name>;
  tamperGuardsNotEnabledAlways: {
    sql: `SELECT count(*) FROM pg_trigger t
            JOIN pg_class c ON c.oid = t.tgrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname='public' AND NOT t.tgisinternal
            AND (t.tgname LIKE '%append%only%' OR t.tgname LIKE '%no%truncate%'
                 OR t.tgname LIKE '%tombstone%' OR t.tgname LIKE '%no%update%'
                 OR t.tgname LIKE '%no%delete%')
            AND t.tgenabled <> 'A'`,
    means:
      "Manipulationsschutz-Trigger, die NICHT auf ENABLE ALWAYS stehen und " +
      "damit unter session_replication_role='replica' (pg_restore, logische " +
      "Replikation) stillschweigend nicht feuern. Muss 0 bleiben.",
    direction: "both",
  },
  securityDefinerFns: {
    sql: `SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
          WHERE n.nspname='public' AND p.prosecdef`,
    means:
      "SECURITY-DEFINER-Funktionen. Diese Zahl darf nach OBEN auffallen: jede " +
      "neue umgeht RLS und braucht einen gesetzten search_path (S01-13).",
    direction: "both",
  },
};

function q(sql) {
  const out = execFileSync("psql", [url, "-tAc", sql.replace(/\s+/g, " ")], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const n = Number(out.trim());
  if (!Number.isFinite(n))
    throw new Error(`unerwartete psql-Ausgabe: ${out.slice(0, 200)}`);
  return n;
}

const measured = {};
for (const [name, def] of Object.entries(METRICS)) measured[name] = q(def.sql);

if (UPDATE) {
  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        _comment:
          "#S13-02 Untergrenzen der DB-Integritäts-Gates. Aus einem echten " +
          "Migrationslauf von Null gemessen, nicht geschätzt. Neu setzen: " +
          "DATABASE_URL=… node scripts/verify-db-integrity.mjs --update-baseline. " +
          "Eine Absenkung ist im Diff sichtbar und begründungspflichtig.",
        _updatedAt: new Date().toISOString().slice(0, 10),
        _tolerancePercent: 2,
        counts: measured,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Baseline geschrieben: ${BASELINE}`);
  for (const [k, v] of Object.entries(measured))
    console.log(`  ${k.padEnd(20)} ${v}`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(`✗ ${BASELINE} fehlt — mit --update-baseline erzeugen.`);
  process.exit(1);
}
const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
const tol = (baseline._tolerancePercent ?? 2) / 100;
const failures = [];

console.log(
  "DB-Integrität (gemessen gegen scripts/db-integrity-baseline.json)",
);
console.log("  Kennzahl              Baseline  Gemessen");
for (const [name, def] of Object.entries(METRICS)) {
  const base = baseline.counts?.[name] ?? 0;
  const cur = measured[name];
  const floor = Math.floor(base * (1 - tol));
  console.log(
    `  ${name.padEnd(20)} ${String(base).padStart(8)} ${String(cur).padStart(9)}`,
  );
  if (cur < floor) {
    failures.push(
      `${name}: ${cur} < ${floor} (Baseline ${base} − ${baseline._tolerancePercent ?? 2} %). ${def.means}`,
    );
  }
  if (def.direction === "both" && cur > base) {
    failures.push(
      `${name}: ${cur} > Baseline ${base}. ${def.means} Neue Fundstellen prüfen und ` +
        `die Baseline bewusst anheben.`,
    );
  }
}

if (failures.length) {
  console.error(`\n✗ DB-Integrität verletzt (${failures.length}):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(
    "\nDie alten Schwellen (>=10 Tabellen bei 528, >=6 Policies bei 2.262) hätten " +
      "das nicht gesehen — genau das war #S13-02.",
  );
  process.exit(1);
}
console.log("\n✓ Keine Regression gegenüber der gemessenen Baseline.");
