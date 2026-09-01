/// <reference lib="dom" />

import BpmnRenderer from "./BpmnRenderer.js";

/**
 * `diagram-js`-Modul der Zeichenschicht.
 *
 * Registrierung wie in `diagram-js` üblich (`__init__` + benannte Fabrik), damit
 * der Renderer auch einzeln in eine fremde `Diagram`-Instanz eingehängt werden
 * kann.
 */
const drawModule = {
  __init__: ["bpmnRenderer"],
  bpmnRenderer: ["type", BpmnRenderer],
} as const;

export default drawModule;

export { default as BpmnRenderer } from "./BpmnRenderer.js";
export { buildScene, type Scene } from "./scene.js";
export {
  describeElement,
  renderDefinitions,
  renderScene,
  toSvgString,
  type StaticRenderOptions,
  type StaticRenderResult,
} from "./StaticRenderer.js";
export {
  getActivityMarkers,
  getAriaRole,
  getEventDefinitionLabel,
  getEventDefinitionType,
  getLabelText,
  getTypeLabel,
  SUPPORTED_CONNECTION_TYPES,
  SUPPORTED_SHAPE_TYPES,
  type EventDefinitionType,
} from "./semantic.js";
export { layoutText, measureText, type TextLayout } from "./text.js";
export * from "./types.js";
export {
  DEFAULT_PALETTE,
  HIGH_CONTRAST_PALETTE,
  SIZE,
  STROKE_THICK,
  STROKE_THIN,
  type Palette,
} from "./theme.js";
