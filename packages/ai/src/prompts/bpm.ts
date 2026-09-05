// BPM Overhaul Phase 7: AI Prompt builders for the BPM module.
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-06]
// Vier der fünf Builder in dieser Datei interpolierten die Nutzdaten
// direkt (`content: JSON.stringify(args)`), der fünfte
// (`buildTextToBpmnPrompt`) nutzte ein FESTES `<process_description>`-Tag,
// aus dem sich mit dem passenden schließenden Tag heraustreten ließ. Alle
// fünf laufen jetzt über `buildDataPrompt()` — nonce-begrenzter,
// JSON-kodierter Datenumschlag.

import { buildDataPrompt, safeText, safeTextList } from "../prompt-safety";

export function buildTextToBpmnPrompt(
  description: string,
  locale: "de" | "en" = "de",
) {
  return buildDataPrompt({
    system: `You are a BPMN 2.0 modeling assistant. You emit valid BPMN 2.0 XML embedded inside a single JSON object.
Output ONLY a JSON object of this exact shape — no prose, no markdown fences:
{
  "bpmnXml": "<bpmn:definitions ...>...</bpmn:definitions>",
  "summary": "one short sentence describing the modeled process",
  "activities": [{ "name": "...", "type": "task|gateway|event", "description": "..." }]
}
Rules:
- Use the namespace prefix "bpmn" for http://www.omg.org/spec/BPMN/20100524/MODEL
- Include exactly one startEvent and one endEvent
- Connect each activity with sequenceFlow elements
- Give every shape an "id" attribute
- Keep the XML minimal — no DI/diagram elements required
- Language for names/summary: ${locale === "de" ? "Deutsch." : "English."}`,
    instruction:
      locale === "de"
        ? "Erzeuge ein BPMN-2.0-XML-Diagramm für die Prozessbeschreibung im Datenumschlag."
        : "Generate a BPMN 2.0 XML diagram for the process description in the data envelope.",
    data: { processDescription: safeText(description, 8000) },
    maxCharsPerField: 8000,
  });
}

export function buildRiskSuggestionPrompt(args: {
  processName: string;
  processDescription: string | null;
  activityNames: string[];
  existingRiskTitles: string[];
  locale?: "de" | "en";
}) {
  const locale = args.locale ?? "de";
  return buildDataPrompt({
    system: `You are a GRC risk-identification assistant. For a given business process, suggest 3-8 plausible operational, compliance, security, or financial risks.
Output ONLY a JSON object of this shape:
{
  "risks": [
    { "title": "...", "category": "operational|strategic|financial|compliance|security|reputational", "description": "...", "rationale": "why this risk applies" }
  ]
}
Avoid suggesting risks whose title duplicates one of the existing risks.
Language: ${locale === "de" ? "Antworte auf Deutsch." : "Reply in English."}`,
    instruction:
      "Suggest risks for the business process described in the data envelope.",
    data: {
      processName: safeText(args.processName, 300),
      processDescription: safeText(args.processDescription, 4000),
      activities: safeTextList(args.activityNames, 200, 300),
      existingRiskTitles: safeTextList(args.existingRiskTitles, 200, 300),
    },
    maxCharsPerField: 4000,
  });
}

export function buildControlSuggestionPrompt(args: {
  processName: string;
  processDescription: string | null;
  activityNames: string[];
  linkedRiskTitles: string[];
  existingControlTitles: string[];
  locale?: "de" | "en";
}) {
  const locale = args.locale ?? "de";
  return buildDataPrompt({
    system: `You are a GRC control-design assistant. For a given process and its known risks, suggest 3-8 controls that would mitigate them.
Output ONLY a JSON object of this shape:
{
  "controls": [
    {
      "title": "...",
      "controlType": "preventive|detective|corrective|directive",
      "automationLevel": "manual|partially_automated|automated",
      "description": "...",
      "addressesRisks": ["risk title 1", "risk title 2"]
    }
  ]
}
Avoid duplicating existing controls.
Language: ${locale === "de" ? "Antworte auf Deutsch." : "Reply in English."}`,
    instruction:
      "Suggest controls for the process and risks described in the data envelope.",
    data: {
      processName: safeText(args.processName, 300),
      processDescription: safeText(args.processDescription, 4000),
      activities: safeTextList(args.activityNames, 200, 300),
      linkedRiskTitles: safeTextList(args.linkedRiskTitles, 200, 300),
      existingControlTitles: safeTextList(args.existingControlTitles, 200, 300),
    },
    maxCharsPerField: 4000,
  });
}

export function buildFrameworkMappingPrompt(args: {
  processName: string;
  processDescription: string | null;
  activityNames: string[];
  candidateFrameworks: string[];
  locale?: "de" | "en";
}) {
  const locale = args.locale ?? "de";
  return buildDataPrompt({
    system: `You are a compliance mapping assistant. Given a process and a list of candidate frameworks, identify which framework controls/articles apply.
Output ONLY a JSON object of this shape:
{
  "mappings": [
    {
      "frameworkCode": "iso-27001|iso-9001|nis2|dora|gdpr|iso-22301|coso|cobit|...",
      "entryCode": "A.5.1, Art. 30, etc.",
      "title": "human title",
      "mappingStrength": "covers|partial|references",
      "rationale": "why this control applies"
    }
  ]
}
Suggest at most 12 mappings. Prefer 'covers' only if the process directly satisfies the requirement.
Language: ${locale === "de" ? "Antworte auf Deutsch." : "Reply in English."}`,
    instruction:
      "Map the process in the data envelope to the listed candidate frameworks.",
    data: {
      processName: safeText(args.processName, 300),
      processDescription: safeText(args.processDescription, 4000),
      activities: safeTextList(args.activityNames, 200, 300),
      candidateFrameworks: safeTextList(args.candidateFrameworks, 40, 80),
    },
    maxCharsPerField: 4000,
  });
}

export function buildDiagramOptimizationPrompt(args: {
  processName: string;
  bpmnXml: string;
  activityCount: number;
  gatewayCount: number;
  locale?: "de" | "en";
}) {
  const locale = args.locale ?? "de";
  return buildDataPrompt({
    system: `You are a BPMN modeling reviewer. You spot simplification opportunities such as
- consecutive XOR gateways that could collapse into a single gateway with more conditions
- parallel-then-merge patterns that wrap a single activity (no parallelism benefit)
- activity chains longer than 7 without a checkpoint event
- swimlane crossings that suggest splitting into subprocesses
- missing end events / orphan tasks
Output ONLY a JSON object of this exact shape:
{
  "hints": [
    {
      "severity": "info|warning|error",
      "kind": "string short label",
      "bpmnElementId": "optional id of the offending element",
      "message": "what to change",
      "rationale": "why"
    }
  ]
}
"bpmnElementId" MUST be an id that literally occurs in the supplied XML excerpt. Omit the field rather than inventing an id.
Language: ${locale === "de" ? "Antworte auf Deutsch." : "Reply in English."}`,
    instruction:
      "Review the BPMN model in the data envelope and report simplification hints.",
    data: {
      processName: safeText(args.processName, 300),
      activityCount: args.activityCount,
      gatewayCount: args.gatewayCount,
      bpmnXmlExcerpt: safeText(args.bpmnXml, 6000),
    },
    maxCharsPerField: 6000,
  });
}

export function safeJsonParse<T = unknown>(text: string): T | null {
  // Providers occasionally wrap in markdown fences despite instructions.
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    // Best-effort: find the first {...} block
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
