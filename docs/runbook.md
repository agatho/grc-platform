# ARCTOS Operations Runbook

_Audience: Ops-on-call, Platform-Maintainer._
_Last updated: 2026-04-18._

## Contents

1. [Architecture Overview](#architecture-overview)
2. [Deployment](#deployment)
3. [Backups](#backups)
4. [Disaster Recovery](#disaster-recovery)
5. [Monitoring](#monitoring)
6. [Incident Response](#incident-response)
7. [Common Tasks](#common-tasks)

---

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

Was das tut:
1. `git pull` im `/opt/arctos`
2. Docker-Image-Rebuild aus aktuellem HEAD
3. Container-Restart pro Tenant (web-\*)
4. Entrypoint läuft alle Migrations aus `packages/db/drizzle/` + `packages/db/src/migrations/` (ADR-014 Phase 1/2)

**Dauer**: ~3–5 min für Build + ~30s pro Tenant für Restart.

### Single-Tenant-Update

```bash
docker compose -f /opt/arctos/docker-compose.production.yml pull web
docker compose -f /opt/arctos/docker-compose.production.yml up -d web
```

### Pre-Deploy-Checklist

1. `sudo bash /opt/arctos/deploy/db-backup.sh --pre-deploy`
2. Drift-Check: `curl /api/v1/health/schema-drift` → `healthy: true` erwartet
3. Migration-Count prüfen: `docker compose logs --tail=200 web | grep "Applied"`

## Backups

### Local (auto, crontab)

```
0 2 * * * root /opt/arctos/deploy/db-backup.sh >> /var/log/arctos-backup.log 2>&1
```

Ablage: `/opt/arctos/backups/` — Custom-Format (`.dump`) + Plain-SQL-gzipped (`.sql.gz`) + SHA-256-Checksumme. Rotation: > 30 Tage löscht das Script selbst.

### Off-Site (B2)

Siehe [ADR-015](./ADR-015-offsite-backup.md). Setup einmalig:

```bash
sudo bash /opt/arctos/deploy/offsite-sync-setup.sh
```

Danach in `/etc/crontab`:

```
30 2 * * * root B2_REMOTE=b2-arctos:arctos-backups /opt/arctos/deploy/offsite-sync.sh
```

### Restore (einzelne Tenant-DB)

```bash
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
```

## Disaster Recovery

| Szenario | RTO | RPO | Prozedur |
|---|---|---|---|
| Einzelner Container crasht | 1 min | 0s | Docker-Restart-Policy (`unless-stopped`) greift automatisch |
| Tenant-DB korrupt | 30 min | ≤ 24h | Restore aus lokalem Backup (siehe oben) |
| Host kompromittiert (Ransomware) | 4h | ≤ 24h | Neuer Host + Restore aus B2 (ADR-015) |
| Schrems-III / B2 nicht verfügbar | 8h | ≤ 24h | Fallback auf lokalen Backup-Bestand; B2-Restore via rclone ohne DR |

## Monitoring

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

`/opt/arctos/backups/` ist der größte Verursacher. Manuelles Clean-up:

```bash
find /opt/arctos/backups -type f -mtime +14 -delete
# Plus Docker-Volume-Cleanup:
docker system prune -af --volumes
```

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
