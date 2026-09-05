/// <reference lib="dom" />

import BaseRenderer from "diagram-js/lib/draw/BaseRenderer.js";
import type {
  ConnectionLike,
  ElementLike,
  ShapeLike,
} from "diagram-js/lib/core/Types.js";

import {
  drawSymbol,
  GATEWAY_SYMBOLS,
  getEventSymbol,
  getTaskSymbol,
  MARKER_BOX,
  MARKER_SYMBOLS,
  type SymbolDef,
} from "./icons";
import {
  applyMarkers,
  MarkerRegistry,
  ownerSvg,
  type MarkerKind,
} from "./markers";
import {
  getActivityMarkers,
  getEventDefinitionType,
  getLabelText,
  getTypeLabel,
  hasDoubleBorder,
  hasThickBorder,
  isBlackBoxPool,
  isCollapsed,
  isConditionalFlow,
  isDefaultFlow,
  isDirectedAssociation,
  isEvent,
  isGateway,
  isHorizontal,
  isInterrupting,
  isSubProcess,
  isSupportedConnectionType,
  isSupportedShapeType,
  isTask,
  isThrowing,
} from "./semantic";
import {
  circlePath,
  polygonPath,
  polylinePath,
  roundRectPath,
  svgAppend,
  svgAttr,
  svgCreate,
} from "./svg";
import { renderText } from "./text";
import {
  ACTIVITY_RADIUS,
  DASH_ASSOCIATION,
  DASH_EVENT,
  DASH_GROUP,
  DASH_MESSAGE_FLOW,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  DEFAULT_PALETTE,
  HIGH_CONTRAST_PALETTE,
  LABEL_PADDING,
  LANE_HEADER,
  STROKE_SYMBOL,
  STROKE_THICK,
  STROKE_THIN,
  type Palette,
} from "./theme";
import type {
  BpmnConnection,
  BpmnRendererConfig,
  BpmnShape,
  ModdleElement,
  Point,
} from "./types";

/**
 * BPMN-Renderer auf `diagram-js`' `BaseRenderer`.
 *
 * Vollständig eigene Umsetzung nach BPMN 2.0 (OMG formal/2013-12-09, Kapitel 10).
 * Kein Quelltext aus `bpmn-js`; insbesondere werden alle Symbole als SVG-Pfade
 * gezeichnet statt über die Icon-Schrift `bpmn-font`.
 *
 * Zeichenkonventionen, die die Tests prüfen:
 * - jedes Visual trägt `data-bpmn-type`
 * - die tragende Kontur trägt `class="bpmn-outline"`
 * - Symbole tragen `data-symbol`, Aktivitätsmarker `data-marker`
 * - Strichstärken: 2 (dünn), 4 (dick), doppelter Rand bei Zwischenereignissen
 */
export default class BpmnRenderer extends BaseRenderer {
  static $inject = ["eventBus", "config.bpmnRenderer"];

  private readonly palette: Palette;
  private readonly fontFamily: string;
  private readonly fontSize: number;
  private readonly registries = new WeakMap<SVGSVGElement, MarkerRegistry>();

  constructor(eventBus: unknown, config?: BpmnRendererConfig) {
    // `BaseRenderer` ist eine JS-Konstruktorfunktion; Priorität 1200 sorgt dafür,
    // dass dieser Renderer vor `DefaultRenderer` (1000) zum Zuge kommt.
    super(eventBus as never, 1200);
    this.palette =
      config?.contrast === "more" ? HIGH_CONTRAST_PALETTE : DEFAULT_PALETTE;
    this.fontFamily = config?.fontFamily ?? DEFAULT_FONT_FAMILY;
    this.fontSize = config?.fontSize ?? DEFAULT_FONT_SIZE;
  }

  override canRender(element: ElementLike): boolean {
    const type = (element as { type?: unknown }).type;
    if (typeof type !== "string") {
      return false;
    }
    return (
      type === "label" ||
      isSupportedShapeType(type) ||
      isSupportedConnectionType(type)
    );
  }

  override drawShape(visuals: SVGElement, element: ShapeLike): SVGElement {
    // [ARCTOS-FULL-2026-08-31 · OP-046] Die DI-Farben werden **nach** dem
    // Zeichnen aufgetragen, nicht in jede der vierzig Palettenstellen
    // hineingereicht. Der Grund ist nicht Bequemlichkeit: die Palette ist die
    // Aussage des Produkts (einschliesslich der Hochkontrastfassung), die
    // DI-Farbe die des Dokuments. Eine Übersteuerung am Ende hält beide
    // auseinander und lässt sich an einer Stelle abschalten, falls die
    // GRC-Schicht einmal dieselbe Fläche einfärben will.
    return this.applyDiColors(this.drawShapeBody(visuals, element), element);
  }

