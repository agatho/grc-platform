import { describe, expect, it } from "vitest";

import {
  canonicalize,
  countNodes,
  diffCanonical,
  diffCounts,
  elementNames,
  parseXml,
  XmlParseError,
} from "../../src/util/index.js";

/**
 * The canonicaliser is the measuring instrument of this whole spike. If it is
 * too lax, the round-trip report is a false green; if it is too strict, it
 * cries wolf and the report gets ignored. So it gets tested against the two
 * questions directly: *what must it consider equal*, and *what must it never
 * consider equal*.
 */

const DEF = 'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"';

describe("xml parser", () => {
  it("reads elements, attributes, text, CDATA and comments", () => {
    const doc = parseXml(
      '<?xml version="1.0"?><r a="1" b=\'2\'><c/>text<![CDATA[<raw>]]><!--n--></r>',
    );
    expect(doc.root.qname).toBe("r");
    expect(doc.root.attributes.map((a) => [a.qname, a.value])).toEqual([
      ["a", "1"],
      ["b", "2"],
    ]);
    expect(doc.root.children.map((c) => c.kind)).toEqual([
      "element",
      "text",
      "text",
      "comment",
    ]);
    const cdata = doc.root.children[2];
    expect(cdata?.kind === "text" && cdata.value).toBe("<raw>");
    expect(cdata?.kind === "text" && cdata.cdata).toBe(true);
  });

  it("decodes the predefined entities and numeric references", () => {
    const doc = parseXml('<r n="a &amp; b &lt; c &#64; d &#x41;"/>');
    expect(doc.root.attributes[0]?.value).toBe("a & b < c @ d A");
  });

  it("rejects malformed documents rather than guessing", () => {
    expect(() => parseXml("<a><b></a>")).toThrow(XmlParseError);
    expect(() => parseXml("<a>")).toThrow(XmlParseError);
    expect(() => parseXml("<a/><b/>")).toThrow(XmlParseError);
    expect(() => parseXml("<a x=1/>")).toThrow(XmlParseError);
  });
});

