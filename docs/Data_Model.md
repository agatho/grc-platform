# ARCTOS — Data Model v1.0

> Dieses Dokument definiert alle Kern-Entities, Fielder, Relationen und Requirement Mappings.
> It serves as the foundation for the PostgreSQL schema and API endpoints.
> Status: March 2026

---

## Architecture Principles

- **Multi-Entity via `org_id`**: Every entity has an `org_id` (FK auf `Organization`). Row-Level Security (RLS) ensures users only see data from their own organization.
- **Audit Trail (CRITICAL for GRC)**:
  - Every table has the mandatory fields `created_at`, `updated_at`, `created_by`, `updated_by` (siehe Abschnitt "Cross-Cutting Fielder" unten).
  - Every data change is automatically logged in the `audit_log` table (before/after diff as JSONB).
  - Audit logs are **append-only** — no UPDATE or DELETE on the table. Hash chain for tamper detection.
  - Additionally: `access_log` for login/logout/auth events, `data_export_log` for downloads and exports.
  - Retention period: minimum 10 years (regulatory requirement).
  - Ref: G-07, DSGVO Art. 5 (accountability), ISO 27001 A.12.4
- **Soft Delete**: `deleted_at` timestamp instead of physical deletion. Soft deletes are also captured in the audit log.
- **Status Pattern**: Unified 4-stage model: `draft` → `in_review` → `approved` → `archived`. Every status transition is logged in the audit log with old and new status.
- **Versioning**: Entities with versioning use a separate `*_version` table.
- **m:n Relations**: Via join tables with their own context (e.g. `process_step_risk` hat `risk_context`-Field).
- **UUIDs**: All primary keys are UUIDs (v7 for sortability).
- **Timestamps**: All as `timestamptz` (UTC).

### Cross-Cutting Mandatory Fields (on EVERY entity table)

Die folgenden Fielder sind auf **jeder** Entity-Tabelle Pflicht (außer den Audit-/Log-Tabellen selbst):

| Field | Type | Description |
|------|-----|--------------|
| `created_at` | timestamptz NOT NULL | Creation timestamp, auto-set |
| `updated_at` | timestamptz NOT NULL | Last modification timestamp, auto on UPDATE |
| `created_by` | uuid FK → User | Who created the record |
| `updated_by` | uuid FK → User | Who last modified |
| `deleted_at` | timestamptz NULL | Soft delete timestamp (NULL = aktiv) |
| `deleted_by` | uuid FK → User NULL | Who deleted |

> **Implementierungshinweis**: Diese Fielder werden NICHT in jeder Entity-Definition unten wiederholt, um Redundanz zu vermeiden. Sie sind aber in jeder CREATE TABLE Anweisung enthalten. Automatisierung über PostgreSQL-Trigger oder Prisma Middleware.

---

## 1. Platform Core (G-01 bis G-12)

### 1.1 Organization
> Multi-entity root. Each corporate entity is an Organization. Ref: G-02, D-10

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `name` | varchar(255) | Company name |
| `short_name` | varchar(50) | Short name (e.g. "NovaTec") |
| `type` | enum | `subsidiary`, `holding`, `joint_venture` |
| `country` | varchar(3) | ISO 3166-1 alpha-3 |
| `is_eu` | boolean | EU flag |
| `parent_org_id` | uuid FK → Organization | For corporate hierarchy |
| `legal_form` | varchar(100) | Legal form (GmbH, AG, etc.) |
| `dpo_name` | varchar(255) | Data Protection Officer |
| `dpo_email` | varchar(255) | |
| `settings` | jsonb | Org-specific configuration |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 1.2 User
> Ref: G-03, G-04

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `email` | varchar(255) UNIQUE | |
| `name` | varchar(255) | |
| `sso_provider_id` | varchar(255) | Azure AD / OIDC Subject |
| `language` | varchar(5) | `de`, `en` (Ref: G-06) |
| `is_active` | boolean | |
| `last_login_at` | timestamptz | |
| `created_at` | timestamptz | |

### 1.3 UserOrganizationRole (Join-Tabelle)
> Users can have roles in multiple orgs. Ref: G-03

| Field | Type | Description |
|------|-----|--------------|
| `user_id` | uuid FK → User | |
| `org_id` | uuid FK → Organization | |
| `role` | enum | `admin`, `risk_manager`, `control_owner`, `auditor`, `dpo`, `viewer`, `process_owner` |
| `department` | varchar(255) | Department within the org |
| `line_of_defense` | enum | `first`, `second`, `third` (Ref: K-02, E-04) |

### 1.4 AuditLog (Append-Only, Tamper-Protected)
> Central change history across ALL entities. CRITICAL for GRC compliance.
> Ref: G-07, DSGVO Art. 5, ISO 27001 A.12.4
>
> **Design Principles:**
> - Append-only: No UPDATE, no DELETE on this table (PostgreSQL RULE or TRIGGER prevents this)
> - Hash chain: Each entry contains the hash of the previous one → tampering detectable
> - No soft delete: Audit logs are NEVER deleted (only archiving after retention period)
> - Automatic: Written by DB trigger on every change to business tables

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `user_id` | uuid FK → User | Who performed the action |
| `user_email` | varchar(255) | Snapshot of user email at time of action (in case user is deleted) |
| `user_name` | varchar(255) | Name snapshot |
| `entity_type` | varchar(100) | e.g. `risk`, `control`, `process`, `finding`, `ropa`, `contract` |
| `entity_id` | uuid | |
| `entity_title` | varchar(500) | Snapshot of title/name at time of change |
| `action` | enum | `create`, `update`, `delete`, `restore`, `status_change`, `approve`, `reject`, `assign`, `unassign`, `upload_evidence`, `delete_evidence`, `acknowledge`, `export`, `bulk_update`, `comment`, `link`, `unlink` |
| `action_detail` | varchar(500) | Menschenlesbare Description (e.g. "Status geändert von 'draft' zu 'in_review'") |
| `changes` | jsonb | Before/after diff as structured JSON: `{"field": {"old": "...", "new": "..."}}` |
| `metadata` | jsonb | Additional context (e.g. welches Framework bei Compliance-Änderung, Bulk-Operation-ID) |
| `ip_address` | inet | Client IP |
| `user_agent` | varchar(500) | Browser/client info |
| `session_id` | varchar(255) | Session reference |
| `previous_hash` | varchar(64) | SHA-256 hash of previous entry (Hash-Kette für Tamper-Detection) |
| `entry_hash` | varchar(64) | SHA-256 hash of this entry (über alle Fielder) |
| `created_at` | timestamptz NOT NULL | Timestamp (immutable) |

