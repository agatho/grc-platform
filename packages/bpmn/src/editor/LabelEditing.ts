/// <reference lib="dom" />

/**
 * Direktes Beschriften — Doppelklick und `F2`.
 *
 * **Warum hier ein `<textarea>` steht und nicht `diagram-js-direct-editing`.**
 * Das Paket (MIT, im Monorepo vorhanden) trägt in `bpmn-js` die Hauptlast; sein
 * Eingabefeld ist ein `contenteditable`-`<div>`. Für diese Schicht sprechen
 * drei Gründe dagegen, und alle drei stehen im Auftrag:
 *
 * 1. **Barrierefreiheit ist kein Nachtrag.** Ein `contenteditable`-`div` hat
 *    keine Rolle, keinen zugänglichen Namen und in mehreren Screenreadern kein
 *    verlässliches Eingabeverhalten. Ein `<textarea>` mit `aria-label` ist ein
 *    Formularfeld, das jede Hilfstechnik kennt.
 * 2. **`@grc/bpmn` deklariert das Paket nicht** als Abhängigkeit; es liegt nur
 *    hochgehoben im Wurzel-`node_modules` von `apps/web`. Eine stille Nutzung
 *    wäre eine Abhängigkeit, die im Paketmanifest fehlt.
 * 3. Es liefert **keine Typen**; unter `strict` bräuchte es eine eigene
 *    Deklarationsdatei — also ohnehin Code hier.
 *
 * Das Verhalten ist dasselbe: Feld über dem Element, mehrzeilig,
 * `Escape` verwirft, `Enter` übernimmt, `Umschalt+Enter` bricht die Zeile um,
 * `Tab` übernimmt und geht zum nächsten Element weiter.
 */

import { getTypeLabel } from "../draw/semantic.js";
import {
  externalLabelBounds,
  hasExternalLabel,
  labelText,
} from "../modeling/labels.js";
import { boOf } from "../modeling/util.js";
import type { EditorAnnouncer } from "./announce.js";
import { describe } from "./ElementCreation.js";
import { focusDiagram, isTextInput } from "./dom.js";
import type {
  BpmnConnection,
  BpmnElement,
  BpmnShape,
  Bounds,
  CanvasLike,
  ElementRegistryLike,
  EventBusLike,
  ModelingLike,
  SelectionLike,
} from "./types.js";

/** Mindestmaße des Eingabefelds, damit auch ein Ereignis beschriftbar bleibt. */
const MIN_WIDTH = 90;
const MIN_HEIGHT = 24;

interface ActiveEditing {
  readonly element: BpmnElement;
  readonly textarea: HTMLTextAreaElement;
  readonly original: string;
  readonly wrapper: HTMLElement;
}

export class LabelEditing {
  static $inject = [
    "eventBus",
    "canvas",
    "modeling",
    "elementRegistry",
    "selection",
    "editorAnnouncer",
  ];

  private active: ActiveEditing | null = null;

  constructor(
    eventBus: EventBusLike,
    private readonly canvas: CanvasLike,
    private readonly modeling: ModelingLike,
    private readonly elementRegistry: ElementRegistryLike,
    private readonly selection: SelectionLike,
    private readonly announcer: EditorAnnouncer,
  ) {
    eventBus.on("element.dblclick", (event: { element?: BpmnElement }) => {
      if (event.element) this.activate(event.element);
    });
    // Wird das Diagramm ausgetauscht, hängt das Feld über einem Element, das
    // es nicht mehr gibt. Verwerfen ist hier die einzige richtige Antwort:
    // übernehmen hieße, in ein fremdes Dokument zu schreiben.
    eventBus.on(["diagram.clear", "diagram.destroy"], () => {
      this.cancel();
    });
  }

  isActive(element?: BpmnElement): boolean {
    if (!this.active) return false;
    return element === undefined || this.active.element === element;
  }

  /** Das laufende Eingabefeld — für Tests und für den Tastaturweg. */
  input(): HTMLTextAreaElement | null {
    return this.active?.textarea ?? null;
  }

  /** Ist dieses Element überhaupt beschriftbar? */
  canEdit(element: BpmnElement | undefined): boolean {
    if (!element) return false;
    const shape = element as BpmnShape;
    if (shape.labelTarget !== undefined) return true;
    const bo = boOf(element);
    if (!bo) return false;
    return typeof bo["name"] === "string" || labelableType(bo.$type);
  }

