# ADR-020: API Versioning Strategy (beyond v1)

**Status:** Accepted
**Date:** 2026-04-18 · **rev.2:** 2026-09-01
(ARCTOS-FULL-2026-08-31 / WP12 · S14-17, S14-18)

> **rev.2 — was diese Revision aendert.** Das Audit hat festgestellt, dass
> **keiner der vier Punkte des Implementation-Plans existierte** (S14-17) und
> dass die ADR seit dem 2026-04-18 auf "Proposed" stand, waehrend 1.360
> v1-Routen produktiv laufen. Ausserdem waren die Kennzahlen um 273 Pfade bzw.
> 338 Operationen zu niedrig, die zwei Endpoints ausserhalb von `/api/v1/**`
> nicht erwaehnt, und die Entscheidungs-Matrix stufte eine Aenderung des
> Pagination-Defaults als Breaking Change ein, obwohl nirgends ein Default
> definiert war. Alle vier Punkte sind unten abgearbeitet oder mit Begruendung
> verworfen; der Pagination-Contract ist neu und normativ.

## Context

Alle REST-Endpoints liegen unter `/api/v1/**` — **mit zwei dokumentierten
Ausnahmen** (rev.2, S14-17/D10):

| Pfad | Warum ausserhalb der Versionierung |
|---|---|
| `/api/health` | Liveness-/Readiness-Probe. Ein Orchestrator-Health-Check darf nicht brechen, wenn die API-Version wechselt; er ist kein Teil des Consumer-Contracts. |
| `/api/auth/[...nextauth]` | Von Auth.js vorgegebener Pfad, nicht frei waehlbar. |

Diese beiden sind von der v1→v2-Overlap-Regel ausgenommen und werden in
`docs/API_REFERENCE.md` unter "Outside `/api/v1`" gefuehrt.

Die "v1" ist aktuell ein Platzhalter — es gibt keine definierte Strategie fuer:

- Wann ein neuer Major-Release (`v2`) gerechtfertigt ist
- Wie alte Clients waehrend der Transition leben
- Wer die Breaking-Change-Entscheidung trifft
- Wie API-Konsumenten (externe Tenants, Integrations) informiert werden

Heutige Realitaet:

- 1.360 Route-Dateien unter `/api/v1/**`, 1.362 unter `/api/**` insgesamt
  (rev.2, nachgezaehlt am 2026-09-01 mit
  `find apps/web/src/app/api/v1 -name route.ts | wc -l`). Die frueheren Zahlen
  "1034 Pfade, 1606 Methoden" stammten aus einer `openapi.yaml` vom 2026-04-18
  und waren um 273 bzw. 338 zu niedrig (S14-17). Die aktuelle Zaehlung steht
  generiert im Kopf von `docs/API_REFERENCE.md` und wird bei jedem Lauf von
  `scripts/generate-api-reference.mjs` erneuert.
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
| Pagination von default-20 zu einem anderen Default          | **Ja** (Performance-Shock)             |
| Validierungs-Regel strenger (max-length 500 -> 200)         | **Ja**                                 |

## Pagination-Contract (rev.2, normativ — S14-18)

Vor rev.2 stufte die Matrix oben eine Aenderung des Pagination-Defaults als
Breaking Change ein, **ohne dass irgendwo ein Default definiert war**. Das
Audit hat ausserdem vier konkurrierende Schreibweisen gezaehlt (`limit` 28x,
`offset` 8x, `page` 6x, `pageSize` 1x) und nur 43 von 1.355 Routen, die
ueberhaupt einen Pagination-Parameter lesen — waehrend `docs/API_REFERENCE.md`
zahlreiche Endpoints pauschal als "(paginated)" auswies.

**Verbindlich ab rev.2 ist genau eine Implementierung:** `paginate()` in
`apps/web/src/lib/api.ts`. Sie existierte bereits und definiert den Contract
vollstaendig; sie war nur nirgends dokumentiert und nicht als die einzige
gueltige Form benannt.

| Parameter | Bedeutung | Default | Grenzen |
|---|---|---|---|
| `limit` | Seitengroesse | `DEFAULT_PAGE_SIZE` = 20 | 1 ... `MAX_PAGE_SIZE` = 100. Groesser ⇒ **422**, kein stilles Kappen: ein stiller Cap laesst den Client glauben, er habe das vollstaendige Ergebnis. |
| `page` | 1-basierte Seitennummer | 1 | ≥ 1; `0`, negativ oder nicht-numerisch ⇒ 422 |
| `offset` | Alternative zu `page` | — | Muss ein Vielfaches von `limit` sein, sonst 422. Wird zu `page = offset/limit + 1`. Bei gleichzeitigem `page` gewinnt `page`. |
| `sortBy` / `sortOrder` | Sortierung | — | Werden auf die kanonischen `sort` / `sortDir` normalisiert. |

