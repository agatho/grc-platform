# RBAC + RLS Audit (post-Wave-25)

Date: 2026-05-22
Scope: `apps/web/src/app/api/v1/**` (whistleblowing excluded by request) and
`packages/db/{src/schema, drizzle}`.
Method: static extraction of `withAuth(...)` role lists per HTTP method,
bucketed by resource; cross-referenced against `user_role` enum
(`packages/db/src/schema/platform.ts:38`). RLS coverage derived from
`ENABLE/FORCE ROW LEVEL SECURITY` + `CREATE POLICY` statements in
`packages/db/drizzle/*.sql` (326 migrations) cross-referenced against
`pgTable(...)` definitions (566 tables, 488 with `org_id`).
Extraction scripts: `scripts_tmp/audit_extract.py`, `scripts_tmp/find_asymmetry.py`,
`scripts_tmp/rls_audit.py` (read-only; not committed).

## TL;DR

- **RBAC inconsistencies found: ~55** distinct mismatches, of which **6 are high-priority**
  - 3 dead roles in the `user_role` enum (no API code accepts them at all)
  - 83 write-method endpoints with empty `withAuth()` (any authenticated user can mutate); ~25 of those are intentional self-service, the remaining ~58 are gaps.
  - Module-specific role `bcm_manager` used in only **1 of 51** BCMS routes — effectively dead inside its home module
- **RLS gaps: 1 hard table gap, 1 process-by-design INSERT/SELECT-only table, plus 402 tables lacking `FORCE ROW LEVEL SECURITY`**
  - 555 / 488 org-scoped tables have `ENABLE RLS` + policies — coverage is nearly complete.

### Top 5 mismatches to fix immediately

1. **`POST /findings` allows `process_owner` + `ciso`; `PUT /findings/[id]` and `PATCH /findings/[id]/status` do not.**
   A process_owner can create a finding (e.g. self-report a compliance violation) but cannot then update it or transition its status — a workflow dead-end.
   - `apps/web/src/app/api/v1/findings/route.ts:75-82` lists `admin, auditor, risk_manager, control_owner, process_owner, ciso`
   - `apps/web/src/app/api/v1/findings/[id]/route.ts:95-100` lists `admin, risk_manager, auditor, control_owner` only
   - `apps/web/src/app/api/v1/findings/[id]/status/route.ts:25-30` ditto

2. **`PUT /api/v1/tasks/[id]` calls `withAuth()` with no role list** — any authenticated user in the org can edit any task (`apps/web/src/app/api/v1/tasks/[id]/route.ts:60`). Tasks carry status, due dates and assignees; this is a 1st-line privilege.

3. **`bcm_manager` is an unused role inside its home module.**
   The enum defines it (`platform.ts:52`) and `bcms/bia/route.ts` honours it (POST list `admin, bcm_manager, risk_manager`), but **every other BCMS route** (`bcms/bcp`, `bcms/crisis`, `bcms/exercises`, `bcms/strategies`, …) requires `admin` + `risk_manager` instead. Customers granting `bcm_manager` will see 403s on every page except BIA.

4. **`isms/soa POST/PUT` and `isms/assessments POST/PUT/DELETE` are `withAuth()` with no role list.** Anyone in the org can edit the Statement of Applicability and ISMS assessment runs — both ISO 27001 audit artefacts.
   - `apps/web/src/app/api/v1/isms/soa/route.ts`, `isms/soa/[id]/route.ts`, `isms/soa/bulk/route.ts`
   - `apps/web/src/app/api/v1/isms/assessments/route.ts`, `isms/assessments/[id]/route.ts`

5. **3 enum members never appear in any `withAuth()` list across the codebase: `security_analyst`, `department_head`, `external_auditor`.** They were added to `user_role` but no endpoint accepts them. Either remove them or wire them into the relevant modules.

## RBAC inconsistencies

### Asymmetric per-resource (POST vs PUT/PATCH/DELETE)

