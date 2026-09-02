/// <reference lib="dom" />

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { renderScene } from "../../src/draw/StaticRenderer.js";
import { importXml } from "../../src/model/index.js";
import { BpmnCanvas } from "../../src/viewer/BpmnCanvas.js";
import { decorateGrc } from "../../src/grc/decorate.js";
import { buildOverlayModel } from "../../src/grc/engine.js";
import { badgesOf, GrcBadgeCursor } from "../../src/grc/announce.js";
import { openFindingsFilter } from "../../src/grc/catalog.js";
import type { GrcInteraction } from "../../src/grc/contract.js";
import { viewById } from "../../src/grc/views.js";
import { GRC_PALETTE } from "../../src/grc/tokens.js";
import { installSvgPolyfills } from "../draw/helpers/jsdom-svg.js";
import {
  bankPrivacyData,
  bankSodData,
  largeProcessData,
  procurementComplianceData,
  salesRiskControlData,
  tourOutageData,
} from "./fixtures.js";
import { corpusScene, corpusXml } from "./helpers.js";

/**
 * Die Zeichenschicht der GRC-Überlagerung.
 *
 * Geprüft wird beides: das statische SVG (Export, Beleg, serverseitiges Rendern)
 * und die `diagram-js`-Fläche — die Dekoration muss in beiden Einbettungen an
 * der Form kleben.
 */

beforeAll(() => {
  installSvgPolyfills();
});

async function staticDecoration(
  corpus: string,
  data: Parameters<typeof buildOverlayModel>[1],
  view: string,
  options: {
    legend?: boolean;
    onInteract?: (event: GrcInteraction) => void;
  } = {},
) {
  const scene = await corpusScene(corpus);
  const model = buildOverlayModel(scene, data, { view: viewById(view) });
  const rendered = renderScene(scene, { padding: 60 });
  const result = decorateGrc({
    root: rendered.svg,
    model,
    legend: options.legend ?? false,
    ...(options.onInteract ? { onInteract: options.onInteract } : {}),
  });
  return { scene, model, svg: rendered.svg, result };
}

