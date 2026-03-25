# ARCTOS — Product Requirements Document

## Sprint 4: Internal Control System + Document Management

Control Register + Control Testing (ToD/ToE) + Findings Management + Risk-Control Matrix + Document Repository + Versioning + Acknowledgments

May 2026 — ~83 Story Points — 6 Epics — 26 User Stories

Based on: Data Model v1.0 (47 Entities) | ADRs v1.0 (12 Decisions) | Gap Analysis v2.1 (K-01 bis K-08, K-NEW-01 bis K-NEW-04, DM-01 bis DM-07) | Market Analysis (GBTEC BIC, intellior Aeneis, CWA SmartProcess)

---

# 1. Sprint Overview

### Goal

Sprint 4 builds two tightly coupled modules for ARCTOS: the **Internal Control System (ICS)** and the **Document Management System (DMS)**. After this sprint, users can maintain a complete control library per organization with preventive/detective/corrective controls, execute Test-of-Design (ToD) and Test-of-Effectiveness (ToE) campaigns with evidence uploads, manage control deficiency findings with remediation workflows, visualize the Risk-Control Matrix (RCM) using Sprint 2's `risk_control` join table, maintain a central policy repository with lifecycle management (draft → review → approved → published → archived), track document versions with rollback capability, and collect read acknowledgments from employees for mandatory policies.

Sprint 4 fully satisfies requirements K-01 through K-06 (MUST) and DM-01 through DM-05 (MUST), with K-07 (GoBD), K-08 (SOX/HGB), DM-06 (Templates), and DM-07 (Full-text search) as SHOULD/NICE foundations only. The ICS module depends on the ERM module (`requires_modules: ['erm']`); the DMS module has no module dependencies.

### Sprint Scope

| **Epic** | **Description** | **Req-Ref** | **Scope** | **Priority** |
| --- | --- | --- | --- | --- |
| **Epic 11** | Control Register & Library | K-01, K-02, K-NEW-02, K-NEW-03 | **18 SP** | **MUST** |
| **Epic 12** | Control Testing (ToD/ToE) & Campaigns | K-03, K-NEW-01, K-05 | **14 SP** | **MUST** |
| **Epic 13** | Findings Management & Remediation | K-04, K-NEW-04 | **12 SP** | **MUST** |
| **Epic 14** | Risk-Control Matrix (RCM) | K-06 | **8 SP** | **MUST** |
| **Epic 15** | Document Repository & Lifecycle | DM-01, DM-02, DM-03, DM-04 | **18 SP** | **MUST** |
| **Epic 16** | Acknowledgments & Document Search | DM-05, DM-07 | **12 SP** | **MUST** |
| **TOTAL** | **6 Epics, 26 User Stories** | K-01–K-08, DM-01–DM-07 | **~83 SP** | |

### Dependencies

**Requires from Sprint 1–1.4 (completed):**
- Authentication (Auth.js sessions, JWT tokens)
- RBAC middleware (`requireRole()`, `requireLineOfDefense()`)
- RLS policies (all new tables receive `org_id` + RLS)
- Audit Trail (`audit_trigger()` auto-registered on all new tables)
- UI Shell (Sidebar navigation, Org Switcher, i18n, notification system)
- Task entity (Sprint 1.2) — used for control test assignments and finding remediation tasks
- Email service (Sprint 1.2) — used for acknowledgment requests and test campaign notifications
- Module system (Sprint 1.3) — `requireModule('ics')` and `requireModule('dms')` on all new routes
- Work Item system (Sprint 1.4) — controls and findings registered as work item types

**Requires from Sprint 2 (completed):**
- Risk entity — for `risk_control` (RCM) linkage population
- `risk_control` join table — created in Sprint 2 as placeholder, populated in Sprint 4
- `risk_framework_mapping` — for SoA cross-reference with controls
- Evidence entity schema pattern (polymorphic `entity_type` + `entity_id`)

**Requires from Sprint 3 (completed):**
- Process entity — for `process_control` and `process_step_control` linkage
- BPMN viewer — control badges on process steps (analogous to risk overlay badges)

**Blocks:**
- Sprint 5 (ISMS) — requires Control entity for assessment wizard control evaluation, maturity ratings (I-NEW-05), and controls-on-assets (K-NEW-05)
- Sprint 8 (Audit Management) — requires Finding entity for audit findings (shared entity), Control entity for audit checklist generation
- Sprint 4b (Catalog & Framework) — ControlCatalog entity references control library patterns

**External dependencies:**
- `@uploadthing/react` or S3-compatible file upload — evidence and document file storage
- `react-diff-viewer-continued` — document version diff view (SHOULD, not blocking)
- `recharts` — RCM heatmap visualization (already in package.json)
- PostgreSQL `tsvector` — full-text search on documents (DM-07)

### Definition of Done (Sprint Level)

- All 26 user stories meet their acceptance criteria.
- All Sprint 4 ICS API routes use `requireModule('ics')` middleware — integration test: org with disabled ICS gets 404.
- All Sprint 4 DMS API routes use `requireModule('dms')` middleware — integration test: org with disabled DMS gets 404.
- All Sprint 4 ICS pages use `<ModuleGate moduleKey="ics">` — disabled ICS shows teaser page.
- All Sprint 4 DMS pages use `<ModuleGate moduleKey="dms">` — disabled DMS shows teaser page.
- Every new control creates a `work_item` record with `type_key='control'` and element_id in `CTL00000NNN` format.
- Every new finding creates a `work_item` record with `type_key='finding'` and element_id in `FND00000NNN` format.
- Controls and findings appear in GET /work-items hub alongside risks and other GRC objects.
- RLS policies verified: User A (CWS) cannot see controls or documents from Org B — integration tests pass.
- Audit trail: every control/document/finding create/update/delete/status_change logged with before/after JSONB diff.
- RCM view renders correctly with risk rows × control columns, color-coded by coverage status.
- Control test campaign notifications delivered in-app and via email to assigned testers.
- Document acknowledgment tracking shows compliance percentage per document.
- Code coverage: backend > 80%, frontend > 60%.
- All UI labels translated in DE + EN via next-intl.
- 0 TypeScript `any` types (except permitted type guards).
- Performance: all API endpoints < 200ms with 500 controls/documents per org.

---

# 2. Database Scope Sprint 4

The following tables are implemented in Sprint 4. All receive:
- Cross-cutting mandatory fields (`created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at`, `deleted_by`)
- `org_id` FK → Organization (RLS policy applied) — except `control_test` which inherits org isolation via `control_id`
- Registration of `audit_trigger()` (existing Sprint 1 trigger function)

