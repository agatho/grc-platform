# Detaillierter Testplan — ISMS- & BCMS-Bereiche

**Stand:** 2026-04-30
**Geltungsbereich:** Funktionale + nicht-funktionale Tests aller in [05-requirements-catalog.md](./05-requirements-catalog.md) erfassten Anforderungen.
**Test-Strategie:** Vier-Ebenen-Pyramide (Static / Unit / Integration / E2E) mit Domain-spezifischen Querschnitt-Tests (RLS, Audit-Chain, State-Machines).

---

## 1. Test-Strategie

### 1.1 Pyramid

```
                     ┌──────────────────┐
                     │   E2E (≤ 5 %)    │   Playwright, golden paths only
                     └──────────────────┘
                ┌─────────────────────────┐
                │  Integration (~ 20 %)   │  vitest + Postgres (DB / RLS / Audit-Chain)
                └─────────────────────────┘
            ┌─────────────────────────────────┐
            │       Unit (~ 70 %)             │  vitest, pure functions, state-machines
            └─────────────────────────────────┘
        ┌─────────────────────────────────────────┐
        │   Static (~ 100 % via Tooling)          │  TS strict, eslint, drizzle-typecheck
        └─────────────────────────────────────────┘
```

### 1.2 Test-Klassen

| Klasse | Tooling | Wo | Geschwindigkeit |
|--------|---------|-----|-----------------|
| Static-Type | tsc strict | alle | < 30 s |
| Lint | eslint | alle | < 30 s |
| Unit | vitest | `packages/*` (außer db), `apps/web` | < 2 min |
| State-Machine | vitest pure | `packages/shared/state-machines` | < 30 s |
| Schema-Validation | vitest pure | `packages/shared/schemas` | < 30 s |
| Integration-DB | vitest + Postgres | `packages/db/tests/integration` | < 5 min |
| Integration-RLS | vitest + Postgres | `packages/db/tests/rls` | < 5 min |
| Audit-Chain-Integrity | vitest + Postgres | `packages/db/tests/integration/audit-*` | < 5 min |
| API-Contract | vitest + Next-Test-Mode | `apps/web/src/__tests__` | < 5 min |
| E2E | Playwright | `tests/e2e/regression` | < 15 min |
| E2E (Smoke) | Playwright | `tests/e2e/regression/smoke.spec` | < 2 min |

### 1.3 Test-Daten-Strategie

- **Seed-Daten:** Demo-Tenant mit voll konfiguriertem ISMS+BCMS (Skript `scripts/seed-demo.sh` → `db:seed:demo`)
- **Fixtures:** Pro Test-Suite eigene Fixtures in `tests/fixtures/`, neutral, idempotent
- **Property-Based:** Wo geometrisch sinnvoll (z. B. CES-Engine, Risk-Quantification) → fast-check
- **Snapshot-Tests:** Selten, nur für stabile UI-Komponenten

### 1.4 Test-Umgebung

| Umgebung | Zweck |
|----------|-------|
| LOCAL | Entwickler-Laufzeit, Postgres in Docker |
| CI-EPHEMERAL | GitHub-Actions, Postgres als Service |
| STAGING | Pre-Prod, daily migration + e2e-suite |
| PROD | nur Smoke-Tests (Synthetics) |

---

## 2. Test-Cases pro Anforderung

> Zuordnung: Pro REQ-ID gibt es 1+ Test-Case mit ID `TC-<Domain>-<Nr>`. Nur reine Doku-Anforderungen (NFR-001…003, NFR-008..) werden NICHT mit Code abgedeckt.

### 2.1 ISMS — Kern

