# ARCTOS — Technical Specification: ICS + DMS Module

Sprint 4 — Internal Control System + Document Management
Complete implementation guide for Claude Code

---

# 1. Drizzle Schema — `packages/db/src/schema/control.ts`

```typescript
import {
  pgTable, pgEnum, uuid, varchar, text, integer, decimal,
  boolean, date, timestamp, index, uniqueIndex, jsonb
} from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { organizations } from './organization';
import { users } from './user';
import { risks } from './risk';
import { processes, processSteps } from './process';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const controlTypeEnum = pgEnum('control_type', [
  'preventive', 'detective', 'corrective'
]);

export const controlFreqEnum = pgEnum('control_freq', [
  'event_driven', 'continuous', 'daily', 'weekly', 'monthly', 'quarterly', 'annually', 'ad_hoc'
]);

export const automationLevelEnum = pgEnum('automation_level', [
  'manual', 'semi_automated', 'fully_automated'
]);

export const lineOfDefenseEnum = pgEnum('line_of_defense', [
  'first', 'second', 'third'
]);

export const controlStatusEnum = pgEnum('control_status', [
  'designed', 'implemented', 'effective', 'ineffective', 'retired'
]);

export const controlAssertionEnum = pgEnum('control_assertion', [
  'completeness', 'accuracy', 'obligations_and_rights', 'fraud_prevention',
  'existence', 'valuation', 'presentation', 'safeguarding_of_assets'
]);

export const testTypeEnum = pgEnum('test_type', [
  'design_effectiveness', 'operating_effectiveness'
]);

export const testResultEnum = pgEnum('test_result', [
  'effective', 'ineffective', 'partially_effective', 'not_tested'
]);

export const testStatusEnum = pgEnum('test_status', [
  'planned', 'in_progress', 'completed', 'cancelled'
]);

export const campaignStatusEnum = pgEnum('campaign_status', [
  'draft', 'active', 'completed', 'cancelled'
]);

export const findingSeverityEnum = pgEnum('finding_severity', [
  'observation', 'recommendation', 'improvement_requirement',
  'insignificant_nonconformity', 'significant_nonconformity'
]);

export const findingStatusEnum = pgEnum('finding_status', [
  'identified', 'in_remediation', 'remediated', 'verified', 'accepted', 'closed'
]);

export const findingSourceEnum = pgEnum('finding_source', [
  'control_test', 'audit', 'incident', 'self_assessment', 'external'
]);

export const evidenceCategoryEnum = pgEnum('evidence_category', [
  'screenshot', 'document', 'log_export', 'email', 'certificate',
  'report', 'photo', 'config_export', 'other'
]);

// ─── Cross-cutting helper ────────────────────────────────────────────────────

const crossCutting = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedBy: uuid('updated_by').references(() => users.id),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  deletedBy: uuid('deleted_by').references(() => users.id),
};

// ─── control ─────────────────────────────────────────────────────────────────

export const controls = pgTable('control', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  controlType: controlTypeEnum('control_type').notNull(),
  frequency: controlFreqEnum('frequency').notNull().default('monthly'),
  automationLevel: automationLevelEnum('automation_level').notNull().default('manual'),
  lineOfDefense: lineOfDefenseEnum('line_of_defense'),
  ownerId: uuid('owner_id').references(() => users.id),
  status: controlStatusEnum('status').notNull().default('designed'),
  assertions: controlAssertionEnum('assertions').array().default([]),
  lastTestedAt: timestamp('last_tested_at', { withTimezone: true, mode: 'string' }),
  workItemId: uuid('work_item_id'),  // FK to work_item (Sprint 1.4)
  ...crossCutting,
}, (t) => ({
  orgIdx: index('control_org_idx').on(t.orgId),
  statusIdx: index('control_status_idx').on(t.orgId, t.status),
  ownerIdx: index('control_owner_idx').on(t.orgId, t.ownerId),
  typeIdx: index('control_type_idx').on(t.orgId, t.controlType),
}));

export type Control = InferSelectModel<typeof controls>;
export type NewControl = InferInsertModel<typeof controls>;

// ─── control_test_campaign ───────────────────────────────────────────────────

export const controlTestCampaigns = pgTable('control_test_campaign', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  name: varchar('name', { length: 500 }).notNull(),
  description: text('description'),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  status: campaignStatusEnum('status').notNull().default('draft'),
  ...crossCutting,
}, (t) => ({
  orgIdx: index('campaign_org_idx').on(t.orgId),
  statusIdx: index('campaign_status_idx').on(t.orgId, t.status),
}));

export type ControlTestCampaign = InferSelectModel<typeof controlTestCampaigns>;
export type NewControlTestCampaign = InferInsertModel<typeof controlTestCampaigns>;

// ─── control_test ────────────────────────────────────────────────────────────

export const controlTests = pgTable('control_test', {
  id: uuid('id').primaryKey().defaultRandom(),
  controlId: uuid('control_id').notNull().references(() => controls.id),
  campaignId: uuid('campaign_id').references(() => controlTestCampaigns.id),
  testType: testTypeEnum('test_type').notNull(),
  description: text('description'),
  testerId: uuid('tester_id').references(() => users.id),
  plannedDate: date('planned_date'),
  executedDate: date('executed_date'),
  // K-NEW-01: Separate ToD/ToE results
  todResult: testResultEnum('tod_result').notNull().default('not_tested'),
  toeResult: testResultEnum('toe_result').notNull().default('not_tested'),
  todNotes: text('tod_notes'),
  toeNotes: text('toe_notes'),
  // Computed overall result
  result: testResultEnum('result').notNull().default('not_tested'),
  notes: text('notes'),
  status: testStatusEnum('status').notNull().default('planned'),
  taskId: uuid('task_id'),  // FK to task (Sprint 1.2)
  ...crossCutting,
}, (t) => ({
  controlIdx: index('test_control_idx').on(t.controlId),
  campaignIdx: index('test_campaign_idx').on(t.campaignId),
  testerIdx: index('test_tester_idx').on(t.testerId),
  statusIdx: index('test_status_idx').on(t.status),
}));

export type ControlTest = InferSelectModel<typeof controlTests>;
export type NewControlTest = InferInsertModel<typeof controlTests>;

// ─── evidence (universal) ────────────────────────────────────────────────────

export const evidence = pgTable('evidence', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  category: evidenceCategoryEnum('category').notNull().default('other'),
  filePath: varchar('file_path', { length: 1000 }),
  fileName: varchar('file_name', { length: 255 }),
  fileType: varchar('file_type', { length: 50 }),
  fileSizeBytes: integer('file_size_bytes'),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  validFrom: date('valid_from'),
  validUntil: date('valid_until'),
  notes: text('notes'),
  ...crossCutting,
}, (t) => ({
  entityIdx: index('evidence_entity_idx').on(t.entityType, t.entityId),
  orgIdx: index('evidence_org_idx').on(t.orgId),
}));

export type Evidence = InferSelectModel<typeof evidence>;
export type NewEvidence = InferInsertModel<typeof evidence>;

// ─── finding ─────────────────────────────────────────────────────────────────

export const findings = pgTable('finding', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  severity: findingSeverityEnum('severity').notNull(),
  source: findingSourceEnum('source').notNull().default('control_test'),
  status: findingStatusEnum('status').notNull().default('identified'),
  controlId: uuid('control_id').references(() => controls.id),
  controlTestId: uuid('control_test_id').references(() => controlTests.id),
  riskId: uuid('risk_id').references(() => risks.id),
  rootCause: text('root_cause'),
  remediationPlan: text('remediation_plan'),
  responsibleId: uuid('responsible_id').references(() => users.id),
  dueDate: date('due_date'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'string' }),
  verifiedBy: uuid('verified_by').references(() => users.id),
  verifiedAt: timestamp('verified_at', { withTimezone: true, mode: 'string' }),
  justification: text('justification'),
  workItemId: uuid('work_item_id'),  // FK to work_item (Sprint 1.4)
  taskId: uuid('task_id'),  // FK to task (Sprint 1.2)
  ...crossCutting,
}, (t) => ({
  orgIdx: index('finding_org_idx').on(t.orgId),
  severityIdx: index('finding_severity_idx').on(t.orgId, t.severity),
  statusIdx: index('finding_status_idx').on(t.orgId, t.status),
  controlIdx: index('finding_control_idx').on(t.controlId),
  responsibleIdx: index('finding_responsible_idx').on(t.responsibleId),
}));

export type Finding = InferSelectModel<typeof findings>;
export type NewFinding = InferInsertModel<typeof findings>;

// ─── risk_control (RCM — enhanced from Sprint 2 placeholder) ────────────────

export const riskControls = pgTable('risk_control', {
  id: uuid('id').primaryKey().defaultRandom(),
  riskId: uuid('risk_id').notNull().references(() => risks.id),
  controlId: uuid('control_id').notNull().references(() => controls.id),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  coverageDescription: text('coverage_description'),
  effectivenessRating: varchar('effectiveness_rating', { length: 20 }).notNull().default('none'),
  ...crossCutting,
}, (t) => ({
  riskControlUnique: uniqueIndex('risk_control_unique').on(t.riskId, t.controlId),
  riskIdx: index('rc_risk_idx').on(t.riskId),
  controlIdx: index('rc_control_idx').on(t.controlId),
  orgIdx: index('rc_org_idx').on(t.orgId),
}));

export type RiskControl = InferSelectModel<typeof riskControls>;
export type NewRiskControl = InferInsertModel<typeof riskControls>;

// ─── process_control (Level 2 linkage) ───────────────────────────────────────

export const processControls = pgTable('process_control', {
  id: uuid('id').primaryKey().defaultRandom(),
  processId: uuid('process_id').notNull().references(() => processes.id),
  controlId: uuid('control_id').notNull().references(() => controls.id),
  controlContext: text('control_context'),
  ...crossCutting,
}, (t) => ({
  processControlUnique: uniqueIndex('process_control_unique').on(t.processId, t.controlId),
}));

// ─── process_step_control (Level 3 linkage) ──────────────────────────────────

export const processStepControls = pgTable('process_step_control', {
  id: uuid('id').primaryKey().defaultRandom(),
  processStepId: uuid('process_step_id').notNull().references(() => processSteps.id),
  controlId: uuid('control_id').notNull().references(() => controls.id),
  controlContext: text('control_context'),
  ...crossCutting,
}, (t) => ({
  stepControlUnique: uniqueIndex('process_step_control_unique').on(t.processStepId, t.controlId),
}));

// ─── Relations ───────────────────────────────────────────────────────────────

export const controlRelations = relations(controls, ({ one, many }) => ({
  organization: one(organizations, { fields: [controls.orgId], references: [organizations.id] }),
  owner: one(users, { fields: [controls.ownerId], references: [users.id] }),
  tests: many(controlTests),
  findings: many(findings),
  riskControls: many(riskControls),
  processControls: many(processControls),
  processStepControls: many(processStepControls),
}));

export const controlTestRelations = relations(controlTests, ({ one }) => ({
  control: one(controls, { fields: [controlTests.controlId], references: [controls.id] }),
  campaign: one(controlTestCampaigns, { fields: [controlTests.campaignId], references: [controlTestCampaigns.id] }),
  tester: one(users, { fields: [controlTests.testerId], references: [users.id] }),
}));

export const findingRelations = relations(findings, ({ one }) => ({
  organization: one(organizations, { fields: [findings.orgId], references: [organizations.id] }),
  control: one(controls, { fields: [findings.controlId], references: [controls.id] }),
  controlTest: one(controlTests, { fields: [findings.controlTestId], references: [controlTests.id] }),
  risk: one(risks, { fields: [findings.riskId], references: [risks.id] }),
  responsible: one(users, { fields: [findings.responsibleId], references: [users.id] }),
  verifier: one(users, { fields: [findings.verifiedBy], references: [users.id] }),
}));

export const riskControlRelations = relations(riskControls, ({ one }) => ({
  risk: one(risks, { fields: [riskControls.riskId], references: [risks.id] }),
  control: one(controls, { fields: [riskControls.controlId], references: [controls.id] }),
}));
```

