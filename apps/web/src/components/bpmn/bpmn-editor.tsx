"use client";

/**
 * Die Weiche für die bearbeitbare Diagrammfläche.
 *
 * Modulpfad, Exportname und Prop-Oberfläche sind unverändert — genau das ist
 * der Zweck: `processes/[id]/page.tsx` lädt weiterhin
 * `import("@/components/bpmn/bpmn-editor").then((m) => m.BpmnEditor)` und weiß
 * nicht, welche Engine darunter läuft. Umgeschaltet wird zur Laufzeit
 * (`ARCTOS_BPMN_ENGINE`, siehe `@/lib/feature-flags`), nicht beim Übersetzen.
 *
 * **Zwei Engines, eine Zuständigkeit je Schalterstellung:**
 *
 * | Stellung | `readOnly` | läuft auf | Modus |
 * |---|---|---|---|
 * | `legacy` (Vorgabe) | egal | `bpmn-js` | — |
 * | `arctos` | `true` | `@grc/bpmn` | `read` |
 * | `arctos` | `false` | `@grc/bpmn` | `edit` |
 *
 * Der frühere Rückfall bei `readOnly=false` ist **entfallen**. Er stand hier,
 * solange `BpmnCanvas` den Modus `edit` verweigerte, weil `paletteProvider`,
 * `contextPadProvider` und `labelEditingProvider` fehlten. Sie stehen
 * (`packages/bpmn/src/editor/`), der Modus registriert sie, und damit ist die
 * Bedingung nicht mehr wahr — die Weiche fragt jetzt allein den Schalter und
 * `supportsMode`. Auf `processes/[id]` gilt `readOnly = !canEdit`; beide
 * Sichten laufen damit auf der eigenen Engine.
 */

import { forwardRef, useImperativeHandle, useRef, type Ref } from "react";
import { resolveBpmnEngine } from "@/lib/feature-flags";
import { ArctosBpmnCanvas, supportsMode } from "./arctos-bpmn-canvas";
import { BpmnEditorLegacy } from "./bpmn-editor-legacy";
import type { BpmnEditorProps, BpmnEditorRef } from "./bpmn-canvas-types";

export type {
  BpmnEditorProps,
  BpmnEditorRef,
  BpmnEngineProp,
  CallActivityOverlayData,
  ControlCoverageOverlayData,
  FindingsOverlayData,
  LodOverlayData,
  RiskOverlayData,
} from "./bpmn-canvas-types";

/**
 * Entscheidet, ob eine Einbindung auf der eigenen Engine laufen kann.
 * Als benannte Funktion, damit der Test sie direkt prüfen kann, ohne zu rendern.
 */
export function editorEngineFor(props: {
  engine?: string | undefined;
  readOnly?: boolean | undefined;
}): "legacy" | "arctos" {
  const engine = resolveBpmnEngine(
    props.engine ? { explicit: props.engine } : {},
  );
  if (engine !== "arctos") return "legacy";
  return supportsMode(modeFor(props.readOnly ?? false)) ? "arctos" : "legacy";
}

/** `readOnly` ist eine Rechtefrage; der Modus ist ihre Übersetzung. */
export function modeFor(readOnly: boolean): "read" | "edit" {
  return readOnly ? "read" : "edit";
}

export const BpmnEditor = forwardRef<BpmnEditorRef, BpmnEditorProps>(
  function BpmnEditor(props, ref) {
    if (editorEngineFor(props) === "legacy") {
      return <BpmnEditorLegacy {...props} ref={ref} />;
    }
    return <ArctosBpmnEditorBridge {...props} forwardedRef={ref} />;
  },
);

/**
 * Bindeglied zwischen der imperativen Fläche der Aufrufer (`BpmnEditorRef`) und
 * dem Adapter. Eigene Komponente, weil `useImperativeHandle` sonst auch im
 * Legacy-Zweig liefe und dann zwei Schreiber auf derselben Ref säßen.
 */
function ArctosBpmnEditorBridge({
  forwardedRef,
  ...props
}: BpmnEditorProps & { forwardedRef: Ref<BpmnEditorRef> }) {
  const handle = useRef<BpmnEditorRef | null>(null);
  useImperativeHandle(forwardedRef, () => ({
    saveXml: () => handle.current?.saveXml() ?? Promise.resolve(""),
    saveSvg: () => handle.current?.saveSvg() ?? Promise.resolve(""),
    getModeler: () => handle.current?.getModeler() ?? null,
    undo: () => handle.current?.undo(),
    redo: () => handle.current?.redo(),
    canUndo: () => handle.current?.canUndo() ?? false,
    canRedo: () => handle.current?.canRedo() ?? false,
  }));

  return (
    <ArctosBpmnCanvas
      {...props}
      xml={props.initialXml}
      mode={modeFor(props.readOnly ?? false)}
      /*
       * [ARCTOS-FULL-2026-08-31 · OP-028] `full`, auch im Lesemodus.
       *
       * Auf `processes/[id]` gilt `readOnly = !canEdit` — das `read` folgt hier
       * aus einem **fehlenden Recht**. Die Palette wird deshalb gezeigt und ist
       * deaktiviert, mit Begründung an jedem Knopf (`aria-disabled`, nicht
       * `disabled`: ein `disabled`-Knopf fällt aus Fokus und Ansage, und dann
       * erfährt ein Tastaturnutzer nie, dass es die Funktion gibt).
       *
       * `packages/bpmn` hatte das seit Stufe B1 gebaut (`editorChromeModule`);
       * es war nur von keiner Einbindung aus erreichbar.
       */
      chrome="full"
      minHeight={500}
      handleRef={handle}
    />
  );
}