| TC-ID | Bezug | Typ | Kurzbeschreibung |
|-------|-------|-----|------------------|
| TC-ISMS-001 | REQ-ISMS-001 | Integration | Multi-Org-Hierarchie: Sub-Org sieht Parent-Daten nur via expliziten Hierarchy-Query, nicht via RLS-Default |
| TC-ISMS-002 | REQ-ISMS-002 | Unit | Document-Approval-Workflow: nicht-genehmigtes Doc liefert keine effective_date, genehmigtes doch |
| TC-ISMS-003 | REQ-ISMS-003 | E2E | Policy-Acknowledgement: User mit nicht-bestätigter Policy sieht Banner; nach Klick verschwindet er |
| TC-ISMS-004a | REQ-ISMS-004 | Unit | RBAC: viewer kann GET, admin kann POST/PUT/DELETE |
| TC-ISMS-004b | REQ-ISMS-004 | Integration | Three-Lines-Filter: auditor sieht nur 3rd-Line-Berichte |
| TC-ISMS-005 | REQ-ISMS-005 | E2E | Stakeholder-Register CRUD (sofern Modul existiert), sonst → Gap |
| TC-ISMS-010 | REQ-ISMS-010 | Integration | SoA-Populate: Bulk-Init erzeugt 93 Einträge, Idempotenz-Test |
| TC-ISMS-011 | REQ-ISMS-011 | Unit | SoA-Constraint: applicability=excluded ohne reason → 400 |
| TC-ISMS-012 | REQ-ISMS-012 | Integration | Diff-API: Anlegen v1, Update Felder → Diff zeigt Adds/Removes/Changes |
| TC-ISMS-013 | REQ-ISMS-013 | E2E | Excel-Export: Datei-Download mit korrektem Schema |
| TC-ISMS-014 | REQ-ISMS-014 | Unit (Mock-AI) | AI-Gap-Analysis ruft LLM mit korrektem Prompt; Response wird strukturiert |
| TC-ISMS-015 | REQ-ISMS-015 | Unit | SoA-Status-Maschine: Sprung von planned → effective verboten ohne Zwischenphase |
| TC-ISMS-016 | REQ-ISMS-016 | Integration | Snapshot zu Stichtag eingefroren, später Edit ändert Snapshot nicht |
| TC-ISMS-020a | REQ-ISMS-020 | Unit | isms-assessment State-Machine: erlaubte/verbotene Übergänge |
| TC-ISMS-020b | REQ-ISMS-020 | Integration | API-Layer: transition mit invalid Phase → 409 |
| TC-ISMS-021 | REQ-ISMS-021 | Integration | Bulk-Eval atomar: 50 Evals in 1 TX, Fehler in 25 → Rollback |
| TC-ISMS-022 | REQ-ISMS-022 | Integration | eval-gate-check liefert 5 fehlende, nach Befüllung ok |
| TC-ISMS-023 | REQ-ISMS-023 | Integration | risk-gate-check analog |
| TC-ISMS-024 | REQ-ISMS-024 | Integration | soa-gate-check analog |
| TC-ISMS-025 | REQ-ISMS-025 | E2E | Bericht-Endpoint liefert PDF mit erwarteten Sektionen |
| TC-ISMS-026 | REQ-ISMS-026 | Unit (Mock-AI) | Risk-Scenario-Generator gibt 5–20 Szenarien |
| TC-ISMS-027 | REQ-ISMS-027 | E2E | Setup-Wizard end-to-end |
| TC-ISMS-028a | REQ-ISMS-028 | Unit | Management-Review-Inputs werden aus DB geladen |
| TC-ISMS-028b | REQ-ISMS-028 | Integration | Erstellung mit auto-populated Inputs |
| TC-ISMS-029 | REQ-ISMS-029 | Unit | Review-Type-Validation |
| TC-ISMS-030 | REQ-ISMS-030 | Unit | NC-Severity-Enum-Constraint |
| TC-ISMS-031 | REQ-ISMS-031 | Unit | NC-State-Maschine alle Übergänge |
| TC-ISMS-032 | REQ-ISMS-032 | Integration | Closure ohne effective_review → 422 |
| TC-ISMS-033 | REQ-ISMS-033 | Integration | Bulk-Findings → NCs angelegt mit korrekter Severity |
| TC-ISMS-034 | REQ-ISMS-034 | Integration | CAPA: Korrekturmaßnahme + Vorbeuge mit Owner+Frist |
| TC-ISMS-035 | REQ-ISMS-035 | E2E | Root-Cause-Analyse-Modul: 5-Why-Eingabe |

