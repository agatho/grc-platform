## ADR-018: Secret Management

| **ADR-ID** | **018** |
| --- | --- |
| **Title** | **`.env` files mit root:root 600 als Baseline; BSI-konformer Secret-Vault als künftige Option** |
| **Status** | **Proposed (dokumentiert Status Quo + Upgrade-Pfad)** |
| **Date** | 2026-04-18 |
| **Context** | Secrets (DB-Password, AUTH_SECRET, API-Keys für Claude/Resend, zukünftig B2/rclone) leben aktuell in `.env`-Dateien pro Tenant. Kein Vault, kein Key-Rotation-Prozess, keine Secret-Scanning-CI. |

### Current State (Status Quo)

```
/opt/arctos/
├── .env                         (Haupt, DB_PASSWORD etc.)
└── tenants/
    ├── daimon/env               (Tenant-spezifisch: AUTH_SECRET, WB_KEY, CRON_SECRET)
    └── <other>/env
```

- Mode 600 (rw für root, sonst nichts)
- Werden als Volume-Mount in Docker-Container eingebunden
- Rotation: manuell, keine Automatik
- Backup: ALLES in db-backup.sh enthalten (wenn auch nur Schema + Data, nicht env-Files) — env-Files müssen separat gesichert werden, sind aber nicht Teil des Backup-Scripts
- Kein Audit wer wann was Secret gelesen hat

### Identified Risks

1. **R1 — Single-file-compromise**: Root-Compromise = alle Secrets exposed. Kein Defence-in-Depth.
2. **R2 — Kein Key-Rotation-Prozess**: AUTH_SECRET-Rotation würde alle JWTs invalidieren (User-Logout). Akzeptiert, aber nirgends dokumentiert.
3. **R3 — Keine CI-Leak-Erkennung**: git-secrets / truffleHog nicht im Pipeline.
4. **R4 — Plain-Text im Container**: Secrets im Container-Environment visible via `/proc/<pid>/environ` bei shell-Access.

### Decision

**Phase 0 (Baseline-Hygiene, sofort):**
- Git-Secret-Scanning als CI-Step (`truffleHog` oder GitHub Secret-Scanning aktivieren, letzteres ist frei)
- `env-files` explizit in `.gitignore` (bereits — verifizieren)
- Runbook-Eintrag für Secret-Rotation-Ablauf
- Monatliche manuelle Review: `grep -rn "password\|secret\|api_key" --include="*.ts"` + CI-Guardrail

**Phase 1 (kurzfristig, ≤ 3 Monate):**
- Tenant-`env`-Files explizit ins B2-Backup (ADR-015) mit aggressiver Zugriffsbeschränkung. Separater B2-Key, nur read-protected.
- Separate Service-Accounts pro Tenant (DB-User `grc_daimon`, nicht shared `grc`) → Principle of Least Privilege
- `AUTH_SECRET` pro Tenant unterschiedlich (bereits so via `create-tenant.sh`) — dokumentieren

**Phase 2 (mittelfristig, wenn Compliance-Anforderung stärker wird):**
- **HashiCorp Vault** self-hosted auf Hetzner, unter dem gleichen Caddy
- Secrets via Vault-Agent-Template in den Container-Environment injiziert
- KMS für at-rest-Verschlüsselung (BSI Grundschutz SYS.2.2)
- Access-Audit-Log: wer hat wann welches Secret gelesen
- Key-Rotation-Policies (z. B. AUTH_SECRET alle 90 Tage, mit dual-key-overlap)

**Phase 3 (Enterprise-Scale):**
- Separater dedizierter Secret-Management-Host (nicht auf dem Web/DB-Host)
- Hardware-Security-Module (HSM) oder Cloud-KMS
- Certificate-Authority für mTLS zwischen Services

### Alternatives Considered

| Option | Pro | Contra |
|---|---|---|
| AWS Secrets Manager | Managed | US-Cloud, widerspricht ADR-007 rev. 1 |
| Azure Key Vault | EU-Regions | Vendor-Lock + Microsoft-Abhängigkeit |
| Keepass XC + Team-Share | Kostenlos, offline | Kein API, keine Audit-Trail, kein rotation-at-scale |
| Bitwarden Self-Hosted | Moderat | Primär für Team-Passwörter, nicht Service-Secrets |
| HashiCorp Vault | Industriestandard, Audit, Rotation, BSI-konform | Ops-Aufwand (1 Tag Setup, HA nicht trivial) |

→ **Vault gewinnt für Phase 2**, Status Quo ok für Phase 0-1.

### Concrete Phase-0 Actions (next PRs)

1. `.github/workflows/secret-scanning.yml` mit gitleaks/truffleHog
2. `docs/runbook.md` Abschnitt "Secret Rotation" ergänzen
3. Baseline-Audit: welche Files enthalten secrets-looking-patterns? → `scripts/audit-secrets.mjs`
4. SECURITY.md als Policy-Stub (wie reporte ich eine Leckage?)

### Consequences

**Positiv:**
- Phase 0-1 ist free-of-charge + ops-einfach
- Clearer Migration-Pfad zum Vault-Setup wenn die Plattform wächst

**Negativ:**
- Phase 2 ist invasiv — jeder Container braucht Vault-Agent-Integration
- Vault selbst ist ein SPOF wenn nicht HA — Infrastruktur-Planung vorher nötig

### References

- BSI Grundschutz SYS.1.1 (Allgemeiner Server), SYS.2.2 (Informationsschutz)
- ISO 27002:2022 A.5.17 (Authentication information), A.8.2 (Privileged access)
- ADR-015 (Off-Site-Backup) — env-Files müssen dort einbezogen werden
- ADR-017 (Monitoring) — Vault-Audit-Log muss ins Monitoring
