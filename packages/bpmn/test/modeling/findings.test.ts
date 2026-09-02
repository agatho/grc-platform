import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openSession } from "./helpers/harness.js";
import { boundsOf, planesOf, planeElementsOf } from "../../src/modeling/di.js";
import { boOf, asArray } from "../../src/modeling/util.js";
import type { BpmnShape } from "../../src/modeling/types.js";

/**
 * Regressionstests zu den Befunden des Verifikationsstrangs
 * (`/work/bpmn-plan/STUFE2-A3-VERIFIKATION.md` §3).
 *
 * Sie stehen bewusst in einer eigenen Datei und nicht verteilt in
 * `operations.test.ts`: Jeder dieser Befunde stammt aus einer erzeugten
 * Operationsfolge, nicht aus einem handgeschriebenen Fall — die Liste ist der
 * Beleg dafür, welche Fehlerarten von Hand *nicht* gefunden wurden. Sie
 * gehören zusammen sichtbar, damit man beim nächsten Umbau sieht, was diese
 * Schicht schon einmal falsch gemacht hat.
 *
 * Die Reproduktionen sind die geschrumpften aus `test/verify/known-findings.ts`,
 * wörtlich übernommen. Die Nummerierung folgt dem Bericht.
 */

const CORPUS = join(import.meta.dirname, "..", "corpus");

function corpus(name: string): string {
  return readFileSync(join(CORPUS, `${name}.bpmn`), "utf8");
}

describe("§3.1 Wegpunkt ohne x-Koordinate", () => {
  it("verschiebt eine Aktivität mit Boundary-Events um (0,0), ohne die Kanten zu zerstören", async () => {
    const session = await openSession(corpus("synth-boundary-events"), {
      ignoreInvariants: [],
    });

    session.modeling.moveElements([session.shape("Task_Freigabe")] as never, {
      x: 0,
      y: 0,
    });

    for (const element of session.elementRegistry.getAll()) {
      const waypoints = (
        element as { waypoints?: Array<{ x: number; y: number }> }
      ).waypoints;
      if (!waypoints) continue;
      for (const point of waypoints) {
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
      }
    }
    session.assertInvariants("nach moveElements(0,0)");
    session.destroy();
  });

  it("behält attachedToRef aller Boundary-Events", async () => {
    const session = await openSession(corpus("synth-boundary-events"));
    session.modeling.moveElements([session.shape("Task_Freigabe")] as never, {
      x: 0,
      y: 0,
    });

    for (const element of session.elementRegistry.getAll()) {
      const bo = boOf(element as never);
      if (bo?.$type !== "bpmn:BoundaryEvent") continue;
      expect(bo["attachedToRef"]).toBeDefined();
    }
    session.destroy();
  });
});

describe("§3.2 Subprozess löschen verwaist die eingebettete Ebene", () => {
  it("nimmt beim Löschen eines Subprozesses seine eigene BPMNPlane mit", async () => {
    const session = await openSession(corpus("synth-nested-subprocesses"));
    const planesBefore = planesOf(session.definitions()).length;

    session.modeling.removeShape(session.shape("Sub_L1") as never);
    session.assertInvariants("nach dem Löschen von Sub_L1");

    expect(planesOf(session.definitions()).length).toBeLessThan(planesBefore);
    // Kein DI-Eintrag darf auf ein entferntes Element zeigen.
    for (const plane of planesOf(session.definitions())) {
      for (const di of planeElementsOf(plane)) {
        expect(di["bpmnElement"]).toBeDefined();
      }
    }
    session.destroy();
  });

  it("stellt die eingebettete Ebene beim Undo vollständig wieder her", async () => {
    const session = await openSession(corpus("synth-nested-subprocesses"));
    const before = planesOf(session.definitions()).map(
      (p) => planeElementsOf(p).length,
    );

    session.modeling.removeShape(session.shape("Sub_L1") as never);
    session.undo();
    session.assertInvariants("nach dem Undo");

    expect(
      planesOf(session.definitions()).map((p) => planeElementsOf(p).length),
    ).toEqual(before);
    session.destroy();
  });
});

