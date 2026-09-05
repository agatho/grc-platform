# ARCTOS API Changelog

**Scope:** public, observable changes to `/api/v1/**` — paths, methods, request
and response shapes, status codes, auth requirements.
**Audience:** external integrators. Internal refactorings that leave the
contract intact do not appear here.

<!--
  [ARCTOS-FULL-2026-08-31 / WP12 · S14-17]

  ADR-020's Implementation-Plan promised this file in April 2026 and it was
  never created (audit finding D7). It is bootstrapped here.

  It deliberately starts at 2026-09-01 rather than reconstructing "v1 changes
  since 2026-01" as the original plan asked. Reconstructing them from git
  history would produce a plausible-looking list that nobody verified — the
  exact failure mode this audit measured 60 times over (S14-23). A changelog
  that says honestly where it begins is worth more than one that pretends to
  cover a period it cannot vouch for.

  For the period before 2026-09-01, `git log -- apps/web/src/app/api/v1` is
  the only reliable source, and `docs/openapi.yaml` (generated) is the only
  reliable statement of the current surface.
-->

## Format

Each entry: date, change class per ADR-020 (`breaking` / `minor` / `patch`),
the affected path(s), and what a client has to do.

## Unreleased

### 2026-09-01 — `minor` — error responses become RFC 7807

- **What:** every route wrapped in `withErrorHandler` now answers errors with
  `Content-Type: application/problem+json` and a body carrying `type`,
  `title`, `status`, `instance` and `requestId`, per ADR-021.
- **Client impact:** none required. The original fields (`error`, `message`,
  `errors`) are preserved as RFC 7807 extension members, so a client reading
  `json.error` keeps working. Clients that branch on
  `Content-Type: application/json` for errors should accept
  `application/problem+json` as well.
- **Why:** ADR-021 mandated this contract in April 2026 and it was implemented
  in 9 of 1.355 routes while being reported as complete (audit S14-16).

### 2026-09-01 — `breaking` — `GET /api/v1/meta/build` no longer returns `nodeVersion` / `runtimeUptimeSeconds`

- **What:** the two fields are removed from the unauthenticated response.
- **Client impact:** a monitoring client that read `nodeVersion` from this
  endpoint has to take it from the container instead (`node -v`).
- **Why:** the endpoint is unauthenticated and unrate-limited. `process.version`
  is the exact patch level of the running runtime and `runtimeUptimeSeconds`
  states how long since the last restart — together, precise patch-level
  reconnaissance for anyone on the internet (audit S12-19). Classified
  `breaking` although the endpoint is a diagnostic, because removing a response
  field is breaking under ADR-020 regardless of how the field is used.

### 2026-09-01 — `patch` — `GET /api/v1/branding/css/:orgId` cache header

- **What:** `Cache-Control: public, max-age=3600` becomes
  `Cache-Control: private, max-age=3600`, plus `Vary: Cookie`.
- **Client impact:** none for browsers. A shared cache (CDN, forward proxy)
  will no longer store the response.
- **Why:** the response sits behind the auth middleware and was marked
  storable by shared caches (audit S12-11).

### 2026-09-01 — `minor` — `POST /api/v1/programmes/journeys/:id/steps/:stepId/links` validates `targetUrl`

- **What:** `targetUrl` must now be an absolute `http(s)` URL. Other schemes
  (including `javascript:` and `data:`) are rejected with 422.
- **Client impact:** a client that sent a relative or non-http URL gets a 422
  where it previously got a 201.
- **Why:** stored XSS — the value was rendered straight into an `href`
  (audit S12-06).
