import BendpointsModule from "diagram-js/lib/features/bendpoints/index.js";
import ChangeSupportModule from "diagram-js/lib/features/change-support/index.js";
import InteractionEventsModule from "diagram-js/lib/features/interaction-events/index.js";
import KeyboardModule from "diagram-js/lib/features/keyboard/index.js";
import LabelSupportModule from "diagram-js/lib/features/label-support/index.js";
import MoveModule from "diagram-js/lib/features/move/index.js";
import OutlineModule from "diagram-js/lib/features/outline/index.js";
import OverlaysModule from "diagram-js/lib/features/overlays/index.js";
import ResizeModule from "diagram-js/lib/features/resize/index.js";
import RulesModule from "diagram-js/lib/features/rules/index.js";
import SelectionModule from "diagram-js/lib/features/selection/index.js";
import SnappingModule from "diagram-js/lib/features/snapping/index.js";
import MoveCanvasModule from "diagram-js/lib/navigation/movecanvas/index.js";
import ZoomScrollModule from "diagram-js/lib/navigation/zoomscroll/index.js";

import DrawModule from "../draw/index.js";

/**
 * Modus statt zweiter Implementierung (Plan §2.4).
 *
 * `read` ist nicht „ein anderer Viewer", sondern dieselbe Komponente ohne die
 * Bearbeitungsmodule. Renderer, Schriftmetrik, Marker, Tastaturbelegung und
 * Textalternative sind in allen Modi dasselbe Modul mit derselben Konfiguration
 * — genau der Punkt, an dem der Ist-Zustand (Modeler vs. NavigatedViewer)
 * auseinanderläuft.
 */
export type BpmnCanvasMode = "read" | "review" | "edit";

export type DiagramModule = Record<string, unknown>;

/** In allen Modi aktiv. */
const BASE_MODULES: DiagramModule[] = [
  DrawModule as unknown as DiagramModule,
  ChangeSupportModule as DiagramModule,
  InteractionEventsModule as DiagramModule,
  OutlineModule as DiagramModule,
  OverlaysModule as DiagramModule,
  SelectionModule as DiagramModule,
  ZoomScrollModule as DiagramModule,
  MoveCanvasModule as DiagramModule,
  KeyboardModule as DiagramModule,
];

/**
 * Generische Bearbeitungsmodule aus `diagram-js`.
 *
 * Das **BPMN-spezifische** Gegenstück — `bpmnRules`, `bpmnFactory`,
 * `bpmnUpdater`, `bpmnLayouter`, Palette, Kontextmenü, Direktbeschriftung —
 * steht in `src/modeling` und `src/editor` und kommt über
 * `editorModulesFor({ mode: "edit" })` hinzu. Diese Liste hier bleibt bewusst
 * frei davon: sonst wüssten zwei Dateien über den Modus Bescheid.
 *
 * **Nicht enthalten: `diagram-js/features/modeling`.** Es registriert
 * `modeling` und `layouter`, und beide liefert `src/modeling` in einer
 * BPMN-fähigen Fassung. Zwei Anbieter desselben Dienstnamens wären eine
 * Reihenfolgenfrage statt einer Entscheidung; die Modellierungsschicht bringt
 * das generische Modul über ihre eigenen `__depends__` mit, wo es hingehört.
 */
const EDITING_MODULES: DiagramModule[] = [
  RulesModule as DiagramModule,
  // `label-support` hängt an `modeling` und gehört deshalb in diese Gruppe.
  LabelSupportModule as DiagramModule,
  MoveModule as DiagramModule,
  ResizeModule as DiagramModule,
  BendpointsModule as DiagramModule,
  SnappingModule as DiagramModule,
];

export function modulesFor(mode: BpmnCanvasMode): DiagramModule[] {
  if (mode === "edit") {
    return [...BASE_MODULES, ...EDITING_MODULES];
  }
  return [...BASE_MODULES];
}

/** Sind in diesem Modus Modelländerungen vorgesehen? */
export function isEditable(mode: BpmnCanvasMode): boolean {
  return mode === "edit";
}
