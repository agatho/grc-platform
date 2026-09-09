/**
 * [ARCTOS-FULL-2026-08-31 · Welle 8e · OP-080]
 *
 * `react-hooks/incompatible-library` war die letzte der acht
 * Compiler-Regeln aus `eslint-plugin-react-hooks@7`, die global auf `off`
 * stand. Die Begruendung dafuer war wahr — „von hier aus nicht behebbar",
 * `@tanstack/react-table` gibt Funktionen zurueck, die der Compiler nicht
 * memoisieren kann — aber sie galt fuer 2.298 Dateien, obwohl sie ueber
 * ZWEI etwas aussagte.
 *
 * Seit dieser Welle steht die Regel auf `error` und ist nur noch fuer die
 * zwei namentlich genannten Dateien abgeschaltet. Dieser Test haelt genau
 * das fest — nicht das Verhalten von ESLint (das prueft der Lint-Lauf
 * selbst), sondern die FORM der Ausnahme: sie muss namentlich und
 * abzaehlbar bleiben.
 *
 * Entscheidung: docs/ADR-028-tanstack-table-und-react-compiler.md
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WEB = path.join(__dirname, "../../..");
const CONFIG = path.join(WEB, "eslint.config.mjs");
const SRC = path.join(WEB, "src");

const AUSNAHMEN = [
  "src/app/(dashboard)/audit-log/page.tsx",
  "src/components/ui/data-table.tsx",
];

function alleQuellen(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) alleQuellen(p, acc);
    else if (/\.tsx?$/.test(p)) acc.push(p);
  }
  return acc;
}

describe("Welle 8e — incompatible-library ist an, die Ausnahme ist namentlich", () => {
  const config = readFileSync(CONFIG, "utf8");

  it("die Regel steht global auf error, nicht auf off", () => {
    expect(config).toMatch(/"react-hooks\/incompatible-library":\s*"error"/);
    // Ein globales `off` waere die alte Fassung. Genau EIN `off` darf
    // vorkommen — das im namentlichen Ausnahmeblock.
    const offs = [
      ...config.matchAll(/"react-hooks\/incompatible-library":\s*"off"/g),
    ];
    expect(offs).toHaveLength(1);
  });

  it("der Ausnahmeblock nennt genau die zwei bekannten Dateien", () => {
    for (const datei of AUSNAHMEN) {
      expect(config).toContain(`"${datei}"`);
    }
  });

  it("es gibt genau diese zwei useLegacyTable-Aufrufstellen im Quelltext", () => {
    // Waechst diese Liste, ohne dass jemand den Ausnahmeblock anfasst, faellt
    // der Lint-Lauf. Waechst sie MIT dem Ausnahmeblock, faellt dieser Test —
    // die Entscheidung gehoert dann in den ADR, nicht in eine Zeile.
    //
    // [OP-234] Seit @tanstack/react-table 9 heisst der Hook des v8-kompatiblen
    // Einstiegs `useLegacyTable` (aus `@tanstack/react-table/legacy`); der Name
    // `useReactTable` kommt im Quelltext nicht mehr vor. Beide Schreibweisen
    // zaehlen, damit ein Rueckbau auf den alten Namen nicht unbemerkt bliebe.
    const treffer = alleQuellen(SRC)
      .filter((p) => !p.includes("__tests__"))
      .filter((p) =>
        /\buse(React|Legacy)Table\s*\(/.test(readFileSync(p, "utf8")),
      )
      .map((p) => `src/${path.relative(SRC, p).split(path.sep).join("/")}`)
      .sort();
    expect(treffer).toEqual([...AUSNAHMEN].sort());
  });

  it("die Entscheidung ist als ADR abgelegt und im Index verzeichnet", () => {
    const adr = path.join(
      WEB,
      "../../docs/ADR-028-tanstack-table-und-react-compiler.md",
    );
    const text = readFileSync(adr, "utf8");
    expect(text).toMatch(/^\*\*Status:\*\* Accepted/m);
    // Der ADR muss die Gegenprobe nennen — eine Entscheidung ohne den
    // Nachweis, dass die Regel greift, ist genau die Sorte Begruendung, die
    // dieses Audit gesammelt hat.
    expect(text).toContain("Gegengeprüft");
    const index = readFileSync(
      path.join(WEB, "../../docs/adr-index.md"),
      "utf8",
    );
    expect(index).toContain("ADR-028-tanstack-table-und-react-compiler.md");
  });
});