describe("§3.3 Nachrichtenfluss gehört nicht in incoming/outgoing", () => {
  it("schreibt einen MessageFlow nicht in die Sequenzfluss-Listen", async () => {
    const session = await openSession(
      corpus("synth-collaboration-pools-lanes"),
    );
    const source = session.shape("Task_Kunde_Antrag");
    const target = session.shape("Task_Bank_Entscheiden");

    const connection = session.modeling.connect(source, target);
    expect(boOf(connection)?.$type).toBe("bpmn:MessageFlow");

    // `bpmn:FlowNode.incoming/outgoing` sind im Metamodell als
    // SequenceFlow-Referenzen typisiert. Ein Nachrichtenfluss darin lässt den
    // nächsten Leser ihn als Sequenzfluss auflösen.
    const sourceBo = boOf(source)!;
    const targetBo = boOf(target)!;
    expect(asArray(sourceBo["outgoing"])).not.toContain(boOf(connection));
    expect(asArray(targetBo["incoming"])).not.toContain(boOf(connection));
    session.assertInvariants("nach dem Nachrichtenfluss");
    session.destroy();
  });

  it("löscht einen MessageFlow, ohne die Listen anzufassen", async () => {
    const session = await openSession(
      corpus("synth-collaboration-pools-lanes"),
    );
    const message = session.connection("MessageFlow_1");
    session.modeling.removeConnection(message as never);
    session.assertInvariants("nach dem Löschen des Nachrichtenflusses");
    session.undo();
    session.assertInvariants("nach dem Undo");
    session.destroy();
  });
});

describe("§3.4 Datenobjekt löschen lässt Datenassoziationen hängen", () => {
  it("räumt die Datenassoziationen mit dem Datenobjekt ab", async () => {
    const session = await openSession(
      corpus("synth-data-objects-and-artifacts"),
    );

    session.modeling.removeShape(
      session.shape("DataObjectRef_Antrag") as never,
    );
    session.assertInvariants("nach dem Löschen des Datenobjekts");

    session.undo();
    session.assertInvariants("nach dem Undo");
    session.destroy();
  });

  it("räumt sie auch für einen DataStore ab", async () => {
    const session = await openSession(
      corpus("synth-data-objects-and-artifacts"),
    );
    session.modeling.removeShape(
      session.shape("DataStore_Kundenstamm") as never,
    );
    session.assertInvariants("nach dem Löschen des DataStore");
    session.undo();
    session.assertInvariants("nach dem Undo");
    session.destroy();
  });
});

describe("§3.5 Undo entfernt die erzeugte DI", () => {
  it("hinterlässt nach attachBoundary + undo keine BPMNShape", async () => {
    const session = await openSession(
      corpus("synth-collaboration-pools-lanes"),
    );
    const host = session.shape("Task_Bank_Pruefen");
    const diCountBefore = planesOf(session.definitions()).reduce(
      (sum, plane) => sum + planeElementsOf(plane).length,
      0,
    );

    const boundary = session.modeling.createShape(
      { type: "bpmn:BoundaryEvent" },
      { x: host.x + host.width, y: host.y + host.height },
      host as never,
      { attach: true } as never,
    ) as unknown as BpmnShape;
    expect(boundary.host).toBe(host);

    session.undo();
    session.assertInvariants("nach dem Undo des Anheftens");

    const diCountAfter = planesOf(session.definitions()).reduce(
      (sum, plane) => sum + planeElementsOf(plane).length,
      0,
    );
    expect(diCountAfter).toBe(diCountBefore);
    session.destroy();
  });

  it("hinterlässt nach connect + undo keine BPMNEdge", async () => {
    const session = await openSession(
      corpus("synth-collaboration-pools-lanes"),
    );
    const before = planesOf(session.definitions()).reduce(
      (sum, plane) => sum + planeElementsOf(plane).length,
      0,
    );

    session.modeling.connect(
      session.shape("Task_Kunde_Antrag"),
      session.shape("Task_Bank_Entscheiden"),
    );
    session.undo();
    session.assertInvariants("nach dem Undo des Verbindens");

    expect(
      planesOf(session.definitions()).reduce(
        (sum, plane) => sum + planeElementsOf(plane).length,
        0,
      ),
    ).toBe(before);
    session.destroy();
  });
});

