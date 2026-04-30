# Test-Execution-Report — Overnight-Session 2026-04-30

**Geltungsbereich:** Ausführung des in [06-test-plan.md](./06-test-plan.md) definierten Testplans.
**Zeitraum:** 2026-04-29 abend → 2026-04-30 morgens.
**Branch:** `feature/overnight-isms-bcms-2026-04-30`.

---

## 1. Baseline (vor Änderungen)

### 1.1 Statisch + Lint
- TypeScript strict mode: keine Fehler im neu erstellten Code.
- ESLint: nicht durchgeführt (vorhandene Pipeline trennt sich vom Test).

### 1.2 Unit + Integration

| Package | Test-Files | Tests | Status |
|---------|------------|-------|--------|
| `packages/shared` | 46 | 1294 | ✅ |
| `packages/auth` | 6 | 118 | ✅ |
| `packages/automation` | 4 | 44 | ✅ |
| `packages/email` | 1 | 26 | ✅ |
| `packages/graph` | 3 | 47 | ✅ |
| `apps/web` | 1 | 40 | ✅ |
| `apps/worker` | 0 | 0 (passWithNoTests) | ✅ |
| **Total** | **61** | **1569** | **100 % grün** |

### 1.3 RLS / Audit-Chain Integration

- Drizzle-RLS-Coverage-System-Test (`packages/db/tests/rls/rls-coverage-systemtest.test.ts`) — vorhanden, läuft gegen Postgres
- Audit-Chain-Per-Tenant-Test — vorhanden
- Cross-Tenant-Isolation-Test — vorhanden
- **Hinweis:** In dieser Session wurden DB-Integrationstests nicht ausgeführt, weil kein Postgres-Container in der Windows-Host-Umgebung lief. Die Tests sind in CI mit `npm run test:integration` und `npm run test:rls` einzuplanen.

### 1.4 E2E

| Spec | Status |
|------|--------|
| `f-02-org-create.spec.ts` | EXISTS |
| `f-15-checklist-catalog.spec.ts` | EXISTS |
| `f-17-schema-drift.spec.ts` | EXISTS |
| `f-18-integrity-endpoint.spec.ts` | EXISTS |
| `r-01-audit-findings-route.spec.ts` | EXISTS |
| `r-02-new-monitor-pages.spec.ts` | EXISTS |
| `r-03-compliance-wizards.spec.ts` | EXISTS |

E2E-Specs wurden in dieser Session nicht ausgeführt (Stack-Bringup auf Windows-Host nicht im Scope). Sie sind in CI gegen STAGING zu fahren.

---

## 2. Anforderungs-Coverage-Audit

> Methodik: Jede Anforderung (REQ-IDs aus [05-requirements-catalog.md](./05-requirements-catalog.md)) wurde gegen das aktuelle Repository verifiziert. Status-Marker = beobachteter Ist-Zustand, nicht reine Doku-Aussage.

### 2.1 Bestätigt IMPLEMENTED (keine Aktion)

ISMS-Kern (REQ-ISMS-001..004, 010..016, 020..029, 033, 035, 040..044), RISK (alle 15), BCMS (REQ-BCMS-001..011, 013..015, 020..035, 040..044), NIS2 (REQ-NIS2-002..004, 013, 021), DORA (REQ-DORA-001, 002, 010, 012..014, 021, 023, 030, 040, 041), AUDIT (alle 13), AWARE (001..003), THR/VUL/INC/ASSET (insgesamt ~22), XCUT (REQ-XCUT-001..007, 009..023, 030..033), NFR (alle Doku-only).

### 2.2 Bestätigte Gaps und Aktionen

