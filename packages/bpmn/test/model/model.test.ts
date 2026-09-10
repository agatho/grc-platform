import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CORPUS_DIR, loadCorpus } from "./corpus";
import {
  ARCTOS_METADATA_LOCAL_TYPE,
  ARCTOS_NAMESPACE,
  ARCTOS_PREFIX,
  arctosExtensionDescriptor,
  buildDiIndex,
  createArctosModdle,
  exportXml,
  getAttachedBoundaryEvents,
  getAttachedToRef,
  getBounds,
  getCollaborations,
  getFlowNodes,
  getGrcMetadataElement,
  getLaneOf,
  getLaneFlowNodes,
  getLanes,
  getMessageFlows,
  getParticipantProcess,
  getParticipants,
  getProcesses,
  getSequenceFlows,
  getWaypoints,
  importXml,
  isInterrupting,
  isUnmodified,
  localType,
  markModified,
  readGrcMetadata,
  readGrcMetadataMap,
} from "../../src/model/index";

const REPO_EXTENSION =
  "/work/repo/apps/web/src/components/bpmn/arctos-moddle-extension.json";
const LOCAL_EXTENSION =
  "/work/repo/packages/bpmn/src/model/arctos-moddle-extension.json";

function corpusXml(name: string): string {
  return readFileSync(join(CORPUS_DIR, `${name}.bpmn`), "utf8");
}

describe("ARCTOS moddle extension", () => {
  it("is a byte copy of the descriptor apps/web hands to bpmn-js", () => {
    // The two files must not drift. If this fails, existing `arctos:*` data
    // becomes silently unreadable by one of the two readers.
    let repo: string;
    try {
      repo = readFileSync(REPO_EXTENSION, "utf8");
    } catch {
      // Running outside the monorepo checkout — nothing to compare against.
      return;
    }
    expect(readFileSync(LOCAL_EXTENSION, "utf8")).toBe(repo);
  });

  it("keeps the three frozen properties", () => {
    const d = arctosExtensionDescriptor as {
      uri: string;
      prefix: string;
      xml: { tagAlias: string };
      types: { name: string }[];
    };
    expect(d.uri).toBe(ARCTOS_NAMESPACE);
    expect(d.uri).toBe("https://arctos.grc/schema/bpmn/1.0");
    expect(d.prefix).toBe(ARCTOS_PREFIX);
    expect(d.xml.tagAlias).toBe("lowerCase");
    expect(d.types.map((t) => t.name)).toEqual([
      "GrcMetadata",
      "RiskRefs",
      "ControlRefs",
      "DocumentRefs",
      "RiskRef",
      "ControlRef",
      "DocumentRef",
      "Raci",
      "BcmKpi",
      "Ropa",
    ]);
  });

  it("registers the type under the lower-cased tag name", () => {
    expect(ARCTOS_METADATA_LOCAL_TYPE).toBe("grcmetadata");
    expect(localType({ $type: "arctos:GrcMetadata" })).toBe(
      ARCTOS_METADATA_LOCAL_TYPE,
    );
  });

  it("can be instantiated more than once without sharing state", () => {
    const a = createArctosModdle();
    const b = createArctosModdle();
    expect(a).not.toBe(b);
    expect(
      a.create("arctos:GrcMetadata", { lineOfDefense: "first" }).lineOfDefense,
    ).toBe("first");
  });
});

describe("importXml / exportXml", () => {
  it("imports every corpus file without throwing", async () => {
    for (const entry of loadCorpus()) {
      const { definitions } = await importXml(entry.xml);
      expect(definitions.$type, entry.name).toBe("bpmn:Definitions");
    }
  });

  it("reports moddle warnings instead of swallowing them", async () => {
    const { warnings } = await importXml(
      corpusXml("synth-dangling-references"),
    );
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.map((w) => String(w.message))).toContain(
      "unresolved reference <Message_Missing>",
    );
  });

  it("throws a typed error on input that is not BPMN", async () => {
    await expect(importXml("not xml at all")).rejects.toThrow(
      /failed to import/,
    );
  });

  it("keeps foreign extension elements through a round trip", async () => {
    const xml = corpusXml("synth-foreign-camunda-extensions");
    const out = await exportXml((await importXml(xml)).definitions);
    for (const marker of [
      "camunda:formData",
      "camunda:taskListener",
      "zeebe:assignmentDefinition",
      "signavio:signavioDiagramMetaData",
      'camunda:historyTimeToLive="180"',
      "<arctos:grcMetadata",
    ]) {
      expect(out, marker).toContain(marker);
    }
  });

  it("keeps a foreign namespace that is declared on the extension element itself", async () => {
    const out = await exportXml(
      (await importXml(corpusXml("synth-foreign-namespace-declared-locally")))
        .definitions,
    );
    expect(out).toContain("cost-center");
    expect(out).toContain("Nur lokal deklarierter Namensraum");
  });
});

