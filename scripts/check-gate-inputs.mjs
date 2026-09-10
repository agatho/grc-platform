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
  // [ARCTOS-FULL-2026-08-31 · OP-075] Die vierte Ratsche. Sie liegt aus
  // demselben Grund in der Wurzel wie die Coverage-Ratsche seit OP-066:
  // `docs/perf/` waere naheliegend gewesen, aber jede Ablage in einem
  // Verzeichnis, das auch Generat aufnimmt, ist genau der Weg, auf dem
  // C-15 und OP-066 entstanden sind.
  [
    ".dead-exports-ratchet.json",
    "scripts/audit-dead-exports.mjs --check (Dead-Exports-Ratsche)",
  ],
  // Der Report ist nicht nur Ausgabe, sondern EINGABE des Tors: `--check`
  // vergleicht die dort genannte Kennzahl mit dem Gemessenen (OP-074). Faellt
  // er aus dem Repository, prueft das Tor eine Datei, die niemand mehr sieht.
  [
    "docs/perf/dead-exports-report.md",
    "scripts/audit-dead-exports.mjs --check (Frischepruefung, OP-074)",
  ],
  // [ARCTOS-FULL-2026-08-31 · Welle 8c] Die fuenfte Ratsche. Sie zaehlt die
  // i18n-Schluessel je Namespace und Sprache und meldet jede Absenkung.
  // Grund: eine symmetrische Loeschung in DE UND EN ist der einzige Eingriff
  // am Katalog, den kein bestehender Check sehen kann — `audit-i18n-coverage`
  // vergleicht DE gegen EN (bleibt deckungsgleich), und `--max-unused` SINKT
  // dabei sogar, der Check wird also gruener. Genau so sind in Welle 8b 24
  // `esgAdvanced.materiality.*`-Schluessel unbemerkt ueberschrieben worden.
  // Liegt aus demselben Grund in der Wurzel wie die uebrigen Ratschen.
  [
    ".i18n-keys-ratchet.json",
    "scripts/i18n-key-inventory.mjs --check (i18n-Schluesselbestand)",
  ],
  // [ARCTOS-FULL-2026-08-31 · Welle 8f] Das Register ist die massgebliche
  // Liste der offenen Punkte und Eingabe von `check-op-numbers.mjs`. Faellt
  // es aus dem Repository, prueft dieser Check eine Datei, die niemand mehr
  // sieht — und jede OP-Nummer im Code waere schlagartig "unbekannt".
  [
    "docs/OFFENE-PUNKTE-REGISTER.md",
    "scripts/check-op-numbers.mjs (OP-Nummern eindeutig und bekannt)",
  ],
  // [ARCTOS-FULL-2026-08-31 · Welle 8h] Der abgeleitete Index. Er ist
  // Ausgabe UND Eingabe: `op-index.mjs` ohne Argument vergleicht ihn mit dem
  // Register. Faellt er aus dem Repository, prueft der Schritt eine Datei,
  // die niemand mehr sieht — dieselbe Mechanik wie bei OP-074.
  [
    "docs/OFFENE-PUNKTE-INDEX.md",
    "scripts/op-index.mjs (Stand je Punkt, gegen das Register geprueft)",
  ],
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
  [
    "docker-compose.production.yml",
    "scripts/check-compose-db-roles.mjs + check-compose-shared-paths.mjs",
  ],
  [
    "deploy/docker-compose.yml",
    "scripts/check-compose-db-roles.mjs + check-compose-shared-paths.mjs",
  ],
  // [ARCTOS-FULL-2026-08-31 · OP-241] Das Provisionierungsskript ist Eingabe
  // von `check-provision-order.mjs`: die Pruefung liest die Workflows, aber
  // ihre ganze Aussage haengt daran, dass es dieses Skript und seine zwei
  // Phasen gibt. Faellt es aus dem Repository, meldet die Pruefung „0 Jobs
  // rufen es auf" und ist gruen — genau die Form von Tor, die OP-092 hatte.
  [
    "deploy/provision-grc-app.sh",
    "scripts/check-provision-order.mjs (Rollen vor, Grants nach den Migrationen)",
  ],
  // [ARCTOS-FULL-2026-08-31 · OP-253] Dieselbe Mechanik wie eine Zeile
  // darueber: `check-apt-sources.mjs` verlangt, dass jeder apt-Job diese
  // Action aufruft. Faellt sie aus dem Repository, koennte kein Job die
  // Vorgabe erfuellen — die Pruefung faengt das selbst ab, und hier faellt es
  // eine Stufe frueher auf.
  [
    ".github/actions/apt-ohne-fremdquellen/action.yml",
    "scripts/check-apt-sources.mjs (kein apt-Zugriff ohne abgeschaltete Fremdquellen)",
  ],
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
// [ARCTOS-FULL-2026-08-31 · Welle 8g] Kein Produktcode darf ignoriert sein.
//
// C-15 hat drei API-Routen unter `api/v1/**/coverage/` gekostet, weil
// `**/coverage/` die Ausnahme darueber wieder aufhob. Die Antwort damals war
// eine zweite Ausnahme — fuer `coverage/`. Welle 8g hat dieselbe Klasse ein
// zweites Mal gefunden, mit einer anderen Regel und drei anderen Routen:
// `test-results/`, gedacht fuer die Ausgabe von Playwright, verschluckte
//
//   apps/web/src/app/api/v1/connectors/[id]/test-results/route.ts
//   apps/web/src/app/api/v1/devops-connectors/test-results/route.ts
//   apps/web/src/app/api/v1/identity-connectors/test-results/route.ts
//
// und `app/(dashboard)/connectors/[id]/page.tsx:67` ruft die erste davon.
// In Produktion antwortete sie mit 404.
//
// Zweimal dieselbe Klasse heisst: die Ausnahme ist nicht die Loesung, die
// Pruefung ist es. Hier wird deshalb nicht mehr nach einzelnen Regeln gesucht,
// sondern gefragt: liegt unter `apps/web/src/app` eine Quelldatei, die git
// nicht sieht? Das faengt jede kuenftige Regel, gleich wie sie heisst.
// ---------------------------------------------------------------------------
{
  const APP_DIR = "apps/web/src/app";
  let ignoriert = [];
  try {
    // `--others --ignored --exclude-standard` listet genau die Dateien, die
    // existieren, nicht verfolgt sind UND von einer Ignore-Regel getroffen
    // werden.
    ignoriert = git([
      "ls-files",
      "--others",
      "--ignored",
      "--exclude-standard",
      "--",
      APP_DIR,
    ])
      .split("\n")
      .filter(Boolean)
      .filter((f) => /\.(ts|tsx|js|jsx|css|json)$/.test(f));
  } catch {
    /* leeres Ergebnis liefert bei manchen git-Fassungen Status 1 */
  }

  for (const f of ignoriert) {
    let regel = "";
    try {
      regel = git(["check-ignore", "-v", f]);
    } catch {
      /* nicht ignoriert — dann steht sie hier nicht */
    }
    failures.push(
      `${f} liegt unter ${APP_DIR}, ist aber IGNORIERT und damit in keinem Klon.\n` +
        (regel ? `      ausgeschlossen durch: ${regel}\n` : "") +
        "      Produktcode, den git nicht sieht, fehlt in jedem Bau aus einem\n" +
        "      frischen Checkout — die Route antwortet dort mit 404. Das ist\n" +
        "      C-15, und in Welle 8g ein zweites Mal mit `test-results/`.\n" +
        "      Die Ausnahme gehoert NACH die ausschliessende Regel, und das\n" +
        "      VERZEICHNIS ist auszunehmen, nicht die Datei darin.\n",
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
