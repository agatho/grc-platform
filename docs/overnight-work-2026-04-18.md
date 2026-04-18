# Nachtarbeit 2026-04-18

_24 Commits lokal, **keine Pushes**. Alle warten auf User-Review und selektives Push._

## Zusammenfassung

| Bereich | Commits | Push-Freigabe empfohlen |
|---|---|---|
| Bug-Fixes (F-08, F-13, F-14, R-01, Risk-Link) | 5 | ✅ Review einzeln, alle sicher |
| Security + Integrity | 3 | ✅ Read-only Endpoints + Report, kein DB-Effekt |
| Ops + Health | 3 | ✅ `/health` public, X-Request-ID, JSON-Logger |
| CI-Guardrails | 2 | ✅ Wirken erst bei PRs |
| Docs + ADRs | 7 | ✅ Reine Doku, null Risiko |
| Audit-Tools | 4 | ✅ Scripts + Reports |

**Gesamt: 24 Commits, davon 3 mit SQL-Migrations** (F-08 Dedupe, KRI-Templates) + 0 DB-Schema-Änderungen ohne Migration. Deploy-impact nur bei den 3 Migrations-Commits.

## Reihenfolge und Umfang

### Bug-Fixes (P0-P2 aus dem Audit-Testlauf 2026-04-17)

| # | Commit | Fix |
|---|---|---|
| 1 | `fce1ded` | **F-08** Katalog-Duplikate entfernen + UNIQUE-Constraint |
| 2 | `3fce806` | **F-13** Framework-Import-Dropdown dynamisch aus aktiven Katalogen |
| 3 | `5fc457e` | **F-14** Standalone Finding-Add-Button + auditId/riskId-Filter |
| 4 | `97aa502` | **R-01** `/audit/findings` Route als Redirect |
| 5 | `a29af51` | Link im Audit-Report: `/risks/{id}` (war: /erm/risks/{id}, 404) |

### Security + Integrity

| # | Commit | Was |
|---|---|---|
| 6 | `c1c7c60` | **scripts/audit-rls-coverage.mjs** + erster Report: 132 Tabellen ohne RLS, 52 ohne audit_trigger |
| 7 | `d82eb4f` | **GET /api/v1/audit-log/integrity** — SHA-256 Hash-Chain-Verifikation (ADR-011) |
| 8 | `1a0913f` | **gitleaks-CI + scripts/audit-secrets.mjs** — ADR-018 Phase 0, 0 kritische Leaks |

### Ops + Health

| # | Commit | Was |
|---|---|---|
| 9 | `30cea4e` | **GET /api/v1/health** — public Liveness/Readiness-Probe |
| 10 | `25bc6ca` | **X-Request-ID** auf allen Responses (Middleware) |
| 11 | `38d4943` | **apps/web/src/lib/logger.ts** — Structured JSON-Logger für Node/Worker |

### CI-Guardrails (ADR-014 Phase 3 + F-18)

| # | Commit | Was |
|---|---|---|
| 12 | `58dc04e` | `.github/workflows/migration-policy.yml` blockt neue `src/migrations/*.sql` + `schema-drift.yml` Coverage-Check |
| 13 | `1a0913f` *(oben enthalten)* | Secret-Scanning-Workflow |

### Dokumentation + ADRs

| # | Commit | Datei |
|---|---|---|
| 14 | `9be914d` | **ADR-015** Off-Site-Backup via B2 + `offsite-sync.sh`, `offsite-sync-setup.sh` |
| 15 | `ea715b8` | `docs/runbook.md` + `docs/adr-index.md` |
| 16 | `fece0fb` | **ADR-016** CI/CD-Pipeline + `docs/onboarding.md` |
| 17 | `228764c` | `docs/architecture.md` (6 Mermaid-Diagramme) |
| 18 | `1086b47` | `docs/feature-catalog.md` (alle Module + Framework-Coverage) |
| 19 | `d238530` | `docs/compliance/dora-readiness-checklist.md` |
| 20 | `9ac971e` | **ADR-017** Monitoring + **ADR-018** Secret-Management + `SECURITY.md` |

### Audit-Tools

| # | Commit | Was |
|---|---|---|
| 21 | `6a63133` | **scripts/audit-lod-coverage.mjs** — 1606 Endpoints, 17 "anonymous mutating" (alle legitim: SSO, Token-Auth, Health) |
| 22 | `66779db` | **scripts/generate-openapi.mjs** + `docs/openapi.yaml` (1034 paths, 1606 method-combos) |
| 23 | `1ed24b7` | Toter Clerk-Stub `packages/auth/src/middleware.ts` entfernt (nichts importierte ihn) |
| 24 | `9857cfb` | `packages/db/drizzle/0103_default_kri_templates.sql` — 10 plattform-seeded KRI-Vorlagen |

### E2E-Tests