> **Abgedeckte Aktions-Kategorien:**
>
> | Kategorie | Aktionen | Beispiele |
> |-----------|----------|-----------|
> | CRUD | `create`, `update`, `delete`, `restore` | Risiko erstellt, Control geändert, Prozess gelöscht |
> | Workflow | `status_change`, `approve`, `reject` | Finding von "open" auf "in_remediation", DSFA freigegeben |
> | Zuweisung | `assign`, `unassign` | Risk Owner zugewiesen, Auditor entfernt |
> | Evidence | `upload_evidence`, `delete_evidence` | Screenshot hochgeladen, veraltete Evidenz entfernt |
> | Kenntnisnahme | `acknowledge` | Richtlinie gelesen und bestätigt (DM-05) |
> | Datenexport | `export` | PDF-Report generiert, Excel-Export durchgeführt |
> | Bulk | `bulk_update` | 50 Controls gleichzeitig aktualisiert |
> | Comments | `comment` | Kommentar an Finding hinzugefügt |
> | Verknüpfungen | `link`, `unlink` | Risiko mit Prozessschritt verknüpft, Evidenz von Audit entfernt |

### 1.5 AccessLog (Login/Auth-Events)
> Ref: G-04, G-07, ISO 27001 A.9.4
> Also append-only. Captures all authentication events.

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `user_id` | uuid FK → User | NULL for failed logins with unknown user |
| `email_attempted` | varchar(255) | Email attempted |
| `event_type` | enum | `login_success`, `login_failed`, `logout`, `token_refresh`, `password_change`, `mfa_challenge`, `mfa_success`, `mfa_failed`, `account_locked`, `sso_login`, `api_key_used`, `session_expired` |
| `auth_method` | enum | `password`, `sso_azure_ad`, `sso_oidc`, `api_key`, `mfa_totp`, `mfa_webauthn` |
| `ip_address` | inet | |
| `user_agent` | varchar(500) | |
| `geo_location` | varchar(255) | Approximate location (derived from IP, optional) |
| `failure_reason` | varchar(255) | For failed attempts |
| `session_id` | varchar(255) | |
| `created_at` | timestamptz NOT NULL | |

### 1.6 DataExportLog
> Ref: G-07, DSGVO Art. 5 (accountability)
> Tracks all data exports and downloads — critical for data protection accountability.

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `user_id` | uuid FK → User | |
| `export_type` | enum | `pdf_report`, `excel_export`, `csv_export`, `evidence_download`, `bulk_export`, `api_extract`, `audit_report`, `emergency_handbook` |
| `entity_type` | varchar(100) | Which data exported (e.g. `risk`, `ropa`, `audit`) |
| `entity_id` | uuid | Specific record (NULL for bulk/report) |
| `description` | varchar(500) | e.g. "Risikoregister Q1 2026 als PDF" |
| `record_count` | int | Number of exported records |
| `contains_personal_data` | boolean | Flag whether personal data is contained |
| `file_name` | varchar(255) | |
| `file_size_bytes` | bigint | |
| `ip_address` | inet | |
| `created_at` | timestamptz NOT NULL | |

### 1.7 Notification
> Ref: G-09

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `user_id` | uuid FK → User | Empfänger |
| `org_id` | uuid FK → Organization | |
| `type` | enum | `task_assigned`, `deadline_approaching`, `escalation`, `approval_request`, `status_change` |
| `entity_type` | varchar(100) | |
| `entity_id` | uuid | |
| `title` | varchar(500) | |
| `message` | text | |
| `is_read` | boolean | |
| `channel` | enum | `in_app`, `email`, `teams` (Ref: O-09) |
| `created_at` | timestamptz | |

---

## 2. BPM / Process World (P-01 bis P-10)

### 2.1 Process
> Ref: P-01, P-03, P-05

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `parent_process_id` | uuid FK → Process | Hierarchy (Ref: P-03) |
| `name` | varchar(500) | |
| `description` | text | |
| `level` | int | 1 = Konzern, 2 = Unternehmen, 3 = Abteilung, 4+ = Detail |
| `notation` | enum | `bpmn`, `value_chain`, `epc` (Ref: P-02) |
| `status` | enum | `draft`, `in_review`, `approved`, `published`, `archived` (Ref: P-06) |
| `process_owner_id` | uuid FK → User | |
| `reviewer_id` | uuid FK → User | |
| `department` | varchar(255) | |
| `current_version` | int | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `published_at` | timestamptz | |
| `deleted_at` | timestamptz | Soft Delete |

### 2.2 ProcessVersion
> Ref: P-07

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `process_id` | uuid FK → Process | |
| `version_number` | int | |
| `bpmn_xml` | text | BPMN 2.0 XML (Ref: P-01) |
| `diagram_json` | jsonb | Alternativ: reactflow/bpmn.js JSON |
| `change_summary` | text | |
| `created_by` | uuid FK → User | |
| `created_at` | timestamptz | |

### 2.3 ProcessStep
> Einzelner Schritt/Aktivität innerhalb eines Prozesses. Ref: P-05

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `process_id` | uuid FK → Process | |
| `bpmn_element_id` | varchar(255) | Referenz auf BPMN-Element |
| `name` | varchar(500) | |
| `description` | text | |
| `step_type` | enum | `task`, `gateway`, `event`, `subprocess` |
| `responsible_role` | varchar(255) | RACI: Responsible |
| `sequence_order` | int | Reihenfolge |

