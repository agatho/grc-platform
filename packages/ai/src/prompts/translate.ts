/**
 * Sprint 21: AI Translation Prompts for GRC Content
 *
 * Uses GRC-specific terminology to ensure accurate translations.
 * Supports batch field translation for efficiency.
 */

const LANGUAGE_LABELS: Record<string, string> = {
  de: "Deutsch",
  en: "English",
  fr: "Francais",
  nl: "Nederlands",
  it: "Italiano",
  es: "Espanol",
  pl: "Polski",
  cs: "Cestina",
};

const GRC_TERMINOLOGY_CONTEXT = `You are translating content for a Governance, Risk, and Compliance (GRC) platform.
Use standard GRC/compliance terminology in the target language:
- Risiko = Risk
- Kontrolle = Control
- Feststellung = Finding
- Massnahme = Measure/Treatment
- Pruefung = Audit/Test
- Prozess = Process
- Vorfall = Incident
- Schwachstelle = Vulnerability
- Bedrohung = Threat
- Richtlinie = Policy
- Dokument = Document
- Lieferkette = Supply Chain
- Datenschutz = Data Protection
- Informationssicherheit = Information Security

Maintain the original meaning precisely. Do not add explanations or commentary.
Keep any markdown formatting intact. Only return the translated text.`;

/**
 * Build a translation prompt for a single field.
 */
export function buildTranslatePrompt(
  content: string,
  sourceLang: string,
  targetLang: string,
): string {
  const sourceLabel = LANGUAGE_LABELS[sourceLang] ?? sourceLang;
  const targetLabel = LANGUAGE_LABELS[targetLang] ?? targetLang;

  return `${GRC_TERMINOLOGY_CONTEXT}

Translate the following text from ${sourceLabel} (${sourceLang}) to ${targetLabel} (${targetLang}):

${content}`;
}

/**
 * Build a batch translation prompt for multiple fields of an entity.
 * Returns JSON with field names as keys and translated text as values.
 */
export function buildBatchTranslatePrompt(
  fields: Record<string, string>,
  sourceLang: string,
  targetLang: string,
): string {
  const sourceLabel = LANGUAGE_LABELS[sourceLang] ?? sourceLang;
  const targetLabel = LANGUAGE_LABELS[targetLang] ?? targetLang;

  const fieldsJson = JSON.stringify(fields, null, 2);

  return `${GRC_TERMINOLOGY_CONTEXT}

Translate ALL of the following fields from ${sourceLabel} (${sourceLang}) to ${targetLabel} (${targetLang}).
Return ONLY valid JSON with the same keys and the translated values. No explanations.

Input:
${fieldsJson}`;
}

/**
 * Parse the AI response for a batch translation.
 * Attempts to extract JSON from the response text.
 */
export function parseBatchTranslateResponse(
  response: string,
  expectedFields: string[],
): Record<string, string> {
  // Try to parse directly
  try {
    const parsed = JSON.parse(response);
    if (typeof parsed === "object" && parsed !== null) {
      const result: Record<string, string> = {};
      for (const field of expectedFields) {
        if (typeof parsed[field] === "string") {
          result[field] = parsed[field];
        }
      }
      return result;
    }
  } catch {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1].trim());
        if (typeof parsed === "object" && parsed !== null) {
          const result: Record<string, string> = {};
          for (const field of expectedFields) {
            if (typeof parsed[field] === "string") {
              result[field] = parsed[field];
            }
          }
          return result;
        }
      } catch {
        // Fall through
      }
    }
  }

  // If single field expected, return the whole response as the value
  if (expectedFields.length === 1) {
    return { [expectedFields[0]]: response.trim() };
  }

  throw new Error("Failed to parse AI translation response as JSON");
}
