# ARCTOS — Technical Specification: BPM Process Modeling Module

Sprint 3 — BPMN Process Modeling
Complete implementation guide for Claude Code

---

# 1. Sprint Overview

## Sprint Goal

Sprint 3 implements the BPM (Business Process Management) module: a full BPMN 2.0 editor embedded in the browser, hierarchical process landscape navigation, risk overlays on BPMN shapes (unique differentiator vs. GBTEC BIC and Signavio), an approval/versioning workflow, and AI-assisted process generation. This is the first sprint where ARCTOS surpasses pure BPM players by showing live GRC risk data directly inside process diagrams.

## Story Point Estimate

**Total: 74 Story Points across 28 User Stories**

Sprint 2 had 72 SP for 21 stories. Sprint 3 is comparable in complexity; the additional 2 SP are justified by the bpmn.js React integration complexity (DOM lifecycle, custom overlays, async XML export, overlay refresh).

## Epic Table

| Epic | Title | SP | Priority |
|------|-------|----|----------|
| Epic 11 | Process Landscape & Navigation | 16 | P1 MUST |
| Epic 12 | BPMN 2.0 Editor | 18 | P1 MUST |
| Epic 13 | Risk Overlays in BPMN Editor | 14 | P1 MUST |
| Epic 14 | Approval Workflow | 12 | P1 MUST |
| Epic 15 | Version Management | 8 | P1 MUST |
| Epic 16 | AI Process Generation | 6 | P2 SHOULD |

## Dependencies

**Requires from previous sprints:**
- Sprint 1: Auth.js session, `requireAuth()`, `requireRole()`, Audit trail `audit_trigger()`, UI Shell, Tab Navigation
- Sprint 1.2: `EmailService` for approval workflow notifications (`template_key` pattern)
- Sprint 1.3: `requireModule('bpm')` middleware (returns 404 when disabled, NOT 403), `<ModuleGate moduleKey="bpm">`, `module_definition` row for bpm already seeded
- Sprint 1.4: `work_item` base table, `work_item_link` (linked risks show element IDs)
- Sprint 2: `process_risk` table (Migration 041), `process_step_risk` table (Migration 042), `GET /api/v1/risks` endpoint for risk search in editor panel

**What Sprint 3 blocks:**
- Sprint 4 ICS/Controls: `process_control`, `process_step_control` tables (created as placeholders in Sprint 3)
- Sprint 4: `process_step.bpmn_element_id` needed for control overlays on BPMN shapes
- Sprint 5 Audit: Published/approved processes used as evidence artifacts
- Sprint 6 BCMS: `process.is_essential` flag for essential process designation

## Definition of Done

- [ ] All migrations 048–055 run without errors on a clean database
- [ ] `requireModule('bpm')` returns HTTP **404** (not 403, not 401) when BPM module is disabled for an org
- [ ] `<ModuleGate moduleKey="bpm">` wraps all Sprint 3 page components
- [ ] BPMN XML persisted: save → new ProcessVersion created → `is_current=true` on new version, `false` on all previous
- [ ] ProcessStep records auto-synced on every BPMN save: upsert new/changed, soft-delete steps no longer in XML
- [ ] RLS isolation: Org A cannot read processes from Org B — verified by integration test
- [ ] Audit trail: every process create/update/status change logged in `audit_log` with before/after JSONB diff
- [ ] All API inputs validated with Zod: unknown fields stripped, HTTP 400 returned on validation error
- [ ] bpmn.js: `modeler.destroy()` called on React component unmount (no memory leaks)
- [ ] Risk overlays visible on BPMN shapes within 5 seconds of initial page load
- [ ] Export: BPMN XML download functional, SVG export functional
- [ ] Approval flow end-to-end: draft → in_review (email to reviewer) → approved (email to owner) → published (email to all process_owners in org)
- [ ] Backend test coverage > 80%, frontend > 60%
- [ ] TypeScript strict mode: zero type errors, ESLint passes


---

# 2. Database Scope — Migrations 048–055

## 2.1 Migration 048 — Create Process Table

`packages/db/src/migrations/048_create_process.sql`

```sql
-- Sprint 3 starts at Migration 048
-- This migration also adds retroactive FK constraints on Sprint 2 join tables

CREATE TYPE process_status AS ENUM ('draft', 'in_review', 'approved', 'published', 'archived');
CREATE TYPE process_notation AS ENUM ('bpmn', 'value_chain', 'epc');

CREATE TABLE process (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    parent_process_id UUID REFERENCES process(id) ON DELETE SET NULL,
    name            VARCHAR(500) NOT NULL,
    description     TEXT,
    level           INTEGER NOT NULL DEFAULT 1,  -- 1=Group, 2=Company, 3=Department, 4+=Detail
    notation        process_notation NOT NULL DEFAULT 'bpmn',
    status          process_status NOT NULL DEFAULT 'draft',
    process_owner_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
    reviewer_id     UUID REFERENCES "user"(id) ON DELETE SET NULL,
    department      VARCHAR(255),
    current_version INTEGER NOT NULL DEFAULT 1,
    is_essential    BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID REFERENCES "user"(id) ON DELETE SET NULL,
    updated_by      UUID REFERENCES "user"(id) ON DELETE SET NULL,
    deleted_at      TIMESTAMPTZ,
    deleted_by      UUID REFERENCES "user"(id) ON DELETE SET NULL
);

CREATE INDEX idx_process_org_id ON process(org_id);
CREATE INDEX idx_process_org_status ON process(org_id, status);
CREATE INDEX idx_process_parent ON process(parent_process_id);
CREATE INDEX idx_process_owner ON process(org_id, process_owner_id);

-- Retroactive FK constraints on Sprint 2 join tables (Migrations 041-042)
ALTER TABLE process_risk
    ADD CONSTRAINT process_risk_process_fk
    FOREIGN KEY (process_id) REFERENCES process(id) ON DELETE CASCADE;

ALTER TABLE process_step_risk
    ADD CONSTRAINT process_step_risk_step_fk
    FOREIGN KEY (process_step_id) REFERENCES process_step(id) ON DELETE CASCADE;
    -- Note: process_step table is created in Migration 050;
    -- This constraint is added in Migration 050 instead (ordering dependency)

-- Trigger: auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION update_process_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER process_updated_at_trigger
    BEFORE UPDATE ON process
    FOR EACH ROW EXECUTE FUNCTION update_process_updated_at();
```

## 2.2 Migration 049 — Create Process Version Table

`packages/db/src/migrations/049_create_process_version.sql`

```sql
CREATE TABLE process_version (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_id      UUID NOT NULL REFERENCES process(id) ON DELETE CASCADE,
    org_id          UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    version_number  INTEGER NOT NULL,
    bpmn_xml        TEXT,
    change_summary  TEXT,
    is_current      BOOLEAN NOT NULL DEFAULT false,
    created_by      UUID REFERENCES "user"(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT process_version_unique UNIQUE (process_id, version_number)
);

CREATE INDEX idx_process_version_process ON process_version(process_id);
CREATE INDEX idx_process_version_org ON process_version(org_id);
CREATE INDEX idx_process_version_current ON process_version(process_id, is_current) WHERE is_current = true;
```

## 2.3 Migration 050 — Create Process Step Table

`packages/db/src/migrations/050_create_process_step.sql`

```sql
CREATE TYPE process_step_type AS ENUM ('task', 'gateway', 'event', 'subprocess', 'call_activity');

CREATE TABLE process_step (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_id       UUID NOT NULL REFERENCES process(id) ON DELETE CASCADE,
    org_id           UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    bpmn_element_id  VARCHAR(255) NOT NULL,
    name             VARCHAR(500),
    description      TEXT,
    step_type        process_step_type,
    responsible_role VARCHAR(255),
    sequence_order   INTEGER,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by       UUID REFERENCES "user"(id) ON DELETE SET NULL,
    updated_by       UUID REFERENCES "user"(id) ON DELETE SET NULL,
    deleted_at       TIMESTAMPTZ,
    deleted_by       UUID REFERENCES "user"(id) ON DELETE SET NULL,

    CONSTRAINT process_step_element_unique UNIQUE (process_id, bpmn_element_id)
);

CREATE INDEX idx_process_step_process ON process_step(process_id);
CREATE INDEX idx_process_step_org ON process_step(org_id);

-- Now that process_step exists, add the retroactive FK constraint on process_step_risk
ALTER TABLE process_step_risk
    ADD CONSTRAINT process_step_risk_step_fk
    FOREIGN KEY (process_step_id) REFERENCES process_step(id) ON DELETE CASCADE;
```

## 2.4 Migration 051 — Process Control Placeholder

`packages/db/src/migrations/051_create_process_control.sql`

```sql
-- Placeholder for Sprint 4 (ICS/Controls module)
-- No UI in Sprint 3. Sprint 4 adds the FK to the control table.
CREATE TABLE process_control (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    process_id      UUID NOT NULL REFERENCES process(id) ON DELETE CASCADE,
    control_id      UUID NOT NULL,  -- FK to control(id) added in Sprint 4
    control_context TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID REFERENCES "user"(id) ON DELETE SET NULL,

    CONSTRAINT process_control_unique UNIQUE (process_id, control_id)
);

CREATE INDEX idx_process_control_process ON process_control(process_id);
CREATE INDEX idx_process_control_org ON process_control(org_id);
```

## 2.5 Migration 052 — Process Step Control Placeholder

`packages/db/src/migrations/052_create_process_step_control.sql`

```sql
-- Placeholder for Sprint 4 (ICS/Controls module)
CREATE TABLE process_step_control (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id           UUID NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    process_step_id  UUID NOT NULL REFERENCES process_step(id) ON DELETE CASCADE,
    control_id       UUID NOT NULL,  -- FK to control(id) added in Sprint 4
    control_context  TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by       UUID REFERENCES "user"(id) ON DELETE SET NULL,

    CONSTRAINT process_step_control_unique UNIQUE (process_step_id, control_id)
);

CREATE INDEX idx_psc_step ON process_step_control(process_step_id);
CREATE INDEX idx_psc_org ON process_step_control(org_id);
```

## 2.6 Migration 053 — Enable RLS on All Sprint 3 Tables

`packages/db/src/migrations/053_enable_rls_process_tables.sql`

```sql
-- Enable RLS on all Sprint 3 tables
ALTER TABLE process ENABLE ROW LEVEL SECURITY;
ALTER TABLE process FORCE ROW LEVEL SECURITY;

ALTER TABLE process_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_version FORCE ROW LEVEL SECURITY;

ALTER TABLE process_step ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_step FORCE ROW LEVEL SECURITY;

ALTER TABLE process_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_control FORCE ROW LEVEL SECURITY;

ALTER TABLE process_step_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_step_control FORCE ROW LEVEL SECURITY;

-- RLS Policies: org isolation via app.current_org_id session variable
CREATE POLICY process_org_isolation ON process
    FOR ALL
    USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY process_version_org_isolation ON process_version
    FOR ALL
    USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY process_step_org_isolation ON process_step
    FOR ALL
    USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY process_control_org_isolation ON process_control
    FOR ALL
    USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY process_step_control_org_isolation ON process_step_control
    FOR ALL
    USING (org_id = current_setting('app.current_org_id')::uuid);
```

## 2.7 Migration 054 — Register Audit Triggers

`packages/db/src/migrations/054_register_audit_triggers_sprint3.sql`

```sql
-- Register the audit_trigger() function (from Sprint 1) on all Sprint 3 tables
-- The trigger captures before/after JSONB diffs and appends to audit_log
SELECT audit.audit_table('process');
SELECT audit.audit_table('process_version');
SELECT audit.audit_table('process_step');
SELECT audit.audit_table('process_control');
SELECT audit.audit_table('process_step_control');
```

## 2.8 Migration 055 — Seed Demo Processes

`packages/db/src/migrations/055_seed_demo_processes.sql`

```sql
-- Seed data: demo processes for each demo org
-- Uses the grc_demo org as example (org_code = 'HY')
-- Executed via TypeScript seed runner: packages/db/src/seed/processes.ts
-- The SQL below is a reference for the seed runner

-- This migration intentionally left blank — seed is applied by the TypeScript seed runner
-- Run: npx tsx packages/db/src/seed/processes.ts
```

`packages/db/src/seed/processes.ts`

