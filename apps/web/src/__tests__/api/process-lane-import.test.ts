// process-lane-import.test.ts — der Wächter zu OP-002.
//
// [ARCTOS-FULL-2026-08-31 · OP-002]
//
// Drei Teile, und der erste ist der wichtigste:
//
//   A  **Der Defekt, gemessen.** Die geometrische Lane-Bestimmung
//      (`laneOf` aus `packages/bpmn/src/grc/graph.ts`) ordnet einen Schritt
//      bei überlappenden Rahmen der falschen Lane zu. Der Test baut genau
//      diese Geometrie und misst das Ergebnis, statt es zu behaupten.
//   B  **Die Reparatur, isoliert.** `parseBpmnLanes` +
//      `assignLaneMembership` lesen dieselbe Zuordnung aus dem Modell
//      (`bpmn:flowNodeRef`) — und liefern die richtige Lane.
//   C  **Der Schreibpfad.** `syncProcessLanes` legt Zeilen an, zieht Namen
//      nach, überschreibt den Träger NICHT und setzt `lane_step_id`.
//
// Teil C fährt gegen einen kleinen SQL-Doppelgänger statt gegen eine echte
// Datenbank: die Unit-Suite von `apps/web` läuft ohne DB (vitest.config.ts
// schliesst `rls-route-chain` genau deshalb aus). Was geprüft wird, ist die
// Abfolge der Anweisungen und ihre Wirkung auf einen Bestand — und das ist
// die Stelle, an der der Defekt sass.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { buildGrcGraph, laneOf } from "@grc/bpmn/grc";
import type { Scene } from "@grc/bpmn/draw";
import type { SQL } from "drizzle-orm";
import {
  assignLaneMembership,
  parseBpmnLanes,
} from "@/app/api/v1/processes/_lib/bpmn-lanes";
import { syncProcessLanes } from "@/app/api/v1/processes/_lib/sync-process-lanes";

// ───────────────────────────────────────────────────────────────────────────
// Das Diagramm, an dem gemessen wird
//
// Zwei Lanes eines Pools, deren Rahmen sich überlappen — die Form, die jeder
// Editor erzeugt, der Lanes frei verschieben lässt (und die jedes
// Werkzeug erzeugt, das beim Re-Import die Rahmenhöhe neu berechnet).
//
//   Lane_Fach   x 160…760, y   80…280   (Fläche 600 × 200 = 120.000)
//   Lane_IT     x 160…660, y  180…380   (Fläche 500 × 200 = 100.000)
//
// `Task_Pruefung` sitzt bei x 300…400, y 200…280 — Mittelpunkt (350, 240).
// Der liegt in BEIDEN Rahmen. Die geometrische Regel nimmt den
// flächenkleinsten, also `Lane_IT`. Das Modell sagt etwas anderes:
// `Lane_Fach` führt `Task_Pruefung` als `flowNodeRef`.
// ───────────────────────────────────────────────────────────────────────────

const XML_OVERLAPPING_LANES = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  id="Defs_1" targetNamespace="http://arctos.test">
  <bpmn:collaboration id="Collab_1">
    <bpmn:participant id="Pool_Haus" name="Eigenes Haus" processRef="Proc_1" />
  </bpmn:collaboration>
  <bpmn:process id="Proc_1" isExecutable="false">
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_Fach" name="Fachbereich">
        <bpmn:flowNodeRef>Start_1</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_Pruefung</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_IT" name="IT-Betrieb">
        <bpmn:flowNodeRef>Task_Buchung</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>End_1</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="Start_1" name="Antrag" />
    <bpmn:userTask id="Task_Pruefung" name="Antrag pruefen" />
    <bpmn:serviceTask id="Task_Buchung" name="Buchung anstossen" />
    <bpmn:endEvent id="End_1" name="Fertig" />
  </bpmn:process>
