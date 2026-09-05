// Sprint 56: Excel-to-BPMN Converter
// Parses an Excel file (via ExcelJS) and generates valid BPMN 2.0 XML

import type { ExcelImportResult } from "../schemas/bpm-derived";
// #S04-04: decompression-bomb pre-flight, shared with the CSV/XLSX import
// pipeline (apps/web/src/lib/import-export/file-parser.ts).
import { assertZipWithinLimits } from "./zip-safety";

interface ExcelRow {
  stepNumber: number;
  activityName: string;
  responsibleRole: string;
  activityType: "task" | "decision" | "event";
  decisionOptions: string;
  nextStep: string;
  documents: string;
  applications: string;
}

const REQUIRED_COLUMNS = [
  "Step Number",
  "Activity Name",
  "Responsible Role",
  "Activity Type",
  "Next Step",
];

// [OP-114 · Welle 5c] Obergrenzen dieses Einlesepfads.
//
// Der Import erzeugt aus jeder Zeile einen BPMN-Knoten. Ein Prozessmodell
// mit 10.000 Aktivitäten ist keine Fachlichkeit mehr, sondern ein
// Speicherangriff: die erzeugte XML-Zeichenkette allein läge bei rund
// einer Million Zeichen, bevor sie als Prozessversion in die Datenbank
// geht. Die Zellgrenze fängt den zweiten Weg ab — wenige Zeilen mit
// zehntausenden Spalten.
//
// Bewusst als Konstanten und nicht als Umgebungsvariablen: eine neue
// `process.env`-Lesung müsste in `.env.example` nachgezogen werden
// (scripts/check-env-example.mjs), und ein Grenzwert, den der Betreiber
// hochdrehen kann, ist bei einer Schutzschranke die falsche Voreinstellung.
// Aufrufer, die eine andere Grenze brauchen, übergeben sie als Argument.
const MAX_BPMN_IMPORT_ROWS = 10_000;
const CELLS_PER_ROW_ALLOWANCE = 32;

/**
 * Convert an Excel buffer to BPMN 2.0 XML.
 *
 * Expected columns: Step Number, Activity Name, Responsible Role,
 * Activity Type (task/decision/event), Decision Options (comma-separated),
 * Next Step (number or decision-dependent), Documents, Applications
 *
 * @param limits Obergrenzen für diesen Aufruf. Ohne Angabe gelten
 *   {@link MAX_BPMN_IMPORT_ROWS} Zeilen und das 32-fache davon an Zellen.
 */
