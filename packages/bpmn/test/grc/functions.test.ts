/// <reference lib="dom" />

import { describe, expect, it } from "vitest";

import {
  buildGrcGraph,
  onCommonPath,
  reachableFrom,
} from "../../src/grc/graph";
import { computeSod } from "../../src/grc/sod";
import { computeTrustBoundaries } from "../../src/grc/trust";
import { formatMinutes, simulateOutage } from "../../src/grc/outage";
import { flowWidth } from "../../src/grc/catalog";
import {
  bankPrivacyData,
  bankSodData,
  procurementSodData,
  salesRiskControlData,
  tourOutageData,
} from "./fixtures";
import { corpusScene } from "./helpers";

/**
 * F3, F5, F6 — die drei Funktionen, die auf der Graphstruktur arbeiten.
 * Jede gegen ein echtes Korpusdiagramm.
 */

describe("F3 — Aufgabentrennung", () => {
  it("findet den Konflikt zweier Aufgaben derselben Rolle im selben Pfad", async () => {
    const scene = await corpusScene("repo-prd-procurement");
    const graph = buildGrcGraph(scene);
    const result = computeSod(graph, procurementSodData());

    const involved = result.conflicts.map((conflict) =>
      [conflict.a.elementId, conflict.b.elementId].sort().join("+"),
    );
    expect(involved).toContain("Task_approve_pr+Task_po");
    const conflict = result.conflicts[0];
    expect(conflict?.severity).toBe("critical");
    expect(conflict?.describe).toMatch(/Aufgabentrennungskonflikt/);
    expect(conflict?.describe).toMatch(/IDW PS 261/);
  });

  it("meldet den Konflikt an beiden Enden", async () => {
    const scene = await corpusScene("repo-prd-procurement");
    const graph = buildGrcGraph(scene);
    const result = computeSod(graph, procurementSodData());

    expect(result.involved.get("Task_po")?.length).toBeGreaterThan(0);
    expect(result.involved.get("Task_approve_pr")?.length).toBeGreaterThan(0);
  });

  it("findet Konflikte auch über Lane-Grenzen hinweg", async () => {
    const scene = await corpusScene("synth-collaboration-pools-lanes");
    const graph = buildGrcGraph(scene);
    const result = computeSod(graph, bankSodData());

    const conflict = result.conflicts[0];
    expect(conflict).toBeDefined();
    expect([conflict?.a.laneName, conflict?.b.laneName].sort()).toEqual([
      "Kreditentscheidung",
      "Sachbearbeitung",
    ]);
  });

  it("meldet nichts ohne Regelwerk", async () => {
    const scene = await corpusScene("repo-prd-procurement");
    const graph = buildGrcGraph(scene);
    const result = computeSod(graph, {
      computedAt: "2026-03-01T00:00:00Z",
      elements: {},
    });
    expect(result.conflicts).toHaveLength(0);
  });

  it("prüft die Erreichbarkeit — getrennte Zweige sind kein Konflikt", async () => {
    const scene = await corpusScene("repo-prd-sales-with-gateway");
    const graph = buildGrcGraph(scene);
    // „Angebot erstellen" und „Absage senden" liegen in getrennten Zweigen des
    // Exklusiv-Gateways: sie kommen nie gemeinsam vor.
    expect(onCommonPath(graph, "Task_offer", "Task_reject")).toBe(false);
    expect(onCommonPath(graph, "Task_qualify", "Task_offer")).toBe(true);

    const result = computeSod(graph, {
      ...salesRiskControlData(),
      diagram: {
        sodRules: [
          {
            id: "r",
            roleAId: "role-vertrieb",
            roleBId: "role-vertrieb",
            severity: "high",
          },
        ],
      },
    });
    const pairs = result.conflicts.map((conflict) =>
      [conflict.a.elementId, conflict.b.elementId].sort().join("+"),
    );
    expect(pairs).not.toContain("Task_offer+Task_reject");
  });

  it("erkennt Selbstkontrolle in der ersten Verteidigungslinie", async () => {
    const scene = await corpusScene("synth-collaboration-pools-lanes");
    const graph = buildGrcGraph(scene);
    const result = computeSod(graph, bankSodData());

    expect(result.selfControls).toHaveLength(1);
    expect(result.selfControls[0]?.elementId).toBe("Task_Bank_Pruefen");
    expect(result.selfControls[0]?.describe).toMatch(/Selbstkontrolle/);
  });
});

