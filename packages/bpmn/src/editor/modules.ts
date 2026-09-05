/// <reference lib="dom" />

/**
 * Die Modulliste der Editor-Schicht — und die zweite Achse aus Plan §2.4.
 *
 * **Der Modus-Schalter bleibt, wie er ist.** `src/viewer/modules.ts` entscheidet
 * über den Modus, indem es die Bearbeitungsmodule schlicht nicht registriert.
 * Diese Datei baut *darauf auf*, sie ersetzt es nicht: {@link editorModulesFor}
 * ruft `modulesFor(mode)` des Betrachters und legt nur oben drauf, was zum
 * Bearbeiten dazukommt. Es gibt weiterhin ein Bauteil und eine Wahrheit über
 * den Modus.
 *
 * **Die zweite Achse, `chrome`,** ist die Ergänzung, die der Plan verlangt und
 * die es noch nicht gab:
 *
 * | | `chrome="full"` | `chrome="minimal"` |
 * |---|---|---|
 * | `edit` | Palette, Kontextmenü, alles aktiv | dito (Bearbeiten ohne Bedienelemente wäre sinnlos) |
 * | `read`/`review` | Palette **sichtbar, deaktiviert, mit Begründung** | keine Palette |
 *
 * Der Fall unten links ist der, für den die Achse gebaut wurde: Auf
 * `processes/[id]` folgt `readOnly` aus einem **fehlenden Recht**. Eine
 * ausgegraute Palette mit „Bearbeitung erfordert die Rolle Prozessmodellierer"
 * ist dort ehrlicher als eine Oberfläche, die so tut, als gäbe es die Funktion
 * nicht. Im Mitarbeiterportal dagegen folgt `read` aus dem **Kontext** — dort
 * will niemand eine dauerhaft graue Werkzeugleiste sehen, und `minimal` lässt
 * sie weg.
 *
 * Der deaktivierte Fall registriert **nur** Palette und Ansage, kein
 * `modeling`, kein `contextPad`, keine Tastaturbefehle. Ein Bedienelement, das
 * aussieht wie eines und keines ist, muss auch keines sein können.
 */

import AlignElementsModule from "diagram-js/lib/features/align-elements/index.js";
import AutoPlaceModule from "diagram-js/lib/features/auto-place/index.js";
import BendpointsModule from "diagram-js/lib/features/bendpoints/index.js";
import ConnectModule from "diagram-js/lib/features/connect/index.js";
import ContextPadModule from "diagram-js/lib/features/context-pad/index.js";
import CopyPasteModule from "diagram-js/lib/features/copy-paste/index.js";
import CreateModule from "diagram-js/lib/features/create/index.js";
import DistributeElementsModule from "diagram-js/lib/features/distribute-elements/index.js";
import GridSnappingModule from "diagram-js/lib/features/grid-snapping/index.js";
// [ARCTOS-FULL-2026-08-31 · OP-031] Die drei Werkzeugmodule. Sie lagen in
// `node_modules` und waren nirgends registriert — `grep -r "lasso-tool" src/`
// fand vor dieser Arbeit null Treffer. `tool-manager` kommt über deren
// `__depends__` mit und ist der Ort, an dem `diagram-js` „genau ein Werkzeug
// ist an" führt.
import HandToolModule from "diagram-js/lib/features/hand-tool/index.js";
import LassoToolModule from "diagram-js/lib/features/lasso-tool/index.js";
import SpaceToolModule from "diagram-js/lib/features/space-tool/index.js";
import MoveModule from "diagram-js/lib/features/move/index.js";
import PaletteModule from "diagram-js/lib/features/palette/index.js";
import ResizeModule from "diagram-js/lib/features/resize/index.js";
import SnappingModule from "diagram-js/lib/features/snapping/index.js";

import modelingModule from "../modeling/index";
import { modulesFor, type BpmnCanvasMode } from "../viewer/modules";
import { AlignDistribute } from "./AlignDistribute";
import { ArctosContextPadProvider } from "./ContextPadProvider";
import { ArctosPaletteProvider } from "./PaletteProvider";
import { BendpointEditing } from "./BendpointEditing";
import { BpmnCopyPaste } from "./CopyPaste";
import { ConnectMode } from "./ConnectMode";
import { ContainerMode } from "./ContainerMode";
import { DiagramFind } from "./Find";
import { KeyboardHelp } from "./KeyboardHelp";
import { ContextPadChrome } from "./ContextPadChrome";
import { EditorTools } from "./Tools";
import { RangeSelection } from "./RangeSelection";
import { EditorAnnouncer } from "./announce";
import { EditorConfiguration } from "./config";
import { EditorKeyboard } from "./Keyboard";
import { ElementCreation } from "./ElementCreation";
import { LabelEditing } from "./LabelEditing";
import { PaletteChrome } from "./PaletteChrome";
import { ProbeFactory } from "./probe";
import { ReplaceMenu } from "./ReplaceMenu";
import { ResizeBehavior } from "./ResizeBehavior";
import type { EditorChrome } from "./types";