</bpmn:definitions>`;

/** Verschachtelte Lanes plus ein zweiter, leerer Pool (black box). */
const XML_NESTED = `<?xml version="1.0" encoding="UTF-8"?>
<ns0:definitions xmlns:ns0="http://www.omg.org/spec/BPMN/20100524/MODEL"
                 id="Defs_2" targetNamespace="http://arctos.test">
  <ns0:collaboration id="Collab_2">
    <ns0:participant id="Pool_Haus" name="Eigenes Haus" processRef="Proc_2" />
    <ns0:participant id="Pool_Extern" name="Dienstleister" />
  </ns0:collaboration>
  <ns0:process id="Proc_2" isExecutable="false">
    <ns0:laneSet id="LaneSet_2">
      <ns0:lane id="Lane_Sach" name="Sachbearbeitung">
        <ns0:flowNodeRef>Task_A</ns0:flowNodeRef>
        <ns0:flowNodeRef>Task_B</ns0:flowNodeRef>
        <ns0:childLaneSet id="ChildSet_1">
          <ns0:lane id="Lane_Nord" name="Team Nord">
            <ns0:flowNodeRef>Task_B</ns0:flowNodeRef>
          </ns0:lane>
        </ns0:childLaneSet>
      </ns0:lane>
    </ns0:laneSet>
    <ns0:userTask id="Task_A" name="A" />
    <ns0:userTask id="Task_B" name="B" />
    <ns0:userTask id="Task_C" name="C" />
  </ns0:process>