### 2.2 RISK

| TC-ID | Bezug | Typ | Kurzbeschreibung |
|-------|-------|-----|------------------|
| TC-RISK-001 | REQ-RISK-001 | Unit | Risikomatrix-Konfiguration: 3×3, 4×4, 5×5 |
| TC-RISK-002 | REQ-RISK-002 | Integration | Asset- und Szenario-basierte Erfassung |
| TC-RISK-003 | REQ-RISK-003 | Integration | Eval-Log: jede Änderung mit Vor-/Nach-Wert |
| TC-RISK-004 | REQ-RISK-004 | Unit | Treatment-Strategy-Enum |
| TC-RISK-005 | REQ-RISK-005 | Integration | M:N Risk↔Control |
| TC-RISK-006 | REQ-RISK-006 | Integration | Risk-Acceptance: ohne berechtigte Rolle → 403 |
| TC-RISK-007 | REQ-RISK-007 | Unit | KRI-Trend-Berechnung |
| TC-RISK-008 | REQ-RISK-008 | Unit | FAIR-Simulation: deterministisch bei festem Seed |
| TC-RISK-009 | REQ-RISK-009 | Unit | Sensitivity: korrekte Tornado-Daten |
| TC-RISK-010 | REQ-RISK-010 | Integration | Re-Assessment-Frist: Worker markiert überfällige |
| TC-RISK-011 | REQ-RISK-011 | Unit | Prediction-Modell training+inference smoke |
| TC-RISK-012 | REQ-RISK-012 | Unit | Appetite-Threshold Eskalation |
| TC-RISK-013 | REQ-RISK-013 | Unit | cross-risk-sync State-Machine |
| TC-RISK-014 | REQ-RISK-014 | Integration | Exec-Summary konfigurierbar Top-N |
| TC-RISK-015 | REQ-RISK-015 | Unit | Chance-Felder existieren, validierbar |

### 2.3 BCMS

