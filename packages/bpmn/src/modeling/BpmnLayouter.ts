/**
 * `BpmnLayouter` — Kantenführung (Auftrag Punkt 6).
 *
 * Der Auftrag ist hier ausdrücklich, zu **nutzen** statt nachzubauen:
 * `diagram-js` bringt Manhattan-Routing (`layout/ManhattanLayout`) und das
 * Abschneiden an der Formgrenze (`layout/CroppingConnectionDocking`) fertig
 * mit. Beide Messprotokolle stufen Flow-Routing als den kleinsten der vier
 * Posten ein — „und den einzigen, bei dem man das Ergebnis sieht".
 *
 * Die **Rechnung** bleibt deshalb bei `diagram-js`: `repairConnection`,
 * `withoutRedundantPoints`, `getOrientation`, `getMid`. BPMN-spezifisch — und
 * damit unsere Sache — ist nur die **Entscheidungstabelle**: welche
 * Andockseiten eine Kantenart bevorzugt.
 *
 *  - Sequenzflüsse laufen waagerecht (`h:h`) — Prozesse werden von links nach
 *    rechts gelesen; in einem senkrechten Pool entsprechend `v:v`;
 *  - Kanten **aus** einem Gateway verlassen es senkrecht und biegen ab
 *    (`v:h`), Kanten **in** ein Gateway kommen waagerecht und biegen ab
 *    (`h:v`) — so entsteht die typische Rautenverzweigung;
 *  - Kanten **aus einem Boundary Event** verlassen es auf der Seite, an der es
 *    hängt, und docken je nach Lage des Ziels waagerecht oder senkrecht an;
 *  - Schleifen auf dasselbe Element laufen um die Form herum;
 *  - Kanten an einem aufgeklappten Subprozess halten den Andockpunkt der
 *    Gegenseite fest (`preserveDocking`), weil ein Container beim Wachsen
 *    sonst jede angrenzende Kante neu legt;
 *  - Nachrichtenflüsse zwischen Pools laufen senkrecht (`v:v`) — sie kreuzen
 *    die Poolgrenze und sollen sie im rechten Winkel schneiden;
 *  - Assoziationen zu Textannotationen bleiben gerade.
 *
 * [ARCTOS-FULL-2026-08-31 · OP-020/OP-021/OP-039] **Was hier vorher stand.**
 * Die Tabelle bestand aus vier Zeilen und einer Vorgabe `["straight", "h:h"]`
 * für alles Übrige. `"straight"` ist in `ManhattanLayout` kein Feinschliff,
 * sondern ein **Vorrang**: sind Quelle und Ziel achsenüberlappend, wird die
 * Kante auf eine gemeinsame Achse gezogen und besteht danach aus genau zwei
 * Wegpunkten — eine von Hand gelegte Vier-Punkt-Führung ist weg, sobald
 * irgendetwas die Kante anfasst. Die Referenz führt `"straight"` deshalb
 * **nur** für Nachrichtenflüsse und für Kanten an aufgeklappten Subprozessen,
 * nicht für gewöhnliche Sequenzflüsse.
 *
 * Gemessen (Shadow-Compare, 100 Folgen à 10 Operationen, Seed 13337):
 * `waypoints/bpmn:SequenceFlow/count` fiel allein durch das Streichen von
 * `"straight"` aus der Vorgabe von **34 auf 9**; mit der vollständigen Tabelle
 * (Gateways, Boundary Events, Schleifen, `preserveDocking`, senkrechte Pools)
 * gingen `count` und `position` zusammen von **54 auf 4** zurück.
 *
 * Der Bericht `STUFE2-D-OFFENE-PUNKTE.md` §2.4 vermutete als Ursache ein
 * „Relayout beim Redo". Das trifft nicht zu: die kleinste reproduzierende
 * Folge ist **eine einzige** `reparent`-Operation auf
 * `synth-foreign-camunda-extensions` ohne jedes Undo/Redo (FF_1, FF_3: 2
 * Wegpunkte gegen 4). Die Klasse hatte keine Zustandsursache, sondern eine
 * Tabellenursache.
 */

