#!/usr/bin/env node
// ============================================================================
// Security-Audit-Gate (CI) — ersetzt das nackte `npm audit --audit-level=high`.
//
// Motivation (2026-07-23): Upstream-Advisories ohne non-breaking Fix (z. B.
// die Next.js-Batch-Disclosure GHSA-m99w-… mit Fix erst in Next 16) machten
// die CI dauerhaft rot, ohne dass ein sinnvoller sofortiger Fix existiert.
// Dieses Gate failt weiterhin bei JEDEM neuen high/critical-Advisory in
// Produktions-Dependencies — außer es steht mit GHSA-ID, PAKETNAME,
// Begründung und ABLAUFDATUM in der Allowlist unten. Abgelaufene Einträge
// failen wieder.
//
// #S08-06 (WP10, Audit 2026-08-31) — drei Defekte behoben:
//   1. Die Allowlist wurde nur nach GHSA-ID abgeglichen. Ein für ein
//      Build-Tool akzeptiertes Advisory legte damit dasselbe Advisory auch
//      dann still, wenn das Paket später an produktiver Stelle auftauchte —
//      genau der eingetretene brace-expansion-Fall. `package` ist jetzt ein
//      PFLICHTFELD und wird mitgeprüft.
//   2. Die Behauptung "nicht im Runtime-Pfad" stand als Fließtext in einem
//      Kommentar und war nachweislich falsch. Sie wird jetzt MASCHINELL aus
//      `npm ls <pkg> --omit=dev` abgeleitet: steht das Paket im
//      Produktionsbaum, ist `runtimeClaim: "not-in-runtime-path"` ein
//      HARTER FEHLER, kein Kommentar.
//   3. Der Kopfkommentar behauptete "Aktuell leer", während die Liste einen
//      Eintrag trug. Die Liste ist jetzt tatsächlich leer — alle zum
//      Auditzeitpunkt offenen Advisories sind durch Versions-Upgrades und
//      `overrides` in der Root-package.json geschlossen (siehe WP10.md).
//
// Pflege: Eintrag nur mit `package` + `ghsa` + `reason` + realistischem
// `until` ergänzen; die Liste ist bewusst im Repo sichtbar (git blame).
// ============================================================================
import { execSync } from "node:child_process";

/**
 * @typedef {object} AllowlistEntry
 * @property {string}  package  Betroffenes npm-Paket (PFLICHT, wird geprüft).
 * @property {string}  ghsa     GHSA-ID des Advisories (PFLICHT).
 * @property {string}  reason   Fachliche Begründung der Risikoakzeptanz.
 * @property {string}  until    ISO-Datum, ab dem der Eintrag wieder failt.
 * @property {"not-in-runtime-path"|"accepted-in-runtime-path"} [runtimeClaim]
 *   "not-in-runtime-path" wird gegen `npm ls --omit=dev` verifiziert und
 *   schlägt fehl, wenn das Paket doch im Produktionsbaum steht.
 */

/** @type {AllowlistEntry[]} */
const ALLOWLIST = [];

const REQUIRED_FIELDS = ["package", "ghsa", "reason", "until"];
const today = new Date().toISOString().slice(0, 10);
const configErrors = [];

for (const [i, entry] of ALLOWLIST.entries()) {
  for (const f of REQUIRED_FIELDS) {
    if (typeof entry?.[f] !== "string" || entry[f].trim() === "") {
      configErrors.push(`ALLOWLIST[${i}]: Pflichtfeld "${f}" fehlt oder leer.`);
    }
  }
  if (
    entry?.runtimeClaim &&
    !["not-in-runtime-path", "accepted-in-runtime-path"].includes(
      entry.runtimeClaim,
    )
  ) {
    configErrors.push(
      `ALLOWLIST[${i}] (${entry.package}): unbekannter runtimeClaim "${entry.runtimeClaim}".`,
    );
  }
}

