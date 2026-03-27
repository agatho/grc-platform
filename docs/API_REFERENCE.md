# ARCTOS API Reference

Base URL: `/api/v1`

All endpoints require authentication unless noted as **Public** or **Token-based**.
Auth is session-based via Auth.js. Roles are checked per organization context.

**Legend:**
- **Auth** = required roles (`withAuth(...)` or session-only). `any` = any authenticated user.
- **Module** = `requireModule` gate key. `-` = no module gate.

---

## Platform

Core platform endpoints: organizations, users, auth, modules, work items, notifications.

### Organizations

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/organizations` | admin | - | List organizations (paginated) |
| POST | `/organizations` | admin | - | Create organization |
| GET | `/organizations/:id` | any | - | Organization detail |
| PUT | `/organizations/:id` | admin | - | Update organization |
| GET | `/organizations/tree` | any | - | Hierarchical org tree |
| GET | `/organizations/dpos` | admin | - | List all DPOs across orgs |
| GET | `/organizations/:id/modules` | any | - | List module configs for org |
| PUT | `/organizations/:id/modules/:key` | admin | - | Enable/disable/configure module |
| GET | `/organizations/:id/active-catalogs` | any | - | List active catalogs for org |
| POST | `/organizations/:id/active-catalogs` | admin, risk_manager | - | Activate catalog for org |
| DELETE | `/organizations/:id/active-catalogs/:catalogId` | admin, risk_manager | - | Deactivate catalog |
| PUT | `/organizations/:id/dpo` | admin | - | Assign DPO to organization |
| GET | `/organizations/:id/risk-appetite` | any | erm | Get risk appetite |
| PUT | `/organizations/:id/risk-appetite` | admin, risk_manager | erm | Set risk appetite |
| GET | `/organizations/:id/risk-methodology` | any | - | Get risk methodology config |
| PUT | `/organizations/:id/risk-methodology` | admin, risk_manager | - | Set risk methodology config |
| GET | `/organizations/:id/bpmn-validation-config` | any | bpm | Get BPMN validation rules |
| PUT | `/organizations/:id/bpmn-validation-config` | admin, process_owner | bpm | Set BPMN validation rules |

### Users & Auth

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| POST | `/auth/switch-org` | any | - | Switch active organization |
| GET | `/users` | admin | - | List users in current org |
| GET | `/users/:id` | any (self or admin) | - | User detail |
| POST | `/users/:id/roles` | admin | - | Assign role to user |
| DELETE | `/users/:id/roles/:roleId` | admin | - | Revoke role |
| PUT | `/users/:id/profile` | any (self only) | - | Update own profile |
| GET | `/users/me/notification-preferences` | any | - | Get notification preferences |
| PUT | `/users/me/notification-preferences` | any | - | Update notification preferences |

### Invitations

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/invitations` | admin | - | List pending invitations |
| POST | `/invitations` | admin | - | Create invitation |
| POST | `/invitations/:token/accept` | **Public** | - | Accept invitation (token-based) |

### Notifications

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/notifications` | any | - | List own notifications |
| PUT | `/notifications/:id/read` | any | - | Mark notification as read |
| GET | `/notifications/scheduled` | admin | - | List scheduled notifications |
| POST | `/notifications/scheduled` | admin | - | Create scheduled notification |
| DELETE | `/notifications/scheduled/:id` | admin | - | Cancel scheduled notification |

### Module Definitions & Work Item Types

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/platform/module-definitions` | any | - | List all module definitions |
| GET | `/platform/work-item-types` | any | - | List all work item type definitions |

### Work Items

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/work-items` | any | - | List work items (paginated, filterable) |
| POST | `/work-items` | any | - | Create work item |
| GET | `/work-items/:id` | any | - | Work item detail |
| PUT | `/work-items/:id` | any | - | Update work item |
| PUT | `/work-items/:id/status` | any | - | Status transition |
| GET | `/work-items/:id/links` | any | - | List linked work items |
| POST | `/work-items/:id/links` | any | - | Create link between work items |
| DELETE | `/work-items/:id/links/:linkId` | any | - | Remove link |

### Tasks

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/tasks` | any | - | List tasks (paginated) |
| POST | `/tasks` | any | - | Create task |
| GET | `/tasks/:id` | any | - | Task detail |
| PUT | `/tasks/:id` | any | - | Update task |
| PUT | `/tasks/:id/status` | any | - | Status transition |
| GET | `/tasks/:id/comments` | any | - | List task comments |
| POST | `/tasks/:id/comments` | any | - | Add comment |
| POST | `/tasks/:id/notify` | any | - | Send task notification |

### Audit Trail & Access Log

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/audit-log` | admin, auditor, dpo | - | Query audit log (paginated, filterable) |
| GET | `/audit-log/integrity-check` | admin, auditor | - | Verify SHA-256 hash chain integrity |
| GET | `/access-log` | admin | - | Query login events |

### Search & Executive

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/search` | any | - | Full-text search across documents, controls, risks |
| GET | `/executive/dashboard` | admin, risk_manager | - | Cross-module KPI summary |
| GET | `/executive/trend` | admin, risk_manager | - | 12-month KPI trend snapshots |

