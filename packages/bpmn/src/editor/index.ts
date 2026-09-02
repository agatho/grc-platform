/// <reference lib="dom" />

/**
 * Die Editor-Schicht: alles, was zwischen Nutzerhand und Modellierungsschicht
 * liegt.
 *
 * Sie hält keinen Modellzustand und erfindet keine BPMN-Regeln. Was erlaubt
 * ist, beantwortet `rules` aus `src/modeling`; was geschieht, führt `modeling`
 * aus; was gezeichnet wird, entscheidet `src/draw`. Diese Schicht entscheidet
 * nur, **wie man es sagt** — mit Maus und mit Tastatur, und beides über
 * denselben Weg, damit sich die zwei Bedienarten nicht auseinanderentwickeln.
 */

import MoveModule from "diagram-js/lib/features/move/index.js";
import ResizeModule from "diagram-js/lib/features/resize/index.js";
import SnappingModule from "diagram-js/lib/features/snapping/index.js";

import {
  ModelingSession,
  type ModelingSessionOptions,
} from "../modeling/session";
import { editorModule } from "./modules";
import type { EditorConfig } from "./types";

export {
  DEFAULT_PALETTE_ITEMS,
  PALETTE_GROUPS,
  eventDefinitionTypeOf,
  groupsOf,
  paletteCatalog,
  replaceFamilyOf,
  replaceOptionsFor,
  type PaletteCatalogOptions,
} from "./catalog";
export {
  DEFAULT_DISABLED_REASON,
  DEFAULT_FINE_STEP,
  DEFAULT_GRID_STEP,
  EditorConfiguration,
} from "./config";
export { EditorAnnouncer } from "./announce";
export { RovingFocus, escapeHtml, isTextInput } from "./dom";
export {
  ElementCreation,
  describe,
  type CreationResult,
} from "./ElementCreation";
export { ArctosPaletteProvider } from "./PaletteProvider";
export { PaletteChrome } from "./PaletteChrome";
export { ArctosContextPadProvider } from "./ContextPadProvider";
export { ContextPadChrome } from "./ContextPadChrome";
export { ReplaceMenu } from "./ReplaceMenu";
export { LabelEditing } from "./LabelEditing";
export { ConnectMode, CANDIDATE_MARKER, midOf } from "./ConnectMode";
export { ContainerMode, CONTAINER_MARKER, placeInside } from "./ContainerMode";
export {
  DiagramFind,
  FIND_CLASS,
  countText,
  haystack,
  matchesFor,
  searchKey,
} from "./Find";
export {
  KeyboardHelp,
  HELP_CLASS,
  KEY_BINDINGS,
  buildHelp,
  type KeyBinding,
} from "./KeyboardHelp";
export { BendpointEditing } from "./BendpointEditing";
export {
  ResizeBehavior,
  minDimensionsFor,
  resizeBounds,
  type Dimensions,
  type ResizeDirection,
} from "./ResizeBehavior";
export { BpmnCopyPaste } from "./CopyPaste";
export {
  hasGrcMetadata,
  materialize,
  snapshotOf,
  type SemanticSnapshot,
} from "./copy/serialize";
export {
  AlignDistribute,
  isAlignable,
  type DistributeOrientation,
} from "./AlignDistribute";
export { EditorKeyboard, arrowDelta } from "./Keyboard";
export { ProbeFactory } from "./probe";
export {
  editorChromeModule,
  editorModule,
  editorModulesFor,
  editorServicesFor,
  type DiagramModule,
  type EditorModulesOptions,
} from "./modules";
export type {
  EditorChrome,
  EditorConfig,
  PaletteGroup,
  PaletteItem,
  ReplaceOption,
} from "./types";

export default editorModule;

export interface EditorSessionOptions extends ModelingSessionOptions {
  readonly editor?: EditorConfig;
}

/**
 * Eine bearbeitbare Sitzung mit vollständiger Bedienschicht.
 *
 * Bewusst **keine zweite Komponente**: `ModelingSession` ist der vorhandene
 * Einstieg der Modellierungsschicht (und laut ihrer eigenen Beschreibung der
 * Ort, an dem später die React-Fassade aufsetzt). Hier kommt nur die
 * Modulliste dazu. Wer den Editor in einen fremden `diagram-js`-Aufbau hängen
 * will, nimmt stattdessen {@link editorModule} beziehungsweise
 * {@link editorModulesFor}.
 */
export async function createEditorSession(
  xml: string,
  options: EditorSessionOptions = {},
): Promise<ModelingSession> {
  const { editor, additionalModules, ...rest } = options;
  const session = new ModelingSession({
    ...rest,
    additionalModules: [
      MoveModule,
      ResizeModule,
      SnappingModule,
      editorModule,
      ...(additionalModules ?? []),
      // Der Dienstname ist wörtlich `config.editor`: `didi` löst einen Namen
      // mit Punkt nur dann über das Optionsobjekt auf, wenn es keinen Anbieter
      // dieses Namens gibt. So lässt sich die Konfiguration als Modul
      // nachreichen, ohne die Optionen von `ModelingSession` aufzubohren.
      ...(editor ? [{ "config.editor": ["value", editor] }] : []),
    ],
  });
  await session.importXml(xml);
  return session;
}