  private drawShapeBody(visuals: SVGElement, element: ShapeLike): SVGElement {
    const shape = element as unknown as BpmnShape;
    assertFiniteBounds(shape);
    svgAttr(visuals, { "data-bpmn-type": shape.type, "aria-hidden": "true" });

    if (shape.type === "label") {
      return this.drawExternalLabel(visuals, shape);
    }
    if (isEvent(shape.type)) {
      return this.drawEvent(visuals, shape);
    }
    if (isGateway(shape.type)) {
      return this.drawGateway(visuals, shape);
    }
    if (
      isTask(shape.type) ||
      isSubProcess(shape.type) ||
      shape.type === "bpmn:CallActivity"
    ) {
      return this.drawActivity(visuals, shape);
    }
    if (shape.type === "bpmn:DataObjectReference") {
      return this.drawDataObject(visuals, shape);
    }
    if (shape.type === "bpmn:DataInput" || shape.type === "bpmn:DataOutput") {
      return this.drawDataObject(visuals, shape);
    }
    if (shape.type === "bpmn:DataStoreReference") {
      return this.drawDataStore(visuals, shape);
    }
    if (shape.type === "bpmn:Participant") {
      return this.drawParticipant(visuals, shape);
    }
    if (shape.type === "bpmn:Lane") {
      return this.drawLane(visuals, shape);
    }
    if (shape.type === "bpmn:TextAnnotation") {
      return this.drawTextAnnotation(visuals, shape);
    }
    if (shape.type === "bpmn:Group") {
      return this.drawGroup(visuals, shape);
    }
    return this.drawFallback(visuals, shape);
  }

  override drawConnection(
    visuals: SVGElement,
    element: ConnectionLike,
  ): SVGElement {
    return this.applyDiColors(
      this.drawConnectionBody(visuals, element),
      element,
    );
  }

  /**
   * [ARCTOS-FULL-2026-08-31 · OP-046] DI-Farbattribute auftragen.
   *
   * Zwei Schreibweisen sind im Umlauf und beide kommen im Bestand vor:
   * `bioc:stroke`/`bioc:fill` (bpmn.io, seit 2018) und
   * `color:border-color`/`color:background-color` (BPMN-DI-Farberweiterung,
   * OMG). Beide werden gelesen; bpmn.io hat Vorrang, weil es die Fassung ist,
   * die der Bestandseditor schreibt.
   *
   * **Nur Hexfarben.** Der Wert landet in einem SVG-Attribut; eine
   * ungeprüfte Zeichenkette aus einer hochgeladenen Datei hätte dort nichts zu
   * suchen (`url(...)`, `expression(...)`). Was nicht wie `#rgb` oder
   * `#rrggbb` aussieht, wird verworfen — schweigend, weil eine
   * unbrauchbare Farbe kein Grund ist, ein Diagramm nicht zu zeichnen.
   */
  private applyDiColors(node: SVGElement, element: unknown): SVGElement {
    const di = (element as { di?: ModdleElement }).di;
    if (!di) return node;
    const stroke = hexColor(
      di["bioc:stroke"] ??
        (di["$attrs"] as Record<string, unknown> | undefined)?.[
          "bioc:stroke"
        ] ??
        (di["$attrs"] as Record<string, unknown> | undefined)?.[
          "color:border-color"
        ],
    );
    const fill = hexColor(
      di["bioc:fill"] ??
        (di["$attrs"] as Record<string, unknown> | undefined)?.["bioc:fill"] ??
        (di["$attrs"] as Record<string, unknown> | undefined)?.[
          "color:background-color"
        ],
    );
    if (stroke) svgAttr(node, { stroke, "data-di-stroke": stroke });
    // Eine Kante hat keine Fläche; ein `fill` an ihr würde sie zulaufen lassen.
    if (fill && node.getAttribute("fill") !== "none") {
      svgAttr(node, { fill, "data-di-fill": fill });
    }
    return node;
  }

  private drawConnectionBody(
    visuals: SVGElement,
    element: ConnectionLike,
  ): SVGElement {
    const connection = element as unknown as BpmnConnection;
    const waypoints = connection.waypoints;
    if (waypoints.length < 2) {
      throw new Error(`Kante ${connection.id} hat weniger als zwei Wegpunkte`);
    }
    for (const point of waypoints) {
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        throw new Error(
          `Kante ${connection.id} hat einen nicht-endlichen Wegpunkt`,
        );
      }
    }

    svgAttr(visuals, {
      "data-bpmn-type": connection.type,
      "aria-hidden": "true",
    });
    const registry = this.registryFor(visuals);

    const line = svgCreate("path", {
      d: polylinePath(waypoints),
      class: "bpmn-outline bpmn-connection",
      fill: "none",
      stroke: this.palette.stroke,
      "stroke-width": STROKE_THIN,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    });

    const markers: { start?: MarkerKind; end?: MarkerKind } = {};
    switch (connection.type) {
      case "bpmn:SequenceFlow":
        markers.end = "sequenceflow-end";
        if (isDefaultFlow(connection)) {
          markers.start = "default-flow-start";
          svgAttr(line, { "data-flow": "default" });
        } else if (isConditionalFlow(connection)) {
          markers.start = "conditional-flow-start";
          svgAttr(line, { "data-flow": "conditional" });
        }
        break;
      case "bpmn:MessageFlow":
        markers.start = "messageflow-start";
        markers.end = "messageflow-end";
        svgAttr(line, { "stroke-dasharray": DASH_MESSAGE_FLOW });
        break;
      case "bpmn:Association":
        svgAttr(line, {
          "stroke-dasharray": DASH_ASSOCIATION,
          "stroke-width": 1.5,
        });
        if (isDirectedAssociation(connection)) {
          markers.end = "association-end";
        }
        break;
      case "bpmn:DataInputAssociation":
      case "bpmn:DataOutputAssociation":
        svgAttr(line, {
          "stroke-dasharray": DASH_ASSOCIATION,
          "stroke-width": 1.5,
        });
        markers.end = "association-end";
        break;
      default:
        markers.end = "sequenceflow-end";
        break;
    }
    applyMarkers(line, registry, markers);

    svgAppend(visuals, line);

