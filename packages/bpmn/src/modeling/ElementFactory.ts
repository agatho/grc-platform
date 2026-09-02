/**
 * Grafische Elementfabrik — die Brücke von `diagram-js` zu `bpmn-moddle`.
 *
 * `diagram-js` erzeugt Shapes und Connections mit `object-refs`-gebundenen
 * Beziehungen (`parent`/`children`, `host`/`attachers`, `source`/`outgoing`,
 * `target`/`incoming`, `labelTarget`/`labels`). Diese Bindungen sind
 * beidseitig und werden von `diagram-js` gepflegt — Baum 3 hält sich also
 * selbst zusammen. Was hier dazukommt, ist der Anschluss an Baum 1: jedes
 * grafische Element bekommt sein `businessObject`, und zwar **vor** dem ersten
 * Kommando, damit `BpmnUpdater` nie ein Element ohne semantisches Gegenstück
 * sieht.
 *
 * Die DI (Baum 2) entsteht bewusst **nicht** hier, sondern im `BpmnUpdater`:
 * Bounds und Wegpunkte stehen erst fest, wenn das Kommando ausgeführt ist, und
 * eine DI, die zwischenzeitlich falsche Koordinaten trägt, wäre bei einem
 * abgebrochenen Kommando ein verwaister Eintrag.
 *
 * Umgesetzt als **Komposition statt Vererbung**: `diagram-js` liefert die
 * Elementfabrik als Prototyp-Funktion, deren Signaturen sich unter
 * `strict`+`noUncheckedIndexedAccess` nicht sauber überschreiben lassen. Die
 * Fabrik hier benutzt darum direkt `model/create` — dieselbe Funktion, die die
 * Basisfabrik auch benutzt — und erfüllt die Schnittstelle, die `Modeling`
 * erwartet (`createShape`, `createConnection`, `createLabel`, `createRoot`).
 */

import { create as createDiagramElement } from "diagram-js/lib/model/index.js";
import { BpmnFactory, DEFAULT_LABEL_SIZE, defaultSize } from "./BpmnFactory.js";
import type {
  BpmnConnection,
  BpmnElement,
  BpmnRoot,
  BpmnShape,
  ModdleElement,
} from "./types.js";
import { is, isConnectionType, isModdleElement } from "./util.js";

export type ElementKind = "root" | "shape" | "connection" | "label";

export interface BpmnElementAttrs {
  id?: string | undefined;
  /** BPMN-Typ, falls kein `businessObject` mitgegeben wird. */
  type?: string | undefined;
  businessObject?: ModdleElement | undefined;
  di?: ModdleElement | undefined;
  x?: number | undefined;
  y?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
  isFrame?: boolean | undefined;
  collapsed?: boolean | undefined;
  labelTarget?: BpmnElement | undefined;
  host?: BpmnShape | undefined;
  waypoints?: Array<{ x: number; y: number }> | undefined;
  /** `bpmn:TimerEventDefinition`, … — wird beim Erzeugen mit angelegt. */
  eventDefinitionType?: string | undefined;
  /** Attribute der Ereignisdefinition, falls sie welche braucht. */
  eventDefinitionAttrs?: Record<string, unknown> | undefined;
  [key: string]: unknown;
}

export class BpmnElementFactory {
  static $inject = ["bpmnFactory"];

  private uid = 12;

  constructor(private readonly bpmnFactory: BpmnFactory) {}

  createRoot(attrs: BpmnElementAttrs = {}): BpmnRoot {
    return this.create("root", attrs) as BpmnRoot;
  }

  createShape(attrs: BpmnElementAttrs = {}): BpmnShape {
    return this.create("shape", attrs) as BpmnShape;
  }

  createConnection(attrs: BpmnElementAttrs = {}): BpmnConnection {
    return this.create("connection", attrs) as BpmnConnection;
  }

  createLabel(attrs: BpmnElementAttrs = {}): BpmnShape {
    return this.create("label", attrs) as BpmnShape;
  }

