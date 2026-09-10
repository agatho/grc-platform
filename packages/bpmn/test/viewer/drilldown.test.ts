/// <reference lib="dom" />

/**
 * [ARCTOS-FULL-2026-08-31 · OP-018] Drill-Down in Subprozesse.
 *
 * **Der Befund, nachgemessen.** `test/corpus/synth-nested-subprocesses.bpmn`
 * trägt zwei `BPMNPlane`s. Vor dieser Arbeit zeichnete jede Fläche Ebene 1
 * (3 Formen, 2 Kanten); die 4 Formen und 3 Kanten der zweiten Ebene waren mit
 * keiner Bedienung erreichbar — `buildScene` konnte sie zeichnen (der
 * `diagramIndex`-Parameter steht seit dem Spike da), aber niemand rief ihn mit
 * etwas anderem als der impliziten `0` auf.
 *
 * Dieser Test hält beides fest: dass die Ebene erreichbar ist, **und** dass die
 * Bedienung dafür ohne Maus auskommt.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import {
  planeIndexFor,
  planeLabel,
  planePath,
  planesOf,
} from "../../src/draw/planes";
import type { ModdleElement } from "../../src/draw/types";
import { importXml } from "../../src/model/index";
import { BpmnCanvas } from "../../src/viewer/BpmnCanvas";
import { installSvgPolyfills } from "../draw/helpers/jsdom-svg";

installSvgPolyfills();

const NESTED = join(
  process.cwd(),
  "test/corpus/synth-nested-subprocesses.bpmn",
);
const FLAT = join(process.cwd(), "test/corpus/repo-prd-procurement.bpmn");

let nestedXml: string;
let flatXml: string;

beforeAll(() => {
  nestedXml = readFileSync(NESTED, "utf8");
  flatXml = readFileSync(FLAT, "utf8");
});

async function load(xml: string): Promise<ModdleElement> {
  const { definitions } = await importXml(xml);
  return definitions as unknown as ModdleElement;
}

function openCanvas(mode: "read" | "edit"): {
  canvas: BpmnCanvas;
  container: HTMLElement;
} {
  const container = document.createElement("div");
  container.style.width = "1200px";
  container.style.height = "800px";
  document.body.appendChild(container);
  const canvas = new BpmnCanvas({
    container,
    mode,
    importXml: importXml as never,
  });
  return { canvas, container };
}

describe("Ebenen eines Dokuments (planes.ts)", () => {
  it("findet beide Ebenen und ordnet die untere ihrem Subprozess zu", async () => {
    const definitions = await load(nestedXml);
    const planes = planesOf(definitions);

    expect(planes).toHaveLength(2);
    expect(planes[0]?.rootId).toBe("Process_Nested");
    expect(planes[0]?.parentIndex).toBeUndefined();
    // Die zweite Ebene gehört zu `Sub_L1` — und `Sub_L1` ist eine Form auf
    // Ebene 0. Genau diese Kante macht die Brotkrume möglich.
    expect(planes[1]?.rootId).toBe("Sub_L1");
    expect(planes[1]?.parentIndex).toBe(0);
    expect(planeLabel(planes[1]!)).toBe("Ebene 1");
  });

  it("weist jeder Ebene den Index zu, den buildScene erwartet", async () => {
    const definitions = await load(nestedXml);
    expect(planeIndexFor(definitions, "Sub_L1")).toBe(1);
    // Ein eingeklappter Subprozess **ohne** eigene Ebene ist der Normalfall:
    // Sub_L2, Sub_L3 und Sub_AdHoc haben keine. Für sie darf es keinen
    // Drill-Down geben, und `planeIndexFor` sagt das.
    expect(planeIndexFor(definitions, "Sub_L2")).toBeUndefined();
    expect(planeIndexFor(definitions, "N_Start")).toBeUndefined();
  });

  it("baut die Brotkrume von oben nach unten", async () => {
    const definitions = await load(nestedXml);
    const path = planePath(definitions, 1);
    expect(path.map((plane) => plane.rootId)).toEqual([
      "Process_Nested",
      "Sub_L1",
    ]);
  });

  it("hat für ein flaches Dokument genau eine Ebene ohne Ausgang", async () => {
    const definitions = await load(flatXml);
    const planes = planesOf(definitions);
    expect(planes).toHaveLength(1);
    expect(planePath(definitions, 0)).toHaveLength(1);
  });
});

describe("Drill-Down auf der lesenden Fläche", () => {
  it("zeichnet nach dem Drill-Down die Elemente der zweiten Ebene", async () => {
    const { canvas } = openCanvas("read");
    const first = await canvas.importXml(nestedXml);

    // Der gemessene Ausgangsstand: Ebene 1, fünf gezeichnete Elemente.
    expect(canvas.getPlaneIndex()).toBe(0);
    expect(first.elementCount).toBe(5);
    expect(canvas.canDrillDown("Sub_L1")).toBe(true);
    expect(canvas.canDrillDown("Sub_L2")).toBe(false);

    expect(canvas.drillDown("Sub_L1")).toBe(true);
    expect(canvas.getPlaneIndex()).toBe(1);

    const scene = canvas.getScene();
    expect(scene?.shapes.map((shape) => shape.id).sort()).toEqual([
      "L1_End",
      "L1_Start",
      "Sub_AdHoc",
      "Sub_L2",
    ]);
    expect(scene?.connections.map((edge) => edge.id).sort()).toEqual([
      "L1_F1",
      "L1_F2",
      "L1_F3",
    ]);
    canvas.destroy();
  });

  it("führt eine Brotkrume und findet zurück", async () => {
    const { canvas } = openCanvas("read");
    await canvas.importXml(nestedXml);
    canvas.drillDown("Sub_L1");

    expect(canvas.getPlanePath().map((plane) => plane.rootId)).toEqual([
      "Process_Nested",
      "Sub_L1",
    ]);
    expect(canvas.currentPlaneLabel()).toBe("Ebene 1");
    expect(canvas.canDrillUp()).toBe(true);

    expect(canvas.drillUp()).toBe(true);
    expect(canvas.getPlaneIndex()).toBe(0);
    expect(canvas.canDrillUp()).toBe(false);
    expect(canvas.drillUp()).toBe(false);
    canvas.destroy();
  });

  it("hält Zusicherung Z-D über den Ebenenwechsel hinweg", async () => {
    // Der Ebenenwechsel ist **keine** Bearbeitung. Wer nur hineinsieht und
    // wieder speichert, muss byteweise denselben Text zurückbekommen — sonst
    // erzeugte das bloße Ansehen einer Unterebene eine neue Version.
    const { canvas } = openCanvas("read");
    await canvas.importXml(nestedXml);
    canvas.drillDown("Sub_L1");
    await expect(canvas.exportXml()).resolves.toBe(nestedXml);
    canvas.drillUp();
    await expect(canvas.exportXml()).resolves.toBe(nestedXml);
    canvas.destroy();
  });

  it("beschreibt nach dem Wechsel die neue Ebene, nicht die alte", async () => {
    const { canvas } = openCanvas("read");
    await canvas.importXml(nestedXml);
    const before = canvas.getTextAlternative();
    canvas.drillDown("Sub_L1");
    const after = canvas.getTextAlternative();

    expect(before.rows.map((row) => row.id)).toContain("N_Start");
    expect(after.rows.map((row) => row.id)).toContain("L1_Start");
    expect(after.rows.map((row) => row.id)).not.toContain("N_Start");
    canvas.destroy();
  });

  it("lässt einen unbekannten oder gleichen Index unangetastet", async () => {
    const { canvas } = openCanvas("read");
    await canvas.importXml(nestedXml);
    expect(canvas.showPlane(0)).toBe(false);
    expect(canvas.showPlane(7)).toBe(false);
    expect(canvas.getPlaneIndex()).toBe(0);
    canvas.destroy();
  });
});

describe("Drill-Down ohne Maus", () => {
  /**
   * Der Nachweis, den die Arbeitsweise verlangt: **eine** Bedienfunktion,
   * ausgeführt ausschließlich über die Tastatur, mit Ansage.
   */
  it("öffnet und verlässt die Ebene mit `o` und `Umschalt+O`", async () => {
    const { canvas, container } = openCanvas("read");
    await canvas.importXml(nestedXml);

    const live = (): string =>
      container.querySelector(".arctos-bpmn-live")?.textContent ?? "";

    // Fokus per Tastatur auf `Sub_L1` bringen — nicht per API setzen.
    const press = (key: string, shift = false): void => {
      container.dispatchEvent(
        new window.KeyboardEvent("keydown", {
          key,
          shiftKey: shift,
          bubbles: true,
        }),
      );
    };
    press("ArrowRight"); // erstes Element
    for (let i = 0; i < 8 && !live().includes("Ebene 1"); i += 1) {
      press("ArrowRight");
    }
    expect(live()).toContain("Ebene 1");

    press("o");
    expect(canvas.getPlaneIndex()).toBe(1);
    expect(live()).toContain("Ebene Ebene 1");
    expect(live()).toContain("7 Elemente");
    expect(live()).toContain("Umschalt und O");

    press("O", true);
    expect(canvas.getPlaneIndex()).toBe(0);
    canvas.destroy();
  });

  it("sagt an, wenn das Element keine eigene Ebene hat", async () => {
    const { canvas, container } = openCanvas("read");
    await canvas.importXml(flatXml);
    const live = (): string =>
      container.querySelector(".arctos-bpmn-live")?.textContent ?? "";

    container.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    container.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "o", bubbles: true }),
    );
    expect(live()).toContain("keine eigene Ebene");
    expect(canvas.getPlaneIndex()).toBe(0);
    canvas.destroy();
  });

  it("sagt an, wenn es keine übergeordnete Ebene gibt", async () => {
    const { canvas, container } = openCanvas("read");
    await canvas.importXml(flatXml);
    container.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: "O",
        shiftKey: true,
        bubbles: true,
      }),
    );
    expect(
      container.querySelector(".arctos-bpmn-live")?.textContent ?? "",
    ).toContain("oberste Ebene");
    canvas.destroy();
  });
});

