/**
 * F6 — Ausfall- und Abhängigkeitssimulation (Plan §3.10).
 *
 * Die Funktion, die ein generischer BPMN-Editor nicht bauen kann, weil ihm die
 * Asset- und Kontinuitätsdaten fehlen:
 *
 * > „Anwendung SAP FI fällt aus" → alle Schritte mit `process_step_asset` auf
 * > dieses Asset sind **betroffen**; alle nachgelagerten Schritte sind
 * > **blockiert**, sofern sie keinen dokumentierten Workaround haben; oben steht
 * > die aggregierte Auswirkung samt MTPD-Reißpunkt.
 *
 * Die Traversierung läuft auf der Szene — kein Backend nötig.
 */

import type { BpmnShape } from "../draw/types.js";
import type { GrcBia, GrcOverlayData } from "./contract.js";
import { type GrcGraph } from "./graph.js";

export type OutageState = "affected" | "blocked" | "workaround" | "unaffected";

export interface OutageStep {
  readonly elementId: string;
  readonly elementName: string;
  readonly state: OutageState;
  readonly bia: GrcBia | undefined;
  /** Bei `workaround`: wie lange er trägt. */
  readonly workaroundMinutes: number | undefined;
  readonly describe: string;
}

export interface OutageResult {
  readonly assetId: string;
  readonly assetName: string;
  readonly steps: ReadonlyMap<string, OutageStep>;
  readonly affectedCount: number;
  readonly blockedCount: number;
  readonly workaroundCount: number;
  readonly totalSteps: number;
  /**
   * Kürzestes MTPD unter den ausgefallenen Schritten — der Reißpunkt des
   * Prozesses. Nach §3.10 ist das MTPD des Prozesses das Minimum über seine
   * kritischen Schritte; hier wird es gerechnet statt geschätzt.
   */
  readonly mtpdMinutes: number | undefined;
  readonly mtpdElementId: string | undefined;
  /** Bereits verstrichene Ausfallzeit aus dem Szenario. */
  readonly elapsedMinutes: number | undefined;
  /** Minuten bis zum Reißpunkt; negativ = bereits überschritten. */
  readonly minutesToBreach: number | undefined;
  /** Der Satz für die Kopfzeile über dem Diagramm. */
  readonly summary: string;
}

/**
 * Ob ein Schritt einen belastbaren Workaround hat.
 *
 * „Dokumentiert" heißt: ein Text steht da. Eine Dauer von 0 Minuten zählt
 * ausdrücklich nicht — ein Ausweichverfahren, das keine Zeit überbrückt, ist
 * keines.
 */
function hasWorkaround(bia: GrcBia | undefined): boolean {
  if (!bia?.workaround) {
    return false;
  }
  return (
    bia.workaroundMaxDurationMinutes === undefined ||
    bia.workaroundMaxDurationMinutes > 0
  );
}

