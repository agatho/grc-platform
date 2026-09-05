/// <reference lib="dom" />

import Diagram from "diagram-js";
import type Canvas from "diagram-js/lib/core/Canvas.js";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry.js";
import type EventBus from "diagram-js/lib/core/EventBus.js";
import type { ConnectionLike, ShapeLike } from "diagram-js/lib/core/Types.js";

import { buildScene, type Scene } from "../draw/scene";
import {
  planeIndexFor,
  planeLabel,
  planePath,
  planesOf,
  type PlaneInfo,
} from "../draw/planes";
import { renderScene, toSvgString } from "../draw/StaticRenderer";
import type {
  BpmnConnection,
  BpmnRendererConfig,
  BpmnShape,
  ModdleElement,
} from "../draw/types";
import { editorModulesFor, type DiagramModule } from "../editor/modules";
import type { EditorChrome, EditorConfig } from "../editor/types";
import type { BpmnImporter } from "../modeling/importer";
import { GraphA11y } from "./a11y";
import { isEditable, type BpmnCanvasMode } from "./modules";
import { buildGraphOrder, type GraphOrder } from "./order";
import {
  buildTextAlternative,
  type TextAlternativeModel,
} from "./TextAlternative";

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

/**
 * [ARCTOS-FULL-2026-08-31 · OP-018] Die Ebenennavigation, wie die Bedienschicht
 * sie sieht. Registriert als `didi`-Dienst `planeNavigation`.
 */
export interface PlaneNavigation {
  canDrillDown(elementId: string): boolean;
  canDrillUp(): boolean;
  drillDown(elementId: string): boolean;
  drillUp(): boolean;
  planeLabel(): string;
  planePath(): readonly PlaneInfo[];
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
  /**
   * [ARCTOS-FULL-2026-08-31 · OP-018] Welche `BPMNPlane` gerade gezeigt wird.
   *
   * Die Zahl war bis hierher nirgends geführt — `buildScene` bekam überall die
   * implizite `0`, und deshalb war jede weitere Ebene eines Dokuments
   * unerreichbar. Sie steht hier und nicht in der Bedienschicht, weil auch der
   * Lesemodus drillt und weil `currentScene()` sie kennen muss: eine Szene, die
   * nach einer Bearbeitung neu gerechnet wird, muss dieselbe Ebene rechnen wie
   * die, die auf dem Bildschirm steht.
   */
  private planeIndex = 0;

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

    // [ARCTOS-FULL-2026-08-31 · OP-018] Die Ebenennavigation als Dienst.
    //
    // Sie gehört dieser Klasse — hier steht `planeIndex`, hier liegt der
    // moddle-Baum. Damit das Kontextmenü (`src/editor`) sie trotzdem anbieten
    // kann, ohne `BpmnCanvas` zu kennen, wird sie als `didi`-Wert eingehängt.
    // Der Umweg über einen eigenen Dienst mit eigenem Zustand hätte eine
    // zweite Wahrheit über die aktuelle Ebene erzeugt.
    const navigation: PlaneNavigation = {
      canDrillDown: (id) => this.canDrillDown(id),
      canDrillUp: () => this.canDrillUp(),
      drillDown: (id) => this.drillDown(id),
      drillUp: () => this.drillUp(),
      planeLabel: () => this.currentPlaneLabel(),
      planePath: () => this.getPlanePath(),
    };
    modules.push({
      planeNavigation: ["value", navigation],
    } as unknown as DiagramModule);

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

    // [ARCTOS-FULL-2026-08-31 · OP-018] Der Mausweg zum Drill-Down, in **allen**
    // Modi: Doppelklick auf einen Subprozess mit eigener Ebene öffnet sie. Er
    // steht hier und nicht in `src/editor`, weil auch die lesende Fläche drillt
    // und dort keine Bedienschicht registriert ist. `canDrillDown` filtert —
    // ein Doppelklick auf irgendetwas anderes bleibt für die Anwendung übrig
    // (`apps/web` benutzt ihn für den Sprung zum aufgerufenen Prozess).
    this.eventBus.on("element.dblclick", (event: unknown) => {
      const id = (event as { element?: { id?: string } }).element?.id;
      if (id && this.canDrillDown(id)) this.drillDown(id);
    });
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
          // [ARCTOS-FULL-2026-08-31 · OP-018] Drill-Down gehört in **beide**
          // Bedienarten und in **alle** Modi. Die Bedienschicht (`src/editor`)
          // gibt es im Lesemodus nicht; die a11y-Schicht schon — deshalb sitzt
          // die Tastaturbelegung dort und nicht in `EditorKeyboard`.
          drillDown: (id) => this.drillDown(id),
          drillUp: () => this.drillUp(),
          canDrillDown: (id) => this.canDrillDown(id),
          planeLabel: () => this.currentPlaneLabel(),
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
      // [ARCTOS-FULL-2026-08-31 · OP-018] `this.planeIndex` statt der
      // impliziten 0: nach einer Bearbeitung auf Ebene 2 hätte die
      // Neuberechnung sonst Ebene 1 geliefert — Textalternative und
      // SVG-Export hätten ein anderes Bild beschrieben als das, das zu sehen
      // ist.
      this.scene = buildScene(this.definitions, this.planeIndex);
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

