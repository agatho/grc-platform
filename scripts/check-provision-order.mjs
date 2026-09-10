#!/usr/bin/env node
// ============================================================================
// [ARCTOS-FULL-2026-08-31 · OP-241] Reihenfolge von Rollen, Migrationen, Grants
// ============================================================================
//
// `deploy/provision-grc-app.sh` hat zwei Phasen, und beide haben einen
// Zeitpunkt, an dem sie richtig sind:
//
//   1. Die ROLLE `grc_app` muss existieren, BEVOR die Migrationen laufen.
//      `packages/db/migrations/0396_rls_log_tables.sql:117` vergibt EXECUTE
//      auf `app_current_org_scope()` nur `IF EXISTS (… rolname = 'grc_app')`,
//      und `0398` entzieht den pauschalen Grant wieder. Fehlt die Rolle beim
//      Migrieren, faellt der GRANT STILL aus — und danach scheitert jede
//      Abfrage der Anwendung mit `permission denied for function
//      app_current_org_scope`.
//
//   2. Die GRANTS muessen NACH den Migrationen laufen. `GRANT … ON ALL
//      TABLES IN SCHEMA public` wirkt auf die Tabellen, die es im Moment des
//      GRANT gibt. Auf einer leeren Datenbank sind das keine.
//
// Diese Reihenfolge war dreimal in `ci.yml` falsch (OP-238) und ein viertes
// Mal in `schema-drift.yml` — dort hat sie der CI-Lauf 34340833273 gemeldet,
// nachdem die Abnahme aus OP-238 dazugekommen war. Vier gleiche Faelle in
// zwei Dateien sind eine Klasse, und die Antwort auf eine Klasse ist eine
// Pruefung, keine fuenfte Einzelkorrektur.
//
// Geprueft wird pro JOB, nicht pro Datei: ein Job ist die Einheit, in der die
// Schritte nacheinander auf derselben Datenbank laufen.
// ============================================================================

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SKRIPT = "deploy/provision-grc-app.sh";

const VERZEICHNIS = ".github/workflows";
const dateien = readdirSync(VERZEICHNIS).filter((f) => /\.ya?ml$/.test(f));

/** Alle `run:`-Zeilen eines Jobs in Reihenfolge, samt Zeilennummer. */
function jobsMitLaeufen(text) {
  const zeilen = text.split("\n");
  const jobs = new Map();
  let job = null;
  for (let i = 0; i < zeilen.length; i++) {
    const z = zeilen[i];
    const mJob = z.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (mJob) {
      job = mJob[1];
      jobs.set(job, []);
      continue;
    }
    if (!job) continue;
    // `run:` einzeilig oder als Block — beides interessiert uns nur im Text.
    if (/^\s+run:\s*\S/.test(z) || /^\s+run:\s*[|>]/.test(z)) {
      // Bei Blockskalaren die Folgezeilen mitnehmen.
      let inhalt = z.replace(/^\s+run:\s*/, "");
      if (/^[|>]/.test(inhalt)) {
        const einzug = z.match(/^(\s+)/)[1].length;
        inhalt = "";
        for (let j = i + 1; j < zeilen.length; j++) {
          const f = zeilen[j];
          if (f.trim() !== "" && f.match(/^(\s*)/)[1].length <= einzug) break;
          inhalt += f + "\n";
        }
      }
      jobs.get(job).push({ zeile: i + 1, inhalt });
    }
  }
  return jobs;
}

const befunde = [];
let geprueft = 0;

