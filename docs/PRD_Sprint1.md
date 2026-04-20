# ARCTOS — Product Requirements Document

## Sprint 1: Foundation Layer

Auth + Multi-Entity + Role Model + Audit Trail + UI Shell

March 2026 — 63 Story Points — 5 Epics — 23 User Stories

Based on: Data Model v1.0 (47 Entities) | ADRs v1.0 (12 Decisions) | Gap Analysis v2.1 (88 Requirements)

---

# 1. Sprint Overview

### Goal

Sprint 1 builds the foundation layer of the ARCTOS platform: multi-entity organizational structure, authentication with SSO, role-based access control with Three Lines of Defense model, a tamper-resistant audit trail, and the UI shell with navigation, org switcher, and internationalization. After Sprint 1, a user can log in, see their organization, have roles assigned, and every action is fully logged.

### Sprint Scope

| **Epic**   | **Description**                            | **Req-Ref**      | **Scope** | **Priority** |
| ---------- | ------------------------------------------ | ---------------- | --------- | ------------ |
| **Epic 1** | Multi-Entity Organization                  | G-01, G-02       | **13 SP** | **MUST**     |
| **Epic 2** | Authentication (Auth.js + SSO)             | G-04             | **10 SP** | **MUST**     |
| **Epic 3** | RBAC + Three Lines of Defense              | G-03             | **16 SP** | **MUST**     |
| **Epic 4** | Audit Trail (Cross-Cutting)                | G-07             | **11 SP** | **MUST**     |
| **Epic 5** | UI Shell (Layout, Nav, i18n, Org Switcher) | G-06, G-08, G-11 | **13 SP** | **MUST**     |
| **TOTAL**  | **5 Epics, 23 User Stories**               |                  | **63 SP** |              |

### Dependencies

**Prerequisites:** Monorepo (Turborepo) set up, PostgreSQL 16 + TimescaleDB + pgvector provisioned, GitHub repo with CI/CD.

**Blocks:** Sprint 2 (Risk Register), Sprint 3 (BPMN Editor), Sprint 4 (Document Management) — all require Auth + Multi-Entity + Audit Trail.

**Tech Stack (from ADRs):** Next.js 15 + React 19 + Tailwind + shadcn/ui | Node.js 22 + TypeScript 5 + Hono.js | Drizzle ORM | PostgreSQL 16 | Auth.js (ADR-007 rev.1) | Temporal.io (optional, fallback DB queue)

### Definition of Done (Sprint Level)

All 23 user stories meet their acceptance criteria. RLS policies prevent cross-tenant access (verified by integration tests). Audit trail logs every data change and every login. UI works on desktop and tablet (responsive). i18n for German and English complete. Code coverage > 80% for backend, > 60% for frontend.

---

# 2. Database Scope Sprint 1

The following 7 tables from Data Model v1.0 are implemented in Sprint 1. All receive cross-cutting mandatory fields (created_at, updated_at, created_by, updated_by, deleted_at, deleted_by) and RLS policies.

| **Table**                  | **Description**                                | **Epic**   |
| -------------------------- | ---------------------------------------------- | ---------- |
| **organization**           | Multi-entity root, corporate hierarchy         | Epic 1     |
| **user**                   | Users with Auth.js session                     | Epic 1 + 2 |
| **user_organization_role** | User-org-role assignment incl. Line of Defense | Epic 1 + 3 |
| **audit_log**              | Append-only change history with hash chain     | Epic 4     |
| **access_log**             | Login/auth events                              | Epic 4     |
| **data_export_log**        | Download tracking                              | Epic 4     |
| **notification**           | In-app notifications                           | Epic 5     |

### Migration Order

001_create_organization.sql → 002_create_user.sql → 003_create_user_org_role.sql → 004_create_audit_log.sql (append-only RULE) → 005_create_access_log.sql → 006_create_data_export_log.sql → 007_create_notification.sql → 008_enable_rls_all_tables.sql → 009_create_audit_triggers.sql (hash chain) → 010_seed_demo_org.sql

---

# 3. Epic 1: Multi-Entity Organization