---

## 3. Frameworks & Compliance (I-01, I-02, I-03, I-11, I-12)

### 3.1 Framework
> Ref: I-01, I-02, I-03 (inspiriert von an open-source ISMS tool mit 130+ Frameworks)

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `name` | varchar(255) | e.g. "ISO 27001:2022", "NIS2", "BSI Grundschutz" |
| `version` | varchar(50) | e.g. "2022", "v4.0" |
| `source` | varchar(255) | e.g. "ISO", "BSI", "EU" |
| `category` | enum | `isms`, `bcms`, `privacy`, `erm`, `ics`, `esg`, `other` |
| `description` | text | |
| `is_active` | boolean | |
| `metadata` | jsonb | Framework-spezifische Daten |

### 3.2 Requirement (Framework-Anforderung)
> Ref: I-06 (SoA), Compliance Tracking

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `framework_id` | uuid FK → Framework | |
| `parent_requirement_id` | uuid FK → Requirement | Hierarchy (e.g. Anhang A → A.5 → A.5.1) |
| `reference_code` | varchar(100) | e.g. "A.5.1.1", "Art. 32" |
| `title` | varchar(500) | |
| `description` | text | |
| `category` | varchar(255) | |
| `sequence_order` | int | |

### 3.3 FrameworkMapping
> Automatisches Cross-Framework-Mapping (NIST OLIR-Ansatz). Ref: I-02

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `source_requirement_id` | uuid FK → Requirement | |
| `target_requirement_id` | uuid FK → Requirement | |
| `mapping_type` | enum | `equivalent`, `partial`, `related`, `superset`, `subset` |
| `confidence` | decimal(3,2) | 0.00 - 1.00 |
| `source` | enum | `olir`, `manual`, `ai_suggested` |

### 3.4 ComplianceAssessment
> SoA-Management (Ref: I-06) und Compliance-Tracking pro Org + Framework

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `requirement_id` | uuid FK → Requirement | |
| `status` | enum | `applicable`, `not_applicable`, `implemented`, `partially_implemented`, `planned`, `not_implemented` |
| `justification` | text | Begründung (für SoA) |
| `responsible_id` | uuid FK → User | |
| `target_date` | date | |
| `last_assessed_at` | timestamptz | |

---

## 4. Assets (I-04)

### 4.1 Asset
> Ref: I-04, I-05

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `name` | varchar(500) | |
| `asset_type` | enum | `hardware`, `software`, `data`, `person`, `location`, `service`, `network` |
| `description` | text | |
| `owner_id` | uuid FK → User | |
| `classification` | enum | `public`, `internal`, `confidential`, `strictly_confidential` |
| `location` | varchar(255) | |
| `criticality` | enum | `low`, `medium`, `high`, `critical` |
| `status` | enum | `active`, `retired`, `planned` |
| `metadata` | jsonb | Type-spezifische Daten (IP, OS, etc.) |
| `created_at` | timestamptz | |

### 4.2 Vulnerability
> Ref: I-08

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `asset_id` | uuid FK → Asset | |
| `scanner_source` | enum | `qualys`, `tenable`, `manual`, `other` |
| `cve_id` | varchar(50) | |
| `title` | varchar(500) | |
| `severity` | enum | `critical`, `high`, `medium`, `low`, `info` |
| `cvss_score` | decimal(3,1) | |
| `status` | enum | `open`, `in_remediation`, `mitigated`, `accepted`, `false_positive` |
| `detected_at` | timestamptz | |
| `remediated_at` | timestamptz | |
| `notes` | text | Kontext, Workarounds, Erklärungen |

---

## 5. Risk Management (E-01 bis E-12)

### 5.1 Risk
> Ref: E-01, E-02, E-04, E-05, E-06, E-07
>
> **3-Ebenen-Risikozuordnung:**
> - Ebene 1 — Organisation: über `risk.org_id` (welches Unternehmen)
> - Ebene 2 — Prozess: über `process_risk` Join-Tabelle (Risiko betrifft Totalprozess)
> - Ebene 3 — Prozessschritt: über `process_step_risk` Join-Tabelle (Risiko an einzelner Aktivität)
>
> Im BPMN-Editor werden Risiken visuell sowohl am Prozess-Header als auch an einzelnen Shapes angezeigt.
> Gleiches Muster gilt für Controls über `process_control` und `process_step_control`.

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `title` | varchar(500) | |
| `description` | text | |
| `risk_category` | enum | `strategic`, `operational`, `financial`, `compliance`, `cyber`, `reputational`, `esg` |
| `risk_source` | enum | `isms`, `erm`, `bcm`, `project`, `process` |
| `status` | enum | `identified`, `assessed`, `treated`, `accepted`, `closed` |
| `owner_id` | uuid FK → User | Risk Owner (Ref: E-04) |
| `department` | varchar(255) | |
| `inherent_likelihood` | int | 1-5 (Ref: E-02) |
| `inherent_impact` | int | 1-5 |
| `residual_likelihood` | int | Nach Actions |
| `residual_impact` | int | |
| `risk_score_inherent` | decimal(5,2) | Berechnet |
| `risk_score_residual` | decimal(5,2) | Berechnet |
| `treatment_strategy` | enum | `mitigate`, `accept`, `transfer`, `avoid` (Ref: E-05) |
| `financial_impact_min` | decimal(15,2) | Für CRQ (Ref: E-08) |
| `financial_impact_max` | decimal(15,2) | |
| `financial_impact_expected` | decimal(15,2) | Monte Carlo Ergebnis |
| `risk_appetite_exceeded` | boolean | Ref: E-03 |
| `review_date` | date | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 5.2 RiskTreatment
> Actionsplan pro Risiko. Ref: E-05

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `risk_id` | uuid FK → Risk | |
| `action_id` | uuid FK → Action | Verknüpfung zum Actionstracking (O-05) |
| `description` | text | |
| `expected_risk_reduction` | decimal(5,2) | |
| `cost_estimate` | decimal(15,2) | |
| `status` | enum | `planned`, `in_progress`, `completed`, `cancelled` |
| `due_date` | date | |

