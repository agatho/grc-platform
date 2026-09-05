/// <reference lib="dom" />

/**
 * Prüfstand der Modellierungsschicht.
 *
 * Die Regel dieses Prüfstands ist die Lehre des Spikes: **nach jeder Operation
 * und nach jedem Undo laufen die Invarianten.** Nicht am Ende eines Tests,
 * nicht stichprobenhaft — nach jeder einzelnen. Ein Fehler in Schritt 3, der
 * sich in Schritt 7 zeigt, ist in dieser Schicht der Normalfall
 * (SPIKE-MESSUNG-MODEL §6); nur eine Prüfung nach jedem Schritt zeigt
 * *welcher* Schritt es war.
 *
 * {@link operate} macht daraus einen einzigen Aufruf: Operation ausführen →
 * prüfen → Undo → prüfen → Redo → prüfen. Damit hat jede Operation ohne
 * zusätzlichen Testcode die Abdeckung, die die Abnahme verlangt.
 */

import { installSvgPolyfills } from "../../draw/helpers/jsdom-svg";
import MoveModule from "diagram-js/lib/features/move/index.js";
import ResizeModule from "diagram-js/lib/features/resize/index.js";
import {
  ModelingSession,
  type ModelingSessionOptions,
} from "../../../src/modeling/session";
import { formatViolations } from "../../../src/modeling/invariants";

installSvgPolyfills();

/** Eine Sitzung mit Container, so wie sie im Browser entstünde. */
export async function openSession(
  xml: string,
  options: ModelingSessionOptions = {},
): Promise<ModelingSession> {
  const container = document.createElement("div");
  container.style.width = "1200px";
  container.style.height = "800px";
  document.body.appendChild(container);

  const session = new ModelingSession({
    container,
    additionalModules: [MoveModule, ResizeModule],
    ...options,
  });
  await session.importXml(xml);
  session.assertInvariants("nach dem Import");
  return session;
}

export interface OperateOptions {
  /** Undo/Redo mitprüfen. Vorgabe `true` — Abweichungen sind zu begründen. */
  readonly undo?: boolean;
  /** Zusicherung, die nach der Operation gelten muss (vor dem Undo). */
  readonly after?: () => void;
  /** Zusicherung, die nach dem Undo gelten muss. */
  readonly afterUndo?: () => void;
}

/**
 * Führt eine Operation aus und prüft die Invarianten danach, nach dem Undo und
 * nach dem Redo.
 *
 * Der Rückgabewert ist der der Operation — so lassen sich erzeugte Elemente
 * weiterverwenden, ohne die Prüfung zu umgehen.
 */
export function operate<T>(
  session: ModelingSession,
  label: string,
  operation: () => T,
  options: OperateOptions = {},
): T {
  const result = operation();
  session.assertInvariants(`${label} — nach der Operation`);
  options.after?.();

  if (options.undo === false) return result;

  session.undo();
  session.assertInvariants(`${label} — nach dem Undo`);
  options.afterUndo?.();

  session.redo();
  session.assertInvariants(`${label} — nach dem Redo`);

  return result;
}

/**
 * Wie {@link operate}, macht die Operation aber am Ende dauerhaft rückgängig.
 * Für Operationen, die den Aufbau des Diagramms für nachfolgende Prüfungen
 * zerstören würden.
 */
export function operateAndUndo<T>(
  session: ModelingSession,
  label: string,
  operation: () => T,
  options: OperateOptions = {},
): T {
  const result = operate(session, label, operation, options);
  session.undo();
  session.assertInvariants(`${label} — endgültig zurückgenommen`);
  return result;
}

/** Lesbare Fehlermeldung für erwartete Verletzungen (Negativtests). */
export function describeViolations(session: ModelingSession): string {
  return formatViolations(session.checkInvariants());
}

/** Alle `flowNodeRef`-Ids einer Lane. */
export function laneRefs(session: ModelingSession, laneId: string): string[] {
  const lane = session.shape(laneId).businessObject;
  const refs = lane["flowNodeRef"];
  if (!Array.isArray(refs)) return [];
  return refs
    .map((entry) => (entry as { id?: unknown }).id)
    .filter((id): id is string => typeof id === "string")
    .sort();
}

/** Ids der `flowElements` eines semantischen Containers. */
export function flowElementIds(container: {
  [key: string]: unknown;
}): string[] {
  const list = container["flowElements"];
  if (!Array.isArray(list)) return [];
  return list
    .map((entry) => (entry as { id?: unknown }).id)
    .filter((id): id is string => typeof id === "string");
}