  /**
   * Öffnet das Feld über dem Element.
   *
   * Bei einer Beschriftung (`labelTarget`) wird das **Ziel** bearbeitet, nicht
   * die Beschriftung: sonst schriebe man den Namen auf das Beschriftungs-Shape,
   * das im Modell gar keine eigene Semantik hat.
   */
  activate(element: BpmnElement): boolean {
    const target = (element as BpmnShape).labelTarget ?? element;
    if (!this.canEdit(target)) {
      this.announcer.reject(
        `${describe(target)} lässt sich nicht beschriften.`,
      );
      return false;
    }
    this.cancel();

    const bounds = this.boundsFor(target);
    const container = this.canvas.getContainer();
    const wrapper = document.createElement("div");
    wrapper.className = "arctos-bpmn-label-editing";
    wrapper.style.position = "absolute";
    wrapper.style.zIndex = "100";

    const viewbox = this.canvas.viewbox();
    const scale = viewbox.scale || 1;
    wrapper.style.left = `${String((bounds.x - viewbox.x) * scale)}px`;
    wrapper.style.top = `${String((bounds.y - viewbox.y) * scale)}px`;
    wrapper.style.width = `${String(Math.max(bounds.width, MIN_WIDTH) * scale)}px`;

    const textarea = document.createElement("textarea");
    textarea.className = "arctos-bpmn-label-input";
    textarea.rows = 2;
    textarea.value = labelText(boOf(target));
    textarea.setAttribute(
      "aria-label",
      `Beschriftung von ${describe(target)}. Eingabetaste übernimmt, Escape verwirft.`,
    );
    textarea.style.width = "100%";
    textarea.style.minHeight = `${String(Math.max(bounds.height, MIN_HEIGHT) * scale)}px`;
    textarea.style.resize = "none";

    textarea.addEventListener("keydown", (event) => {
      this.handleKey(event);
    });
    // Klick daneben übernimmt — das ist die Erwartung aus jedem Editor.
    textarea.addEventListener("blur", () => {
      if (this.active?.textarea === textarea) this.complete();
    });

    wrapper.appendChild(textarea);
    container.appendChild(wrapper);

    this.active = {
      element: target,
      textarea,
      original: textarea.value,
      wrapper,
    };

    textarea.focus();
    textarea.select();
    this.announcer.announce(
      `Beschriftung von ${describe(target)} wird bearbeitet. Escape verwirft.`,
    );
    return true;
  }

  /** Übernimmt den Wert und schließt das Feld. */
  complete(): void {
    const active = this.active;
    if (!active) return;
    const value = active.textarea.value;
    this.close();
    if (value !== active.original) {
      this.modeling.updateLabel(active.element, value);
      this.announcer.announce(
        value.trim() === ""
          ? `Beschriftung von ${describe(active.element)} entfernt.`
          : `${describe(active.element)} beschriftet mit „${value}“.`,
      );
    } else {
      this.announcer.announce("Beschriftung unverändert.");
    }
  }

  /** Verwirft den Wert und schließt das Feld. */
  cancel(): void {
    const active = this.active;
    if (!active) return;
    this.close();
    this.announcer.announce("Beschriftung verworfen.");
  }

  private close(): void {
    const active = this.active;
    this.active = null;
    active?.wrapper.remove();
  }

  private handleKey(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      this.cancel();
      this.focusCanvas();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      this.complete();
      this.focusCanvas();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key === "Tab") {
      const current = this.active?.element;
      this.complete();
      const next = this.nextLabelable(current, event.shiftKey ? -1 : 1);
      if (next) {
        this.selection.select(next);
        this.activate(next);
      } else {
        this.focusCanvas();
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    // Alles Übrige gehört dem Textfeld — der Editor darf es nicht abfangen.
    event.stopPropagation();
  }

  private focusCanvas(): void {
    focusDiagram(this.canvas.getContainer());
  }

  /**
   * Das nächste beschriftbare Element in Lesereihenfolge (oben-links zuerst).
   *
   * Bewusst geometrisch und nicht topologisch: `Tab` im Beschriftungsmodus ist
   * ein *Erfassungs*-Weg („alle Kästen der Reihe nach benennen"), und dabei
   * hilft die Anordnung im Bild mehr als der Ablauf.
   */
  private nextLabelable(
    current: BpmnElement | undefined,
    direction: 1 | -1,
  ): BpmnElement | undefined {
    const candidates = this.elementRegistry
      .getAll()
      .filter(
        (element) =>
          (element as BpmnShape).labelTarget === undefined &&
          element.parent !== undefined &&
          this.canEdit(element),
      )
      .sort((a, b) => {
        const pa = anchorOf(a);
        const pb = anchorOf(b);
        return pa.y - pb.y || pa.x - pb.x || a.id.localeCompare(b.id);
      });
    if (candidates.length === 0) return undefined;
    const index = current
      ? candidates.findIndex((element) => element === current)
      : -1;
    const next = (index + direction + candidates.length) % candidates.length;
    return candidates[next];
  }

  private boundsFor(element: BpmnElement): Bounds {
    const shape = element as BpmnShape;
    const bo = boOf(element);
    if (hasExternalLabel(bo) || typeof shape.width !== "number") {
      return externalLabelBounds(element, element.di);
    }
    return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
  }
}

export default LabelEditing;

/** Ist dieses Textfeld gerade im Fokus? Der Tastaturdienst fragt danach. */
export function isEditingTarget(target: EventTarget | null): boolean {
  return isTextInput(target);
}

function labelableType(type: string | undefined): boolean {
  if (typeof type !== "string") return false;
  return (
    type.startsWith("bpmn:") &&
    type !== "bpmn:Process" &&
    type !== "bpmn:Collaboration"
  );
}

function anchorOf(element: BpmnElement): { x: number; y: number } {
  const shape = element as BpmnShape;
  if (typeof shape.width === "number") return { x: shape.x, y: shape.y };
  const waypoints = (element as BpmnConnection).waypoints;
  const first = Array.isArray(waypoints) ? waypoints[0] : undefined;
  return first ?? { x: 0, y: 0 };
}

/** Nur für die Ansage: Typname eines Elements. */
export function typeNameOf(element: BpmnElement): string {
  const bo = boOf(element);
  return getTypeLabel(bo?.$type ?? element.type ?? "");
}
