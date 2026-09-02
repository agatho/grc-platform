/// <reference lib="dom" />

import type { Scene } from "../draw/scene";
import { getAriaRole, getLabelText, getTypeLabel } from "../draw/semantic";
import type { BpmnShape } from "../draw/types";
import {
  buildGraphOrder,
  findContainerLabel,
  type GraphNode,
  type GraphOrder,
} from "./order";

/**
 * Barrierefreiheit der Diagrammfläche (Plan §4.2).
 *
 * Audit-Finding S14-10 hielt fest: im heutigen BPMN-Modul gibt es in allen sechs
 * Dateien **kein** `aria-*`, `role`, `tabIndex` oder Tastatur-Handler. Diese
 * Klasse ist die Antwort darauf — und sie sitzt bewusst *in* der Engine, nicht
 * als React-Nachrüstung daneben, damit der zugängliche Name zentral aus dem
 * Modell entsteht und nicht an zwanzig Aufrufstellen vergessen werden kann.
 *
 * Fokusmodell: der Canvas ist **ein** Tabstopp (`role="application"`,
 * `tabindex=0`); innerhalb wandert ein *roving tabindex* über die
 * Diagrammelemente in topologischer Ordnung (`order.ts`).
 */

export interface A11yHost {
  /** Das umgebende DOM-Element, das den Tabstopp trägt. */
  readonly container: HTMLElement;
  /** Grafik eines Elements (die äußere `g.djs-element`). */
  getGraphics(elementId: string): SVGElement | null;
  /** Selektion setzen (Selektion ≠ Fokus). */
  select(elementId: string | null): void;
  /** Element in den sichtbaren Bereich holen. */
  reveal(elementId: string): void;
  zoom(step: "in" | "out" | "fit"): void;
  pan(dx: number, dy: number): void;
  /** Wird bei `Enter` ausgelöst — die Anwendung öffnet ihr Seitenpanel. */
  activate(elementId: string): void;
}

export interface GraphA11yOptions {
  /** Zugänglicher Name der Fläche. */
  readonly label?: string;
  /** Schrittweite beim Verschieben per Tastatur. */
  readonly panStep?: number;
}

const PAN_STEP = 60;

export class GraphA11y {
  private order: GraphOrder;
  private scene: Scene;
  private cursor = 0;
  /** Erst nach dem ersten Tastendruck steht der Fokus auf einem Element. */
  private cursorPlaced = false;
  private liveRegion: HTMLElement | null = null;
  private readonly onKeyDown: (event: KeyboardEvent) => void;
  private destroyed = false;

  constructor(
    private readonly host: A11yHost,
    scene: Scene,
    private readonly options: GraphA11yOptions = {},
  ) {
    this.scene = scene;
    this.order = buildGraphOrder(scene);
    this.onKeyDown = (event) => {
      this.handleKey(event);
    };
    this.attach();
  }

  /** Nach einem Neuimport: Ordnung und ARIA-Namen neu aufbauen. */
  update(scene: Scene): void {
    this.scene = scene;
    this.order = buildGraphOrder(scene);
    this.cursor = 0;
    this.cursorPlaced = false;
    this.annotate();
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.host.container.removeEventListener("keydown", this.onKeyDown);
    this.liveRegion?.remove();
    this.liveRegion = null;
  }

  /** Anzahl navigierbarer Elemente. */
  get size(): number {
    return this.order.nodes.length;
  }

  /** Das aktuell fokussierte Element, sofern der Fokus gesetzt wurde. */
  get focused(): GraphNode | undefined {
    return this.cursorPlaced ? this.order.nodes[this.cursor] : undefined;
  }

  private attach(): void {
    const container = this.host.container;
    container.setAttribute("role", "application");
    container.setAttribute("aria-roledescription", "BPMN-Prozessdiagramm");
    container.setAttribute(
      "aria-label",
      this.options.label ??
        "Prozessdiagramm. Pfeiltasten bewegen den Fokus zwischen den Elementen.",
    );
    if (!container.hasAttribute("tabindex")) {
      container.tabIndex = 0;
    }
    container.addEventListener("keydown", this.onKeyDown);

    const live = document.createElement("div");
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    live.setAttribute("aria-atomic", "true");
    live.className = "arctos-bpmn-live";
    // Für Screenreader sichtbar, visuell nicht — ohne auf ein Stylesheet zu bauen.
    live.style.position = "absolute";
    live.style.width = "1px";
    live.style.height = "1px";
    live.style.overflow = "hidden";
    live.style.clip = "rect(0 0 0 0)";
    live.style.whiteSpace = "nowrap";
    container.appendChild(live);
    this.liveRegion = live;

    this.annotate();
  }

  /** Setzt `role` und zugänglichen Namen auf die SVG-Knoten. */
  annotate(): void {
    for (const node of this.order.nodes) {
      const graphics = this.host.getGraphics(node.shape.id);
      if (!graphics) {
        continue;
      }
      graphics.setAttribute("role", getAriaRole(node.shape));
      graphics.setAttribute("aria-label", this.describe(node, { short: true }));
      // Bewusst *ohne* `aria-posinset`/`aria-setsize`: die sind nur an
      // Listen-, Options-, Zeilen- und Tab-Rollen erlaubt (ARIA 1.2), nicht an
      // `button`/`img` — axe meldet das zu Recht als `aria-allowed-attr`. Die
      // Position wird stattdessen angesagt (Live-Region) und steht in der
      // Textalternative; `data-order` trägt sie maschinenlesbar mit.
      graphics.setAttribute("tabindex", "-1");
      graphics.setAttribute("data-order", String(node.index));
    }
    for (const connection of this.scene.connections) {
      const graphics = this.host.getGraphics(connection.id);
      if (!graphics) {
        continue;
      }
      graphics.setAttribute("role", "img");
      const name = getLabelText(connection);
      const from = connection.source
        ? getLabelText(connection.source) || connection.source.id
        : "?";
      const to = connection.target
        ? getLabelText(connection.target) || connection.target.id
        : "?";
      graphics.setAttribute(
        "aria-label",
        name
          ? `${getTypeLabel(connection.type)} „${name}“ von ${from} nach ${to}`
          : `${getTypeLabel(connection.type)} von ${from} nach ${to}`,
      );
    }
  }

