// Controlled-copy PDF watermarking (pdf-lib).
//
// ── #S06-17 (ARCTOS-FULL-2026-08-31, Low) ───────────────────────────
// The previous suite asserted byte length and page count only:
//
//   expect(stamped.length).toBeGreaterThan(original.length);
//   expect(reloaded.getPageCount()).toBe(3);
//
// A regression that emptied the text, drew it off the page, truncated
// it to twenty characters, or stamped page 1 only would have passed all
// of it — the byte length grows either way. The tests below EXTRACT the
// text back out of the produced PDF (pdfjs-dist, the same engine the
// DMS already uses for full-text indexing) and assert the marker on
// every page.
//
// They also cover the case the old suite deliberately did not: a valid
// but ENCRYPTED PDF (S06-06). The old "throws on non-PDF input" test
// used Buffer.from("not a pdf") — a structurally broken document, not
// the input the bypass actually used.

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import {
  stampControlledCopy,
  buildControlledCopyFooter,
  checkPdfStampable,
  pdfDeclaresEncryption,
  WatermarkError,
  CONTROLLED_COPY_MARKER,
  MAX_WATERMARK_BYTES,
} from "../../lib/documents/pdf-watermark";

/** The audit PoC: owner-password-only PDF (opens without a prompt). */
const POC_FIXTURE = new URL(
  "../fixtures/owner-password-only.pdf",
  import.meta.url,
).pathname;
const POC_EVIDENCE = "/work/audit/evidence/S06/poc_owner_pw_only.pdf";
const POC_PATH = existsSync(POC_FIXTURE) ? POC_FIXTURE : POC_EVIDENCE;

async function makeTestPdf(pages = 2): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    doc.addPage([595, 842]); // A4
  }
  return Buffer.from(await doc.save());
}

/** Text content per page, read back out of a produced PDF. */
async function extractPageTexts(pdf: Buffer): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: new Uint8Array(pdf.buffer, pdf.byteOffset, pdf.byteLength),
    useWorkerFetch: false,
    disableFontFace: true,
    verbosity: 0,
  });
  const doc = await task.promise;
  try {
    const out: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      out.push(
        content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join("")
          .replace(/\s+/g, " ")
          .trim(),
      );
      page.cleanup();
    }
    return out;
  } finally {
    await doc.destroy();
  }
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
    expect(footer).toContain(CONTROLLED_COPY_MARKER);
  });

  // #S06-07: a copy of a superseded revision must say so.
  it.each([
    ["archived", "ARCHIVIERTE FASSUNG"],
    ["expired", "ABGELAUFENE FASSUNG"],
    ["draft", "ENTWURF"],
  ])("marks %s revisions in the footer", (status, expected) => {
    const footer = buildControlledCopyFooter({
      ...info,
      documentStatus: status,
    });
    expect(footer).toContain(expected);
    expect(footer).toContain(CONTROLLED_COPY_MARKER);
  });
});

describe("stampControlledCopy", () => {
  // #S06-17 — the assertion the old suite was missing.
  it("writes the footer TEXT onto every page", async () => {
    const original = await makeTestPdf(3);
    const stamped = await stampControlledCopy(original, info);

    expect(stamped.length).toBeGreaterThan(original.length);
    const reloaded = await PDFDocument.load(new Uint8Array(stamped));
    expect(reloaded.getPageCount()).toBe(3);

    const texts = await extractPageTexts(stamped);
    expect(texts).toHaveLength(3);
    for (const [i, text] of texts.entries()) {
      expect(text, `page ${i + 1}`).toContain(CONTROLLED_COPY_MARKER);
      expect(text, `page ${i + 1}`).toContain("Informationssicherheits");
      expect(text, `page ${i + 1}`).toContain("v2.1");
      expect(text, `page ${i + 1}`).toContain("Max Mustermann");
    }
  });

  it("keeps the marker intact even when the title is very long", async () => {
    // The old truncation loop chopped from the RIGHT and could eat the
    // marker completely while both old assertions still held.
    const original = await makeTestPdf(1);
    const stamped = await stampControlledCopy(original, {
      ...info,
      title: "Richtlinie ".repeat(40).trim(),
    });
    const [text] = await extractPageTexts(stamped);
    expect(text).toContain(CONTROLLED_COPY_MARKER);
  });

  it("draws the footer inside the printable area", async () => {
    // y: 10 sat inside the usual 0.5 cm non-printable margin, so a
    // printed copy could lose the marking entirely.
    const original = await makeTestPdf(1);
    const stamped = await stampControlledCopy(original, info);
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(stamped),
      useWorkerFetch: false,
      disableFontFace: true,
      verbosity: 0,
    }).promise;
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    const ys = content.items
      .filter((i) => "transform" in i)
      .map((i) => (i as { transform: number[] }).transform[5]);
    expect(ys.length).toBeGreaterThan(0);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(14);
    await doc.destroy();
  });

  it("handles non-Latin-1 characters without throwing", async () => {
    const original = await makeTestPdf(1);
    const stamped = await stampControlledCopy(original, {
      ...info,
      retrievedBy: "Дмитрий 日本語",
      title: "Richtlinie ÄÖÜß",
    });
    expect(stamped.length).toBeGreaterThan(0);
    const [text] = await extractPageTexts(stamped);
    expect(text).toContain(CONTROLLED_COPY_MARKER);
  });
});

// ── #S06-06 — the input that switched the control off ───────────────
describe("stampControlledCopy failure classification (S06-06)", () => {
  it("reports 'encrypted' for the owner-password-only PoC", async () => {
    const poc = readFileSync(POC_PATH);
    // It really is the permission-protection case, not a broken file.
    expect(pdfDeclaresEncryption(new Uint8Array(poc))).toBe(true);

    await expect(stampControlledCopy(poc, info)).rejects.toBeInstanceOf(
      WatermarkError,
    );
    await expect(stampControlledCopy(poc, info)).rejects.toMatchObject({
      reason: "encrypted",
    });
  });

  it("reports 'unloadable' for a structurally broken document", async () => {
    await expect(
      stampControlledCopy(Buffer.from("not a pdf"), info),
    ).rejects.toMatchObject({ reason: "unloadable" });
  });

  it("reports 'too_large' before parsing (S06-18)", async () => {
    const huge = Buffer.alloc(MAX_WATERMARK_BYTES + 1, 0x20);
    await expect(stampControlledCopy(huge, info)).rejects.toMatchObject({
      reason: "too_large",
    });
  });
});

describe("checkPdfStampable — the upload-time gate (S06-06)", () => {
  it("accepts an ordinary PDF", async () => {
    const ok = await checkPdfStampable(await makeTestPdf(1));
    expect(ok.ok).toBe(true);
  });

  it("rejects the encrypted PoC with a reason the route can report", async () => {
    const result = await checkPdfStampable(readFileSync(POC_PATH));
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("encrypted");
  });
});