# 1b. Drizzle Schema — `packages/db/src/schema/document.ts`

```typescript
import {
  pgTable, pgEnum, uuid, varchar, text, integer,
  boolean, date, timestamp, index, uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { organizations } from './organization';
import { users } from './user';
import { sql } from 'drizzle-orm';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const documentCategoryEnum = pgEnum('document_category', [
  'policy', 'procedure', 'guideline', 'template', 'record',
  'tom', 'dpa', 'bcp', 'soa', 'other'
]);

export const documentStatusEnum = pgEnum('document_status', [
  'draft', 'in_review', 'approved', 'published', 'archived', 'expired'
]);

// ─── Cross-cutting helper ────────────────────────────────────────────────────

const crossCutting = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedBy: uuid('updated_by').references(() => users.id),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  deletedBy: uuid('deleted_by').references(() => users.id),
};

// ─── document ────────────────────────────────────────────────────────────────

export const documents = pgTable('document', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  title: varchar('title', { length: 500 }).notNull(),
  category: documentCategoryEnum('category').notNull().default('other'),
  content: text('content'),
  filePath: varchar('file_path', { length: 1000 }),
  status: documentStatusEnum('status').notNull().default('draft'),
  currentVersion: integer('current_version').notNull().default(1),
  ownerId: uuid('owner_id').references(() => users.id),
  reviewerId: uuid('reviewer_id').references(() => users.id),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at', { withTimezone: true, mode: 'string' }),
  publishedAt: timestamp('published_at', { withTimezone: true, mode: 'string' }),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
  requiresAcknowledgment: boolean('requires_acknowledgment').notNull().default(false),
  tags: text('tags').array().default([]),
  // Full-text search vector (GENERATED column defined in migration SQL)
  // searchVector: tsvector — not directly in Drizzle, see migration
  workItemId: uuid('work_item_id'),
  ...crossCutting,
}, (t) => ({
  orgIdx: index('document_org_idx').on(t.orgId),
  statusIdx: index('document_status_idx').on(t.orgId, t.status),
  categoryIdx: index('document_category_idx').on(t.orgId, t.category),
  ownerIdx: index('document_owner_idx').on(t.orgId, t.ownerId),
  expiresIdx: index('document_expires_idx').on(t.expiresAt),
}));

export type Document = InferSelectModel<typeof documents>;
export type NewDocument = InferInsertModel<typeof documents>;

// ─── document_version ────────────────────────────────────────────────────────

export const documentVersions = pgTable('document_version', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => documents.id),
  versionNumber: integer('version_number').notNull(),
  content: text('content'),
  changeSummary: text('change_summary'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  docVersionUnique: uniqueIndex('doc_version_unique').on(t.documentId, t.versionNumber),
  docIdx: index('docversion_doc_idx').on(t.documentId),
}));

export type DocumentVersion = InferSelectModel<typeof documentVersions>;
export type NewDocumentVersion = InferInsertModel<typeof documentVersions>;

// ─── acknowledgment ──────────────────────────────────────────────────────────

export const acknowledgments = pgTable('acknowledgment', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  documentId: uuid('document_id').notNull().references(() => documents.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  versionAcknowledged: integer('version_acknowledged').notNull(),
}, (t) => ({
  docUserVersionUnique: uniqueIndex('ack_doc_user_version_unique').on(t.documentId, t.userId, t.versionAcknowledged),
  docIdx: index('ack_doc_idx').on(t.documentId),
  userIdx: index('ack_user_idx').on(t.userId),
  orgIdx: index('ack_org_idx').on(t.orgId),
}));

export type Acknowledgment = InferSelectModel<typeof acknowledgments>;
export type NewAcknowledgment = InferInsertModel<typeof acknowledgments>;

// ─── document_entity_link ────────────────────────────────────────────────────

export const documentEntityLinks = pgTable('document_entity_link', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => documents.id),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  linkDescription: text('link_description'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  docEntityUnique: uniqueIndex('doc_entity_unique').on(t.documentId, t.entityType, t.entityId),
  docIdx: index('doclink_doc_idx').on(t.documentId),
  entityIdx: index('doclink_entity_idx').on(t.entityType, t.entityId),
}));

export type DocumentEntityLink = InferSelectModel<typeof documentEntityLinks>;
export type NewDocumentEntityLink = InferInsertModel<typeof documentEntityLinks>;

// ─── Relations ───────────────────────────────────────────────────────────────

export const documentRelations = relations(documents, ({ one, many }) => ({
  organization: one(organizations, { fields: [documents.orgId], references: [organizations.id] }),
  owner: one(users, { fields: [documents.ownerId], references: [users.id] }),
  reviewer: one(users, { fields: [documents.reviewerId], references: [users.id] }),
  approver: one(users, { fields: [documents.approvedBy], references: [users.id] }),
  versions: many(documentVersions),
  acknowledgments: many(acknowledgments),
  entityLinks: many(documentEntityLinks),
}));

export const documentVersionRelations = relations(documentVersions, ({ one }) => ({
  document: one(documents, { fields: [documentVersions.documentId], references: [documents.id] }),
  author: one(users, { fields: [documentVersions.createdBy], references: [users.id] }),
}));

export const acknowledgmentRelations = relations(acknowledgments, ({ one }) => ({
  document: one(documents, { fields: [acknowledgments.documentId], references: [documents.id] }),
  user: one(users, { fields: [acknowledgments.userId], references: [users.id] }),
}));
```

