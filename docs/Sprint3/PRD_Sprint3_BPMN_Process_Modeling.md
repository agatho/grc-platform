# ARCTOS — Product Requirements Document

## Sprint 3: BPMN Process Modeling

Process Landscape + BPMN 2.0 Editor + Risk Overlays + Approval Workflow + Version Management + AI Generation

May 2026 — ~68 Story Points — 6 Epics — 24 User Stories

Based on: Data Model v1.0 (47 Entities) | ADRs v1.0 (ADR-001, ADR-002, ADR-003, ADR-011) | Gap Analysis v3.0 (P-01 to P-10) | Market Analysis (GBTEC BIC, intellior Aeneis, SAP Signavio) | Sprint 2 PRD (Risk Register)

---

# 1. Sprint Overview

### Goal

Sprint 3 builds the BPMN Process Modeling module of ARCTOS. After this sprint, users can model business processes using a native BPMN 2.0 editor (bpmn.js) directly in the browser, organize processes in a hierarchical process landscape (Group → Company → Department → Detail), link risks from the Sprint 2 Risk Register to individual BPMN shapes with visual overlay badges, manage process versions with full change history, run an approval workflow (draft → in_review → approved → published), and optionally generate BPMN diagrams from free-text descriptions using Claude AI. Sprint 3 fully satisfies requirements P-01 through P-08 (MUST + SHOULD). P-09 (simulation) and P-10 (process mining) remain Phase 3 features.

### Sprint Scope

| **Epic** | **Description** | **Req-Ref** | **Scope** | **Priority** |
| --- | --- | --- | --- | --- |
| **Epic 11** | Process Landscape & Navigation | P-03 | **12 SP** | **MUST** |
| **Epic 12** | BPMN 2.0 Editor Integration | P-01, P-02, P-04 | **16 SP** | **MUST** |
| **Epic 13** | Risk Overlays in BPMN Editor | P-05 | **12 SP** | **MUST** |
| **Epic 14** | Approval Workflow | P-06 | **10 SP** | **MUST** |
| **Epic 15** | Version Management | P-07 | **8 SP** | **MUST** |
| **Epic 16** | AI Process Generation | P-08 | **10 SP** | **SHOULD** |
| **TOTAL** | **6 Epics, 24 User Stories** | P-01–P-08 | **~68 SP** | |

### Dependencies

**Requires from Sprint 1 (completed):**
- Authentication (Clerk sessions, JWT tokens)
- RBAC middleware (`requireRole()`, `requireLineOfDefense()`)
- RLS policies (all new tables receive `org_id` + RLS)
- Audit Trail (`audit_trigger()` auto-registered on all new tables)
- UI Shell (Sidebar navigation, Org Switcher, i18n, notification system)
- Organization + User tables

**Requires from Sprint 1.2 (completed):**
- Email Service (Resend) — used for approval workflow notifications
- Email templates: `process_review_requested`, `process_approved`, `process_published`
- Task entity — used for creating review tasks on status transition

**Requires from Sprint 1.3 (completed):**
- Module System — `requireModule('bpm')` middleware on ALL Sprint 3 routes
- `<ModuleGate moduleKey="bpm">` wrapping ALL Sprint 3 pages
- Module definition seed: `bpm` module registered with nav_path `/processes`
- Dynamic sidebar rendering from `module_definition`

**Requires from Sprint 1.4 (completed):**
- Work Item System — Process detail pages display linked work items (Risks via `process_risk`)
- `WorkItemDetailLayout` is NOT used for processes (processes have their own layout with BPMN editor)
- Tab navigation UI pattern reused for Process detail tabs

**Requires from Sprint 2 (in development):**
- Risk entity (CRUD operational)
- `process_risk` join table (Migration 041) — risk linked to entire process
- `process_step_risk` join table (Migration 042) — risk linked to individual BPMN shape
- Risk List API: `GET /api/v1/risks` with filtering
- Sprint 2 migration numbers: 034–047

**Blocks:**
- Sprint 4 (Controls/ICS) — requires `process_control` + `process_step_control` join tables from Sprint 3
- Sprint 4 (Controls/ICS) — requires `process_step.bpmn_element_id` for control overlay badges in BPMN editor
- Sprint 6 (BCMS) — requires `process.is_essential` flag for BIA linking

**External Dependencies:**
- `bpmn-js` (Camunda) — BPMN 2.0 modeler/viewer, npm package
- `bpmn-js-properties-panel` — optional, for advanced BPMN property editing
- `@bpmn-io/element-template-chooser` — optional future extension
- Claude API (claude-sonnet-4-5) — for AI process generation (Epic 16)

**Sprint 3 starts at Migration 048.**

### Definition of Done (Sprint Level)

- All 24 user stories meet their acceptance criteria.
- All Sprint 3 API routes use `requireModule('bpm')` middleware — integration test: org with disabled BPM gets 404.
- All Sprint 3 pages use `<ModuleGate moduleKey="bpm">` — disabled BPM shows teaser page.
- BPMN editor loads, allows editing, and saves valid BPMN 2.0 XML to `process_version` table.
- ProcessStep records are automatically synchronized from BPMN XML on every save.
- Risk overlay badges appear on BPMN shapes when risks are linked via `process_step_risk`.
- Approval workflow: draft → in_review → approved → published transitions work with email notifications.
- Version history shows all saved versions with read-only BPMN viewer.
- RLS policies verified: User A (CWS) cannot see processes from Org B — integration tests pass.
- Audit trail: every process create/update/delete/status_change logged with before/after JSONB diff.
- Process landscape tree navigable with expand/collapse and drill-down.
- Code coverage: backend > 80%, frontend > 60%.
- All UI labels translated in DE + EN via next-intl.
- 0 TypeScript `any` types (except permitted type guards).
- BPMN XML export (XML, SVG, PNG) functional.
- Performance: all API endpoints < 200ms with 200 processes per org.

---

# 2. Database Scope Sprint 3

All tables receive: cross-cutting mandatory fields, `org_id` FK with RLS, `audit_trigger()` registration.

| **Table** | **Description** | **Epic** | **Type** |
| --- | --- | --- | --- |
| **process** | Core process entity: name, hierarchy, status, owner, level, notation | Epic 11 | New |
| **process_version** | BPMN XML version records per process with change summary | Epic 15 | New |
| **process_step** | Individual BPMN shapes synchronized from XML (tasks, gateways, events) | Epic 12 | New |
| **process_control** | m:n join: process linked to controls (placeholder for Sprint 4) | — | New (placeholder) |
| **process_step_control** | m:n join: process step linked to controls (placeholder for Sprint 4) | — | New (placeholder) |
| **process_risk** | m:n join: risk linked to entire process (ALTER TABLE for FK) | Epic 13 | Modify (Sprint 2) |
| **process_step_risk** | m:n join: risk linked to specific BPMN process step (ALTER TABLE for FK) | Epic 13 | Modify (Sprint 2) |

### Migration Order

```
048_create_process.sql                   ← Core entity + retroactive FK on process_risk
049_create_process_version.sql
050_create_process_step.sql              ← + retroactive FK on process_step_risk
051_create_process_control.sql           ← Placeholder Sprint 4
052_create_process_step_control.sql      ← Placeholder Sprint 4
053_enable_rls_process_tables.sql
054_register_audit_triggers_sprint3.sql
055_seed_demo_processes.sql
```

### Migration 048: `create_process.sql`

