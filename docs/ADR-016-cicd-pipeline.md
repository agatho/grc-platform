## ADR-016: CI/CD Pipeline Architecture

| **ADR-ID**  | **016**                                                                                                                                                                                                                                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Title**   | **GitHub Actions CI + manueller Deploy via `arctos-update`**                                                                                                                                                                                                                                                                |
| **Status**  | **Accepted (dokumentiert den Ist-Stand)**                                                                                                                                                                                                                                                                                   |
| **Date**    | 2026-04-18                                                                                                                                                                                                                                                                                                                  |
| **Context** | Der Deploy-Workflow existierte bisher nur implizit: `arctos-update` auf dem Hetzner-Host zog `git pull` + `docker compose up -d` an. Die CI lief parallel (`.github/workflows/ci.yml`) ohne formale Verbindung. Dieses ADR hält die faktische Pipeline fest und benennt die Guardrails, die mit ADR-014 Phase 3 hinzukamen. |

### Pipeline Stages

```
Dev pushes to branch
       │
       ▼
   Pull Request
       │
       ├─ ci.yml:                  Lint, Unit Tests, Integration Tests, Build, Security
       ├─ migration-policy.yml:    Blocks new src/migrations/*.sql (ADR-014 Phase 3)
       ├─ schema-drift.yml:        Static RLS + audit_trigger coverage report
       ├─ codeql.yml:              CodeQL Security-Scan
       └─ dependency-review.yml:   Dependabot-style dep review
       │
       ▼
   All green → reviewable
       │
       ▼
   Merge to main
       │
       ▼
   (no auto-deploy) -- Ops-on-call runs `sudo arctos-update` on Hetzner
       │
       ▼
   Entrypoint: psql -f drizzle/*.sql -f src/migrations/*.sql (ADR-014 Phase 1/2)
       │
       ▼
   Docker restart → /api/v1/health green
```

### Decision

**Manueller Deploy bleibt.** Grund: GRC-Plattform, Deploys brauchen explizite menschliche Freigabe. Auto-Deploy wäre in einer Audit-kritischen Umgebung prozessual schwer zu verteidigen (ISO 27001 A.14.2.2 Change-Control).

**Aber: Pre-Deploy-Gates werden in CI erzwungen:**

> **Korrektur 2026-09-01 (ARCTOS-FULL-2026-08-31 / WP10 · S13-01, -02,
> -18, -25, -30).** Die folgende Tabelle beschrieb bis zum Audit ein
> Blockier-Verhalten, das so nicht bestand. Belegt wurde unter anderem:
> „Lint" lief in 1 von 12 Workspaces; „DB-Integrity" prüfte >=10 Tabellen
> bei 594 und >=6 RLS-Policies bei 2.624; das E2E-Gate fuhr 1 von 20
> Playwright-Specs; der Coverage-Workflow trug `continue-on-error: true`
> und keine Schwelle; das „Pilot Readiness Gate" beendete sich ohne
> `STAGING_URL` mit Exit 0, sodass ein gruener Check nicht von einem
> uebersprungenen zu unterscheiden war. Die Tabelle unten ist auf den
> gemessenen Ist-Zustand nach der Remediation gesetzt.

