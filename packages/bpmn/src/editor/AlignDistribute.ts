/// <reference lib="dom" />

/**
 * Ausrichten, Verteilen, Raster, Einrasten — verdrahtet, nicht nachgebaut.
 *
 * `diagram-js` liefert `align-elements`, `distribute-elements`, `snapping` und
 * `grid-snapping` fertig; der Auftrag lautet ausdrücklich „soweit `diagram-js`
 * das mitbringt, nur verdrahten". Was hier entsteht, ist deshalb wenig Code und
 * hat zwei Aufgaben:
 *
 * 1. **Eine Bedienfläche mit Ansage.** Die Dienste von `diagram-js` haben kein
 *    Ergebnis und keine Meldung; ein Tastaturnutzer erführe sonst nicht, ob
 *    „ausrichten" etwas getan hat.
 * 2. **Das Raster zum Umschalten.** `gridSnapping.setActive` ist vorhanden,
 *    aber ohne Bedienweg.
 *
 * **Was hier nicht mehr steht: die Regeln.** `elements.align`,
 * `elements.distribute` und `element.copy` fehlten in `BpmnRules` — und weil
 * `CommandStack.canExecute` für ein Kommando **ohne Handler** hart `false`
 * liefert, war die Wirkung nicht „alles erlaubt", sondern **„nichts
 * erlaubt"**: Ausrichten, Verteilen und die gesamte Zwischenablage blieben
 * stumm wirkungslos. Der Befund (`STUFE2-B1-EDITOR.md` §6, Punkt 1) ist
 * behoben; die drei Regeln stehen jetzt in `src/modeling/BpmnRules.ts`, wo sie
 * fachlich hingehören. {@link isAlignable} ist von dort übernommen statt hier
 * ein zweites Mal formuliert — dieselbe Funktion, ein Name.
 */

import { canAlign } from "../modeling/BpmnRules";
import type { EditorAnnouncer } from "./announce";
import type {
  Alignment,
  AlignElementsLike,
  BpmnElement,
  DistributeElementsLike,
  GridSnappingLike,
  SelectionLike,
} from "./types";

/**
 * Was sich ausrichten und verteilen lässt — die Antwort der
 * Modellierungsschicht, hier nur unter dem Namen weitergereicht, unter dem die
 * Bedienschicht sie kennt.
 */
export const isAlignable: (element: BpmnElement) => boolean = canAlign;

const ALIGNMENT_LABELS: Readonly<Record<Alignment, string>> = {
  left: "links",
  center: "waagerecht mittig",
  right: "rechts",
  top: "oben",
  middle: "senkrecht mittig",
  bottom: "unten",
};

export type DistributeOrientation = "horizontal" | "vertical";

export class AlignDistribute {
  static $inject = [
    "alignElements",
    "distributeElements",
    "selection",
    "gridSnapping",
    "editorAnnouncer",
  ];

  constructor(
    private readonly alignElements: AlignElementsLike,
    private readonly distributeElements: DistributeElementsLike,
    private readonly selection: SelectionLike,
    private readonly gridSnapping: GridSnappingLike,
    private readonly announcer: EditorAnnouncer,
  ) {}

  /** Die Auswahl an einer Kante ausrichten. */
  align(alignment: Alignment, elements?: readonly BpmnElement[]): boolean {
    const chosen = (elements ? [...elements] : this.selection.get()).filter(
      isAlignable,
    );
    if (chosen.length < 2) {
      this.announcer.reject(
        "Zum Ausrichten müssen mindestens zwei Elemente ausgewählt sein.",
      );
      return false;
    }
    this.alignElements.trigger(chosen, alignment);
    this.announcer.announce(
      `${String(chosen.length)} Elemente ${ALIGNMENT_LABELS[alignment]} ausgerichtet.`,
    );
    return true;
  }

  /** Die Auswahl gleichmäßig verteilen. */
  distribute(
    orientation: DistributeOrientation,
    elements?: readonly BpmnElement[],
  ): boolean {
    const chosen = (elements ? [...elements] : this.selection.get()).filter(
      isAlignable,
    );
    if (chosen.length < 3) {
      this.announcer.reject(
        "Zum Verteilen müssen mindestens drei Elemente ausgewählt sein.",
      );
      return false;
    }
    this.distributeElements.trigger(chosen, orientation);
    this.announcer.announce(
      `${String(chosen.length)} Elemente ${
        orientation === "horizontal" ? "waagerecht" : "senkrecht"
      } gleichmäßig verteilt.`,
    );
    return true;
  }

  /** Einrasten am Raster ein- oder ausschalten. */
  toggleGrid(): boolean {
    const next = !this.gridSnapping.isActive();
    this.gridSnapping.setActive(next);
    this.announcer.announce(
      next
        ? "Einrasten am Raster eingeschaltet."
        : "Einrasten am Raster ausgeschaltet.",
    );
    return next;
  }

  gridActive(): boolean {
    return this.gridSnapping.isActive();
  }
}

export default AlignDistribute;