import BaseLayouter from "diagram-js/lib/layout/BaseLayouter.js";
import {
  repairConnection,
  withoutRedundantPoints,
} from "diagram-js/lib/layout/ManhattanLayout.js";
import { getMid, getOrientation } from "diagram-js/lib/layout/LayoutUtil.js";
import type { BpmnConnection, BpmnElement, BpmnShape, Point } from "./types";
import { isHorizontalDi } from "./di";
import { boOf, is, isAny, isExpandedSubProcess } from "./util";

export interface LayoutHints {
  connectionStart?: Point;
  connectionEnd?: Point;
  source?: BpmnElement;
  target?: BpmnElement;
  waypoints?: Point[];
  preferredLayouts?: string[];
  preserveDocking?: "source" | "target" | undefined;
  [key: string]: unknown;
}

/**
 * Randabstand, mit dem die Seite eines Anhefters bestimmt wird.
 *
 * Negativ, damit ein Boundary Event, das mittig auf einer Kante des Wirts
 * sitzt, eindeutig dieser Kante zugeschlagen wird und nicht der Ecke. Die Zahl
 * ist keine Geschmacksfrage: sie entscheidet, ob eine Kante `b:h` oder `l:h`
 * bekommt, also ob sie durch ihren eigenen Wirt läuft.
 */
const ATTACH_ORIENTATION_PADDING = -10;

/** Ab welchem Abstand eine Schleifenkante auf derselben Seite andocken darf. */
const BOUNDARY_TO_HOST_THRESHOLD = 40;

interface LayoutTable {
  readonly default: string[];
  readonly fromGateway: string[];
  readonly toGateway: string[];
  readonly loop: {
    readonly fromTop: string[];
    readonly fromRight: string[];
    readonly fromLeft: string[];
    readonly fromBottom: string[];
  };
  readonly boundaryLoop: {
    readonly alternateHorizontalSide: string;
    readonly alternateVerticalSide: string;
    readonly default: string;
  };
  readonly messageFlow: string[];
  readonly subProcess: string[];
  readonly isHorizontal: boolean;
}

/** Waagerechter Pool (der Normalfall): gelesen wird von links nach rechts. */
export const HORIZONTAL_LAYOUTS: LayoutTable = {
  default: ["h:h"],
  fromGateway: ["v:h"],
  toGateway: ["h:v"],
  loop: {
    fromTop: ["t:r"],
    fromRight: ["r:b"],
    fromLeft: ["l:t"],
    fromBottom: ["b:l"],
  },
  boundaryLoop: {
    alternateHorizontalSide: "b",
    alternateVerticalSide: "l",
    default: "v",
  },
  messageFlow: ["straight", "v:v"],
  subProcess: ["straight", "h:h"],
  isHorizontal: true,
};

/**
 * Senkrechter Pool: dieselbe Tabelle mit vertauschten Achsen, Schleifen
 * andersherum.
 *
 * [ARCTOS-FULL-2026-08-31 · OP-039] Diese Hälfte gab es vorher nicht. Die
 * Lane-Geometrie kennt `isHorizontal` seit jeher und rechnet für beide Achsen
 * — die Kantenführung tat es nicht und legte in einem senkrechten Pool jede
 * Kante waagerecht, also quer zur Leserichtung des Diagramms.
 */
export const VERTICAL_LAYOUTS: LayoutTable = {
  default: ["v:v"],
  fromGateway: ["h:v"],
  toGateway: ["v:h"],
  loop: {
    fromTop: ["t:l"],
    fromRight: ["r:t"],
    fromLeft: ["l:b"],
    fromBottom: ["b:r"],
  },
  boundaryLoop: {
    alternateHorizontalSide: "t",
    alternateVerticalSide: "r",
    default: "h",
  },
  messageFlow: ["straight", "h:h"],
  subProcess: ["straight", "v:v"],
  isHorizontal: false,
};

