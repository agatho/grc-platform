// [ARCTOS-FULL-2026-08-31 · Welle 5c · OP-114] Der ungeschützteste
// Einlesepfad des Produkts.
//
// `#S04-04` hat gemessen, dass eine gültige .xlsx mit 1,85 Mio.
// Einzelzell-Zeilen auf 9,3 MB komprimiert — unter der 10-MB-Grenze der
// Upload-Route — und dass `ExcelJS.Workbook.xlsx.load()` daraus 2,26 GB RSS
// in 17,5 s machte. Der CSV/XLSX-Importpfad
// (`apps/web/src/lib/import-export/file-parser.ts`) hat daraufhin DREI
// Schichten bekommen: ZIP-Vorprüfung, strömendes Lesen, harte Obergrenzen.
//
// `packages/shared/src/lib/excel-to-bpmn.ts` hatte nur die erste. Welle 5b
// hat das nachgemessen und festgehalten, dass der Registertext OP-114
// („Zweite und dritte Schicht fangen es ab") für diesen Aufrufer nicht galt.
// Und Schicht 1 allein genügt nicht: sie lässt jedes Archiv durch, das unter
// 100 MB entpackt — eine Tabelle mit 300.000 Zeilen liegt weit darunter.
//
// Diese Suite hält die zwei fehlenden Schichten fest. Gegen den Stand vor
// dieser Welle fällt sie: die Zeilen- und Zellgrenzen gab es nicht (die
// Konvertierung lief durch und lieferte ein Ergebnis), und `xlsx.load()`
// stand noch in der Quelle.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { convertExcelToBPMN } from "../src/lib/excel-to-bpmn";

const SOURCE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/lib/excel-to-bpmn.ts",
);

const COLUMNS = [
  "Step Number",
  "Activity Name",
  "Responsible Role",
  "Activity Type",
  "Decision Options",
  "Next Step",
  "Documents",
  "Applications",
];

/** Baut eine echte .xlsx mit `rowCount` Datenzeilen. */
async function buildWorkbook(
  rowCount: number,
  extraColumns = 0,
): Promise<ArrayBuffer> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Prozess");
  const header = [...COLUMNS];
  for (let c = 0; c < extraColumns; c++) header.push(`Extra ${c + 1}`);
  sheet.addRow(header);

  for (let i = 1; i <= rowCount; i++) {
    const row: (string | number)[] = [
      i,
      `Schritt ${i}`,
      i % 2 === 0 ? "Fachbereich" : "Revision",
      "task",
      "",
      i < rowCount ? String(i + 1) : "",
      "",
      "",
    ];
    for (let c = 0; c < extraColumns; c++) row.push("x");
    sheet.addRow(row);
  }

  const buffer = await wb.xlsx.writeBuffer();
  // `writeBuffer()` liefert je nach exceljs-Fassung Buffer oder ArrayBuffer.
  return buffer instanceof ArrayBuffer
    ? buffer
    : new Uint8Array(buffer as unknown as Uint8Array).slice().buffer;
}

describe("excel-to-bpmn: Schicht 2 — strömendes Lesen (OP-114)", () => {
  it("liest die Arbeitsmappe nicht mehr mit xlsx.load() ein", () => {
    const src = readFileSync(SOURCE, "utf8");
    // Ohne die Kommentare: die Datei ERKLÄRT `wb.xlsx.load()` im Kopf, und
    // ein Test, der die eigene Begründung für einen Rückfall hält, ist
    // wertlos. Geprüft wird der Code.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*)/.test(line))
      .join("\n");
    // Der Aufruf, den #S04-04 mit 2,26 GB RSS gemessen hat. Er darf in
    // dieser Datei nicht mehr vorkommen — auch nicht als Rückfallpfad.
    expect(
      /\.xlsx\.load\s*\(/.test(code),
      "excel-to-bpmn.ts ruft wieder Workbook.xlsx.load() — der nicht " +
        "strömende Weg, der das ganze Blatt materialisiert",
    ).toBe(false);
    expect(
      code.includes("stream.xlsx.WorkbookReader"),
      "excel-to-bpmn.ts liest nicht mehr über den strömenden WorkbookReader",
    ).toBe(true);
  });

  it("wandelt eine gewöhnliche Tabelle unverändert um", async () => {
    const result = await convertExcelToBPMN(await buildWorkbook(4));

    expect(result.errors).toEqual([]);
    expect(result.activityCount).toBe(4);
    expect(result.laneCount).toBe(2);
    expect(result.bpmnXml).toContain('<bpmn:task id="Activity_1"');
    expect(result.bpmnXml).toContain('<bpmn:task id="Activity_4"');
    expect(result.bpmnXml).toContain("Fachbereich");
    expect(result.bpmnXml).toContain("Revision");
    // Start -> 1, 1->2, 2->3, 3->4, 4->Ende
    expect(result.bpmnXml.match(/<bpmn:sequenceFlow /g)?.length).toBe(5);
  });

  it("meldet eine leere Tabelle weiterhin als solche", async () => {
    const result = await convertExcelToBPMN(await buildWorkbook(0));
    expect(result.errors).toEqual(["Empty spreadsheet"]);
  });
});

describe("excel-to-bpmn: Schicht 3 — harte Obergrenzen (OP-114)", () => {
  it("bricht ab, sobald mehr Zeilen kommen als erlaubt", async () => {
    const buffer = await buildWorkbook(12);

    // Unter der Grenze: unverändertes Verhalten.
    const ok = await convertExcelToBPMN(buffer, { maxRows: 12 });
    expect(ok.errors).toEqual([]);
    expect(ok.activityCount).toBe(12);

    // Darüber: Abbruch mit einer Fehlermeldung statt einer Umwandlung.
    // Gegen den alten Stand liefert derselbe Aufruf ein fertiges BPMN —
    // das zweite Argument gab es nicht, und eine Zeilengrenze auch nicht.
    const tooMany = await convertExcelToBPMN(buffer, { maxRows: 5 });
    expect(tooMany.bpmnXml).toBe("");
    expect(tooMany.errors).toEqual([
      "Spreadsheet exceeds the import limit of 5 rows.",
    ]);
  });

  it("bricht ab, sobald mehr Zellen kommen als erlaubt", async () => {
    // Wenige Zeilen, viele Spalten — der zweite Weg, an einer reinen
    // Zeilengrenze vorbei viel Speicher zu belegen.
    const buffer = await buildWorkbook(6, 40);

    const tooWide = await convertExcelToBPMN(buffer, {
      maxRows: 1000,
      maxCells: 60,
    });
    expect(tooWide.bpmnXml).toBe("");
    expect(tooWide.errors).toEqual([
      "Spreadsheet exceeds the import limit of 60 cells.",
    ]);
  });

  it("hält eine Vorgabegrenze, die kleiner ist als die ZIP-Vorprüfung", async () => {
    // Die Vorgabe ist bewusst um Grössenordnungen strenger als Schicht 1:
    // 100 MB entpackt (SPREADSHEET_ZIP_LIMITS) sind rund 1,4 Mio. Zeilen
    // dieser Form, und die kämen alle durch Schicht 1.
    const src = readFileSync(SOURCE, "utf8");
    const match = /const MAX_BPMN_IMPORT_ROWS = ([0-9_]+);/.exec(src);
    expect(match, "MAX_BPMN_IMPORT_ROWS fehlt").not.toBeNull();
    const value = Number((match?.[1] ?? "").replace(/_/g, ""));
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThanOrEqual(100_000);
  });
});
