import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openSession, operate } from "./helpers/harness.js";
import { semanticSnapshot } from "./helpers/snapshot.js";
import type { BpmnShape } from "../../src/modeling/types.js";
import { boOf } from "../../src/modeling/util.js";

/**
 * Der Abnahmetest, der die eigentliche Frage stellt.
 *
 * Eine Folge von **mehr als zwanzig** Operationen auf einem echten
 * Korpusdiagramm, danach exportieren, wieder importieren und zusichern, dass
 * das eingelesene Modell dem entspricht, das im Editor stand.
 *
 * Warum das *die* Prüfung dieser Schicht ist: Der Invariantenprüfer sagt, dass
 * das Modell im Speicher **in sich** stimmig ist. Er sagt nicht, dass es die
 * Datei erreicht. Genau dazwischen liegt der Fehler, den SPIKE-ENTSCHEIDUNG
 * beschreibt — „er zeigt sich in einer Datei, die ein Fremdwerkzeug später
 * nicht mehr liest". Erst Export und Reimport schließen diese Lücke.
 */

const CORPUS = join(import.meta.dirname, "..", "corpus");

function corpus(name: string): string {
  return readFileSync(join(CORPUS, name), "utf8");
}

describe("Round-Trip nach einer langen Operationsfolge", () => {
  it("führt 24 Operationen auf einem Korpusdiagramm aus und schreibt sie verlustfrei", async () => {
    const session = await openSession(
      corpus("synth-collaboration-pools-lanes.bpmn"),
    );
    let step = 0;
    const next = <T>(label: string, operation: () => T): T =>
      operate(
        session,
        `${String(++step).padStart(2, "0")} ${label}`,
        operation,
        {
          // Undo/Redo wird in dieser Folge bei jeder einzelnen Operation
          // mitgeprüft — das ist der teuerste, aber auch der aussagekräftigste
          // Modus: jede Operation muss aus *jedem* Zwischenzustand heraus
          // umkehrbar sein, nicht nur aus dem Ausgangszustand.
          undo: true,
        },
      );

    const bank = session.shape("Participant_Bank");
    const kunde = session.shape("Participant_Kunde");

    // --- 1–5: erzeugen -----------------------------------------------------
    const task1 = next("Aufgabe in Lane Sachbearbeitung", () =>
      session.modeling.createShape(
        { type: "bpmn:UserTask", name: "Unterlagen anfordern" },
        { x: 520, y: 180 },
        bank as never,
      ),
    ) as unknown as BpmnShape;

    const gateway = next("Gateway anlegen", () =>
      session.modeling.createShape(
        { type: "bpmn:ExclusiveGateway", name: "Vollständig?" },
        { x: 680, y: 180 },
        bank as never,
      ),
    ) as unknown as BpmnShape;

    const note = next("Textannotation anlegen", () =>
      session.modeling.createShape(
        { type: "bpmn:TextAnnotation" },
        { x: 900, y: 120 },
        bank as never,
      ),
    ) as unknown as BpmnShape;

    const kundeTask = next("Aufgabe im zweiten Pool", () =>
      session.modeling.createShape(
        { type: "bpmn:ServiceTask", name: "Bestätigung ablegen" },
        { x: 700, y: 520 },
        kunde as never,
      ),
    ) as unknown as BpmnShape;

    const endEvent = next("Ende anlegen", () =>
      session.modeling.createShape(
        { type: "bpmn:EndEvent", name: "Vorgang beendet" },
        { x: 900, y: 520 },
        kunde as never,
      ),
    ) as unknown as BpmnShape;

    // --- 6–10: verbinden ---------------------------------------------------
    const flow1 = next("Sequenzfluss zur neuen Aufgabe", () =>
      session.modeling.connect(task1, gateway),
    );
    next("Assoziation zur Annotation", () =>
      session.modeling.connect(note, gateway),
    );
    const flow2 = next("Sequenzfluss im zweiten Pool", () =>
      session.modeling.connect(kundeTask, endEvent),
    );
    // Gateways sind laut BPMN keine Nachrichtenendpunkte — der Nachrichtenfluss
    // geht deshalb von einer Aufgabe aus.
    next("Nachrichtenfluss über die Poolgrenze", () =>
      session.modeling.connect(task1, kundeTask),
    );
    // `flow1` verlässt `task1`, nicht das Gateway — `bpmn:Activity` hat
    // ebenfalls einen `default`-Ausgang.
    next("Standardfluss setzen", () => {
      session.modeling.updateProperties(task1, { default: boOf(flow1) });
    });

    // --- 11–15: beschriften und Eigenschaften ------------------------------
    next("Aufgabe umbenennen", () => {
      session.modeling.updateLabel(task1, "Unterlagen nachfordern");
    });
    next("Gateway beschriften", () => {
      session.modeling.updateLabel(gateway, "Alles da?");
    });
    next("Annotation beschriften", () => {
      session.modeling.updateLabel(note, "Frist: 14 Tage");
    });
    next("Kante beschriften", () => {
      session.modeling.updateLabel(flow2, "abgelegt");
    });
    next("id ändern", () => {
      session.modeling.updateProperties(task1, { id: "Task_Nachforderung" });
    });

    // --- 16–20: bewegen, umhängen, Größe ändern ----------------------------
    next("Aufgabe in die andere Lane ziehen", () => {
      const shape = session.shape("Task_Nachforderung");
      session.modeling.moveShape(
        shape as never,
        { x: 0, y: 140 },
        shape.parent as never,
      );
    });
    next("Aufgabe zurückziehen", () => {
      const shape = session.shape("Task_Nachforderung");
      session.modeling.moveShape(
        shape as never,
        { x: 0, y: -140 },
        shape.parent as never,
      );
    });
    next("Pool vergrößern", () => {
      session.modeling.resizeShape(bank as never, {
        x: bank.x,
        y: bank.y,
        width: bank.width + 120,
        height: bank.height,
      });
    });
    next("Kante neu führen", () => {
      session.modeling.layoutConnection(flow1 as never);
    });
    next("Kante umhängen", () => {
      session.modeling.reconnectEnd(
        session.connection(flow2.id) as never,
        session.shape("Task_Kunde_Empfang") as never,
        { x: 700, y: 520 },
      );
    });

    // --- 21–24: Lanes und Löschen ------------------------------------------
    next("Lane hinzufügen", () => {
      session.modeling.addLane(session.shape("Lane_Genehmigung"), "bottom");
    });
    next("Lane teilen", () => {
      session.modeling.splitLane(session.shape("Lane_Sachbearbeitung"), 2);
    });
    next("Annotation löschen", () => {
      session.modeling.removeShape(session.shape(note.id) as never);
    });
    next("Endereignis löschen", () => {
      session.modeling.removeShape(session.shape(endEvent.id) as never);
    });

    expect(step).toBeGreaterThanOrEqual(20);

    // --- Export, Reimport, Vergleich ---------------------------------------
    const before = semanticSnapshot(session.definitions());
    const xml = await session.exportXml();

    const reopened = await openSession(xml);
    const after = semanticSnapshot(reopened.definitions());

    expect(after).toEqual(before);
    expect(reopened.checkInvariants()).toEqual([]);

    // Und noch einmal: der zweite Durchgang muss byteidentisch sein (Z-B).
    const xml2 = await reopened.exportXml();
    const third = await openSession(xml2);
    expect(await third.exportXml()).toBe(xml2);

    session.destroy();
    reopened.destroy();
    third.destroy();
  });

  it("hält die Invarianten über einen kompletten Undo-Rückbau", async () => {
    const session = await openSession(
      corpus("repo-seed-customer-service.bpmn"),
    );
    const root = session.root();
    const created: string[] = [];

    for (let index = 0; index < 6; index += 1) {
      const shape = session.modeling.createShape(
        { type: "bpmn:Task", name: `Schritt ${String(index)}` },
        { x: 200 + index * 140, y: 500 },
        root as never,
      ) as unknown as BpmnShape;
      created.push(shape.id);
      session.assertInvariants(`erzeugt ${String(index)}`);
    }
    for (let index = 1; index < created.length; index += 1) {
      session.modeling.connect(
        session.shape(created[index - 1]!),
        session.shape(created[index]!),
      );
      session.assertInvariants(`verbunden ${String(index)}`);
    }

    // Alles zurück — nach jedem Schritt muss das Modell stimmig sein.
    let steps = 0;
    while (session.commandStack.canUndo()) {
      session.undo();
      session.assertInvariants(`Rückbau ${String(++steps)}`);
      if (steps > 200) throw new Error("Der Rückbau endet nicht.");
    }

    for (const id of created) {
      expect(session.has(id)).toBe(false);
    }
    // Der Ausgangszustand muss byteidentisch wiederherstellbar sein.
    const snapshot = semanticSnapshot(session.definitions());
    const pristine = await openSession(
      corpus("repo-seed-customer-service.bpmn"),
    );
    expect(snapshot).toEqual(semanticSnapshot(pristine.definitions()));

    session.destroy();
    pristine.destroy();
  });
});

