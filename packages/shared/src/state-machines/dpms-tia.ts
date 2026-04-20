// DPMS TIA Helpers (GDPR Art. 44-49, Schrems II)
//
// TIA hat keine eigene status-Enum im Schema -- wir nutzen risk_rating
// als Workflow-Signal. Trotzdem zentrale Validation + Schrems-II-Logik.

import type { TiaRiskRating, TiaLegalBasis } from "../types/dpms";
export type { TiaRiskRating, TiaLegalBasis };

export interface Blocker {
  code: string;
  message: string;
  gate: string;
  severity: "error" | "warning";
}

export interface TiaSnapshot {
  title: string | null;
  transferCountry: string | null;
  legalBasis: TiaLegalBasis | null;
  schremsIiAssessment: string | null;
  riskRating: TiaRiskRating | null;
  supportingDocuments: string | null;
  responsibleId: string | null;
  assessmentDate: string | null;
  nextReviewDate: string | null;
}

/**
 * TIA-Gate: Validation beim Approve-Schritt (z. B. beim RoPA-Activate
 * wird TIA-Quality geprueft).
 */
export function validateTiaQuality(snapshot: TiaSnapshot): Blocker[] {
  const blockers: Blocker[] = [];

  if (!snapshot.title || snapshot.title.trim().length === 0) {
    blockers.push({
      code: "missing_title",
      message: "TIA braucht einen Titel.",
      gate: "TIA-1",
      severity: "error",
    });
  }

  if (
    !snapshot.transferCountry ||
    snapshot.transferCountry.trim().length === 0
  ) {
    blockers.push({
      code: "missing_transfer_country",
      message: "Empfaenger-Land muss gesetzt sein.",
      gate: "TIA-1",
      severity: "error",
    });
  }

  if (!snapshot.legalBasis) {
    blockers.push({
      code: "missing_legal_basis",
      message:
        "Rechtsgrundlage muss benannt sein (adequacy | sccs | bcrs | ...).",
      gate: "TIA-1",
      severity: "error",
    });
  }

  if (
    !snapshot.schremsIiAssessment ||
    snapshot.schremsIiAssessment.trim().length < 200
  ) {
    blockers.push({
      code: "schrems_ii_assessment_too_short",
      message:
        "Schrems-II-Assessment muss mindestens 200 Zeichen umfassen (Rechts- + Praxis-Analyse).",
      gate: "TIA-1",
      severity: "error",
    });
  }

  if (!snapshot.assessmentDate) {
    blockers.push({
      code: "missing_assessment_date",
      message: "assessmentDate erforderlich.",
      gate: "TIA-1",
      severity: "error",
    });
  }

  if (!snapshot.nextReviewDate) {
    blockers.push({
      code: "missing_next_review",
      message: "nextReviewDate empfohlen (typ. 12 Monate).",
      gate: "TIA-1",
      severity: "warning",
    });
  }

  if (!snapshot.responsibleId) {
    blockers.push({
      code: "missing_responsible",
      message: "Responsible (DPO/Legal) muss zugewiesen sein.",
      gate: "TIA-1",
      severity: "warning",
    });
  }

  return blockers;
}

// ─── Schrems-II-Risk-Logic ────────────────────────────────────
//
// EU-Adequacy-Decisions (Stand 2026-04): Liste ist in Realitaet dynamisch
// (abrufbar via Commission-Feed), hier statisch fuer offline-safe Check.

export const ADEQUACY_COUNTRIES = new Set([
  "AD", // Andorra
  "AR", // Argentina (partial)
  "CA", // Canada (commercial)
  "FO", // Faroe Islands
  "GG",
  "JE",
  "IM", // UK Crown Dependencies
  "IL", // Israel
  "JP", // Japan (private sector)
  "NZ", // New Zealand
  "CH", // Switzerland
  "UY", // Uruguay
  "KR", // South Korea
  "GB", // UK
  "US", // USA (EU-US Data Privacy Framework, 2023)
]);

export type LegalMechanism =
  | "adequacy"
  | "sccs"
  | "bcrs"
  | "certifications"
  | "art_49"
  | "none";

export interface TransferRiskAssessment {
  country: string;
  hasAdequacy: boolean;
  requiresFallback: boolean;
  recommendedMechanism: LegalMechanism;
  reason: string;
}

export function assessTransferRisk(
  countryCode: string,
): TransferRiskAssessment {
  const c = countryCode.toUpperCase().trim();
  if (ADEQUACY_COUNTRIES.has(c)) {
    return {
      country: c,
      hasAdequacy: true,
      requiresFallback: false,
      recommendedMechanism: "adequacy",
      reason:
        "EU-Adequacy-Decision existiert -- kein Fallback noetig (Stand 2026, dynamisch verifizieren).",
    };
  }
  return {
    country: c,
    hasAdequacy: false,
    requiresFallback: true,
    recommendedMechanism: "sccs",
    reason:
      "Keine Adequacy-Decision. Standard-Mechanismus sind SCCs (EU-Vertrag-Klauseln 2021/914) + TIA mit Schrems-II-Analyse.",
  };
}
