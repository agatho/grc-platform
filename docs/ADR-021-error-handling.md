# ADR-021: Error-Handling-Contract (consistent JSON + Request-ID)

**Status:** Accepted
**Date:** 2026-04-18 · **rev.2:** 2026-09-01
(ARCTOS-FULL-2026-08-31 / WP12 · S14-16)

> **rev.2 — was diese Revision aendert.** Die ADR stand seit dem 2026-04-18
> auf "Proposed", waehrend `docs/STATUS.md:226` "RFC-7807 Error-Envelopes"
> unter den abgeschlossenen Wave-Themen fuehrte. Nachgezaehlt ueber alle
> 1.355 Routen unter `/api/v1`: **9** sendeten `application/problem+json`,
> 970 sendeten `{ error: "..." }`, 11 `{ message: "..." }`, 6 `{ errors: ... }`.
> Der Contract war also in unter 1 % der Routen erfuellt und galt trotzdem als
> erledigt (S14-16). Diese Revision beschreibt, wie er tatsaechlich
> durchgesetzt wird, und was davon noch offen ist.

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

## Implementation-Plan (rev.2 — Stand 2026-09-01)

- [x] **Phase 1: Helper-Lib + ErrorTypes-Enum.** `apps/web/src/lib/api-errors.ts`
      existierte bereits, wurde aber von 8 Routen importiert. Bleibt der
      kanonische Weg fuer neue Routen.
- [x] **Phase 2: Globaler Error-Boundary.** `withErrorHandler`
      (`apps/web/src/lib/api-wrapper.ts`) faengt uncaught Exceptions ab und
      liefert korrektes problem+json.
- [x] **Phase 3 (neu in rev.2): Durchsetzung statt Migration.**
      Der urspruengliche Plan war "Migration in Phasen — auth-Routen zuerst,
      dann nach Modul". Nach vier Monaten waren 9 Routen migriert. Ein Plan,
      der 970 Route-Bodies von Hand anfasst, ist weder review- noch
      abschliessbar, und die Erfahrung mit genau diesem Plan belegt das.
      Stattdessen normalisiert `normaliseErrorResponse()` die Antwort **am
      Ausgang** des Wrappers:

      * eine Route darf `Response.json({ error: "Not found" }, { status: 404 })`
        zurueckgeben und bleibt unveraendert;
      * der Client bekommt `application/problem+json` mit `type`, `title`,
        `status`, `instance` und `requestId`;
      * **alle** urspruenglichen Felder bleiben als RFC-7807-Extension-Member
        erhalten, damit kein Client bricht, der heute `json.error` liest;
      * 2xx-Antworten, Nicht-JSON-Antworten (Datei-Downloads, CSV-Exporte) und
        bereits problem-konforme Antworten werden nicht angefasst.

      Damit gilt der Contract fuer jede Route, die durch `withErrorHandler`
      laeuft, statt fuer neun. Der Ist-Stand je Route steht in der Spalte
      "Errors" von `docs/API_REFERENCE.md`, generiert aus dem Code.
- [ ] **Phase 3b (offen): die Routen ohne Wrapper.** Nicht jede Route ist in
      `withErrorHandler` gewickelt. Fuer die uebrigen bleibt der Contract
      unerfuellt, und das ist in `docs/API_REFERENCE.md` sichtbar
      ausgewiesen (`legacy {error}`) statt behauptet. Der naechste Schritt ist,
      den Wrapper zur Pflicht zu machen — sinnvollerweise mit demselben
      CI-Lint, den `docs/STATUS.md:196` fuer `requireModule` fordert und der
      dort ebenfalls noch fehlt.
- [ ] **Phase 4 (offen): Frontend-Error-Handler auf das neue Shape.** Additiv
      moeglich, weil die Legacy-Felder erhalten bleiben — daher nicht
      dringend, aber noch nicht gemacht.
- [x] **Phase 5: Error-Types-Uebersicht.** Die `ErrorTypes`-Konstanten in
      `apps/web/src/lib/api-errors.ts` sind die Quelle; `docs/API_REFERENCE.md`
      weist je Route aus, welches Shape sie sendet. Ein separates
      `docs/api-errors.md` waere ein drittes handgepflegtes Dokument ueber
      denselben Sachverhalt — genau das Muster, das S14-15 und S14-23
      gemessen haben.

## Warum kein Big-Bang-Refactor (rev.2)

Die "Negativ"-Liste oben nannte "1034 Endpoints muessen migriert werden --
grosser Refactor, in Phasen". Das ist der Grund, warum nichts passiert ist:
ein Refactor dieser Groesse hat keinen Zeitpunkt, an dem er klein genug ist.
Die Normalisierung am Wrapper-Ausgang kostet eine Funktion, ist rueckwaerts-
kompatibel und wirkt sofort auf jede gewickelte Route. Der Preis ist, dass
`type` aus dem Status-Code abgeleitet und nicht von der Route gewaehlt wird —
eine Route, die einen spezifischeren `type` braucht, benutzt weiterhin
`problemResponse()` direkt und wird nicht angefasst.

## Verwandte ADRs

- [ADR-005 REST + OpenAPI 3.1](./) — OpenAPI-Schema-Definition fuer Errors
- [ADR-020 API-Versioning](./ADR-020-api-versioning.md) — Error-Shape ist Teil des Contracts
- [ADR-019 Rate-Limiting](./ADR-019-rate-limiting.md) — 429-Errors nutzen dieses Schema
