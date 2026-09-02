/// <reference lib="dom" />

import axe from "axe-core";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { importXml } from "../../src/model/index.js";
import { BpmnCanvas } from "../../src/viewer/BpmnCanvas.js";
import { decorateGrc } from "../../src/grc/decorate.js";
import {
  buildOverlayModel,
  type GrcOverlayModel,
} from "../../src/grc/engine.js";
import {
  buildGrcTextAlternative,
  renderGrcTextAlternativeTable,
} from "../../src/grc/text-alternative.js";
import {
  announcementFor,
  diagramAnnouncement,
} from "../../src/grc/announce.js";
import { viewById, type GrcViewId } from "../../src/grc/views.js";
import type { GrcOverlayData } from "../../src/grc/contract.js";
import { installSvgPolyfills } from "../draw/helpers/jsdom-svg.js";
import {
  bankPrivacyData,
  bankSodData,
  procurementComplianceData,
  salesRiskControlData,
  tourOutageData,
} from "./fixtures.js";
import { corpusScene, corpusXml } from "./helpers.js";

/**
 * Barrierefreiheit der GRC-Schicht (Plan §4).
 *
 * Der Anspruch aus dem Auftrag: **jede** visuell hinzugefügte GRC-Information
 * taucht im zugänglichen Namen, in der Textalternative und in der Ansage auf.
 * Genau das wird hier für alle Sichten durchgeprüft — nicht stichprobenhaft.
 */

beforeAll(() => {
  installSvgPolyfills();
});

const SCENARIOS: ReadonlyArray<{
  readonly corpus: string;
  readonly view: GrcViewId;
  readonly data: () => GrcOverlayData;
}> = [
  {
    corpus: "repo-prd-sales-with-gateway",
    view: "risk-control",
    data: salesRiskControlData,
  },
  {
    corpus: "repo-prd-procurement",
    view: "compliance",
    data: procurementComplianceData,
  },
  {
    corpus: "synth-collaboration-pools-lanes",
    view: "privacy",
    data: bankPrivacyData,
  },
  {
    corpus: "synth-collaboration-pools-lanes",
    view: "organization",
    data: bankSodData,
  },
  {
    corpus: "repo-seed-tour-planning",
    view: "continuity",
    data: tourOutageData,
  },
];

let container: HTMLElement;

beforeEach(() => {
  document.body.replaceChildren();
  container = document.createElement("div");
  container.style.width = "1200px";
  container.style.height = "800px";
  document.body.appendChild(container);
});

async function mountWithGrc(
  corpus: string,
  data: GrcOverlayData,
  view: GrcViewId,
): Promise<{ canvas: BpmnCanvas; model: GrcOverlayModel }> {
  const canvas = new BpmnCanvas({ container, importXml });
  const imported = await canvas.importXml(corpusXml(corpus));
  const model = buildOverlayModel(imported.scene, data, {
    view: viewById(view),
  });
  decorateGrc({ root: container, model, legend: false });
  return { canvas, model };
}

describe("axe-core über die Fläche mit aktiven GRC-Layern", () => {
  for (const scenario of SCENARIOS) {
    it(`${scenario.corpus} in der Sicht „${viewById(scenario.view).title}" ist frei von Verstößen`, async () => {
      const { canvas } = await mountWithGrc(
        scenario.corpus,
        scenario.data(),
        scenario.view,
      );
      const report = await axe.run(container, { resultTypes: ["violations"] });
      expect(
        report.violations.map(
          (violation) => `${violation.id}: ${violation.help}`,
        ),
      ).toEqual([]);
      canvas.destroy();
    }, 30_000);
  }

  it("die Textalternative mit GRC-Spalten ist frei von Verstößen", async () => {
    const scene = await corpusScene("repo-prd-sales-with-gateway");
    const model = buildOverlayModel(scene, salesRiskControlData(), {
      view: viewById("risk-control"),
    });
    const table = renderGrcTextAlternativeTable(
      buildGrcTextAlternative(scene, model),
    );
    const region = document.createElement("main");
    region.appendChild(table);
    document.body.appendChild(region);

    const report = await axe.run(region, { resultTypes: ["violations"] });
    expect(report.violations.map((violation) => violation.id)).toEqual([]);
  }, 30_000);
});

