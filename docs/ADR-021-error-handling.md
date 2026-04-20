# ADR-021: Error-Handling-Contract (consistent JSON + Request-ID)

**Status:** Proposed
**Date:** 2026-04-18
**Context-Author:** autonomous session

## Context

API-Error-Responses in ARCTOS sind heute uneinheitlich. Beispiele aus
`apps/web/src/app/api/v1/**`:

- `Response.json({ error: "Unauthorized" }, { status: 401 })` — kurzer String
- `Response.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 })` — Zod-Shape
- `Response.json({ message: "Not found" }, { status: 404 })` — anderer Key
- Uncaught Exception -> Next.js 500-Default-Page (HTML!) wenn Route-
  Handler throwed

Frontend hat kein einheitliches Shape zu catchen. Externe Consumer koennen
nicht programmatisch reagieren. Request-ID-Header (commit 25bc6ca) ist in
Responses gesetzt, aber nicht im Error-Body — Support-Tickets haben
Context-Luecke.

## Decision

Alle API-Errors folgen **RFC 7807 "Problem Details for HTTP APIs"** mit
ARCTOS-Extension:

```json
{
  "type": "https://arctos.charliehund.de/errors/validation",
  "title": "Validation failed",
  "status": 422,
  "detail": "Request body failed Zod validation",
  "instance": "/api/v1/risks",
  "requestId": "a1b2c3d4e5f60718",
  "errors": [
    { "path": "title", "message": "Required" },
    { "path": "severity", "message": "Expected number, got string" }
  ]
}
```

**Pflicht-Felder**:

- `type` — URI identifiziert Error-Kategorie (stable, dokumentiert)
- `title` — human-lesbare Kurzform
- `status` — HTTP-Status als Nummer
- `requestId` — aus `X-Request-ID`-Header, fuer Support-Tickets

**Optional**:

- `detail` — Long-Form-Beschreibung
- `instance` — Pfad der Request
- `errors` — Array bei Validierungs-Fehlern

**Content-Type**: `application/problem+json` (nicht `application/json`).

## Helper-API

Neuer Wrapper in `apps/web/src/lib/api-errors.ts`:

```typescript
export function problemResponse(opts: {
  type: string;
  title: string;
  status: number;
  detail?: string;
  errors?: Array<{ path: string; message: string }>;
  requestId: string;
  instance: string;
}): Response;

export const ErrorTypes = {
  VALIDATION: "https://arctos.charliehund.de/errors/validation",
  UNAUTHORIZED: "https://arctos.charliehund.de/errors/unauthorized",
  FORBIDDEN: "https://arctos.charliehund.de/errors/forbidden",
  NOT_FOUND: "https://arctos.charliehund.de/errors/not-found",
  CONFLICT: "https://arctos.charliehund.de/errors/conflict",
  RATE_LIMITED: "https://arctos.charliehund.de/errors/rate-limited",
  INTERNAL: "https://arctos.charliehund.de/errors/internal",
  MODULE_DISABLED: "https://arctos.charliehund.de/errors/module-disabled",
  RLS_DENIED: "https://arctos.charliehund.de/errors/rls-denied",
} as const;
```

Globaler Error-Boundary in `middleware.ts` faengt uncaught Exceptions
und maptert sie auf `ErrorTypes.INTERNAL` mit `requestId` — keine HTML-
Default-Fehlerseite mehr.

## Rationale

- RFC 7807 ist weitverbreitet (Spring, FastAPI, .NET Core), Tools kennen es
- Der Error-`type` als URL ist maschinenlesbar **und** human-navigierbar
  (Dokumentation direkt dahinter)
- `requestId` im Body ist fuer Support entscheidend — nicht jeder Client
  logt Response-Header
- application/problem+json als Content-Type sagt Clients explizit
  "das ist ein Problem", nicht nur "das ist JSON"

## Consequences

### Positiv

- Einheitliches Client-Side-Error-Handling: eine Zeile, alle Errors
- Bessere Support-Tickets (requestId immer dabei)
- OpenAPI kann Error-Shapes zentral referenzieren
- SDK-Generierung (kuenftig) wird trivialer

### Negativ

- 1034 Endpoints muessen migriert werden -- grosser Refactor, in Phasen
- Breaking Change fuer aktuelle Frontend-Error-Handler -> v2 fuer Clients?
  Nein: Frontend wird parallel migriert, Error-Shape-Aenderung ist intern
- Log-Tooling muss `problem+json` parsen koennen

### Neutral

- Error-Types-URL muss dokumentiert werden (`docs/api-errors.md`)
- i18n fuer `title`/`detail` — Entscheidung: Accept-Language-Header
  respektieren, Fallback DE

## Implementation-Plan (phased)

- [ ] Phase 1: Helper-Lib + ErrorTypes-Enum
- [ ] Phase 2: Globaler Error-Boundary (alle uncaught Exceptions)
- [ ] Phase 3: Migration in Phasen — auth-Routen zuerst, dann nach Modul
- [ ] Phase 4: Frontend-Error-Boundary auf neues Shape umstellen
- [ ] Phase 5: API-Doku-Seite mit allen Error-Types

## Verwandte ADRs

- [ADR-005 REST + OpenAPI 3.1](./) — OpenAPI-Schema-Definition fuer Errors
- [ADR-020 API-Versioning](./ADR-020-api-versioning.md) — Error-Shape ist Teil des Contracts
- [ADR-019 Rate-Limiting](./ADR-019-rate-limiting.md) — 429-Errors nutzen dieses Schema