---

## ERM (Enterprise Risk Management)

Module gate: `erm`

### Risks

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/risks` | any | erm | List risks (paginated, filterable) |
| POST | `/risks` | admin, risk_manager, control_owner, process_owner | erm | Create risk |
| GET | `/risks/:id` | any | erm | Risk detail with treatments and owner |
| PUT | `/risks/:id` | admin, risk_manager, control_owner | erm | Update risk |
| DELETE | `/risks/:id` | admin, risk_manager | erm | Soft-delete risk |
| PUT | `/risks/:id/status` | admin, risk_manager | erm | Status transition |
| PUT | `/risks/:id/assessment` | admin, risk_manager, control_owner | erm | Set inherent/residual scores |
| GET | `/risks/:id/residual-auto` | any | - | Auto-computed residual from CES |
| GET | `/risks/:id/treatments` | any | erm | List treatments |
| POST | `/risks/:id/treatments` | admin, risk_manager, control_owner | erm | Create treatment |
| PUT | `/risks/:id/treatments/:treatmentId` | admin, risk_manager, control_owner | erm | Update treatment |
| GET | `/risks/:id/asset-links` | any | erm | List linked assets |
| POST | `/risks/:id/asset-links` | admin, risk_manager, control_owner | erm | Link risk to asset |
| DELETE | `/risks/:id/asset-links/:linkId` | admin, risk_manager, control_owner | erm | Remove asset link |
| GET | `/risks/:id/process-links` | any | erm | List linked processes |
| POST | `/risks/:id/process-links` | admin, risk_manager, process_owner | erm | Link risk to process |
| DELETE | `/risks/:id/process-links/:linkId` | admin, risk_manager, process_owner | erm | Remove process link |
| GET | `/risks/:id/framework-mappings` | any | erm | List framework mappings |
| POST | `/risks/:id/framework-mappings` | admin, risk_manager | erm | Map risk to framework requirement |
| DELETE | `/risks/:id/framework-mappings/:mappingId` | admin, risk_manager | erm | Remove mapping |
| GET | `/risks/dashboard-summary` | any | erm | Risk dashboard KPIs |
| GET | `/risks/group-summary` | admin, risk_manager | erm | Cross-org risk summary |
| GET | `/risks/export` | admin, risk_manager, auditor | erm | Export risks as CSV/JSON |

### KRIs (Key Risk Indicators)

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/kris` | any | erm | List KRIs (paginated) |
| POST | `/kris` | admin, risk_manager | erm | Create KRI |
| GET | `/kris/:id` | any | erm | KRI detail |
| PUT | `/kris/:id` | admin, risk_manager | erm | Update KRI |
| GET | `/kris/:id/measurements` | any | erm | List KRI measurements |
| POST | `/kris/:id/measurements` | admin, risk_manager | erm | Record measurement |
| POST | `/kris/:id/measurements/batch` | admin, risk_manager | erm | Batch import measurements |
| GET | `/kris/export` | admin, risk_manager, auditor | erm | Export KRI data |

### ERM Compute

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| POST | `/erm/residual/recompute` | admin, risk_manager | - | Force recompute all residual scores |

---

## BPM (Business Process Management)

Module gate: `bpm`

### Processes

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/processes` | any | bpm | List processes (paginated, filterable) |
| POST | `/processes` | admin, process_owner | bpm | Create process |
| GET | `/processes/:id` | any | bpm | Process detail |
| PUT | `/processes/:id` | admin, process_owner | bpm | Update process |
| DELETE | `/processes/:id` | admin, process_owner | bpm | Soft-delete process |
| PUT | `/processes/:id/status` | admin, process_owner, risk_manager | bpm | Status transition |
| GET | `/processes/tree` | any | bpm | Hierarchical process tree |
| POST | `/processes/bulk` | admin, process_owner | bpm | Bulk operations |
| POST | `/processes/generate-bpmn` | admin, process_owner | bpm | AI-generated BPMN XML |
| GET | `/processes/governance` | admin, risk_manager, process_owner | bpm | Governance dashboard |
| GET | `/processes/governance/roadmap` | admin, risk_manager | bpm | Governance roadmap |

### Process Steps

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/processes/:id/steps` | any | bpm | List process steps |
| PUT | `/processes/:id/steps/:stepId` | admin, process_owner | bpm | Update step metadata |
| GET | `/processes/:id/step-risks` | any | bpm | Step-level risk overlay data |
| POST | `/processes/:id/steps/:stepId/risks` | admin, process_owner, risk_manager | bpm | Link risk to step |
| POST | `/processes/:id/steps/:stepId/controls` | admin, control_owner, process_owner | bpm | Link control to step |
| POST | `/processes/:id/steps/:stepId/assets` | admin, process_owner | bpm | Link asset to step |

### Process Links

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| POST | `/processes/:id/risks` | admin, process_owner, risk_manager | bpm | Link risk to process |
| POST | `/processes/:id/controls` | admin, control_owner, process_owner | bpm | Link control to process |
| POST | `/processes/:id/assets` | admin, process_owner | bpm | Link asset to process |
| POST | `/processes/:id/documents` | admin, process_owner | bpm | Link document to process |