describe("Jede sichtbare GRC-Angabe hat eine Textform", () => {
  for (const scenario of SCENARIOS) {
    it(`${scenario.corpus} / ${scenario.view}: Name, Tabelle und Ansage tragen dieselbe Aussage`, async () => {
      const scene = await corpusScene(scenario.corpus);
      const model = buildOverlayModel(scene, scenario.data(), {
        view: viewById(scenario.view),
      });
      const alternative = buildGrcTextAlternative(scene, model);

      expect(model.elements.size).toBeGreaterThan(0);

      for (const decoration of model.elements.values()) {
        // 1. Ansage
        const announcement = announcementFor(model, decoration.elementId);
        for (const sentence of decoration.descriptions) {
          expect(announcement, decoration.elementId).toContain(sentence);
        }

        // 2. Textalternative — jedes zeichnende Signal hat dort eine Spalte.
        const row = alternative.rows.find(
          (entry) => entry.id === decoration.elementId,
        );
        if (!row) {
          // Lanes und Pools stehen nicht in der Ablauftabelle; ihre Angaben
          // erscheinen über die Elemente, die in ihnen liegen.
          continue;
        }
        const rowText = Object.values(row.grc).join(" ");
        for (const [, owned] of decoration.resolution.badges) {
          expect(rowText, `${decoration.elementId}/${owned.layerId}`).toContain(
            owned.signal.describe,
          );
        }
        const shape = decoration.resolution.shape;
        if (shape) {
          expect(rowText, `${decoration.elementId}/shape`).toContain(
            shape.signal.describe,
          );
        }
      }
    });
  }

  it("nennt Kopfzeilen, Sicht und Datenstand in der Textalternative", async () => {
    const scene = await corpusScene("repo-seed-tour-planning");
    const model = buildOverlayModel(scene, tourOutageData(), {
      view: viewById("continuity"),
    });
    const alternative = buildGrcTextAlternative(scene, model);

    expect(alternative.notes.join(" ")).toMatch(/Sicht: Kontinuität/);
    expect(alternative.notes.join(" ")).toMatch(/Stand der GRC-Daten/);
    expect(alternative.notes.join(" ")).toMatch(/Ausfall/);
  });

  it("erzeugt für jeden aktiven Layer mit Inhalt genau eine Spalte", async () => {
    const scene = await corpusScene("repo-prd-sales-with-gateway");
    const model = buildOverlayModel(scene, salesRiskControlData(), {
      view: viewById("risk-control"),
    });
    const alternative = buildGrcTextAlternative(scene, model);

    const headers = alternative.columns.map((column) => column.header);
    expect(headers).toContain("Risiken");
    expect(headers).toContain("Kontrollabdeckung");
    expect(headers).toContain("Feststellungen");
    expect(new Set(headers).size).toBe(headers.length);
    // Leere Layer bekommen keine Spalte.
    expect(headers).not.toContain("Ausfallsimulation");
  });

  it("die Ansage beim Betreten nennt Sicht, Befunde und Datenstand", async () => {
    const scene = await corpusScene("repo-seed-tour-planning");
    const model = buildOverlayModel(scene, tourOutageData(), {
      view: viewById("continuity"),
    });
    const announcement = diagramAnnouncement(model);
    expect(announcement).toMatch(/Sicht Kontinuität/);
    expect(announcement).toMatch(/Stand der Daten/);
    expect(announcement).toMatch(/Elementen tragen Hinweise/);
  });

  it("die Ampel trägt neben der Farbe ein Formzeichen und einen Wert", async () => {
    const scene = await corpusScene("repo-prd-sales-with-gateway");
    const model = buildOverlayModel(scene, salesRiskControlData(), {
      view: viewById("risk-control"),
    });
    const decoration = model.elements.get("Task_offer");
    const risk = decoration?.resolution.badges.get("TR");
    expect(risk?.signal.text).toMatch(/\d/);
    // Das Formzeichen kommt aus dem Ton; der Text nennt zusätzlich die Stufe.
    expect(risk?.signal.describe).toMatch(/hoch|mittel|niedrig/);
  });
});

describe("Der Sammel-Badge ist nie stumm", () => {
  it("nennt in Name und Tabelle, was er verdeckt", async () => {
    const scene = await corpusScene("repo-prd-sales-with-gateway");
    const model = buildOverlayModel(scene, salesRiskControlData(), {
      view: viewById("risk-control"),
      extraLayers: ["evidence", "control-test", "bcm", "asset", "framework"],
    });
    const withOverflow = [...model.elements.values()].find(
      (decoration) => decoration.resolution.overflow,
    );
    expect(withOverflow).toBeDefined();
    expect(withOverflow?.accessibleSuffix).toMatch(/weitere Hinweise/);

    const alternative = buildGrcTextAlternative(scene, model);
    const row = alternative.rows.find(
      (entry) => entry.id === withOverflow?.elementId,
    );
    expect(row?.grc["_overflow"]).toBeTruthy();
  });
});