    // [ARCTOS-FULL-2026-08-31 · OP-046] Das Nachrichtensymbol in der Mitte
    // eines Nachrichtenflusses. BPMN 2.0 §11.1 zeigt es dort, wenn eine
    // Nachricht am Fluss hängt (`messageRef`), und unterscheidet **gefüllt**
    // (gesendet, Initiator) von **ungefüllt** (empfangen). Ohne das Symbol
    // sieht ein Diagramm mit fünf Nachrichtenflüssen aus wie eines mit fünf
    // gestrichelten Linien: welche Nachricht wohin geht, stand nur in der
    // Datei.
    if (connection.type === "bpmn:MessageFlow" && hasMessageRef(connection)) {
      this.drawMessageFlowSymbol(visuals, connection);
    }
    return line;
  }

  /** Siehe {@link drawConnection}: das Symbol am Mittelpunkt der Kante. */
  private drawMessageFlowSymbol(
    visuals: SVGElement,
    connection: BpmnConnection,
  ): void {
    const centre = midpointOf(connection.waypoints);
    if (!centre) return;
    const size = 18;
    const initiating = isInitiatingMessage(connection);
    const group = drawSymbol(visuals, getEventSymbol("message"), {
      x: centre.x - size / 2,
      y: centre.y - size / 2,
      size,
      // Gefüllt heisst „von hier gesendet"; ungefüllt „hier empfangen".
      body: initiating ? this.palette.stroke : this.palette.fill,
      line: this.palette.stroke,
      detail: initiating ? this.palette.fill : this.palette.stroke,
      defaultStrokeWidth: STROKE_SYMBOL,
      className: "bpmn-messageflow-symbol",
    });
    svgAttr(group, {
      "data-marker": "messageflow-message",
      "data-initiating": initiating ? "true" : "false",
    });
  }

  override getShapePath(element: ShapeLike): string {
    const shape = element as unknown as BpmnShape;
    const { x, y, width, height } = shape;
    if (isEvent(shape.type)) {
      return circlePath(
        x + width / 2,
        y + height / 2,
        Math.min(width, height) / 2,
      );
    }
    if (isGateway(shape.type)) {
      return diamondPath(x, y, width, height);
    }
    if (
      isTask(shape.type) ||
      isSubProcess(shape.type) ||
      shape.type === "bpmn:CallActivity"
    ) {
      return roundRectPath(x, y, width, height, ACTIVITY_RADIUS);
    }
    return roundRectPath(x, y, width, height, 0);
  }

  override getConnectionPath(element: ConnectionLike): string {
    return polylinePath((element as unknown as BpmnConnection).waypoints);
  }

  /* ---------------------------------------------------------------- *
   * Ereignisse
   * ---------------------------------------------------------------- */

  private drawEvent(visuals: SVGElement, shape: BpmnShape): SVGElement {
    const radius = Math.min(shape.width, shape.height) / 2;
    const cx = shape.x + shape.width / 2;
    const cy = shape.y + shape.height / 2;
    const thick = hasThickBorder(shape.type);
    const dashed = !isInterrupting(shape.businessObject);

    const outline = svgCreate("circle", {
      cx,
      cy,
      r: radius,
      class: "bpmn-outline bpmn-event",
      fill: this.palette.fill,
      stroke: this.palette.stroke,
      "stroke-width": thick ? STROKE_THICK : STROKE_THIN,
      "stroke-dasharray": dashed ? DASH_EVENT : undefined,
      "data-border": thick ? "thick" : "thin",
    });
    svgAppend(visuals, outline);

    if (hasDoubleBorder(shape.type)) {
      svgAppend(
        visuals,
        svgCreate("circle", {
          cx,
          cy,
          r: radius - 3,
          class: "bpmn-event-inner",
          fill: "none",
          stroke: this.palette.stroke,
          "stroke-width": STROKE_THIN,
          "stroke-dasharray": dashed ? DASH_EVENT : undefined,
          "data-border": "double",
        }),
      );
      svgAttr(outline, { "data-border": "double" });
    }

    const definition = getEventDefinitionType(shape.businessObject);
    if (definition !== "none") {
      const throwing = isThrowing(shape.type);
      const size = radius * 1.15;
      // BPMN 2.0, 10.4.3: gefangene Ereignisse zeigen das Symbol ungefüllt mit
      // dunkler Kontur, geworfene dunkel gefüllt mit hellen Innenlinien.
      const group = drawSymbol(visuals, getEventSymbol(definition), {
        x: cx - size / 2,
        y: cy - size / 2,
        size,
        body: throwing ? this.palette.symbolSolid : this.palette.fill,
        line: this.palette.stroke,
        detail: throwing ? this.palette.symbolHollow : this.palette.stroke,
        defaultStrokeWidth: STROKE_SYMBOL,
        className: "bpmn-event-symbol",
      });
      svgAttr(group, {
        "data-symbol": definition,
        "data-symbol-style": throwing ? "filled" : "hollow",
      });
    }

    return outline;
  }

  /* ---------------------------------------------------------------- *
   * Aktivitäten
   * ---------------------------------------------------------------- */

  private drawActivity(visuals: SVGElement, shape: BpmnShape): SVGElement {
    const isCall = shape.type === "bpmn:CallActivity";
    const strokeWidth = isCall ? STROKE_THICK : STROKE_THIN;
    const isEventSubProcess =
      isSubProcess(shape.type) &&
      shape.businessObject["triggeredByEvent"] === true;

    const outline = svgCreate("rect", {
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
      rx: ACTIVITY_RADIUS,
      ry: ACTIVITY_RADIUS,
      class: "bpmn-outline bpmn-activity",
      fill: this.palette.fill,
      stroke: this.palette.stroke,
      "stroke-width": strokeWidth,
      "stroke-dasharray": isEventSubProcess ? DASH_EVENT : undefined,
      "data-border": isCall ? "thick" : "thin",
    });
    svgAppend(visuals, outline);

    if (shape.type === "bpmn:Transaction") {
      svgAppend(
        visuals,
        svgCreate("rect", {
          x: shape.x + 3,
          y: shape.y + 3,
          width: Math.max(0, shape.width - 6),
          height: Math.max(0, shape.height - 6),
          rx: Math.max(0, ACTIVITY_RADIUS - 3),
          ry: Math.max(0, ACTIVITY_RADIUS - 3),
          class: "bpmn-activity-inner",
          fill: "none",
          stroke: this.palette.stroke,
          "stroke-width": STROKE_THIN,
          "data-border": "double",
        }),
      );
      svgAttr(outline, { "data-border": "double" });
    }

    const taskSymbol = getTaskSymbol(shape.type);
    if (taskSymbol) {
      const group = drawSymbol(visuals, taskSymbol, {
        x: shape.x + 6,
        y: shape.y + 6,
        size: 16,
        body: this.palette.fill,
        line: this.palette.stroke,
        detail: this.palette.fill,
        defaultStrokeWidth: 1.2,
        className: "bpmn-task-symbol",
      });
      svgAttr(group, { "data-symbol": shape.type.replace("bpmn:", "") });
    }

    this.drawActivityMarkers(visuals, shape);

    const collapsed = isCollapsed(shape);
    const expanded = isSubProcess(shape.type) && !collapsed;
    const label = getLabelText(shape);
    if (label) {
      if (expanded) {
        // Aufgeklappter Subprozess: Beschriftung oben, damit der Inhalt frei bleibt.
        renderText(visuals, label, {
          box: {
            x: shape.x + LABEL_PADDING,
            y: shape.y + LABEL_PADDING,
            width: Math.max(1, shape.width - 2 * LABEL_PADDING),
            height: this.fontSize * 2,
          },
          width: Math.max(1, shape.width - 2 * LABEL_PADDING),
          align: "left",
          verticalAlign: "top",
          fontSize: this.fontSize,
          fontFamily: this.fontFamily,
          fill: this.palette.text,
          maxHeight: this.fontSize * 2.4,
        });
      } else {
        const inset = taskSymbol ? 22 : LABEL_PADDING;
        renderText(visuals, label, {
          box: {
            x: shape.x + LABEL_PADDING,
            y: shape.y + inset,
            width: Math.max(1, shape.width - 2 * LABEL_PADDING),
            height: Math.max(1, shape.height - inset - 18),
          },
          width: Math.max(1, shape.width - 2 * LABEL_PADDING),
          align: "center",
          verticalAlign: "middle",
          fontSize: this.fontSize,
          fontFamily: this.fontFamily,
          fill: this.palette.text,
          maxHeight: Math.max(this.fontSize, shape.height - inset - 18),
        });
      }
    }

    return outline;
  }

  private drawActivityMarkers(visuals: SVGElement, shape: BpmnShape): void {
    const markers = getActivityMarkers(shape);
    const active: Array<[string, SymbolDef]> = [];
    if (markers.collapsed) {
      active.push(["collapsed", MARKER_SYMBOLS.collapsed]);
    }
    if (markers.adHoc) {
      active.push(["adHoc", MARKER_SYMBOLS.adHoc]);
    }
    if (markers.loop) {
      active.push(["loop", MARKER_SYMBOLS.loop]);
    }
    if (markers.parallelMultiInstance) {
      active.push([
        "parallelMultiInstance",
        MARKER_SYMBOLS.parallelMultiInstance,
      ]);
    }
    if (markers.sequentialMultiInstance) {
      active.push([
        "sequentialMultiInstance",
        MARKER_SYMBOLS.sequentialMultiInstance,
      ]);
    }
    if (markers.compensation) {
      active.push(["compensation", MARKER_SYMBOLS.compensation]);
    }
    if (active.length === 0) {
      return;
    }

    const size = MARKER_BOX;
    const gap = 3;
    const totalWidth = active.length * size + (active.length - 1) * gap;
    let x = shape.x + shape.width / 2 - totalWidth / 2;
    const y = shape.y + shape.height - size - 3;

    for (const entry of active) {
      const group = drawSymbol(visuals, entry[1], {
        x,
        y,
        size,
        sourceSize: MARKER_BOX,
        body: this.palette.fill,
        line: this.palette.stroke,
        detail: this.palette.fill,
        defaultStrokeWidth: 1.2,
        className: "bpmn-activity-marker",
      });
      svgAttr(group, { "data-marker": entry[0] });
      x += size + gap;
    }
  }

  /* ---------------------------------------------------------------- *
   * Gateways
   * ---------------------------------------------------------------- */

  private drawGateway(visuals: SVGElement, shape: BpmnShape): SVGElement {
    const outline = svgCreate("path", {
      d: diamondPath(shape.x, shape.y, shape.width, shape.height),
      class: "bpmn-outline bpmn-gateway",
      fill: this.palette.fill,
      stroke: this.palette.stroke,
      "stroke-width": STROKE_THIN,
      "stroke-linejoin": "round",
      "data-border": "thin",
    });
    svgAppend(visuals, outline);

    const symbol = GATEWAY_SYMBOL_BY_TYPE[shape.type];
    if (!symbol) {
      return outline;
    }
    // [ARCTOS-FULL-2026-08-31 · OP-046] `isMarkerVisible="false"` am
    // exklusiven Gateway. Die BPMN-DI erlaubt es ausdrücklich (BPMN 2.0
    // §12.2.2), das X wegzulassen — die leere Raute ist dann die Aussage
    // „exklusiv, unmarkiert". Bis hierher zeichnete der Renderer das X
    // **immer**; ein so gespeichertes Diagramm sah nach dem Laden anders aus
    // als vorher. Nur das exklusive Gateway kennt das Attribut; bei allen
    // übrigen ist das Symbol Teil des Typs.
    if (shape.type === "bpmn:ExclusiveGateway" && !isMarkerVisible(shape)) {
      svgAttr(outline, { "data-marker-visible": "false" });
      return outline;
    }
    const size = Math.min(shape.width, shape.height) * 0.42;
    const group = drawSymbol(visuals, symbol.def, {
      x: shape.x + shape.width / 2 - size / 2,
      y: shape.y + shape.height / 2 - size / 2,
      size,
      body: this.palette.fill,
      line: this.palette.stroke,
      detail: this.palette.fill,
      defaultStrokeWidth: STROKE_SYMBOL,
      className: "bpmn-gateway-symbol",
    });
    svgAttr(group, { "data-symbol": symbol.name });
    return outline;
  }

  /* ---------------------------------------------------------------- *
   * Daten
   * ---------------------------------------------------------------- */

  private drawDataObject(visuals: SVGElement, shape: BpmnShape): SVGElement {
    const { x, y, width, height } = shape;
    const fold = Math.min(width * 0.4, 16);

    const outline = svgCreate("path", {
      d: polygonPath([
        [x, y],
        [x + width - fold, y],
        [x + width, y + fold],
        [x + width, y + height],
        [x, y + height],
      ]),
      class: "bpmn-outline bpmn-data-object",
      fill: this.palette.fill,
      stroke: this.palette.stroke,
      "stroke-width": STROKE_THIN,
      "stroke-linejoin": "round",
      "data-border": "thin",
    });
    svgAppend(visuals, outline);

    svgAppend(
      visuals,
      svgCreate("path", {
        d: polygonPath([
          [x + width - fold, y],
          [x + width - fold, y + fold],
          [x + width, y + fold],
        ]),
        class: "bpmn-data-fold",
        fill: "none",
        stroke: this.palette.stroke,
        "stroke-width": STROKE_THIN,
        "stroke-linejoin": "round",
        "data-marker": "fold",
      }),
    );

    if (shape.type === "bpmn:DataInput" || shape.type === "bpmn:DataOutput") {
      const filled = shape.type === "bpmn:DataOutput";
      const arrow = svgCreate("path", {
        d: polygonPath([
          [x + 5, y + 9],
          [x + 11, y + 9],
          [x + 11, y + 6],
          [x + 16, y + 12],
          [x + 11, y + 18],
          [x + 11, y + 15],
          [x + 5, y + 15],
        ]),
        class: "bpmn-data-direction",
        fill: filled ? this.palette.symbolSolid : this.palette.fill,
        stroke: this.palette.stroke,
        "stroke-width": 1,
        "data-symbol": filled ? "dataOutput" : "dataInput",
      });
      svgAppend(visuals, arrow);
    }

    if (isCollection(shape)) {
      const cx = x + width / 2;
      const barY = y + height - 12;
      for (let i = -1; i <= 1; i += 1) {
        svgAppend(
          visuals,
          svgCreate("rect", {
            x: cx + i * 5 - 1.5,
            y: barY,
            width: 3,
            height: 10,
            class: "bpmn-data-collection",
            fill: this.palette.symbolSolid,
            stroke: "none",
            "data-marker": "collection",
          }),
        );
      }
    }

    return outline;
  }

  private drawDataStore(visuals: SVGElement, shape: BpmnShape): SVGElement {
    const { x, y, width, height } = shape;
    const ry = Math.min(height * 0.18, 10);
    const cx = x + width / 2;

    const body = svgCreate("path", {
      d: [
        `M ${fmt(x)} ${fmt(y + ry)}`,
        `L ${fmt(x)} ${fmt(y + height - ry)}`,
        `A ${fmt(width / 2)} ${fmt(ry)} 0 0 0 ${fmt(x + width)} ${fmt(y + height - ry)}`,
        `L ${fmt(x + width)} ${fmt(y + ry)}`,
        `A ${fmt(width / 2)} ${fmt(ry)} 0 0 0 ${fmt(x)} ${fmt(y + ry)}`,
        "z",
      ].join(" "),
      class: "bpmn-outline bpmn-data-store",
      fill: this.palette.fill,
      stroke: this.palette.stroke,
      "stroke-width": STROKE_THIN,
      "data-border": "thin",
    });
    svgAppend(visuals, body);

    for (let i = 1; i <= 2; i += 1) {
      svgAppend(
        visuals,
        svgCreate("path", {
          d: `M ${fmt(x)} ${fmt(y + ry * (i + 0.6))} A ${fmt(width / 2)} ${fmt(ry)} 0 0 0 ${fmt(
            x + width,
          )} ${fmt(y + ry * (i + 0.6))}`,
          class: "bpmn-data-store-layer",
          fill: "none",
          stroke: this.palette.stroke,
          "stroke-width": STROKE_THIN,
          "data-marker": "store-layer",
        }),
      );
    }
    void cx;

    return body;
  }

  /* ---------------------------------------------------------------- *
   * Pools, Lanes, Artefakte
   * ---------------------------------------------------------------- */

  private drawParticipant(visuals: SVGElement, shape: BpmnShape): SVGElement {
    const horizontal = isHorizontal(shape);
    const outline = svgCreate("rect", {
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
      class: "bpmn-outline bpmn-participant",
      fill: this.palette.laneFill,
      stroke: this.palette.stroke,
      "stroke-width": STROKE_THIN,
      "data-border": "thin",
      "data-orientation": horizontal ? "horizontal" : "vertical",
    });
    svgAppend(visuals, outline);

    if (isBlackBoxPool(shape)) {
      svgAttr(outline, { "data-blackbox": "true" });
      renderText(visuals, getLabelText(shape), {
        box: shape,
        width: Math.max(1, shape.width - 2 * LABEL_PADDING),
        align: "center",
        verticalAlign: "middle",
        fontSize: this.fontSize,
        fontFamily: this.fontFamily,
        fill: this.palette.text,
      });
      return outline;
    }

    this.drawLaneHeader(visuals, shape, horizontal, "bpmn-participant-header");
    this.drawParticipantMultiplicity(visuals, shape);
    return outline;
  }

  /**
   * [ARCTOS-FULL-2026-08-31 · OP-046] Der Mehrfachbeteiligter-Marker.
   *
   * `bpmn:Participant.participantMultiplicity` mit `maximum > 1` bedeutet: der
   * Pool steht für **mehrere** Beteiligte derselben Art (BPMN 2.0 §10.3.1).
   * Dargestellt wird das wie eine parallele Mehrfachinstanz — drei senkrechte
   * Striche unten mittig am Pool. Fehlte der Marker, war einem Diagramm nicht
   * anzusehen, ob „Lieferant" einer oder viele sind; das ist bei einer
   * SoD-Betrachtung kein kosmetischer Unterschied.
   */
  private drawParticipantMultiplicity(
    visuals: SVGElement,
    shape: BpmnShape,
  ): void {
    if (!hasParticipantMultiplicity(shape)) return;
    const size = 14;
    const gap = 4;
    const centreX = shape.x + shape.width / 2;
    const top = shape.y + shape.height - size - 4;
    for (let i = -1; i <= 1; i += 1) {
      const x = centreX + i * gap;
      svgAppend(
        visuals,
        svgCreate("path", {
          d: `M ${fmt(x)} ${fmt(top)} L ${fmt(x)} ${fmt(top + size)}`,
          class: "bpmn-participant-multiplicity",
          fill: "none",
          stroke: this.palette.stroke,
          "stroke-width": STROKE_THIN,
          "stroke-linecap": "round",
          "data-marker": "participant-multiplicity",
        }),
      );
    }
  }

  private drawLane(visuals: SVGElement, shape: BpmnShape): SVGElement {
    const horizontal = isHorizontal(shape);
    const outline = svgCreate("rect", {
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
      class: "bpmn-outline bpmn-lane",
      fill: this.palette.laneFill,
      stroke: this.palette.stroke,
      "stroke-width": STROKE_THIN,
      "data-border": "thin",
      "data-orientation": horizontal ? "horizontal" : "vertical",
    });
    svgAppend(visuals, outline);
    this.drawLaneHeader(visuals, shape, horizontal, "bpmn-lane-header");
    return outline;
  }

  private drawLaneHeader(
    visuals: SVGElement,
    shape: BpmnShape,
    horizontal: boolean,
    className: string,
  ): void {
    const header = horizontal
      ? { x: shape.x, y: shape.y, width: LANE_HEADER, height: shape.height }
      : { x: shape.x, y: shape.y, width: shape.width, height: LANE_HEADER };

    svgAppend(
      visuals,
      svgCreate("path", {
        d: horizontal
          ? `M ${fmt(shape.x + LANE_HEADER)} ${fmt(shape.y)} L ${fmt(
              shape.x + LANE_HEADER,
            )} ${fmt(shape.y + shape.height)}`
          : `M ${fmt(shape.x)} ${fmt(shape.y + LANE_HEADER)} L ${fmt(
              shape.x + shape.width,
            )} ${fmt(shape.y + LANE_HEADER)}`,
        class: className,
        fill: "none",
        stroke: this.palette.stroke,
        "stroke-width": STROKE_THIN,
        "data-marker": "lane-header",
      }),
    );

    const label = getLabelText(shape);
    if (!label) {
      return;
    }
    renderText(visuals, label, {
      box: header,
      // Bei waagerechten Bahnen steht die Beschriftung gedreht in der Kopfleiste;
      // die verfügbare Breite ist deshalb die Höhe der Bahn.
      width: Math.max(
        1,
        (horizontal ? shape.height : shape.width) - 2 * LABEL_PADDING,
      ),
      align: "center",
      verticalAlign: "middle",
      rotate: horizontal ? -90 : 0,
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      fill: this.palette.text,
      maxHeight: horizontal ? LANE_HEADER : LANE_HEADER,
    });
  }

  private drawTextAnnotation(
    visuals: SVGElement,
    shape: BpmnShape,
  ): SVGElement {
    const { x, y, width, height } = shape;
    const bracket = Math.min(10, width / 2);
    const outline = svgCreate("path", {
      d: `M ${fmt(x + bracket)} ${fmt(y)} L ${fmt(x)} ${fmt(y)} L ${fmt(x)} ${fmt(
        y + height,
      )} L ${fmt(x + bracket)} ${fmt(y + height)}`,
      class: "bpmn-outline bpmn-text-annotation",
      fill: "none",
      stroke: this.palette.stroke,
      "stroke-width": STROKE_THIN,
      "data-border": "thin",
      "data-marker": "annotation-bracket",
    });
    svgAppend(visuals, outline);

    renderText(visuals, getLabelText(shape), {
      box: {
        x: x + bracket / 2 + LABEL_PADDING,
        y: y + LABEL_PADDING,
        width: Math.max(1, width - bracket / 2 - 2 * LABEL_PADDING),
        height: Math.max(1, height - 2 * LABEL_PADDING),
      },
      width: Math.max(1, width - bracket / 2 - 2 * LABEL_PADDING),
      align: "left",
      verticalAlign: "top",
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      fill: this.palette.text,
      maxHeight: Math.max(this.fontSize, height - 2 * LABEL_PADDING),
    });
    return outline;
  }

  private drawGroup(visuals: SVGElement, shape: BpmnShape): SVGElement {
    const outline = svgCreate("rect", {
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
      rx: ACTIVITY_RADIUS,
      ry: ACTIVITY_RADIUS,
      class: "bpmn-outline bpmn-group",
      fill: "none",
      stroke: this.palette.groupStroke,
      "stroke-width": STROKE_THIN,
      "stroke-dasharray": DASH_GROUP,
      "pointer-events": "none",
      "data-border": "dashed",
    });
    svgAppend(visuals, outline);

    const categoryValue = shape.businessObject["categoryValueRef"];
    const label =
      categoryValue !== null &&
      typeof categoryValue === "object" &&
      "value" in categoryValue
        ? String((categoryValue as { value?: unknown }).value ?? "")
        : getLabelText(shape);

    if (label) {
      renderText(visuals, label, {
        box: {
          x: shape.x,
          y: shape.y - this.fontSize * 1.4,
          width: shape.width,
          height: this.fontSize * 1.4,
        },
        width: shape.width,
        align: "center",
        verticalAlign: "middle",
        fontSize: this.fontSize,
        fontFamily: this.fontFamily,
        fill: this.palette.text,
      });
    }
    return outline;
  }

  /* ---------------------------------------------------------------- *
   * Beschriftungen
   * ---------------------------------------------------------------- */

  /**
   * Externe Beschriftung als eigenes `label`-Shape (Ereignisse, Gateways, Kanten).
   *
   * Der Pseudotyp `label` stammt aus `diagram-js`' `label-support` und wird hier
   * bewusst beibehalten — der ARCTOS-Anwendungscode filtert bereits darauf
   * (Bestandsaufnahme 4.4, Punkt 4).
   */
  private drawExternalLabel(visuals: SVGElement, shape: BpmnShape): SVGElement {
    const target = shape.labelTarget;
    const text = target ? getLabelText(target) : getLabelText(shape);
    // Die DI-Beschriftungsbox ist eine Empfehlung, keine harte Grenze. Wäre sie
    // bindend, bräche „Kundenstamm" mitten im Wort um, nur weil ein fremdes
    // Werkzeug die Box zu schmal geschrieben hat.
    const node = renderText(visuals, text, {
      box: shape,
      width: Math.max(shape.width, 90),
      align: "center",
      verticalAlign: "middle",
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      fill: this.palette.text,
      className: "djs-label bpmn-external-label",
    });
    if (node) {
      return node;
    }
    const placeholder = svgCreate("g", {
      class: "bpmn-external-label bpmn-empty-label",
    });
    svgAppend(visuals, placeholder);
    return placeholder;
  }

  /**
   * Rückfall für erkannte, aber nicht eigens gezeichnete Typen: sichtbares
   * Rechteck mit Typnamen statt stiller Leere. Ein unsichtbares Element wäre der
   * gefährlichere Fehler — der Nutzer sähe ein unvollständiges Diagramm, ohne es
   * zu merken.
   */
  private drawFallback(visuals: SVGElement, shape: BpmnShape): SVGElement {
    const outline = svgCreate("rect", {
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
      class: "bpmn-outline bpmn-unsupported",
      fill: this.palette.fill,
      stroke: this.palette.groupStroke,
      "stroke-width": STROKE_THIN,
      "stroke-dasharray": DASH_EVENT,
      "data-border": "dashed",
      "data-unsupported": "true",
    });
    svgAppend(visuals, outline);
    renderText(visuals, getLabelText(shape) || getTypeLabel(shape.type), {
      box: shape,
      width: Math.max(1, shape.width - 2 * LABEL_PADDING),
      align: "center",
      verticalAlign: "middle",
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      fill: this.palette.text,
    });
    return outline;
  }

  private registryFor(node: SVGElement): MarkerRegistry | null {
    const svg = ownerSvg(node);
    if (!svg) {
      return null;
    }
    const existing = this.registries.get(svg);
    if (existing) {
      return existing;
    }
    const registry = new MarkerRegistry(svg, {
      stroke: this.palette.stroke,
      fill: this.palette.fill,
    });
    this.registries.set(svg, registry);
    return registry;
  }
}