### Process Versions & Comments

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/processes/:id/versions` | any | bpm | List versions |
| POST | `/processes/:id/versions` | admin, process_owner | bpm | Save BPMN as new version |
| GET | `/processes/:id/versions/:versionId` | any | bpm | Get specific version |
| GET | `/processes/:id/versions/compare` | any | bpm | Compare two versions |
| POST | `/processes/:id/versions/restore` | admin, process_owner | bpm | Restore old version |
| GET | `/processes/:id/comments` | any | bpm | List comments |
| POST | `/processes/:id/comments` | any | bpm | Add comment |
| PUT | `/processes/:id/comments/:commentId/resolve` | any | bpm | Resolve comment |
| GET | `/processes/:id/review-schedule` | any | bpm | Get review schedule |
| POST | `/processes/:id/review-schedule` | admin, process_owner | bpm | Set review schedule |
| GET | `/processes/:id/validate` | any | bpm | Validate BPMN XML |
| GET | `/processes/:id/export/xml` | any | bpm | Download BPMN XML file |
| GET | `/processes/:id/export/svg` | any | bpm | SVG export (501 - client-side only) |

---

## ICS (Internal Control System)

Module gate: `ics`

### Controls

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/controls` | any | ics | List controls (paginated, filterable) |
| POST | `/controls` | admin, risk_manager, control_owner, auditor | ics | Create control |
| GET | `/controls/:id` | any | ics | Control detail |
| PUT | `/controls/:id` | admin, risk_manager, control_owner | ics | Update control |
| DELETE | `/controls/:id` | admin, risk_manager | ics | Soft-delete control |
| PUT | `/controls/:id/status` | admin, risk_manager, control_owner | ics | Status transition |
| GET | `/controls/:id/ces` | any | - | Get CES for control |
| GET | `/controls/:id/risk-links` | any | ics | List linked risks |
| POST | `/controls/:id/risk-links` | admin, risk_manager, control_owner | ics | Link control to risk |
| DELETE | `/controls/:id/risk-links/:linkId` | admin, risk_manager, control_owner | ics | Unlink risk |
| GET | `/controls/rcm` | any | ics | Risk-Control Matrix |

### Control Tests

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/control-tests` | any | ics | List control tests |
| GET | `/control-tests/:id` | any | ics | Test detail with evidence + findings |
| PUT | `/control-tests/:id` | admin, risk_manager, auditor, control_owner | ics | Update/execute test |

### Control Test Campaigns

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/control-test-campaigns` | any | ics | List campaigns |
| POST | `/control-test-campaigns` | admin, risk_manager, auditor | ics | Create campaign |
| GET | `/control-test-campaigns/:id` | any | ics | Campaign detail with stats |
| PUT | `/control-test-campaigns/:id` | admin, risk_manager, auditor | ics | Update campaign |
| PUT | `/control-test-campaigns/:id/status` | admin, risk_manager, auditor | ics | Activate/complete campaign |

### CES & Findings

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/ics/ces/overview` | any | - | All CES scores (paginated) |
| GET | `/ics/ces/heatmap` | any | - | CES heatmap (controlType x frequency) |
| POST | `/ics/ces/recompute` | admin, risk_manager | - | Force recompute CES scores |
| GET | `/ics/finding-sla` | any | - | Get finding SLA config |
| PUT | `/ics/finding-sla` | admin, risk_manager | - | Update finding SLA config |

### Evidence

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/evidence` | any | - | List evidence (paginated) |
| POST | `/evidence` | any | - | Upload evidence |
| GET | `/evidence/:id` | any | - | Evidence detail |
| DELETE | `/evidence/:id` | admin, risk_manager, auditor | - | Delete evidence |

### Findings

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/findings` | any | - | List findings (paginated) |
| POST | `/findings` | any | - | Create finding |
| GET | `/findings/:id` | any | - | Finding detail |
| PUT | `/findings/:id` | any | - | Update finding |
| PUT | `/findings/:id/status` | any | - | Status transition |
| GET | `/findings/analytics/aging` | any | - | Aging analysis |
| GET | `/findings/analytics/sla` | any | - | SLA compliance analysis |
| GET | `/findings/analytics/ttr` | any | - | Time-to-remediation analysis |

---

## DMS (Document Management System)

Module gate: `dms`

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/documents` | any | dms | List documents (paginated, filterable) |
| POST | `/documents` | admin, risk_manager, control_owner, dpo, process_owner | dms | Create document |
| GET | `/documents/:id` | any | dms | Document detail |
| PUT | `/documents/:id` | admin, risk_manager, control_owner, dpo, process_owner | dms | Update document |
| DELETE | `/documents/:id` | admin | dms | Soft-delete document |
| PUT | `/documents/:id/status` | admin, risk_manager, control_owner, dpo | dms | Lifecycle transition |
| GET | `/documents/:id/versions` | any | dms | List all versions |
| GET | `/documents/:id/versions/:versionId` | any | dms | Get specific version |
| POST | `/documents/:id/acknowledge` | any | dms | Record acknowledgment |
| GET | `/documents/:id/acknowledgment-status` | any | dms | Compliance status |
| GET | `/documents/:id/entity-links` | any | dms | List entity links |
| POST | `/documents/:id/entity-links` | admin, risk_manager, control_owner, dpo, process_owner | dms | Link document to entity |
| DELETE | `/documents/:id/entity-links/:linkId` | admin, risk_manager, control_owner, dpo, process_owner | dms | Unlink entity |
| GET | `/documents/compliance` | any | dms | Aggregate compliance dashboard |