```sql
-- ============================================================================
-- Migration 048: Create process table + retroactive FK on process_risk
-- Sprint 3: BPMN Process Modeling
-- ============================================================================

-- Add 'call_activity' to step_type enum (Sprint 3 addition)
ALTER TYPE step_type ADD VALUE IF NOT EXISTS 'call_activity';

CREATE TABLE process (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES organization(id),
  parent_process_id   uuid REFERENCES process(id),
  name                varchar(500) NOT NULL,
  description         text,
  level               int NOT NULL DEFAULT 1
                        CHECK (level >= 1 AND level <= 10),
  notation            process_notation NOT NULL DEFAULT 'bpmn',
  status              process_status NOT NULL DEFAULT 'draft',
  process_owner_id    uuid REFERENCES "user"(id),
  reviewer_id         uuid REFERENCES "user"(id),
  department          varchar(255),
  current_version     int NOT NULL DEFAULT 1,
  is_essential        boolean NOT NULL DEFAULT false,
  published_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES "user"(id),
  updated_by          uuid REFERENCES "user"(id),
  deleted_at          timestamptz,
  deleted_by          uuid REFERENCES "user"(id)
);

-- Indexes
CREATE INDEX process_org_idx ON process(org_id);
CREATE INDEX process_parent_idx ON process(parent_process_id);
CREATE INDEX process_owner_idx ON process(process_owner_id);
CREATE INDEX process_status_idx ON process(org_id, status);
CREATE INDEX process_level_idx ON process(org_id, level);
CREATE INDEX process_deleted_idx ON process(org_id) WHERE deleted_at IS NULL;

-- Retroactive FK constraint on process_risk (created in Sprint 2 Migration 041)
ALTER TABLE process_risk
  ADD CONSTRAINT process_risk_process_fk
  FOREIGN KEY (process_id) REFERENCES process(id) ON DELETE CASCADE;

CREATE INDEX process_risk_process_idx ON process_risk(process_id);
```

### Migration 049: `create_process_version.sql`

```sql
-- ============================================================================
-- Migration 049: Create process_version table
-- Sprint 3: BPMN Process Modeling — Version Management
-- ============================================================================

CREATE TABLE process_version (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id      uuid NOT NULL REFERENCES process(id) ON DELETE CASCADE,
  org_id          uuid NOT NULL REFERENCES organization(id),
  version_number  int NOT NULL,
  bpmn_xml        text,
  diagram_json    jsonb,
  change_summary  text,
  is_current      boolean NOT NULL DEFAULT false,
  created_by      uuid REFERENCES "user"(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Constraints
ALTER TABLE process_version
  ADD CONSTRAINT process_version_unique UNIQUE (process_id, version_number);

-- Indexes
CREATE INDEX process_version_process_idx ON process_version(process_id);
CREATE INDEX process_version_current_idx ON process_version(process_id) WHERE is_current = true;
CREATE INDEX process_version_org_idx ON process_version(org_id);

-- Partial unique index: exactly one current version per process
CREATE UNIQUE INDEX process_version_one_current
  ON process_version(process_id)
  WHERE is_current = true;
```

### Migration 050: `create_process_step.sql`

```sql
-- ============================================================================
-- Migration 050: Create process_step table + retroactive FK on process_step_risk
-- Sprint 3: BPMN Process Modeling — ProcessStep sync from BPMN XML
-- ============================================================================

CREATE TABLE process_step (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id        uuid NOT NULL REFERENCES process(id) ON DELETE CASCADE,
  org_id            uuid NOT NULL REFERENCES organization(id),
  bpmn_element_id   varchar(255) NOT NULL,
  name              varchar(500),
  description       text,
  step_type         step_type NOT NULL DEFAULT 'task',
  responsible_role  varchar(255),
  sequence_order    int NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

-- Constraints
ALTER TABLE process_step
  ADD CONSTRAINT process_step_unique UNIQUE (process_id, bpmn_element_id);

-- Indexes
CREATE INDEX process_step_process_idx ON process_step(process_id);
CREATE INDEX process_step_org_idx ON process_step(org_id);
CREATE INDEX process_step_element_idx ON process_step(process_id, bpmn_element_id);
CREATE INDEX process_step_deleted_idx ON process_step(process_id) WHERE deleted_at IS NULL;

-- Retroactive FK constraint on process_step_risk (created in Sprint 2 Migration 042)
ALTER TABLE process_step_risk
  ADD CONSTRAINT process_step_risk_step_fk
  FOREIGN KEY (process_step_id) REFERENCES process_step(id) ON DELETE CASCADE;

CREATE INDEX process_step_risk_step_idx ON process_step_risk(process_step_id);
```

### Migration 051: `create_process_control.sql`

```sql
-- ============================================================================
-- Migration 051: Create process_control table (Placeholder for Sprint 4)
-- Sprint 3 creates the table, Sprint 4 adds UI and populates data
-- ============================================================================

CREATE TABLE process_control (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organization(id),
  process_id      uuid NOT NULL REFERENCES process(id) ON DELETE CASCADE,
  control_id      uuid NOT NULL,  -- FK → control added in Sprint 4 migration
  control_context text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES "user"(id)
);

-- Indexes
CREATE INDEX process_control_process_idx ON process_control(process_id);
CREATE INDEX process_control_control_idx ON process_control(control_id);
CREATE INDEX process_control_org_idx ON process_control(org_id);
```

### Migration 052: `create_process_step_control.sql`

```sql
-- ============================================================================
-- Migration 052: Create process_step_control table (Placeholder for Sprint 4)
-- Sprint 3 creates the table, Sprint 4 adds UI and populates data
-- ============================================================================

CREATE TABLE process_step_control (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organization(id),
  process_step_id uuid NOT NULL REFERENCES process_step(id) ON DELETE CASCADE,
  control_id      uuid NOT NULL,  -- FK → control added in Sprint 4 migration
  control_context text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES "user"(id)
);

-- Indexes
CREATE INDEX process_step_control_step_idx ON process_step_control(process_step_id);
CREATE INDEX process_step_control_control_idx ON process_step_control(control_id);
CREATE INDEX process_step_control_org_idx ON process_step_control(org_id);
```

### Migration 053: `enable_rls_process_tables.sql`

```sql
-- ============================================================================
-- Migration 053: Enable RLS on all Sprint 3 tables
-- Pattern: org_id = current_setting('app.current_org_id')::uuid
-- ============================================================================

-- process
ALTER TABLE process ENABLE ROW LEVEL SECURITY;
CREATE POLICY process_org_isolation ON process
  USING (org_id = current_setting('app.current_org_id')::uuid);
CREATE POLICY process_reporting_bypass ON process
  USING (current_setting('app.bypass_rls', true) = 'true');

-- process_version
ALTER TABLE process_version ENABLE ROW LEVEL SECURITY;
CREATE POLICY process_version_org_isolation ON process_version
  USING (org_id = current_setting('app.current_org_id')::uuid);
CREATE POLICY process_version_reporting_bypass ON process_version
  USING (current_setting('app.bypass_rls', true) = 'true');

-- process_step
ALTER TABLE process_step ENABLE ROW LEVEL SECURITY;
CREATE POLICY process_step_org_isolation ON process_step
  USING (org_id = current_setting('app.current_org_id')::uuid);
CREATE POLICY process_step_reporting_bypass ON process_step
  USING (current_setting('app.bypass_rls', true) = 'true');

-- process_control
ALTER TABLE process_control ENABLE ROW LEVEL SECURITY;
CREATE POLICY process_control_org_isolation ON process_control
  USING (org_id = current_setting('app.current_org_id')::uuid);
CREATE POLICY process_control_reporting_bypass ON process_control
  USING (current_setting('app.bypass_rls', true) = 'true');

-- process_step_control
ALTER TABLE process_step_control ENABLE ROW LEVEL SECURITY;
CREATE POLICY process_step_control_org_isolation ON process_step_control
  USING (org_id = current_setting('app.current_org_id')::uuid);
CREATE POLICY process_step_control_reporting_bypass ON process_step_control
  USING (current_setting('app.bypass_rls', true) = 'true');
```

### Migration 054: `register_audit_triggers_sprint3.sql`

```sql
-- ============================================================================
-- Migration 054: Register audit_trigger on all Sprint 3 tables
-- Uses existing audit_trigger() function from Sprint 1
-- ============================================================================

CREATE TRIGGER process_audit
  AFTER INSERT OR UPDATE OR DELETE ON process
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER process_version_audit
  AFTER INSERT OR UPDATE OR DELETE ON process_version
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER process_step_audit
  AFTER INSERT OR UPDATE OR DELETE ON process_step
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER process_control_audit
  AFTER INSERT OR UPDATE OR DELETE ON process_control
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER process_step_control_audit
  AFTER INSERT OR UPDATE OR DELETE ON process_step_control
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
```

### Migration 055: `seed_demo_processes.sql`

