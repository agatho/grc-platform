/// <reference lib="dom" />

/**
 * [ARCTOS-FULL-2026-08-31 · OP-011] Der Validierungsmarker der Sicht
 * „Modellierung".
 *
 * Die Sicht war seit `STUFE2-A2-GRC.md` §6 angelegt und ließ den Slot frei.
 * Geprüft wird hier vor allem die eine Eigenschaft, wegen der dieser Layer
 * überhaupt gebaut ist: **er gibt keine Entwarnung.** Ohne beigelegte
 * Befundliste sagt er nichts — nicht „in Ordnung".
 */

import { describe, expect, it } from "vitest";

import { buildOverlayModel } from "../../src/grc/engine";
import { defaultRegistry, GRC_VIEWS, viewById } from "../../src/grc/views";
import type { GrcValidationFinding } from "../../src/grc/contract";
import { EMPTY_OVERLAY_DATA } from "../../src/grc/contract";
import {
  INVARIANT_SEVERITY,
  fromInvariantViolations,
  fromSchemaFindings,
  fromVerifyViolations,
} from "../../src/verify/markers";
import { corpusScene } from "./helpers";

async function modell(validation?: readonly GrcValidationFinding[]) {
  const scene = await corpusScene("repo-prd-sales-with-gateway");
  return buildOverlayModel(scene, EMPTY_OVERLAY_DATA, {
    view: viewById("modeling"),
    ...(validation ? { validation } : {}),
  });
}

describe("Sicht Modellierung — Validierungsmarker", () => {
  it("ist registriert und in der Sicht aktiv", () => {
    expect(defaultRegistry().get("validation")).toBeDefined();
    expect(GRC_VIEWS.modeling.layers).toContain("validation");
  });

  it("schweigt ohne Befundliste und behauptet NICHT Fehlerfreiheit", async () => {
    // Der Kern des Layers. Ein grünes Häkchen ohne gelaufene Prüfung wäre
    // eine Entwarnung, die kein Werkzeug gedeckt hat.
    const model = await modell();
    expect(model.elements.size).toBe(0);
    expect(model.legend.some((group) => group.layerId === "validation")).toBe(
      false,
    );
  });

  it("setzt einen kritischen Marker an das betroffene Element", async () => {
    const model = await modell([
      {
        rule: "FLOW_WITHOUT_TARGET",
        severity: "error",
        elementId: "Task_offer",
        message: "SequenceFlow ohne targetRef",
      },
    ]);
    const badge = model.elements.get("Task_offer")?.resolution.badges.get("BR");
    expect(badge?.layerId).toBe("validation");
    expect(badge?.signal.text).toBe("!1");
    expect(badge?.signal.tone).toBe("critical");
    expect(badge?.signal.describe).toContain("SequenceFlow ohne targetRef");
  });

  it("unterscheidet Fehler und Warnung in Ton und Text", async () => {
    const model = await modell([
      {
        rule: "DI_MISSING",
        severity: "warning",
        elementId: "Task_offer",
        message: "Kein DI-Element",
      },
    ]);
    const badge = model.elements.get("Task_offer")?.resolution.badges.get("BR");
    expect(badge?.signal.tone).toBe("warn");
    expect(badge?.signal.text).toBe("?1");
    expect(badge?.signal.describe).toContain("1 Warnung");
  });

  it("zeichnet nichts an einem Element ohne Befund", async () => {
    const model = await modell([
      {
        rule: "DUPLICATE_ID",
        severity: "error",
        elementId: "Task_offer",
        message: "ID doppelt",
      },
    ]);
    expect(model.elements.get("Task_qualify")).toBeUndefined();
  });

  it("lässt einen Befund ohne Element an keinem Shape auftauchen", async () => {
    // Ihn irgendwo hinzuhängen wäre eine erfundene Zuordnung; er gehört in
    // eine Liste, nicht an eine Form.
    const model = await modell([
      {
        rule: "unknown-element",
        severity: "warning",
        message: "Unbekanntes Element in Zeile 12",
      },
    ]);
    expect(model.elements.size).toBe(0);
  });

  it("ordnet Fehler vor Warnungen und ist reihenfolgestabil", async () => {
    const findings: GrcValidationFinding[] = [
      {
        rule: "DI_MISSING",
        severity: "warning",
        elementId: "Task_offer",
        message: "B",
      },
      {
        rule: "DUPLICATE_ID",
        severity: "error",
        elementId: "Task_offer",
        message: "A",
      },
    ];
    const a = await modell(findings);
    const b = await modell([...findings].reverse());
    const textOf = (model: Awaited<ReturnType<typeof modell>>) =>
      model.elements.get("Task_offer")?.resolution.badges.get("BR")?.signal
        .describe;
    expect(textOf(a)).toBe(textOf(b));
    // Fehler zuerst, Warnung danach — nicht in der Reihenfolge, in der ein
    // Prüfwerkzeug den Baum durchläuft.
    const text = textOf(a) ?? "";
    expect(text.indexOf("Modellfehler")).toBeLessThan(text.indexOf("Warnung"));
    expect(text.startsWith("1 Modellfehler")).toBe(true);
  });

  it("zeigt die Legende erst, wenn es Befunde gibt", async () => {
    const model = await modell([
      {
        rule: "DUPLICATE_ID",
        severity: "error",
        elementId: "Task_offer",
        message: "ID doppelt",
      },
    ]);
    expect(
      model.legend.find((group) => group.layerId === "validation")?.entries,
    ).toHaveLength(2);
  });
});

describe("verify/markers — die Übersetzung", () => {
  it("ordnet jede Invariante ausdrücklich ein", () => {
    // Der Wächter gegen die stille Lücke: ein neuer InvariantCode ohne
    // Einstufung fällt hier auf und nicht erst im Diagramm.
    for (const [code, severity] of Object.entries(INVARIANT_SEVERITY)) {
      expect(["error", "warning"], code).toContain(severity);
    }
    expect(Object.keys(INVARIANT_SEVERITY).length).toBeGreaterThanOrEqual(35);
  });

  it("macht aus einem unbekannten Code einen Fehler, keine Warnung", () => {
    // Eine Regel, die niemand eingeordnet hat, als harmlos anzuzeigen wäre
    // genau die Entwarnung, die dieser Layer nicht geben darf.
    const [finding] = fromInvariantViolations([
      { code: "GANZ_NEU", message: "?", elementId: "Task_1" },
    ]);
    expect(finding?.severity).toBe("error");
  });

  it("übernimmt die Einstufung des Dokumentenprüfers unverändert", () => {
    // Zwei Einstufungen derselben Regel an zwei Stellen wären eine zweite
    // Wahrheit.
    const out = fromVerifyViolations([
      { id: "ref/flow-source", severity: "error", message: "x" },
      { id: "di/missing", severity: "warning", message: "y" },
    ]);
    expect(out.map((finding) => finding.severity)).toEqual([
      "error",
      "warning",
    ]);
  });

  it("nennt bei einem Schemabefund die Zeile und erfindet kein Element", () => {
    const [finding] = fromSchemaFindings([
      {
        kind: "unknown-attribute",
        element: "bpmn:task",
        line: 12,
        detail: "Unbekanntes Attribut foo",
      },
    ]);
    expect(finding?.severity).toBe("warning");
    expect(finding?.message).toContain("Zeile 12");
    expect(finding).not.toHaveProperty("elementId");
  });
});
