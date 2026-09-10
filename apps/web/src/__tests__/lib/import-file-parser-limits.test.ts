// #S04-04 + #S04-06 regression contract — audit ARCTOS-FULL-2026-08-31.
//
// S04-04: `parseFile()` called `Workbook.xlsx.load(buffer)`, which builds the
// whole sheet in memory. A 9.3 MB .xlsx declaring a 134 MB sheet produced
// 2.26 GB RSS. Now: ZIP central-directory pre-flight, a streaming reader, and
// hard row/cell ceilings.
//
// S04-06: the import routes only compared the CLIENT-supplied Content-Type
// against an allowlist. `parseFile()` — the single funnel every import path
// goes through — now verifies the real leading bytes.

import { describe, it, expect } from "vitest";
import { deflateRawSync, crc32 } from "node:zlib";
import {
  parseFile,
  ImportTooLargeError,
  UnsupportedUploadError,
} from "@/lib/import-export/file-parser";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Minimal ZIP whose central directory DECLARES the given expansion. */
function buildZip(
  entries: Array<{ name: string; data: Buffer; declaredUncompressed?: number }>,
): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const compressed = deflateRawSync(entry.data);
    const uncompressed = entry.declaredUncompressed ?? entry.data.length;
    const crc = crc32(entry.data) >>> 0;

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(uncompressed, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    nameBuf.copy(local, 30);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(uncompressed, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);

    localParts.push(local, compressed);
    centralParts.push(central);
    offset += local.length + compressed.length;
  }
  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralDir, eocd]);
}

async function realXlsx(rows: string[][]): Promise<Buffer> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("#S04-04 — parseFile refuses decompression bombs", () => {
  it("refuses an .xlsx declaring a 134 MB sheet (the measured PoC shape)", async () => {
    const bomb = buildZip([
      { name: "[Content_Types].xml", data: Buffer.from("<Types/>") },
      {
        name: "xl/worksheets/sheet1.xml",
        data: Buffer.from("<worksheet/>"),
        declaredUncompressed: 134 * 1024 * 1024,
      },
    ]);
    // Small enough that the routes' 10 MB byte cap would have let it through.
    expect(bomb.length).toBeLessThan(10 * 1024 * 1024);

    await expect(
      parseFile(bomb, XLSX_MIME, "bomb.xlsx"),
    ).rejects.toBeInstanceOf(ImportTooLargeError);
  });

  it("refuses a spreadsheet whose archive cannot be inspected", async () => {
    // Truncated / corrupt container: "cannot measure" must mean "do not
    // inflate", never "inflate anyway".
    const broken = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.alloc(256, 0),
    ]);
    await expect(
      parseFile(broken, XLSX_MIME, "broken.xlsx"),
    ).rejects.toBeInstanceOf(ImportTooLargeError);
  });

  it("still parses a genuine spreadsheet through the streaming reader", async () => {
    const buf = await realXlsx([
      ["Title", "Category", "Owner"],
      ["Ausfall Rechenzentrum", "cyber", "IT"],
      ["Lieferantenausfall", "operational", "Einkauf"],
    ]);
    const parsed = await parseFile(buf, XLSX_MIME, "risks.xlsx");
    expect(parsed.headers).toEqual(["Title", "Category", "Owner"]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].Title).toBe("Ausfall Rechenzentrum");
    expect(parsed.rows[1].Owner).toBe("Einkauf");
    expect(parsed.previewRows).toHaveLength(2);
  });

  it("enforces the row ceiling on CSV (default 100 000)", async () => {
    // ~1.2 MB of CSV — cheap to build, and it proves the cap is a real
    // refusal rather than a silent truncation.
    const cap = Number.parseInt(process.env.IMPORT_MAX_ROWS ?? "100000", 10);
    const lines = ["a,b"];
    for (let i = 0; i <= cap; i++) lines.push(`${i},x`);
    const buf = Buffer.from(lines.join("\n"), "utf8");

    await expect(parseFile(buf, "text/csv", "big.csv")).rejects.toBeInstanceOf(
      ImportTooLargeError,
    );
  });
});

describe("#S04-06 — parseFile verifies the real file signature", () => {
  it("refuses a Windows PE renamed to .csv and declared as text/csv", async () => {
    // "MZ" + DOS stub — the classic "malware uploaded as a document".
    const pe = Buffer.concat([
      Buffer.from([0x4d, 0x5a, 0x90, 0x00]),
      Buffer.alloc(512, 0),
    ]);
    await expect(
      parseFile(pe, "text/csv", "invoice.csv"),
    ).rejects.toBeInstanceOf(UnsupportedUploadError);
  });

  it("refuses an ELF binary declared as an .xlsx", async () => {
    const elf = Buffer.concat([
      Buffer.from([0x7f, 0x45, 0x4c, 0x46]),
      Buffer.alloc(512, 0),
    ]);
    await expect(
      parseFile(elf, XLSX_MIME, "report.xlsx"),
    ).rejects.toBeInstanceOf(UnsupportedUploadError);
  });

  it("refuses a PDF declared as a spreadsheet", async () => {
    const pdf = Buffer.concat([
      Buffer.from("%PDF-1.7\n", "utf8"),
      Buffer.alloc(256, 0x20),
    ]);
    await expect(
      parseFile(pdf, XLSX_MIME, "sheet.xlsx"),
    ).rejects.toBeInstanceOf(UnsupportedUploadError);
  });

  it("still accepts plain CSV, which has no magic bytes", async () => {
    const csv = Buffer.from("Title,Category\nAusfall,cyber\n", "utf8");
    const parsed = await parseFile(csv, "text/csv", "risks.csv");
    expect(parsed.headers).toEqual(["Title", "Category"]);
    expect(parsed.rows).toHaveLength(1);
  });
});
