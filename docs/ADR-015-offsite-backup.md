## ADR-015: Off-Site Backup Strategy

| **ADR-ID**  | **015**                                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**   | **Off-Site Backup via Backblaze B2 + rclone**                                                                                                                                                           |
| **Status**  | **Accepted** (2026-09-01 — Umsetzung abgeschlossen, siehe §Umsetzungsstand)                                                                                                                             |
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

1. Cron (`0 3 * * *`): `db-backup.sh` erzeugt lokale, **verschlüsselte**
   Dumps aller `grc_*`-Datenbanken UND ein Archiv des DMS-Objektspeichers
   unter `/opt/arctos/backups/`.
2. **Verkettet in derselben Zeile** (`&&`): `backup-rotate.sh`, danach
   `offsite-sync.sh`. Zwei getrennte Cron-Zeilen mit eigenen Uhrzeiten waren
   die Ursache von S13-23b — die Doku nannte 02:30 für den Sync, das Backup
   lief um 03:00, der Sync übertrug also dauerhaft den Stand des Vortags.
3. Lokale Aufbewahrung: `BACKUP_RETENTION_DAYS` aus
   `/etc/default/arctos-backup` (Standard 30 Tage). **Eine** Quelle für
   `db-backup.sh` und `backup-rotate.sh` — bis 2026-08-31 löschte das eine
   Skript nach 30, das andere nach 14 Tagen, während zwei Dokumente 30
   zusagten (S13-24).
4. Backups älter als 90 Tage in B2 gelöscht (B2 Lifecycle Policy).
5. Cron (`0 5 1 * *`): `scripts/dr-restore-drill.sh` — monatlicher
   Restore-Drill über ALLE Datenbanken, mit Application-Restore und
   Nachweis in `bc_exercise`.

### Umsetzungsstand (2026-09-01, ARCTOS-FULL-2026-08-31 / WP10)

> Dieses ADR stand seit dem 2026-04-18 auf **Proposed** und beschrieb
> Eigenschaften, die es nicht gab. Das Audit hat drei davon einzeln belegt;
> alle drei sind jetzt implementiert. Der Status ist **Accepted**, weil er
> ab hier den Ist-Zustand beschreibt — nicht die Absicht.

| Zusage des ADR                                    | Stand 2026-08-31 (Audit)                                                                                                                                            | Stand 2026-09-01                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Verschlüsselte Übertragung (§1)                   | **nicht implementiert** — nacktes `rclone copyto` gegen ein `type = b2`-Remote; `/opt/arctos/.rclone.key` wurde von keinem Skript erzeugt oder gelesen (**S13-07**) | implementiert, aber **an anderer Stelle** — siehe §1 unten                                         |
| Cron installiert                                  | **nein** — `backup-cron-install.sh` schrieb nur die Backup-Zeile; der Sync existierte als Copy-&-Paste-Vorschlag (**S13-23a**)                                      | `backup-cron-install.sh` installiert Backup, Rotation und Sync in EINER verketteten Zeile          |
| Reihenfolge Backup → Sync                         | **verdreht** — Doku nannte 02:30 für den Sync, das Backup lief 03:00; der Off-Site-RPO war faktisch 48 h statt 24 h (**S13-23b**)                                   | verkettet, Sync läuft nach dem Backup                                                              |
| Fehler sichtbar                                   | **nein** — bei fehlgeschlagenen Uploads endete das Skript mit Exit 0 und `"uploaded":0` (**S13-23c**)                                                               | Exit 2 bei Fehlern, Exit 3 wenn nichts zu übertragen war, Exit 5 bei Klartext                      |
| `arctos_offsite_backup_age_seconds` (§Monitoring) | **nicht implementiert** (**S13-23d**)                                                                                                                               | `scripts/ops-metrics.mjs` exportiert die Metrik und alarmiert ab 26 h                              |
| Objektspeicher gesichert                          | **nein** — nur `pg_dump`; die signierten DMS-Dokumente waren in keinem Backup (**S13-06**)                                                                          | `db-backup.sh --with-objects` (Standard) sichert `uploads`, `branding`, `garagedata`, `garagemeta` |
| Restore je getestet                               | **nein** — Drill seit 2026-05-01 überfällig, ohne Cron, ohne Nachweis (**S13-08**)                                                                                  | monatlicher Cron, Ergebnis in `bc_exercise` und als JSON-Stempel                                   |

### Key Security Decisions

