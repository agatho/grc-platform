#!/usr/bin/env node
// ============================================================================
// #S13-10 (WP10) — Startup-Validierung der Pflicht-Konfiguration.
//
// Ausgangslage laut Audit: es gab KEINE. Ein Operator, der über
// `deploy/docker-compose.yml`, ein eigenes k8s-Manifest oder `docker run` nur
// `DATABASE_URL` setzte, bekam eine Installation, die normal startete,
// `/api/v1/health` mit 200 beantwortete und jede Anfrage als Superuser `grc`
// (BYPASSRLS) ausführte — jeder Mandant sah die Daten jedes anderen, ohne
// irgendein Signal.
//
// WP2 hat die Hälfte davon geschlossen: `assertRuntimeRoleIsolation()` in
// `packages/db/src/index.ts` beendet den Prozess, wenn der Laufzeit-Pool
// privilegiert verbindet. Das greift aber erst NACH dem ersten
// Verbindungsaufbau und deckt nur die Datenbankrolle ab. Dieses Skript ist
// die vorgelagerte Hälfte: es läuft VOR dem Anwendungsstart im Entrypoint,
// braucht keine Datenbank und prüft die übrigen Pflichtvariablen.
//
// Aufruf (Entrypoint, siehe scripts/prestart.sh):
//   node scripts/assert-runtime-config.mjs --role web|worker
//
// Ausserhalb von NODE_ENV=production wird gewarnt statt beendet.
// ============================================================================

const roleArg = process.argv.indexOf("--role");
const ROLE =
  roleArg >= 0 ? process.argv[roleArg + 1] : (process.env.ARCTOS_ROLE ?? "web");
const PROD = process.env.NODE_ENV === "production";

const HEX = (n) => new RegExp(`^[0-9a-fA-F]{${n * 2}}$`);
// Nur auf Geheimniswerte anwenden — eine URL darf "example" enthalten.
const isPlaceholder = (v) =>
  /generate-|generate a |change[-_ ]?me|placeholder|do-not-use|^<.*>$|^\s*$/i.test(
    v ?? "",
  );
const isSecretName = (name) =>
  /(SECRET|KEY|PASSWORD|TOKEN|CREDENTIAL|DATABASE_URL)/.test(name);

/**
 * @type {Array<{
 *   name: string, roles: string[], why: string,
 *   validate?: (v: string) => string | null,
 *   requiredIf?: () => boolean,
 * }>}
 */