  /**
   * Erzeugt ein grafisches Element und, falls nötig, sein semantisches
   * Gegenstück.
   *
   * `attrs.type` trägt den BPMN-Typ (`bpmn:UserTask`), `attrs.businessObject`
   * ein bereits vorhandenes semantisches Objekt — beim Import ist immer das
   * Zweite der Fall, beim Erzeugen über die Palette das Erste.
   */
  create(kind: ElementKind, attrs: BpmnElementAttrs = {}): BpmnElement {
    const next: BpmnElementAttrs = { ...attrs };

    if (kind === "label") {
      next.width ??= DEFAULT_LABEL_SIZE.width;
      next.height ??= DEFAULT_LABEL_SIZE.height;
      next.x ??= 0;
      next.y ??= 0;
      const target = next.labelTarget;
      if (!next.businessObject && target) {
        next.businessObject = target.businessObject;
      }
      if (next.id === undefined && target) next.id = `${target.id}_label`;
      next.type = "label";
      return this.instantiate(kind, next);
    }

    let bo = next.businessObject;
    const type = next.type ?? bo?.$type;

    if (!isModdleElement(bo)) {
      if (type === undefined || type === "") {
        throw new Error(
          "Zum Erzeugen eines Elements braucht die Fabrik entweder ein businessObject oder einen BPMN-Typ.",
        );
      }
      bo = this.bpmnFactory.create(
        type,
        this.semanticAttrsFrom(next),
        next.id !== undefined ? { id: next.id } : {},
      );
      this.applyEventDefinition(bo, next);
      next.businessObject = bo;
    }
    delete next["eventDefinitionType"];

    next.type = type ?? bo.$type;
    if (next.id === undefined && typeof bo.id === "string") next.id = bo.id;

    if (kind === "shape") {
      const size = defaultSize(next.type);
      next.width ??= size.width;
      next.height ??= size.height;
      next.x ??= 0;
      next.y ??= 0;
      if (
        is(bo, "bpmn:Participant") ||
        is(bo, "bpmn:Lane") ||
        is(bo, "bpmn:Group")
      ) {
        next.isFrame ??= true;
      }
    }

    // **Kein** Vorgabewert für `waypoints`: `CreateConnectionHandler` von
    // `diagram-js` ruft den Layouter nur, wenn `connection.waypoints` falsy
    // ist. Ein leeres Array ist truthy — die Kante bliebe ohne Wegpunkte und
    // damit ohne zeichenbare Geometrie.

    return this.instantiate(kind, next);
  }

  /**
   * Attribute, die aus den Grafik-Attributen ins semantische Objekt gehören.
   * Alles Geometrische bleibt draußen — Koordinaten stehen in der DI, nicht im
   * semantischen Modell. Genau diese Trennung ist der Grund, warum es zwei
   * Bäume gibt.
   */
  private semanticAttrsFrom(attrs: BpmnElementAttrs): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (typeof attrs["name"] === "string") out["name"] = attrs["name"];
    return out;
  }

  /**
   * Ereignisdefinition beim Erzeugen mitgeben — `bpmn:TimerEventDefinition`,
   * `bpmn:ErrorEventDefinition`, …
   *
   * Warum das in die Fabrik gehört und nicht in ein nachgelagertes
   * `updateProperties`: Ein Ereignis **ist** durch seine Definition definiert.
   * Wer es zweistufig baut, erzeugt zwei Einträge auf dem Kommandostapel — und
   * dann stellt ein Undo pro Bedienschritt das Dokument nicht mehr her, weil
   * ein Bedienschritt zwei Undos braucht. Der Verifikationsstrang hat genau
   * das gemessen (Bericht §3.5 und §3.6): nicht die Umkehrfunktion war falsch,
   * sondern die Zahl der Kommandos. `bpmn-js` erzeugt Ereignis und Definition
   * in einem Schritt; für die Vergleichbarkeit und für ein vorhersagbares
   * Ctrl-Z muss diese Schicht das auch tun.
   */
  private applyEventDefinition(
    bo: ModdleElement,
    attrs: BpmnElementAttrs,
  ): void {
    const type = attrs["eventDefinitionType"];
    if (typeof type !== "string" || type === "") return;
    const values = attrs["eventDefinitionAttrs"];
    const definition = this.bpmnFactory.create(
      type,
      typeof values === "object" && values !== null
        ? (values as Record<string, unknown>)
        : {},
      { parent: bo },
    );
    bo["eventDefinitions"] = [definition];
  }

  private instantiate(kind: string, attrs: BpmnElementAttrs): BpmnElement {
    const finalAttrs = { ...attrs };
    if (finalAttrs.id === undefined) {
      finalAttrs.id = `${kind}_${String(this.uid++)}`;
    }
    const factory = createDiagramElement as unknown as (
      type: string,
      attrs: unknown,
    ) => BpmnElement;
    return factory(kind, finalAttrs);
  }

  createShapeFor(bo: ModdleElement, attrs: BpmnElementAttrs = {}): BpmnShape {
    return this.createShape({ ...attrs, businessObject: bo });
  }

  createConnectionFor(
    bo: ModdleElement,
    attrs: BpmnElementAttrs = {},
  ): BpmnConnection {
    return this.createConnection({ ...attrs, businessObject: bo });
  }

  createRootFor(bo: ModdleElement, attrs: BpmnElementAttrs = {}): BpmnRoot {
    return this.createRoot({ ...attrs, businessObject: bo });
  }

  /** `bpmn:SequenceFlow` & Co. werden als Verbindung, alles andere als Form erzeugt. */
  createFor(bo: ModdleElement, attrs: BpmnElementAttrs = {}): BpmnElement {
    return isConnectionType(bo.$type)
      ? this.createConnectionFor(bo, attrs)
      : this.createShapeFor(bo, attrs);
  }
}

export default BpmnElementFactory;
