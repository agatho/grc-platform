# Cross-Module Integrations — Assessment-Plan-Initiative

**Status:** Draft · **Owner:** @agatho · **Begleitdoku:** [00-master-plan.md](./00-master-plan.md)

## Zweck

Die 4 Module (ISMS, BCMS, DPMS, AI-Act) haben signifikante Ueberlappung.
Dieses Dokument definiert die **offiziellen Integrations-Patterns**, um
Duplikation zu vermeiden und Konsistenz zu garantieren.

## 1. Shared Entities (cross-module)

### 1.1 Finding (shared entity, bereits implementiert)

Eine zentrale `finding`-Tabelle mit `source`-Discriminator:

| source-Wert | Ursprungs-Modul | Use-Case |
|---|---|---|
| `audit_execution` | Audit | Finding aus Audit-Checklist |
| `audit_sampling` | Audit | Exception aus audit_sample |
| `isms_assessment` | ISMS | Ineffective-Control aus assessment_control_eval |
| `isms_control_test` | ISMS | Failed Control-Test |
| `bcms_exercise` | BCMS | Lesson/Issue aus bc_exercise |
| `bcms_crisis` | BCMS | Post-Mortem-Finding aus crisis_log |
| `dpms_dpia` | DPMS | Unmitigierte DPIA-Risk |
| `dpms_breach` | DPMS | Breach-Finding |
| `aiact_incident` | AI-Act | AI-Incident-Finding |
| `aiact_oversight` | AI-Act | Systematisches Oversight-Problem |
| `regulatory_change` | Regulatory | Pending-Regulatory-Change-Finding |

**Empfehlung**: `finding.source`-Spalte ergaenzen (heute schon teilweise
implementiert). Bei Queries immer mit orgId + source-Filter.

### 1.2 Risk (ERM-zentral)

Alle Module schieben Risks in die zentrale `risk`-Tabelle via
`erm_sync_config` (Phase-3 neu). Diskriminiert via `risk.category`:

| category | Quell-Modul |
|---|---|
| `operational` | ISMS/BCMS allgemein |
| `cybersecurity` | ISMS |
| `business_continuity` | BCMS |
| `data_protection` | DPMS |
| `ai_act` | AI-Act |
| `compliance` | Querschnitt |
| `strategic` | Board-level |
| `reputational` | Querschnitt |
| `financial` | FAIR-quantifiziert |

**Pattern**: Modul triggert Risk-Create ueber standardisierte Helper-
Funktion `createOrUpdateLinkedRisk(source_module, source_id, category,
riskData)`. Duplikate werden per (orgId, source_module, source_id)
UNIQUE-Key verhindert.

### 1.3 Evidence (shared file-pool)

Jedes Modul kann Evidence attachen:

```
evidence (existing control.ts)
  ↕
  - auditEvidence
  - assessmentControlEval.evidenceDocumentIds
  - dpiaMeasure.evidence_document_ids
  - ai_conformity_assessment.evidence_documents
  - bia_assessment.evidence_attachments
```

**Empfehlung**: Evidence-Pool als zentraler `document` (category='evidence')
mit polymorphem `evidence_link`-Join-Table:

```
evidence_link
  - evidence_id (FK document)
  - entity_type (e.g. 'assessment_control_eval')
  - entity_id
  - module_source
```

Das ersetzt die UUID-Array-Spalten + macht Evidence-Multi-Use transparent.
**Status**: Nicht implementiert, als Iter-2-Arbeit vormerken.

### 1.4 Work-Item (cross-module Task-Wrapper)

Jede aktionable Entity kann in `work_item` gewrappt werden:

| Work-Item-Type | Quell-Entity |
|---|---|
| `audit_finding` | `finding` (source='audit*') |
| `risk_treatment` | `risk_treatment` |
| `corrective_action` | `isms_corrective_action` |
| `dsr_task` | `dsr` (fuer DPMS-Coordination) |
| `breach_response` | `data_breach` |
| `ai_incident_response` | `ai_incident` |
| `bc_exercise_lesson` | `bc_exercise_lesson` |

**Pattern**: Neuer Workflow-Step-Completion muss immer ein `work_item`
haben fuer Assignment + Tracking.

### 1.5 Evidence-Pack (Module-Reports-Meta)

Jedes Modul generiert bei finalisierten Assessments ein Evidence-Pack
(siehe je-Modul-Abschnitt 9 in den 01-04 Dokumenten).

**Pattern**: `POST /api/v1/{module}/evidence-pack` erzeugt neuen
`document` mit category='evidence_pack' + category_subtype='{module}'.

