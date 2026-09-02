# Environment Variables — Reference

_Stand: **2026-09-01** (ARCTOS-FULL-2026-08-31 / WP10) · automatisch
generiert + manuell dokumentiert_

> **Verbindlichkeit.** Diese Datei ist die erklärende Referenz;
> **maßgeblich ist `.env.example`**. `node scripts/check-env-example.mjs`
> läuft blockierend in CI und stellt sicher, dass jede im Code gelesene
> `process.env.*` dort vorkommt, dass die Pflichtvariablen
> unauskommentiert sind und dass kein Platzhalter wie ein benutzbarer Wert
> aussieht. Bis zum Audit fehlten dort **49** tatsächlich gelesene
> Variablen, und ausgerechnet `APP_DATABASE_URL` — die einzige, die RLS
> aktiviert — war auskommentiert ausgeliefert (S13-28).

Vollstaendige Liste aller `process.env.*`-Referenzen aus `apps/**/src`
und `packages/**/src`. Sortiert nach Scope.

**Legende**: req = erforderlich · opt = optional · sec = secret (nie in Logs / Screenshots)

## Pflicht-Betriebsvariablen (Startup-Validierung, #S13-10)

`scripts/prestart.sh` prüft diese Liste VOR dem Anwendungsstart und beendet
den Container in `NODE_ENV=production` mit Exit 78 (EX_CONFIG), wenn ein
Wert fehlt, ungültig ist oder noch den Platzhalter aus `.env.example`
trägt. Vorher gab es keine Prüfung: eine Installation mit nur
`DATABASE_URL` startete normal, meldete `/api/v1/health` mit 200 und führte
jede Anfrage als Superuser mit BYPASSRLS aus — jeder Mandant sah die Daten
jedes anderen, ohne irgendein Signal.

| Variable                     |    web     |  worker   | Ohne sie                                                                                    |
| ---------------------------- | :--------: | :-------: | ------------------------------------------------------------------------------------------- |
| `DATABASE_URL`               |     ✅     |    ✅     | keine Migrationen, keine Provisionierung                                                    |
| `APP_DATABASE_URL`           |     ✅     |     —     | **RLS wirkungslos** (S13-09/S13-10)                                                         |
| `GRC_APP_PASSWORD`           |     ✅     |     —     | `APP_DATABASE_URL` unbrauchbar (leeres Passwort)                                            |
| `GRC_WORKER_PASSWORD`        |     —      |    ✅     | Worker startet nicht (WP2/S01-09)                                                           |
| `AUTH_SECRET`                |     ✅     |     —     | Sitzungen nicht signierbar                                                                  |
| `AUTH_URL` / `NEXTAUTH_URL`  |     ✅     |     —     | SSO-/SCIM-/SAML-Callbacks zeigen ins Leere                                                  |
| `CRON_SECRET`                |     ✅     |    ✅     | Worker antwortet auf `/crons/*` mit 500                                                     |
| `AUDIT_SEAL_KEY`             |     ✅     |    ✅     | Anker unsigniert — Integritätsprüfung statt Tamper-Evidence (WP4/S03-01)                    |
| `PII_PSEUDONYM_KEY`          |     ✅     |    ✅     | Installationsschlüssel **in der Datenbank**, also im selben Dump wie die Daten (WP8/S07-03) |
| `WB_ENCRYPTION_KEY`          |     ✅     |    ✅     | Meldeportal weist mit 503 ab                                                                |
| `CONNECTOR_ENCRYPTION_KEY`   |     ✅     |    ✅     | Connector-Zugangsdaten nicht speicherbar                                                    |
| `SECRET_ENCRYPTION_KEY`      |     ✅     |    ✅     | SSO-/OAuth-Secrets nicht speicherbar                                                        |
| `REDIS_URL`                  |     ✅     |     —     | Rate-Limit prozesslokal (WP9/S10-05)                                                        |
| `TRUSTED_PROXY_HOPS`         |     ✅     |     —     | Login-Limit per `X-Forwarded-For` umgehbar                                                  |
| `STORAGE_BACKEND`            |     ✅     |    ✅     | bei `local` ohne `UPLOAD_DIR`: Dokumente weg beim nächsten Update                           |
| `ARCTOS_ALLOW_PRIVILEGED_DB` | ❌ **nie** | ✅ `true` | Worker beendet sich (S01-10). Für `web` gesetzt = Mandantentrennung aufgehoben              |