```typescript
import { db } from '../client';
import { processes, processVersions } from '../schema/bpm';
import { eq } from 'drizzle-orm';
import { organizations } from '../schema/organization';

const DEMO_BPMN_SALES = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_sales" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_sales" isExecutable="false">
    <bpmn:startEvent id="Start_1" name="Anfrage eingeht">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="Task_qualify" name="Anfrage qualifizieren">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:exclusiveGateway id="Gateway_1" name="Qualifiziert?">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_yes</bpmn:outgoing>
      <bpmn:outgoing>Flow_no</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:userTask id="Task_offer" name="Angebot erstellen">
      <bpmn:incoming>Flow_yes</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="Task_reject" name="Absage senden">
      <bpmn:incoming>Flow_no</bpmn:incoming>
      <bpmn:outgoing>Flow_4</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="End_1" name="Prozess beendet">
      <bpmn:incoming>Flow_3</bpmn:incoming>
      <bpmn:incoming>Flow_4</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Start_1" targetRef="Task_qualify"/>
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_qualify" targetRef="Gateway_1"/>
    <bpmn:sequenceFlow id="Flow_yes" name="Ja" sourceRef="Gateway_1" targetRef="Task_offer"/>
    <bpmn:sequenceFlow id="Flow_no" name="Nein" sourceRef="Gateway_1" targetRef="Task_reject"/>
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Task_offer" targetRef="End_1"/>
    <bpmn:sequenceFlow id="Flow_4" sourceRef="Task_reject" targetRef="End_1"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_sales">
      <bpmndi:BPMNShape id="Start_1_di" bpmnElement="Start_1"><dc:Bounds x="152" y="82" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_qualify_di" bpmnElement="Task_qualify"><dc:Bounds x="240" y="60" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_1_di" bpmnElement="Gateway_1" isMarkerVisible="true"><dc:Bounds x="395" y="75" width="50" height="50"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_offer_di" bpmnElement="Task_offer"><dc:Bounds x="500" y="60" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_reject_di" bpmnElement="Task_reject"><dc:Bounds x="500" y="180" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_1_di" bpmnElement="End_1"><dc:Bounds x="662" y="82" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1"><di:waypoint x="188" y="100"/><di:waypoint x="240" y="100"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2"><di:waypoint x="340" y="100"/><di:waypoint x="395" y="100"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_yes_di" bpmnElement="Flow_yes"><di:waypoint x="445" y="100"/><di:waypoint x="500" y="100"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_no_di" bpmnElement="Flow_no"><di:waypoint x="420" y="125"/><di:waypoint x="420" y="220"/><di:waypoint x="500" y="220"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3"><di:waypoint x="600" y="100"/><di:waypoint x="662" y="100"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_4_di" bpmnElement="Flow_4"><di:waypoint x="600" y="220"/><di:waypoint x="680" y="220"/><di:waypoint x="680" y="118"/></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const DEMO_BPMN_PROCUREMENT = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_procurement" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_procurement" isExecutable="false">
    <bpmn:startEvent id="Start_p" name="Bedarf erkannt"><bpmn:outgoing>Flow_p1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="Task_pr" name="Purchase Request erstellen"><bpmn:incoming>Flow_p1</bpmn:incoming><bpmn:outgoing>Flow_p2</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="Task_approve_pr" name="PR genehmigen"><bpmn:incoming>Flow_p2</bpmn:incoming><bpmn:outgoing>Flow_p3</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="Task_rfq" name="Angebot einholen"><bpmn:incoming>Flow_p3</bpmn:incoming><bpmn:outgoing>Flow_p4</bpmn:outgoing></bpmn:userTask>
    <bpmn:userTask id="Task_po" name="Bestellung aufgeben"><bpmn:incoming>Flow_p4</bpmn:incoming><bpmn:outgoing>Flow_p5</bpmn:outgoing></bpmn:userTask>
    <bpmn:endEvent id="End_p" name="Bestellung abgeschlossen"><bpmn:incoming>Flow_p5</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_p1" sourceRef="Start_p" targetRef="Task_pr"/>
    <bpmn:sequenceFlow id="Flow_p2" sourceRef="Task_pr" targetRef="Task_approve_pr"/>
    <bpmn:sequenceFlow id="Flow_p3" sourceRef="Task_approve_pr" targetRef="Task_rfq"/>
    <bpmn:sequenceFlow id="Flow_p4" sourceRef="Task_rfq" targetRef="Task_po"/>
    <bpmn:sequenceFlow id="Flow_p5" sourceRef="Task_po" targetRef="End_p"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_p">
    <bpmndi:BPMNPlane id="BPMNPlane_p" bpmnElement="Process_procurement">
      <bpmndi:BPMNShape id="Start_p_di" bpmnElement="Start_p"><dc:Bounds x="152" y="82" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_pr_di" bpmnElement="Task_pr"><dc:Bounds x="240" y="60" width="120" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_approve_pr_di" bpmnElement="Task_approve_pr"><dc:Bounds x="420" y="60" width="120" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_rfq_di" bpmnElement="Task_rfq"><dc:Bounds x="600" y="60" width="120" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_po_di" bpmnElement="Task_po"><dc:Bounds x="780" y="60" width="120" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_p_di" bpmnElement="End_p"><dc:Bounds x="962" y="82" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_p1_di" bpmnElement="Flow_p1"><di:waypoint x="188" y="100"/><di:waypoint x="240" y="100"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_p2_di" bpmnElement="Flow_p2"><di:waypoint x="360" y="100"/><di:waypoint x="420" y="100"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_p3_di" bpmnElement="Flow_p3"><di:waypoint x="540" y="100"/><di:waypoint x="600" y="100"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_p4_di" bpmnElement="Flow_p4"><di:waypoint x="720" y="100"/><di:waypoint x="780" y="100"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_p5_di" bpmnElement="Flow_p5"><di:waypoint x="900" y="100"/><di:waypoint x="962" y="100"/></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

export async function seedProcesses() {
  const demoOrgs = await db.select().from(organizations).limit(5);

  for (const org of demoOrgs) {
    const [groupProcess] = await db.insert(processes).values({
      orgId: org.id,
      name: 'Konzernprozesslandschaft',
      description: 'Übergeordnete Prozesslandschaft des Konzerns',
      level: 1,
      notation: 'bpmn',
      status: 'published',
    }).returning();

    const [salesProcess] = await db.insert(processes).values({
      orgId: org.id,
      parentProcessId: groupProcess.id,
      name: 'Vertriebsprozess',
      description: 'Vollständiger Prozess von der Anfrage bis zur Auftragserteilung',
      level: 3,
      notation: 'bpmn',
      status: 'approved',
      department: 'Vertrieb',
    }).returning();

    await db.insert(processVersions).values({
      processId: salesProcess.id,
      orgId: org.id,
      versionNumber: 1,
      bpmnXml: DEMO_BPMN_SALES,
      changeSummary: 'Initiale Version',
      isCurrent: true,
    });

    const [procurementProcess] = await db.insert(processes).values({
      orgId: org.id,
      parentProcessId: groupProcess.id,
      name: 'Einkaufsprozess',
      description: 'Purchase-to-Pay Prozess von Bedarfsermittlung bis Bestellung',
      level: 3,
      notation: 'bpmn',
      status: 'published',
      department: 'Einkauf',
    }).returning();

    await db.insert(processVersions).values({
      processId: procurementProcess.id,
      orgId: org.id,
      versionNumber: 1,
      bpmnXml: DEMO_BPMN_PROCUREMENT,
      changeSummary: 'Initiale Version',
      isCurrent: true,
    });
  }

  console.log('Demo processes seeded successfully');
}
```

## 2.9 Drizzle Schema — `packages/db/src/schema/bpm.ts`

```typescript
import {
  pgTable, pgEnum, uuid, varchar, text, integer, boolean,
  timestamp, index, uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { organizations } from './organization';
import { users } from './user';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const processStatusEnum = pgEnum('process_status', [
  'draft', 'in_review', 'approved', 'published', 'archived'
]);

export const processNotationEnum = pgEnum('process_notation', [
  'bpmn', 'value_chain', 'epc'
]);

export const processStepTypeEnum = pgEnum('process_step_type', [
  'task', 'gateway', 'event', 'subprocess', 'call_activity'
]);

// ─── Cross-cutting fields ──────────────────────────────────────────────────

const crossCutting = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
  updatedBy: uuid('updated_by').references(() => users.id),
  deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  deletedBy: uuid('deleted_by').references(() => users.id),
};

// ─── process ──────────────────────────────────────────────────────────────────

export const processes = pgTable('process', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  parentProcessId: uuid('parent_process_id'),  // Self-reference — defined in relations below
  name: varchar('name', { length: 500 }).notNull(),
  description: text('description'),
  level: integer('level').notNull().default(1),
  notation: processNotationEnum('notation').notNull().default('bpmn'),
  status: processStatusEnum('status').notNull().default('draft'),
  processOwnerId: uuid('process_owner_id').references(() => users.id, { onDelete: 'set null' }),
  reviewerId: uuid('reviewer_id').references(() => users.id, { onDelete: 'set null' }),
  department: varchar('department', { length: 255 }),
  currentVersion: integer('current_version').notNull().default(1),
  isEssential: boolean('is_essential').notNull().default(false),
  ...crossCutting,
}, (t) => ({
  orgStatusIdx: index('process_org_status_idx').on(t.orgId, t.status),
  orgParentIdx: index('process_org_parent_idx').on(t.orgId, t.parentProcessId),
  orgOwnerIdx: index('process_org_owner_idx').on(t.orgId, t.processOwnerId),
}));

// ─── process_version ──────────────────────────────────────────────────────────

export const processVersions = pgTable('process_version', {
  id: uuid('id').primaryKey().defaultRandom(),
  processId: uuid('process_id').notNull().references(() => processes.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  versionNumber: integer('version_number').notNull(),
  bpmnXml: text('bpmn_xml'),
  changeSummary: text('change_summary'),
  isCurrent: boolean('is_current').notNull().default(false),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  processVersionUnique: uniqueIndex('process_version_unique').on(t.processId, t.versionNumber),
  processCurrentIdx: index('process_version_current_idx').on(t.processId, t.isCurrent),
}));

// ─── process_step ─────────────────────────────────────────────────────────────

export const processSteps = pgTable('process_step', {
  id: uuid('id').primaryKey().defaultRandom(),
  processId: uuid('process_id').notNull().references(() => processes.id, { onDelete: 'cascade' }),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  bpmnElementId: varchar('bpmn_element_id', { length: 255 }).notNull(),
  name: varchar('name', { length: 500 }),
  description: text('description'),
  stepType: processStepTypeEnum('step_type'),
  responsibleRole: varchar('responsible_role', { length: 255 }),
  sequenceOrder: integer('sequence_order'),
  ...crossCutting,
}, (t) => ({
  stepElementUnique: uniqueIndex('process_step_element_unique').on(t.processId, t.bpmnElementId),
  processIdx: index('process_step_process_idx').on(t.processId),
}));

// ─── process_control (Sprint 4 placeholder) ───────────────────────────────────

export const processControls = pgTable('process_control', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  processId: uuid('process_id').notNull().references(() => processes.id, { onDelete: 'cascade' }),
  controlId: uuid('control_id').notNull(),  // FK to control table — added in Sprint 4
  controlContext: text('control_context'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (t) => ({
  processControlUnique: uniqueIndex('process_control_unique').on(t.processId, t.controlId),
}));

// ─── process_step_control (Sprint 4 placeholder) ──────────────────────────────

export const processStepControls = pgTable('process_step_control', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  processStepId: uuid('process_step_id').notNull().references(() => processSteps.id, { onDelete: 'cascade' }),
  controlId: uuid('control_id').notNull(),  // FK to control table — added in Sprint 4
  controlContext: text('control_context'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
}, (t) => ({
  stepControlUnique: uniqueIndex('process_step_control_unique').on(t.processStepId, t.controlId),
}));

// ─── Relations ────────────────────────────────────────────────────────────────

export const processesRelations = relations(processes, ({ one, many }) => ({
  org: one(organizations, { fields: [processes.orgId], references: [organizations.id] }),
  parentProcess: one(processes, {
    fields: [processes.parentProcessId],
    references: [processes.id],
    relationName: 'processHierarchy',
  }),
  childProcesses: many(processes, { relationName: 'processHierarchy' }),
  owner: one(users, {
    fields: [processes.processOwnerId],
    references: [users.id],
    relationName: 'processOwner',
  }),
  reviewer: one(users, {
    fields: [processes.reviewerId],
    references: [users.id],
    relationName: 'processReviewer',
  }),
  versions: many(processVersions),
  steps: many(processSteps),
  controls: many(processControls),
}));

export const processVersionsRelations = relations(processVersions, ({ one }) => ({
  process: one(processes, { fields: [processVersions.processId], references: [processes.id] }),
  creator: one(users, { fields: [processVersions.createdBy], references: [users.id] }),
}));

export const processStepsRelations = relations(processSteps, ({ one, many }) => ({
  process: one(processes, { fields: [processSteps.processId], references: [processes.id] }),
  stepControls: many(processStepControls),
}));

// ─── Type Exports ─────────────────────────────────────────────────────────────

export type Process = InferSelectModel<typeof processes>;
export type InsertProcess = InferInsertModel<typeof processes>;
export type ProcessVersion = InferSelectModel<typeof processVersions>;
export type InsertProcessVersion = InferInsertModel<typeof processVersions>;
export type ProcessStep = InferSelectModel<typeof processSteps>;
export type InsertProcessStep = InferInsertModel<typeof processSteps>;
export type ProcessControl = InferSelectModel<typeof processControls>;
export type ProcessStepControl = InferSelectModel<typeof processStepControls>;

// Status transition rules
export const VALID_PROCESS_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft:     ['in_review'],
  in_review: ['approved', 'draft'],        // reviewer can send back to draft
  approved:  ['published', 'in_review'],   // can go back to in_review
  published: ['archived'],
  archived:  [],
};

export function isValidProcessStatusTransition(from: string, to: string): boolean {
  return VALID_PROCESS_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
```


