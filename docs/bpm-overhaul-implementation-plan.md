# ARCTOS BPM-Modul — Komplett-Überarbeitung Implementation-Plan

**Erstellt:** 2026-05-15
**Autor:** Cowork QA / Product
**Scope:** Vollständige Überarbeitung des BPM-Moduls zur tiefen GRC-Integration
**Status:** Vision + detaillierter Multi-Phasen-Plan
**Vorbedingung:** Wave 23 Beta-Blocker müssen geschlossen sein (Finding-FK-Persistenz, /admin/branding)

---

## Inhaltsverzeichnis

1. [Executive Summary](#1-executive-summary)
2. [Strategische Positionierung](#2-strategische-positionierung)
3. [IST-Stand der Plattform (Wave 47)](#3-ist-stand-der-plattform-wave-47)
4. [Markt-Benchmark](#4-markt-benchmark)
5. [SOLL-Vision](#5-soll-vision)
6. [Rollen-Anforderungen pro GRC-Rolle](#6-rollen-anforderungen-pro-grc-rolle)
7. [Architektur-Design](#7-architektur-design)
8. [Phasen-Roadmap (8 Phasen)](#8-phasen-roadmap-8-phasen)
9. [UI/UX-Plan](#9-uiux-plan)
10. [API-Plan](#10-api-plan)
11. [DB-Migrations-Plan](#11-db-migrations-plan)
12. [Test-Strategie](#12-test-strategie)
13. [Aufwand + Reihenfolge](#13-aufwand--reihenfolge)
14. [Risiken & Trade-offs](#14-risiken--trade-offs)

---

## 1. Executive Summary

Das aktuelle ARCTOS-BPM-Modul ist nach 47 Sprints ein **strukturell fast vollständiges** System: BPMN-Modellierung via `bpmn-js` 18.16, Process-Lifecycle-State-Machine (`draft → in_review → approved → published → archived`), Versionierung mit Diff, RACI-Matrix-Computing mit Overrides, Process-Mining-Pipeline (Event-Logs, Conformance, Bottlenecks), KPI-Tracking, Maturity-Assessment, und Simulation. Was im Schema bereits angelegt ist, aber **nicht funktional ausgelevelt** ist: die Cross-Module-Verlinkung zu Risk, Control, Document und Audit-Findings. Die Tabellen `processRisk`, `processControl`, `processDocument` existieren als Placeholders ohne FK-Constraints, ohne UI-Surface und ohne semantische Durchsetzung in den Workflows.

Diese Überarbeitung positioniert das BPM-Modul **nicht** als BPM-Engine-Konkurrenz zu Camunda oder Signavio, sondern als **„GRC-Native Process Knowledge Layer"** — eine Schicht in der jedes Prozess-Element (Activity, Lane, Pool, Event) tief in das Risk-Control-Audit-BCM-DPMS-Ökosystem eingebettet ist, mit RLS-getragener Multi-Tenant-Isolation, automatischen Compliance-Framework-Mappings (ISO 9001, 27001, 22301, NIS2, DORA, GDPR Art. 30) und Three-Lines-of-Defense-First-Class-Modellierung.

**Geschätzter Aufwand:** 8 Phasen über 12–16 Wochen, davon Phase 1–3 (Foundation + Wiring + Semantics) als Pilot-Critical-Path (~6 Wochen) absolut notwendig, Phase 4–8 als Iterations-Roadmap.

---

## 2. Strategische Positionierung

**Differenzierung gegenüber Marktführern:**

| Aspekt                                            | BIC (GBTec)                     | Aeneis            | Signavio          | ARCTOS-BPM (Ziel)                                                   |
| ------------------------------------------------- | ------------------------------- | ----------------- | ----------------- | ------------------------------------------------------------------- |
| Self-hosted multi-tenant                          | Cloud-Default, On-Prem aufpreis | Ja                | Nein (SAP Cloud)  | **Ja, von Anfang an**                                               |
| RLS auf jeder Cross-Module-Verlinkung             | Teil                            | Teil              | Teil              | **Hart erzwungen**                                                  |
| Hash-Chain Audit-Trail auf jeder Änderung         | Audit-Log                       | Audit-Log         | Audit-Log         | **SHA-256 chain, ISO 27001 A.18.1.3 / GoBD §147 / DSGVO Art. 5(2)** |
| Compliance-Profil-Switcher (ROPA, ISO 9001, NIS2) | Manuelles Mapping               | Manuelles Mapping | Manuelles Mapping | **Auto-derived aus den 46 Frameworks im Catalog**                   |
| Process Owner = First Line of Defense             | Implizit                        | Implizit          | Implizit          | **First-Class via ADR-007**                                         |
| KMU-tauglich                                      | Eher Enterprise                 | Eher Enterprise   | Enterprise-only   | **MitTelstand + Enterprise**                                        |
| Preis                                             | Hoch                            | Hoch              | Sehr hoch         | **Wettbewerbsfähig**                                                |
| Datensouveränität                                 | EU-Cloud                        | DACH              | US-Cloud          | **EU/DACH, self-hosted**                                            |

**Kern-Botschaft:** „Ein BPM-Tool das nicht den Prozess malt, sondern den **Prozess als GRC-Objekt** in sein Risiko-, Kontroll-, Audit-, BCM- und Compliance-Universum einbettet."

---

## 3. IST-Stand der Plattform (Wave 47)

### Was bereits funktioniert ✅

**DB-Schema:**

- `process` (Stammdaten + Lifecycle), `processVersion` (BPMN-XML + Diagram-JSON), `processStep` (Activity-Granularität)
- `processAsset` + `processStepAsset` (vollständige FK zu `asset`) ✅
- `processReviewSchedule` (automatische Review-Zyklen)
- `processComment` (Threaded Comments mit Mentions)
- Advanced: `processEventLog`, `processEvent`, `processConformanceResult`, `processMiningSuggestion`, `processKpiDefinition`, `processKpiMeasurement`, `processMaturityAssessment`, `valueStreamMap`, `processTemplate`

**API-Routes** (~45 Endpoints):

- CRUD, Versions, Compare, Restore
- State-Transitions mit Discovery
- Cross-Module-Linking (mit Caveats unten)
- RACI Matrix + Overrides + Export
- Walkthrough, Health, Validation
- Simulation (Scenarios, Compare)
- Bulk, Excel-Import, AI-Generate

**UI:**

- bpmn-js 18.16 als Editor
- Tree-Navigation (Hierarchie)
- Metro-Map-Visualization
- Detail-Page mit Tabs

**State-Machine:** Funktional über Discovery-Endpoint `/transitions`

### Was fehlt / placeholder / nicht funktional 🔴

| Lücke                                                                                   | Schweregrad | Ursache                                                 |
| --------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------- |
| **FK-Constraint fehlt** auf `processControl.controlId`                                  | P0          | Sprint 4 Placeholder, nie gehärtet                      |
| **FK-Constraint fehlt** auf `processDocument.documentId`                                | P0          | Sprint 4 Placeholder, nie gehärtet                      |
| **FK-Constraint fehlt** auf `processRisk.processId` und `processStepRisk.processStepId` | P0          | Schema-Drift                                            |
| **BIA ↔ Process Bidirektional-Navigation**                                              | P0          | BIA hat `processImpacts` als JSON ohne FK               |
| **DMS-Integration** für Policy/Doc-Attach pro Activity                                  | P0          | Endpoint existiert, UI fehlt komplett                   |
| **Cross-Module-UI-Surfacing** in Process-Detail-Page                                    | P0          | Tabs nicht angebunden                                   |
| **Risk-Heatmap-Overlay auf BPMN-Diagram**                                               | P1          | Nicht implementiert                                     |
| **RACM (Risk and Control Matrix) View**                                                 | P1          | Daten da, View fehlt                                    |
| **GDPR ROPA-Template als Prozess-Profile**                                              | P1          | Konzept fehlt                                           |
| **Three-Lines-of-Defense Markierung pro Lane/Activity**                                 | P1          | Nur global pro Rolle                                    |
| **Custom-Moddle-Extensions für `arctos:*` BPMN-Attribute**                              | P1          | XML-Persistence ohne GRC-Semantik                       |
| **Compliance-Framework-Mapping per Process**                                            | P2          | 46 Frameworks geseedet, aber nicht per Process verlinkt |
| **Process Mining auf produktive Daten**                                                 | P2          | Nur isolierte Test-Imports                              |
| **Quality-Manager Approval-Workflow**                                                   | P2          | Status existiert, Notifications fehlen                  |
| **Multi-Language Beschreibungen**                                                       | P3          | Nur via i18n-UI, nicht auf Datenebene                   |

---

## 4. Markt-Benchmark

### Marktführer (DACH GRC-BPM)

**GBTec BIC Platform** (Marktführer DACH): Bietet als modulare Suite BIC Process Design + BIC Risk + BIC Compliance + BIC GRC. Stärken: native Risk-Control-Attribute pro Activity, Multi-Level-Editorial-Workflow (Author → Examiner → Responsible), automatische RACI-Matrix, BPMN+EPK-Support. Schwäche: Cloud-First, On-Prem ist Aufpreis-Option.

**Aeneis von intellior**: Deutscher BPM-Anbieter mit starkem ISO-9001/27001-Fokus. Integrierte BCM/BIA-Felder, KI-Modellierungs-Assistent, mehrsprachig DACH-stark.

**SAP Signavio**: Cloud-only, tief im SAP-Stack integriert (RAM, Process Control). Process Intelligence (Mining) als Killerfeature.

**iGrafx**: US-Anbieter mit Process Mining + Conformance Checking als Hauptachse. Stark im SOX-Compliance-Bereich.

**ADONIS (BOC Group)**: Österreichischer Anbieter, kostenlose Community Edition, KI Process Extractor seit v18.0, starke Simulation.

### Open-Source-Stack

**bpmn-js (bpmn.io)** — bereits in ARCTOS: SVG-Renderer + Modeler, 40+ Module via DI, Custom-Elements via `moddle-extensions`. **Bleibt Foundation.**

**Camunda 8 / Flowable**: Echte Workflow-Engines mit User-Tasks, Forms, DMN. Nur einbinden falls Execution-Engine benötigt wird (Phase 8+). Für reine Doku-/Audit-Zwecke Overkill.

### Compliance-Standards-Mapping

| Standard                         | Verlangtes BPM-Feature                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| **ISO 9001** Qualitätsmanagement | Prozesslandkarte, Prozess-Owner, KVP-Schleife, RACI                                              |
| **ISO 27001** Annex A.5.30       | Prozess ↔ Risiko ↔ Control-Verlinkung, Risk Treatment Plan                                       |
| **ISO 22301** BCM                | BIA-Felder MTPD/RTO/RPO pro Prozess, Dependencies (Assets, People, Vendors)                      |
| **NIS2**                         | Identifikation kritischer Prozesse, Lieferketten-Prozesse, Change-Management mit Audit-Trail     |
| **DORA**                         | ICT-Risk pro kritischem Prozess, ICT-Provider-Mapping (Process→Asset→Vendor), Resilience-Testing |
| **GDPR Art. 30**                 | ROPA = strukturierte Prozessliste mit Zweck, Empfängern, Drittlands-Transfer, Löschfristen, TOMs |
| **GoBD**                         | Versionierte, freigegebene Verfahrens-Dokumentation mit Audit-Trail                              |
| **SOX § 404**                    | RACM mit Test-of-Design + Test-of-Operating-Effectiveness pro Prozess                            |

---

## 5. SOLL-Vision

Ein Prozess in ARCTOS ist nicht mehr nur eine BPMN-Zeichnung mit Owner und Status, sondern ein **GRC-Knoten** mit folgenden Dimensionen:

```
                          ┌───────────────────┐
                          │   Prozess (BPMN)  │
                          └─────────┬─────────┘
            ┌────────────────────┬──┴──┬────────────────────┐
            │                    │     │                    │
        ┌───▼───┐           ┌───▼─┐  ┌─▼────┐         ┌────▼────┐
        │ Risks │           │Ctrls│  │Assets│         │Documents│
        └───┬───┘           └───┬─┘  └───┬──┘         └────┬────┘
            │                    │      │                  │
            │   ┌────────────────┼──────┼──────────────┐  │
            │   │                │      │              │  │
        ┌───▼───▼┐         ┌─────▼──┐ ┌─▼────────┐  ┌─▼──▼─────┐
        │  BIA   │         │Audit-  │ │Compliance│  │Policies +│
        │MTPD/RTO│         │Findings│ │Frameworks│  │Verfahrens│
        └────────┘         └────────┘ └──────────┘  │  -doku   │
                                                    └──────────┘

       Bidirektionale Navigation + Aggregation auf Process-Ebene
       Hash-Chain auf jede Mutation + RLS pro Org
```

**Funktionale Anforderungen:**

1. **Pro Activity** im BPMN-Diagram kann der Process-Owner verknüpfen: 0..N Risiken, 0..N Controls, 0..N Dokumente, 0..N Assets, 0..N Findings, 0..1 BIA-Impact-Record, 0..1 RACI-Override, 0..1 Three-Lines-of-Defense-Marker.

2. **Heatmap-Overlay** auf BPMN-Diagram: Visualisierung von Risiko-Score (Inherent / Residual), Control-Effectiveness, Open Findings — toggle-bar pro Sicht.

3. **Compliance-Profil-Switcher**: GDPR-ROPA-View blendet Pflicht-Felder (Zweck, Empfänger, Drittlands-Transfer) ein. ISO 22301-BIA-View blendet MTPD/RTO/RPO ein. NIS2-View highlightet "Critical Process"-Flag.

4. **Cross-Module-Aggregation**: Risk-Heatmap aggregiert auf Process-Owner-Ebene, Control-Effectiveness rolliert auf Process-Maturity, Audit-Findings hängen am Process-Knoten.

5. **Approval-Pipeline mit Diff-View** wie BIC: Author → Reviewer → Quality Manager → Publish. Mit Hash-Chain-Anker pro Version.

6. **BIA ↔ Process Bidirektional**: In der BIA-Detail-Page Liste aller verknüpften Prozesse mit MTPD/RTO/RPO. In der Process-Detail-Page Liste aller BIAs die diesen Prozess als kritisch markieren.

7. **DMS-Integration**: Drag-Drop Policy/Verfahrens-Dokumentation auf Process oder Activity. Versions-Lock: wenn Process im Status `published` und Policy-Version sich ändert, automatisches Review-Reminder an Process-Owner.

8. **Three-Lines-of-Defense** als Diagram-Layer: Lane-Color-Coding 1st-Line (Operations), 2nd-Line (Risk/Compliance), 3rd-Line (Audit). Inheritance: Activity erbt 3LoD von Lane.

9. **Multi-Notation**: BPMN als Primary, EPK als Alternative im DACH-Markt. (Phase 6+, optional)

10. **AI-Assistent**: Text-zu-BPMN via Multi-Provider-Router. Risiken/Controls automatisch aus ähnlichen Prozessen vorschlagen.

---

## 6. Rollen-Anforderungen pro GRC-Rolle

ARCTOS hat 9 produktive GRC-Rollen. Jede hat eine eigene Sicht und Bedürfnis am BPM-Modul:

### 6.1 Process Owner (1st Line of Defense) — die Haupt-Persona

**Pain-Points heute:** Kann Prozess malen, aber keine Risiken/Kontrollen eigenständig verknüpfen. Risk-Erstellung war bis Wave 18 nicht erlaubt für eigene Prozesse.

**Anforderungen:**

- Eigene Prozesse anlegen, modellieren, in Review schicken
- Pro Activity: Risiko anlegen oder existierendes verlinken, Mitigationen vorschlagen
- KPIs definieren + Measurements eingeben
- Review-Erinnerungen empfangen + abarbeiten
- Diagram-Editor mit Auto-Save + Version-Push
- Mobile-View: Process-Karten + Notification-Eingang
- Walkthrough-View für Onboarding neuer Mitarbeiter
- Read-Access auf alle verknüpften Risk-/Control-/Asset-Details

### 6.2 Quality Manager (2nd Line)

**Anforderungen:**

- Process-Inventory-Dashboard (alle Prozesse im Org, gefiltert nach Status)
- Approval-Queue: Prozesse in `in_review` und `approved` (zur Publikation)
- Diff-View zwischen Versionen mit Inline-Kommentaren
- Compliance-Coverage: welche Prozesse sind ISO 9001-konform dokumentiert
- Review-Schedule-Übersicht (overdue Reviews)
- ISO-9001-Audit-Pack-Export: alle published Prozesse als ZIP mit PDF/A
- Multi-Language-Check: Beschreibungen DE+EN vorhanden?
- KVP-Statistik: wie viele Verbesserungs-Vorschläge pro Quartal

### 6.3 Risk Manager (2nd Line)

**Anforderungen:**

- **Process-Risk-Matrix-View**: alle Risiken aggregiert pro Prozess, mit Inherent- und Residual-Score
- **Process-Heatmap** als BPMN-Overlay: welche Activities tragen die größten Risiken
- Bulk-Linking: Risiko XYZ zu N Prozessen gleichzeitig zuordnen
- Cross-Process-Risiko-Analyse: dieser Risk wirkt auf N Prozesse → Treatment-Priorisierung
- Risk-Treatment ↔ Activity-Verknüpfung
- KRI-Dashboard pro Prozess-Owner-Department

### 6.4 Control Owner (1st Line)

**Anforderungen:**

- Welche Controls deckt mein Process-Portfolio ab
- Control-Coverage-View pro Activity (welche Activity hat 0 Controls, welche überdeckt)
- Pro Control: Liste der Prozess-Activities die diesen Control nutzen
- Test-of-Operating-Effectiveness: Control-Tests pro Activity mit Drill-down
- RACM-Matrix-Export (Risk and Control Matrix per Prozess)
- Control-Effectiveness-Rollup auf Process-Maturity

### 6.5 DPO (2nd Line, Datenschutz)

**Anforderungen:**

- **ROPA-View**: alle Prozesse als Art-30-Records mit Pflichtfeldern
- Pro Prozess: Datenverarbeitungs-Profile (Zweck, Rechtsgrundlage, Betroffenenkategorien, Datenkategorien, Empfänger, Drittlands-Transfer, Löschfristen, TOMs)
- DPIA-Trigger: wenn Process-Profile auf "high-risk" (Profiling, sensitive Kategorien, Drittlands-Transfer) → automatisch DPIA-Vorschlag
- Process-to-Document-Link: Datenschutz-Folgenabschätzung (DPIA), Datenschutz-Vereinbarungen (DPA), Auftragsverarbeitungsvertrag (AVV)
- DSR-Impact: bei einer Auskunfts-/Löschanfrage → Prozesse identifizieren die personenbezogene Daten verarbeiten

### 6.6 BCM Manager (2nd Line, Business Continuity)

**Anforderungen:**

- **BIA-Process-Bridge**: in einer BIA Liste der Prozesse mit Criticality-Ranking; pro Prozess MTPD/RTO/RPO setzen
- Dependency-Map: welche Assets, People-Roles, 3rd-Party-Vendoren stützen den Prozess
- Critical-Process-Flag mit Auto-Propagation in NIS2/DORA
- Disaster-Recovery-Test-Verknüpfung pro kritischem Prozess
- Process-Resilience-Score-Dashboard

### 6.7 Auditor (3rd Line)

**Anforderungen:**

- Read-Access auf alle published Prozesse + alle Versions-Historien
- Audit-Universe-Selection: Prozesse als Universe-Entities markieren
- Process-to-Finding-Drill: pro Audit-Activity Findings raisen die einen Prozess betreffen
- ISO-Audit-Pack-Export: pro Audit-Scope alle relevanten Prozesse als ZIP (PDF/A) mit Audit-Trail-Anhang
- Hash-Chain-Verification: Prozess-Version-Signatur prüfbar
- Stichproben-Walkthrough mit Auditor-Notes-Layer

### 6.8 CISO (2nd Line, Information Security)

**Anforderungen:**

- Information-Security-Risk-Heatmap pro Prozess
- ISO 27001 Annex-A-Mapping: welche A.5–A.18 Controls deckt der Prozess ab
- NIS2-Critical-Process-Dashboard
- Incident-Response-Process-View: bei einem Incident sofort den betroffenen Prozess + seine Dependencies sehen
- Asset-Process-Mapping für ICT-Inventar

### 6.9 Compliance Officer (2nd Line)

**Anforderungen:**

- Framework-Coverage pro Prozess: welche Standards deckt dieser Prozess ab
- Multi-Standard-Audit-Prep: ein Prozess kann gleichzeitig ISO 9001 + ISO 27001 + NIS2 dienen
- Compliance-Gap-Analysis: welche Standards-Anforderungen sind NICHT durch Prozesse dokumentiert
- Regulatory-Change-Impact: bei neuer Regulierung → welche Prozesse müssen angepasst werden

---

## 7. Architektur-Design

### 7.1 Data-Model-Erweiterungen

**Migration 0327: FK-Härtung der Placeholder-Tabellen**

```sql
-- processControl: controlId von uuid (no ref) auf FK
ALTER TABLE process_control
  ADD CONSTRAINT process_control_control_fk
  FOREIGN KEY (control_id) REFERENCES control(id) ON DELETE CASCADE;

ALTER TABLE process_step_control
  ADD CONSTRAINT process_step_control_control_fk
  FOREIGN KEY (control_id) REFERENCES control(id) ON DELETE CASCADE;

-- processDocument: documentId FK auf document
ALTER TABLE process_document
  ADD CONSTRAINT process_document_document_fk
  FOREIGN KEY (document_id) REFERENCES document(id) ON DELETE CASCADE;

-- processRisk: processId FK (falls fehlt)
ALTER TABLE process_risk
  ADD CONSTRAINT process_risk_process_fk
  FOREIGN KEY (process_id) REFERENCES process(id) ON DELETE CASCADE;

-- processStepRisk: processStepId FK (falls fehlt)
ALTER TABLE process_step_risk
  ADD CONSTRAINT process_step_risk_step_fk
  FOREIGN KEY (process_step_id) REFERENCES process_step(id) ON DELETE CASCADE;

-- Indexes pro FK für Aggregations-Queries
CREATE INDEX process_control_control_idx ON process_control(control_id);
CREATE INDEX process_document_doc_idx ON process_document(document_id);
CREATE INDEX process_step_risk_risk_idx ON process_step_risk(risk_id);
```

**Migration 0328: BIA-Process-Bridge**

```sql
-- BIA-Process-Bridge mit MTPD/RTO/RPO pro Prozess
CREATE TABLE bia_process_impact (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bia_id uuid NOT NULL REFERENCES bia(id) ON DELETE CASCADE,
  process_id uuid NOT NULL REFERENCES process(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organization(id),

  -- BCM-Kennzahlen pro Prozess in dieser BIA
  criticality bia_criticality_enum NOT NULL, -- low/medium/high/critical
  mtpd_minutes integer,        -- Maximum Tolerable Period of Disruption
  rto_minutes integer,         -- Recovery Time Objective
  rpo_minutes integer,         -- Recovery Point Objective
  mbco_description text,       -- Minimum Business Continuity Objective

  -- Impact-Profile
  financial_impact_eur numeric(20,2),
  reputational_impact_score integer,  -- 1-5
  operational_impact_score integer,   -- 1-5
  legal_impact_score integer,         -- 1-5

  -- Recovery-Strategie
  recovery_strategy text,
  alternative_processes_ids uuid[],   -- Backup-Prozesse

  scored_by uuid REFERENCES "user"(id),
  scored_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES "user"(id),

  UNIQUE (bia_id, process_id)
);

CREATE INDEX bia_process_impact_bia_idx ON bia_process_impact(bia_id);
CREATE INDEX bia_process_impact_process_idx ON bia_process_impact(process_id);
CREATE INDEX bia_process_impact_org_idx ON bia_process_impact(org_id);
```

**Migration 0329: Process-Finding-Link** (Direct, nicht nur via Control)

```sql
ALTER TABLE finding
  ADD COLUMN process_id uuid REFERENCES process(id),
  ADD COLUMN process_step_id uuid REFERENCES process_step(id);

CREATE INDEX finding_process_idx ON finding(process_id);
CREATE INDEX finding_process_step_idx ON finding(process_step_id);
```

**Migration 0330: Three-Lines-of-Defense pro Activity**

```sql
ALTER TABLE process_step
  ADD COLUMN line_of_defense lod_enum,  -- first/second/third/oversight
  ADD COLUMN raci_responsible_role_id uuid REFERENCES custom_role(id),
  ADD COLUMN raci_accountable_role_id uuid REFERENCES custom_role(id);

-- process_step erbt LoD von process.lane wenn nicht explizit gesetzt
```

**Migration 0331: GDPR-ROPA-Profile-Erweiterung**

```sql
-- ROPA-Profile als Erweiterung von process (Art. 30 Pflichtfelder)
CREATE TABLE process_ropa_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid UNIQUE NOT NULL REFERENCES process(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organization(id),

  -- Art. 30 (1) Pflichtfelder
  is_processing_activity boolean NOT NULL DEFAULT false,
  processing_purpose text,                            -- Zweck
  legal_basis gdpr_legal_basis_enum,                  -- Art. 6 + ggf. Art. 9
  legal_basis_detail text,
  data_subject_categories text[],                     -- Kategorien Betroffener
  personal_data_categories text[],                    -- Datenkategorien
  special_categories text[],                          -- Art. 9 sensitive Daten
  recipients text[],                                  -- Empfänger
  third_country_transfers boolean NOT NULL DEFAULT false,
  third_country_safeguards text,                      -- SCC, BCR, Adequacy
  retention_period_description text,                  -- Löschfristen
  retention_period_months integer,                    -- normalisiert
  tom_description text,                               -- Technisch-organisatorische Maßnahmen

  -- DPIA-Trigger
  requires_dpia boolean NOT NULL DEFAULT false,
  dpia_id uuid REFERENCES dpia(id),

  -- Joint Controller / Processor
  controller_org_id uuid REFERENCES organization(id),
  joint_controller_org_ids uuid[],
  processor_vendor_ids uuid[] REFERENCES vendor(id),  -- TOMs siehe AVV

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES "user"(id),
  updated_by uuid REFERENCES "user"(id)
);
```

**Migration 0332: Custom-Moddle-Attributes für BPMN-XML-Persistence**

Im BPMN-XML werden GRC-Properties via Custom-Moddle gespeichert:

```xml
<bpmn:userTask id="Task_1" name="Approve Order">
  <bpmn:extensionElements>
    <arctos:grcMetadata>
      <arctos:riskRefs>
        <arctos:riskRef id="<uuid>" inherentScore="12" residualScore="6"/>
      </arctos:riskRefs>
      <arctos:controlRefs>
        <arctos:controlRef id="<uuid>" effectiveness="effective"/>
      </arctos:controlRefs>
      <arctos:lineOfDefense>first</arctos:lineOfDefense>
      <arctos:raci responsible="user-uuid" accountable="user-uuid"/>
      <arctos:bcmKpi mtpd="240" rto="120" rpo="60"/>
    </arctos:grcMetadata>
  </bpmn:extensionElements>
</bpmn:userTask>
```

→ XML bleibt BPMN-2.0-interoperabel (externe Tools ignorieren `arctos:*`), aber re-import in ARCTOS rekonstruiert die Verknüpfungen.

### 7.2 Cross-Module-Aggregation-Patterns

**Process-Risk-Heatmap-Computation:**

```typescript
// GET /api/v1/processes/{id}/risk-heatmap
// Returns: { activities: [{ activityBpmnId, riskCount, maxInherent, maxResidual }] }

const heatmap = await db
  .select({
    activityBpmnId: processStep.bpmnElementId,
    riskCount: count(processStepRisk.riskId),
    maxInherent: sql`max(${risk.inherentScore})`,
    maxResidual: sql`max(${risk.residualScore})`,
  })
  .from(processStep)
  .leftJoin(processStepRisk, eq(processStep.id, processStepRisk.processStepId))
  .leftJoin(risk, eq(risk.id, processStepRisk.riskId))
  .where(eq(processStep.processId, processId))
  .groupBy(processStep.bpmnElementId);
```

**Process-Control-Coverage-Score:**

```typescript
// Pro Activity: hat sie einen Control mit effectiveness >= 'effective'?
// Process-Score = % Activities mit Control-Coverage
```

**RACM-Matrix-View:** Cross-Join `process_step × risk × control` mit Effektivitäts-Spalte; identisch zu SOX-Audit-RACM.

### 7.3 BPMN-Custom-Moddle Extensions

Neuer Modul in `apps/web/src/components/bpmn/`:

- `arctos-moddle-extension.json` (XSD-Style-Definition)
- `arctos-properties-provider.ts` (Custom Properties Panel)
- `arctos-overlay-renderer.ts` (Heatmap, Badge-Icons pro Activity)
- `arctos-context-pad.ts` (rechtsklick → "Risiko verknüpfen", "Control verknüpfen")

### 7.4 State-Machine-Erweiterungen

Aktuell: `draft → in_review → approved → published → archived`

Neu (mit Gates):

```
draft → in_review        [Gate: Process Owner gesetzt + min. 1 Activity]
in_review → approved     [Gate: Reviewer gesetzt + alle Activities mit Beschreibung]
approved → published     [Gate: Quality Manager Approval + 0 offene Findings]
published → in_review    [Amendment Path]
published → retired      [Replacement-Process gesetzt]
retired → archived       [nach Retention-Period]
```

Jeder Gate-Block liefert strukturierte Blocker-Liste analog zu BIA (`code`, `gate`, `message`, `severity`).

---

## 8. Phasen-Roadmap (8 Phasen)

### Phase 1: Foundation & Cleanup (Woche 1–2, Pilot-Critical) ⭐

**Ziel:** Datenintegrität herstellen, bevor Features draufgesetzt werden.

**Items:**

1. Migrations 0327 — FK-Härtung (processControl, processDocument, processRisk, processStepRisk)
2. Migration 0329 — Finding.processId FK
3. Cleanup-Job: orphaned Placeholder-Rows identifizieren + bereinigen
4. Audit-Trail-Backfill: alle existing Cross-Module-Links als Hash-Chain-Einträge nachtragen
5. RBAC-Audit: alle Process-Routes auf die 9 Rollen mappen, Permission-Matrix als ADR
6. RLS-Coverage-Check: alle BPM-Tabellen mit `org_id`-Filter prüfen, fehlende Policies ergänzen
7. **Test-Suite:** `process-cross-module-integrity.test.ts` der FK-Constraints + Cascade-Delete verifiziert

**Done:** Hash-Chain healthy, RLS 100% Coverage, alle Tests grün, Migration in prod ohne Rollback.

### Phase 2: Cross-Module-Wiring (Woche 3–4, Pilot-Critical) ⭐

**Ziel:** UI macht die existierenden Daten endlich nutzbar.

**Items:**

1. Process-Detail-Page um 6 Tabs erweitern: **Übersicht | Diagramm | Risiken | Kontrollen | Dokumente | BIA | Audits/Findings**
2. Pro Tab: List + Add/Remove + Drill-down
3. bpmn-js Editor-Properties-Panel: rechte Sidebar pro Activity zeigt verknüpfte Risks/Controls
4. Drag-Drop von Documents (aus DMS) auf Process-Header-Bereich
5. Bulk-Link-Modal: "5 Risiken auswählen und mit diesem Prozess verknüpfen"
6. **API-Erweiterungen:**
   - `GET /processes/{id}/risk-heatmap` (Phase 7.2-Pattern)
   - `GET /processes/{id}/racm` (Risk-Control-Matrix)
   - `GET /processes/{id}/coverage` (Compliance-Framework-Coverage)
7. Cross-Module-Aggregation in Dashboard-KPIs: "Prozesse mit ≥ 1 Critical Risk"

**Done:** Process-Detail-Page zeigt alle Cross-Module-Links, bidirektionale Navigation funktioniert (Click auf Risk → Risk-Detail-Page mit "1 Prozess verknüpft").

### Phase 3: GRC-Semantik & RACM (Woche 5–6, Pilot-Critical) ⭐

**Ziel:** Compliance-Tauglichkeit für die ersten Pilot-Kunden.

**Items:**

1. Migration 0330 — Three-Lines-of-Defense pro process_step
2. Lane-Color-Coding im bpmn-js-Renderer für 1st/2nd/3rd-Line
3. RACM-Matrix-View als eigene Page `/processes/{id}/racm`:
   - Spalten: Activity, Risk (Inherent/Residual), Control(s), Effectiveness, Test-Date, Findings
   - Export als PDF/A + Excel
4. Risk-Heatmap-Overlay im Editor (Toggle "Risiken anzeigen"): rote Aktivitäten = critical, gelb = moderate
5. Control-Coverage-Heatmap (analog): grau = keine Controls, grün = effective
6. Approval-Pipeline-Erweiterungen:
   - Process Owner kann nur in `in_review` schicken wenn alle Risks treated
   - Reviewer kann nur approven wenn alle Activities Beschreibung haben
   - Quality Manager kann nur publishen wenn ≥ 1 ISO-Framework-Mapping
7. **Notification-Trigger:** bei Status-Wechsel automatisch an nächste Rolle

**Done:** Eine ISO-9001/ISO-27001 Audit-Stichprobe ist mit dem Tool durchführbar.

### Phase 4: BIA-Integration & Compliance-Profile (Woche 7–8)

**Ziel:** ISO 22301 / NIS2 / DORA / GDPR Art. 30 sind native Profile.

**Items:**

1. Migration 0328 — bia_process_impact-Table
2. Migration 0331 — process_ropa_profile-Table für GDPR Art. 30
3. BIA-Detail-Page: Tab "Prozesse" mit Liste der gescorten Prozesse mit MTPD/RTO/RPO-Inputs
4. Process-Detail-Page: BIA-Tab mit Liste der BIAs die diesen Prozess als kritisch markieren
5. **Compliance-Profil-Switcher** auf Process-Detail-Page (Dropdown):
   - "Standard" (default)
   - "GDPR ROPA" → Art-30-Pflichtfelder werden inline editierbar
   - "ISO 22301 BIA" → MTPD/RTO/RPO + Dependencies
   - "NIS2 Critical" → Critical-Process-Flag + Lieferanten-Mapping
   - "ISO 9001 Quality" → KPI-Definitionen + KVP-Vorschläge
6. **ROPA-Export** als PDF (Art. 30 Pflichtformat) + CSV (für Behörden-Anfragen)
7. **DPIA-Auto-Trigger:** wenn ROPA-Profile auf high-risk → Notification an DPO + Vorschlag DPIA anzulegen

**Done:** DPO kann GDPR-Art-30-Aufstellung exportieren, BCM Manager kann BIA-Report mit Recovery-Plan generieren.

### Phase 5: Custom-Moddle-Extensions & XML-Persistence (Woche 9–10)

**Ziel:** GRC-Attribute reisen mit dem BPMN-XML.

**Items:**

1. `arctos-moddle-extension.json` definieren (riskRefs, controlRefs, lineOfDefense, raci, bcmKpi, ropa)
2. bpmn-js Property-Panel-Erweiterung: pro Activity rechte Sidebar mit allen `arctos:*` Properties
3. XML-Import: bestehende `arctos:*` Attribute werden in DB rehydriert
4. XML-Export: aktuelle DB-Cross-Links werden ins XML serialisiert
5. **Diff-View-Erweiterung:** Version-Compare berücksichtigt `arctos:*` Diffs (Risk-Link added/removed)
6. **Round-Trip-Test:** Export XML → Import in zweite Org → alle GRC-Attribute kommen mit

**Done:** Ein BPMN-Export ist sowohl in einem externen Visio-Editor lesbar als auch in ARCTOS verlustfrei re-importierbar.

### Phase 6: Approval-Pipeline & Cockpit (Woche 11–12)

**Ziel:** Multi-Level-Editorial-Workflow wie BIC, mit Hash-Chain-Signatur.

**Items:**

1. **Process-Cockpit-Dashboard** als neue Top-Level-Page `/processes/cockpit`:
   - 4 Quadranten: "In Review", "Pending Approval", "Overdue Review", "Critical Risks"
   - Filter pro Department, Owner, Compliance-Status
2. **Approval-Queue** mit Bulk-Approve-Funktion für Quality Manager
3. **Sign-Off-Workflow** mit Hash-Chain-Anchor:
   - Process Owner → Quality Manager → Compliance Officer
   - Jede Signatur erzeugt einen Hash-Chain-Eintrag mit Timestamp + User-Hash
4. **Audit-Trail-View** pro Prozess: vollständige History mit User + Hash-Reference
5. **Process-Compare-Side-by-Side**: zwei Versionen nebeneinander mit Inline-Diff für Beschreibungen, BPMN-Visual-Diff, Risk/Control-Link-Diff
6. **Auto-Versioning:** bei jeder Status-Change automatisch neue Version mit changeSummary
7. **Bulk-Operations für Quality Manager:** "Alle Prozesse in 'Operations'-Department zur Review schicken"

**Done:** Quality Manager kann täglich 20+ Approvals abarbeiten, Audit-Trail beweist die Genehmigungs-Kette.

### Phase 7: AI-Assistent & Process-Knowledge-Layer (Woche 13–14)

**Ziel:** Schnelles Anlegen + intelligente Vorschläge.

**Items:**

1. **Text-zu-BPMN** via Multi-Provider-AI-Router:
   - User schreibt: "Wenn ein Kunde eine Bestellung aufgibt, wird sie geprüft, der Lagerbestand ermittelt, dann versendet"
   - LLM generiert BPMN-XML mit Activities + Gateways
2. **Risiko-Vorschläge:** beim Anlegen neuer Activity → AI sucht in geseedeten Templates + bestehenden Risks ähnliche Activities und schlägt typische Risiken vor
3. **Control-Vorschläge** analog
4. **Compliance-Auto-Mapping:** AI analysiert Process-Description + schlägt ISO-27001-Annex-A-Controls vor die das abdecken
5. **Diagram-Optimization-Hints:** "Diese Activity hat 4 Gateways direkt hintereinander — vereinfachen?"
6. **Privacy-Tier-Routing:** sensitive Process-Beschreibungen gehen an Ollama (local), Standard an Claude/OpenAI

**Done:** Neuer Process von Text bis BPMN in <30 Sekunden mit ≥3 Risk- und Control-Vorschlägen.

### Phase 8: Process Mining & Simulation Production-Ready (Woche 15–16, optional)

**Ziel:** Die existierende Sprint-47-Pipeline (Event Logs, Conformance, Maturity) wird productive.

**Items:**

1. **Event-Log-Ingestion-Pipeline:** Webhook-Receiver für CSV/XES-Uploads aus externen Systemen (SAP, Salesforce)
2. **Conformance-Dashboard** pro Prozess: Soll vs. Ist mit Abweichungsliste
3. **Bottleneck-Heatmap** im Diagram-Overlay
4. **Rework-Loop-Detection** mit Vorschlägen zur Vereinfachung
5. **Simulation-Erweiterung:** Cost-Modeling mit Process-KPI-Werten
6. **Maturity-Auto-Compute** aus Control-Effectiveness + Audit-Findings + KPI-Performance (statt hardgecoded)
7. **Process-Health-Score** als 360°-View: Risk + Control + KPI + Maturity + Audit-Findings = single Score 0-100

**Done:** Process Mining aus realen Log-Daten generiert actionable Hints, Maturity-Score live-berechnet.

---

## 9. UI/UX-Plan

### 9.1 Neue/erweiterte Pages

| Page                           | Zweck                                                                         | Rollen                              |
| ------------------------------ | ----------------------------------------------------------------------------- | ----------------------------------- |
| `/processes` (List)            | Bestehend, erweitert um Compliance-Filter, Critical-Flag, LoD-Color           | Alle                                |
| `/processes/cockpit` (Phase 6) | Quality Manager Daily-Driver                                                  | Quality Manager, Compliance Officer |
| `/processes/map`               | Org-weite Prozess-Landkarte mit Hierarchie                                    | Alle                                |
| `/processes/{id}` (Detail)     | 6 neue Tabs: Übersicht, Diagramm, Risiken, Kontrollen, Dokumente, BIA, Audits | Alle                                |
| `/processes/{id}/racm`         | Risk-Control-Matrix-View für SOX-Audit                                        | Auditor, Compliance, Risk Mgr       |
| `/processes/{id}/ropa`         | GDPR Art. 30 Profile-Editor                                                   | DPO                                 |
| `/processes/{id}/bia`          | BIA-Score-Editor pro Prozess                                                  | BCM Manager                         |
| `/processes/{id}/maturity`     | Maturity-Breakdown (live-computed)                                            | Quality Mgr, Process Owner          |
| `/processes/{id}/walkthrough`  | Onboarding-View für neue Mitarbeiter                                          | Process Owner + Operations          |
| `/processes/templates`         | Template-Katalog (Sprint 47 schon angelegt)                                   | Process Owner                       |

### 9.2 bpmn-js Editor-Erweiterungen

- **Properties Panel:** Rechte Sidebar pro Activity mit Sub-Sektionen "Risk-Refs", "Control-Refs", "Documents", "RACI", "BCM-KPIs", "ROPA-Fields"
- **Context Pad:** Rechtsklick auf Activity → "Risiko verknüpfen", "Control verknüpfen", "Dokument anhängen"
- **Overlay-Toggles** in der Editor-Toolbar:
  - "Risk-Heatmap"
  - "Control-Coverage"
  - "Three-Lines-of-Defense-Colors"
  - "BCM-Critical"
  - "Open-Findings-Badges"
- **Mini-Map** für große Diagramme
- **Auto-Save** alle 30s mit Server-Sync, Version-Increment nur on-demand

### 9.3 Mobile-View (Phase 6+)

- Process-Cards mit Quick-Info (Status, Owner, Critical-Flag)
- Notification-Inbox für Reviews + Approvals
- Read-only-Walkthrough auf Smartphone (keine Edit-Funktionen)

---

## 10. API-Plan

### 10.1 Neue Endpoints

```
# Phase 2: Cross-Module
GET    /api/v1/processes/{id}/risk-heatmap
GET    /api/v1/processes/{id}/control-coverage
GET    /api/v1/processes/{id}/racm
GET    /api/v1/processes/{id}/findings
POST   /api/v1/processes/{id}/risks/bulk-link
POST   /api/v1/processes/{id}/controls/bulk-link
POST   /api/v1/processes/{id}/documents/bulk-attach

# Phase 3: GRC-Semantics
PUT    /api/v1/processes/{id}/steps/{stepId}/line-of-defense
GET    /api/v1/processes/{id}/three-lines-distribution

# Phase 4: BIA + Compliance-Profile
GET    /api/v1/processes/{id}/bia-impacts
POST   /api/v1/bcms/bia/{biaId}/process-impacts
PUT    /api/v1/bcms/bia/{biaId}/process-impacts/{processId}
GET    /api/v1/processes/{id}/ropa-profile
PUT    /api/v1/processes/{id}/ropa-profile
GET    /api/v1/dpms/ropa/export?format=pdf|csv  (Art. 30)
GET    /api/v1/processes/critical?framework=nis2|dora

# Phase 5: Custom-Moddle
GET    /api/v1/processes/{id}/versions/{vId}/xml-with-grc-attrs
POST   /api/v1/processes/import-bpmn-xml  (mit arctos:* Recovery)

# Phase 6: Cockpit + Approval
GET    /api/v1/processes/cockpit?role=quality_manager
POST   /api/v1/processes/{id}/sign-off
GET    /api/v1/processes/{id}/audit-trail
GET    /api/v1/processes/{id}/versions/{vId}/compare-detailed/{vId2}

# Phase 7: AI
POST   /api/v1/processes/ai/generate-from-text
POST   /api/v1/processes/{id}/ai/suggest-risks
POST   /api/v1/processes/{id}/ai/suggest-controls
POST   /api/v1/processes/{id}/ai/map-frameworks

# Phase 8: Mining
POST   /api/v1/processes/{id}/event-logs/ingest  (Webhook + Upload)
GET    /api/v1/processes/{id}/health-score (live aggregation)
```

### 10.2 Erweiterte Endpoints

```
# Process-Detail-Response bekommt neue Felder:
GET /api/v1/processes/{id}
→ {
  // existing...
  riskHeatmap: { critical: N, high: N, medium: N, low: N },
  controlCoverage: { activitiesWithoutControl: N, effectivenessAvg: % },
  bcmCriticality: 'critical|high|medium|low',
  ropaCompliant: boolean,
  threeLinesCoverage: { firstLine: N, secondLine: N, thirdLine: N },
  openFindings: N,
  frameworkMappings: ['iso-27001', 'iso-9001', 'nis2', ...],
  healthScore: 0-100
}
```

---

## 11. DB-Migrations-Plan

| Nr.  | Zweck                                                         | Reversible?          |
| ---- | ------------------------------------------------------------- | -------------------- |
| 0327 | FK-Härtung Placeholder-Tabellen                               | Ja (DROP CONSTRAINT) |
| 0328 | bia_process_impact-Table                                      | Ja                   |
| 0329 | Finding.processId + processStepId                             | Ja                   |
| 0330 | process_step.line_of_defense                                  | Ja                   |
| 0331 | process_ropa_profile-Table                                    | Ja                   |
| 0332 | Custom-Moddle-Extension-Loader (kein DDL, nur Code)           | Ja                   |
| 0333 | process_sign_off-Table + Hash-Chain-Anker                     | Ja                   |
| 0334 | process_event_log Production-Indexes                          | Ja                   |
| 0335 | process_framework_mapping-Table (process ↔ framework_control) | Ja                   |

Alle idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`), alle mit Up- + Down-Skript dokumentiert.

---

## 12. Test-Strategie

### 12.1 Unit-Tests (Vitest)

- `process-cross-module-integrity.test.ts` — FK-Constraints, Cascade-Delete-Verhalten
- `process-state-machine.test.ts` — alle Transition-Gates inkl. Blocker-Logik
- `process-raci-computation.test.ts` — Matrix-Berechnung mit Overrides
- `process-risk-heatmap.test.ts` — Aggregation pro Activity
- `process-racm-export.test.ts` — Excel + PDF Output-Format
- `process-bpmn-moddle-roundtrip.test.ts` — XML-Export + Import erhält GRC-Attrs
- `process-ropa-profile-validation.test.ts` — Art-30-Pflichtfeld-Checks

### 12.2 RBAC-Tests (parametric)

`process-rbac-matrix.test.ts` mit 9 Rollen × 50 Endpoints = 450 Permission-Checks.

### 12.3 RLS-Tests

Pro neuer Table: Cross-Tenant-Isolation-Test wie in Wave 22 etabliert.

### 12.4 E2E-Tests (Playwright)

- Process-Detail-Page mit allen 6 Tabs durchklicken
- BPMN-Editor: Activity anlegen, Risk per Context-Menu verknüpfen, speichern, re-load → Verknüpfung steht
- Approval-Pipeline: Author → Reviewer → Quality Manager → Publish
- ROPA-Profile ausfüllen + PDF-Export

### 12.5 Performance-Tests

- 500 Prozesse pro Org, RACM-Endpoint < 1s
- BPMN-Diagram mit 100 Activities und Heatmap-Overlay < 2s Render

### 12.6 Compliance-Audit-Smoke

Audit-Pack-Export für ISO 9001 Stichprobe: 5 Prozesse, alle published, mit Audit-Trail + Risk-Control-Matrix + RACI als ZIP.

---

## 13. Aufwand + Reihenfolge

| Phase                      | Wochen | Team-Aufwand             | Pilot-Critical? |
| -------------------------- | ------ | ------------------------ | --------------- |
| 1 Foundation               | 1–2    | 1× Backend, 1× DevOps    | ✅              |
| 2 Cross-Module-Wiring      | 3–4    | 1× FullStack, 1× UX      | ✅              |
| 3 GRC-Semantik & RACM      | 5–6    | 1× Backend, 1× UX, 1× QA | ✅              |
| 4 BIA + Compliance-Profile | 7–8    | 1× Backend, 1× UX        | ⚠️ Empfohlen    |
| 5 Custom-Moddle            | 9–10   | 1× Frontend-Spezialist   | ⚠️ Empfohlen    |
| 6 Approval + Cockpit       | 11–12  | 1× FullStack, 1× UX      | Nice            |
| 7 AI-Assistent             | 13–14  | 1× ML-Engineer, 1× UX    | Nice            |
| 8 Process Mining Prod      | 15–16  | 1× Data-Engineer, 1× UX  | Nice            |

**Pilot-Minimum:** Phasen 1–3 (6 Wochen) — danach kann ein Pilot-Kunde mit ISO-9001/27001-Audit den BPM-Teil produktiv nutzen.

**Beta:** Phasen 1–5 (10 Wochen).

**Volle Vision:** Phasen 1–8 (16 Wochen).

---

## 14. Risiken & Trade-offs

| Risiko                                                 | Mitigation                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| **bpmn-js-Major-Upgrade während Implementation**       | Version 18.16 fixieren, Upgrade als eigenes Sprint nach v0.3.0                        |
| **Custom-Moddle bricht externe Tool-Kompatibilität**   | Test gegen Visio, Camunda, Signavio Trial im Phase 5 Round-Trip-Test                  |
| **Performance bei großen RACM-Tabellen**               | Caching mit 5min-TTL für RACM-Computation, falls > 200 Activities                     |
| **GDPR-ROPA-Profile-Sprawl**                           | Profile als Soft-Mandatory, nicht Hard-Required (Process kann existieren ohne ROPA)   |
| **Approval-Pipeline-Lock-Outs**                        | Discovery-Endpoint zeigt Blocker, Admin-Override für Notfälle (mit Audit-Trail)       |
| **AI-Generierte BPMN ist syntaktisch invalide**        | Validator-Pipeline VOR Save, mit Fallback "User editiert manuell"                     |
| **Process Mining Hot-Storage-Cost**                    | Event-Log-Tabellen in TimescaleDB-Hypertable mit Retention 24 Monate                  |
| **Customer Lock-in zu ARCTOS-spezifischen Attributes** | XML-Export hat zwei Modi: "full" (mit `arctos:*`) und "interoperable" (BPMN-2.0-only) |
| **Wave-23-Endgame nicht durch**                        | Diese Roadmap startet ERST nach Wave-23-Pilot-Readiness-Gate grün                     |

---

## 15. Erfolgs-Definition

Nach Phase 3 (Pilot-Minimum) kann ein deutscher Mittelständler:

1. Seine Top-50 Prozesse modellieren in BPMN 2.0
2. Pro Activity Risiken + Kontrollen + Verantwortlichkeiten (RACI) verknüpfen
3. ISO 9001 + ISO 27001 Audit-Pack als PDF exportieren mit vollständigem Audit-Trail
4. Quality Manager publiziert Prozesse mit Hash-Chain-signiertem Approval
5. Process-Owner bekommt automatische Review-Erinnerungen
6. Auditor (3rd Line) macht Stichproben mit Sign-Off-Vermerk

Nach Phase 5 zusätzlich: 7. DPO erstellt GDPR-Art-30-ROPA-Aufstellung als PDF für Behörden 8. BCM Manager scort MTPD/RTO/RPO pro Prozess in der BIA 9. BPMN-XML-Roundtrip via externe Tools (Visio, Signavio Trial) bleibt verlustfrei

Nach Phase 8: 10. Process Mining identifiziert Bottlenecks aus realen Log-Daten 11. AI-Assistent generiert neue Prozesse aus Text-Description in <30s

**Erfolgs-Metrik:** Pilot-Kunde durchläuft ein internes ISO-9001-Audit mit ARCTOS-BPM als alleinigem Tool, ohne Excel oder Visio nebenher.

---

## 16. Anhang: User-Story-Beispiele

### US-PROC-01 (Process Owner)

> Als **Thomas Fischer (Process Owner Operations)** möchte ich den **„Bestellungs-Genehmigungs-Prozess"** modellieren, jede Activity mit Risiko-Profil und Control-Coverage versehen, und meinen Vorgesetzten als Reviewer einbinden, damit das Audit-Pack für die jährliche ISO 9001-Zertifizierung automatisch generierbar ist.

**Akzeptanz:**

- Anlegen + Status `draft`
- BPMN-Editor mit 8 Activities + 2 Gateways
- Pro Activity ≥ 1 Risk verknüpft (via Context-Menu)
- Pro kritischer Activity ≥ 1 Control verknüpft
- Reviewer gesetzt → Status `in_review` möglich
- Reviewer approven via Notification-Link
- Quality Manager publisht → PDF-Export-Button erscheint

### US-PROC-02 (DPO)

> Als **Dr. Julia Krause (DPO)** möchte ich für alle 30 Prozesse meiner Organisation ein GDPR-Art-30-Profile pflegen und einmal pro Quartal als PDF an die Aufsichtsbehörde exportieren können.

**Akzeptanz:**

- ROPA-Profile-Editor zeigt Art-30-Pflichtfelder
- `requires_dpia` auto-set bei high-risk-Profile
- Export-PDF-Button erzeugt strukturiertes Behörden-Format

### US-PROC-03 (BCM Manager)

> Als **Lisa Wagner (BCM Manager)** möchte ich in der jährlichen BIA für jeden kritischen Prozess MTPD, RTO und RPO setzen und die Dependencies (Assets, Vendoren, Mitarbeiter) anzeigen, damit der Disaster-Recovery-Plan vollständig ist.

**Akzeptanz:**

- BIA-Detail-Page Tab "Prozesse" listet alle gescorten Prozesse
- Pro Prozess: MTPD/RTO/RPO + Dependency-Map (Asset, Vendor, User)
- Critical-Process-Flag propagiert in NIS2-Dashboard

---

_Implementation-Plan abgeschlossen. ~6.500 Worte. 8 Phasen, 9 Rollen-Profile, 9 Migration-Nummern. Vorbedingung: Wave 23 grün._