describe("Elementdekoration im statischen SVG", () => {
  it("zeichnet Badges in die Elementgruppe, nicht daneben", async () => {
    const { svg } = await staticDecoration(
      "repo-prd-sales-with-gateway",
      salesRiskControlData(),
      "risk-control",
    );
    const group = svg.querySelector('[data-element-id="Task_offer"]');
    expect(group).not.toBeNull();
    const badges = group?.querySelectorAll('[data-grc="badge"]') ?? [];
    expect(badges.length).toBeGreaterThan(0);
    expect(badges.length).toBeLessThanOrEqual(4);
  });

  it("färbt die tragende Kontur ein, statt eine Fläche darüber zu legen", async () => {
    const { svg } = await staticDecoration(
      "repo-prd-sales-with-gateway",
      salesRiskControlData(),
      "risk-control",
    );
    const outline = svg.querySelector(
      '[data-element-id="Task_offer"] .bpmn-outline',
    );
    // „Angebot erstellen" trägt ein unkontrolliertes Risiko → rote Tönung.
    expect(outline?.getAttribute("fill")).toBe(GRC_PALETTE.critical.tint);
    // Die ursprüngliche Füllung ist gesichert und wird beim Aufräumen
    // zurückgestellt.
    expect(outline?.getAttribute("data-grc-base-fill")).toBe("#ffffff");
    // Kontur und Beschriftung bleiben unangetastet und liegen darüber.
    expect(outline?.getAttribute("stroke")).toBe("#12181f");
    const texts = svg.querySelectorAll('[data-element-id="Task_offer"] tspan');
    expect(texts.length).toBeGreaterThan(0);
  });

  it("stellt die Füllung beim Aufräumen wieder her", async () => {
    const scene = await corpusScene("repo-prd-sales-with-gateway");
    const model = buildOverlayModel(scene, salesRiskControlData(), {
      view: viewById("risk-control"),
    });
    const rendered = renderScene(scene, { padding: 60 });
    const result = decorateGrc({ root: rendered.svg, model });
    result.destroy();
    expect(
      rendered.svg
        .querySelector('[data-element-id="Task_offer"] .bpmn-outline')
        ?.getAttribute("fill"),
    ).toBe("#ffffff");
  });

  it("kodiert die Stufe zusätzlich über eine Schraffur", async () => {
    const { svg } = await staticDecoration(
      "repo-prd-sales-with-gateway",
      salesRiskControlData(),
      "risk-control",
    );
    const hatch = svg.querySelector(
      '[data-element-id="Task_offer"] [data-grc="hatch"]',
    );
    expect(hatch).not.toBeNull();
    const pattern = svg.querySelector("#arctos-grc-defs pattern");
    expect(pattern).not.toBeNull();
    expect(pattern?.getAttribute("patternUnits")).toBe("userSpaceOnUse");
  });

  it("folgt der BPMN-Form: Kreis am Ereignis, Raute am Gateway", async () => {
    const { svg } = await staticDecoration(
      "repo-prd-sales-with-gateway",
      salesRiskControlData(),
      "risk-control",
    );
    const gateway = svg
      .querySelector('[data-element-id="Gateway_1"] [data-grc="hatch"]')
      ?.getAttribute("d");
    expect(gateway).toBeTruthy();
    // Raute: vier Ecken, kein Bogen.
    expect(gateway).not.toContain("A ");
    expect((gateway ?? "").split("L").length).toBe(4);
  });

  it("zeichnet die LoD-Kante an die linke Elementkante", async () => {
    const { svg, scene } = await staticDecoration(
      "repo-prd-sales-with-gateway",
      salesRiskControlData(),
      "risk-control",
    );
    const stripe = svg.querySelector(
      '[data-element-id="Task_offer"] [data-grc="stripe"]',
    );
    const shape = scene.shapes.find((entry) => entry.id === "Task_offer");
    expect(stripe).not.toBeNull();
    expect(Number(stripe?.getAttribute("x"))).toBeCloseTo(shape!.x - 3, 3);
    expect(Number(stripe?.getAttribute("height"))).toBe(shape!.height);
  });

  it("setzt die Pin-Schiene links außerhalb — sie konkurriert mit keinem Befund", async () => {
    const { svg, scene } = await staticDecoration(
      "repo-prd-sales-with-gateway",
      salesRiskControlData(),
      "risk-control",
    );
    const pin = svg.querySelector(
      '[data-element-id="Task_qualify"] [data-grc="pin"]',
    );
    expect(pin).not.toBeNull();
    const shape = scene.shapes.find((entry) => entry.id === "Task_qualify");
    const cx = Number(
      /M (-?[\d.]+)/.exec(
        pin?.querySelector("path")?.getAttribute("d") ?? "",
      )?.[1],
    );
    expect(cx).toBeLessThan(shape!.x);
  });

  it("schreibt die Gutter-Zeile unter das Shape, höchstens drei Kennzahlen", async () => {
    const { svg } = await staticDecoration(
      "repo-seed-tour-planning",
      tourOutageData(),
      "continuity",
    );
    const gutter = svg.querySelector(
      '[data-element-id="Task_TP_Route"] [data-grc="gutter"]',
    );
    expect(gutter?.textContent).toMatch(/RTO 2 h/);
    expect((gutter?.textContent ?? "").split("·").length).toBeLessThanOrEqual(
      3,
    );
  });

  it("zeichnet den Sammel-Badge, wenn mehr Signale anliegen als Slots da sind", async () => {
    const { svg, model } = await staticDecoration(
      "synth-large-flat-process",
      largeProcessData(),
      "risk-control",
    );
    const withOverflow = [...model.elements.values()].find(
      (decoration) => decoration.resolution.overflow,
    );
    expect(withOverflow).toBeDefined();
    const group = svg.querySelector(
      `[data-element-id="${withOverflow?.elementId ?? ""}"]`,
    );
    const texts = Array.from(group?.querySelectorAll("text") ?? []).map(
      (node) => node.textContent ?? "",
    );
    expect(texts.some((text) => text.startsWith("+"))).toBe(true);
  });
});