| Resource                                                                                                                                                                                                                                                                                              | POST allows                                                                                   | PUT/PATCH allows                                                     | DELETE allows           | Gap                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| findings                                                                                                                                                                                                                                                                                              | admin, auditor, **ciso**, control_owner, **process_owner**, risk_manager                      | admin, auditor, control_owner, risk_manager                          | admin                   | **process_owner + ciso lose write access after create**; only admin can delete                                                                          |
| contracts                                                                                                                                                                                                                                                                                             | admin, contract_manager, process_owner, risk_manager, vendor_manager                          | admin, contract_manager, process_owner, risk_manager, vendor_manager | admin                   | DELETE admin-only is fine; but `contracts/[id]/amendments POST` is only `admin, risk_manager` — contract_manager/vendor_manager can't create amendments |
| vendors                                                                                                                                                                                                                                                                                               | admin, contract_manager, process_owner, risk_manager, vendor_manager                          | same                                                                 | admin                   | OK on PUT, DELETE admin-only                                                                                                                            |
| controls                                                                                                                                                                                                                                                                                              | admin, auditor, control_owner, risk_manager                                                   | admin, control_owner, risk_manager                                   | admin                   | **auditor can create but not update**; `controls/[id]/route.ts` drops auditor                                                                           |
| risks                                                                                                                                                                                                                                                                                                 | admin, **ciso**, control_owner, process_owner, risk_manager                                   | admin, **ciso**, control_owner, process_owner, risk_manager          | admin                   | OK; DELETE admin-only                                                                                                                                   |
| risks/[id]/status                                                                                                                                                                                                                                                                                     | n/a                                                                                           | admin, **ciso**, process_owner, risk_manager                         | n/a                     | OK but **inconsistent with `risks/[id]` which also accepts `control_owner`** — a control_owner can edit a risk but not move it through its lifecycle    |
| dpms/dpia                                                                                                                                                                                                                                                                                             | admin, dpo, risk_manager (POST)                                                               | admin, dpo (PUT/PATCH)                                               | admin, dpo              | **risk_manager can create a DPIA but not modify it**; only `dpia/[id]/transition` re-allows risk_manager                                                |
| dpms/ropa                                                                                                                                                                                                                                                                                             | admin, dpo, risk_manager (POST)                                                               | admin, dpo (PUT)                                                     | admin, dpo              | same pattern as DPIA                                                                                                                                    |
| audit-mgmt/audits                                                                                                                                                                                                                                                                                     | admin, auditor, compliance_officer, quality_manager, risk_manager (varying across sub-routes) | admin, auditor, risk_manager (PUT)                                   | admin, auditor (DELETE) | **compliance_officer + quality_manager can POST but not PUT**                                                                                           |
| bcms/bia                                                                                                                                                                                                                                                                                              | admin, bcm_manager, risk_manager (POST on root)                                               | admin, risk_manager (PUT)                                            | n/a                     | **bcm_manager can't update what they created**                                                                                                          |
| eam/business-contexts                                                                                                                                                                                                                                                                                 | admin, risk_manager                                                                           | admin, risk_manager                                                  | admin                   | DELETE admin-only; minor                                                                                                                                |
| catalogs/objects                                                                                                                                                                                                                                                                                      | admin, control_owner, process_owner, risk_manager                                             | admin, control_owner, process_owner, risk_manager                    | admin, risk_manager     | **control_owner + process_owner can create but not delete**                                                                                             |
| bi-reports & sub-resources (queries / scheduled / shares)                                                                                                                                                                                                                                             | admin, risk_manager                                                                           | admin, risk_manager (PATCH)                                          | admin (DELETE)          | minor, but reports are owned content — risk_manager should be able to delete their own                                                                  |
| connectors, devops-connectors, identity-connectors, cloud-connectors, dora/\*, regulatory-changes/calendar, tax-cms/risks, predictive-risk/models, maturity/models, maturity/roadmap, cert-wizard/assessments, risk-quantification/appetite, ai-act/systems, isms/threats/feeds, isms/incidents, kris | admin, risk_manager (POST)                                                                    | admin, risk_manager (PATCH/PUT)                                      | **admin only** (DELETE) | Same systemic pattern: 1st/2nd-line can manage but only admin can delete. Acceptable as a deletion-gate, but should be documented as policy.            |

