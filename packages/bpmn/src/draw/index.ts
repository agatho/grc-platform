/// <reference lib="dom" />

import BpmnRenderer from "./BpmnRenderer";

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

export { default as BpmnRenderer } from "./BpmnRenderer";
export { buildScene, type Scene } from "./scene";
// [ARCTOS-FULL-2026-08-31 · OP-018] Ebenenbaum des Dokuments; siehe planes.ts.
export {
  planeIndexFor,
  planeLabel,
  planePath,
  planesOf,
  type PlaneInfo,
} from "./planes";
export {
  describeElement,
  renderDefinitions,
  renderScene,
  toSvgString,
  type StaticRenderOptions,
  type StaticRenderResult,
} from "./StaticRenderer";
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
} from "./semantic";
export { layoutText, measureText, type TextLayout } from "./text";
export * from "./types";
export {
  DEFAULT_PALETTE,
  HIGH_CONTRAST_PALETTE,
  SIZE,
  STROKE_THICK,
  STROKE_THIN,
  type Palette,
} from "./theme";