---

# 2. Zod Validation Schemas — `packages/shared/src/schemas/control.ts`

```typescript
import { z } from 'zod';

// ─── Control enums as Zod ────────────────────────────────────────────────────

export const controlType = z.enum(['preventive', 'detective', 'corrective']);
export const controlFreq = z.enum(['event_driven', 'continuous', 'daily', 'weekly', 'monthly', 'quarterly', 'annually', 'ad_hoc']);
export const automationLevel = z.enum(['manual', 'semi_automated', 'fully_automated']);
export const lineOfDefense = z.enum(['first', 'second', 'third']);
export const controlStatus = z.enum(['designed', 'implemented', 'effective', 'ineffective', 'retired']);
export const controlAssertion = z.enum([
  'completeness', 'accuracy', 'obligations_and_rights', 'fraud_prevention',
  'existence', 'valuation', 'presentation', 'safeguarding_of_assets'
]);

export const testType = z.enum(['design_effectiveness', 'operating_effectiveness']);
export const testResult = z.enum(['effective', 'ineffective', 'partially_effective', 'not_tested']);
export const testStatus = z.enum(['planned', 'in_progress', 'completed', 'cancelled']);
export const campaignStatus = z.enum(['draft', 'active', 'completed', 'cancelled']);

export const findingSeverity = z.enum([
  'observation', 'recommendation', 'improvement_requirement',
  'insignificant_nonconformity', 'significant_nonconformity'
]);
export const findingStatus = z.enum([
  'identified', 'in_remediation', 'remediated', 'verified', 'accepted', 'closed'
]);
export const findingSource = z.enum(['control_test', 'audit', 'incident', 'self_assessment', 'external']);

export const evidenceCategory = z.enum([
  'screenshot', 'document', 'log_export', 'email', 'certificate',
  'report', 'photo', 'config_export', 'other'
]);

export const effectivenessRating = z.enum(['full', 'partial', 'planned', 'none']);

// ─── Create Control ──────────────────────────────────────────────────────────

export const createControlSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  controlType: controlType,
  frequency: controlFreq.default('monthly'),
  automationLevel: automationLevel.default('manual'),
  lineOfDefense: lineOfDefense.optional(),
  ownerId: z.string().uuid().optional(),
  assertions: z.array(controlAssertion).default([]),
});

export const updateControlSchema = createControlSchema.partial();

// ─── Control Status Transition ───────────────────────────────────────────────

export const controlStatusTransitionSchema = z.object({
  status: controlStatus,
  notes: z.string().optional(),
});

export const VALID_CONTROL_TRANSITIONS: Record<string, string[]> = {
  designed: ['implemented'],
  implemented: ['effective', 'ineffective'],
  effective: ['ineffective', 'retired'],
  ineffective: ['effective', 'retired'],
  retired: ['designed'],  // reopen
};

export function isValidControlStatusTransition(from: string, to: string): boolean {
  if (to === 'designed') return true;  // reopen always allowed
  return VALID_CONTROL_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Control List Query ──────────────────────────────────────────────────────

export const controlListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  status: z.array(controlStatus).optional(),
  controlType: z.array(controlType).optional(),
  frequency: z.array(controlFreq).optional(),
  automationLevel: z.array(automationLevel).optional(),
  lineOfDefense: z.array(lineOfDefense).optional(),
  ownerId: z.string().uuid().optional(),
  assertions: z.array(controlAssertion).optional(),
  showDeleted: z.coerce.boolean().default(false),
  sortBy: z.enum(['title', 'status', 'lastTestedAt', 'createdAt']).default('title'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// ─── Create Campaign ─────────────────────────────────────────────────────────

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(500),
  description: z.string().optional(),
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  controlIds: z.array(z.string().uuid()).min(1),
});

// ─── Execute Control Test ────────────────────────────────────────────────────

export const executeTestSchema = z.object({
  todResult: testResult.optional(),
  toeResult: testResult.optional(),
  todNotes: z.string().optional(),
  toeNotes: z.string().optional(),
  notes: z.string().optional(),
  executedDate: z.string().date().optional(),
});

// ─── Create Finding ──────────────────────────────────────────────────────────

export const createFindingSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  severity: findingSeverity,
  source: findingSource.default('control_test'),
  controlId: z.string().uuid().optional(),
  controlTestId: z.string().uuid().optional(),
  riskId: z.string().uuid().optional(),
  rootCause: z.string().optional(),
  remediationPlan: z.string().optional(),
  responsibleId: z.string().uuid().optional(),
  dueDate: z.string().date().optional(),
});

export const updateFindingSchema = createFindingSchema.partial();

// ─── Finding Status Transition ───────────────────────────────────────────────

export const findingStatusTransitionSchema = z.object({
  status: findingStatus,
  notes: z.string().optional(),
  justification: z.string().min(50).optional(),  // required for 'accepted' status
});

export const VALID_FINDING_TRANSITIONS: Record<string, string[]> = {
  identified: ['in_remediation', 'accepted'],
  in_remediation: ['remediated'],
  remediated: ['verified'],
  verified: ['closed'],
  accepted: ['closed'],
  closed: ['identified'],  // reopen
};

export function isValidFindingStatusTransition(from: string, to: string): boolean {
  if (to === 'identified') return true;  // reopen always allowed
  return VALID_FINDING_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── RCM Link ────────────────────────────────────────────────────────────────

export const createRiskControlLinkSchema = z.object({
  riskId: z.string().uuid().optional(),
  controlId: z.string().uuid().optional(),
  coverageDescription: z.string().optional(),
  effectivenessRating: effectivenessRating.default('none'),
});

// ─── Evidence Upload ─────────────────────────────────────────────────────────

export const createEvidenceSchema = z.object({
  entityType: z.string().min(1).max(100),
  entityId: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  category: evidenceCategory.default('other'),
  validFrom: z.string().date().optional(),
  validUntil: z.string().date().optional(),
  notes: z.string().optional(),
});
```

## 2b. `packages/shared/src/schemas/document.ts`

```typescript
import { z } from 'zod';

export const documentCategory = z.enum([
  'policy', 'procedure', 'guideline', 'template', 'record',
  'tom', 'dpa', 'bcp', 'soa', 'other'
]);

export const documentStatus = z.enum([
  'draft', 'in_review', 'approved', 'published', 'archived', 'expired'
]);

// ─── Create Document ─────────────────────────────────────────────────────────

export const createDocumentSchema = z.object({
  title: z.string().min(1).max(500),
  category: documentCategory.default('other'),
  content: z.string().optional(),
  ownerId: z.string().uuid().optional(),
  reviewerId: z.string().uuid().optional(),
  requiresAcknowledgment: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  expiresAt: z.string().datetime().optional(),
});

export const updateDocumentSchema = createDocumentSchema.partial().extend({
  content: z.string().optional(),
  changeSummary: z.string().optional(),
});

// ─── Document Status Transition ──────────────────────────────────────────────

export const documentStatusTransitionSchema = z.object({
  status: documentStatus,
  notes: z.string().optional(),
});

export const VALID_DOCUMENT_TRANSITIONS: Record<string, string[]> = {
  draft: ['in_review'],
  in_review: ['approved', 'draft'],  // approve or reject
  approved: ['published'],
  published: ['archived', 'draft'],  // archive or start new version
  archived: [],
  expired: [],
};

export function isValidDocumentStatusTransition(from: string, to: string): boolean {
  if (to === 'expired') return true;  // system or manual
  return VALID_DOCUMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Document List Query ─────────────────────────────────────────────────────

export const documentListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  status: z.array(documentStatus).optional(),
  category: z.array(documentCategory).optional(),
  ownerId: z.string().uuid().optional(),
  requiresAcknowledgment: z.coerce.boolean().optional(),
  expired: z.coerce.boolean().optional(),
  tags: z.array(z.string()).optional(),
  sortBy: z.enum(['title', 'status', 'publishedAt', 'expiresAt', 'createdAt']).default('title'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// ─── Version Restore ─────────────────────────────────────────────────────────

export const restoreVersionSchema = z.object({
  versionNumber: z.number().int().positive(),
});

// ─── Entity Link ─────────────────────────────────────────────────────────────

export const createDocumentEntityLinkSchema = z.object({
  entityType: z.enum(['risk', 'control', 'process', 'requirement', 'finding', 'audit']),
  entityId: z.string().uuid(),
  linkDescription: z.string().optional(),
});

// ─── Full-text Search ────────────────────────────────────────────────────────

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  scope: z.enum(['documents', 'controls', 'risks', 'all']).default('all'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  category: z.array(documentCategory).optional(),
  status: z.array(documentStatus).optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
});
```