const RULES = [
  {
    name: "DATABASE_URL",
    roles: ["web", "worker"],
    why: "Migrations-/Provisionierungsverbindung (Superuser grc).",
    validate: (v) =>
      /^postgres(ql)?:\/\//.test(v) ? null : "keine postgres://-URL",
  },
  {
    name: "APP_DATABASE_URL",
    roles: ["web"],
    why:
      "Laufzeit-Pool der Web-App. Fehlt sie, fällt der Code auf DATABASE_URL " +
      "(Superuser, BYPASSRLS) zurück und RLS ist wirkungslos (#S13-09/#S13-10).",
    validate: (v) => {
      if (!/^postgres(ql)?:\/\//.test(v)) return "keine postgres://-URL";
      if (/^postgres(ql)?:\/\/grc:/.test(v))
        return "zeigt auf den Superuser grc — RLS wäre umgangen";
      const m = /^postgres(ql)?:\/\/[^:/@]+:([^@]*)@/.exec(v);
      if (m && m[2] === "")
        return "leeres Passwort (GRC_APP_PASSWORD nicht gesetzt) — die Verbindung schlägt fehl";
      return null;
    },
  },
  {
    name: "AUTH_SECRET",
    roles: ["web"],
    why: "Signaturschlüssel der Sitzungen (Auth.js).",
    validate: (v) => (v.length >= 32 ? null : "kürzer als 32 Zeichen"),
  },
  {
    name: "CRON_SECRET",
    roles: ["web", "worker"],
    why: "Shared Secret der /crons/*-Endpunkte am Worker.",
    validate: (v) => (v.length >= 16 ? null : "kürzer als 16 Zeichen"),
  },
  {
    name: "AUDIT_SEAL_KEY",
    roles: ["web", "worker"],
    why:
      "HMAC-Siegel der Audit-Anker (WP4/S03-01). Ohne ihn sind die Anker " +
      "verkettet, aber nicht signiert — die Kette leistet dann " +
      "Integritätsprüfung, keine Tamper-Evidence gegen einen Datenbank-Superuser.",
    validate: (v) =>
      HEX(32).test(v)
        ? null
        : "kein 64-stelliger Hex-Wert (openssl rand -hex 32)",
  },
  {
    name: "PII_PSEUDONYM_KEY",
    roles: ["web", "worker"],
    why:
      "HMAC-Schlüssel der Pseudonymisierung im Audit-Trail (WP8/S07-03). Ohne " +
      "ihn greift ein Installationsschlüssel IN der Datenbank — das " +
      "'zusätzliche Wissen' nach Art. 4 Nr. 5 DSGVO läge dann im selben Dump " +
      "wie die pseudonymisierten Daten.",
    validate: (v) =>
      HEX(32).test(v)
        ? null
        : "kein 64-stelliger Hex-Wert (openssl rand -hex 32)",
  },
  {
    name: "WB_ENCRYPTION_KEY",
    roles: ["web", "worker"],
    why: "AES-256-GCM der Hinweisgebermeldungen (HinSchG).",
    validate: (v) => (HEX(32).test(v) ? null : "kein 64-stelliger Hex-Wert"),
  },
  {
    name: "CONNECTOR_ENCRYPTION_KEY",
    roles: ["web", "worker"],
    why: "Verschlüsselung gespeicherter Connector-Zugangsdaten.",
    validate: (v) => (HEX(32).test(v) ? null : "kein 64-stelliger Hex-Wert"),
  },
  {
    name: "SECRET_ENCRYPTION_KEY",
    roles: ["web", "worker"],
    why: "Verschlüsselung einzelner Secret-Spalten (SSO/OIDC, OAuth-Refresh).",
    validate: (v) =>
      v.length >= 32 ? null : "zu kurz (32 Byte als Hex oder Base64 erwartet)",
  },
  {
    name: "REDIS_URL",
    roles: ["web"],
    why:
      "Gemeinsames Backend des Rate Limitings (WP9/S10-05). Ohne Redis ist der " +
      "Limiter prozesslokal: bei N Web-Containern ist das effektive Limit " +
      "N × capacity und jeder Neustart hebt einen Login-Lockout auf.",
    validate: (v) => (/^rediss?:\/\//.test(v) ? null : "keine redis://-URL"),
  },
  {
    name: "GRC_WORKER_PASSWORD",
    roles: ["worker"],
    why:
      "Passwort der Worker-Rolle grc_worker (WP2/S01-09, BYPASSRLS ohne " +
      "SUPERUSER). deploy/provision-grc-app.sh muss damit gelaufen sein.",
  },
  {
    name: "AUTH_URL",
    roles: ["web"],
    why: "Öffentliche Basis-URL für SSO-/SCIM-/SAML-Callbacks.",
    validate: (v) =>
      PROD && !/^https:\/\//.test(v)
        ? "in Produktion muss die Basis-URL https sein"
        : null,
    requiredIf: () => !process.env.NEXTAUTH_URL,
  },
];

// Zusatzregeln, die keine einzelne Variable prüfen, sondern eine Kombination.
const CROSS_RULES = [
  {
    check: () =>
      process.env.STORAGE_BACKEND === "s3" &&
      !(
        process.env.S3_BUCKET &&
        process.env.S3_ACCESS_KEY_ID &&
        process.env.S3_SECRET_ACCESS_KEY
      ),
    message:
      "STORAGE_BACKEND=s3, aber S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY " +
      "sind unvollständig — jeder DMS-Upload würde fehlschlagen.",
    roles: ["web", "worker"],
  },
  {
    check: () =>
      (process.env.STORAGE_BACKEND ?? "local") === "local" &&
      !process.env.UPLOAD_DIR,
    message:
      "STORAGE_BACKEND=local ohne UPLOAD_DIR: die DMS-Dateien landen im " +
      "Container-Dateisystem und sind beim nächsten `docker compose up -d` weg " +
      "(#S13-09b). UPLOAD_DIR setzen und als Volume mounten.",
    roles: ["web"],
    warnOnly: true,
  },
  {
    check: () =>
      ROLE === "web" && process.env.ARCTOS_ALLOW_PRIVILEGED_DB === "true",
    message:
      "ARCTOS_ALLOW_PRIVILEGED_DB=true ist für die WEB-App gesetzt. Diese " +
      "Ausnahme ist ausschliesslich für den Worker gedacht; für die Web-App " +
      "hebt sie die Mandantentrennung auf (#S01-10).",
    roles: ["web"],
  },
  {
    check: () =>
      process.env.ALLOW_DEMO_SEED_IN_PROD === "true" ||
      process.env.SEED_DEMO_DATA === "true",
    message:
      "Demo-Seed in Produktion aktiviert (ALLOW_DEMO_SEED_IN_PROD / " +
      "SEED_DEMO_DATA). Der Seed legt Konten mit öffentlich bekannten " +
      "Passwörtern an (#SEC-F04, #S13-09e).",
    roles: ["web", "worker"],
  },
];

const errors = [];
const warnings = [];

for (const rule of RULES) {
  if (!rule.roles.includes(ROLE)) continue;
  if (rule.requiredIf && !rule.requiredIf()) continue;
  const value = process.env[rule.name];
  if (value === undefined || value === "") {
    errors.push(`${rule.name} ist nicht gesetzt. ${rule.why}`);
    continue;
  }
  if (isSecretName(rule.name) && isPlaceholder(value)) {
    errors.push(
      `${rule.name} trägt noch den Platzhalterwert aus .env.example ("${value.slice(0, 24)}…"). ` +
        rule.why,
    );
    continue;
  }
  const problem = rule.validate?.(value);
  if (problem) errors.push(`${rule.name}: ${problem}. ${rule.why}`);
}

for (const rule of CROSS_RULES) {
  if (!rule.roles.includes(ROLE)) continue;
  let hit = false;
  try {
    hit = rule.check();
  } catch {
    hit = false;
  }
  if (!hit) continue;
  (rule.warnOnly ? warnings : errors).push(rule.message);
}

const label = `[config:${ROLE}]`;
for (const w of warnings) console.warn(`${label} WARNUNG: ${w}`);

if (!errors.length) {
  console.log(
    `${label} Pflichtkonfiguration vollständig (${RULES.filter((r) => r.roles.includes(ROLE)).length} Variablen geprüft).`,
  );
  process.exit(0);
}

const header = PROD
  ? `${label} FATAL: die Pflichtkonfiguration ist unvollständig — der Start wird abgebrochen.`
  : `${label} WARNUNG: die Pflichtkonfiguration ist unvollständig (ausserhalb NODE_ENV=production nicht fatal).`;
console.error(header);
for (const e of errors) console.error(`  ✗ ${e}`);
console.error(
  `${label} Referenz: .env.example, docs/env-vars-reference.md und ` +
    `docs/runbook.md §1 "Pflicht-Betriebsvariablen".`,
);
process.exit(PROD ? 78 : 0); // 78 = EX_CONFIG (sysexits.h)