| TC-ID | Bezug | Typ | Kurzbeschreibung |
|-------|-------|-----|------------------|
| TC-BCMS-001 | REQ-BCMS-001 | Unit | bcms-bia State-Machine |
| TC-BCMS-002 | REQ-BCMS-002 | Integration | Process-Impact mit allen Time-Buckets |
| TC-BCMS-003 | REQ-BCMS-003 | Unit | RTO/RPO/MBCO Pflichtvalidierung |
| TC-BCMS-004 | REQ-BCMS-004 | Integration | Supplier-Dependency in BIA |
| TC-BCMS-005 | REQ-BCMS-005 | Integration | Heatmap-Endpoint |
| TC-BCMS-006 | REQ-BCMS-006 | Integration | Generate-Process-Impacts erstellt für alle kritischen Prozesse |
| TC-BCMS-007 | REQ-BCMS-007 | Integration | Finalize-Gate blockiert bei fehlenden Pflichtfeldern |
| TC-BCMS-010 | REQ-BCMS-010 | Integration | BCP CRUD, Procedures, Resources |
| TC-BCMS-011 | REQ-BCMS-011 | Unit | bcms-bcp State-Machine |
| TC-BCMS-012 | REQ-BCMS-012 | Unit | Activation-Trigger-Field exists + validiert |
| TC-BCMS-013 | REQ-BCMS-013 | Integration | Resources mit Quantitäten |
| TC-BCMS-014 | REQ-BCMS-014 | Integration | Procedures mit Sequenz |
| TC-BCMS-015 | REQ-BCMS-015 | Integration | Plans-Gate-Check |
| TC-BCMS-020 | REQ-BCMS-020 | Integration | Crisis-Team mit Backups |
| TC-BCMS-021 | REQ-BCMS-021 | Integration | Contact-Tree mit Eskalation |
| TC-BCMS-022 | REQ-BCMS-022 | Integration | Crisis-Log append-only (Update verboten) |
| TC-BCMS-023 | REQ-BCMS-023 | Unit | bcms-crisis State-Machine |
| TC-BCMS-024 | REQ-BCMS-024 | Integration | Activate-Endpoint setzt activation_time |
| TC-BCMS-025 | REQ-BCMS-025 | Integration | DORA-Timer setzt Fristen + Erinnerungen |
| TC-BCMS-026 | REQ-BCMS-026 | Integration | Krisen-Kommunikations-Log |
| TC-BCMS-027 | REQ-BCMS-027 | Integration | Recovery-Procedure-Steps |
| TC-BCMS-030 | REQ-BCMS-030 | Unit | Exercise-Type-Enum |
| TC-BCMS-031 | REQ-BCMS-031 | Unit | bcms-exercise State-Machine |
| TC-BCMS-032 | REQ-BCMS-032 | Integration | Findings + Lessons Workflow |
| TC-BCMS-033 | REQ-BCMS-033 | Integration | Inject-Log append-only |
| TC-BCMS-034 | REQ-BCMS-034 | E2E | Übungs-Bericht-PDF |
| TC-BCMS-035 | REQ-BCMS-035 | Integration | Gate-Check Übung |
| TC-BCMS-036 | REQ-BCMS-036 | Integration | Lessons → CAPA-Item-Erstellung |
| TC-BCMS-040 | REQ-BCMS-040 | Unit | Strategy-Type-Enum |
| TC-BCMS-041 | REQ-BCMS-041 | Integration | Resilience-Score-Berechnung |
| TC-BCMS-042 | REQ-BCMS-042 | E2E | Readiness-Monitor |
| TC-BCMS-043 | REQ-BCMS-043 | E2E | Readiness-PDF |
| TC-BCMS-044 | REQ-BCMS-044 | Integration | ERM-Sync-Job |

### 2.4 NIS2

| TC-ID | Bezug | Typ | Kurzbeschreibung |
|-------|-------|-----|------------------|
| TC-NIS2-001 | REQ-NIS2-001 | Unit | Anwendbarkeitsprüfung-Klassifikation |
| TC-NIS2-002 | REQ-NIS2-002 | Integration | 10 Mindest-Maßnahmen-Status CRUD |
| TC-NIS2-003 | REQ-NIS2-003 | Unit | Readiness-Score-Berechnung |
| TC-NIS2-004 | REQ-NIS2-004 | Integration | Reporting-Tracker zeigt fällige Reports |
| TC-NIS2-010..012 | REQ-NIS2-010..012 | Integration | Frist-Engine: Frühwarn-, Vorfalls-, Final-Bericht |
| TC-NIS2-013 | REQ-NIS2-013 | Integration | Status-Anzeige je Vorfall |
| TC-NIS2-014 | REQ-NIS2-014 | Integration | Aufsichts-Konfiguration pro Org |
| TC-NIS2-020 | REQ-NIS2-020 | E2E | Annual-Statistik-Generator |
| TC-NIS2-021 | REQ-NIS2-021 | E2E | Evidenz-Bundle-Export |

### 2.5 DORA