export async function convertExcelToBPMN(
  buffer: ArrayBuffer,
  limits: { maxRows?: number; maxCells?: number } = {},
): Promise<ExcelImportResult> {
  const maxRows = limits.maxRows ?? MAX_BPMN_IMPORT_ROWS;
  const maxCells = limits.maxCells ?? maxRows * CELLS_PER_ROW_ALLOWANCE;

  // #S04-04 (ARCTOS-FULL-2026-08-31) Schicht 1: das ZIP-Zentralverzeichnis
  // nennt die entpackte Grösse jedes Eintrags. Ein Archiv, das die
  // Tabellengrenzen sprengen würde, wird abgelehnt, bevor ein einziges Byte
  // entpackt wird. Wirft ZipBombError, was die aufrufende Route als 4xx
  // ausgibt.
  //
  // [OP-114 · Welle 5c] Schicht 1 war hier bis zu dieser Welle die EINZIGE
  // Schicht — anders als im CSV/XLSX-Importpfad
  // (apps/web/src/lib/import-export/file-parser.ts), der drei hat. Und
  // Schicht 1 allein genügt nicht: sie glaubt dem Zentralverzeichnis, und
  // sie lässt jede Datei durch, die unter 100 MB entpackt. Eine Tabelle mit
  // 300.000 Zeilen liegt weit darunter und hätte `wb.xlsx.load()` trotzdem
  // den ganzen Objektgraphen bauen lassen. Deshalb stehen jetzt auch hier
  // die beiden anderen Schichten.
  assertZipWithinLimits(new Uint8Array(buffer));

  // Dynamic import of exceljs to keep bundling optional
  const ExcelJS = await import("exceljs");
  // `node:stream` ebenfalls dynamisch: dieses Modul wird über
  // `packages/shared/src/index.ts` re-exportiert und ist damit aus
  // Client-Komponenten erreichbar. Gemessen am 2026-09-05 baut Next 16.2.11
  // (Turbopack) auch einen statischen `node:`-Import an dieser Stelle ohne
  // Fehler — die Warnung in index.ts stammt aus der Webpack-Zeit. Der
  // dynamische Aufruf hält den STATISCHEN Modulgraphen trotzdem frei von
  // Node-Built-ins, kostet nichts (die Funktion ist ohnehin async und lädt
  // exceljs schon so) und gilt damit auch, falls jemand wieder mit
  // `--webpack` baut.
  const { Readable } = await import("node:stream");

  // #S04-04 Schicht 2: strömendes Lesen. `Workbook.xlsx.load(buffer)` baut
  // das gesamte Blatt als Objektgraph auf, bevor die erste Zeile sichtbar
  // ist; `WorkbookReader` liefert Zeile für Zeile, sodass die Grenzen
  // unten mittendrin abbrechen können.
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(
    Readable.from(Buffer.from(buffer)),
    {
      entries: "emit",
      sharedStrings: "cache",
      hyperlinks: "ignore",
      styles: "ignore",
      worksheets: "emit",
    },
  );

  const rawData: Record<string, string>[] = [];
  const headers: string[] = [];
  let sawSheet = false;
  let cellCount = 0;
  let limitExceeded: string | null = null;

  sheets: for await (const worksheet of reader) {
    sawSheet = true;
    for await (const row of worksheet) {
      if (row.number === 1) {
        row.eachCell((cell, colNumber) => {
          headers[colNumber] = String(cell.value ?? "").trim();
        });
        continue;
      }

      // #S04-04 Schicht 3: harte Obergrenzen, geprüft BEVOR die Zeile
      // behalten wird. Auch eine Datei, die an Schicht 1 vorbeikommt, kann
      // das Ergebnis damit nicht unbegrenzt wachsen lassen.
      if (rawData.length >= maxRows) {
        limitExceeded = `Spreadsheet exceeds the import limit of ${maxRows} rows.`;
        break sheets;
      }

      const record: Record<string, string> = {};
      row.eachCell((cell, colNumber) => {
        cellCount++;
        const header = headers[colNumber];
        if (header) {
          record[header] = String(cell.value ?? "").trim();
        }
      });

      if (cellCount > maxCells) {
        limitExceeded = `Spreadsheet exceeds the import limit of ${maxCells} cells.`;
        break sheets;
      }

      // Only include rows that have at least one non-empty value
      if (Object.values(record).some((v) => v !== "")) {
        rawData.push(record);
      }
    }
    // Nur das erste Arbeitsblatt wird importiert — dasselbe Verhalten wie
    // das frühere `wb.worksheets[0]`. Der Abbruch hier hält den Leser
    // ausserdem davon ab, die übrigen Blätter einer mehrblättrigen Bombe
    // überhaupt zu lesen.
    break;
  }

  const warnings: string[] = [];
  const errors: string[] = [];

  if (limitExceeded) {
    return {
      bpmnXml: "",
      activityCount: 0,
      laneCount: 0,
      warnings,
      errors: [limitExceeded],
    };
  }

  if (!sawSheet) {
    return {
      bpmnXml: "",
      activityCount: 0,
      laneCount: 0,
      warnings,
      errors: ["No worksheet found in file"],
    };
  }

  // Validate columns
  if (rawData.length === 0) {
    return {
      bpmnXml: "",
      activityCount: 0,
      laneCount: 0,
      warnings,
      errors: ["Empty spreadsheet"],
    };
  }

  // [OP-065] `rawData.length === 0` ist direkt darüber abgefangen; `?? {}`
  // schreibt das auf, ohne einen erreichbaren Zweig hinzuzufügen.
  const columns = Object.keys(rawData[0] ?? {});
  for (const required of REQUIRED_COLUMNS) {
    if (!columns.includes(required)) {
      errors.push(`Missing required column: ${required}`);
    }
  }

  if (errors.length > 0) {
    return { bpmnXml: "", activityCount: 0, laneCount: 0, warnings, errors };
  }

  // Parse rows
  const rows: ExcelRow[] = [];
  // [OP-065] Über die Werte statt über den Index: `raw` war als
  // `Record<string, unknown>` deklariert und konnte `undefined` sein, womit
  // `raw["Step Number"]` geworfen hätte. `entries()` liefert Zeilennummer und
  // Zeile gemeinsam und kennt kein `undefined`.
  for (const [i, raw] of rawData.entries()) {
    const stepNumber = parseInt(String(raw["Step Number"] ?? ""), 10);
    if (isNaN(stepNumber)) {
      warnings.push(`Row ${i + 2}: Invalid step number, skipping`);
      continue;
    }

    const activityName = String(raw["Activity Name"] ?? "").trim();
    if (!activityName) {
      warnings.push(`Row ${i + 2}: Missing activity name, skipping`);
      continue;
    }

    const responsibleRole = String(raw["Responsible Role"] ?? "Default").trim();
    const activityType = normalizeActivityType(
      String(raw["Activity Type"] ?? "task"),
    );
    const nextStep = String(raw["Next Step"] ?? "").trim();

    if (!nextStep && i < rawData.length - 1) {
      warnings.push(`Row ${i + 2}: Missing 'Next Step' reference`);
    }

    rows.push({
      stepNumber,
      activityName,
      responsibleRole,
      activityType,
      decisionOptions: String(raw["Decision Options"] ?? ""),
      nextStep,
      documents: String(raw["Documents"] ?? ""),
      applications: String(raw["Applications"] ?? ""),
    });
  }

  if (rows.length === 0) {
    return {
      bpmnXml: "",
      activityCount: 0,
      laneCount: 0,
      warnings,
      errors: ["No valid rows found"],
    };
  }

  // Extract unique lanes
  const uniqueRoles = [...new Set(rows.map((r) => r.responsibleRole))];

  // Generate BPMN XML
  const bpmnXml = generateBPMNXml(rows, uniqueRoles);

  return {
    bpmnXml,
    activityCount: rows.filter((r) => r.activityType === "task").length,
    laneCount: uniqueRoles.length,
    warnings,
    errors,
  };
}