```sql
-- ============================================================================
-- Migration 055: Seed demo processes for development
-- Creates 3 processes per demo org with valid BPMN 2.0 XML
-- ============================================================================

-- Variables: use the demo org ID from Sprint 1 seed
-- Assumes demo org 'CWS-Boco' exists with known UUID

DO $$
DECLARE
  v_org_id uuid;
  v_owner_id uuid;
  v_proc_sales uuid;
  v_proc_procurement uuid;
  v_proc_it_support uuid;
  v_version_id uuid;
BEGIN
  -- Get demo org
  SELECT id INTO v_org_id FROM organization WHERE org_code = 'BS' LIMIT 1;
  SELECT id INTO v_owner_id FROM "user" WHERE org_id = v_org_id LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'No demo org found, skipping seed';
    RETURN;
  END IF;

  -- ── Process 1: Sales Order Process (Level 3 - Department) ──
  v_proc_sales := gen_random_uuid();
  INSERT INTO process (id, org_id, name, description, level, notation, status, process_owner_id, department, current_version, created_by)
  VALUES (v_proc_sales, v_org_id, 'Sales Order Processing', 'End-to-end sales order handling from inquiry to delivery confirmation', 3, 'bpmn', 'published', v_owner_id, 'Sales', 1, v_owner_id);

  v_version_id := gen_random_uuid();
  INSERT INTO process_version (id, process_id, org_id, version_number, bpmn_xml, change_summary, is_current, created_by)
  VALUES (v_version_id, v_proc_sales, v_org_id, 1,
  '<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_Sales" targetNamespace="http://arctos.io/bpmn">
  <bpmn:process id="Process_Sales" isExecutable="false" name="Sales Order Processing">
    <bpmn:startEvent id="StartEvent_1" name="Order Received">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="Task_CheckOrder" name="Check Order Completeness">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:exclusiveGateway id="Gateway_OrderValid" name="Order Valid?">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
      <bpmn:outgoing>Flow_4</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:userTask id="Task_ProcessOrder" name="Process Order">
      <bpmn:incoming>Flow_3</bpmn:incoming>
      <bpmn:outgoing>Flow_5</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="Task_RequestCorrection" name="Request Order Correction">
      <bpmn:incoming>Flow_4</bpmn:incoming>
      <bpmn:outgoing>Flow_6</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="Task_ConfirmDelivery" name="Confirm Delivery">
      <bpmn:incoming>Flow_5</bpmn:incoming>
      <bpmn:outgoing>Flow_7</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="EndEvent_1" name="Order Completed">
      <bpmn:incoming>Flow_7</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:endEvent id="EndEvent_2" name="Correction Requested">
      <bpmn:incoming>Flow_6</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_CheckOrder" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_CheckOrder" targetRef="Gateway_OrderValid" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Gateway_OrderValid" targetRef="Task_ProcessOrder" name="Yes" />
    <bpmn:sequenceFlow id="Flow_4" sourceRef="Gateway_OrderValid" targetRef="Task_RequestCorrection" name="No" />
    <bpmn:sequenceFlow id="Flow_5" sourceRef="Task_ProcessOrder" targetRef="Task_ConfirmDelivery" />
    <bpmn:sequenceFlow id="Flow_6" sourceRef="Task_RequestCorrection" targetRef="EndEvent_2" />
    <bpmn:sequenceFlow id="Flow_7" sourceRef="Task_ConfirmDelivery" targetRef="EndEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_Sales">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1"><dc:Bounds x="179" y="159" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_CheckOrder_di" bpmnElement="Task_CheckOrder"><dc:Bounds x="270" y="137" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_OrderValid_di" bpmnElement="Gateway_OrderValid" isMarkerVisible="true"><dc:Bounds x="425" y="152" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_ProcessOrder_di" bpmnElement="Task_ProcessOrder"><dc:Bounds x="530" y="137" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_RequestCorrection_di" bpmnElement="Task_RequestCorrection"><dc:Bounds x="530" y="260" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_ConfirmDelivery_di" bpmnElement="Task_ConfirmDelivery"><dc:Bounds x="690" y="137" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1"><dc:Bounds x="852" y="159" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_2_di" bpmnElement="EndEvent_2"><dc:Bounds x="692" y="282" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1"><di:waypoint x="215" y="177" /><di:waypoint x="270" y="177" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2"><di:waypoint x="370" y="177" /><di:waypoint x="425" y="177" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3"><di:waypoint x="475" y="177" /><di:waypoint x="530" y="177" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4"><di:waypoint x="450" y="202" /><di:waypoint x="450" y="300" /><di:waypoint x="530" y="300" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_5_di" bpmnElement="Flow_5"><di:waypoint x="630" y="177" /><di:waypoint x="690" y="177" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_6_di" bpmnElement="Flow_6"><di:waypoint x="630" y="300" /><di:waypoint x="692" y="300" /></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_7_di" bpmnElement="Flow_7"><di:waypoint x="790" y="177" /><di:waypoint x="852" y="177" /></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>',
  'Initial version — Sales Order Processing', true, v_owner_id);

  -- Seed ProcessSteps for Sales process
  INSERT INTO process_step (process_id, org_id, bpmn_element_id, name, step_type, sequence_order) VALUES
    (v_proc_sales, v_org_id, 'StartEvent_1', 'Order Received', 'event', 1),
    (v_proc_sales, v_org_id, 'Task_CheckOrder', 'Check Order Completeness', 'task', 2),
    (v_proc_sales, v_org_id, 'Gateway_OrderValid', 'Order Valid?', 'gateway', 3),
    (v_proc_sales, v_org_id, 'Task_ProcessOrder', 'Process Order', 'task', 4),
    (v_proc_sales, v_org_id, 'Task_RequestCorrection', 'Request Order Correction', 'task', 5),
    (v_proc_sales, v_org_id, 'Task_ConfirmDelivery', 'Confirm Delivery', 'task', 6),
    (v_proc_sales, v_org_id, 'EndEvent_1', 'Order Completed', 'event', 7),
    (v_proc_sales, v_org_id, 'EndEvent_2', 'Correction Requested', 'event', 8);

  -- ── Process 2: Procurement Process (Level 3 - Department) ──
  v_proc_procurement := gen_random_uuid();
  INSERT INTO process (id, org_id, name, description, level, notation, status, process_owner_id, department, current_version, created_by)
  VALUES (v_proc_procurement, v_org_id, 'Procurement Process', 'Purchase requisition through goods receipt and invoice verification', 3, 'bpmn', 'draft', v_owner_id, 'Procurement', 1, v_owner_id);

  INSERT INTO process_version (process_id, org_id, version_number, bpmn_xml, change_summary, is_current, created_by)
  VALUES (v_proc_procurement, v_org_id, 1,
  '<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_Procurement" targetNamespace="http://arctos.io/bpmn">
  <bpmn:process id="Process_Procurement" isExecutable="false" name="Procurement Process">
    <bpmn:startEvent id="Start_PR" name="Purchase Request"><bpmn:outgoing>F1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="Task_Approve_PR" name="Approve Purchase Request"><bpmn:incoming>F1</bpmn:incoming><bpmn:outgoing>F2</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="Task_Create_PO" name="Create Purchase Order"><bpmn:incoming>F2</bpmn:incoming><bpmn:outgoing>F3</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="Task_Receive_Goods" name="Receive Goods"><bpmn:incoming>F3</bpmn:incoming><bpmn:outgoing>F4</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="Task_Verify_Invoice" name="Verify Invoice"><bpmn:incoming>F4</bpmn:incoming><bpmn:outgoing>F5</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="End_Payment" name="Payment Processed"><bpmn:incoming>F5</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="Start_PR" targetRef="Task_Approve_PR" />
    <bpmn:sequenceFlow id="F2" sourceRef="Task_Approve_PR" targetRef="Task_Create_PO" />
    <bpmn:sequenceFlow id="F3" sourceRef="Task_Create_PO" targetRef="Task_Receive_Goods" />
    <bpmn:sequenceFlow id="F4" sourceRef="Task_Receive_Goods" targetRef="Task_Verify_Invoice" />
    <bpmn:sequenceFlow id="F5" sourceRef="Task_Verify_Invoice" targetRef="End_Payment" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_2">
    <bpmndi:BPMNPlane id="BPMNPlane_2" bpmnElement="Process_Procurement">
      <bpmndi:BPMNShape id="Start_PR_di" bpmnElement="Start_PR"><dc:Bounds x="179" y="159" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Approve_PR_di" bpmnElement="Task_Approve_PR"><dc:Bounds x="270" y="137" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Create_PO_di" bpmnElement="Task_Create_PO"><dc:Bounds x="420" y="137" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Receive_Goods_di" bpmnElement="Task_Receive_Goods"><dc:Bounds x="570" y="137" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Verify_Invoice_di" bpmnElement="Task_Verify_Invoice"><dc:Bounds x="720" y="137" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_Payment_di" bpmnElement="End_Payment"><dc:Bounds x="872" y="159" width="36" height="36" /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>',
  'Initial version — Procurement Process', true, v_owner_id);

  -- ── Process 3: IT Support Process (Level 3 - Department) ──
  v_proc_it_support := gen_random_uuid();
  INSERT INTO process (id, org_id, name, description, level, notation, status, process_owner_id, department, current_version, created_by)
  VALUES (v_proc_it_support, v_org_id, 'IT Incident Management', 'IT support ticket handling from report to resolution', 3, 'bpmn', 'approved', v_owner_id, 'IT', 1, v_owner_id);

  INSERT INTO process_version (process_id, org_id, version_number, bpmn_xml, change_summary, is_current, created_by)
  VALUES (v_proc_it_support, v_org_id, 1,
  '<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_IT" targetNamespace="http://arctos.io/bpmn">
  <bpmn:process id="Process_IT" isExecutable="false" name="IT Incident Management">
    <bpmn:startEvent id="Start_Incident" name="Incident Reported"><bpmn:outgoing>IF1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="Task_Classify" name="Classify Incident"><bpmn:incoming>IF1</bpmn:incoming><bpmn:outgoing>IF2</bpmn:outgoing></bpmn:userTask>
    <bpmn:exclusiveGateway id="GW_Severity" name="Severity Level?"><bpmn:incoming>IF2</bpmn:incoming><bpmn:outgoing>IF3</bpmn:outgoing><bpmn:outgoing>IF4</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:userTask id="Task_L1_Support" name="L1 Support Resolution"><bpmn:incoming>IF3</bpmn:incoming><bpmn:outgoing>IF5</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="Task_L2_Escalation" name="L2 Escalation"><bpmn:incoming>IF4</bpmn:incoming><bpmn:outgoing>IF6</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="Task_Verify_Resolution" name="Verify Resolution"><bpmn:incoming>IF5</bpmn:incoming><bpmn:incoming>IF6</bpmn:incoming><bpmn:outgoing>IF7</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="End_Resolved" name="Incident Resolved"><bpmn:incoming>IF7</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="IF1" sourceRef="Start_Incident" targetRef="Task_Classify" />
    <bpmn:sequenceFlow id="IF2" sourceRef="Task_Classify" targetRef="GW_Severity" />
    <bpmn:sequenceFlow id="IF3" sourceRef="GW_Severity" targetRef="Task_L1_Support" name="Low/Medium" />
    <bpmn:sequenceFlow id="IF4" sourceRef="GW_Severity" targetRef="Task_L2_Escalation" name="High/Critical" />
    <bpmn:sequenceFlow id="IF5" sourceRef="Task_L1_Support" targetRef="Task_Verify_Resolution" />
    <bpmn:sequenceFlow id="IF6" sourceRef="Task_L2_Escalation" targetRef="Task_Verify_Resolution" />
    <bpmn:sequenceFlow id="IF7" sourceRef="Task_Verify_Resolution" targetRef="End_Resolved" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_3">
    <bpmndi:BPMNPlane id="BPMNPlane_3" bpmnElement="Process_IT">
      <bpmndi:BPMNShape id="Start_Incident_di" bpmnElement="Start_Incident"><dc:Bounds x="179" y="209" width="36" height="36" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Classify_di" bpmnElement="Task_Classify"><dc:Bounds x="270" y="187" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="GW_Severity_di" bpmnElement="GW_Severity" isMarkerVisible="true"><dc:Bounds x="425" y="202" width="50" height="50" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_L1_Support_di" bpmnElement="Task_L1_Support"><dc:Bounds x="530" y="137" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_L2_Escalation_di" bpmnElement="Task_L2_Escalation"><dc:Bounds x="530" y="260" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_Verify_Resolution_di" bpmnElement="Task_Verify_Resolution"><dc:Bounds x="690" y="187" width="100" height="80" /></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_Resolved_di" bpmnElement="End_Resolved"><dc:Bounds x="852" y="209" width="36" height="36" /></bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>',
  'Initial version — IT Incident Management', true, v_owner_id);

  RAISE NOTICE 'Seeded 3 demo processes for org %', v_org_id;
END $$;
```

