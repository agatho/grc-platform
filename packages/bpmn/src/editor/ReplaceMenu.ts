/// <reference lib="dom" />

/**
 * Das Menü zum Typwechsel.
 *
 * **Warum nicht `features/popup-menu` von `diagram-js`.** Der Rahmen ist
 * vorhanden und funktioniert, aber er rendert über die mitgelieferte
 * Preact-Schicht (`diagram-js/lib/ui`). Damit hinge die Zugänglichkeit dieses
 * Menüs — Rolle, Fokusfalle, `aria-activedescendant`, Rückweg des Fokus — an
 * fremdem Markup, das diese Schicht weder prüfen noch ändern kann; und `preact`
 * ist keine deklarierte Abhängigkeit von `@grc/bpmn`. Ein Menü sind 120 Zeilen
 * DOM. Die Zugänglichkeit dafür aus der Hand zu geben, wäre der schlechtere
 * Tausch.
 *
 * Aufbau nach der ARIA-Autorenpraxis für Menüs: `role="menu"` mit
 * `role="menuitem"`-Knöpfen, roving tabindex, `Escape` schließt und gibt den
 * Fokus **an das Element zurück**, von dem aus geöffnet wurde. Der Rückweg des
 * Fokus ist der Teil, den nachgerüstete Menüs regelmäßig vergessen und der
 * einen Tastaturnutzer sonst am Seitenanfang absetzt.
 */

import { replaceOptionsFor } from "./catalog.js";
import { focusDiagram, RovingFocus } from "./dom.js";
import { describe } from "./ElementCreation.js";
import type { EditorAnnouncer } from "./announce.js";
import type {
  BpmnShape,
  CanvasLike,
  EventBusLike,
  ModelingLike,
  ReplaceOption,
  RulesLike,
  SelectionLike,
} from "./types.js";

interface OpenMenu {
  readonly element: BpmnShape;
  readonly node: HTMLElement;
  readonly roving: RovingFocus;
  readonly options: readonly ReplaceOption[];
  readonly returnFocus: HTMLElement | null;
}

export class ReplaceMenu {
  static $inject = [
    "eventBus",
    "canvas",
    "modeling",
    "rules",
    "selection",
    "editorAnnouncer",
  ];

  private open_: OpenMenu | null = null;

  constructor(
    eventBus: EventBusLike,
    private readonly canvas: CanvasLike,
    private readonly modeling: ModelingLike,
    private readonly rules: RulesLike,
    private readonly selection: SelectionLike,
    private readonly announcer: EditorAnnouncer,
  ) {
    eventBus.on(
      ["diagram.clear", "diagram.destroy", "canvas.viewbox.changed"],
      () => {
        this.close(false);
      },
    );
  }

  isOpen(): boolean {
    return this.open_ !== null;
  }

  /** Das Menü im DOM — für Tests und für `axe`. */
  element(): HTMLElement | null {
    return this.open_?.node ?? null;
  }

  /** Die Ziele, die die Regeln für dieses Element zulassen. */
  optionsFor(element: BpmnShape): ReplaceOption[] {
    return replaceOptionsFor(element).filter((option) =>
      Boolean(
        this.rules.allowed("shape.replace", {
          element,
          oldShape: element,
          newData: { type: option.type },
        }),
      ),
    );
  }

  /**
   * Öffnet das Menü neben dem Element.
   *
   * Gibt `false` zurück, wenn es nichts anzubieten gibt — und sagt das an,
   * statt ein leeres Menü zu zeigen.
   */
  openFor(element: BpmnShape): boolean {
    this.close(false);
    const options = this.optionsFor(element);
    if (options.length === 0) {
      this.announcer.reject(
        `Für ${describe(element)} gibt es keinen zulässigen Typwechsel.`,
      );
      return false;
    }

    const container = this.canvas.getContainer();
    const node = document.createElement("div");
    node.className = "arctos-bpmn-replace-menu";
    node.setAttribute("role", "menu");
    node.setAttribute("aria-label", `Typ wechseln für ${describe(element)}`);
    node.style.position = "absolute";
    node.style.zIndex = "120";

    const viewbox = this.canvas.viewbox();
    const scale = viewbox.scale || 1;
    node.style.left = `${String((element.x + element.width - viewbox.x) * scale)}px`;
    node.style.top = `${String((element.y - viewbox.y) * scale)}px`;

    // [ARCTOS-FULL-2026-08-31 · S12-15] Kein `innerHTML`. Die Zeichenketten
    // waren hier escaped, der Befund also kein Loch — aber die repoweite
    // Invariante in apps/web/src/__tests__/security/frontend-invariants.test.ts
    // verbietet das Muster, und zwar zu Recht: eine heute escapte Vorlage ist
    // eine Zeile Refactoring von einer unescapten entfernt. Der Aufbau über
    // createElement/textContent macht die Fehlerklasse unmöglich statt sie zu
    // vermeiden.
    for (const option of options) {
      const entry = document.createElement("button");
      entry.type = "button";
      entry.setAttribute("role", "menuitem");
      entry.className = "entry";
      entry.dataset["replace"] = option.id;
      entry.textContent = option.label;
      node.appendChild(entry);
    }

    node.addEventListener("click", (event) => {
      const target = (event.target as Element | null)?.closest<HTMLElement>(
        "[data-replace]",
      );
      const id = target?.getAttribute("data-replace");
      if (!id) return;
      const option = options.find((candidate) => candidate.id === id);
      if (option) this.apply(element, option);
      event.preventDefault();
      event.stopPropagation();
    });

    const active = container.ownerDocument.activeElement;
    const roving = new RovingFocus(node, {
      selector: "button[role='menuitem']",
      orientation: "vertical",
      onExit: () => {
        this.close(true);
      },
    });

    container.appendChild(node);
    this.open_ = {
      element,
      node,
      roving,
      options,
      returnFocus: active instanceof HTMLElement ? active : null,
    };
    roving.focusFirst();
    this.announcer.announce(
      `Typ wechseln für ${describe(element)}. ${String(options.length)} Möglichkeiten. Pfeiltasten wählen, Escape schließt.`,
    );
    return true;
  }

  /** Führt den Wechsel aus. */
  apply(element: BpmnShape, option: ReplaceOption): BpmnShape | null {
    this.close(false);
    const newData: Record<string, unknown> = {
      type: option.type,
      ...(option.attrs ?? {}),
    };
    if (option.eventDefinitionType !== undefined) {
      newData["eventDefinitionType"] = option.eventDefinitionType;
    }
    if (
      !this.rules.allowed("shape.replace", {
        element,
        oldShape: element,
        newData,
      })
    ) {
      this.announcer.reject(
        `Der Wechsel zu ${option.label} ist für ${describe(element)} nicht zulässig.`,
      );
      return null;
    }
    const replaced = this.modeling.replaceShape(element, newData);
    this.selection.select(replaced);
    this.announcer.announce(
      `Typ gewechselt zu ${option.label}. Die Kennung ${replaced.id} bleibt erhalten.`,
    );
    return replaced;
  }

  /** Schließt das Menü; `restoreFocus` gibt den Fokus an den Ausgangspunkt zurück. */
  close(restoreFocus: boolean): void {
    const open = this.open_;
    if (!open) return;
    this.open_ = null;
    open.roving.destroy();
    open.node.remove();
    if (restoreFocus) {
      if (open.returnFocus && open.returnFocus.isConnected) {
        open.returnFocus.focus();
      } else {
        focusDiagram(this.canvas.getContainer());
      }
      this.announcer.announce("Typwechsel abgebrochen.");
    }
  }
}

export default ReplaceMenu;
