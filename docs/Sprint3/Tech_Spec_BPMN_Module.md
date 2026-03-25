# ARCTOS — Technical Specification: BPMN Process Modeling Module

Sprint 3 — BPMN Process Modeling
Complete implementation guide for Claude Code

---

# 1. Drizzle Schema — `packages/db/src/schema/process.ts`

```typescript
import {
  pgTable, pgEnum, uuid, varchar, text, integer, boolean,
  timestamp, index, uniqueIndex, type AnyPgColumn
} from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { organizations } from './organization';
import { users } from './user';

// ─── Enums (already exist in schema from grc_schema.sql) ─────────────────────
// process_notation: 'bpmn' | 'value_chain' | 'epc'
// process_status: 'draft' | 'in_review' | 'approved' | 'published' | 'archived'
// step_type: 'task' | 'gateway' | 'event' | 'subprocess' | 'call_activity'

export const processNotationEnum = pgEnum('process_notation', [
  'bpmn', 'value_chain', 'epc'
]);

export const processStatusEnum = pgEnum('process_status', [
  'draft', 'in_review', 'approved', 'published', 'archived'
]);

export const stepTypeEnum = pgEnum('step_type', [
  'task', 'gateway', 'event', 'subprocess', 'call_activity'
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

// ─── process ─────────────────────────────────────────────────────────────────

export const processes = pgTable('process', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  parentProcessId: uuid('parent_process_id').references((): AnyPgColumn => processes.id),
  name: varchar('name', { length: 500 }).notNull(),
  description: text('description'),
  level: integer('level').notNull().default(1),
  notation: processNotationEnum('notation').notNull().default('bpmn'),
  status: processStatusEnum('status').notNull().default('draft'),
  processOwnerId: uuid('process_owner_id').references(() => users.id),
  reviewerId: uuid('reviewer_id').references(() => users.id),
  department: varchar('department', { length: 255 }),
  currentVersion: integer('current_version').notNull().default(1),
  isEssential: boolean('is_essential').notNull().default(false),
  publishedAt: timestamp('published_at', { withTimezone: true, mode: 'string' }),
  ...crossCutting,
}, (t) => ({
  orgIdx: index('process_org_idx').on(t.orgId),
  parentIdx: index('process_parent_idx').on(t.parentProcessId),
  ownerIdx: index('process_owner_idx').on(t.processOwnerId),
  statusIdx: index('process_status_idx').on(t.orgId, t.status),
  levelIdx: index('process_level_idx').on(t.orgId, t.level),
  deletedIdx: index('process_deleted_idx').on(t.orgId),
}));

// ─── process_version ─────────────────────────────────────────────────────────

export const processVersions = pgTable('process_version', {
  id: uuid('id').primaryKey().defaultRandom(),
  processId: uuid('process_id').notNull().references(() => processes.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  versionNumber: integer('version_number').notNull(),
  bpmnXml: text('bpmn_xml'),
  diagramJson: text('diagram_json'),  // jsonb as text for flexibility
  changeSummary: text('change_summary'),
  isCurrent: boolean('is_current').notNull().default(false),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  processIdx: index('process_version_process_idx').on(t.processId),
  orgIdx: index('process_version_org_idx').on(t.orgId),
  versionUnique: uniqueIndex('process_version_unique').on(t.processId, t.versionNumber),
}));

// ─── process_step ────────────────────────────────────────────────────────────

export const processSteps = pgTable('process_step', {
  id: uuid('id').primaryKey().defaultRandom(),
  processId: uuid('process_id').notNull().references(() => processes.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  bpmnElementId: varchar('bpmn_element_id', { length: 255 }).notNull(),
  name: varchar('name', { length: 500 }),
  description: text('description'),
  stepType: stepTypeEnum('step_type').notNull().default('task'),
  responsibleRole: varchar('responsible_role', { length: 255 }),
  sequenceOrder: integer('sequence_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
}, (t) => ({
  processIdx: index('process_step_process_idx').on(t.processId),
  orgIdx: index('process_step_org_idx').on(t.orgId),
  elementIdx: index('process_step_element_idx').on(t.processId, t.bpmnElementId),
  stepUnique: uniqueIndex('process_step_unique').on(t.processId, t.bpmnElementId),
}));

// ─── process_control (Sprint 4 placeholder) ──────────────────────────────────

export const processControls = pgTable('process_control', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  processId: uuid('process_id').notNull().references(() => processes.id, { onDelete: 'cascade' }),
  controlId: uuid('control_id').notNull(),  // FK → control added in Sprint 4
  controlContext: text('control_context'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (t) => ({
  processIdx: index('process_control_process_idx').on(t.processId),
  controlIdx: index('process_control_control_idx').on(t.controlId),
  orgIdx: index('process_control_org_idx').on(t.orgId),
}));

// ─── process_step_control (Sprint 4 placeholder) ─────────────────────────────

export const processStepControls = pgTable('process_step_control', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id),
  processStepId: uuid('process_step_id').notNull().references(() => processSteps.id, { onDelete: 'cascade' }),
  controlId: uuid('control_id').notNull(),  // FK → control added in Sprint 4
  controlContext: text('control_context'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (t) => ({
  stepIdx: index('process_step_control_step_idx').on(t.processStepId),
  controlIdx: index('process_step_control_control_idx').on(t.controlId),
  orgIdx: index('process_step_control_org_idx').on(t.orgId),
}));

// ─── Relations ───────────────────────────────────────────────────────────────

export const processRelations = relations(processes, ({ one, many }) => ({
  organization: one(organizations, { fields: [processes.orgId], references: [organizations.id] }),
  parentProcess: one(processes, { fields: [processes.parentProcessId], references: [processes.id], relationName: 'parentChild' }),
  childProcesses: many(processes, { relationName: 'parentChild' }),
  processOwner: one(users, { fields: [processes.processOwnerId], references: [users.id], relationName: 'processOwner' }),
  reviewer: one(users, { fields: [processes.reviewerId], references: [users.id], relationName: 'processReviewer' }),
  versions: many(processVersions),
  steps: many(processSteps),
  processRisks: many(processControls),  // Sprint 2 join table — relation added here
}));

export const processVersionRelations = relations(processVersions, ({ one }) => ({
  process: one(processes, { fields: [processVersions.processId], references: [processes.id] }),
  organization: one(organizations, { fields: [processVersions.orgId], references: [organizations.id] }),
  creator: one(users, { fields: [processVersions.createdBy], references: [users.id] }),
}));

export const processStepRelations = relations(processSteps, ({ one, many }) => ({
  process: one(processes, { fields: [processSteps.processId], references: [processes.id] }),
  organization: one(organizations, { fields: [processSteps.orgId], references: [organizations.id] }),
}));

// ─── Type Exports ────────────────────────────────────────────────────────────

export type Process = InferSelectModel<typeof processes>;
export type NewProcess = InferInsertModel<typeof processes>;
export type ProcessVersion = InferSelectModel<typeof processVersions>;
export type NewProcessVersion = InferInsertModel<typeof processVersions>;
export type ProcessStep = InferSelectModel<typeof processSteps>;
export type NewProcessStep = InferInsertModel<typeof processSteps>;
```

