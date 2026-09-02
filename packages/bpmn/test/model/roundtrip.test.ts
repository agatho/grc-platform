import { describe, expect, it } from "vitest";

import { loadCorpus } from "./corpus";
import { allAssurancesHold, measureRoundTrip } from "./assurances";
import { countNodes, diffCounts } from "../../src/util/index";
import { exportXml, importXml } from "../../src/model/index";

/**
 * The round-trip test bench for the model layer.
 *
 * Structure, and why:
 *
 *  1. **Every file extracted from the repository must satisfy all four
 *     assurances.** These are the diagrams ARCTOS actually stores; a deviation
 *     here is a migration blocker, so it is a hard failure with no baseline
 *     and no exemption.
 *
 *  2. **The synthetic hard cases are measured against an explicit baseline.**
 *     Nine of them do *not* satisfy Z-A/Z-C today. That is a real result and
 *     it is written down here, file by file, with its cause. The assertion is
 *     a ratchet in both directions: a file that starts deviating fails, and a
 *     file that stops deviating also fails, because then this list is stale
 *     and someone must decide whether the fix is intended. Nothing is
 *     tolerated silently — the full detail lives in `ROUNDTRIP-REPORT.md`.
 *
 *  3. **Characterisation tests** pin each root cause on its own, so the report
 *     is not the only place the finding exists.
 */

const corpus = loadCorpus();

/**
 * Files that do not satisfy all four assurances, with the reason.
 *
 * All of them are `synth-*`: hard cases built for this spike, none of them
 * occurring in the repository today. Three distinct causes:
 *
 *   (a) `moddle-xml` omits an attribute whose value equals the schema default;
 *   (b) `moddle-xml` drops an IDREF attribute it cannot resolve;
 *   (c) `xml.tagAlias: "lowerCase"` rewrites `GrcMetadata` → `grcMetadata`
 *       on write (required by plan §5.2 — a normalisation, not a defect).
 *
 * Comments are a fourth, separate case: they are not part of Z-C (which counts
 * elements, attributes and text nodes) but they do move Z-A, because a comment
 * is content a reviewer put there on purpose.
 */
const KNOWN_DEVIATIONS: Readonly<Record<string, string>> = {
  "synth-all-gateway-types":
    "(a) eventBasedGateway/@instantiate and @eventGatewayType equal their schema defaults",
  "synth-boundary-events":
    '(a) boundaryEvent/@cancelActivity="true" equals its schema default',
  "synth-comments-and-pi":
    "XML comments and processing instructions are not represented in the moddle tree and are dropped",
  "synth-dangling-references":
    "(b) unresolvable IDREFs (@dataStoreRef, @messageRef, @errorRef, BPMNShape/@bpmnElement) are dropped",
  "synth-data-objects-and-artifacts":
    '(a) dataObject/@isCollection="false" equals its schema default',
  "synth-grcmetadata-uppercase-tagalias":
    "(c) <arctos:GrcMetadata> is read but written back as <arctos:grcMetadata>; (a) ropa/@requiresDpia default",
  "synth-nested-subprocesses":
    '(a) multiInstanceLoopCharacteristics/@isSequential="false" equals its schema default',
  "synth-schema-default-attributes":
    "(a) sixteen explicitly written schema-default attributes are omitted",
  "synth-unusual-attribute-order":
    "(a) definitions/@expressionLanguage and @typeLanguage equal their schema defaults",
};

describe("round trip — corpus", () => {
  it("the corpus is non-trivial and covers both origins", () => {
    expect(corpus.length).toBeGreaterThanOrEqual(50);
    expect(
      corpus.filter((c) => c.origin === "repo").length,
    ).toBeGreaterThanOrEqual(30);
    expect(
      corpus.filter((c) => c.origin === "synth").length,
    ).toBeGreaterThanOrEqual(15);
  });

  describe.each(corpus.filter((c) => c.origin === "repo"))(
    "repository diagram $name",
    ({ name, xml }) => {
      it("satisfies Z-A, Z-B, Z-C and Z-D", async () => {
        const m = await measureRoundTrip(name, xml);
        expect(m.importError).toBeUndefined();
        // Asserted one assurance at a time, so a failure names which one broke.
        expect(
          m.canonicalEquivalence.ok,
          `Z-A: ${m.canonicalEquivalence.detail} — ${JSON.stringify(m.canonicalDifferences.slice(0, 5))}`,
        ).toBe(true);
        expect(m.idempotence.ok, `Z-B: ${m.idempotence.detail}`).toBe(true);
        expect(
          m.nonLoss.ok,
          `Z-C: ${m.nonLoss.detail} — ${JSON.stringify(m.losses)}`,
        ).toBe(true);
        expect(
          m.readPreserveWrite.ok,
          `Z-D: ${m.readPreserveWrite.detail}`,
        ).toBe(true);
      });
    },
  );

  describe.each(corpus.filter((c) => c.origin === "synth"))(
    "hard case $name",
    ({ name, xml }) => {
      it("matches its recorded round-trip result exactly", async () => {
        const m = await measureRoundTrip(name, xml);
        expect(m.importError).toBeUndefined();

        // Z-B and Z-D hold for every file in the corpus, synthetic included.
        // They are asserted unconditionally: no baseline, no exemption.
        expect(m.idempotence.ok, `Z-B: ${m.idempotence.detail}`).toBe(true);
        expect(
          m.readPreserveWrite.ok,
          `Z-D: ${m.readPreserveWrite.detail}`,
        ).toBe(true);

        const expected = KNOWN_DEVIATIONS[name];
        if (expected === undefined) {
          expect(
            allAssurancesHold(m),
            `${name} was expected to be clean but deviates: ` +
              `Z-A ${m.canonicalEquivalence.detail}; Z-C ${m.nonLoss.detail}; ` +
              `losses ${JSON.stringify(m.losses.map((l) => l.key))}`,
          ).toBe(true);
          return;
        }
        expect(
          allAssurancesHold(m),
          `${name} no longer deviates. Recorded reason was: ${expected}. ` +
            "If that is intended, remove the entry from KNOWN_DEVIATIONS.",
        ).toBe(false);
      });
    },
  );

  it("no repository diagram deviates from any assurance", async () => {
    const failures: string[] = [];
    for (const entry of corpus.filter((c) => c.origin === "repo")) {
      const m = await measureRoundTrip(entry.name, entry.xml);
      if (!allAssurancesHold(m)) failures.push(entry.name);
    }
    expect(failures).toEqual([]);
  });

  it("every recorded deviation names a file that is still in the corpus", () => {
    const names = new Set(corpus.map((c) => c.name));
    for (const name of Object.keys(KNOWN_DEVIATIONS)) {
      expect(
        names.has(name),
        `KNOWN_DEVIATIONS mentions ${name}, which no longer exists`,
      ).toBe(true);
    }
  });
});

