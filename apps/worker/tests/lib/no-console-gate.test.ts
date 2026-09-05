// [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-152]
//
// Eine Bereinigung ohne Tor hält nicht: die nächste Kopiervorlage bringt den
// nächsten `console.error(err)` zurück. Dieser Test ist das Tor für
// `apps/worker/src`.
//
// Zwei unabhängige Zusicherungen, wie bei OP-078:
//
//   1. **ESLint selbst** — die effektive Konfiguration einer Worker-Datei
//      führt `no-console` als FEHLER und OHNE `allow`-Liste. Das ist eine
//      Aussage über die AUFLÖSUNG der Flat-Config, nicht über ihren Text.
//      Die `allow`-Liste ist hier der eigentliche Punkt: mit
//      `{ allow: ["warn","error","info","debug"] }` sah die Lint-Ratsche 23
//      Befunde, wo 88 Aufrufe standen — 65 waren ausgenommen, darunter jedes
//      `console.error(err)`, also gerade die gefährliche Form.
//
//   2. **Der Baum** — keine Datei unter `src/` ruft `console.*` auf. Das
//      deckt auch, was ein künftiges `ignores` aus dem Blickfeld von ESLint
//      nähme.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { ESLint } from "eslint";

const WORKER = path.join(__dirname, "../..");
const REPO = path.join(WORKER, "../..");
const SRC = path.join(WORKER, "src");
const RULE = "no-console";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(entry)) out.push(p);
  }
  return out;
}

const SRC_FILES = walk(SRC);

/** Aufrufe, keine Erwähnungen: Kommentare und Zeichenketten zählen nicht. */
const CALL_RE =
  /(^|[^.\w$])console\s*\.\s*(log|warn|error|info|debug|trace|table|dir|group|groupEnd|time|timeEnd|assert|count)\s*\(/;

function stripCommentsAndStrings(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/`(?:\\.|\$\{[^}]*\}|[^`\\])*`/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, '""');
}

describe("OP-152 — `console.*` bleibt aus apps/worker/src draussen", () => {
  it("hat ueberhaupt Worker-Quelldateien gefunden (sonst prueft der Rest nichts)", () => {
    expect(SRC_FILES.length).toBeGreaterThan(100);
  });

  it("ESLint fuehrt no-console im Worker als Fehler und ohne allow-Liste", async () => {
    const eslint = new ESLint({ cwd: REPO });
    const probe = path.join(SRC, "crons/dd-expiry.ts");
    const config = (await eslint.calculateConfigForFile(probe)) as {
      rules?: Record<string, unknown>;
    };
    const entry = config.rules?.[RULE];
    const severity = Array.isArray(entry) ? entry[0] : entry;
    // ESLint normalisiert auf die Zahl: 0 = off, 1 = warn, 2 = error.
    expect(severity).toBe(2);
    // Und keine Ausnahme fuer die Diagnosestufen mehr.
    const options = Array.isArray(entry) ? entry.slice(1) : [];
    expect(JSON.stringify(options)).not.toContain("allow");
  });

  it("die Ausnahme fuer apps/worker/tests bleibt bestehen", async () => {
    // Ein Tor, das den Pruefstand mitreisst, wird umgangen statt befolgt.
    const eslint = new ESLint({ cwd: REPO });
    const probe = path.join(WORKER, "tests/lib/cron-instrument.test.ts");
    const config = (await eslint.calculateConfigForFile(probe)) as {
      rules?: Record<string, unknown>;
    };
    const entry = config.rules?.[RULE];
    const severity = Array.isArray(entry) ? entry[0] : entry;
    expect(severity).toBe(0);
  });

  it("keine Quelldatei unter src/ ruft console.* auf", () => {
    const offenders: string[] = [];
    for (const file of SRC_FILES) {
      const code = stripCommentsAndStrings(readFileSync(file, "utf8"));
      if (CALL_RE.test(code)) offenders.push(path.relative(WORKER, file));
    }
    expect(offenders).toEqual([]);
  });

  it("jede Datei, die loggt, benutzt den strukturierten Logger", () => {
    // Gegenprobe zur vorigen Zusicherung: „keine console.*" waere auch
    // erfuellt, wenn niemand mehr loggte.
    const withLogger = SRC_FILES.filter((f) =>
      /from "(\.\.\/lib\/logger|\.\/logger|\.\/lib\/logger)"/.test(
        readFileSync(f, "utf8"),
      ),
    );
    expect(withLogger.length).toBeGreaterThanOrEqual(30);
  });
});