const OPPOSITE: Record<string, string> = {
  top: "bottom",
  "top-right": "bottom-left",
  "top-left": "bottom-right",
  right: "left",
  bottom: "top",
  "bottom-right": "top-left",
  "bottom-left": "top-right",
  left: "right",
};

const DIRECTION: Record<string, string> = {
  top: "t",
  right: "r",
  bottom: "b",
  left: "l",
};

/**
 * Ist die Leserichtung an diesem Element waagerecht?
 *
 * Der Pool bestimmt es, nicht das Element: eine Aktivität in einem senkrechten
 * Pool wird senkrecht verbunden. Ein Element unter einer reinen Prozesswurzel
 * ist immer waagerecht — dort gibt es kein `isHorizontal`, über das man
 * entscheiden könnte.
 */
export function isDirectionHorizontal(
  element: BpmnElement | undefined,
): boolean {
  for (
    let node: BpmnElement | undefined = element?.parent as
      BpmnElement | undefined;
    node;
    node = node.parent as BpmnElement | undefined
  ) {
    const bo = boOf(node);
    // Zuerst der Prozess: hängt ein Element unter einer Prozesswurzel, gibt es
    // keinen Pool, der eine Richtung vorgeben könnte.
    if (is(bo, "bpmn:Process")) return true;
    if (isAny(bo, ["bpmn:Participant", "bpmn:Lane"])) {
      return isHorizontalDi((node as BpmnShape).di);
    }
  }
  if (element && isAny(boOf(element), ["bpmn:Participant", "bpmn:Lane"])) {
    return isHorizontalDi((element as BpmnShape).di);
  }
  return true;
}

/** Auf welcher Seite des Wirts sitzt ein Boundary Event? */
export function attachOrientation(
  boundary: BpmnShape,
  host: BpmnShape,
): "top" | "bottom" | "left" | "right" {
  const bx = boundary.x + boundary.width / 2;
  const by = boundary.y + boundary.height / 2;
  const distances = {
    left: Math.abs(bx - host.x),
    right: Math.abs(bx - (host.x + host.width)),
    top: Math.abs(by - host.y),
    bottom: Math.abs(by - (host.y + host.height)),
  };
  let best: "top" | "bottom" | "left" | "right" = "bottom";
  let bestValue = Number.POSITIVE_INFINITY;
  for (const side of ["top", "bottom", "left", "right"] as const) {
    if (distances[side] < bestValue) {
      bestValue = distances[side];
      best = side;
    }
  }
  return best;
}

/**
 * Die Seite des Wirts samt Ecken — feiner als `attachOrientation()`, weil ein
 * Anhefter in einer Ecke eine andere Kantenführung braucht als einer mittig
 * auf einer Kante.
 */
function attachOrientationOf(boundary: BpmnShape): string {
  const host = boundary.host;
  if (!host) return "bottom";
  return getOrientation(
    getMid(boundary as never) as never,
    host as never,
    ATTACH_ORIENTATION_PADDING as never,
  ) as string;
}

function horizontalPart(orientation: string): string | undefined {
  return /right|left/.exec(orientation)?.[0];
}

function verticalPart(orientation: string): string | undefined {
  return /top|bottom/.exec(orientation)?.[0];
}

function isSide(orientation: string): boolean {
  return (
    orientation === "top" ||
    orientation === "right" ||
    orientation === "bottom" ||
    orientation === "left"
  );
}

function isHorizontalOrientation(orientation: string): boolean {
  return orientation === "right" || orientation === "left";
}