| TC-ID | Bezug | Typ | Kurzbeschreibung |
|-------|-------|-----|------------------|
| TC-DORA-001 | REQ-DORA-001 | Integration | ICT-Risk-Register CRUD |
| TC-DORA-002 | REQ-DORA-002 | Integration | DORA↔ISMS Risk Cross-Reference |
| TC-DORA-003 | REQ-DORA-003 | Integration | ICT-Risk-Framework-Doku |
| TC-DORA-010..014 | REQ-DORA-010..014 | Integration | DORA-Incident-Reporting mit allen Timer-Phasen |
| TC-DORA-011 | REQ-DORA-011 | Integration | Major-Incident-Threshold-Engine |
| TC-DORA-020..023 | REQ-DORA-020..023 | Integration | Test-Programm + TLPT-Plan + TLPT-Provider + Vuln-Assessment |
| TC-DORA-022 | REQ-DORA-022 | Unit | Provider-Compliance-Check |
| TC-DORA-030 | REQ-DORA-030 | Integration | Provider-Register mit allen Pflichtattributen |
| TC-DORA-031 | REQ-DORA-031 | Unit | Provider-Risiko-Score-Berechnung |
| TC-DORA-032 | REQ-DORA-032 | Integration | Konzentrationsrisiko aus Multi-Provider-View |
| TC-DORA-033 | REQ-DORA-033 | Integration | Vertrags-Klausel-Pflicht-Check |
| TC-DORA-034 | REQ-DORA-034 | Integration | Exit-Strategie-Doku |
| TC-DORA-040 | REQ-DORA-040 | Integration | Information-Sharing CRUD |
| TC-DORA-041 | REQ-DORA-041 | Integration | NIS2↔DORA Cross-Reference |

### 2.6 AUDIT

| TC-ID | Bezug | Typ | Kurzbeschreibung |
|-------|-------|-----|------------------|
| TC-AUDIT-001..013 | REQ-AUDIT-001..013 | Mix | Universe, Plan, Auditor, Working Papers, Findings, Bulk, Closure-Readiness, Analytics, Continuous-Rules, QA-Review, Templates, Team-Zuweisung |

### 2.7 INC, THR, VUL, ASSET

| TC-ID | Bezug | Typ | Kurzbeschreibung |
|-------|-------|-----|------------------|
| TC-INC-001..008 | REQ-INC-001..008 | Mix | CRUD, Timeline, Playbook-AI, Phase-Engine, Korrelation, Rating, Eskalations-Konfig, DORA-Schwelle |
| TC-THR-001..004 | REQ-THR-001..004 | Integration | Register, Heatmaps, Trends |
| TC-VUL-001..004 | REQ-VUL-001..004 | Integration | Register, CVE-Sync, CVE-Match, Acknowledge-Workflow |
| TC-ASSET-001..006 | REQ-ASSET-001..006 | Mix | Hierarchie, CIA, CPE-Match, Recommended-Risks, Audit-Summary, Tier |

### 2.8 AWARE

| TC-ID | Bezug | Typ | Kurzbeschreibung |
|-------|-------|-----|------------------|
| TC-AWARE-001 | REQ-AWARE-001 | Integration | Pflicht-Schulungs-Modul |
| TC-AWARE-002 | REQ-AWARE-002 | Unit | Quiz-Pass-Logik |
| TC-AWARE-003 | REQ-AWARE-003 | E2E | Zertifikat-PDF |
| TC-AWARE-004 | REQ-AWARE-004 | Integration | Phishing-Sim-Connector-Stub |

### 2.9 XCUT