### 5.3 KRI (Key Risk Indicator)
> Ref: E-10 — Gap/Eigenentwicklung

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `risk_id` | uuid FK → Risk | |
| `name` | varchar(255) | e.g. "Anzahl kritischer Schwachstellen" |
| `description` | text | |
| `unit` | varchar(50) | e.g. "Stück", "%", "EUR" |
| `threshold_green` | decimal(15,2) | OK-Bereich |
| `threshold_yellow` | decimal(15,2) | Warnbereich |
| `threshold_red` | decimal(15,2) | Kritisch |
| `current_value` | decimal(15,2) | |
| `trend` | enum | `improving`, `stable`, `worsening` |
| `measurement_frequency` | enum | `daily`, `weekly`, `monthly`, `quarterly` |
| `last_measured_at` | timestamptz | |
| `alert_enabled` | boolean | |

### 5.4 KRIMeasurement
> Messwert-History für KRIs

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `kri_id` | uuid FK → KRI | |
| `value` | decimal(15,2) | |
| `measured_at` | timestamptz | |
| `source` | enum | `manual`, `api_import`, `calculated` |

---

## 6. Controls & IKS (K-01 bis K-08)

### 6.1 Control
> Ref: K-01, K-02, K-06
>
> **3-Ebenen-Kontrollzuordnung** (analog zu Risk):
> - Ebene 1 — Organisation: über `control.org_id`
> - Ebene 2 — Prozess: über `process_control` (Kontrolle gilt für Totalprozess)
> - Ebene 3 — Prozessschritt: über `process_step_control` (Kontrolle an einzelner Aktivität)
>
> Über `risk_control` (RCM) wird die Verbindung Risk ↔ Control hergestellt. Ref: K-06

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `title` | varchar(500) | |
| `description` | text | |
| `control_type` | enum | `preventive`, `detective`, `corrective` |
| `frequency` | enum | `continuous`, `daily`, `weekly`, `monthly`, `quarterly`, `annually`, `ad_hoc` |
| `automation_level` | enum | `manual`, `semi_automated`, `fully_automated` |
| `line_of_defense` | enum | `first`, `second`, `third` (Ref: K-02) |
| `owner_id` | uuid FK → User | Control Owner |
| `status` | enum | `designed`, `implemented`, `effective`, `ineffective`, `retired` |
| `last_tested_at` | timestamptz | |
| `created_at` | timestamptz | |

### 6.2 ControlTest
> Ref: K-03

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `control_id` | uuid FK → Control | |
| `test_type` | enum | `design_effectiveness`, `operating_effectiveness` |
| `description` | text | Description des Testvorgehens |
| `tester_id` | uuid FK → User | |
| `planned_date` | date | |
| `executed_date` | date | |
| `result` | enum | `effective`, `ineffective`, `partially_effective`, `not_tested` |
| `notes` | text | |
| `status` | enum | `planned`, `in_progress`, `completed` |

### 6.3 Evidence
> Universeller Nachweis-Container. Kann an fast jede Entity gehängt werden.
> Ref: K-03, A-03, A-05, D-04, D-05, B-06
>
> **Unterstützte Verknüpfungen** (über `entity_type` + `entity_id`):
> `control_test`, `audit`, `audit_checklist`, `compliance_assessment`, `finding`,
> `incident`, `data_breach`, `dsr`, `dpia`, `ropa`, `action`, `exercise`,
> `bcp`, `risk_treatment`, `supplier`, `tom`, `training_record`

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `entity_type` | varchar(100) | Siehe Liste oben |
| `entity_id` | uuid | Polymorphic reference |
| `title` | varchar(500) | Bezeichnung des Nachweises |
| `description` | text | Erläuterung: Was wird nachgewiesen, Kontext |
| `category` | enum | `screenshot`, `document`, `log_export`, `email`, `certificate`, `report`, `photo`, `config_export`, `other` |
| `file_path` | varchar(1000) | S3/Blob-Pfad |
| `file_name` | varchar(255) | Originaler Dateiname |
| `file_type` | varchar(50) | MIME-Typee |
| `file_size_bytes` | bigint | |
| `uploaded_by` | uuid FK → User | |
| `uploaded_at` | timestamptz | |
| `valid_from` | date | Ab wann gültig |
| `valid_until` | date | Ablaufdatum (für Zertifikate etc.) |
| `notes` | text | Zusätzliche Anmerkungen |

---

## 7. Audit Management (A-01 bis A-08)

### 7.1 Audit
> Ref: A-01, A-02, A-03

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `title` | varchar(500) | |
| `audit_type` | enum | `internal`, `external`, `certification`, `surveillance` |
| `framework_id` | uuid FK → Framework | Welches Framework wird auditiert |
| `status` | enum | `planned`, `in_progress`, `completed`, `cancelled` |
| `lead_auditor_id` | uuid FK → User | |
| `planned_start` | date | |
| `planned_end` | date | |
| `actual_start` | date | |
| `actual_end` | date | |
| `scope` | text | |
| `conclusion` | text | |

### 7.2 AuditChecklist
> Ref: A-03

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `audit_id` | uuid FK → Audit | |
| `requirement_id` | uuid FK → Requirement | Optional: welche Anforderung wird geprüft |
| `question` | text | |
| `response` | text | |
| `result` | enum | `conforming`, `non_conforming`, `observation`, `not_applicable` |
| `notes` | text | |
| `sequence_order` | int | |