Ref: G-01, G-02, D-10. ADR-001 (RLS). The core of the multi-entity architecture: each corporate entity is an independent Organization with isolated data but shared platform instance.

| **ID**    | **User Story**                                                                                                                                                             | **Priority** | **SP**   | **Acceptance Criteria**                                                                                                                                                                                                                                                                                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1-01** | **Create Organization** _As a platform admin, I can create a new organization (name, type, country, industry, parent org) so that each corporate entity has its own data._ | **MUST**     | **3 SP** | ✓ POST /api/v1/organizations creates an organization with all required fields ✓ Validation: name unique, country_code = ISO 3166, org_type ∈ {holding, subsidiary, branch} ✓ parent_org_id optional for corporate hierarchy (Holding → Subsidiary, etc.) ✓ Audit log entry: action=create, entity_type=organization ✓ Result is immediately visible in org list                          |
| **S1-02** | **Edit and Deactivate Organization** _As a platform admin, I can edit or deactivate an organization (soft delete) so that inactive entities can be archived._              | **MUST**     | **2 SP** | ✓ PUT /api/v1/organizations/:id updates fields ✓ DELETE /api/v1/organizations/:id sets deleted_at (soft delete) ✓ Deactivated orgs are no longer visible to regular users ✓ Audit log entry with before/after diff on update                                                                                                                                                             |
| **S1-03** | **Row-Level Security (RLS)** _As the system, I ensure that every DB query is automatically filtered by org_id so that no user can see data from another organization._     | **MUST**     | **5 SP** | ✓ RLS policy on every business table: USING (org_id = current_setting('app.current_org_id')::uuid) ✓ Middleware sets SET app.current_org_id per request from auth token ✓ Integration test: User A (Org 1) sees no data from Org 2 — even with direct API calls ✓ Group admin role can read all orgs (reporting bypass) ✓ Performance test: RLS query overhead < 5ms with 10,000 records |
| **S1-04** | **Corporate Hierarchy View** _As a group admin, I see all entities in a tree view (Holding → Subsidiaries) to overview the entire structure._                              | **SHOULD**   | **3 SP** | ✓ GET /api/v1/organizations/tree returns hierarchical structure ✓ UI: tree view with expand/collapse ✓ Display: name, type, country, user count, status (active/inactive) ✓ Click on entity navigates to org detail page                                                                                                                                                                 |

---

# 4. Epic 2: Authentication

Ref: G-04. ADR-007 rev.1 (Auth.js). Auth.js handles login, MFA, session management, and SSO. Users are stored directly in the platform's own PostgreSQL database.

| **ID**    | **User Story**                                                                                                                                                                                | **Priority** | **SP**   | **Acceptance Criteria**                                                                                                                                                                                                                                                      |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1-05** | **Auth.js Integration + User Management** _As the system, I manage users directly in the platform database with Auth.js handling authentication, so that auth and business data are unified._ | **MUST**     | **3 SP** | ✓ Auth.js Drizzle adapter stores sessions, accounts, verification tokens in own DB ✓ User table contains: email, display_name, avatar_url, is_active ✓ First login via SSO creates user automatically (just-in-time provisioning) ✓ Auth events write directly to access_log |
| **S1-06** | **Login + Logout** _As a user, I can log in via email/password or SSO and log out._                                                                                                           | **MUST**     | **2 SP** | ✓ Auth.js sign-in page on /login ✓ After login: redirect to /dashboard or /select-org (if multiple orgs) ✓ Logout: session is invalidated, redirect to /login ✓ Access log entry on login_success and logout                                                                 |
| **S1-07** | **SSO via Azure AD** _As an employee, I can log in using my existing Microsoft account (SSO) so I don't need a separate password._                                                            | **MUST**     | **2 SP** | ✓ Auth.js Azure AD provider configured (OIDC) ✓ Automatic user matching via email domain ✓ SSO login logged as auth_method=sso_azure_ad in access log ✓ Fallback: email/password if SSO unavailable                                                                          |
| **S1-08** | **Multi-Factor Authentication (MFA)** _As an admin, I can enforce MFA for all users in my organization so that the platform is ISO 27001 compliant._                                          | **SHOULD**   | **3 SP** | ✓ MFA enforcement configurable per organization ✓ Supported methods: TOTP (authenticator app), WebAuthn (FIDO2) ✓ MFA challenge and result logged in access log ✓ Admin sees MFA status of all users in user management                                                      |

