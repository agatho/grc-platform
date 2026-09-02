#!/usr/bin/env node
/**
 * check-compose-db-roles.mjs — Wächter über die Datenbankrollen im Deployment.
 *
 * [ARCTOS-FULL-2026-08-31 · OP-090, OP-091]
 *
 * Vorgänger war ein Inline-Block in `.github/workflows/ci.yml`
 * („Verify production runtime connects as non-superuser (grc_app) — web").
 * Er prüfte drei Dinge und schloss mit der Zeile
 *
 *     F-05 OK: web=grc_app (RLS enforced), worker=grc (privileged, cross-org).
 *
 * Diese Zeile war zum Zeitpunkt der Prüfung bereits falsch: der Worker fährt
 * seit WP9/S01-09 als `grc_worker` (NOSUPERUSER, BYPASSRLS). Der Wächter hat
 * die Umstellung nicht bemerkt, weil er sie nie geprüft hat — er wusste nur,
 * dass der Worker KEIN `APP_DATABASE_URL` setzen darf, und das gilt vor wie
 * nach der Umstellung. Gemessen: derselbe Block läuft grün gegen eine Fassung,
 * in der die Worker-Zeile wieder auf `postgresql://grc:${DB_PASSWORD}` steht,
 * also auf den SUPERUSER. Genau die Regression, gegen die er stehen sollte,
 * ist die einzige, die er nicht sieht.
 *
 * Deshalb hier neu und als eigenständiges Skript statt als YAML-Block: ein
 * Wächter, den man nicht lokal ausführen kann, wird nicht gegengeprüft.
 *
 *   node scripts/check-compose-db-roles.mjs
 *   node scripts/check-compose-db-roles.mjs pfad/zu/compose.yml   (einzeln)
 *
 * Geprüfte Regeln, je Compose-Datei:
 *
 *  1. Der Web-Dienst deklariert `APP_DATABASE_URL` auf `grc_app`.
 *     Ohne diese Rolle ist RLS in Produktion wirkungslos (Pentest F-01).
 *  2. Kein Dienst richtet `APP_DATABASE_URL` auf `grc` (Superuser) oder auf
 *     `grc_worker` (BYPASSRLS). `APP_DATABASE_URL` IST der RLS-Nachweis.
 *  3. Worker-artige Dienste (`worker`, `ops-metrics`) verbinden über
 *     `DATABASE_URL` als `grc_worker` — nicht als `grc`. Sie brauchen
 *     BYPASSRLS für org-übergreifende Systemjobs, aber weder
 *     `COPY … TO PROGRAM` noch `ALTER SYSTEM` noch Eigentümerrechte.
 *  4. Sie deklarieren kein `APP_DATABASE_URL` (sonst liefe der Job unter RLS
 *     ohne Org-Kontext und täte still nichts).
 *  5. Der Superuser `grc` steht nur in den namentlich begründeten Ausnahmen.
 *  6. OP-091: Jede Variable, die in einer `postgresql://`-URL ein Passwort
 *     liefert, trägt an DIESER Stelle die `:?`-Pflichtprüfung. `${VAR:-}`
 *     oder `${VAR}` erzeugen bei fehlender Variable einen gesetzten, aber
 *     ungültigen URL — der Dienst startet und scheitert später, statt beim
 *     `docker compose up` lesbar abzubrechen.
 *
 * Der Wächter bricht auch ab, wenn er einen erwarteten Dienst NICHT findet.
 * Ein Prüfer, der bei fehlender Eingabe grün meldet, ist der Fehler, den
 * Welle 0 an zwei anderen Toren gefunden hat.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Dienste, die den Superuser `grc` benutzen dürfen — mit Begründung. */
const SUPERUSER_ALLOWED = {
  web: "docker-entrypoint fährt beim Containerstart die Migrationen; die Laufzeit selbst nutzt APP_DATABASE_URL (grc_app).",
  postgres: "die Datenbank selbst.",
  "create-admin":
    "Einmallauf zum Anlegen des Erstadministrators, schreibt in `user` ohne Org-Kontext.",
  "provision-roles":
    "legt grc_app/grc_worker an — braucht CREATEROLE und GRANT.",
};

/** Dienste, die als `grc_worker` verbinden MÜSSEN, wenn es sie gibt. */
const WORKER_SERVICES = ["worker", "ops-metrics"];

const FILES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["docker-compose.production.yml", "deploy/docker-compose.yml"];

/**
 * Minimaler, einrückungsbewusster Scanner statt eines YAML-Parsers: `js-yaml`
 * liegt nur als transitive Abhängigkeit im Baum, und ein Wächter darf nicht
 * daran hängen, ob eine fremde Auflösung sie morgen noch mitliefert. Gebraucht
 * wird ohnehin nur „welcher Dienst, welche Umgebungszeile" — beide Dateien
 * sind durchgängig zweizeichen-eingerückt.
 */
function parseServices(text) {
  const lines = text.split("\n");
  const services = new Map();
  let inServices = false;
  let current = null;
  for (const line of lines) {
    if (/^services:\s*$/.test(line)) {
      inServices = true;
      continue;
    }
    if (!inServices) continue;
    // Eine Spalte-0-Zeile beendet den services-Block.
    if (/^\S/.test(line)) {
      inServices = false;
      current = null;
      continue;
    }
    const svc = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (svc) {
      current = svc[1];
      services.set(current, []);
      continue;
    }
    if (current && line.trim() && !line.trim().startsWith("#")) {
      services.get(current).push(line);
    }
  }
  return services;
}

