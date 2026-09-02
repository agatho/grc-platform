import { describe, expect, it } from "vitest";
import { openSession } from "./helpers/harness.js";
import {
  BOUNDARY_PROCESS,
  COLLABORATION,
  SIMPLE_PROCESS,
} from "./helpers/fixtures.js";
import { importXml } from "../../src/model/io.js";
import {
  checkInvariants,
  formatViolations,
  walkDocument,
  type InvariantCode,
} from "../../src/modeling/invariants.js";
import type { ModdleElement } from "../../src/modeling/types.js";

/**
 * **Prüfung des Prüfers.**
 *
 * Ein Invariantenprüfer, der nie anschlägt, ist schlimmer als keiner: er
 * erzeugt Vertrauen, das er nicht deckt. Jede Prüfung bekommt deshalb hier
 * einen Test, der den zugehörigen Fehler **absichtlich herstellt** und
 * nachweist, dass genau dieser Code gemeldet wird.
 *
 * Die Schäden werden roh am moddle-Baum angerichtet, nicht über
 * Modellierungskommandos — die Kommandos sollen den Zustand ja gerade nicht
 * erreichen können.
 */

async function tree(xml = SIMPLE_PROCESS): Promise<ModdleElement> {
  const { definitions } = await importXml(xml);
  // Der Importer der Modellierungsschicht ergänzt `incoming`/`outgoing`;
  // für die reinen Modellprüfungen hier wird derselbe Schritt nachgeholt.
  const { normalizeFlowRefs } = await import("../../src/modeling/importer.js");
  normalizeFlowRefs(definitions, []);
  return definitions;
}

function find(definitions: ModdleElement, id: string): ModdleElement {
  const hit = walkDocument(definitions).find((e) => e.element["id"] === id);
  if (!hit) throw new Error(`Element ${id} nicht gefunden`);
  return hit.element;
}

function codes(definitions: ModdleElement): InvariantCode[] {
  return checkInvariants({ definitions }).map((v) => v.code);
}

describe("Der Prüfer ist über einem gesunden Diagramm still", () => {
  it("meldet nichts für den einfachen Prozess", async () => {
    expect(checkInvariants({ definitions: await tree() })).toEqual([]);
  });

  it("meldet nichts für die Kollaboration mit Pools, Lanes und Subprozess", async () => {
    expect(checkInvariants({ definitions: await tree(COLLABORATION) })).toEqual(
      [],
    );
  });

  it("meldet nichts für das Diagramm mit Boundary Event", async () => {
    expect(
      checkInvariants({ definitions: await tree(BOUNDARY_PROCESS) }),
    ).toEqual([]);
  });
});

describe("Referenzen zwischen semantischem Modell und DI", () => {
  it("DI_ORPHANED — DI zeigt auf ein entferntes Element", async () => {
    const definitions = await tree();
    const process = find(definitions, "Process_1");
    const task = find(definitions, "Task_1");
    (process["flowElements"] as ModdleElement[]).splice(
      (process["flowElements"] as ModdleElement[]).indexOf(task),
      1,
    );
    expect(codes(definitions)).toContain("DI_ORPHANED");
  });

  it("DI_MISSING — Knoten ohne DI-Eintrag", async () => {
    const definitions = await tree();
    const plane = find(definitions, "Plane_1");
    const list = plane["planeElement"] as ModdleElement[];
    list.splice(
      list.findIndex((di) => di["id"] === "Task_1_di"),
      1,
    );
    expect(codes(definitions)).toContain("DI_MISSING");
  });

  it("DI_DUPLICATE — zwei DI-Einträge für dasselbe Element", async () => {
    const definitions = await tree();
    const plane = find(definitions, "Plane_1");
    const list = plane["planeElement"] as ModdleElement[];
    const first = list[0]!;
    // Bewusst von Hand gebaut statt per Spread: `moddle` legt `$type` auf der
    // Prototypkette ab, ein Spread verlöre ihn — und der Prüfer hielte die
    // Kopie für kein Modellelement.
    list.push({
      $type: first.$type,
      id: "Kopie_di",
      bpmnElement: first["bpmnElement"],
      bounds: first["bounds"],
      $parent: plane,
    } as unknown as ModdleElement);
    expect(codes(definitions)).toContain("DI_DUPLICATE");
  });

  it("DI_WITHOUT_BPMN_ELEMENT — DI ohne Rückverweis", async () => {
    const definitions = await tree();
    const di = find(definitions, "Task_1_di");
    delete di["bpmnElement"];
    expect(codes(definitions)).toContain("DI_WITHOUT_BPMN_ELEMENT");
  });

  it("DI_BOUNDS_INVALID — Form mit Nullfläche", async () => {
    const definitions = await tree();
    const bounds = find(definitions, "Task_1_di")["bounds"] as ModdleElement;
    bounds["width"] = 0;
    expect(codes(definitions)).toContain("DI_BOUNDS_INVALID");
  });

  it("DI_WAYPOINTS_INVALID — Kante mit einem Wegpunkt", async () => {
    const definitions = await tree();
    const edge = find(definitions, "Flow_1_di");
    edge["waypoint"] = [(edge["waypoint"] as ModdleElement[])[0]!];
    expect(codes(definitions)).toContain("DI_WAYPOINTS_INVALID");
  });
});

