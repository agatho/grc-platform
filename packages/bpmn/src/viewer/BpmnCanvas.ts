/// <reference lib="dom" />

import Diagram from "diagram-js";
import type Canvas from "diagram-js/lib/core/Canvas.js";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry.js";
import type EventBus from "diagram-js/lib/core/EventBus.js";
import type { ConnectionLike, ShapeLike } from "diagram-js/lib/core/Types.js";

import { buildScene, type Scene } from "../draw/scene.js";
import { renderScene, toSvgString } from "../draw/StaticRenderer.js";
import type {
  BpmnConnection,
  BpmnRendererConfig,
  BpmnShape,
  ModdleElement,
} from "../draw/types.js";
import { GraphA11y } from "./a11y.js";
import {
  isEditable,
  MISSING_EDIT_MODULES,
  modulesFor,
  type BpmnCanvasMode,
} from "./modules.js";
import { buildGraphOrder, type GraphOrder } from "./order.js";
import {
  buildTextAlternative,
  type TextAlternativeModel,
} from "./TextAlternative.js";

/**
 * Ein Bauteil, drei Modi (Plan §2.4).
 *
 * `read` ist **keine** zweite Implementierung, sondern derselbe Aufbau ohne die
 * Bearbeitungsmodule — der Modus bestimmt allein die Modulliste beim
 * `didi`-Bootstrap. Damit sieht ein Diagramm im Mitarbeiterportal pixelgleich so
 * aus wie im Editor; es gibt keine zweite Formensprache mehr.
 *
 * Für den Spike ist nur der Lesepfad ausgeführt; `edit` bootet zwar die
 * generischen `diagram-js`-Bearbeitungsmodule, verweigert aber ohne
 * ausdrückliche Freigabe den Dienst, weil die BPMN-spezifischen Ergänzungen
 * (AP6: Rules, Factory, Updater, Layouter) fehlen.
 */

/** Vertrag zur Modellschicht (`src/model/index.ts`, anderer Arbeitsstrang). */
export interface ImportXmlResult {
  readonly definitions: ModdleElement;
  readonly warnings: readonly unknown[];
}

export type ImportXmlFn = (xml: string) => Promise<ImportXmlResult>;

export interface BpmnCanvasOptions {
  readonly container: HTMLElement;
  readonly mode?: BpmnCanvasMode;
  /**
   * Modellschicht. Fehlt sie, wird `../model/index.js` erst beim ersten Import
   * nachgeladen — absichtlich indirekt, damit dieses Paket auch dann übersetzt
   * und getestet werden kann, wenn die Modellschicht noch nicht steht.
   */
  readonly importXml?: ImportXmlFn;
  readonly renderer?: BpmnRendererConfig;
  /** Barrierefreiheitsschicht aktivieren (Vorgabe: an). */
  readonly a11y?: boolean;
  /** Erlaubt den unvollständigen Editor-Pfad (nur für Erprobung). */
  readonly allowIncompleteEditMode?: boolean;
}

export interface ImportDiagramResult {
  readonly scene: Scene;
  readonly warnings: readonly string[];
  readonly elementCount: number;
}

type ElementListener = (event: { element?: { id?: string } }) => void;

export class BpmnCanvas {
  readonly mode: BpmnCanvasMode;

  private readonly diagram: Diagram;
  private readonly canvas: Canvas;
  private readonly elementRegistry: ElementRegistry;
  private readonly eventBus: EventBus;
  private readonly container: HTMLElement;
  private readonly importXmlFn: ImportXmlFn | undefined;
  private readonly useA11y: boolean;

  private scene: Scene | null = null;
  private order: GraphOrder | null = null;
  private a11y: GraphA11y | null = null;
  private destroyed = false;

