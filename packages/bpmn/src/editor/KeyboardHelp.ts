/// <reference lib="dom" />

/**
 * Die Tastaturhilfe (`?`) aus Plan §4.2.
 *
 * **Warum sie zur Bedienung gehört und nicht zur Dokumentation.** Diese Schicht
 * behauptet, ohne Maus vollständig bedienbar zu sein. Eine Belegung, die man
 * nur erfährt, indem man den Quelltext liest, macht diese Zusage wertlos: Wer
 * `c` für „verbinden" nicht kennt, kann nicht verbinden. Genau deshalb ist die
 * Hilfe im Plan neben der Suche aufgeführt und nicht in einem Handbuch.
 *
 * **Die eine Entwurfsentscheidung.** Die Tabelle steht in `KEY_BINDINGS` und
 * ist die **einzige** Quelle: `EditorKeyboard` liest keine zweite Liste, und
 * ein Test hält jede Zeile gegen die Tastenbehandlung. Eine Hilfe, die von der
 * Bedienung abweicht, ist schlimmer als keine — sie schickt den Nutzer auf eine
 * Taste, die nichts tut, und er schließt daraus, dass die Funktion fehlt.
 *
 * Aufbau wie beim Typwechselmenü (`ReplaceMenu`): eigenes DOM statt der
 * Preact-Schicht von `diagram-js`, `role="dialog"` mit `aria-modal`, `Escape`
 * schließt und gibt den Fokus **an die Fläche zurück**.
 */

import { focusDiagram } from "./dom";
import type { EditorAnnouncer } from "./announce";
import type { CanvasLike, EventBusLike } from "./types";

export const HELP_CLASS = "arctos-bpmn-keyboard-help";

export interface KeyBinding {
  /** Die Taste, wie sie ein Mensch nennt. */
  readonly keys: string;
  readonly what: string;
  readonly group: string;
}

/**
 * Die Belegung — eine Zeile je Taste, gruppiert wie die Hilfe sie zeigt.
 *
 * Reihenfolge ist Absicht: erst was man ständig braucht, dann die Modi, dann
 * die Ansichtssachen. Wer die Hilfe zum ersten Mal öffnet, soll oben das
 * finden, was er gerade wollte.
 */
export const KEY_BINDINGS: readonly KeyBinding[] = [
  { group: "Bearbeiten", keys: "F2", what: "Beschriftung bearbeiten" },
  { group: "Bearbeiten", keys: "Entf / Rück", what: "Auswahl löschen" },
  {
    group: "Bearbeiten",
    keys: "Umschalt + Pfeil",
    what: "Auswahl im Raster verschieben",
  },
  {
    group: "Bearbeiten",
    keys: "Umschalt + Alt + Pfeil",
    what: "Auswahl fein verschieben",
  },
  {
    group: "Bearbeiten",
    keys: "Strg + Umschalt + Pfeil",
    what: "Auswahl größer/kleiner",
  },
  { group: "Bearbeiten", keys: "Strg + Z", what: "Rückgängig" },
  {
    group: "Bearbeiten",
    keys: "Strg + Y, Strg + Umschalt + Z",
    what: "Wiederholen",
  },
  {
    group: "Bearbeiten",
    keys: "Strg + C / X / V / D",
    what: "Kopieren / ausschneiden / einfügen / duplizieren",
  },
  { group: "Bearbeiten", keys: "Strg + A", what: "Alles auswählen" },
  {
    group: "Bearbeiten",
    keys: "Strg + Leertaste",
    what: "Fokussiertes Element zur Auswahl hinzunehmen",
  },
  // [ARCTOS-FULL-2026-08-31 · OP-032]
  {
    group: "Bearbeiten",
    keys: "Strg + Umschalt + A",
    what: "Alles im selben Container auswählen (alles in dieser Lane)",
  },
  {
    group: "Bearbeiten",
    keys: "Umschalt + Leertaste",
    what: "Strecke vom Anker bis zum fokussierten Element auswählen",
  },

  {
    group: "Betriebsarten",
    keys: "c",
    what: "Verbinden (Ziele durchblättern, Eingabetaste verbindet)",
  },
  {
    group: "Betriebsarten",
    keys: "m",
    what: "In einen anderen Container legen (Pool, Lane, Subprozess)",
  },
  {
    group: "Betriebsarten",
    keys: "r",
    what: "Typ wechseln — an einer Kante: Anfang umhängen",
  },
  { group: "Betriebsarten", keys: "Umschalt + R", what: "Kantenende umhängen" },
  {
    group: "Betriebsarten",
    keys: "b",
    what: "Stützpunkte einer Kante bearbeiten",
  },
  {
    group: "Betriebsarten",
    keys: "Escape",
    what: "Betriebsart oder Menü abbrechen",
  },

  // [ARCTOS-FULL-2026-08-31 · OP-031]
  {
    group: "Werkzeuge",
    keys: "h",
    what: "Hand-Werkzeug: Ansicht ziehen (Tastatur: Strg + Pfeil)",
  },
  {
    group: "Werkzeuge",
    keys: "l",
    what: "Lasso-Werkzeug: Rahmenauswahl (Tastatur: Strg + Umschalt + A)",
  },
  {
    group: "Werkzeuge",
    keys: "s",
    what: "Platz schaffen: mit Pfeiltasten ab dem fokussierten Element",
  },

  { group: "Finden und Bewegen", keys: "/", what: "Im Diagramm suchen" },
  // [ARCTOS-FULL-2026-08-31 · OP-018]
  {
    group: "Finden und Bewegen",
    keys: "o",
    what: "Ebene eines Subprozesses öffnen (Drill-Down)",
  },
  {
    group: "Finden und Bewegen",
    keys: "Umschalt + O",
    what: "Eine Ebene zurück",
  },
  {
    group: "Finden und Bewegen",
    keys: "F6 / Umschalt + F6",
    what: "Bereich wechseln: Fläche ↔ Palette",
  },
  {
    group: "Finden und Bewegen",
    keys: "Umschalt + F10, Kontextmenü",
    what: "Kontextmenü am Element öffnen",
  },
  {
    group: "Finden und Bewegen",
    keys: "g",
    what: "Einrasten am Raster umschalten",
  },
  { group: "Finden und Bewegen", keys: "?", what: "Diese Hilfe" },
];