---

# 2. Zod Schemas — `packages/shared/src/schemas/process.ts`

```typescript
import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const processNotation = z.enum(['bpmn', 'value_chain', 'epc']);
export const processStatus = z.enum(['draft', 'in_review', 'approved', 'published', 'archived']);
export const stepType = z.enum(['task', 'gateway', 'event', 'subprocess', 'call_activity']);

// ─── Process Schemas ─────────────────────────────────────────────────────────

export const createProcessSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(500),
  description: z.string().max(5000).optional().nullable(),
  level: z.number().int().min(1).max(10).default(1),
  parentProcessId: z.string().uuid().optional().nullable(),
  processOwnerId: z.string().uuid().optional().nullable(),
  reviewerId: z.string().uuid().optional().nullable(),
  department: z.string().max(255).optional().nullable(),
  notation: processNotation.default('bpmn'),
  isEssential: z.boolean().default(false),
});

export const updateProcessSchema = z.object({
  name: z.string().min(3).max(500).optional(),
  description: z.string().max(5000).optional().nullable(),
  level: z.number().int().min(1).max(10).optional(),
  parentProcessId: z.string().uuid().optional().nullable(),
  processOwnerId: z.string().uuid().optional().nullable(),
  reviewerId: z.string().uuid().optional().nullable(),
  department: z.string().max(255).optional().nullable(),
  isEssential: z.boolean().optional(),
});

export const processListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().max(200).optional(),
  status: processStatus.optional(),
  level: z.coerce.number().int().min(1).max(10).optional(),
  parentId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  sortBy: z.enum(['name', 'level', 'status', 'created_at', 'updated_at']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// ─── Status Transition Schema ────────────────────────────────────────────────

export const transitionProcessStatusSchema = z.object({
  status: processStatus,
  comment: z.string().max(1000).optional(),
});

// Status transition validation
export const PROCESS_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['in_review'],
  in_review: ['approved', 'draft'],  // draft = rejection
  approved: ['published', 'in_review'],  // in_review = send back
  published: ['archived'],
  archived: [],  // terminal state
};

export const PROCESS_TRANSITION_ROLES: Record<string, string[]> = {
  'draft->in_review': ['process_owner', 'admin'],
  'in_review->approved': ['auditor', 'admin'],  // reviewer checked server-side
  'in_review->draft': ['auditor', 'admin'],      // rejection
  'approved->published': ['admin'],
  'approved->in_review': ['auditor', 'admin'],   // send back
  'published->archived': ['admin'],
};

export const TRANSITIONS_REQUIRING_COMMENT = [
  'in_review->approved',
  'in_review->draft',
  'approved->in_review',
];

export function validateStatusTransition(
  currentStatus: string,
  targetStatus: string,
  userRole: string,
  isReviewer: boolean
): { valid: boolean; error?: string } {
  const allowedTargets = PROCESS_STATUS_TRANSITIONS[currentStatus];
  if (!allowedTargets || !allowedTargets.includes(targetStatus)) {
    return { valid: false, error: `Cannot transition from ${currentStatus} to ${targetStatus}` };
  }

  const transitionKey = `${currentStatus}->${targetStatus}`;
  const allowedRoles = PROCESS_TRANSITION_ROLES[transitionKey];
  if (!allowedRoles) {
    return { valid: false, error: `No roles defined for transition ${transitionKey}` };
  }

  // Special case: reviewer can approve/reject even without explicit role
  if (isReviewer && (transitionKey === 'in_review->approved' || transitionKey === 'in_review->draft')) {
    return { valid: true };
  }

  if (!allowedRoles.includes(userRole)) {
    return { valid: false, error: `Role ${userRole} cannot perform transition ${transitionKey}` };
  }

  return { valid: true };
}

// ─── Version Schemas ─────────────────────────────────────────────────────────

export const createVersionSchema = z.object({
  bpmnXml: z.string().min(50, 'BPMN XML too short to be valid'),
  changeSummary: z.string().max(500).optional(),
});

export const restoreVersionSchema = z.object({
  fromVersionNumber: z.number().int().min(1),
});

// ─── Risk Linkage Schemas ────────────────────────────────────────────────────

export const linkProcessRiskSchema = z.object({
  riskId: z.string().uuid(),
  riskContext: z.string().max(1000).optional(),
});

export const linkStepRiskSchema = z.object({
  riskId: z.string().uuid(),
  riskContext: z.string().max(1000).optional(),
});

// ─── AI Generation Schema ────────────────────────────────────────────────────

export const generateBpmnSchema = z.object({
  name: z.string().min(3).max(200),
  description: z.string().min(50, 'Description must be at least 50 characters for good results').max(2000),
  industry: z.enum(['manufacturing', 'it_services', 'financial_services', 'healthcare', 'generic']).default('generic'),
});

// ─── Process Step Update Schema ──────────────────────────────────────────────

export const updateProcessStepSchema = z.object({
  responsibleRole: z.string().max(255).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
});

// ─── Type Exports ────────────────────────────────────────────────────────────

export type CreateProcess = z.infer<typeof createProcessSchema>;
export type UpdateProcess = z.infer<typeof updateProcessSchema>;
export type ProcessListQuery = z.infer<typeof processListQuerySchema>;
export type TransitionProcessStatus = z.infer<typeof transitionProcessStatusSchema>;
export type CreateVersion = z.infer<typeof createVersionSchema>;
export type RestoreVersion = z.infer<typeof restoreVersionSchema>;
export type LinkProcessRisk = z.infer<typeof linkProcessRiskSchema>;
export type LinkStepRisk = z.infer<typeof linkStepRiskSchema>;
export type GenerateBpmn = z.infer<typeof generateBpmnSchema>;
```

---

# 3. BPMN XML Parser — `packages/shared/src/utils/bpmn-parser.ts`

