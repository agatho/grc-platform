/**
 * Import: moddle-Baum + DI → `diagram-js`-Elementbaum.
 *
 * Der Betrachter (`src/draw/scene.ts`) baut aus denselben Daten eine **flache**
 * Szene — das genügt zum Zeichnen. Zum *Bearbeiten* genügt es nicht: eine
 * Modellierungsschicht braucht die echte Schachtelung, weil jede Operation
 * fragt „in welchem Container liegt das?" (`flowElements`), „in welchem Pool?"
 * (Sequenz- vs. Nachrichtenfluss) und „an welchem Wirt?" (Boundary Events).
 * Deshalb entsteht hier ein Baum mit `parent`/`children`, `host`/`attachers`
 * und `labelTarget`.
 *
 * ## Zwei bewusste Eingriffe
 *
 * **1. Fehlende DI wird ergänzt.** Der Korpus enthält Dateien ohne
 * `BPMNPlane`, mit unvollständiger DI und mit `BPMNShape` ohne Bounds
 * (`repo-parser-no-di-section`, `repo-parser-partial-di`,
 * `synth-without-di-section`). Ohne Ergänzung hätte ein solches Diagramm
 * Elemente, die im Modell stehen und auf keiner Ebene sichtbar sind — der
 * Invariantenprüfer meldet das als `DI_MISSING`, und zwar zu Recht. Die
 * Ergänzung ist von Z-C gedeckt: die Ausgabe *darf* mehr enthalten als die
 * Eingabe. Sie ist abschaltbar (`repairMissingDi: false`), damit ein reiner
 * Round-Trip-Messlauf sie nicht verfälscht.
 *
 * **2. Unbrauchbare Elemente werden gemeldet, nicht verschluckt.** Ein
 * Sequenzfluss, dessen `sourceRef` `moddle` beim Lesen still verworfen hat
 * (SPIKE-ENTSCHEIDUNG, Ursache 2), bekommt kein grafisches Element und
 * erscheint als Warnung. Er bleibt im semantischen Baum stehen und wird beim
 * Export unverändert zurückgeschrieben — verschlucken wäre Datenverlust,
 * darstellen wäre eine Lüge.
 */

import type Canvas from "diagram-js/lib/core/Canvas.js";
import type { BpmnFactory } from "./BpmnFactory.js";
import type { BpmnElementFactory } from "./ElementFactory.js";
import {
  addDi,
  boundsOf,
  buildDiIndex,
  isCollapsedDi,
  labelBoundsOf,
  planeOfDiagram,
  planesOf,
  waypointsOf,
} from "./di.js";
import { checkInvariants, type InvariantViolation } from "./invariants.js";
import { externalLabelBounds, hasExternalLabel, labelText } from "./labels.js";
import type {
  Bounds,
  BpmnConnection,
  BpmnElement,
  BpmnParent,
  BpmnRoot,
  BpmnShape,
  ModdleElement,
  Point,
} from "./types.js";
import {
  addToContainer,
  asArray,
  is,
  isModdleElement,
  setProperty,
} from "./util.js";
import { defaultSize } from "./BpmnFactory.js";

export interface ImportDefinitionsOptions {
  /** Welche `BPMNDiagram`-Ebene gezeichnet wird. */
  readonly diagramIndex?: number;
  /** Fehlende DI-Einträge ergänzen. Vorgabe `true`, siehe Kopfkommentar. */
  readonly repairMissingDi?: boolean;
  /**
   * `incoming`/`outgoing` aus `sourceRef`/`targetRef` vervollständigen.
   * Vorgabe `true`, siehe {@link normalizeFlowRefs}.
   */
  readonly normalizeFlowRefs?: boolean;
}

export interface ImportDefinitionsResult {
  readonly definitions: ModdleElement;
  readonly root: BpmnRoot;
  readonly plane: ModdleElement;
  readonly warnings: readonly string[];
  readonly elementCount: number;
  /**
   * Invariantenverletzungen, die die **Eingabedatei** schon mitbrachte.
   *
   * Sie werden erhoben, *nachdem* der Import repariert hat, was reparabel ist,
   * und dienen als Grundlinie: `ModelingSession.checkInvariants()` zieht genau
   * diese Befunde ab. Damit meldet der Prüfer, was die Modellierungsschicht
   * kaputt gemacht hat, und nicht, was die Datei mitgebracht hat — ohne dass
   * dafür eine ganze Prüfung abgeschaltet werden müsste.
   *
   * Der häufigste Fall ist die Ursache 2 aus der Spike-Auswertung: eine
   * `BPMNShape`, deren `bpmnElement`-IDREF `moddle` beim Lesen still verworfen
   * hat. Sie ist nach dem Lesen nicht mehr reparabel — der Zeiger ist weg —,
   * aber sie ist auch nicht das Werk dieser Schicht.
   */
  readonly preexistingViolations: readonly InvariantViolation[];
}

