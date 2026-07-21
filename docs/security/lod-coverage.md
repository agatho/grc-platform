# Three-Lines-of-Defense Coverage Report

_Generated: 2026-07-20T13:34:46.685Z_

## Summary

- Total API routes: 1802
- Mutating (POST/PUT/PATCH/DELETE): 906
- Anonymous mutating (no auth mechanism found): **0** ← should be 0
- Session-authenticated mutating (Auth.js `auth()` without withAuth): 1
- Token-authenticated mutating (SCIM / portal / SAML validators): 11
- Public-by-design mutating (documented allowlist): 5
- GET without withAuth: 296 (public-ish, e.g. /health)

## Role/LoD distribution

| LoD/Role | Endpoints |
| -------- | --------- |
| cross    | 1399      |
| 2nd      | 956       |
| 3rd      | 364       |
| 1st      | 337       |
| read     | 280       |
| isolated | 12        |

## Session-authenticated mutating endpoints (Auth.js `auth()`)

Authenticated via the Auth.js session directly instead of the `withAuth` helper (no role restriction beyond a valid session).

| Route                     | Method |
| ------------------------- | ------ |
| `/api/v1/auth/switch-org` | POST   |

## Token-authenticated mutating endpoints

Authenticated via an in-handler token validator (SCIM bearer token, portal access tokens, SAML assertion validation).

| Route                                 | Method | Validator               |
| ------------------------------------- | ------ | ----------------------- |
| `/api/v1/auth/sso/saml/callback`      | POST   | `validateSAMLSignature` |
| `/api/v1/portal/dd/[token]/evidence`  | POST   | `validateDdToken`       |
| `/api/v1/portal/dd/[token]/responses` | PUT    | `validateDdToken`       |
| `/api/v1/portal/dd/[token]/submit`    | POST   | `validateDdToken`       |
| `/api/v1/portal/mailbox/[token]`      | POST   | `validateMailboxToken`  |
| `/api/v1/scim/v2/Groups`              | POST   | `validateScimToken`     |
| `/api/v1/scim/v2/Groups/[id]`         | PATCH  | `validateScimToken`     |
| `/api/v1/scim/v2/Users`               | POST   | `validateScimToken`     |
| `/api/v1/scim/v2/Users/[id]`          | PUT    | `validateScimToken`     |
| `/api/v1/scim/v2/Users/[id]`          | PATCH  | `validateScimToken`     |
| `/api/v1/scim/v2/Users/[id]`          | DELETE | `validateScimToken`     |

## Public-by-design mutating endpoints (documented allowlist)

| Route                                     | Method | Reason                                                                                           |
| ----------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| `/api/v1/auth/admin-login`                | POST   | Credential login endpoint — public by design                                                     |
| `/api/v1/invitations/[token]/accept`      | POST   | Single-use invitation token, validated against DB in handler                                     |
| `/api/v1/portal/mailbox/[token]/evidence` | POST   | Whistleblower anonymous mailbox — token validated inline against wb_anonymous_mailbox in handler |
| `/api/v1/portal/report/[orgCode]`         | POST   | Anonymous whistleblowing intake (HinSchG) — deliberately unauthenticated                         |
| `/api/v1/vendors/dd/submit`               | POST   | External vendor DD submission — accessToken query param validated against DB                     |

## Methodology

- Parses every `route.ts` under `apps/web/src/app/api/v1/`
- Extracts `withAuth("...")` args (roles), `requireLineOfDefense([...])` args (LoD)
- Additionally recognizes (2026-07-20): direct Auth.js session auth (`await auth()`), in-handler token validators (`validateScimToken`, `validateDdToken`, `validateMailboxToken`, `validateSAMLSignature`/`validateSAMLAssertion`) and a hand-curated public-by-design allowlist (see `PUBLIC_BY_DESIGN` in the script) — these were previously false-positive "anonymous mutating" counts (RBAC-smoke finding re auth/switch-org + SCIM).
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

False positives possible when auth is applied via a shared helper that this script doesn't match. Cross-check against `grep -r "withAuth"` in suspicious cases.
