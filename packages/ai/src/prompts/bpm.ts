// BPM Overhaul Phase 7: AI Prompt builders for the BPM module.
//
// All prompts emit strict JSON so the route handler can parse without
// reasoning about prose. We provide both a JSON-shape spec and a tiny
// example to nudge consistent output from any provider.

export function buildTextToBpmnPrompt(description: string, locale: "de" | "en" = "de") {
  const userInstruction =
    locale === "de"
      ? `Erzeuge ein BPMN 2.0 XML-Diagramm für die folgende Prozessbeschreibung:`
      : `Generate a BPMN 2.0 XML diagram for the following process description:`;

  return [
    {
      role: "system" as const,
      content: `You are a BPMN 2.0 modeling assistant. You emit valid BPMN 2.0 XML embedded inside a single JSON object.
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
`,
    },
    {
      role: "user" as const,
      content: `${userInstruction}\n\n${description}`,
    },
  ];
}

export function buildRiskSuggestionPrompt(args: {
  processName: string;
  processDescription: string | null;
  activityNames: string[];
  existingRiskTitles: string[];
  locale?: "de" | "en";
}) {
  const { processName, processDescription, activityNames, existingRiskTitles } = args;
  const locale = args.locale ?? "de";
  return [
    {
      role: "system" as const,
      content: `You are a GRC risk-identification assistant. For a given business process, suggest 3–8 plausible operational, compliance, security, or financial risks.
Output ONLY a JSON object of this shape:
{
  "risks": [
    { "title": "...", "category": "operational|strategic|financial|compliance|security|reputational", "description": "...", "rationale": "why this risk applies" }
  ]
}
Avoid suggesting risks whose title duplicates one of the existing risks.
Language: ${locale === "de" ? "Antworte auf Deutsch." : "Reply in English."}`,
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        processName,
        processDescription,
        activities: activityNames,
        existingRiskTitles,
      }),
    },
  ];
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
  return [
    {
      role: "system" as const,
      content: `You are a GRC control-design assistant. For a given process and its known risks, suggest 3–8 controls that would mitigate them.
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
    },
    {
      role: "user" as const,
      content: JSON.stringify(args),
    },
  ];
}

export function buildFrameworkMappingPrompt(args: {
  processName: string;
  processDescription: string | null;
  activityNames: string[];
  candidateFrameworks: string[];
  locale?: "de" | "en";
}) {
  const locale = args.locale ?? "de";
  return [
    {
      role: "system" as const,
      content: `You are a compliance mapping assistant. Given a process and a list of candidate frameworks, identify which framework controls/articles apply.
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
    },
    {
      role: "user" as const,
      content: JSON.stringify(args),
    },
  ];
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
