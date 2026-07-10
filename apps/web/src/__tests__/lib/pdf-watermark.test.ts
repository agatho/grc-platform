// Controlled-copy PDF watermarking (pdf-lib).

import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  stampControlledCopy,
  buildControlledCopyFooter,
} from "../../lib/documents/pdf-watermark";

async function makeTestPdf(pages = 2): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    doc.addPage([595, 842]); // A4
  }
  return Buffer.from(await doc.save());
}

const info = {
  title: "Informationssicherheitsrichtlinie",
  versionLabel: "2.1",
  releasedAt: new Date(Date.UTC(2026, 2, 15)),
  retrievedBy: "Max Mustermann",
  retrievedAt: new Date(Date.UTC(2026, 6, 10)),
};

describe("buildControlledCopyFooter", () => {
  it("assembles the ISO controlled-copy footer line", () => {
    expect(buildControlledCopyFooter(info)).toBe(
      "Informationssicherheitsrichtlinie · v2.1 · freigegeben 15.03.2026 · " +
        "Abgerufen von Max Mustermann am 10.07.2026 · " +
        "Unkontrollierte Kopie nach Ausdruck",
    );
  });

  it("omits missing version/release parts", () => {
    const footer = buildControlledCopyFooter({
      ...info,
      versionLabel: null,
      releasedAt: null,
    });
    expect(footer).not.toContain("v2.1");
    expect(footer).not.toContain("freigegeben");
    expect(footer).toContain("Unkontrollierte Kopie nach Ausdruck");
  });
});

describe("stampControlledCopy", () => {
  it("stamps every page and grows the PDF", async () => {
    const original = await makeTestPdf(3);
    const stamped = await stampControlledCopy(original, info);

    expect(stamped.length).toBeGreaterThan(original.length);

    // Still a valid PDF with the same page count
    const reloaded = await PDFDocument.load(new Uint8Array(stamped));
    expect(reloaded.getPageCount()).toBe(3);
  });

  it("handles non-Latin-1 characters without throwing", async () => {
    const original = await makeTestPdf(1);
    const stamped = await stampControlledCopy(original, {
      ...info,
      retrievedBy: "Дмитрий 日本語",
      title: "Richtlinie ÄÖÜß",
    });
    expect(stamped.length).toBeGreaterThan(0);
  });

  it("throws on non-PDF input (caller falls back to original bytes)", async () => {
    await expect(
      stampControlledCopy(Buffer.from("not a pdf"), info),
    ).rejects.toThrow();
  });
});
