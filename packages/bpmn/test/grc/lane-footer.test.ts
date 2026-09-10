/// <reference lib="dom" />

/**
 * [ARCTOS-FULL-2026-08-31 · OP-006] Der achte Slot und der Layer darauf.
 *
 * `STUFE2-A2-GRC.md` §6 hat F11 zurückgestellt, weil der Anteilsbalken einen
 * Slot braucht, den §3.3.1 nicht vorsieht. Geprüft wird deshalb beides: dass
 * der Slot sich wie die sieben anderen verhält (genau einer, Verdrängtes geht
 * in den Sammel-Badge, jede Dekoration hat einen Text) — und die eine
 * fachliche Zusicherung des Layers: **der Anteil sagt dazu, worauf er sich
 * bezieht.**
 */

import { describe, expect, it } from "vitest";

import { computeLaneCosts } from "../../src/grc/analysis";
import { buildGrcGraph, laneOf } from "../../src/grc/graph";
import { resolveSlots } from "../../src/grc/slots";
import type { GrcElementSignal, OwnedSignal } from "../../src/grc/slots";
import { GRC_VIEWS } from "../../src/grc/views";
import { laneCostData } from "./fixtures";
import { corpusModel, corpusScene } from "./helpers";

const CORPUS = "synth-collaboration-pools-lanes";

async function kosten() {
  const scene = await corpusScene(CORPUS);
  const graph = buildGrcGraph(scene);
  return computeLaneCosts(graph, laneCostData(), (id) => laneOf(graph, id)?.id);
}

describe("F11 — Kostenverteilung je Lane", () => {
  it("ist in der Sicht Betrieb und Effizienz aktiv", () => {
    expect(GRC_VIEWS.operations.layers).toContain("cost");
  });

  it("rechnet Kosten je Durchlauf mal Durchläufe, nicht je Durchlauf", async () => {
    const result = await kosten();
    // 4 € × 500 + 40 € × 200 = 2.000 + 8.000
    expect(result.total).toBe(10_000);
    expect(result.currency).toBe("€");
  });

  it("zählt eine Aktivität ohne Durchlaufzahl NICHT mit", async () => {
    // Sonst wäre die Summe eine Mischung aus „Kosten je Durchlauf" und
    // „Gesamtkosten" — zwei Größen unter einem Namen. `executions = 1` zu
    // unterstellen wäre dieselbe Erfindung, nur unauffälliger.
    const scene = await corpusScene(CORPUS);
    const graph = buildGrcGraph(scene);
    const result = computeLaneCosts(
      graph,
      {
        computedAt: "2026-03-01T09:00:00.000Z",
        elements: {
          Task_Bank_Pruefen: {
            simulation: { costPerExecution: 999 },
          },
        },
      },
      (id) => laneOf(graph, id)?.id,
    );
    expect(result.total).toBe(0);
    expect(result.withCost).toBe(0);
  });

  it("meldet die Deckung — der Anteil gilt für die BEKANNTEN Kosten", async () => {
    const result = await kosten();
    expect(result.withCost).toBe(2);
    expect(result.activities).toBeGreaterThan(2);
    expect(result.coverage).toBeLessThan(1);
  });

  it("nennt die Deckung im Text, sobald sie unvollständig ist", async () => {
    const { model } = await corpusModel(CORPUS, laneCostData(), "operations");
    const beschreibung = [...model.elements.values()]
      .flatMap((entry) => entry.descriptions)
      .join(" ");
    expect(beschreibung).toContain("Kostenanteil");
    expect(beschreibung).toContain("mit Kostenangabe");
  });

  it("zeichnet keinen Balken, wenn keine Kosten bekannt sind", async () => {
    // „0 %" an jedem Rahmen wäre eine Verteilungsaussage über eine
    // Verteilung, die niemand kennt.
    const { model } = await corpusModel(
      CORPUS,
      { computedAt: "2026-03-01T09:00:00.000Z", elements: {} },
      "operations",
    );
    for (const entry of model.elements.values()) {
      expect(entry.resolution.laneFooter).toBeUndefined();
    }
  });

  it("belegt die Fußzeile genau einmal und meldet den Verdrängten", () => {
    const signal = (
      layerId: string,
      priority: number,
      share: number,
    ): OwnedSignal<GrcElementSignal> => ({
      layerId,
      layerTitle: layerId,
      priority,
      signal: {
        kind: "lane-footer",
        share,
        tone: "info",
        label: `${String(share * 100)} %`,
        describe: `Anteil von ${layerId}.`,
      },
    });
    const resolution = resolveSlots([
      signal("a", 10, 0.2),
      signal("b", 90, 0.8),
    ]);
    expect(resolution.laneFooter?.layerId).toBe("b");
    // Der Verdrängte ist nie stumm — dieselbe Zusage wie bei der
    // Formkodierung (§3.3.2).
    expect(
      resolution.overflow?.suppressed.some((entry) => entry.layerId === "a"),
    ).toBe(true);
  });

  it("nimmt den Anteil in die Beschreibungen auf", () => {
    const resolution = resolveSlots([
      {
        layerId: "cost",
        layerTitle: "Kostenverteilung",
        priority: 39,
        signal: {
          kind: "lane-footer",
          share: 0.8,
          tone: "accent",
          label: "8.000 € · 80 %",
          describe: "Kostenanteil 80 %.",
        },
      },
    ]);
    expect(resolution.descriptions).toContain("Kostenanteil 80 %.");
  });

  it("zeichnet den Balken in die Lane und trägt den Wert als Text", async () => {
    const { renderGrcScene, toGrcSvgString } =
      await import("../../src/grc/render");
    const { installSvgPolyfills } = await import("../draw/helpers/jsdom-svg");
    installSvgPolyfills();
    const scene = await corpusScene(CORPUS);
    const result = renderGrcScene(scene, laneCostData(), {
      view: GRC_VIEWS.operations,
      title: "Kostenverteilung",
      legend: true,
    });
    const svg = toGrcSvgString(result);
    expect(svg).toContain('data-grc="lane-footer"');
    // Farbe ist nie der einzige Träger: der Betrag steht als Text daneben.
    expect(svg).toContain("8.000 €");
    expect(svg).not.toContain("NaN");
  });
});
