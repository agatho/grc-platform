/// <reference lib="dom" />

/**
 * Tastaturbedienung des Editors — der Anspruch, an dem sich diese Schicht misst.
 *
 * Audit-Finding S14-10 hielt fest: im Bestandsmodul gibt es in allen sechs
 * Dateien **keinen einzigen** Tastatur-Handler. Der Betrachter hat inzwischen
 * einen (`src/viewer/a11y.ts`): er *navigiert*. Was hier entsteht, ist das
 * *Bearbeiten* — anlegen, verbinden, löschen, verschieben, beschriften,
 * Stützpunkte setzen, rückgängig machen. **Ohne Maus muss ein vollständiges
 * Diagramm baubar sein.**
 *
 * ## Warum ein eigener Zuhörer und nicht `features/keyboard`
 *
 * `diagram-js` bringt `keyboard` mit; es bindet an einen Knoten, den die
 * Anwendung angibt. Diese Schicht hört stattdessen auf `canvas.getContainer()`,
 * und zwar aus einem Grund, der die ganze Belegung trägt: Der Betrachter hört
 * am **äußeren** Container. Ereignisse steigen vom SVG über
 * `.djs-container` nach außen — wer innen hört, sieht sie **zuerst**. Damit
 * ergibt sich die Schichtung von selbst:
 *
 *   *bearbeitende* Tasten werden hier verarbeitet und gestoppt;
 *   *navigierende* Tasten laufen unberührt weiter zum Betrachter.
 *
 * Das ist die technische Umsetzung der Vorgabe „die Navigationsbelegung bleibt
 * identisch, damit sich Lesen und Bearbeiten gleich anfühlen" (Plan §4.2).
 * Pfeiltasten allein navigieren also weiterhin; mit `Umschalt` verschieben sie.
 *
 * ## Die Belegung
 *
 * | Taste | Wirkung |
 * |---|---|
 * | `F6` / `Umschalt+F6` | Bereich wechseln: Zeichenfläche ↔ Palette |
 * | `F2` | Beschriftung des fokussierten Elements |
 * | `Entf` / `Rück` | Auswahl löschen |
 * | `Umschalt+Pfeil` | Auswahl im Raster verschieben |
 * | `Umschalt+Alt+Pfeil` | Auswahl fein verschieben |
 * | `Strg+Umschalt+Pfeil` | Auswahl größer/kleiner |
 * | `c` | Verbinden: Ziele durchblättern, `Enter` verbindet |
 * | `r` | Typ wechseln (Form) bzw. Kantenanfang umhängen (Kante) |
 * | `Umschalt+R` | Kantenende umhängen |
 * | `b` | Stützpunkt-Betriebsart an einer Kante |
 * | `g` | Einrasten am Raster umschalten |
 * | `Umschalt+F10`, `Kontextmenü` | Kontextmenü am Element öffnen |
 * | `Strg+Z` / `Strg+Y`, `Strg+Umschalt+Z` | rückgängig / wiederholen |
 * | `Strg+C` / `X` / `V` / `D` | kopieren / ausschneiden / einfügen / duplizieren |
 * | `Strg+A` | alles auswählen |
 * | `Strg+Leertaste` | fokussiertes Element zur Auswahl hinzunehmen |
 * | `Escape` | Betriebsart oder Menü abbrechen |
 *
 * Jede dieser Handlungen meldet ihr Ergebnis an die Live-Region — die Ansage
 * steht nicht hier, sondern in dem Dienst, der die Handlung ausführt, damit
 * Maus- und Tastaturweg denselben Satz sagen.
 */

import type { EditorAnnouncer } from "./announce.js";
import type { AlignDistribute } from "./AlignDistribute.js";
import type { BendpointEditing } from "./BendpointEditing.js";
import type { EditorConfiguration } from "./config.js";
import type { ConnectMode } from "./ConnectMode.js";
import type { ArctosContextPadProvider } from "./ContextPadProvider.js";
import type { BpmnCopyPaste } from "./CopyPaste.js";
import type { LabelEditing } from "./LabelEditing.js";
import type { PaletteChrome } from "./PaletteChrome.js";
import type { ReplaceMenu } from "./ReplaceMenu.js";
import type { ResizeBehavior } from "./ResizeBehavior.js";
import { describe } from "./ElementCreation.js";
import { focusDiagram, isTextInput } from "./dom.js";
import type {
  BpmnConnection,
  BpmnElement,
  BpmnShape,
  CanvasLike,
  CommandStackLike,
  ElementRegistryLike,
  EventBusLike,
  ModelingLike,
  SelectionLike,
} from "./types.js";