| Gate                                                    | Tool                    | Blockiert Merge        | Umfang (Stand 2026-09-01)                                                                                                                          |
| ------------------------------------------------------- | ----------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prettier                                                | `ci.yml`                | ✅                     | repo-weit                                                                                                                                          |
| ESLint `apps/web`                                       | `ci.yml`                | ✅                     | eigener, strenger Regelsatz (WP12)                                                                                                                 |
| ESLint-Ratsche `apps/worker`, `packages/*`, `scripts/*` | `ci.yml`                | ✅                     | 11 Workspaces; Altbestand in `.eslint-ratchet.json` eingefroren, JEDE neue Verletzung failt (S13-17)                                               |
| TypeScript `web` + `worker`                             | `ci.yml`                | ✅                     |                                                                                                                                                    |
| Unit Tests                                              | `ci.yml`                | ✅                     | `turbo test`; alle 12 Workspaces haben jetzt ein `test`-Skript                                                                                     |
| Integration Tests                                       | `ci.yml`                | ✅                     | `packages/db`, gegen ein aus den Migrationen gebautes Schema                                                                                       |
| Worker-Laufzeittests (Lock, Atomaritaet, Dedup)         | `ci.yml`                | ✅                     | neu verdrahtet; lief vorher in KEINEM Workflow (stiller `describe.skip`)                                                                           |
| RLS-Isolationstests                                     | `ci.yml`                | ✅                     | `packages/db` + Route-Chain, unter `grc_app`                                                                                                       |
| RLS-Coverage (0 Luecken)                                | `ci.yml`                | ✅                     | gegen die frisch migrierte DB gemessen                                                                                                             |
| DB-Integritaet                                          | `ci.yml`                | ✅                     | `scripts/verify-db-integrity.mjs` gegen gemessene Baseline (594 Tabellen, 2.624 Policies, 547 FORCE-RLS, 283 Audit-Trigger), Toleranz 2 % (S13-02) |
| E2E (Playwright)                                        | `ci.yml`                | ✅                     | **alle** Specs, nicht mehr nur `ci-smoke.spec.ts` (S13-18)                                                                                         |
| k6-Perf-Baseline                                        | `ci.yml`                | ✅                     | Binary per SHA-256 geprueft (S13-27)                                                                                                               |
| Docker-Build + Trivy                                    | `ci.yml`                | ✅                     | Scan VOR dem Push nach ghcr.io (S08-07)                                                                                                            |
| `npm audit`-Gate                                        | `ci.yml`                | ✅                     | Allowlist mit Pflichtfeld `package`, Runtime-Behauptung maschinell geprueft (S08-06)                                                               |
| Lizenz-Gate                                             | `ci.yml`                | ✅                     | SPDX-Ausdruecke, UNKNOWN/Custom erzwingen Freigabe, bpmn.io-Wasserzeichen technisch geprueft (S08-10/S08-02)                                       |
| SBOM + NOTICE aktuell                                   | `ci.yml`                | ✅                     | CycloneDX 1.5, `--check` gegen den eingecheckten Stand (S08-12/S08-16)                                                                             |
| Action-Pinning                                          | `ci.yml`                | ✅                     | alle 54 Refs per Commit-SHA (S08-05/S08-08)                                                                                                        |
| `.env.example` vollstaendig                             | `ci.yml`                | ✅                     | jede gelesene Variable dokumentiert, Pflichtvariablen unauskommentiert (S13-28)                                                                    |
| Coverage-Ratsche                                        | `coverage.yml`          | ✅                     | Testfehler blockieren; Gesamt- und Paketabdeckung duerfen nicht unter die Baseline fallen (S13-25)                                                 |
| Security-Scan (CodeQL)                                  | `codeql.yml`            | warn-only (bewusst)    |                                                                                                                                                    |
| Migration-Location-Policy                               | `migration-policy.yml`  | ✅                     | pfadgefiltert auf `packages/db/**`                                                                                                                 |
| Schema-Drift / RLS-Regression                           | `schema-drift.yml`      | ✅                     | pfadgefiltert auf `packages/db/**`                                                                                                                 |
| Dependency-Review                                       | `dependency-review.yml` | warn-only              | nur geaenderte Abhaengigkeiten in PRs                                                                                                              |
| Pilot-Readiness-Gate                                    | `ci.yml`                | ✅                     | failt jetzt ohne `STAGING_URL` und bei abweichendem Staging-Commit; „nicht anwendbar" nur noch bei Fork-PRs (S13-30)                               |
| Vollstaendiger Historien-Secret-Scan                    | `secret-scanning.yml`   | woechentlich, Artefakt | schliesst die `--only-verified`-Luecke (S08-15)                                                                                                    |

**Pfadfilter-Konsequenz (unveraendert gueltig):** vier Workflows laufen nur
bei Aenderungen in ihren Pfaden. Der als „required" gedachte Satz an Checks
ist damit pro PR unterschiedlich gross — ein leerer Check-Satz ist nicht von
einem gruenen zu unterscheiden. Das ist vertretbar, muss aber bei der
Konfiguration der Required Checks in GitHub beruecksichtigt werden (offener
Betreiberpunkt).

