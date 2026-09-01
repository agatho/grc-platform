# ARCTOS — Deploy Guide

> **[ARCTOS-FULL-2026-08-31 / WP10 · S13-09]**
> Dieser Leitfaden hiess bis zum Audit „Quick Deploy (5 minutes)" und
> beschrieb einen Weg, der eine Installation **ohne RLS, ohne Worker, ohne
> persistente DMS-Ablage und ohne TLS** erzeugte — inklusive eines
> Login-Hinweises auf ein Konto mit öffentlich bekanntem Passwort, das in
> Produktion gar nicht entsteht. Compose-Datei und dieser Text sind
> repariert; was sich im Einzelnen geändert hat, steht im Kopfkommentar von
> `deploy/docker-compose.yml`.
>
> Es sind jetzt eher 15 Minuten als 5. Der Unterschied ist eine Domain, ein
> TLS-Zertifikat und ausgefüllte Pflichtvariablen.

## Einrichtung

### Voraussetzungen

- Docker Engine 24+ mit Compose V2
- 4 GB RAM (2 GB Minimum), 20 GB Plattenplatz — **zum Betrieb eines fertigen
  Images.** Diese Angabe gilt der Laufzeit, nicht dem Bauen.
- **Zum Bauen des Images auf demselben Rechner: Anforderungen derzeit
  unbekannt.** Auf 2 vCPU / 7 GB läuft `next build` (Next 16.2.11,
  Turbopack) **nicht durch** — gemessen am 2026-09-01 in fünf Läufen, siehe
  `/work/audit/remediation/WP12.md` §4.3 und `docs/RELEASE_RUNBOOK.md` §1.4.
  Es steht bewusst keine Ersatzzahl hier: ein Build, der nie fertig wird,
  hat keinen Spitzenbedarf, den man als Anforderung angeben könnte. Bis das
  geklärt ist, bezieht das Deployment fertige Images aus der Registry,
  statt auf dem Zielserver zu bauen.
- **Eine Domain, deren A-Record auf diesen Server zeigt** — Caddy holt das
  Let's-Encrypt-Zertifikat beim ersten Start selbst.

### 1. Dateien auf den Server bringen

```bash
scp -r deploy/ user@your-server:~/arctos/
ssh user@your-server
cd ~/arctos
```

### 2. Umgebung konfigurieren

```bash
cp .env.sample .env
```

Alle Pflichtwerte in `.env` ausfüllen. Sie sind in der Compose-Datei mit
`${VAR:?…}` erzwungen: fehlt einer, bricht `docker compose up` mit einer
lesbaren Meldung ab, statt still unsicher zu starten.

Secrets erzeugen:

```bash
openssl rand -hex 24    # DB_PASSWORD, GRC_APP_PASSWORD, GRC_WORKER_PASSWORD, REDIS_PASSWORD
openssl rand -hex 32    # AUTH_SECRET, WB_ENCRYPTION_KEY, CONNECTOR_ENCRYPTION_KEY,
                        # AUDIT_SEAL_KEY, PII_PSEUDONYM_KEY
openssl rand -base64 32 # SECRET_ENCRYPTION_KEY
openssl rand -hex 16    # CRON_SECRET
```

**`AUDIT_SEAL_KEY` und `PII_PSEUDONYM_KEY` sind nicht beliebig rotierbar**
und gehören in eine Schlüsselablage ausserhalb dieses Hosts — Einzelheiten
in `docs/runbook.md` §7.

### 3. Stack starten

```bash
docker compose up -d
docker compose ps        # abwarten, bis alle Dienste "healthy" sind
```

Beim ersten Start passiert der Reihe nach:

1. PostgreSQL mit TimescaleDB und den nötigen Extensions
2. Redis (Cache **und** gemeinsames Rate-Limit-Backend)
3. `provision-roles` legt `grc_app` und `grc_worker` an — **ohne diesen
   Schritt liefe die Anwendung als Superuser und RLS wäre wirkungslos**
4. `web` wendet die Migrationen an (**402 Dateien**, nicht die früher hier
   genannten 70) und startet
5. `worker` startet den Scheduler — er treibt Löschfristen (Art. 17 DSGVO),
   die 72-h-Meldefrist (Art. 33 DSGVO), die HinSchG-Rückmeldefristen und die
   tägliche Verankerung der Audit-Hash-Kette
6. `caddy` holt das TLS-Zertifikat und veröffentlicht die Anwendung

### 4. Erstadministrator anlegen

```bash
ADMIN_EMAIL=chef@ihre-firma.de docker compose run --rm create-admin
```

Das Kommando gibt ein zufälliges Erstpasswort aus und erzwingt die Änderung
bei der ersten Anmeldung.