The dominant pattern is "DELETE is admin-only" — that is a reasonable safeguard and not a bug per se, but it should be lifted to a policy in `docs/security/lod-coverage.md` so it stops being flagged as "inconsistent".

### Cross-route role-set drift (parent POST vs sub-route POST)

| Resource                | Parent POST                                                           | Sub-route POST that disagrees                                                                                          |
| ----------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| contracts               | 5 roles including vendor_manager + contract_manager                   | `contracts/[id]/amendments POST` only `admin, risk_manager`                                                            |
| processes               | varies                                                                | `processes/.../sign-off`, `processes/.../comments` use bare `withAuth()` — anyone authenticated can sign off a process |
| audit-mgmt/audits       | several variants                                                      | `audit-mgmt/audits/[id]/sign-off POST` has bare `withAuth()` — sign-off must be role-gated                             |
| controls                | admin, auditor, control_owner, risk_manager                           | `controls/[id]/comments POST` has bare `withAuth()`                                                                    |
| processes/[id]/sign-off | n/a                                                                   | bare `withAuth()` — same severity as audit sign-off                                                                    |
| isms/incidents          | admin, dpo, risk_manager (POST root)                                  | `isms/incidents/correlate POST` bare `withAuth()`                                                                      |
| esg/measurements        | POST allows control_owner, esg_contributor, esg_manager, risk_manager | PUT allows **auditor** (read-only role) + esg_manager + risk_manager — auditor should not be granted ESG write         |

### Endpoints with `withAuth()` but no role list (write methods)

83 such write endpoints. The intentional ones are self-service or per-user state:

- `users/me/dashboard-layout`, `users/me/nav-preferences`, `users/me/notification-preferences`, `users/content-language`, `notifications/.../read`, `mobile/devices/*`, `mobile/scan`, `mobile/sync`, `mobile/push/.../read`, `dashboards/[id]/favorite`, `role-dashboards/preferences`, `documents/[id]/acknowledge`, `policies/my-pending/.../acknowledge`, `academy/enrollments/[id]/progress`, `academy/quiz-attempts`, `rcsa/assignments/[id]/respond` (assignee self-attestation), `tasks/[id]/comments` (collaboration), `risks/[id]/comments`, `controls/[id]/comments`, `processes/[id]/comments/...`, `esg/materiality/[year]/vote` (per-stakeholder vote), `marketplace/reviews`, `community/contributions/*` (community is open), `calendar/ical/.../-token`, `users/[id]/profile` (self only — assuming the handler enforces self).

The **non-self-service** writes that look like gaps:

| Route                                                                                                                                                       | Method            | Why suspicious                                                                                                                                          | Recommend                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `tasks/[id]/route.ts:60`                                                                                                                                    | PUT               | Task entity is shared, status/assignee changes belong to 1st-line                                                                                       | `withAuth("admin","risk_manager","control_owner","process_owner","dpo","auditor")`                                                |
| `tasks/[id]/status/route.ts`                                                                                                                                | PUT               | Same                                                                                                                                                    | same                                                                                                                              |
| `isms/assessments/route.ts`, `isms/assessments/[id]/route.ts`, `isms/assessments/[id]/evaluations/...`                                                      | POST/PUT/DELETE   | ISO-27001 assessment runs are 2nd-line owned                                                                                                            | `withAuth("admin","ciso","risk_manager")`                                                                                         |
| `isms/soa/route.ts`, `isms/soa/bulk/route.ts`, `isms/soa/[id]/route.ts`                                                                                     | POST/PUT          | SoA is the certifiable Annex-A control set                                                                                                              | `withAuth("admin","ciso","risk_manager","control_owner")`                                                                         |
| `isms/reviews/route.ts`, `isms/reviews/[id]/route.ts`                                                                                                       | POST/PUT          | Management Review = clause 9.3, audit artefact                                                                                                          | `withAuth("admin","ciso")`                                                                                                        |
| `isms/attack-paths/route.ts`, `isms/attack-paths/compare/route.ts`                                                                                          | POST              | Threat-model authoring                                                                                                                                  | `withAuth("admin","ciso","risk_manager","security_analyst")` — also wires up the dead `security_analyst` role                     |
| `isms/incidents/route.ts`                                                                                                                                   | POST              | bare `withAuth` even though sibling POST handlers list dpo, risk_manager                                                                                | `withAuth("admin","ciso","dpo","risk_manager","control_owner")`                                                                   |
| `audit-mgmt/audits/[id]/sign-off/route.ts`                                                                                                                  | POST              | Audit sign-off is a defining 3rd-line act                                                                                                               | `withAuth("admin","auditor")`                                                                                                     |
| `processes/[id]/sign-off/route.ts`                                                                                                                          | POST              | Sign-off must not be open to viewer                                                                                                                     | `withAuth("admin","process_owner","ciso","auditor","risk_manager")`                                                               |
| `tprm/vendors/[id]/sign-off/route.ts`                                                                                                                       | POST              | Vendor risk sign-off                                                                                                                                    | `withAuth("admin","vendor_manager","risk_manager","ciso")`                                                                        |
| `work-items/route.ts`, `work-items/[id]/route.ts`, `work-items/[id]/status/route.ts`, `work-items/[id]/links/...`                                           | POST/PUT/DELETE   | Work-items wrap every domain entity; lifecycle should be role-gated                                                                                     | inherit the role list of the underlying entity type, or fall back to `admin,risk_manager,control_owner,process_owner,dpo,auditor` |
| `reports/generate/route.ts`, `reports/preview/route.ts`                                                                                                     | POST              | Report generation has cost + exposes cross-module data                                                                                                  | `withAuth("admin","risk_manager","auditor","ciso","dpo")`                                                                         |
| `dashboards/route.ts`, `dashboards/[id]/route.ts`, `dashboards/[id]/widgets/*`, `dashboards/[id]/export-pdf/route.ts`, `dashboards/[id]/duplicate/route.ts` | POST/PUT/DELETE   | Custom dashboards are powerful (can query any data the creator has) — at least gate creation                                                            | `withAuth("admin","risk_manager","ciso","auditor")` (read+create); allow `viewer` only on GET                                     |
| `erm/predictions/train/route.ts`                                                                                                                            | POST              | Model training is expensive/expert work                                                                                                                 | `withAuth("admin","risk_manager","ciso")`                                                                                         |
| `erm/propagation/relationships/route.ts` + `[id]/route.ts`, `erm/propagation/simulate/route.ts`                                                             | POST/PATCH/DELETE | Propagation graph edits affect risk inference                                                                                                           | `withAuth("admin","risk_manager","ciso")`                                                                                         |
| `portals/evidence/route.ts`, `portals/questionnaires/[id]/route.ts`                                                                                         | POST/PATCH        | Portal callbacks **should** be token-authed, not `withAuth()` — verify this is actually self-service of an internal user (else this is a critical hole) | audit handler; if it's external, replace with token middleware                                                                    |
| `compliance/simulator/simulations/route.ts`                                                                                                                 | POST              | Read-heavy regulatory query                                                                                                                             | OK to leave open, or gate to `auditor, risk_manager, dpo, admin`                                                                  |
| `export/bulk/route.ts`                                                                                                                                      | POST              | Bulk export is data-exfiltration-shaped                                                                                                                 | `withAuth("admin","auditor","dpo","risk_manager","ciso")`                                                                         |
| `audit-mgmt/analytics/imports/[id]/analyze/route.ts`, `audit-mgmt/analytics/results/[id]/create-finding/route.ts`                                           | POST              | Audit analytics is 3rd-line work                                                                                                                        | `withAuth("admin","auditor")`                                                                                                     |