describe("Beidseitigkeit der Flussreferenzen", () => {
  it("OUTGOING_MISSING — sourceRef gesetzt, outgoing nicht", async () => {
    const definitions = await tree();
    find(definitions, "StartEvent_1")["outgoing"] = [];
    expect(codes(definitions)).toContain("OUTGOING_MISSING");
  });

  it("INCOMING_MISSING — targetRef gesetzt, incoming nicht", async () => {
    const definitions = await tree();
    find(definitions, "Task_1")["incoming"] = [];
    expect(codes(definitions)).toContain("INCOMING_MISSING");
  });

  it("OUTGOING_STALE — outgoing verweist auf einen entfernten Fluss", async () => {
    const definitions = await tree();
    const process = find(definitions, "Process_1");
    const flow = find(definitions, "Flow_1");
    const list = process["flowElements"] as ModdleElement[];
    list.splice(list.indexOf(flow), 1);
    expect(codes(definitions)).toContain("OUTGOING_STALE");
  });

  it("FLOW_WITHOUT_SOURCE — Fluss ohne sourceRef", async () => {
    const definitions = await tree();
    delete find(definitions, "Flow_1")["sourceRef"];
    expect(codes(definitions)).toContain("FLOW_WITHOUT_SOURCE");
  });

  it("DEFAULT_FLOW_DANGLING — default zeigt auf einen fremden Fluss", async () => {
    const definitions = await tree();
    find(definitions, "Gateway_1")["default"] = find(definitions, "Flow_1");
    expect(codes(definitions)).toContain("DEFAULT_FLOW_DANGLING");
  });
});

describe("Enthaltenheit und IDs", () => {
  it("NODE_IN_TWO_CONTAINERS — Knoten in zwei flowElements-Listen", async () => {
    const definitions = await tree(COLLABORATION);
    const processB = find(definitions, "Process_B");
    const task = find(definitions, "Task_A1");
    (processB["flowElements"] as ModdleElement[]).push(task);
    expect(codes(definitions)).toContain("NODE_IN_TWO_CONTAINERS");
  });

  it("DUPLICATE_ID — zwei Elemente mit derselben id", async () => {
    const definitions = await tree();
    find(definitions, "Task_1")["id"] = "Gateway_1";
    expect(codes(definitions)).toContain("DUPLICATE_ID");
  });

  it("CONTAINER_MISMATCH — Flussknoten in einer Collaboration", async () => {
    // `bpmn:Collaboration` hat keine `flowElements`. `moddle` nimmt die
    // Eigenschaft im Speicher an und schreibt sie beim Export nicht — der
    // Knoten wäre im Editor da und in der Datei weg.
    const definitions = await tree(COLLABORATION);
    const collaboration = find(definitions, "Collaboration_1");
    const task = find(definitions, "Task_A1");
    collaboration["flowElements"] = [task];
    task["$parent"] = collaboration;
    expect(codes(definitions)).toContain("CONTAINER_MISMATCH");
  });

  it("PARENT_LINK_BROKEN — $parent zeigt woandershin", async () => {
    const definitions = await tree();
    find(definitions, "Task_1")["$parent"] = find(definitions, "Gateway_1");
    expect(codes(definitions)).toContain("PARENT_LINK_BROKEN");
  });
});