interface Services {
  canvas: Canvas;
  elementFactory: BpmnElementFactory;
  bpmnFactory: BpmnFactory;
}

export class BpmnImporter {
  static $inject = ["canvas", "elementFactory", "bpmnFactory"];

  constructor(
    private readonly canvas: Canvas,
    private readonly elementFactory: BpmnElementFactory,
    private readonly bpmnFactory: BpmnFactory,
  ) {}

  import(
    definitions: ModdleElement,
    options: ImportDefinitionsOptions = {},
  ): ImportDefinitionsResult {
    return importDefinitions(
      definitions,
      {
        canvas: this.canvas,
        elementFactory: this.elementFactory,
        bpmnFactory: this.bpmnFactory,
      },
      options,
    );
  }
}

export default BpmnImporter;

// ---------------------------------------------------------------------------

export function importDefinitions(
  definitions: ModdleElement,
  services: Services,
  options: ImportDefinitionsOptions = {},
): ImportDefinitionsResult {
  const { canvas, elementFactory, bpmnFactory } = services;
  const warnings: string[] = [];
  const repair = options.repairMissingDi !== false;

  bpmnFactory.setDefinitions(definitions);
  if (options.normalizeFlowRefs !== false) {
    normalizeFlowRefs(definitions, warnings);
  }

  const plane = resolvePlane(
    definitions,
    bpmnFactory,
    options,
    warnings,
    repair,
  );
  const rootBo = isModdleElement(plane["bpmnElement"])
    ? plane["bpmnElement"]
    : undefined;
  if (!rootBo) {
    throw new Error("BPMNPlane ohne bpmnElement — es gibt keine Wurzel.");
  }

  const di = buildDiIndex(definitions);
  const cursor = new PlacementCursor();

  const ensureDi = (
    bo: ModdleElement,
    hint?: Bounds,
  ): ModdleElement | undefined => {
    const existing = di.get(bo);
    if (existing) {
      if (existing.$type === "bpmndi:BPMNShape" && !boundsOf(existing)) {
        if (!repair) return undefined;
        bpmnFactory.setBounds(
          existing,
          hint ?? cursor.next(defaultSize(bo.$type)),
        );
        warnings.push(
          `BPMNShape für ${String(bo.id)} hatte keine Bounds — ergänzt.`,
        );
      }
      return existing;
    }
    if (!repair) return undefined;
    warnings.push(`${bo.$type} ${String(bo.id)} hatte keine DI — ergänzt.`);
    const created = bpmnFactory.createDiShape(
      bo,
      hint ?? cursor.next(defaultSize(bo.$type)),
    );
    addDi(plane, created);
    di.set(bo, created);
    return created;
  };

  const ensureEdgeDi = (
    bo: ModdleElement,
    waypoints: readonly Point[],
  ): ModdleElement | undefined => {
    const existing = di.get(bo);
    if (existing) {
      if (waypointsOf(existing).length < 2) {
        if (!repair) return undefined;
        bpmnFactory.setWaypoints(existing, waypoints);
        warnings.push(
          `BPMNEdge für ${String(bo.id)} hatte < 2 Wegpunkte — ergänzt.`,
        );
      }
      return existing;
    }
    if (!repair) return undefined;
    warnings.push(`${bo.$type} ${String(bo.id)} hatte keine DI — ergänzt.`);
    const created = bpmnFactory.createDiEdge(bo, waypoints);
    addDi(plane, created);
    di.set(bo, created);
    return created;
  };

  // --- Wurzel -------------------------------------------------------------
  const root = elementFactory.createRootFor(rootBo, {
    id: typeof rootBo.id === "string" ? rootBo.id : "__root",
    di: plane,
  });
  canvas.setRootElement(root as never);

  const byBo = new Map<ModdleElement, BpmnElement>();
  const pendingConnections: Array<{ bo: ModdleElement; parent: BpmnParent }> =
    [];
  const pendingLabels: Array<BpmnElement> = [];

  // --- Formen -------------------------------------------------------------

  const addShape = (
    bo: ModdleElement,
    parent: BpmnParent,
    host?: BpmnShape,
  ): BpmnShape | undefined => {
    const diElement = ensureDi(bo);
    const bounds = diElement ? boundsOf(diElement) : undefined;
    if (!bounds) {
      warnings.push(
        `${bo.$type} ${String(bo.id)} ohne darstellbare Bounds — übersprungen.`,
      );
      return undefined;
    }
    const shape = elementFactory.createShapeFor(bo, {
      ...bounds,
      di: diElement,
      collapsed: isCollapsedDi(diElement) ? true : undefined,
      ...(host ? { host } : {}),
    });
    canvas.addShape(shape as never, parent as never);
    byBo.set(bo, shape);
    if (hasExternalLabel(bo) && labelText(bo).trim() !== "") {
      pendingLabels.push(shape);
    }
    return shape;
  };

  /** Ein `flowElements`-tragender Container samt Lanes und Kindern. */
  const buildContainer = (
    container: ModdleElement,
    parent: BpmnParent,
  ): void => {
    // Lanes zuerst — sie sind der Hintergrund und Geschwister der Knoten.
    for (const laneSet of asArray(container["laneSets"])) {
      buildLaneSet(laneSet, parent);
    }

    const nodes = asArray(container["flowElements"]);
    // Zwei Durchgänge: erst Wirte, dann Anhefter. Ein Boundary Event, dessen
    // Wirt noch nicht existiert, hätte sonst kein `host`.
    for (const bo of nodes) {
      if (isConnectionBo(bo) || is(bo, "bpmn:BoundaryEvent")) continue;
      const shape = addShape(bo, parent);
      if (shape && isContainerBo(bo) && shape.collapsed !== true) {
        buildContainer(bo, shape);
      }
    }
    for (const bo of nodes) {
      if (!is(bo, "bpmn:BoundaryEvent")) continue;
      const hostBo = bo["attachedToRef"];
      const host = isModdleElement(hostBo)
        ? (byBo.get(hostBo) as BpmnShape | undefined)
        : undefined;
      if (!host) {
        warnings.push(
          `BoundaryEvent ${String(bo.id)} ohne auflösbaren Wirt — übersprungen.`,
        );
        continue;
      }
      addShape(bo, host.parent ?? parent, host);
    }
    for (const bo of asArray(container["artifacts"])) {
      if (is(bo, "bpmn:Association")) {
        pendingConnections.push({ bo, parent });
        continue;
      }
      addShape(bo, parent);
    }
    for (const bo of nodes) {
      if (isConnectionBo(bo)) pendingConnections.push({ bo, parent });
    }
    for (const bo of nodes) {
      for (const property of [
        "dataInputAssociations",
        "dataOutputAssociations",
      ] as const) {
        for (const assoc of asArray(bo[property])) {
          pendingConnections.push({ bo: assoc, parent });
        }
      }
    }
  };

  const buildLaneSet = (laneSet: ModdleElement, parent: BpmnParent): void => {
    for (const lane of asArray(laneSet["lanes"])) {
      const shape = addShape(lane, parent);
      const child = lane["childLaneSet"];
      if (shape && isModdleElement(child)) buildLaneSet(child, shape);
    }
  };

  if (is(rootBo, "bpmn:Collaboration")) {
    for (const participant of asArray(rootBo["participants"])) {
      const shape = addShape(participant, root);
      if (!shape) continue;
      const process = participant["processRef"];
      if (isModdleElement(process)) buildContainer(process, shape);
    }
    for (const bo of asArray(rootBo["artifacts"])) {
      if (is(bo, "bpmn:Association")) {
        pendingConnections.push({ bo, parent: root });
      } else {
        addShape(bo, root);
      }
    }
    for (const bo of asArray(rootBo["messageFlows"])) {
      pendingConnections.push({ bo, parent: root });
    }
  } else {
    buildContainer(rootBo, root);
  }

  // --- Kanten -------------------------------------------------------------

  for (const { bo, parent } of pendingConnections) {
    const sourceBo = firstRef(bo["sourceRef"]);
    const targetBo = firstRef(bo["targetRef"]);
    const source = sourceBo ? byBo.get(sourceBo) : undefined;
    const target = targetBo ? byBo.get(targetBo) : undefined;
    if (!source || !target) {
      warnings.push(
        `${bo.$type} ${String(bo.id)} hat keine auflösbaren Endpunkte — nicht dargestellt.`,
      );
      continue;
    }
    const fallback = straightWaypoints(source, target);
    const diElement = ensureEdgeDi(bo, fallback);
    const waypoints = diElement ? waypointsOf(diElement) : [];
    if (waypoints.length < 2) {
      warnings.push(
        `${bo.$type} ${String(bo.id)} ohne Wegpunkte — nicht dargestellt.`,
      );
      continue;
    }
    const connection = elementFactory.createConnectionFor(bo, {
      waypoints,
      di: diElement,
      source,
      target,
    });
    canvas.addConnection(connection as never, parent as never);
    byBo.set(bo, connection);
    if (hasExternalLabel(bo) && labelText(bo).trim() !== "") {
      pendingLabels.push(connection);
    }
  }

  // --- Beschriftungen -----------------------------------------------------

  for (const target of pendingLabels) {
    const targetDi = target.di;
    const bounds = externalLabelBounds(
      target,
      isModdleElement(targetDi) ? targetDi : undefined,
    );
    const label = elementFactory.createLabel({
      ...bounds,
      id: `${target.id}_label`,
      labelTarget: target,
      businessObject: target.businessObject,
    });
    canvas.addShape(label as never, (target.parent ?? root) as never);
    if (isModdleElement(targetDi) && !labelBoundsOf(targetDi)) {
      // Die berechnete Box wird **nicht** in die DI geschrieben. Erst wenn der
      // Benutzer die Beschriftung anfasst, entsteht ein `BPMNLabel` — sonst
      // erzeugte schon das Öffnen einer fremden Datei einen Diff über das
      // ganze Diagramm.
      void 0;
    }
  }

  const preexistingViolations = checkInvariants({ definitions });
  if (preexistingViolations.length > 0) {
    warnings.push(
      `Die Datei bringt ${String(preexistingViolations.length)} Modellfehler mit, die der Import nicht beheben kann: ${preexistingViolations
        .map((v) => `${v.code}${v.elementId ? ` <${v.elementId}>` : ""}`)
        .join(", ")}`,
    );
  }

  return {
    definitions,
    root,
    plane,
    warnings,
    elementCount: byBo.size,
    preexistingViolations,
  };
}

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