Cross-Module-Zertifizierung: Tenant kann bei integriertem Audit mehrere
Evidence-Packs bundeln (ISMS + BCMS + DPMS als ein Kombi-Pack fuer
ISO 27001 Audit das BCMS + DPMS als Teil des ISMS auditiert).

## 2. Cross-Framework-Mappings (401 bestehend)

Via `catalog_entry_mapping` (bereits Phase-3) + Matrix:

### 2.1 Kern-Mappings (aktuell)

| Source | Target | Count | Semantik |
|---|---|---|---|
| ISO 27001 Annex A | ISO 27002 | 93 | 1:1 Equivalent (ISO-selbst definiert) |
| BSI Grundschutz | ISO 27001 | 64 | Kreuzreferenztabelle |
| TISAX | ISO 27001 | 44 | VDA ISA basiert auf ISO |
| NIS2 | ISO 27001 | 33 | Regulatorisch → Control |
| DORA | ISO 27001 | 25 | Finanzsektor-Overlay |
| COSO | COBIT | 24 | Governance-Alignment |
| GDPR Art. 32 | TOMs | 23 | Requirements → Measures |
| NIST CSF | ISO 27002 | 89 | Cross-Framework existing |
| ISO 22301 | ISO 27001 | 6 | BCMS als Teil ISMS |

### 2.2 Zu ergaenzende Mappings (fuer Assessment-Plan-Initiative)

- **ISO 22301 ↔ DORA Art. 11-12** (Finanzsektor-BCMS) — ca. 15 Mappings
- **GDPR ↔ AI-Act Art. 27 FRIA** (FRIA-Inhalte overlappen DPIA) — ca. 10 Mappings
- **ISO 42001 ↔ EU AI Act** (wenn ISO 42001 Catalog hinzugefuegt wird) — ca. 40 Mappings
- **NIST AI RMF ↔ EU AI Act** — ca. 25 Mappings

**Impact**: Ein Tenant der ein AI-Act-Compliance-Assessment macht, kann
automatisch ISO 42001 + NIST AI RMF-Coverage nachweisen (Multi-Framework-
Certification, gleicher Effort).

## 3. Event-Flows zwischen Modulen

### 3.1 ISMS-Incident → BCMS-Crisis

```
security_incident.severity='critical'
  ↓ (Trigger-Worker)
crisis_log.auto_suggestion: "Activate BCMS?"
  ↓ (Admin-Confirmation)
crisis_log.status='activated'
  → BCP referenziert
```

**Entities involved**: `security_incident`, `crisis_log`,
`crisis_team_member`, `bcp`

**Config**: Optionaler `erm_sync_config` Eintrag mit
`auto_activate_crisis_on_critical_incident=true`.

### 3.2 ISMS-Incident → DPMS-Breach

```
security_incident.is_data_breach=true
  ↓ (Pre-existing in Schema)
data_breach-Record auto-erstellt
  - breach_category aus incident.affected data_categories
  - detected_at = incident.detected_at
  - affected_subjects_count_estimate = incident.affected_persons_count
  ↓
72h-Countdown startet
  ↓
data_breach_notification bei Threshold-Check
```

### 3.3 AI-Incident → DPMS-Breach (wenn Personal-Data)

```
ai_incident mit affected_persons_count > 0 AND Data-Category=personal
  ↓
data_breach auto-erstellt (Cross-Link via ai_incident.related_data_breach_id)
```

### 3.4 ISMS-Assessment → ERM-Risk-Sync

```
assessment_risk_eval mit decision='mitigate'
  ↓
risk-Tabelle: Update oder Create mit
  - source_module='isms_assessment'
  - source_id=assessment_risk_eval.id
  - severity aus residualLikelihood × residualImpact
  - category='cybersecurity' oder 'operational'
```

**Config**: Pro Org via `erm_sync_config.sync_enabled + score_threshold`.

### 3.5 DPIA-Measure → ISMS-Control

```
dpia_measure.measure_type='technical'
  ↓ (Manual-Link moeglich)
dpia_measure.linked_control_id → control
  ↓
Verdeckt das Control aus ISMS-SoA verbindlich zur DPIA-Action
```

### 3.6 AI-System → ISMS-Asset

```
ai_system ist Sub-Typ von asset:
  asset.type='ai_system' (in assetTypeEnum ergaenzen?)
  asset.ai_system_id (FK)
  ↓
Asset-Classification + CVE-Match wirkt auch auf AI-System
```

**Empfehlung**: `asset.asset_type='ai_system'` als neuer Wert. AI-System-
Inventory wird Teil des ISMS-Asset-Inventarys.