  // -------------------------------------------------------------------------
  // [ARCTOS-FULL-2026-08-31 · OP-018] Ebenen und Drill-Down
  //
  // Gemessen an `test/corpus/synth-nested-subprocesses.bpmn`: das Dokument hat
  // zwei `BPMNPlane`s (3 Formen + 2 Kanten auf Ebene 1, 4 Formen + 3 Kanten auf
  // Ebene 2). Vor dieser Arbeit war Ebene 2 mit keiner Bedienung erreichbar,
  // obwohl `buildScene` sie seit jeher zeichnen kann — es fehlte allein die
  // Navigation. `buildScene` warnte darüber sogar („Definitionen enthalten 2
  // Diagramme; gezeichnet wird Nr. 1"), ohne dass jemand etwas tun konnte.
  // -------------------------------------------------------------------------

  /** Alle Ebenen des geladenen Dokuments. Leer, solange nichts geladen ist. */
  getPlanes(): readonly PlaneInfo[] {
    return this.definitions ? planesOf(this.definitions) : [];
  }

  /** Welche Ebene gerade gezeigt wird. */
  getPlaneIndex(): number {
    return this.planeIndex;
  }

  /** Der Weg von der obersten Ebene bis zur aktuellen — die Brotkrume. */
  getPlanePath(): readonly PlaneInfo[] {
    return this.definitions ? planePath(this.definitions, this.planeIndex) : [];
  }

  /** Verbirgt sich hinter diesem Element eine eigene Ebene? */
  canDrillDown(elementId: string): boolean {
    if (!this.definitions) return false;
    const index = planeIndexFor(this.definitions, elementId);
    return index !== undefined && index !== this.planeIndex;
  }

  /** Gibt es eine übergeordnete Ebene? */
  canDrillUp(): boolean {
    return this.getPlanePath().length > 1;
  }

  /**
   * Zeigt eine andere Ebene desselben Dokuments.
   *
   * **Was dabei erhalten bleibt und was nicht.** Der moddle-Baum ist die
   * Wahrheit und wird nicht angefasst: jede Bearbeitung, die auf einer anderen
   * Ebene gemacht wurde, steht weiterhin darin und geht in den Export ein.
   * Erhalten bleibt auch Zusicherung Z-D — wurde nichts bearbeitet, liefert
   * `exportXml()` weiterhin den Eingabetext byteweise.
   *
   * **Nicht** erhalten bleibt im Bearbeitungsmodus die Rückgängig-Kette: der
   * Ebenenwechsel baut die Elementobjekte neu auf, und ein Kommandostapel, der
   * auf die alten Objekte zeigt, würde beim nächsten Strg+Z auf Leichen
   * arbeiten (dieselbe Überlegung wie in `UMSETZUNG-WELLE-1C.md` §6 zu
   * eingeklappten Subprozessen). Die saubere Lösung wäre, alle Ebenen
   * gleichzeitig als `root`-Elemente zu importieren; das liegt in
   * `src/modeling/importer.ts` und damit in fremder Dateihoheit — siehe
   * `docs/UMSETZUNG-WELLE-2B.md`, „Was an die folgenden Wellen weitergeht".
   * Der Wechsel sagt das an, statt es geschehen zu lassen.
   */
  showPlane(index: number): boolean {
    const definitions = this.definitions;
    if (!definitions) return false;
    if (index === this.planeIndex) return false;
    if (!planesOf(definitions).some((plane) => plane.index === index)) {
      return false;
    }

    // `clear()` und `renderScene()` setzen beide `definitions`, `sourceXml` und
    // `modified` zurück — sie sind für „ein anderes Dokument" gedacht, und das
    // hier ist dasselbe Dokument aus einem anderen Blickwinkel.
    const keptXml = this.sourceXml;
    const keptModified = this.modified;

    if (isEditable(this.mode)) {
      this.clear();
      const importer = this.diagram.get<BpmnImporter>("bpmnImporter");
      importer.import(definitions as never, {
        repairMissingDi: true,
        diagramIndex: index,
      });
      const scene = buildScene(definitions, index);
      this.scene = scene;
      this.order = buildGraphOrder(scene);
      this.fitViewport();
      this.installA11y(scene);
    } else {
      this.renderScene(buildScene(definitions, index));
    }

    this.definitions = definitions;
    this.sourceXml = keptXml;
    this.modified = keptModified;
    this.sceneStale = false;
    this.planeIndex = index;

    // Die Ansage steht hier und nicht in `GraphA11y`: der Ebenenwechsel setzt
    // die a11y-Schicht neu auf, und die Live-Region der alten Instanz ist
    // danach aus dem Dokument entfernt. Sie nennt Ziel **und** Umfang — nach
    // einem Wechsel ist der ganze Bildschirm ein anderer, und wer ihn nicht
    // sieht, braucht beides, um sich neu zu verorten.
    const scene = this.scene;
    this.a11y?.announce(
      `Ebene ${this.currentPlaneLabel()}. ${String(
        (scene?.shapes.length ?? 0) + (scene?.connections.length ?? 0),
      )} Elemente. Umschalt und O führt zurück.`,
    );

    this.eventBus.fire("plane.changed", {
      index,
      path: this.getPlanePath(),
    } as never);
    return true;
  }

