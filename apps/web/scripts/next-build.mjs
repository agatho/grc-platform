// Plattformneutraler Einstiegspunkt für `next build`.
//
// [ARCTOS-FULL-2026-08-31 · Nachtrag zu O-E]
// Das Build-Skript lautete `NODE_OPTIONS='--max-old-space-size=4096' next build`.
// Die vorangestellte Variablenzuweisung ist POSIX-Shell-Syntax; npm führt
// Skripte unter Windows über `cmd.exe` aus, und dort ist sie kein gültiges
// Kommando ("NODE_OPTIONS' ist entweder falsch geschrieben oder konnte nicht
// gefunden werden"). Der Produktionsbuild war damit auf Windows unmöglich.
//
// Die Heap-Grenze muss beim Start des Node-Prozesses feststehen, lässt sich
// also nicht nachträglich über process.env setzen. Deshalb startet dieses
// Skript `next` als Kindprozess mit dem Flag. `require.resolve` findet das
// Binary unabhängig davon, ob npm es nach `apps/web/node_modules` oder in den
// gehobenen Wurzelbaum gelegt hat.
//
// Bewusst ohne `cross-env`: eine weitere Produktionsabhängigkeit für eine
// Zuweisung, die zwölf Zeilen Standardbibliothek erledigen, wäre in einem
// Projekt mit SBOM- und Lizenzpflicht der schlechtere Tausch.

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

let nextBin;
try {
  nextBin = require.resolve("next/dist/bin/next");
} catch (error) {
  console.error(
    "[build] `next` konnte nicht aufgelöst werden. Wurde `npm ci` ausgeführt?\n" +
      "Hinweis: Steht NODE_ENV=production in der Umgebung, lässt npm die\n" +
      "devDependencies aus und `next` fehlt. Dann `npm ci --include=dev`.",
  );
  console.error(error);
  process.exit(1);
}

const heapMb = process.env.ARCTOS_BUILD_HEAP_MB ?? "4096";
const args = [
  `--max-old-space-size=${heapMb}`,
  nextBin,
  "build",
  ...process.argv.slice(2),
];

const result = spawnSync(process.execPath, args, { stdio: "inherit" });

if (result.error) {
  console.error("[build] next konnte nicht gestartet werden:", result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