**Schlüssel, die NICHT beliebig rotierbar sind:**

| Variable                                     | Was ein Wechsel bedeutet                                                                                                                                                                                                    |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUDIT_SEAL_KEY`                             | Bestehende Ankersiegel werden unverifizierbar. Rotation nur mit neuer `AUDIT_SEAL_KEY_ID` und Aufbewahrung der alten Schlüssel. **Niemals vernichten.**                                                                     |
| `PII_PSEUDONYM_KEY`                          | Alte und neue Pseudonyme derselben Person sind nicht mehr verknüpfbar. Die **Vernichtung** ist der DSGVO-Löschpfad und hat ein eigenes Verfahren: `docs/runbook.md` §7 (Vier-Augen-Prinzip, Off-Host-Kopie, Backup-Ablauf). |
| `WB_ENCRYPTION_KEY`                          | Bestandschiffrate nur über `WB_ENCRYPTION_KEY_PREVIOUS` lesbar; Re-Seal nötig.                                                                                                                                              |
| `CONNECTOR_ENCRYPTION_KEY`                   | Macht **jede** gespeicherte Connector-Zugangsdatenzeile unbrauchbar.                                                                                                                                                        |
| `SECRET_ENCRYPTION_KEY`                      | Über `SECRET_ENCRYPTION_KEY_PREVIOUS` + `scripts/encrypt-connector-secrets.mjs` re-sealbar.                                                                                                                                 |
| `/opt/arctos/.backup.key` (Datei, keine Env) | Ohne ihn ist **kein Backup** wiederherstellbar. Off-Host-Kopie ist Pflicht — `docs/dr-playbook.md` Szenario 0.                                                                                                              |

## Monitoring und Alarme (#S13-11 / #S13-12)

| Variable                                                 | req/opt   | Beschreibung                                                                                                                                        |
| -------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ALERT_WEBHOOK_URL`                                      | opt · sec | JSON-POST-Ziel für Betriebsalarme (Slack, Teams, Mattermost, Alertmanager). **Ohne ihn landen Alarme nur im Container-Log** — niemand wird geweckt. |
| `HEALTHCHECKS_URL`                                       | opt · sec | Dead-Man's-Switch (healthchecks.io o. ä.). Der einzige Mechanismus, der auch „Host komplett tot" meldet.                                            |
| `OPS_METRICS_PORT`                                       | opt       | Standard `9105`                                                                                                                                     |
| `OPS_INTERVAL_SECONDS`                                   | opt       | Auswertungsintervall, Standard `60`                                                                                                                 |
| `ALERT_FAILED_LOGINS_5M`                                 | opt       | Standard `20`                                                                                                                                       |
| `ALERT_FAILED_LOGINS_ACCOUNT_5M`                         | opt       | Standard `10`                                                                                                                                       |
| `ALERT_EXPORT_ROWS_1H` / `_24H`                          | opt       | Standard `50000` / `200000`                                                                                                                         |
| `ALERT_JOB_FAILURES_1H`                                  | opt       | Standard `3`                                                                                                                                        |
| `ALERT_BACKUP_AGE_SECONDS` / `ALERT_OFFSITE_AGE_SECONDS` | opt       | Standard `93600` (26 h, ADR-015 §92)                                                                                                                |
| `ALERT_DRILL_AGE_SECONDS`                                | opt       | Standard `3456000` (40 Tage)                                                                                                                        |
| `ALERT_RESEND_AFTER_SECONDS`                             | opt       | Anti-Flapping, Standard `3600`                                                                                                                      |
| `ARCTOS_SKIP_CONFIG_ASSERT`                              | opt       | Not-Aus für die Startup-Validierung. Bewusst lang und greppbar; erscheint im Log.                                                                   |

