# ARCTOS — IST-Stand (Single Source of Truth)

> **Lies das zuerst.** Dieses Dokument ist die maßgebliche Status-Übersicht der ARCTOS-Plattform. Es existiert, um Fehleinschätzungen des Reifegrads zu vermeiden — insbesondere durch Doku-Texte, die noch von „Sprint 1 Foundation" sprechen.
>
> Stand: **2026-05-16**. Letzte Migration: `0326_seed_arctistx_rbac_users.sql`. Letzter Release: **0.1.0-alpha** (2026-04-20). Letzte abgeschlossene Welle: **Wave 22** (2026-05-16, PR #166). Aktive Arbeit: **Wave 23 Endgame** (A1 finding-FK, A2 /admin/branding, C3 contract-name, Pilot-Readiness-Gate), ADR-014 Phase 3+4, ADR-019/020/021/023/024 (Proposed).

## Was ist seit STATUS-Stand 2026-05-10 passiert?

563 Commits in 6 Wochen seit 2026-04-01 (~14/Tag). Hauptlinien:

- **22 Wave-Cycles** (Wave 3 → Wave 22) als nightly QA → next-day-Hotfix-Pipeline. Wave-Themen: RFC-7807 Error-Envelopes, deterministic Pagination-Tiebreakers, Strict-Allow-Lists, `/transitions`-Discovery, Hash-Chain-Dispatch via `hash_version`, pdfkit PDF-Pipeline, RBAC-Konsistenz-Sweep, BIA-Export, Auth-Error-Normalization, **CMMI-Maturity-Derivation**, **BIA→Asset-Cascade**, **finding→control-Cascade**, Pilot-Ready 7 NEW Endpoints + Multi-Entity-Test-Sweep.
- **Programme Cockpit Sprint 1 → Sprint 13** komplett ausgebaut (21 PRs, #54–#79): My Work, Evidence-Upload + Audit-Pack, Portfolio-Dashboard, Cost+Approval, Gantt, Custom Steps, Evidence-Suggest, **Synthetic Auditor**, **Reverse-Programme** (auch im Findings-Modul), **Predictive + What-if**, dynamische Velocity-Window + Calibration-Warning. CIS Controls v8 IG1/2/3-Templates seeded, BCMS/DPMS/AIMS-Templates v1.1 enriched.
- **Audit-Trail-Hardening**: `0308` audit_trigger reason metadata · `0309` audit hash_version · `0310` audit work_item type · `0311` repair audit hash versioning · `0312` rehash v0 audit entries · `0313` audit `chain_seq` (deterministic ordering) · Forward-chain repair, dispatch via `hash_version`, anchor guard. Hash-Chain Stand 2026-05-15: **healthy v1=1229 v2=513 total=1742 mismatches=0**.
- **27 neue Migrationen** (0300 → 0326), darunter `0314` incident-authority-notification, `0315` RLS-gap-closure-v4, `0316`–`0318`/`0326` RBAC-test/login-user-seeds + enum-backfill, `0319`/`0322` CISO-ERM/DPMS/ESG-read, `0321` risk-status `reopened`, `0324` `vendor_manager`-User-Role, `0325` asset-classification-override.
- **16 neue Drizzle-Schemas**: `programme`, `risk-acceptance`, `isms-cap`, `ai-act-extended`, `audit-extras`, `approval-workflow`, `entity-comment`, `stakeholder-register`, `control-monitoring`, `connector`, `data-governance`, `esef-xbrl`, `content-narrative`, `checklist`, `phase3-extras`, `_generated_stubs`.
- **Per-Tenant-Worker** für Compliance-grade Tenant-Isolation (#50). **Legal/Impressum/Datenschutz + Footer** (#55).
- 18 `fix(night)`-Commits (automatisierte nightly QA-Closures), 15 `chore(deps)` Dependabot-Bumps.

## TL;DR

ARCTOS ist **kein Greenfield-Projekt**. Stand heute (2026-05-16):

- **86+ Sprints + Programme Cockpit Sprint 13 + Wave 22 abgeschlossen** plus laufende Cross-Cutting-Arbeit (Audit-Trail-Hash-Chain, RLS-Gap-Closure, EU-AI-Act-Vollständigkeit, ISO-27005-Kataloge).
- **108 Drizzle-Schema-Files**, **305 SQL-Migrationen** bis `0326_seed_arctistx_rbac_users.sql` (vorher 278 / `0299`).
- **563 `pgTable()`-Definitionen** (statischer Count, vorher 561). Der RLS-Coverage-Report (Stand 2026-04-18) zählte 545 — die Differenz sind seither hinzugekommene Tabellen, die noch nicht im RLS-Audit erfasst wurden. Letzter dokumentierter Stand: 347 mit vollständiger RLS+Policy+Audit-Trigger, 131 mit RLS-Lücke, 52 mit Audit-Trigger-Lücke, 15 plattform-exempt. Migration `0315_rls_gap_closure_v4.sql` hat weitere Lücken geschlossen — Re-Audit ausstehend.
- **1.246 `route.ts`-Files** unter `/api/v1/` (vorher 1.150) ergeben **~1.700 HTTP-Endpoints** (Hochrechnung — letzter LoD-Audit zählte 1.606 bei 1.150 routes).
- **470 Next.js `page.tsx`** (vorher 453), verteilt auf ~85 Top-Level-Routen-Gruppen.
- **46 Compliance-Frameworks geseedet** (~2.860 Catalog-Einträge), **~960 Cross-Framework-Mappings** + 2 neue Programme-Journeys (W22-B6 Demo-Seed).
- **258 Test-Files** (236 vor diesem Quartal) + **47 Playwright-E2E-Specs** (vorher 40, +6 wave-spezifisch + 1 dataflow). Verifizierte Out-of-band-Läufe der jüngsten Wellen: schema-drift-finding-fk 7/7, seed-wiring 6/6, tprm-schemas 26/26 (Wave 22). Coverage-Threshold-Gating in CI seit Wave 14 aktiviert (40 % lines / 30 % branches als Floor, ratchet up).
- **~410k LOC** Source-Code insgesamt (apps + packages, ohne node_modules).
- CI ist seit 2026-04-20 vollgrün ohne `continue-on-error`-Bypass (7 blockierende Jobs). Wave 23 fügt einen 8. Pilot-Readiness-Gate-Job hinzu.

## Code-Pfad-Hinweis (häufige Verwechslung)

| Pfad                              | Was es ist                                                                                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grcfiles/grc-platform/`          | **Echter Code.** Alle aktuellen Schemas, Migrationen, APIs, UI-Pages liegen hier.                                                                               |
| `grcfiles/source/grc-platform/`   | **Veraltetes Bootstrap-Skelett.** Stub-Files mit TODO-Kommentaren, referenziert noch Clerk. **Nicht für Neuarbeit verwenden.**                                  |
| `grcfiles/CLAUDE.md` (top-level)  | Nur Sprint-1-Stand — wird in Cowork-Sessions als project instructions geladen, ist aber **veraltet**. Ersetzt durch dieses Dokument + `grc-platform/CLAUDE.md`. |
| `grcfiles/grc-platform/CLAUDE.md` | **Aktuelle Architektur-/Konventionen-Doku** (388 Zeilen).                                                                                                       |

## Sprint-Stand

Vollständige Übersicht in [`docs/feature-catalog.md`](./feature-catalog.md). Hier nur die Eckpunkte:

| Bereich                                                                                                                                                | Sprints   | Status     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---------- |
| Foundation (Auth, RBAC, Audit, Multi-Entity)                                                                                                           | 1–1.4     | ✅         |
| Core GRC (ERM, BPMN, ICS+DMS, Catalog, ISMS, BCMS, DPMS, Audit, TPRM)                                                                                  | 2–9       | ✅         |
| Erweiterte Plattform (Module, Playbooks, Calendar, SSO/SCIM, NIS2, FAIR, Knowledge-Graph, …)                                                           | 10–37     | ✅         |
| Advanced-Module pro Domain (Platform/ERM/ICS/BCMS/DPMS/Audit/TPRM/ESG/Whistleblowing/BPM Advanced)                                                     | 38–47     | ✅         |
| EAM komplett (Foundation, Dashboards, Visualizations, Data-Architecture, AI, Catalog, Governance)                                                      | 34, 48–53 | ✅         |
| API-Platform, Plugins, Onboarding, Mobile, SaaS-Metering                                                                                               | 57–61     | ✅         |
| Connectors (Evidence, Cloud, Identity, DevOps), Cross-Framework-Mapping                                                                                | 62–66     | ✅         |
| GRC Copilot, AI Evidence Review, Regulatory Change, Predictive Risk, Control Testing                                                                   | 67–71     | ✅         |
| DORA, EU AI Act (vollständig), Tax CMS, Horizon Scanner, Cert Wizard                                                                                   | 72–76     | ✅         |
| BI Report Builder, Benchmarking, Risk Quantification, Data Sovereignty, Role Dashboards                                                                | 77–81     | ✅         |
| Marketplace, Stakeholder Portals, Academy, Simulation Engine, Community Edition                                                                        | 82–86     | ✅         |
| Cross-Cutting post-86 (Audit-Hash-Chain, RLS-Gap-Closure, ISMS-CAP, Risk Acceptance, ISO-27005-Kataloge, SoA, Programme Cockpit, Stakeholder Register) | post-86   | ✅ laufend |

## Modul-Reifegrad-Matrix

Statische Zählung über `packages/db/src/schema/` und `apps/web/src/app/`. „Tables" = `pgTable()`-Aufrufe in den jeweiligen Schema-Files.

| Modul-Domain                                                                                                             | Schema-Files | Tabellen |                                                     UI-Pages |                        API-Routen |
| ------------------------------------------------------------------------------------------------------------------------ | -----------: | -------: | -----------------------------------------------------------: | --------------------------------: |
| **academy**                                                                                                              |            1 |        5 |                                                            4 |                                 6 |
| **ai-act**                                                                                                               |            2 |       13 |                                                           23 |                                15 |
| **audit** (audit-mgmt + audit-advanced + audit-analytics + audit-extras)                                                 |            4 |       31 |                                                           15 |                                24 |
| **bcms** (bcms + bcms-advanced)                                                                                          |            2 |       22 |                                                           12 |                                11 |
| **bpm** (process + process-raci + bpm-advanced)                                                                          |            3 |       21 |                                                            5 |                                 8 |
| **budget**                                                                                                               |            1 |        5 |                                                            7 |                                 4 |
| **catalog** (catalog + framework-mapping)                                                                                |            2 |       17 |                                                            7 |                                10 |
| **copilot/agents** (copilot-chat + agents + intelligence)                                                                |            3 |       15 |                                                            2 | inkl. unter `/copilot`, `/agents` |
| **dora**                                                                                                                 |            1 |        6 |                                                            7 |                                 7 |
| **dpms** (dpms + dpms-advanced)                                                                                          |            2 |       22 |                                                           15 |                                17 |
| **eam** (foundation + advanced + ai + catalog + dashboards + data-architecture + governance)                             |            7 |       31 |                                                           28 |                                29 |
| **erm** (risk + risk-acceptance/-evaluation/-quantification/-propagation + predictive-risk + fair + rcsa + erm-advanced) |            9 |       41 | 10 (`/risks`, `/erm`) + 5 (`/rcsa`) + 4 (`/predictive-risk`) |                                14 |
| **esg** (esg + esg-advanced + esef-xbrl)                                                                                 |            3 |       29 |                                                           19 |                                10 |
| **ics** (control-monitoring + control-testing-agent + ics-advanced)                                                      |            3 |       12 |                    15 (`/controls`) + 4 (`/control-testing`) |                                 5 |
| **isms** (isms + isms-cap + isms-intelligence + asset + incident-timeline + ai-act + ai-act-extended)                    |            7 |       36 |                                                           44 |                                13 |
| **platform** (platform + platform-advanced + abac + identity + automation)                                               |            5 |       31 |                     platform-weite Admin- und Settings-Pages |                  inkl. `/admin/*` |
| **task** (task + work-item)                                                                                              |            2 |        5 |                                   2 (tasks) + 2 (work-items) |                                 2 |
| **tprm** (tprm + tprm-advanced + supplier-portal)                                                                        |            3 |       25 |                                                           13 |                                 8 |
| **whistleblowing** (whistleblowing + whistleblowing-advanced)                                                            |            2 |       13 |                                                            8 |                                 4 |

> Hinweis: Pages und APIs werden teilweise unter Singular-Routen geführt (`/risks`, `/controls`, `/audit`, `/eam`), nicht immer unter dem Modul-Key. Die Spalten zeigen die ungefähren Volumina, nicht 1:1-Mappings.

## Tech-Stack-Stand

Aktuelle Stand-Daten aus `package.json`-Workspaces und CHANGELOG (0.1.0-alpha, 2026-04-20):

| Layer      | Technologie                                                                        | Anmerkung                                             |
| ---------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Frontend   | Next.js 15, React 19, Tailwind 4, shadcn/ui, recharts, bpmn-js                     | App Router, Server Components default, Turbopack dev  |
| Backend    | Node.js 22 LTS, TypeScript 5, Hono.js (Worker)                                     | Worker hat 120 Cron-Jobs, läuft via `tsx`             |
| ORM        | Drizzle ORM                                                                        | 107 Schemas, 278 Migrationen                          |
| Datenbank  | PostgreSQL 16 + TimescaleDB + pgvector, RLS                                        | Hypertables für KRI/Sim-Results/CCM-Checkpoints       |
| Auth       | Auth.js v5 self-hosted + Custom RBAC + Three Lines of Defense                      | Drizzle-Adapter, Azure AD optional, MFA TOTP+WebAuthn |
| AI         | Multi-Provider-Router (Claude, OpenAI, Gemini, Ollama lokal)                       | `packages/ai`                                         |
| Email      | Resend SDK + React Email (27 Templates DE/EN)                                      | `packages/email`                                      |
| Audit      | 3 Append-Only Tabellen + SHA-256 Hash-Kette + DB-Trigger + FreeTSA Tamper-Evidence | ADR-011 rev.3                                         |
| CI/CD      | GitHub Actions, CodeQL, Dependabot, Trivy Image-Scan                               | 7 blockierende Jobs seit 2026-04-20                   |
| Deployment | Docker + docker-compose (production + dev)                                         | **Keine** Helm Charts / K8s Manifeste vorhanden       |

## Test-Coverage-Stand (IST)

### Aggregierte Coverage (gemessen 2026-04-30)

Quelle: [`coverage/aggregated-summary.md`](../coverage/aggregated-summary.md). Workflow: `npm run test:coverage` → `npm run test:coverage:aggregate`.

| Metrik     |             Aggregat | Status |
| ---------- | -------------------: | :----: |
| Lines      | 78,4 % (3.443/4.394) |   🟡   |
| Statements | 76,6 % (3.646/4.758) |   🟡   |
| Functions  |     66,5 % (420/632) |   🟡   |
| Branches   | 66,4 % (1.722/2.593) |   🟡   |

> ⚠️ Diese Aggregation deckt nur die **2 Packages ab, die `coverage-summary.json` exportieren** (`packages/auth`, `packages/shared`). Die Hauptpakete `apps/web`, `apps/worker`, `packages/db` u. a. erscheinen nicht in dieser Aggregation. Reale Plattform-Coverage liegt **deutlich darunter**.

### Test-Files-Verteilung (gezählt 2026-05-10)

| Bereich                   |                    Test-Files | Source-Files |   Source-LOC | Coverage-Schwerpunkt                                                                                                                |
| ------------------------- | ----------------------------: | -----------: | -----------: | ----------------------------------------------------------------------------------------------------------------------------------- |
| **`apps/worker`**         |                       **119** |          247 |       20.275 | Cron-Jobs, Webhook-Handler — gute Coverage                                                                                          |
| **`packages/shared`**     |        **62** (vorher 59, +3) |          279 |       54.887 | + Bulk-Cap-Contract, Risk-Status-Transition, OpenAPI-Spec-Validation                                                                |
| **`apps/web`**            |        **18** (vorher 11, +7) |    **1.789** |  **279.746** | + 6 RBAC-Tests + Domain-RBAC-Suite (8 Endpoints parametrisch) — **strukturell unterversorgt, kritische Pfade jetzt aber abgedeckt** |
| **`packages/db`**         |        **12** (vorher 11, +1) |          138 |       36.413 | + RLS-Audit-Pure-Function-Tests (Klassifikations-Logik)                                                                             |
| **`packages/auth`**       |                             6 |           29 |        3.273 | RBAC, OIDC, SAML, SCIM                                                                                                              |
| **`packages/automation`** |          **6** (vorher 4, +2) |           11 |        1.631 | + Rule-Engine-Throttling + Conditions-Deep-Tests (35 Cases verifiziert grün)                                                        |
| **`packages/graph`**      |                             3 |           11 |        1.992 | Knowledge-Graph                                                                                                                     |
| **`packages/ai`**         |          **3** (vorher 2, +1) |           14 |        1.574 | + Privacy-Router-Edge-Cases (PII → Ollama → LMStudio → Default)                                                                     |
| **`packages/email`**      |          **3** (vorher 1, +2) |           31 |        4.368 | + Render-Smoke 6 Templates × DE/EN + Auto-Discovery aller 25 Templates                                                              |
| **`packages/events`**     |          **1** (vorher 0, +1) |            5 |          474 | + Webhook-HMAC-Tampering (11 Cases verifiziert grün)                                                                                |
| **`packages/reporting`**  |          **2** (vorher 0, +2) |            9 |        1.910 | + Variable-Resolver Injection-Tests (16 Cases verifiziert grün) + Section-Data-Fetcher-Smoke                                        |
| **`packages/ui`**         |          **1** (vorher 0, +1) |           41 |        3.660 | + cn()-Utility (11 Cases verifiziert grün)                                                                                          |
| **Total**                 | **236** (vorher 216, **+20**) |    **2.604** | **~410.000** |                                                                                                                                     |

### E2E-Specs (Playwright)

40 Specs unter `tests/e2e/regression/`, gruppiert nach Modul:

- **B-01 bis B-06** — BCMS (BIA, BCP, Crisis, Exercise, Resilience, Readiness)
- **D-01 bis D-03** — DORA (Incident, Providers, TLPT)
- **F-02, F-15, F-17, F-18** — Foundation (Org, Catalog, Schema-Drift, Integrity)
- **I-01 bis I-10** — ISMS (Setup, Assessment, SoA, Mgmt-Review, NC, Policy-Ack, Threat-Heatmap, CVE, Playbook, Risk-Acceptance)
- **N-01, N-02** — NIS2 (Reporting, Readiness)
- **P-01 bis P-06** — Programme Cockpit
- **R-01 bis R-03** — Routes/Wizards (Audit-Findings, Monitor-Pages, Compliance-Wizards)
- **X-01 bis X-06** — Cross-Cutting (Org-Switch, i18n, Auditor-Portal, Supplier-Portal, Whistleblowing, Framework-Mapping)

### Smoke-Test-Sicherheitsnetz

- `apps/web/src/__tests__/api/all-routes-smoke.test.ts` — generischer Route-Smoke
- `tests/e2e/regression/f-17-schema-drift.spec.ts` — `/api/v1/health/schema-drift` blockiert Drift in CI
- `tests/e2e/regression/f-18-integrity-endpoint.spec.ts` — `/api/v1/audit-log/integrity` SHA-256 Hash-Chain-Verifikation
- CI-Smoke: `tests/e2e/ci-smoke.spec.ts` (Login → Dashboard → Risk-CRUD → Audit-Log → Audit-Archive-ZIP)

## Sicherheits-Coverage

### RLS + Audit-Trigger (Stand 2026-04-18 + 0288 Gap-Closure)

Quelle: [`docs/security/rls-coverage-report.md`](./security/rls-coverage-report.md), [`scripts/audit-rls-coverage.mjs`](../scripts/audit-rls-coverage.mjs).

| Status             |                               Tabellen | Bedeutung                                                                          |
| ------------------ | -------------------------------------: | ---------------------------------------------------------------------------------- |
| ✅ OK              |                                **347** | RLS + Policy + Audit-Trigger vollständig                                           |
| ❌ RLS_MISSING     | **131** (urspr. 132, durch 0288 → 131) | `org_id` vorhanden, aber `ENABLE ROW LEVEL SECURITY` fehlt                         |
| ❌ AUDIT_MISSING   |                                 **52** | RLS+Policy ja, aber `audit_trigger()` nicht registriert                            |
| ⚪ PLATFORM_EXEMPT |                                     15 | Plattform-weite Tabellen (catalog, module_definition, user, audit_log selbst etc.) |
| **Total**          |                                **545** |                                                                                    |

Migration `0288_rls_gap_closure_v3.sql` hat 11 Tabellen geschlossen (AI Act, Audit-Risk-Prediction, Sim-Results, Scenario-Engine). Aktuelle Lücken-Schwerpunkte:

- `bcms.ts` (BCP, BIA, crisis\_\*, continuity_strategy, essential_process)
- `dpms.ts` (ropa*\*, dpia*_, dsr_, data_breach, tia)
- `tprm.ts` (vendor*, contract*)
- `process.ts` (alle process\_\* Tabellen)
- `whistleblowing.ts` (wb_case\*, wb_report, wb_anonymous_mailbox)
- `isms.ts` (assessment\_\*, soa_entry, threat, vulnerability, security_incident, control_maturity, management_review)
- `esg.ts` (esrs*\*, esg*\*)

### Three Lines of Defense (Stand 2026-04-18)

Quelle: [`docs/security/lod-coverage.md`](./security/lod-coverage.md).

- 1.606 API-Routen analysiert, 796 mutating
- 17 anonymous mutating — **alle legitim** (Auth-Callbacks, Portal-Token-Routes, SCIM-IdP-Push, DD-Submit)
- LoD-Verteilung: cross 1.313, 2nd 900, 3rd 347, 1st 277, read 270, isolated 6 (Whistleblowing)

### Audit-Trail-Hash-Chain

- `GET /api/v1/audit-log/integrity` — SHA-256-Verifikation (E2E-Test in `f-18-integrity-endpoint.spec.ts`)
- FreeTSA als primärer Tamper-Evidence-Kanal (ADR-011 rev.3)
- `javascript-opentimestamps` entfernt (14 CVEs); OTS-Submit bleibt zero-dep
- DB-Test: `packages/db/tests/integration/audit-integrity-live.test.ts`

## Bekannte Lücken (für die nächste Iteration)

| Gap                                                                      | Severity | Status nach diesem Arbeitspaket                                                                                                                                               |
| ------------------------------------------------------------------------ | -------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Coverage in `apps/web`** — Domain-CRUD-Tests                           |       P0 | ✅ 7 neue Tests + Domain-RBAC-Suite (8 Endpoints parametrisch). Bleibt: ~140 weitere mutating Endpoints                                                                       |
| **Coverage in `packages/reporting`, `packages/events`**                  |       P0 | ✅ Beide Packages haben jetzt Tests; PDF/Excel-Generator-Pipeline weiterhin nur partial (section-data-fetcher abgedeckt, generator.ts nicht)                                  |
| **OpenAPI-Spec-Validation** (`docs/openapi.yaml`, 1.034 Paths)           |       P3 | ✅ Strukturelle Validation-Tests (8 Cases verifiziert grün, 1.034 Paths gezählt)                                                                                              |
| **Coverage-Threshold-Gating in CI**                                      |       P2 | ✅ `vitest.coverage.shared.ts`: 40 % lines / 30 % branches als Floor, ratchet-up-Strategie dokumentiert                                                                       |
| **Bulk-Cap (Critical Rule #11)**                                         |       P0 | ✅ 12 Cases verifiziert grün gegen 3 Schemas (bulkEnroll, createApiKey, updateApiKey)                                                                                         |
| **Webhook-HMAC-Tampering-Schutz**                                        |       P0 | ✅ 11 Cases verifiziert grün — Tampering, Length-Attack, Unicode                                                                                                              |
| **Template-Injection in Reporting**                                      |       P0 | ✅ 16 Cases verifiziert grün — Whitelist-Namespaces, no nested re-rendering                                                                                                   |
| **Risk-Lifecycle-State-Validation (Schema-Layer)**                       |       P1 | ✅ 16+20 Cases — alle 5 Status-Werte, case-sensitivity, Financial-Impact-Refine. **Server-side State-Transition-Logik (z. B. closed → identified verbieten) fehlt weiterhin** |
| 131 Tabellen ohne RLS-Policy                                             |       P1 | Pure-Function-Test der Klassifikationslogik geschrieben (10 Cases). Schließung läuft im `release/0.2-rls-gap-closure`                                                         |
| 52 Tabellen ohne `audit_trigger()`                                       |       P1 | dito                                                                                                                                                                          |
| 99 verbleibende TypeScript-Errors (Web 0, Worker 0, Rest in Tests/Tools) |       P3 | offen                                                                                                                                                                         |
| 137 N+1-Query-Kandidaten                                                 |       P3 | offen                                                                                                                                                                         |
| 1.738 fehlende Index-Vorschläge (53 davon RLS-High)                      |       P2 | offen                                                                                                                                                                         |
| ~30 verbleibende Schema-Drift-Migrationen (von urspr. 79)                |       P2 | offen                                                                                                                                                                         |
| OTS-Upgrade-Walker noch Stub                                             |       P3 | offen                                                                                                                                                                         |
| Helm-Charts / K8s-Manifeste fehlen                                       |       P2 | offen — ADR-012 noch Proposed                                                                                                                                                 |
| 83 extra DB-Tabellen ohne Drizzle-Schema-Export                          |       P2 | offen — ADR-014 Phase 3                                                                                                                                                       |
| **Reporting-PDF/Excel-Generator** (Puppeteer-Pipeline + ExcelJS)         |       P1 | offen — braucht Puppeteer-Mock oder Snapshot-Tests                                                                                                                            |
| **20 weitere Email-Templates per Template-spezifische Tests**            |       P3 | abgedeckt durch Auto-Discovery-Smoke (alle 25 Templates × DE/EN), template-spezifische Edge-Cases offen                                                                       |
| **State-Machine server-side** — z. B. `closed → identified` HTTP-422     |       P1 | offen — Schema layer akzeptiert Werte, Routing-Layer prüft nicht                                                                                                              |
| **150 weitere mutating Endpoints** ohne dedizierten RBAC-Test            |       P1 | Pattern etabliert (Domain-RBAC-Suite ist parametrisch erweiterbar). Skalierung offen                                                                                          |
| **W23-A1** finding controlId/auditId/riskId persistiert null in prod      |       P0 | Wave 23: post-insert FK-Verification + `_meta/build` für Self-Service-D1, gehärtet via withErrorHandler                                                                       |
| **W23-A2** /admin/branding 500 (Wave 22 RequestID 24a45b827c4f2e4d)       |       P0 | Wave 23: Acceptance-Test 200/501-only, `_meta/build` für Deploy-SHA-Diagnose                                                                                                  |
| **W23-C3** Contract POST {name:'X'} → 500 statt 422                       |       P1 | Wave 23: Wave-22-Alias funktioniert, POST jetzt withErrorHandler-gewrappt → niemals empty 500                                                                                 |
| **W23-Pilot-Readiness-Gate** als CI-Pre-Merge-Check                       |       P0 | Wave 23: `scripts/pilot-readiness-gate.sh` läuft gegen Staging, GitHub-Actions-Job blockt Merges                                                                              |

## Wave 23 — Endgame (laufend, Pilot-Readiness-Gate)

Wave 22 hat festgestellt: A1 + A2 haben **korrekten Repo-Code, falsches Production-Behavior** — d. h. Deploy-/Migration-Drift, kein Code-Bug. Wave 23 ist der Endgame-Cycle, der genau das zur Unmöglichkeit macht:

1. **`/api/v1/_meta/build`** — neuer Endpoint exposes Git-SHA + Build-Time + Drizzle-Migration-Count. Macht D1 (Prod-vs-Main-SHA-Vergleich) zum Self-Service per `curl`, ohne SSH.
2. **Post-Insert-FK-Verification in `findings/route.ts` POST** — direkt nach dem Drizzle-Insert wird das returning-Row mit dem Input verglichen. Wenn ein FK gesendet wurde aber als null zurückkommt, **wirft die Route eine strukturierte 500 mit Diagnostic statt still 201 zu liefern**. Eliminiert die "201 + null FKs"-Failure-Klasse permanent.
3. **`withErrorHandler`-Wrap auf `findings/route.ts` + `contracts/route.ts` POST** — alle uncaught Exceptions werden jetzt RFC-7807 problem+json mit RequestID. C3 "empty 500 body" ist damit unmöglich.
4. **`scripts/pilot-readiness-gate.sh` + neuer CI-Job** — Smoke-Test gegen Staging vor jedem Merge, läuft A1 / A2 / C3 / Hash-Chain durch und blockt rote Merges. Subjektive Einschätzungen reichen nicht mehr.
5. **3 neue Acceptance-Tests** (findings-fk-roundtrip, admin-branding 200/501-only, contracts-name-alias 201) als regression-guard im Vitest-Lauf.

Status-Update folgt nach Wave-23-Merge + Cowork-QA-Verifikation.
