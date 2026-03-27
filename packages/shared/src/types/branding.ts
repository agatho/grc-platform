// Sprint 13a: Branding & Dashboard Layout types

export type ReportTemplate = "standard" | "formal" | "minimal";

export interface OrgBranding {
  id: string;
  orgId: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  backgroundColor: string;
  darkModePrimaryColor: string | null;
  darkModeAccentColor: string | null;
  logoPath: string | null;
  faviconPath: string | null;
  reportTemplate: ReportTemplate;
  confidentialityNotice: string | null;
  customCss: string | null;
  inheritFromParent: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

export interface BrandingResponse {
  id?: string;
  orgId: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  backgroundColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  darkModePrimaryColor: string | null;
  darkModeAccentColor: string | null;
  reportTemplate: ReportTemplate;
  confidentialityNotice: string | null;
  inheritFromParent: boolean;
  isInherited: boolean;
  orgName: string;
  updatedAt: string;
}

export interface WidgetPosition {
  widgetId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
}

export interface DashboardLayoutResponse {
  id?: string;
  orgId?: string;
  userId?: string | null;
  layoutJson: WidgetPosition[];
  isDefault: boolean;
  isSystem: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface WidgetDefinition {
  id: string;
  name: string;
  icon: string;
  defaultW: number;
  defaultH: number;
  minW: number;
  minH: number;
}