const GATEWAY_SYMBOL_BY_TYPE: Readonly<
  Record<string, { readonly name: string; readonly def: SymbolDef } | undefined>
> = {
  "bpmn:ExclusiveGateway": {
    name: "exclusive",
    def: GATEWAY_SYMBOLS.exclusive,
  },
  "bpmn:ParallelGateway": { name: "parallel", def: GATEWAY_SYMBOLS.parallel },
  "bpmn:InclusiveGateway": {
    name: "inclusive",
    def: GATEWAY_SYMBOLS.inclusive,
  },
  "bpmn:EventBasedGateway": {
    name: "eventBased",
    def: GATEWAY_SYMBOLS.eventBased,
  },
  "bpmn:ComplexGateway": { name: "complex", def: GATEWAY_SYMBOLS.complex },
};

/**
 * [ARCTOS-FULL-2026-08-31 · OP-046] `isMarkerVisible` der `BPMNShape`.
 *
 * Fehlt das Attribut, gilt die Voreinstellung „sichtbar" — so wie jedes
 * Werkzeug es liest. Nur ein ausdrückliches `false` (auch als Zeichenkette,
 * denn `moddle` liefert unbekannte Attribute unkonvertiert) lässt das Symbol
 * weg.
 */
function isMarkerVisible(shape: BpmnShape): boolean {
  const di = shape.di;
  const raw =
    di?.["isMarkerVisible"] ??
    (di?.["$attrs"] as Record<string, unknown> | undefined)?.[
      "isMarkerVisible"
    ];
  return !(raw === false || raw === "false");
}

