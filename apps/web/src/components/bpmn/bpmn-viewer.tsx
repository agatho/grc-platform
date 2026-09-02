"use client";

/**
 * Die Weiche für die lesenden Diagrammflächen.
 *
 * Drei Einbindungen auf zwei Seiten gehen hier durch (Bestandsaufnahme §1.5):
 * die BPMN-Vorschau im Übersichtsreiter, der Dialog „Version ansehen" und die
 * Mitarbeitersicht in `my-processes/[id]`. Alle drei laufen bei
 * `ARCTOS_BPMN_ENGINE=arctos` **vollständig** auf `@grc/bpmn` — Lesen ist der
 * Fall, für den die eigene Engine fertig ist (Plan §5.4, Stufen S1/S2).
 *
 * Modulpfad und Exportname bleiben, damit keine Aufrufstelle sich ändert.
 */

import { resolveBpmnEngine } from "@/lib/feature-flags";
import { ArctosBpmnCanvas, supportsMode } from "./arctos-bpmn-canvas";
import { BpmnViewerLegacy } from "./bpmn-viewer-legacy";
import type { BpmnViewerProps } from "./bpmn-canvas-types";

export type { BpmnViewerProps } from "./bpmn-canvas-types";

/** Wie `editorEngineFor`, aber für lesende Flächen: kein Modus-Vorbehalt. */
export function viewerEngineFor(props: {
  engine?: string | undefined;
}): "legacy" | "arctos" {
  const engine = resolveBpmnEngine(
    props.engine ? { explicit: props.engine } : {},
  );
  return engine === "arctos" && supportsMode("read") ? "arctos" : "legacy";
}

export function BpmnViewer(props: BpmnViewerProps) {
  if (viewerEngineFor(props) === "legacy") {
    return <BpmnViewerLegacy {...props} />;
  }
  return (
    <ArctosBpmnCanvas
      xml={props.xml}
      mode="read"
      {...(props.onElementClick
        ? { onElementClick: props.onElementClick }
        : {})}
      {...(props.onNavigateToProcess
        ? { onNavigateToProcess: props.onNavigateToProcess }
        : {})}
      {...(props.riskOverlayData
        ? { riskOverlayData: props.riskOverlayData }
        : {})}
      {...(props.callActivityOverlayData
        ? { callActivityOverlayData: props.callActivityOverlayData }
        : {})}
      {...(props.grcOverlayData
        ? { grcOverlayData: props.grcOverlayData }
        : {})}
      {...(props.grcView ? { grcView: props.grcView } : {})}
      {...(props.className ? { className: props.className } : {})}
      minHeight={props.minHeight ?? 400}
    />
  );
}
