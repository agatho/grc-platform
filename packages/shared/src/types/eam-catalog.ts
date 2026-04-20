// Sprint 52: EAM UX & Unified Catalog types

export type EamCatalogObjectType =
  | "application"
  | "business_capability"
  | "it_component"
  | "data_object"
  | "provider"
  | "interface";
export type CatalogTab = "list" | "dashboard" | "lifecycle" | "eam_dashboard";
export type EamWidgetType =
  | "donut_category"
  | "donut_lifecycle"
  | "donut_fit"
  | "capability_map"
  | "context_diagram"
  | "health_score"
  | "cost_summary"
  | "risk_count"
  | "cve_count"
  | "keyword_cloud"
  | "recent_changes"
  | "lifecycle_countdown";

export interface CatalogFilters {
  objectTypes: EamCatalogObjectType[];
  search?: string;
  keywords?: string[];
  lifecycleStatus?: string[];
  category?: string[];
  manufacturer?: string[];
  functionalFit?: string[];
  technicalFit?: string[];
  businessCriticality?: string[];
  personalDataProcessing?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  objectType: EamCatalogObjectType;
  keywords: string[];
  lifecycleStatus: string | null;
  category: string | null;
  manufacturer: string | null;
  functionalFit: string | null;
  technicalFit: string | null;
  businessCriticality: string | null;
  annualCost: number | null;
  governanceStatus: string | null;
  updatedAt: string;
}

export interface CatalogResult {
  items: CatalogItem[];
  total: number;
  facets: CatalogFacet[];
}

export interface CatalogFacet {
  field: string;
  values: FacetValue[];
}

export interface FacetValue {
  value: string;
  count: number;
}

export interface EamKeyword {
  id: string;
  orgId: string;
  name: string;
  parentId: string | null;
  usageCount: number;
  children?: EamKeyword[];
}

export interface HomepageLayout {
  id: string;
  userId: string;
  orgId: string;
  widgetConfig: HomepageWidget[];
  updatedAt: string;
}

export interface HomepageWidget {
  widgetType: EamWidgetType;
  position: { x: number; y: number; w: number; h: number };
  config?: Record<string, unknown>;
}

export interface EamWidgetDefinition {
  type: EamWidgetType;
  label: string;
  description: string;
  defaultSize: { w: number; h: number };
  category: string;
}

export interface CatalogDashboardData {
  donuts: CatalogDonut[];
  totalItems: number;
}

export interface CatalogDonut {
  field: string;
  label: string;
  entries: FacetValue[];
}