### 7.3 Finding
> Modulübergreifend: aus Audits (A-04), Kontrolltests (K-04), Incidents. Ref: A-04, A-07, K-04

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `source_type` | enum | `audit`, `control_test`, `incident`, `self_assessment`, `external` |
| `source_id` | uuid | Polymorphic reference |
| `title` | varchar(500) | |
| `description` | text | |
| `severity` | enum | `critical`, `major`, `minor`, `observation` |
| `root_cause` | text | Ursachenanalyse (Ref: K-04) |
| `recommendation` | text | Empfohlene Abhilfemaßnahme |
| `management_response` | text | Stellungnahme des Managements |
| `status` | enum | `open`, `in_remediation`, `verified`, `closed` |
| `owner_id` | uuid FK → User | |
| `due_date` | date | |
| `closed_at` | timestamptz | |

---

## 8. BCMS / BIA (B-01 bis B-09)

### 8.1 BIA (Business Impact Analysis)
> Ref: B-03, B-07, B-09

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `process_id` | uuid FK → Process | |
| `criticality` | enum | `critical`, `essential`, `important`, `normal` |
| `rto_hours` | int | Recovery Time Objective |
| `rpo_hours` | int | Recovery Point Objective |
| `mtpd_hours` | int | Maximum Tolerable Period of Disruption |
| `financial_impact_per_day` | decimal(15,2) | |
| `dependencies` | text | Description Abhängigkeiten |
| `assumptions` | text | Annahmen und Randbedingungen der Analyse |
| `notes` | text | Zusätzliche Erläuterungen |
| `status` | enum | `draft`, `in_review`, `approved`, `archived` |
| `last_reviewed_at` | timestamptz | |

### 8.2 BIASupplierDependency
> Ref: B-09 — Lieferanten-Abhängigkeit in BIA

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `bia_id` | uuid FK → BIA | |
| `supplier_id` | uuid FK → Supplier | |
| `criticality` | enum | `critical`, `important`, `normal` |
| `substitute_available` | boolean | |
| `switch_time_days` | int | |

### 8.3 BCP (Business Continuity Plan)
> Ref: B-04, B-05

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `bia_id` | uuid FK → BIA | |
| `title` | varchar(500) | |
| `plan_type` | enum | `bcp`, `drp`, `crisis_communication` (Ref: B-05) |
| `content` | text | Plan-Inhalt (Markdown) |
| `contact_tree` | jsonb | Kommunikationsbaum (Ref: B-05) |
| `status` | enum | `draft`, `in_review`, `approved`, `archived` |
| `last_tested_at` | timestamptz | |
| `next_review_date` | date | |

### 8.4 Exercise
> Ref: B-06

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `bcp_id` | uuid FK → BCP | |
| `title` | varchar(500) | |
| `exercise_type` | enum | `tabletop`, `walkthrough`, `simulation`, `full_scale` |
| `planned_date` | date | |
| `executed_date` | date | |
| `result` | text | |
| `lessons_learned` | text | |
| `status` | enum | `planned`, `completed`, `cancelled` |

---

## 9. Datenschutz / DPMS (D-01 bis D-10)

### 9.1 RoPA (Verarbeitungstätigkeit)
> Ref: D-01, D-10. VVZ mit 4-Stufen-Status, Konzerngesellschafts-Zuordnung

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | Konzerngesellschaft |
| `lfd_nr` | int | Laufende Nummer |
| `name` | varchar(500) | Bezeichnung der Verarbeitungstätigkeit |
| `purpose` | text | Zweck der Verarbeitung |
| `legal_basis` | enum | `consent`, `contract`, `legal_obligation`, `vital_interest`, `public_interest`, `legitimate_interest` |
| `legal_basis_detail` | text | |
| `data_categories` | jsonb | Kategorien personenbezogener Daten |
| `data_subjects` | jsonb | Kategorien betroffener Personen |
| `recipients` | jsonb | Empfänger/Empfängerkategorien |
| `retention_period` | varchar(255) | Löschfristen |
| `processing_type` | enum | `controller`, `processor`, `joint_controller` |
| `department` | varchar(255) | Abteilung |
| `status` | enum | `new`, `in_progress`, `reviewed`, `inactive` |
| `is_eu` | boolean | EU-Verarbeitung |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### 9.2 DPIA (Datenschutz-Folgenabschätzung)
> Ref: D-02. DSFA mit Zuordnung zu VVZ

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `ropa_id` | uuid FK → RoPA | Zuordnung zu VVZ |
| `lfd_nr` | int | |
| `title` | varchar(500) | |
| `description` | text | |
| `necessity_assessment` | text | Art. 35 Prüfung |
| `risk_assessment` | text | Risiken für Rechte und Freiheiten |
| `measures` | text | Abhilfemaßnahmen |
| `dpo_opinion` | text | Stellungnahme DSB |
| `status` | enum | `new`, `in_progress`, `reviewed`, `inactive` |
| `attachments` | jsonb | Anlagen |
| `created_at` | timestamptz | |

### 9.3 DataSubjectRequest (DSR / Beschwerdemanagement)
> Ref: D-03. Beschwerdemanagement mit Deadline, Art, Mustertexte

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `request_type` | enum | `access`, `rectification`, `erasure`, `restriction`, `portability`, `objection` |
| `data_subject_name` | varchar(255) | Betroffene Person |
| `data_subject_email` | varchar(255) | |
| `received_date` | date | Eingangsdatum |
| `deadline` | date | 30-Tage-Deadline berechnet |
| `status` | enum | `in_progress`, `priority`, `completed` |
| `assigned_to` | uuid FK → User | Bearbeiter |
| `response_text` | text | |
| `response_template_id` | uuid | Mustertexte |
| `completed_date` | date | |
| `notes` | text | |