---

# 3. TypeScript Types — `packages/shared/src/types/control.ts`

```typescript
import type { Control, ControlTest, ControlTestCampaign, Finding, Evidence, RiskControl } from '@arctos/db/schema/control';
import type { Document, DocumentVersion, Acknowledgment, DocumentEntityLink } from '@arctos/db/schema/document';

// ─── Control with relations ──────────────────────────────────────────────────

export interface ControlWithOwner extends Control {
  ownerName: string | null;
  openFindingsCount: number;
  linkedRisksCount: number;
  lastTestResult: string | null;
}

export interface ControlDetail extends Control {
  owner: { id: string; name: string; email: string } | null;
  tests: ControlTestWithTester[];
  findings: FindingBasic[];
  riskControls: RiskControlWithRisk[];
  processLinks: ProcessControlLink[];
  processStepLinks: ProcessStepControlLink[];
}

// ─── Control Test ────────────────────────────────────────────────────────────

export interface ControlTestWithTester extends ControlTest {
  testerName: string | null;
  controlTitle: string;
  campaignName: string | null;
  evidenceCount: number;
}

export interface CampaignWithProgress extends ControlTestCampaign {
  totalTests: number;
  completedTests: number;
  effectiveTests: number;
  ineffectiveTests: number;
  progressPercent: number;
}

// ─── Finding ─────────────────────────────────────────────────────────────────

export interface FindingBasic {
  id: string;
  title: string;
  severity: string;
  status: string;
  responsibleName: string | null;
  dueDate: string | null;
  isOverdue: boolean;
}

export interface FindingDetail extends Finding {
  responsible: { id: string; name: string; email: string } | null;
  control: { id: string; title: string } | null;
  controlTest: { id: string; campaignName: string | null } | null;
  risk: { id: string; title: string; riskScoreInherent: string | null } | null;
  verifier: { id: string; name: string } | null;
  evidenceCount: number;
  affectedRisks: { id: string; title: string; score: number }[];
}

// ─── RCM ─────────────────────────────────────────────────────────────────────

export interface RiskControlWithRisk extends RiskControl {
  riskTitle: string;
  riskScoreInherent: number | null;
  riskScoreResidual: number | null;
  riskCategory: string;
  riskStatus: string;
}

export interface RiskControlWithControl extends RiskControl {
  controlTitle: string;
  controlType: string;
  controlStatus: string;
  controlFrequency: string;
  lastTestResult: string | null;
}

export interface RCMMatrixCell {
  riskId: string;
  controlId: string;
  effectivenessRating: string;
  coverageDescription: string | null;
}

export interface RCMMatrixData {
  risks: { id: string; title: string; category: string; scoreInherent: number; scoreResidual: number | null; controlCount: number }[];
  controls: { id: string; title: string; type: string; status: string; riskCount: number }[];
  cells: RCMMatrixCell[];
  gaps: { uncontrolledRisks: string[]; orphanedControls: string[] };
}

// ─── Document ────────────────────────────────────────────────────────────────

export interface DocumentWithMeta extends Document {
  ownerName: string | null;
  reviewerName: string | null;
  acknowledgmentPercent: number | null;
  acknowledgmentTotal: number;
  acknowledgmentDone: number;
}

export interface DocumentDetail extends Document {
  owner: { id: string; name: string; email: string } | null;
  reviewer: { id: string; name: string; email: string } | null;
  approver: { id: string; name: string } | null;
  versions: DocumentVersionBasic[];
  entityLinks: DocumentEntityLinkWithTitle[];
  acknowledgmentStatus: AcknowledgmentStatus;
}

export interface DocumentVersionBasic {
  id: string;
  versionNumber: number;
  changeSummary: string | null;
  createdBy: string | null;
  authorName: string | null;
  createdAt: string;
}

export interface AcknowledgmentStatus {
  totalUsers: number;
  acknowledgedCount: number;
  pendingUsers: { id: string; name: string; email: string }[];
  percentage: number;
}

export interface DocumentEntityLinkWithTitle extends DocumentEntityLink {
  entityTitle: string;
  entityStatus: string | null;
}

export interface ProcessControlLink {
  processId: string;
  processName: string;
  controlContext: string | null;
}

export interface ProcessStepControlLink {
  processStepId: string;
  processStepName: string;
  processName: string;
  controlContext: string | null;
}

// ─── Search ──────────────────────────────────────────────────────────────────

export interface SearchResult {
  entityType: 'document' | 'control' | 'risk';
  entityId: string;
  title: string;
  excerpt: string;
  category: string | null;
  status: string;
  relevanceScore: number;
}

export interface SearchResponse {
  results: SearchResult[];
  meta: { page: number; limit: number; total: number; query: string };
}
```

---

# 4. API Route Implementations

## 4.1 `apps/web/src/app/api/v1/controls/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@arctos/db';
import { controls } from '@arctos/db/schema/control';
import { users } from '@arctos/db/schema/user';
import { createControlSchema, controlListQuerySchema } from '@arctos/shared/schemas/control';
import { withAuth, withOrgContext } from '@arctos/auth/middleware';
import { requireRole } from '@arctos/auth/rbac';
import { requireModule } from '@arctos/modules/middleware';
import { createNotification } from '@/lib/notifications';
import { createWorkItem } from '@/lib/work-items';
import { and, eq, ilike, or, inArray, isNull, desc, asc, sql, count } from 'drizzle-orm';

// GET /api/v1/controls
export const GET = withAuth(withOrgContext(requireModule('ics', async (req: NextRequest, ctx) => {
  const { orgId } = ctx;
  const url = new URL(req.url);
  const query = controlListQuerySchema.parse(Object.fromEntries(url.searchParams));

  const conditions = [
    eq(controls.orgId, orgId),
    query.showDeleted ? undefined : isNull(controls.deletedAt),
    query.status?.length ? inArray(controls.status, query.status as any[]) : undefined,
    query.controlType?.length ? inArray(controls.controlType, query.controlType as any[]) : undefined,
    query.frequency?.length ? inArray(controls.frequency, query.frequency as any[]) : undefined,
    query.automationLevel?.length ? inArray(controls.automationLevel, query.automationLevel as any[]) : undefined,
    query.lineOfDefense?.length ? inArray(controls.lineOfDefense, query.lineOfDefense as any[]) : undefined,
    query.ownerId ? eq(controls.ownerId, query.ownerId) : undefined,
    query.search ? or(
      ilike(controls.title, `%${query.search}%`),
      ilike(controls.description, `%${query.search}%`)
    ) : undefined,
  ].filter(Boolean) as any[];

  const orderColumn = {
    title: controls.title,
    status: controls.status,
    lastTestedAt: controls.lastTestedAt,
    createdAt: controls.createdAt,
  }[query.sortBy];
  const orderFn = query.sortOrder === 'asc' ? asc : desc;
  const offset = (query.page - 1) * query.limit;

  const [data, [{ total }]] = await Promise.all([
    db.select({
      control: controls,
      ownerName: users.name,
    })
      .from(controls)
      .leftJoin(users, eq(controls.ownerId, users.id))
      .where(and(...conditions))
      .orderBy(orderFn(orderColumn))
      .limit(query.limit)
      .offset(offset),
    db.select({ total: count() }).from(controls).where(and(...conditions)),
  ]);

  return NextResponse.json({
    data: data.map(({ control, ownerName }) => ({ ...control, ownerName })),
    meta: {
      page: query.page,
      limit: query.limit,
      total: Number(total),
      totalPages: Math.ceil(Number(total) / query.limit),
    },
  });
})));