  /** Öffnet die Ebene hinter `elementId`, falls es eine gibt. */
  drillDown(elementId: string): boolean {
    if (!this.definitions) return false;
    const index = planeIndexFor(this.definitions, elementId);
    if (index === undefined) return false;
    return this.showPlane(index);
  }

  /** Eine Ebene zurück. */
  drillUp(): boolean {
    const path = this.getPlanePath();
    const parent = path[path.length - 2];
    if (!parent) return false;
    return this.showPlane(parent.index);
  }

  /** Anzeigename der aktuellen Ebene — für Brotkrume und Ansage. */
  currentPlaneLabel(): string {
    const path = this.getPlanePath();
    const current = path[path.length - 1];
    return current ? planeLabel(current) : "Ebene";
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
    this.planeIndex = 0;
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
 * Lädt die Modellschicht erst beim ersten Gebrauch.
 *
 * [ARCTOS-FULL-2026-08-31 · OP-167] Hier stand der Modulpfad in einer
 * **Variablen** (`const specifier = "../model/index.js"`) samt
 * `/* @vite-ignore *\/`, mit der Begründung: „so übersetzt dieses Paket auch
 * dann, wenn `src/model/index.ts` (anderer Arbeitsstrang) noch nicht
 * existiert." Der Strang ist gelandet, die Datei steht, und die Krücke hat
 * sich in einen Defekt verwandelt:
 *
 *   * Ein Bezeichner in einer Variablen ist für den Bündler nicht auflösbar.
 *     Der Produktionsbau meldete `Module not found: Can't resolve
 *     '../model/index.js'` — vier Warnungen, gemessen am Bau vom 2026-09-03.
 *   * Die Endung `.js` ist obendrein die Fehlerklasse, die in diesem Audit
 *     schon einmal 711 Importe in 139 Dateien betraf: der Baum liegt als
 *     TypeScript vor, `../model/index.js` gibt es nicht.
 *   * `try/catch` machte daraus keine klare Meldung, sondern verdeckte den
 *     Auflösefehler hinter „Die Modellschicht ist nicht verfügbar" — der
 *     Bündler hätte ihn beim Bauen gemeldet, der Code hat ihn zur Laufzeit
 *     eingefangen.
 *
 * Jetzt ein gewöhnlicher dynamischer Import mit literalem Bezeichner: der
 * Bündler löst ihn auf und legt ein eigenes Stück an, die Trägheit bleibt
 * also erhalten — sie war der einzige Teil dieser Konstruktion, der einen
 * Zweck hatte.
 */
async function loadModelLayer(): Promise<ImportXmlFn> {
  const loaded = await import("../model/index");
  if (typeof loaded.importXml === "function") {
    return loaded.importXml as ImportXmlFn;
  }
  throw new Error(
    "Die Modellschicht (src/model) exportiert kein `importXml`. " +
      "Übergib stattdessen importXml in den Optionen.",
  );
}

/** Dieselbe Trägheit für den Rückweg — siehe {@link loadModelLayer}. */
async function loadModelExport(): Promise<ExportXmlFn> {
  const loaded = await import("../model/index");
  if (typeof loaded.exportXml === "function") {
    const serialise = loaded.exportXml as (
      definitions: ModdleElement,
      options?: { format?: boolean },
    ) => Promise<string>;
    return (definitions) => serialise(definitions, { format: true });
  }
  throw new Error(
    "Die Modellschicht (src/model) exportiert kein `exportXml`. " +
      "Übergib stattdessen exportXml in den Optionen.",
  );
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
