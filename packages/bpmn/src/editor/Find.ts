/// <reference lib="dom" />

/**
 * Suche im Diagramm (Plan §4.2: „Suche mit `/`").
 *
 * **Wozu.** Ein Diagramm mit 60 Aktivitäten hat keine Gliederung, an der man
 * sich entlanghangeln könnte; die Graphnavigation des Betrachters führt Schritt
 * für Schritt am Kontrollfluss entlang, und das ist genau dann zu langsam, wenn
 * man weiß, wohin man will. Die Suche ist deshalb kein Komfort, sondern die
 * einzige *sprungfähige* Bedienung, die diese Schicht kennt — und ohne Maus die
 * einzige überhaupt.
 *
 * **Aufbau.** Ein Eingabefeld mit `role="searchbox"` über der Fläche, ein Live-
 * Ergebniszähler, `Enter` springt zum nächsten Treffer, `Umschalt+Enter` zum
 * vorigen, `Escape` schließt und gibt den Fokus an die Fläche zurück. Getroffen
 * wird auf **Name und Kennung**, nach Groß-/Kleinschreibung und Akzenten
 * normalisiert: wer „prufung" tippt, meint „Prüfung", und ein Werkzeug, das
 * darauf besteht, ist keines.
 *
 * **Was die Suche nicht tut.** Sie blendet nichts aus und ändert nichts. Sie
 * wählt den Treffer aus, rückt ihn in den sichtbaren Bereich und sagt ihn an —
 * dieselben drei Dinge, die auch ein Klick täte. Damit gibt es keinen Zustand,
 * aus dem man sie wieder herausholen müsste.
 */

import { getTypeLabel } from "../draw/semantic";
import type { EditorAnnouncer } from "./announce";
import { describe } from "./ElementCreation";
import { focusDiagram } from "./dom";
import type {
  BpmnElement,
  BpmnShape,
  CanvasLike,
  ElementRegistryLike,
  EventBusLike,
  SelectionLike,
} from "./types";
import { visibleElements } from "./visibility";

export const FIND_CLASS = "arctos-bpmn-find";

interface OpenFind {
  readonly node: HTMLElement;
  readonly input: HTMLInputElement;
  readonly status: HTMLElement;
  matches: readonly BpmnElement[];
  index: number;
}

/**
 * Normalform für den Vergleich: Kleinschreibung, Akzente entfernt,
 * Leerraum zusammengezogen.
 *
 * `normalize("NFD")` zerlegt „ü" in „u" + Diakritikum, das Ersetzen entfernt
 * das Diakritikum. Ohne diesen Schritt findet „prufung" das „Prüfung" nicht,
 * und in einem deutschsprachigen Diagramm ist das der Regelfall, nicht der
 * Sonderfall.
 */
export function searchKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .trim();
}

/** Der Text, in dem gesucht wird: Name, Kennung, Typbezeichnung. */
export function haystack(element: BpmnElement): string {
  const bo = element.businessObject as
    { name?: unknown; $type?: unknown } | undefined;
  const name = typeof bo?.name === "string" ? bo.name : "";
  const type = getTypeLabel(
    typeof bo?.$type === "string" ? bo.$type : (element.type ?? ""),
  );
  return searchKey(`${name} ${element.id} ${type}`);
}

/**
 * Die Treffer zu einer Anfrage, in Lesereihenfolge.
 *
 * Als freie Funktion, damit ein Test sie ohne DOM prüfen kann — die Auswahl
 * der Treffer ist die eigentliche Aussage dieser Datei, das Eingabefeld ist
 * nur ihre Bedienung.
 */
export function matchesFor(
  elements: readonly BpmnElement[],
  query: string,
): BpmnElement[] {
  const key = searchKey(query);
  if (key === "") return [];
  return elements
    .filter((element) => {
      if ((element as BpmnShape).labelTarget !== undefined) return false;
      if (element.parent === undefined) return false;
      return haystack(element).includes(key);
    })
    .sort((a, b) => {
      const sa = a as BpmnShape;
      const sb = b as BpmnShape;
      const ya = typeof sa.y === "number" ? sa.y : 0;
      const yb = typeof sb.y === "number" ? sb.y : 0;
      const xa = typeof sa.x === "number" ? sa.x : 0;
      const xb = typeof sb.x === "number" ? sb.x : 0;
      return ya - yb || xa - xb || a.id.localeCompare(b.id);
    });
}

export class DiagramFind {
  static $inject = [
    "eventBus",
    "canvas",
    "elementRegistry",
    "selection",
    "editorAnnouncer",
  ];

  private open_: OpenFind | null = null;

  constructor(
    eventBus: EventBusLike,
    private readonly canvas: CanvasLike,
    private readonly elementRegistry: ElementRegistryLike,
    private readonly selection: SelectionLike,
    private readonly announcer: EditorAnnouncer,
  ) {
    eventBus.on(["diagram.clear", "diagram.destroy"], () => {
      this.close(false);
    });
  }

