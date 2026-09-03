/// <reference lib="dom" />

/**
 * [ARCTOS-FULL-2026-08-31 · OP-012] Kantenkennzahlen aus dem
 * Ereignisprotokoll.
 *
 * `MISSING_TODAY` führte `edges` mit der Begründung, Häufigkeit je Kante
 * brauche eine Zuordnung auf Übergänge. Die gibt es jetzt
 * (`process_event_transition_map`, Migration 0476) — als **Knotenpaar**, weil
 * Kantenkennungen in keiner Tabelle des Schemas stehen. Diese Datei prüft die
 * Auflösung: aus Paaren werden Kanten, und wo das nicht eindeutig geht,
 * passiert nichts statt etwas Falsches.
 */

import { describe, expect, it } from "vitest";

import { resolveTransitions } from "../../src/grc/analysis";
import { buildGrcGraph } from "../../src/grc/graph";
import { buildOverlayModel } from "../../src/grc/engine";
import { viewById } from "../../src/grc/views";
import type { Scene } from "../../src/draw/scene";
import { largeProcessData } from "./fixtures";
import { corpusScene } from "./helpers";

/** Zwei Knoten, zwei Verbindungen dazwischen — der mehrdeutige Fall. */
function doppelteVerbindung(): Scene {
  return {
    id: "s",
    shapes: [
      { id: "A", type: "bpmn:Task", x: 0, y: 0, width: 100, height: 80 },
      { id: "B", type: "bpmn:Task", x: 200, y: 0, width: 100, height: 80 },
    ],
    connections: [
      {
        id: "F1",
        type: "bpmn:SequenceFlow",
        waypoints: [
          { x: 100, y: 40 },
          { x: 200, y: 40 },
        ],
        source: { id: "A" },
        target: { id: "B" },
      },
      {
        id: "F2",
        type: "bpmn:SequenceFlow",
        waypoints: [
          { x: 100, y: 60 },
          { x: 200, y: 60 },
        ],
        source: { id: "A" },
        target: { id: "B" },
      },
    ],
  } as unknown as Scene;
}

describe("OP-012 — Übergänge auf Kanten auflösen", () => {
  it("ordnet ein eindeutiges Paar der Verbindung zu", async () => {
    const scene = await corpusScene("repo-prd-sales-with-gateway");
    const graph = buildGrcGraph(scene);
    const erste = scene.connections.find(
      (connection) => connection.source && connection.target,
    );
    const result = resolveTransitions(graph, [
      {
        fromElementId: erste!.source!.id,
        toElementId: erste!.target!.id,
        frequency: 42,
        probability: 0.75,
      },
    ]);
    expect(result.byEdge.get(erste!.id)?.frequency).toBe(42);
    expect(result.unresolved).toHaveLength(0);
  });

  it("ordnet ein mehrdeutiges Paar KEINER Verbindung zu", () => {
    // Beiden dieselbe Häufigkeit zu geben verdoppelte die Zahl im Bild; sie zu
    // teilen wäre geraten. Der Übergang bleibt unaufgelöst — sichtbar, aber
    // nicht falsch beziffert.
    const graph = buildGrcGraph(doppelteVerbindung());
    const result = resolveTransitions(graph, [
      { fromElementId: "A", toElementId: "B", frequency: 10 },
    ]);
    expect(result.byEdge.size).toBe(0);
    expect(result.unresolved).toHaveLength(1);
  });

  it("ordnet ein Paar ohne Verbindung im Modell nicht zu", () => {
    const graph = buildGrcGraph(doppelteVerbindung());
    const result = resolveTransitions(graph, [
      { fromElementId: "B", toElementId: "A", frequency: 3 },
    ]);
    expect(result.byEdge.size).toBe(0);
    expect(result.unresolved).toHaveLength(1);
  });

  it("färbt die Kante im Diagramm, sobald ein Übergang vorliegt", async () => {
    const scene = await corpusScene("synth-large-flat-process");
    const data = largeProcessData();
    const kante = scene.connections.find((c) => c.source && c.target)!;
    const model = buildOverlayModel(
      scene,
      {
        ...data,
        // Ohne `edges` — genau der Zustand, den der Endpunkt liefert.
        edges: {},
        diagram: {
          ...data.diagram,
          transitions: [
            {
              fromElementId: kante.source!.id,
              toElementId: kante.target!.id,
              frequency: 1234,
              probability: 0.42,
              isModelled: true,
            },
          ],
        },
      },
      { view: viewById("operations") },
    );
    const decoration = model.edges.get(kante.id);
    expect(decoration).toBeDefined();
    expect(decoration?.descriptions.join(" ")).toContain("1.234");
  });

  it("lässt eine hinterlegte Kantenangabe die beobachtete schlagen", async () => {
    // Eine gemessene Größe darf eine hinterlegte Tatsache nicht überschreiben.
    const scene = await corpusScene("synth-large-flat-process");
    const data = largeProcessData();
    const kante = scene.connections.find((c) => c.source && c.target)!;
    const model = buildOverlayModel(
      scene,
      {
        ...data,
        edges: { [kante.id]: { frequency: 7, probability: 0.1 } },
        diagram: {
          ...data.diagram,
          transitions: [
            {
              fromElementId: kante.source!.id,
              toElementId: kante.target!.id,
              frequency: 9999,
              probability: 0.99,
            },
          ],
        },
      },
      { view: viewById("operations") },
    );
    expect(model.edges.get(kante.id)?.descriptions.join(" ")).toContain("7");
  });
});
