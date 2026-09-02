/// <reference lib="dom" />

/**
 * Barrierefreiheit und Tastaturweg der Palette.
 *
 * Der Rahmen von `diagram-js` baut die Palette als verschachtelte `<div>`s ohne
 * Rolle. Was hier ergänzt wird, ist genau das, was Audit-Finding S14-10
 * vermisst hat: **Rolle, zugänglicher Name, Fokusreihenfolge, Tastaturweg** —
 * und eine Ansage bei jedem Fokuswechsel, damit ein Screenreader-Nutzer die
 * Palette durchhören kann, ohne etwas anzulegen.
 *
 * Aufbau: `role="toolbar"` mit `aria-orientation="vertical"`, darin je Gruppe
 * ein `role="group"` mit Gruppennamen, darin die Knöpfe. Der Tabulator führt
 * **einmal** in die Palette (roving tabindex), die Pfeiltasten bewegen darin,
 * `Escape` führt zurück auf die Zeichenfläche.
 */

import { PALETTE_GROUPS } from "./catalog.js";
import { focusDiagram, RovingFocus } from "./dom.js";
import type { EditorAnnouncer } from "./announce.js";
import type { EditorConfiguration } from "./config.js";
import type { CanvasLike, EventBusLike } from "./types.js";

const GROUP_LABELS = new Map(
  PALETTE_GROUPS.map((group) => [group.id, group.label]),
);

export class PaletteChrome {
  static $inject = ["eventBus", "canvas", "editorConfig", "editorAnnouncer"];

  private container: HTMLElement | null = null;
  private roving: RovingFocus | null = null;

  constructor(
    eventBus: EventBusLike,
    private readonly canvas: CanvasLike,
    private readonly config: EditorConfiguration,
    private readonly announcer: EditorAnnouncer,
  ) {
    eventBus.on("palette.create", (event: { container?: HTMLElement }) => {
      if (event.container) this.attach(event.container);
    });
    // `palette.changed` läuft am Ende jedes Neuaufbaus — die Gruppen und
    // Einträge existieren erst dann.
    eventBus.on("palette.changed", () => {
      this.annotate();
    });
    eventBus.on(["diagram.destroy"], () => {
      this.destroy();
    });
  }

  /** Fokus in die Palette holen (Regionswechsel mit F6). */
  focus(): boolean {
    const entry = this.roving?.focusFirst();
    return entry !== undefined;
  }

  /** Das Wurzelelement der Palette — für Tests und für `axe`. */
  element(): HTMLElement | null {
    return this.container;
  }

  private attach(container: HTMLElement): void {
    this.container = container;
    container.setAttribute("role", "toolbar");
    container.setAttribute("aria-orientation", "vertical");
    container.setAttribute(
      "aria-label",
      this.config.editable
        ? "Elementpalette. Pfeiltasten wählen, Eingabetaste legt an."
        : `Elementpalette (nur Ansicht). ${this.config.disabledReason}`,
    );

    // Der Umschaltknopf des Rahmens ist ein `div` ohne Rolle. Er bekommt keine
    // Rolle, sondern wird für die Hilfstechnik ausgeblendet: seine Funktion
    // (ein-/zweispaltig) ist rein visuell und hat keine Entsprechung in der
    // Tastaturbedienung.
    const toggle = container.querySelector(".djs-palette-toggle");
    toggle?.setAttribute("aria-hidden", "true");

    this.roving = new RovingFocus(container, {
      selector: "button.entry",
      orientation: "both",
      onExit: () => {
        focusDiagram(this.canvas.getContainer());
        this.announcer.announce("Palette verlassen.");
      },
      onFocus: (element) => {
        const label = element.getAttribute("aria-label") ?? "";
        this.announcer.announce(label);
      },
    });
    this.annotate();
  }

  /** Gruppen benennen und den Tabulator-Index neu setzen. */
  private annotate(): void {
    const container = this.container;
    if (!container) return;
    for (const group of Array.from(
      container.querySelectorAll<HTMLElement>("[data-group]"),
    )) {
      const id = group.getAttribute("data-group") ?? "";
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", GROUP_LABELS.get(id) ?? id);
    }
    this.roving?.refresh();
  }

  private destroy(): void {
    this.roving?.destroy();
    this.roving = null;
    this.container = null;
  }
}

export default PaletteChrome;