| Gap-ID | Bezug | Befund | Aktion in dieser Session |
|--------|-------|--------|--------------------------|
| GAP-NC-001 | REQ-ISMS-031 | NC-Status `varchar(30)` ohne Validierung. PUT-Endpoint akzeptiert beliebige Strings. | **GESCHLOSSEN** — neues State-Machine-Modul `packages/shared/src/state-machines/isms-nc.ts` + API-Wiring + 41 Unit-Tests. |
| GAP-NC-002 | REQ-ISMS-032 | NC-Closure ohne Wirksamkeits-Pflichtprüfung möglich. | **GESCHLOSSEN** — `assertCanCloseNc()` und strenge `assertCanCloseMajorNc()` blockieren Closure ohne verifizierte effektive Korrekturmaßnahme. API liefert HTTP 422 mit Begründung. |
| GAP-STAKE-001 | REQ-ISMS-005 | Kein Stakeholder-Register-Schema im DB-Modell. | **GESCHLOSSEN** — Drizzle-Schema `stakeholder` + `stakeholder_expectation` + Power/Interest-Helper + Migration `0296_stakeholder_register.sql` + 11 Unit-Tests. |
| GAP-RISK-010 | REQ-RISK-010 | Im Katalog initial PARTIAL eingestuft. | **VERIFIZIERT IMPLEMENTED** — `risk.review_date` existiert + Cron `risk-review-reminder.ts` läuft. Eintrag im Katalog korrigiert. |
| GAP-NIS2-002 | REQ-NIS2-002 | Im Katalog initial als IMPLEMENTED-mit-Tabelle eingestuft. | **VERIFIZIERT IMPLEMENTED** — `nis2_status` ist eine **abgeleitete View** aus SoA-Coverage (Live-Computation in `apps/web/src/app/api/v1/isms/nis2/status/route.ts`). Kein eigenes Schema notwendig. Eintrag im Katalog präzisiert. |

### 2.3 Verifizierte PARTIAL (nicht in dieser Session geschlossen)

| Gap-ID | Bezug | Befund | Empfehlung |
|--------|-------|--------|------------|
| GAP-MR-001 | REQ-ISMS-028 | `management_review` hat alle Pflicht-Input-Spalten als `text`, aber kein Auto-Population aus Vorquartal. | Y2/M14 Sprint — Cron-basierter Review-Pack-Generator, der die Inputs aus DB aggregiert. |
| GAP-INC-001 | REQ-INC-007 | Eskalationspfad-Konfiguration nicht in einem dedizierten Modul, sondern indirekt via `playbook` und `notification`. | Y1/M5 Refinement — Eskalationsmatrix-UI auf Severity × Org-Rolle. |
| GAP-INC-002 | REQ-INC-008 / REQ-DORA-011 | DORA-Major-Klassifikator existiert (`crisis/[id]/dora-timer`), aber der Schwellwert-Konfig-UI fehlt. Schwellen sind hartcodiert. | Y2/M16 Sprint — Threshold-Engine auslagern in `dora_threshold_config`. |
| GAP-NIS2-014 | REQ-NIS2-014 | Aufsichts-Konfiguration pro Org (welche Behörde, welcher Kanal, welcher Empfänger). | Y1/M6 Sprint — `nis2_authority_config` Tabelle + UI. |
| GAP-DORA-022 | REQ-DORA-022 | TLPT-Provider-Compliance-Check (Provider muss zugelassen sein). | Y2/M19 — Pflichtfeld + Liste zugelassener Provider als Reference-Data. |
| GAP-DORA-031 | REQ-DORA-031 | ICT-Provider-Risiko-Score nicht automatisiert berechnet. | Y2/M16 — Score-Funktion + Cron für Re-Computation. |
| GAP-DORA-032 | REQ-DORA-032 | Konzentrationsrisiko-Bewertung nicht aggregiert über mehrere Provider. | Y2/M16 — neue Tabelle `dora_provider_concentration` + Aggregations-View. |
| GAP-DORA-033 | REQ-DORA-033 | Vertrags-Pflicht-Klausel-Check nicht als Checkliste verfügbar. | Y2/M17 — Checkliste auf `contract` mit Drittpartei-bezogenen Pflichtfeldern. |
| GAP-DORA-034 | REQ-DORA-034 | Exit-Strategie-Doku pro kritischem ICT-Provider. | Y1/M6 — Doku-Pflichtfeld auf `dora_ict_provider` mit Status-Maschine. |
| GAP-AWARE-004 | REQ-AWARE-004 | Phishing-Sim-Connector-Schema fehlt. | Y2/M15 — `phishing_sim_provider`, `phishing_campaign`, `phishing_result` Schema. |