---

# 3. Epics and User Stories

## Epic 11: Process Landscape & Navigation (16 SP)

### S3-01 — Prozesslandschaft anzeigen (5 SP)

**Als** Benutzer **möchte ich** eine hierarchische Baumansicht aller Prozesse (Konzern → Unternehmen → Abteilung → Detail) sehen, **damit** ich die vollständige Prozesslandschaft meiner Organisation navigieren kann.

**RBAC:** admin, process_owner, risk_manager, control_owner, auditor, viewer (alle Rollen)

**Acceptance Criteria:**
- GIVEN I am logged in and the BPM module is enabled for my org
  WHEN I navigate to `/bpm/processes`
  THEN I see a left sidebar with a collapsible tree of all processes (not deleted)
- GIVEN there are processes at multiple levels
  WHEN I click a parent process node
  THEN it expands to show child processes
- GIVEN the BPM module is disabled for my org
  WHEN I navigate to `/bpm/processes`
  THEN I receive a 404 response (ModuleGate renders a 404 page)
- GIVEN I am in a different org
  WHEN I view the tree
  THEN I only see processes belonging to my current org (RLS enforced)

### S3-02 — Neuen Prozess anlegen (3 SP)

**Als** Prozessverantwortlicher **möchte ich** einen neuen Prozess mit Metadaten anlegen, **damit** ich ihn in der Prozesslandschaft positionieren und modellieren kann.

**RBAC:** admin, process_owner (create)

**Acceptance Criteria:**
- GIVEN I am an admin or process_owner
  WHEN I click "+ Neuer Prozess"
  THEN a modal opens with fields: Name, Beschreibung, Ebene (1-4), Übergeordneter Prozess (search dropdown), Notation (default: BPMN), Abteilung, Prozessverantwortlicher, Prüfer
- GIVEN I submit the form with valid data
  WHEN the API responds with 201
  THEN the new process appears in the tree at the correct hierarchy level with status "Entwurf"
- GIVEN I submit without a name
  THEN the form shows validation error "Name ist erforderlich"
- GIVEN I am a viewer
  THEN the "+ Neuer Prozess" button is not visible

### S3-03 — Prozess suchen und filtern (3 SP)

**Als** Benutzer **möchte ich** Prozesse nach Name, Verantwortlichem, Status und Abteilung filtern können, **damit** ich in großen Prozesslandschaften schnell das Richtige finde.

**RBAC:** alle Rollen (read only)

**Acceptance Criteria:**
- GIVEN I type in the search field above the tree
  WHEN I type at least 2 characters
  THEN the tree is filtered to show only processes matching the name (case-insensitive)
- GIVEN I select a status filter ("Freigegeben")
  THEN only processes with status "approved" are shown
- GIVEN I clear all filters
  THEN the full tree is restored
- GIVEN no processes match the filter
  THEN the tree shows "Keine Prozesse gefunden"

### S3-04 — Prozess bearbeiten (3 SP)

**Als** Prozessverantwortlicher **möchte ich** Metadaten eines Prozesses bearbeiten, **damit** ich Verantwortlichkeiten und Zuordnungen aktuell halten kann.

**RBAC:** admin (alle), process_owner (eigene Prozesse)

**Acceptance Criteria:**
- GIVEN I am the process_owner of a process
  WHEN I open the process detail and click "Bearbeiten"
  THEN a form opens with all current metadata pre-filled
- GIVEN I save changes
  THEN the process is updated in the database and `updated_at` / `updated_by` are set
  AND the change is recorded in `audit_log`
- GIVEN I try to edit a process I do not own (as process_owner)
  THEN the Edit button is not shown
- GIVEN I am admin
  THEN I can edit any process in my org

### S3-05 — Prozess löschen (2 SP)

**Als** Admin **möchte ich** einen Prozess löschen können, **damit** ich die Prozesslandschaft bereinigen kann.

**RBAC:** admin only

**Acceptance Criteria:**
- GIVEN I am admin
  WHEN I click "Löschen" on a process
  THEN a confirmation dialog appears: "Prozess '[Name]' und alle Unterelemente löschen?"
- GIVEN I confirm deletion
  THEN `deleted_at` and `deleted_by` are set (soft delete)
  AND the process disappears from the tree view
  AND the deletion is logged in `audit_log`
- GIVEN the process has child processes
  THEN the confirmation dialog warns: "Dieser Prozess hat X Unterprozesse, die ebenfalls gelöscht werden"

---

## Epic 12: BPMN 2.0 Editor (18 SP)

### S3-06 — BPMN-Editor öffnen und modellieren (5 SP)

**Als** Prozessverantwortlicher **möchte ich** einen vollwertigen BPMN 2.0 Editor im Browser nutzen, **damit** ich Prozesse ohne externe Tools modellieren kann.

**RBAC:** admin, process_owner (edit); risk_manager, control_owner, auditor, viewer (read-only viewer)

**Acceptance Criteria:**
- GIVEN I open the "BPMN Editor" tab on a process detail page
  WHEN the editor loads
  THEN the bpmn.js Modeler is mounted with the current BPMN XML from the latest `is_current` version
- GIVEN the process has no saved BPMN
  THEN an empty BPMN diagram (start event only) is shown
- GIVEN I am a viewer or auditor
  THEN the NavigatedViewer is shown (read-only, no editing toolbar)
- GIVEN I am process_owner but not the owner of this process
  THEN the editor is shown in read-only mode
- GIVEN I drag a new Task element onto the canvas
  THEN it appears and can be connected to other elements

### S3-07 — BPMN speichern und neue Version erstellen (5 SP)

**Als** Prozessverantwortlicher **möchte ich** mein BPMN-Diagramm speichern, **damit** alle Änderungen in der Datenbank erhalten bleiben.

**RBAC:** admin, process_owner

**Acceptance Criteria:**
- GIVEN I click "Speichern"
  WHEN the save completes
  THEN the BPMN XML is exported via `modeler.saveXML()` and sent to `PUT /api/v1/processes/:id/versions`
  AND a new ProcessVersion record is created with `version_number = previous + 1` and `is_current = true`
  AND the previous current version has `is_current = false`
  AND `process.current_version` is incremented
- GIVEN I click "Speichern" while unsaved changes exist
  THEN a "Änderungen speichern?" modal shows with optional "Änderungskommentar" field
- GIVEN the save succeeds
  THEN the version indicator in the toolbar updates (e.g., "Version 3")
  AND "Nicht gespeicherte Änderungen" indicator disappears
- GIVEN the BPMN XML is invalid
  THEN the API returns 400 and the error is shown to the user

### S3-08 — ProcessSteps automatisch synchronisieren (3 SP)

**Als** System **möchte ich** beim BPMN-Speichern automatisch die `process_step` Datensätze synchronisieren, **damit** Risikoverknüpfungen an den korrekten BPMN-Elementen hängen.

**RBAC:** System (triggered by S3-07 save)

**Acceptance Criteria:**
- GIVEN a BPMN is saved with Tasks, Gateways, Start/End Events
  WHEN the XML is parsed server-side
  THEN `process_step` records are upserted for each: `<bpmn:task>`, `<bpmn:userTask>`, `<bpmn:serviceTask>`, `<bpmn:exclusiveGateway>`, `<bpmn:parallelGateway>`, `<bpmn:startEvent>`, `<bpmn:endEvent>`
  AND `bpmn_element_id` matches the `id` attribute of the BPMN shape
  AND `name` is synchronized from the BPMN `name` attribute
- GIVEN a shape was removed from the BPMN
  WHEN the next save occurs
  THEN the corresponding `process_step` record has `deleted_at` set (soft delete)
  AND any `process_step_risk` entries for this step are cascade-deleted (FK ON DELETE CASCADE)

### S3-09 — Export: BPMN XML, SVG, PNG (3 SP)

**Als** Prozessverantwortlicher **möchte ich** das Diagramm als BPMN XML, SVG und PNG exportieren, **damit** ich es in anderen Tools oder Dokumenten verwenden kann.

**RBAC:** admin, process_owner, risk_manager, auditor (all can export)

**Acceptance Criteria:**
- GIVEN I click "BPMN XML exportieren"
  THEN the current BPMN XML is downloaded as `[process-name].bpmn`
- GIVEN I click "SVG exportieren"
  THEN `modeler.saveSVG()` is called and the SVG is downloaded as `[process-name].svg`
- GIVEN I click "PNG exportieren"
  THEN the SVG is rendered to a Canvas element and downloaded as `[process-name].png`
- GIVEN the process has no BPMN
  THEN export buttons are disabled with tooltip "Kein BPMN-Diagramm vorhanden"

### S3-10 — Tastaturkürzel im Editor (2 SP)

**Als** Prozessverantwortlicher **möchte ich** Tastaturkürzel im BPMN-Editor nutzen, **damit** ich effizient modellieren kann.

**RBAC:** admin, process_owner

**Acceptance Criteria:**
- GIVEN the BPMN editor is focused
  WHEN I press Ctrl+Z
  THEN the last action is undone
- GIVEN I press Ctrl+Y or Ctrl+Shift+Z
  THEN the last undone action is redone
- GIVEN I select an element and press Delete or Backspace
  THEN the element is removed from the diagram
- GIVEN I press Ctrl+S
  THEN the save flow is triggered (same as clicking "Speichern")

---

## Epic 13: Risk Overlays in BPMN Editor (14 SP)

### S3-11 — Risiko-Overlays auf BPMN-Shapes anzeigen (5 SP)

**Als** Risikomanager **möchte ich** direkt im BPMN-Diagramm sehen, welche Shapes mit Risiken verknüpft sind, **damit** ich den Risikostatus eines Prozesses auf einen Blick erkenne.

**RBAC:** alle Rollen (read)

**Acceptance Criteria:**
- GIVEN a BPMN shape has linked risks in `process_step_risk`
  WHEN the BPMN editor or viewer loads
  THEN a colored badge appears on the shape showing: `[risk count] | [highest score]`
  AND badge color: red for score ≥ 15, yellow for score ≥ 8, green otherwise
- GIVEN a shape has no linked risks
  THEN no badge is shown on the shape
- GIVEN the risk data changes while the editor is open
  WHEN the 5-second polling interval fires
  THEN the overlays are refreshed (all existing overlays removed and re-added)
- GIVEN the BPMN is re-imported after a save
  THEN overlays are rebuilt after `importXML()` completes (not before)

### S3-12 — Seitenpanel bei Shape-Klick öffnen (3 SP)

**Als** Benutzer **möchte ich** beim Klick auf eine BPMN-Shape ein Seitenpanel sehen, **damit** ich die verknüpften Risiken und Verantwortlichkeiten einsehen kann.

**RBAC:** alle Rollen

**Acceptance Criteria:**
- GIVEN I click on any BPMN shape in the editor
  THEN a right side panel (30% width) opens with:
    - Shape name and type icon (Task, Gateway, Event, etc.)
    - Section "Verknüpfte Risiken" with list of linked risks (RSK element ID, title, score badge, status)
    - Section "Verantwortliche Rolle" with an editable text field (for process_owner and admin)
    - Placeholder section "Controls (Sprint 4)" shown as grayed-out
- GIVEN I click elsewhere on the canvas (not a shape)
  THEN the side panel closes

### S3-13 — Risiko mit BPMN-Shape verknüpfen (3 SP)

**Als** Prozessverantwortlicher **möchte ich** ein Risiko mit einer BPMN-Shape verknüpfen, **damit** der Risikokontext auf Schrittebene sichtbar ist.

**RBAC:** admin, process_owner, risk_manager

