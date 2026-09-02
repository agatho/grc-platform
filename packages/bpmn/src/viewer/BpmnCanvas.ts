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
import { editorModulesFor, type DiagramModule } from "../editor/modules.js";
import type { EditorChrome, EditorConfig } from "../editor/types.js";
import type { BpmnImporter } from "../modeling/importer.js";
import { GraphA11y } from "./a11y.js";
import { isEditable, type BpmnCanvasMode } from "./modules.js";
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
 * **Der Modus entscheidet allein über die Modulliste.** `read` und `review`
 * registrieren die Bearbeitungsmodule schlicht nicht; `edit` bekommt über
 * {@link editorModulesFor} die Modellierungsschicht (`src/modeling`) und die
 * Bedienschicht (`src/editor`) dazu. Es gibt weiterhin **ein** Bauteil und
 * **eine** Wahrheit über den Modus — kein zweites Bauteil für den Editor.
 *
 * Der Import unterscheidet sich mit dem Modus, und zwar aus einem inhaltlichen
 * Grund: Zum *Zeichnen* genügt die flache Szene aus `src/draw/scene.ts`; zum
 * *Bearbeiten* braucht es den geschachtelten Baum mit `parent`/`children`,
 * `host`/`attachers` und `labelTarget`, den `src/modeling/importer.ts` baut —
 * jede Operation fragt „in welchem Container liegt das?". Die Szene entsteht
 * im Editor-Modus zusätzlich, aber nur als **Projektion** für Textalternative,
 * Graphnavigation und SVG-Export; sie wird nach jeder Änderung neu gerechnet
 * statt fortgeschrieben, damit es keine zweite Wahrheit über den Modellstand
 * gibt.
 */

/** Vertrag zur Modellschicht (`src/model/index.ts`, anderer Arbeitsstrang). */
export interface ImportXmlResult {
  readonly definitions: ModdleElement;
  readonly warnings: readonly unknown[];
}

export type ImportXmlFn = (xml: string) => Promise<ImportXmlResult>;

/**
 * Serialisierung. Fehlt sie, benutzt der Editor-Modus `exportXml` aus
 * `src/model/io.js` — symmetrisch zu {@link ImportXmlFn} übergebbar, damit
 * eine Anwendung mit **einer** moddle-Registry lesen und schreiben kann.
 */
export type ExportXmlFn = (definitions: ModdleElement) => Promise<string>;

export interface BpmnCanvasOptions {
  readonly container: HTMLElement;
  readonly mode?: BpmnCanvasMode;
  /**
   * Modellschicht. Fehlt sie, wird `../model/index.js` erst beim ersten Import
   * nachgeladen — absichtlich indirekt, damit dieses Paket auch dann übersetzt
   * und getestet werden kann, wenn die Modellschicht noch nicht steht.
   */
  readonly importXml?: ImportXmlFn;
  /** Serialisierung; nur im Modus `edit` benutzt. */
  readonly exportXml?: ExportXmlFn;
  readonly renderer?: BpmnRendererConfig;
  /** Barrierefreiheitsschicht aktivieren (Vorgabe: an). */
  readonly a11y?: boolean;
  /**
   * Zweite Achse aus Plan §2.4: zeigt die Fläche ihre Bedienelemente auch
   * dann, wenn nicht bearbeitet werden darf? `full` zeigt die Palette
   * deaktiviert samt Begründung (richtig, wo `read` aus einem fehlenden Recht
   * folgt), `minimal` lässt sie weg. Vorgabe `minimal` — eine lesende Fläche
   * bekommt ohne ausdrückliche Ansage keine graue Werkzeugleiste.
   */
  readonly chrome?: EditorChrome;
  /** Konfiguration der Bedienschicht (`config.editor`). */
  readonly editor?: EditorConfig;
}

export interface ImportDiagramResult {
  readonly scene: Scene;
  readonly warnings: readonly string[];
  readonly elementCount: number;
}

type ElementListener = (event: { element?: { id?: string } }) => void;

interface CommandStackLike {
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
}

export class BpmnCanvas {
  readonly mode: BpmnCanvasMode;

  private readonly diagram: Diagram;
  private readonly canvas: Canvas;
  private readonly elementRegistry: ElementRegistry;
  private readonly eventBus: EventBus;
  private readonly container: HTMLElement;
  private readonly importXmlFn: ImportXmlFn | undefined;
  private readonly exportXmlFn: ExportXmlFn | undefined;
  private readonly useA11y: boolean;