/**
 * Vervollständigt `incoming`/`outgoing` aus `sourceRef`/`targetRef`.
 *
 * **Warum das nötig ist — ein Befund aus dem Bau dieser Schicht.** BPMN kodiert
 * die Kante-Knoten-Beziehung *doppelt*: einmal am Fluss (`sourceRef`,
 * `targetRef`), einmal am Knoten (`<bpmn:incoming>`, `<bpmn:outgoing>`).
 * `bpmn-moddle` füllt `incoming`/`outgoing` **nur** aus den ausgeschriebenen
 * Kindelementen; fehlen sie in der Datei, bleibt die Liste leer, obwohl
 * `sourceRef` aufgelöst ist. Der Bestandskorpus schreibt sie zwar durchgängig
 * aus, aber der Excel-Import und der KI-Generator müssen das nicht — und ein
 * Editor, der auf der leeren Liste arbeitet, hängt beim ersten Löschen die
 * falschen Kanten ab.
 *
 * Die Ergänzung ist von Z-C (Nichtverlust) gedeckt: die Ausgabe darf mehr
 * enthalten als die Eingabe. Sie ist abschaltbar, damit ein reiner
 * Round-Trip-Messlauf die Eingabe unverändert lassen kann.
 */
export function normalizeFlowRefs(
  definitions: ModdleElement,
  warnings: string[],
): void {
  let added = 0;
  const visit = (container: ModdleElement): void => {
    for (const bo of asArray(container["flowElements"])) {
      if (is(bo, "bpmn:SequenceFlow")) {
        const source = firstRef(bo["sourceRef"]);
        const target = firstRef(bo["targetRef"]);
        if (source && !asArray(source["outgoing"]).includes(bo)) {
          addRefList(source, "outgoing", bo);
          added += 1;
        }
        if (target && !asArray(target["incoming"]).includes(bo)) {
          addRefList(target, "incoming", bo);
          added += 1;
        }
        continue;
      }
      if (Array.isArray(bo["flowElements"])) visit(bo);
    }
  };

  for (const root of asArray(definitions["rootElements"])) {
    if (is(root, "bpmn:Process")) visit(root);
  }
  if (added > 0) {
    warnings.push(
      `${String(added)} incoming/outgoing-Verweise waren nur über sourceRef/targetRef kodiert und wurden ergänzt.`,
    );
  }
}

