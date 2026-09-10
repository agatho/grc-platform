#!/usr/bin/env node
// ============================================================================
// [ARCTOS-FULL-2026-08-31 · OP-259] Was der eine Dienst schreibt und der
// andere liest, muss auf einem gemeinsamen Volume liegen
// ============================================================================
//
// `packages/reporting/src/generator.ts` schreibt den Report und legt den
// ABSOLUTEN Pfad in `report_generation_log.file_path`. Die Download-Route
// `apps/web/.../reports/jobs/[id]/download/route.ts:52` macht darauf
// `fs.readFile(log.filePath)`. Erzeugt wird im Worker, ausgeliefert von `web`.
//
// Ohne gemeinsames Volume ist das genau so lange richtig, wie beide Dienste
// derselbe Prozess sind. In `docker-compose.production.yml` sind sie es nicht:
// beide haben `read_only: true` und je ein EIGENES `tmpfs: - /tmp`. Der
// Vorgabewert von `REPORT_OUTPUT_DIR` ist `os.tmpdir()/arctos-reports` — also
// container-privat. Jeder Download eines geplanten Reports endet in
// Produktion mit ENOENT, und beim Neustart ist die Datei ohnehin weg.
//
// `uploads` macht es seit jeher richtig vor: dasselbe benannte Volume in
// beiden Diensten, dazu `UPLOAD_DIR` in beiden gesetzt. Diese Pruefung haelt
// fest, dass jeder so geteilte Pfad diese drei Bedingungen erfuellt.
// ============================================================================

import { existsSync, readFileSync } from "node:fs";
import yaml from "js-yaml";

// Umgebungsvariable → das benannte Volume, auf dem ihr Pfad liegen muss.
// Neuer geteilter Pfad? Hier eintragen.
const GETEILTE_PFADE = [
  { env: "UPLOAD_DIR", volume: "uploads", dienste: ["web", "worker"] },
  { env: "REPORT_OUTPUT_DIR", volume: "reports", dienste: ["web", "worker"] },
];

const DATEIEN = ["docker-compose.production.yml", "deploy/docker-compose.yml"];

const befunde = [];
let geprueft = 0;

for (const datei of DATEIEN) {
  if (!existsSync(datei)) {
    befunde.push(`${datei} fehlt — ohne sie prueft dieser Check nichts.`);
    continue;
  }
  // `json: false` heisst: doppelte Schluessel sind ein FEHLER, nicht der
  // stillschweigend behaltene letzte. Genau so ist OP-260 aufgefallen —
  // `TRUSTED_PROXY_HOPS` stand zweimal im selben `environment:`-Block. Der
  // Wert war beide Male derselbe, die Wirkung also keine; gefaehrlich war die
  // Anlage. Dieselbe Klasse wie OP-239 in `ci.yml`, nur pruefte sie dort
  // `check-workflow-yaml.mjs` und hier bis heute niemand.
  let doc;
  try {
    doc = yaml.load(readFileSync(datei, "utf8"), { json: false });
  } catch (e) {
    befunde.push(
      `${datei}: YAML nicht ladbar — ${e.reason ?? e.message}` +
        (e.mark ? ` (Zeile ${e.mark.line + 1})` : ""),
    );
    continue;
  }
  const services = doc?.services ?? {};
  const volumes = doc?.volumes ?? {};

  for (const { env, volume, dienste } of GETEILTE_PFADE) {
    geprueft++;

    if (!(volume in volumes)) {
      befunde.push(
        `${datei}: das benannte Volume \`${volume}\` ist nicht deklariert, ` +
          `wird aber fuer \`${env}\` gebraucht.`,
      );
    }

    for (const name of dienste) {
      const svc = services[name];
      if (!svc) {
        befunde.push(`${datei}: Dienst \`${name}\` fehlt.`);
        continue;
      }

      const mounts = (svc.volumes ?? []).map(String);
      const mount = mounts.find((m) => m.split(":")[0] === volume);
      if (!mount) {
        befunde.push(
          `${datei}: Dienst \`${name}\` mountet \`${volume}\` nicht. ` +
            `Was ${dienste.join(" und ")} sich teilen, muss in BEIDEN stehen ` +
            `— sonst schreibt der eine in sein eigenes Dateisystem (OP-259).`,
        );
        continue;
      }

      const ziel = mount.split(":")[1];
      const wert = svc.environment?.[env];
      if (wert == null) {
        befunde.push(
          `${datei}: Dienst \`${name}\` setzt \`${env}\` nicht. Ohne die ` +
            `Variable faellt der Code auf einen container-privaten Vorgabewert ` +
            `zurueck, und das Volume darueber ist wirkungslos.`,
        );
        continue;
      }

      // `${VAR:-/app/reports}` → der Vorgabewert ist das, was ohne .env gilt.
      const vorgabe = String(wert).replace(/^\$\{[^:}]+:-(.*)\}$/, "$1");
      if (!vorgabe.startsWith(ziel)) {
        befunde.push(
          `${datei}: Dienst \`${name}\` setzt \`${env}=${vorgabe}\`, das Volume ` +
            `\`${volume}\` haengt aber unter \`${ziel}\`. Der Pfad liegt damit ` +
            `NICHT auf dem gemeinsamen Volume.`,
        );
      }
    }
  }
}

console.log(
  `Geteilte Pfade: ${geprueft} Kombination(en) aus Variable und Dienst geprueft.`,
);
if (befunde.length > 0) {
  console.error("\n✗ Geteilte Pfade zwischen den Diensten:\n");
  for (const b of befunde) console.error(`  - ${b}`);
  console.error("");
  process.exit(1);
}
console.log(
  "\n✓ Jeder geteilte Pfad liegt in beiden Diensten auf demselben Volume.",
);