describe("canonicalize — what must compare equal", () => {
  it("ignores the namespace prefix, including a default namespace", () => {
    const prefixed = `<bpmn:definitions ${DEF}><bpmn:process id="P"/></bpmn:definitions>`;
    const renamed =
      '<x:definitions xmlns:x="http://www.omg.org/spec/BPMN/20100524/MODEL"><x:process id="P"/></x:definitions>';
    const defaulted =
      '<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"><process id="P"/></definitions>';
    expect(canonicalize(renamed)).toBe(canonicalize(prefixed));
    expect(canonicalize(defaulted)).toBe(canonicalize(prefixed));
  });

  it("ignores attribute order", () => {
    expect(canonicalize(`<r ${DEF} a="1" b="2"/>`)).toBe(
      canonicalize(`<r ${DEF} b="2" a="1"/>`),
    );
  });

  it("ignores insignificant whitespace and indentation", () => {
    expect(canonicalize(`<r ${DEF}>\n  <c id="1"/>\n</r>`)).toBe(
      canonicalize(`<r ${DEF}><c id="1"/></r>`),
    );
  });

  it("ignores whether text was written as CDATA", () => {
    expect(canonicalize("<r><t><![CDATA[a & b]]></t></r>")).toBe(
      canonicalize("<r><t>a &amp; b</t></r>"),
    );
  });

  it("rounds numeric attributes to six decimals", () => {
    expect(canonicalize('<b x="152" y="102.0"/>')).toBe(
      canonicalize('<b x="152.0000000001" y="102"/>'),
    );
  });

  it("ignores sibling order by default, but can be asked not to", () => {
    const a = '<p><a id="1"/><b id="2"/></p>';
    const b = '<p><b id="2"/><a id="1"/></p>';
    expect(canonicalize(a)).toBe(canonicalize(b));
    expect(canonicalize(a, { sortSiblings: false })).not.toBe(
      canonicalize(b, { sortSiblings: false }),
    );
  });

  it("resolves the prefix inside an xsi:type value", () => {
    const one =
      `<r ${DEF} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
      '<e xsi:type="bpmn:tFormalExpression"/></r>';
    const two =
      '<r xmlns:m="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
      'xmlns:s="http://www.w3.org/2001/XMLSchema-instance">' +
      '<e s:type="m:tFormalExpression"/></r>';
    expect(canonicalize(two)).toBe(canonicalize(one));
  });
});

describe("canonicalize — what must never compare equal", () => {
  it("keeps waypoint order, because the sequence is the polyline", () => {
    const ns =
      'xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" ' +
      'xmlns:di="http://www.omg.org/spec/DD/20100524/DI"';
    const forward = `<bpmndi:BPMNEdge ${ns}><di:waypoint x="1" y="1"/><di:waypoint x="9" y="9"/></bpmndi:BPMNEdge>`;
    const reversed = `<bpmndi:BPMNEdge ${ns}><di:waypoint x="9" y="9"/><di:waypoint x="1" y="1"/></bpmndi:BPMNEdge>`;
    expect(canonicalize(forward)).not.toBe(canonicalize(reversed));
  });

  it("keeps the order of mixed content", () => {
    expect(canonicalize("<r>a<b/>c</r>")).not.toBe(
      canonicalize("<r>c<b/>a</r>"),
    );
  });

  it("distinguishes two namespaces that share a prefix spelling", () => {
    const one = '<r xmlns:v="http://one/"><v:e a="1"/></r>';
    const two = '<r xmlns:v="http://two/"><v:e a="1"/></r>';
    expect(canonicalize(one)).not.toBe(canonicalize(two));
  });

  it("notices a dropped attribute, a dropped element and changed text", () => {
    expect(canonicalize('<r a="1" b="2"/>')).not.toBe(
      canonicalize('<r a="1"/>'),
    );
    expect(canonicalize("<r><a/><b/></r>")).not.toBe(
      canonicalize("<r><a/></r>"),
    );
    expect(canonicalize("<r><t>x</t></r>")).not.toBe(
      canonicalize("<r><t>y</t></r>"),
    );
  });

  it("notices a difference beyond six decimals is *not* a difference, but one within is", () => {
    expect(canonicalize('<b x="1.0000001"/>')).toBe(canonicalize('<b x="1"/>'));
    expect(canonicalize('<b x="1.00001"/>')).not.toBe(
      canonicalize('<b x="1"/>'),
    );
  });
});

describe("diffCanonical", () => {
  it("reports one removed line for one dropped attribute, not a cascade", () => {
    const before = canonicalize(
      '<r a="1" b="2"><c id="1"/><d id="2"/><e id="3"/></r>',
    );
    const after = canonicalize(
      '<r a="1"><c id="1"/><d id="2"/><e id="3"/></r>',
    );
    const diff = diffCanonical(before, after);
    expect(diff).toHaveLength(1);
    expect(diff[0]?.kind).toBe("removed");
    expect(diff[0]?.text).toContain("@b");
  });

  it("returns nothing for identical documents", () => {
    const c = canonicalize(`<r ${DEF}><p id="1"/></r>`);
    expect(diffCanonical(c, c)).toEqual([]);
  });

  it("names the enclosing element of a difference", () => {
    const before = canonicalize('<r><p id="1" extra="x"/></r>');
    const after = canonicalize('<r><p id="1"/></r>');
    expect(diffCanonical(before, after)[0]?.context).toBe("p");
  });
});

describe("countNodes / diffCounts", () => {
  it("counts elements, attributes and text nodes by resolved name", () => {
    const counts = countNodes(
      `<bpmn:definitions ${DEF} id="D"><bpmn:process id="P"><bpmn:task id="T" name="x"/></bpmn:process></bpmn:definitions>`,
    );
    expect(counts.totalElements).toBe(3);
    expect(
      counts.elements.get("{http://www.omg.org/spec/BPMN/20100524/MODEL}task"),
    ).toBe(1);
    expect(
      counts.attributes.get(
        "{http://www.omg.org/spec/BPMN/20100524/MODEL}task/@name",
      ),
    ).toBe(1);
  });

  it("does not count namespace declarations as attributes", () => {
    expect(countNodes(`<r ${DEF} id="1"/>`).totalAttributes).toBe(1);
  });

  it("separates losses from additions", () => {
    const before = countNodes('<r><a id="1"/><a id="2"/><b/></r>');
    const after = countNodes('<r><a id="1"/><c/></r>');
    const { losses, additions } = diffCounts(before, after);
    expect(losses.map((l) => `${l.key} ${l.before}->${l.after}`)).toEqual([
      "a 2->1",
      "b 1->0",
      "a/@id 2->1",
    ]);
    expect(additions.map((a) => a.key)).toEqual(["c"]);
  });
});

describe("elementNames", () => {
  it("lists resolved element names once each, sorted", () => {
    expect(
      elementNames(
        `<bpmn:definitions ${DEF}><bpmn:process/><bpmn:process/></bpmn:definitions>`,
      ),
    ).toEqual([
      "{http://www.omg.org/spec/BPMN/20100524/MODEL}definitions",
      "{http://www.omg.org/spec/BPMN/20100524/MODEL}process",
    ]);
  });
});