</ns0:definitions>`;

// ── Teil A · der Defekt ────────────────────────────────────────────────────

function frame(
  id: string,
  type: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  // `businessObject` wird von `buildGrcGraph`/`laneOf` nicht gelesen — die
  // Regel ist rein geometrisch. Genau das ist der Befund.
  return {
    id,
    type,
    x,
    y,
    width,
    height,
    businessObject: { id },
  } as unknown as Scene["shapes"][number];
}

describe("OP-002 · Teil A — die geometrische Lane-Bestimmung rät", () => {
  const scene = {
    shapes: [
      frame("Pool_Haus", "bpmn:Participant", 150, 60, 640, 340),
      frame("Lane_Fach", "bpmn:Lane", 160, 80, 600, 200),
      frame("Lane_IT", "bpmn:Lane", 160, 180, 500, 200),
      frame("Task_Pruefung", "bpmn:UserTask", 300, 200, 100, 80),
    ],
    connections: [],
    labels: [],
    bounds: { x: 0, y: 0, width: 1000, height: 500 },
    warnings: [],
    root: undefined,
  } as unknown as Scene;

  it("wählt bei überlappenden Rahmen den flächenkleineren — nicht den, den das Modell nennt", () => {
    const graph = buildGrcGraph(scene);
    const geometric = laneOf(graph, "Task_Pruefung");

    // Der Mittelpunkt (350, 240) liegt in beiden Rahmen …
    expect(350).toBeGreaterThan(160);
    expect(240).toBeGreaterThan(80);
    expect(240).toBeLessThan(280); // in Lane_Fach
    expect(240).toBeGreaterThan(180);
    expect(240).toBeLessThan(380); // in Lane_IT

    // … und die Fläche entscheidet.
    expect(600 * 200).toBeGreaterThan(500 * 200);
    expect(geometric?.id).toBe("Lane_IT");

    // Das Modell sagt „Fachbereich". Die Geometrie sagt „IT-Betrieb".
    // In einem GRC-Produkt heisst das: die Verantwortlichkeit für den
    // Prüfschritt wird der falschen Einheit zugerechnet.
    const { laneByFlowNode } = assignLaneMembership(
      parseBpmnLanes(XML_OVERLAPPING_LANES),
    );
    expect(laneByFlowNode.get("Task_Pruefung")).toBe("Lane_Fach");
    expect(laneByFlowNode.get("Task_Pruefung")).not.toBe(geometric?.id);
  });
});

// ── Teil B · der Leser ─────────────────────────────────────────────────────

describe("OP-002 · Teil B — parseBpmnLanes liest das Modell", () => {
  it("findet Pool und Lanes mit ihren Mitgliedern", () => {
    const parsed = parseBpmnLanes(XML_OVERLAPPING_LANES);
    expect(parsed.lanes.map((l) => l.bpmnElementId)).toEqual([
      "Pool_Haus",
      "Lane_Fach",
      "Lane_IT",
    ]);
    const pool = parsed.lanes[0];
    expect(pool.kind).toBe("pool");
    expect(pool.processRef).toBe("Proc_1");
    expect(parsed.lanes[1].kind).toBe("lane");
    expect(parsed.lanes[1].flowNodeRefs).toEqual(["Start_1", "Task_Pruefung"]);
    expect(parsed.flowNodesByProcess.get("Proc_1")).toEqual([
      "Start_1",
      "Task_Pruefung",
      "Task_Buchung",
      "End_1",
    ]);
  });

  it("ordnet jeden Schritt genau einer Lane zu", () => {
    const { laneByFlowNode, ambiguous } = assignLaneMembership(
      parseBpmnLanes(XML_OVERLAPPING_LANES),
    );
    expect(Object.fromEntries(laneByFlowNode)).toEqual({
      Start_1: "Lane_Fach",
      Task_Pruefung: "Lane_Fach",
      Task_Buchung: "Lane_IT",
      End_1: "Lane_IT",
    });
    expect(ambiguous).toEqual([]);
  });

  it("die tiefere Unterlane gewinnt gegen die Oberlane", () => {
    const parsed = parseBpmnLanes(XML_NESTED);
    const nord = parsed.lanes.find((l) => l.bpmnElementId === "Lane_Nord");
    expect(nord?.parentBpmnElementId).toBe("Lane_Sach");

    const { laneByFlowNode } = assignLaneMembership(parsed);
    expect(laneByFlowNode.get("Task_A")).toBe("Lane_Sach");
    // Task_B steht in beiden — die genauere Aussage gewinnt.
    expect(laneByFlowNode.get("Task_B")).toBe("Lane_Nord");
  });

  it("fällt für lane-lose Schritte auf den Pool zurück, nicht auf nichts", () => {
    const { laneByFlowNode } = assignLaneMembership(parseBpmnLanes(XML_NESTED));
    // Task_C wird von keiner Lane genannt, steht aber in Proc_2, auf den
    // Pool_Haus zeigt.
    expect(laneByFlowNode.get("Task_C")).toBe("Pool_Haus");
  });

  it("liest ns0:-Präfixe (JAXB) so gut wie bpmn: — der Namensraum entscheidet", () => {
    // Der Fixpunkt zu OP-037: ein Präfixvergleich hätte XML_NESTED abgelehnt.
    expect(parseBpmnLanes(XML_NESTED).lanes.length).toBe(4);
  });

  it("ein Diagramm ohne Lanes ist kein Fehler", () => {
    const plain = `<?xml version="1.0"?><bpmn:definitions
      xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="d">
      <bpmn:process id="p"><bpmn:startEvent id="s"/></bpmn:process>
      </bpmn:definitions>`;
    const parsed = parseBpmnLanes(plain);
    expect(parsed.lanes).toEqual([]);
    expect(assignLaneMembership(parsed).laneByFlowNode.size).toBe(0);
  });
});

// ── Teil C · der Schreibpfad ───────────────────────────────────────────────

/**
 * Ein SQL-Doppelgänger, der genau so viel versteht, wie `syncProcessLanes`
 * benutzt: SELECT auf `process_lane`, INSERT … RETURNING, UPDATE, DELETE und
 * das UPDATE auf `process_step`.
 */
interface LaneRow {
  id: string;
  bpmnElementId: string;
  name: string | null;
  kind: string;
  sequenceOrder: number;
  parentLaneId: string | null;
  vendorId: string | null;
}

function makeExecutor(seed: LaneRow[] = []) {
  const lanes = new Map<string, LaneRow>(seed.map((r) => [r.id, r]));
  const stepLane = new Map<string, string | null>();
  const statements: string[] = [];
  let nextId = seed.length + 1;

  const executor = {
    async execute(query: SQL): Promise<unknown> {
      // `sql` aus drizzle legt die Textstücke als `StringChunk` ab (deren
      // `value` ein Array ist) und die gebundenen Werte als rohe Primitive
      // dazwischen — gemessen an `sql\`… ${"x"} … ${null} …\``.
      const chunks = (query as unknown as { queryChunks: unknown[] })
        .queryChunks;
      const isText = (c: unknown): c is { value: string[] } =>
        typeof c === "object" &&
        c !== null &&
        Array.isArray((c as { value?: unknown }).value);
      const text = chunks
        .filter(isText)
        .map((c) => c.value.join(""))
        .join(" ")
        .replace(/\s+/g, " ");
      const params = chunks.filter((c) => !isText(c));
      statements.push(text.trim().slice(0, 40));

      if (text.includes("DELETE FROM process_lane")) {
        lanes.delete((params as string[])[0]);
        return { rows: [] };
      }
      if (text.includes("SELECT id, bpmn_element_id")) {
        return {
          rows: [...lanes.values()].map((r) => ({
            id: r.id,
            bpmnElementId: r.bpmnElementId,
            hasCarrier: r.vendorId !== null,
          })),
        };
      }
      if (text.includes("INSERT INTO process_lane")) {
        const [, , bpmnElementId, name, kind, sequenceOrder] = params as [
          string,
          string,
          string,
          string | null,
          string,
          number,
        ];
        const id = `lane-${nextId++}`;
        lanes.set(id, {
          id,
          bpmnElementId,
          name,
          kind,
          sequenceOrder,
          parentLaneId: null,
          vendorId: null,
        });
        return { rows: [{ id }] };
      }
      if (text.includes("UPDATE process_lane SET name")) {
        const [name, kind, sequenceOrder, , id] = params as [
          string | null,
          string,
          number,
          string,
          string,
        ];
        const row = lanes.get(id);
        if (row) Object.assign(row, { name, kind, sequenceOrder });
        return { rows: [] };
      }
      if (text.includes("UPDATE process_lane SET parent_lane_id")) {
        const [parentId, id] = params as [string | null, string];
        const row = lanes.get(id);
        if (row) row.parentLaneId = parentId;
        return { rows: [] };
      }
      if (text.includes("UPDATE process_step")) {
        const [laneId, stepId] = params as [string | null, string];
        const before = stepLane.get(stepId) ?? null;
        if (before === laneId) return { rows: [] };
        stepLane.set(stepId, laneId);
        return { rows: [{ id: stepId }] };
      }
      throw new Error(`unerwartete Anweisung: ${text.slice(0, 80)}`);
    },
  };

  return { executor, lanes, stepLane, statements };
}