---

# 5. Epic 3: RBAC + Three Lines of Defense

Ref: G-03, K-02, E-04. ADR-007. The role model implements the Three Lines of Defense: 1st Line (process/risk owners), 2nd Line (compliance/risk manager, DPO), 3rd Line (internal audit). Roles are assigned per organization.

### Role Matrix

The following permission model defines initial roles and access rights. \* = own line-of-defense domain only.

| **Permission**          | **admin** | **risk_mgr** | **ctrl_owner** | **auditor** | **dpo** | **proc_owner** | **viewer** |
| ----------------------- | --------- | ------------ | -------------- | ----------- | ------- | -------------- | ---------- |
| **Manage orgs**         | ✓         | —            | —              | —           | —       | —              | —          |
| **Invite users**        | ✓         | —            | —              | —           | —       | —              | —          |
| **Assign roles**        | ✓         | —            | —              | —           | —       | —              | —          |
| **Read data (own org)** | ✓         | ✓            | ✓              | ✓           | ✓       | ✓              | ✓          |
| **Edit risks**          | ✓         | ✓            | —              | —           | —       | —              | —          |
| **Edit controls**       | ✓         | —            | ✓              | —           | —       | —              | —          |
| **Conduct audits**      | ✓         | —            | —              | ✓           | —       | —              | —          |
| **Manage DPMS**         | ✓         | —            | —              | —           | ✓       | —              | —          |
| **Edit processes**      | ✓         | —            | —              | —           | —       | ✓              | —          |
| **Read audit log**      | ✓         | —            | —              | ✓           | ✓       | —              | —          |
| **Group aggregation**   | ✓         | ✓\*          | —              | ✓\*         | ✓\*     | —              | —          |

| **ID**    | **User Story**                                                                                                                                                                 | **Priority** | **SP**   | **Acceptance Criteria**                                                                                                                                                                                                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1-09** | **Define and Assign Roles** _As an admin, I can assign one or more roles to a user in my organization (e.g. Risk Manager + DPO) so that permissions are correctly configured._ | **MUST**     | **3 SP** | ✓ POST /api/v1/users/:id/roles assigns role + line of defense ✓ Predefined roles: admin, risk_manager, control_owner, auditor, dpo, process_owner, viewer ✓ A user can have multiple roles per org ✓ Role assignment logged in audit log (action=assign) ✓ UI: dropdown with role + line-of-defense selection                                            |
| **S1-10** | **Revoke Roles** _As an admin, I can revoke a user's role so that departed or transferred employees no longer have access._                                                    | **MUST**     | **2 SP** | ✓ DELETE /api/v1/users/:id/roles/:roleId removes assignment ✓ Last admin of an org cannot remove themselves ✓ Audit log: action=unassign ✓ User immediately sees restricted navigation after role change                                                                                                                                                 |
| **S1-11** | **Middleware: Role Check per API Endpoint** _As the system, I automatically check the user's role on every API call to prevent unauthorized access._                           | **MUST**     | **5 SP** | ✓ Middleware function requireRole('risk_manager', 'admin') on protected routes ✓ 403 Forbidden on missing role (with descriptive error message) ✓ Check: user has role in currently selected org (not global) ✓ Performance: roles cached per session (invalidation on change) ✓ Integration test: viewer cannot create risks (POST /api/v1/risks = 403) |
| **S1-12** | **Line-of-Defense Filter** _As an auditor (3rd line), I see all modules read-only; as a risk manager (2nd line), I see only risk and compliance modules in edit mode._         | **MUST**     | **3 SP** | ✓ Navigation entries shown/hidden based on role + line of defense ✓ Edit buttons appear only for authorized roles ✓ Auditor sees all modules but can only create findings/comments ✓ Line of defense stored in user_organization_role table                                                                                                              |
| **S1-13** | **Invite User (Email Invitation)** _As an admin, I can invite a new user to my organization via email to build the team._                                                      | **MUST**     | **3 SP** | ✓ POST /api/v1/invitations sends invitation email (via Resend/Nodemailer) ✓ Invitation contains: org name, role, inviter, invitation link ✓ Accepted invitation automatically creates user_organization_role ✓ Open invitations visible in admin UI (with expiry, status) ✓ Audit log: action=create, entity_type=invitation                             |