```typescript
/**
 * BPMN XML Parser — extracts ProcessStep records from BPMN 2.0 XML
 *
 * Parses the BPMN XML and returns an array of step objects that can be
 * upserted into the process_step table. This runs server-side during
 * the BPMN save operation.
 *
 * Uses fast-xml-parser for lightweight XML parsing without a full BPMN engine.
 */

import { XMLParser } from 'fast-xml-parser';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ParsedProcessStep {
  bpmnElementId: string;
  name: string | null;
  stepType: 'task' | 'gateway' | 'event' | 'subprocess' | 'call_activity';
  sequenceOrder: number;
}

// ─── BPMN element type to step_type mapping ──────────────────────────────────

const BPMN_TASK_TYPES = [
  'bpmn:task', 'bpmn:userTask', 'bpmn:serviceTask', 'bpmn:sendTask',
  'bpmn:receiveTask', 'bpmn:manualTask', 'bpmn:businessRuleTask', 'bpmn:scriptTask',
  // Also handle unprefixed variants (some parsers strip namespace)
  'task', 'userTask', 'serviceTask', 'sendTask',
  'receiveTask', 'manualTask', 'businessRuleTask', 'scriptTask',
];

const BPMN_GATEWAY_TYPES = [
  'bpmn:exclusiveGateway', 'bpmn:parallelGateway', 'bpmn:inclusiveGateway',
  'bpmn:eventBasedGateway', 'bpmn:complexGateway',
  'exclusiveGateway', 'parallelGateway', 'inclusiveGateway',
  'eventBasedGateway', 'complexGateway',
];

const BPMN_EVENT_TYPES = [
  'bpmn:startEvent', 'bpmn:endEvent', 'bpmn:intermediateCatchEvent',
  'bpmn:intermediateThrowEvent', 'bpmn:boundaryEvent',
  'startEvent', 'endEvent', 'intermediateCatchEvent',
  'intermediateThrowEvent', 'boundaryEvent',
];

const BPMN_SUBPROCESS_TYPES = [
  'bpmn:subProcess', 'bpmn:adHocSubProcess', 'bpmn:transaction',
  'subProcess', 'adHocSubProcess', 'transaction',
];

const BPMN_CALL_ACTIVITY_TYPES = [
  'bpmn:callActivity', 'callActivity',
];

function getStepType(elementTag: string): ParsedProcessStep['stepType'] | null {
  if (BPMN_TASK_TYPES.includes(elementTag)) return 'task';
  if (BPMN_GATEWAY_TYPES.includes(elementTag)) return 'gateway';
  if (BPMN_EVENT_TYPES.includes(elementTag)) return 'event';
  if (BPMN_SUBPROCESS_TYPES.includes(elementTag)) return 'subprocess';
  if (BPMN_CALL_ACTIVITY_TYPES.includes(elementTag)) return 'call_activity';
  return null;
}

// All extractable BPMN element tags
const ALL_BPMN_ELEMENT_TAGS = [
  ...BPMN_TASK_TYPES,
  ...BPMN_GATEWAY_TYPES,
  ...BPMN_EVENT_TYPES,
  ...BPMN_SUBPROCESS_TYPES,
  ...BPMN_CALL_ACTIVITY_TYPES,
];

// ─── Parser ──────────────────────────────────────────────────────────────────

export function parseBpmnXml(xml: string): ParsedProcessStep[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => {
      // These elements can appear multiple times in a process
      return ALL_BPMN_ELEMENT_TAGS.some(tag => {
        const localName = tag.includes(':') ? tag.split(':')[1] : tag;
        return name === tag || name === localName;
      });
    },
  });

  const parsed = parser.parse(xml);
  const steps: ParsedProcessStep[] = [];
  let order = 0;

  // Navigate to the process element
  const definitions = parsed['bpmn:definitions'] || parsed['definitions'];
  if (!definitions) {
    throw new Error('Invalid BPMN XML: missing <bpmn:definitions> root element');
  }

  const process = definitions['bpmn:process'] || definitions['process'];
  if (!process) {
    throw new Error('Invalid BPMN XML: missing <bpmn:process> element');
  }

  // Handle single process or array of processes
  const processElements = Array.isArray(process) ? process : [process];

  for (const proc of processElements) {
    extractStepsFromProcess(proc, steps, order);
  }

  // Re-number sequence order
  steps.forEach((step, idx) => {
    step.sequenceOrder = idx + 1;
  });

  return steps;
}

function extractStepsFromProcess(
  processObj: Record<string, unknown>,
  steps: ParsedProcessStep[],
  startOrder: number
): void {
  let order = startOrder;

  for (const [key, value] of Object.entries(processObj)) {
    const stepType = getStepType(key);
    if (!stepType) continue;

    const elements = Array.isArray(value) ? value : [value];
    for (const element of elements) {
      if (typeof element !== 'object' || element === null) continue;

      const el = element as Record<string, unknown>;
      const id = el['@_id'] as string;
      const name = (el['@_name'] as string) || null;

      if (!id) continue;

      steps.push({
        bpmnElementId: id,
        name,
        stepType,
        sequenceOrder: ++order,
      });

      // Recursively extract from subprocesses
      if (stepType === 'subprocess') {
        extractStepsFromProcess(el, steps, order);
        order = steps.length;
      }
    }
  }
}

/**
 * Validates that BPMN XML has minimum required structure.
 * Used to validate AI-generated BPMN before accepting.
 */
export function validateBpmnXml(xml: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    const steps = parseBpmnXml(xml);

    // Must have at least one start event
    const hasStart = steps.some(s => s.bpmnElementId.toLowerCase().includes('start') || s.stepType === 'event');
    if (!hasStart) {
      errors.push('BPMN XML must contain at least one start event');
    }

    // Must have at least one end event
    const hasEnd = steps.some(s => s.bpmnElementId.toLowerCase().includes('end') || s.stepType === 'event');
    if (!hasEnd) {
      errors.push('BPMN XML must contain at least one end event');
    }

    // Must have at least one task
    const hasTasks = steps.some(s => s.stepType === 'task');
    if (!hasTasks) {
      errors.push('BPMN XML must contain at least one task');
    }

    // Check for diagram layout (BPMNDiagram element)
    if (!xml.includes('BPMNDiagram') && !xml.includes('bpmndi:BPMNDiagram')) {
      errors.push('BPMN XML must contain a BPMNDiagram element with layout coordinates');
    }

  } catch (e) {
    errors.push(`XML parsing failed: ${(e as Error).message}`);
  }

  return { valid: errors.length === 0, errors };
}
```

---

# 4. BPMN Editor React Component — `packages/ui/src/components/bpmn/BpmnEditor.tsx`