describe("Kanten und diagrammweite Dekoration", () => {
  it("zeichnet die Vertrauensgrenze als Doppelkante mit Länderchip", async () => {
    const { svg } = await staticDecoration(
      "synth-collaboration-pools-lanes",
      bankPrivacyData(),
      "privacy",
    );
    const edge = svg.querySelector(
      '[data-element-id="Flow_B2"] [data-grc="edge"]',
    );
    expect(edge).not.toBeNull();
    expect(edge?.querySelectorAll("path")).toHaveLength(2);
    expect(edge?.querySelector("text")?.textContent).toBe("US");
  });

  it("zeichnet den SoD-Bogen mit Schloss und beschriftet ihn", async () => {
    const { svg, result } = await staticDecoration(
      "synth-collaboration-pools-lanes",
      bankSodData(),
      "organization",
    );
    expect(result.arcs).toBe(1);
    const arc = svg.querySelector('[data-grc="arc"]');
    expect(arc).not.toBeNull();
    expect(arc?.querySelector(".arctos-grc-lock")).not.toBeNull();
    // Kurze Beschriftung am Bogen (die vollen Rollennamen stehen im Namen und
    // in der Liste — ein breiter Text würde sich über das Diagramm legen).
    expect(arc?.querySelector("text")?.textContent).toMatch(/^SoD: SB \/ SB$/);
    expect(
      svg.querySelector('[data-grc="arc"]')?.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  it("zeichnet die Kopfzeile der Ausfallsimulation", async () => {
    const { svg } = await staticDecoration(
      "repo-seed-tour-planning",
      tourOutageData(),
      "continuity",
    );
    const banner = svg.querySelector('[data-grc="banner"] text');
    expect(banner?.textContent).toMatch(/Ausfall „DispoSuite"/);
    expect(banner?.textContent).toMatch(/Reißpunkt/);
  });

  it("zeichnet beobachtete, nicht modellierte Pfade als Geisterkante", async () => {
    const { svg } = await staticDecoration(
      "synth-large-flat-process",
      largeProcessData(),
      "operations",
    );
    const ghost = svg.querySelector('[data-grc="ghost-edge"]');
    expect(ghost).not.toBeNull();
    expect(ghost?.querySelector("text")?.textContent).toBe("12 %");
  });

  it("zeichnet die Legende nur auf Wunsch und nennt darin die Abdeckungsquote", async () => {
    const without = await staticDecoration(
      "repo-prd-procurement",
      procurementComplianceData(),
      "compliance",
    );
    expect(without.svg.querySelector('[data-grc="legend"]')).toBeNull();

    const withLegend = await staticDecoration(
      "repo-prd-procurement",
      procurementComplianceData(),
      "compliance",
      { legend: true },
    );
    const legendText = Array.from(
      withLegend.svg.querySelectorAll('[data-grc="legend"] text'),
    )
      .map((node) => node.textContent ?? "")
      .join(" ");
    expect(legendText).toMatch(/Abdeckungsgrad/);
    expect(legendText).toMatch(/Stand/);
  });
});

describe("Barrierefreiheit der Dekoration", () => {
  it("hängt jede sichtbare Angabe an den zugänglichen Namen", async () => {
    const { svg, model } = await staticDecoration(
      "repo-prd-sales-with-gateway",
      salesRiskControlData(),
      "risk-control",
    );
    for (const decoration of model.elements.values()) {
      const label =
        svg
          .querySelector(`[data-element-id="${decoration.elementId}"]`)
          ?.getAttribute("aria-label") ?? "";
      for (const sentence of decoration.descriptions) {
        expect(label, decoration.elementId).toContain(sentence);
      }
    }
  });

  it("macht jede Dekoration für Screenreader unsichtbar — der Name trägt sie", async () => {
    const { svg } = await staticDecoration(
      "repo-prd-sales-with-gateway",
      salesRiskControlData(),
      "risk-control",
    );
    for (const node of Array.from(svg.querySelectorAll("[data-grc]"))) {
      if (node.getAttribute("data-grc") === "defs") {
        continue;
      }
      const hidden =
        node.getAttribute("aria-hidden") === "true" ||
        node.closest('[aria-hidden="true"]') !== null;
      expect(hidden, node.getAttribute("data-grc") ?? "").toBe(true);
    }
  });

  it("verlängert den Namen bei wiederholtem Zeichnen nicht", async () => {
    const scene = await corpusScene("repo-prd-sales-with-gateway");
    const model = buildOverlayModel(scene, salesRiskControlData(), {
      view: viewById("risk-control"),
    });
    const rendered = renderScene(scene, { padding: 60 });

    decorateGrc({ root: rendered.svg, model });
    const first = rendered.svg
      .querySelector('[data-element-id="Task_offer"]')
      ?.getAttribute("aria-label");
    decorateGrc({ root: rendered.svg, model });
    const second = rendered.svg
      .querySelector('[data-element-id="Task_offer"]')
      ?.getAttribute("aria-label");

    expect(second).toBe(first);
  });

  it("stellt beim Aufräumen den ursprünglichen Namen wieder her", async () => {
    const scene = await corpusScene("repo-prd-sales-with-gateway");
    const model = buildOverlayModel(scene, salesRiskControlData(), {
      view: viewById("risk-control"),
    });
    const rendered = renderScene(scene, { padding: 60 });
    const before = rendered.svg
      .querySelector('[data-element-id="Task_offer"]')
      ?.getAttribute("aria-label");

    const result = decorateGrc({ root: rendered.svg, model });
    result.destroy();

    expect(
      rendered.svg
        .querySelector('[data-element-id="Task_offer"]')
        ?.getAttribute("aria-label"),
    ).toBe(before);
    expect(rendered.svg.querySelectorAll("[data-grc]")).toHaveLength(0);
  });

  it("blendet gefilterte Elemente ab, entfernt sie aber nicht", async () => {
    const scene = await corpusScene("repo-prd-sales-with-gateway");
    const model = buildOverlayModel(scene, salesRiskControlData(), {
      view: viewById("risk-control"),
      filter: openFindingsFilter,
    });
    const rendered = renderScene(scene, { padding: 60 });
    decorateGrc({ root: rendered.svg, model });

    const dimmed = rendered.svg.querySelector(
      '[data-element-id="Task_qualify"]',
    );
    expect(dimmed?.getAttribute("data-grc-dimmed")).toBe("true");
    expect(dimmed?.getAttribute("opacity")).toBe("0.25");
    // Nichts verschwindet: das Element ist weiterhin da und benannt.
    expect(dimmed?.getAttribute("aria-label")).toBeTruthy();
    expect(
      rendered.svg.querySelectorAll('[style*="display: none"]'),
    ).toHaveLength(0);
  });
});

describe("Interaktion nach oben", () => {
  it("meldet einen Badge-Klick mit Layer, Slot und den Objekten dahinter", async () => {
    const events: GrcInteraction[] = [];
    const { svg } = await staticDecoration(
      "repo-prd-sales-with-gateway",
      salesRiskControlData(),
      "risk-control",
      { onInteract: (event) => events.push(event) },
    );
    const badge = svg.querySelector(
      '[data-element-id="Task_offer"] [data-grc="badge"]',
    );
    badge?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(events).toHaveLength(1);
    const event = events[0];
    expect(event?.type).toBe("badge.activate");
    if (event?.type === "badge.activate") {
      expect(event.elementId).toBe("Task_offer");
      expect(event.refs.length).toBeGreaterThan(0);
    }
  });

  it("meldet den Sammel-Badge mit der Liste der verdrängten Signale", async () => {
    const events: GrcInteraction[] = [];
    const { svg, model } = await staticDecoration(
      "synth-large-flat-process",
      largeProcessData(),
      "risk-control",
      { onInteract: (event) => events.push(event) },
    );
    const target = [...model.elements.values()].find(
      (decoration) => decoration.resolution.overflow,
    );
    const group = svg.querySelector(
      `[data-element-id="${target?.elementId ?? ""}"]`,
    );
    const overflowBadge = Array.from(
      group?.querySelectorAll('[data-grc-interactive="overflow.open"]') ?? [],
    )[0];
    overflowBadge?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const event = events[0];
    expect(event?.type).toBe("overflow.open");
    if (event?.type === "overflow.open") {
      expect(event.suppressed.length).toBeGreaterThan(0);
    }
  });

  it("meldet Pin, Kante und Bogen mit eigenen Ereignistypen", async () => {
    const events: GrcInteraction[] = [];
    const { svg } = await staticDecoration(
      "synth-collaboration-pools-lanes",
      bankSodData(),
      "organization",
      { onInteract: (event) => events.push(event) },
    );
    svg
      .querySelector('[data-grc="arc"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    svg
      .querySelector('[data-grc="pin"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(events.map((event) => event.type)).toContain("arc.activate");
    expect(events.map((event) => event.type)).toContain("pin.open");
  });

  it("hört nach destroy() nicht mehr zu", async () => {
    const events: GrcInteraction[] = [];
    const { svg, result } = await staticDecoration(
      "repo-prd-sales-with-gateway",
      salesRiskControlData(),
      "risk-control",
      { onInteract: (event) => events.push(event) },
    );
    result.destroy();
    svg.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(events).toHaveLength(0);
  });
});

describe("Tastaturbedienung der Badges (. und ,)", () => {
  it("durchläuft die Badges des fokussierten Elements und sagt sie an", async () => {
    const scene = await corpusScene("repo-prd-sales-with-gateway");
    const model = buildOverlayModel(scene, salesRiskControlData(), {
      view: viewById("risk-control"),
    });
    const announced: string[] = [];
    const cursor = new GrcBadgeCursor(model, {
      announce: (message) => announced.push(message),
      focusedElementId: () => "Task_offer",
    });

    expect(cursor.handleKey(new KeyboardEvent("keydown", { key: "." }))).toBe(
      true,
    );
    expect(cursor.handleKey(new KeyboardEvent("keydown", { key: "." }))).toBe(
      true,
    );
    expect(announced).toHaveLength(2);
    expect(announced[0]).toMatch(/Hinweis 1 von/);
    expect(announced[1]).toMatch(/Hinweis 2 von/);
    expect(announced.join(" ")).toMatch(/Risik|Kontroll|Feststellung/);
  });

  it("löst auf einem durchlaufenen Badge dasselbe Ereignis aus wie ein Klick", async () => {
    const scene = await corpusScene("repo-prd-sales-with-gateway");
    const model = buildOverlayModel(scene, salesRiskControlData(), {
      view: viewById("risk-control"),
    });
    const events: GrcInteraction[] = [];
    const cursor = new GrcBadgeCursor(
      model,
      { announce: () => undefined, focusedElementId: () => "Task_offer" },
      (event) => events.push(event),
    );
    cursor.handleKey(new KeyboardEvent("keydown", { key: "." }));
    cursor.handleKey(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(events[0]?.type).toMatch(/badge.activate|overflow.open|pin.open/);
  });

  it("meldet ehrlich, wenn ein Element keine Hinweise trägt", async () => {
    const scene = await corpusScene("repo-prd-sales-with-gateway");
    const model = buildOverlayModel(scene, salesRiskControlData(), {
      view: viewById("risk-control"),
    });
    const announced: string[] = [];
    const cursor = new GrcBadgeCursor(model, {
      announce: (message) => announced.push(message),
      focusedElementId: () => "Start_1",
    });
    cursor.handleKey(new KeyboardEvent("keydown", { key: "." }));
    expect(announced[0]).toMatch(/keine GRC-Hinweise/);
  });

  it("badgesOf nennt Badges, Sammel-Badge und Pin in fester Reihenfolge", async () => {
    const scene = await corpusScene("repo-prd-sales-with-gateway");
    const model = buildOverlayModel(scene, salesRiskControlData(), {
      view: viewById("risk-control"),
    });
    const entries = badgesOf(model, "Task_offer");
    expect(entries.length).toBeGreaterThan(1);
    expect(entries.every((entry) => entry.describe.length > 0)).toBe(true);
  });
});

describe("Einbettung in die diagram-js-Fläche", () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.replaceChildren();
    container = document.createElement("div");
    container.style.width = "1200px";
    container.style.height = "800px";
    document.body.appendChild(container);
  });

  it("dekoriert die Canvas-Elementgruppen und folgt ihrer Verschiebung", async () => {
    const canvas = new BpmnCanvas({ container, importXml });
    const imported = await canvas.importXml(
      corpusXml("repo-prd-sales-with-gateway"),
    );
    const model = buildOverlayModel(imported.scene, salesRiskControlData(), {
      view: viewById("risk-control"),
    });
    const result = decorateGrc({ root: container, model });

    expect(result.decoratedElements).toBeGreaterThan(0);
    const group = container.querySelector('[data-element-id="Task_offer"]');
    const badge = group?.querySelector('[data-grc="badge"] rect');
    const outline = group?.querySelector(".bpmn-outline");
    expect(badge).not.toBeNull();
    // Dekoration und Visual liegen in derselben Gruppe und damit unter
    // derselben Transformation — die Badge-Position folgt dem Shape.
    expect(Number(badge?.getAttribute("x"))).toBeGreaterThan(
      Number(outline?.getAttribute("x")) - 40,
    );
    result.destroy();
    canvas.destroy();
  });

  it("hängt die diagrammweite Dekoration in den Viewport", async () => {
    const canvas = new BpmnCanvas({ container, importXml });
    const imported = await canvas.importXml(
      corpusXml("synth-collaboration-pools-lanes"),
    );
    const model = buildOverlayModel(imported.scene, bankSodData(), {
      view: viewById("organization"),
    });
    decorateGrc({ root: container, model });

    const overlay = container.querySelector(".viewport .arctos-grc-overlay");
    expect(overlay).not.toBeNull();
    expect(overlay?.querySelector('[data-grc="arc"]')).not.toBeNull();
    canvas.destroy();
  });
});