---

# 3. Epic 11: Process Landscape & Navigation (12 SP)

**Ref:** P-03 (Hierarchical process landscape). **ADR-001** (RLS), **ADR-002** (API Routes).

### US-11.1: Hierarchical Process Tree View (5 SP) — MUST

**As** a process_owner, **I want** to see all processes organized in a hierarchical tree (Group → Company → Department → Detail), **so that** I can navigate the process landscape with expand/collapse drill-down.

**Acceptance Criteria:**
- **AC-1:** Left sidebar shows a tree view of all processes for the current organization, grouped by `level` and `parent_process_id`.
- **AC-2:** Root-level processes (level 1, parent_process_id = NULL) appear at top of tree. Child processes nest underneath their parent with indentation.
- **AC-3:** Each tree node shows: process name, status badge (colored: draft=gray, in_review=yellow, approved=blue, published=green, archived=red), process level indicator.
- **AC-4:** Clicking a tree node navigates to the process detail page (`/processes/[id]`).
- **AC-5:** Tree supports expand/collapse per node. Collapse state persisted in localStorage.
- **AC-6:** Empty state: "Noch keine Prozesse angelegt" / "No processes created yet" with "Create Process" button.
- **AC-7:** Tree loads incrementally: only root nodes on page load, children fetched on expand (lazy loading).
- **AC-8:** Search input above tree filters processes by name (client-side filter on loaded nodes, server-side for deeper search).

### US-11.2: Create Process (3 SP) — MUST

**As** a process_owner or admin, **I want** to create a new process with metadata (name, level, parent, owner, department, notation), **so that** I can start documenting a business process.

**Acceptance Criteria:**
- **AC-1:** "+ New Process" button in the process landscape header.
- **AC-2:** Create form shows: Name (required), Description (textarea), Level (dropdown 1-4+), Parent Process (tree-select from existing processes, optional), Process Owner (user select), Reviewer (user select), Department (text input), Notation (dropdown: BPMN 2.0 — only option in Sprint 3).
- **AC-3:** On submit: POST /api/v1/processes creates a new process with status `draft`.
- **AC-4:** A ProcessVersion (version_number=1) is created simultaneously with an empty BPMN XML template:
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <bpmn:definitions xmlns:bpmn="..." id="Definitions_1" targetNamespace="http://arctos.io/bpmn">
    <bpmn:process id="Process_1" isExecutable="false" name="[Process Name]">
      <bpmn:startEvent id="StartEvent_1" name="Start" />
    </bpmn:process>
  </bpmn:definitions>
  ```
- **AC-5:** After creation, navigate to process detail page `/processes/[id]` with BPMN Editor tab active.
- **AC-6:** Validation: Name required, min 3 chars. Level required, 1-10 range. Zod schema enforced.
- **AC-7:** Roles: admin, process_owner can create. Others get 403.

### US-11.3: Edit Process Metadata (2 SP) — MUST

**As** a process_owner, **I want** to edit process metadata (name, description, owner, reviewer, department, level), **so that** I can keep process information current.

**Acceptance Criteria:**
- **AC-1:** "Edit" button on process detail page header (visible only to admin, process_owner of this process).
- **AC-2:** Opens inline edit form or slide-over panel with pre-filled fields.
- **AC-3:** PUT /api/v1/processes/:id updates the process. Only metadata fields — not status, not BPMN XML.
- **AC-4:** Status cannot be changed via this endpoint (use PUT /processes/:id/status instead).
- **AC-5:** Changing `parent_process_id` validates no circular reference (A → B → A).
- **AC-6:** Audit log records the change with before/after diff.

### US-11.4: Process Detail Page with Tab Navigation (2 SP) — MUST

**As** a user, **I want** a process detail page with tabs (Overview, BPMN Editor, Versions, Risks, History), **so that** I can access all process information from one page.

**Acceptance Criteria:**
- **AC-1:** Route: `/processes/[id]` renders ProcessDetailPage.
- **AC-2:** Header: Process name (editable for owner/admin), status badge, level badge, process owner name, reviewer name, department.
- **AC-3:** Tab bar with 5 tabs: Overview | BPMN Editor | Versions | Risks | History.
- **AC-4:** Default active tab: "Overview" for viewers, "BPMN Editor" for process_owner/admin.
- **AC-5:** Tab state preserved in URL hash: `/processes/[id]#editor`, `/processes/[id]#versions`, etc.
- **AC-6:** Approval action buttons in header area (context-dependent on current status + user role).
- **AC-7:** 404 page if process not found or deleted (soft-delete check).
- **AC-8:** `<ModuleGate moduleKey="bpm">` wraps the entire page.