**Nicht** Teil des Contracts und daher abgewiesen: `pageSize`, `perPage`,
`per_page`, `take`, `skip`, `cursor`. `paginate()` wirft fuer die haeufigsten
dieser Tippfehler eine `PaginationError` (422 problem+json mit Feld-Detail),
statt sie stillschweigend zu ignorieren und ein falsches Fenster zu liefern.

Jede **neue** Listen-Route benutzt `paginate()`. Welche der bestehenden Routen
ohne Pagination eine braucht, ist eine Produktentscheidung pro Endpoint und
kein Contract-Defekt — ein Endpoint, der genau eine Zeile zurueckgibt, braucht
keine. Die Spalte "Pagination" in `docs/API_REFERENCE.md` weist den Ist-Stand
je Route aus, generiert aus dem Code.

## Implementation-Plan (rev.2 — Stand 2026-09-01)

Der urspruengliche Plan stand vier Punkte lang unerledigt in einer ADR mit
Status "Proposed" (S14-17). Stand jetzt:

- [x] **`docs/api-changelog.md` bootstrappen.** Angelegt. Er beschreibt
      ausdruecklich, ab wann er gefuehrt wird — eine rueckwirkende Rekonstruktion
      der Aenderungen seit 2026-01 waere geraten, nicht belegt, und genau die
      Sorte Dokument, die dieses Audit als Drift gezaehlt hat.
- [x] **CI-Workflow `.github/workflows/openapi-breaking-change.yml`.** Angelegt.
      Er regeneriert `docs/openapi.yaml` aus dem Routenbaum, vergleicht gegen den
      Stand des Ziel-Branches und blockiert einen PR, der einen Pfad oder eine
      Methode ENTFERNT, solange das Label `breaking-change` fehlt. Zusaetzlich
      prueft er, dass `docs/openapi.yaml` und `docs/API_REFERENCE.md`
      reproduzierbar sind — beide sind generiert, und ein von Hand editiertes
      Generat ist der Anfang der naechsten Drift.
- [x] **Deprecation-Header.** Umgesetzt als `X-API-Version: v1` auf allen
      `/api/v1/**`-Antworten (`apps/web/next.config.ts`). Ein
      `Deprecation`-Header-**Stub** wurde bewusst NICHT gebaut: RFC 8594
      definiert den Header als Aussage "diese Ressource ist veraltet", und v1
      ist es nicht. Ein Stub, der dauerhaft `false` sendet, trainiert Clients
      darauf, den Header zu ignorieren — dann ist er wertlos, wenn er einmal
      wahr wird. Der Einschaltzeitpunkt steht im Runbook unten.
- [x] **Runbook v2-Rollout.** Als Abschnitt hier aufgenommen statt als eigenes
      Dokument, damit er nicht getrennt von der Regel driftet.

## Runbook: v1 -> v2 (rev.2)

1. **T-6 Monate.** `docs/api-changelog.md` bekommt einen `## v2 (geplant)`-
   Eintrag mit der vollstaendigen Liste der Breaking Changes und dem
   Sunset-Datum.
2. **T-6 Monate.** `/api/v1/**` sendet zusaetzlich
   `Deprecation: <RFC-1123-Datum>`, `Sunset: <RFC-1123-Datum>` (RFC 8594) und
   `Link: <.../api/v2/...>; rel="successor-version"`. Erst hier wird der Header
   eingeschaltet — siehe oben.
3. **T-6 bis T-0.** Beide Versionen laufen parallel. Der
   Breaking-Change-Workflow laeuft gegen `v2`; `v1` ist eingefroren und nimmt
   nur noch Sicherheits-Fixes.
4. **T-1 Monat.** Nutzung von `/api/v1/**` aus `access_event` auswerten. Jeder
   verbliebene externe Consumer wird namentlich angeschrieben.
5. **T-0.** `/api/v1/**` antwortet `410 Gone` mit einem problem+json-Body
   (`type: .../errors/api-version-sunset`), der auf den v2-Pfad zeigt. **Nicht**
   404: ein 410 unterscheidet "gab es, ist weg" von "gab es nie", und genau
   diese Unterscheidung braucht der Integrator im Log.

## Verwandte ADRs

- [ADR-005 REST + OpenAPI 3.1](./)
- [ADR-057 API Platform](./) — Plugin-Interface baut hierauf auf
- [ADR-021 Error-Handling-Contract](./ADR-021-error-handling.md) — Teil des API-Contracts