/**
 * [ARCTOS-FULL-2026-08-31 · OP-046] Steht dieser Pool für mehrere Beteiligte?
 *
 * `participantMultiplicity` ohne `maximum` bedeutet laut Metamodell `maximum=1`
 * — ein Beteiligter, kein Marker. Der Marker hängt also am Wert, nicht am
 * blossen Vorhandensein des Elements.
 */
function hasParticipantMultiplicity(shape: BpmnShape): boolean {
  const multiplicity = shape.businessObject["participantMultiplicity"];
  if (multiplicity === null || typeof multiplicity !== "object") return false;
  const maximum = (multiplicity as { maximum?: unknown }).maximum;
  if (maximum === undefined) return false;
  const value = Number(maximum);
  return Number.isFinite(value) && value > 1;
}

/** Hängt an diesem Nachrichtenfluss eine Nachricht? */
function hasMessageRef(connection: BpmnConnection): boolean {
  const ref = connection.businessObject["messageRef"];
  return ref !== undefined && ref !== null;
}

/**
 * Wird die Nachricht hier **gesendet**?
 *
 * BPMN zeichnet das Symbol gefüllt, wenn der Fluss von seinem Initiator
 * ausgeht. Als Näherung gilt: geht die Kante von einem sendenden Element aus
 * (`bpmn:SendTask`, ein werfendes Ereignis), ist sie initiierend. Ohne
 * Quellinformation bleibt sie ungefüllt — das ist die zurückhaltendere der
 * beiden Aussagen.
 */
