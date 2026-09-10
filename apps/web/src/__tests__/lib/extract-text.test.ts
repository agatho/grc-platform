// DMS text-extraction dispatcher (upload → document.file_text).

import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  extractFileText,
  docxXmlToText,
  MAX_EXTRACT_CHARS,
} from "../../lib/documents/extract-text";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function makeDocx(bodyXml: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${bodyXml}</w:body>
</w:document>`,
  );
  zip.file("[Content_Types].xml", "<Types/>");
  return zip.generateAsync({ type: "nodebuffer" });
}

/** Build a real multi-page PDF fixture (pdf-lib is a direct dependency). */
async function makePdf(pageTexts: string[]): Promise<Buffer> {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const pageText of pageTexts) {
    const page = doc.addPage();
    page.drawText(pageText, { x: 50, y: 700, size: 14, font });
  }
  return Buffer.from(await doc.save());
}

describe("extractFileText", () => {
  it("decodes text/plain directly", async () => {
    const text = await extractFileText(
      Buffer.from("ISMS Richtlinie Passwortsicherheit"),
      "text/plain",
      "policy.txt",
    );
    expect(text).toBe("ISMS Richtlinie Passwortsicherheit");
  });

  it("decodes JSON, XML and CSV", async () => {
    expect(
      await extractFileText(
        Buffer.from('{"a":1}'),
        "application/json",
        "a.json",
      ),
    ).toBe('{"a":1}');
    expect(
      await extractFileText(
        Buffer.from("<r>x</r>"),
        "application/xml",
        "a.xml",
      ),
    ).toBe("<r>x</r>");
    expect(
      await extractFileText(Buffer.from("a;b\n1;2"), "text/csv", "a.csv"),
    ).toBe("a;b\n1;2");
  });

  it("extracts DOCX paragraphs via word/document.xml", async () => {
    const docx = await makeDocx(
      "<w:p><w:r><w:t>Kapitel 1 &amp; Anhang</w:t></w:r></w:p>" +
        "<w:p><w:r><w:t>Zweiter Absatz</w:t></w:r></w:p>",
    );
    const text = await extractFileText(docx, DOCX_MIME, "handbuch.docx");
    expect(text).toContain("Kapitel 1 & Anhang");
    expect(text).toContain("Zweiter Absatz");
    // paragraphs separated, tags gone
    expect(text).not.toContain("<w:");
  });

  it("extracts text from both pages of a PDF (pdfjs-dist legacy build)", async () => {
    const pdf = await makePdf([
      "Erste Seite ISMS Leitlinie",
      "Zweite Seite Anhang Kryptokonzept",
    ]);
    const text = await extractFileText(pdf, "application/pdf", "doc.pdf");
    expect(text).toContain("Erste Seite ISMS Leitlinie");
    expect(text).toContain("Zweite Seite Anhang Kryptokonzept");
  }, 30000);

  it("extracts PDFs uploaded as octet-stream via the .pdf extension", async () => {
    const pdf = await makePdf(["Fallback via Dateiendung"]);
    const text = await extractFileText(
      pdf,
      "application/octet-stream",
      "Scan.PDF",
    );
    expect(text).toContain("Fallback via Dateiendung");
  }, 30000);

  it("returns null for a corrupt PDF instead of throwing", async () => {
    const broken = Buffer.from("%PDF-1.4\nthis is not a real pdf body");
    expect(
      await extractFileText(broken, "application/pdf", "broken.pdf"),
    ).toBeNull();
  }, 30000);

  it("returns null for images and unknown binaries", async () => {
    expect(
      await extractFileText(Buffer.from([0x89, 0x50]), "image/png", "a.png"),
    ).toBeNull();
  });

  it("caps output at 500KB", async () => {
    const big = Buffer.from("x".repeat(MAX_EXTRACT_CHARS + 5000));
    const text = await extractFileText(big, "text/plain", "big.txt");
    expect(text?.length).toBe(MAX_EXTRACT_CHARS);
  });

  it("strips NUL bytes (PostgreSQL text columns reject them)", async () => {
    const withNul = Buffer.concat([
      Buffer.from("ab"),
      Buffer.alloc(1),
      Buffer.from("cd"),
    ]);
    expect(await extractFileText(withNul, "text/plain", "a.txt")).toBe("abcd");
  });

  it("never throws on corrupt input (returns null)", async () => {
    const notAZip = Buffer.from("definitely not a zip");
    expect(await extractFileText(notAZip, DOCX_MIME, "broken.docx")).toBeNull();
  });
});

describe("docxXmlToText", () => {
  it("converts tabs/breaks and decodes entities", () => {
    const text = docxXmlToText(
      "<w:p><w:r><w:t>A</w:t></w:r><w:tab/><w:r><w:t>B &lt; C &#228;</w:t></w:r></w:p>",
    );
    // tabs are normalized to single spaces by the whitespace collapse
    expect(text).toBe("A B < C ä");
  });

  // CodeQL js/incomplete-multi-character-sanitization: the tag strip now runs
  // to a fixpoint (capped at 8 passes) instead of once, so leftovers of an
  // overlapping shape such as `<<a>b>` cannot hand a tag back to the caller.
  it("leaves no tag markup for nested/overlapping angle brackets", () => {
    for (const xml of [
      "<w:t><<a>b>Text</w:t>",
      "<<div>span>Inhalt",
      "<<<x>y>z>Kapitel",
      "<w:t><scr<script>ipt>alert(1)</w:t>",
    ]) {
      expect(docxXmlToText(xml)).not.toMatch(/<[^>]*>/);
    }
    // The readable text survives the strip.
    expect(docxXmlToText("<w:t><<a>b>Text</w:t>")).toBe("b>Text");
    expect(docxXmlToText("<<div>span>Inhalt")).toBe("span>Inhalt");
  });

  // Denial of service on an uploaded DOCX. `word/document.xml` is not
  // length-capped before it reaches the strip (MAX_EXTRACT_CHARS applies to
  // the result), so the old `.replace(/<[^>]+>/g, "")` — which backtracks to
  // the end of the string at every `<` — burned quadratic time on attacker-
  // supplied bytes. Measured on the old code: 80k → 2.9s, 120k → 7.9s,
  // 200k → 26.6s. The linear scan does 120k in under a millisecond.
  //
  // 120k is chosen off that curve: comfortably fatal for the old code, and
  // still inside vitest's 15s file timeout so this fails as a legible
  // assertion rather than a timeout.
  it("strips a 120k-character bracket run in linear time", () => {
    const started = Date.now();
    const out = docxXmlToText("<".repeat(120_000) + "Ende");
    const elapsed = Date.now() - started;
    expect(elapsed).toBeLessThan(1000);
    // Deliberately NOT `expect(out).not.toMatch(/<[^>]*>/)`: that assertion is
    // the very regex under repair, and running it over a 120k-character result
    // costs ~8s of backtracking inside the test itself. Character checks are
    // linear. With no `>` in the input there is no tag to strip, so the run
    // survives intact — which is precisely the old code's worst case.
    expect(out.includes(">")).toBe(false);
    expect(out.endsWith("Ende")).toBe(true);
    expect(out.length).toBe(120_004);
  });

  it("keeps `<>` — [^>]+ requires a character, so it is not a tag", () => {
    // The one semantic difference between this strip and the `[^>]*` one in
    // the tags route. Losing it here would silently eat document text.
    expect(docxXmlToText("<w:t>a<>b</w:t>")).toBe("a<>b");
  });
});