---

# 4. Epic 12: BPMN 2.0 Editor Integration (16 SP)

**Ref:** P-01 (Native BPMN 2.0), P-02 (Notation), P-04 (Export). **ADR-003** (bpmn.js).

### US-12.1: bpmn.js Editor React Component (5 SP) — MUST

**As** a process_owner, **I want** to model BPMN 2.0 diagrams directly in the browser using a full-featured editor, **so that** I can create and edit process flows visually.

**Acceptance Criteria:**
- **AC-1:** `<BpmnEditor>` React component in `packages/ui/src/components/bpmn/BpmnEditor.tsx`.
- **AC-2:** Uses `bpmn-js/lib/Modeler` for edit mode. Renders into a `useRef` DOM container.
- **AC-3:** Full BPMN 2.0 palette available: tasks, gateways, events, pools/lanes, subprocesses, annotations, data objects.
- **AC-4:** Loads BPMN XML from props (`initialXml: string`) via `modeler.importXML(xml)`.
- **AC-5:** Provides `onSave` callback that exports current XML via `modeler.saveXML({ format: true })`.
- **AC-6:** Properly handles React lifecycle: mounts on `useEffect`, calls `modeler.destroy()` on unmount cleanup.
- **AC-7:** Handles re-mounting: if `initialXml` prop changes, re-imports XML and rebuilds overlays.
- **AC-8:** Mini-map enabled in bottom-right corner.
- **AC-9:** Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Y (redo), Ctrl+S (save — triggers onSave callback), Delete (remove element).

### US-12.2: Read-Only BPMN Viewer (2 SP) — MUST

**As** a viewer, **I want** to see the published BPMN diagram without editing capabilities, **so that** I can understand the process flow.

**Acceptance Criteria:**
- **AC-1:** `<BpmnViewer>` React component in `packages/ui/src/components/bpmn/BpmnViewer.tsx`.
- **AC-2:** Uses `bpmn-js/lib/NavigatedViewer` (navigation + zoom, no editing).
- **AC-3:** Shows the same overlays as the editor (risk badges etc.).
- **AC-4:** No palette, no context pad, no properties panel.
- **AC-5:** Zoom controls: mouse wheel, fit-to-screen button, zoom-in/out buttons.
- **AC-6:** Used in: Version history "View" modal, read-only mode for non-editors, mobile SVG fallback.

### US-12.3: Save BPMN and Create Version (3 SP) — MUST

**As** a process_owner, **I want** to save my BPMN diagram, creating a new version each time, **so that** every change is preserved in the version history.

**Acceptance Criteria:**
- **AC-1:** Save button in BPMN editor toolbar triggers `POST /api/v1/processes/:id/versions`.
- **AC-2:** Before save: prompt for "Change Summary" (optional text, max 500 chars).
- **AC-3:** Server-side: creates new ProcessVersion record with incremented version_number.
- **AC-4:** Server-side: sets `is_current = false` on all previous versions of this process, sets `is_current = true` on the new version.
- **AC-5:** Server-side: updates `process.current_version` to the new version number.
- **AC-6:** Server-side: triggers ProcessStep auto-sync (US-12.4).
- **AC-7:** "Unsaved changes" indicator appears in toolbar when BPMN has been modified since last save.
- **AC-8:** Warn user on navigation away with unsaved changes (browser `beforeunload` event).
- **AC-9:** Optimistic UI: save button shows spinner, then "Saved ✓" for 2 seconds.

### US-12.4: ProcessStep Auto-Sync from BPMN XML (3 SP) — MUST

**As** the system, **I want** to automatically synchronize ProcessStep records from the saved BPMN XML, **so that** each BPMN shape has a corresponding database record for risk/control linkage.

**Acceptance Criteria:**
- **AC-1:** On BPMN save (POST /processes/:id/versions): parse the saved XML server-side.
- **AC-2:** Extract all elements of these BPMN types:
  - `bpmn:task`, `bpmn:userTask`, `bpmn:serviceTask`, `bpmn:sendTask`, `bpmn:receiveTask`, `bpmn:manualTask`, `bpmn:businessRuleTask`, `bpmn:scriptTask` → step_type = 'task'
  - `bpmn:exclusiveGateway`, `bpmn:parallelGateway`, `bpmn:inclusiveGateway`, `bpmn:eventBasedGateway`, `bpmn:complexGateway` → step_type = 'gateway'
  - `bpmn:startEvent`, `bpmn:endEvent`, `bpmn:intermediateCatchEvent`, `bpmn:intermediateThrowEvent`, `bpmn:boundaryEvent` → step_type = 'event'
  - `bpmn:subProcess`, `bpmn:adHocSubProcess`, `bpmn:transaction` → step_type = 'subprocess'
  - `bpmn:callActivity` → step_type = 'call_activity'
- **AC-3:** For each extracted element: UPSERT into process_step (match on `process_id + bpmn_element_id`). Set `name` from BPMN element's `name` attribute. Set `step_type` from mapping above.
- **AC-4:** For elements present in DB but NOT in the new XML: soft-delete (set `deleted_at = now()`).
- **AC-5:** For elements that were soft-deleted but reappear in XML: restore (set `deleted_at = NULL`).
- **AC-6:** Sequence order determined by document order in XML.
- **AC-7:** BPMN XML parsing uses a lightweight XML parser (e.g. `fast-xml-parser` or `xml2js`) — NOT a full BPMN engine.

### US-12.5: BPMN Export (XML, SVG, PNG) (3 SP) — SHOULD

**As** a process_owner, **I want** to export the BPMN diagram in multiple formats, **so that** I can share it in presentations and documents.

**Acceptance Criteria:**
- **AC-1:** Export dropdown in toolbar with 3 options: "BPMN XML (.bpmn)", "SVG Image (.svg)", "PNG Image (.png)".
- **AC-2:** BPMN XML: direct download of the stored `bpmn_xml` from the current version.
- **AC-3:** SVG: client-side export via `modeler.saveSVG()` → download as .svg file.
- **AC-4:** PNG: client-side — render SVG to canvas, export canvas as PNG blob, download.
- **AC-5:** Filename pattern: `[process-name]_v[version].[ext]`, e.g. `sales-order-processing_v3.bpmn`.

---

# 5. Epic 13: Risk Overlays in BPMN Editor (12 SP)

**Ref:** P-05 (Process ↔ Risk linkage). **ADR-003** (bpmn.js Overlay API).

### US-13.1: Risk Badge Overlays on BPMN Shapes (4 SP) — MUST

**As** a user, **I want** to see red badges on BPMN shapes that have linked risks, showing the risk count and highest score, **so that** I can immediately identify high-risk process steps.

**Acceptance Criteria:**
- **AC-1:** `RiskOverlayExtension` module in `packages/ui/src/components/bpmn/RiskOverlayExtension.ts`.
- **AC-2:** For each BPMN shape that has entries in `process_step_risk`: render a badge overlay in the top-right corner of the shape.
- **AC-3:** Badge format: `[count] | [colored score]` — e.g. "3 | 🔴 20". Color coding: green ≤8, yellow 9-15, red >15 (based on `risk_score_inherent`).
- **AC-4:** Badge uses bpmn.js Overlay API: `overlays.add(elementId, 'risk-badge', { position: { top: -12, right: -12 }, html: '<div class="risk-badge">...</div>' })`.
- **AC-5:** Overlays are rebuilt after every `importXML()` call (bpmn.js clears overlays on re-import).
- **AC-6:** Risk data fetched via `GET /api/v1/processes/:id/step-risks` on editor mount and after every risk link/unlink operation.
- **AC-7:** Polling: risk badge data refreshed every 30 seconds to catch changes by other users. React Query with `refetchInterval: 30000`.
- **AC-8:** Process-level risks (from `process_risk` table) shown as a banner above the BPMN editor: "⚠️ 2 Prozessrisiken" / "⚠️ 2 Process Risks".

