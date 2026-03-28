import { z } from "zod";

// Sprint 74: Tax CMS und Financial Compliance Zod Schemas

// ─── Tax CMS Element ────────────────────────────────────────

export const createTaxCmsElementSchema = z.object({
  elementCode: z.string().min(1).max(30),
  elementNumber: z.number().int().min(1).max(7),
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  elementType: z.enum(["culture", "goals", "risks", "program", "org_structure", "communication", "monitoring"]),
  requirements: z.array(z.object({ requirementId: z.string(), description: z.string(), status: z.string(), evidence: z.string().optional() })).max(50).optional(),
  maturityLevel: z.number().int().min(0).max(5).default(0),
  maturityJustification: z.string().max(5000).optional(),
  responsibleId: z.string().uuid().optional(),
  nextAssessmentDate: z.string().optional(),
});

export const updateTaxCmsElementSchema = createTaxCmsElementSchema.partial().extend({
  status: z.enum(["not_started", "in_progress", "implemented", "effective", "needs_improvement"]).optional(),
});

export const taxCmsElementQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  elementType: z.enum(["culture", "goals", "risks", "program", "org_structure", "communication", "monitoring"]).optional(),
  status: z.enum(["not_started", "in_progress", "implemented", "effective", "needs_improvement"]).optional(),
});

// ─── Tax Risk ───────────────────────────────────────────────

export const createTaxRiskSchema = z.object({
  riskCode: z.string().min(1).max(30),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  taxType: z.enum(["corporate_tax", "vat", "trade_tax", "withholding_tax", "transfer_pricing", "customs", "payroll_tax", "real_estate_tax"]),
  riskCategory: z.enum(["compliance", "reporting", "assessment", "process", "legal_change", "interpretation"]),
  jurisdiction: z.string().min(1).max(100),
  affectedEntities: z.array(z.object({ entityId: z.string(), entityName: z.string() })).max(50).optional(),
  likelihood: z.enum(["very_low", "low", "medium", "high", "very_high"]),
  financialExposure: z.number().min(0).optional(),
  impact: z.enum(["very_low", "low", "medium", "high", "very_high"]),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  treatmentStrategy: z.enum(["mitigate", "accept", "transfer", "avoid"]).optional(),
  treatmentPlan: z.string().max(5000).optional(),
  controls: z.array(z.object({ controlId: z.string(), description: z.string(), effectiveness: z.string() })).max(50).optional(),
  legalBasis: z.string().max(1000).optional(),
  hgb91Reference: z.boolean().default(false),
  ownerId: z.string().uuid().optional(),
  reviewDate: z.string().optional(),
});

export const updateTaxRiskSchema = createTaxRiskSchema.partial().extend({
  status: z.enum(["identified", "assessed", "treated", "accepted", "closed"]).optional(),
});

export const taxRiskQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  taxType: z.enum(["corporate_tax", "vat", "trade_tax", "withholding_tax", "transfer_pricing", "customs", "payroll_tax", "real_estate_tax"]).optional(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z.enum(["identified", "assessed", "treated", "accepted", "closed"]).optional(),
  jurisdiction: z.string().max(100).optional(),
});

// ─── GoBD Archive ───────────────────────────────────────────

export const createTaxGobdArchiveSchema = z.object({
  archiveCode: z.string().min(1).max(30),
  documentTitle: z.string().min(1).max(500),
  documentType: z.enum(["invoice", "receipt", "contract", "correspondence", "booking_record", "tax_return", "assessment_notice"]),
  taxYear: z.number().int().min(1990).max(2100),
  retentionYears: z.number().int().min(1).max(30).default(10),
  storageLocation: z.string().max(500).optional(),
  originalFormat: z.string().max(50).optional(),
  fileSize: z.number().int().min(0).optional(),
});

export const updateTaxGobdArchiveSchema = z.object({
  gobdCompliant: z.boolean().optional(),
  complianceChecks: z.record(z.unknown()).optional(),
  status: z.enum(["active", "under_review", "expired", "destroyed"]).optional(),
});

export const taxGobdQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  documentType: z.enum(["invoice", "receipt", "contract", "correspondence", "booking_record", "tax_return", "assessment_notice"]).optional(),
  taxYear: z.coerce.number().int().optional(),
  gobdCompliant: z.coerce.boolean().optional(),
  status: z.enum(["active", "under_review", "expired", "destroyed"]).optional(),
});

// ─── ICFR Control ───────────────────────────────────────────

export const createTaxIcfrControlSchema = z.object({
  controlCode: z.string().min(1).max(30),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  controlType: z.enum(["preventive", "detective", "corrective"]),
  processArea: z.enum(["revenue", "procurement", "payroll", "financial_close", "tax_reporting", "treasury"]),
  assertion: z.enum(["existence", "completeness", "valuation", "rights", "presentation"]).optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "annually"]),
  automationLevel: z.enum(["manual", "semi_automated", "automated"]),
  keyControl: z.boolean().default(false),
  idwPs340Ref: z.string().max(100).optional(),
  testProcedure: z.string().max(5000).optional(),
  ownerId: z.string().uuid().optional(),
});

export const updateTaxIcfrControlSchema = createTaxIcfrControlSchema.partial().extend({
  lastTestResult: z.enum(["effective", "partially_effective", "not_effective", "not_tested"]).optional(),
  status: z.enum(["active", "inactive", "under_review", "remediation"]).optional(),
});

export const taxIcfrQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  processArea: z.enum(["revenue", "procurement", "payroll", "financial_close", "tax_reporting", "treasury"]).optional(),
  keyControl: z.coerce.boolean().optional(),
  controlType: z.enum(["preventive", "detective", "corrective"]).optional(),
  status: z.enum(["active", "inactive", "under_review", "remediation"]).optional(),
});

// ─── Tax Audit Prep ─────────────────────────────────────────

export const createTaxAuditPrepSchema = z.object({
  prepCode: z.string().min(1).max(30),
  title: z.string().min(1).max(500),
  auditType: z.enum(["regular", "special", "follow_up", "vat_audit", "transfer_pricing"]),
  taxYears: z.array(z.number().int()).max(10).optional(),
  taxTypes: z.array(z.string().max(50)).max(10).optional(),
  auditAuthority: z.string().max(200).optional(),
  auditorName: z.string().max(200).optional(),
  expectedStartDate: z.string().optional(),
  coordinatorId: z.string().uuid().optional(),
});

export const updateTaxAuditPrepSchema = createTaxAuditPrepSchema.partial().extend({
  documentChecklist: z.array(z.object({ document: z.string(), required: z.boolean(), provided: z.boolean(), notes: z.string().optional() })).max(100).optional(),
  openItems: z.array(z.object({ item: z.string(), status: z.string(), assignee: z.string(), dueDate: z.string() })).max(100).optional(),
  findings: z.array(z.object({ finding: z.string(), taxImpact: z.number(), status: z.string() })).max(100).optional(),
  totalExposure: z.number().min(0).optional(),
  status: z.enum(["preparation", "active", "fieldwork", "closing", "completed"]).optional(),
});

export const taxAuditPrepQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  auditType: z.enum(["regular", "special", "follow_up", "vat_audit", "transfer_pricing"]).optional(),
  status: z.enum(["preparation", "active", "fieldwork", "closing", "completed"]).optional(),
});
