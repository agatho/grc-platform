// @vitest-environment jsdom
//
// Der Parallelbetrieb zweier BPMN-Engines, geprüft an der Schalterstellung.
//
// Was hier wirklich fehlschlagen kann — und deshalb geprüft wird:
//
//  1. Die Auflösung des Schalters (`ARCTOS_BPMN_ENGINE`) mit ihrer
//     Vorrangordnung. Ein falscher Vorrang liefert unbemerkt die falsche
//     Engine aus; die Vorgabe `legacy` ist die wichtigste Einzelaussage.
//  2. Die Weichen selbst: mit `engine="legacy"` muss `bpmn-js` instanziiert
//     werden, mit `engine="arctos"` **nicht** — und umgekehrt muss dann ein
//     echtes SVG aus `@grc/bpmn` im DOM stehen.
//  3. Dass beide Stellungen dieselbe Prop-Oberfläche annehmen. Das ist die
//     eigentliche Zusage des Adapters: keine Aufrufstelle ändert sich.
//  4. Die Brücke von den heutigen API-Antworten auf den GRC-Vertrag.
//
// `bpmn-js` wird gemockt (wie in `all-components-smoke.test.tsx`), damit der
// Legacy-Zweig ohne echten Renderer prüfbar bleibt. `@grc/bpmn` wird **nicht**
// gemockt: der ARCTOS-Zweig soll hier tatsächlich zeichnen.

import React from "react";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// jsdom setzt das SVG-DOM nur strukturell um: `getBBox`, `getCTM`,
// `createSVGPoint` und `transform.baseVal` fehlen, und `diagram-js` braucht
// genau die, um den Viewport zu rechnen. `@grc/bpmn` bringt die Rechenhilfe
// für seine eigenen Tests bereits mit — hier dieselbe, damit nicht eine
// zweite, abweichende Fassung entsteht. Im Browser ist nichts davon nötig.
import { installSvgPolyfills } from "../../../../../packages/bpmn/test/draw/helpers/jsdom-svg";

vi.mock("next-intl", () => ({
  useTranslations:
    (ns?: string) => (key: string, params?: Record<string, unknown>) => {
      const full = ns ? `${ns}.${key}` : key;
      return params ? `${full}(${JSON.stringify(params)})` : full;
    },
  useLocale: () => "de",
}));

const navigatedViewerCtor = vi.fn();

