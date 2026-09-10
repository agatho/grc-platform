#!/usr/bin/env node
// ============================================================================
// #S13-28 / #S13-10 / #S08-18 (WP10) — `.env.example` gegen die Realität.
//
// Zum Auditzeitpunkt deckte `.env.example` 49 tatsächlich gelesene
// Umgebungsvariablen nicht ab, `APP_DATABASE_URL` — die einzige Variable, die
// RLS überhaupt aktiviert — war auskommentiert ausgeliefert, und
// `CRON_SECRET` trug einen konkreten Wert, der wie ein benutzbares Secret
// aussieht statt wie ein Platzhalter.
//
// Dieses Skript prüft drei Dinge und failt bei jedem Verstoss:
//
//   1. VOLLSTÄNDIGKEIT — jede in `apps/*/src` und `packages/*/src` gelesene
//      `process.env.X` steht in `.env.example` (auskommentiert genügt für
//      optionale Werte).
//   2. PFLICHTVARIABLEN — die Betriebsvariablen, ohne die eine Komponente
//      bewusst nicht mehr startet, stehen UNAUSKOMMENTIERT drin, damit ein
//      kopiertes `.env` sie enthält.
//   3. KEINE ECHT AUSSEHENDEN WERTE — ein Platzhalter darf nicht wie ein Wert
//      aussehen (#S08-18: `CRON_SECRET=arctos-cron-secret-change-in-production`
//      wurde von Hand kopiert und deployt).
//
// Aufruf: node scripts/check-env-example.mjs
// ============================================================================
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const ENV_EXAMPLE = join(ROOT, ".env.example");

// Ohne diese Variablen darf eine Produktionsinstanz nicht starten. Sie sind
// in docker-compose.production.yml mit `${VAR:?…}` erzwungen und werden von
// scripts/assert-runtime-config.mjs beim Start geprüft.
const REQUIRED_UNCOMMENTED = [
  "DATABASE_URL",
  "APP_DATABASE_URL", // #S13-09/#S13-10: ohne sie läuft alles als Superuser, RLS aus
  "GRC_APP_PASSWORD",
  "GRC_WORKER_PASSWORD", // WP2/S01-09
  "AUTH_SECRET",
  "AUTH_URL",
  "CRON_SECRET",
  "AUDIT_SEAL_KEY", // WP4/S03-01
  "PII_PSEUDONYM_KEY", // WP8/S07-03
  "WB_ENCRYPTION_KEY",
  "CONNECTOR_ENCRYPTION_KEY",
  "SECRET_ENCRYPTION_KEY",
  "REDIS_URL", // WP9/S10-05: ohne Redis ist das Rate Limit prozesslokal
  "TRUSTED_PROXY_HOPS",
  "STORAGE_BACKEND",
];

// Werte, die wie ein benutzbares Secret aussehen. Ein Platzhalter muss sich
// selbst als solcher zu erkennen geben.
const PLACEHOLDER_OK =
  /^$|generate|change[-_ ]?me|<.*>|example|placeholder|localhost|127\.0\.0\.1|^(true|false|[0-9]+([./][0-9]+)*)$|^[a-z0-9-]+:\/\/|@localhost|^k1$|^default$|^local$|^auto$|arctos\.local|^noreply@|^ARCTOS |^redis:/i;

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".next" || name === "dist")
      continue;
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(p);
  }
  return out;
}

if (!existsSync(ENV_EXAMPLE)) {
  console.error("✗ .env.example fehlt.");
  process.exit(1);
}

const exampleText = readFileSync(ENV_EXAMPLE, "utf8");
const declared = new Map(); // NAME -> { commented, value }
for (const line of exampleText.split(/\r?\n/)) {
  const m = /^(\s*#\s*)?([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
  if (!m) continue;
  const [, hash, name, value] = m;
  const commented = Boolean(hash);
  // Eine unauskommentierte Deklaration gewinnt gegenüber einer kommentierten.
  const prev = declared.get(name);
  if (!prev || (prev.commented && !commented)) {
    declared.set(name, { commented, value: value.trim() });
  }
}

const srcRoots = [
  join(ROOT, "apps", "web", "src"),
  join(ROOT, "apps", "worker", "src"),
  ...readdirSync(join(ROOT, "packages"))
    .map((p) => join(ROOT, "packages", p, "src"))
    .filter((p) => existsSync(p)),
];

const used = new Map(); // NAME -> Set<file>
const RE =
  /process\.env(?:\.([A-Z][A-Z0-9_]*)|\[\s*["'`]([A-Z][A-Z0-9_]*)["'`]\s*\])/g;
for (const root of srcRoots) {
  for (const file of walk(root)) {
    const text = readFileSync(file, "utf8");
    let m;
    while ((m = RE.exec(text))) {
      const name = m[1] ?? m[2];
      if (!used.has(name)) used.set(name, new Set());
      used.get(name).add(file.replace(ROOT + "/", ""));
    }
  }
}

// `NODE_ENV` wird von der Laufzeit gesetzt und gehört ausdrücklich NICHT in
// ein .env-File (Next 16 bricht sonst den Build) — der Kommentar in
// .env.example erklärt das bereits.
const NOT_IN_ENV_FILE = new Set(["NODE_ENV"]);

const failures = [];

// 1. Vollständigkeit
const missing = [...used.keys()]
  .filter((n) => !declared.has(n) && !NOT_IN_ENV_FILE.has(n))
  .sort();
for (const n of missing) {
  failures.push(
    `${n}: wird gelesen (${[...used.get(n)].slice(0, 2).join(", ")}), fehlt aber in .env.example.`,
  );
}

// 2. Pflichtvariablen
for (const n of REQUIRED_UNCOMMENTED) {
  const d = declared.get(n);
  if (!d) {
    failures.push(`${n}: Pflichtvariable fehlt vollständig in .env.example.`);
  } else if (d.commented) {
    failures.push(
      `${n}: Pflichtvariable ist AUSKOMMENTIERT. Wer .env.example kopiert, ` +
        `bekommt eine Installation ohne diesen Wert (#S13-28).`,
    );
  }
}

// 3. Platzhalter dürfen nicht wie Werte aussehen
for (const [name, d] of declared) {
  if (d.commented) continue;
  if (!/(SECRET|KEY|PASSWORD|TOKEN|CREDENTIAL)/.test(name)) continue;
  if (
    name.endsWith("_ID") ||
    name.endsWith("_ENABLED") ||
    name.endsWith("_HOPS")
  )
    continue;
  if (!PLACEHOLDER_OK.test(d.value)) {
    failures.push(
      `${name}="${d.value}" sieht wie ein benutzbarer Wert aus, nicht wie ein ` +
        `Platzhalter. Wer die Datei von Hand kopiert, deployt ihn (#S08-18). ` +
        `Formulierung wie "generate-with-openssl-rand-hex-32" verwenden.`,
    );
  }
}

console.log(
  `.env.example: ${declared.size} Variablen deklariert, ${used.size} im Quellcode gelesen.`,
);
if (failures.length) {
  console.error(
    `\n✗ .env.example ist unvollständig oder irreführend (${failures.length}):`,
  );
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(
  "✓ Alle gelesenen Variablen dokumentiert, alle Pflichtvariablen unauskommentiert, " +
    "kein Platzhalter, der wie ein Wert aussieht.",
);
