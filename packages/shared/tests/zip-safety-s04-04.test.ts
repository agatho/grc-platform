// #S04-04 regression contract — audit ARCTOS-FULL-2026-08-31, Medium.
//
// A valid .xlsx with 1.85 M single-cell rows compresses to 9.3 MB — under the
// import routes' 10 MB cap — and expands to a 134 MB sheet XML that
// `ExcelJS.Workbook.xlsx.load()` turned into 2.26 GB RSS in 17.5 s
// (evidence/S04/xlsx-decompression-bomb.txt). One authenticated request could
// OOM the web container.
//
// A byte limit on the upload cannot see this. `assertZipWithinLimits` reads
// the ZIP central directory — which records each member's UNCOMPRESSED size —
// and refuses the archive before a single byte is inflated.

import { describe, it, expect } from "vitest";
import { deflateRawSync, crc32 } from "node:zlib";
import {
  assertZipWithinLimits,
  inspectZipArchive,
  ZipBombError,
  SPREADSHEET_ZIP_LIMITS,
} from "../src/lib/zip-safety";

// [OP-065] `arr[i]` ist unter `noUncheckedIndexedAccess` `T | undefined`.
// In einem Test ist ein fehlendes Element kein Randfall, den man mit `!`
// wegdrückt, sondern ein Fehlschlag mit Namen — `at` macht ihn dazu.
function at<T>(arr: readonly T[], i: number): T {
  const value = arr[i];
  if (value === undefined) {
    throw new Error(`erwartetes Element ${i} fehlt (Länge ${arr.length})`);
  }
  return value;
}

/**
 * Build a minimal but structurally valid ZIP whose central directory
 * DECLARES the given uncompressed sizes. That is exactly the attacker's
 * position: the archive is small, the declared expansion is not.
 */
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
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(8, 8); // method: deflate
    local.writeUInt16LE(0, 10); // time
    local.writeUInt16LE(0, 12); // date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(uncompressed, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra len
    nameBuf.copy(local, 30);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(8, 10); // method
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(uncompressed, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);

    localParts.push(local, compressed);
    centralParts.push(central);
    offset += local.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

const MB = 1024 * 1024;