export type DiagramModule = Record<string, unknown>;

/**
 * Die Bedienschicht, vollständig.
 *
 * `__depends__` nennt nur, was ohne diese Schicht nicht laufen kann; alles
 * Übrige (`move`, `resize`, `snapping`) kommt über {@link editorModulesFor}
 * dazu, damit ein Aufrufer die Bedienschicht auch in einen eigenen Aufbau
 * hängen kann.
 */
export const editorModule = {
  __depends__: [
    modelingModule,
    PaletteModule,
    ContextPadModule,
    CreateModule,
    ConnectModule,
    AutoPlaceModule,
    CopyPasteModule,
    AlignElementsModule,
    DistributeElementsModule,
    GridSnappingModule,
    BendpointsModule,
    HandToolModule,
    LassoToolModule,
    SpaceToolModule,
  ],
  __init__: [
    "paletteProvider",
    "paletteChrome",
    "contextPadProvider",
    "contextPadChrome",
    "labelEditing",
    "resizeBehavior",
    "bpmnCopyPaste",
    "editorKeyboard",
  ],
  editorConfig: ["type", EditorConfiguration],
  editorAnnouncer: ["type", EditorAnnouncer],
  probeFactory: ["type", ProbeFactory],
  elementCreation: ["type", ElementCreation],
  paletteProvider: ["type", ArctosPaletteProvider],
  paletteChrome: ["type", PaletteChrome],
  contextPadProvider: ["type", ArctosContextPadProvider],
  contextPadChrome: ["type", ContextPadChrome],
  replaceMenu: ["type", ReplaceMenu],
  labelEditing: ["type", LabelEditing],
  connectMode: ["type", ConnectMode],
  containerMode: ["type", ContainerMode],
  diagramFind: ["type", DiagramFind],
  keyboardHelp: ["type", KeyboardHelp],
  bendpointEditing: ["type", BendpointEditing],
  resizeBehavior: ["type", ResizeBehavior],
  bpmnCopyPaste: ["type", BpmnCopyPaste],
  // [ARCTOS-FULL-2026-08-31 · OP-031/OP-032]
  editorTools: ["type", EditorTools],
  rangeSelection: ["type", RangeSelection],
  alignDistribute: ["type", AlignDistribute],
  editorKeyboard: ["type", EditorKeyboard],
} as const;

/**
 * Nur die Bedienoberfläche, ohne jede Bearbeitungsfähigkeit.
 *
 * Für `chrome="full"` im Lesemodus: die Palette wird gezeigt und ist
 * deaktiviert. Ohne `modeling` erkennt {@link EditorConfiguration} das von
 * selbst — die Deaktivierung ist damit keine zweite Behauptung, sondern eine
 * Ableitung aus der Modulliste.
 */
export const editorChromeModule = {
  __depends__: [PaletteModule],
  __init__: ["paletteProvider", "paletteChrome"],
  editorConfig: ["type", EditorConfiguration],
  editorAnnouncer: ["type", EditorAnnouncer],
  paletteProvider: ["type", ArctosPaletteProvider],
  paletteChrome: ["type", PaletteChrome],
} as const;

export interface EditorModulesOptions {
  readonly mode: BpmnCanvasMode;
  readonly chrome?: EditorChrome;
}

/**
 * Die vollständige Modulliste für einen Modus.
 *
 * Baut auf `modulesFor` des Betrachters auf — der Modus-Schalter bleibt dort.
 */
export function editorModulesFor(
  options: EditorModulesOptions,
): DiagramModule[] {
  const base = modulesFor(options.mode) as DiagramModule[];
  if (options.mode === "edit") {
    return [
      ...base,
      MoveModule as DiagramModule,
      ResizeModule as DiagramModule,
      SnappingModule as DiagramModule,
      editorModule as unknown as DiagramModule,
    ];
  }
  if ((options.chrome ?? "full") === "full") {
    return [...base, editorChromeModule as unknown as DiagramModule];
  }
  return base;
}

/** Welche Dienste dieser Modus bereitstellt — für Tests und Fehlermeldungen. */
export function editorServicesFor(
  options: EditorModulesOptions,
): readonly string[] {
  if (options.mode === "edit") {
    return Object.keys(editorModule).filter((key) => !key.startsWith("__"));
  }
  if ((options.chrome ?? "full") === "full") {
    return Object.keys(editorChromeModule).filter(
      (key) => !key.startsWith("__"),
    );
  }
  return [];
}

export default editorModule;