---

## ISMS (Information Security Management System)

Module gate: `isms`

### Statement of Applicability (SoA)

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/isms/soa` | any | isms | List SoA entries (paginated) |
| POST | `/isms/soa` | any | isms | Create SoA entry |
| GET | `/isms/soa/:id` | any | isms | SoA entry detail |
| PUT | `/isms/soa/:id` | any | isms | Update SoA entry |
| POST | `/isms/soa/bulk` | any | isms | Bulk update SoA entries |
| GET | `/isms/soa/export` | any | isms | Export SoA as CSV |

### ISMS Assessments

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/isms/assessments` | any | isms | List assessment runs |
| POST | `/isms/assessments` | admin, risk_manager | isms | Create assessment |
| GET | `/isms/assessments/:id` | any | isms | Assessment detail |
| PUT | `/isms/assessments/:id` | admin, risk_manager | isms | Update / transition status |
| GET | `/isms/assessments/:id/evaluations` | any | isms | List control evaluations |
| POST | `/isms/assessments/:id/evaluations` | admin, risk_manager, auditor | isms | Submit evaluation |
| GET | `/isms/assessments/:id/evaluations/:evalId` | any | isms | Evaluation detail |
| PUT | `/isms/assessments/:id/evaluations/:evalId` | admin, risk_manager, auditor | isms | Update evaluation |
| GET | `/isms/assessments/:id/progress` | any | isms | Assessment progress |
| GET | `/isms/assessments/:id/risk-evaluations` | any | isms | Risk evaluations for assessment |
| POST | `/isms/assessments/:id/risk-evaluations` | admin, risk_manager | isms | Submit risk evaluation |

### Threats, Vulnerabilities & Incidents

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/isms/threats` | any | isms | List threats |
| POST | `/isms/threats` | admin, risk_manager | isms | Create threat |
| GET | `/isms/threats/:id` | any | isms | Threat detail |
| PUT | `/isms/threats/:id` | admin, risk_manager | isms | Update threat |
| GET | `/isms/vulnerabilities` | any | isms | List vulnerabilities |
| POST | `/isms/vulnerabilities` | admin, risk_manager | isms | Create vulnerability |
| GET | `/isms/vulnerabilities/:id` | any | isms | Vulnerability detail |
| PUT | `/isms/vulnerabilities/:id` | admin, risk_manager | isms | Update vulnerability |
| GET | `/isms/incidents` | any | isms | List security incidents |
| POST | `/isms/incidents` | admin, risk_manager | isms | Create incident |
| GET | `/isms/incidents/:id` | any | isms | Incident detail |
| PUT | `/isms/incidents/:id` | admin, risk_manager | isms | Update incident |
| PUT | `/isms/incidents/:id/status` | admin, risk_manager | isms | Status transition |
| GET | `/isms/incidents/:id/timeline` | any | isms | Incident timeline |

### Risk Scenarios & Reviews

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/isms/risk-scenarios` | any | isms | List risk scenarios |
| POST | `/isms/risk-scenarios` | admin, risk_manager | isms | Create risk scenario |
| GET | `/isms/risk-scenarios/:id` | any | isms | Scenario detail |
| PUT | `/isms/risk-scenarios/:id` | admin, risk_manager | isms | Update scenario |
| GET | `/isms/reviews` | any | isms | List management reviews |
| POST | `/isms/reviews` | admin, risk_manager | isms | Create review |
| GET | `/isms/reviews/:id` | any | isms | Review detail |
| PUT | `/isms/reviews/:id` | admin, risk_manager | isms | Update review |

### Asset Classification & Maturity

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/isms/assets/classification-overview` | any | isms | Asset classification overview |
| GET | `/isms/assets/:id/classification` | any | isms | Asset classification detail |
| POST | `/isms/assets/:id/classification` | admin, risk_manager | isms | Classify/reclassify asset |
| GET | `/isms/maturity/gap-analysis` | any | isms | Controls maturity gap analysis |
| GET | `/isms/maturity/radar` | any | isms | Maturity radar (avg per domain) |
| GET | `/isms/dashboard` | any | isms | ISMS dashboard KPIs |

---

## BCMS (Business Continuity Management System)

Module gate: `bcms`

### Business Impact Analysis (BIA)

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/bcms/bia` | any | bcms | List BIA assessments |
| POST | `/bcms/bia` | admin, risk_manager | bcms | Create BIA assessment |
| GET | `/bcms/bia/:id` | any | bcms | BIA detail |
| PUT | `/bcms/bia/:id` | admin, risk_manager | bcms | Update BIA |
| GET | `/bcms/bia/:id/impacts` | any | bcms | List process impacts |
| POST | `/bcms/bia/:id/impacts` | admin, risk_manager | bcms | Submit process impact |
| GET | `/bcms/bia/:id/impacts/heatmap` | any | bcms | BIA impact heatmap |
| GET | `/bcms/bia/:id/suppliers` | any | bcms | List supplier dependencies |
| POST | `/bcms/bia/:id/suppliers` | admin, risk_manager | bcms | Add supplier dependency |