describe("§3.5 Ursache: ein Bedienschritt, ein Kommando", () => {
  it("erzeugt Ereignis und Ereignisdefinition in einem Kommando", async () => {
    // Der eigentliche Befund hinter §3.5 und §3.6 ist **nicht**, dass die
    // Umkehrfunktion die DI stehen ließe — sie tut es nicht (siehe oben).
    // Der Befund ist, dass ein Bedienschritt „Boundary Event mit Zeitgeber
    // anheften" in dieser Schicht **zwei** Kommandos kostete: erzeugen, dann
    // Ereignisdefinition nachtragen. `bpmn-js` braucht dafür eines. Damit
    // stimmt „n Operationen, n Undos" nicht mehr, und der Prüfstand sah einen
    // halb zurückgenommenen Zustand — zu Recht.
    const session = await openSession(
      corpus("synth-collaboration-pools-lanes"),
    );
    const host = session.shape("Task_Bank_Pruefen");
    const factory = session.get<{
      createShape: (attrs: unknown) => BpmnShape;
    }>("elementFactory");

    const before = await session.exportXml();
    const shape = factory.createShape({
      type: "bpmn:BoundaryEvent",
      eventDefinitionType: "bpmn:TimerEventDefinition",
    });
    const created = session.modeling.createShape(
      shape as never,
      { x: host.x + host.width / 2, y: host.y + host.height } as never,
      host as never,
      { attach: true } as never,
    ) as unknown as BpmnShape;

    const definitions = created.businessObject["eventDefinitions"];
    expect(Array.isArray(definitions) && definitions.length === 1).toBe(true);
    expect((definitions as Array<{ $type: string }>)[0]?.$type).toBe(
      "bpmn:TimerEventDefinition",
    );

    // **Ein** Undo stellt das Ausgangsdokument wieder her.
    session.undo();
    session.assertInvariants("nach einem Undo");
    expect(await session.exportXml()).toBe(before);
    session.destroy();
  });
});

describe("§3.6 Undo stellt einen auf leer gesetzten Namen wieder her", () => {
  it("bringt den alten Namen zurück, auch wenn der neue leer war", async () => {
    const session = await openSession(
      corpus("synth-foreign-camunda-extensions"),
    );
    const task = session.elementRegistry
      .getAll()
      .find((e) => boOf(e as never)?.$type === "bpmn:UserTask") as
      BpmnShape | undefined;
    expect(task).toBeDefined();
    const before = boOf(task!)?.["name"];
    expect(typeof before).toBe("string");

    session.modeling.updateProperties(task!, { name: "" });
    expect(boOf(task!)?.["name"]).toBe("");

    session.undo();
    expect(boOf(task!)?.["name"]).toBe(before);
    session.destroy();
  });

  it("gilt auch für updateLabel mit leerem Text", async () => {
    const session = await openSession(
      corpus("synth-foreign-camunda-extensions"),
    );
    const task = session.elementRegistry
      .getAll()
      .find((e) => boOf(e as never)?.$type === "bpmn:UserTask") as BpmnShape;
    const before = boOf(task)?.["name"];

    session.modeling.updateLabel(task, "");
    session.undo();
    expect(boOf(task)?.["name"]).toBe(before);
    session.destroy();
  });
});

