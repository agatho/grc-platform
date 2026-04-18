## ADR-016: CI/CD Pipeline Architecture

| **ADR-ID** | **016** |
| --- | --- |
| **Title** | **GitHub Actions CI + manueller Deploy via `arctos-update`** |
| **Status** | **Accepted (dokumentiert den Ist-Stand)** |
| **Date** | 2026-04-18 |
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

| Gate | Tool | Blockiert Merge |
|---|---|---|
| Lint + TypeScript | `ci.yml` | ✅ |
| Unit Tests | `ci.yml` | ✅ |
| Integration Tests | `ci.yml` | ✅ |
| DB-Integrity Tests (RLS) | `ci.yml` | ✅ |
| Build | `ci.yml` | ✅ |
| Security-Scan (CodeQL) | `codeql.yml` | warn-only (non-blocking) |
| Migration-Location-Policy | `migration-policy.yml` | ✅ |
| RLS-Coverage-Regression | `schema-drift.yml` | ✅ |
| Dependency-Review | `dependency-review.yml` | warn-only |

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

- **4-Augen-Prinzip**: Jeder Merge braucht Approval + CI-Green. Ops kann aber `arctos-update` auch ohne Merge-Genehmigung fahren (z. B. für Hotfix-Branches per lokaler Commit-ID Checkout). Das ist akzeptiert, aber im Audit-Log sichtbar.
- **SLA**: CI-Durchlauf < 10 min (aktuelle Erfahrung). Wenn darüber: Investigate vor Erweiterung.
- **Secret-Management**: Production-Secrets nur auf Hetzner (`.env`), nie in CI. CI hat nur `AUTH_SECRET=ci-build-placeholder`. Eine Preview-Deploy-Pipeline (Vercel o. ä.) ist bewusst nicht eingerichtet wegen Data-Sovereignty (ADR-007 rev.1).

### Outstanding / Future Work

- **ADR-017**: Monitoring + Alerting. Aktuell gibt es nur `/api/v1/health`. Prometheus + Alertmanager oder ein managed Service (Statuspage, Healthchecks.io) ist ungeklärt.
- **ADR-018**: Secret-Management. Aktuell `.env`-Dateien mit mode 600. Für Scale-Up wäre Hashicorp Vault oder BSI Grundschutz-konformer Secret-Safe zu evaluieren.
- **Canary Deploys**: Aktuell alles-oder-nichts pro Tenant. Wenn mehr als ~10 Tenants, wäre Staged Rollout sinnvoll.

### References

- ADR-007 rev. 1: Data Sovereignty → keine US-Cloud-Build-Pipeline
- ADR-014: Migration Policy (Phase 3 Guardrails)
- ADR-015: Off-Site-Backup (Pre-Deploy-Snapshot-Voraussetzung)
- ISO 27001 A.14.2.2: Change-Control-Prozedur
