/// <reference lib="dom" />

/**
 * `@grc/bpmn` — eigene BPMN-Engine auf `diagram-js` (MIT) und `bpmn-moddle` (MIT).
 *
 * Öffentliche Fläche des Pakets. Der `didi`-Container bleibt gekapselt; nach
 * außen gibt es genau ein Bauteil (`BpmnCanvas`) mit einem Modus-Schalter, die
 * Zeichenschicht für serverseitiges Rendern und die Barrierefreiheitsschicht.
 *
 * Das Paket importiert **nie** `bpmn-js` — das ist der Zweck des Vorhabens.
 */

export { default as drawModule } from "./draw/index.js";
export {
  BpmnRenderer,
  buildScene,
  describeElement,
  getActivityMarkers,
  getAriaRole,
  getEventDefinitionLabel,
  getEventDefinitionType,
  getLabelText,
  getTypeLabel,
  layoutText,
  measureText,
  renderDefinitions,
  renderScene,
  SUPPORTED_CONNECTION_TYPES,
  SUPPORTED_SHAPE_TYPES,
  toSvgString,
  type Bounds,
  type BpmnConnection,
  type BpmnElement,
  type BpmnRendererConfig,
  type BpmnShape,
  type EventDefinitionType,
  type ModdleElement,
  type Palette,
  type Point,
  type Scene,
  type StaticRenderOptions,
  type StaticRenderResult,
  type TextLayout,
} from "./draw/index.js";

export {
  BpmnCanvas,
  buildGraphOrder,
  buildTextAlternative,
  findContainerLabel,
  GraphA11y,
  isEditable,
  MISSING_EDIT_MODULES,
  modulesFor,
  renderTextAlternativeTable,
  type A11yHost,
  type BpmnCanvasMode,
  type BpmnCanvasOptions,
  type GraphNode,
  type GraphOrder,
  type ImportDiagramResult,
  type ImportXmlFn,
  type ImportXmlResult,
  type TextAlternativeModel,
  type TextAlternativeRow,
} from "./viewer/index.js";
