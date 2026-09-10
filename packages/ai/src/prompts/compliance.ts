// AI-Assist: Compliance prompt builders — SoA gap explanation.
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-06] Nonce-begrenzter Datenumschlag
// statt festem `<grc_data>`-Tag; siehe prompts/erm.ts.

import { buildDataPrompt, safeText } from "../prompt-safety";

export interface GapExplanationPromptArgs {
  requirement: {
    code: string;
    title: string;
    description: string | null;
    framework: string;
  };
  soaStatus: {
    applicability: string;
    implementation: string;
    applicabilityJustification: string | null;
    implementationNotes: string | null;
  } | null;
  linkedControl: {
    title: string;
    description: string | null;
    status: string;
  } | null;
  locale?: "de" | "en";
}

/**
 * Build the prompt for POST /api/v1/ai/explain-gap.
 *
 * The model must return ONE JSON object:
 * { "explanation": "...", "suggestedSteps": ["..."], "suggestedEvidence": ["..."] }
 */
export function buildGapExplanationPrompt(args: GapExplanationPromptArgs) {
  const locale = args.locale ?? "de";

  return buildDataPrompt({
    system: `You are an ISO 27001 / compliance auditor explaining an implementation gap in a Statement of Applicability.
Output ONLY a JSON object of this exact shape — no prose, no markdown fences:
{
  "explanation": "what the requirement concretely demands and why the current status is a gap",
  "suggestedSteps": ["concrete implementation step 1", "..."],
  "suggestedEvidence": ["evidence artifact an auditor would expect 1", "..."]
}
Rules:
- "suggestedSteps": 3 to 6 concrete, actionable implementation steps in recommended order.
- "suggestedEvidence": 3 to 6 concrete evidence artifacts (documents, records, logs, reports).
- Ground everything in the requirement text and the current SoA status from the input.
- Language: ${locale === "de" ? "Antworte auf Deutsch." : "Reply in English."}`,
    instruction:
      "Explain the compliance gap for the requirement in the data envelope.",
    data: {
      requirement: {
        code: safeText(args.requirement.code, 50),
        title: safeText(args.requirement.title, 500),
        description: safeText(args.requirement.description, 1800),
        framework: safeText(args.requirement.framework, 200),
      },
      currentSoaStatus: args.soaStatus
        ? {
            applicability: safeText(args.soaStatus.applicability, 50),
            implementation: safeText(args.soaStatus.implementation, 50),
            applicabilityJustification: safeText(
              args.soaStatus.applicabilityJustification,
              2000,
            ),
            implementationNotes: safeText(
              args.soaStatus.implementationNotes,
              2000,
            ),
          }
        : null,
      linkedControl: args.linkedControl
        ? {
            title: safeText(args.linkedControl.title, 300),
            description: safeText(args.linkedControl.description, 800),
            status: safeText(args.linkedControl.status, 50),
          }
        : null,
    },
    maxCharsPerField: 2000,
  });
}