| **Table** | **Description** | **Epic** | **Type** |
| --- | --- | --- | --- |
| **control** | Core control entity: title, type, frequency, automation level, line of defense, status | Epic 11 | New |
| **control_test** | Test instances per control: ToD/ToE, tester, result, dates | Epic 12 | New |
| **control_test_campaign** | Test campaign grouping: period, scope, assigned controls, status | Epic 12 | New |
| **evidence** | Universal evidence container: files attached to any entity (control_test, finding, etc.) | Epic 12 | New |
| **finding** | Control deficiency findings: severity, type, root cause, remediation, status | Epic 13 | New |
| **document** | Central policy/document entity: title, category, lifecycle status, versioning | Epic 15 | New |
| **document_version** | Version history per document: content snapshot, change summary | Epic 15 | New |
| **acknowledgment** | Read confirmation per user per document version | Epic 16 | New |
| **process_control** | m:n join: control linked to entire process (Level 2) | Epic 11 | New |
| **process_step_control** | m:n join: control linked to specific process step (Level 3) | Epic 11 | New |
| **risk_control** | m:n join: risk ↔ control (RCM) — **table exists from Sprint 2, now populated** | Epic 14 | Populated |
| **document_entity_link** | m:n join: document linked to any entity (risk, control, process, framework req.) | Epic 15 | New |

### New Enums (Sprint 4 Migrations)

```sql
-- Control enums (some already exist from Sprint 2 schema)
CREATE TYPE control_type AS ENUM ('preventive', 'detective', 'corrective');
CREATE TYPE control_freq AS ENUM ('event_driven', 'continuous', 'daily', 'weekly', 'monthly', 'quarterly', 'annually', 'ad_hoc');
CREATE TYPE automation_level AS ENUM ('manual', 'semi_automated', 'fully_automated');
CREATE TYPE control_status AS ENUM ('designed', 'implemented', 'effective', 'ineffective', 'retired');
CREATE TYPE control_assertion AS ENUM ('completeness', 'accuracy', 'obligations_and_rights', 'fraud_prevention', 'existence', 'valuation', 'presentation', 'safeguarding_of_assets');

-- Test enums
CREATE TYPE test_type AS ENUM ('design_effectiveness', 'operating_effectiveness');
CREATE TYPE test_result AS ENUM ('effective', 'ineffective', 'partially_effective', 'not_tested');
CREATE TYPE test_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');
CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'completed', 'cancelled');

-- Finding enums
CREATE TYPE finding_severity AS ENUM ('observation', 'recommendation', 'improvement_requirement', 'insignificant_nonconformity', 'significant_nonconformity');
CREATE TYPE finding_status AS ENUM ('identified', 'in_remediation', 'remediated', 'verified', 'accepted', 'closed');
CREATE TYPE finding_source AS ENUM ('control_test', 'audit', 'incident', 'self_assessment', 'external');

-- Document enums
CREATE TYPE document_category AS ENUM ('policy', 'procedure', 'guideline', 'template', 'record', 'tom', 'dpa', 'bcp', 'soa', 'other');
CREATE TYPE document_status AS ENUM ('draft', 'in_review', 'approved', 'published', 'archived', 'expired');

-- Evidence enums (universal)
CREATE TYPE evidence_category AS ENUM ('screenshot', 'document', 'log_export', 'email', 'certificate', 'report', 'photo', 'config_export', 'other');
```

### Migration Order

```
060_create_control_enums.sql
061_create_control.sql
062_create_control_test_campaign.sql
063_create_control_test.sql
064_create_evidence.sql
065_create_finding.sql
066_create_document.sql
067_create_document_version.sql
068_create_acknowledgment.sql
069_create_process_control.sql
070_create_process_step_control.sql
071_create_document_entity_link.sql
072_enable_rls_sprint4_tables.sql
073_register_audit_triggers_sprint4.sql
074_create_document_search_index.sql
075_seed_demo_controls.sql
076_seed_demo_documents.sql
```

---

# 3. Epic 11: Control Register & Library

**Ref:** K-01, K-02, K-NEW-02, K-NEW-03. **ADR-001** (RLS), **ADR-011** (Audit Trail).

The Control Register is the central library of all internal controls per organization. Controls are categorized by type (preventive/detective/corrective), frequency (event-driven through annually), automation level (manual/semi-automated/fully-automated), and line of defense (1st/2nd/3rd). Controls follow a 3-level assignment model matching the Risk entity: Level 1 = Organization, Level 2 = Process (via `process_control`), Level 3 = Process Step (via `process_step_control`).

**Status Flow:** `designed` → `implemented` → `effective` OR `ineffective` → `retired`
Each transition triggers an audit log entry and optionally a notification to the control owner.