function addRefList(
  owner: ModdleElement,
  property: string,
  target: ModdleElement,
): void {
  const existing = owner[property];
  if (Array.isArray(existing)) {
    existing.push(target);
    return;
  }
  owner[property] = [target];
}

function isConnectionBo(bo: ModdleElement): boolean {
  return is(bo, "bpmn:SequenceFlow");
}

function isContainerBo(bo: ModdleElement): boolean {
  return is(bo, "bpmn:SubProcess") || is(bo, "bpmn:Transaction");
}

function firstRef(value: unknown): ModdleElement | undefined {
  if (isModdleElement(value)) return value;
  if (Array.isArray(value)) {
    const first = value.find(isModdleElement);
    return first;
  }
  return undefined;
}

function straightWaypoints(source: BpmnElement, target: BpmnElement): Point[] {
  const mid = (element: BpmnElement): Point => {
    const shape = element as BpmnShape;
    if (typeof shape.width === "number") {
      return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
    }
    const connection = element as BpmnConnection;
    return connection.waypoints[0] ?? { x: 0, y: 0 };
  };
  return [mid(source), mid(target)];
}

/** Platzierung für Elemente, die keine DI mitbringen: Zeilen von links nach rechts. */
class PlacementCursor {
  private x = 160;
  private y = 120;
  private rowHeight = 0;