### Business Continuity Plans (BCP)

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/bcms/plans` | any | bcms | List BCPs |
| POST | `/bcms/plans` | admin, risk_manager | bcms | Create BCP |
| GET | `/bcms/plans/:id` | any | bcms | BCP detail |
| PUT | `/bcms/plans/:id` | admin, risk_manager | bcms | Update BCP |
| PUT | `/bcms/plans/:id/status` | admin, risk_manager | bcms | Status transition |
| GET | `/bcms/plans/:id/procedures` | any | bcms | List procedure steps |
| POST | `/bcms/plans/:id/procedures` | admin, risk_manager | bcms | Create procedure |
| PUT | `/bcms/plans/:id/procedures/:procId` | admin, risk_manager | bcms | Update procedure |
| GET | `/bcms/plans/:id/resources` | any | bcms | List resources |
| POST | `/bcms/plans/:id/resources` | admin, risk_manager | bcms | Add resource |

### Strategies

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/bcms/strategies` | any | bcms | List continuity strategies |
| POST | `/bcms/strategies` | admin, risk_manager | bcms | Create strategy |
| GET | `/bcms/strategies/:id` | any | bcms | Strategy detail |
| PUT | `/bcms/strategies/:id` | admin, risk_manager | bcms | Update strategy |

### Exercises

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/bcms/exercises` | any | bcms | List exercises |
| POST | `/bcms/exercises` | admin, risk_manager | bcms | Create exercise |
| GET | `/bcms/exercises/:id` | any | bcms | Exercise detail |
| PUT | `/bcms/exercises/:id` | admin, risk_manager | bcms | Update exercise |
| POST | `/bcms/exercises/:id/complete` | admin, risk_manager | bcms | Complete exercise |
| GET | `/bcms/exercises/:id/findings` | any | bcms | List exercise findings |
| POST | `/bcms/exercises/:id/findings` | admin, risk_manager | bcms | Add finding |

### Crisis Management

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/bcms/crisis` | any | bcms | List crisis scenarios |
| POST | `/bcms/crisis` | admin, risk_manager | bcms | Create crisis scenario |
| GET | `/bcms/crisis/:id` | any | bcms | Crisis detail |
| PUT | `/bcms/crisis/:id` | admin, risk_manager | bcms | Update crisis |
| POST | `/bcms/crisis/:id/activate` | admin, risk_manager | bcms | Activate crisis |
| POST | `/bcms/crisis/:id/resolve` | admin, risk_manager | bcms | Resolve crisis |
| GET | `/bcms/crisis/:id/log` | any | bcms | List crisis log entries |
| POST | `/bcms/crisis/:id/log` | admin, risk_manager | bcms | Add immutable log entry |
| GET | `/bcms/crisis/:id/team` | any | bcms | List team members |
| POST | `/bcms/crisis/:id/team` | admin, risk_manager | bcms | Add team member |
| DELETE | `/bcms/crisis/:id/team/:memberId` | admin, risk_manager | bcms | Remove team member |
| GET | `/bcms/dashboard` | any | bcms | BCMS dashboard KPIs |

---

## DPMS (Data Protection Management System)

Module gate: `dpms`

### RoPA (Records of Processing Activities)

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/dpms/ropa` | any | dpms | List RoPA entries (paginated) |
| POST | `/dpms/ropa` | admin, dpo | dpms | Create RoPA entry |
| GET | `/dpms/ropa/:id` | any | dpms | RoPA detail with data categories/subjects |
| PUT | `/dpms/ropa/:id` | admin, dpo | dpms | Update RoPA entry |
| POST | `/dpms/ropa/:id/review` | admin, dpo | dpms | Mark as reviewed |

### DPIA (Data Protection Impact Assessment)

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/dpms/dpia` | any | dpms | List DPIAs |
| POST | `/dpms/dpia` | admin, dpo | dpms | Create DPIA |
| GET | `/dpms/dpia/:id` | any | dpms | DPIA detail with risks and measures |
| PUT | `/dpms/dpia/:id` | admin, dpo | dpms | Update DPIA |
| POST | `/dpms/dpia/:id/risks` | admin, dpo | dpms | Add risk to DPIA |
| POST | `/dpms/dpia/:id/measures` | admin, dpo | dpms | Add measure to DPIA |
| POST | `/dpms/dpia/:id/sign-off` | admin, dpo | dpms | DPO sign-off |