| **ID** | **User Story** | **Priority** | **SP** | **Acceptance Criteria** |
| --- | --- | --- | --- | --- |
| **S4-01** | **Create Control** *As a control_owner, risk_manager, or admin, I can create a new control (title, description, type, frequency, automation level, line of defense, owner, assertions) so that it appears in the control library with status "designed".* | **MUST** | **3 SP** | ✓ POST /api/v1/controls creates control with all fields from Control data model ✓ Validation: title required (max 500 chars), control_type ∈ {preventive, detective, corrective}, frequency ∈ {event_driven, continuous, daily, weekly, monthly, quarterly, annually, ad_hoc} (Ref: K-NEW-03), automation_level ∈ {manual, semi_automated, fully_automated}, line_of_defense ∈ {first, second, third} ✓ assertions: array of control_assertion values (multi-select, Ref: K-NEW-02, 8 COSO assertion types) ✓ owner_id must be a valid user in the same org with role control_owner, risk_manager, or admin ✓ Status defaults to "designed" ✓ Creates work_item record with type_key='control', element_id='CTL00000NNN' ✓ Audit log: action=create, entity_type=control ✓ Notification sent to assigned owner: "Sie wurden als Control Owner für [Titel] zugewiesen" |
| **S4-02** | **Control Register List** *As any user with access to my org, I can view a filterable, sortable list of all active controls so that I have an overview of the control landscape.* | **MUST** | **5 SP** | ✓ GET /api/v1/controls returns paginated list (default 25 per page, max 100) ✓ Columns displayed: Element-ID, Title, Type, Frequency, Automation Level, Line of Defense, Owner, Status, Last Tested, Assertions ✓ Filters: status (multi-select), control_type (multi-select), frequency (multi-select), automation_level (multi-select), line_of_defense (multi-select), owner_id, assertions (multi-select) ✓ Sort: by title, status, last_tested_at, created_at ✓ Search: full-text search on title + description (PostgreSQL tsvector) ✓ Soft-deleted controls excluded by default; admin can toggle "show archived" ✓ Color-coded status badges: designed=gray, implemented=blue, effective=green, ineffective=red, retired=gray-striped ✓ Row click → /controls/[id] ✓ Role-based: viewer sees read-only list; control_owner sees action buttons ✓ Checkbox selection: select all on page, select all matching filter ✓ Bulk actions (risk_manager, admin): Bulk status change, Bulk owner reassignment, Export selected (CSV/Excel) ✓ Max bulk selection: 100 records ✓ Progress feedback for bulk operations > 5 records ✓ Audit log: bulk operations logged with {bulk_operation_id, affected_count} |
| **S4-03** | **Control Detail Page** *As any authorized user, I can view the full detail of a control with all linked data (tests, findings, risks, processes, evidence, audit history).* | **MUST** | **3 SP** | ✓ GET /api/v1/controls/:id returns full control object including linked tests, findings, risks (RCM), processes, evidence ✓ Page: /controls/[id] with 7 tabs: Overview, Tests, Findings, RCM (Risks), Processes, Evidence, History ✓ Overview tab: title, description, type, frequency, automation_level, line_of_defense, owner, assertions, status badge ✓ Tests tab: list of all control_test records (ToD + ToE) with results and dates ✓ Findings tab: all findings linked to this control via finding.control_id ✓ RCM tab: all risks linked via risk_control with risk score and treatment status ✓ History tab: full audit timeline (from audit_log) showing all changes ✓ 404 if control belongs to different org (RLS enforced) ✓ Breadcrumb: Dashboard > Controls > [Control Title] |
| **S4-04** | **Control Status Workflow** *As a control_owner or admin, I can transition a control through its lifecycle (designed → implemented → effective/ineffective → retired) so that the current state is always visible.* | **MUST** | **3 SP** | ✓ PUT /api/v1/controls/:id/status with body {status: "implemented"} ✓ Valid transitions: designed→implemented, implemented→effective, implemented→ineffective, effective→ineffective, ineffective→effective, effective→retired, ineffective→retired, any→designed (reopen) ✓ Invalid transitions return 400 with error message ✓ On transition to "effective": requires at least one control_test with result='effective' and test_type='operating_effectiveness' ✓ On transition to "ineffective": automatically creates a finding with severity='improvement_requirement' and source='control_test' ✓ Audit log: action=status_change, changes={"status": {"old": "...", "new": "..."}} ✓ Notification to owner and risk_manager on status_change |
| **S4-05** | **Control ↔ Process & Process Step Linkage** *As a control_owner or process_owner, I can link a control to processes and process steps so that controls are placed in operational context and visible in the BPMN editor.* | **SHOULD** | **2 SP** | ✓ POST /api/v1/controls/:id/process-links with {process_id, control_context} creates process_control record ✓ POST /api/v1/controls/:id/process-step-links with {process_step_id, control_context} creates process_step_control record ✓ DELETE endpoints for both ✓ Processes tab on control detail: two sections — "Verknüpfte Prozesse" and "Verknüpfte Prozessschritte" ✓ On BPMN viewer (Sprint 3): linked controls visible as blue shield badges on shapes (analogous to risk overlay red badges) ✓ Audit log: action=link/unlink |

---

# 4. Epic 12: Control Testing (ToD/ToE) & Campaigns

**Ref:** K-03, K-NEW-01, K-05. **ADR-001** (RLS).

Control testing validates that controls are properly designed (Test-of-Design) and operationally effective (Test-of-Effectiveness). Tests are organized into campaigns — periodic batches of tests assigned to testers with deadlines. Each test independently evaluates ToD and ToE (Ref: K-NEW-01 — separate result fields for both dimensions). Evidence can be attached to each test. The task entity from Sprint 1.2 is used for test assignments.

| **ID** | **User Story** | **Priority** | **SP** | **Acceptance Criteria** |
| --- | --- | --- | --- | --- |
| **S4-06** | **Create Control Test Campaign** *As a risk_manager or admin, I can create a control test campaign (name, period, scope of controls, assigned testers, deadline) so that periodic testing is planned and organized.* | **MUST** | **3 SP** | ✓ POST /api/v1/control-test-campaigns creates campaign with: name (required), description, period_start (date), period_end (date), status (draft/active/completed/cancelled), assigned_controls (array of control_ids) ✓ On status transition to "active": creates individual control_test records for each assigned control ✓ Each control_test gets a linked task (source_entity_type='control_test') assigned to control.owner_id with due_date = campaign.period_end ✓ Email notification to all assigned testers: "Kampagne '[Name]' gestartet — [n] Kontrolltests bis [Datum] durchzuführen" ✓ Campaign dashboard: progress bar showing completed/total tests ✓ Audit log: action=create on control_test_campaign |
| **S4-07** | **Execute Control Test (ToD + ToE)** *As a control_owner or designated tester, I can execute a control test by recording the Test-of-Design result and Test-of-Effectiveness result independently, with notes and evidence uploads.* | **MUST** | **5 SP** | ✓ PUT /api/v1/control-tests/:id with {tod_result, toe_result, tod_notes, toe_notes, executed_date} ✓ tod_result (Test-of-Design): ∈ {effective, ineffective, partially_effective, not_tested} — Ref: K-NEW-01, independent field ✓ toe_result (Test-of-Effectiveness): ∈ {effective, ineffective, partially_effective, not_tested} — Ref: K-NEW-01, independent field ✓ Both can be set independently (ToD may pass while ToE fails) ✓ result (legacy/overall) computed: if both effective → effective; if any ineffective → ineffective; if any partially → partially_effective ✓ Status auto-transitions: planned → in_progress (on first save), in_progress → completed (when both tod_result and toe_result are not 'not_tested') ✓ On ineffective result: prompt to create finding (pre-filled with control reference) ✓ Evidence upload section: drag-drop files → creates evidence records with entity_type='control_test' ✓ Audit log: action=update with full before/after diff ✓ Linked task status updated to 'completed' when test is completed |
| **S4-08** | **Control Test List & Filtering** *As a risk_manager or admin, I can view all control tests across the organization with filtering by campaign, result, status, tester, and date range.* | **MUST** | **3 SP** | ✓ GET /api/v1/control-tests returns paginated list ✓ Filters: campaign_id, control_id, test_type, tod_result, toe_result, status, tester_id, date range (planned_date, executed_date) ✓ Columns: Control Title, Campaign, Tester, Planned Date, Executed Date, ToD Result, ToE Result, Status ✓ Color coding: effective=green, ineffective=red, partially_effective=yellow, not_tested=gray ✓ Overdue indicator: planned_date < today AND status != completed ✓ Export: CSV/Excel with all test data |
| **S4-09** | **Evidence Upload & Management** *As any authorized user, I can upload evidence files (screenshots, logs, certificates, documents) and attach them to control tests, findings, or other entities.* | **MUST** | **3 SP** | ✓ POST /api/v1/evidence with multipart form data: file, title, description, category, entity_type, entity_id, valid_from, valid_until ✓ Supported entity_types: 'control_test', 'finding', 'control', 'risk_treatment', 'document' (polymorphic attachment) ✓ File storage: S3-compatible storage, max 50MB per file, allowed types: PDF, PNG, JPG, DOCX, XLSX, CSV, TXT, ZIP ✓ GET /api/v1/evidence?entity_type=control_test&entity_id=:id returns all evidence for an entity ✓ Evidence card view: thumbnail (if image/PDF), title, category badge, upload date, uploader, validity period ✓ DELETE /api/v1/evidence/:id — soft delete, admin only ✓ Expired evidence (valid_until < today) shown with warning badge ✓ Audit log: action=create/delete on evidence |