---

# 6. Epic 4: Audit Trail

Ref: G-07, GDPR Art. 5, ISO 27001 A.12.4, A.9.4. ADR-011. The audit trail system is built as cross-cutting infrastructure in Sprint 1 and is automatically available to all future modules.

| **ID**    | **User Story**                                                                                                                                                         | **Priority** | **SP**   | **Acceptance Criteria**                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1-14** | **Audit Log: Automatic Logging of All Changes** _As the system, I automatically log every data change on every business table so that the change history is complete._ | **MUST**     | **5 SP** | ✓ PostgreSQL trigger audit_trigger() on all business tables (Sprint 1: organization, user, user_org_role, notification) ✓ Trigger captures: INSERT, UPDATE, DELETE with before/after diff as JSONB ✓ User snapshots (name, email) stored directly in log ✓ entity_title captured as snapshot ✓ Append-only: RULE on audit_log prevents UPDATE and DELETE ✓ Hash chain: entry_hash = SHA-256(previous_hash + all fields) |
| **S1-15** | **Access Log: Login and Auth Events** _As the system, I log every login attempt (successful and failed) so that security events are traceable._                        | **MUST**     | **2 SP** | ✓ Auth events write directly to access_log ✓ Captured events: login_success, login_failed, logout, mfa_challenge, mfa_success, mfa_failed, sso_login ✓ Failed logins contain failure_reason ✓ IP address and user agent captured                                                                                                                                                                                        |
| **S1-16** | **Change History per Object** _As a user, I can view a timeline of all changes for any object (organization, user, etc.) to see who changed what and when._            | **MUST**     | **2 SP** | ✓ GET /api/v1/audit-log?entity_type=organization&entity_id=... returns chronological history ✓ UI: timeline component on right side panel of each object ✓ Display: who, when, what changed (diff visually highlighted) ✓ Filterable by time range and action type ✓ Visible only to admin, auditor, dpo roles (others see only own changes)                                                                            |
| **S1-17** | **Tamper Detection Check** _As an auditor, I can verify the integrity of the audit log to ensure no entries have been manipulated._                                    | **SHOULD**   | **2 SP** | ✓ GET /api/v1/audit-log/integrity-check verifies hash chain ✓ Result: 'integrity confirmed' or list of tampered entries ✓ UI: green/red status badge in audit dashboard ✓ Check configurable as cron job (daily recommended)                                                                                                                                                                                            |

---

# 7. Epic 5: UI Shell

Ref: G-06 (i18n), G-08 (dashboard foundation), G-11 (mobile/responsive). The UI shell is the framework into which all future modules are embedded: layout, navigation, org switcher, language, notifications.

