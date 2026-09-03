#!/usr/bin/env node
// ============================================================================
// [ARCTOS-FULL-2026-08-31 · OP-066] Wächter über die Eingaben der Tore.
//
// Zweimal in diesem Repository ist dieselbe Sache passiert: eine Datei, von
// der ein CI-Tor annimmt, sie stehe im Repository, war durch `.gitignore`
// ausgeschlossen.
//
//   - C-15: `**/coverage/` hob die Ausnahme für die API-Routen unter
//     `api/v1/**/coverage/` auf; drei Routen verschwanden aus dem Repository
//     und niemand merkte es, bis ein Produktionsbau 404 antwortete.
//   - OP-066: `coverage/coverage-baseline.json` war nie eingecheckt, weil
//     dieselben zwei Zeilen die Ausnahme darüber aufhoben. Der Schritt
//     „Coverage ratchet" lief damit in jedem CI-Lauf in ein `exit 1`.
//
// Beide Male war die Ursache dieselbe Mechanik: in `.gitignore` gewinnt die
// zuletzt passende Regel, und eine Datei lässt sich nicht wieder
// einschliessen, wenn ihr Verzeichnis ausgeschlossen ist. Beide Male hat es
// niemand bemerkt, weil nichts danach gesehen hat.
//
// Dieses Skript sieht danach. Es prüft für jede Datei, die ein Tor als
// eingecheckten Stand liest: sie existiert, sie ist von git verfolgt, und sie
// ist nicht ignoriert. Das ist billig und fängt die Klasse.
//
// Aufruf: node scripts/check-gate-inputs.mjs
// ============================================================================
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());

/** Datei → welches Tor sie liest. Neue Ratsche? Hier eintragen. */
const GATE_INPUTS = [
  [".eslint-ratchet.json", "scripts/lint-ratchet.mjs (Lint-Ratsche)"],
  [".coverage-ratchet.json", "scripts/coverage-gate.mjs (Coverage-Ratsche)"],
  [".env.example", "scripts/check-env-example.mjs"],
  ["scripts/db-integrity-baseline.json", "DB-Integritätsprüfung"],
  [
    "scripts/route-rls-context-baseline.txt",
    "scripts/check-route-rls-context.mjs",
  ],
  // [ARCTOS-FULL-2026-08-31 · OP-090] Beide Compose-Dateien sind Eingabe eines
  // Tors, nicht nur Deployment-Artefakt. Verschwindet eine (Umbenennung,
  // .gitignore), meldete `check-compose-db-roles.mjs` bisher „Datei nicht
  // gefunden" — laut, aber erst im CI. Hier faellt es eine Stufe frueher auf.
  ["docker-compose.production.yml", "scripts/check-compose-db-roles.mjs"],
  ["deploy/docker-compose.yml", "scripts/check-compose-db-roles.mjs"],
];

function git(args) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

const failures = [];

for (const [file, gate] of GATE_INPUTS) {
  if (!existsSync(resolve(ROOT, file))) {
    failures.push(`${file} fehlt auf der Platte — gelesen von ${gate}.`);
    continue;
  }
  let tracked = true;
  try {
    git(["ls-files", "--error-unmatch", file]);
  } catch {
    tracked = false;
  }
  if (!tracked) {
    let reason = "";
    try {
      reason = git(["check-ignore", "-v", file]);
    } catch {
      /* nicht ignoriert, nur nicht hinzugefügt */
    }
    failures.push(
      `${file} ist NICHT von git verfolgt — gelesen von ${gate}.\n` +
        (reason
          ? `      ausgeschlossen durch: ${reason}\n` +
            "      In .gitignore gewinnt die ZULETZT passende Regel; ein\n" +
            "      ausgeschlossenes Verzeichnis lässt sich nicht über eine Datei\n" +
            "      darin wieder einschliessen. Die Datei gehört ausserhalb des\n" +
            "      Artefaktverzeichnisses, nicht in eine weitere Ausnahme.\n"
          : "      Nicht ignoriert, aber auch nicht hinzugefügt — `git add` fehlt.\n"),
    );
  }
}

// ---------------------------------------------------------------------------
// [ARCTOS-FULL-2026-08-31 · Welle 3, Abnahme] Die Sperrdatei muss sagen, was
// die Manifeste sagen.
//
// Gefunden beim Verifizieren von Welle 2: `packages/shared/package.json` bekam
// `"@grc/bpmn": "^0.1.0"`, und `package-lock.json` wurde nicht neu erzeugt.
// Der Fund ist deshalb interessant, weil `npm ci --dry-run` das NICHT
// bemerkt hat — in einem Workspace-Baum löst der fehlende Eintrag sich über
// die gehobene Wurzel trotzdem auf, und die Installation läuft durch. Die
// Sperrdatei behauptet dann etwas anderes als das Manifest, und der Tag, an
// dem das auffällt, ist der Tag, an dem jemand das Paket einzeln
// installiert oder ein Werkzeug den Baum aus dem Lock rekonstruiert.
//
// Geprüft wird deshalb direkt: für jedes Workspace-Manifest muss der Block
// unter `packages/<pfad>` in der Sperrdatei dieselben Abhängigkeiten führen.
// ---------------------------------------------------------------------------
{
  const lockPath = resolve(ROOT, "package-lock.json");
  if (existsSync(lockPath)) {
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    const workspaces = git(["ls-files", "*/package.json", "*/*/package.json"])
      .split("\n")
      .filter(Boolean)
      .filter((p) => !p.includes("node_modules/"));

    for (const manifestPath of workspaces) {
      const dir = manifestPath.replace(/\/package\.json$/, "");
      const entry = lock.packages?.[dir];
      if (!entry) {
        failures.push(
          `${manifestPath} hat keinen Eintrag "${dir}" in package-lock.json.\n` +
            "      `npm install --package-lock-only` erzeugt ihn.\n",
        );
        continue;
      }
      const manifest = JSON.parse(
        readFileSync(resolve(ROOT, manifestPath), "utf8"),
      );
      for (const feld of ["dependencies", "devDependencies"]) {
        const erklaert = Object.entries(manifest[feld] ?? {});
        const verzeichnet = entry[feld] ?? {};
        for (const [name, bereich] of erklaert) {
          if (verzeichnet[name] !== bereich) {
            failures.push(
              `${manifestPath} führt ${feld}.${name}=${bereich}, ` +
                `package-lock.json führt ${String(verzeichnet[name] ?? "nichts")}.\n` +
                "      Die Sperrdatei ist nach jeder Manifeständerung neu zu\n" +
                "      erzeugen: `npm install --package-lock-only`.\n",
            );
          }
        }
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`✗ ${failures.length} Befund(e) an den Eingaben der Tore:\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(
    "\n  Ein Tor, dessen Eingabe fehlt, ist entweder dauerhaft rot oder\n" +
      "  dauerhaft grün. Beides ist schlimmer als kein Tor.",
  );
  process.exit(1);
}

console.log(
  `✓ ${GATE_INPUTS.length} Tor-Eingaben sind vorhanden, verfolgt und nicht ignoriert;\n` +
    "  package-lock.json stimmt mit allen Workspace-Manifesten überein.",
);
