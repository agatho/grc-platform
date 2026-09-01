# Disaster-Recovery-Playbook

_Stand: **2026-09-01** (überarbeitet nach ARCTOS-FULL-2026-08-31 / WP10) ·
Target: Ops / On-Call / Maintainer_

> **Was an diesem Dokument falsch war (S13-05, S13-06, S13-07, S13-08).**
> Alle drei hier und im Release-Runbook dokumentierten Rollback-Kommandos
> waren falsch: eine Variable, die niemand liest (`ARCTOS_IMAGE_TAG` statt
> `IMAGE_TAG`), eine Datei, die es nie gab (`db-<timestamp>.sql`), und ein
> Flag, das nicht implementiert war (`offsite-sync.sh --download latest`).
> Das Image-Rollback lief dabei **ohne Fehlermeldung durch und startete
> erneut `:latest`** — also exakt das defekte Image. Im Incident ist ein
> Kommando, das still nichts tut, die gefährlichste Klasse von Doku-Fehler.
> Das Backup-Inventar unten führte ausserdem den DMS-Objektspeicher nicht;
> die signierten Dokumente waren in keinem Backup.
>
> Alle Kommandos in diesem Dokument sind gegen die Skripte im Repository
> geprüft. Die Rollback-Prozeduren stehen jetzt in **einem** Skript
> (`deploy/rollback.sh`), damit sie nicht wieder auseinanderlaufen.

Dieses Dokument beschreibt Recovery-Szenarien fuer die ARCTOS-Produktions-
Installation auf Hetzner (`arctos.charliehund.de` + Tenant-Subdomains).
Es ergaenzt [`docs/runbook.md`](./runbook.md) um Katastrophen-Faelle.

## RPO / RTO-Ziele

| Szenario                        | RPO (max. Datenverlust) | RTO (max. Downtime)                      |
| ------------------------------- | ----------------------- | ---------------------------------------- |
| Einzelner Container-Crash       | 0                       | 5 min                                    |

| DB-Korruption                   | 24h (nightly dump)      | 2h                                       |
| Kompletter Host-Ausfall         | 24h                     | 8h (neuer Hetzner-Host + Restore)        |
| Region-Ausfall (Falkenstein)    | 24h                     | 12h (B2 -> neuer Host in anderer Region) |
| Ransomware / Malware-Eindringen | 24h                     | 24h (forensischer Clean-Restore)         |

RTO misst von "Incident Confirmed" bis "Service Back Online fuer >50 % der
Tenants". RPO misst den max. Datenverlust, gemessen vom letzten bekannten
Guten-Backup.

## Szenario 0 — Schlüsselverlust (VOR allem anderen lesen)

Seit 2026-09-01 sind alle Backups **verschlüsselt** (GPG/AES-256,
ADR-015 §1 — vorher war die Verschlüsselung zugesagt und nicht
implementiert, S13-07). Damit gilt:

> **Ohne `/opt/arctos/.backup.key` ist KEIN Backup wiederherstellbar.**

Der Schlüssel liegt auf demselben Host wie die Anwendung. Ein Host-
Totalverlust nimmt ihn mit — und damit jede Wiederherstellbarkeit, obwohl
die Off-Site-Kopien in B2 intakt sind.

**Pflicht vor dem ersten Produktivbetrieb:**

```bash
sudo cat /opt/arctos/.backup.key
```

Den Wert in den Passwort-Safe legen UND als versiegelten Ausdruck in den
Tresor. Beim Schlüsselwechsel beide Kopien erneuern und den alten
Schlüssel aufbewahren, solange Backups aus seiner Zeit existieren
(mindestens `BACKUP_RETENTION_DAYS`, Standard 30 Tage, plus 90 Tage B2).

Dasselbe gilt für `AUDIT_SEAL_KEY` und `PII_PSEUDONYM_KEY`: ohne sie ist ein
wiederhergestellter Audit-Trail nicht verifizierbar bzw. sind bestehende
Pseudonyme nicht mehr zuordenbar (docs/runbook.md §7).

## Backup-Inventar

