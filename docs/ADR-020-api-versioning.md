# ADR-020: API Versioning Strategy (beyond v1)

**Status:** Proposed
**Date:** 2026-04-18
**Context-Author:** autonomous session

## Context

Alle REST-Endpoints liegen unter `/api/v1/**`. Die "v1" ist aktuell ein
Platzhalter — es gibt keine definierte Strategie fuer:

- Wann ein neuer Major-Release (`v2`) gerechtfertigt ist
- Wie alte Clients waehrend der Transition leben
- Wer die Breaking-Change-Entscheidung trifft
- Wie API-Konsumenten (externe Tenants, Integrations) informiert werden

Heutige Realitaet:

- 1034 Pfade, 1606 Methoden-Kombinationen (Stand openapi.yaml vom 2026-04-18)
- Interne Consumers: Next.js-Frontend, Worker, E2E-Tests
- Externe Consumers (zukuenftig): Mobile-App (Sprint 60), Compliance-Partners,
  Customer-Integrations via Plugin-API (ADR-058)

## Decision

1. **Versionierungs-Schema**: Major-Version im URL-Pfad (`/api/v1/`, `/api/v2/`).
   Keine Header-basierten Versions, keine Query-String-Versions.
2. **SemVer-Regeln fuer API**:
   - **Major (v1 -> v2)**: Breaking Changes (Feld entfernt, Typ geaendert,
     Pflicht-Feld hinzugefuegt, Auth-Flow geaendert)
   - **Minor**: optional-Feld hinzugefuegt, neuer Endpoint — **kein** Major-Bump
   - **Patch**: Bug-Fix ohne Contract-Aenderung
3. **Overlap-Period**: Bei v1 -> v2 mindestens **6 Monate** parallel.
   Alte Version wird mit `Deprecation: Sun, ... 23:59:59 GMT` + `Sunset`-
   Header markiert (RFC 8594).
4. **Breaking-Change-Prevention**: CI-Gate vergleicht `docs/openapi.yaml`
   gegen `main`-Baseline. Paths-Remove + Required-Field-Add sind
   Breaking und loesen Alarm aus.
5. **API-Change-Log**: `docs/api-changelog.md` fuer externe Consumer.

## Rationale

- URL-Version ist am robustesten fuer Self-Service-Tools (curl, Postman)
  und Caching-Layer; Header-Version bricht CDN-Keys
- 6-Monats-Overlap ist SaaS-Branchenstandard (AWS, Stripe) und reicht fuer
  mittelgrosse Integrationen
- Deprecation-Header ist standardisiert (RFC 8594), Client-Side-Tools
  koennen das auto-handeln
- CI-Gate ersetzt manuelle Contract-Reviews — 1606 Methoden sind zu viel
  fuer menschliche Durchsicht

## Consequences

### Positiv

- Klare Regeln fuer "wann muss v2 her?"
- Externe Consumer koennen mit festem Contract planen
- Automated Contract-Testing moeglich (Pact / Dredd gegen openapi.yaml)

### Negativ

- Duplizierte Route-Files in `/api/v1/` und `/api/v2/` waehrend Overlap
- Dev-Disziplin: selbst "kleine" Feld-Rename erzwingt v2 oder Rueckwaerts-
  Kompatibilitaet via Adapter
- Onboarding-Komplexitaet fuer neue Entwickler

### Neutral

- Frontend und interne Services migrieren mit dem Backend — Overlap-
  Regeln gelten primaer fuer externe Konsumenten
- Plugin-API (ADR-058) erbt dieselbe Versionierung

## Breaking vs. Non-Breaking — Entscheidungs-Matrix

| Aenderung                                                   | Breaking?                              |
| ----------------------------------------------------------- | -------------------------------------- |
| Neuer Endpoint                                              | Nein                                   |
| Neues optional-Feld im Response                             | Nein                                   |
| Neues Pflicht-Feld im Request                               | **Ja**                                 |
| Neues Pflicht-Feld im Response (Consumer erwartet es evtl.) | Nein (additiv)                         |
| Feld-Rename                                                 | **Ja**                                 |
| Feld-Typ-Aenderung (string -> int)                          | **Ja**                                 |
| Enum-Wert entfernt                                          | **Ja**                                 |
| Enum-Wert hinzugefuegt                                      | Nein (Consumer muss unknown vertragen) |
| HTTP-Status-Code geaendert (200 -> 201)                     | **Ja**                                 |
| Pagination von default-10 zu default-50                     | **Ja** (Performance-Shock)             |
| Validierungs-Regel strenger (max-length 500 -> 200)         | **Ja**                                 |

## Implementation-Plan

- [ ] `docs/api-changelog.md` bootstrappen mit v1-Aenderungen seit 2026-01
- [ ] CI-Workflow `.github/workflows/openapi-breaking-change.yml`:
  - Oasdiff-Tool oder eigener Node-Diff gegen `main:docs/openapi.yaml`
  - Blockiert PR bei Breaking-Change ohne `breaking-change`-Label
- [ ] Response-Middleware: bei `/api/v1/**` Deprecation-Header-Stub
- [ ] Runbook: wie v2-Rollout orchestriert wird

## Verwandte ADRs

- [ADR-005 REST + OpenAPI 3.1](./)
- [ADR-057 API Platform](./) — Plugin-Interface baut hierauf auf
- [ADR-021 Error-Handling-Contract](./ADR-021-error-handling.md) — Teil des API-Contracts
