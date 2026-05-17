// DPMS Overhaul: AI prompt builders for ROPA + DPIA drafting.

export function buildRopaFieldDraftPrompt(args: {
  ropaTitle: string;
  processingDescription: string | null;
  hint?: string | null;
  locale?: "de" | "en";
}) {
  const locale = args.locale ?? "de";
  return [
    {
      role: "system" as const,
      content: `You are a GDPR Art. 30 compliance assistant. Draft missing ROPA fields based on the brief.
Output ONLY a JSON object of this exact shape:
{
  "purpose": "...",
  "legalBasis": "consent|contract|legal_obligation|vital_interest|public_interest|legitimate_interest",
  "legalBasisDetail": "...",
  "dataSubjectCategories": ["..."],
  "personalDataCategories": ["..."],
  "specialCategories": [],
  "recipients": ["..."],
  "thirdCountryTransfers": false,
  "retentionPeriodDescription": "...",
  "retentionPeriodMonths": 60,
  "tomDescription": "..."
}
Language: ${locale === "de" ? "Antworte auf Deutsch." : "Reply in English."}`,
    },
    {
      role: "user" as const,
      content: JSON.stringify(args),
    },
  ];
}

export function buildDpiaMeasureDraftPrompt(args: {
  dpiaTitle: string;
  processingDescription: string | null;
  identifiedRisks: Array<{ title: string; description?: string | null; inherentRiskScore?: number | null }>;
  locale?: "de" | "en";
}) {
  const locale = args.locale ?? "de";
  return [
    {
      role: "system" as const,
      content: `You are a privacy-by-design measures drafter (GDPR Art. 25 / Art. 35(7)(d)). For each identified risk, propose technical or organizational mitigation measures.
Output ONLY a JSON object of this exact shape:
{
  "measures": [
    {
      "title": "short label",
      "description": "what + how",
      "measureType": "technical|organizational",
      "addressesRiskTitle": "exact risk title from input",
      "expectedResidualReductionPct": 50
    }
  ]
}
Language: ${locale === "de" ? "Antworte auf Deutsch." : "Reply in English."}`,
    },
    {
      role: "user" as const,
      content: JSON.stringify(args),
    },
  ];
}