describe("Lanes", () => {
  it("LANE_REF_NOT_IN_DOCUMENT — flowNodeRef auf ein entferntes Element", async () => {
    const definitions = await tree(COLLABORATION);
    const process = find(definitions, "Process_A");
    const task = find(definitions, "Task_A1");
    const list = process["flowElements"] as ModdleElement[];
    list.splice(list.indexOf(task), 1);
    expect(codes(definitions)).toContain("LANE_REF_NOT_IN_DOCUMENT");
  });

  it("LANE_REF_DUPLICATE — Knoten in zwei Lanes derselben Ebene", async () => {
    const definitions = await tree(COLLABORATION);
    const lane2 = find(definitions, "Lane_A2");
    (lane2["flowNodeRef"] as ModdleElement[]).push(
      find(definitions, "Task_A1"),
    );
    expect(codes(definitions)).toContain("LANE_REF_DUPLICATE");
  });

  it("LANE_REF_FOREIGN_PROCESS — flowNodeRef auf einen Knoten eines anderen Prozesses", async () => {
    const definitions = await tree(COLLABORATION);
    const lane = find(definitions, "Lane_A1");
    (lane["flowNodeRef"] as ModdleElement[]).push(find(definitions, "Task_B1"));
    expect(codes(definitions)).toContain("LANE_REF_FOREIGN_PROCESS");
  });
});

describe("Boundary Events", () => {
  it("BOUNDARY_WITHOUT_HOST — attachedToRef fehlt", async () => {
    const definitions = await tree(BOUNDARY_PROCESS);
    delete find(definitions, "Boundary_1")["attachedToRef"];
    expect(codes(definitions)).toContain("BOUNDARY_WITHOUT_HOST");
  });

  it("BOUNDARY_HOST_NOT_ACTIVITY — attachedToRef zeigt auf ein Ereignis", async () => {
    const definitions = await tree(BOUNDARY_PROCESS);
    find(definitions, "Boundary_1")["attachedToRef"] = find(
      definitions,
      "End_A",
    );
    expect(codes(definitions)).toContain("BOUNDARY_HOST_NOT_ACTIVITY");
  });
});

describe("Grafischer Baum", () => {
  it("GRAPHIC_SEMANTIC_NOT_IN_DOCUMENT — businessObject aus dem Baum entfernt", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    const process = boFor(session.definitions(), "Process_1");
    const list = process["flowElements"] as ModdleElement[];
    const task = boFor(session.definitions(), "Task_1");
    list.splice(list.indexOf(task), 1);

    expect(session.checkInvariants().map((v) => v.code)).toContain(
      "GRAPHIC_SEMANTIC_NOT_IN_DOCUMENT",
    );
    session.destroy();
  });

  it("DI_BOUNDS_MISMATCH — Grafik und DI laufen auseinander", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    // Direkt an der Grafik schrauben, ohne Kommando — genau das, was der
    // Updater verhindern soll.
    session.shape("Task_1").x = 999;
    expect(session.checkInvariants().map((v) => v.code)).toContain(
      "DI_BOUNDS_MISMATCH",
    );
    session.destroy();
  });

  it("BOUNDARY_HOST_MISMATCH — grafischer Wirt und attachedToRef verschieden", async () => {
    const session = await openSession(BOUNDARY_PROCESS);
    const boundary = session.shape("Boundary_1");
    boundary.businessObject["attachedToRef"] = boFor(
      session.definitions(),
      "End_A",
    );
    expect(session.checkInvariants().map((v) => v.code)).toContain(
      "BOUNDARY_HOST_MISMATCH",
    );
    session.destroy();
  });

  it("SEMANTIC_WITHOUT_GRAPHIC — Element in der Ebene, aber ohne Grafik", async () => {
    const session = await openSession(SIMPLE_PROCESS);
    session.elementRegistry.remove("Task_1");
    expect(session.checkInvariants().map((v) => v.code)).toContain(
      "SEMANTIC_WITHOUT_GRAPHIC",
    );
    session.destroy();
  });
});

describe("Bedienung des Prüfers", () => {
  it("formatiert Befunde lesbar", async () => {
    const definitions = await tree();
    delete find(definitions, "Flow_1")["sourceRef"];
    const text = formatViolations(checkInvariants({ definitions }), "Testlauf");
    expect(text).toContain("Testlauf");
    expect(text).toContain("FLOW_WITHOUT_SOURCE");
  });

  it("respektiert die ignore-Liste", async () => {
    const definitions = await tree();
    delete find(definitions, "Flow_1")["sourceRef"];
    expect(
      checkInvariants({ definitions, ignore: ["FLOW_WITHOUT_SOURCE"] }).map(
        (v) => v.code,
      ),
    ).not.toContain("FLOW_WITHOUT_SOURCE");
  });

  it("wirft nie, auch nicht über einem völlig kaputten Baum", () => {
    const broken = { $type: "bpmn:Definitions" } as ModdleElement;
    expect(() => checkInvariants({ definitions: broken })).not.toThrow();
  });
});

function boFor(definitions: ModdleElement, id: string): ModdleElement {
  return find(definitions, id);
}
