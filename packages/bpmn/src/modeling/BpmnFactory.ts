/**
 * `BpmnFactory` — Erzeugung semantischer Objekte **und ihrer DI-Entsprechungen**.
 *
 * Punkt 1 des Auftrags. Zwei Dinge daran sind nicht offensichtlich:
 *
 *  1. **Semantik und DI entstehen zusammen.** Ein `bpmn:Task` ohne
 *     `bpmndi:BPMNShape` ist für jedes Fremdwerkzeug unsichtbar; eine
 *     `BPMNShape` ohne `bpmnElement` lässt `moddle` beim Schreiben stumm fallen
 *     (SPIKE-ENTSCHEIDUNG, Ursache 2). Die Fabrik liefert deshalb nie das eine
 *     ohne das andere.
 *  2. **`$parent` wird gesetzt, sobald es einen Container gibt.** `moddle.create`
 *     tut das nicht. Der Invariantenprüfer meldet ein fehlendes `$parent` als
 *     `PARENT_LINK_BROKEN`, weil ein Baum ohne Elternverweise beim nächsten
 *     Umhängen still auseinanderfällt.
 */

import type { BpmnModdleInstance } from "bpmn-moddle";
import { BpmnIds } from "./ids";
import type { Bounds, ModdleElement, Point } from "./types";
import { is, isAny, isModdleElement } from "./util";

/** Vorgabegrößen je Typ — dieselben Maße, die `src/draw/theme.ts` zeichnet. */
export const DEFAULT_SIZES: Readonly<
  Record<string, { width: number; height: number }>
> = {
  "bpmn:StartEvent": { width: 36, height: 36 },
  "bpmn:EndEvent": { width: 36, height: 36 },
  "bpmn:IntermediateCatchEvent": { width: 36, height: 36 },
  "bpmn:IntermediateThrowEvent": { width: 36, height: 36 },
  "bpmn:BoundaryEvent": { width: 36, height: 36 },
  "bpmn:ExclusiveGateway": { width: 50, height: 50 },
  "bpmn:InclusiveGateway": { width: 50, height: 50 },
  "bpmn:ParallelGateway": { width: 50, height: 50 },
  "bpmn:EventBasedGateway": { width: 50, height: 50 },
  "bpmn:ComplexGateway": { width: 50, height: 50 },
  "bpmn:Task": { width: 100, height: 80 },
  "bpmn:UserTask": { width: 100, height: 80 },
  "bpmn:ServiceTask": { width: 100, height: 80 },
  "bpmn:ScriptTask": { width: 100, height: 80 },
  "bpmn:BusinessRuleTask": { width: 100, height: 80 },
  "bpmn:ManualTask": { width: 100, height: 80 },
  "bpmn:SendTask": { width: 100, height: 80 },
  "bpmn:ReceiveTask": { width: 100, height: 80 },
  "bpmn:CallActivity": { width: 100, height: 80 },
  "bpmn:SubProcess": { width: 350, height: 200 },
  "bpmn:Transaction": { width: 350, height: 200 },
  "bpmn:Participant": { width: 600, height: 250 },
  "bpmn:Lane": { width: 570, height: 125 },
  "bpmn:DataObjectReference": { width: 36, height: 50 },
  "bpmn:DataStoreReference": { width: 50, height: 50 },
  "bpmn:TextAnnotation": { width: 100, height: 30 },
  "bpmn:Group": { width: 300, height: 300 },
};

/** Vorgabegröße einer externen Beschriftung. */
export const DEFAULT_LABEL_SIZE = { width: 90, height: 20 } as const;

export function defaultSize(type: string): { width: number; height: number } {
  return DEFAULT_SIZES[type] ?? { width: 100, height: 80 };
}

export interface CreateOptions {
  /** Container, in den das Element später eingehängt wird — setzt `$parent`. */
  readonly parent?: ModdleElement | undefined;
  /** Feste ID statt einer vergebenen. Kollidiert sie, wirft die Fabrik. */
  readonly id?: string | undefined;
}

export class BpmnFactory {
  static $inject = ["moddle"];

  private ids: BpmnIds;
  private definitions: ModdleElement | undefined;

  constructor(readonly moddle: BpmnModdleInstance) {
    this.ids = new BpmnIds();
  }

  /**
   * Bindet die Fabrik an ein Dokument. Muss der Importer aufrufen, **bevor**
   * das erste Element entsteht — sonst vergibt die Fabrik IDs, die im Dokument
   * bereits vorkommen.
   */
  setDefinitions(definitions: ModdleElement): void {
    this.definitions = definitions;
    this.ids = new BpmnIds(definitions);
  }

  getDefinitions(): ModdleElement | undefined {
    return this.definitions;
  }

  getIds(): BpmnIds {
    return this.ids;
  }

  /** Eine freie ID für einen Typ. */
  nextId(type: string): string {
    return this.ids.next(type);
  }

  /** Gibt eine ID frei (Undo eines Erzeugungskommandos). */
  releaseId(id: string): void {
    this.ids.release(id);
  }