| Scope | Frequenz | Ort | Retention |
| --- | --- | --- | --- |
| PostgreSQL-Dumps (alle `grc_*`-DBs), **verschlüsselt** | nächtlich 03:00 UTC | `/opt/arctos/backups/*.dump.gpg` | `BACKUP_RETENTION_DAYS` aus `/etc/default/arctos-backup` (Standard 30 Tage) |
| **DMS-Objektspeicher** (`uploads`, `branding`, `garagedata`, `garagemeta`), verschlüsselt | nächtlich, im selben Lauf | `/opt/arctos/backups/objects-*.tar.gz.gpg` | wie oben |
| Off-Site-Kopie (nur verschlüsselte Artefakte) | nächtlich, **verkettet NACH** dem Backup | Backblaze B2 EU (ADR-015) | 90 Tage, append-only |
| **Backup-Schlüssel** | bei Erzeugung / Wechsel | `/opt/arctos/.backup.key` (0400 root) **+ Off-Host-Kopie** | solange Backups aus seiner Zeit existieren |
| Docker-Images (Vorgänger) | bei jedem Deploy | lokal als `arctos-rollback/grc-<svc>:<old-sha>` + GHCR per Commit-SHA | lokal bis zum übernächsten Deploy |
| Code (Repo) | bei jedem Commit | GitHub + lokal `/opt/arctos/` | unbegrenzt |
| ENV-Files + Secrets | bei manueller Änderung | `/opt/arctos/.env` (0600) + Passwort-Safe | live |
| Deploy-Protokoll | bei jedem Deploy/Rollback | `/opt/arctos/deploy-history.jsonl` | unbegrenzt |

> **Was hier bis 2026-08-31 fehlte:** der Objektspeicher (S13-06). Gesichert
> wurde ausschliesslich `pg_dump`, also allein das Volume `pgdata`. Nach
> einem Host-Restore standen in der Datenbank die `document`-Zeilen mit
> ihren SHA-256-Hashes, Signaturketten und Aufbewahrungsfristen — **die
> Dateien selbst waren weg**. Die Hash-Kette hätte dann nur noch bewiesen,
> dass ein nicht mehr vorhandenes Dokument einmal existierte. Für ein
> Produkt, das Dokumentenintegrität nach eIDAS bewirbt, war das der Verlust
> genau der Artefakte, um die es geht — und nebenbei das Ende der
> Auskunftsfähigkeit nach Art. 15 DSGVO.

**Prüfen, ob das Backup wirklich läuft:**

```bash
cat /opt/arctos/backups/.last-run.json          # status, encrypted, objects
cat /opt/arctos/backups/.offsite-last-run.json  # uploaded, failed, status
cat /opt/arctos/backups/.dr-drill-last-run.json # letzter Restore-Drill
```

Dieselben Stempel wertet `ops-metrics` aus und alarmiert
(`arctos_backup_age_seconds`, `arctos_offsite_backup_age_seconds`,
`arctos_dr_drill_age_seconds`).

## Szenario 1 — Container-Crash

**Symptom**: `/api/v1/health` 5xx oder Timeout, `docker ps` zeigt Container
fehlt oder in Restart-Loop.

**Vorgehen**:

1. `cd /opt/arctos && docker compose logs web --tail=100` -- Error-Cause identifizieren
2. `docker compose restart web` -- einfache Restart-Heilung
3. Wenn wiederholt: `docker compose down web && docker compose up -d web`
4. Bei persistentem Fehler: Rollback auf die vorherige Image-Version.
   ```bash
   sudo bash /opt/arctos/deploy/rollback.sh --list          # was ist verfuegbar?
   sudo bash /opt/arctos/deploy/rollback.sh --image <sha>   # zurueckrollen
   ```
   > **Hier stand bis 2026-08-31:**
   > `ARCTOS_IMAGE_TAG=vX.Y.Z docker compose up -d`.
   > Die Compose liest `${IMAGE_TAG:-latest}`, nicht `ARCTOS_IMAGE_TAG`.
   > Das Kommando lief **ohne Fehlermeldung durch und startete erneut
   > `:latest`** — exakt das defekte Image (S13-05a). Ausserdem existierte
   > auf dem Host gar kein Vorgänger-Image: `update-all.sh` baut lokal und
   > überschreibt dabei das Tag (S13-05b). `update-all.sh` taggt den
   > laufenden Stand jetzt VOR dem Build; `rollback.sh --list` zeigt ihn.