/** Schleife auf dasselbe Element: um die Form herum, von der bisherigen Seite. */
function loopLayout(
  source: BpmnShape,
  connection: BpmnConnection,
  table: LayoutTable,
): string[] {
  const first = connection.waypoints?.[0];
  const orientation = first
    ? // Padding 0: `getOrientation` ist in JS mit Vorgabe 0 deklariert, in den
      // Typen ohne — der Wert muss also stehen, und 0 ist genau die Vorgabe.
      (getOrientation(first as never, source as never, 0) as string)
    : undefined;
  if (orientation === "top") return table.loop.fromTop;
  if (orientation === "right") return table.loop.fromRight;
  if (orientation === "left") return table.loop.fromLeft;
  return table.loop.fromBottom;
}

function closeOnAxis(
  axis: "x" | "y",
  a: Point,
  b: Point,
  threshold: number,
): boolean {
  return Math.abs(a[axis] - b[axis]) < threshold;
}

/** Darf eine Schleife zum Wirt auf derselben Seite andocken? */
function connectsToSameSide(
  axis: "x" | "y",
  source: BpmnShape,
  target: BpmnShape,
  end: Point,
): boolean {
  const threshold = BOUNDARY_TO_HOST_THRESHOLD;
  return !(
    closeOnAxis(axis, end, target, threshold) ||
    closeOnAxis(
      axis,
      end,
      { x: target.x + target.width, y: target.y + target.height },
      threshold,
    ) ||
    closeOnAxis(axis, end, getMid(source as never) as Point, threshold)
  );
}

function boundaryLoopLayout(
  attach: string,
  attachedToSide: boolean,
  source: BpmnShape,
  target: BpmnShape,
  end: Point,
  table: LayoutTable,
): string[] {
  const orientation = attachedToSide
    ? attach
    : ((table.isHorizontal ? verticalPart(attach) : horizontalPart(attach)) ??
      "bottom");
  const sourceLayout = DIRECTION[orientation] ?? "b";
  let targetLayout: string;
  if (attachedToSide) {
    if (isHorizontalOrientation(attach)) {
      targetLayout = connectsToSameSide("y", source, target, end)
        ? "h"
        : table.boundaryLoop.alternateHorizontalSide;
    } else {
      targetLayout = connectsToSameSide("x", source, target, end)
        ? "v"
        : table.boundaryLoop.alternateVerticalSide;
    }
  } else {
    targetLayout = table.boundaryLoop.default;
  }
  return [`${sourceLayout}:${targetLayout}`];
}

function boundarySourceSide(
  attach: string,
  targetOrientation: string,
  attachedToSide: boolean,
  horizontal: boolean,
): string {
  if (attachedToSide) return DIRECTION[attach] ?? "b";

  const va = verticalPart(attach);
  const ha = horizontalPart(attach);
  const vt = verticalPart(targetOrientation);
  const ht = horizontalPart(targetOrientation);

  if (horizontal) {
    if ((va && va === vt) || (ha && ht && OPPOSITE[ha] === ht)) {
      return DIRECTION[va ?? ""] ?? "b";
    }
  } else if ((ha && ha === ht) || (va && vt && OPPOSITE[va] === vt)) {
    return DIRECTION[ha ?? ""] ?? "l";
  }
  return DIRECTION[(horizontal ? ha : va) ?? ""] ?? (horizontal ? "r" : "b");
}

function boundaryTargetSide(
  attach: string,
  targetOrientation: string,
  attachedToSide: boolean,
  horizontal: boolean,
): string {
  if (attachedToSide) {
    if (isHorizontalOrientation(attach)) {
      const opposite = OPPOSITE[horizontalPart(attach) ?? ""];
      if (
        (opposite && targetOrientation.includes(opposite)) ||
        attach === targetOrientation
      ) {
        return "h";
      }
      return "v";
    }
    const opposite = OPPOSITE[verticalPart(attach) ?? ""];
    if (
      (opposite && targetOrientation.includes(opposite)) ||
      attach === targetOrientation
    ) {
      return "v";
    }
    return "h";
  }

  const va = verticalPart(attach);
  const ha = horizontalPart(attach);
  const vt = verticalPart(targetOrientation);
  const ht = horizontalPart(targetOrientation);

  // Ziel genau ober-/unterhalb bzw. genau links/rechts: dann gibt es keine
  // zweite Achse, über die man sich streiten könnte.
  if (vt && !ht) return "v";
  if (ht && !vt) return "h";

  if (horizontal) return va === vt ? "h" : "v";
  return ha === ht ? "v" : "h";
}

