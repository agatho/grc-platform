// AI-Assist: DMS prompt builders — policy drafting from framework requirements.
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-06] Nonce-begrenzter Datenumschlag
// statt festem `<grc_data>`-Tag; siehe prompts/erm.ts. Der `orgContext`
// kommt hier direkt aus dem Request-Body — der Pfad, auf dem ein
// Angreifer den Text am freiesten bestimmt.

import { buildDataPrompt, safeText } from "../prompt-safety";

export interface PolicyDraftRequirement {
  /** Framework entry code, e.g. "A.5.1" or "Art. 32" */
  code: string;
  title: string;
  description: string | null;
  /** Human-readable framework name, e.g. "ISO 27001:2022 Annex A" */
  framework: string;
}

export interface PolicyDraftPromptArgs {
  documentCategory: "policy" | "procedure" | "guideline";
  language: "de" | "en";
  orgContext?: string | null;
  requirements: PolicyDraftRequirement[];
}

/**
 * Build the prompt for POST /api/v1/ai/draft-policy.
 *
 * The model must return ONE JSON object:
 * { title, content (markdown), coveredRequirements: string[] }
 */
export function buildPolicyDraftPrompt(args: PolicyDraftPromptArgs) {
  const language = args.language ?? "de";

  const chapterSpec =
    language === "de"
      ? `1. "Zweck" — warum dieses Dokument existiert
2. "Geltungsbereich" — für wen und was es gilt
3. "Rollen und Verantwortlichkeiten" — wer was verantwortet
4. "Vorgaben" — EIN Unterkapitel pro Anforderung, jeweils mit der Referenz (Code + Framework) im Titel
5. "Kontrolle und Messung" — wie die Einhaltung geprüft und gemessen wird`
      : `1. "Purpose" — why this document exists
2. "Scope" — who and what it applies to
3. "Roles and Responsibilities" — who owns what
4. "Requirements" — ONE subsection per requirement, each referencing the code + framework in its heading
5. "Monitoring and Measurement" — how compliance is verified and measured`;

  return buildDataPrompt({
    system: `You are a GRC document author drafting a ${args.documentCategory} for an organization.
Output ONLY a JSON object of this exact shape — no prose, no markdown fences:
{
  "title": "document title",
  "content": "full document text as Markdown",
  "coveredRequirements": ["requirement code 1", "requirement code 2"]
}
Rules:
- "content" is Markdown with these chapters (as ## headings):
${chapterSpec}
- Cover every requirement listed in the input and list its code in "coveredRequirements".
- Be specific and actionable, not generic boilerplate.
- Language: ${language === "de" ? "Schreibe das gesamte Dokument auf Deutsch." : "Write the entire document in English."}`,
    instruction: `Draft the ${args.documentCategory} from the requirements and organization context in the data envelope.`,
    data: {
      requirements: args.requirements.slice(0, 20).map((r) => ({
        code: safeText(r.code, 50),
        title: safeText(r.title, 300),
        description: safeText(r.description, 1500),
        framework: safeText(r.framework, 200),
      })),
      organizationContext: safeText(args.orgContext, 2000),
    },
    maxCharsPerField: 2000,
  });
}