---

# 5. Epic 13: Findings Management & Remediation

**Ref:** K-04, K-NEW-04. **ADR-001** (RLS).

Findings represent control deficiencies discovered through control tests, audits, incidents, or self-assessments. Each finding has a severity level based on the BIC GRC taxonomy (Ref: K-NEW-04): Observation, Recommendation, Improvement Requirement, Insignificant Nonconformity, Significant Nonconformity. Findings are linked to the originating control, to risks (via risk_control), and to remediation tasks. The Finding entity is shared between ICS (Sprint 4) and Audit Management (Sprint 8).

**Status Flow:** `identified` → `in_remediation` → `remediated` → `verified` → `closed`
Alternative: `identified` → `accepted` → `closed` (for accepted findings)

| **ID** | **User Story** | **Priority** | **SP** | **Acceptance Criteria** |
| --- | --- | --- | --- | --- |
| **S4-10** | **Create Finding** *As a control_owner, risk_manager, auditor, or admin, I can create a finding (title, description, severity, type, source, control reference, root cause, remediation plan) so that control deficiencies are documented and tracked.* | **MUST** | **3 SP** | ✓ POST /api/v1/findings creates finding with all fields ✓ Validation: title required (max 500 chars), severity ∈ {observation, recommendation, improvement_requirement, insignificant_nonconformity, significant_nonconformity} (Ref: K-NEW-04) ✓ source ∈ {control_test, audit, incident, self_assessment, external} ✓ control_id: optional FK → control (populated when finding comes from control test) ✓ control_test_id: optional FK → control_test (populated when auto-generated from failed test) ✓ root_cause: text field for root cause analysis ✓ remediation_plan: text field for planned remediation ✓ responsible_id: user assigned for remediation ✓ due_date: target remediation date ✓ Status defaults to "identified" ✓ Creates work_item record with type_key='finding', element_id='FND00000NNN' ✓ Creates task (source_entity_type='finding') assigned to responsible_id with due_date ✓ Audit log: action=create, entity_type=finding ✓ Notification to responsible: "Neues Finding '[Titel]' ([Severity]) — Behebung bis [Datum]" |
| **S4-11** | **Finding List & Dashboard** *As a risk_manager or admin, I can view all findings in a filterable list and a dashboard showing distribution by severity, status, and age.* | **MUST** | **5 SP** | ✓ GET /api/v1/findings returns paginated list with filters: severity (multi-select), status (multi-select), source, control_id, responsible_id, overdue (boolean), date range ✓ Dashboard widgets (top of page): Total findings count, By severity (stacked bar), By status (donut), Overdue count (red badge), Average age of open findings ✓ Severity color coding: observation=blue, recommendation=teal, improvement_requirement=yellow, insignificant_nonconformity=orange, significant_nonconformity=red ✓ Overdue findings (due_date < today AND status NOT IN (verified, closed)) highlighted ✓ Export: PDF report with findings summary + CSV/Excel detail data |
| **S4-12** | **Finding Remediation Workflow** *As a responsible user, I can update finding status through its remediation lifecycle and attach evidence of resolution.* | **MUST** | **3 SP** | ✓ PUT /api/v1/findings/:id/status with body {status, notes} ✓ Valid transitions: identified→in_remediation, identified→accepted, in_remediation→remediated, remediated→verified, verified→closed, accepted→closed, any→identified (reopen) ✓ On transition to "remediated": evidence is recommended (UI prompt, not blocking) ✓ On transition to "verified": requires user with role auditor or risk_manager (verification by independent party) ✓ On transition to "accepted": requires justification text (min 50 chars) — documented risk acceptance ✓ Linked task auto-updates: finding status → task status mapping ✓ Audit log: action=status_change ✓ Notification chain: identified→risk_manager, remediated→auditor (for verification), verified→admin |
| **S4-13** | **Finding ↔ Risk & Control Linkage** *As a risk_manager, I can link findings to risks and controls so that the impact of control deficiencies on the risk landscape is visible.* | **SHOULD** | **1 SP** | ✓ finding.control_id FK links to originating control ✓ finding.risk_ids: linkage via control → risk_control → risk (computed, not stored) ✓ On finding detail page: "Betroffene Risiken" section shows all risks linked via the control's RCM entries ✓ On risk detail page (Sprint 2): "Offene Findings" section shows findings for all controls in the risk's RCM ✓ Finding with severity = significant_nonconformity → automatic escalation notification to all risk_managers |

---

# 6. Epic 14: Risk-Control Matrix (RCM)

**Ref:** K-06. **ADR-001** (RLS).

The Risk-Control Matrix (RCM) visualizes the relationship between risks and controls. The `risk_control` join table was created in Sprint 2; Sprint 4 populates it through the control detail page and provides a dedicated matrix visualization. The RCM is a key differentiator from basic GRC tools and a core requirement for ISO 27001 and NIS2 compliance.

| **ID** | **User Story** | **Priority** | **SP** | **Acceptance Criteria** |
| --- | --- | --- | --- | --- |
| **S4-14** | **Link Controls to Risks (RCM Population)** *As a control_owner or risk_manager, I can link a control to one or more risks (and vice versa) with a coverage description, so that the risk-control mapping is maintained.* | **MUST** | **3 SP** | ✓ POST /api/v1/controls/:id/risk-links with {risk_id, coverage_description, effectiveness_rating} creates risk_control record ✓ POST /api/v1/risks/:id/control-links with {control_id, coverage_description, effectiveness_rating} — same table, reverse direction ✓ effectiveness_rating ∈ {full, partial, planned, none} — how well the control mitigates this risk ✓ DELETE endpoints for unlinking ✓ Bidirectional: linkage visible on both risk detail (RCM tab) and control detail (RCM tab) ✓ When control status changes to "ineffective": all linked risks receive notification about control gap ✓ Audit log: action=link/unlink on risk_control |
| **S4-15** | **RCM Matrix Visualization** *As a risk_manager or admin, I can view the Risk-Control Matrix as an interactive matrix with risks as rows and controls as columns, color-coded by coverage status.* | **MUST** | **5 SP** | ✓ Page: /controls/rcm — dedicated RCM view ✓ Matrix: Y-axis = risks (sorted by risk_score_inherent desc), X-axis = controls (sorted by title) ✓ Cell colors: full coverage = green, partial = yellow, planned = blue, none/empty = red ✓ Cell hover tooltip: "[Risk Title] ↔ [Control Title]: [Coverage Description], Effectiveness: [Rating]" ✓ Cell click: navigate to risk_control detail or open inline edit panel ✓ Summary row (bottom): per control — "mitigates n risks, m fully covered" ✓ Summary column (right): per risk — "n controls assigned, m fully effective" ✓ Filters: risk_category, control_type, risk_score range ✓ Gaps highlighted: risks with 0 controls = red row, controls with 0 risks = gray column ✓ Export: PDF/Excel matrix export ✓ Responsive: on smaller screens, switch to list view with risk → controls cards |

