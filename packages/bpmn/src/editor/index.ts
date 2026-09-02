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
} from "../modeling/session.js";
import { editorModule } from "./modules.js";
import type { EditorConfig } from "./types.js";

export {
  DEFAULT_PALETTE_ITEMS,
  PALETTE_GROUPS,
  eventDefinitionTypeOf,
  groupsOf,
  paletteCatalog,
  replaceFamilyOf,
  replaceOptionsFor,
  type PaletteCatalogOptions,
} from "./catalog.js";
export {
  DEFAULT_DISABLED_REASON,
  DEFAULT_FINE_STEP,
  DEFAULT_GRID_STEP,
  EditorConfiguration,
} from "./config.js";
export { EditorAnnouncer } from "./announce.js";
export { RovingFocus, escapeHtml, isTextInput } from "./dom.js";
export {
  ElementCreation,
  describe,
  type CreationResult,
} from "./ElementCreation.js";
export { ArctosPaletteProvider } from "./PaletteProvider.js";
export { PaletteChrome } from "./PaletteChrome.js";
export { ArctosContextPadProvider } from "./ContextPadProvider.js";
export { ContextPadChrome } from "./ContextPadChrome.js";
export { ReplaceMenu } from "./ReplaceMenu.js";
export { LabelEditing } from "./LabelEditing.js";
export { ConnectMode, CANDIDATE_MARKER, midOf } from "./ConnectMode.js";
export { BendpointEditing } from "./BendpointEditing.js";
export {
  ResizeBehavior,
  minDimensionsFor,
  resizeBounds,
  type Dimensions,
  type ResizeDirection,
} from "./ResizeBehavior.js";
export { BpmnCopyPaste } from "./CopyPaste.js";
export {
  hasGrcMetadata,
  materialize,
  snapshotOf,
  type SemanticSnapshot,
} from "./copy/serialize.js";
export {
  AlignDistribute,
  isAlignable,
  type DistributeOrientation,
} from "./AlignDistribute.js";
export { EditorKeyboard, arrowDelta } from "./Keyboard.js";
export { ProbeFactory } from "./probe.js";
export {
  editorChromeModule,
  editorModule,
  editorModulesFor,
  editorServicesFor,
  type DiagramModule,
  type EditorModulesOptions,
} from "./modules.js";
export type {
  EditorChrome,
  EditorConfig,
  PaletteGroup,
  PaletteItem,
  ReplaceOption,
} from "./types.js";

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
