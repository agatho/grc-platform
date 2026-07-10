// B1.2/B1.3: moddle-based arctos:* extraction and injection — write→parse
// round-trip, replace-not-duplicate semantics and preservation of foreign
// extensionElements.

import { describe, it, expect } from "vitest";
import type { GrcMetadata } from "@/components/bpmn/arctos-grc-extractor";
import {
  parseArctosGrcMetadataMap,
  extractGrcMetadataFromXml,
} from "@/lib/bpmn-arctos-parse";
import { injectGrcMetadataModdle } from "@/lib/bpmn-arctos-write";

const BASIC = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
    xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
    id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:userTask id="Task_1" name="Check invoice"></bpmn:userTask>
    <bpmn:serviceTask id="Task_2" name="Book payment"></bpmn:serviceTask>
  </bpmn:process>
</bpmn:definitions>`;

// Same diagram, but Task_1 already carries a foreign (non-arctos) extension
// element plus an existing arctos:grcMetadata that must be replaced.
const WITH_EXISTING = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
    xmlns:foo="http://example.com/foo"
    xmlns:arctos="https://arctos.grc/schema/bpmn/1.0"
    id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:userTask id="Task_1" name="Check invoice">
      <bpmn:extensionElements>
        <foo:props value="keep-me"/>
        <arctos:grcMetadata lineOfDefense="first">
          <arctos:riskRefs>
            <arctos:riskRef id="old-risk" title="Old"/>
          </arctos:riskRefs>
        </arctos:grcMetadata>
      </bpmn:extensionElements>
    </bpmn:userTask>
    <bpmn:serviceTask id="Task_2" name="Book payment"></bpmn:serviceTask>
  </bpmn:process>
</bpmn:definitions>`;

const META: GrcMetadata = {
  lineOfDefense: "second",
  isCriticalProcess: true,
  calledProcessId: "3d3adf6a-9d3f-4b6e-8a6c-0f0e1d2c3b4a",
  riskRefs: [
    { id: "risk-1", title: "Fraud", inherentScore: 20, residualScore: 8 },
  ],
  controlRefs: [{ id: "ctl-1", title: "4-eyes check", effectiveness: "high" }],
  documentRefs: [{ id: "doc-1", title: "SOP", documentType: "sop" }],
  raci: {
    responsibleRoleId: "role-r",
    accountableRoleId: "role-a",
    consultedRoleIds: "role-c1,role-c2",
    informedRoleIds: "role-i1",
  },
  bcmKpi: { mtpdMinutes: 240, rtoMinutes: 120, rpoMinutes: 60 },
  ropa: { isProcessingActivity: true, purpose: "billing", requiresDpia: true },
};

describe("parseArctosGrcMetadataMap", () => {
  it("round-trips metadata written by injectGrcMetadataModdle", async () => {
    const xml = await injectGrcMetadataModdle(
      BASIC,
      new Map([["Task_1", META]]),
    );
    const map = await parseArctosGrcMetadataMap(xml);

    expect([...map.keys()]).toEqual(["Task_1"]);
    const meta = map.get("Task_1")!;
    expect(meta.lineOfDefense).toBe("second");
    expect(meta.isCriticalProcess).toBe(true);
    // Call-Activity Drill-Down: linked child process survives the round-trip
    expect(meta.calledProcessId).toBe("3d3adf6a-9d3f-4b6e-8a6c-0f0e1d2c3b4a");
    expect(xml).toContain(
      'calledProcessId="3d3adf6a-9d3f-4b6e-8a6c-0f0e1d2c3b4a"',
    );
    expect(meta.riskRefs).toHaveLength(1);
    expect(meta.riskRefs?.[0]).toMatchObject({
      id: "risk-1",
      title: "Fraud",
      inherentScore: 20,
      residualScore: 8,
    });
    expect(meta.controlRefs?.[0]).toMatchObject({
      id: "ctl-1",
      effectiveness: "high",
    });
    expect(meta.documentRefs?.[0]).toMatchObject({
      id: "doc-1",
      documentType: "sop",
    });
    expect(meta.raci).toMatchObject({
      responsibleRoleId: "role-r",
      accountableRoleId: "role-a",
      consultedRoleIds: "role-c1,role-c2",
      informedRoleIds: "role-i1",
    });
    expect(meta.bcmKpi).toMatchObject({ mtpdMinutes: 240, rtoMinutes: 120 });
    expect(meta.ropa).toMatchObject({
      isProcessingActivity: true,
      purpose: "billing",
      requiresDpia: true,
    });
  });

  it("maps multiple elements independently", async () => {
    const xml = await injectGrcMetadataModdle(
      BASIC,
      new Map<string, GrcMetadata>([
        ["Task_1", { riskRefs: [{ id: "r1" }] }],
        ["Task_2", { lineOfDefense: "third" }],
      ]),
    );
    const map = await parseArctosGrcMetadataMap(xml);
    expect(map.size).toBe(2);
    expect(map.get("Task_1")?.riskRefs?.[0]?.id).toBe("r1");
    expect(map.get("Task_2")?.lineOfDefense).toBe("third");
  });

  it("round-trips a calledProcessId-only metadata (call activity link)", async () => {
    const xml = await injectGrcMetadataModdle(
      BASIC,
      new Map<string, GrcMetadata>([
        ["Task_2", { calledProcessId: "b1b2c3d4-e5f6-4a1b-9c8d-7e6f5a4b3c2d" }],
      ]),
    );
    const map = await parseArctosGrcMetadataMap(xml);
    expect(map.size).toBe(1);
    expect(map.get("Task_2")?.calledProcessId).toBe(
      "b1b2c3d4-e5f6-4a1b-9c8d-7e6f5a4b3c2d",
    );
    // Absent on parse when never written
    expect(map.get("Task_2")?.lineOfDefense).toBeUndefined();
  });

  it("returns an empty map for XML without arctos metadata", async () => {
    const map = await parseArctosGrcMetadataMap(BASIC);
    expect(map.size).toBe(0);
  });

  it("returns an empty map for empty or invalid XML (lenient like the regex predecessor)", async () => {
    expect((await parseArctosGrcMetadataMap("")).size).toBe(0);
    expect((await parseArctosGrcMetadataMap(null)).size).toBe(0);
    expect((await parseArctosGrcMetadataMap("<not-xml")).size).toBe(0);
  });

  it("extractGrcMetadataFromXml returns null for unknown element ids", async () => {
    const xml = await injectGrcMetadataModdle(
      BASIC,
      new Map([["Task_1", META]]),
    );
    expect(await extractGrcMetadataFromXml(xml, "Missing_999")).toBeNull();
    expect(
      (await extractGrcMetadataFromXml(xml, "Task_1"))?.lineOfDefense,
    ).toBe("second");
  });
});

