/**
 * `ModelingSession` — ein bearbeitbares Diagramm in einem Aufruf.
 *
 * Sie ist bewusst **Produktivcode und nicht Testinfrastruktur**: dieselbe
 * Klasse trägt später die React-Fassade (`<BpmnCanvas mode="edit">`, Plan
 * §2.4), den Shadow-Compare-Lauf aus §5.4 und die eigenschaftsbasierten Tests
 * eines anderen Arbeitsstrangs. Sie ist der einzige Ort, an dem die
 * Modulliste, der Import und der Zugriff auf die drei Bäume zusammenkommen —
 * damit niemand eine vierte Variante davon schreibt.
 *
 * `assertInvariants()` gehört zur Sitzung, nicht zu den Tests: der Prüfer
 * braucht alle drei Bäume, und nur hier liegen sie zusammen.
 */

/// <reference lib="dom" />

import Diagram from "diagram-js";
import type Canvas from "diagram-js/lib/core/Canvas.js";
import type CommandStack from "diagram-js/lib/command/CommandStack.js";
import type ElementRegistry from "diagram-js/lib/core/ElementRegistry.js";
import type EventBus from "diagram-js/lib/core/EventBus.js";

import { exportXml, importXml } from "../model/io.js";
import drawModule from "../draw/index.js";
import modelingModule from "./index.js";
import type { BpmnImporter, ImportDefinitionsResult } from "./importer.js";
import {
  checkInvariants,
  formatViolations,
  InvariantError,
  type InvariantCode,
  type InvariantViolation,
} from "./invariants.js";
import type { BpmnModeling } from "./Modeling.js";
import type {
  BpmnConnection,
  BpmnElement,
  BpmnRoot,
  BpmnShape,
  ModdleElement,
} from "./types.js";

export interface ModelingSessionOptions {
  /** Container für das SVG. Ohne DOM (reine Modelltests) genügt ein Stub. */
  readonly container?: HTMLElement;
  /** Zusätzliche `diagram-js`-Module (Move, Resize, Bendpoints, …). */
  readonly additionalModules?: readonly unknown[];
  /** Fehlende DI beim Import ergänzen. Vorgabe `true`. */
  readonly repairMissingDi?: boolean;
  /** Invariantenprüfungen, die für diese Sitzung nicht gelten. */
  readonly ignoreInvariants?: readonly InvariantCode[];
}

export class ModelingSession {
  readonly diagram: Diagram;
  readonly canvas: Canvas;
  readonly elementRegistry: ElementRegistry;
  readonly eventBus: EventBus;
  readonly commandStack: CommandStack;
  readonly modeling: BpmnModeling;

  private importResult: ImportDefinitionsResult | undefined;

  constructor(private readonly options: ModelingSessionOptions = {}) {
    const container =
      options.container ??
      (typeof document !== "undefined"
        ? document.createElement("div")
        : undefined);

    this.diagram = new Diagram({
      canvas: container ? { container } : {},
      modules: [
        drawModule,
        modelingModule,
        ...(options.additionalModules ?? []),
      ] as never,
    });

    this.canvas = this.diagram.get<Canvas>("canvas");
    this.elementRegistry = this.diagram.get<ElementRegistry>("elementRegistry");
    this.eventBus = this.diagram.get<EventBus>("eventBus");
    this.commandStack = this.diagram.get<CommandStack>("commandStack");
    this.modeling = this.diagram.get<BpmnModeling>("modeling");
  }

  /** Lädt BPMN-XML in die Sitzung. */
  async importXml(xml: string): Promise<ImportDefinitionsResult> {
    const { definitions } = await importXml(xml);
    return this.importDefinitions(definitions);
  }

  importDefinitions(definitions: ModdleElement): ImportDefinitionsResult {
    const importer = this.diagram.get<BpmnImporter>("bpmnImporter");
    const result = importer.import(definitions, {
      repairMissingDi: this.options.repairMissingDi !== false,
    });
    this.importResult = result;
    return result;
  }

  /** Schreibt den aktuellen Modellstand als BPMN-XML. */
  async exportXml(): Promise<string> {
    return exportXml(this.definitions(), { preferPreservedSource: false });
  }

  definitions(): ModdleElement {
    const definitions = this.importResult?.definitions;
    if (!definitions) {
      throw new Error("In dieser Sitzung ist kein Diagramm geladen.");
    }
    return definitions;
  }

  root(): BpmnRoot {
    const root = this.importResult?.root;
    if (!root) {
      throw new Error("In dieser Sitzung ist kein Diagramm geladen.");
    }
    return root;
  }

  plane(): ModdleElement {
    const plane = this.importResult?.plane;
    if (!plane) {
      throw new Error("In dieser Sitzung ist kein Diagramm geladen.");
    }
    return plane;
  }

  get<T>(service: string): T {
    return this.diagram.get<T>(service);
  }

  element(id: string): BpmnElement {
    const element = this.elementRegistry.get(id) as BpmnElement | undefined;
    if (!element) {
      throw new Error(`Es gibt kein Element mit der id ${id}.`);
    }
    return element;
  }

  shape(id: string): BpmnShape {
    return this.element(id) as BpmnShape;
  }

  connection(id: string): BpmnConnection {
    return this.element(id) as BpmnConnection;
  }

  has(id: string): boolean {
    return this.elementRegistry.get(id) !== undefined;
  }

  undo(): void {
    this.commandStack.undo();
  }

  redo(): void {
    this.commandStack.redo();
  }

  /**
   * Befunde des Invariantenprüfers über alle drei Bäume — **ohne** die, die
   * die Eingabedatei schon mitbrachte.
   *
   * Der Abzug geschieht befundgenau (Code **und** Element), nicht
   * prüfungsweise: ein zweiter Fehler derselben Art an einem anderen Element
   * wird gemeldet. Nur so bleibt die Aussage „diese Operation hat nichts
   * kaputt gemacht" belastbar, auch über einer Datei, die bereits einen Defekt
   * mitbringt.
   */
  checkInvariants(): InvariantViolation[] {
    const violations = checkInvariants({
      definitions: this.definitions(),
      elementRegistry: this.elementRegistry as never,
      ignore: this.options.ignoreInvariants,
    });
    const baseline = new Set(this.preexistingViolations().map(keyOfViolation));
    if (baseline.size === 0) return violations;
    return violations.filter((v) => !baseline.has(keyOfViolation(v)));
  }

  /** Was die Eingabedatei an Fehlern schon mitbrachte. */
  preexistingViolations(): readonly InvariantViolation[] {
    return this.importResult?.preexistingViolations ?? [];
  }

  /** Wie {@link checkInvariants}, wirft aber — der Aufruf nach jeder Operation. */
  assertInvariants(label?: string): void {
    const violations = this.checkInvariants();
    if (violations.length === 0) return;
    const error = new InvariantError(violations);
    error.message = formatViolations(violations, label);
    throw error;
  }

  destroy(): void {
    this.diagram.destroy();
  }
}

/** Befund-Identität für den Abzug der Grundlinie: Prüfung **und** Element. */
function keyOfViolation(violation: InvariantViolation): string {
  return `${violation.code}\u0000${violation.elementId ?? ""}`;
}

/** Bequemer Einstieg: Sitzung anlegen und XML laden. */
export async function createModelingSession(
  xml: string,
  options: ModelingSessionOptions = {},
): Promise<ModelingSession> {
  const session = new ModelingSession(options);
  await session.importXml(xml);
  return session;
}