const STEP_IDS = new Map<string, string>([
  ["Start_1", "step-start"],
  ["Task_Pruefung", "step-pruefung"],
  ["Task_Buchung", "step-buchung"],
  ["End_1", "step-end"],
]);

describe("OP-002 · Teil C — syncProcessLanes schreibt", () => {
  it("legt Pool und Lanes an und ordnet jeden Schritt seiner Lane zu", async () => {
    const { executor, lanes, stepLane } = makeExecutor();
    const stats = await syncProcessLanes({
      tx: executor,
      processId: "proc-1",
      orgId: "org-1",
      userId: "user-1",
      bpmnXml: XML_OVERLAPPING_LANES,
      stepIdByBpmnElement: STEP_IDS,
    });

    expect(stats.lanesInserted).toBe(3);
    expect(stats.lanesUpdated).toBe(0);
    expect(stats.stepsAssigned).toBe(4);
    expect(stats.ambiguous).toEqual([]);

    const byElement = new Map(
      [...lanes.values()].map((r) => [r.bpmnElementId, r]),
    );
    expect(byElement.get("Pool_Haus")?.kind).toBe("pool");
    expect(byElement.get("Lane_Fach")?.name).toBe("Fachbereich");

    // Und die Zuordnung folgt dem Modell, nicht der Geometrie.
    expect(stepLane.get("step-pruefung")).toBe(
      byElement.get("Lane_Fach")?.id ?? null,
    );
    expect(stepLane.get("step-buchung")).toBe(
      byElement.get("Lane_IT")?.id ?? null,
    );
  });

  it("verkettet Unterlanen über parent_lane_id", async () => {
    const { executor, lanes } = makeExecutor();
    await syncProcessLanes({
      tx: executor,
      processId: "proc-2",
      orgId: "org-1",
      userId: "user-1",
      bpmnXml: XML_NESTED,
      stepIdByBpmnElement: new Map([["Task_B", "step-b"]]),
    });
    const byElement = new Map(
      [...lanes.values()].map((r) => [r.bpmnElementId, r]),
    );
    expect(byElement.get("Lane_Nord")?.parentLaneId).toBe(
      byElement.get("Lane_Sach")?.id,
    );
    expect(byElement.get("Lane_Sach")?.parentLaneId).toBeNull();
  });

  it("überschreibt den Träger einer vorhandenen Lane NICHT", async () => {
    // Die Aussage „diese Lane wird von Dienstleister X betrieben" steht nicht
    // im XML. Ein Speichern der Version darf sie nicht löschen.
    const { executor, lanes } = makeExecutor([
      {
        id: "lane-existing",
        bpmnElementId: "Lane_IT",
        name: "Alter Name",
        kind: "lane",
        sequenceOrder: 9,
        parentLaneId: null,
        vendorId: "vendor-42",
      },
    ]);
    const stats = await syncProcessLanes({
      tx: executor,
      processId: "proc-1",
      orgId: "org-1",
      userId: "user-1",
      bpmnXml: XML_OVERLAPPING_LANES,
      stepIdByBpmnElement: STEP_IDS,
    });
    expect(stats.lanesUpdated).toBe(1);
    expect(stats.lanesInserted).toBe(2);
    const row = lanes.get("lane-existing");
    expect(row?.name).toBe("IT-Betrieb"); // Name kommt aus dem XML …
    expect(row?.vendorId).toBe("vendor-42"); // … der Träger bleibt.
  });

  it("löscht eine verschwundene trägerlose Lane, behält die mit Träger", async () => {
    const { executor, lanes } = makeExecutor([
      {
        id: "lane-gone-plain",
        bpmnElementId: "Lane_Weg",
        name: "Weg",
        kind: "lane",
        sequenceOrder: 0,
        parentLaneId: null,
        vendorId: null,
      },
      {
        id: "lane-gone-carrier",
        bpmnElementId: "Lane_WegMitTraeger",
        name: "Weg",
        kind: "lane",
        sequenceOrder: 1,
        parentLaneId: null,
        vendorId: "vendor-7",
      },
    ]);
    const stats = await syncProcessLanes({
      tx: executor,
      processId: "proc-1",
      orgId: "org-1",
      userId: "user-1",
      bpmnXml: XML_OVERLAPPING_LANES,
      stepIdByBpmnElement: STEP_IDS,
    });
    expect(stats.lanesDeleted).toBe(1);
    expect(stats.orphaned).toBe(1);
    expect(lanes.has("lane-gone-plain")).toBe(false);
    expect(lanes.get("lane-gone-carrier")?.vendorId).toBe("vendor-7");
  });

  it("setzt lane_step_id auf NULL zurück, wenn das Modell die Lane verliert", async () => {
    const { executor, stepLane } = makeExecutor();
    await syncProcessLanes({
      tx: executor,
      processId: "proc-1",
      orgId: "org-1",
      userId: "user-1",
      bpmnXml: XML_OVERLAPPING_LANES,
      stepIdByBpmnElement: STEP_IDS,
    });
    expect(stepLane.get("step-pruefung")).not.toBeNull();

    const laneless = `<?xml version="1.0"?><bpmn:definitions
      xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="d">
      <bpmn:process id="Proc_1"><bpmn:userTask id="Task_Pruefung"/></bpmn:process>
      </bpmn:definitions>`;
    const stats = await syncProcessLanes({
      tx: executor,
      processId: "proc-1",
      orgId: "org-1",
      userId: "user-1",
      bpmnXml: laneless,
      stepIdByBpmnElement: STEP_IDS,
    });
    expect(stats.stepsCleared).toBe(4);
    expect(stepLane.get("step-pruefung")).toBeNull();
  });
});

