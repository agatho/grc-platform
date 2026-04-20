# Assessment-Plan-Initiative — Master Plan

**Status:** Iteration 1 von N · **Start:** 2026-04-18 · **Owner:** @agatho

Ziel: Fuer ISMS, BCMS, DPMS und AI-Act-Modul je einen vollstaendigen
Assessment-Zyklus definieren, der den Rigor des Audit-Moduls erreicht.
Jedes Modul bekommt ein End-to-End-Design von "Setup" bis "Report" mit
allen beteiligten Entitaeten, Workflow-States, Integrationen und
Compliance-Mapping.

## Referenz-Modell: Audit-Modul

Das Audit-Modul (Sprint 8, ~25 Entitaeten) dient als Template. Es hat
sieben Layer, die wir pro Modul spiegeln:

| Layer         | Audit-Entitaeten                                                                       | Zweck                                       |
| ------------- | -------------------------------------------------------------------------------------- | ------------------------------------------- |
| 1. Strategic  | `audit_universe_entry`, `audit_plan`, `audit_plan_item`                                | Risk-based multi-year planning              |
| 2. Execution  | `audit`, `audit_activity`, `audit_checklist`, `audit_checklist_item`, `audit_evidence` | Concrete engagement                         |
| 3. Quality    | `audit_wp_folder`, `audit_working_paper`, `audit_wp_review_note`, `audit_qa_review`    | Evidence provenance + peer-review           |
| 4. Resources  | `auditor_profile`, `audit_resource_allocation`, `audit_time_entry`                     | Capacity planning                           |
| 5. Continuous | `continuous_audit_rule`, `continuous_audit_result`, `continuous_audit_exception`       | Automated monitoring between formal audits  |
| 6. Analytics  | `audit_analytics_template`, `audit_analytics_result`, `audit_risk_prediction`          | Data-driven risk scoring                    |
| 7. External   | `external_auditor_share`, `external_auditor_activity`                                  | 3rd-party read-access with time-boxed scope |

**Integration mit anderen Modulen**:

- **ERM**: Findings → `risk` via `finding.riskId` + `risk_treatment` sync (Audit-ERM-Feedback-Loop, Iter 1-3)
- **ICS**: Findings sind shared entity; Audit-Checklists koennen `control` referenzieren
- **Catalogs**: `auditUniverseEntry` → Framework-Kataloge (IIA Standards, COSO, ISO 27001)
- **Work-Item**: Jede Audit-Action wird via `work_item` track-/assign-bar

## Zielbild fuer die 4 Module

| Modul      | Framework                            | Entitaeten (ca.) | Schwerpunkt                                                                       |
| ---------- | ------------------------------------ | ---------------- | --------------------------------------------------------------------------------- |
| **ISMS**   | ISO 27001 + NIST CSF 2.0 + ISO 27005 | ~30              | Control-Maturity, Risk-Treatment-Loop, SoA                                        |
| **BCMS**   | ISO 22301                            | ~15              | BIA, Continuity-Strategies, Exercises, RTO/RPO                                    |
| **DPMS**   | GDPR Art. 5-49 + TOMs                | ~20              | RoPA, DPIA, DSR, Breach-Notification                                              |
| **AI-Act** | EU 2024/1689                         | ~14              | Classification (High-Risk vs GPAI), Conformity-Assessment, Post-Market-Monitoring |

**Shared Cross-Cutting**:

- **Risk-Integration**: Jedes Assessment kann Risks erzeugen oder updaten (ERM-Feedback-Loop als Muster)
- **Evidence-Pool**: `evidence`-Tabelle wird modul-uebergreifend genutzt (ein Evidence-Artifact kann einem ISMS-Control, einem Audit-Finding UND einem DPIA-Risk attached sein)
- **Findings**: Shared entity, `finding.moduleSource` diskriminiert
- **Framework-Mapping**: 401 Cross-Framework-Mappings erlauben "ein Assessment zaehlt fuer mehrere Compliance-Frameworks"

## Standard-Workflow-Schablone (fuer alle 4 Module)

### Phase 1 — SETUP (Pre-Assessment)

**Trigger**: Legal-/Management-Requirement, Wiederkehrend, Incident-Follow-up
**Outputs**: Scope-Statement + Team + Timeline
**Entities**:

- `scope_definition` (modul-spezifisch: asset-list, processing-activity-list, ai-system-list, critical-process-list)
- `{module}_plan` (analog audit_plan)
- Team-Zuweisung via `user_organization_role`

### Phase 2 — FRAMEWORK-SELECTION

**Trigger**: Setup abgeschlossen
**Outputs**: Gewaehlte Kontrollkataloge + SoA-Basis
**Entities**:

- `org_active_catalog` (bereits vorhanden)
- `soa_entry` oder Modul-Aequivalent (`applicability_matrix`)
- `org_risk_methodology` (fuer Risk-Bewertung)

### Phase 3 — ASSESSMENT-EXECUTION

**Trigger**: Framework-Auswahl abgeschlossen
**Outputs**: Evaluation-Ergebnisse pro Kontrolle/Anforderung
**Entities**:

- `{module}_assessment_run` (Meta)
- `{module}_control_eval` oder `{module}_requirement_eval` (pro Item)
- `evidence` (gesammelt pro Eval)
- `interview_note` (optional)
- `checklist_instance` (aus Phase 3 Schema-Phase)

### Phase 4 — GAP-ANALYSIS

**Trigger**: Assessment-Execution >= 80 % Coverage
**Outputs**: Maturity-Score + Gap-List + Risk-Einschaetzung
**Entities**:

- `control_maturity`
- `finding` (fuer identifizierte Gaps)
- `risk` (fuer high-severity Gaps, via ERM-Sync)
- `gap_analysis_report` (aggregierter Output)