/** Bereiche des DOM, deren Tasten dem jeweiligen Bauteil gehören. */
const OWNED_BY_OTHERS =
  ".djs-palette, .djs-context-pad, .arctos-bpmn-replace-menu, .arctos-bpmn-label-editing";

interface ContextPadLike {
  open(target: BpmnElement | BpmnElement[], force?: boolean): void;
  close(): void;
  isOpen(target?: BpmnElement | BpmnElement[]): boolean;
}

interface InjectorLike {
  get<T>(name: string, strict?: boolean): T | null;
}

/** Zustand der Stützpunkt-Betriebsart. */
interface BendpointState {
  readonly connection: BpmnConnection;
  index: number;
}

export class EditorKeyboard {
  static $inject = [
    "eventBus",
    "canvas",
    "injector",
    "elementRegistry",
    "selection",
    "modeling",
    "commandStack",
    "editorConfig",
    "editorAnnouncer",
  ];

  private readonly onKeyDown: (event: KeyboardEvent) => void;
  private bendpointState: BendpointState | null = null;
  private destroyed = false;

  constructor(
    eventBus: EventBusLike,
    private readonly canvas: CanvasLike,
    private readonly injector: InjectorLike,
    private readonly elementRegistry: ElementRegistryLike,
    private readonly selection: SelectionLike,
    private readonly modeling: ModelingLike,
    private readonly commandStack: CommandStackLike,
    private readonly config: EditorConfiguration,
    private readonly announcer: EditorAnnouncer,
  ) {
    this.onKeyDown = (event) => {
      this.handle(event);
    };
    canvas.getContainer().addEventListener("keydown", this.onKeyDown);
    eventBus.on("diagram.destroy", () => {
      this.destroy();
    });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.canvas.getContainer().removeEventListener("keydown", this.onKeyDown);
  }

  /** Die Stützpunkt-Betriebsart — für Tests und Ansagen. */
  bendpointMode(): BendpointState | null {
    return this.bendpointState;
  }

  // -------------------------------------------------------------------------
  // Verteilung
  // -------------------------------------------------------------------------

  /**
   * Verarbeitet einen Tastendruck. Öffentlich, weil ein Test die Bedienung
   * über echte Ereignisse prüft und ein Aufrufer sie an eine eigene
   * Werkzeugleiste hängen können soll.
   *
   * `true` heißt: verarbeitet und gestoppt.
   */
  handle(event: KeyboardEvent): boolean {
    if (this.destroyed || !this.config.editable) return false;
    if (isTextInput(event.target)) return false;
    const target = event.target;
    const elsewhere =
      target instanceof Element && target.closest(OWNED_BY_OTHERS) !== null;

    // `F6` ist die **einzige** Taste, die überall greifen muss: Sie wechselt
    // den Bereich, und ein Bereichswechsel, der nur in eine Richtung
    // funktioniert, setzt einen Tastaturnutzer in der Palette fest.
    if (event.key === "F6") {
      const handled = this.cycleRegion(event.shiftKey);
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
      return handled;
    }
    if (elsewhere) return false;

    const handled =
      this.handleModes(event) ||
      this.handleCommands(event) ||
      this.handleActions(event);
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
    return handled;
  }

  // -------------------------------------------------------------------------
  // Betriebsarten (Verbinden, Stützpunkte) haben Vorrang
  // -------------------------------------------------------------------------

  private handleModes(event: KeyboardEvent): boolean {
    const connectMode = this.service<ConnectMode>("connectMode");
    if (connectMode?.isActive()) {
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          connectMode.step(1);
          return true;
        case "ArrowLeft":
        case "ArrowUp":
          connectMode.step(-1);
          return true;
        case "Enter":
          connectMode.confirm();
          return true;
        case "Escape":
          connectMode.cancel();
          return true;
        default:
          return false;
      }
    }

    const menu = this.service<ReplaceMenu>("replaceMenu");
    if (menu?.isOpen() && event.key === "Escape") {
      menu.close(true);
      return true;
    }

