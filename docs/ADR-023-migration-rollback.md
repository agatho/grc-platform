# ADR-023: Rollback-Strategy fuer fehlgeschlagene Migrations

**Status:** **Accepted** (2026-09-01)
**Date:** 2026-04-18 · **Angenommen:** 2026-09-01
**Context-Author:** autonomous session

---

## Umsetzungsstand (2026-09-01, ARCTOS-FULL-2026-08-31 / WP1 + WP10)

> Dieses ADR stand seit dem 2026-04-18 auf **Proposed** und benannte die
> Defekte des damaligen Migrationsflusses selbst zutreffend
> („ON_ERROR_STOP=0 maskiert Fehler", „Kein Rollback-Skript je Migration",
> „Keine Atomizitaet zwischen Migrations"). Genau diese Punkte hat das Audit
> als S13-03 und S13-05(f) wiedergefunden — vier Monate spaeter, unveraendert.
> §1, §3 und §4 sind inzwischen umgesetzt (WP1), §2 und der Deploy-Pfad in
> dieser Runde (WP10). Der Status ist deshalb **Accepted**.

| Punkt                                     | Stand 2026-08-31                                                                                          | Stand 2026-09-01                                                                                                                 | Von  |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `ON_ERROR_STOP=1`, stderr erhalten        | `ON_ERROR_STOP=0`, `>/dev/null 2>&1` — der Operator erfuhr eine Zahl, nie WELCHE Datei mit WELCHEM Fehler | je Datei `ON_ERROR_STOP=1`; jede Fehlermeldung wird gesammelt und vollstaendig ausgegeben                                        | WP1  |
| Abbruch statt Weiterstart                 | Container startete unbedingt; `/api/v1/health` lieferte 200, betroffene Routen 500                        | `exit 1` vor `exec "$@"` — die App startet nicht, der alte Container laeuft weiter                                               | WP1  |
| Atomizitaet / Serialisierung              | keine; mehrere Container fuhren dieselbe DDL nebenlaeufig                                                 | Session-Advisory-Lock; der zweite Container wartet                                                                               | WP1  |
| Applied-State                             | `__drizzle_migrations` kannte 25 von 360 Dateien                                                          | `_arctos_migrations` mit SHA-256 je Datei, alle Dateien                                                                          | WP1  |
| Rehearsal-Pipeline (§3)                   | keine                                                                                                     | Job `migration-rehearsal` in `migration-policy.yml`                                                                              | WP1  |
| Metadaten-Header (§4)                     | keiner                                                                                                    | `migration-policy.yml` erzwingt `-- Migration/-- Breaking/-- Estimated-Duration/-- Locking/-- Compensating-Required/-- Reviewer` | WP1  |
| **Pre-Deploy-Backup im Deploy-Pfad**      | `db-backup.sh --pre-migration` existierte und wurde von `update-all.sh` NIE aufgerufen (S13-04a)          | Schritt [1d/6] in `update-all.sh`, **blockierend**                                                                               | WP10 |
| **Deploy bricht bei Migrationsfehler ab** | `psql … \|\| true` je Datei je Produktiv-DB (S13-04b)                                                     | Ledger-Runner im worker-Container, Fehler = `abort`                                                                              | WP10 |
| **Funktionierender Rollback-Pfad**        | alle drei dokumentierten Kommandos falsch (S13-05)                                                        | `deploy/rollback.sh` (`--list`, `--image`, `--db`, `--full`)                                                                     | WP10 |
| **Vorgaenger-Image auf dem Host**         | existierte nicht — `update-all.sh` baut lokal und ueberschreibt das Tag (S13-05b)                         | vor dem Build als `arctos-rollback/grc-<svc>:<old-sha>` getaggt                                                                  | WP10 |
| Rollback-SQL je Migration                 | keins (`find . -name "*down*.sql"` leer)                                                                  | **bewusst weiterhin keins** — siehe unten                                                                                        | —    |

**Warum es weiterhin keine `down`-Skripte gibt.** §2 dieses ADR hatte
Compensating-Migrations statt Rollback-Skripten beschlossen, und diese
Entscheidung bleibt richtig: eine `down`-Migration, die
`DROP COLUMN`/`DROP TABLE` faehrt, vernichtet die Daten, die die
`up`-Migration eingefuehrt hat, und ist damit im Ernstfall genau das
Gegenteil einer Rettung. Der praktikable Rueckweg ist zweistufig und
genau so implementiert:

1. **Image-Rollback** (`deploy/rollback.sh --image <sha>`) — der Normalfall.
   Die Datenbank bleibt vorwaerts migriert; der alte Anwendungscode muss das
   neue Schema lesen koennen. Daraus folgt die
   **Expand/Contract-Disziplin**: eine Migration darf in einem Release nur
   ADDITIV sein (`ADD COLUMN`, neue Tabelle, neuer Index); Entfernungen
   folgen erst im uebernaechsten Release. `migration-policy.yml` markiert
   Migrationen mit `-- Breaking: true`; fuer sie gilt der zweite Weg.
2. **DB-Rollback** (`deploy/rollback.sh --db <backup>`) — die Ausnahme.
   DROP + CREATE + `pg_restore` aus dem Pre-Deploy-Backup, mit getippter
   Bestaetigung und Datenverlust ab dem Backup-Zeitpunkt. Die DATEIEN im
   Objektspeicher werden dabei NICHT zurueckgerollt: ein Dokument, das nach
   dem Backup hochgeladen wurde, bleibt als Datei liegen, ohne dass eine
   Datenbankzeile darauf zeigt. Das ist im Skript und im DR-Playbook
   ausdruecklich vermerkt.

**Wartungsfenster fuer die Remediations-Migrationen.** `0383`, `0385` und
`0386` tragen `-- Breaking: true`, `0387` legt 450 Indizes an. Auf einer
befuellten Datenbank brauchen sie ein Wartungsfenster mit Pre-Deploy-Backup;
`docs/runbook.md` §5 beschreibt den Ablauf.

---

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

> **[Welle 5b · OP-132/OP-133, 2026-09-05]** Der Status dieser ADR steht seit
> 2026-09-01 auf **Accepted**, die Umsetzungsliste stand danach noch komplett
> auf offen. Nachgemessen gegen `2f716205`:

- [x] Phase 1: ON_ERROR_STOP=1 in docker-entrypoint.sh —
      `scripts/docker-entrypoint.sh:77` (`$PSQL -v ON_ERROR_STOP=1`)
- [x] Phase 2: Metadata-Header + CI-Check —
      `.github/workflows/migration-policy.yml:71` prueft alle sechs
      Header-Zeilen an jeder NEUEN Migration. 49 der 428 Migrationen tragen
      den Header; alle 49 mit `Compensating-Required: no`. Die 379 aelteren
      sind ausgeliefert und werden nach ADR-014 nicht mehr angefasst.
- [x] Phase 3: Migration-Rehearsal — umgesetzt, aber **nicht** als eigener
      `migration-rehearsal.yml`, wie §3 es beschreibt, sondern als Job in
      `.github/workflows/migration-policy.yml` (volle Sequenz gegen eine leere
      DB, zweiter Lauf als No-Op, Schema-Diff leer). §3 ist damit nicht mehr
      „geplant"; der Restore eines Produktions-Backups nach Staging ist es
      weiterhin.
- [x] Phase 4: Runbook-Update mit Compensating-Migration-Flow —
      [`runbook.md` §5.1](./runbook.md)

**Was die CI hier nicht leisten kann:** `migration-policy.yml` laeuft auf
`pull_request`. Ein direkter Push auf `main` umgeht den Header-Zwang und die
Forward-only-Pruefung vollstaendig. Die Wirkung dieses Gates haengt an der
Branch-Protection — siehe OP-150/OP-151, eine Entscheidung des Eigentuemers.