> Früher stand hier `Login: admin@arctos.dev / admin123`. Dieses Konto
> entsteht ausschliesslich aus `seed_demo_00_platform.sql`, das der
> Entrypoint bei `NODE_ENV=production` verweigert (#SEC-F04). Wer dem alten
> README folgte, konnte sich **nicht** anmelden — und setzte plausibel
> `ALLOW_DEMO_SEED_IN_PROD=true`, womit ein Admin-Konto mit öffentlich
> bekanntem Passwort in der Produktion landete. Genau das ist behoben.

### 5. Anmelden

```
https://<ARCTOS_DOMAIN>
```

## Betrieb

### Update

```bash
docker compose pull web worker
docker compose up -d web worker
docker compose ps            # "healthy" abwarten
```

Die Volumes `uploads` und `branding` überleben das. Vor ihrer Einführung
verwarf `up -d` nach einem `pull` die Containerschicht — und mit ihr
**sämtliche hochgeladenen DMS-Dokumente**, während ihre Datenbankzeilen und
Hash-Ketten bestehen blieben (#S13-09b).

Für die Mehr-Mandanten-Installation auf einem Hetzner-Host gilt stattdessen
`deploy/update-all.sh`: Pre-Deploy-Backup, CI-Status-Prüfung des
Ziel-Commits, Migration über den Ledger-Runner und automatischer Rollback
bei einem gescheiterten Health-Gate.

### Backup — vor dem ersten Produktivbetrieb einrichten

```bash
sudo bash deploy/backup-cron-install.sh
```

Installiert in einer verketteten Cron-Zeile: nächtliches Backup
(Datenbanken **und** DMS-Objektspeicher, GPG-verschlüsselt), Rotation und
Off-Site-Sync — dazu den monatlichen Restore-Drill.

**Der beim ersten Lauf erzeugte Schlüssel `/opt/arctos/.backup.key` muss
sofort ausserhalb dieses Hosts abgelegt werden.** Ohne ihn ist kein Backup
wiederherstellbar.

### Monitoring

Die Produktions-Compose enthält den Dienst `ops-metrics`
(Prometheus-Format unter `:9105/metrics`; Alarme auf fehlgeschlagene
Logins, Massenexporte, Kettenbrüche, Job-Fehler und veraltete Backups).
Für diesen Single-Host-Stack:

```bash
# Metriken einmalig ausgeben
docker compose exec worker node /app/scripts/ops-metrics.mjs --once
# Als Prüfung: Exit 1, wenn ein Alarm offen ist
docker compose exec worker node /app/scripts/ops-metrics.mjs --check
```

`ALERT_WEBHOOK_URL` (Slack/Teams/Mattermost) und `HEALTHCHECKS_URL`
(Dead-Man's-Switch) in `.env` setzen — sonst landen die Alarme nur im Log.

### Übliche Kommandos

```bash
docker compose logs -f web          # Logs
docker compose down                 # stoppen
docker compose down -v              # ACHTUNG: löscht ALLE Daten inkl. Uploads
```

## Dateien

| Datei                    | Zweck                                                     |
| ------------------------ | --------------------------------------------------------- |
| `docker-compose.yml`     | Single-Host-Stack: postgres, redis, web, worker, caddy     |
| `.env.sample`            | Vorlage — nach `.env` kopieren und ausfüllen               |
| `init-extensions.sql`    | PostgreSQL-Extensions (läuft beim ersten DB-Init)          |
| `Caddyfile.compose`      | Reverse-Proxy, TLS, Security-Header (Container-Variante)   |
| `Caddyfile`              | dieselbe Rolle für den Hetzner-Host-Pfad (setup-hetzner.sh)|
| `provision-grc-app.sh`   | Legt `grc_app` und `grc_worker` an (Least Privilege)       |
| `db-backup.sh`           | Backup: alle DBs + DMS-Objektspeicher, verschlüsselt       |
| `offsite-sync.sh`        | Off-Site-Kopie nach B2 (nur verschlüsselte Artefakte)      |
| `backup-cron-install.sh` | Installiert Backup-, Off-Site- und DR-Drill-Cron           |
| `rollback.sh`            | Image- und/oder Datenbank-Rollback                          |
| `update-all.sh`          | Mehr-Mandanten-Update mit Backup, CI-Gate und Health-Gate  |

## Architektur

```
                    ┌──────────────────────────────┐
                    │  Browser → https://<domain>  │
                    └───────────────┬──────────────┘
                                    │  TLS (Let's Encrypt)
                    ┌───────────────▼──────────────┐
                    │  caddy  (80/443, Auto-HTTPS) │
                    └───────────────┬──────────────┘
                                    │  127.0.0.1:3000
   ┌────────────────────────────────▼───────────────────────────────┐
   │  web  (Next.js standalone)                                     │
   │   · Migrationen beim Start (Ledger; Fehler = kein Start)       │
   │   · Laufzeit als grc_app  → RLS wirkt                          │
   │   · Volumes: uploads, branding  → Dokumente überleben Updates  │
   └───────┬───────────────────────────────────────────┬────────────┘
           │                                           │
   ┌───────▼────────┐   ┌──────────────┐      ┌────────▼────────┐
   │  PostgreSQL    │   │    Redis     │      │  worker         │
   │  TimescaleDB   │   │  Cache +     │      │  Scheduler:     │
   │  grc / grc_app │   │  Rate-Limit  │      │  Retention,     │
   │  / grc_worker  │   │              │      │  Fristen,       │
   └────────────────┘   └──────────────┘      │  Audit-Anker    │
                                              └─────────────────┘
```
