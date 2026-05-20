// Audit Overhaul Phase 3: AI prompt builders for the audit module.

export function buildChecklistGenerationPrompt(args: {
  auditTitle: string;
  auditType: string;
  scopeDescription: string | null;
  scopeFrameworks: string[];
  scopeProcesses: string[];
  locale?: "de" | "en";
}) {
  const locale = args.locale ?? "de";
  return [
    {
      role: "system" as const,
      content: `You are an ISO 19011-aware audit-checklist generator. Given audit scope + framework requirements, produce a checklist of 8–25 items.
Output ONLY a JSON object of this exact shape:
{
  "items": [
    {
      "title": "short clause-like name",
      "description": "what the auditor should examine",
      "method": "interview|document_review|observation|technical_test|sampling|walkthrough|reperformance",
      "framework": "iso-27001|iso-9001|nis2|...",
      "frameworkReference": "A.5.1 / Art. 30 / ...",
      "riskRating": "low|medium|high|critical"
    }
  ]
}
Bias towards specific examinable items (not philosophical questions).
Language: ${locale === "de" ? "Antworte auf Deutsch." : "Reply in English."}`,
    },
    {
      role: "user" as const,
      content: JSON.stringify(args),
    },
  ];
}

export function buildFindingSuggestionPrompt(args: {
  auditTitle: string;
  scopeFrameworks: string[];
  nonconformingItems: Array<{
    title: string;
    description?: string | null;
    result?: string | null;
    notes?: string | null;
  }>;
  locale?: "de" | "en";
}) {
  const locale = args.locale ?? "de";
  return [
    {
      role: "system" as const,
      content: `You are an audit finding drafter (ISO 19011 / ISO 17021-1). Given a list of nonconforming checklist items, propose findings.
Output ONLY a JSON object of this exact shape:
{
  "findings": [
    {
      "title": "concise finding title",
      "description": "facts, not opinion",
      "severity": "critical|high|medium|low",
      "evidenceSummary": "what evidence supports this",
      "remediationPlan": "actionable corrective steps",
      "remediationDueDateRelativeDays": 14
    }
  ]
}
Cite the checklist item title verbatim in the description. Suggest at most 1 finding per item; aggregate similar items if natural.
Language: ${locale === "de" ? "Antworte auf Deutsch." : "Reply in English."}`,
    },
    {
      role: "user" as const,
      content: JSON.stringify(args),
    },
  ];
}

export function buildAuditConclusionPrompt(args: {
  auditTitle: string;
  conformingCount: number;
  oppCount: number;
  observationCount: number;
  minorCount: number;
  majorCount: number;
  locale?: "de" | "en";
}) {
  const locale = args.locale ?? "de";
  return [
    {
      role: "system" as const,
      content: `You are an audit-conclusion drafter. Given counts of conforming / OFI / observation / minor / major findings, draft:
{
  "conclusion": "conforming|minor_nonconformity|major_nonconformity|not_applicable",
  "summary": "2–3 sentence executive summary",
  "recommendations": ["actionable next step", ...]
}
Rules:
- any major → conclusion = major_nonconformity
- else any minor → minor_nonconformity
- else conforming
Language: ${locale === "de" ? "Antworte auf Deutsch." : "Reply in English."}`,
    },
    {
      role: "user" as const,
      content: JSON.stringify(args),
    },
  ];
}
