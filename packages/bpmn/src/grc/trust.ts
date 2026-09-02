/**
 * F5 — Datenfluss über Vertrauensgrenzen (Plan §3.9).
 *
 * Die Frage, für die es heute in ARCTOS keine Antwort auf einer Fläche gibt:
 * *Wo verlassen personenbezogene Daten unseren Verantwortungsbereich?*
 *
 * Eine Vertrauensgrenze liegt zwischen zwei Elementen, wenn sich der Träger
 * ihrer Lane bzw. ihres Pools ändert und der Zielträger extern ist — ein
 * Dienstleister (`process_lane.vendor_id`) oder eine Stelle im Drittland
 * (`third_country`). Ohne `process_lane` (§3.11) ist der Fall nicht entscheidbar;
 * fehlen die Lane-Daten, meldet die Funktion nichts statt zu raten.
 */

import type { BpmnConnection, BpmnShape } from "../draw/types";
import type { GrcLaneData, GrcOverlayData } from "./contract";
import { laneOf, type GrcGraph } from "./graph";
import { personalDataStage } from "./analysis";

export interface TrustCrossing {
  readonly edgeId: string;
  readonly fromElementId: string | undefined;
  readonly toElementId: string | undefined;
  /** Warum die Grenze gilt. */
  readonly reason: "vendor" | "third-country" | "external";
  readonly fromParty: string;
  readonly toParty: string;
  /** ISO-3166-1 alpha-2 der Zielseite, falls bekannt — Inhalt des Chips. */
  readonly country: string | undefined;
  readonly safeguard: string | undefined;
  /** Führt die Kante personenbezogene Daten? */
  readonly personalData: boolean;
  readonly specialCategory: boolean;
  readonly describe: string;
}

export interface TrustResult {
  readonly crossings: readonly TrustCrossing[];
  readonly byEdgeId: ReadonlyMap<string, TrustCrossing>;
}

/** Externer Träger — Dienstleister, Drittland oder ausdrücklich als extern markiert. */
function externality(lane: GrcLaneData | undefined): {
  external: boolean;
  reason: TrustCrossing["reason"] | undefined;
} {
  if (!lane) {
    return { external: false, reason: undefined };
  }
  if (lane.thirdCountry) {
    return { external: true, reason: "third-country" };
  }
  if (lane.vendor) {
    return { external: true, reason: "vendor" };
  }
  if (lane.isExternal) {
    return { external: true, reason: "external" };
  }
  return { external: false, reason: undefined };
}

function partyName(
  lane: GrcLaneData | undefined,
  shape: BpmnShape | undefined,
): string {
  if (lane?.vendor?.name) {
    return lane.vendor.name;
  }
  if (lane?.name) {
    return lane.name;
  }
  if (lane?.orgUnit?.title) {
    return lane.orgUnit.title;
  }
  const name = shape?.businessObject.name;
  return typeof name === "string" && name !== "" ? name : "eigener Bereich";
}

export function computeTrustBoundaries(
  graph: GrcGraph,
  data: GrcOverlayData,
): TrustResult {
  const crossings: TrustCrossing[] = [];

  for (const connection of graph.scene.connections) {
    const source = connection.source;
    const target = connection.target;
    if (!source || !target) {
      continue;
    }

    const sourceLaneShape = laneOf(graph, source.id);
    const targetLaneShape = laneOf(graph, target.id);
    const sourceLane = sourceLaneShape
      ? data.lanes?.[sourceLaneShape.id]
      : undefined;
    const targetLane = targetLaneShape
      ? data.lanes?.[targetLaneShape.id]
      : undefined;

    if (
      sourceLaneShape &&
      targetLaneShape &&
      sourceLaneShape.id === targetLaneShape.id
    ) {
      continue;
    }

    const to = externality(targetLane);
    const from = externality(sourceLane);
    // Grenze in beide Richtungen: Daten, die von einem Dienstleister
    // zurückkommen, überschreiten sie ebenso.
    const reason = to.external
      ? to.reason
      : from.external
        ? from.reason
        : undefined;
    if (!reason) {
      continue;
    }

    const personal = carriesPersonalData(data, connection, source, target);
    const special =
      personalDataStage(data.elements[source.id]?.ropa) === "special" ||
      personalDataStage(data.elements[target.id]?.ropa) === "special";

    const country =
      (to.external ? targetLane?.thirdCountry : sourceLane?.thirdCountry) ??
      data.elements[source.id]?.ropa?.transferCountry;
    const safeguard = data.elements[source.id]?.ropa?.transferSafeguard;

    const fromParty = partyName(sourceLane, sourceLaneShape);
    const toParty = partyName(targetLane, targetLaneShape);

    crossings.push({
      edgeId: connection.id,
      fromElementId: source.id,
      toElementId: target.id,
      reason,
      fromParty,
      toParty,
      country,
      safeguard,
      personalData: personal,
      specialCategory: special,
      describe: describeCrossing({
        fromParty,
        toParty,
        reason,
        country,
        safeguard,
        personal,
        special,
      }),
    });
  }

  return {
    crossings,
    byEdgeId: new Map(
      crossings.map((crossing) => [crossing.edgeId, crossing] as const),
    ),
  };
}

function carriesPersonalData(
  data: GrcOverlayData,
  connection: BpmnConnection,
  source: BpmnShape,
  target: BpmnShape,
): boolean {
  const explicit = data.edges?.[connection.id]?.carriesPersonalData;
  if (explicit !== undefined) {
    return explicit;
  }
  return (
    personalDataStage(data.elements[source.id]?.ropa) !== "none" ||
    personalDataStage(data.elements[target.id]?.ropa) !== "none"
  );
}

function describeCrossing(input: {
  fromParty: string;
  toParty: string;
  reason: TrustCrossing["reason"];
  country: string | undefined;
  safeguard: string | undefined;
  personal: boolean;
  special: boolean;
}): string {
  const reasonWord =
    input.reason === "vendor"
      ? "Dienstleister"
      : input.reason === "third-country"
        ? "Drittland"
        : "externe Stelle";
  const parts = [
    `Vertrauensgrenze: Übergang von ${input.fromParty} nach ${input.toParty} (${reasonWord}${
      input.country ? `, ${input.country}` : ""
    }).`,
  ];
  if (input.special) {
    parts.push(
      "Es werden besondere Kategorien personenbezogener Daten übertragen.",
    );
  } else if (input.personal) {
    parts.push("Es werden personenbezogene Daten übertragen.");
  } else {
    parts.push("Kein Personenbezug hinterlegt.");
  }
  parts.push(
    input.safeguard
      ? `Garantie: ${input.safeguard}.`
      : input.country
        ? "Keine Übermittlungsgarantie hinterlegt."
        : "",
  );
  return parts.filter((part) => part !== "").join(" ");
}
