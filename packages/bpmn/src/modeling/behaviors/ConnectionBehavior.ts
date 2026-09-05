/**
 * Kanten nach einem Containerwechsel wieder in Ordnung bringen.
 *
 * Ein Knoten, der in einen anderen Pool oder Subprozess gezogen wird, nimmt
 * seine Kanten mit — und **danach** sind sie falsch: Ein Sequenzfluss darf
 * nach BPMN 2.0 (§7.3, §10) nur innerhalb *eines* Containers laufen,
 * zwischen Pools gehört ein Nachrichtenfluss hin. Ohne Nachführung entsteht
 * genau das, wovor der Invariantenprüfer warnt:
 *
 * ```
 * structure/sequence-flow-crosses-container @ Flow_K1:
 *   sequence flow connects Start_Kunde in Process_Kunde to Task_Kunde_Antrag
 *   in Process_Bank
 * ```
 *
 * Und das ist keine Schönheitsfrage: `moddle` schreibt den Fluss beim Export
 * in `flowElements` **eines** Prozesses; der Leser findet dort einen Verweis
 * auf einen Knoten, den dieser Prozess nicht enthält, und verwirft ihn still
 * (Round-Trip-Bericht, Ursache 2). Am Bild sieht die Kante völlig richtig aus.
 *
 * **Was hier geschieht.** Nach jedem `elements.move` wird jede Kante, die an
 * einem bewegten Knoten hängt, den Regeln vorgelegt (`connection.reconnect`).
 * Ist sie dort weiterhin zulässig, bleibt sie unangetastet. Ist sie es nicht,
 * entscheidet **dieselbe** Regelfunktion, die auch beim Ziehen einer neuen
 * Kante entscheidet (`canConnect`), was aus ihr wird:
 *
 *  - Sie schlägt einen anderen Kantentyp vor — der Regelfall beim Wechsel
 *    zwischen Pools: aus dem Sequenzfluss wird ein `bpmn:MessageFlow`. Die
 *    Kante wird ersetzt, ihr Name geht mit.
 *  - Sie schlägt nichts vor — etwa beim Zug in einen Ereignis-Subprozess, der
 *    an keinem Sequenzfluss hängen darf. Dann wird die Kante entfernt.
 *
 * Beides läuft in `postExecuted`, also **innerhalb** desselben
 * Kommandodurchlaufs: ein einziges Strg-Z nimmt Zug und Kantenumbau gemeinsam
 * zurück. Eine stumme dritte Möglichkeit — die Kante falsch stehen lassen —
 * gibt es nicht, und das ist der ganze Zweck dieser Datei.
 */

import CommandInterceptor from "diagram-js/lib/command/CommandInterceptor.js";
import type EventBus from "diagram-js/lib/core/EventBus.js";
import { canConnect } from "../BpmnRules";
import type { BpmnConnection, BpmnElement, BpmnShape } from "../types";
import { boOf, isConnectionElement } from "../util";

interface ModelingLike {
  removeConnection(connection: BpmnConnection): void;
  connect(
    source: BpmnElement,
    target: BpmnElement,
    attrs?: Record<string, unknown>,
  ): BpmnConnection;
}

interface RulesLike {
  allowed(action: string, context: Record<string, unknown>): unknown;
}

/**
 * Alle Kanten, die von einer Bewegung betroffen sein können.
 *
 * `MoveElementsHandler` legt die Hülle der Bewegung in `context.closure`; sie
 * enthält bereits jede ein- und ausgehende Kante. Fehlt sie (ein Aufrufer, der
 * das Kommando selbst zusammensetzt), werden die Kanten aus den bewegten
 * Formen gelesen — dasselbe Ergebnis, nur langsamer.
 */
export function affectedConnections(
  context: Record<string, unknown>,
): BpmnConnection[] {
  const closure = context["closure"] as
    { allConnections?: Record<string, BpmnConnection> } | undefined;
  const fromClosure = closure?.allConnections;
  if (fromClosure) return Object.values(fromClosure);

  const shapes = (context["shapes"] as BpmnShape[] | undefined) ?? [];
  const out = new Set<BpmnConnection>();
  for (const shape of shapes) {
    for (const connection of [
      ...(shape.incoming ?? []),
      ...(shape.outgoing ?? []),
    ]) {
      if (isConnectionElement(connection))
        out.add(connection as BpmnConnection);
    }
  }
  return [...out];
}

export class ConnectionBehavior extends CommandInterceptor {
  static $inject = ["eventBus", "modeling", "rules"];

  constructor(
    eventBus: EventBus,
    private readonly modeling: ModelingLike,
    private readonly rules: RulesLike,
  ) {
    super(eventBus);

    this.postExecuted(
      "elements.move",
      (event: { context?: Record<string, unknown> }) => {
        if (event.context) this.repair(event.context);
      },
    );
  }

  private repair(context: Record<string, unknown>): void {
    for (const connection of affectedConnections(context)) {
      const source = connection.source;
      const target = connection.target;
      if (!source || !target) continue;
      // Die Kante ist inzwischen vielleicht schon weg (Löschkaskade eines
      // anderen Zuhörers) — dann gibt es nichts zu reparieren.
      if (connection.parent === undefined) continue;

      const stillValid = this.rules.allowed("connection.reconnect", {
        connection,
        source,
        target,
      });
      if (stillValid !== false) continue;

      const suggestion = canConnect(source, target);
      const name = boOf(connection)?.["name"];

      this.modeling.removeConnection(connection);
      if (suggestion === false || suggestion === null || suggestion === true) {
        continue;
      }
      this.modeling.connect(source, target, {
        type: suggestion.type,
        ...(typeof name === "string" && name !== "" ? { name } : {}),
      });
    }
  }
}

export default ConnectionBehavior;