    const state = this.bendpointState;
    if (state) {
      return this.handleBendpointMode(event, state);
    }
    return false;
  }

  private handleBendpointMode(
    event: KeyboardEvent,
    state: BendpointState,
  ): boolean {
    const bendpoints = this.service<BendpointEditing>("bendpointEditing");
    if (!bendpoints) return false;
    const step = event.altKey ? this.config.fineStep : this.config.gridStep;

    if (event.key === "Escape") {
      this.bendpointState = null;
      this.announcer.announce("Stützpunkt-Bearbeitung beendet.");
      return true;
    }
    if (event.key === "Insert" || event.key === "+") {
      const index = bendpoints.add(state.connection);
      if (index >= 0) state.index = index;
      return true;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      if (bendpoints.remove(state.connection, state.index)) {
        state.index = Math.max(0, state.index - 1);
        if (bendpoints.count(state.connection) === 0) {
          this.bendpointState = null;
          this.announcer.announce("Stützpunkt-Bearbeitung beendet.");
        }
      }
      return true;
    }
    const delta = arrowDelta(event.key, step);
    if (delta) {
      if (event.shiftKey) {
        bendpoints.move(state.connection, state.index, delta);
      } else {
        const count = bendpoints.count(state.connection);
        if (count === 0) return true;
        const direction = delta.x + delta.y > 0 ? 1 : -1;
        state.index = (state.index + direction + count) % count;
        const point = bendpoints.bendpoints(state.connection)[state.index];
        this.announcer.announce(
          `Stützpunkt ${String(state.index + 1)} von ${String(count)} bei ${String(
            Math.round(point?.x ?? 0),
          )}, ${String(Math.round(point?.y ?? 0))}.`,
        );
      }
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // Befehle mit Steuerungstaste
  // -------------------------------------------------------------------------

  private handleCommands(event: KeyboardEvent): boolean {
    const command = event.ctrlKey || event.metaKey;
    if (!command) return false;
    const key = event.key.toLowerCase();

    if (key === "z" && !event.shiftKey) {
      this.undo();
      return true;
    }
    if (key === "y" || (key === "z" && event.shiftKey)) {
      this.redo();
      return true;
    }
    if (key === "c") {
      this.service<BpmnCopyPaste>("bpmnCopyPaste")?.copy();
      return true;
    }
    if (key === "x") {
      this.service<BpmnCopyPaste>("bpmnCopyPaste")?.cut();
      return true;
    }
    if (key === "v") {
      this.service<BpmnCopyPaste>("bpmnCopyPaste")?.paste();
      return true;
    }
    if (key === "d") {
      this.service<BpmnCopyPaste>("bpmnCopyPaste")?.duplicate();
      return true;
    }
    if (key === "a") {
      this.selectAll();
      return true;
    }
    if (event.key === " ") {
      this.extendSelection();
      return true;
    }
    // Strg/Alt + Pfeile gehören dem Betrachter (Fläche verschieben) — außer
    // mit Umschalt, dann ist Größe ändern gemeint.
    if (event.shiftKey) {
      const delta = arrowDelta(event.key, this.config.gridStep);
      if (delta) {
        this.resizeSelection(delta);
        return true;
      }
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // Bearbeiten ohne Steuerungstaste
  // -------------------------------------------------------------------------

  private handleActions(event: KeyboardEvent): boolean {
    if (event.ctrlKey || event.metaKey) return false;

    if (event.key === "F6") {
      return this.cycleRegion(event.shiftKey);
    }
    if (event.key === "F2") {
      const element = this.focused();
      if (!element) {
        this.announcer.reject("Es ist kein Element ausgewählt.");
        return true;
      }
      this.service<LabelEditing>("labelEditing")?.activate(element);
      return true;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      this.deleteSelection();
      return true;
    }
    if (event.key === "F10" && event.shiftKey) {
      return this.openContextPad();
    }
    if (event.key === "ContextMenu") {
      return this.openContextPad();
    }
    if (event.shiftKey && event.key.length > 1) {
      const delta = arrowDelta(
        event.key,
        event.altKey ? this.config.fineStep : this.config.gridStep,
      );
      if (delta) {
        this.moveSelection(delta);
        return true;
      }
    }

    // Einzeltasten. Sie greifen nur, wenn keine Modifikatoren im Spiel sind —
    // sonst kollidieren sie mit den Browserkürzeln.
    if (event.altKey) return false;
    switch (event.key) {
      case "c":
      case "C":
        return this.startConnect();
      case "r":
        return this.startReplaceOrReconnect(false);
      case "R":
        return this.startReplaceOrReconnect(true);
      case "b":
      case "B":
        return this.startBendpointMode();
      case "g":
      case "G":
        this.service<AlignDistribute>("alignDistribute")?.toggleGrid();
        return true;
      default:
        return false;
    }
  }

  // -------------------------------------------------------------------------
  // Handlungen
  // -------------------------------------------------------------------------

  undo(): void {
    if (!this.commandStack.canUndo()) {
      this.announcer.reject("Es gibt nichts rückgängig zu machen.");
      return;
    }
    this.commandStack.undo();
    this.announcer.announce("Rückgängig gemacht.");
  }

  redo(): void {
    if (!this.commandStack.canRedo()) {
      this.announcer.reject("Es gibt nichts zu wiederholen.");
      return;
    }
    this.commandStack.redo();
    this.announcer.announce("Wiederholt.");
  }

  /** Löschen — derselbe Weg, den auch das Kontextmenü nimmt. */
  deleteSelection(): void {
    const elements = this.selectionOrFocus();
    if (elements.length === 0) {
      this.announcer.reject("Es ist nichts ausgewählt.");
      return;
    }
    const pad = this.service<ArctosContextPadProvider>("contextPadProvider");
    if (pad) {
      pad.remove(elements);
      return;
    }
    this.modeling.removeElements(elements);
    this.selection.select(null);
    this.announcer.announce(`${String(elements.length)} Elemente gelöscht.`);
  }

  /** Auswahl im Raster verschieben. */
  moveSelection(delta: { x: number; y: number }): void {
    const shapes = this.selectionOrFocus().filter(
      (element) =>
        typeof (element as BpmnShape).width === "number" &&
        (element as BpmnShape).labelTarget === undefined,
    );
    if (shapes.length === 0) {
      this.announcer.reject("Es ist keine Form ausgewählt.");
      return;
    }
    // `moveElements` und nicht `moveShape`: Beschriftungen und Anhefter hängen
    // am zusammengesetzten Kommando (STUFE2-A1 §7, Punkt 7). Der falsche Aufruf
    // ließe die Beschriftung an der alten Stelle zurück.
    this.modeling.moveElements(shapes, delta);
    const first = shapes[0] as BpmnShape | undefined;
    this.announcer.announce(
      shapes.length === 1 && first
        ? `${describe(first)} verschoben auf ${String(Math.round(first.x))}, ${String(Math.round(first.y))}.`
        : `${String(shapes.length)} Elemente um ${String(delta.x)}, ${String(delta.y)} verschoben.`,
    );
  }

  /** Auswahl größer oder kleiner machen (untere rechte Ecke). */
  resizeSelection(delta: { x: number; y: number }): void {
    const resize = this.service<ResizeBehavior>("resizeBehavior");
    const shape = this.selectionOrFocus()[0] as BpmnShape | undefined;
    if (!resize || !shape || typeof shape.width !== "number") {
      this.announcer.reject("Es ist keine Form ausgewählt.");
      return;
    }
    resize.resizeBy(shape, "se", delta);
  }

  /** Verbindungsmodus starten. */
  startConnect(): boolean {
    const element = this.focused();
    if (!element) {
      this.announcer.reject("Es ist kein Element ausgewählt.");
      return true;
    }
    this.service<ConnectMode>("connectMode")?.start(element);
    return true;
  }

  private startReplaceOrReconnect(useEnd: boolean): boolean {
    const element = this.focused();
    if (!element) {
      this.announcer.reject("Es ist kein Element ausgewählt.");
      return true;
    }
    if (Array.isArray((element as BpmnConnection).waypoints)) {
      this.service<ConnectMode>("connectMode")?.startReconnect(
        element as BpmnConnection,
        useEnd ? "target" : "source",
      );
      return true;
    }
    this.service<ReplaceMenu>("replaceMenu")?.openFor(element as BpmnShape);
    return true;
  }

  private startBendpointMode(): boolean {
    const element = this.focused();
    const bendpoints = this.service<BendpointEditing>("bendpointEditing");
    if (!element || !Array.isArray((element as BpmnConnection).waypoints)) {
      this.announcer.reject("Stützpunkte gibt es nur an einer Kante.");
      return true;
    }
    if (!bendpoints) return true;
    const connection = element as BpmnConnection;
    if (bendpoints.count(connection) === 0) {
      const index = bendpoints.add(connection);
      if (index < 0) return true;
      this.bendpointState = { connection, index };
    } else {
      this.bendpointState = { connection, index: 0 };
      this.announcer.announce(
        `Stützpunkt-Bearbeitung an ${describe(connection)}. ${String(
          bendpoints.count(connection),
        )} Stützpunkte. Pfeiltasten wählen, Umschalt und Pfeil verschiebt, Entf entfernt, Escape beendet.`,
      );
    }
    return true;
  }

  private openContextPad(): boolean {
    const elements = this.selectionOrFocus();
    if (elements.length === 0) {
      this.announcer.reject("Es ist kein Element ausgewählt.");
      return true;
    }
    const pad = this.injector.get<ContextPadLike>("contextPad", false);
    if (!pad) return true;
    pad.open(
      elements.length === 1 ? (elements[0] as BpmnElement) : elements,
      true,
    );
    const node = this.canvas
      .getContainer()
      .querySelector<HTMLElement>(".djs-context-pad button.entry");
    if (node) {
      node.tabIndex = 0;
      node.focus();
    }
    this.announcer.announce(
      "Kontextmenü geöffnet. Tabulator und Pfeiltasten wählen, Escape schließt.",
    );
    return true;
  }

  private cycleRegion(backwards: boolean): boolean {
    const palette = this.service<PaletteChrome>("paletteChrome");
    if (!palette) return false;
    const active = this.canvas.getContainer().ownerDocument.activeElement;
    const inPalette =
      active instanceof Element && active.closest(".djs-palette") !== null;
    if (inPalette || backwards) {
      focusDiagram(this.canvas.getContainer());
      this.announcer.announce("Zeichenfläche.");
      return true;
    }
    if (palette.focus()) return true;
    focusDiagram(this.canvas.getContainer());
    return true;
  }

  private selectAll(): void {
    const all = this.elementRegistry
      .getAll()
      .filter(
        (element) =>
          element.parent !== undefined &&
          (element as BpmnShape).labelTarget === undefined,
      );
    this.selection.select(all);
    this.announcer.announce(`${String(all.length)} Elemente ausgewählt.`);
  }

  private extendSelection(): void {
    const element = this.focusedFromDom();
    if (!element) {
      this.announcer.reject("Es ist kein Element im Fokus.");
      return;
    }
    if (this.selection.isSelected(element)) {
      this.selection.deselect(element);
      this.announcer.announce(
        `${describe(element)} aus der Auswahl entfernt. ${String(this.selection.get().length)} ausgewählt.`,
      );
      return;
    }
    this.selection.select(element, true);
    this.announcer.announce(
      `${describe(element)} zur Auswahl hinzugefügt. ${String(this.selection.get().length)} ausgewählt.`,
    );
  }

  // -------------------------------------------------------------------------

  /**
   * Das Element, auf das sich eine Handlung bezieht.
   *
   * **Fokus vor Auswahl** — das ist die Ordnung, die der Plan vorgibt
   * („Selektion ≠ Fokus", §4.2). Wer mit den Pfeiltasten auf ein Element
   * gewandert ist und `F2` drückt, meint dieses, nicht das zuletzt ausgewählte.
   */
  focused(): BpmnElement | undefined {
    return this.focusedFromDom() ?? this.selection.get()[0];
  }

  private focusedFromDom(): BpmnElement | undefined {
    const active = this.canvas.getContainer().ownerDocument.activeElement;
    if (!(active instanceof Element)) return undefined;
    const node = active.closest("[data-element-id]");
    const id = node?.getAttribute("data-element-id");
    if (!id) return undefined;
    return this.elementRegistry.get(id);
  }

  private selectionOrFocus(): BpmnElement[] {
    const selected = this.selection.get();
    if (selected.length > 0) return selected;
    const focused = this.focused();
    return focused ? [focused] : [];
  }

  private service<T>(name: string): T | null {
    return this.injector.get<T>(name, false);
  }
}

export default EditorKeyboard;

/** Pfeiltaste → Verschiebung. `null`, wenn es keine Pfeiltaste war. */
export function arrowDelta(
  key: string,
  step: number,
): { x: number; y: number } | null {
  switch (key) {
    case "ArrowLeft":
      return { x: -step, y: 0 };
    case "ArrowRight":
      return { x: step, y: 0 };
    case "ArrowUp":
      return { x: 0, y: -step };
    case "ArrowDown":
      return { x: 0, y: step };
    default:
      return null;
  }
}