### Phase 5 — RISK-TREATMENT

**Trigger**: Gap-Analysis abgeschlossen
**Outputs**: Treatment-Plans mit Owner + Deadline + Budget
**Entities**:

- `risk_treatment`
- `risk_acceptance` (fuer bewusst akzeptierte Residual-Risks, via `risk_acceptance_authority`-Matrix)
- `task` (fuer operative Umsetzung)
- `grc_budget` / `grc_cost_entry` (Kosten-Tracking)

### Phase 6 — REPORTING

**Trigger**: Alle Treatments geplant
**Outputs**: Management-Report + optional Board-Report + Compliance-Proof
**Entities**:

- `{module}_report` (kann `narrative_instance` nutzen fuer generierten Text)
- `management_review` (ISO-spezifisch)
- `board_report` (fuer Board-Level-Escalation)
- `attestation_campaign` (fuer Acknowledgment durch Leitungsorgan)

### Phase 7 — FOLLOW-UP & REASSESSMENT

**Trigger**: Zyklisch (jaehrlich, halbjaehrlich) oder Event-getriggert
**Outputs**: Evidence of Improvement + Next-Cycle-Input
**Entities**:

- `{module}_corrective_action` (CAP)
- `reminder_rule` (automatisiert)
- Link zurueck auf `{module}_assessment_run` mit `previous_run_id`

## Session-Breakdown

Diese Initiative ist zu gross fuer eine Session. Plan:

| Session       | Inhalt                                 | Output                                            |
| ------------- | -------------------------------------- | ------------------------------------------------- |
| **1 (diese)** | Master-Plan + ISMS-Detail-Plan         | `00-master-plan.md`, `01-isms-assessment-plan.md` |
| 2             | BCMS Detail-Plan                       | `02-bcms-assessment-plan.md`                      |
| 3             | DPMS Detail-Plan                       | `03-dpms-assessment-plan.md`                      |
| 4             | AI-Act Detail-Plan                     | `04-aiact-assessment-plan.md`                     |
| 5             | Cross-Module-Integration-Doku          | `05-cross-module-integrations.md`                 |
| 6             | Prioritaets-Ranking + Sprint-Breakdown | `06-implementation-roadmap.md`                    |
| 7-N           | Implementation-Sprints                 | Code                                              |

## Bewertungsmatrix: Was fehlt heute, was gibt es schon

Fuer jedes Modul wird im Detail-Plan eine Matrix erstellt:

| Workflow-Phase | Entitaet           | Status | API-Route | UI-Page | Gap |
| -------------- | ------------------ | ------ | --------- | ------- | --- |
| Setup          | `scope_definition` | ❓     | ❓        | ❓      | tbd |
| ...            | ...                | ...    | ...       | ...     | ... |

Status-Werte:

- ✅ Implementiert + aktiv getestet
- 🟡 DB-Schema vorhanden, API teilweise
- 🟠 DB-Schema vorhanden, UI fehlt
- 🔴 Komplett offen

## Design-Prinzipien fuer alle Plaene

1. **Workflow-States explizit**: `draft → planned → in_progress → review → completed → archived`
   Alle Status-Transitionen mit Audit-Trail.

2. **Evidence-First**: Jede Behauptung (Control ist "implemented", Risk ist "mitigated", Breach ist "contained") braucht Evidence-Attachment.

3. **RLS + audit_trigger by default**: Jede neue Tabelle bekommt `org_id` + RLS-Policy + Hash-Chain-Trigger (via 0105-Template).

4. **Catalog-Driven**: Kontroll-/Requirement-Listen kommen aus aktivierten Katalogen, nicht hardcoded.

5. **Cross-Framework-Mapping nutzen**: Ein ISO-27001-Assessment zaehlt auch fuer NIS2, via `catalog_entry_mapping`.

6. **API-Muster**:
   - `POST /api/v1/{module}/assessments` → neuer Run
   - `POST /api/v1/{module}/assessments/{id}/items` → Items aus Katalog/Scope generieren
   - `PATCH /api/v1/{module}/assessments/{id}/items/{itemId}` → Bewertung erfassen
   - `POST /api/v1/{module}/assessments/{id}/finalize` → Report + Findings + Treatments auslosen
   - `GET /api/v1/{module}/assessments/{id}/report` → Report-JSON mit allen Aggregaten

7. **Mutations per Middleware-Chain**:
   `requireAuth → requireModule → orgContext → requireRole → Zod → handler`

8. **Reports sind derived**: Kein dupliziertes State in `*_report`, sondern Snapshot-JSON mit Generierungs-Zeit + Source-Refs.

## Referenz-Kataloge pro Modul

| Modul  | Pflicht-Kataloge                            | Optional-Kataloge                                        |
| ------ | ------------------------------------------- | -------------------------------------------------------- |
| ISMS   | ISO 27001 Annex A, ISO 27002, NIST CSF 2.0  | BSI Grundschutz, TISAX, CIS IG1, ISO 27005 Threats/Vulns |
| BCMS   | ISO 22301, Crisis-Scenario-Templates        | DORA Art. 11-12 Overlay                                  |
| DPMS   | GDPR Art. 5-49, TOMs Art. 32, DPIA-Criteria | GDPR Data Categories + Legal Bases                       |
| AI-Act | EU AI Act 2024/1689                         | ISO 42001, NIST AI RMF                                   |

## Gueltigkeits-Scope

Diese Plaene gelten **fuer Tenant-Assessments innerhalb von ARCTOS** --
also was ein Tenant (z. B. CWS Haniel) fuer sich selbst durchfuehrt.
**NICHT** beschrieben: Assessments der ARCTOS-Plattform selbst durch
externe Auditoren (das waere eine Meta-Ebene).
