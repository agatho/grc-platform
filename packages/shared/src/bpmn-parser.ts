// Sprint 3: BPMN XML Parser
// Extracts ProcessStep records from BPMN 2.0 XML for syncing to process_step table
//
// [ARCTOS-FULL-2026-08-31 · OP-037] **Diese Datei parste BPMN selbst.**
//
// Sie war eine von sechs in `packages/shared` (zusammen 1.529 Zeilen), die
// `fast-xml-parser` und Zeichenkettenvergleiche benutzten, während
// `packages/bpmn` dasselbe Format ein zweites Mal liest. Zwei Antworten auf
// dieselbe Frage — und die zweite war messbar falsch:
//
//   parseBpmnXml(<bpmn:definitions …>)     → 3 Schritte
//   parseBpmnXml(<definitions …>)          → 3 Schritte
//   parseBpmnXml(<ns0:definitions …>)      → Fehler „missing <bpmn:definitions>"
//   parseBpmnXml(<semantic:definitions …>) → Fehler „missing <bpmn:definitions>"
//
// Die alte Fassung verglich **Präfixe** (`parsed["bpmn:definitions"] ||
// parsed["definitions"]`) statt Namensräume. `ns0:` schreiben Werkzeuge auf
// JAXB-Basis, `semantic:` schreibt Signavio — beide Dateien sind gültiges
// BPMN 2.0. Im Betrieb hiess das: `POST /api/v1/processes/import-bpmn-xml`
// lehnte sie mit „Invalid BPMN XML" ab, und beim Speichern einer Version
// (`versions/route.ts`) entstand **keine einzige** `process_step`-Zeile — ohne
// Fehlermeldung, weil der Aufrufer den Wurf abfängt.
//
// Gelesen wird jetzt mit `parseXml` aus `@grc/bpmn/util`: derselbe Leser, den
// die Engine für ihren Kanonisierer benutzt, synchron, ohne Abhängigkeit und
// **präfixunabhängig** — entschieden wird über den Namensraum-URI.
//
// Zwei Verhaltensunterschiede, beide beabsichtigt und beide im Protokoll
// (`docs/UMSETZUNG-WELLE-2B.md`) begründet:
//
//  1. **Dokumentreihenfolge statt Gruppierung nach Typ.** `fast-xml-parser`
//     bündelt gleiche Tags; `sequenceOrder` folgte damit der Reihenfolge der
//     Tag-*Namen*, nicht der der Elemente. Ein Diagramm Start → Aufgabe →
//     Ende → Aufgabe bekam die Reihenfolge Start, Aufgabe, Aufgabe, Ende.
//  2. **Präfixe spielen keine Rolle mehr.** Siehe oben.

import { parseXml, XmlParseError, type XmlElement } from "@grc/bpmn/util";
import type { StepType } from "./types";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface ParsedProcessStep {
  bpmnElementId: string;
  name: string | null;
  stepType: StepType;
  sequenceOrder: number;
}

// ──────────────────────────────────────────────────────────────
// BPMN element type to step_type mapping
//
// Lokale Namen, nicht Präfixe: der Namensraum wird getrennt geprüft.
// ──────────────────────────────────────────────────────────────

/** Der Namensraum des BPMN-Metamodells (OMG formal/2011-01-03). */
const BPMN_MODEL_NS = "http://www.omg.org/spec/BPMN/20100524/MODEL";

const BPMN_TASK_TYPES = new Set([
  "task",
  "userTask",
  "serviceTask",
  "sendTask",
  "receiveTask",
  "manualTask",
  "businessRuleTask",
  "scriptTask",
]);

const BPMN_GATEWAY_TYPES = new Set([
  "exclusiveGateway",
  "parallelGateway",
  "inclusiveGateway",
  "eventBasedGateway",
  "complexGateway",
]);

const BPMN_EVENT_TYPES = new Set([
  "startEvent",
  "endEvent",
  "intermediateCatchEvent",
  "intermediateThrowEvent",
  "boundaryEvent",
]);

const BPMN_SUBPROCESS_TYPES = new Set([
  "subProcess",
  "adHocSubProcess",
  "transaction",
]);

const BPMN_CALL_ACTIVITY_TYPES = new Set(["callActivity"]);

function getStepType(localName: string): StepType | null {
  if (BPMN_TASK_TYPES.has(localName)) return "task";
  if (BPMN_GATEWAY_TYPES.has(localName)) return "gateway";
  if (BPMN_EVENT_TYPES.has(localName)) return "event";
  if (BPMN_SUBPROCESS_TYPES.has(localName)) return "subprocess";
  if (BPMN_CALL_ACTIVITY_TYPES.has(localName)) return "call_activity";
  return null;
}

// ──────────────────────────────────────────────────────────────
// Parser
// ──────────────────────────────────────────────────────────────

/**
 * Auflösung Präfix → Namensraum-URI, eine Ebene tiefer fortgeschrieben.
 *
 * Genau das ist der Teil, den die alte Fassung nicht hatte. `xmlns:x="…"`
 * bindet `x`, `xmlns="…"` bindet den leeren Präfix, und beide gelten für den
 * Teilbaum darunter.
 */
type NsScope = ReadonlyMap<string, string>;