/** Wert einer Umgebungszuweisung `KEY: value` innerhalb eines Dienstes. */
function envValue(lines, key) {
  const re = new RegExp(`^\\s+${key}:\\s*(.+?)\\s*$`);
  for (const l of lines) {
    const m = l.match(re);
    if (m) return m[1];
  }
  return null;
}

/** Rolle aus einem `postgresql://<rolle>:…`-URL. */
function roleOf(url) {
  const m = url && url.match(/postgres(?:ql)?:\/\/([A-Za-z0-9_]+):/);
  return m ? m[1] : null;
}

const errors = [];
const notes = [];

for (const rel of FILES) {
  const file = path.isAbsolute(rel) ? rel : path.join(REPO, rel);
  if (!fs.existsSync(file)) {
    errors.push(`${rel}: Datei nicht gefunden.`);
    continue;
  }
  const text = fs.readFileSync(file, "utf8");
  const services = parseServices(text);
  if (services.size === 0) {
    errors.push(`${rel}: kein services:-Block erkannt — Wächter blind.`);
    continue;
  }

  // ── Regel 1/2: web fährt als grc_app ────────────────────────────────
  const web = services.get("web");
  if (!web) {
    errors.push(`${rel}: Dienst 'web' fehlt — erwartet.`);
  } else {
    const appUrl = envValue(web, "APP_DATABASE_URL");
    if (!appUrl) {
      errors.push(
        `${rel} · web: APP_DATABASE_URL fehlt. Ohne die Nicht-Superuser-Rolle grc_app ist RLS in Produktion wirkungslos (F-01/F-05).`,
      );
    } else if (roleOf(appUrl) !== "grc_app") {
      errors.push(
        `${rel} · web: APP_DATABASE_URL verbindet als '${roleOf(appUrl)}' statt 'grc_app'.`,
      );
    } else {
      notes.push(`${rel} · web: APP_DATABASE_URL = grc_app`);
    }
  }

  for (const [name, lines] of services) {
    const appUrl = envValue(lines, "APP_DATABASE_URL");
    const dbUrl = envValue(lines, "DATABASE_URL");

    // ── Regel 2: APP_DATABASE_URL ist der RLS-Nachweis ────────────────
    if (appUrl) {
      const r = roleOf(appUrl);
      if (r === "grc" || r === "grc_worker") {
        errors.push(
          `${rel} · ${name}: APP_DATABASE_URL verbindet als '${r}' — diese Rolle umgeht RLS (BYPASSRLS bzw. SUPERUSER).`,
        );
      }
    }

    // ── Regel 3/4: Worker-Dienste ─────────────────────────────────────
    if (WORKER_SERVICES.includes(name)) {
      if (!dbUrl) {
        errors.push(`${rel} · ${name}: DATABASE_URL fehlt.`);
      } else if (roleOf(dbUrl) !== "grc_worker") {
        errors.push(
          `${rel} · ${name}: DATABASE_URL verbindet als '${roleOf(dbUrl)}' statt 'grc_worker' (S01-09). ` +
            `SUPERUSER bringt COPY … TO PROGRAM, ALTER SYSTEM und Eigentümerrechte mit — nichts davon braucht ein Cron-Job.`,
        );
      } else {
        notes.push(`${rel} · ${name}: DATABASE_URL = grc_worker`);
      }
      if (appUrl) {
        errors.push(
          `${rel} · ${name}: deklariert APP_DATABASE_URL (${appUrl}). Der Dienst fährt org-übergreifende Systemjobs; unter einer RLS-gefilterten Rolle ohne Org-Kontext täte er still nichts.`,
        );
      }
    }

    // ── Regel 5: Superuser nur in benannten Ausnahmen ─────────────────
    if (dbUrl && roleOf(dbUrl) === "grc" && !(name in SUPERUSER_ALLOWED)) {
      errors.push(
        `${rel} · ${name}: DATABASE_URL verbindet als Superuser 'grc'. Erlaubt ist das nur für: ${Object.keys(
          SUPERUSER_ALLOWED,
        ).join(", ")}.`,
      );
    }
  }

  // ── Regel 6 (OP-091): Passwörter in DB-URLs sind :?-pflichtig ───────
  // Gesucht wird in der ganzen Datei, nicht nur in Diensten: auch ein
  // healthcheck oder ein command kann eine URL tragen.
  const urlLines = text
    .split("\n")
    .filter((l) => /postgres(?:ql)?:\/\//.test(l) && !l.trim().startsWith("#"));
  for (const l of urlLines) {
    for (const m of l.matchAll(
      /postgres(?:ql)?:\/\/[A-Za-z0-9_]+:\$\{([A-Z_0-9]+)(:[-?][^}]*)?\}/g,
    )) {
      const [, varName, guard] = m;
      if (!guard || !guard.startsWith(":?")) {
        errors.push(
          `${rel}: \${${varName}${guard ?? ""}} liefert ein DB-Passwort ohne :?-Pflichtprüfung. ` +
            `Compose SETZT die Variable dann leer — es entsteht kein Fallback, sondern ein gültig aussehender URL mit leerem Passwort (S01-11/S08-17).`,
        );
      }
    }
  }
}

if (errors.length) {
  console.error(
    `\n✗ ${errors.length} Verstoß/Verstöße gegen die Rollentrennung im Deployment:\n`,
  );
  for (const e of errors) console.error(`    ${e}`);
  console.error("");
  process.exit(1);
}

console.log("✓ Rollentrennung im Deployment in Ordnung:");
for (const n of notes) console.log(`    ${n}`);