  private scene: Scene | null = null;
  private order: GraphOrder | null = null;
  private a11y: GraphA11y | null = null;
  private destroyed = false;

  /** Der moddle-Baum der geladenen Datei — nur im Modus `edit` geführt. */
  private definitions: ModdleElement | null = null;
  /** Der Eingabetext, Grundlage von Zusicherung Z-D. */
  private sourceXml: string | null = null;
  /** Ist seit dem Import ein Kommando gelaufen? Beendet Z-D. */
  private modified = false;
  /** Die Szene ist eine Projektion; nach jeder Änderung neu zu rechnen. */
  private sceneStale = false;

  constructor(options: BpmnCanvasOptions) {
    this.mode = options.mode ?? "read";
    this.container = options.container;
    this.importXmlFn = options.importXml;
    this.exportXmlFn = options.exportXml;
    this.useA11y = options.a11y !== false;

    const modules: DiagramModule[] = [
      ...editorModulesFor({
        mode: this.mode,
        chrome: options.chrome ?? "minimal",
      }),
    ];
    if (options.editor) {
      // Der Dienstname ist wörtlich `config.editor`: `didi` löst einen Namen
      // mit Punkt nur dann über das Optionsobjekt auf, wenn es keinen Anbieter
      // dieses Namens gibt.
      modules.push({
        "config.editor": ["value", options.editor],
      } as unknown as DiagramModule);
    }

    this.diagram = new Diagram({
      canvas: { container: options.container },
      modules: modules as never,
      bpmnRenderer: options.renderer ?? {},
    });
    this.canvas = this.diagram.get<Canvas>("canvas");
    this.elementRegistry = this.diagram.get<ElementRegistry>("elementRegistry");
    this.eventBus = this.diagram.get<EventBus>("eventBus");

    if (isEditable(this.mode)) {
      // Ein einziger Zuhörer entscheidet über Z-D. Er hängt am Kommandostapel
      // und nicht an einer Absichtserklärung des Aufrufers: „bearbeitet" heißt
      // „ein Kommando ist gelaufen", sonst nichts.
      this.eventBus.on("commandStack.changed", () => {
        this.modified = true;
        this.sceneStale = true;
      });
    }
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
    const imported = this.importDefinitions(
      result.definitions,
      result.warnings.map(String),
    );
    // Der Eingabetext ist die Grundlage von Z-D. Er wird **nach** dem Import
    // gemerkt, weil dieser die Fläche zuvor leert.
    this.sourceXml = xml;
    return imported;
  }

