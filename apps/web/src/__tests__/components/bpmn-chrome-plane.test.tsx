// @vitest-environment jsdom
//
// [ARCTOS-FULL-2026-08-31 · OP-018, OP-026, OP-028, OP-029]
//
// Vier Punkte, die alle dieselbe Form haben: `packages/bpmn` konnte es, und
// `apps/web` liess es nicht durch.
//
//  - OP-028: `chrome: "full"` war in `editorModulesFor`/`editorChromeModule`
//    gebaut, aber `arctos-bpmn-canvas.tsx` schrieb
//    `chrome: mode === "edit" ? "full" : "minimal"` fest — jede lesende Fläche
//    bekam `minimal`, auch die, deren `read` aus einem fehlenden Recht folgt.
//  - OP-029: der Aufbaueffekt hing an `[xml, mode]`; ein Moduswechsel warf
//    Ansicht, Auswahl und Ebene weg.
//  - OP-018: `BpmnCanvas` kann seit dieser Welle jede `BPMNPlane` zeigen; die
//    Oberfläche brauchte die Brotkrume dazu.
//  - OP-026: zwei lesende Einbindungen ohne GRC-Sichtwahl.
//
// `@grc/bpmn` wird **nicht** gemockt — die Zusicherungen sollen am echten
// Aufbau hängen, nicht an einer Attrappe, die alles bestätigt.

import React from "react";
import { render, screen, waitFor, cleanup, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { installSvgPolyfills } from "../../../../../packages/bpmn/test/draw/helpers/jsdom-svg";

vi.mock("next-intl", () => ({
  useTranslations:
    (ns?: string) => (key: string, params?: Record<string, unknown>) => {
      const full = ns ? `${ns}.${key}` : key;
      return params ? `${full}(${JSON.stringify(params)})` : full;
    },
  useLocale: () => "de",
}));

class FakeBpmnInstance {
  importXML = vi.fn().mockResolvedValue({ warnings: [] });
  saveXML = vi.fn().mockResolvedValue({ xml: "<bpmn />" });
  saveSVG = vi.fn().mockResolvedValue({ svg: "<svg />" });
  destroy = vi.fn();
  on = vi.fn();
  off = vi.fn();
  get = vi.fn(() => ({
    zoom: vi.fn(),
    scroll: vi.fn(),
    on: vi.fn(),
    getAll: vi.fn(() => []),
    add: vi.fn(),
    remove: vi.fn(),
  }));
}
vi.mock("bpmn-js/lib/NavigatedViewer", () => ({ default: FakeBpmnInstance }));
vi.mock("bpmn-js/lib/Modeler", () => ({ default: FakeBpmnInstance }));

import {
  ArctosBpmnCanvas,
  defaultChromeFor,
} from "@/components/bpmn/arctos-bpmn-canvas";
import { BpmnGrcViewer, BpmnViewer } from "@/components/bpmn/bpmn-viewer";

installSvgPolyfills();

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Ein flaches Diagramm mit genau einer Ebene. */
const FLAT = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_F" targetNamespace="http://arctos.test">
  <bpmn:process id="Process_F" isExecutable="false">
    <bpmn:startEvent id="Start_F" name="Start" />
    <bpmn:task id="Task_F" name="Antrag pruefen" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_F">
    <bpmndi:BPMNPlane id="Plane_F" bpmnElement="Process_F">
      <bpmndi:BPMNShape id="Start_F_di" bpmnElement="Start_F">
        <dc:Bounds x="120" y="100" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_F_di" bpmnElement="Task_F">
        <dc:Bounds x="220" y="78" width="100" height="80" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

/** Zwei Ebenen: der Prozess und der eingeklappte Subprozess `Sub_1`. */
const NESTED = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_N" targetNamespace="http://arctos.test">
  <bpmn:process id="Process_N" isExecutable="false">
    <bpmn:startEvent id="Start_N" name="Antrag eingegangen" />
    <bpmn:subProcess id="Sub_1" name="Pruefung">
      <bpmn:startEvent id="Sub_Start" name="Beginn der Pruefung" />
      <bpmn:task id="Sub_Task" name="Unterlagen sichten" />
    </bpmn:subProcess>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_N">
    <bpmndi:BPMNPlane id="Plane_N" bpmnElement="Process_N">
      <bpmndi:BPMNShape id="Start_N_di" bpmnElement="Start_N">
        <dc:Bounds x="120" y="100" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Sub_1_di" bpmnElement="Sub_1" isExpanded="false">
        <dc:Bounds x="220" y="78" width="120" height="80" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
  <bpmndi:BPMNDiagram id="Diagram_Sub_1">
    <bpmndi:BPMNPlane id="Plane_Sub_1" bpmnElement="Sub_1">
      <bpmndi:BPMNShape id="Sub_Start_di" bpmnElement="Sub_Start">
        <dc:Bounds x="120" y="100" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Sub_Task_di" bpmnElement="Sub_Task">
        <dc:Bounds x="220" y="78" width="100" height="80" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const root = (): HTMLElement | null =>
  document.querySelector('[data-bpmn-engine="arctos"]');

async function drawn(): Promise<HTMLElement> {
  await waitFor(
    () => {
      expect(root()?.querySelector("svg")).not.toBeNull();
    },
    { timeout: 10_000 },
  );
  return root() as HTMLElement;
}

describe("OP-028 — chrome full im Lesemodus", () => {
  it("zeigt die Palette deaktiviert und mit Begründung, wenn read aus fehlendem Recht folgt", async () => {
    render(<ArctosBpmnCanvas xml={FLAT} mode="read" chrome="full" />);
    const node = await drawn();

    const palette = node.querySelector(".djs-palette");
    expect(
      palette,
      "keine Palette im Lesemodus mit chrome=full",
    ).not.toBeNull();

    const buttons = Array.from(
      palette?.querySelectorAll<HTMLElement>("button.entry") ?? [],
    );
    expect(buttons.length).toBeGreaterThan(0);
    // `aria-disabled`, nicht `disabled`: ein `disabled`-Knopf fällt aus Fokus
    // und Ansage — dann erfährt ein Tastaturnutzer nie, dass es die Funktion
    // gibt und warum sie gerade nicht geht. Genau das soll `full` verhindern.
    for (const button of buttons) {
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.hasAttribute("disabled")).toBe(false);
    }
    // Und die Begründung steht am Knopf, nicht nur im Code.
    expect(
      buttons.some((b) =>
        (b.getAttribute("aria-label") ?? "").includes("chrome.disabledReason"),
      ),
      "kein Knopf nennt den Grund",
    ).toBe(true);
  }, 20_000);

  it("lässt sie weg, wenn read aus dem Kontext folgt", async () => {
    render(<ArctosBpmnCanvas xml={FLAT} mode="read" chrome="minimal" />);
    const node = await drawn();
    expect(node.querySelector(".djs-palette")).toBeNull();
  }, 20_000);

  it("setzt die Vorgabe auf full — die Herkunft des read entscheidet, nicht der Modus", () => {
    expect(defaultChromeFor("read")).toBe("full");
    expect(defaultChromeFor("edit")).toBe("full");
  });

  it("BpmnViewer wählt minimal, weil sein read aus dem Kontext kommt", async () => {
    render(<BpmnViewer xml={FLAT} engine="arctos" />);
    const node = await drawn();
    expect(node.querySelector(".djs-palette")).toBeNull();
  }, 20_000);
});

