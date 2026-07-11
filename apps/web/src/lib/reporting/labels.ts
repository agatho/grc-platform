// Localised label dictionaries for report documents (DE/EN).
//
// Report output is a document, not a React page — next-intl's request
// scope isn't available inside buffer rendering, so the document
// strings live here (the UI strings stay in messages/{de,en}/
// reporting.json). Keys mirror the DB enums they translate.

import type { ReportLocale } from "./core";

type Dict = Record<string, string>;

const RISK_STATUS: Record<ReportLocale, Dict> = {
  de: {
    identified: "Identifiziert",
    assessed: "Bewertet",
    treated: "Behandelt",
    accepted: "Akzeptiert",
    closed: "Geschlossen",
    reopened: "Wiedereröffnet",
  },
  en: {
    identified: "Identified",
    assessed: "Assessed",
    treated: "Treated",
    accepted: "Accepted",
    closed: "Closed",
    reopened: "Reopened",
  },
};

const RISK_CATEGORY: Record<ReportLocale, Dict> = {
  de: {
    strategic: "Strategisch",
    operational: "Operativ",
    financial: "Finanziell",
    compliance: "Compliance",
    cyber: "Cyber",
    reputational: "Reputation",
    esg: "ESG",
  },
  en: {
    strategic: "Strategic",
    operational: "Operational",
    financial: "Financial",
    compliance: "Compliance",
    cyber: "Cyber",
    reputational: "Reputational",
    esg: "ESG",
  },
};

const SEVERITY: Record<ReportLocale, Dict> = {
  de: {
    critical: "Kritisch",
    high: "Hoch",
    medium: "Mittel",
    low: "Niedrig",
    unrated: "Nicht bewertet",
  },
  en: {
    critical: "Critical",
    high: "High",
    medium: "Medium",
    low: "Low",
    unrated: "Not rated",
  },
};

const SOA_APPLICABILITY: Record<ReportLocale, Dict> = {
  de: {
    applicable: "Anwendbar",
    not_applicable: "Nicht anwendbar",
    partially_applicable: "Teilweise anwendbar",
    not_assessed: "Nicht bewertet",
  },
  en: {
    applicable: "Applicable",
    not_applicable: "Not applicable",
    partially_applicable: "Partially applicable",
    not_assessed: "Not assessed",
  },
};

const SOA_IMPLEMENTATION: Record<ReportLocale, Dict> = {
  de: {
    implemented: "Umgesetzt",
    partially_implemented: "Teilweise umgesetzt",
    planned: "Geplant",
    not_implemented: "Nicht umgesetzt",
    not_assessed: "Nicht bewertet",
  },
  en: {
    implemented: "Implemented",
    partially_implemented: "Partially implemented",
    planned: "Planned",
    not_implemented: "Not implemented",
    not_assessed: "Not assessed",
  },
};