describe("#S04-04 — ZIP/XLSX decompression-bomb pre-flight", () => {
  it("accepts a normal small spreadsheet archive", () => {
    const zip = buildZip([
      { name: "[Content_Types].xml", data: Buffer.from("<Types/>") },
      {
        name: "xl/worksheets/sheet1.xml",
        data: Buffer.from(
          "<worksheet>" + "<row/>".repeat(500) + "</worksheet>",
        ),
      },
    ]);
    const info = assertZipWithinLimits(zip);
    expect(info.entries.length).toBe(2);
    expect(info.totalUncompressed).toBeGreaterThan(0);
  });

  it("REPRODUCES the measured bomb: 9.3 MB archive declaring a 134 MB sheet", () => {
    // The audit's proof-of-concept shape, scaled to the same declared sizes.
    const zip = buildZip([
      { name: "[Content_Types].xml", data: Buffer.from("<Types/>") },
      {
        name: "xl/worksheets/sheet1.xml",
        data: Buffer.from("<worksheet/>"),
        declaredUncompressed: 134 * MB,
      },
    ]);
    // The archive itself is tiny — a byte-size upload limit would pass it.
    expect(zip.length).toBeLessThan(10 * MB);
    expect(() => assertZipWithinLimits(zip)).toThrow(ZipBombError);
    expect(() => assertZipWithinLimits(zip)).toThrow(/expands to/i);
  });

  it("refuses a single oversized member", () => {
    const zip = buildZip([
      {
        name: "xl/sharedStrings.xml",
        data: Buffer.from("x"),
        declaredUncompressed:
          SPREADSHEET_ZIP_LIMITS.maxEntryUncompressedBytes + 1,
      },
    ]);
    expect(() => assertZipWithinLimits(zip)).toThrow(
      /member 'xl\/sharedStrings\.xml' expands to/i,
    );
  });

  it("refuses a total expansion over the limit spread across members", () => {
    const half = Math.floor(
      SPREADSHEET_ZIP_LIMITS.maxTotalUncompressedBytes * 0.6,
    );
    const zip = buildZip([
      { name: "a.xml", data: Buffer.from("x"), declaredUncompressed: half },
      { name: "b.xml", data: Buffer.from("x"), declaredUncompressed: half },
    ]);
    expect(() => assertZipWithinLimits(zip)).toThrow(/in total/i);
  });

  it("refuses an implausible compression ratio", () => {
    const zip = buildZip([
      {
        name: "sheet.xml",
        data: Buffer.from("x"),
        // Under the absolute cap but ~ a 1000:1 ratio for a ~200-byte archive.
        declaredUncompressed: 60 * MB,
      },
    ]);
    // Whichever limit fires first, the archive is refused.
    expect(() => assertZipWithinLimits(zip)).toThrow(ZipBombError);
  });

  it("refuses an archive with an implausible number of members", () => {
    const entries = Array.from(
      { length: SPREADSHEET_ZIP_LIMITS.maxEntries + 1 },
      (_, i) => ({ name: `f${i}.xml`, data: Buffer.from("x") }),
    );
    // The 16-bit EOCD entry count saturates above 65535; stay under that.
    expect(entries.length).toBeLessThan(65535);
    const zip = buildZip(entries);
    expect(() => assertZipWithinLimits(zip)).toThrow(/entries/i);
  });

  it("refuses input that is not a readable ZIP at all", () => {
    expect(() => assertZipWithinLimits(Buffer.from("not a zip"))).toThrow(
      ZipBombError,
    );
    expect(() => assertZipWithinLimits(Buffer.alloc(4096, 0x41))).toThrow(
      ZipBombError,
    );
  });

  it("inspectZipArchive reports per-member sizes", () => {
    const zip = buildZip([
      { name: "a.xml", data: Buffer.from("hello world") },
      { name: "b.xml", data: Buffer.from("second entry") },
    ]);
    const info = inspectZipArchive(zip);
    expect(info.entries.map((e) => e.name)).toEqual(["a.xml", "b.xml"]);
    expect(at(info.entries, 0).uncompressedSize).toBe(11);
    expect(info.totalUncompressed).toBe(11 + 12);
  });
  // ────────────────────────────────────────────────────────────────────
  // [Welle 4b, Strang 6 · OP-065] Der Lesevorgang, der über das Dateiende
  // hinauslief.
  //
  // `readUInt32LE`/`readUInt16LE` lasen `buf[off]` ohne Bereichsprüfung.
  // Ausserhalb des Puffers ist das `undefined`, und JavaScript macht daraus
  // im Bit-Ausdruck eine 0 — nicht NaN, nicht eine Ausnahme. Ein
  // ZIP64-Zusatzfeld, das laut `extraLen` zwölf Bytes lang ist, von denen
  // nur vier im Puffer liegen, lieferte deshalb `uncompressedSize = 0` für
  // einen Eintrag, der sich über `0xffffffff` ausdrücklich als ≥ 4 GiB
  // deklariert hatte. Der Wächter meldete „entpackt sich zu nichts".
  //
  // Gemessen am 2026-09-03 gegen 01d0e4cc:
  //   entries=1  uncompressedSize=0  totalUncompressed=0  ratio=0
  // ────────────────────────────────────────────────────────────────────
  it("liest ein ZIP64-Zusatzfeld nicht über das Dateiende hinaus", () => {
    // Aufbau (L = 300 Bytes):
    //   0..21    EOCD, entryCount = 1, cdOffset = 100
    //   100..145 Zentralverzeichnis-Kopf, uncompressedSize = 0xffffffff
    //   146..295 Dateiname (150 Bytes)
    //   296..299 Zusatzfeld-Kopf (headerId 0x0001, dataSize 8)
    //   deklariertes extraLen = 12 → exEnd = 308, der Puffer endet bei 300
    const L = 300;
    const buf = Buffer.alloc(L);
    buf.writeUInt32LE(0x06054b50, 0); // EOCD
    buf.writeUInt16LE(1, 8);
    buf.writeUInt16LE(1, 10);
    buf.writeUInt32LE(200, 12);
    buf.writeUInt32LE(100, 16); // cdOffset
    buf.writeUInt16LE(0, 20);

    buf.writeUInt32LE(0x02014b50, 100); // Zentralverzeichnis-Kopf
    buf.writeUInt32LE(4096, 100 + 20); // compressedSize
    buf.writeUInt32LE(0xffffffff, 100 + 24); // uncompressedSize → ZIP64
    buf.writeUInt16LE(150, 100 + 28); // nameLen
    buf.writeUInt16LE(12, 100 + 30); // extraLen — reicht über das Ende
    buf.writeUInt16LE(0, 100 + 32); // commentLen
    buf.fill(0x41, 146, 296); // Name

    buf.writeUInt16LE(0x0001, 296); // ZIP64-Zusatzfeld-Kopf
    buf.writeUInt16LE(8, 298);

    // Die Behebung refüsiert, statt eine erfundene Null zu melden.
    expect(() => inspectZipArchive(buf)).toThrow(ZipBombError);
    expect(() => inspectZipArchive(buf)).toThrow(/past the end of the file/i);
    expect(() => assertZipWithinLimits(buf)).toThrow(ZipBombError);
  });

  it("meldet für ein abgeschnittenes Archiv keine Grösse von 0", () => {
    // Die eigentliche Aussage des Befunds, unabhängig von der Fehlermeldung:
    // ein Archiv, das sich nicht vollständig vermessen lässt, darf NIEMALS
    // mit `totalUncompressed === 0` durchgereicht werden.
    const L = 300;
    const buf = Buffer.alloc(L);
    buf.writeUInt32LE(0x06054b50, 0);
    buf.writeUInt16LE(1, 8);
    buf.writeUInt16LE(1, 10);
    buf.writeUInt32LE(200, 12);
    buf.writeUInt32LE(100, 16);
    buf.writeUInt32LE(0x02014b50, 100);
    buf.writeUInt32LE(4096, 100 + 20);
    buf.writeUInt32LE(0xffffffff, 100 + 24);
    buf.writeUInt16LE(150, 100 + 28);
    buf.writeUInt16LE(12, 100 + 30);
    buf.fill(0x41, 146, 296);
    buf.writeUInt16LE(0x0001, 296);
    buf.writeUInt16LE(8, 298);

    let gemessen: number | null = null;
    try {
      gemessen = inspectZipArchive(buf).totalUncompressed;
    } catch {
      gemessen = null; // abgelehnt — das ist die richtige Antwort
    }
    expect(gemessen).not.toBe(0);
  });
});