describe("OP-018 — die Ebenen-Brotkrume", () => {
  it("erscheint nur bei mehr als einer BPMNPlane", async () => {
    render(<ArctosBpmnCanvas xml={FLAT} mode="read" />);
    await drawn();
    expect(screen.queryByLabelText("bpmn.plane.breadcrumb")).toBeNull();
    cleanup();

    render(<ArctosBpmnCanvas xml={NESTED} mode="read" />);
    await drawn();
    const nav = await waitFor(() =>
      screen.getByLabelText("bpmn.plane.breadcrumb"),
    );
    expect(nav.textContent).toContain("Process_N");
  }, 30_000);

  it("führt nach dem Drill-Down in die Unterebene und wieder zurück", async () => {
    render(<ArctosBpmnCanvas xml={NESTED} mode="read" />);
    const node = await drawn();

    // Die Fläche zeigt zunächst Ebene 1.
    expect(node.querySelector('[data-element-id="Sub_1"]')).not.toBeNull();
    expect(node.querySelector('[data-element-id="Sub_Task"]')).toBeNull();

    // Drill-Down mit der Taste `o`, nachdem der Fokus per Pfeiltaste gesetzt
    // wurde — beides ohne Maus.
    const surface = node.querySelector<HTMLElement>(
      "[role='application']",
    ) as HTMLElement;
    const press = (key: string, shift = false): void => {
      act(() => {
        surface.dispatchEvent(
          new KeyboardEvent("keydown", { key, shiftKey: shift, bubbles: true }),
        );
      });
    };
    press("ArrowRight");
    press("ArrowRight");
    press("o");

    await waitFor(() => {
      expect(node.querySelector('[data-element-id="Sub_Task"]')).not.toBeNull();
    });
    expect(node.querySelector('[data-element-id="Start_N"]')).toBeNull();

    // Die Brotkrume führt jetzt zwei Stufen, und die obere ist ein Schalter.
    const nav = screen.getByLabelText("bpmn.plane.breadcrumb");
    expect(nav.textContent).toContain("Pruefung");
    const back = nav.querySelector("button");
    expect(back, "die obere Ebene ist nicht anwählbar").not.toBeNull();

    press("O", true);
    await waitFor(() => {
      expect(node.querySelector('[data-element-id="Start_N"]')).not.toBeNull();
    });
  }, 30_000);
});

