/// <reference lib="dom" />

/**
 * Kleine DOM-Helfer der Editor-Schicht.
 *
 * Zwei Dinge stehen hier, weil sie sonst an sechs Stellen leicht verschieden
 * geraten würden: das **Escapen** von Text, der in ein Attribut wandert, und
 * das **Wandern des Fokus** in einer Werkzeugleiste (roving tabindex).
 *
 * Zum roving tabindex: In einer Werkzeugleiste ist genau *ein* Knopf im
 * Tabulator-Fluss; die Pfeiltasten bewegen den Fokus innerhalb. Das ist die
 * ARIA-Autorenpraxis für `role="toolbar"` und `role="menu"` und der Grund,
 * warum eine Palette mit 17 Einträgen den Tabulator-Fluss der Seite nicht um 17
 * Stationen verlängert.
 */

const ENTITIES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Text, der in ein HTML-Attribut oder in Textinhalt geschrieben wird. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ENTITIES[char] ?? char);
}

export interface RovingFocusOptions {
  /** Auswahl der Bedienelemente innerhalb des Containers. */
  readonly selector: string;
  /** `vertical` bewegt mit ↑/↓, `horizontal` mit ←/→, `both` mit allen vieren. */
  readonly orientation?: "vertical" | "horizontal" | "both";
  /** Wird gerufen, wenn `Escape` den Bereich verlässt. */
  readonly onExit?: () => void;
  /** Wird bei jedem Fokuswechsel gerufen — für die Ansage. */
  readonly onFocus?: (element: HTMLElement, index: number) => void;
  /**
   * Auslösen mit `Enter`/`Leertaste`.
   *
   * Ein Browser tut das bei einem `<button>` von selbst. Es wird trotzdem
   * **hier** getan — mit `preventDefault`, damit es nicht zweimal geschieht —,
   * weil die Tastaturbedienung sonst nur in einer Umgebung geprüft werden
   * könnte, die diese Synthese mitbringt. jsdom tut es nicht, und eine
   * Zusicherung „ohne Maus baubar", die im Test an der Maus hängt, ist keine.
   */
  readonly activate?: (element: HTMLElement) => void;
}

/**
 * Verwaltet den wandernden Tabulator-Index in einem Container.
 *
 * Absichtlich ohne Zustand außerhalb des DOM: die Einträge werden bei jedem
 * Tastendruck frisch gelesen, weil Palette und Kontextmenü ihren Inhalt
 * jederzeit neu aufbauen können.
 */
export class RovingFocus {
  private readonly onKeyDown: (event: KeyboardEvent) => void;
  private destroyed = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly options: RovingFocusOptions,
  ) {
    this.onKeyDown = (event) => {
      this.handleKey(event);
    };
    container.addEventListener("keydown", this.onKeyDown);
    this.refresh();
  }

  /** Nach einem Neuaufbau des Inhalts: Tabulator-Indizes wieder setzen. */
  refresh(): void {
    const entries = this.entries();
    entries.forEach((entry, index) => {
      entry.tabIndex = index === 0 ? 0 : -1;
    });
  }

  entries(): HTMLElement[] {
    return Array.from(
      this.container.querySelectorAll<HTMLElement>(this.options.selector),
    );
  }

  /** Fokussiert den Eintrag an Position `index` (0-basiert, geklammert). */
  focusIndex(index: number): HTMLElement | undefined {
    const entries = this.entries();
    if (entries.length === 0) return undefined;
    const bounded =
      ((index % entries.length) + entries.length) % entries.length;
    const target = entries[bounded];
    if (!target) return undefined;
    for (const entry of entries) {
      entry.tabIndex = entry === target ? 0 : -1;
    }
    target.focus();
    this.options.onFocus?.(target, bounded);
    return target;
  }

  focusFirst(): HTMLElement | undefined {
    return this.focusIndex(0);
  }

  private currentIndex(): number {
    const entries = this.entries();
    const active = this.container.ownerDocument.activeElement;
    const index = entries.findIndex((entry) => entry === active);
    return index === -1 ? 0 : index;
  }

  private handleKey(event: KeyboardEvent): void {
    if (this.destroyed) return;
    const orientation = this.options.orientation ?? "vertical";
    const vertical = orientation === "vertical" || orientation === "both";
    const horizontal = orientation === "horizontal" || orientation === "both";

    let delta = 0;
    switch (event.key) {
      case "ArrowDown":
        if (!vertical) return;
        delta = 1;
        break;
      case "ArrowUp":
        if (!vertical) return;
        delta = -1;
        break;
      case "ArrowRight":
        if (!horizontal) return;
        delta = 1;
        break;
      case "ArrowLeft":
        if (!horizontal) return;
        delta = -1;
        break;
      case "Home":
        this.focusIndex(0);
        event.preventDefault();
        event.stopPropagation();
        return;
      case "End":
        this.focusIndex(this.entries().length - 1);
        event.preventDefault();
        event.stopPropagation();
        return;
      case "Escape":
        this.options.onExit?.();
        event.preventDefault();
        event.stopPropagation();
        return;
      case "Enter":
      case " ": {
        const active = this.container.ownerDocument.activeElement;
        if (
          !(active instanceof HTMLElement) ||
          !this.container.contains(active)
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const activate =
          this.options.activate ??
          ((node: HTMLElement) => {
            node.click();
          });
        activate(active);
        return;
      }
      default:
        return;
    }
    this.focusIndex(this.currentIndex() + delta);
    event.preventDefault();
    event.stopPropagation();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.container.removeEventListener("keydown", this.onKeyDown);
  }
}

/**
 * Fokus zurück auf die Zeichenfläche.
 *
 * Der Container, den `canvas.getContainer()` liefert, ist ein `<div>` ohne
 * `tabindex` — `focus()` darauf tut **nichts**, weder im Browser noch in
 * jsdom. Den Tabstopp trägt der äußere Container (`GraphA11y` setzt ihn,
 * `src/viewer/a11y.ts`), und der ist ein Vorfahr. Deshalb wird aufwärts nach
 * dem fokussierbaren Element gesucht.
 *
 * Findet sich keines — der Editor läuft ohne Betrachterschicht —, bekommt der
 * Canvas-Container `tabindex="-1"`. Das macht ihn programmatisch fokussierbar,
 * **ohne** einen zweiten Tabstopp in die Seite zu setzen.
 */
export function focusDiagram(container: HTMLElement): HTMLElement {
  let node: HTMLElement | null = container;
  while (node) {
    if (node.hasAttribute("tabindex")) {
      node.focus();
      return node;
    }
    node = node.parentElement;
  }
  container.tabIndex = -1;
  container.focus();
  return container;
}

/** Ist `node` innerhalb eines Text-Eingabefelds? */
export function isTextInput(node: EventTarget | null): boolean {
  if (!(node instanceof Element)) return false;
  const name = node.tagName.toLowerCase();
  if (name === "textarea" || name === "input" || name === "select") return true;
  return (node as HTMLElement).isContentEditable === true;
}