describe("Z-D read-preserve-write", () => {
  const xml = () => corpusXml("repo-seed-order-callactivity");

  it("returns the source bytes for an unedited tree", async () => {
    const { definitions } = await importXml(xml());
    expect(isUnmodified(definitions)).toBe(true);
    expect(await exportXml(definitions, { preferPreservedSource: true })).toBe(
      xml(),
    );
  });

  it("re-serialises once the tree is marked modified", async () => {
    const { definitions } = await importXml(xml());
    markModified(definitions);
    expect(isUnmodified(definitions)).toBe(false);
    const out = await exportXml(definitions, { preferPreservedSource: true });
    expect(out).not.toBe(xml());
    expect(out).toContain("CallActivity_OA_Touren");
  });

  it("is off by default, so the harness measures the serialiser", async () => {
    const { definitions } = await importXml(xml());
    expect(await exportXml(definitions)).not.toBe(xml());
  });

  it("does not leak the source text into the serialised XML", async () => {
    const { definitions } = await importXml(xml());
    const out = await exportXml(definitions);
    expect(out).not.toContain("sourceText");
    expect(out).not.toContain("arctos.bpmn");
  });
});

describe("access helpers", () => {
  it("walks processes, flow nodes and sequence flows", async () => {
    const { definitions } = await importXml(
      corpusXml("repo-parser-mixed-types-subprocess"),
    );
    const process = getProcesses(definitions)[0];
    expect(process).toBeDefined();
    if (!process) return;
    const nodes = getFlowNodes(process);
    expect(nodes.map((n) => n.id)).toContain("Task_1");
    // recursion reaches into the sub-process
    expect(nodes.some((n) => n.$type === "bpmn:SubProcess")).toBe(true);
    expect(getFlowNodes(process, false).length).toBeLessThan(nodes.length);
    expect(
      getSequenceFlows(process).every((f) => f.$type === "bpmn:SequenceFlow"),
    ).toBe(true);
  });

  it("resolves pools, lanes, lane membership and message flows", async () => {
    const { definitions } = await importXml(
      corpusXml("synth-collaboration-pools-lanes"),
    );
    const collaboration = getCollaborations(definitions)[0];
    expect(collaboration).toBeDefined();
    if (!collaboration) return;

    const participants = getParticipants(collaboration);
    expect(participants.map((p) => p.name)).toEqual(["Bank", "Kunde"]);
    expect(getMessageFlows(collaboration).map((f) => f.id)).toEqual([
      "MessageFlow_1",
      "MessageFlow_2",
    ]);

    const bankParticipant = participants[0];
    expect(bankParticipant).toBeDefined();
    if (!bankParticipant) return;
    const bank = getParticipantProcess(definitions, bankParticipant);
    expect(bank?.id).toBe("Process_Bank");
    if (!bank) return;

    const lanes = getLanes(bank);
    expect(lanes.map((l) => l.name)).toEqual([
      "Sachbearbeitung",
      "Genehmigung",
    ]);
    const firstLane = lanes[0];
    expect(firstLane).toBeDefined();
    if (!firstLane) return;
    expect(getLaneFlowNodes(firstLane).map((n) => n.id)).toEqual([
      "Start_Bank",
      "Task_Bank_Pruefen",
    ]);

    const approve = getFlowNodes(bank).find(
      (n) => n.id === "Task_Bank_Entscheiden",
    );
    expect(approve).toBeDefined();
    if (!approve) return;
    expect(getLaneOf(bank, approve)?.name).toBe("Genehmigung");
  });

  it("resolves boundary-event attachment and interruption", async () => {
    const { definitions } = await importXml(corpusXml("synth-boundary-events"));
    const process = getProcesses(definitions)[0];
    expect(process).toBeDefined();
    if (!process) return;
    const task = getFlowNodes(process).find((n) => n.id === "Task_Freigabe");
    expect(task).toBeDefined();
    if (!task) return;

    const attached = getAttachedBoundaryEvents(process, task);
    expect(attached.map((e) => e.id).sort()).toEqual([
      "Boundary_Error",
      "Boundary_Timer",
    ]);
    expect(attached.every((e) => isInterrupting(e))).toBe(true);

    const nonInterrupting = getFlowNodes(process).find(
      (n) => n.id === "Boundary_NonInterrupt",
    );
    expect(nonInterrupting).toBeDefined();
    if (!nonInterrupting) return;
    expect(isInterrupting(nonInterrupting)).toBe(false);
    expect(getAttachedToRef(nonInterrupting)?.id).toBe("Sub_Pruefung");
  });

  it("indexes DI and reads bounds and waypoints", async () => {
    const { definitions } = await importXml(
      corpusXml("repo-seed-management-review"),
    );
    const di = buildDiIndex(definitions);
    const shape = di.get("Task_MR_Inputs");
    expect(shape).toBeDefined();
    if (!shape) return;
    expect(getBounds(shape)).toEqual({ x: 240, y: 80, width: 100, height: 80 });

    const edge = di.get("Flow_1401_1");
    expect(edge).toBeDefined();
    if (!edge) return;
    expect(getWaypoints(edge)).toEqual([
      { x: 188, y: 120 },
      { x: 240, y: 120 },
    ]);
  });

  it("returns empty results for a diagram without a DI section", async () => {
    const { definitions } = await importXml(
      corpusXml("synth-without-di-section"),
    );
    expect(buildDiIndex(definitions).size).toBe(0);
    expect(getProcesses(definitions)).toHaveLength(1);
  });
});

