<!-- GENERATED FILE — DO NOT EDIT BY HAND.
     Produced by scripts/generate-api-reference.mjs from the route tree under
     apps/web/src/app/api/. Regenerate with:

         node scripts/generate-api-reference.mjs

     [ARCTOS-FULL-2026-08-31 / WP12 · S14-15] The previous version of this file
     was hand-maintained. It documented 297 of 1.357 route paths (22 %) while
     presenting itself as the complete API reference, listed two endpoints that
     do not exist (one of them the audit-log integrity check) and two methods
     the routes do not export, and marked endpoints "(paginated)" that read no
     pagination parameter. Generating it is the only fix that does not drift
     again. -->

# ARCTOS API Reference

**Generated:** 2026-09-01 · **Source:** `apps/web/src/app/api/**/route.ts`

Base URL: `/api/v1`. Authentication is session-based (Auth.js); roles are
checked per organisation context.

## Coverage

| Metric                                      | Value |
| ------------------------------------------- | ----: |
| Route files                                 |  1362 |
| Method/path operations                      |  2027 |
| Routes with an auth gate (`withAuth`)       |  1315 |
| Routes with a module gate (`requireModule`) |   914 |
| Routes reading a pagination parameter       |    29 |
| Routes emitting RFC 7807 `problem+json`     |   107 |
| Routes outside `/api/v1`                    |     2 |

Every row below is derived from a file that exists; a path that is not listed
does not exist. `—` in a column means the route does not use that mechanism —
it is not a gap in this document.

**Columns**

- **Auth** — the roles passed to `withAuth(...)`. `session` = any
  authenticated user. `—` = no `withAuth` call (public, or token-authenticated;
  the public allowlist is `PUBLIC_EXACT_PATHS`/`PUBLIC_PREFIXES`/`PUBLIC_PATTERNS`
  in `packages/auth/src/rbac.ts`).
- **Module** — the `requireModule` gate key.
- **Pagination** — the query parameters the handler actually reads
  (S14-18). Four spellings are in use across the codebase; the canonical
  contract is documented in `docs/ADR-020-api-versioning.md`.
- **Errors** — `problem+json` where the route (or its `withErrorHandler`
  wrapper) emits RFC 7807 per ADR-021, `legacy {error}` otherwise (S14-16).

## Outside `/api/v1`

> ADR-020 states "Alle REST-Endpoints liegen unter `/api/v1/**`".
> These 2 do not, and the ADR names no exception (S14-17 / D10).

| Method            | Path                   | Auth | Module | Pagination | Errors | Notes |
| ----------------- | ---------------------- | ---- | ------ | ---------- | ------ | ----- |
| _(none exported)_ | `/api/auth/:nextauth*` | —    | —      | —          | —      |       |
| GET               | `/api/health`          | —    | —      | —          | —      |       |

## Academy

| Method             | Path                                       | Auth    | Module | Pagination | Errors                 | Notes |
| ------------------ | ------------------------------------------ | ------- | ------ | ---------- | ---------------------- | ----- |
| GET                | `/api/v1/academy/certificates`             | session | —      | —          | —                      |       |
| GET, POST          | `/api/v1/academy/courses`                  | session | —      | —          | problem+json (wrapper) |       |
| GET, PATCH, DELETE | `/api/v1/academy/courses/:id`              | session | —      | —          | legacy `{error}`       |       |
| GET                | `/api/v1/academy/dashboard`                | session | —      | —          | —                      |       |
| GET, POST          | `/api/v1/academy/enrollments`              | session | —      | —          | —                      |       |
| PATCH              | `/api/v1/academy/enrollments/:id/progress` | session | —      | —          | legacy `{error}`       |       |
| POST               | `/api/v1/academy/enrollments/bulk`         | admin   | —      | —          | problem+json (wrapper) |       |
| GET, POST          | `/api/v1/academy/lessons`                  | session | —      | —          | legacy `{error}`       |       |
| GET, PATCH, DELETE | `/api/v1/academy/lessons/:id`              | session | —      | —          | legacy `{error}`       |       |
| POST               | `/api/v1/academy/quiz-attempts`            | session | —      | —          | legacy `{error}`       |       |

## Access Log

| Method | Path                 | Auth  | Module | Pagination | Errors | Notes |
| ------ | -------------------- | ----- | ------ | ---------- | ------ | ----- |
| GET    | `/api/v1/access-log` | admin | —      | —          | —      |       |

## Admin

| Method                 | Path                                         | Auth    | Module | Pagination    | Errors                 | Notes                                                                                                          |
| ---------------------- | -------------------------------------------- | ------- | ------ | ------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| GET                    | `/api/v1/admin/abac/audit`                   | admin   | —      | limit, offset | —                      |                                                                                                                |
| GET, POST              | `/api/v1/admin/abac/policies`                | admin   | —      | —             | legacy `{error}`       |                                                                                                                |
| GET, PUT, DELETE       | `/api/v1/admin/abac/policies/:id`            | admin   | —      | —             | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/admin/abac/test`                    | admin   | —      | —             | legacy `{error}`       |                                                                                                                |
| GET, POST, PUT, DELETE | `/api/v1/admin/api-keys`                     | —       | —      | —             | —                      |                                                                                                                |
| GET, PUT               | `/api/v1/admin/branding`                     | session | —      | —             | problem+json (wrapper) | GET/PUT /api/v1/admin/branding                                                                                 |
| GET, POST, DELETE      | `/api/v1/admin/calendar/holidays`            | session | —      | —             | problem+json (wrapper) | GET/POST/DELETE /api/v1/admin/calendar/holidays                                                                |
| GET                    | `/api/v1/admin/connectors`                   | admin   | —      | —             | —                      | #NIGHT-036: /admin/connectors discovery — connector configs are scattered across /api/v1/{cloud-connectors,ide |
| GET, POST              | `/api/v1/admin/custom-fields`                | admin   | —      | —             | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/admin/custom-fields/:entityType`    | session | —      | —             | —                      |                                                                                                                |
| GET                    | `/api/v1/admin/integrations`                 | session | —      | —             | problem+json (wrapper) |                                                                                                                |
| GET, PUT               | `/api/v1/admin/languages`                    | session | —      | —             | legacy `{error}`       | Sprint 21: Organization Language Configuration API GET /api/v1/admin/languages — get org language config       |
| GET                    | `/api/v1/admin/license`                      | session | —      | —             | problem+json (wrapper) |                                                                                                                |
| GET, PUT               | `/api/v1/admin/org-hierarchy`                | admin   | —      | —             | legacy `{error}`       |                                                                                                                |
| GET, POST, PUT, DELETE | `/api/v1/admin/organizations`                | —       | —      | —             | problem+json           | #NIGHT-036: /api/v1/admin/organizations 308-redirect to the canonical /api/v1/organizations.                   |
| POST                   | `/api/v1/admin/performance/cache-invalidate` | admin   | —      | —             | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/admin/performance/cache-stats`      | admin   | —      | —             | —                      |                                                                                                                |
| GET                    | `/api/v1/admin/performance/slow-queries`     | admin   | —      | —             | —                      |                                                                                                                |
| GET                    | `/api/v1/admin/rls-audit`                    | admin   | —      | —             | —                      |                                                                                                                |
| GET, POST              | `/api/v1/admin/roles`                        | admin   | —      | —             | legacy `{error}`       |                                                                                                                |
| GET, PUT, DELETE       | `/api/v1/admin/roles/:id`                    | admin   | —      | —             | legacy `{error}`       |                                                                                                                |
| GET, POST              | `/api/v1/admin/roles/:id/users`              | admin   | —      | —             | legacy `{error}`       |                                                                                                                |
| DELETE                 | `/api/v1/admin/roles/:id/users/:userId`      | admin   | —      | —             | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/admin/scim/logs`                    | admin   | —      | —             | —                      |                                                                                                                |
| GET                    | `/api/v1/admin/scim/stats`                   | admin   | —      | —             | —                      |                                                                                                                |
| GET, POST              | `/api/v1/admin/scim/tokens`                  | admin   | —      | —             | legacy `{error}`       |                                                                                                                |
| DELETE                 | `/api/v1/admin/scim/tokens/:id`              | admin   | —      | —             | legacy `{error}`       |                                                                                                                |
| GET, PUT               | `/api/v1/admin/settings`                     | session | —      | —             | problem+json (wrapper) | GET/PUT /api/v1/admin/settings                                                                                 |
| GET, POST, PUT, DELETE | `/api/v1/admin/sso`                          | admin   | —      | —             | legacy `{error}`       |                                                                                                                |
| GET, POST, PUT, DELETE | `/api/v1/admin/sso-providers`                | —       | —      | —             | —                      |                                                                                                                |
| POST                   | `/api/v1/admin/sso/discover`                 | admin   | —      | —             | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/admin/sso/metadata`                 | admin   | —      | —             | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/admin/sso/test`                     | admin   | —      | —             | legacy `{error}`       |                                                                                                                |
| GET, POST, PUT, DELETE | `/api/v1/admin/users`                        | —       | —      | —             | problem+json           | #NIGHT-036: /api/v1/admin/users 308-redirect to the canonical /api/v1/users — the latter is reachable by every |

## Agents

| Method    | Path                                 | Auth  | Module | Pagination    | Errors           | Notes |
| --------- | ------------------------------------ | ----- | ------ | ------------- | ---------------- | ----- |
| GET, POST | `/api/v1/agents`                     | admin | —      | —             | legacy `{error}` |       |
| GET, PUT  | `/api/v1/agents/:id`                 | admin | —      | —             | legacy `{error}` |       |
| GET       | `/api/v1/agents/:id/log`             | admin | —      | limit, offset | —                |       |
| POST      | `/api/v1/agents/:id/run`             | admin | —      | —             | legacy `{error}` |       |
| GET       | `/api/v1/agents/dashboard`           | admin | —      | —             | —                |       |
| GET       | `/api/v1/agents/recommendations`     | admin | —      | limit, offset | —                |       |
| PUT       | `/api/v1/agents/recommendations/:id` | admin | —      | —             | legacy `{error}` |       |

## Ai

| Method   | Path                             | Auth                                                         | Module | Pagination | Errors                 | Notes                                                                                                         |
| -------- | -------------------------------- | ------------------------------------------------------------ | ------ | ---------- | ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| POST     | `/api/v1/ai/control-suggestions` | admin, risk_manager, control_owner                           | ics    | —          | legacy `{error}`       | AI-generated control suggestions for a risk                                                                   |
| POST     | `/api/v1/ai/draft-policy`        | admin, risk_manager, control_owner, dpo, process_owner, ciso | dms    | —          | legacy `{error}`       | AI-Assist #1: POST /api/v1/ai/draft-policy                                                                    |
| POST     | `/api/v1/ai/explain-gap`         | admin, ciso, risk_manager, control_owner, auditor            | isms   | —          | legacy `{error}`       | AI-Assist #3: POST /api/v1/ai/explain-gap                                                                     |
| GET      | `/api/v1/ai/features`            | session                                                      | —      | —          | —                      | Selbsteinordnung der KI-Funktionen (EU AI Act)                                                                |
| GET, PUT | `/api/v1/ai/policy`              | admin, dpo, ciso, compliance_officer                         | —      | —          | legacy `{error}`       | GET/PUT /api/v1/ai/policy — KI-Egress-Richtlinie der Organisation                                             |
| GET      | `/api/v1/ai/providers`           | admin                                                        | —      | —          | —                      | [ARCTOS-FULL-2026-08-31 / WP6 · S05-02, S05-03] Der Katalog nennt jetzt für jeden Provider die Verarbeitungs- |
| POST     | `/api/v1/ai/rcm-gap-analysis`    | admin, risk_manager                                          | erm    | —          | legacy `{error}`       | AI-driven RCM gap analysis                                                                                    |
| POST     | `/api/v1/ai/root-cause-patterns` | admin, risk_manager, auditor                                 | audit  | —          | legacy `{error}`       | AI pattern detection across findings                                                                          |
| GET      | `/api/v1/ai/router/health`       | session                                                      | —      | —          | problem+json (wrapper) |                                                                                                               |
| POST     | `/api/v1/ai/suggest-controls`    | admin, risk_manager, control_owner                           | erm    | —          | legacy `{error}`       | AI-Assist #2: POST /api/v1/ai/suggest-controls                                                                |
| POST     | `/api/v1/ai/test-plan`           | admin, risk_manager, auditor, control_owner                  | ics    | —          | legacy `{error}`       | AI-generated test plan for a control                                                                          |
| GET      | `/api/v1/ai/usage`               | admin                                                        | —      | —          | —                      |                                                                                                               |

## Ai Act

| Method             | Path                                                   | Auth                                      | Module | Pagination  | Errors                 | Notes |
| ------------------ | ------------------------------------------------------ | ----------------------------------------- | ------ | ----------- | ---------------------- | ----- |
| GET                | `/api/v1/ai-act/annual-report/:year`                   | admin, risk_manager, auditor              | isms   | —           | legacy `{error}`       |       |
| GET                | `/api/v1/ai-act/annual-report/:year/pdf`               | admin, risk_manager, auditor              | isms   | —           | legacy `{error}`       |       |
| GET, POST          | `/api/v1/ai-act/authority`                             | admin, risk_manager, dpo, auditor, viewer | isms   | —           | legacy `{error}`       |       |
| GET, POST          | `/api/v1/ai-act/conformity-assessments`                | admin, risk_manager, dpo                  | isms   | —           | legacy `{error}`       |       |
| GET, PATCH         | `/api/v1/ai-act/conformity-assessments/:id`            | admin, risk_manager, dpo, auditor, viewer | isms   | —           | legacy `{error}`       |       |
| GET, POST          | `/api/v1/ai-act/corrective-actions`                    | admin, risk_manager, dpo, auditor, viewer | isms   | —           | legacy `{error}`       |       |
| GET, PUT           | `/api/v1/ai-act/corrective-actions/:id`                | admin, risk_manager, dpo, auditor, viewer | isms   | —           | legacy `{error}`       |       |
| GET                | `/api/v1/ai-act/dashboard`                             | admin, risk_manager, dpo, auditor, viewer | isms   | —           | —                      |       |
| GET, POST          | `/api/v1/ai-act/framework-mappings`                    | admin, risk_manager, dpo                  | isms   | —           | legacy `{error}`       |       |
| GET, PATCH         | `/api/v1/ai-act/framework-mappings/:id`                | admin, risk_manager, dpo, auditor, viewer | isms   | —           | legacy `{error}`       |       |
| GET, POST          | `/api/v1/ai-act/frias`                                 | admin, risk_manager, dpo                  | isms   | limit, page | legacy `{error}`       |       |
| GET, PATCH         | `/api/v1/ai-act/frias/:id`                             | admin, risk_manager, dpo, auditor, viewer | isms   | —           | legacy `{error}`       |       |
| POST               | `/api/v1/ai-act/frias/:id/quality-check`               | admin, risk_manager, dpo                  | isms   | —           | legacy `{error}`       |       |
| GET, POST          | `/api/v1/ai-act/gpai`                                  | admin, risk_manager, dpo, auditor, viewer | isms   | —           | legacy `{error}`       |       |
| GET, PUT           | `/api/v1/ai-act/gpai/:id`                              | admin, risk_manager, dpo, auditor, viewer | isms   | —           | legacy `{error}`       |       |
| POST               | `/api/v1/ai-act/gpai/:id/classify-risk`                | admin, risk_manager                       | isms   | —           | legacy `{error}`       |       |
| POST               | `/api/v1/ai-act/gpai/:id/obligations-check`            | admin, risk_manager                       | isms   | —           | legacy `{error}`       |       |
| GET, POST          | `/api/v1/ai-act/incidents`                             | admin, risk_manager, dpo, auditor, viewer | isms   | —           | legacy `{error}`       |       |
| GET                | `/api/v1/ai-act/incidents-monitor`                     | session                                   | isms   | —           | —                      |       |
| GET                | `/api/v1/ai-act/incidents-monitor/pdf`                 | session                                   | isms   | —           | —                      |       |
| GET, PUT           | `/api/v1/ai-act/incidents/:id`                         | admin, risk_manager, dpo, auditor, viewer | isms   | —           | legacy `{error}`       |       |
| GET                | `/api/v1/ai-act/incidents/:id/overdue-check`           | session                                   | isms   | —           | legacy `{error}`       |       |
| POST               | `/api/v1/ai-act/incidents/classify-deadline`           | admin, risk_manager, dpo                  | isms   | —           | legacy `{error}`       |       |
| GET, POST          | `/api/v1/ai-act/oversight-logs`                        | admin, risk_manager, dpo, control_owner   | isms   | —           | legacy `{error}`       |       |
| GET, POST          | `/api/v1/ai-act/penalties`                             | admin, risk_manager, dpo, auditor, viewer | isms   | —           | legacy `{error}`       |       |
| GET, POST          | `/api/v1/ai-act/prohibited`                            | admin, risk_manager, dpo, auditor, viewer | isms   | —           | legacy `{error}`       |       |
| GET, POST          | `/api/v1/ai-act/qms`                                   | admin, risk_manager, dpo, auditor, viewer | isms   | —           | legacy `{error}`       |       |
| GET                | `/api/v1/ai-act/qms/:id/gap-analysis`                  | session                                   | isms   | —           | legacy `{error}`       |       |
| GET, POST          | `/api/v1/ai-act/systems`                               | admin, risk_manager, dpo                  | isms   | —           | legacy `{error}`       |       |
| GET, PATCH, DELETE | `/api/v1/ai-act/systems/:id`                           | admin, risk_manager, dpo, auditor, viewer | isms   | —           | legacy `{error}`       |       |
| POST               | `/api/v1/ai-act/systems/:id/annex-iv-check`            | admin, risk_manager                       | isms   | —           | legacy `{error}`       |       |
| POST               | `/api/v1/ai-act/systems/:id/ce-marking-gate`           | admin, risk_manager                       | isms   | —           | legacy `{error}`       |       |
| POST               | `/api/v1/ai-act/systems/:id/classify`                  | admin, risk_manager                       | isms   | —           | legacy `{error}`       |       |
| POST               | `/api/v1/ai-act/systems/:id/conformity-checklist`      | admin, risk_manager, auditor              | isms   | —           | legacy `{error}`       |       |
| POST               | `/api/v1/ai-act/systems/:id/data-governance-check`     | admin, risk_manager                       | isms   | —           | legacy `{error}`       |       |
| POST               | `/api/v1/ai-act/systems/:id/declaration-of-conformity` | admin, risk_manager                       | isms   | —           | legacy `{error}`       |       |
| POST               | `/api/v1/ai-act/systems/:id/deployer-compliance`       | admin, risk_manager, dpo                  | isms   | —           | legacy `{error}`       |       |
| POST               | `/api/v1/ai-act/systems/:id/fria-required`             | admin, risk_manager, dpo                  | isms   | —           | legacy `{error}`       |       |
| POST               | `/api/v1/ai-act/systems/:id/logging-check`             | admin, risk_manager                       | isms   | —           | legacy `{error}`       |       |
| POST               | `/api/v1/ai-act/systems/:id/oversight-check`           | admin, risk_manager                       | isms   | —           | legacy `{error}`       |       |
| POST               | `/api/v1/ai-act/systems/:id/post-market-plan-check`    | admin, risk_manager                       | isms   | —           | legacy `{error}`       |       |
| POST               | `/api/v1/ai-act/systems/:id/select-procedure`          | admin, risk_manager                       | isms   | —           | legacy `{error}`       |       |
| POST               | `/api/v1/ai-act/systems/:id/substantial-change-check`  | admin, risk_manager                       | isms   | —           | legacy `{error}`       |       |
| POST               | `/api/v1/ai-act/systems/:id/transition-stage`          | admin, risk_manager                       | isms   | —           | legacy `{error}`       |       |
| POST               | `/api/v1/ai-act/systems/:id/transparency-check`        | admin, risk_manager, dpo                  | isms   | —           | legacy `{error}`       |       |
| GET, POST          | `/api/v1/ai-act/transparency-entries`                  | admin, risk_manager, dpo                  | isms   | limit, page | problem+json (wrapper) |       |
| GET, PATCH         | `/api/v1/ai-act/transparency-entries/:id`              | admin, risk_manager, dpo, auditor, viewer | isms   | —           | legacy `{error}`       |       |

## Api Keys

| Method             | Path                           | Auth  | Module | Pagination | Errors           | Notes |
| ------------------ | ------------------------------ | ----- | ------ | ---------- | ---------------- | ----- |
| GET, POST          | `/api/v1/api-keys`             | admin | —      | —          | legacy `{error}` |       |
| GET, PATCH, DELETE | `/api/v1/api-keys/:id`         | admin | —      | —          | legacy `{error}` |       |
| GET                | `/api/v1/api-keys/scopes`      | admin | —      | —          | —                |       |
| GET                | `/api/v1/api-keys/usage`       | admin | —      | —          | legacy `{error}` |       |
| GET                | `/api/v1/api-keys/usage/stats` | admin | —      | —          | —                |       |

## Asset Classification Overrides

| Method      | Path                                                 | Auth                      | Module | Pagination | Errors                 | Notes                                                                     |
| ----------- | ---------------------------------------------------- | ------------------------- | ------ | ---------- | ---------------------- | ------------------------------------------------------------------------- |
| GET         | `/api/v1/asset-classification-overrides`             | session                   | —      | —          | problem+json (wrapper) |                                                                           |
| GET, DELETE | `/api/v1/asset-classification-overrides/:id`         | session                   | —      | —          | legacy `{error}`       | single read DELETE /api/v1/asset-classification-overrides/[id] — operator |
| POST        | `/api/v1/asset-classification-overrides/:id/approve` | admin, risk_manager, ciso | —      | —          | legacy `{error}`       |                                                                           |
| POST        | `/api/v1/asset-classification-overrides/:id/reject`  | admin, risk_manager, ciso | —      | —          | legacy `{error}`       |                                                                           |

## Assets

| Method           | Path                                          | Auth                                     | Module | Pagination | Errors                 | Notes |
| ---------------- | --------------------------------------------- | ---------------------------------------- | ------ | ---------- | ---------------------- | ----- |
| GET, POST        | `/api/v1/assets`                              | admin                                    | —      | —          | problem+json (wrapper) |       |
| GET, PUT, DELETE | `/api/v1/assets/:id`                          | session                                  | —      | —          | legacy `{error}`       |       |
| GET, POST        | `/api/v1/assets/:id/classification-override`  | admin, risk_manager, ciso, control_owner | —      | —          | legacy `{error}`       |       |
| GET              | `/api/v1/assets/:id/effective-cia`            | session                                  | —      | —          | legacy `{error}`       |       |
| GET              | `/api/v1/assets/:id/effective-classification` | session                                  | —      | —          | legacy `{error}`       |       |
| GET              | `/api/v1/assets/:id/transitions`              | session                                  | isms   | —          | legacy `{error}`       |       |
| GET              | `/api/v1/assets/:id/work-items`               | session                                  | —      | —          | legacy `{error}`       |       |
| GET              | `/api/v1/assets/hierarchy`                    | session                                  | —      | —          | —                      |       |

## Assurance

| Method | Path                               | Auth                | Module | Pagination | Errors           | Notes |
| ------ | ---------------------------------- | ------------------- | ------ | ---------- | ---------------- | ----- |
| GET    | `/api/v1/assurance/scores`         | admin, risk_manager | —      | —          | —                |       |
| GET    | `/api/v1/assurance/scores/:module` | admin, risk_manager | —      | —          | legacy `{error}` |       |
| GET    | `/api/v1/assurance/trend`          | admin, risk_manager | —      | —          | —                |       |

## Audit Log

| Method    | Path                                     | Auth                                     | Module | Pagination | Errors                 | Notes      |
| --------- | ---------------------------------------- | ---------------------------------------- | ------ | ---------- | ---------------------- | ---------- |
| GET       | `/api/v1/audit-log`                      | admin, auditor, dpo                      | —      | —          | problem+json (wrapper) |            |
| GET, POST | `/api/v1/audit-log/anchor`               | admin, auditor                           | —      | limit      | legacy `{error}`       |            |
| POST      | `/api/v1/audit-log/anchor/upgrade`       | admin, auditor                           | —      | —          | —                      |            |
| GET       | `/api/v1/audit-log/archive`              | admin, auditor                           | —      | —          | problem+json           |            |
| GET       | `/api/v1/audit-log/integrity`            | admin, auditor, ciso, compliance_officer | —      | —          | problem+json           |            |
| GET       | `/api/v1/audit-log/integrity/continuity` | admin, auditor, ciso, compliance_officer | —      | —          | problem+json           | Wave-24-C1 |

## Audit Mgmt

