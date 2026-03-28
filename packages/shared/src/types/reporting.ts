// Sprint 30: Report Engine + Threat Landscape Dashboard Types

// ──────────────────────────────────────────────────────────────
// Report Module Scope
// ──────────────────────────────────────────────────────────────

export const reportModuleScopeValues = [
  "erm",
  "ics",
  "isms",
  "audit",
  "dpms",
  "esg",
  "bcms",
  "tprm",
  "all",
] as const;

export type ReportModuleScope = (typeof reportModuleScopeValues)[number];

// ──────────────────────────────────────────────────────────────
// Report Generation Status
// ──────────────────────────────────────────────────────────────

export const reportGenerationStatusValues = [
  "queued",
  "generating",
  "completed",
  "failed",
] as const;

export type ReportGenerationStatus =
  (typeof reportGenerationStatusValues)[number];

// ──────────────────────────────────────────────────────────────
// Report Output Format
// ──────────────────────────────────────────────────────────────

export const reportOutputFormatValues = ["pdf", "xlsx"] as const;
export type ReportOutputFormat = (typeof reportOutputFormatValues)[number];

// ──────────────────────────────────────────────────────────────
// Report Section Types
// ──────────────────────────────────────────────────────────────

export const reportSectionTypeValues = [
  "title",
  "text",
  "table",
  "chart",
  "kpi",
  "page_break",
] as const;

export type ReportSectionType = (typeof reportSectionTypeValues)[number];

// ──────────────────────────────────────────────────────────────
// Threat Feed Type
// ──────────────────────────────────────────────────────────────

export const threatFeedTypeValues = ["rss", "atom", "json"] as const;
export type ThreatFeedType = (typeof threatFeedTypeValues)[number];

// ──────────────────────────────────────────────────────────────
// Section Config Types
// ──────────────────────────────────────────────────────────────

export interface ReportSectionConfig {
  type: ReportSectionType;
  config: {
    text?: string;
    dataSource?: string;
    columns?: string[];
    chartType?: "bar" | "line" | "donut" | "heatmap";
    filters?: Record<string, string>;
    periodVariable?: string;
    label?: string;
    comparisonPeriod?: string;
  };
}

export interface ReportParameterDefinition {
  key: string;
  type: "daterange" | "select" | "text" | "date";
  label: string;
  required: boolean;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string;
}

export interface ReportBrandingConfig {
  logoUrl?: string;
  primaryColor?: string;
  footerText?: string;
  confidentiality?: string;
  showPageNumbers?: boolean;
  pageNumberPosition?: "left" | "center" | "right";
}

// ──────────────────────────────────────────────────────────────
// Entity Interfaces
// ──────────────────────────────────────────────────────────────

export interface ReportTemplate {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  moduleScope: ReportModuleScope;
  sectionsJson: ReportSectionConfig[];
  parametersJson: ReportParameterDefinition[];
  brandingJson: ReportBrandingConfig | null;
  isDefault: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportGenerationLog {
  id: string;
  orgId: string;
  templateId: string;
  status: ReportGenerationStatus;
  parametersJson: Record<string, unknown>;
  outputFormat: ReportOutputFormat;
  filePath: string | null;
  fileSize: number | null;
  generationTimeMs: number | null;
  error: string | null;
  generatedBy: string | null;
  scheduleId: string | null;
  createdAt: string;
  completedAt: string | null;
  templateName?: string;
}

export interface ReportSchedule {
  id: string;
  orgId: string;
  templateId: string;
  name: string | null;
  cronExpression: string;
  parametersJson: Record<string, unknown>;
  recipientEmails: string[];
  outputFormat: ReportOutputFormat;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  templateName?: string;
}

export interface ThreatFeedSource {
  id: string;
  orgId: string;
  name: string;
  feedUrl: string;
  feedType: ThreatFeedType;
  isActive: boolean;
  lastFetchAt: string | null;
  lastItemCount: number | null;
  createdAt: string;
}

export interface ThreatFeedItem {
  id: string;
  orgId: string;
  sourceId: string;
  title: string;
  description: string | null;
  link: string | null;
  publishedAt: string | null;
  guid: string | null;
  category: string | null;
  fetchedAt: string;
  sourceName?: string;
}

// ──────────────────────────────────────────────────────────────
// Threat Dashboard Types
// ──────────────────────────────────────────────────────────────

export interface ThreatDashboardKPIs {
  activeThreats: number;
  newCves7d: number;
  openIncidents: number;
  avgCvss: number;
  criticalCves: number;
  mitigatedThreatsMonth: number;
}

export interface ThreatHeatmapCell {
  threatCategory: string;
  assetTier: string;
  count: number;
  color: "white" | "yellow" | "orange" | "red";
}

export interface ThreatTrendPoint {
  month: string;
  newThreats: number;
  mitigatedThreats: number;
  cveCount: number;
  incidentCount: number;
}

export interface ThreatTopEntry {
  threatId: string;
  title: string;
  code: string | null;
  category: string | null;
  impactScore: number;
  affectedAssets: number;
  riskScenarioCount: number;
}

export interface ThreatControlCoverage {
  threatCategory: string;
  totalVulnerabilities: number;
  coveredVulnerabilities: number;
  coveragePercent: number;
}