### 9.4 DataBreach (Vorfallmanagement)
> Ref: D-04. Vorfallmanagement mit 72h-Deadline

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `incident_id` | uuid FK → Incident | Verknüpfung mit ISMS-Incident (I-07) |
| `title` | varchar(500) | Bezeichnung des Vorfalls |
| `description` | text | |
| `detected_at` | timestamptz | |
| `notification_deadline` | timestamptz | 72h nach Erkennung |
| `authority_notified` | boolean | Aufsichtsbehörde informiert |
| `authority_notified_at` | timestamptz | |
| `data_subjects_notified` | boolean | Betroffene informiert (Art. 34) |
| `risk_level` | enum | `no_risk`, `risk`, `high_risk` |
| `affected_data_categories` | jsonb | |
| `affected_count_estimate` | int | |
| `measures_taken` | text | |
| `status` | enum | `in_progress`, `priority`, `completed` |
| `assigned_to` | uuid FK → User | |

### 9.5 TransferAssessment (Drittlandtransfer-Prüfung / TIA)
> Ref: D-07. TIA mit Zuordnung zu VVZ und Dienstleister

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `ropa_id` | uuid FK → RoPA | |
| `supplier_id` | uuid FK → Supplier | |
| `third_country` | varchar(3) | ISO 3166-1 |
| `transfer_mechanism` | enum | `adequacy_decision`, `scc`, `bcr`, `derogation`, `other` |
| `assessment_result` | text | |
| `status` | enum | `new`, `in_progress`, `reviewed`, `inactive` |
| `next_review_date` | date | Nächster Prüftermin |
| `lfd_nr` | int | |

### 9.6 TOM (Technische und Organisatorische Actions)
> Ref: D-05. TOM-Aufstellung als eigene Funktion

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `category` | enum | `access_control`, `encryption`, `pseudonymization`, `availability`, `resilience`, `recoverability`, `evaluation` |
| `title` | varchar(500) | |
| `description` | text | |
| `implementation_status` | enum | `implemented`, `partially_implemented`, `planned`, `not_applicable` |
| `document_id` | uuid FK → Document | Verknüpfung zur Dokumentation |
| `status` | enum | `new`, `in_progress`, `reviewed`, `inactive` |

---

## 10. Incidents (I-07)

### 10.1 Incident
> Ref: I-07, auch verwendet für DataBreach (D-04)

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `title` | varchar(500) | |
| `description` | text | |
| `incident_type` | enum | `security`, `data_breach`, `operational`, `it_failure`, `physical` |
| `severity` | enum | `critical`, `high`, `medium`, `low` |
| `status` | enum | `detected`, `investigating`, `contained`, `resolved`, `closed` |
| `detected_at` | timestamptz | |
| `resolved_at` | timestamptz | |
| `reporter_id` | uuid FK → User | |
| `assigned_to` | uuid FK → User | |
| `root_cause` | text | |
| `timeline` | jsonb | Chronologischer Ablauf |

---

## 11. Supplier & TPRM (O-04, D-06)

### 11.1 Supplier
> Ref: O-04, D-06, B-09. Dienstleister-Verwaltung mit Rollen

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `name` | varchar(500) | |
| `description` | text | Description des Dienstleisters/Lieferanten |
| `role` | enum | `processor`, `joint_controller`, `controller`, `sub_processor` |
| `is_external` | boolean | |
| `is_eu` | boolean | EU flag |
| `country` | varchar(3) | |
| `risk_rating` | enum | `low`, `medium`, `high`, `critical` |
| `contact_name` | varchar(255) | |
| `contact_email` | varchar(255) | |
| `contract_status` | enum | `new`, `in_progress`, `reviewed`, `inactive` |
| `last_assessment_date` | date | |
| `next_assessment_date` | date | |
| `status` | enum | `active`, `inactive`, `terminated` |
| `notes` | text | Freitext für zusätzliche Informationen |

### 11.2 DPA (Datenverarbeitungsvereinbarung / AVV)
> Ref: D-06

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `supplier_id` | uuid FK → Supplier | |
| `org_id` | uuid FK → Organization | |
| `contract_id` | uuid FK → Contract | Verknüpfung zum Vertragsmanagement |
| `dpa_date` | date | |
| `subject_matter` | text | |
| `data_categories` | jsonb | |
| `sub_processors` | jsonb | |
| `status` | enum | `draft`, `active`, `expired`, `terminated` |

---

## 12. Documents (DM-01 bis DM-07)

### 12.1 Document
> Ref: DM-01, DM-02, DM-04

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `title` | varchar(500) | |
| `category` | enum | `policy`, `procedure`, `guideline`, `template`, `record`, `tom`, `dpa`, `bcp`, `other` |
| `content` | text | Markdown-Inhalt |
| `file_path` | varchar(1000) | Optionaler Dateianhang |
| `status` | enum | `draft`, `in_review`, `approved`, `published`, `archived`, `expired` (Ref: DM-02) |
| `current_version` | int | |
| `owner_id` | uuid FK → User | |
| `reviewer_id` | uuid FK → User | |
| `approved_by` | uuid FK → User | |
| `approved_at` | timestamptz | |
| `published_at` | timestamptz | |
| `expires_at` | timestamptz | |
| `requires_acknowledgment` | boolean | Ref: DM-05 |
| `tags` | text[] | PostgreSQL Array |
| `created_at` | timestamptz | |

### 12.2 DocumentVersion
> Ref: DM-03

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `document_id` | uuid FK → Document | |
| `version_number` | int | |
| `content` | text | |
| `change_summary` | text | |
| `created_by` | uuid FK → User | |
| `created_at` | timestamptz | |

### 12.3 Acknowledgment (Lesebestätigung)
> Ref: DM-05

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `document_id` | uuid FK → Document | |
| `user_id` | uuid FK → User | |
| `acknowledged_at` | timestamptz | |
| `version_acknowledged` | int | Welche Version bestätigt |

---

## 13. Vertragsmanagement (O-01) — MUSS-Gap/Eigenentwicklung