### 3.7 Regulatory-Change → Multi-Module-Triggers

```
regulatory_feed_item (aus Regulatory-Change-Modul)
  ↓ Auto-Classification
  ├─ GDPR-relevant → DPMS-Bulk-Review (TIA re-assess, AVV-update)
  ├─ AI-Act-relevant → AI-Act-Re-Classification
  ├─ ISMS-relevant → ISMS-Catalog-Update (SoA diff)
  └─ BCMS-relevant → BCMS-Plan-Update
```

**Empfehlung**: Neue `regulatory_impact_link` Tabelle, die
Feed-Items mit `trigger_actions` pro Modul verknuepft.

## 4. Unified-Dashboard-Komponenten

Ueber alle 4 Module hinweg sollte es aggregate Dashboards geben:

### 4.1 GRC-Executive-Dashboard

**Zweck**: Ein-Bild-Ueberblick fuer Vorstand/CEO/CISO

**Widgets**:
- **Compliance-Score-Composite**: gewichtet aus ISMS (30%) + DPMS (30%) + BCMS (20%) + AI-Act (20%)
- **Open-Findings-by-Module**: Stacked Bar, per Severity
- **Risk-Heatmap-Aggregate**: alle Risks across Module auf einer 5x5 Matrix
- **Next-30d-Deadlines**: aus compliance_calendar_event (Phase-3)
- **Budget-Utilization-by-Module**: grc_budget grouped
- **Incident-Timeline**: incidents aus allen Modulen

### 4.2 Compliance-Matrix-Dashboard

Framework-Coverage auf einen Blick:

| Framework | Covered | Open-Gaps | Last-Assessment | Next-Due |
|---|---|---|---|---|
| ISO 27001 | 85 % | 12 | 2025-10 | 2026-10 |
| ISO 27002 | 82 % | 18 | 2025-10 | 2026-10 |
| GDPR | 94 % | 4 | Continuous | n/a |
| NIS2 | 78 % | 16 | 2025-06 | 2026-06 |
| DORA | 80 % | 10 | 2025-12 | 2026-12 |
| ISO 22301 | 70 % | 8 | 2025-09 | 2026-09 |
| EU AI Act | 45 % | 24 | 2026-03 (initial) | 2026-09 |
| ESRS | 60 % | 12 | 2025-11 | 2026-11 |

### 4.3 Integrated-Risk-Register

Alle Risks (aus allen Modulen) in einer Ansicht:

- Filter: category, severity, status, owner, affected_entities
- Timeline: risk_assessment-history-chart
- Cross-Linking: Ein Risk kann ISMS-Control + BCMS-BCP + DPMS-DPIA-Measure als Treatments haben

### 4.4 Treatment-Portfolio-Dashboard

- Alle aktiven `risk_treatment`s quer
- Gantt-Chart pro Modul
- Budget-vs-Actual
- Blocked-By-Dependencies

## 5. Rollen-Model + Cross-Module-Berechtigungen

Erweiterter RBAC fuer Cross-Module-Workflows:

| Rolle | Standard-Module | Cross-Module-Rechte |
|---|---|---|
| `admin` | alle | alle |
| `risk_manager` (2nd-Line) | ERM, ISMS, BCMS, DPMS | Read all, Write ERM+Assessments |
| `dpo` (2nd-Line) | DPMS | Read ISMS (fuer TOMs), Read AI-Act (fuer FRIAs+Personal-Data) |
| `ciso` (virtual) | ISMS, BCMS, DPMS, AI-Act | Read-write all security-related |
| `ai_compliance_manager` | AI-Act | Read DPMS (fuer DPIA-Linkage), Read ISMS (Data-Governance) |
| `bcm_manager` | BCMS | Read ISMS (Incidents), Read DPMS (Breach-Impact) |
| `auditor` (3rd-Line) | Audit | Read all (mit time-box-Share) |

**Empfehlung**: Neue Rolle `ciso` als virtuelle Super-Role die Read-Write auf
alle 4 Sicherheits-Module hat (ohne Admin-Rechte wie Org-Management).

## 6. Cross-Module Certification-Paths

Mit geschickter Koordination kann ein Assessment-Zyklus mehrere
Zertifizierungen bedienen:

### 6.1 "Core GRC Bundle"

Ein gemeinsames Assessment fuer:
- ISO 27001 (ISMS)
- ISO 22301 (BCMS-als-Teil)
- GDPR-Compliance (DPMS-Continuous)