describe("arctos:grcMetadata access", () => {
  it("reads the full payload of a flow node", async () => {
    const { definitions } = await importXml(
      corpusXml("repo-arctos-full-grcmetadata"),
    );
    const map = readGrcMetadataMap(definitions);
    const meta = map.get("Task_1");
    expect(meta).toBeDefined();
    if (!meta) return;
    expect(meta.lineOfDefense).toBe("first");
    expect(meta.riskRefs).toEqual([
      {
        id: "00000000-0000-0000-0000-000000000001",
        title: "Fraud",
        inherentScore: 12,
        residualScore: 6,
        status: undefined,
      },
    ]);
    expect(meta.controlRefs[0]?.effectiveness).toBe("effective");
    expect(meta.documentRefs[0]?.documentType).toBe("sop");
    expect(meta.ropa).toEqual({
      isProcessingActivity: true,
      purpose: "Order processing",
      legalBasis: "contract",
      requiresDpia: false,
    });
  });

  it("reads metadata whose tag was written with an upper-case initial", async () => {
    const { definitions } = await importXml(
      corpusXml("synth-grcmetadata-uppercase-tagalias"),
    );
    const meta = readGrcMetadataMap(definitions).get("TA_Task");
    expect(meta).toBeDefined();
    if (!meta) return;
    expect(meta.lineOfDefense).toBe("second");
    expect(meta.isCriticalProcess).toBe(true);
    expect(meta.bcmKpi).toEqual({
      mtpdMinutes: 240,
      rtoMinutes: 60,
      rpoMinutes: 15,
      criticality: "high",
    });
  });

  it("reads RACI and coexists with foreign extension elements", async () => {
    const { definitions } = await importXml(
      corpusXml("synth-foreign-camunda-extensions"),
    );
    const process = getProcesses(definitions)[0];
    expect(process).toBeDefined();
    if (!process) return;
    const task = getFlowNodes(process).find((n) => n.id === "F_Task");
    expect(task).toBeDefined();
    if (!task) return;
    const meta = readGrcMetadata(task);
    expect(meta?.raci).toEqual({
      responsibleRoleId: "role-1",
      accountableRoleId: "role-2",
      consultedRoleIds: "role-3,role-4",
      informedRoleIds: "role-5",
    });
    expect(meta?.isCriticalProcess).toBe(true);
  });

  it("returns undefined for a node without metadata", async () => {
    const { definitions } = await importXml(
      corpusXml("repo-arctos-basic-no-extensions"),
    );
    const process = getProcesses(definitions)[0];
    expect(process).toBeDefined();
    if (!process) return;
    const node = getFlowNodes(process)[0];
    expect(node).toBeDefined();
    if (!node) return;
    expect(getGrcMetadataElement(node)).toBeUndefined();
    expect(readGrcMetadata(node)).toBeUndefined();
    expect(readGrcMetadataMap(definitions).size).toBe(0);
  });
});
