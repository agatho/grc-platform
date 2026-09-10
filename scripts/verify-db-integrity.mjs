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
// ── [ARCTOS-FULL-2026-08-31 / Welle 4b-5 · OP-064 auch hier] ────────────
//
// `--update-baseline` konnte bis Welle 4b-5 JEDE Zahl kommentarlos
// verschieben — auch die zwei Kennzahlen, deren Sinn gerade darin besteht,
// nach OBEN aufzufallen (`direction: "both"`: securityDefinerFns,
// tamperGuardsNotEnabledAlways). Die einzige Spur davon wäre ein geändertes
// Datum gewesen. Für die Lint-Ratsche ist das mit OP-064 abgestellt worden;
// hier stand es noch offen, und es ist genau die Stelle, an der die
// bequemste Antwort auf ein rotes Tor („Baseline hochsetzen") keinen
// Widerstand fand.
//
// Jetzt gilt dieselbe Regel wie dort:
//
//   * Eine VERSCHÄRFUNG (eine Untergrenze steigt, eine „darf nicht
//     wachsen"-Zahl sinkt) geht ohne Begründung durch.
//   * Eine LOCKERUNG (eine Untergrenze sinkt, eine „darf nicht wachsen"-Zahl
//     steigt) verlangt `--reason "…"`, und die Begründung landet mitsamt den
//     Deltas in `_history` — in der Datei, im Diff, im Review.
//
// Aufruf:
//   DATABASE_URL=… node scripts/verify-db-integrity.mjs
//   DATABASE_URL=… node scripts/verify-db-integrity.mjs --update-baseline
//   DATABASE_URL=… node scripts/verify-db-integrity.mjs --update-baseline \
//     --reason "warum das jetzt so ist"
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
  const previous = existsSync(BASELINE)
    ? JSON.parse(readFileSync(BASELINE, "utf8"))
    : { counts: {}, _history: [] };
  const prevCounts = previous.counts ?? {};

  // Welche Richtung ist bei welcher Kennzahl die LOCKERUNG?
  //   direction "both"  — die Zahl soll nicht wachsen: steigen ist Lockerung.
  //   sonst (Untergrenze) — die Zahl soll nicht fallen: sinken ist Lockerung.
  const deltas = [];
  const lockerungen = [];
  for (const name of new Set([
    ...Object.keys(prevCounts),
    ...Object.keys(measured),
  ])) {
    const before = prevCounts[name];
    const after = measured[name];
    if (before === after) continue;
    const beideRichtungen = METRICS[name]?.direction === "both";
    const istLockerung =
      before === undefined
        ? false
        : beideRichtungen
          ? after > before
          : after < before;
    const zeile = `${name}: ${before ?? "(neu)"} → ${after}${
      istLockerung ? "  ← LOCKERUNG" : ""
    }`;
    deltas.push(zeile);
    if (istLockerung) lockerungen.push(zeile);
  }

  const reasonIdx = process.argv.indexOf("--reason");
  const reason =
    reasonIdx !== -1 ? (process.argv[reasonIdx + 1] ?? "").trim() : "";

  if (lockerungen.length > 0 && !reason) {
    console.error(
      `✗ ${lockerungen.length} Kennzahl(en) werden gelockert, ohne Begründung:`,
    );
    for (const d of lockerungen) console.error(`    ${d}`);
    console.error(
      "\n  Eine Lockerung braucht eine Begründung in der Datei:\n" +
        '    … --update-baseline --reason "warum das jetzt so ist"\n' +
        "  Bei securityDefinerFns heisst das: jede neue Funktion einzeln\n" +
        "  benennen und sagen, warum sie RLS umgehen DARF. Eine\n" +
        "  SECURITY-DEFINER-Funktion laeuft mit den Rechten ihres\n" +
        "  Eigentuemers; das ist bei Waechtern und Audit-Funktionen richtig\n" +
        "  und bei allem anderen ein Befund.",
    );
    process.exit(1);
  }

  const history = Array.isArray(previous._history) ? previous._history : [];
  if (deltas.length > 0) {
    history.push({
      date: new Date().toISOString().slice(0, 10),
      changed: deltas.sort(),
      ...(reason ? { reason } : {}),
    });
  }

  writeFileSync(
    BASELINE,
    JSON.stringify(
      {
        _comment:
          "#S13-02 Untergrenzen der DB-Integritäts-Gates. Aus einem echten " +
          "Migrationslauf von Null gemessen, nicht geschätzt. Neu setzen: " +
          "DATABASE_URL=… node scripts/verify-db-integrity.mjs --update-baseline. " +
          "Eine LOCKERUNG (Untergrenze sinkt, oder eine der beiden " +
          "'darf nicht wachsen'-Kennzahlen steigt) verlangt zusätzlich " +
          "--reason und wird in _history festgehalten (OP-064-Muster).",
        _updatedAt: new Date().toISOString().slice(0, 10),
        _tolerancePercent: previous._tolerancePercent ?? 2,
        counts: measured,
        _history: history,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Baseline geschrieben: ${BASELINE}`);
  for (const [k, v] of Object.entries(measured))
    console.log(`  ${k.padEnd(28)} ${v}`);
  if (deltas.length > 0) {
    console.log("  Änderungen gegenüber der bisherigen Baseline:");
    for (const d of deltas.sort()) console.log(`    ${d}`);
  }
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
