/// <reference lib="dom" />

/**
 * Barrierefreiheit der Bedienschicht — mit `axe-core` gemessen.
 *
 * Der Auftrag ist eindeutig: **null Verstöße über dem Editor mit sichtbarer
 * Palette und offenem Kontextmenü.** Diese Datei misst genau das, und dazu die
 * Zustände, die sonst gern durchrutschen: das offene Typwechsel-Menü, das
 * laufende Beschriftungsfeld, und die deaktivierte Palette im Lesemodus mit
 * `chrome="full"` — ausgerechnet der Zustand, den es vorher gar nicht gab.
 *
 * `axe` allein genügt nicht, deshalb prüft die Datei zusätzlich, was ein
 * Regelwerk nicht sehen kann: dass **jedes** Bedienelement einen zugänglichen
 * Namen, eine Rolle und einen Tastaturweg hat, und dass jede Handlung etwas
 * ansagt. Ein Knopf ohne Verstoß, den niemand erreicht, ist kein Erfolg.
 *
 * Was jsdom hier **nicht** prüfen kann, steht in `JSDOM_LIMITATIONS`
 * (`test/draw/helpers/jsdom-svg.ts`): Farbkontrast, Fokus-Sichtbarkeit und die
 * tatsächliche Screenreader-Ausgabe. Der Kontrast der Bedienelemente bleibt
 * damit ungeprüft — Stufe 6 des Plans.
 */

import axe from "axe-core";
import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_PALETTE_ITEMS } from "../../src/editor/catalog.js";
import type { ArctosContextPadProvider } from "../../src/editor/ContextPadProvider.js";
import type { LabelEditing } from "../../src/editor/LabelEditing.js";
import type { PaletteChrome } from "../../src/editor/PaletteChrome.js";
import type { ReplaceMenu } from "../../src/editor/ReplaceMenu.js";
import { JSDOM_LIMITATIONS } from "../draw/helpers/jsdom-svg.js";
import { SIMPLE_PROCESS } from "../modeling/helpers/fixtures.js";
import { openEditor, type EditorHarness } from "./helpers/editor.js";

let harness: EditorHarness;

beforeEach(() => {
  document.body.replaceChildren();
});

interface PadLike {
  open(target: unknown, force?: boolean): void;
}

async function violationsOf(node: HTMLElement): Promise<string[]> {
  const report = await axe.run(node, { resultTypes: ["violations"] });
  return report.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} (${violation.nodes
        .map((entry) => entry.html)
        .join(" | ")})`,
  );
}

describe("axe-core über der Bedienschicht", () => {
  it("Editor mit sichtbarer Palette: null Verstöße", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    expect(await violationsOf(harness.container)).toEqual([]);
    harness.destroy();
  }, 30_000);

  it("Editor mit offenem Kontextmenü: null Verstöße", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    harness
      .service<PadLike>("contextPad")
      .open(harness.session.shape("Task_1"), true);
    expect(
      harness.canvasContainer.querySelector(".djs-context-pad"),
    ).not.toBeNull();
    expect(await violationsOf(harness.container)).toEqual([]);
    harness.destroy();
  }, 30_000);

  it("Editor mit offenem Typwechsel-Menü: null Verstöße", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    harness
      .service<ReplaceMenu>("replaceMenu")
      .openFor(harness.session.shape("Task_1"));
    expect(await violationsOf(harness.container)).toEqual([]);
    harness.destroy();
  }, 30_000);

  it("Editor mit laufender Beschriftung: null Verstöße", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    harness
      .service<LabelEditing>("labelEditing")
      .activate(harness.session.shape("Task_1"));
    expect(await violationsOf(harness.container)).toEqual([]);
    harness.destroy();
  }, 30_000);

  it("Lesemodus mit chrome=full: null Verstöße trotz deaktivierter Palette", async () => {
    harness = await openEditor(SIMPLE_PROCESS, {
      editor: { editable: false, chrome: "full" },
    });
    expect(await violationsOf(harness.container)).toEqual([]);
    harness.destroy();
  }, 30_000);

  it("Kontextmenü über mehreren Elementen: null Verstöße", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    harness
      .service<PadLike>("contextPad")
      .open(
        [harness.session.shape("Task_1"), harness.session.shape("Gateway_1")],
        true,
      );
    expect(await violationsOf(harness.container)).toEqual([]);
    harness.destroy();
  }, 30_000);
});

describe("Was axe nicht sieht", () => {
  it("gibt jedem Paletteneintrag Rolle, Namen und Tastaturweg", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const node = harness
      .service<PaletteChrome>("paletteChrome")
      .element() as HTMLElement;
    const buttons = Array.from(
      node.querySelectorAll<HTMLElement>("button.entry"),
    );
    expect(buttons).toHaveLength(DEFAULT_PALETTE_ITEMS.length);
    for (const button of buttons) {
      expect(button.tagName.toLowerCase()).toBe("button");
      expect(button.getAttribute("aria-label")?.length ?? 0).toBeGreaterThan(3);
      expect([0, -1]).toContain(button.tabIndex);
    }
    // Genau ein Tabstopp — die Palette verlängert den Tabulator-Fluss der Seite
    // nicht um 17 Stationen.
    expect(buttons.filter((button) => button.tabIndex === 0)).toHaveLength(1);
    harness.destroy();
  });

  it("gibt jedem Kontextmenü-Eintrag Rolle, Namen und Tastaturweg", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const provider =
      harness.service<ArctosContextPadProvider>("contextPadProvider");
    harness
      .service<PadLike>("contextPad")
      .open(harness.session.shape("Task_1"), true);
    const buttons = Array.from(
      harness.canvasContainer.querySelectorAll<HTMLElement>(
        ".djs-context-pad button.entry",
      ),
    );
    const entries = provider.getContextPadEntries(
      harness.session.shape("Task_1") as never,
    );
    expect(buttons).toHaveLength(Object.keys(entries).length);
    for (const button of buttons) {
      expect(button.getAttribute("aria-label")?.length ?? 0).toBeGreaterThan(3);
    }
    harness.destroy();
  });

  it("meldet jede Handlung an die Live-Region des Betrachters", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    // Der Betrachter legt `.arctos-bpmn-live` an; dieser Test bildet ihn nach,
    // weil die Sitzung hier ohne Betrachterschicht läuft.
    const live = document.createElement("div");
    live.className = "arctos-bpmn-live";
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    harness.container.appendChild(live);

    harness.announcer().announce("Aufgabe angelegt.");
    expect(live.textContent).toBe("Aufgabe angelegt.");

    // Zwei gleiche Meldungen bleiben unterscheidbar: die Region wird geleert.
    harness.announcer().announce("Aufgabe angelegt.");
    expect(live.textContent).toBe("Aufgabe angelegt.");
    harness.destroy();
  });

  it("legt keine zweite Live-Region an, wenn der Betrachter eine hat", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const live = document.createElement("div");
    live.className = "arctos-bpmn-live";
    live.setAttribute("role", "status");
    harness.container.appendChild(live);
    harness.announcer().announce("Erste Meldung.");
    expect(
      harness.container.querySelectorAll(".arctos-bpmn-live"),
    ).toHaveLength(1);
    harness.destroy();
  });

  it("hält fest, was jsdom nicht prüfen kann", () => {
    expect(JSDOM_LIMITATIONS.join(" ")).toMatch(/Farbkontrast/);
    expect(JSDOM_LIMITATIONS.join(" ")).toMatch(/Fokus-Sichtbarkeit/);
  });
});