// POST /api/v1/controls
export const POST = withAuth(withOrgContext(requireModule('ics', requireRole(
  ['control_owner', 'risk_manager', 'admin'],
  async (req: NextRequest, ctx) => {
    const { orgId, userId } = ctx;
    const body = await req.json();
    const parsed = createControlSchema.parse(body);

    // Create work item first
    const workItem = await createWorkItem({
      orgId,
      typeKey: 'control',
      name: parsed.title,
      status: 'designed',
      responsibleId: parsed.ownerId ?? userId,
      createdBy: userId,
    });

    const [newControl] = await db.insert(controls).values({
      ...parsed,
      orgId,
      status: 'designed',
      workItemId: workItem.id,
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    // Notify assigned owner
    if (parsed.ownerId && parsed.ownerId !== userId) {
      await createNotification({
        userId: parsed.ownerId,
        orgId,
        type: 'task_assigned',
        entityType: 'control',
        entityId: newControl.id,
        title: 'Neue Kontrolle zugewiesen',
        message: `Sie wurden als Control Owner für "${newControl.title}" zugewiesen.`,
        channel: 'in_app',
      });
    }

    return NextResponse.json({ data: newControl }, { status: 201 });
  }
))));
```

## 4.2 `apps/web/src/app/api/v1/controls/[id]/status/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@arctos/db';
import { controls, findings } from '@arctos/db/schema/control';
import { controlStatusTransitionSchema, isValidControlStatusTransition } from '@arctos/shared/schemas/control';
import { withAuth, withOrgContext } from '@arctos/auth/middleware';
import { requireRole } from '@arctos/auth/rbac';
import { requireModule } from '@arctos/modules/middleware';
import { createNotification } from '@/lib/notifications';
import { getUsersByRole } from '@arctos/auth/rbac';
import { eq, and } from 'drizzle-orm';

export const PUT = withAuth(withOrgContext(requireModule('ics', requireRole(
  ['control_owner', 'risk_manager', 'admin'],
  async (req: NextRequest, ctx) => {
    const { orgId, userId } = ctx;
    const controlId = ctx.params.id;
    const body = await req.json();
    const { status: newStatus, notes } = controlStatusTransitionSchema.parse(body);

    // Fetch current control
    const [control] = await db.select().from(controls)
      .where(and(eq(controls.id, controlId), eq(controls.orgId, orgId)));

    if (!control) return NextResponse.json({ error: 'Control not found' }, { status: 404 });

    // Validate transition
    if (!isValidControlStatusTransition(control.status, newStatus)) {
      return NextResponse.json({
        error: `Statusübergang von '${control.status}' nach '${newStatus}' ist nicht erlaubt.`,
      }, { status: 400 });
    }

    // Validation: 'effective' requires at least one effective ToE test
    if (newStatus === 'effective') {
      const effectiveTests = await db.select().from(controlTests)
        .where(and(
          eq(controlTests.controlId, controlId),
          eq(controlTests.toeResult, 'effective')
        ));
      if (effectiveTests.length === 0) {
        return NextResponse.json({
          error: 'Kontrolle benötigt mindestens einen effektiven Test-of-Effectiveness um als "effective" markiert zu werden.',
        }, { status: 400 });
      }
    }

    // Update status
    const [updated] = await db.update(controls)
      .set({ status: newStatus, updatedBy: userId, updatedAt: new Date().toISOString() })
      .where(eq(controls.id, controlId))
      .returning();

    // Auto-create finding on 'ineffective'
    if (newStatus === 'ineffective') {
      const [autoFinding] = await db.insert(findings).values({
        orgId,
        title: `Kontrolle ineffektiv: ${control.title}`,
        description: `Die Kontrolle "${control.title}" wurde als ineffektiv eingestuft. ${notes ?? ''}`,
        severity: 'improvement_requirement',
        source: 'control_test',
        status: 'identified',
        controlId,
        responsibleId: control.ownerId,
        createdBy: userId,
        updatedBy: userId,
      }).returning();
    }

    // Notify
    const riskManagers = await getUsersByRole(orgId, 'risk_manager');
    for (const rm of riskManagers) {
      await createNotification({
        userId: rm.id, orgId,
        type: 'status_change', entityType: 'control', entityId: controlId,
        title: 'Kontrollstatus geändert',
        message: `Kontrolle "${control.title}": ${control.status} → ${newStatus}`,
        channel: 'in_app',
      });
    }

    return NextResponse.json({ data: updated });
  }
))));
```

## 4.3 `apps/web/src/app/api/v1/controls/rcm/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@arctos/db';
import { controls, riskControls } from '@arctos/db/schema/control';
import { risks } from '@arctos/db/schema/risk';
import { withAuth, withOrgContext } from '@arctos/auth/middleware';
import { requireModule } from '@arctos/modules/middleware';
import { requireRole } from '@arctos/auth/rbac';
import { eq, and, isNull, desc, sql, count } from 'drizzle-orm';
import type { RCMMatrixData } from '@arctos/shared/types/control';

export const GET = withAuth(withOrgContext(requireModule('ics', requireRole(
  ['risk_manager', 'admin', 'auditor'],
  async (req: NextRequest, ctx) => {
    const { orgId } = ctx;

    // Fetch all active risks with control counts
    const riskRows = await db.select({
      id: risks.id,
      title: risks.title,
      category: risks.riskCategory,
      scoreInherent: risks.riskScoreInherent,
      scoreResidual: risks.riskScoreResidual,
      controlCount: sql<number>`(SELECT COUNT(*) FROM risk_control WHERE risk_id = ${risks.id})`.as('control_count'),
    })
    .from(risks)
    .where(and(eq(risks.orgId, orgId), isNull(risks.deletedAt)))
    .orderBy(desc(risks.riskScoreInherent));

    // Fetch all active controls with risk counts
    const controlRows = await db.select({
      id: controls.id,
      title: controls.title,
      type: controls.controlType,
      status: controls.status,
      riskCount: sql<number>`(SELECT COUNT(*) FROM risk_control WHERE control_id = ${controls.id})`.as('risk_count'),
    })
    .from(controls)
    .where(and(eq(controls.orgId, orgId), isNull(controls.deletedAt)));

    // Fetch all RCM cells
    const cells = await db.select({
      riskId: riskControls.riskId,
      controlId: riskControls.controlId,
      effectivenessRating: riskControls.effectivenessRating,
      coverageDescription: riskControls.coverageDescription,
    })
    .from(riskControls)
    .where(eq(riskControls.orgId, orgId));

    // Compute gaps
    const risksWithControls = new Set(cells.map(c => c.riskId));
    const controlsWithRisks = new Set(cells.map(c => c.controlId));

    const result: RCMMatrixData = {
      risks: riskRows.map(r => ({
        ...r,
        scoreInherent: r.scoreInherent ? parseFloat(r.scoreInherent as string) : 0,
        scoreResidual: r.scoreResidual ? parseFloat(r.scoreResidual as string) : null,
        controlCount: Number(r.controlCount),
      })),
      controls: controlRows.map(c => ({ ...c, riskCount: Number(c.riskCount) })),
      cells,
      gaps: {
        uncontrolledRisks: riskRows.filter(r => !risksWithControls.has(r.id)).map(r => r.id),
        orphanedControls: controlRows.filter(c => !controlsWithRisks.has(c.id)).map(c => c.id),
      },
    };

    return NextResponse.json({ data: result });
  }
))));
```

## 4.4 `apps/web/src/app/api/v1/documents/[id]/acknowledge/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@arctos/db';
import { documents, acknowledgments } from '@arctos/db/schema/document';
import { withAuth, withOrgContext } from '@arctos/auth/middleware';
import { requireModule } from '@arctos/modules/middleware';
import { eq, and } from 'drizzle-orm';

export const POST = withAuth(withOrgContext(requireModule('dms', async (req: NextRequest, ctx) => {
  const { orgId, userId } = ctx;
  const documentId = ctx.params.id;

  // Fetch document
  const [doc] = await db.select().from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.orgId, orgId)));

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  if (doc.status !== 'published') {
    return NextResponse.json({ error: 'Nur veröffentlichte Dokumente können bestätigt werden.' }, { status: 400 });
  }
  if (!doc.requiresAcknowledgment) {
    return NextResponse.json({ error: 'Dieses Dokument erfordert keine Kenntnisnahme.' }, { status: 400 });
  }

  // Idempotent: check if already acknowledged for current version
  const existing = await db.select().from(acknowledgments)
    .where(and(
      eq(acknowledgments.documentId, documentId),
      eq(acknowledgments.userId, userId),
      eq(acknowledgments.versionAcknowledged, doc.currentVersion)
    ));

  if (existing.length > 0) {
    return NextResponse.json({ data: existing[0], message: 'Bereits bestätigt.' });
  }

  const [ack] = await db.insert(acknowledgments).values({
    orgId,
    documentId,
    userId,
    versionAcknowledged: doc.currentVersion,
  }).returning();

  return NextResponse.json({ data: ack }, { status: 201 });
})));
```

---

# 5. Key DB Queries

## 5.1 RCM Gap Analysis Query

```sql
-- Find risks with 0 controls (uncontrolled risks)
SELECT r.id, r.title, r.risk_score_inherent
FROM risk r
WHERE r.org_id = :orgId
  AND r.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM risk_control rc WHERE rc.risk_id = r.id
  )
