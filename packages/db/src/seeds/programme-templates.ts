// Programme Cockpit — Template Seeds
//
// Seeds für 4 Norm-Templates:
//   - ISO 27001:2022 (ISMS, 23 Schritte aus Y1-Roadmap)
//   - ISO 22301:2019 (BCMS, 18 Schritte)
//   - GDPR / EU 2016/679 (DPMS, 14 Schritte)
//   - ISO 42001:2023 (AIMS, 16 Schritte)
//
// Bezug: docs/isms-bcms/03-roadmap-year-1.md

import { db } from "../index";
import {
  programmeTemplate,
  programmeTemplatePhase,
  programmeTemplateStep,
  type MsType,
  type PdcaPhase,
} from "../schema/programme";
import { eq, and } from "drizzle-orm";

// ──────────────────────────────────────────────────────────────
// Type-defs für Seed-Daten
// ──────────────────────────────────────────────────────────────

interface SeedPhase {
  code: string;
  sequence: number;
  name: string;
  description?: string;
  pdcaPhase: PdcaPhase;
  defaultDurationDays: number;
  isGate?: boolean;
  gateCriteria?: Array<{ check: string; description: string }>;
}

interface SeedStep {
  code: string;
  phaseCode: string;
  sequence: number;
  name: string;
  description?: string;
  isoClause?: string;
  defaultOwnerRole?: string;
  defaultDurationDays: number;
  prerequisiteStepCodes?: string[];
  targetModuleLink?: {
    module?: string;
    route?: string;
    entityType?: string;
    createIfMissing?: boolean;
  };
  requiredEvidenceCount?: number;
  isMandatory?: boolean;
  isMilestone?: boolean;
}

interface SeedTemplate {
  code: string;
  msType: MsType;
  name: string;
  description: string;
  version: string;
  frameworkCodes: string[];
  estimatedDurationDays: number;
  phases: SeedPhase[];
  steps: SeedStep[];
}

// ──────────────────────────────────────────────────────────────
// ISO 27001:2022 Template
// ──────────────────────────────────────────────────────────────