| TC-ID | Bezug | Typ | Kurzbeschreibung |
|-------|-------|-----|------------------|
| TC-XCUT-001 | REQ-XCUT-001 | Integration | Audit-Chain: prev_hash korrekt, Tampering-Detection |
| TC-XCUT-002 | REQ-XCUT-002 | Integration | Per-Tenant-Chain: Org A Insert manipuliert nicht Chain Org B |
| TC-XCUT-003 | REQ-XCUT-003 | Integration | RLS: Cross-Tenant-Read 0 Rows |
| TC-XCUT-004 | REQ-XCUT-004 | Integration | Access-Log nach Read auf sensiblen Endpoint |
| TC-XCUT-005 | REQ-XCUT-005 | Integration | Data-Export-Log nach Export |
| TC-XCUT-006 | REQ-XCUT-006 | Integration | Approval-Workflow auf generischer Entität |
| TC-XCUT-007 | REQ-XCUT-007 | Integration | Switch-Org-Token enthält neue Org-ID |
| TC-XCUT-008 | REQ-XCUT-008 | Integration | MFA-Erzwingung pro Rolle |
| TC-XCUT-009 | REQ-XCUT-009 | Unit | OIDC + SAML Provider |
| TC-XCUT-010 | REQ-XCUT-010 | Unit | SCIM 2.0 Endpoints |
| TC-XCUT-011 | REQ-XCUT-011 | Integration | Notifications: in-app + email |
| TC-XCUT-012 | REQ-XCUT-012 | E2E | i18n-Switch DE/EN |
| TC-XCUT-013 | REQ-XCUT-013 | Integration | BI-Reports CRUD + Run |
| TC-XCUT-014 | REQ-XCUT-014 | Integration | API-Key + Rate-Limit |
| TC-XCUT-015 | REQ-XCUT-015 | Integration | ABAC-Policies |
| TC-XCUT-016 | REQ-XCUT-016 | Integration | Custom-Fields |
| TC-XCUT-017 | REQ-XCUT-017 | Integration | Daten-Region-Pinning |
| TC-XCUT-018 | REQ-XCUT-018 | Integration | Anchor-Endpoint signiert Hash periodisch |
| TC-XCUT-020..023 | REQ-XCUT-020..023 | Integration | Framework-Mapping, Coverage, Gap, NIS2↔DORA |
| TC-XCUT-030..033 | REQ-XCUT-030..033 | E2E | Auditor-Portal, Lieferanten-Portal, Branding, Whistleblowing |

---

## 3. E2E-Test-Plan (vollständig, alle Anforderungs-relevanten Flüsse)

> Status pro E2E-Spec: `EXISTS` (bereits implementiert) / `NEW-IN-SESSION` (in dieser Nacht-Session zu schreiben)

### 3.1 Kritische Pfade — MUST-have für jeden Build

| E2E-ID | Status | Anforderung(en) | Spec-Datei |
|--------|--------|-----------------|------------|
| E2E-001 — Org-Create | EXISTS | REQ-ISMS-001 | `tests/e2e/regression/f-02-org-create.spec.ts` |
| E2E-002 — Audit-Findings-Route | EXISTS | REQ-AUDIT-005 | `f-...` |
| E2E-003 — Compliance-Wizards | EXISTS | REQ-XCUT-020..022 | `r-03-compliance-wizards.spec.ts` |
| E2E-004 — Schema-Drift | EXISTS | (NFR) | `f-17-schema-drift.spec.ts` |
| E2E-005 — Integrity-Endpoint | EXISTS | REQ-XCUT-001 | `f-18-integrity-endpoint.spec.ts` |
| E2E-006 — New-Monitor-Pages | EXISTS | (Smoke) | `r-02-new-monitor-pages.spec.ts` |
| E2E-007 — Audit-Findings-Route alt | EXISTS | REQ-AUDIT-005 | `r-01-audit-findings-route.spec.ts` |
| E2E-008 — Checklist-Catalog | EXISTS | (Catalog) | `f-15-checklist-catalog.spec.ts` |

### 3.2 ISMS-Flüsse — geplant