describe("§3.7 Boundary-Event nur an zulässigen Aktivitäten", () => {
  it("lehnt den Ereignis-Subprozess ab", async () => {
    const session = await openSession(corpus("synth-all-event-types"));
    const rules = session.get<{ allowed(a: string, c?: unknown): unknown }>(
      "rules",
    );
    const boundary = session
      .get<{ createShape: (attrs: unknown) => BpmnShape }>("elementFactory")
      .createShape({ type: "bpmn:BoundaryEvent" });

    expect(
      rules.allowed("shape.attach", {
        shape: boundary,
        target: session.shape("E_EventSub"),
      }),
    ).toBe(false);
    session.destroy();
  });

  it("lehnt eine Kompensationsaktivität ab", async () => {
    const session = await openSession(corpus("synth-all-task-types"));
    const rules = session.get<{ allowed(a: string, c?: unknown): unknown }>(
      "rules",
    );
    const boundary = session
      .get<{ createShape: (attrs: unknown) => BpmnShape }>("elementFactory")
      .createShape({ type: "bpmn:BoundaryEvent" });

    const task = session.elementRegistry
      .getAll()
      .find((e) => boOf(e as never)?.$type === "bpmn:Task") as BpmnShape;
    session.modeling.updateProperties(task, { isForCompensation: true });

    expect(
      rules.allowed("shape.attach", { shape: boundary, target: task }),
    ).toBe(false);
    session.destroy();
  });

  it("erlaubt weiterhin die gewöhnliche Aktivität", async () => {
    const session = await openSession(corpus("synth-all-task-types"));
    const rules = session.get<{ allowed(a: string, c?: unknown): unknown }>(
      "rules",
    );
    const boundary = session
      .get<{ createShape: (attrs: unknown) => BpmnShape }>("elementFactory")
      .createShape({ type: "bpmn:BoundaryEvent" });
    const task = session.elementRegistry
      .getAll()
      .find((e) => boOf(e as never)?.$type === "bpmn:UserTask") as BpmnShape;

    expect(
      rules.allowed("shape.attach", { shape: boundary, target: task }),
    ).toBe("attach");
    session.destroy();
  });
});

/**
 * Der Befund aus `/work/bpmn-plan/STUFE2-B2-EINBINDUNG.md` §5.3 — ein anderer
 * Pfad als §3.1: dort wurde der **Wirt** verschoben, hier das **Randereignis
 * selbst**. `attach-support` von `diagram-js` deutet ein `elements.move` ohne
 * `newHost` als Ablösung und ruft `updateAttachment(attacher, undefined)`.
 * Sechzehn von 200 erzeugten Folgen liefen hinein; die geschrumpfte
 * Reproduktion ist eine einzige Operation über null Pixel.
 */
describe("§5.3 (B2) Randereignis verschieben löst die Anheftung", () => {
  it("behält attachedToRef nach move(Boundary_Timer, 0, 0)", async () => {
    const session = await openSession(corpus("synth-boundary-events"));
    const boundary = session.shape("Boundary_Timer");
    const host = boundary.host;
    expect(host?.id).toBe("Task_Freigabe");

    session.modeling.moveElements([boundary] as never, { x: 0, y: 0 });

    expect(session.shape("Boundary_Timer").host?.id).toBe("Task_Freigabe");
    expect(boOf(session.shape("Boundary_Timer"))?.["attachedToRef"]).toBe(
      boOf(host as never),
    );
    session.assertInvariants("nach move(Boundary_Timer, 0, 0)");
    session.destroy();
  });

  it("behält die Anheftung bei einem echten Versatz und über Undo/Redo", async () => {
    const session = await openSession(corpus("synth-boundary-events"));

    session.modeling.moveElements([session.shape("Boundary_Timer")] as never, {
      x: 12,
      y: -8,
    });
    session.assertInvariants("nach move(Boundary_Timer, 12, -8)");
    expect(session.shape("Boundary_Timer").host?.id).toBe("Task_Freigabe");

    session.undo();
    session.assertInvariants("nach Undo");
    expect(session.shape("Boundary_Timer").host?.id).toBe("Task_Freigabe");

    session.redo();
    session.assertInvariants("nach Redo");
    expect(session.shape("Boundary_Timer").host?.id).toBe("Task_Freigabe");
    session.destroy();
  });

  it("löst weiterhin ab, wenn das ausdrücklich verlangt wird", async () => {
    // `hints.attach === false` setzt `newHost` auf `null` — eine ausgesprochene
    // Absicht, die die Anheftungssicherung nicht überschreiben darf. Der
    // entstehende Zustand ist ungültig, und genau das soll die Invariante
    // melden statt ihn zu verstecken.
    const session = await openSession(corpus("synth-boundary-events"));
    const boundary = session.shape("Boundary_Timer");
    session.modeling.moveElements(
      [boundary] as never,
      { x: 0, y: 0 },
      boundary.parent as never,
      { attach: false } as never,
    );

    expect(session.shape("Boundary_Timer").host).toBeFalsy();
    expect(session.checkInvariants().map((v) => v.code)).toContain(
      "BOUNDARY_WITHOUT_HOST",
    );
    session.destroy();
  });
});

