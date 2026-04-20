# Three-Lines-of-Defense Coverage Report

_Generated: 2026-04-18T06:23:24.500Z_

## Summary

- Total API routes: 1606
- Mutating (POST/PUT/PATCH/DELETE): 796
- Anonymous mutating (no withAuth/LoD): **17** ← should be 0
- GET without withAuth: 209 (public-ish, e.g. /health)

## Role/LoD distribution

| LoD/Role | Endpoints |
| -------- | --------- |
| cross    | 1313      |
| 2nd      | 900       |
| 3rd      | 347       |
| 1st      | 277       |
| read     | 270       |
| isolated | 6         |

## ⚠️ Anonymous mutating endpoints

| Route                                     | Method |
| ----------------------------------------- | ------ |
| `/api/v1/auth/admin-login`                | POST   |
| `/api/v1/auth/sso/saml/callback`          | POST   |
| `/api/v1/auth/switch-org`                 | POST   |
| `/api/v1/invitations/[token]/accept`      | POST   |
| `/api/v1/portal/dd/[token]/evidence`      | POST   |
| `/api/v1/portal/dd/[token]/responses`     | PUT    |
| `/api/v1/portal/dd/[token]/submit`        | POST   |
| `/api/v1/portal/mailbox/[token]/evidence` | POST   |
| `/api/v1/portal/mailbox/[token]`          | POST   |
| `/api/v1/portal/report/[orgCode]`         | POST   |
| `/api/v1/scim/v2/Groups`                  | POST   |
| `/api/v1/scim/v2/Groups/[id]`             | PATCH  |
| `/api/v1/scim/v2/Users`                   | POST   |
| `/api/v1/scim/v2/Users/[id]`              | PUT    |
| `/api/v1/scim/v2/Users/[id]`              | PATCH  |
| `/api/v1/scim/v2/Users/[id]`              | DELETE |
| `/api/v1/vendors/dd/submit`               | POST   |

## Methodology

- Parses every `route.ts` under `apps/web/src/app/api/v1/`
- Extracts `withAuth("...")` args (roles), `requireLineOfDefense([...])` args (LoD)
- Role→LoD map (per ADR-007):
  - `admin` → cross
  - `risk_manager` → 2nd
  - `control_owner` → 1st
  - `process_owner` → 1st
  - `auditor` → 3rd
  - `dpo` → 2nd
  - `viewer` → read
  - `whistleblowing_officer` → isolated
  - `ombudsperson` → isolated
  - `esg_manager` → 2nd
  - `esg_contributor` → 1st

False positives possible when auth is applied via shared helper that this script doesn't match. Cross-check against `grep -r "withAuth"` in suspicious cases.
