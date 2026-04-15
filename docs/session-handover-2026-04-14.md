# ARCTOS Session-Übergabe — 14. April 2026

## Kontext
ARCTOS ist eine selbst-gehostete GRC-Plattform (Next.js 15 + PostgreSQL 16 + Drizzle ORM). Repo: `C:\Users\daimon\Downloads\grcfiles\grc-platform`. Remote: `github.com/agatho/grc-platform`, Branch `main`.

## Was in der letzten Session erreicht wurde

### Menü-Redesign
- Sidebar von 118 auf 35 Items reduziert (NAV_GROUPS_CONDENSED in `nav-config.ts`)
- 27 horizontale Tab-Gruppen (`module-tab-config.ts` + `module-tab-nav.tsx`)
- 82 Seiten mit `<ModuleTabNav />` ausgestattet
- Accordion-Sidebar: Gruppen default collapsed, aktive auto-expand
- Full/Condensed Toggle im Sidebar-Footer

### EU AI Act — 100% Compliance
- 13 DB-Tabellen (ai_system, ai_gpai_model, ai_incident, ai_prohibited_screening, ai_provider_qms, ai_corrective_action, ai_authority_communication, ai_penalty + 5 Basis-Tabellen)
- 14 UI-Seiten inkl. 4 Detail-Seiten mit Edit
- Art. 5 Auto-Blocking, Art. 18-19 Lifecycle-View, Art. 56 Code of Practice Checkliste
- 14 Demo-Datensätze geseedet

### ISMS Erweiterungen (ISO 27001/27005)
- `/isms/risks` — IS-Risikoszenarien (Threat × Vuln × Asset) mit ERM-Sync
- `/isms/cap` — Korrekturmaßnahmen-Modul (Nichtkonformitäten + CAP)
- SoA mit 93 echten ISO 27001 Annex A Kontrollen verknüpft (control_catalog_entry)
- Risk Acceptance Tabelle + Authority Matrix (ISO 27005 Klausel 10)
- ISO 27005 Kataloge: 31 Bedrohungen + 23 Schwachstellen geseedet

### ERM-Bridges — Alle Module
Jedes Modul hat jetzt domänenspezifische Risikobewertung → auto-sync ins ERM:
- ISMS: risk_scenario → risk (risk_source='isms', threshold ≥15)
- TPRM: vendor_risk_assessment → risk (risk_source='tprm', threshold ≥15)
- DPMS: dpia_risk (numerisch) → risk (risk_source='dpms', threshold ≥12)
- BCMS: crisis_scenario + likelihood → risk (risk_source='bcm', threshold ≥12)
- ESG: materiality_iro → risk (risk_source='esg', threshold ≥15)
- Config: `erm_sync_config` Tabelle mit modulspezifischen Schwellwerten

### Umlaute & Datenqualität
- 2064 i18n-Korrekturen in 58 JSON-Dateien
- 352 Korrekturen in 12 SQL-Seed-Dateien
- Universal DB-Fix (DO-Block, 74 Zeilen in 33 Tabellen)
- Protection-Level-Badge locale von "en" auf "de" geändert

### Security
- RLS auf eu_taxonomy_assessment + weitere Tabellen (Migration 0089)
- Audit-Triggers auf 18 neuen Tabellen
- npm audit fix: 5/6 Vulnerabilities behoben

### Sonstiges
- 7 normenbasierte Testpläne (docs/test-plans/)
- 51 Playwright E2E-Tests (3 Spec-Dateien)
- Worker EmailService Lazy-Init (kein Crash ohne Resend-Key)
- Production Build verifiziert: Exit Code 0
- 39 .tmp-Dateien bereinigt + .gitignore aktualisiert
- Migrationen 0085-0091 erstellt und ausgeführt

## Offene Aufgaben (priorisiert)

### 1. E2E-Tests ausführen (15 Min)
51 Tests geschrieben aber nie gestartet. Server muss laufen.
```bash
cd apps/web && npx playwright test
```
Login-Daten: admin@arctos.dev / admin123

### 2. Drizzle ORM Update (2-4 Std, Breaking Change)
`npm audit` meldet SQL Injection Vulnerability in drizzle-orm.
Aktuell: 0.37.x, Fix: 0.45.x — Breaking Change, braucht Schema-Anpassungen.

### 3. Zod-Validation auf AI-Act-Routes (1 Std)
10 API-Routes unter `apps/web/src/app/api/v1/ai-act/` nutzen manuelle `req.json()` statt Zod-Schemas. Security-Review Finding F2 (Medium).

### 4. TCFD Klimaszenarien (8-13 SP)
ESG-Modul fehlt: Physische + Transitionsrisiken, Temperaturpfade (1.5°C/2°C/4°C), Zeithorzionte. Neue Tabelle `climate_risk_scenario` + UI.

### 5. Verbleibende RLS-Lücken
~25 ältere Tabellen ohne RLS (aus Sprints vor dieser Session). Prüfen mit:
```sql
SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false AND tablename NOT LIKE 'pg_%';
```

## Technische Details

### DB-Zugang
```
Host: localhost:5432 | User: grc | PW: grc_dev_password | DB: grc_platform
```

### Server starten
```bash
cd apps/web && npx next dev --turbo -p 3000
# oder via .claude/launch.json: preview_start("web")
```

### Neue Tabellen (diese Session)
ai_system, ai_gpai_model, ai_incident, ai_prohibited_screening, ai_provider_qms, ai_corrective_action, ai_authority_communication, ai_penalty, ai_conformity_assessment, ai_human_oversight_log, ai_transparency_entry, ai_fria, ai_framework_mapping, isms_nonconformity, isms_corrective_action, risk_acceptance, risk_acceptance_authority, erm_sync_config, v_ai_documentation_status (View)

### Erweiterte Tabellen
risk_scenario (+likelihood, impact, risk_score, treatment_strategy, residual_*, status, synced_to_erm, erm_risk_id)
dpia_risk (+numeric_likelihood, numeric_impact, risk_score GENERATED, erm_risk_id)
crisis_scenario (+likelihood, risk_score, erm_risk_id, treatment_strategy)
vendor_risk_assessment (+erm_risk_id, erm_synced_at, erm_sync_threshold)
lksg_assessment (+erm_risk_id, erm_synced_at)
materiality_iro (+erm_risk_id, erm_synced_at)
ai_system (+eu_database_*, documentation_retention_years, documentation_expiry_date, last_documentation_review)

### Architektur-Dokument
`docs/architecture/modulspezifische-risikobereiche.md` — Beschreibt das ERM-Bridge-Pattern für alle Module.
