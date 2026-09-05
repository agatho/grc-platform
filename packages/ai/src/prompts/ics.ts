// [ARCTOS-FULL-2026-08-31 / WP6 · S05-06, S05-09]
//
// Prompt-Builder für die vier AI-Routen, die ihren Prompt bisher INLINE
// per String-Interpolation zusammensetzten:
//
//   POST /api/v1/ai/control-suggestions   (route.ts:83-92)
//   POST /api/v1/ai/test-plan
//   POST /api/v1/ai/rcm-gap-analysis
//   POST /api/v1/ai/root-cause-patterns
//
// `ai/control-suggestions` war der schwerste Fall: dieselbe Fachfunktion
// wie das gehärtete `ai/suggest-controls`, aber mit
// `Risk: "${riskRow.title}"` direkt im Fliesstext und ohne jede
// Ausgabevalidierung. Ein `risk_manager` konnte über die Risiko-
// beschreibung die Empfehlung steuern, die dem Kontrollverantwortlichen
// als Entscheidungsgrundlage angezeigt wird.
//
// Die Builder liegen bewusst hier und nicht in der Route: ein Prompt, der
// in einer Route entsteht, entzieht sich der zentralen Härtung — genau so
// sind die vier Ausreisser entstanden.

import { buildDataPrompt, safeText } from "../prompt-safety";

export function buildIcsControlSuggestionPrompt(args: {
  riskTitle: string;
  riskDescription: string | null;
  riskCategory: string;
  riskSource: string;
  inherentScore: number | null;
  existingControls: Array<{
    title: string;
    controlType: string;
    frequency: string;
  }>;
  locale?: "de" | "en";
}) {
  const locale = args.locale ?? "de";
  return buildDataPrompt({
    system: `You are a GRC and internal-controls expert. Suggest 3-5 internal controls for the risk in the data envelope.
Output ONLY a JSON object of this exact shape — no prose, no markdown fences:
{
  "suggestions": [
    {
      "title": "...",
      "controlType": "preventive|detective|corrective",
      "frequency": "daily|weekly|monthly|quarterly|annually|event_driven",
      "frameworkRef": "...",
      "rationale": "..."
    }
  ]
}
Never recommend "no control required" — that decision belongs to the risk owner, not to you.
Language: ${locale === "de" ? "Antworte auf Deutsch." : "Reply in English."}`,
    instruction: "Suggest internal controls for the risk in the data envelope.",
    data: {
      risk: {
        title: safeText(args.riskTitle, 500),
        description: safeText(args.riskDescription, 2000),
        category: safeText(args.riskCategory, 100),
        source: safeText(args.riskSource, 100),
        inherentScore: args.inherentScore,
      },
      existingControls: (args.existingControls ?? []).slice(0, 50).map((c) => ({
        title: safeText(c.title, 300),
        controlType: safeText(c.controlType, 50),
        frequency: safeText(c.frequency, 50),
      })),
    },
    maxCharsPerField: 2000,
  });
}

export function buildTestPlanPrompt(args: {
  control: {
    title: string;
    description: string | null;
    controlType: string;
    frequency: string;
    automationLevel: string;
    objective: string | null;
    testInstructions: string | null;
    assertions: string[] | null;
  };
  recentTests: Array<{
    testDate: unknown;
    todResult: string | null;
    toeResult: string | null;
    conclusion: string | null;
  }>;
  recentFindings: Array<{
    title: string;
    severity: string;
    status: string;
  }>;
  locale?: "de" | "en";
}) {
  const locale = args.locale ?? "de";
  return buildDataPrompt({
    system: `You are a GRC auditor. Generate a structured test plan for the internal control in the data envelope.
Output ONLY a JSON object of this exact shape — no prose, no markdown fences:
{
  "objective": "...",
  "scope": "...",
  "approach": "...",
  "sampleSize": "...",
  "steps": [{ "step": 1, "action": "...", "expectedEvidence": "..." }],
  "focusAreas": ["..."],
  "riskBasedConsiderations": "...",
  "estimatedDuration": "..."
}
Language: ${locale === "de" ? "Antworte auf Deutsch." : "Reply in English."}`,
    instruction:
      "Generate the test plan for the control described in the data envelope.",
    data: {
      control: {
        title: safeText(args.control.title, 500),
        description: safeText(args.control.description, 2000),
        controlType: safeText(args.control.controlType, 50),
        frequency: safeText(args.control.frequency, 50),
        automationLevel: safeText(args.control.automationLevel, 50),
        objective: safeText(args.control.objective, 2000),
        testInstructions: safeText(args.control.testInstructions, 2000),
        assertions: (args.control.assertions ?? [])
          .slice(0, 50)
          .map((a) => safeText(a, 200)),
      },
      recentTests: (args.recentTests ?? []).slice(0, 5).map((t) => ({
        testDate:
          t.testDate instanceof Date ? t.testDate.toISOString() : t.testDate,
        todResult: safeText(t.todResult, 50),
        toeResult: safeText(t.toeResult, 50),
        conclusion: safeText(t.conclusion, 500),
      })),
      recentFindings: (args.recentFindings ?? []).slice(0, 5).map((f) => ({
        title: safeText(f.title, 300),
        severity: safeText(f.severity, 50),
        status: safeText(f.status, 50),
      })),
    },
    maxCharsPerField: 2000,
  });
}