### 13.1 Contract
> Ref: O-01

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `supplier_id` | uuid FK → Supplier | |
| `title` | varchar(500) | |
| `contract_type` | enum | `service`, `license`, `dpa`, `nda`, `sla`, `maintenance`, `other` |
| `reference_number` | varchar(100) | |
| `start_date` | date | |
| `end_date` | date | |
| `auto_renewal` | boolean | |
| `notice_period_days` | int | |
| `value` | decimal(15,2) | |
| `currency` | varchar(3) | |
| `status` | enum | `draft`, `active`, `expired`, `terminated` |
| `responsible_id` | uuid FK → User | |
| `document_id` | uuid FK → Document | Vertragsdokument |
| `notes` | text | |
| `created_at` | timestamptz | |

### 13.2 ContractObligation
> Verpflichtungen und Deadlineen aus Contractsn

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `contract_id` | uuid FK → Contract | |
| `title` | varchar(500) | |
| `description` | text | |
| `due_date` | date | |
| `recurring` | boolean | |
| `recurrence_pattern` | varchar(100) | e.g. "quarterly", "annually" |
| `status` | enum | `pending`, `completed`, `overdue` |
| `responsible_id` | uuid FK → User | |

---

## 14. Actionstracking (O-05) — Modulübergreifend

### 14.1 Action
> Zentrale Actions-Entity. Cross-cuttingsfunktion. Ref: O-05

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `title` | varchar(500) | |
| `description` | text | |
| `source_type` | enum | `finding`, `risk_treatment`, `incident`, `audit`, `dsr`, `data_breach`, `control_test`, `manual` |
| `source_id` | uuid | Polymorphic reference auf Quelle |
| `action_type` | enum | `corrective`, `preventive`, `improvement` |
| `priority` | enum | `critical`, `high`, `medium`, `low` |
| `status` | enum | `open`, `in_progress`, `completed`, `verified`, `cancelled` |
| `assigned_to` | uuid FK → User | |
| `due_date` | date | |
| `completed_date` | date | |
| `verified_by` | uuid FK → User | |
| `verified_date` | date | |
| `effort_hours` | decimal(8,2) | Für Budgetverfolgung (O-10) |
| `created_at` | timestamptz | |

---

## 15. Budget / Kostenverfolgung (O-10) — MUSS-Gap/Eigenentwicklung

### 15.1 Budget
> Ref: O-10

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `area` | enum | `risk_management`, `isms`, `bcm`, `audit`, `privacy`, `compliance`, `general` |
| `fiscal_year` | int | |
| `planned_amount` | decimal(15,2) | |
| `actual_amount` | decimal(15,2) | |
| `currency` | varchar(3) | |
| `notes` | text | |

### 15.2 BudgetItem
> Einzelposten

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `budget_id` | uuid FK → Budget | |
| `title` | varchar(500) | |
| `category` | enum | `personnel`, `tools`, `consulting`, `training`, `certification`, `other` |
| `planned_amount` | decimal(15,2) | |
| `actual_amount` | decimal(15,2) | |
| `action_id` | uuid FK → Action | Optional: Verknüpfung mit Maßnahme |
| `date` | date | |
| `notes` | text | |

---

## 16. Security Awareness (I-09) — Gap/Eigenentwicklung

### 16.1 TrainingCampaign
> Ref: I-09

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `title` | varchar(500) | |
| `description` | text | |
| `training_type` | enum | `awareness`, `phishing_simulation`, `certification`, `workshop` |
| `due_date` | date | |
| `status` | enum | `planned`, `active`, `completed` |

### 16.2 TrainingRecord
> Ref: I-09

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `campaign_id` | uuid FK → TrainingCampaign | |
| `user_id` | uuid FK → User | |
| `status` | enum | `assigned`, `started`, `completed`, `overdue` |
| `completed_at` | timestamptz | |
| `score` | decimal(5,2) | Optional: Testergebnis |
| `certificate_valid_until` | date | Ablaufdatum |

---

## 17. Kern-Join-Tabellen (m:n Relationen)

### Process ↔ Risk (Prozessebene)
> Risiken auf Totalprozess-Ebene. Ref: E-06, E-07
```sql
CREATE TABLE process_risk (
  process_id uuid REFERENCES process(id),
  risk_id uuid REFERENCES risk(id),
  risk_context text,  -- e.g. "Ausfall des gesamten Beschaffungsprozesses"
  PRIMARY KEY (process_id, risk_id)
);
```

### Process ↔ Control (Prozessebene)
> Kontrollen auf Totalprozess-Ebene. Ref: K-01, K-06
```sql
CREATE TABLE process_control (
  process_id uuid REFERENCES process(id),
  control_id uuid REFERENCES control(id),
  control_context text,  -- e.g. "4-Augen-Prinzip für gesamten Freigabeprozess"
  PRIMARY KEY (process_id, control_id)
);
```

### ProcessStep ↔ Risk (Prozessschritt-Ebene)
> Risiken an einzelnen Aktivitäten/Schritten. Ref: P-05, E-07
```sql
CREATE TABLE process_step_risk (
  process_step_id uuid REFERENCES process_step(id),
  risk_id uuid REFERENCES risk(id),
  risk_context text,  -- e.g. "Fehlerhafte Eingabe bei manueller Dateneingabe"
  PRIMARY KEY (process_step_id, risk_id)
);
```

### ProcessStep ↔ Control (Prozessschritt-Ebene)
> Kontrollen an einzelnen Aktivitäten/Schritten. Ref: P-05, K-01
```sql
CREATE TABLE process_step_control (
  process_step_id uuid REFERENCES process_step(id),
  control_id uuid REFERENCES control(id),
  control_context text,  -- e.g. "Validierungsregel bei Schritt 3"
  PRIMARY KEY (process_step_id, control_id)
);
```

### Risk ↔ Control (RCM)
```sql
CREATE TABLE risk_control (
  risk_id uuid REFERENCES risk(id),
  control_id uuid REFERENCES control(id),
  effectiveness_rating enum('strong','adequate','weak'),
  PRIMARY KEY (risk_id, control_id)
);
```

### Risk ↔ Asset
```sql
CREATE TABLE risk_asset (
  risk_id uuid REFERENCES risk(id),
  asset_id uuid REFERENCES asset(id),
  PRIMARY KEY (risk_id, asset_id)
);
```