### US-13.2: Shape Click Side Panel (3 SP) — MUST

**As** a user, **I want** to click on a BPMN shape to open a right-side panel showing linked risks and metadata, **so that** I can inspect and manage risk linkages per process step.

**Acceptance Criteria:**
- **AC-1:** Click on any BPMN shape (via `eventBus.on('element.click', callback)`) opens a right side panel (30% width, slide-in animation).
- **AC-2:** Side panel header: BPMN shape name + type icon (task icon, gateway icon, event icon).
- **AC-3:** Section "Linked Risks": list of all risks linked to this shape via `process_step_risk`. Each risk shows: RSK element ID, title, inherent risk score badge, status badge, link to risk detail page.
- **AC-4:** Section "Responsible Role": text input showing `process_step.responsible_role`. Editable by process_owner/admin.
- **AC-5:** Section "Controls (Sprint 4)": placeholder text "Kontrollen werden in Sprint 4 verfügbar" / "Controls will be available in Sprint 4".
- **AC-6:** Panel closes on: click outside, ESC key, click X button, click on canvas (not a shape).
- **AC-7:** Panel shows empty state "Keine verknüpften Risiken" / "No linked risks" when no risks are linked.

### US-13.3: Link Risk to Process Step (3 SP) — MUST

**As** a risk_manager or process_owner, **I want** to link an existing risk to a BPMN shape, **so that** the process-risk relationship is documented and visible in the BPMN diagram.

**Acceptance Criteria:**
- **AC-1:** "Link Risk" button in the side panel opens an autocomplete search field.
- **AC-2:** Search calls `GET /api/v1/risks?search=[query]&limit=10` and shows results as dropdown.
- **AC-3:** Each search result shows: RSK element ID, title, risk score badge, category.
- **AC-4:** Selecting a risk: POST /api/v1/processes/:processId/steps/:stepId/risks with `{ riskId, riskContext }`.
- **AC-5:** `riskContext` is an optional text field: "Why is this risk relevant to this process step?"
- **AC-6:** After linking: risk appears in the side panel list, badge on the BPMN shape updates immediately.
- **AC-7:** Duplicate check: if risk is already linked to this step, show validation error "Dieses Risiko ist bereits verknüpft" / "This risk is already linked".
- **AC-8:** Roles: admin, process_owner, risk_manager can link risks. Others see the list but not the "Link Risk" button.

### US-13.4: Unlink Risk from Process Step (1 SP) — MUST

**As** a risk_manager, **I want** to remove a risk linkage from a BPMN shape, **so that** outdated linkages can be cleaned up.

**Acceptance Criteria:**
- **AC-1:** Each linked risk in the side panel has an "Unlink" icon button (trash icon with confirmation).
- **AC-2:** Confirmation dialog: "Verknüpfung von [RSK-ID] mit [Shape Name] wirklich entfernen?" / "Really remove link of [RSK-ID] from [Shape Name]?"
- **AC-3:** DELETE /api/v1/processes/:processId/steps/:stepId/risks/:riskId removes the `process_step_risk` record.
- **AC-4:** After unlinking: risk disappears from side panel list, badge count on BPMN shape updates immediately.
- **AC-5:** Roles: admin, process_owner, risk_manager can unlink.

### US-13.5: Process-Level Risk Linkage (1 SP) — MUST

**As** a risk_manager, **I want** to link risks to an entire process (not a specific shape), **so that** risks affecting the overall process are documented.

**Acceptance Criteria:**
- **AC-1:** On the Risks tab of the process detail page: section "Process Risks" with "Link Risk" button.
- **AC-2:** Same autocomplete search as US-13.3 but creates a `process_risk` record (not `process_step_risk`).
- **AC-3:** Process-level risks shown as a banner above the BPMN editor.
- **AC-4:** POST /api/v1/processes/:processId/risks with `{ riskId, riskContext }`.
- **AC-5:** DELETE /api/v1/processes/:processId/risks/:riskId to unlink.

---

# 6. Epic 14: Approval Workflow (10 SP)

**Ref:** P-06 (Approval workflow). Uses Sprint 1.2 Email Service.

### US-14.1: Status Transitions (4 SP) — MUST

**As** a process participant, **I want** to transition a process through its approval workflow, **so that** processes are reviewed and approved before publication.

**Acceptance Criteria:**
- **AC-1:** Status flow: `draft → in_review → approved → published → archived`.
- **AC-2:** Reverse transitions: `approved → in_review` (reopen for review), `published → archived`.
- **AC-3:** Transition roles:
  - `draft → in_review`: process_owner, admin (submits for review)
  - `in_review → approved`: reviewer (assigned), auditor, admin (approves)
  - `approved → published`: admin only (publishes to all viewers)
  - `published → archived`: admin only
  - `approved → in_review`: reviewer, admin (sends back for revision)
- **AC-4:** PUT /api/v1/processes/:id/status with body `{ status: 'in_review', comment: '...' }`.
- **AC-5:** Comment field required on `in_review → approved` and `approved → in_review` transitions.
- **AC-6:** On `approved → published`: set `process.published_at = now()`.
- **AC-7:** Only processes with at least one saved BPMN version can transition from `draft → in_review`.
- **AC-8:** Audit log records every status transition with old status, new status, comment, and user.

### US-14.2: Approval Action Buttons (3 SP) — MUST

**As** a user, **I want** to see context-dependent approval buttons on the process detail page, **so that** I can take the next workflow action directly.

**Acceptance Criteria:**
- **AC-1:** Buttons appear in the process detail page header, next to the status badge.
- **AC-2:** Button visibility based on current status + user role:
  - `draft`: "Zur Prüfung einreichen" / "Submit for Review" (process_owner, admin)
  - `in_review`: "Genehmigen" / "Approve" + "Zurückweisen" / "Reject" (reviewer, auditor, admin)
  - `approved`: "Veröffentlichen" / "Publish" (admin)
  - `published`: "Archivieren" / "Archive" (admin)
- **AC-3:** "Reject" button transitions back to `draft` (not `in_review`), with required comment.
- **AC-4:** Button click opens confirmation dialog with optional/required comment field.
- **AC-5:** Buttons use distinct colors: Submit=blue, Approve=green, Reject=red, Publish=green, Archive=gray.

### US-14.3: Email Notifications on Transitions (3 SP) — MUST

**As** a reviewer, **I want** to receive email notifications when a process needs my review, **so that** I don't miss review requests.

**Acceptance Criteria:**
- **AC-1:** `draft → in_review`: Email to assigned reviewer. Template: `process_review_requested`. Subject: "Prozess zur Prüfung: [Process Name]" / "Process review requested: [Process Name]".
- **AC-2:** `in_review → approved`: Email to process owner. Template: `process_approved`. Subject: "Prozess genehmigt: [Process Name]" / "Process approved: [Process Name]".
- **AC-3:** `approved → published`: Email to all users with `process_owner` role in the org. Template: `process_published`. Subject: "Prozess veröffentlicht: [Process Name]" / "Process published: [Process Name]".
- **AC-4:** `approved → in_review` (rejection): Email to process owner. Template: `process_review_rejected`. Subject: "Prozess zurückgewiesen: [Process Name]" / "Process review rejected: [Process Name]".
- **AC-5:** All emails contain: process name, status change, reviewer/approver name, comment (if provided), link to process detail page.
- **AC-6:** Uses Sprint 1.2 EmailService with Resend.

---

# 7. Epic 15: Version Management (8 SP)

**Ref:** P-07 (Versioning).

### US-15.1: Version History Timeline (3 SP) — MUST

**As** a user, **I want** to see a timeline of all process versions, **so that** I can track the evolution of the process diagram.

