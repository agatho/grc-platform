# ARCTOS Operations Runbook

_Audience: Ops-on-call, Platform-Maintainer._
_Last updated: 2026-04-18._

## Contents

1. [§1 Pflicht-Betriebsvariablen](#1-pflicht-betriebsvariablen)
2. [Architecture Overview](#architecture-overview)
3. [Deployment](#deployment)
4. [§5 Wartungsfenster für schemaverändernde Releases](#5-wartungsfenster-für-schemaverändernde-releases)
5. [§7 Vernichtung des Pseudonymisierungsschlüssels](#7-vernichtung-des-pseudonymisierungsschlüssels-dsgvo-löschpfad)
6. [Backups](#backups)
7. [Disaster Recovery](#disaster-recovery)
8. [§8 Monitoring und Alarme](#8-monitoring-und-alarme)
9. [Incident Response](#incident-response)
10. [Common Tasks](#common-tasks)

---

## §1 Pflicht-Betriebsvariablen

> **[ARCTOS-FULL-2026-08-31 / WP10 · S13-10, S13-28]** Bis zu diesem Audit
> gab es KEINE Startup-Validierung der Konfiguration. Ein Operator, der nur
> `DATABASE_URL` setzte, bekam eine Installation, die normal startete,
> `/api/v1/health` mit 200 beantwortete und **jede Anfrage als Superuser mit
> BYPASSRLS ausführte** — jeder Mandant sah die Daten jedes anderen, ohne
> irgendein Signal. Seit der Remediation prüft `scripts/prestart.sh` die
> Liste unten VOR dem Anwendungsstart und beendet den Container in
> `NODE_ENV=production` mit Exit 78 (EX_CONFIG), wenn ein Wert fehlt oder
> noch den Platzhalter trägt. **Das ist beabsichtigt**: ein nicht startender
> Container ist der deutlich harmlosere Ausgang.

| Variable                    | web | worker | Erzeugen                            | Ohne sie                                                                                                                                      |
| --------------------------- | :-: | :----: | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`              | ✅  |   ✅   | —                                   | Migrationen und Provisionierung unmöglich                                                                                                     |
| `APP_DATABASE_URL`          | ✅  |   —    | aus `GRC_APP_PASSWORD`              | **RLS wirkungslos**, Mandantentrennung aufgehoben (S13-09/S13-10)                                                                             |
| `GRC_APP_PASSWORD`          | ✅  |   —    | `openssl rand -hex 24`              | s. o.                                                                                                                                         |
| `GRC_WORKER_PASSWORD`       |  —  |   ✅   | `openssl rand -hex 24`              | Worker startet nicht (WP2/S01-09)                                                                                                             |
| `AUTH_SECRET`               | ✅  |   —    | `openssl rand -hex 32`              | Sitzungen nicht signierbar                                                                                                                    |
| `AUTH_URL` / `NEXTAUTH_URL` | ✅  |   —    | öffentliche **https**-Basis-URL     | SSO-/SCIM-/SAML-Callbacks zeigen ins Leere                                                                                                    |
| `CRON_SECRET`               | ✅  |   ✅   | `openssl rand -hex 16`              | Worker antwortet auf `/crons/*` mit 500                                                                                                       |
| `AUDIT_SEAL_KEY`            | ✅  |   ✅   | `openssl rand -hex 32`              | Anker verkettet, aber **unsigniert** — Integritätsprüfung statt Tamper-Evidence (WP4/S03-01)                                                  |
| `PII_PSEUDONYM_KEY`         | ✅  |   ✅   | `openssl rand -hex 32`              | Installationsschlüssel **in der Datenbank** — das „zusätzliche Wissen" nach Art. 4 Nr. 5 DSGVO läge im selben Dump wie die Daten (WP8/S07-03) |
| `WB_ENCRYPTION_KEY`         | ✅  |   ✅   | `openssl rand -hex 32`              | Meldeportal weist Meldungen mit 503 ab                                                                                                        |
| `CONNECTOR_ENCRYPTION_KEY`  | ✅  |   ✅   | `openssl rand -hex 32`              | Connector-Zugangsdaten nicht speicherbar                                                                                                      |
| `SECRET_ENCRYPTION_KEY`     | ✅  |   ✅   | `openssl rand -base64 32`           | SSO-/OAuth-Secrets nicht speicherbar                                                                                                          |
| `REDIS_URL`                 | ✅  |   —    | `redis://redis:6379`                | Rate-Limit prozesslokal: effektives Limit `N × capacity`, Lockout überlebt keinen Neustart (WP9/S10-05)                                       |
| `TRUSTED_PROXY_HOPS`        | ✅  |   —    | Anzahl eigener Proxys (Caddy = `1`) | Login-Rate-Limit per `X-Forwarded-For` umgehbar                                                                                               |
| `STORAGE_BACKEND`           | ✅  |   ✅   | `local` oder `s3`                   | bei `local` ohne `UPLOAD_DIR`: Dokumente im Container, weg beim nächsten Update (S13-09b)                                                     |

Zusätzlich für den Worker: `ARCTOS_ALLOW_PRIVILEGED_DB=true` — die
Startup-Assertion aus S01-10 verlangt diese Zustimmung ausdrücklich, damit
die privilegierte Verbindung im Deployment sichtbar und einzeln widerrufbar
ist. **Für die Web-App darf sie niemals gesetzt sein.**

Selbst prüfen, ohne die Anwendung zu starten:

```bash
NODE_ENV=production node scripts/assert-runtime-config.mjs --role web
NODE_ENV=production node scripts/assert-runtime-config.mjs --role worker
```

Vollständige Liste aller gelesenen Variablen: `.env.example` (wird von
`node scripts/check-env-example.mjs` in CI gegen den Quellcode geprüft) und
`docs/env-vars-reference.md`.

## Architecture Overview

```
Users ─► Caddy (TLS, 443) ─► web-{tenant} containers ─► postgres (TimescaleDB)
                                                     ─► redis
```

- **Host**: Hetzner dedicated server (ubuntu-16gb-fsn1-1)
- **Compose-File**: `/opt/arctos/docker-compose.production.yml` (Haupt-Service)
- **Per-Tenant-Compose**: `/opt/arctos/tenants/{tenant}/docker-compose.yml` (own web container, shared postgres/redis)
- **DB**: Single postgres instance, eine DB pro Tenant (`grc_platform`, `grc_daimon`, …). Extensions: `pgcrypto`, `uuid-ossp`, `vector`, `timescaledb`
- **Secrets**: `.env` per Tenant-Dir, root:root 600

## Deployment

### Full update (all tenants)

```bash
sudo arctos-update
```

Was das tut (Stand 2026-09-01, `deploy/update-all.sh`):

1. `git pull` im `/opt/arctos`
2. **CI-Status des Ziel-Commits prüfen** (`gh run list --workflow CI`) —
   ohne grünen Lauf bricht der Deploy ab. Ausnahme:
   `ARCTOS_ALLOW_UNVERIFIED_DEPLOY=true`, im Protokoll vermerkt (S13-19).
3. **Pre-Deploy-Backup** (`db-backup.sh --pre-migration`) — schlägt es
   fehl, bricht der Deploy ab (S13-04a). Der laufende Stand wird ausserdem
   als `arctos-rollback/grc-<svc>:<old-sha>` getaggt, damit ein Rollback
   überhaupt ein Ziel hat (S13-05b).
4. Docker-Image-Rebuild aus dem frisch gezogenen HEAD
5. **Migrationen über den Ledger-Runner** (`packages/db/src/migrate-all.ts`,
   `_arctos_migrations`) je Datenbank — ein Fehlschlag bricht ab (S13-04b).
   Damit läuft in Produktion dieselbe Sequenz in derselben Reihenfolge wie
   in CI und Dev (S13-21).
6. Laufzeitrollen provisionieren (`grc_app`, `grc_worker`) — Fehler brechen
   ab (S13-04d)
7. Container-Neustart, danach **Warten auf `healthy`** statt auf `running`
8. **Health-Gate**: `/api/v1/health` und `/login` je Instanz. Rot →
   automatischer Image-Rollback und Abbruch (S13-04c)
9. Protokolleintrag nach `/opt/arctos/deploy-history.jsonl`

> **Was vorher fehlte:** kein Backup, kein CI-Nachweis, `|| true` auf jeder
> Migration (das `set -euo pipefail` war für genau den kritischen Teil
> ausgehebelt), ein Health-Check, dessen Statuscode ausgegeben und nie
> verglichen wurde — ein Deploy, nach dem die Anwendung HTTP 500 lieferte,
> endete mit „Update abgeschlossen" und Exit 0. Und bei jedem Lauf wurden
> Demo-Daten in die produktive Haupt-Datenbank geschrieben (S13-20); das
> passiert jetzt nur noch mit `ALLOW_DEMO_SEED_IN_PROD=true`.

**Dauer**: ~3–5 min Build + Migrationslaufzeit + ~30 s je Tenant für den
Neustart. **Die Migrationslaufzeit fehlte in der alten Angabe** — bei einer
`Breaking`- oder Index-Migration dominiert sie alles andere; dann gilt §5
(Wartungsfenster).

### §6 Zero-Downtime — was es gibt und was nicht

`update-all.sh` fährt `up -d --force-recreate`: der Container wird gestoppt
und neu gestartet. **Es gibt keine zweite Replik und damit kein echtes
Zero-Downtime** (S13-22). Was seit der Remediation besteht, ist ein
_gesteuertes_ Fenster: beide Images haben einen `HEALTHCHECK`, der Deploy
wartet darauf und rollt bei Misserfolg automatisch zurück, statt eine tote
Instanz stehen zu lassen.

Wer echtes Zero-Downtime braucht, führt eine zweite Replik hinter Caddy
(`reverse_proxy web-a:3000 web-b:3000` mit `lb_policy` und passiven
Health-Checks) und startet sie versetzt. Das setzt voraus, dass jede
Migration rückwärtskompatibel ist (Expand/Contract, ADR-023) — sonst
bedient die alte Replik ein Schema, das sie nicht kennt. Das ist ein
eigener Umbau und bewusst nicht Teil dieser Remediation; er steht als
offener Betreiberpunkt in `/work/audit/remediation/WP10.md`.

### Single-Tenant-Update

```bash
docker compose -f /opt/arctos/docker-compose.production.yml pull web
docker compose -f /opt/arctos/docker-compose.production.yml up -d web
```

### Pre-Deploy-Checklist

`update-all.sh` erledigt Punkt 1–3 seit der Remediation selbst und bricht
ab, wenn einer fehlschlägt. Die Liste bleibt als Kontrolle für manuelle
Eingriffe:

1. Pre-Deploy-Backup: `sudo bash /opt/arctos/deploy/db-backup.sh --pre-migration`
2. CI-Status des Ziel-Commits: `gh run list --commit $(git rev-parse HEAD) --workflow CI`
3. Drift-Check: `curl -s localhost:3000/api/v1/health/schema-drift` (admin) → `healthy: true`
4. Nach dem Deploy: `tail -1 /opt/arctos/deploy-history.jsonl` → `"status":"success"`

## §5 Wartungsfenster für schemaverändernde Releases

> **[WP1-Übergabe an WP10]** Die Remediations-Migrationen `0383`, `0385`
> und `0386` tragen einen `-- Breaking:`-Header (`yes-breaking` bzw.
> `yes-backfill`), und `0387` legt seine Indizes **dynamisch** an — die Zahl
> steht nicht in der Datei. Gemessen gegen die voll migrierte `grc_v4c` am
> 2026-09-05 tragen **509** Indizes seine Namensmuster (439 `idx_*_fk`, 70
> `idx_*_org_id`); `-- Estimated-Duration: 120` unterschätzt das auf einer
> befüllten Datenbank deutlich.
> Auf einer leeren Datenbank ist das folgenlos; auf einer befüllten braucht
> es ein Wartungsfenster mit Backup. Dieser Abschnitt beschreibt es.

**Wann dieser Ablauf gilt:** immer, wenn `git diff --stat <alt> <neu> --
packages/db/drizzle/` eine Datei mit `-- Breaking: true` oder eine
Index-Migration enthält. `migration-policy.yml` erzwingt den
Metadaten-Header, aus dem sich das ablesen lässt:

```bash
# ACHTUNG: der Header schreibt `yes-breaking` / `yes-backfill`, nicht `true`.
# Ein `grep '-- Breaking: *true'` findet nichts und liest sich wie Entwarnung.
grep -lE '^-- Breaking: *yes' packages/db/drizzle/*.sql
grep -H '^-- Estimated-Duration:' packages/db/drizzle/038[3-7]*.sql
```

**Ablauf:**

1. **Fenster ankündigen** — Dauer = Summe der `-- Estimated-Duration`
   plus 100 % Reserve. Für `0387` (450 Indizes) auf einem befüllten System
   ist mit deutlich mehr als der Buildzeit zu rechnen; die Indizes werden
   nicht `CONCURRENTLY` angelegt und nehmen für die Dauer ihres Aufbaus
   einen `SHARE`-Lock auf ihre Tabelle. Schreibzugriffe auf diese Tabellen
   blockieren so lange.
2. **Backup erzwingen** (nicht dem Cron überlassen):
   ```bash
   sudo bash /opt/arctos/deploy/db-backup.sh --pre-migration
   cat /opt/arctos/backups/.last-run.json    # "status":"ok" abwarten
   ```
3. **Anwendung stoppen**, damit kein Schreibzugriff in die Locks läuft:
   ```bash
   cd /opt/arctos
   docker compose -f docker-compose.production.yml stop web worker
   ```
4. **Migrieren**, mit sichtbarer Laufzeit:
   ```bash
   time docker compose -f docker-compose.production.yml exec -T \
     -e DATABASE_URL="postgresql://grc:$DB_PASSWORD@postgres:5432/grc_platform" \
     worker sh -c 'cd /app && npx tsx packages/db/src/migrate-all.ts'
   ```
   Der Runner führt Buch (`_arctos_migrations`) und endet mit Exit != 0,
   wenn eine Migration fehlschlägt. **Bricht er ab: nicht wiederholen,
   sondern die Meldung lesen** — der Ledger sagt, was angewendet wurde.
5. **Jede Tenant-Datenbank einzeln**, in derselben Weise. Bei N Mandanten
   summiert sich die Zeit linear.
6. **Anwendung starten und auf „healthy" warten:**
   ```bash
   docker compose -f docker-compose.production.yml up -d web worker
   docker compose -f docker-compose.production.yml ps
   ```
7. **Nachprüfen:**
   ```bash
   DATABASE_URL=… node /opt/arctos/scripts/verify-db-integrity.mjs
   curl -s localhost:3000/api/v1/health
   ```

**Wenn es schiefgeht:** `deploy/rollback.sh --db <pre-migration-backup>`.
Ein Restore ist der Weg zurück, wenn die Migration **abgebrochen** ist. Wenn
sie **durchlief und trotzdem falsch war**, ist der Restore die teuerste
Antwort — dann gilt der nächste Abschnitt. `down`-Migrationen gibt es
bewusst nicht (ADR-023 §2).

### §5.1 Kompensationsmigration — der Rückweg für eine Migration, die durchlief

> **[Welle 5b · OP-133, 2026-09-05]** ADR-023 §2 und §5 beschließen diesen
> Ablauf seit 2026-09-01 als **Normalfall** („schneller, sicherer"), und
> `migration-policy.yml` erzwingt dafür seit WP1 den Header
> `-- Compensating-Required:` in jeder neuen Migration. Der Ablauf selbst stand
> nirgends. Ohne ihn bleibt einem Betreiber um 02:00 nur der Restore — also der
> Verlust aller Schreibvorgänge seit dem Backup, für einen Fehler, der eine
> einzelne `ALTER TABLE` weit gewesen wäre.

**Wann kompensieren statt zurückrollen.** Drei Fragen, in dieser Reihenfolge:

| Frage                                                                                                                                            | Ja → Weg                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Ist die Migration **abgebrochen** (Runner-Exit ≠ 0)?                                                                                             | Restore aus dem Pre-Deploy-Backup, oder Fehler beheben und erneut laufen lassen — der Ledger `_arctos_migrations` sagt, was angewendet wurde. |
| Lief sie durch, und **drohen Datenverluste** (`DROP COLUMN`, `DROP TABLE`, ein `UPDATE`, das Werte überschrieben hat)?                           | Restore. Eine Kompensation kann gelöschte Werte nicht zurückholen.                                                                            |
| Lief sie durch, und ist der Schaden **strukturell** (falscher Typ, fehlender Index, zu enger Constraint, falsche RLS-Policy, fehlender Default)? | **Kompensationsmigration** — dieser Abschnitt.                                                                                                |

**Ablauf.**

1. **Feststellen, was angewendet ist.** Der Ledger ist maßgeblich, nicht das
   Dateisystem:

   ```bash
   docker compose -f docker-compose.production.yml exec -T postgres \
     psql -U grc -d grc_platform -c \
     "SELECT name, applied_at FROM _arctos_migrations ORDER BY applied_at DESC LIMIT 5;"
   ```

2. **Die fehlerhafte Migration NICHT ändern.** `migration-policy.yml` lehnt
   jede Änderung an einer ausgelieferten Migration ab (ADR-014, forward-only),
   und auf jeder Datenbank, die sie schon angewendet hat, hätte die Änderung
   ohnehin keine Wirkung mehr.

3. **Die nächste freie Nummer schreiben.** Die Kompensation ist eine ganz
   normale Migration mit dem Header nach ADR-023 §4 — und mit `yes` in der
   Zeile, die es dafür gibt:

   ```sql
   -- Migration: 0479_compensate_0478_matview_grants
   -- Breaking: no
   -- Estimated-Duration: 5
   -- Locking: short
   -- Compensating-Required: no
   -- Compensates: 0478_op089_matviews_to_invoker_views
   -- Reviewer: <github-handle>
   ```

   `-- Compensates:` benennt die Migration, die repariert wird. Das ist die
   einzige revisionssichere Spur des Vorgangs — ADR-023 §2 begründet die
   Vorwärts-nur-Politik genau damit.

4. **Idempotent schreiben.** Sie läuft gegen Datenbanken in zwei Zuständen:
   Haupt-DB (kaputt) und frisch angelegte Mandanten (nie kaputt gewesen).
   `IF EXISTS` / `IF NOT EXISTS`, `DROP … IF EXISTS` vor `CREATE`, und ein
   `DO $$ … END $$`-Block für alles, was sich nicht anders bedingt ausdrücken
   lässt. Das Repo hat dafür Muster: `0360_risk_acceptance_repair.sql`
   (Tabellen idempotent nachziehen), `0106_framework_mapping_bridge.sql`
   (Datenbrücke zwischen zwei Modellen).

5. **Gegen eine Kopie prüfen, bevor sie an die Produktion geht.** In einer
   Transaktion mit `ROLLBACK` am Ende — dasselbe Verfahren, das
   `0375_document_signature.sql` dokumentiert:

   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction \
     -f packages/db/drizzle/0479_compensate_0478_matview_grants.sql \
     -c 'ROLLBACK'
   ```

6. **Ausrollen wie jede andere Migration** — über §5 Schritt 2 bis 7. Auch die
   Kompensation braucht ein Backup vorher; sie ist kein Sonderfall.

7. **Nachprüfen und protokollieren:**

   ```bash
   DATABASE_URL=… node scripts/verify-db-integrity.mjs
   ```

   Der Vorgang gehört in `CHANGELOG.md` unter `[Unreleased]`, mit beiden
   Nummern. Ein Kompensationsschritt, den nur der Ledger kennt, ist für den
   nächsten Betreiber unsichtbar.

**Was ausdrücklich nicht kompensierbar ist:** eine Migration, die Zeilen oder
Spaltenwerte gelöscht hat. Deshalb tragen `DROP COLUMN` und `DROP TABLE` nach
ADR-023 §2 eine 30-tägige Abkühlperiode nach dem Rollout — die Spalte bleibt
zunächst stehen, unbenutzt, und wird erst danach in einer eigenen Migration
entfernt. In diesem Fenster ist der Rückweg eine Kompensation; danach ist er
ein Restore.

## §7 Vernichtung des Pseudonymisierungsschlüssels (DSGVO-Löschpfad)

> **[WP8-Übergabe an WP10]** `PII_PSEUDONYM_KEY` ist der HMAC-Schlüssel, mit
> dem personenbezogene Merkmale im Audit-Trail und im
> Hinweisgeber-Fachlog pseudonymisiert werden. Die Löschung nach Art. 17
> DSGVO kann diese Einträge nicht entfernen — der Audit-Trail ist
> append-only und muss es bleiben. Der einzige Weg, die Pseudonyme
> endgültig unumkehrbar zu machen, ist die **Vernichtung des Schlüssels**.
> Sie ist deshalb Teil des Löschkonzepts und braucht ein dokumentiertes
> Verfahren.

**Wirkung — vorher verstehen, nicht danach.** Nach der Vernichtung ist
**kein** Pseudonym mehr auflösbar, auch nicht die der Personen, um die es
nicht ging, und auch nicht rückwirkend für eine berechtigte
Strafverfolgungsanfrage. Bestehende Pseudonyme bleiben als Zeichenketten
stehen und lassen sich nur noch untereinander vergleichen. Das ist
gewollt — aber es ist eine Einbahnstrasse.

**Voraussetzungen:**

- Beschluss des Verantwortlichen (nicht der Ops-Rolle) mit Aktenzeichen
- Vier-Augen-Prinzip: zwei benannte Personen führen den Schritt gemeinsam aus
- Der Schritt wird im BCMS/DPMS-Modul als Vorgang erfasst (Nachweis)

**Ablauf:**

1. **Wirkungsbereich feststellen** — welche Tabellen tragen Pseudonyme
   dieses Schlüssels?
   ```bash
   docker compose -f docker-compose.production.yml exec -T postgres \
     psql -U grc -d grc_platform -c "SELECT * FROM pii_pseudonym_key;"
   ```
2. **Alle Backups identifizieren, die den Schlüssel oder auflösbare
   Pseudonyme enthalten.** Eine Löschung wirkt erst endgültig, wenn das
   letzte Backup aus der Zeit vor dem Antrag abgelaufen ist —
   `BACKUP_RETENTION_DAYS` lokal (Standard 30) plus 90 Tage in B2. Bis
   dahin ist der Vorgang **schwebend**, nicht abgeschlossen. Das gehört so
   in die Antwort an die betroffene Person.
3. **Datenbank-seitigen Installationsschlüssel vernichten** (falls einer
   existiert, weil `PII_PSEUDONYM_KEY` nicht gesetzt war):
   ```bash
   docker compose -f docker-compose.production.yml exec -T postgres \
     psql -U grc -d grc_platform -c "SELECT pii_pseudonym_key_destroy();"
   ```
   Die Funktion ist bewusst **nicht** an `grc_app` gegrantet und über keine
   API erreichbar (WP8) — sie ist nur am Datenbank-Prompt aufrufbar.
4. **Umgebungsschlüssel vernichten:**
   ```bash
   sudo sed -i '/^PII_PSEUDONYM_KEY=/d' /opt/arctos/.env
   sudo shred -u /pfad/zur/offhost-kopie   # sofern lokal vorhanden
   ```
   Die Off-Host-Kopie (Passwort-Safe, Tresor) **muss ebenfalls vernichtet
   werden** — sonst ist der Vorgang wirkungslos. Das ist der Schritt, den
   ein reines Skript nicht leisten kann.
5. **Neuen Schlüssel setzen und Container neu starten** — ohne ihn startet
   die Anwendung nicht mehr (§1):
   ```bash
   echo "PII_PSEUDONYM_KEY=$(openssl rand -hex 32)" | sudo tee -a /opt/arctos/.env
   echo "PII_PSEUDONYM_KEY_ID=$(date -u +%Y%m%d)" | sudo tee -a /opt/arctos/.env
   docker compose -f docker-compose.production.yml up -d --force-recreate web worker
   ```
   Ab hier entstehen NEUE Pseudonyme. Alte und neue Pseudonyme derselben
   Person sind nicht mehr verknüpfbar — auch das ist beabsichtigt.
6. **Nachweis führen:** Aktenzeichen, Datum, beide Ausführende, betroffene
   Backup-Generationen und ihr Ablaufdatum im DPMS-Vorgang festhalten.

**Dasselbe gilt NICHT für `AUDIT_SEAL_KEY`.** Dessen Vernichtung würde
sämtliche bestehenden Ankersiegel unverifizierbar machen und damit die
Tamper-Evidence des gesamten Audit-Trails zerstören. Er wird rotiert, nicht
vernichtet, und die alten Schlüssel bleiben aufbewahrt (`AUDIT_SEAL_KEY_ID`
unterscheidet die Generationen).

## Backups

### Einrichtung (einmalig, deckt alles ab)

```bash
sudo bash /opt/arctos/deploy/offsite-sync-setup.sh   # B2-Remote (einmalig)
sudo bash /opt/arctos/deploy/backup-cron-install.sh  # Cron + Schluessel + Retention
```

`backup-cron-install.sh` legt an:

- `/opt/arctos/.backup.key` (0400 root) — **sofort eine Kopie ausserhalb
  des Hosts ablegen**, siehe [DR-Playbook §Szenario 0](./dr-playbook.md).
  Ohne ihn ist kein Backup wiederherstellbar.
- `/etc/default/arctos-backup` — **die eine** Quelle der
  Aufbewahrungsfrist (`BACKUP_RETENTION_DAYS`, Standard 30).
- `/etc/cron.d/arctos-backup` — Backup, Rotation und Off-Site-Sync in
  **einer verketteten Zeile**, dazu der monatliche Restore-Drill.

> **Was hier bis 2026-08-31 stand — und warum es falsch war.**
>
> - Zwei getrennte Cron-Zeilen mit eigenen Uhrzeiten: Backup 03:00,
>   Off-Site-Sync 02:30. Der Sync lief also **30 Minuten VOR** dem Backup
>   und übertrug dauerhaft den Stand des Vortags — der Off-Site-RPO war
>   faktisch 48 h statt der im DR-Playbook zugesagten 24 h (S13-23b). Und
>   der Sync-Cron wurde von keinem Skript installiert; er existierte nur
>   als Copy-&-Paste-Vorschlag an drei Stellen (S13-23a).
> - „Rotation: > 30 Tage löscht das Script selbst" — das von
>   `backup-cron-install.sh` erzeugte `backup-rotate.sh` löschte nach **14**
>   Tagen, und die schärfere Regel gewann. Effektiv galt 14, während dieses
>   Dokument und das DR-Playbook 30 zusagten (S13-24).
> - Gesichert wurde ausschliesslich `pg_dump`. Der **DMS-Objektspeicher**
>   war in keinem Backup (S13-06), und **verschlüsselt war nichts**,
>   obwohl ADR-015 §1 es zusagte (S13-07).

### Was gesichert wird

| Artefakt                                                               | Datei                                 | Verschlüsselt    |
| ---------------------------------------------------------------------- | ------------------------------------- | ---------------- |
| Jede `grc_*`-Datenbank                                                 | `<db>-<zeitstempel>[-label].dump.gpg` | ja (GPG/AES-256) |
| DMS-Objektspeicher (`uploads`, `branding`, `garagedata`, `garagemeta`) | `objects-<zeitstempel>.tar.gz.gpg`    | ja               |
| Prüfsumme je Artefakt                                                  | `*.sha256`                            | —                |

### Prüfen, ob es läuft

```bash
cat /opt/arctos/backups/.last-run.json          # status, encrypted, objects
cat /opt/arctos/backups/.offsite-last-run.json  # uploaded, failed, status
cat /opt/arctos/backups/.dr-drill-last-run.json # letzter Restore-Drill
bash /opt/arctos/deploy/offsite-sync.sh --list  # Bestand in B2
```

Dieselben Stempel wertet der Dienst `ops-metrics` aus (§Monitoring) und
alarmiert bei einem Backup älter als 26 h, einem fehlgeschlagenen Lauf,
einem unverschlüsselten Backup, einem Backup ohne Objektspeicher und einem
überfälligen DR-Drill.

### Restore (einzelne Tenant-DB)

**Empfohlen** — das Skript macht die Schritte unten in der richtigen
Reihenfolge, entschlüsselt, legt vorher eine Sicherheitskopie an und
provisioniert die Rollen neu:

```bash
sudo bash /opt/arctos/deploy/rollback.sh --list
sudo bash /opt/arctos/deploy/rollback.sh --db <datei> --db-name grc_daimon
```

Vorher gefahrlos prüfen, ob das Backup überhaupt taugt (Wegwerf-Datenbank,
Produktion bleibt unberührt):

```bash
sudo /opt/arctos/scripts/dr-restore-drill.sh grc_daimon
```

<details>
<summary>Manueller Weg (falls das Skript nicht verfügbar ist)</summary>

```bash
# 0. Entschluesseln (seit 2026-09-01 sind alle Dumps .gpg)
gpg --batch --quiet --decrypt --pinentry-mode loopback \
    --passphrase-file /opt/arctos/.backup.key \
    /opt/arctos/backups/grc_daimon-<zeitstempel>.dump.gpg \
    > /tmp/restore.dump

# 1. Betroffenen Container stoppen
docker compose -f /opt/arctos/docker-compose.production.yml stop web-daimon

# 2. DB leeren + neu anlegen
docker compose -f /opt/arctos/docker-compose.production.yml exec -T postgres \
  psql -U grc -d postgres -c "DROP DATABASE grc_daimon; CREATE DATABASE grc_daimon OWNER grc;"

# 3. Custom-Dump einspielen (--disable-triggers wegen TimescaleDB circular FKs)
docker compose -f /opt/arctos/docker-compose.production.yml exec -T postgres \
  pg_restore -U grc -d grc_daimon --no-owner --disable-triggers \
  < /opt/arctos/backups/grc_daimon-YYYYMMDD-HHMMSS.dump

# 4. Container neu starten (Entrypoint läuft Migrations re-idempotent)
docker compose -f /opt/arctos/docker-compose.production.yml start web-daimon
```

**DR-Test** vierteljährlich (auf Test-DB, nicht live!):

```bash
docker compose exec postgres psql -U grc -c "CREATE DATABASE grc_restore_test;"
docker compose exec postgres pg_restore -U grc -d grc_restore_test --disable-triggers < $LATEST_DUMP
docker compose exec postgres psql -U grc -d grc_restore_test -c "SELECT COUNT(*) FROM organization;"
docker compose exec postgres psql -U grc -c "DROP DATABASE grc_restore_test;"
rm -f /tmp/restore.dump
```

**Nicht vergessen:** eine frisch angelegte Datenbank hat keine Grants. Ohne
`provision-grc-app.sh` verbindet die Anwendung danach nicht mehr — oder,
schlimmer, fällt auf den Superuser zurück und RLS ist wirkungslos.

```bash
GRC_APP_PASSWORD=… GRC_WORKER_PASSWORD=… \
  bash /opt/arctos/deploy/provision-grc-app.sh grc_daimon
```

</details>

## Disaster Recovery

| Szenario                                                   | RTO    | RPO   | Prozedur                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------- | ------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Einzelner Container crasht                                 | 1 min  | 0s    | Docker-Restart-Policy (`unless-stopped`) greift automatisch                                                                                                                                                                                                                           |
| Container **hängt** (Event-Loop blockiert, Pool erschöpft) | 2 min  | 0s    | `HEALTHCHECK` in beiden Images meldet `unhealthy`, `ops-metrics` alarmiert. **Bis 2026-08-31 gab es dafür keinen Mechanismus**: `restart: unless-stopped` reagiert nur auf einen BEENDETEN Prozess, `web` hatte keinen Healthcheck, und externes Monitoring existierte nicht (S13-13) |
| Tenant-DB korrupt                                          | 30 min | ≤ 24h | Restore aus lokalem Backup (siehe oben)                                                                                                                                                                                                                                               |
| Host kompromittiert (Ransomware)                           | 4h     | ≤ 24h | Neuer Host + Restore aus B2 (ADR-015)                                                                                                                                                                                                                                                 |
| Schrems-III / B2 nicht verfügbar                           | 8h     | ≤ 24h | Fallback auf lokalen Backup-Bestand; B2-Restore via rclone ohne DR                                                                                                                                                                                                                    |

## §8 Monitoring und Alarme

> **[ARCTOS-FULL-2026-08-31 / WP10 · S13-11, S13-12]** Dieser Abschnitt
> listete bis zum Audit ausschliesslich Endpunkte, **die man manuell
> abrufen kann**. Es gab niemanden und nichts, das sie abrief: eine
> vollständige Suche über den gesamten Baum nach
> `healthchecks.io|alertmanager|prometheus|promtail|loki|sentry|
opentelemetry|statsd|datadog` ergab null Treffer. Die Plattform war
> unbeobachtet, ein Ausfall wurde durch Nutzerreport entdeckt — und es gab
> keinen Alarm auf ein einziges sicherheitsrelevantes Ereignis.

### Der Dienst

`ops-metrics` läuft im Produktions-Stack (`docker-compose.production.yml`),
verbindet als `grc_worker` und ist **nicht** nach aussen exponiert.

```bash
curl -s http://ops-metrics:9105/metrics   # Prometheus-Textformat
curl -s http://ops-metrics:9105/readyz    # 503, wenn die Auswertung steht
curl -s http://ops-metrics:9105/alerts    # offene Alarme als JSON
# Ad hoc, ohne den Dienst:
DATABASE_URL=… node /opt/arctos/scripts/ops-metrics.mjs --check   # Exit 1 bei Alarm
```

### Alarme

| Alarm                                                            | Auslöser                                    | Schwelle (Env)                                     |
| ---------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------- |
| `failed_logins_burst`                                            | Anmeldefehler instanzweit in 5 min          | `ALERT_FAILED_LOGINS_5M` (20)                      |
| `failed_logins_single_account`                                   | Anmeldefehler EINES Kontos in 5 min         | `ALERT_FAILED_LOGINS_ACCOUNT_5M` (10)              |
| `mass_export_hourly` / `_daily`                                  | Datensätze je Nutzer in 1 h / 24 h          | `ALERT_EXPORT_ROWS_1H` (50 000) / `_24H` (200 000) |
| `audit_chain_broken`                                             | Fehler aus `audit_chain_verify()`           | **0** — keine Toleranz                             |
| `audit_chain_unverifiable`                                       | Kettenprüfung nicht ausführbar              | —                                                  |
| `audit_write_attempt`                                            | abgewiesene Schreibversuche auf `audit_log` | **0**                                              |
| `job_failures`                                                   | fehlgeschlagene Jobs in 1 h                 | `ALERT_JOB_FAILURES_1H` (3)                        |
| `scheduler_silent`                                               | **kein** Joblauf in 24 h                    | —                                                  |
| `backup_stale` / `_failed` / `_unencrypted` / `_without_objects` | Backup-Stempel                              | 26 h                                               |
| `offsite_stale` / `_failed`                                      | Off-Site-Stempel                            | 26 h                                               |
| `dr_drill_overdue` / `_failed`                                   | Drill-Stempel                               | 40 Tage                                            |
| `migrations_failed`                                              | Einträge im Ledger != `applied`             | **0**                                              |

### `job_run` — Betriebsprotokoll, kein Nachweis

> **[Welle 5b · OP-106/OP-100, 2026-09-05]** Die Tabelle `job_run` (Migration
> `0435`) ist die einzige Stelle, an der ablesbar ist, ob ein Hintergrundjob
> gelaufen ist. Genau deshalb wird sie irgendwann für eine Compliance-Aussage
> herangezogen werden — und dafür taugt sie nicht. Das steht bisher nur im
> Prüfbericht.

**Was sie ist.** Ein Betriebsprotokoll: eine Zeile je Lauf mit `status`
(`success`, `failed`, `partial`, `running`, `skipped_locked`), Start, Ende und
Fehlertext. 132 Cron-Dateien, einige im Minutentakt, erzeugen rund 40 000
Zeilen am Tag.

**Was sie nicht ist.**

| Erwartung an einen Nachweis          | `job_run`                                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Unveränderlich, an der Audit-Kette   | **nein** — bewusst nicht angehängt; kein Hash, keine Kettenprüfung                                    |
| Dauerhaft aufbewahrt                 | **nein** — `job-run-retention.ts` löscht nach 90 Tagen (`JOB_RUN_RETENTION_DAYS`), Fehlläufe nach 180 |
| Lückenlos                            | **nein** — siehe „Verpasste Läufe" unten                                                              |
| Sagt aus, _was_ ein Job gefunden hat | **nein** — nur, dass er lief und wie er endete                                                        |

Wer aus `job_run` eine Aussage wie „die Kontrolle wurde täglich geprüft"
ableiten will, braucht dafür eine eigene Begründung — und im Zweifel den
fachlichen Datensatz, den der Job geschrieben hat, nicht die Protokollzeile.

**Verpasste Läufe werden nicht nachgeholt (OP-100).** Der Scheduler läuft im
Worker-Prozess. Stirbt der Worker, laufen die Jobs dieser Minute nicht — und
es gibt keinen Nachholmechanismus. Für die täglichen Jobs holt der nächste Lauf
auf, für die Minutentakt-Queues ebenfalls; für einen Job, dessen einzige
tägliche Minute in ein Neustartfenster fiel, entsteht eine Lücke, die niemand
meldet. Was dagegen wirkt: der Compose-Healthcheck plus
`restart: unless-stopped` (das Fenster wird kurz). Was fehlt: ein Abgleich
zwischen Soll-Zeitplan und `job_run`, der eine ausgefallene Minute erkennt.

**Wonach ein Betreiber tatsächlich sucht:**

```sql
-- Fehlgeschlagene Läufe der letzten 24 h, nach Job gruppiert
SELECT job_name, count(*), max(started_at) AS zuletzt
  FROM job_run
 WHERE status = 'failed' AND started_at > now() - interval '24 hours'
 GROUP BY job_name ORDER BY 2 DESC;

-- Jobs, die seit über einem Tag gar nicht mehr gelaufen sind
SELECT job_name, max(started_at) AS zuletzt
  FROM job_run GROUP BY job_name
HAVING max(started_at) < now() - interval '25 hours'
 ORDER BY 2;
```

Die zweite Abfrage ist der Ersatz für den fehlenden Nachholmechanismus, solange
es ihn nicht gibt. Sie findet nur Jobs, die schon einmal liefen — ein Job, der
seit dem Deploy nie startete, taucht in `job_run` überhaupt nicht auf.

### Zustellung — der Betreiberschritt

```
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/…   # Slack/Teams/Mattermost/Alertmanager
HEALTHCHECKS_URL=https://hc-ping.com/<uuid>            # Dead-Man's-Switch
```

**Ohne diese beiden Werte schreibt `ops-metrics` die Alarme nur nach
stderr.** Sie sind dann im Container-Log sichtbar, aber niemand wird
geweckt. Der Dead-Man's-Switch ist der einzige Mechanismus, der auch den
Fall „Host komplett tot" meldet — ein Exporter auf demselben Host kann das
per Definition nicht.

### Liveness / Readiness

- `GET /api/v1/health` — public, 200 bei DB-Erreichbarkeit, 503 sonst
  - `dbLatencyMs` im Payload (normal < 10ms)

### Deep Health (Admin)

- `GET /api/v1/health/schema-drift` — Drizzle-Schema vs. DB-Tabellen
- `GET /api/v1/audit-log/integrity` — SHA-256 Hash-Chain-Verifikation (ADR-011)
- `GET /api/v1/audit-mgmt/audit-impact-kris` — KRIs über offene Findings, Treatments, überfällige Maßnahmen

### Log-Korrelation

Jede Response trägt `X-Request-ID`. Filter im Log-Shipper:

```
{request_id="abc123"}
```

## Incident Response

### DB reagiert nicht mehr

```bash
# Schnell-Check
docker compose logs --tail=100 postgres | grep -iE "error|fatal|out of memory"
# Lock-wait-Analyse
docker compose exec postgres psql -U grc -d grc_platform \
  -c "SELECT pid, state, wait_event_type, query FROM pg_stat_activity WHERE state != 'idle';"
# Noteingriff: hung query killen
docker compose exec postgres psql -U grc -c "SELECT pg_terminate_backend($PID);"
```

### 500-Errors auf einer Route

1. Finde Request-ID aus User-Report: `X-Request-ID: xyz`
2. `docker compose logs web 2>&1 | grep xyz`
3. Wenn "relation does not exist" → Schema-Drift, siehe [ADR-014](./ADR-014-migration-policy.md)

### Out-of-Disk

> **[WP10 · S13-16] Das hier stehende Kommando war gefährlich.**
> `docker system prune -af --volumes` löscht **alle Volumes, die kein
> LAUFENDER Container referenziert**. Sind `web`/`worker` in diesem Moment
> gestoppt — bei einem Incident der wahrscheinliche Fall — trifft das
> `uploads`, `branding`, `garagedata` und `miniodata`, also genau die
> Daten, für die es damals kein Backup gab (S13-06). Ein Runbook-Kommando,
> das unter Zeitdruck ausgeführt wird, darf das nicht können.

Reihenfolge: erst messen, dann das Ungefährliche, dann gezielt.

```bash
# 1. Wer verbraucht den Platz?
df -h /
sudo du -sh /opt/arctos/backups /var/lib/docker/containers /var/lib/docker/overlay2 2>/dev/null
docker system df -v | head -40

# 2. Container-Logs: seit der Remediation auf 50 MB x 5 je Container
#    begrenzt (S13-16). Wenn sie trotzdem gross sind, laeuft ein alter
#    Container ohne den logging-Block:
sudo find /var/lib/docker/containers -name '*-json.log' -size +200M -exec ls -lh {} +

# 3. Ungenutzte IMAGES und BUILD-CACHE — ohne --volumes, ohne -a:
docker image prune -f
docker builder prune -f
# Die Rollback-Images ausdruecklich behalten:
docker images --filter 'reference=arctos-rollback/*'

# 4. Backups NUR ueber die Rotation, nie von Hand:
sudo BACKUP_RETENTION_DAYS=14 bash /opt/arctos/deploy/backup-rotate.sh
#    (Der Wert gehoert danach in /etc/default/arctos-backup, damit
#     db-backup.sh und die Doku dieselbe Zahl nennen — S13-24.)

# 5. Erst wenn das nicht reicht und die Volumes NACHWEISLICH gesichert sind:
cat /opt/arctos/backups/.last-run.json      # "objects": true erwartet
docker volume ls                            # bewusst einzeln entscheiden
```

**Niemals** `docker system prune --volumes` auf diesem Host.

## Common Tasks

### Neuen Mandanten anlegen

```bash
sudo bash /opt/arctos/deploy/create-tenant.sh <name> <subdomain>
```

Für Demo-Mandanten mit Seed-Daten `--with-demo` als 3. Argument.

### Admin-User für Private-Tenant anlegen

```bash
docker compose exec postgres psql -U grc -d grc_newtenant -c "
INSERT INTO \"user\" (id, email, name, password_hash, language)
VALUES (gen_random_uuid(), 'admin@example.com', 'Admin', '\$2b\$12\$...', 'de');"
```

(bcrypt-Hash mit Kosten 12 für das Wunsch-Passwort vorher lokal generieren.)

### Module für Org aktivieren/deaktivieren

Via UI: `/admin/modules` auf der betroffenen Org. Via SQL:

```sql
UPDATE module_config SET ui_status = 'enabled' WHERE org_id = ? AND module_key = 'audit';
```

### Git-Pull scheitert mit CRLF-Fehler

Siehe `.gitattributes` — sollte seit Commit `3cc9bf5` nicht mehr vorkommen. Fallback:

```bash
sudo git checkout -- <path>
sudo git pull
```