  isOpen(): boolean {
    return this.open_ !== null;
  }

  /** Das Eingabefeld im DOM — für Tests und für `axe`. */
  element(): HTMLElement | null {
    return this.open_?.node ?? null;
  }

  /** Die aktuellen Treffer — für Tests und für die Ansage. */
  matches(): readonly BpmnElement[] {
    return this.open_?.matches ?? [];
  }

  current(): BpmnElement | undefined {
    const open = this.open_;
    return open ? open.matches[open.index] : undefined;
  }

  // -------------------------------------------------------------------------

  open(): void {
    if (this.open_) {
      this.open_.input.focus();
      this.open_.input.select();
      return;
    }
    const container = this.canvas.getContainer();
    const doc = container.ownerDocument;
    const node = doc.createElement("div");
    node.className = FIND_CLASS;
    node.setAttribute("role", "search");

    // [ARCTOS-FULL-2026-08-31 · S12-15] Kein `innerHTML`, wie im
    // Typwechselmenü und in der Tastaturhilfe: kein HTML-Einfüllpunkt im Baum,
    // auch nicht für Konstanten.
    const label = doc.createElement("label");
    label.className = `${FIND_CLASS}-label`;
    label.htmlFor = `${FIND_CLASS}-input`;
    label.textContent = "Im Diagramm suchen";

    const input = doc.createElement("input");
    input.id = `${FIND_CLASS}-input`;
    input.className = `${FIND_CLASS}-input`;
    input.type = "search";
    input.autocomplete = "off";
    input.setAttribute("aria-describedby", `${FIND_CLASS}-status`);

    const status = doc.createElement("span");
    status.id = `${FIND_CLASS}-status`;
    status.className = `${FIND_CLASS}-status`;
    status.setAttribute("aria-live", "polite");

    node.append(label, input, status);
    container.appendChild(node);

    const open: OpenFind = { node, input, status, matches: [], index: 0 };
    this.open_ = open;

    open.input.addEventListener("input", () => {
      this.recompute();
    });
    open.input.addEventListener("keydown", (event) => {
      this.onKeyDown(event as KeyboardEvent);
    });
    open.input.focus();
    this.announcer.announce(
      "Suche geöffnet. Eingabetaste springt zum nächsten Treffer, Umschalt+Eingabetaste zum vorigen, Escape schließt.",
    );
  }

  close(returnFocus = true): void {
    const open = this.open_;
    if (!open) return;
    this.open_ = null;
    open.node.remove();
    if (returnFocus) {
      focusDiagram(this.canvas.getContainer());
      this.announcer.announce("Suche geschlossen.");
    }
  }

  /** Zum nächsten (`1`) oder vorigen (`-1`) Treffer springen. */
  step(direction: 1 | -1): void {
    const open = this.open_;
    if (!open || open.matches.length === 0) return;
    open.index =
      (open.index + direction + open.matches.length) % open.matches.length;
    this.reveal();
  }

  // -------------------------------------------------------------------------

  private onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      this.step(event.shiftKey ? -1 : 1);
      return;
    }
    // Alles andere gehört dem Eingabefeld; es darf nicht als Editortaste
    // durchschlagen — sonst löschte `Entf` beim Tippen das ausgewählte Element.
    event.stopPropagation();
  }

  private recompute(): void {
    const open = this.open_;
    if (!open) return;
    const query = open.input.value;
    // [ARCTOS-FULL-2026-08-31 · OP-033] Kein Treffer, den man nicht sehen
    // kann. Sobald es einen Drill-down in Subprozesse gibt (OP-018), gehört
    // die Suche zurückgedreht — dann soll sie finden UND die Ebene öffnen;
    // die Begründung steht im Kopf von `visibility.ts`.
    open.matches = matchesFor(visibleElements(this.elementRegistry), query);
    open.index = 0;
    const count = open.matches.length;
    open.status.textContent =
      query.trim() === ""
        ? ""
        : count === 0
          ? "kein Treffer"
          : count === 1
            ? "1 Treffer"
            : `${String(count)} Treffer`;
    if (count > 0) this.reveal();
  }

  /** Treffer auswählen, in den Blick rücken, ansagen. */
  private reveal(): void {
    const open = this.open_;
    const element = this.current();
    if (!open || !element) return;
    this.selection.select(element);
    try {
      (
        this.canvas as unknown as {
          scrollToElement?: (element: unknown) => void;
        }
      ).scrollToElement?.(element);
    } catch {
      // Ohne Viewport (jsdom, Export) gibt es nichts zu scrollen.
    }
    this.announcer.announce(
      `Treffer ${String(open.index + 1)} von ${String(open.matches.length)}: ${describe(element)}.`,
    );
  }
}

export default DiagramFind;

/** Nur intern gebraucht, aber getestet: Text für den Zähler. */
export function countText(count: number): string {
  return count === 0
    ? "kein Treffer"
    : count === 1
      ? "1 Treffer"
      : `${String(count)} Treffer`;
}