describe("injectGrcMetadataModdle (write path)", () => {
  it("replaces existing arctos:grcMetadata instead of duplicating", async () => {
    const first = await injectGrcMetadataModdle(
      BASIC,
      new Map<string, GrcMetadata>([
        ["Task_1", { lineOfDefense: "first", riskRefs: [{ id: "old-risk" }] }],
      ]),
    );
    const second = await injectGrcMetadataModdle(
      first,
      new Map<string, GrcMetadata>([
        ["Task_1", { lineOfDefense: "second", riskRefs: [{ id: "new-risk" }] }],
      ]),
    );

    // Exactly one grcMetadata element for Task_1 — replaced, not appended.
    expect((second.match(/<arctos:grcMetadata/g) ?? []).length).toBe(1);

    const map = await parseArctosGrcMetadataMap(second);
    expect(map.size).toBe(1);
    const meta = map.get("Task_1")!;
    expect(meta.lineOfDefense).toBe("second");
    expect(meta.riskRefs?.map((r) => r.id)).toEqual(["new-risk"]);
  });

  it("preserves foreign extensionElements while replacing arctos metadata", async () => {
    const out = await injectGrcMetadataModdle(
      WITH_EXISTING,
      new Map<string, GrcMetadata>([
        ["Task_1", { lineOfDefense: "second", controlRefs: [{ id: "c9" }] }],
      ]),
    );

    // Foreign extension survives the rewrite …
    expect(out).toContain("keep-me");
    expect(out).toContain("foo:props");
    // … the old arctos metadata is gone, the new one is in place, once.
    expect(out).not.toContain("old-risk");
    expect((out.match(/<arctos:grcMetadata/g) ?? []).length).toBe(1);

    const meta = await extractGrcMetadataFromXml(out, "Task_1");
    expect(meta?.lineOfDefense).toBe("second");
    expect(meta?.controlRefs?.map((c) => c.id)).toEqual(["c9"]);
  });

  it("removes existing arctos metadata when the new metadata is empty", async () => {
    const out = await injectGrcMetadataModdle(
      WITH_EXISTING,
      new Map<string, GrcMetadata>([["Task_1", {}]]),
    );
    expect(out).not.toContain("arctos:grcMetadata");
    // The foreign extension element must still be there.
    expect(out).toContain("keep-me");
    const map = await parseArctosGrcMetadataMap(out);
    expect(map.size).toBe(0);
  });

  it("ignores unknown element ids and leaves the XML untouched", async () => {
    const out = await injectGrcMetadataModdle(
      BASIC,
      new Map<string, GrcMetadata>([["Missing_999", META]]),
    );
    expect(out).toBe(BASIC);
  });

  it("returns unparseable XML unchanged (best-effort parity with the legacy writer)", async () => {
    const broken = "<not-xml";
    expect(
      await injectGrcMetadataModdle(broken, new Map([["Task_1", META]])),
    ).toBe(broken);
  });

  it("declares the arctos namespace via the moddle serializer", async () => {
    const xml = await injectGrcMetadataModdle(
      BASIC,
      new Map([["Task_1", META]]),
    );
    expect(xml).toContain('xmlns:arctos="https://arctos.grc/schema/bpmn/1.0"');
  });
});