5. Post-Mortem: Log-Bundle an Maintainer, Issue-Label `postmortem-required`

## Szenario 2 — DB-Korruption / Failed Migration

**Symptom**: `/api/v1/health` returns 503 mit `db: unhealthy`, oder
`schema-drift` meldet `mismatch`, oder psql-Errors in Web-Log.

**Vorgehen**:

**Zuerst die Frage beantworten: Migration oder Datenverlust?**
Wenn nur der ANWENDUNGSCODE nicht mit dem Schema zurechtkommt, ist der
Image-Rollback der richtige und ungefährliche Weg — die Datenbank bleibt
vorwärts migriert (ADR-023 §Expand/Contract):

```bash
sudo bash /opt/arctos/deploy/rollback.sh --image <vorheriger-sha>
```

Nur wenn die Migration selbst Daten beschädigt hat, folgt der DB-Rollback.

1. Bestandsaufnahme:
   ```bash
   sudo bash /opt/arctos/deploy/rollback.sh --list
   cat /opt/arctos/backups/.last-run.json
   tail -5 /opt/arctos/deploy-history.jsonl
   ```
2. **Vorher prüfen, ob das Backup überhaupt wiederherstellbar ist** — der
   Drill macht genau das, gegen eine Wegwerf-Datenbank, ohne die
   Produktion anzufassen:
   ```bash
   sudo /opt/arctos/scripts/dr-restore-drill.sh grc_platform
   ```
   Er entschlüsselt, restauriert, vergleicht die Tabellenzahl gegen die
   Quelle, prüft die Audit-Kette kryptografisch (`audit_chain_verify`,
   Toleranz 0) und startet die Anwendung gegen die wiederhergestellte
   Datenbank. Erst wenn er grün ist, ist Schritt 3 vertretbar.
3. DB-Rollback (DATENVERLUST ab dem Backup-Zeitpunkt, verlangt eine
   getippte Bestätigung):
   ```bash
   sudo bash /opt/arctos/deploy/rollback.sh --db grc_platform-20260901-030000-pre-migration.dump.gpg
   ```
   Das Skript stoppt die Anwendung, legt zuerst eine Sicherheitskopie des
   AKTUELLEN Standes an, macht DROP + CREATE + `pg_restore`, provisioniert
   `grc_app`/`grc_worker` neu (eine neue Datenbank hat keine Grants) und
   wartet auf „healthy".
4. Wenn das Backup nicht taugt: die nächstältere Generation nehmen
   (`rollback.sh --list` zeigt sie nach Alter).

**Kritisch — zwei Punkte, die im alten Text fehlten:**

- Nie `DROP DATABASE` ohne bestätigten Restore-Test. `rollback.sh --db`
  erzwingt die Bestätigung und legt selbst eine Sicherheitskopie an.
- **Der Objektspeicher wird beim DB-Rollback NICHT zurückgerollt.** Ein
  Dokument, das nach dem Backup hochgeladen wurde, bleibt als Datei liegen,
  ohne dass eine Datenbankzeile darauf zeigt — und ein Dokument, das vor dem
  Backup existierte und danach gelöscht wurde, hat wieder eine Zeile, aber
  keine Datei. Nach jedem DB-Rollback gehört ein Abgleich in den
  Post-Mortem-Ablauf.

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
6. Backups aus B2 holen und wiederherstellen:
   ```bash
   # Bestand ansehen
   bash /opt/arctos/deploy/offsite-sync.sh --list
   # Neuesten Dump herunterladen (prueft die Checksumme nach dem Download)
   bash /opt/arctos/deploy/offsite-sync.sh --download latest --dest /opt/arctos/backups
   # Objektspeicher NICHT vergessen (#S13-06)
   bash /opt/arctos/deploy/offsite-sync.sh --download objects-<zeitstempel>.tar.gz.gpg \
        --dest /opt/arctos/backups
   # Entschluesseln und einspielen
   sudo bash /opt/arctos/deploy/rollback.sh --db <heruntergeladene-datei>
   ```
   > **Hier stand bis 2026-08-31:** `deploy/offsite-sync.sh --download latest`.
   > Das Skript wertete **kein einziges Argument** aus — der Download-Pfad
   > aus B2 im Host-Ausfall-Szenario war nicht implementiert, also genau die
   > Prozedur, auf die es im Katastrophenfall ankommt (S13-05e). `--list`,
   > `--download` und `--dest` gibt es jetzt.
   >
   > **Voraussetzung:** `/opt/arctos/.backup.key` aus der Off-Host-Ablage
   > (Szenario 0). Ohne ihn sind die heruntergeladenen Dateien wertlos.
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