**Acceptance Criteria:**
- **AC-1:** Versions tab shows a vertical timeline, newest version at top.
- **AC-2:** Each version card shows: version number ("v3"), creation date (formatted: "24.03.2026 14:32"), creator name, change summary text, `is_current` badge on the current version.
- **AC-3:** GET /api/v1/processes/:id/versions returns all versions ordered by version_number DESC.
- **AC-4:** "View" button on each version opens a modal with read-only BpmnViewer showing that version's XML.
- **AC-5:** "Restore" button visible only for admin role. Opens confirmation dialog: "Version v[N] als aktuelle Version wiederherstellen?" / "Restore version v[N] as current version?"

### US-15.2: Restore Previous Version (3 SP) — MUST

**As** an admin, **I want** to restore a previous version of a process diagram, **so that** accidental changes can be reverted.

**Acceptance Criteria:**
- **AC-1:** POST /api/v1/processes/:id/versions/restore with body `{ fromVersionNumber: N }`.
- **AC-2:** Creates a NEW version (next version_number) with the XML content copied from version N.
- **AC-3:** Change summary auto-set: "Restored from version v[N]".
- **AC-4:** ProcessStep auto-sync runs on the restored XML.
- **AC-5:** Original version remains unchanged in the timeline.
- **AC-6:** Admin role required — others receive 403.

### US-15.3: Version Comparison (2 SP) — SHOULD

**As** a reviewer, **I want** to compare two versions of a process side by side, **so that** I can understand what changed.

**Acceptance Criteria:**
- **AC-1:** "Compare" button on the Versions tab allows selecting two versions.
- **AC-2:** Side-by-side display: left = older version (BpmnViewer), right = newer version (BpmnViewer).
- **AC-3:** Below the diagrams: text diff of the change summaries.
- **AC-4:** Simple visual comparison (no element-level diffing in Sprint 3 — full diff is Phase 2).

---

# 8. Epic 16: AI Process Generation (10 SP) — SHOULD

**Ref:** P-08 (AI process generation). Uses `packages/ai` (Claude API).

### US-16.1: AI Generation Form (3 SP) — SHOULD

**As** a process_owner, **I want** to describe a process in natural language and have AI generate a BPMN diagram, **so that** I can quickly create a first draft.

**Acceptance Criteria:**
- **AC-1:** "Generate with AI" button on the create process form and in the BPMN editor toolbar.
- **AC-2:** Opens a modal with: Process Name (pre-filled if available), Description textarea (min 50 chars, max 2000 chars), Industry context dropdown (optional: Manufacturing, IT Services, Financial Services, Healthcare, Generic).
- **AC-3:** "Generate" button triggers the AI call.
- **AC-4:** Loading state: spinning animation with "KI generiert Prozessmodell..." / "AI generating process model..."
- **AC-5:** Error handling: if Claude API fails, show error message and allow retry.

### US-16.2: AI BPMN Generation Backend (4 SP) — SHOULD

**As** the system, **I want** to call the Claude API with a structured prompt to generate valid BPMN 2.0 XML, **so that** users can bootstrap process models from descriptions.

**Acceptance Criteria:**
- **AC-1:** POST /api/v1/processes/generate-bpmn with body `{ name, description, industry }`.
- **AC-2:** Calls Claude API (claude-sonnet-4-5) with system prompt that enforces valid BPMN 2.0 XML output.
- **AC-3:** System prompt includes: BPMN 2.0 XML schema requirements, valid element types, required namespaces, diagram layout coordinates.
- **AC-4:** Response validation: parse returned XML, verify it contains at least one `<bpmn:startEvent>` and one `<bpmn:endEvent>`, verify it has `<bpmndi:BPMNDiagram>` with layout.
- **AC-5:** If validation fails: retry once with error feedback to Claude, then return error to user.
- **AC-6:** Rate limiting: max 10 AI generations per user per hour.
- **AC-7:** Response includes the generated BPMN XML string.

### US-16.3: AI Preview and Accept (3 SP) — SHOULD

**As** a process_owner, **I want** to preview the AI-generated BPMN before accepting it, **so that** I can verify the result before it becomes my process diagram.

**Acceptance Criteria:**
- **AC-1:** After AI generation: show generated BPMN in a BpmnViewer modal.
- **AC-2:** Two action buttons: "Accept and Edit" (loads into editor), "Regenerate" (calls AI again).
- **AC-3:** "Accept and Edit": replaces the current BPMN editor content with the generated XML. Marks as unsaved.
- **AC-4:** If used from the create process form: creates the process + first version with the generated XML.
- **AC-5:** AI-generated flag: set `process_version.change_summary = 'AI-generated from description'`.

---

# 9. API Endpoints

All endpoints use middleware chain: `requireAuth() → requireModule('bpm') → orgContextMiddleware → requireRole([...]) → handler`

| Method | Path | Roles | Description |
| --- | --- | --- | --- |
| GET | /api/v1/processes | all | List processes (filterable by level, status, owner, parent_id, search) |
| GET | /api/v1/processes/tree | all | Get process tree structure (hierarchical, lazy-loadable) |
| POST | /api/v1/processes | admin, process_owner | Create process + initial version |
| GET | /api/v1/processes/:id | all | Get process detail with current version |
| PUT | /api/v1/processes/:id | admin, process_owner(own) | Update process metadata |
| DELETE | /api/v1/processes/:id | admin | Soft-delete process |
| PUT | /api/v1/processes/:id/status | varies by transition | Transition process status |
| GET | /api/v1/processes/:id/versions | all | List all versions of a process |
| POST | /api/v1/processes/:id/versions | admin, process_owner(own) | Save BPMN XML as new version |
| GET | /api/v1/processes/:id/versions/:versionId | all | Get specific version with XML |
| POST | /api/v1/processes/:id/versions/restore | admin | Restore a previous version |
| GET | /api/v1/processes/:id/steps | all | List process steps (from BPMN sync) |
| PUT | /api/v1/processes/:id/steps/:stepId | admin, process_owner(own) | Update step metadata (responsible_role) |
| GET | /api/v1/processes/:id/risks | all | List process-level risk linkages |
| POST | /api/v1/processes/:id/risks | admin, process_owner, risk_manager | Link risk to process |
| DELETE | /api/v1/processes/:id/risks/:riskId | admin, process_owner, risk_manager | Unlink risk from process |
| GET | /api/v1/processes/:id/step-risks | all | List all step-level risk linkages (for overlay rendering) |
| POST | /api/v1/processes/:id/steps/:stepId/risks | admin, process_owner, risk_manager | Link risk to process step |
| DELETE | /api/v1/processes/:id/steps/:stepId/risks/:riskId | admin, process_owner, risk_manager | Unlink risk from step |
| GET | /api/v1/processes/:id/export/xml | all | Download BPMN XML file |
| GET | /api/v1/processes/:id/export/svg | all | Download SVG of current version |
| POST | /api/v1/processes/generate-bpmn | admin, process_owner | AI generate BPMN from description |

---

# 10. File Directory

Complete ordered list of all files to be created or modified, organized by implementation phase.

### Phase 1: Database & Schema

```
packages/db/src/migrations/048_create_process.sql
packages/db/src/migrations/049_create_process_version.sql
packages/db/src/migrations/050_create_process_step.sql
packages/db/src/migrations/051_create_process_control.sql
packages/db/src/migrations/052_create_process_step_control.sql
packages/db/src/migrations/053_enable_rls_process_tables.sql
packages/db/src/migrations/054_register_audit_triggers_sprint3.sql
packages/db/src/migrations/055_seed_demo_processes.sql
packages/db/src/schema/process.ts                    ← Drizzle schema + relations
packages/db/src/schema/index.ts                      ← re-export process schemas
```

### Phase 2: Shared Types & Validation

```
packages/shared/src/schemas/process.ts               ← Zod schemas (create, update, status transition)
packages/shared/src/types/process.ts                  ← TypeScript interfaces
packages/shared/src/constants/process-status.ts       ← Status transitions map
packages/shared/src/utils/bpmn-parser.ts              ← BPMN XML → ProcessStep[] extraction
```

### Phase 3: API Routes

