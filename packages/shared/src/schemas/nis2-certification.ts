import { z } from "zod";

// ──────────────────────────────────────────────────────────────
// NIS2 Requirement Status (computed, not stored)
// ──────────────────────────────────────────────────────────────

export const nis2RequirementStatus = z.enum([
  "compliant",
  "partially_compliant",
  "non_compliant",
]);
export type NIS2RequirementStatus = z.infer<typeof nis2RequirementStatus>;

// ──────────────────────────────────────────────────────────────
// NIS2 Incident Report schemas
// ──────────────────────────────────────────────────────────────

export const nis2ReportType = z.enum([
  "early_warning",
  "full_notification",
  "intermediate_report",
  "final_report",
]);
export type NIS2ReportType = z.infer<typeof nis2ReportType>;

export const nis2ReportStatus = z.enum([
  "draft",
  "submitted",
  "acknowledged",
  "rejected",
]);
export type NIS2ReportStatus = z.infer<typeof nis2ReportStatus>;

export const createNis2IncidentReportSchema = z.object({
  incidentId: z.string().uuid(),
  reportType: nis2ReportType,
  deadlineAt: z.string().datetime(),
  bsiReference: z.string().max(200).optional(),
  reportContent: z.string().max(50000).optional(),
  contactPerson: z.string().max(500).optional(),
  contactEmail: z.string().email().max(500).optional(),
  contactPhone: z.string().max(100).optional(),
  affectedServicesDescription: z.string().max(10000).optional(),
  crossBorderImpact: z.string().max(10000).optional(),
  estimatedImpactCount: z.number().int().min(0).optional(),
});

export const updateNis2IncidentReportSchema = z.object({
  status: nis2ReportStatus.optional(),
  bsiReference: z.string().max(200).optional(),
  reportContent: z.string().max(50000).optional(),
  contactPerson: z.string().max(500).optional(),
  contactEmail: z.string().email().max(500).optional(),
  contactPhone: z.string().max(100).optional(),
  affectedServicesDescription: z.string().max(10000).optional(),
  crossBorderImpact: z.string().max(10000).optional(),
  estimatedImpactCount: z.number().int().min(0).optional(),
});

// ──────────────────────────────────────────────────────────────
// Certification Readiness Snapshot schemas
// ──────────────────────────────────────────────────────────────

export const createCertSnapshotSchema = z.object({
  framework: z.string().min(1).max(100),
});