/** Steht das Paket im Produktionsbaum? Maschinell, nicht behauptet. */
function isInProductionTree(pkg) {
  try {
    const out = execSync(
      `npm ls ${JSON.stringify(pkg)} --omit=dev --all --json`,
      {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    return JSON.stringify(JSON.parse(out)).includes(`"${pkg}"`);
  } catch (e) {
    // `npm ls` exitet != 0 bei "extraneous"/"invalid" — stdout bleibt gültig.
    const out = e?.stdout;
    if (!out) return true; // im Zweifel als produktiv behandeln (fail-closed)
    try {
      return JSON.stringify(JSON.parse(out)).includes(`"${pkg}"`);
    } catch {
      return true;
    }
  }
}

for (const entry of ALLOWLIST) {
  if (entry.runtimeClaim !== "not-in-runtime-path") continue;
  if (isInProductionTree(entry.package)) {
    configErrors.push(
      `ALLOWLIST (${entry.package}/${entry.ghsa}): runtimeClaim "not-in-runtime-path" ist ` +
        `FALSCH — das Paket steht laut \`npm ls ${entry.package} --omit=dev\` im ` +
        `Produktionsbaum. Begründung korrigieren oder Advisory beheben.`,
    );
  }
}

if (configErrors.length) {
  console.error("audit-gate: Allowlist-Konfiguration ungültig:");
  for (const c of configErrors) console.error(`  ✗ ${c}`);
  process.exit(2);
}

let auditJson;
try {
  auditJson = execSync("npm audit --omit=dev --json", {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
} catch (e) {
  // npm audit exitet != 0 bei Findings — stdout enthält trotzdem das JSON.
  auditJson = e.stdout;
}

const report = JSON.parse(auditJson);
const vulns = report.vulnerabilities ?? {};
const failures = [];
const allowed = [];

for (const [pkg, info] of Object.entries(vulns)) {
  if (!["high", "critical"].includes(info.severity)) continue;
  for (const via of info.via ?? []) {
    if (typeof via !== "object" || !via.url) continue; // transitive Verweise
    if (!["high", "critical"].includes(via.severity)) continue;
    const ghsa = (via.url.match(/GHSA-[a-z0-9-]+/i) ?? [null])[0];
    // #S08-06: Paket UND GHSA müssen übereinstimmen. `via.name` ist das
    // tatsächlich verwundbare Paket; `pkg` der Knoten, an dem npm es meldet.
    const affected = via.name ?? pkg;
    const entry = ALLOWLIST.find(
      (a) => a.ghsa === ghsa && (a.package === affected || a.package === pkg),
    );
    if (entry && entry.until >= today) {
      allowed.push(
        `${pkg}: ${ghsa} (${via.title}) — bis ${entry.until}: ${entry.reason}`,
      );
    } else if (entry) {
      failures.push(
        `${pkg}: ${ghsa} — Allowlist-Eintrag ABGELAUFEN (${entry.until}): ${via.title}`,
      );
    } else {
      const sameGhsaOtherPkg = ALLOWLIST.find((a) => a.ghsa === ghsa);
      const hint = sameGhsaOtherPkg
        ? ` (Allowlist kennt ${ghsa} nur für "${sameGhsaOtherPkg.package}", hier betroffen: "${affected}")`
        : "";
      failures.push(
        `${pkg}: ${ghsa ?? via.url} [${via.severity}] ${via.title}${hint}`,
      );
    }
  }
}

if (allowed.length) {
  console.log(`Allowlisted (${allowed.length}):`);
  for (const a of [...new Set(allowed)]) console.log(`  ~ ${a}`);
}
if (failures.length) {
  console.error(
    `\nNicht-allowlistete high/critical-Advisories (${failures.length}):`,
  );
  for (const f of [...new Set(failures)]) console.error(`  ✗ ${f}`);
  console.error(
    "\nFix einspielen oder — nur mit Paketname, Begründung und Ablaufdatum — " +
      "in scripts/audit-gate.mjs allowlisten.",
  );
  process.exit(1);
}
console.log(
  "audit-gate: OK (keine neuen high/critical-Advisories in Produktions-Dependencies)",
);