  /**
   * Erzeugt ein semantisches Element mit ID und `$parent`.
   *
   * Elemente ohne eigene Identität im Dokument (Ereignisdefinitionen,
   * `bpmn:LaneSet` in manchen Werkzeugen) bekommen trotzdem eine ID: BPMN
   * erlaubt sie überall, und der Invariantenprüfer verlangt sie für alles,
   * worauf die DI zeigen könnte.
   */
  create(
    type: string,
    attrs: Record<string, unknown> = {},
    options: CreateOptions = {},
  ): ModdleElement {
    const element = this.moddle.create(type, attrs);
    const wanted =
      options.id ?? (typeof attrs["id"] === "string" ? attrs["id"] : undefined);
    if (wanted !== undefined) {
      if (!this.ids.claim(wanted) && element.id !== wanted) {
        throw new Error(`Die ID ${wanted} ist im Dokument bereits vergeben.`);
      }
      element.id = wanted;
    } else if (element.id === undefined && this.needsId(type)) {
      element.id = this.ids.next(type);
    }
    if (options.parent) element["$parent"] = options.parent;
    return element;
  }

  private needsId(type: string): boolean {
    return type.startsWith("bpmn:") || type.startsWith("bpmndi:");
  }

  // -------------------------------------------------------------------------
  // DI
  // -------------------------------------------------------------------------

  createBounds(bounds: Bounds, parent?: ModdleElement): ModdleElement {
    const element = this.moddle.create("dc:Bounds", {
      x: round(bounds.x),
      y: round(bounds.y),
      width: round(bounds.width),
      height: round(bounds.height),
    });
    if (parent) element["$parent"] = parent;
    return element;
  }

  createWaypoint(point: Point, parent?: ModdleElement): ModdleElement {
    const element = this.moddle.create("dc:Point", {
      x: round(point.x),
      y: round(point.y),
    });
    if (parent) element["$parent"] = parent;
    return element;
  }

  /**
   * `bpmndi:BPMNShape` samt `bounds` und `bpmnElement`-Rückverweis.
   *
   * `isExpanded` wird nur für Container geschrieben, weil ein `isExpanded` an
   * einem Task von Fremdwerkzeugen als Schemaverstoß gelesen wird.
   */
  createDiShape(
    semantic: ModdleElement,
    bounds: Bounds,
    attrs: Record<string, unknown> = {},
  ): ModdleElement {
    const di = this.moddle.create("bpmndi:BPMNShape", {
      bpmnElement: semantic,
      ...attrs,
    });
    di.id = this.ids.next(`${String(semantic.id ?? "Shape")}_di`);
    di["bounds"] = this.createBounds(bounds, di);
    if (
      isAny(semantic, [
        "bpmn:SubProcess",
        "bpmn:Transaction",
        "bpmn:AdHocSubProcess",
      ]) &&
      attrs["isExpanded"] === undefined
    ) {
      di["isExpanded"] = true;
    }
    if (
      is(semantic, "bpmn:Participant") &&
      attrs["isHorizontal"] === undefined
    ) {
      di["isHorizontal"] = true;
    }
    if (is(semantic, "bpmn:Lane") && attrs["isHorizontal"] === undefined) {
      di["isHorizontal"] = true;
    }
    return di;
  }

  createDiEdge(
    semantic: ModdleElement,
    waypoints: readonly Point[],
    attrs: Record<string, unknown> = {},
  ): ModdleElement {
    const di = this.moddle.create("bpmndi:BPMNEdge", {
      bpmnElement: semantic,
      ...attrs,
    });
    di.id = this.ids.next(`${String(semantic.id ?? "Edge")}_di`);
    di["waypoint"] = waypoints.map((point) => this.createWaypoint(point, di));
    return di;
  }

  /** `bpmndi:BPMNLabel` für eine externe Beschriftung. */
  createDiLabel(bounds: Bounds, parent?: ModdleElement): ModdleElement {
    const label = this.moddle.create("bpmndi:BPMNLabel", {});
    if (parent) label["$parent"] = parent;
    label["bounds"] = this.createBounds(bounds, label);
    return label;
  }

  /**
   * Ersetzt die Wegpunkte einer `BPMNEdge` in place und liefert den Rückweg.
   * In place, weil `element.di` an anderer Stelle festgehalten wird und ein
   * Austausch des Objekts die Verweise brechen würde.
   */
  setWaypoints(di: ModdleElement, waypoints: readonly Point[]): () => void {
    const previous = di["waypoint"];
    di["waypoint"] = waypoints.map((point) => this.createWaypoint(point, di));
    return () => {
      di["waypoint"] = previous;
    };
  }

  /** Ersetzt die Bounds einer `BPMNShape` in place und liefert den Rückweg. */
  setBounds(di: ModdleElement, bounds: Bounds): () => void {
    const existing = di["bounds"];
    if (isModdleElement(existing)) {
      const previous = {
        x: existing["x"],
        y: existing["y"],
        width: existing["width"],
        height: existing["height"],
      };
      existing["x"] = round(bounds.x);
      existing["y"] = round(bounds.y);
      existing["width"] = round(bounds.width);
      existing["height"] = round(bounds.height);
      return () => {
        existing["x"] = previous.x;
        existing["y"] = previous.y;
        existing["width"] = previous.width;
        existing["height"] = previous.height;
      };
    }
    di["bounds"] = this.createBounds(bounds, di);
    return () => {
      di["bounds"] = existing;
    };
  }
}

/**
 * DI-Koordinaten auf ganze Zehntel runden.
 *
 * Grund: Z-A vergleicht Geometrie auf 0,5 px genau (Plan §5.1). Ungerundete
 * Fließkommawerte aus Zoom- und Snap-Rechnungen erzeugen sonst bei jedem
 * Speichern einen anderen Text und damit Phantom-Diffs in `bpmn-diff.ts`.
 */
export function round(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}