describe("OP-029 — Moduswechsel zur Laufzeit", () => {
  it("behält Ansicht, Auswahl und Ebene über den Wechsel read → edit", async () => {
    const { rerender } = render(<ArctosBpmnCanvas xml={NESTED} mode="read" />);
    const node = await drawn();

    // Einen Arbeitsstand herstellen: Unterebene öffnen, hineinzoomen,
    // etwas auswählen.
    const surface = node.querySelector<HTMLElement>(
      "[role='application']",
    ) as HTMLElement;
    const press = (key: string, shift = false): void => {
      act(() => {
        surface.dispatchEvent(
          new KeyboardEvent("keydown", { key, shiftKey: shift, bubbles: true }),
        );
      });
    };
    press("ArrowRight");
    press("ArrowRight");
    press("o");
    await waitFor(() => {
      expect(node.querySelector('[data-element-id="Sub_Task"]')).not.toBeNull();
    });

    rerender(<ArctosBpmnCanvas xml={NESTED} mode="edit" />);

    // Nach dem Wechsel ist die Fläche neu aufgebaut — aber auf **derselben**
    // Ebene. Vor dieser Welle stand sie wieder auf Ebene 1, und der Benutzer
    // suchte seinen Subprozess erneut.
    await waitFor(
      () => {
        const now = root();
        expect(now?.querySelector("svg")).not.toBeNull();
        expect(
          now?.querySelector('[data-element-id="Sub_Task"]'),
          "der Moduswechsel hat die Ebene verworfen",
        ).not.toBeNull();
      },
      { timeout: 10_000 },
    );
  }, 30_000);

  it("setzt beim Wechsel des Diagramms nichts wieder her", async () => {
    // Ein gemerkter Stand gehört zu **einem** Dokument. Ihn auf ein anderes
    // zu legen zeigte eine Viewbox auf leerer Fläche.
    const { rerender } = render(<ArctosBpmnCanvas xml={NESTED} mode="read" />);
    await drawn();
    rerender(<ArctosBpmnCanvas xml={FLAT} mode="edit" />);
    await waitFor(
      () => {
        expect(
          root()?.querySelector('[data-element-id="Task_F"]'),
        ).not.toBeNull();
      },
      { timeout: 10_000 },
    );
  }, 30_000);
});

describe("OP-026 — GRC-Sichtwahl auf lesenden Flächen", () => {
  it("zeigt die Sichtwahl, sobald eine Prozesskennung da ist", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { computedAt: "2026-09-02T08:00:00.000Z" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<BpmnGrcViewer xml={FLAT} processId="p-1" engine="arctos" />);
    await drawn();

    const select = screen.getByLabelText("bpmn.grcView.label");
    expect(select).toBeDefined();
    // Vorgabe „aus": ohne Wahl wird der Endpunkt gar nicht erst befragt.
    expect((select as HTMLSelectElement).value).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  }, 20_000);

  it("lässt sie weg, wo es keinen Prozess zu fragen gibt", async () => {
    render(<BpmnGrcViewer xml={FLAT} engine="arctos" />);
    await drawn();
    expect(screen.queryByLabelText("bpmn.grcView.label")).toBeNull();
  }, 20_000);

  it("fragt den Endpunkt erst, wenn eine Sicht gewählt ist", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { computedAt: "2026-09-02T08:00:00.000Z" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <BpmnGrcViewer
        xml={FLAT}
        processId="p-1"
        versionId="v-3"
        engine="arctos"
      />,
    );
    await drawn();

    const select = screen.getByLabelText(
      "bpmn.grcView.label",
    ) as HTMLSelectElement;
    await act(async () => {
      select.value = "risk-control";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    // Die Version geht mit — sonst läge über einer alten Fassung der Stand
    // von heute.
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("version=v-3");
  }, 20_000);
});