function normalizeActivityType(value: string): "task" | "decision" | "event" {
  const v = value.toLowerCase().trim();
  if (v === "decision" || v === "gateway") return "decision";
  if (v === "event" || v === "start" || v === "end") return "event";
  return "task";
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateBPMNXml(rows: ExcelRow[], lanes: string[]): string {
  const processId = "Process_1";
  const collaborationId = "Collaboration_1";
  const participantId = "Participant_1";

  // Build node IDs
  const nodeIds = new Map<number, string>();
  const startEventId = "StartEvent_1";
  const endEventId = "EndEvent_1";

  for (const row of rows) {
    const prefix = row.activityType === "decision" ? "Gateway" : "Activity";
    nodeIds.set(row.stepNumber, `${prefix}_${row.stepNumber}`);
  }

  // Build lane -> flow node refs mapping
  const laneFlowRefs = new Map<string, string[]>();
  for (const lane of lanes) {
    laneFlowRefs.set(lane, []);
  }
  for (const row of rows) {
    const refs = laneFlowRefs.get(row.responsibleRole) ?? [];
    refs.push(nodeIds.get(row.stepNumber)!);
    laneFlowRefs.set(row.responsibleRole, refs);
  }

  // Generate lane XML
  const laneXml = lanes
    .map((lane, idx) => {
      const refs = laneFlowRefs.get(lane) ?? [];
      const flowNodeRefXml = refs
        .map((r) => `          <bpmn:flowNodeRef>${r}</bpmn:flowNodeRef>`)
        .join("\n");
      return `        <bpmn:lane id="Lane_${idx + 1}" name="${escapeXml(lane)}">\n${flowNodeRefXml}\n        </bpmn:lane>`;
    })
    .join("\n");

  // Generate task/gateway elements
  const elementXml = rows
    .map((row) => {
      const id = nodeIds.get(row.stepNumber)!;
      if (row.activityType === "decision") {
        return `      <bpmn:exclusiveGateway id="${id}" name="${escapeXml(row.activityName)}" />`;
      }
      return `      <bpmn:task id="${id}" name="${escapeXml(row.activityName)}" />`;
    })
    .join("\n");

  // Generate sequence flows
  const flowLines: string[] = [];
  let flowIdx = 1;

  // Start event -> first step
  // [OP-065] Vorher: `nodeIds.get(rows[0].stepNumber)!`. Zwei Annahmen in
  // einer Zeile — dass es eine erste Zeile gibt und dass ihre Nummer in der
  // Karte steht. Beide stimmen, aber `!` hätte im Fehlerfall das Wort
  // „undefined" in das erzeugte BPMN-XML geschrieben statt den Fluss
  // wegzulassen. Jetzt wird die erste Zeile entnommen und der Fluss nur
  // erzeugt, wenn es ein Ziel dafür gibt.
  const firstRow = rows[0];
  const firstNodeId =
    firstRow === undefined ? undefined : nodeIds.get(firstRow.stepNumber);
  if (firstNodeId !== undefined) {
    flowLines.push(
      `      <bpmn:sequenceFlow id="Flow_${flowIdx++}" sourceRef="${startEventId}" targetRef="${firstNodeId}" />`,
    );
  }

  // Step -> Next Step flows
  for (const row of rows) {
    const sourceId = nodeIds.get(row.stepNumber)!;
    const nextSteps = row.nextStep
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (nextSteps.length === 0 && row.activityType !== "decision") {
      // Last step -> end event
      flowLines.push(
        `      <bpmn:sequenceFlow id="Flow_${flowIdx++}" sourceRef="${sourceId}" targetRef="${endEventId}" />`,
      );
      continue;
    }

    const options = row.decisionOptions.split(",").map((o) => o.trim());

    for (const [i, nextStep] of nextSteps.entries()) {
      const targetNum = parseInt(nextStep, 10);
      const targetId = nodeIds.get(targetNum);
      if (targetId) {
        const label = options[i] ?? "";
        const nameAttr = label ? ` name="${escapeXml(label)}"` : "";
        flowLines.push(
          `      <bpmn:sequenceFlow id="Flow_${flowIdx++}" sourceRef="${sourceId}" targetRef="${targetId}"${nameAttr} />`,
        );
      }
    }
  }

  const flowXml = flowLines.join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:collaboration id="${collaborationId}">
    <bpmn:participant id="${participantId}" processRef="${processId}" />
  </bpmn:collaboration>
  <bpmn:process id="${processId}" isExecutable="false">
    <bpmn:laneSet id="LaneSet_1">
${laneXml}
    </bpmn:laneSet>
    <bpmn:startEvent id="${startEventId}" name="Start" />
    <bpmn:endEvent id="${endEventId}" name="End" />
${elementXml}
${flowXml}
  </bpmn:process>
</bpmn:definitions>`;
}

/**
 * Generate Excel template content for process import.
 * Returns column headers that the import wizard expects.
 */
export function getExcelTemplateColumns(): string[] {
  return [
    "Step Number",
    "Activity Name",
    "Responsible Role",
    "Activity Type",
    "Decision Options",
    "Next Step",
    "Documents",
    "Applications",
  ];
}