// ── Teil D · kein vierter Schreibpfad ohne Lane-Synchronisation ────────────
//
// Der Befund von OP-002 war nicht „eine Funktion fehlt", sondern „drei
// Schreibpfade schreiben `process_step` und keiner davon `process_lane`".
// Ein Wächter über die Einzelstelle hätte den vierten Pfad nicht gesehen.
// Dieser hier prüft die Regel: **wer Schritte aus BPMN-XML schreibt, schreibt
// auch Lanes.**

describe("OP-002 · Teil D — jeder Schreibpfad synchronisiert Lanes", () => {
  const API_ROOT = join(__dirname, "../../app/api/v1/processes");

  function routeFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) routeFiles(p, out);
      else if (entry.name === "route.ts") out.push(p);
    }
    return out;
  }

  it("jede Route unter /processes, die process_step aus BPMN-XML schreibt, ruft die Synchronisation", () => {
    const offenders: string[] = [];
    for (const file of routeFiles(API_ROOT)) {
      const src = readFileSync(file, "utf8");
      const writesSteps =
        /parseBpmnXml\(/.test(src) || /promoteWorkingVersion\(\{/.test(src);
      if (!writesSteps) continue;
      if (/\b(syncProcessLanes|syncLanesFromCurrentVersion)\(\{/.test(src))
        continue;
      offenders.push(relative(API_ROOT, file));
    }
    expect(offenders).toEqual([]);
  });

  it("die Synchronisation läuft innerhalb der Audit-Transaktion, nicht daneben", () => {
    // `withAuditContext` öffnet die Transaktion, an der der Audit-Trigger
    // seinen Akteur findet. Ein Aufruf ausserhalb schriebe Lanes ohne
    // Urheber in eine auditierte Tabelle.
    for (const file of routeFiles(API_ROOT)) {
      const src = readFileSync(file, "utf8");
      // Auf den AUFRUF prüfen, nicht auf das Wort: die Leseroute
      // `lanes/route.ts` erwähnt `syncProcessLanes` in einem Kommentar und
      // braucht keinen Audit-Rahmen, weil sie nichts schreibt.
      if (!/\b(syncProcessLanes|syncLanesFromCurrentVersion)\(\{/.test(src))
        continue;
      expect(src, relative(API_ROOT, file)).toMatch(/withAuditContext/);
    }
  });

  /**
   * Übergabeliste. `promoteWorkingVersion()` in
   * `apps/web/src/lib/process-working-version.ts` synchronisiert `process_step`
   * selbst, `process_lane` aber nicht — die Datei liegt ausserhalb der
   * Dateihoheit dieser Welle. Beide aufrufenden Routen holen das unmittelbar
   * danach nach (siehe oben). Wird die Synchronisation eines Tages in die
   * Bibliotheksfunktion gezogen, MUSS dieser Eintrag verschwinden — eine
   * Ausnahmeliste, die nicht schrumpfen kann, ist keine.
   */
  it("die bekannte Lücke in lib/process-working-version.ts besteht noch — und nur sie", () => {
    const lib = readFileSync(
      join(__dirname, "../../lib/process-working-version.ts"),
      "utf8",
    );
    expect(/parseBpmnXml/.test(lib)).toBe(true);
    expect(/syncProcessLanes/.test(lib)).toBe(false);
  });
});