| Test | Frequenz | Owner | Ausloeser | Nachweis |
| --- | --- | --- | --- | --- |
| Backup-Restore aller DBs + Objektspeicher + Application-Restore | monatlich | Ops | **automatisch**: `/etc/cron.d/arctos-backup`, 1. des Monats 05:00 UTC | `bc_exercise`-Zeile + `/opt/arctos/backups/.dr-drill-last-run.json` |
| B2-Download + Restore-Dry-Run | quartalsweise | Ops | manuell: `offsite-sync.sh --download latest` + `dr-restore-drill.sh` | `bc_exercise` |
| Runbook-Durchspiel Szenario 2 | halbjaehrlich | Maintainer + Ops | manuell | `bc_exercise` |
| Region-Ausfall Tabletop | jaehrlich | Maintainer | manuell | `bc_exercise` |
| **Schluesselwiederherstellung aus der Off-Host-Ablage** (Szenario 0) | halbjaehrlich | Maintainer | manuell | `bc_exercise` |

> **Was hier nicht stimmte (S13-08).** Der monatliche Drill war auf den
> 2026-05-01 terminiert und am Prüftag **vier Monate überfällig**; kein Cron
> löste ihn aus, und es gab keinen einzigen Ausführungsnachweis. Das Skript
> bestätigte den Verzug im eigenen Kopfkommentar („currently overdue").
> Ausserdem prüfte es genau EINE, nicht deterministisch gewählte Datenbank
> (`ls -1t | head -1` liefert die alphabetisch letzte Tenant-DB, verglichen
> wurde aber gegen `grc_platform`), tolerierte bis zu 10 Brüche der
> Audit-Hash-Kette, startete keine Anwendung gegen die wiederhergestellte
> Datenbank — und **schrieb sein Ergebnis nicht ins BCMS**, obwohl der
> Kopfkommentar genau das versprach. Es wurde nur daran ERINNERT. Damit
> fehlte der Nachweis, den ISO 22301 Kap. 8.6 verlangt und den dieses
> Produkt seinen Kunden als Funktion verkauft.

Übungsergebnisse werden in der `bc_exercise`-Tabelle (BCMS-Modul) erfasst —
seit 2026-09-01 **schreibt der Drill sie selbst**, je Organisation, mit
Backup-Datei, Tabellenzahl, Kettenfehlern und Ergebnis des
Application-Restores.

## Kontakte

| Rolle                      | Name          | Kanal                                              |
| -------------------------- | ------------- | -------------------------------------------------- |
| Maintainer / Code-Owner    | @agatho       | GitHub, agatho@charliehund.de                      |
| Hetzner-Support            | Ticket-System | <https://console.hetzner.cloud>                    |
| Backblaze-Support          | Ticket-System | <https://secure.backblaze.com/contact_support.htm> |
| Registrar (Charliehund.de) | tbd           | tbd                                                |

## Verwandte Dokumente

- [runbook.md](./runbook.md) -- normal-operations
- [ADR-011-audit-trail.md](./ADR-011-audit-trail.md) -- Hash-Chain-Spec (TBD)
- [ADR-015-offsite-backup.md](./ADR-015-offsite-backup.md) -- B2-Architektur
- [ADR-017-monitoring.md](./ADR-017-monitoring.md) -- Alerting-Pipeline
- [SECURITY.md](../SECURITY.md) -- Security-Disclosure-Policy
