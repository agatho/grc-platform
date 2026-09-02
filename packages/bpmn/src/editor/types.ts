/**
 * Typen der Editor-Schicht.
 *
 * Die Schicht liegt zwischen Nutzerhand und Modellierungsschicht. Sie hält
 * **keinen** eigenen Modellzustand und kennt **keine** eigenen BPMN-Regeln: was
 * erlaubt ist, beantwortet `rules` (aus `src/modeling/BpmnRules.ts`), was
 * geschieht, führt `modeling` aus. Alles hier ist Bedienung.
 *
 * Die Dienste sind bewusst über **strukturelle** Schnittstellen typisiert und
 * nicht über die Klassen aus `diagram-js`: die Laufzeitobjekte kommen von dort,
 * aber jeder Dienst dieser Schicht soll auch über einem Stub prüfbar sein —
 * dieselbe Entscheidung, die `src/modeling/types.ts` begründet.
 */

/// <reference lib="dom" />

import type {
  BpmnConnection,
  BpmnElement,
  BpmnParent,
  BpmnShape,
  ModdleElement,
  Point,
} from "../modeling/types.js";

export type {
  BpmnConnection,
  BpmnElement,
  BpmnParent,
  BpmnShape,
  ModdleElement,
  Point,
};

/**
 * Zweite Achse aus Plan §2.4: zeigt die Oberfläche ihre Bedienelemente auch
 * dann, wenn nicht bearbeitet werden darf?
 *
 * `full` zeigt sie **deaktiviert samt Begründung** — richtig dort, wo `read`
 * aus einem fehlenden Recht folgt (`processes/[id]`, `readOnly = !canEdit`).
 * `minimal` lässt sie weg — richtig dort, wo `read` aus dem Kontext folgt
 * (Mitarbeiterportal, Versionsdialog); dort will niemand eine dauerhaft graue
 * Werkzeugleiste sehen.
 */
export type EditorChrome = "full" | "minimal";

/** Ergebnis einer Regelabfrage von `diagram-js`. */
export type RuleResult = boolean | string | null | undefined | object;

export interface RulesLike {
  allowed(action: string, context?: unknown): RuleResult;
}

export interface SelectionLike {
  get(): BpmnElement[];
  select(elements: BpmnElement | BpmnElement[] | null, add?: boolean): void;
  isSelected(element: BpmnElement): boolean;
  deselect(element: BpmnElement): void;
}

export interface ElementRegistryLike {
  get(id: string): BpmnElement | undefined;
  getAll(): BpmnElement[];
  getGraphics(element: BpmnElement | string): SVGElement | undefined;
}