describe("round trip — root causes, pinned individually", () => {
  it("(a) drops an attribute whose value equals the schema default", async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D">' +
      '<bpmn:process id="P" isExecutable="false">' +
      '<bpmn:task id="T" isForCompensation="false"/>' +
      "</bpmn:process></bpmn:definitions>";
    const { definitions } = await importXml(xml);
    const out = await exportXml(definitions);
    expect(out).toContain('id="T"');
    // The attribute was written explicitly and comes back missing.
    expect(out).not.toContain("isForCompensation");
    const { losses } = diffCounts(countNodes(xml), countNodes(out));
    expect(losses.map((l) => l.key)).toContain(
      "{http://www.omg.org/spec/BPMN/20100524/MODEL}task/@isForCompensation",
    );
  });

  it("(a) keeps an attribute whose value differs from the schema default", async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D">' +
      '<bpmn:process id="P" isExecutable="false">' +
      '<bpmn:task id="T" isForCompensation="true"/>' +
      "</bpmn:process></bpmn:definitions>";
    const out = await exportXml((await importXml(xml)).definitions);
    expect(out).toContain('isForCompensation="true"');
  });

  it("(b) drops an IDREF it cannot resolve, and says so in a warning", async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D">' +
      '<bpmn:process id="P" isExecutable="false">' +
      '<bpmn:callActivity id="C" calledElement="Process_Missing"/>' +
      '<bpmn:startEvent id="S"><bpmn:messageEventDefinition id="M" messageRef="Message_Missing"/></bpmn:startEvent>' +
      "</bpmn:process></bpmn:definitions>";
    const { definitions, warnings } = await importXml(xml);
    const out = await exportXml(definitions);
    expect(warnings.map((w) => String(w.message))).toContain(
      "unresolved reference <Message_Missing>",
    );
    expect(out).not.toContain("Message_Missing");
    // `calledElement` is a QName, not an IDREF — it is *not* affected.
    expect(out).toContain('calledElement="Process_Missing"');
  });

  it("(c) reads <arctos:GrcMetadata> and always writes <arctos:grcMetadata>", async () => {
    const upper =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
      'xmlns:arctos="https://arctos.grc/schema/bpmn/1.0" id="D">' +
      '<bpmn:process id="P"><bpmn:userTask id="T"><bpmn:extensionElements>' +
      '<arctos:GrcMetadata lineOfDefense="first"/>' +
      "</bpmn:extensionElements></bpmn:userTask></bpmn:process></bpmn:definitions>";
    const out = await exportXml((await importXml(upper)).definitions);
    expect(out).toContain("<arctos:grcMetadata");
    expect(out).not.toContain("<arctos:GrcMetadata");
    expect(out).toContain('lineOfDefense="first"');
  });

  it("drops XML comments and processing instructions", async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      "<!-- keep me -->" +
      '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D">' +
      "<!-- and me -->" +
      '<bpmn:process id="P"/></bpmn:definitions>';
    const out = await exportXml((await importXml(xml)).definitions);
    expect(out).not.toContain("keep me");
    expect(out).not.toContain("and me");
  });

  it("reorders sibling elements into schema order", async () => {
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D">' +
      '<bpmn:process id="P"><bpmn:task id="T">' +
      "<bpmn:outgoing>F2</bpmn:outgoing><bpmn:incoming>F1</bpmn:incoming>" +
      "</bpmn:task>" +
      '<bpmn:sequenceFlow id="F1" targetRef="T"/><bpmn:sequenceFlow id="F2" sourceRef="T"/>' +
      "</bpmn:process></bpmn:definitions>";
    const out = await exportXml((await importXml(xml)).definitions);
    expect(out.indexOf("<bpmn:incoming>")).toBeLessThan(
      out.indexOf("<bpmn:outgoing>"),
    );
  });
});