## Backup (Dateien und `/etc/default/arctos-backup`)

| Variable                  | Beschreibung                                                                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BACKUP_RETENTION_DAYS`   | **Die eine** Quelle der lokalen Aufbewahrungsfrist (Standard 30). `db-backup.sh` und `backup-rotate.sh` lesen sie beide — bis 2026-08-31 löschte das eine nach 30, das andere nach 14 Tagen (S13-24). |
| `BACKUP_SIZE_CAP_GB`      | Harte Kappung, Standard 20. Greift sie, MELDET die Rotation das jetzt; vorher verkürzte sie die Aufbewahrung stillschweigend.                                                                         |
| `BACKUP_KEY_FILE`         | Standard `/opt/arctos/.backup.key`                                                                                                                                                                    |
| `BACKUP_ALLOW_PLAINTEXT`  | Ausdrückliche Ausnahme: unverschlüsselt sichern (nicht empfohlen)                                                                                                                                     |
| `OFFSITE_ALLOW_PLAINTEXT` | Ausdrückliche Ausnahme: Klartext nach B2 übertragen (nicht empfohlen)                                                                                                                                 |
| `B2_REMOTE`               | Standard `b2-arctos:arctos-backups`                                                                                                                                                                   |

## Deploy

| Variable                         | Beschreibung                                                                                                                                                                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ARCTOS_ALLOW_UNVERIFIED_DEPLOY` | Überspringt die CI-Status-Prüfung des Ziel-Commits (S13-19). Wird im Deploy-Protokoll vermerkt.                                                                                                                               |
| `ARCTOS_SKIP_PREDEPLOY_BACKUP`   | Überspringt das Pre-Deploy-Backup (S13-04a). Nicht empfohlen.                                                                                                                                                                 |
| `ALLOW_DEMO_SEED_IN_PROD`        | Spielt die Demo-Seeds ein. **Nur auf Wegwerf-Instanzen** — sie schreiben Demo-Fachdaten in die produktive Haupt-DB und in die Hash-Kette (S13-20).                                                                            |
| `IMAGE_TAG`                      | Der von `docker-compose.production.yml` gelesene Tag. **Nicht** `ARCTOS_IMAGE_TAG` — diese Variable liest nichts und war die Ursache eines still wirkungslosen Rollbacks (S13-05a). Rollback bitte über `deploy/rollback.sh`. |

## Core — ohne laeuft nichts

| Variable                          | req/opt       | Beispiel                                              | Beschreibung                                                                                                                                                                                      |
| --------------------------------- | ------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                    | req · sec     | `postgresql://grc:***@localhost:5432/grc_platform`    | PostgreSQL-Connection-String (Superuser `grc`; nur Migrationen/Provisionierung)                                                                                                                   |
| `APP_DATABASE_URL`                | **req** · sec | `postgresql://grc_app:***@postgres:5432/grc_platform` | **Laufzeit-Pool der Web-App** als Nicht-Superuser. Nur damit wirkt RLS. Fehlt sie, fällt der Code auf `DATABASE_URL` zurück — Superuser, BYPASSRLS, Mandantentrennung aufgehoben (S13-09/S13-10). |
| `NODE_ENV`                        | req           | `production` / `development` / `test`                 | Runtime-Mode                                                                                                                                                                                      |
| `NEXTAUTH_URL`                    | req           | `https://arctos.charliehund.de`                       | Base-URL fuer Auth.js (muss mit Caddy-Hostname matchen)                                                                                                                                           |
| `NEXT_PUBLIC_APP_URL`             | req           | `https://arctos.charliehund.de`                       | Base-URL fuer Frontend (in Browser sichtbar)                                                                                                                                                      |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | req · sec     | 64-char hex                                           | Auth.js JWT-Signing-Key. **Rotieren** = alle Sessions invalidieren                                                                                                                                |

## Auth — optional je nach SSO-Setup