export const certSnapshotQuerySchema = z.object({
  framework: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

// ──────────────────────────────────────────────────────────────
// NIS2 query schemas
// ──────────────────────────────────────────────────────────────

export const nis2ReportQuerySchema = z.object({
  incidentId: z.string().uuid().optional(),
  reportType: nis2ReportType.optional(),
  status: nis2ReportStatus.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

// ──────────────────────────────────────────────────────────────
// NIS2 Art. 21 Requirement definitions (static seed data)
// ──────────────────────────────────────────────────────────────

export interface NIS2RequirementDef {
  id: string;
  article: string;
  chapter: string;
  nameDE: string;
  nameEN: string;
  descriptionDE: string;
  descriptionEN: string;
  isoMapping: string[];
  weight: number;
}

export const NIS2_ART21_REQUIREMENTS: NIS2RequirementDef[] = [
  {
    id: "21.2a",
    article: "Art. 21 Abs. 2 lit. a",
    chapter: "risk_management",
    nameDE: "Risikoanalyse und Sicherheitskonzepte",
    nameEN: "Risk analysis and security policies",
    descriptionDE: "Konzepte in Bezug auf die Risikoanalyse und Sicherheit fuer Informationssysteme",
    descriptionEN: "Policies on risk analysis and information system security",
    isoMapping: ["A.5.1", "A.5.2", "A.8.1"],
    weight: 15,
  },
  {
    id: "21.2b",
    article: "Art. 21 Abs. 2 lit. b",
    chapter: "incident_handling",
    nameDE: "Bewaeltigung von Sicherheitsvorfaellen",
    nameEN: "Incident handling",
    descriptionDE: "Bewaeltigung von Sicherheitsvorfaellen einschliesslich Erkennung, Reaktion und Wiederherstellung",
    descriptionEN: "Incident handling including detection, response and recovery",
    isoMapping: ["A.5.24", "A.5.25", "A.5.26", "A.5.27"],
    weight: 12,
  },
  {
    id: "21.2c",
    article: "Art. 21 Abs. 2 lit. c",
    chapter: "business_continuity",
    nameDE: "Business Continuity und Krisenmanagement",
    nameEN: "Business continuity and crisis management",
    descriptionDE: "Aufrechterhaltung des Betriebs, Backup-Management und Wiederherstellung sowie Krisenmanagement",
    descriptionEN: "Business continuity, backup management, disaster recovery and crisis management",
    isoMapping: ["A.5.29", "A.5.30"],
    weight: 10,
  },
  {
    id: "21.2d",
    article: "Art. 21 Abs. 2 lit. d",
    chapter: "supply_chain",
    nameDE: "Sicherheit der Lieferkette",
    nameEN: "Supply chain security",
    descriptionDE: "Sicherheit der Lieferkette einschliesslich der Beziehungen zwischen Einrichtungen und ihren Diensteanbietern",
    descriptionEN: "Supply chain security including relationships between entities and their service providers",
    isoMapping: ["A.5.19", "A.5.20", "A.5.21", "A.5.22"],
    weight: 10,
  },
  {
    id: "21.2e",
    article: "Art. 21 Abs. 2 lit. e",
    chapter: "acquisition_security",
    nameDE: "Sicherheit bei Erwerb und Entwicklung",
    nameEN: "Security in acquisition and development",
    descriptionDE: "Sicherheit bei der Beschaffung, Entwicklung und Wartung von Netz- und Informationssystemen einschliesslich des Umgangs mit Schwachstellen",
    descriptionEN: "Security in network and information systems acquisition, development and maintenance, including vulnerability handling",
    isoMapping: ["A.8.25", "A.8.26", "A.8.27", "A.8.28"],
    weight: 8,
  },
  {
    id: "21.2f",
    article: "Art. 21 Abs. 2 lit. f",
    chapter: "vulnerability_mgmt",
    nameDE: "Schwachstellenmanagement und Offenlegung",
    nameEN: "Vulnerability management and disclosure",
    descriptionDE: "Konzepte und Verfahren zur Bewertung der Wirksamkeit von Risikomanagementmassnahmen im Bereich Cybersicherheit",
    descriptionEN: "Policies and procedures to assess the effectiveness of cybersecurity risk management measures",
    isoMapping: ["A.8.8", "A.8.9"],
    weight: 8,
  },
  {
    id: "21.2g",
    article: "Art. 21 Abs. 2 lit. g",
    chapter: "effectiveness",
    nameDE: "Bewertung der Wirksamkeit von Cybersicherheitsmassnahmen",
    nameEN: "Assessment of effectiveness of cybersecurity measures",
    descriptionDE: "Grundlegende Verfahren im Bereich der Cyberhygiene und Schulungen im Bereich der Cybersicherheit",
    descriptionEN: "Basic cyber hygiene practices and cybersecurity training",
    isoMapping: ["A.5.35", "A.5.36"],
    weight: 8,
  },
  {
    id: "21.2h",
    article: "Art. 21 Abs. 2 lit. h",
    chapter: "cyber_hygiene",
    nameDE: "Cyberhygiene und Schulungen",
    nameEN: "Cyber hygiene and training",
    descriptionDE: "Grundlegende Verfahren im Bereich der Cyberhygiene und Schulungen im Bereich der Cybersicherheit",
    descriptionEN: "Basic cyber hygiene practices and cybersecurity training",
    isoMapping: ["A.6.3", "A.6.8"],
    weight: 8,
  },
  {
    id: "21.2i",
    article: "Art. 21 Abs. 2 lit. i",
    chapter: "cryptography",
    nameDE: "Kryptografie und Verschluesselung",
    nameEN: "Cryptography and encryption",
    descriptionDE: "Konzepte und Verfahren fuer den Einsatz von Kryptografie und gegebenenfalls Verschluesselung",
    descriptionEN: "Policies and procedures regarding the use of cryptography and, where appropriate, encryption",
    isoMapping: ["A.8.24"],
    weight: 8,
  },
  {
    id: "21.2j",
    article: "Art. 21 Abs. 2 lit. j",
    chapter: "access_control",
    nameDE: "Zugangskontrolle und Asset-Management",
    nameEN: "Access control and asset management",
    descriptionDE: "Sicherheit des Personals, Konzepte fuer die Zugangskontrolle und Asset-Management",
    descriptionEN: "Human resources security, access control policies and asset management",
    isoMapping: ["A.5.15", "A.5.16", "A.5.17", "A.5.18", "A.8.5"],
    weight: 13,
  },
];

// ──────────────────────────────────────────────────────────────
// NIS2 Art. 23 Notification deadlines
// ──────────────────────────────────────────────────────────────

export const NIS2_NOTIFICATION_DEADLINES = {
  early_warning: 24,        // hours after detection
  full_notification: 72,    // hours after detection
  intermediate_report: 720, // 30 days (hours)
  final_report: 720,        // 1 month after detection
} as const;

// ──────────────────────────────────────────────────────────────
// NIS2 Chapter labels
// ──────────────────────────────────────────────────────────────

export const NIS2_CHAPTERS: Record<string, { de: string; en: string }> = {
  risk_management: { de: "Risikomanagement", en: "Risk Management" },
  incident_handling: { de: "Vorfallbewaeltigung", en: "Incident Handling" },
  business_continuity: { de: "Business Continuity", en: "Business Continuity" },
  supply_chain: { de: "Lieferkettensicherheit", en: "Supply Chain Security" },
  acquisition_security: { de: "Beschaffungssicherheit", en: "Acquisition Security" },
  vulnerability_mgmt: { de: "Schwachstellenmanagement", en: "Vulnerability Management" },
  effectiveness: { de: "Wirksamkeitsbewertung", en: "Effectiveness Assessment" },
  cyber_hygiene: { de: "Cyberhygiene", en: "Cyber Hygiene" },
  cryptography: { de: "Kryptografie", en: "Cryptography" },
  access_control: { de: "Zugangskontrolle", en: "Access Control" },
};

// ──────────────────────────────────────────────────────────────
// Certification Readiness Check definitions
// ──────────────────────────────────────────────────────────────

export interface CertReadinessCheckDef {
  id: string;
  labelDE: string;
  labelEN: string;
  category: string;
}

export const CERT_READINESS_CHECKS: CertReadinessCheckDef[] = [
  { id: "soa_complete", labelDE: "SoA vollstaendig", labelEN: "SoA complete", category: "documentation" },
  { id: "mgmt_review", labelDE: "Management Review (< 12 Monate)", labelEN: "Management Review (< 12 months)", category: "governance" },
  { id: "internal_audit", labelDE: "Interne Audits abgeschlossen", labelEN: "Internal audits completed", category: "audit" },
  { id: "findings_closed", labelDE: "Signifikante Findings geschlossen", labelEN: "Significant findings closed", category: "audit" },
  { id: "prq_complete", labelDE: "Schutzbedarfsfeststellung fuer alle Assets", labelEN: "Protection requirements for all assets", category: "assets" },
  { id: "risk_treatment", labelDE: "Risikobehandlungsplan aktuell", labelEN: "Risk treatment plan current", category: "risk" },
  { id: "awareness", labelDE: "Awareness-Schulungen dokumentiert", labelEN: "Awareness training documented", category: "people" },
  { id: "evidence", labelDE: "Evidenz fuer implementierte Controls", labelEN: "Evidence for implemented controls", category: "controls" },
  { id: "policy_current", labelDE: "ISMS-Richtlinie aktuell (< 12 Monate)", labelEN: "ISMS policy current (< 12 months)", category: "documentation" },
  { id: "scope_defined", labelDE: "ISMS-Scope definiert", labelEN: "ISMS scope defined", category: "governance" },
];