export function simulateOutage(
  graph: GrcGraph,
  data: GrcOverlayData,
): OutageResult | undefined {
  const scenario = data.diagram?.outage;
  if (!scenario) {
    return undefined;
  }

  const shapes = [...graph.shapes.values()].filter(
    (shape) => shape.type !== "bpmn:Lane" && shape.type !== "bpmn:Participant",
  );

  const affected = new Set<string>();
  for (const shape of shapes) {
    const assets = data.elements[shape.id]?.assets ?? [];
    if (assets.some((asset) => asset.id === scenario.assetId)) {
      affected.add(shape.id);
    }
  }

  // Ausbreitung: von jedem betroffenen Schritt entlang der Flüsse. Ein Schritt
  // mit dokumentiertem Workaround gilt nicht als blockiert und stoppt die
  // Ausbreitung — er kann den Ablauf fortsetzen. Das ist die entscheidende
  // Modellannahme dieser Simulation und deshalb hier ausdrücklich benannt.
  const blocked = new Set<string>();
  const workaround = new Set<string>();
  const queue = [...affected];
  const seen = new Set<string>(affected);

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      continue;
    }
    for (const connection of graph.outgoing.get(current) ?? []) {
      const target = connection.target;
      if (!target || seen.has(target.id) || affected.has(target.id)) {
        continue;
      }
      seen.add(target.id);
      const bia = data.elements[target.id]?.bia;
      if (hasWorkaround(bia)) {
        workaround.add(target.id);
        continue;
      }
      blocked.add(target.id);
      queue.push(target.id);
    }
  }

  const steps = new Map<string, OutageStep>();
  let mtpd: number | undefined;
  let mtpdElementId: string | undefined;

  for (const shape of shapes) {
    const bia = data.elements[shape.id]?.bia;
    const state: OutageState = affected.has(shape.id)
      ? "affected"
      : blocked.has(shape.id)
        ? "blocked"
        : workaround.has(shape.id)
          ? "workaround"
          : "unaffected";

    if (
      (state === "affected" || state === "blocked") &&
      bia?.mtpdMinutes !== undefined &&
      (mtpd === undefined || bia.mtpdMinutes < mtpd)
    ) {
      mtpd = bia.mtpdMinutes;
      mtpdElementId = shape.id;
    }

    if (state !== "unaffected") {
      steps.set(shape.id, {
        elementId: shape.id,
        elementName: nameOf(shape),
        state,
        bia,
        workaroundMinutes: bia?.workaroundMaxDurationMinutes,
        describe: describeStep(nameOf(shape), state, bia, scenario.assetName),
      });
    }
  }

  const elapsed = scenario.elapsedMinutes;
  const minutesToBreach =
    mtpd === undefined || elapsed === undefined ? undefined : mtpd - elapsed;

  const assetName = scenario.assetName ?? scenario.assetId;
  const affectedTotal = affected.size + blocked.size;

  const summaryParts = [
    `Ausfall „${assetName}": ${String(affectedTotal)} von ${String(
      shapes.length,
    )} Schritten betroffen (${String(affected.size)} direkt, ${String(
      blocked.size,
    )} blockiert)`,
  ];
  if (workaround.size > 0) {
    summaryParts.push(`${String(workaround.size)} mit Ausweichverfahren`);
  }
  if (mtpd !== undefined) {
    summaryParts.push(
      minutesToBreach === undefined
        ? `kürzestes MTPD ${formatMinutes(mtpd)}`
        : minutesToBreach >= 0
          ? `MTPD ${formatMinutes(mtpd)} — Reißpunkt in ${formatMinutes(minutesToBreach)}`
          : `MTPD ${formatMinutes(mtpd)} seit ${formatMinutes(-minutesToBreach)} überschritten`,
    );
  } else {
    summaryParts.push("kein MTPD hinterlegt");
  }

  return {
    assetId: scenario.assetId,
    assetName,
    steps,
    affectedCount: affected.size,
    blockedCount: blocked.size,
    workaroundCount: workaround.size,
    totalSteps: shapes.length,
    mtpdMinutes: mtpd,
    mtpdElementId,
    elapsedMinutes: elapsed,
    minutesToBreach,
    summary: `${summaryParts.join(", ")}.`,
  };
}

/** Minuten in eine lesbare deutsche Dauer. */
export function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  if (total < 60) {
    return `${String(total)} min`;
  }
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours < 24) {
    return rest === 0
      ? `${String(hours)} h`
      : `${String(hours)} h ${String(rest)} min`;
  }
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours === 0
    ? `${String(days)} T`
    : `${String(days)} T ${String(restHours)} h`;
}

function describeStep(
  name: string,
  state: OutageState,
  bia: GrcBia | undefined,
  assetName: string | undefined,
): string {
  switch (state) {
    case "affected":
      return `Direkt vom Ausfall betroffen${
        assetName ? ` (${assetName})` : ""
      }${bia?.mtpdMinutes !== undefined ? `, MTPD ${formatMinutes(bia.mtpdMinutes)}` : ""}.`;
    case "blocked":
      return `Blockiert: „${name}" hängt an einem ausgefallenen Schritt und hat kein dokumentiertes Ausweichverfahren.`;
    case "workaround":
      return `Ausweichverfahren vorhanden${
        bia?.workaroundMaxDurationMinutes !== undefined
          ? `, trägt ${formatMinutes(bia.workaroundMaxDurationMinutes)}`
          : ""
      }: ${bia?.workaround ?? ""}`.trim();
    default:
      return "Nicht betroffen.";
  }
}

function nameOf(shape: BpmnShape): string {
  const name = shape.businessObject.name;
  return typeof name === "string" && name !== "" ? name : shape.id;
}