```typescript
'use client';

import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import type BpmnModeler from 'bpmn-js/lib/Modeler';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BpmnEditorProps {
  initialXml: string;
  readOnly?: boolean;
  onSave?: (xml: string) => Promise<void>;
  onElementClick?: (elementId: string, elementType: string, elementName: string | null) => void;
  onChanged?: () => void;  // Called when diagram is modified (unsaved changes)
  riskOverlayData?: RiskOverlayData[];
}

export interface RiskOverlayData {
  bpmnElementId: string;
  riskCount: number;
  highestScore: number;
}

export interface BpmnEditorRef {
  saveXml: () => Promise<string>;
  saveSvg: () => Promise<string>;
  getModeler: () => BpmnModeler | null;
}

// ─── Default empty BPMN template ─────────────────────────────────────────────

const EMPTY_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  id="Definitions_1" targetNamespace="http://arctos.io/bpmn"
                  exporter="ARCTOS GRC" exporterVersion="1.0">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Start" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="179" y="159" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

// ─── Risk badge color helper ─────────────────────────────────────────────────

function getRiskBadgeColor(score: number): { bg: string; text: string; emoji: string } {
  if (score <= 8) return { bg: '#dcfce7', text: '#166534', emoji: '🟢' };
  if (score <= 15) return { bg: '#fef9c3', text: '#854d0e', emoji: '🟡' };
  return { bg: '#fee2e2', text: '#991b1b', emoji: '🔴' };
}

// ─── Component ───────────────────────────────────────────────────────────────

export const BpmnEditor = forwardRef<BpmnEditorRef, BpmnEditorProps>(function BpmnEditor(
  { initialXml, readOnly = false, onSave, onElementClick, onChanged, riskOverlayData },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const overlayIdsRef = useRef<string[]>([]);

  // ─── Expose methods to parent via ref ────────────────────────────────────

  useImperativeHandle(ref, () => ({
    saveXml: async () => {
      if (!modelerRef.current) throw new Error('Modeler not initialized');
      const result = await modelerRef.current.saveXML({ format: true });
      return result.xml;
    },
    saveSvg: async () => {
      if (!modelerRef.current) throw new Error('Modeler not initialized');
      const result = await modelerRef.current.saveSVG();
      return result.svg;
    },
    getModeler: () => modelerRef.current,
  }));

  // ─── Apply risk overlays ────────────────────────────────────────────────

  const applyRiskOverlays = useCallback(() => {
    const modeler = modelerRef.current;
    if (!modeler || !riskOverlayData) return;

    const overlays = modeler.get('overlays') as any;

    // Clear existing risk overlays
    for (const id of overlayIdsRef.current) {
      try { overlays.remove(id); } catch { /* already removed */ }
    }
    overlayIdsRef.current = [];

    // Add new overlays
    for (const data of riskOverlayData) {
      if (data.riskCount === 0) continue;

      const color = getRiskBadgeColor(data.highestScore);
      const html = document.createElement('div');
      html.className = 'bpmn-risk-badge';
      html.style.cssText = `
        display: flex; align-items: center; gap: 4px;
        background: ${color.bg}; color: ${color.text};
        border: 1px solid ${color.text}33;
        border-radius: 12px; padding: 2px 8px;
        font-size: 11px; font-weight: 600;
        white-space: nowrap; cursor: pointer;
        box-shadow: 0 1px 3px rgba(0,0,0,0.12);
        z-index: 10;
      `;
      html.innerHTML = `${data.riskCount} ${color.emoji} ${data.highestScore}`;

      try {
        const overlayId = overlays.add(data.bpmnElementId, 'risk-badge', {
          position: { top: -14, right: -14 },
          html,
        });
        overlayIdsRef.current.push(overlayId);
      } catch {
        // Element might not exist in current diagram
      }
    }
  }, [riskOverlayData]);

  // ─── Initialize bpmn.js modeler ─────────────────────────────────────────

  useEffect(() => {
    let modeler: BpmnModeler | null = null;
    let destroyed = false;

    async function initModeler() {
      if (!containerRef.current) return;

      // Dynamic import to avoid SSR issues (bpmn.js requires DOM)
      const BpmnJS = readOnly
        ? (await import('bpmn-js/lib/NavigatedViewer')).default
        : (await import('bpmn-js/lib/Modeler')).default;

      if (destroyed) return;

      modeler = new BpmnJS({
        container: containerRef.current,
        keyboard: { bindTo: document },
        ...(readOnly ? {} : {
          // Modeler-specific options
          additionalModules: [],
        }),
      });

      modelerRef.current = modeler;

      // Import BPMN XML
      try {
        const xml = initialXml || EMPTY_BPMN_XML;
        await modeler.importXML(xml);

        // Fit viewport
        const canvas = modeler.get('canvas') as any;
        canvas.zoom('fit-viewport', 'auto');

        // Apply risk overlays after import
        applyRiskOverlays();

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to import BPMN XML:', err);
        setIsLoading(false);
      }

      // ── Event listeners ──────────────────────────────────────────────

      if (!readOnly) {
        // Track changes for "unsaved changes" indicator
        const eventBus = modeler.get('eventBus') as any;
        eventBus.on('commandStack.changed', () => {
          onChanged?.();
        });

        // Ctrl+S shortcut
        const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (onSave && modelerRef.current) {
              modelerRef.current.saveXML({ format: true }).then(({ xml }) => {
                onSave(xml);
              });
            }
          }
        };
        document.addEventListener('keydown', handleKeyDown);

        // Element click handler
        eventBus.on('element.click', (event: any) => {
          const element = event.element;
          if (element.type === 'bpmn:Process' || element.type === 'label') return;
          onElementClick?.(element.id, element.type, element.businessObject?.name || null);
        });
      } else {
        // Even in read-only mode, handle element clicks for side panel
        const eventBus = modeler.get('eventBus') as any;
        eventBus.on('element.click', (event: any) => {
          const element = event.element;
          if (element.type === 'bpmn:Process' || element.type === 'label') return;
          onElementClick?.(element.id, element.type, element.businessObject?.name || null);
        });
      }
    }

    initModeler();

    // ── Cleanup on unmount ────────────────────────────────────────────────
    return () => {
      destroyed = true;
      if (modeler) {
        modeler.destroy();
        modelerRef.current = null;
      }
    };
  }, [initialXml, readOnly]); // Re-create modeler when XML or mode changes

  // ─── Re-apply overlays when risk data changes ──────────────────────────

  useEffect(() => {
    applyRiskOverlays();
  }, [applyRiskOverlays]);

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="relative w-full h-full min-h-[500px]">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-50">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>Loading BPMN Editor...</span>
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
});

export { EMPTY_BPMN_XML };
```

---

# 5. BPMN Viewer Component — `packages/ui/src/components/bpmn/BpmnViewer.tsx`

```typescript
'use client';

import { useRef, useEffect, useState } from 'react';
import type { BpmnEditorProps, RiskOverlayData } from './BpmnEditor';

interface BpmnViewerProps {
  xml: string;
  riskOverlayData?: RiskOverlayData[];
  onElementClick?: (elementId: string, elementType: string, elementName: string | null) => void;
  className?: string;
}

export function BpmnViewer({ xml, riskOverlayData, onElementClick, className }: BpmnViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let viewer: any = null;
    let destroyed = false;

    async function init() {
      if (!containerRef.current || !xml) return;

      const NavigatedViewer = (await import('bpmn-js/lib/NavigatedViewer')).default;
      if (destroyed) return;

      viewer = new NavigatedViewer({ container: containerRef.current });

      try {
        await viewer.importXML(xml);
        const canvas = viewer.get('canvas') as any;
        canvas.zoom('fit-viewport', 'auto');

        // Apply risk overlays
        if (riskOverlayData) {
          const overlays = viewer.get('overlays') as any;
          for (const data of riskOverlayData) {
            if (data.riskCount === 0) continue;
            const color = data.highestScore > 15 ? '#fee2e2' : data.highestScore > 8 ? '#fef9c3' : '#dcfce7';
            const html = document.createElement('div');
            html.style.cssText = `background:${color};border-radius:12px;padding:2px 8px;font-size:11px;font-weight:600;`;
            html.textContent = `${data.riskCount}`;
            try {
              overlays.add(data.bpmnElementId, 'risk-badge', { position: { top: -14, right: -14 }, html });
            } catch { /* element not in diagram */ }
          }
        }

        // Element click handler
        if (onElementClick) {
          const eventBus = viewer.get('eventBus') as any;
          eventBus.on('element.click', (event: any) => {
            const el = event.element;
            if (el.type === 'bpmn:Process' || el.type === 'label') return;
            onElementClick(el.id, el.type, el.businessObject?.name || null);
          });
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load BPMN:', err);
        setIsLoading(false);
      }
    }

    init();
    return () => { destroyed = true; viewer?.destroy(); };
  }, [xml, riskOverlayData, onElementClick]);

  return (
    <div className={`relative w-full h-full min-h-[400px] ${className || ''}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-50">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