**Acceptance Criteria:**
- GIVEN the side panel is open for a shape
  WHEN I type in the "Risiko verknüpfen" search field
  THEN risks matching the query are shown in a dropdown (calls `GET /api/v1/risks?search=...`)
- GIVEN I select a risk from the dropdown
  THEN `POST /api/v1/processes/:id/steps/:stepId/risks` is called
  AND a `process_step_risk` record is created
  AND the risk appears in the "Verknüpfte Risiken" list
  AND the badge on the BPMN shape updates within 5 seconds
- GIVEN the risk is already linked to this step
  THEN it is not shown in the dropdown again

### S3-14 — Risikoverknüpfung entfernen (1 SP)

**Als** Prozessverantwortlicher **möchte ich** eine Risikoverknüpfung von einer BPMN-Shape entfernen, **damit** ich fehlerhafte Zuordnungen korrigieren kann.

**RBAC:** admin, process_owner, risk_manager

**Acceptance Criteria:**
- GIVEN the side panel shows a linked risk
  WHEN I click the "×" button next to the risk
  THEN `DELETE /api/v1/processes/:id/steps/:stepId/risks/:riskId` is called
  AND the risk is removed from the list
  AND if no risks remain, the badge disappears from the BPMN shape

### S3-15 — Risiko auf Prozessebene verknüpfen (2 SP)

**Als** Risikomanager **möchte ich** ein Risiko mit dem gesamten Prozess (nicht nur einer Shape) verknüpfen, **damit** prozessübergreifende Risiken abgebildet werden können.

**RBAC:** admin, risk_manager

**Acceptance Criteria:**
- GIVEN I am on the "Risiken" tab of a process detail page
  WHEN I click "Prozessrisiko hinzufügen"
  THEN a search modal opens to select a risk
- GIVEN I select a risk
  THEN `POST /api/v1/processes/:id/risks` is called and a `process_risk` record is created
- GIVEN the Risiken tab
  THEN it shows two sections: "Prozessrisiken" (process_risk table) and "Schrittrisiken" (process_step_risk grouped by step name)

---

## Epic 14: Approval Workflow (12 SP)

### S3-16 — Prozess zur Prüfung einreichen (3 SP)

**Als** Prozessverantwortlicher **möchte ich** meinen Prozess zur Prüfung einreichen, **damit** er von einem Prüfer freigegeben werden kann.

**RBAC:** process_owner, admin

**Acceptance Criteria:**
- GIVEN a process has status "draft"
  WHEN I click "Zur Prüfung einreichen"
  THEN a modal appears asking for optional "Kommentar zur Prüfung" and shows the assigned reviewer
- GIVEN I confirm
  THEN `PUT /api/v1/processes/:id/status` is called with `{ status: 'in_review', changeComment: '...' }`
  AND status updates to "In Prüfung"
  AND the reviewer receives an email (template_key='process_review_requested')
  AND the status change is logged in `audit_log`
- GIVEN no reviewer is assigned
  THEN the button shows tooltip "Bitte zuerst einen Prüfer zuweisen"
  AND submission is blocked

### S3-17 — Prozess freigeben (3 SP)

**Als** Prüfer **möchte ich** einen eingereichten Prozess freigeben oder zurückweisen, **damit** der Genehmigungsprozess korrekt abläuft.

**RBAC:** risk_manager, auditor, admin (approve/reject)

**Acceptance Criteria:**
- GIVEN a process has status "in_review"
  WHEN a reviewer opens the process detail
  THEN they see "Freigeben" and "Zurückweisen" buttons
- GIVEN I click "Freigeben"
  THEN status → "approved"
  AND the process owner receives email (template_key='process_approved')
- GIVEN I click "Zurückweisen"
  THEN a modal asks for a "Begründung" (required, min 10 chars)
  AND status → "draft"
  AND the process owner receives email notification

### S3-18 — Prozess veröffentlichen (2 SP)

**Als** Admin **möchte ich** einen freigegebenen Prozess veröffentlichen, **damit** er für alle Beteiligten sichtbar und verbindlich ist.

**RBAC:** admin only

**Acceptance Criteria:**
- GIVEN a process has status "approved"
  WHEN admin clicks "Veröffentlichen"
  THEN status → "published"
  AND all users with process_owner role in the org receive email (template_key='process_published')
  AND the process is locked for editing (edit button hidden or shows "Neue Version erstellen")

### S3-19 — Prozess archivieren (1 SP)

**Als** Admin **möchte ich** einen veröffentlichten Prozess archivieren, **damit** er nicht mehr aktiv angezeigt wird aber erhalten bleibt.

**RBAC:** admin only

**Acceptance Criteria:**
- GIVEN a process has status "published"
  WHEN admin clicks "Archivieren"
  THEN status → "archived"
  AND the process is hidden from the default tree view (filter: show archived toggle needed)

### S3-20 — Freigabe-Historie anzeigen (3 SP)

**Als** Auditor **möchte ich** die vollständige Freigabe-Historie eines Prozesses einsehen, **damit** ich den Genehmigungsprozess nachvollziehen kann.

**RBAC:** alle Rollen (read)

**Acceptance Criteria:**
- GIVEN I open the "Verlauf" tab of a process
  THEN I see a chronological list of all status changes from `audit_log`
  WITH: timestamp, actor name, old status, new status, change comment
- GIVEN the process was submitted for review twice (once rejected, once approved)
  THEN both transitions are visible in the history

---

## Epic 15: Version Management (8 SP)

### S3-21 — Versionshistorie anzeigen (3 SP)

**Als** Benutzer **möchte ich** alle gespeicherten Versionen eines Prozesses sehen, **damit** ich die Entwicklung des Prozesses nachvollziehen kann.

**RBAC:** alle Rollen

**Acceptance Criteria:**
- GIVEN I open the "Versionen" tab
  THEN I see a vertical timeline with one card per version showing: Versionsnummer, Erstellungsdatum, Ersteller, Änderungskommentar
- GIVEN there is only one version
  THEN the timeline shows exactly one entry marked "Aktuelle Version"

### S3-22 — Ältere Version ansehen (2 SP)

**Als** Auditor **möchte ich** eine ältere Prozessversion im Read-Only-Viewer ansehen, **damit** ich frühere Zustände des Prozesses prüfen kann.

**RBAC:** alle Rollen

**Acceptance Criteria:**
- GIVEN I click "Ansehen" on a version card
  THEN a fullscreen overlay opens with the BpmnViewer component showing the XML of that version
  AND the header shows "Version [N] — [date] — [creator]"
  AND there are no editing tools

### S3-23 — Ältere Version wiederherstellen (2 SP)

**Als** Admin **möchte ich** eine ältere Version wiederherstellen, **damit** ich bei fehlerhaften Änderungen schnell zum vorherigen Zustand zurückkehren kann.

**RBAC:** admin only

**Acceptance Criteria:**
- GIVEN I am admin and click "Wiederherstellen" on a version card
  THEN a confirmation dialog shows: "Version [N] als neue Version [M] wiederherstellen?"
- GIVEN I confirm
  THEN a new ProcessVersion is created with the XML of version N, versionNumber = latest + 1, isCurrent = true
  AND the process status is reset to "draft" (restored processes need re-approval)

### S3-24 — Änderungskommentar beim Speichern (1 SP)

**Als** Prozessverantwortlicher **möchte ich** beim Speichern einer neuen Version einen Kommentar hinterlassen, **damit** Kollegen die Änderungen nachvollziehen können.

**RBAC:** admin, process_owner

**Acceptance Criteria:**
- GIVEN I click "Speichern" in the BPMN editor
  THEN a modal appears with optional field "Änderungskommentar"
- GIVEN I enter a comment and save
  THEN the `process_version.change_summary` field is set to my comment

---

## Epic 16: AI Process Generation (6 SP)

### S3-25 — BPMN aus Freitext generieren (4 SP)

**Als** Prozessverantwortlicher **möchte ich** ein BPMN-Diagramm aus einer Textbeschreibung generieren lassen, **damit** ich schnell einen modellierbaren Ausgangspunkt erhalte.

**RBAC:** admin, process_owner

**Acceptance Criteria:**
- GIVEN I click "Mit KI generieren" in the BPMN editor toolbar
  THEN a panel opens with fields: "Prozessname" (pre-filled) and "Prozessbeschreibung" (textarea)
- GIVEN I submit the form
  THEN `POST /api/v1/processes/:id/generate-bpmn` is called
  AND a loading spinner appears ("KI generiert BPMN...")
  AND the Claude API generates valid BPMN 2.0 XML
- GIVEN the generation succeeds
  THEN a BpmnViewer preview of the generated BPMN is shown
  AND buttons "In Editor laden" and "Verwerfen" are shown
- GIVEN I click "In Editor laden"
  THEN the generated BPMN XML is loaded into the active BpmnModeler
  AND the editor shows "Nicht gespeicherte Änderungen" (user must save manually)
- GIVEN the Claude API returns invalid XML
  THEN the error "KI konnte kein gültiges BPMN generieren. Bitte Beschreibung präzisieren." is shown

### S3-26 — KI-Generierung: Validierung und Feedback (2 SP)

**Als** System **möchte ich** das von der KI generierte BPMN validieren, **damit** nur syntaktisch korrektes BPMN in den Editor geladen wird.

**RBAC:** System

**Acceptance Criteria:**
- GIVEN the Claude API response is received
  WHEN we attempt `modeler.importXML(generatedXml)`
  IF the import throws an error
  THEN the raw XML is shown to the user with option to copy it
  AND the error message explains the validation failure
- GIVEN the XML is valid BPMN
  THEN the user can load it into the editor


---

# 4. API Specification

## 4.1 Endpoint Overview

All Sprint 3 endpoints use the middleware chain:
`requireAuth() → requireModule('bpm') → orgContextMiddleware → requireRole([...]) → validateBody(zodSchema) → handler → auditLogger`

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/api/v1/processes` | all | List processes (hierarchical, with filters) |
| POST | `/api/v1/processes` | admin, process_owner | Create process |
| GET | `/api/v1/processes/:id` | all | Get process with current version |
| PATCH | `/api/v1/processes/:id` | admin, process_owner | Update process metadata |
| DELETE | `/api/v1/processes/:id` | admin | Soft-delete process |
| GET | `/api/v1/processes/:id/versions` | all | List all versions |
| POST | `/api/v1/processes/:id/versions` | admin, process_owner | Save BPMN (creates new version) |
| GET | `/api/v1/processes/:id/versions/:versionId` | all | Get specific version |
| PUT | `/api/v1/processes/:id/status` | see RBAC | Transition process status |
| GET | `/api/v1/processes/:id/steps` | all | List process steps |
| GET | `/api/v1/processes/:id/risks` | all | List risks linked to process and steps |
| POST | `/api/v1/processes/:id/risks` | admin, risk_manager | Link risk to process |
| DELETE | `/api/v1/processes/:id/risks/:riskId` | admin, risk_manager | Remove process-level risk link |
| POST | `/api/v1/processes/:id/steps/:stepId/risks` | admin, process_owner, risk_manager | Link risk to step |
| DELETE | `/api/v1/processes/:id/steps/:stepId/risks/:riskId` | admin, process_owner, risk_manager | Remove step-level risk link |
| POST | `/api/v1/processes/:id/generate-bpmn` | admin, process_owner | AI BPMN generation |
| GET | `/api/v1/processes/:id/export` | admin, process_owner, risk_manager, auditor | Export BPMN XML |

## 4.2 Zod Validation Schemas — `packages/shared/src/schemas/process.ts`

```typescript
import { z } from 'zod';

export const ProcessStatusEnum = z.enum(['draft', 'in_review', 'approved', 'published', 'archived']);
export const ProcessNotationEnum = z.enum(['bpmn', 'value_chain', 'epc']);

export const createProcessSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(500, 'Name darf maximal 500 Zeichen haben'),
  description: z.string().max(5000).optional(),
  parentProcessId: z.string().uuid().nullable().optional(),
  level: z.number().int().min(1).max(10).default(1),
  notation: ProcessNotationEnum.default('bpmn'),
  processOwnerId: z.string().uuid().nullable().optional(),
  reviewerId: z.string().uuid().nullable().optional(),
  department: z.string().max(255).optional(),
  isEssential: z.boolean().default(false),
});

export const updateProcessSchema = createProcessSchema.partial();

export const saveBpmnSchema = z.object({
  bpmnXml: z.string().min(10, 'BPMN XML ist erforderlich'),
  changeSummary: z.string().max(1000).optional(),
});

export const processStatusTransitionSchema = z.object({
  status: ProcessStatusEnum,
  changeComment: z.string().max(2000).optional(),
}).superRefine((data, ctx) => {
  if (data.status === 'draft' || data.status === 'in_review') {
    // No additional validation needed
  }
});