| Variable                         | req/opt   | Beschreibung                        |
| -------------------------------- | --------- | ----------------------------------- |
| `AZURE_AD_CLIENT_ID`             | opt · sec | MS Entra ID OAuth Client-ID         |
| `AZURE_AD_CLIENT_SECRET`         | opt · sec | MS Entra ID OAuth Client-Secret     |
| `AZURE_AD_TENANT_ID`             | opt       | MS Entra Tenant-GUID                |
| `AUTH_MICROSOFT_ENTRA_ID_ID`     | opt · sec | Alias (Auth.js v5 Namenskonvention) |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | opt · sec | Alias                               |
| `AUTH_MICROSOFT_ENTRA_ID_ISSUER` | opt       | Override fuer Custom-Issuer-URL     |

## AI / LLM

| Variable              | req/opt   | Beschreibung                                                |
| --------------------- | --------- | ----------------------------------------------------------- |
| `AI_DEFAULT_PROVIDER` | opt       | `claude` / `openai` / `ollama` — Default wenn kein Override |
| `ANTHROPIC_API_KEY`   | opt · sec | Claude API-Key (starts `sk-ant-`)                           |
| `OPENAI_API_KEY`      | opt · sec | OpenAI API-Key (starts `sk-`)                               |
| `GOOGLE_AI_API_KEY`   | opt · sec | Google Gemini API-Key                                       |
| `OLLAMA_ENABLED`      | opt       | `true` / `false` — aktiviert lokale Ollama-Modelle          |
| `OLLAMA_BASE_URL`     | opt       | `http://localhost:11434` — Ollama-HTTP-Endpoint             |
| `CLAUDE_CLI_ENABLED`  | opt       | `true` / `false` — Claude-CLI statt API-Call                |
| `CLAUDE_CLI_PATH`     | opt       | Pfad zur `claude`-Binary (wenn nicht in PATH)               |

## Email

| Variable            | req/opt                            | Beschreibung                                           |
| ------------------- | ---------------------------------- | ------------------------------------------------------ |
| `EMAIL_ENABLED`     | opt                                | `true` / `false` — wenn false, Mails gehen nur ins Log |
| `RESEND_API_KEY`    | req bei `EMAIL_ENABLED=true` · sec | Resend SDK Key (starts `re_`)                          |
| `RESEND_FROM_EMAIL` | req bei Email                      | `noreply@arctos.charliehund.de`                        |
| `RESEND_FROM_NAME`  | opt                                | Anzeige-Name (`ARCTOS`)                                |

## Background / Worker

| Variable                 | req/opt               | Beschreibung                                                                                                                                                                                                                                                 |
| ------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `REDIS_URL`              | **req** in Produktion | `redis://redis:6379` — Queue, Cache und **gemeinsames Rate-Limit-Backend**. Ohne ihn ist der Limiter prozesslokal: bei N Web-Containern ist das effektive Limit `N × capacity`, und ein Neustart hebt jeden Login-Lockout auf (WP9/S10-05).                  |
| `CRON_SECRET`            | **req** · sec         | Shared-Secret fuer Worker-Cron-Auth (verhindert drive-by-Trigger)                                                                                                                                                                                            |
| `CRON_SCHEDULER_ENABLED` | opt                   | Standard `true`. Der In-Process-Scheduler des Workers. Vor der Remediation gab es KEINEN Scheduler — die 128 Cron-Endpunkte rief niemand auf, es lief also keine Löschfrist, keine Fristenüberwachung und keine Verankerung der Audit-Kette (S10-02/S13-14). |
| `JOB_RUN_RETENTION_DAYS` | opt                   | Aufbewahrung des Laufprotokolls `job_run` (Standard 90; Fehlläufe doppelt)                                                                                                                                                                                   |

## Logging

| Variable           | req/opt | Default      | Beschreibung                                            |
| ------------------ | ------- | ------------ | ------------------------------------------------------- |
| `ARCTOS_LOG_LEVEL` | opt     | `info`       | `trace` / `debug` / `info` / `warn` / `error` / `fatal` |
| `ARCTOS_SERVICE`   | opt     | `arctos-web` | Service-Name im Log-Entry                               |