function isInitiatingMessage(connection: BpmnConnection): boolean {
  const sourceType = connection.source?.type;
  if (sourceType === undefined) return false;
  return sourceType === "bpmn:SendTask" || isThrowing(sourceType);
}

/** Der Punkt auf halber Länge des Polygonzugs — nicht die Mitte der Bounding-Box. */
export function midpointOf(waypoints: readonly Point[]): Point | undefined {
  if (waypoints.length < 2) return undefined;
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < waypoints.length; i += 1) {
    const a = waypoints[i - 1] as Point;
    const b = waypoints[i] as Point;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    lengths.push(length);
    total += length;
  }
  if (total === 0) return waypoints[0];
  let remaining = total / 2;
  for (let i = 0; i < lengths.length; i += 1) {
    const length = lengths[i] as number;
    if (remaining <= length) {
      const a = waypoints[i] as Point;
      const b = waypoints[i + 1] as Point;
      const ratio = length === 0 ? 0 : remaining / length;
      return { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
    }
    remaining -= length;
  }
  return waypoints[waypoints.length - 1];
}

/**
 * Eine Farbangabe, die in ein SVG-Attribut darf.
 *
 * Bewusst eng: `#rgb` und `#rrggbb`, sonst nichts. Siehe {@link
 * BpmnRenderer.applyDiColors} — der Wert stammt aus einer hochgeladenen Datei.
 */
export function hexColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)
    ? trimmed
    : undefined;
}

function isCollection(shape: BpmnShape): boolean {
  const bo = shape.businessObject;
  if (bo["isCollection"] === true) {
    return true;
  }
  const ref = bo["dataObjectRef"];
  if (ref !== null && typeof ref === "object" && "isCollection" in ref) {
    return (ref as { isCollection?: unknown }).isCollection === true;
  }
  return false;
}

function diamondPath(
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  return polygonPath([
    [x + halfWidth, y],
    [x + width, y + halfHeight],
    [x + halfWidth, y + height],
    [x, y + halfHeight],
  ]);
}

function fmt(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`nicht-endliche Koordinate: ${String(value)}`);
  }
  return String(Math.round(value * 1000) / 1000);
}

function assertFiniteBounds(shape: BpmnShape): void {
  for (const key of ["x", "y", "width", "height"] as const) {
    if (!Number.isFinite(shape[key])) {
      throw new Error(`Element ${shape.id}: ${key} ist nicht endlich`);
    }
  }
  if (shape.width <= 0 || shape.height <= 0) {
    throw new Error(
      `Element ${shape.id} hat eine Nullfläche (${shape.width}×${shape.height})`,
    );
  }
}