function boundaryLayouts(
  source: BpmnShape,
  target: BpmnShape,
  end: Point,
  table: LayoutTable,
): string[] {
  const attach = attachOrientationOf(source);
  const attachedToSide = isSide(attach);

  if (source.host && (source.host as BpmnElement) === (target as BpmnElement)) {
    return boundaryLoopLayout(
      attach,
      attachedToSide,
      source,
      target,
      end,
      table,
    );
  }

  const targetOrientation = getOrientation(
    getMid(target as never) as never,
    getMid(source as never) as never,
    {
      x: source.width / 2 + target.width / 2,
      y: source.height / 2 + target.height / 2,
    } as never,
  ) as string;

  const sourceSide = boundarySourceSide(
    attach,
    targetOrientation,
    attachedToSide,
    table.isHorizontal,
  );
  const targetSide = boundaryTargetSide(
    attach,
    targetOrientation,
    attachedToSide,
    table.isHorizontal,
  );
  return [`${sourceSide}:${targetSide}`];
}

/** Kompensationsverbindung: Boundary Event auf eine Kompensationsaktivität. */
function isCompensationAssociation(
  source: BpmnElement | undefined,
  target: BpmnElement | undefined,
): boolean {
  return (
    is(boOf(target), "bpmn:Activity") &&
    is(boOf(source), "bpmn:BoundaryEvent") &&
    boOf(target)?.["isForCompensation"] === true
  );
}

/** Ist das eine Assoziation, deren Zwischenpunkte von Hand gelegt sind? */
function isAssociation(connection: BpmnConnection): boolean {
  const bo = boOf(connection);
  return (
    is(bo, "bpmn:Association") ||
    is(bo, "bpmn:DataInputAssociation") ||
    is(bo, "bpmn:DataOutputAssociation")
  );
}

export interface ManhattanOptions {
  readonly preferredLayouts: string[];
  readonly preserveDocking?: "source" | "target" | undefined;
}

/**
 * Die vollständige Entscheidung für eine Kante: bevorzugte Führungen und, wo
 * es darauf ankommt, welcher Andockpunkt erhalten bleibt.
 *
 * `undefined` heißt „keine Manhattan-Führung" — dann bleiben die vorhandenen
 * Zwischenpunkte stehen und nur die Enden ziehen nach.
 */
export function manhattanOptions(
  connection: BpmnConnection,
  source: BpmnShape | undefined,
  target: BpmnShape | undefined,
  connectionEnd: Point,
): ManhattanOptions | undefined {
  const bo = boOf(connection);
  const table = isDirectionHorizontal(source ?? connection)
    ? HORIZONTAL_LAYOUTS
    : VERTICAL_LAYOUTS;

  if (is(bo, "bpmn:MessageFlow")) {
    return {
      preferredLayouts: table.messageFlow,
      preserveDocking: messageFlowDocking(source, target),
    };
  }

  const compensation = isCompensationAssociation(source, target);
  if (!is(bo, "bpmn:SequenceFlow") && !compensation) return undefined;
  if (!source || !target) return { preferredLayouts: table.default };

  if ((source as BpmnElement) === (target as BpmnElement)) {
    return { preferredLayouts: loopLayout(source, connection, table) };
  }
  if (is(boOf(source), "bpmn:BoundaryEvent")) {
    return {
      preferredLayouts: boundaryLayouts(source, target, connectionEnd, table),
    };
  }
  if (isExpandedSubProcess(source) || isExpandedSubProcess(target)) {
    return {
      preferredLayouts: table.subProcess,
      preserveDocking: isExpandedSubProcess(source) ? "target" : "source",
    };
  }
  if (is(boOf(source), "bpmn:Gateway")) {
    return { preferredLayouts: table.fromGateway };
  }
  if (is(boOf(target), "bpmn:Gateway")) {
    return { preferredLayouts: table.toGateway };
  }
  return { preferredLayouts: table.default };
}

