/// <reference lib="dom" />

import { describe, expect, it } from "vitest";

import {
  MAX_BADGES,
  resolveSlots,
  type GrcElementSignal,
  type OwnedSignal,
} from "../../src/grc/slots";
import { buildOverlayModel } from "../../src/grc/engine";
import { createLayerRegistry, type GrcLayer } from "../../src/grc/layers";
import {
  defaultRegistry,
  defaultViewForRole,
  GRC_VIEWS,
  resolveView,
  viewById,
} from "../../src/grc/views";
import { openFindingsFilter, ALL_LAYERS } from "../../src/grc/catalog";
import { largeProcessData, salesRiskControlData } from "./fixtures";
import { corpusModel, corpusScene } from "./helpers";

function owned(
  layerId: string,
  priority: number,
  signal: GrcElementSignal,
): OwnedSignal<GrcElementSignal> {
  return { layerId, layerTitle: layerId, priority, signal };
}

/**
 * Das Slot- und Budgetsystem aus §3.3.1/§3.3.2 — die wichtigste
 * Gestaltungsentscheidung des Abschnitts.
 */

describe("Slot-Konflikte", () => {
  it("gibt einen Slot der höheren Priorität und schiebt den Verlierer in den Sammel-Badge", () => {
    const resolution = resolveSlots([
      owned("a", 10, {
        kind: "badge",
        slot: "TR",
        text: "A",
        tone: "warn",
        describe: "Signal A.",
      }),
      owned("b", 90, {
        kind: "badge",
        slot: "TR",
        text: "B",
        tone: "critical",
        describe: "Signal B.",
      }),
    ]);

    expect(resolution.badges.get("TR")?.layerId).toBe("b");
    expect(resolution.overflow?.count).toBe(1);
    expect(resolution.overflow?.suppressed[0]?.text).toBe("Signal A.");
  });

  it("löst Gleichstand alphabetisch auf — nie über die Registrierungsreihenfolge", () => {
    const first = resolveSlots([
      owned("zebra", 50, {
        kind: "badge",
        slot: "TL",
        text: "Z",
        tone: "ok",
        describe: "z",
      }),
      owned("alpha", 50, {
        kind: "badge",
        slot: "TL",
        text: "A",
        tone: "ok",
        describe: "a",
      }),
    ]);
    const second = resolveSlots([
      owned("alpha", 50, {
        kind: "badge",
        slot: "TL",
        text: "A",
        tone: "ok",
        describe: "a",
      }),
      owned("zebra", 50, {
        kind: "badge",
        slot: "TL",
        text: "Z",
        tone: "ok",
        describe: "z",
      }),
    ]);
    expect(first.badges.get("TL")?.layerId).toBe("alpha");
    expect(second.badges.get("TL")?.layerId).toBe("alpha");
  });

  it("belegt höchstens drei Badge-Slots und hält den vierten für den Sammel-Badge frei", () => {
    const resolution = resolveSlots([
      owned("a", 40, {
        kind: "badge",
        slot: "TL",
        text: "1",
        tone: "ok",
        describe: "a",
      }),
      owned("b", 30, {
        kind: "badge",
        slot: "TR",
        text: "2",
        tone: "ok",
        describe: "b",
      }),
      owned("c", 20, {
        kind: "badge",
        slot: "BL",
        text: "3",
        tone: "ok",
        describe: "c",
      }),
      owned("d", 10, {
        kind: "badge",
        slot: "BR",
        text: "4",
        tone: "ok",
        describe: "d",
      }),
    ]);

    expect(resolution.badges.size).toBe(MAX_BADGES);
    expect(resolution.overflow?.slot).toBe("BR");
    expect(resolution.overflow?.count).toBe(1);
    // Der schwächste weicht — nicht der zuletzt eingetragene.
    expect(resolution.overflow?.suppressed[0]?.layerId).toBe("d");
  });

  it("lässt höchstens eine Formkodierung zu und nennt die verdrängte", () => {
    const resolution = resolveSlots([
      owned("heat", 90, {
        kind: "shape",
        tone: "critical",
        hatch: "heavy",
        describe: "Abdeckung.",
      }),
      owned("privacy", 50, {
        kind: "shape",
        tone: "accent",
        hatch: "none",
        describe: "Personenbezug.",
      }),
    ]);
    expect(resolution.shape?.layerId).toBe("heat");
    expect(
      resolution.overflow?.suppressed.map((entry) => entry.text),
    ).toContain("Personenbezug.");
  });

  it("belegt für leere Layer keinen Slot", () => {
    const resolution = resolveSlots([]);
    expect(resolution.badges.size).toBe(0);
    expect(resolution.overflow).toBeUndefined();
    expect(resolution.descriptions).toHaveLength(0);
  });

  it("der Sammel-Badge ist nie stumm — er nennt, was er verdeckt", () => {
    const resolution = resolveSlots([
      owned("a", 40, {
        kind: "badge",
        slot: "TL",
        text: "1",
        tone: "ok",
        describe: "A.",
      }),
      owned("b", 30, {
        kind: "badge",
        slot: "TL",
        text: "2",
        tone: "ok",
        describe: "B.",
      }),
    ]);
    expect(resolution.descriptions.join(" ")).toContain(
      "1 weitere Hinweise: B.",
    );
  });

  it("Pin und LoD-Kante konkurrieren nicht um Badge-Slots", () => {
    const resolution = resolveSlots([
      owned("comments", 30, {
        kind: "pin",
        text: "3",
        tone: "neutral",
        openThreads: 3,
        describe: "Kommentare: 3 offen.",
      }),
      owned("lod", 60, {
        kind: "stripe",
        tone: "info",
        label: "1. Verteidigungslinie",
        describe: "1. Verteidigungslinie.",
      }),
      owned("risk", 80, {
        kind: "badge",
        slot: "TR",
        text: "2·16",
        tone: "critical",
        describe: "Risiken.",
      }),
    ]);
    expect(resolution.badges.size).toBe(1);
    expect(resolution.pin).toBeDefined();
    expect(resolution.stripe).toBeDefined();
    expect(resolution.overflow).toBeUndefined();
  });
});

