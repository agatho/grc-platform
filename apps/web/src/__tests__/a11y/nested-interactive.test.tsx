// @vitest-environment jsdom
//
// [ARCTOS-FULL-2026-08-31 · OP-157] Verschachtelte Bedienelemente.
//
// Gemeldet war EINE Stelle: die Budget-Karte rendert die ganze Zeile als
// `<button>` und darin drei weitere Schalter (`WP12.md` §3.20). Die Stelle
// ist behoben. Diese Datei ist der Teil, der die KLASSE schliesst, und sie
// besteht aus zwei Hälften, die zusammengehören:
//
//   Teil A führt den Mechanismus vor, statt ihn zu behaupten. Wer die Regel
//   nur als „ungültiges HTML" kennt, hält sie für Formalismus und baut das
//   Muster beim nächsten Mal wieder ein.
//
//   Teil B trägt den Bestand: ein Scanner über JEDE `.tsx` unterhalb von
//   `apps/web/src` und ein Sollstand je Datei. Neue Fundstellen werden rot,
//   verschwundene verlangen, dass der Sollstand sinkt.
//
// ── Warum ein statischer Scanner und nicht nur ein axe-Lauf ───────────
//
// axe kennt die Regel (`nested-interactive`, Schweregrad `serious`) und
// Teil A ruft sie ausdrücklich auf — aber axe braucht einen GERENDERTEN
// Baum. Der Defekt sass in einer Komponente, die nicht exportiert ist und
// deren Rendern `useRouter`, `next-intl` und zwei `fetch`-Antworten
// braucht. Ihn über axe zu finden hätte geheissen, erst die Seite
// montierbar zu machen — und das für rund 200 weitere Seiten zu
// wiederholen, von denen die Audit-Erfahrung sagt, dass genau das nicht
// passiert (S14-12: die vorhandene Smoke-Suite rendert nichts).
//
// `nested-interactive` ist dabei eine rein STRUKTURELLE Regel: sie fragt,
// ob ein fokussierbares Element ein fokussierbares Element enthält. Diese
// Frage beantwortet der Quelltext genauso vollständig wie das DOM, solange
// man weiss, was die Komponenten rendern (`Button` → `<button>`, ausser bei
// `asChild`; `Link` → `<a href>`). Deshalb ist der statische Weg hier nicht
// die schwächere Näherung, sondern der einzige mit 100 % Abdeckung. Teil A
// hält die beiden Wege gegeneinander: dieselbe Form, die der Scanner als
// Verstoss zählt, muss axe als `nested-interactive` melden — sonst misst
// der Scanner etwas anderes als die Regel, die er zu vertreten vorgibt.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import axe from "axe-core";

// Unter der jsdom-Umgebung ist `import.meta.url` kein `file:`-URL, deshalb
// über das Vitest-Wurzelverzeichnis (`apps/web`) statt über die Modul-URL.
const WEB = process.cwd();
const SRC = join(WEB, "src");
const BASELINE = join(
  SRC,
  "__tests__",
  "a11y",
  "nested-interactive.baseline.json",
);

// ────────────────────────────────────────────────────────────────────
// Teil A — der Mechanismus
// ────────────────────────────────────────────────────────────────────

