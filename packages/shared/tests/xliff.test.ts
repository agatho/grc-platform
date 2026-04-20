// Sprint 21: XLIFF Export/Import Unit Tests
import { describe, it, expect } from "vitest";
import {
  generateXliff,
  parseXliff,
  generateCsv,
  parseCsv,
  type XliffDocument,
  type XliffTranslationUnit,
  type CsvRow,
} from "../src/utils/xliff";

describe("generateXliff", () => {
  it("should generate valid XLIFF 2.0 XML", () => {
    const doc: XliffDocument = {
      sourceLanguage: "de",
      targetLanguage: "en",
      units: [
        {
          id: "risk:abc:title",
          entityType: "risk",
          entityId: "abc",
          field: "title",
          source: "Lieferkettenrisiko",
          target: "Supply Chain Risk",
        },
      ],
    };

    const xml = generateXliff(doc);

    expect(xml).toContain('xmlns="urn:oasis:names:tc:xliff:document:2.0"');
    expect(xml).toContain('srcLang="de"');
    expect(xml).toContain('trgLang="en"');
    expect(xml).toContain('<source xml:lang="de">Lieferkettenrisiko</source>');
    expect(xml).toContain('<target xml:lang="en">Supply Chain Risk</target>');
    expect(xml).toContain('<meta type="entityType">risk</meta>');
    expect(xml).toContain('<meta type="entityId">abc</meta>');
    expect(xml).toContain('<meta type="field">title</meta>');
  });

  it("should escape XML special characters", () => {
    const doc: XliffDocument = {
      sourceLanguage: "de",
      targetLanguage: "en",
      units: [
        {
          id: "test:1:title",
          entityType: "risk",
          entityId: "1",
          field: "title",
          source: 'Risiko & "Kontrolle"',
          target: 'Risk & "Control"',
        },
      ],
    };

    const xml = generateXliff(doc);
    expect(xml).toContain("Risiko &amp; &quot;Kontrolle&quot;");
  });

  it("should include notes when provided", () => {
    const doc: XliffDocument = {
      sourceLanguage: "de",
      targetLanguage: "en",
      units: [
        {
          id: "test:1:title",
          entityType: "risk",
          entityId: "1",
          field: "title",
          source: "A",
          target: "B",
          note: "GRC context",
        },
      ],
    };

    const xml = generateXliff(doc);
    expect(xml).toContain("<note>GRC context</note>");
  });
});

describe("parseXliff", () => {
  it("should parse a valid XLIFF 2.0 document", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xliff xmlns="urn:oasis:names:tc:xliff:document:2.0" version="2.0"
  srcLang="de" trgLang="en">
  <file id="arctos-translations">
    <unit id="risk:abc:title">
      <metadata>
        <meta type="entityType">risk</meta>
        <meta type="entityId">abc</meta>
        <meta type="field">title</meta>
      </metadata>
      <segment>
        <source xml:lang="de">Lieferkettenrisiko</source>
        <target xml:lang="en">Supply Chain Risk</target>
      </segment>
    </unit>
  </file>
</xliff>`;

    const doc = parseXliff(xml);
    expect(doc.sourceLanguage).toBe("de");
    expect(doc.targetLanguage).toBe("en");
    expect(doc.units).toHaveLength(1);
    expect(doc.units[0].entityType).toBe("risk");
    expect(doc.units[0].entityId).toBe("abc");
    expect(doc.units[0].field).toBe("title");
    expect(doc.units[0].source).toBe("Lieferkettenrisiko");
    expect(doc.units[0].target).toBe("Supply Chain Risk");
  });

  it("should throw for missing language attributes", () => {
    expect(() => parseXliff("<xliff></xliff>")).toThrow(
      "Invalid XLIFF: missing srcLang or trgLang",
    );
  });

  it("should sanitize target text (XSS prevention)", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<xliff xmlns="urn:oasis:names:tc:xliff:document:2.0" version="2.0"
  srcLang="de" trgLang="en">
  <file id="test">
    <unit id="test:1:title">
      <metadata>
        <meta type="entityType">risk</meta>
        <meta type="entityId">1</meta>
        <meta type="field">title</meta>
      </metadata>
      <segment>
        <source xml:lang="de">Test</source>
        <target xml:lang="en">&lt;script&gt;alert(1)&lt;/script&gt;</target>
      </segment>
    </unit>
  </file>
</xliff>`;

    const doc = parseXliff(xml);
    // The target should have HTML entities escaped
    expect(doc.units[0].target).not.toContain("<script>");
  });

  it("should round-trip: generate then parse", () => {
    const original: XliffDocument = {
      sourceLanguage: "de",
      targetLanguage: "en",
      units: [
        {
          id: "risk:1:title",
          entityType: "risk",
          entityId: "1",
          field: "title",
          source: "Risiko A",
          target: "Risk A",
        },
        {
          id: "risk:1:description",
          entityType: "risk",
          entityId: "1",
          field: "description",
          source: "Beschreibung A",
          target: "Description A",
        },
      ],
    };

    const xml = generateXliff(original);
    const parsed = parseXliff(xml);

    expect(parsed.sourceLanguage).toBe("de");
    expect(parsed.targetLanguage).toBe("en");
    expect(parsed.units).toHaveLength(2);
    expect(parsed.units[0].source).toBe("Risiko A");
    expect(parsed.units[0].target).toBe("Risk A");
    expect(parsed.units[1].field).toBe("description");
  });
});

describe("generateCsv", () => {
  it("should generate CSV with correct header", () => {
    const rows: CsvRow[] = [
      {
        id: "risk:1:title",
        entityType: "risk",
        entityId: "1",
        field: "title",
        source: "Risiko",
        target: "Risk",
      },
    ];

    const csv = generateCsv(rows, "de", "en");
    expect(csv).toContain("id,entity_type,entity_id,field,source_de,target_en");
    expect(csv).toContain("risk:1:title,risk,1,title,Risiko,Risk");
  });

  it("should escape commas and quotes in values", () => {
    const rows: CsvRow[] = [
      {
        id: "test:1:title",
        entityType: "risk",
        entityId: "1",
        field: "title",
        source: 'Text with "quotes" and, commas',
        target: "Normal",
      },
    ];

    const csv = generateCsv(rows, "de", "en");
    expect(csv).toContain('"Text with ""quotes"" and, commas"');
  });
});

describe("parseCsv", () => {
  it("should parse a valid CSV", () => {
    const csv = `id,entity_type,entity_id,field,source_de,target_en
risk:1:title,risk,1,title,Risiko,Risk
risk:1:desc,risk,1,description,Beschreibung,Description`;

    const result = parseCsv(csv);
    expect(result.sourceLanguage).toBe("de");
    expect(result.targetLanguage).toBe("en");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].source).toBe("Risiko");
    expect(result.rows[0].target).toBe("Risk");
  });

  it("should throw for invalid header", () => {
    expect(() => parseCsv("id,type,value\na,b,c")).toThrow(
      "Invalid CSV header",
    );
  });

  it("should throw for empty CSV", () => {
    expect(() => parseCsv("")).toThrow(
      "requires header and at least one data row",
    );
  });

  it("should handle quoted values with commas", () => {
    const csv = `id,entity_type,entity_id,field,source_de,target_en
test:1:title,risk,1,title,"Text, with commas",Normal`;

    const result = parseCsv(csv);
    expect(result.rows[0].source).toBe("Text, with commas");
  });
});
