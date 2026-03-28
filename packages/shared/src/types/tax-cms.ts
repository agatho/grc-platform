// Sprint 74: Tax CMS und Financial Compliance Types

export type TaxCmsElementType = "culture" | "goals" | "risks" | "program" | "org_structure" | "communication" | "monitoring";
export type TaxCmsElementStatus = "not_started" | "in_progress" | "implemented" | "effective" | "needs_improvement";
export type TaxType = "corporate_tax" | "vat" | "trade_tax" | "withholding_tax" | "transfer_pricing" | "customs" | "payroll_tax" | "real_estate_tax";
export type TaxRiskCategory = "compliance" | "reporting" | "assessment" | "process" | "legal_change" | "interpretation";
export type TaxRiskStatus = "identified" | "assessed" | "treated" | "accepted" | "closed";
export type GobdDocumentType = "invoice" | "receipt" | "contract" | "correspondence" | "booking_record" | "tax_return" | "assessment_notice";
export type GobdArchiveStatus = "active" | "under_review" | "expired" | "destroyed";
export type IcfrControlType = "preventive" | "detective" | "corrective";
export type IcfrProcessArea = "revenue" | "procurement" | "payroll" | "financial_close" | "tax_reporting" | "treasury";
export type IcfrAssertion = "existence" | "completeness" | "valuation" | "rights" | "presentation";
export type IcfrFrequency = "daily" | "weekly" | "monthly" | "quarterly" | "annually";
export type IcfrAutomationLevel = "manual" | "semi_automated" | "automated";
export type IcfrTestResult = "effective" | "partially_effective" | "not_effective" | "not_tested";
export type TaxAuditType = "regular" | "special" | "follow_up" | "vat_audit" | "transfer_pricing";
export type TaxAuditPrepStatus = "preparation" | "active" | "fieldwork" | "closing" | "completed";

export interface TaxCmsElement {
  id: string;
  orgId: string;
  elementCode: string;
  elementNumber: number;
  name: string;
  description?: string;
  elementType: TaxCmsElementType;
  requirements: TaxCmsRequirement[];
  maturityLevel: number;
  maturityJustification?: string;
  responsibleId?: string;
  lastAssessedAt?: string;
  nextAssessmentDate?: string;
  status: TaxCmsElementStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaxCmsRequirement {
  requirementId: string;
  description: string;
  status: string;
  evidence: string;
}

export interface TaxRisk {
  id: string;
  orgId: string;
  riskCode: string;
  title: string;
  description?: string;
  taxType: TaxType;
  riskCategory: TaxRiskCategory;
  jurisdiction: string;
  affectedEntities: TaxAffectedEntity[];
  likelihood: string;
  financialExposure?: number;
  impact: string;
  riskLevel: string;
  treatmentStrategy?: string;
  treatmentPlan?: string;
  controls: TaxControl[];
  legalBasis?: string;
  hgb91Reference: boolean;
  ownerId?: string;
  reviewDate?: string;
  status: TaxRiskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaxAffectedEntity {
  entityId: string;
  entityName: string;
}

export interface TaxControl {
  controlId: string;
  description: string;
  effectiveness: string;
}

export interface TaxGobdArchive {
  id: string;
  orgId: string;
  archiveCode: string;
  documentTitle: string;
  documentType: GobdDocumentType;
  taxYear: number;
  retentionYears: number;
  retentionEndDate?: string;
  storageLocation?: string;
  hashValue?: string;
  originalFormat?: string;
  fileSize?: number;
  gobdCompliant: boolean;
  complianceChecks: Record<string, unknown>;
  archivedBy?: string;
  archivedAt?: string;
  lastAccessedAt?: string;
  status: GobdArchiveStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaxIcfrControl {
  id: string;
  orgId: string;
  controlCode: string;
  title: string;
  description?: string;
  controlType: IcfrControlType;
  processArea: IcfrProcessArea;
  assertion?: IcfrAssertion;
  frequency: IcfrFrequency;
  automationLevel: IcfrAutomationLevel;
  keyControl: boolean;
  idwPs340Ref?: string;
  testProcedure?: string;
  lastTestDate?: string;
  lastTestResult?: IcfrTestResult;
  ownerId?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaxAuditPrep {
  id: string;
  orgId: string;
  prepCode: string;
  title: string;
  auditType: TaxAuditType;
  taxYears: number[];
  taxTypes: string[];
  auditAuthority?: string;
  auditorName?: string;
  expectedStartDate?: string;
  actualStartDate?: string;
  endDate?: string;
  documentChecklist: TaxDocumentItem[];
  openItems: TaxOpenItem[];
  findings: TaxAuditFinding[];
  totalExposure?: number;
  coordinatorId?: string;
  status: TaxAuditPrepStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaxDocumentItem {
  document: string;
  required: boolean;
  provided: boolean;
  notes: string;
}

export interface TaxOpenItem {
  item: string;
  status: string;
  assignee: string;
  dueDate: string;
}

export interface TaxAuditFinding {
  finding: string;
  taxImpact: number;
  status: string;
}

export interface TaxCmsDashboard {
  totalElements: number;
  implementedElements: number;
  averageMaturity: number;
  totalTaxRisks: number;
  criticalRisks: number;
  gobdCompliantDocs: number;
  totalArchiveDocs: number;
  keyControlsEffective: number;
  totalKeyControls: number;
  activeAudits: number;
  totalExposure: number;
}