describe("OP-157 · warum die Regel keine Formalie ist", () => {
  it("der HTML-Parser schachtelt <button> nicht — er schliesst das äussere", () => {
    // Das ist der Kern des Befunds. Next.js rendert auch eine
    // `"use client"`-Seite serverseitig vor; der Browser bekommt also
    // HTML-TEXT und schickt ihn durch den Parser. Der kennt das
    // Inhaltsmodell von <button> und beendet es beim nächsten <button>.
    // Bewusst `DOMParser` und nicht `host.innerHTML = …`: die repoweite
    // Invariante in `src/__tests__/security/frontend-invariants.test.ts`
    // verbietet jede Zuweisung an `innerHTML` — auch in Tests, und zu
    // Recht, denn ein Muster, das an einer Stelle erlaubt ist, wird an der
    // nächsten kopiert. `parseFromString` leistet hier ohnehin mehr: es
    // sagt ausdrücklich, was gezeigt werden soll — dass **der Parser**
    // diesen Text so und nicht anders liest.
    const host = new DOMParser().parseFromString(
      '<div id="wurzel"><button id="aussen" type="button">Budget 2026' +
        '<button id="innen" type="button">Aufklappen</button>' +
        "12.000,00 EUR</button></div>",
      "text/html",
    ).body.firstElementChild!;

    const aussen = host.querySelector("#aussen")!;
    const innen = host.querySelector("#innen")!;

    // Nach dem Parsen sind es GESCHWISTER, nicht Eltern und Kind …
    expect(aussen.contains(innen)).toBe(false);
    expect(innen.parentElement).toBe(host);
    // … und der Text hinter dem inneren Schalter steht überhaupt nicht
    // mehr in der Kachel, sondern lose daneben.
    expect(aussen.textContent).toBe("Budget 2026");
    expect(host.lastChild!.textContent).toBe("12.000,00 EUR");

    // React baut den Baum clientseitig über createElement/appendChild und
    // umgeht den Parser — die Schachtelung entsteht dort also sehr wohl.
    // Genau daraus folgt der Defekt: dieselbe Zeile hat vor und nach dem
    // Hydrieren eine andere Struktur.
    const outer = document.createElement("button");
    const inner = document.createElement("button");
    outer.appendChild(inner);
    expect(outer.contains(inner)).toBe(true);
  });

  it("axe meldet die Form, die der Scanner zählt, als `nested-interactive` (serious)", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const outer = document.createElement("button");
    outer.type = "button";
    outer.textContent = "Budget 2026 ";
    const inner = document.createElement("button");
    inner.type = "button";
    inner.setAttribute("aria-label", "Unterbudgets einblenden");
    inner.textContent = "▸";
    outer.appendChild(inner);
    host.appendChild(outer);

    const res = await axe.run(host, {
      rules: {
        "color-contrast": { enabled: false },
        region: { enabled: false },
      },
    });
    const nested = res.violations.find((v) => v.id === "nested-interactive");
    expect(nested).toBeDefined();
    // `serious` ist die Schwelle, ab der `components-axe.test.tsx` bricht —
    // die beiden Wächter messen also dieselbe Härte.
    expect(nested!.impact).toBe("serious");

    host.remove();
  });

  it("dieselbe Kachel als Kachel mit benanntem Link ist sauber", async () => {
    // Wie oben: kein `innerHTML`. `axe.run` braucht einen Knoten im
    // Dokument, deshalb wird das geparste Fragment adoptiert.
    const parsed = new DOMParser().parseFromString(
      '<div class="karte">' +
        '<button type="button" aria-label="Unterbudgets einblenden">▸</button>' +
        '<a href="/budget/2026">Budget 2026</a>' +
        '<a href="/budget/2026/dashboard">Budget vs. Ist</a>' +
        "</div>",
      "text/html",
    ).body.firstElementChild!;
    const host = document.importNode(parsed, true) as HTMLElement;
    document.body.appendChild(host);
    const res = await axe.run(host, {
      rules: {
        "color-contrast": { enabled: false },
        region: { enabled: false },
      },
    });
    expect(res.violations.map((v) => v.id)).not.toContain("nested-interactive");
    host.remove();
  });
});

// ────────────────────────────────────────────────────────────────────
// Teil B — der Bestand
// ────────────────────────────────────────────────────────────────────

/**
 * Was im DOM fokussierbar wird. Bewusst NICHT enthalten: `<label>`,
 * `<option>`, `<details>` und die Radix-Wurzeln (`<Select>`, `<Tooltip>`).
 * Sie sehen im Quelltext wie eine Schachtelung aus, sind aber keine —
 * `<label><input></label>` ist die empfohlene Form, `<option>` ist nicht
 * fokussierbar, und eine Radix-Wurzel rendert überhaupt kein Element.
 * Ein Wächter, der diese vier mitzählt, meldet 726 statt 120 Funde und
 * wird beim ersten Blick abgeschaltet.
 */
const FOCUSABLE_INTRINSIC = new Set([
  "button",
  "input",
  "select",
  "textarea",
  "iframe",
  "embed",
  "summary",
]);

/** Komponenten dieses Baums, die genau ein fokussierbares Element rendern. */
const FOCUSABLE_COMPONENT = new Set([
  "Button",
  "Link",
  "Checkbox",
  "Switch",
  "Input",
  "Textarea",
  "Slider",
  "SelectTrigger",
  "DropdownMenuTrigger",
  "PopoverTrigger",
  "TabsTrigger",
  "AccordionTrigger",
  "RadioGroupItem",
  "Toggle",
  "ToggleGroupItem",
]);

const FOCUSABLE_ROLE = new Set([
  "button",
  "link",
  "checkbox",
  "radio",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "tab",
  "switch",
  "textbox",
  "combobox",
  "slider",
  "spinbutton",
  "searchbox",
]);

interface Finding {
  file: string;
  line: number;
  outer: string;
  outerLine: number;
  inner: string;
}

function tsxFiles(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      // Der eigene Prüfstand baut die verbotene Form absichtlich nach.
      if (e.name === "__tests__") continue;
      tsxFiles(full, acc);
    } else if (e.name.endsWith(".tsx")) {
      acc.push(full);
    }
  }
  return acc;
}

function opening(node: ts.JsxElement | ts.JsxSelfClosingElement) {
  return ts.isJsxElement(node) ? node.openingElement : node;
}