describe("Budget im echten Diagramm", () => {
  it("hält das Budget auch bei sechs gleichzeitig aktiven Layern", async () => {
    const { model } = await corpusModel(
      "synth-large-flat-process",
      largeProcessData(),
      "risk-control",
    );
    for (const decoration of model.elements.values()) {
      expect(
        decoration.resolution.badges.size,
        decoration.elementId,
      ).toBeLessThanOrEqual(MAX_BADGES);
    }
    // Und mindestens ein Element hat tatsächlich mehr zu sagen, als es zeigt.
    const withOverflow = [...model.elements.values()].filter(
      (decoration) => decoration.resolution.overflow,
    );
    expect(withOverflow.length).toBeGreaterThan(0);
  });

  it("ist deterministisch: zweimal dasselbe Modell, dasselbe Bild", async () => {
    const scene = await corpusScene("synth-large-flat-process");
    const data = largeProcessData();
    const view = viewById("risk-control");
    const a = buildOverlayModel(scene, data, { view });
    const b = buildOverlayModel(scene, data, { view });

    const flatten = (model: typeof a): string =>
      [...model.elements.values()]
        .map(
          (decoration) =>
            `${decoration.elementId}|${[
              ...decoration.resolution.badges.entries(),
            ]
              .map(
                ([slot, owned_]) =>
                  `${slot}:${owned_.layerId}:${owned_.signal.text}`,
              )
              .join(",")}|${decoration.resolution.shape?.layerId ?? "-"}`,
        )
        .join("\n");
    expect(flatten(a)).toBe(flatten(b));
  });
});