describe("Drill-Down im Bearbeitungsmodus", () => {
  it("macht die Elemente der zweiten Ebene bearbeitbar", async () => {
    const { canvas } = openCanvas("edit");
    await canvas.importXml(nestedXml);

    const registry = canvas.get<{
      getAll: () => Array<{ id?: string }>;
      get: (id: string) => unknown;
    }>("elementRegistry");
    expect(registry.get("L1_Start")).toBeUndefined();

    expect(canvas.drillDown("Sub_L1")).toBe(true);
    // Jetzt liegen die Kinder der Unterebene als echte Elemente vor — das ist
    // der Unterschied zwischen „sichtbar" und „bearbeitbar".
    expect(registry.get("L1_Start")).toBeDefined();
    expect(registry.get("N_Start")).toBeUndefined();
    canvas.destroy();
  });

  it("behält Bearbeitungen der anderen Ebene im Modell", async () => {
    // Der Ebenenwechsel baut die Elementobjekte neu auf. Die Wahrheit steht im
    // moddle-Baum, und der wird dabei nicht angefasst — dieser Test hält genau
    // das fest, weil es die Bedingung dafür ist, dass Drill-Down und Speichern
    // sich nicht ausschließen.
    const { canvas } = openCanvas("edit");
    await canvas.importXml(nestedXml);

    const registry = canvas.get<{ get: (id: string) => unknown }>(
      "elementRegistry",
    );
    const modeling = canvas.get<{
      updateProperties: (
        element: unknown,
        props: Record<string, unknown>,
      ) => void;
    }>("modeling");
    modeling.updateProperties(registry.get("N_Start"), {
      name: "Umbenannt auf Ebene 1",
    });

    canvas.drillDown("Sub_L1");
    canvas.drillUp();

    const xml = await canvas.exportXml();
    expect(xml).toContain("Umbenannt auf Ebene 1");
    canvas.destroy();
  });
});
