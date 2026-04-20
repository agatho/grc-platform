# Environment Variables — Reference

_Stand: 2026-04-18 · automatisch generiert + manuell dokumentiert_

Vollstaendige Liste aller `process.env.*`-Referenzen aus `apps/**/src`
und `packages/**/src`. Sortiert nach Scope.

**Legende**: req = erforderlich · opt = optional · sec = secret (nie in Logs / Screenshots)

## Core — ohne laeuft nichts

| Variable                          | req/opt   | Beispiel                                           | Beschreibung                                                       |
| --------------------------------- | --------- | -------------------------------------------------- | ------------------------------------------------------------------ |
| `DATABASE_URL`                    | req · sec | `postgresql://grc:***@localhost:5432/grc_platform` | PostgreSQL-Connection-String (inkl. User/Password)                 |
| `NODE_ENV`                        | req       | `production` / `development` / `test`              | Runtime-Mode                                                       |
| `NEXTAUTH_URL`                    | req       | `https://arctos.charliehund.de`                    | Base-URL fuer Auth.js (muss mit Caddy-Hostname matchen)            |
| `NEXT_PUBLIC_APP_URL`             | req       | `https://arctos.charliehund.de`                    | Base-URL fuer Frontend (in Browser sichtbar)                       |
| `AUTH_SECRET` / `NEXTAUTH_SECRET` | req · sec | 64-char hex                                        | Auth.js JWT-Signing-Key. **Rotieren** = alle Sessions invalidieren |

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

| Variable      | req/opt   | Beschreibung                                                      |
| ------------- | --------- | ----------------------------------------------------------------- |
| `REDIS_URL`   | opt       | `redis://localhost:6379` — fuer Queue, Cache, Rate-Limit          |
| `CRON_SECRET` | opt · sec | Shared-Secret fuer Worker-Cron-Auth (verhindert drive-by-Trigger) |

## Logging

| Variable           | req/opt | Default      | Beschreibung                                            |
| ------------------ | ------- | ------------ | ------------------------------------------------------- |
| `ARCTOS_LOG_LEVEL` | opt     | `info`       | `trace` / `debug` / `info` / `warn` / `error` / `fatal` |
| `ARCTOS_SERVICE`   | opt     | `arctos-web` | Service-Name im Log-Entry                               |

## Uploads / Reporting

| Variable            | req/opt | Default               | Beschreibung                                      |
| ------------------- | ------- | --------------------- | ------------------------------------------------- |
| `UPLOAD_DIR`        | opt     | `/data/uploads`       | Pfad fuer hochgeladene Dokumente (Docker-Volume!) |
| `REPORT_OUTPUT_DIR` | opt     | `/data/reports`       | Generated PDF/Excel-Reports                       |
| `PORTAL_BASE_URL`   | opt     | `NEXT_PUBLIC_APP_URL` | Portal-URL fuer externe Stakeholder-Links         |

## Whistleblowing (isolated module)

| Variable            | req/opt                             | Beschreibung                                                        |
| ------------------- | ----------------------------------- | ------------------------------------------------------------------- |
| `WB_ENCRYPTION_KEY` | req wenn whistleblowing aktiv · sec | 32-byte hex fuer Ende-zu-Ende-Verschluesselung der Case-Attachments |

## Connector Framework (Sprint 62-66)

| Variable                   | req/opt                         | Beschreibung                               |
| -------------------------- | ------------------------------- | ------------------------------------------ |
| `CONNECTOR_ENCRYPTION_KEY` | req wenn Connectors aktiv · sec | Verschluesselt Connector-Credentials in DB |

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