### Control ↔ Requirement
```sql
CREATE TABLE control_requirement (
  control_id uuid REFERENCES control(id),
  requirement_id uuid REFERENCES requirement(id),
  implementation_status enum('implemented','partial','planned'),
  PRIMARY KEY (control_id, requirement_id)
);
```

### Document ↔ Entity (polymorphe Verknüpfung)
```sql
CREATE TABLE document_link (
  document_id uuid REFERENCES document(id),
  entity_type varchar(100),
  entity_id uuid,
  link_type varchar(50),
  PRIMARY KEY (document_id, entity_type, entity_id)
);
```

### RoPA ↔ Supplier
```sql
CREATE TABLE ropa_supplier (
  ropa_id uuid REFERENCES ropa(id),
  supplier_id uuid REFERENCES supplier(id),
  role varchar(100),
  PRIMARY KEY (ropa_id, supplier_id)
);
```

### Asset ↔ BIA
```sql
CREATE TABLE asset_bia (
  asset_id uuid REFERENCES asset(id),
  bia_id uuid REFERENCES bia(id),
  dependency_type varchar(100),
  PRIMARY KEY (asset_id, bia_id)
);
```

---

## 17b. Generic Comment System

### Comment
> Comments/Notizen können an jede Entity gehängt werden. Ermöglicht Diskussionen, Erklärungen und Dokumentation direkt am Objekt. Unterstützt auch Antworten (Threads).

| Field | Type | Description |
|------|-----|--------------|
| `id` | uuid PK | |
| `org_id` | uuid FK → Organization | |
| `entity_type` | varchar(100) | Any entity: `risk`, `control`, `finding`, `audit`, `process`, `ropa`, `incident`, `action`, `supplier`, `contract`, etc. |
| `entity_id` | uuid | Polymorphic reference |
| `parent_comment_id` | uuid FK → Comment | For threads/replies (NULL = Top-Level) |
| `author_id` | uuid FK → User | |
| `content` | text | Comment text (Markdown) |
| `is_internal` | boolean | Internal notes only (not in reports) |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `deleted_at` | timestamptz | Soft Delete |

> **Usage examples:**
> - Auditor leaves note on a finding
> - Risk owner justifies risk acceptance
> - DPO comments on a DPIA
> - Control tester documents observations
> - Process owner explains a process change

---

## 18. Entity-Statistik

| Domain | Entities | Requirement Mapping |
|--------|----------|-------------------|
| Platform Core | Organization, User, UserOrganizationRole, AuditLog, AccessLog, DataExportLog, Notification | G-01 bis G-12 |
| BPM | Process, ProcessVersion, ProcessStep | P-01 bis P-10 |
| Frameworks | Framework, Requirement, FrameworkMapping, ComplianceAssessment | I-01, I-02, I-03, I-06 |
| Assets | Asset, Vulnerability | I-04, I-08 |
| Risk Management | Risk, RiskTreatment, KRI, KRIMeasurement | E-01 bis E-12 |
| Controls / IKS | Control, ControlTest | K-01 bis K-08 |
| Audit | Audit, AuditChecklist, Finding | A-01 bis A-08 |
| BCMS | BIA, BIASupplierDependency, BCP, Exercise | B-01 bis B-09 |
| DPMS | RoPA, DPIA, DataSubjectRequest, DataBreach, TransferAssessment, TOM | D-01 bis D-10 |
| Incidents | Incident | I-07 |
| Supplier / TPRM | Supplier, DPA | O-04, D-06 |
| Documents | Document, DocumentVersion, Acknowledgment | DM-01 bis DM-07 |
| Contracts | Contract, ContractObligation | O-01 |
| Actions | Action | O-05 |
| Budget | Budget, BudgetItem | O-10 |
| Training | TrainingCampaign, TrainingRecord | I-09 |
| Cross-cutting: Evidence | Evidence (polymorph an 17+ Entity-Typeen) | K-03, A-03, A-05, D-04, B-06 |
| Cross-cutting: Comments | Comment (polymorph an alle Entities) | G-07 (Nachvollziehbarkeit) |
| **Total** | **44 Entities + 10 Join-Tabellen** | **88 Requirements** |

---

## 19. Next Steps

1. **PostgreSQL Schema erstellen**: Diese Definitionen in `CREATE TABLE`-Statements überführen, mit RLS-Policies pro `org_id`
2. **Audit-Trail-Infrastruktur (Priorität 1)**:
   - DB-Trigger auf allen Business-Tabellen die automatisch in `audit_log` schreiben
   - `RULE` oder `TRIGGER` auf `audit_log` der UPDATE/DELETE verhindert (append-only)
   - Hash-Ketten-Funktion: `entry_hash = SHA256(previous_hash + alle Fielder)`
   - Partitionierung der `audit_log`-Tabelle nach Monat (Performance bei großen Datenmengen)
   - Separate `access_log` und `data_export_log` mit gleichen Schutzmaßnahmen
3. **Cross-Cutting Fielder automatisieren**: PostgreSQL-Trigger oder ORM-Middleware für `created_by`, `updated_by`, `deleted_by` auf allen Tabellen
4. **Prisma/Drizzle Schema**: Je nach ORM-Wahl das Schema in TypeeScript-Typeen überführen
5. **API-Endpunkte ableiten**: CRUD pro Entity + spezifische Business-Endpoints (e.g. `POST /risks/{id}/assess`) + `GET /audit-log?entity_type=risk&entity_id=...` für Änderungshistorie pro Objekt
6. **Seed-Daten**: Framework-Bibliothek (ISO 27001, NIS2, BSI Grundschutz) als Seed-Daten vorbereiten
7. **Index-Strategie**: Composite Indexes auf `(org_id, status)`, Full-Text-Search auf `title`/`description`, Index auf `audit_log(entity_type, entity_id, created_at)` für schnelle Historienabfragen