function classify(
  node: ts.JsxElement | ts.JsxSelfClosingElement,
  src: ts.SourceFile,
): string | null {
  const el = opening(node);
  const tag = el.tagName.getText(src);
  const attrs = new Map<string, string | true>();
  for (const a of el.attributes.properties) {
    if (ts.isJsxAttribute(a) && a.name) {
      const init = a.initializer;
      attrs.set(
        a.name.getText(src),
        init && ts.isStringLiteral(init) ? init.text : true,
      );
    }
  }
  // `asChild` reicht die Props an das Kind durch und rendert selbst nichts —
  // `<Button asChild><Link/></Button>` ist EIN <a>, keine Schachtelung.
  // Genau das ist die Auflösung des `<Link><Button>`-Musters.
  if (attrs.has("asChild")) return null;

  const role = attrs.get("role");
  if (typeof role === "string")
    return FOCUSABLE_ROLE.has(role) ? `<${tag} role=${role}>` : null;
  if (tag === "a") return attrs.has("href") ? "<a href>" : null;
  if (FOCUSABLE_INTRINSIC.has(tag)) return `<${tag}>`;
  if (FOCUSABLE_COMPONENT.has(tag)) return `<${tag}>`;
  if (attrs.has("tabIndex")) return `<${tag} tabIndex>`;
  return null;
}

function scan(): Finding[] {
  const findings: Finding[] = [];
  for (const file of tsxFiles(SRC)) {
    const src = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const stack: Array<{ kind: string; line: number }> = [];
    const walk = (node: ts.Node): void => {
      let pushed = false;
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        const kind = classify(node, src);
        if (kind) {
          const line =
            src.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          const parent = stack[stack.length - 1];
          if (parent) {
            findings.push({
              file: relative(SRC, file).split(sep).join("/"),
              line,
              outer: parent.kind,
              outerLine: parent.line,
              inner: kind,
            });
          }
          stack.push({ kind, line });
          pushed = true;
        }
      }
      ts.forEachChild(node, walk);
      if (pushed) stack.pop();
    };
    walk(src);
  }
  return findings;
}

describe("OP-157 · kein fokussierbares Element in einem fokussierbaren", () => {
  const findings = scan();
  const counts: Record<string, number> = {};
  for (const f of findings) counts[f.file] = (counts[f.file] ?? 0) + 1;

  if (process.env.NESTED_INTERACTIVE_UPDATE === "1") {
    // Absichtlich nur über eine ausdrückliche Umgebungsvariable, nie
    // automatisch: ein Sollstand, der sich beim Fehlschlag selbst
    // fortschreibt, ist kein Sollstand.
    const sortiert: Record<string, number> = {};
    for (const f of Object.keys(counts).sort()) sortiert[f] = counts[f]!;
    writeFileSync(
      BASELINE,
      JSON.stringify({ files: sortiert }, null, 2) + "\n",
    );
  }

  const baseline: Record<string, number> = JSON.parse(
    readFileSync(BASELINE, "utf8"),
  ).files;

  it("keine NEUE Datei mit verschachtelten Bedienelementen", () => {
    const neu = Object.keys(counts)
      .filter((f) => baseline[f] === undefined)
      .sort();
    expect(
      neu,
      `Neue Fundstellen:\n${findings
        .filter((f) => baseline[f.file] === undefined)
        .map((f) => `  ${f.file}:${f.line}  ${f.outer} > ${f.inner}`)
        .join("\n")}\n\nAuflösung: das äussere Element ist kein Schalter, ` +
        `sondern eine Kachel (<div>) mit einem BENANNTEN Link darin; ` +
        `für <Link><Button> ist es <Button asChild><Link/></Button>.`,
    ).toEqual([]);
  });

  it("keine Datei mit MEHR Fundstellen als im Sollstand", () => {
    const gestiegen = Object.entries(counts)
      .filter(([f, n]) => baseline[f] !== undefined && n > baseline[f]!)
      .map(([f, n]) => `${f}: ${baseline[f]} → ${n}`);
    expect(gestiegen).toEqual([]);
  });

  it("der Sollstand nennt keine Datei, die sauber ist (sonst schrumpft er nicht)", () => {
    const erledigt = Object.entries(baseline)
      .filter(([f, n]) => (counts[f] ?? 0) < n)
      .map(([f, n]) => `${f}: ${n} → ${counts[f] ?? 0}`);
    expect(
      erledigt,
      "Behoben — bitte nested-interactive.baseline.json nachziehen " +
        "(NESTED_INTERACTIVE_UPDATE=1 npx vitest run src/__tests__/a11y/nested-interactive.test.tsx).",
    ).toEqual([]);
  });

  it("die Budget-Karte ist frei (OP-157, die gemeldete Stelle)", () => {
    // Der Einzelfall, aus dem die Klasse entstand — ausdrücklich benannt,
    // damit ein Rückfall genau hier und nicht nur in einer Summe auffällt.
    expect(counts["app/(dashboard)/budget/page.tsx"]).toBeUndefined();
  });
});
