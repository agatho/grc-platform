# Disaster-Recovery-Playbook

_Stand: 2026-04-18 · Target: Ops / On-Call / Maintainer_

Dieses Dokument beschreibt Recovery-Szenarien fuer die ARCTOS-Produktions-
Installation auf Hetzner (`arctos.charliehund.de` + Tenant-Subdomains).
Es ergaenzt [`docs/runbook.md`](./runbook.md) um Katastrophen-Faelle.

## RPO / RTO-Ziele

| Szenario | RPO (max. Datenverlust) | RTO (max. Downtime) |
|---|---|---|
| Einzelner Container-Crash | 0 | 5 min |
| DB-Korruption | 24h (nightly dump) | 2h |
| Kompletter Host-Ausfall | 24h | 8h (neuer Hetzner-Host + Restore) |
| Region-Ausfall (Falkenstein) | 24h | 12h (B2 -> neuer Host in anderer Region) |
| Ransomware / Malware-Eindringen | 24h | 24h (forensischer Clean-Restore) |

RTO misst von "Incident Confirmed" bis "Service Back Online fuer >50 % der
Tenants". RPO misst den max. Datenverlust, gemessen vom letzten bekannten
Guten-Backup.

## Backup-Inventar

| Scope | Frequenz | Ort | Retention |
|---|---|---|---|
| PostgreSQL dump (alle DBs) | nightly 02:00 UTC | `/opt/arctos/backups/` | 30 Tage lokal |
| PostgreSQL dump (off-site) | nightly, gestaged nach local | Backblaze B2 EU (ADR-015) | 90 Tage, append-only |
| Docker-Images | bei Deploy | Registry + local cache | n/a |
| Code (repo) | on commit | GitHub + local `/opt/arctos/source/` | unbegrenzt |
| ENV-Files + Secrets | bei manueller Aenderung | `/opt/arctos/config/.env*` + 1Password-Vault | live |

## Szenario 1 — Container-Crash

**Symptom**: `/api/v1/health` 5xx oder Timeout, `docker ps` zeigt Container
fehlt oder in Restart-Loop.

**Vorgehen**:
1. `cd /opt/arctos && docker compose logs web --tail=100` -- Error-Cause identifizieren
2. `docker compose restart web` -- einfache Restart-Heilung
3. Wenn wiederholt: `docker compose down web && docker compose up -d web`
4. Bei persistentem Fehler: rollback auf vorherige Image-Version via
   `ARCTOS_IMAGE_TAG=vX.Y.Z docker compose up -d`
5. Post-Mortem: Log-Bundle an Maintainer, Issue-Label `postmortem-required`

## Szenario 2 — DB-Korruption / Failed Migration

**Symptom**: `/api/v1/health` returns 503 mit `db: unhealthy`, oder
`schema-drift` meldet `mismatch`, oder psql-Errors in Web-Log.

**Vorgehen**:
1. Web-Container stoppen (Read-Only-Mode): `docker compose stop web web-daimon web-*`
2. DB-Status pruefen: `docker compose exec postgres psql -U grc -d grc_platform -c "SELECT current_database(), pg_is_in_recovery();"`
3. Backup-Liste anzeigen: `ls -lht /opt/arctos/backups/*.dump | head`
4. Restore auf temporaere DB: `docker compose exec postgres pg_restore -U grc -d grc_platform_restore_test /opt/arctos/backups/latest.dump`
5. Diff pruefen gegen Live: `schema-drift`-Report auf Restore-DB ausfuehren
6. Wenn Restore-DB ok: Live-DB umbenennen, Restore-DB umbenennen, Web
   wieder starten
7. Wenn nicht: Zwischen-Backup benutzen (24h zurueck, dann 48h, etc.)

**Kritisch**: Nie ohne Backup-Bestaetigung `DROP DATABASE`. Immer erst in
Restore-Test-DB validieren.

## Szenario 3 — Host-Ausfall

**Symptom**: Kein SSH zum Host, kein Ping, Hetzner-Console zeigt Hardware-
Problem oder "deallocated".

**Vorgehen**:
1. Hetzner-Support-Ticket oeffnen (falls nicht klar ob Hetzner-seitig)
2. **Paralleler Weg**: neuer Hetzner-Host bestellen (selbes Produkt) --
   CX42 oder grosses Dedicated je nach Setup
3. Basis-Provisioning via `deploy/provision.sh` (wenn vorhanden) oder
   manuell: Docker, docker-compose, UFW, Caddy
