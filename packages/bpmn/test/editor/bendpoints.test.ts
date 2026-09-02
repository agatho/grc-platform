/// <reference lib="dom" />

/**
 * Stützpunkte und Kantenbearbeitung (Auftrag Punkt 4).
 *
 * Geprüft wird die wertbasierte Fläche — dieselben Änderungen, die das Ziehen
 * an den Griffen von `diagram-js` auslöst, nur ohne Zeigegerät. Nach jeder
 * Änderung laufen die Invarianten, danach das Undo, danach wieder die
 * Invarianten; die Wegpunkte in der DI müssen zur Kante im Grafikbaum passen
 * (`DI_WAYPOINTS_MISMATCH`), sonst schlägt genau das an.
 */

import { beforeEach, describe, expect, it } from "vitest";

import type { BendpointEditing } from "../../src/editor/BendpointEditing.js";
import type { ConnectMode } from "../../src/editor/ConnectMode.js";
import { SIMPLE_PROCESS } from "../modeling/helpers/fixtures.js";
import { act, openEditor, type EditorHarness } from "./helpers/editor.js";

let harness: EditorHarness;

beforeEach(() => {
  document.body.replaceChildren();
});

describe("Stützpunkte", () => {
  it("setzt einen Stützpunkt in die längste Strecke", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const bendpoints = harness.service<BendpointEditing>("bendpointEditing");
    const flow = harness.session.connection("Flow_1");
    expect(bendpoints.count(flow)).toBe(0);

    act(harness, "Stützpunkt setzen", () => bendpoints.add(flow), {
      undoSteps: 1,
      after: () => {
        expect(bendpoints.count(flow)).toBe(1);
        expect(harness.said()).toContain("Stützpunkt");
      },
      afterUndo: () => {
        expect(bendpoints.count(flow)).toBe(0);
      },
    });
    harness.destroy();
  });

  it("verschiebt einen Stützpunkt und lässt die Andockpunkte in Ruhe", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const bendpoints = harness.service<BendpointEditing>("bendpointEditing");
    const flow = harness.session.connection("Flow_1");
    bendpoints.add(flow);
    const first = { ...flow.waypoints[0]! };
    const last = { ...flow.waypoints[flow.waypoints.length - 1]! };
    const before = bendpoints.bendpoints(flow)[0]!;

    act(
      harness,
      "Stützpunkt verschieben",
      () => bendpoints.move(flow, 0, { x: 0, y: -40 }),
      {
        undoSteps: 1,
        after: () => {
          expect(bendpoints.bendpoints(flow)[0]?.y).toBe(before.y - 40);
          expect(flow.waypoints[0]).toMatchObject(first);
          expect(flow.waypoints[flow.waypoints.length - 1]).toMatchObject(last);
        },
        afterUndo: () => {
          expect(bendpoints.bendpoints(flow)[0]?.y).toBe(before.y);
        },
      },
    );
    harness.destroy();
  });

  it("entfernt einen Stützpunkt", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const bendpoints = harness.service<BendpointEditing>("bendpointEditing");
    const flow = harness.session.connection("Flow_2");
    bendpoints.add(flow);
    expect(bendpoints.count(flow)).toBe(1);

    act(harness, "Stützpunkt entfernen", () => bendpoints.remove(flow, 0), {
      undoSteps: 1,
      after: () => {
        expect(bendpoints.count(flow)).toBe(0);
      },
      afterUndo: () => {
        expect(bendpoints.count(flow)).toBe(1);
      },
    });
    harness.destroy();
  });

  it("weist einen Stützpunkt zurück, den es nicht gibt", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const bendpoints = harness.service<BendpointEditing>("bendpointEditing");
    const flow = harness.session.connection("Flow_1");
    expect(bendpoints.remove(flow, 3)).toBe(false);
    expect(bendpoints.move(flow, 3, { x: 10, y: 0 })).toBe(false);
    expect(harness.said()).toContain("gibt es an der Kante nicht");
    harness.destroy();
  });
});

describe("Kante umhängen", () => {
  it("hängt das Ende auf ein anderes zulässiges Element", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const connect = harness.service<ConnectMode>("connectMode");
    const flow = harness.session.connection("Flow_1");
    const oldTarget = flow.target;

    expect(connect.startReconnect(flow, "target")).toBe(true);
    expect(connect.candidates().length).toBeGreaterThan(0);
    // Kein Kandidat ist das bisherige Ziel oder die Quelle selbst.
    expect(connect.candidates()).not.toContain(oldTarget);
    expect(connect.candidates()).not.toContain(flow.source);

    act(harness, "Kantenende umhängen", () => connect.confirm(), {
      undoSteps: 1,
      after: () => {
        expect(flow.target).not.toBe(oldTarget);
        expect(harness.said()).toContain("umgehängt");
      },
      afterUndo: () => {
        expect(flow.target).toBe(oldTarget);
      },
    });
    harness.destroy();
  });

  it("hängt den Anfang um und bietet nur regelkonforme Quellen an", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const connect = harness.service<ConnectMode>("connectMode");
    const flow = harness.session.connection("Flow_3");
    expect(connect.startReconnect(flow, "source")).toBe(true);
    // Ein Endereignis darf nie Quelle eines Sequenzflusses sein.
    expect(connect.candidates().map((element) => element.id)).not.toContain(
      "EndEvent_1",
    );
    connect.cancel();
    harness.destroy();
  });
});

describe("Stützpunkte über die Tastatur", () => {
  it("legt mit b an, wählt mit Pfeilen, verschiebt mit Umschalt und beendet mit Escape", async () => {
    harness = await openEditor(SIMPLE_PROCESS);
    const bendpoints = harness.service<BendpointEditing>("bendpointEditing");
    const flow = harness.session.connection("Flow_1");
    harness.session
      .get<{ select(element: unknown): void }>("selection")
      .select(flow);

    harness.key({ key: "b" });
    expect(bendpoints.count(flow)).toBe(1);
    const before = bendpoints.bendpoints(flow)[0]!;

    harness.key({ key: "ArrowUp", shiftKey: true });
    expect(bendpoints.bendpoints(flow)[0]?.y).toBe(before.y - 20);
    harness.session.assertInvariants("nach dem Verschieben per Tastatur");

    harness.key({ key: "Delete" });
    expect(bendpoints.count(flow)).toBe(0);
    harness.session.assertInvariants("nach dem Entfernen per Tastatur");

    harness.key({ key: "Escape" });
    harness.destroy();
  });
});