describe("Korpuslauf", () => {
  const files = [
    "repo-seed-customer-service.bpmn",
    "repo-seed-goods-receipt.bpmn",
    "repo-seed-order-callactivity.bpmn",
    "repo-seed-risk-management.bpmn",
    "repo-seed-tour-planning.bpmn",
    "repo-prd-procurement.bpmn",
    "repo-prd-sales-with-gateway.bpmn",
    "repo-parser-mixed-types-subprocess.bpmn",
    "synth-collaboration-pools-lanes.bpmn",
    "synth-boundary-events.bpmn",
    "synth-all-task-types.bpmn",
    "synth-all-gateway-types.bpmn",
    "synth-nested-subprocesses.bpmn",
    "synth-excel-import-lanes.bpmn",
    "synth-large-flat-process.bpmn",
  ];

  it.each(files)(
    "%s lässt sich laden, bearbeiten und verlustfrei zurückschreiben",
    async (file) => {
      const session = await openSession(corpus(file));

      // Eine kleine, für jedes Diagramm zulässige Bearbeitung: einen Knoten
      // anlegen, benennen, verschieben, wieder löschen.
      //
      // Der Container ist bewusst nicht blind die Wurzel: Bei einem
      // Kollaborationsdiagramm ist die Wurzel eine `bpmn:Collaboration`, und
      // die hat keine `flowElements`. Ein Knoten, den man dort ablegt, ist im
      // Editor sichtbar und fehlt in der Datei.
      const root = session.root();
      const pool = session.elementRegistry
        .getAll()
        .find(
          (element) => boOf(element as never)?.$type === "bpmn:Participant",
        );
      const container = (pool ?? root) as never;

      const shape = session.modeling.createShape(
        { type: "bpmn:Task", name: "Prüfschritt" },
        { x: 60, y: 700 },
        container,
      ) as unknown as BpmnShape;
      session.assertInvariants(`${file}: erzeugt`);

      session.modeling.updateLabel(shape, "Prüfschritt (geändert)");
      session.assertInvariants(`${file}: beschriftet`);

      session.modeling.moveShape(shape as never, { x: 40, y: 0 }, container);
      session.assertInvariants(`${file}: verschoben`);

      const before = semanticSnapshot(session.definitions());
      const xml = await session.exportXml();
      const reopened = await openSession(xml);
      expect(semanticSnapshot(reopened.definitions())).toEqual(before);

      session.modeling.removeShape(session.shape(shape.id) as never);
      session.assertInvariants(`${file}: gelöscht`);

      session.destroy();
      reopened.destroy();
    },
  );
});