/**
 * Zwei Befunde aus dem Eigenschaftslauf über 1.000 bzw. 500 Folgen, nachdem
 * die vorherigen behoben waren. Beide sind vom selben Schlag wie §3.2 und
 * §3.4: eine einzige Operation, kein exotischer Eingang, und am Bild ist
 * nichts zu sehen.
 */
describe("§C.1 Aktivität mit Datenassoziationen löschen", () => {
  it("nimmt deren DI-Kanten mit aus der Ebene", async () => {
    const session = await openSession(
      corpus("synth-data-objects-and-artifacts"),
    );
    session.modeling.removeElements([
      session.shape("D_Task_Erfassen"),
    ] as never);

    const ids = planesOf(session.definitions())
      .flatMap((plane) => planeElementsOf(plane))
      .map((di) => String(di["id"]));
    expect(ids).not.toContain("DataInputAssoc_1_di");
    expect(ids).not.toContain("DataOutputAssoc_1_di");
    session.assertInvariants("nach dem Löschen der Aktivität");
    session.destroy();
  });

  it("stellt sie beim Undo wieder her", async () => {
    const session = await openSession(
      corpus("synth-data-objects-and-artifacts"),
    );
    const before = planesOf(session.definitions()).flatMap((plane) =>
      planeElementsOf(plane),
    ).length;

    session.modeling.removeElements([
      session.shape("D_Task_Erfassen"),
    ] as never);
    session.undo();

    expect(
      planesOf(session.definitions()).flatMap((plane) => planeElementsOf(plane))
        .length,
    ).toBe(before);
    session.assertInvariants("nach dem Undo");
    session.destroy();
  });
});

