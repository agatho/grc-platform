## ADR-015: Off-Site Backup Strategy

| **ADR-ID**  | **015**                                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**   | **Off-Site Backup via Backblaze B2 + rclone**                                                                                                                                                           |
| **Status**  | **Proposed**                                                                                                                                                                                            |
| **Date**    | 2026-04-18                                                                                                                                                                                              |
| **Context** | ADR-014 setzte den On-Host-Backup-Prozess (`deploy/db-backup.sh`) auf. Ein zweites Failure-Domain fehlt noch: wenn der Hetzner-Host ausfällt (Disk, Ransomware, Storage-Delete), sind alle Backups weg. |

### Decision

Wir pushen jeden erfolgreichen `db-backup.sh`-Lauf zusätzlich nach **Backblaze B2** via **rclone**. B2 ist das günstigste S3-kompatible Object-Storage für den GDPR-kompatiblen EU-Datenraum (Amsterdam-Region); Kosten ≈ 0,005 €/GB/Monat. Bei ~5 MB pro Tenant × 2 Tenants × 30 Tage × 12 Monate ergibt das < 1 € Jahres-Aufwand.

### Alternatives Considered

| Option                      | Pro                                                | Contra                                                        | Entscheidung                                      |
| --------------------------- | -------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------- |
| **B2 + rclone**             | billig, S3-kompatibel, EU-Hosting, einfacher Setup | Zusätzliche Drittpartei (aber verschlüsselte Dumps → minimal) | ✅ Angenommen                                     |
| AWS S3 Glacier              | Sehr billig, Enterprise                            | Hohe Retrieval-Kosten, US-Anbieter (DSGVO-Abwägung)           | ❌                                                |
| Hetzner Storage Box         | Same-Provider, günstig                             | Same-Provider-Risiko (Hetzner-Ausfall = Backup weg)           | ❌ — **Kernmotivation ist zweite Failure-Domain** |
| Selber Rsync zu anderem VPS | Vollkontrolle                                      | Betriebsaufwand, zweiter Root                                 | ❌ Ops-Overhead hoch                              |

### Architecture

```
┌──────────────┐   db-backup.sh     ┌─────────────────┐   rclone sync    ┌──────────────┐
│ Postgres-DB  │ ─────────────────► │ /opt/arctos/    │ ───────────────► │ Backblaze B2 │
│ (Container)  │  nightly cron      │  backups/*.dump │  encrypted        │  EU bucket   │
└──────────────┘                    └─────────────────┘                    └──────────────┘
```

Reihenfolge:

1. Cron (0 2 \* \* \*): `db-backup.sh` erzeugt lokale Dumps unter `/opt/arctos/backups/`
2. Cron (0 3 \* \* \*): `offsite-sync.sh` pusht alle Dateien < 48h alt nach B2
3. Backups älter als 30 Tage lokal gelöscht (`db-backup.sh` Rotation)
4. Backups älter als 90 Tage in B2 gelöscht (B2 Lifecycle Policy)

### Key Security Decisions

1. **Verschlüsselung**: rclone nutzt `--password-command` mit GPG-symmetric. Schlüssel liegt NIE im Image, nur als Root-lesbare Datei `/opt/arctos/.rclone.key` (mode 0400). Ein B2-Leak ohne diese Datei ist nutzlos.
2. **Append-Only Bucket**: B2-Application-Key mit Capability `listBuckets + listFiles + readFiles + writeFiles` — **kein `deleteFiles`**. Ransomware im Host kann Backups nicht von dort aus löschen. Retention-Bereinigung nur über B2-UI oder separaten Key.
3. **EU-Region**: Bucket in `eu-central-003` (Amsterdam) — verhindert US-Data-Transfer (Schrems-II-Compliance).
4. **Kein Private-Key in Git**: Setup-Script erstellt `.rclone.conf`, der User trägt Application-Key manuell ein. Templatierung per Umgebungsvariable.

### Operational Runbook

**Initial Setup** (einmalig, als root auf Hetzner):

```bash
# 1. Install rclone + gpg
apt install -y rclone gnupg

# 2. Erstelle B2 Account + Application-Key mit writeFiles-only Capability
#    https://www.backblaze.com/b2/cloud-storage.html
#    Notiere: keyId, applicationKey, bucketName

# 3. Konfiguration via Template
bash deploy/offsite-sync-setup.sh

# 4. Cron einrichten
cat >> /etc/crontab <<EOF
0 2 * * * root /opt/arctos/deploy/db-backup.sh >> /var/log/arctos-backup.log 2>&1
30 2 * * * root /opt/arctos/deploy/offsite-sync.sh >> /var/log/arctos-offsite.log 2>&1
EOF
```

**Disaster-Recovery-Test** (vierteljährlich empfohlen):

```bash
# Hol den Dump von B2 zurück
rclone copy b2-arctos:arctos-backups/grc_platform-$DATE.dump /tmp/restore/
# Restore in Test-DB (nicht live!)
docker compose exec postgres psql -U grc -c "CREATE DATABASE grc_restore_test;"
docker compose exec postgres pg_restore -U grc -d grc_restore_test --disable-triggers < /tmp/restore/grc_platform-$DATE.dump
# Smoke-Test
docker compose exec postgres psql -U grc -d grc_restore_test -c "SELECT COUNT(*) FROM organization;"
# Aufräumen
docker compose exec postgres psql -U grc -c "DROP DATABASE grc_restore_test;"
```

### Metrics + Monitoring

`offsite-sync.sh` schreibt in `/var/log/arctos-offsite.log` strukturiert (`jq`-parseable):

- `timestamp`
- `tenant`
- `dump_size_bytes`
- `upload_duration_ms`
- `b2_object_key`

Optional: Prometheus-node-exporter-textfile parst das Log und stellt `arctos_offsite_backup_age_seconds` als Gauge bereit — Alarm bei > 26h.

### Consequences

**Positiv:**

- Ransomware-resistent (append-only B2 Key)
- GDPR-compliant EU-Region
- ~1 €/Jahr Infra-Kosten

**Negativ:**

- Dritter Anbieter (Backblaze)
- Schlüssel-Management auf dem Hetzner-Host
- Erstmalige Restore-Übung vierteljährlich nötig (nicht zu unterschätzender Operations-Aufwand)

### References

- ADR-014: DB Migration Policy (Phase 1 established local backups)
- ISO 22301 Kap. 8.5 (Continuity-Strategy inkl. Backup)
- Schrems-II-Urteil (EuGH 2020) — keine US-Transfers ohne SCC