**Log-Retention und Scrubbing (#S13-15, #S13-16).** Beide Compose-Dateien
begrenzen den json-file-Treiber auf `max-size: 50m` × `max-file: 5`, also
höchstens 250 MB je Container (≈ 3–7 Tage). Vorher gab es keinen
`logging:`-Block: die Logdateien wuchsen unbegrenzt bis die Partition voll
war — auf derselben Partition wie die Backups.

Der strukturierte Logger scrubbt seit 2026-09-01 tatsächlich: Schlüssel wie
`password`, `token`, `secret`, `body`, `payload` werden durch `[redacted]`
ersetzt, E-Mail-Adressen auf `e***@domain.tld` gekürzt, tokenartige Werte
unabhängig vom Schlüsselnamen erkannt (JWT, `sk-…`, lange Hex-Ketten,
Connection-Strings mit Passwort), und Tiefe, Array-Länge, String-Länge und
Zeilengrösse sind begrenzt. ADR-017 hatte das als Voraussetzung für
externes Log-Shipping zugesagt; der Logger hatte davon nichts.

**Weiterhin nicht abgedeckt:** 58 `console.*`-Aufrufe in `apps/web/src` und
164 in `apps/worker/src` gehen am Logger und damit am Scrubbing vorbei. Vor
dem Anschluss an einen externen Log-Empfänger sind sie umzustellen.

## Uploads / Reporting

| Variable            | req/opt | Default               | Beschreibung                                      |
| ------------------- | ------- | --------------------- | ------------------------------------------------- |
| `UPLOAD_DIR`        | opt     | `/data/uploads`       | Pfad fuer hochgeladene Dokumente (Docker-Volume!) |
| `REPORT_OUTPUT_DIR` | opt     | `/data/reports`       | Generated PDF/Excel-Reports                       |
| `PORTAL_BASE_URL`   | opt     | `NEXT_PUBLIC_APP_URL` | Portal-URL fuer externe Stakeholder-Links         |

## Whistleblowing (isolated module)

<!-- #WP8-S07-19.4 — Doku-Drift korrigiert (Audit ARCTOS-FULL-2026-08-31).
     Die frühere Zeile sagte "32-byte hex fuer Ende-zu-Ende-Verschluesselung
     der Case-Attachments". Beides traf nicht zu: der Server hält den
     Schlüssel und entschlüsselt selbst (Verschlüsselung at rest, nicht
     Ende-zu-Ende), und Anhänge wurden überhaupt nicht verschlüsselt — bis
     zur Remediation wurden sie nicht einmal gespeichert (S07-20). -->

| Variable                     | req/opt                             | Beschreibung                                                                                                                                                                   |
| ---------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `WB_ENCRYPTION_KEY`          | req wenn whistleblowing aktiv · sec | 32-byte hex. Verschluesselung **at rest** (AES-256-GCM) der Meldungsfreitexte, Kontaktadressen und Fallnachrichten. Der Server haelt den Schluessel und entschluesselt selbst. |
| `WB_ENCRYPTION_KEY_PREVIOUS` | opt · sec                           | Vorheriger Schluessel waehrend einer Rotation. Chiffrate, die unter dem aktuellen Schluessel nicht aufgehen, werden damit gelesen. Nach dem Re-Seal entfernen.                 |
| `WB_ENCRYPTION_KEY_ID`       | opt                                 | Kennung, die in neue Chiffrate geschrieben wird (`v2:<keyId>:…`). Vorgabe `default`.                                                                                           |
| `WB_PSEUDONYM_KEY`           | empfohlen · sec                     | 32-byte hex. HMAC-Schluessel fuer `wb_report.ip_hash` (S07-02). Fehlt er, wird er aus `WB_ENCRYPTION_KEY` abgeleitet — ein ungesalzener Hash entsteht in keinem Fall.          |
| `PII_PSEUDONYM_KEY`          | empfohlen · sec                     | 32-byte hex. HMAC-Schluessel fuer die Pseudonymisierung im Audit-Trail und im Hinweisgeber-Fachlog (S07-03/-08). Ohne ihn greift ein Installationsschluessel in der Datenbank. |
| `PII_PSEUDONYM_KEY_ID`       | opt                                 | Kennung des Pseudonymisierungsschluessels; erscheint als `env:<id>` an jedem Pseudonym.                                                                                        |

**Betriebshinweis (S07-19.5):** Ohne `WB_ENCRYPTION_KEY` startet die
Anwendung, das Meldeportal nimmt aber keine Meldungen mehr an — es
antwortet mit `503` und protokolliert den Grund. Vorher lief es klaglos
weiter und quittierte jede eingehende Meldung mit einem `500`; der nach
§ 12 HinSchG vorgeschriebene Meldekanal war unbemerkt tot.

**Zum Ablegen der beiden Pseudonymisierungsschluessel:** sie gehoeren
NICHT in dieselbe Datenbank, deren Inhalt sie pseudonymisieren. Liegen sie
in der Prozessumgebung, enthaelt ein Datenbank-Dump sie nicht — genau das
ist ihr Zweck (vgl. `AUDIT_SEAL_KEY`).

## Connector Framework (Sprint 62-66)

| Variable                         | req/opt                                             | Beschreibung                                                                                                                                                                                                                               |
| -------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CONNECTOR_ENCRYPTION_KEY`       | req wenn Connectors aktiv · sec                     | Verschluesselt Connector-Credentials in DB (3-Spalten-Layout `encrypted_payload/iv/auth_tag`)                                                                                                                                              |
| `SECRET_ENCRYPTION_KEY`          | req wenn SSO/OIDC oder OAuth-Connectors aktiv · sec | 32 Byte, base64 (`openssl rand -base64 32`) oder 64-char hex. Verschluesselt Ein-Spalten-Secrets (`sso_config.oidc_client_secret`, `connector_credential.refresh_token`) als `v1:`-Envelope — siehe `packages/shared/src/secret-crypto.ts` |
| `SECRET_ENCRYPTION_KEY_PREVIOUS` | opt · sec                                           | Nur waehrend Key-Rotation: alter Key als Decrypt-Fallback. Nach Re-Seal (`scripts/encrypt-connector-secrets.mjs`) wieder entfernen                                                                                                         |

## Regulatory Feeds (Sprint 24, 72)

| Variable          | req/opt   | Beispiel                                   | Beschreibung                          |
| ----------------- | --------- | ------------------------------------------ | ------------------------------------- |
| `EURLEX_FEED_URL` | opt       | `https://eur-lex.europa.eu/...`            | RSS/XML fuer EU-Rechtsakte-Monitoring |
| `BAFIN_FEED_URL`  | opt       | `https://www.bafin.de/...`                 | BaFin-Rundschreiben                   |
| `BSI_FEED_URL`    | opt       | `https://www.bsi.bund.de/.../rss`          | BSI-Warnungen / CVEs                  |
| `NVD_API_KEY`     | opt · sec | NIST-NVD CVE-API-Key (hoeheres Rate-Limit) |

## Build / Next.js

| Variable                  | req/opt | Beschreibung                                             |
| ------------------------- | ------- | -------------------------------------------------------- |
| `NEXT_TELEMETRY_DISABLED` | opt     | `1` — verhindert Next.js-Telemetry (Self-Hosted-Default) |

## E2E-Testumgebung (nie produktiv)

[E2E-TRIAGE-4 · 2026-09-02] Diese Variablen gehoeren an zwei verschiedene
Stellen, und die Verwechslung hat schon zwei Triage-Runden gekostet: die
`RATE_LIMIT_*`- und `CLAMAV_*`-Werte liest der **Server**, die `E2E_*`-Werte
der **Testlaeufer**. Ein `RATE_LIMIT_AUTH` in `playwright.config.ts` ist ein
beruhigendes Nichts.

**Am Server (Produktionsbau der Testinstanz):**

| Variable             | req/opt | Beschreibung                                                                                                                                                                                                            |
| -------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RATE_LIMIT_DEFAULT` | opt     | `3000/60` — die Suite laeuft seriell unter EINEM Prinzipal, gemessen ueber 500 Anfragen/min gegen ein Produktbudget von 300/min. Ohne den Wert scheitern Tests mit 429, die wie Produktdefekte aussehen und keine sind. |
| `RATE_LIMIT_AUTH`    | opt     | `1000/60` — Anmeldebudget, adressgeschluesselt.                                                                                                                                                                         |
| `CLAMAV_OPTIONAL`    | opt     | `1` — `isClamAvRequired()` ist unter `NODE_ENV=production` wahr; ohne konfigurierten clamd weist der Upload mit **503** ab (S04-06, richtig so). Ein clamd auf `CLAMAV_HOST:3310` ist die bessere Alternative.          |

**Am Testlaeufer:**

| Variable            | req/opt | Beschreibung                                                                                                                                                                        |
| ------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `E2E_ROLE_PASSWORD` | **req** | Passwort aller Testkonten, mindestens 12 Zeichen. `npm run db:seed:e2e-users` legt ohne diesen Wert nichts an — ein Vorgabewert waere S02-01.                                       |
| `E2E_EMAIL`         | opt     | Hauptkonto; leer = `e2e-admin@arctos.local`. Zeigt es auf ein vorhandenes Konto, verschiebt der Seed dieses in den Demo-Mandanten (genau eine Mitgliedschaft).                      |
| `E2E_PASSWORD`      | opt     | Passwort des Hauptkontos; leer = `E2E_ROLE_PASSWORD`.                                                                                                                               |
| `E2E_ORG_ID`        | opt     | Mandant, gegen den die Suite behauptet. Vorgabe in beiden `playwright.config.ts`: `ccc4cc1c-4b09-499c-8420-ebd8da655cd7`. Leer gesetzt schaltet die Mandanten-Pruefung im Setup ab. |
| `E2E_BASE_URL`      | opt     | Ziel-URL, Vorgabe `http://localhost:3000`.                                                                                                                                          |

Der vollstaendige Weg von einer leeren Datenbank steht in
`docs/bpmn-engine/E2E-TRIAGE-4.md`, Abschnitt „Wie der Lauf reproduziert wird".

## Inspektion

Einzelne Werte aus laufendem Container:

```bash
docker compose exec web sh -c 'env | grep -E "^(DATABASE_URL|NODE_ENV|AUTH_SECRET|RESEND_API_KEY)=" | sed "s/=.*SECRET.*/=[REDACTED]/"'
```

Alle ARCTOS-Vars (ohne Leak):

```bash
docker compose exec web env | grep -E "^(ARCTOS|AUTH|NEXTAUTH|DATABASE|REDIS|RESEND|WB|NEXT_PUBLIC)" | cut -d= -f1 | sort
```

## Secrets-Management

Siehe [ADR-018-secret-management.md](./ADR-018-secret-management.md):

- Phase 0 (heute): .env-Files auf Host, Zugriff nur `root`
- Phase 1 (geplant): SOPS-encrypted .env-Files im Repo
- Phase 2: HashiCorp Vault oder Bitwarden-CLI

## Konsistenz-Checks

Der secret-scan (`scripts/audit-secrets.mjs`) matched:

- Platzhalter `your_key_here`, `xxx`, `CHANGEME` (WARN)
- Real-looking keys in nicht-.env-Files (ERROR)

Siehe Report: `docs/security/secret-scan-report.md`

## Offene Items

- [ ] `CONNECTOR_ENCRYPTION_KEY`: aktuell optional, sollte bei aktivem
      Connector-Modul zwingend sein -- Validation am Startup
- [ ] Health-Endpoint soll fehlende Required-Vars in `details.env` melden
      (ohne die Werte selbst zu zeigen)