**Cross-Mapping**: 27001-Controls decken 22301-Anforderungen (6 Mappings)
und GDPR-Art-32-TOMs (23 Mappings). Integrated-Audit moeglich.

### 6.2 "Financial Services Bundle"

- ISO 27001
- DORA Art. 11-12
- NIS2
- GDPR

**Cross-Mapping**: 25 DORA-Mappings + 33 NIS2-Mappings + 23 GDPR-TOMs.

### 6.3 "AI-Ready Enterprise Bundle"

- ISO 27001
- ISO 42001 (AIMS, future)
- EU AI Act
- GDPR (DPIA + FRIA)

**Cross-Mapping**: AI-Act Cross-Mappings zu ISO/NIST noch zu ergaenzen
(Punkt 2.2 oben).

### 6.4 "ESG + Sustainability Bundle"

- ESRS / CSRD
- EU Taxonomie-Verordnung
- (Optional: ISO 27001 fuer ESG-Data-Security)

**Nicht in 4-Module-Scope**, aber Pattern gleich (Cross-Framework-Mapping).

## 7. API-Pattern: Integrated-Assessment-Endpoints

Neue Endpoint-Familie fuer Cross-Module-Operationen:

```
GET  /api/v1/integrated/compliance-score
     → Composite-Score + per-Module-Breakdown

GET  /api/v1/integrated/risk-register
     → All Risks across modules, with cross-cutting filters

GET  /api/v1/integrated/findings-register
     → All findings across modules

GET  /api/v1/integrated/treatment-portfolio
     → Active treatments across modules

GET  /api/v1/integrated/framework-coverage
     → Matrix Framework × Modul × Status

POST /api/v1/integrated/certification-bundle
     Body: { bundle: 'core_grc' | 'financial_services' | 'ai_ready' }
     Effekt: Erzeugt koordinierte Assessment-Runs in allen betroffenen
     Modulen mit Shared-Scope

GET  /api/v1/integrated/evidence-pack
     Body: { modules: ['isms','bcms','dpms'], year: 2026 }
     Effekt: Kombiniertes Evidence-Pack fuer Multi-Modul-Audit
```

## 8. Implementation-Prioritaet

Die Cross-Module-Integrationen sind **nicht Iter-1-Arbeit**, sondern
werden parallel zu den Modul-Iterationen nachgezogen:

| Priorisierung | Integration | Grund |
|---|---|---|
| **P0 (Iter 2+)** | Finding shared-entity mit source-Discriminator | schon teilweise da, muss komplett werden |
| **P0** | Risk-Sync ueber `erm_sync_config` | Phase-3 bereits, aber nicht fully connected |
| **P1** | Incident → Breach Auto-Trigger | Security-kritisch |
| **P1** | GRC-Executive-Dashboard | fuer Tenant-Onboarding-UX |
| **P2** | Evidence-Pool-Refactor (Join-Table) | Clean-Architecture |
| **P2** | Compliance-Matrix-Dashboard | fuer Sales + Auditor-Preps |
| **P3** | Certification-Bundle-API | fuer integrierte Audits |
| **P3** | AI-System als Asset-Sub-Type | Feature-Parity |
| **P4** | Regulatory-Change-Multi-Module-Triggers | nice-to-have, wenn Regulatory-Modul reifer ist |

## 9. Architektur-Entscheidungen (neue ADRs noetig)

Dieses Dokument triggert folgende ADR-Drafts:

- **ADR-026**: Finding-Source-Discriminator + Shared-Finding-Entity-Model
- **ADR-027**: Evidence-Pool-Architektur (polymorphes Join-Table)
- **ADR-028**: Event-Bus fuer Inter-Module-Events (Incident→Breach etc.)
- **ADR-029**: Compliance-Score-Composite-Formel (pro Framework + aggregiert)
- **ADR-030**: Integrated-Assessment-Run-Model (Multi-Module-Koordination)

## 10. Session-Outcome

**Dieses Dokument (Iter 1)**:
- ✅ Shared-Entity-Patterns (Finding, Risk, Evidence, Work-Item, Evidence-Pack)
- ✅ Cross-Framework-Mappings-Uebersicht mit Gap-Identifikation
- ✅ 7 Event-Flows dokumentiert (module → module)
- ✅ 4 Unified-Dashboard-Konzepte
- ✅ Erweiterte RBAC-Rollen-Matrix
- ✅ 4 Certification-Path-Bundles
- ✅ Integrated-API-Endpoints-Skizze
- ✅ 5 neue ADRs vorgeschlagen (026-030)

**Naechste Session**: Implementation-Roadmap mit Sprint-Breakdown
(06-implementation-roadmap.md).