export interface CanvasViewbox {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

export interface CanvasLike {
  getContainer(): HTMLElement;
  getRootElement(): BpmnParent;
  getGraphics(element: BpmnElement | string): SVGElement;
  viewbox(): CanvasViewbox;
  zoom(): number;
  scrollToElement(element: BpmnElement | string, padding?: number): void;
  hasMarker(element: BpmnElement | string, marker: string): boolean;
  addMarker(element: BpmnElement | string, marker: string): void;
  removeMarker(element: BpmnElement | string, marker: string): void;
}

export interface EventBusLike {
  on(
    event: string | string[],
    priorityOrCallback: number | ((event: never) => unknown),
    callback?: (event: never) => unknown,
  ): void;
  off(event: string | string[], callback: (event: never) => unknown): void;
  fire(event: string, payload?: unknown): unknown;
}

export interface CommandStackLike {
  execute(command: string, context: Record<string, unknown>): void;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
}

/** Was die Editor-Schicht von der Modellierungsschicht braucht — nicht mehr. */
export interface ModelingLike {
  createShape(
    shape: Record<string, unknown> | BpmnShape,
    position: Point,
    target: BpmnParent,
    hints?: Record<string, unknown>,
  ): BpmnShape;
  appendShape(
    source: BpmnShape,
    shape: Record<string, unknown> | BpmnShape,
    position: Point,
    target: BpmnParent,
    hints?: Record<string, unknown>,
  ): BpmnShape;
  connect(
    source: BpmnElement,
    target: BpmnElement,
    attrs?: Record<string, unknown>,
    hints?: Record<string, unknown>,
  ): BpmnConnection;
  removeElements(elements: BpmnElement[]): void;
  moveElements(
    shapes: BpmnElement[],
    delta: Point,
    target?: BpmnParent,
    hints?: Record<string, unknown>,
  ): void;
  resizeShape(shape: BpmnShape, newBounds: Bounds): void;
  updateLabel(element: BpmnElement, newLabel: string): void;
  updateProperties(
    element: BpmnElement,
    properties: Record<string, unknown>,
  ): void;
  updateWaypoints(connection: BpmnConnection, waypoints: Point[]): void;
  reconnectStart(
    connection: BpmnConnection,
    newSource: BpmnElement,
    docking: Point | Point[],
  ): void;
  reconnectEnd(
    connection: BpmnConnection,
    newTarget: BpmnElement,
    docking: Point | Point[],
  ): void;
  replaceShape(
    oldShape: BpmnShape,
    newData: Record<string, unknown>,
    hints?: Record<string, unknown>,
  ): BpmnShape;
  alignElements(elements: BpmnElement[], alignment: Alignment): void;
  distributeElements(groups: unknown[], axis: string, dimension: string): void;
  addLane(shape: BpmnShape, location?: "top" | "bottom"): void;
  removeLane(shape: BpmnShape): void;
  updateAttachment(shape: BpmnShape, newHost: BpmnShape | null): void;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Alignment =
  "top" | "right" | "bottom" | "left" | "center" | "middle";

export interface ElementFactoryLike {
  createShape(attrs: Record<string, unknown>): BpmnShape;
  createConnection(attrs: Record<string, unknown>): BpmnConnection;
  createLabel(attrs: Record<string, unknown>): BpmnShape;
}

export interface BpmnFactoryLike {
  create(
    type: string,
    attrs?: Record<string, unknown>,
    options?: { parent?: ModdleElement; id?: string },
  ): ModdleElement;
  nextId(type: string): string;
}

export interface AutoPlaceLike {
  append(
    source: BpmnShape,
    shape: BpmnShape | Record<string, unknown>,
    hints?: Record<string, unknown>,
  ): BpmnShape;
}

export interface DraggingLike {
  cancel(): void;
  active(): unknown;
}

export interface CreateLike {
  start(
    event: Event,
    elements: BpmnElement | BpmnElement[],
    context?: Record<string, unknown>,
  ): void;
}

export interface ConnectLike {
  start(
    event: Event | null,
    start: BpmnElement,
    connectionStart?: Point | Record<string, unknown>,
    autoActivate?: boolean,
  ): void;
}

export interface CopyPasteLike {
  copy(elements: BpmnElement[], hints?: { clip: boolean }): unknown;
  paste(context?: Record<string, unknown>): BpmnElement[] | undefined;
  duplicate(
    elements: BpmnElement[],
    context?: Record<string, unknown>,
  ): BpmnElement[] | undefined;
  cut(elements: BpmnElement[]): unknown;
}

export interface ClipboardLike {
  get(): unknown;
  isEmpty(): boolean;
}

export interface AlignElementsLike {
  trigger(elements: BpmnElement[], alignment: Alignment): void;
}

export interface DistributeElementsLike {
  trigger(elements: BpmnElement[], orientation: string): unknown;
}

export interface GridSnappingLike {
  snapValue(value: number, constraints?: unknown): number;
  isActive(): boolean;
  setActive(active: boolean): void;
}

/** Konfiguration der Editor-Schicht (`config.editor` im `didi`-Bootstrap). */
export interface EditorConfig {
  /** Zeigt der Aufbau seine Bedienelemente, wenn nicht bearbeitet wird? */
  readonly chrome?: EditorChrome;
  /** Wird gerade bearbeitet? Ergibt sich sonst aus der Modulliste. */
  readonly editable?: boolean;
  /** Begründung, die eine deaktivierte Palette nennt. */
  readonly disabledReason?: string;
  /** Rasterweite für das Verschieben per Tastatur. */
  readonly gridStep?: number;
  /** Feine Schrittweite (Alt gedrückt). */
  readonly fineStep?: number;
  /** Palette-Einträge ergänzen oder ersetzen. */
  readonly paletteItems?: readonly PaletteItem[];
  /** Einzelne Einträge ausblenden (IDs aus dem Katalog). */
  readonly hidePaletteItems?: readonly string[];
}

/** Ein Eintrag der kuratierten Palette. */
export interface PaletteItem {
  /** Stabile Kennung, zugleich `data-action` im DOM. */
  readonly id: string;
  /** BPMN-Typ, der entsteht. */
  readonly type: string;
  /** Menschenlesbarer Name (deutsch) — zugleich zugänglicher Name. */
  readonly title: string;
  /** Gruppe der Palette. */
  readonly group: string;
  /** Ereignisdefinition, falls der Typ eine braucht. */
  readonly eventDefinitionType?: string | undefined;
  /** Weitere Attribute des grafischen Elements (`isExpanded`, …). */
  readonly attrs?: Readonly<Record<string, unknown>> | undefined;
  /** CSS-Klasse für das Symbol. */
  readonly className?: string | undefined;
  /** Kurzbeschreibung für die Statusansage. */
  readonly description?: string | undefined;
}

export interface PaletteGroup {
  readonly id: string;
  readonly label: string;
}

/** Ein Ziel des Typwechsels. */
export interface ReplaceOption {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly eventDefinitionType?: string | undefined;
  readonly attrs?: Readonly<Record<string, unknown>> | undefined;
}
