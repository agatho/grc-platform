// [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-081]
//
// `server-only@0.0.1` liefert keine Typen. Das Paket besteht aus zwei
// Dateien: `index.js` (ein einzelnes `throw`) und `empty.js` (leer). Es ist
// kein Modul im ueblichen Sinn, sondern eine Markierung fuer den Bundler —
// eine Typdeklaration mit Inhalt waere hier eine Erfindung.
//
// Ohne diese Zeile meldet `tsc -p apps/worker/tsconfig.json`
//
//   packages/db/src/index.ts(…): error TS7016: Could not find a declaration
//   file for module 'server-only'.
//
// weil apps/worker weder `allowJs` noch `module: "preserve"` setzt und damit
// als einziges der vier betroffenen Projekte ueber die untypisierte
// JavaScript-Datei stolpert. Eingebunden wird die Datei ueber die
// Dreifach-Schraegstrich-Referenz in `index.ts`; apps/worker liest nur sein
// eigenes `src/**` ein, eine freistehende .d.ts eines fremden Pakets gelangt
// sonst nicht in sein Programm.
declare module "server-only";
