// TPRM Overhaul: AI prompt builders for vendor classification + DD-question drafting.
//
// [ARCTOS-FULL-2026-08-31 / WP6 · S05-06] Beide Builder interpolierten
// `JSON.stringify(args)` roh — inklusive Lieferantenbeschreibung und
// -leistungen, beides freier Nutzertext. Jetzt Datenumschlag.

import { buildDataPrompt, safeText } from "../prompt-safety";

export function buildVendorClassifyPrompt(args: {
  vendorName: string;
  description: string | null;
  servicesProvided?: string | null;
  country: string | null;
  jurisdiction?: string;
  locale?: "de" | "en";
}) {
  const locale = args.locale ?? "de";
  return buildDataPrompt({
    system: `You are a TPRM vendor classifier. Given a vendor brief, suggest tier + category + critical-flag candidacy.
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
    instruction: "Classify the vendor described in the data envelope.",
    data: {
      vendorName: safeText(args.vendorName, 300),
      description: safeText(args.description, 3000),
      servicesProvided: safeText(args.servicesProvided, 3000),
      country: safeText(args.country, 80),
      jurisdiction: safeText(args.jurisdiction, 80),
    },
    maxCharsPerField: 3000,
  });
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
  return buildDataPrompt({
    system: `You are a due-diligence questionnaire drafter for vendor onboarding. Generate 12-25 items.
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
    instruction:
      "Draft due-diligence questions for the vendor in the data envelope.",
    data: {
      vendorName: safeText(args.vendorName, 300),
      category: safeText(args.category, 80),
      tier: safeText(args.tier, 40),
      doraCriticalIct: Boolean(args.doraCriticalIct),
      lksgTier1: Boolean(args.lksgTier1),
    },
  });
}