ORDER BY r.risk_score_inherent DESC;

-- Find controls with 0 risks (orphaned controls)
SELECT c.id, c.title, c.status
FROM control c
WHERE c.org_id = :orgId
  AND c.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM risk_control rc WHERE rc.control_id = c.id
  );
```

## 5.2 Finding SLA Compliance Query

```sql
-- Average time-to-remediation by severity
SELECT
  f.severity,
  AVG(EXTRACT(DAY FROM (f.resolved_at - f.created_at))) AS avg_ttr_days,
  COUNT(*) AS total_findings,
  COUNT(*) FILTER (WHERE f.resolved_at IS NOT NULL
    AND EXTRACT(DAY FROM (f.resolved_at - f.created_at)) <= 
      CASE f.severity
        WHEN 'significant_nonconformity' THEN 30
        WHEN 'insignificant_nonconformity' THEN 60
        WHEN 'improvement_requirement' THEN 90
        WHEN 'recommendation' THEN 180
        WHEN 'observation' THEN 365
      END
  ) AS within_sla
FROM finding f
WHERE f.org_id = :orgId AND f.deleted_at IS NULL
GROUP BY f.severity;
```

## 5.3 Acknowledgment Compliance Query

```sql
-- Acknowledgment status per document
SELECT
  d.id,
  d.title,
  d.current_version,
  d.published_at,
  (SELECT COUNT(DISTINCT u.id)
   FROM "user" u
   JOIN user_organization_role uor ON uor.user_id = u.id
   WHERE uor.org_id = d.org_id AND u.deleted_at IS NULL
  ) AS total_users,
  (SELECT COUNT(DISTINCT a.user_id)
   FROM acknowledgment a
   WHERE a.document_id = d.id AND a.version_acknowledged = d.current_version
  ) AS acknowledged_count
FROM document d
WHERE d.org_id = :orgId
  AND d.requires_acknowledgment = true
  AND d.status = 'published'
  AND d.deleted_at IS NULL
ORDER BY d.published_at DESC;
```

## 5.4 Full-Text Search Query

```sql
-- Document full-text search with highlighting
SELECT
  d.id,
  d.title,
  d.category,
  d.status,
  ts_rank(d.search_vector, plainto_tsquery('german', :query)) AS relevance,
  ts_headline('german', d.content, plainto_tsquery('german', :query),
    'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20'
  ) AS excerpt
FROM document d
WHERE d.org_id = :orgId
  AND d.deleted_at IS NULL
  AND d.search_vector @@ plainto_tsquery('german', :query)
ORDER BY relevance DESC
LIMIT :limit OFFSET :offset;
```

## 5.5 Control Test Campaign Progress Query

```sql
SELECT
  ctc.id,
  ctc.name,
  ctc.period_start,
  ctc.period_end,
  ctc.status,
  COUNT(ct.id) AS total_tests,
  COUNT(ct.id) FILTER (WHERE ct.status = 'completed') AS completed_tests,
  COUNT(ct.id) FILTER (WHERE ct.result = 'effective') AS effective_tests,
  COUNT(ct.id) FILTER (WHERE ct.result = 'ineffective') AS ineffective_tests,
  ROUND(
    COUNT(ct.id) FILTER (WHERE ct.status = 'completed')::numeric /
    GREATEST(COUNT(ct.id), 1) * 100, 1
  ) AS progress_percent
