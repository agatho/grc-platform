/**
 * Die Prop-Oberfläche der Diagrammfläche — engineunabhängig.
 *
 * Diese Datei ist der Vertrag zwischen den aufrufenden Seiten und *beiden*
 * Implementierungen (`bpmn-js` und `@grc/bpmn`). Sie enthält bewusst nur
 * Typen: kein Import einer Engine, damit weder der Legacy- noch der
 * ARCTOS-Pfad durch das Laden dieser Datei mitgezogen wird.
 *
 * Herkunft: wörtlich aus `bpmn-editor.tsx` und `bpmn-viewer.tsx` gezogen, damit
 * die Umstellung an keiner Aufrufstelle sichtbar wird. `bpmn-editor.tsx`
 * exportiert sie weiterhin, weil `hooks/use-bpmn-editor.ts`,
 * `hooks/use-processes.ts` und `processes/[id]/page.tsx` von dort importieren.
 */

export interface RiskOverlayData {
  bpmnElementId: string;
  riskCount: number;
  highestScore: number;
}

// BPM Overhaul Phase 2 A3–A5: additional overlay channels.
export interface ControlCoverageOverlayData {
  bpmnElementId: string;
  controlCount: number;
  effectiveCount: number;
}

export interface LodOverlayData {
  bpmnElementId: string;
  lineOfDefense: "first" | "second" | "third" | "oversight" | null;
}

export interface FindingsOverlayData {
  bpmnElementId: string;
  openCount: number;
  criticalCount: number;
}

// Call-Activity Drill-Down: elements with a linked child process get a
// clickable badge; double-click (view mode) navigates to the child.
export interface CallActivityOverlayData {
  bpmnElementId: string;
  calledProcessId: string;
  calledProcessName?: string | null;
}

/**
 * Imperative Fläche. `getModeler()` heißt weiterhin so, obwohl der ARCTOS-Pfad
 * keinen `Modeler` liefert: der Name steht in `hooks/use-bpmn-editor.ts`
 * (fremde Datei), und ein Umbenennen wäre eine Änderung an der Aufrufstelle —
 * genau das, was der Adapter vermeiden soll. Er liefert dort die
 * `BpmnCanvas`-Instanz; beide sind für die Aufrufer undurchsichtige Objekte.
 */
export interface BpmnEditorRef {
  saveXml: () => Promise<string>;
  saveSvg: () => Promise<string>;
  getModeler: () => unknown | null;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

/** Welche Engine eine Einbindung benutzt — überschreibt den globalen Schalter. */
export type BpmnEngineProp = "legacy" | "arctos";

/**
 * Der fertig berechnete GRC-Datensatz und die Sicht darauf.
 *
 * Nur der ARCTOS-Pfad wertet beide aus (`decorateGrc`); der Legacy-Pfad
 * ignoriert sie. Sie stehen hier und nicht nur am Adapter, damit eine
 * Aufrufstelle sie durchreichen kann, ohne zu wissen, welche Engine läuft —
 * dieselbe Zusage wie für alles andere in dieser Datei. Die Typen kommen aus
 * dem Vertrag der GRC-Schicht; sie sind hier nur benannt, damit diese Datei
 * weiterhin keine Engine mitzieht.
 */
export interface GrcDecorationProps {
  grcOverlayData?: import("@grc/bpmn/grc").GrcOverlayData;
  grcView?: import("@grc/bpmn/grc").GrcViewId;
}

export interface BpmnEditorProps extends GrcDecorationProps {
  initialXml: string;
  readOnly?: boolean;
  onSave?: (xml: string) => Promise<void>;
  onElementClick?: (
    elementId: string,
    elementType: string,
    elementName: string | null,
  ) => void;
  onChanged?: () => void;
  riskOverlayData?: RiskOverlayData[];
  controlCoverageOverlayData?: ControlCoverageOverlayData[];
  lodOverlayData?: LodOverlayData[];
  findingsOverlayData?: FindingsOverlayData[];
  callActivityOverlayData?: CallActivityOverlayData[];
  /** Called when the user drills down into a linked child process. */
  onNavigateToProcess?: (processId: string) => void;
  className?: string;
  /**
   * Nur für den Übergangsbetrieb: erzwingt eine Engine für diese eine
   * Einbindung. Ohne Angabe entscheidet `resolveBpmnEngine()`.
   */
  engine?: BpmnEngineProp;
}

export interface BpmnViewerProps extends GrcDecorationProps {
  xml: string;
  onElementClick?: (
    elementId: string,
    elementType: string,
    elementName: string | null,
  ) => void;
  riskOverlayData?: RiskOverlayData[];
  // Call-Activity Drill-Down: badge + dblclick navigation into children
  callActivityOverlayData?: CallActivityOverlayData[];
  onNavigateToProcess?: (processId: string) => void;
  className?: string;
  /** Minimum height for the viewer container */
  minHeight?: number;
  /** Siehe `BpmnEditorProps.engine`. */
  engine?: BpmnEngineProp;
}
