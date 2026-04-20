## ADR-014: Database Migration Policy

| **ADR-ID**  | **014**                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**   | **Drizzle-only Migrations — one directory, one runner, one source of truth**                                                                                                                                                                                                                                                                                                                                                                            |
| **Status**  | **Accepted**                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Date**    | 2026-04-17                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Context** | F-17 Finding: 171 manuell geschriebene SQL-Migrationen in `packages/db/src/migrations/` wurden vom Docker-Entrypoint nie ausgeführt. Produktions-DB war monatelang aus dem Schema-Export (`@grc/db`) heraus driftet: Copilot-, Tax-CMS-, Horizon-Scanner-, Cert-Wizard- und BI-Reporting-Tabellen existierten im Drizzle-Schema, aber nicht in der DB. Ergebnis: stumme 500er (`relation does not exist`), keine Build-Warnung, kein Monitoring-Signal. |

### Decision

**Ab sofort liegen alle Schema-Änderungen ausschließlich in `packages/db/drizzle/`** und werden via `drizzle-kit generate` erzeugt. Das Verzeichnis `packages/db/src/migrations/` bleibt als Legacy-Bestand erhalten, bekommt aber **keine neuen Files** und wird nach Abschluss des einmaligen Catch-ups (Commit `be3cbda+1`) für neue PRs in `.github/workflows/` geblockt.

### Rationale

1. **Eine Quelle der Wahrheit**: `drizzle-kit` generiert deterministisch SQL aus dem TypeScript-Schema. Manuelle SQL-Files führen zu Drift zwischen Code und DB.
2. **Startup-Reihenfolge**: Der Docker-Entrypoint führt Migrations in numerischer Reihenfolge aus. Zwei Verzeichnisse nebeneinander erzwingen eine zweite Iteration, was die Dependency-Ordering-Garantie aufweicht.
3. **Entwickler-Onboarding**: Ein/e neu dazustoßende/r Engineer erkennt den Drizzle-Workflow sofort. Eine zweite, undokumentierte Migration-Quelle ist eine versteckte Falle.
4. **CI/CD-Gate** (siehe F-18): Der neue Health-Check-Endpoint `GET /api/v1/health/schema-drift` liefert `503` wenn Drizzle-Schema und DB-Tabellen divergieren. Das kann als Smoke-Test in der Deploy-Pipeline verwendet werden.

### Migration Path

1. **Phase 1 (aktuell, Commit der diese ADR einführt):**
   - Docker-Entrypoint führt **beide** Verzeichnisse nacheinander aus — drizzle zuerst, dann `src/migrations/` — um den bestehenden Legacy-Bestand einzuholen. Alle Files sind idempotent (`CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).
   - Neuer Endpoint `/api/v1/health/schema-drift` (F-18) zeigt Ist-Stand.

2. **Phase 2 (nach Verifikation auf Staging):**
   - Lokale `drizzle-kit generate` Ausführung auf einer Produktions-Snapshot-DB erzeugt konsolidierte Migrations im Bereich `0099_*.sql`+. Diese decken alle Schema-Diffs ab, die heute noch über `src/migrations/` eingetragen werden.
   - Die 171 Files in `src/migrations/` werden ins Verzeichnis `packages/db/src/migrations/.legacy/` verschoben (Beweissicherung, nicht mehr ausgeführt).
   - Der zweite Loop im Entrypoint wird entfernt.

3. **Phase 3 (Guardrails):**
   - CI-Check: Neue PRs mit Dateien unter `packages/db/src/migrations/*.sql` werden blockiert.
   - Pre-Deploy-Smoke-Test in der Hetzner-Pipeline ruft `/api/v1/health/schema-drift` auf — bei `missingInDb.length > 0` wird der Deploy abgebrochen.
   - Startup-Log des Web-Containers gibt die Anzahl fehlender Tabellen aus (Warn-Level), damit das auch in der Docker-Console sichtbar ist.

### Consequences

**Positiv:**

- Keine weiteren 500er durch nicht migrierte Tabellen.
- Build, Runtime und DB bleiben kongruent.
- Neue Features können drizzle-Schema definieren und sich darauf verlassen, dass das Schema auch deployed wird.

**Negativ:**

- Phase 1 lässt den Entrypoint 171 redundante Statements ausführen, die bei einem bereits migrierten Tenant silently no-op'en (akzeptabel, Laufzeit < 3s).
- Phase 2 erfordert DB-Backup + kontrollierten Deploy.

### Referenced Findings

- **F-17**: 171 Migrationen in `src/migrations/` nie ausgeführt — Root Cause
- **F-18**: `@grc/db` exportiert Schemas ohne DB-Rückendeckung — Symptom
- **F-10**: Copilot 500 — konkrete Auswirkung (deferred da vom User explizit als „noch nicht vernetzt" markiert, wird nach Phase 2 von selbst funktional)

### Monitoring

Der Health-Endpoint ist admin-only. Empfohlene Nutzung in der Deploy-Pipeline:

```bash
curl -sf -H "Cookie: $ADMIN_SESSION" \
  https://arctos.charliehund.de/api/v1/health/schema-drift \
  | jq '.data | {healthy, missingInDb: .missingInDb | length}'
```

Der exit code ist `0` bei `healthy: true`, sonst `22` (Curl-Exit bei HTTP ≥400). Das CI-Gate kann darauf aufsetzen.