  constructor(options: BpmnCanvasOptions) {
    this.mode = options.mode ?? "read";
    if (this.mode === "edit" && options.allowIncompleteEditMode !== true) {
      throw new Error(
        `Der Editor-Modus ist in diesem Spike nicht ausgeführt. Es fehlen: ${MISSING_EDIT_MODULES.join(
          "; ",
        )}. Mit allowIncompleteEditMode:true lässt sich der Rumpf trotzdem starten.`,
      );
    }

    this.container = options.container;
    this.importXmlFn = options.importXml;
    this.useA11y = options.a11y !== false;

    this.diagram = new Diagram({
      canvas: { container: options.container },
      modules: modulesFor(this.mode),
      bpmnRenderer: options.renderer ?? {},
    });
    this.canvas = this.diagram.get<Canvas>("canvas");
    this.elementRegistry = this.diagram.get<ElementRegistry>("elementRegistry");
    this.eventBus = this.diagram.get<EventBus>("eventBus");
  }

  /** Zugriff auf einen `diagram-js`-Dienst (dieselben fünf wie heute). */
  get<T>(name: string): T {
    return this.diagram.get<T>(name);
  }

  on(event: string, listener: ElementListener): void {
    this.eventBus.on(event, listener as never);
  }

  off(event: string, listener: ElementListener): void {
    this.eventBus.off(event, listener as never);
  }

  /** Importiert BPMN-XML und zeichnet es. */
  async importXml(xml: string): Promise<ImportDiagramResult> {
    const importer = this.importXmlFn ?? (await loadModelLayer());
    const result = await importer(xml);
    return this.importDefinitions(
      result.definitions,
      result.warnings.map(String),
    );
  }

  /** Zeichnet einen bereits geladenen moddle-Baum. */
  importDefinitions(
    definitions: ModdleElement,
    externalWarnings: readonly string[] = [],
  ): ImportDiagramResult {
    const scene = buildScene(definitions);
    this.renderScene(scene);
    return {
      scene,
      warnings: [...externalWarnings, ...scene.warnings],
      elementCount: scene.shapes.length + scene.connections.length,
    };
  }

  private renderScene(scene: Scene): void {
    this.clear();
    this.scene = scene;
    this.order = buildGraphOrder(scene);

    const root = this.canvas.setRootElement({
      id: "__implicit_root",
      isImplicit: true,
    });

    for (const shape of scene.shapes) {
      this.canvas.addShape(toMutableShape(shape), root);
    }
    for (const connection of scene.connections) {
      this.canvas.addConnection(toMutableConnection(connection), root);
    }
    for (const label of scene.labels) {
      this.canvas.addShape(toMutableShape(label), root);
    }

    this.fitViewport();

    if (this.useA11y) {
      this.a11y?.destroy();
      this.a11y = new GraphA11y(
        {
          container: this.container,
          getGraphics: (id) => {
            try {
              return this.elementRegistry.getGraphics(id) ?? null;
            } catch {
              return null;
            }
          },
          select: (id) => {
            this.select(id);
          },
          reveal: (id) => {
            const element = this.elementRegistry.get(id);
            if (element) {
              this.canvas.scrollToElement(element, 50);
            }
          },
          zoom: (step) => {
            if (step === "fit") {
              this.fitViewport();
              return;
            }
            const current = this.canvas.zoom();
            this.canvas.zoom(step === "in" ? current * 1.2 : current / 1.2);
          },
          pan: (dx, dy) => {
            this.canvas.scroll({ dx, dy });
          },
          activate: (id) => {
            this.eventBus.fire("element.activate", {
              element: this.elementRegistry.get(id),
            });
          },
        },
        scene,
      );
    }
  }

  /** Selektion setzen (Selektion ≠ Fokus). */
  select(elementId: string | null): void {
    const selection = this.diagram.get<{
      select: (element: unknown) => void;
    }>("selection");
    selection.select(
      elementId ? (this.elementRegistry.get(elementId) ?? null) : null,
    );
  }

  /** Fokussiert ein Element in der Tastaturordnung. */
  focusElement(elementId: string): void {
    this.a11y?.focusElement(elementId);
  }

  zoom(scale?: number | "fit-viewport"): number {
    return scale === undefined ? this.canvas.zoom() : this.canvas.zoom(scale);
  }