### Unauthenticated endpoints (no `withAuth()`)

91 route methods lack `withAuth()`. Almost all are intentional and have their own authentication path:

| Category                           | Examples                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Why OK                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 308 redirects / discovery payloads | `admin/api-keys/route.ts`, `admin/organizations/route.ts`, `admin/users/route.ts`, `admin/sso-providers/route.ts`, `dpms/transfer-impact-assessments/route.ts`, `isms/management-reviews/route.ts`, `programmes/route.ts`, `rcsa/route.ts`, `reports/route.ts`, `compliance/route.ts`, `isms/nis2/route.ts`, `marketplace/route.ts`, `eam/applications/route.ts (POST/PUT/PATCH/DELETE)`, `bpm/templates/route.ts (POST/PUT/DELETE)`, `bcms/crisis/dashboard/route.ts`, `identity/route.ts` | return 308/405/404 hint payloads                                               |
| Auth-protocol endpoints            | `auth/admin-login/route.ts`, `auth/sso/oidc/{login,callback}/route.ts`, `auth/sso/saml/{login,callback}/route.ts`, `auth/sso/config/route.ts`, `auth/switch-org/route.ts`, `invitations/[token]/accept/route.ts`                                                                                                                                                                                                                                                                            | self-contained auth flows                                                      |
| Token / external portals           | `portal/dd/[token]/*`, `portal/mailbox/[token]/*`, `portal/report/[orgCode]/route.ts`, `vendors/dd/submit/route.ts`, `branding/css/[orgId]/route.ts`, `calendar/ical/[token]/route.ts`                                                                                                                                                                                                                                                                                                      | use bearer token or org-public asset, not `withAuth`                           |
| SCIM v2 endpoints                  | `scim/v2/Users/*`, `scim/v2/Groups/*`                                                                                                                                                                                                                                                                                                                                                                                                                                                       | SCIM uses its own bearer token middleware                                      |
| Identity admin alias               | `identity/api-keys/*`, `identity/scim-configs/*`, `identity/sso-providers/*`                                                                                                                                                                                                                                                                                                                                                                                                                | per-file aliasing to /admin equivalents                                        |
| Health/build                       | `health/route.ts`, `meta/build/route.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                    | public liveness probes (verify they don't leak version of deps)                |
| Authenticated via raw `auth()`     | `platform/module-definitions/route.ts`, `platform/work-item-types/route.ts`                                                                                                                                                                                                                                                                                                                                                                                                                 | use `auth()` directly with 401 short-circuit — equivalent to bare `withAuth()` |
| Discovery hints                    | `compliance/route.ts`, `marketplace/route.ts`, `programmes/route.ts`, `reports/route.ts`, `rcsa/route.ts`, `isms/nis2/route.ts`                                                                                                                                                                                                                                                                                                                                                             | static JSON discovery payloads                                                 |
| `esg/erm-sync/route.ts:15` GET     | reports list — extractor false-negative; **POST does have** `withAuth("admin","risk_manager","esg_manager","esg_contributor")` — GET wasn't exported                                                                                                                                                                                                                                                                                                                                        | n/a                                                                            |

**Verify-and-confirm subset** (read the handler before declaring safe):

| Route                               | Concern                                                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `health/route.ts`                   | confirm body does not leak DB version / migration count                                                                               |
| `meta/build/route.ts`               | confirm not enumerating internal packages                                                                                             |
| `branding/css/[orgId]/route.ts`     | accepts any orgId — confirm only published branding is returned                                                                       |
| `bcms/crisis/dashboard/route.ts`    | returns notFound — OK                                                                                                                 |
| `esg/erm-sync/route.ts` GET vs POST | GET reported as no-`withAuth`; the only export is POST and **is** auth-checked (line 16). Likely extractor false positive — no action |

### Dead roles

| Role                     | First defined    | Used by any `withAuth()`?                   | Recommend                                                             |
| ------------------------ | ---------------- | ------------------------------------------- | --------------------------------------------------------------------- |
| `security_analyst`       | `platform.ts:55` | **No**                                      | Wire into ISMS attack-paths, threat-feeds, incident triage, or remove |
| `department_head`        | `platform.ts:56` | **No**                                      | Wire into BPM approvals or process-owner aliases, or remove           |
| `external_auditor`       | `platform.ts:57` | **No**                                      | Wire into audit-mgmt read-only, or remove                             |
| `bcm_manager`            | `platform.ts:52` | **Yes, 1 route only** (`bcms/bia/route.ts`) | Wire into all BCMS routes (bcp, crisis, exercises, strategies, …)     |
| `quality_manager`        | `platform.ts:54` | Yes, 1 audit route, 1 process route         | Light usage — wire into `audit-mgmt/*` more broadly                   |
| `compliance_officer`     | `platform.ts:50` | Yes, ~4 routes (audit-mgmt, processes)      | Light usage — wire into RCSA, regulatory-changes, control-testing     |
| `ombudsperson`           | `platform.ts:49` | Whistleblowing only (scope-excluded)        | OK (intentional)                                                      |
| `whistleblowing_officer` | `platform.ts:48` | Whistleblowing only                         | OK                                                                    |

### Inconsistent role treatment across modules

- **`auditor`** is sometimes a write role (audit-mgmt, control-tests, findings POST, evidence) and sometimes only read. Consistent with 3rd-line "independent assurance" — but `esg/measurements/[id]/route.ts` PUT allows auditor, which violates LoD separation (a 3rd-line role should not be granted write on a 1st/2nd-line entity).
- **`dpo`** appears in DPMS routes (correct) but also in `documents/*`, `regulatory-changes/sources/*`, and `ai-act/systems/*`. Verify these all touch personal data — if not, `dpo` is being granted unnecessary scope.
- **`ciso`** appears inconsistently: `risks/[id]/status` includes it, `risks/[id]` does too, but `controls/[id]` does not. Wave-13/-15 added CISO ISMS/ICS read+admin via `role_permission` rows (migrations 0319/0322), so route-level enforcement is a defence-in-depth — the route list should reflect the documented matrix.
- **`viewer`** appears on a handful of POST endpoints (`copilot/conversations`, `dmn`) — almost certainly a typo. Viewer is read-only.

## RLS gaps

### Tables without `ENABLE ROW LEVEL SECURITY`

After fixing the script to handle `ALTER TABLE IF EXISTS ...` (the dominant
pattern from migration `0315_rls_gap_closure_v4.sql`), there is exactly
**one** org-scoped table without RLS:

- **`catalog_entry_reference`** (`packages/db/src/schema/catalog.ts`)
  Created in migration `0012_demonic_invisible_woman.sql` (line 2) with
  `org_id` and FK to `organization(id)`. No subsequent migration enables
  RLS or creates policies. The table stores cross-framework references
  (catalog entry → entity link table) and **was modified by data
  migration `0102_f08_catalog_dedupe.sql`** to remap entry IDs after
  the catalog dedupe — meaning live customer data is in there.

  **Fix:** add a migration that enables RLS + standard tenant policies
  (SELECT/INSERT/UPDATE/DELETE all keyed on `current_setting('app.current_org_id')::uuid`).
  Also enable FORCE RLS since this table joins to compliance frameworks.

  **Do not lower the documented baseline of 142 — this is a new policy
  to add, not a relaxation.**

### Tables with RLS enabled but missing UPDATE/DELETE policies

Exactly **one** table — and by design:

- **`process_sign_off`** (migration `0334_process_sign_off_framework_mapping.sql:32-43`)
  Has only `FOR SELECT` and `FOR INSERT` policies. This is the BPM Overhaul
  Phase 1 hash-chain anchor table — entries must be append-only to keep
  the SHA-256 chain tamper-evident. The DB trigger registered on line 96
  is also INSERT-only. **Intentional. Do not "fix".**

  Consider marking this in `docs/security/rls-coverage-report.md` as
  "append-only by design" so the next audit doesn't flag it.

### Tables with RLS enabled but `FORCE ROW LEVEL SECURITY` not set

**402 of 555** RLS-enabled tables have `ENABLE` but not `FORCE`. Without
FORCE, the table owner (`grc` role in dev / production) **bypasses RLS**
when running queries directly — which is what every Drizzle query does
since the connection user owns the schema. The 150 tables that **do**
have FORCE are the highest-risk: ai-act, bcms (bcp/bia/crisis/strategies),
contract, contract_amendment, contract_obligation, contract_sla,
control_catalog, control_library_entry, audit_anchor, audit_sign_off,
risk_acceptance, etc. — i.e. tables added or reinforced via the dedicated
`rls_gap_closure_v{2,3,4,5}` migrations and the recent
`0345_risk_acceptance_rls_force.sql`.

The 402 without FORCE include high-value tables like:

- `audit_log`, `audit_plan`, `audit_evidence`, `audit_working_paper`, `audit_qa_review`
- `asset`, `asset_cia_profile`, `asset_classification_override`
- `automation_rule`, `automation_rule_execution`
- `api_key`, `api_usage_log`
- `attestation_campaign`, `attestation_response`
- `approval_request`, `approval_decision`, `approval_workflow`
- `architecture_element`, `architecture_relationship`, `architecture_rule`
- many BI / dashboards / academy / agents / bi-reporting tables

The mitigation in ARCTOS is `orgContextMiddleware` setting
`app.current_org_id` per request — RLS policies are written against
that GUC. As long as the application **always** routes through that
middleware and the DB user is not granted `BYPASSRLS`, no live
multi-tenant leak is possible. But a single missing
`orgContextMiddleware` (or a worker job that opens its own pool without
setting the GUC) reads cross-tenant data unimpeded.

**Recommendation:** add FORCE to at least the audit / attestation /
approval / api-key / asset / automation / architecture clusters in a new
`0xxx_rls_force_critical.sql` migration. This is a hardening change,
**not** a baseline reduction — it tightens, not relaxes.

## Summary by severity

| Severity           | Count | Examples                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High               | 6     | findings POST/PUT asymmetry; tasks/[id] PUT empty roles; isms/soa & isms/assessments bare withAuth; bcm_manager dead inside BCMS; audit-mgmt sign-off bare withAuth; catalog_entry_reference no RLS                                                                                                                                                                                                                                                                                                                                                                                               |
| Medium             | 18    | DPIA/RoPA risk_manager-can-create-but-not-edit; auditor as ESG writer; control_owner missing on risks/[id]/status; contracts/[id]/amendments missing vendor_manager+contract_manager; isms/incidents POST bare withAuth; isms/reviews bare withAuth; isms/attack-paths bare withAuth; tprm/vendors/[id]/sign-off bare; work-items/[id] bare; reports/generate bare; dashboards/_ bare; erm/predictions/train bare; erm/propagation/_ bare; export/bulk bare; processes/[id]/sign-off bare; controls/[id]/comments bare; viewer-on-write (copilot, dmn); 402 tables without FORCE RLS (collective) |
| Low / policy-grade | ~30   | Systemic "DELETE is admin-only" pattern (acceptable but document); compliance_officer / quality_manager light usage; CISO inclusion drift on controls vs risks; documents/\* dpo scope-too-broad                                                                                                                                                                                                                                                                                                                                                                                                  |

## Generated artefacts (not for commit)

- `scripts_tmp/audit_extract.py` — extracts (route, method, roles, hasWithAuth) tuples
- `scripts_tmp/find_asymmetry.py` — buckets and compares role sets
- `scripts_tmp/rls_audit.py` — RLS gap detector
- `scripts_tmp/route_roles.tsv` — 1945 rows of extracted role data
- `scripts_tmp/asym.txt` — full asymmetry dump
- `scripts_tmp/rls_report.txt` — full RLS report

These can be re-run after fixes land to verify regressions.