1. **Verschlüsselung — GEÄNDERT gegenüber der ursprünglichen Fassung.**
   Ursprünglich vorgesehen war eine Verschlüsselung IM TRANSPORT
   (`rclone --password-command` bzw. ein `crypt`-Remote). Umgesetzt ist
   stattdessen eine Verschlüsselung AN DER QUELLE: `deploy/db-backup.sh`
   leitet jeden `pg_dump` und jedes Objekt-Archiv durch
   `gpg --symmetric --cipher-algo AES256` und legt `.dump.gpg` /
   `.tar.gz.gpg` ab. `deploy/offsite-sync.sh` überträgt ausschliesslich
   verschlüsselte Artefakte und verweigert Klartext (Exit 5,
   `OFFSITE_ALLOW_PLAINTEXT=1` als ausdrückliche Ausnahme).

   **Warum die Abweichung:** die Transport-Variante hätte das LOKALE Backup
   unverschlüsselt gelassen. Die Dumps liegen unter `/opt/arctos/backups/`
   auf demselben Host wie die Anwendung und enthalten
   `whistleblowing`-Identitäten (HinSchG §8), `dpms`-Vorfalldaten
   (Art.-9-DSGVO-Kategorien), Passwort-Hashes und verschlüsselte
   Connector-Secrets. Ein Foothold auf dem Host hätte gereicht. Die
   Verschlüsselung an der Quelle deckt beide Kopien mit einem Schlüssel ab.

   Der Schlüssel liegt als `/opt/arctos/.backup.key` (mode 0400, root),
   wird von `backup-cron-install.sh` erzeugt und ist NIE Teil eines Images
   oder des Repositories.

   **Betriebliche Bedingung:** Eine Kopie des Schlüssels MUSS ausserhalb
   dieses Hosts liegen. Ein Host-Totalverlust nimmt ihn sonst mit — und
   damit jede Wiederherstellbarkeit, obwohl die Off-Site-Kopien intakt
   sind. Das ist der Preis der Verschlüsselung und steht als Schritt 0 im
   DR-Playbook.

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
0 3 * * * root /opt/arctos/deploy/db-backup.sh >> /var/log/arctos-backup.log 2>&1
30 2 * * * root /opt/arctos/deploy/offsite-sync.sh >> /var/log/arctos-offsite.log 2>&1
EOF
```

> **Dieses Snippet ist überholt und war die Ursache von S13-23b** (Sync um
> 02:30, Backup um 03:00 → der Sync lief 30 Minuten VOR dem Backup und
> übertrug den Stand des Vortags). Es steht hier nur noch als historischer
> Beleg. Der einzig richtige Weg ist:
>
> ```bash
> sudo bash /opt/arctos/deploy/backup-cron-install.sh
> ```
>
> Das Skript installiert Backup, Rotation, Off-Site-Sync und DR-Drill in der
> richtigen Reihenfolge, legt den Backup-Schlüssel an und schreibt die
> gemeinsame Retention nach `/etc/default/arctos-backup`.

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

**Umgesetzt (nicht mehr optional):** `scripts/ops-metrics.mjs` liest
`/opt/arctos/backups/.offsite-last-run.json` und stellt
`arctos_offsite_backup_age_seconds` sowie `arctos_offsite_last_status` im
Prometheus-Format bereit (Compose-Dienst `ops-metrics`, `:9105/metrics`).
Alarm bei > 26 h oder bei einem Lauf mit Status != `ok`. Bis 2026-08-31 war
diese Metrik als „optional" geführt und nicht implementiert — niemand las
`/var/log/arctos-offsite.log`, das Off-Site-Backup konnte Monate tot sein
(S13-23c/d).

### Consequences

**Positiv:**

- Ransomware-resistent (append-only B2 Key)
- GDPR-compliant EU-Region
- ~1 €/Jahr Infra-Kosten

**Negativ:**

- Dritter Anbieter (Backblaze)
- Schlüssel-Management auf dem Hetzner-Host. **Verschärft durch die
  Verschlüsselung an der Quelle:** ohne `/opt/arctos/.backup.key` ist kein
  Backup wiederherstellbar. Eine Off-Host-Kopie ist damit keine Empfehlung,
  sondern Voraussetzung — sie ist Schritt 0 des DR-Playbooks.
- Restore-Übung monatlich (nicht vierteljährlich). Der Drill ist
  automatisiert (`scripts/dr-restore-drill.sh`, Cron am 1. um 05:00 UTC),
  aber er startet die Anwendung gegen die wiederhergestellte Datenbank und
  braucht dafür Rechenzeit und einen freien Port.

### References

- ADR-014: DB Migration Policy (Phase 1 established local backups)
- ISO 22301 Kap. 8.5 (Continuity-Strategy inkl. Backup)
- Schrems-II-Urteil (EuGH 2020) — keine US-Transfers ohne SCC