  /**
   * Auf den Viewport einpassen.
   *
   * Mit Sicherung: liefert die Rechnung keine brauchbare Zoomstufe — etwa weil
   * der Container (noch) keine Größe hat —, wird auf 1 zurückgefallen. Eine
   * NaN-Zoomstufe würde die Fläche stumm leeren, und genau solche stummen
   * Ausfälle sollen hier nicht möglich sein.
   */
  fitViewport(): void {
    let scale = Number.NaN;
    try {
      scale = this.canvas.zoom("fit-viewport");
    } catch {
      scale = Number.NaN;
    }
    if (!Number.isFinite(scale) || scale <= 0) {
      this.canvas.zoom(1);
    }
  }

  scroll(delta: { dx: number; dy: number }): void {
    this.canvas.scroll(delta);
  }

  /** Textalternative zum Bild (Tabelle + Fließtext). */
  getTextAlternative(): TextAlternativeModel {
    if (!this.scene) {
      return { rows: [], prose: "Es ist kein Diagramm geladen.", warnings: [] };
    }
    return buildTextAlternative(this.scene, this.order ?? undefined);
  }

  /**
   * SVG-Export.
   *
   * Bewusst über den statischen Renderer statt über eine Serialisierung des
   * Canvas-DOM: so enthält die Datei die ARIA-Namen und keinen Canvas-Zustand
   * (Zoom, Selektionsmarker, Outline-Reste).
   */
  exportSvg(title?: string): string {
    if (!this.scene) {
      throw new Error("Es ist kein Diagramm geladen.");
    }
    const alternative = buildTextAlternative(
      this.scene,
      this.order ?? undefined,
    );
    return toSvgString(
      renderScene(this.scene, {
        title: title ?? "BPMN-Diagramm",
        description: alternative.prose,
      }),
    );
  }

  getScene(): Scene | null {
    return this.scene;
  }

  get editable(): boolean {
    return isEditable(this.mode);
  }

  clear(): void {
    this.a11y?.destroy();
    this.a11y = null;
    this.diagram.clear();
    this.scene = null;
    this.order = null;
  }

  /** Räumt Diagramm, Ereignisse und die a11y-Schicht auf. */
  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.a11y?.destroy();
    this.a11y = null;
    this.diagram.destroy();
    this.container.replaceChildren();
    for (const attribute of [
      "role",
      "aria-roledescription",
      "aria-label",
      "tabindex",
    ]) {
      this.container.removeAttribute(attribute);
    }
  }
}

/**
 * Lädt die Modellschicht erst zur Laufzeit.
 *
 * Der Modulpfad steht bewusst in einer Variablen: so übersetzt dieses Paket auch
 * dann, wenn `src/model/index.ts` (anderer Arbeitsstrang) noch nicht existiert.
 * Fehlt sie zur Laufzeit, gibt es eine klare Meldung statt eines Auflösefehlers.
 */
async function loadModelLayer(): Promise<ImportXmlFn> {
  const specifier = "../model/index.js";
  try {
    const loaded: unknown = await import(/* @vite-ignore */ specifier);
    const importXml = (loaded as { importXml?: unknown }).importXml;
    if (typeof importXml === "function") {
      return importXml as ImportXmlFn;
    }
    throw new Error("`importXml` fehlt");
  } catch (error) {
    throw new Error(
      `Die Modellschicht (src/model) ist nicht verfügbar: ${String(
        error,
      )}. Übergib stattdessen importXml in den Optionen.`,
    );
  }
}

function toMutableShape(shape: BpmnShape): ShapeLike {
  return {
    id: shape.id,
    type: shape.type,
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
    businessObject: shape.businessObject,
    di: shape.di,
    labelTarget: shape.labelTarget,
    isFrame: shape.isFrame,
  };
}

function toMutableConnection(connection: BpmnConnection): ConnectionLike {
  return {
    id: connection.id,
    type: connection.type,
    waypoints: connection.waypoints.map((point) => ({
      x: point.x,
      y: point.y,
    })),
    businessObject: connection.businessObject,
    di: connection.di,
  };
}
