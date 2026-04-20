// Sprint 56: Excel-to-BPMN Converter
// Parses an Excel file (via ExcelJS) and generates valid BPMN 2.0 XML

import type { ExcelImportResult } from "../schemas/bpm-derived";

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

/**
 * Convert an Excel buffer to BPMN 2.0 XML.
 *
 * Expected columns: Step Number, Activity Name, Responsible Role,
 * Activity Type (task/decision/event), Decision Options (comma-separated),
 * Next Step (number or decision-dependent), Documents, Applications
 */
export async function convertExcelToBPMN(
  buffer: ArrayBuffer,
): Promise<ExcelImportResult> {
  // Dynamic import of exceljs to keep bundling optional
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // Recent @types/node narrows Buffer into a generic (`Buffer<ArrayBuffer>`)
  // while the published exceljs d.ts still uses the legacy non-generic
  // `Buffer`. Runtime behaviour is identical; any-cast bridges the types
  // without pulling an incompatible exceljs version.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(Buffer.from(buffer) as any);
  const sheet = wb.worksheets[0];

  if (!sheet) {
    return {
      bpmnXml: "",
      activityCount: 0,
      laneCount: 0,
      warnings: [],
      errors: ["No worksheet found in file"],
    };
  }

  // Convert worksheet rows to array of key-value objects (matching sheet_to_json behavior)
  const rawData: Record<string, string>[] = [];
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim();
  });

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header row
    const record: Record<string, string> = {};
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber];
      if (header) {
        record[header] = String(cell.value ?? "").trim();
      }
    });
    // Only include rows that have at least one non-empty value
    if (Object.values(record).some((v) => v !== "")) {
      rawData.push(record);
    }
  });
  const warnings: string[] = [];
  const errors: string[] = [];

  // Validate columns
  if (rawData.length === 0) {
    return { bpmnXml: "", activityCount: 0, laneCount: 0, warnings, errors: ["Empty spreadsheet"] };
  }

  const columns = Object.keys(rawData[0]);
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
  for (let i = 0; i < rawData.length; i++) {
    const raw = rawData[i];
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
    const activityType = normalizeActivityType(String(raw["Activity Type"] ?? "task"));
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
    return { bpmnXml: "", activityCount: 0, laneCount: 0, warnings, errors: ["No valid rows found"] };
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
      const flowNodeRefXml = refs.map((r) => `          <bpmn:flowNodeRef>${r}</bpmn:flowNodeRef>`).join("\n");
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
  if (rows.length > 0) {
    const firstNodeId = nodeIds.get(rows[0].stepNumber)!;
    flowLines.push(
      `      <bpmn:sequenceFlow id="Flow_${flowIdx++}" sourceRef="${startEventId}" targetRef="${firstNodeId}" />`,
    );
  }

  // Step -> Next Step flows
  for (const row of rows) {
    const sourceId = nodeIds.get(row.stepNumber)!;
    const nextSteps = row.nextStep.split(",").map((s) => s.trim()).filter(Boolean);

    if (nextSteps.length === 0 && row.activityType !== "decision") {
      // Last step -> end event
      flowLines.push(
        `      <bpmn:sequenceFlow id="Flow_${flowIdx++}" sourceRef="${sourceId}" targetRef="${endEventId}" />`,
      );
      continue;
    }

    const options = row.decisionOptions.split(",").map((o) => o.trim());

    for (let i = 0; i < nextSteps.length; i++) {
      const targetNum = parseInt(nextSteps[i], 10);
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