function extendScope(element: XmlElement, parent: NsScope): NsScope {
  let scope: Map<string, string> | undefined;
  for (const attribute of element.attributes) {
    if (attribute.qname === "xmlns") {
      scope ??= new Map(parent);
      scope.set("", attribute.value);
    } else if (attribute.prefix === "xmlns") {
      scope ??= new Map(parent);
      scope.set(attribute.local, attribute.value);
    }
  }
  return scope ?? parent;
}

/**
 * Gehört dieses Element zum BPMN-Metamodell?
 *
 * Deklariert das Dokument **gar keinen** Namensraum, wird der lokale Name
 * genommen. Solche Dateien kommen im Bestand vor (der Excel-Import erzeugt
 * sie) und sind kein Grund, sie abzulehnen — aber sie sind auch der einzige
 * Fall, in dem geraten wird.
 */
function isBpmn(element: XmlElement, scope: NsScope): boolean {
  const uri = scope.get(element.prefix);
  if (uri === undefined) return scope.size === 0;
  return uri === BPMN_MODEL_NS;
}

function attribute(element: XmlElement, name: string): string | undefined {
  for (const candidate of element.attributes) {
    // Unpräfigierte Attribute; `bpmn:id` gibt es nicht, und ein präfigiertes
    // `id` wäre ein Fremdattribut.
    if (candidate.prefix === "" && candidate.local === name) {
      return candidate.value;
    }
  }
  return undefined;
}

export function parseBpmnXml(xml: string): ParsedProcessStep[] {
  let root: XmlElement;
  try {
    root = parseXml(xml).root;
  } catch (error) {
    // Die Meldung des Lesers ist genauer als „invalid XML" — sie nennt den
    // Versatz. Der Aufrufer (`validateBpmnXml`) reicht sie weiter.
    throw error instanceof XmlParseError
      ? new Error(`Invalid BPMN XML: ${error.message}`)
      : error;
  }

  const rootScope = extendScope(root, new Map<string, string>());
  if (root.local !== "definitions" || !isBpmn(root, rootScope)) {
    throw new Error(
      "Invalid BPMN XML: missing <bpmn:definitions> root element",
    );
  }

  const processes: XmlElement[] = [];
  for (const child of root.children) {
    if (child.kind !== "element") continue;
    const scope = extendScope(child, rootScope);
    if (child.local === "process" && isBpmn(child, scope)) {
      processes.push(child);
    }
  }
  if (processes.length === 0) {
    throw new Error("Invalid BPMN XML: missing <bpmn:process> element");
  }

  const steps: ParsedProcessStep[] = [];
  for (const process of processes) {
    collectSteps(process, extendScope(process, rootScope), steps);
  }

  // Nummerierung erst am Ende — über alle Pools hinweg fortlaufend, wie bisher.
  steps.forEach((step, index) => {
    step.sequenceOrder = index + 1;
  });
  return steps;
}

/**
 * Die Schritte eines Containers, in **Dokumentreihenfolge**.
 *
 * Ein Subprozess zählt selbst als Schritt und wird danach betreten — dieselbe
 * Ordnung wie bisher, nur ohne die Gruppierung nach Tag-Namen.
 */
function collectSteps(
  container: XmlElement,
  scope: NsScope,
  steps: ParsedProcessStep[],
): void {
  for (const child of container.children) {
    if (child.kind !== "element") continue;
    const childScope = extendScope(child, scope);
    if (!isBpmn(child, childScope)) continue;

    const stepType = getStepType(child.local);
    if (stepType === null) continue;

    const id = attribute(child, "id");
    if (!id) continue;

    steps.push({
      bpmnElementId: id,
      name: attribute(child, "name") ?? null,
      stepType,
      // Wird am Ende von `parseBpmnXml` neu vergeben.
      sequenceOrder: steps.length + 1,
    });

    if (stepType === "subprocess") {
      collectSteps(child, childScope, steps);
    }
  }
}

// ──────────────────────────────────────────────────────────────
// Validator
// ──────────────────────────────────────────────────────────────

export function validateBpmnXml(xml: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  try {
    const steps = parseBpmnXml(xml);

    // Must have at least one start event
    const hasStart = steps.some(
      (s) =>
        s.bpmnElementId.toLowerCase().includes("start") ||
        s.stepType === "event",
    );
    if (!hasStart) {
      errors.push("BPMN XML must contain at least one start event");
    }

    // Must have at least one end event
    const hasEnd = steps.some(
      (s) =>
        s.bpmnElementId.toLowerCase().includes("end") || s.stepType === "event",
    );
    if (!hasEnd) {
      errors.push("BPMN XML must contain at least one end event");
    }

    // Must have at least one task
    const hasTasks = steps.some((s) => s.stepType === "task");
    if (!hasTasks) {
      errors.push("BPMN XML must contain at least one task");
    }

    // Check for diagram layout (BPMNDiagram element)
    if (!xml.includes("BPMNDiagram") && !xml.includes("bpmndi:BPMNDiagram")) {
      errors.push(
        "BPMN XML must contain a BPMNDiagram element with layout coordinates",
      );
    }
  } catch (e) {
    errors.push(`XML parsing failed: ${(e as Error).message}`);
  }

  return { valid: errors.length === 0, errors };
}

// ──────────────────────────────────────────────────────────────
// Empty BPMN XML Template
// ──────────────────────────────────────────────────────────────

export const EMPTY_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Start" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="179" y="159" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