interface OpenHelp {
  readonly node: HTMLElement;
  readonly onKeyDown: (event: KeyboardEvent) => void;
}

export class KeyboardHelp {
  static $inject = ["eventBus", "canvas", "editorAnnouncer"];

  private open_: OpenHelp | null = null;

  constructor(
    eventBus: EventBusLike,
    private readonly canvas: CanvasLike,
    private readonly announcer: EditorAnnouncer,
  ) {
    eventBus.on(["diagram.clear", "diagram.destroy"], () => {
      this.close(false);
    });
  }

  isOpen(): boolean {
    return this.open_ !== null;
  }

  /** Der Dialog im DOM — für Tests und für `axe`. */
  element(): HTMLElement | null {
    return this.open_?.node ?? null;
  }

  toggle(): void {
    if (this.open_) this.close();
    else this.open();
  }

  open(): void {
    if (this.open_) return;
    const container = this.canvas.getContainer();
    const node = container.ownerDocument.createElement("div");
    node.className = HELP_CLASS;
    node.setAttribute("role", "dialog");
    node.setAttribute("aria-modal", "true");
    node.setAttribute("aria-label", "Tastaturbedienung");
    node.tabIndex = -1;
    // [ARCTOS-FULL-2026-08-31 · S12-15] Kein `innerHTML` — dieselbe Auflage
    // wie im Typwechselmenü. Die Texte hier sind zwar Konstanten dieser Datei
    // und keine Fremdeingabe, aber eine Ausnahme von der Regel „kein
    // HTML-Einfüllpunkt im Baum" wäre genau die Ausnahme, an der sich der
    // nächste Beitrag orientiert. `createElement`/`textContent` macht die
    // Fehlerklasse unmöglich, statt sie zu bewachen.
    for (const section of buildHelp(node.ownerDocument, KEY_BINDINGS)) {
      node.appendChild(section);
    }
    container.appendChild(node);

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" || event.key === "?") {
        event.preventDefault();
        event.stopPropagation();
        this.close();
      }
    };
    node.addEventListener("keydown", onKeyDown);
    node.focus();
    this.open_ = { node, onKeyDown };
    this.announcer.announce(
      `Tastaturhilfe geöffnet, ${String(KEY_BINDINGS.length)} Tastenkürzel. Escape schließt.`,
    );
  }

  close(returnFocus = true): void {
    const open = this.open_;
    if (!open) return;
    this.open_ = null;
    open.node.removeEventListener("keydown", open.onKeyDown);
    open.node.remove();
    if (returnFocus) {
      focusDiagram(this.canvas.getContainer());
      this.announcer.announce("Tastaturhilfe geschlossen.");
    }
  }
}

export default KeyboardHelp;

/**
 * Der DOM der Hilfe — Überschrift plus eine Definitionsliste je Gruppe.
 *
 * `dt` trägt die Taste, `dd` die Wirkung; das ist die Struktur, die ein
 * Screenreader als Paar vorliest. Eine Tabelle müsste dafür zwei
 * Spaltenüberschriften mitschleppen, die nichts sagen („Taste", „Wirkung").
 *
 * Als freie Funktion mit ausdrücklichem `Document`, damit ein Test sie ohne
 * Editor-Instanz aufrufen kann — und damit sichtbar bleibt, dass hier
 * **Knoten** entstehen und kein Markup.
 */
export function buildHelp(
  doc: Document,
  bindings: readonly KeyBinding[],
): HTMLElement[] {
  const groups = new Map<string, KeyBinding[]>();
  for (const binding of bindings) {
    const list = groups.get(binding.group) ?? [];
    list.push(binding);
    groups.set(binding.group, list);
  }

  const heading = doc.createElement("h2");
  heading.textContent = "Tastaturbedienung";
  const out: HTMLElement[] = [heading];

  for (const [group, list] of groups) {
    const section = doc.createElement("section");
    const title = doc.createElement("h3");
    title.textContent = group;
    section.appendChild(title);

    const dl = doc.createElement("dl");
    for (const binding of list) {
      const row = doc.createElement("div");
      row.className = `${HELP_CLASS}-row`;
      const dt = doc.createElement("dt");
      const kbd = doc.createElement("kbd");
      kbd.textContent = binding.keys;
      dt.appendChild(kbd);
      const dd = doc.createElement("dd");
      dd.textContent = binding.what;
      row.append(dt, dd);
      dl.appendChild(row);
    }
    section.appendChild(dl);
    out.push(section);
  }
  return out;
}