FROM control_test_campaign ctc
LEFT JOIN control_test ct ON ct.campaign_id = ctc.id
WHERE ctc.org_id = :orgId AND ctc.deleted_at IS NULL
GROUP BY ctc.id
ORDER BY ctc.period_end DESC;
```

---

# 6. SQL Migrations

## 060_create_control_enums.sql

```sql
-- Sprint 4: ICS + DMS enums
CREATE TYPE control_type AS ENUM ('preventive', 'detective', 'corrective');
CREATE TYPE control_freq AS ENUM ('event_driven', 'continuous', 'daily', 'weekly', 'monthly', 'quarterly', 'annually', 'ad_hoc');
CREATE TYPE automation_level AS ENUM ('manual', 'semi_automated', 'fully_automated');
CREATE TYPE line_of_defense AS ENUM ('first', 'second', 'third');
CREATE TYPE control_status AS ENUM ('designed', 'implemented', 'effective', 'ineffective', 'retired');
CREATE TYPE control_assertion AS ENUM ('completeness', 'accuracy', 'obligations_and_rights', 'fraud_prevention', 'existence', 'valuation', 'presentation', 'safeguarding_of_assets');
CREATE TYPE test_type AS ENUM ('design_effectiveness', 'operating_effectiveness');
CREATE TYPE test_result AS ENUM ('effective', 'ineffective', 'partially_effective', 'not_tested');
CREATE TYPE test_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'completed', 'cancelled');
CREATE TYPE finding_severity AS ENUM ('observation', 'recommendation', 'improvement_requirement', 'insignificant_nonconformity', 'significant_nonconformity');
CREATE TYPE finding_status AS ENUM ('identified', 'in_remediation', 'remediated', 'verified', 'accepted', 'closed');
CREATE TYPE finding_source AS ENUM ('control_test', 'audit', 'incident', 'self_assessment', 'external');
CREATE TYPE document_category AS ENUM ('policy', 'procedure', 'guideline', 'template', 'record', 'tom', 'dpa', 'bcp', 'soa', 'other');
CREATE TYPE document_status AS ENUM ('draft', 'in_review', 'approved', 'published', 'archived', 'expired');
CREATE TYPE evidence_category AS ENUM ('screenshot', 'document', 'log_export', 'email', 'certificate', 'report', 'photo', 'config_export', 'other');
```

## 074_create_document_search_index.sql

```sql
-- Full-text search on documents (DM-07)
ALTER TABLE document ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('german', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('german', coalesce(content, '')), 'B') ||
    setweight(to_tsvector('german', coalesce(array_to_string(tags, ' '), '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_document_search ON document USING GIN (search_vector);

-- Also add English config for bilingual search
CREATE INDEX IF NOT EXISTS idx_document_search_en ON document USING GIN (
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(content, '')), 'B')
);
```

---

# 7. Worker Jobs (Hono.js)

## 7.1 control-test-reminders.ts

```typescript
import { db } from '@arctos/db';
import { controlTests, controls } from '@arctos/db/schema/control';
import { createNotification } from '@/lib/notifications';
import { sendEmail } from '@/lib/email';
import { and, eq, lt, isNull, isNotNull } from 'drizzle-orm';

// Runs daily at 08:00 UTC
export async function controlTestReminderJob() {
  const today = new Date().toISOString().split('T')[0];

  // Find overdue tests (planned_date < today, not completed)
  const overdueTests = await db.select({
    test: controlTests,
    control: controls,
  })
  .from(controlTests)
  .innerJoin(controls, eq(controlTests.controlId, controls.id))
  .where(and(
    lt(controlTests.plannedDate, today),
    eq(controlTests.status, 'planned'),
    isNull(controlTests.deletedAt),
  ));

  for (const { test, control } of overdueTests) {
    if (test.testerId) {
      await createNotification({
        userId: test.testerId,
        orgId: control.orgId,
        type: 'overdue',
        entityType: 'control_test',
        entityId: test.id,
        title: 'Überfälliger Kontrolltest',
        message: `Kontrolltest für "${control.title}" war fällig am ${test.plannedDate}. Bitte umgehend durchführen.`,
        channel: 'both',
      });
    }
  }

  console.log(`[control-test-reminders] Sent ${overdueTests.length} overdue reminders`);
}
```

## 7.2 document-expiry-reminders.ts

```typescript
import { db } from '@arctos/db';
import { documents } from '@arctos/db/schema/document';
import { createNotification } from '@/lib/notifications';
import { and, eq, lte, gte, isNull } from 'drizzle-orm';

// Runs daily at 06:00 UTC
export async function documentExpiryReminderJob() {
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();
  const today = now.toISOString();

  // 60-day warning
  const expiring60 = await db.select().from(documents).where(and(
    lte(documents.expiresAt, in60Days),
    gte(documents.expiresAt, in30Days),
    eq(documents.status, 'published'),
    isNull(documents.deletedAt),
  ));

  for (const doc of expiring60) {
    if (doc.ownerId) {
      await createNotification({
        userId: doc.ownerId, orgId: doc.orgId,
        type: 'warning', entityType: 'document', entityId: doc.id,
        title: 'Dokument läuft in 60 Tagen ab',
        message: `"${doc.title}" läuft am ${doc.expiresAt?.split('T')[0]} ab. Bitte überprüfen und aktualisieren.`,
        channel: 'in_app',
      });
    }
  }

  // Auto-expire documents past their date
  const expired = await db.update(documents)
    .set({ status: 'expired', updatedAt: today })
    .where(and(
      lte(documents.expiresAt, today),
      eq(documents.status, 'published'),
      isNull(documents.deletedAt),
    ))
    .returning();

  console.log(`[document-expiry] 60-day warnings: ${expiring60.length}, auto-expired: ${expired.length}`);
}
```

## 7.3 acknowledgment-reminders.ts

```typescript
// Runs daily at 09:00 UTC
export async function acknowledgmentReminderJob() {
  // Find documents published 7+ days ago with pending acknowledgments
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const pendingDocs = await db.select().from(documents).where(and(
    eq(documents.requiresAcknowledgment, true),
    eq(documents.status, 'published'),
    lte(documents.publishedAt, sevenDaysAgo),
    isNull(documents.deletedAt),
  ));

  for (const doc of pendingDocs) {
    // Get users who haven't acknowledged current version
    const pendingUsers = await db.execute(sql`
      SELECT u.id, u.name, u.email
      FROM "user" u
      JOIN user_organization_role uor ON uor.user_id = u.id AND uor.org_id = ${doc.orgId}
      WHERE u.deleted_at IS NULL
        AND u.id NOT IN (
          SELECT a.user_id FROM acknowledgment a
          WHERE a.document_id = ${doc.id} AND a.version_acknowledged = ${doc.currentVersion}
        )
    `);

    for (const user of pendingUsers.rows) {
      await createNotification({
        userId: user.id as string, orgId: doc.orgId,
        type: 'reminder', entityType: 'document', entityId: doc.id,
        title: 'Erinnerung: Dokumentenbestätigung ausstehend',
        message: `Bitte bestätigen Sie die Kenntnisnahme von "${doc.title}" (Version ${doc.currentVersion}).`,
        channel: 'both',
      });
    }
  }
}
```

---

# 8. Test Plan

## 8.1 Unit Tests

| Test File | Coverage Target | Key Test Cases |
| --- | --- | --- |
| `control.schema.test.ts` | 100% | Enum validation, create/update schema, status transitions |
| `document.schema.test.ts` | 100% | Category validation, lifecycle transitions, restore schema |
| `finding.schema.test.ts` | 100% | Severity enum, source enum, status transitions, justification requirement |

## 8.2 Integration Tests

| Test File | Coverage Target | Key Test Cases |
| --- | --- | --- |
| `controls.api.test.ts` | >85% | CRUD, RLS isolation, module gate (404 when disabled), status workflow, assertion assignment |
| `control-tests.api.test.ts` | >85% | Campaign creation, test execution with ToD/ToE, evidence upload, result computation |
| `findings.api.test.ts` | >85% | CRUD, severity taxonomy, remediation workflow, verification role check |
| `rcm.api.test.ts` | >80% | Link/unlink, matrix query, gap detection, bidirectional access |
| `documents.api.test.ts` | >85% | CRUD, lifecycle workflow, version create/restore, search |
| `acknowledgments.api.test.ts` | >80% | Acknowledge, idempotency, version reset, compliance query |
| `evidence.api.test.ts` | >80% | Upload, polymorphic attachment, presigned URL, soft delete |

## 8.3 RLS Tests

```typescript
describe('Control RLS', () => {
  it('User from Org A cannot see controls from Org B', async () => {
    await setOrgContext(orgBId);
    const controls = await db.select().from(controls).where(eq(controls.orgId, orgAId));
    expect(controls).toHaveLength(0);
  });

  it('Finding from Org A invisible to Org B user', async () => {
    await setOrgContext(orgBId);
    const result = await fetch(`/api/v1/findings/${orgAFindingId}`);
    expect(result.status).toBe(404);
  });
});
```

## 8.4 Module Gate Tests

```typescript
describe('Module Gate — ICS', () => {
  it('returns 404 when ICS is disabled for org', async () => {
    await disableModule(orgId, 'ics');
    const res = await fetch('/api/v1/controls');
    expect(res.status).toBe(404);
  });

  it('returns 200 when ICS is enabled', async () => {
    await enableModule(orgId, 'ics');
    const res = await fetch('/api/v1/controls');
    expect(res.status).toBe(200);
  });
});
```

---

# 9. Seed Data

## 9.1 Demo Controls (075_seed_demo_controls.sql)

```sql
-- Seed 10 demo controls for the demo org
INSERT INTO control (org_id, title, description, control_type, frequency, automation_level, line_of_defense, status, assertions, created_by) VALUES
  (:demoOrgId, 'Multi-Faktor-Authentifizierung (MFA)', 'Alle Benutzer müssen sich mit einem zweiten Faktor authentifizieren.', 'preventive', 'continuous', 'fully_automated', 'first', 'implemented', '{fraud_prevention,safeguarding_of_assets}', :adminId),
  (:demoOrgId, 'Quartalsweise Zugriffsrechteüberprüfung', 'Vierteljährliche Überprüfung aller Zugriffsrechte auf kritische Systeme.', 'detective', 'quarterly', 'semi_automated', 'second', 'effective', '{completeness,existence}', :adminId),
  (:demoOrgId, 'Tägliche Backup-Verifizierung', 'Automatische Prüfung der Backup-Integrität nach jedem Backup-Lauf.', 'detective', 'daily', 'fully_automated', 'first', 'effective', '{completeness,accuracy}', :adminId),
  (:demoOrgId, 'Incident-Response-Plan Review', 'Jährliche Überprüfung und Aktualisierung des Incident-Response-Plans.', 'corrective', 'annually', 'manual', 'second', 'designed', '{presentation}', :adminId),
  (:demoOrgId, 'Netzwerk-Segmentierung', 'Trennung kritischer Netzwerksegmente durch Firewall-Regeln.', 'preventive', 'continuous', 'fully_automated', 'first', 'implemented', '{safeguarding_of_assets}', :adminId),
  (:demoOrgId, 'Patch-Management-Prozess', 'Monatliche Installation von Sicherheitsupdates auf allen Servern.', 'preventive', 'monthly', 'semi_automated', 'first', 'effective', '{safeguarding_of_assets,existence}', :adminId),
  (:demoOrgId, 'Datenschutzfolgenabschätzung (DSFA)', 'Prüfung neuer Verarbeitungstätigkeiten auf Datenschutzrisiken.', 'preventive', 'event_driven', 'manual', 'second', 'implemented', '{obligations_and_rights}', :adminId),
  (:demoOrgId, 'Log-Monitoring und SIEM-Alerting', 'Echtzeitüberwachung von Sicherheitsereignissen im SIEM-System.', 'detective', 'continuous', 'fully_automated', 'first', 'effective', '{completeness,accuracy,fraud_prevention}', :adminId),
  (:demoOrgId, 'Lieferanten-Risikobewertung', 'Jährliche Risikobewertung aller kritischen Lieferanten nach NIS2.', 'detective', 'annually', 'manual', 'second', 'designed', '{obligations_and_rights,existence}', :adminId),
  (:demoOrgId, 'Change-Management-Genehmigung', 'Alle Änderungen an Produktionssystemen erfordern Zwei-Personen-Freigabe.', 'preventive', 'event_driven', 'semi_automated', 'first', 'implemented', '{accuracy,valuation}', :adminId);
```

## 9.2 Demo Documents (076_seed_demo_documents.sql)

```sql
INSERT INTO document (org_id, title, category, content, status, current_version, requires_acknowledgment, tags, owner_id, reviewer_id, published_at) VALUES
  (:demoOrgId, 'Informationssicherheitsrichtlinie', 'policy', '# Informationssicherheitsrichtlinie\n\n## 1. Zweck\nDiese Richtlinie definiert die grundlegenden Anforderungen an die Informationssicherheit...', 'published', 1, true, '{iso27001,isms,security}', :adminId, :adminId, NOW()),
  (:demoOrgId, 'Acceptable Use Policy', 'policy', '# Acceptable Use Policy\n\n## 1. Scope\nThis policy applies to all employees and contractors...', 'published', 1, true, '{security,employees}', :adminId, :adminId, NOW()),
  (:demoOrgId, 'Incident Response Plan', 'procedure', '# Incident Response Plan\n\n## 1. Overview\nThis plan outlines the steps to follow when a security incident is detected...', 'published', 2, false, '{incident,security,bcm}', :adminId, :adminId, NOW()),
  (:demoOrgId, 'Datenschutz-Verfahrensanweisung', 'procedure', '# Datenschutz-Verfahrensanweisung\n\n## 1. Geltungsbereich\nDiese Anweisung gilt für alle Verarbeitungstätigkeiten...', 'draft', 1, false, '{dsgvo,datenschutz}', :adminId, :adminId, NULL),
  (:demoOrgId, 'Backup-Verfahren', 'guideline', '# Backup-Verfahren\n\n## 1. Backup-Strategie\n3-2-1 Regel: 3 Kopien, 2 Medien, 1 Offsite...', 'published', 1, false, '{backup,operations}', :adminId, :adminId, NOW());
```

---

# 10. File Directory

```
apps/web/src/app/
├── (dashboard)/
│   ├── controls/
│   │   ├── page.tsx                         ← Control Register List
│   │   ├── new/
│   │   │   └── page.tsx                     ← Create Control Form
│   │   ├── [id]/
│   │   │   ├── page.tsx                     ← Control Detail Page (7 tabs)
│   │   │   └── edit/
│   │   │       └── page.tsx                 ← Edit Control Form
│   │   ├── campaigns/
│   │   │   ├── page.tsx                     ← Campaign List
│   │   │   ├── new/
│   │   │   │   └── page.tsx                 ← Create Campaign
│   │   │   └── [id]/
│   │   │       └── page.tsx                 ← Campaign Detail + Progress
│   │   ├── findings/
│   │   │   ├── page.tsx                     ← Finding List + Dashboard
│   │   │   ├── new/
│   │   │   │   └── page.tsx                 ← Create Finding
│   │   │   └── [id]/
│   │   │       └── page.tsx                 ← Finding Detail
│   │   ├── rcm/
│   │   │   └── page.tsx                     ← Risk-Control Matrix
│   │   └── evidence/
│   │       └── page.tsx                     ← Evidence Browser
│   ├── documents/
│   │   ├── page.tsx                         ← Document Repository List
│   │   ├── new/
│   │   │   └── page.tsx                     ← Create Document
│   │   ├── [id]/
│   │   │   ├── page.tsx                     ← Document Detail (6 tabs)
│   │   │   └── edit/
│   │   │       └── page.tsx                 ← Edit Document
│   │   └── compliance/
│   │       └── page.tsx                     ← Acknowledgment Compliance Dashboard
│   └── search/
│       └── page.tsx                         ← Full-text Search
├── api/v1/
│   ├── controls/
│   │   ├── route.ts                         ← GET list, POST create
│   │   ├── bulk/
│   │   │   └── route.ts                     ← POST bulk status change, bulk owner reassign
│   │   ├── rcm/
│   │   │   └── route.ts                     ← GET RCM matrix
│   │   ├── [id]/
│   │   │   ├── route.ts                     ← GET detail, PUT update, DELETE
│   │   │   ├── status/
│   │   │   │   └── route.ts                 ← PUT status transition
│   │   │   ├── risk-links/
│   │   │   │   └── route.ts                 ← GET/POST/DELETE risk-control
│   │   │   ├── process-links/
│   │   │   │   └── route.ts                 ← GET/POST/DELETE process-control
│   │   │   └── process-step-links/
│   │   │       └── route.ts                 ← GET/POST/DELETE step-control
│   ├── control-test-campaigns/
│   │   ├── route.ts                         ← GET list, POST create
│   │   └── [id]/
│   │       ├── route.ts                     ← GET/PUT campaign
│   │       └── status/
│   │           └── route.ts                 ← PUT activate/complete
│   ├── control-tests/
│   │   ├── route.ts                         ← GET list
│   │   ├── export/
│   │   │   └── route.ts                     ← GET CSV/Excel export
│   │   └── [id]/
│   │       └── route.ts                     ← GET/PUT execute test
│   ├── findings/
│   │   ├── route.ts                         ← GET list, POST create
│   │   └── [id]/
│   │       ├── route.ts                     ← GET/PUT/DELETE
│   │       └── status/
│   │           └── route.ts                 ← PUT status transition
│   ├── evidence/
│   │   ├── route.ts                         ← GET list, POST upload
│   │   └── [id]/
│   │       └── route.ts                     ← GET download, DELETE
│   ├── documents/
│   │   ├── route.ts                         ← GET list, POST create
│   │   ├── bulk/
│   │   │   └── route.ts                     ← POST bulk status change, bulk owner reassign, bulk tag assign
│   │   ├── compliance/
│   │   │   └── route.ts                     ← GET acknowledgment dashboard
│   │   └── [id]/
│   │       ├── route.ts                     ← GET/PUT/DELETE
│   │       ├── status/
│   │       │   └── route.ts                 ← PUT lifecycle transition
│   │       ├── versions/
│   │       │   ├── route.ts                 ← GET all versions
│   │       │   ├── [versionNumber]/
│   │       │   │   └── route.ts             ← GET specific version
│   │       │   └── compare/
│   │       │       └── route.ts             ← GET diff two versions
│   │       ├── restore/
│   │       │   └── route.ts                 ← POST restore old version
│   │       ├── entity-links/
│   │       │   └── route.ts                 ← GET/POST/DELETE entity links
│   │       ├── acknowledge/
│   │       │   └── route.ts                 ← POST acknowledge
│   │       ├── acknowledgment-status/
│   │       │   └── route.ts                 ← GET status
│   │       └── send-reminder/
│   │           └── route.ts                 ← POST send reminders
│   └── search/
│       └── route.ts                         ← GET full-text search

packages/db/src/schema/
├── control.ts                               ← Drizzle schema (controls, tests, findings, evidence, RCM)
└── document.ts                              ← Drizzle schema (documents, versions, acknowledgments, links)

packages/shared/src/
├── schemas/
│   ├── control.ts                           ← Zod schemas for ICS
│   └── document.ts                          ← Zod schemas for DMS
└── types/
    └── control.ts                           ← TypeScript types for both modules

packages/ui/src/
├── control-register-table.tsx               ← Reusable control list table
├── control-test-form.tsx                    ← ToD/ToE execution form
├── finding-card.tsx                         ← Finding summary card
├── finding-severity-badge.tsx               ← Color-coded severity badge
├── rcm-matrix.tsx                           ← RCM heatmap grid component
├── document-list-table.tsx                  ← Document repository table
├── document-content-viewer.tsx              ← Markdown renderer with metadata sidebar
├── document-version-diff.tsx                ← Side-by-side version comparison
├── acknowledgment-banner.tsx                ← "Please acknowledge" banner
├── acknowledgment-compliance-table.tsx      ← Compliance tracking table
├── evidence-upload.tsx                      ← Drag-drop file upload component
└── evidence-card.tsx                        ← Evidence thumbnail + metadata card
```