describe("Sichten", () => {
  it("bildet die Tabelle aus §3.3.3 ab", () => {
    expect(GRC_VIEWS["risk-control"].shapeCodingLayer).toBe("control-coverage");
    expect(GRC_VIEWS.compliance.shapeCodingLayer).toBe("evidence");
    expect(GRC_VIEWS.privacy.layers).toContain("trust-boundary");
    expect(GRC_VIEWS.modeling.layers).not.toContain("control-coverage");
  });

  it("löst jede Sicht vollständig gegen das Register auf", () => {
    for (const view of Object.values(GRC_VIEWS)) {
      const resolved = resolveView(view, defaultRegistry());
      expect(resolved.missing, view.id).toEqual([]);
      expect(resolved.layers.length, view.id).toBe(view.layers.length);
    }
  });

  it("sortiert die Layer nach Priorität", () => {
    const resolved = resolveView(GRC_VIEWS["risk-control"], defaultRegistry());
    const priorities = resolved.layers.map((layer) => layer.priority);
    expect([...priorities].sort((a, b) => b - a)).toEqual(priorities);
  });

  it("kennt Rollenvoreinstellungen und einen sicheren Rückfall", () => {
    expect(defaultViewForRole("data_protection_officer").id).toBe("privacy");
    expect(defaultViewForRole("bcm_officer").id).toBe("continuity");
    expect(defaultViewForRole(undefined).id).toBe("responsibility");
    expect(defaultViewForRole("gibt-es-nicht").id).toBe("responsibility");
  });

  it("erlaubt das Zuschalten einzelner Layer, ohne das Budget zu ändern", async () => {
    const scene = await corpusScene("repo-prd-sales-with-gateway");
    const model = buildOverlayModel(scene, salesRiskControlData(), {
      view: GRC_VIEWS.modeling,
      extraLayers: ["risk", "finding"],
    });
    expect(model.layers.map((layer) => layer.id)).toContain("risk");
    for (const decoration of model.elements.values()) {
      expect(decoration.resolution.badges.size).toBeLessThanOrEqual(MAX_BADGES);
    }
  });

  it("weist auf unbekannte Layer hin, statt sie stumm zu verschlucken", async () => {
    const scene = await corpusScene("repo-prd-sales-with-gateway");
    const model = buildOverlayModel(scene, salesRiskControlData(), {
      view: GRC_VIEWS.modeling,
      extraLayers: ["gibt-es-nicht"],
    });
    expect(model.warnings.join(" ")).toContain("gibt-es-nicht");
  });
});

describe("Layer-Register", () => {
  it("nimmt keinen Layer ohne describe() an (§3.3.5 Regel 3)", () => {
    const broken = {
      id: "ohne-text",
      title: "Ohne Text",
      priority: 10,
      feature: "F0",
    } as unknown as GrcLayer;
    expect(() => createLayerRegistry([broken])).toThrow(/describe/);
  });

  it("weist doppelte IDs zurück", () => {
    const layer = ALL_LAYERS[0];
    expect(layer).toBeDefined();
    expect(() => createLayerRegistry([layer!, layer!])).toThrow(/doppelt/);
  });

  it("jeder gebaute Layer nennt seine Funktion aus §3.12", () => {
    for (const layer of ALL_LAYERS) {
      expect(layer.feature, layer.id).toMatch(/^(F\d+|[AB]\d+|§3\.\d+)$/);
      expect(typeof layer.describe).toBe("function");
    }
  });
});

describe("Filter blenden ab, statt auszublenden (§3.3.5 Regel 1)", () => {
  it("markiert nicht passende Elemente als abgeblendet und behält sie", async () => {
    const scene = await corpusScene("repo-prd-sales-with-gateway");
    const model = buildOverlayModel(scene, salesRiskControlData(), {
      view: GRC_VIEWS["risk-control"],
      filter: openFindingsFilter,
    });

    const dimmed = [...model.elements.values()].filter(
      (decoration) => decoration.resolution.dimmed,
    );
    const kept = [...model.elements.values()];
    expect(dimmed.length).toBeGreaterThan(0);
    expect(kept.length).toBeGreaterThan(dimmed.length);
    // Der Schritt mit offenen Feststellungen bleibt hell.
    expect(model.elements.get("Task_offer")?.resolution.dimmed).toBe(false);
    expect(model.warnings.join(" ")).toContain("nichts ausgeblendet");
  });
});
