// Catalog & Framework Layer types (Sprint 4b)
export type CatalogObjectType = "it_system" | "application" | "role" | "department" | "location" | "vendor" | "standard" | "regulation" | "custom";
export type MethodologyType = "iso_31000" | "coso_erm" | "fair" | "custom";
export type EnforcementLevel = "optional" | "recommended" | "mandatory";

export interface RiskCatalog {
  id: string;
  name: string;
  description?: string;
  version?: string;
  source: string;
  language: string;
  entryCount: number;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RiskCatalogEntry {
  id: string;
  catalogId: string;
  parentEntryId?: string;
  code: string;
  titleDe: string;
  titleEn?: string;
  descriptionDe?: string;
  descriptionEn?: string;
  level: number;
  riskCategory?: string;
  defaultLikelihood?: number;
  defaultImpact?: number;
  sortOrder: number;
  isActive: boolean;
  metadataJson?: unknown;
  createdAt: string;
}

export interface ControlCatalog {
  id: string;
  name: string;
  description?: string;
  version?: string;
  source: string;
  language: string;
  entryCount: number;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ControlCatalogEntry {
  id: string;
  catalogId: string;
  parentEntryId?: string;
  code: string;
  titleDe: string;
  titleEn?: string;
  descriptionDe?: string;
  descriptionEn?: string;
  implementationDe?: string;
  implementationEn?: string;
  level: number;
  controlType?: string;
  defaultFrequency?: string;
  sortOrder: number;
  isActive: boolean;
  metadataJson?: unknown;
  createdAt: string;
}

export interface GeneralCatalogEntry {
  id: string;
  orgId: string;
  objectType: CatalogObjectType;
  name: string;
  description?: string;
  status: string;
  lifecycleStart?: string;
  lifecycleEnd?: string;
  ownerId?: string;
  metadataJson?: unknown;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  deletedAt?: string;
  deletedBy?: string;
}

export interface OrgRiskMethodology {
  id: string;
  orgId: string;
  methodology: string;
  matrixSize: number;
  fairCurrency: string;
  fairSimulationRuns: number;
  riskAppetiteThreshold?: number;
  customLabelsJson?: unknown;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface CatalogLifecyclePhase {
  id: string;
  orgId: string;
  entityType: string;
  entityId: string;
  phaseName: string;
  startDate: string;
  endDate?: string;
  notes?: string;
  createdAt: string;
}

// FAIRInput and FAIRResult are defined in fair-simulation.ts and re-exported via index.ts