| E2E-ID | Status | Anforderung(en) | Spec-Datei (geplant) |
|--------|--------|-----------------|----------------------|
| E2E-101 — ISMS-Setup-Wizard | NEW-IN-SESSION | REQ-ISMS-027 | `tests/e2e/regression/i-01-isms-setup-wizard.spec.ts` |
| E2E-102 — Assessment-Lifecycle (eval → soa → risk → review → finalize) | NEW-IN-SESSION | REQ-ISMS-020..025 | `i-02-assessment-lifecycle.spec.ts` |
| E2E-103 — SoA-Diff + Export | NEW-IN-SESSION | REQ-ISMS-012, 013 | `i-03-soa-diff-export.spec.ts` |
| E2E-104 — Management-Review-Erstellung | NEW-IN-SESSION | REQ-ISMS-028 | `i-04-management-review.spec.ts` |
| E2E-105 — NC-Lifecycle | NEW-IN-SESSION | REQ-ISMS-030..032 | `i-05-nc-lifecycle.spec.ts` |
| E2E-106 — Policy-Acknowledgement | NEW-IN-SESSION | REQ-ISMS-003 | `i-06-policy-ack.spec.ts` |
| E2E-107 — Threat-Heatmap + MITRE | NEW-IN-SESSION | REQ-THR-002, 003 | `i-07-threat-heatmap.spec.ts` |
| E2E-108 — CVE-Match → Risk Convert | NEW-IN-SESSION | REQ-VUL-003, 004 | `i-08-cve-flow.spec.ts` |
| E2E-109 — Incident-Playbook | NEW-IN-SESSION | REQ-INC-003, 004 | `i-09-incident-playbook.spec.ts` |
| E2E-110 — Risk-Acceptance | NEW-IN-SESSION | REQ-RISK-006 | `i-10-risk-acceptance.spec.ts` |

### 3.3 BCMS-Flüsse — geplant

| E2E-ID | Status | Anforderung(en) | Spec-Datei |
|--------|--------|-----------------|------------|
| E2E-201 — BIA-Lifecycle | NEW-IN-SESSION | REQ-BCMS-001..007 | `b-01-bia-lifecycle.spec.ts` |
| E2E-202 — BCP-Lifecycle | NEW-IN-SESSION | REQ-BCMS-010..015 | `b-02-bcp-lifecycle.spec.ts` |
| E2E-203 — Crisis-Activation | NEW-IN-SESSION | REQ-BCMS-022..026 | `b-03-crisis-activation.spec.ts` |
| E2E-204 — Exercise-Tabletop | NEW-IN-SESSION | REQ-BCMS-030..036 | `b-04-exercise-tabletop.spec.ts` |
| E2E-205 — Resilience-Score | NEW-IN-SESSION | REQ-BCMS-041 | `b-05-resilience-score.spec.ts` |
| E2E-206 — Readiness-Monitor | NEW-IN-SESSION | REQ-BCMS-042..043 | `b-06-readiness-monitor.spec.ts` |

### 3.4 NIS2 / DORA-Flüsse — geplant

| E2E-ID | Status | Anforderung(en) | Spec-Datei |
|--------|--------|-----------------|------------|
| E2E-301 — NIS2-Reporting-3-Phasen | NEW-IN-SESSION | REQ-NIS2-010..013 | `n-01-nis2-reporting.spec.ts` |
| E2E-302 — NIS2-Readiness-Dashboard | NEW-IN-SESSION | REQ-NIS2-002, 003 | `n-02-nis2-readiness.spec.ts` |
| E2E-303 — DORA-Incident-Lifecycle | NEW-IN-SESSION | REQ-DORA-010..014 | `d-01-dora-incident.spec.ts` |
| E2E-304 — DORA-Provider-Register | NEW-IN-SESSION | REQ-DORA-030..034 | `d-02-dora-providers.spec.ts` |
| E2E-305 — TLPT-Plan-CRUD | NEW-IN-SESSION | REQ-DORA-021 | `d-03-tlpt-plan.spec.ts` |

### 3.5 Cross-Cutting

| E2E-ID | Status | Anforderung(en) | Spec-Datei |
|--------|--------|-----------------|------------|
| E2E-401 — Org-Switch | NEW-IN-SESSION | REQ-XCUT-007 | `x-01-org-switch.spec.ts` |
| E2E-402 — i18n DE/EN | NEW-IN-SESSION | REQ-XCUT-012 | `x-02-i18n.spec.ts` |
| E2E-403 — Auditor-Portal | NEW-IN-SESSION | REQ-XCUT-030 | `x-03-auditor-portal.spec.ts` |
| E2E-404 — Lieferanten-Portal | NEW-IN-SESSION | REQ-XCUT-031 | `x-04-supplier-portal.spec.ts` |
| E2E-405 — Whistleblowing-Portal | NEW-IN-SESSION | REQ-XCUT-033 | `x-05-whistleblowing.spec.ts` |
| E2E-406 — Framework-Mapping-Wizard | NEW-IN-SESSION | REQ-XCUT-020..022 | `x-06-framework-mapping.spec.ts` |