  /** Zeichnet einen bereits geladenen moddle-Baum. */
  importDefinitions(
    definitions: ModdleElement,
    externalWarnings: readonly string[] = [],
  ): ImportDiagramResult {
    if (!isEditable(this.mode)) {
      const scene = buildScene(definitions);
      this.renderScene(scene);
      this.definitions = definitions;
      return {
        scene,
        warnings: [...externalWarnings, ...scene.warnings],
        elementCount: scene.shapes.length + scene.connections.length,
      };
    }

    this.clear();
    const importer = this.diagram.get<BpmnImporter>("bpmnImporter");
    const result = importer.import(definitions as never, {
      repairMissingDi: true,
    });
    const scene = buildScene(definitions);
    this.definitions = definitions;
    this.scene = scene;
    this.order = buildGraphOrder(scene);
    this.fitViewport();
    this.installA11y(scene);
    // Der Import selbst ist kein Bedienschritt: er läuft an der Kommandokette
    // vorbei, und Z-D muss danach noch gelten.
    this.modified = false;
    this.sceneStale = false;
    return {
      scene,
      warnings: [...externalWarnings, ...result.warnings, ...scene.warnings],
      elementCount: this.elementRegistry
        .getAll()
        .filter((element) => (element as { id?: string }).id !== undefined)
        .length,
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
    this.installA11y(scene);
  }

  private installA11y(scene: Scene): void {
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

  /**
   * Die Szene, im Editor-Modus bei Bedarf neu gerechnet.
   *
   * Nach einer Bearbeitung ist die alte Projektion falsch. Sie hier
   * nachzuziehen statt sie fortzuschreiben ist die billigere und die ehrlichere
   * Lösung: die Wahrheit steht im moddle-Baum, und `buildScene` liest sie.
   */
  private currentScene(): Scene | null {
    if (this.sceneStale && this.definitions) {
      this.scene = buildScene(this.definitions);
      this.order = buildGraphOrder(this.scene);
      this.sceneStale = false;
    }
    return this.scene;
  }

  /** Textalternative zum Bild (Tabelle + Fließtext). */
  getTextAlternative(): TextAlternativeModel {
    const scene = this.currentScene();
    if (!scene) {
      return { rows: [], prose: "Es ist kein Diagramm geladen.", warnings: [] };
    }
    return buildTextAlternative(scene, this.order ?? undefined);
  }

  /**
   * SVG-Export.
   *
   * Bewusst über den statischen Renderer statt über eine Serialisierung des
   * Canvas-DOM: so enthält die Datei die ARIA-Namen und keinen Canvas-Zustand
   * (Zoom, Selektionsmarker, Outline-Reste).
   */
  exportSvg(title?: string): string {
    const scene = this.currentScene();
    if (!scene) {
      throw new Error("Es ist kein Diagramm geladen.");
    }
    const alternative = buildTextAlternative(scene, this.order ?? undefined);
    return toSvgString(
      renderScene(scene, {
        title: title ?? "BPMN-Diagramm",
        description: alternative.prose,
      }),
    );
  }

  /**
   * BPMN-XML-Export.
   *
   * **Zusicherung Z-D bleibt in Kraft, solange nichts bearbeitet wurde:** Ist
   * seit dem Import kein Kommando gelaufen, kommt der Eingabetext byteweise
   * unverändert zurück. Das ist die stärkste Form von „bit-treu", die es gibt,
   * und sie gilt für jede lesende Fläche ohne Zutun.
   *
   * Sobald ein Kommando gelaufen ist, gilt sie nicht mehr — dann *muss* die
   * Ausgabe aus dem Modell kommen, sonst ginge die Bearbeitung verloren. Die
   * Umschaltung hängt am Kommandostapel, nicht an einer Vermutung.
   */
  async exportXml(): Promise<string> {
    if (!this.definitions) {
      throw new Error("Es ist kein Diagramm geladen.");
    }
    if (!this.modified && this.sourceXml !== null) return this.sourceXml;
    const exporter = this.exportXmlFn ?? (await loadModelExport());
    return exporter(this.definitions);
  }

  /** Wurde seit dem Import ein Kommando ausgeführt? (Z-D gilt nicht mehr.) */
  get dirty(): boolean {
    return this.modified;
  }

  /** Der geladene moddle-Baum, oder `null`. */
  getDefinitions(): ModdleElement | null {
    return this.definitions;
  }

  // -------------------------------------------------------------------------
  // Kommandostapel — im Lesemodus gibt es ihn nicht, und dann sagen diese
  // Methoden das, statt Handlungsfähigkeit vorzutäuschen.
  // -------------------------------------------------------------------------

  private commandStack(): CommandStackLike | null {
    if (!isEditable(this.mode)) return null;
    try {
      return this.diagram.get<CommandStackLike>("commandStack");
    } catch {
      return null;
    }
  }

  undo(): void {
    const stack = this.commandStack();
    if (stack?.canUndo()) stack.undo();
  }

  redo(): void {
    const stack = this.commandStack();
    if (stack?.canRedo()) stack.redo();
  }

  canUndo(): boolean {
    return this.commandStack()?.canUndo() ?? false;
  }

  canRedo(): boolean {
    return this.commandStack()?.canRedo() ?? false;
  }

  getScene(): Scene | null {
    return this.currentScene();
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
    this.definitions = null;
    this.sourceXml = null;
    this.modified = false;
    this.sceneStale = false;
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

/** Dieselbe Indirektion für den Rückweg — siehe {@link loadModelLayer}. */
async function loadModelExport(): Promise<ExportXmlFn> {
  const specifier = "../model/index.js";
  try {
    const loaded: unknown = await import(/* @vite-ignore */ specifier);
    const exportXml = (loaded as { exportXml?: unknown }).exportXml;
    if (typeof exportXml === "function") {
      const serialise = exportXml as (
        definitions: ModdleElement,
        options?: { format?: boolean },
      ) => Promise<string>;
      return (definitions) => serialise(definitions, { format: true });
    }
    throw new Error("`exportXml` fehlt");
  } catch (error) {
    throw new Error(
      `Die Modellschicht (src/model) ist nicht verfügbar: ${String(
        error,
      )}. Übergib stattdessen exportXml in den Optionen.`,
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