---

# 7. Epic 15: Document Repository & Lifecycle

**Ref:** DM-01, DM-02, DM-03, DM-04. **ADR-001** (RLS).

The Document Repository is the central policy and document management hub. Documents follow a lifecycle from draft through publication, with mandatory review and approval gates. Every save creates a version; rollback to previous versions is supported. Documents can be linked to any GRC entity (risks, controls, processes, framework requirements) to provide contextual access from any module.

**Status Flow:** `draft` → `in_review` → `approved` → `published` → `archived` OR `expired`
Branching: `published` → `draft` (new version starts)

| **ID** | **User Story** | **Priority** | **SP** | **Acceptance Criteria** |
| --- | --- | --- | --- | --- |
| **S4-16** | **Create Document** *As any user with write access, I can create a new document (title, category, content, owner, reviewer) so that it appears in the document repository with status "draft".* | **MUST** | **3 SP** | ✓ POST /api/v1/documents creates document with all fields from Document data model ✓ Validation: title required (max 500 chars), category ∈ {policy, procedure, guideline, template, record, tom, dpa, bcp, soa, other} ✓ content: Markdown text (stored in document.content AND first document_version.content) ✓ file_path: optional file attachment (PDF, DOCX, etc.) — uploaded via evidence-style file upload ✓ owner_id: document owner (responsible for maintenance) ✓ reviewer_id: designated reviewer for approval workflow ✓ requires_acknowledgment: boolean — if true, published version triggers acknowledgment campaign ✓ tags: text[] for classification ✓ expires_at: optional expiry date (triggers reminder 30 days before) ✓ Status defaults to "draft", current_version = 1, creates initial document_version record ✓ Audit log: action=create, entity_type=document |
| **S4-17** | **Document Repository List** *As any user with access to my org, I can view a filterable, sortable list of all documents so that I can find policies, procedures, and guidelines.* | **MUST** | **5 SP** | ✓ GET /api/v1/documents returns paginated list ✓ Columns: Title, Category, Status, Owner, Reviewer, Version, Published Date, Expires At, Acknowledgment % ✓ Filters: status (multi-select), category (multi-select), owner_id, requires_acknowledgment, expired (boolean), tags ✓ Sort: by title, status, published_at, expires_at, created_at ✓ Search: full-text search on title + content (PostgreSQL tsvector) — Ref: DM-07 ✓ Status badges: draft=gray, in_review=yellow, approved=blue, published=green, archived=gray-striped, expired=red ✓ Acknowledgment column: "85% (17/20)" — percentage of required acknowledgments received ✓ Expired documents shown with red badge and "Abgelaufen" / "Expired" label ✓ Row click → /documents/[id] ✓ Checkbox selection: select all on page, select all matching filter ✓ Bulk actions (admin, risk_manager): Bulk status change, Bulk owner reassignment, Bulk tag assignment, Export selected (CSV/Excel) ✓ Max bulk selection: 100 records |
| **S4-18** | **Document Detail Page with Version History** *As any authorized user, I can view the full document detail including current content, version history, linked entities, acknowledgment status, and audit trail.* | **MUST** | **3 SP** | ✓ GET /api/v1/documents/:id returns full document with current content + metadata ✓ Page: /documents/[id] with 6 tabs: Content, Versions, Linkages, Acknowledgments, Evidence, History ✓ Content tab: rendered Markdown content with metadata sidebar (owner, reviewer, dates, status, tags) ✓ Versions tab: list of all document_version records with version number, change summary, author, date ✓ Each version: "View" button (renders that version's content), "Restore" button (admin only — creates new version from old content) ✓ Linkages tab: all linked entities (risks, controls, processes, framework requirements) with entity type icon + title ✓ Acknowledgments tab: list of users who acknowledged, date, version — with "pending" list for users who haven't ✓ Breadcrumb: Dashboard > Documents > [Document Title] |
| **S4-19** | **Document Lifecycle Workflow** *As a document owner, reviewer, or admin, I can transition a document through its lifecycle (draft → in_review → approved → published → archived/expired).* | **MUST** | **3 SP** | ✓ PUT /api/v1/documents/:id/status with body {status, notes} ✓ Valid transitions: draft→in_review, in_review→approved, in_review→draft (rejection with notes), approved→published, published→archived, published→draft (start new version), any→expired (system or manual) ✓ On transition to "in_review": notification to reviewer_id ✓ On transition to "approved": notification to owner_id + "Bereit zur Veröffentlichung" ✓ On transition to "published": if requires_acknowledgment = true → triggers acknowledgment campaign (see S4-22) ✓ On transition to "published" from "draft" (new version cycle): creates new document_version, increments current_version, sets published_at ✓ Rejection (in_review → draft): notes field required (min 20 chars, reason for rejection), notification to owner ✓ Audit log: action=status_change with before/after |
| **S4-20** | **Document Versioning & Rollback** *As a document owner or admin, I can view previous versions, compare them, and restore an older version as the new current version.* | **MUST** | **2 SP** | ✓ GET /api/v1/documents/:id/versions returns all document_version records ✓ GET /api/v1/documents/:id/versions/:versionNumber returns specific version content ✓ POST /api/v1/documents/:id/restore with {version_number} creates a NEW version with the old version's content, change_summary = "Restored from version [n]" ✓ Version comparison: GET /api/v1/documents/:id/versions/compare?from=2&to=3 returns diff (computed server-side) ✓ UI: "Version vergleichen" dialog with side-by-side or inline diff view ✓ Rollback resets status to "draft" (must go through review/approval again) ✓ Audit log: action=restore with version reference |
| **S4-21** | **Document ↔ Entity Linkage** *As any authorized user, I can link a document to risks, controls, processes, or framework requirements so that relevant documents are accessible from any module.* | **MUST** | **2 SP** | ✓ POST /api/v1/documents/:id/entity-links with {entity_type, entity_id, link_description} creates document_entity_link ✓ Supported entity_types: 'risk', 'control', 'process', 'requirement', 'finding', 'audit' ✓ DELETE endpoint for unlinking ✓ Linkages tab on document detail: grouped by entity type with entity title + link description ✓ Reverse direction: on risk/control/process detail pages, "Verknüpfte Dokumente" section shows linked documents with category icon + status badge ✓ DM-04 fully satisfied: contextual document access from any GRC module |

---

# 8. Epic 16: Acknowledgments & Document Search

**Ref:** DM-05, DM-07.

Acknowledgments ensure that employees have read and confirmed mandatory policies. When a document with `requires_acknowledgment = true` is published, the system generates acknowledgment requests for all relevant users. A compliance dashboard tracks acknowledgment rates. Full-text search (DM-07) enables finding documents, controls, and risks by content.

| **ID** | **User Story** | **Priority** | **SP** | **Acceptance Criteria** |
| --- | --- | --- | --- | --- |
| **S4-22** | **Acknowledgment Campaign** *As the system, when a document with requires_acknowledgment=true is published, I automatically create acknowledgment requests for all active users in the org and track completion.* | **MUST** | **3 SP** | ✓ On document publication (status → published, requires_acknowledgment = true): query all active users in the org → create pending acknowledgment intent (no DB record yet — record created on acknowledgment) ✓ In-app notification to all users: "Neues Pflichtdokument: '[Title]' — bitte zur Kenntnis nehmen" ✓ Email notification (template_key='document_acknowledgment_request'): link to document + "Kenntnisnahme bestätigen" button ✓ Reminder: scheduled notification 7 days after publication for users who haven't acknowledged ✓ Second reminder: 14 days, escalation to admin if still not acknowledged ✓ GET /api/v1/documents/:id/acknowledgment-status returns: total_users, acknowledged_count, pending_users[], acknowledgment_percentage |
| **S4-23** | **Acknowledge Document** *As a user, I can acknowledge that I have read a mandatory document, recording my confirmation with timestamp.* | **MUST** | **3 SP** | ✓ POST /api/v1/documents/:id/acknowledge creates acknowledgment record with {document_id, user_id (from session), acknowledged_at (now), version_acknowledged (current_version)} ✓ Idempotent: if already acknowledged for this version, return 200 (no duplicate) ✓ New version published: previous acknowledgments are NOT carried over — users must re-acknowledge ✓ UI: Banner on document content page for unacknowledged documents: "Dieses Dokument erfordert Ihre Kenntnisnahme" with "Gelesen und zur Kenntnis genommen" button ✓ After acknowledgment: banner changes to "Bestätigt am [Date] (Version [n])" ✓ My Documents view (/documents?view=pending): list of documents pending my acknowledgment |
| **S4-24** | **Acknowledgment Compliance Dashboard** *As an admin or risk_manager, I can view the acknowledgment compliance status across all mandatory documents.* | **MUST** | **3 SP** | ✓ Page: /documents/compliance — dashboard for acknowledgment tracking ✓ Table: all documents with requires_acknowledgment=true, columns: Title, Version, Published Date, Total Users, Acknowledged, Pending, Compliance % ✓ Color coding: 100% = green, 80-99% = yellow, <80% = red ✓ Click on document row: expand to show list of pending users with "Send Reminder" action button ✓ Bulk action: "Erinnerung an alle ausstehenden senden" sends reminder to all pending users across all documents ✓ Export: CSV/Excel of compliance status |
| **S4-25** | **Full-Text Search across Documents** *As any user, I can search across all documents and their content using full-text search with highlighting and relevance ranking.* | **SHOULD** | **3 SP** | ✓ GET /api/v1/search?q=term&scope=documents returns ranked results ✓ Search scope: document title + document content (Markdown) + tags ✓ PostgreSQL tsvector index on document.title, document.content, document.tags ✓ Results: title, excerpt with search term highlighted (ts_headline), category, status, relevance score ✓ Filters on search results: category, status, date range ✓ UI: global search bar in header expands with scope selector (Documents, Controls, Risks, All) ✓ Performance: <200ms for search across 1,000 documents |

---

# 9. API Endpoint Summary

All endpoints prefixed with `/api/v1/`. All endpoints use `requireModule('ics')` or `requireModule('dms')` middleware respectively. All mutating endpoints require authentication + RBAC.

### ICS Module Endpoints

| **Method** | **Path** | **Roles** | **Description** |
| --- | --- | --- | --- |
| **GET** | /controls | all roles | List all controls (paginated, filtered) |
| **POST** | /controls | control_owner, risk_manager, admin | Create control |
| **GET** | /controls/rcm | risk_manager, admin, auditor | Risk-Control Matrix view |
| **GET** | /controls/:id | all roles | Control detail |
| **PUT** | /controls/:id | control_owner, risk_manager, admin | Update control fields |
| **DELETE** | /controls/:id | admin | Soft delete control |
| **PUT** | /controls/:id/status | control_owner, risk_manager, admin | Status transition |
| **GET** | /controls/:id/risk-links | all roles | List linked risks (RCM) |
| **POST** | /controls/:id/risk-links | control_owner, risk_manager, admin | Link control to risk |
| **DELETE** | /controls/:id/risk-links/:linkId | risk_manager, admin | Unlink from risk |
| **POST** | /controls/:id/process-links | control_owner, process_owner, admin | Link to process |
| **DELETE** | /controls/:id/process-links/:linkId | control_owner, admin | Unlink from process |
| **POST** | /controls/:id/process-step-links | control_owner, process_owner, admin | Link to process step |
| **DELETE** | /controls/:id/process-step-links/:linkId | control_owner, admin | Unlink from process step |
| **GET** | /control-test-campaigns | risk_manager, admin | List campaigns |
| **POST** | /control-test-campaigns | risk_manager, admin | Create campaign |
| **GET** | /control-test-campaigns/:id | all roles | Campaign detail |
| **PUT** | /control-test-campaigns/:id | risk_manager, admin | Update campaign |
| **PUT** | /control-test-campaigns/:id/status | risk_manager, admin | Campaign status change |
| **GET** | /control-tests | all roles | List all tests (filtered) |
| **GET** | /control-tests/:id | all roles | Test detail |
| **PUT** | /control-tests/:id | control_owner, risk_manager, admin | Execute test (update results) |
| **GET** | /control-tests/export | risk_manager, admin, auditor | Export test data |
| **GET** | /findings | all roles | List findings |
| **POST** | /findings | control_owner, risk_manager, auditor, admin | Create finding |
| **GET** | /findings/:id | all roles | Finding detail |
| **PUT** | /findings/:id | risk_manager, admin | Update finding |
| **PUT** | /findings/:id/status | control_owner, risk_manager, auditor, admin | Status transition |
| **DELETE** | /findings/:id | admin | Soft delete finding |
| **GET** | /evidence | all roles | List evidence (filtered by entity) |
| **POST** | /evidence | control_owner, risk_manager, auditor, admin | Upload evidence |
| **GET** | /evidence/:id | all roles | Evidence detail/download |
| **DELETE** | /evidence/:id | admin | Soft delete evidence |

### DMS Module Endpoints

| **Method** | **Path** | **Roles** | **Description** |
| --- | --- | --- | --- |
| **GET** | /documents | all roles | List all documents (paginated, filtered) |
| **POST** | /documents | all roles with write | Create document |
| **GET** | /documents/compliance | admin, risk_manager | Acknowledgment compliance dashboard |
| **GET** | /documents/:id | all roles | Document detail |
| **PUT** | /documents/:id | document owner, reviewer, admin | Update document |
| **DELETE** | /documents/:id | admin | Soft delete document |
| **PUT** | /documents/:id/status | document owner, reviewer, admin | Lifecycle transition |
| **GET** | /documents/:id/versions | all roles | List all versions |
| **GET** | /documents/:id/versions/:versionNumber | all roles | Get specific version |
| **GET** | /documents/:id/versions/compare | all roles | Compare two versions |
| **POST** | /documents/:id/restore | document owner, admin | Restore previous version |
| **GET** | /documents/:id/entity-links | all roles | List linked entities |
| **POST** | /documents/:id/entity-links | all roles with write | Link to entity |
| **DELETE** | /documents/:id/entity-links/:linkId | document owner, admin | Unlink entity |
| **GET** | /documents/:id/acknowledgment-status | admin, risk_manager | Acknowledgment status |
| **POST** | /documents/:id/acknowledge | all roles | Acknowledge document |
| **POST** | /documents/:id/send-reminder | admin, risk_manager | Send acknowledgment reminder |
| **GET** | /search | all roles | Full-text search |

---

# 10. Technical Implementation Notes

### New Sidebar Navigation Entries (Sprint 4)

The following entries are added to the dynamic sidebar (module-gated):

```
Internes Kontrollsystem / Internal Controls (group header — nav_section: 'compliance')
  ├── Kontrollregister / Control Register → /controls [control_owner, risk_manager, admin, auditor, viewer]
  ├── Kontrolltest-Kampagnen / Test Campaigns → /controls/campaigns [risk_manager, admin]
  ├── Findings → /controls/findings [control_owner, risk_manager, admin, auditor]
  ├── Risiko-Kontroll-Matrix / RCM → /controls/rcm [risk_manager, admin, auditor]
  └── Nachweise / Evidence → /controls/evidence [control_owner, risk_manager, admin, auditor]

Dokumentenmanagement / Document Management (group header — nav_section: 'compliance')
  ├── Dokumentenablage / Repository → /documents [all roles]
  ├── Kenntnisnahme / Compliance → /documents/compliance [admin, risk_manager]
  └── Suche / Search → /search [all roles]
```

### Schema Extensions on Existing Tables

**control_test (extended from Data Model v1.0 for K-NEW-01):**
```sql
ALTER TABLE control_test ADD COLUMN tod_result test_result DEFAULT 'not_tested';
ALTER TABLE control_test ADD COLUMN toe_result test_result DEFAULT 'not_tested';
ALTER TABLE control_test ADD COLUMN tod_notes text;
ALTER TABLE control_test ADD COLUMN toe_notes text;
ALTER TABLE control_test ADD COLUMN campaign_id uuid REFERENCES control_test_campaign(id);
-- Original 'result' field is now computed: GENERATED ALWAYS AS (
--   CASE WHEN tod_result = 'effective' AND toe_result = 'effective' THEN 'effective'
--        WHEN tod_result = 'ineffective' OR toe_result = 'ineffective' THEN 'ineffective'
--        WHEN tod_result = 'partially_effective' OR toe_result = 'partially_effective' THEN 'partially_effective'
--        ELSE 'not_tested' END
-- ) STORED
```

**control (extended for K-NEW-02):**
```sql
ALTER TABLE control ADD COLUMN assertions control_assertion[] DEFAULT '{}';
```

**risk_control (enhanced for RCM — originally placeholder from Sprint 2):**
```sql
ALTER TABLE risk_control ADD COLUMN coverage_description text;
ALTER TABLE risk_control ADD COLUMN effectiveness_rating varchar(20) DEFAULT 'none';
-- effectiveness_rating ∈ ('full', 'partial', 'planned', 'none')
```

**control_test_campaign (new):**
```sql
CREATE TABLE control_test_campaign (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organization(id),
  name            varchar(500) NOT NULL,
  description     text,
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  status          campaign_status NOT NULL DEFAULT 'draft',
  created_by      uuid REFERENCES "user"(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);
```

**finding (extended from Data Model v1.0 for K-NEW-04):**
```sql
CREATE TABLE finding (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organization(id),
  title             varchar(500) NOT NULL,
  description       text,
  severity          finding_severity NOT NULL,
  source            finding_source NOT NULL DEFAULT 'control_test',
  status            finding_status NOT NULL DEFAULT 'identified',
  control_id        uuid REFERENCES control(id),
  control_test_id   uuid REFERENCES control_test(id),
  risk_id           uuid REFERENCES risk(id),
  root_cause        text,
  remediation_plan  text,
  responsible_id    uuid REFERENCES "user"(id),
  due_date          date,
  resolved_at       timestamptz,
  verified_by       uuid REFERENCES "user"(id),
  verified_at       timestamptz,
  justification     text,  -- required when status = 'accepted'
  created_by        uuid REFERENCES "user"(id),
  updated_by        uuid REFERENCES "user"(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);
```

**document_entity_link (new polymorphic linkage):**
```sql
CREATE TABLE document_entity_link (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      uuid NOT NULL REFERENCES document(id),
  entity_type      varchar(100) NOT NULL,  -- 'risk', 'control', 'process', 'requirement', 'finding', 'audit'
  entity_id        uuid NOT NULL,
  link_description text,
  created_by       uuid REFERENCES "user"(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, entity_type, entity_id)
);
```

**document full-text search index (DM-07):**
```sql
ALTER TABLE document ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('german', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('german', coalesce(content, '')), 'B') ||
    setweight(to_tsvector('german', coalesce(array_to_string(tags, ' '), '')), 'C')
  ) STORED;

CREATE INDEX idx_document_search ON document USING GIN (search_vector);
```

### RLS Configuration for Sprint 4 Tables

All Sprint 4 tables follow the Sprint 1 RLS pattern:
```sql
-- Direct org_id tables
ALTER TABLE control ENABLE ROW LEVEL SECURITY;
CREATE POLICY control_org_isolation ON control 
  USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE finding ENABLE ROW LEVEL SECURITY;
CREATE POLICY finding_org_isolation ON finding 
  USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE document ENABLE ROW LEVEL SECURITY;
CREATE POLICY document_org_isolation ON document 
  USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY evidence_org_isolation ON evidence 
  USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE control_test_campaign ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaign_org_isolation ON control_test_campaign 
  USING (org_id = current_setting('app.current_org_id')::uuid);

ALTER TABLE acknowledgment ENABLE ROW LEVEL SECURITY;
CREATE POLICY ack_org_isolation ON acknowledgment 
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- control_test inherits isolation via control_id FK (JOIN-based RLS)
-- document_version inherits isolation via document_id FK
-- process_control / process_step_control inherit via FK chains
```

### Audit Trigger Registration (Sprint 4 Additions)

```sql
CREATE TRIGGER control_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON control
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER control_test_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON control_test
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER control_test_campaign_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON control_test_campaign
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER finding_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON finding
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER document_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON document
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER document_version_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON document_version
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER evidence_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON evidence
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
-- Note: acknowledgment is NOT audited in audit_log (append-only, high volume)
-- document_entity_link audited via document audit (changes logged on parent)
```

### Work Item Type Registration (Sprint 4)

```sql
INSERT INTO work_item_type (type_key, display_name_de, display_name_en, icon, color, element_id_prefix, module_key)
VALUES 
  ('control', 'Kontrolle', 'Control', 'check-square', '#3B82F6', 'CTL', 'ics'),
  ('finding', 'Finding', 'Finding', 'alert-triangle', '#EF4444', 'FND', 'ics'),
  ('document', 'Dokument', 'Document', 'file-text', '#6366F1', 'DOC', 'dms');
```

### Module Definition Updates

```sql
-- Update module_definition seeds with Sprint 4 background processes
UPDATE module_definition SET background_processes = ARRAY['control-test-reminders', 'finding-remediation-escalation']
  WHERE module_key = 'ics';
UPDATE module_definition SET background_processes = ARRAY['document-expiry-reminders', 'acknowledgment-reminders']
  WHERE module_key = 'dms';
```

### File Storage Architecture

Evidence and document files use a consistent S3-compatible storage pattern:

```
/{org_id}/evidence/{year}/{month}/{evidence_id}/{original_filename}
/{org_id}/documents/{document_id}/versions/{version_number}/{original_filename}
```

- Max file size: 50MB per upload
- Allowed MIME types: application/pdf, image/png, image/jpeg, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv, text/plain, application/zip
- Virus scanning: deferred to Phase 2 (ClamAV integration)
- Presigned URLs: 15-minute expiry for downloads, direct upload to S3 for large files

---

# 11. Sprint Acceptance Criteria

### Functional

- **F-1:** A control_owner can create a control with type/frequency/assertions, see it in the register, and link it to a risk — the RCM matrix shows the new cell.
- **F-2:** A risk_manager creates a test campaign with 10 controls, activates it → 10 control_test records created, 10 tasks assigned, 10 email notifications sent.
- **F-3:** A tester executes a control test with ToD=effective and ToE=ineffective → overall result = ineffective, prompt to create finding appears.
- **F-4:** A finding with severity "significant_nonconformity" triggers escalation notification to all risk_managers in the org.
- **F-5:** Document lifecycle: draft → in_review → rejected (back to draft with notes) → in_review → approved → published → acknowledgment campaign triggered.
- **F-6:** User acknowledges a published document → acknowledgment recorded with timestamp and version; compliance dashboard updates to reflect new percentage.
- **F-7:** New document version published → old acknowledgments invalidated, new acknowledgment campaign triggered for all users.
- **F-8:** RCM matrix correctly shows all risk-control relationships with color-coded effectiveness ratings; gaps (risks without controls) highlighted in red.
- **F-9:** Navigating to /controls on an org with ICS disabled → ModuleGate teaser page shown (not a list, not a 404).
- **F-10:** Evidence uploaded to a control test → visible on test detail, control detail (Evidence tab), and downloadable with presigned URL.
- **F-11:** Document version restore: admin restores version 2 on a version-5 document → new version 6 created with version 2's content, status reset to draft.
- **F-12:** Full-text search for "Passwortrichtlinie" returns the password policy document with highlighted excerpt.

### Security

- **S-1:** requireModule('ics') integration test: org with ICS disabled → GET /api/v1/controls returns 404 (not 403, not 200).
- **S-2:** requireModule('dms') integration test: org with DMS disabled → GET /api/v1/documents returns 404.
- **S-3:** RLS integration test: User A (CWS GmbH) receives 0 control records when querying with Org B's IDs.
- **S-4:** RLS integration test: User A receives 0 documents from Org B — even direct API calls with known document IDs.
- **S-5:** RBAC test: viewer role receives 403 on POST /controls, POST /findings, DELETE /documents/:id.
- **S-6:** Finding verification (status → verified) can only be performed by auditor or risk_manager role — not by the finding's responsible_id (separation of duties).
- **S-7:** Evidence file download uses presigned URL with 15-minute expiry — direct S3 bucket access blocked.
- **S-8:** Soft-deleted controls, findings, and documents excluded from all list queries — verified by integration test.

### Performance

- **P-1:** GET /controls with 500 records (filtered, paginated) returns in < 200ms.
- **P-2:** GET /controls/rcm matrix with 200 risks × 100 controls renders in < 500ms.
- **P-3:** GET /documents full-text search across 1,000 documents returns in < 200ms.
- **P-4:** Evidence file upload (10MB PDF) completes in < 5 seconds.
- **P-5:** GET /documents/:id/acknowledgment-status computes percentage for 500 users in < 100ms.
- **P-6:** Control test campaign activation (creating 50 test records + 50 tasks + 50 notifications) completes in < 10 seconds.

### Quality

- **Q-1:** Code coverage: backend > 80%, frontend > 60%.
- **Q-2:** TypeScript strict mode — 0 `any` types except documented type guards.
- **Q-3:** All UI text available in DE and EN via next-intl.
- **Q-4:** 0 critical OWASP ZAP findings on new endpoints.

---

# 12. Outlook: Sprint 4b, Sprint 5, and Beyond

### Sprint 4b: Catalog & Framework Module (Planned)

Introduces 8 new tables for centralized risk and control catalogs: RiskCatalog, RiskCatalogEntry, ControlCatalog, ControlCatalogEntry, OrgRiskMethodology, OrgActiveCatalog, OrgCatalogExclusion, OrgCatalogInheritance. Seeds include Cambridge v2.0 (175 entries), NIST CSF 2.0 (106), BSI IT-GS (~100), ISO 27002:2022 (93), WEF (~30). Retrofits FK constraint on risk.catalog_entry_id from Sprint 2 hook. Methodology UI: ISO 31000/COSO/FAIR per org.settings.

### Sprint 5a/5b: ISMS (Information Security Management System)

Builds on Sprint 4's Control entity for: controls-on-assets linkage (K-NEW-05 — multi-framework controls per asset), maturity ratings on controls (I-NEW-05 — Current/Target Maturity 1–5), assessment wizard with control evaluation per asset. Protection Requirements (PRQ) as work item type linked to risk_asset. Incident management (I-NEW-10 through I-NEW-16). Sprint 5 split into 5a (Assets, PRQ, Incidents) and 5b (Assessment-Wizard, Maturity, Controls).

### Sprint 8: Audit Management

Uses Finding entity (shared from Sprint 4) for audit findings (A-04). Audit checklists generated from control register (A-03). Control test results feed into audit evidence (A-05). Findings → risk linkage provides risk-based audit planning input.

### Phase 2: Continuous Control Monitoring

compliance_checkpoint hypertable (already defined in Data Model v1.0) populated by automated integration connectors. Control status auto-updated based on real-time compliance checks. KRI linkage to control effectiveness metrics (Sprint 2 KRI → Sprint 4 control status).
