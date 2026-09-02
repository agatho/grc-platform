/// <reference lib="dom" />

/**
 * Prüfstand der Editor-Schicht.
 *
 * Die Regel ist dieselbe wie in `test/modeling/helpers/harness.ts` und aus
 * demselben Grund: **nach jeder Bedienhandlung und nach jedem Undo laufen die
 * Invarianten.** Der Auftrag verlangt das ausdrücklich („Für jede
 * Bedienhandlung ein Test, der nach der Handlung und nach Undo die Invarianten
 * prüft"), und die Modellierungsschicht hat vorgemacht, warum: Ein Fehler in
 * Schritt 3, der sich in Schritt 7 zeigt, ist hier der Normalfall.
 *
 * {@link act} macht daraus einen Aufruf. Der Unterschied zu `operate()` der
 * Modellierungsschicht ist die Maßeinheit: dort wird pro *Kommando* geprüft,
 * hier pro *Bedienhandlung*. Eine Bedienhandlung kann mehrere Kommandos kosten
 * (Anlegen samt Kante kostet drei), die `undo()` aber gemeinsam zurücknimmt.
 * Gezählt wird deshalb in Strg-Z — der Zahl, die der Benutzer erlebt. Eine
 * Handlung, die mehr als einen Rückschritt kostet, ist selbst ein Befund;
 * {@link act} macht ihn sichtbar, statt ihn zu verstecken.
 */

import type CommandStack from "diagram-js/lib/command/CommandStack.js";

import { installSvgPolyfills } from "../../draw/helpers/jsdom-svg.js";
import { createEditorSession } from "../../../src/editor/index.js";
import type { EditorConfig } from "../../../src/editor/types.js";
import type { ModelingSession } from "../../../src/modeling/session.js";
import type { InvariantCode } from "../../../src/modeling/invariants.js";
import type { EditorAnnouncer } from "../../../src/editor/announce.js";

// `installSvgPolyfills` bringt `CSS.escape` mit — dieselbe Rechenhilfe wie für
// jede andere jsdom-Lücke, an einer Stelle.
installSvgPolyfills();

export interface OpenEditorOptions {
  readonly editor?: EditorConfig;
  readonly width?: number;
  readonly height?: number;
  /** Invariantenprüfungen, die in dieser Sitzung nicht gelten (mit Begründung!). */
  readonly ignoreInvariants?: readonly InvariantCode[];
}

export interface EditorHarness {
  readonly session: ModelingSession;
  readonly container: HTMLElement;
  readonly canvasContainer: HTMLElement;
  service<T>(name: string): T;
  announcer(): EditorAnnouncer;
  /** Der zuletzt angesagte Satz. */
  said(): string;
  key(init: KeyboardEventInit, target?: EventTarget): void;
  destroy(): void;
}

/** Öffnet eine bearbeitbare Sitzung samt Bedienschicht in einem DOM-Container. */
export async function openEditor(
  xml: string,
  options: OpenEditorOptions = {},
): Promise<EditorHarness> {
  const container = document.createElement("div");
  container.style.width = `${String(options.width ?? 1200)}px`;
  container.style.height = `${String(options.height ?? 800)}px`;
  document.body.appendChild(container);

  const session = await createEditorSession(xml, {
    container,
    ...(options.editor ? { editor: options.editor } : {}),
    ...(options.ignoreInvariants
      ? { ignoreInvariants: options.ignoreInvariants }
      : {}),
  });
  session.assertInvariants("nach dem Import");

  const canvasContainer = session.canvas.getContainer();

  return {
    session,
    container,
    canvasContainer,
    service<T>(name: string): T {
      return session.get<T>(name);
    },
    announcer(): EditorAnnouncer {
      return session.get<EditorAnnouncer>("editorAnnouncer");
    },
    said(): string {
      return session.get<EditorAnnouncer>("editorAnnouncer").last();
    },
    key(init: KeyboardEventInit, target?: EventTarget): void {
      const node = target ?? canvasContainer;
      node.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          ...init,
        }),
      );
    },
    destroy(): void {
      session.destroy();
      container.remove();
    },
  };
}

export interface ActOptions {
  /** Zusicherung nach der Handlung, vor dem Undo. */
  readonly after?: () => void;
  /** Zusicherung, nachdem die Handlung zurückgenommen wurde. */
  readonly afterUndo?: () => void;
  /** Undo/Redo mitprüfen. Vorgabe `true`; Abweichungen sind zu begründen. */
  readonly undo?: boolean;
  /** Erwartete Zahl der Strg-Z. Vorgabe: keine Erwartung. */
  readonly undoSteps?: number;
}

export interface ActResult<T> {
  readonly value: T;
  /** Wie viele Strg-Z die Handlung gekostet hat. */
  readonly undoSteps: number;
}

/**
 * Führt eine Bedienhandlung aus und prüft die Invarianten danach, nach jedem
 * Undo und nach jedem Redo.
 *
 * **Gezählt wird in Strg-Z, nicht in Kommandos.** `commandStack._stackIdx`
 * zählt Kommandos; ein zusammengesetztes Kommando (Anlegen samt Kante) besteht
 * aus dreien, die `undo()` aber gemeinsam zurücknimmt — sie teilen sich eine
 * Aktions-Kennung. Die Zahl, die den Benutzer interessiert, ist die der
 * Tastendrücke: „ein Bedienschritt, ein Strg-Z". Deshalb wird zurückgenommen,
 * bis der Stapelzeiger wieder auf dem Ausgangswert steht, und dabei gezählt.
 */
export function act<T>(
  harness: EditorHarness,
  label: string,
  handling: () => T,
  options: ActOptions = {},
): ActResult<T> {
  const stack = harness.session.commandStack as unknown as CommandStack & {
    _stackIdx: number;
  };
  const before = stack._stackIdx;
  const value = handling();

  harness.session.assertInvariants(`${label} — nach der Handlung`);
  options.after?.();

  if (options.undo === false || stack._stackIdx <= before) {
    return { value, undoSteps: 0 };
  }

  let undoSteps = 0;
  while (stack._stackIdx > before && harness.session.commandStack.canUndo()) {
    harness.session.undo();
    undoSteps += 1;
    harness.session.assertInvariants(
      `${label} — nach Undo ${String(undoSteps)}`,
    );
  }
  options.afterUndo?.();

  if (options.undoSteps !== undefined && undoSteps !== options.undoSteps) {
    throw new Error(
      `${label}: ${String(undoSteps)} mal Strg-Z statt ${String(options.undoSteps)}. ` +
        "Eine Bedienhandlung, die mehr als einen Rückschritt kostet, ist selbst ein Befund.",
    );
  }

  for (let step = 0; step < undoSteps; step += 1) {
    harness.session.redo();
    harness.session.assertInvariants(
      `${label} — nach Redo ${String(step + 1)} von ${String(undoSteps)}`,
    );
  }
  return { value, undoSteps };
}

/**
 * Wie {@link act}, nimmt die Handlung am Ende aber dauerhaft zurück — für
 * Handlungen, die den Aufbau für die folgenden Prüfungen zerstören würden.
 */
export function actAndUndo<T>(
  harness: EditorHarness,
  label: string,
  handling: () => T,
  options: ActOptions = {},
): ActResult<T> {
  const result = act(harness, label, handling, options);
  for (let step = 0; step < result.undoSteps; step += 1) {
    harness.session.undo();
  }
  harness.session.assertInvariants(`${label} — endgültig zurückgenommen`);
  return result;
}