export const linkRiskSchema = z.object({
  riskId: z.string().uuid(),
  riskContext: z.string().max(2000).optional(),
});

export const generateBpmnSchema = z.object({
  processName: z.string().min(1).max(500),
  description: z.string().min(10, 'Beschreibung muss mindestens 10 Zeichen haben').max(5000),
});

export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft:     ['in_review'],
  in_review: ['approved', 'draft'],
  approved:  ['published', 'in_review'],
  published: ['archived'],
  archived:  [],
};

export function isValidStatusTransition(from: string, to: string): boolean {
  return VALID_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export const STATUS_ROLE_REQUIREMENTS: Record<string, string[]> = {
  in_review: ['admin', 'process_owner'],
  approved:  ['admin', 'risk_manager', 'auditor'],
  published: ['admin'],
  archived:  ['admin'],
  draft:     ['admin', 'risk_manager', 'auditor'],  // reject back to draft
};
```

## 4.3 Complete Route Implementation: POST /api/v1/processes

`apps/web/src/app/api/v1/processes/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@arctos/db';
import { processes, processVersions } from '@arctos/db/schema/bpm';
import { createProcessSchema } from '@arctos/shared/schemas/process';
import { requireAuth } from '@/lib/middleware/require-auth';
import { requireModule } from '@/lib/middleware/require-module';
import { requireRole } from '@/lib/middleware/require-role';
import { orgContextMiddleware } from '@/lib/middleware/org-context';
import { auditLogger } from '@/lib/middleware/audit-logger';
import { getSession } from '@arctos/auth';
import { eq, and, isNull, ilike, sql } from 'drizzle-orm';

// GET /api/v1/processes — List processes (hierarchical)
export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const moduleResult = await requireModule('bpm', req);
  if (moduleResult instanceof NextResponse) return moduleResult;

  const orgCtx = await orgContextMiddleware(req);
  if (orgCtx instanceof NextResponse) return orgCtx;

  const { orgId } = orgCtx;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search');
  const status = searchParams.get('status');
  const parentId = searchParams.get('parentId');
  const includeArchived = searchParams.get('includeArchived') === 'true';

  const conditions = [
    eq(processes.orgId, orgId),
    isNull(processes.deletedAt),
  ];

  if (!includeArchived) {
    conditions.push(sql`${processes.status} != 'archived'`);
  }
  if (search) {
    conditions.push(ilike(processes.name, `%${search}%`));
  }
  if (status) {
    conditions.push(eq(processes.status, status as any));
  }
  if (parentId === 'null') {
    conditions.push(isNull(processes.parentProcessId));
  } else if (parentId) {
    conditions.push(eq(processes.parentProcessId, parentId));
  }

  const result = await db.query.processes.findMany({
    where: and(...conditions),
    with: {
      owner: { columns: { id: true, name: true, email: true } },
      reviewer: { columns: { id: true, name: true, email: true } },
    },
    orderBy: (p) => [p.level, p.name],
  });

  return NextResponse.json(result);
}

// POST /api/v1/processes — Create process
export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const moduleResult = await requireModule('bpm', req);
  if (moduleResult instanceof NextResponse) return moduleResult;

  const roleResult = await requireRole(['admin', 'process_owner'], req);
  if (roleResult instanceof NextResponse) return roleResult;

  const orgCtx = await orgContextMiddleware(req);
  if (orgCtx instanceof NextResponse) return orgCtx;

  const { orgId, userId } = orgCtx;

  const body = await req.json().catch(() => ({}));
  const parsed = createProcessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  const [newProcess] = await db.insert(processes).values({
    orgId,
    name: data.name,
    description: data.description,
    parentProcessId: data.parentProcessId ?? null,
    level: data.level,
    notation: data.notation,
    processOwnerId: data.processOwnerId ?? null,
    reviewerId: data.reviewerId ?? null,
    department: data.department,
    isEssential: data.isEssential,
    createdBy: userId,
    updatedBy: userId,
  }).returning();

  // Create the initial empty version
  await db.insert(processVersions).values({
    processId: newProcess.id,
    orgId,
    versionNumber: 1,
    bpmnXml: null,
    changeSummary: 'Initiale Version',
    isCurrent: true,
    createdBy: userId,
  });

  await auditLogger({
    orgId,
    userId,
    action: 'CREATE',
    entityType: 'process',
    entityId: newProcess.id,
    newValue: newProcess,
  });

  return NextResponse.json(newProcess, { status: 201 });
}
```

## 4.4 Complete Route Implementation: POST /api/v1/processes/:id/versions (Save BPMN)

`apps/web/src/app/api/v1/processes/[id]/versions/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@arctos/db';
import { processes, processVersions, processSteps } from '@arctos/db/schema/bpm';
import { saveBpmnSchema } from '@arctos/shared/schemas/process';
import { requireAuth } from '@/lib/middleware/require-auth';
import { requireModule } from '@/lib/middleware/require-module';
import { requireRole } from '@/lib/middleware/require-role';
import { orgContextMiddleware } from '@/lib/middleware/org-context';
import { auditLogger } from '@/lib/middleware/audit-logger';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { parseBpmnSteps } from '@/lib/bpm/bpmn-parser';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const moduleResult = await requireModule('bpm', req);
  if (moduleResult instanceof NextResponse) return moduleResult;

  const roleResult = await requireRole(['admin', 'process_owner'], req);
  if (roleResult instanceof NextResponse) return roleResult;

  const orgCtx = await orgContextMiddleware(req);
  if (orgCtx instanceof NextResponse) return orgCtx;

  const { orgId, userId } = orgCtx;
  const processId = params.id;

  const process = await db.query.processes.findFirst({
    where: and(eq(processes.id, processId), eq(processes.orgId, orgId), isNull(processes.deletedAt)),
  });

  if (!process) {
    return NextResponse.json({ error: 'Prozess nicht gefunden' }, { status: 404 });
  }

  // Only owner or admin can save BPMN
  const session = await getSession(req);
  const userRole = session?.user?.role;
  if (userRole === 'process_owner' && process.processOwnerId !== userId) {
    return NextResponse.json({ error: 'Nur der Prozessverantwortliche kann diesen Prozess bearbeiten' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = saveBpmnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
  }

  const { bpmnXml, changeSummary } = parsed.data;
  const nextVersionNumber = process.currentVersion + 1;

  await db.transaction(async (tx) => {
    // 1. Demote all current versions to not-current
    await tx
      .update(processVersions)
      .set({ isCurrent: false })
      .where(and(eq(processVersions.processId, processId), eq(processVersions.isCurrent, true)));

    // 2. Create new version
    await tx.insert(processVersions).values({
      processId,
      orgId,
      versionNumber: nextVersionNumber,
      bpmnXml,
      changeSummary: changeSummary ?? null,
      isCurrent: true,
      createdBy: userId,
    });

    // 3. Increment process.current_version
    await tx
      .update(processes)
      .set({ currentVersion: nextVersionNumber, updatedBy: userId })
      .where(eq(processes.id, processId));

    // 4. Parse BPMN XML and sync process_step records
    const extractedSteps = parseBpmnSteps(bpmnXml);
    const extractedIds = extractedSteps.map((s) => s.bpmnElementId);

    // Get existing (non-deleted) steps
    const existingSteps = await tx.query.processSteps.findMany({
      where: and(eq(processSteps.processId, processId), isNull(processSteps.deletedAt)),
    });

    const existingIds = existingSteps.map((s) => s.bpmnElementId);

    // Soft-delete steps removed from BPMN
    const toDelete = existingIds.filter((id) => !extractedIds.includes(id));
    if (toDelete.length > 0) {
      const stepsToDelete = existingSteps.filter((s) => toDelete.includes(s.bpmnElementId));
      await tx
        .update(processSteps)
        .set({ deletedAt: new Date().toISOString(), deletedBy: userId })
        .where(inArray(processSteps.id, stepsToDelete.map((s) => s.id)));
    }

    // Upsert steps present in BPMN
    for (let i = 0; i < extractedSteps.length; i++) {
      const step = extractedSteps[i];
      await tx
        .insert(processSteps)
        .values({
          processId,
          orgId,
          bpmnElementId: step.bpmnElementId,
          name: step.name ?? null,
          stepType: step.stepType,
          sequenceOrder: i,
          createdBy: userId,
          updatedBy: userId,
        })
        .onConflictDoUpdate({
          target: [processSteps.processId, processSteps.bpmnElementId],
          set: {
            name: step.name ?? null,
            stepType: step.stepType,
            sequenceOrder: i,
            updatedBy: userId,
            updatedAt: new Date().toISOString(),
            deletedAt: null,  // Restore if previously soft-deleted
            deletedBy: null,
          },
        });
    }
  });

  await auditLogger({
    orgId,
    userId,
    action: 'UPDATE',
    entityType: 'process_version',
    entityId: processId,
    newValue: { versionNumber: nextVersionNumber, changeSummary },
  });

  return NextResponse.json({
    success: true,
    versionNumber: nextVersionNumber,
    stepsCount: parseBpmnSteps(bpmnXml).length,
  });
}
```

## 4.5 Complete Route Implementation: PUT /api/v1/processes/:id/status

`apps/web/src/app/api/v1/processes/[id]/status/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@arctos/db';
import { processes } from '@arctos/db/schema/bpm';
import { users } from '@arctos/db/schema/user';
import { processStatusTransitionSchema, isValidStatusTransition, STATUS_ROLE_REQUIREMENTS } from '@arctos/shared/schemas/process';
import { requireAuth } from '@/lib/middleware/require-auth';
import { requireModule } from '@/lib/middleware/require-module';
import { orgContextMiddleware } from '@/lib/middleware/org-context';
import { auditLogger } from '@/lib/middleware/audit-logger';
import { EmailService } from '@arctos/email';
import { getSession } from '@arctos/auth';
import { eq, and, isNull } from 'drizzle-orm';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const moduleResult = await requireModule('bpm', req);
  if (moduleResult instanceof NextResponse) return moduleResult;

  const orgCtx = await orgContextMiddleware(req);
  if (orgCtx instanceof NextResponse) return orgCtx;

  const { orgId, userId } = orgCtx;
  const processId = params.id;

  const body = await req.json().catch(() => ({}));
  const parsed = processStatusTransitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
  }

  const { status: newStatus, changeComment } = parsed.data;

  const process = await db.query.processes.findFirst({
    where: and(eq(processes.id, processId), eq(processes.orgId, orgId), isNull(processes.deletedAt)),
    with: {
      owner: true,
      reviewer: true,
    },
  });

  if (!process) {
    return NextResponse.json({ error: 'Prozess nicht gefunden' }, { status: 404 });
  }

  // Validate status transition
  if (!isValidStatusTransition(process.status, newStatus)) {
    return NextResponse.json({
      error: `Statusübergang von '${process.status}' nach '${newStatus}' ist nicht erlaubt`,
    }, { status: 422 });
  }

  // Check role requirements for this specific transition
  const session = await getSession(req);
  const userRole = session?.user?.role ?? '';
  const allowedRoles = STATUS_ROLE_REQUIREMENTS[newStatus] ?? [];
  if (!allowedRoles.includes(userRole)) {
    return NextResponse.json({
      error: `Ihre Rolle '${userRole}' darf diesen Statusübergang nicht durchführen`,
    }, { status: 403 });
  }

  // Validation: in_review requires reviewer to be set
  if (newStatus === 'in_review' && !process.reviewerId) {
    return NextResponse.json({
      error: 'Ein Prüfer muss zugewiesen sein, bevor der Prozess zur Prüfung eingereicht werden kann',
    }, { status: 422 });
  }

  const previousStatus = process.status;

  const [updated] = await db
    .update(processes)
    .set({ status: newStatus as any, updatedBy: userId })
    .where(eq(processes.id, processId))
    .returning();

  // Audit log
  await auditLogger({
    orgId,
    userId,
    action: 'STATUS_CHANGE',
    entityType: 'process',
    entityId: processId,
    oldValue: { status: previousStatus },
    newValue: { status: newStatus, changeComment },
  });

  // Send email notifications based on transition
  const emailService = new EmailService();

  if (newStatus === 'in_review' && process.reviewer?.email) {
    await emailService.send({
      to: process.reviewer.email,
      templateKey: 'process_review_requested',
      data: {
        processName: process.name,
        processId,
        submittedBy: session?.user?.name ?? 'Unbekannt',
        changeComment: changeComment ?? '',
        reviewUrl: `${process.env.APP_URL}/bpm/processes/${processId}`,
      },
    });
  }

  if (newStatus === 'approved' && process.owner?.email) {
    await emailService.send({
      to: process.owner.email,
      templateKey: 'process_approved',
      data: {
        processName: process.name,
        processId,
        approvedBy: session?.user?.name ?? 'Unbekannt',
        processUrl: `${process.env.APP_URL}/bpm/processes/${processId}`,
      },
    });
  }

  if (newStatus === 'published') {
    // Notify all process owners in the org
    const processOwners = await db.query.users.findMany({
      where: eq(users.id, orgId), // Simplified — actual impl uses user_organization_role table
    });
    for (const owner of processOwners) {
      if (owner.email) {
        await emailService.send({
          to: owner.email,
          templateKey: 'process_published',
          data: {
            processName: process.name,
            processId,
            publishedBy: session?.user?.name ?? 'Unbekannt',
            processUrl: `${process.env.APP_URL}/bpm/processes/${processId}`,
          },
        });
      }
    }
  }

  return NextResponse.json(updated);
}
```


---

# 5. Technical Implementation Notes

## 5.1 bpmn.js Installation

```bash
# Install bpmn-js in the web app (NOT in packages/ui — bpmn.js is DOM-heavy, must be in the Next.js app)
cd apps/web
npm install bpmn-js
npm install --save-dev @types/bpmn-js
```

Add to `apps/web/next.config.ts`:
```typescript
const nextConfig = {
  // bpmn-js requires transpilation
  transpilePackages: ['bpmn-js', 'diagram-js', 'bpmn-moddle'],
  webpack: (config) => {
    config.externals = [...(config.externals ?? []), { canvas: 'canvas' }];
    return config;
  },
};
```

## 5.2 BpmnEditor React Component

`apps/web/src/components/bpm/BpmnEditor.tsx`

```tsx
"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type BpmnModelerType from 'bpmn-js/lib/Modeler';
import type { ImportXMLResult } from 'bpmn-js/lib/BaseModeler';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Save, Download, Wand2, AlertCircle } from 'lucide-react';
import { RiskSidePanel } from './RiskSidePanel';
import { cn } from '@/lib/utils';

