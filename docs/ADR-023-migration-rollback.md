# ADR-023: Rollback-Strategy fuer fehlgeschlagene Migrations

**Status:** Proposed
**Date:** 2026-04-18
**Context-Author:** autonomous session

## Context

Aktueller Migrations-Flow (seit F-17 Fix in commit `f764147`):
1. Drizzle-generierte Files in `packages/db/drizzle/NNNN_*.sql`
2. Legacy-Files in `packages/db/src/migrations/*.sql` (Phase-2 zu Ende)
3. `docker-entrypoint.sh` iteriert beide Verzeichnisse, `psql` mit
   `ON_ERROR_STOP=0` pro File
4. `drizzle/__drizzle_migrations` Tabelle trackt applied-Migrations
5. Bei Fehler: Container faehrt weiter hoch, DB ist halb-migriert

Pain-Points:
- **ON_ERROR_STOP=0 maskiert Fehler** — eine defekte Migration wird
  stillschweigend uebersprungen
- **Kein Rollback-Skript** je Migration — DBA muss manuell ermitteln,
  was zurueckgenommen werden kann
- **Keine Atomizitaet zwischen Migrations** — wenn 0102 partiell laeuft
  und 0103 scheitert, ist DB inconsistent
- **Keine dry-run-Moeglichkeit** — Migration nur in Produktion testen
  oder Staging spiegeln

Fragen die heute unbeantwortet sind:
- Wie rollback-bar ist eine bereits geloschte-Spalte?
- Wann ist eine Migration "breaking" fuer zurueck-gerollten Code?
- Was macht man mit fehlgeschlagenen Migrations auf einem von drei
  Tenant-Containern?

## Decision

### 1. Strict-Mode by Default

`docker-entrypoint.sh` setzt kuenftig `ON_ERROR_STOP=1`. Fehlt eine
Migration, **bricht Deploy ab** und faehrt den alten Code weiter.

Ausnahme: Legacy-Files in `src/migrations/` (historisch mit Conflicts),
wenn das deaktiviert werden soll, bleibt es fuer diese Files bei 0 —
aber dann mit explizit zugewiesener ignore-list (Whitelist).

### 2. Vorwaerts-nur-Policy mit Compensating-Migrations

**Kein** automatisches Rollback. Stattdessen:
- Bricht Migration 0105 ab: keine automatische Reversierung
- DBA-Entscheidung: (a) Fehler fixen und 0105 re-run, oder
  (b) 0106 als "Compensating-Migration" schreiben
- Breaking-Changes (DROP COLUMN, DROP TABLE): immer als separate
  Migration mit 30-Tage-Abkuhlperiode nach dem Rollout
- Vor jedem Schema-Breaking-Deploy: `db-backup.sh --pre-breaking-<id>`

Begruendung: Automated Down-Migrations sind fuer RLS-Multi-Tenant zu
gefaehrlich — ein fehlerhaftes Down kann echte Daten loeschen.

### 3. Staging-Pipeline (geplant)

- Neue CI-Workflow `migration-rehearsal.yml` stellt DB-Backup von Prod
  (verschluesselt, minimal-personenbezogene-Daten) in Staging wieder her
- Spielt neuen Branch darauf ab
- Meldet Migration-Dauer + Locking-Dauer
- Versagt bei Missing-Column/-Table-Errors in den darauf-folgenden
  Integration-Tests

Nicht in Scope fuer v1: vollautomatisches Anonymisieren echter
Production-Daten fuer Staging (DSGVO-Risk). Erst Phase 2.

### 4. Migration-Metadata-Pflicht

Neues Kommentar-Header-Format in jeder neuen .sql:

```sql
-- Migration: NNNN_slug
-- Breaking: no|yes-backfill|yes-breaking
-- Estimated-Duration: <seconds>
-- Locking: no|short|long
-- Compensating-Required: no|yes
-- Reviewer: <github-handle>
```

CI-Check: neue Migration ohne Header -> Fail.

### 5. Prod-Runbook

Neues Kapitel in `docs/runbook.md`:
- Migration-Failure-Detection (Healthcheck + audit-log)
- Manuelles-Rollback (selten, nur wenn echter Daten-Verlust droht)
- Compensating-Migration (der Normalfall — schneller, sicherer)

## Rationale

- **ON_ERROR_STOP=1** ist die DB-Branchennorm; F-17 hatte es
  deaktivieren muessen wegen einer historischen Inconsistency, die mit
  Phase-2 behoben ist (ADR-014)
- **Keine Down-Migrations** weil: (a) Drizzle-kit unterstuetzt sie nicht
  sauber, (b) RLS-Multi-Tenant macht Rollback-Consequences schwer
  vorhersagbar, (c) Compensating-Migrations sind revisionssicher (sie
  stehen als separate Commit + audit_log-Eintrag)
- **Metadata-Header** macht Review-Effort sichtbar: ein 30-Sekunden-
  ALTER TABLE ist okay, ein 30-Minuten-UPDATE auf 50M Zeilen braucht
  eine Wartungsfenster-Absprache

## Consequences

### Positiv
- Fehlgeschlagene Deploys brechen statt zu maskieren
- Rollback-Entscheidungen werden dokumentiert (Commit + audit_log)
- Staging-Rehearsal findet Probleme vor Prod

### Negativ
- Striktere Policy bedeutet: nicht jede kleine Schema-Aenderung ist
  gleich deployed. Code-Deploys-ohne-DB-Change sind der Default-Fall,
  DB-Aenderungen brauchen geplante Fenster
- Metadata-Header ist zusaetzlicher Overhead
- Staging-Rehearsal braucht Prod-Backup-Access -- neue Security-
  Anforderung

### Neutral
- Bestehende Migrations werden NICHT nachtraeglich mit Header versehen
- Drift-Check und RLS-Coverage-Check bleiben unveraendert
- ADR-014 Migration-Policy bleibt das Framework, ADR-023 verfeinert
  die Failure-Semantics

## Verwandte ADRs + Tools

- [ADR-014 Migration Policy](./ADR-014-migration-policy.md)
- [ADR-015 Off-Site Backup](./ADR-015-offsite-backup.md) — fuer
  Staging-Restore-Flow
- [runbook.md](./runbook.md) + [dr-playbook.md](./dr-playbook.md)
- `.github/workflows/migration-policy.yml` — zukuenftig erweitert um
  Metadata-Header-Check
- `scripts/docker-entrypoint.sh` — aendert `ON_ERROR_STOP` default

## Implementation-Plan

- [ ] Phase 1: ON_ERROR_STOP=1 in docker-entrypoint.sh (Risiko: neue
      Failure-Modes sichtbar werden -- erst in Staging testen)
- [ ] Phase 2: Metadata-Header + CI-Check
- [ ] Phase 3: Staging-Rehearsal-Workflow
- [ ] Phase 4: Runbook-Update mit Compensating-Migration-Flow