4. `/opt/arctos/config/.env*` aus 1Password-Vault wiederherstellen
5. Code: `git clone https://github.com/agatho/grc-platform.git /opt/arctos/source`
6. DB-Restore aus B2: `deploy/offsite-sync.sh --download latest && pg_restore ...`
7. DNS umstellen: `arctos.charliehund.de` CNAME / A-Record auf neuen Host
8. Smoke-Test: `/api/v1/health` + `/api/v1/audit-log/integrity`

Geschaetzte RTO: 6-8h ab Bestaetigung des Ausfalls.

## Szenario 4 — Region-Ausfall (Hetzner Falkenstein komplett)

**Symptom**: Mehrere Hetzner-Services nicht erreichbar (Statuspage.hetzner.com
pruefen).

**Vorgehen**:
1. Wie Szenario 3, aber **andere Region** waehlen (Helsinki oder Nuernberg)
2. B2 ist multi-region, Download aus `eu-central` sollte weiterhin funktionieren
3. DNS-TTL pruefen: bei 300s schnell, bei 86400s problematisch (CWS soll
   TTL auf 300s halten fuer kritische Records -- in Runbook vermerken)

Geschaetzte RTO: 10-12h.

## Szenario 5 — Ransomware / Unauthorized Access

**Symptom**: Uebermaessige Daten-Modifikationen in `audit_log`, Hash-Chain-
Breakage via `/api/v1/audit-log/integrity`, ungewohnte Login-Events in
`access_log`.

**Vorgehen**:
1. **Sofort**: Web-Container stoppen, Read-Only-Incident-Banner auf allen
   oeffentlichen URLs (Caddy-Static-Fallback)
2. **Forensik vor Restore**: Live-DB-Snapshot in Forensic-Storage kopieren
   (**nicht** ueberschreiben!) -- `pg_basebackup` vollstaendig
3. Audit-Log-Integritaets-Bericht: `/api/v1/audit-log/integrity` -- letzter
   guter Block ist Wiederherstellungs-Anker
4. Alle aktiven Sessions invalidieren: `TRUNCATE session; TRUNCATE account;`
   (nach Forensic-Snapshot)
5. Secrets rotieren: DB-PW, Auth-Secret, API-Keys (ADR-018)
6. Backup-Restore aus B2 **von VOR der kompromittierten Zeitstempel**
7. Security-Audit + Pen-Test vor Re-Opening
8. Users informieren, DSGVO-Art. 33 in Gang setzen wenn personenbezogene
   Daten betroffen (72h-Frist)
9. Post-Mortem mit Law-Enforcement-Konsultation falls noetig

**Kritisch**: Kein Restore ohne Forensic-Snapshot. Compliance braucht
einen "sauberen" Vorher-Stand als Evidenz.

## Regelmaessige Uebungen

| Test | Frequenz | Owner | Naechster Termin |
|---|---|---|---|
| Backup-Restore in Restore-DB | monatlich | Ops | 2026-05-01 |
| B2-Download + pg_restore Dry-Run | quartalsweise | Ops | 2026-07-01 |
| Runbook-Durchspiel mit Szenario 2 | halbjaehrlich | Maintainer + Ops | 2026-10-01 |
| Region-Ausfall Tabletop | jaehrlich | Maintainer | 2026-12-01 |

Uebungs-Ergebnisse werden in `bc_exercise`-Tabelle (BCMS-Modul) erfasst.

## Kontakte

| Rolle | Name | Kanal |
|---|---|---|
| Maintainer / Code-Owner | @agatho | GitHub, agatho@charliehund.de |
| Hetzner-Support | Ticket-System | <https://console.hetzner.cloud> |
| Backblaze-Support | Ticket-System | <https://secure.backblaze.com/contact_support.htm> |
| Registrar (Charliehund.de) | tbd | tbd |

## Verwandte Dokumente

- [runbook.md](./runbook.md) -- normal-operations
- [ADR-011-audit-trail.md](./ADR-011-audit-trail.md) -- Hash-Chain-Spec (TBD)
- [ADR-015-offsite-backup.md](./ADR-015-offsite-backup.md) -- B2-Architektur
- [ADR-017-monitoring.md](./ADR-017-monitoring.md) -- Alerting-Pipeline
- [SECURITY.md](../SECURITY.md) -- Security-Disclosure-Policy
