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

import { useState } from "react";
import type { GrcViewId } from "@grc/bpmn/grc";

import { resolveBpmnEngine } from "@/lib/feature-flags";
import { useGrcOverlay } from "@/hooks/use-grc-overlay";
import { GrcViewSelect } from "./grc-view-select";
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
      // [ARCTOS-FULL-2026-08-31 · OP-028] Hier folgt `read` aus dem KONTEXT —
      // Übersichtsreiter, Versionsdialog, Mitarbeitersicht —, nicht aus einem
      // fehlenden Recht. Eine dauerhaft graue Werkzeugleiste wäre dort falsch
      // (Plan §2.4, zweite Achse); `bpmn-editor.tsx` setzt aus demselben Grund
      // "full".
      chrome="minimal"
      {...(props.className ? { className: props.className } : {})}
      minHeight={props.minHeight ?? 400}
    />
  );
}

/**
 * [ARCTOS-FULL-2026-08-31 · OP-026] Eine lesende Diagrammfläche **mit**
 * GRC-Sichtwahl.
 *
 * **Der Befund, nachgemessen.** `GrcViewSelect` + `useGrcOverlay` waren
 * gebaut und an zwei Stellen verdrahtet (`processes/[id]/page.tsx:943` und
 * `:1485`). Zwei weitere lesende Einbindungen hatten sie nicht:
 *
 * | Einbindung | Datei | vorher |
 * |---|---|---|
 * | Dialog „Version ansehen" | `processes/[id]/page.tsx:1735` | `<BpmnViewerDynamic xml=… />`, ohne Sichtwahl |
 * | Mitarbeitersicht | `my-processes/[id]/page.tsx:289` | `<BpmnViewer xml=… />`, ohne Sichtwahl |
 *
 * Die 23 GRC-Layer waren dort also unerreichbar — nicht weil Daten fehlten
 * (der Endpunkt liefert sie), sondern weil niemand die drei Teile
 * zusammengesetzt hatte.
 *
 * **Warum eine eigene Komponente und nicht dreimal derselbe Block.** Die
 * Verdrahtung besteht aus einem Haken, einem Zustand, einem Auswahlfeld und
 * zwei bedingt gesetzten Props — an vier Stellen kopiert wäre das genau die
 * Form, aus der die Abweichungen entstehen, die dieser Audit an anderer Stelle
 * gefunden hat (`UMSETZUNG-WELLE-1C.md` §1, „Der Einzelfall ist behoben, die
 * Frage war nie gestellt"). Hier steht sie einmal.
 *
 * **Die Entscheidung, die das Register offen lässt** („gehört eine Sichtwahl
 * in die Mitarbeitersicht?"): ja, und zwar ausgeschaltet als Vorgabe. `null`
 * heisst ausdrücklich **aus** — dann wird der Overlay-Endpunkt gar nicht erst
 * befragt (`useGrcOverlay`, `enabled`), es entsteht keine zusätzliche Last,
 * und die Fläche verhält sich wie bisher. Wer die Sicht einschaltet, sieht
 * Daten, die er ohnehin sehen darf: der Endpunkt prüft die Rechte, nicht
 * dieses Auswahlfeld.
 */

export interface BpmnGrcViewerProps extends BpmnViewerProps {
  /** Prozess, dessen GRC-Datensatz geholt wird. Fehlt er, gibt es keine Wahl. */
  processId?: string | undefined;
  /** Version, falls die Fläche eine bestimmte Fassung zeigt. */
  versionId?: string | undefined;
}

export function BpmnGrcViewer({
  processId,
  versionId,
  ...viewerProps
}: BpmnGrcViewerProps) {
  const [grcView, setGrcView] = useState<GrcViewId | null>(null);
  const {
    data: grcOverlayData,
    loading,
    error,
  } = useGrcOverlay(processId, {
    enabled: grcView !== null,
    versionId,
  });

  // Ohne Prozesskennung gibt es keinen Endpunkt, den man fragen könnte. Dann
  // die Auswahl gar nicht erst zeigen, statt ein Feld anzubieten, das nichts
  // bewirkt.
  if (!processId) {
    return <BpmnViewer {...viewerProps} />;
  }

  return (
    <div>
      <div className="mb-1 flex justify-end">
        <GrcViewSelect
          value={grcView}
          onChange={setGrcView}
          loading={loading}
          error={error}
          {...(grcOverlayData?.computedAt !== undefined
            ? { computedAt: grcOverlayData.computedAt }
            : {})}
        />
      </div>
      <BpmnViewer
        {...viewerProps}
        {...(grcView !== null && grcOverlayData !== undefined
          ? { grcOverlayData, grcView }
          : {})}
      />
    </div>
  );
}