### DSR (Data Subject Requests)

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/dpms/dsr` | any | dpms | List DSRs |
| POST | `/dpms/dsr` | admin, dpo | dpms | Create DSR |
| GET | `/dpms/dsr/:id` | any | dpms | DSR detail with activity log |
| PUT | `/dpms/dsr/:id` | admin, dpo | dpms | Update DSR |
| POST | `/dpms/dsr/:id/verify` | admin, dpo | dpms | Mark identity as verified |
| POST | `/dpms/dsr/:id/respond` | admin, dpo | dpms | Send response to data subject |
| POST | `/dpms/dsr/:id/close` | admin, dpo | dpms | Close DSR |
| GET | `/dpms/dsr/:id/activity` | any | dpms | List DSR activity |
| POST | `/dpms/dsr/:id/activity` | admin, dpo | dpms | Add activity |

### Data Breaches

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/dpms/breaches` | any | dpms | List data breaches |
| POST | `/dpms/breaches` | admin, dpo | dpms | Create breach record |
| GET | `/dpms/breaches/:id` | any | dpms | Breach detail with notifications |
| PUT | `/dpms/breaches/:id` | admin, dpo | dpms | Update breach |
| POST | `/dpms/breaches/:id/close` | admin, dpo | dpms | Close breach |
| POST | `/dpms/breaches/:id/dpa-notify` | admin, dpo | dpms | Record DPA notification |

### TIA (Transfer Impact Assessment)

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/dpms/tia` | any | dpms | List TIAs |
| POST | `/dpms/tia` | admin, dpo | dpms | Create TIA |
| GET | `/dpms/tia/:id` | any | dpms | TIA detail |
| PUT | `/dpms/tia/:id` | admin, dpo | dpms | Update TIA |
| GET | `/dpms/dashboard` | any | dpms | DPMS dashboard KPIs |

---

## Audit Management

Module gate: `audit`

### Audit Universe

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/audit-mgmt/universe` | any | audit | List universe entries |
| POST | `/audit-mgmt/universe` | admin, auditor, risk_manager | audit | Create universe entry |
| GET | `/audit-mgmt/universe/:id` | any | audit | Universe entry detail |
| PUT | `/audit-mgmt/universe/:id` | admin, auditor, risk_manager | audit | Update universe entry |

### Audit Plans

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/audit-mgmt/plans` | any | audit | List audit plans |
| POST | `/audit-mgmt/plans` | admin, auditor, risk_manager | audit | Create audit plan |
| GET | `/audit-mgmt/plans/:id` | any | audit | Plan detail |
| PUT | `/audit-mgmt/plans/:id` | admin, auditor, risk_manager | audit | Update plan |
| PUT | `/audit-mgmt/plans/:id/status` | admin, auditor, risk_manager | audit | Plan approval workflow |
| GET | `/audit-mgmt/plans/:id/items` | any | audit | List plan items |
| POST | `/audit-mgmt/plans/:id/items` | admin, auditor, risk_manager | audit | Create plan item |
| GET | `/audit-mgmt/plans/suggest` | admin, auditor, risk_manager | audit | Auto-suggest plan items |

### Audits

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/audit-mgmt/audits` | any | audit | List audits |
| POST | `/audit-mgmt/audits` | admin, auditor | audit | Create audit |
| GET | `/audit-mgmt/audits/:id` | any | audit | Audit detail |
| PUT | `/audit-mgmt/audits/:id` | admin, auditor | audit | Update audit |
| PUT | `/audit-mgmt/audits/:id/status` | admin, auditor, risk_manager | audit | Status transition |
| GET | `/audit-mgmt/audits/:id/activities` | any | audit | List audit activities |
| POST | `/audit-mgmt/audits/:id/activities` | admin, auditor | audit | Log activity |

### Audit Checklists

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/audit-mgmt/audits/:id/checklists` | any | audit | List checklists |
| POST | `/audit-mgmt/audits/:id/checklists` | admin, auditor | audit | Create checklist |
| POST | `/audit-mgmt/audits/:id/checklists/generate` | admin, auditor | audit | Auto-generate from controls |
| GET | `/audit-mgmt/audits/:id/checklists/:checklistId/items` | any | audit | List checklist items |
| PUT | `/audit-mgmt/audits/:id/checklists/:checklistId/items/:itemId` | admin, auditor | audit | Update checklist item |
| POST | `/audit-mgmt/audits/:id/checklists/:checklistId/items/:itemId/create-finding` | admin, auditor | audit | Create finding from item |
| GET | `/audit-mgmt/dashboard` | any | audit | Audit management KPIs |

---

## TPRM (Third-Party Risk Management)

Module gate: `tprm`

### Vendors

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/vendors` | any | tprm | List vendors (paginated) |
| POST | `/vendors` | admin, risk_manager | tprm | Create vendor |
| GET | `/vendors/:id` | any | tprm | Vendor detail |
| PUT | `/vendors/:id` | admin, risk_manager | tprm | Update vendor / status transition |
| DELETE | `/vendors/:id` | admin | tprm | Soft-delete vendor |
| GET | `/vendors/:id/contacts` | any | tprm | List contacts |
| POST | `/vendors/:id/contacts` | admin, risk_manager, process_owner | tprm | Add contact |
| GET | `/vendors/:id/risk-assessments` | any | tprm | List risk assessments |
| POST | `/vendors/:id/risk-assessments` | admin, risk_manager | tprm | Create risk assessment |
| GET | `/vendors/:id/due-diligence` | any | tprm | List DD records |
| POST | `/vendors/:id/due-diligence` | admin, risk_manager | tprm | Send DD questionnaire |
| POST | `/vendors/:id/dd/invite` | admin, risk_manager | tprm | Invite vendor to DD portal |
| POST | `/vendors/dd/submit` | **Token-based** | - | External DD submission (no auth) |
| GET | `/vendors/dashboard` | any | tprm | Vendor TPRM KPIs |