describe("F5 — Datenfluss über Vertrauensgrenzen", () => {
  it("erkennt den Übergang in die Lane eines Dienstleisters im Drittland", async () => {
    const scene = await corpusScene("synth-collaboration-pools-lanes");
    const graph = buildGrcGraph(scene);
    const result = computeTrustBoundaries(graph, bankPrivacyData());

    const crossing = result.byEdgeId.get("Flow_B2");
    expect(crossing).toBeDefined();
    expect(crossing?.reason).toBe("third-country");
    expect(crossing?.country).toBe("US");
    expect(crossing?.toParty).toBe("ScoreWorks Inc.");
    expect(crossing?.personalData).toBe(true);
    expect(crossing?.describe).toMatch(/Keine Übermittlungsgarantie/);
  });

  it("wertet den Wechsel in einen externen Pool ebenfalls als Grenze", async () => {
    const scene = await corpusScene("synth-collaboration-pools-lanes");
    const graph = buildGrcGraph(scene);
    const result = computeTrustBoundaries(graph, bankPrivacyData());

    expect(result.byEdgeId.has("MessageFlow_1")).toBe(true);
  });

  it("meldet innerhalb derselben Lane nichts", async () => {
    const scene = await corpusScene("synth-collaboration-pools-lanes");
    const graph = buildGrcGraph(scene);
    const result = computeTrustBoundaries(graph, bankPrivacyData());
    expect(result.byEdgeId.has("Flow_B1")).toBe(false);
  });

  it("meldet ohne Lane-Daten gar nichts, statt zu raten", async () => {
    const scene = await corpusScene("synth-collaboration-pools-lanes");
    const graph = buildGrcGraph(scene);
    const result = computeTrustBoundaries(graph, {
      computedAt: "2026-03-01T00:00:00Z",
      elements: {},
    });
    expect(result.crossings).toHaveLength(0);
  });

  it("kennzeichnet besondere Kategorien eigens", async () => {
    const scene = await corpusScene("synth-collaboration-pools-lanes");
    const graph = buildGrcGraph(scene);
    const result = computeTrustBoundaries(graph, bankPrivacyData());
    const crossing = result.byEdgeId.get("Flow_B2");
    expect(crossing?.specialCategory).toBe(true);
    expect(crossing?.describe).toMatch(/besondere Kategorien/);
  });
});

describe("F6 — Ausfallsimulation", () => {
  it("markiert direkt betroffene und blockierte Schritte", async () => {
    const scene = await corpusScene("repo-seed-tour-planning");
    const graph = buildGrcGraph(scene);
    const result = simulateOutage(graph, tourOutageData());

    expect(result).toBeDefined();
    expect(result?.steps.get("Task_TP_Route")?.state).toBe("affected");
    // „Fahrzeuge disponieren" hat ein dokumentiertes Ausweichverfahren.
    expect(result?.steps.get("Task_TP_Dispo")?.state).toBe("workaround");
    expect(result?.affectedCount).toBe(1);
    expect(result?.workaroundCount).toBe(1);
  });

  it("blockiert nachgelagerte Schritte ohne Ausweichverfahren", async () => {
    const scene = await corpusScene("repo-seed-tour-planning");
    const graph = buildGrcGraph(scene);
    const data = tourOutageData();
    const withoutWorkaround = {
      ...data,
      elements: {
        ...data.elements,
        Task_TP_Dispo: {
          ...data.elements["Task_TP_Dispo"],
          bia: { criticality: "high" as const, mtpdMinutes: 480 },
        },
      },
    };
    const result = simulateOutage(graph, withoutWorkaround);
    expect(result?.steps.get("Task_TP_Dispo")?.state).toBe("blocked");
    expect(result?.blockedCount).toBeGreaterThanOrEqual(1);
  });

  it("rechnet den MTPD-Reißpunkt aus dem kürzesten betroffenen MTPD", async () => {
    const scene = await corpusScene("repo-seed-tour-planning");
    const graph = buildGrcGraph(scene);
    const result = simulateOutage(graph, tourOutageData());

    expect(result?.mtpdMinutes).toBe(240);
    expect(result?.mtpdElementId).toBe("Task_TP_Route");
    expect(result?.minutesToBreach).toBe(105);
    expect(result?.summary).toMatch(/Reißpunkt in 1 h 45 min/);
  });

  it("meldet eine bereits überschrittene Frist als solche", async () => {
    const scene = await corpusScene("repo-seed-tour-planning");
    const graph = buildGrcGraph(scene);
    const data = tourOutageData();
    const result = simulateOutage(graph, {
      ...data,
      diagram: {
        ...data.diagram,
        outage: {
          assetId: "asset-dispo",
          assetName: "DispoSuite",
          elapsedMinutes: 400,
        },
      },
    });
    expect(result?.minutesToBreach).toBe(-160);
    expect(result?.summary).toMatch(/überschritten/);
  });

  it("liefert ohne Szenario kein Ergebnis", async () => {
    const scene = await corpusScene("repo-seed-tour-planning");
    const graph = buildGrcGraph(scene);
    expect(
      simulateOutage(graph, {
        computedAt: "2026-03-01T00:00:00Z",
        elements: {},
      }),
    ).toBeUndefined();
  });

  it("formatiert Dauern deutsch und lesbar", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(240)).toBe("4 h");
    expect(formatMinutes(135)).toBe("2 h 15 min");
    expect(formatMinutes(2880)).toBe("2 T");
  });
});

describe("Graphhilfen", () => {
  it("erreicht alle nachgelagerten Elemente", async () => {
    const scene = await corpusScene("repo-prd-sales-with-gateway");
    const graph = buildGrcGraph(scene);
    const reachable = reachableFrom(graph, "Task_qualify");
    expect([...reachable].sort()).toEqual(
      ["End_1", "Gateway_1", "Task_offer", "Task_reject"].sort(),
    );
  });
});

describe("Kantenstärke aus Häufigkeit", () => {
  it("wächst logarithmisch und bleibt im Rahmen", () => {
    expect(flowWidth(0)).toBe(1.5);
    expect(flowWidth(100)).toBeGreaterThan(flowWidth(10));
    expect(flowWidth(100_000)).toBeLessThanOrEqual(6);
  });
});
