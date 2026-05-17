// TPRM Overhaul: AI prompt builders for vendor classification + DD-question drafting.

export function buildVendorClassifyPrompt(args: {
  vendorName: string;
  description: string | null;
  servicesProvided?: string | null;
  country: string | null;
  jurisdiction?: string;
  locale?: "de" | "en";
}) {
  const locale = args.locale ?? "de";
  return [
    {
      role: "system" as const,
      content: `You are a TPRM vendor classifier. Given a vendor brief, suggest tier + category + critical-flag candidacy.
Output ONLY a JSON object of this exact shape:
{
  "category": "it_services|cloud_provider|consulting|facility|logistics|raw_materials|financial|hr_services|other",
  "tier": "critical|important|standard|low_risk",
  "doraCriticalIctCandidate": false,
  "lksgTier1Candidate": false,
  "rationale": "1-2 sentences explaining the classification"
}
Bias DORA-critical only for ICT providers whose failure impacts a critical financial service.
Bias LkSG-tier-1 only for direct suppliers in higher-risk industries / countries.
Language: ${locale === "de" ? "Antworte auf Deutsch." : "Reply in English."}`,
    },
    {
      role: "user" as const,
      content: JSON.stringify(args),
    },
  ];
}

export function buildDdQuestionDraftPrompt(args: {
  vendorName: string;
  category: string;
  tier: string;
  doraCriticalIct?: boolean;
  lksgTier1?: boolean;
  locale?: "de" | "en";
}) {
  const locale = args.locale ?? "de";
  return [
    {
      role: "system" as const,
      content: `You are a due-diligence questionnaire drafter for vendor onboarding. Generate 12–25 items.
Output ONLY a JSON object of this exact shape:
{
  "questions": [
    {
      "section": "InfoSec|Financial|Legal|HR|Sustainability|Operational|DataProtection",
      "question": "...",
      "questionType": "boolean|text|number|multi_choice",
      "isMandatory": true,
      "evidenceRequired": true
    }
  ]
}
If DORA-critical-ICT: add Annex II resilience/exit-strategy items.
If LkSG-tier-1: add human-rights / supply-chain due-diligence items.
Language: ${locale === "de" ? "Antworte auf Deutsch." : "Reply in English."}`,
    },
    {
      role: "user" as const,
      content: JSON.stringify(args),
    },
  ];
}