// Report chrome/heading strings per report type.
const STRINGS: Record<ReportLocale, Dict> = {
  de: {
    riskRegisterTitle: "Risikobericht",
    riskRegisterSubtitle: "Risikoregister mit Executive Summary",
    executiveSummary: "Executive Summary",
    byStatus: "Risiken nach Status",
    bySeverity: "Risiken nach Schwere (Netto)",
    top10: "Top 10 nach Restrisiko",
    fullRegister: "Vollständiges Risikoregister",
    totalRisks: "Risiken gesamt",
    colId: "ID",
    colTitle: "Titel",
    colCategory: "Kategorie",
    colGross: "Brutto",
    colNet: "Netto",
    colOwner: "Owner",
    colStatus: "Status",
    colTreatments: "Maßnahmen",
    colReviewDate: "Review-Datum",
    colCount: "Anzahl",
    filterStatus: "Status-Filter",
    filterCategory: "Kategorie-Filter",

    soaTitle: "Statement of Applicability (SoA)",
    soaSubtitle: "Erklärung zur Anwendbarkeit gemäß ISO/IEC 27001",
    soaOverview: "Übersicht",
    soaEntries: "Anforderungen und Kontrollen",
    soaTotal: "Anforderungen gesamt",
    soaApplicable: "Anwendbar",
    soaNotApplicable: "Nicht anwendbar",
    soaImplemented: "Umgesetzt",
    soaPartially: "Teilweise umgesetzt",
    soaOpen: "Offen",
    colRef: "Referenz",
    colRequirement: "Anforderung / Kontrolle",
    colApplicability: "Anwendbarkeit",
    colJustification: "Begründung",
    colControl: "Implementierende Kontrolle",
    colImplementation: "Umsetzungsstatus",
    colResponsible: "Verantwortlich",
    colLastReviewed: "Zuletzt geprüft",

    complianceTitle: "Compliance-Status",
    complianceSubtitle: "Erfüllungsgrad je Kapitel/Domäne",
    complianceOverview: "Erfüllungsgrad-Übersicht",
    complianceByChapter: "Erfüllungsgrad je Kapitel",
    complianceGaps: "Lücken-Liste",
    fulfilled: "Erfüllt",
    partiallyFulfilled: "Teilweise erfüllt",
    open: "Offen",
    overallCompliance: "Gesamterfüllungsgrad",
    colChapter: "Kapitel",
    colFulfilled: "Erfüllt",
    colPartial: "Teilweise",
    colOpen: "Offen",
    colNotes: "Hinweise",
    framework: "Framework",
  },
  en: {
    riskRegisterTitle: "Risk Report",
    riskRegisterSubtitle: "Risk register with executive summary",
    executiveSummary: "Executive Summary",
    byStatus: "Risks by status",
    bySeverity: "Risks by severity (residual)",
    top10: "Top 10 by residual risk",
    fullRegister: "Full risk register",
    totalRisks: "Total risks",
    colId: "ID",
    colTitle: "Title",
    colCategory: "Category",
    colGross: "Gross",
    colNet: "Net",
    colOwner: "Owner",
    colStatus: "Status",
    colTreatments: "Treatments",
    colReviewDate: "Review date",
    colCount: "Count",
    filterStatus: "Status filter",
    filterCategory: "Category filter",

    soaTitle: "Statement of Applicability (SoA)",
    soaSubtitle: "Statement of Applicability per ISO/IEC 27001",
    soaOverview: "Overview",
    soaEntries: "Requirements and controls",
    soaTotal: "Total requirements",
    soaApplicable: "Applicable",
    soaNotApplicable: "Not applicable",
    soaImplemented: "Implemented",
    soaPartially: "Partially implemented",
    soaOpen: "Open",
    colRef: "Reference",
    colRequirement: "Requirement / control",
    colApplicability: "Applicability",
    colJustification: "Justification",
    colControl: "Implementing control",
    colImplementation: "Implementation status",
    colResponsible: "Responsible",
    colLastReviewed: "Last reviewed",

    complianceTitle: "Compliance Status",
    complianceSubtitle: "Fulfilment per chapter/domain",
    complianceOverview: "Fulfilment overview",
    complianceByChapter: "Fulfilment per chapter",
    complianceGaps: "Gap list",
    fulfilled: "Fulfilled",
    partiallyFulfilled: "Partially fulfilled",
    open: "Open",
    overallCompliance: "Overall compliance",
    colChapter: "Chapter",
    colFulfilled: "Fulfilled",
    colPartial: "Partial",
    colOpen: "Open",
    colNotes: "Notes",
    framework: "Framework",
  },
};

export function reportLabel(locale: ReportLocale, key: string): string {
  return STRINGS[locale]?.[key] ?? STRINGS.de[key] ?? key;
}

export function riskStatusLabel(locale: ReportLocale, value: string): string {
  return RISK_STATUS[locale]?.[value] ?? value;
}

export function riskCategoryLabel(locale: ReportLocale, value: string): string {
  return RISK_CATEGORY[locale]?.[value] ?? value;
}

export function severityLabel(locale: ReportLocale, value: string): string {
  return SEVERITY[locale]?.[value] ?? value;
}

export function soaApplicabilityLabel(
  locale: ReportLocale,
  value: string,
): string {
  return SOA_APPLICABILITY[locale]?.[value] ?? value;
}

export function soaImplementationLabel(
  locale: ReportLocale,
  value: string,
): string {
  return SOA_IMPLEMENTATION[locale]?.[value] ?? value;
}

/** Severity band for a 1–25 (5×5) risk score. */
export function severityBand(
  score: number | null | undefined,
): "critical" | "high" | "medium" | "low" | "unrated" {
  if (score === null || score === undefined) return "unrated";
  if (score >= 15) return "critical";
  if (score >= 8) return "high";
  if (score >= 4) return "medium";
  return "low";
}
