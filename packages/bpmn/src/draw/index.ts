/// <reference lib="dom" />

import type { ShapeLike } from "diagram-js/lib/core/Types.js";

import BpmnRenderer from "./BpmnRenderer";
import { svgAttr } from "./svg";

/**
 * [WELLE-6C · 2026-09-08] `CanvasBpmnRenderer` — dieselbe Zeichnung, einmal
 * zurückgeschoben.
 *
 * **Der Befund.** In der eigenen Engine (`?engine=arctos`) lag jede Form um
 * genau ihre eigenen Modellkoordinaten neben ihrer Klickfläche. Gemessen am
 * leeren Prozess (`EMPTY_BPMN_XML`, `StartEvent_1` bei x=179, y=159), im
 * Browser über `getBoundingClientRect`:
 *
 * ```
 * g.djs-visual            439,761  36x36     ← das GEZEICHNETE Startereignis
 * rect.djs-hit djs-hit-all 260,602  36x36    ← die KLICKBARE Fläche
 * ```
 *
 * Differenz: 179 / 159 — die Koordinaten des Elements selbst.
 *
 * **Die Ursache.** `BpmnRenderer` zeichnet in ABSOLUTEN Modellkoordinaten
 * (`drawEvent`: `cx = shape.x + shape.width / 2`). Das ist für den statischen
 * Weg richtig: `StaticRenderer` setzt eine `viewBox` über die Szenengrenzen und
 * verschiebt nichts. `diagram-js` dagegen verschiebt die Elementgruppe selbst
 * (`GraphicsFactory.updateShape` → `translate(gfx, element.x, element.y)`) und
 * erwartet vom Renderer eine Zeichnung RELATIV zu (0,0) — so macht es auch
 * `bpmn-js`. Beides zusammen ergibt die doppelte Verschiebung.
 *
 * **Die Folge war nicht kosmetisch.** Die Klickfläche liegt dort, wo
 * `diagram-js` sie erwartet, das Bild woanders: ein Klick auf das sichtbare
 * Element traf leere Fläche, `elementFromPoint` lieferte das Wurzel-`<svg>`,
 * es gab keine Auswahl, kein Kontextmenü und damit **keinen Weg, auf dieser
 * Fläche zu modellieren**. Gemessen am Stand `f512c704`: nach drei gezielten
 * Klicks auf das Startereignis war `.djs-element.selected` leer und
 * `.djs-context-pad` nicht im Baum.
 *
 * **Warum es keiner der 40 Zeichentests fand.** `test/draw/helpers/render.ts`
 * legt jede Form mit `x: 0, y: 0` an. Bei (0,0) ist die doppelte Verschiebung
 * die Identität. Das gesamte Formtestwerk konnte diesen Fehler nicht sehen —
 * dieselbe Klasse von blindem Tor, die dieses Audit schon mehrfach gefunden
 * hat.
 *
 * **Die Behebung, so klein wie möglich.** Der Renderer bleibt absolut — der
 * statische Weg, die Prüfbilder und die vierzig Formtests hängen daran. Nur
 * für den `diagram-js`-Weg wird die Gruppe `djs-visual` um `(-x, -y)`
 * zurückgeschoben; die äussere Verschiebung von `diagram-js` hebt das genau
 * auf. Kanten brauchen nichts: `updateConnection` verschiebt nicht, und
 * `drawConnection` zeichnet ohnehin absolute Stützpunkte.
 */
class CanvasBpmnRenderer extends BpmnRenderer {
  override drawShape(visuals: SVGElement, element: ShapeLike): SVGElement {
    const result = super.drawShape(visuals, element);
    const { x, y } = element as unknown as { x?: number; y?: number };
    // `updateShape` zeichnet bei jeder Bewegung neu, deshalb wird das Attribut
    // jedes Mal gesetzt (und bei (0,0) auf die Identität) statt nur ergänzt.
    const dx = Number.isFinite(x) ? -(x as number) : 0;
    const dy = Number.isFinite(y) ? -(y as number) : 0;
    svgAttr(visuals, { transform: `translate(${String(dx)} ${String(dy)})` });
    return result;
  }
}

/**
 * `diagram-js`-Modul der Zeichenschicht.
 *
 * Registrierung wie in `diagram-js` üblich (`__init__` + benannte Fabrik), damit
 * der Renderer auch einzeln in eine fremde `Diagram`-Instanz eingehängt werden
 * kann.
 */
const drawModule = {
  __init__: ["bpmnRenderer"],
  bpmnRenderer: ["type", CanvasBpmnRenderer],
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