interface BpmnEditorProps {
  initialXml: string | null;
  processId: string;
  processName: string;
  readOnly?: boolean;
  onSave: (xml: string, changeSummary?: string) => Promise<void>;
}

const EMPTY_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Start"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="179" y="159" width="36" height="36"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

export function BpmnEditor({
  initialXml,
  processId,
  processName,
  readOnly = false,
  onSave,
}: BpmnEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModelerType | null>(null);
  const overlayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [selectedElement, setSelectedElement] = useState<{ id: string; name: string; type: string } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load risk overlays and re-register them after every importXML
  // Critical: overlays are NOT preserved across importXML calls
  const loadRiskOverlays = useCallback(async (modeler: BpmnModelerType) => {
    try {
      const overlays = modeler.get('overlays') as any;
      const elementRegistry = modeler.get('elementRegistry') as any;

      // Remove all existing risk overlays before re-adding
      overlays.remove({ type: 'risk-badge' });

      const res = await fetch(`/api/v1/processes/${processId}/risks`);
      if (!res.ok) return;
      const data = await res.json() as {
        stepRisks: Array<{ stepElementId: string; count: number; maxScore: number }>;
      };

      data.stepRisks.forEach(({ stepElementId, count, maxScore }) => {
        if (!elementRegistry.get(stepElementId)) return;

        const color = maxScore >= 15 ? '#ef4444' : maxScore >= 8 ? '#f59e0b' : '#22c55e';
        const div = document.createElement('div');
        div.style.cssText = `
          background: ${color};
          color: white;
          border-radius: 9999px;
          padding: 2px 6px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          white-space: nowrap;
        `;
        div.textContent = count === 1 ? `${count} Risiko` : `${count} Risiken | ${maxScore}`;
        div.title = `${count} verknüpfte Risiken, höchster Score: ${maxScore}`;

        overlays.add(stepElementId, {
          type: 'risk-badge',
          position: { bottom: 0, right: 0 },
          html: div,
        });
      });
    } catch (e) {
      console.error('[BpmnEditor] Failed to load risk overlays:', e);
    }
  }, [processId]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Dynamic import to avoid SSR issues (bpmn-js uses DOM APIs)
    let destroyed = false;

    const mountModeler = async () => {
      const BpmnModeler = (await import('bpmn-js/lib/Modeler')).default;

      if (destroyed || !containerRef.current) return;

      const modeler = new BpmnModeler({
        container: containerRef.current,
        keyboard: { bindTo: window },
      });

      modelerRef.current = modeler;

      // Import BPMN XML
      try {
        const result: ImportXMLResult = await modeler.importXML(initialXml ?? EMPTY_BPMN);
        if (result.warnings.length > 0) {
          console.warn('[BpmnEditor] Import warnings:', result.warnings);
        }
        const canvas = modeler.get('canvas') as any;
        canvas.zoom('fit-viewport');
      } catch (err) {
        console.error('[BpmnEditor] Failed to import XML:', err);
      }

      // Load risk overlays AFTER importXML (overlays require elements to exist)
      await loadRiskOverlays(modeler);

      // Register click handler: open side panel on element click
      const eventBus = modeler.get('eventBus') as any;
      eventBus.on('element.click', (event: any) => {
        const { element } = event;
        if (element.type === 'bpmn:Process') {
          setSelectedElement(null);
          return;
        }
        setSelectedElement({
          id: element.id,
          name: element.businessObject?.name ?? element.id,
          type: element.type,
        });
      });

      // Track changes for "unsaved changes" indicator
      eventBus.on('commandStack.changed', () => {
        setHasUnsavedChanges(true);
      });

      // Poll risk data every 5 seconds to keep badges fresh
      // This handles the case where another user links a risk while the editor is open
      overlayIntervalRef.current = setInterval(() => {
        if (modelerRef.current) {
          loadRiskOverlays(modelerRef.current);
        }
      }, 5000);
    };

    mountModeler();

    // Cleanup on unmount: critical to prevent memory leaks
    return () => {
      destroyed = true;
      if (overlayIntervalRef.current) {
        clearInterval(overlayIntervalRef.current);
        overlayIntervalRef.current = null;
      }
      if (modelerRef.current) {
        modelerRef.current.destroy();
        modelerRef.current = null;
      }
    };
  }, [initialXml, loadRiskOverlays]);

  // Re-import XML when initialXml prop changes (e.g., version restored)
  // Note: this triggers cleanup + remount via key prop on parent if needed
  // For in-place update, use importXML directly:
  const reloadXml = useCallback(async (xml: string) => {
    if (!modelerRef.current) return;
    await modelerRef.current.importXML(xml);
    // After importXML, overlays are cleared — must re-add them
    await loadRiskOverlays(modelerRef.current);
    setHasUnsavedChanges(false);
  }, [loadRiskOverlays]);

  const handleSave = async () => {
    if (!modelerRef.current || isSaving) return;
    setSaveError(null);
    setIsSaving(true);

    try {
      // saveXML returns a Promise — must be awaited
      const { xml } = await modelerRef.current.saveXML({ format: true });
      if (!xml) throw new Error('XML export returned empty string');

      await onSave(xml);
      setHasUnsavedChanges(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Speichern fehlgeschlagen';
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportSvg = async () => {
    if (!modelerRef.current) return;
    try {
      const { svg } = await (modelerRef.current as any).saveSVG();
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${processName}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[BpmnEditor] SVG export failed:', err);
    }
  };

  const handleExportPng = async () => {
    if (!modelerRef.current) return;
    try {
      const { svg } = await (modelerRef.current as any).saveSVG();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        canvas.toBlob((pngBlob) => {
          if (!pngBlob) return;
          const pngUrl = URL.createObjectURL(pngBlob);
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = `${processName}.png`;
          a.click();
          URL.revokeObjectURL(pngUrl);
          URL.revokeObjectURL(url);
        }, 'image/png');
      };
      img.src = url;
    } catch (err) {
      console.error('[BpmnEditor] PNG export failed:', err);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-slate-50">
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
              Nicht gespeicherte Änderungen
            </Badge>
          )}
          {saveError && (
            <div className="flex items-center gap-1 text-red-600 text-sm">
              <AlertCircle className="h-4 w-4" />
              {saveError}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportSvg}>
            <Download className="h-4 w-4 mr-1" />
            SVG
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPng}>
            <Download className="h-4 w-4 mr-1" />
            PNG
          </Button>
          {!readOnly && (
            <Button size="sm" onClick={handleSave} disabled={isSaving || !hasUnsavedChanges}>
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? 'Speichern...' : 'Speichern'}
            </Button>
          )}
        </div>
      </div>

      {/* Editor + Side Panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* bpmn.js canvas — 70% or 100% if no element selected */}
        <div
          ref={containerRef}
          className={cn(
            'flex-1 bg-white',
            selectedElement ? 'w-[70%]' : 'w-full'
          )}
        />

        {/* Side Panel — 30% — shown when a shape is clicked */}
        {selectedElement && (
          <RiskSidePanel
            processId={processId}
            elementId={selectedElement.id}
            elementName={selectedElement.name}
            elementType={selectedElement.type}
            readOnly={readOnly}
            onClose={() => setSelectedElement(null)}
            onRiskLinked={() => loadRiskOverlays(modelerRef.current!)}
          />
        )}
      </div>
    </div>
  );
}
```

## 5.3 BpmnViewer Component (Read-Only)

`apps/web/src/components/bpm/BpmnViewer.tsx`

```tsx
"use client";

import React, { useEffect, useRef } from 'react';

interface BpmnViewerProps {
  xml: string;
  processId: string;
  className?: string;
}

export function BpmnViewer({ xml, processId, className }: BpmnViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !xml) return;
    let destroyed = false;

    const mountViewer = async () => {
      const NavigatedViewer = (await import('bpmn-js/lib/NavigatedViewer')).default;

      if (destroyed || !containerRef.current) return;

      const viewer = new NavigatedViewer({ container: containerRef.current });
      viewerRef.current = viewer;

      try {
        await viewer.importXML(xml);
        const canvas = viewer.get('canvas') as any;
        canvas.zoom('fit-viewport');
        // Overlays for read-only viewer (no refresh polling needed)
        const res = await fetch(`/api/v1/processes/${processId}/risks`);
        if (res.ok) {
          const data = await res.json();
          const overlays = viewer.get('overlays') as any;
          const registry = viewer.get('elementRegistry') as any;
          data.stepRisks?.forEach(({ stepElementId, count, maxScore }: any) => {
            if (!registry.get(stepElementId)) return;
            const div = document.createElement('div');
            div.style.cssText = `background:${maxScore >= 15 ? '#ef4444' : maxScore >= 8 ? '#f59e0b' : '#22c55e'};color:white;border-radius:9999px;padding:2px 6px;font-size:11px;font-weight:700;`;
            div.textContent = `${count}`;
            overlays.add(stepElementId, { type: 'risk-badge', position: { bottom: 0, right: 0 }, html: div });
          });
        }
      } catch (err) {
        console.error('[BpmnViewer] Failed to load:', err);
      }
    };

    mountViewer();

    return () => {
      destroyed = true;
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [xml, processId]);

  return (
    <div
      ref={containerRef}
      className={className ?? 'w-full h-[500px] bg-white border rounded-md'}
    />
  );
}
```

## 5.4 BPMN XML Parser — ProcessStep Auto-Sync

`apps/web/src/lib/bpm/bpmn-parser.ts`

```typescript
import { XMLParser } from 'fast-xml-parser';  // npm install fast-xml-parser

export interface ExtractedStep {
  bpmnElementId: string;
  name: string | null;
  stepType: 'task' | 'gateway' | 'event' | 'subprocess' | 'call_activity';
}

const TASK_ELEMENTS = ['bpmn:task', 'bpmn:userTask', 'bpmn:serviceTask', 'bpmn:scriptTask', 'bpmn:sendTask', 'bpmn:receiveTask', 'bpmn:manualTask', 'bpmn:businessRuleTask'];
const GATEWAY_ELEMENTS = ['bpmn:exclusiveGateway', 'bpmn:parallelGateway', 'bpmn:inclusiveGateway', 'bpmn:eventBasedGateway'];
const EVENT_ELEMENTS = ['bpmn:startEvent', 'bpmn:endEvent', 'bpmn:intermediateCatchEvent', 'bpmn:intermediateThrowEvent', 'bpmn:boundaryEvent'];

function toArray<T>(val: T | T[] | undefined): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function extractElements(processNode: any, tagNames: string[], stepType: ExtractedStep['stepType']): ExtractedStep[] {
  const results: ExtractedStep[] = [];
  for (const tag of tagNames) {
    const elements = toArray(processNode[tag]);
    for (const el of elements) {
      const id = el?.['@_id'];
      if (!id) continue;
      results.push({
        bpmnElementId: id,
        name: el['@_name'] ?? null,
        stepType,
      });
    }
  }
  return results;
}

