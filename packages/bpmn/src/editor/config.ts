/**
 * `editorConfig` — ein Ort für die zwei Achsen aus Plan §2.4.
 *
 * **Achse 1, der Modus,** wird nicht hier entschieden, sondern durch die
 * Modulliste: `read` registriert die Bearbeitungsmodule schlicht nicht
 * (`src/viewer/modules.ts`, `modulesFor`). Dieser Dienst *liest* das Ergebnis
 * ab — `editable` ist wahr, wenn `modeling` im Container steht — statt es ein
 * zweites Mal zu behaupten. Zwei Wahrheiten über denselben Zustand sind der
 * kürzeste Weg zu einer Palette, die Knöpfe anbietet, die nichts tun.
 *
 * **Achse 2, `chrome`,** ist die Ergänzung, die der Plan verlangt: `full` zeigt
 * Bedienelemente auch dann, wenn nicht bearbeitet werden darf — deaktiviert und
 * mit Begründung, weil ein fehlendes Recht sichtbar sein soll. `minimal` lässt
 * sie weg, weil im Mitarbeiterportal niemand eine dauerhaft graue
 * Werkzeugleiste sehen will.
 */

import { paletteCatalog } from "./catalog.js";
import type { EditorChrome, EditorConfig, PaletteItem } from "./types.js";

interface InjectorLike {
  get<T>(name: string, strict?: boolean): T | null;
}

export const DEFAULT_DISABLED_REASON =
  "Bearbeitung erfordert die Rolle Prozessmodellierer.";

/** Rasterschritt beim Verschieben per Tastatur (Plan: „Rasterschritte"). */
export const DEFAULT_GRID_STEP = 20;
/** Feiner Schritt, wenn Alt gedrückt ist. */
export const DEFAULT_FINE_STEP = 1;

export class EditorConfiguration {
  static $inject = ["injector", "config.editor"];

  readonly chrome: EditorChrome;
  readonly disabledReason: string;
  readonly gridStep: number;
  readonly fineStep: number;
  readonly paletteItems: readonly PaletteItem[];

  private readonly injector: InjectorLike;
  private readonly explicitEditable: boolean | undefined;

  constructor(injector: InjectorLike, config?: EditorConfig | null) {
    this.injector = injector;
    const options = config ?? {};
    this.chrome = options.chrome ?? "full";
    this.disabledReason = options.disabledReason ?? DEFAULT_DISABLED_REASON;
    this.gridStep = options.gridStep ?? DEFAULT_GRID_STEP;
    this.fineStep = options.fineStep ?? DEFAULT_FINE_STEP;
    this.explicitEditable = options.editable;
    this.paletteItems = paletteCatalog({
      items: options.paletteItems,
      exclude: options.hidePaletteItems,
    });
  }

  /**
   * Darf in dieser Instanz bearbeitet werden?
   *
   * Die Antwort steht in der Modulliste, nicht in einer Option: ohne
   * `modeling` gibt es kein Kommando, das etwas ändern könnte.
   */
  get editable(): boolean {
    if (this.explicitEditable !== undefined) return this.explicitEditable;
    return this.injector.get("modeling", false) !== null;
  }

  /** Werden Bedienelemente überhaupt gezeigt? */
  get showsChrome(): boolean {
    return this.editable || this.chrome === "full";
  }
}

export default EditorConfiguration;