class FakeBpmnInstance {
  constructor(options: unknown) {
    navigatedViewerCtor(options);
  }
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

import { BPMN_ENGINE_DEFAULT, resolveBpmnEngine } from "@/lib/feature-flags";
import { BpmnViewer, viewerEngineFor } from "@/components/bpmn/bpmn-viewer";
import {
  BpmnEditor,
  editorEngineFor,
  modeFor,
  type BpmnEditorRef,
} from "@/components/bpmn/bpmn-editor";
import {
  buildGrcOverlayData,
  MISSING_TODAY,
} from "@/components/bpmn/bpmn-grc-bridge";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://arctos.test">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="Start_1" name="Antrag eingegangen">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:task id="Task_1" name="Antrag pruefen">
      <bpmn:incoming>Flow_1</bpmn:incoming>
    </bpmn:task>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_1">
    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1">
        <dc:Bounds x="120" y="100" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1">
        <dc:Bounds x="220" y="78" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="156" y="118" />
        <di:waypoint xmlns:di="http://www.omg.org/spec/DD/20100524/DI" x="220" y="118" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

installSvgPolyfills();

beforeEach(() => {
  navigatedViewerCtor.mockClear();
  delete globalThis.__ARCTOS_BPMN_ENGINE__;
});

afterEach(() => {
  cleanup();
  delete globalThis.__ARCTOS_BPMN_ENGINE__;
});

describe("Schalter ARCTOS_BPMN_ENGINE", () => {
  it("steht ohne Angabe auf legacy", () => {
    expect(BPMN_ENGINE_DEFAULT).toBe("legacy");
    expect(
      resolveBpmnEngine({ env: {}, url: null, globalOverride: null }),
    ).toBe("legacy");
  });

  it("nimmt beide Umgebungsvariablen, öffentlich vor serverseitig", () => {
    expect(
      resolveBpmnEngine({
        env: { ARCTOS_BPMN_ENGINE: "arctos" },
        url: null,
        globalOverride: null,
      }),
    ).toBe("arctos");
    expect(
      resolveBpmnEngine({
        env: {
          NEXT_PUBLIC_ARCTOS_BPMN_ENGINE: "arctos",
          ARCTOS_BPMN_ENGINE: "legacy",
        },
        url: null,
        globalOverride: null,
      }),
    ).toBe("arctos");
  });

  it("hält die Vorrangordnung ein: Prop > Adresszeile > global > Umgebung", () => {
    const base = {
      env: { ARCTOS_BPMN_ENGINE: "legacy" },
      url: "https://x/p?engine=arctos",
      globalOverride: "legacy",
    } as const;
    expect(resolveBpmnEngine({ ...base, explicit: "legacy" })).toBe("legacy");
    expect(resolveBpmnEngine(base)).toBe("arctos");
    expect(resolveBpmnEngine({ ...base, url: null })).toBe("legacy");
    expect(
      resolveBpmnEngine({ ...base, url: null, globalOverride: "arctos" }),
    ).toBe("arctos");
  });

  it("rät bei einem unbekannten Wert nicht, sondern bleibt bei legacy", () => {
    expect(
      resolveBpmnEngine({
        env: { ARCTOS_BPMN_ENGINE: "artcos" },
        url: null,
        globalOverride: null,
      }),
    ).toBe("legacy");
  });
});

describe("Weiche: dieselbe Prop-Oberfläche, zwei Engines", () => {
  const props = {
    xml: XML,
    minHeight: 300,
    riskOverlayData: [
      { bpmnElementId: "Task_1", riskCount: 2, highestScore: 12 },
    ],
    callActivityOverlayData: [
      {
        bpmnElementId: "Task_1",
        calledProcessId: "p-2",
        calledProcessName: "Teilprozess",
      },
    ],
    onElementClick: () => undefined,
    onNavigateToProcess: () => undefined,
  };

  it("legacy: instanziiert bpmn-js", async () => {
    render(<BpmnViewer {...props} engine="legacy" />);
    await waitFor(() => {
      expect(navigatedViewerCtor).toHaveBeenCalledTimes(1);
    });
    // Die arctos-Moddle-Erweiterung geht weiterhin mit — der Round-Trip von
    // `arctos:grcMetadata` hängt daran.
    const options = navigatedViewerCtor.mock.calls[0]?.[0] as {
      moddleExtensions?: Record<string, unknown>;
    };
    expect(options.moddleExtensions?.["arctos"]).toBeDefined();
    expect(document.querySelector('[data-bpmn-engine="arctos"]')).toBeNull();
  });

  it("arctos: zeichnet mit @grc/bpmn und fasst bpmn-js nicht an", async () => {
    render(<BpmnViewer {...props} engine="arctos" />);

    await waitFor(
      () => {
        expect(
          document.querySelector('[data-bpmn-engine="arctos"] svg'),
        ).not.toBeNull();
      },
      { timeout: 10_000 },
    );
    expect(navigatedViewerCtor).not.toHaveBeenCalled();

    // Die Elemente sind wirklich gezeichnet, nicht nur der Rahmen.
    const root = document.querySelector('[data-bpmn-engine="arctos"]');
    expect(root?.querySelector('[data-element-id="Task_1"]')).not.toBeNull();
    expect(root?.querySelector('[data-element-id="Start_1"]')).not.toBeNull();
  }, 20_000);

  it("arctos: liefert die Textalternative zum Bild", async () => {
    render(<BpmnViewer {...props} engine="arctos" />);
    await waitFor(
      () => {
        expect(screen.getByText("Antrag pruefen")).toBeDefined();
      },
      { timeout: 10_000 },
    );
  }, 20_000);

  it("beide Stellungen nehmen dieselben Props ohne Sonderfall an", () => {
    expect(viewerEngineFor({ engine: "legacy" })).toBe("legacy");
    expect(viewerEngineFor({ engine: "arctos" })).toBe("arctos");
  });

  it("der Editor läuft in beiden Rechtelagen auf der eigenen Engine", () => {
    // Lesend wie bearbeitbar: der Rückfall bei `readOnly=false` ist entfallen,
    // seit `BpmnCanvas` im Modus `edit` Palette, Kontextmenü und
    // Direktbeschriftung registriert. Die Weiche fragt nur noch den Schalter.
    expect(editorEngineFor({ engine: "arctos", readOnly: true })).toBe(
      "arctos",
    );
    expect(editorEngineFor({ engine: "arctos", readOnly: false })).toBe(
      "arctos",
    );
    // Der Schalter bleibt die einzige Bedingung.
    expect(editorEngineFor({ engine: "legacy", readOnly: true })).toBe(
      "legacy",
    );
    expect(editorEngineFor({ engine: "legacy", readOnly: false })).toBe(
      "legacy",
    );
    // Und der Modus folgt dem Recht, nicht umgekehrt.
    expect(modeFor(true)).toBe("read");
    expect(modeFor(false)).toBe("edit");
  });
});

/**
 * Der Bearbeitungspfad über die Weiche — die vierte Einbindung.
 *
 * Geprüft wird das, was den Rückfall auf `bpmn-js` bisher begründet hat:
 * dass die Fläche im Modus `edit` tatsächlich eine Palette hat, dass der
 * Kommandostapel bedienbar ist, und dass `saveXml()` beides richtig macht —
 * unbearbeitet byteweise identisch, bearbeitet aus dem Modell.
 */
describe("Der Bearbeitungspfad auf der eigenen Engine", () => {
  const editorProps = {
    initialXml: XML,
    onElementClick: () => undefined,
    onNavigateToProcess: () => undefined,
  };

  it("zeichnet mit Palette und fasst bpmn-js nicht an", async () => {
    render(<BpmnEditor {...editorProps} engine="arctos" readOnly={false} />);
    await waitFor(
      () => {
        expect(
          document.querySelector('[data-bpmn-engine="arctos"] svg'),
        ).not.toBeNull();
      },
      { timeout: 10_000 },
    );
    expect(navigatedViewerCtor).not.toHaveBeenCalled();
    // Die Palette ist der Grund, aus dem der Rückfall bestand.
    expect(document.querySelector(".djs-palette")).not.toBeNull();
  }, 20_000);

  it("saveXml gibt Unbearbeitetes byteweise zurück und Bearbeitetes aus dem Modell", async () => {
    const ref = React.createRef<BpmnEditorRef>();
    render(
      <BpmnEditor
        {...editorProps}
        ref={ref}
        engine="arctos"
        readOnly={false}
      />,
    );
    await waitFor(
      () => {
        expect(
          document.querySelector('[data-bpmn-engine="arctos"] svg'),
        ).not.toBeNull();
      },
      { timeout: 10_000 },
    );

    // Z-D: nichts bearbeitet, also der Eingabetext — Zeichen für Zeichen.
    expect(await ref.current?.saveXml()).toBe(XML);
    expect(ref.current?.canUndo()).toBe(false);

    const modeler = ref.current?.getModeler() as {
      get: <T>(name: string) => T;
    } | null;
    expect(modeler).not.toBeNull();
    const modeling = modeler?.get<{
      updateProperties: (element: unknown, props: unknown) => void;
    }>("modeling");
    const registry = modeler?.get<{ get: (id: string) => unknown }>(
      "elementRegistry",
    );
    modeling?.updateProperties(registry?.get("Task_1"), {
      name: "Antrag gepruefen",
    });

    const written = await ref.current?.saveXml();
    expect(written).not.toBe(XML);
    expect(written).toContain("Antrag gepruefen");
    // Und der Kommandostapel ist wirklich der der eigenen Engine.
    expect(ref.current?.canUndo()).toBe(true);
    ref.current?.undo();
    expect(ref.current?.canRedo()).toBe(true);
  }, 20_000);
});

/**
 * Die GRC-Dekoration im SVG — der Aufruf, den `STUFE2-B2-EINBINDUNG.md` §5.1
 * als offen meldete. Geprüft wird beides: dass gezeichnet wird, **und** dass
 * die HTML-Badges dann ausbleiben (dieselbe Aussage nicht zweimal am Bild).
 */
describe("GRC-Dekoration", () => {
  const data = buildGrcOverlayData({
    computedAt: "2026-09-02T08:00:00.000Z",
    stepRisks: [
      {
        bpmnElementId: "Task_1",
        risks: [{ riskId: "r-1", riskTitle: "Fehlbuchung", riskScore: 16 }],
      },
    ],
    controlCoverage: [
      { bpmnElementId: "Task_1", controlCount: 2, effectiveCount: 1 },
    ],
    steps: [{ id: "s-1", bpmnElementId: "Task_1", lineOfDefense: "second" }],
  });

  it("zeichnet ins SVG und lässt die HTML-Badges weg", async () => {
    render(
      <BpmnViewer
        xml={XML}
        engine="arctos"
        riskOverlayData={[
          { bpmnElementId: "Task_1", riskCount: 1, highestScore: 16 },
        ]}
        grcOverlayData={data}
      />,
    );

    await waitFor(
      () => {
        expect(document.querySelector("[data-grc]")).not.toBeNull();
      },
      { timeout: 10_000 },
    );
    // Der HTML-Badge-Kanal bleibt still, solange die Dekoration zeichnet.
    expect(document.querySelector(".djs-overlay")).toBeNull();
  }, 20_000);

  it("zeichnet ohne Datensatz nicht und lässt die Badges wie bisher laufen", async () => {
    render(
      <BpmnViewer
        xml={XML}
        engine="arctos"
        riskOverlayData={[
          { bpmnElementId: "Task_1", riskCount: 1, highestScore: 16 },
        ]}
      />,
    );

    await waitFor(
      () => {
        expect(document.querySelector(".djs-overlay")).not.toBeNull();
      },
      { timeout: 10_000 },
    );
    expect(document.querySelector("[data-grc]")).toBeNull();
  }, 20_000);
});

describe("Brücke von den API-Routen auf den GRC-Vertrag", () => {
  const built = buildGrcOverlayData({
    computedAt: "2026-09-02T08:00:00.000Z",
    stepRisks: [
      {
        bpmnElementId: "Task_1",
        risks: [
          { riskId: "r-1", riskTitle: "Fehlbuchung", riskScore: 12 },
          { riskId: "r-2", riskTitle: "Verzug", riskScore: 4 },
        ],
      },
      { bpmnElementId: null, risks: [{ riskId: "r-3" }] },
    ],
    controlCoverage: [
      { bpmnElementId: "Task_1", controlCount: 3, effectiveCount: 2 },
      { bpmnElementId: "Task_2", controlCount: 0, effectiveCount: 0 },
    ],
    steps: [
      { id: "s-1", bpmnElementId: "Task_1", lineOfDefense: "second" },
      { id: "s-2", bpmnElementId: "Task_2", lineOfDefense: "unsinn" },
    ],
    findings: [
      {
        id: "f-1",
        title: "Kontrolle nicht belegt",
        severity: "critical",
        status: "open",
        process_step_id: "s-1",
      },
      {
        id: "f-2",
        title: "Erledigt",
        severity: "low",
        status: "remediated",
        process_step_id: "s-1",
      },
      { id: "f-3", title: "Ohne Schritt", severity: "high", status: "open" },
    ],
    callLinks: [
      {
        bpmnElementId: "Task_2",
        calledProcessId: "p-9",
        calledProcessName: "Freigabe",
      },
    ],
  });

  it("trägt den Bezugszeitpunkt — Pflichtfeld des Vertrags", () => {
    expect(built.computedAt).toBe("2026-09-02T08:00:00.000Z");
  });

  it("bildet Risiken auf den Nettoscore ab und lässt IDs ohne Element weg", () => {
    const task1 = built.elements["Task_1"];
    expect(task1?.risks?.map((r) => r.id)).toEqual(["r-1", "r-2"]);
    expect(task1?.risks?.[0]?.residualScore).toBe(12);
    // Kein Bruttoscore geraten, wo keiner geliefert wird.
    expect(task1?.risks?.[0]?.inherentScore).toBeUndefined();
  });

  it("macht aus Zählwerten Kontrollen mit erkennbarer Platzhalter-ID", () => {
    const controls = built.elements["Task_1"]?.controls ?? [];
    expect(controls).toHaveLength(3);
    expect(
      controls.filter((c) => c.effectiveness === "effective"),
    ).toHaveLength(2);
    expect(controls.every((c) => c.id.startsWith("coverage:"))).toBe(true);
    // Kein erfundener Titel.
    expect(controls.every((c) => c.title === "")).toBe(true);
    // Ein Element ohne Kontrollen bekommt kein leeres Feld untergeschoben.
    expect(built.elements["Task_2"]?.controls).toBeUndefined();
  });

  it("hängt Feststellungen über process_step_id an das richtige Element", () => {
    const findings = built.elements["Task_1"]?.findings ?? [];
    expect(findings.map((f) => f.id)).toEqual(["f-1", "f-2"]);
    expect(findings[0]?.status).toBe("open");
    expect(findings[1]?.status).toBe("closed");
    expect(findings[0]?.dueAt).toBeUndefined();
  });

  it("übernimmt nur gültige Line-of-Defense-Werte", () => {
    expect(built.elements["Task_1"]?.lineOfDefense).toBe("second");
    expect(built.elements["Task_2"]?.lineOfDefense).toBeUndefined();
  });

  it("verknüpft die Call Activity, aber ohne erfundenes Roll-up", () => {
    expect(built.elements["Task_2"]?.calledProcess?.processId).toBe("p-9");
    expect(built.elements["Task_2"]?.calledProcess?.rollup).toBeUndefined();
  });

  it("liefert leer statt geraten, wo heute keine Daten existieren", () => {
    expect(built.lanes).toBeUndefined();
    expect(built.edges).toBeUndefined();
    expect(built.diagram).toBeUndefined();
    expect(built.elements["Task_1"]?.ropa).toBeUndefined();
    expect(built.elements["Task_1"]?.bia).toBeUndefined();
    expect(built.elements["Task_1"]?.conformance).toBeUndefined();
    expect(built.elements["Task_1"]?.stepKey).toBeUndefined();
    // Und der Bedarf ist als Datum notiert, nicht nur als Kommentar.
    expect(MISSING_TODAY.length).toBeGreaterThan(5);
    expect(MISSING_TODAY.every((entry) => entry.reason.length > 20)).toBe(true);
  });
});