```
apps/web/src/app/api/v1/processes/route.ts            ← GET (list), POST (create)
apps/web/src/app/api/v1/processes/tree/route.ts       ← GET (tree structure)
apps/web/src/app/api/v1/processes/generate-bpmn/route.ts ← POST (AI generation)
apps/web/src/app/api/v1/processes/[id]/route.ts       ← GET, PUT, DELETE
apps/web/src/app/api/v1/processes/[id]/status/route.ts ← PUT (status transition)
apps/web/src/app/api/v1/processes/[id]/versions/route.ts ← GET (list), POST (save)
apps/web/src/app/api/v1/processes/[id]/versions/[versionId]/route.ts ← GET
apps/web/src/app/api/v1/processes/[id]/versions/restore/route.ts ← POST
apps/web/src/app/api/v1/processes/[id]/steps/route.ts ← GET
apps/web/src/app/api/v1/processes/[id]/steps/[stepId]/route.ts ← PUT
apps/web/src/app/api/v1/processes/[id]/risks/route.ts ← GET, POST
apps/web/src/app/api/v1/processes/[id]/risks/[riskId]/route.ts ← DELETE
apps/web/src/app/api/v1/processes/[id]/step-risks/route.ts ← GET
apps/web/src/app/api/v1/processes/[id]/steps/[stepId]/risks/route.ts ← POST
apps/web/src/app/api/v1/processes/[id]/steps/[stepId]/risks/[riskId]/route.ts ← DELETE
apps/web/src/app/api/v1/processes/[id]/export/xml/route.ts ← GET
apps/web/src/app/api/v1/processes/[id]/export/svg/route.ts ← GET
```

### Phase 4: Frontend Components

```
packages/ui/src/components/bpmn/BpmnEditor.tsx        ← Main BPMN modeler component
packages/ui/src/components/bpmn/BpmnViewer.tsx         ← Read-only viewer component
packages/ui/src/components/bpmn/RiskOverlayExtension.ts ← Overlay badge rendering
packages/ui/src/components/bpmn/BpmnToolbar.tsx        ← Save, Export, Undo/Redo toolbar
packages/ui/src/components/bpmn/ShapeSidePanel.tsx     ← Right side panel on shape click
packages/ui/src/components/bpmn/RiskLinkSearch.tsx     ← Autocomplete risk search for linking
packages/ui/src/components/bpmn/bpmn-editor.css        ← bpmn.js custom styles
packages/ui/src/components/process/ProcessTree.tsx     ← Hierarchical tree sidebar
packages/ui/src/components/process/ProcessTreeNode.tsx ← Individual tree node
packages/ui/src/components/process/ProcessForm.tsx     ← Create/edit process form
packages/ui/src/components/process/ProcessStatusBadge.tsx ← Status badge component
packages/ui/src/components/process/ProcessApprovalButtons.tsx ← Approval action buttons
packages/ui/src/components/process/VersionTimeline.tsx ← Version history timeline
packages/ui/src/components/process/VersionCard.tsx     ← Individual version card
packages/ui/src/components/process/AIGenerateModal.tsx ← AI generation form + preview
packages/ui/src/components/process/ProcessRisksTab.tsx ← Risks tab content
apps/web/src/app/(dashboard)/processes/page.tsx        ← Process Landscape page
apps/web/src/app/(dashboard)/processes/[id]/page.tsx   ← Process Detail page
apps/web/src/app/(dashboard)/processes/new/page.tsx    ← Create Process page
apps/web/src/hooks/useProcesses.ts                     ← React Query hooks for process API
apps/web/src/hooks/useBpmnEditor.ts                    ← bpmn.js lifecycle management hook
```

### Phase 5: i18n

```
apps/web/src/messages/de/process.json                  ← German translations
apps/web/src/messages/en/process.json                  ← English translations
```

### Phase 6: Tests

```
packages/shared/src/__tests__/bpmn-parser.test.ts      ← BPMN XML parser unit tests
packages/shared/src/__tests__/process-schemas.test.ts  ← Zod schema validation tests
packages/shared/src/__tests__/process-status.test.ts   ← Status transition logic tests
apps/web/src/__tests__/api/processes.test.ts            ← API integration tests
apps/web/src/__tests__/api/process-versions.test.ts    ← Version API tests
apps/web/src/__tests__/api/process-risks.test.ts       ← Risk linkage API tests
apps/web/src/__tests__/api/process-rls.test.ts         ← RLS isolation tests
apps/web/src/__tests__/e2e/process-landscape.spec.ts   ← Playwright: tree navigation
apps/web/src/__tests__/e2e/bpmn-editor.spec.ts         ← Playwright: BPMN edit + save
apps/web/src/__tests__/e2e/process-approval.spec.ts    ← Playwright: approval flow
```

---

# 11. Acceptance Test Matrix

### Functional

- **F-1:** Process landscape tree shows hierarchical structure with expand/collapse.
- **F-2:** Creating a process creates an initial version with empty BPMN template.
- **F-3:** BPMN editor loads, allows editing, saves XML, and creates new version.
- **F-4:** ProcessStep records auto-sync from BPMN XML on save (5 tasks → 5 process_step rows).
- **F-5:** Risk badge appears on BPMN shape after linking a risk to its process_step.
- **F-6:** Clicking BPMN shape opens side panel showing linked risks with RSK element IDs.
- **F-7:** Approval flow works: draft → in_review → approved → published (with email at each step).
- **F-8:** Version timeline shows all versions; "View" opens read-only viewer; "Restore" creates new version.
- **F-9:** Navigating to /processes on an org with BPM disabled → ModuleGate teaser page shown.
- **F-10:** BPMN export: XML, SVG, PNG downloads work correctly.
- **F-11:** AI generation: Claude API produces valid BPMN XML from description; preview works.

### Security

- **S-1:** `requireModule('bpm')` integration test: org with BPM disabled → GET /api/v1/processes returns 404.
- **S-2:** RLS integration test: User A (CWS) receives 0 process records when querying with Org B's IDs.
- **S-3:** RBAC test: viewer role receives 403 on POST /processes, PUT /processes/:id, DELETE /processes/:id.
- **S-4:** Only admin can publish (status → published). process_owner receives 403.
- **S-5:** Only reviewer/auditor/admin can approve (status → approved). process_owner receives 403.
- **S-6:** Soft-deleted processes excluded from all list queries — verified by integration test.

### Performance

- **P-1:** GET /processes with 200 records (filtered, paginated) returns in < 200ms.
- **P-2:** GET /processes/tree with 200 processes returns in < 300ms.
- **P-3:** POST /processes/:id/versions (BPMN save + ProcessStep sync) completes in < 500ms for XML up to 500KB.
- **P-4:** BPMN editor initial load (import XML + render overlays) completes in < 2 seconds.
- **P-5:** Risk overlay refresh (polling endpoint) returns in < 100ms.

### Quality

- **Q-1:** Code coverage: backend > 80%, frontend > 60%.
- **Q-2:** TypeScript strict mode — 0 `any` types except documented type guards.
- **Q-3:** All UI text available in DE and EN via next-intl.
- **Q-4:** 0 critical OWASP ZAP findings on new endpoints.

---

# 12. Outlook: Sprint 4

### Sprint 4: Controls/ICS + Document Management

**What Sprint 4 requires from Sprint 3:**
- `process_control` join table (Migration 051) — Sprint 4 adds FK constraint to `control` table and builds UI
- `process_step_control` join table (Migration 052) — Sprint 4 adds FK constraint to `control` table and builds step-level control overlay
- `process_step.bpmn_element_id` — Sprint 4 uses this to place green control badges on BPMN shapes (same overlay pattern as risk badges)
- Control overlays in BPMN editor will follow the exact same pattern as Risk overlays (US-13.1): green badges with control count + effectiveness rating

**Sprint 4 Features:**
- Control Register: CRUD for controls with Test-of-Design (ToD) and Test-of-Effectiveness (ToE) fields
- Risk-Control Matrix (RCM): populates `risk_control` join table from Sprint 2
- Control Test campaigns with evidence upload
- Document repository with versioning and read acknowledgements
- Statement of Applicability (SoA)

---

# Amendment: Catalog & Framework Layer Context (ADR-013)

Sprint 2 adds two nullable hook fields to the risk table: `catalog_entry_id UUID` and `catalog_source VARCHAR(50)`. These have no FK yet and no UI impact in Sprint 3.

Sprint 3 consequence: Process table has no catalog_entry_id hook (processes are not catalog items). The BPMN Risk Overlays show risk scores from the risk table — these already include catalog context via `catalog_source` if available. No Sprint 3 changes needed for the catalog layer.
