/// <reference lib="dom" />

/**
 * [ARCTOS-FULL-2026-08-31 · OP-031] Hand-, Lasso- und Platz-Werkzeug.
 *
 * **Der Befund, nachgemessen.** `STUFE2-B1-EDITOR.md` §7.7 sagt „Die Module
 * gibt es; sie brauchen Palette-Einträge und ein Werkzeug-Zustandsmodell."
 * Gemessen am Code stimmte nur die erste Hälfte: `diagram-js` liefert
 * `hand-tool`, `lasso-tool`, `space-tool` und `tool-manager` in
 * `node_modules`, aber `grep -r "lasso\|space-tool\|hand-tool" src/` fand vor
 * dieser Arbeit **keinen einzigen** Treffer — die Module waren nicht nur ohne
 * Palette, sie waren gar nicht registriert. Es fehlte also mehr als der
 * Register-Eintrag behauptet.
 *
 * **Was ein Werkzeug hier ist.** Ein Zustand, nicht ein Knopf: es ist genau
 * eines aktiv, `Escape` beendet es, und die Palette zeigt mit
 * `aria-pressed`, welches. `diagram-js`' `toolManager` führt denselben
 * Zustand für die Maus; dieser Dienst ist die **eine** Stelle, die ihn ansagt
 * und für die Tastatur öffnet, damit nicht zwei Wahrheiten über „welches
 * Werkzeug ist an" entstehen.
 *
 * **Jedes Werkzeug hat einen Tastatur-Zwilling** — die Regel aus Plan §4.2,
 * dass Maus und Tastatur dieselbe Handlung erreichen:
 *
 * | Werkzeug | Maus | Tastatur |
 * |---|---|---|
 * | Hand (`h`) | Fläche ziehen | `Strg`+Pfeil verschiebt die Ansicht (Betrachter, seit A1) |
 * | Lasso (`l`) | Rahmen aufziehen | `Strg+Umschalt+A` wählt alles im Container (→ OP-032) |
 * | Platz (`s`) | Trennlinie ziehen | Pfeiltasten schieben ab dem fokussierten Element Platz ein |
 *
 * Der Platz-Zwilling ist der einzige, der wirklich neu ist; die anderen zwei
 * gab es und waren nur nirgends als Entsprechung benannt.
 */

import type { EditorAnnouncer } from "./announce";
import type { EditorConfiguration } from "./config";
import { describe } from "./ElementCreation";
import type {
  BpmnElement,
  BpmnShape,
  CanvasLike,
  ElementRegistryLike,
  EventBusLike,
  ModelingLike,
} from "./types";
import { visibleElements } from "./visibility";

export type ToolId = "hand" | "lasso" | "space";

export const TOOL_IDS: readonly ToolId[] = ["hand", "lasso", "space"];

/** Anzeigename und Taste je Werkzeug — eine Quelle für Palette und Ansage. */
export const TOOL_LABELS: Readonly<
  Record<ToolId, { title: string; key: string; description: string }>
> = {
  hand: {
    title: "Hand-Werkzeug",
    key: "H",
    description:
      "Ansicht verschieben, ohne etwas auszuwählen. Mit der Tastatur: Strg und Pfeiltaste.",
  },
  lasso: {
    title: "Lasso-Werkzeug",
    key: "L",
    description:
      "Mehrere Elemente mit einem Rahmen auswählen. Mit der Tastatur: Strg, Umschalt und A wählt alles im Container.",
  },
  space: {
    title: "Platz schaffen",
    key: "S",
    description:
      "Platz einfügen oder entfernen. Mit der Tastatur: Pfeiltasten ab dem fokussierten Element.",
  },
};

interface InjectorLike {
  get<T>(name: string, strict?: boolean): T | null;
}

/** Der Ausschnitt eines `diagram-js`-Werkzeugs, den dieser Dienst benutzt. */
interface DiagramToolLike {
  toggle(): void;
  isActive(): boolean;
}

interface SpaceAdjustments {
  movingShapes: BpmnShape[];
  resizingShapes: BpmnShape[];
}

interface SpaceToolLike extends DiagramToolLike {
  calculateAdjustments(
    elements: readonly BpmnElement[],
    axis: "x" | "y",
    delta: number,
    start: number,
  ): SpaceAdjustments;
}