describe("§C.2 Knoten in einen anderen Container ziehen", () => {
  it("macht aus dem Sequenzfluss zwischen zwei Pools einen Nachrichtenfluss", async () => {
    const session = await openSession(
      corpus("synth-collaboration-pools-lanes"),
    );
    const start = session.shape("Start_Kunde");
    const target = session.shape("Participant_Bank");

    session.modeling.moveElements(
      [start] as never,
      { x: target.x + 200 - start.x, y: target.y + 100 - start.y },
      target as never,
    );

    // Der Sequenzfluss Start_Kunde → Task_Kunde_Antrag lief innerhalb eines
    // Pools; jetzt kreuzt er die Poolgrenze und darf keiner mehr sein.
    expect(session.has("Flow_K1")).toBe(false);
    const replacement = session.elementRegistry
      .getAll()
      .find(
        (element) =>
          boOf(element as never)?.$type === "bpmn:MessageFlow" &&
          (element as { source?: { id?: string } }).source?.id ===
            "Start_Kunde",
      );
    expect(
      replacement,
      "ein Nachrichtenfluss muss entstanden sein",
    ).toBeDefined();
    session.assertInvariants("nach dem Poolwechsel");
    session.destroy();
  });

  it("entfernt eine Kante, für die es keinen zulässigen Typ mehr gibt", async () => {
    const session = await openSession(corpus("synth-all-event-types"));
    const eventSub = session.shape("E_EventSub");
    const node = session.shape("E_End_Error");

    session.modeling.moveElements(
      [node] as never,
      { x: eventSub.x + 60 - node.x, y: eventSub.y + 60 - node.y },
      eventSub as never,
    );

    // Ein Ereignis-Subprozess hängt an keinem Sequenzfluss; ein
    // Nachrichtenfluss kommt hier nicht in Frage, also bleibt nur das
    // Entfernen — und zwar sichtbar, nicht als kaputte Kante.
    session.assertInvariants("nach dem Zug in den Ereignis-Subprozess");
    session.destroy();
  });

  it("nimmt den Kantenumbau mit einem einzigen Undo zurück", async () => {
    const session = await openSession(
      corpus("synth-collaboration-pools-lanes"),
    );
    const start = session.shape("Start_Kunde");
    const target = session.shape("Participant_Bank");
    const before = session.elementRegistry.getAll().length;

    session.modeling.moveElements(
      [start] as never,
      { x: target.x + 200 - start.x, y: target.y + 100 - start.y },
      target as never,
    );
    session.undo();

    expect(session.elementRegistry.getAll().length).toBe(before);
    expect(session.has("Flow_K1")).toBe(true);
    expect(boOf(session.connection("Flow_K1"))?.$type).toBe(
      "bpmn:SequenceFlow",
    );
    session.assertInvariants("nach dem Undo");
    session.destroy();
  });
});

describe("§3.8 PARENT_LINK_BROKEN nur dort, wo $parent den Export steuert", () => {
  it("meldet ein DI-Blattobjekt ohne $parent nicht", async () => {
    const session = await openSession(corpus("repo-prd-procurement"));
    const shape = session.modeling.createShape(
      { type: "bpmn:Task" },
      { x: 200, y: 400 },
      session.root() as never,
    ) as unknown as BpmnShape;

    // Genau der Zustand, den auch `bpmn-js` erzeugt: die `dc:Bounds` unter der
    // `BPMNShape` trägt kein `$parent`.
    // `moddle` legt `$parent` als nicht löschbare Eigenschaft an; auf
    // `undefined` setzen ist derselbe beobachtbare Zustand.
    const bounds = shape.di!["bounds"] as Record<string, unknown>;
    bounds["$parent"] = undefined;

    expect(
      session.checkInvariants().filter((v) => v.code === "PARENT_LINK_BROKEN"),
    ).toEqual([]);
    session.destroy();
  });

  it("meldet ein fehlendes $parent an einem Flusselement weiterhin", async () => {
    const session = await openSession(corpus("repo-prd-procurement"));
    const task = session.elementRegistry
      .getAll()
      .find((e) => boOf(e as never)?.$type === "bpmn:UserTask") as BpmnShape;
    boOf(task)!["$parent"] = undefined;

    expect(session.checkInvariants().map((v) => v.code)).toContain(
      "PARENT_LINK_BROKEN",
    );
    session.destroy();
  });

  it("hält den DI-Baum trotzdem zusammen — Bounds ohne $parent exportieren korrekt", async () => {
    const session = await openSession(corpus("repo-prd-procurement"));
    const shape = session.modeling.createShape(
      { type: "bpmn:Task", name: "Ohne Elternverweis" },
      { x: 200, y: 400 },
      session.root() as never,
    ) as unknown as BpmnShape;
    (shape.di!["bounds"] as Record<string, unknown>)["$parent"] = undefined;

    const xml = await session.exportXml();
    expect(xml).toContain('name="Ohne Elternverweis"');
    expect(xml).toContain("dc:Bounds");
    session.destroy();
  });
});

/** Nur damit `boundsOf` importiert bleibt, wenn ein Test entfällt. */
export const __used = boundsOf;