```

---

# 6. Key API Route Implementations

### 6.1 POST /api/v1/processes — Create Process

```typescript
// apps/web/src/app/api/v1/processes/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@arctos/auth/middleware/auth';
import { requireModule } from '@arctos/auth/middleware/module-guard';
import { requireRole } from '@arctos/auth/middleware/rbac';
import { orgContextMiddleware, getOrgId } from '@arctos/auth/middleware/org-context';
import { db } from '@arctos/db';
import { processes, processVersions } from '@arctos/db/schema/process';
import { createProcessSchema, processListQuerySchema } from '@arctos/shared/schemas/process';
import { eq, and, isNull, ilike, desc, asc, count } from 'drizzle-orm';
import { EMPTY_BPMN_XML } from '@arctos/ui/components/bpmn/BpmnEditor';

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult.error) return authResult.error;

  const moduleResult = await requireModule(req, 'bpm');
  if (moduleResult.error) return moduleResult.error;

  const roleResult = await requireRole(req, ['admin', 'process_owner']);
  if (roleResult.error) return roleResult.error;

  const orgId = getOrgId(req);
  const userId = authResult.userId;
  const body = await req.json();

  // Validate input
  const validation = createProcessSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
  }

  const data = validation.data;

  // Validate parent process exists and belongs to same org (if provided)
  if (data.parentProcessId) {
    const parent = await db.query.processes.findFirst({
      where: and(eq(processes.id, data.parentProcessId), eq(processes.orgId, orgId), isNull(processes.deletedAt)),
    });
    if (!parent) {
      return NextResponse.json({ error: 'Parent process not found' }, { status: 404 });
    }
  }

  // Create process + initial version in a transaction
  const result = await db.transaction(async (tx) => {
    // Insert process
    const [newProcess] = await tx.insert(processes).values({
      orgId,
      parentProcessId: data.parentProcessId || null,
      name: data.name,
      description: data.description || null,
      level: data.level,
      notation: data.notation,
      status: 'draft',
      processOwnerId: data.processOwnerId || userId,
      reviewerId: data.reviewerId || null,
      department: data.department || null,
      currentVersion: 1,
      isEssential: data.isEssential,
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    // Create initial version with empty BPMN template
    const templateXml = EMPTY_BPMN_XML.replace(
      'name="Start"',
      `name="${data.name}"`
    );

    const [version] = await tx.insert(processVersions).values({
      processId: newProcess.id,
      orgId,
      versionNumber: 1,
      bpmnXml: templateXml,
      changeSummary: 'Initial version',
      isCurrent: true,
      createdBy: userId,
    }).returning();

    return { process: newProcess, version };
  });

  return NextResponse.json(result, { status: 201 });
}

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult.error) return authResult.error;

  const moduleResult = await requireModule(req, 'bpm');
  if (moduleResult.error) return moduleResult.error;

  const orgId = getOrgId(req);
  const params = Object.fromEntries(req.nextUrl.searchParams);

  const query = processListQuerySchema.parse(params);
  const offset = (query.page - 1) * query.limit;

  // Build where conditions
  const conditions = [eq(processes.orgId, orgId), isNull(processes.deletedAt)];
  if (query.status) conditions.push(eq(processes.status, query.status));
  if (query.level) conditions.push(eq(processes.level, query.level));
  if (query.parentId) conditions.push(eq(processes.parentProcessId, query.parentId));
  if (query.ownerId) conditions.push(eq(processes.processOwnerId, query.ownerId));
  if (query.search) conditions.push(ilike(processes.name, `%${query.search}%`));

  const where = and(...conditions);
  const orderFn = query.sortOrder === 'desc' ? desc : asc;

  const [items, [{ total }]] = await Promise.all([
    db.query.processes.findMany({
      where,
      with: { processOwner: true, reviewer: true },
      orderBy: [orderFn(processes[query.sortBy === 'created_at' ? 'createdAt' : query.sortBy === 'updated_at' ? 'updatedAt' : query.sortBy] as any)],
      limit: query.limit,
      offset,
    }),
    db.select({ total: count() }).from(processes).where(where),
  ]);

  return NextResponse.json({
    data: items,
    pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  });
}
```

### 6.2 POST /api/v1/processes/:id/versions — Save BPMN

```typescript
// apps/web/src/app/api/v1/processes/[id]/versions/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@arctos/auth/middleware/auth';
import { requireModule } from '@arctos/auth/middleware/module-guard';
import { requireRole } from '@arctos/auth/middleware/rbac';
import { getOrgId } from '@arctos/auth/middleware/org-context';
import { db } from '@arctos/db';
import { processes, processVersions, processSteps } from '@arctos/db/schema/process';
import { createVersionSchema } from '@arctos/shared/schemas/process';
import { parseBpmnXml } from '@arctos/shared/utils/bpmn-parser';
import { eq, and, isNull, max } from 'drizzle-orm';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireAuth(req);
  if (authResult.error) return authResult.error;

  const moduleResult = await requireModule(req, 'bpm');
  if (moduleResult.error) return moduleResult.error;

  const roleResult = await requireRole(req, ['admin', 'process_owner']);
  if (roleResult.error) return roleResult.error;

  const orgId = getOrgId(req);
  const userId = authResult.userId;
  const processId = params.id;
  const body = await req.json();

  // Validate input
  const validation = createVersionSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
  }

  const { bpmnXml, changeSummary } = validation.data;

  // Verify process exists and belongs to this org
  const process = await db.query.processes.findFirst({
    where: and(eq(processes.id, processId), eq(processes.orgId, orgId), isNull(processes.deletedAt)),
  });

  if (!process) {
    return NextResponse.json({ error: 'Process not found' }, { status: 404 });
  }

  // Check ownership for process_owner role
  if (authResult.role === 'process_owner' && process.processOwnerId !== userId) {
    return NextResponse.json({ error: 'Forbidden: not process owner' }, { status: 403 });
  }

  // Parse BPMN XML to extract process steps
  let parsedSteps;
  try {
    parsedSteps = parseBpmnXml(bpmnXml);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid BPMN XML', details: (err as Error).message }, { status: 400 });
  }

  // Execute in transaction
  const result = await db.transaction(async (tx) => {
    // 1. Get next version number
    const [{ maxVersion }] = await tx
      .select({ maxVersion: max(processVersions.versionNumber) })
      .from(processVersions)
      .where(eq(processVersions.processId, processId));

    const nextVersion = (maxVersion || 0) + 1;

    // 2. Set all existing versions to is_current = false
    await tx
      .update(processVersions)
      .set({ isCurrent: false })
      .where(and(eq(processVersions.processId, processId), eq(processVersions.isCurrent, true)));

    // 3. Create new version
    const [newVersion] = await tx.insert(processVersions).values({
      processId,
      orgId,
      versionNumber: nextVersion,
      bpmnXml,
      changeSummary: changeSummary || null,
      isCurrent: true,
      createdBy: userId,
    }).returning();

    // 4. Update process.current_version
    await tx
      .update(processes)
      .set({ currentVersion: nextVersion, updatedAt: new Date().toISOString(), updatedBy: userId })
      .where(eq(processes.id, processId));

    // 5. Sync ProcessSteps from BPMN XML
    // Get existing steps for this process
    const existingSteps = await tx.query.processSteps.findMany({
      where: eq(processSteps.processId, processId),
    });

    const existingByElementId = new Map(existingSteps.map(s => [s.bpmnElementId, s]));
    const parsedElementIds = new Set(parsedSteps.map(s => s.bpmnElementId));

    // Upsert steps from BPMN XML
    for (const parsed of parsedSteps) {
      const existing = existingByElementId.get(parsed.bpmnElementId);

      if (existing) {
        // Update existing step
        await tx
          .update(processSteps)
          .set({
            name: parsed.name,
            stepType: parsed.stepType,
            sequenceOrder: parsed.sequenceOrder,
            updatedAt: new Date().toISOString(),
            deletedAt: null,  // Restore if previously soft-deleted
          })
          .where(eq(processSteps.id, existing.id));
      } else {
        // Insert new step
        await tx.insert(processSteps).values({
          processId,
          orgId,
          bpmnElementId: parsed.bpmnElementId,
          name: parsed.name,
          stepType: parsed.stepType,
          sequenceOrder: parsed.sequenceOrder,
        });
      }
    }

    // Soft-delete steps no longer in BPMN XML
    for (const [elementId, existing] of existingByElementId) {
      if (!parsedElementIds.has(elementId) && !existing.deletedAt) {
        await tx
          .update(processSteps)
          .set({ deletedAt: new Date().toISOString() })
          .where(eq(processSteps.id, existing.id));
      }
    }

    return newVersion;
  });

  return NextResponse.json(result, { status: 201 });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireAuth(req);
  if (authResult.error) return authResult.error;

  const moduleResult = await requireModule(req, 'bpm');
  if (moduleResult.error) return moduleResult.error;

  const orgId = getOrgId(req);

  const versions = await db.query.processVersions.findMany({
    where: and(eq(processVersions.processId, params.id), eq(processVersions.orgId, orgId)),
    with: { creator: true },
    orderBy: (pv, { desc }) => [desc(pv.versionNumber)],
  });

  return NextResponse.json({ data: versions });
}
```

### 6.3 PUT /api/v1/processes/:id/status — Status Transition

```typescript
// apps/web/src/app/api/v1/processes/[id]/status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@arctos/auth/middleware/auth';
import { requireModule } from '@arctos/auth/middleware/module-guard';
import { getOrgId } from '@arctos/auth/middleware/org-context';
import { db } from '@arctos/db';
import { processes, processVersions } from '@arctos/db/schema/process';
import {
  transitionProcessStatusSchema,
  validateStatusTransition,
  TRANSITIONS_REQUIRING_COMMENT
} from '@arctos/shared/schemas/process';
import { sendEmail } from '@arctos/email/service';
import { eq, and, isNull } from 'drizzle-orm';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireAuth(req);
  if (authResult.error) return authResult.error;

  const moduleResult = await requireModule(req, 'bpm');
  if (moduleResult.error) return moduleResult.error;

  const orgId = getOrgId(req);
  const userId = authResult.userId;
  const processId = params.id;
  const body = await req.json();

  // Validate input
  const validation = transitionProcessStatusSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
  }

  const { status: targetStatus, comment } = validation.data;

  // Load process
  const process = await db.query.processes.findFirst({
    where: and(eq(processes.id, processId), eq(processes.orgId, orgId), isNull(processes.deletedAt)),
    with: { processOwner: true, reviewer: true },
  });

  if (!process) {
    return NextResponse.json({ error: 'Process not found' }, { status: 404 });
  }

  const currentStatus = process.status;
  const transitionKey = `${currentStatus}->${targetStatus}`;

  // Check if comment is required
  if (TRANSITIONS_REQUIRING_COMMENT.includes(transitionKey) && !comment) {
    return NextResponse.json({ error: 'Comment is required for this transition' }, { status: 400 });
  }

  // Validate transition
  const isReviewer = process.reviewerId === userId;
  const transitionResult = validateStatusTransition(currentStatus, targetStatus, authResult.role, isReviewer);
  if (!transitionResult.valid) {
    return NextResponse.json({ error: transitionResult.error }, { status: 403 });
  }

  // For draft → in_review: verify at least one version with BPMN XML exists
  if (currentStatus === 'draft' && targetStatus === 'in_review') {
    const versions = await db.query.processVersions.findMany({
      where: and(eq(processVersions.processId, processId), eq(processVersions.isCurrent, true)),
    });
    const hasContent = versions.some(v => v.bpmnXml && v.bpmnXml.includes('bpmn:'));
    if (!hasContent) {
      return NextResponse.json({
        error: 'Cannot submit for review: process has no BPMN content. Save a BPMN diagram first.'
      }, { status: 400 });
    }
  }

  // Execute transition
  const updateData: Record<string, unknown> = {
    status: targetStatus,
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  };

  if (targetStatus === 'published') {
    updateData.publishedAt = new Date().toISOString();
  }

  const [updated] = await db
    .update(processes)
    .set(updateData)
    .where(eq(processes.id, processId))
    .returning();

  // ── Send email notifications ────────────────────────────────────────────

  try {
    if (targetStatus === 'in_review' && process.reviewer) {
      await sendEmail({
        templateKey: 'process_review_requested',
        to: process.reviewer.email,
        data: { processName: process.name, submittedBy: authResult.userName, comment, processUrl: `/processes/${processId}` },
      });
    }

    if (targetStatus === 'approved' && process.processOwner) {
      await sendEmail({
        templateKey: 'process_approved',
        to: process.processOwner.email,
        data: { processName: process.name, approvedBy: authResult.userName, comment, processUrl: `/processes/${processId}` },
      });
    }

    if (targetStatus === 'draft' && currentStatus === 'in_review' && process.processOwner) {
      // Rejection
      await sendEmail({
        templateKey: 'process_review_rejected',
        to: process.processOwner.email,
        data: { processName: process.name, rejectedBy: authResult.userName, comment, processUrl: `/processes/${processId}` },
      });
    }

    if (targetStatus === 'published') {
      await sendEmail({
        templateKey: 'process_published',
        to: 'all_process_owners',  // EmailService resolves this to all process_owner users in org
        data: { processName: process.name, publishedBy: authResult.userName, processUrl: `/processes/${processId}` },
      });
    }
  } catch (emailErr) {
    // Log but don't fail the transition
    console.error('Email notification failed:', emailErr);
  }

  return NextResponse.json(updated);
}
```

---

# 7. AI Process Generation — Claude API Prompt

```typescript
// apps/web/src/app/api/v1/processes/generate-bpmn/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@arctos/auth/middleware/auth';
import { requireModule } from '@arctos/auth/middleware/module-guard';
import { requireRole } from '@arctos/auth/middleware/rbac';
import { generateBpmnSchema } from '@arctos/shared/schemas/process';
import { validateBpmnXml } from '@arctos/shared/utils/bpmn-parser';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

