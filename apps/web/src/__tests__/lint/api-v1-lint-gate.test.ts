// [ARCTOS-FULL-2026-08-31 / Welle 4b · Strang 3 — OP-076, OP-077, OP-152]
//
// `apps/web/eslint.config.mjs` hatte fuer `src/app/api/v1/**` ein eigenes
// Konfigurationsobjekt, das zwei Regeln abschaltete, und die `no-console`-
// Regel liess dieses Verzeichnis aus. Gemessen am 2026-09-03, vor dieser
// Welle:
//
//   @typescript-eslint/no-unused-vars   500
//   @typescript-eslint/no-explicit-any  128
//   no-console                           53
//
// Alle drei stehen auf 0, die Ausnahmen sind gefallen. Ohne Tor haelt das
// nicht: die naechste Kopiervorlage bringt den naechsten `as any[]` und den
// naechsten `console.error(err)` zurueck, und weil `apps/web` als einziger
// Workspace KEINE Lint-Ratsche hat (OP-173), wuerde das niemand zaehlen.
//
// Der Test macht deshalb zwei unabhaengige Aussagen, wie das Tor in
// `apps/worker/tests/lib/no-console-gate.test.ts`:
//
//   1. **Ueber die aufgeloeste Konfiguration** — was ESLint fuer eine
//      Routendatei tatsaechlich einschaltet. Das ist eine Aussage ueber die
//      AUFLOESUNG der Flat-Config, nicht ueber ihren Text; ein spaeterer
//      Block, der die Regel wieder abschaltet, faellt hier auf.
//      Bei `no-console` wird zusaetzlich geprueft, dass KEINE `allow`-Liste
//      geerbt wird: Flat Config vererbt Rule-OPTIONEN, wenn ein spaeterer
//      Block nur die Schwere setzt — genau daran ist die Ratsche in
//      Welle 4b-2 vorbeigelaufen (23 gezaehlte Befunde bei 88 Aufrufen).
//
//   2. **Ueber den Baum** — kein `console.*`-AUFRUF unter `api/v1`. Das
//      deckt auch, was ein kuenftiges `ignores` dem Blick von ESLint
//      entzoege.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { ESLint } from "eslint";

const WEB = path.join(__dirname, "../../..");
const API_V1 = path.join(WEB, "src/app/api/v1");

// `cwd` ist BEWUSST `apps/web` und nicht die Wurzel: die Wurzelkonfiguration
// nimmt `apps/web/**` ausdruecklich aus ("eigener, strengerer Regelsatz"),
// und `calculateConfigForFile` liefert fuer eine ausgenommene Datei
// `undefined`. Geprueft wird also genau die Konfiguration, die fuer diese
// Dateien wirklich gilt: `apps/web/eslint.config.mjs`.

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(entry)) out.push(p);
  }
  return out;
}

const FILES = walk(API_V1);

/** Aufrufe, keine Erwaehnungen: Kommentare und Zeichenketten zaehlen nicht. */
const CONSOLE_CALL_RE =
  /(^|[^.\w$])console\s*\.\s*(log|warn|error|info|debug|trace|table|dir|group|groupEnd|time|timeEnd|assert|count)\s*\(/;

function stripCommentsAndStrings(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/`(?:\\.|\$\{[^}]*\}|[^`\\])*`/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, '""');
}

async function rulesFor(file: string): Promise<Record<string, unknown>> {
  const eslint = new ESLint({ cwd: WEB });
  const config = (await eslint.calculateConfigForFile(file)) as {
    rules?: Record<string, unknown>;
  };
  return config.rules ?? {};
}

/** ESLint normalisiert die Schwere auf die Zahl: 0 = off, 1 = warn, 2 = error. */
function severityOf(entry: unknown): unknown {
  return Array.isArray(entry) ? entry[0] : entry;
}

// Eine gewoehnliche Routendatei als Sonde — keine Sonderform, kein `_lib`.
const PROBE = path.join(API_V1, "processes/audit-pack/route.ts");

describe("Welle 4b/3 — das Tor ueber apps/web/src/app/api/v1", () => {
  it("hat ueberhaupt Routendateien gefunden (sonst prueft der Rest nichts)", () => {
    expect(FILES.length).toBeGreaterThan(1000);
  });

  it("no-unused-vars gilt hier als Fehler (Ausnahme OP-077 gefallen)", async () => {
    const rules = await rulesFor(PROBE);
    expect(severityOf(rules["@typescript-eslint/no-unused-vars"])).toBe(2);
  });

  it("no-explicit-any gilt hier als Fehler (Ausnahme OP-076 gefallen)", async () => {
    const rules = await rulesFor(PROBE);
    expect(severityOf(rules["@typescript-eslint/no-explicit-any"])).toBe(2);
  });

  it("no-console gilt hier als Fehler und ohne allow-Liste (OP-152)", async () => {
    const rules = await rulesFor(PROBE);
    const entry = rules["no-console"];
    expect(severityOf(entry)).toBe(2);
    // Flat Config vererbt Rule-OPTIONEN. Eine `allow`-Liste aus einem
    // frueheren Block wuerde genau die Stufen durchlassen, auf denen man ein
    // Fehlerobjekt ausgibt — die Form, um die es bei OP-152 geht.
    const options = Array.isArray(entry) ? entry.slice(1) : [];
    expect(JSON.stringify(options)).not.toContain("allow");
  });

  it("die Ausnahme fuer Testcode bleibt bestehen", async () => {
    // Ein Tor, das den Pruefstand mitreisst, wird umgangen statt befolgt:
    // in Mocks und Fixtures ist `any` die ehrliche Form.
    const rules = await rulesFor(
      path.join(__dirname, "api-v1-lint-gate.test.ts"),
    );
    expect(severityOf(rules["@typescript-eslint/no-explicit-any"])).toBe(0);
  });

  it("keine Routendatei ruft console.* auf", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const code = stripCommentsAndStrings(readFileSync(file, "utf8"));
      if (CONSOLE_CALL_RE.test(code)) offenders.push(path.relative(WEB, file));
    }
    expect(offenders).toEqual([]);
  });

  it("keine Routendatei schreibt `any`", () => {
    // Gegenprobe zur Konfigurationsaussage oben: die Regel koennte scharf
    // sein und der Bestand trotzdem dastehen, wenn irgendwo ein
    // `eslint-disable` haengt. Zeilenweise geprueft, Kommentare und
    // Zeichenketten entfernt.
    const ANY_RE = /(^|[^.\w$])any(?![\w$])/;
    const offenders: string[] = [];
    for (const file of FILES) {
      const code = stripCommentsAndStrings(readFileSync(file, "utf8"));
      code.split("\n").forEach((line, i) => {
        // `as any`, `: any`, `<any>`, `any[]` — alles Typpositionen.
        if (/\b(as|:|<)\s*any\b|\bany\[\]/.test(line) && ANY_RE.test(line)) {
          offenders.push(`${path.relative(WEB, file)}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  it("kein `eslint-disable` fuer die drei Regeln unter api/v1", () => {
    // Die einfachste Art, ein Tor zu umgehen, ist die Zeile daneben.
    const offenders: string[] = [];
    for (const file of FILES) {
      const src = readFileSync(file, "utf8");
      if (
        /eslint-disable[^\n]*(no-console|no-explicit-any|no-unused-vars)/.test(
          src,
        )
      ) {
        offenders.push(path.relative(WEB, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