  /** Satz für die Live-Region bzw. das `aria-label`. */
  describe(node: GraphNode, options: { short?: boolean } = {}): string {
    const shape = node.shape;
    const name = getLabelText(shape);
    const typeLabel = getTypeLabel(shape.type);
    const parts: string[] = [
      name ? `${typeLabel} „${name}“` : `${typeLabel} ohne Namen (${shape.id})`,
    ];

    if (!options.short) {
      parts.push(
        `Schritt ${String(node.index)} von ${String(this.order.nodes.length)}`,
      );
      const container = findContainerLabel(this.scene, shape);
      if (container) {
        parts.push(`Lane ${container}`);
      }
    }

    if (node.outgoing.length > 1) {
      const branches = node.outgoing
        .map((connection) => {
          const label = getLabelText(connection);
          if (label) {
            return `„${label}“`;
          }
          const target = connection.target;
          return target
            ? `„${getLabelText(target) || target.id}“`
            : "unbenannt";
        })
        .join(", ");
      parts.push(
        `${String(node.outgoing.length)} ausgehende Pfade: ${branches}`,
      );
    } else if (node.outgoing.length === 0 && !options.short) {
      parts.push("kein ausgehender Pfad");
    }

    return `${parts.join(". ")}.`;
  }

  announce(message: string): void {
    if (this.liveRegion) {
      this.liveRegion.textContent = message;
    }
  }

  /** Fokussiert das Element an Position `index` (0-basiert). */
  focusIndex(index: number): void {
    if (this.order.nodes.length === 0) {
      return;
    }
    const bounded = Math.max(0, Math.min(index, this.order.nodes.length - 1));
    const node = this.order.nodes[bounded];
    if (!node) {
      return;
    }
    this.cursor = bounded;
    this.cursorPlaced = true;

    for (const other of this.order.nodes) {
      const graphics = this.host.getGraphics(other.shape.id);
      graphics?.setAttribute("tabindex", other === node ? "0" : "-1");
    }

    const graphics = this.host.getGraphics(node.shape.id);
    if (
      graphics &&
      typeof (graphics as unknown as HTMLElement).focus === "function"
    ) {
      (graphics as unknown as HTMLElement).focus();
    }
    this.host.reveal(node.shape.id);
    this.announce(this.describe(node));
  }

  focusElement(elementId: string): void {
    const node = this.order.byId.get(elementId);
    if (node) {
      this.focusIndex(node.index - 1);
    }
  }

  private handleKey(event: KeyboardEvent): void {
    const step = this.options.panStep ?? PAN_STEP;
    const panning = event.ctrlKey || event.altKey || event.metaKey;

    switch (event.key) {
      case "ArrowRight":
        if (panning) {
          this.host.pan(-step, 0);
        } else {
          this.focusIndex(this.cursorPlaced ? this.cursor + 1 : 0);
        }
        break;
      case "ArrowLeft":
        if (panning) {
          this.host.pan(step, 0);
        } else {
          this.focusIndex(this.cursorPlaced ? this.cursor - 1 : 0);
        }
        break;
      case "ArrowDown":
        if (panning) {
          this.host.pan(0, -step);
        } else {
          this.followBranch(1);
        }
        break;
      case "ArrowUp":
        if (panning) {
          this.host.pan(0, step);
        } else {
          this.followBranch(-1);
        }
        break;
      case "Home":
      case "0":
        this.host.zoom("fit");
        this.announce("Ansicht eingepasst.");
        break;
      case "+":
      case "=":
        this.host.zoom("in");
        break;
      case "-":
        this.host.zoom("out");
        break;
      case " ": {
        const node = this.focused;
        if (node) {
          this.host.select(node.shape.id);
          this.announce(`${this.describe(node, { short: true })} ausgewählt.`);
        }
        break;
      }
      case "Enter": {
        const node = this.focused;
        if (node) {
          this.host.activate(node.shape.id);
        }
        break;
      }
      case "Escape":
        this.host.container.focus();
        this.announce("Diagramm verlassen.");
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * `↓`/`↑` an einer Verzweigung: zwischen den ausgehenden Zweigen wechseln.
   * Ohne Verzweigung fällt die Taste auf „nächstes/voriges Element" zurück.
   */
  private followBranch(direction: 1 | -1): void {
    if (!this.cursorPlaced) {
      this.focusIndex(0);
      return;
    }
    const node = this.focused;
    if (!node || node.outgoing.length < 2) {
      this.focusIndex(this.cursor + direction);
      return;
    }
    const targets: BpmnShape[] = node.outgoing
      .map((connection) => connection.target)
      .filter((target): target is BpmnShape => target !== undefined)
      .sort((a, b) => a.y - b.y || a.x - b.x);

    const currentTargetIndex = targets.findIndex(
      (target) => this.order.byId.get(target.id)?.index === this.cursor + 2,
    );
    const nextIndex =
      currentTargetIndex === -1
        ? direction === 1
          ? 0
          : targets.length - 1
        : (currentTargetIndex + direction + targets.length) % targets.length;

    const target = targets[nextIndex];
    if (target) {
      this.focusElement(target.id);
    }
  }
}