export function parseBpmnSteps(bpmnXml: string): ExtractedStep[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    parseAttributeValue: false,
  });

  let parsed: any;
  try {
    parsed = parser.parse(bpmnXml);
  } catch (err) {
    throw new Error(`BPMN XML parsing failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  // Navigate to the process element (handle both with and without namespace prefix)
  const definitions = parsed?.['bpmn:definitions'] ?? parsed?.definitions;
  if (!definitions) return [];

  const processNode = Array.isArray(definitions['bpmn:process'])
    ? definitions['bpmn:process'][0]  // Use first process if multiple
    : definitions['bpmn:process'];

  if (!processNode) return [];

  const steps: ExtractedStep[] = [
    ...extractElements(processNode, TASK_ELEMENTS, 'task'),
    ...extractElements(processNode, GATEWAY_ELEMENTS, 'gateway'),
    ...extractElements(processNode, EVENT_ELEMENTS, 'event'),
    ...extractElements(processNode, ['bpmn:subProcess'], 'subprocess'),
    ...extractElements(processNode, ['bpmn:callActivity'], 'call_activity'),
  ];

  // De-duplicate by bpmnElementId
  const seen = new Set<string>();
  return steps.filter((s) => {
    if (seen.has(s.bpmnElementId)) return false;
    seen.add(s.bpmnElementId);
    return true;
  });
}
```

## 5.5 AI BPMN Generation

`packages/ai/src/bpm-generator.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { parseBpmnSteps } from '@arctos/web/src/lib/bpm/bpmn-parser';  // For validation

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an expert BPMN 2.0 process architect specializing in GRC (Governance, Risk, Compliance) processes for German corporations.

Your task: Generate a valid BPMN 2.0 XML document based on the process name and description provided.

STRICT REQUIREMENTS:
1. Output ONLY valid BPMN 2.0 XML. No markdown, no explanation, no code fences.
2. The XML must start with: <?xml version="1.0" encoding="UTF-8"?>
3. Use namespace prefix bpmn: for BPMN elements
4. Include a complete bpmndi:BPMNDiagram section with realistic x/y coordinates (elements spaced 150px apart horizontally, centered vertically around y=200)
5. All element IDs must be unique and follow the pattern: [ElementType]_[incrementing number] (e.g., Task_1, Task_2, Gateway_1)
6. Every bpmn:sequenceFlow must have both sourceRef and targetRef matching existing element IDs
7. Use bpmn:userTask for human tasks, bpmn:exclusiveGateway for decisions, bpmn:startEvent and bpmn:endEvent
8. Process must have exactly one start event and at least one end event
9. targetNamespace MUST be: http://bpmn.io/schema/bpmn
10. The process must be realistic for German corporate GRC context`;

export interface GenerateBpmnResult {
  xml: string;
  valid: boolean;
  validationError?: string;
  stepCount: number;
}

export async function generateBpmn(params: {
  processName: string;
  description: string;
}): Promise<GenerateBpmnResult> {
  const userMessage = `Process Name: ${params.processName}
Description: ${params.description}

Generate the BPMN 2.0 XML for this process. Include 4-8 steps with realistic sequence flows and at least one decision gateway if appropriate.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const rawXml = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as any).text)
    .join('')
    .trim()
    // Strip any accidental markdown code fences
    .replace(/^```(?:xml)?
?/, '')
    .replace(/
?```$/, '');

  // Validate: attempt to parse the extracted steps
  try {
    const steps = parseBpmnSteps(rawXml);
    if (steps.length === 0) {
      return {
        xml: rawXml,
        valid: false,
        validationError: 'BPMN enthält keine erkennbaren Prozesselemente',
        stepCount: 0,
      };
    }
    return { xml: rawXml, valid: true, stepCount: steps.length };
  } catch (err) {
    return {
      xml: rawXml,
      valid: false,
      validationError: err instanceof Error ? err.message : 'Ungültiges BPMN XML',
      stepCount: 0,
    };
  }
}
```

API route for AI generation:

`apps/web/src/app/api/v1/processes/[id]/generate-bpmn/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { generateBpmnSchema } from '@arctos/shared/schemas/process';
import { generateBpmn } from '@arctos/ai/bpm-generator';
import { requireAuth } from '@/lib/middleware/require-auth';
import { requireModule } from '@/lib/middleware/require-module';
import { requireRole } from '@/lib/middleware/require-role';
import { orgContextMiddleware } from '@/lib/middleware/org-context';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const moduleResult = await requireModule('bpm', req);
  if (moduleResult instanceof NextResponse) return moduleResult;

  const roleResult = await requireRole(['admin', 'process_owner'], req);
  if (roleResult instanceof NextResponse) return roleResult;

  const orgCtx = await orgContextMiddleware(req);
  if (orgCtx instanceof NextResponse) return orgCtx;

  const body = await req.json().catch(() => ({}));
  const parsed = generateBpmnSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
  }

  const result = await generateBpmn(parsed.data);

  if (!result.valid) {
    return NextResponse.json({
      error: 'KI konnte kein gültiges BPMN generieren',
      details: result.validationError,
      rawXml: result.xml,
    }, { status: 422 });
  }

  return NextResponse.json({ xml: result.xml, stepCount: result.stepCount });
}
```


---

# 6. UI/UX Specification

## 6.1 Page: Prozesslandschaft (`/bpm/processes`)

Layout: Two-panel layout. Left panel 280px wide, right content area fills remaining space.

### Left Panel — Prozessbaum
- Fixed height, scrollable
- Header: "Prozesslandschaft" (h2) + "+ Neuer Prozess" button (admin/process_owner only)
- Search input: placeholder "Prozess suchen..." with magnifier icon, min 2 chars to trigger filter
- Filter row (collapsed by default, toggle with "Filter" button):
  - Status-Dropdown (Alle / Entwurf / In Prüfung / Freigegeben / Veröffentlicht / Archiviert)
  - Abteilung-Input
- Tree view:
  - Level 1 (Konzern): bold text, folder icon
  - Level 2–4: indented, smaller text, process icon
  - Each node: process name + status badge (colored dot) + click to open detail
  - Collapse/expand: chevron icon on nodes with children
  - Selected node: highlighted background
- Empty state: "Keine Prozesse vorhanden. Legen Sie den ersten Prozess an." + action button

### Right Panel — Default State
- Centered illustration + text: "Wählen Sie einen Prozess aus der Liste aus"
- If no processes exist: "Noch keine Prozesse vorhanden. Klicken Sie auf '+ Neuer Prozess'."

### Mobile Behavior
- Left panel is shown as full-screen
- Right panel not accessible on mobile
- No BPMN editor on mobile — bpmn.js is not mobile-optimized
- On process detail (mobile): show read-only SVG preview of last published version

## 6.2 Page: Prozessdetail (`/bpm/processes/[id]`)

### Header
```
[Status Badge] Prozessname                               [Action Buttons]
Ebene X • Abteilung • Verantwortlich: Max Mustermann     [Speichern] [Status-Aktionen ▼]
```

- Status badge: colored pill (grau=Entwurf, gelb=In Prüfung, grün=Freigegeben, blau=Veröffentlicht, grau=Archiviert)
- Status-Aktionen dropdown (context-dependent):
  - Draft: "Zur Prüfung einreichen" (process_owner, admin)
  - In Prüfung: "Freigeben" / "Zurückweisen" (risk_manager, auditor, admin)
  - Freigegeben: "Veröffentlichen" (admin)
  - Veröffentlicht: "Archivieren" (admin) / "Neue Version erstellen" (process_owner, admin)

### Tab Navigation
- Tabs: Übersicht | BPMN Editor | Versionen | Risiken | Verlauf

#### Tab: Übersicht
- Process metadata: Name, Beschreibung, Ebene, Notation, Abteilung, Ist-essenziell
- Verantwortliche: Prozessverantwortlicher + Prüfer (with avatar)
- Statistiken: Anzahl Versionen, Anzahl Schritte, Anzahl verknüpfte Risiken
- Letzte Änderung: "Geändert am [date] von [user]"

#### Tab: BPMN Editor
```
[Toolbar: Version X | Nicht gespeicherte Änderungen | SVG | PNG | Speichern | Mit KI generieren]

[bpmn.js canvas — 70% width]         [Side Panel — 30% width]
                                       ┌─────────────────────┐
                                       │ [Task icon] Task Name│
                                       │ Typ: Aufgabe         │
                                       ├─────────────────────┤
                                       │ Verknüpfte Risiken  │
                                       │ [RSK-0001] Titel... │
                                       │   Score: ●20 ×      │
                                       │ [RSK-0002] Titel... │
                                       │   Score: ●8  ×      │
                                       │ [+ Risiko verknüpfen]│
                                       │   [search input]    │
                                       ├─────────────────────┤
                                       │ Verantwortl. Rolle  │
                                       │ [text input]        │
                                       ├─────────────────────┤
                                       │ Controls (Sprint 4) │
                                       │ [Grayed out]        │
                                       └─────────────────────┘
```
- Side panel appears only when a BPMN shape is clicked
- Side panel disappears on canvas click (outside shapes)
- "Mit KI generieren" button opens AI generation panel below toolbar

#### Tab: Versionen
```
● Version 3 (aktuelle Version)
│   Gespeichert am 25.03.2026 von Max Mustermann
│   "Genehmigungsschritt ergänzt"
│                                    [Ansehen]
│
● Version 2
│   Gespeichert am 23.03.2026 von Max Mustermann
│   "Fehler im Ablauf korrigiert"
│                                    [Ansehen] [Wiederherstellen] (admin only)
│
● Version 1
    Gespeichert am 22.03.2026 von Max Mustermann
    "Initiale Version"
                                     [Ansehen] [Wiederherstellen] (admin only)
```

#### Tab: Risiken
```
Prozessrisiken (2)
─────────────────
[RSK-0003] Datenschutzverletzung          Score: ●20 Kritisch    Freigegeben    [× Entfernen]
[RSK-0007] Compliance-Verstoß             Score: ●12 Hoch        Behandlung     [× Entfernen]
[+ Prozessrisiko hinzufügen]

Schrittrisiken (3)
──────────────────
▼ Task_qualify — "Anfrage qualifizieren"
  [RSK-0001] Unzureichende Prüfung        Score: ●8  Mittel      Bewertet       [× Entfernen]

▼ Task_offer — "Angebot erstellen"
  [RSK-0002] Fehlerhafte Kalkulation      Score: ●15 Hoch        Behandlung     [× Entfernen]
  [RSK-0005] Vertragliche Haftung         Score: ●6  Niedrig     Akzeptiert     [× Entfernen]
```

#### Tab: Verlauf (from audit_log)
```
25.03.2026 14:32 — Max Mustermann
  Status: Entwurf → In Prüfung
  "Bitte auf Vollständigkeit prüfen"

24.03.2026 09:15 — Max Mustermann
  BPMN Version 3 gespeichert
  "Genehmigungsschritt ergänzt"

23.03.2026 11:00 — Anna Schmidt
  Status: In Prüfung → Entwurf (Zurückgewiesen)
  "Begründung fehlt bei Gateway-Entscheidung"
```

## 6.3 Components to Build

| Component | Path | Description |
|-----------|------|-------------|
| `ProcessTree` | `components/bpm/ProcessTree.tsx` | Hierarchical tree with search/filter |
| `ProcessNode` | `components/bpm/ProcessNode.tsx` | Single tree node with status dot |
| `ProcessStatusBadge` | `components/bpm/ProcessStatusBadge.tsx` | Colored status pill |
| `BpmnEditor` | `components/bpm/BpmnEditor.tsx` | Full editor (see Section 5.2) |
| `BpmnViewer` | `components/bpm/BpmnViewer.tsx` | Read-only viewer (see Section 5.3) |
| `RiskSidePanel` | `components/bpm/RiskSidePanel.tsx` | Shape click side panel |
| `RiskSearchModal` | `components/bpm/RiskSearchModal.tsx` | Risk search and link modal |
| `ProcessVersionCard` | `components/bpm/ProcessVersionCard.tsx` | Version timeline card |
| `ProcessStatusActions` | `components/bpm/ProcessStatusActions.tsx` | Status transition buttons |
| `AiGeneratePanel` | `components/bpm/AiGeneratePanel.tsx` | AI generation form + preview |
| `CreateProcessModal` | `components/bpm/CreateProcessModal.tsx` | New process form modal |


---

# 7. i18n Keys

## 7.1 `messages/de/process.json`

```json
{
  "module": {
    "name": "Prozessmanagement",
    "description": "BPMN 2.0 Prozessmodellierung und -management"
  },
  "navigation": {
    "landscape": "Prozesslandschaft",
    "new": "+ Neuer Prozess",
    "search": "Prozess suchen...",
    "filter": "Filter",
    "noResults": "Keine Prozesse gefunden",
    "empty": "Noch keine Prozesse vorhanden.",
    "emptyAction": "Legen Sie den ersten Prozess an"
  },
  "level": {
    "1": "Konzernprozess",
    "2": "Unternehmensprozess",
    "3": "Abteilungsprozess",
    "4": "Detailprozess",
    "label": "Ebene"
  },
  "status": {
    "draft": "Entwurf",
    "in_review": "In Prüfung",
    "approved": "Freigegeben",
    "published": "Veröffentlicht",
    "archived": "Archiviert"
  },
  "notation": {
    "bpmn": "BPMN 2.0",
    "value_chain": "Wertkette",
    "epc": "EPK"
  },
  "stepType": {
    "task": "Aufgabe",
    "gateway": "Gateway",
    "event": "Ereignis",
    "subprocess": "Teilprozess",
    "call_activity": "Aufrufaktivität"
  },
  "form": {
    "name": "Prozessname",
    "namePlaceholder": "z.B. Vertriebsprozess",
    "nameRequired": "Name ist erforderlich",
    "description": "Beschreibung",
    "descriptionPlaceholder": "Beschreiben Sie den Prozessablauf...",
    "level": "Prozessebene",
    "notation": "Notation",
    "parentProcess": "Übergeordneter Prozess",
    "parentProcessPlaceholder": "Übergeordneten Prozess auswählen...",
    "processOwner": "Prozessverantwortlicher",
    "reviewer": "Prüfer",
    "department": "Abteilung",
    "departmentPlaceholder": "z.B. Vertrieb",
    "isEssential": "Essenzieller Prozess",
    "isEssentialHint": "Für BCMS-Relevanz (Sprint 6)"
  },
  "tabs": {
    "overview": "Übersicht",
    "editor": "BPMN Editor",
    "versions": "Versionen",
    "risks": "Risiken",
    "history": "Verlauf"
  },
  "editor": {
    "save": "Speichern",
    "saving": "Speichern...",
    "unsavedChanges": "Nicht gespeicherte Änderungen",
    "readOnly": "Nur lesend",
    "exportBpmn": "BPMN XML exportieren",
    "exportSvg": "SVG exportieren",
    "exportPng": "PNG exportieren",
    "generateAi": "Mit KI generieren",
    "changeSummary": "Änderungskommentar",
    "changeSummaryPlaceholder": "Was hat sich geändert? (optional)",
    "saveSuccess": "Erfolgreich gespeichert (Version {version})",
    "saveError": "Speichern fehlgeschlagen: {message}",
    "noContent": "Kein BPMN-Diagramm vorhanden",
    "versionIndicator": "Version {version}"
  },
  "panel": {
    "title": "Element-Details",
    "linkedRisks": "Verknüpfte Risiken",
    "linkRisk": "Risiko verknüpfen",
    "linkRiskPlaceholder": "Risiko suchen...",
    "noRisks": "Keine verknüpften Risiken",
    "responsibleRole": "Verantwortliche Rolle",
    "responsibleRolePlaceholder": "z.B. Vertriebsleiter",
    "controlsPlaceholder": "Controls (Sprint 4)",
    "close": "Schließen"
  },
  "risks": {
    "processRisks": "Prozessrisiken",
    "stepRisks": "Schrittrisiken",
    "addProcessRisk": "+ Prozessrisiko hinzufügen",
    "noProcessRisks": "Keine Prozessrisiken verknüpft",
    "noStepRisks": "Keine Schrittrisiken verknüpft",
    "remove": "Entfernen",
    "removeConfirm": "Risikoverknüpfung wirklich entfernen?"
  },
  "versions": {
    "title": "Versionshistorie",
    "current": "Aktuelle Version",
    "version": "Version {number}",
    "savedAt": "Gespeichert am {date}",
    "by": "von {name}",
    "noComment": "Kein Kommentar",
    "view": "Ansehen",
    "restore": "Wiederherstellen",
    "restoreConfirm": "Version {number} als neue Version {newNumber} wiederherstellen? Der Prozess wird auf 'Entwurf' zurückgesetzt.",
    "noVersions": "Keine Versionen vorhanden"
  },
  "history": {
    "title": "Änderungsverlauf",
    "statusChange": "Status: {from} → {to}",
    "versionSaved": "BPMN Version {number} gespeichert",
    "noHistory": "Kein Verlauf vorhanden"
  },
  "workflow": {
    "submitForReview": "Zur Prüfung einreichen",
    "approve": "Freigeben",
    "reject": "Zurückweisen",
    "publish": "Veröffentlichen",
    "archive": "Archivieren",
    "createNewDraft": "Neue Version erstellen",
    "rejectReason": "Begründung für Ablehnung",
    "rejectReasonRequired": "Begründung ist erforderlich (min. 10 Zeichen)",
    "comment": "Kommentar",
    "commentPlaceholder": "Optionaler Kommentar zur Statusänderung",
    "noReviewerSet": "Bitte zuerst einen Prüfer zuweisen",
    "confirmSubmit": "Prozess '{name}' zur Prüfung einreichen?",
    "confirmPublish": "Prozess '{name}' veröffentlichen? Alle Prozessverantwortlichen werden benachrichtigt.",
    "confirmArchive": "Prozess '{name}' archivieren?"
  },
  "ai": {
    "title": "Mit KI generieren",
    "description": "Die KI generiert ein BPMN-Diagramm basierend auf Ihrer Beschreibung.",
    "processName": "Prozessname",
    "processDescription": "Prozessbeschreibung",
    "processDescriptionPlaceholder": "Beschreiben Sie den Prozessablauf detailliert...",
    "processDescriptionHint": "Je detaillierter, desto besser das Ergebnis (min. 10 Zeichen)",
    "generate": "BPMN generieren",
    "generating": "KI generiert BPMN...",
    "loadInEditor": "In Editor laden",
    "discard": "Verwerfen",
    "error": "KI konnte kein gültiges BPMN generieren. Bitte Beschreibung präzisieren.",
    "preview": "Vorschau",
    "success": "BPMN generiert ({steps} Schritte erkannt)"
  },
  "delete": {
    "title": "Prozess löschen",
    "confirm": "Prozess '{name}' und alle Unterelemente löschen?",
    "withChildren": "Dieser Prozess hat {count} Unterprozesse, die ebenfalls gelöscht werden.",
    "success": "Prozess erfolgreich gelöscht"
  },
  "errors": {
    "notFound": "Prozess nicht gefunden",
    "forbidden": "Keine Berechtigung für diese Aktion",
    "moduleDisabled": "Das BPM-Modul ist für Ihre Organisation nicht freigeschaltet",
    "invalidTransition": "Dieser Statusübergang ist nicht erlaubt",
    "loadFailed": "Prozess konnte nicht geladen werden"
  }
}
```

## 7.2 `messages/en/process.json`

```json
{
  "module": {
    "name": "Process Management",
    "description": "BPMN 2.0 process modeling and management"
  },
  "navigation": {
    "landscape": "Process Landscape",
    "new": "+ New Process",
    "search": "Search processes...",
    "filter": "Filter",
    "noResults": "No processes found",
    "empty": "No processes yet.",
    "emptyAction": "Create the first process"
  },
  "level": {
    "1": "Group Process",
    "2": "Company Process",
    "3": "Department Process",
    "4": "Detail Process",
    "label": "Level"
  },
  "status": {
    "draft": "Draft",
    "in_review": "In Review",
    "approved": "Approved",
    "published": "Published",
    "archived": "Archived"
  },
  "notation": {
    "bpmn": "BPMN 2.0",
    "value_chain": "Value Chain",
    "epc": "EPC"
  },
  "stepType": {
    "task": "Task",
    "gateway": "Gateway",
    "event": "Event",
    "subprocess": "Sub Process",
    "call_activity": "Call Activity"
  },
  "form": {
    "name": "Process Name",
    "namePlaceholder": "e.g. Sales Process",
    "nameRequired": "Name is required",
    "description": "Description",
    "descriptionPlaceholder": "Describe the process flow...",
    "level": "Process Level",
    "notation": "Notation",
    "parentProcess": "Parent Process",
    "parentProcessPlaceholder": "Select parent process...",
    "processOwner": "Process Owner",
    "reviewer": "Reviewer",
    "department": "Department",
    "departmentPlaceholder": "e.g. Sales",
    "isEssential": "Essential Process",
    "isEssentialHint": "For BCMS relevance (Sprint 6)"
  },
  "tabs": {
    "overview": "Overview",
    "editor": "BPMN Editor",
    "versions": "Versions",
    "risks": "Risks",
    "history": "History"
  },
  "editor": {
    "save": "Save",
    "saving": "Saving...",
    "unsavedChanges": "Unsaved Changes",
    "readOnly": "Read Only",
    "exportBpmn": "Export BPMN XML",
    "exportSvg": "Export SVG",
    "exportPng": "Export PNG",
    "generateAi": "Generate with AI",
    "changeSummary": "Change Summary",
    "changeSummaryPlaceholder": "What changed? (optional)",
    "saveSuccess": "Saved successfully (Version {version})",
    "saveError": "Save failed: {message}",
    "noContent": "No BPMN diagram available",
    "versionIndicator": "Version {version}"
  },
  "panel": {
    "title": "Element Details",
    "linkedRisks": "Linked Risks",
    "linkRisk": "Link Risk",
    "linkRiskPlaceholder": "Search risks...",
    "noRisks": "No linked risks",
    "responsibleRole": "Responsible Role",
    "responsibleRolePlaceholder": "e.g. Sales Manager",
    "controlsPlaceholder": "Controls (Sprint 4)",
    "close": "Close"
  },
  "risks": {
    "processRisks": "Process Risks",
    "stepRisks": "Step Risks",
    "addProcessRisk": "+ Add Process Risk",
    "noProcessRisks": "No process risks linked",
    "noStepRisks": "No step risks linked",
    "remove": "Remove",
    "removeConfirm": "Remove risk link?"
  },
  "versions": {
    "title": "Version History",
    "current": "Current Version",
    "version": "Version {number}",
    "savedAt": "Saved on {date}",
    "by": "by {name}",
    "noComment": "No comment",
    "view": "View",
    "restore": "Restore",
    "restoreConfirm": "Restore version {number} as new version {newNumber}? The process will be reset to 'Draft'.",
    "noVersions": "No versions available"
  },
  "history": {
    "title": "Change History",
    "statusChange": "Status: {from} → {to}",
    "versionSaved": "BPMN Version {number} saved",
    "noHistory": "No history available"
  },
  "workflow": {
    "submitForReview": "Submit for Review",
    "approve": "Approve",
    "reject": "Reject",
    "publish": "Publish",
    "archive": "Archive",
    "createNewDraft": "Create New Version",
    "rejectReason": "Reason for Rejection",
    "rejectReasonRequired": "Reason is required (min. 10 characters)",
    "comment": "Comment",
    "commentPlaceholder": "Optional comment for status change",
    "noReviewerSet": "Please assign a reviewer first",
    "confirmSubmit": "Submit process '{name}' for review?",
    "confirmPublish": "Publish process '{name}'? All process owners will be notified.",
    "confirmArchive": "Archive process '{name}'?"
  },
  "ai": {
    "title": "Generate with AI",
    "description": "The AI generates a BPMN diagram based on your description.",
    "processName": "Process Name",
    "processDescription": "Process Description",
    "processDescriptionPlaceholder": "Describe the process flow in detail...",
    "processDescriptionHint": "More detail = better result (min. 10 characters)",
    "generate": "Generate BPMN",
    "generating": "AI is generating BPMN...",
    "loadInEditor": "Load in Editor",
    "discard": "Discard",
    "error": "AI could not generate valid BPMN. Please refine your description.",
    "preview": "Preview",
    "success": "BPMN generated ({steps} steps detected)"
  },
  "delete": {
    "title": "Delete Process",
    "confirm": "Delete process '{name}' and all sub-elements?",
    "withChildren": "This process has {count} sub-processes that will also be deleted.",
    "success": "Process deleted successfully"
  },
  "errors": {
    "notFound": "Process not found",
    "forbidden": "You do not have permission for this action",
    "moduleDisabled": "The BPM module is not enabled for your organization",
    "invalidTransition": "This status transition is not allowed",
    "loadFailed": "Failed to load process"
  }
}
```