| Method           | Path                                                                                 | Auth                                                | Module | Pagination | Errors                 | Notes                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------- | ------ | ---------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| GET, POST        | `/api/v1/audit-mgmt/analytics/imports`                                               | session                                             | audit  | —          | legacy `{error}`       |                                                                                                                |
| POST             | `/api/v1/audit-mgmt/analytics/imports/:id/analyze`                                   | session                                             | audit  | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/audit-mgmt/analytics/imports/:id/results`                                   | session                                             | audit  | —          | —                      |                                                                                                                |
| POST             | `/api/v1/audit-mgmt/analytics/results/:id/create-finding`                            | session                                             | audit  | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/audit-mgmt/analytics/templates`                                             | session                                             | audit  | —          | —                      |                                                                                                                |
| GET              | `/api/v1/audit-mgmt/audit-impact-kris`                                               | session                                             | audit  | —          | —                      |                                                                                                                |
| GET, POST        | `/api/v1/audit-mgmt/auditor-profiles`                                                | admin, auditor, risk_manager                        | audit  | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/audit-mgmt/auditors`                                                        | session                                             | audit  | —          | —                      |                                                                                                                |
| GET, POST        | `/api/v1/audit-mgmt/audits`                                                          | admin, auditor, risk_manager                        | audit  | —          | problem+json (wrapper) |                                                                                                                |
| GET, PUT, DELETE | `/api/v1/audit-mgmt/audits/:id`                                                      | session                                             | audit  | —          | legacy `{error}`       |                                                                                                                |
| GET, POST        | `/api/v1/audit-mgmt/audits/:id/activities`                                           | admin, auditor                                      | audit  | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/audit-mgmt/audits/:id/activities/schema`                                    | session                                             | audit  | —          | legacy `{error}`       | Wave-24-D5                                                                                                     |
| POST             | `/api/v1/audit-mgmt/audits/:id/ai/generate-checklist`                                | admin, auditor, compliance_officer                  | audit  | —          | legacy `{error}`       | Audit Overhaul Phase 3: AI checklist generator from framework + scope. [ARCTOS-FULL-2026-08-31 / WP6 · S05-06, |
| POST             | `/api/v1/audit-mgmt/audits/:id/ai/suggest-findings`                                  | admin, auditor, compliance_officer                  | audit  | —          | legacy `{error}`       | Audit Overhaul Phase 3: AI finding-suggester from nonconforming checklist items.                               |
| POST             | `/api/v1/audit-mgmt/audits/:id/audit-pack`                                           | admin, auditor, compliance_officer, quality_manager | audit  | —          | legacy `{error}`       | Audit Overhaul Phase 2: per-audit ZIP audit-pack.                                                              |
| POST             | `/api/v1/audit-mgmt/audits/:id/bulk-create-findings`                                 | admin, auditor                                      | audit  | —          | legacy `{error}`       |                                                                                                                |
| GET, POST        | `/api/v1/audit-mgmt/audits/:id/checklists`                                           | admin, auditor                                      | audit  | —          | legacy `{error}`       |                                                                                                                |
| GET, DELETE      | `/api/v1/audit-mgmt/audits/:id/checklists/:checklistId`                              | session                                             | audit  | —          | legacy `{error}`       |                                                                                                                |
| POST             | `/api/v1/audit-mgmt/audits/:id/checklists/:checklistId/duplicate`                    | admin, auditor                                      | audit  | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/audit-mgmt/audits/:id/checklists/:checklistId/export`                       | session                                             | audit  | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/audit-mgmt/audits/:id/checklists/:checklistId/items`                        | session                                             | audit  | —          | legacy `{error}`       |                                                                                                                |
| PUT              | `/api/v1/audit-mgmt/audits/:id/checklists/:checklistId/items/:itemId`                | admin, auditor                                      | audit  | —          | legacy `{error}`       |                                                                                                                |
| POST             | `/api/v1/audit-mgmt/audits/:id/checklists/:checklistId/items/:itemId/create-finding` | admin, auditor                                      | audit  | —          | legacy `{error}`       |                                                                                                                |
| POST             | `/api/v1/audit-mgmt/audits/:id/checklists/generate`                                  | admin, auditor                                      | audit  | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/audit-mgmt/audits/:id/closure-readiness`                                    | session                                             | audit  | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/audit-mgmt/audits/:id/racm`                                                 | session                                             | audit  | —          | legacy `{error}`       | Audit Overhaul Phase 2: Audit-scope RACM view.                                                                 |
| GET              | `/api/v1/audit-mgmt/audits/:id/report`                                               | session                                             | audit  | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/audit-mgmt/audits/:id/scope-aggregation`                                    | session                                             | audit  | —          | legacy `{error}`       | Audit Overhaul Phase 2: Scope-aggregation — what does this audit touch. Returns findings grouped by linked pro |
| GET, POST        | `/api/v1/audit-mgmt/audits/:id/sign-off`                                             | session                                             | audit  | —          | legacy `{error}`       | Audit Overhaul Phase 1: hash-chain anchored sign-off per audit.                                                |
| PUT              | `/api/v1/audit-mgmt/audits/:id/status`                                               | admin, auditor, risk_manager                        | audit  | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/audit-mgmt/audits/:id/transitions`                                          | session                                             | audit  | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/audit-mgmt/audits/:id/transitions/blockers`                                 | session                                             | audit  | —          | legacy `{error}`       | Audit Overhaul Phase 1: discovery — what gates block the next transition?                                      |
| GET, POST        | `/api/v1/audit-mgmt/continuous-rules`                                                | admin, auditor, risk_manager                        | audit  | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/audit-mgmt/dashboard`                                                       | session                                             | audit  | —          | —                      |                                                                                                                |
| GET, POST        | `/api/v1/audit-mgmt/plans`                                                           | admin, auditor, risk_manager                        | audit  | —          | legacy `{error}`       |                                                                                                                |
| GET, PUT, DELETE | `/api/v1/audit-mgmt/plans/:id`                                                       | session                                             | audit  | —          | legacy `{error}`       |                                                                                                                |
| GET, POST        | `/api/v1/audit-mgmt/plans/:id/items`                                                 | admin, auditor, risk_manager                        | audit  | —          | legacy `{error}`       |                                                                                                                |
| PUT              | `/api/v1/audit-mgmt/plans/:id/status`                                                | admin, auditor, risk_manager                        | audit  | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/audit-mgmt/plans/suggest`                                                   | admin, auditor, risk_manager                        | audit  | limit      | —                      |                                                                                                                |
| GET, POST        | `/api/v1/audit-mgmt/qa-review`                                                       | admin, auditor                                      | audit  | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/audit-mgmt/templates`                                                       | admin, auditor                                      | audit  | —          | legacy `{error}`       |                                                                                                                |
| GET, POST        | `/api/v1/audit-mgmt/universe`                                                        | admin, auditor, risk_manager                        | audit  | —          | legacy `{error}`       |                                                                                                                |
| GET, PUT, DELETE | `/api/v1/audit-mgmt/universe/:id`                                                    | session                                             | audit  | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/audit-mgmt/universe/coverage`                                               | session                                             | audit  | —          | problem+json (wrapper) | #WAVE6-CROSS-03: GET /api/v1/audit-mgmt/universe/coverage was 500 because the path landed on /universe/[id]/ro |
| GET, POST        | `/api/v1/audit-mgmt/working-papers`                                                  | admin, auditor, risk_manager                        | audit  | —          | legacy `{error}`       |                                                                                                                |

## Auth

| Method | Path                             | Auth | Module | Pagination | Errors           | Notes |
| ------ | -------------------------------- | ---- | ------ | ---------- | ---------------- | ----- |
| POST   | `/api/v1/auth/admin-login`       | —    | —      | —          | problem+json     |       |
| GET    | `/api/v1/auth/sso/config`        | —    | —      | —          | —                |       |
| GET    | `/api/v1/auth/sso/oidc/callback` | —    | —      | —          | legacy `{error}` |       |
| GET    | `/api/v1/auth/sso/oidc/login`    | —    | —      | —          | legacy `{error}` |       |
| POST   | `/api/v1/auth/sso/saml/callback` | —    | —      | —          | legacy `{error}` |       |
| GET    | `/api/v1/auth/sso/saml/login`    | —    | —      | —          | legacy `{error}` |       |
| POST   | `/api/v1/auth/switch-org`        | —    | —      | —          | legacy `{error}` |       |

## Automation

| Method           | Path                                    | Auth  | Module | Pagination | Errors           | Notes |
| ---------------- | --------------------------------------- | ----- | ------ | ---------- | ---------------- | ----- |
| GET              | `/api/v1/automation/dashboard`          | admin | —      | —          | —                |       |
| GET              | `/api/v1/automation/entity-fields`      | admin | —      | —          | —                |       |
| GET              | `/api/v1/automation/executions`         | admin | —      | —          | —                |       |
| GET, POST        | `/api/v1/automation/rules`              | admin | —      | —          | legacy `{error}` |       |
| GET, PUT, DELETE | `/api/v1/automation/rules/:id`          | admin | —      | —          | legacy `{error}` |       |
| PUT              | `/api/v1/automation/rules/:id/activate` | admin | —      | —          | legacy `{error}` |       |
| POST             | `/api/v1/automation/rules/:id/test`     | admin | —      | —          | legacy `{error}` |       |
| GET              | `/api/v1/automation/templates`          | admin | —      | —          | —                |       |

## Bcms

| Method           | Path                                            | Auth                                                               | Module | Pagination | Errors                 | Notes                                                                                                          |
| ---------------- | ----------------------------------------------- | ------------------------------------------------------------------ | ------ | ---------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| GET, POST        | `/api/v1/bcms/bia`                              | admin, risk_manager, bcm_manager                                   | bcms   | —          | problem+json (wrapper) |                                                                                                                |
| GET, PUT         | `/api/v1/bcms/bia/:id`                          | session                                                            | bcms   | —          | legacy `{error}`       |                                                                                                                |
| POST             | `/api/v1/bcms/bia/:id/finalize`                 | admin, risk_manager                                                | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/bcms/bia/:id/gate-check`               | session                                                            | bcms   | —          | legacy `{error}`       |                                                                                                                |
| POST             | `/api/v1/bcms/bia/:id/generate-process-impacts` | admin, risk_manager                                                | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/bcms/bia/:id/heatmap`                  | session                                                            | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST        | `/api/v1/bcms/bia/:id/impacts`                  | admin, risk_manager                                                | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/bcms/bia/:id/impacts/heatmap`          | session                                                            | bcms   | —          | legacy `{error}`       |                                                                                                                |
| POST             | `/api/v1/bcms/bia/:id/start`                    | admin, risk_manager                                                | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST        | `/api/v1/bcms/bia/:id/suppliers`                | admin, risk_manager                                                | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/bcms/bia/:id/transitions`              | session                                                            | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/bcms/bia/export`                       | session                                                            | bcms   | —          | problem+json (wrapper) |                                                                                                                |
| GET, POST        | `/api/v1/bcms/contact-trees`                    | session                                                            | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST        | `/api/v1/bcms/contact-trees/:treeId/nodes`      | session                                                            | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST        | `/api/v1/bcms/crisis`                           | admin, risk_manager                                                | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET, PUT         | `/api/v1/bcms/crisis/:id`                       | session                                                            | bcms   | —          | legacy `{error}`       |                                                                                                                |
| POST             | `/api/v1/bcms/crisis/:id/activate`              | admin, risk_manager                                                | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/bcms/crisis/:id/dora-timer`            | session                                                            | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST        | `/api/v1/bcms/crisis/:id/log`                   | admin, risk_manager                                                | bcms   | —          | legacy `{error}`       |                                                                                                                |
| POST             | `/api/v1/bcms/crisis/:id/resolve`               | admin, risk_manager                                                | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST        | `/api/v1/bcms/crisis/:id/team`                  | admin, risk_manager                                                | bcms   | —          | legacy `{error}`       |                                                                                                                |
| DELETE           | `/api/v1/bcms/crisis/:id/team/:memberId`        | admin, risk_manager                                                | bcms   | —          | legacy `{error}`       |                                                                                                                |
| POST             | `/api/v1/bcms/crisis/:id/transition`            | admin, risk_manager                                                | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/bcms/crisis/dashboard`                 | —                                                                  | —      | —          | problem+json           | #NIGHT-031: GET /api/v1/bcms/crisis/dashboard was crashing with 500 because the request was being routed to th |
| GET              | `/api/v1/bcms/dashboard`                        | session                                                            | bcms   | —          | —                      |                                                                                                                |
| GET              | `/api/v1/bcms/dashboards`                       | admin, risk_manager, control_owner, process_owner, auditor, viewer | bcms   | —          | —                      |                                                                                                                |
| POST             | `/api/v1/bcms/erm-sync`                         | admin, risk_manager                                                | bcms   | —          | —                      |                                                                                                                |
| GET, POST        | `/api/v1/bcms/exercises`                        | admin, risk_manager                                                | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET, PUT         | `/api/v1/bcms/exercises/:id`                    | session                                                            | bcms   | —          | legacy `{error}`       |                                                                                                                |
| POST             | `/api/v1/bcms/exercises/:id/complete`           | admin, risk_manager                                                | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST        | `/api/v1/bcms/exercises/:id/findings`           | admin, risk_manager                                                | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/bcms/exercises/:id/gate-check`         | session                                                            | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST        | `/api/v1/bcms/exercises/:id/lessons`            | session                                                            | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/bcms/exercises/:id/report`             | session                                                            | bcms   | —          | legacy `{error}`       |                                                                                                                |
| POST             | `/api/v1/bcms/exercises/:id/transition`         | admin, risk_manager                                                | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/bcms/exercises/:id/transitions`        | session                                                            | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/bcms/exercises/upcoming`               | session                                                            | bcms   | limit      | problem+json (wrapper) | #NIGHT-032: GET /api/v1/bcms/exercises/upcoming crashed because the path was caught by the dynamic [id] handle |
| GET, POST        | `/api/v1/bcms/plans`                            | admin, risk_manager                                                | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET, PUT, DELETE | `/api/v1/bcms/plans/:id`                        | session                                                            | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/bcms/plans/:id/gate-check`             | session                                                            | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST        | `/api/v1/bcms/plans/:id/procedures`             | admin, risk_manager                                                | bcms   | —          | legacy `{error}`       |                                                                                                                |
| PUT, DELETE      | `/api/v1/bcms/plans/:id/procedures/:procId`     | admin, risk_manager                                                | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST        | `/api/v1/bcms/plans/:id/resources`              | admin, risk_manager                                                | bcms   | —          | legacy `{error}`       |                                                                                                                |
| PUT              | `/api/v1/bcms/plans/:id/status`                 | admin, risk_manager                                                | bcms   | —          | legacy `{error}`       |                                                                                                                |
| POST             | `/api/v1/bcms/plans/:id/transition`             | admin, risk_manager                                                | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/bcms/readiness-monitor`                | session                                                            | bcms   | —          | —                      |                                                                                                                |
| GET              | `/api/v1/bcms/readiness-monitor/pdf`            | session                                                            | bcms   | —          | —                      |                                                                                                                |
| GET, POST        | `/api/v1/bcms/recovery-procedures`              | session                                                            | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/bcms/resilience/score`                 | session                                                            | bcms   | —          | —                      |                                                                                                                |
| GET, POST        | `/api/v1/bcms/strategies`                       | admin, risk_manager                                                | bcms   | —          | legacy `{error}`       |                                                                                                                |
| GET, PUT, DELETE | `/api/v1/bcms/strategies/:id`                   | session                                                            | bcms   | —          | legacy `{error}`       |                                                                                                                |

## Bi Reports

| Method             | Path                                  | Auth                | Module    | Pagination | Errors           | Notes |
| ------------------ | ------------------------------------- | ------------------- | --------- | ---------- | ---------------- | ----- |
| GET, POST          | `/api/v1/bi-reports`                  | session             | reporting | —          | —                |       |
| GET, PATCH, DELETE | `/api/v1/bi-reports/:id`              | session             | reporting | —          | legacy `{error}` |       |
| GET, PUT           | `/api/v1/bi-reports/brand-config`     | session             | reporting | —          | —                |       |
| GET, POST          | `/api/v1/bi-reports/data-sources`     | session             | reporting | —          | —                |       |
| GET, PATCH, DELETE | `/api/v1/bi-reports/data-sources/:id` | session             | reporting | —          | legacy `{error}` |       |
| GET, POST          | `/api/v1/bi-reports/executions`       | session             | reporting | —          | legacy `{error}` |       |
| GET                | `/api/v1/bi-reports/executions/:id`   | session             | reporting | —          | legacy `{error}` |       |
| GET, POST          | `/api/v1/bi-reports/queries`          | session             | reporting | —          | —                |       |
| GET, PATCH, DELETE | `/api/v1/bi-reports/queries/:id`      | session             | reporting | —          | legacy `{error}` |       |
| POST               | `/api/v1/bi-reports/queries/execute`  | admin, risk_manager | reporting | —          | legacy `{error}` |       |
| GET, POST          | `/api/v1/bi-reports/scheduled`        | session             | reporting | —          | legacy `{error}` |       |
| PATCH, DELETE      | `/api/v1/bi-reports/scheduled/:id`    | admin, risk_manager | reporting | —          | legacy `{error}` |       |
| GET, POST          | `/api/v1/bi-reports/shares`           | session             | reporting | —          | legacy `{error}` |       |
| PATCH, DELETE      | `/api/v1/bi-reports/shares/:id`       | admin, risk_manager | reporting | —          | legacy `{error}` |       |
| GET, POST          | `/api/v1/bi-reports/widgets`          | session             | reporting | —          | legacy `{error}` |       |
| PATCH, DELETE      | `/api/v1/bi-reports/widgets/:id`      | admin, risk_manager | reporting | —          | legacy `{error}` |       |

## Billing

| Method | Path                           | Auth  | Module | Pagination | Errors           | Notes |
| ------ | ------------------------------ | ----- | ------ | ---------- | ---------------- | ----- |
| GET    | `/api/v1/billing/invoices`     | admin | —      | —          | legacy `{error}` |       |
| GET    | `/api/v1/billing/invoices/:id` | admin | —      | —          | legacy `{error}` |       |

## Bpm

| Method                 | Path                           | Auth                                                               | Module | Pagination | Errors                 | Notes                                                                  |
| ---------------------- | ------------------------------ | ------------------------------------------------------------------ | ------ | ---------- | ---------------------- | ---------------------------------------------------------------------- |
| GET, POST              | `/api/v1/bpm/kpis`             | admin, process_owner, risk_manager                                 | bpm    | —          | legacy `{error}`       |                                                                        |
| GET, POST              | `/api/v1/bpm/maturity`         | admin, process_owner, risk_manager                                 | bpm    | —          | legacy `{error}`       |                                                                        |
| GET, POST              | `/api/v1/bpm/mining`           | admin, process_owner, risk_manager                                 | bpm    | —          | legacy `{error}`       |                                                                        |
| GET                    | `/api/v1/bpm/my-homepage`      | admin, risk_manager, control_owner, process_owner, auditor, viewer | bpm    | —          | problem+json (wrapper) |                                                                        |
| GET                    | `/api/v1/bpm/my-processes`     | session                                                            | bpm    | —          | —                      | Process-Portal (Endanwender): "Meine Prozesse".                        |
| GET                    | `/api/v1/bpm/my-processes/:id` | session                                                            | bpm    | —          | legacy `{error}`       | Process-Portal (Endanwender): read-only detail of a PUBLISHED process. |
| GET, POST, PUT, DELETE | `/api/v1/bpm/templates`        | admin, process_owner, risk_manager, viewer                         | bpm    | —          | legacy `{error}`       |                                                                        |
| GET, POST              | `/api/v1/bpm/vsm`              | admin, process_owner, risk_manager                                 | bpm    | —          | legacy `{error}`       |                                                                        |

## Branding

| Method | Path                          | Auth | Module | Pagination | Errors | Notes |
| ------ | ----------------------------- | ---- | ------ | ---------- | ------ | ----- |
| GET    | `/api/v1/branding/css/:orgId` | —    | —      | —          | —      |       |

## Budget

| Method    | Path                                    | Auth                         | Module | Pagination | Errors           | Notes |
| --------- | --------------------------------------- | ---------------------------- | ------ | ---------- | ---------------- | ----- |
| GET, POST | `/api/v1/budget`                        | admin, risk_manager, auditor | —      | —          | legacy `{error}` |       |
| GET, PUT  | `/api/v1/budget/:year`                  | admin, risk_manager, auditor | —      | —          | legacy `{error}` |       |
| PUT       | `/api/v1/budget/:year/approve`          | admin                        | —      | —          | legacy `{error}` |       |
| GET       | `/api/v1/budget/:year/forecast`         | admin, risk_manager, auditor | —      | —          | legacy `{error}` |       |
| GET, POST | `/api/v1/budget/:year/lines`            | admin, risk_manager          | —      | —          | legacy `{error}` |       |
| GET       | `/api/v1/budget/:year/vs-actual`        | admin, risk_manager, auditor | —      | —          | legacy `{error}` |       |
| GET       | `/api/v1/budget/executive-report/:year` | admin, risk_manager, auditor | —      | —          | legacy `{error}` |       |
| GET       | `/api/v1/budget/usage`                  | admin, risk_manager, auditor | —      | —          | —                |       |

## Budgets

| Method | Path              | Auth    | Module | Pagination | Errors | Notes |
| ------ | ----------------- | ------- | ------ | ---------- | ------ | ----- |
| GET    | `/api/v1/budgets` | session | —      | —          | —      |       |

## Calendar

| Method           | Path                                   | Auth                                                            | Module | Pagination | Errors                 | Notes |
| ---------------- | -------------------------------------- | --------------------------------------------------------------- | ------ | ---------- | ---------------------- | ----- |
| GET              | `/api/v1/calendar`                     | session                                                         | —      | —          | problem+json (wrapper) |       |
| GET              | `/api/v1/calendar/capacity-heatmap`    | session                                                         | —      | —          | legacy `{error}`       |       |
| GET, POST        | `/api/v1/calendar/events`              | admin, risk_manager, control_owner, process_owner, dpo, auditor | —      | —          | legacy `{error}`       |       |
| GET, PUT, DELETE | `/api/v1/calendar/events/:id`          | admin, risk_manager, control_owner, process_owner, dpo, auditor | —      | —          | legacy `{error}`       |       |
| GET              | `/api/v1/calendar/ical/:token`         | session                                                         | —      | —          | —                      |       |
| POST             | `/api/v1/calendar/ical/generate-token` | session                                                         | —      | —          | —                      |       |
| DELETE           | `/api/v1/calendar/ical/revoke-token`   | session                                                         | —      | —          | —                      |       |
| GET              | `/api/v1/calendar/upcoming`            | session                                                         | —      | limit      | —                      |       |

## Catalog References

| Method            | Path                         | Auth    | Module | Pagination | Errors           | Notes |
| ----------------- | ---------------------------- | ------- | ------ | ---------- | ---------------- | ----- |
| GET, POST, DELETE | `/api/v1/catalog-references` | session | —      | —          | legacy `{error}` |       |

## Catalogs

| Method           | Path                                                     | Auth                                              | Module | Pagination    | Errors                 | Notes                                                                                                         |
| ---------------- | -------------------------------------------------------- | ------------------------------------------------- | ------ | ------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| GET              | `/api/v1/catalogs`                                       | session                                           | —      | —             | problem+json (wrapper) |                                                                                                               |
| GET              | `/api/v1/catalogs/active-entries`                        | session                                           | —      | limit         | —                      | Returns catalog entries from catalogs activated for the current org.                                          |
| GET              | `/api/v1/catalogs/controls`                              | session                                           | —      | —             | —                      |                                                                                                               |
| GET              | `/api/v1/catalogs/controls/:catalogId/entries`           | session                                           | —      | —             | —                      |                                                                                                               |
| GET              | `/api/v1/catalogs/controls/:catalogId/entries/:entryId`  | session                                           | —      | —             | legacy `{error}`       |                                                                                                               |
| GET              | `/api/v1/catalogs/lifecycle-roadmap`                     | session                                           | —      | —             | —                      |                                                                                                               |
| GET              | `/api/v1/catalogs/mappings`                              | session                                           | —      | —             | legacy `{error}`       |                                                                                                               |
| GET, POST        | `/api/v1/catalogs/objects`                               | session                                           | —      | —             | legacy `{error}`       |                                                                                                               |
| GET, PUT, DELETE | `/api/v1/catalogs/objects/:id`                           | session                                           | —      | —             | legacy `{error}`       |                                                                                                               |
| GET, POST        | `/api/v1/catalogs/objects/:id/lifecycle-phases`          | session                                           | —      | —             | legacy `{error}`       |                                                                                                               |
| PUT, DELETE      | `/api/v1/catalogs/objects/:id/lifecycle-phases/:phaseId` | admin, risk_manager, control_owner, process_owner | —      | —             | legacy `{error}`       |                                                                                                               |
| GET, POST        | `/api/v1/catalogs/presets`                               | admin, risk_manager, auditor, viewer              | —      | —             | legacy `{error}`       | list available compliance-package presets POST /api/v1/catalogs/presets/activate — activate all catalogs of a |
| GET              | `/api/v1/catalogs/risks`                                 | session                                           | —      | —             | —                      |                                                                                                               |
| GET              | `/api/v1/catalogs/risks/:catalogId/entries`              | session                                           | —      | —             | —                      |                                                                                                               |
| GET              | `/api/v1/catalogs/risks/:catalogId/entries/:entryId`     | session                                           | —      | —             | legacy `{error}`       |                                                                                                               |
| GET              | `/api/v1/catalogs/where-used/:entryId`                   | session                                           | —      | limit, offset | —                      |                                                                                                               |

## Cert Wizard

| Method             | Path                                        | Auth                                 | Module | Pagination | Errors           | Notes                                                                                                      |
| ------------------ | ------------------------------------------- | ------------------------------------ | ------ | ---------- | ---------------- | ---------------------------------------------------------------------------------------------------------- |
| GET, POST          | `/api/v1/cert-wizard/assessments`           | admin, risk_manager, auditor         | —      | —          | legacy `{error}` |                                                                                                            |
| GET, PATCH, DELETE | `/api/v1/cert-wizard/assessments/:id`       | admin, risk_manager, auditor, viewer | —      | —          | legacy `{error}` |                                                                                                            |
| GET                | `/api/v1/cert-wizard/dashboard`             | admin, risk_manager, auditor, viewer | —      | —          | —                |                                                                                                            |
| GET, POST          | `/api/v1/cert-wizard/evidence-packages`     | admin, risk_manager, auditor         | audit  | —          | legacy `{error}` |                                                                                                            |
| GET, PATCH         | `/api/v1/cert-wizard/evidence-packages/:id` | admin, risk_manager, auditor, viewer | audit  | —          | legacy `{error}` |                                                                                                            |
| GET, POST          | `/api/v1/cert-wizard/mock-audits`           | admin, risk_manager, auditor         | —      | —          | legacy `{error}` |                                                                                                            |
| GET, PATCH         | `/api/v1/cert-wizard/mock-audits/:id`       | admin, risk_manager, auditor, viewer | —      | —          | legacy `{error}` |                                                                                                            |
| GET, POST          | `/api/v1/cert-wizard/templates`             | admin, risk_manager, auditor, viewer | —      | —          | legacy `{error}` | list available templates (one per active control catalog) POST /api/v1/cert-wizard/templates/instantiate — |

## Cloud Connectors

| Method             | Path                                  | Auth                               | Module | Pagination | Errors           | Notes |
| ------------------ | ------------------------------------- | ---------------------------------- | ------ | ---------- | ---------------- | ----- |
| GET                | `/api/v1/cloud-connectors/dashboard`  | session                            | ics    | —          | problem+json     |       |
| GET, POST          | `/api/v1/cloud-connectors/executions` | admin, risk_manager, control_owner | ics    | —          | legacy `{error}` |       |
| GET                | `/api/v1/cloud-connectors/snapshots`  | session                            | ics    | —          | problem+json     |       |
| GET, POST          | `/api/v1/cloud-connectors/suites`     | admin, risk_manager                | ics    | —          | legacy `{error}` |       |
| GET, PATCH, DELETE | `/api/v1/cloud-connectors/suites/:id` | session                            | ics    | —          | legacy `{error}` |       |

## Community

| Method             | Path                                         | Auth    | Module | Pagination | Errors           | Notes |
| ------------------ | -------------------------------------------- | ------- | ------ | ---------- | ---------------- | ----- |
| GET, POST          | `/api/v1/community/contributions`            | session | —      | —          | —                |       |
| GET, PATCH, DELETE | `/api/v1/community/contributions/:id`        | session | —      | —          | legacy `{error}` |       |
| POST               | `/api/v1/community/contributions/:id/review` | admin   | —      | —          | legacy `{error}` |       |
| GET, PUT           | `/api/v1/community/edition-config`           | session | —      | —          | —                |       |

## Compliance

| Method    | Path                                           | Auth                         | Module    | Pagination    | Errors                 | Notes                                                                     |
| --------- | ---------------------------------------------- | ---------------------------- | --------- | ------------- | ---------------------- | ------------------------------------------------------------------------- |
| GET       | `/api/v1/compliance`                           | —                            | —         | —             | —                      | #NIGHT-014: /api/v1/compliance root returned 404 — only sub-routes exist. |
| GET       | `/api/v1/compliance/calendar`                  | session                      | reporting | —             | problem+json (wrapper) |                                                                           |
| GET       | `/api/v1/compliance/cci`                       | admin, risk_manager, auditor | —         | —             | —                      |                                                                           |
| GET, PUT  | `/api/v1/compliance/cci/configuration`         | admin                        | —         | —             | legacy `{error}`       |                                                                           |
| GET       | `/api/v1/compliance/cci/departments`           | admin, risk_manager, auditor | —         | —             | legacy `{error}`       |                                                                           |
| POST      | `/api/v1/compliance/cci/export-pdf`            | admin, risk_manager, auditor | —         | —             | legacy `{error}`       |                                                                           |
| GET       | `/api/v1/compliance/cci/factors`               | admin, risk_manager, auditor | —         | —             | —                      |                                                                           |
| GET       | `/api/v1/compliance/cci/history`               | admin, risk_manager, auditor | —         | —             | legacy `{error}`       |                                                                           |
| GET       | `/api/v1/compliance/coverage`                  | session                      | ics       | —             | problem+json (wrapper) | Cross-framework coverage rollup.                                          |
| GET       | `/api/v1/compliance/frameworks`                | session                      | —         | —             | problem+json (wrapper) |                                                                           |
| GET       | `/api/v1/compliance/frameworks/:code`          | session                      | —         | limit, offset | legacy `{error}`       |                                                                           |
| GET       | `/api/v1/compliance/score`                     | session                      | ics       | —             | problem+json (wrapper) | single-number compliance posture (0-100).                                 |
| GET       | `/api/v1/compliance/simulator/compare`         | session                      | ics       | —             | legacy `{error}`       |                                                                           |
| GET, POST | `/api/v1/compliance/simulator/simulations`     | session                      | ics       | —             | legacy `{error}`       |                                                                           |
| GET       | `/api/v1/compliance/simulator/simulations/:id` | session                      | ics       | —             | legacy `{error}`       |                                                                           |

## Connectors

| Method             | Path                                           | Auth                               | Module | Pagination | Errors           | Notes |
| ------------------ | ---------------------------------------------- | ---------------------------------- | ------ | ---------- | ---------------- | ----- |
| GET, POST          | `/api/v1/connectors`                           | admin, risk_manager, control_owner | ics    | —          | legacy `{error}` |       |
| GET, PATCH, DELETE | `/api/v1/connectors/:id`                       | session                            | ics    | —          | legacy `{error}` |       |
| GET                | `/api/v1/connectors/:id/artifacts`             | session                            | ics    | —          | —                |       |
| GET, POST          | `/api/v1/connectors/:id/credentials`           | admin                              | ics    | —          | legacy `{error}` |       |
| GET, POST          | `/api/v1/connectors/:id/health`                | session                            | ics    | —          | legacy `{error}` |       |
| GET, POST          | `/api/v1/connectors/:id/schedules`             | admin, risk_manager                | ics    | —          | legacy `{error}` |       |
| PATCH, DELETE      | `/api/v1/connectors/:id/schedules/:scheduleId` | admin, risk_manager                | ics    | —          | legacy `{error}` |       |
| GET                | `/api/v1/connectors/:id/test-results`          | session                            | ics    | —          | —                |       |
| POST               | `/api/v1/connectors/:id/test-run`              | admin, risk_manager, control_owner | ics    | —          | legacy `{error}` |       |
| GET                | `/api/v1/connectors/dashboard`                 | session                            | ics    | —          | —                |       |
| GET, POST          | `/api/v1/connectors/freshness-config`          | admin, risk_manager, control_owner | ics    | —          | legacy `{error}` |       |
| PATCH, DELETE      | `/api/v1/connectors/freshness-config/:id`      | admin, risk_manager, control_owner | ics    | —          | legacy `{error}` |       |
| GET                | `/api/v1/connectors/test-definitions`          | session                            | ics    | —          | —                |       |

## Contracts

| Method           | Path                                              | Auth                                                                 | Module   | Pagination | Errors           | Notes |
| ---------------- | ------------------------------------------------- | -------------------------------------------------------------------- | -------- | ---------- | ---------------- | ----- |
| GET, POST        | `/api/v1/contracts`                               | admin, risk_manager, process_owner, contract_manager, vendor_manager | contract | —          | problem+json     |       |
| GET, PUT, DELETE | `/api/v1/contracts/:id`                           | session                                                              | contract | —          | legacy `{error}` |       |
| GET, POST        | `/api/v1/contracts/:id/amendments`                | admin, risk_manager                                                  | contract | —          | legacy `{error}` |       |
| GET, POST        | `/api/v1/contracts/:id/obligations`               | admin, risk_manager, process_owner                                   | contract | —          | legacy `{error}` |       |
| PUT              | `/api/v1/contracts/:id/obligations/:obligationId` | admin, risk_manager, process_owner, control_owner                    | contract | —          | legacy `{error}` |       |
| GET, POST        | `/api/v1/contracts/:id/sla`                       | admin, risk_manager, process_owner                                   | contract | —          | legacy `{error}` |       |
| GET, POST        | `/api/v1/contracts/:id/sla/:slaId/measurements`   | admin, risk_manager, process_owner, control_owner                    | contract | —          | legacy `{error}` |       |
| PUT              | `/api/v1/contracts/:id/status`                    | admin, risk_manager, process_owner                                   | contract | —          | legacy `{error}` |       |
| GET              | `/api/v1/contracts/:id/transitions`               | session                                                              | contract | —          | legacy `{error}` |       |
| GET              | `/api/v1/contracts/dashboard`                     | session                                                              | contract | —          | —                |       |

## Control Test Campaigns

| Method    | Path                                        | Auth                         | Module | Pagination | Errors           | Notes |
| --------- | ------------------------------------------- | ---------------------------- | ------ | ---------- | ---------------- | ----- |
| GET, POST | `/api/v1/control-test-campaigns`            | admin, risk_manager, auditor | ics    | —          | legacy `{error}` |       |
| GET, PUT  | `/api/v1/control-test-campaigns/:id`        | session                      | ics    | —          | legacy `{error}` |       |
| PUT       | `/api/v1/control-test-campaigns/:id/status` | admin, risk_manager, auditor | ics    | —          | legacy `{error}` |       |

## Control Testing

| Method             | Path                                          | Auth                                                | Module | Pagination | Errors           | Notes                                                                                                       |
| ------------------ | --------------------------------------------- | --------------------------------------------------- | ------ | ---------- | ---------------- | ----------------------------------------------------------------------------------------------------------- |
| GET, POST          | `/api/v1/control-testing/checklists`          | admin, control_owner, auditor                       | —      | —          | legacy `{error}` |                                                                                                             |
| GET, PATCH         | `/api/v1/control-testing/checklists/:id`      | admin, control_owner, auditor, risk_manager         | —      | —          | legacy `{error}` |                                                                                                             |
| POST               | `/api/v1/control-testing/checklists/generate` | admin, control_owner, auditor                       | —      | —          | legacy `{error}` |                                                                                                             |
| GET                | `/api/v1/control-testing/dashboard`           | admin, control_owner, auditor, risk_manager         | —      | —          | —                |                                                                                                             |
| GET                | `/api/v1/control-testing/executions`          | admin, control_owner, auditor, risk_manager         | —      | —          | legacy `{error}` |                                                                                                             |
| GET                | `/api/v1/control-testing/executions/:id`      | admin, control_owner, auditor, risk_manager         | —      | —          | legacy `{error}` |                                                                                                             |
| GET                | `/api/v1/control-testing/learning`            | admin, control_owner, auditor                       | —      | —          | legacy `{error}` |                                                                                                             |
| GET, POST          | `/api/v1/control-testing/scripts`             | admin, control_owner, auditor                       | —      | —          | legacy `{error}` |                                                                                                             |
| GET, PATCH, DELETE | `/api/v1/control-testing/scripts/:id`         | admin, control_owner, auditor, risk_manager         | —      | —          | legacy `{error}` |                                                                                                             |
| POST               | `/api/v1/control-testing/scripts/:id/execute` | admin, control_owner, auditor                       | —      | —          | legacy `{error}` |                                                                                                             |
| POST               | `/api/v1/control-testing/scripts/generate`    | admin, control_owner, auditor                       | —      | —          | legacy `{error}` |                                                                                                             |
| GET                | `/api/v1/control-testing/test-plan-templates` | admin, risk_manager, auditor, control_owner, viewer | —      | —          | legacy `{error}` | list available templates GET /api/v1/control-testing/test-plan-templates?framework=... — filter by framewor |

## Control Tests

| Method    | Path                        | Auth    | Module | Pagination | Errors                 | Notes |
| --------- | --------------------------- | ------- | ------ | ---------- | ---------------------- | ----- |
| GET, POST | `/api/v1/control-tests`     | session | ics    | —          | problem+json (wrapper) |       |
| GET, PUT  | `/api/v1/control-tests/:id` | session | ics    | —          | legacy `{error}`       |       |

## Controls

| Method           | Path                                      | Auth                                        | Module | Pagination | Errors                 | Notes                                                                                                          |
| ---------------- | ----------------------------------------- | ------------------------------------------- | ------ | ---------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| GET, POST        | `/api/v1/controls`                        | admin, risk_manager, control_owner, auditor | ics    | —          | problem+json (wrapper) |                                                                                                                |
| GET, PUT, DELETE | `/api/v1/controls/:id`                    | session                                     | ics    | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/controls/:id/audit-impact`       | session                                     | ics    | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/controls/:id/ces`                | session                                     | ics    | —          | legacy `{error}`       |                                                                                                                |
| GET, POST        | `/api/v1/controls/:id/comments`           | session                                     | ics    | —          | —                      |                                                                                                                |
| GET              | `/api/v1/controls/:id/documents`          | session                                     | ics    | —          | —                      |                                                                                                                |
| GET              | `/api/v1/controls/:id/evidence`           | session                                     | ics    | —          | —                      | #WAVE6-CROSS-02: evidence attachments for this control. evidence is polymorphic via (entityType, entityId).    |
| GET              | `/api/v1/controls/:id/findings`           | session                                     | ics    | —          | —                      | #WAVE6-CROSS-02: findings opened against this control. finding.controlId is a direct FK so no link table neede |
| GET              | `/api/v1/controls/:id/history`            | session                                     | ics    | —          | —                      |                                                                                                                |
| GET, POST        | `/api/v1/controls/:id/risk-links`         | session                                     | ics    | —          | legacy `{error}`       |                                                                                                                |
| DELETE           | `/api/v1/controls/:id/risk-links/:linkId` | admin, risk_manager, control_owner          | ics    | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/controls/:id/risks`              | session                                     | ics    | —          | —                      | #WAVE6-CROSS-02: which risks does this control mitigate? Joins risk_control + risk. Reverse direction of /risk |
| PUT              | `/api/v1/controls/:id/status`             | admin, risk_manager, control_owner          | ics    | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/controls/:id/tests`              | session                                     | ics    | —          | —                      | #WAVE6-CROSS-02: control test runs (ToD/ToE) for this control.                                                 |
| GET              | `/api/v1/controls/:id/transitions`        | session                                     | ics    | —          | legacy `{error}`       |                                                                                                                |
| POST             | `/api/v1/controls/bulk`                   | admin, control_owner, process_owner         | ics    | —          | problem+json (wrapper) |                                                                                                                |
| GET              | `/api/v1/controls/effectiveness`          | session                                     | ics    | —          | problem+json (wrapper) | #WAVE6-CROSS-04: GET /api/v1/controls/effectiveness was 500 — caught by /controls/[id]/route.ts with id="effec |
| GET              | `/api/v1/controls/findings-summary`       | session                                     | ics    | —          | problem+json (wrapper) |                                                                                                                |
| GET              | `/api/v1/controls/rcm`                    | session                                     | ics    | —          | problem+json (wrapper) |                                                                                                                |

## Copilot

| Method             | Path                                         | Auth                                                                    | Module | Pagination | Errors           | Notes                                                                   |
| ------------------ | -------------------------------------------- | ----------------------------------------------------------------------- | ------ | ---------- | ---------------- | ----------------------------------------------------------------------- |
| GET, POST          | `/api/v1/copilot/conversations`              | admin, risk_manager, control_owner, process_owner, auditor, dpo, viewer | —      | —          | legacy `{error}` |                                                                         |
| GET, PATCH, DELETE | `/api/v1/copilot/conversations/:id`          | admin, risk_manager, control_owner, process_owner, auditor, dpo, viewer | —      | —          | legacy `{error}` |                                                                         |
| GET, PATCH         | `/api/v1/copilot/conversations/:id/actions`  | admin, risk_manager, control_owner, process_owner, auditor, dpo, viewer | —      | —          | legacy `{error}` |                                                                         |
| GET, POST          | `/api/v1/copilot/conversations/:id/messages` | admin, risk_manager, control_owner, process_owner, auditor, dpo, viewer | —      | —          | problem+json     | [ARCTOS-FULL-2026-08-31 / WP6 · S05-17, S05-21, S05-06, S05-09, S05-12] |
| POST               | `/api/v1/copilot/messages/:id/feedback`      | admin, risk_manager, control_owner, process_owner, auditor, dpo, viewer | —      | —          | legacy `{error}` |                                                                         |
| GET, POST          | `/api/v1/copilot/rag`                        | admin                                                                   | —      | —          | legacy `{error}` |                                                                         |
| GET, POST          | `/api/v1/copilot/templates`                  | admin                                                                   | —      | —          | legacy `{error}` |                                                                         |
| GET, PATCH, DELETE | `/api/v1/copilot/templates/:id`              | admin, risk_manager, control_owner, process_owner, auditor, dpo, viewer | —      | —          | legacy `{error}` |                                                                         |
| GET                | `/api/v1/copilot/usage`                      | admin                                                                   | —      | —          | legacy `{error}` |                                                                         |

## Costs

| Method    | Path                          | Auth                         | Module | Pagination | Errors           | Notes |
| --------- | ----------------------------- | ---------------------------- | ------ | ---------- | ---------------- | ----- |
| GET, POST | `/api/v1/costs`               | admin, risk_manager, auditor | —      | —          | legacy `{error}` |       |
| GET       | `/api/v1/costs/by-area`       | admin, risk_manager, auditor | —      | —          | —                |       |
| GET       | `/api/v1/costs/by-category`   | admin, risk_manager, auditor | —      | —          | —                |       |
| GET       | `/api/v1/costs/by-department` | admin, risk_manager, auditor | —      | —          | —                |       |

## Cross

| Method | Path                                | Auth                | Module | Pagination | Errors           | Notes |
| ------ | ----------------------------------- | ------------------- | ------ | ---------- | ---------------- | ----- |
| GET    | `/api/v1/cross/executive-dashboard` | session             | isms   | —          | legacy `{error}` |       |
| GET    | `/api/v1/cross/findings`            | session             | isms   | —          | —                |       |
| POST   | `/api/v1/cross/risk-sync`           | admin, risk_manager | erm    | —          | legacy `{error}` |       |

## Dashboard

| Method | Path                                  | Auth    | Module | Pagination | Errors | Notes                                                         |
| ------ | ------------------------------------- | ------- | ------ | ---------- | ------ | ------------------------------------------------------------- |
| GET    | `/api/v1/dashboard/audit-kpis`        | session | audit  | —          | —      | Audit Overhaul: dashboard KPI tiles for the Audit module.     |
| GET    | `/api/v1/dashboard/audit-quick-stats` | session | audit  | —          | —      |                                                               |
| GET    | `/api/v1/dashboard/bpm-kpis`          | session | bpm    | —          | —      | BPM Overhaul Phase 2: Dashboard KPI tiles for the BPM module. |
| GET    | `/api/v1/dashboard/dpms-kpis`         | session | dpms   | —          | —      | DPMS Overhaul: dashboard KPI tiles.                           |
| GET    | `/api/v1/dashboard/tprm-kpis`         | session | tprm   | —          | —      | TPRM Overhaul: dashboard KPI tiles.                           |

## Dashboards

| Method           | Path                                       | Auth    | Module | Pagination | Errors           | Notes |
| ---------------- | ------------------------------------------ | ------- | ------ | ---------- | ---------------- | ----- |
| GET, POST        | `/api/v1/dashboards`                       | session | —      | —          | legacy `{error}` |       |
| GET, PUT, DELETE | `/api/v1/dashboards/:id`                   | session | —      | —          | legacy `{error}` |       |
| GET              | `/api/v1/dashboards/:id/data`              | session | —      | —          | legacy `{error}` |       |
| POST             | `/api/v1/dashboards/:id/duplicate`         | session | —      | —          | legacy `{error}` |       |
| POST             | `/api/v1/dashboards/:id/export-pdf`        | session | —      | —          | legacy `{error}` |       |
| PUT              | `/api/v1/dashboards/:id/favorite`          | session | —      | —          | legacy `{error}` |       |
| POST             | `/api/v1/dashboards/:id/widgets`           | session | —      | —          | legacy `{error}` |       |
| PUT, DELETE      | `/api/v1/dashboards/:id/widgets/:widgetId` | session | —      | —          | legacy `{error}` |       |
| GET              | `/api/v1/dashboards/widget-definitions`    | session | —      | —          | —                |       |

## Data Sovereignty

| Method             | Path                                           | Auth    | Module | Pagination | Errors           | Notes |
| ------------------ | ---------------------------------------------- | ------- | ------ | ---------- | ---------------- | ----- |
| GET                | `/api/v1/data-sovereignty/audit-log`           | admin   | —      | —          | —                |       |
| GET, POST          | `/api/v1/data-sovereignty/regions`             | session | —      | —          | —                |       |
| GET, PATCH         | `/api/v1/data-sovereignty/regions/:id`         | session | —      | —          | legacy `{error}` |       |
| GET, POST          | `/api/v1/data-sovereignty/replications`        | session | —      | —          | —                |       |
| GET, PATCH         | `/api/v1/data-sovereignty/replications/:id`    | session | —      | —          | legacy `{error}` |       |
| GET, POST          | `/api/v1/data-sovereignty/residency-rules`     | session | —      | —          | —                |       |
| GET, PATCH, DELETE | `/api/v1/data-sovereignty/residency-rules/:id` | session | —      | —          | legacy `{error}` |       |
| GET, PUT           | `/api/v1/data-sovereignty/tenant-config`       | session | —      | —          | —                |       |

## Dd Sessions

| Method | Path                              | Auth                | Module | Pagination | Errors           | Notes |
| ------ | --------------------------------- | ------------------- | ------ | ---------- | ---------------- | ----- |
| GET    | `/api/v1/dd-sessions/:id`         | session             | tprm   | —          | legacy `{error}` |       |
| PUT    | `/api/v1/dd-sessions/:id/extend`  | admin, risk_manager | tprm   | —          | legacy `{error}` |       |
| GET    | `/api/v1/dd-sessions/:id/results` | session             | tprm   | —          | legacy `{error}` |       |
| DELETE | `/api/v1/dd-sessions/:id/revoke`  | admin, risk_manager | tprm   | —          | legacy `{error}` |       |

## Developer Apps

| Method             | Path                         | Auth  | Module | Pagination | Errors           | Notes |
| ------------------ | ---------------------------- | ----- | ------ | ---------- | ---------------- | ----- |
| GET, POST          | `/api/v1/developer-apps`     | admin | —      | —          | legacy `{error}` |       |
| GET, PATCH, DELETE | `/api/v1/developer-apps/:id` | admin | —      | —          | legacy `{error}` |       |

## Devops Connectors

| Method             | Path                                     | Auth                | Module | Pagination | Errors           | Notes |
| ------------------ | ---------------------------------------- | ------------------- | ------ | ---------- | ---------------- | ----- |
| GET, POST          | `/api/v1/devops-connectors/configs`      | admin, risk_manager | ics    | —          | legacy `{error}` |       |
| GET, PATCH, DELETE | `/api/v1/devops-connectors/configs/:id`  | session             | ics    | —          | legacy `{error}` |       |
| GET                | `/api/v1/devops-connectors/dashboard`    | session             | ics    | —          | —                |       |
| GET                | `/api/v1/devops-connectors/infra-checks` | session             | ics    | —          | problem+json     |       |
| POST               | `/api/v1/devops-connectors/scan`         | admin, risk_manager | ics    | —          | legacy `{error}` |       |
| GET                | `/api/v1/devops-connectors/test-results` | session             | ics    | —          | problem+json     |       |

## Dmn

| Method    | Path                         | Auth                         | Module | Pagination    | Errors           | Notes |
| --------- | ---------------------------- | ---------------------------- | ------ | ------------- | ---------------- | ----- |
| GET, POST | `/api/v1/dmn`                | admin, process_owner         | bpm    | limit, offset | legacy `{error}` |       |
| GET, PUT  | `/api/v1/dmn/:id`            | admin, process_owner, viewer | bpm    | —             | legacy `{error}` |       |
| POST      | `/api/v1/dmn/:id/batch-test` | admin, process_owner         | bpm    | —             | legacy `{error}` |       |
| POST      | `/api/v1/dmn/:id/evaluate`   | admin, process_owner, viewer | bpm    | —             | legacy `{error}` |       |

## Dms

| Method    | Path                    | Auth | Module | Pagination | Errors | Notes                                                   |
| --------- | ----------------------- | ---- | ------ | ---------- | ------ | ------------------------------------------------------- |
| GET, POST | `/api/v1/dms/documents` | —    | —      | —          | —      | /api/v1/dms/documents — Canonical DMS path (Wave-21-B5) |

## Documents

| Method           | Path                                                  | Auth                                                   | Module | Pagination | Errors           | Notes                                                                                                         |
| ---------------- | ----------------------------------------------------- | ------------------------------------------------------ | ------ | ---------- | ---------------- | ------------------------------------------------------------------------------------------------------------- |
| GET, POST        | `/api/v1/documents`                                   | admin, risk_manager, control_owner, dpo, process_owner | dms    | —          | legacy `{error}` |                                                                                                               |
| GET, PUT, DELETE | `/api/v1/documents/:id`                               | session                                                | dms    | —          | legacy `{error}` |                                                                                                               |
| POST             | `/api/v1/documents/:id/acknowledge`                   | session                                                | dms    | —          | legacy `{error}` |                                                                                                               |
| GET              | `/api/v1/documents/:id/acknowledgment-status`         | session                                                | dms    | —          | legacy `{error}` |                                                                                                               |
| GET              | `/api/v1/documents/:id/acknowledgments`               | session                                                | dms    | —          | legacy `{error}` |                                                                                                               |
| GET, POST        | `/api/v1/documents/:id/approval-steps`                | session                                                | dms    | —          | legacy `{error}` |                                                                                                               |
| POST             | `/api/v1/documents/:id/approval-steps/:stepId/decide` | admin, risk_manager, control_owner, dpo, process_owner | dms    | —          | legacy `{error}` |                                                                                                               |
| GET              | `/api/v1/documents/:id/download`                      | session                                                | dms    | —          | legacy `{error}` |                                                                                                               |
| GET, POST        | `/api/v1/documents/:id/entity-links`                  | session                                                | dms    | —          | legacy `{error}` |                                                                                                               |
| DELETE           | `/api/v1/documents/:id/entity-links/:linkId`          | admin, risk_manager, control_owner, dpo, process_owner | dms    | —          | legacy `{error}` |                                                                                                               |
| DELETE           | `/api/v1/documents/:id/erase`                         | admin                                                  | dms    | —          | legacy `{error}` |                                                                                                               |
| GET              | `/api/v1/documents/:id/files`                         | session                                                | dms    | —          | legacy `{error}` |                                                                                                               |
| DELETE           | `/api/v1/documents/:id/files/:fileId`                 | admin, risk_manager, control_owner, dpo, process_owner | dms    | —          | legacy `{error}` |                                                                                                               |
| GET              | `/api/v1/documents/:id/files/:fileId/download`        | session                                                | dms    | —          | legacy `{error}` |                                                                                                               |
| POST             | `/api/v1/documents/:id/send-reminder`                 | admin, risk_manager, dpo                               | dms    | —          | legacy `{error}` |                                                                                                               |
| GET, POST        | `/api/v1/documents/:id/signature-requests`            | admin, risk_manager, control_owner, dpo, process_owner | dms    | —          | legacy `{error}` | W21-DMS-MULTISIGN-01: Multi-signer signature requests per document.                                           |
| PUT              | `/api/v1/documents/:id/status`                        | admin, risk_manager, dpo, process_owner                | dms    | —          | legacy `{error}` |                                                                                                               |
| POST             | `/api/v1/documents/:id/upload`                        | admin, risk_manager, control_owner, dpo, process_owner | dms    | —          | legacy `{error}` |                                                                                                               |
| GET              | `/api/v1/documents/:id/verify-integrity`              | session                                                | dms    | —          | legacy `{error}` |                                                                                                               |
| GET              | `/api/v1/documents/:id/versions`                      | session                                                | dms    | —          | legacy `{error}` |                                                                                                               |
| GET              | `/api/v1/documents/:id/versions/:versionId`           | session                                                | dms    | —          | legacy `{error}` |                                                                                                               |
| POST             | `/api/v1/documents/:id/versions/:versionId/restore`   | admin, risk_manager, control_owner, dpo, process_owner | dms    | —          | legacy `{error}` |                                                                                                               |
| GET              | `/api/v1/documents/:id/versions/at`                   | session                                                | dms    | —          | legacy `{error}` |                                                                                                               |
| GET              | `/api/v1/documents/compliance`                        | session                                                | dms    | —          | —                |                                                                                                               |
| GET              | `/api/v1/documents/my-pending-signatures`             | session                                                | dms    | —          | problem+json     | W21-DMS-MULTISIGN-01: "My pending signatures" — every open signer slot of the current user across all pending |

## Dora

| Method             | Path                                   | Auth                                 | Module | Pagination  | Errors                 | Notes |
| ------------------ | -------------------------------------- | ------------------------------------ | ------ | ----------- | ---------------------- | ----- |
| GET                | `/api/v1/dora/critical-vendors`        | session                              | isms   | —           | problem+json (wrapper) |       |
| GET                | `/api/v1/dora/dashboard`               | admin, risk_manager, auditor, viewer | —      | —           | —                      |       |
| GET, POST          | `/api/v1/dora/ict-incidents`           | admin, risk_manager                  | —      | —           | legacy `{error}`       |       |
| GET, PATCH         | `/api/v1/dora/ict-incidents/:id`       | admin, risk_manager, auditor, viewer | —      | —           | legacy `{error}`       |       |
| GET, POST          | `/api/v1/dora/ict-providers`           | admin, risk_manager                  | —      | —           | legacy `{error}`       |       |
| GET, PATCH, DELETE | `/api/v1/dora/ict-providers/:id`       | admin, risk_manager, auditor, viewer | —      | —           | legacy `{error}`       |       |
| GET, POST          | `/api/v1/dora/ict-risks`               | admin, risk_manager                  | erm    | —           | legacy `{error}`       |       |
| GET, PATCH, DELETE | `/api/v1/dora/ict-risks/:id`           | admin, risk_manager, auditor, viewer | erm    | —           | legacy `{error}`       |       |
| GET, POST          | `/api/v1/dora/information-sharing`     | admin, risk_manager                  | —      | limit, page | legacy `{error}`       |       |
| GET, PATCH         | `/api/v1/dora/information-sharing/:id` | admin, risk_manager, auditor, viewer | —      | —           | legacy `{error}`       |       |
| GET, POST          | `/api/v1/dora/nis2-cross-refs`         | admin, risk_manager                  | —      | —           | legacy `{error}`       |       |
| GET, PATCH         | `/api/v1/dora/nis2-cross-refs/:id`     | admin, risk_manager, auditor, viewer | —      | —           | legacy `{error}`       |       |
| GET, POST          | `/api/v1/dora/tlpt-plans`              | admin, risk_manager                  | —      | —           | legacy `{error}`       |       |
| GET, PATCH, DELETE | `/api/v1/dora/tlpt-plans/:id`          | admin, risk_manager, auditor, viewer | —      | —           | legacy `{error}`       |       |

## Dpms

| Method                 | Path                                                | Auth                                    | Module | Pagination | Errors                 | Notes                                                                                                          |
| ---------------------- | --------------------------------------------------- | --------------------------------------- | ------ | ---------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| GET                    | `/api/v1/dpms/annual-report/:year`                  | admin, dpo                              | dpms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/dpms/annual-report/:year/pdf`              | admin, dpo                              | dpms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/dpms/audit-log-tombstone`                  | admin, dpo                              | —      | —          | legacy `{error}`       |                                                                                                                |
| GET, POST              | `/api/v1/dpms/breaches`                             | admin, dpo                              | dpms   | —          | legacy `{error}`       |                                                                                                                |
| GET, PUT               | `/api/v1/dpms/breaches/:id`                         | session                                 | dpms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/dpms/breaches/:id/close`                   | admin, dpo                              | dpms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/dpms/breaches/:id/deadline`                | session                                 | dpms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/dpms/breaches/:id/dpa-notify`              | admin, dpo                              | dpms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/dpms/breaches/:id/transition`              | admin, dpo                              | dpms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/dpms/consent-records`                      | admin, dpo                              | dpms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/dpms/consent-records/search`               | admin, dpo                              | dpms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST              | `/api/v1/dpms/consent-types`                        | session                                 | dpms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/dpms/country-risk-profiles`                | session                                 | dpms   | —          | —                      |                                                                                                                |
| GET                    | `/api/v1/dpms/dashboard`                            | session                                 | dpms   | —          | —                      |                                                                                                                |
| GET                    | `/api/v1/dpms/data-breach/:id/72h-status`           | session                                 | dpms   | —          | legacy `{error}`       | DPMS Overhaul: GDPR Art. 33 72h notification deadline tracker.                                                 |
| POST                   | `/api/v1/dpms/data-breach/:id/notification-pack`    | admin, dpo, compliance_officer          | dpms   | —          | legacy `{error}`       | DPMS Overhaul: Authority-ready breach notification pack (ZIP).                                                 |
| GET                    | `/api/v1/dpms/deadline-monitor`                     | session                                 | dpms   | —          | —                      |                                                                                                                |
| GET                    | `/api/v1/dpms/deadline-monitor/pdf`                 | session                                 | dpms   | —          | —                      |                                                                                                                |
| GET, POST              | `/api/v1/dpms/deletion-requests`                    | session                                 | dpms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST              | `/api/v1/dpms/dpia`                                 | admin, dpo                              | dpms   | —          | problem+json (wrapper) |                                                                                                                |
| GET, PUT               | `/api/v1/dpms/dpia/:id`                             | session                                 | dpms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/dpms/dpia/:id/ai/draft-measures`           | admin, dpo                              | dpms   | —          | legacy `{error}`       | DPMS Overhaul: AI-draft mitigation measures for identified DPIA risks.                                         |
| GET                    | `/api/v1/dpms/dpia/:id/export-pdf`                  | admin, dpo                              | dpms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST              | `/api/v1/dpms/dpia/:id/measures`                    | admin, dpo                              | dpms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST              | `/api/v1/dpms/dpia/:id/risks`                       | admin, dpo                              | dpms   | —          | legacy `{error}`       |                                                                                                                |
| PATCH                  | `/api/v1/dpms/dpia/:id/risks/:riskId/numeric-score` | admin, dpo                              | dpms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/dpms/dpia/:id/sign-off`                    | admin, dpo                              | dpms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/dpms/dpia/:id/transition`                  | admin, dpo, risk_manager                | dpms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/dpms/dpia/:id/transitions`                 | session                                 | dpms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/dpms/dpia/:id/transitions/blockers`        | session                                 | dpms   | —          | legacy `{error}`       | DPMS Overhaul: discovery — what gates block the next DPIA transition?                                          |
| GET, POST              | `/api/v1/dpms/dsr`                                  | admin, dpo                              | dpms   | —          | problem+json           |                                                                                                                |
| GET, PUT               | `/api/v1/dpms/dsr/:id`                              | session                                 | dpms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST              | `/api/v1/dpms/dsr/:id/activity`                     | admin, dpo                              | dpms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/dpms/dsr/:id/close`                        | admin, dpo                              | dpms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST              | `/api/v1/dpms/dsr/:id/collect`                      | admin, dpo                              | dpms   | —          | legacy `{error}`       | Art. 15 / Art. 20: Datenbestand zur antragstellenden Person                                                    |
| GET                    | `/api/v1/dpms/dsr/:id/deadline`                     | session                                 | dpms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/dpms/dsr/:id/erase`                        | admin, dpo                              | dpms   | —          | legacy `{error}`       | Art. 17: Löschung ausführen                                                                                    |
| POST                   | `/api/v1/dpms/dsr/:id/process`                      | admin, dpo                              | dpms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/dpms/dsr/:id/respond`                      | admin, dpo                              | dpms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/dpms/dsr/:id/transition`                   | admin, dpo                              | dpms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/dpms/dsr/:id/transitions`                  | session                                 | dpms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/dpms/dsr/:id/verify`                       | admin, dpo                              | dpms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/dpms/dsr/sla-status`                       | session                                 | dpms   | —          | —                      | DPMS Overhaul: DSR SLA status (Art. 12(3) — 30 days).                                                          |
| GET, POST              | `/api/v1/dpms/erm-sync`                             | admin, dpo, risk_manager                | dpms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST              | `/api/v1/dpms/pbd-assessments`                      | session                                 | dpms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST              | `/api/v1/dpms/processor-agreements`                 | session                                 | dpms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST              | `/api/v1/dpms/retention-schedules`                  | session                                 | dpms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST              | `/api/v1/dpms/ropa`                                 | admin, dpo                              | dpms   | —          | problem+json (wrapper) |                                                                                                                |
| GET, PUT, DELETE       | `/api/v1/dpms/ropa/:id`                             | session                                 | dpms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/dpms/ropa/:id/ai/draft-fields`             | admin, dpo                              | dpms   | —          | legacy `{error}`       | DPMS Overhaul: AI-draft missing ROPA fields.                                                                   |
| POST                   | `/api/v1/dpms/ropa/:id/dpia-check`                  | admin, dpo, risk_manager                | dpms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/dpms/ropa/:id/review`                      | admin, dpo                              | dpms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/dpms/ropa/:id/transition`                  | admin, dpo, risk_manager                | dpms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/dpms/ropa/export`                          | session                                 | dpms   | —          | problem+json           |                                                                                                                |
| POST                   | `/api/v1/dpms/ropa/from-process`                    | admin, dpo, process_owner, risk_manager | dpms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/dpms/templates`                            | session                                 | dpms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST              | `/api/v1/dpms/tia`                                  | admin, dpo                              | dpms   | —          | legacy `{error}`       |                                                                                                                |
| GET, PUT               | `/api/v1/dpms/tia/:id`                              | session                                 | dpms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST, PUT, DELETE | `/api/v1/dpms/transfer-impact-assessments`          | —                                       | —      | —          | —                      | #NIGHT-013: /api/v1/dpms/transfer-impact-assessments → 308 to /tia. Wave 4 added the UI redirect (page.tsx); t |

## Eam

| Method                        | Path                                                           | Auth                                       | Module | Pagination     | Errors                 | Notes                                                                                                         |
| ----------------------------- | -------------------------------------------------------------- | ------------------------------------------ | ------ | -------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| GET, PUT                      | `/api/v1/eam/ai/config`                                        | admin                                      | eam    | —              | legacy `{error}`       | [ARCTOS-FULL-2026-08-31 / WP6 · S05-13] — siehe _shared/config.ts.                                            |
| GET                           | `/api/v1/eam/ai/config/status`                                 | admin, risk_manager, viewer                | eam    | —              | —                      | [ARCTOS-FULL-2026-08-31 / WP6 · S05-13] — Entschlüsselung über den gemeinsamen Helfer statt `Buffer.from(..., |
| POST                          | `/api/v1/eam/ai/config/validate`                               | admin                                      | eam    | —              | legacy `{error}`       | [ARCTOS-FULL-2026-08-31 / WP6 · S05-13] „Validierung" hiess: `valid = !!decrypted.apiKey && length > 10`. Das |
| POST                          | `/api/v1/eam/ai/generate-description`                          | admin, risk_manager                        | eam    | —              | legacy `{error}`       | Generate description for entity                                                                               |
| POST                          | `/api/v1/eam/ai/generate-suggestions`                          | admin, risk_manager                        | eam    | —              | legacy `{error}`       | [ARCTOS-FULL-2026-08-31 / WP6 · S05-13.4, S05-06, S05-09, S05-10, S05-12]                                     |
| GET, PUT                      | `/api/v1/eam/ai/prompts`                                       | admin                                      | eam    | —              | legacy `{error}`       |                                                                                                               |
| POST                          | `/api/v1/eam/ai/translate`                                     | admin, risk_manager                        | eam    | —              | legacy `{error}`       | [ARCTOS-FULL-2026-08-31 / WP6 · S05-13.4, S05-06, S05-09, S05-10, S05-12]                                     |
| GET, POST, PUT, PATCH, DELETE | `/api/v1/eam/applications`                                     | admin, viewer                              | eam    | limit          | problem+json           |                                                                                                               |
| GET, PUT                      | `/api/v1/eam/applications/:id/portfolio`                       | admin, viewer                              | eam    | —              | legacy `{error}`       |                                                                                                               |
| GET                           | `/api/v1/eam/applications/approaching-eol`                     | admin, viewer                              | eam    | —              | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/applications/lifecycle-timeline`                  | admin, viewer                              | eam    | —              | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/applications/portfolio-quadrant`                  | admin, viewer                              | eam    | —              | —                      |                                                                                                               |
| PUT                           | `/api/v1/eam/assessment`                                       | admin, risk_manager                        | eam    | —              | legacy `{error}`       |                                                                                                               |
| GET                           | `/api/v1/eam/assessment-history`                               | admin, risk_manager, viewer                | eam    | —              | legacy `{error}`       |                                                                                                               |
| GET                           | `/api/v1/eam/bi-export`                                        | admin, risk_manager, viewer                | eam    | —              | legacy `{error}`       |                                                                                                               |
| GET, POST, DELETE             | `/api/v1/eam/bpmn-placements`                                  | admin, risk_manager, process_owner, viewer | eam    | —              | legacy `{error}`       |                                                                                                               |
| POST                          | `/api/v1/eam/bulk-assessment`                                  | admin, risk_manager                        | eam    | —              | legacy `{error}`       |                                                                                                               |
| GET, POST, PUT, DELETE        | `/api/v1/eam/business-contexts`                                | admin, risk_manager, viewer                | eam    | —              | legacy `{error}`       |                                                                                                               |
| GET, POST                     | `/api/v1/eam/capabilities`                                     | admin, viewer                              | eam    | —              | legacy `{error}`       |                                                                                                               |
| PUT                           | `/api/v1/eam/capabilities/:id`                                 | admin                                      | eam    | —              | legacy `{error}`       |                                                                                                               |
| PUT                           | `/api/v1/eam/capabilities/assessment`                          | admin, risk_manager                        | eam    | —              | legacy `{error}`       |                                                                                                               |
| GET                           | `/api/v1/eam/capabilities/lifecycle-view`                      | admin, risk_manager, viewer                | eam    | —              | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/catalog`                                          | admin, risk_manager, viewer                | eam    | page, pageSize | —                      |                                                                                                               |
| GET, POST                     | `/api/v1/eam/change-requests`                                  | admin                                      | eam    | —              | legacy `{error}`       |                                                                                                               |
| POST                          | `/api/v1/eam/change-requests/:id/decide`                       | admin                                      | eam    | —              | legacy `{error}`       |                                                                                                               |
| POST                          | `/api/v1/eam/change-requests/:id/submit`                       | admin                                      | eam    | —              | legacy `{error}`       |                                                                                                               |
| POST                          | `/api/v1/eam/change-requests/:id/vote`                         | admin                                      | eam    | —              | legacy `{error}`       |                                                                                                               |
| POST                          | `/api/v1/eam/chat`                                             | admin, risk_manager, viewer                | eam    | —              | legacy `{error}`       |                                                                                                               |
| GET                           | `/api/v1/eam/cloud/catalog`                                    | admin, viewer                              | eam    | —              | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/context-diagram`                                  | admin, risk_manager, viewer                | eam    | —              | legacy `{error}`       |                                                                                                               |
| GET, POST, PUT, DELETE        | `/api/v1/eam/contexts`                                         | admin, risk_manager, viewer                | eam    | —              | legacy `{error}`       |                                                                                                               |
| GET, PUT                      | `/api/v1/eam/contexts/attributes`                              | admin, risk_manager, viewer                | eam    | —              | legacy `{error}`       |                                                                                                               |
| GET                           | `/api/v1/eam/contexts/compare`                                 | admin, risk_manager, viewer                | eam    | —              | legacy `{error}`       |                                                                                                               |
| POST                          | `/api/v1/eam/contexts/promote`                                 | admin                                      | eam    | —              | legacy `{error}`       |                                                                                                               |
| GET                           | `/api/v1/eam/dashboards/business-alignment`                    | admin, risk_manager, viewer                | eam    | —              | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/dashboards/cost-management`                       | admin, risk_manager, viewer                | eam    | —              | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/dashboards/cost-management/treemap-apps`          | admin, risk_manager, viewer                | eam    | —              | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/dashboards/cost-management/treemap-infra`         | admin, risk_manager, viewer                | eam    | —              | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/dashboards/cost-management/trend`                 | admin, risk_manager, viewer                | eam    | —              | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/dashboards/portfolio-optimization`                | admin, risk_manager, viewer                | eam    | —              | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/dashboards/portfolio-optimization/health`         | admin, risk_manager, viewer                | eam    | —              | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/dashboards/portfolio-optimization/six-r-overview` | admin, risk_manager, viewer                | eam    | —              | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/dashboards/portfolio-optimization/table`          | admin, risk_manager, viewer                | eam    | limit          | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/dashboards/risk-management`                       | admin, risk_manager, viewer                | eam    | —              | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/dashboards/risk-management/per-app`               | admin, risk_manager, viewer                | eam    | —              | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/dashboards/technical-alignment`                   | admin, risk_manager, viewer                | eam    | —              | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/dashboards/vulnerability-monitor`                 | admin, risk_manager, viewer                | eam    | —              | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/dashboards/vulnerability-monitor/overlay`         | admin, risk_manager, viewer                | eam    | —              | —                      |                                                                                                               |
| GET, POST                     | `/api/v1/eam/data-flows`                                       | admin                                      | eam    | limit          | legacy `{error}`       |                                                                                                               |
| GET                           | `/api/v1/eam/data-flows/cross-border`                          | admin, viewer                              | eam    | —              | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/data-flows/personal-data`                         | admin, viewer                              | eam    | —              | —                      |                                                                                                               |
| GET, POST                     | `/api/v1/eam/data-objects`                                     | admin, risk_manager, viewer                | eam    | —              | legacy `{error}`       |                                                                                                               |
| POST, PUT                     | `/api/v1/eam/data-objects/crud-mappings`                       | admin, risk_manager                        | eam    | —              | legacy `{error}`       |                                                                                                               |
| GET                           | `/api/v1/eam/data-objects/crud-matrix`                         | admin, risk_manager, viewer                | eam    | —              | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/data-objects/lineage`                             | admin, risk_manager, viewer                | eam    | —              | legacy `{error}`       |                                                                                                               |
| GET                           | `/api/v1/eam/dependencies`                                     | session                                    | eam    | —              | problem+json (wrapper) | architecture-element dependency rollup.                                                                       |
| GET                           | `/api/v1/eam/dependency-chain/:id`                             | admin, viewer                              | eam    | —              | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/diagram`                                          | admin, viewer                              | eam    | —              | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/diagrams/data-objects`                            | admin, risk_manager, viewer                | eam    | —              | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/diagrams/it-components`                           | admin, risk_manager, viewer                | eam    | —              | —                      |                                                                                                               |
| GET, POST                     | `/api/v1/eam/elements`                                         | admin                                      | eam    | limit, offset  | legacy `{error}`       |                                                                                                               |
| GET, PUT, DELETE              | `/api/v1/eam/elements/:id`                                     | admin, viewer                              | eam    | —              | legacy `{error}`       |                                                                                                               |
| POST                          | `/api/v1/eam/governance/bulk`                                  | admin                                      | eam    | —              | legacy `{error}`       |                                                                                                               |
| POST                          | `/api/v1/eam/governance/publish`                               | admin, risk_manager                        | eam    | —              | legacy `{error}`       |                                                                                                               |
| PUT                           | `/api/v1/eam/governance/roles`                                 | admin                                      | eam    | —              | legacy `{error}`       |                                                                                                               |
| GET                           | `/api/v1/eam/health-score`                                     | admin, viewer                              | eam    | —              | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/health-score/trend`                               | admin, viewer                              | eam    | —              | —                      |                                                                                                               |
| GET, PUT                      | `/api/v1/eam/homepage`                                         | admin, risk_manager, viewer                | eam    | —              | legacy `{error}`       |                                                                                                               |
| GET                           | `/api/v1/eam/insight-grid`                                     | admin, risk_manager, viewer                | eam    | —              | —                      |                                                                                                               |
| GET, POST, DELETE             | `/api/v1/eam/keywords`                                         | admin, risk_manager, viewer                | eam    | —              | legacy `{error}`       |                                                                                                               |
| GET, POST, PUT, DELETE        | `/api/v1/eam/org-units`                                        | admin, risk_manager, viewer                | eam    | —              | legacy `{error}`       |                                                                                                               |
| GET                           | `/api/v1/eam/org-units/application-matrix`                     | admin, risk_manager, viewer                | eam    | —              | —                      |                                                                                                               |
| POST                          | `/api/v1/eam/relationships`                                    | admin                                      | eam    | —              | legacy `{error}`       |                                                                                                               |
| DELETE                        | `/api/v1/eam/relationships/:id`                                | admin                                      | eam    | —              | legacy `{error}`       |                                                                                                               |
| GET                           | `/api/v1/eam/roadmap`                                          | admin, risk_manager, viewer                | eam    | —              | —                      |                                                                                                               |
| GET, POST                     | `/api/v1/eam/rules`                                            | admin                                      | eam    | —              | legacy `{error}`       |                                                                                                               |
| GET                           | `/api/v1/eam/spof`                                             | admin, viewer                              | eam    | —              | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/suggestions`                                      | admin, risk_manager, viewer                | eam    | —              | —                      |                                                                                                               |
| GET, POST                     | `/api/v1/eam/technologies`                                     | admin                                      | eam    | —              | legacy `{error}`       |                                                                                                               |
| GET                           | `/api/v1/eam/technologies/hold-with-usage`                     | admin, viewer                              | eam    | —              | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/technologies/radar`                               | admin, viewer                              | eam    | —              | —                      |                                                                                                               |
| GET                           | `/api/v1/eam/violations`                                       | admin, viewer                              | eam    | —              | —                      |                                                                                                               |

## Entity Documents

| Method            | Path                       | Auth    | Module | Pagination | Errors           | Notes |
| ----------------- | -------------------------- | ------- | ------ | ---------- | ---------------- | ----- |
| GET, POST, DELETE | `/api/v1/entity-documents` | session | —      | —          | legacy `{error}` |       |

## Erm

| Method             | Path                                        | Auth                                                                                 | Module | Pagination | Errors                 | Notes |
| ------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------ | ------ | ---------- | ---------------------- | ----- |
| GET, PUT           | `/api/v1/erm/bowtie/:riskId`                | session                                                                              | erm    | —          | legacy `{error}`       |       |
| GET                | `/api/v1/erm/dashboards`                    | admin, risk_manager, control_owner, process_owner, auditor, viewer                   | erm    | —          | —                      |       |
| GET, POST          | `/api/v1/erm/emerging-risks`                | session                                                                              | erm    | —          | legacy `{error}`       |       |
| GET                | `/api/v1/erm/fair/aggregate`                | admin, risk_manager, auditor, viewer                                                 | erm    | —          | —                      |       |
| GET                | `/api/v1/erm/fair/compare`                  | admin, risk_manager, auditor, viewer                                                 | erm    | —          | legacy `{error}`       |       |
| GET, PUT           | `/api/v1/erm/fair/methodology`              | admin, risk_manager, auditor, viewer                                                 | erm    | —          | legacy `{error}`       |       |
| GET                | `/api/v1/erm/fair/top-risks`                | admin, risk_manager, auditor, viewer                                                 | erm    | limit      | —                      |       |
| GET, POST          | `/api/v1/erm/interconnections`              | session                                                                              | erm    | —          | legacy `{error}`       |       |
| GET                | `/api/v1/erm/kpi-cards`                     | admin, risk_manager, control_owner, process_owner, auditor, viewer                   | erm    | —          | —                      |       |
| GET, POST          | `/api/v1/erm/management-summary`            | admin, risk_manager, auditor, ciso, compliance_officer, process_owner, control_owner | erm    | —          | legacy `{error}`       |       |
| GET                | `/api/v1/erm/maturity`                      | session                                                                              | —      | —          | problem+json (wrapper) |       |
| GET                | `/api/v1/erm/my-todos`                      | admin, risk_manager, control_owner, process_owner                                    | erm    | —          | —                      |       |
| GET                | `/api/v1/erm/predictions`                   | session                                                                              | erm    | —          | —                      |       |
| GET                | `/api/v1/erm/predictions/:riskId`           | session                                                                              | erm    | —          | legacy `{error}`       |       |
| GET                | `/api/v1/erm/predictions/model-info`        | session                                                                              | erm    | —          | —                      |       |
| POST               | `/api/v1/erm/predictions/train`             | session                                                                              | erm    | —          | legacy `{error}`       |       |
| GET                | `/api/v1/erm/propagation/heatmap`           | session                                                                              | erm    | —          | —                      |       |
| GET, POST          | `/api/v1/erm/propagation/relationships`     | session                                                                              | erm    | —          | legacy `{error}`       |       |
| GET, PATCH, DELETE | `/api/v1/erm/propagation/relationships/:id` | session                                                                              | erm    | —          | legacy `{error}`       |       |
| POST               | `/api/v1/erm/propagation/simulate`          | session                                                                              | erm    | —          | legacy `{error}`       |       |
| POST               | `/api/v1/erm/residual/recompute`            | admin, risk_manager                                                                  | —      | —          | —                      |       |
| GET, POST          | `/api/v1/erm/risk-appetite`                 | admin, risk_manager                                                                  | erm    | —          | legacy `{error}`       |       |
| PUT, DELETE        | `/api/v1/erm/risk-appetite/:id`             | admin                                                                                | erm    | —          | legacy `{error}`       |       |
| GET                | `/api/v1/erm/risk-appetite/breaches`        | admin, risk_manager                                                                  | erm    | —          | —                      |       |
| GET                | `/api/v1/erm/risk-appetite/dashboard`       | admin, risk_manager                                                                  | erm    | —          | —                      |       |
| GET, POST          | `/api/v1/erm/risk-events`                   | session                                                                              | erm    | —          | legacy `{error}`       |       |
| GET, PUT           | `/api/v1/erm/risks/:id/fair`                | admin, risk_manager, auditor, viewer                                                 | erm    | —          | legacy `{error}`       |       |
| GET                | `/api/v1/erm/risks/:id/fair/results`        | admin, risk_manager, auditor, viewer                                                 | erm    | —          | legacy `{error}`       |       |
| POST               | `/api/v1/erm/risks/:id/fair/simulate`       | admin, risk_manager                                                                  | erm    | —          | legacy `{error}`       |       |

## Esg

| Method             | Path                                     | Auth                                                               | Module | Pagination | Errors                 | Notes      |
| ------------------ | ---------------------------------------- | ------------------------------------------------------------------ | ------ | ---------- | ---------------------- | ---------- |
| GET                | `/api/v1/esg/carbon`                     | admin, risk_manager, esg_manager, esg_contributor, process_owner   | esg    | —          | —                      |            |
| GET, POST          | `/api/v1/esg/carbon/sources`             | admin, risk_manager, esg_manager, esg_contributor, process_owner   | esg    | —          | legacy `{error}`       |            |
| GET, POST          | `/api/v1/esg/climate-scenarios`          | admin, risk_manager, esg_manager, esg_contributor, auditor, viewer | esg    | —          | legacy `{error}`       |            |
| GET, PATCH, DELETE | `/api/v1/esg/climate-scenarios/:id`      | admin, risk_manager, esg_manager, esg_contributor, auditor, viewer | esg    | —          | legacy `{error}`       |            |
| GET                | `/api/v1/esg/dashboard`                  | session                                                            | esg    | —          | —                      |            |
| GET                | `/api/v1/esg/datapoints`                 | session                                                            | —      | —          | problem+json (wrapper) |            |
| GET                | `/api/v1/esg/erm-stats`                  | session                                                            | esg    | —          | problem+json           |            |
| GET, POST          | `/api/v1/esg/erm-sync`                   | admin, risk_manager, esg_manager, esg_contributor                  | esg    | —          | problem+json           |            |
| GET, POST          | `/api/v1/esg/materiality`                | admin, risk_manager, esg_manager, esg_contributor, process_owner   | esg    | —          | legacy `{error}`       |            |
| GET, PUT           | `/api/v1/esg/materiality/:year`          | session                                                            | esg    | —          | legacy `{error}`       |            |
| PUT                | `/api/v1/esg/materiality/:year/finalize` | admin, risk_manager, esg_manager                                   | esg    | —          | legacy `{error}`       |            |
| GET                | `/api/v1/esg/materiality/:year/iro`      | session                                                            | esg    | —          | legacy `{error}`       |            |
| GET                | `/api/v1/esg/materiality/:year/matrix`   | session                                                            | esg    | —          | legacy `{error}`       |            |
| GET, POST          | `/api/v1/esg/materiality/:year/topics`   | admin, risk_manager, esg_manager, esg_contributor                  | esg    | —          | legacy `{error}`       |            |
| POST               | `/api/v1/esg/materiality/:year/vote`     | session                                                            | esg    | —          | legacy `{error}`       |            |
| GET, POST          | `/api/v1/esg/measurements`               | admin, risk_manager, esg_manager, esg_contributor, control_owner   | esg    | —          | legacy `{error}`       |            |
| PUT                | `/api/v1/esg/measurements/:id/verify`    | admin, risk_manager, esg_manager, auditor                          | esg    | —          | legacy `{error}`       |            |
| POST               | `/api/v1/esg/measurements/bulk`          | admin, risk_manager, esg_manager, esg_contributor                  | esg    | —          | legacy `{error}`       |            |
| GET                | `/api/v1/esg/measurements/schema`        | session                                                            | esg    | —          | problem+json (wrapper) | Wave-24-D6 |
| GET, POST          | `/api/v1/esg/metrics`                    | admin, risk_manager, esg_manager, esg_contributor                  | esg    | —          | legacy `{error}`       |            |
| GET                | `/api/v1/esg/report/:year/completeness`  | session                                                            | esg    | —          | legacy `{error}`       |            |
| GET, POST          | `/api/v1/esg/report/:year/export`        | admin, risk_manager, esg_manager                                   | esg    | —          | legacy `{error}`       |            |
| GET                | `/api/v1/esg/scope-emissions/:year`      | session                                                            | esg    | —          | legacy `{error}`       |            |
| GET, POST          | `/api/v1/esg/targets`                    | admin, risk_manager, esg_manager, esg_contributor                  | esg    | —          | legacy `{error}`       |            |
| GET                | `/api/v1/esg/targets/:id/progress`       | session                                                            | esg    | —          | legacy `{error}`       |            |
| GET, POST          | `/api/v1/esg/taxonomy`                   | session                                                            | esg    | —          | legacy `{error}`       |            |

## Events

| Method | Path             | Auth  | Module | Pagination | Errors | Notes |
| ------ | ---------------- | ----- | ------ | ---------- | ------ | ----- |
| GET    | `/api/v1/events` | admin | —      | —          | —      |       |

## Evidence

| Method      | Path                   | Auth                                        | Module | Pagination | Errors           | Notes |
| ----------- | ---------------------- | ------------------------------------------- | ------ | ---------- | ---------------- | ----- |
| GET, POST   | `/api/v1/evidence`     | admin, risk_manager, control_owner, auditor | ics    | —          | legacy `{error}` |       |
| GET, DELETE | `/api/v1/evidence/:id` | session                                     | ics    | —          | legacy `{error}` |       |

## Evidence Review

| Method    | Path                                       | Auth                                        | Module | Pagination | Errors           | Notes |
| --------- | ------------------------------------------ | ------------------------------------------- | ------ | ---------- | ---------------- | ----- |
| GET       | `/api/v1/evidence-review/dashboard`        | admin, control_owner, auditor, risk_manager | ics    | —          | —                |       |
| PATCH     | `/api/v1/evidence-review/gaps/:id`         | admin, control_owner, auditor               | ics    | —          | legacy `{error}` |       |
| POST      | `/api/v1/evidence-review/gaps/batch`       | admin, control_owner, auditor               | ics    | —          | legacy `{error}` |       |
| GET, POST | `/api/v1/evidence-review/jobs`             | admin, control_owner, auditor               | ics    | —          | legacy `{error}` |       |
| GET, POST | `/api/v1/evidence-review/jobs/:id`         | admin, control_owner, auditor, risk_manager | ics    | —          | legacy `{error}` |       |
| GET       | `/api/v1/evidence-review/jobs/:id/gaps`    | admin, control_owner, auditor, risk_manager | ics    | —          | legacy `{error}` |       |
| GET       | `/api/v1/evidence-review/jobs/:id/results` | admin, control_owner, auditor, risk_manager | ics    | —          | legacy `{error}` |       |

## Executive

| Method | Path                          | Auth                | Module | Pagination | Errors | Notes |
| ------ | ----------------------------- | ------------------- | ------ | ---------- | ------ | ----- |
| GET    | `/api/v1/executive/dashboard` | admin, risk_manager | —      | —          | —      |       |
| GET    | `/api/v1/executive/trend`     | admin, risk_manager | —      | —          | —      |       |

## Export

| Method             | Path                           | Auth                | Module | Pagination | Errors           | Notes               |
| ------------------ | ------------------------------ | ------------------- | ------ | ---------- | ---------------- | ------------------- |
| GET                | `/api/v1/export/:entityType`   | session             | —      | —          | problem+json     |                     |
| POST               | `/api/v1/export/bulk`          | session             | —      | —          | problem+json     | Multi-entity export |
| GET, POST          | `/api/v1/export/schedules`     | admin, risk_manager | —      | —          | legacy `{error}` |                     |
| GET, PATCH, DELETE | `/api/v1/export/schedules/:id` | admin, risk_manager | —      | —          | legacy `{error}` |                     |

## Feature Gates

| Method             | Path                          | Auth    | Module | Pagination | Errors           | Notes |
| ------------------ | ----------------------------- | ------- | ------ | ---------- | ---------------- | ----- |
| GET, POST          | `/api/v1/feature-gates`       | admin   | —      | —          | legacy `{error}` |       |
| GET, PATCH, DELETE | `/api/v1/feature-gates/:id`   | admin   | —      | —          | legacy `{error}` |       |
| GET                | `/api/v1/feature-gates/check` | session | —      | —          | legacy `{error}` |       |

## Findings

| Method                  | Path                                  | Auth                                                             | Module | Pagination | Errors                 | Notes |
| ----------------------- | ------------------------------------- | ---------------------------------------------------------------- | ------ | ---------- | ---------------------- | ----- |
| GET, POST               | `/api/v1/findings`                    | admin, auditor, risk_manager, control_owner, process_owner, ciso | ics    | —          | problem+json           |       |
| GET, PUT, PATCH, DELETE | `/api/v1/findings/:id`                | session                                                          | ics    | —          | legacy `{error}`       |       |
| PUT                     | `/api/v1/findings/:id/status`         | admin, risk_manager, auditor, control_owner, process_owner, ciso | ics    | —          | legacy `{error}`       |       |
| POST                    | `/api/v1/findings/:id/sync-treatment` | admin, auditor, risk_manager                                     | erm    | —          | legacy `{error}`       |       |
| GET                     | `/api/v1/findings/:id/transitions`    | session                                                          | ics    | —          | legacy `{error}`       |       |
| GET                     | `/api/v1/findings/analytics/aging`    | session                                                          | ics    | —          | —                      |       |
| GET                     | `/api/v1/findings/analytics/sla`      | session                                                          | ics    | —          | —                      |       |
| GET                     | `/api/v1/findings/analytics/ttr`      | session                                                          | ics    | —          | —                      |       |
| POST                    | `/api/v1/findings/bulk`               | admin, auditor, risk_manager, control_owner, process_owner, ciso | ics    | —          | problem+json (wrapper) |       |
| GET                     | `/api/v1/findings/export`             | session                                                          | ics    | —          | problem+json (wrapper) |       |

## Framework Mappings

| Method     | Path                                             | Auth                                 | Module | Pagination | Errors                 | Notes |
| ---------- | ------------------------------------------------ | ------------------------------------ | ------ | ---------- | ---------------------- | ----- |
| GET, POST  | `/api/v1/framework-mappings`                     | admin, risk_manager                  | ics    | —          | problem+json (wrapper) |       |
| GET, PATCH | `/api/v1/framework-mappings/:id`                 | session                              | ics    | —          | legacy `{error}`       |       |
| POST       | `/api/v1/framework-mappings/cross-framework-gap` | admin, risk_manager, auditor, viewer | —      | —          | legacy `{error}`       |       |
| GET        | `/api/v1/framework-mappings/dashboard`           | session                              | ics    | —          | —                      |       |
| GET, POST  | `/api/v1/framework-mappings/gap-analysis`        | admin, risk_manager                  | ics    | —          | legacy `{error}`       |       |
| GET, POST  | `/api/v1/framework-mappings/rules`               | admin, risk_manager                  | ics    | —          | legacy `{error}`       |       |
| GET        | `/api/v1/framework-mappings/snapshots`           | session                              | ics    | —          | problem+json           |       |

## Graph

| Method | Path                                | Auth                | Module | Pagination | Errors           | Notes |
| ------ | ----------------------------------- | ------------------- | ------ | ---------- | ---------------- | ----- |
| GET    | `/api/v1/graph/dependencies/hubs`   | admin, risk_manager | —      | —          | legacy `{error}` |       |
| GET    | `/api/v1/graph/dependencies/matrix` | admin, risk_manager | —      | —          | legacy `{error}` |       |
| POST   | `/api/v1/graph/impact`              | admin, risk_manager | —      | —          | legacy `{error}` |       |
| GET    | `/api/v1/graph/orphans`             | admin, risk_manager | —      | —          | legacy `{error}` |       |
| GET    | `/api/v1/graph/search`              | admin, risk_manager | —      | —          | legacy `{error}` |       |
| GET    | `/api/v1/graph/stats`               | admin, risk_manager | —      | —          | legacy `{error}` |       |
| GET    | `/api/v1/graph/subgraph`            | admin, risk_manager | —      | —          | legacy `{error}` |       |
| POST   | `/api/v1/graph/what-if`             | admin, risk_manager | —      | —          | legacy `{error}` |       |

## Grc

| Method | Path                   | Auth                                                            | Module | Pagination | Errors           | Notes |
| ------ | ---------------------- | --------------------------------------------------------------- | ------ | ---------- | ---------------- | ----- |
| GET    | `/api/v1/grc/my-todos` | admin, risk_manager, control_owner, process_owner, auditor, dpo | —      | —          | legacy `{error}` |       |

## Health

| Method | Path                          | Auth  | Module | Pagination | Errors | Notes |
| ------ | ----------------------------- | ----- | ------ | ---------- | ------ | ----- |
| GET    | `/api/v1/health`              | —     | —      | —          | —      |       |
| GET    | `/api/v1/health/schema-drift` | admin | —      | —          | —      |       |

## Horizon Scanner

| Method     | Path                                             | Auth                                      | Module | Pagination | Errors           | Notes |
| ---------- | ------------------------------------------------ | ----------------------------------------- | ------ | ---------- | ---------------- | ----- |
| GET, POST  | `/api/v1/horizon-scanner/calendar`               | admin, dpo, risk_manager                  | —      | —          | legacy `{error}` |       |
| PATCH      | `/api/v1/horizon-scanner/calendar/:id`           | admin, dpo, risk_manager                  | —      | —          | legacy `{error}` |       |
| GET        | `/api/v1/horizon-scanner/dashboard`              | admin, dpo, risk_manager, auditor, viewer | —      | —          | —                |       |
| GET, POST  | `/api/v1/horizon-scanner/impact-assessments`     | admin, dpo, risk_manager                  | —      | —          | legacy `{error}` |       |
| GET, PATCH | `/api/v1/horizon-scanner/impact-assessments/:id` | admin, dpo, risk_manager, auditor, viewer | —      | —          | legacy `{error}` |       |
| GET        | `/api/v1/horizon-scanner/items`                  | admin, dpo, risk_manager, auditor, viewer | —      | —          | legacy `{error}` |       |
| GET, PATCH | `/api/v1/horizon-scanner/items/:id`              | admin, dpo, risk_manager, auditor, viewer | —      | —          | legacy `{error}` |       |
| GET, POST  | `/api/v1/horizon-scanner/sources`                | admin, dpo                                | —      | —          | legacy `{error}` |       |
| GET, PATCH | `/api/v1/horizon-scanner/sources/:id`            | admin, dpo, risk_manager, auditor, viewer | —      | —          | legacy `{error}` |       |

## Ics

| Method           | Path                                | Auth                 | Module | Pagination | Errors           | Notes |
| ---------------- | ----------------------------------- | -------------------- | ------ | ---------- | ---------------- | ----- |
| GET, POST        | `/api/v1/ics/ccm/connectors`        | session              | ics    | —          | legacy `{error}` |       |
| GET              | `/api/v1/ics/ccm/evidence`          | session              | ics    | —          | —                |       |
| GET              | `/api/v1/ics/ces/heatmap`           | session              | —      | —          | —                |       |
| GET              | `/api/v1/ics/ces/overview`          | session              | —      | —          | —                |       |
| POST             | `/api/v1/ics/ces/recompute`         | admin, risk_manager  | —      | —          | legacy `{error}` |       |
| GET              | `/api/v1/ics/control-library`       | session              | ics    | —          | —                |       |
| POST             | `/api/v1/ics/control-library/adopt` | admin, control_owner | ics    | —          | legacy `{error}` |       |
| GET, POST, PATCH | `/api/v1/ics/deficiencies`          | session              | ics    | —          | legacy `{error}` |       |
| GET, PUT         | `/api/v1/ics/finding-sla`           | session              | —      | —          | legacy `{error}` |       |
| GET, POST        | `/api/v1/ics/sox/walkthroughs`      | session              | ics    | —          | legacy `{error}` |       |

## Identity

| Method                 | Path                             | Auth | Module | Pagination | Errors | Notes                                                                                                          |
| ---------------------- | -------------------------------- | ---- | ------ | ---------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| GET                    | `/api/v1/identity`               | —    | —      | —          | —      | #NIGHT-036: GET /api/v1/identity discovery root. The QA agent tested several "/identity/*" paths that don't ex |
| GET, POST, PUT, DELETE | `/api/v1/identity/api-keys`      | —    | —      | —          | —      |                                                                                                                |
| GET, POST, PUT, DELETE | `/api/v1/identity/scim-configs`  | —    | —      | —          | —      |                                                                                                                |
| GET, POST, PUT, DELETE | `/api/v1/identity/sso-providers` | —    | —      | —          | —      |                                                                                                                |

## Identity Connectors

| Method             | Path                                       | Auth                | Module | Pagination | Errors           | Notes |
| ------------------ | ------------------------------------------ | ------------------- | ------ | ---------- | ---------------- | ----- |
| GET, POST          | `/api/v1/identity-connectors/configs`      | admin, risk_manager | ics    | —          | legacy `{error}` |       |
| GET, PATCH, DELETE | `/api/v1/identity-connectors/configs/:id`  | session             | ics    | —          | legacy `{error}` |       |
| GET                | `/api/v1/identity-connectors/dashboard`    | session             | ics    | —          | —                |       |
| GET                | `/api/v1/identity-connectors/saas-checks`  | session             | ics    | —          | problem+json     |       |
| POST               | `/api/v1/identity-connectors/sync`         | admin, risk_manager | ics    | —          | legacy `{error}` |       |
| GET                | `/api/v1/identity-connectors/test-results` | session             | ics    | —          | problem+json     |       |

## Import

| Method      | Path                                   | Auth                         | Module | Pagination | Errors           | Notes |
| ----------- | -------------------------------------- | ---------------------------- | ------ | ---------- | ---------------- | ----- |
| GET         | `/api/v1/import`                       | admin, risk_manager, auditor | —      | —          | —                |       |
| GET         | `/api/v1/import/:jobId`                | admin, risk_manager, auditor | —      | —          | legacy `{error}` |       |
| POST        | `/api/v1/import/:jobId/execute`        | admin, risk_manager          | —      | —          | legacy `{error}` |       |
| GET         | `/api/v1/import/:jobId/log`            | admin, risk_manager, auditor | —      | —          | legacy `{error}` |       |
| GET, POST   | `/api/v1/import/:jobId/map-columns`    | admin, risk_manager          | —      | —          | legacy `{error}` |       |
| POST        | `/api/v1/import/:jobId/validate`       | admin, risk_manager          | —      | —          | legacy `{error}` |       |
| GET, POST   | `/api/v1/import/mappings`              | admin, risk_manager          | —      | —          | legacy `{error}` |       |
| GET, DELETE | `/api/v1/import/mappings/:entityType`  | admin, risk_manager          | —      | —          | legacy `{error}` |       |
| GET         | `/api/v1/import/templates/:entityType` | session                      | —      | —          | legacy `{error}` |       |
| POST        | `/api/v1/import/upload`                | admin, risk_manager          | —      | —          | legacy `{error}` |       |

## Import Jobs

| Method     | Path                      | Auth  | Module | Pagination | Errors           | Notes |
| ---------- | ------------------------- | ----- | ------ | ---------- | ---------------- | ----- |
| GET, POST  | `/api/v1/import-jobs`     | admin | —      | —          | legacy `{error}` |       |
| GET, PATCH | `/api/v1/import-jobs/:id` | admin | —      | —          | legacy `{error}` |       |

## Invitations

| Method           | Path                                | Auth  | Module | Pagination | Errors           | Notes |
| ---------------- | ----------------------------------- | ----- | ------ | ---------- | ---------------- | ----- |
| GET, POST, PATCH | `/api/v1/invitations`               | admin | —      | —          | legacy `{error}` |       |
| POST             | `/api/v1/invitations/:token/accept` | —     | —      | —          | legacy `{error}` |       |

## Isms

| Method                 | Path                                                              | Auth                                                               | Module | Pagination | Errors                 | Notes                                                                                                          |
| ---------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ | ------ | ---------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| GET, POST              | `/api/v1/isms/assessments`                                        | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET, PUT, DELETE       | `/api/v1/isms/assessments/:id`                                    | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| PATCH                  | `/api/v1/isms/assessments/:id/bulk-evaluations`                   | admin, risk_manager                                                | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/assessments/:id/completion`                         | admin, risk_manager, control_owner, process_owner, auditor, viewer | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/assessments/:id/eval-gate-check`                    | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST              | `/api/v1/isms/assessments/:id/evaluations`                        | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET, PUT               | `/api/v1/isms/assessments/:id/evaluations/:evalId`                | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/isms/assessments/:id/finalize`                           | admin, risk_manager                                                | isms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/isms/assessments/:id/generate-evaluations`               | admin, risk_manager                                                | isms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/isms/assessments/:id/initialize-soa`                     | admin, risk_manager                                                | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/assessments/:id/progress`                           | session                                                            | isms   | —          | —                      |                                                                                                                |
| GET                    | `/api/v1/isms/assessments/:id/report`                             | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/isms/assessments/:id/risk-assessment/generate-scenarios` | admin, risk_manager                                                | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST              | `/api/v1/isms/assessments/:id/risk-evaluations`                   | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/assessments/:id/risk-gate-check`                    | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/assessments/:id/soa-gate-check`                     | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/isms/assessments/:id/transition`                         | admin, risk_manager                                                | isms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/isms/assessments/setup-wizard`                           | admin, risk_manager                                                | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/assets/:id/audit-summary`                           | admin, risk_manager, control_owner, process_owner, auditor, viewer | isms   | —          | —                      |                                                                                                                |
| GET, PUT               | `/api/v1/isms/assets/:id/classification`                          | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST, DELETE      | `/api/v1/isms/assets/:id/cpe`                                     | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/assets/:id/recommended-risks`                       | admin, risk_manager, control_owner, process_owner, auditor, viewer | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/assets/classification-overview`                     | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/isms/attack-paths`                                       | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/attack-paths/:batchId`                              | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/attack-paths/:batchId/recommendations`              | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/isms/attack-paths/compare`                               | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/cap-monitor`                                        | session                                                            | isms   | —          | —                      |                                                                                                                |
| GET                    | `/api/v1/isms/cap-monitor/pdf`                                    | session                                                            | isms   | —          | —                      |                                                                                                                |
| POST                   | `/api/v1/isms/certification/ai-priority`                          | admin, risk_manager                                                | isms   | —          | —                      |                                                                                                                |
| GET                    | `/api/v1/isms/certification/gaps`                                 | session                                                            | isms   | —          | —                      |                                                                                                                |
| GET                    | `/api/v1/isms/certification/readiness`                            | session                                                            | isms   | —          | —                      |                                                                                                                |
| GET, POST              | `/api/v1/isms/certification/snapshots`                            | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/certification/timeline`                             | session                                                            | isms   | —          | —                      |                                                                                                                |
| GET                    | `/api/v1/isms/cve`                                                | session                                                            | isms   | —          | problem+json (wrapper) | #NIGHT-005: /api/v1/isms/cve root returned 404 — sub-routes (dashboard, feed, matches) exist but no aggregated |
| GET                    | `/api/v1/isms/cve/dashboard`                                      | session                                                            | isms   | —          | —                      |                                                                                                                |
| GET                    | `/api/v1/isms/cve/feed`                                           | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/cve/matches`                                        | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| PUT                    | `/api/v1/isms/cve/matches/:id/acknowledge`                        | admin, risk_manager                                                | isms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/isms/cve/matches/:id/convert`                            | admin, risk_manager                                                | isms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/isms/cve/matches/bulk`                                   | admin, risk_manager                                                | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/dashboard`                                          | session                                                            | isms   | —          | —                      |                                                                                                                |
| GET                    | `/api/v1/isms/dashboards`                                         | admin, risk_manager, control_owner, process_owner, auditor, viewer | isms   | —          | —                      |                                                                                                                |
| GET, POST              | `/api/v1/isms/incidents`                                          | session                                                            | isms   | —          | problem+json (wrapper) |                                                                                                                |
| GET, PUT, DELETE       | `/api/v1/isms/incidents/:id`                                      | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/isms/incidents/:id/notify-authority`                     | admin, dpo, risk_manager                                           | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST              | `/api/v1/isms/incidents/:id/playbook`                             | admin, risk_manager                                                | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/incidents/:id/playbook-suggestions`                 | session                                                            | isms   | —          | —                      |                                                                                                                |
| PUT                    | `/api/v1/isms/incidents/:id/playbook/abort`                       | admin, risk_manager                                                | isms   | —          | legacy `{error}`       |                                                                                                                |
| PUT                    | `/api/v1/isms/incidents/:id/playbook/advance-phase`               | admin, risk_manager                                                | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET, PATCH             | `/api/v1/isms/incidents/:id/rating`                               | admin, risk_manager, control_owner                                 | isms   | —          | legacy `{error}`       |                                                                                                                |
| PUT                    | `/api/v1/isms/incidents/:id/status`                               | admin, risk_manager                                                | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST              | `/api/v1/isms/incidents/:id/timeline`                             | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/incidents/:id/transitions`                          | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/isms/incidents/correlate`                                | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/incidents/correlations`                             | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/incidents/mitre-heatmap`                            | session                                                            | isms   | —          | —                      |                                                                                                                |
| GET                    | `/api/v1/isms/incidents/patterns`                                 | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST, PUT, DELETE | `/api/v1/isms/management-reviews`                                 | —                                                                  | —      | —          | problem+json           | #NIGHT-005: legacy plural slug. The canonical API lives at /api/v1/isms/reviews. Return a 308 with Location so |
| POST                   | `/api/v1/isms/maturity/ai-roadmap`                                | admin, risk_manager                                                | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/maturity/gap-analysis`                              | session                                                            | isms   | —          | —                      |                                                                                                                |
| GET                    | `/api/v1/isms/maturity/heatmap`                                   | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/maturity/radar`                                     | session                                                            | isms   | —          | —                      |                                                                                                                |
| GET, PUT               | `/api/v1/isms/maturity/roadmap`                                   | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/nis2`                                               | —                                                                  | —      | —          | —                      | #NIGHT-005: /api/v1/isms/nis2 root returned 404 — only sub-routes (status, reports, readiness-score, reporting |
| GET                    | `/api/v1/isms/nis2/readiness-score`                               | session                                                            | isms   | —          | —                      |                                                                                                                |
| GET                    | `/api/v1/isms/nis2/reporting-tracker`                             | session                                                            | isms   | —          | —                      |                                                                                                                |
| POST                   | `/api/v1/isms/nis2/reports`                                       | admin, risk_manager                                                | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET, PATCH             | `/api/v1/isms/nis2/reports/:id`                                   | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/nis2/status`                                        | session                                                            | isms   | —          | —                      |                                                                                                                |
| GET                    | `/api/v1/isms/nis2/status/:reqId`                                 | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST              | `/api/v1/isms/nonconformities`                                    | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET, PUT               | `/api/v1/isms/nonconformities/:id`                                | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/nonconformities/:id/transitions`                    | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/posture`                                            | admin, risk_manager                                                | isms   | —          | —                      |                                                                                                                |
| GET                    | `/api/v1/isms/posture/domains`                                    | admin, risk_manager                                                | isms   | —          | —                      |                                                                                                                |
| GET                    | `/api/v1/isms/posture/trend`                                      | admin, risk_manager                                                | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST              | `/api/v1/isms/reviews`                                            | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET, PUT               | `/api/v1/isms/reviews/:id`                                        | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/reviews/:id/dashboard`                              | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/reviews/:id/export/pdf`                             | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST              | `/api/v1/isms/reviews/:id/items`                                  | session                                                            | isms   | —          | legacy `{error}`       | GET/POST /api/v1/isms/reviews/[id]/items                                                                       |
| PUT, DELETE            | `/api/v1/isms/reviews/:id/items/:itemId`                          | session                                                            | isms   | —          | legacy `{error}`       | PUT/DELETE /api/v1/isms/reviews/[id]/items/[itemId]                                                            |
| GET, POST              | `/api/v1/isms/risk-scenarios`                                     | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET, DELETE            | `/api/v1/isms/risk-scenarios/:id`                                 | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST              | `/api/v1/isms/soa`                                                | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET, PUT               | `/api/v1/isms/soa/:id`                                            | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST              | `/api/v1/isms/soa/ai-gap-analysis`                                | admin, risk_manager                                                | isms   | —          | legacy `{error}`       |                                                                                                                |
| PUT                    | `/api/v1/isms/soa/ai-gap-analysis/:id`                            | admin, risk_manager                                                | isms   | —          | legacy `{error}`       |                                                                                                                |
| POST                   | `/api/v1/isms/soa/bulk`                                           | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/soa/diff`                                           | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/soa/export`                                         | session                                                            | isms   | —          | —                      |                                                                                                                |
| POST                   | `/api/v1/isms/soa/populate`                                       | admin, risk_manager                                                | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST              | `/api/v1/isms/threats`                                            | session                                                            | isms   | —          | problem+json (wrapper) |                                                                                                                |
| GET, PUT, DELETE       | `/api/v1/isms/threats/:id`                                        | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/threats/:id/transitions`                            | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/threats/dashboard`                                  | session                                                            | isms   | —          | —                      |                                                                                                                |
| GET                    | `/api/v1/isms/threats/feed`                                       | session                                                            | isms   | —          | —                      |                                                                                                                |
| GET, POST              | `/api/v1/isms/threats/feeds`                                      | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| PUT, DELETE            | `/api/v1/isms/threats/feeds/:id`                                  | admin, risk_manager                                                | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/threats/heatmap`                                    | session                                                            | isms   | —          | —                      |                                                                                                                |
| GET                    | `/api/v1/isms/threats/top`                                        | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/threats/trends`                                     | session                                                            | isms   | —          | —                      |                                                                                                                |
| GET, POST              | `/api/v1/isms/vulnerabilities`                                    | session                                                            | isms   | —          | problem+json (wrapper) |                                                                                                                |
| GET, PUT, DELETE       | `/api/v1/isms/vulnerabilities/:id`                                | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |
| GET                    | `/api/v1/isms/vulnerabilities/:id/transitions`                    | session                                                            | isms   | —          | legacy `{error}`       |                                                                                                                |

## Kris

| Method           | Path                                  | Auth                               | Module | Pagination | Errors                 | Notes |
| ---------------- | ------------------------------------- | ---------------------------------- | ------ | ---------- | ---------------------- | ----- |
| GET, POST        | `/api/v1/kris`                        | admin, risk_manager                | erm    | —          | problem+json (wrapper) |       |
| GET, PUT, DELETE | `/api/v1/kris/:id`                    | session                            | erm    | —          | legacy `{error}`       |       |
| GET              | `/api/v1/kris/:id/history`            | session                            | erm    | —          | legacy `{error}`       |       |
| GET, POST        | `/api/v1/kris/:id/measurements`       | admin, risk_manager, control_owner | erm    | —          | legacy `{error}`       |       |
| POST             | `/api/v1/kris/:id/measurements/batch` | admin, risk_manager, control_owner | erm    | —          | legacy `{error}`       |       |
| GET              | `/api/v1/kris/export`                 | admin, risk_manager                | erm    | —          | —                      |       |

## Lksg

| Method         | Path                                | Auth                     | Module | Pagination | Errors           | Notes |
| -------------- | ----------------------------------- | ------------------------ | ------ | ---------- | ---------------- | ----- |
| GET            | `/api/v1/lksg`                      | session                  | tprm   | —          | —                |       |
| GET, POST, PUT | `/api/v1/lksg/:vendorId/assessment` | admin, risk_manager, dpo | tprm   | —          | legacy `{error}` |       |

## Marketplace

| Method             | Path                                      | Auth    | Module | Pagination | Errors                 | Notes                                                                      |
| ------------------ | ----------------------------------------- | ------- | ------ | ---------- | ---------------------- | -------------------------------------------------------------------------- |
| GET                | `/api/v1/marketplace`                     | —       | —      | —          | —                      | #NIGHT-014: /api/v1/marketplace root returned 404 — only sub-routes exist. |
| GET, POST          | `/api/v1/marketplace/categories`          | session | —      | —          | —                      |                                                                            |
| GET, POST          | `/api/v1/marketplace/installations`       | session | —      | —          | —                      |                                                                            |
| GET, PATCH, DELETE | `/api/v1/marketplace/installations/:id`   | session | —      | —          | legacy `{error}`       |                                                                            |
| GET, POST          | `/api/v1/marketplace/listings`            | session | —      | —          | problem+json (wrapper) |                                                                            |
| GET, PATCH, DELETE | `/api/v1/marketplace/listings/:id`        | session | —      | —          | legacy `{error}`       |                                                                            |
| PATCH              | `/api/v1/marketplace/listings/:id/status` | admin   | —      | —          | legacy `{error}`       |                                                                            |
| GET, POST          | `/api/v1/marketplace/publishers`          | session | —      | —          | —                      |                                                                            |
| GET, PATCH         | `/api/v1/marketplace/publishers/:id`      | session | —      | —          | legacy `{error}`       |                                                                            |
| GET, POST          | `/api/v1/marketplace/reviews`             | session | —      | —          | legacy `{error}`       |                                                                            |
| POST               | `/api/v1/marketplace/reviews/:id/respond` | admin   | —      | —          | legacy `{error}`       |                                                                            |
| GET, POST          | `/api/v1/marketplace/security-scans`      | session | —      | —          | legacy `{error}`       |                                                                            |
| GET, POST          | `/api/v1/marketplace/versions`            | session | —      | —          | legacy `{error}`       |                                                                            |
| GET, PATCH         | `/api/v1/marketplace/versions/:id`        | session | —      | —          | legacy `{error}`       |                                                                            |

## Maturity

| Method             | Path                                 | Auth                | Module | Pagination | Errors           | Notes |
| ------------------ | ------------------------------------ | ------------------- | ------ | ---------- | ---------------- | ----- |
| GET, POST          | `/api/v1/maturity/assessments`       | session             | isms   | —          | —                |       |
| GET, PATCH         | `/api/v1/maturity/assessments/:id`   | session             | isms   | —          | legacy `{error}` |       |
| GET                | `/api/v1/maturity/benchmarks/pool`   | session             | isms   | —          | —                |       |
| POST               | `/api/v1/maturity/benchmarks/submit` | admin, risk_manager | isms   | —          | legacy `{error}` |       |
| GET, POST          | `/api/v1/maturity/models`            | session             | isms   | —          | —                |       |
| GET, PATCH, DELETE | `/api/v1/maturity/models/:id`        | session             | isms   | —          | legacy `{error}` |       |
| GET, POST          | `/api/v1/maturity/roadmap`           | session             | isms   | —          | —                |       |
| GET, PATCH, DELETE | `/api/v1/maturity/roadmap/:id`       | session             | isms   | —          | legacy `{error}` |       |
| GET                | `/api/v1/maturity/scorecard`         | session             | isms   | —          | —                |       |

## Meta

| Method | Path                 | Auth    | Module | Pagination | Errors       | Notes |
| ------ | -------------------- | ------- | ------ | ---------- | ------------ | ----- |
| GET    | `/api/v1/meta/build` | session | —      | —          | problem+json |       |

## Mobile

| Method        | Path                           | Auth    | Module | Pagination | Errors           | Notes |
| ------------- | ------------------------------ | ------- | ------ | ---------- | ---------------- | ----- |
| GET, POST     | `/api/v1/mobile/devices`       | session | —      | —          | legacy `{error}` |       |
| PATCH, DELETE | `/api/v1/mobile/devices/:id`   | session | —      | —          | legacy `{error}` |       |
| GET, POST     | `/api/v1/mobile/push`          | admin   | —      | —          | legacy `{error}` |       |
| POST          | `/api/v1/mobile/push/:id/read` | session | —      | —          | legacy `{error}` |       |
| POST          | `/api/v1/mobile/scan`          | session | —      | —          | legacy `{error}` |       |
| GET, POST     | `/api/v1/mobile/sync`          | session | —      | —          | legacy `{error}` |       |

## Notifications

| Method    | Path                                  | Auth    | Module | Pagination | Errors                 | Notes |
| --------- | ------------------------------------- | ------- | ------ | ---------- | ---------------------- | ----- |
| GET       | `/api/v1/notifications`               | session | —      | —          | —                      |       |
| PUT       | `/api/v1/notifications/:id/read`      | session | —      | —          | legacy `{error}`       |       |
| POST      | `/api/v1/notifications/mark-all-read` | session | —      | —          | problem+json (wrapper) |       |
| GET, POST | `/api/v1/notifications/scheduled`     | admin   | —      | —          | legacy `{error}`       |       |
| DELETE    | `/api/v1/notifications/scheduled/:id` | admin   | —      | —          | legacy `{error}`       |       |

## Onboarding

| Method    | Path                                              | Auth  | Module | Pagination | Errors           | Notes |
| --------- | ------------------------------------------------- | ----- | ------ | ---------- | ---------------- | ----- |
| GET, POST | `/api/v1/onboarding`                              | admin | —      | —          | legacy `{error}` |       |
| POST      | `/api/v1/onboarding/:sessionId/skip`              | admin | —      | —          | legacy `{error}` |       |
| PATCH     | `/api/v1/onboarding/:sessionId/steps/:stepNumber` | admin | —      | —          | legacy `{error}` |       |

## Organizations

| Method           | Path                                                   | Auth                | Module | Pagination | Errors                 | Notes                                                                                                          |
| ---------------- | ------------------------------------------------------ | ------------------- | ------ | ---------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| GET, POST        | `/api/v1/organizations`                                | admin               | —      | —          | problem+json (wrapper) |                                                                                                                |
| GET, PUT, DELETE | `/api/v1/organizations/:id`                            | session             | —      | —          | legacy `{error}`       |                                                                                                                |
| GET, POST        | `/api/v1/organizations/:id/active-catalogs`            | session             | —      | —          | legacy `{error}`       |                                                                                                                |
| DELETE           | `/api/v1/organizations/:id/active-catalogs/:catalogId` | admin, risk_manager | —      | —          | legacy `{error}`       |                                                                                                                |
| GET, PUT         | `/api/v1/organizations/:id/bpmn-validation-config`     | session             | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET, PUT         | `/api/v1/organizations/:id/branding`                   | session             | —      | —          | legacy `{error}`       |                                                                                                                |
| POST, DELETE     | `/api/v1/organizations/:id/branding/favicon`           | admin               | —      | —          | legacy `{error}`       |                                                                                                                |
| POST, DELETE     | `/api/v1/organizations/:id/branding/logo`              | admin               | —      | —          | legacy `{error}`       |                                                                                                                |
| GET, POST        | `/api/v1/organizations/:id/contacts`                   | session             | —      | —          | legacy `{error}`       |                                                                                                                |
| GET, PUT, DELETE | `/api/v1/organizations/:id/contacts/:contactId`        | session             | —      | —          | legacy `{error}`       |                                                                                                                |
| PUT              | `/api/v1/organizations/:id/dashboard-layout/default`   | admin               | —      | —          | legacy `{error}`       |                                                                                                                |
| PUT              | `/api/v1/organizations/:id/dpo`                        | admin               | —      | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/organizations/:id/modules`                    | session             | —      | —          | —                      | List all module configs for an org All roles can read; module_config JOIN module_definition, sorted by nav_ord |
| PUT              | `/api/v1/organizations/:id/modules/:key`               | admin               | —      | —          | legacy `{error}`       | Enable/disable/configure a module Admin only. Validates dependencies on enable, cascade check on disable.      |
| GET, PUT         | `/api/v1/organizations/:id/risk-appetite`              | session             | erm    | —          | legacy `{error}`       |                                                                                                                |
| GET, PUT         | `/api/v1/organizations/:id/risk-methodology`           | session             | erm    | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/organizations/dpos`                           | admin               | —      | —          | —                      |                                                                                                                |
| GET              | `/api/v1/organizations/tree`                           | admin               | —      | —          | —                      |                                                                                                                |

## Platform

| Method | Path                                  | Auth | Module | Pagination | Errors           | Notes                                                                                  |
| ------ | ------------------------------------- | ---- | ------ | ---------- | ---------------- | -------------------------------------------------------------------------------------- |
| GET    | `/api/v1/platform/module-definitions` | —    | —      | —          | legacy `{error}` | List all module definitions Any authenticated user can access; no org context needed.  |
| GET    | `/api/v1/platform/work-item-types`    | —    | —      | —          | legacy `{error}` | All work item type definitions Auth-only (no org context needed). Sorted by nav_order. |

## Playbooks

| Method           | Path                    | Auth    | Module | Pagination | Errors           | Notes |
| ---------------- | ----------------------- | ------- | ------ | ---------- | ---------------- | ----- |
| GET, POST        | `/api/v1/playbooks`     | session | isms   | —          | problem+json     |       |
| GET, PUT, DELETE | `/api/v1/playbooks/:id` | session | isms   | —          | legacy `{error}` |       |

## Playground

| Method             | Path                              | Auth  | Module | Pagination | Errors           | Notes |
| ------------------ | --------------------------------- | ----- | ------ | ---------- | ---------------- | ----- |
| POST               | `/api/v1/playground/execute`      | admin | —      | —          | legacy `{error}` |       |
| GET, POST          | `/api/v1/playground/snippets`     | admin | —      | —          | legacy `{error}` |       |
| GET, PATCH, DELETE | `/api/v1/playground/snippets/:id` | admin | —      | —          | legacy `{error}` |       |

## Plugins

| Method             | Path                                         | Auth    | Module | Pagination | Errors           | Notes |
| ------------------ | -------------------------------------------- | ------- | ------ | ---------- | ---------------- | ----- |
| GET, POST          | `/api/v1/plugins`                            | admin   | —      | —          | legacy `{error}` |       |
| GET, PATCH, DELETE | `/api/v1/plugins/:id`                        | admin   | —      | —          | legacy `{error}` |       |
| GET                | `/api/v1/plugins/hooks`                      | admin   | —      | —          | —                |       |
| GET, POST          | `/api/v1/plugins/installations`              | admin   | —      | —          | legacy `{error}` |       |
| GET, PATCH, DELETE | `/api/v1/plugins/installations/:id`          | admin   | —      | —          | legacy `{error}` |       |
| GET                | `/api/v1/plugins/installations/:id/logs`     | admin   | —      | —          | —                |       |
| GET, PUT           | `/api/v1/plugins/installations/:id/settings` | admin   | —      | —          | legacy `{error}` |       |
| GET                | `/api/v1/plugins/marketplace`                | session | —      | —          | —                |       |

## Policies

| Method             | Path                                              | Auth                              | Module | Pagination | Errors                 | Notes |
| ------------------ | ------------------------------------------------- | --------------------------------- | ------ | ---------- | ---------------------- | ----- |
| GET                | `/api/v1/policies/compliance-dashboard`           | admin, risk_manager, dpo, auditor | dms    | —          | problem+json (wrapper) |       |
| GET, POST          | `/api/v1/policies/distributions`                  | admin, risk_manager, dpo          | dms    | —          | legacy `{error}`       |       |
| GET, PATCH, DELETE | `/api/v1/policies/distributions/:id`              | admin, risk_manager, dpo          | dms    | —          | legacy `{error}`       |       |
| POST               | `/api/v1/policies/distributions/:id/activate`     | admin, risk_manager, dpo          | dms    | —          | legacy `{error}`       |       |
| POST               | `/api/v1/policies/distributions/:id/close`        | admin, risk_manager, dpo          | dms    | —          | legacy `{error}`       |       |
| GET                | `/api/v1/policies/distributions/:id/compliance`   | admin, risk_manager, dpo          | dms    | —          | legacy `{error}`       |       |
| GET                | `/api/v1/policies/distributions/:id/export-pdf`   | admin, risk_manager, dpo, auditor | dms    | —          | legacy `{error}`       |       |
| GET, POST          | `/api/v1/policies/distributions/:id/overdue`      | admin, risk_manager, dpo          | dms    | —          | legacy `{error}`       |       |
| GET                | `/api/v1/policies/my-pending`                     | session                           | dms    | —          | —                      |       |
| GET                | `/api/v1/policies/my-pending/:distId`             | session                           | dms    | —          | legacy `{error}`       |       |
| POST               | `/api/v1/policies/my-pending/:distId/acknowledge` | session                           | dms    | —          | legacy `{error}`       |       |

## Portal

| Method    | Path                                     | Auth | Module | Pagination | Errors           | Notes                                                                                                         |
| --------- | ---------------------------------------- | ---- | ------ | ---------- | ---------------- | ------------------------------------------------------------------------------------------------------------- |
| GET       | `/api/v1/portal/dd/:token`               | —    | —      | —          | —                |                                                                                                               |
| POST      | `/api/v1/portal/dd/:token/evidence`      | —    | —      | —          | legacy `{error}` |                                                                                                               |
| PUT       | `/api/v1/portal/dd/:token/responses`     | —    | —      | —          | legacy `{error}` |                                                                                                               |
| POST      | `/api/v1/portal/dd/:token/submit`        | —    | —      | —          | legacy `{error}` |                                                                                                               |
| GET, POST | `/api/v1/portal/mailbox/:token`          | —    | —      | —          | legacy `{error}` | Case status + decrypted messages POST /api/v1/portal/mailbox/:token — Whistleblower reply                     |
| POST      | `/api/v1/portal/mailbox/:token/evidence` | —    | —      | —          | legacy `{error}` | Upload additional evidence (whistleblower)                                                                    |
| GET, POST | `/api/v1/portal/report/:orgCode`         | —    | —      | —          | legacy `{error}` | Submit whistleblower report (public, no auth) GET /api/v1/portal/report/:orgCode — Load org info for report f |

## Portals

| Method             | Path                                        | Auth    | Module | Pagination | Errors           | Notes |
| ------------------ | ------------------------------------------- | ------- | ------ | ---------- | ---------------- | ----- |
| GET                | `/api/v1/portals/audit-trail`               | admin   | —      | —          | —                |       |
| GET, PUT           | `/api/v1/portals/branding`                  | session | —      | —          | legacy `{error}` |       |
| GET, POST          | `/api/v1/portals/configs`                   | session | —      | —          | —                |       |
| GET, PATCH, DELETE | `/api/v1/portals/configs/:id`               | session | —      | —          | legacy `{error}` |       |
| GET, POST          | `/api/v1/portals/evidence`                  | session | —      | —          | legacy `{error}` |       |
| GET, PATCH         | `/api/v1/portals/questionnaires/:id`        | session | —      | —          | legacy `{error}` |       |
| POST               | `/api/v1/portals/questionnaires/:id/review` | admin   | —      | —          | legacy `{error}` |       |
| GET, POST          | `/api/v1/portals/sessions`                  | session | —      | —          | —                |       |
| GET, DELETE        | `/api/v1/portals/sessions/:id`              | session | —      | —          | legacy `{error}` |       |

## Predictive Risk

| Method             | Path                                         | Auth                         | Module | Pagination | Errors                 | Notes |
| ------------------ | -------------------------------------------- | ---------------------------- | ------ | ---------- | ---------------------- | ----- |
| GET                | `/api/v1/predictive-risk/anomalies`          | admin, risk_manager, auditor | erm    | —          | legacy `{error}`       |       |
| GET, PATCH         | `/api/v1/predictive-risk/anomalies/:id`      | admin, risk_manager, auditor | erm    | —          | legacy `{error}`       |       |
| GET                | `/api/v1/predictive-risk/correlations`       | admin, risk_manager          | erm    | —          | legacy `{error}`       |       |
| GET                | `/api/v1/predictive-risk/dashboard`          | admin, risk_manager, auditor | erm    | —          | —                      |       |
| GET, POST          | `/api/v1/predictive-risk/models`             | admin, risk_manager          | erm    | —          | problem+json (wrapper) |       |
| GET, PATCH, DELETE | `/api/v1/predictive-risk/models/:id`         | admin, risk_manager, auditor | erm    | —          | legacy `{error}`       |       |
| POST               | `/api/v1/predictive-risk/models/:id/predict` | admin, risk_manager          | erm    | —          | legacy `{error}`       |       |
| POST               | `/api/v1/predictive-risk/models/:id/train`   | admin, risk_manager          | erm    | —          | legacy `{error}`       |       |
| GET                | `/api/v1/predictive-risk/predictions`        | admin, risk_manager, auditor | erm    | —          | problem+json (wrapper) |       |
| GET                | `/api/v1/predictive-risk/radar`              | admin, risk_manager, auditor | erm    | —          | legacy `{error}`       |       |

## Processes

| Method             | Path                                                            | Auth                                                               | Module | Pagination | Errors                 | Notes                                                                                                          |
| ------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------ | ------ | ---------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| GET, POST          | `/api/v1/processes`                                             | admin, process_owner                                               | bpm    | —          | problem+json (wrapper) |                                                                                                                |
| GET, PUT, DELETE   | `/api/v1/processes/:id`                                         | session                                                            | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET, POST          | `/api/v1/processes/:id/acknowledge`                             | session                                                            | bpm    | —          | legacy `{error}`       | B2.3 Release-Cycle: Kenntnisnahme (acknowledgment) of the published process version.                           |
| POST               | `/api/v1/processes/:id/ai/map-frameworks`                       | admin, compliance_officer, process_owner                           | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 7: Suggest compliance framework mappings for a process. [ARCTOS-FULL-2026-08-31 / WP6 · S05 |
| POST               | `/api/v1/processes/:id/ai/optimize-diagram`                     | admin, process_owner, quality_manager                              | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 7: diagram-optimization-hints endpoint.                                                     |
| POST               | `/api/v1/processes/:id/ai/suggest-controls`                     | admin, process_owner, control_owner                                | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 7: Suggest controls for a process. [ARCTOS-FULL-2026-08-31 / WP6 · S05-06, S05-09, S05-10,  |
| POST               | `/api/v1/processes/:id/ai/suggest-risks`                        | admin, process_owner, risk_manager                                 | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 7: Suggest risks for a process. [ARCTOS-FULL-2026-08-31 / WP6 · S05-06, S05-09, S05-10, S05 |
| GET, POST          | `/api/v1/processes/:id/approval-steps`                          | session                                                            | bpm    | —          | legacy `{error}`       | B2.1 Release-Cycle: definable multi-stage approval chain per process version (Marktführer-Muster: 1 Prüfer → 1 |
| POST               | `/api/v1/processes/:id/approval-steps/:stepId/decide`           | session                                                            | bpm    | —          | legacy `{error}`       | B2.1 Release-Cycle: decide an approval step (approve / reject).                                                |
| GET, POST          | `/api/v1/processes/:id/assets`                                  | admin, process_owner                                               | bpm    | —          | legacy `{error}`       |                                                                                                                |
| DELETE             | `/api/v1/processes/:id/assets/:assetId`                         | admin, process_owner                                               | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET                | `/api/v1/processes/:id/audit-trail`                             | session                                                            | bpm    | limit      | legacy `{error}`       | BPM Overhaul Phase 6: Audit trail for a process — combines audit_log entries across process, process_version,  |
| GET                | `/api/v1/processes/:id/bia-impacts`                             | session                                                            | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 4: List all BIA impact records that score this process.                                     |
| GET                | `/api/v1/processes/:id/call-links`                              | session                                                            | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET, POST          | `/api/v1/processes/:id/comments`                                | session                                                            | bpm    | —          | legacy `{error}`       |                                                                                                                |
| PUT, DELETE        | `/api/v1/processes/:id/comments/:commentId`                     | session                                                            | bpm    | —          | legacy `{error}`       |                                                                                                                |
| PUT                | `/api/v1/processes/:id/comments/:commentId/resolve`             | session                                                            | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET                | `/api/v1/processes/:id/control-coverage`                        | session                                                            | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 2: Control coverage aggregation per process.                                                |
| GET, POST          | `/api/v1/processes/:id/controls`                                | admin, control_owner, process_owner                                | bpm    | —          | legacy `{error}`       |                                                                                                                |
| DELETE             | `/api/v1/processes/:id/controls/:controlId`                     | admin, control_owner, process_owner                                | bpm    | —          | legacy `{error}`       |                                                                                                                |
| POST               | `/api/v1/processes/:id/controls/bulk-link`                      | admin, process_owner, control_owner                                | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 2: Bulk-link controls to a process.                                                         |
| GET, POST, DELETE  | `/api/v1/processes/:id/coverage`                                | session                                                            | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 4: Compliance framework coverage per process. Returns all framework_mapping rows and their  |
| GET                | `/api/v1/processes/:id/dmn-links`                               | admin, process_owner, viewer                                       | bpm    | —          | —                      |                                                                                                                |
| GET, POST          | `/api/v1/processes/:id/documents`                               | admin, process_owner                                               | bpm    | —          | legacy `{error}`       |                                                                                                                |
| DELETE             | `/api/v1/processes/:id/documents/:documentId`                   | admin, process_owner                                               | bpm    | —          | legacy `{error}`       |                                                                                                                |
| POST               | `/api/v1/processes/:id/documents/bulk-attach`                   | admin, process_owner, compliance_officer, dpo                      | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 2: Bulk-attach documents to a process.                                                      |
| POST               | `/api/v1/processes/:id/event-logs`                              | admin, process_owner                                               | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 8: Webhook-style ingestion of event log batches.                                            |
| POST               | `/api/v1/processes/:id/event-logs/upload`                       | admin, process_owner                                               | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 8: CSV / XES event-log file upload.                                                         |
| GET                | `/api/v1/processes/:id/export/xml`                              | session                                                            | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET                | `/api/v1/processes/:id/findings`                                | session                                                            | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 2: List all findings tied to a process (direct or via step/control).                        |
| GET                | `/api/v1/processes/:id/framework-mappings`                      | session                                                            | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 4: Alias for /coverage — surfaces just the mapping rows.                                    |
| PATCH              | `/api/v1/processes/:id/health`                                  | admin, process_owner                                               | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET                | `/api/v1/processes/:id/health-score`                            | session                                                            | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 8: 360° Process Health Score (0–100).                                                       |
| POST               | `/api/v1/processes/:id/maturity/auto-compute`                   | admin, quality_manager, process_owner                              | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 8 D3: Auto-compute process maturity from controls + findings + KPIs.                        |
| PATCH              | `/api/v1/processes/:id/metro-layout`                            | admin, process_owner                                               | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET                | `/api/v1/processes/:id/mining/bottlenecks`                      | session                                                            | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 8 D2: Bottleneck analysis from process_conformance_result.                                  |
| GET                | `/api/v1/processes/:id/mining/rework`                           | session                                                            | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 8 D2: Rework loop analysis from process_conformance_result.                                 |
| GET                | `/api/v1/processes/:id/raci`                                    | admin, risk_manager, control_owner, process_owner, auditor, viewer | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET                | `/api/v1/processes/:id/raci/export`                             | admin, process_owner, control_owner, risk_manager, auditor, viewer | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET, PATCH, DELETE | `/api/v1/processes/:id/raci/overrides`                          | admin, process_owner                                               | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET                | `/api/v1/processes/:id/racm`                                    | session                                                            | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 3: Risk and Control Matrix (RACM) per process.                                              |
| GET, POST, DELETE  | `/api/v1/processes/:id/review-schedule`                         | session                                                            | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET                | `/api/v1/processes/:id/risk-heatmap`                            | session                                                            | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 2: Risk Heatmap aggregation per BPMN element.                                               |
| GET, POST          | `/api/v1/processes/:id/risks`                                   | admin, process_owner, risk_manager                                 | bpm    | —          | legacy `{error}`       |                                                                                                                |
| DELETE             | `/api/v1/processes/:id/risks/:riskId`                           | admin, process_owner, risk_manager                                 | bpm    | —          | legacy `{error}`       |                                                                                                                |
| POST               | `/api/v1/processes/:id/risks/bulk-link`                         | admin, process_owner, risk_manager                                 | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 2: Bulk-link risks to a process.                                                            |
| GET, PUT           | `/api/v1/processes/:id/ropa-profile`                            | session                                                            | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 4: GET/PUT GDPR Art. 30 ROPA profile per process.                                           |
| GET                | `/api/v1/processes/:id/ropa/export`                             | session                                                            | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 2 A2: Per-process ROPA export (CSV or PDF).                                                 |
| GET, POST          | `/api/v1/processes/:id/sign-off`                                | session                                                            | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 6: Sign-off endpoint with SHA-256 hash chain.                                               |
| GET                | `/api/v1/processes/:id/simulation/compare`                      | admin, process_owner, viewer                                       | bpm    | —          | legacy `{error}`       |                                                                                                                |
| POST               | `/api/v1/processes/:id/simulation/cost`                         | admin, process_owner, quality_manager                              | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 8: Cost-modeling simulation endpoint.                                                       |
| GET                | `/api/v1/processes/:id/simulation/results/:runId`               | admin, process_owner, viewer                                       | bpm    | —          | legacy `{error}`       |                                                                                                                |
| POST               | `/api/v1/processes/:id/simulation/run`                          | admin, process_owner                                               | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET, POST          | `/api/v1/processes/:id/simulation/scenarios`                    | admin, process_owner                                               | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET, PUT           | `/api/v1/processes/:id/simulation/scenarios/:scenarioId/params` | admin, process_owner                                               | bpm    | —          | legacy `{error}`       |                                                                                                                |
| PUT                | `/api/v1/processes/:id/status`                                  | admin, process_owner, auditor                                      | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET                | `/api/v1/processes/:id/step-risks`                              | session                                                            | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET                | `/api/v1/processes/:id/steps`                                   | session                                                            | bpm    | —          | legacy `{error}`       |                                                                                                                |
| PUT                | `/api/v1/processes/:id/steps/:stepId`                           | admin, process_owner                                               | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET, POST          | `/api/v1/processes/:id/steps/:stepId/assets`                    | admin, process_owner                                               | bpm    | —          | legacy `{error}`       |                                                                                                                |
| DELETE             | `/api/v1/processes/:id/steps/:stepId/assets/:assetId`           | admin, process_owner                                               | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET, POST          | `/api/v1/processes/:id/steps/:stepId/controls`                  | admin, control_owner, process_owner                                | bpm    | —          | legacy `{error}`       |                                                                                                                |
| DELETE             | `/api/v1/processes/:id/steps/:stepId/controls/:controlId`       | admin, control_owner, process_owner                                | bpm    | —          | legacy `{error}`       |                                                                                                                |
| PUT                | `/api/v1/processes/:id/steps/:stepId/line-of-defense`           | admin, process_owner, quality_manager, risk_manager                | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 3: Set Three-Lines-of-Defense on a process step.                                            |
| GET, POST          | `/api/v1/processes/:id/steps/:stepId/risks`                     | admin, process_owner, risk_manager                                 | bpm    | —          | legacy `{error}`       |                                                                                                                |
| DELETE             | `/api/v1/processes/:id/steps/:stepId/risks/:riskId`             | admin, process_owner, risk_manager                                 | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET                | `/api/v1/processes/:id/three-lines-distribution`                | session                                                            | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 3: Three-Lines-of-Defense distribution per process.                                         |
| GET                | `/api/v1/processes/:id/transitions`                             | session                                                            | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET                | `/api/v1/processes/:id/transitions/blockers`                    | session                                                            | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 3: Discovery — what gates block the next transition?                                        |
| GET                | `/api/v1/processes/:id/validate`                                | session                                                            | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET, POST          | `/api/v1/processes/:id/versions`                                | admin, process_owner                                               | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET                | `/api/v1/processes/:id/versions/:versionId`                     | session                                                            | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET                | `/api/v1/processes/:id/versions/:versionId/xml-with-grc-attrs`  | session                                                            | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 5: export a specific version's BPMN XML with current DB cross-links serialized as arctos:*  |
| GET                | `/api/v1/processes/:id/versions/compare`                        | session                                                            | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET                | `/api/v1/processes/:id/versions/compare-detailed`               | session                                                            | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 6 P6: Detailed version-compare endpoint.                                                    |
| POST               | `/api/v1/processes/:id/versions/restore`                        | admin                                                              | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET                | `/api/v1/processes/:id/vsm`                                     | session                                                            | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 8: GET value_stream_map rows for a process.                                                 |
| GET                | `/api/v1/processes/:id/walkthrough`                             | admin, risk_manager, control_owner, process_owner, auditor, viewer | bpm    | —          | legacy `{error}`       |                                                                                                                |
| POST               | `/api/v1/processes/ai/generate-from-text`                       | admin, process_owner, quality_manager                              | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 7: Generate BPMN XML from a text description.                                               |
| POST               | `/api/v1/processes/audit-pack`                                  | admin, auditor, compliance_officer, quality_manager                | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 6: Audit-Pack ZIP export — published processes for an ISO 9001 / 27001 audit. Each process  |
| POST               | `/api/v1/processes/bulk`                                        | admin, process_owner                                               | bpm    | —          | legacy `{error}`       |                                                                                                                |
| POST               | `/api/v1/processes/bulk-approve`                                | admin, quality_manager, compliance_officer                         | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 6 P6: Quality-Manager bulk-approve endpoint.                                                |
| GET                | `/api/v1/processes/cockpit`                                     | session                                                            | bpm    | —          | —                      | BPM Overhaul Phase 6: Quality Manager / Compliance Officer Cockpit.                                            |
| GET, POST          | `/api/v1/processes/generate-bpmn`                               | admin, process_owner                                               | bpm    | —          | legacy `{error}`       | AI generate BPMN (multi-provider)                                                                              |
| GET                | `/api/v1/processes/governance`                                  | admin, risk_manager, process_owner                                 | bpm    | —          | problem+json (wrapper) |                                                                                                                |
| GET                | `/api/v1/processes/governance-summary`                          | session                                                            | bpm    | —          | problem+json (wrapper) |                                                                                                                |
| GET                | `/api/v1/processes/governance/roadmap`                          | admin, risk_manager                                                | bpm    | —          | —                      |                                                                                                                |
| POST               | `/api/v1/processes/import-bpmn-xml`                             | admin, process_owner                                               | bpm    | —          | legacy `{error}`       | BPM Overhaul Phase 5: dedicated standalone import endpoint. Creates a new process from a BPMN XML payload + re |
| POST               | `/api/v1/processes/import-excel`                                | admin, process_owner                                               | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET                | `/api/v1/processes/import-excel/template`                       | admin, process_owner                                               | —      | —          | —                      |                                                                                                                |
| GET                | `/api/v1/processes/map`                                         | session                                                            | bpm    | —          | legacy `{error}`       |                                                                                                                |
| PUT                | `/api/v1/processes/map/reorder`                                 | admin, process_owner                                               | bpm    | —          | legacy `{error}`       |                                                                                                                |
| GET                | `/api/v1/processes/metro-layout`                                | admin, risk_manager, control_owner, process_owner, auditor, viewer | bpm    | —          | —                      |                                                                                                                |
| GET                | `/api/v1/processes/ropa-export`                                 | session                                                            | dpms   | —          | legacy `{error}`       | BPM Overhaul Phase 2 A2: Org-wide ROPA export derived from process_ropa_profile.                               |
| GET                | `/api/v1/processes/tree`                                        | session                                                            | bpm    | —          | —                      |                                                                                                                |

## Programmes

| Method                        | Path                                                                | Auth                               | Module    | Pagination    | Errors           | Notes                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------- | ---------------------------------- | --------- | ------------- | ---------------- | ------------------------------------------------------------------------------------------------------------- |
| GET, POST, PUT, PATCH, DELETE | `/api/v1/programmes`                                                | —                                  | —         | —             | problem+json     | #NIGHT-008/-016/-014: /api/v1/programmes root returned 404 because there is no flat "programme" entity — only |
| GET, POST                     | `/api/v1/programmes/journeys`                                       | session                            | programme | —             | legacy `{error}` | POST /api/v1/programmes/journeys                                                                              |
| GET, PATCH, DELETE            | `/api/v1/programmes/journeys/:id`                                   | session                            | programme | —             | legacy `{error}` | PATCH /api/v1/programmes/journeys/[id]                                                                        |
| POST                          | `/api/v1/programmes/journeys/:id/approval`                          | session                            | programme | —             | legacy `{error}` |                                                                                                               |
| GET                           | `/api/v1/programmes/journeys/:id/audit-pack`                        | session                            | programme | —             | legacy `{error}` |                                                                                                               |
| GET                           | `/api/v1/programmes/journeys/:id/blockers`                          | session                            | programme | —             | legacy `{error}` | Liefert alle Schritte mit blockierendem Status oder fälligen Pflicht-Bedingungen.                             |
| GET                           | `/api/v1/programmes/journeys/:id/budget`                            | session                            | programme | —             | legacy `{error}` |                                                                                                               |
| GET                           | `/api/v1/programmes/journeys/:id/dashboard`                         | session                            | programme | —             | legacy `{error}` | Aggregierte Daten für die Cockpit-Oberfläche.                                                                 |
| GET                           | `/api/v1/programmes/journeys/:id/events`                            | session                            | programme | limit, offset | legacy `{error}` | Append-only Event-Log einer Journey (paginiert).                                                              |
| GET                           | `/api/v1/programmes/journeys/:id/maturity`                          | session                            | —         | —             | legacy `{error}` |                                                                                                               |
| GET                           | `/api/v1/programmes/journeys/:id/next-actions`                      | session                            | programme | limit         | legacy `{error}` | Liefert die priorisierten nächsten Aktionen für die Journey.                                                  |
| GET                           | `/api/v1/programmes/journeys/:id/predictive`                        | session                            | programme | —             | problem+json     |                                                                                                               |
| GET, POST                     | `/api/v1/programmes/journeys/:id/steps`                             | session                            | programme | —             | legacy `{error}` | Liste aller Schritte POST /api/v1/programmes/journeys/[id]/steps — Custom-Step hinzufügen (Org-Anpassung)     |
| GET, PATCH                    | `/api/v1/programmes/journeys/:id/steps/:stepId`                     | session                            | programme | —             | legacy `{error}` | PATCH /api/v1/programmes/journeys/[id]/steps/[stepId]                                                         |
| POST, DELETE                  | `/api/v1/programmes/journeys/:id/steps/:stepId/evidence`            | admin, risk_manager, control_owner | programme | —             | legacy `{error}` | DELETE /api/v1/programmes/journeys/[id]/steps/[stepId]/evidence?index=N                                       |
| GET                           | `/api/v1/programmes/journeys/:id/steps/:stepId/evidence/suggest`    | session                            | programme | —             | legacy `{error}` |                                                                                                               |
| POST                          | `/api/v1/programmes/journeys/:id/steps/:stepId/evidence/upload`     | admin, risk_manager, control_owner | programme | —             | legacy `{error}` |                                                                                                               |
| GET, POST                     | `/api/v1/programmes/journeys/:id/steps/:stepId/links`               | session                            | programme | —             | legacy `{error}` | POST /api/v1/programmes/journeys/[id]/steps/[stepId]/links                                                    |
| DELETE                        | `/api/v1/programmes/journeys/:id/steps/:stepId/links/:linkId`       | admin, risk_manager, control_owner | programme | —             | legacy `{error}` |                                                                                                               |
| GET, POST                     | `/api/v1/programmes/journeys/:id/steps/:stepId/subtasks`            | session                            | programme | —             | legacy `{error}` | POST /api/v1/programmes/journeys/[id]/steps/[stepId]/subtasks                                                 |
| PATCH, DELETE                 | `/api/v1/programmes/journeys/:id/steps/:stepId/subtasks/:subtaskId` | admin, risk_manager, control_owner | programme | —             | legacy `{error}` | DELETE /api/v1/programmes/journeys/[id]/steps/[stepId]/subtasks/[subtaskId]                                   |
| PATCH                         | `/api/v1/programmes/journeys/:id/steps/:stepId/subtasks/bulk`       | admin, risk_manager, control_owner | programme | —             | legacy `{error}` |                                                                                                               |
| POST                          | `/api/v1/programmes/journeys/:id/steps/:stepId/transition`          | admin, risk_manager, control_owner | programme | —             | legacy `{error}` |                                                                                                               |
| GET                           | `/api/v1/programmes/journeys/:id/synthetic-audit`                   | session                            | programme | —             | legacy `{error}` |                                                                                                               |
| GET                           | `/api/v1/programmes/journeys/:id/timeline`                          | session                            | programme | —             | legacy `{error}` | Daten für eine Gantt-Darstellung (Phasen + Milestones).                                                       |
| POST                          | `/api/v1/programmes/journeys/:id/transition`                        | admin, risk_manager                | programme | —             | legacy `{error}` | Manueller Status-Übergang einer Journey (planned/active/archived/completed).                                  |
| GET                           | `/api/v1/programmes/my-work`                                        | session                            | programme | —             | —                |                                                                                                               |
| GET                           | `/api/v1/programmes/portfolio`                                      | session                            | programme | —             | —                |                                                                                                               |
| POST                          | `/api/v1/programmes/reverse-from-finding`                           | admin, risk_manager, auditor       | programme | —             | legacy `{error}` |                                                                                                               |
| GET                           | `/api/v1/programmes/templates`                                      | session                            | programme | —             | —                | Liste aller veröffentlichten Templates (filterbar nach msType).                                               |
| GET                           | `/api/v1/programmes/templates/:id`                                  | session                            | programme | —             | legacy `{error}` | Template-Detail inkl. aller Phasen + Schritte.                                                                |
| GET                           | `/api/v1/programmes/users`                                          | session                            | programme | —             | —                |                                                                                                               |

## Questionnaire Templates

| Method           | Path                                                                | Auth                | Module | Pagination | Errors           | Notes |
| ---------------- | ------------------------------------------------------------------- | ------------------- | ------ | ---------- | ---------------- | ----- |
| GET, POST        | `/api/v1/questionnaire-templates`                                   | admin, risk_manager | tprm   | —          | legacy `{error}` |       |
| GET, PUT, DELETE | `/api/v1/questionnaire-templates/:id`                               | session             | tprm   | —          | legacy `{error}` |       |
| POST             | `/api/v1/questionnaire-templates/:id/publish`                       | admin               | tprm   | —          | legacy `{error}` |       |
| GET, POST        | `/api/v1/questionnaire-templates/:id/sections`                      | admin, risk_manager | tprm   | —          | legacy `{error}` |       |
| GET, POST        | `/api/v1/questionnaire-templates/:id/sections/:sectionId/questions` | admin, risk_manager | tprm   | —          | legacy `{error}` |       |

## Rcsa

| Method           | Path                                       | Auth                | Module | Pagination | Errors           | Notes                                                               |
| ---------------- | ------------------------------------------ | ------------------- | ------ | ---------- | ---------------- | ------------------------------------------------------------------- |
| GET              | `/api/v1/rcsa`                             | —                   | —      | —          | —                | #NIGHT-014: /api/v1/rcsa root returned 404 — only sub-routes exist. |
| GET              | `/api/v1/rcsa/assignments/:id`             | session             | erm    | —          | legacy `{error}` |                                                                     |
| PUT              | `/api/v1/rcsa/assignments/:id/respond`     | session             | erm    | —          | legacy `{error}` |                                                                     |
| GET, POST        | `/api/v1/rcsa/campaigns`                   | admin, risk_manager | erm    | —          | legacy `{error}` |                                                                     |
| GET, PUT, DELETE | `/api/v1/rcsa/campaigns/:id`               | session             | erm    | —          | legacy `{error}` |                                                                     |
| GET              | `/api/v1/rcsa/campaigns/:id/assignments`   | session             | erm    | —          | legacy `{error}` |                                                                     |
| POST             | `/api/v1/rcsa/campaigns/:id/close`         | admin, risk_manager | erm    | —          | legacy `{error}` |                                                                     |
| GET              | `/api/v1/rcsa/campaigns/:id/completion`    | admin, risk_manager | erm    | —          | legacy `{error}` |                                                                     |
| GET              | `/api/v1/rcsa/campaigns/:id/discrepancies` | session             | erm    | —          | legacy `{error}` |                                                                     |
| GET              | `/api/v1/rcsa/campaigns/:id/export-pdf`    | admin, risk_manager | erm    | —          | legacy `{error}` |                                                                     |
| GET              | `/api/v1/rcsa/campaigns/:id/heatmap`       | session             | erm    | —          | legacy `{error}` |                                                                     |
| POST             | `/api/v1/rcsa/campaigns/:id/launch`        | admin, risk_manager | erm    | —          | legacy `{error}` |                                                                     |
| GET              | `/api/v1/rcsa/campaigns/:id/results`       | session             | erm    | —          | legacy `{error}` |                                                                     |
| GET              | `/api/v1/rcsa/campaigns/:id/trend`         | session             | erm    | —          | legacy `{error}` |                                                                     |
| GET              | `/api/v1/rcsa/my-assignments`              | session             | erm    | —          | —                |                                                                     |

## References

| Method | Path                                               | Auth    | Module | Pagination | Errors | Notes |
| ------ | -------------------------------------------------- | ------- | ------ | ---------- | ------ | ----- |
| GET    | `/api/v1/references/:entityType/:entityId`         | session | —      | —          | —      |       |
| GET    | `/api/v1/references/:entityType/:entityId/impact`  | session | —      | —          | —      |       |
| GET    | `/api/v1/references/:entityType/:entityId/used-by` | session | —      | —          | —      |       |
| GET    | `/api/v1/references/:entityType/:entityId/uses`    | session | —      | —          | —      |       |
| GET    | `/api/v1/references/stats`                         | session | —      | —          | —      |       |

## Regulatory

| Method | Path                          | Auth    | Module | Pagination  | Errors           | Notes |
| ------ | ----------------------------- | ------- | ------ | ----------- | ---------------- | ----- |
| GET    | `/api/v1/regulatory/feed`     | session | —      | limit, page | legacy `{error}` |       |
| GET    | `/api/v1/regulatory/relevant` | session | —      | —           | —                |       |

## Regulatory Changes

| Method             | Path                                            | Auth                                             | Module | Pagination | Errors           | Notes |
| ------------------ | ----------------------------------------------- | ------------------------------------------------ | ------ | ---------- | ---------------- | ----- |
| GET, POST          | `/api/v1/regulatory-changes/calendar`           | admin, dpo, risk_manager                         | —      | —          | legacy `{error}` |       |
| PATCH, DELETE      | `/api/v1/regulatory-changes/calendar/:id`       | admin, dpo, risk_manager                         | —      | —          | legacy `{error}` |       |
| GET                | `/api/v1/regulatory-changes/changes`            | admin, dpo, risk_manager, auditor, control_owner | —      | —          | legacy `{error}` |       |
| GET, PATCH         | `/api/v1/regulatory-changes/changes/:id`        | admin, dpo, risk_manager, auditor, control_owner | —      | —          | legacy `{error}` |       |
| GET, POST          | `/api/v1/regulatory-changes/changes/:id/impact` | admin, dpo, risk_manager                         | —      | —          | legacy `{error}` |       |
| GET                | `/api/v1/regulatory-changes/dashboard`          | admin, dpo, risk_manager, auditor                | —      | —          | —                |       |
| GET, POST          | `/api/v1/regulatory-changes/digests`            | admin, dpo                                       | —      | —          | legacy `{error}` |       |
| GET, POST          | `/api/v1/regulatory-changes/sources`            | admin, dpo                                       | —      | —          | legacy `{error}` |       |
| GET, PATCH, DELETE | `/api/v1/regulatory-changes/sources/:id`        | admin, dpo, risk_manager, auditor                | —      | —          | legacy `{error}` |       |

## Reports

| Method           | Path                                | Auth                                                | Module    | Pagination | Errors                 | Notes                                                                                                          |
| ---------------- | ----------------------------------- | --------------------------------------------------- | --------- | ---------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| GET              | `/api/v1/reports`                   | —                                                   | —         | —          | —                      | #NIGHT-014: /api/v1/reports root returned 404 — only sub-routes exist. Discovery payload helps API clients fin |
| GET              | `/api/v1/reports/compliance-status` | admin, ciso, quality_manager, risk_manager, auditor | reporting | —          | problem+json (wrapper) |                                                                                                                |
| GET              | `/api/v1/reports/data-sources`      | session                                             | reporting | —          | —                      |                                                                                                                |
| POST             | `/api/v1/reports/generate`          | session                                             | reporting | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/reports/history`           | session                                             | reporting | —          | —                      |                                                                                                                |
| GET              | `/api/v1/reports/jobs/:id`          | session                                             | reporting | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/reports/jobs/:id/download` | session                                             | reporting | —          | legacy `{error}`       |                                                                                                                |
| POST             | `/api/v1/reports/preview`           | session                                             | reporting | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/reports/risk-register`     | admin, ciso, quality_manager, risk_manager, auditor | reporting | —          | problem+json (wrapper) |                                                                                                                |
| GET, POST        | `/api/v1/reports/schedules`         | session                                             | reporting | —          | legacy `{error}`       |                                                                                                                |
| GET, PUT, DELETE | `/api/v1/reports/schedules/:id`     | session                                             | reporting | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/reports/soa`               | admin, ciso, quality_manager, risk_manager, auditor | reporting | —          | problem+json (wrapper) |                                                                                                                |
| GET, POST        | `/api/v1/reports/templates`         | session                                             | reporting | —          | problem+json (wrapper) |                                                                                                                |
| GET, PUT, DELETE | `/api/v1/reports/templates/:id`     | session                                             | reporting | —          | legacy `{error}`       |                                                                                                                |

## Retention Policies

| Method           | Path                             | Auth    | Module | Pagination | Errors           | Notes |
| ---------------- | -------------------------------- | ------- | ------ | ---------- | ---------------- | ----- |
| GET, POST        | `/api/v1/retention-policies`     | session | dms    | —          | legacy `{error}` |       |
| GET, PUT, DELETE | `/api/v1/retention-policies/:id` | session | dms    | —          | legacy `{error}` |       |

## Risk Acceptance

| Method   | Path                                | Auth                                                                     | Module | Pagination | Errors           | Notes                                  |
| -------- | ----------------------------------- | ------------------------------------------------------------------------ | ------ | ---------- | ---------------- | -------------------------------------- |
| GET, PUT | `/api/v1/risk-acceptance/authority` | admin, risk_manager, process_owner, ciso, control_owner, auditor, viewer | erm    | —          | legacy `{error}` | Risk-Acceptance Authority Matrix CRUD. |

## Risk Acceptances

| Method     | Path                           | Auth                                                                     | Module | Pagination | Errors                 | Notes                                                    |
| ---------- | ------------------------------ | ------------------------------------------------------------------------ | ------ | ---------- | ---------------------- | -------------------------------------------------------- |
| GET, POST  | `/api/v1/risk-acceptances`     | admin, risk_manager, process_owner, ciso, control_owner, auditor, viewer | erm    | —          | problem+json (wrapper) | org-wide risk-acceptance review list.                    |
| GET, PATCH | `/api/v1/risk-acceptances/:id` | admin, risk_manager, process_owner, ciso, control_owner, auditor, viewer | erm    | —          | legacy `{error}`       | /api/v1/risk-acceptances/[id] — detail + limited update. |

## Risk Quantification

| Method             | Path                                                  | Auth                | Module | Pagination | Errors                 | Notes                       |
| ------------------ | ----------------------------------------------------- | ------------------- | ------ | ---------- | ---------------------- | --------------------------- |
| GET, POST          | `/api/v1/risk-quantification/appetite`                | session             | erm    | —          | —                      |                             |
| GET, PATCH, DELETE | `/api/v1/risk-quantification/appetite/:id`            | session             | erm    | —          | legacy `{error}`       |                             |
| GET, PUT           | `/api/v1/risk-quantification/config`                  | session             | erm    | —          | —                      |                             |
| GET, POST          | `/api/v1/risk-quantification/executive-summaries`     | session             | erm    | —          | —                      |                             |
| GET, PATCH         | `/api/v1/risk-quantification/executive-summaries/:id` | session             | erm    | —          | legacy `{error}`       |                             |
| POST               | `/api/v1/risk-quantification/export`                  | admin, risk_manager | erm    | —          | legacy `{error}`       |                             |
| GET                | `/api/v1/risk-quantification/scenarios`               | session             | erm    | —          | problem+json (wrapper) | list FAIR-quantified risks. |
| GET, POST          | `/api/v1/risk-quantification/sensitivity`             | session             | erm    | —          | —                      |                             |
| GET                | `/api/v1/risk-quantification/sensitivity/:id`         | session             | erm    | —          | legacy `{error}`       |                             |
| GET, POST          | `/api/v1/risk-quantification/var-calculations`        | session             | erm    | —          | —                      |                             |
| GET                | `/api/v1/risk-quantification/var-calculations/:id`    | session             | erm    | —          | legacy `{error}`       |                             |

## Risk Treatment Links

| Method            | Path                           | Auth                               | Module | Pagination | Errors           | Notes |
| ----------------- | ------------------------------ | ---------------------------------- | ------ | ---------- | ---------------- | ----- |
| GET, POST, DELETE | `/api/v1/risk-treatment-links` | admin, risk_manager, control_owner | erm    | —          | legacy `{error}` |       |

## Risks

| Method           | Path                                                | Auth                                                               | Module | Pagination | Errors                 | Notes                                                                                                          |
| ---------------- | --------------------------------------------------- | ------------------------------------------------------------------ | ------ | ---------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| GET, POST        | `/api/v1/risks`                                     | admin, risk_manager, control_owner, process_owner                  | erm    | —          | problem+json           |                                                                                                                |
| GET, PUT, DELETE | `/api/v1/risks/:id`                                 | session                                                            | erm    | —          | legacy `{error}`       |                                                                                                                |
| GET, POST        | `/api/v1/risks/:id/acceptance`                      | admin, risk_manager, process_owner, ciso, control_owner            | erm    | —          | legacy `{error}`       | Risk Acceptance API — ISO 27005 Clause 10 formal-acceptance flow.                                              |
| PATCH            | `/api/v1/risks/:id/acceptance/:acceptanceId/revoke` | admin, risk_manager, ciso                                          | erm    | —          | legacy `{error}`       |                                                                                                                |
| PUT              | `/api/v1/risks/:id/assessment`                      | admin, risk_manager, control_owner, process_owner, ciso            | erm    | —          | legacy `{error}`       |                                                                                                                |
| GET, POST        | `/api/v1/risks/:id/asset-links`                     | admin, risk_manager, control_owner                                 | erm    | —          | legacy `{error}`       |                                                                                                                |
| DELETE           | `/api/v1/risks/:id/asset-links/:linkId`             | admin, risk_manager, control_owner                                 | erm    | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/risks/:id/assets`                          | session                                                            | erm    | —          | —                      | #WAVE6-CROSS-02: which assets are exposed to this risk? Joins risk_asset + asset.                              |
| GET              | `/api/v1/risks/:id/audit-impact`                    | session                                                            | erm    | —          | legacy `{error}`       |                                                                                                                |
| GET, POST        | `/api/v1/risks/:id/comments`                        | session                                                            | erm    | —          | —                      |                                                                                                                |
| GET              | `/api/v1/risks/:id/controls`                        | session                                                            | erm    | —          | —                      | #WAVE6-CROSS-02: which controls mitigate this risk? Joins risk_control + control. Soft-deleted controls are fi |
| GET              | `/api/v1/risks/:id/documents`                       | session                                                            | erm    | —          | —                      |                                                                                                                |
| GET              | `/api/v1/risks/:id/evaluation-log`                  | admin, risk_manager, control_owner, process_owner, auditor, viewer | erm    | —          | —                      |                                                                                                                |
| PATCH            | `/api/v1/risks/:id/evaluation-phase`                | admin, risk_manager, control_owner, process_owner                  | erm    | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/risks/:id/findings`                        | session                                                            | erm    | —          | —                      |                                                                                                                |
| GET, POST        | `/api/v1/risks/:id/framework-mappings`              | admin, risk_manager                                                | erm    | —          | legacy `{error}`       |                                                                                                                |
| DELETE           | `/api/v1/risks/:id/framework-mappings/:mappingId`   | admin, risk_manager                                                | erm    | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/risks/:id/history`                         | session                                                            | erm    | —          | —                      |                                                                                                                |
| GET, POST        | `/api/v1/risks/:id/process-links`                   | admin, risk_manager, process_owner                                 | erm    | —          | legacy `{error}`       |                                                                                                                |
| DELETE           | `/api/v1/risks/:id/process-links/:linkId`           | admin, risk_manager, process_owner                                 | erm    | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/risks/:id/processes`                       | session                                                            | erm    | —          | —                      | #WAVE6-CROSS-02: which processes are exposed to this risk? Joins process_risk + process. process_risk.processI |
| GET              | `/api/v1/risks/:id/residual-auto`                   | session                                                            | erm    | —          | legacy `{error}`       |                                                                                                                |
| PUT, PATCH       | `/api/v1/risks/:id/status`                          | admin, risk_manager, process_owner, ciso                           | erm    | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/risks/:id/transitions`                     | session                                                            | erm    | —          | legacy `{error}`       |                                                                                                                |
| GET, POST        | `/api/v1/risks/:id/treatments`                      | admin, risk_manager, control_owner, process_owner                  | erm    | —          | legacy `{error}`       |                                                                                                                |
| PUT, DELETE      | `/api/v1/risks/:id/treatments/:treatmentId`         | admin, risk_manager, process_owner, control_owner                  | erm    | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/risks/audit-impact-summary`                | session                                                            | erm    | —          | —                      |                                                                                                                |
| POST             | `/api/v1/risks/bulk`                                | admin, risk_manager, control_owner, process_owner                  | erm    | —          | problem+json (wrapper) |                                                                                                                |
| GET              | `/api/v1/risks/dashboard-summary`                   | session                                                            | erm    | —          | —                      |                                                                                                                |
| GET              | `/api/v1/risks/export`                              | admin, risk_manager, auditor                                       | erm    | —          | legacy `{error}`       |                                                                                                                |
| GET              | `/api/v1/risks/group-summary`                       | admin, risk_manager                                                | erm    | —          | —                      |                                                                                                                |
| GET              | `/api/v1/risks/heatmap`                             | session                                                            | erm    | —          | problem+json (wrapper) |                                                                                                                |
| GET              | `/api/v1/risks/treatments/budget`                   | session                                                            | erm    | —          | problem+json (wrapper) |                                                                                                                |

## Roi

| Method | Path                    | Auth                         | Module | Pagination | Errors           | Notes |
| ------ | ----------------------- | ---------------------------- | ------ | ---------- | ---------------- | ----- |
| GET    | `/api/v1/roi/overview`  | admin, risk_manager, auditor | —      | —          | —                |       |
| POST   | `/api/v1/roi/recompute` | admin, risk_manager          | —      | —          | legacy `{error}` |       |

## Role Dashboards

| Method             | Path                                              | Auth                | Module | Pagination | Errors           | Notes |
| ------------------ | ------------------------------------------------- | ------------------- | ------ | ---------- | ---------------- | ----- |
| GET, POST          | `/api/v1/role-dashboards/configs`                 | session             | —      | —          | —                |       |
| GET, PATCH, DELETE | `/api/v1/role-dashboards/configs/:id`             | session             | —      | —          | legacy `{error}` |       |
| GET                | `/api/v1/role-dashboards/data/auditor`            | admin, auditor      | —      | —          | —                |       |
| GET                | `/api/v1/role-dashboards/data/board`              | admin, risk_manager | —      | —          | —                |       |
| GET                | `/api/v1/role-dashboards/data/cfo`                | admin, risk_manager | —      | —          | —                |       |
| GET                | `/api/v1/role-dashboards/data/ciso`               | admin, risk_manager | —      | —          | —                |       |
| GET                | `/api/v1/role-dashboards/data/department-manager` | session             | —      | —          | problem+json     |       |
| GET, POST, PUT     | `/api/v1/role-dashboards/preferences`             | session             | —      | —          | —                |       |

## Roni

| Method | Path                    | Auth                         | Module | Pagination | Errors           | Notes |
| ------ | ----------------------- | ---------------------------- | ------ | ---------- | ---------------- | ----- |
| GET    | `/api/v1/roni/overview` | admin, risk_manager, auditor | —      | —          | —                |       |
| POST   | `/api/v1/roni/scenario` | admin, risk_manager          | —      | —          | legacy `{error}` |       |
| GET    | `/api/v1/roni/vs-roi`   | admin, risk_manager, auditor | —      | —          | —                |       |

## Scim

| Method                  | Path                         | Auth | Module | Pagination | Errors | Notes |
| ----------------------- | ---------------------------- | ---- | ------ | ---------- | ------ | ----- |
| GET, POST               | `/api/v1/scim/v2/Groups`     | —    | —      | —          | —      |       |
| GET, PATCH              | `/api/v1/scim/v2/Groups/:id` | —    | —      | —          | —      |       |
| GET, POST               | `/api/v1/scim/v2/Users`      | —    | —      | —          | —      |       |
| GET, PUT, PATCH, DELETE | `/api/v1/scim/v2/Users/:id`  | —    | —      | —          | —      |       |

## Search

| Method | Path             | Auth    | Module | Pagination | Errors                 | Notes |
| ------ | ---------------- | ------- | ------ | ---------- | ---------------------- | ----- |
| GET    | `/api/v1/search` | session | dms    | limit      | problem+json (wrapper) |       |

## Signature Requests

| Method | Path                                                | Auth    | Module | Pagination | Errors           | Notes                                                                                                          |
| ------ | --------------------------------------------------- | ------- | ------ | ---------- | ---------------- | -------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/v1/signature-requests/:requestId`             | session | dms    | —          | legacy `{error}` | W21-DMS-MULTISIGN-01: Signature request detail (request + signer slots).                                       |
| POST   | `/api/v1/signature-requests/:requestId/cancel`      | session | dms    | —          | legacy `{error}` | W21-DMS-MULTISIGN-01: Cancel a pending signature request. Only the creator or an org admin may cancel; only wh |
| GET    | `/api/v1/signature-requests/:requestId/certificate` | session | dms    | —          | —                | W21-DMS-MULTISIGN-01: Signature certificate as PDF — the audit evidence document for a signing ceremony.       |
| POST   | `/api/v1/signature-requests/:requestId/decline`     | session | dms    | —          | legacy `{error}` | W21-DMS-MULTISIGN-01: Decline a document signature request.                                                    |
| POST   | `/api/v1/signature-requests/:requestId/sign`        | session | dms    | —          | —                | W21-DMS-MULTISIGN-01: Sign a document signature request.                                                       |
| GET    | `/api/v1/signature-requests/:requestId/verify`      | session | dms    | —          | —                | W21-DMS-MULTISIGN-01: Verify the signature hash chain + file integrity.                                        |

## Simulations

| Method             | Path                                  | Auth    | Module | Pagination | Errors           | Notes |
| ------------------ | ------------------------------------- | ------- | ------ | ---------- | ---------------- | ----- |
| GET, POST          | `/api/v1/simulations/comparisons`     | session | —      | —          | —                |       |
| GET, PATCH, DELETE | `/api/v1/simulations/comparisons/:id` | session | —      | —          | legacy `{error}` |       |
| GET, POST          | `/api/v1/simulations/parameters`      | session | —      | —          | legacy `{error}` |       |
| GET, POST          | `/api/v1/simulations/runs`            | session | —      | —          | legacy `{error}` |       |
| GET                | `/api/v1/simulations/runs/:id`        | session | —      | —          | legacy `{error}` |       |
| GET, POST          | `/api/v1/simulations/scenarios`       | session | —      | —          | —                |       |
| GET, PATCH, DELETE | `/api/v1/simulations/scenarios/:id`   | session | —      | —          | legacy `{error}` |       |

## Subscriptions

| Method            | Path                              | Auth    | Module | Pagination | Errors           | Notes |
| ----------------- | --------------------------------- | ------- | ------ | ---------- | ---------------- | ----- |
| GET, POST, DELETE | `/api/v1/subscriptions/current`   | admin   | —      | —          | legacy `{error}` |       |
| GET, POST         | `/api/v1/subscriptions/plans`     | session | —      | —          | legacy `{error}` |       |
| GET, PATCH        | `/api/v1/subscriptions/plans/:id` | session | —      | —          | legacy `{error}` |       |

## Tags

| Method    | Path           | Auth    | Module | Pagination | Errors       | Notes                                                                                    |
| --------- | -------------- | ------- | ------ | ---------- | ------------ | ---------------------------------------------------------------------------------------- |
| GET, POST | `/api/v1/tags` | session | —      | limit      | problem+json | List tag definitions for the current org POST /api/v1/tags — Create a new tag definition |

## Tasks

| Method           | Path                         | Auth                                             | Module | Pagination | Errors                 | Notes |
| ---------------- | ---------------------------- | ------------------------------------------------ | ------ | ---------- | ---------------------- | ----- |
| GET, POST        | `/api/v1/tasks`              | admin, risk_manager, dpo, auditor, control_owner | —      | —          | problem+json (wrapper) |       |
| GET, PUT, DELETE | `/api/v1/tasks/:id`          | session                                          | —      | —          | legacy `{error}`       |       |
| GET, POST        | `/api/v1/tasks/:id/comments` | session                                          | —      | —          | legacy `{error}`       |       |
| POST             | `/api/v1/tasks/:id/notify`   | admin                                            | —      | —          | legacy `{error}`       |       |
| PUT              | `/api/v1/tasks/:id/status`   | session                                          | —      | —          | legacy `{error}`       |       |

## Tax Cms

| Method             | Path                                | Auth                                                | Module | Pagination | Errors           | Notes |
| ------------------ | ----------------------------------- | --------------------------------------------------- | ------ | ---------- | ---------------- | ----- |
| GET, POST          | `/api/v1/tax-cms/audit-preps`       | admin, risk_manager                                 | —      | —          | legacy `{error}` |       |
| GET, PATCH         | `/api/v1/tax-cms/audit-preps/:id`   | admin, risk_manager, auditor, viewer                | —      | —          | legacy `{error}` |       |
| GET                | `/api/v1/tax-cms/dashboard`         | admin, risk_manager, auditor, viewer                | —      | —          | —                |       |
| GET, POST          | `/api/v1/tax-cms/elements`          | admin, risk_manager                                 | —      | —          | legacy `{error}` |       |
| GET, PATCH         | `/api/v1/tax-cms/elements/:id`      | admin, risk_manager, auditor, viewer                | —      | —          | legacy `{error}` |       |
| GET, POST          | `/api/v1/tax-cms/gobd-archives`     | admin, risk_manager                                 | —      | —          | legacy `{error}` |       |
| GET, PATCH         | `/api/v1/tax-cms/gobd-archives/:id` | admin, risk_manager, auditor, viewer                | —      | —          | legacy `{error}` |       |
| GET, POST          | `/api/v1/tax-cms/icfr-controls`     | admin, risk_manager                                 | ics    | —          | legacy `{error}` |       |
| GET, PATCH         | `/api/v1/tax-cms/icfr-controls/:id` | admin, risk_manager, auditor, control_owner, viewer | ics    | —          | legacy `{error}` |       |
| GET, POST          | `/api/v1/tax-cms/risks`             | admin, risk_manager                                 | erm    | —          | legacy `{error}` |       |
| GET, PATCH, DELETE | `/api/v1/tax-cms/risks/:id`         | admin, risk_manager, auditor, viewer                | erm    | —          | legacy `{error}` |       |

## Template Packs

| Method | Path                               | Auth    | Module | Pagination | Errors           | Notes |
| ------ | ---------------------------------- | ------- | ------ | ---------- | ---------------- | ----- |
| GET    | `/api/v1/template-packs`           | session | —      | —          | —                |       |
| GET    | `/api/v1/template-packs/:id`       | session | —      | —          | legacy `{error}` |       |
| POST   | `/api/v1/template-packs/:id/apply` | admin   | —      | —          | legacy `{error}` |       |

## Time Entries

| Method    | Path                   | Auth                         | Module | Pagination | Errors           | Notes |
| --------- | ---------------------- | ---------------------------- | ------ | ---------- | ---------------- | ----- |
| GET, POST | `/api/v1/time-entries` | admin, risk_manager, auditor | —      | —          | legacy `{error}` |       |

## Tprm

| Method    | Path                                             | Auth                                                        | Module | Pagination | Errors                 | Notes                                                                                                          |
| --------- | ------------------------------------------------ | ----------------------------------------------------------- | ------ | ---------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| GET, POST | `/api/v1/tprm/concentration`                     | admin, risk_manager, vendor_manager, contract_manager, ciso | tprm   | —          | problem+json (wrapper) |                                                                                                                |
| GET       | `/api/v1/tprm/contracts/:id/obligations-status`  | session                                                     | tprm   | —          | legacy `{error}`       | TPRM Overhaul: per-contract obligation status with due/overdue counts.                                         |
| GET       | `/api/v1/tprm/contracts/renewal-watch`           | session                                                     | tprm   | —          | —                      | TPRM Overhaul: contracts due for renewal in the next 90 days + overdue.                                        |
| GET, POST | `/api/v1/tprm/erm-sync`                          | admin, risk_manager                                         | tprm   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST | `/api/v1/tprm/exit-plans`                        | admin, risk_manager                                         | tprm   | —          | legacy `{error}`       |                                                                                                                |
| GET       | `/api/v1/tprm/scorecards`                        | admin, risk_manager, process_owner                          | tprm   | —          | —                      |                                                                                                                |
| GET, POST | `/api/v1/tprm/sla-definitions`                   | admin, risk_manager, process_owner                          | tprm   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST | `/api/v1/tprm/sla-measurements`                  | admin, risk_manager, process_owner                          | tprm   | —          | legacy `{error}`       |                                                                                                                |
| GET, POST | `/api/v1/tprm/sub-processors`                    | admin, risk_manager, dpo                                    | tprm   | —          | legacy `{error}`       |                                                                                                                |
| GET       | `/api/v1/tprm/templates`                         | admin, risk_manager, process_owner                          | tprm   | —          | legacy `{error}`       |                                                                                                                |
| POST      | `/api/v1/tprm/vendors/:id/ai/classify`           | admin, vendor_manager, compliance_officer                   | tprm   | —          | legacy `{error}`       | TPRM Overhaul: AI vendor classification suggester.                                                             |
| POST      | `/api/v1/tprm/vendors/:id/ai/draft-dd-questions` | admin, vendor_manager, compliance_officer                   | tprm   | —          | legacy `{error}`       | TPRM Overhaul: AI due-diligence question drafter. [ARCTOS-FULL-2026-08-31 / WP6 · S05-06, S05-09, S05-10, S05- |
| GET       | `/api/v1/tprm/vendors/:id/cross-module`          | session                                                     | tprm   | —          | legacy `{error}`       | TPRM Overhaul: cross-module aggregation per vendor.                                                            |
| POST      | `/api/v1/tprm/vendors/:id/designate`             | admin, vendor_manager, compliance_officer, ciso             | tprm   | —          | legacy `{error}`       | TPRM Overhaul: flag a vendor as DORA-critical-ICT or LkSG-tier-1.                                              |
| POST      | `/api/v1/tprm/vendors/:id/onboarding-pack`       | admin, vendor_manager, compliance_officer                   | tprm   | —          | legacy `{error}`       | TPRM Overhaul: vendor onboarding pack (ZIP).                                                                   |
| GET, POST | `/api/v1/tprm/vendors/:id/sign-off`              | session                                                     | tprm   | —          | legacy `{error}`       | TPRM Overhaul: vendor sign-off with hash chain.                                                                |
| GET       | `/api/v1/tprm/vendors/:id/transitions`           | session                                                     | tprm   | —          | legacy `{error}`       |                                                                                                                |
| GET       | `/api/v1/tprm/vendors/:id/transitions/blockers`  | session                                                     | tprm   | —          | legacy `{error}`       | TPRM Overhaul: discovery — what blocks the next vendor transition?                                             |

## Translations

| Method   | Path                                         | Auth                                                   | Module | Pagination  | Errors           | Notes                                                                                                          |
| -------- | -------------------------------------------- | ------------------------------------------------------ | ------ | ----------- | ---------------- | -------------------------------------------------------------------------------------------------------------- |
| GET, PUT | `/api/v1/translations/:entityType/:entityId` | session                                                | —      | —           | legacy `{error}` | Sprint 21: GET/PUT translations for a specific entity GET /api/v1/translations/:entityType/:entityId?locale=al |
| POST     | `/api/v1/translations/ai-translate`          | admin, risk_manager, control_owner, process_owner, dpo | —      | —           | legacy `{error}` | Sprint 21: AI Translation API POST /api/v1/translations/ai-translate                                           |
| GET      | `/api/v1/translations/export`                | admin, risk_manager                                    | —      | —           | legacy `{error}` | Sprint 21: Translation Export API GET /api/v1/translations/export?entityType=risk&source=de&target=en&format=x |
| GET      | `/api/v1/translations/heatmap`               | session                                                | —      | —           | —                | Sprint 21: Translation Heatmap API GET /api/v1/translations/heatmap — returns completion % per entity type per |
| POST     | `/api/v1/translations/import`                | admin, risk_manager                                    | —      | —           | legacy `{error}` | Sprint 21: Translation Import API POST /api/v1/translations/import — Import XLIFF or CSV translations          |
| GET      | `/api/v1/translations/progress`              | session                                                | —      | —           | legacy `{error}` | Sprint 21: Translation Progress API GET /api/v1/translations/progress?entityType=risk&targetLocale=en          |
| GET      | `/api/v1/translations/queue`                 | session                                                | —      | limit, page | legacy `{error}` | Sprint 21: Translation Queue API GET /api/v1/translations/queue?targetLocale=en&status=missing&entityType=risk |
| GET, PUT | `/api/v1/translations/status`                | session                                                | —      | —           | legacy `{error}` | Sprint 21: Translation Status API GET /api/v1/translations/status?entityType=risk&entityId=<uuid> — get all st |
| POST     | `/api/v1/translations/verify`                | admin, risk_manager, control_owner, process_owner, dpo | —      | —           | legacy `{error}` | Sprint 21: Verify Translation API POST /api/v1/translations/verify — Mark a draft translation as verified      |

## Usage

| Method    | Path                    | Auth    | Module | Pagination | Errors           | Notes |
| --------- | ----------------------- | ------- | ------ | ---------- | ---------------- | ----- |
| GET, POST | `/api/v1/usage`         | session | —      | —          | legacy `{error}` |       |
| GET       | `/api/v1/usage/summary` | admin   | —      | —          | —                |       |

## Users

| Method    | Path                                        | Auth                                                            | Module | Pagination | Errors                 | Notes                                                                                                          |
| --------- | ------------------------------------------- | --------------------------------------------------------------- | ------ | ---------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| GET       | `/api/v1/users`                             | admin, risk_manager, control_owner, process_owner, auditor, dpo | —      | —          | problem+json (wrapper) |                                                                                                                |
| GET       | `/api/v1/users/:id`                         | session                                                         | —      | —          | legacy `{error}`       |                                                                                                                |
| PUT       | `/api/v1/users/:id/profile`                 | session                                                         | —      | —          | legacy `{error}`       |                                                                                                                |
| GET, POST | `/api/v1/users/:id/roles`                   | session                                                         | —      | —          | legacy `{error}`       |                                                                                                                |
| DELETE    | `/api/v1/users/:id/roles/:roleId`           | admin                                                           | —      | —          | legacy `{error}`       |                                                                                                                |
| GET, PUT  | `/api/v1/users/content-language`            | session                                                         | —      | —          | legacy `{error}`       | Sprint 21: User Content Language Preference GET /api/v1/users/content-language — get current user's content la |
| GET       | `/api/v1/users/me`                          | session                                                         | —      | —          | problem+json (wrapper) |                                                                                                                |
| GET, PUT  | `/api/v1/users/me/dashboard-layout`         | session                                                         | —      | —          | legacy `{error}`       |                                                                                                                |
| GET, PUT  | `/api/v1/users/me/nav-preferences`          | session                                                         | —      | —          | legacy `{error}`       |                                                                                                                |
| GET, PUT  | `/api/v1/users/me/notification-preferences` | session                                                         | —      | —          | legacy `{error}`       |                                                                                                                |

## Vendors

| Method           | Path                                     | Auth                                                                 | Module | Pagination | Errors                 | Notes                                                         |
| ---------------- | ---------------------------------------- | -------------------------------------------------------------------- | ------ | ---------- | ---------------------- | ------------------------------------------------------------- |
| GET, POST        | `/api/v1/vendors`                        | admin, risk_manager, process_owner, vendor_manager, contract_manager | tprm   | —          | problem+json (wrapper) |                                                               |
| GET, PUT, DELETE | `/api/v1/vendors/:id`                    | session                                                              | tprm   | —          | legacy `{error}`       |                                                               |
| GET, POST        | `/api/v1/vendors/:id/assessments`        | —                                                                    | —      | —          | —                      | /api/v1/vendors/[id]/assessments — Wave-24-D2 canonical alias |
| GET              | `/api/v1/vendors/:id/assessments/schema` | session                                                              | tprm   | —          | legacy `{error}`       | Wave-25-C2                                                    |
| GET, POST        | `/api/v1/vendors/:id/contacts`           | admin, risk_manager, process_owner                                   | tprm   | —          | legacy `{error}`       |                                                               |
| POST             | `/api/v1/vendors/:id/dd/invite`          | admin, risk_manager                                                  | tprm   | —          | legacy `{error}`       |                                                               |
| GET, POST        | `/api/v1/vendors/:id/due-diligence`      | admin, risk_manager                                                  | tprm   | —          | legacy `{error}`       |                                                               |
| GET, POST        | `/api/v1/vendors/:id/risk-assessments`   | admin, risk_manager, vendor_manager, contract_manager                | tprm   | —          | legacy `{error}`       |                                                               |
| GET              | `/api/v1/vendors/:id/risk-profile`       | session                                                              | tprm   | —          | legacy `{error}`       | Wave-24-D3 aggregated profile                                 |
| GET              | `/api/v1/vendors/:id/transitions`        | session                                                              | tprm   | —          | legacy `{error}`       |                                                               |
| GET              | `/api/v1/vendors/dashboard`              | session                                                              | tprm   | —          | —                      |                                                               |
| POST             | `/api/v1/vendors/dd/submit`              | —                                                                    | —      | —          | legacy `{error}`       |                                                               |
| GET              | `/api/v1/vendors/enums`                  | session                                                              | —      | —          | problem+json (wrapper) |                                                               |

## Webhooks

| Method           | Path                              | Auth  | Module | Pagination | Errors           | Notes |
| ---------------- | --------------------------------- | ----- | ------ | ---------- | ---------------- | ----- |
| GET, POST        | `/api/v1/webhooks`                | admin | —      | —          | legacy `{error}` |       |
| GET, PUT, DELETE | `/api/v1/webhooks/:id`            | admin | —      | —          | legacy `{error}` |       |
| GET              | `/api/v1/webhooks/:id/deliveries` | admin | —      | —          | legacy `{error}` |       |
| POST             | `/api/v1/webhooks/:id/test`       | admin | —      | —          | legacy `{error}` |       |
| GET              | `/api/v1/webhooks/event-types`    | admin | —      | —          | —                |       |

## Whistleblowing

| Method                        | Path                                           | Auth                                          | Module         | Pagination    | Errors                 | Notes                                                                                                          |
| ----------------------------- | ---------------------------------------------- | --------------------------------------------- | -------------- | ------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| GET                           | `/api/v1/whistleblowing/audit-log`             | whistleblowing_officer, ombudsperson          | whistleblowing | limit, offset | problem+json (wrapper) | Zugriffsprotokoll der Meldestelle                                                                              |
| GET, POST, PUT, PATCH, DELETE | `/api/v1/whistleblowing/cases`                 | whistleblowing_officer, ombudsperson          | whistleblowing | —             | problem+json           | List cases (HinSchG officers, paginated)                                                                       |
| GET                           | `/api/v1/whistleblowing/cases/:id`             | whistleblowing_officer, ombudsperson          | whistleblowing | —             | legacy `{error}`       | Case detail with decrypted content                                                                             |
| PUT                           | `/api/v1/whistleblowing/cases/:id/acknowledge` | whistleblowing_officer, ombudsperson          | whistleblowing | —             | legacy `{error}`       | Mark case as acknowledged                                                                                      |
| PUT                           | `/api/v1/whistleblowing/cases/:id/assign`      | whistleblowing_officer, ombudsperson          | whistleblowing | —             | legacy `{error}`       | Assign case to ombudsperson                                                                                    |
| POST                          | `/api/v1/whistleblowing/cases/:id/message`     | whistleblowing_officer, ombudsperson          | whistleblowing | —             | legacy `{error}`       | Ombudsperson sends encrypted message                                                                           |
| PUT                           | `/api/v1/whistleblowing/cases/:id/resolve`     | whistleblowing_officer, ombudsperson          | whistleblowing | —             | legacy `{error}`       | Resolve case with category + encrypted resolution                                                              |
| GET                           | `/api/v1/whistleblowing/intake`                | —                                             | —              | —             | —                      | #WAVE6-WB-01: discovery payload for the intake channel. The 405 on POST /whistleblowing/cases points callers a |
| GET                           | `/api/v1/whistleblowing/intake-codes`          | session                                       | —              | —             | problem+json (wrapper) |                                                                                                                |
| POST                          | `/api/v1/whistleblowing/intake/submit`         | —                                             | —              | —             | problem+json (wrapper) | #WAVE6-WB-01: HinSchG (German whistleblower-protection law) requires an anonymous-intake channel. The 405 on P |
| GET, POST, PATCH              | `/api/v1/whistleblowing/investigations`        | whistleblowing_officer, ombudsperson, auditor | whistleblowing | —             | legacy `{error}`       |                                                                                                                |
| GET, POST                     | `/api/v1/whistleblowing/protection`            | whistleblowing_officer, ombudsperson, auditor | whistleblowing | —             | legacy `{error}`       |                                                                                                                |
| GET                           | `/api/v1/whistleblowing/statistics`            | admin, whistleblowing_officer, ombudsperson   | whistleblowing | —             | —                      | Anonymized KPIs (HinSchG officers)                                                                             |

## Work Items

| Method    | Path                                   | Auth    | Module | Pagination | Errors           | Notes |
| --------- | -------------------------------------- | ------- | ------ | ---------- | ---------------- | ----- |
| GET, POST | `/api/v1/work-items`                   | session | —      | limit      | legacy `{error}` |       |
| GET, PUT  | `/api/v1/work-items/:id`               | session | —      | —          | legacy `{error}` |       |
| GET, POST | `/api/v1/work-items/:id/links`         | session | —      | —          | legacy `{error}` |       |
| DELETE    | `/api/v1/work-items/:id/links/:linkId` | session | —      | —          | legacy `{error}` |       |
| PUT       | `/api/v1/work-items/:id/status`        | session | —      | —          | legacy `{error}` |       |

---

_1362 routes, 2027 operations. Regenerate with `node scripts/generate-api-reference.mjs`._
