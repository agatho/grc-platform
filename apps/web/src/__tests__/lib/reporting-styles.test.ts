// Report style variants (org_branding.report_template):
//   standard — unchanged default chrome
//   formal   — cover page + table of contents (→ more pages), document no.
//   minimal  — no logo embed, compact single-line header, tight rows
//
// The logo test uses a programmatically built 1×1 PNG (valid CRCs) so no
// fixture file is needed; pdfkit embeds PNGs as /Subtype /Image XObjects
// whose dictionaries stay readable even in compressed PDFs.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { deflateSync } from "zlib";
import {
  defaultDocumentId,
  resolveReportStyle,
  type ReportBranding,
  type ReportDefinition,
  type ReportStyle,
} from "../../lib/reporting/core";
import { renderReportPdf } from "../../lib/reporting/pdf-renderer";
import { renderReportXlsx } from "../../lib/reporting/excel-renderer";

// ─── Minimal valid PNG (1×1, greyscale) ──────────────────────────

function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i] ?? 0;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function tinyPng(): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0); // width
  ihdr.writeUInt32BE(1, 4); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // colour type: greyscale
  const idat = deflateSync(Buffer.from([0x00, 0x80])); // filter none + 1 pixel
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ─── Fixtures ────────────────────────────────────────────────────

let tmpDir: string;
let logoPath: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "arctos-report-style-"));
  logoPath = join(tmpDir, "logo.png");
  writeFileSync(logoPath, tinyPng());
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function makeDef(
  style: ReportStyle | undefined,
  brandingOverrides: Partial<ReportBranding> = {},
): ReportDefinition {
  return {
    title: "Risikobericht",
    subtitle: "Stil-Testlauf",
    locale: "de",
    branding: {
      orgName: "Meridian Holdings GmbH",
      primaryColor: "#1e3a5f",
      confidentialityNotice: "VERTRAULICH",
      logoFilePath: null,
      ...brandingOverrides,
    },
    generatedAt: new Date("2026-07-11T09:30:05Z"),
    style,
    sections: [
      {
        kind: "kpis",
        items: [
          { label: "Gesamt", value: 12 },
          { label: "Kritisch", value: 2, tone: "crit" },
        ],
      },
      {
        kind: "table",
        title: "Register",
        table: {
          columns: [
            { key: "id", label: "ID", width: 1 },
            { key: "title", label: "Titel", width: 3 },
          ],
          rows: Array.from({ length: 12 }, (_, i) => [
            `RSK${String(i + 1).padStart(8, "0")}`,
            `Risiko ${i + 1}`,
          ]),
        },
      },
    ],
  };
}

const countPages = (buf: Buffer): number =>
  (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

// ─── Pure helpers ────────────────────────────────────────────────

describe("resolveReportStyle", () => {
  it("prefers a valid override over the branding value", () => {
    expect(resolveReportStyle("formal", "minimal")).toBe("minimal");
  });

  it("falls back to the branding value without override", () => {
    expect(resolveReportStyle("formal")).toBe("formal");
    expect(resolveReportStyle("minimal", null)).toBe("minimal");
  });

  it("degrades invalid/missing values to standard", () => {
    expect(resolveReportStyle(undefined)).toBe("standard");
    expect(resolveReportStyle(null, null)).toBe("standard");
    expect(resolveReportStyle("fancy", "bogus")).toBe("standard");
  });

  it("ignores an invalid override but keeps a valid branding value", () => {
    expect(resolveReportStyle("minimal", "bogus")).toBe("minimal");
  });
});

describe("defaultDocumentId", () => {
  it("derives a deterministic UTC document number", () => {
    expect(defaultDocumentId(new Date("2026-07-11T09:30:05Z"))).toBe(
      "RPT-20260711-093005",
    );
  });
});

// ─── PDF per style ───────────────────────────────────────────────

describe("renderReportPdf styles", () => {
  it("renders a valid PDF for every style", async () => {
    for (const style of ["standard", "formal", "minimal"] as const) {
      const buffer = await renderReportPdf(makeDef(style));
      expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
      expect(buffer.subarray(-32).toString("latin1")).toContain("%%EOF");
    }
  });

  it("formal adds cover page + table of contents (page count > standard)", async () => {
    const standard = await renderReportPdf(makeDef("standard"));
    const formal = await renderReportPdf(makeDef("formal"));
    expect(countPages(formal)).toBeGreaterThan(countPages(standard));
    // Cover + TOC precede the content — at least two extra pages.
    expect(countPages(formal)).toBeGreaterThanOrEqual(countPages(standard) + 2);
  });

  it("standard embeds the org logo, minimal does not", async () => {
    const withLogo = { logoFilePath: logoPath };
    const standard = await renderReportPdf(makeDef("standard", withLogo));
    const minimal = await renderReportPdf(makeDef("minimal", withLogo));
    expect(standard.toString("latin1")).toContain("/Subtype /Image");
    expect(minimal.toString("latin1")).not.toContain("/Subtype /Image");
  });

  it("uses the org branding style when the definition has no override", async () => {
    // branding says formal, no def.style → cover + TOC pages appear
    const viaBranding = await renderReportPdf(
      makeDef(undefined, { reportTemplate: "formal" }),
    );
    const standard = await renderReportPdf(makeDef("standard"));
    expect(countPages(viaBranding)).toBeGreaterThanOrEqual(
      countPages(standard) + 2,
    );
  });

  it("definition style overrides the branding style", async () => {
    // branding formal, override minimal → no cover, single page
    const buffer = await renderReportPdf(
      makeDef("minimal", { reportTemplate: "formal", logoFilePath: logoPath }),
    );
    expect(countPages(buffer)).toBe(1);
    expect(buffer.toString("latin1")).not.toContain("/Subtype /Image");
  });
});

// ─── XLSX stays valid for all styles ─────────────────────────────

describe("renderReportXlsx styles", () => {
  it("produces PK workbooks for all styles (formal adds document no.)", async () => {
    for (const style of ["standard", "formal", "minimal"] as const) {
      const buffer = await renderReportXlsx(makeDef(style));
      expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");
    }
  });
});