export function buildRcmGapPrompt(args: {
  scope: string;
  risks: Array<{
    id: string;
    title: string;
    category: string;
    inherentScore: number | null;
    controls: Array<{ title: string; type: string; frequency: string }>;
  }>;
  locale?: "de" | "en";
}) {
  const locale = args.locale ?? "de";
  return buildDataPrompt({
    system: `You are a GRC expert performing a Risk-Control Matrix (RCM) gap analysis on the data in the envelope. Identify:
1. Risks with NO controls (unmitigated)
2. Risks with only one control type (e.g. only detective, missing preventive)
3. Controls that appear orphaned (linked but risk is low-priority)
4. High-risk items with insufficient control frequency
Output ONLY a JSON object of this exact shape — no prose, no markdown fences:
{
  "gaps": [
    {
      "riskId": "uuid from the envelope",
      "riskTitle": "...",
      "gapType": "unmitigated|type_gap|frequency_gap|orphaned",
      "severity": "high|medium|low",
      "recommendation": "..."
    }
  ]
}
"riskId" MUST be one of the ids present in the envelope. Never invent ids.
Language: ${locale === "de" ? "Antworte auf Deutsch." : "Reply in English."}`,
    instruction:
      "Perform the RCM gap analysis on the risk/control data in the envelope.",
    data: {
      scope: safeText(args.scope, 50),
      risks: (args.risks ?? []).slice(0, 50).map((r) => ({
        id: r.id,
        title: safeText(r.title, 500),
        category: safeText(r.category, 100),
        inherentScore: r.inherentScore,
        controls: (r.controls ?? []).slice(0, 30).map((c) => ({
          title: safeText(c.title, 300),
          type: safeText(c.type, 50),
          frequency: safeText(c.frequency, 50),
        })),
      })),
    },
    maxCharsPerField: 1000,
  });
}

export function buildRootCausePatternPrompt(args: {
  months: number;
  findings: Array<{
    title: string;
    description: string | null;
    severity: string;
    source: string;
  }>;
  locale?: "de" | "en";
}) {
  const locale = args.locale ?? "de";
  return buildDataPrompt({
    system: `You are a GRC expert specialising in root-cause analysis. Analyse the findings in the data envelope and identify at most 5 systemic patterns.
Output ONLY a JSON object of this exact shape — no prose, no markdown fences:
{
  "patterns": [
    {
      "pattern": "...",
      "frequency": 3,
      "affectedFindingCount": 3,
      "severity": "high|medium|low",
      "systemicRecommendation": "..."
    }
  ]
}
Language: ${locale === "de" ? "Antworte auf Deutsch." : "Reply in English."}`,
    instruction:
      "Identify root-cause patterns across the findings in the data envelope.",
    data: {
      periodMonths: args.months,
      findings: (args.findings ?? []).slice(0, 200).map((f) => ({
        title: safeText(f.title, 300),
        description: safeText(f.description, 200),
        severity: safeText(f.severity, 50),
        source: safeText(f.source, 50),
      })),
    },
    maxCharsPerField: 300,
  });
}