> **Hinweis:** „NEW-IN-SESSION" Specs werden in Phase 2g geschrieben; erfolgreiche Ausführung erfordert eine voll konfigurierte Stage-Umgebung mit Seed-Daten. Sofern in dieser Nacht-Session der Stack nicht voll fahrbar ist, werden die Specs als **defensive Skeletons** (mit `test.fixme` markiert wo unausführbar) angelegt. Sie sind dann Test-Plan-Artefakt + Backlog-Items für STAGING.

---

## 4. Test-Daten

### 4.1 Demo-Tenant
- 1 Holding + 3 Tochtergesellschaften
- 50 Assets über 4 Tiers verteilt
- 30 Risiken (10 hoch, 15 mittel, 5 niedrig)
- 1 vollständige BIA (12 Prozesse)
- 3 BCPs (1 active, 2 draft)
- 1 abgeschlossene Übung (tabletop), 1 geplante Übung
- 5 ICT-Provider, davon 2 kritisch
- 2 abgeschlossene NIS2-Reportings
- 12 Audit-Findings (3 major, 6 minor, 3 observation)

### 4.2 RLS-Test-Daten
- 2 Tenants A und B mit identischer Struktur
- 1 Cross-Tenant-User mit Zugriff auf beide

### 4.3 Audit-Chain-Test-Daten
- Initiale 100 Inserts → Hash-Chain-Validation
- Manipuliertes prev_hash in Position 47 → Integrity-Check meldet broken

---

## 5. CI-Integration

### 5.1 Pflicht-Pipeline (PR-Required)
1. Static (typecheck + lint) — < 2 min
2. Unit (alle packages) — < 3 min
3. Integration (db, rls, audit-chain) — < 5 min
4. E2E (smoke subset) — < 5 min

### 5.2 Daily / Nightly
- Vollständige E2E-Suite gegen STAGING
- Coverage-Bericht
- Schema-Drift-Check
- Migration-Smoke (apply + rollback + apply)

### 5.3 Acceptance-Gates
- Coverage Backend ≥ 80 %
- Coverage Frontend ≥ 60 %
- Keine `failed`-Tests
- Keine `skipped` ohne Begründung
- E2E-Pass-Rate ≥ 95 % (Flake-Tolerance)

---

## 6. Test-Execution-Plan dieser Nacht-Session

| Phase | Inhalt | Erwartete Dauer | Akzeptanz |
|-------|--------|-----------------|-----------|
| 1 | Baseline Static + Unit + Integration (alle packages) | 5–10 min | alle bestehende Tests grün |
| 2 | Lücken-Identifikation pro REQ | 15 min | Liste aus REQ-IDs ohne TC oder mit failing TC |
| 3 | Closure-Implementierung Top-Lücken | 2–4 h | Lücken durch Code + Tests geschlossen |
| 4 | E2E-Spec-Skeletons | 1–2 h | Specs angelegt, fixme-markiert wo nicht ausführbar |
| 5 | Re-Run alle Tests | 10 min | grün |
| 6 | Coverage-Bericht | 5 min | Backend ≥ 80 %, Frontend ≥ 60 % oder Begründung |

---

## 7. Test-Reporting

- **Test-Execution-Report:** [07-test-execution-report.md](./07-test-execution-report.md) — wird in Phase 2e gefüllt
- **Gap-Closure-Report:** [08-gap-closure-report.md](./08-gap-closure-report.md) — wird in Phase 2f-2g gefüllt
- **Final Summary:** [09-final-summary.md](./09-final-summary.md) — Übergabe-Dokument