const BPMN_GENERATION_SYSTEM_PROMPT = `You are a BPMN 2.0 process modeling expert. Generate valid BPMN 2.0 XML from the given process description.

CRITICAL RULES:
1. Return ONLY valid BPMN 2.0 XML. No markdown, no explanations, no code fences.
2. The XML MUST start with <?xml version="1.0" encoding="UTF-8"?> and use these namespaces:
   - xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
   - xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
   - xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
   - xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
3. MUST include <bpmndi:BPMNDiagram> with BPMNShape and BPMNEdge elements with dc:Bounds coordinates.
4. MUST have exactly one <bpmn:startEvent> and at least one <bpmn:endEvent>.
5. Use <bpmn:userTask> for human activities, <bpmn:serviceTask> for automated steps.
6. Use <bpmn:exclusiveGateway> for decisions, <bpmn:parallelGateway> for parallel paths.
7. All elements MUST be connected via <bpmn:sequenceFlow>.
8. Element IDs must be unique and descriptive (e.g., "Task_CheckOrder", "Gateway_Approval").
9. Layout: Start event at x=179, tasks spaced 150px apart horizontally, y=159 for main flow.
10. Generate 5-12 meaningful activities based on the description. Not too simple, not too complex.
11. Include decision gateways where the description implies branching logic.
12. Name attribute on every element in the user's language (German if description is German).`;

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult.error) return authResult.error;

  const moduleResult = await requireModule(req, 'bpm');
  if (moduleResult.error) return moduleResult.error;

  const roleResult = await requireRole(req, ['admin', 'process_owner']);
  if (roleResult.error) return roleResult.error;

  const body = await req.json();
  const validation = generateBpmnSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: 'Validation failed', details: validation.error.flatten() }, { status: 400 });
  }

  const { name, description, industry } = validation.data;

  const userPrompt = `Generate a BPMN 2.0 process model for:

Process Name: ${name}
Description: ${description}
Industry Context: ${industry}

Generate complete, valid BPMN 2.0 XML with diagram layout. Return ONLY the XML, nothing else.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 8000,
      system: BPMN_GENERATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'AI did not return text content' }, { status: 500 });
    }

    let bpmnXml = textBlock.text.trim();

    // Strip markdown code fences if present
    if (bpmnXml.startsWith('```')) {
      bpmnXml = bpmnXml.replace(/^```(?:xml)?\n?/, '').replace(/\n?```$/, '');
    }

    // Validate the generated XML
    const validationResult = validateBpmnXml(bpmnXml);
    if (!validationResult.valid) {
      // Retry once with error feedback
      const retryResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 8000,
        system: BPMN_GENERATION_SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: userPrompt },
          { role: 'assistant', content: bpmnXml },
          { role: 'user', content: `The generated BPMN XML has these validation errors: ${validationResult.errors.join('; ')}. Please fix them and return corrected XML only.` },
        ],
      });

      const retryBlock = retryResponse.content.find(b => b.type === 'text');
      if (retryBlock && retryBlock.type === 'text') {
        bpmnXml = retryBlock.text.trim().replace(/^```(?:xml)?\n?/, '').replace(/\n?```$/, '');
        const retryValidation = validateBpmnXml(bpmnXml);
        if (!retryValidation.valid) {
          return NextResponse.json({
            error: 'AI generation failed validation after retry',
            details: retryValidation.errors,
          }, { status: 422 });
        }
      }
    }

    return NextResponse.json({ bpmnXml });
  } catch (err) {
    console.error('AI BPMN generation failed:', err);
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 });
  }
}
```

---

# 8. i18n Keys

### `messages/de/process.json`

```json
{
  "process": {
    "title": "Prozessmanagement",
    "landscape": "Prozesslandkarte",
    "register": "Prozessregister",
    "newProcess": "Neuer Prozess",
    "createProcess": "Prozess erstellen",
    "editProcess": "Prozess bearbeiten",
    "deleteProcess": "Prozess löschen",
    "deleteConfirm": "Möchten Sie den Prozess \"{name}\" wirklich löschen?",
    "noProcesses": "Noch keine Prozesse angelegt",
    "selectProcess": "Prozess aus der Baumstruktur links auswählen",
    "search": "Prozesse suchen...",
    "tabs": {
      "overview": "Übersicht",
      "editor": "BPMN-Editor",
      "versions": "Versionen",
      "risks": "Risiken",
      "history": "Verlauf"
    },
    "fields": {
      "name": "Prozessname",
      "description": "Beschreibung",
      "level": "Ebene",
      "parent": "Übergeordneter Prozess",
      "owner": "Prozessverantwortlicher",
      "reviewer": "Prüfer",
      "department": "Abteilung",
      "notation": "Notation",
      "status": "Status",
      "isEssential": "Wesentlicher Prozess"
    },
    "levels": {
      "1": "Konzern",
      "2": "Unternehmen",
      "3": "Abteilung",
      "4": "Detail"
    },
    "status": {
      "draft": "Entwurf",
      "in_review": "In Prüfung",
      "approved": "Genehmigt",
      "published": "Veröffentlicht",
      "archived": "Archiviert"
    },
    "approval": {
      "submitForReview": "Zur Prüfung einreichen",
      "approve": "Genehmigen",
      "reject": "Zurückweisen",
      "publish": "Veröffentlichen",
      "archive": "Archivieren",
      "commentRequired": "Kommentar erforderlich",
      "commentOptional": "Kommentar (optional)",
      "confirmSubmit": "Prozess zur Prüfung einreichen?",
      "confirmApprove": "Prozess genehmigen?",
      "confirmReject": "Prozess zurückweisen?",
      "confirmPublish": "Prozess veröffentlichen? Alle Prozessverantwortlichen werden benachrichtigt.",
      "confirmArchive": "Prozess archivieren?"
    },
    "editor": {
      "save": "Speichern",
      "saving": "Speichert...",
      "saved": "Gespeichert",
      "unsavedChanges": "Nicht gespeicherte Änderungen",
      "changeSummary": "Änderungskommentar",
      "changeSummaryPlaceholder": "Was wurde geändert?",
      "export": "Exportieren",
      "exportXml": "BPMN XML (.bpmn)",
      "exportSvg": "SVG-Bild (.svg)",
      "exportPng": "PNG-Bild (.png)",
      "readOnly": "Nur Lesen",
      "loading": "BPMN-Editor wird geladen..."
    },
    "sidePanel": {
      "linkedRisks": "Verknüpfte Risiken",
      "noLinkedRisks": "Keine verknüpften Risiken",
      "linkRisk": "Risiko verknüpfen",
      "unlinkRisk": "Verknüpfung entfernen",
      "unlinkConfirm": "Verknüpfung von {riskId} mit {shapeName} wirklich entfernen?",
      "riskContext": "Warum ist dieses Risiko hier relevant?",
      "responsibleRole": "Verantwortliche Rolle",
      "controlsPlaceholder": "Kontrollen werden in Sprint 4 verfügbar",
      "searchRisks": "Risiko suchen (RSK-ID oder Titel)...",
      "alreadyLinked": "Dieses Risiko ist bereits verknüpft"
    },
    "risks": {
      "processRisks": "Prozessrisiken",
      "processRisksDesc": "Risiken die den Gesamtprozess betreffen",
      "stepRisks": "Schrittrisiken",
      "stepRisksDesc": "Risiken an einzelnen Prozessschritten",
      "processRisksBanner": "{count} Prozessrisiken"
    },
    "versions": {
      "title": "Versionsverlauf",
      "version": "Version {number}",
      "current": "Aktuelle Version",
      "view": "Ansehen",
      "restore": "Wiederherstellen",
      "restoreConfirm": "Version v{number} als aktuelle Version wiederherstellen?",
      "restoreSuccess": "Version v{number} wurde wiederhergestellt",
      "restoredFrom": "Wiederhergestellt aus Version v{number}",
      "compare": "Versionen vergleichen"
    },
    "ai": {
      "generateWithAi": "Mit KI generieren",
      "generating": "KI generiert Prozessmodell...",
      "generated": "KI-generierter Prozess",
      "preview": "Vorschau",
      "acceptAndEdit": "Übernehmen und bearbeiten",
      "regenerate": "Neu generieren",
      "descriptionTooShort": "Beschreibung muss mindestens 50 Zeichen lang sein",
      "generationFailed": "KI-Generierung fehlgeschlagen. Bitte versuchen Sie es erneut.",
      "industry": "Branchenkontext",
      "industries": {
        "generic": "Allgemein",
        "manufacturing": "Fertigung",
        "it_services": "IT-Dienstleistungen",
        "financial_services": "Finanzdienstleistungen",
        "healthcare": "Gesundheitswesen"
      }
    }
  }
}
```

### `messages/en/process.json`

```json
{
  "process": {
    "title": "Process Management",
    "landscape": "Process Landscape",
    "register": "Process Register",
    "newProcess": "New Process",
    "createProcess": "Create Process",
    "editProcess": "Edit Process",
    "deleteProcess": "Delete Process",
    "deleteConfirm": "Are you sure you want to delete the process \"{name}\"?",
    "noProcesses": "No processes created yet",
    "selectProcess": "Select a process from the tree on the left",
    "search": "Search processes...",
    "tabs": {
      "overview": "Overview",
      "editor": "BPMN Editor",
      "versions": "Versions",
      "risks": "Risks",
      "history": "History"
    },
    "fields": {
      "name": "Process Name",
      "description": "Description",
      "level": "Level",
      "parent": "Parent Process",
      "owner": "Process Owner",
      "reviewer": "Reviewer",
      "department": "Department",
      "notation": "Notation",
      "status": "Status",
      "isEssential": "Essential Process"
    },
    "levels": {
      "1": "Group",
      "2": "Company",
      "3": "Department",
      "4": "Detail"
    },
    "status": {
      "draft": "Draft",
      "in_review": "In Review",
      "approved": "Approved",
      "published": "Published",
      "archived": "Archived"
    },
    "approval": {
      "submitForReview": "Submit for Review",
      "approve": "Approve",
      "reject": "Reject",
      "publish": "Publish",
      "archive": "Archive",
      "commentRequired": "Comment required",
      "commentOptional": "Comment (optional)",
      "confirmSubmit": "Submit process for review?",
      "confirmApprove": "Approve this process?",
      "confirmReject": "Reject this process?",
      "confirmPublish": "Publish this process? All process owners will be notified.",
      "confirmArchive": "Archive this process?"
    },
    "editor": {
      "save": "Save",
      "saving": "Saving...",
      "saved": "Saved",
      "unsavedChanges": "Unsaved changes",
      "changeSummary": "Change Summary",
      "changeSummaryPlaceholder": "What was changed?",
      "export": "Export",
      "exportXml": "BPMN XML (.bpmn)",
      "exportSvg": "SVG Image (.svg)",
      "exportPng": "PNG Image (.png)",
      "readOnly": "Read Only",
      "loading": "Loading BPMN Editor..."
    },
    "sidePanel": {
      "linkedRisks": "Linked Risks",
      "noLinkedRisks": "No linked risks",
      "linkRisk": "Link Risk",
      "unlinkRisk": "Remove Link",
      "unlinkConfirm": "Really remove link of {riskId} from {shapeName}?",
      "riskContext": "Why is this risk relevant here?",
      "responsibleRole": "Responsible Role",
      "controlsPlaceholder": "Controls will be available in Sprint 4",
      "searchRisks": "Search risk (RSK-ID or title)...",
      "alreadyLinked": "This risk is already linked"
    },
    "risks": {
      "processRisks": "Process Risks",
      "processRisksDesc": "Risks affecting the entire process",
      "stepRisks": "Step Risks",
      "stepRisksDesc": "Risks at individual process steps",
      "processRisksBanner": "{count} process risks"
    },
    "versions": {
      "title": "Version History",
      "version": "Version {number}",
      "current": "Current Version",
      "view": "View",
      "restore": "Restore",
      "restoreConfirm": "Restore version v{number} as current version?",
      "restoreSuccess": "Version v{number} has been restored",
      "restoredFrom": "Restored from version v{number}",
      "compare": "Compare Versions"
    },
    "ai": {
      "generateWithAi": "Generate with AI",
      "generating": "AI generating process model...",
      "generated": "AI-Generated Process",
      "preview": "Preview",
      "acceptAndEdit": "Accept and Edit",
      "regenerate": "Regenerate",
      "descriptionTooShort": "Description must be at least 50 characters",
      "generationFailed": "AI generation failed. Please try again.",
      "industry": "Industry Context",
      "industries": {
        "generic": "Generic",
        "manufacturing": "Manufacturing",
        "it_services": "IT Services",
        "financial_services": "Financial Services",
        "healthcare": "Healthcare"
      }
    }
  }
}
```

---

# 9. npm Dependencies to Install

```bash
# BPMN editor (core dependency for Sprint 3)
npm install bpmn-js@latest --workspace=packages/ui
npm install -D @types/bpmn-js --workspace=packages/ui

# XML parsing for ProcessStep sync
npm install fast-xml-parser --workspace=packages/shared

# Already in project from Sprint 1/2 (verify):
# recharts, @tanstack/react-query, zod, drizzle-orm
```

**package.json additions for `packages/ui`:**
```json
{
  "dependencies": {
    "bpmn-js": "^17.x"
  }
}
```

**Important:** bpmn.js CSS must be imported in the BPMN editor component or in the global stylesheet:
```css
/* packages/ui/src/components/bpmn/bpmn-editor.css */
@import 'bpmn-js/dist/assets/diagram-js.css';
@import 'bpmn-js/dist/assets/bpmn-js.css';
@import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';

.bpmn-risk-badge {
  pointer-events: auto;
  transition: transform 0.15s ease;
}
.bpmn-risk-badge:hover {
  transform: scale(1.1);
}
```