| **ID**    | **User Story**                                                                                                                                                 | **Priority** | **SP**   | **Acceptance Criteria**                                                                                                                                                                                                                                                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1-18** | **Responsive Layout with Sidebar** _As a user, I see a professional layout with collapsible sidebar navigation, header with user menu, and main content area._ | **MUST**     | **3 SP** | ✓ Sidebar: navigation groups by module (Dashboard, Organizations, Users, Audit, Settings) ✓ Sidebar collapsible to icon-only mode (persistent via localStorage) ✓ Header: user avatar, org name, notification bell, language toggle ✓ Responsive: sidebar becomes drawer on mobile/tablet ✓ Dark mode support (optional, via Tailwind dark:)               |
| **S1-19** | **Organization Switcher** _As a user with access to multiple organizations, I can switch between them without logging out._                                    | **MUST**     | **2 SP** | ✓ Org switcher in header or sidebar (dropdown with search) ✓ Switching org reloads all data for new org context ✓ Last selected org saved per user (persistent) ✓ Only orgs where user has at least one role are shown ✓ Switching org changes RLS context on backend                                                                                      |
| **S1-20** | **Internationalization (DE/EN)** _As a user, I can use the platform in German or English, with all labels, error messages, and formats correctly translated._  | **MUST**     | **3 SP** | ✓ next-intl with namespace files per module (de/common.json, en/common.json, etc.) ✓ Language selection in user profile (persistent in DB) and in footer ✓ All UI labels, error messages, tooltips translated ✓ Date formats: DE = dd.MM.yyyy, EN = MM/dd/yyyy ✓ Number formats: DE = 1.234,56 / EN = 1,234.56 ✓ Fallback: if translation missing → German |
| **S1-21** | **Empty Dashboard with Placeholders** _As a user, I see a dashboard with placeholder widgets after login so the foundation for future KPI widgets is ready._   | **SHOULD**   | **2 SP** | ✓ Dashboard page with grid layout (react-grid-layout or CSS Grid) ✓ 4 placeholder widgets: 'Open Risks' (empty), 'Compliance Status' (empty), 'Pending Tasks' (empty), 'Recent Changes' (from audit log) ✓ 'Recent Changes' widget shows 10 newest audit log entries for current org ✓ Welcome message with user name and current org                      |
| **S1-22** | **Edit User Profile** _As a user, I can change my display name, language, and notification settings._                                                          | **MUST**     | **1 SP** | ✓ Profile page with: display name, language, email (read-only), avatar ✓ Language change takes effect immediately (no reload needed) ✓ Changes logged in audit log                                                                                                                                                                                         |
| **S1-23** | **In-App Notifications (Foundation)** _As a user, I see a bell icon with unread notifications to stay informed about important events._                        | **SHOULD**   | **2 SP** | ✓ Bell icon in header with badge counter for unread messages ✓ Dropdown: list of last 20 notifications ✓ Click marks as read and navigates to affected object ✓ Initially only for: role assignment, org change, invitation ✓ GET /api/v1/notifications?unread=true                                                                                        |

---

# 8. API Endpoints Sprint 1

All endpoints under /api/v1/. Authentication via Auth.js session token. org_id extracted from auth context (not manually passed). Response format: JSON with pagination (page, limit, total).

| **Method** | **Endpoint**               | **Required Roles**  | **Description**                       |
| ---------- | -------------------------- | ------------------- | ------------------------------------- |
| **POST**   | /organizations             | admin               | Create organization                   |
| **GET**    | /organizations             | admin               | List organizations                    |
| **GET**    | /organizations/:id         | all roles           | Organization details                  |
| **GET**    | /organizations/tree        | admin               | Corporate hierarchy tree              |
| **PUT**    | /organizations/:id         | admin               | Update organization                   |
| **DELETE** | /organizations/:id         | admin               | Deactivate organization (soft delete) |
| **GET**    | /users                     | admin               | List users of current org             |
| **GET**    | /users/:id                 | admin, self         | User details                          |
| **PUT**    | /users/:id/profile         | self                | Edit own profile                      |
| **POST**   | /users/:id/roles           | admin               | Assign role                           |
| **DELETE** | /users/:id/roles/:roleId   | admin               | Revoke role                           |
| **POST**   | /invitations               | admin               | Invite user                           |
| **GET**    | /invitations               | admin               | List open invitations                 |
| **GET**    | /audit-log                 | admin, auditor, dpo | Audit log with filters                |
| **GET**    | /audit-log/integrity-check | admin, auditor      | Hash chain verification               |
| **GET**    | /access-log                | admin               | Login events                          |
| **GET**    | /notifications             | all roles           | Own notifications                     |
| **PUT**    | /notifications/:id/read    | all roles           | Mark as read                          |

---

# 9. Technical Implementation Notes

### Monorepo Structure

- apps/web/ — Next.js 15 app (UI + API routes)
- apps/worker/ — Hono.js background service (cron, background jobs)
- packages/db/ — Drizzle schema, migrations, RLS policies, audit triggers
- packages/ui/ — shadcn/ui components (Button, Table, Dialog, etc.)
- packages/shared/ — Zod schemas, TypeScript types, i18n strings
- packages/auth/ — Auth.js provider adapter, RBAC middleware, role guards