/**
 * Welcher Andockpunkt eines Nachrichtenflusses erhalten bleibt.
 *
 * Der Pool gewinnt gegen alles, dann der aufgeklappte Subprozess, dann das
 * Ereignis: eine Kante, die an einer Poolkante andockt, darf beim Verschieben
 * des Gegenübers nicht an der Poolkante entlangwandern.
 */
function messageFlowDocking(
  source: BpmnElement | undefined,
  target: BpmnElement | undefined,
): "source" | "target" | undefined {
  if (is(boOf(target), "bpmn:Participant")) return "source";
  if (is(boOf(source), "bpmn:Participant")) return "target";
  if (target && isExpandedSubProcess(target as BpmnShape)) return "source";
  if (source && isExpandedSubProcess(source as BpmnShape)) return "target";
  if (is(boOf(target), "bpmn:Event")) return "target";
  if (is(boOf(source), "bpmn:Event")) return "source";
  return undefined;
}

/**
 * Bevorzugte Layouts für eine Kante — die schmale, weiterhin exportierte Sicht
 * auf `manhattanOptions()`. Bestandstests und der Editor-Strang fragen
 * hierüber; die Entscheidung selbst steht oben.
 */
export function preferredLayouts(connection: BpmnConnection): string[] {
  if (isAssociation(connection)) return ["straight"];
  const source = connection.source as BpmnShape | undefined;
  const target = connection.target as BpmnShape | undefined;
  const end =
    connection.waypoints?.[connection.waypoints.length - 1] ??
    (target ? (getMid(target as never) as Point) : { x: 0, y: 0 });
  return (
    manhattanOptions(connection, source, target, end)?.preferredLayouts ?? [
      "straight",
    ]
  );
}

/**
 * Der Andockpunkt, den ein vorhandener Wegpunkt beschreibt.
 *
 * Ein Wegpunkt trägt nach dem Abschneiden an der Kontur sein Original mit
 * (`original`) — der Punkt, den das Routing gemeint hat, bevor er auf den Rand
 * gezogen wurde. Genau dieser ist beim Nachlegen wieder der richtige Eingang;
 * der abgeschnittene Punkt würde die Kante bei jedem Lauf ein Stück weiter
 * einwärts wandern lassen. Ohne Wegpunkt bleibt die Formmitte.
 */
function dockingOf(waypoint: Point | undefined, shape: BpmnShape): Point {
  if (!waypoint) return getMid(shape) as Point;
  const original = asPoint((waypoint as { original?: unknown }).original);
  return original ?? waypoint;
}

/** Ein Hint-Wert, der wirklich ein Punkt ist — `false` und `undefined` nicht. */
function asPoint(value: unknown): Point | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const point = value as { x?: unknown; y?: unknown };
  if (typeof point.x !== "number" || typeof point.y !== "number")
    return undefined;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return undefined;
  return { x: point.x, y: point.y };
}