for (const datei of dateien) {
  const pfad = join(VERZEICHNIS, datei);
  const jobs = jobsMitLaeufen(readFileSync(pfad, "utf8"));

  for (const [job, laeufe] of jobs) {
    const rollen = laeufe.filter(
      (l) =>
        l.inhalt.includes("provision-grc-app.sh") &&
        /--(nur-rollen|roles-only)\b/.test(l.inhalt),
    );
    const grants = laeufe.filter(
      (l) =>
        l.inhalt.includes("provision-grc-app.sh") &&
        !/--(nur-rollen|roles-only)\b/.test(l.inhalt),
    );
    const migrationen = laeufe.filter((l) =>
      l.inhalt.includes("migrate-all.ts"),
    );

    if (rollen.length === 0 && grants.length === 0) continue;
    geprueft++;

    if (migrationen.length === 0) {
      // Ein Job, der provisioniert ohne zu migrieren, arbeitet auf einer
      // bereits migrierten Datenbank — dann ist ein reiner Grants-Lauf richtig.
      if (rollen.length > 0 && grants.length === 0) {
        befunde.push(
          `${pfad}: Job \`${job}\` legt nur die Rollen an (--nur-rollen) und migriert nicht — ` +
            `die Grants bekommt so niemand.`,
        );
      }
      continue;
    }

    const ersteMigration = migrationen[0].zeile;
    const letzteMigration = migrationen[migrationen.length - 1].zeile;

    if (rollen.length === 0) {
      befunde.push(
        `${pfad}: Job \`${job}\` migriert (Zeile ${ersteMigration}), ohne vorher die Rollen anzulegen. ` +
          `Der EXECUTE-Grant aus 0396 faellt dann still aus (OP-238). ` +
          `Abhilfe: ein Schritt \`bash deploy/provision-grc-app.sh --nur-rollen\` VOR der Migration.`,
      );
    } else {
      for (const r of rollen) {
        if (r.zeile > ersteMigration) {
          befunde.push(
            `${pfad}: Job \`${job}\` legt die Rollen in Zeile ${r.zeile} an, migriert aber schon in ` +
              `Zeile ${ersteMigration}. Die Rolle muss VOR der Migration existieren (OP-238).`,
          );
        }
      }
    }

    if (grants.length === 0) {
      befunde.push(
        `${pfad}: Job \`${job}\` migriert, vergibt danach aber keine Grants. ` +
          `\`GRANT … ON ALL TABLES\` wirkt nur auf vorhandene Tabellen — Abhilfe: ein Schritt ` +
          `\`bash deploy/provision-grc-app.sh <DB>\` NACH der Migration.`,
      );
    } else {
      for (const g of grants) {
        if (g.zeile < letzteMigration) {
          befunde.push(
            `${pfad}: Job \`${job}\` vergibt die Grants in Zeile ${g.zeile}, migriert aber noch in ` +
              `Zeile ${letzteMigration}. Tabellen, die danach entstehen, bekommen nur ueber ` +
              `ALTER DEFAULT PRIVILEGES Rechte — verlass dich nicht darauf, setz die Grants dahinter.`,
          );
        }
      }
    }
  }
}

// [OP-092-Klasse] Ein Tor, das bei fehlender Eingabe gruen ist, ist kein Tor.
// Beide Nullfaelle sind hier ein Befund, kein Durchlauf.
if (!existsSync(SKRIPT)) {
  console.error(
    `\n✗ ${SKRIPT} fehlt — diese Pruefung haette sonst „0 Jobs" gemeldet und waere gruen.\n`,
  );
  process.exit(1);
}
if (geprueft === 0) {
  console.error(
    `\n✗ Kein einziger Workflow-Job ruft ${SKRIPT} auf. Damit legt CI die Rolle ` +
      `grc_app nie an, und der EXECUTE-Grant aus 0396 faellt in jedem Lauf still aus (OP-238).\n`,
  );
  process.exit(1);
}

console.log(`Provisionierung: ${geprueft} Job(s) rufen ${SKRIPT} auf.`);
if (befunde.length > 0) {
  console.error("\n✗ Reihenfolge von Rollen, Migrationen und Grants:\n");
  for (const b of befunde) console.error(`  - ${b}`);
  console.error("");
  process.exit(1);
}
console.log("\n✓ Rollen vor den Migrationen, Grants danach — in jedem Job.");