  next(size: { width: number; height: number }): Bounds {
    if (this.x > 1200) {
      this.x = 160;
      this.y += this.rowHeight + 60;
      this.rowHeight = 0;
    }
    const bounds: Bounds = {
      x: this.x,
      y: this.y,
      width: size.width,
      height: size.height,
    };
    this.x += size.width + 60;
    this.rowHeight = Math.max(this.rowHeight, size.height);
    return bounds;
  }
}

/**
 * Die Ebene, die gezeichnet wird — notfalls eine neu angelegte.
 *
 * Eine Datei ohne `BPMNDiagram` ist im Bestand real (`synth-without-di-section`,
 * `repo-parser-no-di-section`): der Excel-Import und der KI-Generator
 * schreiben keine. Ohne Ebene gäbe es nichts zu bearbeiten.
 */
function resolvePlane(
  definitions: ModdleElement,
  bpmnFactory: BpmnFactory,
  options: ImportDefinitionsOptions,
  warnings: string[],
  repair: boolean,
): ModdleElement {
  const planes = planesOf(definitions);
  const index = options.diagramIndex ?? 0;
  const existing = planes[index];
  if (existing) {
    if (planes.length > 1) {
      warnings.push(
        `Das Dokument enthält ${String(planes.length)} Diagramme; bearbeitet wird Nr. ${String(index + 1)}.`,
      );
    }
    return existing;
  }
  if (!repair) {
    throw new Error("Das Dokument enthält keine BPMNPlane.");
  }

  const rootBo =
    asArray(definitions["rootElements"]).find((e) =>
      is(e, "bpmn:Collaboration"),
    ) ??
    asArray(definitions["rootElements"]).find((e) => is(e, "bpmn:Process"));
  if (!rootBo) {
    throw new Error(
      "Das Dokument enthält weder eine BPMNPlane noch einen Prozess — nichts zu bearbeiten.",
    );
  }

  warnings.push("Das Dokument hatte keine BPMNPlane — eine wurde angelegt.");
  const diagram = bpmnFactory.create(
    "bpmndi:BPMNDiagram",
    {},
    { parent: definitions },
  );
  const plane = bpmnFactory.create("bpmndi:BPMNPlane", {}, { parent: diagram });
  setProperty(plane, "bpmnElement", rootBo);
  setProperty(plane, "planeElement", []);
  setProperty(diagram, "plane", plane);
  addToContainer(definitions, diagram, "diagrams");
  void planeOfDiagram;
  return plane;
}