interface SpaceModelingLike extends ModelingLike {
  createSpace(
    movingShapes: readonly BpmnShape[],
    resizingShapes: readonly BpmnShape[],
    delta: { x: number; y: number },
    direction: "n" | "e" | "s" | "w",
    start: number,
  ): void;
}

/** Der `didi`-Dienstname des jeweiligen `diagram-js`-Werkzeugs. */
const SERVICE_OF: Readonly<Record<ToolId, string>> = {
  hand: "handTool",
  lasso: "lassoTool",
  space: "spaceTool",
};

export class EditorTools {
  static $inject = [
    "eventBus",
    "canvas",
    "injector",
    "elementRegistry",
    "modeling",
    "editorConfig",
    "editorAnnouncer",
  ];

  /**
   * Der Zustand. Bewusst hier und nicht aus `toolManager` abgeleitet: der
   * `toolManager` kennt nur Werkzeuge, die über einen Zeigervorgang aktiv
   * wurden (`dragging.context()`), und wäre bei reiner Tastaturbedienung
   * dauerhaft leer. Die Palette bekäme dann nie ein `aria-pressed`.
   */
  private current: ToolId | null = null;

  private readonly eventBus: EventBusLike;

  constructor(
    eventBus: EventBusLike,
    private readonly canvas: CanvasLike,
    private readonly injector: InjectorLike,
    private readonly elementRegistry: ElementRegistryLike,
    private readonly modeling: ModelingLike,
    private readonly config: EditorConfiguration,
    private readonly announcer: EditorAnnouncer,
  ) {
    this.eventBus = eventBus;
    eventBus.on(["diagram.clear", "diagram.destroy"], () => {
      this.current = null;
      this.publish();
    });
  }

  /**
   * Den Zustand bekanntgeben.
   *
   * Ein eigenes Ereignis und nicht `tool-manager.update`: das gehört
   * `diagram-js` und beschreibt nur, was über einen Zeigervorgang aktiv wurde.
   * Wer `aria-pressed` daran hinge, bekäme bei reiner Tastaturbedienung nie
   * eine Aktualisierung.
   */
  private publish(): void {
    this.eventBus.fire("editorTools.changed", {
      tool: this.current,
    } as never);
  }

  /** Welches Werkzeug ist an? `null` heißt: das Standardwerkzeug (Auswahl). */
  active(): ToolId | null {
    return this.current;
  }

  isActive(tool: ToolId): boolean {
    return this.current === tool;
  }

  /**
   * Werkzeug ein- oder ausschalten.
   *
   * `true` heißt „ist jetzt an". Ein zweiter Aufruf desselben Werkzeugs
   * schaltet es aus — das ist die Erwartung an eine Werkzeugtaste und
   * verhindert die Sackgasse, in der ein Tastaturnutzer nicht mehr zur
   * Auswahl zurückfindet.
   */
  toggle(tool: ToolId): boolean {
    if (!this.config.editable) {
      this.announcer.reject(this.config.disabledReason);
      return false;
    }
    if (this.current === tool) {
      this.cancel();
      return false;
    }
    // Erst das alte abräumen: `toolManager` erlaubt genau ein aktives
    // Werkzeug, und ein liegengebliebener `dragging`-Kontext fängt die
    // nächsten Zeigerereignisse ab.
    this.deactivateDiagramTool();
    this.current = tool;
    this.activateDiagramTool(tool);
    const label = TOOL_LABELS[tool];
    this.publish();
    this.announcer.announce(
      `${label.title} eingeschaltet. ${label.description} Escape schaltet es aus.`,
    );
    return true;
  }

  /** Werkzeug aus, zurück zur Auswahl. `true`, wenn eines an war. */
  cancel(): boolean {
    if (this.current === null) return false;
    const label = TOOL_LABELS[this.current];
    this.deactivateDiagramTool();
    this.current = null;
    this.publish();
    this.announcer.announce(`${label.title} ausgeschaltet.`);
    return true;
  }

  // -------------------------------------------------------------------------
  // Der Tastatur-Zwilling des Platz-Werkzeugs
  // -------------------------------------------------------------------------