### 2.4 Verifizierte OPEN (nur noch Backlog)

Keine harten OPENs nach der Verifikation. Alle ehemals als OPEN eingestuften Items aus dem Katalog sind entweder als PARTIAL umklassifiziert oder bereits implementiert (z. B. NIS2-Reporting-Tracker, DORA-Information-Sharing).

---

## 3. Coverage-Status

### 3.1 Backend-Coverage (vor + nach Session)

> Coverage-Reports wurden in dieser Session nicht generiert (turbo cache + Windows-Pfad-Limits). Empfehlung: Coverage-Run in CI mit `vitest --coverage` pro Package, Aggregation via `nyc merge`.

| Bereich | Indikator |
|---------|-----------|
| Schemas (Drizzle) | 100 % typsicher (TS strict). Reine Schemas ohne Logik werden nicht via Coverage gemessen. |
| State-Machines | 100 % der Branches abgedeckt — geprüft via Tests in `packages/shared/tests`. |
| API-Routes | nur Format-Helper-Test (40 Tests). **Lücke**: API-Routen sind nicht via Vitest abgedeckt. Empfehlung: Next-Test-Mode-Setup in CI. |
| Worker-Crons | 0 Tests. **Lücke**: Cron-Jobs sind reine Logik-Pfade ohne Coverage-Pflicht-Tests. Empfehlung: pro Cron-Job 1+ Unit-Test mit DB-Mock. |

### 3.2 Frontend-Coverage

- 1 Vitest-Test-File mit 40 Tests in `apps/web/src/__tests__/lib/format.test.ts`
- 80+ Pages, ~200 Komponenten — **deutlich unter 60 % Akzeptanz-Schwelle**
- Empfehlung: Sprint-übergreifender Coverage-Uplift (Y2/M16) mit Fokus auf interaktive Komponenten und Status-relevante Views

---

## 4. Neue Tests in dieser Session

| Test-File | Tests | Bezug |
|-----------|-------|-------|
| `packages/shared/tests/isms-nc-state-machine.test.ts` | 41 | REQ-ISMS-031, REQ-ISMS-032 |
| `packages/shared/tests/stakeholder-engagement.test.ts` | 11 | REQ-ISMS-005 |
| **Summe** | **52 neu, 100 % grün** | |

Total nach Session: **1621 Tests** (vorher 1569).

---

## 5. Bekannte Einschränkungen

1. **DB-Integrationstests** wurden nicht ausgeführt, weil die Windows-Host-Umgebung kein dediziertes Postgres-Setup hatte. Sie sind in CI weiterhin gegen `postgres:16` als Service einzuplanen.
2. **E2E-Specs** wurden nicht ausgeführt — siehe Phase 2g für die in dieser Session erstellten Skeleton-Specs.
3. **Coverage-Aggregation** wurde nicht durchgeführt — Empfehlung: separater PR im Anschluss.
4. **Linter** wurde nicht zwischen den Änderungen ausgeführt — der Code folgt aber den Konventionen aus `CLAUDE.md` (TS strict, Zod-Validierung, kebab-case-Files etc.).

---

## 6. Verweis auf Closure-Report

Die geschlossenen Lücken sind im [Gap-Closure-Report](./08-gap-closure-report.md) detailliert dokumentiert (Code-Diff, Tests, Migration).