### DD Sessions

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/dd-sessions/:id` | any | tprm | Session detail |
| PUT | `/dd-sessions/:id/extend` | admin, risk_manager | tprm | Extend session deadline |
| DELETE | `/dd-sessions/:id/revoke` | admin, risk_manager | tprm | Revoke session token |
| GET | `/dd-sessions/:id/results` | any | tprm | Get responses, scores, gap analysis |

### Questionnaire Templates

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/questionnaire-templates` | any | tprm | List templates |
| POST | `/questionnaire-templates` | admin, risk_manager | tprm | Create template |
| GET | `/questionnaire-templates/:id` | any | tprm | Template with sections + questions |
| PUT | `/questionnaire-templates/:id` | admin, risk_manager | tprm | Update template |
| DELETE | `/questionnaire-templates/:id` | admin | tprm | Delete template |
| POST | `/questionnaire-templates/:id/publish` | admin | tprm | Publish template |
| POST | `/questionnaire-templates/:id/sections` | admin, risk_manager | tprm | Create section |
| POST | `/questionnaire-templates/:id/sections/:sectionId/questions` | admin, risk_manager | tprm | Create question |

### LkSG (Supply Chain Due Diligence)

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/lksg` | any | tprm | LkSG dashboard |
| POST | `/lksg/:vendorId/assessment` | admin, risk_manager, dpo | tprm | Create LkSG assessment |
| GET | `/lksg/:vendorId/assessment` | any | tprm | List vendor LkSG assessments |
| PUT | `/lksg/:vendorId/assessment` | admin, risk_manager, dpo | tprm | Update assessment |

---

## Contracts

Module gate: `contract`

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/contracts` | any | contract | List contracts (paginated) |
| POST | `/contracts` | admin, risk_manager, process_owner | contract | Create contract |
| GET | `/contracts/:id` | any | contract | Contract detail with obligations/SLAs |
| PUT | `/contracts/:id` | admin, risk_manager, process_owner | contract | Update contract |
| DELETE | `/contracts/:id` | admin | contract | Soft-delete contract |
| PUT | `/contracts/:id/status` | admin, risk_manager, process_owner | contract | Status transition |
| GET | `/contracts/:id/obligations` | any | contract | List obligations |
| POST | `/contracts/:id/obligations` | admin, risk_manager, process_owner | contract | Create obligation |
| PUT | `/contracts/:id/obligations/:obligationId` | admin, risk_manager, process_owner, control_owner | contract | Update obligation |
| GET | `/contracts/:id/amendments` | any | contract | List amendments |
| POST | `/contracts/:id/amendments` | admin, risk_manager | contract | Create amendment |
| GET | `/contracts/:id/sla` | any | contract | List SLA definitions |
| POST | `/contracts/:id/sla` | admin, risk_manager, process_owner | contract | Create SLA |
| POST | `/contracts/:id/sla/:slaId/measurements` | admin, risk_manager, process_owner, control_owner | contract | Record SLA measurement |
| GET | `/contracts/dashboard` | any | contract | Contract KPIs |

---

## ESG (Environmental, Social, Governance)

Module gate: `esg`

### Metrics & Measurements

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/esg/metrics` | any | esg | List ESRS metrics |
| POST | `/esg/metrics` | admin, risk_manager | esg | Create metric |
| GET | `/esg/measurements` | any | esg | List measurements |
| POST | `/esg/measurements` | admin, risk_manager, control_owner | esg | Record measurement |
| POST | `/esg/measurements/bulk` | admin, risk_manager | esg | Bulk import (max 500) |
| PUT | `/esg/measurements/:id/verify` | admin, risk_manager, auditor | esg | Verify measurement |

### Targets

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/esg/targets` | any | esg | List targets |
| POST | `/esg/targets` | admin, risk_manager | esg | Create target |
| GET | `/esg/targets/:id/progress` | any | esg | Target progress vs baseline |

### Materiality Assessment

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/esg/materiality` | any | esg | List assessments |
| POST | `/esg/materiality` | admin, risk_manager | esg | Create assessment for year |
| GET | `/esg/materiality/:year` | any | esg | Assessment detail with topics |
| PUT | `/esg/materiality/:year` | admin, risk_manager | esg | Update assessment |
| POST | `/esg/materiality/:year/topics` | admin, risk_manager | esg | Seed ESRS topics |
| POST | `/esg/materiality/:year/vote` | any | esg | Submit stakeholder vote |
| GET | `/esg/materiality/:year/matrix` | any | esg | Matrix data for visualization |
| PUT | `/esg/materiality/:year/finalize` | admin, risk_manager | esg | Compute scores, finalize |

### Reporting

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/esg/report/:year/completeness` | any | esg | ESRS completeness check |
| POST | `/esg/report/:year/export` | admin, risk_manager | esg | Generate JSON export |
| GET | `/esg/scope-emissions/:year` | any | esg | Scope 1+2+3 emissions summary |
| GET | `/esg/dashboard` | any | esg | ESG dashboard KPIs |