export class BpmnLayouter extends BaseLayouter {
  override layoutConnection(
    connection: BpmnConnection,
    hints: LayoutHints = {},
  ): Point[] {
    const source = (hints.source ?? connection.source) as BpmnShape | undefined;
    const target = (hints.target ?? connection.target) as BpmnShape | undefined;

    if (!source || !target) {
      return connection.waypoints.length >= 2
        ? connection.waypoints
        : [
            { x: 0, y: 0 },
            { x: 0, y: 0 },
          ];
    }

    // **`??` genügt hier nicht.** `MoveHelper` aus `diagram-js` übergibt
    // `connectionStart: sourceMoved && getMovedSourceAnchor(...)` — bei einem
    // nicht mitbewegten Endpunkt steht dort also `false`, nicht `undefined`.
    // Mit `??` liefe dieses `false` als Startpunkt durch und die Kante bekäme
    // `NaN`-Wegpunkte. Das trifft genau den Fall „ein Pool wird umgebaut,
    // während ein Nachrichtenfluss in den anderen Pool zeigt".
    // `?? []`: eine **neue** Kante hat noch gar keine Wegpunkte —
    // `CreateConnectionHandler` legt sie erst aus dem Ergebnis dieses Aufrufs
    // an. Ohne den Ersatzwert griffe der Zugriff unten ins Leere und die
    // Operation würfe, statt zu zeichnen.
    const waypoints: readonly (Point | undefined)[] = Array.isArray(
      hints.waypoints,
    )
      ? hints.waypoints
      : (connection.waypoints ?? []);

    // **Ohne Hinweis gilt der bisherige Andockpunkt, nicht die Formmitte.**
    //
    // Hier stand `getMid(source)`. Das ist der richtige Ersatzwert für eine
    // *neue* Kante, aber der falsche für eine bestehende: `repairConnection`
    // entscheidet anhand der beiden Endpunkte, ob die vorhandene Route noch
    // taugt. Bekommt es die Formmitte statt des bisherigen Andockpunkts, wirkt
    // die Route jedes Mal reparaturbedürftig und wird neu gelegt — aus vier
    // Wegpunkten wurden zwei. Im Vergleichslauf war das die Klasse
    // `waypoints/bpmn:SequenceFlow/count` (gemessen `FF_1: 2 gegen 4`), und
    // fachlich ist es Verlust: eine von Hand gelegte Kantenführung überlebt
    // das Verschieben eines *anderen* Knotens nicht.
    const start =
      asPoint(hints.connectionStart) ?? dockingOf(waypoints[0], source);
    const end =
      asPoint(hints.connectionEnd) ??
      dockingOf(waypoints[waypoints.length - 1], target);

    // [ARCTOS-FULL-2026-08-31 · OP-021] Assoziationen bekommen gar keine
    // Manhattan-Führung mehr: die Zwischenpunkte bleiben stehen, nur die
    // beiden Enden ziehen nach. Vorher lief eine Assoziation über
    // `repairConnection` mit `preferredLayouts: ["straight"]` und verlor dabei
    // jede von Hand gelegte Zwischenstation. Eine Assoziation zu einer
    // Textannotation ist immer von Hand gelegt.
    if (
      isAssociation(connection) &&
      waypoints.length >= 2 &&
      !isCompensationAssociation(source, target)
    ) {
      const middle = waypoints.slice(1, -1).filter((p): p is Point => !!p);
      return [start, ...middle, end];
    }

    const options = manhattanOptions(connection, source, target, end);
    if (!options) return [start, end];

    const repaired = repairConnection(
      source as never,
      target as never,
      start as never,
      end as never,
      waypoints as never,
      {
        ...hints,
        // Die Vorgabe des Aufrufers gewinnt, aber nur wenn er wirklich eine
        // hat: `hints` trägt regelmäßig `preferredLayouts: undefined`, und ein
        // reines Spread würde die Tabelle damit überschreiben.
        preferredLayouts: hints.preferredLayouts ?? options.preferredLayouts,
        preserveDocking: hints.preserveDocking ?? options.preserveDocking,
      } as never,
    ) as Point[];

    const cleaned = withoutRedundantPoints(repaired as never) as Point[];
    // Letzte Sicherung: eine Kante mit `NaN` ist im Bild unsichtbar, in der
    // DI aber dauerhaft — und `dc:Point/@x="NaN"` liest kein Fremdwerkzeug.
    // Lieber die Mitten verbinden als etwas Unbrauchbares schreiben.
    if (cleaned.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
      return [getMid(source) as Point, getMid(target) as Point];
    }
    return cleaned;
  }
}

export default BpmnLayouter;
