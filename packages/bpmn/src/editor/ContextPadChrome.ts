/// <reference lib="dom" />

/**
 * Barrierefreiheit und Tastaturweg des Kontextmenüs.
 *
 * Dasselbe Muster wie bei der Palette (`PaletteChrome`) und aus demselben
 * Grund: Der Rahmen von `diagram-js` baut `<div class="djs-context-pad">` mit
 * `<div class="entry">` darin. Ergänzt werden Rolle, Name, Fokusreihenfolge und
 * der Rückweg des Fokus.
 *
 * Der Zeitpunkt ist der Haken: `contextPad.create` läuft, **bevor** die
 * Einträge im DOM stehen (`ContextPad._createHtml` feuert es, `_updateAndOpen`
 * hängt danach an). Annotiert wird deshalb bei `contextPad.open` — und dort
 * jedes Mal neu, weil das Menü bei jedem Öffnen frisch gebaut wird.
 */

import { focusDiagram, RovingFocus } from "./dom.js";
import { describe } from "./ElementCreation.js";
import type { EditorAnnouncer } from "./announce.js";
import type { BpmnElement, CanvasLike, EventBusLike } from "./types.js";

interface ContextPadLike {
  close(): void;
}

interface PadCurrent {
  html?: HTMLElement;
  target?: BpmnElement | BpmnElement[];
}

export class ContextPadChrome {
  static $inject = ["eventBus", "canvas", "contextPad", "editorAnnouncer"];

  private roving: RovingFocus | null = null;
  private node: HTMLElement | null = null;

  constructor(
    eventBus: EventBusLike,
    private readonly canvas: CanvasLike,
    private readonly contextPad: ContextPadLike,
    private readonly announcer: EditorAnnouncer,
  ) {
    eventBus.on("contextPad.open", (event: { current?: PadCurrent }) => {
      const current = event.current;
      if (current?.html) this.annotate(current.html, current.target);
    });
    eventBus.on(["contextPad.close", "diagram.destroy"], () => {
      this.release();
    });
  }

  /** Das Menü im DOM — für Tests und für `axe`. */
  element(): HTMLElement | null {
    return this.node;
  }

  /** Fokus in das Menü holen. */
  focus(): boolean {
    return this.roving?.focusFirst() !== undefined;
  }

  private annotate(
    html: HTMLElement,
    target: BpmnElement | BpmnElement[] | undefined,
  ): void {
    this.release();
    this.node = html;
    html.setAttribute("role", "toolbar");
    html.setAttribute("aria-orientation", "horizontal");
    html.setAttribute("aria-label", labelFor(target));

    for (const group of Array.from(
      html.querySelectorAll<HTMLElement>("[data-group]"),
    )) {
      const id = group.getAttribute("data-group") ?? "";
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", GROUP_LABELS[id] ?? id);
    }

    this.roving = new RovingFocus(html, {
      selector: "button.entry",
      orientation: "both",
      onExit: () => {
        this.contextPad.close();
        focusDiagram(this.canvas.getContainer());
        this.announcer.announce("Kontextmenü geschlossen.");
      },
      onFocus: (element) => {
        this.announcer.announce(element.getAttribute("aria-label") ?? "");
      },
    });
  }

  private release(): void {
    this.roving?.destroy();
    this.roving = null;
    this.node = null;
  }
}

export default ContextPadChrome;

const GROUP_LABELS: Readonly<Record<string, string>> = {
  bearbeiten: "Bearbeiten",
  anfuegen: "Anfügen",
  verbinden: "Verbinden",
  struktur: "Struktur",
  ausrichten: "Ausrichten und verteilen",
  entfernen: "Entfernen",
};

function labelFor(target: BpmnElement | BpmnElement[] | undefined): string {
  if (Array.isArray(target)) {
    return `Aktionen für ${String(target.length)} ausgewählte Elemente`;
  }
  if (!target) return "Aktionen für das Element";
  return `Aktionen für ${describe(target)}`;
}