---

## Intelligence (Regulatory Feed)

No module gate (platform-level).

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/regulatory/feed` | any | - | Paginated regulatory feed |
| GET | `/regulatory/relevant` | any | - | Org-relevant items with relevance scores |

---

## Whistleblowing

Module gate: `whistleblowing`

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/whistleblowing/cases` | admin, risk_manager | whistleblowing | List cases (paginated) |
| GET | `/whistleblowing/cases/:id` | admin, risk_manager | whistleblowing | Case detail (decrypted) |
| PUT | `/whistleblowing/cases/:id/acknowledge` | admin, risk_manager | whistleblowing | Acknowledge case |
| PUT | `/whistleblowing/cases/:id/assign` | admin, risk_manager | whistleblowing | Assign ombudsperson |
| POST | `/whistleblowing/cases/:id/message` | admin, risk_manager | whistleblowing | Send encrypted message |
| PUT | `/whistleblowing/cases/:id/resolve` | admin, risk_manager | whistleblowing | Resolve case |
| GET | `/whistleblowing/statistics` | admin, risk_manager | whistleblowing | Anonymized KPIs |

---

## Portal (Public / Token-based)

External-facing endpoints. No session auth -- validated by token or public access.

### Whistleblower Reporting Portal

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/portal/report/:orgCode` | **Public** | - | Load org info for report form |
| POST | `/portal/report/:orgCode` | **Public** | - | Submit whistleblower report |

### Anonymous Mailbox

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/portal/mailbox/:token` | **Token** | - | Case status + decrypted messages |
| POST | `/portal/mailbox/:token` | **Token** | - | Whistleblower reply |
| POST | `/portal/mailbox/:token/evidence` | **Token** | - | Upload additional evidence |

### Due Diligence Portal

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/portal/dd/:token` | **Token** | - | Load questionnaire + existing responses |
| PUT | `/portal/dd/:token/responses` | **Token** | - | Auto-save batch of responses |
| POST | `/portal/dd/:token/evidence` | **Token** | - | Upload evidence file |
| POST | `/portal/dd/:token/submit` | **Token** | - | Finalize submission |

---

## Assets & Catalogs

No module gate (cross-cutting).

### Assets

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/assets` | any | - | List assets (paginated) |
| POST | `/assets` | admin | - | Create asset |
| GET | `/assets/:id` | any | - | Asset detail |
| PUT | `/assets/:id` | admin | - | Update asset |
| DELETE | `/assets/:id` | admin | - | Soft-delete asset |
| GET | `/assets/:id/work-items` | any | - | Work items linked to asset |
| GET | `/assets/:id/effective-cia` | any | - | CIA with parent chain inheritance |
| GET | `/assets/hierarchy` | any | - | Full asset tree |

### Catalogs

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| GET | `/catalogs/controls` | any | - | List control catalogs |
| GET | `/catalogs/controls/:catalogId/entries` | any | - | List catalog entries |
| GET | `/catalogs/controls/:catalogId/entries/:entryId` | any | - | Entry detail |
| GET | `/catalogs/risks` | any | - | List risk catalogs |
| GET | `/catalogs/risks/:catalogId/entries` | any | - | List catalog entries |
| GET | `/catalogs/risks/:catalogId/entries/:entryId` | any | - | Entry detail |
| GET | `/catalogs/objects` | any | - | List general catalog objects |
| POST | `/catalogs/objects` | admin | - | Create catalog object |
| GET | `/catalogs/objects/:id` | any | - | Object detail |
| PUT | `/catalogs/objects/:id` | admin | - | Update object |
| GET | `/catalogs/objects/:id/lifecycle-phases` | any | - | List lifecycle phases |
| POST | `/catalogs/objects/:id/lifecycle-phases` | admin | - | Create phase |
| PUT | `/catalogs/objects/:id/lifecycle-phases/:phaseId` | admin | - | Update phase |
| GET | `/catalogs/lifecycle-roadmap` | any | - | Timeline / Gantt data |
| GET | `/catalogs/where-used/:entryId` | any | - | Where-used references |

---

## AI

No module gate. Rate-limited per user.

| Method | Path | Auth | Module | Description |
|--------|------|------|--------|-------------|
| POST | `/ai/control-suggestions` | admin, risk_manager, control_owner | - | AI control suggestions for a risk |
| POST | `/ai/rcm-gap-analysis` | admin, risk_manager | - | AI-driven RCM gap analysis |
| POST | `/ai/root-cause-patterns` | admin, risk_manager, auditor | - | AI pattern detection across findings |
| POST | `/ai/test-plan` | admin, risk_manager, auditor, control_owner | - | AI-generated test plan for control |
| GET | `/ai/usage` | admin | - | AI usage summary |