### RLS Pattern (ADR-001)

Every API request sets at the start: `SET LOCAL app.current_org_id = '<uuid>'`. The RLS policy on each table filters automatically. For group aggregation: `SET LOCAL app.bypass_rls = 'true'` (only for group admin role). Drizzle wrapper: `withOrgContext(orgId, async (db) => { ... })`.

### Audit Trigger Pattern (ADR-011)

A generic trigger function `audit_trigger()` is registered on every business table. It reads `TG_TABLE_NAME` for entity_type, computes the JSONB diff between OLD and NEW, retrieves the last entry_hash as previous_hash, computes the new hash, and writes to audit_log. For Sprint 1, the hash chain computation must be implemented either as pgcrypto extension or plpgsql function.

### Auth.js Integration (ADR-007 rev.1)

Auth.js handles authentication directly within Next.js. Sessions stored in PostgreSQL via Drizzle adapter. Auth events (login, logout, MFA) write directly to access_log — no webhook detour. The `packages/auth` module exposes an `AuthProvider` interface for future migration to Keycloak/Authentik.

### Test Strategy

- Unit tests (Vitest): Zod schemas, RBAC logic, hash computation
- Integration tests (Vitest + Testcontainers): RLS policies (cross-tenant isolation), audit triggers (completeness), API endpoints (auth + roles)
- E2E tests (Playwright): login flow, org switcher, role changes, language switching
- Security tests: RLS bypass attempts, IDOR checks (can user A access user B's object by ID?)

---

# 10. Sprint Acceptance Criteria

### Functional

- **F-1:** A platform admin can create, edit, and deactivate organizations.
- **F-2:** A user can log in via email/password and via Azure AD SSO.
- **F-3:** An admin can invite users and assign roles (incl. line of defense).
- **F-4:** Navigation entries and edit permissions automatically adapt to the user's role.
- **F-5:** Every data change appears in the audit log with before/after diff.
- **F-6:** Every login attempt appears in the access log.
- **F-7:** The UI works in German and English with correct date/number formats.
- **F-8:** The org switcher changes the active organization and correctly reloads data.

### Security

- **S-1:** RLS integration test: User A (Org 1) receives 0 results when querying Org 2 data — even with direct API calls using Org 2 IDs.
- **S-2:** RBAC test: viewer receives 403 on POST/PUT/DELETE to protected endpoints.
- **S-3:** Audit log is append-only: UPDATE/DELETE on audit_log table fails.
- **S-4:** Hash chain integrity check returns 'confirmed' for unaltered data.
- **S-5:** Auth session signatures are verified on every request.

### Performance

- **P-1:** API response time < 200ms for all CRUD endpoints (with 10,000 records per org).
- **P-2:** RLS overhead < 5ms additional latency per query.
- **P-3:** Lighthouse score > 90 for performance on desktop.

### Quality

- **Q-1:** Code coverage backend > 80%, frontend > 60%.
- **Q-2:** 0 critical or high findings in OWASP ZAP scan.
- **Q-3:** TypeScript strict mode, no any types except in type guards.

---

# 11. Outlook: Sprint 2–4

### Sprint 2: Risk Register + Risk Assessment

Modules: E-01 to E-07. Entities: Risk, RiskTreatment, KRI, KRIMeasurement, SimulationResult. Features: risk register, risk assessment (5x5 matrix), risk owner assignment, heat map visualization, KRI dashboard. Builds on Sprint 1 (auth, RLS, audit trail, UI shell).

### Sprint 3: BPMN Process Modeling

Modules: P-01 to P-07. Entities: Process, ProcessVersion, ProcessStep + join tables (process_risk, process_control, etc.). Features: BPMN 2.0 editor (bpmn.js), process landscape map, process-risk linking, approval workflow.

### Sprint 4: Controls/ICS + Document Management

Modules: K-01 to K-08, DM-01 to DM-07. Entities: Control, ControlTest, Evidence, Document, DocumentVersion, Acknowledgment. Features: control register, control test campaigns, document repository with versioning, read confirmations.