**Post-Deploy-Verifikation** (manuell, durch Ops):

1. `curl /api/v1/health` → 200 erwartet
2. `curl /api/v1/health/schema-drift` (Admin) → `healthy: true` erwartet
3. `docker compose logs --tail=100 web | grep "Applied"` → Migration-Count dokumentiert
4. Smoke-Test der kritischen Routes (Login, Dashboard, Audit-Create)

### Rationale

**Gegen Auto-Deploy:**

- Change-Control-Anforderung aus ISO 27001 A.14.2.2 / ITIL Change-Management
- DB-Migrations können nicht einfach "rolled back" werden (data loss)
- Pre-Migration-Backup (ADR-014) muss manuell gestartet werden

**Für CI-Gates:**

- 95% der Regressionen lassen sich pre-merge fangen (Typ-Fehler, fehlende RLS, neue src/migrations/-Files)
- Keine Notfall-Hotfixes ohne CI-Review möglich

### Operationale Konsequenzen

- **4-Augen-Prinzip**: Jeder Merge braucht Approval + CI-Green.
  > **Korrektur 2026-09-01 (S13-19).** Der Nachsatz „Ops kann aber
  > `arctos-update` auch ohne Merge-Genehmigung fahren … das ist akzeptiert,
  > aber im Audit-Log sichtbar" war zur Haelfte unbelegt: das Deploy-Skript
  > schrieb NICHTS in `audit_log`, und mangels Monitoring auch nirgendwo
  > sonst. Der einzige Nachweis war die Terminalausgabe des Operators. Es
  > gab ausserdem keinen technischen Zusammenhang zwischen „CI war gruen"
  > und „das laeuft in Produktion" — deployt wurde der Spitzenstand von
  > `main`, ohne Tag, ohne Release, ohne Statusabfrage.
  >
  > Jetzt: `deploy/update-all.sh` fragt den CI-Status des Ziel-Commits ueber
  > `gh` ab und bricht ab, wenn er nicht `success` ist. Die Ausnahme heisst
  > `ARCTOS_ALLOW_UNVERIFIED_DEPLOY=true` und wird zusammen mit jedem
  > Deploy-Ereignis nach `/opt/arctos/deploy-history.jsonl` geschrieben
  > (Zeitpunkt, Operator, Von-/Nach-Commit, Pre-Deploy-Backup,
  > Vorgaenger-Image, Ergebnis). Das ist der Change-Control-Nachweis, den
  > ISO 27001 A.14.2.2 verlangt.
- **SLA**: CI-Durchlauf < 10 min (aktuelle Erfahrung). Wenn darüber: Investigate vor Erweiterung.
- **Secret-Management**: Production-Secrets nur auf Hetzner (`.env`), nie in CI. CI hat nur `AUTH_SECRET=ci-build-placeholder`. Eine Preview-Deploy-Pipeline (Vercel o. ä.) ist bewusst nicht eingerichtet wegen Data-Sovereignty (ADR-007 rev.1).

### Outstanding / Future Work

- ~~**ADR-017**: Monitoring + Alerting~~ — **erledigt 2026-09-01.** ADR-017
  ist Accepted; der Dienst `ops-metrics` exportiert Metriken im
  Prometheus-Format und alarmiert auf fehlgeschlagene Logins, Massenexporte,
  Kettenbrueche, Job-Fehler und veraltete Backups.
- **ADR-018**: Secret-Management. Aktuell `.env`-Dateien mit mode 600. Für Scale-Up wäre Hashicorp Vault oder BSI Grundschutz-konformer Secret-Safe zu evaluieren.
- **Canary Deploys**: Aktuell alles-oder-nichts pro Tenant. Wenn mehr als ~10 Tenants, wäre Staged Rollout sinnvoll.

### References

- ADR-007 rev. 1: Data Sovereignty → keine US-Cloud-Build-Pipeline
- ADR-014: Migration Policy (Phase 3 Guardrails)
- ADR-015: Off-Site-Backup (Pre-Deploy-Snapshot-Voraussetzung)
- ISO 27001 A.14.2.2: Change-Control-Prozedur