const ISO_27001_TEMPLATE: SeedTemplate = {
  code: "iso27001-2022",
  msType: "isms",
  name: "ISO/IEC 27001:2022 — ISMS-Einführung",
  description:
    "Geführter Einführungsprozess für ein Information Security Management System nach ISO/IEC 27001:2022 mit Risiko-Methodik nach ISO/IEC 27005:2022.",
  version: "1.0",
  frameworkCodes: ["ISO27001:2022", "ISO27005:2022"],
  estimatedDurationDays: 365,
  phases: [
    {
      code: "setup",
      sequence: 0,
      name: "Programm-Setup",
      pdcaPhase: "plan",
      defaultDurationDays: 14,
      description: "GL-Beschluss, Charter, PMO, Tooling-Setup.",
    },
    {
      code: "plan",
      sequence: 1,
      name: "PLAN — Kontext, Politik, Risiko-Methodik",
      pdcaPhase: "plan",
      defaultDurationDays: 90,
      isGate: true,
      gateCriteria: [
        { check: "scope_signed", description: "Geltungsbereich GL-genehmigt" },
        {
          check: "policy_published",
          description: "IS-Politik v1.0 veröffentlicht",
        },
        { check: "soa_v0_9", description: "SoA-Entwurf v0.9 vorliegend" },
      ],
    },
    {
      code: "do",
      sequence: 2,
      name: "DO — Maßnahmen-Umsetzung",
      pdcaPhase: "do",
      defaultDurationDays: 90,
      isGate: true,
      gateCriteria: [
        { check: "rtp_60pct", description: "RTP umgesetzt ≥ 60 %" },
        {
          check: "awareness_round_1",
          description: "Awareness-Erstrunde abgeschlossen",
        },
      ],
    },
    {
      code: "check",
      sequence: 3,
      name: "CHECK — Audits + Wirksamkeit",
      pdcaPhase: "check",
      defaultDurationDays: 90,
      isGate: true,
      gateCriteria: [
        {
          check: "internal_audit_full_scope",
          description: "Internes Audit über vollständigen Scope",
        },
      ],
    },
    {
      code: "act",
      sequence: 4,
      name: "ACT — Management-Review + Zertifizierung",
      pdcaPhase: "act",
      defaultDurationDays: 90,
      isGate: true,
      gateCriteria: [
        {
          check: "stage2_passed",
          description: "Stage-2-Audit bestanden, Zertifikat ausgestellt",
        },
      ],
    },
  ],
  steps: [
    // Setup
    {
      code: "S00-CHARTER",
      phaseCode: "setup",
      sequence: 0,
      name: "GL-Commitment & Programm-Charter",
      description:
        "Geschäftsleitungs-Beschluss, Charter, Budget, Lenkungsausschuss.",
      isoClause: "5.1",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      requiredEvidenceCount: 1,
      isMilestone: true,
      targetModuleLink: { module: "documents", route: "/documents" },
    },
    // Plan
    {
      code: "Y1-M1-01",
      phaseCode: "plan",
      sequence: 1,
      name: "Stakeholder-Analyse + Stakeholder-Register",
      isoClause: "4.2",
      defaultOwnerRole: "risk_manager",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["S00-CHARTER"],
      targetModuleLink: { module: "platform", route: "/programmes" },
      requiredEvidenceCount: 1,
    },
    {
      code: "Y1-M1-02",
      phaseCode: "plan",
      sequence: 2,
      name: "Externer + Interner Kontext",
      isoClause: "4.1",
      defaultOwnerRole: "risk_manager",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["S00-CHARTER"],
      requiredEvidenceCount: 1,
    },
    {
      code: "Y1-M1-04",
      phaseCode: "plan",
      sequence: 3,
      name: "Geltungsbereich-Workshop & Scope-Statement",
      isoClause: "4.3",
      defaultOwnerRole: "admin",
      defaultDurationDays: 7,
      prerequisiteStepCodes: ["Y1-M1-01", "Y1-M1-02"],
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "Y1-M1-05",
      phaseCode: "plan",
      sequence: 4,
      name: "NIS2 / DORA-Anwendbarkeitsprüfung",
      defaultOwnerRole: "dpo",
      defaultDurationDays: 7,
      prerequisiteStepCodes: ["Y1-M1-04"],
      requiredEvidenceCount: 1,
    },
    {
      code: "Y1-M2-01",
      phaseCode: "plan",
      sequence: 5,
      name: "IS-Politik (Klausel 5.2)",
      isoClause: "5.2",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["Y1-M1-04"],
      targetModuleLink: { module: "documents", route: "/policies" },
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "Y1-M2-03",
      phaseCode: "plan",
      sequence: 6,
      name: "RACI / Rollen-Modell",
      isoClause: "5.3",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["Y1-M1-04"],
      requiredEvidenceCount: 1,
    },
    {
      code: "Y1-M2-04",
      phaseCode: "plan",
      sequence: 7,
      name: "Risiko-Methodik nach ISO 27005",
      isoClause: "6.1.2",
      defaultOwnerRole: "risk_manager",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["Y1-M2-01"],
      targetModuleLink: { module: "erm", route: "/risks" },
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "Y1-M3-01",
      phaseCode: "plan",
      sequence: 8,
      name: "Asset-Erfassung Phase 1 (kritische A-/B-Assets)",
      isoClause: "A.5.9",
      defaultOwnerRole: "control_owner",
      defaultDurationDays: 21,
      prerequisiteStepCodes: ["Y1-M1-04"],
      targetModuleLink: { module: "isms", route: "/assets" },
      requiredEvidenceCount: 1,
    },
    {
      code: "Y1-M3-02",
      phaseCode: "plan",
      sequence: 9,
      name: "Risiko-Identifikation Workshops",
      isoClause: "6.1.2",
      defaultOwnerRole: "risk_manager",
      defaultDurationDays: 21,
      prerequisiteStepCodes: ["Y1-M2-04", "Y1-M3-01"],
      targetModuleLink: { module: "isms", route: "/isms/risks" },
      requiredEvidenceCount: 1,
    },
    {
      code: "Y1-M3-03",
      phaseCode: "plan",
      sequence: 10,
      name: "Risiko-Analyse + Bewertung",
      isoClause: "6.1.2",
      defaultOwnerRole: "risk_manager",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["Y1-M3-02"],
      targetModuleLink: { module: "isms", route: "/isms/risks" },
      requiredEvidenceCount: 1,
    },
    {
      code: "Y1-M3-05",
      phaseCode: "plan",
      sequence: 11,
      name: "SoA-Entwurf (Annex A)",
      isoClause: "6.1.3 d",
      defaultOwnerRole: "risk_manager",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["Y1-M3-03"],
      targetModuleLink: { module: "isms", route: "/isms/soa" },
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    // Do
    {
      code: "Y1-M4-01",
      phaseCode: "do",
      sequence: 12,
      name: "Risk-Treatment-Plan",
      isoClause: "6.1.3",
      defaultOwnerRole: "risk_manager",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["Y1-M3-05"],
      targetModuleLink: { module: "erm", route: "/risks" },
      requiredEvidenceCount: 1,
    },
    {
      code: "Y1-M4-03",
      phaseCode: "do",
      sequence: 13,
      name: "Restrisiko-Akzeptanz Top-Risiken",
      isoClause: "6.1.3 f",
      defaultOwnerRole: "admin",
      defaultDurationDays: 7,
      prerequisiteStepCodes: ["Y1-M4-01"],
      requiredEvidenceCount: 1,
    },
    {
      code: "Y1-M5-01",
      phaseCode: "do",
      sequence: 14,
      name: "Maßnahmen Welle 1 (Patch / MFA / Backup / Hardening)",
      isoClause: "A.8",
      defaultOwnerRole: "control_owner",
      defaultDurationDays: 60,
      prerequisiteStepCodes: ["Y1-M4-01"],
      targetModuleLink: { module: "ics", route: "/controls" },
      requiredEvidenceCount: 2,
    },
    {
      code: "Y1-M5-03",
      phaseCode: "do",
      sequence: 15,
      name: "Awareness-Programm Start",
      isoClause: "7.3",
      defaultOwnerRole: "admin",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["Y1-M2-01"],
      targetModuleLink: { module: "academy", route: "/academy" },
      requiredEvidenceCount: 1,
    },
    {
      code: "Y1-M7-02",
      phaseCode: "do",
      sequence: 16,
      name: "Continuous Control Monitoring aktivieren",
      isoClause: "9.1",
      defaultOwnerRole: "control_owner",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["Y1-M5-01"],
      targetModuleLink: { module: "ics", route: "/control-testing" },
      requiredEvidenceCount: 1,
    },
    // Check
    {
      code: "Y1-M8-01",
      phaseCode: "check",
      sequence: 17,
      name: "Pen-Test extern",
      isoClause: "A.8.8",
      defaultOwnerRole: "risk_manager",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["Y1-M5-01"],
      targetModuleLink: { module: "isms", route: "/isms/vulnerabilities" },
      requiredEvidenceCount: 1,
    },
    {
      code: "Y1-M9-03",
      phaseCode: "check",
      sequence: 18,
      name: "Internes Audit Welle 1 (50 % Scope)",
      isoClause: "9.2",
      defaultOwnerRole: "auditor",
      defaultDurationDays: 21,
      prerequisiteStepCodes: ["Y1-M5-01", "Y1-M5-03"],
      targetModuleLink: { module: "audit", route: "/audit" },
      requiredEvidenceCount: 2,
    },
    {
      code: "Y1-M10-01",
      phaseCode: "check",
      sequence: 19,
      name: "Internes Audit Welle 2 (vollständiger Scope)",
      isoClause: "9.2",
      defaultOwnerRole: "auditor",
      defaultDurationDays: 21,
      prerequisiteStepCodes: ["Y1-M9-03"],
      targetModuleLink: { module: "audit", route: "/audit" },
      requiredEvidenceCount: 2,
      isMilestone: true,
    },
    {
      code: "Y1-M10-03",
      phaseCode: "check",
      sequence: 20,
      name: "NC-Schließung Welle 1 (Major NCs Vorrang)",
      isoClause: "10.1",
      defaultOwnerRole: "auditor",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["Y1-M10-01"],
      targetModuleLink: {
        module: "isms",
        route: "/isms/nonconformities",
      },
      requiredEvidenceCount: 1,
    },
    // Act
    {
      code: "Y1-M11-02",
      phaseCode: "act",
      sequence: 21,
      name: "Management-Review",
      isoClause: "9.3",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["Y1-M10-01"],
      targetModuleLink: { module: "isms", route: "/isms/reviews" },
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "Y1-M11-03",
      phaseCode: "act",
      sequence: 22,
      name: "Stage-1-Audit (extern, Dokumenten-Prüfung)",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["Y1-M11-02"],
      targetModuleLink: { module: "audit", route: "/audit" },
      requiredEvidenceCount: 3,
      isMilestone: true,
    },
    {
      code: "Y1-M12-01",
      phaseCode: "act",
      sequence: 23,
      name: "Stage-2-Audit + Zertifikat-Ausstellung",
      defaultOwnerRole: "admin",
      defaultDurationDays: 21,
      prerequisiteStepCodes: ["Y1-M11-03"],
      targetModuleLink: { module: "audit", route: "/audit" },
      requiredEvidenceCount: 3,
      isMilestone: true,
    },
  ],
};

// ──────────────────────────────────────────────────────────────
// ISO 22301:2019 Template (BCMS)
// ──────────────────────────────────────────────────────────────

const ISO_22301_TEMPLATE: SeedTemplate = {
  code: "iso22301-2019",
  msType: "bcms",
  name: "ISO 22301:2019 — BCMS-Einführung",
  description:
    "Geführter Einführungsprozess für ein Business Continuity Management System nach ISO 22301:2019.",
  version: "1.0",
  frameworkCodes: ["ISO22301:2019"],
  estimatedDurationDays: 300,
  phases: [
    {
      code: "setup",
      sequence: 0,
      name: "Programm-Setup",
      pdcaPhase: "plan",
      defaultDurationDays: 14,
    },
    {
      code: "plan",
      sequence: 1,
      name: "PLAN — Kontext + BCMS-Politik",
      pdcaPhase: "plan",
      defaultDurationDays: 60,
    },
    {
      code: "bia",
      sequence: 2,
      name: "BIA + Risiko",
      pdcaPhase: "plan",
      defaultDurationDays: 60,
    },
    {
      code: "do",
      sequence: 3,
      name: "DO — Strategien + Pläne",
      pdcaPhase: "do",
      defaultDurationDays: 90,
    },
    {
      code: "check",
      sequence: 4,
      name: "CHECK — Übungen + Audit",
      pdcaPhase: "check",
      defaultDurationDays: 60,
    },
    {
      code: "act",
      sequence: 5,
      name: "ACT — Review + Zertifizierung",
      pdcaPhase: "act",
      defaultDurationDays: 30,
    },
  ],
  steps: [
    {
      code: "BCM-S00",
      phaseCode: "setup",
      sequence: 0,
      name: "GL-Commitment + BCM-Manager-Benennung",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "BCM-P01",
      phaseCode: "plan",
      sequence: 1,
      name: "BCMS-Scope + Stakeholder",
      isoClause: "4.2 / 4.3",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["BCM-S00"],
      requiredEvidenceCount: 1,
    },
    {
      code: "BCM-P02",
      phaseCode: "plan",
      sequence: 2,
      name: "BCMS-Politik",
      isoClause: "5.2",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["BCM-P01"],
      targetModuleLink: { module: "documents", route: "/policies" },
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "BCM-P03",
      phaseCode: "plan",
      sequence: 3,
      name: "Rollen, Verantwortungen, Krisenstab-Charter",
      isoClause: "5.3",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["BCM-P02"],
      requiredEvidenceCount: 1,
    },
    {
      code: "BCM-B01",
      phaseCode: "bia",
      sequence: 4,
      name: "Prozess-Inventar (kritische Geschäftsprozesse)",
      isoClause: "8.2.2",
      defaultOwnerRole: "process_owner",
      defaultDurationDays: 21,
      prerequisiteStepCodes: ["BCM-P02"],
      targetModuleLink: { module: "bpm", route: "/processes" },
      requiredEvidenceCount: 1,
    },
    {
      code: "BCM-B02",
      phaseCode: "bia",
      sequence: 5,
      name: "BIA-Workshops",
      isoClause: "8.2.2",
      defaultOwnerRole: "process_owner",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["BCM-B01"],
      targetModuleLink: { module: "bcms", route: "/bcms/bia" },
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "BCM-B03",
      phaseCode: "bia",
      sequence: 6,
      name: "RTO/RPO/MBCO-Festlegung",
      isoClause: "8.2.2 c",
      defaultOwnerRole: "process_owner",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["BCM-B02"],
      targetModuleLink: { module: "bcms", route: "/bcms/bia" },
      requiredEvidenceCount: 1,
    },
    {
      code: "BCM-B04",
      phaseCode: "bia",
      sequence: 7,
      name: "BC-Risikobeurteilung",
      isoClause: "8.2.3",
      defaultOwnerRole: "risk_manager",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["BCM-B02"],
      targetModuleLink: { module: "bcms", route: "/bcms/erm-sync" },
      requiredEvidenceCount: 1,
    },
    {
      code: "BCM-D01",
      phaseCode: "do",
      sequence: 8,
      name: "Resilience-Strategien je kritischem Prozess",
      isoClause: "8.3",
      defaultOwnerRole: "process_owner",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["BCM-B03"],
      targetModuleLink: { module: "bcms", route: "/bcms/strategies" },
      requiredEvidenceCount: 1,
    },
    {
      code: "BCM-D02",
      phaseCode: "do",
      sequence: 9,
      name: "Business Continuity Plans (BCPs)",
      isoClause: "8.4",
      defaultOwnerRole: "process_owner",
      defaultDurationDays: 60,
      prerequisiteStepCodes: ["BCM-D01"],
      targetModuleLink: { module: "bcms", route: "/bcms/plans" },
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "BCM-D03",
      phaseCode: "do",
      sequence: 10,
      name: "Krisen-Kontaktbäume + Krisenstab-Aktivierungs-Verfahren",
      isoClause: "8.4.2",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["BCM-D02"],
      targetModuleLink: { module: "bcms", route: "/bcms/crisis" },
      requiredEvidenceCount: 1,
    },
    {
      code: "BCM-D04",
      phaseCode: "do",
      sequence: 11,
      name: "BCP-Schulung Schlüsselrollen",
      isoClause: "7.2",
      defaultOwnerRole: "admin",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["BCM-D02"],
      requiredEvidenceCount: 1,
    },
    {
      code: "BCM-C01",
      phaseCode: "check",
      sequence: 12,
      name: "Tabletop-Übung Welle 1 (≥ 2 Pläne)",
      isoClause: "8.5",
      defaultOwnerRole: "process_owner",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["BCM-D02"],
      targetModuleLink: { module: "bcms", route: "/bcms/exercises" },
      requiredEvidenceCount: 1,
    },
    {
      code: "BCM-C02",
      phaseCode: "check",
      sequence: 13,
      name: "Funktionsübung (mind. 1 BCP, real)",
      isoClause: "8.5",
      defaultOwnerRole: "process_owner",
      defaultDurationDays: 21,
      prerequisiteStepCodes: ["BCM-C01"],
      targetModuleLink: { module: "bcms", route: "/bcms/exercises" },
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "BCM-C03",
      phaseCode: "check",
      sequence: 14,
      name: "Internes Audit BCMS",
      isoClause: "9.2",
      defaultOwnerRole: "auditor",
      defaultDurationDays: 21,
      prerequisiteStepCodes: ["BCM-C02"],
      targetModuleLink: { module: "audit", route: "/audit" },
      requiredEvidenceCount: 1,
    },
    {
      code: "BCM-A01",
      phaseCode: "act",
      sequence: 15,
      name: "Management-Review BCMS",
      isoClause: "9.3",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["BCM-C03"],
      targetModuleLink: { module: "isms", route: "/isms/reviews" },
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "BCM-A02",
      phaseCode: "act",
      sequence: 16,
      name: "Stage-1 + Stage-2 Audit (BCMS-Zertifizierung)",
      defaultOwnerRole: "admin",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["BCM-A01"],
      targetModuleLink: { module: "audit", route: "/audit" },
      requiredEvidenceCount: 3,
      isMilestone: true,
    },
    {
      code: "BCM-A03",
      phaseCode: "act",
      sequence: 17,
      name: "Lessons Learned + Y2-Übungs-Plan",
      isoClause: "10.1",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["BCM-A02"],
      requiredEvidenceCount: 1,
    },
  ],
};

// ──────────────────────────────────────────────────────────────
// GDPR (DPMS) Template
// ──────────────────────────────────────────────────────────────

const GDPR_TEMPLATE: SeedTemplate = {
  code: "gdpr-2016-679",
  msType: "dpms",
  name: "EU 2016/679 (DSGVO) — DPMS-Einführung",
  description:
    "Geführter Einführungsprozess für ein Datenschutz-Managementsystem nach DSGVO mit RoPA, DPIA, DSR-Workflow und Breach-Management.",
  version: "1.0",
  frameworkCodes: ["EU2016/679", "ISO27701:2019"],
  estimatedDurationDays: 240,
  phases: [
    {
      code: "setup",
      sequence: 0,
      name: "Programm-Setup",
      pdcaPhase: "plan",
      defaultDurationDays: 14,
    },
    {
      code: "plan",
      sequence: 1,
      name: "PLAN — DPO + Politik",
      pdcaPhase: "plan",
      defaultDurationDays: 30,
    },
    {
      code: "do",
      sequence: 2,
      name: "DO — RoPA + DPIA + Workflows",
      pdcaPhase: "do",
      defaultDurationDays: 120,
    },
    {
      code: "check",
      sequence: 3,
      name: "CHECK — Audit + Tests",
      pdcaPhase: "check",
      defaultDurationDays: 60,
    },
    {
      code: "act",
      sequence: 4,
      name: "ACT — Review + Continuous",
      pdcaPhase: "act",
      defaultDurationDays: 30,
    },
  ],
  steps: [
    {
      code: "DP-S00",
      phaseCode: "setup",
      sequence: 0,
      name: "DPO benennen + Charter",
      isoClause: "GDPR Art. 37",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "DP-P01",
      phaseCode: "plan",
      sequence: 1,
      name: "Datenschutz-Politik + Privacy-Notice",
      isoClause: "GDPR Art. 13/14",
      defaultOwnerRole: "dpo",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["DP-S00"],
      targetModuleLink: { module: "documents", route: "/policies" },
      requiredEvidenceCount: 1,
    },
    {
      code: "DP-P02",
      phaseCode: "plan",
      sequence: 2,
      name: "Verantwortlichkeiten + RACI",
      defaultOwnerRole: "dpo",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["DP-S00"],
      requiredEvidenceCount: 1,
    },
    {
      code: "DP-D01",
      phaseCode: "do",
      sequence: 3,
      name: "RoPA Erst-Erfassung",
      isoClause: "GDPR Art. 30",
      defaultOwnerRole: "dpo",
      defaultDurationDays: 60,
      prerequisiteStepCodes: ["DP-P01"],
      targetModuleLink: { module: "dpms", route: "/data-privacy/ropa" },
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "DP-D02",
      phaseCode: "do",
      sequence: 4,
      name: "Rechtsgrundlagen-Bewertung",
      isoClause: "GDPR Art. 6",
      defaultOwnerRole: "dpo",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["DP-D01"],
      requiredEvidenceCount: 1,
    },
    {
      code: "DP-D03",
      phaseCode: "do",
      sequence: 5,
      name: "DPIA für Hochrisiko-Verarbeitungen",
      isoClause: "GDPR Art. 35",
      defaultOwnerRole: "dpo",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["DP-D01"],
      targetModuleLink: { module: "dpms", route: "/data-privacy/dpia" },
      requiredEvidenceCount: 1,
    },
    {
      code: "DP-D04",
      phaseCode: "do",
      sequence: 6,
      name: "TOMs (Art. 32)",
      isoClause: "GDPR Art. 32",
      defaultOwnerRole: "dpo",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["DP-D03"],
      targetModuleLink: { module: "ics", route: "/controls" },
      requiredEvidenceCount: 1,
    },
    {
      code: "DP-D05",
      phaseCode: "do",
      sequence: 7,
      name: "Auftragsverarbeiter-Verträge (AVV)",
      isoClause: "GDPR Art. 28",
      defaultOwnerRole: "dpo",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["DP-D01"],
      targetModuleLink: {
        module: "tprm",
        route: "/contracts",
      },
      requiredEvidenceCount: 1,
    },
    {
      code: "DP-D06",
      phaseCode: "do",
      sequence: 8,
      name: "DSR-Workflow (Betroffenenrechte)",
      isoClause: "GDPR Art. 12-22",
      defaultOwnerRole: "dpo",
      defaultDurationDays: 21,
      prerequisiteStepCodes: ["DP-D01"],
      targetModuleLink: { module: "dpms", route: "/data-privacy/dsr" },
      requiredEvidenceCount: 1,
    },
    {
      code: "DP-D07",
      phaseCode: "do",
      sequence: 9,
      name: "Datenschutz-Vorfalls-Workflow (72h-Meldung)",
      isoClause: "GDPR Art. 33/34",
      defaultOwnerRole: "dpo",
      defaultDurationDays: 21,
      prerequisiteStepCodes: ["DP-D01"],
      targetModuleLink: { module: "dpms", route: "/data-privacy/breaches" },
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "DP-C01",
      phaseCode: "check",
      sequence: 10,
      name: "Internes Audit Datenschutz",
      defaultOwnerRole: "auditor",
      defaultDurationDays: 21,
      prerequisiteStepCodes: ["DP-D04", "DP-D06", "DP-D07"],
      targetModuleLink: { module: "audit", route: "/audit" },
      requiredEvidenceCount: 1,
    },
    {
      code: "DP-C02",
      phaseCode: "check",
      sequence: 11,
      name: "DSR-Antwort-Frist-Test (1-Monats-Test)",
      defaultOwnerRole: "dpo",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["DP-D06"],
      requiredEvidenceCount: 1,
    },
    {
      code: "DP-A01",
      phaseCode: "act",
      sequence: 12,
      name: "Management-Review DPMS",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["DP-C01"],
      targetModuleLink: { module: "isms", route: "/isms/reviews" },
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "DP-A02",
      phaseCode: "act",
      sequence: 13,
      name: "Privacy-by-Design-Integration in BPMN-Prozesse",
      defaultOwnerRole: "dpo",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["DP-A01"],
      requiredEvidenceCount: 1,
    },
  ],
};

// ──────────────────────────────────────────────────────────────
// ISO 42001:2023 (AIMS) Template
// ──────────────────────────────────────────────────────────────

const ISO_42001_TEMPLATE: SeedTemplate = {
  code: "iso42001-2023",
  msType: "aims",
  name: "ISO/IEC 42001:2023 — AIMS-Einführung",
  description:
    "Geführter Einführungsprozess für ein AI Management System nach ISO/IEC 42001:2023 mit EU-AI-Act-Mapping.",
  version: "1.0",
  frameworkCodes: ["ISO42001:2023", "EUAIAct"],
  estimatedDurationDays: 270,
  phases: [
    {
      code: "setup",
      sequence: 0,
      name: "Programm-Setup",
      pdcaPhase: "plan",
      defaultDurationDays: 14,
    },
    {
      code: "plan",
      sequence: 1,
      name: "PLAN — Politik + Klassifikation",
      pdcaPhase: "plan",
      defaultDurationDays: 60,
    },
    {
      code: "do",
      sequence: 2,
      name: "DO — Inventar + Conformity",
      pdcaPhase: "do",
      defaultDurationDays: 120,
    },
    {
      code: "check",
      sequence: 3,
      name: "CHECK — Oversight + Audit",
      pdcaPhase: "check",
      defaultDurationDays: 60,
    },
    {
      code: "act",
      sequence: 4,
      name: "ACT — Review + Post-Market",
      pdcaPhase: "act",
      defaultDurationDays: 30,
    },
  ],
  steps: [
    {
      code: "AI-S00",
      phaseCode: "setup",
      sequence: 0,
      name: "GL-Commitment + AI-Beauftragter",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "AI-P01",
      phaseCode: "plan",
      sequence: 1,
      name: "AI-Politik + ethische Grundsätze",
      isoClause: "ISO 42001 §5.2",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["AI-S00"],
      targetModuleLink: { module: "documents", route: "/policies" },
      requiredEvidenceCount: 1,
    },
    {
      code: "AI-P02",
      phaseCode: "plan",
      sequence: 2,
      name: "AI-System-Inventar (Erst-Erfassung)",
      isoClause: "EU AI Act Art. 49",
      defaultOwnerRole: "admin",
      defaultDurationDays: 21,
      prerequisiteStepCodes: ["AI-S00"],
      targetModuleLink: { module: "ai-act", route: "/ai-act/systems" },
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "AI-P03",
      phaseCode: "plan",
      sequence: 3,
      name: "Risiko-Klassifikation (verboten / hoch / begrenzt / minimal)",
      isoClause: "EU AI Act Art. 5-6",
      defaultOwnerRole: "risk_manager",
      defaultDurationDays: 21,
      prerequisiteStepCodes: ["AI-P02"],
      requiredEvidenceCount: 1,
    },
    {
      code: "AI-D01",
      phaseCode: "do",
      sequence: 4,
      name: "Quality-Management-System (Annex IX)",
      isoClause: "EU AI Act Art. 17",
      defaultOwnerRole: "admin",
      defaultDurationDays: 60,
      prerequisiteStepCodes: ["AI-P02"],
      targetModuleLink: { module: "ai-act", route: "/ai-act/qms" },
      requiredEvidenceCount: 1,
    },
    {
      code: "AI-D02",
      phaseCode: "do",
      sequence: 5,
      name: "Risiko-Management Hochrisiko-AI (Annex IV)",
      isoClause: "EU AI Act Art. 9",
      defaultOwnerRole: "risk_manager",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["AI-P03"],
      requiredEvidenceCount: 1,
    },
    {
      code: "AI-D03",
      phaseCode: "do",
      sequence: 6,
      name: "Daten-Governance + Trainingsdaten-Doku",
      isoClause: "EU AI Act Art. 10",
      defaultOwnerRole: "admin",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["AI-D02"],
      requiredEvidenceCount: 1,
    },
    {
      code: "AI-D04",
      phaseCode: "do",
      sequence: 7,
      name: "Technical Documentation (Annex IV)",
      isoClause: "EU AI Act Art. 11",
      defaultOwnerRole: "admin",
      defaultDurationDays: 21,
      prerequisiteStepCodes: ["AI-D02"],
      requiredEvidenceCount: 1,
    },
    {
      code: "AI-D05",
      phaseCode: "do",
      sequence: 8,
      name: "Human-Oversight-Design + Logging",
      isoClause: "EU AI Act Art. 12-14",
      defaultOwnerRole: "admin",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["AI-D02"],
      targetModuleLink: { module: "ai-act", route: "/ai-act/oversight-logs" },
      requiredEvidenceCount: 1,
    },
    {
      code: "AI-D06",
      phaseCode: "do",
      sequence: 9,
      name: "Conformity-Assessment + CE-Kennzeichnung",
      isoClause: "EU AI Act Art. 43",
      defaultOwnerRole: "admin",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["AI-D04", "AI-D05"],
      targetModuleLink: {
        module: "ai-act",
        route: "/ai-act/conformity-assessments",
      },
      requiredEvidenceCount: 2,
      isMilestone: true,
    },
    {
      code: "AI-C01",
      phaseCode: "check",
      sequence: 10,
      name: "FRIA für Hochrisiko-Deployments",
      isoClause: "EU AI Act Art. 27",
      defaultOwnerRole: "dpo",
      defaultDurationDays: 30,
      prerequisiteStepCodes: ["AI-D06"],
      targetModuleLink: { module: "ai-act", route: "/ai-act/frias" },
      requiredEvidenceCount: 1,
    },
    {
      code: "AI-C02",
      phaseCode: "check",
      sequence: 11,
      name: "Internes Audit AIMS",
      defaultOwnerRole: "auditor",
      defaultDurationDays: 21,
      prerequisiteStepCodes: ["AI-D06"],
      targetModuleLink: { module: "audit", route: "/audit" },
      requiredEvidenceCount: 1,
    },
    {
      code: "AI-C03",
      phaseCode: "check",
      sequence: 12,
      name: "Penetrations-Test ML-Modelle (Adversarial Robustness)",
      defaultOwnerRole: "risk_manager",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["AI-D06"],
      requiredEvidenceCount: 1,
    },
    {
      code: "AI-A01",
      phaseCode: "act",
      sequence: 13,
      name: "Management-Review AIMS",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["AI-C02"],
      targetModuleLink: { module: "isms", route: "/isms/reviews" },
      requiredEvidenceCount: 1,
      isMilestone: true,
    },
    {
      code: "AI-A02",
      phaseCode: "act",
      sequence: 14,
      name: "Post-Market-Monitoring-Plan",
      isoClause: "EU AI Act Art. 72",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["AI-A01"],
      requiredEvidenceCount: 1,
    },
    {
      code: "AI-A03",
      phaseCode: "act",
      sequence: 15,
      name: "Incident-Reporting an Marktüberwachungsbehörde",
      isoClause: "EU AI Act Art. 73",
      defaultOwnerRole: "admin",
      defaultDurationDays: 14,
      prerequisiteStepCodes: ["AI-A02"],
      targetModuleLink: { module: "ai-act", route: "/ai-act/incidents" },
      requiredEvidenceCount: 1,
    },
  ],
};

// ──────────────────────────────────────────────────────────────
// All templates
// ──────────────────────────────────────────────────────────────

export const PROGRAMME_TEMPLATE_SEEDS: SeedTemplate[] = [
  ISO_27001_TEMPLATE,
  ISO_22301_TEMPLATE,
  GDPR_TEMPLATE,
  ISO_42001_TEMPLATE,
];

// ──────────────────────────────────────────────────────────────
// Seeding-Funktion
// ──────────────────────────────────────────────────────────────

export interface ProgrammeSeedResult {
  templatesSeeded: number;
  phasesSeeded: number;
  stepsSeeded: number;
}

export async function seedProgrammeTemplates(): Promise<ProgrammeSeedResult> {
  let templatesSeeded = 0;
  let phasesSeeded = 0;
  let stepsSeeded = 0;

  for (const seed of PROGRAMME_TEMPLATE_SEEDS) {
    const existing = await db
      .select({ id: programmeTemplate.id })
      .from(programmeTemplate)
      .where(
        and(
          eq(programmeTemplate.code, seed.code),
          eq(programmeTemplate.version, seed.version),
        ),
      )
      .limit(1);
    if (existing.length > 0) continue;

    const [template] = await db
      .insert(programmeTemplate)
      .values({
        code: seed.code,
        msType: seed.msType,
        name: seed.name,
        description: seed.description,
        version: seed.version,
        frameworkCodes: seed.frameworkCodes,
        estimatedDurationDays: seed.estimatedDurationDays,
        publishedAt: new Date(),
        isActive: true,
      })
      .returning();
    templatesSeeded++;

    const phaseCodeToId = new Map<string, string>();
    for (const phase of seed.phases) {
      const [phaseRow] = await db
        .insert(programmeTemplatePhase)
        .values({
          templateId: template.id,
          code: phase.code,
          sequence: phase.sequence,
          name: phase.name,
          description: phase.description ?? null,
          pdcaPhase: phase.pdcaPhase,
          defaultDurationDays: phase.defaultDurationDays,
          isGate: phase.isGate ?? false,
          gateCriteria: phase.gateCriteria ?? [],
        })
        .returning();
      phaseCodeToId.set(phase.code, phaseRow.id);
      phasesSeeded++;
    }

    for (const step of seed.steps) {
      const phaseId = phaseCodeToId.get(step.phaseCode);
      if (!phaseId) {
        throw new Error(
          `Seed-Konsistenzfehler: Phase ${step.phaseCode} nicht in Template ${seed.code}`,
        );
      }
      await db.insert(programmeTemplateStep).values({
        templateId: template.id,
        phaseId,
        code: step.code,
        sequence: step.sequence,
        name: step.name,
        description: step.description ?? null,
        isoClause: step.isoClause ?? null,
        defaultOwnerRole: step.defaultOwnerRole ?? null,
        defaultDurationDays: step.defaultDurationDays,
        prerequisiteStepCodes: step.prerequisiteStepCodes ?? [],
        targetModuleLink: step.targetModuleLink ?? {},
        requiredEvidenceCount: step.requiredEvidenceCount ?? 0,
        isMandatory: step.isMandatory ?? true,
        isMilestone: step.isMilestone ?? false,
      });
      stepsSeeded++;
    }
  }

  return { templatesSeeded, phasesSeeded, stepsSeeded };
}