  /**
   * Schiebt ab `origin` Platz ein (oder heraus, bei negativem Schritt).
   *
   * Was sich bewegt und was mitwächst, rechnet `spaceTool.calculateAdjustments`
   * — dieselbe Rechnung, die auch der Mausvorgang benutzt. Sie hier
   * nachzubauen hieße, zwei Antworten auf „wächst der Pool mit?" zu haben, und
   * genau das ist die Fehlerklasse, die dieses Paket vermeiden soll.
   *
   * Der Schnitt liegt an der **hinteren** Kante von `origin`: alles rechts
   * davon (bzw. darunter) rückt, `origin` selbst bleibt stehen. Das ist die
   * Bedeutung von „hinter diesem Schritt ist jetzt Platz".
   */
  makeSpace(origin: BpmnShape, delta: { x: number; y: number }): boolean {
    if (!this.config.editable) {
      this.announcer.reject(this.config.disabledReason);
      return false;
    }
    const spaceTool = this.injector.get<SpaceToolLike>("spaceTool", false);
    const modeling = this.modeling as SpaceModelingLike;
    if (!spaceTool || typeof modeling.createSpace !== "function") {
      this.announcer.reject("Platz schaffen ist hier nicht verfügbar.");
      return false;
    }

    const axis: "x" | "y" = delta.x !== 0 ? "x" : "y";
    const amount = axis === "x" ? delta.x : delta.y;
    if (amount === 0) return false;
    const start =
      axis === "x" ? origin.x + origin.width : origin.y + origin.height;

    const candidates = visibleElements(this.elementRegistry).filter(
      (element) => (element as BpmnShape).labelTarget === undefined,
    );
    const adjustments = spaceTool.calculateAdjustments(
      candidates,
      axis,
      amount,
      start,
    );
    if (
      adjustments.movingShapes.length === 0 &&
      adjustments.resizingShapes.length === 0
    ) {
      this.announcer.reject(
        `Hinter ${describe(origin)} steht nichts, was Platz brauchte.`,
      );
      return false;
    }

    const direction = directionOf(axis, amount);
    modeling.createSpace(
      adjustments.movingShapes,
      adjustments.resizingShapes,
      axis === "x" ? { x: amount, y: 0 } : { x: 0, y: amount },
      direction,
      start,
    );
    this.announcer.announce(
      amount > 0
        ? `${String(Math.abs(amount))} Pixel Platz hinter ${describe(origin)} eingefügt. ${String(
            adjustments.movingShapes.length,
          )} Elemente gerückt, ${String(adjustments.resizingShapes.length)} vergrößert.`
        : `${String(Math.abs(amount))} Pixel Platz hinter ${describe(origin)} entfernt. ${String(
            adjustments.movingShapes.length,
          )} Elemente gerückt.`,
    );
    return true;
  }

  // -------------------------------------------------------------------------

  private diagramTool(tool: ToolId): DiagramToolLike | null {
    return this.injector.get<DiagramToolLike>(SERVICE_OF[tool], false);
  }

  /**
   * Das `diagram-js`-Werkzeug mitschalten, wenn es da ist.
   *
   * In `try` gefasst, und zwar mit Grund: `toggle()` fragt den zuletzt
   * gesehenen Mauszeiger (`mouse.getLastMoveEvent()`). In einer Sitzung, in der
   * noch keine Maus bewegt wurde — jeder Tastaturlauf und jeder Test —, gibt es
   * den nicht. Der Zustand dieses Dienstes darf davon nicht abhängen: die
   * Tastaturbedienung funktioniert auch ohne den Mausteil, und eine Ausnahme
   * aus dem Mausteil dürfte sie nicht mitreißen.
   */
  private activateDiagramTool(tool: ToolId): void {
    const service = this.diagramTool(tool);
    if (!service) return;
    try {
      if (!service.isActive()) service.toggle();
    } catch {
      /* siehe Kommentar oben */
    }
  }

  private deactivateDiagramTool(): void {
    for (const tool of TOOL_IDS) {
      const service = this.diagramTool(tool);
      if (!service) continue;
      try {
        if (service.isActive()) service.toggle();
      } catch {
        /* siehe Kommentar oben */
      }
    }
    // Ein Werkzeugwechsel darf keine Markierung auf der Fläche zurücklassen.
    this.canvas.getContainer().classList.remove("djs-lasso-tool-active");
  }
}

export default EditorTools;

/** Achse und Vorzeichen → Himmelsrichtung, wie `diagram-js` sie erwartet. */
export function directionOf(
  axis: "x" | "y",
  amount: number,
): "n" | "e" | "s" | "w" {
  if (axis === "x") return amount > 0 ? "e" : "w";
  return amount > 0 ? "s" : "n";
}
