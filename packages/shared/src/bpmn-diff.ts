// Sprint 3b: BPMN Diff Utility
// Compares two BPMN XML documents and produces a structured diff

import { parseBpmnXml, type ParsedProcessStep } from "./bpmn-parser";
import type { BpmnDiff, ElementDiffDetail } from "./types";

// ──────────────────────────────────────────────────────────────
// computeBpmnDiff — High-level diff between two BPMN XML strings
// ──────────────────────────────────────────────────────────────

export function computeBpmnDiff(xmlOld: string, xmlNew: string): BpmnDiff {
  const oldSteps = parseBpmnXml(xmlOld);
  const newSteps = parseBpmnXml(xmlNew);

  const oldMap = new Map<string, ParsedProcessStep>(
    oldSteps.map((s) => [s.bpmnElementId, s]),
  );
  const newMap = new Map<string, ParsedProcessStep>(
    newSteps.map((s) => [s.bpmnElementId, s]),
  );

  const added = [...newMap.keys()].filter((id) => !oldMap.has(id));
  const removed = [...oldMap.keys()].filter((id) => !newMap.has(id));
  const modified = [...newMap.keys()].filter((id) => {
    if (!oldMap.has(id)) return false;
    const o = oldMap.get(id)!;
    const n = newMap.get(id)!;
    return o.name !== n.name || o.stepType !== n.stepType;
  });

  return {
    added,
    removed,
    modified,
    stats: {
      added: added.length,
      removed: removed.length,
      modified: modified.length,
    },
  };
}

// ──────────────────────────────────────────────────────────────
// computeElementDetails — Detailed attribute-level changes
// ──────────────────────────────────────────────────────────────

export function computeElementDetails(
  xmlOld: string,
  xmlNew: string,
  modifiedIds: string[],
): ElementDiffDetail[] {
  const oldSteps = parseBpmnXml(xmlOld);
  const newSteps = parseBpmnXml(xmlNew);

  const oldMap = new Map<string, ParsedProcessStep>(
    oldSteps.map((s) => [s.bpmnElementId, s]),
  );
  const newMap = new Map<string, ParsedProcessStep>(
    newSteps.map((s) => [s.bpmnElementId, s]),
  );

  const details: ElementDiffDetail[] = [];

  for (const id of modifiedIds) {
    const oldEl = oldMap.get(id);
    const newEl = newMap.get(id);
    if (!oldEl || !newEl) continue;

    const changes: ElementDiffDetail["changes"] = [];

    if (oldEl.name !== newEl.name) {
      changes.push({
        attribute: "name",
        oldValue: oldEl.name,
        newValue: newEl.name,
      });
    }

    if (oldEl.stepType !== newEl.stepType) {
      changes.push({
        attribute: "stepType",
        oldValue: oldEl.stepType,
        newValue: newEl.stepType,
      });
    }

    if (oldEl.sequenceOrder !== newEl.sequenceOrder) {
      changes.push({
        attribute: "sequenceOrder",
        oldValue: String(oldEl.sequenceOrder),
        newValue: String(newEl.sequenceOrder),
      });
    }

    if (changes.length > 0) {
      details.push({
        elementId: id,
        elementName: newEl.name,
        elementType: newEl.stepType,
        changes,
      });
    }
  }

  return details;
}
