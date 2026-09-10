// ============================================================================
// [ARCTOS-FULL-2026-08-31 · OP-246] npm aufrufen, auf jeder Plattform
// ============================================================================
//
// Auf Windows gibt es fuer `execFileSync(…, { shell: false })` KEINEN Namen,
// unter dem npm laeuft — beide naheliegenden sind Sackgassen, und beide
// wurden am 2026-09-09 auf der Maschine des Eigentuemers nachgemessen:
//
//   execFileSync("npm",     …)  →  Error: spawnSync npm ENOENT
//   execFileSync("npm.cmd", …)  →  Error: spawnSync npm.cmd EINVAL
//
// Das zweite ist der interessante Fall und der Grund, warum die erste Fassung
// dieser Datei falsch war: seit der Gegenmassnahme zu CVE-2024-27980 weigert
// sich Node, eine `.cmd`- oder `.bat`-Datei ohne Shell zu starten. Der
// gaengige Ratschlag „nimm `npm.cmd` auf Windows" ist damit veraltet, und er
// scheitert LAUT — was hier ein Glueck ist.
//
// Der Weg, der auf beiden Plattformen ohne Shell funktioniert, ist derselbe,
// den die vier Runner-Skripte aus OP-234 nehmen: nicht das Startprogramm
// suchen, sondern den JavaScript-Einstiegspunkt und ihn mit der laufenden
// Node-Binaerdatei ausfuehren. npm liegt in der Node-Installation:
//
//   Windows  <node>/node_modules/npm/bin/npm-cli.js
//   POSIX    <node>/../lib/node_modules/npm/bin/npm-cli.js
//
// Beide Orte am 2026-09-09 gemessen (Windows: C:\nvm4w\nodejs\…, Linux:
// /opt/node22/lib/…).
//
// `shell: true` waere die kuerzere Antwort und die schlechtere: sie reicht die
// Argumente durch eine Shell, und damit haengt die Bedeutung von `&`, `|` und
// `^` ploetzlich am Inhalt der Argumente.
// ============================================================================

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

function npmCliPfad() {
  const nodeVerzeichnis = dirname(process.execPath);
  const kandidaten = [
    join(nodeVerzeichnis, "node_modules", "npm", "bin", "npm-cli.js"),
    join(
      nodeVerzeichnis,
      "..",
      "lib",
      "node_modules",
      "npm",
      "bin",
      "npm-cli.js",
    ),
  ];
  for (const k of kandidaten) if (existsSync(k)) return k;
  return null;
}

const NPM_CLI = npmCliPfad();

/**
 * Ruft npm auf und gibt stdout zurueck.
 *
 * Der Aufrufer bekommt Fehler wie von `execFileSync` — insbesondere bleibt
 * `e.stdout` erhalten, worauf sich beide Aufrufstellen verlassen: `npm ls`
 * endet bei einer Peer-Warnung mit Exit != 0, liefert aber vollstaendiges
 * JSON.
 */
export function npmAusfuehren(args, optionen = {}) {
  if (NPM_CLI) {
    return execFileSync(process.execPath, [NPM_CLI, ...args], optionen);
  }
  // Kein npm-cli.js neben der Node-Installation. Auf POSIX ist `npm` im PATH
  // ein gewoehnliches Programm und laeuft auch ohne Shell; auf Windows gibt
  // es keinen Weg mehr, also lieber eine Meldung, die sagt was los ist, als
  // ein `ENOENT`, das nach „npm kaputt" aussieht.
  if (process.platform === "win32") {
    throw new Error(
      "npm-cli.js wurde neben der Node-Installation nicht gefunden " +
        `(${dirname(process.execPath)}), und auf Windows laesst sich npm ohne ` +
        "Shell nicht ueber `npm.cmd` starten (EINVAL seit CVE-2024-27980). " +
        "Mit einer Node-Installation aufrufen, die npm mitbringt.",
    );
  }
  return execFileSync("npm", args, optionen);
}
