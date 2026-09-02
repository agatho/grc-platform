/// <reference lib="dom" />

/**
 * Die Paletteninhalte.
 *
 * `diagram-js` liefert den Rahmen (`features/palette`) vollständig — Plan §2.2
 * hält das ausdrücklich fest. Was fehlt, sind die BPMN-Inhalte, und die stehen
 * in `catalog.ts`.
 *
 * Zwei Dinge macht dieser Provider anders, als der Rahmen es vorgibt:
 *
 * 1. **Jeder Eintrag ist ein echter `<button>`.** Der Vorgabe-Rahmen erzeugt
 *    `<div class="entry" draggable="true">` mit `title` — für die Maus in
 *    Ordnung, für die Tastatur nicht: kein Fokus, keine Rolle, kein
 *    zugänglicher Name, kein Enter. Der Rahmen sieht `entry.html` genau dafür
 *    vor; hier wird es benutzt.
 * 2. **Anlegen geht auch mit einem Klick**, nicht nur mit Ziehen. Ein
 *    Ziehvorgang ist ohne Zeigegerät nicht nachbildbar; ein Klick ist es. Der
 *    Klick legt das Element an — an das ausgewählte Element angehängt, wenn das
 *    zulässig ist, sonst an eine freie Stelle im sichtbaren Bereich.
 */

import { escapeHtml, focusDiagram } from "./dom";
import type { ElementCreation } from "./ElementCreation";
import type { EditorConfiguration } from "./config";
import type { EditorAnnouncer } from "./announce";
import type {
  BpmnShape,
  CanvasLike,
  PaletteItem,
  SelectionLike,
} from "./types";

interface PaletteLike {
  registerProvider(provider: unknown): void;
}

interface InjectorLike {
  get<T>(name: string, strict?: boolean): T | null;
}

type EntryAction = (event: Event, autoActivate: boolean) => unknown;

interface PaletteEntry {
  action: Record<string, EntryAction>;
  className?: string;
  group?: string;
  html?: string;
  title?: string;
}

export class ArctosPaletteProvider {
  static $inject = [
    "palette",
    "injector",
    "editorConfig",
    "editorAnnouncer",
    "selection",
    "canvas",
  ];

  constructor(
    palette: PaletteLike,
    private readonly injector: InjectorLike,
    private readonly config: EditorConfiguration,
    private readonly announcer: EditorAnnouncer,
    private readonly selection: SelectionLike,
    private readonly canvas: CanvasLike,
  ) {
    palette.registerProvider(this);
  }

  /** Die Einträge des Vorrats, in Gruppen. */
  getPaletteEntries(): Record<string, PaletteEntry> {
    const entries: Record<string, PaletteEntry> = {};
    const editable = this.config.editable;

    for (const item of this.config.paletteItems) {
      entries[item.id] = {
        group: item.group,
        title: titleOf(item, editable, this.config.disabledReason),
        className: item.className ?? "",
        html: markupFor(item, editable, this.config.disabledReason),
        action: editable
          ? {
              click: (event: Event) => {
                this.createByClick(item);
                event.preventDefault();
              },
              dragstart: (event: Event) => {
                this.creation()?.startDrag(event, item);
              },
            }
          : {
              click: (event: Event) => {
                this.announcer.reject(this.config.disabledReason);
                event.preventDefault();
              },
            },
      };
    }
    return entries;
  }

  /**
   * Anlegen per Klick beziehungsweise per Enter/Leertaste.
   *
   * Ist genau ein Knoten ausgewählt und lässt sich der neue Typ daran
   * anhängen, entsteht Knoten **und** Kante — das ist der Schritt, den ein
   * Modellierer sonst zweimal macht, und er ist der Grund, warum ein Diagramm
   * ohne Maus überhaupt zügig entsteht. Sonst wird frei platziert.
   */
  createByClick(item: PaletteItem): BpmnShape | null {
    const creation = this.creation();
    if (!creation) {
      this.announcer.reject(this.config.disabledReason);
      return null;
    }
    const selected = this.selection.get();
    const source =
      selected.length === 1 && isAppendSource(selected[0])
        ? (selected[0] as BpmnShape)
        : undefined;

    let created: BpmnShape | null = null;
    if (
      source &&
      item.type !== "bpmn:Participant" &&
      item.type !== "bpmn:Group"
    ) {
      // Kein Anhängen möglich (eine Regel greift)? Dann frei platzieren, statt
      // die Handlung ganz zu verweigern.
      created = creation.append(source, item).shape;
    }
    created ??= creation.createAt(item).shape;

    // Der Fokus gehört zurück auf die Zeichenfläche: Nach dem Anlegen ist der
    // nächste Schritt (beschriften, verbinden, verschieben) immer einer *am
    // Element*. Bliebe der Fokus in der Palette, müsste ein Tastaturnutzer nach
    // jedem Element den Bereich wechseln.
    if (created) focusDiagram(this.canvas.getContainer());
    return created;
  }

  private creation(): ElementCreation | null {
    return this.injector.get<ElementCreation>("elementCreation", false);
  }
}

export default ArctosPaletteProvider;

function isAppendSource(element: unknown): boolean {
  const shape = element as BpmnShape | undefined;
  if (!shape || typeof shape.width !== "number") return false;
  if (shape.labelTarget !== undefined) return false;
  if (shape.isFrame === true) return false;
  return true;
}

function titleOf(item: PaletteItem, editable: boolean, reason: string): string {
  const base = item.description
    ? `${item.title} — ${item.description}`
    : item.title;
  return editable ? base : `${base} (${reason})`;
}

/**
 * Markup eines Eintrags.
 *
 * `aria-label` trägt Name **und** Kurzbeschreibung, weil ein Symbolknopf ohne
 * Beschriftung sonst nur „Aufgabe" ansagt und der Unterschied zwischen
 * „Aufgabe" und „Benutzeraufgabe" hörbar verschwindet. Das Symbol selbst ist
 * `aria-hidden`, sonst liest der Screenreader den Klassennamen vor.
 *
 * Deaktivierte Einträge bekommen `aria-disabled` statt `disabled`: ein
 * `disabled`-Knopf fällt aus dem Fokus und aus der Ansage — und dann erfährt
 * ein Tastaturnutzer nie, dass es die Funktion gibt und warum sie gerade nicht
 * geht. Genau das soll `chrome="full"` verhindern.
 */
function markupFor(
  item: PaletteItem,
  editable: boolean,
  reason: string,
): string {
  const label = escapeHtml(titleOf(item, editable, reason));
  const disabled = editable ? "" : ' aria-disabled="true"';
  const draggable = editable ? ' draggable="true"' : "";
  return (
    `<button type="button" class="entry djs-palette-entry"${draggable}` +
    ` aria-label="${label}"${disabled}>` +
    `<span class="djs-palette-icon" aria-hidden="true"></span>` +
    `</button>`
  );
}