| # | Commit | Was |
|---|---|---|
| 25 | `9b6718c` | **tests/e2e/** Playwright-Suite: F-02/15/17/18 + R-01 (5 Specs), README, Config, Auth-Fixtures |

## Deploy-Impact-Analyse

### Reine Code/Doc — deploy-neutral (21 Commits)

Diese ändern kein Runtime-Verhalten ohne aktiven User. Push + Deploy = no-op oder nur UI-Verbesserungen:
- Alle `docs/*.md`
- Alle `.github/workflows/*.yml` (laufen nur bei PRs)
- `SECURITY.md`
- `scripts/*.mjs` (nur manuell ausgeführt)
- E2E-Tests (`tests/e2e/`)
- JSON-Logger (`apps/web/src/lib/logger.ts`) — nur verfügbar, aber nicht genutzt
- Dead-Code-Entfernung (Clerk-Stub)

### Schema-Änderungen (3 Commits)

Die müssen beim nächsten `arctos-update` durch den Entrypoint, dann gehen sie live:
- **`fce1ded`** F-08 Katalog-Dedupe + UNIQUE-Constraint (`0102`). Transaktional + idempotent, aber **DB-Backup vorher** (besonders wenn Tenants Daten haben, die über die Dedupe-Zeile wandern).
- **`9857cfb`** Default-KRI-Templates (`0103`) — reine INSERTs in `catalog` / `catalog_entry`, ON CONFLICT DO NOTHING. Null Risiko.
- `58dc04e` CI-Workflows — kein DB-Effekt, nur PR-Gates.

### Code-Änderungen mit Runtime-Effekt nach Deploy (5 Commits)

- `3fce806` F-13 Framework-Dropdown — Frontend-Änderung, testen nach Deploy
- `5fc457e` F-14 Finding-Add-Button — dito
- `97aa502` R-01 Redirect — Frontend-Änderung, testen
- `a29af51` Risk-Link-Fix — Frontend
- `30cea4e`, `25bc6ca` — `/health`-Endpoint + X-Request-ID (transparent, aber beobachtbar)

### Neu hinzugekommene Endpoints

- `GET /api/v1/health` (public)
- `GET /api/v1/audit-log/integrity` (admin)

Beide ge-TypeCheck-t, neu für Live-Umgebung.

## Empfohlener Review- und Push-Ablauf

### Variante A — Batches (empfohlen)

1. **Push "Docs-Only"** (7 Commits, null Risiko): ADR-015, ADR-016, ADR-017, ADR-018, runbook, onboarding, architecture, feature-catalog, DORA-checklist, adr-index, SECURITY.md
2. **Review + Push "Audit-Tools"** (4 Commits): rls-audit, lod-audit, openapi-generator, secret-audit — Scripts + Reports unter `docs/security/`
3. **Push "CI-Guardrails"** (2 Commits): migration-policy, schema-drift, secret-scanning
4. **Review + Push "Bug-Fixes"** (5 Commits, UI-Tests nach Deploy): F-08, F-13, F-14, R-01, Risk-Link
5. **Review + Push "Ops"** (3 Commits): /health, X-Request-ID, JSON-Logger
6. **Review + Push "Integrity"** (1 Commit): audit-log/integrity
7. **Review + Push "DB-Migrations"** (2 Commits) **mit db-backup.sh vorher**: 0102 Dedupe, 0103 KRI-Templates
8. **Review + Push "Dead-Code"** (1 Commit): Clerk-Stub entfernt

### Variante B — Alles auf einmal

```bash
git push origin main
sudo bash /opt/arctos/deploy/db-backup.sh --pre-overnight-batch
# User macht arctos-update wenn bereit
```

24 Commits auf einmal ist reviewbar, aber jede Schema-Migration will vorher bestätigt sein.

## Offene Items (für die 41 Aufgaben aus dem Gesamtplan)

Nicht geschafft / in Bundle 3 und später:
- **Bundle 3** (Phase 3): 60 Drizzle-Schema-TS-Files für extra-Tabellen — großer Refactor, besser in separater Session
- **Bundle 7** (Code Quality): 160 TS-Errors — zieht sich
- **Bundle 8** (Perf): N+1-Scan, Fehlende Indexes — braucht DB-Profiling auf Live
- Weitere GRC-Tasks: Compliance-Calendar-Seeds, ISO-27001-Assessment-Auto-Mapping, DORA-Templates

Diese bleiben im Backlog unter `docs/adr-index.md` und im Audit-Test-Protokoll.

## Commit-Log Gesamtüberblick

```
$ git log --oneline origin/main..HEAD
```

(Siehe Abschnitt oben.)

## Nächste Session

Nach Review + Push der 24 Commits:
1. `sudo bash /opt/arctos/deploy/db-backup.sh --pre-overnight-deploy`
2. `sudo arctos-update`
3. Verifikation: `/api/v1/health` → 200, `/api/v1/health/schema-drift` → missingInDb sollte ≤ 3 bleiben, E2E-Regression-Suite wenn gewollt.
4. Dann: Bundle 3 (Phase 3 Schemas) als eigene Iteration.
